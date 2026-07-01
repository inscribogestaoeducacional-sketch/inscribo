-- =============================================================================
-- 20260701000003_whatsapp_message_filter.sql
-- Corrige vazamento de mensagens entre atendentes: um atendente sem
-- can_see_all_conversations podia abrir uma conversa atribuída a outra
-- pessoa (via fila "Aguardando"/"Paradas") e ver as mensagens que essa outra
-- pessoa enviou. A policy antiga de whatsapp_messages só checava se a
-- CONVERSA era visível, nunca quem era o REMETENTE de cada mensagem humana.
--
-- Modelo novo, por mensagem:
--   - Mensagem do cliente (from_me = false)  → sempre visível a qualquer
--     atendente da instituição (não é conteúdo sigiloso entre colegas).
--   - Mensagem do robô (from_me = true, sender_user_id IS NULL) → sempre
--     visível a todos.
--   - Mensagem enviada por um atendente humano (sender_user_id preenchido)
--     → só visível para quem enviou, para admin/liberado, ou para quem tem
--     grant explícito em whatsapp_message_visibility (snapshot de transferência).
--
-- NOTA IMPORTANTE: sender_user_id só existe a partir desta migration.
-- Mensagens humanas enviadas ANTES dela ficam com sender_user_id NULL, e
-- portanto caem na regra "from_me=true + sender_user_id NULL" (tratada como
-- robô/pública). Não há como distinguir retroativamente quem as enviou sem
-- um backfill de dados que não temos — o efeito prático é que o filtro por
-- remetente só passa a valer para mensagens enviadas depois do deploy desta
-- migration; o histórico antigo continua visível a todos como já estava.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Coluna sender_user_id em whatsapp_messages
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sender_user_id
  ON whatsapp_messages(sender_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS: reescreve a policy de SELECT em whatsapp_messages
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
      OR (from_me = true AND sender_user_id IS NULL)
      OR EXISTS (
        SELECT 1 FROM whatsapp_message_visibility wmv
        WHERE wmv.message_id = whatsapp_messages.id
          AND wmv.visible_to_user_id = auth.uid()
      )
    )
  );
