-- =============================================================================
-- ENSAIO (sem migration nova): famílias pelos ids do aluno (lista_alunos),
-- sem a rota acesso/vinculo_aluno_responsavel_liberado (portaria).
-- A edge function grava na área de espera vínculos gerados de responsavel_id,
-- responsavel_secundario_id, filiacao_1_id, filiacao_2_id e
-- responsaveis_adicionais_ids (1º = principal). Aqui eles são simulados.
-- Escola de teste: Colégio Áion. O RAISE do fim desfaz TUDO.
-- =============================================================================
DO $t$
DECLARE
  v_aion  uuid := '169b10a1-024d-4ac8-b3a8-199f34d1f360';
  v_admin text := '1e86d8b6-31f4-428d-811d-fe167aa9fa30';
  v_run   uuid;
  r jsonb := '{}'::jsonb;
  s jsonb;
  rows jsonb;
BEGIN
  INSERT INTO student_base_settings (institution_id, module_enabled, names_allowed) VALUES (v_aion, true, true)
  ON CONFLICT (institution_id) DO UPDATE SET module_enabled = true, names_allowed = true;
  INSERT INTO erp_connections (institution_id, provider, token_secret_id, token_last4, status, auth_scheme)
  VALUES (v_aion, 'activesoft', vault.create_secret('token-ficticio-ensaio', 'erp_ensaio_' || extract(epoch FROM clock_timestamp())::text), 'saio', 'pausada', 'Bearer');
  INSERT INTO sync_runs (institution_id, source, kind, status, triggered_by, step, counts)
  VALUES (v_aion, 'activesoft', 'dry_run_contagem', 'aguardando_confirmacao', 'ensaio', 'contagem', '{"guardar_nomes":true}')
  RETURNING id INTO v_run;

  -- A1: principal (20) existe → "Resp Vinte"; A2: principal (30) NÃO veio em
  -- lista_responsaveis → usa o 2º (31); A3: sem ids → sem responsável;
  -- A4 e A5: irmãos com o mesmo responsável (40) → um responsável só.
  INSERT INTO erp_staging (run_id, institution_id, entity, external_id, data) VALUES
    (v_run, v_aion, 'turma', 'T1', '{"id":"T1","nome":"1º Ano A","serie_id":"S1","serie_nome":"1º Ano","curso_nome":"Ensino Fundamental I","unidade_id":"1","ano":"2026"}'),
    (v_run, v_aion, 'enturmacao', 'E1', '{"aluno_id":"A1","turma_id":"T1","situacao":"Cursando","situacao_sistema":"A"}'),
    (v_run, v_aion, 'enturmacao', 'E2', '{"aluno_id":"A2","turma_id":"T1","situacao":"Cursando","situacao_sistema":"A"}'),
    (v_run, v_aion, 'enturmacao', 'E3', '{"aluno_id":"A3","turma_id":"T1","situacao":"Cursando","situacao_sistema":"A"}'),
    (v_run, v_aion, 'enturmacao', 'E4', '{"aluno_id":"A4","turma_id":"T1","situacao":"Cursando","situacao_sistema":"A"}'),
    (v_run, v_aion, 'enturmacao', 'E5', '{"aluno_id":"A5","turma_id":"T1","situacao":"Cursando","situacao_sistema":"A"}'),
    (v_run, v_aion, 'aluno', 'A1', '{"id":"A1","matricula":"F1","nome":"Aluno Um","resp_ids":"20"}'),
    (v_run, v_aion, 'aluno', 'A2', '{"id":"A2","matricula":"F2","nome":"Aluno Dois","resp_ids":"30,31"}'),
    (v_run, v_aion, 'aluno', 'A3', '{"id":"A3","matricula":"F3","nome":"Aluno Tres"}'),
    (v_run, v_aion, 'aluno', 'A4', '{"id":"A4","matricula":"F4","nome":"Aluno Quatro","resp_ids":"40"}'),
    (v_run, v_aion, 'aluno', 'A5', '{"id":"A5","matricula":"F5","nome":"Aluno Cinco","resp_ids":"40"}'),
    (v_run, v_aion, 'vinculo', 'A1|20', '{"aluno_id":"A1","responsavel_id":"20","principal":"true","ordem":"1"}'),
    (v_run, v_aion, 'vinculo', 'A2|30', '{"aluno_id":"A2","responsavel_id":"30","principal":"true","ordem":"1"}'),
    (v_run, v_aion, 'vinculo', 'A2|31', '{"aluno_id":"A2","responsavel_id":"31","principal":"false","ordem":"2"}'),
    (v_run, v_aion, 'vinculo', 'A4|40', '{"aluno_id":"A4","responsavel_id":"40","principal":"true","ordem":"1"}'),
    (v_run, v_aion, 'vinculo', 'A5|40', '{"aluno_id":"A5","responsavel_id":"40","principal":"true","ordem":"1"}'),
    (v_run, v_aion, 'responsavel', '20', '{"id":"20","nome":"Resp Vinte"}'),
    (v_run, v_aion, 'responsavel', '31', '{"id":"31","nome":"Resp Trinta e Um"}'),
    (v_run, v_aion, 'responsavel', '40', '{"id":"40","nome":"Resp Quarenta"}');

  rows := base_erp_rows(v_aion, v_run);
  r := r || jsonb_build_object('F01_principal', EXISTS (SELECT 1 FROM jsonb_array_elements(rows) x WHERE x->>'matricula' = 'F1' AND x->>'responsavel' = 'Resp Vinte'));
  r := r || jsonb_build_object('F02_principal_ausente_usa_o_segundo', EXISTS (SELECT 1 FROM jsonb_array_elements(rows) x WHERE x->>'matricula' = 'F2' AND x->>'responsavel' = 'Resp Trinta e Um'));
  r := r || jsonb_build_object('F03_sem_ids_sem_responsavel', EXISTS (SELECT 1 FROM jsonb_array_elements(rows) x WHERE x->>'matricula' = 'F3' AND x->>'responsavel' IS NULL));

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  s := base_erp_apply(v_aion, v_run);
  RESET ROLE;
  r := r || jsonb_build_object('F04_responsaveis_gravados', (SELECT count(*) FROM guardians WHERE institution_id = v_aion));
  r := r || jsonb_build_object('F05_alunos_ligados', (SELECT count(DISTINCT sg.student_id) FROM student_guardians sg JOIN students st ON st.id = sg.student_id
                                                       WHERE st.institution_id = v_aion));
  RAISE EXCEPTION 'ENSAIO_FAMILIAS %', r::text;
END $t$;
