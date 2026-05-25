ALTER TABLE whatsapp_messages
ADD COLUMN IF NOT EXISTS quoted_message_id TEXT,
ADD COLUMN IF NOT EXISTS quoted_content    TEXT,
ADD COLUMN IF NOT EXISTS quoted_from_me    BOOLEAN;
