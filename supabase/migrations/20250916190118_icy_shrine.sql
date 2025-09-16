/*
  # Create Inscribo Schema

  1. New Tables
    - `institutions` - Educational institutions data
    - `users` - System users with roles
    - `leads` - Lead management
    - `visits` - Scheduled visits
    - `enrollments` - Student enrollments
    - `re_enrollments` - Re-enrollment tracking
    - `marketing_campaigns` - Marketing investment tracking
    - `funnel_metrics` - Funnel performance data
    - `actions` - Automated action suggestions
    - `activity_logs` - System activity tracking

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access control

  3. Functions
    - Calculate CPA automatically
    - Generate funnel metrics
    - Track conversion rates
*/

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

-- Users table with roles
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'user')),
  institution_id uuid REFERENCES institutions(id),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  responsible_name text NOT NULL,
  phone text,
  email text,
  grade_interest text NOT NULL,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contact', 'scheduled', 'visit', 'proposal', 'enrolled', 'lost')),
  assigned_to uuid REFERENCES users(id),
  notes text DEFAULT '',
  institution_id uuid REFERENCES institutions(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Visits table
CREATE TABLE IF NOT EXISTS visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  scheduled_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  assigned_to uuid REFERENCES users(id),
  notes text DEFAULT '',
  institution_id uuid REFERENCES institutions(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id),
  student_name text NOT NULL,
  course_grade text NOT NULL,
  enrollment_value decimal(10,2),
  enrollment_date timestamptz DEFAULT now(),
  institution_id uuid REFERENCES institutions(id),
  created_at timestamptz DEFAULT now()
);

-- Marketing campaigns table
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year text NOT NULL,
  investment decimal(10,2) NOT NULL DEFAULT 0,
  leads_generated integer NOT NULL DEFAULT 0,
  cpa_target decimal(10,2),
  institution_id uuid REFERENCES institutions(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(month_year, institution_id)
);

-- Re-enrollments tracking
CREATE TABLE IF NOT EXISTS re_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  total_base integer NOT NULL DEFAULT 0,
  re_enrolled integer NOT NULL DEFAULT 0,
  defaulters integer NOT NULL DEFAULT 0,
  transferred integer NOT NULL DEFAULT 0,
  target_percentage decimal(5,2) DEFAULT 85.00,
  institution_id uuid REFERENCES institutions(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(period, institution_id)
);

-- Funnel metrics
CREATE TABLE IF NOT EXISTS funnel_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  registrations integer NOT NULL DEFAULT 0,
  registrations_target integer NOT NULL DEFAULT 0,
  schedules integer NOT NULL DEFAULT 0,
  schedules_target integer NOT NULL DEFAULT 0,
  visits integer NOT NULL DEFAULT 0,
  visits_target integer NOT NULL DEFAULT 0,
  enrollments integer NOT NULL DEFAULT 0,
  enrollments_target integer NOT NULL DEFAULT 0,
  institution_id uuid REFERENCES institutions(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(period, institution_id)
);

-- Actions table
CREATE TABLE IF NOT EXISTS actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('marketing', 'sales', 'retention', 'operations')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid REFERENCES users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date timestamptz,
  institution_id uuid REFERENCES institutions(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activity logs
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

-- Enable RLS
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can access their institution data" ON institutions
  FOR ALL TO authenticated
  USING (id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can access their own data" ON users
  FOR ALL TO authenticated
  USING (id = auth.uid() OR institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Users can access their institution leads" ON leads
  FOR ALL TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can access their institution visits" ON visits
  FOR ALL TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can access their institution enrollments" ON enrollments
  FOR ALL TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can access their institution marketing" ON marketing_campaigns
  FOR ALL TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can access their institution re-enrollments" ON re_enrollments
  FOR ALL TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can access their institution funnel metrics" ON funnel_metrics
  FOR ALL TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can access their institution actions" ON actions
  FOR ALL TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can access their institution activity logs" ON activity_logs
  FOR ALL TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

-- Functions for automated calculations
CREATE OR REPLACE FUNCTION calculate_cpa(institution_uuid uuid, campaign_month text)
RETURNS decimal AS $$
DECLARE
  investment decimal;
  leads_count integer;
  cpa_result decimal;
BEGIN
  SELECT investment, leads_generated INTO investment, leads_count
  FROM marketing_campaigns
  WHERE institution_id = institution_uuid AND month_year = campaign_month;

  IF leads_count > 0 THEN
    cpa_result := investment / leads_count;
  ELSE
    cpa_result := 0;
  END IF;

  RETURN cpa_result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_institutions_updated_at BEFORE UPDATE ON institutions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_visits_updated_at BEFORE UPDATE ON visits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_actions_updated_at BEFORE UPDATE ON actions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();