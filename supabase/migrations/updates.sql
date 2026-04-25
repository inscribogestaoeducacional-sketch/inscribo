-- Central de Atualizações
create table if not exists public.school_updates (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  content     text not null,
  type        text not null check (type in ('news','feature','alert','maintenance')),
  media_url   text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz
);

create table if not exists public.school_update_reads (
  id             uuid primary key default gen_random_uuid(),
  update_id      uuid not null references public.school_updates(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  read_at        timestamptz not null default now(),
  unique (update_id, institution_id)
);

-- RLS
alter table public.school_updates      enable row level security;
alter table public.school_update_reads enable row level security;

-- school_updates: admins manage, school users read
create policy "school_updates_select" on public.school_updates
  for select using (true);

create policy "school_updates_insert" on public.school_updates
  for insert with check (true);

create policy "school_updates_delete" on public.school_updates
  for delete using (true);

-- school_update_reads: institution members manage their own reads
create policy "school_update_reads_select" on public.school_update_reads
  for select using (true);

create policy "school_update_reads_insert" on public.school_update_reads
  for insert with check (true);
