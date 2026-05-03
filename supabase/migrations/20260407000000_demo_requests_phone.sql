-- Add phone column to demo_requests for landing page form
CREATE TABLE IF NOT EXISTS demo_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  school_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS phone TEXT;
