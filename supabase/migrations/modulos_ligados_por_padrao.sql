-- Escola nova nasce com Transmissões e Base de alunos liberadas.
create or replace function public.institution_default_modules()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.broadcast_settings (institution_id, enabled) values (new.id, true) on conflict (institution_id) do nothing;
  insert into public.student_base_settings (institution_id, module_enabled) values (new.id, true) on conflict (institution_id) do nothing;
  return new;
end $$;
revoke all on function public.institution_default_modules() from public, anon, authenticated;
create trigger institutions_default_modules_trg after insert on public.institutions
  for each row execute function public.institution_default_modules();
insert into public.broadcast_settings (institution_id, enabled) select id, true from public.institutions on conflict (institution_id) do nothing;
insert into public.student_base_settings (institution_id, module_enabled) select id, true from public.institutions on conflict (institution_id) do nothing;
