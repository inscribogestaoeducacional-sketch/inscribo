-- =============================================================================
-- 20260819000000_unstick_open_unassigned_conversations.sql
-- Correção pontual de dado: conversas presas em status='open' com
-- assigned_user_id NULL.
--
-- ORIGEM: o gate de horário comercial (nó 'transfer' e o ramo de fluxo padrão
-- em api/whatsapp/webhook.ts) marcava status='open' mesmo quando não
-- conseguia resolver nenhum responsável (timeout_assignee_id/timeout_group_id
-- não configurados, e default_assignee_id nunca existiu como coluna). Essa
-- combinação — 'open' sem dono — não bate em nenhuma das condições da RLS de
-- whatsapp_conversations_select nem dos agrupamentos visuais do Inbox pra
-- atendente sem "ver todas as conversas": não aparece em "Aguardando
-- atendimento" (que exige status='waiting') nem em "Minhas conversas". Ficava
-- visível só pra quem tem user_can_see_all_conversations()=true, e o bot
-- também parava de reagir a novas mensagens do cliente nessas conversas
-- (branch "bot_active=false + no assignee" do webhook, que apenas logava e
-- ignorava).
--
-- O código já foi corrigido (webhook.ts agora nunca grava 'open' sem
-- assigned_user_id — cai em 'waiting' como rede de segurança; e mensagens
-- novas do cliente numa conversa 'open' órfã reabrem pra 'waiting' em vez de
-- serem ignoradas). Esta migration é só a correção do dado já existente.
--
-- Aplicada manualmente em produção em 2026-08-19 (via REST/service role,
-- 7 conversas: Ágape Patos ×3, Colégio Áion ×1, Santa Teresa ×2, + 1 já
-- capturada antes na contagem — o número variou entre a auditoria e a
-- aplicação porque é dado vivo, atendentes seguiam mexendo nas conversas).
-- Mantida aqui, idempotente, para newDB setups e para o histórico —
-- reexecutar não tem efeito colateral: só toca linhas que ainda estiverem
-- exatamente nesse estado quebrado.
-- =============================================================================

UPDATE whatsapp_conversations
SET status = 'waiting'
WHERE status = 'open'
  AND assigned_user_id IS NULL;
