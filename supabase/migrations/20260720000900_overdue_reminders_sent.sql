-- =============================================================================
-- 20260720000900_overdue_reminders_sent.sql
-- Controle de idempotência da Edge Function overdue-payment-reminders: evita
-- reenviar o mesmo aviso de WhatsApp mais de uma vez para a mesma cobrança
-- em atraso, no mesmo marco de dias. Mesmo padrão de RLS "só service role"
-- já usado em bot_timeout_queue (20260528000000_bot_timeout.sql).
--
-- `milestone` NÃO é mais travado em (3,7,15,20): os marcos vêm de
-- platform_settings.overdue_warning1/2/3_days e overdue_suspend_days — os
-- mesmos campos editáveis na tela de Configurações (AdminSettings.tsx) —
-- então precisam poder ser qualquer inteiro positivo que o admin configurar.
-- =============================================================================

CREATE TABLE IF NOT EXISTS overdue_reminders_sent (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID        NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  milestone  INTEGER     NOT NULL CHECK (milestone > 0),
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payment_id, milestone)
);

ALTER TABLE overdue_reminders_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only" ON overdue_reminders_sent;
CREATE POLICY "service_role_only" ON overdue_reminders_sent
  FOR ALL USING (false);

-- Flag de segurança lida por overdue-payment-reminders/index.ts: enquanto
-- 'false' (ou ausente), a function roda em modo dry-run (só loga, não envia
-- WhatsApp de verdade nem grava overdue_reminders_sent). platform_settings
-- é drift (sem CREATE TABLE rastreado neste repo), por isso o INSERT abaixo
-- não usa ON CONFLICT — só insere se a chave ainda não existir.
INSERT INTO platform_settings (key, value)
SELECT 'overdue_reminders_enabled', 'false'
WHERE NOT EXISTS (SELECT 1 FROM platform_settings WHERE key = 'overdue_reminders_enabled');
