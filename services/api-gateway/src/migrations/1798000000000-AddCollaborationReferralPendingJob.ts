import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * COLLAB-GATE-01
 *
 * Adds one nullable jsonb column, public.collaboration_referrals.pending_job,
 * for the hand-off that is waiting for approval.
 *
 * Timestamp 1798000000000 is after CreateCollaborationOrchestrationTables1773100000000.
 * up() refuses when the column is already present. down() drops that column.
 */
export class AddCollaborationReferralPendingJob1798000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await this.pendingJobExists(queryRunner)) {
      throw new Error(
        [
          'COLLAB-GATE-01: public.collaboration_referrals.pending_job already exists.',
          'Refusing to add it again.',
        ].join(' '),
      );
    }

    await queryRunner.query(
      `ALTER TABLE "public"."collaboration_referrals" ADD COLUMN "pending_job" jsonb NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.pendingJobExists(queryRunner))) {
      throw new Error(
        'COLLAB-GATE-01 down(): public.collaboration_referrals.pending_job does not exist.',
      );
    }

    await queryRunner.query(
      `ALTER TABLE "public"."collaboration_referrals" DROP COLUMN "pending_job"`,
    );
  }

  private async pendingJobExists(queryRunner: QueryRunner): Promise<boolean> {
    const rows = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'collaboration_referrals'
          AND column_name = 'pending_job'
      ) AS "column_exists"
    `);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(
        'COLLAB-GATE-01: could not read pending_job column state.',
      );
    }
    const value = (rows[0] as { column_exists?: unknown }).column_exists;
    return (
      value === true ||
      value === 't' ||
      value === 'true' ||
      value === 1 ||
      value === '1'
    );
  }
}
