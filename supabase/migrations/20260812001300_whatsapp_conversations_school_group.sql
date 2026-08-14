-- =============================================================================
-- 20260812001300_whatsapp_conversations_school_group.sql
-- Suporte à conversa de "pré-roteamento" do WhatsApp compartilhado de um
-- school_group: enquanto o contato ainda não escolheu a unidade no menu do
-- bot, o estado da conversa (bot_current_node/bot_variables) é rastreado
-- numa linha com institution_id NULL + school_group_id preenchido — mesmo
-- padrão já usado pelo Inbox Áion (institution_id NULL + is_aion_inbox true).
-- Assim que a unidade é resolvida, uma linha NOVA e normal é criada com o
-- institution_id real (ver api/whatsapp/webhook.ts), e o fluxo segue
-- idêntico ao caminho de uma escola sem grupo.
-- =============================================================================

ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS school_group_id UUID REFERENCES school_groups(id) ON DELETE CASCADE;

ALTER TABLE whatsapp_conversations
  DROP CONSTRAINT IF EXISTS whatsapp_conversations_not_both_owners;
ALTER TABLE whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_not_both_owners
  CHECK (NOT (institution_id IS NOT NULL AND school_group_id IS NOT NULL));
