-- A etiqueta do inscrito saiu "concurso-concurso-de-bolsas-2027": o nome do concurso já começa com "concurso".
-- Agora só prefixa "concurso-" quando o nome não começa assim, e as etiquetas já gravadas são corrigidas.
CREATE OR REPLACE FUNCTION public.contest_candidate_to_contact(c public.contest_candidates)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  d text := regexp_replace(coalesce(c.phone, ''), '\D', '', 'g');
  p text;
  v_slug text;
  v_tag text;
  v_name text;
BEGIN
  IF c.institution_id IS NULL OR d = '' THEN RETURN; END IF;
  p := CASE WHEN length(d) IN (10, 11) THEN '55' || d ELSE d END;
  IF p !~ '^[0-9]{8,15}$' THEN RETURN; END IF;

  SELECT btrim(regexp_replace(
           translate(lower(ct.name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
           '[^a-z0-9]+', '-', 'g'), '-')
    INTO v_slug FROM contests ct WHERE ct.id = c.contest_id;
  v_tag := CASE WHEN coalesce(v_slug, '') = '' THEN 'concurso'
                WHEN v_slug LIKE 'concurso%' THEN v_slug
                ELSE 'concurso-' || v_slug END;
  v_name := coalesce(nullif(btrim(c.responsible_name), ''), nullif(btrim(c.student_name), ''));

  UPDATE whatsapp_contacts w
     SET tags = CASE WHEN v_tag = ANY(coalesce(w.tags, '{}')) THEN w.tags ELSE array_append(coalesce(w.tags, '{}'), v_tag) END,
         lead_id = coalesce(w.lead_id, c.lead_id)
   WHERE w.institution_id = c.institution_id
     AND broadcast_phone_key(w.phone) = broadcast_phone_key(p)
     AND (NOT (v_tag = ANY(coalesce(w.tags, '{}'))) OR (w.lead_id IS NULL AND c.lead_id IS NOT NULL));

  IF NOT EXISTS (SELECT 1 FROM whatsapp_contacts w
                  WHERE w.institution_id = c.institution_id AND broadcast_phone_key(w.phone) = broadcast_phone_key(p)) THEN
    INSERT INTO whatsapp_contacts (institution_id, phone, name, type, lead_id, tags, student_grade, linked_student_name)
    VALUES (c.institution_id, p, v_name, 'lead', c.lead_id, ARRAY[v_tag], c.grade, nullif(btrim(c.student_name), ''))
    ON CONFLICT (institution_id, phone) DO NOTHING;
  END IF;
END
$$;

UPDATE public.whatsapp_contacts
   SET tags = array_replace(tags, 'concurso-concurso-de-bolsas-2027', 'concurso-de-bolsas-2027')
 WHERE 'concurso-concurso-de-bolsas-2027' = ANY(tags);
