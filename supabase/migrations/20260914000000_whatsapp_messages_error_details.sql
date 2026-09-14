-- =============================================================================
-- 20260914000000_whatsapp_messages_error_details.sql
-- api/whatsapp/webhook.ts (bloco de statuses de entrega) grava status.status
-- em whatsapp_messages.status, mas descartava status.errors — exatamente o
-- campo onde a Meta manda o código/motivo real de uma falha de entrega
-- (status.status = 'failed'). Sem isso, investigar um "⚠️ não enviado" não
-- tinha como saber POR QUE, só que falhou (achado durante investigação de
-- templates falhando pro Colégio Universo Uno e CEMA — ver histórico).
-- =============================================================================

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS error_details JSONB;

COMMENT ON COLUMN public.whatsapp_messages.error_details IS
  'status.errors bruto do webhook de status de entrega da Meta (array de {code, title, message, error_data, ...}), gravado quando status.status chega como failed (ou qualquer status que venha acompanhado de errors). NULL na grande maioria das linhas — só preenchido nas que tiveram problema de entrega.';
