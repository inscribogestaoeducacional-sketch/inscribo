-- Resultado das campanhas da Áion (Caixa Áion): transmissões em massa e keywords/QR codes.
-- Resposta = 1ª mensagem recebida do contato em até 7 dias depois do envio.
create or replace function public.aion_campaign_results()
returns table (kind text, id uuid, name text, at timestamptz, status text,
               total int, sent int, failed int, delivered int, read int, replied int, leads int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_super_admin_user() or auth.uid() is null) then
    raise exception 'Apenas Super Admin';
  end if;
  return query
  select 'broadcast'::text, b.id, b.name, coalesce(b.started_at, b.created_at), b.status,
         coalesce(b.total_recipients,0),
         (select count(*) from aion_broadcast_recipients r where r.broadcast_id=b.id and r.status in ('sent','delivered','read'))::int,
         (select count(*) from aion_broadcast_recipients r where r.broadcast_id=b.id and r.status='failed')::int,
         (select count(*) from aion_broadcast_recipients r where r.broadcast_id=b.id and r.status in ('delivered','read'))::int,
         (select count(*) from aion_broadcast_recipients r where r.broadcast_id=b.id and r.status='read')::int,
         (select count(*) from aion_broadcast_recipients r where r.broadcast_id=b.id and exists (
            select 1 from whatsapp_messages m where m.is_aion_inbox and m.remote_jid=r.remote_jid and not coalesce(m.from_me,false)
              and m.created_at > r.sent_at and m.created_at < r.sent_at + interval '7 days'))::int,
         0
    from aion_broadcasts b
  union all
  select 'keyword'::text, k.id, coalesce(nullif(k.label,''), k.keyword), k.created_at, case when k.is_active then 'active' else 'inactive' end,
         0, 0, 0, 0, 0,
         (select count(*) from aion_keyword_hits h where h.keyword_id=k.id)::int,
         (select count(*) from whatsapp_conversations c where c.is_aion_inbox and c.source_keyword_id=k.id)::int
    from aion_keywords k
  order by 4 desc;
end $$;
grant execute on function public.aion_campaign_results() to authenticated;
