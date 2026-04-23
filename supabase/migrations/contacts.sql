-- Drop legacy clients tables if they exist
DROP TABLE IF EXISTS client_notes CASCADE;
DROP TABLE IF EXISTS client_custom_fields CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

-- Contact notes (linked by ref_type + ref_id, no FK to avoid coupling)
CREATE TABLE IF NOT EXISTS contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  contact_ref_id text NOT NULL,
  contact_ref_type text NOT NULL,
  content text NOT NULL,
  author_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Custom field definitions per school
CREATE TABLE IF NOT EXISTS contact_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  label text NOT NULL,
  type text DEFAULT 'text' CHECK (type IN ('text','number','date','select')),
  options text[],
  created_at timestamptz DEFAULT now()
);

-- Field values per contact
CREATE TABLE IF NOT EXISTS contact_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  contact_ref_id text NOT NULL,
  field_id uuid REFERENCES contact_custom_fields(id) ON DELETE CASCADE,
  value text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(contact_ref_id, field_id)
);

ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_inst" ON contact_notes
  USING (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()));

CREATE POLICY "fields_inst" ON contact_custom_fields
  USING (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()));

CREATE POLICY "values_inst" ON contact_field_values
  USING (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()));
