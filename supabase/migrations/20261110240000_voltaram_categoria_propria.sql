-- Quem já foi da escola e voltou ("Voltaram") passa a ser uma categoria própria em todas as escolas:
-- não conta como rematrícula nem como aluno novo. A opção por escola deixa de valer.
update public.student_base_settings set returning_counts_as_new = false where returning_counts_as_new is distinct from false;

create or replace function public.campaign_history_year(p_inst uuid, y integer)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
DECLARE
  r jsonb; pc boolean := COALESCE((SELECT s.count_prematricula_as_reenrolled FROM student_base_settings s WHERE s.institution_id = p_inst), false);
  mh campaign_manual_history%rowtype;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM class_enrollments WHERE institution_id = p_inst AND academic_year IN (y - 1, y)) THEN
    SELECT * INTO mh FROM campaign_manual_history WHERE institution_id = p_inst AND year = y;
    IF FOUND THEN
      RETURN jsonb_build_object('year', y, 'base', mh.base, 'retained', mh.retained, 'pre', 0, 'lost', mh.base - mh.retained,
        'graduates', mh.graduates, 'left_during_year', mh.left_during_year, 'new_students', mh.new_students,
        'total_students', mh.total_students, 'monthly', mh.monthly, 'by_grade', '[]'::jsonb, 'by_class', '[]'::jsonb, 'manual', true);
    END IF;
  END IF;
  WITH prev AS (
    SELECT DISTINCT ON (e.student_id) e.student_id, e.grade_level_id, e.class_id, e.status,
           COALESCE(g.is_terminal, false) AS terminal
      FROM class_enrollments e
      LEFT JOIN school_grade_levels g ON g.id = e.grade_level_id
     WHERE e.institution_id = p_inst AND e.academic_year = y - 1 AND e.status <> 'remanejado'
     ORDER BY e.student_id, e.last_seen_at DESC
  ), cur AS (
    SELECT e.student_id,
           bool_or(e.status <> 'pre_matricula') AS matr,
           bool_or(e.status = 'pre_matricula') AS has_pre
      FROM class_enrollments e
     WHERE e.institution_id = p_inst AND e.academic_year = y AND e.status <> 'remanejado'
     GROUP BY e.student_id
  ), base AS (
    SELECT p.*, COALESCE(c.matr, false) AS ret, (c.student_id IS NOT NULL AND NOT c.matr) AS pre_only
      FROM prev p LEFT JOIN cur c ON c.student_id = p.student_id
     WHERE p.status IN ('ativo','concluido','pre_matricula') AND NOT p.terminal
  ), conc AS (
    SELECT count(*) AS n FROM prev WHERE terminal AND status IN ('ativo','concluido')
  ), saiu AS (
    SELECT count(*) AS n FROM prev WHERE status IN ('transferido','cancelado','desistente')
  ), nov AS (
    SELECT e.student_id, e.grade_level_id
      FROM class_enrollments e JOIN students s ON s.id = e.student_id
     WHERE e.institution_id = p_inst AND e.academic_year = y AND e.status NOT IN ('remanejado','pre_matricula')
       AND NOT s.former_student AND NOT EXISTS (SELECT 1 FROM class_enrollments o WHERE o.student_id = s.id AND o.academic_year < y)
     GROUP BY e.student_id, e.grade_level_id
  ), mes AS (
    SELECT m, count(DISTINCT student_id) FILTER (WHERE pure_new) AS novos,
              count(DISTINCT student_id) FILTER (WHERE NOT pure_new AND NOT in_prev) AS voltaram,
              count(DISTINCT student_id) FILTER (WHERE NOT pure_new AND in_prev) AS rematriculas
      FROM (
        SELECT to_char(e.enrolled_at, 'YYYY-MM') AS m, e.student_id,
               (NOT s.former_student AND NOT EXISTS (SELECT 1 FROM class_enrollments o WHERE o.student_id = s.id AND o.academic_year < y)) AS pure_new,
               EXISTS (SELECT 1 FROM class_enrollments pb WHERE pb.student_id = s.id AND pb.academic_year = y - 1 AND pb.status IN ('ativo','concluido','pre_matricula')) AS in_prev
          FROM class_enrollments e JOIN students s ON s.id = e.student_id
         WHERE e.institution_id = p_inst AND e.academic_year = y AND e.enrolled_at IS NOT NULL
           AND e.status NOT IN ('pre_matricula','remanejado')
      ) z GROUP BY m
  ), gr AS (
    SELECT g.id, g.name, g.segment, g.sort_order,
           COALESCE(b.base, 0) AS base, COALESCE(b.ret, 0) AS retained, COALESCE(b.pre, 0) AS pre, COALESCE(n.novos, 0) AS novos
      FROM school_grade_levels g
      LEFT JOIN (SELECT grade_level_id, count(*) AS base, count(*) FILTER (WHERE ret) AS ret, count(*) FILTER (WHERE pre_only) AS pre FROM base GROUP BY 1) b ON b.grade_level_id = g.id
      LEFT JOIN (SELECT grade_level_id, count(*) AS novos FROM nov GROUP BY 1) n ON n.grade_level_id = g.id
     WHERE g.institution_id = p_inst AND COALESCE(g.active, true)
  ), cl AS (
    SELECT min(c.id::text)::uuid AS id, c.name, c.grade_level_id, count(*) AS base, count(*) FILTER (WHERE b.ret) AS retained, count(*) FILTER (WHERE b.pre_only) AS pre
      FROM base b JOIN school_classes c ON c.id = b.class_id
     GROUP BY c.name, c.grade_level_id
  )
  SELECT jsonb_build_object(
    'year', y,
    'base', (SELECT count(*) FROM base),
    'retained', (SELECT count(*) FROM base WHERE ret),
    'pre', (SELECT count(*) FROM base WHERE pre_only),
    'secured', (SELECT count(*) FROM base WHERE ret OR (pc AND pre_only)), 'pre_counts', pc, 'lost', (SELECT count(*) FROM base WHERE NOT ret AND NOT (pc AND pre_only)),
    'graduates', (SELECT n FROM conc),
    'left_during_year', (SELECT n FROM saiu),
    'new_students', (SELECT count(*) FROM nov), 'returning_as_new', false,
    'returning', (SELECT count(DISTINCT e.student_id) FROM class_enrollments e JOIN students s ON s.id = e.student_id
                   WHERE e.institution_id = p_inst AND e.academic_year = y AND e.status NOT IN ('remanejado','pre_matricula')
                     AND (s.former_student OR EXISTS (SELECT 1 FROM class_enrollments o WHERE o.student_id = s.id AND o.academic_year < y))
                     AND NOT EXISTS (SELECT 1 FROM class_enrollments pb WHERE pb.student_id = s.id AND pb.academic_year = y - 1 AND pb.status IN ('ativo','concluido','pre_matricula'))),
    'total_students', (SELECT count(*) FROM cur WHERE matr),
    'monthly', COALESCE((SELECT jsonb_agg(jsonb_build_object('m', m, 'novos', novos, 'rematriculas', rematriculas, 'voltaram', voltaram) ORDER BY m) FROM mes), '[]'::jsonb),
    'by_grade', COALESCE((SELECT jsonb_agg(jsonb_build_object('grade_id', id, 'name', name, 'segment', segment, 'sort_order', sort_order,
                'base', base, 'retained', retained, 'pre', pre, 'secured', retained + CASE WHEN pc THEN pre ELSE 0 END, 'lost', base - retained - CASE WHEN pc THEN pre ELSE 0 END, 'new_students', novos) ORDER BY sort_order) FROM gr WHERE base > 0 OR novos > 0), '[]'::jsonb),
    'by_class', COALESCE((SELECT jsonb_agg(jsonb_build_object('class_id', id, 'name', name, 'grade_id', grade_level_id,
                'base', base, 'retained', retained, 'pre', pre, 'secured', retained + CASE WHEN pc THEN pre ELSE 0 END, 'lost', base - retained - CASE WHEN pc THEN pre ELSE 0 END) ORDER BY name) FROM cl), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $function$;

create or replace function public.report_matriculas_base(p_inst uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
DECLARE v_ay int; v_prev_from date := p_from - (p_to - p_from + 1); v_prev_to date := p_from - 1; r jsonb;
BEGIN
  PERFORM _report_guard(p_inst);
  v_ay := extract(year from p_to)::int + CASE WHEN extract(month from p_to) >= 8 THEN 1 ELSE 0 END;
  IF NOT EXISTS (SELECT 1 FROM class_enrollments WHERE institution_id = p_inst AND academic_year = v_ay) THEN
    RETURN jsonb_build_object('has_base', false);
  END IF;
  WITH first_enr AS (
    SELECT e.student_id, min(e.enrolled_at)::date d
      FROM class_enrollments e
     WHERE e.institution_id = p_inst AND e.academic_year = v_ay AND e.status IN ('ativo','concluido','transferido','remanejado') AND e.enrolled_at IS NOT NULL
     GROUP BY e.student_id
  ), k AS (
    SELECT f.d,
      EXISTS (SELECT 1 FROM class_enrollments p WHERE p.institution_id = p_inst AND p.student_id = f.student_id AND p.academic_year = v_ay - 1 AND p.status IN ('ativo','concluido','pre_matricula')) AS veterano,
      (EXISTS (SELECT 1 FROM class_enrollments p WHERE p.institution_id = p_inst AND p.student_id = f.student_id AND p.academic_year < v_ay)
        OR EXISTS (SELECT 1 FROM students s WHERE s.id = f.student_id AND s.former_student)) AS ja_foi
    FROM first_enr f
  )
  SELECT jsonb_build_object('has_base', true, 'ano_letivo', v_ay,
    'total', (SELECT count(*) FROM k WHERE d BETWEEN p_from AND p_to),
    'novos', (SELECT count(*) FROM k WHERE d BETWEEN p_from AND p_to AND NOT veterano AND NOT ja_foi),
    'rematriculas', (SELECT count(*) FROM k WHERE d BETWEEN p_from AND p_to AND veterano),
    'voltaram', (SELECT count(*) FROM k WHERE d BETWEEN p_from AND p_to AND NOT veterano AND ja_foi),
    'anterior_total', (SELECT count(*) FROM k WHERE d BETWEEN v_prev_from AND v_prev_to),
    'dos_leads', (SELECT count(*) FROM enrollments x WHERE x.institution_id = p_inst AND x.cancelled_at IS NULL AND x.enrollment_date IS NOT NULL AND (x.enrollment_date AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to)
  ) INTO r;
  RETURN r;
END $function$;

-- Também aplicadas no projeto Supabase Edu (migration "coordenacao_voltaram_split"):
--   campaign_year_split(p_inst, p_year): veteranos / voltaram / novos / total dos matriculados do ano.
--   coordinator_dashboard(p_inst, p_year): passa a devolver a lista 'voltaram' e a separar novos de voltaram.
