-- =============================================================================
-- 20260819020000_whatsapp_conversations_closed_at.sql
-- Timestamp de quando a conversa virou status='closed' — necessário pro item A
-- (reabertura silenciosa dentro de uma janela curta após o encerramento, sem
-- repetir boas-vindas/menu). Sem essa coluna não dá pra saber "há quanto tempo"
-- a conversa foi fechada; updated_at não serve porque é tocado por qualquer
-- UPDATE (tags, unread count etc.), não só pelo fechamento em si.
--
-- Setado em dois lugares:
-- - src/lib/supabase.ts:closeConversation() — fechamento manual pelo atendente
--   (caminho mais comum: "Encerrar atendimento" → dispara pesquisa de satisfação).
-- - api/whatsapp/webhook.ts — fechamento automático pelo bot (nó 'end' do fluxo
--   customizado e action 'close_conversation').
-- =============================================================================

ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
