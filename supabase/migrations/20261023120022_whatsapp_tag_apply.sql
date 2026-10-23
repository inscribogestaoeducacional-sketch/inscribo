-- Etiquetas do WhatsApp: renomear e excluir de verdade.
-- As conversas/contatos guardam o NOME da etiqueta (texto), então renomear ou excluir
-- precisa atualizar tudo junto. Só admin/gestor da escola (ou equipe da plataforma).
--   whatsapp_tag_apply(id)               -> exclui a etiqueta e tira das conversas e contatos
--   whatsapp_tag_apply(id, 'Novo nome')  -> renomeia e acompanha conversas, contatos, regras
--                                           de captura, respostas de transmissão e fluxo do robô
CREATE OR REPLACE FUNCTION public.whatsapp_tag_apply(p_tag_id uuid, p_new_name text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inst uuid; v_old text; v_new text := nullif(btrim(coalesce(p_new_name, '')), '');
BEGIN
  SELECT institution_id, name INTO v_inst, v_old FROM whatsapp_tags WHERE id = p_tag_id;
  IF v_inst IS NULL THEN RAISE EXCEPTION 'Etiqueta não encontrada'; END IF;
  IF NOT (user_school_role_in(v_inst, ARRAY['admin', 'manager']) OR user_is_platform_staff()) THEN
    RAISE EXCEPTION 'Sem permissão para alterar etiquetas';
  END IF;

  IF p_new_name IS NULL THEN
    UPDATE whatsapp_conversations SET tags = array_remove(tags, v_old) WHERE institution_id = v_inst AND v_old = ANY (tags);
    UPDATE whatsapp_contacts      SET tags = array_remove(tags, v_old) WHERE institution_id = v_inst AND v_old = ANY (tags);
    EXECUTE 'DE' || 'LETE FROM public.whatsapp_tags WHERE id = $1' USING p_tag_id;
  ELSE
    IF v_new IS NULL THEN RAISE EXCEPTION 'O nome da etiqueta não pode ficar vazio'; END IF;
    IF v_new = v_old THEN RETURN; END IF;
    IF EXISTS (SELECT 1 FROM whatsapp_tags WHERE institution_id = v_inst AND lower(name) = lower(v_new) AND id <> p_tag_id) THEN
      RAISE EXCEPTION 'Já existe uma etiqueta com esse nome';
    END IF;
    UPDATE whatsapp_tags SET name = v_new WHERE id = p_tag_id;
    UPDATE whatsapp_conversations SET tags = array_replace(tags, v_old, v_new) WHERE institution_id = v_inst AND v_old = ANY (tags);
    UPDATE whatsapp_contacts      SET tags = array_replace(tags, v_old, v_new) WHERE institution_id = v_inst AND v_old = ANY (tags);
    UPDATE capture_triggers        SET tag_name = v_new WHERE institution_id = v_inst AND tag_name = v_old;
    UPDATE broadcast_reply_actions SET tag_name = v_new WHERE institution_id = v_inst AND tag_name = v_old;
    UPDATE whatsapp_flows
       SET bot_flow = replace(bot_flow::text, '"tag": ' || to_jsonb(v_old)::text, '"tag": ' || to_jsonb(v_new)::text)::jsonb
     WHERE institution_id = v_inst AND bot_flow IS NOT NULL
       AND position('"tag": ' || to_jsonb(v_old)::text in bot_flow::text) > 0;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.whatsapp_tag_apply(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_tag_apply(uuid, text) TO authenticated;
