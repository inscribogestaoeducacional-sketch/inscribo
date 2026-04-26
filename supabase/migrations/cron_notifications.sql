-- Enable pg_cron and pg_net extensions (must be enabled in Supabase dashboard)
-- These cron jobs require the project URL and service role key to be set as secrets.

-- Daily summary: runs at 21:00 UTC (18:00 BRT) every day
SELECT cron.schedule(
  'daily-summary-notification',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/daily-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  )
  $$
);

-- Funnel alert: runs at 12:00 UTC (09:00 BRT) every Monday
SELECT cron.schedule(
  'funnel-alert-notification',
  '0 12 * * 1',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/funnel-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  )
  $$
);
