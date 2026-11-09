-- Concurso de Bolsas — fase 3: composição da prova e versões embaralhadas (congeladas, com gabarito por versão).
alter table public.contest_questions add column if not exists position int not null default 0, add column if not exists in_exam boolean not null default true;
alter table public.contest_candidates add column if not exists version text;

create table if not exists public.contest_exam_versions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  grade text not null,
  version text not null,
  items jsonb not null default '[]'::jsonb,        -- [{question_id, alt_order:[índices originais na ordem impressa]}]
  answer_key jsonb not null default '[]'::jsonb,   -- ["B","D",...] na ordem impressa
  created_at timestamptz not null default now(),
  unique (contest_id, grade, version)
);
create index if not exists contest_exam_versions_contest_idx on public.contest_exam_versions(contest_id, grade);
alter table public.contest_exam_versions enable row level security;
create policy contest_exam_versions_manage on public.contest_exam_versions for all to authenticated
  using (public.contest_user_can_manage(institution_id)) with check (public.contest_user_can_manage(institution_id));
