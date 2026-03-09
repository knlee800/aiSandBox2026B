-- TASK-56C: OAuth + session termination (runs after 001_schema)
-- Combines migrations/001 and migrations/002 for init order

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) NOT NULL DEFAULT 'email'
  CHECK (auth_provider IN ('email', 'google', 'apple', 'github'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS terminated_at TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS termination_reason TEXT;
