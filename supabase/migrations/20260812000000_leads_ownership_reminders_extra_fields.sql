-- =============================================================================
-- 20260812000000_leads_ownership_reminders_extra_fields.sql
-- Reforma do módulo de Leads — parte 1: campos novos em `leads`.
--
-- assigned_to já existe (schema original) mas nunca era escrito pela UI —
-- corrigido em LeadKanban.tsx nesta mesma leva, não precisa de migration.
--
-- next_followup: lembrete manual por lead. Já existe em crm_leads (CRM
-- comercial interno da Áion, tabela diferente) — aqui é o equivalente pro
-- lead de matrícula da escola.
-- lead_temperature: frio/morno/quente, nullable (sem valor = não classificado).
-- campaign_cycle_id: vínculo com o ciclo de campanha ativo/liberado no
-- momento da criação do lead (preenchido em LeadKanban.tsx, nunca aqui).
-- city/origin_school/referral_source/contest_name: origem detalhada,
-- opcionais, exibidos condicionalmente no formulário conforme o `source`.
-- =============================================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS next_followup      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lead_temperature   TEXT CHECK (lead_temperature IN ('frio', 'morno', 'quente')),
  ADD COLUMN IF NOT EXISTS campaign_cycle_id  UUID REFERENCES campaign_cycles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city               TEXT,
  ADD COLUMN IF NOT EXISTS origin_school      TEXT,
  ADD COLUMN IF NOT EXISTS referral_source    TEXT,
  ADD COLUMN IF NOT EXISTS contest_name       TEXT;

-- assigned_to passa a ser filtrado ativamente (view "Meus leads"/"Sem
-- responsável", ranking por atendente) — nunca teve índice porque nunca era
-- lido no Kanban.
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_campaign_cycle ON leads(campaign_cycle_id) WHERE campaign_cycle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads(next_followup) WHERE next_followup IS NOT NULL;
