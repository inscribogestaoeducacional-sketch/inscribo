-- ============================================================================
-- 20261014130000_base_responsavel_telefone.sql — Etapa 1 (Ágape com nomes).
-- NÃO APLICADA. Ensaio: supabase/pendentes/base_responsavel_telefone_ensaio.sql.
--   * telefone do responsável: guardado bruto (phone_raw) e normalizado
--     (phone_norm, mesma regra de _shared/phone.ts: 55 + DDD + número; celular
--     com 13 dígitos, fixo com 12). Só entra com nomes liberados (o núcleo
--     descarta responsável inteiro sem names_allowed).
--   * Activesoft: o telefone vem de lista_responsaveis (celular); nada de
--     rotas de dados sensíveis ou endereço.
--   * lista "a rematricular": devolve também o telefone do responsável principal.
-- Irmãos com o mesmo responsável ainda geram um registro por aluno (não
-- corrigido aqui, a pedido).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.base_phone_norm(p_phone text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN d = '' THEN NULL
    WHEN d2 ~ '^55[0-9]{10}$' AND substr(d2, 5, 1) BETWEEN '6' AND '9' THEN left(d2, 4) || '9' || substr(d2, 5)
    ELSE d2 END
  FROM (SELECT d, CASE WHEN length(d) IN (10, 11) THEN '55' || d ELSE d END AS d2
          FROM (SELECT regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g') AS d) a) b
$$;

CREATE OR REPLACE FUNCTION public.base_import_rows(p_institution_id uuid, p_default_year int, p_rows jsonb, p_dry_run boolean,
                                                  p_file_name text, p_source text, p_run_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE
  r            jsonb;
  v_year       int;
  v_grade      uuid;
  v_class      uuid;
  v_class_ext  text;
  v_status     text;
  v_mat        text;
  v_ext        text;
  v_name       text;
  v_student    uuid;
  v_found_by   text;
  v_enr        record;
  v_guard      uuid;
  v_hmac       text;
  v_turma      text;
  v_names      boolean := COALESCE((SELECT names_allowed FROM student_base_settings WHERE institution_id = p_institution_id), false);
  v_names_dropped int := 0;
  v_read       int := 0; v_new int := 0; v_upd int := 0; v_same int := 0; v_changed int := 0;
  v_new_students int := 0; v_crossed int := 0;
  v_div        int := 0;
  v_div_sample jsonb := '[]'::jsonb;
  v_ignored    jsonb := '[]'::jsonb;
  v_unk_grade  jsonb := '{}'::jsonb;
  v_unk_status jsonb := '{}'::jsonb;
  v_cpf_skip   int := 0;
  v_years      int[] := '{}';
  v_seq        int;
  v_summary    jsonb;
  v_cross      jsonb;
  v_run        uuid;
  v_key        text;
BEGIN
  IF p_source NOT IN ('planilha', 'activesoft') THEN RAISE EXCEPTION 'Fonte inválida: %', p_source; END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'p_rows precisa ser uma lista'; END IF;
  IF jsonb_array_length(p_rows) > 30000 THEN RAISE EXCEPTION 'Carga grande demais (máx. 30.000 linhas)'; END IF;

  BEGIN  -- subtransação: na prévia, tudo daqui é desfeito no fim
    v_seq := base_apply_default_grade_sequence(p_institution_id);

    FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
      v_read := v_read + 1;
      v_mat  := NULLIF(btrim(r->>'matricula'), '');
      v_ext  := NULLIF(btrim(r->>'external_id'), '');
      v_year := COALESCE(substring(r->>'ano' from '(20[0-9]{2})')::int, p_default_year);
      IF v_mat IS NULL OR NULLIF(btrim(r->>'serie'), '') IS NULL OR NULLIF(btrim(r->>'situacao'), '') IS NULL OR v_year IS NULL THEN
        v_ignored := v_ignored || jsonb_build_object('linha', r->'linha', 'motivo', 'falta matrícula, série, situação ou ano');
        CONTINUE;
      END IF;

      -- série: já resolvida (Activesoft, com apelido) ou pelo nome
      v_grade := NULL;
      IF NULLIF(r->>'grade_level_id', '') IS NOT NULL THEN
        SELECT id INTO v_grade FROM school_grade_levels
         WHERE id = (r->>'grade_level_id')::uuid AND institution_id = p_institution_id;
      END IF;
      IF v_grade IS NULL THEN
        v_grade := COALESCE(base_match_grade(p_institution_id, concat_ws(' ', r->>'segmento', r->>'serie')),
                            base_match_grade(p_institution_id, r->>'serie'));
      END IF;
      IF v_grade IS NULL THEN
        v_key := concat_ws(' / ', NULLIF(r->>'segmento', ''), r->>'serie');
        v_unk_grade := jsonb_set(v_unk_grade, ARRAY[v_key], to_jsonb(COALESCE((v_unk_grade->>v_key)::int, 0) + 1));
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
        v_class_ext := COALESCE(NULLIF(r->>'turma_external_id', ''), v_year || '|' || v_grade || '|' || v_turma);
        SELECT id INTO v_class FROM school_classes
         WHERE institution_id = p_institution_id AND source = p_source AND external_id = v_class_ext;
        IF v_class IS NULL THEN
          INSERT INTO school_classes (institution_id, academic_year, grade_level_id, name, source, external_id)
          VALUES (p_institution_id, v_year, v_grade, v_turma, p_source, v_class_ext)
          RETURNING id INTO v_class;
        END IF;
      END IF;

      -- nomes só com o aditivo registrado
      v_name := NULLIF(btrim(r->>'nome'), '');
      IF NOT v_names AND (v_name IS NOT NULL OR NULLIF(btrim(r->>'responsavel'), '') IS NOT NULL) THEN
        v_names_dropped := v_names_dropped + 1;
        v_name := NULL;
        r := r - 'responsavel' - 'cpf_responsavel' - 'responsavel_telefone';
      END IF;

      -- aluno: id do Activesoft → matrícula da planilha → matrícula cadastrada
      v_student := NULL; v_found_by := NULL;
      IF p_source = 'activesoft' AND v_ext IS NOT NULL THEN
        SELECT student_id INTO v_student FROM student_external_ids
         WHERE institution_id = p_institution_id AND source = 'activesoft' AND external_id = v_ext;
        IF v_student IS NOT NULL THEN v_found_by := 'id'; END IF;
      END IF;
      IF v_student IS NULL THEN
        SELECT student_id INTO v_student FROM student_external_ids
         WHERE institution_id = p_institution_id AND source = 'planilha' AND external_id = v_mat;
        IF v_student IS NOT NULL THEN v_found_by := 'matricula'; END IF;
      END IF;
      IF v_student IS NULL THEN
        SELECT id INTO v_student FROM students
         WHERE institution_id = p_institution_id AND registration_code = v_mat ORDER BY created_at LIMIT 1;
        IF v_student IS NOT NULL THEN v_found_by := 'matricula'; END IF;
      END IF;

      IF v_student IS NULL THEN
        INSERT INTO students (institution_id, full_name, name_key, registration_code, first_year, source)
        VALUES (p_institution_id, COALESCE(v_name, 'Matrícula ' || v_mat),
                lower(unaccent(regexp_replace(COALESCE(v_name, 'matricula ' || v_mat), '\s+', ' ', 'g'))),
                v_mat, v_year, p_source)
        RETURNING id INTO v_student;
        v_new_students := v_new_students + 1;
      ELSE
        UPDATE students SET
          full_name  = COALESCE(v_name, full_name),
          name_key   = CASE WHEN v_name IS NOT NULL THEN lower(unaccent(regexp_replace(v_name, '\s+', ' ', 'g'))) ELSE name_key END,
          registration_code = COALESCE(registration_code, v_mat),
          first_year = LEAST(COALESCE(first_year, v_year), v_year),
          updated_at = now()
         WHERE id = v_student;
      END IF;
      -- origem: um registro por fonte (o mesmo aluno pode ter planilha e Activesoft)
      IF p_source = 'planilha' THEN
        INSERT INTO student_external_ids (institution_id, student_id, source, external_id)
        VALUES (p_institution_id, v_student, 'planilha', v_mat) ON CONFLICT (institution_id, source, external_id) DO NOTHING;
      ELSIF v_ext IS NOT NULL THEN
        INSERT INTO student_external_ids (institution_id, student_id, source, external_id)
        VALUES (p_institution_id, v_student, 'activesoft', v_ext) ON CONFLICT (institution_id, source, external_id) DO NOTHING;
        IF v_found_by = 'matricula' AND EXISTS (SELECT 1 FROM student_external_ids
             WHERE student_id = v_student AND source = 'planilha') THEN
          v_crossed := v_crossed + 1;
        END IF;
      END IF;

      -- responsável (opcional, só com nomes liberados). CPF só como HMAC.
      IF NULLIF(btrim(r->>'responsavel'), '') IS NOT NULL THEN
        v_hmac := NULL;
        IF NULLIF(btrim(r->>'cpf_responsavel'), '') IS NOT NULL THEN
          BEGIN v_hmac := base_cpf_hmac(r->>'cpf_responsavel');
          EXCEPTION WHEN others THEN v_cpf_skip := v_cpf_skip + 1; END;
        END IF;
        v_key := COALESCE(NULLIF(r->>'responsavel_external_id', ''), v_mat);
        SELECT id INTO v_guard FROM guardians WHERE institution_id = p_institution_id AND source = p_source AND external_id = v_key;
        IF v_guard IS NULL THEN
          INSERT INTO guardians (institution_id, full_name, name_key, cpf_hmac, cpf_last2, phone_raw, phone_norm, source, external_id)
          VALUES (p_institution_id, btrim(r->>'responsavel'), lower(unaccent(btrim(r->>'responsavel'))), v_hmac,
                  CASE WHEN v_hmac IS NOT NULL THEN right(regexp_replace(r->>'cpf_responsavel', '\D', '', 'g'), 2) END,
                  NULLIF(btrim(r->>'responsavel_telefone'), ''), base_phone_norm(r->>'responsavel_telefone'),
                  p_source, v_key)
          RETURNING id INTO v_guard;
        ELSE
          UPDATE guardians SET full_name = btrim(r->>'responsavel'), name_key = lower(unaccent(btrim(r->>'responsavel'))),
                 cpf_hmac = COALESCE(v_hmac, cpf_hmac),
                 phone_raw  = COALESCE(NULLIF(btrim(r->>'responsavel_telefone'), ''), phone_raw),
                 phone_norm = COALESCE(base_phone_norm(r->>'responsavel_telefone'), phone_norm),
                 updated_at = now()
           WHERE id = v_guard;
        END IF;
        INSERT INTO student_guardians (institution_id, student_id, guardian_id, role, is_primary, source)
        VALUES (p_institution_id, v_student, v_guard, 'responsavel', true, p_source)
        ON CONFLICT (student_id, guardian_id, role) DO NOTHING;
      END IF;

      -- enturmação do ano: uma por aluno e ano (reenvio atualiza, não duplica)
      SELECT * INTO v_enr FROM class_enrollments
       WHERE student_id = v_student AND academic_year = v_year
       ORDER BY (status = 'remanejado'), last_seen_at DESC LIMIT 1;
      IF v_enr.id IS NULL THEN
        INSERT INTO class_enrollments (institution_id, student_id, academic_year, class_id, grade_level_id, status, raw_status,
                                       source, status_changed_at)
        VALUES (p_institution_id, v_student, v_year, v_class, v_grade, v_status, btrim(r->>'situacao'), p_source, now());
        INSERT INTO student_status_events (institution_id, student_id, academic_year, from_status, to_status, event_date,
                                           date_source, source, reason_detail)
        VALUES (p_institution_id, v_student, v_year, NULL, v_status, (now() AT TIME ZONE 'America/Sao_Paulo')::date,
                'detectado_na_carga', p_source, btrim(r->>'situacao'));
        v_new := v_new + 1;
      ELSE
        -- divergência entre fontes: só aviso (a carga atual vale)
        IF v_enr.source <> p_source AND (v_enr.status IS DISTINCT FROM v_status OR v_enr.grade_level_id IS DISTINCT FROM v_grade) THEN
          v_div := v_div + 1;
          IF jsonb_array_length(v_div_sample) < 30 THEN
            v_div_sample := v_div_sample || jsonb_build_object('matricula', v_mat, 'ano', v_year,
              'antes', concat_ws(' · ', (SELECT name FROM school_grade_levels WHERE id = v_enr.grade_level_id), v_enr.raw_status, v_enr.source),
              'agora', concat_ws(' · ', (SELECT name FROM school_grade_levels WHERE id = v_grade), btrim(r->>'situacao'), p_source));
          END IF;
        END IF;
        IF v_enr.status IS DISTINCT FROM v_status OR v_enr.grade_level_id IS DISTINCT FROM v_grade
           OR v_enr.class_id IS DISTINCT FROM v_class OR v_enr.raw_status IS DISTINCT FROM btrim(r->>'situacao')
           OR v_enr.source <> p_source THEN
          UPDATE class_enrollments SET grade_level_id = v_grade, class_id = v_class, status = v_status,
                 raw_status = btrim(r->>'situacao'), source = p_source, last_seen_at = now(), missing_runs = 0,
                 status_changed_at = CASE WHEN status IS DISTINCT FROM v_status THEN now() ELSE status_changed_at END
           WHERE id = v_enr.id;
          IF v_enr.status IS DISTINCT FROM v_status THEN
            INSERT INTO student_status_events (institution_id, student_id, academic_year, class_enrollment_id, from_status, to_status,
                                               event_date, date_source, source, reason_detail)
            VALUES (p_institution_id, v_student, v_year, v_enr.id, v_enr.status, v_status,
                    (now() AT TIME ZONE 'America/Sao_Paulo')::date, 'detectado_na_carga', p_source, btrim(r->>'situacao'));
            v_changed := v_changed + 1;
          END IF;
          v_upd := v_upd + 1;
        ELSE
          UPDATE class_enrollments SET last_seen_at = now(), missing_runs = 0 WHERE id = v_enr.id;
          v_same := v_same + 1;
        END IF;
      END IF;
    END LOOP;

    -- cobertura: a fonte desta carga passa a ser a dos anos tocados
    INSERT INTO student_base_coverage (institution_id, academic_year, source, level, last_loaded_at, last_run_id, seal, seal_reason)
    SELECT p_institution_id, y, p_source, 'aluno', now(), p_run_id, 'parcial',
           CASE p_source WHEN 'planilha' THEN 'planilha enviada pela escola' ELSE 'carga do Activesoft' END
      FROM unnest(v_years) y
    ON CONFLICT (institution_id, academic_year) DO UPDATE
      SET source = EXCLUDED.source, level = 'aluno', last_loaded_at = now(), last_run_id = EXCLUDED.last_run_id,
          seal = 'parcial', seal_reason = EXCLUDED.seal_reason;

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
      'fonte', p_source,
      'linhas_lidas', v_read, 'alunos_novos_no_ano', v_new, 'atualizados', v_upd, 'sem_mudanca', v_same,
      'mudancas_de_situacao', v_changed, 'alunos_novos_na_base', v_new_students, 'cruzados_pela_matricula', v_crossed,
      'divergencias', v_div, 'divergencias_amostra', v_div_sample,
      'nomes_descartados', v_names_dropped, 'nomes_liberados', v_names,
      'anos', to_jsonb(v_years), 'series_reconhecidas_pela_sequencia', v_seq,
      'ignoradas', v_ignored, 'series_nao_reconhecidas', v_unk_grade, 'situacoes_nao_reconhecidas', v_unk_status,
      'cpf_ignorado_sem_segredo', v_cpf_skip, 'cruzamento', v_cross, 'previa', p_dry_run);

    IF p_dry_run THEN RAISE EXCEPTION 'BASE_PREVIA' USING ERRCODE = 'P0099'; END IF;

    IF p_run_id IS NOT NULL THEN
      UPDATE sync_runs SET
        status = CASE WHEN jsonb_array_length(v_ignored) > 0 OR v_unk_grade <> '{}'::jsonb OR v_unk_status <> '{}'::jsonb OR v_div > 0
                      THEN 'ok_com_avisos' ELSE 'ok' END,
        finished_at = now(), step = 'gravado',
        counts = counts || jsonb_build_object('lidas', v_read, 'novos', v_new, 'atualizados', v_upd, 'sem_mudanca', v_same,
                                              'divergencias', v_div, 'cruzados_pela_matricula', v_crossed),
        summary = v_cross
       WHERE id = p_run_id;
      v_run := p_run_id;
    ELSE
      INSERT INTO sync_runs (institution_id, source, kind, status, triggered_by, started_at, finished_at, counts, summary)
      VALUES (p_institution_id, p_source, 'planilha',
              CASE WHEN jsonb_array_length(v_ignored) > 0 OR v_unk_grade <> '{}'::jsonb OR v_unk_status <> '{}'::jsonb OR v_div > 0
                   THEN 'ok_com_avisos' ELSE 'ok' END,
              COALESCE(auth.uid()::text, 'sistema'), now(), now(),
              jsonb_build_object('lidas', v_read, 'novos', v_new, 'atualizados', v_upd, 'sem_mudanca', v_same,
                                 'divergencias', v_div, 'arquivo', p_file_name),
              v_cross)
      RETURNING id INTO v_run;
    END IF;
    v_summary := v_summary || jsonb_build_object('run_id', v_run);
  EXCEPTION WHEN SQLSTATE 'P0099' THEN
    NULL;  -- prévia: tudo desfeito, o resumo já está em v_summary
  END;
  RETURN v_summary;
END $$;
REVOKE ALL ON FUNCTION public.base_import_rows(uuid, int, jsonb, boolean, text, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.base_erp_rows(p_institution_id uuid, p_run_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
  WITH c AS (SELECT unit_filter FROM erp_connections WHERE institution_id = p_institution_id AND provider = 'activesoft'),
  e AS (
    SELECT s.data AS ent, t.data AS tur, a.data AS alu,
           (SELECT jsonb_build_object('nome', g.data->>'nome', 'telefone', g.data->>'telefone') FROM erp_staging v JOIN erp_staging g
                ON g.run_id = v.run_id AND g.entity = 'responsavel' AND g.external_id = v.data->>'responsavel_id'
             WHERE v.run_id = s.run_id AND v.entity = 'vinculo' AND v.data->>'aluno_id' = s.data->>'aluno_id'
             ORDER BY (v.data->>'principal') = 'true' DESC NULLS LAST LIMIT 1) AS resp
      FROM erp_staging s
      LEFT JOIN erp_staging t ON t.run_id = s.run_id AND t.entity = 'turma' AND t.external_id = s.data->>'turma_id'
      LEFT JOIN erp_staging a ON a.run_id = s.run_id AND a.entity = 'aluno' AND a.external_id = s.data->>'aluno_id'
     WHERE s.run_id = p_run_id AND s.institution_id = p_institution_id AND s.entity = 'enturmacao'
  ),
  f AS (
    SELECT e.*, base_erp_serie_key(e.tur, e.ent) AS serie_key,
           COALESCE(e.tur->>'serie_nome', e.ent->>'serie_nome') AS serie_nome,
           COALESCE(e.tur->>'curso_nome', e.ent->>'curso_nome') AS curso_nome,
           COALESCE(NULLIF(e.ent->>'ano', ''), NULLIF(e.tur->>'ano', '')) AS ano,
           COALESCE(e.tur->>'unidade_id', e.ent->>'unidade_id') AS unidade_id
      FROM e
  )
  SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'linha', n,
           'matricula', COALESCE(NULLIF(f.alu->>'matricula', ''), NULLIF(f.ent->>'matricula', '')),
           'external_id', f.ent->>'aluno_id',
           'nome', f.alu->>'nome',
           'responsavel', f.resp->>'nome',
           'responsavel_telefone', f.resp->>'telefone',
           'segmento', f.curso_nome,
           'serie', f.serie_nome,
           'ano', f.ano,
           'turma', COALESCE(f.tur->>'nome', f.ent->>'turma_nome'),
           'turma_external_id', f.ent->>'turma_id',
           'situacao', COALESCE(NULLIF(f.ent->>'situacao', ''),
                                CASE f.ent->>'situacao_sistema' WHEN 'A' THEN 'Cursando' WHEN 'P' THEN 'Pré-matrícula' END,
                                f.ent->>'situacao_sistema'),
           'grade_level_id', (SELECT al.grade_level_id FROM school_grade_aliases al
                               WHERE al.institution_id = p_institution_id AND al.source = 'activesoft'
                                 AND (al.external_id = f.serie_key OR al.external_name = concat_ws(' / ', f.curso_nome, f.serie_nome))
                               LIMIT 1)
         )) ORDER BY f.ordem), '[]'::jsonb)
    FROM (SELECT f.*, row_number() OVER () AS n,
                 -- a enturmação ativa por último: é a que vale no ano
                 (CASE WHEN f.ent->>'situacao_sistema' = 'A' THEN 1 ELSE 0 END) AS ordem
            FROM f, c
           WHERE c.unit_filter IS NULL OR f.unidade_id IS NULL OR f.unidade_id = ANY (c.unit_filter)) f
$$;
REVOKE ALL ON FUNCTION public.base_erp_rows(uuid, uuid) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.base_reenrollment_list(uuid, int);
CREATE FUNCTION public.base_reenrollment_list(p_institution_id uuid, p_target_year int)
RETURNS TABLE (student_id uuid, registration_code text, student_name text, guardian_name text, category text,
               prev_grade text, prev_status_text text, dest_grade_id uuid, dest_grade text, cur_status_text text,
               declared_note text, declared_at timestamptz, origins text[], guardian_phone text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT base_user_can_see_list(p_institution_id) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  PERFORM base_require_module(p_institution_id);
  RETURN QUERY
  SELECT r.student_id, r.registration_code, r.student_name, r.guardian_name, r.category,
         pg.name, r.prev_status_text, r.dest_grade_id, dg.name, r.cur_status_text, o.note, o.marked_at,
         (SELECT array_agg(DISTINCT x.source ORDER BY x.source) FROM student_external_ids x WHERE x.student_id = r.student_id),
         (SELECT COALESCE(g.phone_norm, g.phone_raw) FROM student_guardians sg JOIN guardians g ON g.id = sg.guardian_id
           WHERE sg.student_id = r.student_id ORDER BY sg.is_primary DESC LIMIT 1)
    FROM v_base_reenrollment r
    LEFT JOIN school_grade_levels pg ON pg.id = r.prev_grade_id
    LEFT JOIN school_grade_levels dg ON dg.id = r.dest_grade_id
    LEFT JOIN reenrollment_overrides o ON o.institution_id = r.institution_id AND o.target_year = r.target_year AND o.student_id = r.student_id
   WHERE r.institution_id = p_institution_id AND r.target_year = p_target_year
   ORDER BY dg.sort_order NULLS LAST, r.student_name;
END $$;
REVOKE ALL ON FUNCTION public.base_reenrollment_list(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_reenrollment_list(uuid, int) TO authenticated;
