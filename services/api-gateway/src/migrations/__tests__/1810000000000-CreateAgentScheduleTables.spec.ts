import { readdirSync } from 'fs';
import { join } from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { CreateAgentScheduleTables1810000000000 } from '../1810000000000-CreateAgentScheduleTables';
import { AGENT_SCHEDULE_TARGET_KINDS, AgentSchedule } from '../../entities/agent-schedule.entity';
import { AGENT_SCHEDULE_RUN_OUTCOMES, AgentScheduleRun } from '../../entities/agent-schedule-run.entity';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not run the migration.
 */
describe('CreateAgentScheduleTables1810000000000 (TRIGGER-01 S1, mocked)', () => {
  const timestamp = 1810000000000;

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
  let migration: CreateAgentScheduleTables1810000000000;

  function createRunner(
    options: { schedules?: unknown; runs?: unknown; users?: unknown; probeRows?: unknown } = {},
  ): void {
    executed = [];
    queryRunner = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      query: jest.fn(async (sql: string) => {
        executed.push(sql.trim());
        if (sql.includes('"agent_schedules_exists"')) {
          if (options.probeRows !== undefined) {
            return options.probeRows;
          }
          return [
            {
              agent_schedules_exists: options.schedules ?? false,
              agent_schedule_runs_exists: options.runs ?? false,
              users_exists: options.users ?? true,
            },
          ];
        }
        return [];
      }),
    };
    migration = new CreateAgentScheduleTables1810000000000();
  }

  const createSchedules = compact(`
    CREATE TABLE "public"."agent_schedules" (
      "id" uuid PRIMARY KEY,
      "user_id" uuid NOT NULL REFERENCES "public"."users"(id) ON DELETE CASCADE,
      "target_kind" varchar(16) NOT NULL CONSTRAINT "chk_agent_schedules_target_kind" CHECK ("target_kind" IN ('chief-of-staff', 'workflow')),
      "workflow_id" uuid NULL,
      "task" text NOT NULL CONSTRAINT "chk_agent_schedules_task" CHECK (char_length("task") BETWEEN 1 AND 8000),
      "time_of_day" smallint NOT NULL CONSTRAINT "chk_agent_schedules_time_of_day" CHECK ("time_of_day" BETWEEN 0 AND 1439),
      "days" smallint NOT NULL CONSTRAINT "chk_agent_schedules_days" CHECK ("days" BETWEEN 1 AND 127),
      "time_zone" varchar(64) NOT NULL,
      "enabled" boolean NOT NULL DEFAULT true,
      "armed_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "chk_agent_schedules_workflow_id" CHECK (("target_kind" = 'workflow' AND "workflow_id" IS NOT NULL) OR ("target_kind" = 'chief-of-staff' AND "workflow_id" IS NULL))
    )
  `);
  const createRuns = compact(`
    CREATE TABLE "public"."agent_schedule_runs" (
      "id" uuid PRIMARY KEY,
      "schedule_id" uuid NOT NULL REFERENCES "public"."agent_schedules"(id) ON DELETE CASCADE,
      "user_id" uuid NOT NULL,
      "local_date" date NOT NULL,
      "outcome" varchar(16) NOT NULL CONSTRAINT "chk_agent_schedule_runs_outcome" CHECK ("outcome" IN ('claimed', 'started', 'skipped')),
      "reason" varchar(32) NULL,
      "collaboration_run_id" text NULL,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const scheduleUserIndex =
    'CREATE INDEX "idx_agent_schedules_user_id" ON "public"."agent_schedules" ("user_id")';
  const scheduleEnabledIndex =
    'CREATE INDEX "idx_agent_schedules_enabled" ON "public"."agent_schedules" ("enabled")';
  const runUniqueIndex =
    'CREATE UNIQUE INDEX "uq_agent_schedule_runs_schedule_id_local_date" ON "public"."agent_schedule_runs" ("schedule_id", "local_date")';
  const runUserCreatedIndex =
    'CREATE INDEX "idx_agent_schedule_runs_user_id_created_at" ON "public"."agent_schedule_runs" ("user_id", "created_at")';
  const dropRuns = 'DROP TABLE "public"."agent_schedule_runs"';
  const dropSchedules = 'DROP TABLE "public"."agent_schedules"';

  const forbidden =
    /\bDELETE FROM\b|\bTRUNCATE\b|\bUPDATE\b|\bINSERT\b|\bALTER\b|\bRENAME\b|\bIF (NOT )?EXISTS\b/i;

  it('uses a timestamp after 1809000000000-CreateChatRunDeliveries, the latest before it', () => {
    const names = readdirSync(join(__dirname, '..')).filter(
      (name) => /^\d+-/.test(name) && name.endsWith('.ts'),
    );
    const stamps = names.map((name) => Number(name.slice(0, name.indexOf('-'))));
    expect(names.some((name) => name.startsWith('1809000000000-'))).toBe(true);
    expect(names.filter((name) => name.startsWith(`${timestamp}-`))).toEqual([
      '1810000000000-CreateAgentScheduleTables.ts',
    ]);
    expect(timestamp).toBeGreaterThan(1809000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp < timestamp))).toBe(1809000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp <= timestamp))).toBe(timestamp);
  });

  function expectEntityMatches(
    target: Function,
    tableName: string,
    createTable: string,
    columnNames: Record<string, string>,
    indexes: Array<[string, string[], boolean]>,
  ): void {
    const storage = getMetadataArgsStorage();
    const table = storage.tables.find((entry) => entry.target === target);
    expect(table?.name).toBe(tableName);
    expect(table?.schema).toBe('public');
    const columns = storage.columns.filter((entry) => entry.target === target);
    const names = Object.fromEntries(
      columns.map((column) => [column.propertyName, column.options.name ?? column.propertyName]),
    );
    expect(names).toEqual(columnNames);
    for (const column of columns) {
      const name = column.options.name ?? column.propertyName;
      if (column.options.length !== undefined) {
        expect(createTable).toContain(`"${name}" ${column.options.type}(${column.options.length})`);
      } else {
        expect(createTable).toContain(`"${name}" ${column.options.type}`);
      }
      if (column.options.nullable) {
        expect(createTable).toMatch(new RegExp(`"${name}" [a-z]+(\\(\\d+\\))? NULL`));
      } else {
        expect(createTable).toMatch(new RegExp(`"${name}" [a-z]+(\\(\\d+\\))? (NOT NULL|PRIMARY KEY)`));
      }
    }
    const indices = storage.indices.filter((entry) => entry.target === target);
    expect(indices.map((index) => [index.name, index.columns, index.unique ?? false]).sort()).toEqual(
      [...indexes].sort(),
    );
    expect(storage.relations.some((entry) => entry.target === target)).toBe(false);
  }

  it('AgentSchedule maps the same table, columns, indexes and target kinds', () => {
    expectEntityMatches(
      AgentSchedule,
      'agent_schedules',
      createSchedules,
      {
        id: 'id',
        userId: 'user_id',
        targetKind: 'target_kind',
        workflowId: 'workflow_id',
        task: 'task',
        timeOfDay: 'time_of_day',
        days: 'days',
        timeZone: 'time_zone',
        enabled: 'enabled',
        armedAt: 'armed_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
      [
        ['idx_agent_schedules_user_id', ['userId'], false],
        ['idx_agent_schedules_enabled', ['enabled'], false],
      ],
    );
    const check = /CHECK \("target_kind" IN \(([^)]+)\)\)/.exec(createSchedules)![1];
    expect(check.split(', ').map((value) => value.replace(/'/g, ''))).toEqual([...AGENT_SCHEDULE_TARGET_KINDS]);
  });

  it('AgentScheduleRun maps the same table, columns, indexes and outcomes', () => {
    expectEntityMatches(
      AgentScheduleRun,
      'agent_schedule_runs',
      createRuns,
      {
        id: 'id',
        scheduleId: 'schedule_id',
        userId: 'user_id',
        localDate: 'local_date',
        outcome: 'outcome',
        reason: 'reason',
        collaborationRunId: 'collaboration_run_id',
        createdAt: 'created_at',
      },
      [
        ['uq_agent_schedule_runs_schedule_id_local_date', ['scheduleId', 'localDate'], true],
        ['idx_agent_schedule_runs_user_id_created_at', ['userId', 'createdAt'], false],
      ],
    );
    const check = /CHECK \("outcome" IN \(([^)]+)\)\)/.exec(createRuns)![1];
    expect(check.split(', ').map((value) => value.replace(/'/g, ''))).toEqual([...AGENT_SCHEDULE_RUN_OUTCOMES]);
  });

  describe('up()', () => {
    it('creates both tables and their four indexes, after the probe, schedules first', async () => {
      createRunner();
      await migration.up(queryRunner as never);
      expect(executed).toHaveLength(7);
      expect(compact(executed[1])).toBe(createSchedules);
      expect(executed[2]).toBe(scheduleUserIndex);
      expect(executed[3]).toBe(scheduleEnabledIndex);
      expect(compact(executed[4])).toBe(createRuns);
      expect(executed[5]).toBe(runUniqueIndex);
      expect(executed[6]).toBe(runUserCreatedIndex);
      expect(executed.join('\n')).not.toMatch(/\bDROP\b/i);
      expect(executed.join('\n')).not.toMatch(forbidden);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('the unique (schedule_id, local_date) index is the idempotency key', () => {
      expect(runUniqueIndex).toMatch(/^CREATE UNIQUE INDEX /);
      expect(runUniqueIndex).toContain('("schedule_id", "local_date")');
    });

    it('carries the CHECKs of stage-start section 2', () => {
      expect(createSchedules).toContain(`CHECK ("target_kind" IN ('chief-of-staff', 'workflow'))`);
      expect(createSchedules).toContain('CHECK (char_length("task") BETWEEN 1 AND 8000)');
      expect(createSchedules).toContain('CHECK ("time_of_day" BETWEEN 0 AND 1439)');
      expect(createSchedules).toContain('CHECK ("days" BETWEEN 1 AND 127)');
      expect(createSchedules).toContain(
        `CHECK (("target_kind" = 'workflow' AND "workflow_id" IS NOT NULL) OR ("target_kind" = 'chief-of-staff' AND "workflow_id" IS NULL))`,
      );
      expect(createRuns).toContain(`CHECK ("outcome" IN ('claimed', 'started', 'skipped'))`);
    });

    it('both cascades: schedules go with the user, history goes with the schedule; the workflow has no foreign key', () => {
      expect(createSchedules).toContain(
        '"user_id" uuid NOT NULL REFERENCES "public"."users"(id) ON DELETE CASCADE',
      );
      expect(createRuns).toContain(
        '"schedule_id" uuid NOT NULL REFERENCES "public"."agent_schedules"(id) ON DELETE CASCADE',
      );
      expect(createSchedules.match(/REFERENCES/g)).toHaveLength(1);
      expect(createRuns.match(/REFERENCES/g)).toHaveLength(1);
      expect(createSchedules).toContain('"workflow_id" uuid NULL,');
    });

    it('the history table holds no task or result text', () => {
      expect(createRuns).not.toMatch(/task|message|summary|answer|prompt|content|result/i);
      expect(createRuns.match(/\btext\b/g)).toEqual(['text']);
      expect(createRuns).toContain('"collaboration_run_id" text NULL');
    });

    it('probes information_schema.tables for both new tables and users', async () => {
      createRunner();
      await migration.up(queryRunner as never);
      expect(executed[0]).toContain('information_schema.tables');
      expect(executed[0]).toContain("table_schema = 'public'");
      expect(executed[0]).toContain("table_name = 'agent_schedules'");
      expect(executed[0]).toContain("table_name = 'agent_schedule_runs'");
      expect(executed[0]).toContain("table_name = 'users'");
    });

    it.each([
      [{ schedules: true }],
      [{ schedules: 't' }],
      [{ runs: true }],
      [{ runs: 1 }],
      [{ schedules: true, runs: true }],
    ])('fails closed when either table already exists (%j) and does not CREATE', async (state) => {
      createRunner(state);
      await expect(migration.up(queryRunner as never)).rejects.toThrow(/already exists/);
      expect(executed.some((sql) => /CREATE/i.test(sql))).toBe(false);
    });

    it('refuses without users and does not CREATE', async () => {
      createRunner({ users: false });
      await expect(migration.up(queryRunner as never)).rejects.toThrow(/users is missing/);
      expect(executed.some((sql) => /CREATE/i.test(sql))).toBe(false);
    });

    it.each([
      [[]],
      [null],
      [[{}]],
      [[{ agent_schedules_exists: 'maybe', agent_schedule_runs_exists: false, users_exists: true }]],
    ])('refuses an unreadable probe %j and does not CREATE', async (probeRows) => {
      createRunner({ probeRows });
      await expect(migration.up(queryRunner as never)).rejects.toThrow(/could not read schedule table state/);
      expect(executed.some((sql) => /CREATE/i.test(sql))).toBe(false);
    });
  });

  describe('down()', () => {
    it('drops agent_schedule_runs then agent_schedules, nothing else', async () => {
      createRunner({ schedules: true, runs: true });
      await migration.down(queryRunner as never);
      expect(executed).toHaveLength(3);
      expect(executed[1]).toBe(dropRuns);
      expect(executed[2]).toBe(dropSchedules);
      expect(executed.join('\n')).not.toMatch(forbidden);
      expect(executed.slice(1).join('\n')).not.toMatch(/CASCADE/i);
      for (const keep of ['users', 'user_agents', 'collaboration_runs', 'audit_events', 'chat_run_deliveries']) {
        expect(executed.slice(1).join('\n')).not.toContain(`"${keep}"`);
      }
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it.each([
      [{ schedules: false, runs: false }],
      [{ schedules: true, runs: false }],
      [{ schedules: false, runs: true }],
      [{ schedules: 'f', runs: 't' }],
      [{ schedules: 0, runs: 0 }],
    ])('refuses unless both tables are present (%j) and does not DROP', async (state) => {
      createRunner(state);
      await expect(migration.down(queryRunner as never)).rejects.toThrow(/are not both present/);
      expect(executed.some((sql) => /DROP/i.test(sql))).toBe(false);
    });

    it('refuses an unreadable probe and does not DROP', async () => {
      createRunner({ probeRows: [] });
      await expect(migration.down(queryRunner as never)).rejects.toThrow(/could not read schedule table state/);
      expect(executed.some((sql) => /DROP/i.test(sql))).toBe(false);
    });

    it('up then down leaves the probe-driven state where it started', async () => {
      createRunner();
      await migration.up(queryRunner as never);
      expect(executed.filter((sql) => /CREATE TABLE/i.test(sql))).toHaveLength(2);
      createRunner({ schedules: true, runs: true });
      await migration.down(queryRunner as never);
      expect(executed.filter((sql) => /DROP TABLE/i.test(sql))).toEqual([dropRuns, dropSchedules]);
    });
  });
});
