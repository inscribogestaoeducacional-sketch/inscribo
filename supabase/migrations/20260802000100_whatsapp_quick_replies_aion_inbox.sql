-- =============================================================================
-- 20260802000100_whatsapp_quick_replies_aion_inbox.sql
-- Libera o Inbox Áion pra usar whatsapp_quick_replies com platform_whatsapp.id
-- como pseudo-institution_id — mesmo truque já usado em whatsapp_flows pelo
-- FlowEditor (ver AdminAionInbox.tsx "Fluxo do Bot").
--
-- As policies atuais (quick_replies_select/insert/update/delete, de
-- 20260701000004_quick_replies.sql) exigem institution_id =
-- current_user_institution_id() — que pra admin_geral é NULL (não tem escola),
-- então NULL = platform_whatsapp.id nunca é true e o Inbox Áion fica bloqueado.
--
-- Em vez de alterar as policies existentes (risco de quebrar o lado escola,
-- que já funciona), adiciona 4 policies novas, aditivas (Postgres combina
-- policies do mesmo comando com OR), liberando só quando:
--   1. institution_id bate com algum platform_whatsapp.id (é uma pseudo-
--      instituição do Inbox Áion, não uma escola de verdade)
--   2. o usuário é admin_geral (is_super_admin_user(), mesmo padrão já usado
--      em crm_leads/crm_meetings/financial_entries/proposals/payments)
-- =============================================================================

DROP POLICY IF EXISTS "quick_replies_aion_select" ON whatsapp_quick_replies;
CREATE POLICY "quick_replies_aion_select" ON whatsapp_quick_replies
  FOR SELECT
  USING (
    is_super_admin_user()
    AND institution_id IN (SELECT id FROM platform_whatsapp)
  );

DROP POLICY IF EXISTS "quick_replies_aion_insert" ON whatsapp_quick_replies;
CREATE POLICY "quick_replies_aion_insert" ON whatsapp_quick_replies
  FOR INSERT
  WITH CHECK (
    is_super_admin_user()
    AND institution_id IN (SELECT id FROM platform_whatsapp)
  );

DROP POLICY IF EXISTS "quick_replies_aion_update" ON whatsapp_quick_replies;
CREATE POLICY "quick_replies_aion_update" ON whatsapp_quick_replies
  FOR UPDATE
  USING (
    is_super_admin_user()
    AND institution_id IN (SELECT id FROM platform_whatsapp)
  )
  WITH CHECK (
    is_super_admin_user()
    AND institution_id IN (SELECT id FROM platform_whatsapp)
  );

DROP POLICY IF EXISTS "quick_replies_aion_delete" ON whatsapp_quick_replies;
CREATE POLICY "quick_replies_aion_delete" ON whatsapp_quick_replies
  FOR DELETE
  USING (
    is_super_admin_user()
    AND institution_id IN (SELECT id FROM platform_whatsapp)
  );
