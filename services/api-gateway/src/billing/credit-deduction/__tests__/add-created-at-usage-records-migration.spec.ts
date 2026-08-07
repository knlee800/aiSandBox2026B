import { AddCreatedAtToUsageRecords1772800000000 } from '../../../migrations/1772800000000-AddCreatedAtToUsageRecords';

describe('AddCreatedAtToUsageRecords migration', () => {
  let migration: AddCreatedAtToUsageRecords1772800000000;
  let executedQueries: string[];
  let mockQueryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new AddCreatedAtToUsageRecords1772800000000();
    executedQueries = [];
    mockQueryRunner = {
      query: jest.fn((sql: string) => {
        executedQueries.push(sql.trim());
        return Promise.resolve();
      }),
    };
  });

  describe('up()', () => {
    beforeEach(async () => {
      await migration.up(mockQueryRunner as any);
    });

    it('executes exactly four queries in the required order', () => {
      expect(executedQueries).toHaveLength(4);
      expect(executedQueries[0]).toContain('ADD COLUMN IF NOT EXISTS');
      expect(executedQueries[1]).toContain('UPDATE usage_records');
      expect(executedQueries[2]).toContain('SET DEFAULT now()');
      expect(executedQueries[3]).toContain('SET NOT NULL');
    });

    it('adds created_at using IF NOT EXISTS and TIMESTAMP type', () => {
      const addColumnSql = executedQueries[0];
      expect(addColumnSql).toContain('ADD COLUMN IF NOT EXISTS');
      expect(addColumnSql).toContain('created_at');
      expect(addColumnSql).toContain('TIMESTAMP WITHOUT TIME ZONE');
    });

    it('backfills only null created_at rows from "timestamp"', () => {
      const updateSql = executedQueries[1];
      expect(updateSql).toContain('UPDATE usage_records');
      expect(updateSql).toContain('SET created_at = "timestamp"');
      expect(updateSql).toContain('WHERE created_at IS NULL');
    });

    it('sets DEFAULT now() for created_at', () => {
      const defaultSql = executedQueries[2];
      expect(defaultSql).toContain('ALTER TABLE usage_records');
      expect(defaultSql).toContain('ALTER COLUMN created_at SET DEFAULT now()');
    });

    it('enforces NOT NULL on created_at', () => {
      const notNullSql = executedQueries[3];
      expect(notNullSql).toContain('ALTER TABLE usage_records');
      expect(notNullSql).toContain('ALTER COLUMN created_at SET NOT NULL');
    });

    it('does not perform destructive/unrelated operations during up', () => {
      const allUpSql = executedQueries.join('\n').toUpperCase();
      expect(allUpSql).not.toContain('DELETE');
      expect(allUpSql).not.toContain('TRUNCATE');
      expect(allUpSql).not.toContain('DROP TABLE');
      expect(allUpSql).not.toContain('DROP COLUMN');
    });
  });

  describe('down()', () => {
    beforeEach(async () => {
      await migration.down(mockQueryRunner as any);
    });

    it('executes exactly one query', () => {
      expect(executedQueries).toHaveLength(1);
    });

    it('drops created_at with IF EXISTS', () => {
      const downSql = executedQueries[0];
      expect(downSql).toContain('DROP COLUMN IF EXISTS created_at');
    });

    it('touches only usage_records.created_at in down', () => {
      const downSql = executedQueries[0].replace(/\s+/g, ' ').trim();
      expect(downSql).toBe(
        'ALTER TABLE usage_records DROP COLUMN IF EXISTS created_at',
      );
    });
  });
});
