-- 20261008160000_contracts_rls.sql
--
-- Brecha ALTO em contracts (dados do signatário e sign_url):
--   contracts_anon_select  SELECT anon USING true          → anônimo lia todos
--   contracts_select       SELECT authenticated USING true → qualquer usuário
--                          logado de qualquer escola lia todos
--   contracts_auth_insert  INSERT WITH CHECK true          → qualquer logado
--                          inseria contrato pra qualquer escola
--   contracts_safe         ALL pra escola da linha         → escola podia
--                          editar/apagar o próprio contrato (nenhuma tela usa)
--
-- Contratos só são usados pelo Super Admin, pelo consultor (os dele) e pelas
-- funções ZapSign/Autentique (service role). Ficam:
--   super_admin_contracts     (tabela super_admins, sem mudança)
--   consultant_own_contracts  (consultor, só os dele, sem mudança)
--   contracts_admin_geral     (novo: user_type admin_geral, no lugar da parte
--                              de Super Admin de contracts_safe)
-- Nenhum dado é alterado.

DROP POLICY IF EXISTS contracts_anon_select ON public.contracts;
DROP POLICY IF EXISTS contracts_select      ON public.contracts;
DROP POLICY IF EXISTS contracts_auth_insert ON public.contracts;
DROP POLICY IF EXISTS contracts_safe        ON public.contracts;

CREATE POLICY contracts_admin_geral ON public.contracts
  FOR ALL TO authenticated
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());

REVOKE ALL ON public.contracts FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.contracts FROM authenticated;
