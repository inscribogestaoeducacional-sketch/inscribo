-- Quem sai no ano novo (transferido/cancelado/desistente, sem matrícula nem pré ativa) deixa de contar como "falta" e vira "saiu".
-- Aplicado via MCP (CREATE OR REPLACE, sem DROP).
CREATE OR REPLACE FUNCTION public.campaign_matriculometro(p_inst uuid, p_year integer)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
    SELECT e.student_id, bool_or(e.status = 'ativo') AS matr, bool_or(e.status = 'pre_matricula') AS pre,
           bool_or(e.status IN ('transferido','cancelado','desistente')) AS exited
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
           count(*) FILTER (WHERE NOT COALESCE(cu.matr, false) AND COALESCE(cu.pre, false)) AS pre,
           count(*) FILTER (WHERE NOT COALESCE(cu.matr, false) AND NOT COALESCE(cu.pre, false) AND COALESCE(cu.exited, false)) AS saiu
      FROM prev p
      JOIN school_classes c ON c.id = p.class_id
      LEFT JOIN school_grade_levels g ON g.id = c.grade_level_id
      LEFT JOIN cur cu ON cu.student_id = p.student_id
     WHERE segs IS NULL OR g.segment = ANY(segs)
     GROUP BY c.name, g.name, g.segment, g.sort_order
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('turma', t.turma, 'serie', t.serie, 'segment', t.segment,
         'base', t.base, 'matriculados', t.matriculados, 'pre', t.pre, 'saiu', t.saiu,
         'ly_base', l.ly_base, 'ly_mesmo_dia', l.ly_matr_mesmo_dia, 'ly_final', l.ly_matr_final) ORDER BY t.segment, t.sort_order, t.turma), '[]'::jsonb) INTO r
    FROM t LEFT JOIN ly l ON l.turma = t.turma AND l.serie IS NOT DISTINCT FROM t.serie;
  SELECT jsonb_build_object(
    'ly_final', (SELECT count(DISTINCT student_id) FROM class_enrollments WHERE institution_id = p_inst AND academic_year = p_year - 1 AND status = 'ativo'),
    'ly_mesmo_dia', (SELECT count(DISTINCT student_id) FROM class_enrollments WHERE institution_id = p_inst AND academic_year = p_year - 1 AND status IN ('ativo','concluido','transferido') AND enrolled_at IS NOT NULL AND enrolled_at::date <= d1),
    'hoje_matriculados', (SELECT count(DISTINCT student_id) FROM class_enrollments WHERE institution_id = p_inst AND academic_year = p_year AND status = 'ativo'),
    'hoje_pre', (SELECT count(DISTINCT student_id) FROM class_enrollments e WHERE institution_id = p_inst AND academic_year = p_year AND status = 'pre_matricula'
                   AND NOT EXISTS (SELECT 1 FROM class_enrollments x WHERE x.institution_id = p_inst AND x.academic_year = p_year AND x.status = 'ativo' AND x.student_id = e.student_id)),
    'dia_comparado', d1) INTO resumo;
  IF segs IS NOT NULL THEN
    SELECT jsonb_build_object(
      'ly_final', COALESCE(sum((x->>'ly_final')::int), 0), 'ly_mesmo_dia', COALESCE(sum((x->>'ly_mesmo_dia')::int), 0),
      'hoje_matriculados', COALESCE(sum((x->>'matriculados')::int), 0), 'hoje_pre', COALESCE(sum((x->>'pre')::int), 0),
      'dia_comparado', d1) INTO resumo FROM jsonb_array_elements(r) x;
  END IF;
  RETURN jsonb_build_object('year', p_year, 'turmas', r, 'resumo', resumo);
END $function$;

CREATE OR REPLACE FUNCTION public.coordinator_dashboard(p_inst uuid, p_year integer)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare segs text[]; r jsonb;
begin
  if not (base_is_system() or matriculometro_user_can_see(p_inst)
          or exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin','manager') and p_inst in (u.institution_id, u.active_institution_id))) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  segs := coordinator_segs(p_inst);
  with prev as (
    select distinct on (e.student_id) e.student_id, e.class_id
      from class_enrollments e left join school_grade_levels g on g.id = e.grade_level_id
     where e.institution_id = p_inst and e.academic_year = p_year - 1 and e.status in ('ativo','concluido','pre_matricula')
       and not coalesce(g.is_terminal, false)
     order by e.student_id, case e.status when 'ativo' then 0 else 1 end, e.last_seen_at desc
  ), cur as (
    select e.student_id, bool_or(e.status = 'ativo') matr, bool_or(e.status = 'pre_matricula') pre,
           bool_or(e.status in ('transferido','cancelado','desistente')) exited
      from class_enrollments e where e.institution_id = p_inst and e.academic_year = p_year and e.status <> 'remanejado' group by 1
  ), base as (
    select p.student_id, c.name turma, g.name serie, g.segment, g.sort_order,
           coalesce(cu.matr, false) matr, (not coalesce(cu.matr, false) and coalesce(cu.pre, false)) pre,
           (not coalesce(cu.matr, false) and not coalesce(cu.pre, false) and coalesce(cu.exited, false)) saiu
      from prev p join school_classes c on c.id = p.class_id
      left join school_grade_levels g on g.id = c.grade_level_id
      left join cur cu on cu.student_id = p.student_id
     where segs is null or g.segment = any(segs)
  ), turmas as (
    select turma, serie, segment, sort_order, count(*) base, count(*) filter (where matr) matriculados, count(*) filter (where pre) pre, count(*) filter (where saiu) saiu
      from base group by 1,2,3,4
  ), faltam as (
    select s.full_name, b.turma, b.serie, b.segment, b.sort_order, b.pre
      from base b join students s on s.id = b.student_id where not b.matr and not b.saiu
     order by b.sort_order, b.turma, s.full_name limit 800
  ), ent as (
    select distinct on (e.student_id) e.student_id, s.full_name, g.name serie, g.segment, c.name turma, e.status, e.enrolled_at, g.sort_order, s.former_student,
           exists (select 1 from class_enrollments p where p.institution_id = p_inst and p.student_id = e.student_id and p.academic_year = p_year - 1 and p.status in ('ativo','concluido','pre_matricula')) vet,
           exists (select 1 from class_enrollments x where x.institution_id = p_inst and x.student_id = e.student_id and x.academic_year < p_year and x.status <> 'remanejado') antes
      from class_enrollments e join students s on s.id = e.student_id
      left join school_classes c on c.id = e.class_id
      left join school_grade_levels g on g.id = coalesce(c.grade_level_id, e.grade_level_id)
     where e.institution_id = p_inst and e.academic_year = p_year and e.status in ('ativo','pre_matricula')
       and (segs is null or g.segment = any(segs))
     order by e.student_id, case e.status when 'ativo' then 0 else 1 end
  ), novos as (
    select * from ent where not vet and not antes and not former_student
  ), voltaram as (
    select * from ent where not vet and (antes or former_student)
  )
  select jsonb_build_object(
    'year', p_year, 'segments', coalesce(to_jsonb(segs), '[]'::jsonb),
    'turmas', (select coalesce(jsonb_agg(jsonb_build_object('turma', t.turma, 'serie', t.serie, 'segment', t.segment, 'base', t.base, 'matriculados', t.matriculados, 'pre', t.pre, 'saiu', t.saiu) order by t.segment, t.sort_order, t.turma), '[]'::jsonb) from turmas t),
    'faltam', (select coalesce(jsonb_agg(jsonb_build_object('nome', f.full_name, 'turma', f.turma, 'serie', f.serie, 'segment', f.segment, 'pre', f.pre) order by f.sort_order, f.turma, f.full_name), '[]'::jsonb) from faltam f),
    'novos', (select coalesce(jsonb_agg(jsonb_build_object('nome', n.full_name, 'turma', n.turma, 'serie', n.serie, 'segment', n.segment, 'status', n.status, 'data', n.enrolled_at) order by n.sort_order, n.full_name), '[]'::jsonb) from novos n),
    'voltaram', (select coalesce(jsonb_agg(jsonb_build_object('nome', n.full_name, 'turma', n.turma, 'serie', n.serie, 'segment', n.segment, 'status', n.status, 'data', n.enrolled_at) order by n.sort_order, n.full_name), '[]'::jsonb) from voltaram n)
  ) into r;
  return r;
end $function$;
