-- Tabela de auditoria centralizada
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL,
  module        TEXT NOT NULL,       -- 'leads', 'visits', 'transfers'
  record_id     UUID NOT NULL,
  action        TEXT NOT NULL,       -- 'created', 'updated', 'deleted', 'status_changed'
  field_changed TEXT,
  old_value     TEXT,
  new_value     TEXT,
  user_id       UUID,
  user_name     TEXT,
  user_role     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Soft delete em student_transfers
ALTER TABLE student_transfers
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by  TEXT;

-- Index para buscas por registro
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_institution ON audit_logs(institution_id, created_at DESC);
