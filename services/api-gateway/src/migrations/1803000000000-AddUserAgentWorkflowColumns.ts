import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BIZ-USER-01A
 *
 * Adds the workflow spec, access, model, budget and template columns to
 * public.user_agents. Existing rows take the defaults and stay valid
 * profiles. No row is updated, deleted or rewritten.
 *
 * Timestamp 1803000000000 is after CreateConnectorConnectionsTable1802000000000.
 * up() refuses unless none of the twelve columns exists. down() refuses
 * unless all twelve exist, then drops exactly those columns; each CHECK
 * constraint belongs to its column and goes with it. Data stored in these
 * columns is lost on down().
 */
const USER_AGENT_WORKFLOW_COLUMNS = [
  'tone',
  'reply_language',
  'purpose',
  'procedure',
  'result',
  'tool_profile',
  'knowledge_scope_ids',
  'connector_tool_ids',
  'model',
  'budget_per_run_credits',
  'budget_per_day_credits',
  'template_id',
] as const;

export class AddUserAgentWorkflowColumns1803000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const present = await this.presentColumnCount(queryRunner);
    if (present !== 0) {
      throw new Error(
        [
          `BIZ-USER-01A: ${present} of the user_agents workflow columns already exist.`,
          'Refusing to add them again.',
        ].join(' '),
      );
    }

    await queryRunner.query(
      [
        'ALTER TABLE "public"."user_agents"',
        '  ADD COLUMN "tone" varchar(120) NULL,',
        '  ADD COLUMN "reply_language" varchar(8) NULL CONSTRAINT "chk_user_agents_reply_language" CHECK ("reply_language" IS NULL OR "reply_language" IN (\'owner\', \'en\', \'zh-TW\', \'zh-CN\')),',
        '  ADD COLUMN "purpose" text NOT NULL DEFAULT \'\',',
        '  ADD COLUMN "procedure" text NOT NULL DEFAULT \'\',',
        '  ADD COLUMN "result" text NOT NULL DEFAULT \'\',',
        '  ADD COLUMN "tool_profile" varchar(8) NOT NULL DEFAULT \'read\' CONSTRAINT "chk_user_agents_tool_profile" CHECK ("tool_profile" IN (\'read\', \'review\', \'write\')),',
        '  ADD COLUMN "knowledge_scope_ids" jsonb NOT NULL DEFAULT \'[]\'::jsonb,',
        '  ADD COLUMN "connector_tool_ids" jsonb NOT NULL DEFAULT \'[]\'::jsonb,',
        '  ADD COLUMN "model" jsonb NOT NULL DEFAULT \'{"choice":"server"}\'::jsonb,',
        '  ADD COLUMN "budget_per_run_credits" integer NULL CONSTRAINT "chk_user_agents_budget_per_run_credits" CHECK ("budget_per_run_credits" IS NULL OR "budget_per_run_credits" >= 1),',
        '  ADD COLUMN "budget_per_day_credits" integer NULL CONSTRAINT "chk_user_agents_budget_per_day_credits" CHECK ("budget_per_day_credits" IS NULL OR "budget_per_day_credits" >= 1),',
        '  ADD COLUMN "template_id" varchar(64) NULL',
      ].join('\n'),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const present = await this.presentColumnCount(queryRunner);
    if (present !== USER_AGENT_WORKFLOW_COLUMNS.length) {
      throw new Error(
        [
          `BIZ-USER-01A down(): ${present} of the ${USER_AGENT_WORKFLOW_COLUMNS.length}`,
          'user_agents workflow columns exist. Refusing to drop them.',
        ].join(' '),
      );
    }

    await queryRunner.query(
      [
        'ALTER TABLE "public"."user_agents"',
        USER_AGENT_WORKFLOW_COLUMNS.map((column) => `  DROP COLUMN "${column}"`).join(',\n'),
      ].join('\n'),
    );
  }

  private async presentColumnCount(queryRunner: QueryRunner): Promise<number> {
    const names = USER_AGENT_WORKFLOW_COLUMNS.map((column) => `'${column}'`).join(', ');
    const rows = await queryRunner.query(`
      SELECT COUNT(*) AS "present_columns"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_agents'
        AND column_name IN (${names})
    `);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('BIZ-USER-01A: could not read user_agents workflow column state.');
    }
    const value = (rows[0] as { present_columns?: unknown }).present_columns;
    const count = typeof value === 'string' ? Number(value) : value;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      throw new Error('BIZ-USER-01A: could not read user_agents workflow column state.');
    }
    return count;
  }
}
