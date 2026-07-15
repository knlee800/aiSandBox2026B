import { CreateCreditGrantsTable1772400000000 } from '../../../migrations/1772400000000-CreateCreditGrantsTable';

describe('CreateCreditGrantsTable migration (05E)', () => {
  let migration: CreateCreditGrantsTable1772400000000;
  let executedQueries: string[];

  const mockQueryRunner = {
    query: jest.fn().mockImplementation(async (sql: string) => {
      executedQueries.push(sql.trim());
    }),
  };

  beforeEach(() => {
    executedQueries = [];
    mockQueryRunner.query.mockClear();
  });

  describe('up()', () => {
    beforeEach(async () => {
      migration = new CreateCreditGrantsTable1772400000000();
      await migration.up(mockQueryRunner as any);
    });

    it('should create credit_grants table with IF NOT EXISTS', () => {
      const createTable = executedQueries.find((q) =>
        q.includes('CREATE TABLE'),
      );
      expect(createTable).toBeDefined();
      expect(createTable).toContain('IF NOT EXISTS');
      expect(createTable).toContain('"credit_grants"');
    });

    it('should include all required columns', () => {
      const createTable = executedQueries.find((q) =>
        q.includes('CREATE TABLE'),
      )!;
      const expectedColumns = [
        '"id"',
        '"owner_id"',
        '"owner_type"',
        '"grant_type"',
        '"source_type"',
        '"source_event_id"',
        '"provider"',
        '"provider_event_id"',
        '"webhook_event_id"',
        '"plan_type"',
        '"top_up_pack_id"',
        '"amount"',
        '"balance_before"',
        '"balance_after"',
        '"status"',
        '"error_code"',
        '"error_message"',
        '"granted_at"',
        '"created_at"',
        '"updated_at"',
      ];
      for (const col of expectedColumns) {
        expect(createTable).toContain(col);
      }
    });

    it('should set UUID PK with gen_random_uuid()', () => {
      const createTable = executedQueries.find((q) =>
        q.includes('CREATE TABLE'),
      )!;
      expect(createTable).toContain('gen_random_uuid()');
      expect(createTable).toContain('PRIMARY KEY');
    });

    it('should create unique index on source_event_id', () => {
      const indexQuery = executedQueries.find((q) =>
        q.includes('idx_credit_grants_source_event_id'),
      );
      expect(indexQuery).toBeDefined();
      expect(indexQuery).toContain('UNIQUE');
      expect(indexQuery).toContain('"source_event_id"');
    });

    it('should create owner index', () => {
      const indexQuery = executedQueries.find((q) =>
        q.includes('idx_credit_grants_owner'),
      );
      expect(indexQuery).toBeDefined();
      expect(indexQuery).toContain('"owner_id"');
      expect(indexQuery).toContain('"owner_type"');
    });

    it('should create webhook_event index', () => {
      const indexQuery = executedQueries.find((q) =>
        q.includes('idx_credit_grants_webhook_event'),
      );
      expect(indexQuery).toBeDefined();
      expect(indexQuery).toContain('"webhook_event_id"');
    });

    it('should create status index', () => {
      const indexQuery = executedQueries.find((q) =>
        q.includes('idx_credit_grants_status'),
      );
      expect(indexQuery).toBeDefined();
    });

    it('should create created_at DESC index', () => {
      const indexQuery = executedQueries.find((q) =>
        q.includes('idx_credit_grants_created_at'),
      );
      expect(indexQuery).toBeDefined();
      expect(indexQuery).toContain('DESC');
    });

    it('should create grant_type index', () => {
      const indexQuery = executedQueries.find((q) =>
        q.includes('idx_credit_grants_grant_type'),
      );
      expect(indexQuery).toBeDefined();
    });

    it('should add amount CHECK constraint', () => {
      const checkQuery = executedQueries.find(
        (q) =>
          q.includes('credit_grants_amount_check') &&
          q.includes('ADD CONSTRAINT'),
      );
      expect(checkQuery).toBeDefined();
      expect(checkQuery).toContain('"amount" > 0');
    });

    it('should add balance CHECK constraint', () => {
      const checkQuery = executedQueries.find(
        (q) =>
          q.includes('credit_grants_balance_check') &&
          q.includes('ADD CONSTRAINT'),
      );
      expect(checkQuery).toBeDefined();
      expect(checkQuery).toContain('"balance_after" >= "balance_before"');
    });

    it('should add status CHECK constraint', () => {
      const checkQuery = executedQueries.find(
        (q) =>
          q.includes('credit_grants_status_check') &&
          q.includes('ADD CONSTRAINT'),
      );
      expect(checkQuery).toBeDefined();
      expect(checkQuery).toContain("'pending'");
      expect(checkQuery).toContain("'granted'");
      expect(checkQuery).toContain("'failed'");
      expect(checkQuery).toContain("'ignored'");
    });

    it('should add grant_type CHECK constraint', () => {
      const checkQuery = executedQueries.find(
        (q) =>
          q.includes('credit_grants_grant_type_check') &&
          q.includes('ADD CONSTRAINT'),
      );
      expect(checkQuery).toBeDefined();
      expect(checkQuery).toContain("'topup'");
      expect(checkQuery).toContain("'subscription_monthly'");
      expect(checkQuery).toContain("'subscription_initial'");
    });

    it('should add source_type CHECK constraint', () => {
      const checkQuery = executedQueries.find(
        (q) =>
          q.includes('credit_grants_source_type_check') &&
          q.includes('ADD CONSTRAINT'),
      );
      expect(checkQuery).toBeDefined();
      expect(checkQuery).toContain("'webhook'");
      expect(checkQuery).toContain("'system'");
      expect(checkQuery).toContain("'admin'");
    });

    it('should use IF NOT EXISTS for all indexes', () => {
      const indexQueries = executedQueries.filter(
        (q) => q.includes('CREATE') && q.includes('INDEX'),
      );
      for (const q of indexQueries) {
        expect(q).toContain('IF NOT EXISTS');
      }
    });

    it('should use DROP CONSTRAINT IF EXISTS before ADD CONSTRAINT', () => {
      const dropBeforeAdd = executedQueries.filter((q) =>
        q.includes('DROP CONSTRAINT IF EXISTS'),
      );
      expect(dropBeforeAdd.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('down()', () => {
    beforeEach(async () => {
      migration = new CreateCreditGrantsTable1772400000000();
      await migration.down(mockQueryRunner as any);
    });

    it('should drop all constraints', () => {
      const dropConstraints = executedQueries.filter((q) =>
        q.includes('DROP CONSTRAINT'),
      );
      expect(dropConstraints.length).toBeGreaterThanOrEqual(5);
    });

    it('should drop all indexes', () => {
      const dropIndexes = executedQueries.filter((q) =>
        q.includes('DROP INDEX'),
      );
      expect(dropIndexes.length).toBeGreaterThanOrEqual(6);
    });

    it('should drop table with IF EXISTS', () => {
      const dropTable = executedQueries.find((q) =>
        q.includes('DROP TABLE'),
      );
      expect(dropTable).toBeDefined();
      expect(dropTable).toContain('IF EXISTS');
      expect(dropTable).toContain('"credit_grants"');
    });

    it('should drop table last', () => {
      const lastQuery = executedQueries[executedQueries.length - 1];
      expect(lastQuery).toContain('DROP TABLE');
    });
  });
});
