-- Add city and state columns to institutions table
ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS city  TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT;
