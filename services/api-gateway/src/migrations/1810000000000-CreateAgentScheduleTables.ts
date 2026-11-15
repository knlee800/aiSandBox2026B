import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TRIGGER-01 slice S1 (stage-start section 2, Keith's Q11: one migration for
 * both tables).
 *
 * Creates public.agent_schedules: an owner's schedules.
 * - user_id: the owner (foreign key to users with ON DELETE CASCADE, so the
 *   account's removal removes its schedules).
 * - target_kind: chief-of-staff or workflow (CHECK); workflow_id is set only
 *   for a workflow (CHECK) and has no foreign key, so a deleted workflow
 *   leaves the schedule to be skipped and switched off with a reason.
 * - task: the owner's task text, 1 to 8000 characters (CHECK).
 * - time_of_day: minutes after local midnight, 0 to 1439 (CHECK).
 * - days: bit mask Monday = 1 ... Sunday = 64, 1 to 127 (CHECK).
 * - time_zone: an IANA name (at most 64 characters).
 * - enabled, armed_at, created_at, updated_at.
 * Indexes: (user_id); (enabled).
 *
 * Creates public.agent_schedule_runs: one row per schedule per local day.
 * - schedule_id: foreign key to agent_schedules with ON DELETE CASCADE, so a
 *   deleted schedule deletes its history.
 * - user_id (copied, no foreign key), local_date, outcome (claimed, started
 *   or skipped, CHECK), reason, collaboration_run_id, created_at.
 * Unique (schedule_id, local_date): the idempotency key, one start per
 * schedule per local day. Index (user_id, created_at).
 * No task or result text is stored in the runs table.
 *
 * Timestamp 1810000000000 is after CreateChatRunDeliveries1809000000000, the
 * latest before it. up() refuses when either table is already present or
 * users is missing. down() refuses unless both tables are present, then
 * drops agent_schedule_runs and agent_schedules only (their indexes go with
 * them). down() loses the schedules and their history only; the runs and
 * their results stay.
 */
export class CreateAgentScheduleTables1810000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const state = await this.tableState(queryRunner);
    if (state.schedules || state.runs) {
      throw new Error(
        'TRIGGER-01: public.agent_schedules or public.agent_schedule_runs already exists. Refusing to create them again.',
      );
    }
    if (!state.users) {
      throw new Error('TRIGGER-01: public.users is missing. Refusing to create the schedule tables.');
    }

    await queryRunner.query(`
      CREATE TABLE "public"."agent_schedules" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "public"."users"(id) ON DELETE CASCADE,
        "target_kind" varchar(16) NOT NULL CONSTRAINT "chk_agent_schedules_target_kind" CHECK ("target_kind" IN ('chief-of-staff', 'workflow')),
        "workflow_id" uuid NULL,
        "task" text NOT NULL CONSTRAINT "chk_agent_schedules_task" CHECK (char_length("task") BETWEEN 1 AND 8000),
        "time_of_day" smallint NOT NULL CONSTRAINT "chk_agent_schedules_time_of_day" CHECK ("time_of_day" BETWEEN 0 AND 1439),
        "days" smallint NOT NULL CONSTRAINT "chk_agent_schedules_days" CHECK ("days" BETWEEN 1 AND 127),
        "time_zone" varchar(64) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "armed_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_agent_schedules_workflow_id" CHECK (("target_kind" = 'workflow' AND "workflow_id" IS NOT NULL) OR ("target_kind" = 'chief-of-staff' AND "workflow_id" IS NULL))
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_agent_schedules_user_id" ON "public"."agent_schedules" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_agent_schedules_enabled" ON "public"."agent_schedules" ("enabled")',
    );
    await queryRunner.query(`
      CREATE TABLE "public"."agent_schedule_runs" (
        "id" uuid PRIMARY KEY,
        "schedule_id" uuid NOT NULL REFERENCES "public"."agent_schedules"(id) ON DELETE CASCADE,
        "user_id" uuid NOT NULL,
        "local_date" date NOT NULL,
        "outcome" varchar(16) NOT NULL CONSTRAINT "chk_agent_schedule_runs_outcome" CHECK ("outcome" IN ('claimed', 'started', 'skipped')),
        "reason" varchar(32) NULL,
        "collaboration_run_id" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_agent_schedule_runs_schedule_id_local_date" ON "public"."agent_schedule_runs" ("schedule_id", "local_date")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_agent_schedule_runs_user_id_created_at" ON "public"."agent_schedule_runs" ("user_id", "created_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const state = await this.tableState(queryRunner);
    if (!state.schedules || !state.runs) {
      throw new Error(
        'TRIGGER-01 down(): public.agent_schedules and public.agent_schedule_runs are not both present.',
      );
    }

    await queryRunner.query('DROP TABLE "public"."agent_schedule_runs"');
    await queryRunner.query('DROP TABLE "public"."agent_schedules"');
  }

  private async tableState(
    queryRunner: QueryRunner,
  ): Promise<{ schedules: boolean; runs: boolean; users: boolean }> {
    const rows = await queryRunner.query(`
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'agent_schedules'
        ) AS "agent_schedules_exists",
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'agent_schedule_runs'
        ) AS "agent_schedule_runs_exists",
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'users'
        ) AS "users_exists"
    `);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('TRIGGER-01: could not read schedule table state.');
    }
    const row = rows[0] as {
      agent_schedules_exists?: unknown;
      agent_schedule_runs_exists?: unknown;
      users_exists?: unknown;
    };
    return {
      schedules: readFlag(row.agent_schedules_exists),
      runs: readFlag(row.agent_schedule_runs_exists),
      users: readFlag(row.users_exists),
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
  throw new Error('TRIGGER-01: could not read schedule table state.');
}
