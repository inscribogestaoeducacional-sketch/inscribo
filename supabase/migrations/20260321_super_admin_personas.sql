-- Migration: Super Admin Personas (Consultor + Admin Geral)
-- Execute no Supabase Dashboard → SQL Editor

-- ─── Nova coluna user_type em users ────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'school_user'
  CHECK (user_type IN ('school_user','consultant','admin_geral'));

-- ─── Pipeline de vendas do consultor ───────────────────────────
CREATE TABLE IF NOT EXISTS sales_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_name TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  city TEXT,
  state TEXT,
  current_students INTEGER,
  avg_monthly_fee NUMERIC(10,2),
  stage TEXT NOT NULL DEFAULT 'prospecting'
    CHECK (stage IN (
      'prospecting',
      'contacted',
      'demo_scheduled',
      'demo_done',
      'proposal',
      'negotiation',
      'won',
      'lost'
    )),
  lost_reason TEXT,
  notes TEXT,
  next_action TEXT,
  next_action_date DATE,
  estimated_value NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Implantações por escola ────────────────────────────────────
CREATE TABLE IF NOT EXISTS school_implementations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  consultant_id UUID NOT NULL REFERENCES users(id),
  pipeline_id UUID REFERENCES sales_pipeline(id),
  school_name TEXT NOT NULL,
  started_at DATE,
  target_go_live DATE,
  status TEXT DEFAULT 'not_started'
    CHECK (status IN ('not_started','in_progress','completed','stuck')),
  step_onboarding_done BOOLEAN DEFAULT FALSE,
  step_whatsapp_connected BOOLEAN DEFAULT FALSE,
  step_campaign_configured BOOLEAN DEFAULT FALSE,
  step_team_trained BOOLEAN DEFAULT FALSE,
  step_first_lead BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  total_leads INTEGER DEFAULT 0,
  health_score INTEGER DEFAULT 0
    CHECK (health_score BETWEEN 0 AND 100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS ───────────────────────────────────────────────────────
ALTER TABLE sales_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_implementations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sales_pipeline' AND policyname = 'consultant_own_pipeline'
  ) THEN
    CREATE POLICY "consultant_own_pipeline" ON sales_pipeline
      USING (consultant_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sales_pipeline' AND policyname = 'admin_all_pipeline'
  ) THEN
    CREATE POLICY "admin_all_pipeline" ON sales_pipeline
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE id = auth.uid()
          AND user_type = 'admin_geral'
        )
        OR is_super_admin(auth.email())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'school_implementations' AND policyname = 'consultant_own_implementations'
  ) THEN
    CREATE POLICY "consultant_own_implementations" ON school_implementations
      USING (consultant_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'school_implementations' AND policyname = 'admin_all_implementations'
  ) THEN
    CREATE POLICY "admin_all_implementations" ON school_implementations
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE id = auth.uid()
          AND user_type = 'admin_geral'
        )
        OR is_super_admin(auth.email())
      );
  END IF;
END $$;
