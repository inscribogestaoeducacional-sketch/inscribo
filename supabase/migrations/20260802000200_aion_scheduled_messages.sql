-- =============================================================================
-- 20260802000200_aion_scheduled_messages.sql
-- Mensagens agendadas do Inbox Áion — mesmo padrão de tabela-fila +
-- pg_cron/pg_net já usado em bot_timeout_queue (20260528000000_bot_timeout.sql)
-- e overdue_reminders_sent (20260720000900_overdue_reminders_sent.sql).
-- =============================================================================

CREATE TABLE IF NOT EXISTS aion_scheduled_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  remote_jid      TEXT        NOT NULL,
  message_type    TEXT        NOT NULL DEFAULT 'text', -- 'text' ou referência a quick_reply
  content         TEXT        NOT NULL,
  send_at         TIMESTAMPTZ NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
  created_by      UUID        REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_aion_scheduled_messages_pending
  ON aion_scheduled_messages(send_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_aion_scheduled_messages_conversation
  ON aion_scheduled_messages(conversation_id) WHERE status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: admin_geral apenas — mesmo padrão (is_super_admin_user()) já usado
-- nesta sessão para crm_leads/crm_meetings/whatsapp_quick_replies (Inbox Áion).
-- Tabela nova, sem policy legada pra preservar, então uma única FOR ALL basta.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE aion_scheduled_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aion_scheduled_messages_admin_geral" ON aion_scheduled_messages;
CREATE POLICY "aion_scheduled_messages_admin_geral" ON aion_scheduled_messages
  FOR ALL
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());

-- ─────────────────────────────────────────────────────────────────────────────
-- Reivindica um lote de mensagens prontas pra enviar de forma atômica.
-- UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) é o idioma padrão
-- do Postgres pra fila de jobs: se o cron disparar a Edge Function duas vezes
-- em paralelo (execução anterior ainda rodando), a segunda chamada pula as
-- linhas já travadas pela primeira em vez de reenviar a mesma mensagem.
--
-- Marca status='sent' já na reivindicação (otimista) — a tabela só tem os 4
-- status pedidos (pending/sent/failed/cancelled), sem um "processing"
-- intermediário; se o envio de fato falhar, a Edge Function volta o status
-- pra 'failed' logo em seguida (ver aion-scheduled-send/index.ts).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION claim_aion_scheduled_messages(p_limit INT DEFAULT 50)
RETURNS SETOF aion_scheduled_messages
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE aion_scheduled_messages
  SET status = 'sent', sent_at = now()
  WHERE id IN (
    SELECT id FROM aion_scheduled_messages
    WHERE status = 'pending' AND send_at <= now()
    ORDER BY send_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;
