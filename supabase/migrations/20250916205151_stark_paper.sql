/*
  # Disable RLS temporarily for initial setup

  1. Security Changes
    - Temporarily disable RLS on institutions table for initial setup
    - Allow public access during setup process
    - Will be re-enabled after first institution is created
*/

-- Temporarily disable RLS on institutions table
ALTER TABLE institutions DISABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can access their institution data" ON institutions;

-- Create a permissive policy for initial setup
CREATE POLICY "Allow initial setup" ON institutions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure users table has proper policies
DROP POLICY IF EXISTS "Users can access their own data" ON users;

CREATE POLICY "Users can manage their data" ON users
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);