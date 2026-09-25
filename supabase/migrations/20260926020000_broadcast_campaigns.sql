-- =============================================================================
-- 20260926020000_broadcast_campaigns.sql
-- Transmissões — Fase M3: campanhas, destinatários, ações por botão,
-- histórico de respostas, crédito, vínculo com payments/conversas e as
-- funções de fila/liberação/recontagem.
--
-- Princípio (lição de payments/RLS, 67dee47): nada que envolva dinheiro ou
-- a trava de envio é gravável pelo navegador. Escola e Super Admin só LEEM
-- campanhas/destinatários/ações/histórico; toda escrita passa pelo backend
-- (service role), que confere a permissão com broadcast_user_can_manage().
-- A trava "template aprovado E pago" é garantida por CHECK no próprio banco.
--
-- Decisões aprovadas aplicadas aqui:
--   1. travado em 'sending' → failed/unknown + crédito, nunca reenvia
--      (broadcast_reap_stale_sending).
--   3. total após crédito abaixo do mínimo do Asaas ou zero → libera sem
--      cobrança (paid_at preenchido sem payment_id), só debita crédito.
--      Crédito não expira.
--   6. lista importada exige confirmação de opt-in antes de liberar (CHECK).
-- Destinatário deduplicado por broadcast_phone_key (M2): mesmo celular com e
-- sem o 9º dígito é UMA pessoa.
-- =============================================================================

-- ── 1. broadcast_campaigns ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_campaigns (
  id                         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id             UUID          NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name                       TEXT          NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),

  -- Template (cópia congelada no momento da criação)
  template_definition_id     UUID          NOT NULL REFERENCES template_definitions(id) ON DELETE RESTRICT,
  template_name              TEXT          NOT NULL,
  template_language          TEXT          NOT NULL DEFAULT 'pt_BR',
  header_media_url           TEXT,
  -- {"1":{"source":"contact.name","fallback":"Responsável"},"2":{"source":"fixed","value":"..."}}
  variable_mapping           JSONB         NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(variable_mapping) = 'object'),

  -- Audiência (cópia dos filtros usados, pra auditoria)
  audience_filter            JSONB         NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(audience_filter) = 'object'),
  has_imported_list          BOOLEAN       NOT NULL DEFAULT false,
  import_opt_in_confirmed_by UUID          REFERENCES users(id) ON DELETE SET NULL,
  import_opt_in_confirmed_at TIMESTAMPTZ,

  status                     TEXT          NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft','pending_template','pending_payment','scheduled',
                                                 'sending','paused','completed','cancelled')),
  paused_reason              TEXT,
  send_mode                  TEXT          NOT NULL DEFAULT 'now' CHECK (send_mode IN ('now','scheduled')),
  scheduled_at               TIMESTAMPTZ,

  -- Preço congelado no momento da precificação
  price_version_id           UUID          REFERENCES broadcast_price_versions(id) ON DELETE RESTRICT,
  priced_category            TEXT          CHECK (priced_category IN ('MARKETING','UTILITY','AUTHENTICATION')),
  priced_own_account         BOOLEAN,
  unit_meta_cost_brl         NUMERIC(10,4) CHECK (unit_meta_cost_brl >= 0),
  unit_fee_brl               NUMERIC(10,4) CHECK (unit_fee_brl >= 0),
  priced_recipients          INTEGER       CHECK (priced_recipients >= 0),
  subtotal_brl               NUMERIC(12,2) CHECK (subtotal_brl >= 0),
  credit_applied_brl         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credit_applied_brl >= 0),
  total_charged_brl          NUMERIC(12,2) CHECK (total_charged_brl >= 0),
  priced_at                  TIMESTAMPTZ,
  payment_id                 UUID          UNIQUE REFERENCES payments(id) ON DELETE SET NULL,

  -- As duas travas
  template_approved_at       TIMESTAMPTZ,
  paid_at                    TIMESTAMPTZ,   -- também preenchido quando o crédito cobriu tudo (sem payment_id)

  reply_window_hours         INTEGER       NOT NULL DEFAULT 72 CHECK (reply_window_hours BETWEEN 1 AND 720),

  total_recipients           INTEGER       NOT NULL DEFAULT 0,
  sent_count                 INTEGER       NOT NULL DEFAULT 0,
  delivered_count            INTEGER       NOT NULL DEFAULT 0,
  read_count                 INTEGER       NOT NULL DEFAULT 0,
  failed_count               INTEGER       NOT NULL DEFAULT 0,
  replied_count              INTEGER       NOT NULL DEFAULT 0,

  created_by                 UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at                 TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ   NOT NULL DEFAULT now(),
  started_at                 TIMESTAMPTZ,
  completed_at               TIMESTAMPTZ,
  cancelled_at               TIMESTAMPTZ,

  UNIQUE (id, institution_id),
  CHECK ((send_mode = 'scheduled') = (scheduled_at IS NOT NULL)),
  -- Trava: só envia com template aprovado E pago.
  CONSTRAINT broadcast_campaigns_release_gate CHECK (
    status NOT IN ('scheduled','sending','completed')
    OR (template_approved_at IS NOT NULL AND paid_at IS NOT NULL)
  ),
  -- Lista importada: não sai do rascunho sem opt-in confirmado pela escola
  -- (mais cedo que a liberação — nem gera cobrança sem a confirmação).
  CONSTRAINT broadcast_campaigns_opt_in_gate CHECK (
    status IN ('draft','cancelled')
    OR NOT has_imported_list
    OR import_opt_in_confirmed_at IS NOT NULL
  ),
  CHECK (import_opt_in_confirmed_at IS NULL OR import_opt_in_confirmed_by IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_institution
  ON broadcast_campaigns(institution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_active
  ON broadcast_campaigns(status, scheduled_at)
  WHERE status IN ('pending_template','pending_payment','scheduled','sending');

DROP TRIGGER IF EXISTS update_broadcast_campaigns_updated_at ON broadcast_campaigns;
CREATE TRIGGER update_broadcast_campaigns_updated_at
  BEFORE UPDATE ON broadcast_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 2. broadcast_credit_ledger (antes de recipients, que aponta pra cá) ───
-- Só inclusão. Saldo = soma. + crédito / − uso. Nunca fica negativo.
CREATE TABLE IF NOT EXISTS broadcast_credit_ledger (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID          NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  amount_brl      NUMERIC(12,2) NOT NULL CHECK (amount_brl <> 0),
  kind            TEXT          NOT NULL CHECK (kind IN ('failed_recipients','applied_to_campaign','manual_adjust')),
  campaign_id     UUID          REFERENCES broadcast_campaigns(id) ON DELETE SET NULL,
  recipient_count INTEGER       CHECK (recipient_count > 0),
  note            TEXT,
  created_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CHECK (kind <> 'failed_recipients'   OR amount_brl > 0),
  CHECK (kind <> 'applied_to_campaign' OR amount_brl < 0)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_credit_ledger_institution
  ON broadcast_credit_ledger(institution_id, created_at);

CREATE OR REPLACE FUNCTION public.broadcast_credit_balance(p_institution_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(sum(amount_brl), 0)::numeric(12,2)
  FROM broadcast_credit_ledger WHERE institution_id = p_institution_id
$$;

CREATE OR REPLACE FUNCTION public.broadcast_credit_ledger_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  -- pg_trigger_depth() > 1 = ação referencial do próprio Postgres (escola
  -- excluída → CASCADE; campanha/usuário excluído → SET NULL). Só alteração
  -- direta é bloqueada.
  IF TG_OP <> 'INSERT' THEN
    IF pg_trigger_depth() > 1 THEN
      RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;
    RAISE EXCEPTION 'Extrato de crédito não pode ser alterado — lance um ajuste';
  END IF;
  IF NEW.amount_brl < 0 THEN
    -- Serializa débitos da mesma escola (dois débitos simultâneos não
    -- podem, juntos, deixar o saldo negativo).
    PERFORM pg_advisory_xact_lock(hashtext('broadcast_credit:' || NEW.institution_id::text));
    v_balance := broadcast_credit_balance(NEW.institution_id);
    IF v_balance + NEW.amount_brl < 0 THEN
      RAISE EXCEPTION 'Crédito insuficiente (saldo R$ %, débito R$ %)', v_balance, -NEW.amount_brl;
    END IF;
  END IF;
  NEW.created_by := coalesce(NEW.created_by, auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_credit_ledger_guard ON broadcast_credit_ledger;
CREATE TRIGGER trg_broadcast_credit_ledger_guard
  BEFORE INSERT OR UPDATE OR DELETE ON broadcast_credit_ledger
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_credit_ledger_guard();

-- ── 3. broadcast_recipients ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          UUID        NOT NULL,
  institution_id       UUID        NOT NULL,
  contact_id           UUID        REFERENCES whatsapp_contacts(id) ON DELETE SET NULL,
  phone                TEXT        NOT NULL CHECK (phone ~ '^[0-9]{8,15}$'),
  phone_key            TEXT        GENERATED ALWAYS AS (broadcast_phone_key(phone)) STORED,
  source               TEXT        NOT NULL DEFAULT 'filter' CHECK (source IN ('filter','import')),
  variables            JSONB       NOT NULL DEFAULT '{}',   -- colunas da lista importada
  template_components  JSONB       NOT NULL DEFAULT '[]',   -- já resolvido pra este destinatário

  status               TEXT        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','sending','sent','delivered','read','failed','skipped')),
  failure_kind         TEXT        CHECK (failure_kind IN ('permanent','temporary_exhausted','unknown','suppressed')),
  attempts             SMALLINT    NOT NULL DEFAULT 0,
  next_attempt_at      TIMESTAMPTZ,
  claimed_at           TIMESTAMPTZ,
  wamid                TEXT,
  error_code           INTEGER,
  error_message        TEXT,
  sent_at              TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  read_at              TIMESTAMPTZ,
  failed_at            TIMESTAMPTZ,

  -- Resposta (último toque desta campanha)
  first_reply_at       TIMESTAMPTZ,
  clicked_button_index SMALLINT,
  conversation_id      UUID        REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
  lead_id              UUID        REFERENCES leads(id) ON DELETE SET NULL,

  credit_entry_id      UUID        REFERENCES broadcast_credit_ledger(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  FOREIGN KEY (campaign_id, institution_id)
    REFERENCES broadcast_campaigns(id, institution_id) ON DELETE CASCADE,
  UNIQUE (campaign_id, phone_key),
  CHECK (status NOT IN ('failed','skipped') OR failure_kind IS NOT NULL),
  CHECK (status <> 'sending' OR claimed_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_broadcast_recipients_wamid
  ON broadcast_recipients(wamid) WHERE wamid IS NOT NULL;
-- Fila: pendentes prontos pra (re)tentar.
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_queue
  ON broadcast_recipients(campaign_id, next_attempt_at, created_at) WHERE status = 'pending';
-- Travados em 'sending' (reaper).
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_sending
  ON broadcast_recipients(claimed_at) WHERE status = 'sending';
-- Casamento de resposta pela janela (fallback sem context.id).
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_reply_window
  ON broadcast_recipients(institution_id, phone_key, sent_at DESC) WHERE sent_at IS NOT NULL;
-- Limite por hora/dia da escola.
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_rate
  ON broadcast_recipients(institution_id, sent_at) WHERE sent_at IS NOT NULL;
-- Recontagem.
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_campaign_status
  ON broadcast_recipients(campaign_id, status);

-- ── 4. Ações por botão / resposta livre ────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_reply_actions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID        NOT NULL,
  institution_id UUID        NOT NULL,
  match_kind     TEXT        NOT NULL CHECK (match_kind IN ('any_reply','button')),
  button_index   SMALLINT    CHECK (button_index BETWEEN 0 AND 9),
  button_text    TEXT,
  tag_name       TEXT,
  skip_bot       BOOLEAN     NOT NULL DEFAULT false,
  rr_index       INTEGER     NOT NULL DEFAULT -1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (campaign_id, institution_id)
    REFERENCES broadcast_campaigns(id, institution_id) ON DELETE CASCADE,
  UNIQUE (id, institution_id),
  CHECK ((match_kind = 'button') = (button_index IS NOT NULL))
);

-- Uma ação "resposta livre" e uma por botão, por campanha.
CREATE UNIQUE INDEX IF NOT EXISTS uq_broadcast_reply_actions_slot
  ON broadcast_reply_actions(campaign_id, match_kind, coalesce(button_index, -1));

CREATE TABLE IF NOT EXISTS broadcast_reply_action_assignees (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID        NOT NULL,
  action_id      UUID        NOT NULL,
  user_id        UUID        REFERENCES users(id) ON DELETE CASCADE,
  group_id       UUID        REFERENCES whatsapp_groups(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (action_id, institution_id)
    REFERENCES broadcast_reply_actions(id, institution_id) ON DELETE CASCADE,
  CHECK ((user_id IS NULL) <> (group_id IS NULL)),
  UNIQUE (action_id, user_id),
  UNIQUE (action_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_reply_action_assignees_action
  ON broadcast_reply_action_assignees(action_id, created_at);

-- ── 5. broadcast_reply_events — toda resposta/clique casado ────────────────
CREATE TABLE IF NOT EXISTS broadcast_reply_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id      UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  campaign_id         UUID        NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  recipient_id        UUID        REFERENCES broadcast_recipients(id) ON DELETE SET NULL,
  action_id           UUID        REFERENCES broadcast_reply_actions(id) ON DELETE SET NULL,
  conversation_id     UUID        REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
  message_id          TEXT,
  match_type          TEXT        NOT NULL CHECK (match_type IN ('context','window_fallback','button_payload')),
  button_index        SMALLINT,
  is_new_conversation BOOLEAN     NOT NULL DEFAULT false,
  bot_skipped         BOOLEAN     NOT NULL DEFAULT false,
  assigned_user_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  matched_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_reply_events_campaign
  ON broadcast_reply_events(institution_id, campaign_id, matched_at);

-- ── 6. Alterações em tabelas existentes ────────────────────────────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS broadcast_campaign_id UUID UNIQUE REFERENCES broadcast_campaigns(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_payment_type_check') THEN
    -- Conferido antes: só existem implementation/monthly hoje.
    ALTER TABLE payments ADD CONSTRAINT payments_payment_type_check
      CHECK (payment_type IN ('implementation','monthly','extra_conversations','broadcast'));
  END IF;
  -- Só cobrança de campanha aponta pra campanha (a volta — campanha apagada —
  -- zera o vínculo e mantém a cobrança como histórico).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_broadcast_link_check') THEN
    ALTER TABLE payments ADD CONSTRAINT payments_broadcast_link_check
      CHECK (broadcast_campaign_id IS NULL OR payment_type = 'broadcast');
  END IF;
END $$;

ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS broadcast_campaign_id  UUID REFERENCES broadcast_campaigns(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS broadcast_recipient_id UUID REFERENCES broadcast_recipients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS broadcast_matched_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS broadcast_bot_skipped  BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_broadcast_campaign
  ON whatsapp_conversations(broadcast_campaign_id) WHERE broadcast_campaign_id IS NOT NULL;

-- FK que ficou pendente na M2.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'broadcast_suppressions_source_campaign_fkey') THEN
    ALTER TABLE broadcast_suppressions ADD CONSTRAINT broadcast_suppressions_source_campaign_fkey
      FOREIGN KEY (source_campaign_id) REFERENCES broadcast_campaigns(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 7. Permissão ───────────────────────────────────────────────────────────
-- Espelha PermissionsContext.tsx no servidor: admin/manager da escola sempre
-- podem; os demais só com user_permissions(module='transmissoes', enabled)
-- — sem linha = desligado (DEFAULT_OFF_MODULES, igual à Captação). O
-- endpoint (service role) chama com o JWT do usuário antes de qualquer
-- escrita.
CREATE OR REPLACE FUNCTION public.broadcast_user_can_manage(p_institution_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
      AND coalesce(u.active, true)
      AND p_institution_id IN (u.institution_id, u.active_institution_id)
      AND (
        u.role IN ('admin','manager')
        OR EXISTS (
          SELECT 1 FROM user_permissions p
          WHERE p.user_id = u.id AND p.institution_id = p_institution_id
            AND p.module = 'transmissoes' AND p.enabled
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION public.broadcast_user_can_manage(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_user_can_manage(UUID) TO authenticated;

-- ── 8. Funções de fila (só backend) ────────────────────────────────────────

-- Reivindica um lote respeitando os limites da escola (hora/dia). Diferente
-- do aion-broadcast: marca 'sending' (não 'sent') — só vira 'sent' com o
-- wamid da Meta em mãos. Serializa por escola pra duas campanhas da mesma
-- escola não estourarem o limite juntas.
CREATE OR REPLACE FUNCTION public.claim_broadcast_recipients(p_campaign_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS SETOF broadcast_recipients
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_inst       UUID;
  v_hourly     INTEGER;
  v_daily      INTEGER;
  v_used_hour  INTEGER;
  v_used_day   INTEGER;
  v_room       INTEGER;
BEGIN
  SELECT c.institution_id INTO v_inst
  FROM broadcast_campaigns c
  WHERE c.id = p_campaign_id AND c.status = 'sending';
  IF v_inst IS NULL THEN RETURN; END IF;

  SELECT s.hourly_limit, s.daily_limit INTO v_hourly, v_daily
  FROM broadcast_settings s WHERE s.institution_id = v_inst AND s.enabled;
  IF v_hourly IS NULL THEN RETURN; END IF;   -- módulo desligado pra escola

  PERFORM pg_advisory_xact_lock(hashtext('broadcast_claim:' || v_inst::text));

  -- Em trânsito ('sending') conta como gasto: já saiu (ou está saindo).
  SELECT count(*) FILTER (WHERE coalesce(r.sent_at, r.claimed_at) > now() - interval '1 hour'),
         count(*) FILTER (WHERE coalesce(r.sent_at, r.claimed_at) > now() - interval '24 hours')
    INTO v_used_hour, v_used_day
  FROM broadcast_recipients r
  WHERE r.institution_id = v_inst
    AND (r.sent_at > now() - interval '24 hours'
         OR (r.status = 'sending' AND r.claimed_at > now() - interval '24 hours'));

  v_room := least(p_limit, v_hourly - v_used_hour, v_daily - v_used_day);
  IF v_room <= 0 THEN RETURN; END IF;

  RETURN QUERY
  UPDATE broadcast_recipients r
  SET status = 'sending', claimed_at = now(), attempts = r.attempts + 1
  WHERE r.id IN (
    SELECT q.id FROM broadcast_recipients q
    WHERE q.campaign_id = p_campaign_id AND q.status = 'pending'
      AND (q.next_attempt_at IS NULL OR q.next_attempt_at <= now())
    ORDER BY q.created_at
    LIMIT v_room
    FOR UPDATE SKIP LOCKED
  )
  RETURNING r.*;
END;
$$;

-- Decisão 1: 'sending' sem confirmação por mais de p_minutes → failed/unknown
-- (vira crédito). Nunca volta pra 'pending' — reenviar arriscaria duplicar.
CREATE OR REPLACE FUNCTION public.broadcast_reap_stale_sending(p_minutes INTEGER DEFAULT 10)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE broadcast_recipients
  SET status        = 'failed',
      failure_kind  = 'unknown',
      failed_at     = now(),
      error_message = 'Envio sem confirmação da Meta — não reenviado pra evitar mensagem duplicada'
  WHERE status = 'sending' AND claimed_at < now() - make_interval(mins => p_minutes);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Avalia as travas e move a campanha. Chamada pelo webhook do Asaas (pago),
-- pelo webhook de template (aprovado/pausado) e pelo cron (agendada que
-- venceu). Idempotente. Devolve o status final.
CREATE OR REPLACE FUNCTION public.broadcast_try_release(p_campaign_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c               broadcast_campaigns%ROWTYPE;
  v_tpl_status    TEXT;
  v_pay_status    TEXT;
  v_pay_paid_at   TIMESTAMPTZ;
BEGIN
  SELECT * INTO c FROM broadcast_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF c.status IN ('draft','completed','cancelled') THEN RETURN c.status; END IF;

  SELECT s.status INTO v_tpl_status
  FROM template_institution_status s
  WHERE s.template_definition_id = c.template_definition_id AND s.institution_id = c.institution_id;

  IF c.payment_id IS NOT NULL THEN
    SELECT p.status, p.paid_at INTO v_pay_status, v_pay_paid_at FROM payments p WHERE p.id = c.payment_id;
  END IF;

  -- Pausas: template pausado/desativado pela Meta, ou pagamento estornado/
  -- cancelado, com a campanha já liberada ou em andamento.
  IF c.status IN ('scheduled','sending') AND v_tpl_status IN ('paused','disabled') THEN
    UPDATE broadcast_campaigns SET status = 'paused', paused_reason = 'template_' || v_tpl_status WHERE id = c.id;
    RETURN 'paused';
  END IF;
  IF c.status IN ('scheduled','sending','pending_payment') AND v_pay_status IN ('refunded','cancelled') THEN
    UPDATE broadcast_campaigns SET status = 'paused', paused_reason = 'payment_' || v_pay_status WHERE id = c.id;
    RETURN 'paused';
  END IF;
  -- Pausa manual/por erro de conta (131042/131048) não é desfeita aqui.
  IF c.status = 'paused' THEN RETURN 'paused'; END IF;

  IF c.template_approved_at IS NULL AND v_tpl_status = 'approved' THEN
    c.template_approved_at := now();
  END IF;
  IF c.paid_at IS NULL AND v_pay_status = 'paid' THEN
    c.paid_at := coalesce(v_pay_paid_at, now());
  END IF;

  IF c.template_approved_at IS NULL THEN
    c.status := 'pending_template';
  ELSIF c.paid_at IS NULL THEN
    c.status := 'pending_payment';
  ELSIF c.send_mode = 'scheduled' AND c.scheduled_at > now() THEN
    c.status := 'scheduled';
  ELSE
    c.status := 'sending';
    c.started_at := coalesce(c.started_at, now());
  END IF;

  UPDATE broadcast_campaigns
  SET status = c.status, template_approved_at = c.template_approved_at,
      paid_at = c.paid_at, started_at = c.started_at
  WHERE id = c.id;

  RETURN c.status;
END;
$$;

-- Recontagem direto dos destinatários (fonte de verdade, autocorretiva — mesmo
-- motivo do aion-broadcast). Conclui a campanha quando não sobra pending/sending.
CREATE OR REPLACE FUNCTION public.broadcast_recount(p_campaign_id UUID)
RETURNS broadcast_campaigns
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c broadcast_campaigns%ROWTYPE;
BEGIN
  UPDATE broadcast_campaigns bc
  SET total_recipients = x.total,
      sent_count       = x.sent,
      delivered_count  = x.delivered,
      read_count       = x.read,
      failed_count     = x.failed,
      replied_count    = x.replied,
      status           = CASE WHEN bc.status = 'sending' AND x.open = 0 THEN 'completed' ELSE bc.status END,
      completed_at     = CASE WHEN bc.status = 'sending' AND x.open = 0 THEN now() ELSE bc.completed_at END
  FROM (
    SELECT count(*)                                                  AS total,
           count(*) FILTER (WHERE status IN ('sent','delivered','read')) AS sent,
           count(*) FILTER (WHERE status IN ('delivered','read'))     AS delivered,
           count(*) FILTER (WHERE status = 'read')                    AS read,
           count(*) FILTER (WHERE status IN ('failed','skipped'))     AS failed,
           count(*) FILTER (WHERE first_reply_at IS NOT NULL)          AS replied,
           count(*) FILTER (WHERE status IN ('pending','sending'))    AS open
    FROM broadcast_recipients WHERE campaign_id = p_campaign_id
  ) x
  WHERE bc.id = p_campaign_id
  RETURNING bc.* INTO c;
  RETURN c;
END;
$$;

-- Decisão "falha vira crédito": credita, ao preço unitário cobrado nesta
-- campanha, todo destinatário failed/skipped ainda não creditado. Idempotente
-- (credit_entry_id marca o que já entrou); falha tardia (webhook depois de
-- concluir) entra numa nova chamada. Campanha sem cobrança (preço zero)
-- não gera crédito.
CREATE OR REPLACE FUNCTION public.broadcast_credit_failures(p_campaign_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c          broadcast_campaigns%ROWTYPE;
  v_unit     NUMERIC(12,4);
  v_ids      UUID[];
  v_amount   NUMERIC(12,2);
  v_entry    UUID;
BEGIN
  SELECT * INTO c FROM broadcast_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND OR c.paid_at IS NULL THEN RETURN 0; END IF;

  v_unit := coalesce(c.unit_fee_brl, 0)
          + CASE WHEN coalesce(c.priced_own_account, false) THEN 0 ELSE coalesce(c.unit_meta_cost_brl, 0) END;
  IF v_unit <= 0 THEN RETURN 0; END IF;

  SELECT array_agg(id) INTO v_ids
  FROM broadcast_recipients
  WHERE campaign_id = p_campaign_id AND status IN ('failed','skipped') AND credit_entry_id IS NULL;
  IF v_ids IS NULL THEN RETURN 0; END IF;

  v_amount := round(v_unit * array_length(v_ids, 1), 2);
  IF v_amount <= 0 THEN RETURN 0; END IF;

  INSERT INTO broadcast_credit_ledger(institution_id, amount_brl, kind, campaign_id, recipient_count, note)
  VALUES (c.institution_id, v_amount, 'failed_recipients', c.id, array_length(v_ids, 1),
          'Destinatários que falharam na campanha "' || c.name || '"')
  RETURNING id INTO v_entry;

  UPDATE broadcast_recipients SET credit_entry_id = v_entry WHERE id = ANY(v_ids);
  RETURN v_amount;
END;
$$;

-- Funções de fila/liberação/crédito: só o backend (service role) executa.
REVOKE ALL ON FUNCTION public.claim_broadcast_recipients(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_reap_stale_sending(INTEGER)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_try_release(UUID)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_recount(UUID)                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_credit_failures(UUID)          FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_broadcast_recipients(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.broadcast_reap_stale_sending(INTEGER)    TO service_role;
GRANT EXECUTE ON FUNCTION public.broadcast_try_release(UUID)              TO service_role;
GRANT EXECUTE ON FUNCTION public.broadcast_recount(UUID)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.broadcast_credit_failures(UUID)          TO service_role;

-- ── 9. RLS — só leitura pro navegador; escrita = backend ───────────────────
ALTER TABLE broadcast_campaigns              ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_recipients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_reply_actions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_reply_action_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_reply_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_credit_ledger          ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['broadcast_campaigns','broadcast_recipients','broadcast_reply_actions',
                           'broadcast_reply_action_assignees','broadcast_reply_events','broadcast_credit_ledger']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (
         institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid())
         OR is_super_admin_user())',
      t || '_select', t);
  END LOOP;
END $$;

-- ── 10. Correção dos guards da M2 (20260926010000) ─────────────────────────
-- Os guards bloqueavam também as ações referenciais do próprio Postgres:
-- excluir um usuário que criou versão de preço (created_by → SET NULL) ou
-- liberou supressão (lifted_by → SET NULL), ou uma campanha que originou
-- supressão (source_campaign_id → SET NULL, FK criada acima), falharia com
-- "não pode ser alterada". Mesma regra de antes pra alteração direta;
-- pg_trigger_depth() > 1 identifica a ação referencial e deixa passar.
CREATE OR REPLACE FUNCTION public.broadcast_price_version_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_effective TIMESTAMPTZ;
BEGIN
  IF TG_OP <> 'INSERT' AND pg_trigger_depth() > 1 THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_TABLE_NAME = 'broadcast_price_versions' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.effective_from < now() - interval '1 minute' THEN
        RAISE EXCEPTION 'Vigência não pode ser retroativa';
      END IF;
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND current_setting('broadcast.finalizing_version', true) = OLD.id::text THEN
      RETURN NEW;
    END IF;
    IF TG_OP IN ('UPDATE','DELETE') AND OLD.effective_from <= now() THEN
      RAISE EXCEPTION 'Versão de preço já em vigor não pode ser alterada — crie uma nova versão';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.effective_from <= now() AND NEW.effective_from IS DISTINCT FROM OLD.effective_from THEN
      RAISE EXCEPTION 'Nova data de vigência precisa ser futura';
    END IF;
  ELSE
    SELECT effective_from INTO v_effective FROM broadcast_price_versions
      WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.version_id ELSE NEW.version_id END;
    IF v_effective <= now() THEN
      RAISE EXCEPTION 'Itens de versão de preço já em vigor não podem ser alterados — crie uma nova versão';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.version_id IS DISTINCT FROM OLD.version_id THEN
      RAISE EXCEPTION 'Não é permitido mover item entre versões';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_suppressions_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF (NEW.institution_id, NEW.phone, NEW.scope, NEW.reason, NEW.meta_error_code, NEW.source_campaign_id, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM
     (OLD.institution_id, OLD.phone, OLD.scope, OLD.reason, OLD.meta_error_code, OLD.source_campaign_id, OLD.created_by, OLD.created_at)
  THEN
    RAISE EXCEPTION 'Supressão não pode ser editada — só liberada';
  END IF;
  IF OLD.lifted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Supressão já liberada';
  END IF;
  IF NEW.lifted_at IS NOT NULL THEN
    NEW.lifted_by := coalesce(auth.uid(), NEW.lifted_by);
  END IF;
  RETURN NEW;
END;
$$;

-- Único lançamento manual: ajuste de crédito pelo Super Admin.
DROP POLICY IF EXISTS "broadcast_credit_ledger_super_admin_adjust" ON broadcast_credit_ledger;
CREATE POLICY "broadcast_credit_ledger_super_admin_adjust" ON broadcast_credit_ledger
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin_user() AND kind = 'manual_adjust');
