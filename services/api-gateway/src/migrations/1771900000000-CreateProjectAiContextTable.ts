import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectAiContextTable1771900000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_ai_context" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL UNIQUE REFERENCES "projects"("id") ON DELETE CASCADE,
        "project_instructions" text NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_project_ai_context_project_id"
      ON "project_ai_context" ("project_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_project_ai_context_project_id"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "project_ai_context"
    `);
  }
}
