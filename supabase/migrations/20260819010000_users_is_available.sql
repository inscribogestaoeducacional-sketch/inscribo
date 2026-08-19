-- =============================================================================
-- 20260819010000_users_is_available.sql
-- Disponibilidade manual do atendente (toggle "Disponível/Ausente" no
-- TopBar). Afeta só a distribuição round-robin de grupo no WhatsApp
-- (timeout_group_id) — não reatribui conversas já em andamento nem tem
-- efeito em escolas com atendente único.
--
-- Coluna nova e dedicada (não reaproveita `active`) porque o trigger
-- trg_prevent_self_privilege_escalation (20260701000014_fix_users_rls.sql)
-- reverte silenciosamente qualquer UPDATE de `active` feito pelo próprio
-- usuário quando ele não é admin/manager/super_admin — exatamente o caso de
-- um atendente comum mexendo no próprio status. `is_available` não está na
-- lista de campos protegidos desse trigger, então o self-update funciona
-- direto via a policy já existente "users_update_own" (auth.uid() = id).
-- =============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;
