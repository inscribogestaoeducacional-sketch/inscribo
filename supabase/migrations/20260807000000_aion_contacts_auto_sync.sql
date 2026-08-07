-- =============================================================================
-- 20260807000000_aion_contacts_auto_sync.sql
-- Backfill + sync contínuo de aion_contacts a partir de whatsapp_conversations
-- (is_aion_inbox=true) e crm_leads — mesmo padrão de
-- sync_contact_from_conversation (20260526000000), com merge não-destrutivo
-- (ON CONFLICT DO UPDATE só preenche campos NULL, nunca sobrescreve edição manual).
-- =============================================================================

ALTER TABLE aion_contacts DROP CONSTRAINT IF EXISTS aion_contacts_source_check;
ALTER TABLE aion_contacts ADD CONSTRAINT aion_contacts_source_check
  CHECK (source IN ('manual', 'csv_import', 'conversation', 'crm_lead'));

-- ─────────────────────────────────────────────────────────────────────────────
-- Normalização de telefone em SQL — mesma lógica de
-- AdminAionInbox.tsx:normalizeContactPhone / supabase/functions/_shared/phone.ts
-- (assume BR: prefixa 55 se ausente, insere o 9º dígito em formato antigo de
-- 12 dígitos). Mesma limitação já documentada nessas duas implementações:
-- números não-BR sem código de país ficam incorretos — não é um caso tratado
-- hoje em nenhuma das três versões desta lógica.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION normalize_aion_contact_phone(raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits TEXT;
BEGIN
  digits := regexp_replace(COALESCE(raw, ''), '\D', '', 'g');
  IF digits = '' THEN RETURN NULL; END IF;
  IF LEFT(digits, 2) != '55' THEN
    digits := '55' || digits;
  END IF;
  IF LENGTH(digits) = 12 THEN
    digits := LEFT(digits, 4) || '9' || RIGHT(digits, LENGTH(digits) - 4);
  END IF;
  RETURN digits;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- BACKFILL — DISTINCT ON evita "ON CONFLICT DO UPDATE command cannot affect
-- row a second time" quando a mesma fonte tem telefone duplicado; ORDER BY
-- created_at DESC fica com o registro mais recente em caso de duplicata.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO aion_contacts (phone, name, source, conversation_id, aion_lead_id, created_at)
SELECT DISTINCT ON (v_phone)
  v_phone, contact_name, 'conversation', id, aion_lead_id, created_at
FROM (
  SELECT
    normalize_aion_contact_phone(SPLIT_PART(remote_jid, '@', 1)) AS v_phone,
    contact_name, id, aion_lead_id, created_at
  FROM whatsapp_conversations
  WHERE is_aion_inbox = true
) sub
WHERE v_phone IS NOT NULL AND LENGTH(v_phone) >= 12
ORDER BY v_phone, created_at DESC
ON CONFLICT (phone) DO UPDATE SET
  conversation_id = COALESCE(aion_contacts.conversation_id, EXCLUDED.conversation_id),
  aion_lead_id    = COALESCE(aion_contacts.aion_lead_id, EXCLUDED.aion_lead_id),
  name            = COALESCE(aion_contacts.name, EXCLUDED.name);

INSERT INTO aion_contacts (phone, name, source, aion_lead_id, created_at)
SELECT DISTINCT ON (v_phone)
  v_phone, name, 'crm_lead', id, created_at
FROM (
  SELECT normalize_aion_contact_phone(phone) AS v_phone, name, id, created_at
  FROM crm_leads
  WHERE phone IS NOT NULL AND phone <> ''
) sub
WHERE v_phone IS NOT NULL AND LENGTH(v_phone) >= 12
ORDER BY v_phone, created_at DESC
ON CONFLICT (phone) DO UPDATE SET
  aion_lead_id = COALESCE(aion_contacts.aion_lead_id, EXCLUDED.aion_lead_id),
  name         = COALESCE(aion_contacts.name, EXCLUDED.name);

-- ─────────────────────────────────────────────────────────────────────────────
-- SYNC CONTÍNUO #1 — whatsapp_conversations (só lado Áion, via WHEN clause)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_aion_contact_from_conversation()
RETURNS TRIGGER AS $$
DECLARE
  v_phone TEXT;
BEGIN
  v_phone := normalize_aion_contact_phone(SPLIT_PART(NEW.remote_jid, '@', 1));
  IF v_phone IS NULL OR LENGTH(v_phone) < 12 THEN RETURN NEW; END IF;

  INSERT INTO aion_contacts (phone, name, source, conversation_id, aion_lead_id, created_at)
  VALUES (v_phone, NEW.contact_name, 'conversation', NEW.id, NEW.aion_lead_id, now())
  ON CONFLICT (phone) DO UPDATE SET
    conversation_id = COALESCE(aion_contacts.conversation_id, EXCLUDED.conversation_id),
    aion_lead_id    = COALESCE(aion_contacts.aion_lead_id, EXCLUDED.aion_lead_id),
    name            = COALESCE(aion_contacts.name, EXCLUDED.name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_aion_contact_from_conversation ON whatsapp_conversations;
CREATE TRIGGER trg_sync_aion_contact_from_conversation
  AFTER INSERT OR UPDATE ON whatsapp_conversations
  FOR EACH ROW
  WHEN (COALESCE(NEW.is_aion_inbox, false) = true)
  EXECUTE FUNCTION sync_aion_contact_from_conversation();

-- ─────────────────────────────────────────────────────────────────────────────
-- SYNC CONTÍNUO #2 — crm_leads (só quando phone/name mudam, não a cada
-- atualização de estágio/notas do pipeline comercial)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_aion_contact_from_lead()
RETURNS TRIGGER AS $$
DECLARE
  v_phone TEXT;
BEGIN
  v_phone := normalize_aion_contact_phone(NEW.phone);
  IF v_phone IS NULL OR LENGTH(v_phone) < 12 THEN RETURN NEW; END IF;

  INSERT INTO aion_contacts (phone, name, source, aion_lead_id, created_at)
  VALUES (v_phone, NEW.name, 'crm_lead', NEW.id, now())
  ON CONFLICT (phone) DO UPDATE SET
    aion_lead_id = COALESCE(aion_contacts.aion_lead_id, EXCLUDED.aion_lead_id),
    name         = COALESCE(aion_contacts.name, EXCLUDED.name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_aion_contact_from_lead ON crm_leads;
CREATE TRIGGER trg_sync_aion_contact_from_lead
  AFTER INSERT OR UPDATE OF phone, name ON crm_leads
  FOR EACH ROW EXECUTE FUNCTION sync_aion_contact_from_lead();
