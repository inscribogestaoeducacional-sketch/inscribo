-- =============================================================================
-- 20260812001100_whatsapp_phone_numbers_school_groups.sql
-- Permite que um número de WhatsApp pertença a um school_group inteiro
-- (compartilhado entre unidades) em vez de a uma institution específica.
--
-- Estado confirmado em produção antes desta migration (via
-- information_schema/pg_constraint, não só pelos CREATE TABLE rastreados):
--   whatsapp_phone_numbers_institution_id_fkey: institution_id → institutions(id)
--   whatsapp_phone_numbers_institution_id_key:  UNIQUE (institution_id)
--   whatsapp_phone_numbers_phone_number_id_key: UNIQUE (phone_number_id)
--   institution_id: NOT NULL
-- Ou seja, hoje é estritamente 1:1 institution↔telefone. Esta migration
-- relaxa isso pra permitir a alternativa "1:1 school_group↔telefone",
-- nunca as duas ao mesmo tempo pro mesmo registro.
-- =============================================================================

ALTER TABLE whatsapp_phone_numbers
  ALTER COLUMN institution_id DROP NOT NULL;

ALTER TABLE whatsapp_phone_numbers
  ADD COLUMN IF NOT EXISTS school_group_id UUID REFERENCES school_groups(id) ON DELETE CASCADE;

ALTER TABLE whatsapp_phone_numbers
  DROP CONSTRAINT IF EXISTS whatsapp_phone_numbers_owner_xor;
ALTER TABLE whatsapp_phone_numbers
  ADD CONSTRAINT whatsapp_phone_numbers_owner_xor
  CHECK (num_nonnulls(institution_id, school_group_id) = 1);

-- UNIQUE(institution_id) já existe (whatsapp_phone_numbers_institution_id_key).
-- Falta o equivalente pro grupo, pra permitir upsert com
-- onConflict:'school_group_id' na tela de configuração do WhatsApp do grupo
-- (mesmo padrão já usado em InstitutionDetails.tsx com onConflict:'institution_id').
ALTER TABLE whatsapp_phone_numbers
  DROP CONSTRAINT IF EXISTS whatsapp_phone_numbers_school_group_id_key;
ALTER TABLE whatsapp_phone_numbers
  ADD CONSTRAINT whatsapp_phone_numbers_school_group_id_key UNIQUE (school_group_id);
