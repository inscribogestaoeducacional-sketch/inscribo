-- =============================================================================
-- 20260821040000_merge_identical_name_duplicates.sql
-- Segundo lote de merge automático seguro dos grupos de whatsapp_contacts
-- duplicados (mesmo institution_id + telefone normalizado) restantes após
-- 20260821030000_merge_kinship_placeholder_duplicates.sql (432 → 293 grupos).
--
-- Padrão qualificador (confirmado por SELECT antes de aplicar: 143 dos 293
-- grupos restantes batem, 0 excluídos por lead_id conflitante):
--   As duas linhas do grupo têm name (trim + lowercase) EXATAMENTE igual.
--
-- Critério de sobrevivência (revisado nesta rodada):
--   1. has_conversation=true sempre sobrevive, independente de tags —
--      histórico de conversa não é reconstruível, prioridade máxima.
--      (98 dos 143 grupos decididos por este critério)
--   2. Empate em has_conversation (ambas ou nenhuma) → desempate por mais
--      tags preenchidas (31 grupos), depois por last_seen_at mais recente
--      (14 grupos). 0 grupos totalmente empatados.
--   3. Tags: UNIÃO das tags dos dois lados na linha sobrevivente (sem
--      duplicar) — não exige mais que uma seja subconjunto da outra.
--   4. lead_id: só um lado tem → copia pro sobrevivente. Ambos têm e são
--      DIFERENTES → grupo inteiro excluído do automático (fica manual).
--      Confirmado: 0 grupos caem nessa exceção nesta leva.
--
-- Testado em BEGIN...ROLLBACK antes de aplicar de verdade (mesmo padrão do
-- lote anterior).
-- =============================================================================

WITH grouped AS (
  SELECT
    id, institution_id, phone, name, tags, lead_id, created_at, last_seen_at,
    normalize_phone_br(phone) AS norm_phone,
    COUNT(*) OVER (PARTITION BY institution_id, normalize_phone_br(phone)) AS group_size
  FROM whatsapp_contacts
  WHERE institution_id IS NOT NULL
),
dup_rows AS (
  SELECT * FROM grouped WHERE group_size > 1
),
enriched AS (
  SELECT
    dr.*,
    COALESCE(dr.tags, ARRAY[]::text[]) AS tags_norm,
    EXISTS (
      SELECT 1 FROM whatsapp_conversations wc
      WHERE wc.institution_id = dr.institution_id AND SPLIT_PART(wc.remote_jid, '@', 1) = dr.phone
    ) AS has_conversation,
    ROW_NUMBER() OVER (PARTITION BY institution_id, norm_phone ORDER BY created_at) AS rn
  FROM dup_rows dr
),
same_name_groups AS (
  SELECT institution_id, norm_phone
  FROM enriched
  GROUP BY institution_id, norm_phone
  HAVING count(*) = 2 AND count(DISTINCT lower(trim(name))) = 1
),
pivoted AS (
  SELECT
    g.institution_id, g.norm_phone,
    a.id AS id_a, b.id AS id_b,
    a.lead_id AS lead_a, b.lead_id AS lead_b,
    cardinality(a.tags_norm) AS tc_a, cardinality(b.tags_norm) AS tc_b,
    a.tags_norm AS tags_a, b.tags_norm AS tags_b,
    a.has_conversation AS conv_a, b.has_conversation AS conv_b,
    a.last_seen_at AS ls_a, b.last_seen_at AS ls_b
  FROM same_name_groups g
  JOIN enriched a ON a.institution_id = g.institution_id AND a.norm_phone = g.norm_phone AND a.rn = 1
  JOIN enriched b ON b.institution_id = g.institution_id AND b.norm_phone = g.norm_phone AND b.rn = 2
),
decided AS (
  SELECT
    *,
    (lead_a IS NOT NULL AND lead_b IS NOT NULL AND lead_a <> lead_b) AS excl_lead_conflict,
    CASE
      WHEN conv_a AND NOT conv_b THEN 'a'
      WHEN conv_b AND NOT conv_a THEN 'b'
      WHEN tc_a > tc_b THEN 'a'
      WHEN tc_b > tc_a THEN 'b'
      WHEN ls_a IS NOT NULL AND (ls_b IS NULL OR ls_a > ls_b) THEN 'a'
      WHEN ls_b IS NOT NULL AND (ls_a IS NULL OR ls_b > ls_a) THEN 'b'
      ELSE 'a'
    END AS survivor
  FROM pivoted
),
valid_pairs AS (
  SELECT
    institution_id, norm_phone,
    CASE WHEN survivor = 'a' THEN id_a ELSE id_b END AS survivor_id,
    CASE WHEN survivor = 'a' THEN id_b ELSE id_a END AS discarded_id,
    CASE WHEN survivor = 'a' THEN lead_a ELSE lead_b END AS survivor_lead,
    CASE WHEN survivor = 'a' THEN lead_b ELSE lead_a END AS discarded_lead,
    (
      SELECT array_agg(DISTINCT t)
      FROM unnest(tags_a || tags_b) AS t
    ) AS unioned_tags
  FROM decided
  WHERE NOT excl_lead_conflict
),
-- NOTA: como no lote anterior, as CTEs de escrita abaixo só executam porque
-- são referenciadas na SELECT final.
apply_update AS (
  UPDATE whatsapp_contacts wc
  SET
    tags    = COALESCE(vp.unioned_tags, ARRAY[]::text[]),
    lead_id = COALESCE(wc.lead_id, vp.discarded_lead)
  FROM valid_pairs vp
  WHERE wc.id = vp.survivor_id
  RETURNING wc.id
),
write_log AS (
  INSERT INTO whatsapp_contacts_merge_log
    (institution_id, norm_phone, discarded_contact_id, surviving_contact_id, lead_id_copied, merge_reason)
  SELECT
    institution_id, norm_phone, discarded_id, survivor_id,
    CASE WHEN survivor_lead IS NULL THEN discarded_lead ELSE NULL END,
    'auto_merge_identical_name_conversation_priority'
  FROM valid_pairs
  RETURNING id
),
do_delete AS (
  DELETE FROM whatsapp_contacts
  WHERE id IN (SELECT discarded_id FROM valid_pairs)
  RETURNING id
)
SELECT
  (SELECT count(*) FROM valid_pairs)  AS valid_pairs_count,
  (SELECT count(*) FROM apply_update) AS survivors_updated,
  (SELECT count(*) FROM write_log)    AS log_rows_written,
  (SELECT count(*) FROM do_delete)    AS rows_deleted;
