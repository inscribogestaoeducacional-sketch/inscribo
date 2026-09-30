-- =============================================================================
-- 20260930100000_vitrine_efeitos_video_agendamento.sql
-- Vitrine, Fase 5 / Entrega 1: efeito por botão, capa em vídeo e agendamento.
--
-- Blocos-botão (link, whatsapp, enroll, pdf, contact): config.effect =
--   none | pulse | shine | shake. Validado no despacho geral (vale pra todos
--   os tipos-botão sem reescrever as funções de cada um) e repassado pra
--   página pública pelo despacho de JSON público.
-- vitrine_pages.cover_video_url: MP4/WebM do bucket vitrine-videos (a capa em
--   imagem vira o quadro de espera do vídeo).
-- Agendamento:
--   vitrine_pages.publish_at / unpublish_at — janela em que a página publicada
--     aparece (vazio = sem limite).
--   vitrine_blocks.visible_from / visible_until — idem por bloco.
--   vitrine_public_page devolve next_change_at (a próxima virada de agenda):
--   a página pública encurta o cache até esse momento.
-- =============================================================================

ALTER TABLE vitrine_pages
  ADD COLUMN IF NOT EXISTS cover_video_url TEXT,
  ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unpublish_at TIMESTAMPTZ;
ALTER TABLE vitrine_blocks
  ADD COLUMN IF NOT EXISTS visible_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visible_until TIMESTAMPTZ;

ALTER TABLE vitrine_pages DROP CONSTRAINT IF EXISTS vitrine_pages_schedule_check;
ALTER TABLE vitrine_pages ADD CONSTRAINT vitrine_pages_schedule_check
  CHECK (publish_at IS NULL OR unpublish_at IS NULL OR unpublish_at > publish_at);
ALTER TABLE vitrine_blocks DROP CONSTRAINT IF EXISTS vitrine_blocks_schedule_check;
ALTER TABLE vitrine_blocks ADD CONSTRAINT vitrine_blocks_schedule_check
  CHECK (visible_from IS NULL OR visible_until IS NULL OR visible_until > visible_from);

-- Vídeo da capa: https, sem caracteres que quebrem o HTML/CSS, e só .mp4/.webm.
CREATE OR REPLACE FUNCTION public.vitrine_pages_video_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.cover_video_url IS NOT NULL
     AND (NOT public.vitrine_is_https_url(NEW.cover_video_url)
          OR NEW.cover_video_url ~ '["''(){};\\<>]'
          OR split_part(lower(NEW.cover_video_url), '?', 1) !~ '\.(mp4|webm)$') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Vídeo da capa inválido: envie um arquivo MP4.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS vitrine_pages_video_check ON vitrine_pages;
CREATE TRIGGER vitrine_pages_video_check
  BEFORE INSERT OR UPDATE OF cover_video_url ON vitrine_pages
  FOR EACH ROW EXECUTE FUNCTION public.vitrine_pages_video_check();
REVOKE ALL ON FUNCTION public.vitrine_pages_video_check() FROM PUBLIC, anon, authenticated;

-- ── Despacho da validação: + efeito dos blocos-botão ────────────────────────
CREATE OR REPLACE FUNCTION public.vitrine_validate_block(p_type TEXT, c JSONB)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  e TEXT;
BEGIN
  IF jsonb_typeof(c) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Configuração do bloco inválida.';
  END IF;
  IF p_type !~ '^[a-z_]+$' OR to_regprocedure(format('public.%I(jsonb)', 'vitrine_check_' || p_type)) IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Tipo de bloco inválido.';
  END IF;
  EXECUTE format('SELECT public.%I($1)', 'vitrine_check_' || p_type) INTO e USING c;
  IF e IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = e;
  END IF;
  IF c ? 'effect' AND (p_type NOT IN ('link','whatsapp','enroll','pdf','contact')
                       OR coalesce(c->>'effect', '') NOT IN ('none','pulse','shine','shake')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Efeito do botão inválido.';
  END IF;
END;
$$;

-- ── Despacho do JSON público: + efeito ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vitrine_public_block(p_type TEXT, c JSONB, ctx JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  r JSONB;
BEGIN
  IF p_type !~ '^[a-z_]+$' OR to_regprocedure(format('public.%I(jsonb,jsonb)', 'vitrine_public_' || p_type)) IS NULL THEN
    RETURN NULL;
  END IF;
  EXECUTE format('SELECT public.%I($1, $2)', 'vitrine_public_' || p_type) INTO r USING c, ctx;
  IF r IS NOT NULL AND p_type IN ('link','whatsapp','enroll','pdf','contact')
     AND c->>'effect' IN ('pulse','shine','shake') THEN
    r := r || jsonb_build_object('effect', c->>'effect');
  END IF;
  RETURN r;
END;
$$;

-- ── Página pública: agenda + vídeo + próxima virada ─────────────────────────
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
  v_ctx    JSONB;
  v_blocks JSONB;
  v_next   TIMESTAMPTZ;
  v_now    TIMESTAMPTZ := now();
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
  IF NOT v_page.is_published OR v_inst.plan_status = 'suspended' OR NOT v_inst.active
     OR (v_page.publish_at IS NOT NULL AND v_now < v_page.publish_at)
     OR (v_page.unpublish_at IS NOT NULL AND v_now >= v_page.unpublish_at) THEN
    RETURN NULL;
  END IF;

  SELECT regexp_replace(phone_number, '\D', '', 'g') INTO v_phone
    FROM whatsapp_phone_numbers
   WHERE institution_id = v_page.institution_id AND is_active
   ORDER BY created_at
   LIMIT 1;
  v_ctx := jsonb_build_object('phone', nullif(v_phone, ''), 'institution_name', v_inst.name);

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'type', x.type, 'config', x.cfg)
                            ORDER BY x.position, x.created_at), '[]'::jsonb)
    INTO v_blocks
    FROM (
      SELECT b.id, b.type, b.position, b.created_at, public.vitrine_public_block(b.type, b.config, v_ctx) AS cfg
        FROM vitrine_blocks b
       WHERE b.page_id = v_page.id AND b.is_visible
         AND (b.visible_from IS NULL OR v_now >= b.visible_from)
         AND (b.visible_until IS NULL OR v_now < b.visible_until)
    ) x
   WHERE x.cfg IS NOT NULL;

  -- Próxima virada de agenda (página tirada do ar, bloco entrando ou saindo):
  -- a página pública usa pra não servir versão velha do cache depois dela.
  SELECT min(t) INTO v_next FROM (
    SELECT v_page.unpublish_at AS t
    UNION ALL SELECT b.visible_from  FROM vitrine_blocks b WHERE b.page_id = v_page.id AND b.is_visible
    UNION ALL SELECT b.visible_until FROM vitrine_blocks b WHERE b.page_id = v_page.id AND b.is_visible
  ) s WHERE t > v_now;

  RETURN jsonb_build_object(
    'page', jsonb_build_object(
      'id',              v_page.id,
      'slug',            v_page.slug,
      'title',           v_page.title,
      'bio',             v_page.bio,
      'logo_url',        v_page.logo_url,
      'cover_url',       v_page.cover_url,
      'cover_video_url', v_page.cover_video_url,
      'theme',           v_page.theme,
      'seo_description', v_page.seo_description,
      'social_links',    v_page.social_links,
      'institution_name', v_inst.name,
      'floating_block_id', v_page.floating_block_id,
      'show_share',      v_page.show_share,
      'social_position', v_page.social_position),
    'blocks', v_blocks,
    'next_change_at', v_next);
END;
$$;

REVOKE ALL ON FUNCTION public.vitrine_public_page(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vitrine_public_page(TEXT) TO anon, authenticated;
