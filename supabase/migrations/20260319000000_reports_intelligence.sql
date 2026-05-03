-- =============================================================
-- Módulo de Relatórios & Inteligência — Inscribo
-- Criado em: 2026-03-19
-- =============================================================

-- Ciclos de campanha anuais
CREATE TABLE IF NOT EXISTS campaign_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_new_students INTEGER NOT NULL DEFAULT 0,
  target_reenrollment_rate NUMERIC(5,2) NOT NULL DEFAULT 85.00,
  base_students INTEGER NOT NULL DEFAULT 0,
  projected_cpa NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, year)
);

-- Transferências de alunos
CREATE TABLE IF NOT EXISTS student_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  course_grade TEXT NOT NULL,
  transfer_date DATE NOT NULL,
  reason_category TEXT CHECK (reason_category IN ('financial','pedagogical','distance','competition','relocation','other')),
  reason_detail TEXT,
  survey_token UUID UNIQUE DEFAULT gen_random_uuid(),
  survey_completed_at TIMESTAMPTZ,
  survey_responses JSONB,
  ai_diagnosis TEXT,
  ai_risk_factors TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Importações do ERP
CREATE TABLE IF NOT EXISTS erp_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  import_date TIMESTAMPTZ DEFAULT NOW(),
  import_type TEXT NOT NULL CHECK (import_type IN ('enrollments','active_students','historical')),
  file_name TEXT,
  file_type TEXT CHECK (file_type IN ('csv','xlsx','pdf')),
  raw_data JSONB,
  processed_rows INTEGER DEFAULT 0,
  error_rows INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewing','confirmed','error')),
  ai_extraction_confidence NUMERIC(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alunos ativos (base para rematrícula)
CREATE TABLE IF NOT EXISTS active_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  course_grade TEXT NOT NULL,
  enrollment_year INTEGER NOT NULL,
  is_reenrolled BOOLEAN DEFAULT FALSE,
  reenrollment_date DATE,
  import_id UUID REFERENCES erp_imports(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE campaign_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_students ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_cycles' AND policyname='institution_isolation') THEN
    CREATE POLICY "institution_isolation" ON campaign_cycles
      USING (institution_id = (SELECT institution_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_transfers' AND policyname='institution_isolation') THEN
    CREATE POLICY "institution_isolation" ON student_transfers
      USING (institution_id = (SELECT institution_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_transfers' AND policyname='public_survey_access') THEN
    CREATE POLICY "public_survey_access" ON student_transfers
      FOR SELECT USING (survey_token IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_transfers' AND policyname='public_survey_update') THEN
    CREATE POLICY "public_survey_update" ON student_transfers
      FOR UPDATE USING (survey_token IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='erp_imports' AND policyname='institution_isolation') THEN
    CREATE POLICY "institution_isolation" ON erp_imports
      USING (institution_id = (SELECT institution_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='active_students' AND policyname='institution_isolation') THEN
    CREATE POLICY "institution_isolation" ON active_students
      USING (institution_id = (SELECT institution_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;
