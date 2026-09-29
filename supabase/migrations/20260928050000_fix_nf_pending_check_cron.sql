-- =============================================================================
-- nf-pending-check: o cron foi criado (20260812000400) com o texto provisório
-- '<SERVICE_ROLE_KEY_AQUI>' no header e nunca recebeu a chave real — toda
-- chamada diária desde 13/08/2026 era recusada pela função (JWT inválido).
-- Não ficou pendência de nota perdida (a única escola 'before_payment' já tem
-- nota registrada pras cobranças do período).
--
-- Mesmo padrão dos outros crons desde 20260821000000_fix_cron_token_exposure:
-- a chave é lida em runtime de platform_settings.service_role_key, nunca
-- gravada no comando. Mesmo horário de antes (12:10 UTC).
-- =============================================================================

DO $$ BEGIN
  PERFORM cron.unschedule('nf-pending-check');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'nf-pending-check',
  '10 12 * * *',
  $$SELECT net.http_post(
    url     := 'https://syxxuumxkhhnoqrxporj.supabase.co/functions/v1/nf-pending-check',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM platform_settings WHERE key = 'service_role_key')
    ),
    body    := '{}'::jsonb
  )$$
);
