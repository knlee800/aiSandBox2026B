import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BILLING-READY-05E: Create credit_grants table for credit grant / top-up accounting.
 *
 * Records every credit grant attempt (top-up, subscription, admin, promotional).
 * Unique constraint on source_event_id prevents double-credit.
 * balance_before/balance_after are snapshot values.
 *
 * Idempotent: uses IF NOT EXISTS / IF EXISTS guards.
 * No data mutation. Not executed during Step 3.
 */
export class CreateCreditGrantsTable1772400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "credit_grants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "owner_id" VARCHAR(50) NOT NULL,
        "owner_type" VARCHAR(20) NOT NULL DEFAULT 'user',
        "grant_type" VARCHAR(30) NOT NULL,
        "source_type" VARCHAR(30) NOT NULL,
        "source_event_id" VARCHAR(255) NOT NULL,
        "provider" VARCHAR(50) NOT NULL DEFAULT 'stripe',
        "provider_event_id" VARCHAR(255),
        "webhook_event_id" uuid,
        "plan_type" VARCHAR(50),
        "top_up_pack_id" VARCHAR(50),
        "amount" INTEGER NOT NULL,
        "balance_before" INTEGER NOT NULL,
        "balance_after" INTEGER NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
        "error_code" VARCHAR(50),
        "error_message" TEXT,
        "granted_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_credit_grants_source_event_id"
      ON "credit_grants" ("source_event_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_credit_grants_owner"
      ON "credit_grants" ("owner_id", "owner_type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_credit_grants_webhook_event"
      ON "credit_grants" ("webhook_event_id")
      WHERE "webhook_event_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_credit_grants_status"
      ON "credit_grants" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_credit_grants_created_at"
      ON "credit_grants" ("created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_credit_grants_grant_type"
      ON "credit_grants" ("grant_type")
    `);

    await queryRunner.query(`
      ALTER TABLE "credit_grants"
      DROP CONSTRAINT IF EXISTS "credit_grants_amount_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "credit_grants"
      ADD CONSTRAINT "credit_grants_amount_check"
      CHECK ("amount" > 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "credit_grants"
      DROP CONSTRAINT IF EXISTS "credit_grants_balance_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "credit_grants"
      ADD CONSTRAINT "credit_grants_balance_check"
      CHECK ("balance_after" >= "balance_before")
    `);

    await queryRunner.query(`
      ALTER TABLE "credit_grants"
      DROP CONSTRAINT IF EXISTS "credit_grants_status_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "credit_grants"
      ADD CONSTRAINT "credit_grants_status_check"
      CHECK ("status" IN ('pending', 'granted', 'failed', 'ignored'))
    `);

    await queryRunner.query(`
      ALTER TABLE "credit_grants"
      DROP CONSTRAINT IF EXISTS "credit_grants_grant_type_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "credit_grants"
      ADD CONSTRAINT "credit_grants_grant_type_check"
      CHECK ("grant_type" IN ('topup', 'subscription_monthly', 'subscription_initial', 'admin', 'promotional'))
    `);

    await queryRunner.query(`
      ALTER TABLE "credit_grants"
      DROP CONSTRAINT IF EXISTS "credit_grants_source_type_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "credit_grants"
      ADD CONSTRAINT "credit_grants_source_type_check"
      CHECK ("source_type" IN ('webhook', 'system', 'admin'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "credit_grants" DROP CONSTRAINT IF EXISTS "credit_grants_source_type_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "credit_grants" DROP CONSTRAINT IF EXISTS "credit_grants_grant_type_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "credit_grants" DROP CONSTRAINT IF EXISTS "credit_grants_status_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "credit_grants" DROP CONSTRAINT IF EXISTS "credit_grants_balance_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "credit_grants" DROP CONSTRAINT IF EXISTS "credit_grants_amount_check"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_credit_grants_grant_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_credit_grants_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_credit_grants_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_credit_grants_webhook_event"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_credit_grants_owner"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_credit_grants_source_event_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "credit_grants"`);
  }
}
