-- =============================================================================
-- 20260720001300_payments_update_delete_admin_geral.sql
-- `payments` é drift: nenhuma migration deste repo tem um CREATE POLICY pra
-- essa tabela (só o DROP de "payments_auth_all" em 20260701000015). As
-- policies citadas em comentário ("payments_select_safe", "super_admin_payments")
-- nunca tiveram o texto trazido pro repo — não dá pra confirmar se cobrem
-- UPDATE/DELETE de admin_geral (mark_paid/cancel já funcionam hoje, o que
-- sugere que UMA delas cobre UPDATE, mas edição de valor/vencimento e DELETE
-- de linha nunca foram exercitados na UI, então não há evidência indireta
-- de que estejam cobertos).
--
-- Em vez de mexer nas policies desconhecidas (risco real de regressão, já
-- causou incidente antes com contracts — 20260701000016), esta migration só
-- ADICIONA duas policies novas e explícitas pra admin_geral, mesmo padrão já
-- usado em admin_geral_update_users (20260720001100). RLS permissiva é
-- somada com OR — isso amplia o que admin_geral consegue fazer, não reduz
-- nem substitui nada que já funcione hoje.
-- =============================================================================

DROP POLICY IF EXISTS "admin_geral_update_payments" ON payments;
CREATE POLICY "admin_geral_update_payments" ON payments
  FOR UPDATE
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());

DROP POLICY IF EXISTS "admin_geral_delete_payments" ON payments;
CREATE POLICY "admin_geral_delete_payments" ON payments
  FOR DELETE
  USING (is_super_admin_user());
