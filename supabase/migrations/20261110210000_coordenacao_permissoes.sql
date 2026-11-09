-- Perfil de coordenação: consultor com permissão por módulo.
-- 'concurso' libera o Concurso de Bolsas inteiro; 'matriculometro' libera só a leitura do Matriculômetro.
create or replace function public.contest_user_can_manage(p_institution_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.is_super_admin_user() or exists (
    select 1 from users u
     where u.id = auth.uid() and coalesce(u.active, true)
       and p_institution_id in (u.institution_id, u.active_institution_id)
       and (
         u.role in ('admin','manager')
         or exists (select 1 from user_permissions p where p.user_id = u.id and p.institution_id = p_institution_id and p.module = 'concurso' and p.enabled)
       )
       and exists (select 1 from contest_settings s where s.institution_id = p_institution_id and s.module_enabled)
  )
$$;

create or replace function public.matriculometro_user_can_see(p_inst uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from users u
      join user_permissions p on p.user_id = u.id and p.institution_id = p_inst and p.module = 'matriculometro' and p.enabled
     where u.id = auth.uid() and coalesce(u.active, true)
       and p_inst in (u.institution_id, u.active_institution_id)
  )
$$;

create or replace function public.matriculometro_year(p_inst uuid)
returns int language plpgsql stable security definer set search_path to 'public' as $$
declare y int;
begin
  if not (base_is_system() or base_user_can_see_list(p_inst) or matriculometro_user_can_see(p_inst)
          or exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin','manager') and p_inst in (u.institution_id, u.active_institution_id))) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  select coalesce(target_school_year, year) into y from campaign_cycles
   where institution_id = p_inst and status <> 'archived' order by created_at desc limit 1;
  return y;
end $$;
revoke all on function public.matriculometro_year(uuid) from public, anon;
grant execute on function public.matriculometro_year(uuid) to authenticated;

do $$
declare f text; n text;
begin
  foreach n in array array['campaign_matriculometro','campaign_class_students'] loop
    select pg_get_functiondef(p.oid) into f from pg_proc p where p.proname = n and p.pronamespace = 'public'::regnamespace;
    f := replace(f, 'base_user_can_see_list(p_inst)', 'base_user_can_see_list(p_inst) OR matriculometro_user_can_see(p_inst)');
    execute f;
  end loop;
end $$;
