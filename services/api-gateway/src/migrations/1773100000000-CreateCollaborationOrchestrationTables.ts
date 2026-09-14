import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AGENT-PLATFORM-ORCH-PERSIST-01
 *
 * Additive create of public.collaboration_runs and public.collaboration_referrals
 * for durable Gateway orchestration coordinator state.
 *
 * Timestamp 1773100000000 is after AddInternalAccessToApiKeys1773000000000.
 * Audit remains in-memory; this migration must not create an audit table.
 *
 * Existing-table policy: fail closed with an actionable diagnostic if either
 * table already exists. Do not use CREATE TABLE IF NOT EXISTS. Do not silently
 * adopt an unknown table. Provenance is TypeORM migration history plus the
 * refusal to adopt a pre-existing relation.
 *
 * Rollback: dropping populated collaboration tables is data-loss, not harmless.
 * down() requires the runner's open transaction, takes ACCESS EXCLUSIVE NOWAIT
 * on both tables, then refuses DROP when either table has rows. This class does
 * not commit or roll back the QueryRunner transaction.
 */
export class CreateCollaborationOrchestrationTables1773100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const runsExisting = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'collaboration_runs'
      ) AS "table_exists"
    `);
    const referralsExisting = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'collaboration_referrals'
      ) AS "table_exists"
    `);

    const runsExist =
      CreateCollaborationOrchestrationTables1773100000000.tableExists(
        runsExisting,
      );
    const referralsExist =
      CreateCollaborationOrchestrationTables1773100000000.tableExists(
        referralsExisting,
      );

    if (runsExist || referralsExist) {
      const present = [
        runsExist ? 'public.collaboration_runs' : null,
        referralsExist ? 'public.collaboration_referrals' : null,
      ]
        .filter((name): name is string => name !== null)
        .join(' and ');
      throw new Error(
        [
          `AGENT-PLATFORM-ORCH-PERSIST-01: ${present} already exists.`,
          'Refusing to adopt an unknown table.',
          "CREATE TABLE IF NOT EXISTS is forbidden here so a pre-existing relation cannot be recorded as this migration's create.",
          'Inspect before retrying:',
          `  SELECT table_name FROM information_schema.tables`,
          `    WHERE table_schema = 'public'`,
          `      AND table_name IN ('collaboration_runs','collaboration_referrals');`,
          `  SELECT column_name, data_type, column_default, is_nullable`,
          `    FROM information_schema.columns`,
          `    WHERE table_schema = 'public'`,
          `      AND table_name IN ('collaboration_runs','collaboration_referrals')`,
          `    ORDER BY table_name, ordinal_position;`,
        ].join(' '),
      );
    }

    await queryRunner.query(`
      CREATE TABLE "public"."collaboration_runs" (
        "collaboration_run_id" text NOT NULL,
        "user_id" text NOT NULL,
        "project_id" text NOT NULL,
        "initiator_agent_role" text NOT NULL,
        "initiator_builder_profile_id" text NOT NULL,
        "orchestration_mode" text NOT NULL,
        "status" text NOT NULL,
        "referral_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "active_builder_profile_ids" jsonb NOT NULL,
        "timeout_ms" integer NOT NULL,
        "created_at" timestamptz NOT NULL,
        "updated_at" timestamptz NOT NULL,
        "completed_at" timestamptz NULL,
        "failed_at" timestamptz NULL,
        "timed_out_at" timestamptz NULL,
        "cancel_requested_at" timestamptz NULL,
        "cancelled_by_user_id" text NULL,
        "cancel_reason" text NULL,
        CONSTRAINT "collaboration_runs_pkey" PRIMARY KEY ("collaboration_run_id"),
        CONSTRAINT "chk_collaboration_runs_status"
          CHECK ("status" IN ('active','completed','failed','cancelled','timed_out')),
        CONSTRAINT "chk_collaboration_runs_mode"
          CHECK ("orchestration_mode" = 'read_only')
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_collaboration_runs_user_id" ON "public"."collaboration_runs" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collaboration_runs_status" ON "public"."collaboration_runs" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "public"."collaboration_referrals" (
        "referral_id" text NOT NULL,
        "collaboration_run_id" text NOT NULL,
        "referral_trace_id" text NOT NULL,
        "parent_referral_trace_id" text NULL,
        "source_agent_role" text NOT NULL,
        "source_builder_profile_id" text NOT NULL,
        "target_agent_role" text NOT NULL,
        "target_builder_profile_id" text NOT NULL,
        "status" text NOT NULL,
        "cancel_status" text NOT NULL,
        "idempotency_key" text NOT NULL,
        "referral_chain" jsonb NOT NULL,
        "depth" integer NOT NULL,
        "max_depth" integer NOT NULL,
        "visited_builder_profile_ids" jsonb NOT NULL,
        "timeout_ms" integer NOT NULL,
        "constraint_timeout_ms" integer NOT NULL,
        "constraint_max_depth" integer NOT NULL,
        "constraint_max_agents_per_collaboration" integer NOT NULL,
        "constraint_read_only" boolean NOT NULL,
        "constraint_allow_write_tools" boolean NOT NULL,
        "constraint_allowed_tools" jsonb NOT NULL,
        "execution_id" text NULL,
        "result_status" text NULL,
        "result_summary" text NULL,
        "result_output_files" jsonb NULL,
        "result_duration_ms" integer NULL,
        "created_at" timestamptz NOT NULL,
        "updated_at" timestamptz NOT NULL,
        "completed_at" timestamptz NULL,
        "failed_at" timestamptz NULL,
        "timed_out_at" timestamptz NULL,
        "cancel_requested_at" timestamptz NULL,
        "cancelled_by_user_id" text NULL,
        "cancel_reason" text NULL,
        CONSTRAINT "collaboration_referrals_pkey" PRIMARY KEY ("referral_id"),
        CONSTRAINT "chk_collaboration_referrals_status"
          CHECK ("status" IN ('pending_approval','approved','in_progress','completed','failed','cancelled','timed_out','rejected')),
        CONSTRAINT "chk_collaboration_referrals_cancel_status"
          CHECK ("cancel_status" IN ('not_requested','requested','cancelled','rejected')),
        CONSTRAINT "chk_collaboration_referrals_read_only"
          CHECK ("constraint_read_only" = true),
        CONSTRAINT "chk_collaboration_referrals_allow_write_tools"
          CHECK ("constraint_allow_write_tools" = false),
        CONSTRAINT "chk_collaboration_referrals_result_status"
          CHECK ("result_status" IS NULL OR "result_status" IN ('success','partial','failed')),
        CONSTRAINT "fk_collaboration_referrals_run"
          FOREIGN KEY ("collaboration_run_id") REFERENCES "public"."collaboration_runs"("collaboration_run_id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_collaboration_referrals_trace_id" ON "public"."collaboration_referrals" ("referral_trace_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collaboration_referrals_run_id" ON "public"."collaboration_referrals" ("collaboration_run_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collaboration_referrals_parent_trace" ON "public"."collaboration_referrals" ("parent_referral_trace_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collaboration_referrals_status" ON "public"."collaboration_referrals" ("status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_collaboration_referrals_idempotency_active" ON "public"."collaboration_referrals" ("collaboration_run_id", "idempotency_key") WHERE "status" NOT IN ('failed','cancelled','timed_out')`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_collaboration_referrals_execution_id" ON "public"."collaboration_referrals" ("execution_id") WHERE "execution_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    CreateCollaborationOrchestrationTables1773100000000.assertActiveTransaction(
      queryRunner,
    );

    await queryRunner.query(
      `LOCK TABLE "public"."collaboration_referrals", "public"."collaboration_runs" IN ACCESS EXCLUSIVE MODE NOWAIT`,
    );

    const referralCounts = await queryRunner.query(`
      SELECT COUNT(*)::int AS "row_count" FROM "public"."collaboration_referrals"
    `);
    const runCounts = await queryRunner.query(`
      SELECT COUNT(*)::int AS "row_count" FROM "public"."collaboration_runs"
    `);
    const referralRowCount =
      CreateCollaborationOrchestrationTables1773100000000.parseRowCount(
        referralCounts,
        'collaboration_referrals',
      );
    const runRowCount =
      CreateCollaborationOrchestrationTables1773100000000.parseRowCount(
        runCounts,
        'collaboration_runs',
      );

    if (referralRowCount > 0 || runRowCount > 0) {
      const populated = [
        referralRowCount > 0
          ? `public.collaboration_referrals (${referralRowCount} rows)`
          : null,
        runRowCount > 0
          ? `public.collaboration_runs (${runRowCount} rows)`
          : null,
      ]
        .filter((name): name is string => name !== null)
        .join(' and ');
      throw new Error(
        [
          `AGENT-PLATFORM-ORCH-PERSIST-01 down(): refusing to DROP populated ${populated}.`,
          'Dropping populated collaboration tables is data-loss, not a harmless rollback.',
          'Restore from a verified snapshot, or obtain explicit authorization to destroy orchestration rows.',
          'Provenance is TypeORM migration history, not the absence of IF EXISTS.',
          'This class does not commit or roll back the QueryRunner transaction.',
        ].join(' '),
      );
    }

    await queryRunner.query(
      `DROP INDEX "public"."uq_collaboration_referrals_execution_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_collaboration_referrals_idempotency_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collaboration_referrals_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collaboration_referrals_parent_trace"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collaboration_referrals_run_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_collaboration_referrals_trace_id"`,
    );
    await queryRunner.query(`DROP TABLE "public"."collaboration_referrals"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_collaboration_runs_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collaboration_runs_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "public"."collaboration_runs"`);
  }

  private static assertActiveTransaction(queryRunner: QueryRunner): void {
    if (queryRunner.isTransactionActive !== true) {
      throw new Error(
        [
          'AGENT-PLATFORM-ORCH-PERSIST-01 down(): no active QueryRunner transaction.',
          'Refusing rollback SQL so ACCESS EXCLUSIVE cannot be taken or released outside the runner-owned transaction.',
          'This class does not start, commit, or roll back that transaction.',
        ].join(' '),
      );
    }
  }

  private static tableExists(rows: unknown): boolean {
    if (!Array.isArray(rows) || rows.length === 0) {
      return false;
    }
    const value = (rows[0] as { table_exists?: unknown }).table_exists;
    return (
      value === true ||
      value === 't' ||
      value === 'true' ||
      value === 1 ||
      value === '1'
    );
  }

  /**
   * Empty-table is only number 0 or a canonical digit string "0".
   * Number(null), Number(''), and Number(false) are 0 and must not pass.
   */
  private static parseRowCount(
    rows: unknown,
    tableName: 'collaboration_runs' | 'collaboration_referrals',
  ): number {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(
        `AGENT-PLATFORM-ORCH-PERSIST-01 down(): could not read ${tableName} row count; aborting DROP.`,
      );
    }
    if (!Object.prototype.hasOwnProperty.call(rows[0], 'row_count')) {
      throw new Error(
        'AGENT-PLATFORM-ORCH-PERSIST-01 down(): row_count missing from count result; aborting DROP.',
      );
    }
    const value = (rows[0] as { row_count: unknown }).row_count;
    if (typeof value === 'number') {
      if (!Number.isInteger(value) || value < 0 || Object.is(value, -0)) {
        throw new Error(
          `AGENT-PLATFORM-ORCH-PERSIST-01 down(): invalid ${tableName} row count; aborting DROP.`,
        );
      }
      return value;
    }
    if (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) {
      return Number.parseInt(value, 10);
    }
    throw new Error(
      `AGENT-PLATFORM-ORCH-PERSIST-01 down(): invalid ${tableName} row count; aborting DROP.`,
    );
  }
}
