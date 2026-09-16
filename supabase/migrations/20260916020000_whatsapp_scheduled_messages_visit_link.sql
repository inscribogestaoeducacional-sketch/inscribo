-- =============================================================================
-- 20260916020000_whatsapp_scheduled_messages_visit_link.sql
-- Vincula um lembrete agendado (whatsapp_scheduled_messages) à visita que o
-- originou, pra permitir cancelamento em cascata: se o atendente reagendar
-- (mudar scheduled_date) ou cancelar a visita, DatabaseService.updateVisit
-- (src/lib/supabase.ts) cancela junto qualquer lembrete 'pending' dessa
-- visita específica — sem essa referência, não dava pra saber qual linha de
-- whatsapp_scheduled_messages pertence a qual visita, e um lembrete "sua
-- visita é hoje às 14h" podia sobreviver a uma visita já remarcada/cancelada.
--
-- Nullable e sem NOT NULL: só populado pelo fluxo de "Agendar Visita" do
-- painel de Lead do WhatsApp Hub (WhatsAppHub.tsx, template lembrete_visita).
-- Mensagens agendadas manuais ("+ Agendar mensagem" no mesmo painel)
-- continuam sem visit_id, e não são afetadas por essa cascata.
-- =============================================================================

ALTER TABLE whatsapp_scheduled_messages
  ADD COLUMN IF NOT EXISTS visit_id UUID REFERENCES visits(id) ON DELETE SET NULL;

-- Índice parcial (só linhas com visit_id) — usado pelo cancelamento em
-- cascata, que sempre filtra por visit_id + status='pending'.
CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_messages_visit
  ON whatsapp_scheduled_messages(visit_id) WHERE visit_id IS NOT NULL;
