-- =============================================================================
-- 20260804000000_merge_duplicate_whatsapp_conversations.sql
--
-- Corrige a duplicidade de whatsapp_conversations/whatsapp_messages causada
-- pela divergência de normalização de telefone identificada na investigação
-- da Fase B do Raio-X: pontos "outbound-first" (raio-x-followup,
-- AionInboxHub.tsx:handleNewConv) sempre gravavam remote_jid já normalizado
-- (13 dígitos, com o 9º dígito), enquanto o webhook real
-- (api/whatsapp/webhook.ts) usava msg.from cru da Meta como remote_jid —
-- pra números BR, frequentemente 12 dígitos (sem o 9º).
--
-- Essa MESMA classe de bug já tinha sido diagnosticada em produção pro lado
-- das escolas em 20260701000009_fix_transfer_cutoff_v2.sql (conversa do
-- Victor Almeida: "558396035018" vs "5583996035018" pro mesmo contato) e
-- corrigida ali só na camada de RLS, via whatsapp_base_jid() — que já
-- chama normalize_phone_br() (criada em 20260521000002_normalize_phones_br.sql)
-- e está guardada em coluna gerada (base_jid, 20260701000013) em
-- whatsapp_conversations e whatsapp_messages. Aquele fix resolveu a
-- VISIBILIDADE das mensagens entre linhas duplicadas, mas não consolidou as
-- linhas em si. Agora que api/whatsapp/webhook.ts também passou a normalizar
-- o remote_jid ao GRAVAR (mesma normalizePhone() do próprio arquivo, ver
-- supabase/functions/_shared/phone.ts e src/lib/phone.ts pras cópias
-- compartilhadas), essa limpeza pontual não deve voltar a acontecer a cada
-- novo webhook recebido.
--
-- ESTRATÉGIA — por grupo (mesma institution_id [NULL = Inbox Áion] + mesmo
-- is_aion_inbox + mesmo base_jid) com mais de uma conversa:
--   1. Escolhe a "vencedora": mais mensagens associadas (mais atividade);
--      empate resolvido pela mais antiga (created_at mais cedo).
--   2. Pra cada outra conversa do grupo ("perdedora"): realoca as mensagens
--      dela pra vencedora (mesma chave usada pelo código: institution_id +
--      is_aion_inbox + remote_jid), mescla campos de estado (o lado com
--      last_message_at mais recente vence nesses campos — reflete o estado
--      real mais atual da conversa) e remove a linha perdedora. Campos de
--      identidade/posse (id, created_at, assigned_user_id, transferred_at/
--      from, queue, contact_name) NUNCA vêm da perdedora — só da vencedora,
--      pra não alterar silenciosamente dono ou histórico de transferência.
--   3. Só depois de remover todas as perdedoras do grupo (pra não violar o
--      UNIQUE(institution_id, remote_jid)), normaliza o remote_jid da
--      vencedora e de todas as mensagens do grupo pro valor canônico
--      (base_jid) — assim os .eq('remote_jid', ...) exatos do código passam
--      a bater igual pra qualquer linha que ainda restar.
--
-- Idempotente: sem duplicatas (ou já tendo rodado), os UPDATE/DELETE abaixo
-- não afetam nenhuma linha. Roda inteira em uma transação implícita (padrão
-- do `supabase db push`) — se algo falhar no meio, nada é aplicado.
-- =============================================================================

DO $$
DECLARE
  r_group          RECORD;
  r_loser          RECORD;
  v_keeper_id       UUID;
  v_rows_affected   INTEGER;
  v_groups_merged   INTEGER := 0;
  v_convs_removed   INTEGER := 0;
  v_msgs_relinked   INTEGER := 0;
BEGIN
  FOR r_group IN
    SELECT
      institution_id,
      COALESCE(is_aion_inbox, false) AS is_aion_inbox,
      base_jid,
      COUNT(*) AS n
    FROM whatsapp_conversations
    WHERE base_jid IS NOT NULL AND base_jid <> ''
    GROUP BY institution_id, COALESCE(is_aion_inbox, false), base_jid
    HAVING COUNT(*) > 1
  LOOP
    -- Vencedora do grupo: mais mensagens associadas, empate = mais antiga.
    SELECT wc.id INTO v_keeper_id
    FROM whatsapp_conversations wc
    WHERE wc.institution_id IS NOT DISTINCT FROM r_group.institution_id
      AND COALESCE(wc.is_aion_inbox, false) = r_group.is_aion_inbox
      AND wc.base_jid = r_group.base_jid
    ORDER BY (
      SELECT COUNT(*) FROM whatsapp_messages wm
      WHERE wm.institution_id IS NOT DISTINCT FROM r_group.institution_id
        AND COALESCE(wm.is_aion_inbox, false) = r_group.is_aion_inbox
        AND wm.base_jid = r_group.base_jid
        AND wm.remote_jid = wc.remote_jid
    ) DESC, wc.created_at ASC NULLS LAST
    LIMIT 1;

    IF v_keeper_id IS NULL THEN
      CONTINUE; -- não deveria acontecer (HAVING COUNT(*) > 1 garante ao menos 1 linha), defensivo
    END IF;

    FOR r_loser IN
      SELECT wc.id, wc.remote_jid, wc.status, wc.last_message, wc.last_message_at,
             wc.last_customer_message_at, wc.unread_count, wc.tags,
             wc.lead_id, wc.aion_lead_id, wc.bot_active, wc.bot_current_node, wc.bot_variables
      FROM whatsapp_conversations wc
      WHERE wc.institution_id IS NOT DISTINCT FROM r_group.institution_id
        AND COALESCE(wc.is_aion_inbox, false) = r_group.is_aion_inbox
        AND wc.base_jid = r_group.base_jid
        AND wc.id <> v_keeper_id
    LOOP
      -- Realoca as mensagens da perdedora pra vencedora, já no formato
      -- canônico (base_jid do grupo).
      UPDATE whatsapp_messages
      SET remote_jid      = r_group.base_jid,
          conversation_id = v_keeper_id
      WHERE institution_id IS NOT DISTINCT FROM r_group.institution_id
        AND COALESCE(is_aion_inbox, false) = r_group.is_aion_inbox
        AND remote_jid = r_loser.remote_jid;
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      v_msgs_relinked := v_msgs_relinked + v_rows_affected;

      -- Mescla campos de "conversa em andamento": quem tem last_message_at
      -- mais recente vence. Identidade/posse fica sempre com a vencedora
      -- (não tocados aqui).
      UPDATE whatsapp_conversations wc SET
        status                   = CASE WHEN COALESCE(r_loser.last_message_at, '-infinity'::timestamptz) > COALESCE(wc.last_message_at, '-infinity'::timestamptz)
                                      THEN r_loser.status ELSE wc.status END,
        last_message             = CASE WHEN COALESCE(r_loser.last_message_at, '-infinity'::timestamptz) > COALESCE(wc.last_message_at, '-infinity'::timestamptz)
                                      THEN r_loser.last_message ELSE wc.last_message END,
        bot_active               = CASE WHEN COALESCE(r_loser.last_message_at, '-infinity'::timestamptz) > COALESCE(wc.last_message_at, '-infinity'::timestamptz)
                                      THEN r_loser.bot_active ELSE wc.bot_active END,
        bot_current_node         = CASE WHEN COALESCE(r_loser.last_message_at, '-infinity'::timestamptz) > COALESCE(wc.last_message_at, '-infinity'::timestamptz)
                                      THEN r_loser.bot_current_node ELSE wc.bot_current_node END,
        bot_variables            = CASE WHEN COALESCE(r_loser.last_message_at, '-infinity'::timestamptz) > COALESCE(wc.last_message_at, '-infinity'::timestamptz)
                                      THEN r_loser.bot_variables ELSE wc.bot_variables END,
        last_message_at          = GREATEST(wc.last_message_at, r_loser.last_message_at),
        last_customer_message_at = GREATEST(wc.last_customer_message_at, r_loser.last_customer_message_at),
        unread_count             = COALESCE(wc.unread_count, 0) + COALESCE(r_loser.unread_count, 0),
        tags                     = COALESCE((SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(wc.tags, '{}') || COALESCE(r_loser.tags, '{}')))), wc.tags),
        lead_id                  = COALESCE(wc.lead_id, r_loser.lead_id),
        aion_lead_id             = COALESCE(wc.aion_lead_id, r_loser.aion_lead_id)
      WHERE wc.id = v_keeper_id;

      DELETE FROM whatsapp_conversations WHERE id = r_loser.id;
      v_convs_removed := v_convs_removed + 1;
    END LOOP;

    -- Só agora, com todas as perdedoras do grupo já removidas, normaliza o
    -- remote_jid da vencedora e das mensagens que já eram dela (não só as
    -- realocadas acima) — sem risco de violar UNIQUE(institution_id, remote_jid).
    UPDATE whatsapp_conversations
    SET remote_jid = r_group.base_jid
    WHERE id = v_keeper_id AND remote_jid <> r_group.base_jid;

    UPDATE whatsapp_messages
    SET remote_jid = r_group.base_jid
    WHERE institution_id IS NOT DISTINCT FROM r_group.institution_id
      AND COALESCE(is_aion_inbox, false) = r_group.is_aion_inbox
      AND base_jid = r_group.base_jid
      AND remote_jid <> r_group.base_jid;

    v_groups_merged := v_groups_merged + 1;
  END LOOP;

  RAISE NOTICE 'whatsapp_conversations: % grupo(s) duplicado(s) mesclado(s), % conversa(s) removida(s), % mensagem(ns) realocada(s).',
    v_groups_merged, v_convs_removed, v_msgs_relinked;
END $$;

-- ── Verificação: não deve sobrar nenhum grupo com mais de uma conversa ──────
SELECT
  institution_id,
  COALESCE(is_aion_inbox, false) AS is_aion_inbox,
  base_jid,
  COUNT(*) AS conversas_restantes
FROM whatsapp_conversations
WHERE base_jid IS NOT NULL AND base_jid <> ''
GROUP BY institution_id, COALESCE(is_aion_inbox, false), base_jid
HAVING COUNT(*) > 1;
