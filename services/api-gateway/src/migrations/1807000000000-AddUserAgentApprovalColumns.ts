import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * APPROVAL-SET-01 slice 01A (stage-start D1, D2; DECISION A)
 *
 * Adds two columns to public.user_agents: how a workflow's hand-offs are
 * approved.
 * - approval_mode: 'every' (default; every hand-off waits, today's
 *   behaviour), 'credits' or 'read_only'. A CHECK keeps any other value out.
 * - approval_credit_limit: the credit amount for 'credits', else NULL. A
 *   CHECK keeps it at 1 or more, like the budgets.
 * Existing rows take 'every' and NULL and run exactly as before. No row is
 * updated, deleted or rewritten. Nothing reads the columns at run time until
 * APPROVAL-SET-01B.
 *
 * Timestamp 1807000000000 is after AddUserAgentTeamColumn1806000000000.
 * up() refuses when either column already exists. down() refuses unless both
 * exist, then drops exactly those two columns; each CHECK constraint belongs
 * to its column and goes with it. Approval settings stored in them are lost
 * on down(); nothing else is.
 */
const APPROVAL_COLUMNS = ['approval_mode', 'approval_credit_limit'] as const;

export class AddUserAgentApprovalColumns1807000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const present = await this.presentColumnCount(queryRunner);
    if (present !== 0) {
      throw new Error(
        `APPROVAL-SET-01: ${present} of the user_agents approval columns already exist. Refusing to add them again.`,
      );
    }

    await queryRunner.query(
      [
        'ALTER TABLE "public"."user_agents"',
        '  ADD COLUMN "approval_mode" varchar(16) NOT NULL DEFAULT \'every\' CONSTRAINT "chk_user_agents_approval_mode" CHECK ("approval_mode" IN (\'every\', \'credits\', \'read_only\')),',
        '  ADD COLUMN "approval_credit_limit" integer NULL CONSTRAINT "chk_user_agents_approval_credit_limit" CHECK ("approval_credit_limit" IS NULL OR "approval_credit_limit" >= 1)',
      ].join('\n'),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const present = await this.presentColumnCount(queryRunner);
    if (present !== APPROVAL_COLUMNS.length) {
      throw new Error(
        `APPROVAL-SET-01 down(): ${present} of the ${APPROVAL_COLUMNS.length} user_agents approval columns exist. Refusing to drop them.`,
      );
    }

    await queryRunner.query(
      [
        'ALTER TABLE "public"."user_agents"',
        APPROVAL_COLUMNS.map((column) => `  DROP COLUMN "${column}"`).join(',\n'),
      ].join('\n'),
    );
  }

  private async presentColumnCount(queryRunner: QueryRunner): Promise<number> {
    const names = APPROVAL_COLUMNS.map((column) => `'${column}'`).join(', ');
    const rows = await queryRunner.query(`
      SELECT COUNT(*) AS "present_columns"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_agents'
        AND column_name IN (${names})
    `);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('APPROVAL-SET-01: could not read user_agents approval column state.');
    }
    const value = (rows[0] as { present_columns?: unknown }).present_columns;
    const count =
      typeof value === 'string' ? (/^[0-9]+$/.test(value) ? Number(value) : NaN) : value;
    if (count !== 0 && count !== 1 && count !== 2) {
      throw new Error('APPROVAL-SET-01: could not read user_agents approval column state.');
    }
    return count;
  }
}
