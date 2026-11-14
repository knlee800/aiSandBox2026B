import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
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
};

describe('ChatRunService (CHAT-DISCORD-01 C1)', () => {
  const original = process.env.GLOBAL_EXECUTION_ENABLED;
  const link = { linkId: LINK_ID, userId: OWNER, locale: 'en' as const };
  let rows: DeliveryRow[];
  let audit: Array<{ eventType: string; subjectType: string; subjectId: string; userId: string; payload: Record<string, unknown> }>;
  let starts: {
    readStartBody: jest.Mock;
    start: jest.Mock;
    approveStep: jest.Mock;
    cancelOwnedActiveRun: jest.Mock;
    listOwnerWorkflows: jest.Mock;
  };
  let orchestration: { cancelCollaboration: jest.Mock; getCollaborationRun: jest.Mock; getReferral: jest.Mock };
  let delivery: { wake: jest.Mock };
  let deliveries: { count: jest.Mock; insert: jest.Mock; update: jest.Mock; find: jest.Mock };
  let service: ChatRunService;
  let logs: string[];
  let restoreLogs: () => void;

  beforeEach(() => {
    process.env.GLOBAL_EXECUTION_ENABLED = 'true';
    rows = [];
    audit = [];
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
    deliveries = {
      count: jest.fn(async ({ where }: { where: Partial<DeliveryRow> }) =>
        rows.filter((row) => row.linkId === where.linkId && row.status === where.status).length,
      ),
      insert: jest.fn(async (row: DeliveryRow) => {
        rows.push({ ...row });
        return {};
      }),
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
      find: jest.fn(async ({ where }: { where: Partial<DeliveryRow> }) =>
        rows
          .filter((row) => row.linkId === where.linkId && row.status === where.status)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((row) => ({ ...row })),
      ),
    };
    service = new ChatRunService(
      starts as never,
      orchestration as never,
      delivery as never,
      deliveries as never,
      { insert: jest.fn(async (row: (typeof audit)[number]) => audit.push(row)) } as never,
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
      expect(deliveries.insert.mock.invocationCallOrder[0]).toBeLessThan(starts.approveStep.mock.invocationCallOrder[0]);
      expect(rows).toEqual([
        {
          collaborationRunId: RUN_ID,
          linkId: LINK_ID,
          status: 'waiting',
          notifiedReferralIds: [],
          createdAt: expect.any(Date),
          deliveredAt: null,
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
      deliveries.insert.mockRejectedValueOnce(new Error(`db said ${MARKER}`));
      expect(await service.ask(link, { text: MARKER })).toEqual({ text: chatReply('en', 'error') });
      expect(orchestration.cancelCollaboration).toHaveBeenCalledWith(
        expect.objectContaining({ collaborationRunId: RUN_ID, cancelReason: 'chat_refused:delivery_row' }),
      );
      expect(starts.approveStep).not.toHaveBeenCalled();
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
