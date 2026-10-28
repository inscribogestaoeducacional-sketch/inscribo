-- CRM comercial (Super Admin): registro de tudo que acontece no lead + exclusão que funciona.
-- 1) crm_lead_events: linha do tempo automática (criou, mudou de etapa, editou campos, reunião, proposta, excluiu).
--    Não tem chave estrangeira para o lead, assim o registro continua depois que o lead é excluído.
-- 2) crm_delete_lead(): exclui o lead soltando as conversas do WhatsApp e barrando se houver comissão.

create table if not exists public.crm_lead_events (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid,
  lead_name   text,
  event       text not null,
  detail      jsonb not null default '{}'::jsonb,
  actor_id    uuid,
  actor_name  text,
  created_at  timestamptz not null default now()
);
create index if not exists crm_lead_events_lead_idx on public.crm_lead_events (lead_id, created_at desc);
create index if not exists crm_lead_events_time_idx on public.crm_lead_events (created_at desc);
alter table public.crm_lead_events enable row level security;
drop policy if exists crm_lead_events_read on public.crm_lead_events;
create policy crm_lead_events_read on public.crm_lead_events for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.user_type in ('admin_geral','consultant')));

create or replace function public.crm_log_event(p_lead uuid, p_name text, p_event text, p_detail jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select full_name into v_name from public.users where id = auth.uid();
  insert into public.crm_lead_events(lead_id, lead_name, event, detail, actor_id, actor_name)
  values (p_lead, p_name, p_event, coalesce(p_detail, '{}'::jsonb), auth.uid(), coalesce(v_name, case when auth.uid() is null then 'Sistema' else null end));
end $$;
revoke all on function public.crm_log_event(uuid, text, text, jsonb) from public, anon, authenticated;

-- Leads
create or replace function public.crm_leads_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text; ch jsonb := '{}'::jsonb; o jsonb; n jsonb;
begin
  if tg_op = 'INSERT' then
    perform crm_log_event(new.id, new.school_name, 'created', jsonb_build_object('stage', new.stage, 'origin', new.origin));
    return new;
  elsif tg_op = 'DELETE' then
    perform crm_log_event(old.id, old.school_name, 'deleted', jsonb_build_object('stage', old.stage, 'contact', old.name));
    return old;
  end if;
  if new.stage is distinct from old.stage then
    perform crm_log_event(new.id, new.school_name, 'stage', jsonb_build_object('from', old.stage, 'to', new.stage));
  end if;
  o := to_jsonb(old); n := to_jsonb(new);
  foreach k in array array['name','school_name','phone','email','city','state','origin','monthly_value','implementation_value','consultant_id','next_followup','notes'] loop
    if o->k is distinct from n->k then ch := ch || jsonb_build_object(k, jsonb_build_object('from', o->k, 'to', n->k)); end if;
  end loop;
  if ch <> '{}'::jsonb then perform crm_log_event(new.id, new.school_name, 'edited', jsonb_build_object('changes', ch)); end if;
  return new;
end $$;
drop trigger if exists crm_leads_log_trg on public.crm_leads;
create trigger crm_leads_log_trg after insert or update or delete on public.crm_leads for each row execute function public.crm_leads_log();

-- Reuniões
create or replace function public.crm_meetings_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; v_lead uuid; v_name text;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  v_lead := r.lead_id;
  select school_name into v_name from public.crm_leads where id = v_lead;
  if tg_op = 'INSERT' then
    perform crm_log_event(v_lead, v_name, 'meeting_created', jsonb_build_object('title', new.title, 'scheduled_at', new.scheduled_at));
  elsif tg_op = 'DELETE' then
    perform crm_log_event(v_lead, v_name, 'meeting_deleted', jsonb_build_object('title', old.title, 'scheduled_at', old.scheduled_at));
  else
    if new.status is distinct from old.status then
      perform crm_log_event(v_lead, v_name, 'meeting_status', jsonb_build_object('title', new.title, 'from', old.status, 'to', new.status));
    end if;
    if new.scheduled_at is distinct from old.scheduled_at then
      perform crm_log_event(v_lead, v_name, 'meeting_rescheduled', jsonb_build_object('title', new.title, 'from', old.scheduled_at, 'to', new.scheduled_at));
    end if;
  end if;
  return r;
end $$;
drop trigger if exists crm_meetings_log_trg on public.crm_meetings;
create trigger crm_meetings_log_trg after insert or update or delete on public.crm_meetings for each row execute function public.crm_meetings_log();

-- Propostas
create or replace function public.crm_proposals_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if new.lead_id is null then return new; end if;
  select school_name into v_name from public.crm_leads where id = new.lead_id;
  if tg_op = 'INSERT' then
    perform crm_log_event(new.lead_id, v_name, 'proposal_created', jsonb_build_object('status', new.status));
  elsif new.status is distinct from old.status then
    perform crm_log_event(new.lead_id, v_name, 'proposal_status', jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;
drop trigger if exists crm_proposals_log_trg on public.proposals;
create trigger crm_proposals_log_trg after insert or update on public.proposals for each row execute function public.crm_proposals_log();

-- Exclusão segura do lead (só Super Admin)
create or replace function public.crm_delete_lead(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_super_admin_user() then raise exception 'Sem permissão para excluir leads.'; end if;
  select count(*) into n from public.consultant_commissions where lead_id = p_id;
  if n > 0 then
    return jsonb_build_object('ok', false, 'error', 'Este lead tem comissão de consultor registrada. Exclua ou ajuste a comissão antes.');
  end if;
  update public.whatsapp_conversations set aion_lead_id = null where aion_lead_id = p_id;
  delete from public.crm_leads where id = p_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.crm_delete_lead(uuid) from public, anon;
grant execute on function public.crm_delete_lead(uuid) to authenticated;
