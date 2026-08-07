import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminGrantAuditColumns1772900000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "credit_grants"
      ADD COLUMN IF NOT EXISTS "granted_by_user_id" uuid;
    `);

    await queryRunner.query(`
      ALTER TABLE "credit_grants"
      ADD COLUMN IF NOT EXISTS "reason" TEXT;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_credit_grants_granted_by"
      ON "credit_grants" ("granted_by_user_id")
      WHERE "granted_by_user_id" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_credit_grants_granted_by";`,
    );

    await queryRunner.query(`
      ALTER TABLE "credit_grants"
      DROP COLUMN IF EXISTS "reason";
    `);

    await queryRunner.query(`
      ALTER TABLE "credit_grants"
      DROP COLUMN IF EXISTS "granted_by_user_id";
    `);
  }
}
