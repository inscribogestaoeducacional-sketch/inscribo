-- Rematrícula lançada à mão na Campanha (escola sem integração).
-- Configuração da escola: como lança (total ou por série) e o que digita (do mês ou acumulado).
create table if not exists public.campaign_reenroll_settings (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  scope text not null default 'total' check (scope in ('total','serie')),
  basis text not null default 'mes' check (basis in ('mes','acumulado')),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (institution_id, year)
);
create table if not exists public.campaign_reenroll_entries (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  grade_key text not null default 'total',
  value integer not null check (value >= 0 and value <= 100000),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (institution_id, year, period, grade_key)
);
alter table public.campaign_reenroll_settings enable row level security;
alter table public.campaign_reenroll_entries enable row level security;
drop policy if exists campaign_reenroll_settings_rw on public.campaign_reenroll_settings;
create policy campaign_reenroll_settings_rw on public.campaign_reenroll_settings for all to authenticated
  using (is_super_admin_user() or (institution_id = get_my_institution_id() and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','manager'))))
  with check (is_super_admin_user() or (institution_id = get_my_institution_id() and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','manager'))));
drop policy if exists campaign_reenroll_entries_rw on public.campaign_reenroll_entries;
create policy campaign_reenroll_entries_rw on public.campaign_reenroll_entries for all to authenticated
  using (is_super_admin_user() or (institution_id = get_my_institution_id() and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','manager'))))
  with check (is_super_admin_user() or (institution_id = get_my_institution_id() and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','manager'))));
notify pgrst, 'reload schema';
