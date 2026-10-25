-- Silêncio: o push é segurado (o sino continua). Filtro central em push_notify.
create or replace function public.push_quiet_now(p_user uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce((
    select case
      when p.quiet_start is null or p.quiet_end is null or p.quiet_start = p.quiet_end then false
      when p.quiet_start < p.quiet_end then h >= p.quiet_start and h < p.quiet_end
      else h >= p.quiet_start or h < p.quiet_end end
    from notif_prefs p, lateral (select extract(hour from (now() at time zone 'America/Fortaleza'))::int h) x
    where p.user_id = p_user), false)
$$;

create or replace function public.push_notify(p_users uuid[], p_title text, p_body text, p_url text, p_tag text)
returns void language plpgsql security definer set search_path = public, net, extensions as $$
declare c push_config; u uuid[];
begin
  select * into c from push_config where id = 1;
  if c.push_url is null or c.secret is null or p_users is null or array_length(p_users,1) is null then return; end if;
  select coalesce(array_agg(x), '{}') into u from unnest(p_users) x where not push_quiet_now(x);
  if array_length(u,1) is null then return; end if;
  perform net.http_post(url := c.push_url,
    headers := jsonb_build_object('content-type','application/json','x-push-secret', c.secret),
    body := jsonb_build_object('user_ids', to_jsonb(u), 'title', p_title, 'body', p_body, 'url', p_url, 'tag', p_tag));
end $$;

create or replace function public.push_prefs_get() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); r text; p notif_prefs;
begin
  select * into p from notif_prefs where user_id = uid;
  select role into r from users where id = uid;
  return jsonb_build_object('new_message', coalesce(p.new_message, true), 'transfer', coalesce(p.transfer, true),
    'daily_reminder', coalesce(p.daily_reminder, case when r = 'admin' then 1 else 0 end), 'can_reminder', r in ('admin','manager'),
    'role', r, 'quiet_start', p.quiet_start, 'quiet_end', p.quiet_end);
end $$;

create or replace function public.push_quiet_set(p_start int, p_end int) returns void
language sql security definer set search_path = public, extensions as $$
  insert into notif_prefs(user_id, quiet_start, quiet_end, daily_reminder, updated_at)
  values (auth.uid(), p_start, p_end, case when (select role from users where id = auth.uid()) = 'admin' then 1 else 0 end, now())
  on conflict (user_id) do update set quiet_start = excluded.quiet_start, quiet_end = excluded.quiet_end, updated_at = now();
$$;
revoke all on function public.push_quiet_set(int,int) from public, anon;
grant execute on function public.push_quiet_set(int,int) to authenticated;
