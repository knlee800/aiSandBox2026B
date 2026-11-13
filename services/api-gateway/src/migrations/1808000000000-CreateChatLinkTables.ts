import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CHAT-DISCORD-01 slice A1 (stage-start section 5).
 *
 * Creates two channel-neutral tables:
 * - public.chat_links: one row per linked outside chat account. Unique
 *   (channel, external_user_id): one owner per outside account. Unique
 *   (user_id, channel): one outside account per owner per channel.
 * - public.chat_link_codes: one-time link codes, SHA-256 hash only at rest
 *   (a CHECK refuses anything but 64 lowercase hex characters), unique hash.
 *   Rows are deleted on confirm, cancel, replacement and expiry.
 * Both go with the user (foreign key with ON DELETE CASCADE).
 *
 * Timestamp 1808000000000 is after AddUserAgentApprovalColumns1807000000000.
 * up() refuses when either table is already present. down() refuses unless
 * both are present, then drops only these two tables (their indexes go with
 * them). down() loses only the links and the live codes.
 */
export class CreateChatLinkTables1808000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const state = await this.tablesState(queryRunner);
    if (state.links || state.codes) {
      throw new Error(
        [
          'CHAT-DISCORD-01: public.chat_links or public.chat_link_codes already exists.',
          'Refusing to create them again.',
        ].join(' '),
      );
    }

    await queryRunner.query(`
      CREATE TABLE "public"."chat_links" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "channel" varchar(16) NOT NULL,
        "external_user_id" varchar(32) NOT NULL,
        "locale" varchar(10) NOT NULL DEFAULT 'en',
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "last_used_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_chat_links_channel_external_user_id" ON "public"."chat_links" ("channel", "external_user_id")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_chat_links_user_id_channel" ON "public"."chat_links" ("user_id", "channel")',
    );

    await queryRunner.query(`
      CREATE TABLE "public"."chat_link_codes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "channel" varchar(16) NOT NULL,
        "code_hash" varchar(64) NOT NULL CONSTRAINT "chk_chat_link_codes_code_hash" CHECK ("code_hash" ~ '^[0-9a-f]{64}$'),
        "locale" varchar(10) NOT NULL DEFAULT 'en',
        "expires_at" timestamptz NOT NULL,
        "claimed_external_user_id" varchar(32) NULL,
        "claimed_display_name" varchar(64) NULL,
        "claimed_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_chat_link_codes_code_hash" ON "public"."chat_link_codes" ("code_hash")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_chat_link_codes_user_id_channel" ON "public"."chat_link_codes" ("user_id", "channel")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const state = await this.tablesState(queryRunner);
    if (!state.links || !state.codes) {
      throw new Error(
        'CHAT-DISCORD-01 down(): public.chat_links and public.chat_link_codes are not both present.',
      );
    }

    await queryRunner.query('DROP TABLE "public"."chat_link_codes"');
    await queryRunner.query('DROP TABLE "public"."chat_links"');
  }

  private async tablesState(
    queryRunner: QueryRunner,
  ): Promise<{ links: boolean; codes: boolean }> {
    const rows = await queryRunner.query(`
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'chat_links'
        ) AS "chat_links_exists",
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'chat_link_codes'
        ) AS "chat_link_codes_exists"
    `);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('CHAT-DISCORD-01: could not read chat link table state.');
    }
    const row = rows[0] as { chat_links_exists?: unknown; chat_link_codes_exists?: unknown };
    return {
      links: readFlag(row.chat_links_exists),
      codes: readFlag(row.chat_link_codes_exists),
    };
  }
}

function readFlag(value: unknown): boolean {
  if (value === true || value === 't' || value === 'true' || value === 1 || value === '1') {
    return true;
  }
  if (value === false || value === 'f' || value === 'false' || value === 0 || value === '0') {
    return false;
  }
  throw new Error('CHAT-DISCORD-01: could not read chat link table state.');
}
