import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddExecutionStatusToUsageRecords Migration
 *
 * Phase 43B-2A: Two-Phase Execution Record
 *
 * Changes:
 * 1. Add execution_status column (default: 'pending')
 * 2. Make model column nullable (not known until AI completes)
 * 3. Make tokens_used column nullable (not known until AI completes)
 * 4. Make execution_duration_ms column nullable (not known until AI completes)
 *
 * Purpose:
 * - Enable write-before-call pattern (execution intent)
 * - Prevent lost revenue when AI succeeds but ledger write fails
 * - Support execution status tracking (pending → completed)
 *
 * Backward Compatibility:
 * - Existing records get execution_status = 'completed' (already successful)
 * - Existing records have non-null model, tokens_used, execution_duration_ms
 * - New records start as 'pending', updated to 'completed' after AI success
 */
export class AddExecutionStatusToUsageRecords1740355300000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add execution_status column with default 'completed' for existing records
    await queryRunner.query(`
      ALTER TABLE usage_records 
      ADD COLUMN execution_status VARCHAR(20) DEFAULT 'completed' NOT NULL
    `);

    // Make model nullable (not known until AI execution completes)
    await queryRunner.query(`
      ALTER TABLE usage_records 
      ALTER COLUMN model DROP NOT NULL
    `);

    // Make tokens_used nullable (not known until AI execution completes)
    await queryRunner.query(`
      ALTER TABLE usage_records 
      ALTER COLUMN tokens_used DROP NOT NULL
    `);

    // Make execution_duration_ms nullable (not known until AI execution completes)
    await queryRunner.query(`
      ALTER TABLE usage_records 
      ALTER COLUMN execution_duration_ms DROP NOT NULL
    `);

    // Change default for new records to 'pending' (write-before-call)
    await queryRunner.query(`
      ALTER TABLE usage_records 
      ALTER COLUMN execution_status SET DEFAULT 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert execution_status column
    await queryRunner.query(`
      ALTER TABLE usage_records 
      DROP COLUMN execution_status
    `);

    // Revert model to NOT NULL (delete records with NULL model first)
    await queryRunner.query(`
      DELETE FROM usage_records WHERE model IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE usage_records 
      ALTER COLUMN model SET NOT NULL
    `);

    // Revert tokens_used to NOT NULL (delete records with NULL tokens_used first)
    await queryRunner.query(`
      DELETE FROM usage_records WHERE tokens_used IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE usage_records 
      ALTER COLUMN tokens_used SET NOT NULL
    `);

    // Revert execution_duration_ms to NOT NULL (delete records with NULL execution_duration_ms first)
    await queryRunner.query(`
      DELETE FROM usage_records WHERE execution_duration_ms IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE usage_records 
      ALTER COLUMN execution_duration_ms SET NOT NULL
    `);
  }
}
