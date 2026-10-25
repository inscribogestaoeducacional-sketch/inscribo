create table if not exists public.lead_unanswered_sent (lead_id uuid primary key, sent_at timestamptz not null default now());
create table if not exists public.wa_down_alerts_sent (institution_id uuid primary key, sent_at timestamptz not null default now());
alter table public.lead_unanswered_sent enable row level security;
alter table public.wa_down_alerts_sent enable row level security;
