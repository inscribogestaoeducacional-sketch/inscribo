ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS responsible_name TEXT;
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON enrollments(user_id);
