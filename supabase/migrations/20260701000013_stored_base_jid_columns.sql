-- =============================================================================
-- 20260701000013_stored_base_jid_columns.sql
-- Corrige o timeout real (57014) encontrado ao validar 20260701000009-012:
-- uma consulta trivial (430 conversas, 8343 mensagens) levava 3.5s+ e ainda
-- assim quase estourava o statement_timeout do PostgREST em produção.
--
-- CAUSA: whatsapp_base_jid(remote_jid) é uma função (chama
-- normalize_phone_br, em PL/pgSQL) avaliada em tempo de execução dentro de
-- subqueries CORRELACIONADAS nas policies de whatsapp_messages/
-- whatsapp_conversations. Mesmo com o índice de expressão criado em
-- 20260701000012, o plano ficou com "Index Scan ... loops=129" a ~25ms por
-- chamada — o índice de expressão ajuda em buscas por valor constante, mas
-- não evita o custo de RECALCULAR a função do lado da subquery a cada laço
-- correlacionado. Para 430 conversas isso não deveria ser lento; o
-- gargalo real é a função sendo invocada repetidamente em vez de comparar
-- um valor já calculado.
--
-- FIX: guarda o resultado em uma coluna gerada (STORED) em cada tabela e
-- compara essa coluna diretamente nas policies — vira uma igualdade de
-- texto indexada normal, sem função nenhuma em tempo de execução.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Colunas geradas
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS base_jid TEXT GENERATED ALWAYS AS (whatsapp_base_jid(remote_jid)) STORED;

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS base_jid TEXT GENERATED ALWAYS AS (whatsapp_base_jid(remote_jid)) STORED;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Índices sobre as colunas geradas (comparação direta, sem função)
-- ─────────────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_whatsapp_conversations_base_jid;
DROP INDEX IF EXISTS idx_whatsapp_conversations_assignee_base_jid;
CREATE INDEX idx_whatsapp_conversations_assignee_base_jid
  ON whatsapp_conversations (institution_id, assigned_user_id, base_jid);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_base_jid
  ON whatsapp_messages (institution_id, base_jid);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. whatsapp_messages: reescreve select/update/delete usando base_jid
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "whatsapp_messages_select" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_select" ON whatsapp_messages
  FOR SELECT
  USING (
    (is_aion_inbox = true AND is_aion_platform_operator())
    OR (
      institution_id = current_user_institution_id()
      AND (
        user_can_see_all_conversations()
        OR sender_user_id = auth.uid()
        OR is_bot_message = true
        OR EXISTS (
          SELECT 1 FROM whatsapp_message_visibility wmv
          WHERE wmv.message_id = whatsapp_messages.id
            AND wmv.visible_to_user_id = auth.uid()
        )
        OR (
          from_me = false
          AND NOT EXISTS (
            SELECT 1 FROM whatsapp_conversations wc
            WHERE wc.institution_id = whatsapp_messages.institution_id
              AND wc.base_jid = whatsapp_messages.base_jid
              AND wc.assigned_user_id = auth.uid()
          )
        )
        OR EXISTS (
          SELECT 1 FROM whatsapp_conversations wc
          WHERE wc.institution_id = whatsapp_messages.institution_id
            AND wc.assigned_user_id = auth.uid()
            AND wc.base_jid = whatsapp_messages.base_jid
            AND (
              wc.transferred_at IS NULL
              OR whatsapp_messages.timestamp >= wc.transferred_at
              OR EXISTS (
                SELECT 1 FROM users u
                WHERE u.id = auth.uid()
                  AND u.can_see_full_history = true
              )
            )
        )
      )
    )
  );

DROP POLICY IF EXISTS "whatsapp_messages_delete" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_delete" ON whatsapp_messages
  FOR DELETE
  USING (
    (is_aion_inbox = true AND is_aion_platform_operator())
    OR (
      institution_id = current_user_institution_id()
      AND (
        user_can_see_all_conversations()
        OR EXISTS (
          SELECT 1 FROM whatsapp_conversations wc
          WHERE wc.institution_id = whatsapp_messages.institution_id
            AND wc.assigned_user_id = auth.uid()
            AND wc.base_jid = whatsapp_messages.base_jid
            AND (wc.transferred_at IS NULL OR whatsapp_messages.timestamp >= wc.transferred_at)
        )
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. whatsapp_conversations: snapshot_visibility_on_transfer também usava
--    whatsapp_base_jid() num UPDATE em massa — mesma otimização.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION snapshot_visibility_on_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_can_see_full BOOLEAN;
BEGIN
  IF NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id
     AND OLD.assigned_user_id IS NOT NULL THEN

    SELECT can_see_full_history INTO v_old_can_see_full
    FROM users WHERE id = OLD.assigned_user_id;

    INSERT INTO whatsapp_message_visibility (institution_id, message_id, visible_to_user_id)
    SELECT wm.institution_id, wm.id, OLD.assigned_user_id
    FROM whatsapp_messages wm
    WHERE wm.institution_id = OLD.institution_id
      AND wm.base_jid = OLD.base_jid
      AND (
        COALESCE(v_old_can_see_full, false)
        OR OLD.transferred_at IS NULL
        OR wm.timestamp >= OLD.transferred_at
      )
    ON CONFLICT (message_id, visible_to_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
