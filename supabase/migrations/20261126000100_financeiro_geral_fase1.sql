-- =============================================================================
-- 20261126000100_financeiro_geral_fase1.sql
-- Financeiro geral da Áion (Fase 1): várias empresas no mesmo caixa.
-- Regime de CAIXA: o lançamento conta na data em que o dinheiro entrou/saiu.
-- Aditivo: não remove nem altera nenhuma coluna existente de financial_entries.
--   - fin_companies: cadastro das empresas
--   - financial_entries.company_id: de qual empresa é (existentes = Áion Edu)
--   - financial_entries.due_date: vencimento (opcional)
--   - financial_entries.status: 'pago' (conta no caixa) ou 'pendente' (a pagar/receber)
-- =============================================================================

CREATE TABLE IF NOT EXISTS fin_companies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  color       TEXT        NOT NULL DEFAULT '#0891b2',
  active      BOOLEAN     NOT NULL DEFAULT true,
  sort_order  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fin_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_geral_fin_companies" ON fin_companies
  FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral'));

-- IDs fixos para a Áion Edu (padrão dos lançamentos antigos) e Áion Business.
INSERT INTO fin_companies (id, name, color, sort_order) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'Áion Edu',      '#0891b2', 1),
  ('00000000-0000-4000-8000-0000000000e2', 'Áion Business', '#7c3aed', 2)
ON CONFLICT (id) DO NOTHING;

-- Os lançamentos que já existem passam a ser da Áion Edu (default preenche as linhas antigas).
ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS company_id UUID NOT NULL
    DEFAULT '00000000-0000-4000-8000-0000000000e1'
    REFERENCES fin_companies(id),
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pago'
    CHECK (status IN ('pago', 'pendente'));

CREATE INDEX IF NOT EXISTS idx_financial_entries_company_date
  ON financial_entries (company_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_entries_status
  ON financial_entries (status) WHERE status = 'pendente';
