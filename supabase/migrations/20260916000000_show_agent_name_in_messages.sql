-- =============================================================================
-- 20260916000000_show_agent_name_in_messages.sql
-- Configuração por escola: quando ativada, o texto enviado manualmente pelo
-- atendente (WhatsAppHub.tsx → handleSend) é prefixado com "*Nome*:\n" antes
-- de ir pra Cloud API, identificando quem está respondendo pro cliente (nome
-- numa linha, mensagem começando na linha seguinte).
-- Default false — muda o conteúdo da mensagem que o cliente recebe, então a
-- escola precisa optar por ativar em vez de ser pega de surpresa.
-- =============================================================================

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS show_agent_name_in_messages BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.institutions.show_agent_name_in_messages IS
  'Quando true, mensagens de texto digitadas manualmente pelo atendente saem prefixadas com "*Nome do atendente*:" numa linha e o texto na linha seguinte, antes de ir pra Meta Cloud API. Não afeta templates nem mensagens automáticas do bot. Controlado pelo gestor em Configurações > WhatsApp > Conexão.';
