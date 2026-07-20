-- =============================================================================
-- 20260720000400_proposals_consultant_split.sql
-- Mesma consolidação de permissões aplicada a crm_leads/platform_costs em
-- 20260720000200, agora em proposals. proposals não tem institution_id nem
-- consultant_id próprios (confirmado por investigação read-only — a tabela
-- é drift, sem CREATE TABLE rastreado; só existe lead_id, sempre preenchido
-- por ProposalGenerator.tsx:127 na criação) — por isso a restrição de dono
-- é feita via EXISTS em crm_leads.consultant_id, não por coluna direta.
--
-- Mesma dependência já registrada: consultor com consultant_type ainda NULL
-- fica sem acesso a proposals também, até ser classificado manualmente.
-- =============================================================================

DROP POLICY IF EXISTS "proposals_safe" ON proposals;

CREATE POLICY "admin_geral_proposals" ON proposals
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral')
  );

CREATE POLICY "consultant_interno_proposals" ON proposals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND user_type = 'consultant' AND consultant_type = 'interno'
    )
    AND EXISTS (
      SELECT 1 FROM crm_leads cl
      WHERE cl.id = proposals.lead_id
        AND (cl.consultant_id = auth.uid() OR cl.consultant_id IS NULL)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND user_type = 'consultant' AND consultant_type = 'interno'
    )
    AND EXISTS (
      SELECT 1 FROM crm_leads cl
      WHERE cl.id = proposals.lead_id
        AND (cl.consultant_id = auth.uid() OR cl.consultant_id IS NULL)
    )
  );

CREATE POLICY "consultant_externo_proposals" ON proposals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND user_type = 'consultant' AND consultant_type = 'externo'
    )
    AND EXISTS (
      SELECT 1 FROM crm_leads cl
      WHERE cl.id = proposals.lead_id AND cl.consultant_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND user_type = 'consultant' AND consultant_type = 'externo'
    )
    AND EXISTS (
      SELECT 1 FROM crm_leads cl
      WHERE cl.id = proposals.lead_id AND cl.consultant_id = auth.uid()
    )
  );
