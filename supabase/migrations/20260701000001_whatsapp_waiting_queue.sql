-- =============================================================================
-- 20260701000001_whatsapp_waiting_queue.sql
-- Fila de conversas "aguardando": conversas sem atendente só entram na fila
-- visível a todos quando status = 'waiting'. Uma conversa 'closed' sem dono
-- não deve reaparecer para ninguém além de admin/liberado.
--
-- Depende de 20260701000000_whatsapp_permissions.sql (current_user_institution_id,
-- user_can_see_all_conversations).
-- =============================================================================

ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_conversations_select" ON whatsapp_conversations;

CREATE POLICY "whatsapp_conversations_select" ON whatsapp_conversations
  FOR SELECT
  USING (
    institution_id = current_user_institution_id()
    AND (
      user_can_see_all_conversations()
      OR assigned_user_id = auth.uid()
      OR (assigned_user_id IS NULL AND status = 'waiting')
    )
  );

-- Mesma regra na UPDATE: claimConversationIfUnassigned faz um UPDATE
-- condicional (WHERE assigned_user_id IS NULL) e usa o número de linhas
-- afetadas para saber se o "claim" funcionou. Sem este ajuste, a policy
-- antiga permitiria a um atendente "assumir" uma conversa closed+sem dono,
-- que não deveria nem aparecer na fila dele.
DROP POLICY IF EXISTS "whatsapp_conversations_update" ON whatsapp_conversations;

CREATE POLICY "whatsapp_conversations_update" ON whatsapp_conversations
  FOR UPDATE
  USING (
    institution_id = current_user_institution_id()
    AND (
      user_can_see_all_conversations()
      OR assigned_user_id = auth.uid()
      OR (assigned_user_id IS NULL AND status = 'waiting')
    )
  )
  WITH CHECK (institution_id = current_user_institution_id());
