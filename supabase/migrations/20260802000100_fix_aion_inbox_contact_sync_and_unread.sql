-- =============================================================================
-- 20260802000100_fix_aion_inbox_contact_sync_and_unread.sql
--
-- Causa raiz confirmada: trg_sync_contact_from_conversation (função
-- sync_contact_from_conversation) sempre tentava INSERT em whatsapp_contacts
-- usando NEW.institution_id. Para conversas do Inbox Áion (is_aion_inbox=true),
-- institution_id é sempre NULL — e whatsapp_contacts.institution_id é NOT NULL —
-- então o INSERT do trigger falhava, o que derrubava (rollback) todo
-- INSERT/UPDATE em whatsapp_conversations feito por processAionMessage
-- (api/whatsapp/webhook.ts), sem nenhum log visível porque esse código nunca
-- checava { error } das chamadas Supabase.
--
-- "Contato de escola" (whatsapp_contacts, por institution_id) e "lead do CRM
-- comercial" (crm_leads, via aion_lead_id — ver 20260802000000) são conceitos
-- diferentes: o Inbox Áion não deve criar linha em whatsapp_contacts.
--
-- 2º fix (bug secundário já identificado): increment_conversation_unread usava
-- `institution_id = p_institution_id`, que nunca é verdadeiro quando ambos os
-- lados são NULL (NULL = NULL é NULL, não TRUE) — o contador de não lidos do
-- Inbox Áion nunca incrementava.
-- =============================================================================

-- ── 1. sync_contact_from_conversation: pular sync para conversas do Inbox Áion ──
CREATE OR REPLACE FUNCTION sync_contact_from_conversation()
RETURNS TRIGGER AS $$
DECLARE
  v_phone TEXT;
BEGIN
  -- Conversas do Inbox Áion não pertencem a nenhuma instituição — não criar
  -- "contato de escola" para elas (lead do CRM já é tratado via aion_lead_id).
  IF NEW.institution_id IS NULL OR COALESCE(NEW.is_aion_inbox, false) = true THEN
    RETURN NEW;
  END IF;

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

-- Trigger já existe (criado em 20260526000000) e continua apontando para esta
-- function via CREATE OR REPLACE — nada a recriar aqui.

-- ── 2. increment_conversation_unread: tratar institution_id NULL (Inbox Áion) ──
CREATE OR REPLACE FUNCTION increment_conversation_unread(p_institution_id UUID, p_remote_jid TEXT)
RETURNS void AS $$
BEGIN
  UPDATE whatsapp_conversations
  SET unread_count = unread_count + 1
  WHERE institution_id IS NOT DISTINCT FROM p_institution_id
    AND remote_jid = p_remote_jid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;