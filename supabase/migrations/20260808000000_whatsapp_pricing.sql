-- =============================================================================
-- 20260808000000_whatsapp_pricing.sql
-- Tabela de preços por categoria/país do WhatsApp Business Platform (Meta) —
-- usada pra estimar o custo de uma transmissão antes de disparar
-- (total_recipients × preço da categoria do template). Modelo de cobrança da
-- Meta é "por mensagem" desde 01/07/2025 (antes era "por conversa"), com
-- 4 categorias: marketing (sempre cobrado), utility/authentication (só fora
-- da janela de atendimento de 24h — dentro dela é grátis) e service (sempre
-- grátis, réplica dentro da janela). Valores mudam por decisão da Meta e
-- variam por país, por isso ficam em tabela em vez de hardcoded no código.
-- =============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_pricing (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code   TEXT        NOT NULL,
  category       TEXT        NOT NULL CHECK (category IN ('marketing', 'utility', 'authentication', 'service')),
  price_usd      NUMERIC(10,4) NOT NULL,
  currency       TEXT        NOT NULL DEFAULT 'USD',
  effective_from DATE        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, category, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_pricing_lookup
  ON whatsapp_pricing(country_code, category, effective_from DESC);

ALTER TABLE whatsapp_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_pricing_admin_geral" ON whatsapp_pricing;
CREATE POLICY "whatsapp_pricing_admin_geral" ON whatsapp_pricing
  FOR ALL
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed — valores atuais pra Brasil (rate card da Meta, ver investigação):
-- marketing US$0,0625 · utility/authentication US$0,0068 · service grátis.
-- effective_from = hoje; se a Meta reajustar, inserir nova linha com
-- effective_from mais recente em vez de alterar esta (histórico de preços).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO whatsapp_pricing (country_code, category, price_usd, currency, effective_from) VALUES
  ('BR', 'marketing',      0.0625, 'USD', CURRENT_DATE),
  ('BR', 'utility',        0.0068, 'USD', CURRENT_DATE),
  ('BR', 'authentication', 0.0068, 'USD', CURRENT_DATE),
  ('BR', 'service',        0.0000, 'USD', CURRENT_DATE)
ON CONFLICT (country_code, category, effective_from) DO NOTHING;
