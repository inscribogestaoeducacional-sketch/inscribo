-- Aplicada via MCP (whatsapp_conversations_close_restart_bot).
-- "Somente concluir": na próxima mensagem do cliente o robô inicia na hora.
ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS close_restart_bot boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.whatsapp_conversations.close_restart_bot IS 'true quando o atendente concluiu com "Somente concluir": na próxima mensagem do cliente o robô inicia na hora (sem a reabertura silenciosa de 2h).';
