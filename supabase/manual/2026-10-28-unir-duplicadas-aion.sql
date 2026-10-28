-- Fase D (Inbox da Áion): une as conversas duplicadas gravadas com "@s.whatsapp.net" na conversa padrão.
-- Move mensagens e vínculos, mantém quem estava atendendo e só então apaga a duplicada (que ficou sem nada).
do $$
declare d record; canon uuid; cj text;
begin
  for d in select * from whatsapp_conversations where is_aion_inbox and remote_jid like '%@s.whatsapp.net' loop
    canon := null;
    select id, remote_jid into canon, cj from whatsapp_conversations
      where is_aion_inbox and remote_jid = public.wa_normalize_jid(d.remote_jid) and id <> d.id;
    if canon is null then continue; end if;
    update whatsapp_messages set conversation_id = canon, remote_jid = cj where conversation_id = d.id;
    update aion_contacts set conversation_id = canon where conversation_id = d.id;
    update aion_keyword_hits set conversation_id = canon where conversation_id = d.id;
    update aion_scheduled_messages set conversation_id = canon where conversation_id = d.id;
    update capture_trigger_hits set conversation_id = canon where conversation_id = d.id;
    update broadcast_recipients set conversation_id = canon where conversation_id = d.id;
    update broadcast_reply_events set conversation_id = canon where conversation_id = d.id;
    update whatsapp_scheduled_messages set conversation_id = canon where conversation_id = d.id;
    if d.assigned_user_id is not null then
      update whatsapp_conversations set assigned_user_id = d.assigned_user_id, assigned_user_name = d.assigned_user_name, status = 'open', bot_active = false where id = canon;
    end if;
    delete from whatsapp_conversations where id = d.id;
  end loop;
end $$;
select count(*) as restantes_com_sufixo from whatsapp_conversations where is_aion_inbox and remote_jid like '%@%';  -- deve dar 0
