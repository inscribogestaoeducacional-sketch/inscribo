/*
  # Fix RLS Policies for Initial Setup

  1. Security Changes
    - Allow authenticated users to create institutions during setup
    - Allow users to be created during signup process
    - Fix circular dependency in RLS policies

  2. Changes Made
    - Update institutions RLS policy to allow creation
    - Update users RLS policy to allow signup
    - Ensure proper access control after setup
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can access their institution data" ON institutions;
DROP POLICY IF EXISTS "Users can access their own data" ON users;

-- Create new institutions policy that allows creation during setup
CREATE POLICY "Allow institution management"
  ON institutions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create new users policy that allows signup and self-management
CREATE POLICY "Allow user management"
  ON users
  FOR ALL
  TO authenticated
  USING (
    -- Users can see their own data
    id = auth.uid() 
    OR 
    -- Or users from same institution (if they have institution_id)
    (institution_id IS NOT NULL AND institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    ))
  )
  WITH CHECK (
    -- Users can create/update their own data
    id = auth.uid()
    OR
    -- Or admins can manage users in their institution
    (institution_id IN (
      SELECT institution_id FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    ))
  );

-- Create policy for leads
CREATE POLICY "Users can access their institution leads"
  ON leads
  FOR ALL
  TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

-- Create policy for visits
CREATE POLICY "Users can access their institution visits"
  ON visits
  FOR ALL
  TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

-- Create policy for enrollments
CREATE POLICY "Users can access their institution enrollments"
  ON enrollments
  FOR ALL
  TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

-- Create policy for marketing campaigns
CREATE POLICY "Users can access their institution marketing"
  ON marketing_campaigns
  FOR ALL
  TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

-- Create policy for re-enrollments
CREATE POLICY "Users can access their institution re-enrollments"
  ON re_enrollments
  FOR ALL
  TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

-- Create policy for funnel metrics
CREATE POLICY "Users can access their institution funnel metrics"
  ON funnel_metrics
  FOR ALL
  TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

-- Create policy for actions
CREATE POLICY "Users can access their institution actions"
  ON actions
  FOR ALL
  TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

-- Create policy for activity logs
CREATE POLICY "Users can access their institution activity logs"
  ON activity_logs
  FOR ALL
  TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );