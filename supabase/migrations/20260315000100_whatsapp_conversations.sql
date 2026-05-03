-- Add missing columns to whatsapp_messages
ALTER TABLE whatsapp_messages
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id);

-- Create whatsapp_conversations table
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID REFERENCES institutions(id),
  remote_jid TEXT,
  contact_name TEXT,
  lead_id UUID REFERENCES leads(id),
  status TEXT DEFAULT 'open',
  last_message_at TIMESTAMPTZ,
  unread_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, remote_jid)
);

-- RLS
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Institution members can manage their conversations" ON whatsapp_conversations;
CREATE POLICY "Institution members can manage their conversations"
  ON whatsapp_conversations FOR ALL
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

-- Index
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_institution_jid
  ON whatsapp_conversations(institution_id, remote_jid);

-- Function to increment unread count
CREATE OR REPLACE FUNCTION increment_conversation_unread(p_institution_id UUID, p_remote_jid TEXT)
RETURNS void AS $$
BEGIN
  UPDATE whatsapp_conversations
  SET unread_count = unread_count + 1
  WHERE institution_id = p_institution_id AND remote_jid = p_remote_jid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
