-- =============================================================================
-- 20260802000000_whatsapp_conversations_aion_lead_id.sql
-- Corrige o FK de whatsapp_conversations.lead_id, que apontava só para
-- leads(id) mas era usado por dois lados diferentes da mesma coluna:
--   - is_aion_inbox=false (lado escola): lead_id -> leads(id)      [correto, já funcionava]
--   - is_aion_inbox=true  (Inbox Áion): lead_id -> crm_leads(id)   [FK errado — sempre
--     falhava silenciosamente, 0 linhas com lead_id preenchido em conversas do
--     Inbox Áion apesar do código já tentar fazer esse vínculo]
--
-- Opção A (sem rename) aprovada na investigação: lead_id continua exatamente
-- como está (FK para leads(id), lado escola sem nenhuma mudança de schema ou
-- de código — WhatsAppHub.tsx e src/lib/supabase.ts não são tocados). Só
-- adiciona uma coluna nova, aion_lead_id, com FK para crm_leads(id), pro
-- Inbox Áion (AionInboxHub.tsx / AionWhatsAppHub.tsx) usar.
-- =============================================================================

ALTER TABLE whatsapp_conversations
  ADD COLUMN aion_lead_id UUID REFERENCES crm_leads(id);

-- Defesa extra: garante que cada linha só usa a coluna certa pro seu lado.
-- is_aion_inbox é drift (sem CREATE TABLE/ALTER TABLE rastreado neste repo),
-- por isso o COALESCE trata NULL como "não é Áion" defensivamente.
ALTER TABLE whatsapp_conversations
  ADD CONSTRAINT chk_whatsapp_conversations_lead_scope CHECK (
    NOT (COALESCE(is_aion_inbox, false) = true  AND lead_id      IS NOT NULL) AND
    NOT (COALESCE(is_aion_inbox, false) = false AND aion_lead_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_aion_lead_id
  ON whatsapp_conversations(aion_lead_id) WHERE aion_lead_id IS NOT NULL;
