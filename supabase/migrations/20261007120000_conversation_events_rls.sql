-- 20261007120000_conversation_events_rls.sql
--
-- whatsapp_conversation_events é o histórico de atendimento (assumir,
-- transferir, encerrar, reabrir). A policy única "Institution members can
-- view conversation events" era FOR ALL: qualquer membro da escola podia
-- editar ou apagar o histórico pelo cliente, e anon tinha todos os grants.
--
-- Agora: membro da escola ativa só lê e insere (inserção em nome de si
-- mesmo ou sem autor). Atualizar/apagar só via service role (webhook, edge
-- functions, cron), que ignora RLS. Nenhum código do cliente faz UPDATE ou
-- DELETE nesta tabela.
--
-- current_user_institution_id() (= COALESCE(institution_id,
-- active_institution_id)) em vez de users.institution_id: cobre o gestor de
-- rede, que tem institution_id NULL — mesmo critério de
-- whatsapp_conversations.

DROP POLICY IF EXISTS "Institution members can view conversation events" ON public.whatsapp_conversation_events;
DROP POLICY IF EXISTS whatsapp_conversation_events_select ON public.whatsapp_conversation_events;
DROP POLICY IF EXISTS whatsapp_conversation_events_insert ON public.whatsapp_conversation_events;

ALTER TABLE public.whatsapp_conversation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_conversation_events_select ON public.whatsapp_conversation_events
  FOR SELECT TO authenticated
  USING (institution_id = public.current_user_institution_id());

CREATE POLICY whatsapp_conversation_events_insert ON public.whatsapp_conversation_events
  FOR INSERT TO authenticated
  WITH CHECK (
    institution_id = public.current_user_institution_id()
    AND (user_id IS NULL OR user_id = auth.uid())
  );

REVOKE ALL ON public.whatsapp_conversation_events FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.whatsapp_conversation_events FROM authenticated;
GRANT SELECT, INSERT ON public.whatsapp_conversation_events TO authenticated;
