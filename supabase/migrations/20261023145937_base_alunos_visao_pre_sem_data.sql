-- Pré-matrícula sem data de efetivação fica sem data (não usa a data em que foi vista pela primeira vez).
DO $mig$
DECLARE d text; a text;
BEGIN
  d := pg_get_functiondef('public.base_students_overview(uuid,integer)'::regprocedure);
  a := $$CASE WHEN c.id IS NOT NULL THEN COALESCE(c.enrolled_at, (c.first_seen_at AT TIME ZONE 'America/Sao_Paulo')::date)$$;
  IF position(a in d) = 0 THEN RAISE EXCEPTION 'base_students_overview mudou'; END IF;
  d := replace(d, a, $$CASE WHEN c.id IS NOT NULL AND c.status = 'pre_matricula' AND c.enrolled_at IS NULL THEN NULL
              WHEN c.id IS NOT NULL THEN COALESCE(c.enrolled_at, (c.first_seen_at AT TIME ZONE 'America/Sao_Paulo')::date)$$);
  d := replace(d, $$(c.id IS NOT NULL AND c.enrolled_at IS NULL) OR$$, $$(c.id IS NOT NULL AND c.enrolled_at IS NULL AND c.status <> 'pre_matricula') OR$$);
  EXECUTE d;
END $mig$;
