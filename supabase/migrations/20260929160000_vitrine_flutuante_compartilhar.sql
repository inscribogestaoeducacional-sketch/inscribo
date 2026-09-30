-- =============================================================================
-- 20260929160000_vitrine_flutuante_compartilhar.sql
-- Vitrine, Fase 5 / etapa 7: WhatsApp flutuante, compartilhar e posição da
-- fileira de redes.
--
-- vitrine_pages
--   + floating_block_id  bloco de WhatsApp (ou matrícula por WhatsApp) da
--                        própria página que vira botão flutuante — reusa a
--                        mensagem e o gatilho do Captação do bloco, e o clique
--                        conta no mesmo bloco. Bloco excluído = sem flutuante.
--   + show_share         botão "compartilhar" no topo (padrão: ligado)
--   + social_position    fileira de redes no topo (padrão) ou no rodapé
-- vitrine_track: aceita o alvo 'share' (clique em compartilhar, sem bloco).
-- =============================================================================

ALTER TABLE vitrine_pages
  ADD COLUMN IF NOT EXISTS floating_block_id UUID REFERENCES vitrine_blocks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS show_share BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS social_position TEXT NOT NULL DEFAULT 'top';

ALTER TABLE vitrine_pages DROP CONSTRAINT IF EXISTS vitrine_pages_social_position_check;
ALTER TABLE vitrine_pages ADD CONSTRAINT vitrine_pages_social_position_check
  CHECK (social_position IN ('top', 'bottom'));

-- O flutuante só pode apontar pra bloco de WhatsApp da MESMA página (a FK
-- sozinha aceitaria bloco de outra escola). Matrícula conta se abre o WhatsApp.
CREATE OR REPLACE FUNCTION public.vitrine_pages_floating_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.floating_block_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.floating_block_id IS NOT DISTINCT FROM OLD.floating_block_id THEN RETURN NEW; END IF;
  IF NOT EXISTS (
       SELECT 1 FROM vitrine_blocks b
        WHERE b.id = NEW.floating_block_id AND b.page_id = NEW.id
          AND (b.type = 'whatsapp' OR (b.type = 'enroll' AND b.config->>'mode' = 'whatsapp'))) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'O botão flutuante precisa usar um bloco de WhatsApp desta página.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vitrine_pages_floating_check ON vitrine_pages;
CREATE TRIGGER vitrine_pages_floating_check
  BEFORE INSERT OR UPDATE OF floating_block_id ON vitrine_pages
  FOR EACH ROW EXECUTE FUNCTION public.vitrine_pages_floating_check();

REVOKE ALL ON FUNCTION public.vitrine_pages_floating_check() FROM PUBLIC, anon, authenticated;

-- ── Página pública: mesmo contrato + 3 campos ────────────────────────────────
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
  v_ctx := jsonb_build_object('phone', nullif(v_phone, ''), 'institution_name', v_inst.name);

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'type', x.type, 'config', x.cfg)
                            ORDER BY x.position, x.created_at), '[]'::jsonb)
    INTO v_blocks
    FROM (
      SELECT b.id, b.type, b.position, b.created_at, public.vitrine_public_block(b.type, b.config, v_ctx) AS cfg
        FROM vitrine_blocks b
       WHERE b.page_id = v_page.id AND b.is_visible
    ) x
   WHERE x.cfg IS NOT NULL;

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
      'social_links',    v_page.social_links,
      'institution_name', v_inst.name,
      -- Flutuante só se o bloco está na página (visível e com número): o
      -- renderizador procura o id na lista de blocos.
      'floating_block_id', v_page.floating_block_id,
      'show_share',      v_page.show_share,
      'social_position', v_page.social_position),
    'blocks', v_blocks);
END;
$$;

REVOKE ALL ON FUNCTION public.vitrine_public_page(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vitrine_public_page(TEXT) TO anon, authenticated;

-- ── Registro de cliques: alvo 'share' ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vitrine_track(
  p_page_id       UUID,
  p_block_id      UUID,
  p_event         TEXT,
  p_visitor_id    UUID,
  p_referrer_host TEXT DEFAULT NULL,
  p_utm_source    TEXT DEFAULT NULL,
  p_utm_medium    TEXT DEFAULT NULL,
  p_utm_campaign  TEXT DEFAULT NULL,
  p_device        TEXT DEFAULT NULL,
  p_target        TEXT DEFAULT NULL
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
  -- view: sem bloco nem alvo. click: num bloco, OU num alvo sem bloco — ícone
  -- da fileira de redes ('social:<rede>') ou o botão compartilhar ('share').
  IF p_event = 'view' AND (p_block_id IS NOT NULL OR p_target IS NOT NULL) THEN RETURN; END IF;
  IF p_event = 'click' AND (p_block_id IS NULL) = (p_target IS NULL) THEN RETURN; END IF;

  SELECT p.institution_id INTO v_inst
    FROM vitrine_pages p
   WHERE p.id = p_page_id AND p.is_published;
  IF v_inst IS NULL THEN RETURN; END IF;

  IF p_target = 'share' THEN
    IF NOT EXISTS (SELECT 1 FROM vitrine_pages p WHERE p.id = p_page_id AND p.show_share) THEN RETURN; END IF;
  ELSIF p_target IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM vitrine_pages p, jsonb_array_elements(p.social_links) s
        WHERE p.id = p_page_id AND p_target = 'social:' || (s->>'network')) THEN
    RETURN;
  END IF;

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
          AND target IS NOT DISTINCT FROM p_target
          AND created_at > now() - CASE WHEN p_event = 'view' THEN interval '30 minutes'
                                        ELSE interval '5 seconds' END) THEN
    RETURN;
  END IF;

  INSERT INTO vitrine_events (institution_id, page_id, block_id, event_type, visitor_id,
                              referrer_host, utm_source, utm_medium, utm_campaign, device, target)
  VALUES (v_inst, p_page_id, p_block_id, p_event, p_visitor_id,
          nullif(left(lower(btrim(coalesce(p_referrer_host, ''))), 100), ''),
          nullif(left(btrim(coalesce(p_utm_source,   '')), 100), ''),
          nullif(left(btrim(coalesce(p_utm_medium,   '')), 100), ''),
          nullif(left(btrim(coalesce(p_utm_campaign, '')), 100), ''),
          CASE WHEN p_device IN ('mobile','tablet','desktop') THEN p_device END,
          p_target);
END;
$$;

REVOKE ALL ON FUNCTION public.vitrine_track(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vitrine_track(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
