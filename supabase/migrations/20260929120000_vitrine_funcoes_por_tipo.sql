-- =============================================================================
-- 20260929120000_vitrine_funcoes_por_tipo.sql
-- Vitrine, Fase 5 / etapa 4 (parte 1): reorganização sem mudar comportamento.
--
-- Antes, vitrine_validate_block e vitrine_public_page tinham um CASE com
-- todos os tipos de bloco — cada tipo novo reescrevia as duas funções
-- inteiras (e uma delas já foi corrompida por isso num gerador). Agora:
--   vitrine_check_<tipo>(config)          → texto do erro, ou NULL se ok
--   vitrine_public_<tipo>(config, ctx)    → JSON público do bloco, ou NULL
--                                           pra omitir (ex.: WhatsApp sem
--                                           número conectado)
-- e as funções gerais só despacham pelo nome (format('%I') protege o
-- identificador; o tipo já vem do CHECK da tabela). Tipo novo = criar as
-- duas funções dele, sem tocar nas gerais.
--
-- ctx da página pública: {"phone": número da escola ou null,
--                         "institution_name": nome da escola}
--
-- Resultado tem que ser IDÊNTICO ao de 20260929110000 — testado em
-- transação desfeita comparando saída antes/depois (validação e página).
-- =============================================================================

-- ── Validação por tipo ───────────────────────────────────────────────────────
-- Texto do botão (link, WhatsApp, matrícula).
CREATE OR REPLACE FUNCTION public.vitrine_check_label(c JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN btrim(coalesce(c->>'label', '')) = '' OR char_length(btrim(coalesce(c->>'label', ''))) > 80
              THEN 'O texto do botão é obrigatório (até 80 caracteres).' END
$$;

CREATE OR REPLACE FUNCTION public.vitrine_check_link(c JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(public.vitrine_check_label(c), CASE
    WHEN NOT public.vitrine_is_https_url(c->>'url') THEN 'Link inválido: use um endereço começando com https://'
    WHEN c ? 'thumbnail_url' AND c->>'thumbnail_url' IS NOT NULL
         AND NOT public.vitrine_is_https_url(c->>'thumbnail_url') THEN 'Imagem do link inválida.'
    WHEN coalesce(c->>'style', 'button') NOT IN ('button','icon','card','featured') THEN 'Estilo do link inválido.'
    WHEN char_length(coalesce(c->>'description', '')) > 120 THEN 'A descrição pode ter no máximo 120 caracteres.'
  END)
$$;

CREATE OR REPLACE FUNCTION public.vitrine_check_banner(c JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN NOT public.vitrine_is_https_url(c->>'image_url') THEN 'Envie a imagem do banner.'
    WHEN coalesce(c->>'aspect', '3:1') NOT IN ('3:1','16:9') THEN 'Formato do banner inválido.'
    WHEN char_length(coalesce(c->>'alt', '')) > 150 THEN 'A descrição da imagem pode ter no máximo 150 caracteres.'
    WHEN c ? 'link_url' AND nullif(c->>'link_url', '') IS NOT NULL
         AND NOT public.vitrine_is_https_url(c->>'link_url') THEN 'Link do banner inválido: use um endereço começando com https://'
  END
$$;

CREATE OR REPLACE FUNCTION public.vitrine_check_whatsapp(c JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(public.vitrine_check_label(c), CASE
    WHEN coalesce(c->>'phone_source', 'school') NOT IN ('school','custom') THEN 'Origem do número inválida.'
    WHEN c->>'phone_source' = 'custom' AND coalesce(c->>'custom_phone', '') !~ '^[0-9]{10,13}$'
      THEN 'Número de WhatsApp inválido: use DDD + número, só dígitos.'
    WHEN char_length(btrim(coalesce(c->>'message', ''))) > 500 THEN 'A mensagem pode ter no máximo 500 caracteres.'
    WHEN coalesce((c->>'track_capture')::boolean, true)
         AND coalesce(c->>'phone_source', 'school') = 'school'
         AND char_length(btrim(coalesce(c->>'message', ''))) < 10
      THEN 'A mensagem precisa ter pelo menos 10 caracteres pra identificar a origem no Captação.'
  END)
$$;

CREATE OR REPLACE FUNCTION public.vitrine_check_enroll(c JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(public.vitrine_check_label(c), CASE
    WHEN coalesce(c->>'mode', '') NOT IN ('link','whatsapp') THEN 'Escolha se o botão abre um link ou o WhatsApp.'
    WHEN c->>'mode' = 'link' AND NOT public.vitrine_is_https_url(c->>'url')
      THEN 'Link de matrícula inválido: use um endereço começando com https://'
    WHEN c->>'mode' = 'whatsapp' AND (char_length(btrim(coalesce(c->>'message', ''))) < 10
                                   OR char_length(btrim(coalesce(c->>'message', ''))) > 500)
      THEN 'A mensagem precisa ter de 10 a 500 caracteres.'
  END)
$$;

CREATE OR REPLACE FUNCTION public.vitrine_check_text(c JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN btrim(coalesce(c->>'body', '')) = '' OR char_length(c->>'body') > 2000 THEN 'O texto é obrigatório (até 2000 caracteres).'
    WHEN char_length(coalesce(c->>'title', '')) > 100 THEN 'O título pode ter no máximo 100 caracteres.'
    WHEN coalesce(c->>'title_size', 'md')      NOT IN ('sm','md','lg')
      OR coalesce(c->>'title_weight', 'bold')  NOT IN ('regular','semibold','bold')
      OR coalesce(c->>'title_color', 'text')   NOT IN ('text','primary')
      OR coalesce(c->>'body_size', 'md')       NOT IN ('sm','md','lg')
      OR coalesce(c->>'align', 'left')         NOT IN ('left','center')
      OR coalesce(c->>'surface', 'card')       NOT IN ('card','plain') THEN 'Opção de estilo do texto inválida.'
  END
$$;

CREATE OR REPLACE FUNCTION public.vitrine_check_gallery(c JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN jsonb_typeof(c->'images') IS DISTINCT FROM 'array'
      OR jsonb_array_length(c->'images') NOT BETWEEN 1 AND 12 THEN 'A galeria precisa ter de 1 a 12 imagens.'
    WHEN coalesce(c->>'layout', 'grid') NOT IN ('grid','carousel') THEN 'Layout da galeria inválido.'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(c->'images') i
                  WHERE NOT public.vitrine_is_https_url(i->>'url')
                     OR char_length(coalesce(i->>'caption', '')) > 150) THEN 'Imagem da galeria inválida.'
  END
$$;

CREATE OR REPLACE FUNCTION public.vitrine_check_video(c JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN NOT ((c->>'provider' = 'youtube' AND coalesce(c->>'video_id', '') ~ '^[A-Za-z0-9_-]{11}$')
           OR (c->>'provider' = 'vimeo'   AND coalesce(c->>'video_id', '') ~ '^[0-9]{6,12}$'))
      THEN 'Vídeo inválido: cole um link do YouTube ou do Vimeo.'
    WHEN char_length(coalesce(c->>'title', '')) > 100 THEN 'O título pode ter no máximo 100 caracteres.'
  END
$$;

CREATE OR REPLACE FUNCTION public.vitrine_check_map(c JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN char_length(btrim(coalesce(c->>'address', ''))) NOT BETWEEN 5 AND 300 THEN 'Informe o endereço (de 5 a 300 caracteres).'
    WHEN char_length(coalesce(c->>'place_name', '')) > 120 THEN 'O nome no Google Maps pode ter no máximo 120 caracteres.'
  END
$$;

CREATE OR REPLACE FUNCTION public.vitrine_check_hours(c JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN jsonb_typeof(c->'days') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'days') > 7 THEN 'Horário inválido.'
    WHEN char_length(coalesce(c->>'note', '')) > 200 THEN 'A observação pode ter no máximo 200 caracteres.'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(c->'days') d
                  WHERE coalesce(d->>'dow', '') !~ '^[0-6]$'
                     OR (NOT coalesce((d->>'closed')::boolean, false)
                         AND (coalesce(d->>'open', '')  !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                           OR coalesce(d->>'close', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')))
      THEN 'Horário inválido: use HH:MM em cada dia aberto.'
  END
$$;

-- Despacho: chama vitrine_check_<tipo>. Tipo sem função = inválido.
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
END;
$$;

-- ── JSON público por tipo ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vitrine_public_whatsapp(c JSONB, ctx JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  -- Sem número conectado (e sem número próprio no bloco): bloco some.
  SELECT CASE WHEN c->>'phone_source' IS DISTINCT FROM 'custom' AND ctx->>'phone' IS NULL THEN NULL
    ELSE jsonb_build_object('label', c->>'label', 'message', c->>'message',
      'phone', CASE WHEN c->>'phone_source' = 'custom' THEN c->>'custom_phone' ELSE ctx->>'phone' END) END
$$;

CREATE OR REPLACE FUNCTION public.vitrine_public_enroll(c JSONB, ctx JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN c->>'mode' = 'link' THEN jsonb_build_object('label', c->>'label', 'mode', 'link', 'url', c->>'url')
    WHEN c->>'mode' = 'whatsapp' AND ctx->>'phone' IS NULL THEN NULL
    ELSE jsonb_build_object('label', c->>'label', 'mode', 'whatsapp', 'message', c->>'message', 'phone', ctx->>'phone')
  END
$$;

CREATE OR REPLACE FUNCTION public.vitrine_public_link(c JSONB, ctx JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('label', c->>'label', 'url', c->>'url', 'thumbnail_url', c->>'thumbnail_url',
    'style', coalesce(c->>'style', 'button'), 'description', c->>'description')
$$;

CREATE OR REPLACE FUNCTION public.vitrine_public_banner(c JSONB, ctx JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('image_url', c->>'image_url', 'aspect', coalesce(c->>'aspect', '3:1'),
    'alt', c->>'alt', 'link_url', nullif(c->>'link_url', ''))
$$;

CREATE OR REPLACE FUNCTION public.vitrine_public_text(c JSONB, ctx JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('title', c->>'title', 'body', c->>'body',
    'title_size', c->>'title_size', 'title_weight', c->>'title_weight',
    'title_color', c->>'title_color', 'body_size', c->>'body_size',
    'align', c->>'align', 'surface', c->>'surface')
$$;

CREATE OR REPLACE FUNCTION public.vitrine_public_gallery(c JSONB, ctx JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('layout', coalesce(c->>'layout', 'grid'),
    'images', (SELECT jsonb_agg(jsonb_build_object('url', i->>'url', 'caption', i->>'caption'))
                 FROM jsonb_array_elements(c->'images') i))
$$;

CREATE OR REPLACE FUNCTION public.vitrine_public_video(c JSONB, ctx JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('provider', c->>'provider', 'video_id', c->>'video_id', 'title', c->>'title')
$$;

-- place_name: ausente = nome da escola; '' = só endereço (ver 20260929080000).
CREATE OR REPLACE FUNCTION public.vitrine_public_map(c JSONB, ctx JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('address', c->>'address', 'label', c->>'label',
    'place_name', CASE WHEN c ? 'place_name' THEN btrim(coalesce(c->>'place_name', '')) ELSE ctx->>'institution_name' END)
$$;

CREATE OR REPLACE FUNCTION public.vitrine_public_hours(c JSONB, ctx JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('days', c->'days', 'note', c->>'note')
$$;

-- Despacho: chama vitrine_public_<tipo>; NULL = bloco fora da página.
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
  RETURN r;
END;
$$;

-- ── Página pública (mesmo contrato de antes) ─────────────────────────────────
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
      'institution_name', v_inst.name),
    'blocks', v_blocks);
END;
$$;

REVOKE ALL ON FUNCTION public.vitrine_public_page(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vitrine_public_page(TEXT) TO anon, authenticated;

-- Funções internas: só as gerais usam (como dono). Sem execução direta.
DO $$
DECLARE f TEXT;
BEGIN
  FOR f IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND (p.proname LIKE 'vitrine\_check\_%' OR p.proname LIKE 'vitrine\_public\_%')
              AND p.proname NOT IN ('vitrine_public_page')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;
