-- =============================================================================
-- 20260701000000_whatsapp_permissions.sql
-- Visibilidade granular de conversas/mensagens do WhatsApp por atendente,
-- com liberação por admin e preservação de histórico após transferência.
--
-- NOTA DE COMPATIBILIDADE:
-- A tabela `users` já possui `role TEXT NOT NULL CHECK (role IN ('admin',
-- 'manager', 'user'))` (20250916190118_icy_shrine.sql) em uso ativo no
-- roteamento do frontend (App.tsx: RequireRole/ProtectedRoute/isAttendant) e
-- um conceito de super admin via `user_type = 'admin_geral'` + tabela
-- `super_admins` (20260321000000_super_admin_personas.sql,
-- 20250923124346_quiet_king.sql). Em vez de introduzir um enum de role
-- conflitante ('super_admin','admin','attendant'), esta migration reaproveita
-- o modelo existente: 'admin'/'manager' e user_type='admin_geral'/super_admins
-- enxergam tudo; role='user' é o atendente padrão. Nenhuma constraint de
-- `role` é alterada aqui.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Coluna can_see_all_conversations em users
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS can_see_all_conversations BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tabela whatsapp_message_visibility
-- Guarda, por mensagem, quais usuários (além do atendente atual) mantêm
-- acesso ao histórico — usada para preservar o acesso do atendente anterior
-- após uma transferência de conversa.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_message_visibility (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id     UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  message_id         UUID        NOT NULL REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
  visible_to_user_id UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, visible_to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_wmv_message_id         ON whatsapp_message_visibility(message_id);
CREATE INDEX IF NOT EXISTS idx_wmv_visible_to_user_id ON whatsapp_message_visibility(visible_to_user_id);
CREATE INDEX IF NOT EXISTS idx_wmv_institution_id     ON whatsapp_message_visibility(institution_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Helper: normaliza remote_jid para comparação
-- Os dados existentes misturam formato "cru" ("5583...") e JID completo
-- ("5583...@s.whatsapp.net"/"@g.us") tanto em whatsapp_conversations quanto
-- em whatsapp_messages. As políticas de RLS abaixo precisam comparar as duas
-- tabelas por essa chave, então normalizamos antes de comparar.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION whatsapp_base_jid(p_jid TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(p_jid, '@(s\.whatsapp\.net|g\.us)$', '');
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Helper: current_user_institution_id()
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION current_user_institution_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT institution_id FROM users WHERE id = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Helper: user_can_see_all_conversations()
-- TRUE para admin/manager da escola, para admin_geral/super_admin da
-- plataforma, ou para atendente explicitamente liberado pelo admin.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION user_can_see_all_conversations()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_role         TEXT;
  v_user_type    TEXT;
  v_can_see_all  BOOLEAN;
BEGIN
  SELECT role, user_type, can_see_all_conversations
    INTO v_role, v_user_type, v_can_see_all
  FROM users
  WHERE id = auth.uid();

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  RETURN v_role IN ('admin', 'manager')
    OR v_user_type = 'admin_geral'
    OR COALESCE(v_can_see_all, false)
    OR is_super_admin(get_current_user_email());
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS em whatsapp_conversations
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Institution members can manage their conversations" ON whatsapp_conversations;
DROP POLICY IF EXISTS "whatsapp_conversations_select" ON whatsapp_conversations;
DROP POLICY IF EXISTS "whatsapp_conversations_insert" ON whatsapp_conversations;
DROP POLICY IF EXISTS "whatsapp_conversations_update" ON whatsapp_conversations;

CREATE POLICY "whatsapp_conversations_select" ON whatsapp_conversations
  FOR SELECT
  USING (
    institution_id = current_user_institution_id()
    AND (
      user_can_see_all_conversations()
      OR assigned_user_id = auth.uid()
      OR assigned_user_id IS NULL
    )
  );

CREATE POLICY "whatsapp_conversations_insert" ON whatsapp_conversations
  FOR INSERT
  WITH CHECK (institution_id = current_user_institution_id());

CREATE POLICY "whatsapp_conversations_update" ON whatsapp_conversations
  FOR UPDATE
  USING (
    institution_id = current_user_institution_id()
    AND (
      user_can_see_all_conversations()
      OR assigned_user_id = auth.uid()
      OR assigned_user_id IS NULL
    )
  )
  WITH CHECK (institution_id = current_user_institution_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS em whatsapp_messages
-- DELETE é adicionado além do pedido original (não estava no escopo da
-- tarefa) porque o botão "apagar mensagens" do WhatsAppHub
-- (supabase.from('whatsapp_messages').delete()) já existe em produção e
-- ficaria bloqueado sem uma política explícita assim que o RLS passa a valer
-- por SELECT/INSERT em vez do FOR ALL genérico anterior.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Institution can manage own messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "whatsapp_messages_select" ON whatsapp_messages;
DROP POLICY IF EXISTS "whatsapp_messages_insert" ON whatsapp_messages;
DROP POLICY IF EXISTS "whatsapp_messages_update" ON whatsapp_messages;
DROP POLICY IF EXISTS "whatsapp_messages_delete" ON whatsapp_messages;

CREATE POLICY "whatsapp_messages_select" ON whatsapp_messages
  FOR SELECT
  USING (
    institution_id = current_user_institution_id()
    AND (
      user_can_see_all_conversations()
      OR EXISTS (
        SELECT 1 FROM whatsapp_conversations wc
        WHERE wc.institution_id = whatsapp_messages.institution_id
          AND wc.assigned_user_id = auth.uid()
          AND whatsapp_base_jid(wc.remote_jid) = whatsapp_base_jid(whatsapp_messages.remote_jid)
          -- Sem transferência prévia (transferred_at NULL): o atendente é dono
          -- desde o início e vê tudo. Com transferência: só a partir dela —
          -- caso contrário o novo atendente enxergaria o histórico do
          -- atendente anterior, que é justamente o que whatsapp_message_visibility
          -- existe para preservar.
          AND (wc.transferred_at IS NULL OR whatsapp_messages.timestamp >= wc.transferred_at)
      )
      OR EXISTS (
        SELECT 1 FROM whatsapp_message_visibility wmv
        WHERE wmv.message_id = whatsapp_messages.id
          AND wmv.visible_to_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "whatsapp_messages_insert" ON whatsapp_messages
  FOR INSERT
  WITH CHECK (institution_id = current_user_institution_id());

-- Mantém a capacidade existente de vincular mensagens a um lead
-- (DatabaseService.updateWhatsappMessageLead em src/lib/supabase.ts) e de
-- limpar o histórico de uma conversa visível ao usuário.
CREATE POLICY "whatsapp_messages_update" ON whatsapp_messages
  FOR UPDATE
  USING (institution_id = current_user_institution_id())
  WITH CHECK (institution_id = current_user_institution_id());

CREATE POLICY "whatsapp_messages_delete" ON whatsapp_messages
  FOR DELETE
  USING (
    institution_id = current_user_institution_id()
    AND (
      user_can_see_all_conversations()
      OR EXISTS (
        SELECT 1 FROM whatsapp_conversations wc
        WHERE wc.institution_id = whatsapp_messages.institution_id
          AND wc.assigned_user_id = auth.uid()
          AND whatsapp_base_jid(wc.remote_jid) = whatsapp_base_jid(whatsapp_messages.remote_jid)
          AND (wc.transferred_at IS NULL OR whatsapp_messages.timestamp >= wc.transferred_at)
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RLS em whatsapp_message_visibility
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_message_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_message_visibility_select" ON whatsapp_message_visibility;
CREATE POLICY "whatsapp_message_visibility_select" ON whatsapp_message_visibility
  FOR SELECT
  USING (
    institution_id = current_user_institution_id()
    AND (
      user_can_see_all_conversations()
      OR visible_to_user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Trigger: snapshot de visibilidade ao transferir conversa
-- Antes de trocar o assigned_user_id, registra em whatsapp_message_visibility
-- que o atendente anterior mantém acesso a todas as mensagens já trocadas
-- naquele remote_jid até o momento da transferência.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION snapshot_visibility_on_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_jid TEXT;
BEGIN
  IF NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id
     AND OLD.assigned_user_id IS NOT NULL THEN
    v_base_jid := whatsapp_base_jid(OLD.remote_jid);

    INSERT INTO whatsapp_message_visibility (institution_id, message_id, visible_to_user_id)
    SELECT wm.institution_id, wm.id, OLD.assigned_user_id
    FROM whatsapp_messages wm
    WHERE wm.institution_id = OLD.institution_id
      AND whatsapp_base_jid(wm.remote_jid) = v_base_jid
    ON CONFLICT (message_id, visible_to_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_visibility_on_transfer ON whatsapp_conversations;
CREATE TRIGGER trg_snapshot_visibility_on_transfer
  BEFORE UPDATE OF assigned_user_id ON whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION snapshot_visibility_on_transfer();

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. GRANTs
-- ─────────────────────────────────────────────────────────────────────────────
GRANT SELECT ON whatsapp_message_visibility TO authenticated;
GRANT EXECUTE ON FUNCTION whatsapp_base_jid(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_institution_id() TO authenticated;
GRANT EXECUTE ON FUNCTION user_can_see_all_conversations() TO authenticated;
