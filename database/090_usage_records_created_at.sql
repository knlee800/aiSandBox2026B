ALTER TABLE usage_records
  ADD COLUMN IF NOT EXISTS created_at timestamp without time zone;

UPDATE usage_records
SET created_at = COALESCE(created_at, "timestamp")
WHERE created_at IS NULL;

ALTER TABLE usage_records
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE usage_records
  ALTER COLUMN created_at SET NOT NULL;
