-- ============================================================================
-- 20261022100000_central_notificacoes.sql
-- ETAPA 2 — Central de notificações (sino): queda e silêncio do WhatsApp, e
-- consumo de mensagens por escola. Ideia adaptada da central do AION Business
-- (notif.emit, whatsapp_usage_daily) — sem copiar código entre repositórios.
--
-- Cria:
--   notification_alerts          avisos do sino novo (conexão/consumo). A tabela
--                                antiga system_notifications NÃO muda: o sino
--                                mostra as duas.
--   whatsapp_connection_events   eventos de conexão (webhook da Meta e conferência
--                                a cada 10 min) — só a equipe Áion lê.
--   whatsapp_phone_health        último estado de cada número conferido na Meta.
--   notif.*                      funções internas (fora da API): emitir sem
--                                repetir, resolver, horário de atendimento.
--   whatsapp_health_record()     a conferência (edge whatsapp-health-check)
--                                grava o estado e abre/resolve "WhatsApp desconectou".
--   whatsapp_connection_event_log()  o webhook grava account_update / falhas de envio.
--   whatsapp_silence_check()     "WhatsApp sem mensagens" (no horário da escola).
--   whatsapp_usage_daily() / whatsapp_usage_by_school()  consumo por escola.
--   notification_alerts_mark_read()  marcar como lida.
--
-- Quem vê (RLS de notification_alerts):
--   Super Admin (is_super_admin_user)       → todos
--   admin/gestor da escola                  → os da própria escola endereçados
--                                             a 'gestor' (e os da própria pessoa)
--   atendente                               → só os 'equipe' que não são de conexão
--   destinatário 'superadmin'               → só Super Admin
-- Ninguém grava direto: só as funções (service role / security definer).
--
-- Não chama a Meta nem mexe em Hub, robô ou envio. Reversível:
-- supabase/pendentes/central_notificacoes_reverter.sql.
-- Agendamentos (pg_cron) ficam em 20261022100100_central_notificacoes_cron.sql.
-- NÃO APLICADA. Ensaio: tests/central-notificacoes.sql.test.ts (PGlite, sem produção).
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS notif;
REVOKE ALL ON SCHEMA notif FROM PUBLIC;

-- ── Avisos ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_alerts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    uuid REFERENCES public.institutions(id) ON DELETE CASCADE,  -- NULL = plataforma
  recipient_user_id uuid,                                                        -- pessoa específica, OU
  recipient_role    text CHECK (recipient_role IN ('superadmin', 'gestor', 'equipe')),  -- papel
  category          text NOT NULL DEFAULT 'geral' CHECK (category IN ('conexao', 'consumo', 'geral')),
  type              text NOT NULL,          -- whatsapp_desconectado · whatsapp_silencio · ...
  title             text NOT NULL,
  body              text,
  severity          text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'danger', 'success')),
  link              text,
  data              jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  read_at           timestamptz,
  resolved_at       timestamptz,
  resolved_reason   text,
  CHECK (recipient_user_id IS NOT NULL OR recipient_role IS NOT NULL)
);
-- Sem repetir enquanto durar: um aviso aberto por chave e destinatário.
CREATE UNIQUE INDEX IF NOT EXISTS notification_alerts_open_dedupe
  ON public.notification_alerts (dedupe_key, coalesce(recipient_role, ''), coalesce(recipient_user_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE dedupe_key IS NOT NULL AND resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS notification_alerts_inst_recent ON public.notification_alerts (institution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_alerts_open ON public.notification_alerts (created_at DESC) WHERE resolved_at IS NULL;

ALTER TABLE public.notification_alerts ENABLE ROW LEVEL SECURITY;

-- Quem vê um aviso — usada pela RLS e por notification_alerts_mark_read.
CREATE OR REPLACE FUNCTION notif.can_see(p_institution uuid, p_user uuid, p_role text, p_category text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN is_super_admin_user() THEN true
    WHEN p_user IS NOT NULL THEN p_user = auth.uid()
    WHEN p_institution IS NULL OR p_role = 'superadmin' THEN false
    WHEN p_role = 'gestor' THEN user_school_role_in(p_institution, ARRAY['admin', 'manager'])
    WHEN p_role = 'equipe' THEN
      CASE WHEN p_category = 'conexao' THEN user_school_role_in(p_institution, ARRAY['admin', 'manager'])
           ELSE user_is_school_member(p_institution) END
    ELSE false
  END
$$;
GRANT USAGE ON SCHEMA notif TO authenticated;
REVOKE ALL ON FUNCTION notif.can_see(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION notif.can_see(uuid, uuid, text, text) TO authenticated;

DROP POLICY IF EXISTS notification_alerts_read ON public.notification_alerts;
CREATE POLICY notification_alerts_read ON public.notification_alerts FOR SELECT TO authenticated
  USING (notif.can_see(institution_id, recipient_user_id, recipient_role, category));
-- Sem políticas de INSERT/UPDATE/DELETE: só as funções abaixo gravam.

-- ── Emitir sem repetir / resolver ───────────────────────────────────────────
-- p_once: nunca repete a chave, nem depois de resolvida (ex.: silêncio do dia).
-- Sem p_once: repete só depois que o anterior for resolvido (ex.: queda nova).
-- Nunca derruba quem chamou.
CREATE OR REPLACE FUNCTION notif.emit_alert(
  p_institution uuid, p_role text, p_type text, p_category text, p_title text,
  p_body text DEFAULT NULL, p_severity text DEFAULT 'info', p_link text DEFAULT NULL,
  p_dedupe text DEFAULT NULL, p_data jsonb DEFAULT '{}'::jsonb, p_once boolean DEFAULT false,
  p_user uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_once AND p_dedupe IS NOT NULL AND EXISTS (
       SELECT 1 FROM notification_alerts a
        WHERE a.dedupe_key = p_dedupe
          AND coalesce(a.recipient_role, '') = coalesce(p_role, '')
          AND a.recipient_user_id IS NOT DISTINCT FROM p_user) THEN
    RETURN NULL;
  END IF;
  INSERT INTO notification_alerts (institution_id, recipient_user_id, recipient_role, category, type, title, body,
                                   severity, link, data, dedupe_key)
  VALUES (p_institution, p_user, p_role, p_category, p_type, left(p_title, 160), left(p_body, 600),
          p_severity, left(p_link, 300), coalesce(p_data, '{}'::jsonb), p_dedupe)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notif.emit_alert % falhou: %', p_type, sqlerrm;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION notif.emit_alert(uuid, text, text, text, text, text, text, text, text, jsonb, boolean, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION notif.resolve_alerts(p_dedupe text, p_reason text)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (
    UPDATE notification_alerts SET resolved_at = now(), resolved_reason = left(p_reason, 200)
     WHERE dedupe_key = p_dedupe AND resolved_at IS NULL
    RETURNING 1)
  SELECT count(*)::int FROM r
$$;
REVOKE ALL ON FUNCTION notif.resolve_alerts(text, text) FROM PUBLIC;

-- Marcar como lida: só o que a pessoa vê. NULL = todos os visíveis abertos.
CREATE OR REPLACE FUNCTION public.notification_alerts_mark_read(p_ids uuid[] DEFAULT NULL)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (
    UPDATE notification_alerts a SET read_at = now()
     WHERE a.read_at IS NULL
       AND (p_ids IS NULL OR a.id = ANY (p_ids))
       AND notif.can_see(a.institution_id, a.recipient_user_id, a.recipient_role, a.category)
    RETURNING 1)
  SELECT count(*)::int FROM u
$$;
REVOKE ALL ON FUNCTION public.notification_alerts_mark_read(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notification_alerts_mark_read(uuid[]) TO authenticated;

-- ── Eventos de conexão e estado dos números ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_connection_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid REFERENCES public.institutions(id) ON DELETE CASCADE,
  phone_number_id  text,
  waba_id          text,
  source           text NOT NULL CHECK (source IN ('webhook', 'monitor')),
  event_type       text NOT NULL,   -- account_update · phone_quality · envio_falhou · conferencia
  status           text,            -- CONNECTED, DISCONNECTED... (monitor) / evento da Meta (webhook)
  platform_type    text,
  is_on_biz_app    boolean,
  details          jsonb NOT NULL DEFAULT '{}'::jsonb,   -- sem tokens
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whatsapp_connection_events_phone ON public.whatsapp_connection_events (phone_number_id, created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_connection_events_inst ON public.whatsapp_connection_events (institution_id, created_at DESC);
ALTER TABLE public.whatsapp_connection_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wce_read ON public.whatsapp_connection_events;
CREATE POLICY wce_read ON public.whatsapp_connection_events FOR SELECT TO authenticated USING (is_super_admin_user());

CREATE TABLE IF NOT EXISTS public.whatsapp_phone_health (
  phone_number_id  text PRIMARY KEY,
  institution_id   uuid REFERENCES public.institutions(id) ON DELETE CASCADE,
  status           text,
  platform_type    text,
  is_on_biz_app    boolean,
  checked_at       timestamptz,
  ok_at            timestamptz,     -- última vez CONNECTED
  down_since       timestamptz,     -- desde quando NÃO está CONNECTED (NULL = no ar)
  last_error       text             -- falha ao consultar a Meta (não conta como queda)
);
ALTER TABLE public.whatsapp_phone_health ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wph_read ON public.whatsapp_phone_health;
CREATE POLICY wph_read ON public.whatsapp_phone_health FOR SELECT TO authenticated
  USING (is_super_admin_user() OR user_school_role_in(institution_id, ARRAY['admin', 'manager']));

-- ── Escolas sem alerta (teste/demonstração) ─────────────────────────────────
-- platform_settings.wa_alertas_ignorar: lista de ids de escola — JSON
-- ('["id1","id2"]') ou separada por vírgula/espaço. Vale para queda e silêncio:
-- o estado continua sendo gravado, só não abre aviso. Valor inválido = ninguém
-- é ignorado (nunca derruba a conferência).
CREATE OR REPLACE FUNCTION notif.ignored_institutions()
RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text; out uuid[] := '{}';
BEGIN
  SELECT value INTO v FROM platform_settings WHERE key = 'wa_alertas_ignorar';
  IF coalesce(btrim(v), '') = '' THEN RETURN out; END IF;
  SELECT coalesce(array_agg(m[1]::uuid), '{}') INTO out
    FROM regexp_matches(v, '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})', 'g') AS m;
  RETURN out;
EXCEPTION WHEN OTHERS THEN
  RETURN '{}';
END $$;
REVOKE ALL ON FUNCTION notif.ignored_institutions() FROM PUBLIC;

-- ── Queda: resultado da conferência (edge whatsapp-health-check, só GET) ────
-- p_status NULL + p_error = a Meta não respondeu: registra e não conta como
-- queda nem como volta. Não CONNECTED → "WhatsApp desconectou" para o Super
-- Admin e para o gestor, sem repetir enquanto durar. CONNECTED de novo →
-- resolve os dois.
CREATE OR REPLACE FUNCTION public.whatsapp_health_record(
  p_phone_number_id text, p_status text, p_platform_type text DEFAULT NULL,
  p_is_on_biz_app boolean DEFAULT NULL, p_error text DEFAULT NULL, p_now timestamptz DEFAULT now()
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_phone record; v_prev record; v_key text; v_name text; v_num text; v_body text;
BEGIN
  SELECT p.institution_id, p.phone_number, p.waba_id INTO v_phone
    FROM whatsapp_phone_numbers p
   WHERE p.phone_number_id = p_phone_number_id AND p.institution_id IS NOT NULL
   LIMIT 1;
  IF NOT FOUND THEN RETURN 'numero_desconhecido'; END IF;
  SELECT * INTO v_prev FROM whatsapp_phone_health WHERE phone_number_id = p_phone_number_id;
  v_key := 'wa_down:' || p_phone_number_id;

  INSERT INTO whatsapp_connection_events (institution_id, phone_number_id, waba_id, source, event_type, status,
                                          platform_type, is_on_biz_app, details, created_at)
  VALUES (v_phone.institution_id, p_phone_number_id, v_phone.waba_id, 'monitor', 'conferencia', p_status,
          p_platform_type, p_is_on_biz_app,
          CASE WHEN p_error IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('erro', left(p_error, 300)) END, p_now);

  IF p_status IS NULL THEN
    INSERT INTO whatsapp_phone_health (phone_number_id, institution_id, checked_at, last_error)
    VALUES (p_phone_number_id, v_phone.institution_id, p_now, left(coalesce(p_error, 'sem resposta'), 300))
    ON CONFLICT (phone_number_id) DO UPDATE SET checked_at = excluded.checked_at, last_error = excluded.last_error;
    RETURN 'nao_conferido';
  END IF;

  IF p_status = 'CONNECTED' THEN
    INSERT INTO whatsapp_phone_health AS h (phone_number_id, institution_id, status, platform_type, is_on_biz_app,
                                            checked_at, ok_at, down_since, last_error)
    VALUES (p_phone_number_id, v_phone.institution_id, p_status, p_platform_type, p_is_on_biz_app, p_now, p_now, NULL, NULL)
    ON CONFLICT (phone_number_id) DO UPDATE SET institution_id = excluded.institution_id, status = excluded.status,
      platform_type = excluded.platform_type, is_on_biz_app = excluded.is_on_biz_app, checked_at = excluded.checked_at,
      ok_at = excluded.ok_at, down_since = NULL, last_error = NULL;
    PERFORM notif.resolve_alerts(v_key, 'reconectou');
    RETURN 'conectado';
  END IF;

  INSERT INTO whatsapp_phone_health AS h (phone_number_id, institution_id, status, platform_type, is_on_biz_app,
                                          checked_at, down_since, last_error)
  VALUES (p_phone_number_id, v_phone.institution_id, p_status, p_platform_type, p_is_on_biz_app, p_now, p_now, NULL)
  ON CONFLICT (phone_number_id) DO UPDATE SET institution_id = excluded.institution_id, status = excluded.status,
    platform_type = excluded.platform_type, is_on_biz_app = excluded.is_on_biz_app, checked_at = excluded.checked_at,
    down_since = coalesce(h.down_since, excluded.down_since), last_error = NULL;

  -- escola de teste/demonstração: grava o estado, não avisa
  IF v_phone.institution_id = ANY (notif.ignored_institutions()) THEN RETURN 'ignorada'; END IF;

  SELECT name INTO v_name FROM institutions WHERE id = v_phone.institution_id;
  v_num := coalesce(nullif(v_phone.phone_number, ''), p_phone_number_id);
  v_body := 'O número ' || v_num || ' está ' || p_status || ' na Meta. As mensagens param até reconectar.';
  PERFORM notif.emit_alert(v_phone.institution_id, 'superadmin', 'whatsapp_desconectado', 'conexao',
    'WhatsApp desconectou — ' || coalesce(v_name, 'escola'), v_body, 'danger',
    '/super-admin/institutions/' || v_phone.institution_id || '?tab=whatsapp', v_key,
    jsonb_build_object('phone_number_id', p_phone_number_id, 'status', p_status));
  PERFORM notif.emit_alert(v_phone.institution_id, 'gestor', 'whatsapp_desconectado', 'conexao',
    'WhatsApp desconectou', v_body || ' Fale com a equipe Áion.', 'danger',
    '/settings?tab=whatsapp', v_key,
    jsonb_build_object('phone_number_id', p_phone_number_id, 'status', p_status));
  RETURN 'desconectado';
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_health_record(text, text, text, boolean, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_health_record(text, text, text, boolean, text, timestamptz) TO service_role;

-- ── Eventos que a Meta já manda ao webhook (account_update, qualidade, falhas
-- de envio). Só registra — o alerta de queda vem da conferência acima.
CREATE OR REPLACE FUNCTION public.whatsapp_connection_event_log(
  p_phone_number_id text, p_waba_id text, p_event_type text, p_status text DEFAULT NULL, p_details jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inst uuid;
BEGIN
  SELECT p.institution_id INTO v_inst FROM whatsapp_phone_numbers p
   WHERE (p_phone_number_id IS NOT NULL AND p.phone_number_id = p_phone_number_id)
      OR (p_phone_number_id IS NULL AND p_waba_id IS NOT NULL AND p.waba_id = p_waba_id)
   ORDER BY p.institution_id NULLS LAST LIMIT 1;
  INSERT INTO whatsapp_connection_events (institution_id, phone_number_id, waba_id, source, event_type, status, details)
  VALUES (v_inst, p_phone_number_id, p_waba_id, 'webhook', left(p_event_type, 60), left(p_status, 120), coalesce(p_details, '{}'::jsonb));
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'whatsapp_connection_event_log falhou: %', sqlerrm;
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_connection_event_log(text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_connection_event_log(text, text, text, text, jsonb) TO service_role;

-- ── Silêncio ────────────────────────────────────────────────────────────────
-- Segundos de horário de atendimento entre dois instantes (dias da semana em
-- 'MON'..'SUN', horário local do fuso da escola). Limite de 15 dias.
CREATE OR REPLACE FUNCTION notif.working_seconds_between(
  p_from timestamptz, p_to timestamptz, p_days text[], p_start time, p_end time, p_tz text
) RETURNS bigint LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_total bigint := 0; v_day date; v_last date; v_ws timestamptz; v_we timestamptz; v_a timestamptz; v_b timestamptz;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from OR p_start IS NULL OR p_end IS NULL OR p_end <= p_start THEN
    RETURN 0;
  END IF;
  v_day  := greatest((p_from AT TIME ZONE p_tz)::date, (p_to AT TIME ZONE p_tz)::date - 15);
  v_last := (p_to AT TIME ZONE p_tz)::date;
  WHILE v_day <= v_last LOOP
    IF upper(to_char(v_day, 'DY')) = ANY (coalesce(p_days, ARRAY['MON', 'TUE', 'WED', 'THU', 'FRI'])) THEN
      v_ws := (v_day + p_start) AT TIME ZONE p_tz;
      v_we := (v_day + p_end) AT TIME ZONE p_tz;
      v_a := greatest(v_ws, p_from);
      v_b := least(v_we, p_to);
      IF v_b > v_a THEN v_total := v_total + extract(epoch FROM (v_b - v_a))::bigint; END IF;
    END IF;
    v_day := v_day + 1;
  END LOOP;
  RETURN v_total;
END $$;

-- Agora está no horário de atendimento?
CREATE OR REPLACE FUNCTION notif.in_working_hours(p_at timestamptz, p_days text[], p_start time, p_end time, p_tz text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT upper(to_char((p_at AT TIME ZONE p_tz)::date, 'DY')) = ANY (coalesce(p_days, ARRAY['MON', 'TUE', 'WED', 'THU', 'FRI']))
     AND (p_at AT TIME ZONE p_tz)::time >= p_start AND (p_at AT TIME ZONE p_tz)::time < p_end
$$;

-- Escola que costuma receber mensagens (volume mínimo em 14 dias, em pelo
-- menos N dias diferentes) e está há X horas de atendimento sem nenhuma
-- recebida → "WhatsApp sem mensagens", uma vez por dia (chave com a data
-- local). Só avisa DENTRO do horário de atendimento; número em queda já tem o
-- aviso de queda. Resolve o aviso do dia quando volta a chegar mensagem.
-- Ajustes em platform_settings: wa_silence_hours (4), wa_silence_min_inbound_14d
-- (30), wa_silence_min_days_14d (5).
CREATE OR REPLACE FUNCTION public.whatsapp_silence_check(p_now timestamptz DEFAULT now())
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hours numeric; v_min_msgs int; v_min_days int; r record; n int := 0; v_key text; v_local date;
BEGIN
  SELECT coalesce((SELECT nullif(value, '')::numeric FROM platform_settings WHERE key = 'wa_silence_hours'), 4) INTO v_hours;
  SELECT coalesce((SELECT nullif(value, '')::int FROM platform_settings WHERE key = 'wa_silence_min_inbound_14d'), 30) INTO v_min_msgs;
  SELECT coalesce((SELECT nullif(value, '')::int FROM platform_settings WHERE key = 'wa_silence_min_days_14d'), 5) INTO v_min_days;

  FOR r IN
    WITH phones AS (
      SELECT DISTINCT p.institution_id, p.phone_number_id, p.phone_number
        FROM whatsapp_phone_numbers p
       WHERE p.institution_id IS NOT NULL AND coalesce(p.is_active, true) AND coalesce(p.use_meta_api, true)
    ), vol AS (
      SELECT m.institution_id, count(*) AS msgs,
             count(DISTINCT (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date) AS dias,
             max(m.created_at) AS last_in
        FROM whatsapp_messages m
       WHERE m.direction = 'inbound' AND NOT coalesce(m.is_history_sync, false) AND NOT coalesce(m.is_aion_inbox, false)
         AND m.created_at >= p_now - interval '14 days' AND m.created_at <= p_now
         AND m.institution_id IN (SELECT institution_id FROM phones)
       GROUP BY m.institution_id
    )
    SELECT ph.institution_id, min(ph.phone_number) AS phone_number, v.last_in, i.name,
           coalesce(f.working_days, ARRAY['MON', 'TUE', 'WED', 'THU', 'FRI']) AS days,
           coalesce(f.working_start, '07:00'::time) AS wstart, coalesce(f.working_end, '18:00'::time) AS wend,
           coalesce(nullif(f.timezone, ''), 'America/Sao_Paulo') AS tz,
           bool_or(h.down_since IS NOT NULL) AS down
      FROM phones ph
      JOIN vol v ON v.institution_id = ph.institution_id AND v.msgs >= v_min_msgs AND v.dias >= v_min_days
      JOIN institutions i ON i.id = ph.institution_id
      LEFT JOIN LATERAL (SELECT * FROM whatsapp_flows wf WHERE wf.institution_id = ph.institution_id
                          ORDER BY wf.updated_at DESC NULLS LAST LIMIT 1) f ON true
      LEFT JOIN whatsapp_phone_health h ON h.phone_number_id = ph.phone_number_id
     GROUP BY ph.institution_id, v.last_in, i.name, f.working_days, f.working_start, f.working_end, f.timezone
  LOOP
    v_local := (p_now AT TIME ZONE r.tz)::date;
    v_key := 'wa_silence:' || r.institution_id || ':' || v_local;
    -- chegou mensagem depois da que o aviso de hoje citou → resolve
    UPDATE notification_alerts SET resolved_at = p_now, resolved_reason = 'voltou a receber'
     WHERE dedupe_key = v_key AND resolved_at IS NULL
       AND r.last_in > (data->>'ultima_recebida')::timestamptz;
    CONTINUE WHEN r.down;
    CONTINUE WHEN r.institution_id = ANY (notif.ignored_institutions());
    CONTINUE WHEN NOT notif.in_working_hours(p_now, r.days, r.wstart, r.wend, r.tz);
    CONTINUE WHEN notif.working_seconds_between(r.last_in, p_now, r.days, r.wstart, r.wend, r.tz) < v_hours * 3600;
    IF notif.emit_alert(r.institution_id, 'superadmin', 'whatsapp_silencio', 'conexao',
         'WhatsApp sem mensagens — ' || r.name,
         'Nenhuma mensagem recebida há ' || v_hours || ' h de atendimento (última: '
           || to_char(r.last_in AT TIME ZONE r.tz, 'DD/MM HH24:MI') || '). Pode ser queda que a Meta não acusou.',
         'warning', '/super-admin/institutions/' || r.institution_id || '?tab=whatsapp', v_key,
         jsonb_build_object('ultima_recebida', r.last_in), true) IS NOT NULL THEN
      n := n + 1;
    END IF;
    PERFORM notif.emit_alert(r.institution_id, 'gestor', 'whatsapp_silencio', 'conexao',
      'WhatsApp sem mensagens',
      'Nenhuma mensagem recebida há ' || v_hours || ' h de atendimento (última: '
        || to_char(r.last_in AT TIME ZONE r.tz, 'DD/MM HH24:MI') || '). Confira o celular e fale com a equipe Áion.',
      'warning', '/settings?tab=whatsapp', v_key, jsonb_build_object('ultima_recebida', r.last_in), true);
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_silence_check(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_silence_check(timestamptz) TO service_role;

-- ── Consumo por escola ──────────────────────────────────────────────────────
-- Mensagens por dia (horário de Brasília) a partir do próprio histórico. Não
-- conta histórico importado nem o inbox interno da Áion. Sem valores em reais.
CREATE OR REPLACE FUNCTION public.whatsapp_usage_daily(p_institution_id uuid, p_from date, p_to date)
RETURNS TABLE (day date, received bigint, sent_team bigint, sent_bot bigint, sent_template bigint, conversations bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (is_super_admin_user() OR user_school_role_in(p_institution_id, ARRAY['admin', 'manager'])
          OR auth.uid() IS NULL) THEN   -- auth.uid() NULL = servidor (service role)
    RAISE EXCEPTION 'Sem permissão para ver o consumo desta escola' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
         count(*) FILTER (WHERE m.direction = 'inbound'),
         count(*) FILTER (WHERE m.direction = 'outbound' AND NOT coalesce(m.is_bot_message, false)
                            AND coalesce(m.message_type, '') <> 'template'),
         count(*) FILTER (WHERE m.direction = 'outbound' AND coalesce(m.is_bot_message, false)
                            AND coalesce(m.message_type, '') <> 'template'),
         count(*) FILTER (WHERE m.direction = 'outbound' AND m.message_type = 'template'),
         count(DISTINCT m.remote_jid)
    FROM whatsapp_messages m
   WHERE m.institution_id = p_institution_id
     AND m.created_at >= (p_from::timestamp AT TIME ZONE 'America/Sao_Paulo')
     AND m.created_at <  ((p_to + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
     AND NOT coalesce(m.is_history_sync, false) AND NOT coalesce(m.is_aion_inbox, false)
   GROUP BY 1 ORDER BY 1;
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_usage_daily(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_usage_daily(uuid, date, date) TO authenticated, service_role;

-- Lista do Super Admin: totais do mês (horário de Brasília) por escola.
CREATE OR REPLACE FUNCTION public.whatsapp_usage_by_school(p_month date DEFAULT NULL)
RETURNS TABLE (institution_id uuid, name text, received bigint, sent bigint, sent_template bigint,
               conversations bigint, last_received timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_from date; v_to date;
BEGIN
  IF NOT (is_super_admin_user() OR auth.uid() IS NULL) THEN
    RAISE EXCEPTION 'Apenas Super Admin' USING ERRCODE = '42501';
  END IF;
  v_from := date_trunc('month', coalesce(p_month, (now() AT TIME ZONE 'America/Sao_Paulo')::date))::date;
  v_to   := (v_from + interval '1 month')::date;
  RETURN QUERY
  SELECT i.id, i.name::text,
         count(m.id) FILTER (WHERE m.direction = 'inbound'),
         count(m.id) FILTER (WHERE m.direction = 'outbound'),
         count(m.id) FILTER (WHERE m.direction = 'outbound' AND m.message_type = 'template'),
         count(DISTINCT m.remote_jid),
         max(m.created_at) FILTER (WHERE m.direction = 'inbound')
    FROM institutions i
    JOIN whatsapp_messages m ON m.institution_id = i.id
     AND m.created_at >= (v_from::timestamp AT TIME ZONE 'America/Sao_Paulo')
     AND m.created_at <  (v_to::timestamp AT TIME ZONE 'America/Sao_Paulo')
     AND NOT coalesce(m.is_history_sync, false) AND NOT coalesce(m.is_aion_inbox, false)
   GROUP BY i.id, i.name
   ORDER BY 3 DESC;
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_usage_by_school(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_usage_by_school(date) TO authenticated, service_role;

-- Consultas de consumo e silêncio por escola e data (94 mil linhas em 22/10/2026: segundos).
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_inst_created ON public.whatsapp_messages (institution_id, created_at);

-- Escola modelo da Áion (Colégio Áion, teste; sem número válido em 22/10/2026)
-- fora dos alertas. Não sobrescreve uma lista já existente.
INSERT INTO public.platform_settings (key, value)
VALUES ('wa_alertas_ignorar', '["169b10a1-024d-4ac8-b3a8-199f34d1f360"]')
ON CONFLICT (key) DO NOTHING;

-- Tempo real: o sino escuta inserts.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_alerts;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
