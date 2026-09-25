-- =============================================================================
-- 20260925010000_payments_rls_lockdown.sql
-- Fecha duas brechas de RLS em payments (confirmadas em pg_policies ao vivo):
--
-- 1. payments_select_safe era FOR ALL com USING (institution_id =
--    get_my_institution_id() OR is_super_admin_user()) e sem WITH CHECK
--    próprio — em FOR ALL o USING vale também como WITH CHECK, então qualquer
--    usuário da escola conseguia INSERT/UPDATE/DELETE nas cobranças da própria
--    escola (ex: UPDATE status = 'paid' direto pelo navegador). Vira SELECT
--    puro; escrita fica só com Super Admin (policies abaixo) e service role
--    (Edge Functions asaas-*, zapsign-webhook, crons — bypassam RLS).
--
-- 2. payments_anon_select (SELECT USING true, role anon) deixava qualquer
--    visitante sem login ler todas as cobranças de todas as escolas. Nenhuma
--    tela pública lê payments (api/pagar-redirect.ts usa service role e outra
--    tabela) — removida, e os GRANTs do anon revogados como defesa extra.
--
-- Uso legítimo conferido no código antes da mudança:
--   - escola (school_user): só SELECT — SystemSettings.tsx (aba Pagamentos),
--     GestorHome.tsx (alerta de atraso).
--   - Super Admin (admin_geral): SELECT/INSERT/UPDATE/DELETE — AdminFinancial,
--     AdminHome, AdminSchools, InstitutionDetails. INSERT dependia do FOR ALL
--     removido aqui; ganha policy explícita, mesmo critério das de UPDATE/DELETE
--     que já existiam.
--   - super_admin_payments (FOR ALL por e-mail em super_admins) fica como está.
-- =============================================================================

DROP POLICY IF EXISTS "payments_anon_select" ON payments;
REVOKE ALL ON payments FROM anon;

DROP POLICY IF EXISTS "payments_select_safe" ON payments;
DROP POLICY IF EXISTS "payments_select_own_institution" ON payments;
CREATE POLICY "payments_select_own_institution" ON payments
  FOR SELECT
  TO authenticated
  USING (institution_id = get_my_institution_id() OR is_super_admin_user());

DROP POLICY IF EXISTS "admin_geral_insert_payments" ON payments;
CREATE POLICY "admin_geral_insert_payments" ON payments
  FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin_user());
