-- Redação passa a ser do professor: a coordenação indica quem é o professor de redação; ele escreve o tema (com fotos) e corrige às cegas.
create table if not exists public.contest_essay_teachers (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  teacher_id uuid not null references public.contest_teachers(id) on delete cascade,
  unique (contest_id, teacher_id)
);
alter table public.contest_essay_teachers enable row level security;
create policy contest_essay_teachers_manage on public.contest_essay_teachers for all to authenticated
  using (public.contest_user_can_manage(institution_id)) with check (public.contest_user_can_manage(institution_id));
create policy contest_essay_teachers_self on public.contest_essay_teachers for select to authenticated
  using (teacher_id = public.contest_my_teacher_id(institution_id));

alter table public.contest_essays add column if not exists grade text;
update public.contest_essays e set grade = k.grade from public.contest_candidates k where k.id = e.candidate_id and e.grade is null;

create or replace function public.contest_is_essay_teacher(p_contest uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from contest_essay_teachers et join contest_teachers t on t.id = et.teacher_id
                  where et.contest_id = p_contest and t.user_id = auth.uid() and t.active)
$$;

-- o professor de redação lê as redações (sem nome do aluno: o vínculo com o aluno só a coordenação enxerga)
create policy contest_essays_teacher_read on public.contest_essays for select to authenticated
  using (public.contest_is_essay_teacher(contest_id));

create policy contest_scans_essay_teacher on storage.objects for select to authenticated
  using (bucket_id = 'contest-scans' and public.contest_is_essay_teacher(((storage.foldername(name))[2])::uuid));

-- Tema da redação (texto + fotos) de uma série
create or replace function public.contest_teacher_save_essay_prompt(p_contest uuid, p_grade text, p_prompt text, p_images jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c contests; cur jsonb;
begin
  select * into c from contests where id = p_contest;
  if not found then return jsonb_build_object('ok', false, 'error', 'Concurso não encontrado'); end if;
  if not (public.contest_is_essay_teacher(p_contest) or public.contest_user_can_manage(c.institution_id)) then
    return jsonb_build_object('ok', false, 'error', 'Sem permissão');
  end if;
  cur := c.essay_by_grade -> p_grade;
  if cur is null or coalesce((cur->>'enabled')::boolean, false) = false then
    return jsonb_build_object('ok', false, 'error', 'Esta série não tem redação ligada pela coordenação');
  end if;
  update contests set essay_by_grade = jsonb_set(essay_by_grade, array[p_grade],
      cur || jsonb_build_object('prompt', coalesce(p_prompt, ''), 'images', coalesce(p_images, '[]'::jsonb)))
   where id = p_contest;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.contest_teacher_save_essay_prompt(uuid, text, text, jsonb) to authenticated;

-- Correção: o servidor soma e limita as notas (o app não decide o total)
create or replace function public.contest_teacher_grade_essay(p_essay uuid, p_scores jsonb, p_annulled boolean, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e contest_essays; c contests; r jsonb; v_total int := 0; v_max int := 0; v_val int; v_clean jsonb := '{}'::jsonb;
begin
  select * into e from contest_essays where id = p_essay;
  if not found then return jsonb_build_object('ok', false, 'error', 'Redação não encontrada'); end if;
  select * into c from contests where id = e.contest_id;
  if not (public.contest_is_essay_teacher(e.contest_id) or public.contest_user_can_manage(c.institution_id)) then
    return jsonb_build_object('ok', false, 'error', 'Sem permissão');
  end if;
  for r in select * from jsonb_array_elements(c.essay_rubric) loop
    v_max := v_max + (r->>'max')::int;
    if not coalesce(p_annulled, false) then
      if p_scores ->> (r->>'id') is null then return jsonb_build_object('ok', false, 'error', 'Dê nota em todos os critérios'); end if;
      v_val := greatest(0, least((r->>'max')::int, (p_scores ->> (r->>'id'))::int));
      v_clean := v_clean || jsonb_build_object(r->>'id', v_val); v_total := v_total + v_val;
    end if;
  end loop;
  update contest_essays set scores = v_clean, total = v_total, max_total = v_max, annulled = coalesce(p_annulled, false),
         note = nullif(btrim(coalesce(p_note, '')), ''), graded_by = auth.uid(), graded_at = now() where id = p_essay;
  return jsonb_build_object('ok', true, 'total', v_total, 'max', v_max);
end $$;
grant execute on function public.contest_teacher_grade_essay(uuid, jsonb, boolean, text) to authenticated;
