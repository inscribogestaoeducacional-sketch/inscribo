alter table public.contests add column if not exists take_home jsonb not null default '{}'::jsonb;
