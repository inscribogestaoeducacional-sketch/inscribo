-- E-mails automáticos do CRM por fase. Tabelas, regras de acesso e agendador (a cada 15 min).
-- Os textos iniciais estão em crm_email_flows (editáveis em Configurações › E-mails do CRM).
create table if not exists public.crm_email_flows (
  key text primary key, stage text not null, label text not null, description text, trigger_kind text not null,
  builtin boolean not null default false, enabled boolean not null default false, delay_days numeric not null default 0,
  subject text not null default '', body text not null default '', button_label text, button_kind text,
  sort int not null default 0, active_since timestamptz, updated_at timestamptz not null default now(), updated_by uuid
);
create table if not exists public.crm_email_log (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null, flow_key text not null, ref_id text not null default '',
  to_email text, status text not null default 'sending', error text, created_at timestamptz not null default now(),
  unique (lead_id, flow_key, ref_id)
);
alter table public.crm_email_flows enable row level security;
alter table public.crm_email_log enable row level security;
-- cron: select cron.schedule('crm-email-flow','*/15 * * * *', $$ ...net.http_post(.../functions/v1/crm-email-flow)... $$)
