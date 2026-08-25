-- =============================================================================
-- 20260821030000_merge_kinship_placeholder_duplicates.sql
-- Merge automático de um subconjunto SEGURO e ESTREITO dos 432 grupos de
-- whatsapp_contacts duplicados (mesmo institution_id + telefone normalizado)
-- causados pelo bug de normalização já corrigido em
-- 20260821020000_fix_sync_contact_phone_normalization.sql.
--
-- Padrão qualificador (confirmado por SELECT antes de aplicar, 139 dos 432
-- grupos batem): dentro do par, uma linha ("placeholder") tem SIMULTANEAMENTE
--   1. name (case-insensitive, trim) em ('filho','filha','filhos','filhas',
--      'neto','neta','irmã','irmão','sobrinho','sobrinha')
--   2. tags vazias/null
--   3. created_at dentro de ±1s de 2026-05-20 23:27:40.659957+00 (lote de
--      seed em massa confirmado — 277 linhas nesse timestamp exato; outros
--      lotes maiores existem em 2026-06-10 e 2026-08-20 e foram
--      deliberadamente EXCLUÍDOS deste critério)
-- Confirmado por SELECT prévio: 0 grupos com ambas as linhas batendo no
-- padrão (ambíguo), 0 grupos com lead_id divergente nos dois lados — logo
-- nenhum grupo foi excluído pela regra 4 (lead_id conflitante) na prática.
--
-- Ação por grupo qualificado:
--   1. Copia lead_id da linha placeholder pra linha real, SE a real estiver
--      com lead_id nulo (confirmado: os 139 casos precisam dessa cópia).
--   2. Registra o merge em whatsapp_contacts_merge_log (auditoria).
--   3. Deleta a linha placeholder.
--
-- Todo o resto (293 grupos restantes: categoria d inteira, e os b/c com
-- nomes genuinamente diferentes, não-placeholder) fica intocado.
-- =============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_contacts_merge_log (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id        UUID        NOT NULL,
  norm_phone            TEXT        NOT NULL,
  discarded_contact_id  UUID        NOT NULL,
  surviving_contact_id  UUID        NOT NULL,
  lead_id_copied        UUID,
  merge_reason          TEXT        NOT NULL DEFAULT 'auto_merge_kinship_placeholder_seed_batch',
  merged_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

WITH grouped AS (
  SELECT
    id, institution_id, phone, name, tags, lead_id, created_at,
    normalize_phone_br(phone) AS norm_phone,
    COUNT(*) OVER (PARTITION BY institution_id, normalize_phone_br(phone)) AS group_size
  FROM whatsapp_contacts
  WHERE institution_id IS NOT NULL
),
dup_groups AS (
  SELECT * FROM grouped WHERE group_size > 1
),
flagged AS (
  SELECT
    *,
    lower(trim(name)) IN ('filho','filha','filhos','filhas','neto','neta','irmã','irmão','sobrinho','sobrinha') AS is_kinship_name,
    (tags IS NULL OR cardinality(tags) = 0) AS tags_empty,
    (created_at BETWEEN '2026-05-20 23:27:39.659957+00' AND '2026-05-20 23:27:41.659957+00') AS in_seed_window
  FROM dup_groups
),
per_row AS (
  SELECT *, (is_kinship_name AND tags_empty AND in_seed_window) AS is_placeholder
  FROM flagged
),
per_group AS (
  SELECT
    institution_id, norm_phone,
    count(*) FILTER (WHERE is_placeholder) AS placeholder_count,
    count(distinct lead_id) FILTER (WHERE lead_id IS NOT NULL) AS distinct_leads
  FROM per_row
  GROUP BY institution_id, norm_phone
  HAVING count(*) FILTER (WHERE is_placeholder) = 1
     AND count(distinct lead_id) FILTER (WHERE lead_id IS NOT NULL) <= 1
),
pairs AS (
  SELECT
    pg.institution_id,
    pg.norm_phone,
    (SELECT pr.id      FROM per_row pr WHERE pr.institution_id = pg.institution_id AND pr.norm_phone = pg.norm_phone AND pr.is_placeholder)     AS placeholder_id,
    (SELECT pr.lead_id FROM per_row pr WHERE pr.institution_id = pg.institution_id AND pr.norm_phone = pg.norm_phone AND pr.is_placeholder)     AS placeholder_lead_id,
    (SELECT pr.id      FROM per_row pr WHERE pr.institution_id = pg.institution_id AND pr.norm_phone = pg.norm_phone AND NOT pr.is_placeholder) AS real_id
  FROM per_group pg
),
valid_pairs AS (
  SELECT * FROM pairs WHERE placeholder_id IS NOT NULL AND real_id IS NOT NULL
),
-- NOTA: as 3 CTEs abaixo (copy_lead, write_log, do_delete) só executam seus
-- efeitos porque são referenciadas explicitamente na SELECT final — uma CTE
-- de escrita não referenciada em lugar nenhum não é garantida de rodar no
-- Postgres.
copy_lead AS (
  UPDATE whatsapp_contacts wc
  SET lead_id = vp.placeholder_lead_id
  FROM valid_pairs vp
  WHERE wc.id = vp.real_id
    AND wc.lead_id IS NULL
    AND vp.placeholder_lead_id IS NOT NULL
  RETURNING wc.id
),
write_log AS (
  INSERT INTO whatsapp_contacts_merge_log
    (institution_id, norm_phone, discarded_contact_id, surviving_contact_id, lead_id_copied)
  SELECT institution_id, norm_phone, placeholder_id, real_id, placeholder_lead_id
  FROM valid_pairs
  RETURNING id
),
do_delete AS (
  DELETE FROM whatsapp_contacts
  WHERE id IN (SELECT placeholder_id FROM valid_pairs)
  RETURNING id
)
SELECT
  (SELECT count(*) FROM copy_lead)  AS leads_copied,
  (SELECT count(*) FROM write_log)  AS log_rows_written,
  (SELECT count(*) FROM do_delete)  AS rows_deleted;
