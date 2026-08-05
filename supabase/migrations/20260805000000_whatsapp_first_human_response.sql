-- =============================================================================
-- 20260805000000_whatsapp_first_human_response.sql
--
-- Fase 2 do GestorHome — item 1 (Tempo de resposta real).
--
-- first_response_at é gravado só por sendAutoMessage() em
-- api/whatsapp/webhook.ts, ou seja, é o timestamp do PRIMEIRO AUTO-REPLY DO
-- BOT, não da equipe humana (api/whatsapp/send.ts, usado pelo envio manual
-- via WhatsAppHub.tsx/AionInboxHub.tsx, nunca gravava nesse campo). O KPI
-- "Tempo de resposta" e a coluna "T. Resp." do Ranking em GestorHome.tsx
-- mediam a latência do bot, não da equipe — achado da auditoria anterior.
--
-- first_human_response_at é uma coluna nova e separada (não reaproveita/
-- redefine first_response_at, que continua existindo e continua sendo só do
-- bot) — gravada em api/whatsapp/send.ts na primeira mensagem humana de cada
-- conversa (mesmo padrão condicional já usado pro bot: só grava se ainda
-- estiver NULL).
-- =============================================================================

ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS first_human_response_at TIMESTAMPTZ;

COMMENT ON COLUMN whatsapp_conversations.first_response_at IS
  'Timestamp da primeira mensagem automática do bot (sendAutoMessage em api/whatsapp/webhook.ts) — não confundir com first_human_response_at.';
COMMENT ON COLUMN whatsapp_conversations.first_human_response_at IS
  'Timestamp da primeira mensagem enviada por um humano (api/whatsapp/send.ts) nesta conversa — usado pelo KPI "Tempo de resposta" e pelo Ranking da Equipe em GestorHome.tsx.';
