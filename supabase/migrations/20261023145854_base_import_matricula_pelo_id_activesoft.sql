-- Aluno que saiu da escola deixa de vir em lista_alunos (sem matrícula): usa a matrícula já guardada pelo id da Activesoft.
DO $mig$
DECLARE d text; a text;
BEGIN
  d := pg_get_functiondef('public.base_import_rows(uuid,integer,jsonb,boolean,text,text,uuid)'::regprocedure);
  a := $$v_year := COALESCE(substring(r->>'ano' from '(20[0-9]{2})')::int, p_default_year);$$;
  IF position(a in d) = 0 THEN RAISE EXCEPTION 'base_import_rows mudou'; END IF;
  d := replace(d, a, a || $$
      IF v_mat IS NULL AND v_ext IS NOT NULL AND p_source = 'activesoft' THEN
        SELECT s.registration_code INTO v_mat FROM student_external_ids x JOIN students s ON s.id = x.student_id
         WHERE x.institution_id = p_institution_id AND x.source = 'activesoft' AND x.external_id = v_ext;
      END IF;$$);
  EXECUTE d;
END $mig$;
