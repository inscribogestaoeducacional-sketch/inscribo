-- =============================================================================
-- 20260821050000_create_contact_custom_fields_tables.sql
-- Cria contact_custom_fields e contact_field_values no banco remoto —
-- confirmado via information_schema.tables que nenhuma das duas existe em
-- produção, embora o schema esteja definido desde sempre em
-- supabase/migrations/contacts.sql. Causa raiz: contacts.sql não segue o
-- padrão de nome <timestamp>_<nome>.sql exigido pelo `supabase db push`,
-- então é pulado silenciosamente ("Skipping migration contacts.sql...") —
-- nunca foi aplicado de verdade no banco remoto.
--
-- Isso já estava quebrando 20260822000000_contacts_module_improvements.sql
-- (falha no primeiro ALTER TABLE, "relation contact_custom_fields does not
-- exist") e, mais grave, três telas do frontend que já leem/escrevem essas
-- tabelas em produção: ContactProfile.tsx, ContactCard.tsx e
-- CustomFieldsAdminModal.tsx — todas quebrando silenciosamente ao tocar em
-- campos customizáveis, sem nenhum aviso de schema faltando.
--
-- Este arquivo reproduz FIELMENTE a definição original das duas tabelas +
-- RLS de contacts.sql (não mexe em contact_notes, terceira tabela do mesmo
-- arquivo — essa já existe em produção, aplicada manualmente em algum
-- momento sob o nome de policy "contact_notes_inst", diferente do "notes_inst"
-- do arquivo original; confirmado via pg_policies antes de escrever este
-- arquivo, então foi deixada de fora de propósito pra não duplicar policy
-- nem mexer em algo que já funciona). CREATE TABLE IF NOT EXISTS + DROP
-- POLICY IF EXISTS antes de cada CREATE POLICY tornam este arquivo seguro
-- pra rodar de novo caso essa migration falhe pela metade.
--
-- Precisa rodar ANTES de 20260822000000_contacts_module_improvements.sql
-- (que faz ALTER TABLE contact_custom_fields ADD COLUMN required) — por
-- isso o timestamp 20260821050000, entre a última migration boa do dia 21
-- (20260821040000) e a que estava falhando (20260822000000).
-- =============================================================================

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

ALTER TABLE contact_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_field_values  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fields_inst" ON contact_custom_fields;
CREATE POLICY "fields_inst" ON contact_custom_fields
  USING (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "values_inst" ON contact_field_values;
CREATE POLICY "values_inst" ON contact_field_values
  USING (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()));
