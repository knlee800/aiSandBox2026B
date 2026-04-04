import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlansFoundation1771589000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "plans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" character varying(50) NOT NULL UNIQUE,
        "name" character varying(120) NOT NULL,
        "max_active_sessions" integer NOT NULL,
        "max_sessions_24h" integer NOT NULL,
        "max_tokens_24h" integer NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_plans_code_unique" ON "plans" ("code")
    `);

    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan_type" character varying(50) NOT NULL DEFAULT 'free'
    `);

    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan_status" character varying(20) NOT NULL DEFAULT 'active'
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "plan_type" = COALESCE(NULLIF("plan_type", ''), 'free'),
          "plan_status" = COALESCE(NULLIF("plan_status", ''), 'active')
    `);

    await queryRunner.query(`
      INSERT INTO "plans" ("code", "name", "max_active_sessions", "max_sessions_24h", "max_tokens_24h", "is_active")
      VALUES
        ('free', 'Free', 5, 20, 100000, true),
        ('pro', 'Pro', 15, 100, 500000, true)
      ON CONFLICT ("code") DO UPDATE
      SET "name" = EXCLUDED."name",
          "max_active_sessions" = EXCLUDED."max_active_sessions",
          "max_sessions_24h" = EXCLUDED."max_sessions_24h",
          "max_tokens_24h" = EXCLUDED."max_tokens_24h",
          "is_active" = EXCLUDED."is_active"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "plan_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "plan_status"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_plans_code_unique"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "plans"
    `);
  }
}
