-- Proposta de redação e duração da prova (impressas no caderno).
alter table public.contests add column if not exists essay_prompt text, add column if not exists exam_duration text;
