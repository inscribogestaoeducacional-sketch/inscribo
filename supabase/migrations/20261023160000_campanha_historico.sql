-- Campanha de Matrículas: histórico da escola (base, retenção, novos, mês a mês, por série e por turma).
-- Lê só class_enrollments/students/turmas, então vale para qualquer origem (Activesoft, planilha, digitado).

CREATE OR REPLACE FUNCTION public.campaign_history_year(p_inst uuid, y int)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r jsonb;
BEGIN
  WITH prev AS (
    SELECT DISTINCT ON (e.student_id) e.student_id, e.grade_level_id, e.class_id, e.status,
           COALESCE(g.is_terminal, false) AS terminal
      FROM class_enrollments e
      LEFT JOIN school_grade_levels g ON g.id = e.grade_level_id
     WHERE e.institution_id = p_inst AND e.academic_year = y - 1 AND e.status <> 'remanejado'
     ORDER BY e.student_id, e.last_seen_at DESC
  ), cur AS (
    SELECT DISTINCT student_id FROM class_enrollments
     WHERE institution_id = p_inst AND academic_year = y AND status <> 'remanejado'
  ), base AS (
    SELECT p.*, (c.student_id IS NOT NULL) AS ret
      FROM prev p LEFT JOIN cur c ON c.student_id = p.student_id
     WHERE p.status IN ('ativo','concluido','pre_matricula') AND NOT p.terminal
  ), conc AS (
    SELECT count(*) AS n FROM prev WHERE terminal AND status IN ('ativo','concluido')
  ), saiu AS (
    SELECT count(*) AS n FROM prev WHERE status IN ('transferido','cancelado','desistente')
  ), nov AS (
    SELECT e.student_id, e.grade_level_id
      FROM class_enrollments e JOIN students s ON s.id = e.student_id
     WHERE e.institution_id = p_inst AND e.academic_year = y AND e.status <> 'remanejado'
       AND COALESCE(s.first_year, y) = y
     GROUP BY e.student_id, e.grade_level_id
  ), mes AS (
    SELECT to_char(e.enrolled_at, 'YYYY-MM') AS m,
           count(DISTINCT e.student_id) FILTER (WHERE COALESCE(s.first_year, y) = y) AS novos,
           count(DISTINCT e.student_id) FILTER (WHERE COALESCE(s.first_year, y) <> y) AS rematriculas
      FROM class_enrollments e JOIN students s ON s.id = e.student_id
     WHERE e.institution_id = p_inst AND e.academic_year = y AND e.enrolled_at IS NOT NULL
       AND e.status NOT IN ('pre_matricula','remanejado')
     GROUP BY 1
  ), gr AS (
    SELECT g.id, g.name, g.segment, g.sort_order,
           COALESCE(b.base, 0) AS base, COALESCE(b.ret, 0) AS retained, COALESCE(n.novos, 0) AS novos
      FROM school_grade_levels g
      LEFT JOIN (SELECT grade_level_id, count(*) AS base, count(*) FILTER (WHERE ret) AS ret FROM base GROUP BY 1) b ON b.grade_level_id = g.id
      LEFT JOIN (SELECT grade_level_id, count(*) AS novos FROM nov GROUP BY 1) n ON n.grade_level_id = g.id
     WHERE g.institution_id = p_inst AND COALESCE(g.active, true)
  ), cl AS (
    SELECT min(c.id::text)::uuid AS id, c.name, c.grade_level_id, count(*) AS base, count(*) FILTER (WHERE b.ret) AS retained
      FROM base b JOIN school_classes c ON c.id = b.class_id
     GROUP BY c.name, c.grade_level_id
  )
  SELECT jsonb_build_object(
    'year', y,
    'base', (SELECT count(*) FROM base),
    'retained', (SELECT count(*) FROM base WHERE ret),
    'lost', (SELECT count(*) FROM base WHERE NOT ret),
    'graduates', (SELECT n FROM conc),
    'left_during_year', (SELECT n FROM saiu),
    'new_students', (SELECT count(*) FROM nov),
    'total_students', (SELECT count(*) FROM cur),
    'monthly', COALESCE((SELECT jsonb_agg(jsonb_build_object('m', m, 'novos', novos, 'rematriculas', rematriculas) ORDER BY m) FROM mes), '[]'::jsonb),
    'by_grade', COALESCE((SELECT jsonb_agg(jsonb_build_object('grade_id', id, 'name', name, 'segment', segment, 'sort_order', sort_order,
                'base', base, 'retained', retained, 'lost', base - retained, 'new_students', novos) ORDER BY sort_order) FROM gr WHERE base > 0 OR novos > 0), '[]'::jsonb),
    'by_class', COALESCE((SELECT jsonb_agg(jsonb_build_object('class_id', id, 'name', name, 'grade_id', grade_level_id,
                'base', base, 'retained', retained, 'lost', base - retained) ORDER BY name) FROM cl), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.campaign_history_year(uuid, int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.campaign_history(p_institution_id uuid, p_target_year int, p_years int DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  y int; v jsonb := '[]'::jsonb; h jsonb;
BEGIN
  IF NOT (base_is_system() OR base_user_can_see_list(p_institution_id)) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  FOR y IN SELECT g FROM generate_series(p_target_year - GREATEST(p_years, 1), p_target_year - 1) g LOOP
    h := campaign_history_year(p_institution_id, y);
    IF (h->>'base')::int > 0 THEN v := v || jsonb_build_array(h); END IF;
  END LOOP;
  RETURN jsonb_build_object('target_year', p_target_year, 'years', v);
END $$;

GRANT EXECUTE ON FUNCTION public.campaign_history(uuid, int, int) TO authenticated;
