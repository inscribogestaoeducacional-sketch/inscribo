-- =============================================================================
-- 20260819030000_enable_overdue_reminders.sql
-- Liga de fato os lembretes de inadimplência (overdue_1..4/suspended por
-- atraso). A function overdue-payment-reminders já está implementada e
-- (supostamente) agendada via pg_cron desde 20260720001000_overdue_payment_
-- reminders_cron.sql, mas só envia e-mail de verdade quando esta flag está
-- 'true' — até aqui rodava em modo dry-run (só log, nenhum send-email).
--
-- Pré-requisito conferido antes desta migration: os 4 templates overdue_1..4
-- em supabase/functions/send-email/index.ts existem e têm pelo menos um
-- disparador real (a própria overdue-payment-reminders). Ver auditoria de
-- e-mail da sessão anterior para o levantamento completo.
--
-- ATENÇÃO: isso não substitui a checagem pendente de "SELECT * FROM cron.job"
-- — se o cron em si nunca foi agendado (mesma ressalva de bot_timeout_cron.sql
-- / timeout-check.ts, não confirmável só pelo repositório), ligar esta flag
-- não tem efeito prático até o cron.schedule ser aplicado manualmente no SQL
-- Editor do Supabase.
-- =============================================================================

UPDATE platform_settings
SET value = 'true'
WHERE key = 'overdue_reminders_enabled';
