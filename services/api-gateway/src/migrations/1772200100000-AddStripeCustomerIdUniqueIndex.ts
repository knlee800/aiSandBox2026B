import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BILLING-READY-05B: Add unique partial index on users.stripe_customer_id.
 *
 * Prevents two users from sharing the same Stripe customer ID.
 * Partial: WHERE stripe_customer_id IS NOT NULL (allows multiple NULLs for free/admin/beta users).
 *
 * No data mutation. No provider API calls.
 */
export class AddStripeCustomerIdUniqueIndex1772200100000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_stripe_customer_id"
      ON "users" ("stripe_customer_id")
      WHERE "stripe_customer_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_users_stripe_customer_id"`,
    );
  }
}
