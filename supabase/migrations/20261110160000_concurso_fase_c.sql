-- Concurso de Bolsas — Fase C: redação (correção às cegas com critérios), decisão de bolsas e divulgação do resultado.
alter table public.contests
  add column if not exists essay_rubric jsonb not null default '[
    {"id":"c1","name":"Domínio da norma culta","max":200},
    {"id":"c2","name":"Compreensão da proposta","max":200},
    {"id":"c3","name":"Seleção e organização das ideias","max":200},
    {"id":"c4","name":"Coesão e coerência","max":200},
    {"id":"c5","name":"Proposta de intervenção","max":200}
  ]'::jsonb,
  add column if not exists essay_weight int not null default 30 check (essay_weight between 0 and 100),
  add column if not exists scholarship_tiers jsonb not null default '[{"label":"100%","percent":100},{"label":"75%","percent":75},{"label":"50%","percent":50},{"label":"25%","percent":25}]'::jsonb;

create table if not exists public.contest_essays (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  candidate_id uuid not null references public.contest_candidates(id) on delete cascade,
  scan_path text,
  scores jsonb not null default '{}'::jsonb,     -- {criterio_id: nota}
  total int,                                     -- soma dos critérios (null = ainda não corrigida)
  max_total int,
  annulled boolean not null default false,
  note text,
  graded_by uuid,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (contest_id, candidate_id)
);
create index if not exists contest_essays_contest_idx on public.contest_essays(contest_id);
alter table public.contest_essays enable row level security;
create policy contest_essays_manage on public.contest_essays for all to authenticated
  using (public.contest_user_can_manage(institution_id)) with check (public.contest_user_can_manage(institution_id));

create table if not exists public.contest_decisions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  candidate_id uuid not null references public.contest_candidates(id) on delete cascade,
  scholarship_pct int check (scholarship_pct between 0 and 100),
  status text not null default 'pending' check (status in ('pending','granted','waitlist','denied')),
  note text,
  decided_at timestamptz not null default now(),
  unique (contest_id, candidate_id)
);
alter table public.contest_decisions enable row level security;
create policy contest_decisions_manage on public.contest_decisions for all to authenticated
  using (public.contest_user_can_manage(institution_id)) with check (public.contest_user_can_manage(institution_id));

-- Consulta pública do resultado: só funciona depois que a escola divulga (status 'published'), com nº da inscrição + data de nascimento.
create or replace function public.contest_public_result(p_slug text, p_number int, p_birth date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c contests; k contest_candidates; r contest_results; e contest_essays; d contest_decisions;
        v_obj numeric; v_essay numeric; v_final numeric; v_pos int; v_of int; v_has_essay boolean;
begin
  select * into c from contests where public_slug = lower(btrim(p_slug));
  if not found then return jsonb_build_object('ok', false, 'error', 'Concurso não encontrado.'); end if;
  if c.status <> 'published' then return jsonb_build_object('ok', false, 'error', 'O resultado ainda não foi divulgado.', 'not_released', true); end if;
  select * into k from contest_candidates where contest_id = c.id and number = p_number and birth_date is not null and birth_date = p_birth;
  if not found then return jsonb_build_object('ok', false, 'error', 'Não encontramos essa inscrição com essa data de nascimento.'); end if;
  select * into r from contest_results where contest_id = c.id and candidate_id = k.id;
  select * into e from contest_essays where contest_id = c.id and candidate_id = k.id;
  select * into d from contest_decisions where contest_id = c.id and candidate_id = k.id;
  v_has_essay := coalesce((c.essay_by_grade->k.grade->>'enabled')::boolean, c.has_essay);
  v_obj := case when r.id is not null and r.total > 0 then round(100.0 * r.score / r.total, 1) end;
  v_essay := case when e.total is not null and coalesce(e.max_total,0) > 0 and not e.annulled then round(100.0 * e.total / e.max_total, 1) when e.annulled then 0 end;
  v_final := case when v_obj is null then null
                  when v_has_essay and c.essay_weight > 0 then round((v_obj * (100 - c.essay_weight) + coalesce(v_essay, 0) * c.essay_weight) / 100.0, 1)
                  else v_obj end;
  return jsonb_build_object('ok', true, 'student_name', k.student_name, 'grade', k.grade, 'number', k.number, 'contest', c.name,
    'hits', r.score, 'total', r.total, 'objective', v_obj, 'essay', v_essay, 'has_essay', v_has_essay, 'final', v_final,
    'decision', case when d.id is null then 'pending' else d.status end, 'scholarship_pct', d.scholarship_pct);
end $$;
grant execute on function public.contest_public_result(text, int, date) to anon, authenticated;
