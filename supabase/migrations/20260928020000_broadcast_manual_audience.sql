-- Transmissões — seleção manual de contatos na audiência da campanha.
--
-- O navegador nunca manda a lista de telefones: só filtros + lista importada
-- + ajustes manuais { include_contact_ids: [uuid], exclude_phone_keys: [text] }.
-- O servidor recalcula tudo aqui, então:
--   - incluir à mão só aceita contato da PRÓPRIA escola (o CTE contacts já
--     filtra por instituição) e passa pelo mesmo CASE de exclusão (número
--     inválido, fora do Brasil, opt-out, blacklist) — marcar não fura nada;
--   - dedup continua por phone_key, com prioridade filtro → manual → importado;
--   - desmarcar é por phone_key (tira a pessoa venha de onde vier, 12 ou 13
--     dígitos) e vira o motivo 'deselected', avaliado DEPOIS de supressão e
--     blacklist (o motivo real continua aparecendo).

-- ── 1. Origem 'manual' nos destinatários + auditoria na campanha ────────────
ALTER TABLE broadcast_recipients DROP CONSTRAINT IF EXISTS broadcast_recipients_source_check;
ALTER TABLE broadcast_recipients ADD CONSTRAINT broadcast_recipients_source_check
  CHECK (source IN ('filter','import','manual'));

ALTER TABLE broadcast_campaigns
  ADD COLUMN IF NOT EXISTS audience_manual JSONB NOT NULL DEFAULT '{}'
    CHECK (jsonb_typeof(audience_manual) = 'object');

COMMENT ON COLUMN broadcast_campaigns.audience_manual IS
  'Ajustes manuais da audiência na criação: { include_contact_ids: [uuid], exclude_phone_keys: [text] } (auditoria).';

-- ── 2. broadcast_resolve_audience com p_manual ─────────────────────────────
-- A versão de 4 parâmetros sai (senão a chamada fica ambígua); o endpoint usa
-- argumentos nomeados e p_manual tem default, então o deploy antigo segue
-- funcionando até o novo subir.
DROP FUNCTION IF EXISTS public.broadcast_resolve_audience(UUID, JSONB, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.broadcast_resolve_audience(
  p_institution_id UUID,
  p_filter         JSONB,
  p_import         JSONB,
  p_category       TEXT,
  p_manual         JSONB DEFAULT '{}'
)
RETURNS TABLE (contact_id UUID, phone TEXT, name TEXT, variables JSONB, source TEXT, excluded_reason TEXT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH f AS (
    SELECT
      coalesce((p_filter->>'all')::boolean, false)                                                        AS all_contacts,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter->'tags', '[]')))                           AS tags,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter->'contact_types', '[]')))                  AS types,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter->'grades', '[]')))                         AS grades,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter->'capture_trigger_ids', '[]'))::uuid)      AS triggers,
      nullif(p_filter #>> '{previous_campaign,id}', '')::uuid                                             AS prev_id,
      coalesce(p_filter #>> '{previous_campaign,only}', 'sent')                                           AS prev_only,
      ARRAY(SELECT jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(p_manual->'include_contact_ids') = 'array' THEN p_manual->'include_contact_ids' ELSE '[]' END)::uuid) AS incl,
      ARRAY(SELECT broadcast_phone_key(x) FROM jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(p_manual->'exclude_phone_keys') = 'array' THEN p_manual->'exclude_phone_keys' ELSE '[]' END) x) AS excl
  ),
  crit AS (
    SELECT f.*, (f.all_contacts OR cardinality(f.tags) > 0 OR cardinality(f.types) > 0
                 OR cardinality(f.grades) > 0 OR cardinality(f.triggers) > 0 OR f.prev_id IS NOT NULL) AS any_criteria
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
    SELECT c.id, c.name, c.phone, c.tags, c.type, c.student_grade, c.origin_capture_trigger_id,
           broadcast_phone_key(c.phone) AS k
    FROM whatsapp_contacts c
    WHERE c.institution_id = p_institution_id
  ),
  from_filter AS (
    SELECT c.id AS contact_id, regexp_replace(c.phone, '\D', '', 'g') AS phone, c.name,
           '{}'::jsonb AS variables, 'filter'::text AS source, c.k
    FROM contacts c, crit
    WHERE crit.any_criteria
      AND (cardinality(crit.tags)     = 0 OR c.tags && crit.tags)
      AND (cardinality(crit.types)    = 0 OR c.type = ANY(crit.types))
      AND (cardinality(crit.grades)   = 0 OR c.student_grade = ANY(crit.grades))
      AND (cardinality(crit.triggers) = 0 OR c.origin_capture_trigger_id = ANY(crit.triggers))
      AND (crit.prev_id IS NULL OR c.k IN (SELECT phone_key FROM prev))
  ),
  from_manual AS (
    SELECT c.id AS contact_id, regexp_replace(c.phone, '\D', '', 'g') AS phone, c.name,
           '{}'::jsonb AS variables, 'manual'::text AS source, c.k
    FROM contacts c, crit
    WHERE c.id = ANY(crit.incl)
  ),
  from_import AS (
    SELECT NULL::uuid AS contact_id,
           -- Com '+' na frente = já internacional (não prefixa 55: "+1 415…"
           -- tem 11 dígitos e viraria "celular brasileiro" de mentira).
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
    -- Variáveis da lista importada valem mesmo quando a pessoa também caiu
    -- no filtro/seleção manual (a linha do filtro vence o dedup, mas a
    -- coluna "turma" do CSV não pode sumir por isso).
    CASE WHEN d.variables = '{}'::jsonb THEN coalesce(iv.variables, '{}'::jsonb) ELSE d.variables END AS variables,
    d.source,
    CASE
      WHEN d.phone !~ '^[0-9]{8,15}$'        THEN 'invalid_phone'
      WHEN d.phone !~ '^55'                  THEN 'non_br'
      -- 55 + DDD (11–99) + 9 + 8 dígitos (celular atual) ou 8 dígitos (formato
      -- antigo, sem o 9 — é como 6.9 mil contatos estão gravados, e como a
      -- Meta costuma mandar; o envio normaliza pra 13 dígitos). "+1 415…"
      -- prefixado errado vira 55 14 1555… → 9 dígitos sem o 9 → inválido.
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
  -- Linha importada que já é contato da escola herda id/nome do contato.
  -- (Antes era um LATERAL por linha, que varria todos os contatos a cada
  -- linha — ~9 s numa escola de 7 mil contatos; agora é um join por hash.)
  LEFT JOIN best_contact ct ON d.contact_id IS NULL AND ct.k = d.k
  LEFT JOIN import_vars iv ON iv.k = d.k
$$;

REVOKE ALL ON FUNCTION public.broadcast_resolve_audience(UUID, JSONB, JSONB, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_resolve_audience(UUID, JSONB, JSONB, TEXT, JSONB) TO service_role;

-- ── 3. Página da lista (busca + paginação no servidor) ─────────────────────
-- Uma chamada devolve tudo que a tela precisa: contagens da audiência
-- inteira, a página pedida (filtrada pela busca) com o motivo de cada linha
-- e, se houver busca, contatos da escola que batem e ainda NÃO estão na
-- audiência (pra adicionar à mão). Ordem: quem pode receber (inclusive os
-- desmarcados, que dá pra remarcar) primeiro; bloqueados no fim.
CREATE OR REPLACE FUNCTION public.broadcast_audience_page(
  p_institution_id UUID,
  p_filter         JSONB,
  p_import         JSONB,
  p_category       TEXT,
  p_manual         JSONB,
  p_q              TEXT,
  p_limit          INTEGER,
  p_offset         INTEGER
)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
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
      nullif(p_filter #>> '{previous_campaign,id}', '') IS NOT NULL                                  AS has_prev
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
           -- Motivo "pelo filtro": o que do contato bateu com os critérios ativos.
           CASE WHEN h.source = 'filter' THEN jsonb_strip_nulls(jsonb_build_object(
             'all',        CASE WHEN f.all_contacts THEN true END,
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
$$;

REVOKE ALL ON FUNCTION public.broadcast_audience_page(UUID, JSONB, JSONB, TEXT, JSONB, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_audience_page(UUID, JSONB, JSONB, TEXT, JSONB, TEXT, INTEGER, INTEGER) TO service_role;
