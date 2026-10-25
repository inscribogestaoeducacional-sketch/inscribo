-- Lembrete das 18h: vira "Resumo do dia" quando há dado útil; senão mantém o texto antigo.
create or replace function public.push_daily_reminders() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare r record; today0 timestamptz := (date_trunc('day', now() at time zone 'America/Fortaleza')) at time zone 'America/Fortaleza';
        w int; nl int; vt int; vm int; parts text[];
begin
  for r in
    select p.user_id, p.daily_reminder, u.institution_id, s.last_seen_at, s.last_reminder_at
    from notif_prefs p join users u on u.id = p.user_id and u.active
    left join user_seen s on s.user_id = p.user_id
    where p.daily_reminder > 0 and u.role in ('admin','manager')
      and exists (select 1 from push_subscriptions x where x.user_id = p.user_id)
      and coalesce(s.last_seen_at, '-infinity') < today0 - ((p.daily_reminder - 1) || ' days')::interval
      and coalesce(s.last_reminder_at, '-infinity') < today0 - ((p.daily_reminder - 1) || ' days')::interval
  loop
    select count(*) into w from whatsapp_conversations c where c.institution_id = r.institution_id and c.status = 'waiting' and coalesce(c.remote_jid,'') not like '%@g.us';
    select count(*) into nl from leads l where l.institution_id = r.institution_id and l.deleted_at is null and l.created_at >= today0;
    select count(*) filter (where v.scheduled_date < today0 + interval '1 day'),
           count(*) filter (where v.scheduled_date >= today0 + interval '1 day')
      into vt, vm from visits v
     where v.institution_id = r.institution_id and v.status = 'scheduled'
       and v.scheduled_date >= now() and v.scheduled_date < today0 + interval '2 days';
    parts := '{}';
    if nl > 0 then parts := parts || (nl || case when nl = 1 then ' lead novo hoje' else ' leads novos hoje' end); end if;
    if vt > 0 then parts := parts || (vt || case when vt = 1 then ' visita ainda hoje' else ' visitas ainda hoje' end); end if;
    if vm > 0 then parts := parts || (vm || case when vm = 1 then ' visita amanhã' else ' visitas amanhã' end); end if;
    if w > 0 then parts := parts || (w || case when w = 1 then ' conversa aguardando' else ' conversas aguardando' end); end if;
    if array_length(parts,1) > 0 then
      perform push_notify(array[r.user_id], 'Resumo do dia', array_to_string(parts, ', ') || '.', '/home', 'lembrete-aion');
    else
      perform push_notify(array[r.user_id], 'Dê uma olhadinha na Áion', 'Veja como está a escola hoje: leads, visitas e matrículas.', '/home', 'lembrete-aion');
    end if;
    insert into user_seen(user_id, last_seen_at, last_reminder_at) values (r.user_id, coalesce(r.last_seen_at, 'epoch'), now())
    on conflict (user_id) do update set last_reminder_at = now();
  end loop;
end $$;
