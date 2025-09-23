/*
  # Sistema Super Admin para Inscribo

  1. New Tables
    - `super_admins`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `full_name` (text)
      - `active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `saas_metrics`
      - `id` (uuid, primary key)
      - `metric_date` (date)
      - `total_institutions` (integer)
      - `active_institutions` (integer)
      - `total_users` (integer)
      - `total_leads` (integer)
      - `total_enrollments` (integer)
      - `mrr` (numeric)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for super admin access
    - Create function to check super admin status

  3. Initial Data
    - Insert super admin user: admin@inscribo.com
*/

-- Create super_admins table
CREATE TABLE IF NOT EXISTS super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create saas_metrics table for dashboard data
CREATE TABLE IF NOT EXISTS saas_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date date NOT NULL DEFAULT CURRENT_DATE,
  total_institutions integer DEFAULT 0,
  active_institutions integer DEFAULT 0,
  total_users integer DEFAULT 0,
  total_leads integer DEFAULT 0,
  total_enrollments integer DEFAULT 0,
  mrr numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas_metrics ENABLE ROW LEVEL SECURITY;

-- Create function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admins 
    WHERE email = user_email AND active = true
  );
END;
$$;

-- Create function to get current user email
CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (auth.jwt() ->> 'email')::text;
END;
$$;

-- Policies for super_admins table
CREATE POLICY "Super admins can read their own data"
  ON super_admins
  FOR SELECT
  TO authenticated
  USING (email = get_current_user_email());

CREATE POLICY "Super admins can update their own data"
  ON super_admins
  FOR UPDATE
  TO authenticated
  USING (email = get_current_user_email())
  WITH CHECK (email = get_current_user_email());

-- Policies for saas_metrics table
CREATE POLICY "Super admins can read saas metrics"
  ON saas_metrics
  FOR SELECT
  TO authenticated
  USING (is_super_admin(get_current_user_email()));

CREATE POLICY "Super admins can insert saas metrics"
  ON saas_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin(get_current_user_email()));

CREATE POLICY "Super admins can update saas metrics"
  ON saas_metrics
  FOR UPDATE
  TO authenticated
  USING (is_super_admin(get_current_user_email()))
  WITH CHECK (is_super_admin(get_current_user_email()));

-- Create policies for super admin to access all institution data
CREATE POLICY "Super admins can read all institutions"
  ON institutions
  FOR SELECT
  TO authenticated
  USING (is_super_admin(get_current_user_email()));

CREATE POLICY "Super admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (is_super_admin(get_current_user_email()));

CREATE POLICY "Super admins can update all users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (is_super_admin(get_current_user_email()))
  WITH CHECK (is_super_admin(get_current_user_email()));

CREATE POLICY "Super admins can read all leads"
  ON leads
  FOR SELECT
  TO authenticated
  USING (is_super_admin(get_current_user_email()));

CREATE POLICY "Super admins can read all enrollments"
  ON enrollments
  FOR SELECT
  TO authenticated
  USING (is_super_admin(get_current_user_email()));

-- Insert super admin user
INSERT INTO super_admins (email, full_name, active) 
VALUES ('admin@inscribo.com', 'Super Administrador', true)
ON CONFLICT (email) DO NOTHING;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_super_admins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_super_admins_updated_at
  BEFORE UPDATE ON super_admins
  FOR EACH ROW
  EXECUTE FUNCTION update_super_admins_updated_at();

-- Insert sample metrics data
INSERT INTO saas_metrics (
  metric_date,
  total_institutions,
  active_institutions,
  total_users,
  total_leads,
  total_enrollments,
  mrr
) VALUES 
  (CURRENT_DATE - INTERVAL '5 months', 12, 10, 89, 2100, 450, 8500.00),
  (CURRENT_DATE - INTERVAL '4 months', 19, 16, 142, 3200, 680, 15200.00),
  (CURRENT_DATE - INTERVAL '3 months', 25, 22, 198, 4100, 890, 22100.00),
  (CURRENT_DATE - INTERVAL '2 months', 32, 28, 256, 5300, 1150, 28900.00),
  (CURRENT_DATE - INTERVAL '1 month', 38, 34, 298, 6800, 1420, 35600.00),
  (CURRENT_DATE, 47, 42, 342, 8200, 1680, 45700.00)
ON CONFLICT DO NOTHING;