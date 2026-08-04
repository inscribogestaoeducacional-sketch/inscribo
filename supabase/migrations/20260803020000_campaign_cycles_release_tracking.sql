-- =============================================================================
-- 20260803020000_campaign_cycles_release_tracking.sql
--
-- Rastreio de quem/quando liberou a campanha (aba "Campanhas" nova em
-- InstitutionDetails.tsx) + normaliza o enum de status pra incluir 'released'
-- (o handleReleaseCampaign já gravava esse valor sem que o CHECK constraint
-- permitisse — write silenciosamente rejeitada, ver correção de error-check
-- feita junto no componente).
-- =============================================================================

ALTER TABLE campaign_cycles
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_by UUID REFERENCES users(id);

ALTER TABLE campaign_cycles DROP CONSTRAINT IF EXISTS campaign_cycles_status_check;
ALTER TABLE campaign_cycles ADD CONSTRAINT campaign_cycles_status_check
  CHECK (status IN ('draft','setup','active','released','completed','archived'));
