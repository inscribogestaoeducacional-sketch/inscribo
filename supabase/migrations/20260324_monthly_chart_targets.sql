-- Saídas naturais por série (formandos)
CREATE TABLE IF NOT EXISTS student_exits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL,
  year INTEGER NOT NULL,
  grade TEXT NOT NULL,
  exit_type TEXT DEFAULT 'graduation' CHECK (exit_type IN ('graduation', 'dropout', 'transfer')),
  student_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Séries com saída natural configuradas por escola
CREATE TABLE IF NOT EXISTS grade_exit_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL,
  grade TEXT NOT NULL,
  exits_every_year BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(institution_id, grade)
);

-- Metas mensais editáveis por ciclo
ALTER TABLE funnel_metrics
  ADD COLUMN IF NOT EXISTS new_students_target INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returning_students_target INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_students_actual INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returning_students_actual INTEGER DEFAULT 0;
