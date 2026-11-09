import { readdirSync } from 'fs';
import { join } from 'path';
import { CreateConnectorConnectionsTable1802000000000 } from '../1802000000000-CreateConnectorConnectionsTable';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not run the migration.
 */
describe('CreateConnectorConnectionsTable1802000000000 (CONN-02A, mocked)', () => {
  const timestamp = 1802000000000;

  function compact(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
  }

  function createRunner(): {
    migration: CreateConnectorConnectionsTable1802000000000;
    executed: string[];
    queryRunner: {
      query: jest.Mock;
      startTransaction: jest.Mock;
      commitTransaction: jest.Mock;
      rollbackTransaction: jest.Mock;
    };
  } {
    const executed: string[] = [];
    const queryRunner = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      query: jest.fn(async (sql: string) => {
        executed.push(sql.trim());
        return [];
      }),
    };
    return {
      migration: new CreateConnectorConnectionsTable1802000000000(),
      executed,
      queryRunner,
    };
  }

  const createTable = compact(`
    CREATE TABLE "connector_connections" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "kind" varchar(16) NOT NULL,
      "preset" varchar(16) NULL,
      "username" varchar(254) NULL,
      "secret_ciphertext" text NOT NULL,
      "key_version" smallint NOT NULL DEFAULT 1,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "last_verified_at" timestamptz NULL
    )
  `);
  const uniqueIndex =
    'CREATE UNIQUE INDEX "uq_connector_connections_user_id_kind" ON "connector_connections" ("user_id", "kind")';

  it('uses a timestamp after 1801000000000-CreateUserEntitlementsTable', () => {
    const names = readdirSync(join(__dirname, '..')).filter(
      (name) => /^\d+-/.test(name) && name.endsWith('.ts'),
    );
    const stamps = names.map((name) => Number(name.slice(0, name.indexOf('-'))));
    expect(names.some((name) => name.startsWith('1801000000000-'))).toBe(true);
    expect(names.some((name) => name.startsWith(`${timestamp}-`))).toBe(true);
    expect(timestamp).toBeGreaterThan(1801000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp <= 1801000000000))).toBe(1801000000000);
  });

  describe('up()', () => {
    it('creates the connector_connections table, foreign key and unique index', async () => {
      const { migration, executed, queryRunner } = createRunner();
      await migration.up(queryRunner as never);

      expect(executed.map(compact)).toEqual([createTable, uniqueIndex]);
      expect(executed.join('\n')).toContain('REFERENCES users(id) ON DELETE CASCADE');
      expect(executed.join('\n')).toContain('"user_id", "kind"');
      expect(executed.join('\n')).not.toMatch(/\bDELETE FROM\b|\bTRUNCATE\b|\bALTER\b|\bUPDATE\b|\bDROP\b/i);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });
  });

  describe('down()', () => {
    it('drops the unique index and the table', async () => {
      const { migration, executed, queryRunner } = createRunner();
      await migration.down(queryRunner as never);

      expect(executed).toEqual([
        'DROP INDEX IF EXISTS "uq_connector_connections_user_id_kind"',
        'DROP TABLE IF EXISTS "connector_connections"',
      ]);
      expect(executed.join('\n')).not.toMatch(
        /users|knowledge_documents|audit_events|user_entitlements|\bDELETE FROM\b|\bTRUNCATE\b|\bALTER\b/i,
      );
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });
  });
});
