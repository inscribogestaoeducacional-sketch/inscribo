/*
  # Configuração inicial do sistema Inscribo

  1. Tabelas principais
    - `institutions` - Instituições de ensino
    - `users` - Usuários do sistema (admin/consultant)
    - `leads` - Leads de potenciais alunos
    - `visits` - Visitas agendadas
    - `enrollments` - Matrículas efetivadas
    - `marketing_campaigns` - Campanhas de marketing
    - `funnel_metrics` - Métricas do funil de vendas
    - `re_enrollments` - Dados de rematrícula
    - `actions` - Ações automáticas do sistema

  2. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas baseadas em institution_id
    - Autenticação via Supabase Auth

  3. Funcionalidades
    - Triggers para updated_at
    - Constraints de validação
    - Índices para performance
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Institutions table
CREATE TABLE IF NOT EXISTS institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  primary_color text DEFAULT '#3B82F6',
  secondary_color text DEFAULT '#10B981',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow initial setup" ON institutions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_institutions_updated_at
  BEFORE UPDATE ON institutions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'consultant')),
  phone text,
  institution_id uuid REFERENCES institutions(id),
  active boolean DEFAULT true,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their data" ON users
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  responsible_name text NOT NULL,
  phone text,
  email text,
  grade_interest text NOT NULL,
  source text NOT NULL,
  status text DEFAULT 'new' CHECK (status IN ('new', 'contact', 'scheduled', 'visit', 'proposal', 'enrolled', 'lost')),
  assigned_to uuid REFERENCES users(id),
  notes text DEFAULT '',
  institution_id uuid REFERENCES institutions(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their institution leads" ON leads
  FOR ALL TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Visits table
CREATE TABLE IF NOT EXISTS visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  scheduled_date timestamptz NOT NULL,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  assigned_to uuid REFERENCES users(id),
  notes text DEFAULT '',
  institution_id uuid REFERENCES institutions(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their institution visits" ON visits
  FOR ALL TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

CREATE TRIGGER update_visits_updated_at
  BEFORE UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id),
  student_name text NOT NULL,
  course_grade text NOT NULL,
  enrollment_value numeric(10,2),
  discount_percentage numeric(5,2) DEFAULT 0,
  final_value numeric(10,2),
  payment_method text,
  enrollment_date timestamptz DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  institution_id uuid REFERENCES institutions(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their institution enrollments" ON enrollments
  FOR ALL TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

-- Marketing campaigns table
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year text NOT NULL,
  investment numeric(10,2) DEFAULT 0,
  leads_generated integer DEFAULT 0,
  cpa_target numeric(10,2),
  institution_id uuid REFERENCES institutions(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(month_year, institution_id)
);

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their institution marketing" ON marketing_campaigns
  FOR ALL TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

-- Funnel metrics table
CREATE TABLE IF NOT EXISTS funnel_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  registrations integer DEFAULT 0,
  registrations_target integer DEFAULT 0,
  schedules integer DEFAULT 0,
  schedules_target integer DEFAULT 0,
  visits integer DEFAULT 0,
  visits_target integer DEFAULT 0,
  enrollments integer DEFAULT 0,
  enrollments_target integer DEFAULT 0,
  institution_id uuid REFERENCES institutions(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(period, institution_id)
);

ALTER TABLE funnel_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their institution funnel metrics" ON funnel_metrics
  FOR ALL TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

-- Re-enrollments table
CREATE TABLE IF NOT EXISTS re_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  total_base integer DEFAULT 0,
  re_enrolled integer DEFAULT 0,
  defaulters integer DEFAULT 0,
  transferred integer DEFAULT 0,
  target_percentage numeric(5,2) DEFAULT 85.00,
  institution_id uuid REFERENCES institutions(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(period, institution_id)
);

ALTER TABLE re_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their institution re-enrollments" ON re_enrollments
  FOR ALL TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

-- Actions table
CREATE TABLE IF NOT EXISTS actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('marketing', 'sales', 'retention', 'operations')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid REFERENCES users(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date timestamptz,
  institution_id uuid REFERENCES institutions(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their institution actions" ON actions
  FOR ALL TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

CREATE TRIGGER update_actions_updated_at
  BEFORE UPDATE ON actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb DEFAULT '{}',
  institution_id uuid REFERENCES institutions(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow activity logs for authenticated users" ON activity_logs
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can access their institution activity logs" ON activity_logs
  FOR ALL TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leads_institution_id ON leads(institution_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_visits_institution_id ON visits(institution_id);
CREATE INDEX IF NOT EXISTS idx_visits_scheduled_date ON visits(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_enrollments_institution_id ON enrollments(institution_id);
CREATE INDEX IF NOT EXISTS idx_users_institution_id ON users(institution_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_institution_id ON activity_logs(institution_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);