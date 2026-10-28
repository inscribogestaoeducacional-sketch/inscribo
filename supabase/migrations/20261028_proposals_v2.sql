alter table public.proposals
  add column if not exists units int not null default 1,
  add column if not exists whatsapp_numbers int not null default 1,
  add column if not exists extra_unit_monthly numeric,
  add column if not exists extra_unit_impl numeric,
  add column if not exists extra_number_monthly numeric,
  add column if not exists extra_number_impl numeric,
  add column if not exists payment_terms text,
  add column if not exists notes text,
  add column if not exists proposal_date date,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_error text;

insert into storage.buckets (id, name, public) values ('proposals','proposals',true) on conflict (id) do update set public = true;

create policy "proposals_team_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'proposals' and exists (select 1 from public.users u where u.id = auth.uid() and u.user_type in ('admin_geral','consultant','consultant_externo','consultant_interno')));
create policy "proposals_team_update" on storage.objects for update to authenticated
using (bucket_id = 'proposals' and exists (select 1 from public.users u where u.id = auth.uid() and u.user_type in ('admin_geral','consultant','consultant_externo','consultant_interno')));
create policy "proposals_public_read" on storage.objects for select to public using (bucket_id = 'proposals');
