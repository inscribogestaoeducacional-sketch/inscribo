-- =============================================================================
-- 20260929110000_vitrine_ajustes_redes_texto_logo.sql
-- Vitrine: ajustes pedidos antes da etapa 3 da Fase 5.
--
-- 1. Redes sociais no topo (seção fixa, separada dos blocos):
--    vitrine_pages.social_links = [{network, handle}] — a escola digita só o
--    perfil; a página monta o link. Redes: instagram, facebook, whatsapp, tiktok, youtube, linkedin, x, threads, telegram.
--    theme.social_style: brand (bolinhas nas cores das marcas) | theme (na
--    cor da escola) | plain (só o ícone).
--    Clique nos ícones do topo conta em vitrine_events.target
--    ('social:<rede>'), sem bloco — vitrine_track ganha p_target.
-- 2. Link: style 'icon' (bolinha da rede), escolhido pela escola — não há
--    mais conversão automática de botão em ícone.
-- 3. Logo: theme.logo_shape 'none' (sem moldura — PNG transparente).
-- 4. Texto: title_size, title_weight, title_color, body_size, align, surface.
-- Funções recriadas a partir das versões anteriores, mudando só esses trechos.
-- =============================================================================

ALTER TABLE vitrine_pages ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE vitrine_events ADD COLUMN IF NOT EXISTS target TEXT;

CREATE OR REPLACE FUNCTION public.vitrine_pages_validate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_theme  JSONB := NEW.theme;
  v_bad    TEXT;
  v_item   JSONB;
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
  -- Só chaves conhecidas (tudo aqui vira CSS na página pública).
  SELECT string_agg(k, ', ') INTO v_bad FROM jsonb_object_keys(v_theme) k
   WHERE k NOT IN ('primary','background','text','button_style','radius','font','font_pair',
                   'bg_type','bg_gradient_to','bg_gradient_angle','bg_image_url','bg_overlay','bg_overlay_tone',
                   'shadow','spacing','card_style','logo_shape','animation','template','social_style');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Opção de aparência desconhecida: ' || v_bad;
  END IF;
  IF (v_theme ? 'primary'        AND coalesce(v_theme->>'primary', '')        !~ '^#[0-9A-Fa-f]{6}$')
  OR (v_theme ? 'background'     AND coalesce(v_theme->>'background', '')     !~ '^#[0-9A-Fa-f]{6}$')
  OR (v_theme ? 'text'           AND coalesce(v_theme->>'text', '')           !~ '^#[0-9A-Fa-f]{6}$')
  OR (v_theme ? 'bg_gradient_to' AND coalesce(v_theme->>'bg_gradient_to', '') !~ '^#[0-9A-Fa-f]{6}$') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Cor inválida (use o formato #RRGGBB).';
  END IF;
  IF (v_theme ? 'button_style' AND coalesce(v_theme->>'button_style', '') NOT IN ('filled','outline','soft','glass','shadow','minimal')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Estilo de botão inválido.';
  END IF;
  IF (v_theme ? 'radius' AND coalesce(v_theme->>'radius', '') NOT IN ('0','8','16','999')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Arredondamento inválido.';
  END IF;
  -- font: fonte única da primeira versão (páginas antigas); font_pair: pares
  -- prontos (título + texto) da Fase 5 — quando existe, vale ele.
  IF (v_theme ? 'font' AND coalesce(v_theme->>'font', '') NOT IN ('Inter','Poppins','Montserrat','Nunito','Lora','Playfair Display')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Fonte inválida.';
  END IF;
  IF (v_theme ? 'font_pair' AND coalesce(v_theme->>'font_pair', '') NOT IN ('inter','jakarta','poppins','playfair-inter','merriweather-dmsans','fredoka-nunito','montserrat-sourcesans','dmserif-dmsans')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Par de fontes inválido.';
  END IF;
  IF (v_theme ? 'bg_type' AND coalesce(v_theme->>'bg_type', '') NOT IN ('solid','gradient','image'))
  OR (v_theme ? 'bg_gradient_angle' AND coalesce(v_theme->>'bg_gradient_angle', '') NOT IN ('0','45','90','135','180'))
  OR (v_theme ? 'bg_overlay' AND coalesce(v_theme->>'bg_overlay', '') NOT IN ('0','10','20','30','40','50','60','70','80'))
  OR (v_theme ? 'bg_overlay_tone' AND coalesce(v_theme->>'bg_overlay_tone', '') NOT IN ('dark','light')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Opção de fundo inválida.';
  END IF;
  IF v_theme ? 'bg_image_url' AND v_theme->>'bg_image_url' IS NOT NULL
     AND (NOT public.vitrine_is_https_url(v_theme->>'bg_image_url')
          -- vai dentro de url('...') no CSS: sem aspas, parênteses, chaves,
          -- ponto e vírgula nem barra invertida (URL do Storage nunca tem).
          OR v_theme->>'bg_image_url' ~ '["''(){};\\]') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Endereço da imagem de fundo inválido.';
  END IF;
  IF (v_theme ? 'shadow' AND coalesce(v_theme->>'shadow', '') NOT IN ('none','soft','strong'))
  OR (v_theme ? 'spacing' AND coalesce(v_theme->>'spacing', '') NOT IN ('compact','normal','relaxed'))
  OR (v_theme ? 'card_style' AND coalesce(v_theme->>'card_style', '') NOT IN ('flat','bordered','elevated'))
  OR (v_theme ? 'logo_shape' AND coalesce(v_theme->>'logo_shape', '') NOT IN ('circle','rounded','none'))
  OR (v_theme ? 'social_style' AND coalesce(v_theme->>'social_style', '') NOT IN ('brand','theme','plain'))
  OR (v_theme ? 'animation' AND coalesce(v_theme->>'animation', '') NOT IN ('none','subtle','lively'))
  OR (v_theme ? 'template' AND coalesce(v_theme->>'template', '') NOT IN ('essencial','vibrante','institucional','matriculas')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Opção de aparência inválida.';
  END IF;

  -- Redes sociais do topo: [{network, handle}], até 12, uma por rede. O link
  -- é montado na página a partir do perfil (nunca URL livre).
  IF jsonb_typeof(NEW.social_links) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Redes sociais inválidas.';
  ELSIF jsonb_array_length(NEW.social_links) > 12 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Redes sociais: no máximo 12.';
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.social_links) LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
       OR coalesce(v_item->>'network', '') NOT IN ('instagram','facebook','whatsapp','tiktok','youtube','linkedin','x','threads','telegram') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Rede social inválida.';
    END IF;
    IF (v_item->>'network' = 'whatsapp' AND coalesce(v_item->>'handle', '') !~ '^[0-9]{10,13}$')
       OR (v_item->>'network' <> 'whatsapp'
           AND coalesce(v_item->>'handle', '') !~ '^[A-Za-z0-9._-]{1,60}(/[A-Za-z0-9._-]{1,60})?$') THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'Perfil inválido em ' || (v_item->>'network') || ': use só o nome de usuário (ou o número, no WhatsApp).';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM jsonb_array_elements(NEW.social_links) x)
     <> (SELECT count(DISTINCT x->>'network') FROM jsonb_array_elements(NEW.social_links) x) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Cada rede social só pode aparecer uma vez.';
  END IF;

  IF NEW.is_published AND (TG_OP = 'INSERT' OR NOT OLD.is_published) THEN
    NEW.published_at := now();
  END IF;

  RETURN NEW;
END;
$$;

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
      ELSIF coalesce(c->>'style', 'button') NOT IN ('button','icon','card','featured') THEN
        e := 'Estilo do link inválido.';
      ELSIF char_length(coalesce(c->>'description', '')) > 120 THEN
        e := 'A descrição pode ter no máximo 120 caracteres.';
      END IF;

    WHEN 'banner' THEN
      IF NOT public.vitrine_is_https_url(c->>'image_url') THEN
        e := 'Envie a imagem do banner.';
      ELSIF coalesce(c->>'aspect', '3:1') NOT IN ('3:1','16:9') THEN
        e := 'Formato do banner inválido.';
      ELSIF char_length(coalesce(c->>'alt', '')) > 150 THEN
        e := 'A descrição da imagem pode ter no máximo 150 caracteres.';
      ELSIF c ? 'link_url' AND nullif(c->>'link_url', '') IS NOT NULL
            AND NOT public.vitrine_is_https_url(c->>'link_url') THEN
        e := 'Link do banner inválido: use um endereço começando com https://';
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
      ELSIF coalesce(c->>'title_size', 'md')      NOT IN ('sm','md','lg')
         OR coalesce(c->>'title_weight', 'bold')  NOT IN ('regular','semibold','bold')
         OR coalesce(c->>'title_color', 'text')   NOT IN ('text','primary')
         OR coalesce(c->>'body_size', 'md')       NOT IN ('sm','md','lg')
         OR coalesce(c->>'align', 'left')         NOT IN ('left','center')
         OR coalesce(c->>'surface', 'card')       NOT IN ('card','plain') THEN
        e := 'Opção de estilo do texto inválida.';
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
      ELSIF char_length(coalesce(c->>'place_name', '')) > 120 THEN
        e := 'O nome no Google Maps pode ter no máximo 120 caracteres.';
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
                   'thumbnail_url', b.config->>'thumbnail_url',
                   'style', coalesce(b.config->>'style', 'button'),
                   'description', b.config->>'description')
                 WHEN 'banner' THEN jsonb_build_object(
                   'image_url', b.config->>'image_url',
                   'aspect', coalesce(b.config->>'aspect', '3:1'),
                   'alt', b.config->>'alt',
                   'link_url', nullif(b.config->>'link_url', ''))
                 WHEN 'text' THEN jsonb_build_object(
                   'title', b.config->>'title', 'body', b.config->>'body',
                   'title_size', b.config->>'title_size', 'title_weight', b.config->>'title_weight',
                   'title_color', b.config->>'title_color', 'body_size', b.config->>'body_size',
                   'align', b.config->>'align', 'surface', b.config->>'surface')
                 WHEN 'gallery' THEN jsonb_build_object(
                   'layout', coalesce(b.config->>'layout', 'grid'),
                   'images', (SELECT jsonb_agg(jsonb_build_object('url', i->>'url', 'caption', i->>'caption'))
                                FROM jsonb_array_elements(b.config->'images') i))
                 WHEN 'video' THEN jsonb_build_object(
                   'provider', b.config->>'provider', 'video_id', b.config->>'video_id',
                   'title', b.config->>'title')
                 -- place_name: ausente = usar o nome da escola; '' = só endereço
                 -- (a busca "nome, endereço" põe o pino no ponto da escola no
                 -- Google; só o endereço cai onde o Google estima o número).
                 WHEN 'map' THEN jsonb_build_object(
                   'address', b.config->>'address', 'label', b.config->>'label',
                   'place_name', CASE WHEN b.config ? 'place_name'
                                        THEN btrim(coalesce(b.config->>'place_name', ''))
                                        ELSE v_inst.name END)
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
      'social_links',    v_page.social_links,
      'institution_name', v_inst.name),
    'blocks', v_blocks);
END;
$$;

REVOKE ALL ON FUNCTION public.vitrine_public_page(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vitrine_public_page(TEXT) TO anon, authenticated;

-- Assinatura nova (p_target): a antiga sai pra não haver duas versões.
-- Páginas em cache chamam por nome sem p_target e caem no padrão NULL.
DROP FUNCTION IF EXISTS public.vitrine_track(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT);
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
  -- view: sem bloco nem alvo. click: num bloco, OU num ícone da fileira de
  -- redes do topo (alvo 'social:<rede>', sem bloco).
  IF p_event = 'view' AND (p_block_id IS NOT NULL OR p_target IS NOT NULL) THEN RETURN; END IF;
  IF p_event = 'click' AND (p_block_id IS NULL) = (p_target IS NULL) THEN RETURN; END IF;

  SELECT p.institution_id INTO v_inst
    FROM vitrine_pages p
   WHERE p.id = p_page_id AND p.is_published;
  IF v_inst IS NULL THEN RETURN; END IF;

  IF p_target IS NOT NULL AND NOT EXISTS (
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
