-- Sequência para lead sem resposta (Áion Edu). Rode no SQL Editor do Supabase Edu.
create table if not exists public.lead_sequence_config (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
  enabled boolean not null default false,
  steps jsonb not null default '[{"days":3,"template":"reativacao2"},{"days":7,"template":"ainda_da_tempo"},{"days":14,"template":"escassez_ultima_chamada"}]'::jsonb,
  send_from smallint not null default 8 check (send_from between 0 and 23),
  send_to smallint not null default 19 check (send_to between 1 and 24),
  weekdays smallint[] not null default '{1,2,3,4,5,6}',
  daily_cap integer not null default 100 check (daily_cap between 1 and 1000),
  max_attempts smallint not null default 5 check (max_attempts between 1 and 5),
  max_age_days smallint not null default 30 check (max_age_days between 7 and 180),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create table if not exists public.lead_sequence_log (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  lead_id uuid not null,
  step smallint not null,
  template_name text not null,
  remote_jid text,
  status text not null check (status in ('sent','failed')),
  error text,
  sent_at timestamptz not null default now()
);
create index if not exists lead_sequence_log_inst_sent on public.lead_sequence_log (institution_id, sent_at desc);
create index if not exists lead_sequence_log_lead on public.lead_sequence_log (lead_id, sent_at desc);
alter table public.lead_sequence_config enable row level security;
alter table public.lead_sequence_log enable row level security;
drop policy if exists lead_sequence_config_rw on public.lead_sequence_config;
create policy lead_sequence_config_rw on public.lead_sequence_config for all to authenticated
  using (institution_id in (select institution_id from public.users where id = auth.uid() and role in ('admin','manager')))
  with check (institution_id in (select institution_id from public.users where id = auth.uid() and role in ('admin','manager')));
drop policy if exists lead_sequence_log_read on public.lead_sequence_log;
create policy lead_sequence_log_read on public.lead_sequence_log for select to authenticated
  using (institution_id in (select institution_id from public.users where id = auth.uid() and role in ('admin','manager')));

-- Disparo automático a cada 15 minutos
select cron.unschedule(jobid) from cron.job where jobname = 'lead-sequence';
select cron.schedule('lead-sequence', '*/15 * * * *', $$SELECT net.http_post(
    url     := 'https://syxxuumxkhhnoqrxporj.supabase.co/functions/v1/lead-sequence',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT value FROM platform_settings WHERE key = 'service_role_key')),
    body    := '{}'::jsonb, timeout_milliseconds := 50000)$$);
