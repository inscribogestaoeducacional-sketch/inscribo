-- ============================================================================
-- 20261014100000_etapa_c_activesoft.sql — Etapa C, passo 1.
-- Activesoft (só leitura) + origem do aluno + trava de nomes por escola.
-- NÃO APLICADA. Ensaio: supabase/pendentes/etapa_c_activesoft_ensaio.sql.
--
--   * Núcleo único de gravação (base_import_rows) para planilha e Activesoft:
--     cruza pela matrícula (e pelo id do Activesoft), atualiza e não duplica.
--     Divergência de situação/série entre fontes só gera aviso (a carga mais
--     nova vale). Cada aluno guarda a(s) origem(ns) em student_external_ids.
--   * Activesoft: a edge function erp-activesoft-sync lê as 7 rotas permitidas
--     (paginação de 25, fila retomável em sync_runs.step/step_offset) e grava
--     só campos permitidos em erp_staging. Nada vai para a base antes da
--     confirmação da escola (base_erp_preview → base_erp_apply).
--   * Nomes (aluno e responsável): o banco descarta enquanto o Super Admin não
--     marcar o aditivo da LGPD assinado (student_base_settings.names_allowed),
--     mesmo que a caixa "Guardar nomes" venha marcada. Nomes já gravados ficam.
-- ============================================================================

-- ── 1. Trava de nomes (aditivo LGPD) ────────────────────────────────────────
ALTER TABLE public.student_base_settings
  ADD COLUMN IF NOT EXISTS names_allowed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.base_names_allowed(p_institution_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (user_is_school_member(p_institution_id) OR is_super_admin_user())
     AND COALESCE((SELECT names_allowed FROM student_base_settings WHERE institution_id = p_institution_id), false)
$$;
REVOKE ALL ON FUNCTION public.base_names_allowed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_names_allowed(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.base_set_names_allowed(p_institution_id uuid, p_allowed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT is_super_admin_user() THEN RAISE EXCEPTION 'Só o Super Admin registra o aditivo da LGPD' USING ERRCODE = '42501'; END IF;
  INSERT INTO student_base_settings (institution_id, names_allowed, updated_by, updated_at)
  VALUES (p_institution_id, p_allowed, auth.uid(), now())
  ON CONFLICT (institution_id) DO UPDATE SET names_allowed = EXCLUDED.names_allowed, updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO audit_logs (institution_id, module, record_id, action, field_changed, new_value, user_id, user_name, user_role)
  SELECT p_institution_id, 'integracoes', p_institution_id, 'Aditivo LGPD (nomes da base)', 'names_allowed', p_allowed::text, u.id, u.full_name, u.role
    FROM users u WHERE u.id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.base_set_names_allowed(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_set_names_allowed(uuid, boolean) TO authenticated;

-- ── 2. Núcleo de gravação (planilha e Activesoft) ───────────────────────────
-- p_rows: [{ linha, matricula, nome?, responsavel?, cpf_responsavel?, segmento?, serie, ano?, turma?, situacao,
--            external_id? (id do aluno no Activesoft), grade_level_id? (série já resolvida), turma_external_id? }]
-- Interna: sem EXECUTE para o navegador; quem chama confere papel e módulo.
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
        r := r - 'responsavel' - 'cpf_responsavel';
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
          INSERT INTO guardians (institution_id, full_name, name_key, cpf_hmac, cpf_last2, source, external_id)
          VALUES (p_institution_id, btrim(r->>'responsavel'), lower(unaccent(btrim(r->>'responsavel'))), v_hmac,
                  CASE WHEN v_hmac IS NOT NULL THEN right(regexp_replace(r->>'cpf_responsavel', '\D', '', 'g'), 2) END,
                  p_source, v_key)
          RETURNING id INTO v_guard;
        ELSE
          UPDATE guardians SET full_name = btrim(r->>'responsavel'), name_key = lower(unaccent(btrim(r->>'responsavel'))),
                 cpf_hmac = COALESCE(v_hmac, cpf_hmac), updated_at = now()
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

-- A planilha passa a usar o núcleo (mesma assinatura de antes).
CREATE OR REPLACE FUNCTION public.base_import_roster(p_institution_id uuid, p_default_year int, p_rows jsonb,
                                                    p_dry_run boolean DEFAULT true, p_file_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT base_user_can_read(p_institution_id) THEN
    RAISE EXCEPTION 'Sem permissão para enviar a base desta escola' USING ERRCODE = '42501';
  END IF;
  PERFORM base_require_module(p_institution_id);
  RETURN base_import_rows(p_institution_id, p_default_year, p_rows, p_dry_run, p_file_name, 'planilha', NULL);
END $$;

-- ── 3. Origem na lista nominal ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.base_reenrollment_list(uuid, int);
CREATE FUNCTION public.base_reenrollment_list(p_institution_id uuid, p_target_year int)
RETURNS TABLE (student_id uuid, registration_code text, student_name text, guardian_name text, category text,
               prev_grade text, prev_status_text text, dest_grade_id uuid, dest_grade text, cur_status_text text,
               declared_note text, declared_at timestamptz, origins text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT base_user_can_see_list(p_institution_id) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  PERFORM base_require_module(p_institution_id);
  RETURN QUERY
  SELECT r.student_id, r.registration_code, r.student_name, r.guardian_name, r.category,
         pg.name, r.prev_status_text, r.dest_grade_id, dg.name, r.cur_status_text, o.note, o.marked_at,
         (SELECT array_agg(DISTINCT x.source ORDER BY x.source) FROM student_external_ids x WHERE x.student_id = r.student_id)
    FROM v_base_reenrollment r
    LEFT JOIN school_grade_levels pg ON pg.id = r.prev_grade_id
    LEFT JOIN school_grade_levels dg ON dg.id = r.dest_grade_id
    LEFT JOIN reenrollment_overrides o ON o.institution_id = r.institution_id AND o.target_year = r.target_year AND o.student_id = r.student_id
   WHERE r.institution_id = p_institution_id AND r.target_year = p_target_year
   ORDER BY dg.sort_order NULLS LAST, r.student_name;
END $$;
REVOKE ALL ON FUNCTION public.base_reenrollment_list(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_reenrollment_list(uuid, int) TO authenticated;

-- ── 4. Activesoft: conexão, fila e área de espera ───────────────────────────
ALTER TABLE public.erp_connections
  ADD COLUMN IF NOT EXISTS api_base_url text NOT NULL DEFAULT 'https://siga.activesoft.com.br/api/v0',
  ADD COLUMN IF NOT EXISTS auth_scheme  text CHECK (auth_scheme IS NULL OR auth_scheme IN ('Bearer', 'Token')),
  ADD COLUMN IF NOT EXISTS unit_filter  text[],                 -- unidades incluídas (nulo = todas)
  ADD COLUMN IF NOT EXISTS fields_seen  jsonb NOT NULL DEFAULT '{}'::jsonb,   -- só NOMES de campos por rota (teste)
  ADD COLUMN IF NOT EXISTS last_test_at timestamptz;
-- Endereço só do Activesoft (o token nunca vai para outro servidor)
ALTER TABLE public.erp_connections DROP CONSTRAINT IF EXISTS erp_connections_api_base_url_check;
ALTER TABLE public.erp_connections ADD CONSTRAINT erp_connections_api_base_url_check
  CHECK (api_base_url ~ '^https://([a-z0-9-]+\.)*activesoft\.com\.br(/[A-Za-z0-9._/-]*)?$');

GRANT SELECT (institution_id, provider, token_last4, token_expires_at, status, scopes_ok, allowed_periods,
              last_success_at, last_error_at, last_error, nightly_enabled, created_at, updated_at,
              api_base_url, auth_scheme, unit_filter, fields_seen, last_test_at)
  ON public.erp_connections TO authenticated;

ALTER TABLE public.sync_runs DROP CONSTRAINT IF EXISTS sync_runs_status_check;
ALTER TABLE public.sync_runs ADD CONSTRAINT sync_runs_status_check
  CHECK (status IN ('na_fila', 'rodando', 'aguardando_confirmacao', 'ok', 'ok_com_avisos', 'erro', 'cancelada'));

-- Área de espera da carga: só campos permitidos, já normalizados pela edge
-- function (nada de JSON cru). Apagada ao gravar ou cancelar.
CREATE TABLE IF NOT EXISTS public.erp_staging (
  run_id          uuid NOT NULL REFERENCES public.sync_runs(id) ON DELETE CASCADE,
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  entity          text NOT NULL CHECK (entity IN ('unidade', 'curso', 'turma', 'enturmacao', 'aluno', 'responsavel', 'vinculo')),
  external_id     text NOT NULL,
  data            jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, entity, external_id)
);
ALTER TABLE public.erp_staging ENABLE ROW LEVEL SECURITY;   -- sem política: só service role e funções
REVOKE ALL ON public.erp_staging FROM anon, authenticated;

-- Token para a edge function (só service role).
CREATE OR REPLACE FUNCTION public.erp_connection_token(p_institution_id uuid, p_provider text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.decrypted_secret FROM erp_connections c JOIN vault.decrypted_secrets s ON s.id = c.token_secret_id
   WHERE c.institution_id = p_institution_id AND c.provider = p_provider
$$;
REVOKE ALL ON FUNCTION public.erp_connection_token(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_connection_token(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.base_erp_require_admin(p_institution_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT base_user_is_admin(p_institution_id) THEN
    RAISE EXCEPTION 'Só o administrador da escola mexe na integração' USING ERRCODE = '42501';
  END IF;
  PERFORM base_require_module(p_institution_id);
END $$;
REVOKE ALL ON FUNCTION public.base_erp_require_admin(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.base_erp_set_base_url(p_institution_id uuid, p_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM base_erp_require_admin(p_institution_id);
  UPDATE erp_connections SET api_base_url = rtrim(btrim(p_url), '/'), auth_scheme = NULL, scopes_ok = '{}'::jsonb, updated_at = now()
   WHERE institution_id = p_institution_id AND provider = 'activesoft';
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadastre o token primeiro'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.base_erp_set_base_url(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_erp_set_base_url(uuid, text) TO authenticated;

-- Inicia (ou retoma) a leitura. A 1ª carga é "só contagem"; nenhuma grava sem confirmação.
CREATE OR REPLACE FUNCTION public.base_erp_start(p_institution_id uuid, p_include_names boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_run uuid; v_kind text;
BEGIN
  PERFORM base_erp_require_admin(p_institution_id);
  IF NOT EXISTS (SELECT 1 FROM erp_connections WHERE institution_id = p_institution_id AND provider = 'activesoft'
                   AND token_secret_id IS NOT NULL AND auth_scheme IS NOT NULL) THEN
    RAISE EXCEPTION 'Conecte o token e passe no teste antes da carga';
  END IF;
  SELECT id INTO v_run FROM sync_runs
   WHERE institution_id = p_institution_id AND source = 'activesoft' AND status IN ('na_fila', 'rodando', 'aguardando_confirmacao')
   ORDER BY queued_at DESC LIMIT 1;
  IF v_run IS NOT NULL THEN RETURN v_run; END IF;
  v_kind := CASE WHEN EXISTS (SELECT 1 FROM sync_runs WHERE institution_id = p_institution_id AND source = 'activesoft'
                                AND status IN ('ok', 'ok_com_avisos')) THEN 'completa' ELSE 'dry_run_contagem' END;
  INSERT INTO sync_runs (institution_id, source, kind, status, triggered_by, step, step_offset, counts)
  VALUES (p_institution_id, 'activesoft', v_kind, 'na_fila', COALESCE(auth.uid()::text, 'sistema'), 'unidades', 0,
          -- nomes: caixa marcada E aditivo registrado (a edge function lê daqui)
          jsonb_build_object('guardar_nomes', p_include_names AND COALESCE((SELECT names_allowed FROM student_base_settings WHERE institution_id = p_institution_id), false)))
  RETURNING id INTO v_run;
  RETURN v_run;
END $$;
REVOKE ALL ON FUNCTION public.base_erp_start(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_erp_start(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.base_erp_cancel(p_institution_id uuid, p_run_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM base_erp_require_admin(p_institution_id);
  UPDATE sync_runs SET status = 'cancelada', finished_at = now()
   WHERE id = p_run_id AND institution_id = p_institution_id AND source = 'activesoft'
     AND status IN ('na_fila', 'rodando', 'aguardando_confirmacao', 'erro');
  DELETE FROM erp_staging WHERE run_id = p_run_id AND institution_id = p_institution_id;
END $$;
REVOKE ALL ON FUNCTION public.base_erp_cancel(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_erp_cancel(uuid, uuid) TO authenticated;

-- Chave da série no Activesoft: id da série (ou o nome, se a API não trouxer id)
CREATE OR REPLACE FUNCTION public.base_erp_serie_key(p_turma jsonb, p_ent jsonb)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(NULLIF(p_turma->>'serie_id', ''), NULLIF(p_ent->>'serie_id', ''),
                  concat_ws(' / ', NULLIF(COALESCE(p_turma->>'curso_nome', p_ent->>'curso_nome'), ''),
                                   COALESCE(p_turma->>'serie_nome', p_ent->>'serie_nome')))
$$;

-- Enturmações da área de espera → linhas do núcleo (com unidades e apelidos de série aplicados)
CREATE OR REPLACE FUNCTION public.base_erp_rows(p_institution_id uuid, p_run_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
  WITH c AS (SELECT unit_filter FROM erp_connections WHERE institution_id = p_institution_id AND provider = 'activesoft'),
  e AS (
    SELECT s.data AS ent, t.data AS tur, a.data AS alu,
           (SELECT g.data->>'nome' FROM erp_staging v JOIN erp_staging g
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
           'responsavel', f.resp,
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

-- Tela de mapeamento: unidades, séries (com a série da escola escolhida) e anos
CREATE OR REPLACE FUNCTION public.base_erp_mapping(p_institution_id uuid, p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE v jsonb;
BEGIN
  PERFORM base_erp_require_admin(p_institution_id);
  WITH c AS (SELECT unit_filter, fields_seen FROM erp_connections WHERE institution_id = p_institution_id AND provider = 'activesoft'),
  e AS (
    SELECT s.data AS ent, t.data AS tur FROM erp_staging s
      LEFT JOIN erp_staging t ON t.run_id = s.run_id AND t.entity = 'turma' AND t.external_id = s.data->>'turma_id'
     WHERE s.run_id = p_run_id AND s.institution_id = p_institution_id AND s.entity = 'enturmacao'
  ),
  ser AS (
    SELECT base_erp_serie_key(tur, ent) AS serie_key,
           max(COALESCE(tur->>'serie_nome', ent->>'serie_nome')) AS serie_nome,
           max(COALESCE(tur->>'curso_nome', ent->>'curso_nome')) AS curso_nome,
           count(*) AS enturmacoes
      FROM e GROUP BY 1
  )
  SELECT jsonb_build_object(
    'run', (SELECT jsonb_build_object('id', id, 'kind', kind, 'status', status, 'step', step, 'counts', counts, 'error', error)
              FROM sync_runs WHERE id = p_run_id AND institution_id = p_institution_id),
    'unidades', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', u.external_id, 'nome', u.data->>'nome',
                    'enturmacoes', (SELECT count(*) FROM e WHERE COALESCE(e.tur->>'unidade_id', e.ent->>'unidade_id') = u.external_id),
                    'incluida', (SELECT unit_filter IS NULL OR u.external_id = ANY (unit_filter) FROM c)) ORDER BY u.data->>'nome')
                  FROM erp_staging u WHERE u.run_id = p_run_id AND u.institution_id = p_institution_id AND u.entity = 'unidade'), '[]'::jsonb),
    'cursos', (SELECT count(*) FROM erp_staging WHERE run_id = p_run_id AND institution_id = p_institution_id AND entity = 'curso'),
    'turmas', (SELECT count(*) FROM erp_staging WHERE run_id = p_run_id AND institution_id = p_institution_id AND entity = 'turma'),
    'alunos', (SELECT count(*) FROM erp_staging WHERE run_id = p_run_id AND institution_id = p_institution_id AND entity = 'aluno'),
    'series', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                    'serie_key', ser.serie_key, 'serie_nome', ser.serie_nome, 'curso_nome', ser.curso_nome, 'enturmacoes', ser.enturmacoes,
                    'grade_level_id', COALESCE(al.grade_level_id, auto.id),
                    'como', CASE WHEN al.grade_level_id IS NOT NULL THEN 'escolhida' WHEN auto.id IS NOT NULL THEN 'automatica' END)
                  ORDER BY COALESCE(gs.sort_order, 999), ser.curso_nome, ser.serie_nome)
                FROM ser
                LEFT JOIN LATERAL (SELECT grade_level_id FROM school_grade_aliases a
                                    WHERE a.institution_id = p_institution_id AND a.source = 'activesoft'
                                      AND (a.external_id = ser.serie_key OR a.external_name = concat_ws(' / ', ser.curso_nome, ser.serie_nome))
                                    LIMIT 1) al ON true
                LEFT JOIN LATERAL (SELECT COALESCE(base_match_grade(p_institution_id, concat_ws(' ', ser.curso_nome, ser.serie_nome)),
                                                   base_match_grade(p_institution_id, ser.serie_nome)) AS id) auto ON true
                LEFT JOIN school_grade_levels gs ON gs.id = COALESCE(al.grade_level_id, auto.id)), '[]'::jsonb),
    'anos', COALESCE((SELECT jsonb_object_agg(ano, n) FROM (
                SELECT COALESCE(NULLIF(ent->>'ano', ''), NULLIF(tur->>'ano', ''), 'sem ano') AS ano, count(*) AS n FROM e GROUP BY 1) x), '{}'::jsonb),
    'campos', (SELECT fields_seen FROM c)
  ) INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.base_erp_mapping(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_erp_mapping(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.base_erp_set_units(p_institution_id uuid, p_unit_ids text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM base_erp_require_admin(p_institution_id);
  UPDATE erp_connections SET unit_filter = p_unit_ids, updated_at = now()
   WHERE institution_id = p_institution_id AND provider = 'activesoft';
END $$;
REVOKE ALL ON FUNCTION public.base_erp_set_units(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_erp_set_units(uuid, text[]) TO authenticated;

-- Série do Activesoft → série da escola (nulo = volta ao automático)
CREATE OR REPLACE FUNCTION public.base_erp_set_grade(p_institution_id uuid, p_serie_key text, p_serie_label text, p_grade_level_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM base_erp_require_admin(p_institution_id);
  DELETE FROM school_grade_aliases
   WHERE institution_id = p_institution_id AND source = 'activesoft' AND (external_id = p_serie_key OR external_name = p_serie_label);
  IF p_grade_level_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM school_grade_levels WHERE id = p_grade_level_id AND institution_id = p_institution_id) THEN
      RAISE EXCEPTION 'Série não pertence à escola' USING ERRCODE = '42501';
    END IF;
    INSERT INTO school_grade_aliases (institution_id, grade_level_id, source, external_id, external_name)
    VALUES (p_institution_id, p_grade_level_id, 'activesoft', p_serie_key, p_serie_label);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.base_erp_set_grade(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_erp_set_grade(uuid, text, text, uuid) TO authenticated;

-- Contagem (não grava) e gravação depois da confirmação
CREATE OR REPLACE FUNCTION public.base_erp_preview(p_institution_id uuid, p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM base_erp_require_admin(p_institution_id);
  IF NOT EXISTS (SELECT 1 FROM sync_runs WHERE id = p_run_id AND institution_id = p_institution_id
                   AND source = 'activesoft' AND status = 'aguardando_confirmacao') THEN
    RAISE EXCEPTION 'A leitura do Activesoft ainda não terminou';
  END IF;
  RETURN base_import_rows(p_institution_id, extract(year FROM now())::int, base_erp_rows(p_institution_id, p_run_id),
                          true, 'Activesoft', 'activesoft', NULL);
END $$;
REVOKE ALL ON FUNCTION public.base_erp_preview(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_erp_preview(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.base_erp_apply(p_institution_id uuid, p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v jsonb;
BEGIN
  PERFORM base_erp_require_admin(p_institution_id);
  IF NOT EXISTS (SELECT 1 FROM sync_runs WHERE id = p_run_id AND institution_id = p_institution_id
                   AND source = 'activesoft' AND status = 'aguardando_confirmacao') THEN
    RAISE EXCEPTION 'Esta carga não está aguardando confirmação';
  END IF;
  v := base_import_rows(p_institution_id, extract(year FROM now())::int, base_erp_rows(p_institution_id, p_run_id),
                        false, 'Activesoft', 'activesoft', p_run_id);
  DELETE FROM erp_staging WHERE run_id = p_run_id;
  UPDATE erp_connections SET status = 'ativa', last_success_at = now(), last_error = NULL, updated_at = now()
   WHERE institution_id = p_institution_id AND provider = 'activesoft';
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.base_erp_apply(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_erp_apply(uuid, uuid) TO authenticated;
