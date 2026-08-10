-- =============================================================================
-- 20260809000000_aion_broadcasts_paused_status.sql
-- Adiciona 'paused' ao CHECK de aion_broadcasts.status — botão "Pausar" na
-- Transmissão do Inbox Áion. aion-broadcast-send já ignora esse status por
-- construção: a query de campanhas ativas usa
-- .in('status', ['scheduled', 'sending']), que nunca inclui 'paused' (mesmo
-- raciocínio já usado pra 'cancelled' — nenhuma mudança de código necessária
-- na Edge Function além de não incluir 'paused' nesse .in()).
-- =============================================================================

ALTER TABLE aion_broadcasts DROP CONSTRAINT IF EXISTS aion_broadcasts_status_check;
ALTER TABLE aion_broadcasts ADD CONSTRAINT aion_broadcasts_status_check
  CHECK (status IN ('draft', 'scheduled', 'sending', 'paused', 'completed', 'cancelled'));
