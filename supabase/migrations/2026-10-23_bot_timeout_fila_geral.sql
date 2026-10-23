-- "Fila geral" no tempo do robô: quando o destino do robô foi escolhido de forma explícita
-- (bot_timeout_assignee_type preenchido) e sem pessoa/grupo, a conversa vai para a fila geral
-- e NÃO herda mais o destino de "fora do horário" (timeout_assignee_id).
-- Escolas com bot_timeout_assignee_type nulo continuam exatamente como antes.
-- Também registra no repositório a coluna automations (já existia no banco) e o liga/desliga parou_responder.
ALTER TABLE public.whatsapp_flows ADD COLUMN IF NOT EXISTS automations jsonb;

CREATE OR REPLACE FUNCTION public.process_bot_timeouts()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  flow_rec         RECORD;
  conv_rec         RECORD;
  assignee_id      UUID;
  assignee_name    TEXT;
  last_bot_msg     TIMESTAMPTZ;
  last_client_msg  TIMESTAMPTZ;
  group_id_to_use  UUID;
  group_member_ids UUID[];
  group_last_idx   INT;
  available_ids    UUID[];
  next_idx         INT;
BEGIN
  FOR flow_rec IN
    SELECT wf.institution_id,
           COALESCE(wf.bot_timeout_minutes, wf.timeout_minutes) AS timeout_min,
           COALESCE(wf.bot_timeout_message, wf.timeout_message) AS timeout_msg,
           CASE WHEN wf.bot_timeout_assignee_type IS NOT NULL
                THEN wf.bot_timeout_assignee_id
                ELSE COALESCE(wf.bot_timeout_assignee_id, wf.timeout_assignee_id)
           END AS assignee_id_cfg,
           wf.bot_timeout_assignee_type,
           wf.timeout_group_id
    FROM whatsapp_flows wf
    WHERE wf.bot_enabled = true
      AND COALESCE(wf.bot_timeout_minutes, wf.timeout_minutes) > 0
      AND COALESCE(wf.bot_timeout_message, wf.timeout_message) IS NOT NULL
      AND COALESCE((wf.automations->>'parou_responder')::boolean, true)
  LOOP
    FOR conv_rec IN
      SELECT wc.id, wc.remote_jid, wc.institution_id
      FROM whatsapp_conversations wc
      WHERE wc.institution_id = flow_rec.institution_id
        AND wc.bot_active = true
        AND wc.assigned_user_id IS NULL
        AND wc.status != 'closed'
    LOOP
      BEGIN
        SELECT MAX(created_at) INTO last_bot_msg
        FROM whatsapp_messages
        WHERE remote_jid = conv_rec.remote_jid
          AND institution_id = conv_rec.institution_id
          AND from_me = true;

        SELECT MAX(created_at) INTO last_client_msg
        FROM whatsapp_messages
        WHERE remote_jid = conv_rec.remote_jid
          AND institution_id = conv_rec.institution_id
          AND from_me = false;

        IF last_bot_msg IS NOT NULL
          AND last_bot_msg < NOW() - (flow_rec.timeout_min || ' minutes')::interval
          AND (last_client_msg IS NULL OR last_client_msg < last_bot_msg)
        THEN
          assignee_id   := NULL;
          assignee_name := NULL;
          next_idx      := NULL;

          group_id_to_use := CASE
            WHEN flow_rec.bot_timeout_assignee_type = 'group' THEN flow_rec.assignee_id_cfg
            WHEN flow_rec.bot_timeout_assignee_type IS NULL
                 AND flow_rec.timeout_group_id IS NOT NULL THEN flow_rec.timeout_group_id
            ELSE NULL
          END;

          IF group_id_to_use IS NOT NULL THEN
            SELECT g.member_ids, g.last_assigned_index
              INTO group_member_ids, group_last_idx
            FROM whatsapp_groups g
            WHERE g.id = group_id_to_use;

            IF group_member_ids IS NOT NULL AND array_length(group_member_ids, 1) > 0 THEN
              SELECT array_agg(u.id ORDER BY t.ord) INTO available_ids
              FROM unnest(group_member_ids) WITH ORDINALITY AS t(id, ord)
              JOIN users u ON u.id = t.id
              WHERE u.is_available IS NOT FALSE;

              IF available_ids IS NOT NULL AND array_length(available_ids, 1) > 0 THEN
                next_idx    := (COALESCE(group_last_idx, -1) + 1) % array_length(available_ids, 1);
                assignee_id := available_ids[next_idx + 1];
              END IF;
            END IF;
          ELSE
            assignee_id := flow_rec.assignee_id_cfg;
          END IF;

          IF assignee_id IS NOT NULL THEN
            SELECT full_name INTO assignee_name FROM users WHERE id = assignee_id;
          END IF;

          UPDATE whatsapp_conversations
          SET bot_active         = false,
              status             = CASE WHEN assignee_id IS NOT NULL THEN 'open' ELSE 'waiting' END,
              assigned_user_id   = assignee_id,
              assigned_user_name = assignee_name
          WHERE id = conv_rec.id
            AND bot_active = true
            AND assigned_user_id IS NULL
            AND status != 'closed';

          IF FOUND THEN
            IF next_idx IS NOT NULL THEN
              UPDATE whatsapp_groups SET last_assigned_index = next_idx WHERE id = group_id_to_use;
            END IF;

            INSERT INTO bot_timeout_queue (institution_id, remote_jid, message)
            VALUES (flow_rec.institution_id, conv_rec.remote_jid, flow_rec.timeout_msg)
            ON CONFLICT (institution_id, remote_jid) DO UPDATE
              SET message    = EXCLUDED.message,
                  sent       = false,
                  created_at = NOW()
              WHERE bot_timeout_queue.sent = true;

            INSERT INTO whatsapp_conversation_events (institution_id, remote_jid, event_type, description)
            VALUES (
              flow_rec.institution_id,
              conv_rec.remote_jid,
              'transfer',
              'Transferido automaticamente por inatividade após ' || flow_rec.timeout_min || ' minutos'
            );
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[process_bot_timeouts] falha na conversa % (institution %): %',
          conv_rec.remote_jid, conv_rec.institution_id, SQLERRM;
        INSERT INTO whatsapp_conversation_events (institution_id, remote_jid, event_type, description)
        VALUES (
          flow_rec.institution_id,
          conv_rec.remote_jid,
          'transfer_error',
          'Falha ao processar timeout automático: ' || SQLERRM
        );
      END;
    END LOOP;
  END LOOP;
END;
$function$;
