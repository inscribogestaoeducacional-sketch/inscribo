-- Academia Áion Edu: progresso de cada pessoa nas aulas.
create table if not exists public.academy_progress (
  user_id uuid not null references public.users(id) on delete cascade,
  lesson_key text not null check (lesson_key ~ '^[a-z0-9_]{1,60}$'),
  institution_id uuid,
  done_at timestamptz not null default now(),
  undone_at timestamptz,
  primary key (user_id, lesson_key)
);
create index if not exists academy_progress_inst_idx on public.academy_progress (institution_id);
alter table public.academy_progress enable row level security;

drop policy if exists academy_progress_select on public.academy_progress;
create policy academy_progress_select on public.academy_progress for select to authenticated using (user_id = auth.uid());
-- escrita só pelas funções abaixo (security definer)

create or replace function public.academy_mark(p_lesson_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if p_lesson_key is null or p_lesson_key !~ '^[a-z0-9_]{1,60}$' then raise exception 'aula inválida'; end if;
  insert into academy_progress (user_id, lesson_key, institution_id)
  values (auth.uid(), p_lesson_key, public.current_user_institution_id())
  on conflict (user_id, lesson_key) do update set undone_at = null, done_at = now();
end $$;

create or replace function public.academy_unmark(p_lesson_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  update academy_progress set undone_at = now() where user_id = auth.uid() and lesson_key = p_lesson_key;
end $$;

-- Equipe: só administrador/gestor da escola vê quem estudou o quê (as pessoas daquela escola).
create or replace function public.academy_team()
returns table (user_id uuid, full_name text, role text, keys text[], last_at timestamptz, perms jsonb)
language plpgsql stable security definer set search_path = public as $$
declare inst uuid; me_role text;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  inst := public.current_user_institution_id();
  select coalesce((select ui.role from user_institutions ui where ui.user_id = auth.uid() and ui.institution_id = inst and ui.active limit 1), u.role)
    into me_role from users u where u.id = auth.uid();
  if inst is null or me_role not in ('admin','manager') then raise exception 'sem permissão'; end if;
  return query
  select u.id, u.full_name, coalesce(ui.role, u.role),
         coalesce((select array_agg(p.lesson_key) from academy_progress p where p.user_id = u.id and p.undone_at is null), '{}'::text[]),
         (select max(p.done_at) from academy_progress p where p.user_id = u.id and p.undone_at is null),
         coalesce((select jsonb_object_agg(pm.module, pm.enabled) from user_permissions pm where pm.user_id = u.id and pm.institution_id = inst), '{}'::jsonb)
  from users u
  left join user_institutions ui on ui.user_id = u.id and ui.institution_id = inst and ui.active
  where coalesce(u.active, true)
    and (u.institution_id = inst or ui.id is not null)
    and coalesce(u.user_type, 'school_user') not in ('admin_geral', 'consultant')
  order by u.full_name;
end $$;

revoke all on function public.academy_mark(text), public.academy_unmark(text), public.academy_team() from public, anon;
grant execute on function public.academy_mark(text), public.academy_unmark(text), public.academy_team() to authenticated;
