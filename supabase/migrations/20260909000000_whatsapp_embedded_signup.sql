-- =============================================================================
-- 20260909000000_whatsapp_embedded_signup.sql
-- Prepara whatsapp_phone_numbers para aceitar uma segunda forma de conexão
-- (Cadastro Incorporado / Embedded Signup da Meta), além da conexão manual
-- já existente (handleSaveWa em AdminSchools.tsx / InstitutionDetails.tsx).
--
-- Hoje o token de envio é sempre global (platform_settings.wa_access_token,
-- lido por getWAConfig() em api/whatsapp/webhook.ts e send.ts). Uma conexão
-- feita via Embedded Signup traz seu próprio token (escopo só sobre o WABA
-- daquela escola) — access_token guarda esse token por conexão; quando NULL
-- (100% das linhas existentes hoje), o sistema continua caindo no token
-- global, sem nenhuma mudança de comportamento. Esta migration é só o
-- schema — nenhum código de leitura/envio é alterado aqui.
-- =============================================================================

ALTER TABLE whatsapp_phone_numbers
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS connection_method TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

ALTER TABLE whatsapp_phone_numbers
  DROP CONSTRAINT IF EXISTS whatsapp_phone_numbers_connection_method_check;
ALTER TABLE whatsapp_phone_numbers
  ADD CONSTRAINT whatsapp_phone_numbers_connection_method_check
  CHECK (connection_method IN ('manual', 'embedded_signup'));

COMMENT ON COLUMN whatsapp_phone_numbers.access_token IS
  'Token de acesso específico desta conexão (Embedded Signup). NULL nas conexões manuais — nesse caso o envio usa o token global de platform_settings.wa_access_token via getWAConfig().';
COMMENT ON COLUMN whatsapp_phone_numbers.connection_method IS
  'Como este número foi conectado: manual (formulário do superadmin) ou embedded_signup (Cadastro Incorporado da Meta feito pela própria escola). Default manual preserva as conexões existentes.';
COMMENT ON COLUMN whatsapp_phone_numbers.token_expires_at IS
  'Expiração do access_token acima, quando aplicável (long-lived token da Meta, tipicamente ~60 dias). NULL quando access_token também é NULL.';
