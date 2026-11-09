alter table public.contest_teachers add column if not exists nda_accepted_at timestamptz;
alter table public.contest_teachers add column if not exists nda_version text;
create or replace function public.contest_teacher_accept_nda(p_version text)
returns void language sql security definer set search_path = public as $$
  update contest_teachers set nda_accepted_at = now(), nda_version = p_version
   where user_id = auth.uid() and nda_accepted_at is null;
$$;
revoke all on function public.contest_teacher_accept_nda(text) from public, anon;
grant execute on function public.contest_teacher_accept_nda(text) to authenticated;
