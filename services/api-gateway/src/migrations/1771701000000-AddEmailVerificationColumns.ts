import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerificationColumns1771701000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "verification_tokens"
      ADD COLUMN IF NOT EXISTS "locale" character varying(10) NOT NULL DEFAULT 'en'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verified"
    `);

    await queryRunner.query(`
      ALTER TABLE "verification_tokens" DROP COLUMN IF EXISTS "locale"
    `);
  }
}
