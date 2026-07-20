-- =============================================================================
-- 20260720000600_financial_nature.sql
-- Classificação de natureza financeira (investimento/custo_fixo/custo_variavel/
-- receita_recorrente/receita_avulsa) em platform_costs e financial_entries.
-- Aditivo — não altera nem remove a coluna category existente. ADD COLUMN com
-- DEFAULT já preenche as linhas existentes sem quebrar a constraint NOT NULL;
-- o UPDATE seguinte só refina o valor por categoria/tipo, mais preciso que o
-- default único.
-- =============================================================================

ALTER TABLE platform_costs
  ADD COLUMN IF NOT EXISTS nature TEXT NOT NULL DEFAULT 'custo_fixo'
  CHECK (nature IN ('investimento','custo_fixo','custo_variavel','receita_recorrente','receita_avulsa'));

UPDATE platform_costs SET nature = CASE category
  WHEN 'infrastructure' THEN 'custo_fixo'
  WHEN 'tools'          THEN 'custo_fixo'
  WHEN 'services'       THEN 'custo_variavel'
  ELSE                       'custo_variavel'
END;

ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS nature TEXT NOT NULL DEFAULT 'receita_avulsa'
  CHECK (nature IN ('investimento','custo_fixo','custo_variavel','receita_recorrente','receita_avulsa'));

UPDATE financial_entries SET nature = CASE
  WHEN type = 'saida' AND category IN ('folha','infraestrutura') THEN 'custo_fixo'
  WHEN type = 'saida'                                             THEN 'custo_variavel'
  ELSE                                                                  'receita_avulsa'
END;
