-- =============================================================================
-- 20260720000300_financial_entries.sql
-- Lançamento manual financeiro (receita/despesa avulsa), fora do fluxo
-- automático de mensalidade (payments/Asaas) e de custo operacional fixo
-- (platform_costs). Schema proposto e revisado na investigação read-only
-- anterior — criado aqui sem alterações em relação ao que foi aprovado.
-- =============================================================================

CREATE TABLE IF NOT EXISTS financial_entries (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  type           TEXT          NOT NULL CHECK (type IN ('entrada', 'saida')),
  amount         NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  description    TEXT          NOT NULL,
  category       TEXT          NOT NULL DEFAULT 'other',
  entry_date     DATE          NOT NULL DEFAULT CURRENT_DATE,
  source         TEXT          NOT NULL DEFAULT 'manual'
                                CHECK (source IN ('manual', 'asaas', 'platform_costs')),
  institution_id UUID          REFERENCES institutions(id),
  created_by     UUID          REFERENCES users(id),
  notes          TEXT,
  created_at     TIMESTAMPTZ   DEFAULT now(),
  updated_at     TIMESTAMPTZ   DEFAULT now()
);

ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_geral_financial_entries" ON financial_entries
  FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral'));
