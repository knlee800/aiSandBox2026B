import { HttpException, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { FindOperator } from 'typeorm';
import { AgentMailTrigger } from '../entities/agent-mail-trigger.entity';
import { AgentMailTriggerRun } from '../entities/agent-mail-trigger-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import { UserAgent } from '../entities/user-agent.entity';
import { CONNECTOR_KINDS } from '../connectors/connector-rules';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { EVENT_TRIGGER_LIMIT_LOCK_NAMESPACE } from './event-trigger.service';
import {
  MAIL_TRIGGER_AUDIT_CATEGORY,
  MAIL_TRIGGER_AUDIT_SUBJECT_TYPE,
  MAIL_TRIGGER_HISTORY_LIMIT,
  MAIL_TRIGGER_LIMIT_LOCK_NAMESPACE,
  MAIL_TRIGGER_MAIL_CONNECTOR_KIND,
  MailTriggerService,
} from './mail-trigger.service';
import { MAIL_TRIGGER_ERROR_CODES } from './mail-trigger-validation';
import { SCHEDULE_LIMIT_LOCK_NAMESPACE } from './schedule.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const OWN_WORKFLOW = '33333333-3333-4333-8333-333333333333';
const OTHER_WORKFLOW = '44444444-4444-4444-8444-444444444444';
const DELETED_WORKFLOW = '55555555-5555-4555-8555-555555555555';
const UNKNOWN_ID = '66666666-6666-4666-8666-666666666666';
const MARKER = 'MARKER-TASK-a61f';
const SENDER_MARKER = 'marker-sender-0b9e';
const SUBJECT_MARKER = 'MARKER-SUBJECT-3d4c';

function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    target: { kind: 'chief-of-staff' },
    task: `${MARKER} summarise the new mail`,
    senderFilter: `${SENDER_MARKER}@example.com`,
    subjectFilter: `${SUBJECT_MARKER} invoice`,
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

describe('MailTriggerService (TRIGGER-MAIL-01 S2)', () => {
  const originalFlag = process.env.MAIL_TRIGGERS_ENABLED;
  let store: MemoryStore;
  let service: MailTriggerService;
  let logs: string[];
  let restoreLogs: () => void;

  beforeEach(() => {
    delete process.env.MAIL_TRIGGERS_ENABLED;
    store = new MemoryStore();
    store.workflows.rows.push(
      workflowRow(OWN_WORKFLOW, OWNER, 'Mail desk', 'active'),
      workflowRow(OTHER_WORKFLOW, OTHER, 'Not yours', 'active'),
      { ...workflowRow(DELETED_WORKFLOW, OWNER, 'Deleted', 'active'), deletedAt: new Date('2026-11-01T00:00:00Z') },
    );
    service = new MailTriggerService(
      store.triggers as never,
      store.runs as never,
      store.workflows as never,
      store.connections as never,
    );
    logs = [];
    restoreLogs = watchLogs(logs);
  });

  afterEach(() => {
    restoreLogs();
    jest.useRealTimers();
    if (originalFlag === undefined) delete process.env.MAIL_TRIGGERS_ENABLED;
    else process.env.MAIL_TRIGGERS_ENABLED = originalFlag;
  });

  function at(iso: string): void {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(new Date(iso));
  }

  function writes(): string[] {
    return store.calls.filter((call) => /\.(insert|update|delete)$/.test(call));
  }

  describe('create', () => {
    it('stores the trigger, arms it at create, and answers the section 8 view', async () => {
      const view = await service.create(OWNER, body());
      expect(store.triggers.rows).toHaveLength(1);
      const row = store.triggers.rows[0];
      expect(row).toMatchObject({
        id: view.id,
        userId: OWNER,
        targetKind: 'chief-of-staff',
        workflowId: null,
        task: `${MARKER} summarise the new mail`,
        senderFilter: `${SENDER_MARKER}@example.com`,
        subjectFilter: `${SUBJECT_MARKER} invoice`,
        timeZone: 'Asia/Taipei',
        enabled: true,
        mailState: 'ok',
        mailStateAt: null,
      });
      expect(row.armedAt.getTime()).toBe(row.createdAt.getTime());
      expect(view).toEqual({
        id: row.id,
        target: { kind: 'chief-of-staff' },
        task: `${MARKER} summarise the new mail`,
        senderFilter: `${SENDER_MARKER}@example.com`,
        subjectFilter: `${SUBJECT_MARKER} invoice`,
        timeZone: 'Asia/Taipei',
        enabled: true,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        lastRun: null,
      });
      expect(view.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('the subject defaults to null and the sender is stored in lower case', async () => {
      const view = await service.create(OWNER, {
        target: { kind: 'chief-of-staff' },
        task: 't',
        senderFilter: ' @Example.COM ',
        timeZone: 'UTC',
      });
      expect(view).toMatchObject({ senderFilter: '@example.com', subjectFilter: null, enabled: true });
      expect(store.triggers.rows[0]).toMatchObject({ senderFilter: '@example.com', subjectFilter: null });
    });

    it('writes one mail_trigger_created audit row with ids and the target kind only', async () => {
      const view = await service.create(OWNER, body({ target: { kind: 'workflow', workflowId: OWN_WORKFLOW } }));
      expect(store.audit.rows).toHaveLength(1);
      expect(store.audit.rows[0]).toMatchObject({
        category: MAIL_TRIGGER_AUDIT_CATEGORY,
        eventType: 'mail_trigger_created',
        subjectType: MAIL_TRIGGER_AUDIT_SUBJECT_TYPE,
        subjectId: view.id,
        userId: OWNER,
        payload: { triggerId: view.id, targetKind: 'workflow', workflowId: OWN_WORKFLOW },
      });
      expect(Object.keys(store.audit.rows[0].payload).sort()).toEqual(['targetKind', 'triggerId', 'workflowId']);
      expect(MAIL_TRIGGER_AUDIT_CATEGORY).toBe('trigger');
      expect(MAIL_TRIGGER_AUDIT_SUBJECT_TYPE).toBe('agent_mail_trigger');
    });

    it("a trigger for the owner's own workflow carries its name and status", async () => {
      const view = await service.create(OWNER, body({ target: { kind: 'workflow', workflowId: OWN_WORKFLOW } }));
      expect(view.target).toEqual({ kind: 'workflow', workflowId: OWN_WORKFLOW, name: 'Mail desk', status: 'active' });
      expect(store.triggers.rows[0]).toMatchObject({ targetKind: 'workflow', workflowId: OWN_WORKFLOW });
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
      expect(response.code).toBe(MAIL_TRIGGER_ERROR_CODES.workflowNotFound);
      expect(writes()).toEqual([]);
      expect(store.triggers.rows).toHaveLength(0);
      expect(store.audit.rows).toHaveLength(0);
    });

    it('the fourth trigger is refused with 409 mail_trigger_limit_reached; switched-off ones count', async () => {
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
        message: 'At most 3 mail triggers per account',
        error: 'Conflict',
        code: MAIL_TRIGGER_ERROR_CODES.limitReached,
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

    it('takes the per-owner transaction lock (its own namespace) before counting', async () => {
      await service.create(OWNER, body());
      expect(store.queries).toEqual([
        { sql: 'SELECT pg_advisory_xact_lock($1, hashtext($2))', params: [MAIL_TRIGGER_LIMIT_LOCK_NAMESPACE, OWNER] },
      ]);
      expect(MAIL_TRIGGER_LIMIT_LOCK_NAMESPACE).toBe(1812);
      expect(MAIL_TRIGGER_LIMIT_LOCK_NAMESPACE).not.toBe(SCHEDULE_LIMIT_LOCK_NAMESPACE);
      expect(MAIL_TRIGGER_LIMIT_LOCK_NAMESPACE).not.toBe(EVENT_TRIGGER_LIMIT_LOCK_NAMESPACE);
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
      await refusal(() => service.create(OWNER, body({ senderFilter: 'example.com' })));
      await refusal(() => service.create(OWNER, body({ senderFilter: null })));
      await refusal(() => service.create(OWNER, body({ subjectFilter: 's'.repeat(101) })));
      await refusal(() => service.create(OWNER, body({ task: 'a'.repeat(7501) })));
      await refusal(() => service.create(OWNER, body({ leadMinutes: 15 })));
      expect(store.calls).toEqual([]);
    });
  });

  describe('owner scoping on change, delete and history', () => {
    let ownId: string;
    let otherId: string;

    beforeEach(async () => {
      ownId = (await service.create(OWNER, body())).id;
      otherId = (
        await service.create(OTHER, body({ task: 'other task', senderFilter: 'theirs@example.org', subjectFilter: 'theirs' }))
      ).id;
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
          message: 'Mail trigger not found',
          error: 'Not Found',
          code: MAIL_TRIGGER_ERROR_CODES.notFound,
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
      expect(response.code).toBe(MAIL_TRIGGER_ERROR_CODES.workflowNotFound);
      expect(writes()).toEqual([]);
      expect(snapshot()).toBe(before);
    });

    it("the owner's own changes work and touch only the owner's row", async () => {
      const view = await service.update(OWNER, ownId, {
        target: { kind: 'workflow', workflowId: OWN_WORKFLOW },
        task: ' new task ',
        senderFilter: '@Partner.example',
        subjectFilter: null,
        enabled: false,
      });
      expect(view).toMatchObject({
        id: ownId,
        target: { kind: 'workflow', workflowId: OWN_WORKFLOW, name: 'Mail desk', status: 'active' },
        task: 'new task',
        senderFilter: '@partner.example',
        subjectFilter: null,
        enabled: false,
      });
      const other = store.triggers.rows.find((row) => row.id === otherId)!;
      expect(other).toMatchObject({
        task: 'other task',
        senderFilter: 'theirs@example.org',
        subjectFilter: 'theirs',
        enabled: true,
      });
      const back = await service.update(OWNER, ownId, { target: { kind: 'chief-of-staff' } });
      expect(back.target).toEqual({ kind: 'chief-of-staff' });
      expect(store.triggers.rows.find((row) => row.id === ownId)!.workflowId).toBeNull();
    });

    it('a change never touches the mailbox state (slice S3 owns it)', async () => {
      const row = store.triggers.rows.find((entry) => entry.id === ownId)!;
      row.mailState = 'read_failed';
      row.mailStateAt = new Date('2026-11-15T01:00:00Z');
      await service.update(OWNER, ownId, { senderFilter: 'new@example.com', enabled: false });
      expect(store.triggers.rows.find((entry) => entry.id === ownId)).toMatchObject({
        mailState: 'read_failed',
        mailStateAt: new Date('2026-11-15T01:00:00Z'),
      });
    });

    it('delete removes the trigger and its history rows only, with one mail_trigger_deleted audit row', async () => {
      store.runs.rows.push(
        runRow('r1', ownId, OWNER, '2026-11-13', 'started'),
        runRow('r2', ownId, OWNER, '2026-11-14', 'skipped', 'day_limit'),
      );
      const result = await service.remove(OWNER, ownId);
      expect(result).toEqual({ id: ownId, deleted: true });
      expect(store.triggers.rows.map((row) => row.id)).toEqual([otherId]);
      expect(store.runs.rows.map((row) => row.id)).toEqual(['r-other']);
      const audit = store.audit.rows.filter((row) => row.eventType === 'mail_trigger_deleted');
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        subjectId: ownId,
        subjectType: 'agent_mail_trigger',
        userId: OWNER,
        payload: { triggerId: ownId, targetKind: 'chief-of-staff', workflowId: null },
      });
      expect((await refusal(() => service.history(OWNER, ownId))).status).toBe(404);
    });

    it('history answers the last 30 rows, newest first, ids, times and codes only', async () => {
      for (let i = 0; i < 35; i += 1) {
        const day = new Date(Date.UTC(2026, 9, 1 + i));
        const run = runRow(`r${i}`, ownId, OWNER, day.toISOString().slice(0, 10), i % 2 ? 'started' : 'skipped', i % 2 ? null : 'day_limit');
        run.createdAt = day;
        run.arrivedAt = new Date(day.getTime() - 3 * 60_000);
        run.collaborationRunId = i % 2 ? `run-${i}` : null;
        store.runs.rows.push(run);
      }
      const { runs } = await service.history(OWNER, ownId);
      expect(runs).toHaveLength(MAIL_TRIGGER_HISTORY_LIMIT);
      expect(MAIL_TRIGGER_HISTORY_LIMIT).toBe(30);
      expect(runs[0]).toEqual({
        id: 'r34',
        arrivedAt: new Date(Date.UTC(2026, 9, 35) - 3 * 60_000).toISOString(),
        localDate: '2026-11-04',
        outcome: 'skipped',
        reason: 'day_limit',
        collaborationRunId: null,
        at: new Date(Date.UTC(2026, 9, 35)).toISOString(),
      });
      expect(runs[1]).toMatchObject({ id: 'r33', outcome: 'started', reason: null, collaborationRunId: 'run-33' });
      expect(runs.map((run) => run.id)).not.toContain('r-other');
      expect(runs[29].id).toBe('r5');
      // The message key (a hash) is never answered.
      expect(JSON.stringify(runs)).not.toContain('message');
      expect(JSON.stringify(runs)).not.toContain('a'.repeat(64));
    });
  });

  describe('armed_at (stage-start section 2)', () => {
    let id: string;
    let armedAt: number;

    beforeEach(async () => {
      at('2026-11-15T00:00:00Z');
      id = (await service.create(OWNER, body({ senderFilter: 'boss@example.com', subjectFilter: 'Invoice' }))).id;
      armedAt = store.triggers.rows[0].armedAt.getTime();
      at('2026-11-15T03:00:00Z');
    });

    const later = new Date('2026-11-15T03:00:00Z').getTime();

    function current(): AgentMailTrigger {
      return store.triggers.rows.find((row) => row.id === id)!;
    }

    it('create arms at the create time', () => {
      expect(armedAt).toBe(new Date('2026-11-15T00:00:00Z').getTime());
      expect(current().createdAt.getTime()).toBe(armedAt);
    });

    it.each([
      ['the sender', { senderFilter: 'other@example.com' }],
      ['the sender to a domain', { senderFilter: '@example.com' }],
      ['the subject', { subjectFilter: 'Receipt' }],
      ['the subject to none', { subjectFilter: null }],
      ['the subject to empty (none)', { subjectFilter: '  ' }],
      ['the subject case', { subjectFilter: 'invoice' }],
      ['the zone', { timeZone: 'Europe/London' }],
    ])('changing %s re-arms', async (_label, patch) => {
      await service.update(OWNER, id, patch);
      expect(current().armedAt.getTime()).toBe(later);
      expect(current().updatedAt.getTime()).toBe(later);
    });

    it('setting a subject where there was none re-arms', async () => {
      await service.update(OWNER, id, { subjectFilter: null });
      at('2026-11-15T04:00:00Z');
      await service.update(OWNER, id, { subjectFilter: 'Invoice' });
      expect(current().armedAt.getTime()).toBe(new Date('2026-11-15T04:00:00Z').getTime());
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
      ['the same sender in another case', { senderFilter: ' BOSS@Example.com ' }],
      ['the same sender, subject and zone', { senderFilter: 'boss@example.com', subjectFilter: ' Invoice ', timeZone: 'Asia/Taipei' }],
      ['enabled true while already on', { enabled: true }],
    ])('changing %s does not re-arm', async (_label, patch) => {
      await service.update(OWNER, id, patch);
      expect(current().armedAt.getTime()).toBe(armedAt);
      expect(current().updatedAt.getTime()).toBe(later);
    });

    it('a refused change does not re-arm', async () => {
      await refusal(() => service.update(OWNER, id, { senderFilter: 'not an address', enabled: true }));
      expect(current().armedAt.getTime()).toBe(armedAt);
    });

    it('every change writes one mail_trigger_updated audit row without the task, the sender or the subject', async () => {
      await service.update(OWNER, id, {
        task: `${MARKER} changed`,
        senderFilter: `${SENDER_MARKER}@example.net`,
        subjectFilter: `${SUBJECT_MARKER} new`,
      });
      const updated = store.audit.rows.filter((row) => row.eventType === 'mail_trigger_updated');
      expect(updated).toHaveLength(1);
      expect(updated[0].payload).toEqual({ triggerId: id, targetKind: 'chief-of-staff', workflowId: null });
    });
  });

  describe('list', () => {
    it('reports MAIL_TRIGGERS_ENABLED and GLOBAL_EXECUTION_ENABLED live, the limit and the mailbox', async () => {
      const runs = jest.spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get');
      const originalEvents = process.env.EVENT_TRIGGERS_ENABLED;
      try {
        runs.mockReturnValue(false);
        expect(await service.list(OWNER)).toEqual({
          enabled: false,
          runsEnabled: false,
          limit: 3,
          mail: { connected: false, state: 'ok', stateAt: null },
          triggers: [],
        });
        process.env.MAIL_TRIGGERS_ENABLED = 'true';
        runs.mockReturnValue(true);
        expect(await service.list(OWNER)).toMatchObject({ enabled: true, runsEnabled: true });
        process.env.MAIL_TRIGGERS_ENABLED = 'TRUE';
        expect((await service.list(OWNER)).enabled).toBe(false);
        process.env.EVENT_TRIGGERS_ENABLED = 'true';
        process.env.SCHEDULES_ENABLED = 'true';
        delete process.env.MAIL_TRIGGERS_ENABLED;
        expect((await service.list(OWNER)).enabled).toBe(false);
      } finally {
        runs.mockRestore();
        delete process.env.SCHEDULES_ENABLED;
        if (originalEvents === undefined) delete process.env.EVENT_TRIGGERS_ENABLED;
        else process.env.EVENT_TRIGGERS_ENABLED = originalEvents;
      }
    });

    it("mail.connected is true only for the owner's own imap connection, by a count (no secret read)", async () => {
      expect(MAIL_TRIGGER_MAIL_CONNECTOR_KIND).toBe('imap');
      expect(CONNECTOR_KINDS).toContain(MAIL_TRIGGER_MAIL_CONNECTOR_KIND);
      store.connections.rows.push(connectionRow(OWNER, 'ical'), connectionRow(OTHER, 'imap'));
      expect((await service.list(OWNER)).mail.connected).toBe(false);
      store.connections.rows.push(connectionRow(OWNER, 'imap'));
      expect((await service.list(OWNER)).mail.connected).toBe(true);
      const connectionCalls = store.calls.filter((call) => call.startsWith('connections.'));
      expect(new Set(connectionCalls)).toEqual(new Set(['connections.count']));
      const source = readFileSync(join(__dirname, 'mail-trigger.service.ts'), 'utf8');
      expect(source).not.toMatch(
        /secretCiphertext|secret_ciphertext|decrypt|ConnectorBroker|callConnectorTool|readRecentMail|readCalendarWindow/,
      );
    });

    it("mail.state is the newest recorded state among the owner's triggers", async () => {
      const first = await service.create(OWNER, body({ task: 'first' }));
      const second = await service.create(OWNER, body({ task: 'second' }));
      const other = await service.create(OTHER, body({ task: 'other' }));
      const rowOf = (id: string) => store.triggers.rows.find((row) => row.id === id)!;
      expect((await service.list(OWNER)).mail).toEqual({ connected: false, state: 'ok', stateAt: null });

      rowOf(first.id).mailState = 'read_failed';
      rowOf(first.id).mailStateAt = new Date('2026-11-15T01:00:00Z');
      rowOf(second.id).mailState = 'connector_missing';
      rowOf(second.id).mailStateAt = new Date('2026-11-15T02:00:00Z');
      rowOf(other.id).mailState = 'ok';
      rowOf(other.id).mailStateAt = new Date('2026-11-15T09:00:00Z');
      expect((await service.list(OWNER)).mail).toEqual({
        connected: false,
        state: 'connector_missing',
        stateAt: '2026-11-15T02:00:00.000Z',
      });

      rowOf(first.id).mailState = 'ok';
      rowOf(first.id).mailStateAt = new Date('2026-11-15T03:00:00Z');
      expect((await service.list(OWNER)).mail).toEqual({
        connected: false,
        state: 'ok',
        stateAt: '2026-11-15T03:00:00.000Z',
      });
    });

    it("lists only the owner's triggers, oldest first, with the newest history row as lastRun", async () => {
      at('2026-11-10T00:00:00Z');
      const first = await service.create(OWNER, body({ task: 'first' }));
      at('2026-11-11T00:00:00Z');
      const second = await service.create(OWNER, body({ task: 'second', target: { kind: 'workflow', workflowId: OWN_WORKFLOW } }));
      await service.create(OTHER, body({ task: 'other' }));
      const older = runRow('r1', first.id, OWNER, '2026-11-12', 'skipped', 'runs_off');
      older.createdAt = new Date('2026-11-12T00:00:00Z');
      const newer = runRow('r2', first.id, OWNER, '2026-11-13', 'started');
      newer.createdAt = new Date('2026-11-13T00:00:00Z');
      newer.arrivedAt = new Date('2026-11-12T23:55:00Z');
      newer.collaborationRunId = 'run-abc';
      store.runs.rows.push(older, newer);

      const view = await service.list(OWNER);
      expect(view.triggers.map((trigger) => trigger.task)).toEqual(['first', 'second']);
      expect(view.triggers[0].lastRun).toEqual({
        arrivedAt: '2026-11-12T23:55:00.000Z',
        localDate: '2026-11-13',
        outcome: 'started',
        reason: null,
        collaborationRunId: 'run-abc',
        at: '2026-11-13T00:00:00.000Z',
      });
      expect(view.triggers[1].id).toBe(second.id);
      expect(view.triggers[1].lastRun).toBeNull();
      expect(view.triggers[1].target).toEqual({
        kind: 'workflow',
        workflowId: OWN_WORKFLOW,
        name: 'Mail desk',
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

  it('no audit row and no log line carries the task, the sender or the subject text, across create, change, list, history and delete', async () => {
    const created = await service.create(OWNER, body());
    await service.update(OWNER, created.id, {
      task: `${MARKER} second`,
      senderFilter: `@${SENDER_MARKER}.example`,
      subjectFilter: `${SUBJECT_MARKER} second`,
      enabled: false,
    });
    await service.update(OWNER, created.id, { enabled: true, target: { kind: 'workflow', workflowId: OWN_WORKFLOW } });
    await service.list(OWNER);
    await service.history(OWNER, created.id);
    await service.remove(OWNER, created.id);
    await refusal(() => service.create(OWNER, body({ timeZone: 'Bad/Zone' })));
    await refusal(() => service.create(OWNER, body({ senderFilter: `${SENDER_MARKER} <x@example.com>` })));
    await refusal(() => service.create(OWNER, body({ subjectFilter: `${SUBJECT_MARKER}${'x'.repeat(100)}` })));

    expect(store.audit.rows.map((row) => row.eventType)).toEqual([
      'mail_trigger_created',
      'mail_trigger_updated',
      'mail_trigger_updated',
      'mail_trigger_deleted',
    ]);
    for (const row of store.audit.rows) {
      expect(Object.keys(row.payload).sort()).toEqual(['targetKind', 'triggerId', 'workflowId']);
      expect(row.category).toBe('trigger');
      expect(row.subjectType).toBe('agent_mail_trigger');
    }
    const audit = JSON.stringify(store.audit.rows);
    for (const secret of [MARKER, SENDER_MARKER, SUBJECT_MARKER, 'summarise', 'invoice', '@example', 'x@example.com']) {
      expect(audit).not.toContain(secret);
      expect(logs.join('\n')).not.toContain(secret);
    }
    expect(logs.length).toBeGreaterThanOrEqual(4);
    expect(logs).toContain(`mail trigger created userId=${OWNER} triggerId=${created.id} targetKind=chief-of-staff`);
  });
});

function workflowRow(id: string, userId: string, name: string, status: string): UserAgent {
  return { id, userId, name, status, deletedAt: null } as UserAgent;
}

function connectionRow(userId: string, kind: string): ConnectorConnection {
  return { id: `${userId}-${kind}`, userId, kind, secretCiphertext: 'never-read' } as ConnectorConnection;
}

function runRow(
  id: string,
  triggerId: string,
  userId: string,
  localDate: string,
  outcome: AgentMailTriggerRun['outcome'],
  reason: string | null = null,
): AgentMailTriggerRun {
  return {
    id,
    triggerId,
    userId,
    messageKey: 'a'.repeat(64),
    arrivedAt: new Date(`${localDate}T05:57:00Z`),
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

/* ---------- In-memory TypeORM stand-in (the event trigger service spec's store, with connections and a lock). ---------- */

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
    if (target === AgentMailTrigger) return this.store.triggers as MemoryRepository<object>;
    if (target === AgentMailTriggerRun) return this.store.runs as MemoryRepository<object>;
    if (target === UserAgent) return this.store.workflows as MemoryRepository<object>;
    if (target === AuditEventEntity) return this.store.audit as MemoryRepository<object>;
    if (target === ConnectorConnection) return this.store.connections as MemoryRepository<object>;
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
  triggers = new MemoryRepository<AgentMailTrigger>('triggers', this.calls);
  runs = new MemoryRepository<AgentMailTriggerRun>('runs', this.calls, [['triggerId', 'messageKey']]);
  workflows = new MemoryRepository<UserAgent>('workflows', this.calls);
  audit = new MemoryRepository<AuditEventEntity>('audit', this.calls);
  connections = new MemoryRepository<ConnectorConnection>('connections', this.calls);
  manager = new MemoryManager(this);

  constructor() {
    for (const repository of [this.triggers, this.runs, this.workflows, this.audit, this.connections]) {
      repository.manager = this.manager;
    }
  }
}
