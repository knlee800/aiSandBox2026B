import { readdirSync } from 'fs';
import { join } from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { AddUserAgentTeamColumn1806000000000 } from '../1806000000000-AddUserAgentTeamColumn';
import { UserAgent } from '../../entities/user-agent.entity';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not run the migration.
 */
describe('AddUserAgentTeamColumn1806000000000 (USER-TEAMS-01 01A, mocked)', () => {
  const timestamp = 1806000000000;

  let executed: string[];
  let queryRunner: {
    query: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
  };
  let migration: AddUserAgentTeamColumn1806000000000;

  function createRunner(options: { present?: unknown; probeRows?: unknown } = {}): void {
    executed = [];
    queryRunner = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      query: jest.fn(async (sql: string) => {
        executed.push(sql.trim());
        if (sql.includes('"present_columns"')) {
          if (options.probeRows !== undefined) {
            return options.probeRows;
          }
          return [{ present_columns: options.present ?? '0' }];
        }
        return [];
      }),
    };
    migration = new AddUserAgentTeamColumn1806000000000();
  }

  const upSql = [
    'ALTER TABLE "public"."user_agents"',
    `  ADD COLUMN "team_member_ids" jsonb NOT NULL DEFAULT '[]'::jsonb`,
  ].join('\n');
  const downSql = ['ALTER TABLE "public"."user_agents"', '  DROP COLUMN "team_member_ids"'].join('\n');

  const forbidden =
    /\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b|\bINSERT\b|\bDROP TABLE\b|\bINDEX\b|\bCREATE TABLE\b|\bRENAME\b|\bIF (NOT )?EXISTS\b/i;

  it('uses a timestamp after 1805000000000-CreateCollaborationRostersTable, the latest before it', () => {
    const names = readdirSync(join(__dirname, '..')).filter(
      (name) => /^\d+-/.test(name) && name.endsWith('.ts'),
    );
    const stamps = names.map((name) => Number(name.slice(0, name.indexOf('-'))));
    expect(names.some((name) => name.startsWith('1805000000000-'))).toBe(true);
    expect(names.filter((name) => name.startsWith(`${timestamp}-`))).toEqual([
      '1806000000000-AddUserAgentTeamColumn.ts',
    ]);
    expect(timestamp).toBeGreaterThan(1805000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp < timestamp))).toBe(1805000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp <= timestamp))).toBe(timestamp);
  });

  it('the entity maps team_member_ids as jsonb, not null, default an empty list', () => {
    const column = getMetadataArgsStorage().columns.find(
      (entry) => entry.target === UserAgent && entry.propertyName === 'teamMemberIds',
    );
    expect(column).toBeDefined();
    expect(column!.options.name).toBe('team_member_ids');
    expect(column!.options.type).toBe('jsonb');
    expect(column!.options.nullable).toBeFalsy();
    expect((column!.options.default as () => string)()).toBe("'[]'");
    expect(upSql).toContain(`"${column!.options.name}" ${column!.options.type} NOT NULL DEFAULT '[]'::jsonb`);
  });

  describe('up()', () => {
    it('adds exactly the one column in one ALTER, with no transaction of its own', async () => {
      createRunner({ present: '0' });
      await migration.up(queryRunner as never);

      const alters = executed.filter((sql) => /ALTER TABLE/i.test(sql));
      expect(alters).toEqual([upSql]);
      expect(alters[0].match(/ADD COLUMN/g)).toHaveLength(1);
      expect(executed).toHaveLength(2);
      expect(executed.join('\n')).not.toMatch(forbidden);
      expect(executed.join('\n')).not.toMatch(/\bDROP\b/i);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('probes information_schema.columns for public.user_agents.team_member_ids', async () => {
      createRunner({ present: 0 });
      await migration.up(queryRunner as never);

      const probe = executed[0];
      expect(probe).toContain('information_schema.columns');
      expect(probe).toContain("table_schema = 'public'");
      expect(probe).toContain("table_name = 'user_agents'");
      expect(probe).toContain("column_name = 'team_member_ids'");
    });

    it.each(['1', 1])('refuses when the column exists (%p) and does not ALTER', async (present) => {
      createRunner({ present });
      await expect(migration.up(queryRunner as never)).rejects.toThrow(/already exists/);
      expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
    });

    it.each([[[]], [null], [[{}]], [[{ present_columns: 'abc' }]], [[{ present_columns: '2' }]], [[{ present_columns: '' }]]])(
      'refuses an unreadable probe %j and does not ALTER',
      async (probeRows) => {
        createRunner({ probeRows });
        await expect(migration.up(queryRunner as never)).rejects.toThrow(
          /could not read user_agents team column state/,
        );
        expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
      },
    );
  });

  describe('down()', () => {
    it('drops only team_member_ids', async () => {
      createRunner({ present: '1' });
      await migration.down(queryRunner as never);

      const alters = executed.filter((sql) => /ALTER TABLE/i.test(sql));
      expect(alters).toEqual([downSql]);
      expect(alters[0].match(/DROP COLUMN/g)).toHaveLength(1);
      expect(executed.join('\n')).not.toMatch(forbidden);
      for (const keep of ['tone', 'model', 'knowledge_scope_ids', 'connector_tool_ids', 'collaboration_rosters']) {
        expect(alters[0]).not.toContain(`"${keep}"`);
      }
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it.each(['0', 0])('refuses when the column is absent (%p) and does not DROP', async (present) => {
      createRunner({ present });
      await expect(migration.down(queryRunner as never)).rejects.toThrow(/does not exist/);
      expect(executed.some((sql) => /DROP COLUMN/i.test(sql))).toBe(false);
    });

    it('refuses an unreadable probe and does not DROP', async () => {
      createRunner({ probeRows: [] });
      await expect(migration.down(queryRunner as never)).rejects.toThrow(
        /could not read user_agents team column state/,
      );
      expect(executed.some((sql) => /DROP COLUMN/i.test(sql))).toBe(false);
    });

    it('up then down leaves the probe-driven state where it started', async () => {
      createRunner({ present: '0' });
      await migration.up(queryRunner as never);
      expect(executed.filter((sql) => /ADD COLUMN/i.test(sql))).toEqual([upSql]);
      createRunner({ present: '1' });
      await migration.down(queryRunner as never);
      expect(executed.filter((sql) => /DROP COLUMN/i.test(sql))).toEqual([downSql]);
    });
  });
});
