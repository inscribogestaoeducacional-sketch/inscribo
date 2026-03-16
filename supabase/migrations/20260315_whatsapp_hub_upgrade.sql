-- Add attendant and contact_type to conversations
ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS assigned_user_name TEXT,
  ADD COLUMN IF NOT EXISTS transferred_from TEXT,
  ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'unknown';

-- Conversation events/history table
CREATE TABLE IF NOT EXISTS whatsapp_conversation_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID REFERENCES institutions(id),
  remote_jid TEXT NOT NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  user_id UUID,
  user_name TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE whatsapp_conversation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Institution members can view conversation events" ON whatsapp_conversation_events;
CREATE POLICY "Institution members can view conversation events"
  ON whatsapp_conversation_events FOR ALL
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_waconv_events_jid
  ON whatsapp_conversation_events(institution_id, remote_jid, created_at DESC);
