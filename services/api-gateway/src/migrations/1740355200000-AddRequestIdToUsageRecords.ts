import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Migration: AddRequestIdToUsageRecords
 *
 * Phase 43A-2A: Usage Records Idempotency - Schema Migration
 *
 * Adds request_id column to usage_records table for client-provided idempotency key.
 * Enables idempotent retries to prevent duplicate billing records.
 *
 * Changes:
 * - Add request_id column (varchar(100), nullable)
 * - Add UNIQUE constraint on (user_id, request_id) WHERE request_id IS NOT NULL
 *
 * Backward compatibility:
 * - Column is nullable (existing rows will have NULL request_id)
 * - UNIQUE constraint allows multiple NULLs (PostgreSQL behavior)
 * - No breaking changes to existing code
 */
export class AddRequestIdToUsageRecords1740355200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add request_id column (nullable for backward compatibility)
    await queryRunner.addColumn(
      'usage_records',
      new TableColumn({
        name: 'request_id',
        type: 'varchar',
        length: '100',
        isNullable: true,
        comment: 'Client-provided idempotency key (Phase 43A-2A)',
      }),
    );

    // Create partial UNIQUE index on (user_id, request_id)
    // WHERE clause allows multiple NULLs (idempotency only for non-NULL request_id)
    // PostgreSQL syntax: CREATE UNIQUE INDEX ... WHERE request_id IS NOT NULL
    await queryRunner.createIndex(
      'usage_records',
      new TableIndex({
        name: 'idx_usage_records_user_request_id',
        columnNames: ['user_id', 'request_id'],
        isUnique: true,
        where: 'request_id IS NOT NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.dropIndex(
      'usage_records',
      'idx_usage_records_user_request_id',
    );

    // Drop column
    await queryRunner.dropColumn('usage_records', 'request_id');
  }
}
