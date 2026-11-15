import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  INestApplication,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { FindOperator } from 'typeorm';
import { AbortConfig } from '../abort/abort.config';
import { AbortGuard } from '../abort/abort.guard';
import { ExecutionResultService } from '../ai/execution-result.service';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { CreditBalanceGuard } from '../billing/credit-balance.guard';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { ConversationService } from '../conversations/conversation.service';
import { AgentSchedule } from '../entities/agent-schedule.entity';
import { AgentScheduleRun } from '../entities/agent-schedule-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { UserRole } from '../entities/user-role.enum';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { CollaborationBusinessSessionService } from '../orchestration/collaboration-business-session';
import { CollaborationReferralEntity } from '../orchestration/collaboration-referral.entity';
import { CollaborationRunEntity } from '../orchestration/collaboration-run.entity';
import { CollaborationStartService } from '../orchestration/collaboration-start.service';
import {
  CollaborationWorkflowService,
  workflowRefusal,
  WORKFLOW_REFUSAL_CODES,
} from '../orchestration/collaboration-workflow';
import { CollaborationController } from '../orchestration/collaboration.controller';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { QueueService } from '../queue/queue.service';
import { TokenQuotaGuard } from '../quota/token-quota.guard';
import { DailyCreditCapService } from '../safety/daily-credit-cap.service';
import { ExecutionSafetyGuard } from '../safety/execution-safety.guard';
import { GlobalSafetyLimitService } from '../safety/global-safety-limit.service';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { SessionService } from '../sessions/session.service';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';
import { SCHEDULE_RUN_LIMITS, ScheduleRunService } from './schedule-run.service';
import { ScheduleTimer } from './schedule-timer';

/**
 * TRIGGER-01 S2 (stage-start sections 3, 4, 5 and 11): the claim, the
 * pre-checks, the start and first approval, the skips with their rows and
 * audit rows, interrupted claims and the prune.
 */

const OWNER = '11111111-1111-4111-8111-111111111111';
const WORKFLOW = '33333333-3333-4333-8333-333333333333';
const OTHER = '77777777-7777-4777-8777-777777777777';
const MARKER = 'MARKER-schedule-task-text-do-not-log';
const TASK = `${MARKER} plan my day`;
/** Monday 2026-11-16 07:05 in Asia/Singapore (UTC+8). */
const NOW = new Date('2026-11-15T23:05:00Z');
const LOCAL_DATE = '2026-11-16';
const MINUTE = 60 * 1000;
const SESSION_IDENTITY = {
  userId: OWNER,
  apiKeyId: 'browser-session',
  scopes: ['ai:execute'],
  isInternal: true,
  harnessEntitled: true,
};

let scheduleCounter = 0;

function scheduleRow(overrides: Partial<AgentSchedule> = {}): AgentSchedule {
  scheduleCounter += 1;
  return {
    id: `aaaaaaaa-0000-4000-8000-${String(scheduleCounter).padStart(12, '0')}`,
    userId: OWNER,
    targetKind: 'chief-of-staff',
    workflowId: null,
    task: TASK,
    timeOfDay: 7 * 60,
    days: 127,
    timeZone: 'Asia/Singapore',
    enabled: true,
    armedAt: new Date('2026-11-01T00:00:00Z'),
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-01T00:00:00Z'),
    ...overrides,
  };
}

function workflowSchedule(overrides: Partial<AgentSchedule> = {}): AgentSchedule {
  return scheduleRow({ targetKind: 'workflow', workflowId: WORKFLOW, ...overrides });
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
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

/** The real page parser (CollaborationStartService.readStartBody), without the rest of the service. */
const pageParser = new CollaborationStartService({} as never, {} as never, {} as never);

describe('ScheduleRunService (TRIGGER-01 S2)', () => {
  const originalGlobal = process.env.GLOBAL_EXECUTION_ENABLED;
  const originalSchedules = process.env.SCHEDULES_ENABLED;
  let store: MemoryStore;
  let entitled: Set<string>;
  let entitlements: { resolveHarnessEntitled: jest.Mock };
  let caps: { assertWithinDailyCap: jest.Mock };
  let starts: { readStartBody: jest.Mock; start: jest.Mock; approveStep: jest.Mock };
  let orchestration: { cancelCollaboration: jest.Mock };
  let service: ScheduleRunService;
  let logs: string[];
  let restoreLogs: () => void;
  let runCounter: number;

  function newService(): ScheduleRunService {
    return new ScheduleRunService(
      store.schedules as never,
      store.runs as never,
      store.workflows as never,
      store.users as never,
      store.audit as never,
      starts as never,
      orchestration as never,
      entitlements as never,
      caps as never,
    );
  }

  beforeEach(() => {
    process.env.GLOBAL_EXECUTION_ENABLED = 'true';
    process.env.SCHEDULES_ENABLED = 'true';
    store = new MemoryStore();
    store.users.rows.push({ id: OWNER, isActive: true });
    store.workflows.rows.push(
      { id: WORKFLOW, userId: OWNER, name: 'Morning briefing', status: 'active', deletedAt: null },
      { id: OTHER, userId: OTHER, name: 'Not yours', status: 'active', deletedAt: null },
    );
    entitled = new Set([OWNER]);
    entitlements = { resolveHarnessEntitled: jest.fn(async (id: string) => entitled.has(id)) };
    caps = { assertWithinDailyCap: jest.fn(async () => undefined) };
    runCounter = 0;
    starts = {
      readStartBody: jest.fn((body: unknown) => pageParser.readStartBody(body)),
      start: jest.fn(async () => {
        runCounter += 1;
        return { collaborationRunId: `collab-run-${runCounter}`, referralId: `ref-${runCounter}` };
      }),
      approveStep: jest.fn(async () => ({ referral: { referralId: 'ref' }, executionId: 'x' })),
    };
    orchestration = { cancelCollaboration: jest.fn(async () => ({ status: 'cancelled' })) };
    service = newService();
    logs = [];
    restoreLogs = watchLogs(logs);
  });

  afterEach(() => {
    restoreLogs();
    jest.restoreAllMocks();
    // Stage-start section 9: the task text is never in a log line, an audit row or a history row.
    expect(logs.join('\n')).not.toContain(MARKER);
    expect(JSON.stringify(store.audit.rows)).not.toContain(MARKER);
    expect(JSON.stringify(store.runs.rows)).not.toContain(MARKER);
    restoreEnv('GLOBAL_EXECUTION_ENABLED', originalGlobal);
    restoreEnv('SCHEDULES_ENABLED', originalSchedules);
  });

  function auditOf(eventType?: string): AuditEventEntity[] {
    return store.audit.rows.filter((row) => eventType === undefined || row.eventType === eventType) as AuditEventEntity[];
  }

  describe('a due schedule starts as the owner (acceptance 7)', () => {
    it('Chief of Staff: the page body without sessionId or testRun, the session guard identity, the first step approved by the owner', async () => {
      const schedule = scheduleRow();
      store.schedules.rows.push(schedule);

      const summary = await service.tick(NOW);
      expect(summary).toMatchObject({ evaluated: 1, started: 1, skipped: 0 });

      expect(starts.readStartBody).toHaveBeenCalledTimes(1);
      const body = starts.readStartBody.mock.calls[0][0] as Record<string, unknown>;
      expect(body).toEqual({ team: 'chief-of-staff', task: TASK });
      expect(body).not.toHaveProperty('sessionId');
      expect(body).not.toHaveProperty('testRun');
      expect(starts.start).toHaveBeenCalledWith(SESSION_IDENTITY, { task: TASK, teamId: 'chief-of-staff' });
      expect(starts.start.mock.calls[0][1]).not.toHaveProperty('sessionId');
      expect(starts.approveStep).toHaveBeenCalledWith({
        collaborationRunId: 'collab-run-1',
        referralId: 'ref-1',
        decidedBy: OWNER,
        approveWithoutPassingTests: false,
      });
      // The order of stage-start section 4: claim, pre-checks, start, approve.
      expect(store.calls.indexOf('runs.insert')).toBeLessThan(store.calls.indexOf('users.findOne'));
      expect(entitlements.resolveHarnessEntitled.mock.invocationCallOrder[0]).toBeLessThan(
        starts.start.mock.invocationCallOrder[0],
      );
      expect(caps.assertWithinDailyCap).toHaveBeenCalledWith(OWNER);
      expect(starts.start.mock.invocationCallOrder[0]).toBeLessThan(starts.approveStep.mock.invocationCallOrder[0]);
      expect(orchestration.cancelCollaboration).not.toHaveBeenCalled();

      expect(store.runs.rows).toEqual([
        {
          id: expect.any(String),
          scheduleId: schedule.id,
          userId: OWNER,
          localDate: LOCAL_DATE,
          outcome: 'started',
          reason: null,
          collaborationRunId: 'collab-run-1',
          createdAt: NOW,
        },
      ]);
      expect(auditOf()).toEqual([
        {
          category: 'trigger',
          eventType: 'run_started',
          subjectType: 'agent_schedule',
          subjectId: schedule.id,
          userId: OWNER,
          payload: {
            scheduleId: schedule.id,
            localDate: LOCAL_DATE,
            targetKind: 'chief-of-staff',
            workflowId: null,
            collaborationRunId: 'collab-run-1',
          },
          occurredAt: expect.any(Date),
        },
      ]);
      expect(logs).toContain(
        `schedule run started scheduleId=${schedule.id} userId=${OWNER} localDate=${LOCAL_DATE} targetKind=chief-of-staff runId=collab-run-1`,
      );
    });

    it("a workflow: the page's workflow body, testRun false from the page parser, never in the body", async () => {
      const schedule = workflowSchedule();
      store.schedules.rows.push(schedule);
      await service.tick(NOW);
      const body = starts.readStartBody.mock.calls[0][0] as Record<string, unknown>;
      expect(body).toEqual({ workflowId: WORKFLOW, task: TASK });
      expect(body).not.toHaveProperty('testRun');
      expect(body).not.toHaveProperty('sessionId');
      expect(starts.start).toHaveBeenCalledWith(SESSION_IDENTITY, { task: TASK, workflowId: WORKFLOW, testRun: false });
      expect(auditOf('run_started')[0].payload).toEqual({
        scheduleId: schedule.id,
        localDate: LOCAL_DATE,
        targetKind: 'workflow',
        workflowId: WORKFLOW,
        collaborationRunId: 'collab-run-1',
      });
    });

    it('nothing is read for a switched-off schedule, and a schedule that is not due writes nothing', async () => {
      store.schedules.rows.push(scheduleRow({ enabled: false }), scheduleRow({ timeOfDay: 8 * 60 }));
      expect(await service.tick(NOW)).toMatchObject({ evaluated: 1, started: 0, skipped: 0 });
      expect(store.runs.rows).toEqual([]);
      expect(store.audit.rows).toEqual([]);
      expect(starts.start).not.toHaveBeenCalled();
    });
  });

  describe('one attempt per schedule per local day', () => {
    it('acceptance 4: a second tick the same local day does nothing', async () => {
      store.schedules.rows.push(scheduleRow());
      await service.tick(NOW);
      const rows = JSON.stringify(store.runs.rows);
      const audits = store.audit.rows.length;
      for (const later of [NOW.getTime() + MINUTE, NOW.getTime() + 30 * MINUTE, NOW.getTime() + 10 * 60 * MINUTE]) {
        await service.tick(new Date(later));
        // A fresh process (no memory of the earlier tick) does nothing either.
        await newService().tick(new Date(later));
      }
      expect(JSON.stringify(store.runs.rows)).toBe(rows);
      expect(store.audit.rows).toHaveLength(audits);
      expect(starts.start).toHaveBeenCalledTimes(1);
      expect(starts.approveStep).toHaveBeenCalledTimes(1);
    });

    it('the next ticked local day starts again', async () => {
      store.schedules.rows.push(scheduleRow());
      await service.tick(NOW);
      await service.tick(new Date(NOW.getTime() + 24 * 60 * MINUTE));
      expect(store.runs.rows.map((row) => [row.localDate, row.outcome])).toEqual([
        ['2026-11-16', 'started'],
        ['2026-11-17', 'started'],
      ]);
    });

    it('acceptance 3: two concurrent claims for one occurrence (two processes) make one start', async () => {
      store.schedules.rows.push(scheduleRow(), workflowSchedule());
      const other = newService();
      const [a, b] = await Promise.all([service.tick(NOW), other.tick(NOW)]);
      expect(a.started + b.started).toBe(2);
      expect(starts.start).toHaveBeenCalledTimes(2);
      expect(starts.approveStep).toHaveBeenCalledTimes(2);
      expect(store.runs.rows).toHaveLength(2);
      expect(new Set(store.runs.rows.map((row) => row.scheduleId)).size).toBe(2);
      expect(auditOf('run_started')).toHaveLength(2);
      // The loser of each claim saw the unique violation and stopped quietly.
      expect(store.uniqueViolations).toBe(2);
      expect(logs.filter((line) => line.includes('claim failed'))).toEqual([]);
    });

    it('a claim that fails for another reason starts nothing and logs the error name only', async () => {
      store.schedules.rows.push(scheduleRow());
      store.runs.failNextInsert = new Error(`db said ${MARKER}`);
      await service.tick(NOW);
      expect(starts.start).not.toHaveBeenCalled();
      expect(store.runs.rows).toEqual([]);
      expect(logs.some((line) => /schedule claim failed scheduleId=\S+ localDate=2026-11-16 reason=Error/.test(line))).toBe(true);
    });

    it('at most 5 occurrences go to the start path a tick; the rest start on the next tick', async () => {
      for (let i = 0; i < 7; i += 1) store.schedules.rows.push(scheduleRow());
      expect(await service.tick(NOW)).toMatchObject({ started: SCHEDULE_RUN_LIMITS.startsPerTick });
      expect(SCHEDULE_RUN_LIMITS.startsPerTick).toBe(5);
      expect(starts.start).toHaveBeenCalledTimes(5);
      expect(await service.tick(new Date(NOW.getTime() + MINUTE))).toMatchObject({ started: 2 });
      expect(starts.start).toHaveBeenCalledTimes(7);
      expect(store.runs.rows.every((row) => row.outcome === 'started')).toBe(true);
    });

    it('reads at most 200 enabled schedules a tick and goes on after the last one read', async () => {
      // 205 schedules that are not due yet (08:00): only the reads matter here.
      for (let i = 0; i < 205; i += 1) store.schedules.rows.push(scheduleRow({ timeOfDay: 8 * 60 }));
      const seen: string[][] = [];
      const find = store.schedules.find.bind(store.schedules);
      jest.spyOn(store.schedules, 'find').mockImplementation(async (options) => {
        const found = await find(options);
        expect(options.take).toBeLessThanOrEqual(200);
        seen.push(found.map((row) => row.id));
        return found;
      });
      expect((await service.tick(NOW)).evaluated).toBe(200);
      expect((await service.tick(NOW)).evaluated).toBe(200);
      const ids = store.schedules.rows.map((row) => row.id).sort();
      expect(seen[0]).toEqual(ids.slice(0, 200));
      // The second tick reads the last five, then wraps to the start.
      expect(seen[1]).toEqual(ids.slice(200));
      expect(seen[2]).toEqual(ids.slice(0, 195));
    });
  });

  describe('acceptance 5: each reason code from its cause, one row and one audit row, no retry', () => {
    type Case = {
      reason: string;
      schedule: () => AgentSchedule;
      cause: () => void;
      at?: Date;
      /** A run was created, then cancelled. */
      cancelled?: boolean;
      /** start was reached. */
      started?: boolean;
    };
    const cases: Array<[string, Case]> = [
      ['runs_off', { reason: 'runs_off', schedule: scheduleRow, cause: () => (process.env.GLOBAL_EXECUTION_ENABLED = 'false') }],
      ['inactive (not active)', { reason: 'inactive', schedule: scheduleRow, cause: () => (store.users.rows[0].isActive = false) }],
      ['inactive (owner missing)', { reason: 'inactive', schedule: scheduleRow, cause: () => (store.users.rows = []) }],
      ['not_entitled', { reason: 'not_entitled', schedule: scheduleRow, cause: () => entitled.clear() }],
      [
        'workflow_gone (deleted)',
        { reason: 'workflow_gone', schedule: workflowSchedule, cause: () => (store.workflows.rows[0].deletedAt = new Date()) },
      ],
      [
        "workflow_gone (another owner's)",
        { reason: 'workflow_gone', schedule: () => workflowSchedule({ workflowId: OTHER }), cause: () => undefined },
      ],
      [
        'workflow_gone (the start finds it gone)',
        {
          reason: 'workflow_gone',
          schedule: workflowSchedule,
          cause: () => starts.start.mockRejectedValueOnce(workflowRefusal(WORKFLOW_REFUSAL_CODES.notFound)),
          started: true,
        },
      ],
      [
        'workflow_off',
        {
          reason: 'workflow_off',
          schedule: workflowSchedule,
          cause: () => starts.start.mockRejectedValueOnce(workflowRefusal(WORKFLOW_REFUSAL_CODES.disabled)),
          started: true,
        },
      ],
      [
        'workflow_not_tested',
        {
          reason: 'workflow_not_tested',
          schedule: workflowSchedule,
          cause: () => starts.start.mockRejectedValueOnce(workflowRefusal(WORKFLOW_REFUSAL_CODES.notTested)),
          started: true,
        },
      ],
      [
        'workflow_invalid',
        {
          reason: 'workflow_invalid',
          schedule: workflowSchedule,
          cause: () => starts.start.mockRejectedValueOnce(workflowRefusal(WORKFLOW_REFUSAL_CODES.invalid)),
          started: true,
        },
      ],
      [
        'workflow_budget',
        {
          reason: 'workflow_budget',
          schedule: workflowSchedule,
          cause: () => starts.start.mockRejectedValueOnce(workflowRefusal(WORKFLOW_REFUSAL_CODES.budgetDay)),
          started: true,
        },
      ],
      [
        'over_cap (the pre-check)',
        {
          reason: 'over_cap',
          schedule: scheduleRow,
          cause: () =>
            caps.assertWithinDailyCap.mockRejectedValueOnce(
              new HttpException({ statusCode: 429, message: 'Daily credit limit reached', cap: 'user' }, 429),
            ),
        },
      ],
      [
        'over_cap (found at approve)',
        {
          reason: 'over_cap',
          schedule: scheduleRow,
          cause: () => starts.approveStep.mockRejectedValueOnce(new ServiceUnavailableException('Token quota exceeded')),
          started: true,
          cancelled: true,
        },
      ],
      [
        'provider_off',
        {
          reason: 'provider_off',
          schedule: scheduleRow,
          cause: () =>
            starts.approveStep.mockRejectedValueOnce(new ServiceUnavailableException('Provider anthropic temporarily unavailable')),
          started: true,
          cancelled: true,
        },
      ],
      [
        'no_credits',
        {
          reason: 'no_credits',
          schedule: scheduleRow,
          cause: () =>
            starts.approveStep.mockRejectedValueOnce(
              new HttpException({ statusCode: 402, message: 'Insufficient credit balance' }, HttpStatus.PAYMENT_REQUIRED),
            ),
          started: true,
          cancelled: true,
        },
      ],
      ['missed', { reason: 'missed', schedule: scheduleRow, cause: () => undefined, at: new Date(NOW.getTime() + 56 * MINUTE) }],
      [
        'refused (at start)',
        { reason: 'refused', schedule: scheduleRow, cause: () => starts.start.mockRejectedValueOnce(new Error(MARKER)), started: true },
      ],
      [
        'refused (at approve)',
        {
          reason: 'refused',
          schedule: scheduleRow,
          cause: () => starts.approveStep.mockRejectedValueOnce(new Error(MARKER)),
          started: true,
          cancelled: true,
        },
      ],
      [
        'refused (the cap check itself failed)',
        {
          reason: 'refused',
          schedule: scheduleRow,
          cause: () => caps.assertWithinDailyCap.mockRejectedValueOnce(new ServiceUnavailableException('Daily credit limit check failed')),
        },
      ],
    ];

    it.each(cases)('%s', async (_name, testCase) => {
      const schedule = testCase.schedule();
      store.schedules.rows.push(schedule);
      testCase.cause();
      const at = testCase.at ?? NOW;
      await service.tick(at);

      expect(store.runs.rows).toEqual([
        {
          id: expect.any(String),
          scheduleId: schedule.id,
          userId: OWNER,
          localDate: LOCAL_DATE,
          outcome: 'skipped',
          reason: testCase.reason,
          collaborationRunId: testCase.cancelled ? 'collab-run-1' : null,
          createdAt: at,
        },
      ]);
      const skipped = auditOf('run_skipped');
      expect(skipped).toHaveLength(1);
      expect(skipped[0]).toMatchObject({
        category: 'trigger',
        subjectType: 'agent_schedule',
        subjectId: schedule.id,
        userId: OWNER,
      });
      expect(skipped[0].payload).toEqual({
        scheduleId: schedule.id,
        localDate: LOCAL_DATE,
        targetKind: schedule.targetKind,
        workflowId: schedule.workflowId,
        reason: testCase.reason,
        ...(testCase.cancelled ? { collaborationRunId: 'collab-run-1' } : {}),
      });
      expect(auditOf('run_started')).toEqual([]);
      expect(starts.start).toHaveBeenCalledTimes(testCase.started ? 1 : 0);
      if (testCase.cancelled) {
        expect(orchestration.cancelCollaboration).toHaveBeenCalledWith({
          collaborationRunId: 'collab-run-1',
          cancelledByUserId: OWNER,
          cancelReason: `schedule_skipped:${testCase.reason}`,
        });
      } else {
        expect(orchestration.cancelCollaboration).not.toHaveBeenCalled();
      }
      expect(logs.some((line) => line.includes(`reason=${testCase.reason}`))).toBe(true);

      // No retry on the next tick, nor in another process, even once the cause is gone.
      process.env.GLOBAL_EXECUTION_ENABLED = 'true';
      entitled.add(OWNER);
      const rows = JSON.stringify(store.runs.rows);
      const audits = store.audit.rows.length;
      await service.tick(new Date(at.getTime() + MINUTE));
      await newService().tick(new Date(at.getTime() + 2 * MINUTE));
      expect(JSON.stringify(store.runs.rows)).toBe(rows);
      expect(store.audit.rows).toHaveLength(audits);
      expect(starts.start).toHaveBeenCalledTimes(testCase.started ? 1 : 0);
    });

    it('interrupted: a claim older than 10 minutes is closed with one audit row; a run it made is left as it is', async () => {
      const schedule = scheduleRow();
      store.schedules.rows.push(schedule);
      store.runs.rows.push(
        {
          id: 'row-old',
          scheduleId: schedule.id,
          userId: OWNER,
          localDate: LOCAL_DATE,
          outcome: 'claimed',
          reason: null,
          collaborationRunId: 'collab-run-left',
          createdAt: new Date(NOW.getTime() - 11 * MINUTE),
        },
        {
          id: 'row-young',
          scheduleId: 'bbbbbbbb-0000-4000-8000-000000000001',
          userId: OWNER,
          localDate: LOCAL_DATE,
          outcome: 'claimed',
          reason: null,
          collaborationRunId: null,
          createdAt: new Date(NOW.getTime() - 9 * MINUTE),
        },
      );
      expect(await service.tick(NOW)).toMatchObject({ interrupted: 1, started: 0 });
      expect(store.runs.rows.find((row) => row.id === 'row-old')).toMatchObject({
        outcome: 'skipped',
        reason: 'interrupted',
        collaborationRunId: 'collab-run-left',
      });
      expect(store.runs.rows.find((row) => row.id === 'row-young')).toMatchObject({ outcome: 'claimed' });
      expect(auditOf('run_skipped').map((row) => row.payload)).toEqual([
        {
          scheduleId: schedule.id,
          localDate: LOCAL_DATE,
          targetKind: 'chief-of-staff',
          workflowId: null,
          collaborationRunId: 'collab-run-left',
          reason: 'interrupted',
        },
      ]);
      expect(orchestration.cancelCollaboration).not.toHaveBeenCalled();
      // The day had its one attempt: nothing starts, and the next tick changes nothing.
      expect(starts.start).not.toHaveBeenCalled();
      await service.tick(new Date(NOW.getTime() + MINUTE));
      expect(auditOf('run_skipped')).toHaveLength(1);
      // The young claim is closed once it is older than 10 minutes.
      await service.tick(new Date(NOW.getTime() + 2 * MINUTE));
      expect(store.runs.rows.find((row) => row.id === 'row-young')).toMatchObject({ outcome: 'skipped', reason: 'interrupted' });
      expect(auditOf('run_skipped')).toHaveLength(2);
    });

    it('a start that fails unexpectedly after the claim leaves the claim to be closed as interrupted, never retried', async () => {
      const schedule = scheduleRow();
      store.schedules.rows.push(schedule);
      store.users.failNextFindOne = new Error(MARKER);
      await service.tick(NOW);
      expect(store.runs.rows).toEqual([expect.objectContaining({ outcome: 'claimed', reason: null })]);
      expect(logs.some((line) => line.includes('schedule.start_failed'))).toBe(true);
      await service.tick(new Date(NOW.getTime() + 5 * MINUTE));
      expect(starts.start).not.toHaveBeenCalled();
      await service.tick(new Date(NOW.getTime() + 11 * MINUTE));
      expect(store.runs.rows).toEqual([expect.objectContaining({ outcome: 'skipped', reason: 'interrupted' })]);
      expect(starts.start).not.toHaveBeenCalled();
      expect(auditOf('run_skipped')).toHaveLength(1);
    });
  });

  it('acceptance 6: a refusal at approve cancels the created run with the reason, and records it', async () => {
    store.schedules.rows.push(scheduleRow());
    starts.approveStep.mockRejectedValueOnce(new ServiceUnavailableException('Provider anthropic temporarily unavailable'));
    await service.tick(NOW);
    expect(orchestration.cancelCollaboration).toHaveBeenCalledTimes(1);
    expect(orchestration.cancelCollaboration).toHaveBeenCalledWith({
      collaborationRunId: 'collab-run-1',
      cancelledByUserId: OWNER,
      cancelReason: 'schedule_skipped:provider_off',
    });
    expect(orchestration.cancelCollaboration.mock.invocationCallOrder[0]).toBeGreaterThan(
      starts.approveStep.mock.invocationCallOrder[0],
    );
    expect(store.runs.rows[0]).toMatchObject({ outcome: 'skipped', reason: 'provider_off', collaborationRunId: 'collab-run-1' });
  });

  it('a failed cancel is logged by name and the occurrence is still recorded as skipped', async () => {
    store.schedules.rows.push(scheduleRow());
    starts.approveStep.mockRejectedValueOnce(new HttpException({ statusCode: 402, message: 'Insufficient credit balance' }, 402));
    orchestration.cancelCollaboration.mockRejectedValueOnce(new Error(MARKER));
    await service.tick(NOW);
    expect(store.runs.rows[0]).toMatchObject({ outcome: 'skipped', reason: 'no_credits' });
    expect(logs.some((line) => /schedule run cancel failed .* reason=Error$/.test(line))).toBe(true);
  });

  describe('acceptance 9: workflow_gone switches the schedule off', () => {
    it('the schedule is switched off with one schedule_disabled audit row; it is not read again', async () => {
      const schedule = workflowSchedule();
      const before = { updatedAt: schedule.updatedAt.getTime(), armedAt: schedule.armedAt.getTime() };
      store.schedules.rows.push(copy(schedule));
      store.workflows.rows[0].deletedAt = new Date();
      await service.tick(NOW);
      expect(store.schedules.rows[0].enabled).toBe(false);
      expect(store.schedules.rows[0].updatedAt.getTime()).toBeGreaterThan(before.updatedAt);
      // armed_at is not touched: switching on again (an owner PATCH) re-arms it.
      expect(store.schedules.rows[0].armedAt.getTime()).toBe(before.armedAt);
      expect(auditOf('schedule_disabled')).toEqual([
        {
          category: 'trigger',
          eventType: 'schedule_disabled',
          subjectType: 'agent_schedule',
          subjectId: schedule.id,
          userId: OWNER,
          payload: {
            scheduleId: schedule.id,
            localDate: LOCAL_DATE,
            targetKind: 'workflow',
            workflowId: WORKFLOW,
            reason: 'workflow_gone',
          },
          occurredAt: expect.any(Date),
        },
      ]);
      expect(logs).toContain(`schedule disabled scheduleId=${schedule.id} userId=${OWNER} reason=workflow_gone`);
      // The next day it is not read at all.
      expect((await service.tick(new Date(NOW.getTime() + 24 * 60 * MINUTE))).evaluated).toBe(0);
      expect(auditOf('run_skipped')).toHaveLength(1);
    });

    it('a workflow that is off is skipped but the schedule stays on', async () => {
      store.schedules.rows.push(workflowSchedule());
      starts.start.mockRejectedValueOnce(workflowRefusal(WORKFLOW_REFUSAL_CODES.disabled));
      await service.tick(NOW);
      expect(store.schedules.rows[0].enabled).toBe(true);
      expect(auditOf('schedule_disabled')).toEqual([]);
    });
  });

  describe('the 90-day prune', () => {
    it('deletes history rows older than 90 days, at most once an hour', async () => {
      const day = 24 * 60 * MINUTE;
      const row = (id: string, ageDays: number) => ({
        id,
        scheduleId: 'cccccccc-0000-4000-8000-000000000001',
        userId: OWNER,
        localDate: '2026-01-01',
        outcome: 'started' as const,
        reason: null,
        collaborationRunId: null,
        createdAt: new Date(NOW.getTime() - ageDays * day),
      });
      store.runs.rows.push(row('old', 91), row('kept', 89));
      expect((await service.tick(NOW)).pruned).toBe(1);
      expect(store.runs.rows.map((r) => r.id)).toEqual(['kept']);
      store.runs.rows.push(row('old-2', 120));
      expect((await service.tick(new Date(NOW.getTime() + 30 * MINUTE))).pruned).toBe(0);
      expect((await service.tick(new Date(NOW.getTime() + 61 * MINUTE))).pruned).toBe(1);
      expect(store.runs.rows.map((r) => r.id)).toEqual(['kept']);
      expect(SCHEDULE_RUN_LIMITS.historyRetentionMs).toBe(90 * day);
    });
  });

  describe('acceptance 2 with the real run service: switched off, nothing is read or written', () => {
    it.each([[undefined], ['false'], ['TRUE']])('SCHEDULES_ENABLED=%j', async (value) => {
      restoreEnv('SCHEDULES_ENABLED', value);
      store.schedules.rows.push(scheduleRow());
      store.runs.rows.push({
        id: 'stale',
        scheduleId: 'dddddddd-0000-4000-8000-000000000001',
        userId: OWNER,
        localDate: '2026-01-01',
        outcome: 'claimed',
        reason: null,
        collaborationRunId: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      const timer = new ScheduleTimer(service);
      expect(await timer.tickOnce(NOW)).toBe(false);
      expect(store.calls).toEqual([]);
      expect(store.audit.rows).toEqual([]);
      expect(entitlements.resolveHarnessEntitled).not.toHaveBeenCalled();
      expect(caps.assertWithinDailyCap).not.toHaveBeenCalled();
      expect(starts.start).not.toHaveBeenCalled();
      expect(logs).toEqual([]);
    });
  });

  it('the source never logs or audits the task: no log or audit line names schedule.task', () => {
    const source = readFileSync(join(__dirname, 'schedule-run.service.ts'), 'utf8');
    const lines = source.split('\n').filter((line) => /logger\.|payload|JSON\.stringify/.test(line));
    for (const line of lines) {
      expect(line).not.toMatch(/\.task\b/);
    }
    // The task is read in exactly one place: the page body.
    expect(source.match(/schedule\.task\b/g)).toHaveLength(2);
    expect(source).toMatch(/\{ workflowId: schedule\.workflowId, task: schedule\.task \}/);
    expect(source).toMatch(/\{ team: 'chief-of-staff', task: schedule\.task \}/);
  });
});

/* ---------- Acceptance 8: the stored first hand-off equals the Team page's. ---------- */

const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BUSINESS_SESSION_ID = '33333333-3333-4333-8333-333333333333';
const BUSINESS_PROJECT_ID = '44444444-4444-4444-8444-444444444444';
const CONVERSATION_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const WORKFLOW_ID = '55555555-5555-4555-8555-555555555555';
const PAGE_TASK = 'Plan my week with the sales numbers';
const HARNESS_SECRET = 'schedule-run-test-secret';

function cloneRow<T>(row: T): T {
  const copied = { ...(row as Record<string, unknown>) };
  for (const key of Object.keys(copied)) {
    const value = copied[key];
    if (value instanceof Date) {
      copied[key] = new Date(value.getTime());
    } else if (Array.isArray(value)) {
      copied[key] = [...value];
    } else if (key === 'pendingJob' && value && typeof value === 'object') {
      copied[key] = JSON.parse(JSON.stringify(value));
    }
  }
  return copied as T;
}

function matchesWhere(row: unknown, where?: Record<string, unknown>): boolean {
  if (!where) return true;
  const record = row as Record<string, unknown>;
  return Object.entries(where).every(([key, expected]) => record[key] === expected);
}

function createOrchestrationRepoFakes() {
  const runs = new Map<string, CollaborationRunEntity>();
  const referrals = new Map<string, CollaborationReferralEntity>();
  const createRepo = <T>(rows: Map<string, T>, pk: string) => {
    const repo = {
      findOne: async ({ where }: { where: Record<string, unknown> }) => {
        for (const row of rows.values()) {
          if (matchesWhere(row, where)) return cloneRow(row);
        }
        return null;
      },
      find: async (opts: { where?: Record<string, unknown> } = {}) =>
        [...rows.values()].filter((row) => matchesWhere(row, opts.where)).map((row) => cloneRow(row)),
      save: async (entity: T) => {
        const copied = cloneRow(entity);
        rows.set(String((copied as Record<string, unknown>)[pk]), copied);
        return cloneRow(copied);
      },
      update: async (criteria: Record<string, unknown>, partial: Record<string, unknown>) => {
        let affected = 0;
        for (const [key, row] of rows) {
          if (matchesWhere(row, criteria)) {
            const next = cloneRow(row);
            Object.assign(next as Record<string, unknown>, partial);
            rows.set(key, next);
            affected += 1;
          }
        }
        return { affected, raw: [], generatedMaps: [] };
      },
      manager: undefined as unknown,
    };
    return repo;
  };
  const runRepo = createRepo(runs, 'collaborationRunId');
  const referralRepo = createRepo(referrals, 'referralId');
  const manager = {
    transaction: async <R>(cb: (em: typeof manager) => Promise<R>) => cb(manager),
    getRepository: (entity: unknown) => {
      if (entity === CollaborationRunEntity) return runRepo;
      if (entity === CollaborationReferralEntity) return referralRepo;
      throw new Error('Unknown orchestration entity');
    },
  };
  runRepo.manager = manager;
  referralRepo.manager = manager;
  return { runRepo, referralRepo, runs, referrals };
}

/** The stored first hand-off without the values that differ on every start (as collaboration-start.service.spec.ts). */
function storedHandoff(referral: CollaborationReferralEntity): Record<string, unknown> {
  const row = JSON.parse(JSON.stringify(referral)) as Record<string, unknown>;
  for (const key of ['referralId', 'collaborationRunId', 'referralTraceId', 'idempotencyKey', 'executionId']) {
    expect(typeof row[key]).toBe('string');
    delete row[key];
  }
  for (const [key, value] of Object.entries(row)) {
    if (/At$/.test(key)) {
      expect(value === null || typeof value === 'string').toBe(true);
      row[key] = value === null ? null : 'time';
    }
  }
  const job = row.pendingJob as Record<string, unknown>;
  for (const key of Object.keys(job)) {
    if (/execution/i.test(key) && typeof job[key] === 'string') {
      job[key] = 'id';
    }
  }
  return row;
}

function storedRun(run: CollaborationRunEntity): Record<string, unknown> {
  const row = JSON.parse(JSON.stringify(run)) as Record<string, unknown>;
  delete row.collaborationRunId;
  row.referralIds = (row.referralIds as unknown[]).length;
  for (const [key, value] of Object.entries(row)) {
    if (/At$/.test(key)) row[key] = value === null ? null : 'time';
  }
  return row;
}

describe('ScheduleRunService with the real start and approve code (TRIGGER-01 S2 acceptance 8)', () => {
  const original = {
    global: process.env.GLOBAL_EXECUTION_ENABLED,
    provider: process.env.AI_PROVIDER,
    abort: process.env.ABORT_MODE,
    secret: process.env.HARNESS_ENTITLEMENT_HMAC_SECRET,
  };
  let app: INestApplication;
  let fakes: ReturnType<typeof createOrchestrationRepoFakes>;
  let starts: CollaborationStartService;
  let orchestration: OrchestrationService;
  let sessionReads: jest.Mock;
  let capCheck: jest.Mock;
  let store: MemoryStore;
  let runs: ScheduleRunService;

  beforeEach(async () => {
    process.env.GLOBAL_EXECUTION_ENABLED = 'true';
    process.env.AI_PROVIDER = 'stub';
    process.env.ABORT_MODE = 'NONE';
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = HARNESS_SECRET;
    AbortConfig.initialize();

    fakes = createOrchestrationRepoFakes();
    sessionReads = jest.fn(async (id: string) => {
      throw new NotFoundException(`Session with ID ${id} not found`);
    });
    const conversations = new Map<string, { id: string; sessionId: string }>();
    capCheck = jest.fn(async () => undefined);
    const creditGuard = new CreditBalanceGuard(
      { findByOwner: async () => ({ balance: 25 }) } as never,
      { findOne: async () => ({ role: UserRole.USER }) } as never,
    );
    const tokenGuard = new TokenQuotaGuard({
      createQueryRunner: () => ({
        connect: async () => undefined,
        startTransaction: async () => undefined,
        commitTransaction: async () => undefined,
        rollbackTransaction: async () => undefined,
        release: async () => undefined,
        query: async (sql: string) => {
          if (sql.includes('SUM(tokens_used)')) return [{ total: 0 }];
          if (sql.includes('ORDER BY timestamp')) return [{ timestamp: new Date() }];
          return [];
        },
      }),
    } as never);
    const workflow = {
      id: WORKFLOW_ID,
      name: 'Sales Digest',
      version: 'v-test',
      knowledgeScopeIds: [],
      connectorToolIds: [],
      model: { choice: 'server' as const },
      testRun: false,
      budgetPerRunCredits: null,
    };
    const workflowService = {
      prepareStart: jest.fn(async (input: { userId: string; workflowId: string; testRun: boolean }) => {
        if (input.userId !== OWNER_ID || input.workflowId !== WORKFLOW_ID) {
          throw new NotFoundException('Workflow not found');
        }
        return {
          builderProfileId: WORKFLOW_ID,
          agents: [{ name: WORKFLOW_ID, instructions: 'Summarise the sales numbers.' }],
          provider: 'stub',
          adapter: 'stub',
          model: 'stub-model',
          workflow: { ...workflow },
          teamMemberIds: [],
        };
      }),
      listForOwner: jest.fn(async () => []),
      assertCanApprove: jest.fn(async () => undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollaborationController],
      providers: [
        OrchestrationService,
        CollaborationStartService,
        ExecutionSafetyGuard,
        GlobalSafetyLimitService,
        AbortGuard,
        { provide: DailyCreditCapService, useValue: { assertWithinDailyCap: capCheck } },
        { provide: CreditBalanceGuard, useValue: creditGuard },
        { provide: TokenQuotaGuard, useValue: tokenGuard },
        { provide: getRepositoryToken(CollaborationRunEntity), useValue: fakes.runRepo },
        { provide: getRepositoryToken(CollaborationReferralEntity), useValue: fakes.referralRepo },
        { provide: QueueService, useValue: { enqueueExecution: jest.fn().mockResolvedValue(undefined) } },
        {
          provide: ExecutionResultService,
          useValue: { requestCancel: jest.fn(), getExecution: jest.fn().mockResolvedValue(null) },
        },
        { provide: ContainerManagerHttpClient, useValue: { getWorkingTreeDiff: jest.fn() } },
        { provide: UsageLedgerService, useValue: { writeExecutionIntent: jest.fn().mockResolvedValue(undefined) } },
        { provide: SessionService, useValue: { getSessionById: sessionReads } },
        { provide: KnowledgeService, useValue: { findActiveOwnedByIds: jest.fn(async () => []) } },
        {
          provide: ConversationService,
          useValue: {
            getConversationBySession: async (sessionId: string) => conversations.get(sessionId) ?? null,
            getOrCreateConversation: async (sessionId: string) => {
              const created = { id: CONVERSATION_ID, sessionId };
              conversations.set(sessionId, created);
              return created;
            },
          },
        },
        {
          provide: CollaborationBusinessSessionService,
          useValue: {
            ensureForOwner: async () => ({ sessionId: BUSINESS_SESSION_ID, projectId: BUSINESS_PROJECT_ID }),
            findForOwner: async () => ({ projectId: BUSINESS_PROJECT_ID }),
          },
        },
        { provide: CollaborationWorkflowService, useValue: workflowService },
      ],
    })
      .overrideGuard(SessionOrApiKeyAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          // The identity SessionOrApiKeyAuthGuard builds for a browser session.
          req.apiKeyIdentity = {
            userId: OWNER_ID,
            apiKeyId: 'browser-session',
            scopes: ['ai:execute'],
            isInternal: true,
            harnessEntitled: true,
          };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    starts = app.get(CollaborationStartService);
    orchestration = app.get(OrchestrationService);

    store = new MemoryStore();
    store.users.rows.push({ id: OWNER_ID, isActive: true });
    store.workflows.rows.push({ id: WORKFLOW_ID, userId: OWNER_ID, name: 'Sales Digest', status: 'active', deletedAt: null });
    runs = new ScheduleRunService(
      store.schedules as never,
      store.runs as never,
      store.workflows as never,
      store.users as never,
      store.audit as never,
      starts,
      orchestration,
      { resolveHarnessEntitled: async (id: string) => id === OWNER_ID } as never,
      { assertWithinDailyCap: capCheck } as never,
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
    restoreEnv('GLOBAL_EXECUTION_ENABLED', original.global);
    restoreEnv('AI_PROVIDER', original.provider);
    restoreEnv('ABORT_MODE', original.abort);
    restoreEnv('HARNESS_ENTITLEMENT_HMAC_SECRET', original.secret);
  });

  async function pageStartAndApprove(body: Record<string, unknown>): Promise<string> {
    const started = await request(app.getHttpServer()).post('/api/collaboration/runs').send(body).expect(201);
    await request(app.getHttpServer())
      .post(`/api/collaboration/runs/${started.body.collaborationRunId}/referrals/${started.body.referralId}/approve`)
      .send({})
      .expect(200);
    return started.body.collaborationRunId as string;
  }

  function firstHandoffOf(runId: string): CollaborationReferralEntity {
    const run = fakes.runs.get(runId)!;
    return fakes.referrals.get(run.referralIds[0])!;
  }

  async function scheduledRun(row: AgentSchedule): Promise<string> {
    store.schedules.rows.push(row);
    await runs.tick(NOW);
    const history = store.runs.rows.find((entry) => entry.scheduleId === row.id)!;
    expect(history.outcome).toBe('started');
    return history.collaborationRunId as string;
  }

  it('Chief of Staff: the same run and first hand-off as the page for the same owner and body', async () => {
    const pageRunId = await pageStartAndApprove({ team: 'chief-of-staff', task: PAGE_TASK });
    const scheduleRunId = await scheduledRun(scheduleRow({ userId: OWNER_ID, task: PAGE_TASK }));
    expect(scheduleRunId).not.toBe(pageRunId);

    expect(storedRun(fakes.runs.get(scheduleRunId)!)).toEqual(storedRun(fakes.runs.get(pageRunId)!));
    const pageHandoff = storedHandoff(firstHandoffOf(pageRunId));
    const scheduleHandoff = storedHandoff(firstHandoffOf(scheduleRunId));
    expect(scheduleHandoff).toEqual(pageHandoff);
    const job = scheduleHandoff.pendingJob as Record<string, unknown>;
    expect(job.decidedBy).toBe(OWNER_ID);
    expect(job.sessionId).toBe(BUSINESS_SESSION_ID);
    expect(job.apiKeyId).toBe('browser-session');
    expect(job.prompt).toBe(PAGE_TASK);
    expect(sessionReads).not.toHaveBeenCalled();
  });

  it('a workflow: the same run and first hand-off as the page', async () => {
    const pageRunId = await pageStartAndApprove({ workflowId: WORKFLOW_ID, task: PAGE_TASK });
    const scheduleRunId = await scheduledRun(
      scheduleRow({ userId: OWNER_ID, task: PAGE_TASK, targetKind: 'workflow', workflowId: WORKFLOW_ID }),
    );
    expect(storedRun(fakes.runs.get(scheduleRunId)!)).toEqual(storedRun(fakes.runs.get(pageRunId)!));
    expect(storedHandoff(firstHandoffOf(scheduleRunId))).toEqual(storedHandoff(firstHandoffOf(pageRunId)));
  });

  it('the approve checks still run: provider switched off cancels the created run with schedule_skipped:provider_off', async () => {
    jest.spyOn(KillSwitchConfig, 'isProviderEnabled').mockReturnValue(false);
    const row = scheduleRow({ userId: OWNER_ID, task: PAGE_TASK });
    store.schedules.rows.push(row);
    await runs.tick(NOW);
    const history = store.runs.rows[0];
    expect(history).toMatchObject({ outcome: 'skipped', reason: 'provider_off' });
    const run = fakes.runs.get(history.collaborationRunId as string)!;
    expect(run.status).toBe('cancelled');
    expect(run.cancelReason).toBe('schedule_skipped:provider_off');
    expect(fakes.referrals.get(run.referralIds[0])!.status).toBe('cancelled');
  });

  it('over the daily cap at approve: the safety guard refuses, the run is cancelled with over_cap', async () => {
    capCheck
      .mockResolvedValueOnce(undefined) // the read-only pre-check passes
      .mockRejectedValue(
        new HttpException(
          { statusCode: 429, message: 'Daily credit limit reached', error: 'Too Many Requests', cap: 'user' },
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );
    store.schedules.rows.push(scheduleRow({ userId: OWNER_ID, task: PAGE_TASK }));
    await runs.tick(NOW);
    expect(store.runs.rows[0]).toMatchObject({ outcome: 'skipped', reason: 'over_cap' });
    const run = fakes.runs.get(store.runs.rows[0].collaborationRunId as string)!;
    expect(run.cancelReason).toBe('schedule_skipped:over_cap');
  });
});

/* ---------- In-memory TypeORM stand-in for the schedule tables. ---------- */

type Row = Record<string, unknown>;

function sameValue(left: unknown, right: unknown): boolean {
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
  return left === right;
}

function compare(left: unknown, right: unknown): number {
  if (left instanceof Date || right instanceof Date) {
    return new Date(left as Date).getTime() - new Date(right as Date).getTime();
  }
  if (typeof left === 'string' && typeof right === 'string') {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  return Number(left) - Number(right);
}

function matchesOne(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected instanceof FindOperator) {
      switch (expected.type) {
        case 'isNull':
          return actual === null || actual === undefined;
        case 'in':
          return (expected.value as unknown[]).some((value) => sameValue(actual, value));
        case 'moreThan':
          return compare(actual, expected.value) > 0;
        case 'lessThan':
          return compare(actual, expected.value) < 0;
        case 'lessThanOrEqual':
          return compare(actual, expected.value) <= 0;
        default:
          throw new Error(`unsupported operator ${expected.type}`);
      }
    }
    return sameValue(actual, expected);
  });
}

function matches(row: Row, where: Row | Row[]): boolean {
  return Array.isArray(where) ? where.some((one) => matchesOne(row, one)) : matchesOne(row, where);
}

function copy<T>(row: T): T {
  return { ...(row as object) } as T;
}

function sortRows<T>(rows: T[], order?: Record<string, 'ASC' | 'DESC'>): T[] {
  const [orderKey, direction] = Object.entries(order ?? {})[0] ?? [];
  if (orderKey) {
    rows.sort((a, b) => {
      const diff = compare((a as Row)[orderKey], (b as Row)[orderKey]);
      return direction === 'DESC' ? -diff : diff;
    });
  }
  return rows;
}

interface FindOptions {
  where: Row | Row[];
  order?: Record<string, 'ASC' | 'DESC'>;
  take?: number;
  select?: string[];
}

class MemoryRepository<T extends object> {
  rows: T[] = [];
  failNextInsert: Error | null = null;
  failNextFindOne: Error | null = null;

  constructor(
    private readonly name: string,
    private readonly store: MemoryStore,
    private readonly uniques: string[][] = [],
  ) {}

  async findOne(options: FindOptions): Promise<T | null> {
    this.store.calls.push(`${this.name}.findOne`);
    await Promise.resolve();
    if (this.failNextFindOne) {
      const error = this.failNextFindOne;
      this.failNextFindOne = null;
      throw error;
    }
    const found = sortRows(
      this.rows.filter((row) => matches(row as Row, options.where)),
      options.order,
    )[0];
    return found ? copy(found) : null;
  }

  async find(options: FindOptions): Promise<T[]> {
    this.store.calls.push(`${this.name}.find`);
    await Promise.resolve();
    const found = sortRows(
      this.rows.filter((row) => matches(row as Row, options.where)).map(copy),
      options.order,
    );
    return options.take === undefined ? found : found.slice(0, options.take);
  }

  async insert(entity: T): Promise<{ identifiers: unknown[] }> {
    this.store.calls.push(`${this.name}.insert`);
    await Promise.resolve();
    if (this.failNextInsert) {
      const error = this.failNextInsert;
      this.failNextInsert = null;
      throw error;
    }
    for (const columns of this.uniques) {
      const clash = this.rows.some((row) =>
        columns.every((column) => sameValue((row as Row)[column], (entity as Row)[column])),
      );
      if (clash) {
        this.store.uniqueViolations += 1;
        throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
      }
    }
    this.rows.push(copy(entity));
    return { identifiers: [{ id: (entity as Row).id }] };
  }

  async update(where: Row, patch: Partial<T>): Promise<{ affected: number }> {
    this.store.calls.push(`${this.name}.update`);
    await Promise.resolve();
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
    this.store.calls.push(`${this.name}.delete`);
    await Promise.resolve();
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !matches(row as Row, where));
    return { affected: before - this.rows.length };
  }
}

type UserRow = { id: string; isActive: boolean };
type WorkflowRow = { id: string; userId: string; name: string; status: string; deletedAt: Date | null };

class MemoryStore {
  calls: string[] = [];
  uniqueViolations = 0;
  schedules = new MemoryRepository<AgentSchedule>('schedules', this);
  runs = new MemoryRepository<AgentScheduleRun>('runs', this, [['scheduleId', 'localDate']]);
  workflows = new MemoryRepository<WorkflowRow>('workflows', this);
  users = new MemoryRepository<UserRow>('users', this);
  audit = new MemoryRepository<AuditEventEntity>('audit', this);
}
