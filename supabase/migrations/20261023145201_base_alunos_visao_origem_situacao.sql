-- Base de alunos: lista única com origem (rematrícula / novato / ex-aluno que voltou),
-- situação (matriculado / pré-matriculado) e a data da matrícula, para filtrar por período.
CREATE OR REPLACE FUNCTION public.base_students_overview(p_institution_id uuid, p_target_year integer)
RETURNS TABLE(student_id uuid, registration_code text, student_name text, guardian_name text, guardian_phone text,
              category text, origin text, state text, grade_id uuid, grade_name text, grade_sort integer, prev_grade text,
              cur_status_text text, enrolled_on date, date_is_estimate boolean, erp_new boolean,
              declared_note text, declared_at timestamptz, origins text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT base_user_can_see_list(p_institution_id) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  PERFORM base_require_module(p_institution_id);
  RETURN QUERY
  SELECT r.student_id, r.registration_code, r.student_name, r.guardian_name,
         (SELECT COALESCE(g.phone_norm, g.phone_raw) FROM student_guardians sg JOIN guardians g ON g.id = sg.guardian_id
           WHERE sg.student_id = r.student_id ORDER BY sg.is_primary DESC LIMIT 1),
         r.category,
         CASE WHEN r.category = 'rematriculado_declarado' THEN 'rematricula'
              WHEN c.status IN ('ativo', 'pre_matricula') THEN
                CASE WHEN p.status IN ('concluido', 'ativo', 'pre_matricula') THEN 'rematricula'
                     WHEN p.status IN ('transferido', 'cancelado', 'desistente') THEN 'ex_aluno'
                     WHEN EXISTS (SELECT 1 FROM class_enrollments o WHERE o.student_id = r.student_id AND o.academic_year < p_target_year - 1) THEN 'ex_aluno'
                     ELSE 'novato' END
         END,
         CASE WHEN r.category = 'rematriculado_declarado' THEN 'matriculado'
              WHEN c.status = 'ativo' THEN 'matriculado'
              WHEN c.status = 'pre_matricula' THEN 'pre_matriculado' END,
         r.dest_grade_id, dg.name, dg.sort_order, pg.name, r.cur_status_text,
         CASE WHEN c.id IS NOT NULL THEN COALESCE(c.enrolled_at, (c.first_seen_at AT TIME ZONE 'America/Sao_Paulo')::date)
              WHEN o.marked_at IS NOT NULL THEN (o.marked_at AT TIME ZONE 'America/Sao_Paulo')::date END,
         (c.id IS NOT NULL AND c.enrolled_at IS NULL) OR (c.id IS NULL AND o.marked_at IS NOT NULL),
         c.is_new_student, o.note, o.marked_at,
         (SELECT array_agg(DISTINCT x.source ORDER BY x.source) FROM student_external_ids x WHERE x.student_id = r.student_id)
    FROM v_base_reenrollment r
    LEFT JOIN school_grade_levels pg ON pg.id = r.prev_grade_id
    LEFT JOIN school_grade_levels dg ON dg.id = r.dest_grade_id
    LEFT JOIN reenrollment_overrides o ON o.institution_id = r.institution_id AND o.target_year = r.target_year AND o.student_id = r.student_id
    LEFT JOIN LATERAL (SELECT e.* FROM class_enrollments e WHERE e.student_id = r.student_id AND e.academic_year = p_target_year
                        ORDER BY (e.status = 'remanejado'), e.last_seen_at DESC LIMIT 1) c ON true
    LEFT JOIN LATERAL (SELECT e.* FROM class_enrollments e WHERE e.student_id = r.student_id AND e.academic_year = p_target_year - 1
                        ORDER BY (e.status = 'remanejado'), e.last_seen_at DESC LIMIT 1) p ON true
   WHERE r.institution_id = p_institution_id AND r.target_year = p_target_year
   ORDER BY dg.sort_order NULLS LAST, r.student_name;
END
$fn$;
GRANT EXECUTE ON FUNCTION public.base_students_overview(uuid, integer) TO authenticated;
