-- Transmissões: filtros de Lead, segmentos salvos e inscritos do concurso como contatos.
--
-- 1) lead_grade_key: junta as variações da série de interesse ("6º ano", "EF 6º Ano", "6º Ano EF" → "6º ano EF").
-- 2) broadcast_lead_filter_active / broadcast_resolve_audience / broadcast_audience_page: filtro por Lead
--    (etapa, etapa extra, concurso, origem, série, responsável, turno, ano, escola de origem, indicação, data).
--    O filtro de Lead parte da tabela de leads (só 470 de 1.421 leads têm contato no WhatsApp com o mesmo telefone).
-- 3) broadcast_lead_filter_options: opções de cada filtro com a contagem de leads.
-- 4) broadcast_segments: segmentos salvos (valem para a escola toda).
-- 5) Inscrito do concurso vira contato do WhatsApp com a etiqueta "concurso-<nome>" (novos e já existentes).

-- ── 1. Série de interesse normalizada ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.lead_grade_key(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN s = '' OR s ~ 'n[aã]o informado' THEN 'Não informado'
    WHEN s ~ 'maternal' THEN 'Maternal'
    WHEN s ~ 'infantil' AND substring(s from 'infantil\s+(iv|v|iii|ii|i)(\s|$)') IS NOT NULL
      THEN 'Infantil ' || upper(substring(s from 'infantil\s+(iv|v|iii|ii|i)(\s|$)'))
    WHEN s ~ 'infantil' THEN 'Educação Infantil'
    WHEN s ~ '(s[eé]rie|m[eé]dio|\mem\M)' AND substring(s from '([1-3])') IS NOT NULL
      THEN 'EM ' || substring(s from '([1-3])') || 'ª série'
    WHEN substring(s from '([1-9])') IS NOT NULL THEN substring(s from '([1-9])') || 'º ano EF'
    ELSE btrim(p)
  END
  FROM (SELECT lower(btrim(coalesce(p, ''))) AS s) x
$$;

-- ── 2. Filtro de Lead no público ────────────────────────────────────────────
-- p_filter->'leads' = { statuses[], custom_stage_ids[], contests[], sources[], grades[], assigned[],
--                       shifts[], years[], origin_schools[], referrals[], created_from, created_to }
CREATE OR REPLACE FUNCTION public.broadcast_lead_filter_active(p_filter jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT coalesce(bool_or(
           CASE WHEN jsonb_typeof(v) = 'array' THEN jsonb_array_length(v) > 0
                WHEN jsonb_typeof(v) = 'string' THEN btrim(v #>> '{}') <> ''
                ELSE false END), false)
  FROM jsonb_each(CASE WHEN jsonb_typeof(p_filter->'leads') = 'object' THEN p_filter->'leads' ELSE '{}'::jsonb END) AS e(k, v)
$$;

CREATE OR REPLACE FUNCTION public.broadcast_resolve_audience(p_institution_id uuid, p_filter jsonb, p_import jsonb, p_category text, p_manual jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(contact_id uuid, phone text, name text, variables jsonb, source text, excluded_reason text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH f AS (
    SELECT
      coalesce((p_filter->>'all')::boolean, false)                                                        AS all_contacts,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter->'tags', '[]')))                           AS tags,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter->'contact_types', '[]')))                  AS types,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter->'grades', '[]')))                         AS grades,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter->'relations', '[]')))                      AS relations,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter->'capture_trigger_ids', '[]'))::uuid)      AS triggers,
      nullif(p_filter #>> '{previous_campaign,id}', '')::uuid                                             AS prev_id,
      coalesce(p_filter #>> '{previous_campaign,only}', 'sent')                                           AS prev_only,
      ARRAY(SELECT jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(p_manual->'include_contact_ids') = 'array' THEN p_manual->'include_contact_ids' ELSE '[]' END)::uuid) AS incl,
      ARRAY(SELECT broadcast_phone_key(x) FROM jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(p_manual->'exclude_phone_keys') = 'array' THEN p_manual->'exclude_phone_keys' ELSE '[]' END) x) AS excl,
      -- Filtros de Lead
      broadcast_lead_filter_active(p_filter)                                                              AS lead_any,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter#>'{leads,statuses}', '[]')))               AS l_statuses,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter#>'{leads,custom_stage_ids}', '[]'))::uuid) AS l_custom,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter#>'{leads,contests}', '[]')))               AS l_contests,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter#>'{leads,sources}', '[]')))                AS l_sources,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter#>'{leads,grades}', '[]')))                 AS l_grades,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter#>'{leads,assigned}', '[]')))               AS l_assigned,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter#>'{leads,shifts}', '[]')))                 AS l_shifts,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter#>'{leads,years}', '[]')))                  AS l_years,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter#>'{leads,origin_schools}', '[]')))         AS l_oschools,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter#>'{leads,referrals}', '[]')))              AS l_referrals,
      CASE WHEN p_filter#>>'{leads,created_from}' ~ '^\d{4}-\d{2}-\d{2}$' THEN (p_filter#>>'{leads,created_from}')::date END AS l_from,
      CASE WHEN p_filter#>>'{leads,created_to}'   ~ '^\d{4}-\d{2}-\d{2}$' THEN (p_filter#>>'{leads,created_to}')::date END   AS l_to
  ),
  crit AS (
    SELECT f.*,
           (f.all_contacts OR cardinality(f.tags) > 0 OR cardinality(f.types) > 0
            OR cardinality(f.grades) > 0 OR cardinality(f.triggers) > 0 OR cardinality(f.relations) > 0 OR f.prev_id IS NOT NULL) AS contact_any,
           (f.all_contacts OR f.lead_any OR cardinality(f.tags) > 0 OR cardinality(f.types) > 0
            OR cardinality(f.grades) > 0 OR cardinality(f.triggers) > 0 OR cardinality(f.relations) > 0 OR f.prev_id IS NOT NULL) AS any_criteria
    FROM f
  ),
  prev AS (
    SELECT DISTINCT r.phone_key
    FROM broadcast_recipients r, crit
    WHERE crit.prev_id IS NOT NULL
      AND r.campaign_id = crit.prev_id AND r.institution_id = p_institution_id
      AND CASE crit.prev_only
            WHEN 'replied' THEN r.first_reply_at IS NOT NULL
            WHEN 'clicked' THEN r.clicked_button_index IS NOT NULL
            ELSE r.sent_at IS NOT NULL
          END
  ),
  contacts AS (
    SELECT c.id, c.name, c.phone, c.tags, c.type, c.student_grade, c.origin_capture_trigger_id, c.school_relation, c.school_relation_label,
           broadcast_phone_key(c.phone) AS k
    FROM whatsapp_contacts c
    WHERE c.institution_id = p_institution_id
  ),
  from_filter AS (
    SELECT c.id AS contact_id, regexp_replace(c.phone, '\D', '', 'g') AS phone, c.name,
           '{}'::jsonb AS variables, 'filter'::text AS source, c.k
    FROM contacts c, crit
    WHERE crit.any_criteria AND NOT crit.lead_any
      AND (cardinality(crit.tags)     = 0 OR c.tags && crit.tags)
      AND (cardinality(crit.types)    = 0 OR c.type = ANY(crit.types))
      AND (cardinality(crit.grades)   = 0 OR c.student_grade = ANY(crit.grades))
      AND (cardinality(crit.relations) = 0 OR c.school_relation = ANY(crit.relations) OR ('pendente' = ANY(crit.relations) AND c.school_relation_label LIKE '%pendente'))
      AND (cardinality(crit.triggers) = 0 OR c.origin_capture_trigger_id = ANY(crit.triggers))
      AND (crit.prev_id IS NULL OR c.k IN (SELECT phone_key FROM prev))
  ),
  -- Filtro de Lead: parte da tabela de leads; se também houver filtro de contato (etiqueta, tipo…),
  -- o telefone do lead precisa ter um contato que atenda a esses filtros (os dois valem ao mesmo tempo).
  from_leads AS (
    SELECT NULL::uuid AS contact_id, n.p AS phone,
           coalesce(nullif(btrim(l.responsible_name), ''), nullif(btrim(l.student_name), '')) AS name,
           '{}'::jsonb AS variables, 'filter'::text AS source, broadcast_phone_key(n.p) AS k
    FROM leads l
    CROSS JOIN crit
    CROSS JOIN LATERAL (SELECT regexp_replace(coalesce(l.phone, ''), '\D', '', 'g') AS d) x
    CROSS JOIN LATERAL (SELECT CASE WHEN length(x.d) IN (10, 11) THEN '55' || x.d ELSE x.d END AS p) n
    WHERE crit.lead_any AND l.institution_id = p_institution_id
      AND ((cardinality(crit.l_statuses) = 0 AND cardinality(crit.l_custom) = 0)
           OR l.status = ANY(crit.l_statuses)
           OR (l.custom_stage_id = ANY(crit.l_custom)
               AND EXISTS (SELECT 1 FROM lead_custom_stages cs WHERE cs.id = l.custom_stage_id AND cs.active AND cs.after_stage = l.status)))
      AND (cardinality(crit.l_contests)  = 0 OR l.contest_name = ANY(crit.l_contests))
      AND (cardinality(crit.l_sources)   = 0 OR l.source = ANY(crit.l_sources))
      AND (cardinality(crit.l_grades)    = 0 OR lead_grade_key(l.grade_interest) = ANY(crit.l_grades))
      AND (cardinality(crit.l_assigned)  = 0 OR coalesce(l.assigned_to::text, 'none') = ANY(crit.l_assigned))
      AND (cardinality(crit.l_shifts)    = 0 OR l.shift_interest = ANY(crit.l_shifts))
      AND (cardinality(crit.l_years)     = 0 OR l.year_interest::text = ANY(crit.l_years))
      AND (cardinality(crit.l_oschools)  = 0 OR l.origin_school = ANY(crit.l_oschools))
      AND (cardinality(crit.l_referrals) = 0 OR l.referral_source = ANY(crit.l_referrals))
      AND (crit.l_from IS NULL OR l.created_at::date >= crit.l_from)
      AND (crit.l_to   IS NULL OR l.created_at::date <= crit.l_to)
      AND (NOT crit.contact_any OR EXISTS (
            SELECT 1 FROM contacts c
            WHERE c.k = broadcast_phone_key(n.p)
              AND (cardinality(crit.tags)     = 0 OR c.tags && crit.tags)
              AND (cardinality(crit.types)    = 0 OR c.type = ANY(crit.types))
              AND (cardinality(crit.grades)   = 0 OR c.student_grade = ANY(crit.grades))
              AND (cardinality(crit.relations) = 0 OR c.school_relation = ANY(crit.relations) OR ('pendente' = ANY(crit.relations) AND c.school_relation_label LIKE '%pendente'))
              AND (cardinality(crit.triggers) = 0 OR c.origin_capture_trigger_id = ANY(crit.triggers))
              AND (crit.prev_id IS NULL OR c.k IN (SELECT phone_key FROM prev))))
  ),
  from_manual AS (
    SELECT c.id AS contact_id, regexp_replace(c.phone, '\D', '', 'g') AS phone, c.name,
           '{}'::jsonb AS variables, 'manual'::text AS source, c.k
    FROM contacts c, crit
    WHERE c.id = ANY(crit.incl)
  ),
  from_import AS (
    SELECT NULL::uuid AS contact_id,
           CASE WHEN btrim(coalesce(i->>'phone', '')) !~ '^\+' AND length(x.d) IN (10, 11) THEN '55' || x.d ELSE x.d END AS phone,
           nullif(btrim(i->>'name'), '') AS name,
           CASE WHEN jsonb_typeof(i->'variables') = 'object' THEN i->'variables' ELSE '{}'::jsonb END AS variables,
           'import'::text AS source
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_import) = 'array' THEN p_import ELSE '[]'::jsonb END) i,
    LATERAL (SELECT regexp_replace(coalesce(i->>'phone', ''), '\D', '', 'g') AS d) x
  ),
  candidates AS (
    SELECT contact_id, phone, name, variables, source, k FROM from_filter
    UNION ALL
    SELECT contact_id, phone, name, variables, source, k FROM from_leads
    UNION ALL
    SELECT contact_id, phone, name, variables, source, k FROM from_manual
    UNION ALL
    SELECT fi.contact_id, fi.phone, fi.name, fi.variables, fi.source, broadcast_phone_key(fi.phone) FROM from_import fi
  ),
  dedup AS (
    SELECT DISTINCT ON (c.k) c.*
    FROM candidates c
    ORDER BY c.k, CASE c.source WHEN 'filter' THEN 0 WHEN 'manual' THEN 1 ELSE 2 END,
             (c.name IS NOT NULL AND c.name !~ '^[0-9+ ()-]+$') DESC
  ),
  import_vars AS (
    SELECT DISTINCT ON (broadcast_phone_key(fi.phone)) broadcast_phone_key(fi.phone) AS k, fi.variables
    FROM from_import fi
    WHERE fi.variables <> '{}'::jsonb
  ),
  best_contact AS (
    SELECT DISTINCT ON (c.k) c.k, c.id, c.name
    FROM contacts c
    ORDER BY c.k, (c.name IS NOT NULL AND c.name !~ '^[0-9+ ()-]+$') DESC, c.id
  )
  SELECT
    coalesce(d.contact_id, ct.id)                                        AS contact_id,
    d.phone,
    coalesce(d.name, ct.name)                                            AS name,
    CASE WHEN d.variables = '{}'::jsonb THEN coalesce(iv.variables, '{}'::jsonb) ELSE d.variables END AS variables,
    d.source,
    CASE
      WHEN d.phone !~ '^[0-9]{8,15}$'        THEN 'invalid_phone'
      WHEN d.phone !~ '^55'                  THEN 'non_br'
      WHEN d.phone !~ '^55[1-9][0-9](9[0-9]{8}|[2-9][0-9]{7})$' THEN 'invalid_phone'
      WHEN EXISTS (SELECT 1 FROM broadcast_suppressions s
                   WHERE s.institution_id = p_institution_id AND s.phone_key = d.k AND s.lifted_at IS NULL
                     AND (s.scope = 'all' OR upper(coalesce(p_category, '')) = 'MARKETING'))
                                              THEN 'suppressed'
      WHEN EXISTS (SELECT 1 FROM whatsapp_blacklist b
                   WHERE b.institution_id = p_institution_id AND broadcast_phone_key(b.phone_number) = d.k)
                                              THEN 'blacklisted'
      WHEN d.k = ANY(cr.excl)            THEN 'deselected'
    END                                                                   AS excluded_reason
  FROM dedup d
  CROSS JOIN crit cr
  LEFT JOIN best_contact ct ON d.contact_id IS NULL AND ct.k = d.k
  LEFT JOIN import_vars iv ON iv.k = d.k
$function$;

-- A lista da tela marca "pelo filtro de Lead" para quem veio dele.
CREATE OR REPLACE FUNCTION public.broadcast_audience_page(p_institution_id uuid, p_filter jsonb, p_import jsonb, p_category text, p_manual jsonb, p_q text, p_limit integer, p_offset integer)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH q AS (
    SELECT lower(btrim(coalesce(p_q, ''))) AS txt,
           regexp_replace(coalesce(p_q, ''), '\D', '', 'g') AS dig
  ),
  f AS (
    SELECT
      coalesce((p_filter->>'all')::boolean, false)                                                   AS all_contacts,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter->'tags', '[]')))                      AS tags,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter->'contact_types', '[]')))             AS types,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter->'grades', '[]')))                    AS grades,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter->'capture_trigger_ids', '[]'))::uuid) AS triggers,
      nullif(p_filter #>> '{previous_campaign,id}', '') IS NOT NULL                                  AS has_prev,
      broadcast_lead_filter_active(p_filter)                                                         AS lead_any
  ),
  a AS MATERIALIZED (
    SELECT r.*, broadcast_phone_key(r.phone) AS k
    FROM broadcast_resolve_audience(p_institution_id, p_filter, p_import, p_category, p_manual) r
  ),
  hits AS (
    SELECT a.* FROM a, q
    WHERE q.txt = ''
       OR strpos(lower(coalesce(a.name, '')), q.txt) > 0
       OR (q.dig <> '' AND strpos(a.phone, q.dig) > 0)
  ),
  page AS (
    SELECT h.*,
           CASE WHEN h.source = 'filter' THEN jsonb_strip_nulls(jsonb_build_object(
             'all',        CASE WHEN f.all_contacts THEN true END,
             'lead',       CASE WHEN f.lead_any THEN true END,
             'tags',       CASE WHEN cardinality(f.tags) > 0 THEN to_jsonb(ARRAY(SELECT unnest(c.tags) INTERSECT SELECT unnest(f.tags))) END,
             'type',       CASE WHEN cardinality(f.types) > 0 THEN c.type END,
             'grade',      CASE WHEN cardinality(f.grades) > 0 THEN c.student_grade END,
             'trigger_id', CASE WHEN cardinality(f.triggers) > 0 THEN c.origin_capture_trigger_id END,
             'prev',       CASE WHEN f.has_prev THEN true END
           )) END AS reason
    FROM hits h
    CROSS JOIN f
    LEFT JOIN whatsapp_contacts c ON c.id = h.contact_id AND h.source = 'filter'
    ORDER BY (h.excluded_reason IS NOT NULL AND h.excluded_reason <> 'deselected'),
             lower(h.name) NULLS LAST, h.phone
    LIMIT greatest(1, least(coalesce(p_limit, 50), 200)) OFFSET greatest(0, coalesce(p_offset, 0))
  ),
  outside AS (
    SELECT DISTINCT ON (broadcast_phone_key(c.phone)) c.id, c.name, regexp_replace(c.phone, '\D', '', 'g') AS phone
    FROM whatsapp_contacts c, q
    WHERE c.institution_id = p_institution_id
      AND q.txt <> ''
      AND (strpos(lower(coalesce(c.name, '')), q.txt) > 0
           OR (length(q.dig) >= 4 AND strpos(regexp_replace(c.phone, '\D', '', 'g'), q.dig) > 0))
      AND broadcast_phone_key(c.phone) NOT IN (SELECT k FROM a)
    ORDER BY broadcast_phone_key(c.phone), (c.name IS NOT NULL AND c.name !~ '^[0-9+ ()-]+$') DESC
    LIMIT 20
  )
  SELECT jsonb_build_object(
    'counts', (SELECT jsonb_build_object(
                 'candidates', count(*),
                 'eligible',   count(*) FILTER (WHERE excluded_reason IS NULL),
                 'manual',     count(*) FILTER (WHERE excluded_reason IS NULL AND source = 'manual'),
                 'deselected', count(*) FILTER (WHERE excluded_reason = 'deselected'),
                 'excluded',   coalesce((SELECT jsonb_object_agg(excluded_reason, n) FROM (
                                 SELECT excluded_reason, count(*) AS n FROM a
                                 WHERE excluded_reason IS NOT NULL AND excluded_reason <> 'deselected'
                                 GROUP BY excluded_reason) e), '{}'::jsonb))
               FROM a),
    'total',   (SELECT count(*) FROM hits),
    'rows',    coalesce((SELECT jsonb_agg(jsonb_build_object(
                 'contact_id', p.contact_id, 'phone', p.phone, 'phone_key', p.k, 'name', p.name,
                 'source', p.source, 'excluded_reason', p.excluded_reason, 'reason', p.reason))
               FROM page p), '[]'::jsonb),
    'outside', coalesce((SELECT jsonb_agg(jsonb_build_object('contact_id', o.id, 'name', o.name, 'phone', o.phone)
                                          ORDER BY lower(o.name) NULLS LAST)
               FROM outside o), '[]'::jsonb)
  )
$function$;

-- ── 3. Opções dos filtros de Lead, com contagem ─────────────────────────────
CREATE OR REPLACE FUNCTION public.broadcast_lead_filter_options(p_institution_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH l AS (
    SELECT status, custom_stage_id, contest_name, source, grade_interest, assigned_to,
           shift_interest, year_interest::text AS year_interest, origin_school, referral_source
    FROM leads WHERE institution_id = p_institution_id
  )
  SELECT jsonb_build_object(
    'total',    (SELECT count(*) FROM l),
    'statuses', coalesce((SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) AS n FROM l GROUP BY 1) s), '{}'::jsonb),
    'custom',   coalesce((SELECT jsonb_object_agg(id, n) FROM (
                  SELECT cs.id, count(*) AS n FROM l
                  JOIN lead_custom_stages cs ON cs.id = l.custom_stage_id AND cs.active AND cs.after_stage = l.status
                  GROUP BY cs.id) s), '{}'::jsonb),
    'contests', coalesce((SELECT jsonb_agg(jsonb_build_object('value', v, 'label', v, 'count', n) ORDER BY n DESC, v)
                FROM (SELECT contest_name AS v, count(*) AS n FROM l WHERE nullif(btrim(contest_name), '') IS NOT NULL GROUP BY 1) s), '[]'::jsonb),
    'sources',  coalesce((SELECT jsonb_agg(jsonb_build_object('value', v, 'label', v, 'count', n) ORDER BY n DESC, v)
                FROM (SELECT source AS v, count(*) AS n FROM l WHERE nullif(btrim(source), '') IS NOT NULL GROUP BY 1) s), '[]'::jsonb),
    'grades',   coalesce((SELECT jsonb_agg(jsonb_build_object('value', v, 'label', v, 'count', n) ORDER BY (v = 'Não informado'), n DESC, v)
                FROM (SELECT lead_grade_key(grade_interest) AS v, count(*) AS n FROM l GROUP BY 1) s), '[]'::jsonb),
    'assigned', coalesce((SELECT jsonb_agg(jsonb_build_object('value', coalesce(a.assigned_to::text, 'none'),
                          'label', CASE WHEN a.assigned_to IS NULL THEN 'Sem responsável' ELSE coalesce(u.full_name, 'Usuário removido') END,
                          'count', a.n) ORDER BY (a.assigned_to IS NULL), a.n DESC)
                FROM (SELECT assigned_to, count(*) AS n FROM l GROUP BY 1) a
                LEFT JOIN users u ON u.id = a.assigned_to), '[]'::jsonb),
    'shifts',   coalesce((SELECT jsonb_agg(jsonb_build_object('value', v, 'label', v, 'count', n) ORDER BY n DESC, v)
                FROM (SELECT shift_interest AS v, count(*) AS n FROM l WHERE nullif(btrim(shift_interest), '') IS NOT NULL GROUP BY 1) s), '[]'::jsonb),
    'years',    coalesce((SELECT jsonb_agg(jsonb_build_object('value', v, 'label', v, 'count', n) ORDER BY v DESC)
                FROM (SELECT year_interest AS v, count(*) AS n FROM l WHERE nullif(btrim(year_interest), '') IS NOT NULL GROUP BY 1) s), '[]'::jsonb),
    'origin_schools', coalesce((SELECT jsonb_agg(jsonb_build_object('value', v, 'label', v, 'count', n) ORDER BY n DESC, v)
                FROM (SELECT origin_school AS v, count(*) AS n FROM l WHERE nullif(btrim(origin_school), '') IS NOT NULL GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 300) s), '[]'::jsonb),
    'referrals', coalesce((SELECT jsonb_agg(jsonb_build_object('value', v, 'label', v, 'count', n) ORDER BY n DESC, v)
                FROM (SELECT referral_source AS v, count(*) AS n FROM l WHERE nullif(btrim(referral_source), '') IS NOT NULL GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 300) s), '[]'::jsonb)
  )
$$;

-- ── 4. Segmentos salvos (da escola toda) ────────────────────────────────────
-- Sem política de leitura: a tela passa pela função broadcast-campaigns, que confere a permissão.
CREATE TABLE IF NOT EXISTS public.broadcast_segments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name           text        NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  filter         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_by     uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, name)
);
ALTER TABLE public.broadcast_segments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS broadcast_segments_institution_idx ON public.broadcast_segments (institution_id, created_at DESC);

-- ── 5. Inscrito do concurso vira contato do WhatsApp (com etiqueta) ────────
CREATE OR REPLACE FUNCTION public.contest_candidate_to_contact(c public.contest_candidates)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  d text := regexp_replace(coalesce(c.phone, ''), '\D', '', 'g');
  p text;
  v_tag text;
  v_name text;
BEGIN
  IF c.institution_id IS NULL OR d = '' THEN RETURN; END IF;
  p := CASE WHEN length(d) IN (10, 11) THEN '55' || d ELSE d END;
  IF p !~ '^[0-9]{8,15}$' THEN RETURN; END IF;

  SELECT 'concurso-' || btrim(regexp_replace(
           translate(lower(ct.name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
           '[^a-z0-9]+', '-', 'g'), '-')
    INTO v_tag FROM contests ct WHERE ct.id = c.contest_id;
  v_tag := coalesce(nullif(v_tag, 'concurso-'), 'concurso');
  v_name := coalesce(nullif(btrim(c.responsible_name), ''), nullif(btrim(c.student_name), ''));

  -- Já é contato (com ou sem o 9º dígito): só acrescenta a etiqueta e liga ao lead.
  UPDATE whatsapp_contacts w
     SET tags = CASE WHEN v_tag = ANY(coalesce(w.tags, '{}')) THEN w.tags ELSE array_append(coalesce(w.tags, '{}'), v_tag) END,
         lead_id = coalesce(w.lead_id, c.lead_id)
   WHERE w.institution_id = c.institution_id
     AND broadcast_phone_key(w.phone) = broadcast_phone_key(p)
     AND (NOT (v_tag = ANY(coalesce(w.tags, '{}'))) OR (w.lead_id IS NULL AND c.lead_id IS NOT NULL));

  IF NOT EXISTS (SELECT 1 FROM whatsapp_contacts w
                  WHERE w.institution_id = c.institution_id AND broadcast_phone_key(w.phone) = broadcast_phone_key(p)) THEN
    INSERT INTO whatsapp_contacts (institution_id, phone, name, type, lead_id, tags, student_grade, linked_student_name)
    VALUES (c.institution_id, p, v_name, 'lead', c.lead_id, ARRAY[v_tag], c.grade, nullif(btrim(c.student_name), ''))
    ON CONFLICT (institution_id, phone) DO NOTHING;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.contest_candidate_sync_contact_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM contest_candidate_to_contact(NEW);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS contest_candidate_sync_contact ON public.contest_candidates;
CREATE TRIGGER contest_candidate_sync_contact
  AFTER INSERT OR UPDATE OF phone, lead_id ON public.contest_candidates
  FOR EACH ROW EXECUTE FUNCTION public.contest_candidate_sync_contact_trg();

-- Quem já estava inscrito.
SELECT contest_candidate_to_contact(c) FROM public.contest_candidates c;
