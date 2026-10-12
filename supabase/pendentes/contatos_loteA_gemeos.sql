-- =============================================================================
-- Contatos — LOTE A: funde os contatos "gêmeos" (mesma escola, um gravado com
-- 12 dígitos e outro com 13 — celular com e sem o 9) no contato de 13 dígitos
-- (formato canônico do webhook). Aprovado pelo Victor em 12/10/2026.
-- NÃO está em supabase/migrations: roda manualmente, acompanhado, com
--   supabase db query --linked -f supabase/pendentes/contatos_loteA_gemeos.sql
-- v_apply = false (padrão) faz tudo e DESFAZ no fim (dry-run pelo mesmo código).
-- v_lote = número do lote (só entra no run_tag); v_max = pares por lote.
-- Cada execução pega os próximos v_max pares (ordem do telefone): os já
-- fundidos deixam de ser par, então rodar de novo avança pro lote seguinte.
--
-- Por lote, numa única transação:
--   1. backup das duas linhas de contato (dedup_backup_rows);
--   2. move pro contato de 13 tudo que aponta pro de 12 — por id
--      (contact_field_change_log, capture_trigger_hits, broadcast_recipients)
--      e por referência texto (contact_notes/contact_field_values, pelo id ou
--      pelo telefone) — registrando cada valor antigo em dedup_backup_refs;
--   3. completa o de 13 com o que só o de 12 tem (nome quando o de 13 é só
--      número, tipo, lead, e-mail, endereço, aluno, série, parentesco, foto,
--      origem de captação), soma as etiquetas, mantém o created_at mais antigo
--      e o last_seen_at mais recente;
--   4. apaga o de 12 (linha inteira já no backup).
-- Fica de fora (e é listado): par cujos dois contatos têm lead e são leads
-- DIFERENTES — decisão manual.
-- Conferência por lote (aborta tudo se falhar): contatos antes − pares =
-- depois; 0 referências ao contato apagado; referências movidas = referências
-- que existiam; 1 contato por número em cada par.
-- =============================================================================

DO $run$
DECLARE
  v_apply   BOOLEAN := false;                          -- ← true SÓ na execução aprovada
  v_lote    INT     := 1;                              -- ← número do lote
  v_max     INT     := 150;                            -- ← pares por lote
  v_run     TEXT;
  v_total_antes  BIGINT;
  v_total_depois BIGINT;
  v_refs_antes   BIGINT;
  v_refs_movidas BIGINT;
  v_n       BIGINT;
  v_pares   BIGINT;
  v_fora    TEXT;
  v_restam  BIGINT;
  v_escolas TEXT;
BEGIN
  v_run := 'contatosA_lote' || v_lote || '_' || to_char(now() AT TIME ZONE 'America/Fortaleza', 'YYYYMMDD_HH24MI');

  -- ── Pares ────────────────────────────────────────────────────────────────
  CREATE TEMP TABLE todos ON COMMIT DROP AS
  SELECT a.id AS id12, b.id AS id13, a.institution_id, a.phone AS phone12, b.phone AS phone13,
         (a.lead_id IS NOT NULL AND b.lead_id IS NOT NULL AND a.lead_id <> b.lead_id) AS leads_diferentes
  FROM whatsapp_contacts a
  JOIN whatsapp_contacts b
    ON b.institution_id = a.institution_id
   AND b.phone = '55' || substring(a.phone, 3, 2) || '9' || substring(a.phone, 5)
  WHERE a.phone ~ '^55[0-9]{2}[6-9][0-9]{7}$';

  SELECT coalesce(string_agg(phone12 || ' / ' || phone13, ', '), '-') INTO v_fora FROM todos WHERE leads_diferentes;

  CREATE TEMP TABLE lote ON COMMIT DROP AS
  SELECT * FROM todos WHERE NOT leads_diferentes ORDER BY phone13 LIMIT v_max;
  SELECT count(*) INTO v_pares FROM lote;
  IF v_pares = 0 THEN RAISE EXCEPTION 'NADA A FAZER: nenhum par elegível (fora: %)', v_fora; END IF;

  PERFORM 1 FROM whatsapp_contacts WHERE id IN (SELECT id12 FROM lote UNION ALL SELECT id13 FROM lote) FOR UPDATE;

  SELECT count(*) INTO v_total_antes FROM whatsapp_contacts;
  SELECT
      (SELECT count(*) FROM contact_field_change_log x WHERE x.contact_id IN (SELECT id12 FROM lote))
    + (SELECT count(*) FROM capture_trigger_hits x WHERE x.contact_id IN (SELECT id12 FROM lote))
    + (SELECT count(*) FROM broadcast_recipients x WHERE x.contact_id IN (SELECT id12 FROM lote))
    + (SELECT count(*) FROM contact_notes x WHERE x.contact_ref_id IN (SELECT id12::text FROM lote UNION ALL SELECT phone12 FROM lote))
    + (SELECT count(*) FROM contact_field_values x WHERE x.contact_ref_id IN (SELECT id12::text FROM lote UNION ALL SELECT phone12 FROM lote))
  INTO v_refs_antes;

  -- ── 1. Backup ────────────────────────────────────────────────────────────
  INSERT INTO dedup_backup_rows (run_tag, table_name, row_id, row_data)
  SELECT v_run, 'whatsapp_contacts', w.id::text, to_jsonb(w)
  FROM whatsapp_contacts w WHERE w.id IN (SELECT id12 FROM lote UNION ALL SELECT id13 FROM lote);

  -- ── 2. Referências ───────────────────────────────────────────────────────
  INSERT INTO dedup_backup_refs SELECT v_run, 'contact_field_change_log', x.id::text, 'contact_id', x.contact_id::text, l.id13::text
    FROM contact_field_change_log x JOIN lote l ON l.id12 = x.contact_id;
  UPDATE contact_field_change_log x SET contact_id = l.id13 FROM lote l WHERE x.contact_id = l.id12;

  INSERT INTO dedup_backup_refs SELECT v_run, 'capture_trigger_hits', x.id::text, 'contact_id', x.contact_id::text, l.id13::text
    FROM capture_trigger_hits x JOIN lote l ON l.id12 = x.contact_id;
  UPDATE capture_trigger_hits x SET contact_id = l.id13 FROM lote l WHERE x.contact_id = l.id12;

  INSERT INTO dedup_backup_refs SELECT v_run, 'broadcast_recipients', x.id::text, 'contact_id', x.contact_id::text, l.id13::text
    FROM broadcast_recipients x JOIN lote l ON l.id12 = x.contact_id;
  UPDATE broadcast_recipients x SET contact_id = l.id13 FROM lote l WHERE x.contact_id = l.id12;

  -- Referência texto: pelo id do contato ou pelo telefone; vai pro id do de 13.
  INSERT INTO dedup_backup_refs SELECT v_run, 'contact_notes', x.id::text, 'contact_ref_id', x.contact_ref_id, l.id13::text
    FROM contact_notes x JOIN lote l ON x.contact_ref_id IN (l.id12::text, l.phone12);
  UPDATE contact_notes x SET contact_ref_id = l.id13::text FROM lote l WHERE x.contact_ref_id IN (l.id12::text, l.phone12);

  IF EXISTS (SELECT 1 FROM contact_field_values a JOIN lote l ON a.contact_ref_id IN (l.id12::text, l.phone12)
             JOIN contact_field_values b ON b.field_id = a.field_id AND b.contact_ref_id IN (l.id13::text, l.phone13)) THEN
    RAISE EXCEPTION 'ABORTADO: campo personalizado preenchido nos dois contatos de um par';
  END IF;
  INSERT INTO dedup_backup_refs SELECT v_run, 'contact_field_values', x.id::text, 'contact_ref_id', x.contact_ref_id, l.id13::text
    FROM contact_field_values x JOIN lote l ON x.contact_ref_id IN (l.id12::text, l.phone12);
  UPDATE contact_field_values x SET contact_ref_id = l.id13::text FROM lote l WHERE x.contact_ref_id IN (l.id12::text, l.phone12);

  -- ── 3. Completa o contato de 13 ─────────────────────────────────────────
  UPDATE whatsapp_contacts k SET
    name    = CASE WHEN COALESCE(k.name, '') ~ '^[0-9+ ]*$' THEN COALESCE(NULLIF(d.name, ''), k.name) ELSE k.name END,
    type    = CASE WHEN k.type IS NULL OR k.type = 'unknown' THEN COALESCE(d.type, k.type) ELSE k.type END,
    lead_id = COALESCE(k.lead_id, d.lead_id),
    email   = COALESCE(NULLIF(k.email, ''), d.email),
    address = COALESCE(NULLIF(k.address, ''), d.address),
    linked_student_name = COALESCE(NULLIF(k.linked_student_name, ''), d.linked_student_name),
    student_grade       = COALESCE(NULLIF(k.student_grade, ''), d.student_grade),
    relationship        = COALESCE(NULLIF(k.relationship, ''), d.relationship),
    profile_picture_url = COALESCE(k.profile_picture_url, d.profile_picture_url),
    tags    = (SELECT array_agg(DISTINCT t) FROM unnest(COALESCE(k.tags, '{}') || COALESCE(d.tags, '{}')) t),
    origin_capture_trigger_id = COALESCE(k.origin_capture_trigger_id, d.origin_capture_trigger_id),
    origin_captured_at        = COALESCE(k.origin_captured_at, d.origin_captured_at),
    last_seen_at = GREATEST(k.last_seen_at, d.last_seen_at),
    created_at   = LEAST(k.created_at, d.created_at),
    updated_at   = now()
  FROM lote l JOIN whatsapp_contacts d ON d.id = l.id12
  WHERE k.id = l.id13;

  -- ── 4. Sai o contato de 12 ───────────────────────────────────────────────
  DELETE FROM whatsapp_contacts WHERE id IN (SELECT id12 FROM lote);

  -- ── Conferência ──────────────────────────────────────────────────────────
  SELECT count(*) INTO v_total_depois FROM whatsapp_contacts;
  IF v_total_depois <> v_total_antes - v_pares THEN
    RAISE EXCEPTION 'ABORTADO: contatos % antes, % depois, % pares', v_total_antes, v_total_depois, v_pares;
  END IF;
  SELECT count(*) INTO v_refs_movidas FROM dedup_backup_refs WHERE run_tag = v_run;
  IF v_refs_movidas <> v_refs_antes THEN
    RAISE EXCEPTION 'ABORTADO: % referências existiam, % movidas', v_refs_antes, v_refs_movidas;
  END IF;
  SELECT
      (SELECT count(*) FROM contact_field_change_log x WHERE x.contact_id IN (SELECT id12 FROM lote))
    + (SELECT count(*) FROM capture_trigger_hits x WHERE x.contact_id IN (SELECT id12 FROM lote))
    + (SELECT count(*) FROM broadcast_recipients x WHERE x.contact_id IN (SELECT id12 FROM lote))
    + (SELECT count(*) FROM contact_notes x WHERE x.contact_ref_id IN (SELECT id12::text FROM lote UNION ALL SELECT phone12 FROM lote))
    + (SELECT count(*) FROM contact_field_values x WHERE x.contact_ref_id IN (SELECT id12::text FROM lote UNION ALL SELECT phone12 FROM lote))
  INTO v_n;
  IF v_n <> 0 THEN RAISE EXCEPTION 'ABORTADO: % referências ainda no contato apagado', v_n; END IF;
  SELECT count(*) INTO v_n FROM lote l
   WHERE (SELECT count(*) FROM whatsapp_contacts w WHERE w.institution_id = l.institution_id AND w.phone IN (l.phone12, l.phone13)) <> 1;
  IF v_n <> 0 THEN RAISE EXCEPTION 'ABORTADO: % pares sem exatamente 1 contato', v_n; END IF;

  SELECT count(*) INTO v_restam FROM todos t WHERE NOT t.leads_diferentes AND t.id12 NOT IN (SELECT id12 FROM lote);
  SELECT string_agg(x, '; ') INTO v_escolas FROM (
    SELECT coalesce(i.name, '(sem escola)') || '=' || count(*) x FROM lote l LEFT JOIN institutions i ON i.id = l.institution_id GROUP BY i.name) s;

  IF NOT v_apply THEN
    RAISE EXCEPTION E'DRY-RUN (desfeito) run=%: pares %, contatos %→%, referências movidas % (de %), por escola: %, restam % pares, fora (leads diferentes): %',
      v_run, v_pares, v_total_antes, v_total_depois, v_refs_movidas, v_refs_antes, v_escolas, v_restam, v_fora;
  END IF;
  RAISE NOTICE E'APLICADO run=%: pares %, contatos %→%, referências movidas % (de %), por escola: %, restam % pares, fora (leads diferentes): %',
    v_run, v_pares, v_total_antes, v_total_depois, v_refs_movidas, v_refs_antes, v_escolas, v_restam, v_fora;
END
$run$;
