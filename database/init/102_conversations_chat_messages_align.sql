-- TASK-56E: Idempotent schema parity for conversations + chat_messages
-- Fresh boot: 001 already created correct schema, no-op
-- Existing DBs: creates chat_messages, aligns conversations to runtime entity

-- Create enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_message_role') THEN
    CREATE TYPE chat_message_role AS ENUM ('user', 'assistant', 'system');
  END IF;
END $$;

-- Create chat_messages if not exists
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role chat_message_role NOT NULL,
  content TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_message_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_created_at ON chat_messages(created_at);

-- Align conversations: add messages_count if missing
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS messages_count INTEGER NOT NULL DEFAULT 0;

-- Align conversations: drop legacy columns if present (runtime entity has no user_id, messages, current_message_number)
ALTER TABLE conversations DROP COLUMN IF EXISTS user_id;
ALTER TABLE conversations DROP COLUMN IF EXISTS messages;
ALTER TABLE conversations DROP COLUMN IF EXISTS current_message_number;
