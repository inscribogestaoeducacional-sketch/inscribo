-- Concurso de Bolsas: liberação do resultado em etapas + anulação de questões.
alter table contests add column if not exists release_stage int not null default 0;
alter table contests add column if not exists annulled jsonb not null default '[]'::jsonb;
update contests set release_stage = 3 where status = 'published' and release_stage = 0;

-- Nota objetiva calculada no banco: respostas x gabarito, considerando as questões anuladas.
-- annulled = [{question_id, mode: 'point' | 'remove'}]  (point = vale ponto para todos; remove = sai da prova)
create or replace function public.contest_calc_score(p_contest uuid, p_grade text, p_version text, p_answers jsonb)
returns table(score int, total int) language plpgsql stable as $$
declare v contest_exam_versions; ann jsonb; n int; i int; qid text; a jsonb; s int := 0; t int := 0;
begin
  select * into v from contest_exam_versions where contest_id = p_contest and grade = p_grade and version = p_version;
  if not found then return; end if;
  select annulled into ann from contests where id = p_contest;
  n := jsonb_array_length(v.items);
  for i in 0 .. n - 1 loop
    qid := v.items->i->>'question_id';
    select e into a from jsonb_array_elements(coalesce(ann, '[]'::jsonb)) e where e->>'question_id' = qid limit 1;
    if a is null then
      t := t + 1; if (p_answers->>i) is not null and (p_answers->>i) = (v.answer_key->>i) then s := s + 1; end if;
    elsif a->>'mode' = 'point' then t := t + 1; s := s + 1;
    end if;
  end loop;
  return query select s, t;
end $$;

create or replace function public.contest_results_recalc() returns trigger language plpgsql as $$
declare g text; r record;
begin
  select grade into g from contest_candidates where id = new.candidate_id;
  if g is not null and new.answers is not null then
    select * into r from contest_calc_score(new.contest_id, g, new.version, new.answers);
    if r.total is not null then new.score := r.score; new.total := r.total; end if;
  end if;
  return new;
end $$;
drop trigger if exists contest_results_recalc_trg on contest_results;
create trigger contest_results_recalc_trg before insert or update of answers, version on contest_results
  for each row execute function contest_results_recalc();

-- Quando as anulações mudam, recalcula todas as notas daquele concurso.
create or replace function public.contest_annul_changed() returns trigger language plpgsql as $$
declare r record; g text; c record;
begin
  if new.annulled is distinct from old.annulled then
    for r in select id, candidate_id, version, answers from contest_results where contest_id = new.id loop
      select grade into g from contest_candidates where id = r.candidate_id;
      if g is not null and r.answers is not null then
        select * into c from contest_calc_score(new.id, g, r.version, r.answers);
        if c.total is not null then update contest_results set score = c.score, total = c.total where id = r.id; end if;
      end if;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists contest_annul_changed_trg on contests;
create trigger contest_annul_changed_trg after update of annulled on contests for each row execute function contest_annul_changed();

-- Consulta pública por etapa: 1 = gabarito e acertos; 2 = + redação e nota final; 3 = + colocação e bolsa.
create or replace function public.contest_public_result(p_slug text, p_number int, p_birth date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c contests; k contest_candidates; r contest_results; e contest_essays; d contest_decisions; v contest_exam_versions;
        v_obj numeric; v_essay numeric; v_final numeric; v_pos int; v_of int; v_has_essay boolean; v_stage int;
        v_q jsonb := '[]'::jsonb; i int; qid text; a jsonb; mine text; correct text; st text; subj text; qq contest_questions; alts jsonb; k2 int;
begin
  select * into c from contests where public_slug = lower(btrim(p_slug));
  if not found then return jsonb_build_object('ok', false, 'error', 'Concurso não encontrado.'); end if;
  v_stage := case when c.status = 'published' then greatest(c.release_stage, 1) else 0 end;
  if v_stage = 0 then return jsonb_build_object('ok', false, 'error', 'O resultado ainda não foi divulgado.', 'not_released', true); end if;
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
  -- gabarito por questão (etapa 1)
  if r.id is not null then
    select * into v from contest_exam_versions where contest_id = c.id and grade = k.grade and version = r.version;
    if found then
      for i in 0 .. jsonb_array_length(v.items) - 1 loop
        qid := v.items->i->>'question_id';
        select e2 into a from jsonb_array_elements(c.annulled) e2 where e2->>'question_id' = qid limit 1;
        select * into qq from contest_questions where id::text = qid;
        select s.name into subj from contest_subjects s where s.id = qq.subject_id;
        alts := '[]'::jsonb;
        for k2 in 0 .. jsonb_array_length(v.items->i->'alt_order') - 1 loop
          alts := alts || jsonb_build_array(coalesce(qq.alternatives->((v.items->i->'alt_order'->>k2)::int)->>'text', ''));
        end loop;
        mine := r.answers->>i; correct := v.answer_key->>i;
        st := case when a is not null then 'annulled' when mine is null then 'blank' when mine = correct then 'hit' else 'miss' end;
        v_q := v_q || jsonb_build_array(jsonb_build_object('n', i + 1, 'subject', subj, 'mine', mine, 'correct', correct, 'status', st, 'mode', a->>'mode', 'statement', qq.statement, 'images', coalesce(qq.statement_images, '[]'::jsonb), 'alternatives', alts));
      end loop;
    end if;
  end if;
  -- colocação na série (etapa 3)
  if v_stage >= 3 and v_final is not null then
    with base as (
      select k2.id, case when r2.total > 0 then round(100.0 * r2.score / r2.total, 1) end obj,
             case when e2.annulled then 0 when e2.total is not null and coalesce(e2.max_total,0) > 0 then round(100.0 * e2.total / e2.max_total, 1) end essay
        from contest_candidates k2
        left join contest_results r2 on r2.candidate_id = k2.id and r2.contest_id = c.id
        left join contest_essays e2 on e2.candidate_id = k2.id and e2.contest_id = c.id
       where k2.contest_id = c.id and k2.grade = k.grade),
    fin as (select id, case when obj is null then null when v_has_essay and c.essay_weight > 0 then round((obj * (100 - c.essay_weight) + coalesce(essay, 0) * c.essay_weight) / 100.0, 1) else obj end f from base)
    select count(*) filter (where f > v_final) + 1, count(*) filter (where f is not null) into v_pos, v_of from fin;
  end if;
  return jsonb_build_object('ok', true, 'stage', v_stage, 'student_name', k.student_name, 'grade', k.grade, 'number', k.number, 'contest', c.name,
    'hits', r.score, 'total', r.total, 'objective', v_obj, 'questions', v_q, 'has_essay', v_has_essay,
    'essay', case when v_stage >= 2 then v_essay end, 'final', case when v_stage >= 2 then v_final end,
    'position', case when v_stage >= 3 then v_pos end, 'position_of', case when v_stage >= 3 then v_of end,
    'decision', case when v_stage >= 3 then (case when d.id is null then 'pending' else d.status end) end,
    'scholarship_pct', case when v_stage >= 3 then d.scholarship_pct end);
end $$;
grant execute on function public.contest_public_result(text, int, date) to anon, authenticated;
