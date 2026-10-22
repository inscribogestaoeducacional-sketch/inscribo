-- ============================================================================
-- 20261022100100_central_notificacoes_cron.sql
-- Agendamentos da Central de notificações (ETAPA 2). Separado da migration
-- principal porque depende de pg_cron/pg_net/Vault (o ensaio em PGlite roda só
-- a principal).
--
--   whatsapp-health-check  a cada 10 min  → edge function whatsapp-health-check
--                                           (só GET na Meta; grava via
--                                           whatsapp_health_record)
--   whatsapp-silence-check a cada hora, :07 → whatsapp_silence_check() direto no
--                                           banco (sem chamada externa)
--
-- Mesmo padrão de daily-summary/funnel-alert (20260822000300): URL do projeto
-- fixa, token buscado na hora da execução, nunca gravado no texto do cron.
-- Token: PRIMEIRO o cofre (vault.decrypted_secrets, nome 'service_role_key'),
-- com platform_settings.service_role_key como reserva até o cofre ter o
-- segredo (plano em docs: segredos-platform-settings).
-- NÃO APLICADA.
-- ============================================================================

CREATE OR REPLACE FUNCTION notif.cron_service_key()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v := NULL;
  END;
  IF coalesce(v, '') = '' THEN
    SELECT value INTO v FROM platform_settings WHERE key = 'service_role_key';
  END IF;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION notif.cron_service_key() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN PERFORM cron.unschedule('whatsapp-health-check'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'whatsapp-health-check',
  '*/10 * * * *',
  $$SELECT net.http_post(
    url     := 'https://syxxuumxkhhnoqrxporj.supabase.co/functions/v1/whatsapp-health-check',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || notif.cron_service_key()
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  )$$
);

DO $$ BEGIN PERFORM cron.unschedule('whatsapp-silence-check'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'whatsapp-silence-check',
  '7 * * * *',
  $$SELECT public.whatsapp_silence_check()$$
);
