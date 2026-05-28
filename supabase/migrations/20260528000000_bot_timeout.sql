-- =============================================================================
-- 20260528000000_bot_timeout.sql
-- Timeout de inatividade do bot: colunas em whatsapp_flows,
-- tabela bot_timeout_queue e função process_bot_timeouts().
-- Todos os ALTER/CREATE usam IF NOT EXISTS — idempotente.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Colunas de bot timeout em whatsapp_flows
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_flows
  ADD COLUMN IF NOT EXISTS bot_timeout_minutes     INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS bot_timeout_message     TEXT,
  ADD COLUMN IF NOT EXISTS bot_timeout_assignee_id UUID;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tabela de fila: bot_timeout_queue
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_timeout_queue (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  remote_jid     TEXT        NOT NULL,
  message        TEXT        NOT NULL,
  sent           BOOLEAN     DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, remote_jid)
);

ALTER TABLE bot_timeout_queue ENABLE ROW LEVEL SECURITY;

-- Apenas service role acessa (o RLS bloqueia acesso direto de usuários)
DROP POLICY IF EXISTS "service_role_only" ON bot_timeout_queue;
CREATE POLICY "service_role_only" ON bot_timeout_queue
  FOR ALL USING (false);

CREATE INDEX IF NOT EXISTS idx_bot_timeout_queue_unsent
  ON bot_timeout_queue(sent, created_at)
  WHERE sent = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Função PL/pgSQL: detecta timeouts, atualiza conversas e enfileira mensagens
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION process_bot_timeouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  flow_rec    RECORD;
  conv_rec    RECORD;
  assignee_id UUID;
  assignee_nm TEXT;
BEGIN
  -- Iterar por cada escola com bot timeout configurado
  FOR flow_rec IN
    SELECT
      institution_id,
      bot_timeout_minutes,
      bot_timeout_message,
      bot_timeout_assignee_id,
      default_assignee_id
    FROM whatsapp_flows
    WHERE bot_enabled = true
      AND bot_timeout_minutes IS NOT NULL
      AND bot_timeout_minutes > 0
      AND bot_timeout_message IS NOT NULL
      AND bot_timeout_message <> ''
  LOOP
    -- Buscar conversas com bot ativo e sem resposta do cliente
    FOR conv_rec IN
      SELECT wc.id, wc.remote_jid
      FROM whatsapp_conversations wc
      WHERE wc.institution_id = flow_rec.institution_id
        AND wc.bot_active    = true
        AND wc.status       != 'closed'
        -- Última mensagem mais antiga que o timeout configurado
        AND wc.last_message_at < NOW() - (flow_rec.bot_timeout_minutes || ' minutes')::INTERVAL
        -- Garantir que o cliente enviou pelo menos uma mensagem (conversa real)
        AND EXISTS (
          SELECT 1 FROM whatsapp_messages wm
          WHERE wm.remote_jid     = wc.remote_jid
            AND wm.institution_id = wc.institution_id
            AND wm.from_me        = false
        )
    LOOP
      -- Determinar atendente responsável
      assignee_id := COALESCE(
        flow_rec.bot_timeout_assignee_id,
        flow_rec.default_assignee_id
      );

      -- Buscar nome do atendente (se houver)
      assignee_nm := NULL;
      IF assignee_id IS NOT NULL THEN
        SELECT full_name INTO assignee_nm
        FROM users
        WHERE id = assignee_id
        LIMIT 1;
      END IF;

      -- Desativar bot e transferir conversa
      UPDATE whatsapp_conversations
      SET
        bot_active         = false,
        status             = 'waiting',
        assigned_user_id   = assignee_id,
        assigned_user_name = assignee_nm
      WHERE id = conv_rec.id;

      -- Registrar evento de transferência
      INSERT INTO whatsapp_conversation_events (
        institution_id, remote_jid, event_type, description
      ) VALUES (
        flow_rec.institution_id,
        conv_rec.remote_jid,
        'transfer',
        'Transferido automaticamente por inatividade do bot'
      );

      -- Enfileirar mensagem para envio via Edge Function
      -- ON CONFLICT: re-enfileirar apenas se já foi enviada antes
      INSERT INTO bot_timeout_queue (
        institution_id, remote_jid, message
      ) VALUES (
        flow_rec.institution_id,
        conv_rec.remote_jid,
        flow_rec.bot_timeout_message
      )
      ON CONFLICT (institution_id, remote_jid) DO UPDATE
        SET message    = EXCLUDED.message,
            sent       = false,
            created_at = NOW()
        WHERE bot_timeout_queue.sent = true;

    END LOOP;
  END LOOP;
END;
$$;
