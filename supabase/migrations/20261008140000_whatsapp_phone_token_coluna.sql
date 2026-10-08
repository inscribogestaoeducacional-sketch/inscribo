-- 20261008140000_whatsapp_phone_token_coluna.sql
--
-- E1 — whatsapp_phone_numbers.access_token (token da Meta do número da
-- escola) era legível por qualquer usuário logado da escola (policy por
-- institution_id + grant de tabela inteira), e anon tinha todos os grants.
-- Com o token dá pra enviar mensagem como a escola.
--
-- Nenhuma tela lê ou grava o token pelo navegador: ele só é gravado pelo
-- servidor (api/whatsapp/embedded-signup, service role) e lido pelas
-- funções (service role). Então:
--   • anon: nenhum acesso à tabela.
--   • authenticated: SELECT/INSERT/UPDATE só nas colunas que não são segredo
--     (tudo menos access_token). DELETE continua sob a RLS de sempre.
--   • service role (servidor) não muda.
-- Consequência: select('*') nesta tabela passa a dar "permission denied"
-- pra qualquer usuário — o front lista as colunas (WHATSAPP_PHONE_COLUMNS).
-- Nenhum dado é alterado.

REVOKE ALL ON public.whatsapp_phone_numbers FROM anon;
REVOKE SELECT, INSERT, UPDATE, TRUNCATE, TRIGGER, REFERENCES ON public.whatsapp_phone_numbers FROM authenticated;

GRANT SELECT (id, institution_id, phone_number_id, phone_number, display_name, waba_id, is_active,
              created_at, use_meta_api, school_group_id, connection_method, token_expires_at)
  ON public.whatsapp_phone_numbers TO authenticated;
GRANT INSERT (institution_id, phone_number_id, phone_number, display_name, waba_id, is_active,
              use_meta_api, school_group_id, connection_method, token_expires_at)
  ON public.whatsapp_phone_numbers TO authenticated;
GRANT UPDATE (institution_id, phone_number_id, phone_number, display_name, waba_id, is_active,
              use_meta_api, school_group_id, connection_method, token_expires_at)
  ON public.whatsapp_phone_numbers TO authenticated;
