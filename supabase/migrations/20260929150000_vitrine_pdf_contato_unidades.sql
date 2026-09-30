-- =============================================================================
-- 20260929150000_vitrine_pdf_contato_unidades.sql
-- Vitrine, Fase 5 / etapa 6: arquivos (PDF e vídeo), bloco PDF, bloco de
-- contato (vCard) e mapa com várias unidades.
--
-- pdf      {label 1–80, file_url https, file_name? ≤120, file_size? bytes,
--           description? ≤120, style?: button|card}
-- contact  {label 1–80, name? ≤100 (vazio = nome da escola),
--           phone_source?: school|custom|none, phone? (custom: 10–13 dígitos),
--           email? ≤120, website? https, address? ≤300}
-- map      + unit_name? ≤80 (nome da unidade principal quando há outras)
--          + units?: [{name 1–80, address 5–300, place_name? ≤120}] 0–4
-- =============================================================================

ALTER TABLE vitrine_blocks DROP CONSTRAINT IF EXISTS vitrine_blocks_type_check;
ALTER TABLE vitrine_blocks ADD CONSTRAINT vitrine_blocks_type_check
  CHECK (type IN ('link','whatsapp','text','gallery','video','map','hours','enroll','banner',
                  'faq','testimonials','team','stats','pdf','contact'));

-- ── PDF ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vitrine_check_pdf(c JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN char_length(btrim(coalesce(c->>'label', ''))) NOT BETWEEN 1 AND 80 THEN 'O texto do botão é obrigatório (até 80 caracteres).'
    WHEN NOT public.vitrine_is_https_url(c->>'file_url') THEN 'Envie o arquivo PDF.'
    WHEN char_length(coalesce(c->>'file_name', '')) > 120 THEN 'Nome do arquivo muito longo.'
    WHEN c ? 'file_size' AND c->'file_size' <> 'null'::jsonb
         AND (jsonb_typeof(c->'file_size') <> 'number' OR (c->>'file_size') !~ '^[0-9]{1,9}$') THEN 'Tamanho do arquivo inválido.'
    WHEN char_length(coalesce(c->>'description', '')) > 120 THEN 'A descrição pode ter no máximo 120 caracteres.'
    WHEN coalesce(c->>'style', 'button') NOT IN ('button','card') THEN 'Estilo do bloco inválido.'
  END
$$;

CREATE OR REPLACE FUNCTION public.vitrine_public_pdf(c JSONB, ctx JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('label', c->>'label', 'file_url', c->>'file_url', 'file_name', nullif(c->>'file_name', ''),
    'file_size', CASE WHEN (c->>'file_size') ~ '^[0-9]{1,9}$' THEN (c->>'file_size')::bigint END,
    'description', nullif(c->>'description', ''), 'style', coalesce(c->>'style', 'button'))
$$;

-- ── Contato (vCard) ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vitrine_check_contact(c JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN char_length(btrim(coalesce(c->>'label', ''))) NOT BETWEEN 1 AND 80 THEN 'O texto do botão é obrigatório (até 80 caracteres).'
    WHEN char_length(coalesce(c->>'name', '')) > 100 THEN 'O nome pode ter no máximo 100 caracteres.'
    WHEN coalesce(c->>'phone_source', 'school') NOT IN ('school','custom','none') THEN 'Origem do telefone inválida.'
    WHEN c->>'phone_source' = 'custom' AND coalesce(c->>'phone', '') !~ '^[0-9]{10,13}$'
      THEN 'Telefone inválido: DDD + número, só dígitos.'
    WHEN nullif(c->>'email', '') IS NOT NULL
         AND (char_length(c->>'email') > 120 OR (c->>'email') !~ '^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$') THEN 'E-mail inválido.'
    WHEN nullif(c->>'website', '') IS NOT NULL AND NOT public.vitrine_is_https_url(c->>'website')
      THEN 'Site inválido: use um endereço começando com https://'
    WHEN char_length(coalesce(c->>'address', '')) > 300 THEN 'O endereço pode ter no máximo 300 caracteres.'
  END
$$;

-- Telefone resolvido (escola, próprio ou nenhum); nome vazio = nome da escola.
-- Diferente do WhatsApp, o bloco aparece mesmo sem telefone (e-mail/site bastam).
CREATE OR REPLACE FUNCTION public.vitrine_public_contact(c JSONB, ctx JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('label', c->>'label',
    'name', coalesce(nullif(btrim(coalesce(c->>'name', '')), ''), ctx->>'institution_name'),
    'phone', CASE coalesce(c->>'phone_source', 'school')
               WHEN 'school' THEN ctx->>'phone'
               WHEN 'custom' THEN c->>'phone' END,
    'email', nullif(btrim(coalesce(c->>'email', '')), ''),
    'website', nullif(c->>'website', ''),
    'address', nullif(btrim(coalesce(c->>'address', '')), ''))
$$;

-- ── Mapa: várias unidades ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vitrine_check_map(c JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN char_length(btrim(coalesce(c->>'address', ''))) NOT BETWEEN 5 AND 300 THEN 'Informe o endereço (de 5 a 300 caracteres).'
    WHEN char_length(coalesce(c->>'place_name', '')) > 120 THEN 'O nome no Google Maps pode ter no máximo 120 caracteres.'
    WHEN char_length(coalesce(c->>'unit_name', '')) > 80 THEN 'O nome da unidade pode ter no máximo 80 caracteres.'
    WHEN c ? 'units' AND (jsonb_typeof(c->'units') <> 'array' OR jsonb_array_length(c->'units') > 4)
      THEN 'Adicione no máximo 4 outras unidades.'
    WHEN c ? 'units' AND EXISTS (SELECT 1 FROM jsonb_array_elements(c->'units') u
                  WHERE char_length(btrim(coalesce(u->>'name', ''))) NOT BETWEEN 1 AND 80
                     OR char_length(btrim(coalesce(u->>'address', ''))) NOT BETWEEN 5 AND 300
                     OR char_length(coalesce(u->>'place_name', '')) > 120)
      THEN 'Toda unidade precisa de nome (até 80) e endereço (de 5 a 300 caracteres).'
  END
$$;

-- place_name ausente = nome da escola (igual à unidade principal, 20260929080000).
CREATE OR REPLACE FUNCTION public.vitrine_public_map(c JSONB, ctx JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('address', c->>'address', 'label', c->>'label',
    'place_name', CASE WHEN c ? 'place_name' THEN btrim(coalesce(c->>'place_name', '')) ELSE ctx->>'institution_name' END,
    'unit_name', nullif(btrim(coalesce(c->>'unit_name', '')), ''),
    'units', coalesce((SELECT jsonb_agg(jsonb_build_object('name', u->>'name', 'address', u->>'address',
               'place_name', CASE WHEN u ? 'place_name' THEN btrim(coalesce(u->>'place_name', '')) ELSE ctx->>'institution_name' END))
             FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c->'units') = 'array' THEN c->'units' ELSE '[]'::jsonb END) u), '[]'::jsonb))
$$;

REVOKE ALL ON FUNCTION public.vitrine_check_pdf(JSONB), public.vitrine_public_pdf(JSONB, JSONB),
  public.vitrine_check_contact(JSONB), public.vitrine_public_contact(JSONB, JSONB),
  public.vitrine_check_map(JSONB), public.vitrine_public_map(JSONB, JSONB)
  FROM PUBLIC, anon, authenticated;

-- ── Storage: PDF e vídeo ─────────────────────────────────────────────────────
-- Buckets separados do de imagens pra o limite de tamanho valer no servidor
-- por tipo (o bucket só tem um limite): PDF até 10 MB, vídeo até 30 MB (capa
-- em vídeo, etapa 8). Mesmo padrão do vitrine-media: público, caminho
-- <institution_id>/<uuid>.<ext>, escrita só na pasta da própria escola.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('vitrine-docs',   'vitrine-docs',   true, 10485760, ARRAY['application/pdf']),
  ('vitrine-videos', 'vitrine-videos', true, 31457280, ARRAY['video/mp4', 'video/webm'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS vitrine_files_school_insert ON storage.objects;
CREATE POLICY vitrine_files_school_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('vitrine-docs', 'vitrine-videos')
    AND public.broadcast_media_institution(name) IS NOT NULL
    AND public.vitrine_user_can_manage(public.broadcast_media_institution(name))
  );

DROP POLICY IF EXISTS vitrine_files_school_delete ON storage.objects;
CREATE POLICY vitrine_files_school_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('vitrine-docs', 'vitrine-videos')
    AND public.broadcast_media_institution(name) IS NOT NULL
    AND public.vitrine_user_can_manage(public.broadcast_media_institution(name))
  );

DROP POLICY IF EXISTS vitrine_files_school_read ON storage.objects;
CREATE POLICY vitrine_files_school_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('vitrine-docs', 'vitrine-videos')
    AND public.broadcast_media_institution(name) IS NOT NULL
    AND public.vitrine_user_can_manage(public.broadcast_media_institution(name))
  );
