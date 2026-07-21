-- =============================================================================
-- 20260720001000_overdue_payment_reminders_cron.sql
-- Agendar via pg_cron a Edge Function overdue-payment-reminders — mesmo
-- padrão já usado em bot_timeout_cron.sql (pg_cron + pg_net chamando a
-- function via net.http_post).
--
-- ATENÇÃO: Rodar manualmente no Supabase SQL Editor uma única vez. Requer
-- pg_cron e pg_net habilitados (Dashboard → Extensions) e as variáveis
-- app.supabase_url / app.service_role_key já configuradas no banco (mesmas
-- usadas por bot_timeout_cron.sql — se já rodou antes, não precisa repetir).
--
-- ⚠️ A function em si só ENVIA de verdade se platform_settings.
-- overdue_reminders_enabled = 'true' (ver comentário no topo do index.ts).
-- Agendar este cron é seguro mesmo antes disso — a function roda em
-- modo dry-run (só loga) até esse flag ser ativado.
--
-- Verificar após rodar:
--   SELECT * FROM cron.job;
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$ BEGIN
  PERFORM cron.unschedule('overdue-payment-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Todo dia às 12:00 UTC (09:00 em Brasília)
SELECT cron.schedule(
  'overdue-payment-reminders',
  '0 12 * * *',
  $$SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/overdue-payment-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  )$$
);

-- Rodar também se as variáveis ainda não estiverem configuradas:
--
-- ALTER DATABASE postgres
--   SET app.supabase_url = 'https://SEU-PROJECT-ID.supabase.co';
--
-- ALTER DATABASE postgres
--   SET app.service_role_key = 'SUA-SERVICE-ROLE-KEY';
