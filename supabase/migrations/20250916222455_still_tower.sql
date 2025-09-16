-- Fix RLS policies to allow initial user creation and profile access

-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Users can access their own data and institution users" ON users;
DROP POLICY IF EXISTS "Users can access their institution data" ON institutions;

-- Create more permissive policies for initial setup
CREATE POLICY "Allow users to read their own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Allow users to insert their own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Allow users to update their own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Allow admins to manage institution users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Institution policies
CREATE POLICY "Allow authenticated users to read institutions"
  ON institutions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to create institutions"
  ON institutions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow admins to update their institution"
  ON institutions
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT institution_id FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;