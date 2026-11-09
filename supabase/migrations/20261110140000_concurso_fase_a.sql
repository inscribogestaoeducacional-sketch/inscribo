-- Concurso — fase A: redação por série e perguntas da inscrição editáveis.
alter table public.contests
  add column if not exists essay_by_grade jsonb not null default '{}'::jsonb,   -- {"6º ano": {"enabled": true, "prompt": "..."}}
  add column if not exists form_config jsonb not null default '{}'::jsonb;      -- {"fields": {"email": {"label": "...", "required": true, "enabled": true}}}

create or replace function public.contest_public_get(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', c.name, 'year', c.year, 'status', c.status, 'exam_date', c.exam_date, 'location', c.location,
    'grades', c.grades, 'edital', c.edital, 'extra_fields', c.extra_fields, 'form_config', c.form_config, 'deadline', c.registration_deadline,
    'open', (c.status = 'open' and (c.registration_deadline is null or now() < c.registration_deadline)),
    'school_name', i.name, 'logo_url', i.logo_url, 'primary_color', i.primary_color, 'city', i.city
  )
  from contests c join institutions i on i.id = c.institution_id
  where lower(c.public_slug) = lower(p_slug) and c.status <> 'draft'
    and exists (select 1 from contest_settings s where s.institution_id = c.institution_id and s.module_enabled)
$$;

create or replace function public.contest_public_register(p_slug text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  fc jsonb;
  v_cpf text := regexp_replace(coalesce(p_data->>'student_cpf', ''), '\D', '', 'g');
  v_email text := btrim(coalesce(p_data->>'email', ''));
  v_birth date;
  r jsonb;
begin
  select coalesce(form_config->'fields', '{}'::jsonb) into fc from contests where lower(public_slug) = lower(p_slug);
  begin v_birth := nullif(p_data->>'birth_date', '')::date; exception when others then v_birth := null; end;

  -- e-mail, escola, nascimento e CPF: obrigatórios, a não ser que a coordenação tenha desligado ou tornado opcionais
  if coalesce((fc->'email'->>'enabled')::boolean, true) and (coalesce((fc->'email'->>'required')::boolean, true) or v_email <> '')
     and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('ok', false, 'error', 'Informe um e-mail válido.'); end if;
  if coalesce((fc->'origin_school'->>'enabled')::boolean, true) and coalesce((fc->'origin_school'->>'required')::boolean, true)
     and btrim(coalesce(p_data->>'origin_school', '')) = '' then return jsonb_build_object('ok', false, 'error', 'Informe a escola onde o aluno estuda hoje.'); end if;
  if coalesce((fc->'birth_date'->>'enabled')::boolean, true) and coalesce((fc->'birth_date'->>'required')::boolean, true)
     and (v_birth is null or v_birth > current_date or v_birth < date '2000-01-01') then return jsonb_build_object('ok', false, 'error', 'Informe a data de nascimento do aluno.'); end if;
  if coalesce((fc->'student_cpf'->>'enabled')::boolean, true) and (coalesce((fc->'student_cpf'->>'required')::boolean, true) or v_cpf <> '')
     and not public.contest_cpf_valid(v_cpf) then return jsonb_build_object('ok', false, 'error', 'CPF do aluno inválido.'); end if;

  -- o núcleo exige e-mail só se vier preenchido; limpa campos desligados
  r := public.contest_public_register_core(p_slug, p_data);
  if (r->>'ok')::boolean and not coalesce((r->>'duplicated')::boolean, false) and v_cpf <> '' then
    update contest_candidates set student_cpf = v_cpf
     where contest_id = (select id from contests where lower(public_slug) = lower(p_slug)) and number = (r->>'number')::int;
  end if;
  return r;
end $$;
revoke all on function public.contest_public_register(text, jsonb) from public;
grant execute on function public.contest_public_register(text, jsonb) to anon, authenticated;
