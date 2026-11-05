import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ACCESS-01B: Per-user entitlements. One row per user.
 * user_id cascades with the user. updated_by has no foreign key.
 * No seed. down() drops the table, and the foreign key and CHECK with it.
 */
export class CreateUserEntitlementsTable1801000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_entitlements" (
        "user_id" uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        "harness_enabled" boolean NOT NULL DEFAULT false,
        "agent_write_enabled" boolean NOT NULL DEFAULT false,
        "plan_override" varchar(50) NULL,
        "daily_token_limit_override" integer NULL,
        "updated_by" uuid NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK ("daily_token_limit_override" IS NULL OR "daily_token_limit_override" > 0)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_entitlements"`);
  }
}
