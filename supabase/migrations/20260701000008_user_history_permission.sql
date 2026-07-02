-- =============================================================================
-- 20260701000008_user_history_permission.sql
-- Corrige o corte de histórico pós-transferência e adiciona o toggle
-- can_see_full_history por usuário.
--
-- ITEM 1 — INVESTIGAÇÃO DO CORTE POR transferred_at:
-- Confirmado que está QUEBRADO. A policy original de whatsapp_messages
-- (20260701000000_whatsapp_permissions.sql) checava, por conversa:
--   assigned_user_id = auth.uid() AND (transferred_at IS NULL OR
--   timestamp >= transferred_at)
-- Isso garantia que um atendente só via o histórico anterior à transferência
-- se ele fosse dono desde o início (transferred_at NULL).
--
-- 20260701000003_whatsapp_message_filter.sql reescreveu essa policy do zero
-- para resolver o vazamento de mensagens entre atendentes (Part 1 da tarefa
-- anterior), e no processo REMOVEU esse clause inteiro — a nova policy não
-- olha para whatsapp_conversations nem para transferred_at em lugar nenhum;
-- em vez disso, ela liberou incondicionalmente `from_me = false` (mensagem
-- do cliente) para qualquer atendente da instituição. Ou seja: hoje, um
-- atendente que recebe uma conversa transferida vê TODO o histórico de
-- mensagens do cliente daquela conversa, não só a partir da transferência.
-- O corte nunca chegou a funcionar depois daquela migration.
--
-- ITEM 2 — TOGGLE can_see_full_history:
-- Esta migration reintroduz o corte já como a versão final (com o toggle),
-- em vez de reintroduzir o corte "antigo" numa migration e substituí-lo
-- de novo logo em seguida — as duas mudanças caem exatamente na mesma
-- policy e seriam aplicadas no mesmo deploy de qualquer forma.
--
-- DECISÃO DE PRODUTO (confirmada com o usuário): o corte, quando
-- can_see_full_history = false, esconde TODAS as mensagens anteriores à
-- transferência para o atendente que RECEBEU a conversa — inclusive as
-- mensagens do cliente. Isso é diferente da regra geral da Part 1 ("mensagem
-- do cliente é sempre visível para qualquer atendente da instituição"), que
-- continua valendo para quem está apenas abrindo uma conversa atribuída a
-- OUTRA pessoa (cenário Luan/Clebia do checklist original) — ali o atendente
-- não é o assigned_user_id atual, então o corte nem se aplica. O corte só
-- entra em ação para o próprio dono atual da conversa, e só quando ela foi
-- de fato transferida (transferred_at preenchido).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Coluna can_see_full_history em users
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS can_see_full_history BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS: reescreve whatsapp_messages_select com o corte por transferência
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "whatsapp_messages_select" ON whatsapp_messages;

CREATE POLICY "whatsapp_messages_select" ON whatsapp_messages
  FOR SELECT
  USING (
    institution_id = current_user_institution_id()
    AND (
      -- Admin / liberado: vê tudo, sem exceção.
      user_can_see_all_conversations()

      -- Mensagem enviada pelo próprio atendente logado: sempre visível.
      OR sender_user_id = auth.uid()

      -- Mensagem do robô: sempre visível a qualquer atendente, não é
      -- afetada pelo corte de transferência.
      OR is_bot_message = true

      -- Grant explícito de transferência: o atendente ANTERIOR mantém
      -- acesso ao que já tinha visto até o momento em que saiu da conversa.
      OR EXISTS (
        SELECT 1 FROM whatsapp_message_visibility wmv
        WHERE wmv.message_id = whatsapp_messages.id
          AND wmv.visible_to_user_id = auth.uid()
      )

      -- Mensagem do cliente, em conversa que NÃO está atribuída a mim agora:
      -- continua sempre visível a qualquer atendente da instituição (regra
      -- da Part 1 — abrir a conversa de outro atendente ainda mostra o que
      -- o cliente escreveu). O corte de transferência só se aplica a quem
      -- é o dono atual da conversa; aqui eu não sou, então não se aplica.
      OR (
        from_me = false
        AND NOT EXISTS (
          SELECT 1 FROM whatsapp_conversations wc
          WHERE wc.institution_id = whatsapp_messages.institution_id
            AND whatsapp_base_jid(wc.remote_jid) = whatsapp_base_jid(whatsapp_messages.remote_jid)
            AND wc.assigned_user_id = auth.uid()
        )
      )

      -- Sou o atendente atualmente designado para esta conversa: vejo tudo
      -- (inclusive mensagens do cliente) dentro da janela permitida —
      -- sem corte se a conversa nunca foi transferida, se a mensagem é
      -- posterior à transferência, ou se tenho can_see_full_history = true.
      -- Mensagens anteriores ao corte, sem essas condições, ficam de fora
      -- (é isso que faz o corte por transferência funcionar de verdade).
      OR EXISTS (
        SELECT 1 FROM whatsapp_conversations wc
        WHERE wc.institution_id = whatsapp_messages.institution_id
          AND wc.assigned_user_id = auth.uid()
          AND whatsapp_base_jid(wc.remote_jid) = whatsapp_base_jid(whatsapp_messages.remote_jid)
          AND (
            wc.transferred_at IS NULL
            OR whatsapp_messages.timestamp >= wc.transferred_at
            OR EXISTS (
              SELECT 1 FROM users u
              WHERE u.id = auth.uid()
                AND u.can_see_full_history = true
            )
          )
      )
    )
  );
