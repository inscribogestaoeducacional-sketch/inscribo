create table if not exists public.release_acks (user_id uuid not null references public.users(id) on delete cascade, release text not null, institution_id uuid, acked_at timestamptz not null default now(), primary key (user_id, release));
alter table public.release_acks enable row level security;
create policy release_acks_own on public.release_acks for select using (user_id = auth.uid());
create or replace function public.release_gate(p_release text, p_cutoff date) returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from users u join institutions i on i.id = u.institution_id
    where u.id = auth.uid() and u.active and i.created_at::date < p_cutoff)
  and not exists (select 1 from release_acks a where a.user_id = auth.uid() and a.release = p_release) $$;
create or replace function public.release_ack(p_release text) returns void language sql security definer set search_path=public as $$
  insert into release_acks(user_id, release, institution_id) select u.id, p_release, u.institution_id from users u where u.id = auth.uid()
  on conflict do nothing $$;
grant execute on function public.release_gate(text, date) to authenticated;
grant execute on function public.release_ack(text) to authenticated;
