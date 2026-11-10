import { readdirSync } from 'fs';
import { join } from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { CreateCollaborationRostersTable1805000000000 } from '../1805000000000-CreateCollaborationRostersTable';
import { CollaborationRosterEntity } from '../../orchestration/collaboration-roster.entity';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not run the migration.
 */
describe('CreateCollaborationRostersTable1805000000000 (COS-FRONTDOOR-01, mocked)', () => {
  const timestamp = 1805000000000;

  function compact(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
  }

  let executed: string[];
  let queryRunner: {
    query: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
  };
  let migration: CreateCollaborationRostersTable1805000000000;

  function createRunner(options: { tableExists?: unknown; probeRows?: unknown } = {}): void {
    executed = [];
    queryRunner = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      query: jest.fn(async (sql: string) => {
        executed.push(sql.trim());
        if (sql.includes('"table_exists"')) {
          if (options.probeRows !== undefined) {
            return options.probeRows;
          }
          return [{ table_exists: options.tableExists ?? false }];
        }
        return [];
      }),
    };
    migration = new CreateCollaborationRostersTable1805000000000();
  }

  const createTable = compact(`
    CREATE TABLE "public"."collaboration_rosters" (
      "user_id" uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      "member_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const dropTable = 'DROP TABLE "public"."collaboration_rosters"';

  const forbidden =
    /\bDELETE FROM\b|\bTRUNCATE\b|\bUPDATE\b|\bINSERT\b|\bALTER\b|\bINDEX\b|\bRENAME\b|\bIF (NOT )?EXISTS\b/i;

  it('uses a timestamp after 1804000000000-AddCollaborationRunResultSeenAt, the latest before it, and is the latest', () => {
    const names = readdirSync(join(__dirname, '..')).filter(
      (name) => /^\d+-/.test(name) && name.endsWith('.ts'),
    );
    const stamps = names.map((name) => Number(name.slice(0, name.indexOf('-'))));
    expect(names.some((name) => name.startsWith('1804000000000-'))).toBe(true);
    expect(names.filter((name) => name.startsWith(`${timestamp}-`))).toEqual([
      '1805000000000-CreateCollaborationRostersTable.ts',
    ]);
    expect(timestamp).toBeGreaterThan(1804000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp < timestamp))).toBe(1804000000000);
    expect(Math.max(...stamps)).toBe(timestamp);
  });

  it('the entity maps the same table and the same three columns', () => {
    const storage = getMetadataArgsStorage();
    const table = storage.tables.find((entry) => entry.target === CollaborationRosterEntity);
    expect(table?.name).toBe('collaboration_rosters');
    expect(table?.schema).toBe('public');

    const columns = storage.columns.filter((entry) => entry.target === CollaborationRosterEntity);
    expect(columns.map((column) => column.propertyName).sort()).toEqual([
      'memberIds',
      'updatedAt',
      'userId',
    ]);
    const byProperty = (property: string) => {
      const column = columns.find((entry) => entry.propertyName === property);
      expect(column).toBeDefined();
      return column!;
    };

    const userId = byProperty('userId');
    expect(userId.options.name).toBe('user_id');
    expect(userId.options.type).toBe('uuid');
    expect(userId.options.primary).toBe(true);
    expect(createTable).toContain(`"${userId.options.name}" ${userId.options.type} PRIMARY KEY`);

    const memberIds = byProperty('memberIds');
    expect(memberIds.options.name).toBe('member_ids');
    expect(memberIds.options.type).toBe('jsonb');
    expect(memberIds.options.nullable).toBeFalsy();
    expect((memberIds.options.default as () => string)()).toBe("'[]'::jsonb");
    expect(createTable).toContain(
      `"${memberIds.options.name}" ${memberIds.options.type} NOT NULL DEFAULT '[]'::jsonb`,
    );

    const updatedAt = byProperty('updatedAt');
    expect(updatedAt.options.name).toBe('updated_at');
    expect(updatedAt.options.type).toBe('timestamptz');
    expect(updatedAt.options.nullable).toBeFalsy();
    expect((updatedAt.options.default as () => string)()).toBe('CURRENT_TIMESTAMP');
    expect(createTable).toContain(
      `"${updatedAt.options.name}" ${updatedAt.options.type} NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );

    expect(storage.relations.some((entry) => entry.target === CollaborationRosterEntity)).toBe(false);
    expect(storage.indices.some((entry) => entry.target === CollaborationRosterEntity)).toBe(false);
  });

  describe('up()', () => {
    it('creates exactly one table with the user key and nothing else', async () => {
      createRunner({ tableExists: false });
      await migration.up(queryRunner as never);

      expect(executed).toHaveLength(2);
      expect(compact(executed[1])).toBe(createTable);
      expect(executed.filter((sql) => /CREATE TABLE/i.test(sql))).toHaveLength(1);
      expect(executed.join('\n')).not.toMatch(forbidden);
      expect(executed.join('\n')).not.toMatch(/\bDROP\b/i);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('probes information_schema.tables for public.collaboration_rosters', async () => {
      createRunner({ tableExists: 'f' });
      await migration.up(queryRunner as never);

      const probe = executed[0];
      expect(probe).toContain('information_schema.tables');
      expect(probe).toContain("table_schema = 'public'");
      expect(probe).toContain("table_name = 'collaboration_rosters'");
    });

    it.each([true, 't', 'true', 1, '1'])(
      'fails closed when the probe says %p (present) and does not CREATE',
      async (tableExists) => {
        createRunner({ tableExists });
        await expect(migration.up(queryRunner as never)).rejects.toThrow(
          /collaboration_rosters already exists/,
        );
        expect(executed.some((sql) => /CREATE TABLE/i.test(sql))).toBe(false);
      },
    );

    it.each([[[]], [null], [[{}]], [[{ table_exists: 'maybe' }]]])(
      'refuses an unreadable probe %j and does not CREATE',
      async (probeRows) => {
        createRunner({ probeRows });
        await expect(migration.up(queryRunner as never)).rejects.toThrow(
          /could not read collaboration_rosters table state/,
        );
        expect(executed.some((sql) => /CREATE TABLE/i.test(sql))).toBe(false);
      },
    );
  });

  describe('down()', () => {
    it('drops only collaboration_rosters', async () => {
      createRunner({ tableExists: true });
      await migration.down(queryRunner as never);

      expect(executed).toHaveLength(2);
      expect(executed[1]).toBe(dropTable);
      expect(executed.join('\n')).not.toMatch(forbidden);
      for (const keep of ['users', 'collaboration_runs', 'collaboration_referrals', 'user_agents']) {
        expect(executed[1]).not.toContain(`"${keep}"`);
      }
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it.each([false, 'f', 0, '0'])(
      'refuses when the probe says %p (absent) and does not DROP',
      async (tableExists) => {
        createRunner({ tableExists });
        await expect(migration.down(queryRunner as never)).rejects.toThrow(
          /collaboration_rosters does not exist/,
        );
        expect(executed.some((sql) => /DROP TABLE/i.test(sql))).toBe(false);
      },
    );

    it('refuses an unreadable probe and does not DROP', async () => {
      createRunner({ probeRows: [] });
      await expect(migration.down(queryRunner as never)).rejects.toThrow(
        /could not read collaboration_rosters table state/,
      );
      expect(executed.some((sql) => /DROP TABLE/i.test(sql))).toBe(false);
    });

    it('up then down leaves the probe-driven state where it started', async () => {
      createRunner({ tableExists: false });
      await migration.up(queryRunner as never);
      expect(executed.filter((sql) => /CREATE TABLE/i.test(sql))).toHaveLength(1);
      createRunner({ tableExists: true });
      await migration.down(queryRunner as never);
      expect(executed.filter((sql) => /DROP TABLE/i.test(sql))).toEqual([dropTable]);
    });
  });
});
