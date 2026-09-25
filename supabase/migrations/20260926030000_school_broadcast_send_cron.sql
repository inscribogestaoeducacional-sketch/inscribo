-- =============================================================================
-- 20260926030000_school_broadcast_send_cron.sql
-- Transmissões — etapa 1 (envio). Funções de apoio da Edge Function
-- school-broadcast-send + agendamento do cron a cada 1 minuto.
--
-- Divisão de responsabilidade (plano aprovado):
--   - a Edge Function decide o RITMO (cota por minuto = ceil(hourly_limit/60))
--     e a ORDEM entre escolas (quem enviou há mais tempo primeiro);
--   - claim_broadcast_recipients (M3) garante o TETO de hora/dia de cada
--     escola, contando o que está em trânsito, com trava por escola.
-- Todas só pro backend (service role).
-- =============================================================================

-- Fila de despacho: campanhas enviando de escolas com o módulo ligado, com os
-- limites da escola e o último envio dela (revezamento justo). Ordem: escola
-- que enviou há mais tempo (nunca enviou = primeiro); dentro da escola, a
-- campanha iniciada primeiro.
CREATE OR REPLACE FUNCTION public.broadcast_dispatch_plan()
RETURNS TABLE (
  institution_id UUID,
  campaign_id    UUID,
  hourly_limit   INTEGER,
  daily_limit    INTEGER,
  last_sent_at   TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH active AS (
    SELECT c.institution_id, c.id AS campaign_id, c.started_at, c.created_at, s.hourly_limit, s.daily_limit
    FROM broadcast_campaigns c
    JOIN broadcast_settings s ON s.institution_id = c.institution_id AND s.enabled
    WHERE c.status = 'sending'
  ),
  last_sent AS (
    SELECT a.institution_id,
           (SELECT max(r.sent_at) FROM broadcast_recipients r
             WHERE r.institution_id = a.institution_id AND r.sent_at > now() - interval '24 hours') AS last_sent_at
    FROM (SELECT DISTINCT institution_id FROM active) a
  )
  SELECT a.institution_id, a.campaign_id, a.hourly_limit, a.daily_limit, l.last_sent_at
  FROM active a
  JOIN last_sent l ON l.institution_id = a.institution_id
  ORDER BY l.last_sent_at ASC NULLS FIRST, a.institution_id, a.started_at NULLS LAST, a.created_at
$$;

-- Liberações pendentes: agendadas cujo horário chegou + varredura de
-- segurança nas que aguardam template/pagamento (pega webhook perdido).
-- broadcast_try_release é idempotente. Devolve quantas mudaram de status.
CREATE OR REPLACE FUNCTION public.broadcast_release_due()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r        RECORD;
  v_new    TEXT;
  v_moved  INTEGER := 0;
BEGIN
  FOR r IN
    SELECT id, status FROM broadcast_campaigns
    WHERE (status = 'scheduled' AND scheduled_at <= now())
       OR status IN ('pending_template','pending_payment')
    ORDER BY updated_at
    LIMIT 100
  LOOP
    v_new := broadcast_try_release(r.id);
    IF v_new IS DISTINCT FROM r.status THEN v_moved := v_moved + 1; END IF;
  END LOOP;
  RETURN v_moved;
END;
$$;

-- Recontagem das campanhas em andamento e das concluídas nas últimas 48h
-- (entregue/lido continuam chegando depois de concluir). Campanha que
-- concluiu NESTA recontagem já recebe o crédito das falhas.
CREATE OR REPLACE FUNCTION public.broadcast_recount_active()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r       RECORD;
  c       broadcast_campaigns%ROWTYPE;
  v_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT id, status FROM broadcast_campaigns
    WHERE status = 'sending'
       OR (status = 'completed' AND completed_at > now() - interval '48 hours')
  LOOP
    c := broadcast_recount(r.id);
    IF r.status = 'sending' AND c.status = 'completed' THEN
      PERFORM broadcast_credit_failures(r.id);
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_dispatch_plan()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_release_due()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_recount_active()  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_dispatch_plan()   TO service_role;
GRANT EXECUTE ON FUNCTION public.broadcast_release_due()     TO service_role;
GRANT EXECUTE ON FUNCTION public.broadcast_recount_active()  TO service_role;

-- ── Cron: a cada 1 minuto ──────────────────────────────────────────────────
-- Mesmo padrão de 20260821000000_fix_cron_token_exposure.sql: token lido em
-- runtime de platform_settings, nunca gravado no comando.
DO $$ BEGIN
  PERFORM cron.unschedule('school-broadcast-send');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'school-broadcast-send',
  '* * * * *',
  $$SELECT net.http_post(
    url     := 'https://syxxuumxkhhnoqrxporj.supabase.co/functions/v1/school-broadcast-send',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM platform_settings WHERE key = 'service_role_key')
    ),
    body    := '{}'::jsonb
  )$$
);
