import { MigrationInterface, QueryRunner } from 'typeorm';

// Frozen migration-time snapshot of MONTHLY_CREDIT_ALLOCATIONS.
export const FROZEN_MONTHLY_CREDIT_ALLOCATIONS = {
  free: 500,
  starter: 5000,
  pro: 25000,
  team: 100000,
} as const;

export class BackfillCreditBalancesForExistingUsers1772700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "credit_balances" (
        "id",
        "owner_id",
        "owner_type",
        "plan_id",
        "balance",
        "monthly_allocation",
        "rollover_balance",
        "status",
        "period_start",
        "period_end",
        "reset_at",
        "created_at",
        "updated_at"
      )
      SELECT
        gen_random_uuid(),
        u."id"::text,
        'user',
        u."plan_type",
        CASE u."plan_type"
          WHEN 'free' THEN 500
          WHEN 'starter' THEN 5000
          WHEN 'pro' THEN 25000
          WHEN 'team' THEN 100000
        END,
        CASE u."plan_type"
          WHEN 'free' THEN 500
          WHEN 'starter' THEN 5000
          WHEN 'pro' THEN 25000
          WHEN 'team' THEN 100000
        END,
        0,
        'active',
        date_trunc('month', now() AT TIME ZONE 'UTC'),
        date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month',
        NULL,
        now(),
        now()
      FROM "users" u
      WHERE u."is_active" = true
        AND u."role" IN ('user', 'beta')
        AND u."plan_type" IN ('free', 'starter', 'pro', 'team')
        AND NOT EXISTS (
          SELECT 1
          FROM "credit_balances" cb
          WHERE cb."owner_id" = u."id"::text
            AND cb."owner_type" = 'user'
        )
      ON CONFLICT ("owner_id", "owner_type") DO NOTHING
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Irreversible data migration — intentionally no-op.
    //
    // Backfilled credit_balances rows may later receive grants, deductions,
    // plan changes, or cross billing periods, and there is no persistent
    // migration provenance to identify untouched rows safely.
    //
    // Any correction requires a separately reviewed and approval-gated
    // data-fix procedure.
  }
}
