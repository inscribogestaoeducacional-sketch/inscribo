-- =============================================================================
-- 20260701000004_quick_replies.sql
-- Respostas rápidas pessoais + globais.
--
-- IMPORTANTE: whatsapp_quick_replies já existe (criada em
-- 20260513000000_whatsapp_complete.sql) com colunas
-- (id, institution_id, title, message, order_index, created_at) e é usada
-- hoje pelo CRUD de admin em SystemSettings.tsx e pelo painel de respostas
-- rápidas em WhatsAppHub.tsx. Em vez de criar uma tabela nova conflitante
-- (o que a tarefa original pedia), esta migration faz ALTER para adicionar
-- o que falta: user_id (NULL = global, preenchido = pessoal do atendente)
-- e shortcut (gatilho "/algo" para o autocomplete). "title"/"message" são
-- mantidos como estão — não há necessidade de renomear para "content", e
-- renomear quebraria o CRUD de admin já existente sem nenhum ganho.
-- "scope" não é uma coluna separada: é derivado de user_id IS NULL.
-- =============================================================================

ALTER TABLE whatsapp_quick_replies
  ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS shortcut   TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_whatsapp_quick_replies_user ON whatsapp_quick_replies(user_id);

-- Único por (instituição, dono, atalho) — só entre linhas que têm atalho
-- definido; respostas sem atalho (fluxo antigo, só clique manual) não
-- precisam ser únicas entre si.
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_quick_replies_shortcut_unique
  ON whatsapp_quick_replies(institution_id, user_id, shortcut)
  WHERE shortcut IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: substitui a policy única "institution_isolation" (FOR ALL) por
-- policies por operação, respeitando pessoal x global.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "institution_isolation" ON whatsapp_quick_replies;
DROP POLICY IF EXISTS "quick_replies_select" ON whatsapp_quick_replies;
DROP POLICY IF EXISTS "quick_replies_insert" ON whatsapp_quick_replies;
DROP POLICY IF EXISTS "quick_replies_update" ON whatsapp_quick_replies;
DROP POLICY IF EXISTS "quick_replies_delete" ON whatsapp_quick_replies;

CREATE POLICY "quick_replies_select" ON whatsapp_quick_replies
  FOR SELECT
  USING (
    institution_id = current_user_institution_id()
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY "quick_replies_insert" ON whatsapp_quick_replies
  FOR INSERT
  WITH CHECK (
    institution_id = current_user_institution_id()
    AND (
      user_id = auth.uid()
      OR (user_id IS NULL AND user_can_see_all_conversations())
    )
  );

CREATE POLICY "quick_replies_update" ON whatsapp_quick_replies
  FOR UPDATE
  USING (
    institution_id = current_user_institution_id()
    AND (user_id = auth.uid() OR user_can_see_all_conversations())
  )
  WITH CHECK (institution_id = current_user_institution_id());

CREATE POLICY "quick_replies_delete" ON whatsapp_quick_replies
  FOR DELETE
  USING (
    institution_id = current_user_institution_id()
    AND (user_id = auth.uid() OR user_can_see_all_conversations())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_quick_replies TO authenticated;
