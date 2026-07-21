-- =============================================================================
-- 20260720000800_platform_costs_effective_from.sql
-- Dá a platform_costs a dimensão temporal que faltava (gap já sinalizado em
-- investigações anteriores): quando o custo passou a existir de verdade, não
-- só quando o registro foi cadastrado no sistema (created_at). Usado pelo
-- cálculo de saldo em caixa acumulado e pelo gráfico de tendência anual em
-- AdminFinancial.tsx — cada um só conta o custo a partir do mês em que ele
-- de fato começou.
-- =============================================================================

ALTER TABLE platform_costs ADD COLUMN IF NOT EXISTS effective_from DATE;
UPDATE platform_costs SET effective_from = created_at::date WHERE effective_from IS NULL;
