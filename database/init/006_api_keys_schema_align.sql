-- TASK-56D: Idempotent migration for api_keys schema parity
-- Existing DBs with old schema (key_hash, name, etc.): add hashed_key, scopes, revoked_at
-- Fresh boot: api_keys already has correct schema, no-op

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'hashed_key'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'key_hash'
  ) THEN
    ALTER TABLE api_keys ADD COLUMN hashed_key VARCHAR(255);
    UPDATE api_keys SET hashed_key = key_hash WHERE key_hash IS NOT NULL;
    DELETE FROM api_keys WHERE hashed_key IS NULL;
    ALTER TABLE api_keys ALTER COLUMN hashed_key SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_api_key_hashed ON api_keys(hashed_key);
  END IF;
END $$;

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes JSONB NOT NULL DEFAULT '[]';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
