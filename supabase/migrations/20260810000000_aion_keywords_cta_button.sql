-- =============================================================================
-- 20260810000000_aion_keywords_cta_button.sql
-- Botão CTA (call-to-action com URL) opcional na resposta automática de
-- aion_keywords. Quando cta_button_text e cta_button_url estão preenchidos,
-- o webhook (api/whatsapp/webhook.ts) envia auto_response como mensagem
-- interactive/cta_url em vez de texto puro. Ambas nullable — keyword sem
-- botão continua se comportando exatamente como hoje (texto puro).
-- =============================================================================

ALTER TABLE aion_keywords
  ADD COLUMN IF NOT EXISTS cta_button_text TEXT,
  ADD COLUMN IF NOT EXISTS cta_button_url  TEXT;
