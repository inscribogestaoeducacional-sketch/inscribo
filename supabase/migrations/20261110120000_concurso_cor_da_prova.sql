-- Cor das faixas e destaques da prova impressa (vazio = cor da escola).
alter table public.contests add column if not exists print_color text check (print_color is null or print_color ~ '^#[0-9a-fA-F]{6}$');
