import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PRIVATE-BETA-STAGING-EXECUTION-04J Step 6A: Add projects.slug column.
 *
 * Sequence: nullable add → backfill from name → deduplicate → set NOT NULL → index.
 * No permanent default. No empty-string slugs.
 *
 * Backfill logic (pure PostgreSQL):
 *   1. lowercase name
 *   2. replace non-alphanumeric groups with '-'
 *   3. trim leading/trailing '-'
 *   4. fallback to project id::text if result is empty
 *   5. deduplicate by appending '-<n>' to collisions (ordered by created_at)
 */
export class AddProjectSlug1772600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add nullable slug column
    await queryRunner.query(
      `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "slug" character varying`,
    );

    // Step 2: Backfill slug from name for rows where slug is NULL
    await queryRunner.query(`
      UPDATE "projects"
      SET "slug" = CASE
        WHEN TRIM(BOTH '-' FROM regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')) = ''
        THEN "id"::text
        ELSE TRIM(BOTH '-' FROM regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'))
      END
      WHERE "slug" IS NULL
    `);

    // Step 3: Deduplicate — append '-<n>' suffix for collisions
    await queryRunner.query(`
      WITH dupes AS (
        SELECT "id", "slug",
          ROW_NUMBER() OVER (PARTITION BY "slug" ORDER BY "created_at", "id") AS rn
        FROM "projects"
      )
      UPDATE "projects" p
      SET "slug" = d."slug" || '-' || d.rn
      FROM dupes d
      WHERE p."id" = d."id" AND d.rn > 1
    `);

    // Step 4: Set NOT NULL after all rows have non-empty slugs
    await queryRunner.query(
      `ALTER TABLE "projects" ALTER COLUMN "slug" SET NOT NULL`,
    );

    // Step 5: Create index
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_projects_slug" ON "projects" ("slug")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_projects_slug"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP COLUMN IF EXISTS "slug"`,
    );
  }
}
