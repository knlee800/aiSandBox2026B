import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-03-01: Add projects table and nullable sessions.project_id association.
 */
export class AddProjectsAndSessionProjectId1771587000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "projects" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" character varying(120) NOT NULL,
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_projects_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_projects_user_id" ON "projects" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_projects_updated_at" ON "projects" ("updated_at")`,
    );

    await queryRunner.query(
      `ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "project_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sessions_project_id" ON "sessions" ("project_id")`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'fk_sessions_project_id'
        ) THEN
          ALTER TABLE "sessions"
          ADD CONSTRAINT "fk_sessions_project_id"
          FOREIGN KEY ("project_id")
          REFERENCES "projects"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "fk_sessions_project_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_sessions_project_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP COLUMN IF EXISTS "project_id"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_projects_updated_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_projects_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "projects"`);
  }
}
