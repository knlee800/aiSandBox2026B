import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CHAT-STATE-PERSIST-01 (stage-start section 3): the Discord chat channel's
 * limits, delivery progress, holds and approval buttons survive a gateway
 * restart.
 *
 * public.chat_run_deliveries gets seven columns (one ALTER TABLE):
 * - parts_sent integer NOT NULL DEFAULT 0, CHECK >= 0: result parts already sent;
 * - send_failures integer NOT NULL DEFAULT 0, CHECK >= 0: failed attempts so far;
 * - next_attempt_at timestamptz NULL: not before this time (backoff);
 * - held_at timestamptz NULL: Discord refused the direct message; cleared by
 *   the user's next command or button press;
 * - claimed_by varchar(36) NULL, claimed_until timestamptz NULL: the gateway
 *   process working on the row and when that claim ends by itself;
 * - origin text NULL, CHECK IN ('chat', 'platform'): 'chat' for rows /ask
 *   writes, 'platform' for rows the run-started listener writes. Existing rows
 *   keep NULL (read through the run_started audit rows, as before). A second
 *   ALTER TABLE then sets the default 'platform' for new rows only, so the
 *   listener's insert (which names no origin) stores 'platform' while no
 *   existing row is rewritten.
 * Existing rows take the defaults; no row is updated or deleted by hand.
 *
 * public.chat_limit_hits: one row per counted event (link codes, claim
 * attempts, failed claims, the linking pause, chat commands), counted over a
 * sliding window. subject_key is an owner id, the SHA-256 hex of a Discord
 * user id, or the channel name; never a Discord id. Index on
 * (bucket, subject_key, occurred_at). No foreign keys.
 *
 * public.chat_approval_tokens: one row per live approval button message,
 * keyed by the SHA-256 hex of the button token (the token itself is never
 * stored). Foreign key to chat_run_deliveries with ON DELETE CASCADE (unlink
 * deletes the delivery rows, which deletes the tokens). A unique index on
 * referral_id (one live token per step) and an index on expires_at.
 *
 * Timestamp 1817000000000 is after AddChainTriggerFiresOn1816000000000, the
 * latest before it. up() refuses unless chat_run_deliveries exists and none of
 * parts_sent, origin, chat_limit_hits or chat_approval_tokens does. down()
 * refuses unless all four are present, then drops chat_approval_tokens,
 * chat_limit_hits and the seven columns (their CHECKs and the default go with
 * them). down() loses the limit counts and any pause, the live buttons (they
 * answer "no longer works"), the retry state and the origin marks; no run,
 * result, link or delivery row is lost.
 */
export class AddChatPersistedState1817000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const state = await this.schemaState(queryRunner);
    if (!state.deliveries) {
      throw new Error(
        'CHAT-STATE-PERSIST-01: public.chat_run_deliveries is missing. Run CreateChatRunDeliveries1809000000000 first.',
      );
    }
    if (state.partsSent || state.origin) {
      throw new Error(
        'CHAT-STATE-PERSIST-01: public.chat_run_deliveries already has the persisted state columns. Refusing to add them again.',
      );
    }
    if (state.limitHits || state.approvalTokens) {
      throw new Error(
        'CHAT-STATE-PERSIST-01: public.chat_limit_hits or public.chat_approval_tokens already exists. Refusing to create it again.',
      );
    }

    await queryRunner.query(
      'ALTER TABLE "public"."chat_run_deliveries" ' +
        'ADD COLUMN "parts_sent" integer NOT NULL DEFAULT 0 CONSTRAINT "chk_chat_run_deliveries_parts_sent" CHECK ("parts_sent" >= 0), ' +
        'ADD COLUMN "send_failures" integer NOT NULL DEFAULT 0 CONSTRAINT "chk_chat_run_deliveries_send_failures" CHECK ("send_failures" >= 0), ' +
        'ADD COLUMN "next_attempt_at" timestamptz NULL, ' +
        'ADD COLUMN "held_at" timestamptz NULL, ' +
        'ADD COLUMN "claimed_by" varchar(36) NULL, ' +
        'ADD COLUMN "claimed_until" timestamptz NULL, ' +
        'ADD COLUMN "origin" text NULL CONSTRAINT "chk_chat_run_deliveries_origin" CHECK ("origin" IN (\'chat\', \'platform\'))',
    );
    await queryRunner.query(
      'ALTER TABLE "public"."chat_run_deliveries" ALTER COLUMN "origin" SET DEFAULT \'platform\'',
    );
    await queryRunner.query(`
      CREATE TABLE "public"."chat_limit_hits" (
        "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        "bucket" varchar(24) NOT NULL CONSTRAINT "chk_chat_limit_hits_bucket" CHECK ("bucket" IN ('code_create', 'claim_attempt', 'claim_failed', 'link_pause', 'command')),
        "subject_key" varchar(64) NOT NULL,
        "occurred_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_chat_limit_hits_bucket_subject_occurred_at" ON "public"."chat_limit_hits" ("bucket", "subject_key", "occurred_at")',
    );
    await queryRunner.query(`
      CREATE TABLE "public"."chat_approval_tokens" (
        "token_hash" varchar(64) PRIMARY KEY,
        "collaboration_run_id" text NOT NULL REFERENCES "public"."chat_run_deliveries"("collaboration_run_id") ON DELETE CASCADE,
        "link_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "referral_id" text NOT NULL,
        "step" integer NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_chat_approval_tokens_referral_id" ON "public"."chat_approval_tokens" ("referral_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_chat_approval_tokens_expires_at" ON "public"."chat_approval_tokens" ("expires_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const state = await this.schemaState(queryRunner);
    if (!state.partsSent || !state.origin || !state.limitHits || !state.approvalTokens) {
      throw new Error(
        'CHAT-STATE-PERSIST-01 down(): the persisted chat state is not fully present. Refusing to drop it.',
      );
    }

    await queryRunner.query('DROP TABLE "public"."chat_approval_tokens"');
    await queryRunner.query('DROP TABLE "public"."chat_limit_hits"');
    await queryRunner.query(
      'ALTER TABLE "public"."chat_run_deliveries" ' +
        'DROP COLUMN "parts_sent", ' +
        'DROP COLUMN "send_failures", ' +
        'DROP COLUMN "next_attempt_at", ' +
        'DROP COLUMN "held_at", ' +
        'DROP COLUMN "claimed_by", ' +
        'DROP COLUMN "claimed_until", ' +
        'DROP COLUMN "origin"',
    );
  }

  private async schemaState(queryRunner: QueryRunner): Promise<{
    deliveries: boolean;
    partsSent: boolean;
    origin: boolean;
    limitHits: boolean;
    approvalTokens: boolean;
  }> {
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
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'chat_run_deliveries'
            AND column_name = 'parts_sent'
        ) AS "parts_sent_exists",
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'chat_run_deliveries'
            AND column_name = 'origin'
        ) AS "origin_exists",
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'chat_limit_hits'
        ) AS "chat_limit_hits_exists",
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'chat_approval_tokens'
        ) AS "chat_approval_tokens_exists"
    `);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('CHAT-STATE-PERSIST-01: could not read the chat persisted state.');
    }
    const row = rows[0] as Record<string, unknown>;
    return {
      deliveries: readFlag(row.chat_run_deliveries_exists),
      partsSent: readFlag(row.parts_sent_exists),
      origin: readFlag(row.origin_exists),
      limitHits: readFlag(row.chat_limit_hits_exists),
      approvalTokens: readFlag(row.chat_approval_tokens_exists),
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
  throw new Error('CHAT-STATE-PERSIST-01: could not read the chat persisted state.');
}
