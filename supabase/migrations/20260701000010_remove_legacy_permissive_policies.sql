-- =============================================================================
-- 20260701000010_remove_legacy_permissive_policies.sql
-- Causa raiz real do vazamento que persistia mesmo após 20260701000008 e
-- 20260701000009 (corte por transferência + normalização de JID).
--
-- DIAGNÓSTICO (testado em produção com uma sessão real do Luan Dantas —
-- token obtido via admin generate_link + verify, chamando o REST/PostgREST
-- exatamente como o browser dele faz, não via `db query` direto que roda
-- com privilégio elevado e não é confiável para testar RLS):
--
-- `whatsapp_messages` e `whatsapp_conversations` tinham, além das policies
-- nomeadas whatsapp_messages_select/insert/update/delete (as que a gente
-- vem ajustando desde 20260701000000), POLICIES LEGADAS ainda ativas,
-- criadas antes desse projeto de permissões, nunca dropadas porque usam
-- nomes diferentes e nenhuma migration daqui procurou por elas:
--
--   whatsapp_messages:
--     - aion_messages_auth            FOR ALL TO authenticated USING (true)
--     - own_institution_whatsapp_messages FOR ALL USING (institution_id = my_institution_id())
--     - wa_msg_safe                   FOR ALL USING (institution_id = get_my_institution_id() OR is_super_admin_user())
--     - super_admin_whatsapp_messages FOR ALL USING (EXISTS super_admins por email)
--
--   whatsapp_conversations:
--     - aion_conversations_auth       FOR ALL TO authenticated USING (true)
--     - wa_conv_safe                  FOR ALL USING (institution_id = get_my_institution_id() OR is_super_admin_user())
--
-- O Postgres combina múltiplas policies PERMISSIVE para o mesmo comando com
-- OR. Isso significa que `aion_messages_auth` (USING true, para qualquer
-- authenticated) sozinha JÁ liberava 100% das linhas de whatsapp_messages
-- para QUALQUER atendente logado, independente de tudo que as policies
-- whatsapp_messages_select/update/delete verificam. Todo o trabalho de
-- corte por remetente, corte por transferência e toggle de histórico
-- completo, desde 20260701000000, nunca teve efeito prático — essa policy
-- "true" sempre vencia.
--
-- `own_institution_whatsapp_messages` e `wa_msg_safe` são redundantes (mesma
-- checagem de instituição, só que com funções diferentes — my_institution_id()
-- e get_my_institution_id() fazem exatamente o mesmo SELECT que
-- current_user_institution_id()) mas por serem FOR ALL sem nenhuma
-- restrição de remetente/atribuição, também bypassam sozinhas o filtro por
-- atendente. super_admin_whatsapp_messages é redundante com o
-- is_super_admin(...) já embutido em user_can_see_all_conversations().
--
-- PARA QUE ESSAS POLICIES EXISTIAM: as únicas linhas de whatsapp_messages/
-- whatsapp_conversations com institution_id IS NULL são as do "Aion Inbox"
-- (is_aion_inbox = true, 18 linhas hoje) — um inbox de plataforma usado por
-- consultores/admin_geral (AionInboxHub.tsx, AionWhatsAppHub.tsx), que não
-- pertence a uma instituição específica. As policies whatsapp_*_select já
-- exigem institution_id = current_user_institution_id(), o que sempre
-- exclui linhas com institution_id NULL — então, sem alguma policy extra,
-- o Aion Inbox nunca apareceria pra ninguém. É razoável supor que
-- aion_messages_auth/aion_conversations_auth foram um atalho apressado pra
-- resolver isso, só que com um blast radius de "qualquer atendente vê
-- tudo" em vez de "só quem opera o Aion Inbox vê as linhas do Aion Inbox".
--
-- FIX: remove as policies legadas e adiciona um branch dedicado e restrito
-- (só admin_geral/consultant/super_admin) para is_aion_inbox = true, dentro
-- das próprias policies whatsapp_messages_*/whatsapp_conversations_* que já
-- existem — sem reintroduzir nenhuma policy "true para todo mundo".
--
-- ACHADO ADICIONAL, FORA DO ESCOPO DESTA MIGRATION: existe uma policy
-- `users_auth_all` (FOR ALL TO authenticated USING (true)) na tabela
-- `users` — ou seja, hoje qualquer atendente autenticado pode fazer UPDATE
-- direto em QUALQUER linha de `users` via REST, inclusive a própria,
-- podendo se autoconceder can_see_all_conversations/can_see_full_history.
-- Isso não foi corrigido aqui porque redesenhar a RLS de `users`
-- corretamente (leitura por instituição, escrita restrita por role, sem
-- quebrar signup/criação de usuário) é um escopo maior e mais arriscado do
-- que o pedido desta migration — fica registrado para tratar em seguida.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. whatsapp_messages: remove policies legadas
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "aion_messages_auth" ON whatsapp_messages;
DROP POLICY IF EXISTS "own_institution_whatsapp_messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "wa_msg_safe" ON whatsapp_messages;
DROP POLICY IF EXISTS "super_admin_whatsapp_messages" ON whatsapp_messages;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. whatsapp_conversations: remove policies legadas
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "aion_conversations_auth" ON whatsapp_conversations;
DROP POLICY IF EXISTS "wa_conv_safe" ON whatsapp_conversations;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Helper: quem pode operar o Aion Inbox (institution_id IS NULL)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_aion_platform_operator()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.user_type IN ('admin_geral', 'consultant')
    )
    OR is_super_admin(get_current_user_email());
$$;

GRANT EXECUTE ON FUNCTION is_aion_platform_operator() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. whatsapp_messages: reescreve select/update/delete com branch do Aion Inbox
--    (insert não precisa — não há nenhum INSERT de whatsapp_messages a
--    partir do browser; tudo é feito por webhook/API server-side com
--    service role, que já ignora RLS.)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "whatsapp_messages_select" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_select" ON whatsapp_messages
  FOR SELECT
  USING (
    (is_aion_inbox = true AND is_aion_platform_operator())
    OR (
      institution_id = current_user_institution_id()
      AND (
        user_can_see_all_conversations()
        OR sender_user_id = auth.uid()
        OR is_bot_message = true
        OR EXISTS (
          SELECT 1 FROM whatsapp_message_visibility wmv
          WHERE wmv.message_id = whatsapp_messages.id
            AND wmv.visible_to_user_id = auth.uid()
        )
        OR (
          from_me = false
          AND NOT EXISTS (
            SELECT 1 FROM whatsapp_conversations wc
            WHERE wc.institution_id = whatsapp_messages.institution_id
              AND whatsapp_base_jid(wc.remote_jid) = whatsapp_base_jid(whatsapp_messages.remote_jid)
              AND wc.assigned_user_id = auth.uid()
          )
        )
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
    )
  );

DROP POLICY IF EXISTS "whatsapp_messages_update" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_update" ON whatsapp_messages
  FOR UPDATE
  USING (
    (is_aion_inbox = true AND is_aion_platform_operator())
    OR institution_id = current_user_institution_id()
  )
  WITH CHECK (
    (is_aion_inbox = true AND is_aion_platform_operator())
    OR institution_id = current_user_institution_id()
  );

DROP POLICY IF EXISTS "whatsapp_messages_delete" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_delete" ON whatsapp_messages
  FOR DELETE
  USING (
    (is_aion_inbox = true AND is_aion_platform_operator())
    OR (
      institution_id = current_user_institution_id()
      AND (
        user_can_see_all_conversations()
        OR EXISTS (
          SELECT 1 FROM whatsapp_conversations wc
          WHERE wc.institution_id = whatsapp_messages.institution_id
            AND wc.assigned_user_id = auth.uid()
            AND whatsapp_base_jid(wc.remote_jid) = whatsapp_base_jid(whatsapp_messages.remote_jid)
            AND (wc.transferred_at IS NULL OR whatsapp_messages.timestamp >= wc.transferred_at)
        )
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. whatsapp_conversations: reescreve select/update com branch do Aion Inbox
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "whatsapp_conversations_select" ON whatsapp_conversations;
CREATE POLICY "whatsapp_conversations_select" ON whatsapp_conversations
  FOR SELECT
  USING (
    (is_aion_inbox = true AND is_aion_platform_operator())
    OR (
      institution_id = current_user_institution_id()
      AND (
        user_can_see_all_conversations()
        OR assigned_user_id = auth.uid()
        OR (assigned_user_id IS NULL AND status = 'waiting')
        OR (assigned_user_id IS NOT NULL AND assigned_user_id <> auth.uid() AND status = 'waiting' AND whatsapp_conversation_is_stale(institution_id, last_message_at))
      )
    )
  );

DROP POLICY IF EXISTS "whatsapp_conversations_update" ON whatsapp_conversations;
CREATE POLICY "whatsapp_conversations_update" ON whatsapp_conversations
  FOR UPDATE
  USING (
    (is_aion_inbox = true AND is_aion_platform_operator())
    OR (
      institution_id = current_user_institution_id()
      AND (
        user_can_see_all_conversations()
        OR assigned_user_id = auth.uid()
        OR (assigned_user_id IS NULL AND status = 'waiting')
        OR (assigned_user_id IS NOT NULL AND assigned_user_id <> auth.uid() AND status = 'waiting' AND whatsapp_conversation_is_stale(institution_id, last_message_at))
      )
    )
  )
  WITH CHECK (
    (is_aion_inbox = true AND is_aion_platform_operator())
    OR institution_id = current_user_institution_id()
  );
