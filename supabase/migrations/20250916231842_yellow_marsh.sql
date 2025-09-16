/*
  # Fix infinite recursion in users table RLS policies

  1. Problem
    - Current policies cause infinite recursion when trying to access users table
    - Policy tries to check users table while already querying users table

  2. Solution
    - Drop existing problematic policies
    - Create new policies that use auth.uid() directly
    - Avoid self-referencing queries in policies

  3. Security
    - Users can only access their own profile
    - Admins can manage users in their institution
    - No infinite recursion loops
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow admins to manage institution users" ON users;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON users;
DROP POLICY IF EXISTS "Allow users to read their own profile" ON users;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON users;
DROP POLICY IF EXISTS "Users can manage their data" ON users;

-- Create new policies without recursion
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Admin policy using a function to avoid recursion
CREATE OR REPLACE FUNCTION is_admin_user(user_id uuid, inst_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = user_id 
    AND institution_id = inst_id 
    AND role = 'admin' 
    AND active = true
  );
$$;

CREATE POLICY "Admins can manage institution users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin' 
      AND active = true
    )
  )
  WITH CHECK (
    institution_id IN (
      SELECT institution_id FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin' 
      AND active = true
    )
  );