-- =============================================================================
-- ENSAIO da migration 20261014100000_etapa_c_activesoft.sql.
-- Montagem: migration + este arquivo numa transação. O RAISE do fim desfaz TUDO.
-- Escola de teste: Colégio Áion (sem alunos). O Ágape não é tocado.
-- Perfis: admin Áion 1e86d8b6…, atendente Áion 39f0b70d…, admin Santa Teresa 4dff20a1….
-- A edge function é simulada: a área de espera recebe o que ela gravaria
-- (registros já normalizados, só campos permitidos, sem nomes).
--
-- Cenário: planilha 2025 com P1, P2, P3 (Aprovado). Activesoft depois:
--   101 = P1 → 2026 1º Ano cursando (cruza pela matrícula → rematriculado)
--   102 = P2 → 2025 Transferido (planilha dizia Aprovado → DIVERGÊNCIA, só aviso)
--   103 = N1 → 2026 Infantil I cursando (novato)
--   104 = N2 → unidade 2 (fica de fora pelo filtro de unidades)
--   105 = N3 → série "Robótica" (não reconhecida → mapeada à mão para 2º Ano)
-- =============================================================================
DO $t$
DECLARE
  v_aion  uuid := '169b10a1-024d-4ac8-b3a8-199f34d1f360';
  v_st    uuid := (SELECT id FROM institutions WHERE name LIKE 'COLEGIO SANTA TERESA%');
  v_agape uuid := (SELECT id FROM institutions WHERE name = 'Colégio Ágape Patos');
  v_admin text := '1e86d8b6-31f4-428d-811d-fe167aa9fa30';
  v_user  text := '39f0b70d-81ae-4618-a001-09b0d1f7f82f';
  v_stadm text := '4dff20a1-7000-489b-b9f2-e59bd272fd7c';
  r jsonb := '{}'::jsonb;
  s jsonb;
  n int; n2 int;
  v_run uuid; v_run2 uuid;
  v_p1 uuid;
  v_agape_before text;
  v_ef2 uuid := (SELECT id FROM school_grade_levels WHERE institution_id = '169b10a1-024d-4ac8-b3a8-199f34d1f360' AND base_grade_key(name) = 'ef2' LIMIT 1);
BEGIN
  -- retrato do Ágape (não pode mudar)
  SELECT md5(string_agg(e.id::text || e.status || e.source, ',' ORDER BY e.id)) INTO v_agape_before FROM class_enrollments e WHERE e.institution_id = v_agape;

  -- módulo liberado só dentro do ensaio
  INSERT INTO student_base_settings (institution_id, module_enabled) VALUES (v_aion, true)
  ON CONFLICT (institution_id) DO UPDATE SET module_enabled = true;

  -- ── 1. Trava de nomes ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || jsonb_build_object('N01_nomes_bloqueados_por_padrao', NOT base_names_allowed(v_aion));
  BEGIN PERFORM base_set_names_allowed(v_aion, true); r := r || '{"N02_admin_libera_nomes_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"N02_admin_libera_nomes_BLOQUEADO":true}'; END;
  s := base_import_roster(v_aion, 2025, '[
    {"linha":1,"matricula":"P1","nome":"Nome Ficticio Um","responsavel":"Resp Ficticio","serie":"Infantil V","ano":"2025","situacao":"Aprovado"},
    {"linha":2,"matricula":"P2","nome":"Nome Ficticio Dois","serie":"1º Ano","ano":"2025","situacao":"Aprovado"},
    {"linha":3,"matricula":"P3","serie":"2º Ano","ano":"2025","situacao":"Aprovado"}]'::jsonb, false, 'ensaio.csv');
  RESET ROLE;
  r := r || jsonb_build_object('N03_nomes_descartados_mesmo_com_caixa', (s->>'nomes_descartados')::int = 2
          AND NOT EXISTS (SELECT 1 FROM students WHERE institution_id = v_aion AND full_name LIKE 'Nome Ficticio%')
          AND NOT EXISTS (SELECT 1 FROM guardians WHERE institution_id = v_aion));
  r := r || jsonb_build_object('N04_planilha_continua_igual', (s->>'alunos_novos_no_ano')::int = 3);

  -- ── 2. Conexão (token fictício no Vault, desfeito no fim) ──
  INSERT INTO erp_connections (institution_id, provider, token_secret_id, token_last4, status, auth_scheme)
  VALUES (v_aion, 'activesoft', vault.create_secret('token-ficticio-ensaio', 'erp_ensaio_' || extract(epoch FROM clock_timestamp())::text), 'saio', 'pausada', 'Bearer');
  BEGIN UPDATE erp_connections SET api_base_url = 'https://evil.example.com/api' WHERE institution_id = v_aion;
        r := r || '{"C01_endereco_fora_do_activesoft_RECUSADO":false}';
  EXCEPTION WHEN check_violation THEN r := r || '{"C01_endereco_fora_do_activesoft_RECUSADO":true}'; END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM erp_connection_token(v_aion, 'activesoft'); r := r || '{"C02_navegador_le_token_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"C02_navegador_le_token_BLOQUEADO":true}'; END;
  BEGIN PERFORM count(*) FROM erp_staging; r := r || '{"C03_navegador_le_area_de_espera_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"C03_navegador_le_area_de_espera_BLOQUEADO":true}'; END;
  v_run := base_erp_start(v_aion);
  r := r || jsonb_build_object('C04_primeira_carga_so_conta', (SELECT kind FROM sync_runs WHERE id = v_run) = 'dry_run_contagem');
  r := r || jsonb_build_object('C05_iniciar_de_novo_retoma_a_mesma', base_erp_start(v_aion) = v_run);
  RESET ROLE;

  -- atendente e outra escola
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM base_erp_start(v_aion); r := r || '{"C06_atendente_inicia_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"C06_atendente_inicia_BLOQUEADO":true}'; END;
  RESET ROLE;

  -- ── 3. Simula a edge function: área de espera ──
  INSERT INTO erp_staging (run_id, institution_id, entity, external_id, data) VALUES
    (v_run, v_aion, 'unidade', '1', '{"id":"1","nome":"Sede"}'),
    (v_run, v_aion, 'unidade', '2', '{"id":"2","nome":"Anexo"}'),
    (v_run, v_aion, 'turma', 'T1', '{"id":"T1","nome":"1º Ano A","serie_id":"S1","serie_nome":"1º Ano","curso_nome":"Ensino Fundamental I","unidade_id":"1","ano":"2026"}'),
    (v_run, v_aion, 'turma', 'T2', '{"id":"T2","nome":"Infantil I A","serie_id":"S0","serie_nome":"Infantil I","curso_nome":"Educação Infantil","unidade_id":"1","ano":"2026"}'),
    (v_run, v_aion, 'turma', 'T3', '{"id":"T3","nome":"2º Ano B","serie_id":"S2","serie_nome":"2º Ano","curso_nome":"Ensino Fundamental I","unidade_id":"2","ano":"2026"}'),
    (v_run, v_aion, 'turma', 'T4', '{"id":"T4","nome":"1º Ano A","serie_id":"S1","serie_nome":"1º Ano","curso_nome":"Ensino Fundamental I","unidade_id":"1","ano":"2025"}'),
    (v_run, v_aion, 'turma', 'T5', '{"id":"T5","nome":"Robótica X","serie_id":"SR","serie_nome":"Robótica","curso_nome":"Extra","unidade_id":"1","ano":"2026"}'),
    (v_run, v_aion, 'enturmacao', 'E1', '{"aluno_id":"101","turma_id":"T1","ano":"2026","situacao":"Cursando","situacao_sistema":"A"}'),
    (v_run, v_aion, 'enturmacao', 'E2', '{"aluno_id":"102","turma_id":"T4","ano":"2025","situacao":"Transferido","situacao_sistema":"I"}'),
    (v_run, v_aion, 'enturmacao', 'E3', '{"aluno_id":"103","turma_id":"T2","ano":"2026","situacao":"Cursando","situacao_sistema":"A"}'),
    (v_run, v_aion, 'enturmacao', 'E4', '{"aluno_id":"104","turma_id":"T3","ano":"2026","situacao":"Cursando","situacao_sistema":"A"}'),
    (v_run, v_aion, 'enturmacao', 'E5', '{"aluno_id":"105","turma_id":"T5","ano":"2026","situacao_sistema":"P"}'),
    (v_run, v_aion, 'aluno', '101', '{"id":"101","matricula":"P1"}'),
    (v_run, v_aion, 'aluno', '102', '{"id":"102","matricula":"P2"}'),
    (v_run, v_aion, 'aluno', '103', '{"id":"103","matricula":"N1"}'),
    (v_run, v_aion, 'aluno', '104', '{"id":"104","matricula":"N2"}'),
    (v_run, v_aion, 'aluno', '105', '{"id":"105","matricula":"N3"}');
  UPDATE sync_runs SET status = 'aguardando_confirmacao', step = 'contagem' WHERE id = v_run;
  r := r || jsonb_build_object('C07_status_aguardando_confirmacao_aceito', (SELECT status FROM sync_runs WHERE id = v_run) = 'aguardando_confirmacao');

  -- ── 4. Mapeamento: unidades e séries ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  s := base_erp_mapping(v_aion, v_run);
  r := r || jsonb_build_object('M01_mapa_unidades_series', jsonb_array_length(s->'unidades') = 2 AND (s->>'alunos')::int = 5
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(s->'series') x WHERE x->>'serie_nome' = 'Robótica' AND x->>'grade_level_id' IS NULL)
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(s->'series') x WHERE x->>'serie_nome' = '1º Ano' AND x->>'como' = 'automatica'));
  PERFORM base_erp_set_units(v_aion, ARRAY['1']);
  PERFORM base_erp_set_grade(v_aion, 'SR', 'Extra / Robótica', v_ef2);
  s := base_erp_mapping(v_aion, v_run);
  r := r || jsonb_build_object('M02_unidade_2_fora_e_robotica_mapeada',
          EXISTS (SELECT 1 FROM jsonb_array_elements(s->'unidades') x WHERE x->>'id' = '2' AND (x->>'incluida')::boolean = false)
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(s->'series') x WHERE x->>'serie_nome' = 'Robótica' AND x->>'como' = 'escolhida'));

  -- ── 5. Contagem (não grava) ──
  SELECT count(*) INTO n FROM students WHERE institution_id = v_aion;
  s := base_erp_preview(v_aion, v_run);
  RESET ROLE;
  r := r || jsonb_build_object('P01_contagem_resumo', s - 'cruzamento' - 'ignoradas' - 'divergencias_amostra');
  r := r || jsonb_build_object('P02_contagem_NAO_grava', n = (SELECT count(*) FROM students WHERE institution_id = v_aion)
          AND (SELECT count(*) FROM erp_staging WHERE run_id = v_run) = 17
          AND (SELECT status FROM sync_runs WHERE id = v_run) = 'aguardando_confirmacao');
  r := r || jsonb_build_object('P03_contagem_certa', (s->>'linhas_lidas')::int = 4 AND (s->>'cruzados_pela_matricula')::int = 2
          AND (s->>'divergencias')::int = 1 AND (s->>'alunos_novos_na_base')::int = 2);

  -- outra escola
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_stadm, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM base_erp_preview(v_aion, v_run); r := r || '{"P04_outra_escola_contagem_BLOQUEADA":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"P04_outra_escola_contagem_BLOQUEADA":true}'; END;
  BEGIN PERFORM base_erp_apply(v_aion, v_run); r := r || '{"P05_outra_escola_grava_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"P05_outra_escola_grava_BLOQUEADO":true}'; END;
  RESET ROLE;

  -- ── 6. Confirmação: grava, cruza, não duplica ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  s := base_erp_apply(v_aion, v_run);
  RESET ROLE;
  SELECT id INTO v_p1 FROM students WHERE institution_id = v_aion AND registration_code = 'P1';
  r := r || jsonb_build_object('A01_nao_duplica', (SELECT count(*) FROM students WHERE institution_id = v_aion) = 5
          AND (SELECT count(*) FROM students WHERE institution_id = v_aion AND registration_code IN ('P1', 'P2')) = 2);
  r := r || jsonb_build_object('A02_origem_dupla_P1',
          (SELECT array_agg(source ORDER BY source) FROM student_external_ids WHERE student_id = v_p1) = ARRAY['activesoft', 'planilha']);
  r := r || jsonb_build_object('A03_divergencia_vira_aviso', (SELECT status FROM sync_runs WHERE id = v_run) = 'ok_com_avisos'
          AND (s->>'divergencias')::int = 1
          AND (SELECT status FROM class_enrollments e JOIN students x ON x.id = e.student_id
                WHERE x.institution_id = v_aion AND x.registration_code = 'P2' AND e.academic_year = 2025) = 'transferido');
  r := r || jsonb_build_object('A04_area_de_espera_apagada', NOT EXISTS (SELECT 1 FROM erp_staging WHERE run_id = v_run));
  r := r || jsonb_build_object('A05_conexao_ativa', (SELECT status FROM erp_connections WHERE institution_id = v_aion) = 'ativa');
  r := r || jsonb_build_object('A06_unidade_2_fora', NOT EXISTS (SELECT 1 FROM students WHERE institution_id = v_aion AND registration_code = 'N2'));
  r := r || jsonb_build_object('A07_robotica_foi_pro_2o_ano',
          (SELECT e.grade_level_id FROM class_enrollments e JOIN students x ON x.id = e.student_id
            WHERE x.institution_id = v_aion AND x.registration_code = 'N3') = v_ef2);
  r := r || jsonb_build_object('A08_categorias_2026', (SELECT string_agg(registration_code || '=' || category, ' ' ORDER BY registration_code)
          FROM v_base_reenrollment WHERE institution_id = v_aion AND target_year = 2026));

  -- ── 7. Próxima carga e reenvio da planilha ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_run2 := base_erp_start(v_aion);
  r := r || jsonb_build_object('R01_proxima_carga_completa_com_confirmacao', (SELECT kind FROM sync_runs WHERE id = v_run2) = 'completa');
  PERFORM base_erp_cancel(v_aion, v_run2);
  s := base_import_roster(v_aion, 2025, '[{"linha":1,"matricula":"P1","serie":"Infantil V","ano":"2025","situacao":"Aprovado"}]'::jsonb, false, 'ensaio2.csv');
  SELECT count(*) INTO n FROM base_reenrollment_list(v_aion, 2026) WHERE registration_code = 'P1' AND origins = ARRAY['activesoft', 'planilha'];
  RESET ROLE;
  r := r || jsonb_build_object('R02_planilha_depois_da_api_nao_duplica', (SELECT count(*) FROM students WHERE institution_id = v_aion) = 5);
  r := r || jsonb_build_object('R03_lista_mostra_origens', n = 1);

  -- ── 8. Ágape intocado ──
  r := r || jsonb_build_object('Z01_agape_intocado', v_agape_before =
          (SELECT md5(string_agg(e.id::text || e.status || e.source, ',' ORDER BY e.id)) FROM class_enrollments e WHERE e.institution_id = v_agape));

  RAISE EXCEPTION 'ENSAIO_ETAPA_C %', r::text;
END $t$;
