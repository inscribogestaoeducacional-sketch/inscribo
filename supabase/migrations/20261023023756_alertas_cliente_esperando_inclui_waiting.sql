-- Alerta "cliente esperando": conversas em status 'open' e também 'waiting' (fila geral) entram na contagem.
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
