-- Academia Áion Edu: dúvidas ("Tire suas dúvidas") com escalonamento para a equipe da Áion (Super Admin).
create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid,
  user_id uuid not null references public.users(id) on delete cascade,
  subject text, route text,
  status text not null default 'ai' check (status in ('ai','escalated','resolved')),
  escalated_at timestamptz, resolved_at timestamptz, resolved_by uuid,
  staff_unread boolean not null default false,
  user_unread int not null default 0,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  author_type text not null check (author_type in ('user','ai','staff')),
  author_id uuid,
  body text not null check (char_length(body) between 1 and 6000),
  created_at timestamptz not null default now()
);
create index if not exists support_threads_user_idx on public.support_threads (user_id, last_message_at desc);
create index if not exists support_threads_status_idx on public.support_threads (status, last_message_at desc);
create index if not exists support_messages_thread_idx on public.support_messages (thread_id, created_at);
alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

create or replace function public.is_support_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from users where id = auth.uid() and user_type = 'admin_geral') $$;
revoke all on function public.is_support_staff() from public, anon;
grant execute on function public.is_support_staff() to authenticated;
create policy support_threads_select on public.support_threads for select to authenticated using (user_id = auth.uid() or public.is_support_staff());
create policy support_messages_select on public.support_messages for select to authenticated using (exists (select 1 from public.support_threads t where t.id = thread_id and (t.user_id = auth.uid() or public.is_support_staff())));
do $$ begin
  begin alter publication supabase_realtime add table public.support_messages; exception when others then null; end;
  begin alter publication supabase_realtime add table public.support_threads; exception when others then null; end;
end $$;

-- aviso para os Super Admins: user_notifications (o gatilho trg_push_user_notif já manda o push)
create or replace function public.support_notify_staff(p_title text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into user_notifications (user_id, institution_id, type, title, body, url)
  select u.id, null, 'support_question', p_title, p_body, '/super-admin/support'
  from users u where u.user_type = 'admin_geral' and coalesce(u.active, true);
end $$;
revoke all on function public.support_notify_staff(text, text) from public, anon, authenticated;

create or replace function public.support_send(p_thread uuid, p_body text, p_route text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare t support_threads; body text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if char_length(body) = 0 or char_length(body) > 4000 then raise exception 'mensagem inválida'; end if;
  if p_thread is null then
    insert into support_threads (institution_id, user_id, subject, route)
    values (public.current_user_institution_id(), auth.uid(), left(body, 80), left(p_route, 120)) returning * into t;
  else
    select * into t from support_threads where id = p_thread and user_id = auth.uid();
    if not found then raise exception 'conversa não encontrada'; end if;
  end if;
  insert into support_messages (thread_id, author_type, author_id, body) values (t.id, 'user', auth.uid(), body);
  update support_threads set last_message_at = now(),
    status = case when status = 'resolved' then 'ai' else status end,
    resolved_at = case when status = 'resolved' then null else resolved_at end,
    staff_unread = case when status = 'escalated' then true else staff_unread end
  where id = t.id;
  if t.status = 'escalated' then perform public.support_notify_staff('Nova mensagem em dúvida aberta', left(body, 140)); end if;
  return t.id;
end $$;

create or replace function public.support_escalate(p_thread uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t support_threads; school text; who text;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  select * into t from support_threads where id = p_thread and user_id = auth.uid();
  if not found then raise exception 'conversa não encontrada'; end if;
  if t.status = 'escalated' then return; end if;
  update support_threads set status = 'escalated', escalated_at = now(), staff_unread = true, resolved_at = null, last_message_at = now() where id = t.id;
  insert into support_messages (thread_id, author_type, body)
  values (t.id, 'ai', 'Chamei a equipe da Áion. Quando responderem, o aviso chega no seu celular e a resposta aparece aqui.');
  select name into school from institutions where id = t.institution_id;
  select full_name into who from users where id = t.user_id;
  perform public.support_notify_staff('Nova dúvida de ' || coalesce(school, 'uma escola'), coalesce(who, 'Alguém') || ': ' || left(coalesce(t.subject, ''), 100));
end $$;

create or replace function public.support_close(p_thread uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  update support_threads set status = 'resolved', resolved_at = now(), resolved_by = auth.uid(), staff_unread = false
  where id = p_thread and (user_id = auth.uid() or public.is_support_staff());
end $$;

create or replace function public.support_mark_read(p_thread uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if public.is_support_staff() then update support_threads set staff_unread = false where id = p_thread;
  else update support_threads set user_unread = 0 where id = p_thread and user_id = auth.uid(); end if;
end $$;

create or replace function public.support_staff_list(p_status text default 'open')
returns table (id uuid, user_id uuid, user_name text, institution_id uuid, school_name text, subject text, status text, staff_unread boolean, escalated_at timestamptz, last_message_at timestamptz, last_body text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_support_staff() then raise exception 'sem permissão'; end if;
  return query
  select t.id, t.user_id, u.full_name, t.institution_id, i.name, t.subject, t.status, t.staff_unread, t.escalated_at, t.last_message_at,
         (select m.body from support_messages m where m.thread_id = t.id order by m.created_at desc limit 1)
  from support_threads t join users u on u.id = t.user_id left join institutions i on i.id = t.institution_id
  where (p_status = 'all' and t.status in ('escalated','resolved')) or (p_status = 'open' and t.status = 'escalated') or (p_status = 'resolved' and t.status = 'resolved')
  order by t.staff_unread desc, t.last_message_at desc limit 200;
end $$;

create or replace function public.support_staff_reply(p_thread uuid, p_body text, p_resolve boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare t support_threads; body text := btrim(coalesce(p_body, ''));
begin
  if not public.is_support_staff() then raise exception 'sem permissão'; end if;
  select * into t from support_threads where id = p_thread;
  if not found then raise exception 'conversa não encontrada'; end if;
  if char_length(body) > 0 then
    if char_length(body) > 4000 then raise exception 'mensagem muito longa'; end if;
    insert into support_messages (thread_id, author_type, author_id, body) values (t.id, 'staff', auth.uid(), body);
    update support_threads set user_unread = user_unread + 1, last_message_at = now(), staff_unread = false where id = t.id;
    insert into user_notifications (user_id, institution_id, type, title, body, url)
    values (t.user_id, t.institution_id, 'support_reply', 'A equipe da Áion respondeu', left(body, 140), '/academia?duvidas=1');
  end if;
  if p_resolve then
    update support_threads set status = 'resolved', resolved_at = now(), resolved_by = auth.uid(), staff_unread = false where id = t.id;
  end if;
end $$;

create or replace function public.support_open_count() returns int language sql stable security definer set search_path = public as $$
  select case when public.is_support_staff() then (select count(*)::int from support_threads where status = 'escalated' and staff_unread) else 0 end $$;

revoke all on function public.support_send(uuid, text, text), public.support_escalate(uuid), public.support_close(uuid), public.support_mark_read(uuid), public.support_staff_list(text), public.support_staff_reply(uuid, text, boolean), public.support_open_count() from public, anon;
grant execute on function public.support_send(uuid, text, text), public.support_escalate(uuid), public.support_close(uuid), public.support_mark_read(uuid), public.support_staff_list(text), public.support_staff_reply(uuid, text, boolean), public.support_open_count() to authenticated;
