-- Migration: WhatsApp Cloud API (Meta) + Bot config + Uso mensal
-- Execute no Supabase Dashboard → SQL Editor

-- ─── Configuração WhatsApp por instituição ──────────────────────
ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS whatsapp_phone_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_token TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_business_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_connected BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_display_name TEXT;

-- ─── Controle de uso mensal de conversas ────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,
  conversation_count INTEGER DEFAULT 0,
  monthly_limit INTEGER DEFAULT 1000,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, month_year)
);

-- ─── Configuração do bot por instituição ────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_bot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  bot_enabled BOOLEAN DEFAULT TRUE,
  school_name TEXT NOT NULL,
  welcome_message TEXT DEFAULT 'Olá! Seja bem-vindo! 😊 Como posso te ajudar?',
  bot_tone TEXT DEFAULT 'friendly'
    CHECK (bot_tone IN ('friendly','formal','casual')),
  grades_offered TEXT[] DEFAULT '{}',
  monthly_fee_info TEXT,
  faq_data JSONB DEFAULT '{}',
  handoff_keywords TEXT[] DEFAULT ARRAY['atendente','humano','falar com pessoa'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id)
);

-- ─── RLS ───────────────────────────────────────────────────────
ALTER TABLE whatsapp_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_bot_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'whatsapp_usage' AND policyname = 'institution_isolation'
  ) THEN
    CREATE POLICY "institution_isolation" ON whatsapp_usage
      USING (institution_id = (SELECT institution_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'whatsapp_bot_config' AND policyname = 'institution_isolation'
  ) THEN
    CREATE POLICY "institution_isolation" ON whatsapp_bot_config
      USING (institution_id = (SELECT institution_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- ─── Novos campos em whatsapp_messages ──────────────────────────
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('inbound','outbound')),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS conversation_id UUID;

-- ─── Novos campos em whatsapp_conversations ─────────────────────
ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS bot_active BOOLEAN DEFAULT TRUE;

-- ─── Função para incrementar contador de conversas ──────────────
CREATE OR REPLACE FUNCTION increment_conversation_count(
  p_institution_id UUID,
  p_month_year TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE whatsapp_usage
  SET conversation_count = conversation_count + 1,
      last_updated = NOW()
  WHERE institution_id = p_institution_id
    AND month_year = p_month_year;
END;
$$ LANGUAGE plpgsql;
