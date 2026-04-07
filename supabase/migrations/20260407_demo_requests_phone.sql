-- Add phone column to demo_requests for landing page form
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS phone TEXT;
