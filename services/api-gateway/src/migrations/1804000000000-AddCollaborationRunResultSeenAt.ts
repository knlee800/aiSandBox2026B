import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RESULTS-01 D5
 *
 * Adds one nullable timestamptz column, public.collaboration_runs.result_seen_at,
 * the time the owner first opened the run's result. NULL means not opened.
 * No index (the user_id index serves the owner-scoped unread count), no
 * default and no backfill: every existing run starts unread.
 *
 * Timestamp 1804000000000 is after AddUserAgentWorkflowColumns1803000000000.
 * up() refuses when the column is already present. down() refuses unless it
 * is present, then drops only that column. down() loses only the seen marks.
 */
export class AddCollaborationRunResultSeenAt1804000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await this.resultSeenAtExists(queryRunner)) {
      throw new Error(
        [
          'RESULTS-01: public.collaboration_runs.result_seen_at already exists.',
          'Refusing to add it again.',
        ].join(' '),
      );
    }

    await queryRunner.query(
      'ALTER TABLE "public"."collaboration_runs" ADD COLUMN "result_seen_at" timestamptz NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.resultSeenAtExists(queryRunner))) {
      throw new Error(
        'RESULTS-01 down(): public.collaboration_runs.result_seen_at does not exist.',
      );
    }

    await queryRunner.query(
      'ALTER TABLE "public"."collaboration_runs" DROP COLUMN "result_seen_at"',
    );
  }

  private async resultSeenAtExists(queryRunner: QueryRunner): Promise<boolean> {
    const rows = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'collaboration_runs'
          AND column_name = 'result_seen_at'
      ) AS "column_exists"
    `);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('RESULTS-01: could not read result_seen_at column state.');
    }
    const value = (rows[0] as { column_exists?: unknown }).column_exists;
    if (value === true || value === 't' || value === 'true' || value === 1 || value === '1') {
      return true;
    }
    if (value === false || value === 'f' || value === 'false' || value === 0 || value === '0') {
      return false;
    }
    throw new Error('RESULTS-01: could not read result_seen_at column state.');
  }
}
