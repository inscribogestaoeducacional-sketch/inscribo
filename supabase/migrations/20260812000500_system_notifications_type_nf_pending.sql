-- =============================================================================
-- 20260812000500_system_notifications_type_nf_pending.sql
-- Adiciona 'nf_pending' aos valores aceitos por system_notifications.type,
-- usado pra alertar o sino do admin_geral (institution_id IS NULL, ver
-- SuperAdminLayout.tsx:loadNotifications) sempre que uma linha nova em
-- payment_invoices nascer com status='pending' — tanto no webhook da Asaas
-- (caminho after_payment) quanto na Edge Function nf-pending-check (caminho
-- before_payment).
--
-- Mesmo padrão defensivo já usado em 20260720001200 (que adicionou
-- 'overdue_reminder'): procura qualquer CHECK constraint na coluna `type` e
-- substitui por uma que inclui os 5 valores já conhecidos mais o novo —
-- idempotente mesmo que o nome da constraint tenha mudado nesse meio-tempo.
-- =============================================================================

DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE t.relname = 'system_notifications'
      AND c.contype = 'c'
      AND a.attname = 'type'
  LOOP
    EXECUTE format('ALTER TABLE system_notifications DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE system_notifications
  ADD CONSTRAINT system_notifications_type_check
  CHECK (type IN ('weekly_alert', 'goal_deviation', 'milestone', 'suggestion', 'overdue_reminder', 'nf_pending'));
