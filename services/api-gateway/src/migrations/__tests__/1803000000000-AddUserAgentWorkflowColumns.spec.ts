import { readdirSync } from 'fs';
import { join } from 'path';
import { AddUserAgentWorkflowColumns1803000000000 } from '../1803000000000-AddUserAgentWorkflowColumns';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not run the migration.
 */
describe('AddUserAgentWorkflowColumns1803000000000 (BIZ-USER-01A, mocked)', () => {
  const timestamp = 1803000000000;

  const columns = [
    'tone',
    'reply_language',
    'purpose',
    'procedure',
    'result',
    'tool_profile',
    'knowledge_scope_ids',
    'connector_tool_ids',
    'model',
    'budget_per_run_credits',
    'budget_per_day_credits',
    'template_id',
  ];

  let executed: string[];
  let queryRunner: {
    query: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
  };
  let migration: AddUserAgentWorkflowColumns1803000000000;

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
    migration = new AddUserAgentWorkflowColumns1803000000000();
  }

  const upSql = [
    'ALTER TABLE "public"."user_agents"',
    '  ADD COLUMN "tone" varchar(120) NULL,',
    '  ADD COLUMN "reply_language" varchar(8) NULL CONSTRAINT "chk_user_agents_reply_language" CHECK ("reply_language" IS NULL OR "reply_language" IN (\'owner\', \'en\', \'zh-TW\', \'zh-CN\')),',
    '  ADD COLUMN "purpose" text NOT NULL DEFAULT \'\',',
    '  ADD COLUMN "procedure" text NOT NULL DEFAULT \'\',',
    '  ADD COLUMN "result" text NOT NULL DEFAULT \'\',',
    '  ADD COLUMN "tool_profile" varchar(8) NOT NULL DEFAULT \'read\' CONSTRAINT "chk_user_agents_tool_profile" CHECK ("tool_profile" IN (\'read\', \'review\', \'write\')),',
    '  ADD COLUMN "knowledge_scope_ids" jsonb NOT NULL DEFAULT \'[]\'::jsonb,',
    '  ADD COLUMN "connector_tool_ids" jsonb NOT NULL DEFAULT \'[]\'::jsonb,',
    '  ADD COLUMN "model" jsonb NOT NULL DEFAULT \'{"choice":"server"}\'::jsonb,',
    '  ADD COLUMN "budget_per_run_credits" integer NULL CONSTRAINT "chk_user_agents_budget_per_run_credits" CHECK ("budget_per_run_credits" IS NULL OR "budget_per_run_credits" >= 1),',
    '  ADD COLUMN "budget_per_day_credits" integer NULL CONSTRAINT "chk_user_agents_budget_per_day_credits" CHECK ("budget_per_day_credits" IS NULL OR "budget_per_day_credits" >= 1),',
    '  ADD COLUMN "template_id" varchar(64) NULL',
  ].join('\n');

  const downSql = [
    'ALTER TABLE "public"."user_agents"',
    columns.map((column) => `  DROP COLUMN "${column}"`).join(',\n'),
  ].join('\n');

  const forbidden = /\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b|\bDROP TABLE\b|\bINDEX\b|\bCREATE TABLE\b|\bRENAME\b|\bIF (NOT )?EXISTS\b/i;

  it('uses a timestamp after 1802000000000-CreateConnectorConnectionsTable, the latest before it', () => {
    const names = readdirSync(join(__dirname, '..')).filter(
      (name) => /^\d+-/.test(name) && name.endsWith('.ts'),
    );
    const stamps = names.map((name) => Number(name.slice(0, name.indexOf('-'))));
    expect(names.some((name) => name.startsWith('1802000000000-'))).toBe(true);
    expect(names.filter((name) => name.startsWith(`${timestamp}-`))).toEqual([
      '1803000000000-AddUserAgentWorkflowColumns.ts',
    ]);
    expect(timestamp).toBeGreaterThan(1802000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp < timestamp))).toBe(1802000000000);
    expect(Math.max(...stamps)).toBe(timestamp);
  });

  describe('up()', () => {
    it('adds exactly the twelve columns, their defaults and CHECKs, in one ALTER', async () => {
      createRunner({ present: '0' });
      await migration.up(queryRunner as never);

      const alters = executed.filter((sql) => /ALTER TABLE/i.test(sql));
      expect(alters).toEqual([upSql]);
      for (const column of columns) {
        expect(alters[0]).toContain(`ADD COLUMN "${column}"`);
      }
      expect(alters[0].match(/ADD COLUMN/g)).toHaveLength(12);
      expect(alters[0].match(/CHECK \(/g)).toHaveLength(4);
      expect(executed.join('\n')).not.toMatch(forbidden);
      expect(alters[0]).not.toMatch(/\brules\b/);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('probes information_schema for the twelve user_agents columns', async () => {
      createRunner({ present: 0 });
      await migration.up(queryRunner as never);

      const probe = executed[0];
      expect(probe).toContain('information_schema.columns');
      expect(probe).toContain("table_schema = 'public'");
      expect(probe).toContain("table_name = 'user_agents'");
      for (const column of columns) {
        expect(probe).toContain(`'${column}'`);
      }
    });

    it.each(['1', 1, '12', 12])('fails closed when %p columns already exist and does not ALTER', async (present) => {
      createRunner({ present });
      await expect(migration.up(queryRunner as never)).rejects.toThrow(/already exist/);
      expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
    });

    it.each([[[]], [null], [[{}]], [[{ present_columns: 'abc' }]]])(
      'refuses an unreadable probe %j and does not ALTER',
      async (probeRows) => {
        createRunner({ probeRows });
        await expect(migration.up(queryRunner as never)).rejects.toThrow(
          /could not read user_agents workflow column state/,
        );
        expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
      },
    );
  });

  describe('down()', () => {
    it('drops exactly the twelve columns and nothing else', async () => {
      createRunner({ present: '12' });
      await migration.down(queryRunner as never);

      const alters = executed.filter((sql) => /ALTER TABLE/i.test(sql));
      expect(alters).toEqual([downSql]);
      expect(alters[0].match(/DROP COLUMN/g)).toHaveLength(12);
      for (const keep of ['"id"', '"user_id"', '"name"', '"role"', '"description"', '"status"', '"initials"', '"created_at"', '"updated_at"', '"deleted_at"']) {
        expect(alters[0]).not.toContain(keep);
      }
      expect(executed.join('\n')).not.toMatch(forbidden);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it.each(['0', 0, '11', 13])('refuses when %p of the columns exist and does not DROP', async (present) => {
      createRunner({ present });
      await expect(migration.down(queryRunner as never)).rejects.toThrow(/Refusing to drop them/);
      expect(executed.some((sql) => /DROP COLUMN/i.test(sql))).toBe(false);
    });

    it('refuses an unreadable probe and does not DROP', async () => {
      createRunner({ probeRows: [] });
      await expect(migration.down(queryRunner as never)).rejects.toThrow(
        /could not read user_agents workflow column state/,
      );
      expect(executed.some((sql) => /DROP COLUMN/i.test(sql))).toBe(false);
    });
  });
});
