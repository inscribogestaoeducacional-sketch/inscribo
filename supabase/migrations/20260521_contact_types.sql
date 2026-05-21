-- ── Unify whatsapp_contacts.type to 4 canonical values ───────────────────────
-- Allowed: 'unknown' | 'lead' | 'client' | 'supplier' | 'other'

-- 1. Migrate any non-canonical values to 'other' before changing the constraint
UPDATE whatsapp_contacts
SET type = 'other'
WHERE type IS NOT NULL
  AND type NOT IN ('unknown', 'lead', 'client', 'supplier', 'other');

-- 2. Drop the old CHECK constraint (name may vary — drop both known variants)
ALTER TABLE whatsapp_contacts
  DROP CONSTRAINT IF EXISTS whatsapp_contacts_type_check;

ALTER TABLE whatsapp_contacts
  DROP CONSTRAINT IF EXISTS whatsapp_contacts_contact_type_check;

-- 3. Add the new CHECK constraint with all 5 allowed values
ALTER TABLE whatsapp_contacts
  ADD CONSTRAINT whatsapp_contacts_type_check
  CHECK (type IN ('unknown', 'lead', 'client', 'supplier', 'other'));

-- 4. Ensure new rows default to 'unknown'
ALTER TABLE whatsapp_contacts
  ALTER COLUMN type SET DEFAULT 'unknown';
