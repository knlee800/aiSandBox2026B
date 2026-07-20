import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AGENT-PLATFORM-CREATE-01A: Create user_agents table.
 *
 * Per design doc: docs/AGENT-PLATFORM-CREATE-01A-STAGE-START.md Section 15.
 * FK to users(id) with ON DELETE CASCADE.
 * Partial composite index on (user_id, status) WHERE deleted_at IS NULL.
 */
export class CreateUserAgentsTable1772500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_agents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "name" VARCHAR(100) NOT NULL,
        "role" VARCHAR(200) NOT NULL,
        "description" TEXT NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'active',
        "initials" VARCHAR(4) NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMP NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_user_agents_user_id" ON "user_agents" ("user_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_user_agents_status" ON "user_agents" ("status")`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_user_agents_user_id_status" ON "user_agents" ("user_id", "status") WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_user_agents_user_id_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_user_agents_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_user_agents_user_id"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "user_agents"`,
    );
  }
}
