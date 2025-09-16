/*
  # Fix Activity Logs RLS Policy

  1. Security
    - Disable RLS temporarily for activity_logs table during setup
    - Add permissive policy for authenticated users
*/

-- Disable RLS on activity_logs table temporarily
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;

-- Create a permissive policy for activity logs
CREATE POLICY "Allow activity logs for authenticated users"
  ON activity_logs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Re-enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;