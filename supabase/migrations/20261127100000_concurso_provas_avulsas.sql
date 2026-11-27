-- Provas avulsas: números reservados (a partir de 2001) para alunos que fazem a prova sem inscrição prévia.
-- O cadastro é completado depois; a correção usa o número do cartão-resposta como sempre.
alter table public.contest_candidates add column if not exists avulso boolean not null default false;

create or replace function public.contest_create_avulsas(p_contest uuid, p_grade text, p_qty int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c contests; v_next int; v_nums int[] := '{}'; i int;
begin
  select * into c from contests where id = p_contest;
  if not found then return jsonb_build_object('ok', false, 'error', 'Concurso não encontrado'); end if;
  if not public.contest_user_can_manage(c.institution_id) then return jsonb_build_object('ok', false, 'error', 'Sem permissão'); end if;
  if coalesce(btrim(p_grade), '') = '' then return jsonb_build_object('ok', false, 'error', 'Escolha a série'); end if;
  if p_qty is null or p_qty < 1 or p_qty > 200 then return jsonb_build_object('ok', false, 'error', 'Informe de 1 a 200 provas'); end if;
  perform pg_advisory_xact_lock(hashtext('avulsas:' || p_contest::text));
  select coalesce(max(number) filter (where number >= 2001), 2000) + 1 into v_next from contest_candidates where contest_id = p_contest;
  for i in 0 .. p_qty - 1 loop
    insert into contest_candidates (institution_id, contest_id, number, student_name, grade, responsible_name, phone, avulso)
    values (c.institution_id, p_contest, v_next + i, '', p_grade, '', '', true);
    v_nums := v_nums || (v_next + i);
  end loop;
  return jsonb_build_object('ok', true, 'numbers', to_jsonb(v_nums));
end $$;
revoke all on function public.contest_create_avulsas(uuid, text, int) from public, anon;
grant execute on function public.contest_create_avulsas(uuid, text, int) to authenticated;
