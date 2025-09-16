-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create updated_at trigger function
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
  phone text,
  email text,
  address text,
  website text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS only if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'institutions' AND n.nspname = 'public' AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policy only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'institutions' AND policyname = 'Users can access their institution data'
  ) THEN
    CREATE POLICY "Users can access their institution data"
      ON institutions
      FOR ALL
      TO authenticated
      USING (id IN (
        SELECT institution_id FROM users WHERE id = auth.uid()
      ));
  END IF;
END $$;

-- Create trigger only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_institutions_updated_at'
  ) THEN
    CREATE TRIGGER update_institutions_updated_at
      BEFORE UPDATE ON institutions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'user')),
  institution_id uuid REFERENCES institutions(id),
  phone text,
  avatar_url text,
  active boolean DEFAULT true,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS for users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'users' AND n.nspname = 'public' AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create users policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' AND policyname = 'Users can manage their data'
  ) THEN
    CREATE POLICY "Users can manage their data"
      ON users
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Create users trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at'
  ) THEN
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

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

-- Enable RLS for leads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'leads' AND n.nspname = 'public' AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create leads policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'leads' AND policyname = 'Users can access their institution leads'
  ) THEN
    CREATE POLICY "Users can access their institution leads"
      ON leads
      FOR ALL
      TO authenticated
      USING (institution_id IN (
        SELECT institution_id FROM users WHERE id = auth.uid()
      ));
  END IF;
END $$;

-- Create leads trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_leads_updated_at'
  ) THEN
    CREATE TRIGGER update_leads_updated_at
      BEFORE UPDATE ON leads
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

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

-- Enable RLS for visits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'visits' AND n.nspname = 'public' AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create visits policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'visits' AND policyname = 'Users can access their institution visits'
  ) THEN
    CREATE POLICY "Users can access their institution visits"
      ON visits
      FOR ALL
      TO authenticated
      USING (institution_id IN (
        SELECT institution_id FROM users WHERE id = auth.uid()
      ));
  END IF;
END $$;

-- Create visits trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_visits_updated_at'
  ) THEN
    CREATE TRIGGER update_visits_updated_at
      BEFORE UPDATE ON visits
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id),
  student_name text NOT NULL,
  course_grade text NOT NULL,
  enrollment_value numeric(10,2),
  enrollment_date timestamptz DEFAULT now(),
  institution_id uuid REFERENCES institutions(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS for enrollments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'enrollments' AND n.nspname = 'public' AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create enrollments policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'enrollments' AND policyname = 'Users can access their institution enrollments'
  ) THEN
    CREATE POLICY "Users can access their institution enrollments"
      ON enrollments
      FOR ALL
      TO authenticated
      USING (institution_id IN (
        SELECT institution_id FROM users WHERE id = auth.uid()
      ));
  END IF;
END $$;

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

-- Enable RLS for marketing_campaigns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'marketing_campaigns' AND n.nspname = 'public' AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create marketing_campaigns policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'marketing_campaigns' AND policyname = 'Users can access their institution marketing'
  ) THEN
    CREATE POLICY "Users can access their institution marketing"
      ON marketing_campaigns
      FOR ALL
      TO authenticated
      USING (institution_id IN (
        SELECT institution_id FROM users WHERE id = auth.uid()
      ));
  END IF;
END $$;

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

-- Enable RLS for re_enrollments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 're_enrollments' AND n.nspname = 'public' AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE re_enrollments ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create re_enrollments policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 're_enrollments' AND policyname = 'Users can access their institution re-enrollments'
  ) THEN
    CREATE POLICY "Users can access their institution re-enrollments"
      ON re_enrollments
      FOR ALL
      TO authenticated
      USING (institution_id IN (
        SELECT institution_id FROM users WHERE id = auth.uid()
      ));
  END IF;
END $$;

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

-- Enable RLS for funnel_metrics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'funnel_metrics' AND n.nspname = 'public' AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE funnel_metrics ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create funnel_metrics policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'funnel_metrics' AND policyname = 'Users can access their institution funnel metrics'
  ) THEN
    CREATE POLICY "Users can access their institution funnel metrics"
      ON funnel_metrics
      FOR ALL
      TO authenticated
      USING (institution_id IN (
        SELECT institution_id FROM users WHERE id = auth.uid()
      ));
  END IF;
END $$;

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

-- Enable RLS for actions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'actions' AND n.nspname = 'public' AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create actions policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'actions' AND policyname = 'Users can access their institution actions'
  ) THEN
    CREATE POLICY "Users can access their institution actions"
      ON actions
      FOR ALL
      TO authenticated
      USING (institution_id IN (
        SELECT institution_id FROM users WHERE id = auth.uid()
      ));
  END IF;
END $$;

-- Create actions trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_actions_updated_at'
  ) THEN
    CREATE TRIGGER update_actions_updated_at
      BEFORE UPDATE ON actions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

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

-- Enable RLS for activity_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'activity_logs' AND n.nspname = 'public' AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create activity_logs policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'activity_logs' AND policyname = 'Allow activity logs for authenticated users'
  ) THEN
    CREATE POLICY "Allow activity logs for authenticated users"
      ON activity_logs
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'activity_logs' AND policyname = 'Users can access their institution activity logs'
  ) THEN
    CREATE POLICY "Users can access their institution activity logs"
      ON activity_logs
      FOR ALL
      TO authenticated
      USING (institution_id IN (
        SELECT institution_id FROM users WHERE id = auth.uid()
      ));
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_institution_id ON users(institution_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_leads_institution_id ON leads(institution_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_visits_institution_id ON visits(institution_id);
CREATE INDEX IF NOT EXISTS idx_visits_scheduled_date ON visits(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_enrollments_institution_id ON enrollments(institution_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_institution_id ON activity_logs(institution_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);