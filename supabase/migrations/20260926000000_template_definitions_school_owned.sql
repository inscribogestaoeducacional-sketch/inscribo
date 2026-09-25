-- =============================================================================
-- 20260926000000_template_definitions_school_owned.sql
-- Transmissões — Fase M1 (Templates). O catálogo template_definitions deixa de
-- ser só "template padrão da Áion empurrado pras escolas" e passa a aceitar
-- template criado pela própria escola:
--
--   institution_id NULL        → padrão Áion (Super Admin, como sempre foi)
--   institution_id preenchido  → template da escola (dono único)
--
-- Nome técnico (o que a Meta vê) de template de escola é SEMPRE gerado aqui
-- no banco: 'esc_' + 6 primeiros hex do institution_id + '_' + slug do nome
-- informado. Motivo: nome só é único DENTRO de um WABA na Meta, e os
-- templates da Áion também são publicados no WABA da escola — sem prefixo, um
-- nome de escola poderia colidir com um template padrão. Template da Áion não
-- pode usar esse prefixo (trigger abaixo). Hoje nenhum dos 10 templates usa.
--
-- Edição de conteúdo (nome, idioma, categoria, corpo, exemplos, cabeçalho,
-- botões) fica travada depois que o template foi enviado pra Meta (existe
-- status pending/approved/paused/disabled em alguma escola) — vale pros dois
-- donos. A tela do Super Admin (AdminWhatsAppTemplates.tsx:handleSaveEdit) só
-- edita display_name/variable_labels/available_contexts/scope, que continuam
-- livres. Rejeitado continua editável (corrigir e reenviar).
--
-- RLS segue o critério da Captação Inteligente (20260925000000):
-- institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()).
-- =============================================================================

-- ── 1. template_definitions: dono, cabeçalho, botões ────────────────────────
ALTER TABLE template_definitions
  ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS header_config  JSONB,
  ADD COLUMN IF NOT EXISTS buttons        JSONB NOT NULL DEFAULT '[]';

-- header_config: { format: TEXT|IMAGE|VIDEO|DOCUMENT, text?, sample_handle? }
-- buttons: [{ type: 'QUICK_REPLY', text }, { type: 'URL', text, url_base }]
-- (limites finos — 10 botões, 2 de URL, 25 caracteres — validados no código).
-- button_config fica como está (0 linhas usam hoje) até o código migrar.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'template_definitions_header_config_check') THEN
    ALTER TABLE template_definitions ADD CONSTRAINT template_definitions_header_config_check
      CHECK (header_config IS NULL
             OR header_config->>'format' IN ('TEXT','IMAGE','VIDEO','DOCUMENT'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'template_definitions_buttons_check') THEN
    ALTER TABLE template_definitions ADD CONSTRAINT template_definitions_buttons_check
      CHECK (jsonb_typeof(buttons) = 'array' AND jsonb_array_length(buttons) <= 10);
  END IF;
END $$;

-- Nome único por dono em vez de único no sistema todo.
ALTER TABLE template_definitions DROP CONSTRAINT IF EXISTS template_definitions_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_template_definitions_aion_name
  ON template_definitions(name, language) WHERE institution_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_template_definitions_school_name
  ON template_definitions(institution_id, name, language) WHERE institution_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_template_definitions_institution
  ON template_definitions(institution_id) WHERE institution_id IS NOT NULL;

-- ── 2. Trigger: nome gerado + trava de edição pós-envio ────────────────────
CREATE OR REPLACE FUNCTION public.template_definitions_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_slug      TEXT;
  v_submitted BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.institution_id IS NOT NULL THEN
      v_slug := regexp_replace(
                  lower(translate(coalesce(NEW.name, ''),
                    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
                    'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
                  '[^a-z0-9]+', '_', 'g');
      v_slug := trim(both '_' from v_slug);
      -- Se o cliente já mandou com prefixo, não duplica.
      v_slug := regexp_replace(v_slug, '^esc_[0-9a-f]{6}_', '');
      IF v_slug = '' THEN
        RAISE EXCEPTION 'Nome do template inválido — use letras ou números';
      END IF;
      NEW.name       := left('esc_' || left(replace(NEW.institution_id::text, '-', ''), 6) || '_' || v_slug, 512);
      NEW.scope      := 'specific';
      NEW.created_by := coalesce(NEW.created_by, auth.uid());
    ELSIF NEW.name ~ '^esc_[0-9a-f]{6}_' THEN
      RAISE EXCEPTION 'Prefixo esc_ é reservado a templates de escola';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.institution_id IS DISTINCT FROM OLD.institution_id THEN
    RAISE EXCEPTION 'Não é permitido trocar o dono de um template';
  END IF;
  IF NEW.institution_id IS NOT NULL AND NEW.name IS DISTINCT FROM OLD.name THEN
    RAISE EXCEPTION 'Nome técnico de template de escola não pode ser alterado — crie um novo template';
  END IF;
  IF NEW.institution_id IS NULL AND NEW.name IS DISTINCT FROM OLD.name AND NEW.name ~ '^esc_[0-9a-f]{6}_' THEN
    RAISE EXCEPTION 'Prefixo esc_ é reservado a templates de escola';
  END IF;

  IF (NEW.name, NEW.language, NEW.category, NEW.body_text)
       IS DISTINCT FROM (OLD.name, OLD.language, OLD.category, OLD.body_text)
     OR NEW.variable_examples IS DISTINCT FROM OLD.variable_examples
     OR NEW.header_config     IS DISTINCT FROM OLD.header_config
     OR NEW.buttons           IS DISTINCT FROM OLD.buttons
     OR NEW.button_config     IS DISTINCT FROM OLD.button_config
  THEN
    SELECT EXISTS (
      SELECT 1 FROM template_institution_status s
      WHERE s.template_definition_id = OLD.id
        AND s.status IN ('pending','approved','paused','disabled')
    ) INTO v_submitted;
    IF v_submitted THEN
      RAISE EXCEPTION 'Template já enviado pra Meta — o conteúdo não pode ser alterado. Crie um novo template.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_template_definitions_guard ON template_definitions;
CREATE TRIGGER trg_template_definitions_guard
  BEFORE INSERT OR UPDATE ON template_definitions
  FOR EACH ROW EXECUTE FUNCTION public.template_definitions_guard();

-- ── 3. template_institution_status: categoria aprovada + novos status ──────
ALTER TABLE template_institution_status
  ADD COLUMN IF NOT EXISTS approved_category TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'template_institution_status_approved_category_check') THEN
    ALTER TABLE template_institution_status ADD CONSTRAINT template_institution_status_approved_category_check
      CHECK (approved_category IS NULL OR approved_category IN ('UTILITY','MARKETING','AUTHENTICATION'));
  END IF;
END $$;

-- PAUSED/DISABLED eram tratados como 'pending' — precisam ser status próprios:
-- template pausado pela Meta tem que pausar campanha (M3), não parecer "em análise".
ALTER TABLE template_institution_status DROP CONSTRAINT IF EXISTS template_institution_status_status_check;
ALTER TABLE template_institution_status ADD CONSTRAINT template_institution_status_status_check
  CHECK (status IN ('not_submitted','pending','approved','rejected','paused','disabled'));

-- Lookup do webhook message_template_status_update (vem pelo id da Meta).
CREATE INDEX IF NOT EXISTS idx_template_institution_status_meta_id
  ON template_institution_status(meta_template_id) WHERE meta_template_id IS NOT NULL;

-- Template de escola só pode ter status NA PRÓPRIA escola — defesa contra
-- qualquer caminho (inclusive o "submit" em massa do Super Admin) publicar o
-- template de uma escola no WABA de outra.
CREATE OR REPLACE FUNCTION public.template_institution_status_owner_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  SELECT institution_id INTO v_owner FROM template_definitions WHERE id = NEW.template_definition_id;
  IF v_owner IS NOT NULL AND v_owner <> NEW.institution_id THEN
    RAISE EXCEPTION 'Template de escola só pode ser registrado na própria escola';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_template_institution_status_owner_guard ON template_institution_status;
CREATE TRIGGER trg_template_institution_status_owner_guard
  BEFORE INSERT OR UPDATE OF template_definition_id, institution_id ON template_institution_status
  FOR EACH ROW EXECUTE FUNCTION public.template_institution_status_owner_guard();

-- Backfill: categoria dos já aprovados, a partir do cache da escola (mesma
-- fonte que o painel já usa). O webhook mantém atualizado daqui pra frente.
UPDATE template_institution_status s
SET approved_category = upper(w.category)
FROM template_definitions d, whatsapp_templates w
WHERE d.id = s.template_definition_id
  AND w.institution_id = s.institution_id
  AND w.name = d.name
  AND s.status = 'approved'
  AND s.approved_category IS NULL
  AND upper(w.category) IN ('UTILITY','MARKETING','AUTHENTICATION');

-- ── 4. RLS de template_definitions ─────────────────────────────────────────
-- Leitura: antes era USING (true) pra todo authenticated. Com template de
-- escola no catálogo, a escola A não pode ler o texto de campanha da escola B.
DROP POLICY IF EXISTS "authenticated_select_template_definitions" ON template_definitions;
DROP POLICY IF EXISTS "template_definitions_select" ON template_definitions;
CREATE POLICY "template_definitions_select" ON template_definitions
  FOR SELECT TO authenticated
  USING (
    institution_id IS NULL
    OR institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid())
    OR is_super_admin_user()
  );

-- Escrita da escola: só no próprio template. Sem policy de DELETE pra escola —
-- exclusão (que também remove da Meta) fica pro endpoint, no service role.
DROP POLICY IF EXISTS "template_definitions_school_insert" ON template_definitions;
CREATE POLICY "template_definitions_school_insert" ON template_definitions
  FOR INSERT TO authenticated
  WITH CHECK (
    institution_id IS NOT NULL
    AND institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "template_definitions_school_update" ON template_definitions;
CREATE POLICY "template_definitions_school_update" ON template_definitions
  FOR UPDATE TO authenticated
  USING (
    institution_id IS NOT NULL
    AND institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    institution_id IS NOT NULL
    AND institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid())
  );

-- template_institution_status: sem mudança de RLS — escola continua só
-- lendo as linhas da própria escola; escrita só Super Admin/service role.
