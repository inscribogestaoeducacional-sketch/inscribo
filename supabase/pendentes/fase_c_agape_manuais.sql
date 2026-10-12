-- =============================================================================
-- Fase C — fusão MANUAL de pares do Colégio Ágape Patos (12 × 13 dígitos) que
-- ficaram fora dos lotes por dono/lead diferente ou atividade recente.
-- Decisões do Victor em 12/10/2026, par a par, na tabela escolha abaixo:
--   dono escolhido (uuid) ou NULL = regra padrão (dono da conversa mais recente).
-- Mesmo procedimento de fase_c_agape_lotes.sql (backup completo, move
-- referências por número e por id, combina a canônica, aviso a quem perder
-- conversa aberta, contato unificado). Só pares da lista; os de leads
-- diferentes continuam recusados (abortam) até haver decisão do lead.
--   supabase db query --linked -f supabase/pendentes/fase_c_agape_manuais.sql
-- v_apply = false (padrão) faz tudo e DESFAZ no fim (dry-run pelo mesmo código).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.dedup_backup_rows (
  run_tag      TEXT        NOT NULL,
  table_name   TEXT        NOT NULL,
  row_id       TEXT        NOT NULL,
  row_data     JSONB       NOT NULL,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dedup_backup_rows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dedup_backup_rows FROM anon, authenticated;

DO $run$
DECLARE
  v_apply   BOOLEAN := false;                          -- ← true SÓ na execução aprovada
      v_run     TEXT;
  v_inst    UUID;
  p         RECORD;
  r         RECORD;
  w         RECORD;   -- conversa "vencedora" (atividade mais recente)
  v_n       INT;
  v_before  INT;
  v_after   INT;
  v_ev_before INT;
  v_ev_after  INT;
  v_summary TEXT := '';
  v_skipped TEXT := '';
  v_keep_ct UUID;
  v_drop_ct UUID;
  v_avisos  INT := 0;
BEGIN
  v_run := 'faseC_agape_manual_' || to_char(now() AT TIME ZONE 'America/Fortaleza', 'YYYYMMDD_HH24MI');
  SELECT id INTO v_inst FROM institutions WHERE name = 'Colégio Ágape Patos';
  IF v_inst IS NULL THEN RAISE EXCEPTION 'ABORTADO: escola não encontrada'; END IF;

  -- ── Escolhas do Victor (12/10) ─────────────────────────────────────────
  CREATE TEMP TABLE escolha (base_jid text PRIMARY KEY, dono uuid) ON COMMIT DROP;
  INSERT INTO escolha VALUES
    ('5583986474440', 'e57a8414-40ab-486d-b47d-25f310b7b115'),  -- Clébia Andrade: fica Luan
    ('5583996540710', '0c8808a5-7a78-44de-8e1f-90e06dd7ba38'),  -- Ingriddy: responsável do lead 9dfb9036 = Clebia
    ('5583996616959', '0c8808a5-7a78-44de-8e1f-90e06dd7ba38'),  -- Jessyellen: fica Clebia
    ('5583999206694', '0c8808a5-7a78-44de-8e1f-90e06dd7ba38');  -- Jefferson: fica Clebia

  -- ── Pares ────────────────────────────────────────────────────────────────
  CREATE TEMP TABLE pares ON COMMIT DROP AS
  WITH c AS (
    SELECT c.*, regexp_replace(c.remote_jid, '\D', '', 'g') AS d
    FROM whatsapp_conversations c
    WHERE c.institution_id = v_inst
  ), g AS (
    SELECT base_jid, count(*) n,
           max(id::text) FILTER (WHERE length(d) = 12)::uuid AS id12,
           max(id::text) FILTER (WHERE length(d) = 13)::uuid AS id13
    FROM c GROUP BY base_jid
  )
  SELECT g.base_jid, g.n,
         -- 1º dígito local do número de 12: 6–9 celular (fica o de 13), senão fixo (fica o de 12)
         CASE WHEN substring(c12.d, 5, 1) ~ '[6-9]' THEN g.id13 ELSE g.id12 END AS keep_id,
         CASE WHEN substring(c12.d, 5, 1) ~ '[6-9]' THEN g.id12 ELSE g.id13 END AS drop_id,
         CASE WHEN substring(c12.d, 5, 1) ~ '[6-9]' THEN 'celular' ELSE 'fixo' END AS tipo
  FROM g JOIN c c12 ON c12.id = g.id12
  WHERE g.id12 IS NOT NULL AND g.id13 IS NOT NULL;

  CREATE TEMP TABLE skip ON COMMIT DROP AS
  SELECT pr.*, k.remote_jid kjid,
         concat_ws(', ',
           CASE WHEN pr.n <> 2 THEN 'mais de 2 conversas' END,
           CASE WHEN k.bot_active OR d.bot_active THEN 'robô ativo' END,
           CASE WHEN greatest(k.last_message_at, d.last_message_at) > now() - interval '24 hours' THEN 'atividade nas últimas 24 h' END,
           CASE WHEN k.lead_id IS NOT NULL AND d.lead_id IS NOT NULL AND k.lead_id <> d.lead_id THEN 'leads diferentes' END
         ) AS motivo
  FROM pares pr
  JOIN whatsapp_conversations k ON k.id = pr.keep_id
  JOIN whatsapp_conversations d ON d.id = pr.drop_id
  WHERE pr.n <> 2 OR k.bot_active OR d.bot_active
     OR greatest(k.last_message_at, d.last_message_at) > now() - interval '24 hours'
     OR (k.lead_id IS NOT NULL AND d.lead_id IS NOT NULL AND k.lead_id <> d.lead_id);
  DELETE FROM pares WHERE base_jid IN (SELECT base_jid FROM skip);
  FOR r IN SELECT kjid, motivo FROM skip ORDER BY kjid LOOP v_skipped := v_skipped || E'\n  PULADO ' || r.kjid || ' — ' || r.motivo; END LOOP;

  -- Só os pares da lista de escolhas. Par da lista que foi pulado aborta tudo.
  IF EXISTS (SELECT 1 FROM skip WHERE base_jid IN (SELECT base_jid FROM escolha)) THEN
    RAISE EXCEPTION E'ABORTADO: par da lista não elegível:%', v_skipped;
  END IF;
  DELETE FROM pares WHERE base_jid NOT IN (SELECT base_jid FROM escolha);
  IF (SELECT count(*) FROM pares) <> (SELECT count(*) FROM escolha) THEN
    RAISE EXCEPTION 'ABORTADO: % pares encontrados para % escolhas', (SELECT count(*) FROM pares), (SELECT count(*) FROM escolha);
  END IF;

  PERFORM 1 FROM whatsapp_conversations WHERE id IN (SELECT keep_id FROM pares UNION SELECT drop_id FROM pares) FOR UPDATE;

  FOR p IN
    SELECT pr.*, k.remote_jid AS kjid, d.remote_jid AS djid
    FROM pares pr JOIN whatsapp_conversations k ON k.id = pr.keep_id JOIN whatsapp_conversations d ON d.id = pr.drop_id
    ORDER BY k.remote_jid
  LOOP
    -- ── 1. Backup completo ─────────────────────────────────────────────────
    INSERT INTO dedup_backup_conversations (run_tag, row_data)
    SELECT v_run, to_jsonb(c) FROM whatsapp_conversations c WHERE c.id IN (p.keep_id, p.drop_id);

    INSERT INTO dedup_backup_rows (run_tag, table_name, row_id, row_data)
    SELECT v_run, 'whatsapp_messages', m.id::text, to_jsonb(m) FROM whatsapp_messages m
    WHERE m.institution_id = v_inst
      AND (m.remote_jid IN (p.kjid, p.djid, p.kjid || '@s.whatsapp.net', p.djid || '@s.whatsapp.net') OR m.conversation_id IN (p.keep_id, p.drop_id));
    INSERT INTO dedup_backup_rows (run_tag, table_name, row_id, row_data)
    SELECT v_run, 'whatsapp_conversation_events', e.id::text, to_jsonb(e) FROM whatsapp_conversation_events e
    WHERE e.institution_id = v_inst AND e.remote_jid IN (p.kjid, p.djid);
    INSERT INTO dedup_backup_rows (run_tag, table_name, row_id, row_data)
    SELECT v_run, 'whatsapp_contacts', ct.id::text, to_jsonb(ct) FROM whatsapp_contacts ct
    WHERE ct.institution_id = v_inst AND regexp_replace(ct.phone, '\D', '', 'g') IN (p.kjid, p.djid);

    INSERT INTO dedup_map (run_tag, op, institution_id, legacy_conversation_id, canonical_conversation_id, old_jid, new_jid)
    VALUES (v_run, 'pair_merge', v_inst, p.drop_id, p.keep_id, p.djid, p.kjid);

    SELECT count(*) INTO v_before FROM whatsapp_messages m
    WHERE m.institution_id = v_inst AND m.remote_jid IN (p.kjid, p.djid, p.kjid || '@s.whatsapp.net', p.djid || '@s.whatsapp.net');
    SELECT count(*) INTO v_ev_before FROM whatsapp_conversation_events e WHERE e.institution_id = v_inst AND e.remote_jid IN (p.kjid, p.djid);

    -- ── 2. Referências por número ──────────────────────────────────────────
    INSERT INTO dedup_backup_refs SELECT v_run, 'whatsapp_messages', m.id::text, 'remote_jid', m.remote_jid, p.kjid
      FROM whatsapp_messages m WHERE m.institution_id = v_inst AND m.remote_jid IN (p.djid, p.djid || '@s.whatsapp.net');
    UPDATE whatsapp_messages SET remote_jid = p.kjid WHERE institution_id = v_inst AND remote_jid IN (p.djid, p.djid || '@s.whatsapp.net');

    INSERT INTO dedup_backup_refs SELECT v_run, 'whatsapp_conversation_events', e.id::text, 'remote_jid', e.remote_jid, p.kjid
      FROM whatsapp_conversation_events e WHERE e.institution_id = v_inst AND e.remote_jid = p.djid;
    UPDATE whatsapp_conversation_events SET remote_jid = p.kjid WHERE institution_id = v_inst AND remote_jid = p.djid;

    INSERT INTO dedup_backup_refs SELECT v_run, 'whatsapp_scheduled_messages', s.id::text, 'remote_jid', s.remote_jid, p.kjid
      FROM whatsapp_scheduled_messages s WHERE s.institution_id = v_inst AND s.remote_jid = p.djid;
    UPDATE whatsapp_scheduled_messages SET remote_jid = p.kjid WHERE institution_id = v_inst AND remote_jid = p.djid;

    INSERT INTO dedup_backup_refs SELECT v_run, 'capture_trigger_hits', h.id::text, 'remote_jid', h.remote_jid, p.kjid
      FROM capture_trigger_hits h WHERE h.institution_id = v_inst AND h.remote_jid = p.djid;
    UPDATE capture_trigger_hits SET remote_jid = p.kjid WHERE institution_id = v_inst AND remote_jid = p.djid;

    INSERT INTO dedup_backup_refs SELECT v_run, 'user_notifications', u.id::text, 'remote_jid', u.remote_jid, p.kjid
      FROM user_notifications u WHERE u.institution_id = v_inst AND u.remote_jid = p.djid;
    UPDATE user_notifications SET remote_jid = p.kjid WHERE institution_id = v_inst AND remote_jid = p.djid;

    -- Fila do robô: única por número. Se a canônica já tem, a da que sai
    -- vai pro backup e sai; senão é renomeada.
    IF EXISTS (SELECT 1 FROM bot_timeout_queue WHERE institution_id = v_inst AND remote_jid = p.kjid) THEN
      INSERT INTO dedup_backup_rows SELECT v_run, 'bot_timeout_queue', q.id::text, to_jsonb(q)
        FROM bot_timeout_queue q WHERE q.institution_id = v_inst AND q.remote_jid = p.djid;
      DELETE FROM bot_timeout_queue WHERE institution_id = v_inst AND remote_jid = p.djid;
    ELSE
      INSERT INTO dedup_backup_refs SELECT v_run, 'bot_timeout_queue', q.id::text, 'remote_jid', q.remote_jid, p.kjid
        FROM bot_timeout_queue q WHERE q.institution_id = v_inst AND q.remote_jid = p.djid;
      UPDATE bot_timeout_queue SET remote_jid = p.kjid WHERE institution_id = v_inst AND remote_jid = p.djid;
    END IF;

    -- Notas/campos do contato guardados pelo número.
    INSERT INTO dedup_backup_refs SELECT v_run, 'contact_notes', n.id::text, 'contact_ref_id', n.contact_ref_id, p.kjid
      FROM contact_notes n WHERE n.contact_ref_id = p.djid;
    UPDATE contact_notes SET contact_ref_id = p.kjid WHERE contact_ref_id = p.djid;
    IF EXISTS (SELECT 1 FROM contact_field_values a JOIN contact_field_values b ON a.field_id = b.field_id
               WHERE a.contact_ref_id = p.djid AND b.contact_ref_id = p.kjid) THEN
      RAISE EXCEPTION 'ABORTADO: campo personalizado nas duas formas de %', p.kjid;
    END IF;
    INSERT INTO dedup_backup_refs SELECT v_run, 'contact_field_values', v.id::text, 'contact_ref_id', v.contact_ref_id, p.kjid
      FROM contact_field_values v WHERE v.contact_ref_id = p.djid;
    UPDATE contact_field_values SET contact_ref_id = p.kjid WHERE contact_ref_id = p.djid;

    -- ── 2b. Referências por id da conversa ─────────────────────────────────
    INSERT INTO dedup_backup_refs SELECT v_run, 'whatsapp_messages', m.id::text, 'conversation_id', m.conversation_id::text, p.keep_id::text
      FROM whatsapp_messages m WHERE m.conversation_id = p.drop_id;
    UPDATE whatsapp_messages SET conversation_id = p.keep_id WHERE conversation_id = p.drop_id;
    INSERT INTO dedup_backup_refs SELECT v_run, 'whatsapp_scheduled_messages', s.id::text, 'conversation_id', s.conversation_id::text, p.keep_id::text
      FROM whatsapp_scheduled_messages s WHERE s.conversation_id = p.drop_id;
    UPDATE whatsapp_scheduled_messages SET conversation_id = p.keep_id WHERE conversation_id = p.drop_id;
    INSERT INTO dedup_backup_refs SELECT v_run, 'capture_trigger_hits', h.id::text, 'conversation_id', h.conversation_id::text, p.keep_id::text
      FROM capture_trigger_hits h WHERE h.conversation_id = p.drop_id;
    UPDATE capture_trigger_hits SET conversation_id = p.keep_id WHERE conversation_id = p.drop_id;
    INSERT INTO dedup_backup_refs SELECT v_run, 'user_notifications', u.id::text, 'conversation_id', u.conversation_id::text, p.keep_id::text
      FROM user_notifications u WHERE u.conversation_id = p.drop_id;
    UPDATE user_notifications SET conversation_id = p.keep_id WHERE conversation_id = p.drop_id;
    INSERT INTO dedup_backup_refs SELECT v_run, 'broadcast_recipients', b.id::text, 'conversation_id', b.conversation_id::text, p.keep_id::text
      FROM broadcast_recipients b WHERE b.conversation_id = p.drop_id;
    UPDATE broadcast_recipients SET conversation_id = p.keep_id WHERE conversation_id = p.drop_id;
    INSERT INTO dedup_backup_refs SELECT v_run, 'broadcast_reply_events', b.id::text, 'conversation_id', b.conversation_id::text, p.keep_id::text
      FROM broadcast_reply_events b WHERE b.conversation_id = p.drop_id;
    UPDATE broadcast_reply_events SET conversation_id = p.keep_id WHERE conversation_id = p.drop_id;

    -- ── 3. Combina a canônica ──────────────────────────────────────────────
    SELECT * INTO w FROM whatsapp_conversations WHERE id IN (p.keep_id, p.drop_id)
    ORDER BY last_message_at DESC NULLS LAST LIMIT 1;

    UPDATE whatsapp_conversations k SET
      status             = w.status,
      assigned_user_id   = w.assigned_user_id,
      assigned_user_name = w.assigned_user_name,
      closed_at          = w.closed_at,
      bot_active         = false,
      bot_current_node   = NULL,
      lead_id            = COALESCE(k.lead_id, d.lead_id),
      contact_type       = COALESCE(k.contact_type, d.contact_type),
      notes              = COALESCE(NULLIF(k.notes, ''), d.notes),
      contact_name       = CASE WHEN COALESCE(k.contact_name, '') ~ '^[0-9+ ]*$' THEN COALESCE(d.contact_name, k.contact_name) ELSE k.contact_name END,
      tags               = (SELECT array_agg(DISTINCT t) FROM unnest(COALESCE(k.tags, '{}') || COALESCE(d.tags, '{}')) t),
      unread_count       = COALESCE(k.unread_count, 0) + COALESCE(d.unread_count, 0),
      last_message       = w.last_message,
      last_message_at    = w.last_message_at,
      last_customer_message_at = greatest(k.last_customer_message_at, d.last_customer_message_at),
      first_human_response_at  = least(k.first_human_response_at, d.first_human_response_at),
      satisfaction_score = COALESCE(k.satisfaction_score, d.satisfaction_score),
      profile_picture_url = COALESCE(k.profile_picture_url, d.profile_picture_url)
    FROM whatsapp_conversations d
    WHERE k.id = p.keep_id AND d.id = p.drop_id;

    -- Dono escolhido pelo Victor (NULL = fica o da regra acima).
    UPDATE whatsapp_conversations k SET
      assigned_user_id   = e.dono,
      assigned_user_name = (SELECT u.full_name FROM users u WHERE u.id = e.dono)
    FROM escolha e
    WHERE k.id = p.keep_id AND e.base_jid = p.base_jid AND e.dono IS NOT NULL;

    -- ── 3b. Aviso a quem perdeu conversa aberta ────────────────────────────
    -- Dono de uma das duas que estava ABERTA e, depois da fusão, não é mais o
    -- dono ou a conversa ficou encerrada. Pelo id do dono (nunca pelo nome).
    INSERT INTO user_notifications (user_id, institution_id, type, title, body, remote_jid, conversation_id)
    SELECT DISTINCT o.assigned_user_id, v_inst, 'conversation_merged',
           'Conversa unificada: ' || COALESCE(k.contact_name, p.kjid),
           'Este contato tinha duas conversas (número com e sem o 9). A que estava com você foi juntada ao histórico completo, que agora está '
             || CASE WHEN k.status = 'closed' THEN 'encerrada' ELSE 'aberta' END
             || CASE WHEN k.assigned_user_name IS NOT NULL THEN ', com ' || btrim(k.assigned_user_name) ELSE ', sem responsável' END || '.',
           p.kjid, p.keep_id
    FROM whatsapp_conversations k,
         (SELECT (row_data->>'assigned_user_id')::uuid AS assigned_user_id, row_data->>'status' AS status
          FROM dedup_backup_conversations WHERE run_tag = v_run AND (row_data->>'id')::uuid IN (p.keep_id, p.drop_id)) o
    WHERE k.id = p.keep_id AND o.status = 'open' AND o.assigned_user_id IS NOT NULL
      AND (k.assigned_user_id IS DISTINCT FROM o.assigned_user_id OR k.status = 'closed')
      AND EXISTS (SELECT 1 FROM users u WHERE u.id = o.assigned_user_id AND COALESCE(u.active, true));
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_avisos := v_avisos + v_n;
    v_summary := v_summary || CASE WHEN v_n > 0 THEN format(E'\n    aviso para: %s', (
      SELECT string_agg(btrim(u.full_name), ', ') FROM user_notifications un JOIN users u ON u.id = un.user_id
      WHERE un.type = 'conversation_merged' AND un.conversation_id = p.keep_id AND un.created_at >= now())) ELSE '' END;

    -- ── 4. Sai a conversa duplicada (já no backup) ─────────────────────────
    DELETE FROM whatsapp_conversations WHERE id = p.drop_id;
    INSERT INTO whatsapp_conversation_events (institution_id, remote_jid, event_type, description, metadata)
    VALUES (v_inst, p.kjid, 'merged',
            'Histórico unificado: a conversa duplicada do número ' || p.djid || ' foi incorporada a esta',
            jsonb_build_object('run_tag', v_run, 'merged_from', p.djid, 'merged_conversation_id', p.drop_id));

    -- ── 5. Contato ─────────────────────────────────────────────────────────
    SELECT id INTO v_keep_ct FROM whatsapp_contacts WHERE institution_id = v_inst AND regexp_replace(phone, '\D', '', 'g') = p.kjid;
    SELECT id INTO v_drop_ct FROM whatsapp_contacts WHERE institution_id = v_inst AND regexp_replace(phone, '\D', '', 'g') = p.djid;
    IF v_drop_ct IS NOT NULL AND v_keep_ct IS NULL THEN
      INSERT INTO dedup_backup_refs VALUES (v_run, 'whatsapp_contacts', v_drop_ct::text, 'phone', (SELECT phone FROM whatsapp_contacts WHERE id = v_drop_ct), p.kjid);
      UPDATE whatsapp_contacts SET phone = p.kjid, updated_at = now() WHERE id = v_drop_ct;
    ELSIF v_drop_ct IS NOT NULL AND v_keep_ct IS NOT NULL THEN
      UPDATE whatsapp_contacts k SET
        name    = CASE WHEN COALESCE(k.name, '') ~ '^[0-9+ ]*$' THEN COALESCE(d.name, k.name) ELSE k.name END,
        type    = CASE WHEN k.type IS NULL OR k.type = 'unknown' THEN d.type ELSE k.type END,
        lead_id = COALESCE(k.lead_id, d.lead_id),
        email   = COALESCE(k.email, d.email),
        tags    = (SELECT array_agg(DISTINCT t) FROM unnest(COALESCE(k.tags, '{}') || COALESCE(d.tags, '{}')) t),
        origin_capture_trigger_id = COALESCE(k.origin_capture_trigger_id, d.origin_capture_trigger_id),
        origin_captured_at        = COALESCE(k.origin_captured_at, d.origin_captured_at),
        updated_at = now()
      FROM whatsapp_contacts d WHERE k.id = v_keep_ct AND d.id = v_drop_ct;
      INSERT INTO dedup_backup_refs SELECT v_run, 'contact_field_change_log', x.id::text, 'contact_id', x.contact_id::text, v_keep_ct::text
        FROM contact_field_change_log x WHERE x.contact_id = v_drop_ct;
      UPDATE contact_field_change_log SET contact_id = v_keep_ct WHERE contact_id = v_drop_ct;
      INSERT INTO dedup_backup_refs SELECT v_run, 'capture_trigger_hits', x.id::text, 'contact_id', x.contact_id::text, v_keep_ct::text
        FROM capture_trigger_hits x WHERE x.contact_id = v_drop_ct;
      UPDATE capture_trigger_hits SET contact_id = v_keep_ct WHERE contact_id = v_drop_ct;
      INSERT INTO dedup_backup_refs SELECT v_run, 'broadcast_recipients', x.id::text, 'contact_id', x.contact_id::text, v_keep_ct::text
        FROM broadcast_recipients x WHERE x.contact_id = v_drop_ct;
      UPDATE broadcast_recipients SET contact_id = v_keep_ct WHERE contact_id = v_drop_ct;
      INSERT INTO dedup_backup_refs SELECT v_run, 'contact_notes', x.id::text, 'contact_ref_id', x.contact_ref_id, v_keep_ct::text
        FROM contact_notes x WHERE x.contact_ref_id = v_drop_ct::text;
      UPDATE contact_notes SET contact_ref_id = v_keep_ct::text WHERE contact_ref_id = v_drop_ct::text;
      UPDATE contact_field_values SET contact_ref_id = v_keep_ct::text WHERE contact_ref_id = v_drop_ct::text;
      DELETE FROM whatsapp_contacts WHERE id = v_drop_ct;
    END IF;

    -- ── Conferência do par ─────────────────────────────────────────────────
    SELECT count(*) INTO v_after FROM whatsapp_messages m WHERE m.institution_id = v_inst AND m.remote_jid IN (p.kjid, p.kjid || '@s.whatsapp.net');
    SELECT count(*) INTO v_ev_after FROM whatsapp_conversation_events e WHERE e.institution_id = v_inst AND e.remote_jid = p.kjid;
    IF v_after <> v_before THEN RAISE EXCEPTION 'ABORTADO: % mensagens antes e % depois em %', v_before, v_after, p.kjid; END IF;
    IF v_ev_after <> v_ev_before + 1 THEN RAISE EXCEPTION 'ABORTADO: eventos % antes e % depois em %', v_ev_before, v_ev_after, p.kjid; END IF;
    SELECT count(*) INTO v_n FROM whatsapp_conversations WHERE institution_id = v_inst AND base_jid = p.base_jid;
    IF v_n <> 1 THEN RAISE EXCEPTION 'ABORTADO: % conversas restantes em %', v_n, p.kjid; END IF;

    SELECT k.status, k.assigned_user_name, k.contact_name INTO r FROM whatsapp_conversations k WHERE k.id = p.keep_id;
    v_summary := v_summary || format(E'\n  %s (%s): fica %s, sai %s | mensagens %s→%s, eventos %s→%s | agora: %s / %s / "%s" | contatos restantes: %s',
      p.kjid, p.tipo, p.kjid, p.djid, v_before, v_after, v_ev_before, v_ev_after, r.status, COALESCE(r.assigned_user_name, 'sem dono'), r.contact_name,
      (SELECT count(*) FROM whatsapp_contacts WHERE institution_id = v_inst AND regexp_replace(phone, '\D', '', 'g') IN (p.kjid, p.djid)));
  END LOOP;

  v_summary := v_summary || format(E'\n  pares fundidos: %s | avisos: %s | pares elegíveis restantes depois deste lote: %s | pulados (decisão manual/robô/24h): %s',
    (SELECT count(*) FROM pares), v_avisos,
    (SELECT count(*) FROM (
       SELECT base_jid FROM whatsapp_conversations WHERE institution_id = v_inst
       GROUP BY base_jid HAVING count(*) > 1) x) - (SELECT count(*) FROM skip),
    (SELECT count(*) FROM skip));

  IF NOT v_apply THEN
    RAISE EXCEPTION E'DRY-RUN (desfeito) run=%:%\n%', v_run, v_summary, COALESCE(NULLIF(v_skipped, ''), E'\n  nenhum pulado');
  END IF;
  RAISE NOTICE E'APLICADO run=%:%\n%', v_run, v_summary, COALESCE(NULLIF(v_skipped, ''), E'\n  nenhum pulado');
END
$run$;
