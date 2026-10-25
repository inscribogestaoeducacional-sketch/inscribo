create or replace function public.school_erp_get() returns text language sql stable security definer set search_path=public as $$
  select s.declared_erp from student_base_settings s join users u on u.institution_id = s.institution_id where u.id = auth.uid() $$;
create or replace function public.school_erp_declare(p_name text) returns void language plpgsql security definer set search_path=public as $$
declare v_inst uuid; v_role text;
begin
  select institution_id, role into v_inst, v_role from users where id = auth.uid();
  if v_inst is null or v_role not in ('admin','manager') then raise exception 'sem permissão'; end if;
  insert into student_base_settings(institution_id, declared_erp, updated_by, updated_at) values (v_inst, nullif(btrim(p_name),''), auth.uid(), now())
  on conflict (institution_id) do update set declared_erp = nullif(btrim(p_name),''), updated_by = auth.uid(), updated_at = now();
end $$;
grant execute on function public.school_erp_get() to authenticated;
grant execute on function public.school_erp_declare(text) to authenticated;
