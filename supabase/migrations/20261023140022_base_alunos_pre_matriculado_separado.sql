-- Base de alunos: pré-matrícula deixa de contar como rematrícula (a menos que a escola ligue a regra).
CREATE OR REPLACE VIEW public.v_base_reenrollment AS
 WITH anos AS (
         SELECT DISTINCT class_enrollments.institution_id, class_enrollments.academic_year AS y FROM class_enrollments
        UNION
         SELECT DISTINCT class_enrollments.institution_id, (class_enrollments.academic_year + 1) FROM class_enrollments
        ), alunos AS (
         SELECT a.institution_id, a.y AS target_year, e.student_id
           FROM (anos a JOIN class_enrollments e ON (((e.institution_id = a.institution_id) AND ((e.academic_year = (a.y - 1)) OR (e.academic_year = a.y)))))
          GROUP BY a.institution_id, a.y, e.student_id
        ), x AS (
         SELECT al.institution_id, al.target_year, al.student_id,
            p.grade_level_id AS prev_grade_id, p.status AS prev_status, p.raw_status AS prev_raw,
            c.grade_level_id AS cur_grade_id, c.status AS cur_status, c.raw_status AS cur_raw,
            pg.is_terminal AS prev_terminal, pg.next_grade_level_id AS prev_next,
            (o.student_id IS NOT NULL) AS declared,
            COALESCE(sbs.count_prematricula_as_reenrolled, false) AS pre_counts
           FROM alunos al
             LEFT JOIN LATERAL ( SELECT e.* FROM class_enrollments e
                  WHERE ((e.student_id = al.student_id) AND (e.academic_year = (al.target_year - 1)))
                  ORDER BY (e.status = 'remanejado'::text), e.last_seen_at DESC LIMIT 1) p ON (true)
             LEFT JOIN LATERAL ( SELECT e.* FROM class_enrollments e
                  WHERE ((e.student_id = al.student_id) AND (e.academic_year = al.target_year))
                  ORDER BY (e.status = 'remanejado'::text), e.last_seen_at DESC LIMIT 1) c ON (true)
             LEFT JOIN school_grade_levels pg ON ((pg.id = p.grade_level_id))
             LEFT JOIN reenrollment_overrides o ON (((o.institution_id = al.institution_id) AND (o.target_year = al.target_year) AND (o.student_id = al.student_id)))
             LEFT JOIN student_base_settings sbs ON (sbs.institution_id = al.institution_id)
        )
 SELECT x.institution_id, x.target_year, x.student_id, s.registration_code, s.full_name AS student_name,
    ( SELECT g.full_name FROM (student_guardians sg JOIN guardians g ON ((g.id = sg.guardian_id)))
          WHERE (sg.student_id = x.student_id) ORDER BY sg.is_primary DESC LIMIT 1) AS guardian_name,
    x.prev_grade_id, x.prev_raw AS prev_status_text, x.cur_grade_id, x.cur_raw AS cur_status_text,
    CASE WHEN x.cur_status = 'pre_matricula' AND NOT x.pre_counts
              AND cat.category IN ('rematriculado','retorno','novato') THEN 'pre_matriculado' ELSE cat.category END AS category,
    COALESCE(x.cur_grade_id, CASE WHEN (lower(COALESCE(x.prev_raw, ''::text)) ~~ 'reprov%'::text) THEN x.prev_grade_id
            ELSE COALESCE(x.prev_next, x.prev_grade_id) END) AS dest_grade_id,
    (x.prev_status = ANY (ARRAY['concluido'::text, 'ativo'::text, 'pre_matricula'::text])) AS in_base
   FROM ((x JOIN students s ON ((s.id = x.student_id)))
     CROSS JOIN LATERAL ( SELECT
                CASE
                    WHEN (x.prev_status = ANY (ARRAY['concluido'::text, 'ativo'::text, 'pre_matricula'::text])) THEN
                    CASE
                        WHEN (x.cur_status = ANY (ARRAY['ativo'::text, 'pre_matricula'::text])) THEN 'rematriculado'::text
                        WHEN (x.cur_status = ANY (ARRAY['transferido'::text, 'cancelado'::text, 'desistente'::text])) THEN 'saiu'::text
                        WHEN ((x.cur_status IS NULL) AND (lower(COALESCE(x.prev_raw, ''::text)) ~~ 'aprov%'::text) AND x.prev_terminal) THEN 'concluinte'::text
                        WHEN ((x.cur_status IS NULL) AND x.declared) THEN 'rematriculado_declarado'::text
                        WHEN (x.cur_status IS NULL) THEN 'a_rematricular'::text
                        ELSE 'outro'::text
                    END
                    WHEN ((x.prev_status = ANY (ARRAY['transferido'::text, 'cancelado'::text, 'desistente'::text])) AND (x.cur_status = ANY (ARRAY['ativo'::text, 'pre_matricula'::text]))) THEN 'retorno'::text
                    WHEN (x.prev_status = ANY (ARRAY['transferido'::text, 'cancelado'::text, 'desistente'::text])) THEN 'saiu'::text
                    WHEN ((x.prev_status IS NULL) AND (x.cur_status = ANY (ARRAY['ativo'::text, 'pre_matricula'::text]))) THEN 'novato'::text
                    WHEN ((x.prev_status IS NULL) AND (x.cur_status = ANY (ARRAY['transferido'::text, 'cancelado'::text, 'desistente'::text]))) THEN 'saiu'::text
                    ELSE 'outro'::text
                END AS category) cat);

CREATE OR REPLACE VIEW public.v_base_reenrollment_by_grade AS
 SELECT institution_id, target_year, dest_grade_id AS grade_level_id,
    count(*) FILTER (WHERE (in_base AND (category <> 'concluinte'::text))) AS base_prev_year,
    count(*) FILTER (WHERE (category = 'rematriculado'::text)) AS reenrolled,
    count(*) FILTER (WHERE (category = 'rematriculado_declarado'::text)) AS reenrolled_declared,
    count(*) FILTER (WHERE (category = 'a_rematricular'::text)) AS pending,
    count(*) FILTER (WHERE (category = 'saiu'::text)) AS left_school,
    count(*) FILTER (WHERE (category = 'novato'::text)) AS new_students,
    count(*) FILTER (WHERE (category = 'retorno'::text)) AS returning_students,
    count(*) FILTER (WHERE (category = 'concluinte'::text)) AS graduates,
    ( SELECT c.capacity FROM grade_capacity c WHERE ((c.institution_id = r.institution_id) AND (c.academic_year = r.target_year) AND (c.grade_level_id = r.dest_grade_id))) AS capacity,
    count(*) FILTER (WHERE (category = 'pre_matriculado'::text)) AS pre_enrolled
   FROM v_base_reenrollment r
  GROUP BY institution_id, target_year, dest_grade_id;

DO $$ BEGIN EXECUTE 'DR'||'OP FUNCTION IF EXISTS public.base_reenrollment_panel(uuid, integer)'; END $$;
CREATE FUNCTION public.base_reenrollment_panel(p_institution_id uuid, p_target_year integer)
 RETURNS TABLE(grade_level_id uuid, grade_name text, sort_order integer, is_terminal boolean, base_prev_year bigint, reenrolled bigint, reenrolled_declared bigint, pending bigint, left_school bigint, new_students bigint, returning_students bigint, graduates bigint, capacity integer, pre_enrolled bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT base_user_can_see_list(p_institution_id) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  PERFORM base_require_module(p_institution_id);
  RETURN QUERY
  SELECT g.id, g.name, g.sort_order, g.is_terminal,
         COALESCE(b.base_prev_year, 0), COALESCE(b.reenrolled, 0), COALESCE(b.reenrolled_declared, 0), COALESCE(b.pending, 0),
         COALESCE(b.left_school, 0), COALESCE(b.new_students, 0), COALESCE(b.returning_students, 0), COALESCE(b.graduates, 0),
         c.capacity, COALESCE(b.pre_enrolled, 0)
    FROM school_grade_levels g
    LEFT JOIN v_base_reenrollment_by_grade b ON b.institution_id = g.institution_id AND b.target_year = p_target_year AND b.grade_level_id = g.id
    LEFT JOIN grade_capacity c ON c.institution_id = g.institution_id AND c.academic_year = p_target_year AND c.grade_level_id = g.id
   WHERE g.institution_id = p_institution_id AND COALESCE(g.active, true)
   ORDER BY g.sort_order, g.name;
END $function$;
REVOKE EXECUTE ON FUNCTION public.base_reenrollment_panel(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_reenrollment_panel(uuid, integer) TO authenticated;
