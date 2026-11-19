import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { FindOperator } from 'typeorm';
import { ChatRunDelivery } from '../entities/chat-run-delivery.entity';
import { CollaborationRunStartedNotifier } from '../orchestration/collaboration-start.service';
import { workflowRefusal, WORKFLOW_REFUSAL_CODES } from '../orchestration/collaboration-workflow';
import { chatReply } from './chat-replies';
import { ChatLimits, MemoryChatLimitStore } from './chat-limits';
import { CHAT_RUN_LIMITS, ChatRunService, chatRunRefusalOf, chatUnlinkedReplySubject } from './chat-run.service';
import { ChatCommandService } from './chat-commands';

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
      // CHAT-TIDY-01: the delivery row is written only after the first step is approved
      // (so no delivery pass can announce it) and holds ids only.
      expect(deliveries.insertOrIgnore.mock.invocationCallOrder[0]).toBeGreaterThan(
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

    it('CHAT-TIDY-01: more than 10 a minute per owner (takeCommandLimit); over it refuseRateLimited writes the audit row; ask and cancel no longer count', async () => {
      for (let i = 0; i < CHAT_RUN_LIMITS.commandsPerMinute; i += 1) {
        expect(await service.takeCommandLimit(link)).toBe(true);
      }
      expect(await service.takeCommandLimit(link)).toBe(false);
      expect(await service.refuseRateLimited(link)).toEqual({ text: chatReply('en', 'ask.tooMany') });
      expect(audit[audit.length - 1].payload).toEqual({
        channel: 'discord',
        linkId: LINK_ID,
        reason: 'rate_limited',
        stage: 'precheck',
      });
      // ask and cancel themselves never take the limit (ChatCommandService took it once).
      starts.start.mockClear();
      expect(await service.ask(link, { text: MARKER })).toEqual({ text: chatReply('en', 'ask.started') });
      expect(await service.cancel(link)).toEqual({ text: chatReply('en', 'cancel.nothing') });
      expect(starts.start).toHaveBeenCalledTimes(1);
    });

    it('CHAT-TIDY-01: an unlinked author: 3 replies a minute per author, subject SHA-256 of "unlinked:" and the id', async () => {
      const limitRows = new MemoryChatLimitStore();
      const counted = new ChatRunService(
        starts as never,
        orchestration as never,
        delivery as never,
        deliveries as never,
        auditRepo as never,
        undefined,
        undefined,
        undefined,
        ChatLimits.inMemory(limitRows),
      );
      const author = '123456789012345678';
      const results = [];
      for (let i = 0; i < 5; i += 1) results.push(await counted.takeUnlinkedReply(author));
      expect(results).toEqual([true, true, true, false, false]);
      expect(await counted.takeUnlinkedReply('223456789012345678')).toBe(true);
      const subject = createHash('sha256').update(`unlinked:${author}`).digest('hex');
      expect(chatUnlinkedReplySubject(author)).toBe(subject);
      expect(subject).toHaveLength(64);
      expect(limitRows.rows.filter((row) => row.subjectKey === subject)).toHaveLength(3);
      expect(limitRows.rows.every((row) => row.bucket === 'command')).toBe(true);
      expect(JSON.stringify(limitRows.rows)).not.toContain(author);
      // A store error: null, nothing logged here.
      const broken = new ChatRunService(
        starts as never,
        orchestration as never,
        delivery as never,
        deliveries as never,
        auditRepo as never,
        undefined,
        undefined,
        undefined,
        ChatLimits.inMemory({
          locked: async () => {
            throw new Error('db down');
          },
          times: async () => [],
          pruneUpTo: async () => 0,
        }),
      );
      expect(await broken.takeUnlinkedReply(author)).toBeNull();
      expect(logs.join('\n')).not.toContain(author);
    });

    it('CHAT-STATE-PERSIST-01: the 10-a-minute limit survives a restart (a new service over the same limit rows)', async () => {
      const limitRows = new MemoryChatLimitStore();
      const instance = () =>
        new ChatRunService(
          starts as never,
          orchestration as never,
          delivery as never,
          deliveries as never,
          auditRepo as never,
          undefined,
          undefined,
          undefined,
          ChatLimits.inMemory(limitRows),
        );
      let current = instance();
      for (let i = 0; i < CHAT_RUN_LIMITS.commandsPerMinute; i += 1) {
        if (i === 5) current = instance();
        expect(await current.takeCommandLimit(link)).toBe(true);
      }
      current = instance();
      expect(await current.takeCommandLimit(link)).toBe(false);
      expect(limitRows.rows.map((row) => [row.bucket, row.subjectKey])).toEqual(
        Array.from({ length: CHAT_RUN_LIMITS.commandsPerMinute }, () => ['command', OWNER]),
      );
    });

    it('CHAT-STATE-PERSIST-01: a limit store error gives null (the caller answers the error line) and is logged with a reason code', async () => {
      const broken = {
        locked: async () => {
          throw new Error(`db down ${MARKER}`);
        },
        times: async () => [],
        pruneUpTo: async () => 0,
      };
      const failing = new ChatRunService(
        starts as never,
        orchestration as never,
        delivery as never,
        deliveries as never,
        auditRepo as never,
        undefined,
        undefined,
        undefined,
        ChatLimits.inMemory(broken),
      );
      expect(await failing.takeCommandLimit(link)).toBeNull();
      expectNothingCreated();
      expect(starts.cancelOwnedActiveRun).not.toHaveBeenCalled();
      expect(logs).toContain(`chat run limit store failed linkId=${LINK_ID} reason=Error`);
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

    it('CHAT-TIDY-01: the delivery row cannot be written after the approval: the run is cancelled and the error line answers', async () => {
      deliveries.insertOrIgnore.mockRejectedValueOnce(new Error(`db said ${MARKER}`));
      expect(await service.ask(link, { text: MARKER })).toEqual({ text: chatReply('en', 'error') });
      expect(starts.approveStep).toHaveBeenCalledTimes(1);
      expect(orchestration.cancelCollaboration).toHaveBeenCalledWith(
        expect.objectContaining({ collaborationRunId: RUN_ID, cancelReason: 'chat_refused:delivery_row' }),
      );
      expect(audit.filter((row) => row.eventType === 'run_started')).toEqual([]);
      expect(delivery.wake).not.toHaveBeenCalled();
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

    it('CHAT-TIDY-01: /ask: the start’s listener fires inside the start and waits for /ask; no row exists until the first step is approved', async () => {
      let listener: Promise<boolean> | null = null;
      let rowsDuringApproval: DeliveryRow[] | null = null;
      starts.start.mockImplementationOnce(async () => {
        // What CollaborationStartService.start does: notify (never awaited) before it returns.
        const spy = jest.spyOn(listening, 'onRunStarted');
        notifier.notify({ collaborationRunId: RUN_ID, userId: OWNER });
        listener = spy.mock.results[0].value as Promise<boolean>;
        spy.mockRestore();
        // Let the listener run as far as it can before /ask goes on.
        await new Promise((resolve) => setImmediate(resolve));
        return { collaborationRunId: RUN_ID, referralId: REFERRAL_ID };
      });
      starts.approveStep.mockImplementationOnce(async () => {
        await new Promise((resolve) => setImmediate(resolve));
        rowsDuringApproval = rows.map((row) => ({ ...row }));
        return { referral: { referralId: REFERRAL_ID }, executionId: 'x' };
      });
      expect(await listening.ask(link, { text: MARKER })).toEqual({ text: chatReply('en', 'ask.started') });
      // Nothing a delivery pass could read existed while the first step waited.
      expect(rowsDuringApproval).toEqual([]);
      expect(listener).not.toBeNull();
      // The listener waited for /ask: /ask's insert (origin chat) came first, the listener's was ignored.
      expect(await listener).toBe(true);
      expect(deliveries.insertOrIgnore).toHaveBeenCalledTimes(2);
      expect(deliveries.insertOrIgnore.mock.calls[0][0]).toMatchObject({ origin: 'chat', status: 'waiting' });
      expect(deliveries.insertOrIgnore.mock.calls[1][0]).not.toHaveProperty('origin');
      expect(deliveries.insertOrIgnore.mock.invocationCallOrder[0]).toBeGreaterThan(starts.approveStep.mock.invocationCallOrder[0]);
      expect(rows).toEqual([
        expect.objectContaining({ collaborationRunId: RUN_ID, linkId: LINK_ID, status: 'waiting', origin: 'chat' }),
      ]);
      expect(starts.approveStep).toHaveBeenCalledTimes(1);
      expect(orchestration.cancelCollaboration).not.toHaveBeenCalled();
    });

    it('CHAT-TIDY-01: when /ask cannot write its row the run is cancelled and the waiting listener adds none', async () => {
      deliveries.insertOrIgnore.mockRejectedValueOnce(new Error(`db said ${MARKER}`));
      let listener: Promise<boolean> | null = null;
      starts.start.mockImplementationOnce(async () => {
        const spy = jest.spyOn(listening, 'onRunStarted');
        notifier.notify({ collaborationRunId: RUN_ID, userId: OWNER });
        listener = spy.mock.results[0].value as Promise<boolean>;
        spy.mockRestore();
        return { collaborationRunId: RUN_ID, referralId: REFERRAL_ID };
      });
      expect(await listening.ask(link, { text: MARKER })).toEqual({ text: chatReply('en', 'error') });
      expect(await listener).toBe(false);
      expect(rows).toEqual([]);
      expect(orchestration.cancelCollaboration).toHaveBeenCalledWith(
        expect.objectContaining({ collaborationRunId: RUN_ID, cancelReason: 'chat_refused:delivery_row' }),
      );
    });

    it('CHAT-TIDY-01: while an /ask is in flight, another run of the same owner (Team page) still gets its row once /ask is done', async () => {
      let release: () => void = () => undefined;
      starts.approveStep.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ referral: { referralId: REFERRAL_ID }, executionId: 'x' });
          }),
      );
      const asking = listening.ask(link, { text: MARKER });
      await new Promise((resolve) => setImmediate(resolve));
      const spy = jest.spyOn(listening, 'onRunStarted');
      notifier.notify({ collaborationRunId: PLATFORM_RUN, userId: OWNER });
      const other = spy.mock.results[0].value as Promise<boolean>;
      spy.mockRestore();
      await new Promise((resolve) => setImmediate(resolve));
      expect(rows).toEqual([]);
      release();
      await asking;
      expect(await other).toBe(true);
      expect(rows.map((row) => [row.collaborationRunId, row.origin ?? 'platform'])).toEqual([
        [RUN_ID, 'chat'],
        [PLATFORM_RUN, 'platform'],
      ]);
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

  describe('CHAT-DISCORD-DM-01: a plain direct message runs exactly the /ask path', () => {
    const DISCORD_ID = '987654321098765432';
    const originalChat = process.env.CHAT_DISCORD_ENABLED;
    let commands: ChatCommandService;

    beforeEach(() => {
      process.env.CHAT_DISCORD_ENABLED = 'true';
      const links = { useLinkByExternalUser: jest.fn(async () => ({ ...link })) };
      const entitlements = { resolveHarnessEntitled: jest.fn(async () => true) };
      const users = { findOne: jest.fn(async () => ({ id: OWNER, isActive: true })) };
      commands = new ChatCommandService(links as never, entitlements as never, users as never, service);
    });

    afterEach(() => {
      if (originalChat === undefined) delete process.env.CHAT_DISCORD_ENABLED;
      else process.env.CHAT_DISCORD_ENABLED = originalChat;
      expect(logs.join('\n')).not.toContain(DISCORD_ID);
    });

    function slashAsk(text: string): Promise<unknown> {
      return commands.handle({
        channel: 'discord',
        command: 'ask',
        options: { text },
        externalUserId: DISCORD_ID,
        displayName: null,
        locale: 'en-US',
        directMessage: true,
        ref: {},
      });
    }

    function plain(text: string): Promise<unknown> {
      return commands.handleMessage({ channel: 'discord', text, externalUserId: DISCORD_ID, ref: {} });
    }

    /** One run's trace with its run id replaced, to compare a /ask run with a plain-message run. */
    function trace(runId: string, index: number) {
      const swap = (value: unknown) => JSON.parse(JSON.stringify(value).split(runId).join('RUN'));
      return {
        readStartBody: starts.readStartBody.mock.calls[index],
        start: starts.start.mock.calls[index],
        approveStep: swap(starts.approveStep.mock.calls[index]),
        row: swap({ ...rows.find((row) => row.collaborationRunId === runId), createdAt: 'x' }),
        audit: swap(audit.filter((row) => row.subjectId === runId).map((row) => ({ ...row, occurredAt: 'x' }))),
      };
    }

    it('same task text, same target, same audit row and the delivery row with origin chat', async () => {
      expect(await slashAsk(`${MARKER} plan my week`)).toEqual({ text: chatReply('en', 'ask.started') });
      expect(await plain(`${MARKER} plan my week`)).toEqual({ text: chatReply('en', 'ask.started') });
      expect(starts.start).toHaveBeenCalledTimes(2);
      const viaAsk = trace(RUN_ID, 0);
      const viaMessage = trace(`${RUN_ID}-2`, 1);
      expect(viaMessage).toEqual(viaAsk);
      expect(viaMessage.readStartBody).toEqual([{ team: 'chief-of-staff', task: `${MARKER} plan my week` }]);
      expect(viaMessage.row.origin).toBe('chat');
      expect(viaMessage.audit).toEqual([
        expect.objectContaining({
          category: 'chat',
          eventType: 'run_started',
          payload: { channel: 'discord', linkId: LINK_ID, collaborationRunId: 'RUN', target: 'chief-of-staff' },
        }),
      ]);
      expect(logs).toContain(`chat run started linkId=${LINK_ID} runId=${RUN_ID}-2 target=chief-of-staff`);
      expect(logs).toContain(`chat message outcome=handled linkId=${LINK_ID}`);
    });

    it('"@Name rest" picks the workflow, as /ask does', async () => {
      await plain(`@sales digest ${MARKER}`);
      expect(starts.readStartBody).toHaveBeenLastCalledWith({ workflowId: WORKFLOW_A, task: ` ${MARKER}` });
      expect(audit[0].payload).toEqual({
        channel: 'discord',
        linkId: LINK_ID,
        collaborationRunId: RUN_ID,
        target: 'workflow',
        workflowId: WORKFLOW_A,
      });
      // An unknown name is refused like /ask, listing the switched-on names only.
      expect(await plain(`@Nobody ${MARKER}`)).toEqual({
        text: chatReply('en', 'ask.unknownAgent', { names: 'Sales Digest' }),
      });
    });

    it('the 10-a-minute limit counts plain messages and /ask together', async () => {
      for (let i = 0; i < CHAT_RUN_LIMITS.commandsPerMinute; i += 1) {
        rows.length = 0;
        await (i % 2 === 0 ? slashAsk(MARKER) : plain(MARKER));
      }
      expect(starts.start).toHaveBeenCalledTimes(CHAT_RUN_LIMITS.commandsPerMinute);
      rows.length = 0;
      starts.start.mockClear();
      expect(await plain(MARKER)).toEqual({ text: chatReply('en', 'ask.tooMany') });
      expect(await slashAsk(MARKER)).toEqual({ text: chatReply('en', 'ask.tooMany') });
      expect(starts.start).not.toHaveBeenCalled();
      expect(audit.slice(-2).map((row) => row.payload.reason)).toEqual(['rate_limited', 'rate_limited']);
    });

    it('runs switched off: the same refusal and audit row as /ask, nothing created', async () => {
      process.env.GLOBAL_EXECUTION_ENABLED = 'false';
      expect(await plain(MARKER)).toEqual({ text: chatReply('en', 'ask.runsOff') });
      expect(starts.start).not.toHaveBeenCalled();
      expect(audit.map((row) => [row.eventType, row.payload.reason, row.payload.stage])).toEqual([
        ['run_refused', 'runs_off', 'precheck'],
      ]);
    });
  });

  describe('CHAT-TIDY-01: askableAgents (the /ask agent suggestions)', () => {
    it('the switched-on workflows /ask can run by name, filtered by the typed text (case-insensitive), at most 25', async () => {
      starts.listOwnerWorkflows.mockResolvedValue([
        { id: 'w1', name: 'Sales Digest', status: 'active' },
        { id: 'w2', name: 'Draft Writer', status: 'disabled' },
        { id: 'w3', name: '  Weekly   SALES  report ', status: 'active' },
        { id: 'w4', name: 'Twin', status: 'active' },
        { id: 'w5', name: 'twin', status: 'active' },
        { id: 'w6', name: 'x'.repeat(101), status: 'active' },
        { id: 'w7', name: '   ', status: 'active' },
        ...Array.from({ length: 40 }, (_, i) => ({ id: `m${i}`, name: `Many ${i}`, status: 'active' })),
      ]);
      // A name only one workflow has (as resolveTarget matches it), switched on, at most 100 characters.
      expect(await service.askableAgents(link, 'SAL')).toEqual([
        { name: 'Sales Digest', value: 'Sales Digest' },
        { name: 'Weekly SALES report', value: 'Weekly SALES report' },
      ]);
      expect(await service.askableAgents(link, '  sales   report ')).toEqual([
        { name: 'Weekly SALES report', value: 'Weekly SALES report' },
      ]);
      expect(await service.askableAgents(link, 'twin')).toEqual([]);
      expect(await service.askableAgents(link, 'draft')).toEqual([]);
      const all = await service.askableAgents(link, '');
      expect(all).toHaveLength(25);
      expect(all.slice(0, 2).map((choice) => choice.name)).toEqual(['Sales Digest', 'Weekly SALES report']);
      expect(starts.listOwnerWorkflows).toHaveBeenCalledWith(OWNER);
      // Each suggestion resolves as /ask resolves the agent option.
      starts.listOwnerWorkflows.mockResolvedValue([{ id: WORKFLOW_A, name: '  Weekly   SALES  report ', status: 'active' }]);
      const [choice] = await service.askableAgents(link, 'weekly');
      await service.ask(link, { text: MARKER, agent: choice.value });
      expect(starts.readStartBody).toHaveBeenLastCalledWith({ workflowId: WORKFLOW_A, task: MARKER });
    });

    it('a failing list gives none; nothing is counted, written or logged', async () => {
      starts.listOwnerWorkflows.mockRejectedValueOnce(new Error(`db said ${MARKER}`));
      logs.length = 0;
      expect(await service.askableAgents(link, 'sal')).toEqual([]);
      expect(await service.askableAgents(link, 'sal')).toEqual([{ name: 'Sales Digest', value: 'Sales Digest' }]);
      expect(logs).toEqual([]);
      expect(audit).toEqual([]);
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
