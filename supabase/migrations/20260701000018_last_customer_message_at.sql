-- =============================================================================
-- 20260701000018_last_customer_message_at.sql
-- Corrige o cálculo da janela de 24h do WhatsApp, que hoje é feito no
-- frontend escaneando activeConv.messages (a lista de mensagens JÁ
-- FILTRADA pela RLS de whatsapp_messages para o atendente logado). Um
-- atendente que recebeu uma conversa transferida e não tem
-- can_see_full_history não vê as mensagens do cliente anteriores ao
-- próprio transferred_at (comportamento correto, ver 20260701000008/009) —
-- mas isso fazia o cálculo de janela aberta/expirada dar resultado
-- diferente pra ele do que pro admin, mesmo sendo a mesma conversa.
--
-- FIX: guarda o timestamp da última mensagem do CLIENTE (from_me = false)
-- na própria linha de whatsapp_conversations. Essa coluna é lida via
-- whatsapp_conversations_select (que já libera a linha inteira pro
-- atendente atualmente atribuído, sem o corte por mensagem), então o
-- frontend deixa de depender da lista de mensagens filtrada por remetente
-- para saber se a janela está aberta.
--
-- Multi-tenant: o backfill casa por (institution_id, base_jid) — usa
-- base_jid (coluna gerada em 20260701000013, já normaliza o "9" extra do
-- celular BR) em vez de remote_jid cru, e IS NOT DISTINCT FROM em
-- institution_id pra também cobrir as conversas do Aion Inbox
-- (institution_id IS NULL). Funciona igual pra todas as instituições, não
-- só pra uma escola específica.
-- =============================================================================

ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS last_customer_message_at TIMESTAMPTZ;

UPDATE whatsapp_conversations wc
SET last_customer_message_at = sub.max_ts
FROM (
  SELECT institution_id, base_jid, MAX(timestamp) AS max_ts
  FROM whatsapp_messages
  WHERE from_me = false
  GROUP BY institution_id, base_jid
) sub
WHERE wc.base_jid = sub.base_jid
  AND wc.institution_id IS NOT DISTINCT FROM sub.institution_id;
