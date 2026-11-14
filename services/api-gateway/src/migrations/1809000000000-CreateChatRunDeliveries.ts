import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CHAT-DISCORD-01 slice C1 (stage-start section 5, Keith's Q10: a second
 * migration with the slice).
 *
 * Creates public.chat_run_deliveries: one row per run started from a chat
 * channel, so the chat poller knows where to send the result.
 * - collaboration_run_id: the run (text, primary key).
 * - link_id: the chat link (foreign key to chat_links with ON DELETE CASCADE,
 *   so unlinking deletes the rows).
 * - status: waiting, delivered, failed or dropped (CHECK).
 * - notified_referral_ids: the hand-offs already announced as waiting for
 *   approval (a JSON array of ids).
 * - created_at, delivered_at.
 * No message or result text is stored here.
 *
 * Indexes: (link_id, status) for the per-link counts and /cancel;
 * (status, created_at) for the poller and the 30-day prune.
 *
 * Timestamp 1809000000000 is after CreateChatLinkTables1808000000000, whose
 * chat_links table the foreign key needs. up() refuses when the table is
 * already present or chat_links is missing. down() refuses unless the table
 * is present, then drops only this table (its indexes go with it). down()
 * loses only the delivery rows; the runs and their results stay.
 */
export class CreateChatRunDeliveries1809000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const state = await this.tableState(queryRunner);
    if (state.deliveries) {
      throw new Error(
        'CHAT-DISCORD-01: public.chat_run_deliveries already exists. Refusing to create it again.',
      );
    }
    if (!state.links) {
      throw new Error(
        'CHAT-DISCORD-01: public.chat_links is missing. Run CreateChatLinkTables1808000000000 first.',
      );
    }

    await queryRunner.query(`
      CREATE TABLE "public"."chat_run_deliveries" (
        "collaboration_run_id" text PRIMARY KEY,
        "link_id" uuid NOT NULL REFERENCES "public"."chat_links"(id) ON DELETE CASCADE,
        "status" varchar(16) NOT NULL DEFAULT 'waiting' CONSTRAINT "chk_chat_run_deliveries_status" CHECK ("status" IN ('waiting', 'delivered', 'failed', 'dropped')),
        "notified_referral_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "delivered_at" timestamptz NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_chat_run_deliveries_link_id_status" ON "public"."chat_run_deliveries" ("link_id", "status")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_chat_run_deliveries_status_created_at" ON "public"."chat_run_deliveries" ("status", "created_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const state = await this.tableState(queryRunner);
    if (!state.deliveries) {
      throw new Error('CHAT-DISCORD-01 down(): public.chat_run_deliveries is not present.');
    }

    await queryRunner.query('DROP TABLE "public"."chat_run_deliveries"');
  }

  private async tableState(
    queryRunner: QueryRunner,
  ): Promise<{ deliveries: boolean; links: boolean }> {
    const rows = await queryRunner.query(`
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'chat_run_deliveries'
        ) AS "chat_run_deliveries_exists",
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'chat_links'
        ) AS "chat_links_exists"
    `);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('CHAT-DISCORD-01: could not read chat run delivery table state.');
    }
    const row = rows[0] as { chat_run_deliveries_exists?: unknown; chat_links_exists?: unknown };
    return {
      deliveries: readFlag(row.chat_run_deliveries_exists),
      links: readFlag(row.chat_links_exists),
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
  throw new Error('CHAT-DISCORD-01: could not read chat run delivery table state.');
}
