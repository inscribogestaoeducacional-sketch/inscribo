-- Concurso de Bolsas: o professor edita e apaga as próprias questões enquanto não forem aprovadas
-- (antes: só rascunho/devolvida para editar e só rascunho para apagar). Questão aprovada trava para o professor.
drop policy if exists contest_questions_teacher_update on public.contest_questions;
create policy contest_questions_teacher_update on public.contest_questions for update to authenticated
  using (author_teacher_id = contest_my_teacher_id(institution_id) and status = any (array['draft','sent','returned']))
  with check (author_teacher_id = contest_my_teacher_id(institution_id) and status = any (array['draft','sent']));

drop policy if exists contest_questions_teacher_delete on public.contest_questions;
create policy contest_questions_teacher_delete on public.contest_questions for delete to authenticated
  using (author_teacher_id = contest_my_teacher_id(institution_id) and status = any (array['draft','sent','returned']));
