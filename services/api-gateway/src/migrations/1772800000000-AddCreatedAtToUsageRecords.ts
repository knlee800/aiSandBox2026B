import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreatedAtToUsageRecords1772800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE usage_records
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE
    `);

    await queryRunner.query(`
      UPDATE usage_records
      SET created_at = "timestamp"
      WHERE created_at IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE usage_records
      ALTER COLUMN created_at SET DEFAULT now()
    `);

    await queryRunner.query(`
      ALTER TABLE usage_records
      ALTER COLUMN created_at SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE usage_records
      DROP COLUMN IF EXISTS created_at
    `);
  }
}
