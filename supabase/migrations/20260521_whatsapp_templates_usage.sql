-- ═══════════════════════════════════════════════════════════
-- whatsapp_platform_templates — templates padrão da plataforma
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS whatsapp_platform_templates (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL DEFAULT 'UTILITY',
  language      TEXT NOT NULL DEFAULT 'pt_BR',
  body_text     TEXT NOT NULL,
  variables     TEXT[] DEFAULT '{}',
  is_default    BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

INSERT INTO whatsapp_platform_templates
  (name, display_name, description, body_text, variables)
VALUES
  (
    'reativar_atendimento',
    'Reativar Atendimento',
    'Enviado quando a janela de 24h expira',
    'Olá, {{1}}! Desculpa, vamos continuar nosso atendimento? 😊',
    ARRAY['Nome do contato']
  ),
  (
    'iniciar_contato',
    'Iniciar Contato',
    'Enviado para iniciar nova conversa',
    'Olá, {{1}}! 😊 Aqui é {{2}}, tudo bem?',
    ARRAY['Nome do contato', 'Nome da escola']
  )
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE whatsapp_platform_templates ENABLE ROW LEVEL SECURITY;

-- Super admins: leitura e escrita total
CREATE POLICY "super_admin_all_platform_templates"
  ON whatsapp_platform_templates FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'super_admin'
  ));

-- Todos autenticados: somente leitura (para buscar templates padrão)
CREATE POLICY "authenticated_read_platform_templates"
  ON whatsapp_platform_templates FOR SELECT TO authenticated
  USING (true);

-- Service role: acesso total (para funções do backend)
CREATE POLICY "service_role_all_platform_templates"
  ON whatsapp_platform_templates FOR ALL TO service_role
  USING (true);

-- ═══════════════════════════════════════════════════════════
-- whatsapp_conversation_usage — controle mensal por escola
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS whatsapp_conversation_usage (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  month_year      TEXT NOT NULL,          -- formato: '2026-05'
  initiated_count INTEGER DEFAULT 0,      -- iniciadas pela escola (conta no limite)
  received_count  INTEGER DEFAULT 0,      -- iniciadas pelo cliente (gratuitas)
  limit_count     INTEGER DEFAULT 1000,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(institution_id, month_year)
);

-- RLS
ALTER TABLE whatsapp_conversation_usage ENABLE ROW LEVEL SECURITY;

-- Super admins: acesso total
CREATE POLICY "super_admin_all_conv_usage"
  ON whatsapp_conversation_usage FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'super_admin'
  ));

-- Escola: somente leitura dos próprios dados
CREATE POLICY "school_read_own_conv_usage"
  ON whatsapp_conversation_usage FOR SELECT TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

-- Service role: acesso total (webhook + send-template)
CREATE POLICY "service_role_all_conv_usage"
  ON whatsapp_conversation_usage FOR ALL TO service_role
  USING (true);
