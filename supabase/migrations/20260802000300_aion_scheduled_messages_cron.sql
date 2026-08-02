-- =============================================================================
-- 20260802000300_aion_scheduled_messages_cron.sql
-- Agendar via pg_cron a Edge Function aion-scheduled-send — mesmo padrão já
-- usado em bot_timeout_cron.sql (pg_cron + pg_net chamando a function via
-- net.http_post, a cada 5 minutos).
--
-- ATENÇÃO: Rodar manualmente no Supabase SQL Editor uma única vez, depois de
-- fazer o deploy da Edge Function aion-scheduled-send. Requer pg_cron e
-- pg_net habilitados (Dashboard → Extensions) e as variáveis
-- app.supabase_url / app.service_role_key já configuradas no banco (mesmas
-- usadas por bot_timeout_cron.sql e overdue_payment_reminders_cron.sql — se
-- já rodou antes, não precisa repetir).
--
-- Verificar após rodar:
--   SELECT * FROM cron.job;
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$ BEGIN
  PERFORM cron.unschedule('aion-scheduled-send');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- A cada 5 minutos
SELECT cron.schedule(
  'aion-scheduled-send',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/aion-scheduled-send',
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
