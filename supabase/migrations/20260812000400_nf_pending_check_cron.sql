-- =============================================================================
-- 20260812000400_nf_pending_check_cron.sql
-- Agendar via pg_cron a Edge Function nf-pending-check (ver
-- supabase/functions/nf-pending-check/index.ts) — verifica 1x/dia cobranças
-- 'pending' vencendo nos próximos N dias de escolas com
-- nf_issue_timing='before_payment' e cria a linha payment_invoices 'pending'
-- perto o suficiente do vencimento (não mais no momento em que a cobrança é
-- criada — isso foi revertido em asaas-create-charge/asaas-generate-monthly
-- porque gerava 12 pendências simultâneas na ativação da escola).
--
-- ⚠️ Igual ao ajuste já feito hoje nos outros crons (aion_broadcast_send_cron,
-- aion_scheduled_messages_cron): current_setting('app.supabase_url') /
-- current_setting('app.service_role_key') NÃO funcionam de forma confiável
-- no Postgres gerenciado do Supabase (o app tem que setar essas GUCs
-- manualmente por sessão, e pg_cron roda em sessões novas que não herdam
-- isso). Por isso a URL e o token vão FIXOS, direto no comando abaixo, e não
-- via current_setting.
--
-- ⚠️ ANTES DE RODAR: troque '<SERVICE_ROLE_KEY_AQUI>' pela Service Role Key
-- real do projeto (Dashboard → Settings → API → service_role secret). Não
-- commitar a chave real neste arquivo — preencha só na hora de colar no SQL
-- Editor do Supabase. A URL abaixo (syxxuumxkhhnoqrxporj.supabase.co) já é a
-- URL pública do projeto, a mesma usada em Landing.tsx/AdminSettings.tsx/
-- embed.js — não é segredo.
--
-- Rodar manualmente no Supabase SQL Editor uma única vez (mesmo tratamento
-- dado às outras migrations de cron deste repo — não é aplicada automático).
--
-- Verificar após rodar:
--   SELECT * FROM cron.job;
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$ BEGIN
  PERFORM cron.unschedule('nf-pending-check');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Todo dia às 12:10 UTC (09:10 em Brasília) — logo depois do
-- overdue-payment-reminders (12:00 UTC), mesmo horário-base, evitando rodar
-- os dois no mesmo minuto exato.
SELECT cron.schedule(
  'nf-pending-check',
  '10 12 * * *',
  $$SELECT net.http_post(
    url     := 'https://syxxuumxkhhnoqrxporj.supabase.co/functions/v1/nf-pending-check',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY_AQUI>'
    ),
    body    := '{}'::jsonb
  )$$
);
