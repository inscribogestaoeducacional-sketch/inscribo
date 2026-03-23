-- Add missing columns to student_transfers
ALTER TABLE student_transfers
  ADD COLUMN IF NOT EXISTS stated_reason   TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes  TEXT,
  ADD COLUMN IF NOT EXISTS status          TEXT DEFAULT 'pending';
