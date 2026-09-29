-- =============================================================================
-- 20260929100000_vitrine_link_card_banner.sql
-- Vitrine, Fase 5 / etapa 2: link em cartão e bloco de banner.
--
-- Link (config novo, opcional):
--   style        button (padrão, como antes) | card | featured
--   description  até 120 caracteres (aparece no cartão)
--   A imagem do cartão é o thumbnail_url que já existia.
--   Redes sociais (Instagram, Facebook...) são reconhecidas pela URL na
--   hora de montar a página — nada muda no banco.
--
-- Banner (tipo novo):
--   image_url  https, obrigatória
--   aspect     3:1 (padrão, 1200×400) | 16:9 (1200×675)
--   alt        texto alternativo, até 150
--   link_url   https opcional (banner clicável, conta clique)
--
-- vitrine_validate_block e vitrine_public_page: só mudam os trechos do link
-- e do banner; o resto é idêntico a 20260929080000.
-- =============================================================================

ALTER TABLE vitrine_blocks DROP CONSTRAINT IF EXISTS vitrine_blocks_type_check;
ALTER TABLE vitrine_blocks ADD CONSTRAINT vitrine_blocks_type_check
  CHECK (type IN ('link','whatsapp','text','gallery','video','map','hours','enroll','banner'));

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
      ELSIF coalesce(c->>'style', 'button') NOT IN ('button','card','featured') THEN
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
                   'title', b.config->>'title', 'body', b.config->>'body')
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
      'institution_name', v_inst.name),
    'blocks', v_blocks);
END;
$$;

REVOKE ALL ON FUNCTION public.vitrine_public_page(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vitrine_public_page(TEXT) TO anon, authenticated;
