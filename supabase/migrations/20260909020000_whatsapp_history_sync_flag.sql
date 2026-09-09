-- =============================================================================
-- 20260909020000_whatsapp_history_sync_flag.sql
-- Marca mensagens inseridas via sincronização de histórico de coexistência
-- (webhook field "history", entregue quando uma escola conecta um número
-- que já usava o app WhatsApp Business e aceita compartilhar o histórico).
--
-- Serve pra UI/analytics distinguirem depois; o próprio código do webhook
-- (handleHistorySync em api/whatsapp/webhook.ts) já garante estruturalmente
-- que essas mensagens nunca disparam bot/fila/unread — nunca chama as
-- funções responsáveis por isso, independente desta coluna.
-- =============================================================================

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS is_history_sync BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN whatsapp_messages.is_history_sync IS
  'true quando a mensagem veio do backfill de histórico da coexistência (webhook field "history"), não de tráfego ao vivo. Default false preserva todas as linhas existentes.';
