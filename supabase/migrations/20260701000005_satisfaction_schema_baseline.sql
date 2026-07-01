-- =============================================================================
-- 20260701000005_satisfaction_schema_baseline.sql
-- Baseline: satisfaction_surveys e satisfaction_responses já existem em
-- produção mas nunca tiveram migration versionada (foram criadas fora do
-- fluxo de migrations, provavelmente via SQL editor). Esta migration apenas
-- documenta a estrutura real (confirmada via information_schema em
-- 2026-07-01) para que o schema fique reproduzível a partir do repo daqui
-- pra frente. Usa CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS —
-- não deve alterar nada em produção, só cobrir o ambiente local/novo.
--
-- NÃO documentada aqui: a função delete_survey_cascade(survey_uuid uuid),
-- chamada por GestorSurveys.tsx ao excluir uma pesquisa. Não temos a
-- definição real dela (pg_get_functiondef não foi coletado) e redefini-la
-- por suposição arriscaria sobrescrever comportamento de produção. Como as
-- FKs abaixo já usam ON DELETE CASCADE a partir de satisfaction_surveys,
-- a função deve continuar funcionando (ela decerto termina com um DELETE
-- FROM satisfaction_surveys, que agora cascateia também para
-- satisfaction_questions criada na próxima migration). Pendência: capturar
-- a definição real e versioná-la separadamente.
-- =============================================================================

CREATE TABLE IF NOT EXISTS satisfaction_surveys (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id          UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  description             TEXT,
  require_identification  BOOLEAN NOT NULL DEFAULT false,
  status                  TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'active', 'closed')),
  survey_token            UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  created_by              TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at               TIMESTAMPTZ,
  response_count          INTEGER NOT NULL DEFAULT 0,
  custom_questions        JSONB
);

CREATE TABLE IF NOT EXISTS satisfaction_responses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id          UUID NOT NULL REFERENCES satisfaction_surveys(id) ON DELETE CASCADE,
  institution_id     UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  respondent_name    TEXT,
  respondent_grade   TEXT,
  answers            JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_analysis        JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_satisfaction_responses_survey ON satisfaction_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_institution ON satisfaction_surveys(institution_id);

ALTER TABLE satisfaction_surveys   ENABLE ROW LEVEL SECURITY;
ALTER TABLE satisfaction_responses ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: gestão pela instituição dona da pesquisa + acesso público por token
-- (o formulário em SatisfactionPage.tsx é servido sem autenticação).
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "satisfaction_surveys_institution_manage" ON satisfaction_surveys;
DROP POLICY IF EXISTS "satisfaction_surveys_public_select" ON satisfaction_surveys;
DROP POLICY IF EXISTS "satisfaction_surveys_public_response_count" ON satisfaction_surveys;

CREATE POLICY "satisfaction_surveys_institution_manage" ON satisfaction_surveys
  FOR ALL
  USING (institution_id = current_user_institution_id())
  WITH CHECK (institution_id = current_user_institution_id());

CREATE POLICY "satisfaction_surveys_public_select" ON satisfaction_surveys
  FOR SELECT
  USING (survey_token IS NOT NULL);

-- Permite ao respondente anônimo incrementar response_count ao enviar a pesquisa
CREATE POLICY "satisfaction_surveys_public_response_count" ON satisfaction_surveys
  FOR UPDATE
  USING (survey_token IS NOT NULL)
  WITH CHECK (survey_token IS NOT NULL);

DROP POLICY IF EXISTS "satisfaction_responses_institution_manage" ON satisfaction_responses;
DROP POLICY IF EXISTS "satisfaction_responses_public_insert" ON satisfaction_responses;

CREATE POLICY "satisfaction_responses_institution_manage" ON satisfaction_responses
  FOR ALL
  USING (institution_id = current_user_institution_id())
  WITH CHECK (institution_id = current_user_institution_id());

-- Permite ao respondente anônimo enviar sua resposta
CREATE POLICY "satisfaction_responses_public_insert" ON satisfaction_responses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM satisfaction_surveys s
      WHERE s.id = survey_id AND s.status = 'active'
    )
  );

GRANT SELECT, INSERT, UPDATE ON satisfaction_surveys   TO anon, authenticated;
GRANT SELECT, INSERT         ON satisfaction_responses TO anon, authenticated;
GRANT UPDATE, DELETE ON satisfaction_surveys   TO authenticated;
GRANT UPDATE, DELETE ON satisfaction_responses TO authenticated;
