-- Horário de silêncio dos avisos (hora cheia, fuso de Fortaleza). NULL = desligado.
alter table public.notif_prefs add column if not exists quiet_start smallint check (quiet_start between 0 and 23);
alter table public.notif_prefs add column if not exists quiet_end smallint check (quiet_end between 0 and 23);
