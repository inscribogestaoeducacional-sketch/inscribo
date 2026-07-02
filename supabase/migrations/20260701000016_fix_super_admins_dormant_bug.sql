-- =============================================================================
-- 20260701000016_fix_super_admins_dormant_bug.sql
-- Regressão causada por 20260701000015 (remoção de contracts_auth_all):
-- consultas em `contracts` por um admin de escola comum (não super admin)
-- passaram a estourar "permission denied for table users" (hint: GRANT
-- SELECT ON auth.users TO authenticated).
--
-- CAUSA: super_admin_contracts (policy em contracts) faz
-- `EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email())` — e
-- super_admins TEM SUA PRÓPRIA RLS, com uma policy quebrada:
--
--   "Super admins can view themselves":
--     (id = auth.uid()) OR (email = (SELECT users.email FROM auth.users
--                                     WHERE users.id = auth.uid())::text)
--
-- Essa policy lê auth.users DIRETO — tabela que o role `authenticated` não
-- tem GRANT nenhum (por design do Supabase; o acesso correto é via
-- auth.email()/auth.uid()/auth.jwt(), que são SECURITY DEFINER). As outras
-- duas policies da mesma tabela (`Super admins can read/update their own
-- data`) já fazem isso do jeito certo, com `get_current_user_email()`.
--
-- Esse bug é PRÉ-EXISTENTE — não foi introduzido por nada deste projeto.
-- Só nunca disparava porque toda consulta a `contracts` sempre passava
-- primeiro pela policy `contracts_auth_all` (USING true), e o Postgres
-- combina policies permissivas com OR de forma "short-circuit": como
-- `true` já resolve a expressão, ele nunca precisava avaliar
-- `super_admin_contracts` (e por tabela, `super_admins`) pra ninguém. Ao
-- remover essa policy-bypass em 20260701000015, o Postgres passou a
-- avaliar `super_admin_contracts` de verdade pra qualquer usuário comum
-- que não seja super admin — e caiu nesse erro.
--
-- FIX: troca a policy quebrada pelo mesmo padrão que já funciona nas
-- outras duas policies desta tabela.
-- =============================================================================

DROP POLICY IF EXISTS "Super admins can view themselves" ON super_admins;

CREATE POLICY "Super admins can view themselves" ON super_admins
  FOR SELECT
  USING (
    id = auth.uid()
    OR email = get_current_user_email()
  );
