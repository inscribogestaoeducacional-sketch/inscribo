-- Inscrição: e-mail, escola de origem, data de nascimento e CPF do aluno passam a ser obrigatórios (CPF validado).
alter table public.contest_candidates add column if not exists student_cpf text;

create or replace function public.contest_cpf_valid(p text)
returns boolean language plpgsql immutable as $f$
declare s1 int := 0; s2 int := 0; i int; d1 int; d2 int;
begin
  if p is null or p !~ '^[0-9]{11}$' or p ~ '^(.)\1{10}$' then return false; end if;
  for i in 1..9 loop s1 := s1 + substr(p, i, 1)::int * (11 - i); end loop;
  d1 := (s1 * 10 % 11) % 10;
  if d1 <> substr(p, 10, 1)::int then return false; end if;
  for i in 1..10 loop s2 := s2 + substr(p, i, 1)::int * (12 - i); end loop;
  d2 := (s2 * 10 % 11) % 10;
  return d2 = substr(p, 11, 1)::int;
end $f$;

alter function public.contest_public_register(text, jsonb) rename to contest_public_register_core;
revoke all on function public.contest_public_register_core(text, jsonb) from public, anon, authenticated;

create or replace function public.contest_public_register(p_slug text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cpf text := regexp_replace(coalesce(p_data->>'student_cpf', ''), '\D', '', 'g');
  v_email text := btrim(coalesce(p_data->>'email', ''));
  v_birth date;
  r jsonb;
begin
  begin v_birth := nullif(p_data->>'birth_date', '')::date; exception when others then v_birth := null; end;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('ok', false, 'error', 'Informe um e-mail válido.'); end if;
  if btrim(coalesce(p_data->>'origin_school', '')) = '' then return jsonb_build_object('ok', false, 'error', 'Informe a escola onde o aluno estuda hoje.'); end if;
  if v_birth is null or v_birth > current_date or v_birth < date '2000-01-01' then return jsonb_build_object('ok', false, 'error', 'Informe a data de nascimento do aluno.'); end if;
  if not public.contest_cpf_valid(v_cpf) then return jsonb_build_object('ok', false, 'error', 'CPF do aluno inválido.'); end if;
  r := public.contest_public_register_core(p_slug, p_data);
  if (r->>'ok')::boolean and not coalesce((r->>'duplicated')::boolean, false) then
    update contest_candidates set student_cpf = v_cpf
     where contest_id = (select id from contests where lower(public_slug) = lower(p_slug)) and number = (r->>'number')::int;
  end if;
  return r;
end $$;
revoke all on function public.contest_public_register(text, jsonb) from public;
grant execute on function public.contest_public_register(text, jsonb) to anon, authenticated;
