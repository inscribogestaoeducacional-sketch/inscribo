/*
  # Add budget_range column to leads table

  1. Changes
    - Add `budget_range` column to `leads` table as nullable text field
    - This will store the budget range information for leads

  2. Security
    - No changes to RLS policies needed as this is just adding a column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'budget_range'
  ) THEN
    ALTER TABLE leads ADD COLUMN budget_range text;
  END IF;
END $$;