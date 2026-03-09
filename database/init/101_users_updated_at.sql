-- Idempotent migration for users.updated_at
-- Fresh boot: column already exists (001), no-op
-- Existing DBs: adds column, backfills from created_at, sets NOT NULL

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE users
SET updated_at = COALESCE(updated_at, created_at)
WHERE updated_at IS NULL;

ALTER TABLE users
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE users
  ALTER COLUMN updated_at SET NOT NULL;
