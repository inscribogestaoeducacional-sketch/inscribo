-- =============================================================================
-- 20260806000000_aion_contacts.sql
-- Módulo "Contatos" do Inbox Áion — lista de contatos importável/editável,
-- independente de whatsapp_contacts (que é por escola, institution_id NOT NULL
-- — ver 20260802000100_fix_aion_inbox_contact_sync_and_unread.sql, o Inbox
-- Áion nunca escreve ali). phone é armazenado já normalizado no formato de
-- remote_jid (DDI + DDD + 9º dígito — mesma convenção de
-- api/whatsapp/webhook.ts:normalizePhone / supabase/functions/_shared/phone.ts),
-- pra permitir join direto com whatsapp_conversations.remote_jid sem precisar
-- de uma coluna remote_jid separada.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aion_contacts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           TEXT        NOT NULL,
  name            TEXT,
  email           TEXT,
  notes           TEXT,
  tags            JSONB       NOT NULL DEFAULT '[]',
  source          TEXT        NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv_import', 'conversation')),
  conversation_id UUID        REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
  aion_lead_id    UUID        REFERENCES crm_leads(id) ON DELETE SET NULL,
  opted_out       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by      UUID        REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (phone)
);

CREATE INDEX IF NOT EXISTS idx_aion_contacts_phone ON aion_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_aion_contacts_tags  ON aion_contacts USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_aion_contacts_opted_out ON aion_contacts(opted_out) WHERE opted_out = FALSE;

CREATE OR REPLACE FUNCTION set_aion_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_aion_contacts_updated_at ON aion_contacts;
CREATE TRIGGER trg_aion_contacts_updated_at
  BEFORE UPDATE ON aion_contacts
  FOR EACH ROW EXECUTE FUNCTION set_aion_contacts_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: admin_geral apenas — mesmo padrão (is_super_admin_user()) já usado em
-- aion_scheduled_messages (20260802000200) e demais tabelas do Inbox Áion.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE aion_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aion_contacts_admin_geral" ON aion_contacts;
CREATE POLICY "aion_contacts_admin_geral" ON aion_contacts
  FOR ALL
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());
