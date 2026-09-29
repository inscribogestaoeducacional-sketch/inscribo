-- =============================================================================
-- 20260929130000_vitrine_faq_depoimentos_equipe_video.sql
-- Vitrine, Fase 5 / etapa 4 (parte 2): blocos novos e vídeo em destaque.
-- Usa o despacho por tipo de 20260929120000: cada tipo = vitrine_check_<tipo>
-- + vitrine_public_<tipo>; as funções gerais não mudam.
--
-- faq           {title?, items:[{q, a}]}                    1–20 perguntas
-- testimonials  {title?, items:[{quote, name, role?, photo_url?, rating?}]}  1–12
-- team          {title?, layout: grid|carousel,
--                items:[{name, role?, photo_url?, bio?}]}    1–24 pessoas
-- video (novo)  size: normal|featured, format: 16:9|9:16, description?
-- =============================================================================

ALTER TABLE vitrine_blocks DROP CONSTRAINT IF EXISTS vitrine_blocks_type_check;
ALTER TABLE vitrine_blocks ADD CONSTRAINT vitrine_blocks_type_check
  CHECK (type IN ('link','whatsapp','text','gallery','video','map','hours','enroll','banner',
                  'faq','testimonials','team'));

-- ── FAQ ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vitrine_check_faq(c JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN char_length(coalesce(c->>'title', '')) > 100 THEN 'O título pode ter no máximo 100 caracteres.'
    WHEN jsonb_typeof(c->'items') IS DISTINCT FROM 'array'
      OR jsonb_array_length(c->'items') NOT BETWEEN 1 AND 20 THEN 'Adicione de 1 a 20 perguntas.'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(c->'items') i
                  WHERE char_length(btrim(coalesce(i->>'q', ''))) NOT BETWEEN 1 AND 200)
      THEN 'Toda pergunta precisa de texto (até 200 caracteres).'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(c->'items') i
                  WHERE char_length(btrim(coalesce(i->>'a', ''))) NOT BETWEEN 1 AND 1000)
      THEN 'Toda pergunta precisa de resposta (até 1000 caracteres).'
  END
$$;

CREATE OR REPLACE FUNCTION public.vitrine_public_faq(c JSONB, ctx JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('title', c->>'title',
    'items', (SELECT jsonb_agg(jsonb_build_object('q', i->>'q', 'a', i->>'a')) FROM jsonb_array_elements(c->'items') i))
$$;

-- ── Depoimentos ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vitrine_check_testimonials(c JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN char_length(coalesce(c->>'title', '')) > 100 THEN 'O título pode ter no máximo 100 caracteres.'
    WHEN jsonb_typeof(c->'items') IS DISTINCT FROM 'array'
      OR jsonb_array_length(c->'items') NOT BETWEEN 1 AND 12 THEN 'Adicione de 1 a 12 depoimentos.'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(c->'items') i
                  WHERE char_length(btrim(coalesce(i->>'quote', ''))) NOT BETWEEN 1 AND 400)
      THEN 'Todo depoimento precisa de texto (até 400 caracteres).'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(c->'items') i
                  WHERE char_length(btrim(coalesce(i->>'name', ''))) NOT BETWEEN 1 AND 60
                     OR char_length(coalesce(i->>'role', '')) > 60)
      THEN 'Informe o nome (até 60 caracteres) de quem deu o depoimento.'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(c->'items') i
                  WHERE (i ? 'photo_url' AND nullif(i->>'photo_url', '') IS NOT NULL AND NOT public.vitrine_is_https_url(i->>'photo_url'))
                     OR (i ? 'rating' AND i->'rating' <> 'null'::jsonb AND coalesce(i->>'rating', '') !~ '^[1-5]$'))
      THEN 'Foto ou nota do depoimento inválida.'
  END
$$;

CREATE OR REPLACE FUNCTION public.vitrine_public_testimonials(c JSONB, ctx JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('title', c->>'title',
    'items', (SELECT jsonb_agg(jsonb_build_object('quote', i->>'quote', 'name', i->>'name', 'role', i->>'role',
                'photo_url', nullif(i->>'photo_url', ''), 'rating', CASE WHEN i->>'rating' ~ '^[1-5]$' THEN (i->>'rating')::int END))
              FROM jsonb_array_elements(c->'items') i))
$$;

-- ── Equipe ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vitrine_check_team(c JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN char_length(coalesce(c->>'title', '')) > 100 THEN 'O título pode ter no máximo 100 caracteres.'
    WHEN coalesce(c->>'layout', 'grid') NOT IN ('grid','carousel') THEN 'Layout da equipe inválido.'
    WHEN jsonb_typeof(c->'items') IS DISTINCT FROM 'array'
      OR jsonb_array_length(c->'items') NOT BETWEEN 1 AND 24 THEN 'Adicione de 1 a 24 pessoas.'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(c->'items') i
                  WHERE char_length(btrim(coalesce(i->>'name', ''))) NOT BETWEEN 1 AND 60
                     OR char_length(coalesce(i->>'role', '')) > 60
                     OR char_length(coalesce(i->>'bio', '')) > 160)
      THEN 'Toda pessoa precisa de nome (até 60); cargo até 60 e frase até 160 caracteres.'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(c->'items') i
                  WHERE i ? 'photo_url' AND nullif(i->>'photo_url', '') IS NOT NULL AND NOT public.vitrine_is_https_url(i->>'photo_url'))
      THEN 'Foto da equipe inválida.'
  END
$$;

CREATE OR REPLACE FUNCTION public.vitrine_public_team(c JSONB, ctx JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('title', c->>'title', 'layout', coalesce(c->>'layout', 'grid'),
    'items', (SELECT jsonb_agg(jsonb_build_object('name', i->>'name', 'role', i->>'role',
                'photo_url', nullif(i->>'photo_url', ''), 'bio', i->>'bio'))
              FROM jsonb_array_elements(c->'items') i))
$$;

-- ── Vídeo: destaque, vertical e descrição ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.vitrine_check_video(c JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN NOT ((c->>'provider' = 'youtube' AND coalesce(c->>'video_id', '') ~ '^[A-Za-z0-9_-]{11}$')
           OR (c->>'provider' = 'vimeo'   AND coalesce(c->>'video_id', '') ~ '^[0-9]{6,12}$'))
      THEN 'Vídeo inválido: cole um link do YouTube ou do Vimeo.'
    WHEN char_length(coalesce(c->>'title', '')) > 100 THEN 'O título pode ter no máximo 100 caracteres.'
    WHEN coalesce(c->>'size', 'normal') NOT IN ('normal','featured') THEN 'Tamanho do vídeo inválido.'
    WHEN coalesce(c->>'format', '16:9') NOT IN ('16:9','9:16') THEN 'Formato do vídeo inválido.'
    WHEN char_length(coalesce(c->>'description', '')) > 200 THEN 'A descrição pode ter no máximo 200 caracteres.'
  END
$$;

CREATE OR REPLACE FUNCTION public.vitrine_public_video(c JSONB, ctx JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('provider', c->>'provider', 'video_id', c->>'video_id', 'title', c->>'title',
    'size', coalesce(c->>'size', 'normal'), 'format', coalesce(c->>'format', '16:9'), 'description', c->>'description')
$$;

-- Internas: sem execução direta (as gerais chamam como dono).
REVOKE ALL ON FUNCTION public.vitrine_check_faq(JSONB), public.vitrine_check_testimonials(JSONB),
  public.vitrine_check_team(JSONB), public.vitrine_check_video(JSONB),
  public.vitrine_public_faq(JSONB, JSONB), public.vitrine_public_testimonials(JSONB, JSONB),
  public.vitrine_public_team(JSONB, JSONB), public.vitrine_public_video(JSONB, JSONB)
  FROM PUBLIC, anon, authenticated;
