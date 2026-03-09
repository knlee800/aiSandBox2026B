-- TASK-56C: Create usage_records for fresh boot (runs after 001_schema)
-- Must exist before 100_usage_records_created_at.sql
-- Matches api-gateway TypeORM migrations + created_at

CREATE TABLE IF NOT EXISTS usage_records (
  execution_id UUID PRIMARY KEY,
  request_id VARCHAR(100),
  api_key_id VARCHAR(50) NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  session_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  provider VARCHAR(50) NOT NULL,
  adapter VARCHAR(50) NOT NULL,
  model VARCHAR(100),
  tokens_used INTEGER,
  execution_duration_ms INTEGER,
  execution_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (execution_status IN (
      'pending', 'running', 'completed', 'failed', 'timeout',
      'cancel_requested', 'cancelled'
    )),
  "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_usage_records_api_key_timestamp
  ON usage_records (api_key_id, "timestamp");
CREATE INDEX IF NOT EXISTS idx_usage_records_user_timestamp
  ON usage_records (user_id, "timestamp");
CREATE INDEX IF NOT EXISTS idx_usage_records_timestamp
  ON usage_records ("timestamp");
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_records_user_request_id
  ON usage_records (user_id, request_id) WHERE request_id IS NOT NULL;
