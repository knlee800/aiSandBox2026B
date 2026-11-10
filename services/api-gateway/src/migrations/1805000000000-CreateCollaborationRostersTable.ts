import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * COS-FRONTDOOR-01 slice 01A, stage-start D8
 *
 * Creates one table, public.collaboration_rosters: one row per owner, the
 * ordered member ids the Chief of Staff may hand work to, and the time of the
 * last save. user_id is the primary key and goes with the user (the
 * user_entitlements pattern). No other index, no backfill: an owner with no
 * row has an empty roster.
 *
 * Timestamp 1805000000000 is after AddCollaborationRunResultSeenAt1804000000000.
 * up() refuses when the table is already present. down() refuses unless it is
 * present, then drops only that table. down() loses only the saved rosters.
 */
export class CreateCollaborationRostersTable1805000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await this.rostersTableExists(queryRunner)) {
      throw new Error(
        [
          'COS-FRONTDOOR-01: public.collaboration_rosters already exists.',
          'Refusing to create it again.',
        ].join(' '),
      );
    }

    await queryRunner.query(`
      CREATE TABLE "public"."collaboration_rosters" (
        "user_id" uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        "member_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.rostersTableExists(queryRunner))) {
      throw new Error(
        'COS-FRONTDOOR-01 down(): public.collaboration_rosters does not exist.',
      );
    }

    await queryRunner.query('DROP TABLE "public"."collaboration_rosters"');
  }

  private async rostersTableExists(queryRunner: QueryRunner): Promise<boolean> {
    const rows = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'collaboration_rosters'
      ) AS "table_exists"
    `);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('COS-FRONTDOOR-01: could not read collaboration_rosters table state.');
    }
    const value = (rows[0] as { table_exists?: unknown }).table_exists;
    if (value === true || value === 't' || value === 'true' || value === 1 || value === '1') {
      return true;
    }
    if (value === false || value === 'f' || value === 'false' || value === 0 || value === '0') {
      return false;
    }
    throw new Error('COS-FRONTDOOR-01: could not read collaboration_rosters table state.');
  }
}
