-- Etapa 2B: Lembrete da avaliação e Conversa parada (já aplicado em produção em 22/10/2026).
ALTER TABLE public.whatsapp_flows ADD COLUMN IF NOT EXISTS idle_config jsonb;
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS survey_sent_at          timestamptz,
  ADD COLUMN IF NOT EXISTS survey_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS idle_notice_sent_at     timestamptz;
CREATE INDEX IF NOT EXISTS idx_wa_conv_survey_pending
  ON public.whatsapp_conversations (institution_id, survey_sent_at)
  WHERE survey_sent_at IS NOT NULL AND satisfaction_score IS NULL;
-- whatsapp_flows_guard_columns(): 'idle_config' entrou na lista que o gestor pode salvar.

-- Agendamento (a cada 5 minutos) da função supabase/functions/whatsapp-followups:
-- select cron.schedule('whatsapp-followups', '*/5 * * * *', $job$SELECT net.http_post(
--   url := 'https://syxxuumxkhhnoqrxporj.supabase.co/functions/v1/whatsapp-followups',
--   headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT value FROM platform_settings WHERE key = 'service_role_key')),
--   body := '{}'::jsonb, timeout_milliseconds := 25000)$job$);
