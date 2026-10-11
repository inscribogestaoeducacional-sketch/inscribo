-- FASE 0A — início do ENSAIO: fotografia "antes" (tabela temporária, some no fim).
CREATE TEMP TABLE fase0a_antes ON COMMIT DROP AS
SELECT i.id AS institution_id,
       (SELECT count(*) FROM enrollments e WHERE e.institution_id = i.id) AS n_enr,
       (SELECT count(*) FROM visits v WHERE v.institution_id = i.id AND v.assigned_to IS NOT NULL) AS n_vis_resp,
       (SELECT jsonb_object_agg(f.period, jsonb_build_array(f.registrations, f.schedules, f.visits, f.enrollments) ORDER BY f.period)
          FROM funnel_metrics f WHERE f.institution_id = i.id AND f.period ~ '^\d{4}-\d{2}$' AND f.period >= '2026-08') AS funil
  FROM institutions i;
