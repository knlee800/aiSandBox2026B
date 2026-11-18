import { readdirSync } from 'fs';
import { join } from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { AddConnectorSignInRefusedAt1815000000000 } from '../1815000000000-AddConnectorSignInRefusedAt';
import { ConnectorConnection } from '../../entities/connector-connection.entity';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not run the migration.
 */
describe('AddConnectorSignInRefusedAt1815000000000 (CONN-MAIL-AUTH-STATE-01 S1, mocked)', () => {
  const timestamp = 1815000000000;

  let executed: string[];
  let queryRunner: {
    query: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
  };
  let migration: AddConnectorSignInRefusedAt1815000000000;

  function createRunner(options: { table?: unknown; column?: unknown; probeRows?: unknown } = {}): void {
    executed = [];
    queryRunner = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      query: jest.fn(async (sql: string) => {
        executed.push(sql.trim());
        if (sql.includes('"sign_in_refused_at_exists"')) {
          if (options.probeRows !== undefined) {
            return options.probeRows;
          }
          return [
            {
              connector_connections_exists: options.table ?? true,
              sign_in_refused_at_exists: options.column ?? false,
            },
          ];
        }
        return [];
      }),
    };
    migration = new AddConnectorSignInRefusedAt1815000000000();
  }

  const upSql = 'ALTER TABLE "public"."connector_connections" ADD COLUMN "sign_in_refused_at" timestamptz NULL';
  const downSql = 'ALTER TABLE "public"."connector_connections" DROP COLUMN "sign_in_refused_at"';
  const forbidden =
    /\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b|\bINSERT\b|\bDROP TABLE\b|\bINDEX\b|\bCREATE TABLE\b|\bRENAME\b|\bDEFAULT\b|\bNOT NULL\b|\bIF (NOT )?EXISTS\b/i;

  it('uses a timestamp after 1814000000000-CreateAgentChainTriggerTables, the latest before it', () => {
    const names = readdirSync(join(__dirname, '..')).filter((name) => /^\d+-/.test(name) && name.endsWith('.ts'));
    const stamps = names.map((name) => Number(name.slice(0, name.indexOf('-'))));
    expect(names.some((name) => name.startsWith('1814000000000-'))).toBe(true);
    expect(names.filter((name) => name.startsWith(`${timestamp}-`))).toEqual([
      '1815000000000-AddConnectorSignInRefusedAt.ts',
    ]);
    expect(timestamp).toBeGreaterThan(1814000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp < timestamp))).toBe(1814000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp <= timestamp))).toBe(timestamp);
    expect(new Set(stamps).size).toBe(stamps.length);
  });

  it('ConnectorConnection maps signInRefusedAt to the nullable timestamptz column sign_in_refused_at', () => {
    const column = getMetadataArgsStorage().columns.find(
      (entry) => entry.target === ConnectorConnection && entry.propertyName === 'signInRefusedAt',
    );
    expect(column?.options).toMatchObject({ type: 'timestamptz', name: 'sign_in_refused_at', nullable: true });
    expect(column?.options.default).toBeUndefined();
    expect(upSql).toContain(`"${column?.options.name}" ${column?.options.type} NULL`);
  });

  describe('up()', () => {
    it('adds exactly the one nullable column, in one ALTER, with no default and no rewrite', async () => {
      createRunner();
      await migration.up(queryRunner as never);

      expect(executed).toHaveLength(2);
      expect(executed[1]).toBe(upSql);
      expect(executed.filter((sql) => /ALTER TABLE/i.test(sql))).toEqual([upSql]);
      expect(executed[1].match(/ADD COLUMN/g)).toHaveLength(1);
      expect(executed.join('\n')).not.toMatch(forbidden);
      expect(executed.join('\n')).not.toContain('secret_ciphertext');
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('probes information_schema for the table and the column', async () => {
      createRunner();
      await migration.up(queryRunner as never);

      const probe = executed[0];
      expect(probe).toContain('information_schema.tables');
      expect(probe).toContain('information_schema.columns');
      expect(probe).toContain("table_schema = 'public'");
      expect(probe).toContain("table_name = 'connector_connections'");
      expect(probe).toContain("column_name = 'sign_in_refused_at'");
    });

    it.each([true, 't', 'true', 1, '1'])('refuses when the column already exists (%p) and does not ALTER', async (column) => {
      createRunner({ column });
      await expect(migration.up(queryRunner as never)).rejects.toThrow(/already exists/);
      expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
    });

    it('refuses when connector_connections is missing and does not ALTER', async () => {
      createRunner({ table: false, column: false });
      await expect(migration.up(queryRunner as never)).rejects.toThrow(/is missing/);
      expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
    });

    it.each([[[]], [null], [[{}]], [[{ connector_connections_exists: 'maybe', sign_in_refused_at_exists: false }]]])(
      'refuses an unreadable probe %j and does not ALTER',
      async (probeRows) => {
        createRunner({ probeRows });
        await expect(migration.up(queryRunner as never)).rejects.toThrow(/could not read connector_connections column state/);
        expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
      },
    );
  });

  describe('down()', () => {
    it('drops only sign_in_refused_at, nothing else', async () => {
      createRunner({ column: true });
      await migration.down(queryRunner as never);

      expect(executed).toHaveLength(2);
      expect(executed[1]).toBe(downSql);
      expect(executed[1].match(/DROP COLUMN/g)).toHaveLength(1);
      for (const keep of [
        'id',
        'user_id',
        'kind',
        'preset',
        'username',
        'secret_ciphertext',
        'key_version',
        'created_at',
        'updated_at',
        'last_verified_at',
      ]) {
        expect(executed[1]).not.toContain(`"${keep}"`);
      }
      expect(executed.join('\n')).not.toMatch(/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b|\bINSERT\b|\bDROP TABLE\b|\bCASCADE\b/i);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it.each([false, 'f', 'false', 0, '0'])('refuses unless the column is present (%p) and does not DROP', async (column) => {
      createRunner({ column });
      await expect(migration.down(queryRunner as never)).rejects.toThrow(/is not present/);
      expect(executed.some((sql) => /DROP/i.test(sql))).toBe(false);
    });

    it('up then down round-trips the one column', async () => {
      createRunner({ column: false });
      await migration.up(queryRunner as never);
      const added = [...executed];
      createRunner({ column: true });
      await migration.down(queryRunner as never);
      expect([added[1], executed[1]]).toEqual([upSql, downSql]);
    });
  });
});
