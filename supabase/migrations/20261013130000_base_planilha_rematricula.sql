-- ============================================================================
-- 20261013130000_base_planilha_rematricula.sql — Etapa B, passo 4.
-- Envio de planilha de alunos (formato do relatório da escola: blocos
-- "Segmento / Série / Ano / Turma" com Nº, Matrícula, Nome do aluno, Situação),
-- cruzamento entre anos pela matrícula, sequência padrão de séries, painel de
-- rematrícula, vagas e marcação manual de "rematriculado".
-- NÃO APLICADA. Ensaio: supabase/pendentes/base_planilha_ensaio.sql.
--
-- Regras (pedido de 13/10):
--   * Ano anterior (N-1) Aprovado/Reprovado + Cursando/Pré-matrícula no ano N = rematriculado
--   * Base de N-1 sem registro em N                                          = a rematricular
--   * Transferência/Cancelada                                                 = saiu
--   * Só em N (sem registro em N-1)                                           = novato
--   * Aprovado na série final da escola (sequência padrão)                    = concluinte (fora de "a rematricular")
--   * Reprovado volta pra mesma série; aprovado vai pra série seguinte
--   * Reenvio atualiza pela matrícula (mesmo aluno, mesmo ano), sem duplicar.
--   * Marcação manual "rematriculado (declarado)" como reserva.
-- LGPD: nome do aluno e do responsável guardados; CPF só como HMAC
-- (base_cpf_hmac); sem nome na planilha, o aluno fica como "Matrícula 123".
-- ============================================================================

-- ── 1. Séries: chave canônica e sequência padrão ────────────────────────────
-- Chave: inf1..inf5 · ef1..ef9 · em1..em3 (a partir do nome da série, com ou
-- sem segmento: "1º Ano EF", "Ensino Fundamental I / 1º Ano", "1ª Série EM",
-- "Infantil III", "Infantil 3"…). NULL quando não reconhece.
CREATE OR REPLACE FUNCTION public.base_grade_key(p_text text)
RETURNS text LANGUAGE plpgsql STABLE SET search_path TO 'public', 'extensions' AS $$
DECLARE
  t   text := lower(unaccent(COALESCE(p_text, '')));
  n   text;
  rom text;
BEGIN
  t := regexp_replace(t, '[º°ª.]', ' ', 'g');
  t := regexp_replace(t, '\s+', ' ', 'g');
  IF t ~ '(infantil|educacao infantil|pre ?escola|grupo)' THEN
    -- (no Postgres a fronteira de palavra é \M; \b é backspace)
    rom := substring(t from 'infantil\s+(v|iv|iii|ii|i|[1-5])\M');
    IF rom IS NULL THEN rom := substring(t from '(?:grupo|nivel)\s+([1-5])\M'); END IF;
    RETURN CASE rom WHEN 'i' THEN 'inf1' WHEN 'ii' THEN 'inf2' WHEN 'iii' THEN 'inf3' WHEN 'iv' THEN 'inf4' WHEN 'v' THEN 'inf5'
                    WHEN '1' THEN 'inf1' WHEN '2' THEN 'inf2' WHEN '3' THEN 'inf3' WHEN '4' THEN 'inf4' WHEN '5' THEN 'inf5' END;
  END IF;
  IF t ~ '(medio|\mem\M)' OR (t ~ 'serie' AND t !~ '(fundamental|\mef\M)') THEN
    n := substring(t from '([1-3])\s*(?:a\s+)?(?:serie|ano)');
    IF n IS NULL THEN n := substring(t from '\m([1-3])\M'); END IF;
    RETURN CASE WHEN n IS NOT NULL THEN 'em' || n END;
  END IF;
  n := substring(t from '\m([1-9])\s*(?:o\s+|a\s+)?(?:ano|serie)\M');
  IF n IS NULL AND t ~ '(fundamental|\mef\M)' THEN n := substring(t from '\m([1-9])\M'); END IF;
  RETURN CASE WHEN n IS NOT NULL THEN 'ef' || n END;
END $$;

-- Ordem padrão: Infantil I–V → Fundamental 1º–9º → Médio 1ª–3ª.
CREATE OR REPLACE FUNCTION public.base_grade_key_order(p_key text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_key ~ '^inf[1-5]$' THEN substring(p_key from 4)::int
    WHEN p_key ~ '^ef[1-9]$'  THEN 5 + substring(p_key from 3)::int
    WHEN p_key ~ '^em[1-3]$'  THEN 14 + substring(p_key from 3)::int
  END
$$;

-- Preenche segmento, série seguinte e série final (concluinte) pela sequência
-- padrão — só onde a escola ainda não ajustou (segment nulo). A última série
-- que a escola oferece na sequência é a final.
CREATE OR REPLACE FUNCTION public.base_apply_default_grade_sequence(p_institution_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE v_n int;
BEGIN
  WITH g AS (
    SELECT DISTINCT ON (k) id, k, base_grade_key_order(k) AS ord
      FROM (SELECT id, sort_order, base_grade_key(name) AS k FROM school_grade_levels
             WHERE institution_id = p_institution_id AND COALESCE(active, true)) x
     WHERE k IS NOT NULL
     ORDER BY k, sort_order
  ), seq AS (
    SELECT id, k, ord,
           lead(id) OVER (ORDER BY ord) AS next_id,
           ord = max(ord) OVER () AS last
      FROM g
  )
  UPDATE school_grade_levels s
     SET segment = CASE WHEN q.k LIKE 'inf%' THEN 'infantil'
                        WHEN q.k IN ('ef1','ef2','ef3','ef4','ef5') THEN 'fund1'
                        WHEN q.k LIKE 'ef%' THEN 'fund2' ELSE 'medio' END,
         next_grade_level_id = q.next_id,
         is_terminal = q.last
    FROM seq q
   WHERE s.id = q.id AND s.segment IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.base_apply_default_grade_sequence(uuid) FROM PUBLIC, anon, authenticated;

-- Série da planilha → série da escola (mesma chave; empate = menor ordem).
CREATE OR REPLACE FUNCTION public.base_match_grade(p_institution_id uuid, p_text text)
RETURNS uuid LANGUAGE sql STABLE SET search_path TO 'public', 'extensions' AS $$
  SELECT g.id FROM school_grade_levels g
   WHERE g.institution_id = p_institution_id AND COALESCE(g.active, true)
     AND base_grade_key(g.name) = base_grade_key(p_text) AND base_grade_key(p_text) IS NOT NULL
   ORDER BY g.sort_order LIMIT 1
$$;

-- Situação da planilha → situação canônica (o texto original fica em raw_status).
CREATE OR REPLACE FUNCTION public.base_status_from_text(p_text text)
RETURNS text LANGUAGE sql STABLE SET search_path TO 'public', 'extensions' AS $$
  SELECT CASE
    WHEN t ~ 'pre.?matric'      THEN 'pre_matricula'
    WHEN t ~ '^cursando|matriculad|^ativ' THEN 'ativo'
    WHEN t ~ '^aprovad|^reprovad|^conclu|^retid' THEN 'concluido'
    WHEN t ~ 'transfer'         THEN 'transferido'
    WHEN t ~ 'cancel'           THEN 'cancelado'
    WHEN t ~ 'desist|abandon|evad' THEN 'desistente'
    WHEN t ~ 'remanej'          THEN 'remanejado'
    ELSE 'desconhecido' END
  FROM (SELECT btrim(lower(unaccent(COALESCE(p_text, '')))) AS t) x
$$;

-- ── 2. Vagas e marcação manual ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.grade_capacity (
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  academic_year   int  NOT NULL CHECK (academic_year BETWEEN 2000 AND 2100),
  grade_level_id  uuid NOT NULL REFERENCES public.school_grade_levels(id) ON DELETE CASCADE,
  capacity        int  NOT NULL CHECK (capacity >= 0),
  updated_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, academic_year, grade_level_id)
);

-- "Rematriculado (declarado)": a equipe marca enquanto a planilha nova não chega.
CREATE TABLE IF NOT EXISTS public.reenrollment_overrides (
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  target_year     int  NOT NULL,
  student_id      uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  marked_by       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  marked_at       timestamptz NOT NULL DEFAULT now(),
  note            text,
  PRIMARY KEY (institution_id, target_year, student_id)
);

DO $rls$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['grade_capacity', 'reenrollment_overrides'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (base_user_can_read(institution_id))', t || '_select', t);
  END LOOP;
END $rls$;

CREATE OR REPLACE FUNCTION public.base_set_capacity(p_institution_id uuid, p_academic_year int, p_grade_level_id uuid, p_capacity int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT base_user_can_read(p_institution_id) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM school_grade_levels WHERE id = p_grade_level_id AND institution_id = p_institution_id) THEN
    RAISE EXCEPTION 'Série não pertence à escola' USING ERRCODE = '42501';
  END IF;
  IF p_capacity IS NULL THEN
    DELETE FROM grade_capacity WHERE institution_id = p_institution_id AND academic_year = p_academic_year AND grade_level_id = p_grade_level_id;
  ELSE
    INSERT INTO grade_capacity (institution_id, academic_year, grade_level_id, capacity, updated_by)
    VALUES (p_institution_id, p_academic_year, p_grade_level_id, p_capacity, auth.uid())
    ON CONFLICT (institution_id, academic_year, grade_level_id) DO UPDATE
      SET capacity = EXCLUDED.capacity, updated_by = EXCLUDED.updated_by, updated_at = now();
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.base_set_capacity(uuid, int, uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_set_capacity(uuid, int, uuid, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.base_mark_reenrolled(p_institution_id uuid, p_target_year int, p_student_id uuid, p_on boolean, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT base_user_can_see_list(p_institution_id) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_student_id AND institution_id = p_institution_id) THEN
    RAISE EXCEPTION 'Aluno não pertence à escola' USING ERRCODE = '42501';
  END IF;
  IF p_on THEN
    INSERT INTO reenrollment_overrides (institution_id, target_year, student_id, marked_by, note)
    VALUES (p_institution_id, p_target_year, p_student_id, auth.uid(), p_note)
    ON CONFLICT (institution_id, target_year, student_id) DO UPDATE SET marked_by = EXCLUDED.marked_by, marked_at = now(), note = EXCLUDED.note;
  ELSE
    DELETE FROM reenrollment_overrides WHERE institution_id = p_institution_id AND target_year = p_target_year AND student_id = p_student_id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.base_mark_reenrolled(uuid, int, uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_mark_reenrolled(uuid, int, uuid, boolean, text) TO authenticated;

-- ── 3. Situação de rematrícula por aluno (o que o painel lê) ────────────────
-- Uma linha por aluno e ano-alvo N (anos com dado em N ou N-1).
CREATE OR REPLACE VIEW public.v_base_reenrollment WITH (security_invoker = true) AS
WITH anos AS (
  SELECT DISTINCT institution_id, academic_year AS y FROM class_enrollments
  UNION SELECT DISTINCT institution_id, academic_year + 1 FROM class_enrollments
),
alunos AS (
  SELECT a.institution_id, a.y AS target_year, e.student_id
    FROM anos a JOIN class_enrollments e ON e.institution_id = a.institution_id AND e.academic_year IN (a.y - 1, a.y)
   GROUP BY 1, 2, 3
),
x AS (
  SELECT al.institution_id, al.target_year, al.student_id,
         p.grade_level_id AS prev_grade_id, p.status AS prev_status, p.raw_status AS prev_raw,
         c.grade_level_id AS cur_grade_id,  c.status AS cur_status,  c.raw_status AS cur_raw,
         pg.is_terminal AS prev_terminal, pg.next_grade_level_id AS prev_next,
         (o.student_id IS NOT NULL) AS declared
    FROM alunos al
    LEFT JOIN LATERAL (SELECT * FROM class_enrollments e WHERE e.student_id = al.student_id AND e.academic_year = al.target_year - 1
                        ORDER BY (e.status = 'remanejado'), e.last_seen_at DESC LIMIT 1) p ON true
    LEFT JOIN LATERAL (SELECT * FROM class_enrollments e WHERE e.student_id = al.student_id AND e.academic_year = al.target_year
                        ORDER BY (e.status = 'remanejado'), e.last_seen_at DESC LIMIT 1) c ON true
    LEFT JOIN school_grade_levels pg ON pg.id = p.grade_level_id
    LEFT JOIN reenrollment_overrides o ON o.institution_id = al.institution_id AND o.target_year = al.target_year AND o.student_id = al.student_id
)
SELECT x.institution_id, x.target_year, x.student_id,
       s.registration_code, s.full_name AS student_name,
       (SELECT g.full_name FROM student_guardians sg JOIN guardians g ON g.id = sg.guardian_id
         WHERE sg.student_id = x.student_id ORDER BY sg.is_primary DESC LIMIT 1) AS guardian_name,
       x.prev_grade_id, x.prev_raw AS prev_status_text, x.cur_grade_id, x.cur_raw AS cur_status_text,
       cat.category,
       -- série de destino: a atual quando há registro; senão a esperada
       -- (reprovado fica na mesma, aprovado sobe)
       COALESCE(x.cur_grade_id,
                CASE WHEN lower(COALESCE(x.prev_raw, '')) LIKE 'reprov%' THEN x.prev_grade_id
                     ELSE COALESCE(x.prev_next, x.prev_grade_id) END) AS dest_grade_id,
       (x.prev_status IN ('concluido', 'ativo', 'pre_matricula')) AS in_base
  FROM x
  JOIN students s ON s.id = x.student_id
  CROSS JOIN LATERAL (SELECT CASE
    WHEN x.prev_status IN ('concluido', 'ativo', 'pre_matricula') THEN
      CASE
        WHEN x.cur_status IN ('ativo', 'pre_matricula')                     THEN 'rematriculado'
        WHEN x.cur_status IN ('transferido', 'cancelado', 'desistente')     THEN 'saiu'
        WHEN x.cur_status IS NULL AND lower(COALESCE(x.prev_raw, '')) LIKE 'aprov%' AND x.prev_terminal THEN 'concluinte'
        WHEN x.cur_status IS NULL AND x.declared                           THEN 'rematriculado_declarado'
        WHEN x.cur_status IS NULL                                          THEN 'a_rematricular'
        ELSE 'outro' END
    WHEN x.prev_status IN ('transferido', 'cancelado', 'desistente') AND x.cur_status IN ('ativo', 'pre_matricula') THEN 'retorno'
    WHEN x.prev_status IN ('transferido', 'cancelado', 'desistente') THEN 'saiu'
    WHEN x.prev_status IS NULL AND x.cur_status IN ('ativo', 'pre_matricula') THEN 'novato'
    WHEN x.prev_status IS NULL AND x.cur_status IN ('transferido', 'cancelado', 'desistente') THEN 'saiu'
    ELSE 'outro' END AS category) cat;

-- Painel por série (de destino no ano N) + vagas.
CREATE OR REPLACE VIEW public.v_base_reenrollment_by_grade WITH (security_invoker = true) AS
SELECT r.institution_id, r.target_year, r.dest_grade_id AS grade_level_id,
       count(*) FILTER (WHERE r.in_base AND r.category <> 'concluinte')                    AS base_prev_year,
       count(*) FILTER (WHERE r.category = 'rematriculado')                                AS reenrolled,
       count(*) FILTER (WHERE r.category = 'rematriculado_declarado')                      AS reenrolled_declared,
       count(*) FILTER (WHERE r.category = 'a_rematricular')                               AS pending,
       count(*) FILTER (WHERE r.category = 'saiu')                                         AS left_school,
       count(*) FILTER (WHERE r.category = 'novato')                                       AS new_students,
       count(*) FILTER (WHERE r.category = 'retorno')                                      AS returning_students,
       count(*) FILTER (WHERE r.category = 'concluinte')                                   AS graduates,
       (SELECT c.capacity FROM grade_capacity c WHERE c.institution_id = r.institution_id
           AND c.academic_year = r.target_year AND c.grade_level_id = r.dest_grade_id)    AS capacity
  FROM v_base_reenrollment r
 GROUP BY r.institution_id, r.target_year, r.dest_grade_id;

REVOKE ALL ON public.v_base_reenrollment, public.v_base_reenrollment_by_grade FROM anon;
GRANT SELECT ON public.v_base_reenrollment, public.v_base_reenrollment_by_grade TO authenticated;

-- ── 4. Importação da planilha (com prévia que não grava) ────────────────────
-- p_rows: [{ linha, matricula, nome?, responsavel?, cpf_responsavel?, segmento?, serie, ano?, turma?, situacao }]
-- p_dry_run = true: faz tudo, calcula o resumo e DESFAZ (nada fica gravado).
CREATE OR REPLACE FUNCTION public.base_import_roster(p_institution_id uuid, p_default_year int, p_rows jsonb,
                                                    p_dry_run boolean DEFAULT true, p_file_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE
  r            jsonb;
  v_year       int;
  v_grade      uuid;
  v_class      uuid;
  v_status     text;
  v_mat        text;
  v_name       text;
  v_student    uuid;
  v_enr        record;
  v_guard      uuid;
  v_hmac       text;
  v_turma      text;
  v_read       int := 0; v_new int := 0; v_upd int := 0; v_same int := 0; v_changed int := 0;
  v_ignored    jsonb := '[]'::jsonb;
  v_unk_grade  jsonb := '{}'::jsonb;
  v_unk_status jsonb := '{}'::jsonb;
  v_cpf_skip   int := 0;
  v_years      int[] := '{}';
  v_seq        int;
  v_summary    jsonb;
  v_cross      jsonb;
  v_run        uuid;
BEGIN
  IF NOT base_user_can_read(p_institution_id) THEN
    RAISE EXCEPTION 'Sem permissão para enviar a base desta escola' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'p_rows precisa ser uma lista'; END IF;
  IF jsonb_array_length(p_rows) > 20000 THEN RAISE EXCEPTION 'Planilha grande demais (máx. 20.000 linhas)'; END IF;

  BEGIN  -- subtransação: na prévia, tudo daqui é desfeito no fim
    v_seq := base_apply_default_grade_sequence(p_institution_id);

    FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
      v_read := v_read + 1;
      v_mat  := NULLIF(btrim(r->>'matricula'), '');
      v_year := COALESCE(substring(r->>'ano' from '(20[0-9]{2})')::int, p_default_year);
      IF v_mat IS NULL OR NULLIF(btrim(r->>'serie'), '') IS NULL OR NULLIF(btrim(r->>'situacao'), '') IS NULL OR v_year IS NULL THEN
        v_ignored := v_ignored || jsonb_build_object('linha', r->'linha', 'motivo', 'falta matrícula, série, situação ou ano');
        CONTINUE;
      END IF;
      v_grade := COALESCE(base_match_grade(p_institution_id, concat_ws(' ', r->>'segmento', r->>'serie')),
                          base_match_grade(p_institution_id, r->>'serie'));
      IF v_grade IS NULL THEN
        v_unk_grade := jsonb_set(v_unk_grade, ARRAY[concat_ws(' / ', NULLIF(r->>'segmento', ''), r->>'serie')],
                                 to_jsonb(COALESCE((v_unk_grade->>concat_ws(' / ', NULLIF(r->>'segmento', ''), r->>'serie'))::int, 0) + 1));
        CONTINUE;
      END IF;
      v_status := base_status_from_text(r->>'situacao');
      IF v_status = 'desconhecido' THEN
        v_unk_status := jsonb_set(v_unk_status, ARRAY[r->>'situacao'], to_jsonb(COALESCE((v_unk_status->>(r->>'situacao'))::int, 0) + 1));
      END IF;
      IF NOT (v_year = ANY (v_years)) THEN v_years := v_years || v_year; END IF;

      -- turma (opcional)
      v_turma := NULLIF(btrim(r->>'turma'), '');
      v_class := NULL;
      IF v_turma IS NOT NULL THEN
        SELECT id INTO v_class FROM school_classes
         WHERE institution_id = p_institution_id AND source = 'planilha' AND external_id = v_year || '|' || v_grade || '|' || v_turma;
        IF v_class IS NULL THEN
          INSERT INTO school_classes (institution_id, academic_year, grade_level_id, name, source, external_id)
          VALUES (p_institution_id, v_year, v_grade, v_turma, 'planilha', v_year || '|' || v_grade || '|' || v_turma)
          RETURNING id INTO v_class;
        END IF;
      END IF;

      -- aluno, pela matrícula
      v_name := NULLIF(btrim(r->>'nome'), '');
      SELECT student_id INTO v_student FROM student_external_ids
       WHERE institution_id = p_institution_id AND source = 'planilha' AND external_id = v_mat;
      IF v_student IS NULL THEN
        INSERT INTO students (institution_id, full_name, name_key, registration_code, first_year, source)
        VALUES (p_institution_id, COALESCE(v_name, 'Matrícula ' || v_mat),
                lower(unaccent(regexp_replace(COALESCE(v_name, 'matricula ' || v_mat), '\s+', ' ', 'g'))),
                v_mat, v_year, 'planilha')
        RETURNING id INTO v_student;
        INSERT INTO student_external_ids (institution_id, student_id, source, external_id)
        VALUES (p_institution_id, v_student, 'planilha', v_mat);
      ELSE
        UPDATE students SET
          full_name  = COALESCE(v_name, full_name),
          name_key   = CASE WHEN v_name IS NOT NULL THEN lower(unaccent(regexp_replace(v_name, '\s+', ' ', 'g'))) ELSE name_key END,
          first_year = LEAST(COALESCE(first_year, v_year), v_year),
          updated_at = now()
         WHERE id = v_student;
      END IF;

      -- responsável (opcional). CPF só como HMAC; sem o segredo no Vault, o CPF é ignorado.
      IF NULLIF(btrim(r->>'responsavel'), '') IS NOT NULL THEN
        v_hmac := NULL;
        IF NULLIF(btrim(r->>'cpf_responsavel'), '') IS NOT NULL THEN
          BEGIN v_hmac := base_cpf_hmac(r->>'cpf_responsavel');
          EXCEPTION WHEN others THEN v_cpf_skip := v_cpf_skip + 1; END;
        END IF;
        SELECT id INTO v_guard FROM guardians WHERE institution_id = p_institution_id AND source = 'planilha' AND external_id = v_mat;
        IF v_guard IS NULL THEN
          INSERT INTO guardians (institution_id, full_name, name_key, cpf_hmac, cpf_last2, source, external_id)
          VALUES (p_institution_id, btrim(r->>'responsavel'), lower(unaccent(btrim(r->>'responsavel'))), v_hmac,
                  CASE WHEN v_hmac IS NOT NULL THEN right(regexp_replace(r->>'cpf_responsavel', '\D', '', 'g'), 2) END,
                  'planilha', v_mat)
          RETURNING id INTO v_guard;
          INSERT INTO student_guardians (institution_id, student_id, guardian_id, role, is_primary, source)
          VALUES (p_institution_id, v_student, v_guard, 'responsavel', true, 'planilha')
          ON CONFLICT (student_id, guardian_id, role) DO NOTHING;
        ELSE
          UPDATE guardians SET full_name = btrim(r->>'responsavel'), name_key = lower(unaccent(btrim(r->>'responsavel'))),
                 cpf_hmac = COALESCE(v_hmac, cpf_hmac), updated_at = now()
           WHERE id = v_guard;
        END IF;
      END IF;

      -- enturmação do ano: uma por aluno e ano (reenvio atualiza, não duplica)
      SELECT * INTO v_enr FROM class_enrollments
       WHERE student_id = v_student AND academic_year = v_year
       ORDER BY (status = 'remanejado'), last_seen_at DESC LIMIT 1;
      IF v_enr.id IS NULL THEN
        INSERT INTO class_enrollments (institution_id, student_id, academic_year, class_id, grade_level_id, status, raw_status,
                                       source, status_changed_at)
        VALUES (p_institution_id, v_student, v_year, v_class, v_grade, v_status, btrim(r->>'situacao'), 'planilha', now());
        INSERT INTO student_status_events (institution_id, student_id, academic_year, from_status, to_status, event_date,
                                           date_source, source, reason_detail)
        VALUES (p_institution_id, v_student, v_year, NULL, v_status, (now() AT TIME ZONE 'America/Sao_Paulo')::date,
                'detectado_na_carga', 'planilha', btrim(r->>'situacao'));
        v_new := v_new + 1;
      ELSIF v_enr.status IS DISTINCT FROM v_status OR v_enr.grade_level_id IS DISTINCT FROM v_grade
            OR v_enr.class_id IS DISTINCT FROM v_class OR v_enr.raw_status IS DISTINCT FROM btrim(r->>'situacao') THEN
        UPDATE class_enrollments SET grade_level_id = v_grade, class_id = v_class, status = v_status,
               raw_status = btrim(r->>'situacao'), last_seen_at = now(), missing_runs = 0,
               status_changed_at = CASE WHEN status IS DISTINCT FROM v_status THEN now() ELSE status_changed_at END
         WHERE id = v_enr.id;
        IF v_enr.status IS DISTINCT FROM v_status THEN
          INSERT INTO student_status_events (institution_id, student_id, academic_year, class_enrollment_id, from_status, to_status,
                                             event_date, date_source, source, reason_detail)
          VALUES (p_institution_id, v_student, v_year, v_enr.id, v_enr.status, v_status,
                  (now() AT TIME ZONE 'America/Sao_Paulo')::date, 'detectado_na_carga', 'planilha', btrim(r->>'situacao'));
          v_changed := v_changed + 1;
        END IF;
        v_upd := v_upd + 1;
      ELSE
        UPDATE class_enrollments SET last_seen_at = now(), missing_runs = 0 WHERE id = v_enr.id;
        v_same := v_same + 1;
      END IF;
    END LOOP;

    -- cobertura: a planilha vira a fonte (aluno a aluno) desses anos
    INSERT INTO student_base_coverage (institution_id, academic_year, source, level, last_loaded_at, seal, seal_reason)
    SELECT p_institution_id, y, 'planilha', 'aluno', now(), 'parcial', 'planilha enviada pela escola'
      FROM unnest(v_years) y
    ON CONFLICT (institution_id, academic_year) DO UPDATE
      SET source = 'planilha', level = 'aluno', last_loaded_at = now(), seal = 'parcial', seal_reason = 'planilha enviada pela escola';

    -- resumo cruzado (todo ano-alvo tocado: o ano enviado e o seguinte)
    SELECT COALESCE(jsonb_agg(z ORDER BY z.target_year), '[]'::jsonb) INTO v_cross FROM (
      SELECT r2.target_year,
             count(*) FILTER (WHERE r2.in_base)                                        AS base_ano_anterior,
             count(*) FILTER (WHERE r2.category = 'rematriculado')                     AS rematriculados,
             count(*) FILTER (WHERE r2.in_base AND r2.category <> 'rematriculado')     AS faltam_total,
             count(*) FILTER (WHERE r2.in_base AND r2.category = 'saiu')               AS sairam_da_base,
             count(*) FILTER (WHERE r2.category = 'retorno')                           AS retornos,
             count(*) FILTER (WHERE r2.category = 'rematriculado_declarado')           AS rematriculados_declarados,
             count(*) FILTER (WHERE r2.category = 'a_rematricular')                    AS a_rematricular,
             count(*) FILTER (WHERE r2.category = 'concluinte')                        AS concluintes,
             count(*) FILTER (WHERE r2.category = 'saiu')                              AS sairam,
             count(*) FILTER (WHERE r2.category = 'novato')                            AS novatos
        FROM v_base_reenrollment r2
       WHERE r2.institution_id = p_institution_id
         AND (r2.target_year = ANY (v_years) OR r2.target_year - 1 = ANY (v_years))
       GROUP BY r2.target_year) z;

    v_summary := jsonb_build_object(
      'linhas_lidas', v_read, 'alunos_novos_no_ano', v_new, 'atualizados', v_upd, 'sem_mudanca', v_same,
      'mudancas_de_situacao', v_changed, 'anos', to_jsonb(v_years), 'series_reconhecidas_pela_sequencia', v_seq,
      'ignoradas', v_ignored, 'series_nao_reconhecidas', v_unk_grade, 'situacoes_nao_reconhecidas', v_unk_status,
      'cpf_ignorado_sem_segredo', v_cpf_skip, 'cruzamento', v_cross, 'previa', p_dry_run);

    IF p_dry_run THEN RAISE EXCEPTION 'BASE_PREVIA' USING ERRCODE = 'P0099'; END IF;

    INSERT INTO sync_runs (institution_id, source, kind, status, triggered_by, started_at, finished_at, counts, summary)
    VALUES (p_institution_id, 'planilha', 'planilha',
            CASE WHEN jsonb_array_length(v_ignored) > 0 OR v_unk_grade <> '{}'::jsonb OR v_unk_status <> '{}'::jsonb THEN 'ok_com_avisos' ELSE 'ok' END,
            COALESCE(auth.uid()::text, 'sistema'), now(), now(),
            jsonb_build_object('lidas', v_read, 'novos', v_new, 'atualizados', v_upd, 'sem_mudanca', v_same, 'arquivo', p_file_name),
            v_cross)
    RETURNING id INTO v_run;
    v_summary := v_summary || jsonb_build_object('run_id', v_run);
  EXCEPTION WHEN SQLSTATE 'P0099' THEN
    NULL;  -- prévia: tudo desfeito, o resumo já está em v_summary
  END;
  RETURN v_summary;
END $$;
REVOKE ALL ON FUNCTION public.base_import_roster(uuid, int, jsonb, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_import_roster(uuid, int, jsonb, boolean, text) TO authenticated;

-- ── 5. Lista para a equipe (permissão "Base de alunos") ─────────────────────
-- Admin e gestor sempre veem. Atendente só com a permissão base_alunos ligada
-- em Usuários (desligada por padrão). O atendente NÃO ganha leitura das tabelas
-- da base: lê só por estas duas funções (lista nominal e números por série).
CREATE OR REPLACE FUNCTION public.base_user_can_see_list(p_institution_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT base_user_can_read(p_institution_id) OR EXISTS (
    SELECT 1 FROM users u
      JOIN user_permissions p ON p.user_id = u.id AND p.institution_id = p_institution_id
                             AND p.module = 'base_alunos' AND p.enabled
     WHERE u.id = auth.uid() AND COALESCE(u.active, true)
       AND p_institution_id IN (u.institution_id, u.active_institution_id)
  )
$$;
REVOKE ALL ON FUNCTION public.base_user_can_see_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_user_can_see_list(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.base_reenrollment_list(p_institution_id uuid, p_target_year int)
RETURNS TABLE (student_id uuid, registration_code text, student_name text, guardian_name text, category text,
               prev_grade text, prev_status_text text, dest_grade_id uuid, dest_grade text, cur_status_text text,
               declared_note text, declared_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT base_user_can_see_list(p_institution_id) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT r.student_id, r.registration_code, r.student_name, r.guardian_name, r.category,
         pg.name, r.prev_status_text, r.dest_grade_id, dg.name, r.cur_status_text, o.note, o.marked_at
    FROM v_base_reenrollment r
    LEFT JOIN school_grade_levels pg ON pg.id = r.prev_grade_id
    LEFT JOIN school_grade_levels dg ON dg.id = r.dest_grade_id
    LEFT JOIN reenrollment_overrides o ON o.institution_id = r.institution_id AND o.target_year = r.target_year AND o.student_id = r.student_id
   WHERE r.institution_id = p_institution_id AND r.target_year = p_target_year
   ORDER BY dg.sort_order NULLS LAST, r.student_name;
END $$;
REVOKE ALL ON FUNCTION public.base_reenrollment_list(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_reenrollment_list(uuid, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.base_reenrollment_panel(p_institution_id uuid, p_target_year int)
RETURNS TABLE (grade_level_id uuid, grade_name text, sort_order int, is_terminal boolean, base_prev_year bigint, reenrolled bigint,
               reenrolled_declared bigint, pending bigint, left_school bigint, new_students bigint, returning_students bigint,
               graduates bigint, capacity int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT base_user_can_see_list(p_institution_id) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT g.id, g.name, g.sort_order, g.is_terminal,
         COALESCE(b.base_prev_year, 0), COALESCE(b.reenrolled, 0), COALESCE(b.reenrolled_declared, 0), COALESCE(b.pending, 0),
         COALESCE(b.left_school, 0), COALESCE(b.new_students, 0), COALESCE(b.returning_students, 0), COALESCE(b.graduates, 0),
         c.capacity
    FROM school_grade_levels g
    LEFT JOIN v_base_reenrollment_by_grade b ON b.institution_id = g.institution_id AND b.target_year = p_target_year AND b.grade_level_id = g.id
    LEFT JOIN grade_capacity c ON c.institution_id = g.institution_id AND c.academic_year = p_target_year AND c.grade_level_id = g.id
   WHERE g.institution_id = p_institution_id AND COALESCE(g.active, true)
   ORDER BY g.sort_order, g.name;
END $$;
REVOKE ALL ON FUNCTION public.base_reenrollment_panel(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_reenrollment_panel(uuid, int) TO authenticated;
