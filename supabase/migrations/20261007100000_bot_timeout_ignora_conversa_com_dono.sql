-- 20261007100000_bot_timeout_ignora_conversa_com_dono.sql
--
-- process_bot_timeouts() pegava toda conversa com bot_active = true e
-- status <> 'closed' — inclusive 'open' COM atendente. "Assumir conversa",
-- transferência e reabertura não desligavam o robô, então depois do tempo
-- de timeout o cron gravava status='waiting' e trocava o dono pelo
-- atendente/grupo do timeout: a conversa "sumia" de quem tinha assumido
-- (Ágape: atendente assumiu 15:04:57, cron tomou 15:05:00).
--
-- Agora:
--   1. Só entra conversa SEM dono (o robô ainda é quem atende). Conversa
--      'open' sem dono (limbo do toggle "Robô") entra também — o timeout
--      a tira do limbo.
--   2. O UPDATE repete as condições no WHERE: se um atendente assumir entre
--      o SELECT do loop e o UPDATE, nada é sobrescrito (e nada de fila,
--      evento ou avanço do rodízio).
--   3. status coerente com o dono: 'open' com atendente, 'waiting' sem —
--      nunca mais 'waiting' com dono.

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
           COALESCE(wf.bot_timeout_assignee_id, wf.timeout_assignee_id) AS assignee_id_cfg,
           wf.bot_timeout_assignee_type,
           wf.timeout_group_id
    FROM whatsapp_flows wf
    WHERE wf.bot_enabled = true
      AND COALESCE(wf.bot_timeout_minutes, wf.timeout_minutes) > 0
      AND COALESCE(wf.bot_timeout_message, wf.timeout_message) IS NOT NULL
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

        -- Só transfere se: 1) o bot enviou mensagem; 2) há mais de X min;
        -- 3) o cliente não respondeu depois do bot.
        IF last_bot_msg IS NOT NULL
          AND last_bot_msg < NOW() - (flow_rec.timeout_min || ' minutes')::interval
          AND (last_client_msg IS NULL OR last_client_msg < last_bot_msg)
        THEN
          assignee_id   := NULL;
          assignee_name := NULL;
          next_idx      := NULL;

          -- Fonte única de verdade: type='group' → assignee_id_cfg É o ID do
          -- grupo. Fallback legado: type nunca setado mas timeout_group_id
          -- preenchido à moda antiga.
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
              -- Grupo sem ninguém disponível: assignee_id fica NULL, conversa
              -- vai pra 'waiting' sem dono (fila geral).
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

          -- Atendente assumiu (ou conversa fechou) entre o SELECT do loop e
          -- o UPDATE: não mexe em mais nada.
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
