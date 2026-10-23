CREATE OR REPLACE FUNCTION public.broadcast_set_schedule(p_campaign_id uuid, p_dates date[], p_start time, p_end time)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_inst uuid; v_status text; v_tz text; v_today date; v_dates date[];
BEGIN
  SELECT institution_id, status, COALESCE(send_tz, 'America/Fortaleza') INTO v_inst, v_status, v_tz
    FROM broadcast_campaigns WHERE id = p_campaign_id;
  IF v_inst IS NULL THEN RAISE EXCEPTION 'Campanha não encontrada' USING ERRCODE = 'P0002'; END IF;
  IF NOT broadcast_user_can_manage(v_inst) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  IF v_status <> 'draft' THEN RAISE EXCEPTION 'A agenda só pode ser definida em campanha em rascunho'; END IF;
  v_today := (now() AT TIME ZONE v_tz)::date;
  SELECT array_agg(DISTINCT d ORDER BY d) INTO v_dates FROM unnest(p_dates) d;
  IF v_dates IS NOT NULL THEN
    IF v_dates[1] < v_today THEN RAISE EXCEPTION 'Escolha dias a partir de hoje'; END IF;
    IF v_dates[cardinality(v_dates)] > v_today + 60 THEN RAISE EXCEPTION 'Escolha dias nos próximos 60 dias'; END IF;
  END IF;
  IF (p_start IS NULL) <> (p_end IS NULL) THEN RAISE EXCEPTION 'Informe o horário inicial e o final'; END IF;
  IF p_start IS NOT NULL AND p_start >= p_end THEN RAISE EXCEPTION 'O horário final precisa ser depois do inicial'; END IF;
  UPDATE broadcast_campaigns SET send_dates = v_dates, send_window_start = p_start, send_window_end = p_end, updated_at = now()
   WHERE id = p_campaign_id;
END $function$;
REVOKE EXECUTE ON FUNCTION public.broadcast_set_schedule(uuid, date[], time, time) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_set_schedule(uuid, date[], time, time) TO authenticated;
