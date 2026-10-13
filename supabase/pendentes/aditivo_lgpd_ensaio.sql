-- =============================================================================
-- ENSAIO da migration 20261014120000_aditivo_lgpd_aceite.sql.
-- Montagem: migration + este arquivo numa transação. O RAISE do fim desfaz TUDO
-- (inclusive a v1 de TESTE publicada aqui, que não é o texto final).
-- Escola de teste: Colégio Áion. Perfis: admin Áion 1e86d8b6…, atendente Áion
-- 39f0b70d… (vira gestor no meio do ensaio), Super Admin 2855b1ad…,
-- admin Santa Teresa 4dff20a1…. O Ágape não é tocado.
-- =============================================================================
DO $t$
DECLARE
  v_aion  uuid := '169b10a1-024d-4ac8-b3a8-199f34d1f360';
  v_st    uuid := (SELECT id FROM institutions WHERE name LIKE 'COLEGIO SANTA TERESA%');
  v_agape uuid := (SELECT id FROM institutions WHERE name = 'Colégio Ágape Patos');
  v_admin text := '1e86d8b6-31f4-428d-811d-fe167aa9fa30';
  v_user  text := '39f0b70d-81ae-4618-a001-09b0d1f7f82f';
  v_super text := '2855b1ad-8707-443e-a7ea-8568d5d3da6e';
  v_stadm text := '4dff20a1-7000-489b-b9f2-e59bd272fd7c';
  v_sha   text := repeat('ab', 32);
  r jsonb := '{}'::jsonb;
  s jsonb;
  n int;
  v_agape_names boolean := (SELECT names_allowed FROM student_base_settings WHERE institution_id = (SELECT id FROM institutions WHERE name = 'Colégio Ágape Patos'));
BEGIN
  INSERT INTO student_base_settings (institution_id, module_enabled) VALUES (v_aion, true)
  ON CONFLICT (institution_id) DO UPDATE SET module_enabled = true;

  -- ── 0. Sem versão publicada: ninguém aceita ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.headers', '{"x-forwarded-for":"203.0.113.7, 10.0.0.1","user-agent":"Ensaio/1.0"}', true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM base_accept_lgpd(v_aion, 'v1', v_sha); r := r || '{"L00_sem_versao_publicada_RECUSA":false}';
  EXCEPTION WHEN check_violation THEN r := r || '{"L00_sem_versao_publicada_RECUSA":true}'; END;
  s := base_lgpd_status(v_aion);
  r := r || jsonb_build_object('L01_status_admin_pode_aceitar', (s->>'can_accept')::boolean AND NOT (s->>'names_allowed')::boolean AND s->>'current_version' IS NULL);
  RESET ROLE;

  INSERT INTO lgpd_text_versions (version, text_sha256, notes) VALUES ('v1', v_sha, 'TESTE do ensaio');

  -- ── 1. Atendente, gestor, Super Admin e outra escola não aceitam ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM base_accept_lgpd(v_aion, 'v1', v_sha); r := r || '{"L02_atendente_aceita_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"L02_atendente_aceita_BLOQUEADO":true}'; END;
  r := r || jsonb_build_object('L03_atendente_nao_ve_botao', NOT (base_lgpd_status(v_aion)->>'can_accept')::boolean);
  RESET ROLE;
  UPDATE users SET role = 'manager' WHERE id = v_user::uuid;
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM base_accept_lgpd(v_aion, 'v1', v_sha); r := r || '{"L04_gestor_aceita_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"L04_gestor_aceita_BLOQUEADO":true}'; END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM base_accept_lgpd(v_aion, 'v1', v_sha); r := r || '{"L05_super_admin_aceita_pela_escola_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"L05_super_admin_aceita_pela_escola_BLOQUEADO":true}'; END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_stadm, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM base_accept_lgpd(v_aion, 'v1', v_sha); r := r || '{"L06_outra_escola_aceita_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"L06_outra_escola_aceita_BLOQUEADO":true}'; END;
  BEGIN PERFORM base_accept_lgpd(v_st, 'v1', v_sha); r := r || '{"L07_escola_sem_modulo_aceita_BLOQUEADO":false}';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '{"L07_escola_sem_modulo_aceita_BLOQUEADO":true}'; END;
  RESET ROLE;

  -- ── 2. Escola sem aceite continua descartando nomes ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  s := base_import_roster(v_aion, 2026, '[{"linha":1,"matricula":"L1","nome":"Nome Ficticio","serie":"1º Ano","ano":"2026","situacao":"Cursando"}]'::jsonb, false, 'antes.csv');
  r := r || jsonb_build_object('L08_sem_aceite_descarta_nome', (s->>'nomes_descartados')::int = 1
          AND (SELECT full_name FROM students WHERE institution_id = v_aion AND registration_code = 'L1') = 'Matrícula L1');

  -- ── 3. Texto diferente do aprovado é recusado; admin aceita ──
  BEGIN PERFORM base_accept_lgpd(v_aion, 'v1', repeat('cd', 32)); r := r || '{"L09_hash_diferente_RECUSA":false}';
  EXCEPTION WHEN check_violation THEN r := r || '{"L09_hash_diferente_RECUSA":true}'; END;
  s := base_accept_lgpd(v_aion, 'v1', v_sha);
  r := r || jsonb_build_object('L10_chave_ligou', base_names_allowed(v_aion));
  SELECT count(*) INTO n FROM lgpd_acceptances
   WHERE institution_id = v_aion AND action = 'aceite' AND text_version = 'v1' AND text_sha256 = v_sha
     AND ip = '203.0.113.7' AND user_agent = 'Ensaio/1.0' AND user_id = v_admin::uuid AND created_at IS NOT NULL
     AND school_name = (SELECT name FROM institutions WHERE id = v_aion) AND representative_name = (SELECT full_name FROM users WHERE id = v_admin::uuid);
  r := r || jsonb_build_object('L11_registro_com_versao_ip_usuario_data', n = 1);
  r := r || jsonb_build_object('L12_admin_le_registro', (SELECT count(*) FROM lgpd_acceptances WHERE institution_id = v_aion) = 1);

  -- ── 4. Não reidrata: o aluno já enviado continua sem nome até o próximo envio ──
  r := r || jsonb_build_object('L13_nao_reidrata', (SELECT full_name FROM students WHERE institution_id = v_aion AND registration_code = 'L1') = 'Matrícula L1');
  s := base_import_roster(v_aion, 2026, '[{"linha":1,"matricula":"L1","nome":"Nome Ficticio","serie":"1º Ano","ano":"2026","situacao":"Cursando"}]'::jsonb, false, 'depois.csv');
  r := r || jsonb_build_object('L14_proximo_envio_com_nomes_grava', (SELECT full_name FROM students WHERE institution_id = v_aion AND registration_code = 'L1') = 'Nome Ficticio'
          AND (s->>'nomes_descartados')::int = 0);
  BEGIN UPDATE lgpd_acceptances SET ip = 'x' WHERE institution_id = v_aion; r := r || '{"L15_registro_imutavel":false}';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN r := r || '{"L15_registro_imutavel":true}'; END;
  RESET ROLE;

  -- outra escola não lê o registro
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_stadm, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || jsonb_build_object('L16_outra_escola_nao_le_registro', (SELECT count(*) FROM lgpd_acceptances WHERE institution_id = v_aion) = 0);
  r := r || jsonb_build_object('L17_santa_teresa_continua_sem_nomes', NOT base_names_allowed(v_st));
  RESET ROLE;

  -- ── 5. Super Admin: liga/revoga à mão, também registra, e lê o registro ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM base_set_names_allowed(v_aion, false);
  PERFORM base_set_names_allowed(v_aion, true);
  r := r || jsonb_build_object('L18_super_admin_registra_manual',
          (SELECT string_agg(action, ',' ORDER BY created_at, action) FROM lgpd_acceptances WHERE institution_id = v_aion) LIKE 'aceite,%'
          AND (SELECT count(*) FROM lgpd_acceptances WHERE institution_id = v_aion AND action IN ('revogado', 'liberado_manual')) = 2);
  r := r || jsonb_build_object('L19_super_admin_le_registro', (SELECT count(*) FROM lgpd_acceptances WHERE institution_id = v_aion) = 3);
  RESET ROLE;

  r := r || jsonb_build_object('Z01_agape_intocado',
          (SELECT names_allowed FROM student_base_settings WHERE institution_id = v_agape) IS NOT DISTINCT FROM v_agape_names
          AND NOT EXISTS (SELECT 1 FROM lgpd_acceptances WHERE institution_id = v_agape));

  RAISE EXCEPTION 'ENSAIO_LGPD %', r::text;
END $t$;
