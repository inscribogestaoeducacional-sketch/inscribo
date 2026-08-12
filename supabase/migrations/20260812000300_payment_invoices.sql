-- =============================================================================
-- 20260812000300_payment_invoices.sql
-- Controle de Nota Fiscal — Fase 1 (manual, sem integração com emissor
-- fiscal). Cada `payments` confirmado (ou, se a escola emite nota antes do
-- pagamento, cada cobrança recém-criada) ganha 1 linha em payment_invoices
-- pra rastrear se a nota já foi emitida/enviada pro financeiro da escola.
-- A emissão em si continua manual — número, série e PDF/link são inseridos
-- por um admin_geral no painel (AdminFinancial.tsx); nada aqui fala com um
-- emissor de NF-e de verdade.
-- =============================================================================

ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS nf_issue_timing TEXT NOT NULL DEFAULT 'after_payment'
    CHECK (nf_issue_timing IN ('before_payment', 'after_payment'));

CREATE TABLE IF NOT EXISTS payment_invoices (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id       UUID        NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  institution_id   UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('not_required', 'pending', 'issued', 'sent', 'error', 'cancelled')),
  issue_timing     TEXT        NOT NULL CHECK (issue_timing IN ('before_payment', 'after_payment')),
  invoice_number   TEXT,
  invoice_series   TEXT,
  invoice_url_pdf  TEXT,
  invoice_url_xml  TEXT,
  issued_at        TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  last_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payment_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_invoices_status ON payment_invoices(status);
CREATE INDEX IF NOT EXISTS idx_payment_invoices_institution ON payment_invoices(institution_id);

-- RLS — mesmo padrão admin_geral já usado em financial_entries
-- (20260720000300) e platform_costs (20260720000200): só quem tem
-- user_type = 'admin_geral' em `users` acessa. Nota Fiscal é Financeiro,
-- mesma regra de negócio já aplicada ao resto do módulo (consultor não vê).
ALTER TABLE payment_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_geral_payment_invoices" ON payment_invoices;
CREATE POLICY "admin_geral_payment_invoices" ON payment_invoices
  FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral'));
