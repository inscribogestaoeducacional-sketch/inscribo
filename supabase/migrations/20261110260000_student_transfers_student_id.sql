-- Liga o registro de Transferências ao aluno (students.id). Aplicado via MCP.
alter table public.student_transfers add column if not exists student_id uuid references public.students(id) on delete set null;
create index if not exists student_transfers_student_id_idx on public.student_transfers(student_id) where student_id is not null;
-- transfers_erp_gap passou a casar por student_id (nome só quando o registro não tem vínculo) e os registros antigos foram ligados quando o nome bate com um único aluno.
