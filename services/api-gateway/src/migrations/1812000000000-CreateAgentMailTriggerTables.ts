import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TRIGGER-MAIL-01 slice S2 (stage-start section 2: both tables in one
 * migration, as TRIGGER-EVENT-01's 1811).
 *
 * Creates public.agent_mail_triggers: an owner's mail triggers ("when new
 * unread mail from this sender arrives in my Inbox, start ...").
 * - user_id: the owner (foreign key to users with ON DELETE CASCADE, so the
 *   account's removal removes its triggers).
 * - target_kind: chief-of-staff or workflow (CHECK); workflow_id is set only
 *   for a workflow (CHECK, the same as 1810 and 1811) and has no foreign key,
 *   so a deleted workflow leaves the trigger to be skipped and switched off.
 * - task: the owner's task text, 1 to 7500 characters (CHECK), leaving room
 *   for the lines the platform adds at start (slice S3).
 * - sender_filter: required owner text, at most 254 characters: a full
 *   address, or @ and a domain (CHECK: at least 4 characters and an @; the
 *   routes check the full rule).
 * - subject_filter: optional owner text, at most 100 characters; null means
 *   any subject from that sender.
 * - time_zone: an IANA name (at most 64 characters).
 * - enabled, armed_at.
 * - mail_state: ok, connector_missing or read_failed (CHECK), default ok;
 *   mail_state_at: when it last changed (null until slice S3 sets it).
 * - created_at, updated_at.
 * Indexes: (user_id); (enabled).
 *
 * Creates public.agent_mail_trigger_runs: one row per trigger per message.
 * - trigger_id: foreign key to agent_mail_triggers with ON DELETE CASCADE,
 *   so a deleted trigger deletes its history.
 * - user_id (copied, no foreign key).
 * - message_key: SHA-256 hex of trigger id, the mailbox's UIDVALIDITY and
 *   the message's UID (stage-start section 4; neither raw value is stored).
 * - arrived_at (the server's arrival time), local_date, outcome (claimed,
 *   started or skipped, CHECK), reason, collaboration_run_id, created_at.
 * Unique (trigger_id, message_key): the idempotency key, one start per
 * trigger per message. Index (user_id, created_at); index
 * (trigger_id, local_date) for the day limit and the row cap.
 * No sender, subject, body, task, filter or result text is stored in the
 * runs table.
 *
 * Timestamp 1812000000000 is after CreateAgentEventTriggerTables1811000000000,
 * the latest before it. up() refuses when either table is already present or
 * users is missing. down() refuses unless both tables are present, then
 * drops agent_mail_trigger_runs and agent_mail_triggers only (their indexes
 * go with them). down() loses the mail triggers and their history only; the
 * runs and their results stay.
 */
export class CreateAgentMailTriggerTables1812000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const state = await this.tableState(queryRunner);
    if (state.triggers || state.runs) {
      throw new Error(
        'TRIGGER-MAIL-01: public.agent_mail_triggers or public.agent_mail_trigger_runs already exists. Refusing to create them again.',
      );
    }
    if (!state.users) {
      throw new Error('TRIGGER-MAIL-01: public.users is missing. Refusing to create the mail trigger tables.');
    }

    await queryRunner.query(`
      CREATE TABLE "public"."agent_mail_triggers" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "public"."users"(id) ON DELETE CASCADE,
        "target_kind" varchar(16) NOT NULL CONSTRAINT "chk_agent_mail_triggers_target_kind" CHECK ("target_kind" IN ('chief-of-staff', 'workflow')),
        "workflow_id" uuid NULL,
        "task" text NOT NULL CONSTRAINT "chk_agent_mail_triggers_task" CHECK (char_length("task") BETWEEN 1 AND 7500),
        "sender_filter" varchar(254) NOT NULL CONSTRAINT "chk_agent_mail_triggers_sender_filter" CHECK (char_length("sender_filter") BETWEEN 4 AND 254 AND strpos("sender_filter", '@') > 0),
        "subject_filter" varchar(100) NULL,
        "time_zone" varchar(64) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "armed_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "mail_state" varchar(32) NOT NULL DEFAULT 'ok' CONSTRAINT "chk_agent_mail_triggers_mail_state" CHECK ("mail_state" IN ('ok', 'connector_missing', 'read_failed')),
        "mail_state_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_agent_mail_triggers_workflow_id" CHECK (("target_kind" = 'workflow' AND "workflow_id" IS NOT NULL) OR ("target_kind" = 'chief-of-staff' AND "workflow_id" IS NULL))
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_agent_mail_triggers_user_id" ON "public"."agent_mail_triggers" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_agent_mail_triggers_enabled" ON "public"."agent_mail_triggers" ("enabled")',
    );
    await queryRunner.query(`
      CREATE TABLE "public"."agent_mail_trigger_runs" (
        "id" uuid PRIMARY KEY,
        "trigger_id" uuid NOT NULL REFERENCES "public"."agent_mail_triggers"(id) ON DELETE CASCADE,
        "user_id" uuid NOT NULL,
        "message_key" char(64) NOT NULL,
        "arrived_at" timestamptz NOT NULL,
        "local_date" date NOT NULL,
        "outcome" varchar(16) NOT NULL CONSTRAINT "chk_agent_mail_trigger_runs_outcome" CHECK ("outcome" IN ('claimed', 'started', 'skipped')),
        "reason" varchar(32) NULL,
        "collaboration_run_id" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_agent_mail_trigger_runs_trigger_id_message_key" ON "public"."agent_mail_trigger_runs" ("trigger_id", "message_key")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_agent_mail_trigger_runs_user_id_created_at" ON "public"."agent_mail_trigger_runs" ("user_id", "created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_agent_mail_trigger_runs_trigger_id_local_date" ON "public"."agent_mail_trigger_runs" ("trigger_id", "local_date")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const state = await this.tableState(queryRunner);
    if (!state.triggers || !state.runs) {
      throw new Error(
        'TRIGGER-MAIL-01 down(): public.agent_mail_triggers and public.agent_mail_trigger_runs are not both present.',
      );
    }

    await queryRunner.query('DROP TABLE "public"."agent_mail_trigger_runs"');
    await queryRunner.query('DROP TABLE "public"."agent_mail_triggers"');
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
            AND table_name = 'agent_mail_triggers'
        ) AS "agent_mail_triggers_exists",
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'agent_mail_trigger_runs'
        ) AS "agent_mail_trigger_runs_exists",
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'users'
        ) AS "users_exists"
    `);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('TRIGGER-MAIL-01: could not read mail trigger table state.');
    }
    const row = rows[0] as {
      agent_mail_triggers_exists?: unknown;
      agent_mail_trigger_runs_exists?: unknown;
      users_exists?: unknown;
    };
    return {
      triggers: readFlag(row.agent_mail_triggers_exists),
      runs: readFlag(row.agent_mail_trigger_runs_exists),
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
  throw new Error('TRIGGER-MAIL-01: could not read mail trigger table state.');
}
