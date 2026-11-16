import { readdirSync } from 'fs';
import { join } from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { CreateAgentKnowledgeTriggerTables1813000000000 } from '../1813000000000-CreateAgentKnowledgeTriggerTables';
import {
  AGENT_KNOWLEDGE_TRIGGER_TARGET_KINDS,
  AgentKnowledgeTrigger,
} from '../../entities/agent-knowledge-trigger.entity';
import {
  AGENT_KNOWLEDGE_TRIGGER_RUN_OUTCOMES,
  AgentKnowledgeTriggerRun,
} from '../../entities/agent-knowledge-trigger-run.entity';
import { AGENT_MAIL_TRIGGER_RUN_OUTCOMES } from '../../entities/agent-mail-trigger-run.entity';
import { AGENT_SCHEDULE_TARGET_KINDS } from '../../entities/agent-schedule.entity';
import { KNOWLEDGE_SCOPE_ID_VALUES } from '../../knowledge/knowledge-scopes';
import { KNOWLEDGE_TRIGGER_TASK_MAX_CHARS } from '../../triggers/knowledge-trigger-validation';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not run the migration.
 */
describe('CreateAgentKnowledgeTriggerTables1813000000000 (TRIGGER-MORE-01 S1, mocked)', () => {
  const timestamp = 1813000000000;

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
  let migration: CreateAgentKnowledgeTriggerTables1813000000000;

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
        if (sql.includes('"agent_knowledge_triggers_exists"')) {
          if (options.probeRows !== undefined) {
            return options.probeRows;
          }
          return [
            {
              agent_knowledge_triggers_exists: options.triggers ?? false,
              agent_knowledge_trigger_runs_exists: options.runs ?? false,
              users_exists: options.users ?? true,
            },
          ];
        }
        return [];
      }),
    };
    migration = new CreateAgentKnowledgeTriggerTables1813000000000();
  }

  const createTriggers = compact(`
    CREATE TABLE "public"."agent_knowledge_triggers" (
      "id" uuid PRIMARY KEY,
      "user_id" uuid NOT NULL REFERENCES "public"."users"(id) ON DELETE CASCADE,
      "target_kind" varchar(16) NOT NULL CONSTRAINT "chk_agent_knowledge_triggers_target_kind" CHECK ("target_kind" IN ('chief-of-staff', 'workflow')),
      "workflow_id" uuid NULL,
      "task" text NOT NULL CONSTRAINT "chk_agent_knowledge_triggers_task" CHECK (char_length("task") BETWEEN 1 AND 7000),
      "scope_id" varchar(64) NOT NULL CONSTRAINT "chk_agent_knowledge_triggers_scope_id" CHECK (char_length("scope_id") BETWEEN 1 AND 64),
      "time_zone" varchar(64) NOT NULL,
      "enabled" boolean NOT NULL DEFAULT true,
      "armed_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "chk_agent_knowledge_triggers_workflow_id" CHECK (("target_kind" = 'workflow' AND "workflow_id" IS NOT NULL) OR ("target_kind" = 'chief-of-staff' AND "workflow_id" IS NULL))
    )
  `);
  const createRuns = compact(`
    CREATE TABLE "public"."agent_knowledge_trigger_runs" (
      "id" uuid PRIMARY KEY,
      "trigger_id" uuid NOT NULL REFERENCES "public"."agent_knowledge_triggers"(id) ON DELETE CASCADE,
      "user_id" uuid NOT NULL,
      "document_id" uuid NOT NULL,
      "document_key" char(64) NOT NULL,
      "changed_at" timestamptz NOT NULL,
      "local_date" date NOT NULL,
      "outcome" varchar(16) NOT NULL CONSTRAINT "chk_agent_knowledge_trigger_runs_outcome" CHECK ("outcome" IN ('claimed', 'started', 'skipped')),
      "reason" varchar(32) NULL,
      "collaboration_run_id" text NULL,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const triggerUserIndex =
    'CREATE INDEX "idx_agent_knowledge_triggers_user_id" ON "public"."agent_knowledge_triggers" ("user_id")';
  const triggerEnabledIndex =
    'CREATE INDEX "idx_agent_knowledge_triggers_enabled" ON "public"."agent_knowledge_triggers" ("enabled")';
  const runUniqueIndex =
    'CREATE UNIQUE INDEX "uq_agent_knowledge_trigger_runs_trigger_id_document_key" ON "public"."agent_knowledge_trigger_runs" ("trigger_id", "document_key")';
  const runUserCreatedIndex =
    'CREATE INDEX "idx_agent_knowledge_trigger_runs_user_id_created_at" ON "public"."agent_knowledge_trigger_runs" ("user_id", "created_at")';
  const runTriggerDateIndex =
    'CREATE INDEX "idx_agent_knowledge_trigger_runs_trigger_id_local_date" ON "public"."agent_knowledge_trigger_runs" ("trigger_id", "local_date")';
  const dropRuns = 'DROP TABLE "public"."agent_knowledge_trigger_runs"';
  const dropTriggers = 'DROP TABLE "public"."agent_knowledge_triggers"';

  const forbidden =
    /\bDELETE FROM\b|\bTRUNCATE\b|\bUPDATE\b|\bINSERT\b|\bALTER\b|\bRENAME\b|\bIF (NOT )?EXISTS\b/i;

  it('uses a timestamp after 1812000000000-CreateAgentMailTriggerTables, the latest before it', () => {
    const names = readdirSync(join(__dirname, '..')).filter(
      (name) => /^\d+-/.test(name) && name.endsWith('.ts'),
    );
    const stamps = names.map((name) => Number(name.slice(0, name.indexOf('-'))));
    expect(names.some((name) => name.startsWith('1812000000000-'))).toBe(true);
    expect(names.filter((name) => name.startsWith(`${timestamp}-`))).toEqual([
      '1813000000000-CreateAgentKnowledgeTriggerTables.ts',
    ]);
    expect(timestamp).toBeGreaterThan(1812000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp < timestamp))).toBe(1812000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp <= timestamp))).toBe(timestamp);
    expect(new Set(stamps).size).toBe(stamps.length);
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

  it('AgentKnowledgeTrigger maps the same table, columns, indexes and target kinds', () => {
    expectEntityMatches(
      AgentKnowledgeTrigger,
      'agent_knowledge_triggers',
      createTriggers,
      {
        id: 'id',
        userId: 'user_id',
        targetKind: 'target_kind',
        workflowId: 'workflow_id',
        task: 'task',
        scopeId: 'scope_id',
        timeZone: 'time_zone',
        enabled: 'enabled',
        armedAt: 'armed_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
      [
        ['idx_agent_knowledge_triggers_user_id', ['userId'], false],
        ['idx_agent_knowledge_triggers_enabled', ['enabled'], false],
      ],
    );
    expect(checkValues(createTriggers, 'target_kind')).toEqual([...AGENT_KNOWLEDGE_TRIGGER_TARGET_KINDS]);
    expect([...AGENT_KNOWLEDGE_TRIGGER_TARGET_KINDS]).toEqual([...AGENT_SCHEDULE_TARGET_KINDS]);
  });

  it('AgentKnowledgeTriggerRun maps the same table, columns, indexes and outcomes', () => {
    expectEntityMatches(
      AgentKnowledgeTriggerRun,
      'agent_knowledge_trigger_runs',
      createRuns,
      {
        id: 'id',
        triggerId: 'trigger_id',
        userId: 'user_id',
        documentId: 'document_id',
        documentKey: 'document_key',
        changedAt: 'changed_at',
        localDate: 'local_date',
        outcome: 'outcome',
        reason: 'reason',
        collaborationRunId: 'collaboration_run_id',
        createdAt: 'created_at',
      },
      [
        ['uq_agent_knowledge_trigger_runs_trigger_id_document_key', ['triggerId', 'documentKey'], true],
        ['idx_agent_knowledge_trigger_runs_user_id_created_at', ['userId', 'createdAt'], false],
        ['idx_agent_knowledge_trigger_runs_trigger_id_local_date', ['triggerId', 'localDate'], false],
      ],
    );
    expect(checkValues(createRuns, 'outcome')).toEqual([...AGENT_KNOWLEDGE_TRIGGER_RUN_OUTCOMES]);
    expect([...AGENT_KNOWLEDGE_TRIGGER_RUN_OUTCOMES]).toEqual([...AGENT_MAIL_TRIGGER_RUN_OUTCOMES]);
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

    it('the unique (trigger_id, document_key) index is the idempotency key', () => {
      expect(runUniqueIndex).toMatch(/^CREATE UNIQUE INDEX /);
      expect(runUniqueIndex).toContain('("trigger_id", "document_key")');
      expect(createRuns).toContain('"document_key" char(64) NOT NULL');
      expect(runTriggerDateIndex).toMatch(/^CREATE INDEX /);
      expect(runTriggerDateIndex).toContain('("trigger_id", "local_date")');
      expect(runUserCreatedIndex).toContain('("user_id", "created_at")');
    });

    it('carries the CHECKs of stage-start section 4, with the limits the routes use', () => {
      expect(KNOWLEDGE_TRIGGER_TASK_MAX_CHARS).toBe(7000);
      expect(createTriggers).toContain(`CHECK ("target_kind" IN ('chief-of-staff', 'workflow'))`);
      expect(createTriggers).toContain(
        `CHECK (char_length("task") BETWEEN 1 AND ${KNOWLEDGE_TRIGGER_TASK_MAX_CHARS})`,
      );
      expect(createTriggers).toContain(
        `"scope_id" varchar(64) NOT NULL CONSTRAINT "chk_agent_knowledge_triggers_scope_id" CHECK (char_length("scope_id") BETWEEN 1 AND 64)`,
      );
      // Every one of the nine folder ids fits the column (knowledge_documents.scope_id is varchar(64) too).
      for (const id of KNOWLEDGE_SCOPE_ID_VALUES) {
        expect(id.length).toBeGreaterThanOrEqual(1);
        expect(id.length).toBeLessThanOrEqual(64);
      }
      expect(createTriggers).toContain('"enabled" boolean NOT NULL DEFAULT true');
      expect(createTriggers).toContain('"armed_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP');
      expect(createTriggers).toContain(
        `CHECK (("target_kind" = 'workflow' AND "workflow_id" IS NOT NULL) OR ("target_kind" = 'chief-of-staff' AND "workflow_id" IS NULL))`,
      );
      expect(createTriggers).not.toMatch(/sender_filter|subject_filter|mail_state|lead_minutes|calendar_state/);
      expect(createRuns).toContain(`CHECK ("outcome" IN ('claimed', 'started', 'skipped'))`);
      expect(createRuns).toContain('"changed_at" timestamptz NOT NULL');
      expect(createRuns).toContain('"document_id" uuid NOT NULL');
      expect(createRuns).not.toMatch(/message_key|arrived_at|event_start|occurrence_key/);
    });

    it('the new time columns are timestamptz, as 1812', () => {
      for (const column of ['armed_at', 'created_at', 'updated_at']) {
        expect(createTriggers).toContain(`"${column}" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP`);
      }
      expect(createRuns).toContain('"changed_at" timestamptz NOT NULL');
      expect(createRuns).toContain('"created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP');
      expect(`${createTriggers} ${createRuns}`).not.toMatch(/\btimestamp\b(?!tz)/);
    });

    it('both cascades: triggers go with the user, history goes with the trigger; no foreign key to the workflow or the document', () => {
      expect(createTriggers).toContain(
        '"user_id" uuid NOT NULL REFERENCES "public"."users"(id) ON DELETE CASCADE',
      );
      expect(createRuns).toContain(
        '"trigger_id" uuid NOT NULL REFERENCES "public"."agent_knowledge_triggers"(id) ON DELETE CASCADE',
      );
      expect(createTriggers.match(/REFERENCES/g)).toHaveLength(1);
      expect(createRuns.match(/REFERENCES/g)).toHaveLength(1);
      expect(createTriggers).toContain('"workflow_id" uuid NULL,');
      expect(createRuns).not.toContain('knowledge_documents');
    });

    it('the history table holds no title, content, content hash, task or result text', () => {
      expect(createRuns).not.toMatch(
        /task|title|content|hash|byte_size|scope|filter|summary|answer|prompt|result/i,
      );
      expect(createRuns.match(/\btext\b/g)).toEqual(['text']);
      expect(createRuns).toContain('"collaboration_run_id" text NULL');
    });

    it('probes information_schema.tables for both new tables and users', async () => {
      createRunner();
      await migration.up(queryRunner as never);
      expect(executed[0]).toContain('information_schema.tables');
      expect(executed[0]).toContain("table_schema = 'public'");
      expect(executed[0]).toContain("table_name = 'agent_knowledge_triggers'");
      expect(executed[0]).toContain("table_name = 'agent_knowledge_trigger_runs'");
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
      [[{ agent_knowledge_triggers_exists: 'maybe', agent_knowledge_trigger_runs_exists: false, users_exists: true }]],
    ])('refuses an unreadable probe %j and does not CREATE', async (probeRows) => {
      createRunner({ probeRows });
      await expect(migration.up(queryRunner as never)).rejects.toThrow(/could not read knowledge trigger table state/);
      expect(executed.some((sql) => /CREATE/i.test(sql))).toBe(false);
    });
  });

  describe('down()', () => {
    it('drops agent_knowledge_trigger_runs then agent_knowledge_triggers, nothing else', async () => {
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
        'knowledge_documents',
        'agent_schedules',
        'agent_schedule_runs',
        'agent_event_triggers',
        'agent_event_trigger_runs',
        'agent_mail_triggers',
        'agent_mail_trigger_runs',
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
      await expect(migration.down(queryRunner as never)).rejects.toThrow(
        /could not read knowledge trigger table state/,
      );
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
