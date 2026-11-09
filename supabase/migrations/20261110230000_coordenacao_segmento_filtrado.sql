-- Coordenação: filtro por segmento no servidor para Matriculômetro e lista de turma, sem contato, e saídas no painel.
create or replace function public.coordinator_segs(p_inst uuid)
returns text[] language sql stable security definer set search_path to 'public' as $$
  select case
    when exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin','manager') and p_inst in (u.institution_id, u.active_institution_id)) then null
    else (select nullif(cs.segments, '{}') from coordinator_segments cs where cs.user_id = auth.uid() and cs.institution_id = p_inst)
  end $$;
revoke all on function public.coordinator_segs(uuid) from public, anon;
grant execute on function public.coordinator_segs(uuid) to authenticated;

create or replace function public.campaign_matriculometro(p_inst uuid, p_year integer)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
DECLARE r jsonb; resumo jsonb; segs text[] := coordinator_segs(p_inst); d1 date := ((now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '1 year')::date;
BEGIN
  IF NOT (base_is_system() OR base_user_can_see_list(p_inst) OR matriculometro_user_can_see(p_inst)) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  WITH prev AS (
    SELECT DISTINCT ON (e.student_id) e.student_id, e.class_id, e.grade_level_id
      FROM class_enrollments e LEFT JOIN school_grade_levels g ON g.id = e.grade_level_id
     WHERE e.institution_id = p_inst AND e.academic_year = p_year - 1 AND e.status IN ('ativo','concluido','pre_matricula')
       AND NOT COALESCE(g.is_terminal, false)
     ORDER BY e.student_id, CASE e.status WHEN 'ativo' THEN 0 ELSE 1 END, e.last_seen_at DESC
  ), cur AS (
    SELECT e.student_id, bool_or(e.status = 'ativo') AS matr, bool_or(e.status = 'pre_matricula') AS pre
      FROM class_enrollments e WHERE e.institution_id = p_inst AND e.academic_year = p_year AND e.status <> 'remanejado'
     GROUP BY 1
  ), prev2 AS (
    SELECT DISTINCT ON (e.student_id) e.student_id, c.name AS turma, g.name AS serie
      FROM class_enrollments e JOIN school_classes c ON c.id = e.class_id
      LEFT JOIN school_grade_levels g ON g.id = c.grade_level_id
     WHERE e.institution_id = p_inst AND e.academic_year = p_year - 2 AND e.status IN ('ativo','concluido','pre_matricula')
       AND NOT COALESCE(g.is_terminal, false)
     ORDER BY e.student_id, CASE e.status WHEN 'ativo' THEN 0 ELSE 1 END, e.last_seen_at DESC
  ), cur1 AS (
    SELECT e.student_id,
           bool_or(e.status = 'ativo') AS matr_final,
           bool_or(e.status IN ('ativo','concluido','transferido') AND e.enrolled_at IS NOT NULL AND e.enrolled_at::date <= d1) AS matr_mesmo_dia
      FROM class_enrollments e WHERE e.institution_id = p_inst AND e.academic_year = p_year - 1 AND e.status <> 'remanejado'
     GROUP BY 1
  ), ly AS (
    SELECT p.turma, p.serie, count(*) AS ly_base,
           count(*) FILTER (WHERE COALESCE(c.matr_mesmo_dia, false)) AS ly_matr_mesmo_dia,
           count(*) FILTER (WHERE COALESCE(c.matr_final, false)) AS ly_matr_final
      FROM prev2 p LEFT JOIN cur1 c ON c.student_id = p.student_id
     GROUP BY p.turma, p.serie
  ), t AS (
    SELECT c.name AS turma, g.name AS serie, g.segment, g.sort_order,
           count(*) AS base,
           count(*) FILTER (WHERE cu.matr) AS matriculados,
           count(*) FILTER (WHERE NOT COALESCE(cu.matr, false) AND COALESCE(cu.pre, false)) AS pre
      FROM prev p
      JOIN school_classes c ON c.id = p.class_id
      LEFT JOIN school_grade_levels g ON g.id = c.grade_level_id
      LEFT JOIN cur cu ON cu.student_id = p.student_id
     WHERE segs IS NULL OR g.segment = ANY(segs)
     GROUP BY c.name, g.name, g.segment, g.sort_order
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('turma', t.turma, 'serie', t.serie, 'segment', t.segment,
         'base', t.base, 'matriculados', t.matriculados, 'pre', t.pre,
         'ly_base', l.ly_base, 'ly_mesmo_dia', l.ly_matr_mesmo_dia, 'ly_final', l.ly_matr_final) ORDER BY t.segment, t.sort_order, t.turma), '[]'::jsonb) INTO r
    FROM t LEFT JOIN ly l ON l.turma = t.turma AND l.serie IS NOT DISTINCT FROM t.serie;
  SELECT jsonb_build_object(
    'ly_final', (SELECT count(DISTINCT student_id) FROM class_enrollments WHERE institution_id = p_inst AND academic_year = p_year - 1 AND status = 'ativo'),
    'ly_mesmo_dia', (SELECT count(DISTINCT student_id) FROM class_enrollments WHERE institution_id = p_inst AND academic_year = p_year - 1 AND status IN ('ativo','concluido','transferido') AND enrolled_at IS NOT NULL AND enrolled_at::date <= d1),
    'hoje_matriculados', (SELECT count(DISTINCT student_id) FROM class_enrollments WHERE institution_id = p_inst AND academic_year = p_year AND status = 'ativo'),
    'hoje_pre', (SELECT count(DISTINCT student_id) FROM class_enrollments e WHERE institution_id = p_inst AND academic_year = p_year AND status = 'pre_matricula'
                   AND NOT EXISTS (SELECT 1 FROM class_enrollments x WHERE x.institution_id = p_inst AND x.academic_year = p_year AND x.status = 'ativo' AND x.student_id = e.student_id)),
    'dia_comparado', d1) INTO resumo;
  -- Coordenador de segmento não recebe totais da escola toda: o resumo vem só das turmas dele.
  IF segs IS NOT NULL THEN
    SELECT jsonb_build_object(
      'ly_final', COALESCE(sum((x->>'ly_final')::int), 0), 'ly_mesmo_dia', COALESCE(sum((x->>'ly_mesmo_dia')::int), 0),
      'hoje_matriculados', COALESCE(sum((x->>'matriculados')::int), 0), 'hoje_pre', COALESCE(sum((x->>'pre')::int), 0),
      'dia_comparado', d1) INTO resumo FROM jsonb_array_elements(r) x;
  END IF;
  RETURN jsonb_build_object('year', p_year, 'turmas', r, 'resumo', resumo);
END $function$;

create or replace function public.campaign_class_students(p_inst uuid, p_year integer, p_turma text, p_serie text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
DECLARE r jsonb; segs text[] := coordinator_segs(p_inst); full_access boolean := (base_is_system() OR base_user_can_see_list(p_inst));
BEGIN
  IF NOT (full_access OR matriculometro_user_can_see(p_inst)) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  WITH prev AS (
    SELECT DISTINCT ON (e.student_id) e.student_id, c.name AS turma, g.name AS serie
      FROM class_enrollments e
      JOIN school_classes c ON c.id = e.class_id
      LEFT JOIN school_grade_levels g ON g.id = c.grade_level_id
     WHERE e.institution_id = p_inst AND e.academic_year = p_year - 1 AND e.status IN ('ativo','concluido','pre_matricula')
       AND NOT COALESCE(g.is_terminal, false)
       AND (p_turma IS NULL OR c.name = p_turma) AND (p_serie IS NULL OR g.name = p_serie)
       AND (segs IS NULL OR g.segment = ANY(segs))
     ORDER BY e.student_id, CASE e.status WHEN 'ativo' THEN 0 ELSE 1 END, e.last_seen_at DESC
  ), cur AS (
    SELECT e.student_id,
           bool_or(e.status = 'ativo') AS matr, bool_or(e.status = 'pre_matricula') AS pre,
           bool_or(e.status IN ('transferido','cancelado','desistente')) AS saiu
      FROM class_enrollments e WHERE e.institution_id = p_inst AND e.academic_year = p_year AND e.status <> 'remanejado' GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('student', s.full_name, 'turma', p.turma, 'serie', p.serie,
      'status', CASE WHEN cu.matr THEN 'matriculado' WHEN cu.pre THEN 'pre' WHEN cu.saiu THEN 'saiu' ELSE 'falta' END,
      'responsavel', CASE WHEN full_access THEN (SELECT gd.full_name FROM student_guardians sg JOIN guardians gd ON gd.id = sg.guardian_id WHERE sg.student_id = s.id ORDER BY sg.is_primary DESC NULLS LAST LIMIT 1) END,
      'telefone', CASE WHEN full_access THEN (SELECT gd.phone_norm FROM student_guardians sg JOIN guardians gd ON gd.id = sg.guardian_id WHERE sg.student_id = s.id AND gd.phone_norm IS NOT NULL ORDER BY sg.is_primary DESC NULLS LAST LIMIT 1) END)
      ORDER BY CASE WHEN cu.matr THEN 3 WHEN cu.pre THEN 2 WHEN cu.saiu THEN 4 ELSE 1 END, s.full_name), '[]'::jsonb)
    INTO r
    FROM prev p JOIN students s ON s.id = p.student_id LEFT JOIN cur cu ON cu.student_id = p.student_id;
  RETURN r;
END $function$;
