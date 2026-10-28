-- Fase A: número de WhatsApp padronizado na entrada (conversas novas).
-- A função já foi aplicada no banco; o trigger ficou pendente de confirmação.
create or replace function public.wa_normalize_jid(raw text)
returns text language plpgsql immutable as $$
declare d text;
begin
  if raw is null then return null; end if;
  if raw like '%@g.us' then return raw; end if;
  d := regexp_replace(regexp_replace(raw, '@.*$', ''), '\D', '', 'g');
  if d = '' then return raw; end if;
  d := regexp_replace(d, '^0+', '');
  if d like '55%' and length(d) in (12, 13) then
    null;
  elsif length(d) = 10 or (length(d) = 11 and substr(d, 3, 1) = '9') then
    d := '55' || d;
  else
    return d;
  end if;
  if length(d) = 12 and substr(d, 5, 1) between '6' and '9' then
    d := substr(d, 1, 4) || '9' || substr(d, 5);
  end if;
  return d;
end $$;

create or replace function public.whatsapp_conversations_normalize_jid()
returns trigger language plpgsql as $$
declare n text;
begin
  n := public.wa_normalize_jid(new.remote_jid);
  if n is null or n = new.remote_jid then return new; end if;
  if exists (select 1 from public.whatsapp_conversations c
             where c.institution_id is not distinct from new.institution_id and c.remote_jid = new.remote_jid) then
    return new;
  end if;
  new.remote_jid := n;
  return new;
end $$;

drop trigger if exists trg_normalize_conversation_jid on public.whatsapp_conversations;
create trigger trg_normalize_conversation_jid
  before insert on public.whatsapp_conversations
  for each row execute function public.whatsapp_conversations_normalize_jid();
