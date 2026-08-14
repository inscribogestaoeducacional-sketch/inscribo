-- =============================================================================
-- 20260812001200_whatsapp_flows_quick_replies_pseudo_owner.sql
--
-- ACHADO da investigação (confirmado direto em produção via pg_constraint,
-- não pelos CREATE TABLE rastreados nas migrations antigas): tanto
-- whatsapp_flows quanto whatsapp_quick_replies têm
--   institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE
--   + UNIQUE(institution_id) em whatsapp_flows
-- Isso torna FISICAMENTE IMPOSSÍVEL o "truque de pseudo-institution_id" que
-- o Inbox Áion (AdminAionInbox.tsx / FlowEditor.tsx) já tentava usar,
-- gravando platform_whatsapp.id na coluna institution_id: a FK rejeita
-- qualquer id que não seja uma institution de verdade. Confirmado também por
-- query direta: 0 linhas em produção com institution_id = platform_whatsapp.id
-- em nenhuma das duas tabelas — ou seja, o "Fluxo do Bot" e as respostas
-- rápidas do Inbox Áion nunca salvaram com sucesso (o INSERT sempre falhava
-- com violação de FK e o FlowEditor mostrava alert() de erro pro admin).
--
-- Esta migration corrige as DUAS coisas de uma vez (mesma causa raiz):
--   1. Libera o WhatsApp compartilhado de um school_group configurar seu
--      próprio fluxo de bot / respostas rápidas (novo, pro Grupos Escolares).
--   2. Conserta o Inbox Áion, que tinha exatamente o mesmo problema.
-- Cada linha continua pertencendo a exatamente UM dono: institution_id OU
-- school_group_id OU platform_whatsapp_id.
-- =============================================================================

-- ── whatsapp_flows ───────────────────────────────────────────────────────────
ALTER TABLE whatsapp_flows
  ALTER COLUMN institution_id DROP NOT NULL;

ALTER TABLE whatsapp_flows
  ADD COLUMN IF NOT EXISTS school_group_id      UUID REFERENCES school_groups(id)   ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS platform_whatsapp_id UUID REFERENCES platform_whatsapp(id) ON DELETE CASCADE;

ALTER TABLE whatsapp_flows
  DROP CONSTRAINT IF EXISTS whatsapp_flows_owner_xor;
ALTER TABLE whatsapp_flows
  ADD CONSTRAINT whatsapp_flows_owner_xor
  CHECK (num_nonnulls(institution_id, school_group_id, platform_whatsapp_id) <= 1);

-- UNIQUE(institution_id) já existe (whatsapp_flows_institution_id_key).
ALTER TABLE whatsapp_flows
  DROP CONSTRAINT IF EXISTS whatsapp_flows_school_group_id_key;
ALTER TABLE whatsapp_flows
  ADD CONSTRAINT whatsapp_flows_school_group_id_key UNIQUE (school_group_id);

ALTER TABLE whatsapp_flows
  DROP CONSTRAINT IF EXISTS whatsapp_flows_platform_whatsapp_id_key;
ALTER TABLE whatsapp_flows
  ADD CONSTRAINT whatsapp_flows_platform_whatsapp_id_key UNIQUE (platform_whatsapp_id);

-- Nenhuma policy nova necessária aqui: whatsapp_flows_safe já libera
-- is_super_admin_user() incondicionalmente (não depende do valor de
-- institution_id), então já cobre linhas de grupo/plataforma.

-- ── whatsapp_quick_replies ───────────────────────────────────────────────────
ALTER TABLE whatsapp_quick_replies
  ALTER COLUMN institution_id DROP NOT NULL;

ALTER TABLE whatsapp_quick_replies
  ADD COLUMN IF NOT EXISTS school_group_id      UUID REFERENCES school_groups(id)   ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS platform_whatsapp_id UUID REFERENCES platform_whatsapp(id) ON DELETE CASCADE;

ALTER TABLE whatsapp_quick_replies
  DROP CONSTRAINT IF EXISTS whatsapp_quick_replies_owner_xor;
ALTER TABLE whatsapp_quick_replies
  ADD CONSTRAINT whatsapp_quick_replies_owner_xor
  CHECK (num_nonnulls(institution_id, school_group_id, platform_whatsapp_id) = 1);

-- As policies antigas quick_replies_aion_* checavam
-- institution_id IN (SELECT id FROM platform_whatsapp) — depois desta
-- migration o Inbox Áion passa a gravar em platform_whatsapp_id, não mais em
-- institution_id, então essas policies nunca mais bateriam em nada.
-- Substituídas por versões equivalentes sobre as duas colunas novas.
DROP POLICY IF EXISTS "quick_replies_aion_select" ON whatsapp_quick_replies;
DROP POLICY IF EXISTS "quick_replies_aion_insert" ON whatsapp_quick_replies;
DROP POLICY IF EXISTS "quick_replies_aion_update" ON whatsapp_quick_replies;
DROP POLICY IF EXISTS "quick_replies_aion_delete" ON whatsapp_quick_replies;

DROP POLICY IF EXISTS "quick_replies_pseudo_owner_select" ON whatsapp_quick_replies;
CREATE POLICY "quick_replies_pseudo_owner_select" ON whatsapp_quick_replies
  FOR SELECT
  USING (is_super_admin_user() AND (school_group_id IS NOT NULL OR platform_whatsapp_id IS NOT NULL));

DROP POLICY IF EXISTS "quick_replies_pseudo_owner_insert" ON whatsapp_quick_replies;
CREATE POLICY "quick_replies_pseudo_owner_insert" ON whatsapp_quick_replies
  FOR INSERT
  WITH CHECK (is_super_admin_user() AND (school_group_id IS NOT NULL OR platform_whatsapp_id IS NOT NULL));

DROP POLICY IF EXISTS "quick_replies_pseudo_owner_update" ON whatsapp_quick_replies;
CREATE POLICY "quick_replies_pseudo_owner_update" ON whatsapp_quick_replies
  FOR UPDATE
  USING (is_super_admin_user() AND (school_group_id IS NOT NULL OR platform_whatsapp_id IS NOT NULL))
  WITH CHECK (is_super_admin_user() AND (school_group_id IS NOT NULL OR platform_whatsapp_id IS NOT NULL));

DROP POLICY IF EXISTS "quick_replies_pseudo_owner_delete" ON whatsapp_quick_replies;
CREATE POLICY "quick_replies_pseudo_owner_delete" ON whatsapp_quick_replies
  FOR DELETE
  USING (is_super_admin_user() AND (school_group_id IS NOT NULL OR platform_whatsapp_id IS NOT NULL));
