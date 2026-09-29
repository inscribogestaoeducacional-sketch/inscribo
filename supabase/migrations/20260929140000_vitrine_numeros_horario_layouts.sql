-- =============================================================================
-- 20260929140000_vitrine_numeros_horario_layouts.sql
-- Vitrine, Fase 5 / etapa 5: bloco "Números" (contador) e layouts do horário.
-- Pelo despacho por tipo (20260929120000): só as funções do tipo mudam.
--
-- stats  {title?, animate?: bool,
--         items:[{value: 0–9.999.999 (até 1 casa decimal), prefix? ≤4,
--                 suffix? ≤12, label 1–60}]}          1–6 números
-- hours  + layout: table (padrão, como antes) | compact | today
-- =============================================================================

ALTER TABLE vitrine_blocks DROP CONSTRAINT IF EXISTS vitrine_blocks_type_check;
ALTER TABLE vitrine_blocks ADD CONSTRAINT vitrine_blocks_type_check
  CHECK (type IN ('link','whatsapp','text','gallery','video','map','hours','enroll','banner',
                  'faq','testimonials','team','stats'));

-- ── Números ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vitrine_check_stats(c JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN char_length(coalesce(c->>'title', '')) > 100 THEN 'O título pode ter no máximo 100 caracteres.'
    WHEN c ? 'animate' AND jsonb_typeof(c->'animate') <> 'boolean' THEN 'Opção de animação inválida.'
    WHEN jsonb_typeof(c->'items') IS DISTINCT FROM 'array'
      OR jsonb_array_length(c->'items') NOT BETWEEN 1 AND 6 THEN 'Adicione de 1 a 6 números.'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(c->'items') i
                  WHERE jsonb_typeof(i->'value') IS DISTINCT FROM 'number'
                     OR (i->>'value') !~ '^[0-9]{1,7}(\.[0-9])?$')
      THEN 'Todo número precisa de um valor (de 0 a 9.999.999, até 1 casa decimal).'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(c->'items') i
                  WHERE char_length(btrim(coalesce(i->>'label', ''))) NOT BETWEEN 1 AND 60)
      THEN 'Todo número precisa de uma legenda (até 60 caracteres).'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(c->'items') i
                  WHERE char_length(coalesce(i->>'prefix', '')) > 4 OR char_length(coalesce(i->>'suffix', '')) > 12)
      THEN 'Antes do número: até 4 caracteres; depois: até 12.'
  END
$$;

CREATE OR REPLACE FUNCTION public.vitrine_public_stats(c JSONB, ctx JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('title', c->>'title', 'animate', coalesce((c->>'animate')::boolean, true),
    'items', (SELECT jsonb_agg(jsonb_build_object('value', i->'value', 'prefix', nullif(i->>'prefix', ''),
                'suffix', nullif(i->>'suffix', ''), 'label', i->>'label'))
              FROM jsonb_array_elements(c->'items') i))
$$;

-- ── Horário: layout ──────────────────────────────────────────────────────────
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
    WHEN coalesce(c->>'layout', 'table') NOT IN ('table','compact','today') THEN 'Layout do horário inválido.'
  END
$$;

CREATE OR REPLACE FUNCTION public.vitrine_public_hours(c JSONB, ctx JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('days', c->'days', 'note', c->>'note', 'layout', coalesce(c->>'layout', 'table'))
$$;

-- Internas: sem execução direta (as gerais chamam como dono).
REVOKE ALL ON FUNCTION public.vitrine_check_stats(JSONB), public.vitrine_public_stats(JSONB, JSONB),
  public.vitrine_check_hours(JSONB), public.vitrine_public_hours(JSONB, JSONB)
  FROM PUBLIC, anon, authenticated;
