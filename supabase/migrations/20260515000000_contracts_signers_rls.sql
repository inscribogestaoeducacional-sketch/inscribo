-- Add signers JSONB column to contracts for per-signer status tracking
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signers JSONB DEFAULT '[]';

-- RLS: allow authenticated users to read contracts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contracts' AND policyname = 'contracts_select'
  ) THEN
    CREATE POLICY "contracts_select" ON contracts FOR SELECT TO authenticated USING (true);
  END IF;
END
$$;
