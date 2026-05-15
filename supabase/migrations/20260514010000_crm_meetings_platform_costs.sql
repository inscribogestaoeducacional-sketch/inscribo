-- =============================================================================
-- 20260514010000_crm_meetings_platform_costs.sql
-- Tabelas: crm_meetings, platform_costs
-- Alterações: onboarding_meetings (google fields), crm_leads (converted_institution_id)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. crm_meetings — reuniões vinculadas a leads do CRM
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_meetings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          UUID        REFERENCES crm_leads(id) ON DELETE CASCADE,
  institution_id   UUID        REFERENCES institutions(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  type             TEXT        DEFAULT 'video',  -- video | phone | presential
  scheduled_at     TIMESTAMPTZ NOT NULL,
  duration_min     INTEGER     DEFAULT 30,
  meet_link        TEXT,
  google_event_id  TEXT,
  calendar_link    TEXT,
  attendees        JSONB       DEFAULT '[]',
  status           TEXT        DEFAULT 'scheduled',  -- scheduled | completed | cancelled
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE crm_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_crm_meetings" ON crm_meetings;
CREATE POLICY "admin_crm_meetings" ON crm_meetings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND user_type IN ('admin_geral', 'consultant')
    )
  );

CREATE INDEX IF NOT EXISTS idx_crm_meetings_lead
  ON crm_meetings(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_meetings_scheduled
  ON crm_meetings(scheduled_at);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. onboarding_meetings — adicionar campos Google Meet/Calendar
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE onboarding_meetings
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS calendar_link   TEXT,
  ADD COLUMN IF NOT EXISTS attendees       JSONB DEFAULT '[]';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. platform_costs — custos operacionais da plataforma
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_costs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  amount      NUMERIC(10,2) NOT NULL,
  recurrence  TEXT        DEFAULT 'monthly',        -- monthly | yearly | one_time
  category    TEXT        DEFAULT 'infrastructure', -- infrastructure | tools | services | other
  active      BOOLEAN     DEFAULT true,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE platform_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_platform_costs" ON platform_costs;
CREATE POLICY "admin_platform_costs" ON platform_costs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND user_type IN ('admin_geral', 'consultant')
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. crm_leads — adicionar referência à instituição convertida
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS converted_institution_id UUID REFERENCES institutions(id);
