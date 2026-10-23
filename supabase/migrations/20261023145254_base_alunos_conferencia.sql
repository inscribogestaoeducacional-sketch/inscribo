-- Conferência da base: quantos alunos o sistema mostra "cursando" por série x quantos a secretaria diz que existem.
CREATE TABLE IF NOT EXISTS public.base_headcount_checks (
  institution_id uuid NOT NULL,
  academic_year  integer NOT NULL,
  grade_level_id uuid NOT NULL,
  secretary_count integer,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, academic_year, grade_level_id)
);
ALTER TABLE public.base_headcount_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.base_headcount_checks FROM anon;

CREATE OR REPLACE FUNCTION public.base_headcount(p_institution_id uuid, p_year integer)
RETURNS TABLE(grade_level_id uuid, grade_name text, sort_order integer, studying bigint, left_school bigint, concluded bigint,
              prev_studying bigint, prev_left bigint, secretary_count integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT base_user_can_see_list(p_institution_id) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  PERFORM base_require_module(p_institution_id);
  RETURN QUERY
  SELECT g.id, g.name, g.sort_order,
         count(DISTINCT e.student_id) FILTER (WHERE e.academic_year = p_year AND e.status = 'ativo'),
         count(DISTINCT e.student_id) FILTER (WHERE e.academic_year = p_year AND e.status IN ('transferido', 'cancelado', 'desistente')),
         count(DISTINCT e.student_id) FILTER (WHERE e.academic_year = p_year AND e.status = 'concluido'),
         count(DISTINCT e.student_id) FILTER (WHERE e.academic_year = p_year - 1 AND e.status IN ('ativo', 'concluido')),
         count(DISTINCT e.student_id) FILTER (WHERE e.academic_year = p_year - 1 AND e.status IN ('transferido', 'cancelado', 'desistente')),
         h.secretary_count
    FROM school_grade_levels g
    LEFT JOIN class_enrollments e ON e.grade_level_id = g.id AND e.institution_id = g.institution_id AND e.academic_year IN (p_year, p_year - 1)
    LEFT JOIN base_headcount_checks h ON h.institution_id = g.institution_id AND h.academic_year = p_year AND h.grade_level_id = g.id
   WHERE g.institution_id = p_institution_id AND COALESCE(g.active, true)
   GROUP BY g.id, g.name, g.sort_order, h.secretary_count
   ORDER BY g.sort_order, g.name;
END
$fn$;
REVOKE ALL ON FUNCTION public.base_headcount(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_headcount(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.base_set_headcount(p_institution_id uuid, p_year integer, p_grade_level_id uuid, p_count integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT base_user_can_read(p_institution_id) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  PERFORM base_require_module(p_institution_id);
  IF NOT EXISTS (SELECT 1 FROM school_grade_levels WHERE id = p_grade_level_id AND institution_id = p_institution_id) THEN
    RAISE EXCEPTION 'Série não pertence à escola' USING ERRCODE = '42501';
  END IF;
  INSERT INTO base_headcount_checks (institution_id, academic_year, grade_level_id, secretary_count, updated_by)
  VALUES (p_institution_id, p_year, p_grade_level_id, p_count, auth.uid())
  ON CONFLICT (institution_id, academic_year, grade_level_id) DO UPDATE
    SET secretary_count = EXCLUDED.secretary_count, updated_by = EXCLUDED.updated_by, updated_at = now();
END
$fn$;
REVOKE ALL ON FUNCTION public.base_set_headcount(uuid, integer, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_set_headcount(uuid, integer, uuid, integer) TO authenticated;
