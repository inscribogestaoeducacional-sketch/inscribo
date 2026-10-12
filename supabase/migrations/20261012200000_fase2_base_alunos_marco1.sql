-- ============================================================================
-- FASE 2 · MARCO 1 — Base de alunos: modelo canônico, RLS e visões.
-- Desenho: docs/produto/fase2-base-de-alunos-desenho.md (v2, 12/10/2026).
-- NÃO APLICADA. Ensaio + ok do Victor antes de aplicar.
--
-- O que cria:
--   catálogo  : school_grade_levels (ampliada), school_classes
--   config    : student_base_settings, student_base_coverage
--   pessoas   : students, student_external_ids, guardians, student_guardians
--   ano/evento: class_enrollments, student_status_events (imutável)
--   agregado  : class_aggregates (lançamento manual / planilha de números)
--   execução  : erp_connections (token no Vault), sync_runs
--   funções   : base_user_can_read/manage, base_cpf_hmac, base_save_aggregate,
--               base_save_settings, erp_connection_save_token, erp_connection_remove
--   visões    : v_base_year_grade_stats, v_base_daily_curve, v_base_flow, v_base_cohorts
--
-- Regras de segurança (desenho §1):
--   * RLS ligada em tudo, nada para anon.
--   * Leitura: admin/gestor da escola (atendente NÃO lê a base no marco 1) ou Super Admin.
--   * Escrita: só por funções SECURITY DEFINER ou pelo service role da edge
--     function — nenhuma política de INSERT/UPDATE/DELETE para o navegador.
--   * CPF do responsável nunca em claro: só HMAC-SHA256 com segredo no Vault
--     (nome 'base_cpf_hmac_key', criado à parte — ver base_cpf_hmac).
--   * Token do ERP só no Vault; o navegador não lê token_secret_id (GRANT de coluna).
--
-- Decisão a confirmar (Victor): o catálogo de séries é a school_grade_levels
-- que já existe (ampliada com segmento, série seguinte e "série final"), em
-- vez de uma tabela nova school_grades — evita uma terceira lista de séries.
-- ============================================================================

-- ── 0. Funções de acesso ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.base_user_can_read(p_institution_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
     WHERE u.id = auth.uid() AND COALESCE(u.active, true)
       AND p_institution_id IN (u.institution_id, u.active_institution_id)
       AND u.role IN ('admin', 'manager')
  ) OR is_super_admin_user()
$$;
REVOKE ALL ON FUNCTION public.base_user_can_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_user_can_read(uuid) TO authenticated;

-- Gravar números manuais e configurações da base: admin e gestor.
-- Token do ERP: só admin (base_user_is_admin).
CREATE OR REPLACE FUNCTION public.base_user_is_admin(p_institution_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
     WHERE u.id = auth.uid() AND COALESCE(u.active, true)
       AND p_institution_id IN (u.institution_id, u.active_institution_id)
       AND u.role = 'admin'
  ) OR is_super_admin_user()
$$;
REVOKE ALL ON FUNCTION public.base_user_is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_user_is_admin(uuid) TO authenticated;

-- ── 1. Catálogo de séries (amplia a tabela que já existe) ───────────────────
ALTER TABLE public.school_grade_levels
  ADD COLUMN IF NOT EXISTS segment text
    CHECK (segment IS NULL OR segment IN ('infantil', 'fund1', 'fund2', 'medio', 'outro')),
  ADD COLUMN IF NOT EXISTS next_grade_level_id uuid REFERENCES public.school_grade_levels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_terminal boolean NOT NULL DEFAULT false,  -- concluinte: a escola não oferece a série seguinte
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.school_grade_aliases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  grade_level_id  uuid NOT NULL REFERENCES public.school_grade_levels(id) ON DELETE CASCADE,
  source          text NOT NULL CHECK (source IN ('activesoft', 'planilha')),
  external_id     text,
  external_name   text NOT NULL,
  UNIQUE (institution_id, source, external_name)
);

-- ── 2. Turmas ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_classes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  academic_year   int  NOT NULL CHECK (academic_year BETWEEN 2000 AND 2100),
  grade_level_id  uuid REFERENCES public.school_grade_levels(id) ON DELETE SET NULL,
  name            text NOT NULL,
  shift           text CHECK (shift IS NULL OR shift IN ('manha', 'tarde', 'integral', 'noite')),
  erp_unit_id     text,
  unit_id         uuid REFERENCES public.lead_units(id) ON DELETE SET NULL,
  capacity        int CHECK (capacity IS NULL OR capacity >= 0),   -- vagas: digitada pela escola (o ERP não traz)
  source          text NOT NULL CHECK (source IN ('activesoft', 'planilha', 'manual')),
  external_id     text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS school_classes_ext_key
  ON public.school_classes (institution_id, source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_school_classes_year ON public.school_classes (institution_id, academic_year);

-- ── 3. Configuração e cobertura da base ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_base_settings (
  institution_id                    uuid PRIMARY KEY REFERENCES public.institutions(id) ON DELETE CASCADE,
  primary_source                    text NOT NULL DEFAULT 'nenhuma'
                                    CHECK (primary_source IN ('activesoft', 'planilha', 'manual', 'nenhuma')),
  declared_erp                      text,
  reenrollment_target_year          int CHECK (reenrollment_target_year IS NULL OR reenrollment_target_year BETWEEN 2000 AND 2100),
  reenrollment_window_start         date,
  base_cutoff_rule                  text NOT NULL DEFAULT 'ativos_na_abertura',          -- decidido 12/10
  count_prematricula_as_reenrolled  boolean NOT NULL DEFAULT false,                      -- decidido 12/10
  lead_link_mode                    text NOT NULL DEFAULT 'sugerir'
                                    CHECK (lead_link_mode IN ('sugerir', 'auto_confirmar_alta_confianca')),
  erp_confirms_enrollment           boolean NOT NULL DEFAULT false,                      -- decidido 12/10
  retention_years                   int NOT NULL DEFAULT 5 CHECK (retention_years BETWEEN 1 AND 20),  -- decidido 12/10
  updated_by                        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at                        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_base_coverage (
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  academic_year   int  NOT NULL,
  source          text NOT NULL CHECK (source IN ('activesoft', 'planilha', 'manual')),
  level           text NOT NULL CHECK (level IN ('aluno', 'agregado')),
  grades_covered  int,
  grades_total    int,
  last_loaded_at  timestamptz,
  last_run_id     uuid,
  seal            text CHECK (seal IS NULL OR seal IN ('completo', 'parcial', 'manual')),
  seal_reason     text,
  locked_at       timestamptz,
  PRIMARY KEY (institution_id, academic_year)
);

-- ── 4. Pessoas ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.students (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id     uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  full_name          text NOT NULL,
  name_key           text NOT NULL,             -- sem acento, minúsculo, espaços únicos
  birth_date         date,
  registration_code  text,                      -- matrícula da escola
  first_year         int,
  family_id          uuid,
  source             text NOT NULL CHECK (source IN ('activesoft', 'planilha', 'manual')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  anonymized_at      timestamptz
  -- sem celular do aluno (menor): o contato é o responsável (desenho §1.3)
);
CREATE INDEX IF NOT EXISTS idx_students_inst_name ON public.students (institution_id, name_key);

CREATE TABLE IF NOT EXISTS public.student_external_ids (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  source          text NOT NULL CHECK (source IN ('activesoft', 'planilha')),
  external_id     text NOT NULL,
  UNIQUE (institution_id, source, external_id)
);

CREATE TABLE IF NOT EXISTS public.guardians (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  name_key        text NOT NULL,
  phone_raw       text,
  phone_norm      text,                        -- 13 dígitos se celular, 12 se fixo (regra corrigida da Fase B)
  email           text,
  cpf_hmac        text,                        -- HMAC-SHA256 do CPF (só para casar); NUNCA o CPF em claro
  cpf_last2       text CHECK (cpf_last2 IS NULL OR cpf_last2 ~ '^[0-9]{2}$'),
  source          text NOT NULL CHECK (source IN ('activesoft', 'planilha', 'manual')),
  external_id     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS guardians_ext_key
  ON public.guardians (institution_id, source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guardians_phone ON public.guardians (institution_id, phone_norm);
CREATE INDEX IF NOT EXISTS idx_guardians_cpf ON public.guardians (institution_id, cpf_hmac) WHERE cpf_hmac IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.student_guardians (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  guardian_id     uuid NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('responsavel', 'responsavel_secundario', 'filiacao_1', 'filiacao_2', 'adicional')),
  is_primary      boolean NOT NULL DEFAULT false,
  valid_from      date,
  valid_to        date,
  source          text NOT NULL CHECK (source IN ('activesoft', 'planilha', 'manual')),
  UNIQUE (student_id, guardian_id, role)
);

-- ── 5. Enturmação por ano e eventos ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.class_enrollments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id      uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  student_id          uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year       int  NOT NULL CHECK (academic_year BETWEEN 2000 AND 2100),
  class_id            uuid REFERENCES public.school_classes(id) ON DELETE SET NULL,
  grade_level_id      uuid REFERENCES public.school_grade_levels(id) ON DELETE SET NULL,
  status              text NOT NULL CHECK (status IN (
                        'ativo', 'pre_matricula', 'selecao',
                        'transferido', 'cancelado', 'desistente', 'remanejado', 'concluido',
                        'inativo_outro', 'desconhecido')),
  raw_status          text,
  raw_status_type     text,
  enrolled_at         date,                      -- data_efetivacao_matricula (pode ser nula)
  is_new_student      boolean,                   -- novato_considerando_periodo_anterior (nulo se a escola não configurou)
  source              text NOT NULL CHECK (source IN ('activesoft', 'planilha', 'manual')),
  run_id              uuid,
  first_seen_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  status_changed_at   timestamptz,
  missing_runs        int NOT NULL DEFAULT 0
);
-- remanejamento no mesmo ano = 2 linhas (a antiga fica 'remanejado')
CREATE UNIQUE INDEX IF NOT EXISTS class_enrollments_key
  ON public.class_enrollments (student_id, academic_year, COALESCE(class_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_class_enrollments_year ON public.class_enrollments (institution_id, academic_year, status);

CREATE TABLE IF NOT EXISTS public.student_status_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id       uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  student_id           uuid NOT NULL,           -- sem FK: o histórico sobrevive à anonimização/exclusão
  academic_year        int  NOT NULL,
  class_enrollment_id  uuid,
  from_status          text,
  to_status            text NOT NULL,           -- inclui 'apareceu' e 'sumiu_da_origem'
  event_date           date NOT NULL,
  date_source          text NOT NULL CHECK (date_source IN ('fonte', 'detectado_na_carga', 'estimado')),
  detected_at          timestamptz NOT NULL DEFAULT now(),
  source               text NOT NULL CHECK (source IN ('activesoft', 'planilha', 'manual')),
  run_id               uuid,
  reason_code          text,
  reason_detail        text,
  is_inferred          boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_sse_student ON public.student_status_events (student_id, academic_year, event_date);
CREATE INDEX IF NOT EXISTS idx_sse_inst ON public.student_status_events (institution_id, academic_year, to_status, event_date);

-- mesmo padrão do lead_status_history (Fase 0A): só inserção
CREATE OR REPLACE FUNCTION public.student_status_events_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'student_status_events é somente-inserção (% bloqueado)', TG_OP;
END $$;
DROP TRIGGER IF EXISTS trg_student_status_events_immutable ON public.student_status_events;
CREATE TRIGGER trg_student_status_events_immutable
  BEFORE UPDATE OR DELETE ON public.student_status_events
  FOR EACH ROW EXECUTE FUNCTION public.student_status_events_immutable();

-- ── 6. Agregado (lançamento manual / planilha de números) ───────────────────
-- Cada "Atualizar números" grava um RETRATO novo (as_of_date). Corrigir cria
-- outro retrato com a mesma data; vale o mais recente (entered_at). Sem UPDATE.
CREATE TABLE IF NOT EXISTS public.class_aggregates (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id     uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  academic_year      int  NOT NULL CHECK (academic_year BETWEEN 2000 AND 2100),
  grade_level_id     uuid REFERENCES public.school_grade_levels(id) ON DELETE SET NULL,  -- nulo = escola inteira (legado)
  class_id           uuid REFERENCES public.school_classes(id) ON DELETE SET NULL,       -- nulo = série inteira
  as_of_date         date NOT NULL,
  enrolled_total     int CHECK (enrolled_total IS NULL OR enrolled_total >= 0),
  reenrolled         int CHECK (reenrolled IS NULL OR reenrolled >= 0),
  prematricula       int CHECK (prematricula IS NULL OR prematricula >= 0),
  new_students       int CHECK (new_students IS NULL OR new_students >= 0),
  exits_during_year  int CHECK (exits_during_year IS NULL OR exits_during_year >= 0),
  not_renewing       int CHECK (not_renewing IS NULL OR not_renewing >= 0),
  graduates          int CHECK (graduates IS NULL OR graduates >= 0),
  pending            int CHECK (pending IS NULL OR pending >= 0),
  capacity           int CHECK (capacity IS NULL OR capacity >= 0),
  source             text NOT NULL CHECK (source IN ('manual', 'planilha_agregada', 'legado_monthly_reenrollments')),
  entered_by         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  entered_at         timestamptz NOT NULL DEFAULT now(),
  notes              text
);
CREATE INDEX IF NOT EXISTS idx_class_aggregates_latest
  ON public.class_aggregates (institution_id, academic_year, grade_level_id, class_id, as_of_date DESC, entered_at DESC);

CREATE OR REPLACE FUNCTION public.class_aggregates_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'class_aggregates é somente-inserção: corrija gravando um retrato novo';
END $$;
DROP TRIGGER IF EXISTS trg_class_aggregates_immutable ON public.class_aggregates;
CREATE TRIGGER trg_class_aggregates_immutable
  BEFORE UPDATE ON public.class_aggregates
  FOR EACH ROW EXECUTE FUNCTION public.class_aggregates_immutable();

-- ── 7. Conexões de ERP e execuções ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.erp_connections (
  institution_id    uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  provider          text NOT NULL CHECK (provider IN ('activesoft')),
  token_secret_id   uuid,                         -- id no Vault; o navegador NUNCA lê (GRANT de coluna abaixo)
  token_last4       text,
  token_expires_at  date,                         -- informada pelo admin (a API não informa; a confirmar)
  status            text NOT NULL DEFAULT 'desconectada'
                    CHECK (status IN ('ativa', 'token_invalido', 'pausada', 'desconectada')),
  scopes_ok         jsonb NOT NULL DEFAULT '{}'::jsonb,
  allowed_periods   int[],
  last_success_at   timestamptz,
  last_error_at     timestamptz,
  last_error        text,                         -- sem dados pessoais nem token
  cursors           jsonb NOT NULL DEFAULT '{}'::jsonb,
  nightly_enabled   boolean NOT NULL DEFAULT false,
  created_by        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, provider)
);

CREATE TABLE IF NOT EXISTS public.sync_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  source          text NOT NULL CHECK (source IN ('activesoft', 'planilha', 'manual')),
  kind            text NOT NULL CHECK (kind IN ('dry_run_contagem', 'completa', 'incremental', 'manual_agora', 'planilha', 'agregado')),
  status          text NOT NULL DEFAULT 'na_fila'
                  CHECK (status IN ('na_fila', 'rodando', 'ok', 'ok_com_avisos', 'erro', 'cancelada')),
  triggered_by    text NOT NULL,                  -- id do usuário ou 'cron'
  queued_at       timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  step            text,
  step_offset     int,
  http_calls      int NOT NULL DEFAULT 0,
  pages           int NOT NULL DEFAULT 0,
  counts          jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings        jsonb NOT NULL DEFAULT '[]'::jsonb,   -- só ids e contagens
  error           text,
  summary         jsonb
);
CREATE INDEX IF NOT EXISTS idx_sync_runs_inst ON public.sync_runs (institution_id, queued_at DESC);
-- no máximo 1 execução rodando/na fila por escola
CREATE UNIQUE INDEX IF NOT EXISTS sync_runs_one_active
  ON public.sync_runs (institution_id) WHERE status IN ('na_fila', 'rodando');

-- ── 8. RLS ──────────────────────────────────────────────────────────────────
DO $rls$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['school_grade_aliases', 'school_classes', 'student_base_settings', 'student_base_coverage',
                           'students', 'student_external_ids', 'guardians', 'student_guardians',
                           'class_enrollments', 'student_status_events', 'class_aggregates',
                           'erp_connections', 'sync_runs']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (base_user_can_read(institution_id))',
                   t || '_select', t);
    -- sem política de INSERT/UPDATE/DELETE: escrita só por funções SECURITY DEFINER / service role
  END LOOP;
END $rls$;

-- erp_connections: o navegador lê tudo MENOS o id do segredo
REVOKE ALL ON public.erp_connections FROM authenticated;
GRANT SELECT (institution_id, provider, token_last4, token_expires_at, status, scopes_ok, allowed_periods,
              last_success_at, last_error_at, last_error, nightly_enabled, created_at, updated_at)
  ON public.erp_connections TO authenticated;

-- guardians: o navegador não lê o HMAC do CPF
REVOKE ALL ON public.guardians FROM authenticated;
GRANT SELECT (id, institution_id, full_name, name_key, phone_raw, phone_norm, email, cpf_last2, source, external_id, created_at, updated_at)
  ON public.guardians TO authenticated;

-- ── 9. Funções de escrita ───────────────────────────────────────────────────
-- 9a. HMAC do CPF: segredo da plataforma no Vault ('base_cpf_hmac_key').
--     Só funções do servidor chamam; o navegador não tem EXECUTE.
CREATE OR REPLACE FUNCTION public.base_cpf_hmac(p_cpf text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE
  v_digits text := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');
  v_key    text;
BEGIN
  IF length(v_digits) NOT IN (11, 14) THEN RETURN NULL; END IF;   -- CPF ou CNPJ
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'base_cpf_hmac_key';
  IF v_key IS NULL THEN RAISE EXCEPTION 'Segredo base_cpf_hmac_key não configurado no Vault'; END IF;
  RETURN encode(hmac(v_digits, v_key, 'sha256'), 'hex');
END $$;
REVOKE ALL ON FUNCTION public.base_cpf_hmac(text) FROM PUBLIC, anon, authenticated;

-- 9b. Lançamento manual agregado: grava um retrato por série com a data informada.
--     p_rows = [{ grade_level_id, class_id?, enrolled_total, reenrolled, prematricula,
--                 new_students, exits_during_year, not_renewing, graduates, pending, capacity }]
CREATE OR REPLACE FUNCTION public.base_save_aggregate(p_institution_id uuid, p_academic_year int, p_as_of date, p_rows jsonb, p_notes text DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_n int;
  v_bad text;
BEGIN
  IF NOT base_user_can_read(p_institution_id) THEN
    RAISE EXCEPTION 'Sem permissão para lançar números desta escola' USING ERRCODE = '42501';
  END IF;
  IF p_as_of IS NULL OR p_as_of > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'Data do retrato inválida (futura)' USING ERRCODE = 'check_violation';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'p_rows precisa ser uma lista'; END IF;

  -- toda série informada precisa ser da própria escola
  SELECT r->>'grade_level_id' INTO v_bad
    FROM jsonb_array_elements(p_rows) r
   WHERE NOT EXISTS (SELECT 1 FROM school_grade_levels g
                      WHERE g.id = (r->>'grade_level_id')::uuid AND g.institution_id = p_institution_id)
   LIMIT 1;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Série % não pertence à escola', v_bad USING ERRCODE = '42501'; END IF;

  INSERT INTO class_aggregates (institution_id, academic_year, grade_level_id, class_id, as_of_date,
    enrolled_total, reenrolled, prematricula, new_students, exits_during_year, not_renewing, graduates, pending, capacity,
    source, entered_by, notes)
  SELECT p_institution_id, p_academic_year, (r->>'grade_level_id')::uuid, NULLIF(r->>'class_id', '')::uuid, p_as_of,
         (r->>'enrolled_total')::int, (r->>'reenrolled')::int, (r->>'prematricula')::int, (r->>'new_students')::int,
         (r->>'exits_during_year')::int, (r->>'not_renewing')::int, (r->>'graduates')::int, (r->>'pending')::int,
         (r->>'capacity')::int, 'manual', auth.uid(), p_notes
    FROM jsonb_array_elements(p_rows) r;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  INSERT INTO student_base_coverage (institution_id, academic_year, source, level, last_loaded_at, seal, seal_reason)
  VALUES (p_institution_id, p_academic_year, 'manual', 'agregado', now(), 'manual', 'lançamento manual por série')
  ON CONFLICT (institution_id, academic_year) DO UPDATE
    SET last_loaded_at = now()
    WHERE student_base_coverage.level = 'agregado';   -- não troca a fonte de um ano que já é aluno a aluno

  INSERT INTO sync_runs (institution_id, source, kind, status, triggered_by, started_at, finished_at, counts)
  VALUES (p_institution_id, 'manual', 'agregado', 'ok', COALESCE(auth.uid()::text, 'sistema'), now(), now(),
          jsonb_build_object('series', v_n, 'ano', p_academic_year, 'retrato', p_as_of));
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.base_save_aggregate(uuid, int, date, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_save_aggregate(uuid, int, date, jsonb, text) TO authenticated;

-- 9c. Configuração da base (fonte principal, ano e abertura da rematrícula)
CREATE OR REPLACE FUNCTION public.base_save_settings(p_institution_id uuid, p_primary_source text, p_declared_erp text,
  p_reenrollment_target_year int, p_reenrollment_window_start date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT base_user_is_admin(p_institution_id) THEN
    RAISE EXCEPTION 'Só o administrador altera a configuração da base' USING ERRCODE = '42501';
  END IF;
  INSERT INTO student_base_settings (institution_id, primary_source, declared_erp, reenrollment_target_year, reenrollment_window_start, updated_by, updated_at)
  VALUES (p_institution_id, p_primary_source, NULLIF(btrim(p_declared_erp), ''), p_reenrollment_target_year, p_reenrollment_window_start, auth.uid(), now())
  ON CONFLICT (institution_id) DO UPDATE SET
    primary_source = EXCLUDED.primary_source, declared_erp = EXCLUDED.declared_erp,
    reenrollment_target_year = EXCLUDED.reenrollment_target_year, reenrollment_window_start = EXCLUDED.reenrollment_window_start,
    updated_by = EXCLUDED.updated_by, updated_at = now();
END $$;
REVOKE ALL ON FUNCTION public.base_save_settings(uuid, text, text, int, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_save_settings(uuid, text, text, int, date) TO authenticated;

-- 9d. Token do ERP: vai pro Vault; guarda só o id e os 4 últimos caracteres.
--     Trocar o token cria um segredo novo e apaga o antigo. Grava em audit_logs.
CREATE OR REPLACE FUNCTION public.erp_connection_save_token(p_institution_id uuid, p_provider text, p_token text, p_expires_at date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_old   uuid;
  v_new   uuid;
  v_token text := btrim(COALESCE(p_token, ''));
BEGIN
  IF NOT base_user_is_admin(p_institution_id) THEN
    RAISE EXCEPTION 'Só o administrador conecta integrações' USING ERRCODE = '42501';
  END IF;
  IF p_provider <> 'activesoft' THEN RAISE EXCEPTION 'Integração não suportada: %', p_provider; END IF;
  IF length(v_token) < 8 THEN RAISE EXCEPTION 'Token inválido' USING ERRCODE = 'check_violation'; END IF;

  SELECT token_secret_id INTO v_old FROM erp_connections WHERE institution_id = p_institution_id AND provider = p_provider;
  v_new := vault.create_secret(v_token, 'erp_' || p_provider || '_' || p_institution_id::text || '_' || extract(epoch FROM now())::bigint,
                               'Token ' || p_provider || ' da escola ' || p_institution_id::text);

  INSERT INTO erp_connections (institution_id, provider, token_secret_id, token_last4, token_expires_at, status, created_by, updated_at)
  VALUES (p_institution_id, p_provider, v_new, right(v_token, 4), p_expires_at, 'pausada', auth.uid(), now())
  ON CONFLICT (institution_id, provider) DO UPDATE SET
    token_secret_id = EXCLUDED.token_secret_id, token_last4 = EXCLUDED.token_last4,
    token_expires_at = EXCLUDED.token_expires_at,
    status = 'pausada',            -- fica pausada até o teste de conexão (marco 2) aprovar
    scopes_ok = '{}'::jsonb, last_error = NULL, updated_at = now();

  IF v_old IS NOT NULL AND v_old <> v_new THEN DELETE FROM vault.secrets WHERE id = v_old; END IF;

  INSERT INTO audit_logs (institution_id, module, record_id, action, field_changed, new_value, user_id, user_name, user_role)
  SELECT p_institution_id, 'integracoes', p_institution_id, CASE WHEN v_old IS NULL THEN 'Token cadastrado' ELSE 'Token trocado' END,
         p_provider, '****' || right(v_token, 4), u.id, u.full_name, u.role
    FROM users u WHERE u.id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.erp_connection_save_token(uuid, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erp_connection_save_token(uuid, text, text, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.erp_connection_remove(p_institution_id uuid, p_provider text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_old uuid;
BEGIN
  IF NOT base_user_is_admin(p_institution_id) THEN
    RAISE EXCEPTION 'Só o administrador desconecta integrações' USING ERRCODE = '42501';
  END IF;
  SELECT token_secret_id INTO v_old FROM erp_connections WHERE institution_id = p_institution_id AND provider = p_provider;
  UPDATE erp_connections SET token_secret_id = NULL, token_last4 = NULL, status = 'desconectada', nightly_enabled = false, updated_at = now()
   WHERE institution_id = p_institution_id AND provider = p_provider;
  IF v_old IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = v_old; END IF;
  INSERT INTO audit_logs (institution_id, module, record_id, action, field_changed, user_id, user_name, user_role)
  SELECT p_institution_id, 'integracoes', p_institution_id, 'Token removido', p_provider, u.id, u.full_name, u.role
    FROM users u WHERE u.id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.erp_connection_remove(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erp_connection_remove(uuid, text) TO authenticated;

-- ── 10. Visões canônicas (o que os módulos leem) ────────────────────────────
-- Nível de cada (escola, ano): o da cobertura; sem cobertura, 'aluno' se houver
-- enturmação, senão 'agregado'. Fontes não se somam (desenho §0, princípio 1).
CREATE OR REPLACE VIEW public.v_base_year_level WITH (security_invoker = true) AS
WITH anos AS (
  SELECT institution_id, academic_year FROM class_enrollments
  UNION SELECT institution_id, academic_year FROM class_aggregates
  UNION SELECT institution_id, academic_year FROM student_base_coverage
)
SELECT a.institution_id, a.academic_year,
       COALESCE(c.level, CASE WHEN EXISTS (SELECT 1 FROM class_enrollments e
                                            WHERE e.institution_id = a.institution_id AND e.academic_year = a.academic_year)
                              THEN 'aluno' ELSE 'agregado' END) AS level,
       COALESCE(c.source, CASE WHEN EXISTS (SELECT 1 FROM class_enrollments e
                                             WHERE e.institution_id = a.institution_id AND e.academic_year = a.academic_year)
                               THEN (SELECT e.source FROM class_enrollments e
                                      WHERE e.institution_id = a.institution_id AND e.academic_year = a.academic_year LIMIT 1)
                               ELSE 'manual' END) AS source,
       COALESCE(c.seal, CASE WHEN COALESCE(c.level, 'agregado') = 'agregado' THEN 'manual' ELSE 'parcial' END) AS seal,
       c.seal_reason
  FROM anos a
  LEFT JOIN student_base_coverage c ON c.institution_id = a.institution_id AND c.academic_year = a.academic_year;

-- Números por ano e série no MESMO formato para os dois níveis.
--   aluno   : contagem sobre class_enrollments (contam 'ativo'; pré-matrícula separada)
--   agregado: retrato mais recente de class_aggregates por série/turma
CREATE OR REPLACE VIEW public.v_base_year_grade_stats WITH (security_invoker = true) AS
WITH lvl AS (SELECT * FROM v_base_year_level),
aluno AS (
  SELECT e.institution_id, e.academic_year, e.grade_level_id, e.class_id,
         count(*) FILTER (WHERE e.status = 'ativo')                                      AS enrolled_total,
         count(*) FILTER (WHERE e.status = 'ativo' AND EXISTS (
            SELECT 1 FROM class_enrollments p WHERE p.student_id = e.student_id
               AND p.academic_year = e.academic_year - 1 AND p.status IN ('ativo', 'concluido')))  AS reenrolled,
         count(*) FILTER (WHERE e.status = 'pre_matricula')                              AS prematricula,
         count(*) FILTER (WHERE e.status = 'ativo' AND NOT EXISTS (
            SELECT 1 FROM class_enrollments p WHERE p.student_id = e.student_id
               AND p.academic_year = e.academic_year - 1 AND p.status IN ('ativo', 'concluido')))  AS new_students,
         count(*) FILTER (WHERE e.status IN ('transferido', 'cancelado', 'desistente'))  AS exits_during_year,
         NULL::bigint                                                                    AS not_renewing,  -- marco 3 (funil)
         count(*) FILTER (WHERE e.status IN ('ativo', 'concluido') AND g.is_terminal)    AS graduates,
         NULL::bigint                                                                    AS pending,       -- marco 3 (funil)
         max(sc.capacity)                                                                AS capacity,
         max(e.last_seen_at)::date                                                       AS as_of
    FROM class_enrollments e
    LEFT JOIN school_grade_levels g ON g.id = e.grade_level_id
    LEFT JOIN school_classes sc ON sc.id = e.class_id
   WHERE e.status <> 'desconhecido'          -- situação não mapeada fica fora das contas
   GROUP BY e.institution_id, e.academic_year, e.grade_level_id, e.class_id
),
agregado AS (
  SELECT DISTINCT ON (a.institution_id, a.academic_year, a.grade_level_id, a.class_id)
         a.institution_id, a.academic_year, a.grade_level_id, a.class_id,
         a.enrolled_total::bigint, a.reenrolled::bigint, a.prematricula::bigint, a.new_students::bigint,
         a.exits_during_year::bigint, a.not_renewing::bigint, a.graduates::bigint, a.pending::bigint,
         a.capacity, a.as_of_date AS as_of
    FROM class_aggregates a
   ORDER BY a.institution_id, a.academic_year, a.grade_level_id, a.class_id, a.as_of_date DESC, a.entered_at DESC
)
SELECT l.institution_id, l.academic_year, x.grade_level_id, x.class_id, l.source, l.level, l.seal,
       x.enrolled_total, x.reenrolled, x.prematricula, x.new_students, x.exits_during_year,
       x.not_renewing, x.graduates, x.pending, x.capacity, x.as_of
  FROM lvl l
  JOIN aluno x ON l.level = 'aluno' AND x.institution_id = l.institution_id AND x.academic_year = l.academic_year
UNION ALL
SELECT l.institution_id, l.academic_year, x.grade_level_id, x.class_id, l.source, l.level, l.seal,
       x.enrolled_total, x.reenrolled, x.prematricula, x.new_students, x.exits_during_year,
       x.not_renewing, x.graduates, x.pending, x.capacity, x.as_of
  FROM lvl l
  JOIN agregado x ON l.level = 'agregado' AND x.institution_id = l.institution_id AND x.academic_year = l.academic_year;

-- Curva de rematrícula: acumulado por dia desde a abertura (student_base_settings).
--   aluno   : data de efetivação (ou a primeira vez que a carga viu) das enturmações
--             do ano-alvo de quem estava ativo no ano anterior
--   agregado: degraus — soma dos rematriculados do retrato mais recente de cada data
CREATE OR REPLACE VIEW public.v_base_daily_curve WITH (security_invoker = true) AS
WITH s AS (
  SELECT institution_id, reenrollment_target_year AS target_year, reenrollment_window_start AS window_start
    FROM student_base_settings WHERE reenrollment_target_year IS NOT NULL AND reenrollment_window_start IS NOT NULL
),
aluno AS (
  SELECT e.institution_id, e.academic_year AS target_year,
         COALESCE(e.enrolled_at, e.first_seen_at::date) AS d, count(*) AS n
    FROM class_enrollments e
   WHERE e.status = 'ativo'
     AND EXISTS (SELECT 1 FROM class_enrollments p WHERE p.student_id = e.student_id
                   AND p.academic_year = e.academic_year - 1 AND p.status = 'ativo')
   GROUP BY 1, 2, 3
),
agregado AS (
  SELECT a.institution_id, a.academic_year AS target_year, a.as_of_date AS d,
         sum(a.reenrolled) AS reenrolled_total
    FROM (SELECT DISTINCT ON (institution_id, academic_year, grade_level_id, class_id, as_of_date) *
            FROM class_aggregates ORDER BY institution_id, academic_year, grade_level_id, class_id, as_of_date, entered_at DESC) a
   GROUP BY 1, 2, 3
)
SELECT s.institution_id, s.target_year, 'aluno'::text AS level,
       (x.d - s.window_start) AS day_offset, x.d AS date,
       sum(x.n) OVER (PARTITION BY s.institution_id, s.target_year ORDER BY x.d) AS reenrolled_cum
  FROM s JOIN aluno x ON x.institution_id = s.institution_id AND x.target_year = s.target_year
UNION ALL
SELECT s.institution_id, s.target_year, 'agregado'::text,
       (x.d - s.window_start), x.d, x.reenrolled_total
  FROM s JOIN agregado x ON x.institution_id = s.institution_id AND x.target_year = s.target_year;

-- Fluxo série × ano (só nível aluno): de onde cada aluno ativo em N foi parar em N+1.
CREATE OR REPLACE VIEW public.v_base_flow WITH (security_invoker = true) AS
SELECT o.institution_id, o.academic_year AS from_year, o.grade_level_id AS from_grade_id,
       CASE
         WHEN d.id IS NULL AND g.is_terminal THEN 'concluiu'
         WHEN d.id IS NULL THEN 'saiu_ou_pendente'
         WHEN d.grade_level_id = o.grade_level_id THEN 'mesma_serie'
         WHEN d.grade_level_id = g.next_grade_level_id THEN 'proxima_serie'
         ELSE 'outra_serie'
       END AS destino,
       count(*) AS n
  FROM class_enrollments o
  LEFT JOIN school_grade_levels g ON g.id = o.grade_level_id
  LEFT JOIN LATERAL (
    SELECT d.* FROM class_enrollments d
     WHERE d.student_id = o.student_id AND d.academic_year = o.academic_year + 1 AND d.status IN ('ativo', 'pre_matricula')
     LIMIT 1
  ) d ON true
 WHERE o.status = 'ativo'
 GROUP BY 1, 2, 3, 4;

-- Retenção por coorte (só nível aluno): de quem entrou no ano E, quantos seguem ativos em E+k.
CREATE OR REPLACE VIEW public.v_base_cohorts WITH (security_invoker = true) AS
WITH entrada AS (
  SELECT institution_id, student_id, min(academic_year) AS entry_year
    FROM class_enrollments WHERE status IN ('ativo', 'concluido') GROUP BY 1, 2
)
SELECT en.institution_id, en.entry_year, (e.academic_year - en.entry_year) AS years_after,
       count(DISTINCT e.student_id) AS active,
       (SELECT count(*) FROM entrada x WHERE x.institution_id = en.institution_id AND x.entry_year = en.entry_year) AS entered
  FROM entrada en
  JOIN class_enrollments e ON e.student_id = en.student_id AND e.status = 'ativo' AND e.academic_year >= en.entry_year
 GROUP BY 1, 2, 3;

REVOKE ALL ON public.v_base_year_level, public.v_base_year_grade_stats, public.v_base_daily_curve,
              public.v_base_flow, public.v_base_cohorts FROM anon;
GRANT SELECT ON public.v_base_year_level, public.v_base_year_grade_stats, public.v_base_daily_curve,
                public.v_base_flow, public.v_base_cohorts TO authenticated;
