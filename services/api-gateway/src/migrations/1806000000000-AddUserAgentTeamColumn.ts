import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * USER-TEAMS-01 slice 01A (stage-start D1)
 *
 * Adds public.user_agents.team_member_ids: the ids of the agents a user
 * workflow may hand one bounded question to (its team). Existing rows take
 * the default, an empty team, and run exactly as before. No row is updated,
 * deleted or rewritten.
 *
 * Timestamp 1806000000000 is after CreateCollaborationRostersTable1805000000000.
 * up() refuses when the column already exists. down() refuses when it is
 * absent, then drops exactly that column. Teams stored in it are lost on
 * down(); nothing else is.
 */
const TEAM_COLUMN = 'team_member_ids';

export class AddUserAgentTeamColumn1806000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await this.columnPresent(queryRunner)) {
      throw new Error(
        `USER-TEAMS-01: user_agents.${TEAM_COLUMN} already exists. Refusing to add it again.`,
      );
    }

    await queryRunner.query(
      [
        'ALTER TABLE "public"."user_agents"',
        `  ADD COLUMN "${TEAM_COLUMN}" jsonb NOT NULL DEFAULT '[]'::jsonb`,
      ].join('\n'),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.columnPresent(queryRunner))) {
      throw new Error(
        `USER-TEAMS-01 down(): user_agents.${TEAM_COLUMN} does not exist. Refusing to drop it.`,
      );
    }

    await queryRunner.query(
      ['ALTER TABLE "public"."user_agents"', `  DROP COLUMN "${TEAM_COLUMN}"`].join('\n'),
    );
  }

  private async columnPresent(queryRunner: QueryRunner): Promise<boolean> {
    const rows = await queryRunner.query(`
      SELECT COUNT(*) AS "present_columns"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_agents'
        AND column_name = '${TEAM_COLUMN}'
    `);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('USER-TEAMS-01: could not read user_agents team column state.');
    }
    const value = (rows[0] as { present_columns?: unknown }).present_columns;
    const count =
      typeof value === 'string' ? (/^[0-9]+$/.test(value) ? Number(value) : NaN) : value;
    if (count !== 0 && count !== 1) {
      throw new Error('USER-TEAMS-01: could not read user_agents team column state.');
    }
    return count === 1;
  }
}
