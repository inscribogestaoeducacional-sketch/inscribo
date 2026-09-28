-- =============================================================================
-- Fecha platform_settings e platform_whatsapp.
--
-- Antes: "authenticated can read platform_settings" (USING true) deixava
-- QUALQUER usuário logado ler service_role_key, wa_access_token,
-- wa_app_secret, google_oauth_refresh_token, asaas_webhook_token…; a policy
-- admin_settings dava leitura e ESCRITA a user_type 'consultant'; e
-- platform_whatsapp tinha ALL/true pra authenticated (leitura e escrita do
-- WhatsApp da Áion, com access_token).
--
-- Depois:
--   - platform_settings: só is_super_admin_user() lê/grava, e só as chaves
--     que NÃO são segredo. Segredo só pelo servidor (service role — Edge
--     Function platform-admin mostra mascarado e grava). Anônimo e escola:
--     nada.
--   - platform_whatsapp: só Super Admin; a coluna access_token não é
--     legível nem gravável pelo navegador (privilégio por coluna).
--   - Revoga os privilégios soltos (TRUNCATE/REFERENCES/TRIGGER) de anon e
--     authenticated nas duas tabelas.
-- Servidor (Edge Functions, api/ da Vercel, crons) usa service role/postgres
-- e não passa por nada disso.
-- =============================================================================

-- Mesma regra da Edge Function platform-admin (SECRET_KEY_RE).
CREATE OR REPLACE FUNCTION public.platform_setting_is_secret(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_key ~* '(token|secret|password|api_key|_key$)'
$$;

-- ── platform_settings ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated can read platform_settings" ON platform_settings;
DROP POLICY IF EXISTS admin_settings ON platform_settings;
DROP POLICY IF EXISTS platform_settings_super_admin ON platform_settings;

CREATE POLICY platform_settings_super_admin ON platform_settings
  FOR ALL TO authenticated
  USING      (public.is_super_admin_user() AND NOT public.platform_setting_is_secret(key))
  WITH CHECK (public.is_super_admin_user() AND NOT public.platform_setting_is_secret(key));

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON platform_settings FROM anon;
REVOKE ALL ON platform_settings FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_settings TO authenticated;

-- ── platform_whatsapp ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS platform_whatsapp_auth ON platform_whatsapp;
DROP POLICY IF EXISTS platform_whatsapp_super_admin ON platform_whatsapp;

CREATE POLICY platform_whatsapp_super_admin ON platform_whatsapp
  FOR ALL TO authenticated
  USING      (public.is_super_admin_user())
  WITH CHECK (public.is_super_admin_user());

ALTER TABLE platform_whatsapp ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON platform_whatsapp FROM anon;
REVOKE ALL ON platform_whatsapp FROM authenticated;
-- Todas as colunas menos access_token (token só pelo servidor).
GRANT SELECT (id, phone_number_id, phone_number, display_name, connected, webhook_verified, created_at, updated_at, waba_id)
  ON platform_whatsapp TO authenticated;
GRANT UPDATE (phone_number_id, phone_number, display_name, connected, webhook_verified, updated_at, waba_id)
  ON platform_whatsapp TO authenticated;
