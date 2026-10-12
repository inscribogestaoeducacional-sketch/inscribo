-- =============================================================================
-- Contatos — LOTE C: números em formato estranho. Decisões do Victor (12/10/2026):
--   a) 084999959278 (Colégio Universo Uno) é 5584999959278 com 0 na frente. A
--      escola JÁ TEM o contato 5584999959278, então o 084… é fundido nele
--      (mesma regra do lote A: backup, referências movidas, campos completados).
--   b) "Não enviar": entram na lista de bloqueios (broadcast_suppressions,
--      scope 'all', reason 'manual' — o CHECK só aceita opt_out_keyword /
--      meta_permanent_error / manual — com a nota "número inválido") os 6 com
--      dígito a mais e os números de serviço 447710173736 e 16465894168, em
--      cada escola onde aparecem. Nenhum contato é apagado.
--      O id de canal 120363421398645325 NÃO cabe na lista (o CHECK aceita
--      telefone de 8 a 15 dígitos; ele tem 18) — fica de fora, listado.
--   Estrangeiros ficam como estão.
--   supabase db query --linked -f supabase/pendentes/contatos_loteC_invalidos.sql
-- v_apply = false (padrão) faz tudo e DESFAZ no fim.
-- =============================================================================

DO $run$
DECLARE
  v_apply  BOOLEAN := false;                           -- ← true SÓ na execução aprovada
  v_run    TEXT;
  v_inst   UUID;
  v_keep   UUID;
  v_drop   UUID;
  v_refs   BIGINT;
  v_bloq   BIGINT;
  v_ja     BIGINT;
  v_lista  TEXT;
BEGIN
  v_run := 'contatosC_' || to_char(now() AT TIME ZONE 'America/Fortaleza', 'YYYYMMDD_HH24MI');

  -- ── a) 084999959278 → 5584999959278 (Universo Uno) ───────────────────────
  SELECT id INTO v_inst FROM institutions WHERE name = 'Colégio Universo Uno';
  SELECT id INTO v_keep FROM whatsapp_contacts WHERE institution_id = v_inst AND phone = '5584999959278';
  SELECT id INTO v_drop FROM whatsapp_contacts WHERE institution_id = v_inst AND phone = '084999959278';
  IF v_keep IS NULL OR v_drop IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: contatos do Universo Uno não encontrados (fica %, sai %)', v_keep, v_drop;
  END IF;

  INSERT INTO dedup_backup_rows (run_tag, table_name, row_id, row_data)
  SELECT v_run, 'whatsapp_contacts', w.id::text, to_jsonb(w) FROM whatsapp_contacts w WHERE w.id IN (v_keep, v_drop);

  INSERT INTO dedup_backup_refs SELECT v_run, 'contact_field_change_log', x.id::text, 'contact_id', x.contact_id::text, v_keep::text
    FROM contact_field_change_log x WHERE x.contact_id = v_drop;
  UPDATE contact_field_change_log SET contact_id = v_keep WHERE contact_id = v_drop;
  INSERT INTO dedup_backup_refs SELECT v_run, 'capture_trigger_hits', x.id::text, 'contact_id', x.contact_id::text, v_keep::text
    FROM capture_trigger_hits x WHERE x.contact_id = v_drop;
  UPDATE capture_trigger_hits SET contact_id = v_keep WHERE contact_id = v_drop;
  INSERT INTO dedup_backup_refs SELECT v_run, 'broadcast_recipients', x.id::text, 'contact_id', x.contact_id::text, v_keep::text
    FROM broadcast_recipients x WHERE x.contact_id = v_drop;
  UPDATE broadcast_recipients SET contact_id = v_keep WHERE contact_id = v_drop;
  INSERT INTO dedup_backup_refs SELECT v_run, 'contact_notes', x.id::text, 'contact_ref_id', x.contact_ref_id, v_keep::text
    FROM contact_notes x WHERE x.contact_ref_id IN (v_drop::text, '084999959278');
  UPDATE contact_notes SET contact_ref_id = v_keep::text WHERE contact_ref_id IN (v_drop::text, '084999959278');
  IF EXISTS (SELECT 1 FROM contact_field_values a JOIN contact_field_values b ON b.field_id = a.field_id
             WHERE a.contact_ref_id IN (v_drop::text, '084999959278') AND b.contact_ref_id IN (v_keep::text, '5584999959278')) THEN
    RAISE EXCEPTION 'ABORTADO: campo personalizado preenchido nos dois contatos';
  END IF;
  INSERT INTO dedup_backup_refs SELECT v_run, 'contact_field_values', x.id::text, 'contact_ref_id', x.contact_ref_id, v_keep::text
    FROM contact_field_values x WHERE x.contact_ref_id IN (v_drop::text, '084999959278');
  UPDATE contact_field_values SET contact_ref_id = v_keep::text WHERE contact_ref_id IN (v_drop::text, '084999959278');
  SELECT count(*) INTO v_refs FROM dedup_backup_refs WHERE run_tag = v_run;

  UPDATE whatsapp_contacts k SET
    name    = CASE WHEN COALESCE(k.name, '') ~ '^[0-9+ ]*$' THEN COALESCE(NULLIF(d.name, ''), k.name) ELSE k.name END,
    type    = CASE WHEN k.type IS NULL OR k.type = 'unknown' THEN COALESCE(d.type, k.type) ELSE k.type END,
    lead_id = COALESCE(k.lead_id, d.lead_id),
    email   = COALESCE(NULLIF(k.email, ''), d.email),
    tags    = (SELECT array_agg(DISTINCT t) FROM unnest(COALESCE(k.tags, '{}') || COALESCE(d.tags, '{}')) t),
    last_seen_at = GREATEST(k.last_seen_at, d.last_seen_at),
    created_at   = LEAST(k.created_at, d.created_at),
    updated_at   = now()
  FROM whatsapp_contacts d WHERE k.id = v_keep AND d.id = v_drop;
  DELETE FROM whatsapp_contacts WHERE id = v_drop;

  IF (SELECT count(*) FROM whatsapp_contacts WHERE institution_id = v_inst AND phone IN ('084999959278', '5584999959278')) <> 1 THEN
    RAISE EXCEPTION 'ABORTADO: Universo Uno não ficou com 1 contato';
  END IF;

  -- ── b) Lista de bloqueios: "número inválido" ─────────────────────────────
  CREATE TEMP TABLE alvo ON COMMIT DROP AS
  SELECT DISTINCT w.institution_id, w.phone
  FROM whatsapp_contacts w
  WHERE w.phone IN ('119982020073', '639649517917', '839920012706', '839921475670', '839998224141', '839999225404',
                    '447710173736', '16465894168');

  SELECT count(*) INTO v_ja FROM alvo a
   WHERE EXISTS (SELECT 1 FROM broadcast_suppressions s WHERE s.institution_id = a.institution_id
                   AND s.phone_key = broadcast_phone_key(a.phone) AND s.scope = 'all' AND s.lifted_at IS NULL);

  INSERT INTO broadcast_suppressions (institution_id, phone, scope, reason, note)
  SELECT a.institution_id, a.phone, 'all', 'manual', 'número inválido (lote C de contatos, decisão do Victor em 12/10/2026)'
  FROM alvo a
  WHERE NOT EXISTS (SELECT 1 FROM broadcast_suppressions s WHERE s.institution_id = a.institution_id
                      AND s.phone_key = broadcast_phone_key(a.phone) AND s.scope = 'all' AND s.lifted_at IS NULL);
  GET DIAGNOSTICS v_bloq = ROW_COUNT;

  INSERT INTO dedup_backup_rows (run_tag, table_name, row_id, row_data)
  SELECT v_run, 'broadcast_suppressions_inseridas', s.id::text, to_jsonb(s)
  FROM broadcast_suppressions s WHERE s.note LIKE 'número inválido (lote C%' AND s.created_at >= now() - interval '1 minute';

  SELECT string_agg(coalesce(i.name, '?') || ' ' || a.phone, ', ' ORDER BY i.name, a.phone) INTO v_lista
  FROM alvo a LEFT JOIN institutions i ON i.id = a.institution_id;

  IF NOT v_apply THEN
    RAISE EXCEPTION 'DRY-RUN (desfeito) run=%: a) Universo Uno 084999959278 fundido em 5584999959278 (referências movidas %); b) bloqueios novos % (já bloqueados %): %; fora: 120363421398645325 (18 dígitos, não cabe na lista)',
      v_run, v_refs, v_bloq, v_ja, v_lista;
  END IF;
  RAISE NOTICE 'APLICADO run=%: a) referências movidas %; b) bloqueios novos % (já bloqueados %): %', v_run, v_refs, v_bloq, v_ja, v_lista;
END
$run$;
