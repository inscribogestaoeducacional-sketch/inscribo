-- =============================================================================
-- 20260701000002_whatsapp_stale_conversations.sql
-- Resgate de conversa parada: conversa atribuída a um atendente, mas sem
-- atividade há mais de `stale_conversation_hours` horas, volta a ficar
-- visível (e resgatável) para todos os atendentes da instituição.
--
-- Depende de 20260701000000_whatsapp_permissions.sql e
-- 20260701000001_whatsapp_waiting_queue.sql.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Coluna de configuração por instituição em whatsapp_flows
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_flows
  ADD COLUMN IF NOT EXISTS stale_conversation_hours INTEGER NOT NULL DEFAULT 24;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Helper: whatsapp_conversation_is_stale()
-- Usa o limite configurado em whatsapp_flows para a instituição; se a
-- instituição ainda não tem um registro em whatsapp_flows, usa 24h como
-- padrão em vez de desativar silenciosamente o recurso.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION whatsapp_conversation_is_stale(p_institution_id UUID, p_last_message_at TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_hours INTEGER;
BEGIN
  IF p_last_message_at IS NULL THEN
    RETURN false;
  END IF;

  SELECT stale_conversation_hours INTO v_hours
  FROM whatsapp_flows
  WHERE institution_id = p_institution_id
  LIMIT 1;

  v_hours := COALESCE(v_hours, 24);

  RETURN p_last_message_at < NOW() - (v_hours || ' hours')::INTERVAL;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS: SELECT e UPDATE em whatsapp_conversations passam a liberar
-- conversas "paradas" também. UPDATE precisa do mesmo OR — sem isso,
-- rescueConversation() faria um UPDATE que o RLS bloquearia (0 linhas
-- afetadas) para qualquer atendente que não seja admin/liberado.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "whatsapp_conversations_select" ON whatsapp_conversations;

CREATE POLICY "whatsapp_conversations_select" ON whatsapp_conversations
  FOR SELECT
  USING (
    institution_id = current_user_institution_id()
    AND (
      user_can_see_all_conversations()
      OR assigned_user_id = auth.uid()
      OR (assigned_user_id IS NULL AND status = 'waiting')
      OR (
        assigned_user_id IS NOT NULL
        AND assigned_user_id != auth.uid()
        AND status = 'waiting'
        AND whatsapp_conversation_is_stale(institution_id, last_message_at)
      )
    )
  );

DROP POLICY IF EXISTS "whatsapp_conversations_update" ON whatsapp_conversations;

CREATE POLICY "whatsapp_conversations_update" ON whatsapp_conversations
  FOR UPDATE
  USING (
    institution_id = current_user_institution_id()
    AND (
      user_can_see_all_conversations()
      OR assigned_user_id = auth.uid()
      OR (assigned_user_id IS NULL AND status = 'waiting')
      OR (
        assigned_user_id IS NOT NULL
        AND assigned_user_id != auth.uid()
        AND status = 'waiting'
        AND whatsapp_conversation_is_stale(institution_id, last_message_at)
      )
    )
  )
  WITH CHECK (institution_id = current_user_institution_id());

GRANT EXECUTE ON FUNCTION whatsapp_conversation_is_stale(UUID, TIMESTAMPTZ) TO authenticated;
