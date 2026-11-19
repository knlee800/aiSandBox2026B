import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { ChatRunDelivery } from '../entities/chat-run-delivery.entity';
import { CollaborationRunStartedNotifier } from '../orchestration/collaboration-start.service';
import { workflowRefusal, WORKFLOW_REFUSAL_CODES } from '../orchestration/collaboration-workflow';
import { chatReply } from './chat-replies';
import { CHAT_RUN_LIMITS, ChatRunService, chatRunRefusalOf } from './chat-run.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const LINK_ID = '22222222-2222-4222-8222-222222222222';
const WORKFLOW_A = '33333333-3333-4333-8333-333333333333';
const WORKFLOW_B = '44444444-4444-4444-8444-444444444444';
const RUN_ID = 'collab-run-1';
const REFERRAL_ID = 'ref-1';
const MARKER = 'MARKER-c1-task-text-do-not-log';

type DeliveryRow = {
  collaborationRunId: string;
  linkId: string;
  status: string;
  notifiedReferralIds: string[];
  createdAt: Date;
  deliveredAt: Date | null;
  /** CHAT-STATE-PERSIST-01: 'chat' from /ask; the database default 'platform' is not simulated (absent here). */
  origin?: string | null;
};

type AuditRow = {
  category?: string;
  eventType: string;
  subjectType: string;
  subjectId: string;
  userId: string;
  payload: Record<string, unknown>;
};

/** Matches a where clause with plain values and In(...) only. */
function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (expected instanceof FindOperator) {
      if (expected.type !== 'in') throw new Error(`unsupported operator ${expected.type}`);
      return (expected.value as unknown[]).includes(row[key]);
    }
    return row[key] === expected;
  });
}

/**
 * CHAT-RESULTS-OTHER-01: the query builder chain the service uses for its
 * insert-or-ignore (createQueryBuilder().insert().into().values().orIgnore().execute()).
 * insertOrIgnore stands for the statement; it ignores a row whose run id exists.
 */
function insertOrIgnoreBuilder(insertOrIgnore: jest.Mock, calls: string[]) {
  return () => {
    let values: unknown;
    let ignore = false;
    const chain = {
      insert: () => chain,
      into: (target: unknown) => {
        calls.push(target === ChatRunDelivery ? 'into:ChatRunDelivery' : 'into:other');
        return chain;
      },
      values: (row: unknown) => {
        values = row;
        return chain;
      },
      orIgnore: () => {
        ignore = true;
        return chain;
      },
      execute: async () => {
        if (!ignore) throw new Error('insert without orIgnore');
        return insertOrIgnore(values);
      },
    };
    return chain;
  };
}

describe('ChatRunService (CHAT-DISCORD-01 C1)', () => {
  const original = process.env.GLOBAL_EXECUTION_ENABLED;
  const link = { linkId: LINK_ID, userId: OWNER, locale: 'en' as const };
  let rows: DeliveryRow[];
  let audit: AuditRow[];
  let builderCalls: string[];
  let starts: {
    readStartBody: jest.Mock;
    start: jest.Mock;
    approveStep: jest.Mock;
    cancelOwnedActiveRun: jest.Mock;
    listOwnerWorkflows: jest.Mock;
  };
  let orchestration: { cancelCollaboration: jest.Mock; getCollaborationRun: jest.Mock; getReferral: jest.Mock };
  let delivery: { wake: jest.Mock };
  let deliveries: {
    insertOrIgnore: jest.Mock;
    createQueryBuilder: () => unknown;
    update: jest.Mock;
    find: jest.Mock;
  };
  let auditRepo: { insert: jest.Mock; find: jest.Mock };
  let service: ChatRunService;
  let logs: string[];
  let restoreLogs: () => void;

  beforeEach(() => {
    process.env.GLOBAL_EXECUTION_ENABLED = 'true';
    rows = [];
    audit = [];
    builderCalls = [];
    let runCounter = 0;
    starts = {
      // The page parser is tested in collaboration-start.service.spec.ts; here it passes the body on.
      readStartBody: jest.fn((body: Record<string, unknown>) => {
        const task = typeof body.task === 'string' ? body.task.trim() : '';
        if (!task) throw new BadRequestException('task is required');
        return body.workflowId
          ? { task, workflowId: body.workflowId, testRun: false }
          : { task, teamId: body.team };
      }),
      start: jest.fn(async () => {
        runCounter += 1;
        return { collaborationRunId: runCounter === 1 ? RUN_ID : `${RUN_ID}-${runCounter}`, referralId: REFERRAL_ID };
      }),
      approveStep: jest.fn(async () => ({ referral: { referralId: REFERRAL_ID }, executionId: 'x' })),
      cancelOwnedActiveRun: jest.fn(async () => null),
      listOwnerWorkflows: jest.fn(async () => [
        { id: WORKFLOW_A, name: 'Sales Digest', status: 'active' },
        { id: WORKFLOW_B, name: 'Draft Writer', status: 'disabled' },
      ]),
    };
    orchestration = {
      cancelCollaboration: jest.fn(async () => ({ status: 'cancelled' })),
      getCollaborationRun: jest.fn(async () => null),
      getReferral: jest.fn(async () => null),
    };
    delivery = { wake: jest.fn() };
    const insertOrIgnore = jest.fn(async (row: DeliveryRow) => {
      if (!rows.some((existing) => existing.collaborationRunId === row.collaborationRunId)) {
        rows.push({ ...row });
      }
      return { identifiers: [], raw: [] };
    });
    deliveries = {
      insertOrIgnore,
      createQueryBuilder: insertOrIgnoreBuilder(insertOrIgnore, builderCalls),
      update: jest.fn(async (where: Partial<DeliveryRow>, patch: Partial<DeliveryRow>) => {
        let affected = 0;
        for (const row of rows) {
          if (row.collaborationRunId === where.collaborationRunId && (!where.status || row.status === where.status)) {
            Object.assign(row, patch);
            affected += 1;
          }
        }
        return { affected };
      }),
      find: jest.fn(async ({ where, take }: { where: Partial<DeliveryRow>; take?: number }) =>
        rows
          .filter((row) => row.linkId === where.linkId && row.status === where.status)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, take ?? Infinity)
          .map((row) => ({ ...row })),
      ),
    };
    auditRepo = {
      insert: jest.fn(async (row: AuditRow) => audit.push(row)),
      find: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        audit.filter((row) => matchesWhere(row as unknown as Record<string, unknown>, where)).map((row) => ({ subjectId: row.subjectId })),
      ),
    };
    service = new ChatRunService(
      starts as never,
      orchestration as never,
      delivery as never,
      deliveries as never,
      auditRepo as never,
    );
    logs = [];
    restoreLogs = watchLogs(logs);
  });

  afterEach(() => {
    restoreLogs();
    // Acceptance 6: no task text in any log line or audit row.
    expect(logs.join('\n')).not.toContain(MARKER);
    expect(JSON.stringify(audit)).not.toContain(MARKER);
    if (original === undefined) delete process.env.GLOBAL_EXECUTION_ENABLED;
    else process.env.GLOBAL_EXECUTION_ENABLED = original;
  });

  describe('/ask starts a run as the owner', () => {
    it('Chief of Staff: the page body without a sessionId, the session identity, the first step approved by the owner', async () => {
      const reply = await service.ask(link, { text: `${MARKER} plan my week` });
      expect(reply).toEqual({ text: chatReply('en', 'ask.started') });

      expect(starts.readStartBody).toHaveBeenCalledWith({ team: 'chief-of-staff', task: `${MARKER} plan my week` });
      expect(starts.start).toHaveBeenCalledWith(
        { userId: OWNER, apiKeyId: 'browser-session', scopes: ['ai:execute'], isInternal: true, harnessEntitled: true },
        { task: `${MARKER} plan my week`, teamId: 'chief-of-staff' },
      );
      expect(starts.start.mock.calls[0][1]).not.toHaveProperty('sessionId');
      expect(starts.approveStep).toHaveBeenCalledWith({
        collaborationRunId: RUN_ID,
        referralId: REFERRAL_ID,
        decidedBy: OWNER,
        approveWithoutPassingTests: false,
      });
      // The delivery row is written before the approval and holds ids only.
      expect(deliveries.insertOrIgnore.mock.invocationCallOrder[0]).toBeLessThan(
        starts.approveStep.mock.invocationCallOrder[0],
      );
      // CHAT-RESULTS-OTHER-01: insert-or-ignore into chat_run_deliveries.
      expect(builderCalls).toEqual(['into:ChatRunDelivery']);
      // CHAT-STATE-PERSIST-01: /ask marks its row as started from the chat.
      expect(rows).toEqual([
        {
          collaborationRunId: RUN_ID,
          linkId: LINK_ID,
          status: 'waiting',
          notifiedReferralIds: [],
          createdAt: expect.any(Date),
          deliveredAt: null,
          origin: 'chat',
        },
      ]);
      expect(audit).toEqual([
        {
          category: 'chat',
          eventType: 'run_started',
          subjectType: 'collaboration_run',
          subjectId: RUN_ID,
          userId: OWNER,
          payload: { channel: 'discord', linkId: LINK_ID, collaborationRunId: RUN_ID, target: 'chief-of-staff' },
          occurredAt: expect.any(Date),
        },
      ]);
      expect(delivery.wake).toHaveBeenCalledTimes(1);
      expect(orchestration.cancelCollaboration).not.toHaveBeenCalled();
      expect(logs).toContain(`chat run started linkId=${LINK_ID} runId=${RUN_ID} target=chief-of-staff`);
    });

    it('a named workflow (agent option, case and spaces ignored) starts that workflow', async () => {
      await service.ask({ ...link, locale: 'zh-CN' }, { text: MARKER, agent: '  sales   DIGEST ' });
      expect(starts.readStartBody).toHaveBeenCalledWith({ workflowId: WORKFLOW_A, task: MARKER });
      expect(audit[0].payload).toEqual({
        channel: 'discord',
        linkId: LINK_ID,
        collaborationRunId: RUN_ID,
        target: 'workflow',
        workflowId: WORKFLOW_A,
      });
    });

    it('a leading @name picks the longest matching workflow name', async () => {
      starts.listOwnerWorkflows.mockResolvedValue([
        { id: WORKFLOW_A, name: 'Sales', status: 'active' },
        { id: WORKFLOW_B, name: 'Sales Digest', status: 'active' },
      ]);
      await service.ask(link, { text: `@sales digest ${MARKER}` });
      expect(starts.readStartBody).toHaveBeenLastCalledWith({ workflowId: WORKFLOW_B, task: ` ${MARKER}` });
      await service.ask(link, { text: `@Sales ${MARKER}` });
      expect(starts.readStartBody).toHaveBeenLastCalledWith({ workflowId: WORKFLOW_A, task: ` ${MARKER}` });
    });

    it('a workflow that is off is still resolved; the start refuses it with the page code', async () => {
      starts.start.mockRejectedValueOnce(workflowRefusal(WORKFLOW_REFUSAL_CODES.disabled));
      const reply = await service.ask(link, { text: MARKER, agent: 'Draft Writer' });
      expect(reply).toEqual({ text: chatReply('en', 'ask.workflowOff') });
      expect(rows).toEqual([]);
      expect(audit.map((row) => [row.eventType, row.payload.reason, row.payload.stage])).toEqual([
        ['run_refused', 'workflow_off', 'start'],
      ]);
    });
  });

  describe('refusals before anything is created', () => {
    function expectNothingCreated(): void {
      expect(starts.start).not.toHaveBeenCalled();
      expect(starts.approveStep).not.toHaveBeenCalled();
      expect(rows).toEqual([]);
      expect(delivery.wake).not.toHaveBeenCalled();
    }

    it('runs switched off', async () => {
      process.env.GLOBAL_EXECUTION_ENABLED = 'false';
      expect(await service.ask({ ...link, locale: 'zh-TW' }, { text: MARKER })).toEqual({
        text: chatReply('zh-TW', 'ask.runsOff'),
      });
      expectNothingCreated();
      expect(audit).toEqual([
        expect.objectContaining({
          eventType: 'run_refused',
          subjectType: 'chat_link',
          subjectId: LINK_ID,
          payload: { channel: 'discord', linkId: LINK_ID, reason: 'runs_off', stage: 'precheck' },
        }),
      ]);
    });

    it('an inactive or no longer entitled owner (one audit row, the fixed refusal)', async () => {
      expect(await service.refuseOwner(link, 'inactive')).toEqual({ text: chatReply('en', 'notEntitled') });
      expect(await service.refuseOwner(link, 'not_entitled')).toEqual({ text: chatReply('en', 'notEntitled') });
      expectNothingCreated();
      expect(audit.map((row) => row.payload.reason)).toEqual(['inactive', 'not_entitled']);
    });

    it('more than 10 a minute per owner', async () => {
      for (let i = 0; i < CHAT_RUN_LIMITS.commandsPerMinute; i += 1) {
        rows.length = 0;
        await service.ask(link, { text: MARKER });
      }
      rows.length = 0;
      starts.start.mockClear();
      expect(await service.ask(link, { text: MARKER })).toEqual({ text: chatReply('en', 'ask.tooMany') });
      expect(starts.start).not.toHaveBeenCalled();
      expect(audit[audit.length - 1].payload.reason).toBe('rate_limited');
    });

    it('3 Discord runs already in progress', async () => {
      for (let i = 0; i < 3; i += 1) {
        await service.ask(link, { text: MARKER });
      }
      expect(rows).toHaveLength(3);
      starts.start.mockClear();
      expect(await service.ask(link, { text: MARKER })).toEqual({ text: chatReply('en', 'ask.tooManyRuns') });
      expect(starts.start).not.toHaveBeenCalled();
    });

    it('an unknown, ambiguous or missing agent lists only the switched-on names', async () => {
      const unknown = await service.ask(link, { text: MARKER, agent: 'Nobody' });
      expect(unknown).toEqual({ text: chatReply('en', 'ask.unknownAgent', { names: 'Sales Digest' }) });
      expect(unknown.text).not.toContain('Draft Writer');

      starts.listOwnerWorkflows.mockResolvedValue([
        { id: WORKFLOW_A, name: 'Twin', status: 'active' },
        { id: WORKFLOW_B, name: 'twin', status: 'active' },
      ]);
      expect(await service.ask(link, { text: MARKER, agent: 'TWIN' })).toEqual({
        text: chatReply('en', 'ask.ambiguousAgent', { names: 'Twin, twin' }),
      });

      starts.listOwnerWorkflows.mockResolvedValue([]);
      expect(await service.ask(link, { text: `@Ghost ${MARKER}` })).toEqual({ text: chatReply('en', 'ask.noAgents') });
      expectNothingCreated();
      expect(audit.map((row) => row.payload.reason)).toEqual(['unknown_agent', 'ambiguous_agent', 'no_agents']);
    });

    it('an empty text', async () => {
      expect(await service.ask(link, { text: '   ' })).toEqual({ text: chatReply('en', 'ask.badTask') });
      expect(await service.ask(link, {})).toEqual({ text: chatReply('en', 'ask.badTask') });
      expectNothingCreated();
    });
  });

  describe('refusals after the run exists: the run is cancelled (acceptance 4)', () => {
    it.each([
      ['provider_off', new ServiceUnavailableException('Provider anthropic temporarily unavailable'), 'ask.providerOff'],
      ['no_credits', new HttpException({ statusCode: 402, message: 'Insufficient credit balance' }, 402), 'ask.noCredits'],
      ['over_cap', new HttpException({ statusCode: 429, message: 'Daily credit limit reached' }, 429), 'ask.overCap'],
      ['runs_off', new ServiceUnavailableException('AI execution temporarily disabled for maintenance'), 'ask.runsOff'],
    ] as const)('%s', async (reason, error, key) => {
      starts.approveStep.mockRejectedValueOnce(error);
      const reply = await service.ask({ ...link, locale: 'zh-TW' }, { text: MARKER });
      expect(reply).toEqual({ text: chatReply('zh-TW', key) });
      expect(orchestration.cancelCollaboration).toHaveBeenCalledWith({
        collaborationRunId: RUN_ID,
        cancelledByUserId: OWNER,
        cancelReason: `chat_refused:${reason}`,
      });
      expect(rows).toEqual([expect.objectContaining({ collaborationRunId: RUN_ID, status: 'dropped' })]);
      expect(audit.map((row) => row.eventType)).toEqual(['run_refused']);
      expect(audit[0].payload).toEqual({
        channel: 'discord',
        linkId: LINK_ID,
        reason,
        stage: 'approve',
        collaborationRunId: RUN_ID,
      });
      expect(delivery.wake).not.toHaveBeenCalled();
    });

    it('the delivery row cannot be written: the run is cancelled and nothing is approved', async () => {
      deliveries.insertOrIgnore.mockRejectedValueOnce(new Error(`db said ${MARKER}`));
      expect(await service.ask(link, { text: MARKER })).toEqual({ text: chatReply('en', 'error') });
      expect(orchestration.cancelCollaboration).toHaveBeenCalledWith(
        expect.objectContaining({ collaborationRunId: RUN_ID, cancelReason: 'chat_refused:delivery_row' }),
      );
      expect(starts.approveStep).not.toHaveBeenCalled();
    });
  });

  describe('CHAT-RESULTS-OTHER-01: every run the owner starts gets one delivery row', () => {
    const PLATFORM_RUN = 'platform-run-1';
    const originalSwitch = process.env.CHAT_DISCORD_ENABLED;
    let notifier: CollaborationRunStartedNotifier;
    let linkRows: Array<{ id: string; userId: string; channel: string; externalUserId: string }>;
    let users: Map<string, { id: string; isActive: boolean }>;
    let linksRepo: { findOne: jest.Mock };
    let usersRepo: { findOne: jest.Mock };
    let listening: ChatRunService;

    beforeEach(() => {
      process.env.CHAT_DISCORD_ENABLED = 'true';
      notifier = new CollaborationRunStartedNotifier();
      linkRows = [{ id: LINK_ID, userId: OWNER, channel: 'discord', externalUserId: '987654321098765432' }];
      users = new Map([[OWNER, { id: OWNER, isActive: true }]]);
      linksRepo = {
        findOne: jest.fn(async ({ where }: { where: { userId: string; channel: string } }) =>
          linkRows.find((row) => row.userId === where.userId && row.channel === where.channel) ?? null,
        ),
      };
      usersRepo = { findOne: jest.fn(async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null) };
      listening = new ChatRunService(
        starts as never,
        orchestration as never,
        delivery as never,
        deliveries as never,
        auditRepo as never,
        linksRepo as never,
        usersRepo as never,
        notifier,
      );
    });

    afterEach(() => {
      listening.onModuleDestroy();
      if (originalSwitch === undefined) delete process.env.CHAT_DISCORD_ENABLED;
      else process.env.CHAT_DISCORD_ENABLED = originalSwitch;
    });

    /** What CollaborationStartService.start does once the run and its first hand-off exist; waits for the listener here. */
    async function startedElsewhere(runId = PLATFORM_RUN, userId = OWNER): Promise<void> {
      const spy = jest.spyOn(listening, 'onRunStarted');
      notifier.notify({ collaborationRunId: runId, userId });
      await Promise.all(spy.mock.results.map((result) => result.value));
      spy.mockRestore();
    }

    it('a run started elsewhere (Team page, schedule, trigger): one waiting row with ids only, and the delivery wakes', async () => {
      await startedElsewhere();
      expect(rows).toEqual([
        {
          collaborationRunId: PLATFORM_RUN,
          linkId: LINK_ID,
          status: 'waiting',
          notifiedReferralIds: [],
          createdAt: expect.any(Date),
          deliveredAt: null,
        },
      ]);
      expect(builderCalls).toEqual(['into:ChatRunDelivery']);
      expect(delivery.wake).toHaveBeenCalledTimes(1);
      expect(audit).toEqual([]);
      expect(logs).toContain(`chat run delivery row runId=${PLATFORM_RUN} linkId=${LINK_ID}`);
      // The same start told twice still gives one row.
      await startedElsewhere();
      expect(rows).toHaveLength(1);
    });

    it('no link, an inactive or missing owner, or the switch off: no row and no wake', async () => {
      linkRows = [];
      await startedElsewhere('run-no-link');
      linkRows = [{ id: LINK_ID, userId: OWNER, channel: 'other', externalUserId: '1' }];
      await startedElsewhere('run-other-channel');
      linkRows = [{ id: LINK_ID, userId: OWNER, channel: 'discord', externalUserId: '1' }];
      users.set(OWNER, { id: OWNER, isActive: false });
      await startedElsewhere('run-inactive');
      users.delete(OWNER);
      await startedElsewhere('run-no-owner');
      users.set(OWNER, { id: OWNER, isActive: true });
      process.env.CHAT_DISCORD_ENABLED = 'false';
      linksRepo.findOne.mockClear();
      await startedElsewhere('run-switch-off');
      expect(linksRepo.findOne).not.toHaveBeenCalled();
      expect(rows).toEqual([]);
      expect(delivery.wake).not.toHaveBeenCalled();
    });

    it('without the link and user repositories the listener does nothing', async () => {
      const bare = new ChatRunService(
        starts as never,
        orchestration as never,
        delivery as never,
        deliveries as never,
        auditRepo as never,
      );
      expect(await bare.onRunStarted({ collaborationRunId: PLATFORM_RUN, userId: OWNER })).toBe(false);
      expect(rows).toEqual([]);
    });

    it('an insert or read that fails is logged with ids and a reason code only, and never throws', async () => {
      deliveries.insertOrIgnore.mockRejectedValueOnce(new Error(`db said ${MARKER} 987654321098765432`));
      await expect(listening.onRunStarted({ collaborationRunId: PLATFORM_RUN, userId: OWNER })).resolves.toBe(false);
      expect(logs).toContain(`chat run delivery row failed runId=${PLATFORM_RUN} linkId=${LINK_ID} reason=Error`);
      linksRepo.findOne.mockRejectedValueOnce(new Error(`db said ${MARKER}`));
      await expect(listening.onRunStarted({ collaborationRunId: PLATFORM_RUN, userId: OWNER })).resolves.toBe(false);
      expect(logs).toContain(`chat run started listener failed runId=${PLATFORM_RUN} reason=Error`);
      expect(rows).toEqual([]);
      expect(delivery.wake).not.toHaveBeenCalled();
      expect(logs.join('\n')).not.toContain('987654321098765432');
    });

    it('/ask: the listener inserts first, /ask’s own insert is ignored: exactly one row', async () => {
      starts.start.mockImplementationOnce(async () => {
        // The start's notify fires before start returns; here the listener finishes first.
        await listening.onRunStarted({ collaborationRunId: RUN_ID, userId: OWNER });
        return { collaborationRunId: RUN_ID, referralId: REFERRAL_ID };
      });
      expect(await listening.ask(link, { text: MARKER })).toEqual({ text: chatReply('en', 'ask.started') });
      expect(deliveries.insertOrIgnore).toHaveBeenCalledTimes(2);
      // CHAT-STATE-PERSIST-01: the listener's insert names no origin; /ask then marks the row 'chat'.
      expect(deliveries.insertOrIgnore.mock.calls[0][0]).not.toHaveProperty('origin');
      expect(deliveries.insertOrIgnore.mock.calls[1][0]).toMatchObject({ origin: 'chat' });
      expect(rows).toEqual([
        expect.objectContaining({ collaborationRunId: RUN_ID, linkId: LINK_ID, status: 'waiting', origin: 'chat' }),
      ]);
      expect(starts.approveStep).toHaveBeenCalledTimes(1);
      expect(orchestration.cancelCollaboration).not.toHaveBeenCalled();
    });

    it('/ask: /ask inserts first, the listener’s insert is ignored and never resets the row', async () => {
      starts.approveStep.mockRejectedValueOnce(new ServiceUnavailableException('Provider anthropic temporarily unavailable'));
      await listening.ask(link, { text: MARKER });
      expect(rows).toEqual([expect.objectContaining({ collaborationRunId: RUN_ID, status: 'dropped' })]);
      // The start's listener lands late.
      expect(await listening.onRunStarted({ collaborationRunId: RUN_ID, userId: OWNER })).toBe(true);
      expect(rows).toEqual([expect.objectContaining({ collaborationRunId: RUN_ID, status: 'dropped' })]);
    });

    it('rows of runs started elsewhere do not count for the /ask limit, /cancel or /status', async () => {
      for (const runId of ['p1', 'p2', 'p3', 'p4']) {
        await startedElsewhere(runId);
      }
      expect(rows).toHaveLength(4);
      // The limit counts only Discord-started runs: /ask still starts.
      expect(await listening.ask(link, { text: MARKER })).toEqual({ text: chatReply('en', 'ask.started') });
      starts.cancelOwnedActiveRun.mockImplementation(async (runId: string) => ({ collaborationRunId: runId, status: 'cancelled' }));
      expect(await listening.cancel(link)).toEqual({ text: chatReply('en', 'cancel.done') });
      expect(starts.cancelOwnedActiveRun.mock.calls.map((call) => call[0])).toEqual([RUN_ID]);
      expect(rows.filter((row) => row.status === 'waiting').map((row) => row.collaborationRunId)).toEqual([
        'p1',
        'p2',
        'p3',
        'p4',
      ]);
      orchestration.getCollaborationRun.mockResolvedValue({ userId: OWNER, status: 'active', referralIds: [] });
      expect(await listening.statusCounts(link)).toEqual({ running: 0, waiting: 0 });
      expect(await listening.cancel(link)).toEqual({ text: chatReply('en', 'cancel.nothing') });
    });

    it('CHAT-STATE-PERSIST-01: the listener names no origin, so the database default (platform) is stored', async () => {
      await startedElsewhere();
      expect(deliveries.insertOrIgnore).toHaveBeenCalledTimes(1);
      expect(deliveries.insertOrIgnore.mock.calls[0][0]).not.toHaveProperty('origin');
      expect(deliveries.update).not.toHaveBeenCalled();
    });

    it('CHAT-STATE-PERSIST-01: the /ask limit, /cancel and /status read origin; only rows without one use the audit rows', async () => {
      const at = (minutes: number) => new Date(Date.parse('2026-11-19T10:00:00.000Z') + minutes * 60 * 1000);
      const row = (collaborationRunId: string, origin: string | null, minutes: number): DeliveryRow => ({
        collaborationRunId,
        linkId: LINK_ID,
        status: 'waiting',
        notifiedReferralIds: [],
        createdAt: at(minutes),
        deliveredAt: null,
        origin,
      });
      // Rows of runs started elsewhere (the column default), a /ask row, and two rows from before migration 1817.
      rows.push(row('p1', 'platform', 1), row('p2', 'platform', 2), row('p3', 'platform', 3));
      rows.push(row('chat-new', 'chat', 4), row('legacy-ask', null, 5), row('legacy-page', null, 6));
      // Only the legacy /ask run has its run_started audit row.
      audit.push({
        category: 'chat',
        eventType: 'run_started',
        subjectType: 'collaboration_run',
        subjectId: 'legacy-ask',
        userId: OWNER,
        payload: {},
      });
      orchestration.getCollaborationRun.mockResolvedValue({ userId: OWNER, status: 'active', referralIds: [] });
      expect(await listening.statusCounts(link)).toEqual({ running: 2, waiting: 0 });
      expect(orchestration.getCollaborationRun.mock.calls.map((call) => call[0])).toEqual(['legacy-ask', 'chat-new']);
      // The audit read covers the rows without an origin only.
      const read = auditRepo.find.mock.calls[0][0] as { where: { subjectId: { value: string[] } } };
      expect(read.where.subjectId.value).toEqual(['legacy-page', 'legacy-ask']);

      // Two Discord runs in progress plus one more makes three: the next /ask is refused.
      expect(await listening.ask(link, { text: MARKER })).toEqual({ text: chatReply('en', 'ask.started') });
      expect(await listening.ask(link, { text: MARKER })).toEqual({ text: chatReply('en', 'ask.tooManyRuns') });

      // With only marked rows nothing is read from the audit rows.
      rows.splice(0, rows.length, row('p1', 'platform', 1), row('chat-new', 'chat', 2));
      auditRepo.find.mockClear();
      starts.cancelOwnedActiveRun.mockImplementation(async (runId: string) => ({ collaborationRunId: runId, status: 'cancelled' }));
      expect(await listening.cancel(link)).toEqual({ text: chatReply('en', 'cancel.done') });
      expect(starts.cancelOwnedActiveRun.mock.calls.map((call) => call[0])).toEqual(['chat-new']);
      expect(auditRepo.find).not.toHaveBeenCalled();
    });

    it('stops listening on module destroy', async () => {
      listening.onModuleDestroy();
      notifier.notify({ collaborationRunId: PLATFORM_RUN, userId: OWNER });
      await new Promise((resolve) => setImmediate(resolve));
      expect(linksRepo.findOne).not.toHaveBeenCalled();
      expect(rows).toEqual([]);
    });
  });

  it('maps refusals by status, code and the platform message only', () => {
    expect(chatRunRefusalOf(new Error('x'))).toBe('refused');
    expect(chatRunRefusalOf(workflowRefusal(WORKFLOW_REFUSAL_CODES.notTested))).toBe('workflow_not_tested');
    expect(chatRunRefusalOf(workflowRefusal(WORKFLOW_REFUSAL_CODES.invalid))).toBe('workflow_invalid');
    expect(chatRunRefusalOf(workflowRefusal(WORKFLOW_REFUSAL_CODES.budgetDay))).toBe('workflow_budget');
    expect(chatRunRefusalOf(new ServiceUnavailableException('Token quota exceeded'))).toBe('over_cap');
    expect(chatRunRefusalOf(new ServiceUnavailableException('Insufficient credit balance'))).toBe('no_credits');
    expect(chatRunRefusalOf(new HttpException('Token quota exceeded', HttpStatus.TOO_MANY_REQUESTS))).toBe('over_cap');
    expect(chatRunRefusalOf(new BadRequestException('task must be at most 8000 characters'))).toBe('bad_task');
    expect(chatRunRefusalOf(new ServiceUnavailableException('Workflows are unavailable'))).toBe('refused');
  });

  describe('/cancel', () => {
    it('cancels the latest Discord run that is still active and drops its delivery', async () => {
      await service.ask(link, { text: MARKER });
      await new Promise((resolve) => setTimeout(resolve, 2));
      await service.ask(link, { text: MARKER });
      const latest = rows[1].collaborationRunId;
      starts.cancelOwnedActiveRun.mockImplementation(async (runId: string) =>
        runId === latest ? { collaborationRunId: runId, status: 'cancelled' } : null,
      );
      expect(await service.cancel(link)).toEqual({ text: chatReply('en', 'cancel.done') });
      expect(starts.cancelOwnedActiveRun).toHaveBeenCalledWith(latest, OWNER);
      expect(rows.find((row) => row.collaborationRunId === latest)?.status).toBe('dropped');
      expect(rows.find((row) => row.collaborationRunId !== latest)?.status).toBe('waiting');
    });

    it('nothing in progress', async () => {
      expect(await service.cancel(link)).toEqual({ text: chatReply('en', 'cancel.nothing') });
      await service.ask(link, { text: MARKER });
      expect(await service.cancel(link)).toEqual({ text: chatReply('en', 'cancel.nothing') });
      expect(rows[0].status).toBe('waiting');
    });
  });

  it('/status counts Discord runs in progress and their steps waiting for approval', async () => {
    await service.ask(link, { text: MARKER });
    await service.ask(link, { text: MARKER });
    orchestration.getCollaborationRun.mockImplementation(async (runId: string) =>
      runId === RUN_ID
        ? { userId: OWNER, status: 'active', referralIds: ['a', 'b'] }
        : { userId: OWNER, status: 'completed', referralIds: ['c'] },
    );
    orchestration.getReferral.mockImplementation(async (id: string) => ({
      status: id === 'b' ? 'pending_approval' : 'completed',
    }));
    expect(await service.statusCounts(link)).toEqual({ running: 1, waiting: 1 });
    orchestration.getCollaborationRun.mockResolvedValue({ userId: 'someone-else', status: 'active', referralIds: ['b'] });
    expect(await service.statusCounts(link)).toEqual({ running: 0, waiting: 0 });
  });
});

function watchLogs(logs: string[]): () => void {
  const methods = ['log', 'warn', 'error', 'debug', 'verbose'] as const;
  const spies = methods.map((method) =>
    jest.spyOn(Logger.prototype, method).mockImplementation((...args: unknown[]) => {
      logs.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
    }),
  );
  return () => spies.forEach((spy) => spy.mockRestore());
}
