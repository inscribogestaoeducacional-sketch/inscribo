-- =============================================================================
-- ENSAIO da migration 20261014130000_base_responsavel_telefone.sql.
-- Montagem: migration + este arquivo numa transação. O RAISE do fim desfaz TUDO.
-- Escola de teste: Colégio Áion (nomes liberados só dentro do ensaio). Ágape intocado.
-- =============================================================================
DO $t$
DECLARE
  v_aion  uuid := '169b10a1-024d-4ac8-b3a8-199f34d1f360';
  v_agape uuid := (SELECT id FROM institutions WHERE name = 'Colégio Ágape Patos');
  v_admin text := '1e86d8b6-31f4-428d-811d-fe167aa9fa30';
  v_run   uuid;
  r jsonb := '{}'::jsonb;
  s jsonb;
  v_agape_before text;
BEGIN
  SELECT md5(string_agg(id::text || full_name, ',' ORDER BY id)) INTO v_agape_before FROM students WHERE institution_id = v_agape;

  -- regra do telefone (mesma de _shared/phone.ts)
  r := r || jsonb_build_object('T01_celular_sem_55', base_phone_norm('(83) 99999-0000') = '5583999990000');
  r := r || jsonb_build_object('T02_celular_antigo_ganha_9', base_phone_norm('83 8888-7777') = '5583988887777');
  r := r || jsonb_build_object('T03_fixo_sem_9', base_phone_norm('(83) 3421-0000') = '558334210000');
  r := r || jsonb_build_object('T04_ja_com_55', base_phone_norm('+55 83 99999-0000') = '5583999990000');
  r := r || jsonb_build_object('T05_vazio', base_phone_norm('') IS NULL AND base_phone_norm(NULL) IS NULL);

  INSERT INTO student_base_settings (institution_id, module_enabled, names_allowed) VALUES (v_aion, true, true)
  ON CONFLICT (institution_id) DO UPDATE SET module_enabled = true, names_allowed = true;
  INSERT INTO erp_connections (institution_id, provider, token_secret_id, token_last4, status, auth_scheme)
  VALUES (v_aion, 'activesoft', vault.create_secret('token-ficticio-ensaio', 'erp_ensaio_' || extract(epoch FROM clock_timestamp())::text), 'saio', 'pausada', 'Bearer');
  INSERT INTO sync_runs (institution_id, source, kind, status, triggered_by, step, counts)
  VALUES (v_aion, 'activesoft', 'dry_run_contagem', 'aguardando_confirmacao', 'ensaio', 'contagem', '{"guardar_nomes":true}')
  RETURNING id INTO v_run;
  INSERT INTO erp_staging (run_id, institution_id, entity, external_id, data) VALUES
    (v_run, v_aion, 'turma', 'T1', '{"id":"T1","nome":"1º Ano A","serie_id":"S1","serie_nome":"1º Ano","curso_nome":"Ensino Fundamental I","unidade_id":"1","ano":"2026"}'),
    (v_run, v_aion, 'enturmacao', 'E1', '{"aluno_id":"A1","turma_id":"T1","situacao":"Cursando","situacao_sistema":"A"}'),
    (v_run, v_aion, 'enturmacao', 'E4', '{"aluno_id":"A4","turma_id":"T1","situacao":"Cursando","situacao_sistema":"A"}'),
    (v_run, v_aion, 'enturmacao', 'E5', '{"aluno_id":"A5","turma_id":"T1","situacao":"Cursando","situacao_sistema":"A"}'),
    (v_run, v_aion, 'aluno', 'A1', '{"id":"A1","matricula":"F1","nome":"Aluno Um","resp_ids":"20"}'),
    (v_run, v_aion, 'aluno', 'A4', '{"id":"A4","matricula":"F4","nome":"Aluno Quatro","resp_ids":"40"}'),
    (v_run, v_aion, 'aluno', 'A5', '{"id":"A5","matricula":"F5","nome":"Aluno Cinco","resp_ids":"40"}'),
    (v_run, v_aion, 'vinculo', 'A1|20', '{"aluno_id":"A1","responsavel_id":"20","principal":"true"}'),
    (v_run, v_aion, 'vinculo', 'A4|40', '{"aluno_id":"A4","responsavel_id":"40","principal":"true"}'),
    (v_run, v_aion, 'vinculo', 'A5|40', '{"aluno_id":"A5","responsavel_id":"40","principal":"true"}'),
    (v_run, v_aion, 'responsavel', '20', '{"id":"20","nome":"Resp Vinte","telefone":"(83) 99999-0000"}'),
    (v_run, v_aion, 'responsavel', '40', '{"id":"40","nome":"Resp Quarenta","telefone":"83 8888-7777"}'),
    -- linhas que não entram: série extracurricular e aluno sem matrícula
    (v_run, v_aion, 'turma', 'T9', '{"id":"T9","nome":"Robótica X","serie_id":"SR","serie_nome":"Robótica","curso_nome":"Extra","unidade_id":"1","ano":"2026"}'),
    (v_run, v_aion, 'enturmacao', 'E6', '{"aluno_id":"A6","turma_id":"T9","situacao":"Cursando","situacao_sistema":"A"}'),
    (v_run, v_aion, 'aluno', 'A6', '{"id":"A6","matricula":"F6"}'),
    (v_run, v_aion, 'enturmacao', 'E7', '{"aluno_id":"A7","turma_id":"T1","situacao":"Cursando","situacao_sistema":"A"}'),
    (v_run, v_aion, 'aluno', 'A7', '{"id":"A7"}');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  s := base_erp_apply(v_aion, v_run);
  r := r || jsonb_build_object('L01_lista_mostra_nome_e_telefone',
    EXISTS (SELECT 1 FROM base_reenrollment_list(v_aion, 2026) WHERE registration_code = 'F1' AND student_name = 'Aluno Um'
              AND guardian_name = 'Resp Vinte' AND guardian_phone = '5583999990000'));
  r := r || jsonb_build_object('L02_navegador_nao_le_cpf', NOT has_column_privilege('authenticated', 'public.guardians', 'cpf_hmac', 'SELECT'));
  RESET ROLE;
  r := r || jsonb_build_object('W01_motivos_registrados', (SELECT warnings FROM sync_runs WHERE id = v_run) - 'ignoradas_amostra' - 'divergencias_amostra');
  r := r || jsonb_build_object('W02_motivos_certos',
    ((SELECT warnings FROM sync_runs WHERE id = v_run)->'series_nao_reconhecidas') ? 'Extra / Robótica'
    AND ((SELECT warnings FROM sync_runs WHERE id = v_run)->'ignoradas_por_motivo'->>'sem matrícula')::int = 1
    AND ((SELECT warnings FROM sync_runs WHERE id = v_run)->'ignoradas_amostra'->0->>'aluno_id') = 'A7');
  r := r || jsonb_build_object('G01_telefones_gravados', (SELECT count(*) FROM guardians WHERE institution_id = v_aion AND phone_norm IS NOT NULL AND phone_raw IS NOT NULL));
  r := r || jsonb_build_object('G02_irmaos_responsavel_duplicado', (SELECT count(*) FROM guardians WHERE institution_id = v_aion AND full_name = 'Resp Quarenta'));
  r := r || jsonb_build_object('Z01_agape_intocado', v_agape_before IS NOT DISTINCT FROM (SELECT md5(string_agg(id::text || full_name, ',' ORDER BY id)) FROM students WHERE institution_id = v_agape));
  RAISE EXCEPTION 'ENSAIO_TELEFONE %', r::text;
END $t$;
