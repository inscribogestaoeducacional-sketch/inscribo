-- Add city and state columns to institutions table
ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS city  TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT;

-- Seed known institutions with city/state data
UPDATE institutions
SET city = 'Patos', state = 'PB'
WHERE id = '400349ba-872d-4b38-afca-d0eba2baa00a'
  AND (city IS NULL OR state IS NULL);
