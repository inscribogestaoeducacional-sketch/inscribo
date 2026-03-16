ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS conversation_history JSONB DEFAULT '[]';
