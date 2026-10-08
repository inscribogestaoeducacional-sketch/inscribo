-- =============================================================================
-- Fase B, item 3 (+ correção dos fixos) — RENOMEAÇÃO de conversas, sem fusão.
-- NÃO está em supabase/migrations: roda manualmente, na janela aprovada, com
--   supabase db query --linked -f supabase/pendentes/fase_b_item3_renomear.sql
-- com v_apply = true. Com v_apply = false (padrão) faz tudo e DESFAZ no fim
-- (RAISE EXCEPTION) — é o dry-run, pelo mesmo caminho de código.
--
-- O que faz, numa única transação:
--   A) fixo_rename: conversa de 13 dígitos que é fixo com 9 inventado (a Meta
--      mandou o número de 12 dígitos em raw_data.from) e SEM linha real de 12
--      → remote_jid volta pro número real de 12 dígitos.
--      (Fixo que JÁ tem a linha real — Escola Semear — é um par: fica pro
--      piloto de fusão, Fase C.)
--   B) celular_rename: conversa de 12 dígitos de CELULAR (1º dígito local
--      6–9) sem par de 13 → remote_jid ganha o 9 (= base_jid).
--   Em ambos, move junto o remote_jid de: whatsapp_messages (forma crua e
--   com @s.whatsapp.net), whatsapp_conversation_events,
--   whatsapp_scheduled_messages, capture_trigger_hits, bot_timeout_queue e
--   user_notifications. Nada é apagado; o id da conversa não muda.
--   base_jid não muda (é o mesmo antes e depois), então RLS de mensagens e
--   contatos seguem iguais. Nenhuma mensagem sai pra Meta.
--   Pula (e lista): robô ligado, ou não concluída com atividade < 24 h.
--
-- Rollback: dedup_map (de/para por conversa) + dedup_backup_conversations
-- (linha inteira antes) + dedup_backup_refs (tabela, id, valor antigo) —
-- devolver remote_jid pelos ids, na ordem inversa.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.dedup_map (
  id                        BIGSERIAL PRIMARY KEY,
  run_tag                   TEXT        NOT NULL,
  op                        TEXT        NOT NULL,   -- fixo_rename | celular_rename | (Fase C: pair_merge)
  institution_id            UUID        NOT NULL,
  legacy_conversation_id    UUID        NOT NULL,
  canonical_conversation_id UUID        NOT NULL,
  old_jid                   TEXT        NOT NULL,
  new_jid                   TEXT        NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.dedup_backup_conversations (
  run_tag     TEXT        NOT NULL,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_data    JSONB       NOT NULL
);
CREATE TABLE IF NOT EXISTS public.dedup_backup_refs (
  run_tag    TEXT   NOT NULL,
  table_name TEXT   NOT NULL,
  row_id     TEXT   NOT NULL,
  column_name TEXT  NOT NULL,
  old_value  TEXT,
  new_value  TEXT
);
ALTER TABLE public.dedup_map                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dedup_backup_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dedup_backup_refs          ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dedup_map, public.dedup_backup_conversations, public.dedup_backup_refs FROM anon, authenticated;

DO $run$
DECLARE
  v_apply   BOOLEAN := false;                          -- ← true SÓ na execução aprovada
  v_run     TEXT    := 'faseB_item3_' || to_char(now() AT TIME ZONE 'America/Fortaleza', 'YYYYMMDD_HH24MI');
  r         RECORD;
  v_n       INT;
  v_summary TEXT := '';
  v_skipped TEXT := '';
BEGIN
  -- ── Candidatos (calculados agora, dentro da transação) ────────────────────
  CREATE TEMP TABLE cand ON COMMIT DROP AS
  WITH c AS (
    SELECT c.*, regexp_replace(c.remote_jid, '\D', '', 'g') AS d
    FROM whatsapp_conversations c
    WHERE c.institution_id IS NOT NULL AND NOT COALESCE(c.is_aion_inbox, false)
      AND c.remote_jid NOT LIKE '%@g.us'
  )
  SELECT 'fixo_rename'::text AS op, c.id, c.institution_id, c.remote_jid AS old_jid,
         substring(c.d, 1, 4) || substring(c.d, 6) AS new_jid,
         c.bot_active, c.status, c.last_message_at, c.contact_name
  FROM c
  WHERE c.d ~ '^55\d{2}9[2-5]\d{7}$'
    AND EXISTS (SELECT 1 FROM whatsapp_messages m
                WHERE m.institution_id = c.institution_id AND m.remote_jid = c.remote_jid AND NOT m.from_me
                  AND regexp_replace(COALESCE(m.raw_data->>'from', ''), '\D', '', 'g') = substring(c.d, 1, 4) || substring(c.d, 6))
    AND NOT EXISTS (SELECT 1 FROM whatsapp_conversations o
                    WHERE o.institution_id = c.institution_id
                      AND o.remote_jid IN (substring(c.d, 1, 4) || substring(c.d, 6), substring(c.d, 1, 4) || substring(c.d, 6) || '@s.whatsapp.net'))
  UNION ALL
  SELECT 'celular_rename', c.id, c.institution_id, c.remote_jid,
         substring(c.d, 1, 4) || '9' || substring(c.d, 5),
         c.bot_active, c.status, c.last_message_at, c.contact_name
  FROM c
  WHERE c.d ~ '^55\d{2}[6-9]\d{7}$'
    AND NOT EXISTS (SELECT 1 FROM whatsapp_conversations o
                    WHERE o.institution_id = c.institution_id AND o.id <> c.id AND o.base_jid = c.base_jid);

  -- Pular: robô ligado, ou aberta com atividade nas últimas 24 h.
  CREATE TEMP TABLE skip ON COMMIT DROP AS
  SELECT * FROM cand
  WHERE bot_active OR (status <> 'closed' AND last_message_at > now() - interval '24 hours');
  DELETE FROM cand WHERE id IN (SELECT id FROM skip);

  -- Trava as conversas que vão mudar (webhook/Hub esperam a transação).
  PERFORM 1 FROM whatsapp_conversations WHERE id IN (SELECT id FROM cand) FOR UPDATE;

  -- ── Backup + mapa ─────────────────────────────────────────────────────────
  INSERT INTO dedup_backup_conversations (run_tag, row_data)
  SELECT v_run, to_jsonb(c) FROM whatsapp_conversations c WHERE c.id IN (SELECT id FROM cand);

  INSERT INTO dedup_map (run_tag, op, institution_id, legacy_conversation_id, canonical_conversation_id, old_jid, new_jid)
  SELECT v_run, op, institution_id, id, id, old_jid, new_jid FROM cand;

  -- Formas antigas do JID (crua e com sufixo) por conversa.
  CREATE TEMP TABLE forms ON COMMIT DROP AS
  SELECT cand.id, cand.institution_id, cand.new_jid, f.old_form
  FROM cand, LATERAL (VALUES (regexp_replace(cand.old_jid, '@s\.whatsapp\.net$', '')),
                             (regexp_replace(cand.old_jid, '@s\.whatsapp\.net$', '') || '@s.whatsapp.net')) f(old_form);

  -- ── Referências: backup de cada linha e depois o UPDATE ──────────────────
  INSERT INTO dedup_backup_refs (run_tag, table_name, row_id, column_name, old_value, new_value)
  SELECT v_run, 'whatsapp_messages', m.id::text, 'remote_jid', m.remote_jid, f.new_jid
  FROM whatsapp_messages m JOIN forms f ON m.institution_id = f.institution_id AND m.remote_jid = f.old_form;
  UPDATE whatsapp_messages m SET remote_jid = f.new_jid
  FROM forms f WHERE m.institution_id = f.institution_id AND m.remote_jid = f.old_form;

  INSERT INTO dedup_backup_refs (run_tag, table_name, row_id, column_name, old_value, new_value)
  SELECT v_run, 'whatsapp_conversation_events', e.id::text, 'remote_jid', e.remote_jid, f.new_jid
  FROM whatsapp_conversation_events e JOIN forms f ON e.institution_id = f.institution_id AND e.remote_jid = f.old_form;
  UPDATE whatsapp_conversation_events e SET remote_jid = f.new_jid
  FROM forms f WHERE e.institution_id = f.institution_id AND e.remote_jid = f.old_form;

  INSERT INTO dedup_backup_refs (run_tag, table_name, row_id, column_name, old_value, new_value)
  SELECT v_run, 'whatsapp_scheduled_messages', s.id::text, 'remote_jid', s.remote_jid, f.new_jid
  FROM whatsapp_scheduled_messages s JOIN forms f ON s.institution_id = f.institution_id AND s.remote_jid = f.old_form;
  UPDATE whatsapp_scheduled_messages s SET remote_jid = f.new_jid
  FROM forms f WHERE s.institution_id = f.institution_id AND s.remote_jid = f.old_form;

  INSERT INTO dedup_backup_refs (run_tag, table_name, row_id, column_name, old_value, new_value)
  SELECT v_run, 'capture_trigger_hits', h.id::text, 'remote_jid', h.remote_jid, f.new_jid
  FROM capture_trigger_hits h JOIN forms f ON h.institution_id = f.institution_id AND h.remote_jid = f.old_form;
  UPDATE capture_trigger_hits h SET remote_jid = f.new_jid
  FROM forms f WHERE h.institution_id = f.institution_id AND h.remote_jid = f.old_form;

  INSERT INTO dedup_backup_refs (run_tag, table_name, row_id, column_name, old_value, new_value)
  SELECT v_run, 'bot_timeout_queue', b.id::text, 'remote_jid', b.remote_jid, f.new_jid
  FROM bot_timeout_queue b JOIN forms f ON b.institution_id = f.institution_id AND b.remote_jid = f.old_form;
  UPDATE bot_timeout_queue b SET remote_jid = f.new_jid
  FROM forms f WHERE b.institution_id = f.institution_id AND b.remote_jid = f.old_form;

  INSERT INTO dedup_backup_refs (run_tag, table_name, row_id, column_name, old_value, new_value)
  SELECT v_run, 'user_notifications', u.id::text, 'remote_jid', u.remote_jid, f.new_jid
  FROM user_notifications u JOIN forms f ON u.institution_id = f.institution_id AND u.remote_jid = f.old_form;
  UPDATE user_notifications u SET remote_jid = f.new_jid
  FROM forms f WHERE u.institution_id = f.institution_id AND u.remote_jid = f.old_form;

  -- Por último a própria conversa (UNIQUE institution_id+remote_jid: o
  -- destino não existe — garantido pela seleção acima).
  UPDATE whatsapp_conversations c SET remote_jid = cand.new_jid
  FROM cand WHERE c.id = cand.id;

  -- ── Conferência dentro da transação ──────────────────────────────────────
  -- Nenhuma mensagem/evento pode ter ficado na forma antiga.
  SELECT count(*) INTO v_n FROM whatsapp_messages m JOIN forms f ON m.institution_id = f.institution_id AND m.remote_jid = f.old_form;
  IF v_n > 0 THEN RAISE EXCEPTION 'ABORTADO: % mensagens ficaram no JID antigo', v_n; END IF;
  -- Nenhum par novo criado pela renomeação.
  SELECT count(*) INTO v_n FROM (
    SELECT institution_id, base_jid FROM whatsapp_conversations
    WHERE id IN (SELECT id FROM cand) GROUP BY 1, 2) g
  JOIN whatsapp_conversations o USING (institution_id, base_jid)
  WHERE o.id NOT IN (SELECT id FROM cand);
  IF v_n > 0 THEN RAISE EXCEPTION 'ABORTADO: % conversas renomeadas colidiram com outra linha', v_n; END IF;

  -- ── Resumo por escola ────────────────────────────────────────────────────
  FOR r IN
    SELECT i.name, cand.op, count(*) AS convs,
      (SELECT count(*) FROM dedup_backup_refs b WHERE b.run_tag = v_run AND b.table_name = 'whatsapp_messages'
         AND b.new_value IN (SELECT c2.new_jid FROM cand c2 WHERE c2.institution_id = cand.institution_id AND c2.op = cand.op)) AS msgs,
      (SELECT count(*) FROM dedup_backup_refs b WHERE b.run_tag = v_run AND b.table_name = 'whatsapp_conversation_events'
         AND b.new_value IN (SELECT c2.new_jid FROM cand c2 WHERE c2.institution_id = cand.institution_id AND c2.op = cand.op)) AS eventos,
      (SELECT count(*) FROM dedup_backup_refs b WHERE b.run_tag = v_run AND b.table_name NOT IN ('whatsapp_messages', 'whatsapp_conversation_events')
         AND b.new_value IN (SELECT c2.new_jid FROM cand c2 WHERE c2.institution_id = cand.institution_id AND c2.op = cand.op)) AS outras
    FROM cand JOIN institutions i ON i.id = cand.institution_id
    GROUP BY i.name, cand.op, cand.institution_id ORDER BY 1, 2
  LOOP
    v_summary := v_summary || format(E'\n  %s | %s: %s conversas, %s mensagens, %s eventos, %s outras refs', r.name, r.op, r.convs, r.msgs, r.eventos, r.outras);
  END LOOP;
  FOR r IN SELECT i.name, s.op, s.old_jid, s.contact_name, s.status, s.bot_active, s.last_message_at
           FROM skip s JOIN institutions i ON i.id = s.institution_id ORDER BY 1 LOOP
    v_skipped := v_skipped || format(E'\n  PULADA %s | %s | %s (%s) status=%s robo=%s ultima=%s',
      r.name, r.op, r.old_jid, COALESCE(r.contact_name, '-'), r.status, r.bot_active, to_char(r.last_message_at AT TIME ZONE 'America/Fortaleza', 'DD/MM HH24:MI'));
  END LOOP;
  FOR r IN SELECT i.name, cand.old_jid, cand.new_jid, cand.contact_name FROM cand JOIN institutions i ON i.id = cand.institution_id
           WHERE cand.op = 'fixo_rename' ORDER BY 1 LOOP
    v_summary := v_summary || format(E'\n    fixo: %s %s -> %s (%s)', r.name, r.old_jid, r.new_jid, COALESCE(r.contact_name, '-'));
  END LOOP;

  IF NOT v_apply THEN
    RAISE EXCEPTION E'DRY-RUN (desfeito) run=%:%\n%', v_run, v_summary, COALESCE(NULLIF(v_skipped, ''), E'\n  nenhuma pulada');
  END IF;
  RAISE NOTICE E'APLICADO run=%:%\n%', v_run, v_summary, COALESCE(NULLIF(v_skipped, ''), E'\n  nenhuma pulada');
END
$run$;
