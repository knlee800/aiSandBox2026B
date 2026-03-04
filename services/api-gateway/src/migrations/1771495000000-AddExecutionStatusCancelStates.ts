import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddExecutionStatusCancelStates Migration
 *
 * Phase 47.1: Ledger Cancel State
 *
 * Extends execution_status allowed values for cancellation flow:
 * - cancel_requested: Client requested cancellation, worker should abort
 * - cancelled: Execution was aborted by worker
 *
 * State machine:
 *   pending → running → completed
 *   pending → running → failed
 *   running → cancel_requested → cancelled
 *
 * Does NOT modify existing columns. Only adds CHECK constraint
 * to explicitly allow the new values.
 */
export class AddExecutionStatusCancelStates1771495000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE usage_records
      ADD CONSTRAINT chk_usage_records_execution_status
      CHECK (execution_status IN (
        'pending',
        'running',
        'completed',
        'failed',
        'timeout',
        'cancel_requested',
        'cancelled'
      ))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE usage_records
      DROP CONSTRAINT IF EXISTS chk_usage_records_execution_status
    `);
  }
}
