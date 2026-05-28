-- =============================================================================
-- bot_timeout_cron.sql
-- Configurar pg_cron para executar process_bot_timeouts() e
-- disparar a Edge Function bot-timeout-send a cada 5 minutos.
--
-- ATENÇÃO: Rodar manualmente no Supabase SQL Editor uma única vez.
-- Requer que pg_cron e pg_net estejam habilitados no projeto Supabase
-- (Dashboard → Extensions → pg_cron / pg_net).
--
-- Verificar após rodar:
--   SELECT * FROM cron.job;
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- =============================================================================

-- Habilitar extensões (idempotente; pode já estar ativo no projeto)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── Remover agendamentos anteriores para evitar duplicatas ───────────────────
DO $$ BEGIN
  PERFORM cron.unschedule('process-bot-timeouts');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('bot-timeout-send');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ─── 1. Agendar função SQL a cada 5 minutos ───────────────────────────────────
SELECT cron.schedule(
  'process-bot-timeouts',
  '*/5 * * * *',
  'SELECT process_bot_timeouts()'
);

-- ─── 2. Agendar Edge Function bot-timeout-send a cada 5 minutos ──────────────
-- Usa pg_net para chamar a Edge Function via HTTP POST
SELECT cron.schedule(
  'bot-timeout-send',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/bot-timeout-send',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  )$$
);

-- ─── Configurar variáveis de ambiente do banco (ajustar URLs/chaves) ──────────
-- Rodar também se as variáveis ainda não estiverem configuradas:
--
-- ALTER DATABASE postgres
--   SET app.supabase_url = 'https://SEU-PROJECT-ID.supabase.co';
--
-- ALTER DATABASE postgres
--   SET app.service_role_key = 'SUA-SERVICE-ROLE-KEY';
