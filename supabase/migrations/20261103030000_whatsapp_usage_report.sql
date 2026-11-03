-- Painel de WhatsApp (Super Admin): consumo por período e por dia, sem valores em dinheiro.
-- Só lê whatsapp_messages. Horário de Brasília. Ignora histórico importado e caixa de entrada da Áion.

create or replace function public.whatsapp_usage_report(p_from date, p_to date)
returns table(
  institution_id uuid, name text,
  received bigint, sent bigint, sent_template bigint,
  conversations bigint, conv_by_client bigint, conv_by_school bigint,
  failed bigint, delivered_pct numeric, read_pct numeric,
  tpl_marketing bigint, tpl_utility bigint, tpl_auth bigint,
  ai_improve bigint, ai_summary bigint, last_received timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
declare v_f timestamptz; v_t timestamptz;
begin
  if not (is_super_admin_user() or auth.uid() is null) then raise exception 'Apenas Super Admin' using errcode='42501'; end if;
  v_f := p_from::timestamp at time zone 'America/Sao_Paulo';
  v_t := (p_to + 1)::timestamp at time zone 'America/Sao_Paulo';
  return query
  with base as (
    select m.institution_id, m.direction, m.message_type, m.status, m.remote_jid, m.created_at,
      case when m.direction='outbound' and m.message_type='template' and m.status<>'failed'
           then upper(coalesce(_tpl_category(m.institution_id, m.content),'UTILITY')) end cat
    from whatsapp_messages m
    where m.created_at>=v_f and m.created_at<v_t
      and not coalesce(m.is_history_sync,false) and not coalesce(m.is_aion_inbox,false)),
  first_dir as (
    select distinct on (b.institution_id, b.remote_jid) b.institution_id, b.remote_jid, b.direction
    from base b order by b.institution_id, b.remote_jid, b.created_at),
  conv as (
    select f.institution_id, count(*) total,
      count(*) filter (where f.direction='inbound') by_client,
      count(*) filter (where f.direction='outbound') by_school
    from first_dir f group by f.institution_id),
  msg as (
    select b.institution_id,
      count(*) filter (where b.direction='inbound') rec,
      count(*) filter (where b.direction='outbound') snt,
      count(*) filter (where b.direction='outbound' and b.message_type='template') tpl,
      max(b.created_at) filter (where b.direction='inbound') lastrec,
      count(*) filter (where b.direction='outbound' and b.status='failed') fail,
      count(*) filter (where b.direction='outbound' and b.status in ('delivered','read')) dlv,
      count(*) filter (where b.direction='outbound' and b.status='read') rd,
      count(*) filter (where b.direction='outbound' and b.status<>'failed') ok_out,
      count(*) filter (where b.cat='MARKETING') t_m,
      count(*) filter (where b.cat='AUTHENTICATION') t_a,
      count(*) filter (where b.cat is not null and b.cat not in ('MARKETING','AUTHENTICATION')) t_u
    from base b group by b.institution_id),
  ai as (
    select u.institution_id,
      sum(u.calls) filter (where u.kind='improve') imp, sum(u.calls) filter (where u.kind='summary') sm
    from wa_ai_usage u where u.day>=p_from and u.day<=p_to group by u.institution_id)
  select i.id, i.name::text,
    coalesce(msg.rec,0), coalesce(msg.snt,0), coalesce(msg.tpl,0),
    coalesce(conv.total,0), coalesce(conv.by_client,0), coalesce(conv.by_school,0),
    coalesce(msg.fail,0),
    round(100.0*msg.dlv/nullif(msg.ok_out,0),1), round(100.0*msg.rd/nullif(msg.ok_out,0),1),
    coalesce(msg.t_m,0), coalesce(msg.t_u,0), coalesce(msg.t_a,0),
    coalesce(ai.imp,0)::bigint, coalesce(ai.sm,0)::bigint, msg.lastrec
  from institutions i
  left join msg on msg.institution_id=i.id
  left join conv on conv.institution_id=i.id
  left join ai on ai.institution_id=i.id
  where i.plan_status is distinct from 'cancelled'
  order by coalesce(msg.rec,0)+coalesce(msg.snt,0) desc, i.name;
end $$;

create or replace function public.whatsapp_usage_report_daily(p_from date, p_to date, p_institution uuid default null)
returns table(day date, received bigint, sent bigint, tpl_marketing bigint, tpl_utility bigint, tpl_auth bigint)
language plpgsql stable security definer set search_path to 'public' as $$
declare v_f timestamptz; v_t timestamptz;
begin
  if not (is_super_admin_user() or auth.uid() is null) then raise exception 'Apenas Super Admin' using errcode='42501'; end if;
  v_f := p_from::timestamp at time zone 'America/Sao_Paulo';
  v_t := (p_to + 1)::timestamp at time zone 'America/Sao_Paulo';
  return query
  with base as (
    select (m.created_at at time zone 'America/Sao_Paulo')::date d, m.direction, m.message_type, m.status,
      case when m.direction='outbound' and m.message_type='template' and m.status<>'failed'
           then upper(coalesce(_tpl_category(m.institution_id, m.content),'UTILITY')) end cat
    from whatsapp_messages m
    where m.created_at>=v_f and m.created_at<v_t
      and (p_institution is null or m.institution_id=p_institution)
      and not coalesce(m.is_history_sync,false) and not coalesce(m.is_aion_inbox,false))
  select b.d,
    count(*) filter (where b.direction='inbound'),
    count(*) filter (where b.direction='outbound'),
    count(*) filter (where b.cat='MARKETING'),
    count(*) filter (where b.cat is not null and b.cat not in ('MARKETING','AUTHENTICATION')),
    count(*) filter (where b.cat='AUTHENTICATION')
  from base b group by b.d order by b.d;
end $$;

grant execute on function public.whatsapp_usage_report(date, date) to authenticated;
grant execute on function public.whatsapp_usage_report_daily(date, date, uuid) to authenticated;

-- Obs.: uma função com nome antigo (whatsapp_usage_daily(date,date,uuid)) foi criada por engano e pode ser removida:
-- drop function if exists public.whatsapp_usage_daily(date, date, uuid);
