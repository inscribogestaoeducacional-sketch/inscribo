-- Indicação de escolas: quem usa a Áion Edu indica o gestor de outra escola e ganha o prêmio
-- quando a escola indicada paga a implantação. Toda indicação válida vira lead no CRM da Áion (origem "Indicação").
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  referrer_user_id uuid not null references public.users(id) on delete cascade,
  referrer_institution_id uuid,
  referrer_name text,
  referrer_school text,
  gestor_name text not null,
  gestor_whatsapp text not null,
  gestor_email text,
  school_name text not null,
  status text not null default 'indicado' check (status in ('indicado','em_contato','fechou','pago','nao_fechou','ja_no_crm')),
  prize numeric not null default 500,
  crm_lead_id uuid references public.crm_leads(id) on delete set null,
  closed_at timestamptz,
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists referrals_referrer_idx on public.referrals(referrer_user_id, created_at desc);
create index if not exists referrals_status_idx on public.referrals(status);
alter table public.referrals enable row level security;

drop policy if exists referrals_own_select on public.referrals;
create policy referrals_own_select on public.referrals for select to authenticated using (referrer_user_id = auth.uid());
drop policy if exists referrals_admin_all on public.referrals;
create policy referrals_admin_all on public.referrals for all to authenticated using (is_super_admin_user()) with check (is_super_admin_user());

-- Valor do prêmio e texto da mensagem ficam em platform_settings (só a Áion edita).
insert into public.platform_settings(key, value) values
  ('referral_prize', '500'),
  ('referral_message', 'Olá, {gestor}! {indicador}, da {escola_indicador}, indicou você para conhecer a Áion Edu, o sistema que organiza a captação e a matrícula da escola. Parabéns pela indicação! Posso te mostrar como funciona em poucos minutos?')
on conflict (key) do nothing;

-- Quem usa o sistema só precisa saber o valor do prêmio.
create or replace function public.referral_prize_value() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select nullif(value,'')::numeric from platform_settings where key='referral_prize'), 500)
$$;

-- Cria a indicação: confere duplicidade no CRM e já cria o lead quando vale.
create or replace function public.create_referral(p_gestor_name text, p_gestor_whatsapp text, p_school_name text, p_gestor_email text default null)
returns public.referrals
language plpgsql security definer set search_path = public as $$
declare
  u record; digits text; tail text; mail text; prize numeric; dup boolean; lead_id uuid; inst_name text; r public.referrals;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  select id, full_name, institution_id, active, user_type into u from users where id = auth.uid();
  if u.id is null or coalesce(u.active, true) = false or u.user_type not in ('school_user','gestor_rede') then raise exception 'sem permissão'; end if;
  if length(trim(coalesce(p_gestor_name,''))) < 2 or length(trim(coalesce(p_school_name,''))) < 2 then raise exception 'informe o gestor e a escola'; end if;
  digits := regexp_replace(coalesce(p_gestor_whatsapp,''), '\D', '', 'g');
  if length(digits) < 10 then raise exception 'WhatsApp inválido'; end if;
  tail := right(digits, 10);
  mail := nullif(lower(trim(coalesce(p_gestor_email,''))), '');
  prize := referral_prize_value();
  select i.name into inst_name from institutions i where i.id = u.institution_id;
  dup := exists (select 1 from crm_leads c where right(regexp_replace(coalesce(c.phone,''),'\D','','g'),10) = tail or (mail is not null and lower(c.email) = mail))
      or exists (select 1 from referrals x where right(x.gestor_whatsapp,10) = tail and x.status <> 'nao_fechou');
  if not dup then
    insert into crm_leads(name, school_name, phone, email, stage, origin, notes)
    values (trim(p_gestor_name), trim(p_school_name), digits, mail, 'interesse', 'Indicação',
            'Indicado por ' || coalesce(u.full_name,'usuário') || coalesce(' (' || inst_name || ')', '') || '. Prêmio combinado: R$ ' || prize)
    returning id into lead_id;
  end if;
  insert into referrals(referrer_user_id, referrer_institution_id, referrer_name, referrer_school, gestor_name, gestor_whatsapp, gestor_email, school_name, status, prize, crm_lead_id)
  values (u.id, u.institution_id, u.full_name, inst_name, trim(p_gestor_name), digits, mail, trim(p_school_name), case when dup then 'ja_no_crm' else 'indicado' end, prize, lead_id)
  returning * into r;
  return r;
end $$;

create or replace function public.referrals_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'fechou' and old.status is distinct from 'fechou' and new.closed_at is null then new.closed_at := now(); end if;
  if new.status = 'pago' and old.status is distinct from 'pago' and new.paid_at is null then new.paid_at := now(); end if;
  return new;
end $$;
drop trigger if exists referrals_touch_trg on public.referrals;
create trigger referrals_touch_trg before update on public.referrals for each row execute function public.referrals_touch();

revoke all on function public.create_referral(text,text,text,text) from public, anon;
grant execute on function public.create_referral(text,text,text,text) to authenticated;
revoke all on function public.referral_prize_value() from public, anon;
grant execute on function public.referral_prize_value() to authenticated;
