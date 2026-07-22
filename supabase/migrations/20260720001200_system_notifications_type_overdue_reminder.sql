-- =============================================================================
-- 20260720001200_system_notifications_type_overdue_reminder.sql
-- Adiciona 'overdue_reminder' aos valores aceitos por system_notifications.type,
-- usado pela Edge Function overdue-payment-reminders para alertar o gestor da
-- escola no painel.
--
-- system_notifications é drift (sem CREATE TABLE rastreado em nenhuma
-- migration deste repo — só INSERTs/policies em migrations avulsas). Não dá
-- pra saber pelo repo se existe uma CHECK constraint na coluna `type` nem
-- qual o nome dela. Este bloco é defensivo: procura qualquer CHECK
-- constraint na coluna `type` dessa tabela (não importa o nome) e a
-- substitui por uma que já inclui os 5 valores usados hoje no código
-- (weekly_alert, goal_deviation, milestone, suggestion — já em uso — mais
-- overdue_reminder, novo). Se não existir nenhuma CHECK, o loop não faz
-- nada e a nova é criada do mesmo jeito — idempotente em qualquer cenário.
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
  CHECK (type IN ('weekly_alert', 'goal_deviation', 'milestone', 'suggestion', 'overdue_reminder'));
