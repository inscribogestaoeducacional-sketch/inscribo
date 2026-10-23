-- O campo "novato_considerando_periodo_anterior" veio verdadeiro para todos os alunos do Ágape: não é confiável, não é guardado.
DO $mig$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.base_import_rows(uuid,integer,jsonb,boolean,text,text,uuid)'::regprocedure);
  IF position($$base_parse_bool(r->>'novato')$$ in d) = 0 THEN RAISE EXCEPTION 'base_import_rows mudou'; END IF;
  d := replace(d, $$base_parse_bool(r->>'novato')$$, $$NULL::boolean$$);
  EXECUTE d;
END $mig$;
UPDATE class_enrollments SET is_new_student = NULL WHERE is_new_student IS NOT NULL;
