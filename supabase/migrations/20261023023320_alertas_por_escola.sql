-- Alertas por escola (Configurações > WhatsApp > Alertas).
-- whatsapp_flows.alerts_config = {connection, silence, silence_hours, template, unanswered, unanswered_minutes}.
-- Chave ausente = padrão (conexão, silêncio e modelo ligados; cliente esperando desligado).
-- Só o aviso que vai para o gestor da escola respeita a escolha; o do Super Admin continua igual.
ALTER TABLE public.whatsapp_flows ADD COLUMN IF NOT EXISTS alerts_config jsonb;

CREATE OR REPLACE FUNCTION notif.alert_enabled(p_institution uuid, p_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT (f.alerts_config->>p_key)::boolean FROM whatsapp_flows f
      WHERE f.institution_id = p_institution ORDER BY f.updated_at DESC NULLS LAST LIMIT 1),
    p_key <> 'unanswered')
$$;
REVOKE ALL ON FUNCTION notif.alert_enabled(uuid, text) FROM PUBLIC, anon, authenticated;

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
  IF notif.alert_enabled(v_phone.institution_id, 'connection') THEN
    PERFORM notif.emit_alert(v_phone.institution_id, 'gestor', 'whatsapp_desconectado', 'conexao',
      'WhatsApp desconectou', v_body || ' Fale com a equipe Áion.', 'danger',
      '/settings?tab=whatsapp', v_key,
      jsonb_build_object('phone_number_id', p_phone_number_id, 'status', p_status));
  END IF;
  RETURN 'desconectado';
END $$;

CREATE OR REPLACE FUNCTION public.whatsapp_silence_check(p_now timestamptz DEFAULT now())
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hours numeric; v_eff numeric; v_on boolean; v_min_msgs int; v_min_days int; r record; n int := 0; v_key text; v_local date;
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
           bool_or(h.down_since IS NOT NULL) AS down,
           f.alerts_config AS acfg
      FROM phones ph
      JOIN vol v ON v.institution_id = ph.institution_id AND v.msgs >= v_min_msgs AND v.dias >= v_min_days
      JOIN institutions i ON i.id = ph.institution_id
      LEFT JOIN LATERAL (SELECT * FROM whatsapp_flows wf WHERE wf.institution_id = ph.institution_id
                          ORDER BY wf.updated_at DESC NULLS LAST LIMIT 1) f ON true
      LEFT JOIN whatsapp_phone_health h ON h.phone_number_id = ph.phone_number_id
     GROUP BY ph.institution_id, v.last_in, i.name, f.working_days, f.working_start, f.working_end, f.timezone, f.alerts_config
  LOOP
    v_local := (p_now AT TIME ZONE r.tz)::date;
    v_key := 'wa_silence:' || r.institution_id || ':' || v_local;
    -- chegou mensagem depois da que o aviso de hoje citou → resolve
    UPDATE notification_alerts SET resolved_at = p_now, resolved_reason = 'voltou a receber'
     WHERE dedupe_key = v_key AND resolved_at IS NULL
       AND r.last_in > (data->>'ultima_recebida')::timestamptz;
    v_on := coalesce((r.acfg->>'silence')::boolean, true);
    v_eff := CASE WHEN v_on THEN coalesce(nullif(r.acfg->>'silence_hours', '')::numeric, v_hours) ELSE v_hours END;
    CONTINUE WHEN r.down;
    CONTINUE WHEN r.institution_id = ANY (notif.ignored_institutions());
    CONTINUE WHEN NOT notif.in_working_hours(p_now, r.days, r.wstart, r.wend, r.tz);
    CONTINUE WHEN notif.working_seconds_between(r.last_in, p_now, r.days, r.wstart, r.wend, r.tz) < v_eff * 3600;
    IF notif.emit_alert(r.institution_id, 'superadmin', 'whatsapp_silencio', 'conexao',
         'WhatsApp sem mensagens — ' || r.name,
         'Nenhuma mensagem recebida há ' || v_eff || ' h de atendimento (última: '
           || to_char(r.last_in AT TIME ZONE r.tz, 'DD/MM HH24:MI') || '). Pode ser queda que a Meta não acusou.',
         'warning', '/super-admin/institutions/' || r.institution_id || '?tab=whatsapp', v_key,
         jsonb_build_object('ultima_recebida', r.last_in), true) IS NOT NULL THEN
      n := n + 1;
    END IF;
    IF v_on THEN
      PERFORM notif.emit_alert(r.institution_id, 'gestor', 'whatsapp_silencio', 'conexao',
        'WhatsApp sem mensagens',
        'Nenhuma mensagem recebida há ' || v_eff || ' h de atendimento (última: '
          || to_char(r.last_in AT TIME ZONE r.tz, 'DD/MM HH24:MI') || '). Confira o celular e fale com a equipe Áion.',
        'warning', '/settings?tab=whatsapp', v_key, jsonb_build_object('ultima_recebida', r.last_in), true);
    END IF;
  END LOOP;
  RETURN n;
END $$;

-- ── Modelo aprovado/recusado/pausado pela Meta (chamada pelo webhook) ──
CREATE OR REPLACE FUNCTION public.whatsapp_template_alert(p_institution uuid, p_template_def uuid, p_status text, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF p_status NOT IN ('approved', 'rejected', 'paused') THEN RETURN; END IF;
  IF p_institution = ANY (notif.ignored_institutions()) THEN RETURN; END IF;
  IF NOT notif.alert_enabled(p_institution, 'template') THEN RETURN; END IF;
  SELECT coalesce(display_name, name) INTO v_name FROM template_definitions WHERE id = p_template_def AND institution_id = p_institution;
  IF v_name IS NULL THEN RETURN; END IF;   -- só modelos criados pela própria escola
  PERFORM notif.emit_alert(p_institution, 'gestor', 'modelo_' || p_status, 'geral',
    CASE p_status WHEN 'approved' THEN 'Modelo aprovado: ' WHEN 'rejected' THEN 'Modelo recusado: ' ELSE 'Modelo pausado: ' END || v_name,
    CASE p_status WHEN 'approved' THEN 'A Meta aprovou o modelo. Já pode usar em Transmissões.'
                  WHEN 'rejected' THEN 'A Meta recusou o modelo. Motivo: ' || coalesce(p_reason, 'não informado') || '. Use "Duplicar para corrigir".'
                  ELSE 'A Meta pausou o modelo. Ele não pode ser enviado por enquanto.' END,
    CASE p_status WHEN 'approved' THEN 'success' ELSE 'warning' END,
    '/settings?tab=whatsapp&sec=modelos', 'tpl:' || p_template_def || ':' || p_status || ':' || to_char(now(), 'YYYYMMDDHH24'),
    jsonb_build_object('template_definition_id', p_template_def), true);
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_template_alert(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_template_alert(uuid, uuid, text, text) TO service_role;

-- ── Cliente esperando resposta ──
-- Conversa aberta em que a última mensagem é do cliente, sem resposta da equipe há N minutos
-- de atendimento. Um aviso por escola por dia, com a contagem do momento.
CREATE OR REPLACE FUNCTION public.whatsapp_unanswered_check(p_now timestamptz DEFAULT now())
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0; v_key text; v_min int; v_cnt int;
BEGIN
  FOR r IN
    SELECT f.institution_id, f.alerts_config,
           coalesce(f.working_days, ARRAY['MON', 'TUE', 'WED', 'THU', 'FRI']) AS days,
           coalesce(f.working_start, '07:00'::time) AS wstart, coalesce(f.working_end, '18:00'::time) AS wend,
           coalesce(nullif(f.timezone, ''), 'America/Sao_Paulo') AS tz
      FROM (SELECT DISTINCT ON (institution_id) * FROM whatsapp_flows ORDER BY institution_id, updated_at DESC NULLS LAST) f
     WHERE coalesce((f.alerts_config->>'unanswered')::boolean, false)
  LOOP
    CONTINUE WHEN r.institution_id = ANY (notif.ignored_institutions());
    CONTINUE WHEN NOT notif.in_working_hours(p_now, r.days, r.wstart, r.wend, r.tz);
    v_min := least(greatest(coalesce(nullif(r.alerts_config->>'unanswered_minutes', '')::int, 30), 5), 480);
    SELECT count(*) INTO v_cnt FROM whatsapp_conversations c
     WHERE c.institution_id = r.institution_id AND c.status IN ('open', 'waiting')
       AND coalesce(c.is_aion_inbox, false) = false AND coalesce(c.bot_active, false) = false
       AND c.last_customer_message_at IS NOT NULL
       AND c.last_customer_message_at >= p_now - interval '24 hours'
       AND c.last_customer_message_at >= coalesce(c.last_message_at, c.last_customer_message_at) - interval '1 second'
       AND notif.working_seconds_between(c.last_customer_message_at, p_now, r.days, r.wstart, r.wend, r.tz) >= v_min * 60;
    CONTINUE WHEN v_cnt = 0;
    v_key := 'wa_unanswered:' || r.institution_id || ':' || (p_now AT TIME ZONE r.tz)::date;
    IF notif.emit_alert(r.institution_id, 'gestor', 'cliente_esperando', 'geral',
         CASE WHEN v_cnt = 1 THEN '1 cliente esperando resposta' ELSE v_cnt || ' clientes esperando resposta' END,
         'Sem resposta da equipe há mais de ' || v_min || ' minutos de atendimento.', 'warning', '/whatsapp', v_key,
         jsonb_build_object('quantidade', v_cnt), true) IS NOT NULL THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_unanswered_check(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_unanswered_check(timestamptz) TO service_role;

-- Agendamento (aplicado direto no banco):
-- select cron.schedule('whatsapp-unanswered-check', '*/10 * * * *', $$select public.whatsapp_unanswered_check()$$);
