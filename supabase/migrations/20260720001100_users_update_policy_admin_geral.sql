-- =============================================================================
-- 20260720001100_users_update_policy_admin_geral.sql
-- Mesma correção já aplicada à policy de DELETE de `users`
-- ("Super admins can delete all users", 20260701000014_fix_users_rls.sql:77-80):
-- a policy de UPDATE ainda dependia de is_super_admin(email) (tabela antiga
-- super_admins), desconectada de user_type — é a causa raiz identificada do
-- "sucesso falso" ao desativar consultor em AdminConsultants.tsx (RLS bloqueia
-- silenciosamente o UPDATE, sem gerar erro no client).
--
-- Depende de is_super_admin_user() já estar redefinida pra user_type =
-- 'admin_geral' (20260720000200_crm_leads_platform_costs_consultant_split.sql)
-- — aplicar essa migration antes ou junto desta.
-- =============================================================================

DROP POLICY IF EXISTS "Super admins can update all users" ON users;
CREATE POLICY "admin_geral_update_users" ON users
  FOR UPDATE
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());
