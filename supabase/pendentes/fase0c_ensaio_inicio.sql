-- Fase 0C — ENSAIO, parte 1: foto "antes". Montagem do ensaio (uma transação,
-- desfeita pelo RAISE do relatório):
--   cat fase0c_ensaio_inicio.sql ../migrations/20261013100000_fase0c_ciclo_ano_perda.sql \
--       fase0c_backfill.sql fase0c_ensaio_relatorio.sql > ensaio.sql
--   supabase db query --linked -f ensaio.sql
CREATE TEMP TABLE _antes_leads AS
SELECT l.id, l.institution_id, l.campaign_cycle_id, l.year_interest, l.status, l.lost_reason, l.created_at, l.deleted_at
FROM leads l;
CREATE TEMP TABLE _antes_ciclos AS SELECT id, institution_id, label, year, status, start_date, end_date FROM campaign_cycles;
CREATE TEMP TABLE _antes_funil AS
SELECT institution_id, period, registrations, schedules, visits, enrollments FROM funnel_metrics;
