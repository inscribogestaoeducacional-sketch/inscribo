-- Relatórios mensais da Campanha de Matrículas (aplicado no banco via MCP).
create table if not exists public.campaign_month_reports (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null, cycle_id uuid not null, month text not null,
  report jsonb, snapshot jsonb, created_by uuid, created_at timestamptz not null default now(),
  emailed_at timestamptz, emailed_to text, unique (cycle_id, month)
);
alter table public.campaign_month_reports enable row level security;
create policy campaign_month_reports_rw on public.campaign_month_reports for all
  using (((institution_id = get_my_institution_id()) and exists (select 1 from users u where u.id = auth.uid() and u.role = any (array['admin','manager']))) or is_super_admin_user())
  with check (((institution_id = get_my_institution_id()) and exists (select 1 from users u where u.id = auth.uid() and u.role = any (array['admin','manager']))) or is_super_admin_user());
