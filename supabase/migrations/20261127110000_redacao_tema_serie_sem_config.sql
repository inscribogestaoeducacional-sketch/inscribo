-- Série sem configuração própria de redação herda o padrão do concurso (has_essay): o professor pode salvar o tema.
create or replace function public.contest_teacher_save_essay_prompt(p_contest uuid, p_grade text, p_prompt text, p_images jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c contests; cur jsonb; v_on boolean;
begin
  select * into c from contests where id = p_contest;
  if not found then return jsonb_build_object('ok', false, 'error', 'Concurso não encontrado'); end if;
  if not (public.contest_is_essay_teacher(p_contest) or public.contest_user_can_manage(c.institution_id)) then
    return jsonb_build_object('ok', false, 'error', 'Sem permissão');
  end if;
  cur := c.essay_by_grade -> p_grade;
  v_on := case when cur is null then coalesce(c.has_essay, false) else coalesce((cur->>'enabled')::boolean, false) end;
  if not v_on then
    return jsonb_build_object('ok', false, 'error', 'Esta série não tem redação ligada pela coordenação');
  end if;
  update contests set essay_by_grade = jsonb_set(coalesce(essay_by_grade, '{}'::jsonb), array[p_grade],
      coalesce(cur, jsonb_build_object('enabled', true)) || jsonb_build_object('enabled', true, 'prompt', coalesce(p_prompt, ''), 'images', coalesce(p_images, '[]'::jsonb)), true)
   where id = p_contest;
  return jsonb_build_object('ok', true);
end $$;
