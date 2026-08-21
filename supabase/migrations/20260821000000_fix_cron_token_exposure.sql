-- =============================================================================
-- 20260821000000_fix_cron_token_exposure.sql
-- Remove a Service Role Key em texto puro de dentro do comando armazenado em
-- cron.job pra 4 crons — qualquer um com leitura nessa tabela do sistema
-- conseguia ler o token completo. Recria cada um com o mesmo padrão já usado
-- por gerar-mensalidades-diario: token buscado em runtime via
-- (SELECT value FROM platform_settings WHERE key = 'service_role_key'),
-- nunca gravado no comando em si.
--
-- Pré-requisito (já feito manualmente antes desta migration, fora do
-- versionamento por ser um valor sensível): platform_settings.service_role_key
-- inserido com o valor real da Service Role Key do projeto.
--
-- Verificado após a correção: gerar-mensalidades-diario (a referência do
-- padrão correto) NÃO ficou bloqueado pela ausência de platform_settings.
-- service_role_key antes desta migration — a função asaas-generate-monthly
-- tem verify_jwt=false em supabase/config.toml e não valida o header
-- Authorization internamente, então o gateway nunca rejeitou essas chamadas.
-- Sem impacto funcional identificado em produção por esse motivo.
--
-- Mesmo padrão de "rodar manualmente uma vez" das migrations de cron
-- anteriores deste repo (bot_timeout_cron.sql, overdue_payment_reminders_cron.sql
-- etc.) — aqui documentada e já aplicada via `supabase db push` no momento
-- desta sessão.
--
-- Verificar após rodar:
--   SELECT jobid, jobname, schedule, command FROM cron.job ORDER BY jobname;
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. bot-timeout-send — a cada 5 minutos
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  PERFORM cron.unschedule('bot-timeout-send');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'bot-timeout-send',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url     := 'https://syxxuumxkhhnoqrxporj.supabase.co/functions/v1/bot-timeout-send',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM platform_settings WHERE key = 'service_role_key')
    ),
    body    := '{}'::jsonb
  )$$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. aion-broadcast-send — a cada 2 minutos
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  PERFORM cron.unschedule('aion-broadcast-send');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'aion-broadcast-send',
  '*/2 * * * *',
  $$SELECT net.http_post(
    url     := 'https://syxxuumxkhhnoqrxporj.supabase.co/functions/v1/aion-broadcast-send',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM platform_settings WHERE key = 'service_role_key')
    ),
    body    := '{}'::jsonb
  )$$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. aion-scheduled-send — a cada 5 minutos
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  PERFORM cron.unschedule('aion-scheduled-send');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'aion-scheduled-send',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url     := 'https://syxxuumxkhhnoqrxporj.supabase.co/functions/v1/aion-scheduled-send',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM platform_settings WHERE key = 'service_role_key')
    ),
    body    := '{}'::jsonb
  )$$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. overdue-payment-reminders — todo dia às 12:00 UTC (09:00 Brasília)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  PERFORM cron.unschedule('overdue-payment-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'overdue-payment-reminders',
  '0 12 * * *',
  $$SELECT net.http_post(
    url     := 'https://syxxuumxkhhnoqrxporj.supabase.co/functions/v1/overdue-payment-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM platform_settings WHERE key = 'service_role_key')
    ),
    body    := '{}'::jsonb
  )$$
);
