import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BILLING-READY-05D: Create webhook_events table for webhook ingestion / idempotency.
 *
 * Records every inbound provider webhook event.
 * Unique constraint on (provider, provider_event_id) prevents duplicate processing.
 * No full payload stored — payload_hash only for audit/dedup safety.
 *
 * Idempotent: uses IF NOT EXISTS / IF EXISTS guards.
 * No data mutation. Not executed during Step 3.
 */
export class CreateWebhookEventsTable1772300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "webhook_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "provider_event_id" VARCHAR(255) NOT NULL,
        "provider" VARCHAR(50) NOT NULL DEFAULT 'stripe',
        "event_type" VARCHAR(100) NOT NULL,
        "internal_event_type" VARCHAR(100),
        "status" VARCHAR(20) NOT NULL DEFAULT 'received',
        "payload_hash" VARCHAR(64),
        "error_message" TEXT,
        "error_code" VARCHAR(50),
        "attempts" INTEGER NOT NULL DEFAULT 1,
        "received_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "processed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_webhook_events_provider_event_id"
      ON "webhook_events" ("provider", "provider_event_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_webhook_events_event_type"
      ON "webhook_events" ("event_type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_webhook_events_status"
      ON "webhook_events" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_webhook_events_received_at"
      ON "webhook_events" ("received_at" DESC)
    `);

    await queryRunner.query(`
      ALTER TABLE "webhook_events"
      DROP CONSTRAINT IF EXISTS "webhook_events_status_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "webhook_events"
      ADD CONSTRAINT "webhook_events_status_check"
      CHECK ("status" IN ('received', 'verified', 'processing', 'processed', 'ignored', 'failed'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook_events" DROP CONSTRAINT IF EXISTS "webhook_events_status_check"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_webhook_events_received_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_webhook_events_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_webhook_events_event_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_webhook_events_provider_event_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_events"`);
  }
}
