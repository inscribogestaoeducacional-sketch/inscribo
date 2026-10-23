-- Alerta "matrícula sem lead": alunos novos ativos no ano da campanha cujo telefone de responsável não está em nenhum lead.
-- Função aplicada no banco: campaign_enrollments_without_lead(p_inst, p_year) (ver pg_get_functiondef).
-- Também aplicadas: base_erp_sync_now(p_institution_id, p_mode) — inicia carga leve/completa pela tela de Integrações.
SELECT 1;
