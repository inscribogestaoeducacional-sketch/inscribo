-- =============================================================================
-- 20260701000021_survey_ai_analysis.sql
-- Repaginação do painel de pesquisa de satisfação (GestorSurveys.tsx):
-- a nova aba "Relatório IA" precisa persistir a análise agregada da
-- pesquisa inteira. satisfaction_responses.ai_analysis já existe mas é por
-- resposta individual e não é usado em lugar nenhum hoje — o que a aba
-- precisa é uma análise agregada por PESQUISA, pra não ter que gerar de
-- novo toda vez que o gestor reabrir a aba.
-- =============================================================================

ALTER TABLE satisfaction_surveys
  ADD COLUMN IF NOT EXISTS ai_analysis JSONB,
  ADD COLUMN IF NOT EXISTS ai_analysis_generated_at TIMESTAMPTZ;
