-- =============================================================================
-- FASE 0A — parte final do ENSAIO. Montagem (gerada, não editar à mão):
--   fase0a_ensaio_inicio.sql  (fotografia "antes")
--   + migrations/20261011120000_fase0a_fonte_numeros.sql
--   + pendentes/fase0a_backfill.sql
--   + este arquivo (testes dos gatilhos + relatório)
-- O RAISE EXCEPTION do fim aborta a transação: NADA fica gravado.
-- =============================================================================
DO $$
DECLARE
  v_rep   jsonb := '{}'::jsonb;
  v_lead  record;
  v_tests jsonb := '{}'::jsonb;
  v_n     int;
  v_ok    boolean;
BEGIN
  -- ── Testes dos gatilhos num lead de teste (Colégio Áion) ──────────────────
  SELECT l.* INTO v_lead FROM leads l JOIN institutions i ON i.id = l.institution_id
   WHERE i.name = 'Colégio Áion' AND l.status = 'proposal' LIMIT 1;
  IF v_lead.id IS NOT NULL THEN
    UPDATE leads SET status = 'enrolled' WHERE id = v_lead.id;
    SELECT count(*) INTO v_n FROM enrollments WHERE lead_id = v_lead.id AND cancelled_at IS NULL;
    v_tests := v_tests || jsonb_build_object('t1_vira_matriculado_cria_1_matricula', v_n = 1);
    UPDATE leads SET status = 'enrolled', notes = coalesce(notes,'') WHERE id = v_lead.id;  -- mesmo status: não duplica
    SELECT count(*) INTO v_n FROM enrollments WHERE lead_id = v_lead.id;
    v_tests := v_tests || jsonb_build_object('t2_resalvar_nao_duplica', v_n = 1);
    UPDATE leads SET status = 'proposal' WHERE id = v_lead.id;
    SELECT count(*) INTO v_n FROM enrollments WHERE lead_id = v_lead.id AND cancelled_at IS NOT NULL;
    v_tests := v_tests || jsonb_build_object('t3_sair_de_matriculado_marca_desfeita', v_n = 1);
    UPDATE leads SET status = 'enrolled' WHERE id = v_lead.id;
    SELECT count(*) INTO v_n FROM enrollments WHERE lead_id = v_lead.id AND cancelled_at IS NULL;
    v_tests := v_tests || jsonb_build_object('t4_reabrir_matricula_reaproveita_linha', v_n = 1);
    SELECT count(*) INTO v_n FROM lead_status_history WHERE lead_id = v_lead.id AND source = 'app';
    v_tests := v_tests || jsonb_build_object('t5_historico_3_mudancas', v_n = 3);
    BEGIN
      UPDATE lead_status_history SET to_status = 'lost' WHERE lead_id = v_lead.id;
      v_tests := v_tests || jsonb_build_object('t6_historico_imutavel', false);
    EXCEPTION WHEN others THEN
      v_tests := v_tests || jsonb_build_object('t6_historico_imutavel', true);
    END;
    BEGIN
      INSERT INTO visits (institution_id, lead_id, student_name, scheduled_date, status)
      VALUES (v_lead.institution_id, v_lead.id, 'teste', now() - interval '1 year', 'scheduled');
      v_tests := v_tests || jsonb_build_object('t7_recusa_ano_absurdo', false);
    EXCEPTION WHEN check_violation THEN
      v_tests := v_tests || jsonb_build_object('t7_recusa_ano_absurdo', true);
    END;
    INSERT INTO visits (institution_id, lead_id, student_name, scheduled_date, status)
    VALUES (v_lead.institution_id, v_lead.id, 'teste', now() + interval '2 days', 'scheduled');
    UPDATE visits SET status = 'completed' WHERE lead_id = v_lead.id AND student_name = 'teste';
    SELECT count(*) INTO v_n FROM visits WHERE lead_id = v_lead.id AND student_name = 'teste' AND outcome_at IS NOT NULL;
    v_tests := v_tests || jsonb_build_object('t8_baixa_registra_quando', v_n = 1);
  ELSE
    v_tests := jsonb_build_object('aviso', 'sem lead de teste em proposta no Colégio Áion');
  END IF;

  -- ── Relatório por escola (antes x depois) ─────────────────────────────────
  SELECT jsonb_object_agg(x.escola, x.d) INTO v_rep FROM (
    SELECT i.name AS escola, jsonb_build_object(
      'leads_matriculados',          (SELECT count(*) FROM leads l WHERE l.institution_id = i.id AND l.status = 'enrolled' AND l.deleted_at IS NULL),
      'enrollments_antes',           (SELECT n_enr FROM fase0a_antes a WHERE a.institution_id = i.id),
      'enrollments_depois_ativas',   (SELECT count(*) FROM enrollments e WHERE e.institution_id = i.id AND e.cancelled_at IS NULL
                                        AND e.lead_id IS DISTINCT FROM v_lead.id),
      'por_data',                    (SELECT jsonb_object_agg(ds, n) FROM (SELECT coalesce(e.date_source,'?') ds, count(*) n FROM enrollments e
                                        WHERE e.institution_id = i.id AND e.lead_id IS DISTINCT FROM v_lead.id GROUP BY 1) z),
      'historico_status',            (SELECT jsonb_object_agg(src, n) FROM (SELECT h.source src, count(*) n FROM lead_status_history h
                                        WHERE h.institution_id = i.id AND h.lead_id IS DISTINCT FROM v_lead.id GROUP BY 1) z),
      'visitas_total',               (SELECT count(*) FROM visits v WHERE v.institution_id = i.id AND v.student_name IS DISTINCT FROM 'teste'),
      'visitas_com_resp_antes',      (SELECT n_vis_resp FROM fase0a_antes a WHERE a.institution_id = i.id),
      'visitas_com_resp_depois',     (SELECT count(*) FROM visits v WHERE v.institution_id = i.id AND v.assigned_to IS NOT NULL AND v.student_name IS DISTINCT FROM 'teste'),
      'visitas_passadas_sem_baixa',  (SELECT count(*) FROM visits v WHERE v.institution_id = i.id AND v.status = 'scheduled' AND v.scheduled_date < now()),
      'alertas_falsos_resolvidos',   (SELECT count(*) FROM system_notifications n WHERE n.institution_id = i.id AND n.resolved_at IS NOT NULL),
      'funil_antes',                 (SELECT funil FROM fase0a_antes a WHERE a.institution_id = i.id),
      'funil_depois',                (SELECT jsonb_object_agg(f.period, jsonb_build_array(f.registrations, f.schedules, f.visits, f.enrollments) ORDER BY f.period)
                                        FROM funnel_metrics f WHERE f.institution_id = i.id AND f.period ~ '^\d{4}-\d{2}$'
                                         AND f.period >= '2026-08')
    ) AS d
    FROM institutions i
    WHERE EXISTS (SELECT 1 FROM leads l WHERE l.institution_id = i.id)
  ) x;

  v_tests := v_tests || jsonb_build_object('visita_agape_2025_agora',
    (SELECT to_char(scheduled_date AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') FROM visits WHERE id = '7503e998-21e3-4641-875d-47d884920670'));
  v_tests := v_tests || jsonb_build_object('interacoes_calculadas',
    (SELECT count(*) FROM institutions i, lead_last_interactions(i.id) x WHERE x.last_interaction_at IS NOT NULL));

  RAISE EXCEPTION 'ENSAIO_FASE0A %', jsonb_build_object('testes', v_tests, 'escolas', v_rep)::text;
END $$;
