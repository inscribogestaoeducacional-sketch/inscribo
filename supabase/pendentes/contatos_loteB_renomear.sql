-- =============================================================================
-- Contatos — LOTE B: renomeia pra 13 dígitos (formato canônico do webhook) os
-- contatos de CELULAR gravados com 12 dígitos (55 + DDD + 8, 1º dígito local
-- 6–9) que NÃO têm gêmeo de 13 (os gêmeos foram fundidos no lote A).
-- Aprovado pelo Victor em 12/10/2026, lotes de 1.500.
-- NÃO está em supabase/migrations: roda manualmente, acompanhado, com
--   supabase db query --linked -f supabase/pendentes/contatos_loteB_renomear.sql
-- v_apply = false (padrão) faz tudo e DESFAZ no fim (dry-run pelo mesmo código).
-- v_lote = número do lote (só entra no run_tag); v_max = contatos por lote.
-- Cada execução pega os próximos v_max (ordem do telefone); os renomeados
-- deixam de ter 12 dígitos, então rodar de novo avança pro lote seguinte.
--
-- Por lote, numa única transação:
--   1. backup das linhas (dedup_backup_rows);
--   2. referências texto pelo telefone (contact_notes/contact_field_values)
--      passam pro telefone novo — registradas em dedup_backup_refs (as
--      referências por id não mudam);
--   3. telefone vira 13 dígitos; nome igual ao telefone antigo vira o novo.
-- Conferência (aborta tudo se falhar): total de contatos igual; 0 contatos
-- do lote ainda com 12 dígitos; 1 contato por telefone novo.
-- =============================================================================

DO $run$
DECLARE
  v_apply   BOOLEAN := false;                          -- ← true SÓ na execução aprovada
  v_lote    INT     := 1;                              -- ← número do lote
  v_max     INT     := 1500;                           -- ← contatos por lote
  v_run     TEXT;
  v_total_antes  BIGINT;
  v_total_depois BIGINT;
  v_n       BIGINT;
  v_refs    BIGINT;
  v_restam  BIGINT;
  v_escolas TEXT;
BEGIN
  v_run := 'contatosB_lote' || v_lote || '_' || to_char(now() AT TIME ZONE 'America/Fortaleza', 'YYYYMMDD_HH24MI');

  CREATE TEMP TABLE lote ON COMMIT DROP AS
  SELECT a.id, a.institution_id, a.phone AS phone12,
         '55' || substring(a.phone, 3, 2) || '9' || substring(a.phone, 5) AS phone13
  FROM whatsapp_contacts a
  WHERE a.phone ~ '^55[0-9]{2}[6-9][0-9]{7}$'
    AND NOT EXISTS (SELECT 1 FROM whatsapp_contacts b
                     WHERE b.institution_id = a.institution_id
                       AND b.phone = '55' || substring(a.phone, 3, 2) || '9' || substring(a.phone, 5))
  ORDER BY a.phone
  LIMIT v_max;
  SELECT count(*) INTO v_n FROM lote;
  IF v_n = 0 THEN RAISE EXCEPTION 'NADA A FAZER: nenhum contato de 12 dígitos sem gêmeo'; END IF;

  PERFORM 1 FROM whatsapp_contacts WHERE id IN (SELECT id FROM lote) FOR UPDATE;
  SELECT count(*) INTO v_total_antes FROM whatsapp_contacts;

  -- ── 1. Backup ────────────────────────────────────────────────────────────
  INSERT INTO dedup_backup_rows (run_tag, table_name, row_id, row_data)
  SELECT v_run, 'whatsapp_contacts', w.id::text, to_jsonb(w) FROM whatsapp_contacts w WHERE w.id IN (SELECT id FROM lote);

  -- ── 2. Referências texto pelo telefone ──────────────────────────────────
  INSERT INTO dedup_backup_refs SELECT v_run, 'contact_notes', x.id::text, 'contact_ref_id', x.contact_ref_id, l.phone13
    FROM contact_notes x JOIN lote l ON x.contact_ref_id = l.phone12;
  UPDATE contact_notes x SET contact_ref_id = l.phone13 FROM lote l WHERE x.contact_ref_id = l.phone12;
  INSERT INTO dedup_backup_refs SELECT v_run, 'contact_field_values', x.id::text, 'contact_ref_id', x.contact_ref_id, l.phone13
    FROM contact_field_values x JOIN lote l ON x.contact_ref_id = l.phone12;
  UPDATE contact_field_values x SET contact_ref_id = l.phone13 FROM lote l WHERE x.contact_ref_id = l.phone12;
  SELECT count(*) INTO v_refs FROM dedup_backup_refs WHERE run_tag = v_run;

  -- ── 3. Telefone (e nome, quando o nome é o próprio número) ──────────────
  UPDATE whatsapp_contacts w SET
    phone = l.phone13,
    name  = CASE WHEN w.name = l.phone12 THEN l.phone13 ELSE w.name END,
    updated_at = now()
  FROM lote l WHERE w.id = l.id;

  -- ── Conferência ──────────────────────────────────────────────────────────
  SELECT count(*) INTO v_total_depois FROM whatsapp_contacts;
  IF v_total_depois <> v_total_antes THEN
    RAISE EXCEPTION 'ABORTADO: contatos % antes, % depois', v_total_antes, v_total_depois;
  END IF;
  SELECT count(*) INTO v_n FROM whatsapp_contacts w JOIN lote l ON l.id = w.id WHERE w.phone <> l.phone13;
  IF v_n <> 0 THEN RAISE EXCEPTION 'ABORTADO: % contatos do lote sem o telefone novo', v_n; END IF;
  SELECT count(*) INTO v_n FROM lote l
   WHERE (SELECT count(*) FROM whatsapp_contacts w WHERE w.institution_id = l.institution_id AND w.phone IN (l.phone12, l.phone13)) <> 1;
  IF v_n <> 0 THEN RAISE EXCEPTION 'ABORTADO: % telefones sem exatamente 1 contato', v_n; END IF;

  SELECT count(*) INTO v_n FROM lote;
  SELECT count(*) INTO v_restam FROM whatsapp_contacts WHERE phone ~ '^55[0-9]{2}[6-9][0-9]{7}$';
  SELECT string_agg(x, '; ') INTO v_escolas FROM (
    SELECT coalesce(i.name, '(sem escola)') || '=' || count(*) x FROM lote l LEFT JOIN institutions i ON i.id = l.institution_id GROUP BY i.name) s;

  IF NOT v_apply THEN
    RAISE EXCEPTION 'DRY-RUN (desfeito) run=%: renomeados %, contatos %→%, referências texto movidas %, por escola: %, restam com 12 dígitos: %',
      v_run, v_n, v_total_antes, v_total_depois, v_refs, v_escolas, v_restam;
  END IF;
  RAISE NOTICE 'APLICADO run=%: renomeados %, contatos %→%, referências texto movidas %, por escola: %, restam com 12 dígitos: %',
    v_run, v_n, v_total_antes, v_total_depois, v_refs, v_escolas, v_restam;
END
$run$;
