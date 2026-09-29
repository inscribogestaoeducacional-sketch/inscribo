-- =============================================================================
-- 20260929060000_vitrine.sql
-- Módulo "Vitrine Áion" — página pública tipo Linktree por escola, em
-- aionedu.com.br/<slug>. Fase 1: banco (tabelas, RLS, funções, bucket,
-- integração com Captação Inteligente).
--
-- Desenho aprovado em 2026-09-28:
--   - Uma página por escola (vitrine_pages), blocos ordenados com tipo +
--     config jsonb (vitrine_blocks), eventos de visualização/clique
--     (vitrine_events).
--   - Endereço na raiz: slug único, editável, com lista de nomes proibidos
--     (vitrine_reserved_slugs — rotas do app) e redirecionamento do slug
--     antigo (vitrine_slug_redirects).
--   - Nenhuma policy pra anon nas tabelas. O público só lê por
--     vitrine_public_page(slug) e só grava por vitrine_track(...), ambas
--     SECURITY DEFINER com lista fechada de campos/validação.
--   - Bloco de WhatsApp (e botão de matrícula em modo WhatsApp) com o número
--     da escola cria um gatilho do Captação gerenciado pela Vitrine
--     (capture_triggers.managed_by = 'vitrine', channel = 'vitrine'), com o
--     trigger_text = mensagem pré-preenchida. O webhook não muda: o match
--     por texto já marca origem, cria lead e alimenta o dashboard.
--   - Disponível pra todas as escolas (sem toggle). Quem edita: admin/manager
--     da escola, ou quem tiver user_permissions(module='vitrine').
-- =============================================================================

-- ── 1. Permissão ───────────────────────────────────────────────────────────
-- Mesmo critério de broadcast_user_can_manage, módulo 'vitrine'.
CREATE OR REPLACE FUNCTION public.vitrine_user_can_manage(p_institution_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
      AND coalesce(u.active, true)
      AND p_institution_id IN (u.institution_id, u.active_institution_id)
      AND (
        u.role IN ('admin','manager')
        OR EXISTS (
          SELECT 1 FROM user_permissions p
          WHERE p.user_id = u.id AND p.institution_id = p_institution_id
            AND p.module = 'vitrine' AND p.enabled
        )
      )
  )
$$;

-- Leitura no painel: qualquer usuário da escola ou Super Admin.
CREATE OR REPLACE FUNCTION public.vitrine_user_can_read(p_institution_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
      AND coalesce(u.active, true)
      AND (p_institution_id IN (u.institution_id, u.active_institution_id)
           OR u.user_type = 'admin_geral')
  )
$$;

REVOKE ALL ON FUNCTION public.vitrine_user_can_manage(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vitrine_user_can_read(UUID)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vitrine_user_can_manage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vitrine_user_can_read(UUID)   TO authenticated;

-- ── 2. Slug ────────────────────────────────────────────────────────────────
-- Nomes que não podem virar slug: primeiro segmento das rotas do app
-- (src/App.tsx), rewrites do vercel.json e pastas de public/. Slug tem no
-- mínimo 3 caracteres (regex abaixo), então rotas de 1–2 letras já ficam
-- de fora. Rota nova de primeiro nível no app → acrescentar aqui E no
-- rewrite da Vitrine no vercel.json (Fase 2).
CREATE TABLE IF NOT EXISTS vitrine_reserved_slugs (
  slug TEXT PRIMARY KEY
);

INSERT INTO vitrine_reserved_slugs (slug) VALUES
  -- rotas públicas e do app
  ('api'),('assets'),('fonts'),('novidades'),('pagar'),('survey'),('satisfaction'),
  ('proposta'),('raio-x'),('privacidade'),('termos'),('sobre'),('parceiros'),
  ('parceria-meta'),('blog'),('login'),('logout'),('reset-password'),('unauthorized'),
  ('super-admin'),('home'),('atendente'),('dashboard'),('leads'),('clients'),
  ('contacts'),('visits'),('whatsapp'),('captacao'),('transmissoes'),('transferencias'),
  ('updates'),('pesquisas'),('embed'),('reports'),('users'),('settings'),('profile'),
  ('setup'),('vitrine'),
  -- reserva
  ('admin'),('app'),('aion'),('aionedu'),('inscribo'),('www'),('mail'),('static'),
  ('public'),('docs'),('status'),('suporte'),('ajuda'),('contato'),('cadastro'),
  ('matricula'),('auth'),('oauth'),('callback'),('webhook'),('index'),('404'),('500')
ON CONFLICT DO NOTHING;

-- 3 a 40 caracteres, minúsculas/dígitos/hífen, sem hífen nas pontas.
CREATE OR REPLACE FUNCTION public.vitrine_slug_valid_format(p_slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' AND p_slug !~ '--'
$$;

-- Nome → slug sugerido. Sem extensão unaccent no banco: translate cobre os
-- acentos do português.
CREATE OR REPLACE FUNCTION public.vitrine_slugify(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT left(
    btrim(
      regexp_replace(
        translate(lower(coalesce(p_text, '')),
                  'áàâãäéèêëíìîïóòôõöúùûüçñ',
                  'aaaaaeeeeiiiiooooouuuucn'),
        '[^a-z0-9]+', '-', 'g'),
      '-'),
    40)
$$;

-- ── 3. vitrine_pages ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vitrine_pages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID        NOT NULL UNIQUE REFERENCES institutions(id) ON DELETE CASCADE,
  slug            TEXT        NOT NULL UNIQUE,
  is_published    BOOLEAN     NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ,
  title           TEXT        NOT NULL DEFAULT '',
  bio             TEXT,
  logo_url        TEXT,
  cover_url       TEXT,
  -- {primary, background, text, button_style, radius, font} — validado no
  -- trigger abaixo (as cores entram direto no CSS da página pública).
  theme           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  seo_description TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Alvo da FK composta dos blocos (bloco sempre da mesma escola da página).
  UNIQUE (id, institution_id)
);

DROP TRIGGER IF EXISTS update_vitrine_pages_updated_at ON vitrine_pages;
CREATE TRIGGER update_vitrine_pages_updated_at
  BEFORE UPDATE ON vitrine_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Slugs antigos continuam levando pra página (link na bio do Instagram não
-- quebra). Até 5 por página, pra ninguém "segurar" nomes trocando de slug.
CREATE TABLE IF NOT EXISTS vitrine_slug_redirects (
  old_slug   TEXT        PRIMARY KEY,
  page_id    UUID        NOT NULL REFERENCES vitrine_pages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vitrine_slug_redirects_page ON vitrine_slug_redirects(page_id);

-- Disponibilidade de um slug pra uma página (NULL = página nova).
-- 'ok' | 'invalid' | 'reserved' | 'taken'. SECURITY DEFINER: precisa
-- enxergar slugs de outras escolas, que a RLS esconde.
CREATE OR REPLACE FUNCTION public.vitrine_slug_status(p_slug TEXT, p_page_id UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.vitrine_slug_valid_format(p_slug) THEN 'invalid'
    WHEN EXISTS (SELECT 1 FROM vitrine_reserved_slugs r WHERE r.slug = p_slug) THEN 'reserved'
    WHEN EXISTS (SELECT 1 FROM vitrine_pages p WHERE p.slug = p_slug
                   AND p.id IS DISTINCT FROM p_page_id) THEN 'taken'
    WHEN EXISTS (SELECT 1 FROM vitrine_slug_redirects r WHERE r.old_slug = p_slug
                   AND r.page_id IS DISTINCT FROM p_page_id) THEN 'taken'
    ELSE 'ok'
  END
$$;

REVOKE ALL ON FUNCTION public.vitrine_slug_status(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vitrine_slug_status(TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.vitrine_is_https_url(p_url TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_url ~* '^https?://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?(/[^\s<>"]*)?$'
         AND char_length(p_url) <= 2048
$$;

-- Validação da página + slug. Mensagens em português: sobem pro editor.
CREATE OR REPLACE FUNCTION public.vitrine_pages_validate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_theme  JSONB := NEW.theme;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.institution_id := OLD.institution_id;
    NEW.created_at     := OLD.created_at;
  END IF;

  NEW.slug := lower(btrim(NEW.slug));
  IF TG_OP = 'INSERT' OR NEW.slug IS DISTINCT FROM OLD.slug THEN
    v_status := public.vitrine_slug_status(NEW.slug, NEW.id);
    IF v_status = 'invalid' THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'Endereço inválido: use de 3 a 40 letras minúsculas, números ou hífen (sem acento, sem espaço).';
    ELSIF v_status = 'reserved' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Esse endereço é reservado pelo sistema. Escolha outro.';
    ELSIF v_status = 'taken' THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Esse endereço já está em uso por outra escola.';
    END IF;
  END IF;

  NEW.title := btrim(coalesce(NEW.title, ''));
  IF char_length(NEW.title) > 80 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'O título pode ter no máximo 80 caracteres.';
  END IF;
  IF char_length(coalesce(NEW.bio, '')) > 300 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A descrição pode ter no máximo 300 caracteres.';
  END IF;
  IF char_length(coalesce(NEW.seo_description, '')) > 200 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'O texto de compartilhamento pode ter no máximo 200 caracteres.';
  END IF;
  IF NEW.logo_url IS NOT NULL AND NOT public.vitrine_is_https_url(NEW.logo_url) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Endereço da logo inválido.';
  END IF;
  IF NEW.cover_url IS NOT NULL AND NOT public.vitrine_is_https_url(NEW.cover_url) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Endereço da capa inválido.';
  END IF;

  IF jsonb_typeof(v_theme) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Tema inválido.';
  END IF;
  IF (v_theme ? 'primary'    AND coalesce(v_theme->>'primary', '')    !~ '^#[0-9A-Fa-f]{6}$')
  OR (v_theme ? 'background' AND coalesce(v_theme->>'background', '') !~ '^#[0-9A-Fa-f]{6}$')
  OR (v_theme ? 'text'       AND coalesce(v_theme->>'text', '')       !~ '^#[0-9A-Fa-f]{6}$') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Cor inválida (use o formato #RRGGBB).';
  END IF;
  IF v_theme ? 'button_style' AND coalesce(v_theme->>'button_style', '') NOT IN ('filled','outline','soft') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Estilo de botão inválido.';
  END IF;
  IF v_theme ? 'radius' AND coalesce(v_theme->>'radius', '') NOT IN ('0','8','16','999') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Arredondamento inválido.';
  END IF;
  IF v_theme ? 'font' AND coalesce(v_theme->>'font', '') NOT IN
     ('Inter','Poppins','Montserrat','Nunito','Lora','Playfair Display') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Fonte inválida.';
  END IF;

  IF NEW.is_published AND (TG_OP = 'INSERT' OR NOT OLD.is_published) THEN
    NEW.published_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vitrine_pages_validate ON vitrine_pages;
CREATE TRIGGER vitrine_pages_validate
  BEFORE INSERT OR UPDATE ON vitrine_pages
  FOR EACH ROW EXECUTE FUNCTION public.vitrine_pages_validate();

-- Troca de slug: o antigo vira redirecionamento; voltar pra um slug antigo
-- da própria página tira o redirecionamento dele. Mantém os 5 mais novos.
-- SECURITY DEFINER: vitrine_slug_redirects não tem escrita pelo navegador.
CREATE OR REPLACE FUNCTION public.vitrine_pages_slug_redirect()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM vitrine_slug_redirects WHERE old_slug = NEW.slug AND page_id = NEW.id;
  INSERT INTO vitrine_slug_redirects (old_slug, page_id) VALUES (OLD.slug, NEW.id)
    ON CONFLICT (old_slug) DO NOTHING;
  DELETE FROM vitrine_slug_redirects
   WHERE page_id = NEW.id
     AND old_slug NOT IN (SELECT old_slug FROM vitrine_slug_redirects
                          WHERE page_id = NEW.id ORDER BY created_at DESC LIMIT 5);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vitrine_pages_slug_redirect ON vitrine_pages;
CREATE TRIGGER vitrine_pages_slug_redirect
  AFTER UPDATE OF slug ON vitrine_pages
  FOR EACH ROW WHEN (OLD.slug IS DISTINCT FROM NEW.slug)
  EXECUTE FUNCTION public.vitrine_pages_slug_redirect();

-- ── 4. Captação: canal 'vitrine' e gatilho gerenciado ─────────────────────
ALTER TABLE capture_triggers DROP CONSTRAINT IF EXISTS capture_triggers_channel_check;
ALTER TABLE capture_triggers ADD CONSTRAINT capture_triggers_channel_check
  CHECK (channel IN ('meta_ads','google_ads','instagram','facebook','tiktok','site','outro','vitrine'));

-- managed_by = 'vitrine': criado e mantido pelos blocos da Vitrine. Canal
-- 'vitrine' é exclusivo desses gatilhos (e vice-versa).
ALTER TABLE capture_triggers
  ADD COLUMN IF NOT EXISTS managed_by TEXT CHECK (managed_by IN ('vitrine'));

ALTER TABLE capture_triggers DROP CONSTRAINT IF EXISTS capture_triggers_vitrine_channel_managed;
ALTER TABLE capture_triggers ADD CONSTRAINT capture_triggers_vitrine_channel_managed
  CHECK ((channel = 'vitrine') = (managed_by IS NOT DISTINCT FROM 'vitrine'));

-- Na tela do Captação, o gatilho gerenciado aceita ajuste de resposta
-- automática, pular robô, etiqueta, distribuição e pausar (is_active) —
-- mas nome, texto, canal, arquivamento e exclusão só pela Vitrine (senão o
-- link do bloco e o gatilho saem de sincronia). A sincronização da Vitrine
-- liga a flag de transação vitrine.sync antes de gravar.
CREATE OR REPLACE FUNCTION public.capture_triggers_managed_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('vitrine.sync', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.managed_by IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '42501',
        MESSAGE = 'Gatilhos da Vitrine são criados pelos blocos da Vitrine.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.managed_by IS NULL THEN
    IF TG_OP = 'UPDATE' AND NEW.managed_by IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '42501',
        MESSAGE = 'Gatilhos da Vitrine são criados pelos blocos da Vitrine.';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE'
     OR NEW.name           IS DISTINCT FROM OLD.name
     OR NEW.trigger_text   IS DISTINCT FROM OLD.trigger_text
     OR NEW.channel        IS DISTINCT FROM OLD.channel
     OR NEW.managed_by     IS DISTINCT FROM OLD.managed_by
     OR NEW.archived_at    IS DISTINCT FROM OLD.archived_at
     OR NEW.institution_id IS DISTINCT FROM OLD.institution_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'Este gatilho é da Vitrine: nome, texto e exclusão são editados no bloco da Vitrine.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capture_triggers_managed_guard ON capture_triggers;
CREATE TRIGGER capture_triggers_managed_guard
  BEFORE INSERT OR UPDATE OR DELETE ON capture_triggers
  FOR EACH ROW EXECUTE FUNCTION public.capture_triggers_managed_guard();

-- ── 5. vitrine_blocks ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vitrine_blocks (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id     UUID        NOT NULL,
  page_id            UUID        NOT NULL,
  type               TEXT        NOT NULL
                       CHECK (type IN ('link','whatsapp','text','gallery','video','map','hours','enroll')),
  position           INTEGER     NOT NULL DEFAULT 0,
  is_visible         BOOLEAN     NOT NULL DEFAULT true,
  config             JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- Gatilho do Captação gerenciado por este bloco (whatsapp/enroll em modo
  -- WhatsApp). Preenchido só pelo trigger de sincronização. Fica apontando
  -- mesmo com o rastreio desligado (gatilho arquivado), pra religar
  -- reaproveitando o mesmo gatilho e o histórico dele.
  capture_trigger_id UUID        REFERENCES capture_triggers(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (page_id, institution_id)
    REFERENCES vitrine_pages(id, institution_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vitrine_blocks_page_position ON vitrine_blocks(page_id, position);

DROP TRIGGER IF EXISTS update_vitrine_blocks_updated_at ON vitrine_blocks;
CREATE TRIGGER update_vitrine_blocks_updated_at
  BEFORE UPDATE ON vitrine_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Validação do config por tipo. URLs só http(s); vídeo só por ID
-- (a página monta a URL do iframe a partir de lista fixa); telefone só
-- dígitos. Chaves extras são ignoradas pela página pública.
CREATE OR REPLACE FUNCTION public.vitrine_validate_block(p_type TEXT, c JSONB)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_label TEXT := btrim(coalesce(c->>'label', ''));
  v_msg   TEXT := btrim(coalesce(c->>'message', ''));
  v_img   JSONB;
  v_day   JSONB;
  e       TEXT;  -- mensagem de erro
BEGIN
  IF jsonb_typeof(c) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Configuração do bloco inválida.';
  END IF;

  IF p_type IN ('link','whatsapp','enroll') THEN
    IF v_label = '' OR char_length(v_label) > 80 THEN
      e := 'O texto do botão é obrigatório (até 80 caracteres).';
    END IF;
  END IF;

  IF e IS NULL THEN
    CASE p_type
    WHEN 'link' THEN
      IF NOT public.vitrine_is_https_url(c->>'url') THEN
        e := 'Link inválido: use um endereço começando com https://';
      ELSIF c ? 'thumbnail_url' AND c->>'thumbnail_url' IS NOT NULL
            AND NOT public.vitrine_is_https_url(c->>'thumbnail_url') THEN
        e := 'Imagem do link inválida.';
      END IF;

    WHEN 'whatsapp' THEN
      IF coalesce(c->>'phone_source', 'school') NOT IN ('school','custom') THEN
        e := 'Origem do número inválida.';
      ELSIF c->>'phone_source' = 'custom'
            AND coalesce(c->>'custom_phone', '') !~ '^[0-9]{10,13}$' THEN
        e := 'Número de WhatsApp inválido: use DDD + número, só dígitos.';
      ELSIF char_length(v_msg) > 500 THEN
        e := 'A mensagem pode ter no máximo 500 caracteres.';
      ELSIF coalesce((c->>'track_capture')::boolean, true)
            AND coalesce(c->>'phone_source', 'school') = 'school'
            AND char_length(v_msg) < 10 THEN
        e := 'A mensagem precisa ter pelo menos 10 caracteres pra identificar a origem no Captação.';
      END IF;

    WHEN 'enroll' THEN
      IF coalesce(c->>'mode', '') NOT IN ('link','whatsapp') THEN
        e := 'Escolha se o botão abre um link ou o WhatsApp.';
      ELSIF c->>'mode' = 'link' AND NOT public.vitrine_is_https_url(c->>'url') THEN
        e := 'Link de matrícula inválido: use um endereço começando com https://';
      ELSIF c->>'mode' = 'whatsapp' AND (char_length(v_msg) < 10 OR char_length(v_msg) > 500) THEN
        e := 'A mensagem precisa ter de 10 a 500 caracteres.';
      END IF;

    WHEN 'text' THEN
      IF btrim(coalesce(c->>'body', '')) = '' OR char_length(c->>'body') > 2000 THEN
        e := 'O texto é obrigatório (até 2000 caracteres).';
      ELSIF char_length(coalesce(c->>'title', '')) > 100 THEN
        e := 'O título pode ter no máximo 100 caracteres.';
      END IF;

    WHEN 'gallery' THEN
      IF jsonb_typeof(c->'images') IS DISTINCT FROM 'array'
         OR jsonb_array_length(c->'images') NOT BETWEEN 1 AND 12 THEN
        e := 'A galeria precisa ter de 1 a 12 imagens.';
      ELSIF coalesce(c->>'layout', 'grid') NOT IN ('grid','carousel') THEN
        e := 'Layout da galeria inválido.';
      ELSE
        FOR v_img IN SELECT * FROM jsonb_array_elements(c->'images') LOOP
          IF NOT public.vitrine_is_https_url(v_img->>'url')
             OR char_length(coalesce(v_img->>'caption', '')) > 150 THEN
            e := 'Imagem da galeria inválida.';
            EXIT;
          END IF;
        END LOOP;
      END IF;

    WHEN 'video' THEN
      IF NOT ((c->>'provider' = 'youtube' AND coalesce(c->>'video_id', '') ~ '^[A-Za-z0-9_-]{11}$')
           OR (c->>'provider' = 'vimeo'   AND coalesce(c->>'video_id', '') ~ '^[0-9]{6,12}$')) THEN
        e := 'Vídeo inválido: cole um link do YouTube ou do Vimeo.';
      ELSIF char_length(coalesce(c->>'title', '')) > 100 THEN
        e := 'O título pode ter no máximo 100 caracteres.';
      END IF;

    WHEN 'map' THEN
      IF char_length(btrim(coalesce(c->>'address', ''))) NOT BETWEEN 5 AND 300 THEN
        e := 'Informe o endereço (de 5 a 300 caracteres).';
      END IF;

    WHEN 'hours' THEN
      IF jsonb_typeof(c->'days') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'days') > 7 THEN
        e := 'Horário inválido.';
      ELSIF char_length(coalesce(c->>'note', '')) > 200 THEN
        e := 'A observação pode ter no máximo 200 caracteres.';
      ELSE
        FOR v_day IN SELECT * FROM jsonb_array_elements(c->'days') LOOP
          IF coalesce(v_day->>'dow', '') !~ '^[0-6]$'
             OR (NOT coalesce((v_day->>'closed')::boolean, false)
                 AND (coalesce(v_day->>'open', '')  !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                   OR coalesce(v_day->>'close', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')) THEN
            e := 'Horário inválido: use HH:MM em cada dia aberto.';
            EXIT;
          END IF;
        END LOOP;
      END IF;
    END CASE;
  END IF;

  IF e IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = e;
  END IF;
END;
$$;

-- Validação + sincronização com o Captação. SECURITY DEFINER: grava em
-- capture_triggers sem depender da RLS/permissão de Captação de quem edita
-- a Vitrine (a permissão já foi checada pela RLS de vitrine_blocks).
CREATE OR REPLACE FUNCTION public.vitrine_blocks_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wants  BOOLEAN;
  v_msg    TEXT;
  v_label  TEXT;
  v_name   TEXT;
  v_valid  BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Nunca aceita gatilho vindo do navegador.
    NEW.capture_trigger_id := NULL;
    IF (SELECT count(*) FROM vitrine_blocks WHERE page_id = NEW.page_id) >= 50 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Limite de 50 blocos por página.';
    END IF;
  ELSE
    NEW.capture_trigger_id := OLD.capture_trigger_id;
    NEW.page_id            := OLD.page_id;
    NEW.institution_id     := OLD.institution_id;
    NEW.created_at         := OLD.created_at;
    -- Reordenar/ocultar não mexe no gatilho.
    IF NEW.type = OLD.type AND NEW.config = OLD.config THEN
      RETURN NEW;
    END IF;
  END IF;

  PERFORM public.vitrine_validate_block(NEW.type, NEW.config);

  v_msg   := btrim(coalesce(NEW.config->>'message', ''));
  v_label := btrim(coalesce(NEW.config->>'label', ''));
  v_wants := CASE NEW.type
    WHEN 'whatsapp' THEN coalesce((NEW.config->>'track_capture')::boolean, true)
                         AND coalesce(NEW.config->>'phone_source', 'school') = 'school'
    WHEN 'enroll'   THEN NEW.config->>'mode' = 'whatsapp'
    ELSE false
  END;
  v_name := left('Vitrine: ' || v_label, 120);

  PERFORM set_config('vitrine.sync', 'on', true);

  IF v_wants THEN
    SELECT EXISTS (SELECT 1 FROM capture_triggers t
                   WHERE t.id = NEW.capture_trigger_id
                     AND t.institution_id = NEW.institution_id
                     AND t.managed_by = 'vitrine')
      INTO v_valid;
    IF v_valid THEN
      UPDATE capture_triggers t
         SET name         = v_name,
             trigger_text = v_msg,
             -- Religando o rastreio: sai do arquivo e volta ativo. Gatilho só
             -- pausado no Captação (is_active=false sem arquivar) continua
             -- pausado — foi decisão da escola.
             is_active    = CASE WHEN t.archived_at IS NOT NULL THEN true ELSE t.is_active END,
             archived_at  = NULL
       WHERE t.id = NEW.capture_trigger_id;
    ELSE
      INSERT INTO capture_triggers (institution_id, name, channel, trigger_text, managed_by, created_by)
      VALUES (NEW.institution_id, v_name, 'vitrine', v_msg, 'vitrine', auth.uid())
      RETURNING id INTO NEW.capture_trigger_id;
    END IF;
  ELSIF NEW.capture_trigger_id IS NOT NULL THEN
    UPDATE capture_triggers t
       SET archived_at = coalesce(t.archived_at, now()), is_active = false
     WHERE t.id = NEW.capture_trigger_id
       AND t.institution_id = NEW.institution_id
       AND t.managed_by = 'vitrine';
  END IF;

  PERFORM set_config('vitrine.sync', 'off', true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vitrine_blocks_before_write ON vitrine_blocks;
CREATE TRIGGER vitrine_blocks_before_write
  BEFORE INSERT OR UPDATE ON vitrine_blocks
  FOR EACH ROW EXECUTE FUNCTION public.vitrine_blocks_before_write();

-- Bloco excluído: gatilho arquivado (não apagado — histórico do dashboard).
CREATE OR REPLACE FUNCTION public.vitrine_blocks_after_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.capture_trigger_id IS NOT NULL THEN
    PERFORM set_config('vitrine.sync', 'on', true);
    UPDATE capture_triggers t
       SET archived_at = coalesce(t.archived_at, now()), is_active = false
     WHERE t.id = OLD.capture_trigger_id
       AND t.institution_id = OLD.institution_id
       AND t.managed_by = 'vitrine';
    PERFORM set_config('vitrine.sync', 'off', true);
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS vitrine_blocks_after_delete ON vitrine_blocks;
CREATE TRIGGER vitrine_blocks_after_delete
  AFTER DELETE ON vitrine_blocks
  FOR EACH ROW EXECUTE FUNCTION public.vitrine_blocks_after_delete();

-- ── 6. vitrine_events ──────────────────────────────────────────────────────
-- Visualização da página (block_id NULL) e clique em bloco. Sem IP e sem
-- dado pessoal: visitor_id é um uuid aleatório gerado no navegador.
-- Escrita só por vitrine_track().
CREATE TABLE IF NOT EXISTS vitrine_events (
  id             BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  institution_id UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  page_id        UUID        NOT NULL REFERENCES vitrine_pages(id) ON DELETE CASCADE,
  block_id       UUID        REFERENCES vitrine_blocks(id) ON DELETE SET NULL,
  event_type     TEXT        NOT NULL CHECK (event_type IN ('view','click')),
  visitor_id     UUID        NOT NULL,
  referrer_host  TEXT,
  utm_source     TEXT,
  utm_medium     TEXT,
  utm_campaign   TEXT,
  device         TEXT        CHECK (device IN ('mobile','tablet','desktop')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vitrine_events_page_time    ON vitrine_events(page_id, created_at);
CREATE INDEX IF NOT EXISTS idx_vitrine_events_inst_time    ON vitrine_events(institution_id, created_at);
CREATE INDEX IF NOT EXISTS idx_vitrine_events_page_visitor ON vitrine_events(page_id, visitor_id, created_at);

-- ── 7. RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE vitrine_pages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitrine_blocks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitrine_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitrine_slug_redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitrine_reserved_slugs ENABLE ROW LEVEL SECURITY;

-- Supabase concede ALL a anon/authenticated em tabela nova do public:
-- zera e concede só o que o painel usa. anon não recebe nada.
REVOKE ALL ON vitrine_pages, vitrine_blocks, vitrine_events,
              vitrine_slug_redirects, vitrine_reserved_slugs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vitrine_pages  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vitrine_blocks TO authenticated;
GRANT SELECT ON vitrine_events         TO authenticated;
GRANT SELECT ON vitrine_slug_redirects TO authenticated;
GRANT SELECT ON vitrine_reserved_slugs TO authenticated;

-- vitrine_pages
DROP POLICY IF EXISTS vitrine_pages_select ON vitrine_pages;
CREATE POLICY vitrine_pages_select ON vitrine_pages
  FOR SELECT TO authenticated
  USING (public.vitrine_user_can_read(institution_id));

DROP POLICY IF EXISTS vitrine_pages_insert ON vitrine_pages;
CREATE POLICY vitrine_pages_insert ON vitrine_pages
  FOR INSERT TO authenticated
  WITH CHECK (public.vitrine_user_can_manage(institution_id));

DROP POLICY IF EXISTS vitrine_pages_update ON vitrine_pages;
CREATE POLICY vitrine_pages_update ON vitrine_pages
  FOR UPDATE TO authenticated
  USING      (public.vitrine_user_can_manage(institution_id))
  WITH CHECK (public.vitrine_user_can_manage(institution_id));

-- Excluir a página apaga blocos e estatísticas: só Super Admin.
DROP POLICY IF EXISTS vitrine_pages_delete ON vitrine_pages;
CREATE POLICY vitrine_pages_delete ON vitrine_pages
  FOR DELETE TO authenticated
  USING (public.is_super_admin_user());

-- vitrine_blocks
DROP POLICY IF EXISTS vitrine_blocks_select ON vitrine_blocks;
CREATE POLICY vitrine_blocks_select ON vitrine_blocks
  FOR SELECT TO authenticated
  USING (public.vitrine_user_can_read(institution_id));

DROP POLICY IF EXISTS vitrine_blocks_insert ON vitrine_blocks;
CREATE POLICY vitrine_blocks_insert ON vitrine_blocks
  FOR INSERT TO authenticated
  WITH CHECK (public.vitrine_user_can_manage(institution_id));

DROP POLICY IF EXISTS vitrine_blocks_update ON vitrine_blocks;
CREATE POLICY vitrine_blocks_update ON vitrine_blocks
  FOR UPDATE TO authenticated
  USING      (public.vitrine_user_can_manage(institution_id))
  WITH CHECK (public.vitrine_user_can_manage(institution_id));

DROP POLICY IF EXISTS vitrine_blocks_delete ON vitrine_blocks;
CREATE POLICY vitrine_blocks_delete ON vitrine_blocks
  FOR DELETE TO authenticated
  USING (public.vitrine_user_can_manage(institution_id));

-- vitrine_events: só leitura, da própria escola.
DROP POLICY IF EXISTS vitrine_events_select ON vitrine_events;
CREATE POLICY vitrine_events_select ON vitrine_events
  FOR SELECT TO authenticated
  USING (public.vitrine_user_can_read(institution_id));

-- vitrine_slug_redirects: a escola vê os slugs antigos da própria página.
DROP POLICY IF EXISTS vitrine_slug_redirects_select ON vitrine_slug_redirects;
CREATE POLICY vitrine_slug_redirects_select ON vitrine_slug_redirects
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM vitrine_pages p
                 WHERE p.id = vitrine_slug_redirects.page_id
                   AND public.vitrine_user_can_read(p.institution_id)));

-- vitrine_reserved_slugs: lista pública pro editor avisar antes de salvar.
DROP POLICY IF EXISTS vitrine_reserved_slugs_select ON vitrine_reserved_slugs;
CREATE POLICY vitrine_reserved_slugs_select ON vitrine_reserved_slugs
  FOR SELECT TO authenticated
  USING (true);

-- ── 8. Funções do painel ───────────────────────────────────────────────────
-- Primeiro acesso ao editor: cria a página da escola (rascunho) com slug
-- sugerido a partir do nome e cores/logo de institutions. Idempotente.
CREATE OR REPLACE FUNCTION public.vitrine_ensure_page(p_institution_id UUID)
RETURNS vitrine_pages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page  vitrine_pages;
  v_inst  RECORD;
  v_base  TEXT;
  v_slug  TEXT;
  v_n     INTEGER := 1;
BEGIN
  IF NOT public.vitrine_user_can_manage(p_institution_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Sem permissão pra editar a Vitrine desta escola.';
  END IF;

  SELECT * INTO v_page FROM vitrine_pages WHERE institution_id = p_institution_id;
  IF FOUND THEN RETURN v_page; END IF;

  SELECT name, logo_url, primary_color INTO v_inst FROM institutions WHERE id = p_institution_id;

  v_base := btrim(left(public.vitrine_slugify(v_inst.name), 36), '-');
  IF NOT public.vitrine_slug_valid_format(v_base) THEN
    v_base := 'escola-' || left(replace(p_institution_id::text, '-', ''), 6);
  END IF;
  v_slug := v_base;
  WHILE public.vitrine_slug_status(v_slug, NULL) <> 'ok' LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  END LOOP;

  INSERT INTO vitrine_pages (institution_id, slug, title, logo_url, theme)
  VALUES (
    p_institution_id,
    v_slug,
    left(coalesce(v_inst.name, ''), 80),
    CASE WHEN public.vitrine_is_https_url(v_inst.logo_url) THEN v_inst.logo_url END,
    jsonb_build_object(
      'primary',      CASE WHEN v_inst.primary_color ~ '^#[0-9A-Fa-f]{6}$' THEN v_inst.primary_color ELSE '#00A896' END,
      'background',   '#FFFFFF',
      'text',         '#111827',
      'button_style', 'filled',
      'radius',       16,
      'font',         'Inter')
  )
  RETURNING * INTO v_page;
  RETURN v_page;
END;
$$;

REVOKE ALL ON FUNCTION public.vitrine_ensure_page(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vitrine_ensure_page(UUID) TO authenticated;

-- Reordena numa transação só. SECURITY INVOKER: a RLS de vitrine_blocks
-- decide (quem não pode editar não mexe em nada).
CREATE OR REPLACE FUNCTION public.vitrine_reorder_blocks(p_page_id UUID, p_block_ids UUID[])
RETURNS VOID
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE vitrine_blocks b
     SET position = x.ord::int
    FROM unnest(p_block_ids) WITH ORDINALITY AS x(id, ord)
   WHERE b.id = x.id AND b.page_id = p_page_id AND b.position IS DISTINCT FROM x.ord::int;
$$;

REVOKE ALL ON FUNCTION public.vitrine_reorder_blocks(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vitrine_reorder_blocks(UUID, UUID[]) TO authenticated;

-- Métricas do painel: por bloco (NULL = visualizações da página) e tipo de
-- evento, total e visitantes distintos. O funil do WhatsApp (conversas →
-- leads → matrículas) vem de capture_trigger_stats com o capture_trigger_id
-- do bloco. SECURITY INVOKER: só enxerga a própria escola.
CREATE OR REPLACE FUNCTION public.vitrine_stats(p_institution_id UUID, p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE (block_id UUID, event_type TEXT, events BIGINT, visitors BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT e.block_id, e.event_type, count(*), count(DISTINCT e.visitor_id)
  FROM vitrine_events e
  WHERE e.institution_id = p_institution_id
    AND e.created_at >= p_start AND e.created_at < p_end
  GROUP BY e.block_id, e.event_type
$$;

REVOKE ALL ON FUNCTION public.vitrine_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vitrine_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ── 9. Funções públicas (anon) ─────────────────────────────────────────────
-- Página publicada, pronta pra renderizar. Retorna:
--   {page: {...}, blocks: [...]}      página publicada
--   {redirect: '<slug atual>'}        slug antigo de página publicada
--   NULL                              não existe / rascunho / escola suspensa
-- Lista fechada de campos. WhatsApp: devolve o número (da escola, em
-- whatsapp_phone_numbers ativo, ou o próprio do bloco) + mensagem; o link
-- wa.me é montado na renderização com a mesma codificação de
-- buildWaMeLink (src/lib/captureTriggers.ts). Sem número → bloco omitido.
CREATE OR REPLACE FUNCTION public.vitrine_public_page(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug   TEXT := lower(btrim(coalesce(p_slug, '')));
  v_page   vitrine_pages;
  v_inst   RECORD;
  v_phone  TEXT;
  v_blocks JSONB;
BEGIN
  IF NOT public.vitrine_slug_valid_format(v_slug) THEN RETURN NULL; END IF;

  SELECT * INTO v_page FROM vitrine_pages WHERE slug = v_slug;
  IF NOT FOUND THEN
    SELECT p.* INTO v_page
      FROM vitrine_slug_redirects r JOIN vitrine_pages p ON p.id = r.page_id
     WHERE r.old_slug = v_slug;
    IF FOUND AND v_page.is_published THEN
      RETURN jsonb_build_object('redirect', v_page.slug);
    END IF;
    RETURN NULL;
  END IF;

  SELECT name, plan_status, coalesce(active, true) AS active INTO v_inst
    FROM institutions WHERE id = v_page.institution_id;
  IF NOT v_page.is_published OR v_inst.plan_status = 'suspended' OR NOT v_inst.active THEN
    RETURN NULL;
  END IF;

  SELECT regexp_replace(phone_number, '\D', '', 'g') INTO v_phone
    FROM whatsapp_phone_numbers
   WHERE institution_id = v_page.institution_id AND is_active
   ORDER BY created_at
   LIMIT 1;
  v_phone := nullif(v_phone, '');

  SELECT coalesce(jsonb_agg(x.block ORDER BY x.position, x.created_at), '[]'::jsonb)
    INTO v_blocks
    FROM (
      SELECT b.position, b.created_at,
             jsonb_build_object('id', b.id, 'type', b.type, 'config',
               CASE b.type
                 WHEN 'whatsapp' THEN jsonb_build_object(
                   'label',   b.config->>'label',
                   'message', b.config->>'message',
                   'phone',   CASE WHEN b.config->>'phone_source' = 'custom'
                                   THEN b.config->>'custom_phone' ELSE v_phone END)
                 WHEN 'enroll' THEN
                   CASE WHEN b.config->>'mode' = 'link'
                        THEN jsonb_build_object('label', b.config->>'label', 'mode', 'link',
                                                'url', b.config->>'url')
                        ELSE jsonb_build_object('label', b.config->>'label', 'mode', 'whatsapp',
                                                'message', b.config->>'message', 'phone', v_phone)
                   END
                 WHEN 'link' THEN jsonb_build_object(
                   'label', b.config->>'label', 'url', b.config->>'url',
                   'thumbnail_url', b.config->>'thumbnail_url')
                 WHEN 'text' THEN jsonb_build_object(
                   'title', b.config->>'title', 'body', b.config->>'body')
                 WHEN 'gallery' THEN jsonb_build_object(
                   'layout', coalesce(b.config->>'layout', 'grid'),
                   'images', (SELECT jsonb_agg(jsonb_build_object('url', i->>'url', 'caption', i->>'caption'))
                                FROM jsonb_array_elements(b.config->'images') i))
                 WHEN 'video' THEN jsonb_build_object(
                   'provider', b.config->>'provider', 'video_id', b.config->>'video_id',
                   'title', b.config->>'title')
                 WHEN 'map' THEN jsonb_build_object(
                   'address', b.config->>'address', 'label', b.config->>'label')
                 WHEN 'hours' THEN jsonb_build_object(
                   'days', b.config->'days', 'note', b.config->>'note')
               END) AS block
        FROM vitrine_blocks b
       WHERE b.page_id = v_page.id AND b.is_visible
         AND NOT (b.type = 'whatsapp' AND b.config->>'phone_source' IS DISTINCT FROM 'custom' AND v_phone IS NULL)
         AND NOT (b.type = 'enroll'   AND b.config->>'mode' = 'whatsapp' AND v_phone IS NULL)
    ) x;

  RETURN jsonb_build_object(
    'page', jsonb_build_object(
      'id',              v_page.id,
      'slug',            v_page.slug,
      'title',           v_page.title,
      'bio',             v_page.bio,
      'logo_url',        v_page.logo_url,
      'cover_url',       v_page.cover_url,
      'theme',           v_page.theme,
      'seo_description', v_page.seo_description,
      'institution_name', v_inst.name),
    'blocks', v_blocks);
END;
$$;

REVOKE ALL ON FUNCTION public.vitrine_public_page(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vitrine_public_page(TEXT) TO anon, authenticated;

-- Registro de visualização/clique vindo da página pública. Descarta em
-- silêncio (sem erro, pra não virar oráculo): página inexistente/rascunho,
-- bloco de outra página, repetição (mesma visualização em 30 min, mesmo
-- clique em 5 s), visitante com mais de 120 eventos na última hora, página
-- com mais de 600 eventos no último minuto. visitor_id vem do navegador e
-- pode ser trocado — os tetos limitam o estrago, não o impedem.
CREATE OR REPLACE FUNCTION public.vitrine_track(
  p_page_id       UUID,
  p_block_id      UUID,
  p_event         TEXT,
  p_visitor_id    UUID,
  p_referrer_host TEXT DEFAULT NULL,
  p_utm_source    TEXT DEFAULT NULL,
  p_utm_medium    TEXT DEFAULT NULL,
  p_utm_campaign  TEXT DEFAULT NULL,
  p_device        TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inst UUID;
BEGIN
  IF p_page_id IS NULL OR p_visitor_id IS NULL OR p_event NOT IN ('view','click') THEN RETURN; END IF;
  IF (p_event = 'view') <> (p_block_id IS NULL) THEN RETURN; END IF;

  SELECT p.institution_id INTO v_inst
    FROM vitrine_pages p
   WHERE p.id = p_page_id AND p.is_published;
  IF v_inst IS NULL THEN RETURN; END IF;

  IF p_block_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM vitrine_blocks b
        WHERE b.id = p_block_id AND b.page_id = p_page_id AND b.is_visible) THEN
    RETURN;
  END IF;

  IF (SELECT count(*) FROM vitrine_events
       WHERE page_id = p_page_id AND created_at > now() - interval '1 minute') >= 600 THEN
    RETURN;
  END IF;
  IF (SELECT count(*) FROM vitrine_events
       WHERE page_id = p_page_id AND visitor_id = p_visitor_id
         AND created_at > now() - interval '1 hour') >= 120 THEN
    RETURN;
  END IF;
  IF EXISTS (
       SELECT 1 FROM vitrine_events
        WHERE page_id = p_page_id AND visitor_id = p_visitor_id AND event_type = p_event
          AND block_id IS NOT DISTINCT FROM p_block_id
          AND created_at > now() - CASE WHEN p_event = 'view' THEN interval '30 minutes'
                                        ELSE interval '5 seconds' END) THEN
    RETURN;
  END IF;

  INSERT INTO vitrine_events (institution_id, page_id, block_id, event_type, visitor_id,
                              referrer_host, utm_source, utm_medium, utm_campaign, device)
  VALUES (v_inst, p_page_id, p_block_id, p_event, p_visitor_id,
          nullif(left(lower(btrim(coalesce(p_referrer_host, ''))), 100), ''),
          nullif(left(btrim(coalesce(p_utm_source,   '')), 100), ''),
          nullif(left(btrim(coalesce(p_utm_medium,   '')), 100), ''),
          nullif(left(btrim(coalesce(p_utm_campaign, '')), 100), ''),
          CASE WHEN p_device IN ('mobile','tablet','desktop') THEN p_device END);
END;
$$;

REVOKE ALL ON FUNCTION public.vitrine_track(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vitrine_track(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Funções internas: sem execução direta pelo navegador.
REVOKE ALL ON FUNCTION public.vitrine_pages_validate()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vitrine_pages_slug_redirect()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vitrine_blocks_before_write()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vitrine_blocks_after_delete()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_triggers_managed_guard()  FROM PUBLIC, anon, authenticated;

-- ── 10. Storage: vitrine-media ─────────────────────────────────────────────
-- Logo, capa, galeria e miniatura de link. Mesmo padrão de broadcast-media
-- (20260928030000): bucket público (a página pública usa a URL direta),
-- caminho <institution_id>/<uuid>.<ext>, escrita/listagem só na pasta da
-- própria escola. Não reaproveita broadcast-media porque lá a escrita exige
-- Transmissões liberada e a permissão 'transmissoes'.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('vitrine-media', 'vitrine-media', true, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS vitrine_media_school_insert ON storage.objects;
CREATE POLICY vitrine_media_school_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vitrine-media'
    AND public.broadcast_media_institution(name) IS NOT NULL
    AND public.vitrine_user_can_manage(public.broadcast_media_institution(name))
  );

DROP POLICY IF EXISTS vitrine_media_school_delete ON storage.objects;
CREATE POLICY vitrine_media_school_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'vitrine-media'
    AND public.broadcast_media_institution(name) IS NOT NULL
    AND public.vitrine_user_can_manage(public.broadcast_media_institution(name))
  );

DROP POLICY IF EXISTS vitrine_media_school_read ON storage.objects;
CREATE POLICY vitrine_media_school_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'vitrine-media'
    AND public.broadcast_media_institution(name) IS NOT NULL
    AND public.vitrine_user_can_manage(public.broadcast_media_institution(name))
  );
