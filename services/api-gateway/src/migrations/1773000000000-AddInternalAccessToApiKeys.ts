import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInternalAccessToApiKeys1773000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "api_keys"
      ADD COLUMN IF NOT EXISTS "is_internal" BOOLEAN NOT NULL DEFAULT FALSE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "api_keys"
      DROP COLUMN IF EXISTS "is_internal";
    `);
  }
}
