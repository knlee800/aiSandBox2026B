import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddChatMessagesAndAlignConversations Migration
 *
 * TASK-56E: Full Fresh-Boot Schema Parity Fix
 *
 * Idempotent: safe for fresh boot (init already created) and existing DBs.
 * - Creates chat_message_role enum if not exists
 * - Creates chat_messages table if not exists
 * - Aligns conversations to runtime entity (messages_count, drop legacy columns)
 */
export class AddChatMessagesAndAlignConversations1771495100000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_message_role') THEN
          CREATE TYPE chat_message_role AS ENUM ('user', 'assistant', 'system');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role chat_message_role NOT NULL,
        content TEXT NOT NULL,
        tokens_used INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_message_conversation_id ON chat_messages(conversation_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_message_created_at ON chat_messages(created_at)
    `);

    await queryRunner.query(`
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS messages_count INTEGER NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE conversations DROP COLUMN IF EXISTS user_id
    `);
    await queryRunner.query(`
      ALTER TABLE conversations DROP COLUMN IF EXISTS messages
    `);
    await queryRunner.query(`
      ALTER TABLE conversations DROP COLUMN IF EXISTS current_message_number
    `);
  }

  public async down(): Promise<void> {
    // No down - schema parity is one-way; revert would require data migration
  }
}
