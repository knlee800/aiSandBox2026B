import { CreateApiKeysTable1772950000000 } from '../1772950000000-CreateApiKeysTable';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not prove live database behavior.
 */
describe('CreateApiKeysTable1772950000000 (SCHEMA-01, mocked)', () => {
  let migration: CreateApiKeysTable1772950000000;
  let executedQueries: string[];
  let mockQueryRunner: { query: jest.Mock };

  const createRunner = (options?: {
    tableExists?: boolean | string;
    rowCount?: number | string;
  }) => {
    executedQueries = [];
    mockQueryRunner = {
      query: jest.fn(async (sql: string) => {
        executedQueries.push(sql.trim());
        if (sql.includes('"table_exists"')) {
          return [{ table_exists: options?.tableExists ?? false }];
        }
        if (sql.includes('"row_count"')) {
          return [{ row_count: options?.rowCount ?? 0 }];
        }
        return [];
      }),
    };
    migration = new CreateApiKeysTable1772950000000();
  };

  describe('up()', () => {
    beforeEach(async () => {
      createRunner({ tableExists: false });
      await migration.up(mockQueryRunner as any);
    });

    it('creates api_keys without IF NOT EXISTS', () => {
      const createTable = executedQueries.find((q) => q.includes('CREATE TABLE'));
      expect(createTable).toBeDefined();
      expect(createTable).toContain('CREATE TABLE "api_keys"');
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

    it('references users(id) with ON DELETE CASCADE', () => {
      const createTable = executedQueries.find((q) => q.includes('CREATE TABLE'))!;
      expect(createTable).toContain('CONSTRAINT "fk_api_keys_user"');
      expect(createTable).toContain('FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE');
      expect(createTable).not.toContain('users(user_id)');
      expect(createTable).not.toContain('"users"("user_id")');
    });

    it('creates hashed_key and user_id indexes', () => {
      expect(
        executedQueries.some((q) =>
          q.includes('CREATE INDEX "idx_api_key_hashed" ON "api_keys" ("hashed_key")'),
        ),
      ).toBe(true);
      expect(
        executedQueries.some((q) =>
          q.includes('CREATE INDEX "idx_api_key_user_id" ON "api_keys" ("user_id")'),
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
    it('drops an empty table without IF EXISTS', async () => {
      createRunner({ rowCount: 0 });
      await migration.down(mockQueryRunner as any);
      const dropTable = executedQueries.find((q) => q.includes('DROP TABLE'));
      expect(dropTable).toBe('DROP TABLE "api_keys"');
      expect(dropTable).not.toContain('IF EXISTS');
      expect(
        executedQueries.some((q) => q.includes('DROP INDEX "idx_api_key_hashed"')),
      ).toBe(true);
      expect(
        executedQueries.some((q) => q.includes('DROP INDEX "idx_api_key_user_id"')),
      ).toBe(true);
    });

    it('refuses to drop a populated table', async () => {
      createRunner({ rowCount: 3 });
      await expect(migration.down(mockQueryRunner as any)).rejects.toThrow(
        /refusing to DROP populated public\.api_keys \(3 rows\)/,
      );
      expect(executedQueries.some((q) => q.includes('DROP TABLE'))).toBe(false);
      expect(executedQueries.some((q) => q.includes('DROP INDEX'))).toBe(false);
    });
  });
});
