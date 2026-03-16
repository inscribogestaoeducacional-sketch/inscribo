ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
  ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'unknown';
