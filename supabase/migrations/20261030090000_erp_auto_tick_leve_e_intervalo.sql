-- Activesoft: sincronização automática mais frequente e sem descartar a leitura leve.
-- 1) A leitura leve (~991 alunos no Ágape) era comparada com a última COMPLETA (~1497) e cancelada por vir
--    abaixo de 70%. Agora cada modo é comparado com a última leitura do MESMO modo. Se ainda não existe
--    uma leve aceita, compara com a última completa exigindo ao menos 50%.
-- 2) Nova leitura quando a última com sucesso tem mais de 15 min (antes 60).
CREATE OR REPLACE FUNCTION public.erp_auto_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c record; r record; v_run uuid; v_prev int; v_read int; v_full boolean; v_hour int; v_key text;
  v_modo text; v_factor numeric;
BEGIN
  SELECT value INTO v_key FROM platform_settings WHERE key = 'service_role_key';
  v_hour := extract(hour FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int;
  FOR c IN
    SELECT ec.* FROM erp_connections ec
      JOIN student_base_settings s ON s.institution_id = ec.institution_id AND s.module_enabled
     WHERE ec.provider = 'activesoft' AND ec.auto_enabled AND ec.token_secret_id IS NOT NULL
       AND ec.auth_scheme IS NOT NULL AND ec.status IN ('ativa','pausada')
  LOOP
    BEGIN
      SELECT * INTO r FROM sync_runs WHERE institution_id = c.institution_id AND source = 'activesoft'
         AND status IN ('na_fila','rodando','aguardando_confirmacao') ORDER BY queued_at DESC LIMIT 1;
      IF FOUND THEN
        IF r.status = 'aguardando_confirmacao' THEN
          IF r.triggered_by <> 'sistema' THEN CONTINUE; END IF;   -- carga manual: a escola confere
          v_read := COALESCE((r.counts->>'alunos_lidos')::int, 0);
          v_modo := COALESCE(r.counts->>'modo', 'completa');
          v_factor := 0.7;
          SELECT COALESCE((counts->>'alunos_lidos')::int, 0) INTO v_prev FROM sync_runs
           WHERE institution_id = c.institution_id AND source = 'activesoft' AND status IN ('ok','ok_com_avisos')
             AND COALESCE(counts->>'modo', 'completa') = v_modo
           ORDER BY finished_at DESC LIMIT 1;
          IF v_prev IS NULL AND v_modo = 'leve' THEN
            SELECT COALESCE((counts->>'alunos_lidos')::int, 0) INTO v_prev FROM sync_runs
             WHERE institution_id = c.institution_id AND source = 'activesoft' AND status IN ('ok','ok_com_avisos')
             ORDER BY finished_at DESC LIMIT 1;
            v_factor := 0.5;
          END IF;
          IF v_prev IS NULL OR v_prev = 0 OR v_read < v_factor * v_prev THEN
            PERFORM base_erp_cancel(c.institution_id, r.id);
            UPDATE erp_connections SET auto_state = 'A leitura veio muito menor que a anterior; nada foi aplicado',
                   last_error = 'Sincronização automática cancelada: leitura incompleta', last_error_at = now()
             WHERE institution_id = c.institution_id AND provider = 'activesoft';
          ELSE
            PERFORM base_erp_apply(c.institution_id, r.id);
            UPDATE erp_connections SET auto_state = 'ok', last_error = NULL,
                   auto_last_full_at = CASE WHEN v_modo = 'leve' THEN auto_last_full_at ELSE now() END
             WHERE institution_id = c.institution_id AND provider = 'activesoft';
          END IF;
        ELSIF c.auto_last_ping IS NULL OR c.auto_last_ping < now() - interval '55 seconds' THEN
          UPDATE erp_connections SET auto_last_ping = now() WHERE institution_id = c.institution_id AND provider = 'activesoft';
          PERFORM net.http_post(
            url := 'https://syxxuumxkhhnoqrxporj.supabase.co/functions/v1/erp-activesoft-sync',
            headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
            body := jsonb_build_object('action','step','institution_id',c.institution_id,'run_id',r.id));
        END IF;
        CONTINUE;
      END IF;
      -- nada em andamento: está na hora de uma nova?
      IF c.last_error_at IS NOT NULL AND c.last_error_at > now() - interval '30 minutes'
         AND (c.last_success_at IS NULL OR c.last_error_at > c.last_success_at) THEN CONTINUE; END IF;   -- espera depois de erro
      v_full := v_hour BETWEEN 2 AND 4 AND (c.auto_last_full_at IS NULL OR c.auto_last_full_at < now() - interval '20 hours');
      IF v_full OR c.last_success_at IS NULL OR c.last_success_at < now() - interval '15 minutes' THEN
        v_run := base_erp_start(c.institution_id, true);
        UPDATE sync_runs SET triggered_by = 'sistema', counts = counts || jsonb_build_object('modo', CASE WHEN v_full THEN 'completa' ELSE 'leve' END)
         WHERE id = v_run;
        UPDATE erp_connections SET auto_state = CASE WHEN v_full THEN 'lendo (completa)' ELSE 'lendo (leve)' END
         WHERE institution_id = c.institution_id AND provider = 'activesoft';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      UPDATE erp_connections SET auto_state = 'erro: ' || left(SQLERRM, 200), last_error = left(SQLERRM, 300), last_error_at = now()
       WHERE institution_id = c.institution_id AND provider = 'activesoft';
    END;
  END LOOP;
END $function$;
