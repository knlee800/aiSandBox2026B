import { readdirSync } from 'fs';
import { join } from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { AddCollaborationRunResultSeenAt1804000000000 } from '../1804000000000-AddCollaborationRunResultSeenAt';
import { CollaborationRunEntity } from '../../orchestration/collaboration-run.entity';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not run the migration.
 */
describe('AddCollaborationRunResultSeenAt1804000000000 (RESULTS-01, mocked)', () => {
  const timestamp = 1804000000000;

  let executed: string[];
  let queryRunner: {
    query: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
  };
  let migration: AddCollaborationRunResultSeenAt1804000000000;

  function createRunner(options: { columnExists?: unknown; probeRows?: unknown } = {}): void {
    executed = [];
    queryRunner = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      query: jest.fn(async (sql: string) => {
        executed.push(sql.trim());
        if (sql.includes('"column_exists"')) {
          if (options.probeRows !== undefined) {
            return options.probeRows;
          }
          return [{ column_exists: options.columnExists ?? false }];
        }
        return [];
      }),
    };
    migration = new AddCollaborationRunResultSeenAt1804000000000();
  }

  const upSql =
    'ALTER TABLE "public"."collaboration_runs" ADD COLUMN "result_seen_at" timestamptz NULL';
  const downSql = 'ALTER TABLE "public"."collaboration_runs" DROP COLUMN "result_seen_at"';

  const forbidden =
    /\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b|\bDROP TABLE\b|\bINDEX\b|\bCREATE TABLE\b|\bRENAME\b|\bDEFAULT\b|\bNOT NULL\b|\bIF (NOT )?EXISTS\b/i;

  it('uses a timestamp after 1803000000000-AddUserAgentWorkflowColumns, the latest before it, and is the latest', () => {
    const names = readdirSync(join(__dirname, '..')).filter(
      (name) => /^\d+-/.test(name) && name.endsWith('.ts'),
    );
    const stamps = names.map((name) => Number(name.slice(0, name.indexOf('-'))));
    expect(names.some((name) => name.startsWith('1803000000000-'))).toBe(true);
    expect(names.filter((name) => name.startsWith(`${timestamp}-`))).toEqual([
      '1804000000000-AddCollaborationRunResultSeenAt.ts',
    ]);
    expect(timestamp).toBeGreaterThan(1803000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp < timestamp))).toBe(1803000000000);
    expect(Math.max(...stamps)).toBe(timestamp);
  });

  it('the entity maps resultSeenAt to the same nullable timestamptz column', () => {
    const column = getMetadataArgsStorage().columns.find(
      (entry) => entry.target === CollaborationRunEntity && entry.propertyName === 'resultSeenAt',
    );
    expect(column).toBeDefined();
    expect(column?.options.name).toBe('result_seen_at');
    expect(column?.options.type).toBe('timestamptz');
    expect(column?.options.nullable).toBe(true);
    expect(column?.options.default).toBeUndefined();
    expect(upSql).toContain(`"${column?.options.name}" ${column?.options.type} NULL`);
  });

  describe('up()', () => {
    it('adds exactly one nullable timestamptz column and nothing else', async () => {
      createRunner({ columnExists: false });
      await migration.up(queryRunner as never);

      const alters = executed.filter((sql) => /ALTER TABLE/i.test(sql));
      expect(alters).toEqual([upSql]);
      expect(alters[0].match(/ADD COLUMN/g)).toHaveLength(1);
      expect(executed).toHaveLength(2);
      expect(executed.join('\n')).not.toMatch(forbidden);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('probes information_schema for public.collaboration_runs.result_seen_at', async () => {
      createRunner({ columnExists: 'f' });
      await migration.up(queryRunner as never);

      const probe = executed[0];
      expect(probe).toContain('information_schema.columns');
      expect(probe).toContain("table_schema = 'public'");
      expect(probe).toContain("table_name = 'collaboration_runs'");
      expect(probe).toContain("column_name = 'result_seen_at'");
    });

    it.each([true, 't', 'true', 1, '1'])(
      'fails closed when the probe says %p (present) and does not ALTER',
      async (columnExists) => {
        createRunner({ columnExists });
        await expect(migration.up(queryRunner as never)).rejects.toThrow(
          /result_seen_at already exists/,
        );
        expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
      },
    );

    it.each([[[]], [null], [[{}]], [[{ column_exists: 'maybe' }]]])(
      'refuses an unreadable probe %j and does not ALTER',
      async (probeRows) => {
        createRunner({ probeRows });
        await expect(migration.up(queryRunner as never)).rejects.toThrow(
          /could not read result_seen_at column state/,
        );
        expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
      },
    );
  });

  describe('down()', () => {
    it('drops only result_seen_at', async () => {
      createRunner({ columnExists: true });
      await migration.down(queryRunner as never);

      const alters = executed.filter((sql) => /ALTER TABLE/i.test(sql));
      expect(alters).toEqual([downSql]);
      expect(alters[0].match(/DROP COLUMN/g)).toHaveLength(1);
      for (const keep of ['"status"', '"user_id"', '"created_at"', '"completed_at"', '"referral_ids"']) {
        expect(alters[0]).not.toContain(keep);
      }
      expect(executed.join('\n')).not.toMatch(forbidden);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it.each([false, 'f', 0, '0'])(
      'refuses when the probe says %p (absent) and does not DROP',
      async (columnExists) => {
        createRunner({ columnExists });
        await expect(migration.down(queryRunner as never)).rejects.toThrow(
          /result_seen_at does not exist/,
        );
        expect(executed.some((sql) => /DROP COLUMN/i.test(sql))).toBe(false);
      },
    );

    it('refuses an unreadable probe and does not DROP', async () => {
      createRunner({ probeRows: [] });
      await expect(migration.down(queryRunner as never)).rejects.toThrow(
        /could not read result_seen_at column state/,
      );
      expect(executed.some((sql) => /DROP COLUMN/i.test(sql))).toBe(false);
    });

    it('up then down leaves the probe-driven state where it started', async () => {
      createRunner({ columnExists: false });
      await migration.up(queryRunner as never);
      createRunner({ columnExists: true });
      await migration.down(queryRunner as never);
      expect(executed.filter((sql) => /ALTER TABLE/i.test(sql))).toEqual([downSql]);
    });
  });
});
