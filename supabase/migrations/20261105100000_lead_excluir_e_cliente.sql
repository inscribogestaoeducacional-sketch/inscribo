-- 1) Excluir lead nunca mais trava: matrícula, conversa e mensagem só perdem o vínculo.
alter table public.enrollments drop constraint if exists enrollments_lead_id_fkey;
alter table public.enrollments add constraint enrollments_lead_id_fkey foreign key (lead_id) references public.leads(id) on delete set null;
alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_lead_id_fkey;
alter table public.whatsapp_messages add constraint whatsapp_messages_lead_id_fkey foreign key (lead_id) references public.leads(id) on delete set null;
alter table public.whatsapp_conversations drop constraint if exists whatsapp_conversations_lead_id_fkey;
alter table public.whatsapp_conversations add constraint whatsapp_conversations_lead_id_fkey foreign key (lead_id) references public.leads(id) on delete set null;

-- 2) Lead que vira matrícula => o contato do WhatsApp passa a ser "Cliente" (só se ainda for desconhecido/lead).
create or replace function public.mark_contact_client_on_enrollment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_phone text;
begin
  select normalize_phone_br(l.phone) into v_phone from leads l where l.id = new.lead_id;
  if v_phone is not null and v_phone <> '' then
    update whatsapp_contacts set type = 'client'
     where institution_id = new.institution_id and phone = v_phone and type in ('unknown','lead');
  end if;
  return new;
end $$;
drop trigger if exists trg_mark_contact_client on public.enrollments;
create trigger trg_mark_contact_client after insert on public.enrollments
  for each row when (new.lead_id is not null) execute function public.mark_contact_client_on_enrollment();

-- 3) Corrige os contatos antigos que já têm matrícula.
update whatsapp_contacts c set type = 'client'
 from enrollments e join leads l on l.id = e.lead_id
 where e.institution_id = c.institution_id and normalize_phone_br(l.phone) = c.phone and c.type in ('unknown','lead');
