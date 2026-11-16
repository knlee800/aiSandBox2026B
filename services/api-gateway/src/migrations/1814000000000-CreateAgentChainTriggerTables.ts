import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TRIGGER-CHAIN-01 slice S1 (stage-start section 4: both tables in one
 * migration, as TRIGGER-MORE-01's 1813).
 *
 * Creates public.agent_chain_triggers: an owner's chain triggers ("when one of
 * my workflows completes a run, start the Chief of Staff or another of my
 * workflows").
 * - user_id: the owner (foreign key to users with ON DELETE CASCADE, so the
 *   account's removal removes its triggers).
 * - source_workflow_id: one of the owner's own workflows (the routes check
 *   it); no foreign key, so a deleted workflow leaves the trigger to be
 *   skipped and switched off (slice S2).
 * - target_kind: chief-of-staff or workflow (CHECK); workflow_id, the target,
 *   is set only for a workflow (CHECK, the same as 1810 to 1813) and has no
 *   foreign key. The target is never the source (CHECK).
 * - task: the owner's task text, 1 to 7000 characters (CHECK), leaving room
 *   for the lines the platform adds at start (slice S2: a run id and a time).
 * - time_zone: an IANA name (at most 64 characters).
 * - enabled, armed_at.
 * - created_at, updated_at.
 * Indexes: (user_id); (enabled).
 *
 * Creates public.agent_chain_trigger_runs: one row per trigger per finished
 * source run.
 * - trigger_id: foreign key to agent_chain_triggers with ON DELETE CASCADE,
 *   so a deleted trigger deletes its history.
 * - user_id (copied, no foreign key).
 * - source_run_id: the finished run's id (collaboration_runs.id is text; 1 to
 *   128 characters, CHECK; no foreign key, so a removed run leaves the row).
 * - source_completed_at (the finished run's completion time), local_date,
 *   depth (at least 1, CHECK), outcome (claimed, started or skipped, CHECK),
 *   reason, collaboration_run_id (the started run), created_at.
 * Unique (trigger_id, source_run_id): the idempotency key, one start per
 * trigger per finished run. Index (user_id, created_at); index (trigger_id,
 * local_date) for the day limit and the row cap; index
 * (collaboration_run_id) for the depth lookup.
 * No task, answer, workflow name or result text is stored in the runs table.
 *
 * Timestamp 1814000000000 is after CreateAgentKnowledgeTriggerTables1813000000000,
 * the latest before it. up() refuses when either table is already present or
 * users is missing. down() refuses unless both tables are present, then drops
 * agent_chain_trigger_runs and agent_chain_triggers only (their indexes go
 * with them). down() loses the chain triggers and their history only; the
 * workflows, the runs and their results stay.
 */
export class CreateAgentChainTriggerTables1814000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const state = await this.tableState(queryRunner);
    if (state.triggers || state.runs) {
      throw new Error(
        'TRIGGER-CHAIN-01: public.agent_chain_triggers or public.agent_chain_trigger_runs already exists. Refusing to create them again.',
      );
    }
    if (!state.users) {
      throw new Error('TRIGGER-CHAIN-01: public.users is missing. Refusing to create the chain trigger tables.');
    }

    await queryRunner.query(`
      CREATE TABLE "public"."agent_chain_triggers" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "public"."users"(id) ON DELETE CASCADE,
        "source_workflow_id" uuid NOT NULL,
        "target_kind" varchar(16) NOT NULL CONSTRAINT "chk_agent_chain_triggers_target_kind" CHECK ("target_kind" IN ('chief-of-staff', 'workflow')),
        "workflow_id" uuid NULL,
        "task" text NOT NULL CONSTRAINT "chk_agent_chain_triggers_task" CHECK (char_length("task") BETWEEN 1 AND 7000),
        "time_zone" varchar(64) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "armed_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_agent_chain_triggers_workflow_id" CHECK (("target_kind" = 'workflow' AND "workflow_id" IS NOT NULL) OR ("target_kind" = 'chief-of-staff' AND "workflow_id" IS NULL)),
        CONSTRAINT "chk_agent_chain_triggers_not_same_workflow" CHECK ("workflow_id" IS NULL OR "source_workflow_id" <> "workflow_id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_agent_chain_triggers_user_id" ON "public"."agent_chain_triggers" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_agent_chain_triggers_enabled" ON "public"."agent_chain_triggers" ("enabled")',
    );
    await queryRunner.query(`
      CREATE TABLE "public"."agent_chain_trigger_runs" (
        "id" uuid PRIMARY KEY,
        "trigger_id" uuid NOT NULL REFERENCES "public"."agent_chain_triggers"(id) ON DELETE CASCADE,
        "user_id" uuid NOT NULL,
        "source_run_id" text NOT NULL CONSTRAINT "chk_agent_chain_trigger_runs_source_run_id" CHECK (char_length("source_run_id") BETWEEN 1 AND 128),
        "source_completed_at" timestamptz NOT NULL,
        "local_date" date NOT NULL,
        "depth" integer NOT NULL CONSTRAINT "chk_agent_chain_trigger_runs_depth" CHECK ("depth" >= 1),
        "outcome" varchar(16) NOT NULL CONSTRAINT "chk_agent_chain_trigger_runs_outcome" CHECK ("outcome" IN ('claimed', 'started', 'skipped')),
        "reason" varchar(32) NULL,
        "collaboration_run_id" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_agent_chain_trigger_runs_trigger_id_source_run_id" ON "public"."agent_chain_trigger_runs" ("trigger_id", "source_run_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_agent_chain_trigger_runs_user_id_created_at" ON "public"."agent_chain_trigger_runs" ("user_id", "created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_agent_chain_trigger_runs_trigger_id_local_date" ON "public"."agent_chain_trigger_runs" ("trigger_id", "local_date")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_agent_chain_trigger_runs_collaboration_run_id" ON "public"."agent_chain_trigger_runs" ("collaboration_run_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const state = await this.tableState(queryRunner);
    if (!state.triggers || !state.runs) {
      throw new Error(
        'TRIGGER-CHAIN-01 down(): public.agent_chain_triggers and public.agent_chain_trigger_runs are not both present.',
      );
    }

    await queryRunner.query('DROP TABLE "public"."agent_chain_trigger_runs"');
    await queryRunner.query('DROP TABLE "public"."agent_chain_triggers"');
  }

  private async tableState(
    queryRunner: QueryRunner,
  ): Promise<{ triggers: boolean; runs: boolean; users: boolean }> {
    const rows = await queryRunner.query(`
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'agent_chain_triggers'
        ) AS "agent_chain_triggers_exists",
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'agent_chain_trigger_runs'
        ) AS "agent_chain_trigger_runs_exists",
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'users'
        ) AS "users_exists"
    `);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('TRIGGER-CHAIN-01: could not read chain trigger table state.');
    }
    const row = rows[0] as {
      agent_chain_triggers_exists?: unknown;
      agent_chain_trigger_runs_exists?: unknown;
      users_exists?: unknown;
    };
    return {
      triggers: readFlag(row.agent_chain_triggers_exists),
      runs: readFlag(row.agent_chain_trigger_runs_exists),
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
  throw new Error('TRIGGER-CHAIN-01: could not read chain trigger table state.');
}
