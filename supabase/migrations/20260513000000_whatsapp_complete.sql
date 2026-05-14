-- =============================================================================
-- 20260513000000_whatsapp_complete.sql
-- WhatsApp: colunas faltantes + tabelas novas (flows, quick_replies,
-- templates, campaigns, blacklist) + horários de atendente
-- Todos os ALTER usam IF NOT EXISTS — idempotente.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. whatsapp_messages — colunas faltantes
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS raw_data          JSONB;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. whatsapp_conversations — colunas faltantes
--    (last_message_at já existe; last_message, tags e profile_picture_url não)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS last_message        TEXT,
  ADD COLUMN IF NOT EXISTS tags                TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. whatsapp_flows — fluxo automático do bot por instituição
--    Inclui já os campos de robô configurável (item 8 do pedido).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_flows (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id              UUID        NOT NULL UNIQUE
                                            REFERENCES institutions(id) ON DELETE CASCADE,
  is_active                   BOOLEAN     DEFAULT false,
  timezone                    TEXT        DEFAULT 'America/Fortaleza',
  working_days                TEXT[]      DEFAULT '{MON,TUE,WED,THU,FRI}',
  working_start               TEXT        DEFAULT '08:00',
  working_end                 TEXT        DEFAULT '18:00',

  -- Mensagens automáticas
  welcome_message             TEXT,
  off_hours_message           TEXT,

  -- Menu interativo
  menu_enabled                BOOLEAN     DEFAULT false,
  menu_message                TEXT,
  menu_options                JSONB       DEFAULT '[]',
  -- Cada item: { keyword, label, assignee_id, assignee_name }

  -- Limites do bot
  max_bot_messages            INTEGER     DEFAULT 5,
  default_assignee_id         UUID,

  -- Robô configurável (fase 2)
  bot_enabled                 BOOLEAN     DEFAULT false,
  bot_flow                    JSONB       DEFAULT '[]',
  -- Nós do fluxo: [{ id, type, message, next, condition }]
  transfer_after_messages     INTEGER     DEFAULT 5,

  -- Pesquisa de satisfação
  satisfaction_survey_enabled BOOLEAN     DEFAULT false,
  satisfaction_template_id    UUID,

  created_at                  TIMESTAMPTZ DEFAULT now(),
  updated_at                  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_flows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "institution_isolation" ON whatsapp_flows;
CREATE POLICY "institution_isolation" ON whatsapp_flows
  FOR ALL USING (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_whatsapp_flows_institution
  ON whatsapp_flows(institution_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. whatsapp_quick_replies — respostas rápidas por instituição
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_quick_replies (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  message        TEXT        NOT NULL,
  order_index    INTEGER     DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_quick_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "institution_isolation" ON whatsapp_quick_replies;
CREATE POLICY "institution_isolation" ON whatsapp_quick_replies
  FOR ALL USING (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_whatsapp_quick_replies_institution
  ON whatsapp_quick_replies(institution_id, order_index);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. whatsapp_templates — templates aprovados pela Meta por instituição
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  language       TEXT        DEFAULT 'pt_BR',
  category       TEXT        DEFAULT 'UTILITY',
  components     JSONB       DEFAULT '[]',
  -- Estrutura Meta: [{ type: HEADER|BODY|FOOTER|BUTTONS, ... }]
  template_id    TEXT,       -- ID retornado pela Meta após aprovação
  status         TEXT        DEFAULT 'pending',
  -- pending | approved | rejected | paused
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "institution_isolation" ON whatsapp_templates;
CREATE POLICY "institution_isolation" ON whatsapp_templates
  FOR ALL USING (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_institution
  ON whatsapp_templates(institution_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. whatsapp_campaigns — disparos em massa via template
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  template_id     UUID        REFERENCES whatsapp_templates(id),
  status          TEXT        DEFAULT 'draft',
  -- draft | scheduled | sending | sent | cancelled
  scheduled_at    TIMESTAMPTZ,
  sent_count      INTEGER     DEFAULT 0,
  delivered_count INTEGER     DEFAULT 0,
  read_count      INTEGER     DEFAULT 0,
  recipients      JSONB       DEFAULT '[]',
  -- [{ phone, name, variables: {1: "valor"} }]
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "institution_isolation" ON whatsapp_campaigns;
CREATE POLICY "institution_isolation" ON whatsapp_campaigns
  FOR ALL USING (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_institution
  ON whatsapp_campaigns(institution_id, status);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. whatsapp_blacklist — números bloqueados por instituição
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_blacklist (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  phone_number   TEXT        NOT NULL,
  reason         TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(institution_id, phone_number)
);

ALTER TABLE whatsapp_blacklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "institution_isolation" ON whatsapp_blacklist;
CREATE POLICY "institution_isolation" ON whatsapp_blacklist
  FOR ALL USING (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_whatsapp_blacklist_institution
  ON whatsapp_blacklist(institution_id, phone_number);


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. users — horários de trabalho por atendente
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS working_hours_start TEXT,
  ADD COLUMN IF NOT EXISTS working_hours_end   TEXT,
  ADD COLUMN IF NOT EXISTS working_days        TEXT[];
