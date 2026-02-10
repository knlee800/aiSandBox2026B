import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

/**
 * Migration: CreateInvoicesTable
 *
 * Phase 25B-1: Invoice Persistence Infrastructure
 *
 * Creates invoices table for immutable invoice records derived from billing_snapshots.
 * Invoices are write-once, derived data only (no billing calculations, no payment logic).
 *
 * Table characteristics:
 * - Immutable after creation (no updates, no deletes)
 * - One-to-one mapping: BillingSnapshot → Invoice (enforced by UNIQUE constraint on snapshot_id)
 * - Derived from billing_snapshots (values copied verbatim)
 * - Status is 'draft' ONLY in Phase 25B-1 (payment states in future phases)
 */
export class CreateInvoicesTable1738900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create invoices table
    await queryRunner.createTable(
      new Table({
        name: 'invoices',
        columns: [
          {
            name: 'invoice_id',
            type: 'uuid',
            isPrimary: true,
            comment: 'Unique invoice identifier (UUID v4)',
          },
          {
            name: 'snapshot_id',
            type: 'uuid',
            isNullable: false,
            isUnique: true,
            comment:
              'FK to billing_snapshots.snapshot_id (one-to-one mapping)',
          },
          {
            name: 'api_key_id',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'API key identifier (who this invoice is for)',
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
            name: 'pricing_version',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'Pricing version used (e.g., 2026-02-v1)',
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
            comment: 'Adjustments (discounts, credits)',
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
            name: 'currency',
            type: 'varchar',
            length: '3',
            isNullable: false,
            default: "'USD'",
            comment: 'Currency code (USD only in Phase 25B-1)',
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
            comment: 'Invoice status (draft ONLY in Phase 25B-1)',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: 'When invoice was created (immutable)',
          },
        ],
      }),
      true, // Create table
    );

    // Create unique index on snapshot_id (enforces one-to-one mapping)
    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'idx_invoices_snapshot_id',
        columnNames: ['snapshot_id'],
        isUnique: true,
      }),
    );

    // Create index: api_key_id + period_start + period_end
    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'idx_invoices_api_key_period',
        columnNames: ['api_key_id', 'period_start', 'period_end'],
      }),
    );

    // Create index: user_id
    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'idx_invoices_user',
        columnNames: ['user_id'],
      }),
    );

    // Create index: created_at
    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'idx_invoices_created_at',
        columnNames: ['created_at'],
      }),
    );

    // Create foreign key: snapshot_id → billing_snapshots.snapshot_id
    await queryRunner.createForeignKey(
      'invoices',
      new TableForeignKey({
        name: 'fk_invoices_snapshot_id',
        columnNames: ['snapshot_id'],
        referencedTableName: 'billing_snapshots',
        referencedColumnNames: ['snapshot_id'],
        onDelete: 'RESTRICT', // Prevent snapshot deletion if invoice exists
        onUpdate: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    await queryRunner.dropForeignKey('invoices', 'fk_invoices_snapshot_id');

    // Drop indexes
    await queryRunner.dropIndex('invoices', 'idx_invoices_created_at');
    await queryRunner.dropIndex('invoices', 'idx_invoices_user');
    await queryRunner.dropIndex('invoices', 'idx_invoices_api_key_period');
    await queryRunner.dropIndex('invoices', 'idx_invoices_snapshot_id');

    // Drop table
    await queryRunner.dropTable('invoices');
  }
}
