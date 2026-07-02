-- =============================================================================
-- 20260701000009_fix_transfer_cutoff_v2.sql
-- Corrige a causa raiz do vazamento que persistia após a 20260701000008:
-- whatsapp_base_jid() não normalizava o "9" extra dos celulares brasileiros,
-- então mensagens antigas gravadas com um formato de número ficavam
-- "órfãs" da conversa atual gravada com o outro formato.
--
-- DIAGNÓSTICO (rodado em produção via `supabase db query --linked`):
--
-- 1. transferred_at ESTAVA sendo gravado corretamente. A conversa do
--    Victor Almeida (remote_jid = 558396035018) mostra
--    assigned_user_id = Luan Dantas, transferred_at = 2026-07-02 01:49:35,
--    transferred_from = <atendente anterior>. Não é um problema de escrita.
--
-- 2. A policy whatsapp_messages_select em produção é IDÊNTICA à definida
--    em 20260701000008 (conferido via pg_policies.qual) — a migration foi
--    aplicada corretamente. Não é um problema de deploy.
--
-- 3. A causa real: existem DUAS variações de remote_jid para o mesmo
--    contato nas tabelas whatsapp_conversations/whatsapp_messages:
--      - "558396035018"  (12 dígitos, sem o 9 extra) — formato atual,
--        usado pela conversa e por 424 mensagens.
--      - "5583996035018" (13 dígitos, com o 9 extra) — formato legado,
--        usado por 21 mensagens antigas (abr/mai/2026), todas de
--        from_me = false (cliente) ou de atendentes anteriores ao
--        sender_user_id existir.
--    whatsapp_base_jid() só removia o sufixo "@s.whatsapp.net"/"@g.us" —
--    nunca normalizou esse "9" a mais, então, para a policy de
--    whatsapp_messages_select, essas 21 mensagens não batem com
--    whatsapp_base_jid(wc.remote_jid) da conversa atual atribuída a Luan
--    (bases diferentes: "5583996035018" vs "558396035018"). Isso faz essas
--    mensagens caírem no ramo "from_me = false AND NOT EXISTS (conversa
--    atribuída a mim para este jid)" — que é justamente o ramo que libera
--    mensagem de cliente para quem NÃO é o dono atual da conversa. Como,
--    sob esse jid legado, não existe conversa atribuída a Luan, o NOT
--    EXISTS dá true e a mensagem aparece — vazando conteúdo anterior à
--    transferência.
--
-- FIX: o projeto já tem uma função de normalização de telefone BR
-- (normalize_phone_br, criada em 20260521_normalize_phones_br.sql) que
-- resolve exatamente essa ambiguidade, convertendo ambos os formatos para
-- o mesmo canônico de 13 dígitos (55 + DDD + 9 + número). Testado:
--   normalize_phone_br('5583996035018') = '5583996035018'
--   normalize_phone_br('558396035018')  = '5583996035018'
-- Redefinir whatsapp_base_jid() para usar essa função corrige o join em
-- TODOS os lugares que a usam de uma vez só — whatsapp_messages_select,
-- whatsapp_messages_delete e o trigger snapshot_visibility_on_transfer —
-- sem precisar reescrever cada policy de novo, porque o Postgres reavalia
-- a função a cada consulta (CREATE OR REPLACE já propaga imediatamente).
--
-- ITEM 3 (erros no console do browser): não foi possível inspecionar o
-- console do navegador do usuário a partir daqui — não há acesso a uma
-- sessão de browser ativa. Se os erros persistirem após esta migration,
-- será necessário que o usuário cole o texto dos 9 erros para
-- investigação (podem ser não relacionados a este bug específico).
-- =============================================================================

-- normalize_phone_br() é chamada com o schema qualificado (public.) de
-- propósito: quando esta função SQL é usada dentro de uma expressão de
-- índice (20260701000012), o Postgres faz "inlining" do corpo dela, e essa
-- resolução usa o search_path vigente no momento da criação do índice, que
-- pode não incluir "public" primeiro — sem qualificar, o CREATE INDEX falha
-- com "function normalize_phone_br(text) does not exist".
CREATE OR REPLACE FUNCTION whatsapp_base_jid(p_jid TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.normalize_phone_br(regexp_replace(p_jid, '@(s\.whatsapp\.net|g\.us)$', ''));
$$;
