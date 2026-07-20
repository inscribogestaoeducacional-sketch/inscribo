-- =============================================================================
-- 20260720000500_consultant_commissions.sql
-- Comissão de consultor, lançada manualmente (source='manual' por padrão;
-- 'automatica' fica reservado pra quando a base de contracts.consultant_id
-- estiver confiável — ver 20260720000400 e a correção em autentique/index.ts).
-- Schema e policies exatamente como definidos/revisados na investigação anterior.
-- =============================================================================

CREATE TABLE IF NOT EXISTS consultant_commissions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id   UUID          NOT NULL REFERENCES users(id),
  contract_id     UUID          REFERENCES contracts(id),
  lead_id         UUID          REFERENCES crm_leads(id),
  institution_id  UUID          REFERENCES institutions(id),
  type            TEXT          NOT NULL CHECK (type IN ('implantacao', 'mensalidade')),
  reference_month DATE,
  basis_amount    NUMERIC(10,2),
  percentage      NUMERIC(5,2),
  amount          NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  source          TEXT          NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'automatica')),
  status          TEXT          NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'paga', 'cancelada')),
  payment_date    DATE,
  notes           TEXT,
  created_by      UUID          REFERENCES users(id),
  created_at      TIMESTAMPTZ   DEFAULT now(),
  updated_at      TIMESTAMPTZ   DEFAULT now()
);

ALTER TABLE consultant_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_own_or_admin_commissions" ON consultant_commissions
  FOR SELECT USING (
    consultant_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral')
  );

CREATE POLICY "write_admin_only_commissions" ON consultant_commissions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral')
  );

CREATE POLICY "update_admin_only_commissions" ON consultant_commissions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral')
  );

CREATE POLICY "delete_admin_only_commissions" ON consultant_commissions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral')
  );
