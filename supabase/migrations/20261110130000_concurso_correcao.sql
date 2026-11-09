-- Concurso de Bolsas — fase 4: resultados da leitura dos cartões (e digitação manual) e bucket privado dos cartões escaneados.
create table if not exists public.contest_results (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  candidate_id uuid not null references public.contest_candidates(id) on delete cascade,
  version text not null,
  answers jsonb not null default '[]'::jsonb,       -- ["A", null, ...] na ordem impressa
  flags jsonb not null default '[]'::jsonb,         -- [{q, kind: 'double'|'faint'}]
  score int not null default 0,
  total int not null default 0,
  by_subject jsonb not null default '{}'::jsonb,    -- {subject_id: {hits, total}}
  status text not null default 'ok' check (status in ('ok','review','manual')),
  source text not null default 'scan' check (source in ('scan','manual')),
  scan_path text,
  read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contest_id, candidate_id)
);
create index if not exists contest_results_contest_idx on public.contest_results(contest_id, status);
alter table public.contest_results enable row level security;
create policy contest_results_manage on public.contest_results for all to authenticated
  using (public.contest_user_can_manage(institution_id)) with check (public.contest_user_can_manage(institution_id));

insert into storage.buckets (id, name, public) values ('contest-scans', 'contest-scans', false) on conflict (id) do nothing;
create policy contest_scans_manage on storage.objects for all to authenticated
  using (bucket_id = 'contest-scans' and public.contest_user_can_manage(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'contest-scans' and public.contest_user_can_manage(((storage.foldername(name))[1])::uuid));
