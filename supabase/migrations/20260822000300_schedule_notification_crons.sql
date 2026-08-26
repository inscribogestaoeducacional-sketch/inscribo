-- =============================================================================
-- 20260822000300_schedule_notification_crons.sql
-- Agenda os 2 crons definidos em supabase/migrations/cron_notifications.sql
-- (daily-summary-notification, funnel-alert-notification) — nunca foram
-- agendados em produção porque esse arquivo não segue o padrão de nome
-- <timestamp>_<nome>.sql exigido pelo `supabase db push` (mesma causa raiz já
-- documentada em contacts.sql/20260821050000_create_contact_custom_fields_tables.sql).
-- Confirmado via `SELECT * FROM cron.job` antes desta migration: nenhum dos
-- dois jobs existe. As edge functions correspondentes (supabase/functions/
-- daily-summary, funnel-alert) existem e nunca deram erro de deploy — só
-- nunca foram chamadas automaticamente.
--
-- Schedule original preservado de cron_notifications.sql:
--   daily-summary-notification: '0 21 * * *'  (21:00 UTC = 18:00 Brasília, todo dia)
--   funnel-alert-notification:  '0 12 * * 1'  (12:00 UTC = 09:00 Brasília, toda segunda)
--
-- Padrão de segurança seguido (mesmo de 20260821000000_fix_cron_token_exposure.sql,
-- que corrigiu os outros 5 crons do projeto): token da Service Role Key
-- buscado em runtime via (SELECT value FROM platform_settings WHERE key =
-- 'service_role_key'), nunca gravado em texto puro dentro do comando
-- armazenado em cron.job — cron_notifications.sql original usava
-- current_setting('app.service_role_key'), o padrão antigo/inseguro já
-- substituído nos outros crons. URL do projeto hardcoded (mesmo padrão do
-- fix acima), não current_setting('app.supabase_url') — dispensa depender de
-- uma GUC de banco que pode não estar configurada.
--
-- Achados da investigação inicial (funnel-alert/index.ts consultando colunas
-- que não existem mais em funnel_metrics; daily-summary/index.ts consultando
-- transfer_requests, tabela renomeada pra student_transfers) já foram
-- corrigidos nas duas edge functions antes desta migration ser aplicada —
-- ambas agora batem com o schema atual e foram validadas manualmente contra
-- dados reais de produção. Nenhum dos dois crons abaixo é mais um no-op.
--
-- NÃO aplicado ainda — só criado pra revisão antes de rodar `supabase db push`.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. daily-summary-notification — todo dia às 21:00 UTC (18:00 Brasília)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  PERFORM cron.unschedule('daily-summary-notification');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'daily-summary-notification',
  '0 21 * * *',
  $$SELECT net.http_post(
    url     := 'https://syxxuumxkhhnoqrxporj.supabase.co/functions/v1/daily-summary',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM platform_settings WHERE key = 'service_role_key')
    ),
    body    := '{}'::jsonb
  )$$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. funnel-alert-notification — toda segunda às 12:00 UTC (09:00 Brasília)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  PERFORM cron.unschedule('funnel-alert-notification');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'funnel-alert-notification',
  '0 12 * * 1',
  $$SELECT net.http_post(
    url     := 'https://syxxuumxkhhnoqrxporj.supabase.co/functions/v1/funnel-alert',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM platform_settings WHERE key = 'service_role_key')
    ),
    body    := '{}'::jsonb
  )$$
);
