import { HttpException, Logger } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { AgentSchedule } from '../entities/agent-schedule.entity';
import { AgentScheduleRun } from '../entities/agent-schedule-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { UserAgent } from '../entities/user-agent.entity';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import {
  SCHEDULE_HISTORY_LIMIT,
  SCHEDULE_LIMIT_LOCK_NAMESPACE,
  ScheduleService,
  TRIGGER_AUDIT_CATEGORY,
  TRIGGER_AUDIT_SUBJECT_TYPE,
} from './schedule.service';
import { SCHEDULE_ERROR_CODES } from './schedule-validation';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const OWN_WORKFLOW = '33333333-3333-4333-8333-333333333333';
const OTHER_WORKFLOW = '44444444-4444-4444-8444-444444444444';
const DELETED_WORKFLOW = '55555555-5555-4555-8555-555555555555';
const UNKNOWN_ID = '66666666-6666-4666-8666-666666666666';
const MARKER = 'MARKER-TASK-7f3a';

function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    target: { kind: 'chief-of-staff' },
    task: `${MARKER} summarise my inbox`,
    timeOfDay: '07:30',
    days: [1, 3, 5],
    timeZone: 'Asia/Taipei',
    ...overrides,
  };
}

async function refusal(work: () => Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    await work();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const http = error as HttpException;
    return { status: http.getStatus(), body: http.getResponse() as Record<string, unknown> };
  }
  throw new Error('expected a refusal');
}

describe('ScheduleService (TRIGGER-01 S1)', () => {
  const originalSchedules = process.env.SCHEDULES_ENABLED;
  let store: MemoryStore;
  let service: ScheduleService;
  let logs: string[];
  let restoreLogs: () => void;

  beforeEach(() => {
    delete process.env.SCHEDULES_ENABLED;
    store = new MemoryStore();
    store.workflows.rows.push(
      workflowRow(OWN_WORKFLOW, OWNER, 'Morning briefing', 'active'),
      workflowRow(OTHER_WORKFLOW, OTHER, 'Not yours', 'active'),
      { ...workflowRow(DELETED_WORKFLOW, OWNER, 'Deleted', 'active'), deletedAt: new Date('2026-11-01T00:00:00Z') },
    );
    service = new ScheduleService(store.schedules as never, store.runs as never, store.workflows as never);
    logs = [];
    restoreLogs = watchLogs(logs);
  });

  afterEach(() => {
    restoreLogs();
    jest.useRealTimers();
    if (originalSchedules === undefined) delete process.env.SCHEDULES_ENABLED;
    else process.env.SCHEDULES_ENABLED = originalSchedules;
  });

  function at(iso: string): void {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(new Date(iso));
  }

  function writes(): string[] {
    return store.calls.filter((call) => /\.(insert|update|delete)$/.test(call));
  }

  describe('create', () => {
    it('stores the schedule, arms it at create, and answers the section 7 view', async () => {
      const view = await service.create(OWNER, body());
      expect(store.schedules.rows).toHaveLength(1);
      const row = store.schedules.rows[0];
      expect(row).toMatchObject({
        id: view.id,
        userId: OWNER,
        targetKind: 'chief-of-staff',
        workflowId: null,
        task: `${MARKER} summarise my inbox`,
        timeOfDay: 450,
        days: 1 + 4 + 16,
        timeZone: 'Asia/Taipei',
        enabled: true,
      });
      expect(row.armedAt.getTime()).toBe(row.createdAt.getTime());
      expect(view).toEqual({
        id: row.id,
        target: { kind: 'chief-of-staff' },
        task: `${MARKER} summarise my inbox`,
        timeOfDay: '07:30',
        days: [1, 3, 5],
        timeZone: 'Asia/Taipei',
        enabled: true,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        lastRun: null,
      });
      expect(view.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('writes one schedule_created audit row with ids and the target kind only', async () => {
      const view = await service.create(OWNER, body({ target: { kind: 'workflow', workflowId: OWN_WORKFLOW } }));
      expect(store.audit.rows).toHaveLength(1);
      expect(store.audit.rows[0]).toMatchObject({
        category: TRIGGER_AUDIT_CATEGORY,
        eventType: 'schedule_created',
        subjectType: TRIGGER_AUDIT_SUBJECT_TYPE,
        subjectId: view.id,
        userId: OWNER,
        payload: { scheduleId: view.id, targetKind: 'workflow', workflowId: OWN_WORKFLOW },
      });
      expect(Object.keys(store.audit.rows[0].payload).sort()).toEqual(['scheduleId', 'targetKind', 'workflowId']);
      expect(TRIGGER_AUDIT_CATEGORY).toBe('trigger');
      expect(TRIGGER_AUDIT_SUBJECT_TYPE).toBe('agent_schedule');
    });

    it("a schedule for the owner's own workflow carries its name and status", async () => {
      const view = await service.create(OWNER, body({ target: { kind: 'workflow', workflowId: OWN_WORKFLOW } }));
      expect(view.target).toEqual({
        kind: 'workflow',
        workflowId: OWN_WORKFLOW,
        name: 'Morning briefing',
        status: 'active',
      });
      expect(store.schedules.rows[0]).toMatchObject({ targetKind: 'workflow', workflowId: OWN_WORKFLOW });
    });

    it('an off or draft workflow may be saved (it is refused at run time, slice S2)', async () => {
      store.workflows.rows[0].status = 'disabled';
      const off = await service.create(OWNER, body({ target: { kind: 'workflow', workflowId: OWN_WORKFLOW } }));
      expect(off.target).toMatchObject({ status: 'disabled' });
      store.workflows.rows[0].status = 'draft';
      const draft = await service.create(OWNER, body({ target: { kind: 'workflow', workflowId: OWN_WORKFLOW } }));
      expect(draft.target).toMatchObject({ status: 'draft' });
    });

    it.each([
      ["another owner's", OTHER_WORKFLOW],
      ['an unknown', UNKNOWN_ID],
      ['a deleted', DELETED_WORKFLOW],
      ['a malformed', 'not-a-uuid'],
    ])('%s workflow answers 404 and writes nothing', async (_label, workflowId) => {
      const { status, body: response } = await refusal(() =>
        service.create(OWNER, body({ target: { kind: 'workflow', workflowId } })),
      );
      expect(status).toBe(404);
      expect(response.code).toBe(SCHEDULE_ERROR_CODES.workflowNotFound);
      expect(writes()).toEqual([]);
      expect(store.schedules.rows).toHaveLength(0);
      expect(store.audit.rows).toHaveLength(0);
    });

    it('the sixth schedule is refused with 409 schedule_limit_reached; switched-off ones count', async () => {
      for (let i = 0; i < 5; i += 1) {
        await service.create(OWNER, body({ enabled: i % 2 === 0 }));
      }
      // Another owner's schedules do not count against this owner.
      await service.create(OTHER, body());
      const callsBefore = writes().length;
      const { status, body: response } = await refusal(() => service.create(OWNER, body()));
      expect(status).toBe(409);
      expect(response).toEqual({
        statusCode: 409,
        message: 'At most 5 schedules per account',
        error: 'Conflict',
        code: SCHEDULE_ERROR_CODES.limitReached,
        limit: 5,
      });
      expect(writes().length).toBe(callsBefore);
      expect(store.schedules.rows.filter((row) => row.userId === OWNER)).toHaveLength(5);
      expect(store.audit.rows.filter((row) => row.userId === OWNER)).toHaveLength(5);

      // After a delete there is room again.
      await service.remove(OWNER, store.schedules.rows[0].id);
      await service.create(OWNER, body());
      expect(store.schedules.rows.filter((row) => row.userId === OWNER)).toHaveLength(5);
    });

    it('takes the per-owner transaction lock before counting', async () => {
      await service.create(OWNER, body());
      expect(store.queries).toEqual([
        { sql: 'SELECT pg_advisory_xact_lock($1, hashtext($2))', params: [SCHEDULE_LIMIT_LOCK_NAMESPACE, OWNER] },
      ]);
      const lockAt = store.calls.indexOf('manager.query');
      expect(lockAt).toBeGreaterThanOrEqual(0);
      expect(lockAt).toBeLessThan(store.calls.indexOf('schedules.count'));
      expect(store.calls.indexOf('schedules.count')).toBeLessThan(store.calls.indexOf('schedules.insert'));
    });

    it('a failed audit insert leaves no schedule (one transaction)', async () => {
      store.audit.failNextInsert = true;
      await expect(service.create(OWNER, body())).rejects.toThrow('audit insert failed');
      expect(store.schedules.rows).toHaveLength(0);
    });

    it('a validation refusal writes nothing and reads nothing', async () => {
      await refusal(() => service.create(OWNER, body({ timeZone: 'Nowhere/Land' })));
      await refusal(() => service.create(OWNER, body({ days: [] })));
      expect(store.calls).toEqual([]);
    });
  });

  describe('owner scoping on change, delete and history', () => {
    let ownId: string;
    let otherId: string;

    beforeEach(async () => {
      ownId = (await service.create(OWNER, body())).id;
      otherId = (await service.create(OTHER, body({ task: 'other task' }))).id;
      store.runs.rows.push(runRow('r-other', otherId, OTHER, '2026-11-14', 'started'));
      store.calls.length = 0;
    });

    function snapshot(): string {
      return JSON.stringify({
        schedules: store.schedules.rows,
        runs: store.runs.rows,
        audit: store.audit.rows,
      });
    }

    it.each([
      ["another owner's schedule", () => otherId],
      ['an unknown id', () => UNKNOWN_ID],
    ])('%s answers 404 on update, delete and history and changes nothing', async (_label, idOf) => {
      const before = snapshot();
      for (const work of [
        () => service.update(OWNER, idOf(), { enabled: false }),
        () => service.remove(OWNER, idOf()),
        () => service.history(OWNER, idOf()),
      ]) {
        const { status, body: response } = await refusal(work);
        expect(status).toBe(404);
        expect(response).toEqual({
          statusCode: 404,
          message: 'Schedule not found',
          error: 'Not Found',
          code: SCHEDULE_ERROR_CODES.notFound,
        });
      }
      expect(writes()).toEqual([]);
      expect(snapshot()).toBe(before);
    });

    it('a malformed id answers 404 without a query', async () => {
      for (const work of [
        () => service.update(OWNER, 'nope', { enabled: false }),
        () => service.remove(OWNER, "1' OR '1'='1"),
        () => service.history(OWNER, ''),
      ]) {
        expect((await refusal(work)).status).toBe(404);
      }
      expect(store.calls).toEqual([]);
    });

    it.each([
      ["another owner's", OTHER_WORKFLOW],
      ['an unknown', UNKNOWN_ID],
      ['a deleted', DELETED_WORKFLOW],
    ])("changing the target to %s workflow answers 404 and changes nothing", async (_label, workflowId) => {
      const before = snapshot();
      const { status, body: response } = await refusal(() =>
        service.update(OWNER, ownId, { target: { kind: 'workflow', workflowId }, task: 'changed' }),
      );
      expect(status).toBe(404);
      expect(response.code).toBe(SCHEDULE_ERROR_CODES.workflowNotFound);
      expect(writes()).toEqual([]);
      expect(snapshot()).toBe(before);
    });

    it("the owner's own changes work and touch only the owner's row", async () => {
      const view = await service.update(OWNER, ownId, {
        target: { kind: 'workflow', workflowId: OWN_WORKFLOW },
        task: ' new task ',
        enabled: false,
      });
      expect(view).toMatchObject({
        id: ownId,
        target: { kind: 'workflow', workflowId: OWN_WORKFLOW, name: 'Morning briefing', status: 'active' },
        task: 'new task',
        enabled: false,
      });
      const other = store.schedules.rows.find((row) => row.id === otherId)!;
      expect(other.task).toBe('other task');
      expect(other.enabled).toBe(true);
      const back = await service.update(OWNER, ownId, { target: { kind: 'chief-of-staff' } });
      expect(back.target).toEqual({ kind: 'chief-of-staff' });
      expect(store.schedules.rows.find((row) => row.id === ownId)!.workflowId).toBeNull();
    });

    it('delete removes the schedule and its history rows only, with one schedule_deleted audit row', async () => {
      store.runs.rows.push(
        runRow('r1', ownId, OWNER, '2026-11-13', 'started'),
        runRow('r2', ownId, OWNER, '2026-11-14', 'skipped', 'runs_off'),
      );
      const result = await service.remove(OWNER, ownId);
      expect(result).toEqual({ id: ownId, deleted: true });
      expect(store.schedules.rows.map((row) => row.id)).toEqual([otherId]);
      expect(store.runs.rows.map((row) => row.id)).toEqual(['r-other']);
      const audit = store.audit.rows.filter((row) => row.eventType === 'schedule_deleted');
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        subjectId: ownId,
        userId: OWNER,
        payload: { scheduleId: ownId, targetKind: 'chief-of-staff', workflowId: null },
      });
      expect((await refusal(() => service.history(OWNER, ownId))).status).toBe(404);
    });

    it('history answers the last 30 rows, newest first, ids and codes only', async () => {
      for (let i = 0; i < 35; i += 1) {
        const day = new Date(Date.UTC(2026, 9, 1 + i));
        const run = runRow(`r${i}`, ownId, OWNER, day.toISOString().slice(0, 10), i % 2 ? 'started' : 'skipped', i % 2 ? null : 'missed');
        run.createdAt = day;
        run.collaborationRunId = i % 2 ? `run-${i}` : null;
        store.runs.rows.push(run);
      }
      const { runs } = await service.history(OWNER, ownId);
      expect(runs).toHaveLength(SCHEDULE_HISTORY_LIMIT);
      expect(SCHEDULE_HISTORY_LIMIT).toBe(30);
      expect(runs[0]).toEqual({
        id: 'r34',
        localDate: '2026-11-04',
        outcome: 'skipped',
        reason: 'missed',
        collaborationRunId: null,
        at: new Date(Date.UTC(2026, 9, 35)).toISOString(),
      });
      expect(runs[1]).toMatchObject({ id: 'r33', outcome: 'started', reason: null, collaborationRunId: 'run-33' });
      expect(runs.map((run) => run.id)).not.toContain('r-other');
      expect(runs[29].id).toBe('r5');
    });
  });

  describe('armed_at (stage-start section 2)', () => {
    let id: string;
    let armedAt: number;

    beforeEach(async () => {
      at('2026-11-15T00:00:00Z');
      id = (await service.create(OWNER, body())).id;
      armedAt = store.schedules.rows[0].armedAt.getTime();
      at('2026-11-15T03:00:00Z');
    });

    const later = new Date('2026-11-15T03:00:00Z').getTime();

    function current(): AgentSchedule {
      return store.schedules.rows.find((row) => row.id === id)!;
    }

    it.each([
      ['time', { timeOfDay: '08:00' }],
      ['days', { days: [2, 4] }],
      ['zone', { timeZone: 'Europe/London' }],
    ])('changing the %s re-arms', async (_label, patch) => {
      await service.update(OWNER, id, patch);
      expect(current().armedAt.getTime()).toBe(later);
      expect(current().updatedAt.getTime()).toBe(later);
    });

    it('switching on re-arms; switching off does not', async () => {
      await service.update(OWNER, id, { enabled: false });
      expect(current().armedAt.getTime()).toBe(armedAt);
      at('2026-11-15T05:00:00Z');
      await service.update(OWNER, id, { enabled: true });
      expect(current().armedAt.getTime()).toBe(new Date('2026-11-15T05:00:00Z').getTime());
    });

    it.each([
      ['the task', { task: 'another task' }],
      ['the target', { target: { kind: 'workflow', workflowId: OWN_WORKFLOW } }],
      ['the same time, days and zone', { timeOfDay: '07:30', days: [5, 3, 1], timeZone: 'Asia/Taipei' }],
      ['enabled true while already on', { enabled: true }],
    ])('changing %s does not re-arm', async (_label, patch) => {
      await service.update(OWNER, id, patch);
      expect(current().armedAt.getTime()).toBe(armedAt);
      expect(current().updatedAt.getTime()).toBe(later);
    });

    it('every change writes one schedule_updated audit row without the task', async () => {
      await service.update(OWNER, id, { task: `${MARKER} changed`, timeOfDay: '09:00' });
      const updated = store.audit.rows.filter((row) => row.eventType === 'schedule_updated');
      expect(updated).toHaveLength(1);
      expect(updated[0].payload).toEqual({ scheduleId: id, targetKind: 'chief-of-staff', workflowId: null });
    });
  });

  describe('list', () => {
    it('reports SCHEDULES_ENABLED and GLOBAL_EXECUTION_ENABLED live, and the limit', async () => {
      const runs = jest.spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get');
      try {
        runs.mockReturnValue(false);
        expect(await service.list(OWNER)).toEqual({ enabled: false, runsEnabled: false, limit: 5, schedules: [] });
        process.env.SCHEDULES_ENABLED = 'true';
        runs.mockReturnValue(true);
        expect(await service.list(OWNER)).toMatchObject({ enabled: true, runsEnabled: true });
        process.env.SCHEDULES_ENABLED = 'TRUE';
        expect((await service.list(OWNER)).enabled).toBe(false);
      } finally {
        runs.mockRestore();
      }
    });

    it("lists only the owner's schedules, oldest first, with the newest history row as lastRun", async () => {
      at('2026-11-10T00:00:00Z');
      const first = await service.create(OWNER, body({ task: 'first' }));
      at('2026-11-11T00:00:00Z');
      const second = await service.create(OWNER, body({ task: 'second', target: { kind: 'workflow', workflowId: OWN_WORKFLOW } }));
      await service.create(OTHER, body({ task: 'other' }));
      const older = runRow('r1', first.id, OWNER, '2026-11-12', 'skipped', 'runs_off');
      older.createdAt = new Date('2026-11-12T00:00:00Z');
      const newer = runRow('r2', first.id, OWNER, '2026-11-13', 'started');
      newer.createdAt = new Date('2026-11-13T00:00:00Z');
      newer.collaborationRunId = 'run-abc';
      store.runs.rows.push(older, newer);

      const view = await service.list(OWNER);
      expect(view.schedules.map((schedule) => schedule.task)).toEqual(['first', 'second']);
      expect(view.schedules[0].lastRun).toEqual({
        localDate: '2026-11-13',
        outcome: 'started',
        reason: null,
        collaborationRunId: 'run-abc',
        at: '2026-11-13T00:00:00.000Z',
      });
      expect(view.schedules[1].id).toBe(second.id);
      expect(view.schedules[1].lastRun).toBeNull();
      expect(view.schedules[1].target).toEqual({
        kind: 'workflow',
        workflowId: OWN_WORKFLOW,
        name: 'Morning briefing',
        status: 'active',
      });
    });

    it('a workflow that is gone reads as name null, status missing', async () => {
      await service.create(OWNER, body({ target: { kind: 'workflow', workflowId: OWN_WORKFLOW } }));
      store.workflows.rows[0].deletedAt = new Date();
      const view = await service.list(OWNER);
      expect(view.schedules[0].target).toEqual({
        kind: 'workflow',
        workflowId: OWN_WORKFLOW,
        name: null,
        status: 'missing',
      });
    });
  });

  it('no audit row and no log line carries the task text, across create, change, list, history and delete', async () => {
    const created = await service.create(OWNER, body());
    await service.update(OWNER, created.id, { task: `${MARKER} second`, timeOfDay: '10:00', enabled: false });
    await service.update(OWNER, created.id, { enabled: true, target: { kind: 'workflow', workflowId: OWN_WORKFLOW } });
    await service.list(OWNER);
    await service.history(OWNER, created.id);
    await service.remove(OWNER, created.id);
    await refusal(() => service.create(OWNER, body({ timeZone: 'Bad/Zone' })));

    expect(store.audit.rows.map((row) => row.eventType)).toEqual([
      'schedule_created',
      'schedule_updated',
      'schedule_updated',
      'schedule_deleted',
    ]);
    for (const row of store.audit.rows) {
      expect(Object.keys(row.payload).sort()).toEqual(['scheduleId', 'targetKind', 'workflowId']);
    }
    expect(JSON.stringify(store.audit.rows)).not.toContain(MARKER);
    expect(JSON.stringify(store.audit.rows)).not.toContain('summarise');
    expect(logs.length).toBeGreaterThanOrEqual(4);
    expect(logs.join('\n')).not.toContain(MARKER);
    expect(logs.join('\n')).not.toContain('summarise');
    expect(logs).toContain(`schedule created userId=${OWNER} scheduleId=${created.id} targetKind=chief-of-staff`);
  });
});

function workflowRow(id: string, userId: string, name: string, status: string): UserAgent {
  return { id, userId, name, status, deletedAt: null } as UserAgent;
}

function runRow(
  id: string,
  scheduleId: string,
  userId: string,
  localDate: string,
  outcome: AgentScheduleRun['outcome'],
  reason: string | null = null,
): AgentScheduleRun {
  return {
    id,
    scheduleId,
    userId,
    localDate,
    outcome,
    reason,
    collaborationRunId: null,
    createdAt: new Date(`${localDate}T06:00:00Z`),
  };
}

function watchLogs(logs: string[]): () => void {
  const methods = ['log', 'warn', 'error', 'debug', 'verbose'] as const;
  const spies = methods.map((method) =>
    jest.spyOn(Logger.prototype, method).mockImplementation((...args: unknown[]) => {
      logs.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
    }),
  );
  return () => spies.forEach((spy) => spy.mockRestore());
}

/* ---------- In-memory TypeORM stand-in (the same shape as the chat specs' store). ---------- */

type Row = Record<string, unknown>;

function sameValue(left: unknown, right: unknown): boolean {
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
  return left === right;
}

function asNumber(value: unknown): number {
  return value instanceof Date ? value.getTime() : Number(value);
}

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected instanceof FindOperator) {
      switch (expected.type) {
        case 'isNull':
          return actual === null || actual === undefined;
        case 'in':
          return (expected.value as unknown[]).some((value) => sameValue(actual, value));
        default:
          throw new Error(`unsupported operator ${expected.type}`);
      }
    }
    return sameValue(actual, expected);
  });
}

function copy<T>(row: T): T {
  return { ...(row as object) } as T;
}

function sortRows<T>(rows: T[], order?: Record<string, 'ASC' | 'DESC'>): T[] {
  const [orderKey, direction] = Object.entries(order ?? {})[0] ?? [];
  if (orderKey) {
    rows.sort((a, b) => {
      const diff = asNumber((a as Row)[orderKey]) - asNumber((b as Row)[orderKey]);
      return direction === 'DESC' ? -diff : diff;
    });
  }
  return rows;
}

class MemoryRepository<T extends object> {
  rows: T[] = [];
  manager!: MemoryManager;
  failNextInsert = false;

  constructor(
    private readonly name: string,
    private readonly calls: string[],
    private readonly uniques: string[][] = [],
  ) {}

  async findOne(options: { where: Row; order?: Record<string, 'ASC' | 'DESC'> }): Promise<T | null> {
    this.calls.push(`${this.name}.findOne`);
    const found = sortRows(
      this.rows.filter((row) => matches(row as Row, options.where)),
      options.order,
    )[0];
    return found ? copy(found) : null;
  }

  async find(options: { where: Row; order?: Record<string, 'ASC' | 'DESC'>; take?: number }): Promise<T[]> {
    this.calls.push(`${this.name}.find`);
    const found = sortRows(
      this.rows.filter((row) => matches(row as Row, options.where)).map(copy),
      options.order,
    );
    return options.take === undefined ? found : found.slice(0, options.take);
  }

  async count(options: { where: Row }): Promise<number> {
    this.calls.push(`${this.name}.count`);
    return this.rows.filter((row) => matches(row as Row, options.where)).length;
  }

  async insert(entity: T): Promise<{ identifiers: unknown[] }> {
    this.calls.push(`${this.name}.insert`);
    if (this.failNextInsert) {
      this.failNextInsert = false;
      throw new Error(`${this.name} insert failed`);
    }
    for (const columns of this.uniques) {
      const clash = this.rows.some((row) =>
        columns.every((column) => sameValue((row as Row)[column], (entity as Row)[column])),
      );
      if (clash) {
        throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
      }
    }
    this.rows.push(copy(entity));
    return { identifiers: [{ id: (entity as Row).id }] };
  }

  async update(where: Row, patch: Partial<T>): Promise<{ affected: number }> {
    this.calls.push(`${this.name}.update`);
    let affected = 0;
    for (const row of this.rows) {
      if (matches(row as Row, where)) {
        Object.assign(row, patch);
        affected += 1;
      }
    }
    return { affected };
  }

  async delete(where: Row): Promise<{ affected: number }> {
    this.calls.push(`${this.name}.delete`);
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !matches(row as Row, where));
    return { affected: before - this.rows.length };
  }
}

class MemoryManager {
  constructor(private readonly store: MemoryStore) {}

  getRepository(target: unknown): MemoryRepository<object> {
    if (target === AgentSchedule) return this.store.schedules as MemoryRepository<object>;
    if (target === AgentScheduleRun) return this.store.runs as MemoryRepository<object>;
    if (target === UserAgent) return this.store.workflows as MemoryRepository<object>;
    if (target === AuditEventEntity) return this.store.audit as MemoryRepository<object>;
    throw new Error('unknown repository');
  }

  async query(sql: string, params: unknown[]): Promise<unknown[]> {
    this.store.calls.push('manager.query');
    this.store.queries.push({ sql, params });
    return [];
  }

  async transaction<R>(work: (manager: MemoryManager) => Promise<R>): Promise<R> {
    const snapshot = {
      schedules: this.store.schedules.rows.map(copy),
      runs: this.store.runs.rows.map(copy),
      audit: this.store.audit.rows.map(copy),
    };
    try {
      return await work(this);
    } catch (error) {
      this.store.schedules.rows = snapshot.schedules;
      this.store.runs.rows = snapshot.runs;
      this.store.audit.rows = snapshot.audit;
      throw error;
    }
  }
}

class MemoryStore {
  calls: string[] = [];
  queries: Array<{ sql: string; params: unknown[] }> = [];
  schedules = new MemoryRepository<AgentSchedule>('schedules', this.calls);
  runs = new MemoryRepository<AgentScheduleRun>('runs', this.calls, [['scheduleId', 'localDate']]);
  workflows = new MemoryRepository<UserAgent>('workflows', this.calls);
  audit = new MemoryRepository<AuditEventEntity>('audit', this.calls);
  manager = new MemoryManager(this);

  constructor() {
    this.schedules.manager = this.manager;
    this.runs.manager = this.manager;
    this.workflows.manager = this.manager;
    this.audit.manager = this.manager;
  }
}
