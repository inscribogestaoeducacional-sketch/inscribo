-- =============================================================================
-- 20260701000020_message_visibility_insert_policy.sql
-- whatsapp_message_visibility tinha RLS habilitada (20260701000000) mas
-- nenhuma policy de INSERT — só a de SELECT. Hoje isso não trava nada
-- porque a única linha de código que insere nessa tabela é o trigger
-- snapshot_visibility_on_transfer(), SECURITY DEFINER, dono `postgres`
-- (rolbypassrls = true), que bypassa RLS independente de policy. Mas é uma
-- lacuna real: se esse trigger algum dia perder SECURITY DEFINER, mudar de
-- dono, ou se outro código passar a inserir aqui diretamente como usuário
-- comum, o INSERT falha silenciosamente sem policy nenhuma pra permitir.
--
-- Fecha a lacuna com o mesmo critério da policy de SELECT existente: só
-- pode inserir um grant de visibilidade dentro da própria instituição, e
-- só admin/liberado ou o próprio usuário sendo referenciado.
-- =============================================================================

DROP POLICY IF EXISTS "whatsapp_message_visibility_insert" ON whatsapp_message_visibility;
CREATE POLICY "whatsapp_message_visibility_insert" ON whatsapp_message_visibility
  FOR INSERT
  WITH CHECK (
    institution_id = current_user_institution_id()
    AND (
      user_can_see_all_conversations()
      OR visible_to_user_id = auth.uid()
    )
  );

GRANT INSERT ON whatsapp_message_visibility TO authenticated;
