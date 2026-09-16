-- =============================================================================
-- 20260916030000_template_definitions.sql
-- "Templates Automáticos" (Super Admin) — cadastrar um template de WhatsApp
-- uma única vez e submeter pra aprovação em todas as escolas de uma vez via
-- API da Meta, em vez de criar manualmente em cada WABA pela tela do
-- WhatsApp Manager (o que já existe hoje, um de cada vez, em
-- AdminSchools.tsx/InstitutionDetails.tsx → aba "Templates").
--
-- RLS: usa is_super_admin_user() (20260720000000_document_is_super_admin_user_
-- function.sql) — já ATIVA em produção e usada em todas as tabelas
-- "super admin only" recentes (ver 20260910010000_campaign_change_requests.sql).
-- NÃO usar `user_type = 'super_admin'` como fez whatsapp_platform_templates
-- (20260521000003_whatsapp_templates_usage.sql) — esse valor nunca existe na
-- coluna `users.user_type` neste projeto (o valor real é 'admin_geral', ver
-- AuthContext.tsx/App.tsx), então aquela policy nunca autoriza ninguém de
-- verdade. is_super_admin_user() também libera 'consultant', mesmo critério
-- usado por toda tabela análoga do projeto.
-- =============================================================================

CREATE TABLE IF NOT EXISTS template_definitions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL UNIQUE, -- nome técnico, usado na Meta (lowercase + underscore)
  category          TEXT        NOT NULL CHECK (category IN ('UTILITY', 'MARKETING')),
  language          TEXT        NOT NULL DEFAULT 'pt_BR',
  body_text         TEXT        NOT NULL, -- com {{1}}, {{2}} etc
  variable_examples JSONB       DEFAULT '{}', -- { "1": "João", "2": "Colégio Exemplo", "button": "abc123" }
  button_config     JSONB,      -- null, ou { "type": "URL", "text": "Pagar agora", "url_base": "https://..." }
  created_by        UUID        REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS template_institution_status (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_definition_id  UUID        NOT NULL REFERENCES template_definitions(id) ON DELETE CASCADE,
  institution_id          UUID        NOT NULL REFERENCES institutions(id)         ON DELETE CASCADE,
  status                  TEXT        NOT NULL DEFAULT 'not_submitted'
                            CHECK (status IN ('not_submitted', 'pending', 'approved', 'rejected')),
  meta_template_id        TEXT,       -- id retornado pela Meta
  last_synced_at          TIMESTAMPTZ,
  error_message           TEXT,
  UNIQUE (template_definition_id, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_template_institution_status_institution
  ON template_institution_status(institution_id);
CREATE INDEX IF NOT EXISTS idx_template_institution_status_status
  ON template_institution_status(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — só Super Admin (admin_geral / consultant, via is_super_admin_user()).
-- Sem policy nenhuma pra `authenticated` fora disso: escola não deve ler nem
-- a definição do template nem o status de aprovação por essa via — a tela é
-- 100% Super Admin.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE template_definitions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_institution_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_all_template_definitions" ON template_definitions;
CREATE POLICY "super_admin_all_template_definitions"
  ON template_definitions FOR ALL
  USING (is_super_admin_user()) WITH CHECK (is_super_admin_user());

DROP POLICY IF EXISTS "service_role_all_template_definitions" ON template_definitions;
CREATE POLICY "service_role_all_template_definitions"
  ON template_definitions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "super_admin_all_template_institution_status" ON template_institution_status;
CREATE POLICY "super_admin_all_template_institution_status"
  ON template_institution_status FOR ALL
  USING (is_super_admin_user()) WITH CHECK (is_super_admin_user());

DROP POLICY IF EXISTS "service_role_all_template_institution_status" ON template_institution_status;
CREATE POLICY "service_role_all_template_institution_status"
  ON template_institution_status FOR ALL TO service_role
  USING (true) WITH CHECK (true);
