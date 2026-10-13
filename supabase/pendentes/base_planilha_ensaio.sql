-- =============================================================================
-- ENSAIO da migration 20261013130000_base_planilha_rematricula.sql.
-- Montagem: migration + este arquivo numa transação. O RAISE do fim desfaz TUDO.
-- Dados SINTÉTICOS (matrículas "ENS-…", sem coluna de nome), na Ágape.
-- Perfis reais simulados: admin Ágape 0c8808a5…, atendente Ágape 7edcaa5a…,
-- admin Santa Teresa 4dff20a1….
--
-- Cenário (2025 → 2026):
--   E1 Infantil I aprovado        → 2026 Infantil II cursando      = rematriculado
--   E2 5º Ano reprovado           → 2026 5º Ano pré-matrícula      = rematriculado (fica na série)
--   E3 9º Ano aprovado            → sem 2026                       = a rematricular (destino 1ª Série EM)
--   E4 3ª Série EM aprovado       → sem 2026                       = concluinte
--   E5 3ª Série EM reprovado      → sem 2026                       = a rematricular (destino 3ª Série)
--   E6 2º Ano aprovado            → 2026 Transferência             = saiu (da base)
--   E7 4º Ano Transferência 2025  → sem 2026                       = saiu (fora da base)
--   E8 6º Ano Cancelada 2025      → 2026 6º Ano cursando           = retorno
--   E9 1º Ano aprovado            → sem 2026 + marcação manual     = rematriculado (declarado)
--   N1 Infantil I / N2 1ª Série EM só em 2026                      = novatos
-- =============================================================================
DO $t$
DECLARE
  v_agape uuid := (SELECT id FROM institutions WHERE name = 'Colégio Ágape Patos');
  v_st    uuid := (SELECT id FROM institutions WHERE name LIKE 'COLEGIO SANTA TERESA%');
  r       jsonb := '{}'::jsonb;
  s       jsonb;
  n       int;
  n2      int;
  v_txt   text;
  v_e9    uuid;
  v_grade uuid;
  v_2025  jsonb := '[
    {"linha":1,"matricula":"ENS-E1","segmento":"Educação Infantil","serie":"Infantil I","ano":"2025","turma":"A","situacao":"Aprovado"},
    {"linha":2,"matricula":"ENS-E2","segmento":"Ensino Fundamental I","serie":"5º Ano","ano":"2025","turma":"A","situacao":"Reprovado"},
    {"linha":3,"matricula":"ENS-E3","segmento":"Ensino Fundamental II","serie":"9º Ano","ano":"2025","turma":"A","situacao":"Aprovado"},
    {"linha":4,"matricula":"ENS-E4","segmento":"Ensino Médio","serie":"3ª Série","ano":"2025","turma":"A","situacao":"Aprovado"},
    {"linha":5,"matricula":"ENS-E5","segmento":"Ensino Médio","serie":"3ª Série","ano":"2025","turma":"A","situacao":"Reprovado"},
    {"linha":6,"matricula":"ENS-E6","segmento":"Ensino Fundamental I","serie":"2º Ano","ano":"2025","turma":"B","situacao":"Aprovado"},
    {"linha":7,"matricula":"ENS-E7","segmento":"Ensino Fundamental I","serie":"4º Ano","ano":"2025","turma":"A","situacao":"Transferência"},
    {"linha":8,"matricula":"ENS-E8","segmento":"Ensino Fundamental II","serie":"6º Ano","ano":"2025","turma":"A","situacao":"Cancelada"},
    {"linha":9,"matricula":"ENS-E9","segmento":"Ensino Fundamental I","serie":"1º Ano","ano":"2025","turma":"A","situacao":"Aprovado"},
    {"linha":10,"matricula":"ENS-X1","segmento":"Curso Livre","serie":"Robótica","ano":"2025","turma":"A","situacao":"Aprovado"},
    {"linha":11,"matricula":"ENS-X2","segmento":"Ensino Fundamental I","serie":"3º Ano","ano":"2025","turma":"A","situacao":"Trancada"},
    {"linha":12,"matricula":"","segmento":"Ensino Fundamental I","serie":"3º Ano","ano":"2025","turma":"A","situacao":"Aprovado"}
  ]';
  v_2026  jsonb := '[
    {"linha":1,"matricula":"ENS-E1","segmento":"Educação Infantil","serie":"Infantil II","ano":"2026","turma":"A","situacao":"Cursando"},
    {"linha":2,"matricula":"ENS-E2","segmento":"Ensino Fundamental I","serie":"5º Ano","ano":"2026","turma":"A","situacao":"Pré-matrícula"},
    {"linha":3,"matricula":"ENS-E6","segmento":"Ensino Fundamental I","serie":"3º Ano","ano":"2026","turma":"A","situacao":"Transferência"},
    {"linha":4,"matricula":"ENS-E8","segmento":"Ensino Fundamental II","serie":"6º Ano","ano":"2026","turma":"A","situacao":"Cursando"},
    {"linha":5,"matricula":"ENS-N1","segmento":"Educação Infantil","serie":"Infantil I","ano":"2026","turma":"A","situacao":"Cursando"},
    {"linha":6,"matricula":"ENS-N2","segmento":"Ensino Médio","serie":"1ª Série","ano":"2026","turma":"A","situacao":"Pré-matrícula",
     "responsavel":"Responsavel Ficticio","cpf_responsavel":"111.444.777-35"}
  ]';
BEGIN
  -- ── 0. Chave de série (sem banco de escola) ──
  r := r || jsonb_build_object('T00_chave_serie',
    base_grade_key('Infantil III') = 'inf3' AND base_grade_key('Infantil 5') = 'inf5'
    AND base_grade_key('1º Ano EF') = 'ef1' AND base_grade_key('Ensino Fundamental II 9º Ano') = 'ef9'
    AND base_grade_key('Ensino Fundamental 6ª Série') = 'ef6'
    AND base_grade_key('1ª Série EM') = 'em1' AND base_grade_key('Ensino Médio 3ª Série') = 'em3'
    AND base_grade_key('Robótica') IS NULL);
  r := r || jsonb_build_object('T00b_situacao',
    base_status_from_text('Cursando') = 'ativo' AND base_status_from_text('Pré-matrícula') = 'pre_matricula'
    AND base_status_from_text('Aprovado') = 'concluido' AND base_status_from_text('Reprovado') = 'concluido'
    AND base_status_from_text('Transferência') = 'transferido' AND base_status_from_text('Cancelada') = 'cancelado'
    AND base_status_from_text('Trancada') = 'desconhecido');
  SELECT count(*) INTO n FROM students WHERE institution_id = v_agape;
  r := r || jsonb_build_object('T00c_base_agape_vazia_antes', n = 0);

  -- ── 1. Atendente e admin de outra escola: barrados ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '7edcaa5a-e9cb-42e1-a608-66b86a23f8ca', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM base_import_roster(v_agape, 2025, v_2025, true, 'ensaio'); r := r || '{"T01_atendente_envia_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"T01_atendente_envia_BLOQUEADO":true}'; END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '4dff20a1-7000-489b-b9f2-e59bd272fd7c', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM base_import_roster(v_agape, 2025, v_2025, true, 'ensaio'); r := r || '{"T02_outra_escola_envia_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"T02_outra_escola_envia_BLOQUEADO":true}'; END;
  RESET ROLE;

  -- ── 1b. Módulo por escola: desligado bloqueia; só Super Admin liga ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '0c8808a5-7a78-44de-8e1f-90e06dd7ba38', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || jsonb_build_object('M01_modulo_desligado_tela_nao_mostra', NOT base_module_enabled(v_agape));
  BEGIN PERFORM base_import_roster(v_agape, 2025, v_2025, true, 'ensaio'); r := r || '{"M02_desligado_envio_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"M02_desligado_envio_BLOQUEADO":true}'; END;
  BEGIN PERFORM * FROM base_reenrollment_list(v_agape, 2026); r := r || '{"M03_desligado_lista_BLOQUEADA":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"M03_desligado_lista_BLOQUEADA":true}'; END;
  BEGIN PERFORM base_set_module(v_agape, true); r := r || '{"M04_admin_da_escola_liga_modulo_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"M04_admin_da_escola_liga_modulo_BLOQUEADO":true}'; END;
  RESET ROLE;
  -- liberação só no Ágape (como o Super Admin fará; aqui direto, sem usuário)
  INSERT INTO student_base_settings (institution_id, module_enabled) VALUES (v_agape, true)
  ON CONFLICT (institution_id) DO UPDATE SET module_enabled = true;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '7edcaa5a-e9cb-42e1-a608-66b86a23f8ca', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || jsonb_build_object('M05_ligado_membro_da_escola_ve', base_module_enabled(v_agape));
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '4dff20a1-7000-489b-b9f2-e59bd272fd7c', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || jsonb_build_object('M06_santa_teresa_nao_ve_o_proprio', NOT base_module_enabled(v_st));
  r := r || jsonb_build_object('M07_santa_teresa_nao_ve_o_do_agape', NOT base_module_enabled(v_agape));
  BEGIN PERFORM base_import_roster(v_st, 2025, v_2025, true, 'ensaio'); r := r || '{"M08_santa_teresa_envia_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"M08_santa_teresa_envia_BLOQUEADO":true}'; END;
  RESET ROLE;

  -- ── 2. Admin da Ágape: PRÉVIA não grava nada ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '0c8808a5-7a78-44de-8e1f-90e06dd7ba38', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  s := base_import_roster(v_agape, 2025, v_2025, true, 'ensaio-2025.csv');
  RESET ROLE;
  r := r || jsonb_build_object('T03_previa_resumo', s - 'cruzamento' - 'ignoradas');
  r := r || jsonb_build_object('T03b_previa_cruzamento', s->'cruzamento');
  SELECT count(*) INTO n FROM students WHERE institution_id = v_agape;
  SELECT count(*) INTO n2 FROM school_grade_levels WHERE institution_id = v_agape AND segment IS NOT NULL;
  r := r || jsonb_build_object('T04_previa_NAO_grava', n = 0 AND n2 = 0
          AND NOT EXISTS (SELECT 1 FROM sync_runs WHERE institution_id = v_agape AND source = 'planilha'));
  r := r || jsonb_build_object('T05_avisos_serie_situacao_linha',
          (s->'series_nao_reconhecidas') ? 'Curso Livre / Robótica'
          AND (s->'situacoes_nao_reconhecidas') ? 'Trancada'
          AND jsonb_array_length(s->'ignoradas') = 1);

  -- ── 3. Gravação 2025 e 2026 ──
  SET LOCAL ROLE authenticated;
  s := base_import_roster(v_agape, 2025, v_2025, false, 'ensaio-2025.csv');
  s := base_import_roster(v_agape, 2026, v_2026, false, 'ensaio-2026.csv');
  RESET ROLE;
  r := r || jsonb_build_object('T06_cruzamento_2026', (SELECT z FROM jsonb_array_elements(s->'cruzamento') z WHERE (z->>'target_year')::int = 2026));

  -- sequência padrão preenchida
  SELECT count(*) INTO n FROM school_grade_levels g
   WHERE g.institution_id = v_agape AND g.is_terminal AND base_grade_key(g.name) = 'em3';
  SELECT count(*) INTO n2 FROM school_grade_levels g WHERE g.institution_id = v_agape AND g.is_terminal;
  r := r || jsonb_build_object('T07_serie_final_3a_EM', n = 1 AND n2 = 1);
  r := r || jsonb_build_object('T07b_9ano_vai_pra_1a_serie',
    (SELECT base_grade_key(nx.name) FROM school_grade_levels g JOIN school_grade_levels nx ON nx.id = g.next_grade_level_id
      WHERE g.institution_id = v_agape AND base_grade_key(g.name) = 'ef9') = 'em1'
    AND (SELECT base_grade_key(nx.name) FROM school_grade_levels g JOIN school_grade_levels nx ON nx.id = g.next_grade_level_id
      WHERE g.institution_id = v_agape AND base_grade_key(g.name) = 'inf5') = 'ef1');

  -- categorias por aluno
  SELECT string_agg(registration_code || '=' || category, ' ' ORDER BY registration_code) INTO v_txt
    FROM v_base_reenrollment WHERE institution_id = v_agape AND target_year = 2026;
  r := r || jsonb_build_object('T08_categorias_txt', v_txt);
  r := r || jsonb_build_object('T08b_categorias_certas', v_txt =
    'ENS-E1=rematriculado ENS-E2=rematriculado ENS-E3=a_rematricular ENS-E4=concluinte ENS-E5=a_rematricular '
    || 'ENS-E6=saiu ENS-E7=saiu ENS-E8=retorno ENS-E9=a_rematricular ENS-N1=novato ENS-N2=novato ENS-X2=outro');
  r := r || jsonb_build_object('T09_destinos',
    (SELECT base_grade_key(g.name) FROM v_base_reenrollment v JOIN school_grade_levels g ON g.id = v.dest_grade_id
      WHERE v.institution_id = v_agape AND v.target_year = 2026 AND v.registration_code = 'ENS-E3') = 'em1'
    AND (SELECT base_grade_key(g.name) FROM v_base_reenrollment v JOIN school_grade_levels g ON g.id = v.dest_grade_id
      WHERE v.institution_id = v_agape AND v.target_year = 2026 AND v.registration_code = 'ENS-E5') = 'em3'
    AND (SELECT base_grade_key(g.name) FROM v_base_reenrollment v JOIN school_grade_levels g ON g.id = v.dest_grade_id
      WHERE v.institution_id = v_agape AND v.target_year = 2026 AND v.registration_code = 'ENS-E2') = 'ef5');
  r := r || jsonb_build_object('T10_sem_nome_vira_matricula',
    (SELECT full_name FROM students WHERE institution_id = v_agape AND registration_code = 'ENS-E1') = 'Matrícula ENS-E1');
  r := r || jsonb_build_object('T11_cpf_sem_segredo_ignorado',
    (s->>'cpf_ignorado_sem_segredo')::int = 1
    AND (SELECT cpf_hmac IS NULL FROM guardians WHERE institution_id = v_agape AND external_id = 'ENS-N2'));

  -- ── 4. Reenvio idêntico: não duplica ──
  SELECT count(*) INTO n FROM students WHERE institution_id = v_agape;
  SELECT count(*) INTO n2 FROM class_enrollments WHERE institution_id = v_agape;
  SET LOCAL ROLE authenticated;
  s := base_import_roster(v_agape, 2026, v_2026, false, 'ensaio-2026-de-novo.csv');
  RESET ROLE;
  r := r || jsonb_build_object('T12_reenvio_nao_duplica',
    n = (SELECT count(*) FROM students WHERE institution_id = v_agape)
    AND n2 = (SELECT count(*) FROM class_enrollments WHERE institution_id = v_agape)
    AND (s->>'sem_mudanca')::int = 6 AND (s->>'alunos_novos_no_ano')::int = 0);
  r := r || jsonb_build_object('T12b_contagens', jsonb_build_object('alunos', n, 'enturmacoes', n2));

  -- ── 5. Reenvio com mudança: E3 chega na 1ª Série ──
  SET LOCAL ROLE authenticated;
  s := base_import_roster(v_agape, 2026, v_2026 || '[{"linha":7,"matricula":"ENS-E3","segmento":"Ensino Médio","serie":"1ª Série","ano":"2026","turma":"A","situacao":"Cursando"}]'::jsonb, false, 'ensaio-2026-v3.csv');
  RESET ROLE;
  r := r || jsonb_build_object('T13_E3_vira_rematriculado',
    (SELECT category FROM v_base_reenrollment WHERE institution_id = v_agape AND target_year = 2026 AND registration_code = 'ENS-E3') = 'rematriculado');

  -- ── 6. Marcação manual e vagas ──
  SELECT id INTO v_e9 FROM students WHERE institution_id = v_agape AND registration_code = 'ENS-E9';
  SELECT id INTO v_grade FROM school_grade_levels WHERE institution_id = v_agape AND base_grade_key(name) = 'ef2' ORDER BY sort_order LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '7edcaa5a-e9cb-42e1-a608-66b86a23f8ca', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM base_mark_reenrolled(v_agape, 2026, v_e9, true); r := r || '{"T14_atendente_marca_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"T14_atendente_marca_BLOQUEADO":true}'; END;
  BEGIN PERFORM base_set_capacity(v_agape, 2026, v_grade, 30); r := r || '{"T15_atendente_vagas_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"T15_atendente_vagas_BLOQUEADO":true}'; END;
  SELECT count(*) INTO n FROM v_base_reenrollment WHERE institution_id = v_agape;
  r := r || jsonb_build_object('T16_atendente_nao_le_lista', n = 0);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '4dff20a1-7000-489b-b9f2-e59bd272fd7c', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM v_base_reenrollment WHERE institution_id = v_agape;
  r := r || jsonb_build_object('T17_outra_escola_nao_le_lista', n = 0);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '0c8808a5-7a78-44de-8e1f-90e06dd7ba38', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM base_mark_reenrolled(v_agape, 2026, v_e9, true, 'ensaio');
  PERFORM base_set_capacity(v_agape, 2026, v_grade, 30);
  r := r || jsonb_build_object('T18_E9_declarado',
    (SELECT category FROM v_base_reenrollment WHERE institution_id = v_agape AND target_year = 2026 AND registration_code = 'ENS-E9') = 'rematriculado_declarado');
  r := r || jsonb_build_object('T19_painel_2o_ano',
    (SELECT to_jsonb(b) - 'institution_id' - 'grade_level_id' FROM v_base_reenrollment_by_grade b
      WHERE b.institution_id = v_agape AND b.target_year = 2026 AND b.grade_level_id = v_grade));
  r := r || jsonb_build_object('T20_admin_le_lista', (SELECT count(*) FROM v_base_reenrollment WHERE institution_id = v_agape AND target_year = 2026) = 12);
  RESET ROLE;

  -- ── 6b. Atendente COM a permissão "Base de alunos": lista e marcação sim; tabelas, vagas e envio não ──
  UPDATE user_permissions SET enabled = true
   WHERE user_id = '7edcaa5a-e9cb-42e1-a608-66b86a23f8ca' AND institution_id = v_agape AND module = 'base_alunos';
  IF NOT FOUND THEN
    INSERT INTO user_permissions (institution_id, user_id, module, enabled)
    VALUES (v_agape, '7edcaa5a-e9cb-42e1-a608-66b86a23f8ca', 'base_alunos', true);
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '7edcaa5a-e9cb-42e1-a608-66b86a23f8ca', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM base_reenrollment_list(v_agape, 2026);
  r := r || jsonb_build_object('T23_atendente_com_permissao_ve_lista', n = 12);
  SELECT count(*) INTO n FROM base_reenrollment_panel(v_agape, 2026) WHERE pending > 0;
  r := r || jsonb_build_object('T24_atendente_com_permissao_ve_painel', n > 0);
  SELECT count(*) INTO n FROM students WHERE institution_id = v_agape;
  SELECT count(*) INTO n2 FROM guardians WHERE institution_id = v_agape;
  r := r || jsonb_build_object('T25_atendente_NAO_le_tabelas', n = 0 AND n2 = 0);
  BEGIN PERFORM base_mark_reenrolled(v_agape, 2026, v_e9, false); r := r || '{"T26_atendente_com_permissao_marca":true}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"T26_atendente_com_permissao_marca":false}'; END;
  BEGIN PERFORM base_set_capacity(v_agape, 2026, v_grade, 31); r := r || '{"T27_atendente_com_permissao_vagas_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"T27_atendente_com_permissao_vagas_BLOQUEADO":true}'; END;
  BEGIN PERFORM base_import_roster(v_agape, 2026, v_2026, true); r := r || '{"T28_atendente_com_permissao_envia_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"T28_atendente_com_permissao_envia_BLOQUEADO":true}'; END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '4dff20a1-7000-489b-b9f2-e59bd272fd7c', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM * FROM base_reenrollment_list(v_agape, 2026); r := r || '{"T29_outra_escola_lista_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"T29_outra_escola_lista_BLOQUEADO":true}'; END;
  RESET ROLE;

  -- ── 7. Execuções registradas (só as gravações, não a prévia) ──
  SELECT count(*) INTO n FROM sync_runs WHERE institution_id = v_agape AND source = 'planilha';
  r := r || jsonb_build_object('T21_execucoes_registradas_4', n = 4);
  SELECT count(*) INTO n FROM student_status_events WHERE institution_id = v_agape AND source = 'planilha';
  r := r || jsonb_build_object('T22_eventos', n);

  RAISE EXCEPTION 'ENSAIO_PLANILHA %', r::text;
END $t$;
