-- Fix sync_contact_from_conversation: skip group JIDs (@g.us)
CREATE OR REPLACE FUNCTION sync_contact_from_conversation()
RETURNS TRIGGER AS $$
DECLARE
  v_phone TEXT;
BEGIN
  v_phone := SPLIT_PART(NEW.remote_jid, '@', 1);

  -- Skip WhatsApp groups
  IF NEW.remote_jid LIKE '%@g.us' THEN
    RETURN NEW;
  END IF;

  -- Skip if no valid phone
  IF v_phone IS NULL OR v_phone = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO whatsapp_contacts (institution_id, phone, name, type, last_seen_at, created_at)
  VALUES (
    NEW.institution_id,
    v_phone,
    COALESCE(NEW.contact_name, v_phone),
    'unknown',
    COALESCE(NEW.last_message_at, NOW()),
    NOW()
  )
  ON CONFLICT (institution_id, phone) DO UPDATE
    SET
      name         = COALESCE(EXCLUDED.name, whatsapp_contacts.name),
      last_seen_at = GREATEST(EXCLUDED.last_seen_at, whatsapp_contacts.last_seen_at);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_sync_contact_from_conversation'
  ) THEN
    CREATE TRIGGER trg_sync_contact_from_conversation
      AFTER INSERT OR UPDATE ON whatsapp_conversations
      FOR EACH ROW EXECUTE FUNCTION sync_contact_from_conversation();
  END IF;
END $$;
