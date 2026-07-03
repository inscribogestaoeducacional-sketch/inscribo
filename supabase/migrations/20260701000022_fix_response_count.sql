-- =============================================================================
-- 20260701000022_fix_response_count.sql
-- satisfaction_surveys.response_count estava desatualizado (ex.: 42 no banco
-- vs 88 respostas reais em satisfaction_responses). Causa raiz: o incremento
-- era feito no cliente (SatisfactionPage.tsx), lendo `survey.response_count`
-- do estado em memória e regravando `+1` — sob envios concorrentes (comum em
-- pesquisa de escola, várias famílias respondendo ao mesmo tempo) isso é uma
-- leitura-e-escrita não atômica: dois envios simultâneos podem ler o mesmo
-- valor e o segundo incremento é perdido (last-write-wins). Substituído por
-- um trigger no banco, que incrementa atomicamente via UPDATE ... SET x = x+1
-- (sempre correto independente de concorrência ou de qual caminho insere a
-- resposta). O código cliente correspondente foi removido em
-- SatisfactionPage.tsx para não incrementar em dobro.
-- =============================================================================

-- 1) Backfill: corrige o contador de todas as pesquisas existentes.
UPDATE satisfaction_surveys s
SET response_count = (
  SELECT COUNT(*)
  FROM satisfaction_responses r
  WHERE r.survey_id = s.id
);

-- 2) Trigger: mantém o contador correto daqui pra frente.
CREATE OR REPLACE FUNCTION increment_survey_response_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE satisfaction_surveys
  SET response_count = response_count + 1
  WHERE id = NEW.survey_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_survey_response_count ON satisfaction_responses;
CREATE TRIGGER trg_increment_survey_response_count
AFTER INSERT ON satisfaction_responses
FOR EACH ROW
EXECUTE FUNCTION increment_survey_response_count();
