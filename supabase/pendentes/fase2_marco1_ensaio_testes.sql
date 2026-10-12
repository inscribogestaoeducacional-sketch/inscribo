-- =============================================================================
-- FASE 2 · MARCO 1 — testes do ENSAIO. Montagem:
--   migrations/20261012200000_fase2_base_alunos_marco1.sql + este arquivo
-- O RAISE do fim aborta tudo: NADA fica gravado (nem o segredo de teste no Vault).
-- Simula perfis com request.jwt.claims + SET LOCAL ROLE (mesmo jeito que o
-- PostgREST faz), pra testar RLS e GRANT de coluna de verdade.
-- Ids reais (12/10): Ágape admin 0c8808a5…, Ágape atendente 7edcaa5a…,
-- Santa Teresa admin 4dff20a1….
-- =============================================================================
DO $t$
DECLARE
  v_agape  uuid := (SELECT id FROM institutions WHERE name = 'Colégio Ágape Patos');
  v_admin  text := '0c8808a5-7a78-44de-8e1f-90e06dd7ba38';
  v_atend  text := '7edcaa5a-e9cb-42e1-a608-66b86a23f8ca';
  v_outro  text := '4dff20a1-7000-489b-b9f2-e59bd272fd7c';
  g1 uuid; g2 uuid;
  s1 uuid; s2 uuid; s3 uuid; s4 uuid;
  r  jsonb := '{}'::jsonb;
  n  int;
  ok boolean;
  v_txt text;
BEGIN
  SELECT id INTO g1 FROM school_grade_levels WHERE institution_id = v_agape ORDER BY sort_order LIMIT 1;
  SELECT id INTO g2 FROM school_grade_levels WHERE institution_id = v_agape ORDER BY sort_order OFFSET 1 LIMIT 1;

  -- ── t1. admin da Ágape lança números de 2 séries ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  n := base_save_aggregate(v_agape, 2099, (now() AT TIME ZONE 'America/Sao_Paulo')::date,
         jsonb_build_array(
           jsonb_build_object('grade_level_id', g1, 'enrolled_total', 20, 'reenrolled', 15, 'prematricula', 2, 'new_students', 3, 'capacity', 25),
           jsonb_build_object('grade_level_id', g2, 'enrolled_total', 18, 'reenrolled', 10, 'capacity', 25)), 'teste ensaio');
  r := r || jsonb_build_object('t1_admin_lanca_2_series', n = 2);
  SELECT count(*) INTO n FROM v_base_year_grade_stats WHERE institution_id = v_agape AND academic_year = 2099 AND level = 'agregado' AND seal = 'manual';
  r := r || jsonb_build_object('t2_visao_mostra_2_linhas_agregado_manual', n = 2);
  SELECT count(*) INTO n FROM sync_runs WHERE institution_id = v_agape AND kind = 'agregado';
  r := r || jsonb_build_object('t3_log_em_sync_runs', n >= 1);

  -- ── t4. token vai pro Vault; navegador não lê o id do segredo ──
  PERFORM erp_connection_save_token(v_agape, 'activesoft', 'TOKEN-DE-TESTE-12345678', NULL);
  SELECT token_last4 = '5678' AND status = 'pausada' INTO ok FROM erp_connections WHERE institution_id = v_agape;
  r := r || jsonb_build_object('t4_token_salvo_last4_pausada', COALESCE(ok, false));
  BEGIN
    EXECUTE 'SELECT token_secret_id FROM erp_connections LIMIT 1';
    r := r || jsonb_build_object('t5_navegador_nao_le_secret_id', false);
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || jsonb_build_object('t5_navegador_nao_le_secret_id', true);
  END;
  BEGIN
    PERFORM base_cpf_hmac('123.456.789-09');
    r := r || jsonb_build_object('t6_navegador_nao_calcula_hmac', false);
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || jsonb_build_object('t6_navegador_nao_calcula_hmac', true);
  END;
  BEGIN
    INSERT INTO students (institution_id, full_name, name_key, source) VALUES (v_agape, 'x', 'x', 'manual');
    r := r || jsonb_build_object('t7_navegador_nao_insere_direto', false);
  EXCEPTION WHEN insufficient_privilege OR others THEN
    r := r || jsonb_build_object('t7_navegador_nao_insere_direto', true);
  END;
  BEGIN
    UPDATE class_aggregates SET enrolled_total = 99 WHERE institution_id = v_agape;
    GET DIAGNOSTICS n = ROW_COUNT;
    r := r || jsonb_build_object('t8_retrato_nao_muda_pelo_navegador', n = 0);
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('t8_retrato_nao_muda_pelo_navegador', true);
  END;
  RESET ROLE;

  -- ── t9. atendente da Ágape não lê nem lança ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_atend, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM class_aggregates;
  r := r || jsonb_build_object('t9_atendente_nao_le_base', n = 0);
  BEGIN
    PERFORM base_save_aggregate(v_agape, 2099, (now() AT TIME ZONE 'America/Sao_Paulo')::date, '[]'::jsonb);
    r := r || jsonb_build_object('t10_atendente_nao_lanca', false);
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || jsonb_build_object('t10_atendente_nao_lanca', true);
  END;
  RESET ROLE;

  -- ── t11. admin de OUTRA escola não vê nem lança na Ágape ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_outro, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM class_aggregates WHERE institution_id = v_agape;
  r := r || jsonb_build_object('t11_outra_escola_nao_le', n = 0);
  SELECT count(*) INTO n FROM v_base_year_grade_stats WHERE institution_id = v_agape;
  r := r || jsonb_build_object('t12_outra_escola_nao_ve_na_visao', n = 0);
  BEGIN
    PERFORM erp_connection_save_token(v_agape, 'activesoft', 'OUTRA-ESCOLA-9999', NULL);
    r := r || jsonb_build_object('t13_outra_escola_nao_troca_token', false);
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || jsonb_build_object('t13_outra_escola_nao_troca_token', true);
  END;
  RESET ROLE;

  -- ── t14. anon não lê nada ──
  SET LOCAL ROLE anon;
  BEGIN
    EXECUTE 'SELECT count(*) FROM class_aggregates';
    r := r || jsonb_build_object('t14_anon_bloqueado', false);
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || jsonb_build_object('t14_anon_bloqueado', true);
  END;
  RESET ROLE;

  -- ── t15. nível aluno (dados fictícios, anos 2098/2099): visões e imutabilidade ──
  UPDATE school_grade_levels SET next_grade_level_id = g2 WHERE id = g1;
  INSERT INTO students (institution_id, full_name, name_key, source) VALUES (v_agape, 'Teste Um', 'teste um', 'manual') RETURNING id INTO s1;
  INSERT INTO students (institution_id, full_name, name_key, source) VALUES (v_agape, 'Teste Dois', 'teste dois', 'manual') RETURNING id INTO s2;
  INSERT INTO students (institution_id, full_name, name_key, source) VALUES (v_agape, 'Teste Tres', 'teste tres', 'manual') RETURNING id INTO s3;
  INSERT INTO students (institution_id, full_name, name_key, source) VALUES (v_agape, 'Teste Quatro', 'teste quatro', 'manual') RETURNING id INTO s4;
  INSERT INTO class_enrollments (institution_id, student_id, academic_year, grade_level_id, status, source) VALUES
    (v_agape, s1, 2098, g1, 'ativo', 'manual'), (v_agape, s2, 2098, g1, 'ativo', 'manual'), (v_agape, s3, 2098, g1, 'ativo', 'manual'),
    (v_agape, s1, 2099, g2, 'ativo', 'manual'),          -- rematriculado na série seguinte
    (v_agape, s3, 2099, g1, 'ativo', 'manual'),          -- retido (mesma série)
    (v_agape, s4, 2099, g1, 'ativo', 'manual');          -- novato
  INSERT INTO student_base_coverage (institution_id, academic_year, source, level) VALUES
    (v_agape, 2098, 'manual', 'aluno'), (v_agape, 2099, 'manual', 'aluno')
  ON CONFLICT (institution_id, academic_year) DO UPDATE SET level = 'aluno';
  SELECT COALESCE(sum(reenrolled), 0) = 2 AND COALESCE(sum(new_students), 0) = 1 INTO ok
    FROM v_base_year_grade_stats WHERE institution_id = v_agape AND academic_year = 2099;
  r := r || jsonb_build_object('t15_aluno_rematriculados_2_novato_1', COALESCE(ok, false));
  SELECT string_agg(f.destino || '=' || f.n, ',' ORDER BY f.destino) INTO v_txt FROM v_base_flow f WHERE f.institution_id = v_agape AND f.from_year = 2098;
  r := r || jsonb_build_object('t16_fluxo', v_txt);
  INSERT INTO student_status_events (institution_id, student_id, academic_year, to_status, event_date, date_source, source)
  VALUES (v_agape, s2, 2099, 'transferido', current_date, 'detectado_na_carga', 'manual');
  BEGIN
    UPDATE student_status_events SET to_status = 'ativo' WHERE student_id = s2;
    r := r || jsonb_build_object('t17_evento_imutavel', false);
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('t17_evento_imutavel', true);
  END;

  RAISE EXCEPTION 'ENSAIO_FASE2_MARCO1 %', r::text;
END $t$;
