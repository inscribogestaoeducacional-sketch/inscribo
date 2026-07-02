-- =============================================================================
-- 20260701000017_fix_waiting_status_backfill.sql
-- Corrige o dado histórico produzido pelo bug de status: 'waiting' setado
-- junto com assigned_user_id preenchido (handleSendTemplate em
-- WhatsAppHub.tsx, e dois pontos em api/whatsapp/webhook.ts: off-hours
-- transfer do fluxo custom e do fluxo padrão, e o branch "cliente
-- respondeu a um template"). Em todo o resto do sistema (fila "Aguardando
-- atendimento", RLS de resgate de conversa parada, isConvStale no
-- frontend), 'waiting' significa "sem atendente" — essas gravações
-- deixavam conversas ATIVAMENTE atribuídas marcadas como se estivessem
-- abandonadas, fazendo-as aparecer na fila de resgate ("Paradas") pra
-- outros atendentes assim que passava o staleHours configurado, mesmo o
-- atendente nunca tendo abandonado nada — o cliente só ainda não tinha
-- respondido ao template.
--
-- Esta migration só corrige o dado; o código que gravava errado já foi
-- corrigido nos três pontos citados acima para usar status: 'open'.
--
-- Invariante daqui pra frente: status = 'waiting' existe SE E SOMENTE SE
-- assigned_user_id IS NULL.
-- =============================================================================

UPDATE whatsapp_conversations
SET status = 'open'
WHERE assigned_user_id IS NOT NULL
  AND status = 'waiting';
