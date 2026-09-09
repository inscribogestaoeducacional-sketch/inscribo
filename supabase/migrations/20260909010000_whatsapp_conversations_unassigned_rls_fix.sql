-- =============================================================================
-- 20260909010000_whatsapp_conversations_unassigned_rls_fix.sql
--
-- Auditoria RLS do WhatsApp Hub pra atendentes restritos (sem
-- can_see_all_conversations): o código já assumia que "sem dono" implica
-- status='waiting' (comentário em WhatsAppHub.tsx sobre por que enviar
-- template usa status='open': "'waiting' significa 'sem atendente' em todo o
-- resto do sistema"), mas pelo menos dois fluxos de criação de conversa
-- (handleNewConv / fluxo de "phone param") inseriam a linha nova já com
-- status='open' sem nunca setar assigned_user_id — quebrando esse invariante.
--
-- Consequência: uma conversa nesse estado (sem dono, status != 'waiting', sem
-- last_message_at ainda) não batia em NENHUM branch das policies de SELECT/
-- UPDATE de whatsapp_conversations pra quem não tem can_see_all_conversations
-- — nem pro próprio atendente que acabou de criar a conversa. Ficava
-- invisível e não-reivindicável até alguém com can_see_all_conversations
-- (ou o webhook, via service role) mexer nela.
--
-- O código que criava a linha sem dono foi corrigido (agora seta
-- assigned_user_id = quem criou, atômico no INSERT). Esta migration é o
-- reforço de RLS: uma conversa sem dono (assigned_user_id IS NULL) deveria
-- ser visível/reivindicável por qualquer atendente da instituição
-- independente do status — não só quando status='waiting' — tanto pra
-- cobrir linhas órfãs já existentes no banco quanto qualquer outro caminho
-- futuro que crie uma conversa sem dono num status diferente.
-- =============================================================================

DROP POLICY IF EXISTS "whatsapp_conversations_select" ON public.whatsapp_conversations;
CREATE POLICY "whatsapp_conversations_select" ON public.whatsapp_conversations
  FOR SELECT
  USING (
    (is_aion_inbox = true AND is_aion_platform_operator())
    OR (
      institution_id = current_user_institution_id()
      AND (
        user_can_see_all_conversations()
        OR assigned_user_id = auth.uid()
        OR assigned_user_id IS NULL
        OR (
          assigned_user_id IS NOT NULL
          AND assigned_user_id <> auth.uid()
          AND status = 'waiting'
          AND whatsapp_conversation_is_stale(institution_id, last_message_at)
        )
      )
    )
  );

DROP POLICY IF EXISTS "whatsapp_conversations_update" ON public.whatsapp_conversations;
CREATE POLICY "whatsapp_conversations_update" ON public.whatsapp_conversations
  FOR UPDATE
  USING (
    (is_aion_inbox = true AND is_aion_platform_operator())
    OR (
      institution_id = current_user_institution_id()
      AND (
        user_can_see_all_conversations()
        OR assigned_user_id = auth.uid()
        OR assigned_user_id IS NULL
        OR whatsapp_conversation_is_stale(institution_id, last_message_at)
      )
    )
  )
  WITH CHECK (
    (is_aion_inbox = true AND is_aion_platform_operator())
    OR institution_id = current_user_institution_id()
  );
