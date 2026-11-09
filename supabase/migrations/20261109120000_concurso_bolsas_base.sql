-- Módulo Concurso de Bolsas — fase 1: base, professores, cotas e banco de questões.
-- Desligado por padrão; liga por escola em contest_settings.module_enabled.

-- 1) Novo tipo de usuário: professor do concurso (sem institution_id em users: o vínculo fica em contest_teachers,
--    assim as regras das demais tabelas, que olham users.institution_id, não dão nenhum acesso a ele).
alter table public.users drop constraint if exists users_user_type_check;
alter table public.users add constraint users_user_type_check
  check (user_type = any (array['school_user','consultant','admin_geral','gestor_rede','professor']));

-- 2) Tabelas
create table if not exists public.contest_settings (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
  module_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  year int not null default extract(year from now())::int,
  status text not null default 'draft' check (status in ('draft','open','closed','published')),
  exam_date timestamptz,
  grades text[] not null default '{}',
  alternatives_count int not null default 5 check (alternatives_count in (4,5)),
  versions_count int not null default 1 check (versions_count between 1 and 8),
  has_essay boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contests_inst_idx on public.contests(institution_id);

create table if not exists public.contest_subjects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  name text not null,
  position int not null default 0
);
create index if not exists contest_subjects_contest_idx on public.contest_subjects(contest_id);

create table if not exists public.contest_teachers (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid not null,
  full_name text not null,
  email text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (institution_id, user_id)
);
create index if not exists contest_teachers_user_idx on public.contest_teachers(user_id);

create table if not exists public.contest_quotas (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  teacher_id uuid not null references public.contest_teachers(id) on delete cascade,
  subject_id uuid not null references public.contest_subjects(id) on delete cascade,
  grade text not null,
  quantity int not null check (quantity > 0),
  due_date date,
  created_at timestamptz not null default now()
);
create index if not exists contest_quotas_teacher_idx on public.contest_quotas(teacher_id);

create table if not exists public.contest_questions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  quota_id uuid references public.contest_quotas(id) on delete set null,
  subject_id uuid not null references public.contest_subjects(id) on delete cascade,
  grade text not null,
  author_teacher_id uuid references public.contest_teachers(id) on delete set null,
  statement text not null default '',
  statement_images jsonb not null default '[]'::jsonb,
  alternatives jsonb not null default '[]'::jsonb,   -- [{text, image}] na ordem original
  correct_index int,
  difficulty text check (difficulty in ('facil','media','dificil')),
  comment text,
  no_shuffle boolean not null default false,
  status text not null default 'draft' check (status in ('draft','sent','returned','approved')),
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contest_questions_contest_idx on public.contest_questions(contest_id, subject_id, grade);
create index if not exists contest_questions_author_idx on public.contest_questions(author_teacher_id);

-- 3) Funções de acesso
create or replace function public.contest_user_can_manage(p_institution_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin_user() or exists (
    select 1 from users u
     where u.id = auth.uid() and coalesce(u.active, true)
       and p_institution_id in (u.institution_id, u.active_institution_id)
       and u.role in ('admin','manager')
       and exists (select 1 from contest_settings s where s.institution_id = p_institution_id and s.module_enabled)
  )
$$;

create or replace function public.contest_my_teacher_id(p_institution_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select t.id from contest_teachers t
   where t.user_id = auth.uid() and t.institution_id = p_institution_id and t.active
     and exists (select 1 from contest_settings s where s.institution_id = p_institution_id and s.module_enabled)
   limit 1
$$;

-- 4) Regras de acesso (RLS)
alter table public.contest_settings  enable row level security;
alter table public.contests          enable row level security;
alter table public.contest_subjects  enable row level security;
alter table public.contest_teachers  enable row level security;
alter table public.contest_quotas    enable row level security;
alter table public.contest_questions enable row level security;

create policy contest_settings_read on public.contest_settings for select to authenticated
  using (institution_id in (select coalesce(institution_id, active_institution_id) from users where id = auth.uid())
         or public.is_super_admin_user()
         or public.contest_my_teacher_id(institution_id) is not null);
create policy contest_settings_super on public.contest_settings for all to authenticated
  using (public.is_super_admin_user()) with check (public.is_super_admin_user());

create policy contests_manage on public.contests for all to authenticated
  using (public.contest_user_can_manage(institution_id)) with check (public.contest_user_can_manage(institution_id));
create policy contests_teacher_read on public.contests for select to authenticated
  using (public.contest_my_teacher_id(institution_id) is not null);

create policy contest_subjects_manage on public.contest_subjects for all to authenticated
  using (public.contest_user_can_manage(institution_id)) with check (public.contest_user_can_manage(institution_id));
create policy contest_subjects_teacher_read on public.contest_subjects for select to authenticated
  using (public.contest_my_teacher_id(institution_id) is not null);

create policy contest_teachers_manage on public.contest_teachers for all to authenticated
  using (public.contest_user_can_manage(institution_id)) with check (public.contest_user_can_manage(institution_id));
create policy contest_teachers_self on public.contest_teachers for select to authenticated
  using (user_id = auth.uid());

create policy contest_quotas_manage on public.contest_quotas for all to authenticated
  using (public.contest_user_can_manage(institution_id)) with check (public.contest_user_can_manage(institution_id));
create policy contest_quotas_teacher_read on public.contest_quotas for select to authenticated
  using (teacher_id = public.contest_my_teacher_id(institution_id));

create policy contest_questions_manage on public.contest_questions for all to authenticated
  using (public.contest_user_can_manage(institution_id)) with check (public.contest_user_can_manage(institution_id));
-- professor: só as próprias questões; só edita enquanto rascunho/devolvida; nunca aprova
create policy contest_questions_teacher_read on public.contest_questions for select to authenticated
  using (author_teacher_id = public.contest_my_teacher_id(institution_id));
create policy contest_questions_teacher_insert on public.contest_questions for insert to authenticated
  with check (author_teacher_id = public.contest_my_teacher_id(institution_id) and status in ('draft','sent')
              and exists (select 1 from contest_quotas q where q.id = quota_id and q.teacher_id = author_teacher_id));
create policy contest_questions_teacher_update on public.contest_questions for update to authenticated
  using (author_teacher_id = public.contest_my_teacher_id(institution_id) and status in ('draft','returned'))
  with check (author_teacher_id = public.contest_my_teacher_id(institution_id) and status in ('draft','sent'));
create policy contest_questions_teacher_delete on public.contest_questions for delete to authenticated
  using (author_teacher_id = public.contest_my_teacher_id(institution_id) and status = 'draft');

-- 5) Liga o módulo só no Colégio Ágape
insert into public.contest_settings (institution_id, module_enabled)
select id, true from public.institutions where id = '400349ba-872d-4b38-afca-d0eba2baa00a'
on conflict (institution_id) do update set module_enabled = true;
