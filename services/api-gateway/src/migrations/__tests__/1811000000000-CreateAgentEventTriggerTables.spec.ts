import { readdirSync } from 'fs';
import { join } from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { CreateAgentEventTriggerTables1811000000000 } from '../1811000000000-CreateAgentEventTriggerTables';
import {
  AGENT_EVENT_TRIGGER_CALENDAR_STATES,
  AGENT_EVENT_TRIGGER_TARGET_KINDS,
  AgentEventTrigger,
} from '../../entities/agent-event-trigger.entity';
import {
  AGENT_EVENT_TRIGGER_RUN_OUTCOMES,
  AgentEventTriggerRun,
} from '../../entities/agent-event-trigger-run.entity';
import { AGENT_SCHEDULE_TARGET_KINDS } from '../../entities/agent-schedule.entity';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not run the migration.
 */
describe('CreateAgentEventTriggerTables1811000000000 (TRIGGER-EVENT-01 S2, mocked)', () => {
  const timestamp = 1811000000000;

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
  let migration: CreateAgentEventTriggerTables1811000000000;

  function createRunner(
    options: { triggers?: unknown; runs?: unknown; users?: unknown; probeRows?: unknown } = {},
  ): void {
    executed = [];
    queryRunner = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      query: jest.fn(async (sql: string) => {
        executed.push(sql.trim());
        if (sql.includes('"agent_event_triggers_exists"')) {
          if (options.probeRows !== undefined) {
            return options.probeRows;
          }
          return [
            {
              agent_event_triggers_exists: options.triggers ?? false,
              agent_event_trigger_runs_exists: options.runs ?? false,
              users_exists: options.users ?? true,
            },
          ];
        }
        return [];
      }),
    };
    migration = new CreateAgentEventTriggerTables1811000000000();
  }

  const createTriggers = compact(`
    CREATE TABLE "public"."agent_event_triggers" (
      "id" uuid PRIMARY KEY,
      "user_id" uuid NOT NULL REFERENCES "public"."users"(id) ON DELETE CASCADE,
      "target_kind" varchar(16) NOT NULL CONSTRAINT "chk_agent_event_triggers_target_kind" CHECK ("target_kind" IN ('chief-of-staff', 'workflow')),
      "workflow_id" uuid NULL,
      "task" text NOT NULL CONSTRAINT "chk_agent_event_triggers_task" CHECK (char_length("task") BETWEEN 1 AND 7500),
      "lead_minutes" smallint NOT NULL DEFAULT 15 CONSTRAINT "chk_agent_event_triggers_lead_minutes" CHECK ("lead_minutes" BETWEEN 5 AND 120),
      "title_filter" varchar(100) NULL,
      "time_zone" varchar(64) NOT NULL,
      "enabled" boolean NOT NULL DEFAULT true,
      "armed_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "calendar_state" varchar(32) NOT NULL DEFAULT 'ok' CONSTRAINT "chk_agent_event_triggers_calendar_state" CHECK ("calendar_state" IN ('ok', 'connector_missing', 'read_failed')),
      "calendar_state_at" timestamptz NULL,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "chk_agent_event_triggers_workflow_id" CHECK (("target_kind" = 'workflow' AND "workflow_id" IS NOT NULL) OR ("target_kind" = 'chief-of-staff' AND "workflow_id" IS NULL))
    )
  `);
  const createRuns = compact(`
    CREATE TABLE "public"."agent_event_trigger_runs" (
      "id" uuid PRIMARY KEY,
      "trigger_id" uuid NOT NULL REFERENCES "public"."agent_event_triggers"(id) ON DELETE CASCADE,
      "user_id" uuid NOT NULL,
      "occurrence_key" char(64) NOT NULL,
      "event_start" timestamptz NOT NULL,
      "local_date" date NOT NULL,
      "outcome" varchar(16) NOT NULL CONSTRAINT "chk_agent_event_trigger_runs_outcome" CHECK ("outcome" IN ('claimed', 'started', 'skipped')),
      "reason" varchar(32) NULL,
      "collaboration_run_id" text NULL,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const triggerUserIndex =
    'CREATE INDEX "idx_agent_event_triggers_user_id" ON "public"."agent_event_triggers" ("user_id")';
  const triggerEnabledIndex =
    'CREATE INDEX "idx_agent_event_triggers_enabled" ON "public"."agent_event_triggers" ("enabled")';
  const runUniqueIndex =
    'CREATE UNIQUE INDEX "uq_agent_event_trigger_runs_trigger_id_occurrence_key" ON "public"."agent_event_trigger_runs" ("trigger_id", "occurrence_key")';
  const runUserCreatedIndex =
    'CREATE INDEX "idx_agent_event_trigger_runs_user_id_created_at" ON "public"."agent_event_trigger_runs" ("user_id", "created_at")';
  const runTriggerDateIndex =
    'CREATE INDEX "idx_agent_event_trigger_runs_trigger_id_local_date" ON "public"."agent_event_trigger_runs" ("trigger_id", "local_date")';
  const dropRuns = 'DROP TABLE "public"."agent_event_trigger_runs"';
  const dropTriggers = 'DROP TABLE "public"."agent_event_triggers"';

  const forbidden =
    /\bDELETE FROM\b|\bTRUNCATE\b|\bUPDATE\b|\bINSERT\b|\bALTER\b|\bRENAME\b|\bIF (NOT )?EXISTS\b/i;

  it('uses a timestamp after 1810000000000-CreateAgentScheduleTables, the latest before it', () => {
    const names = readdirSync(join(__dirname, '..')).filter(
      (name) => /^\d+-/.test(name) && name.endsWith('.ts'),
    );
    const stamps = names.map((name) => Number(name.slice(0, name.indexOf('-'))));
    expect(names.some((name) => name.startsWith('1810000000000-'))).toBe(true);
    expect(names.filter((name) => name.startsWith(`${timestamp}-`))).toEqual([
      '1811000000000-CreateAgentEventTriggerTables.ts',
    ]);
    expect(timestamp).toBeGreaterThan(1810000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp < timestamp))).toBe(1810000000000);
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

  function checkValues(sql: string, column: string): string[] {
    const match = new RegExp(`CHECK \\("${column}" IN \\(([^)]+)\\)\\)`).exec(sql);
    expect(match).not.toBeNull();
    return match![1].split(', ').map((value) => value.replace(/'/g, ''));
  }

  it('AgentEventTrigger maps the same table, columns, indexes, target kinds and calendar states', () => {
    expectEntityMatches(
      AgentEventTrigger,
      'agent_event_triggers',
      createTriggers,
      {
        id: 'id',
        userId: 'user_id',
        targetKind: 'target_kind',
        workflowId: 'workflow_id',
        task: 'task',
        leadMinutes: 'lead_minutes',
        titleFilter: 'title_filter',
        timeZone: 'time_zone',
        enabled: 'enabled',
        armedAt: 'armed_at',
        calendarState: 'calendar_state',
        calendarStateAt: 'calendar_state_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
      [
        ['idx_agent_event_triggers_user_id', ['userId'], false],
        ['idx_agent_event_triggers_enabled', ['enabled'], false],
      ],
    );
    expect(checkValues(createTriggers, 'target_kind')).toEqual([...AGENT_EVENT_TRIGGER_TARGET_KINDS]);
    expect([...AGENT_EVENT_TRIGGER_TARGET_KINDS]).toEqual([...AGENT_SCHEDULE_TARGET_KINDS]);
    expect(checkValues(createTriggers, 'calendar_state')).toEqual([...AGENT_EVENT_TRIGGER_CALENDAR_STATES]);
  });

  it('AgentEventTriggerRun maps the same table, columns, indexes and outcomes', () => {
    expectEntityMatches(
      AgentEventTriggerRun,
      'agent_event_trigger_runs',
      createRuns,
      {
        id: 'id',
        triggerId: 'trigger_id',
        userId: 'user_id',
        occurrenceKey: 'occurrence_key',
        eventStart: 'event_start',
        localDate: 'local_date',
        outcome: 'outcome',
        reason: 'reason',
        collaborationRunId: 'collaboration_run_id',
        createdAt: 'created_at',
      },
      [
        ['uq_agent_event_trigger_runs_trigger_id_occurrence_key', ['triggerId', 'occurrenceKey'], true],
        ['idx_agent_event_trigger_runs_user_id_created_at', ['userId', 'createdAt'], false],
        ['idx_agent_event_trigger_runs_trigger_id_local_date', ['triggerId', 'localDate'], false],
      ],
    );
    expect(checkValues(createRuns, 'outcome')).toEqual([...AGENT_EVENT_TRIGGER_RUN_OUTCOMES]);
  });

  describe('up()', () => {
    it('creates both tables and their five indexes, after the probe, triggers first', async () => {
      createRunner();
      await migration.up(queryRunner as never);
      expect(executed).toHaveLength(8);
      expect(compact(executed[1])).toBe(createTriggers);
      expect(executed[2]).toBe(triggerUserIndex);
      expect(executed[3]).toBe(triggerEnabledIndex);
      expect(compact(executed[4])).toBe(createRuns);
      expect(executed[5]).toBe(runUniqueIndex);
      expect(executed[6]).toBe(runUserCreatedIndex);
      expect(executed[7]).toBe(runTriggerDateIndex);
      expect(executed.join('\n')).not.toMatch(/\bDROP\b/i);
      expect(executed.join('\n')).not.toMatch(forbidden);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('the unique (trigger_id, occurrence_key) index is the idempotency key', () => {
      expect(runUniqueIndex).toMatch(/^CREATE UNIQUE INDEX /);
      expect(runUniqueIndex).toContain('("trigger_id", "occurrence_key")');
      expect(createRuns).toContain('"occurrence_key" char(64) NOT NULL');
      expect(runTriggerDateIndex).toMatch(/^CREATE INDEX /);
    });

    it('carries the CHECKs of stage-start section 2', () => {
      expect(createTriggers).toContain(`CHECK ("target_kind" IN ('chief-of-staff', 'workflow'))`);
      expect(createTriggers).toContain('CHECK (char_length("task") BETWEEN 1 AND 7500)');
      expect(createTriggers).toContain('"lead_minutes" smallint NOT NULL DEFAULT 15');
      expect(createTriggers).toContain('CHECK ("lead_minutes" BETWEEN 5 AND 120)');
      expect(createTriggers).toContain('"title_filter" varchar(100) NULL');
      expect(createTriggers).toContain(
        `"calendar_state" varchar(32) NOT NULL DEFAULT 'ok' CONSTRAINT "chk_agent_event_triggers_calendar_state" CHECK ("calendar_state" IN ('ok', 'connector_missing', 'read_failed'))`,
      );
      expect(createTriggers).toContain('"enabled" boolean NOT NULL DEFAULT true');
      expect(createTriggers).toContain(
        `CHECK (("target_kind" = 'workflow' AND "workflow_id" IS NOT NULL) OR ("target_kind" = 'chief-of-staff' AND "workflow_id" IS NULL))`,
      );
      expect(createRuns).toContain(`CHECK ("outcome" IN ('claimed', 'started', 'skipped'))`);
    });

    it('both cascades: triggers go with the user, history goes with the trigger; the workflow has no foreign key', () => {
      expect(createTriggers).toContain(
        '"user_id" uuid NOT NULL REFERENCES "public"."users"(id) ON DELETE CASCADE',
      );
      expect(createRuns).toContain(
        '"trigger_id" uuid NOT NULL REFERENCES "public"."agent_event_triggers"(id) ON DELETE CASCADE',
      );
      expect(createTriggers.match(/REFERENCES/g)).toHaveLength(1);
      expect(createRuns.match(/REFERENCES/g)).toHaveLength(1);
      expect(createTriggers).toContain('"workflow_id" uuid NULL,');
    });

    it('the history table holds no task, title, filter, uid or result text', () => {
      expect(createRuns).not.toMatch(/task|title|filter|\buid\b|message|summary|answer|prompt|content|result|organizer|attendee/i);
      expect(createRuns.match(/\btext\b/g)).toEqual(['text']);
      expect(createRuns).toContain('"collaboration_run_id" text NULL');
    });

    it('probes information_schema.tables for both new tables and users', async () => {
      createRunner();
      await migration.up(queryRunner as never);
      expect(executed[0]).toContain('information_schema.tables');
      expect(executed[0]).toContain("table_schema = 'public'");
      expect(executed[0]).toContain("table_name = 'agent_event_triggers'");
      expect(executed[0]).toContain("table_name = 'agent_event_trigger_runs'");
      expect(executed[0]).toContain("table_name = 'users'");
    });

    it.each([
      [{ triggers: true }],
      [{ triggers: 't' }],
      [{ runs: true }],
      [{ runs: 1 }],
      [{ triggers: true, runs: true }],
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
      [[{ agent_event_triggers_exists: 'maybe', agent_event_trigger_runs_exists: false, users_exists: true }]],
    ])('refuses an unreadable probe %j and does not CREATE', async (probeRows) => {
      createRunner({ probeRows });
      await expect(migration.up(queryRunner as never)).rejects.toThrow(/could not read event trigger table state/);
      expect(executed.some((sql) => /CREATE/i.test(sql))).toBe(false);
    });
  });

  describe('down()', () => {
    it('drops agent_event_trigger_runs then agent_event_triggers, nothing else', async () => {
      createRunner({ triggers: true, runs: true });
      await migration.down(queryRunner as never);
      expect(executed).toHaveLength(3);
      expect(executed[1]).toBe(dropRuns);
      expect(executed[2]).toBe(dropTriggers);
      expect(executed.join('\n')).not.toMatch(forbidden);
      expect(executed.slice(1).join('\n')).not.toMatch(/CASCADE/i);
      for (const keep of [
        'users',
        'user_agents',
        'collaboration_runs',
        'audit_events',
        'agent_schedules',
        'agent_schedule_runs',
        'connector_connections',
      ]) {
        expect(executed.slice(1).join('\n')).not.toContain(`"${keep}"`);
      }
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it.each([
      [{ triggers: false, runs: false }],
      [{ triggers: true, runs: false }],
      [{ triggers: false, runs: true }],
      [{ triggers: 'f', runs: 't' }],
      [{ triggers: 0, runs: 0 }],
    ])('refuses unless both tables are present (%j) and does not DROP', async (state) => {
      createRunner(state);
      await expect(migration.down(queryRunner as never)).rejects.toThrow(/are not both present/);
      expect(executed.some((sql) => /DROP/i.test(sql))).toBe(false);
    });

    it('refuses an unreadable probe and does not DROP', async () => {
      createRunner({ probeRows: [] });
      await expect(migration.down(queryRunner as never)).rejects.toThrow(/could not read event trigger table state/);
      expect(executed.some((sql) => /DROP/i.test(sql))).toBe(false);
    });

    it('up then down leaves the probe-driven state where it started', async () => {
      createRunner();
      await migration.up(queryRunner as never);
      expect(executed.filter((sql) => /CREATE TABLE/i.test(sql))).toHaveLength(2);
      createRunner({ triggers: true, runs: true });
      await migration.down(queryRunner as never);
      expect(executed.filter((sql) => /DROP TABLE/i.test(sql))).toEqual([dropRuns, dropTriggers]);
    });
  });
});
