-- =============================================================================
-- FASE 0A — BACKFILL (dados). NÃO está em supabase/migrations: roda manualmente,
-- acompanhado, DEPOIS da migration 20261011120000_fase0a_fonte_numeros.sql e
-- só com ok do usuário. Não rodar em paralelo com fusões de conversas.
--
-- Ensaio (desfaz tudo no fim):
--   supabase/pendentes/fase0a_ensaio.sql  (migration + este arquivo + relatório
--   via RAISE EXCEPTION, que aborta a transação inteira)
--
-- O que faz, numa transação:
--   0. backup em fase0a_backup_rows (funnel_metrics, enrollments, visits,
--      system_notifications afetadas), run_tag fase0a_<data>
--   1. matrículas: completa source/date_source das 5 linhas já existentes (Kanban)
--      e cria a matrícula formal dos leads 'enrolled' sem registro, com a data
--      do histórico: log de status (exata) > edição do lead que mudou o campo
--      status (log_edicao) > updated_at (ESTIMADA, marcada)
--   2. histórico de status: eventos exatos do log (module 'leads',
--      'status_changed', de→para) + 1 linha inferida por lead quando a última
--      mudança conhecida é uma edição pelo modal (para = status atual)
--   3. visitas: responsável = quem agendou, pelo log de criação (tela Visitas)
--      ou "Visita agendada" (Hub/Kanban) do mesmo lead até 5 min depois
--   4. alertas falsos "Meta de Cadastros abaixo de 60%" vindos da linha errada
--      do funil: resolved_at + resolved_reason (+ read_at), nada é apagado
--   5. funil: recalcula funnel_metrics (só colunas reais) de todos os ciclos
--      ativos/liberados com as definições novas
-- Não mexe: registros de escola inexistente (10 enrollments, 11 leads e 4 visitas
-- de teste de 2025/abr-2026), a
-- visita da Ágape com data 10/09/2025 (lista à parte), metas (*_target).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.fase0a_backup_rows (
  run_tag      TEXT        NOT NULL,
  table_name   TEXT        NOT NULL,
  row_id       TEXT        NOT NULL,
  row_data     JSONB       NOT NULL,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fase0a_backup_rows ENABLE ROW LEVEL SECURITY;  -- sem política: só service role

-- ── 0. Backup ────────────────────────────────────────────────────────────────
INSERT INTO fase0a_backup_rows (run_tag, table_name, row_id, row_data)
SELECT 'fase0a_' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD_HH24MI'), 'funnel_metrics', f.id::text, to_jsonb(f) FROM funnel_metrics f
UNION ALL
SELECT 'fase0a_' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD_HH24MI'), 'enrollments', e.id::text, to_jsonb(e) FROM enrollments e
UNION ALL
SELECT 'fase0a_' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD_HH24MI'), 'visits', v.id::text, to_jsonb(v) FROM visits v
UNION ALL
SELECT 'fase0a_' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD_HH24MI'), 'system_notifications', n.id::text, to_jsonb(n)
  FROM system_notifications n WHERE n.type = 'goal_deviation';

-- ── 1. Matrículas ────────────────────────────────────────────────────────────
-- 1a. linhas já existentes vieram do arrastar no Kanban (data = momento do evento)
UPDATE enrollments
   SET source = 'kanban', date_source = 'evento', date_is_estimated = false
 WHERE lead_id IS NOT NULL AND source IS NULL;

-- 1b. matrículas faltantes
WITH faltantes AS (
  SELECT l.*,
    (SELECT max(a.created_at) FROM audit_logs a
      WHERE a.record_id = l.id AND a.module = 'leads' AND a.action = 'status_changed'
        AND a.new_value = 'enrolled') AS dt_log_status,
    (SELECT max(a.created_at) FROM audit_logs a
      WHERE a.record_id = l.id AND a.module = 'lead' AND a.action = 'Lead editado'
        AND a.field_changed ~ '\mstatus\M') AS dt_log_edicao
  FROM leads l
  WHERE l.status = 'enrolled' AND l.deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM institutions i WHERE i.id = l.institution_id)  -- 11 leads órfãos de teste (2025) ficam de fora
    AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.lead_id = l.id)
)
INSERT INTO enrollments (institution_id, lead_id, student_name, course_grade, enrollment_date, user_id,
                         responsible_name, source, date_source, date_is_estimated)
SELECT f.institution_id, f.id, COALESCE(f.student_name, f.responsible_name), f.grade_interest,
       COALESCE(f.dt_log_status, f.dt_log_edicao, f.updated_at),
       f.assigned_to, f.responsible_name, 'backfill',
       CASE WHEN f.dt_log_status IS NOT NULL THEN 'log_status'
            WHEN f.dt_log_edicao IS NOT NULL THEN 'log_edicao'
            ELSE 'estimada' END,
       (f.dt_log_status IS NULL AND f.dt_log_edicao IS NULL)
  FROM faltantes f;

-- ── 2. Histórico de status ───────────────────────────────────────────────────
-- 2a. eventos exatos (Kanban: logAudit module 'leads' / 'status_changed')
INSERT INTO lead_status_history (institution_id, lead_id, from_status, to_status, changed_at,
                                 changed_by, changed_by_name, source, is_inferred)
SELECT a.institution_id, a.record_id, NULLIF(a.old_value, ''), a.new_value, a.created_at,
       a.user_id, a.user_name, 'backfill_log', false
  FROM audit_logs a
 WHERE a.module = 'leads' AND a.action = 'status_changed'
   AND a.new_value IN ('new','contact','scheduled','visit','proposal','enrolled','lost')
   AND EXISTS (SELECT 1 FROM institutions i WHERE i.id = a.institution_id)
   AND NOT EXISTS (SELECT 1 FROM lead_status_history h
                    WHERE h.lead_id = a.record_id AND h.changed_at = a.created_at AND h.to_status = a.new_value);

-- 2b. última mudança pelo modal (sem de→para no log): para = status atual,
--     só quando é posterior ao último evento exato do lead
INSERT INTO lead_status_history (institution_id, lead_id, from_status, to_status, changed_at,
                                 changed_by, changed_by_name, source, is_inferred)
SELECT l.institution_id, l.id, NULL, l.status, ed.created_at, ed.user_id, ed.user_name, 'backfill_inferido', true
  FROM leads l
  JOIN LATERAL (
    SELECT a.created_at, a.user_id, a.user_name FROM audit_logs a
     WHERE a.record_id = l.id AND a.module = 'lead' AND a.action = 'Lead editado'
       AND a.field_changed ~ '\mstatus\M'
     ORDER BY a.created_at DESC LIMIT 1
  ) ed ON true
 WHERE EXISTS (SELECT 1 FROM institutions i WHERE i.id = l.institution_id)
   AND ed.created_at > COALESCE((SELECT max(h.changed_at) FROM lead_status_history h WHERE h.lead_id = l.id), '-infinity')
   AND NOT EXISTS (SELECT 1 FROM lead_status_history h
                    WHERE h.lead_id = l.id AND h.changed_at = ed.created_at);

-- ── 3. Visitas: responsável = quem agendou ───────────────────────────────────
WITH quem AS (
  SELECT v.id,
         COALESCE(
           (SELECT a.user_id FROM audit_logs a
             WHERE a.module = 'visits' AND a.action = 'created' AND a.record_id = v.id
             ORDER BY a.created_at LIMIT 1),
           (SELECT a.user_id FROM audit_logs a
             WHERE a.module = 'lead' AND a.action = 'Visita agendada' AND a.record_id = v.lead_id
               AND a.created_at BETWEEN v.created_at AND v.created_at + interval '5 minutes'
             ORDER BY a.created_at LIMIT 1)
         ) AS user_id
    FROM visits v
   WHERE v.assigned_to IS NULL
     AND EXISTS (SELECT 1 FROM institutions i WHERE i.id = v.institution_id)
)
UPDATE visits v SET assigned_to = q.user_id
  FROM quem q
 WHERE v.id = q.id AND q.user_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM users u WHERE u.id = q.user_id);

-- ── 4. Alertas falsos ────────────────────────────────────────────────────────
-- "Mês atual do funil" escolhido por ordem alfabética: Ágape lia a linha
-- "Set/2027" (meta 115) e Santa Teresa a de 2027-03 (meta 32), ambas com 0.
UPDATE system_notifications n
   SET resolved_at = now(),
       resolved_reason = 'falso: mes do funil escolhido por ordem alfabetica (Fase 0A)',
       read_at = COALESCE(n.read_at, now())
 WHERE n.type = 'goal_deviation'
   AND n.title = 'Meta de Cadastros abaixo de 60%'
   AND n.resolved_at IS NULL
   AND (
     (n.institution_id = (SELECT id FROM institutions WHERE name = 'Colégio Ágape Patos')
        AND n.message = 'Cadastros: 0 de 115 (0% da meta).')
  OR (n.institution_id = (SELECT id FROM institutions WHERE name = 'COLEGIO SANTA TERESA DE JESUS')
        AND n.message = 'Cadastros: 0 de 32 (0% da meta).')
   );

-- ── 5. Funil recalculado com as definições novas ─────────────────────────────
SELECT recompute_funnel_metrics(c.institution_id)
  FROM (SELECT DISTINCT institution_id FROM campaign_cycles
         WHERE status IN ('active','released') AND start_date IS NOT NULL AND end_date IS NOT NULL) c;
