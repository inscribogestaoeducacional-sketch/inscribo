-- =============================================================================
-- 20260701000007_whatsapp_bot_message_flag.sql
-- Corrige vazamento de mensagens de atendente na RLS de whatsapp_messages.
--
-- BUG: a policy criada em 20260701000003_whatsapp_message_filter.sql libera
-- mensagens humanas para todo mundo quando `(from_me = true AND
-- sender_user_id IS NULL)` — a intenção era tratar isso como "mensagem do
-- robô", mas sender_user_id só passou a ser gravado a partir daquela
-- migration. Toda mensagem humana enviada ANTES do deploy (e qualquer
-- mensagem futura em que o INSERT deixe de preencher sender_user_id por
-- algum motivo) também cai em NULL e acaba sendo tratada como robô,
-- vazando para outros atendentes sem can_see_all_conversations.
--
-- FIX: parar de usar sender_user_id IS NULL como proxy de "é robô" e usar
-- uma coluna própria is_bot_message, setada explicitamente por quem insere
-- a mensagem. Sem essa marcação explícita, o default é `false` — ou seja,
-- na dúvida a mensagem humana antiga fica restrita (visível só para
-- admin/liberado), nunca vaza. O backfill abaixo recupera a marcação para
-- o histórico de mensagens de robô já existente, usando o marcador que o
-- código já grava há tempos: contact_name = '_bot_' nos inserts de
-- api/whatsapp/webhook.ts.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Coluna is_bot_message em whatsapp_messages
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS is_bot_message BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_is_bot_message
  ON whatsapp_messages(is_bot_message);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill do histórico: todo insert de mensagem de robô em
-- api/whatsapp/webhook.ts sempre gravou contact_name = '_bot_' junto com
-- from_me = true. Usa esse marcador existente para recuperar a marcação
-- sem depender de sender_user_id.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE whatsapp_messages
SET is_bot_message = true
WHERE from_me = true
  AND contact_name = '_bot_'
  AND is_bot_message = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS: reescreve a policy de SELECT em whatsapp_messages trocando
-- "sender_user_id IS NULL" por "is_bot_message = true".
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "whatsapp_messages_select" ON whatsapp_messages;

CREATE POLICY "whatsapp_messages_select" ON whatsapp_messages
  FOR SELECT
  USING (
    institution_id = current_user_institution_id()
    AND (
      user_can_see_all_conversations()
      OR from_me = false
      OR sender_user_id = auth.uid()
      OR is_bot_message = true
      OR EXISTS (
        SELECT 1 FROM whatsapp_message_visibility wmv
        WHERE wmv.message_id = whatsapp_messages.id
          AND wmv.visible_to_user_id = auth.uid()
      )
    )
  );
