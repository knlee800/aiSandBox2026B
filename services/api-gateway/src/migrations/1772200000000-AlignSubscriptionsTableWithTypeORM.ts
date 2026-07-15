import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BILLING-READY-05B: Align existing raw SQL `subscriptions` table with TypeORM entity.
 *
 * The `subscriptions` table already exists via database/init/001_schema.sql.
 * This migration:
 * 1. Adds missing columns: stripe_price_id, cancel_at_period_end, cancelled_at, created_at, updated_at.
 * 2. Updates plan_type CHECK constraint from ('free','pro','enterprise') to ('free','starter','pro','team').
 * 3. Updates status CHECK constraint from ('active','cancelled','past_due') to full lifecycle set.
 * 4. Adds unique partial index on stripe_subscription_id WHERE NOT NULL.
 * 5. Adds partial unique index enforcing one active subscription per user.
 * 6. Adds individual column indexes for status and user_id.
 *
 * Idempotent: uses IF NOT EXISTS / IF EXISTS guards.
 * No data destruction. No provider API calls.
 */
export class AlignSubscriptionsTableWithTypeORM1772200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure table exists (idempotent — raw SQL init may or may not have run)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "stripe_subscription_id" VARCHAR(255),
        "stripe_price_id" VARCHAR(255),
        "plan_type" VARCHAR(50) NOT NULL DEFAULT 'free',
        "status" VARCHAR(20) NOT NULL DEFAULT 'active',
        "current_period_start" TIMESTAMPTZ NOT NULL,
        "current_period_end" TIMESTAMPTZ NOT NULL,
        "cancel_at" TIMESTAMPTZ,
        "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
        "cancelled_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Add FK if not exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_subscriptions_user_id'
        ) THEN
          ALTER TABLE "subscriptions"
          ADD CONSTRAINT "fk_subscriptions_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // Add missing columns (IF NOT EXISTS for idempotency)
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD COLUMN IF NOT EXISTS "stripe_price_id" VARCHAR(255)
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD COLUMN IF NOT EXISTS "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);

    // Update plan_type CHECK constraint to match PLAN_DEFINITIONS
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP CONSTRAINT IF EXISTS "subscriptions_plan_type_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD CONSTRAINT "subscriptions_plan_type_check"
      CHECK ("plan_type" IN ('free', 'starter', 'pro', 'team'))
    `);

    // Update status CHECK constraint to full lifecycle set
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP CONSTRAINT IF EXISTS "subscriptions_status_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD CONSTRAINT "subscriptions_status_check"
      CHECK ("status" IN ('active', 'trialing', 'past_due', 'cancelled', 'expired', 'unpaid'))
    `);

    // Unique partial index on stripe_subscription_id (one local record per Stripe subscription)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_subscriptions_stripe_subscription_id"
      ON "subscriptions" ("stripe_subscription_id")
      WHERE "stripe_subscription_id" IS NOT NULL
    `);

    // Partial unique index: one active subscription per user
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_subscriptions_one_active_per_user"
      ON "subscriptions" ("user_id")
      WHERE "status" IN ('active', 'trialing', 'past_due')
    `);

    // Individual indexes for query performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_subscriptions_user_id"
      ON "subscriptions" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_subscriptions_status"
      ON "subscriptions" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_subscriptions_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_subscriptions_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_subscriptions_one_active_per_user"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_subscriptions_stripe_subscription_id"`,
    );

    // Restore original CHECK constraints
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP CONSTRAINT IF EXISTS "subscriptions_status_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD CONSTRAINT "subscriptions_status_check"
      CHECK ("status" IN ('active', 'cancelled', 'past_due'))
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP CONSTRAINT IF EXISTS "subscriptions_plan_type_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD CONSTRAINT "subscriptions_plan_type_check"
      CHECK ("plan_type" IN ('free', 'pro', 'enterprise'))
    `);

    // Drop added columns
    await queryRunner.query(`
      ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "updated_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "created_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "cancelled_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "cancel_at_period_end"
    `);
    await queryRunner.query(`
      ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "stripe_price_id"
    `);

    // Drop FK
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP CONSTRAINT IF EXISTS "fk_subscriptions_user_id"
    `);
  }
}
