import { AddAdminGrantAuditColumns1772900000000 } from '../../../migrations/1772900000000-AddAdminGrantAuditColumns';

describe('AddAdminGrantAuditColumns migration (ADMIN-CONSOLE-01A)', () => {
  let migration: AddAdminGrantAuditColumns1772900000000;
  let executedQueries: string[];

  const mockQueryRunner = {
    query: jest.fn().mockImplementation(async (sql: string) => {
      executedQueries.push(sql.trim());
    }),
  };

  beforeEach(() => {
    migration = new AddAdminGrantAuditColumns1772900000000();
    executedQueries = [];
    mockQueryRunner.query.mockClear();
  });

  describe('up()', () => {
    beforeEach(async () => {
      await migration.up(mockQueryRunner as any);
    });

    it('adds granted_by_user_id with IF NOT EXISTS', () => {
      const query = executedQueries.find((q) =>
        q.includes('ADD COLUMN IF NOT EXISTS "granted_by_user_id"'),
      );
      expect(query).toBeDefined();
      expect(query).toContain('ALTER TABLE "credit_grants"');
      expect(query).toContain('uuid');
    });

    it('adds reason with IF NOT EXISTS', () => {
      const query = executedQueries.find((q) =>
        q.includes('ADD COLUMN IF NOT EXISTS "reason"'),
      );
      expect(query).toBeDefined();
      expect(query).toContain('ALTER TABLE "credit_grants"');
      expect(query).toContain('TEXT');
    });

    it('creates partial index on granted_by_user_id', () => {
      const query = executedQueries.find((q) =>
        q.includes('idx_credit_grants_granted_by'),
      );
      expect(query).toBeDefined();
      expect(query).toContain('CREATE INDEX IF NOT EXISTS');
      expect(query).toContain('ON "credit_grants" ("granted_by_user_id")');
      expect(query).toContain('WHERE "granted_by_user_id" IS NOT NULL');
    });

    it('does not mutate unrelated schema objects', () => {
      const allSql = executedQueries.join('\n');
      expect(allSql).not.toContain('FOREIGN KEY');
      expect(allSql).not.toContain('ADD CONSTRAINT');
      expect(allSql).not.toContain('DROP CONSTRAINT');
      expect(allSql).not.toContain('"credit_balances"');
      expect(allSql).not.toContain('"credit_deduction_records"');
      expect(allSql).not.toContain('"subscriptions"');
    });
  });

  describe('down()', () => {
    beforeEach(async () => {
      await migration.down(mockQueryRunner as any);
    });

    it('drops objects in required order: index, reason, granted_by_user_id', () => {
      expect(executedQueries).toHaveLength(3);
      expect(executedQueries[0]).toContain(
        'DROP INDEX IF EXISTS "idx_credit_grants_granted_by"',
      );
      expect(executedQueries[1]).toContain('DROP COLUMN IF EXISTS "reason"');
      expect(executedQueries[2]).toContain(
        'DROP COLUMN IF EXISTS "granted_by_user_id"',
      );
    });

    it('uses IF EXISTS for safe rollback', () => {
      for (const query of executedQueries) {
        expect(query).toContain('IF EXISTS');
      }
    });
  });
});
