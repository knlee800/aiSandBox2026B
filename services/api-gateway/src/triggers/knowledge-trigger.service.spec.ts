import { HttpException, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { FindOperator } from 'typeorm';
import { AgentKnowledgeTrigger } from '../entities/agent-knowledge-trigger.entity';
import { AgentKnowledgeTriggerRun } from '../entities/agent-knowledge-trigger-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { UserAgent } from '../entities/user-agent.entity';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { EVENT_TRIGGER_LIMIT_LOCK_NAMESPACE } from './event-trigger.service';
import {
  KNOWLEDGE_TRIGGER_AUDIT_CATEGORY,
  KNOWLEDGE_TRIGGER_AUDIT_SUBJECT_TYPE,
  KNOWLEDGE_TRIGGER_HISTORY_LIMIT,
  KNOWLEDGE_TRIGGER_LIMIT_LOCK_NAMESPACE,
  KnowledgeTriggerService,
} from './knowledge-trigger.service';
import { KNOWLEDGE_TRIGGER_ERROR_CODES } from './knowledge-trigger-validation';
import { MAIL_TRIGGER_LIMIT_LOCK_NAMESPACE } from './mail-trigger.service';
import { SCHEDULE_LIMIT_LOCK_NAMESPACE } from './schedule.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const OWN_WORKFLOW = '33333333-3333-4333-8333-333333333333';
const OTHER_WORKFLOW = '44444444-4444-4444-8444-444444444444';
const DELETED_WORKFLOW = '55555555-5555-4555-8555-555555555555';
const UNKNOWN_ID = '66666666-6666-4666-8666-666666666666';
const DOCUMENT_ID = '88888888-8888-4888-8888-888888888888';
const MARKER = 'MARKER-TASK-9c3a';

function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    target: { kind: 'chief-of-staff' },
    task: `${MARKER} summarise the new document`,
    scopeId: 'policies',
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

describe('KnowledgeTriggerService (TRIGGER-MORE-01 S1)', () => {
  const originalFlag = process.env.KNOWLEDGE_TRIGGERS_ENABLED;
  let store: MemoryStore;
  let service: KnowledgeTriggerService;
  let logs: string[];
  let restoreLogs: () => void;

  beforeEach(() => {
    delete process.env.KNOWLEDGE_TRIGGERS_ENABLED;
    store = new MemoryStore();
    store.workflows.rows.push(
      workflowRow(OWN_WORKFLOW, OWNER, 'Research desk', 'active'),
      workflowRow(OTHER_WORKFLOW, OTHER, 'Not yours', 'active'),
      { ...workflowRow(DELETED_WORKFLOW, OWNER, 'Deleted', 'active'), deletedAt: new Date('2026-11-01T00:00:00Z') },
    );
    service = new KnowledgeTriggerService(store.triggers as never, store.runs as never, store.workflows as never);
    logs = [];
    restoreLogs = watchLogs(logs);
  });

  afterEach(() => {
    restoreLogs();
    jest.useRealTimers();
    if (originalFlag === undefined) delete process.env.KNOWLEDGE_TRIGGERS_ENABLED;
    else process.env.KNOWLEDGE_TRIGGERS_ENABLED = originalFlag;
  });

  function at(iso: string): void {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(new Date(iso));
  }

  function writes(): string[] {
    return store.calls.filter((call) => /\.(insert|update|delete)$/.test(call));
  }

  describe('create', () => {
    it('stores the trigger, arms it at create, and answers the section 5 view', async () => {
      const view = await service.create(OWNER, body());
      expect(store.triggers.rows).toHaveLength(1);
      const row = store.triggers.rows[0];
      expect(row).toMatchObject({
        id: view.id,
        userId: OWNER,
        targetKind: 'chief-of-staff',
        workflowId: null,
        task: `${MARKER} summarise the new document`,
        scopeId: 'policies',
        timeZone: 'Asia/Taipei',
        enabled: true,
      });
      expect(row.armedAt.getTime()).toBe(row.createdAt.getTime());
      expect(view).toEqual({
        id: row.id,
        target: { kind: 'chief-of-staff' },
        task: `${MARKER} summarise the new document`,
        scopeId: 'policies',
        timeZone: 'Asia/Taipei',
        enabled: true,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        lastRun: null,
      });
      expect(view.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('writes one knowledge_trigger_created audit row with the trigger id, target kind, workflow id and folder id only', async () => {
      const view = await service.create(
        OWNER,
        body({ target: { kind: 'workflow', workflowId: OWN_WORKFLOW }, scopeId: 'market-data' }),
      );
      expect(store.audit.rows).toHaveLength(1);
      expect(store.audit.rows[0]).toMatchObject({
        category: KNOWLEDGE_TRIGGER_AUDIT_CATEGORY,
        eventType: 'knowledge_trigger_created',
        subjectType: KNOWLEDGE_TRIGGER_AUDIT_SUBJECT_TYPE,
        subjectId: view.id,
        userId: OWNER,
        payload: { triggerId: view.id, targetKind: 'workflow', workflowId: OWN_WORKFLOW, scopeId: 'market-data' },
      });
      expect(Object.keys(store.audit.rows[0].payload).sort()).toEqual(['scopeId', 'targetKind', 'triggerId', 'workflowId']);
      expect(KNOWLEDGE_TRIGGER_AUDIT_CATEGORY).toBe('trigger');
      expect(KNOWLEDGE_TRIGGER_AUDIT_SUBJECT_TYPE).toBe('agent_knowledge_trigger');
    });

    it("a trigger for the owner's own workflow carries its name and status, on any of the nine folders", async () => {
      const view = await service.create(
        OWNER,
        body({ target: { kind: 'workflow', workflowId: OWN_WORKFLOW }, scopeId: 'tech-landscape' }),
      );
      expect(view.target).toEqual({ kind: 'workflow', workflowId: OWN_WORKFLOW, name: 'Research desk', status: 'active' });
      expect(view.scopeId).toBe('tech-landscape');
      expect(store.triggers.rows[0]).toMatchObject({ targetKind: 'workflow', workflowId: OWN_WORKFLOW });
    });

    it.each([['codebase-context'], ['market-data'], ['tech-landscape']])(
      'a Chief of Staff trigger on %s is refused with knowledge_trigger_folder_not_readable; nothing read or written',
      async (scopeId) => {
        const { status, body: response } = await refusal(() => service.create(OWNER, body({ scopeId })));
        expect(status).toBe(400);
        expect(response.code).toBe(KNOWLEDGE_TRIGGER_ERROR_CODES.folderNotReadable);
        expect(store.calls).toEqual([]);
      },
    );

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
      expect(response.code).toBe(KNOWLEDGE_TRIGGER_ERROR_CODES.workflowNotFound);
      expect(writes()).toEqual([]);
      expect(store.triggers.rows).toHaveLength(0);
      expect(store.audit.rows).toHaveLength(0);
    });

    it('the fourth trigger is refused with 409 knowledge_trigger_limit_reached; switched-off ones count', async () => {
      for (let i = 0; i < 3; i += 1) {
        await service.create(OWNER, body({ enabled: i !== 1 }));
      }
      // Another owner's triggers do not count against this owner.
      await service.create(OTHER, body());
      const callsBefore = writes().length;
      const { status, body: response } = await refusal(() => service.create(OWNER, body()));
      expect(status).toBe(409);
      expect(response).toEqual({
        statusCode: 409,
        message: 'At most 3 knowledge triggers per account',
        error: 'Conflict',
        code: KNOWLEDGE_TRIGGER_ERROR_CODES.limitReached,
        limit: 3,
      });
      expect(writes().length).toBe(callsBefore);
      expect(store.triggers.rows.filter((row) => row.userId === OWNER)).toHaveLength(3);
      expect(store.audit.rows.filter((row) => row.userId === OWNER)).toHaveLength(3);

      // After a delete there is room again.
      await service.remove(OWNER, store.triggers.rows[0].id);
      await service.create(OWNER, body());
      expect(store.triggers.rows.filter((row) => row.userId === OWNER)).toHaveLength(3);
    });

    it('takes the per-owner transaction lock (its own namespace 1813) before counting', async () => {
      await service.create(OWNER, body());
      expect(store.queries).toEqual([
        { sql: 'SELECT pg_advisory_xact_lock($1, hashtext($2))', params: [KNOWLEDGE_TRIGGER_LIMIT_LOCK_NAMESPACE, OWNER] },
      ]);
      expect(KNOWLEDGE_TRIGGER_LIMIT_LOCK_NAMESPACE).toBe(1813);
      expect(
        new Set([
          KNOWLEDGE_TRIGGER_LIMIT_LOCK_NAMESPACE,
          SCHEDULE_LIMIT_LOCK_NAMESPACE,
          EVENT_TRIGGER_LIMIT_LOCK_NAMESPACE,
          MAIL_TRIGGER_LIMIT_LOCK_NAMESPACE,
        ]).size,
      ).toBe(4);
      const lockAt = store.calls.indexOf('manager.query');
      expect(lockAt).toBeGreaterThanOrEqual(0);
      expect(lockAt).toBeLessThan(store.calls.indexOf('triggers.count'));
      expect(store.calls.indexOf('triggers.count')).toBeLessThan(store.calls.indexOf('triggers.insert'));
    });

    it('five concurrent creates by one owner leave exactly three (the lock serialises count and insert)', async () => {
      store.manager.honourLocks = true;
      const results = await Promise.allSettled(Array.from({ length: 5 }, () => service.create(OWNER, body())));
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(3);
      const refused = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      expect(refused).toHaveLength(2);
      for (const result of refused) {
        expect((result.reason as HttpException).getStatus()).toBe(409);
      }
      expect(store.triggers.rows).toHaveLength(3);
      expect(store.audit.rows).toHaveLength(3);
    });

    it('the same race without the lock would admit more than three (so the test above proves the lock)', async () => {
      store.manager.honourLocks = false;
      await Promise.allSettled(Array.from({ length: 5 }, () => service.create(OWNER, body())));
      expect(store.triggers.rows.length).toBeGreaterThan(3);
    });

    it('a failed audit insert leaves no trigger (one transaction)', async () => {
      store.audit.failNextInsert = true;
      await expect(service.create(OWNER, body())).rejects.toThrow('audit insert failed');
      expect(store.triggers.rows).toHaveLength(0);
    });

    it('a validation refusal writes nothing and reads nothing', async () => {
      await refusal(() => service.create(OWNER, body({ timeZone: 'Nowhere/Land' })));
      await refusal(() => service.create(OWNER, body({ scopeId: 'legal-contracts' })));
      await refusal(() => service.create(OWNER, body({ scopeId: null })));
      await refusal(() => service.create(OWNER, body({ task: 'a'.repeat(7001) })));
      await refusal(() => service.create(OWNER, body({ senderFilter: 'a@example.com' })));
      expect(store.calls).toEqual([]);
    });
  });

  describe('owner scoping on change, delete and history', () => {
    let ownId: string;
    let otherId: string;

    beforeEach(async () => {
      ownId = (await service.create(OWNER, body())).id;
      otherId = (await service.create(OTHER, body({ task: 'other task', scopeId: 'strategy-docs' }))).id;
      store.runs.rows.push(runRow('r-other', otherId, OTHER, '2026-11-14', 'started'));
      store.calls.length = 0;
    });

    function snapshot(): string {
      return JSON.stringify({ triggers: store.triggers.rows, runs: store.runs.rows, audit: store.audit.rows });
    }

    it.each([
      ["another owner's trigger", () => otherId],
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
          message: 'Knowledge trigger not found',
          error: 'Not Found',
          code: KNOWLEDGE_TRIGGER_ERROR_CODES.notFound,
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
    ])('changing the target to %s workflow answers 404 and changes nothing', async (_label, workflowId) => {
      const before = snapshot();
      const { status, body: response } = await refusal(() =>
        service.update(OWNER, ownId, { target: { kind: 'workflow', workflowId }, task: 'changed' }),
      );
      expect(status).toBe(404);
      expect(response.code).toBe(KNOWLEDGE_TRIGGER_ERROR_CODES.workflowNotFound);
      expect(writes()).toEqual([]);
      expect(snapshot()).toBe(before);
    });

    it("the owner's own changes work and touch only the owner's row", async () => {
      const view = await service.update(OWNER, ownId, {
        target: { kind: 'workflow', workflowId: OWN_WORKFLOW },
        task: ' new task ',
        scopeId: 'market-data',
        timeZone: 'Europe/London',
        enabled: false,
      });
      expect(view).toMatchObject({
        id: ownId,
        target: { kind: 'workflow', workflowId: OWN_WORKFLOW, name: 'Research desk', status: 'active' },
        task: 'new task',
        scopeId: 'market-data',
        timeZone: 'Europe/London',
        enabled: false,
      });
      const other = store.triggers.rows.find((row) => row.id === otherId)!;
      expect(other).toMatchObject({ task: 'other task', scopeId: 'strategy-docs', enabled: true });
      // Back to the Chief of Staff on one of its folders.
      const back = await service.update(OWNER, ownId, { target: { kind: 'chief-of-staff' }, scopeId: 'policies' });
      expect(back.target).toEqual({ kind: 'chief-of-staff' });
      expect(store.triggers.rows.find((row) => row.id === ownId)!.workflowId).toBeNull();
    });

    it('the Chief of Staff folder rule holds on the merged row: a folder change, a target change and both', async () => {
      const workflowId = (
        await service.create(OWNER, body({ target: { kind: 'workflow', workflowId: OWN_WORKFLOW }, scopeId: 'codebase-context' }))
      ).id;
      store.calls.length = 0;
      const before = snapshot();
      for (const [id, patch] of [
        // A Chief of Staff trigger moved to a folder it cannot read.
        [ownId, { scopeId: 'market-data' }],
        // A workflow trigger on such a folder handed to the Chief of Staff.
        [workflowId, { target: { kind: 'chief-of-staff' } }],
        // Both at once.
        [ownId, { target: { kind: 'chief-of-staff' }, scopeId: 'tech-landscape' }],
      ] as Array<[string, Record<string, unknown>]>) {
        const { status, body: response } = await refusal(() => service.update(OWNER, id, patch));
        expect(status).toBe(400);
        expect(response.code).toBe(KNOWLEDGE_TRIGGER_ERROR_CODES.folderNotReadable);
      }
      expect(writes()).toEqual([]);
      expect(snapshot()).toBe(before);
      // A workflow trigger may move to any folder.
      await service.update(OWNER, workflowId, { scopeId: 'tech-landscape' });
      expect(store.triggers.rows.find((row) => row.id === workflowId)!.scopeId).toBe('tech-landscape');
    });

    it('delete removes the trigger and its history rows only, with one knowledge_trigger_deleted audit row', async () => {
      store.runs.rows.push(
        runRow('r1', ownId, OWNER, '2026-11-13', 'started'),
        runRow('r2', ownId, OWNER, '2026-11-14', 'skipped', 'day_limit'),
      );
      const result = await service.remove(OWNER, ownId);
      expect(result).toEqual({ id: ownId, deleted: true });
      expect(store.triggers.rows.map((row) => row.id)).toEqual([otherId]);
      expect(store.runs.rows.map((row) => row.id)).toEqual(['r-other']);
      const audit = store.audit.rows.filter((row) => row.eventType === 'knowledge_trigger_deleted');
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        subjectId: ownId,
        subjectType: 'agent_knowledge_trigger',
        userId: OWNER,
        payload: { triggerId: ownId, targetKind: 'chief-of-staff', workflowId: null, scopeId: 'policies' },
      });
      expect((await refusal(() => service.history(OWNER, ownId))).status).toBe(404);
    });

    it('history answers the last 30 rows, newest first, ids, times and codes only (never the document key)', async () => {
      for (let i = 0; i < 35; i += 1) {
        const day = new Date(Date.UTC(2026, 9, 1 + i));
        const run = runRow(`r${i}`, ownId, OWNER, day.toISOString().slice(0, 10), i % 2 ? 'started' : 'skipped', i % 2 ? null : 'day_limit');
        run.createdAt = day;
        run.changedAt = new Date(day.getTime() - 3 * 60_000);
        run.collaborationRunId = i % 2 ? `run-${i}` : null;
        store.runs.rows.push(run);
      }
      const { runs } = await service.history(OWNER, ownId);
      expect(runs).toHaveLength(KNOWLEDGE_TRIGGER_HISTORY_LIMIT);
      expect(KNOWLEDGE_TRIGGER_HISTORY_LIMIT).toBe(30);
      expect(runs[0]).toEqual({
        id: 'r34',
        documentId: DOCUMENT_ID,
        changedAt: new Date(Date.UTC(2026, 9, 35) - 3 * 60_000).toISOString(),
        localDate: '2026-11-04',
        outcome: 'skipped',
        reason: 'day_limit',
        collaborationRunId: null,
        at: new Date(Date.UTC(2026, 9, 35)).toISOString(),
      });
      expect(runs[1]).toMatchObject({ id: 'r33', outcome: 'started', reason: null, collaborationRunId: 'run-33' });
      expect(runs.map((run) => run.id)).not.toContain('r-other');
      expect(runs[29].id).toBe('r5');
      expect(JSON.stringify(runs)).not.toContain('documentKey');
      expect(JSON.stringify(runs)).not.toContain('a'.repeat(64));
    });
  });

  describe('armed_at (stage-start section 4)', () => {
    let id: string;
    let armedAt: number;

    beforeEach(async () => {
      at('2026-11-16T00:00:00Z');
      id = (await service.create(OWNER, body())).id;
      armedAt = store.triggers.rows[0].armedAt.getTime();
      at('2026-11-16T03:00:00Z');
    });

    const later = new Date('2026-11-16T03:00:00Z').getTime();

    function current(): AgentKnowledgeTrigger {
      return store.triggers.rows.find((row) => row.id === id)!;
    }

    it('create arms at the create time', () => {
      expect(armedAt).toBe(new Date('2026-11-16T00:00:00Z').getTime());
      expect(current().createdAt.getTime()).toBe(armedAt);
    });

    it.each([
      ['the folder', { scopeId: 'strategy-docs' }],
      ['the folder with a workflow target', { scopeId: 'market-data', target: { kind: 'workflow', workflowId: OWN_WORKFLOW } }],
      ['the zone', { timeZone: 'Europe/London' }],
      ['the folder and the task', { scopeId: 'meeting-summaries', task: 'other task' }],
    ])('changing %s re-arms', async (_label, patch) => {
      await service.update(OWNER, id, patch);
      expect(current().armedAt.getTime()).toBe(later);
      expect(current().updatedAt.getTime()).toBe(later);
    });

    it('switching on re-arms; switching off does not', async () => {
      await service.update(OWNER, id, { enabled: false });
      expect(current().armedAt.getTime()).toBe(armedAt);
      at('2026-11-16T05:00:00Z');
      await service.update(OWNER, id, { enabled: true });
      expect(current().armedAt.getTime()).toBe(new Date('2026-11-16T05:00:00Z').getTime());
    });

    it.each([
      ['the task', { task: 'another task' }],
      ['the target', { target: { kind: 'workflow', workflowId: OWN_WORKFLOW } }],
      ['the target back to the Chief of Staff', { target: { kind: 'chief-of-staff' } }],
      ['the same folder and zone', { scopeId: 'policies', timeZone: 'Asia/Taipei' }],
      ['enabled true while already on', { enabled: true }],
    ])('changing %s does not re-arm', async (_label, patch) => {
      await service.update(OWNER, id, patch);
      expect(current().armedAt.getTime()).toBe(armedAt);
      expect(current().updatedAt.getTime()).toBe(later);
    });

    it('a refused change does not re-arm', async () => {
      await refusal(() => service.update(OWNER, id, { scopeId: 'market-data', enabled: true }));
      await refusal(() => service.update(OWNER, id, { timeZone: 'Bad/Zone' }));
      expect(current().armedAt.getTime()).toBe(armedAt);
    });

    it('every change writes one knowledge_trigger_updated audit row without the task', async () => {
      await service.update(OWNER, id, { task: `${MARKER} changed`, scopeId: 'three-year-goals' });
      const updated = store.audit.rows.filter((row) => row.eventType === 'knowledge_trigger_updated');
      expect(updated).toHaveLength(1);
      expect(updated[0].payload).toEqual({
        triggerId: id,
        targetKind: 'chief-of-staff',
        workflowId: null,
        scopeId: 'three-year-goals',
      });
    });
  });

  describe('list', () => {
    it('reports KNOWLEDGE_TRIGGERS_ENABLED and GLOBAL_EXECUTION_ENABLED live and the limit', async () => {
      const runs = jest.spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get');
      const others = ['MAIL_TRIGGERS_ENABLED', 'EVENT_TRIGGERS_ENABLED', 'SCHEDULES_ENABLED'] as const;
      const originals = others.map((name) => process.env[name]);
      try {
        runs.mockReturnValue(false);
        expect(await service.list(OWNER)).toEqual({
          enabled: false,
          runsEnabled: false,
          limit: 3,
          triggers: [],
        });
        process.env.KNOWLEDGE_TRIGGERS_ENABLED = 'true';
        runs.mockReturnValue(true);
        expect(await service.list(OWNER)).toEqual({ enabled: true, runsEnabled: true, limit: 3, triggers: [] });
        process.env.KNOWLEDGE_TRIGGERS_ENABLED = 'TRUE';
        expect((await service.list(OWNER)).enabled).toBe(false);
        for (const name of others) process.env[name] = 'true';
        delete process.env.KNOWLEDGE_TRIGGERS_ENABLED;
        expect((await service.list(OWNER)).enabled).toBe(false);
      } finally {
        runs.mockRestore();
        others.forEach((name, index) => {
          if (originals[index] === undefined) delete process.env[name];
          else process.env[name] = originals[index];
        });
      }
    });

    it("lists only the owner's triggers, oldest first, with the newest history row as lastRun", async () => {
      at('2026-11-10T00:00:00Z');
      const first = await service.create(OWNER, body({ task: 'first' }));
      at('2026-11-11T00:00:00Z');
      const second = await service.create(
        OWNER,
        body({ task: 'second', target: { kind: 'workflow', workflowId: OWN_WORKFLOW }, scopeId: 'codebase-context' }),
      );
      await service.create(OTHER, body({ task: 'other' }));
      const older = runRow('r1', first.id, OWNER, '2026-11-12', 'skipped', 'over_cap');
      older.createdAt = new Date('2026-11-12T00:00:00Z');
      const newer = runRow('r2', first.id, OWNER, '2026-11-13', 'started');
      newer.createdAt = new Date('2026-11-13T00:00:00Z');
      newer.changedAt = new Date('2026-11-12T23:55:00Z');
      newer.collaborationRunId = 'run-abc';
      store.runs.rows.push(older, newer);

      const view = await service.list(OWNER);
      expect(view.triggers.map((trigger) => trigger.task)).toEqual(['first', 'second']);
      expect(view.triggers[0].lastRun).toEqual({
        documentId: DOCUMENT_ID,
        changedAt: '2026-11-12T23:55:00.000Z',
        localDate: '2026-11-13',
        outcome: 'started',
        reason: null,
        collaborationRunId: 'run-abc',
        at: '2026-11-13T00:00:00.000Z',
      });
      expect(view.triggers[1].id).toBe(second.id);
      expect(view.triggers[1].scopeId).toBe('codebase-context');
      expect(view.triggers[1].lastRun).toBeNull();
      expect(view.triggers[1].target).toEqual({
        kind: 'workflow',
        workflowId: OWN_WORKFLOW,
        name: 'Research desk',
        status: 'active',
      });
    });

    it('a workflow that is gone reads as name null, status missing', async () => {
      await service.create(OWNER, body({ target: { kind: 'workflow', workflowId: OWN_WORKFLOW } }));
      store.workflows.rows[0].deletedAt = new Date();
      const view = await service.list(OWNER);
      expect(view.triggers[0].target).toEqual({
        kind: 'workflow',
        workflowId: OWN_WORKFLOW,
        name: null,
        status: 'missing',
      });
    });
  });

  it('no audit row and no log line carries the task text, across create, change, list, history, delete and refusals', async () => {
    const created = await service.create(OWNER, body());
    await service.update(OWNER, created.id, { task: `${MARKER} second`, scopeId: 'strategy-docs', enabled: false });
    await service.update(OWNER, created.id, { enabled: true, target: { kind: 'workflow', workflowId: OWN_WORKFLOW } });
    await service.list(OWNER);
    await service.history(OWNER, created.id);
    await service.remove(OWNER, created.id);
    await refusal(() => service.create(OWNER, body({ timeZone: 'Bad/Zone' })));
    await refusal(() => service.create(OWNER, body({ scopeId: 'market-data' })));
    await refusal(() => service.create(OWNER, body({ task: `${MARKER}${'x'.repeat(7000)}` })));

    expect(store.audit.rows.map((row) => row.eventType)).toEqual([
      'knowledge_trigger_created',
      'knowledge_trigger_updated',
      'knowledge_trigger_updated',
      'knowledge_trigger_deleted',
    ]);
    for (const row of store.audit.rows) {
      expect(Object.keys(row.payload).sort()).toEqual(['scopeId', 'targetKind', 'triggerId', 'workflowId']);
      expect(row.category).toBe('trigger');
      expect(row.subjectType).toBe('agent_knowledge_trigger');
    }
    const audit = JSON.stringify(store.audit.rows);
    for (const secret of [MARKER, 'summarise', 'second']) {
      expect(audit).not.toContain(secret);
      expect(logs.join('\n')).not.toContain(secret);
    }
    expect(logs.length).toBeGreaterThanOrEqual(4);
    expect(logs).toContain(
      `knowledge trigger created userId=${OWNER} triggerId=${created.id} targetKind=chief-of-staff scopeId=policies`,
    );
    expect(logs).toContain(
      `knowledge trigger deleted userId=${OWNER} triggerId=${created.id} targetKind=workflow workflowId=${OWN_WORKFLOW} scopeId=strategy-docs`,
    );
  });

  it('the service reads no knowledge document and starts nothing', () => {
    const source = readFileSync(join(__dirname, 'knowledge-trigger.service.ts'), 'utf8');
    expect(source).not.toMatch(
      /KnowledgeDocument|knowledge_documents|KnowledgeService|CollaborationStartService|approveStep|setInterval|setTimeout|ConnectorBroker/,
    );
  });
});

function workflowRow(id: string, userId: string, name: string, status: string): UserAgent {
  return { id, userId, name, status, deletedAt: null } as UserAgent;
}

function runRow(
  id: string,
  triggerId: string,
  userId: string,
  localDate: string,
  outcome: AgentKnowledgeTriggerRun['outcome'],
  reason: string | null = null,
): AgentKnowledgeTriggerRun {
  return {
    id,
    triggerId,
    userId,
    documentId: DOCUMENT_ID,
    documentKey: 'a'.repeat(64),
    changedAt: new Date(`${localDate}T05:57:00Z`),
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

/* ---------- In-memory TypeORM stand-in (the mail trigger service spec's store, without connections). ---------- */

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

/**
 * The repositories' manager. Each transaction gets its own TransactionManager:
 * the rows roll back on a throw, and with honourLocks a
 * pg_advisory_xact_lock waits until the transaction holding the same key
 * ends, as PostgreSQL does.
 */
class MemoryManager {
  honourLocks = true;
  private readonly held = new Map<string, Promise<void>>();

  constructor(private readonly store: MemoryStore) {}

  getRepository(target: unknown): MemoryRepository<object> {
    if (target === AgentKnowledgeTrigger) return this.store.triggers as MemoryRepository<object>;
    if (target === AgentKnowledgeTriggerRun) return this.store.runs as MemoryRepository<object>;
    if (target === UserAgent) return this.store.workflows as MemoryRepository<object>;
    if (target === AuditEventEntity) return this.store.audit as MemoryRepository<object>;
    throw new Error('unknown repository');
  }

  async transaction<R>(work: (manager: TransactionManager) => Promise<R>): Promise<R> {
    const scoped = new TransactionManager(this);
    try {
      return await work(scoped);
    } catch (error) {
      scoped.rollback();
      throw error;
    } finally {
      scoped.end();
    }
  }

  async lock(sql: string, params: unknown[], release: Array<() => void>): Promise<void> {
    this.store.calls.push('manager.query');
    this.store.queries.push({ sql, params });
    if (!this.honourLocks || !/pg_advisory_xact_lock/.test(sql)) return;
    const key = JSON.stringify(params);
    while (this.held.has(key)) {
      await this.held.get(key);
    }
    let unlock!: () => void;
    this.held.set(
      key,
      new Promise<void>((resolve) => {
        unlock = resolve;
      }),
    );
    release.push(() => {
      this.held.delete(key);
      unlock();
    });
  }
}

/**
 * One transaction. Its writes are journalled, so a throw undoes this
 * transaction's own writes only (another transaction's committed rows stay,
 * as in PostgreSQL); its advisory locks are released when it ends.
 */
class TransactionManager {
  private readonly release: Array<() => void> = [];
  private readonly undo: Array<() => void> = [];

  constructor(private readonly root: MemoryManager) {}

  getRepository(target: unknown): MemoryRepository<object> {
    const repository = this.root.getRepository(target);
    const undo = this.undo;
    return Object.assign(Object.create(repository), {
      async insert(entity: object) {
        const result = await repository.insert(entity);
        const id = (entity as Row).id;
        undo.push(() => {
          repository.rows = repository.rows.filter((row) => (row as Row).id !== id);
        });
        return result;
      },
      async update(where: Row, patch: object) {
        const before = repository.rows.filter((row) => matches(row as Row, where)).map((row) => [row, copy(row)] as const);
        const result = await repository.update(where, patch);
        undo.push(() => {
          for (const [row, previous] of before) {
            for (const key of Object.keys(row)) delete (row as Row)[key];
            Object.assign(row, previous);
          }
        });
        return result;
      },
      async delete(where: Row) {
        const removed = repository.rows.filter((row) => matches(row as Row, where));
        const result = await repository.delete(where);
        undo.push(() => {
          repository.rows.push(...removed);
        });
        return result;
      },
    }) as MemoryRepository<object>;
  }

  async query(sql: string, params: unknown[]): Promise<unknown[]> {
    await this.root.lock(sql, params, this.release);
    return [];
  }

  rollback(): void {
    for (const step of this.undo.splice(0).reverse()) step();
  }

  end(): void {
    for (const unlock of this.release.splice(0)) unlock();
  }
}

class MemoryStore {
  calls: string[] = [];
  queries: Array<{ sql: string; params: unknown[] }> = [];
  triggers = new MemoryRepository<AgentKnowledgeTrigger>('triggers', this.calls);
  runs = new MemoryRepository<AgentKnowledgeTriggerRun>('runs', this.calls, [['triggerId', 'documentKey']]);
  workflows = new MemoryRepository<UserAgent>('workflows', this.calls);
  audit = new MemoryRepository<AuditEventEntity>('audit', this.calls);
  manager = new MemoryManager(this);

  constructor() {
    for (const repository of [this.triggers, this.runs, this.workflows, this.audit]) {
      repository.manager = this.manager;
    }
  }
}
