import { readdirSync } from 'fs';
import { join } from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { AddChainTriggerFiresOn1816000000000 } from '../1816000000000-AddChainTriggerFiresOn';
import { AGENT_CHAIN_TRIGGER_FIRES_ON, AgentChainTrigger } from '../../entities/agent-chain-trigger.entity';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not run the migration.
 */
describe('AddChainTriggerFiresOn1816000000000 (TRIGGER-CHAIN-FAILED-01 S1, mocked)', () => {
  const timestamp = 1816000000000;

  let executed: string[];
  let queryRunner: {
    query: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
  };
  let migration: AddChainTriggerFiresOn1816000000000;

  function createRunner(options: { table?: unknown; column?: unknown; probeRows?: unknown } = {}): void {
    executed = [];
    queryRunner = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      query: jest.fn(async (sql: string) => {
        executed.push(sql.trim());
        if (sql.includes('"fires_on_exists"')) {
          if (options.probeRows !== undefined) {
            return options.probeRows;
          }
          return [
            {
              agent_chain_triggers_exists: options.table ?? true,
              fires_on_exists: options.column ?? false,
            },
          ];
        }
        return [];
      }),
    };
    migration = new AddChainTriggerFiresOn1816000000000();
  }

  const upSql =
    'ALTER TABLE "public"."agent_chain_triggers" ADD COLUMN "fires_on" varchar(16) NOT NULL DEFAULT \'completed\' CONSTRAINT "chk_agent_chain_triggers_fires_on" CHECK ("fires_on" IN (\'completed\', \'failed\'))';
  const downSql = 'ALTER TABLE "public"."agent_chain_triggers" DROP COLUMN "fires_on"';
  const forbidden =
    /\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b|\bINSERT\b|\bDROP TABLE\b|\bINDEX\b|\bCREATE TABLE\b|\bRENAME\b|\bIF (NOT )?EXISTS\b|\bCASCADE\b/i;

  it('uses a timestamp after 1815000000000-AddConnectorSignInRefusedAt, the latest before it', () => {
    const names = readdirSync(join(__dirname, '..')).filter((name) => /^\d+-/.test(name) && name.endsWith('.ts'));
    const stamps = names.map((name) => Number(name.slice(0, name.indexOf('-'))));
    expect(names.some((name) => name.startsWith('1815000000000-'))).toBe(true);
    expect(names.filter((name) => name.startsWith(`${timestamp}-`))).toEqual([
      '1816000000000-AddChainTriggerFiresOn.ts',
    ]);
    expect(timestamp).toBeGreaterThan(1815000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp < timestamp))).toBe(1815000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp <= timestamp))).toBe(timestamp);
    expect(new Set(stamps).size).toBe(stamps.length);
  });

  it('AgentChainTrigger maps firesOn to the varchar(16) NOT NULL column fires_on, default completed', () => {
    const column = getMetadataArgsStorage().columns.find(
      (entry) => entry.target === AgentChainTrigger && entry.propertyName === 'firesOn',
    );
    expect(column?.options).toMatchObject({ type: 'varchar', length: 16, name: 'fires_on', default: 'completed' });
    expect(column?.options.nullable).toBeFalsy();
    expect(upSql).toContain(
      `"${column?.options.name}" ${column?.options.type}(${column?.options.length}) NOT NULL DEFAULT '${column?.options.default}'`,
    );
  });

  it('the CHECK lists exactly the entity outcomes, completed first (the default)', () => {
    const match = /CHECK \("fires_on" IN \(([^)]+)\)\)/.exec(upSql);
    expect(match).not.toBeNull();
    expect(match![1].split(', ').map((value) => value.replace(/'/g, ''))).toEqual([...AGENT_CHAIN_TRIGGER_FIRES_ON]);
    expect(AGENT_CHAIN_TRIGGER_FIRES_ON[0]).toBe('completed');
  });

  describe('up()', () => {
    it('adds exactly the one column with its default and CHECK, in one ALTER, with no rewrite', async () => {
      createRunner();
      await migration.up(queryRunner as never);

      expect(executed).toHaveLength(2);
      expect(executed[1]).toBe(upSql);
      expect(executed.filter((sql) => /ALTER TABLE/i.test(sql))).toEqual([upSql]);
      expect(executed[1].match(/ADD COLUMN/g)).toHaveLength(1);
      expect(executed[1].match(/CHECK/g)).toHaveLength(1);
      expect(executed.join('\n')).not.toMatch(forbidden);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('touches agent_chain_triggers only, never the history table or any other', async () => {
      createRunner();
      await migration.up(queryRunner as never);
      expect(executed[1]).not.toContain('agent_chain_trigger_runs');
      expect(executed[1].match(/"public"\."[a-z_]+"/g)).toEqual(['"public"."agent_chain_triggers"']);
    });

    it('probes information_schema for the table and the column', async () => {
      createRunner();
      await migration.up(queryRunner as never);

      const probe = executed[0];
      expect(probe).toContain('information_schema.tables');
      expect(probe).toContain('information_schema.columns');
      expect(probe).toContain("table_schema = 'public'");
      expect(probe).toContain("table_name = 'agent_chain_triggers'");
      expect(probe).toContain("column_name = 'fires_on'");
    });

    it.each([true, 't', 'true', 1, '1'])('refuses when the column already exists (%p) and does not ALTER', async (column) => {
      createRunner({ column });
      await expect(migration.up(queryRunner as never)).rejects.toThrow(/already exists/);
      expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
    });

    it('refuses when agent_chain_triggers is missing and does not ALTER', async () => {
      createRunner({ table: false, column: false });
      await expect(migration.up(queryRunner as never)).rejects.toThrow(/is missing/);
      expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
    });

    it.each([[[]], [null], [[{}]], [[{ agent_chain_triggers_exists: 'maybe', fires_on_exists: false }]]])(
      'refuses an unreadable probe %j and does not ALTER',
      async (probeRows) => {
        createRunner({ probeRows });
        await expect(migration.up(queryRunner as never)).rejects.toThrow(
          /could not read agent_chain_triggers column state/,
        );
        expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
      },
    );
  });

  describe('down()', () => {
    it('drops only fires_on (its CHECK goes with it), nothing else', async () => {
      createRunner({ column: true });
      await migration.down(queryRunner as never);

      expect(executed).toHaveLength(2);
      expect(executed[1]).toBe(downSql);
      expect(executed[1].match(/DROP COLUMN/g)).toHaveLength(1);
      for (const keep of [
        'id',
        'user_id',
        'source_workflow_id',
        'target_kind',
        'workflow_id',
        'task',
        'time_zone',
        'enabled',
        'armed_at',
        'created_at',
        'updated_at',
      ]) {
        expect(executed[1]).not.toContain(`"${keep}"`);
      }
      expect(executed.join('\n')).not.toMatch(forbidden);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it.each([false, 'f', 'false', 0, '0'])('refuses unless the column is present (%p) and does not DROP', async (column) => {
      createRunner({ column });
      await expect(migration.down(queryRunner as never)).rejects.toThrow(/is not present/);
      expect(executed.some((sql) => /DROP/i.test(sql))).toBe(false);
    });

    it('refuses an unreadable probe and does not DROP', async () => {
      createRunner({ probeRows: [] });
      await expect(migration.down(queryRunner as never)).rejects.toThrow(
        /could not read agent_chain_triggers column state/,
      );
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
