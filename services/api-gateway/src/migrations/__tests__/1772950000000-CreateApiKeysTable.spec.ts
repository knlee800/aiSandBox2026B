import { CreateApiKeysTable1772950000000 } from '../1772950000000-CreateApiKeysTable';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not prove live locking, concurrency,
 * or transaction behavior. Later Lightsail PostgreSQL validation remains required.
 */
describe('CreateApiKeysTable1772950000000 (SCHEMA-01, mocked)', () => {
  let migration: CreateApiKeysTable1772950000000;
  let executedQueries: string[];
  let mockQueryRunner: {
    isTransactionActive: boolean;
    query: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
  };

  const createRunner = (options?: {
    tableExists?: boolean | string;
    rowCount?: unknown;
    omitRowCount?: boolean;
    countRows?: unknown;
    isTransactionActive?: boolean;
    lockError?: Error;
  }) => {
    executedQueries = [];
    mockQueryRunner = {
      isTransactionActive: options?.isTransactionActive ?? true,
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      query: jest.fn(async (sql: string) => {
        const trimmed = sql.trim();
        if (/LOCK TABLE/i.test(trimmed) && options?.lockError) {
          executedQueries.push(trimmed);
          throw options.lockError;
        }
        executedQueries.push(trimmed);
        if (sql.includes('"table_exists"')) {
          return [{ table_exists: options?.tableExists ?? false }];
        }
        if (sql.includes('"row_count"') || /COUNT\(\*\)/i.test(sql)) {
          if (options?.countRows !== undefined) {
            return options.countRows;
          }
          if (options?.omitRowCount) {
            return [{}];
          }
          if (Object.prototype.hasOwnProperty.call(options ?? {}, 'rowCount')) {
            return [{ row_count: options!.rowCount }];
          }
          return [{ row_count: 0 }];
        }
        return [];
      }),
    };
    migration = new CreateApiKeysTable1772950000000();
  };

  const lockSql =
    'LOCK TABLE "public"."api_keys" IN ACCESS EXCLUSIVE MODE NOWAIT';

  describe('up()', () => {
    beforeEach(async () => {
      createRunner({ tableExists: false });
      await migration.up(mockQueryRunner as any);
    });

    it('creates public.api_keys without IF NOT EXISTS', () => {
      const createTable = executedQueries.find((q) => q.includes('CREATE TABLE'));
      expect(createTable).toBeDefined();
      expect(createTable).toContain('CREATE TABLE "public"."api_keys"');
      expect(createTable).not.toContain('IF NOT EXISTS');
    });

    it('includes required columns, types, and defaults', () => {
      const createTable = executedQueries.find((q) => q.includes('CREATE TABLE'))!;
      expect(createTable).toContain('"id" uuid PRIMARY KEY DEFAULT gen_random_uuid()');
      expect(createTable).toContain('"hashed_key" character varying(255) NOT NULL');
      expect(createTable).toContain('"key_prefix" character varying(20) NOT NULL');
      expect(createTable).toContain('"user_id" uuid NOT NULL');
      expect(createTable).toContain('"scopes" jsonb NOT NULL DEFAULT \'[]\'::jsonb');
      expect(createTable).toContain('"created_at" TIMESTAMP NOT NULL DEFAULT now()');
      expect(createTable).toContain('"revoked_at" TIMESTAMP NULL');
    });

    it('does not create is_internal (IDENTITY-01 remains responsible)', () => {
      const createTable = executedQueries.find((q) => q.includes('CREATE TABLE'))!;
      expect(createTable).not.toContain('is_internal');
    });

    it('references public.users(id) with ON DELETE CASCADE', () => {
      const createTable = executedQueries.find((q) => q.includes('CREATE TABLE'))!;
      expect(createTable).toContain('CONSTRAINT "fk_api_keys_user"');
      expect(createTable).toContain(
        'FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE',
      );
      expect(createTable).not.toContain('users(user_id)');
      expect(createTable).not.toContain('"users"("user_id")');
    });

    it('creates hashed_key and user_id indexes on public.api_keys', () => {
      expect(
        executedQueries.some((q) =>
          q.includes(
            'CREATE INDEX "idx_api_key_hashed" ON "public"."api_keys" ("hashed_key")',
          ),
        ),
      ).toBe(true);
      expect(
        executedQueries.some((q) =>
          q.includes(
            'CREATE INDEX "idx_api_key_user_id" ON "public"."api_keys" ("user_id")',
          ),
        ),
      ).toBe(true);
    });

    it('does not insert users, API keys, privileges, or credit rows', () => {
      const mutating = executedQueries.filter(
        (q) =>
          /\bINSERT\b/i.test(q) ||
          /\bUPDATE\b/i.test(q) ||
          /\bGRANT\b/i.test(q) ||
          /\bCOPY\b/i.test(q),
      );
      expect(mutating).toEqual([]);
    });
  });

  describe('up() existing-table conflict', () => {
    it('fails closed with an actionable diagnostic and does not CREATE TABLE', async () => {
      createRunner({ tableExists: true });
      await expect(migration.up(mockQueryRunner as any)).rejects.toThrow(
        /AGENT-PLATFORM-EXEC-01C-SCHEMA-01: public\.api_keys already exists/,
      );
      expect(executedQueries.some((q) => q.includes('CREATE TABLE'))).toBe(false);
    });
  });

  describe('down()', () => {
    const expectNoDrops = () => {
      expect(executedQueries.some((q) => /\bDROP TABLE\b/i.test(q))).toBe(false);
      expect(executedQueries.some((q) => /\bDROP INDEX\b/i.test(q))).toBe(false);
    };

    it('rejects when QueryRunner has no active transaction before rollback SQL', async () => {
      createRunner({ isTransactionActive: false, rowCount: 0 });
      await expect(migration.down(mockQueryRunner as any)).rejects.toThrow(
        /no active QueryRunner transaction/,
      );
      expect(executedQueries).toEqual([]);
    });

    it('takes ACCESS EXCLUSIVE NOWAIT before emptiness query and all DROPs', async () => {
      createRunner({ rowCount: 0 });
      await migration.down(mockQueryRunner as any);
      const lockIdx = executedQueries.findIndex((q) => q.includes(lockSql));
      const countIdx = executedQueries.findIndex((q) => /COUNT\(\*\)/i.test(q));
      const dropIdxs = executedQueries
        .map((q, i) => (/\bDROP\b/i.test(q) ? i : -1))
        .filter((i) => i >= 0);
      expect(lockIdx).toBe(0);
      expect(countIdx).toBeGreaterThan(lockIdx);
      expect(dropIdxs.length).toBeGreaterThan(0);
      expect(Math.min(...dropIdxs)).toBeGreaterThan(countIdx);
    });

    it('does not count or DROP when the lock fails', async () => {
      createRunner({
        rowCount: 0,
        lockError: new Error('could not obtain lock on relation "api_keys"'),
      });
      await expect(migration.down(mockQueryRunner as any)).rejects.toThrow(
        /could not obtain lock/,
      );
      expect(executedQueries.some((q) => /COUNT\(\*\)/i.test(q))).toBe(false);
      expectNoDrops();
    });

    it('rejects a positive row count without DROP', async () => {
      createRunner({ rowCount: 3 });
      await expect(migration.down(mockQueryRunner as any)).rejects.toThrow(
        /refusing to DROP populated public\.api_keys \(3 rows\)/,
      );
      expect(executedQueries.some((q) => q.includes(lockSql))).toBe(true);
      expectNoDrops();
    });

    it('rejects missing count without DROP', async () => {
      createRunner({ omitRowCount: true });
      await expect(migration.down(mockQueryRunner as any)).rejects.toThrow(
        /row_count missing from count result/,
      );
      expectNoDrops();
    });

    it('rejects empty count rows without DROP', async () => {
      createRunner({ countRows: [] });
      await expect(migration.down(mockQueryRunner as any)).rejects.toThrow(
        /could not read api_keys row count/,
      );
      expectNoDrops();
    });

    it.each([
      ['null', null],
      ['empty string', ''],
      ['boolean false', false],
      ['boolean true', true],
      ['malformed string', '3 rows'],
      ['leading-zero string', '00'],
    ])('rejects %s count without DROP', async (_label, rowCount) => {
      createRunner({ rowCount });
      await expect(migration.down(mockQueryRunner as any)).rejects.toThrow(
        /invalid api_keys row count/,
      );
      expectNoDrops();
    });

    it('permits schema-qualified rollback only for explicit integer zero', async () => {
      createRunner({ rowCount: 0 });
      await migration.down(mockQueryRunner as any);
      expect(executedQueries[0]).toBe(lockSql);
      expect(executedQueries.some((q) => /FROM "public"\."api_keys"/.test(q))).toBe(
        true,
      );
      expect(executedQueries).toContain('DROP INDEX "public"."idx_api_key_user_id"');
      expect(executedQueries).toContain('DROP INDEX "public"."idx_api_key_hashed"');
      expect(executedQueries).toContain('DROP TABLE "public"."api_keys"');
      expect(executedQueries.some((q) => q.includes('IF EXISTS'))).toBe(false);
    });

    it('permits schema-qualified rollback for canonical digit string zero', async () => {
      createRunner({ rowCount: '0' });
      await migration.down(mockQueryRunner as any);
      expect(executedQueries).toContain('DROP TABLE "public"."api_keys"');
    });

    it('does not start, commit, or roll back the QueryRunner transaction', async () => {
      createRunner({ rowCount: 0 });
      await migration.down(mockQueryRunner as any);
      expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.query).not.toHaveBeenCalledWith(
        expect.stringMatching(/^\s*(COMMIT|ROLLBACK)\b/i),
      );
    });
  });
});
