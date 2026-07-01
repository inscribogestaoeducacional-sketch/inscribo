-- =============================================================================
-- 20260701000006_satisfaction_custom.sql
-- Pesquisa customizada por instituição. Cada satisfaction_surveys ganha um
-- survey_mode: 'default' (7 perguntas fixas do sistema, comportamento atual
-- preservado) ou 'custom' (perguntas próprias da escola, em
-- satisfaction_questions). As duas convivem — a escola escolhe por pesquisa.
--
-- Substitui o uso de satisfaction_surveys.custom_questions (JSONB), que já
-- existia mas nunca era lido pelo formulário público (SatisfactionPage.tsx
-- só renderizava as 7 perguntas fixas — as perguntas customizadas eram
-- salvas e nunca apareciam para o respondente). A coluna custom_questions é
-- mantida no banco (pode ter dados de uso anterior) mas deixa de ser escrita
-- pela UI a partir desta mudança.
-- =============================================================================

ALTER TABLE satisfaction_surveys
  ADD COLUMN IF NOT EXISTS survey_mode TEXT NOT NULL DEFAULT 'default'
    CHECK (survey_mode IN ('default', 'custom')),
  ADD COLUMN IF NOT EXISTS redirect_url TEXT;

CREATE TABLE IF NOT EXISTS satisfaction_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       UUID NOT NULL REFERENCES satisfaction_surveys(id) ON DELETE CASCADE,
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  order_index     INTEGER NOT NULL DEFAULT 0,
  question_type   TEXT NOT NULL
                  CHECK (question_type IN ('scale', 'multiple_choice', 'text', 'nps')),
  title           TEXT NOT NULL,
  description     TEXT,
  required        BOOLEAN NOT NULL DEFAULT true,
  options         JSONB,
  -- scale:           { "min": 1, "max": 5, "min_label": "Péssimo", "max_label": "Ótimo" }
  -- multiple_choice: { "options": ["Opção A", "Opção B", "Opção C"] }
  -- nps:             { "min_label": "Nada provável", "max_label": "Muito provável" }
  -- text:            null
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_satisfaction_questions_survey ON satisfaction_questions(survey_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_questions_institution ON satisfaction_questions(institution_id);

ALTER TABLE satisfaction_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "satisfaction_questions_institution_manage" ON satisfaction_questions;
DROP POLICY IF EXISTS "satisfaction_questions_public_select" ON satisfaction_questions;

CREATE POLICY "satisfaction_questions_institution_manage" ON satisfaction_questions
  FOR ALL
  USING (institution_id = current_user_institution_id())
  WITH CHECK (institution_id = current_user_institution_id());

-- O formulário público (SatisfactionPage.tsx) precisa ler as perguntas sem
-- autenticação — mesmo padrão de acesso público por token das outras tabelas.
CREATE POLICY "satisfaction_questions_public_select" ON satisfaction_questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM satisfaction_surveys s
      WHERE s.id = survey_id AND s.survey_token IS NOT NULL
    )
  );

GRANT SELECT ON satisfaction_questions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON satisfaction_questions TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- satisfaction_responses: respostas de pesquisas custom ficam em
-- custom_answers, formato { "<question_id>": <valor> }. Respostas de
-- pesquisas default continuam em answers (inalterado).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE satisfaction_responses
  ADD COLUMN IF NOT EXISTS custom_answers JSONB;
