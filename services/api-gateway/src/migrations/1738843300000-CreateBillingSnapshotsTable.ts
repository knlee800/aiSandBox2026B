import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: CreateBillingSnapshotsTable
 *
 * Phase 23B-4: Billing Snapshot Writer
 *
 * Creates billing_snapshots table for immutable point-in-time billing records.
 * Snapshots are derived from usage_records (Phase 22) using deterministic pricing.
 *
 * Table characteristics:
 * - Immutable after creation (no updates, no deletes)
 * - Deterministically reproducible from usage_records + pricing version
 * - Point-in-time capture (does not update with new usage)
 * - Write-only (visibility queries in Phase 24B)
 */
export class CreateBillingSnapshotsTable1738843300000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create billing_snapshots table
    await queryRunner.createTable(
      new Table({
        name: 'billing_snapshots',
        columns: [
          {
            name: 'snapshot_id',
            type: 'uuid',
            isPrimary: true,
            comment: 'Unique snapshot identifier (UUID v4)',
          },
          {
            name: 'api_key_id',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'API key identifier (who this bill is for)',
          },
          {
            name: 'user_id',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'User associated with API key',
          },
          {
            name: 'period_start',
            type: 'timestamp',
            isNullable: false,
            comment: 'Period start (UTC, inclusive)',
          },
          {
            name: 'period_end',
            type: 'timestamp',
            isNullable: false,
            comment: 'Period end (UTC, inclusive)',
          },
          {
            name: 'period_type',
            type: 'varchar',
            length: '20',
            isNullable: false,
            comment: 'Period type (daily, monthly, custom)',
          },
          {
            name: 'pricing_version',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'Pricing version used (e.g., 2026-02-v1)',
          },
          {
            name: 'total_tokens',
            type: 'integer',
            isNullable: false,
            default: 0,
            comment: 'Sum of tokens across all line items',
          },
          {
            name: 'total_requests',
            type: 'integer',
            isNullable: false,
            default: 0,
            comment: 'Sum of requests across all line items',
          },
          {
            name: 'subtotal_usd',
            type: 'decimal',
            precision: 10,
            scale: 3,
            isNullable: false,
            default: 0,
            comment: 'Subtotal cost (USD, 3 decimals)',
          },
          {
            name: 'adjustments_usd',
            type: 'decimal',
            precision: 10,
            scale: 3,
            isNullable: false,
            default: 0,
            comment: 'Adjustments (discounts, credits - Phase 24+)',
          },
          {
            name: 'total_cost_usd',
            type: 'decimal',
            precision: 10,
            scale: 3,
            isNullable: false,
            default: 0,
            comment: 'Final total cost (USD, 3 decimals)',
          },
          {
            name: 'line_items',
            type: 'jsonb',
            isNullable: false,
            default: "'[]'",
            comment: 'Breakdown by provider/model (array of line items)',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: "'draft'",
            comment: 'Snapshot status (draft, finalized)',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: 'When snapshot was created (immutable)',
          },
        ],
      }),
      true, // Create table
    );

    // Create index: api_key_id + period_start + period_end (for visibility queries)
    await queryRunner.createIndex(
      'billing_snapshots',
      new TableIndex({
        name: 'idx_billing_snapshots_api_key_period',
        columnNames: ['api_key_id', 'period_start', 'period_end'],
      }),
    );

    // Create index: user_id (for user-level billing queries)
    await queryRunner.createIndex(
      'billing_snapshots',
      new TableIndex({
        name: 'idx_billing_snapshots_user',
        columnNames: ['user_id'],
      }),
    );

    // Create index: created_at (for chronological queries)
    await queryRunner.createIndex(
      'billing_snapshots',
      new TableIndex({
        name: 'idx_billing_snapshots_created_at',
        columnNames: ['created_at'],
      }),
    );

    // Create unique constraint: prevent duplicate snapshots
    await queryRunner.createIndex(
      'billing_snapshots',
      new TableIndex({
        name: 'idx_billing_snapshots_unique_window',
        columnNames: [
          'api_key_id',
          'period_start',
          'period_end',
          'pricing_version',
        ],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex(
      'billing_snapshots',
      'idx_billing_snapshots_unique_window',
    );
    await queryRunner.dropIndex(
      'billing_snapshots',
      'idx_billing_snapshots_created_at',
    );
    await queryRunner.dropIndex(
      'billing_snapshots',
      'idx_billing_snapshots_user',
    );
    await queryRunner.dropIndex(
      'billing_snapshots',
      'idx_billing_snapshots_api_key_period',
    );

    // Drop table
    await queryRunner.dropTable('billing_snapshots');
  }
}
