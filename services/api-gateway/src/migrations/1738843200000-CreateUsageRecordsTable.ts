import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: CreateUsageRecordsTable
 *
 * Phase 22B: Usage Ledger
 *
 * Creates usage_records table for immutable, success-only execution ledger.
 * Supports future billing, analytics, and reporting.
 *
 * Table characteristics:
 * - Append-only (no updates, no deletes)
 * - Success-only (failed executions not recorded)
 * - Immutable records (write-once)
 */
export class CreateUsageRecordsTable1738843200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create usage_records table
    await queryRunner.createTable(
      new Table({
        name: 'usage_records',
        columns: [
          {
            name: 'execution_id',
            type: 'uuid',
            isPrimary: true,
            comment: 'Unique execution identifier (UUID v4)',
          },
          {
            name: 'api_key_id',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'API key identifier (not the key value)',
          },
          {
            name: 'user_id',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'Verified user identifier from Phase 20A',
          },
          {
            name: 'session_id',
            type: 'uuid',
            isNullable: false,
            comment: 'Session identifier',
          },
          {
            name: 'conversation_id',
            type: 'uuid',
            isNullable: false,
            comment: 'Conversation identifier',
          },
          {
            name: 'provider',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'AI provider (e.g., anthropic, openai, stub)',
          },
          {
            name: 'adapter',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'Adapter identifier (e.g., claude-stub, anthropic-http)',
          },
          {
            name: 'model',
            type: 'varchar',
            length: '100',
            isNullable: false,
            comment:
              'AI model identifier (e.g., claude-3-5-sonnet-20241022, gpt-4)',
          },
          {
            name: 'tokens_used',
            type: 'integer',
            isNullable: false,
            comment: 'Actual tokens consumed (from ai-service)',
          },
          {
            name: 'execution_duration_ms',
            type: 'integer',
            isNullable: false,
            comment: 'Execution duration in milliseconds',
          },
          {
            name: 'timestamp',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: 'Execution completion timestamp (UTC)',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            comment: 'Optional metadata (reserved for future use)',
          },
        ],
      }),
      true, // Create table
    );

    // Create index: api_key_id + timestamp (for billing queries)
    await queryRunner.createIndex(
      'usage_records',
      new TableIndex({
        name: 'idx_usage_records_api_key_timestamp',
        columnNames: ['api_key_id', 'timestamp'],
      }),
    );

    // Create index: user_id + timestamp (for user reporting)
    await queryRunner.createIndex(
      'usage_records',
      new TableIndex({
        name: 'idx_usage_records_user_timestamp',
        columnNames: ['user_id', 'timestamp'],
      }),
    );

    // Create index: timestamp (for time-range queries)
    await queryRunner.createIndex(
      'usage_records',
      new TableIndex({
        name: 'idx_usage_records_timestamp',
        columnNames: ['timestamp'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex(
      'usage_records',
      'idx_usage_records_timestamp',
    );
    await queryRunner.dropIndex(
      'usage_records',
      'idx_usage_records_user_timestamp',
    );
    await queryRunner.dropIndex(
      'usage_records',
      'idx_usage_records_api_key_timestamp',
    );

    // Drop table
    await queryRunner.dropTable('usage_records');
  }
}
