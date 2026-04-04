import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADV-05-01: Add projects.visibility with private-by-default semantics.
 */
export class AddProjectVisibility1771592000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "visibility" character varying(16) NOT NULL DEFAULT 'private'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_projects_visibility" ON "projects" ("visibility")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_projects_visibility"`);
    await queryRunner.query(
      `ALTER TABLE "projects" DROP COLUMN IF EXISTS "visibility"`,
    );
  }
}
