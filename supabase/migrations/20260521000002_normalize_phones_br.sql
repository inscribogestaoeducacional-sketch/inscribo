-- ── Canonical BR phone format: 55 + DDD(2) + 9 + number(8) = 13 digits ───────

-- 1. Normalization function
CREATE OR REPLACE FUNCTION normalize_phone_br(p TEXT)
RETURNS TEXT AS $$
DECLARE
  digits TEXT;
  ddd    TEXT;
  number TEXT;
BEGIN
  -- Strip non-digits
  digits := regexp_replace(p, '[^0-9]', '', 'g');

  -- Remove country code 55 when total is 12 or 13 digits
  IF length(digits) IN (12, 13) AND left(digits, 2) = '55' THEN
    digits := substring(digits from 3);
  END IF;

  -- Now should be 10 or 11 digits (DDD + number)
  -- 10 digits → 8-digit number → prepend 9 after DDD
  IF length(digits) = 10 THEN
    ddd    := left(digits, 2);
    number := substring(digits from 3);
    digits := ddd || '9' || number;
  END IF;

  -- Prepend country code 55 to get 13 digits
  IF length(digits) = 11 THEN
    digits := '55' || digits;
  END IF;

  -- If the result isn't 13 digits (invalid input), return as-is
  IF length(digits) != 13 THEN
    RETURN regexp_replace(p, '[^0-9]', '', 'g');
  END IF;

  RETURN digits;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Deduplicate whatsapp_contacts after normalization
--    (keep the row with the most specific type, then most recent last_seen_at)
WITH normalized AS (
  SELECT id, institution_id,
    normalize_phone_br(phone) AS norm_phone,
    type, last_seen_at,
    ROW_NUMBER() OVER (
      PARTITION BY institution_id, normalize_phone_br(phone)
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

-- 3. Normalize whatsapp_contacts phones
UPDATE whatsapp_contacts
SET phone = normalize_phone_br(phone)
WHERE phone IS NOT NULL;

-- 4. Normalize leads phones
UPDATE leads
SET phone = normalize_phone_br(phone)
WHERE phone IS NOT NULL
  AND phone != '';

-- 5. Verification query
SELECT
  'whatsapp_contacts'                                                           AS tabela,
  COUNT(*)                                                                      AS total,
  COUNT(CASE WHEN length(phone) = 13 THEN 1 END)                               AS normalizados,
  COUNT(CASE WHEN length(phone) != 13 THEN 1 END)                              AS pendentes
FROM whatsapp_contacts
UNION ALL
SELECT
  'leads',
  COUNT(*),
  COUNT(CASE WHEN length(regexp_replace(phone, '[^0-9]', '', 'g')) = 13 THEN 1 END),
  COUNT(CASE WHEN length(regexp_replace(phone, '[^0-9]', '', 'g')) != 13 THEN 1 END)
FROM leads
WHERE phone IS NOT NULL AND phone != '';
