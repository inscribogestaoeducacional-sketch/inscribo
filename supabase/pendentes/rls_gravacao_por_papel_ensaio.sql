-- =============================================================================
-- ENSAIO da migration 20261013110000_rls_gravacao_por_papel.sql (testes).
-- Montagem: migration + este arquivo. O RAISE do fim desfaz TUDO.
-- Perfis reais simulados (request.jwt.claims + SET LOCAL ROLE authenticated):
--   atendente Ágape 7edcaa5a…, admin Ágape 0c8808a5…,
--   gestor Santa Teresa a93bebd8…, admin Santa Teresa 4dff20a1….
-- =============================================================================
DO $t$
DECLARE
  v_agape uuid := (SELECT id FROM institutions WHERE name = 'Colégio Ágape Patos');
  v_st    uuid := (SELECT id FROM institutions WHERE name LIKE 'COLEGIO SANTA TERESA%');
  r jsonb := '{}'::jsonb;
  n int;
BEGIN
  -- ── A. ATENDENTE da Ágape: nada de configuração; resposta rápida PRÓPRIA sim ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '7edcaa5a-e9cb-42e1-a608-66b86a23f8ca', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN INSERT INTO whatsapp_tags (institution_id, name) VALUES (v_agape, 'ensaio'); r := r || '{"A1_atendente_cria_etiqueta_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"A1_atendente_cria_etiqueta_BLOQUEADO":true}'; END;
  BEGIN INSERT INTO whatsapp_blacklist (institution_id, phone_number) VALUES (v_agape, '5583900000000'); r := r || '{"A2_atendente_bloqueia_numero_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"A2_atendente_bloqueia_numero_BLOQUEADO":true}'; END;
  UPDATE whatsapp_groups SET name = name WHERE institution_id = v_agape; GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('A3_atendente_altera_grupos_BLOQUEADO', n = 0);
  UPDATE whatsapp_flows SET satisfaction_message = satisfaction_message WHERE institution_id = v_agape; GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('A4_atendente_altera_config_whatsapp_BLOQUEADO', n = 0);
  BEGIN INSERT INTO school_grade_levels (institution_id, name) VALUES (v_agape, 'ensaio'); r := r || '{"A5_atendente_cria_serie_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"A5_atendente_cria_serie_BLOQUEADO":true}'; END;
  UPDATE institutions SET city = city WHERE id = v_agape; GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('A6_atendente_altera_cadastro_escola_BLOQUEADO', n = 0);
  BEGIN INSERT INTO whatsapp_quick_replies (institution_id, user_id, title, message)
        VALUES (v_agape, '7edcaa5a-e9cb-42e1-a608-66b86a23f8ca', 'ensaio', 'ensaio'); r := r || '{"A7_atendente_cria_resposta_PROPRIA_LIBERADO":true}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"A7_atendente_cria_resposta_PROPRIA_LIBERADO":false}'; END;
  BEGIN INSERT INTO whatsapp_quick_replies (institution_id, user_id, title, message) VALUES (v_agape, NULL, 'ensaio', 'ensaio');
        r := r || '{"A8_atendente_cria_resposta_DA_ESCOLA_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"A8_atendente_cria_resposta_DA_ESCOLA_BLOQUEADO":true}'; END;
  SELECT count(*) INTO n FROM whatsapp_tags WHERE institution_id = v_agape;
  r := r || jsonb_build_object('A9_atendente_continua_LENDO_etiquetas', n > 0);
  RESET ROLE;

  -- ── B. GESTOR do Santa Teresa: o que settingsAccess libera, nada além ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'a93bebd8-bc85-4630-b535-c7bc19ffcd51', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN INSERT INTO whatsapp_tags (institution_id, name) VALUES (v_st, 'ensaio'); r := r || '{"B1_gestor_cria_etiqueta_LIBERADO":true}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"B1_gestor_cria_etiqueta_LIBERADO":false}'; END;
  BEGIN INSERT INTO whatsapp_blacklist (institution_id, phone_number) VALUES (v_st, '5588900000000'); r := r || '{"B2_gestor_bloqueia_numero_LIBERADO":true}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"B2_gestor_bloqueia_numero_LIBERADO":false}'; END;
  UPDATE whatsapp_flows SET timeout_minutes = COALESCE(timeout_minutes, 0) + 1 WHERE institution_id = v_st; GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('B3_gestor_altera_tempo_inatividade_LIBERADO', n = 1);
  BEGIN UPDATE whatsapp_flows SET working_start = '06:00' WHERE institution_id = v_st; r := r || '{"B4_gestor_altera_horario_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"B4_gestor_altera_horario_BLOQUEADO":true}'; END;
  UPDATE institutions SET city = city || '' WHERE id = v_st; GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('B5_gestor_altera_cidade_LIBERADO', n = 1);
  BEGIN UPDATE institutions SET name = name || ' x' WHERE id = v_st; r := r || '{"B6_gestor_altera_nome_escola_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"B6_gestor_altera_nome_escola_BLOQUEADO":true}'; END;
  UPDATE school_grade_levels SET name = name WHERE institution_id = v_st; GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('B7_gestor_altera_series_LIBERADO', n > 0);
  BEGIN INSERT INTO whatsapp_quick_replies (institution_id, user_id, title, message) VALUES (v_st, NULL, 'ensaio', 'ensaio');
        r := r || '{"B8_gestor_cria_resposta_da_escola_LIBERADO":true}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"B8_gestor_cria_resposta_da_escola_LIBERADO":false}'; END;
  RESET ROLE;

  -- ── C. ADMIN de OUTRA escola (Santa Teresa) tentando mexer na Ágape ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '4dff20a1-7000-489b-b9f2-e59bd272fd7c', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE whatsapp_flows SET satisfaction_message = satisfaction_message WHERE institution_id = v_agape; GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('C1_outra_escola_altera_config_BLOQUEADO', n = 0);
  BEGIN INSERT INTO whatsapp_tags (institution_id, name) VALUES (v_agape, 'ensaio'); r := r || '{"C2_outra_escola_cria_etiqueta_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"C2_outra_escola_cria_etiqueta_BLOQUEADO":true}'; END;
  UPDATE institutions SET city = city WHERE id = v_agape; GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('C3_outra_escola_altera_cadastro_BLOQUEADO', n = 0);
  UPDATE whatsapp_groups SET name = name WHERE institution_id = v_agape; GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('C4_outra_escola_altera_grupos_BLOQUEADO', n = 0);
  RESET ROLE;

  -- ── D. ADMIN da Ágape: tudo que é da escola; plano/cobrança não ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '0c8808a5-7a78-44de-8e1f-90e06dd7ba38', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE whatsapp_flows SET working_start = working_start WHERE institution_id = v_agape; GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('D1_admin_altera_horario_LIBERADO', n = 1);
  UPDATE institutions SET name = name, logo_url = logo_url WHERE id = v_agape; GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('D2_admin_altera_nome_e_logo_LIBERADO', n = 1);
  BEGIN UPDATE institutions SET plan_status = 'active', monthly_value = 1 WHERE id = v_agape; r := r || '{"D3_admin_altera_plano_cobranca_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"D3_admin_altera_plano_cobranca_BLOQUEADO":true}'; END;
  BEGIN INSERT INTO whatsapp_tags (institution_id, name) VALUES (v_agape, 'ensaio admin'); r := r || '{"D4_admin_cria_etiqueta_LIBERADO":true}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"D4_admin_cria_etiqueta_LIBERADO":false}'; END;
  RESET ROLE;

  -- ── E. Servidor (service role / sem auth.uid): continua podendo tudo ──
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE institutions SET plan_status = plan_status WHERE id = v_agape; GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('E1_servidor_altera_plano_LIBERADO', n = 1);

  RAISE EXCEPTION 'ENSAIO_RLS %', r::text;
END $t$;
