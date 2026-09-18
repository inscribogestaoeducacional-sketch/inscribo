-- =============================================================================
-- 20260918000000_internal_messages.sql
-- Chat Interno — conversa 1 a 1 entre membros da MESMA escola (atendentes +
-- gestor). Sem grupos, sem conversa entre escolas diferentes.
--
-- RLS: SELECT liberado quando o usuário é remetente OU destinatário — o par
-- sender/recipient é sempre validado (no INSERT) como sendo da MESMA
-- institution_id, então não há como uma linha vazar pra outra escola por
-- essa policy. UPDATE só o destinatário, e só pode alterar read_at (todas
-- as outras colunas são travadas por trigger — RLS não sabe restringir por
-- coluna, só por linha, mesmo motivo documentado em
-- 20260701000014_fix_users_rls.sql pro caso análogo de `users`).
-- =============================================================================

CREATE TABLE IF NOT EXISTS internal_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  recipient_id    UUID        NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  content         TEXT        NOT NULL,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Listagem rápida por escola/par de usuários, em ordem cronológica.
CREATE INDEX IF NOT EXISTS idx_internal_messages_listing
  ON internal_messages(institution_id, sender_id, recipient_id, created_at);

-- Contagem de não lidas por destinatário (badge do menu + lista de
-- conversas) — índice parcial, só cobre as linhas ainda não lidas.
CREATE INDEX IF NOT EXISTS idx_internal_messages_unread
  ON internal_messages(recipient_id) WHERE read_at IS NULL;

ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;

-- ── SELECT — só quem participa da conversa ──────────────────────────────────
DROP POLICY IF EXISTS "internal_messages_select_participant" ON internal_messages;
CREATE POLICY "internal_messages_select_participant" ON internal_messages
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- ── INSERT — só em nome de si mesmo, e só entre duas pessoas da MESMA
-- escola (institution_id da linha precisa bater com a institution_id real
-- de sender_id e de recipient_id em `users` — impede spoofing de
-- institution_id ou remetente/destinatário de escola diferente). ──
DROP POLICY IF EXISTS "internal_messages_insert_own" ON internal_messages;
CREATE POLICY "internal_messages_insert_own" ON internal_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_id <> recipient_id
    AND EXISTS (SELECT 1 FROM users u WHERE u.id = sender_id    AND u.institution_id = internal_messages.institution_id)
    AND EXISTS (SELECT 1 FROM users u WHERE u.id = recipient_id AND u.institution_id = internal_messages.institution_id)
  );

-- ── UPDATE — só o destinatário, e só pra marcar como lida ───────────────────
DROP POLICY IF EXISTS "internal_messages_update_recipient" ON internal_messages;
CREATE POLICY "internal_messages_update_recipient" ON internal_messages
  FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- RLS não restringe por coluna — sem este trigger, o destinatário (via
-- policy de UPDATE acima) poderia reescrever `content` de uma mensagem que
-- recebeu. Mesmo padrão de prevent_self_privilege_escalation() em `users`
-- (20260701000014_fix_users_rls.sql): força tudo de volta ao valor antigo,
-- exceto a coluna que realmente pode mudar.
CREATE OR REPLACE FUNCTION internal_messages_restrict_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.institution_id := OLD.institution_id;
  NEW.sender_id       := OLD.sender_id;
  NEW.recipient_id     := OLD.recipient_id;
  NEW.content          := OLD.content;
  NEW.created_at        := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_internal_messages_restrict_update ON internal_messages;
CREATE TRIGGER trg_internal_messages_restrict_update
  BEFORE UPDATE ON internal_messages
  FOR EACH ROW
  EXECUTE FUNCTION internal_messages_restrict_update();

-- De propósito SEM policy de DELETE — ninguém apaga mensagem, nem o próprio
-- remetente (mesma convenção "não deletar, manter histórico" de
-- whatsapp_scheduled_messages, 20260822000400_whatsapp_scheduled_messages.sql).

-- ── Realtime — garante a tabela na publicação mesmo que o projeto não tenha
-- "ADD TABLE FOR ALL" habilitado; idempotente/tolerante se ela já estiver
-- coberta (mesmo padrão defensivo de bot_timeout_cron.sql pra objetos que
-- podem já existir). ──
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE internal_messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
