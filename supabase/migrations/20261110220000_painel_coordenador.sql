-- Painel do coordenador por segmento: segmentos por usuário + função do painel (somente leitura, sem contato).
create table if not exists public.coordinator_segments (
  user_id uuid not null references public.users(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  segments text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, institution_id)
);
alter table public.coordinator_segments enable row level security;
-- Políticas (coordinator_segments_read / _write) e a função coordinator_dashboard(p_inst, p_year)
-- foram aplicadas direto no projeto Supabase Edu (migration "painel_coordenador").
