-- =============================================================================
-- 20260806000100_aion_broadcasts.sql
-- Módulo "Lista de Transmissão" do Inbox Áion — campanha de disparo em massa
-- (aion_broadcasts) + status de envio por destinatário (aion_broadcast_recipients),
-- processados em fila pela Edge Function aion-broadcast-send. Mesmo idioma de
-- fila já validado em produção por aion_scheduled_messages (20260802000200):
-- reivindicação atômica via UPDATE ... FOR UPDATE SKIP LOCKED, pra tolerar o
-- cron disparando em paralelo sem enviar a mesma mensagem duas vezes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aion_broadcasts (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT        NOT NULL,
  template_name        TEXT        NOT NULL,
  template_language    TEXT        NOT NULL DEFAULT 'pt_BR',
  -- Snapshot só pra auditoria/exibição da campanha — desde a personalização
  -- por contato (ver aion_broadcast_recipients.template_components abaixo),
  -- NÃO é mais o que é de fato enviado pra Meta; a variável {{1}} (nome do
  -- contato) fica sem valor aqui de propósito, é resolvida por destinatário.
  template_components  JSONB       NOT NULL DEFAULT '[]',
  -- Corpo cru do template, com os placeholders {{n}} ainda não substituídos
  -- (texto do component BODY como a Graph API devolve) — a Edge Function usa
  -- isso + aion_broadcast_recipients.template_components (já resolvido por
  -- destinatário) pra reconstruir o preview individual de cada mensagem em
  -- whatsapp_messages.content, sem precisar rebuscar a definição do template.
  template_body_text   TEXT        NOT NULL DEFAULT '',
  -- Preview de exemplo (calculado no client com o 1º contato da audiência no
  -- momento da criação) — só fallback caso template_body_text esteja vazio.
  preview_text         TEXT        NOT NULL DEFAULT '',
  -- URL pública (bucket whatsapp-media) da mídia de header, quando o template
  -- tiver HEADER format IMAGE/VIDEO/DOCUMENT — mesma URL pra todos os
  -- destinatários da campanha (upload único na criação, não por destinatário).
  header_media_url     TEXT,
  filter_tags          JSONB       NOT NULL DEFAULT '[]',
  status               TEXT        NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'cancelled')),
  scheduled_at         TIMESTAMPTZ,
  total_recipients     INT         NOT NULL DEFAULT 0,
  sent_count           INT         NOT NULL DEFAULT 0,
  failed_count         INT         NOT NULL DEFAULT 0,
  created_by           UUID        REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at           TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_aion_broadcasts_status ON aion_broadcasts(status) WHERE status IN ('scheduled', 'sending');

ALTER TABLE aion_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aion_broadcasts_admin_geral" ON aion_broadcasts;
CREATE POLICY "aion_broadcasts_admin_geral" ON aion_broadcasts
  FOR ALL
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());


CREATE TABLE IF NOT EXISTS aion_broadcast_recipients (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id  UUID        NOT NULL REFERENCES aion_broadcasts(id) ON DELETE CASCADE,
  contact_id    UUID        REFERENCES aion_contacts(id) ON DELETE SET NULL,
  remote_jid    TEXT        NOT NULL,
  -- Components já resolvidos PARA ESTE destinatário — {{1}} = aion_contacts.name
  -- (fallback "Cliente") preenchido automaticamente na criação da campanha,
  -- demais posições ({{2}}, {{3}}...) usam o valor fixo definido na campanha.
  -- É isso que a Edge Function manda pra Graph API (não mais
  -- aion_broadcasts.template_components).
  template_components JSONB    NOT NULL DEFAULT '[]',
  status        TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  wamid         TEXT,
  error_message TEXT,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aion_broadcast_recipients_pending
  ON aion_broadcast_recipients(broadcast_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_aion_broadcast_recipients_broadcast
  ON aion_broadcast_recipients(broadcast_id, created_at);

ALTER TABLE aion_broadcast_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aion_broadcast_recipients_admin_geral" ON aion_broadcast_recipients;
CREATE POLICY "aion_broadcast_recipients_admin_geral" ON aion_broadcast_recipients
  FOR ALL
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());

-- ─────────────────────────────────────────────────────────────────────────────
-- Reivindica um lote de destinatários pendentes de forma atômica — mesmo
-- desenho de claim_aion_scheduled_messages() (20260802000200): marca 'sent'
-- já na reivindicação (otimista); a Edge Function desfaz pra 'failed' se o
-- envio de fato não for bem-sucedido.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION claim_aion_broadcast_recipients(p_broadcast_id UUID, p_limit INT DEFAULT 50)
RETURNS SETOF aion_broadcast_recipients
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE aion_broadcast_recipients
  SET status = 'sent'
  WHERE id IN (
    SELECT id FROM aion_broadcast_recipients
    WHERE broadcast_id = p_broadcast_id AND status = 'pending'
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Incrementa sent_count/failed_count de forma atômica — evita race condition
-- se dois ciclos do cron (aion-broadcast-send) chegarem a rodar em paralelo
-- pra broadcasts diferentes ou (por atraso) pro mesmo broadcast.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_aion_broadcast_counts(p_broadcast_id UUID, p_sent_delta INT, p_failed_delta INT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE aion_broadcasts
  SET sent_count   = sent_count + p_sent_delta,
      failed_count = failed_count + p_failed_delta
  WHERE id = p_broadcast_id;
END;
$$;
