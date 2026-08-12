-- =============================================================================
-- 20260812000200_school_grade_levels.sql
-- Reforma do módulo de Leads — parte 3: nomenclatura de séries configurável
-- por escola. Antes hardcoded em ~10 arquivos, com duas listas divergentes
-- (LeadKanban.tsx: gradeOptions usada pra salvar vs. GRADES usada pro filtro
-- — Ensino Médio com nomes diferentes nas duas, filtro nunca batia).
--
-- Lista padrão = a mesma nomenclatura que já estava sendo GRAVADA nos leads
-- existentes (gradeOptions, não GRADES), pra não invalidar dado histórico.
-- =============================================================================

CREATE TABLE IF NOT EXISTS school_grade_levels (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id, name)
);

CREATE INDEX IF NOT EXISTS idx_school_grade_levels_institution ON school_grade_levels(institution_id, sort_order);

ALTER TABLE school_grade_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access their institution grade levels" ON school_grade_levels;
CREATE POLICY "Users can access their institution grade levels"
  ON school_grade_levels
  FOR ALL
  TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed automático — trigger pra escolas novas + backfill pras que já existem.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION seed_default_grade_levels()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO school_grade_levels (institution_id, name, sort_order) VALUES
    (NEW.id, 'Infantil I',    1),
    (NEW.id, 'Infantil II',   2),
    (NEW.id, 'Infantil III',  3),
    (NEW.id, 'Infantil IV',   4),
    (NEW.id, 'Infantil V',    5),
    (NEW.id, '1º Ano EF',     6),
    (NEW.id, '2º Ano EF',     7),
    (NEW.id, '3º Ano EF',     8),
    (NEW.id, '4º Ano EF',     9),
    (NEW.id, '5º Ano EF',    10),
    (NEW.id, '6º Ano EF',    11),
    (NEW.id, '7º Ano EF',    12),
    (NEW.id, '8º Ano EF',    13),
    (NEW.id, '9º Ano EF',    14),
    (NEW.id, '1ª Série EM',  15),
    (NEW.id, '2ª Série EM',  16),
    (NEW.id, '3ª Série EM',  17)
  ON CONFLICT (institution_id, name) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_seed_default_grade_levels ON institutions;
CREATE TRIGGER trg_seed_default_grade_levels
  AFTER INSERT ON institutions
  FOR EACH ROW EXECUTE FUNCTION seed_default_grade_levels();

-- Backfill — escolas que já existiam antes dessa migration.
INSERT INTO school_grade_levels (institution_id, name, sort_order)
SELECT i.id, g.name, g.sort_order
FROM institutions i
CROSS JOIN (VALUES
  ('Infantil I',    1), ('Infantil II',   2), ('Infantil III',  3),
  ('Infantil IV',   4), ('Infantil V',    5),
  ('1º Ano EF',     6), ('2º Ano EF',     7), ('3º Ano EF',     8),
  ('4º Ano EF',     9), ('5º Ano EF',    10), ('6º Ano EF',    11),
  ('7º Ano EF',    12), ('8º Ano EF',    13), ('9º Ano EF',    14),
  ('1ª Série EM',  15), ('2ª Série EM',  16), ('3ª Série EM',  17)
) AS g(name, sort_order)
ON CONFLICT (institution_id, name) DO NOTHING;
