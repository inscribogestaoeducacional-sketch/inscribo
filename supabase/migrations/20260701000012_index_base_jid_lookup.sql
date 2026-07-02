-- =============================================================================
-- 20260701000012_index_base_jid_lookup.sql
-- Performance: whatsapp_messages_select/update/delete e
-- whatsapp_conversations_select/update (desde 20260701000000, mais pesado
-- depois de 20260701000009/000010) fazem
--   EXISTS (SELECT 1 FROM whatsapp_conversations wc
--           WHERE wc.institution_id = ... AND
--                 whatsapp_base_jid(wc.remote_jid) = whatsapp_base_jid(...) AND
--                 wc.assigned_user_id = auth.uid())
-- O único índice existente em whatsapp_conversations é sobre
-- (institution_id, remote_jid) cru — não serve para buscar por
-- whatsapp_base_jid(remote_jid), que é uma expressão. Sem índice
-- compatível, essa subquery correlacionada faz sequential scan de
-- whatsapp_conversations para CADA linha de whatsapp_messages avaliada,
-- o que já causou statement timeout (57014) numa consulta real durante os
-- testes desta investigação. Índice de expressão resolve.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_base_jid
  ON whatsapp_conversations (institution_id, (whatsapp_base_jid(remote_jid)), assigned_user_id);
