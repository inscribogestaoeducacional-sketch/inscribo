/*
  # Add CPF column to leads table

  1. Changes
    - Add `cpf` column to `leads` table as nullable text field
    - This will store the CPF (Cadastro de Pessoas Físicas) for leads

  2. Security
    - Column is nullable to maintain compatibility with existing data
    - No additional RLS policies needed as it inherits from table policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'cpf'
  ) THEN
    ALTER TABLE leads ADD COLUMN cpf text;
  END IF;
END $$;