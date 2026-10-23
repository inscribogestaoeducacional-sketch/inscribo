-- Transmissões: módulo liberado para todas as escolas; campanha com dias e janela de horário;
-- limite por dia conta o dia de calendário (fuso da campanha), não as últimas 24 horas.
ALTER TABLE public.broadcast_campaigns
  ADD COLUMN IF NOT EXISTS send_dates date[],
  ADD COLUMN IF NOT EXISTS send_window_start time,
  ADD COLUMN IF NOT EXISTS send_window_end time,
  ADD COLUMN IF NOT EXISTS send_tz text NOT NULL DEFAULT 'America/Fortaleza';

ALTER TABLE public.broadcast_settings
  ALTER COLUMN enabled SET DEFAULT true,
  ALTER COLUMN hourly_limit SET DEFAULT 50,
  ALTER COLUMN daily_limit SET DEFAULT 200;

INSERT INTO public.broadcast_settings (institution_id, enabled)
SELECT i.id, true FROM public.institutions i
 WHERE NOT EXISTS (SELECT 1 FROM public.broadcast_settings s WHERE s.institution_id = i.id);

CREATE OR REPLACE FUNCTION public.broadcast_settings_seed_new_institution()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO broadcast_settings (institution_id) VALUES (NEW.id) ON CONFLICT (institution_id) DO NOTHING;
  RETURN NEW;
END $function$;
REVOKE EXECUTE ON FUNCTION public.broadcast_settings_seed_new_institution() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_broadcast_settings_seed AFTER INSERT ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_settings_seed_new_institution();

CREATE OR REPLACE FUNCTION public.claim_broadcast_recipients(p_campaign_id uuid, p_limit integer DEFAULT 50)
 RETURNS SETOF broadcast_recipients
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inst       UUID;
  v_dates      date[];
  v_ws         time;
  v_we         time;
  v_tz         text;
  v_hourly     INTEGER;
  v_daily      INTEGER;
  v_used_hour  INTEGER;
  v_used_day   INTEGER;
  v_room       INTEGER;
  v_local      timestamp;
  v_day_start  timestamptz;
BEGIN
  SELECT c.institution_id, c.send_dates, c.send_window_start, c.send_window_end, COALESCE(c.send_tz, 'America/Fortaleza')
    INTO v_inst, v_dates, v_ws, v_we, v_tz
  FROM broadcast_campaigns c
  WHERE c.id = p_campaign_id AND c.status = 'sending';
  IF v_inst IS NULL THEN RETURN; END IF;

  v_local := now() AT TIME ZONE v_tz;
  -- Dias escolhidos: fora deles a campanha espera.
  IF v_dates IS NOT NULL AND cardinality(v_dates) > 0 AND NOT (v_local::date = ANY (v_dates)) THEN RETURN; END IF;
  -- Janela de horário: fora dela a campanha espera.
  IF v_ws IS NOT NULL AND v_we IS NOT NULL AND NOT (v_local::time >= v_ws AND v_local::time < v_we) THEN RETURN; END IF;

  SELECT s.hourly_limit, s.daily_limit INTO v_hourly, v_daily
  FROM broadcast_settings s WHERE s.institution_id = v_inst AND s.enabled;
  IF v_hourly IS NULL THEN RETURN; END IF;   -- módulo desligado pra escola

  PERFORM pg_advisory_xact_lock(hashtext('broadcast_claim:' || v_inst::text));

  v_day_start := date_trunc('day', v_local) AT TIME ZONE v_tz;

  -- Em trânsito ('sending') conta como gasto: já saiu (ou está saindo).
  SELECT count(*) FILTER (WHERE coalesce(r.sent_at, r.claimed_at) > now() - interval '1 hour'),
         count(*) FILTER (WHERE coalesce(r.sent_at, r.claimed_at) >= v_day_start)
    INTO v_used_hour, v_used_day
  FROM broadcast_recipients r
  WHERE r.institution_id = v_inst
    AND (r.sent_at > now() - interval '48 hours'
         OR (r.status = 'sending' AND r.claimed_at > now() - interval '48 hours'));

  v_room := least(p_limit, v_hourly - v_used_hour, v_daily - v_used_day);
  IF v_room <= 0 THEN RETURN; END IF;

  RETURN QUERY
  UPDATE broadcast_recipients r
  SET status = 'sending', claimed_at = now(), attempts = r.attempts + 1
  WHERE r.id IN (
    SELECT q.id FROM broadcast_recipients q
    WHERE q.campaign_id = p_campaign_id AND q.status = 'pending'
      AND (q.next_attempt_at IS NULL OR q.next_attempt_at <= now())
    ORDER BY q.created_at
    LIMIT v_room
    FOR UPDATE SKIP LOCKED
  )
  RETURNING r.*;
END;
$function$;
