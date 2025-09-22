/*
  # Add address column to leads table

  1. Changes
    - Add `address` column to `leads` table as text field
    - Column is nullable to allow existing records to remain valid

  2. Security
    - No RLS changes needed as existing policies will cover the new column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'address'
  ) THEN
    ALTER TABLE leads ADD COLUMN address text;
  END IF;
END $$;