-- =============================================================================
-- 20260822000400_whatsapp_scheduled_messages.sql
-- Agendamento de mensagem (template) dentro de uma conversa específica do
-- WhatsApp Hub das escolas. Mesmo padrão de tabela-fila + claim atômico já
-- usado em aion_scheduled_messages (20260802000200_aion_scheduled_messages.sql)
-- — reaproveitado aqui quase à risca, só adaptado pro contexto de escola
-- (institution_id obrigatório, reabertura de conversa fechada, notificação de
-- falha pro atendente que agendou).
-- =============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_scheduled_messages (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id      UUID        NOT NULL REFERENCES institutions(id),
  conversation_id     UUID        NOT NULL REFERENCES whatsapp_conversations(id),
  remote_jid          TEXT        NOT NULL,
  template_name       TEXT        NOT NULL,
  template_variables  JSONB       DEFAULT '{}',
  scheduled_for       TIMESTAMPTZ NOT NULL,
  created_by          UUID        REFERENCES users(id),
  status              TEXT        DEFAULT 'pending' CHECK (status IN ('pending','sent','cancelled','failed')),
  sent_at             TIMESTAMPTZ,
  error_message       TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Achar rápido o que está pendente e na hora (usado pelo claim da Edge
-- Function, a cada 2-5 min) — índice parcial, só cobre linhas pending.
CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_messages_pending
  ON whatsapp_scheduled_messages(status, scheduled_for) WHERE status = 'pending';

-- Listar as mensagens agendadas de UMA conversa específica (painel lateral do
-- WhatsAppHub.tsx) — consulta por institution_id + remote_jid + status,
-- padrão de acesso separado do índice acima.
CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_messages_conversation
  ON whatsapp_scheduled_messages(institution_id, remote_jid, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: leitura/escrita restrita por institution_id — mesmo padrão já usado em
-- outras tabelas whatsapp_* (whatsapp_contacts, contact_notes etc., ver
-- pg_policies ao vivo confirmado nesta sessão: USING/WITH CHECK
-- institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid())).
-- De propósito SEM policy de DELETE — "não deletar, manter histórico" vira
-- também uma garantia de banco, não só uma convenção da tela (cancelamento é
-- sempre UPDATE status='cancelled'; só a service role, que bypassa RLS, pode
-- excluir de fato, e nada no app faz isso).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_scheduled_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wsm_select_inst" ON whatsapp_scheduled_messages;
CREATE POLICY "wsm_select_inst" ON whatsapp_scheduled_messages
  FOR SELECT
  USING (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "wsm_insert_inst" ON whatsapp_scheduled_messages;
CREATE POLICY "wsm_insert_inst" ON whatsapp_scheduled_messages
  FOR INSERT
  WITH CHECK (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "wsm_update_inst" ON whatsapp_scheduled_messages;
CREATE POLICY "wsm_update_inst" ON whatsapp_scheduled_messages
  FOR UPDATE
  USING (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()))
  WITH CHECK (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Reivindica um lote de mensagens prontas pra enviar, de forma atômica —
-- cópia quase literal de claim_aion_scheduled_messages() (mesmo idioma
-- UPDATE...WHERE id IN (SELECT...FOR UPDATE SKIP LOCKED), mesma justificativa:
-- se o cron dispara a Edge Function duas vezes em paralelo, a segunda pula as
-- linhas já travadas pela primeira em vez de reenviar a mesma mensagem).
--
-- Marca status='sent' já na reivindicação (otimista, mesmo trade-off já
-- aceito em aion_scheduled_messages) — se o envio de fato falhar ou a
-- conversa precisar reabrir antes, a Edge Function ajusta status/campos logo
-- em seguida (ver supabase/functions/whatsapp-scheduled-send/index.ts).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION claim_whatsapp_scheduled_messages(p_limit INT DEFAULT 50)
RETURNS SETOF whatsapp_scheduled_messages
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE whatsapp_scheduled_messages
  SET status = 'sent', sent_at = now()
  WHERE id IN (
    SELECT id FROM whatsapp_scheduled_messages
    WHERE status = 'pending' AND scheduled_for <= now()
    ORDER BY scheduled_for
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Cron — a cada 3 minutos (mesmo intervalo de bot-timeout-send/
-- process-bot-timeouts, dentro da faixa de 2-5 min pedida). Mesmo padrão de
-- segurança de token de 20260821000000_fix_cron_token_exposure.sql: Service
-- Role Key buscada em runtime via platform_settings, nunca em texto puro no
-- comando armazenado em cron.job.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  PERFORM cron.unschedule('whatsapp-scheduled-send');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'whatsapp-scheduled-send',
  '*/3 * * * *',
  $$SELECT net.http_post(
    url     := 'https://syxxuumxkhhnoqrxporj.supabase.co/functions/v1/whatsapp-scheduled-send',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM platform_settings WHERE key = 'service_role_key')
    ),
    body    := '{}'::jsonb
  )$$
);
