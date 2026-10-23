-- Saídas registradas na Activesoft (transferido/cancelado) e se já têm registro em Transferências (aplicado via MCP).
create or replace function public.transfers_erp_gap(p_inst uuid, p_year int)
returns jsonb language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb) from (
    select jsonb_build_object(
      'student_id', s.id, 'name', s.full_name, 'registration', s.registration_code,
      'grade', gl.name, 'status', ce.status, 'changed_at', ce.status_changed_at,
      'registered', exists (select 1 from student_transfers t where t.institution_id = p_inst and t.deleted_at is null
                            and lower(btrim(t.student_name)) = lower(btrim(s.full_name)))
    ) as x
    from class_enrollments ce
    join students s on s.id = ce.student_id
    left join school_grade_levels gl on gl.id = ce.grade_level_id
    where ce.institution_id = p_inst and ce.academic_year = p_year and ce.status in ('transferido','cancelado')
  ) q;
$$;
grant execute on function public.transfers_erp_gap(uuid, int) to authenticated;
