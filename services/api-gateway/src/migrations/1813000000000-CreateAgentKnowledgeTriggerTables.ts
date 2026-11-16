import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TRIGGER-MORE-01 slice S1 (stage-start section 4: both tables in one
 * migration, as TRIGGER-MAIL-01's 1812).
 *
 * Creates public.agent_knowledge_triggers: an owner's knowledge triggers
 * ("when a file is added to or replaced in this Knowledge folder, start ...").
 * - user_id: the owner (foreign key to users with ON DELETE CASCADE, so the
 *   account's removal removes its triggers).
 * - target_kind: chief-of-staff or workflow (CHECK); workflow_id is set only
 *   for a workflow (CHECK, the same as 1810 to 1812) and has no foreign key,
 *   so a deleted workflow leaves the trigger to be skipped and switched off.
 * - task: the owner's task text, 1 to 7000 characters (CHECK), leaving room
 *   for the lines the platform adds at start (slice S2: up to ten ids).
 * - scope_id: one Knowledge folder id, at most 64 characters as
 *   knowledge_documents.scope_id (CHECK: not empty). The routes accept only
 *   the nine fixed folder ids; no IN list here, so owner-named folders
 *   (KNOW-FOLDERS-01) need no schema change.
 * - time_zone: an IANA name (at most 64 characters).
 * - enabled, armed_at.
 * - created_at, updated_at.
 * Indexes: (user_id); (enabled).
 *
 * Creates public.agent_knowledge_trigger_runs: one row per trigger per
 * document version.
 * - trigger_id: foreign key to agent_knowledge_triggers with ON DELETE
 *   CASCADE, so a deleted trigger deletes its history.
 * - user_id (copied, no foreign key).
 * - document_id: the knowledge document's id (no foreign key, so a deleted
 *   document leaves the history row).
 * - document_key: SHA-256 hex of trigger id, document id and content hash
 *   (stage-start section 4; the content hash itself is not stored).
 * - changed_at (the document's change time), local_date, outcome (claimed,
 *   started or skipped, CHECK), reason, collaboration_run_id, created_at.
 * Unique (trigger_id, document_key): the idempotency key, one start per
 * trigger per document version. Index (user_id, created_at); index
 * (trigger_id, local_date) for the day limit and the row cap.
 * No title, content, content hash, task or result text is stored in the
 * runs table.
 *
 * Timestamp 1813000000000 is after CreateAgentMailTriggerTables1812000000000,
 * the latest before it. up() refuses when either table is already present or
 * users is missing. down() refuses unless both tables are present, then
 * drops agent_knowledge_trigger_runs and agent_knowledge_triggers only (their
 * indexes go with them). down() loses the knowledge triggers and their
 * history only; the documents, the runs and their results stay.
 */
export class CreateAgentKnowledgeTriggerTables1813000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const state = await this.tableState(queryRunner);
    if (state.triggers || state.runs) {
      throw new Error(
        'TRIGGER-MORE-01: public.agent_knowledge_triggers or public.agent_knowledge_trigger_runs already exists. Refusing to create them again.',
      );
    }
    if (!state.users) {
      throw new Error('TRIGGER-MORE-01: public.users is missing. Refusing to create the knowledge trigger tables.');
    }

    await queryRunner.query(`
      CREATE TABLE "public"."agent_knowledge_triggers" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "public"."users"(id) ON DELETE CASCADE,
        "target_kind" varchar(16) NOT NULL CONSTRAINT "chk_agent_knowledge_triggers_target_kind" CHECK ("target_kind" IN ('chief-of-staff', 'workflow')),
        "workflow_id" uuid NULL,
        "task" text NOT NULL CONSTRAINT "chk_agent_knowledge_triggers_task" CHECK (char_length("task") BETWEEN 1 AND 7000),
        "scope_id" varchar(64) NOT NULL CONSTRAINT "chk_agent_knowledge_triggers_scope_id" CHECK (char_length("scope_id") BETWEEN 1 AND 64),
        "time_zone" varchar(64) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "armed_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_agent_knowledge_triggers_workflow_id" CHECK (("target_kind" = 'workflow' AND "workflow_id" IS NOT NULL) OR ("target_kind" = 'chief-of-staff' AND "workflow_id" IS NULL))
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_agent_knowledge_triggers_user_id" ON "public"."agent_knowledge_triggers" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_agent_knowledge_triggers_enabled" ON "public"."agent_knowledge_triggers" ("enabled")',
    );
    await queryRunner.query(`
      CREATE TABLE "public"."agent_knowledge_trigger_runs" (
        "id" uuid PRIMARY KEY,
        "trigger_id" uuid NOT NULL REFERENCES "public"."agent_knowledge_triggers"(id) ON DELETE CASCADE,
        "user_id" uuid NOT NULL,
        "document_id" uuid NOT NULL,
        "document_key" char(64) NOT NULL,
        "changed_at" timestamptz NOT NULL,
        "local_date" date NOT NULL,
        "outcome" varchar(16) NOT NULL CONSTRAINT "chk_agent_knowledge_trigger_runs_outcome" CHECK ("outcome" IN ('claimed', 'started', 'skipped')),
        "reason" varchar(32) NULL,
        "collaboration_run_id" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_agent_knowledge_trigger_runs_trigger_id_document_key" ON "public"."agent_knowledge_trigger_runs" ("trigger_id", "document_key")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_agent_knowledge_trigger_runs_user_id_created_at" ON "public"."agent_knowledge_trigger_runs" ("user_id", "created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_agent_knowledge_trigger_runs_trigger_id_local_date" ON "public"."agent_knowledge_trigger_runs" ("trigger_id", "local_date")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const state = await this.tableState(queryRunner);
    if (!state.triggers || !state.runs) {
      throw new Error(
        'TRIGGER-MORE-01 down(): public.agent_knowledge_triggers and public.agent_knowledge_trigger_runs are not both present.',
      );
    }

    await queryRunner.query('DROP TABLE "public"."agent_knowledge_trigger_runs"');
    await queryRunner.query('DROP TABLE "public"."agent_knowledge_triggers"');
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
            AND table_name = 'agent_knowledge_triggers'
        ) AS "agent_knowledge_triggers_exists",
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'agent_knowledge_trigger_runs'
        ) AS "agent_knowledge_trigger_runs_exists",
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'users'
        ) AS "users_exists"
    `);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('TRIGGER-MORE-01: could not read knowledge trigger table state.');
    }
    const row = rows[0] as {
      agent_knowledge_triggers_exists?: unknown;
      agent_knowledge_trigger_runs_exists?: unknown;
      users_exists?: unknown;
    };
    return {
      triggers: readFlag(row.agent_knowledge_triggers_exists),
      runs: readFlag(row.agent_knowledge_trigger_runs_exists),
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
  throw new Error('TRIGGER-MORE-01: could not read knowledge trigger table state.');
}
