-- Concurso de Bolsas — fase 2: página pública, edital e inscrições (entram no CRM como lead).

alter table public.contests
  add column if not exists public_slug text,
  add column if not exists edital text,
  add column if not exists location text,
  add column if not exists registration_deadline timestamptz,
  add column if not exists extra_fields jsonb not null default '[]'::jsonb;  -- [{id,label,type:'text'|'select',options:[],required}]
create unique index if not exists contests_public_slug_uidx on public.contests (lower(public_slug)) where public_slug is not null;

create table if not exists public.contest_candidates (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  number int not null,
  student_name text not null,
  grade text not null,
  birth_date date,
  responsible_name text not null,
  phone text not null,
  email text,
  origin_school text,
  answers jsonb not null default '{}'::jsonb,
  lgpd_at timestamptz not null default now(),
  publish_names boolean not null default false,
  created_at timestamptz not null default now(),
  unique (contest_id, number)
);
create index if not exists contest_candidates_contest_idx on public.contest_candidates(contest_id, grade);
alter table public.contest_candidates enable row level security;
create policy contest_candidates_manage on public.contest_candidates for all to authenticated
  using (public.contest_user_can_manage(institution_id)) with check (public.contest_user_can_manage(institution_id));

-- Dados públicos do concurso (página de inscrição). Só concursos com link e fora de "em preparação".
create or replace function public.contest_public_get(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', c.name, 'year', c.year, 'status', c.status, 'exam_date', c.exam_date, 'location', c.location,
    'grades', c.grades, 'edital', c.edital, 'extra_fields', c.extra_fields, 'deadline', c.registration_deadline,
    'open', (c.status = 'open' and (c.registration_deadline is null or now() < c.registration_deadline)),
    'school_name', i.name, 'logo_url', i.logo_url, 'primary_color', i.primary_color, 'city', i.city
  )
  from contests c join institutions i on i.id = c.institution_id
  where lower(c.public_slug) = lower(p_slug) and c.status <> 'draft'
    and exists (select 1 from contest_settings s where s.institution_id = c.institution_id and s.module_enabled)
$$;

-- Inscrição pública: cria o candidato e o lead (etapa extra "Inscrito no concurso"). Não abre conversa.
create or replace function public.contest_public_register(p_slug text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c contests%rowtype;
  v_student text := btrim(coalesce(p_data->>'student_name', ''));
  v_resp text := btrim(coalesce(p_data->>'responsible_name', ''));
  v_phone text := normalize_phone_br(coalesce(p_data->>'phone', ''));
  v_grade text := btrim(coalesce(p_data->>'grade', ''));
  v_email text := nullif(btrim(coalesce(p_data->>'email', '')), '');
  v_origin text := nullif(btrim(coalesce(p_data->>'origin_school', '')), '');
  v_birth date := nullif(p_data->>'birth_date', '')::date;
  v_answers jsonb := coalesce(p_data->'answers', '{}'::jsonb);
  v_stage uuid; v_lead uuid; v_family uuid; v_num int; v_existing record; v_notes text;
begin
  select * into c from contests where lower(public_slug) = lower(p_slug) and status = 'open'
     and (registration_deadline is null or now() < registration_deadline)
     and exists (select 1 from contest_settings s where s.institution_id = contests.institution_id and s.module_enabled);
  if not found then return jsonb_build_object('ok', false, 'error', 'As inscrições deste concurso não estão abertas.'); end if;
  if length(v_student) < 3 or length(v_student) > 120 or length(v_resp) < 3 or length(v_resp) > 120 then
    return jsonb_build_object('ok', false, 'error', 'Preencha o nome do aluno e do responsável.'); end if;
  if length(regexp_replace(coalesce(v_phone, ''), '\D', '', 'g')) < 10 then
    return jsonb_build_object('ok', false, 'error', 'Informe um WhatsApp válido, com DDD.'); end if;
  if array_length(c.grades, 1) is not null and not (v_grade = any (c.grades)) then
    return jsonb_build_object('ok', false, 'error', 'Escolha a série do aluno.'); end if;
  if v_grade = '' then return jsonb_build_object('ok', false, 'error', 'Escolha a série do aluno.'); end if;
  if coalesce((p_data->>'lgpd')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'É preciso aceitar o uso dos dados para se inscrever.'); end if;
  if (select count(*) from contest_candidates where contest_id = c.id and created_at > now() - interval '1 minute') > 30 then
    return jsonb_build_object('ok', false, 'error', 'Muitas inscrições ao mesmo tempo. Tente de novo em um minuto.'); end if;

  perform pg_advisory_xact_lock(hashtext('contest_reg_' || c.id::text));

  -- mesma inscrição repetida (mesmo aluno e telefone): devolve o número já existente
  select number into v_num from contest_candidates
   where contest_id = c.id and lower(student_name) = lower(v_student) and phone = v_phone;
  if found then return jsonb_build_object('ok', true, 'number', v_num, 'duplicated', true); end if;

  select coalesce(max(number), 1000) + 1 into v_num from contest_candidates where contest_id = c.id;

  -- etapa extra do funil
  select id into v_stage from lead_custom_stages
   where institution_id = c.institution_id and lower(btrim(label)) = 'inscrito no concurso' and active limit 1;
  if v_stage is null then
    insert into lead_custom_stages (institution_id, label, after_stage, position)
    values (c.institution_id, 'Inscrito no concurso', 'new', 0)
    on conflict do nothing returning id into v_stage;
    if v_stage is null then
      select id into v_stage from lead_custom_stages where institution_id = c.institution_id and lower(btrim(label)) = 'inscrito no concurso' limit 1;
    end if;
  end if;

  v_notes := 'Inscrição no ' || c.name || ' (nº ' || v_num || ')'
    || coalesce(E'\n' || (select string_agg(f->>'label' || ': ' || coalesce(v_answers->>(f->>'id'), '-'), E'\n')
                          from jsonb_array_elements(c.extra_fields) f), '');

  -- mesmo telefone + mesmo aluno já é lead: reaproveita; outro aluno no mesmo telefone: novo lead na mesma família
  select id, family_id, status into v_existing from leads
   where institution_id = c.institution_id and normalize_phone_br(phone) = v_phone and lower(btrim(student_name)) = lower(v_student)
   order by created_at desc limit 1;
  if found then
    v_lead := v_existing.id;
    update leads set contest_name = c.name, notes = coalesce(notes || E'\n\n', '') || v_notes,
           custom_stage_id = case when v_existing.status = 'new' and custom_stage_id is null then v_stage else custom_stage_id end
     where id = v_lead;
  else
    select family_id into v_family from leads
     where institution_id = c.institution_id and normalize_phone_br(phone) = v_phone and family_id is not null limit 1;
    insert into leads (institution_id, student_name, responsible_name, phone, email, grade_interest, source, contest_name,
                       status, custom_stage_id, family_id, year_interest, origin_school, notes)
    values (c.institution_id, v_student, v_resp, v_phone, v_email, v_grade, 'Concurso de Bolsas', c.name,
            'new', v_stage, v_family, c.year, v_origin, v_notes)
    returning id into v_lead;
  end if;

  insert into contest_candidates (institution_id, contest_id, lead_id, number, student_name, grade, birth_date, responsible_name,
                                  phone, email, origin_school, answers, publish_names)
  values (c.institution_id, c.id, v_lead, v_num, v_student, v_grade, v_birth, v_resp, v_phone, v_email, v_origin, v_answers,
          coalesce((p_data->>'publish_names')::boolean, false));
  return jsonb_build_object('ok', true, 'number', v_num, 'duplicated', false);
end $$;

revoke all on function public.contest_public_get(text), public.contest_public_register(text, jsonb) from public;
grant execute on function public.contest_public_get(text), public.contest_public_register(text, jsonb) to anon, authenticated;
