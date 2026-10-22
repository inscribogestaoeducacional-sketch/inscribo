-- ============================================================================
-- Reverte 20261022100000_central_notificacoes.sql e
-- 20261022100100_central_notificacoes_cron.sql (ETAPA 2 — Central de notificações).
-- Rodar só com ok do Victor. Apaga os avisos e eventos de conexão gravados
-- desde a aplicação (não há outra cópia — exporte antes se precisar):
--   COPY (SELECT * FROM notification_alerts) TO STDOUT WITH CSV HEADER;
-- Não toca em system_notifications, whatsapp_messages, whatsapp_phone_numbers
-- nem em nada que as escolas usam.
-- ============================================================================
BEGIN;

DO $$ BEGIN PERFORM cron.unschedule('whatsapp-health-check'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('whatsapp-silence-check'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.notification_alerts;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DROP FUNCTION IF EXISTS public.whatsapp_usage_by_school(date);
DROP FUNCTION IF EXISTS public.whatsapp_usage_daily(uuid, date, date);
DROP FUNCTION IF EXISTS public.whatsapp_silence_check(timestamptz);
DROP FUNCTION IF EXISTS public.whatsapp_connection_event_log(text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.whatsapp_health_record(text, text, text, boolean, text, timestamptz);
DROP FUNCTION IF EXISTS public.notification_alerts_mark_read(uuid[]);

DROP TABLE IF EXISTS public.whatsapp_phone_health;
DROP TABLE IF EXISTS public.whatsapp_connection_events;
DROP TABLE IF EXISTS public.notification_alerts;

DROP SCHEMA IF EXISTS notif CASCADE;   -- can_see, emit_alert, resolve_alerts, horários, cron_service_key

-- O índice de consumo só acelera consultas; manter não faz mal. Para tirar:
DROP INDEX IF EXISTS public.idx_whatsapp_messages_inst_created;

COMMIT;
