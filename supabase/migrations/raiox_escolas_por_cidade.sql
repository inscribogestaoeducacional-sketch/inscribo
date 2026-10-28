-- Raio-X: lista de escolas da cidade. Junta as duas grafias do nome (correta e com letra quebrada do censo 2021-2024),
-- pega o ano mais recente de cada escola, e traz só particulares em atividade com matrícula. Sem limite de 1000 linhas.
create materialized view if not exists public.raiox_municipios_mv as
  select distinct sg_uf, no_municipio, co_municipio from public.inep_escolas;
create index if not exists raiox_municipios_mv_uf on public.raiox_municipios_mv (sg_uf);
revoke all on public.raiox_municipios_mv from anon, authenticated;

create or replace function public.raiox_escolas(p_uf text, p_cidade text)
returns table (co_entidade text, no_entidade text, no_municipio text, sg_uf text, qt_mat_total int, ano_censo int, qt_mat_inf int, qt_mat_fund int, qt_mat_med int)
language sql stable security definer
set search_path to 'public', 'extensions'
as $$
  with pat as (
    select string_agg(case when unaccent(ch) <> ch or ch = chr(65533) then '_' else lower(ch) end, '' order by n) as p
    from regexp_split_to_table(btrim(coalesce(p_cidade,'')), '') with ordinality as x(ch, n)
  ), mun as (
    select distinct m.co_municipio
    from public.raiox_municipios_mv m, pat
    where m.sg_uf = upper(btrim(p_uf)) and pat.p is not null and lower(m.no_municipio) like pat.p
  ), ult as (
    select distinct on (e.co_entidade) e.*
    from public.inep_escolas e
    where e.co_municipio in (select co_municipio from mun)
    order by e.co_entidade, e.ano_censo desc
  )
  select u.co_entidade::text, u.no_entidade, u.no_municipio, u.sg_uf, u.qt_mat_total::int, u.ano_censo::int,
         u.qt_mat_inf::int, u.qt_mat_fund::int, u.qt_mat_med::int
  from ult u
  where u.tp_dependencia = 4 and u.tp_situacao_funcionamento = 1
    and coalesce(u.qt_mat_inf,0) + coalesce(u.qt_mat_fund,0) + coalesce(u.qt_mat_med,0) > 0
  order by u.no_entidade
$$;
revoke all on function public.raiox_escolas(text,text) from public;
grant execute on function public.raiox_escolas(text,text) to anon, authenticated;
