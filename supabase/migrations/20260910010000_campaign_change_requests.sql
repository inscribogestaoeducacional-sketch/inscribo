-- =============================================================================
-- 20260910010000_campaign_change_requests.sql
-- Tabela real para o fluxo de "Ajustar campanha": hoje o wizard
-- (CampaignGeneratorModal.tsx, isAdjustMode) já tenta gravar aqui, mas a
-- tabela nunca existiu — todo ajuste de uma campanha 'active' falhava
-- silenciosamente (o erro do insert nunca era checado, então o gestor via
-- "Solicitação enviada" mesmo sem nada ser salvo).
--
-- Fluxo: gestor pede ajuste -> linha aqui com status='pending' -> Super
-- Admin aprova (aplica requested_changes em campaign_cycles/funnel_metrics/
-- monthly_reenrollments/marketing_campaigns, via applyCampaignCycle() em
-- src/lib/campaignApply.ts) ou rejeita (só marca status, nada é aplicado).
-- =============================================================================

CREATE TABLE campaign_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_cycle_id UUID NOT NULL REFERENCES campaign_cycles(id),
  institution_id UUID NOT NULL REFERENCES institutions(id),
  requested_by UUID REFERENCES users(id),
  requested_changes JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_change_requests_institution ON campaign_change_requests(institution_id);
CREATE INDEX idx_campaign_change_requests_cycle ON campaign_change_requests(campaign_cycle_id);
CREATE INDEX idx_campaign_change_requests_status ON campaign_change_requests(status);

ALTER TABLE campaign_change_requests ENABLE ROW LEVEL SECURITY;

-- Gestor da instituição: cria e vê as próprias solicitações.
CREATE POLICY "gestor_insert_own_change_requests" ON campaign_change_requests
  FOR INSERT WITH CHECK (institution_id = current_user_institution_id());
CREATE POLICY "gestor_select_own_change_requests" ON campaign_change_requests
  FOR SELECT USING (institution_id = current_user_institution_id());

-- Super Admin: vê e atualiza (aprova/rejeita) qualquer solicitação — mesmo
-- padrão is_super_admin_user() já usado em payment_invoices/financial_entries.
CREATE POLICY "admin_geral_change_requests" ON campaign_change_requests
  FOR ALL USING (is_super_admin_user()) WITH CHECK (is_super_admin_user());
