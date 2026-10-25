create or replace function public.lead_unanswered_tick() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare r record; n int := 0; v_name text;
begin
  if extract(hour from (now() at time zone 'America/Fortaleza')) not between 7 and 18 then return 0; end if;
  for r in
    select * from (
      select l.id, l.institution_id, l.assigned_to, l.responsible_name, l.student_name, l.created_at,
             c.id conv_id, c.remote_jid,
             row_number() over (partition by l.institution_id order by l.created_at) rn
        from leads l
        join lateral (select c.id, c.remote_jid from whatsapp_conversations c
                       where c.lead_id = l.id and c.institution_id = l.institution_id
                       order by c.last_message_at desc nulls last limit 1) c on true
       where l.deleted_at is null and l.status = 'new'
         and l.created_at < now() - interval '2 hours' and l.created_at > now() - interval '48 hours'
         and not exists (select 1 from lead_unanswered_sent s where s.lead_id = l.id)
         and not exists (select 1 from whatsapp_messages m
                          where m.institution_id = l.institution_id and m.remote_jid = c.remote_jid and m.from_me)
    ) q where rn <= 10
  loop
    v_name := coalesce(nullif(r.responsible_name,''), nullif(r.student_name,''), 'Um lead');
    if r.assigned_to is not null then
      insert into user_notifications(user_id, institution_id, type, title, body, remote_jid, conversation_id, url)
        values (r.assigned_to, r.institution_id, 'lead_unanswered', 'Lead sem resposta há 2 horas',
                v_name || ' chegou há mais de 2 horas e ainda não recebeu resposta.', r.remote_jid, r.conv_id, '/leads?open=' || r.id);
    else
      insert into user_notifications(user_id, institution_id, type, title, body, remote_jid, conversation_id, url)
        select u.id, r.institution_id, 'lead_unanswered', 'Lead sem resposta há 2 horas',
               v_name || ' chegou há mais de 2 horas e ainda não recebeu resposta (sem responsável).', r.remote_jid, r.conv_id, '/leads?open=' || r.id
          from users u where u.institution_id = r.institution_id and u.active and u.role in ('admin','manager');
    end if;
    insert into lead_unanswered_sent(lead_id) values (r.id) on conflict do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;
