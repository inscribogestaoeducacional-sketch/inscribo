-- Tabela de auditoria centralizada
CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID,
  module         TEXT,
  record_id      UUID,
  action         TEXT,
  field_changed  TEXT,
  old_value      TEXT,
  new_value      TEXT,
  user_id        UUID,
  user_name      TEXT,
  user_role      TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Garante colunas mesmo se a tabela já existia com estrutura diferente
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS institution_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS module        TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS record_id     UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action        TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS field_changed TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_value     TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_value     TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id       UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_name     TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_role     TEXT;

-- Soft delete em student_transfers
ALTER TABLE student_transfers
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by  TEXT;

-- Soft delete em leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by  TEXT;

-- Índices para buscas por registro
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id   ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_institution  ON audit_logs(institution_id, created_at DESC);
