-- Limpeza (out/2026), já aplicada no banco:
-- 1) Duas escolas de teste "victor colegio" (0599679a-…, 818c880f-…), sem leads, usuários nem conversas, foram
--    apagadas com os registros de teste ligados a elas (2 contratos de teste, 1 onboarding, 6 avisos, 34 séries).
--    Cópia guardada na tabela public.backup_escolas_teste_20261023 (45 linhas, RLS ligado, sem política).
-- 2) Colunas sem uso em whatsapp_flows removidas (nenhum código, função ou view as usava; todas as escolas tinham o padrão).
ALTER TABLE public.whatsapp_flows DROP COLUMN IF EXISTS reactivation_enabled, DROP COLUMN IF EXISTS reactivation_template;
