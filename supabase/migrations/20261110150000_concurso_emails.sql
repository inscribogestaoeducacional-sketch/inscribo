-- Concurso de Bolsas — Fase B: e-mails (confirmação automática, envio avulso/em massa, modelos e histórico).
alter table public.contests
  add column if not exists email_auto_confirm boolean not null default true,
  add column if not exists email_confirmation jsonb not null default '{}'::jsonb;  -- {subject, body} editáveis; vazio = texto padrão

create table if not exists public.contest_emails (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  candidate_id uuid references public.contest_candidates(id) on delete set null,
  kind text not null default 'custom' check (kind in ('confirmation','custom','test')),
  to_email text not null,
  subject text not null,
  status text not null check (status in ('sent','error')),
  error text,
  sent_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists contest_emails_contest_idx on public.contest_emails(contest_id, created_at desc);
create index if not exists contest_emails_cand_idx on public.contest_emails(candidate_id, kind);
alter table public.contest_emails enable row level security;
create policy contest_emails_manage on public.contest_emails for all to authenticated
  using (public.contest_user_can_manage(institution_id)) with check (public.contest_user_can_manage(institution_id));

create table if not exists public.contest_email_templates (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  name text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists contest_email_templates_idx on public.contest_email_templates(contest_id);
alter table public.contest_email_templates enable row level security;
create policy contest_email_templates_manage on public.contest_email_templates for all to authenticated
  using (public.contest_user_can_manage(institution_id)) with check (public.contest_user_can_manage(institution_id));
