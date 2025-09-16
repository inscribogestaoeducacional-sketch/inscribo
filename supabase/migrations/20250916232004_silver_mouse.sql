/*
  # Fix Users RLS Infinite Recursion - Complete Solution

  1. Problem
    - Infinite recursion in users table RLS policies
    - Policies were querying users table within users table policies

  2. Solution
    - Drop ALL existing problematic policies
    - Create simple, non-recursive policies
    - Use auth.uid() directly without subqueries to users table

  3. Security
    - Users can only access their own data
    - Admins can manage users through application logic, not RLS
*/

-- Drop all existing policies that might cause recursion
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Admins can manage institution users" ON users;
DROP POLICY IF EXISTS "Allow initial setup" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to read institutions" ON users;

-- Create simple, safe policies without recursion
CREATE POLICY "users_select_own" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No DELETE policy - users cannot delete themselves

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;