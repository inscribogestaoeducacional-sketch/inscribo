-- Imagens das questões: bucket PRIVADO (nada fica público antes da prova). Caminho: <institution_id>/<contest_id>/<arquivo>
insert into storage.buckets (id, name, public) values ('contest-media', 'contest-media', false) on conflict (id) do nothing;

create policy contest_media_manage on storage.objects for all to authenticated
  using (bucket_id = 'contest-media' and public.contest_user_can_manage(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'contest-media' and public.contest_user_can_manage(((storage.foldername(name))[1])::uuid));

create policy contest_media_teacher on storage.objects for all to authenticated
  using (bucket_id = 'contest-media' and public.contest_my_teacher_id(((storage.foldername(name))[1])::uuid) is not null)
  with check (bucket_id = 'contest-media' and public.contest_my_teacher_id(((storage.foldername(name))[1])::uuid) is not null);
