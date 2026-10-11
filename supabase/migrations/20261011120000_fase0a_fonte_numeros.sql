-- ============================================================================
-- FASE 0A — fonte única dos números (matrícula, histórico de status, visita,
-- lembretes, alertas). SÓ ESTRUTURA: nenhuma linha existente é alterada aqui.
-- O backfill (dados) fica em supabase/pendentes/fase0a_backfill.sql e só roda
-- com ok separado.
--
-- Regras aprovadas (11/10/2026):
--   * matrícula = lead com status 'enrolled'; data = data do EVENTO de mudança
--     de status (nunca updated_at); o registro em enrollments é gravado pelo
--     banco, por qualquer caminho (Kanban, modal, Hub, robô).
--   * visita só conta como realizada com baixa (status 'completed').
--   * fuso de Brasília (America/Sao_Paulo) em tudo que agrupa por dia/mês.
--
-- Ordem de deploy: esta migration ANTES do front do branch fase0a-fonte-numeros
-- (o front novo lê enrollments.enrollment_date/cancelled_at,
-- system_notifications.resolved_at, lead_status_history, lead_reminder_settings
-- e lead_last_interactions). O front antigo continua funcionando com ela.
-- Definição anterior de sync_funnel_metrics: supabase/schema_snapshots/
-- 2026-10-11_funil_matriculas_producao.sql.
-- ============================================================================

-- ── 1. enrollments: colunas de rastreio + 1 matrícula por lead ──────────────
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS source            TEXT,          -- 'status_trigger' | 'kanban' | 'backfill'
  ADD COLUMN IF NOT EXISTS date_source       TEXT,          -- 'evento' | 'log_status' | 'log_edicao' | 'estimada'
  ADD COLUMN IF NOT EXISTS date_is_estimated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled_at      TIMESTAMPTZ;  -- lead saiu de 'enrolled' depois

-- Idempotência: no máximo 1 matrícula por lead. (Conferido 11/10: 0 duplicadas.)
CREATE UNIQUE INDEX IF NOT EXISTS enrollments_lead_id_key
  ON public.enrollments (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enrollments_inst_date
  ON public.enrollments (institution_id, enrollment_date);

-- ── 2. Histórico de status do lead (imutável) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   UUID        NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  lead_id          UUID        NOT NULL,  -- sem FK de propósito: histórico sobrevive à exclusão do lead
  from_status      TEXT,                  -- NULL = criação do lead (ou origem desconhecida no backfill)
  to_status        TEXT        NOT NULL,
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by       UUID,                  -- auth.uid() de quem mudou (NULL = sistema/robô)
  changed_by_name  TEXT,
  source           TEXT        NOT NULL DEFAULT 'app',  -- 'app' | 'backfill_log' | 'backfill_inferido'
  is_inferred      BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lsh_lead       ON public.lead_status_history (lead_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_lsh_inst_to    ON public.lead_status_history (institution_id, to_status, changed_at);

CREATE OR REPLACE FUNCTION public.lead_status_history_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'lead_status_history é somente-inserção (% bloqueado)', TG_OP;
END $$;

DROP TRIGGER IF EXISTS trg_lead_status_history_immutable ON public.lead_status_history;
CREATE TRIGGER trg_lead_status_history_immutable
  BEFORE UPDATE OR DELETE ON public.lead_status_history
  FOR EACH ROW EXECUTE FUNCTION public.lead_status_history_immutable();

ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_status_history_select ON public.lead_status_history;
CREATE POLICY lead_status_history_select ON public.lead_status_history
  FOR SELECT TO authenticated
  USING (institution_id = get_my_institution_id() OR is_super_admin_user());
-- Sem política de INSERT/UPDATE/DELETE: só o gatilho (SECURITY DEFINER) grava.

-- ── 3. Gatilho de status do lead: histórico + matrícula formal ──────────────
-- Roda em QUALQUER caminho que grave leads.status (Kanban, modal, Hub, robô,
-- importação). Nunca bloqueia o salvamento do lead por causa de FK de usuário.
CREATE OR REPLACE FUNCTION public.lead_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_uid_ok    boolean;
  v_name      text;
  v_owner     uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT true, u.full_name INTO v_uid_ok, v_name FROM users u WHERE u.id = v_uid;

  INSERT INTO lead_status_history (institution_id, lead_id, from_status, to_status, changed_at, changed_by, changed_by_name, source)
  VALUES (NEW.institution_id, NEW.id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END, NEW.status, now(),
          v_uid, v_name, 'app');

  IF NEW.status = 'enrolled' THEN
    -- dono da matrícula: responsável do lead; senão quem mudou o status
    v_owner := COALESCE(NEW.assigned_to, CASE WHEN v_uid_ok THEN v_uid END);
    INSERT INTO enrollments (institution_id, lead_id, student_name, course_grade, enrollment_date,
                             user_id, responsible_name, source, date_source, date_is_estimated)
    VALUES (NEW.institution_id, NEW.id, COALESCE(NEW.student_name, NEW.responsible_name), NEW.grade_interest, now(),
            v_owner, NEW.responsible_name, 'status_trigger', 'evento', false)
    ON CONFLICT (lead_id) WHERE lead_id IS NOT NULL DO UPDATE
      SET cancelled_at      = NULL,
          -- reabertura: só renova a data se a matrícula anterior tinha sido desfeita
          enrollment_date   = CASE WHEN enrollments.cancelled_at IS NOT NULL THEN now() ELSE enrollments.enrollment_date END,
          date_source       = CASE WHEN enrollments.cancelled_at IS NOT NULL THEN 'evento' ELSE enrollments.date_source END,
          date_is_estimated = CASE WHEN enrollments.cancelled_at IS NOT NULL THEN false ELSE enrollments.date_is_estimated END,
          user_id           = COALESCE(enrollments.user_id, EXCLUDED.user_id);
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'enrolled' THEN
    -- saiu de matriculado: matrícula fica no histórico, marcada como desfeita
    UPDATE enrollments SET cancelled_at = now()
     WHERE lead_id = NEW.id AND cancelled_at IS NULL;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lead_status_changed ON public.leads;
CREATE TRIGGER trg_lead_status_changed
  AFTER INSERT OR UPDATE OF status ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.lead_status_changed();

-- ── 4. Visitas: quem agendou, data plausível, quem deu baixa ────────────────
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS outcome_at TIMESTAMPTZ,  -- quando recebeu baixa (realizada/faltou/cancelada)
  ADD COLUMN IF NOT EXISTS outcome_by UUID;

CREATE INDEX IF NOT EXISTS idx_visits_lead ON public.visits (lead_id);
CREATE INDEX IF NOT EXISTS idx_visits_pending ON public.visits (institution_id, scheduled_date) WHERE status = 'scheduled';

CREATE OR REPLACE FUNCTION public.visits_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- responsável = quem agendou, quando o front não informou
    IF NEW.assigned_to IS NULL AND v_uid IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE id = v_uid) THEN
      NEW.assigned_to := v_uid;
    END IF;
  END IF;

  -- data absurda (ano digitado errado): até 60 dias pra trás, até 18 meses pra frente
  IF TG_OP = 'INSERT' OR NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date THEN
    IF NEW.scheduled_date < now() - interval '60 days' OR NEW.scheduled_date > now() + interval '18 months' THEN
      RAISE EXCEPTION 'Data da visita fora do intervalo permitido (%). Confira o ano.',
        to_char(NEW.scheduled_date AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- baixa: registra quando/quem
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('completed', 'no_show', 'cancelled') THEN
      NEW.outcome_at := now();
      NEW.outcome_by := v_uid;
    ELSIF NEW.status = 'scheduled' THEN
      NEW.outcome_at := NULL;
      NEW.outcome_by := NULL;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_visits_before_write ON public.visits;
CREATE TRIGGER trg_visits_before_write
  BEFORE INSERT OR UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.visits_before_write();

-- ── 5. Funil da campanha: definições aprovadas, fuso de Brasília ────────────
-- Antes: só o mês corrente (UTC) era recalculado; schedules nunca era
-- preenchido; visits = agendadas em qualquer status; enrollments = linhas
-- por created_at. Agora recalcula TODOS os meses do ciclo até o mês atual:
--   registrations = leads criados no mês (não excluídos)
--   schedules     = leads com visita CRIADA no mês (agendamentos; reagendar não duplica)
--   visits        = visitas REALIZADAS (com baixa) com data no mês
--   enrollments   = matrículas (não desfeitas) com data do evento no mês
-- Metas (*_target) nunca são tocadas.
CREATE OR REPLACE FUNCTION public.recompute_funnel_metrics(p_institution_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cycle  record;
  v_tz     constant text := 'America/Sao_Paulo';
  v_month  date;
  v_last   date;
  v_start  timestamptz;
  v_end    timestamptz;
  v_lo     timestamptz;
  v_hi     timestamptz;
BEGIN
  SELECT * INTO v_cycle FROM campaign_cycles
   WHERE institution_id = p_institution_id
     AND status IN ('active', 'released')
     AND start_date IS NOT NULL AND end_date IS NOT NULL
   ORDER BY created_at DESC LIMIT 1;
  IF v_cycle IS NULL THEN RETURN; END IF;

  v_start := v_cycle.start_date::timestamp AT TIME ZONE v_tz;
  v_end   := (v_cycle.end_date + 1)::timestamp AT TIME ZONE v_tz;
  v_month := date_trunc('month', v_cycle.start_date)::date;
  v_last  := LEAST(date_trunc('month', v_cycle.end_date)::date,
                   date_trunc('month', (now() AT TIME ZONE v_tz))::date);

  WHILE v_month <= v_last LOOP
    v_lo := GREATEST(v_month::timestamp AT TIME ZONE v_tz, v_start);
    v_hi := LEAST((v_month + interval '1 month')::timestamp AT TIME ZONE v_tz, v_end);

    INSERT INTO funnel_metrics (institution_id, period, registrations, schedules, visits, enrollments,
                                registrations_target, schedules_target, visits_target, enrollments_target)
    VALUES (
      p_institution_id, to_char(v_month, 'YYYY-MM'),
      (SELECT count(*) FROM leads l WHERE l.institution_id = p_institution_id AND l.deleted_at IS NULL
          AND l.created_at >= v_lo AND l.created_at < v_hi),
      (SELECT count(DISTINCT COALESCE(v.lead_id, v.id)) FROM visits v WHERE v.institution_id = p_institution_id
          AND v.created_at >= v_lo AND v.created_at < v_hi),
      (SELECT count(*) FROM visits v WHERE v.institution_id = p_institution_id AND v.status = 'completed'
          AND v.scheduled_date >= v_lo AND v.scheduled_date < v_hi),
      (SELECT count(*) FROM enrollments e WHERE e.institution_id = p_institution_id AND e.cancelled_at IS NULL
          AND e.enrollment_date >= v_lo AND e.enrollment_date < v_hi),
      0, 0, 0, 0)
    ON CONFLICT (period, institution_id) DO UPDATE SET
      registrations = EXCLUDED.registrations,
      schedules     = EXCLUDED.schedules,
      visits        = EXCLUDED.visits,
      enrollments   = EXCLUDED.enrollments;

    v_month := (v_month + interval '1 month')::date;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.recompute_funnel_metrics(uuid) FROM PUBLIC, anon, authenticated;

-- Mantém o nome do gatilho antigo (trg_sync_funnel_* em leads/visits/enrollments)
CREATE OR REPLACE FUNCTION public.sync_funnel_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM recompute_funnel_metrics(COALESCE(NEW.institution_id, OLD.institution_id));
  RETURN COALESCE(NEW, OLD);
END $$;

-- ── 6. Alertas: marcar como resolvido sem apagar ────────────────────────────
ALTER TABLE public.system_notifications
  ADD COLUMN IF NOT EXISTS resolved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_reason TEXT;

-- ── 7. Lembretes: "sem contato" desde a última interação real ───────────────
CREATE TABLE IF NOT EXISTS public.lead_reminder_settings (
  institution_id   UUID        PRIMARY KEY REFERENCES public.institutions(id) ON DELETE CASCADE,
  no_contact_days  INTEGER     NOT NULL DEFAULT 5 CHECK (no_contact_days BETWEEN 1 AND 60),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by       UUID        REFERENCES public.users(id) ON DELETE SET NULL
);
ALTER TABLE public.lead_reminder_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_reminder_settings_select ON public.lead_reminder_settings;
CREATE POLICY lead_reminder_settings_select ON public.lead_reminder_settings
  FOR SELECT TO authenticated
  USING (institution_id = get_my_institution_id() OR is_super_admin_user());
DROP POLICY IF EXISTS lead_reminder_settings_insert ON public.lead_reminder_settings;
CREATE POLICY lead_reminder_settings_insert ON public.lead_reminder_settings
  FOR INSERT TO authenticated WITH CHECK (lead_unit_user_can_manage(institution_id));
DROP POLICY IF EXISTS lead_reminder_settings_update ON public.lead_reminder_settings;
CREATE POLICY lead_reminder_settings_update ON public.lead_reminder_settings
  FOR UPDATE TO authenticated
  USING (lead_unit_user_can_manage(institution_id))
  WITH CHECK (lead_unit_user_can_manage(institution_id));

-- Última interação real de cada lead em aberto: mensagem (qualquer lado) na
-- conversa vinculada, atividade registrada no lead (Ligação/Email/WhatsApp/
-- Presencial/Outro) ou nota do contato. SECURITY INVOKER: respeita a RLS de
-- quem chama.
CREATE OR REPLACE FUNCTION public.lead_last_interactions(p_institution_id uuid)
RETURNS TABLE (lead_id uuid, last_interaction_at timestamptz)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT l.id,
         GREATEST(
           (SELECT max(c.last_message_at) FROM whatsapp_conversations c
             WHERE c.lead_id = l.id AND c.institution_id = l.institution_id),
           (SELECT max(a.created_at) FROM audit_logs a
             WHERE a.institution_id = l.institution_id AND a.module = 'lead'
               AND a.record_id = l.id
               AND a.action IN ('Ligação', 'Email', 'E-mail', 'WhatsApp', 'Presencial', 'Outro')),
           (SELECT max(n.created_at) FROM contact_notes n
             WHERE n.institution_id = l.institution_id AND n.contact_ref_id = l.id::text)
         )
    FROM leads l
   WHERE l.institution_id = p_institution_id
     AND l.status NOT IN ('enrolled', 'lost')
     AND l.deleted_at IS NULL
$$;
REVOKE ALL ON FUNCTION public.lead_last_interactions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_last_interactions(uuid) TO authenticated;
