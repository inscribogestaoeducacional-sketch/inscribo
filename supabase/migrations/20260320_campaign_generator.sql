-- Migration: Campaign Generator + Notifications
-- Execute no Supabase Dashboard → SQL Editor

-- ─── Novos campos em campaign_cycles ───────────────────────────
ALTER TABLE campaign_cycles
  ADD COLUMN IF NOT EXISTS monthly_targets JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS market_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS historical_input JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS generation_mode TEXT DEFAULT 'benchmark'
    CHECK (generation_mode IN ('historical','benchmark','hybrid')),
  ADD COLUMN IF NOT EXISTS ai_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS realism_score TEXT
    CHECK (realism_score IN ('conservative','realistic','aggressive'));

-- ─── Notificações do sistema ────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('weekly_alert','goal_deviation','milestone','suggestion')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'info'
    CHECK (severity IN ('info','warning','danger','success')),
  read_at TIMESTAMPTZ,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'system_notifications' AND policyname = 'institution_isolation'
  ) THEN
    CREATE POLICY "institution_isolation" ON system_notifications
      USING (institution_id = (
        SELECT institution_id FROM users WHERE id = auth.uid()
      ));
  END IF;
END $$;

-- ─── Configurações de notificação na institution ────────────────
ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
    "weekly_alert": true,
    "push_enabled": false,
    "alert_deviation_threshold": 15
  }';
