-- =============================================================================
-- 20260720000700_financial_entries_folha_tipo.sql
-- Distingue, dentro da categoria 'folha' de financial_entries, se é folha de
-- funcionário ou retirada de sócio. Coluna nova (não parse de notes) — mais
-- limpo pra somar/filtrar depois.
-- =============================================================================

ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS folha_tipo TEXT
  CHECK (folha_tipo IN ('funcionario', 'socio_victor', 'socio_fabio') OR folha_tipo IS NULL);
