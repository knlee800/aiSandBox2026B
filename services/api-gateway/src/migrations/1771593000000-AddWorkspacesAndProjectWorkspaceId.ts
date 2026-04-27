import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkspacesAndProjectWorkspaceId1771593000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspaces" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "name" character varying(120) NOT NULL,
        "slug" character varying(120) NOT NULL,
        "is_default" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'fk_workspaces_user_id'
        ) THEN
          ALTER TABLE "workspaces"
          ADD CONSTRAINT "fk_workspaces_user_id"
          FOREIGN KEY ("user_id")
          REFERENCES "users"("id")
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_workspaces_user_id_slug"
      ON "workspaces" ("user_id", "slug")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workspaces_user_id"
      ON "workspaces" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workspaces_user_id_is_default"
      ON "workspaces" ("user_id", "is_default")
    `);

    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN IF NOT EXISTS "workspace_id" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_projects_workspace_id"
      ON "projects" ("workspace_id")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'fk_projects_workspace_id'
        ) THEN
          ALTER TABLE "projects"
          ADD CONSTRAINT "fk_projects_workspace_id"
          FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      INSERT INTO "workspaces" ("user_id", "name", "slug", "is_default")
      SELECT
        u."id",
        'Personal',
        'personal',
        true
      FROM "users" u
      WHERE NOT EXISTS (
        SELECT 1
        FROM "workspaces" w
        WHERE w."user_id" = u."id"
          AND w."is_default" = true
      )
      ON CONFLICT ("user_id", "slug")
      DO UPDATE
      SET "name" = EXCLUDED."name",
          "is_default" = true,
          "updated_at" = now()
    `);

    await queryRunner.query(`
      UPDATE "projects" AS p
      SET "workspace_id" = w."id"
      FROM "workspaces" AS w
      WHERE p."user_id" = w."user_id"
        AND p."workspace_id" IS NULL
        AND w."is_default" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "fk_projects_workspace_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_projects_workspace_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "projects" DROP COLUMN IF EXISTS "workspace_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workspaces_user_id_is_default"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workspaces_user_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_workspaces_user_id_slug"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "workspaces"
    `);
  }
}
