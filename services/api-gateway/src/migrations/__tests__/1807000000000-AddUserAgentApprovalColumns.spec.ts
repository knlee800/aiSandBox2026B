import { readdirSync } from 'fs';
import { join } from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { AddUserAgentApprovalColumns1807000000000 } from '../1807000000000-AddUserAgentApprovalColumns';
import { UserAgent } from '../../entities/user-agent.entity';
import { USER_WORKFLOW_APPROVAL_MODES } from '../../user-agent/user-workflow-rules';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not run the migration.
 */
describe('AddUserAgentApprovalColumns1807000000000 (APPROVAL-SET-01 01A, mocked)', () => {
  const timestamp = 1807000000000;

  let executed: string[];
  let queryRunner: {
    query: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
  };
  let migration: AddUserAgentApprovalColumns1807000000000;

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
    migration = new AddUserAgentApprovalColumns1807000000000();
  }

  const upSql = [
    'ALTER TABLE "public"."user_agents"',
    `  ADD COLUMN "approval_mode" varchar(16) NOT NULL DEFAULT 'every' CONSTRAINT "chk_user_agents_approval_mode" CHECK ("approval_mode" IN ('every', 'credits', 'read_only')),`,
    `  ADD COLUMN "approval_credit_limit" integer NULL CONSTRAINT "chk_user_agents_approval_credit_limit" CHECK ("approval_credit_limit" IS NULL OR "approval_credit_limit" >= 1)`,
  ].join('\n');
  const downSql = [
    'ALTER TABLE "public"."user_agents"',
    '  DROP COLUMN "approval_mode",',
    '  DROP COLUMN "approval_credit_limit"',
  ].join('\n');

  const forbidden =
    /\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b|\bINSERT\b|\bDROP TABLE\b|\bINDEX\b|\bCREATE TABLE\b|\bRENAME\b|\bIF (NOT )?EXISTS\b/i;

  it('uses a timestamp after 1806000000000-AddUserAgentTeamColumn, the latest before it', () => {
    const names = readdirSync(join(__dirname, '..')).filter(
      (name) => /^\d+-/.test(name) && name.endsWith('.ts'),
    );
    const stamps = names.map((name) => Number(name.slice(0, name.indexOf('-'))));
    expect(names.some((name) => name.startsWith('1806000000000-'))).toBe(true);
    expect(names.filter((name) => name.startsWith(`${timestamp}-`))).toEqual([
      '1807000000000-AddUserAgentApprovalColumns.ts',
    ]);
    expect(timestamp).toBeGreaterThan(1806000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp < timestamp))).toBe(1806000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp <= timestamp))).toBe(timestamp);
  });

  it('the CHECK lists exactly the approval modes the rules export', () => {
    const listed = /"approval_mode" IN \(([^)]*)\)/.exec(upSql)![1];
    expect(listed.split(', ').map((value) => value.replace(/'/g, ''))).toEqual([
      ...USER_WORKFLOW_APPROVAL_MODES,
    ]);
  });

  it('the entity maps approval_mode as varchar(16) default every and approval_credit_limit as a nullable integer', () => {
    const columns = getMetadataArgsStorage().columns.filter((entry) => entry.target === UserAgent);
    const mode = columns.find((entry) => entry.propertyName === 'approvalMode');
    const limit = columns.find((entry) => entry.propertyName === 'approvalCreditLimit');

    expect(mode).toBeDefined();
    expect(mode!.options.name).toBe('approval_mode');
    expect(mode!.options.type).toBe('varchar');
    expect(mode!.options.length).toBe(16);
    expect(mode!.options.nullable).toBeFalsy();
    expect(mode!.options.default).toBe('every');
    expect(upSql).toContain(
      `"${mode!.options.name}" ${mode!.options.type}(${mode!.options.length}) NOT NULL DEFAULT '${mode!.options.default}'`,
    );

    expect(limit).toBeDefined();
    expect(limit!.options.name).toBe('approval_credit_limit');
    expect(limit!.options.type).toBe('integer');
    expect(limit!.options.nullable).toBe(true);
    expect(limit!.options.default).toBeUndefined();
    expect(upSql).toContain(`"${limit!.options.name}" ${limit!.options.type} NULL`);
  });

  describe('up()', () => {
    it('adds exactly the two columns in one ALTER, with no transaction of its own', async () => {
      createRunner({ present: '0' });
      await migration.up(queryRunner as never);

      const alters = executed.filter((sql) => /ALTER TABLE/i.test(sql));
      expect(alters).toEqual([upSql]);
      expect(alters[0].match(/ADD COLUMN/g)).toHaveLength(2);
      expect(executed).toHaveLength(2);
      expect(executed.join('\n')).not.toMatch(forbidden);
      expect(executed.join('\n')).not.toMatch(/\bDROP\b/i);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('probes information_schema.columns for both public.user_agents approval columns', async () => {
      createRunner({ present: 0 });
      await migration.up(queryRunner as never);

      const probe = executed[0];
      expect(probe).toContain('information_schema.columns');
      expect(probe).toContain("table_schema = 'public'");
      expect(probe).toContain("table_name = 'user_agents'");
      expect(probe).toContain("column_name IN ('approval_mode', 'approval_credit_limit')");
    });

    it.each(['1', 1, '2', 2])('refuses when a column exists (%p) and does not ALTER', async (present) => {
      createRunner({ present });
      await expect(migration.up(queryRunner as never)).rejects.toThrow(/already exist/);
      expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
    });

    it.each([
      [[]],
      [null],
      [[{}]],
      [[{ present_columns: 'abc' }]],
      [[{ present_columns: '3' }]],
      [[{ present_columns: '-1' }]],
      [[{ present_columns: '' }]],
      [[{ present_columns: 1.5 }]],
    ])('refuses an unreadable probe %j and does not ALTER', async (probeRows) => {
      createRunner({ probeRows });
      await expect(migration.up(queryRunner as never)).rejects.toThrow(
        /could not read user_agents approval column state/,
      );
      expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
    });
  });

  describe('down()', () => {
    it('drops only approval_mode and approval_credit_limit', async () => {
      createRunner({ present: '2' });
      await migration.down(queryRunner as never);

      const alters = executed.filter((sql) => /ALTER TABLE/i.test(sql));
      expect(alters).toEqual([downSql]);
      expect(alters[0].match(/DROP COLUMN/g)).toHaveLength(2);
      expect(executed.join('\n')).not.toMatch(forbidden);
      for (const keep of [
        'team_member_ids',
        'tool_profile',
        'budget_per_run_credits',
        'budget_per_day_credits',
        'connector_tool_ids',
        'collaboration_rosters',
      ]) {
        expect(alters[0]).not.toContain(`"${keep}"`);
      }
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it.each(['0', 0, '1', 1])(
      'refuses when the columns are absent or only one exists (%p) and does not DROP',
      async (present) => {
        createRunner({ present });
        await expect(migration.down(queryRunner as never)).rejects.toThrow(/Refusing to drop them/);
        expect(executed.some((sql) => /DROP COLUMN/i.test(sql))).toBe(false);
      },
    );

    it('refuses an unreadable probe and does not DROP', async () => {
      createRunner({ probeRows: [] });
      await expect(migration.down(queryRunner as never)).rejects.toThrow(
        /could not read user_agents approval column state/,
      );
      expect(executed.some((sql) => /DROP COLUMN/i.test(sql))).toBe(false);
    });

    it('up then down leaves the probe-driven state where it started', async () => {
      createRunner({ present: '0' });
      await migration.up(queryRunner as never);
      expect(executed.filter((sql) => /ADD COLUMN/i.test(sql))).toEqual([upSql]);
      createRunner({ present: '2' });
      await migration.down(queryRunner as never);
      expect(executed.filter((sql) => /DROP COLUMN/i.test(sql))).toEqual([downSql]);
    });
  });
});
