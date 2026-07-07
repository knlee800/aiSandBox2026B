import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BILLING-READY-03B: Create credit_balances and credit_deduction_records tables.
 *
 * Per design doc: docs/BILLING-READY-03A-SCHEMA-PERSISTENCE-DESIGN.md Section 6.
 * No foreign keys to existing tables (loose coupling via ownerId value matching).
 */
export class CreateCreditBalanceAndDeductionTables1772100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "credit_balances" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "owner_id" VARCHAR(50) NOT NULL,
        "owner_type" VARCHAR(20) NOT NULL DEFAULT 'user',
        "plan_id" VARCHAR(50) NOT NULL DEFAULT 'free',
        "balance" INTEGER NOT NULL DEFAULT 0,
        "monthly_allocation" INTEGER NOT NULL DEFAULT 0,
        "rollover_balance" INTEGER NOT NULL DEFAULT 0,
        "status" VARCHAR(20) NOT NULL DEFAULT 'active',
        "period_start" TIMESTAMP NOT NULL,
        "period_end" TIMESTAMP NOT NULL,
        "reset_at" TIMESTAMP NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_credit_balances_balance_non_negative" CHECK ("balance" >= 0),
        CONSTRAINT "chk_credit_balances_period_valid" CHECK ("period_start" < "period_end")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "credit_deduction_records" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "owner_id" VARCHAR(50) NOT NULL,
        "source_event_id" VARCHAR(255) NOT NULL,
        "source_event_type" VARCHAR(50) NOT NULL,
        "agent_id" VARCHAR(100) NULL,
        "session_id" uuid NULL,
        "execution_id" uuid NULL,
        "model_id" VARCHAR(100) NULL,
        "requested_credits" INTEGER NOT NULL DEFAULT 0,
        "applied_credits" INTEGER NOT NULL DEFAULT 0,
        "overflow_credits" INTEGER NOT NULL DEFAULT 0,
        "balance_before" INTEGER NOT NULL,
        "balance_after" INTEGER NOT NULL,
        "line_items" JSONB NOT NULL DEFAULT '[]',
        "metadata" JSONB NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'applied',
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_credit_deduction_records_credits_non_negative"
          CHECK ("requested_credits" >= 0 AND "applied_credits" >= 0 AND "overflow_credits" >= 0),
        CONSTRAINT "chk_credit_deduction_records_balance_consistency"
          CHECK ("balance_before" >= "balance_after")
      )
    `);

    // credit_balances indexes
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_credit_balances_owner"
      ON "credit_balances" ("owner_id", "owner_type")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_credit_balances_status"
      ON "credit_balances" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_credit_balances_reset_at"
      ON "credit_balances" ("reset_at") WHERE "reset_at" IS NOT NULL
    `);

    // credit_deduction_records indexes
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_credit_deduction_records_source_event"
      ON "credit_deduction_records" ("source_event_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_credit_deduction_records_owner_created"
      ON "credit_deduction_records" ("owner_id", "created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_credit_deduction_records_owner_status"
      ON "credit_deduction_records" ("owner_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_credit_deduction_records_session"
      ON "credit_deduction_records" ("session_id") WHERE "session_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_credit_deduction_records_execution"
      ON "credit_deduction_records" ("execution_id") WHERE "execution_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_credit_deduction_records_created_at"
      ON "credit_deduction_records" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_credit_deduction_records_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_credit_deduction_records_execution"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_credit_deduction_records_session"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_credit_deduction_records_owner_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_credit_deduction_records_owner_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_credit_deduction_records_source_event"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_credit_balances_reset_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_credit_balances_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_credit_balances_owner"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "credit_deduction_records"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "credit_balances"`,
    );
  }
}
