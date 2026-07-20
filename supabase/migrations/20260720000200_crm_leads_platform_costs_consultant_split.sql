-- =============================================================================
-- 20260720000200_crm_leads_platform_costs_consultant_split.sql
-- Primeira migration ativa da consolidação de permissões (consultor interno
-- vs. externo). Depende de users.consultant_type já existir e estar
-- preenchido para os consultores atuais (20260720000100_add_consultant_type.sql)
-- — QUALQUER consultor com consultant_type ainda NULL perde acesso a
-- crm_leads assim que esta migration rodar (ver ressalva no final do bloco
-- 2). Confirme a classificação manual antes do deploy.
--
-- Escopo (3 mudanças, cada uma isolada e revisável separadamente):
--   1. is_super_admin_user(): user_type IN ('admin_geral','consultant') -> só 'admin_geral'
--   2. crm_leads: admin_crm_leads -> 3 policies (admin_geral / interno / externo)
--   3. platform_costs: admin_platform_costs -> só admin_geral
--
-- NÃO mexe em whatsapp_conversations/whatsapp_messages (branch is_aion_inbox)
-- nem em contracts/payments/users_select_safe (drift, texto real ainda não
-- trazido pro repo) — ver ressalvas de risco no relatório que acompanha esta
-- migration.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. is_super_admin_user(): remove 'consultant' do escopo
-- Usada por: "Super admins can delete all users" (users), trigger
-- prevent_self_privilege_escalation, e (via drift, texto não confirmado no
-- repo) contracts_safe / payments_select_safe / users_select_safe / proposals_safe.
-- CREATE OR REPLACE mantém nome/assinatura — nenhuma dessas referências
-- precisa mudar.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_super_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND user_type = 'admin_geral'
    LIMIT 1
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. crm_leads: substitui admin_crm_leads (tudo-ou-nada pra qualquer
-- consultor) por 3 policies escopadas por consultant_type + dono do lead.
--
-- ⚠️ A policy admin_crm_leads original também liberava quem tem
-- role IN ('super_admin','admin_geral') (independente de user_type) — as 3
-- policies abaixo NÃO reproduzem esse fallback por `role`, só `user_type`,
-- exatamente como especificado. Se existir algum usuário real cujo
-- user_type não seja 'admin_geral' mas cujo role seja 'super_admin'/
-- 'admin_geral' (App.tsx:254-255 sugere que esse caso já foi considerado
-- possível no frontend), essa pessoa perde acesso a crm_leads nesta
-- migration. Ver ressalva completa no relatório final.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_crm_leads" ON crm_leads;

CREATE POLICY "admin_geral_crm_leads" ON crm_leads
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral')
  );

CREATE POLICY "consultant_interno_crm_leads" ON crm_leads
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND user_type = 'consultant' AND consultant_type = 'interno'
    )
    AND (consultant_id = auth.uid() OR consultant_id IS NULL)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND user_type = 'consultant' AND consultant_type = 'interno'
    )
    AND (consultant_id = auth.uid() OR consultant_id IS NULL)
  );

CREATE POLICY "consultant_externo_crm_leads" ON crm_leads
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND user_type = 'consultant' AND consultant_type = 'externo'
    )
    AND (consultant_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND user_type = 'consultant' AND consultant_type = 'externo'
    )
    AND (consultant_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. platform_costs: remove 'consultant' do escopo (é Financeiro — regra de
-- negócio confirmada é "consultor não vê Financeiro", nenhum dos dois tipos)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_platform_costs" ON platform_costs;

CREATE POLICY "admin_platform_costs" ON platform_costs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral')
  );
