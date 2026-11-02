import { AddCollaborationReferralPendingJob1798000000000 } from '../1798000000000-AddCollaborationReferralPendingJob';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not run the migration.
 */
describe('AddCollaborationReferralPendingJob1798000000000 (COLLAB-GATE-01, mocked)', () => {
  let migration: AddCollaborationReferralPendingJob1798000000000;
  let executedQueries: string[];
  let mockQueryRunner: {
    query: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
  };

  const createRunner = (options?: {
    columnExists?: boolean | string | number;
    countRows?: unknown;
  }) => {
    executedQueries = [];
    mockQueryRunner = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      query: jest.fn(async (sql: string) => {
        executedQueries.push(sql.trim());
        if (sql.includes('"column_exists"')) {
          if (options?.countRows !== undefined) {
            return options.countRows;
          }
          return [{ column_exists: options?.columnExists ?? false }];
        }
        return [];
      }),
    };
    migration = new AddCollaborationReferralPendingJob1798000000000();
  };

  const addSql =
    'ALTER TABLE "public"."collaboration_referrals" ADD COLUMN "pending_job" jsonb NULL';
  const dropSql =
    'ALTER TABLE "public"."collaboration_referrals" DROP COLUMN "pending_job"';

  describe('up()', () => {
    it('adds one nullable jsonb column and nothing else', async () => {
      createRunner({ columnExists: false });
      await migration.up(mockQueryRunner as never);

      const alters = executedQueries.filter((sql) => /ALTER TABLE/i.test(sql));
      expect(alters).toEqual([addSql]);
      expect(alters[0]).toContain('"pending_job" jsonb NULL');
      expect(alters[0]).not.toContain('NOT NULL');
      expect(executedQueries.join('\n')).not.toMatch(/decided_by|decision_reason/i);
      expect(executedQueries.some((sql) => /IF NOT EXISTS/i.test(sql))).toBe(false);
      expect(executedQueries.some((sql) => /CREATE TABLE/i.test(sql))).toBe(false);
    });

    it('fails closed when the column already exists and does not ALTER', async () => {
      createRunner({ columnExists: true });
      await expect(migration.up(mockQueryRunner as never)).rejects.toThrow(
        /pending_job already exists/,
      );
      expect(executedQueries.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
    });

    it('treats a driver boolean t as already present', async () => {
      createRunner({ columnExists: 't' });
      await expect(migration.up(mockQueryRunner as never)).rejects.toThrow(
        /pending_job already exists/,
      );
    });

    it('refuses an unreadable column probe and does not ALTER', async () => {
      createRunner({ countRows: [] });
      await expect(migration.up(mockQueryRunner as never)).rejects.toThrow(
        /could not read pending_job column state/,
      );
      expect(executedQueries.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
    });
  });

  describe('down()', () => {
    it('drops only pending_job', async () => {
      createRunner({ columnExists: true });
      await migration.down(mockQueryRunner as never);

      const alters = executedQueries.filter((sql) => /ALTER TABLE/i.test(sql));
      expect(alters).toEqual([dropSql]);
      expect(executedQueries.some((sql) => /DROP TABLE/i.test(sql))).toBe(false);
      expect(executedQueries.some((sql) => /IF EXISTS/i.test(sql))).toBe(false);
      expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('drops the column when the probe returns 1', async () => {
      createRunner({ columnExists: 1 });
      await migration.down(mockQueryRunner as never);
      expect(executedQueries).toContain(dropSql);
    });

    it('refuses when the column is already gone and does not DROP', async () => {
      createRunner({ columnExists: false });
      await expect(migration.down(mockQueryRunner as never)).rejects.toThrow(
        /pending_job does not exist/,
      );
      expect(executedQueries.some((sql) => /DROP COLUMN/i.test(sql))).toBe(false);
    });
  });
});
