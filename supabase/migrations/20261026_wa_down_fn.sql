-- Aviso ao administrador da escola quando o WhatsApp está fora (no máximo 1 a cada 6h por escola).
create or replace function public.wa_down_tick() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare r record; n int := 0;
begin
  for r in
    select h.institution_id, min(h.down_since) since
      from whatsapp_phone_health h
     where h.institution_id is not null and h.status is not null and h.status <> 'CONNECTED'
       and h.down_since < now() - interval '10 minutes'
       and h.institution_id <> all (notif.ignored_institutions())
       and not exists (select 1 from wa_down_alerts_sent s where s.institution_id = h.institution_id and s.sent_at > now() - interval '6 hours')
     group by h.institution_id
  loop
    insert into user_notifications(user_id, institution_id, type, title, body, url)
      select u.id, r.institution_id, 'whatsapp_down', 'WhatsApp da escola desconectado',
             'As mensagens param até reconectar. Fale com a equipe Áion se não voltar.', '/settings?tab=whatsapp'
        from users u where u.institution_id = r.institution_id and u.active and u.role = 'admin';
    insert into wa_down_alerts_sent(institution_id) values (r.institution_id)
      on conflict (institution_id) do update set sent_at = now();
    n := n + 1;
  end loop;
  return n;
end $$;
