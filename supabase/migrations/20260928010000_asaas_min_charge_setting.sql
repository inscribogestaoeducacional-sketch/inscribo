-- =============================================================================
-- 20260928010000_asaas_min_charge_setting.sql
-- Valor mínimo de cobrança do Asaas: R$ 5,00 — confirmado pelo usuário no
-- painel do Asaas em 2026-09-28 (cobrança de R$ 1,00 recusada pela validação).
-- Lido por:
--   - broadcast_price_campaign / preview (regra "abaixo do mínimo, cobra o
--     mínimo" das campanhas de Transmissões);
--   - asaas-create-charge, nos dois modos (recusa com mensagem clara antes de
--     gravar qualquer coisa, em vez de deixar o Asaas recusar).
-- Se o Asaas mudar o mínimo, basta atualizar este valor.
-- =============================================================================
INSERT INTO platform_settings(key, value)
VALUES ('asaas_min_charge_brl', '5.00')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
