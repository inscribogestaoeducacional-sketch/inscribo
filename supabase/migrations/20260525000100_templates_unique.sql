ALTER TABLE whatsapp_templates
ADD CONSTRAINT IF NOT EXISTS whatsapp_templates_institution_name_key
UNIQUE (institution_id, name);
