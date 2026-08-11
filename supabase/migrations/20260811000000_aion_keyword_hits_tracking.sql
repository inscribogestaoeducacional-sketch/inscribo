-- =============================================================================
-- 20260811000000_aion_keyword_hits_tracking.sql
-- Rastreamento completo de keyword → conversa, independente de virar lead ou
-- não. O rastreio anterior (crm_leads.notes = "Veio via QR Code: {label}") só
-- existe quando create_lead=true E é o primeiro crm_lead daquele telefone em
-- todo o CRM — não cobre conversas que nunca viram lead, nem reincidência de
-- quem já é lead de outra origem.
-- =============================================================================

-- 1) Atribuição de primeiro toque — "qual keyword iniciou essa conversa",
--    1 valor por conversa, nunca sobrescrito (ver api/whatsapp/webhook.ts,
--    update com .is('source_keyword_id', null) no WHERE).
ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS source_keyword_id UUID REFERENCES aion_keywords(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_keyword_matched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_source_keyword
  ON whatsapp_conversations(source_keyword_id) WHERE source_keyword_id IS NOT NULL;

-- 2) Log de todo match, inclusive repetido — "quantas vezes essa keyword foi
--    mandada", independente de virar lead ou de já existir atribuição de
--    primeiro toque pra conversa.
CREATE TABLE IF NOT EXISTS aion_keyword_hits (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id      UUID        NOT NULL REFERENCES aion_keywords(id) ON DELETE CASCADE,
  remote_jid      TEXT        NOT NULL,
  conversation_id UUID        REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
  matched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aion_keyword_hits_keyword ON aion_keyword_hits(keyword_id);

-- RLS: mesmo padrão de aion_keywords (20260526000100_aion_inbox_flows.sql) —
-- painel interno da Áion (CampaignsTab, /superadmin), sem isolamento por
-- institution_id; acesso é controlado pela camada de app, não pelo Postgres.
ALTER TABLE aion_keyword_hits DISABLE ROW LEVEL SECURITY;
