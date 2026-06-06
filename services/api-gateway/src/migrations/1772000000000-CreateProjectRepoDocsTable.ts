import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectRepoDocsTable1772000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_repo_docs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "path" text NOT NULL,
        "mode" text NOT NULL DEFAULT 'always',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_project_repo_docs_project_id_path" UNIQUE ("project_id", "path"),
        CONSTRAINT "chk_project_repo_docs_mode_always" CHECK ("mode" IN ('always'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_project_repo_docs_project_id"
      ON "project_repo_docs" ("project_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_project_repo_docs_project_id"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "project_repo_docs"
    `);
  }
}
