-- =============================================================================
-- 20260822000000_contacts_module_improvements.sql
-- Suporte de schema para as 4 melhorias do módulo de Contatos:
--   1. Mesclar duplicata pela UI
--   2. Campos customizáveis (obrigatório ainda não existia)
--   3. Ações em massa (sem schema novo, só código)
--   4. Histórico de alteração de campo
-- =============================================================================

-- ── 1a. contact_custom_fields ganha "obrigatório" — não existia no schema
-- original (contacts.sql), a tela de administração pedida no item 2 precisa
-- disso. DEFAULT false pra não quebrar campos já criados via ContactCard.tsx.
ALTER TABLE contact_custom_fields
  ADD COLUMN IF NOT EXISTS required BOOLEAN NOT NULL DEFAULT false;

-- ── 1b. whatsapp_contacts_merge_log: RLS estava DESABILITADA (relrowsecurity
-- = false, confirmado via pg_class) — a tabela só era escrita por migrations
-- rodando com service role, então isso nunca foi explorável até agora. A
-- tela de merge manual (item 1) escreve nela direto do client (chave anon +
-- sessão do usuário), então RLS vira obrigatória a partir daqui — sem isso
-- qualquer usuário autenticado enxergaria/escreveria o log de merge de
-- QUALQUER instituição.
-- merged_by não existia (o log só era escrito por migrations com service
-- role, sem usuário associado) — a tela de merge manual é a primeira escrita
-- disparada por uma pessoa de verdade, então passa a registrar quem.
ALTER TABLE whatsapp_contacts_merge_log
  ADD COLUMN IF NOT EXISTS merged_by UUID REFERENCES users(id);

ALTER TABLE whatsapp_contacts_merge_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merge_log_inst" ON whatsapp_contacts_merge_log;
CREATE POLICY "merge_log_inst" ON whatsapp_contacts_merge_log
  USING (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()))
  WITH CHECK (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()));

-- ── 1c. Exceções de merge — grupos que o admin marcou como "não é duplicata
-- de verdade" (item 1.5), pra não reaparecer na lista. Chave é
-- (institution_id, norm_phone), igual ao agrupamento usado na detecção.
CREATE TABLE IF NOT EXISTS whatsapp_contacts_duplicate_ignore (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  norm_phone     TEXT        NOT NULL,
  ignored_by     UUID        REFERENCES users(id),
  ignored_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id, norm_phone)
);

ALTER TABLE whatsapp_contacts_duplicate_ignore ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dup_ignore_inst" ON whatsapp_contacts_duplicate_ignore;
CREATE POLICY "dup_ignore_inst" ON whatsapp_contacts_duplicate_ignore
  USING (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()))
  WITH CHECK (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()));

-- ── 4. Histórico de alteração de campo — nome/telefone/tipo/tags e valores
-- de campo customizado, editados a partir de ContactProfile.tsx. contact_id
-- é FK real (não contact_ref_id texto livre como contact_notes/
-- contact_field_values) porque este log é escrito exclusivamente a partir de
-- ContactProfile.tsx, onde sempre existe um whatsapp_contacts.id concreto —
-- diferente de ContactCard.tsx (outro consumidor de campos customizados, no
-- drawer do WhatsApp), que às vezes só tem lead_id/remote_jid.
CREATE TABLE IF NOT EXISTS contact_field_change_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  contact_id     UUID        NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  field_name     TEXT        NOT NULL,
  old_value      TEXT,
  new_value      TEXT,
  changed_by     UUID        REFERENCES users(id),
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_field_change_log_contact
  ON contact_field_change_log(contact_id, changed_at DESC);

ALTER TABLE contact_field_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "field_change_log_inst" ON contact_field_change_log;
CREATE POLICY "field_change_log_inst" ON contact_field_change_log
  USING (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()))
  WITH CHECK (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()));
