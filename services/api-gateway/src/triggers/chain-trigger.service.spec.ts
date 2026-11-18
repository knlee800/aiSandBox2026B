import { HttpException, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { FindOperator } from 'typeorm';
import { AgentChainTrigger } from '../entities/agent-chain-trigger.entity';
import { AgentChainTriggerRun } from '../entities/agent-chain-trigger-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { UserAgent } from '../entities/user-agent.entity';
import { isRunResultToolEnabled } from '../orchestration/collaboration-result-grant';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import {
  CHAIN_TRIGGER_AUDIT_CATEGORY,
  CHAIN_TRIGGER_AUDIT_SUBJECT_TYPE,
  CHAIN_TRIGGER_HISTORY_LIMIT,
  CHAIN_TRIGGER_LIMIT_LOCK_NAMESPACE,
  ChainTriggerService,
} from './chain-trigger.service';
import { CHAIN_TRIGGER_ERROR_CODES } from './chain-trigger-validation';
import { EVENT_TRIGGER_LIMIT_LOCK_NAMESPACE } from './event-trigger.service';
import { KNOWLEDGE_TRIGGER_LIMIT_LOCK_NAMESPACE } from './knowledge-trigger.service';
import { MAIL_TRIGGER_LIMIT_LOCK_NAMESPACE } from './mail-trigger.service';
import { SCHEDULE_LIMIT_LOCK_NAMESPACE } from './schedule.service';

// The result tool's switch is read through its own exported reader; here the
// reader is replaced so the list can be checked both ways.
jest.mock('../orchestration/collaboration-result-grant', () => ({
  ...jest.requireActual('../orchestration/collaboration-result-grant'),
  isRunResultToolEnabled: jest.fn(() => false),
}));
const resultTool = isRunResultToolEnabled as jest.MockedFunction<typeof isRunResultToolEnabled>;

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const WF_A = '33333333-3333-4333-8333-333333333333';
const WF_B = '3bbbbbbb-3333-4333-8333-333333333333';
const WF_C = '3ccccccc-3333-4333-8333-333333333333';
const OTHER_WORKFLOW = '44444444-4444-4444-8444-444444444444';
const DELETED_WORKFLOW = '55555555-5555-4555-8555-555555555555';
const UNKNOWN_ID = '66666666-6666-4666-8666-666666666666';
const MARKER = 'MARKER-TASK-4e71';
const NAMES = ['Research desk', 'Weekly digest', 'Billing review', 'Not yours', 'Deleted flow'];

function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceWorkflowId: WF_A,
    target: { kind: 'chief-of-staff' },
    task: `${MARKER} summarise the finished run`,
    timeZone: 'Asia/Taipei',
    ...overrides,
  };
}

function toWorkflow(workflowId: string): Record<string, unknown> {
  return { kind: 'workflow', workflowId };
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

describe('ChainTriggerService (TRIGGER-CHAIN-01 S1)', () => {
  const originalFlag = process.env.CHAIN_TRIGGERS_ENABLED;
  let store: MemoryStore;
  let service: ChainTriggerService;
  let logs: string[];
  let restoreLogs: () => void;

  beforeEach(() => {
    delete process.env.CHAIN_TRIGGERS_ENABLED;
    resultTool.mockReset();
    resultTool.mockReturnValue(false);
    store = new MemoryStore();
    store.workflows.rows.push(
      workflowRow(WF_A, OWNER, 'Research desk', 'active'),
      workflowRow(WF_B, OWNER, 'Weekly digest', 'active'),
      workflowRow(WF_C, OWNER, 'Billing review', 'draft'),
      workflowRow(OTHER_WORKFLOW, OTHER, 'Not yours', 'active'),
      { ...workflowRow(DELETED_WORKFLOW, OWNER, 'Deleted flow', 'active'), deletedAt: new Date('2026-11-01T00:00:00Z') },
    );
    service = new ChainTriggerService(store.triggers as never, store.runs as never, store.workflows as never);
    logs = [];
    restoreLogs = watchLogs(logs);
  });

  afterEach(() => {
    restoreLogs();
    jest.useRealTimers();
    if (originalFlag === undefined) delete process.env.CHAIN_TRIGGERS_ENABLED;
    else process.env.CHAIN_TRIGGERS_ENABLED = originalFlag;
  });

  function at(iso: string): void {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(new Date(iso));
  }

  function writes(): string[] {
    return store.calls.filter((call) => /\.(insert|update|delete)$/.test(call));
  }

  function snapshot(): string {
    return JSON.stringify({ triggers: store.triggers.rows, runs: store.runs.rows, audit: store.audit.rows });
  }

  describe('create', () => {
    it('stores the trigger, arms it at create, and answers the section 4 view', async () => {
      const view = await service.create(OWNER, body());
      expect(store.triggers.rows).toHaveLength(1);
      const row = store.triggers.rows[0];
      expect(row).toMatchObject({
        id: view.id,
        userId: OWNER,
        sourceWorkflowId: WF_A,
        targetKind: 'chief-of-staff',
        workflowId: null,
        task: `${MARKER} summarise the finished run`,
        timeZone: 'Asia/Taipei',
        enabled: true,
      });
      expect(row.armedAt.getTime()).toBe(row.createdAt.getTime());
      expect(view).toEqual({
        id: row.id,
        sourceWorkflowId: WF_A,
        source: { workflowId: WF_A, name: 'Research desk', status: 'active' },
        target: { kind: 'chief-of-staff' },
        task: `${MARKER} summarise the finished run`,
        timeZone: 'Asia/Taipei',
        enabled: true,
        firesOn: 'completed',
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        lastRun: null,
      });
      expect(view.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('writes one chain_trigger_created audit row with the trigger id, target kind and the two workflow ids only', async () => {
      const view = await service.create(OWNER, body({ target: toWorkflow(WF_B) }));
      expect(store.audit.rows).toHaveLength(1);
      expect(store.audit.rows[0]).toMatchObject({
        category: CHAIN_TRIGGER_AUDIT_CATEGORY,
        eventType: 'chain_trigger_created',
        subjectType: CHAIN_TRIGGER_AUDIT_SUBJECT_TYPE,
        subjectId: view.id,
        userId: OWNER,
        payload: { triggerId: view.id, targetKind: 'workflow', sourceWorkflowId: WF_A, workflowId: WF_B, firesOn: 'completed' },
      });
      expect(Object.keys(store.audit.rows[0].payload).sort()).toEqual([
        'firesOn',
        'sourceWorkflowId',
        'targetKind',
        'triggerId',
        'workflowId',
      ]);
      expect(CHAIN_TRIGGER_AUDIT_CATEGORY).toBe('trigger');
      expect(CHAIN_TRIGGER_AUDIT_SUBJECT_TYPE).toBe('agent_chain_trigger');
    });

    it("a trigger for another of the owner's workflows carries the target's name and status", async () => {
      const view = await service.create(OWNER, body({ target: toWorkflow(WF_C) }));
      expect(view.target).toEqual({ kind: 'workflow', workflowId: WF_C, name: 'Billing review', status: 'draft' });
      expect(view.sourceWorkflowId).toBe(WF_A);
      expect(store.triggers.rows[0]).toMatchObject({ targetKind: 'workflow', workflowId: WF_C });
    });

    it.each([
      ["another owner's", OTHER_WORKFLOW],
      ['an unknown', UNKNOWN_ID],
      ['a deleted', DELETED_WORKFLOW],
    ])('%s workflow as the source answers 404 and writes nothing', async (_label, sourceWorkflowId) => {
      const { status, body: response } = await refusal(() => service.create(OWNER, body({ sourceWorkflowId })));
      expect(status).toBe(404);
      expect(response.code).toBe(CHAIN_TRIGGER_ERROR_CODES.workflowNotFound);
      expect(writes()).toEqual([]);
      expect(store.triggers.rows).toHaveLength(0);
      expect(store.audit.rows).toHaveLength(0);
    });

    it.each([
      ["another owner's", OTHER_WORKFLOW],
      ['an unknown', UNKNOWN_ID],
      ['a deleted', DELETED_WORKFLOW],
      ['a malformed', 'not-a-uuid'],
    ])('%s workflow as the target answers 404 and writes nothing', async (_label, workflowId) => {
      const { status, body: response } = await refusal(() =>
        service.create(OWNER, body({ target: toWorkflow(workflowId) })),
      );
      expect(status).toBe(404);
      expect(response.code).toBe(CHAIN_TRIGGER_ERROR_CODES.workflowNotFound);
      expect(writes()).toEqual([]);
      expect(store.triggers.rows).toHaveLength(0);
    });

    it('a target equal to the source is refused with 400 chain_trigger_same_workflow; nothing read or written', async () => {
      const { status, body: response } = await refusal(() => service.create(OWNER, body({ target: toWorkflow(WF_A) })));
      expect(status).toBe(400);
      expect(response.code).toBe(CHAIN_TRIGGER_ERROR_CODES.sameWorkflow);
      expect(store.calls).toEqual([]);
    });

    it('the fourth trigger is refused with 409 chain_trigger_limit_reached; switched-off ones count', async () => {
      await service.create(OWNER, body({ target: toWorkflow(WF_B) }));
      await service.create(OWNER, body({ enabled: false }));
      await service.create(OWNER, body({ sourceWorkflowId: WF_B }));
      // Another owner's triggers do not count against this owner.
      await service.create(OTHER, body({ sourceWorkflowId: OTHER_WORKFLOW }));
      const callsBefore = writes().length;
      const { status, body: response } = await refusal(() => service.create(OWNER, body({ sourceWorkflowId: WF_C })));
      expect(status).toBe(409);
      expect(response).toEqual({
        statusCode: 409,
        message: 'At most 3 chain triggers per account',
        error: 'Conflict',
        code: CHAIN_TRIGGER_ERROR_CODES.limitReached,
        limit: 3,
      });
      expect(writes().length).toBe(callsBefore);
      expect(store.triggers.rows.filter((row) => row.userId === OWNER)).toHaveLength(3);
      expect(store.audit.rows.filter((row) => row.userId === OWNER)).toHaveLength(3);

      // After a delete there is room again.
      await service.remove(OWNER, store.triggers.rows[0].id);
      await service.create(OWNER, body({ sourceWorkflowId: WF_C }));
      expect(store.triggers.rows.filter((row) => row.userId === OWNER)).toHaveLength(3);
    });

    it('takes the per-owner transaction lock (its own namespace 1814) before counting and before the cycle check', async () => {
      await service.create(OWNER, body({ target: toWorkflow(WF_B) }));
      expect(store.queries).toEqual([
        { sql: 'SELECT pg_advisory_xact_lock($1, hashtext($2))', params: [CHAIN_TRIGGER_LIMIT_LOCK_NAMESPACE, OWNER] },
      ]);
      expect(CHAIN_TRIGGER_LIMIT_LOCK_NAMESPACE).toBe(1814);
      expect(
        new Set([
          CHAIN_TRIGGER_LIMIT_LOCK_NAMESPACE,
          SCHEDULE_LIMIT_LOCK_NAMESPACE,
          EVENT_TRIGGER_LIMIT_LOCK_NAMESPACE,
          MAIL_TRIGGER_LIMIT_LOCK_NAMESPACE,
          KNOWLEDGE_TRIGGER_LIMIT_LOCK_NAMESPACE,
        ]).size,
      ).toBe(5);
      const lockAt = store.calls.indexOf('manager.query');
      expect(lockAt).toBe(0);
      expect(lockAt).toBeLessThan(store.calls.indexOf('triggers.count'));
      expect(store.calls.indexOf('triggers.count')).toBeLessThan(store.calls.indexOf('triggers.find'));
      expect(store.calls.indexOf('triggers.find')).toBeLessThan(store.calls.indexOf('triggers.insert'));
    });

    it('five concurrent creates by one owner leave exactly three (the lock serialises count and insert)', async () => {
      store.manager.honourLocks = true;
      const results = await Promise.allSettled(Array.from({ length: 5 }, () => service.create(OWNER, body())));
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(3);
      const refused = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      expect(refused).toHaveLength(2);
      for (const result of refused) {
        expect((result.reason as HttpException).getStatus()).toBe(409);
        expect((result.reason as HttpException).getResponse()).toMatchObject({ code: 'chain_trigger_limit_reached' });
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
      await refusal(() => service.create(OWNER, body({ sourceWorkflowId: 'chief-of-staff' })));
      await refusal(() => service.create(OWNER, body({ sourceWorkflowId: undefined })));
      await refusal(() => service.create(OWNER, body({ task: 'a'.repeat(7001) })));
      await refusal(() => service.create(OWNER, body({ depth: 1 })));
      expect(store.calls).toEqual([]);
    });
  });

  describe('the cycle check (stage-start section 3, bound 1)', () => {
    it('A to B, then B to A is refused with 409 chain_trigger_cycle and writes nothing', async () => {
      await service.create(OWNER, body({ target: toWorkflow(WF_B) }));
      const before = snapshot();
      const { status, body: response } = await refusal(() =>
        service.create(OWNER, body({ sourceWorkflowId: WF_B, target: toWorkflow(WF_A) })),
      );
      expect(status).toBe(409);
      expect(response).toEqual({
        statusCode: 409,
        message: 'This trigger would close a loop of chain triggers',
        error: 'Conflict',
        code: CHAIN_TRIGGER_ERROR_CODES.cycle,
      });
      expect(snapshot()).toBe(before);
    });

    it('A to B, B to C, then C to A is refused', async () => {
      await service.create(OWNER, body({ target: toWorkflow(WF_B) }));
      await service.create(OWNER, body({ sourceWorkflowId: WF_B, target: toWorkflow(WF_C) }));
      const { status, body: response } = await refusal(() =>
        service.create(OWNER, body({ sourceWorkflowId: WF_C, target: toWorkflow(WF_A) })),
      );
      expect(status).toBe(409);
      expect(response.code).toBe(CHAIN_TRIGGER_ERROR_CODES.cycle);
      expect(store.triggers.rows).toHaveLength(2);
    });

    it('switched-off triggers count', async () => {
      await service.create(OWNER, body({ target: toWorkflow(WF_B), enabled: false }));
      const { body: response } = await refusal(() =>
        service.create(OWNER, body({ sourceWorkflowId: WF_B, target: toWorkflow(WF_A), enabled: false })),
      );
      expect(response.code).toBe(CHAIN_TRIGGER_ERROR_CODES.cycle);
    });

    it('edges to the Chief of Staff never close a cycle', async () => {
      await service.create(OWNER, body());
      await service.create(OWNER, body({ sourceWorkflowId: WF_B }));
      await service.create(OWNER, body({ sourceWorkflowId: WF_B, target: toWorkflow(WF_A) }));
      expect(store.triggers.rows).toHaveLength(3);
    });

    it('a diamond (A to B, B to C, A to C) is not a cycle', async () => {
      await service.create(OWNER, body({ target: toWorkflow(WF_B) }));
      await service.create(OWNER, body({ sourceWorkflowId: WF_B, target: toWorkflow(WF_C) }));
      await service.create(OWNER, body({ target: toWorkflow(WF_C) }));
      expect(store.triggers.rows).toHaveLength(3);
    });

    it("another owner's triggers are not part of this owner's graph", async () => {
      store.workflows.rows.push(workflowRow(WF_B, OTHER, 'Weekly digest', 'active'));
      store.triggers.rows.push(triggerRow('their-1', OTHER, WF_B, WF_A));
      await service.create(OWNER, body({ target: toWorkflow(WF_B) }));
      expect(store.triggers.rows.filter((row) => row.userId === OWNER)).toHaveLength(1);
    });

    it('a change of the target that closes a cycle is refused and changes nothing', async () => {
      await service.create(OWNER, body({ target: toWorkflow(WF_B) }));
      const second = await service.create(OWNER, body({ sourceWorkflowId: WF_B }));
      const before = snapshot();
      store.calls.length = 0;
      const { status, body: response } = await refusal(() => service.update(OWNER, second.id, { target: toWorkflow(WF_A) }));
      expect(status).toBe(409);
      expect(response.code).toBe(CHAIN_TRIGGER_ERROR_CODES.cycle);
      expect(writes()).toEqual([]);
      expect(snapshot()).toBe(before);
      expect(store.calls[0]).toBe('manager.query');
    });

    it('a change of the source that closes a cycle is refused and changes nothing', async () => {
      await service.create(OWNER, body({ target: toWorkflow(WF_B) }));
      await service.create(OWNER, body({ sourceWorkflowId: WF_B, target: toWorkflow(WF_C) }));
      const third = await service.create(OWNER, body({ target: toWorkflow(WF_C) }));
      const before = snapshot();
      // A to C becomes C to A: with A to B and B to C that closes A, B, C.
      const { status, body: response } = await refusal(() =>
        service.update(OWNER, third.id, { sourceWorkflowId: WF_C, target: toWorkflow(WF_A) }),
      );
      expect(status).toBe(409);
      expect(response.code).toBe(CHAIN_TRIGGER_ERROR_CODES.cycle);
      expect(snapshot()).toBe(before);
      // Only the source changes: B to C becomes ... the stored target C with source A, no cycle.
      const changed = await service.update(OWNER, third.id, { sourceWorkflowId: WF_B });
      expect(changed.sourceWorkflowId).toBe(WF_B);
    });

    it("a change that moves the trigger's own edge is judged without its old edge", async () => {
      const first = await service.create(OWNER, body({ target: toWorkflow(WF_B) }));
      // A to B changed to B to A: no other edge, so no cycle.
      const changed = await service.update(OWNER, first.id, { sourceWorkflowId: WF_B, target: toWorkflow(WF_A) });
      expect(changed).toMatchObject({ sourceWorkflowId: WF_B, target: { kind: 'workflow', workflowId: WF_A } });
    });

    it('two concurrent creates that would close a cycle together: one is saved, one refused (under the lock)', async () => {
      store.manager.honourLocks = true;
      const results = await Promise.allSettled([
        service.create(OWNER, body({ target: toWorkflow(WF_B) })),
        service.create(OWNER, body({ sourceWorkflowId: WF_B, target: toWorkflow(WF_A) })),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const refused = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      expect((refused[0].reason as HttpException).getResponse()).toMatchObject({ code: 'chain_trigger_cycle' });
      expect(store.triggers.rows).toHaveLength(1);
    });

    it('a change of the task, zone or switch takes no lock and runs no cycle check', async () => {
      const own = await service.create(OWNER, body({ target: toWorkflow(WF_B) }));
      store.calls.length = 0;
      store.queries.length = 0;
      await service.update(OWNER, own.id, { task: 'other', timeZone: 'UTC', enabled: false });
      expect(store.queries).toEqual([]);
      expect(store.calls).not.toContain('triggers.find');
    });
  });

  describe('owner scoping on change, delete and history', () => {
    let ownId: string;
    let otherId: string;

    beforeEach(async () => {
      ownId = (await service.create(OWNER, body())).id;
      otherId = (await service.create(OTHER, body({ sourceWorkflowId: OTHER_WORKFLOW, task: 'other task' }))).id;
      store.runs.rows.push(runRow('r-other', otherId, OTHER, '2026-11-14', 'started'));
      store.calls.length = 0;
    });

    it.each([
      ["another owner's trigger", () => otherId],
      ['an unknown id', () => UNKNOWN_ID],
    ])('%s answers 404 on update, delete and history and changes nothing', async (_label, idOf) => {
      const before = snapshot();
      for (const work of [
        () => service.update(OWNER, idOf(), { enabled: false }),
        () => service.update(OWNER, idOf(), { sourceWorkflowId: WF_B }),
        () => service.remove(OWNER, idOf()),
        () => service.history(OWNER, idOf()),
      ]) {
        const { status, body: response } = await refusal(work);
        expect(status).toBe(404);
        expect(response).toEqual({
          statusCode: 404,
          message: 'Chain trigger not found',
          error: 'Not Found',
          code: CHAIN_TRIGGER_ERROR_CODES.notFound,
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
    ])('changing the source or the target to %s workflow answers 404 and changes nothing', async (_label, workflowId) => {
      const before = snapshot();
      for (const patch of [{ sourceWorkflowId: workflowId, task: 'changed' }, { target: toWorkflow(workflowId), task: 'changed' }]) {
        const { status, body: response } = await refusal(() => service.update(OWNER, ownId, patch));
        expect(status).toBe(404);
        expect(response.code).toBe(CHAIN_TRIGGER_ERROR_CODES.workflowNotFound);
      }
      expect(writes()).toEqual([]);
      expect(snapshot()).toBe(before);
    });

    it('the same-workflow rule holds on the merged row: a source onto the stored target, a target onto the stored source', async () => {
      await service.update(OWNER, ownId, { target: toWorkflow(WF_B) });
      store.calls.length = 0;
      const before = snapshot();
      for (const patch of [{ sourceWorkflowId: WF_B }, { target: toWorkflow(WF_A) }]) {
        const { status, body: response } = await refusal(() => service.update(OWNER, ownId, patch));
        expect(status).toBe(400);
        expect(response.code).toBe(CHAIN_TRIGGER_ERROR_CODES.sameWorkflow);
      }
      expect(writes()).toEqual([]);
      expect(snapshot()).toBe(before);
    });

    it("the owner's own changes work and touch only the owner's row", async () => {
      const view = await service.update(OWNER, ownId, {
        sourceWorkflowId: WF_B,
        target: toWorkflow(WF_C),
        task: ' new task ',
        timeZone: 'Europe/London',
        enabled: false,
      });
      expect(view).toMatchObject({
        id: ownId,
        sourceWorkflowId: WF_B,
        target: { kind: 'workflow', workflowId: WF_C, name: 'Billing review', status: 'draft' },
        task: 'new task',
        timeZone: 'Europe/London',
        enabled: false,
      });
      const other = store.triggers.rows.find((row) => row.id === otherId)!;
      expect(other).toMatchObject({ task: 'other task', sourceWorkflowId: OTHER_WORKFLOW, enabled: true });
      const back = await service.update(OWNER, ownId, { target: { kind: 'chief-of-staff' } });
      expect(back.target).toEqual({ kind: 'chief-of-staff' });
      expect(store.triggers.rows.find((row) => row.id === ownId)!.workflowId).toBeNull();
    });

    it('a change keeps an existing workflow target that has since been deleted (no re-check unless sent)', async () => {
      await service.update(OWNER, ownId, { target: toWorkflow(WF_B) });
      store.workflows.rows.find((row) => row.id === WF_B)!.deletedAt = new Date();
      const view = await service.update(OWNER, ownId, { task: 'still here' });
      expect(view.target).toEqual({ kind: 'workflow', workflowId: WF_B, name: null, status: 'missing' });
    });

    it('delete removes the trigger and its history rows only, with one chain_trigger_deleted audit row', async () => {
      store.runs.rows.push(
        runRow('r1', ownId, OWNER, '2026-11-13', 'started'),
        runRow('r2', ownId, OWNER, '2026-11-14', 'skipped', 'day_limit'),
      );
      const result = await service.remove(OWNER, ownId);
      expect(result).toEqual({ id: ownId, deleted: true });
      expect(store.triggers.rows.map((row) => row.id)).toEqual([otherId]);
      expect(store.runs.rows.map((row) => row.id)).toEqual(['r-other']);
      const audit = store.audit.rows.filter((row) => row.eventType === 'chain_trigger_deleted');
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        subjectId: ownId,
        subjectType: 'agent_chain_trigger',
        userId: OWNER,
        payload: { triggerId: ownId, targetKind: 'chief-of-staff', sourceWorkflowId: WF_A, workflowId: null },
      });
      expect((await refusal(() => service.history(OWNER, ownId))).status).toBe(404);
    });

    it('history answers the last 30 rows, newest first, ids, times, the depth and codes only', async () => {
      for (let i = 0; i < 35; i += 1) {
        const day = new Date(Date.UTC(2026, 9, 1 + i));
        const run = runRow(`r${i}`, ownId, OWNER, day.toISOString().slice(0, 10), i % 2 ? 'started' : 'skipped', i % 2 ? null : 'day_limit');
        run.createdAt = day;
        run.sourceCompletedAt = new Date(day.getTime() - 3 * 60_000);
        run.collaborationRunId = i % 2 ? `collab_run-${i}` : null;
        run.depth = 1 + (i % 3);
        store.runs.rows.push(run);
      }
      const { runs } = await service.history(OWNER, ownId);
      expect(runs).toHaveLength(CHAIN_TRIGGER_HISTORY_LIMIT);
      expect(CHAIN_TRIGGER_HISTORY_LIMIT).toBe(30);
      expect(runs[0]).toEqual({
        id: 'r34',
        sourceRunId: 'collab_source-r34',
        sourceCompletedAt: new Date(Date.UTC(2026, 9, 35) - 3 * 60_000).toISOString(),
        localDate: '2026-11-04',
        depth: 2,
        outcome: 'skipped',
        reason: 'day_limit',
        collaborationRunId: null,
        at: new Date(Date.UTC(2026, 9, 35)).toISOString(),
      });
      expect(runs[1]).toMatchObject({ id: 'r33', outcome: 'started', reason: null, collaborationRunId: 'collab_run-33', depth: 1 });
      expect(runs.map((run) => run.id)).not.toContain('r-other');
      expect(runs[29].id).toBe('r5');
    });
  });

  describe('armed_at (stage-start section 2: create, switch-on and a source change only)', () => {
    let id: string;
    let armedAt: number;

    beforeEach(async () => {
      at('2026-11-16T00:00:00Z');
      id = (await service.create(OWNER, body())).id;
      armedAt = store.triggers.rows[0].armedAt.getTime();
      at('2026-11-16T03:00:00Z');
    });

    const later = new Date('2026-11-16T03:00:00Z').getTime();

    function current(): AgentChainTrigger {
      return store.triggers.rows.find((row) => row.id === id)!;
    }

    it('create arms at the create time', () => {
      expect(armedAt).toBe(new Date('2026-11-16T00:00:00Z').getTime());
      expect(current().createdAt.getTime()).toBe(armedAt);
    });

    it.each([
      ['the source', { sourceWorkflowId: WF_B }],
      ['the source and the task', { sourceWorkflowId: WF_C, task: 'other task' }],
      ['the source and the target', { sourceWorkflowId: WF_B, target: toWorkflow(WF_C) }],
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
      ['the zone', { timeZone: 'Europe/London' }],
      ['the target', { target: toWorkflow(WF_B) }],
      ['the target back to the Chief of Staff', { target: { kind: 'chief-of-staff' } }],
      ['the same source', { sourceWorkflowId: WF_A }],
      ['enabled true while already on', { enabled: true }],
    ])('changing %s does not re-arm', async (_label, patch) => {
      await service.update(OWNER, id, patch);
      expect(current().armedAt.getTime()).toBe(armedAt);
      expect(current().updatedAt.getTime()).toBe(later);
    });

    it('a refused change does not re-arm', async () => {
      await refusal(() => service.update(OWNER, id, { sourceWorkflowId: OTHER_WORKFLOW, enabled: true }));
      await refusal(() => service.update(OWNER, id, { sourceWorkflowId: WF_B, timeZone: 'Bad/Zone' }));
      expect(current().armedAt.getTime()).toBe(armedAt);
    });

    it('every change writes one chain_trigger_updated audit row without the task', async () => {
      await service.update(OWNER, id, { task: `${MARKER} changed`, sourceWorkflowId: WF_B });
      const updated = store.audit.rows.filter((row) => row.eventType === 'chain_trigger_updated');
      expect(updated).toHaveLength(1);
      expect(updated[0].payload).toEqual({
        triggerId: id,
        targetKind: 'chief-of-staff',
        sourceWorkflowId: WF_B,
        workflowId: null,
        firesOn: 'completed',
      });
    });
  });

  describe('list', () => {
    it('reports CHAIN_TRIGGERS_ENABLED, GLOBAL_EXECUTION_ENABLED and the result tool switch live, and the limit', async () => {
      const runs = jest.spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get');
      const others = ['KNOWLEDGE_TRIGGERS_ENABLED', 'MAIL_TRIGGERS_ENABLED', 'EVENT_TRIGGERS_ENABLED', 'SCHEDULES_ENABLED'] as const;
      const originals = others.map((name) => process.env[name]);
      try {
        runs.mockReturnValue(false);
        expect(await service.list(OWNER)).toEqual({
          enabled: false,
          runsEnabled: false,
          resultToolEnabled: false,
          limit: 3,
          triggers: [],
        });
        process.env.CHAIN_TRIGGERS_ENABLED = 'true';
        runs.mockReturnValue(true);
        resultTool.mockReturnValue(true);
        expect(await service.list(OWNER)).toEqual({
          enabled: true,
          runsEnabled: true,
          resultToolEnabled: true,
          limit: 3,
          triggers: [],
        });
        process.env.CHAIN_TRIGGERS_ENABLED = 'TRUE';
        expect((await service.list(OWNER)).enabled).toBe(false);
        for (const name of others) process.env[name] = 'true';
        delete process.env.CHAIN_TRIGGERS_ENABLED;
        expect((await service.list(OWNER)).enabled).toBe(false);
        // Each list reads the result tool switch once, live.
        expect(resultTool).toHaveBeenCalledTimes(4);
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
      const second = await service.create(OWNER, body({ task: 'second', sourceWorkflowId: WF_B, target: toWorkflow(WF_C) }));
      await service.create(OTHER, body({ task: 'other', sourceWorkflowId: OTHER_WORKFLOW }));
      const older = runRow('r1', first.id, OWNER, '2026-11-12', 'skipped', 'over_cap');
      older.createdAt = new Date('2026-11-12T00:00:00Z');
      const newer = runRow('r2', first.id, OWNER, '2026-11-13', 'started');
      newer.createdAt = new Date('2026-11-13T00:00:00Z');
      newer.sourceCompletedAt = new Date('2026-11-12T23:55:00Z');
      newer.collaborationRunId = 'collab_abc';
      newer.depth = 2;
      store.runs.rows.push(older, newer);

      const view = await service.list(OWNER);
      expect(view.triggers.map((trigger) => trigger.task)).toEqual(['first', 'second']);
      expect(view.triggers[0].lastRun).toEqual({
        sourceRunId: 'collab_source-r2',
        sourceCompletedAt: '2026-11-12T23:55:00.000Z',
        localDate: '2026-11-13',
        depth: 2,
        outcome: 'started',
        reason: null,
        collaborationRunId: 'collab_abc',
        at: '2026-11-13T00:00:00.000Z',
      });
      expect(view.triggers[1].id).toBe(second.id);
      expect(view.triggers[1].sourceWorkflowId).toBe(WF_B);
      expect(view.triggers[1].lastRun).toBeNull();
      expect(view.triggers[1].target).toEqual({
        kind: 'workflow',
        workflowId: WF_C,
        name: 'Billing review',
        status: 'draft',
      });
    });

    it('a target workflow that is gone reads as name null, status missing; a gone source keeps its id', async () => {
      await service.create(OWNER, body({ target: toWorkflow(WF_B) }));
      for (const row of store.workflows.rows) row.deletedAt = new Date();
      const view = await service.list(OWNER);
      expect(view.triggers[0].sourceWorkflowId).toBe(WF_A);
      expect(view.triggers[0].source).toEqual({ workflowId: WF_A, name: null, status: 'missing' });
      expect(view.triggers[0].target).toEqual({ kind: 'workflow', workflowId: WF_B, name: null, status: 'missing' });
    });
  });

  describe('the source view (CHAIN-SOURCE-OFF-01: warn, not refuse)', () => {
    const WF_OFF = '3ddddddd-3333-4333-8333-333333333333';
    const OFF_NAME = 'Switched off flow';

    beforeEach(() => {
      store.workflows.rows.push(workflowRow(WF_OFF, OWNER, OFF_NAME, 'disabled'));
    });

    it('the list carries each source with its status (active, draft, disabled, deleted) from one workflow query', async () => {
      store.triggers.rows.push(
        triggerRow('t-active', OWNER, WF_A, WF_B),
        triggerRow('t-draft', OWNER, WF_C, null),
        triggerRow('t-off', OWNER, WF_OFF, WF_A),
        triggerRow('t-gone', OWNER, DELETED_WORKFLOW, null),
        triggerRow('t-unknown', OWNER, UNKNOWN_ID, null),
      );
      store.calls.length = 0;
      const view = await service.list(OWNER);
      expect(store.calls.filter((call) => call.startsWith('workflows.'))).toEqual(['workflows.find']);
      const byId = new Map(view.triggers.map((trigger) => [trigger.id, trigger]));
      expect(byId.get('t-active')!.source).toEqual({ workflowId: WF_A, name: 'Research desk', status: 'active' });
      expect(byId.get('t-draft')!.source).toEqual({ workflowId: WF_C, name: 'Billing review', status: 'draft' });
      expect(byId.get('t-off')!.source).toEqual({ workflowId: WF_OFF, name: OFF_NAME, status: 'disabled' });
      expect(byId.get('t-gone')!.source).toEqual({ workflowId: DELETED_WORKFLOW, name: null, status: 'missing' });
      expect(byId.get('t-unknown')!.source).toEqual({ workflowId: UNKNOWN_ID, name: null, status: 'missing' });
      for (const trigger of view.triggers) {
        expect(trigger.sourceWorkflowId).toBe(trigger.source.workflowId);
      }
      // The target view is unchanged and comes from the same query.
      expect(byId.get('t-active')!.target).toEqual({ kind: 'workflow', workflowId: WF_B, name: 'Weekly digest', status: 'active' });
      expect(byId.get('t-off')!.target).toEqual({ kind: 'workflow', workflowId: WF_A, name: 'Research desk', status: 'active' });
    });

    it("another owner's workflow as a stored source reads as missing (the lookup is by owner)", async () => {
      store.triggers.rows.push(triggerRow('t-theirs', OWNER, OTHER_WORKFLOW, null));
      const view = await service.list(OWNER);
      expect(view.triggers[0].source).toEqual({ workflowId: OTHER_WORKFLOW, name: null, status: 'missing' });
    });

    it.each([
      ['switched-off', WF_OFF, OFF_NAME, 'disabled'],
      ['not yet switched-on', WF_C, 'Billing review', 'draft'],
    ])('a create with a %s source is saved, switched on, and answers its status', async (_label, sourceWorkflowId, name, status) => {
      const view = await service.create(OWNER, body({ sourceWorkflowId, target: toWorkflow(WF_B) }));
      expect(view).toMatchObject({
        sourceWorkflowId,
        source: { workflowId: sourceWorkflowId, name, status },
        target: { kind: 'workflow', workflowId: WF_B, name: 'Weekly digest', status: 'active' },
        enabled: true,
      });
      expect(store.triggers.rows).toHaveLength(1);
      expect(store.triggers.rows[0]).toMatchObject({ sourceWorkflowId, enabled: true });
    });

    it('switching on a trigger whose source is switched off succeeds and answers the stored source with its status', async () => {
      const created = await service.create(OWNER, body({ sourceWorkflowId: WF_OFF, enabled: false }));
      expect(created.source.status).toBe('disabled');
      const on = await service.update(OWNER, created.id, { enabled: true });
      expect(on).toMatchObject({
        enabled: true,
        sourceWorkflowId: WF_OFF,
        source: { workflowId: WF_OFF, name: OFF_NAME, status: 'disabled' },
        target: { kind: 'chief-of-staff' },
      });
      expect(store.triggers.rows[0].enabled).toBe(true);
    });

    it('a change of the source to a switched-off workflow is saved; a later switch of the workflow shows on the next answer', async () => {
      const created = await service.create(OWNER, body({ target: toWorkflow(WF_B) }));
      const changed = await service.update(OWNER, created.id, { sourceWorkflowId: WF_OFF });
      expect(changed.source).toEqual({ workflowId: WF_OFF, name: OFF_NAME, status: 'disabled' });
      expect(changed.target).toEqual({ kind: 'workflow', workflowId: WF_B, name: 'Weekly digest', status: 'active' });
      store.workflows.rows.find((row) => row.id === WF_OFF)!.status = 'active';
      const later = await service.update(OWNER, created.id, { task: 'later' });
      expect(later.source).toEqual({ workflowId: WF_OFF, name: OFF_NAME, status: 'active' });
      store.workflows.rows.find((row) => row.id === WF_OFF)!.deletedAt = new Date();
      const gone = await service.update(OWNER, created.id, { timeZone: 'UTC' });
      expect(gone.source).toEqual({ workflowId: WF_OFF, name: null, status: 'missing' });
      expect(gone.sourceWorkflowId).toBe(WF_OFF);
    });

    it('a change that checks neither workflow reads the stored source and target in one query', async () => {
      const created = await service.create(OWNER, body({ sourceWorkflowId: WF_OFF, target: toWorkflow(WF_B) }));
      store.calls.length = 0;
      const view = await service.update(OWNER, created.id, { task: 'other' });
      expect(store.calls.filter((call) => call.startsWith('workflows.'))).toEqual(['workflows.find']);
      expect(view.source.status).toBe('disabled');
      expect(view.target).toMatchObject({ workflowId: WF_B, status: 'active' });
    });

    it('a change that checked the source and the target reads no workflow again', async () => {
      const created = await service.create(OWNER, body());
      store.calls.length = 0;
      const view = await service.update(OWNER, created.id, { sourceWorkflowId: WF_OFF, target: toWorkflow(WF_B) });
      expect(store.calls.filter((call) => call.startsWith('workflows.'))).toEqual(['workflows.findOne', 'workflows.findOne']);
      expect(view.source.status).toBe('disabled');
    });

    it('no audit row or log line carries a source workflow name, and the audit payload keys are unchanged', async () => {
      const created = await service.create(OWNER, body({ sourceWorkflowId: WF_OFF, enabled: false }));
      await service.update(OWNER, created.id, { enabled: true });
      await service.update(OWNER, created.id, { sourceWorkflowId: WF_C });
      await service.list(OWNER);
      for (const row of store.audit.rows) {
        expect(Object.keys(row.payload).sort()).toEqual(['firesOn', 'sourceWorkflowId', 'targetKind', 'triggerId', 'workflowId']);
      }
      const audit = JSON.stringify(store.audit.rows);
      const logText = logs.join('\n');
      for (const secret of [OFF_NAME, 'Billing review', MARKER, 'disabled', 'draft']) {
        expect(audit).not.toContain(secret);
        expect(logText).not.toContain(secret);
      }
    });
  });

  it('no audit row and no log line carries the task text or a workflow name, across create, change, list, history, delete and refusals', async () => {
    const created = await service.create(OWNER, body({ target: toWorkflow(WF_B) }));
    await service.update(OWNER, created.id, { task: `${MARKER} second`, timeZone: 'UTC', enabled: false });
    await service.update(OWNER, created.id, { enabled: true, sourceWorkflowId: WF_C, target: { kind: 'chief-of-staff' } });
    await service.list(OWNER);
    await service.history(OWNER, created.id);
    await service.remove(OWNER, created.id);
    await refusal(() => service.create(OWNER, body({ timeZone: 'Bad/Zone' })));
    await refusal(() => service.create(OWNER, body({ target: toWorkflow(WF_A) })));
    await refusal(() => service.create(OWNER, body({ sourceWorkflowId: OTHER_WORKFLOW })));
    await refusal(() => service.create(OWNER, body({ task: `${MARKER}${'x'.repeat(7000)}` })));
    await service.create(OWNER, body({ target: toWorkflow(WF_B) }));
    await refusal(() => service.create(OWNER, body({ sourceWorkflowId: WF_B, target: toWorkflow(WF_A) })));

    expect(store.audit.rows.map((row) => row.eventType)).toEqual([
      'chain_trigger_created',
      'chain_trigger_updated',
      'chain_trigger_updated',
      'chain_trigger_deleted',
      'chain_trigger_created',
    ]);
    for (const row of store.audit.rows) {
      expect(Object.keys(row.payload).sort()).toEqual(['firesOn', 'sourceWorkflowId', 'targetKind', 'triggerId', 'workflowId']);
      expect(row.category).toBe('trigger');
      expect(row.subjectType).toBe('agent_chain_trigger');
    }
    const audit = JSON.stringify(store.audit.rows);
    const logText = logs.join('\n');
    for (const secret of [MARKER, 'summarise', 'second', ...NAMES]) {
      expect(audit).not.toContain(secret);
      expect(logText).not.toContain(secret);
    }
    expect(logs.length).toBeGreaterThanOrEqual(5);
    expect(logs).toContain(
      `chain trigger created userId=${OWNER} triggerId=${created.id} targetKind=workflow sourceWorkflowId=${WF_A} workflowId=${WF_B} firesOn=completed`,
    );
    expect(logs).toContain(
      `chain trigger deleted userId=${OWNER} triggerId=${created.id} targetKind=chief-of-staff sourceWorkflowId=${WF_C} firesOn=completed`,
    );
  });

  describe('firesOn (TRIGGER-CHAIN-FAILED-01 S1)', () => {
    it('criterion 2: a create without firesOn stores completed; with failed stores failed; the answers carry it', async () => {
      const plain = await service.create(OWNER, body());
      const failed = await service.create(OWNER, body({ sourceWorkflowId: WF_B, firesOn: 'failed' }));
      const explicit = await service.create(OWNER, body({ sourceWorkflowId: WF_C, firesOn: 'completed' }));
      expect(store.triggers.rows.map((row) => row.firesOn)).toEqual(['completed', 'failed', 'completed']);
      expect([plain.firesOn, failed.firesOn, explicit.firesOn]).toEqual(['completed', 'failed', 'completed']);
      expect(failed).toMatchObject({ sourceWorkflowId: WF_B, enabled: true, lastRun: null });
      const listed = await service.list(OWNER);
      expect(listed.triggers.map((trigger) => trigger.firesOn)).toEqual(['completed', 'failed', 'completed']);
    });

    it('criterion 2: any other firesOn is 400 chain_trigger_invalid_fires_on; nothing read or written', async () => {
      for (const firesOn of ['cancelled', 'FAILED', '', null, 0, ['failed']]) {
        const { status, body: response } = await refusal(() => service.create(OWNER, body({ firesOn })));
        expect(status).toBe(400);
        expect(response.code).toBe('chain_trigger_invalid_fires_on');
      }
      expect(store.calls).toEqual([]);
    });

    it('criterion 3: a PATCH of firesOn alone works, re-arms, takes no lock and runs no cycle check', async () => {
      at('2026-11-16T00:00:00Z');
      const own = await service.create(OWNER, body({ target: toWorkflow(WF_B) }));
      const created = store.triggers.rows[0].armedAt.getTime();
      at('2026-11-16T04:00:00Z');
      store.calls.length = 0;
      store.queries.length = 0;
      const view = await service.update(OWNER, own.id, { firesOn: 'failed' });
      expect(view).toMatchObject({ id: own.id, firesOn: 'failed', sourceWorkflowId: WF_A, enabled: true });
      expect(store.queries).toEqual([]);
      expect(store.calls).not.toContain('triggers.find');
      expect(store.calls).not.toContain('manager.query');
      const row = store.triggers.rows[0];
      expect(row.firesOn).toBe('failed');
      expect(row.armedAt.getTime()).toBe(new Date('2026-11-16T04:00:00Z').getTime());
      expect(row.armedAt.getTime()).not.toBe(created);
      expect(row.updatedAt.getTime()).toBe(row.armedAt.getTime());
      // And back to completed: a change again, so it re-arms again.
      at('2026-11-16T05:00:00Z');
      await service.update(OWNER, own.id, { firesOn: 'completed' });
      expect(store.triggers.rows[0]).toMatchObject({ firesOn: 'completed' });
      expect(store.triggers.rows[0].armedAt.getTime()).toBe(new Date('2026-11-16T05:00:00Z').getTime());
    });

    it('criterion 3: a PATCH that sends the stored firesOn, or none, does not re-arm', async () => {
      at('2026-11-16T00:00:00Z');
      const own = await service.create(OWNER, body({ firesOn: 'failed' }));
      const armedAt = store.triggers.rows[0].armedAt.getTime();
      for (const patch of [{ firesOn: 'failed' }, { task: 'other' }, { timeZone: 'UTC' }, { firesOn: 'failed', task: 'again' }]) {
        at('2026-11-16T06:00:00Z');
        const view = await service.update(OWNER, own.id, patch);
        expect(view.firesOn).toBe('failed');
        expect(store.triggers.rows[0].armedAt.getTime()).toBe(armedAt);
        expect(store.triggers.rows[0].firesOn).toBe('failed');
      }
    });

    it('criterion 3: a PATCH of firesOn on a switched-off trigger re-arms and leaves it off', async () => {
      at('2026-11-16T00:00:00Z');
      const own = await service.create(OWNER, body({ enabled: false }));
      at('2026-11-16T02:00:00Z');
      const view = await service.update(OWNER, own.id, { firesOn: 'failed' });
      expect(view).toMatchObject({ enabled: false, firesOn: 'failed' });
      expect(store.triggers.rows[0].armedAt.getTime()).toBe(new Date('2026-11-16T02:00:00Z').getTime());
    });

    it("criterion 4: another owner's trigger answers 404 to a firesOn change and nothing changes", async () => {
      const theirs = await service.create(OTHER, body({ sourceWorkflowId: OTHER_WORKFLOW }));
      const before = snapshot();
      const { status, body: response } = await refusal(() => service.update(OWNER, theirs.id, { firesOn: 'failed' }));
      expect(status).toBe(404);
      expect(response.code).toBe(CHAIN_TRIGGER_ERROR_CODES.notFound);
      expect(snapshot()).toBe(before);
      expect(store.triggers.rows[0].firesOn).toBe('completed');
    });

    it('criterion 5: A fails to B, then B completes to A is refused as a cycle; so is the reverse and two failure edges', async () => {
      await service.create(OWNER, body({ target: toWorkflow(WF_B), firesOn: 'failed' }));
      for (const firesOn of [undefined, 'completed', 'failed']) {
        const { status, body: response } = await refusal(() =>
          service.create(OWNER, body({ sourceWorkflowId: WF_B, target: toWorkflow(WF_A), ...(firesOn ? { firesOn } : {}) })),
        );
        expect(status).toBe(409);
        expect(response.code).toBe(CHAIN_TRIGGER_ERROR_CODES.cycle);
      }
      expect(store.triggers.rows).toHaveLength(1);
      // A completes to B stored, B fails to A refused.
      store.triggers.rows.length = 0;
      await service.create(OWNER, body({ target: toWorkflow(WF_B) }));
      const { body: reverse } = await refusal(() =>
        service.create(OWNER, body({ sourceWorkflowId: WF_B, target: toWorkflow(WF_A), firesOn: 'failed' })),
      );
      expect(reverse.code).toBe(CHAIN_TRIGGER_ERROR_CODES.cycle);
    });

    it('criterion 5: a change that closes a cycle is refused whatever the outcomes; a firesOn change alone never does', async () => {
      await service.create(OWNER, body({ target: toWorkflow(WF_B), firesOn: 'failed' }));
      const second = await service.create(OWNER, body({ sourceWorkflowId: WF_B }));
      const before = snapshot();
      const { status, body: response } = await refusal(() =>
        service.update(OWNER, second.id, { target: toWorkflow(WF_A), firesOn: 'failed' }),
      );
      expect(status).toBe(409);
      expect(response.code).toBe(CHAIN_TRIGGER_ERROR_CODES.cycle);
      expect(snapshot()).toBe(before);
      const flipped = await service.update(OWNER, second.id, { firesOn: 'failed' });
      expect(flipped.firesOn).toBe('failed');
    });

    it('criterion 5: the cycle check reads every trigger with the same select, which holds no firesOn', async () => {
      await service.create(OWNER, body({ target: toWorkflow(WF_B), firesOn: 'failed' }));
      const source = readFileSync(join(__dirname, 'chain-trigger.service.ts'), 'utf8');
      const check = source.slice(source.indexOf('private async assertNoCycle'));
      expect(check.slice(0, check.indexOf('\n  }\n'))).toContain("select: ['id', 'sourceWorkflowId', 'targetKind', 'workflowId'],");
      expect(check.slice(0, check.indexOf('\n  }\n'))).not.toMatch(/firesOn/);
    });

    it('criterion 6: the limit of 3 counts both outcomes together', async () => {
      await service.create(OWNER, body({ firesOn: 'failed' }));
      await service.create(OWNER, body({ sourceWorkflowId: WF_B, firesOn: 'failed' }));
      await service.create(OWNER, body({ sourceWorkflowId: WF_C }));
      for (const firesOn of ['failed', 'completed']) {
        const { status, body: response } = await refusal(() => service.create(OWNER, body({ firesOn })));
        expect(status).toBe(409);
        expect(response.code).toBe(CHAIN_TRIGGER_ERROR_CODES.limitReached);
      }
      expect(store.triggers.rows).toHaveLength(3);
    });

    it('criterion 7: audit rows carry firesOn and no task text or workflow name; log lines carry no name either', async () => {
      const created = await service.create(OWNER, body({ target: toWorkflow(WF_B), firesOn: 'failed' }));
      await service.update(OWNER, created.id, { firesOn: 'completed', task: `${MARKER} changed` });
      await service.update(OWNER, created.id, { firesOn: 'failed' });
      await service.remove(OWNER, created.id);
      const firesOnOf = (row: AuditEventEntity) => (row.payload as Record<string, unknown>).firesOn;
      expect(store.audit.rows.map((row) => [row.eventType, firesOnOf(row)])).toEqual([
        ['chain_trigger_created', 'failed'],
        ['chain_trigger_updated', 'completed'],
        ['chain_trigger_updated', 'failed'],
        ['chain_trigger_deleted', 'failed'],
      ]);
      for (const row of store.audit.rows) {
        expect(row.payload).toEqual({
          triggerId: created.id,
          targetKind: 'workflow',
          sourceWorkflowId: WF_A,
          workflowId: WF_B,
          firesOn: firesOnOf(row),
        });
      }
      const audit = JSON.stringify(store.audit.rows);
      const logText = logs.join('\n');
      for (const secret of [MARKER, 'summarise', 'changed', ...NAMES]) {
        expect(audit).not.toContain(secret);
        expect(logText).not.toContain(secret);
      }
    });

    it('a stored row without firesOn (none in the table: NOT NULL, default completed) reads as completed', async () => {
      const row = triggerRow('t-old', OWNER, WF_A, null) as Partial<AgentChainTrigger>;
      delete row.firesOn;
      store.triggers.rows.push(row as AgentChainTrigger);
      expect((await service.list(OWNER)).triggers[0].firesOn).toBe('completed');
    });
  });

  it('the service reads no run, starts nothing and imports the result tool switch reader instead of reading it itself', () => {
    const source = readFileSync(join(__dirname, 'chain-trigger.service.ts'), 'utf8');
    expect(source).not.toMatch(
      /CollaborationRunEntity|CollaborationReferral|collaboration_runs|collaboration_referrals|pending_job|result_summary|CollaborationStartService|approveStep|setInterval|setTimeout|ConnectorBroker/,
    );
    expect(source).toContain("import { isRunResultToolEnabled } from '../orchestration/collaboration-result-grant';");
    expect(source.match(/isRunResultToolEnabled\(\)/g)).toHaveLength(1);
    expect(source).toMatch(/resultToolEnabled: isRunResultToolEnabled\(\),/);
    expect(source).not.toMatch(/process\.env/);
  });
});

function workflowRow(id: string, userId: string, name: string, status: string): UserAgent {
  return { id, userId, name, status, deletedAt: null } as UserAgent;
}

function triggerRow(id: string, userId: string, source: string, target: string | null): AgentChainTrigger {
  const now = new Date('2026-11-01T00:00:00Z');
  return {
    id,
    userId,
    sourceWorkflowId: source,
    targetKind: target === null ? 'chief-of-staff' : 'workflow',
    workflowId: target,
    task: 'their task',
    timeZone: 'UTC',
    enabled: true,
    firesOn: 'completed',
    armedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function runRow(
  id: string,
  triggerId: string,
  userId: string,
  localDate: string,
  outcome: AgentChainTriggerRun['outcome'],
  reason: string | null = null,
): AgentChainTriggerRun {
  return {
    id,
    triggerId,
    userId,
    sourceRunId: `collab_source-${id}`,
    sourceCompletedAt: new Date(`${localDate}T05:57:00Z`),
    localDate,
    depth: 1,
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

/* ---------- In-memory TypeORM stand-in (the knowledge trigger service spec's store). ---------- */

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
    if (target === AgentChainTrigger) return this.store.triggers as MemoryRepository<object>;
    if (target === AgentChainTriggerRun) return this.store.runs as MemoryRepository<object>;
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
  triggers = new MemoryRepository<AgentChainTrigger>('triggers', this.calls);
  runs = new MemoryRepository<AgentChainTriggerRun>('runs', this.calls, [['triggerId', 'sourceRunId']]);
  workflows = new MemoryRepository<UserAgent>('workflows', this.calls);
  audit = new MemoryRepository<AuditEventEntity>('audit', this.calls);
  manager = new MemoryManager(this);

  constructor() {
    for (const repository of [this.triggers, this.runs, this.workflows, this.audit]) {
      repository.manager = this.manager;
    }
  }
}
