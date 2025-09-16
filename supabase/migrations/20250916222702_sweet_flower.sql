-- Disable email confirmation for development
-- This allows users to sign up and login immediately without email verification

-- Update auth settings to disable email confirmation
-- Note: This should be done in Supabase Dashboard under Authentication > Settings
-- Set "Enable email confirmations" to OFF

-- Alternative: Create a function to auto-confirm users
CREATE OR REPLACE FUNCTION auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-confirm new users
  NEW.email_confirmed_at = NOW();
  NEW.confirmed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-confirm users on signup
DROP TRIGGER IF EXISTS auto_confirm_user_trigger ON auth.users;
CREATE TRIGGER auto_confirm_user_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_user();

-- Also create a policy to allow initial user creation
CREATE POLICY IF NOT EXISTS "Allow initial user creation"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow users to read their own data immediately
CREATE POLICY IF NOT EXISTS "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);