-- =============================================================================
-- contacts_import: a prévia passa a devolver contacts_to_update — quantos
-- contatos existentes mudam de fato com as opções escolhidas (um contato pode
-- mudar em várias colunas, então a tela não consegue somar pelas colunas).
-- A tela de importação mostra esse número na confirmação final. O cálculo
-- das mudanças de tags só mudou de lugar (antes do resultado). O resto da
-- função é idêntico a 20260929000000.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.contacts_import(
  p_institution_id UUID,
  p_rows           JSONB,
  p_options        JSONB DEFAULT '{}',
  p_apply          BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_cols     TEXT[] := ARRAY['name','email','address','student','grade','relationship'];
  v_col      TEXT;
  v_mode     JSONB := '{}';
  v_tags     TEXT;
  v_n        INTEGER;
  v_result   JSONB;
  v_batch    UUID;
  v_created  INTEGER := 0;
  v_updated  INTEGER := 0;
  v_newtags  INTEGER := 0;
BEGIN
  -- Mesma regra da RLS de whatsapp_contacts: usuário da própria escola.
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM users WHERE id = v_uid AND institution_id = p_institution_id) THEN
    RAISE EXCEPTION 'Sem permissão para importar contatos nesta escola' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Linhas da planilha inválidas' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_rows) > 20000 THEN
    RAISE EXCEPTION 'Planilha acima de 20.000 linhas — divida em arquivos menores' USING ERRCODE = '22023';
  END IF;

  -- Modos por coluna (padrão: nome só preenche vazio; o resto sobrescreve).
  FOREACH v_col IN ARRAY v_cols LOOP
    v_mode := v_mode || jsonb_build_object(v_col, coalesce(
      nullif(p_options #>> ARRAY['columns', v_col], ''),
      CASE WHEN v_col = 'name' THEN 'fill' ELSE 'overwrite' END));
    IF v_mode ->> v_col NOT IN ('skip','fill','overwrite') THEN
      RAISE EXCEPTION 'Opção inválida para a coluna %', v_col USING ERRCODE = '22023';
    END IF;
  END LOOP;
  v_tags := coalesce(nullif(p_options ->> 'tags', ''), 'add');
  IF v_tags NOT IN ('skip','add','replace') THEN
    RAISE EXCEPTION 'Opção inválida para as tags' USING ERRCODE = '22023';
  END IF;

  -- ── Linhas da planilha, normalizadas ──
  DROP TABLE IF EXISTS pg_temp._ci_rows;
  CREATE TEMP TABLE _ci_rows ON COMMIT DROP AS
  SELECT r.ord::int AS ord,
         btrim(coalesce(r.v ->> 'phone', '')) AS phone_raw,
         x.phone_n,
         broadcast_phone_key(x.phone_n) AS k,
         x.phone_n ~ '^55[1-9][0-9](9[0-9]{8}|[2-9][0-9]{7})$' AS valid,
         nullif(btrim(r.v ->> 'name'), '')         AS name,
         nullif(btrim(r.v ->> 'email'), '')        AS email,
         nullif(btrim(r.v ->> 'address'), '')      AS address,
         nullif(btrim(r.v ->> 'student'), '')      AS student,
         nullif(btrim(r.v ->> 'grade'), '')        AS grade,
         nullif(btrim(r.v ->> 'relationship'), '') AS relationship,
         ARRAY(SELECT DISTINCT btrim(t) FROM jsonb_array_elements_text(
                 CASE WHEN jsonb_typeof(r.v -> 'tags') = 'array' THEN r.v -> 'tags' ELSE '[]' END) t
               WHERE btrim(t) <> '') AS tags
  FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS r(v, ord),
  LATERAL (SELECT regexp_replace(coalesce(r.v ->> 'phone', ''), '\D', '', 'g') AS d) dd,
  LATERAL (SELECT CASE WHEN btrim(coalesce(r.v ->> 'phone', '')) !~ '^\+' AND length(dd.d) IN (10, 11)
                       THEN '55' || dd.d ELSE dd.d END AS phone_n) x;

  -- ── Uma linha por número (irmãos juntos) ──
  DROP TABLE IF EXISTS pg_temp._ci_num;
  -- Tudo em agregação (sem subconsulta por número): com 20 mil linhas a
  -- versão correlacionada estourava o limite de 8 s do papel authenticated.
  ANALYZE _ci_rows;
  CREATE TEMP TABLE _ci_num ON COMMIT DROP AS
  WITH v AS (SELECT * FROM _ci_rows WHERE valid),
  agg AS (
    SELECT k,
           min(ord) AS first_ord,
           count(*) AS lines,
           (array_agg(phone_n ORDER BY ord DESC))[1]                                        AS phone_n,
           (array_agg(name ORDER BY ord DESC) FILTER (WHERE name IS NOT NULL))[1]            AS name,
           (array_agg(email ORDER BY ord DESC) FILTER (WHERE email IS NOT NULL))[1]          AS email,
           (array_agg(address ORDER BY ord DESC) FILTER (WHERE address IS NOT NULL))[1]      AS address,
           (array_agg(relationship ORDER BY ord DESC) FILTER (WHERE relationship IS NOT NULL))[1] AS relationship
    FROM v GROUP BY k
  ),
  -- Irmãos: valores distintos (sem diferenciar maiúsculas), na ordem em que aparecem.
  st AS (
    SELECT k, string_agg(val, ' / ' ORDER BY o) AS student
    FROM (SELECT DISTINCT ON (k, lower(student)) k, student AS val, ord AS o
          FROM v WHERE student IS NOT NULL ORDER BY k, lower(student), ord) s
    GROUP BY k
  ),
  gr AS (
    SELECT k, string_agg(val, ' / ' ORDER BY o) AS grade
    FROM (SELECT DISTINCT ON (k, lower(grade)) k, grade AS val, ord AS o
          FROM v WHERE grade IS NOT NULL ORDER BY k, lower(grade), ord) s
    GROUP BY k
  ),
  tg AS (SELECT k, array_agg(DISTINCT t) AS tags FROM v, unnest(v.tags) t GROUP BY k)
  SELECT agg.*, st.student, gr.grade, coalesce(tg.tags, '{}') AS tags
  FROM agg LEFT JOIN st USING (k) LEFT JOIN gr USING (k) LEFT JOIN tg USING (k);
  ANALYZE _ci_num;

  -- ── Contatos existentes de cada número (todos, se duplicado na base) ──
  DROP TABLE IF EXISTS pg_temp._ci_match;
  CREATE TEMP TABLE _ci_match ON COMMIT DROP AS
  SELECT n.k, c.id AS contact_id, c.name, c.email, c.address,
         c.linked_student_name AS student, c.student_grade AS grade, c.relationship,
         coalesce(c.tags, '{}') AS tags
  FROM _ci_num n
  JOIN whatsapp_contacts c
    ON c.institution_id = p_institution_id AND broadcast_phone_key(c.phone) = n.k;
  ANALYZE _ci_match;

  -- ── Mudanças campo a campo nos existentes (conforme o modo de cada coluna) ──
  DROP TABLE IF EXISTS pg_temp._ci_changes;
  CREATE TEMP TABLE _ci_changes (contact_id UUID, field TEXT, old_value TEXT, new_value TEXT, kind TEXT) ON COMMIT DROP;
  INSERT INTO _ci_changes
  SELECT m.contact_id, f.field, f.old_v, f.new_v,
         CASE WHEN nullif(btrim(f.old_v), '') IS NULL THEN 'fill' ELSE 'overwrite' END
  FROM _ci_match m
  JOIN _ci_num n USING (k)
  CROSS JOIN LATERAL (VALUES
    ('name', m.name, n.name), ('email', m.email, n.email), ('address', m.address, n.address),
    ('student', m.student, n.student), ('grade', m.grade, n.grade), ('relationship', m.relationship, n.relationship)
  ) AS f(field, old_v, new_v)
  WHERE f.new_v IS NOT NULL
    AND (nullif(btrim(f.old_v), '') IS NULL OR btrim(f.old_v) IS DISTINCT FROM f.new_v);

  -- ── Etiquetas que ainda não existem no catálogo ──
  DROP TABLE IF EXISTS pg_temp._ci_newtags;
  CREATE TEMP TABLE _ci_newtags ON COMMIT DROP AS
  SELECT DISTINCT t AS name
  FROM _ci_num n
  LEFT JOIN (SELECT DISTINCT k FROM _ci_match) mk USING (k)
  CROSS JOIN unnest(n.tags) t
  WHERE (mk.k IS NULL OR v_tags <> 'skip')
    AND NOT EXISTS (SELECT 1 FROM whatsapp_tags w WHERE w.institution_id = p_institution_id AND w.name = t);

  -- ── Tags dos existentes (conforme o modo escolhido) ──
  DROP TABLE IF EXISTS pg_temp._ci_tagchg;
  CREATE TEMP TABLE _ci_tagchg ON COMMIT DROP AS
  SELECT m.contact_id, m.tags AS old_tags,
         CASE v_tags WHEN 'replace' THEN n.tags
                     ELSE ARRAY(SELECT DISTINCT t FROM unnest(m.tags || n.tags) t) END AS new_tags
  FROM _ci_match m JOIN _ci_num n USING (k)
  WHERE v_tags <> 'skip' AND cardinality(n.tags) > 0
    AND CASE v_tags WHEN 'replace' THEN NOT (n.tags <@ m.tags AND m.tags <@ n.tags)
                    ELSE NOT (n.tags <@ m.tags) END;

  -- ── Números da prévia ──
  SELECT jsonb_build_object(
    'rows',               (SELECT count(*) FROM _ci_rows),
    'invalid',            (SELECT count(*) FROM _ci_rows WHERE NOT valid),
    'invalid_samples',    coalesce((SELECT jsonb_agg(jsonb_build_object('line', ord, 'phone', phone_raw) ORDER BY ord)
                                    FROM (SELECT * FROM _ci_rows WHERE NOT valid ORDER BY ord LIMIT 20) s), '[]'),
    'numbers',            (SELECT count(*) FROM _ci_num),
    'merged_lines',       (SELECT coalesce(sum(lines - 1), 0) FROM _ci_num),
    'existing_numbers',   (SELECT count(DISTINCT k) FROM _ci_match),
    'existing_contacts',  (SELECT count(*) FROM _ci_match),
    'duplicated_in_base', (SELECT count(*) FROM (SELECT k FROM _ci_match GROUP BY k HAVING count(*) > 1) d),
    'new_contacts',       (SELECT count(*) FROM _ci_num n WHERE NOT EXISTS (SELECT 1 FROM _ci_match m WHERE m.k = n.k)),
    -- Contatos existentes que mudam de fato com as opções escolhidas
    -- (campo em modo fill/overwrite que muda, ou tags) — o número da confirmação.
    'contacts_to_update', (SELECT count(*) FROM (
                             SELECT ch.contact_id FROM _ci_changes ch
                             WHERE (v_mode ->> ch.field) = 'overwrite'
                                OR ((v_mode ->> ch.field) = 'fill' AND ch.kind = 'fill')
                             UNION
                             SELECT contact_id FROM _ci_tagchg) u),
    -- Impacto de cada modo, independente do escolhido: a tela calcula o efeito
    -- da opção sem chamar de novo (fill = só vazios; overwrite = vazios + diferentes).
    'columns',            (SELECT jsonb_object_agg(c, jsonb_build_object(
                             'fill',      (SELECT count(*) FROM _ci_changes ch WHERE ch.field = c AND ch.kind = 'fill'),
                             'overwrite', (SELECT count(*) FROM _ci_changes ch WHERE ch.field = c AND ch.kind = 'overwrite'),
                             'present',   (SELECT count(*) FROM _ci_num n WHERE CASE c WHEN 'name' THEN n.name WHEN 'email' THEN n.email
                                              WHEN 'address' THEN n.address WHEN 'student' THEN n.student WHEN 'grade' THEN n.grade
                                              ELSE n.relationship END IS NOT NULL)))
                           FROM unnest(v_cols) c),
    'tags',               jsonb_build_object(
                             'present', (SELECT count(*) FROM _ci_num WHERE cardinality(tags) > 0),
                             'add',     (SELECT count(*) FROM _ci_match m JOIN _ci_num n USING (k)
                                         WHERE cardinality(n.tags) > 0 AND NOT (n.tags <@ m.tags)),
                             'replace', (SELECT count(*) FROM _ci_match m JOIN _ci_num n USING (k)
                                         WHERE cardinality(n.tags) > 0
                                           AND NOT (n.tags <@ m.tags AND m.tags <@ n.tags)),
                             'new_in_catalog', coalesce((SELECT jsonb_agg(name ORDER BY name) FROM _ci_newtags), '[]')),
    'options',            jsonb_build_object('columns', v_mode, 'tags', v_tags)
  ) INTO v_result;

  IF NOT p_apply THEN
    RETURN v_result || jsonb_build_object('applied', false);
  END IF;

  -- ══ Gravação ══════════════════════════════════════════════════════════════
  INSERT INTO contact_import_batches (institution_id, created_by, source, file_name, options, result)
  VALUES (p_institution_id, v_uid,
          CASE WHEN p_options ->> 'source' = 'broadcast' THEN 'broadcast' ELSE 'contacts' END,
          left(p_options ->> 'file_name', 200),
          jsonb_build_object('columns', v_mode, 'tags', v_tags), v_result)
  RETURNING id INTO v_batch;

  INSERT INTO whatsapp_tags (institution_id, name)
  SELECT p_institution_id, name FROM _ci_newtags
  ON CONFLICT (institution_id, name) DO NOTHING;
  GET DIAGNOSTICS v_newtags = ROW_COUNT;

  -- Só as mudanças que o modo escolhido pede.
  DELETE FROM _ci_changes ch
  WHERE (v_mode ->> ch.field) = 'skip'
     OR ((v_mode ->> ch.field) = 'fill' AND ch.kind = 'overwrite');

  UPDATE whatsapp_contacts c
  SET name                = coalesce(p.name, c.name),
      email               = coalesce(p.email, c.email),
      address             = coalesce(p.address, c.address),
      linked_student_name = coalesce(p.student, c.linked_student_name),
      student_grade       = coalesce(p.grade, c.student_grade),
      relationship        = coalesce(p.relationship, c.relationship),
      tags                = coalesce(tc.new_tags, c.tags),
      updated_at          = now()
  FROM (
    -- Uma linha por contato (campos + tags juntos), senão o UPDATE com duas
    -- linhas pro mesmo contato aplicaria só uma delas.
    SELECT ids.contact_id,
           max(ch.new_value) FILTER (WHERE ch.field = 'name')         AS name,
           max(ch.new_value) FILTER (WHERE ch.field = 'email')        AS email,
           max(ch.new_value) FILTER (WHERE ch.field = 'address')      AS address,
           max(ch.new_value) FILTER (WHERE ch.field = 'student')      AS student,
           max(ch.new_value) FILTER (WHERE ch.field = 'grade')        AS grade,
           max(ch.new_value) FILTER (WHERE ch.field = 'relationship') AS relationship
    FROM (SELECT contact_id FROM _ci_changes UNION SELECT contact_id FROM _ci_tagchg) ids
    LEFT JOIN _ci_changes ch USING (contact_id)
    GROUP BY ids.contact_id
  ) p
  LEFT JOIN _ci_tagchg tc USING (contact_id)
  WHERE c.id = p.contact_id AND c.institution_id = p_institution_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  INSERT INTO contact_field_change_log (institution_id, contact_id, field_name, old_value, new_value, changed_by, import_batch_id)
  SELECT p_institution_id, ch.contact_id,
         CASE ch.field WHEN 'student' THEN 'linked_student_name' WHEN 'grade' THEN 'student_grade' ELSE ch.field END,
         ch.old_value, ch.new_value, v_uid, v_batch
  FROM _ci_changes ch
  UNION ALL
  SELECT p_institution_id, tc.contact_id, 'tags', array_to_string(tc.old_tags, '|'), array_to_string(tc.new_tags, '|'), v_uid, v_batch
  FROM _ci_tagchg tc;

  -- Contatos novos: formato canônico do webhook (13 dígitos), tudo da planilha.
  WITH ins AS (
    INSERT INTO whatsapp_contacts (institution_id, phone, name, email, address, linked_student_name,
                                   student_grade, relationship, tags, type)
    SELECT p_institution_id, normalize_phone_br(n.phone_n), n.name, n.email, n.address, n.student,
           n.grade, n.relationship, n.tags, 'client'
    FROM _ci_num n
    WHERE NOT EXISTS (SELECT 1 FROM _ci_match m WHERE m.k = n.k)
    ON CONFLICT (institution_id, phone) DO NOTHING
    RETURNING id, phone
  )
  INSERT INTO contact_field_change_log (institution_id, contact_id, field_name, old_value, new_value, changed_by, import_batch_id)
  SELECT p_institution_id, ins.id, 'created', NULL, ins.phone, v_uid, v_batch FROM ins;
  GET DIAGNOSTICS v_created = ROW_COUNT;

  v_result := v_result || jsonb_build_object(
    'applied', true, 'batch_id', v_batch,
    'created', v_created, 'updated_contacts', v_updated, 'tags_created', v_newtags);
  UPDATE contact_import_batches SET result = v_result WHERE id = v_batch;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.contacts_import(UUID, JSONB, JSONB, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contacts_import(UUID, JSONB, JSONB, BOOLEAN) TO authenticated;
