create or replace function public.trg_notify_exit_survey() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  begin
    insert into user_notifications(user_id, institution_id, type, title, body, url)
      select u.id, new.institution_id, 'exit_survey_answered', 'Pesquisa de saída respondida',
             coalesce(nullif(new.student_name,''), 'Um aluno') || ': a família respondeu a pesquisa de saída.', '/transferencias'
        from users u where u.institution_id = new.institution_id and u.active and u.role in ('admin','manager');
  exception when others then null;
  end;
  return new;
end $$;
