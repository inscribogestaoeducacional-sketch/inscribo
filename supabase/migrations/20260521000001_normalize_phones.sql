-- ── Phone normalization: strip country code 55 and leading 0 ─────────────────

-- 1. Helper function
CREATE OR REPLACE FUNCTION normalize_phone(p TEXT)
RETURNS TEXT AS $$
DECLARE
  digits TEXT;
BEGIN
  digits := regexp_replace(p, '[^0-9]', '', 'g');
  IF length(digits) >= 12 AND left(digits, 2) = '55' THEN
    digits := substring(digits from 3);
  END IF;
  IF left(digits, 1) = '0' THEN
    digits := substring(digits from 2);
  END IF;
  RETURN digits;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Remove duplicates created by the same normalized number appearing twice
--    (keep the row with the most specific type, then most recent last_seen_at)
WITH normalized AS (
  SELECT id, institution_id,
    normalize_phone(phone) AS norm_phone,
    type, last_seen_at, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY institution_id, normalize_phone(phone)
      ORDER BY
        CASE type
          WHEN 'lead'     THEN 1
          WHEN 'client'   THEN 2
          WHEN 'supplier' THEN 3
          WHEN 'other'    THEN 4
          ELSE 5
        END,
        last_seen_at DESC NULLS LAST
    ) AS rn
  FROM whatsapp_contacts
  WHERE institution_id IS NOT NULL
)
DELETE FROM whatsapp_contacts
WHERE id IN (
  SELECT id FROM normalized WHERE rn > 1
);

-- 3. Normalize all phone values in place
UPDATE whatsapp_contacts
SET phone = normalize_phone(phone)
WHERE phone IS NOT NULL
  AND phone != normalize_phone(phone);
