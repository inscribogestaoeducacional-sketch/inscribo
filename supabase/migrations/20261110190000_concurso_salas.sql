create table if not exists public.contest_rooms (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  name text not null,
  capacity int not null default 30 check (capacity > 0),
  grade text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists contest_rooms_contest_idx on public.contest_rooms(contest_id);
alter table public.contest_rooms enable row level security;
create policy contest_rooms_manage on public.contest_rooms for all to authenticated
  using (public.contest_user_can_manage(institution_id)) with check (public.contest_user_can_manage(institution_id));
alter table public.contest_candidates add column if not exists room_id uuid references public.contest_rooms(id) on delete set null;
alter table public.contest_candidates add column if not exists present boolean;
