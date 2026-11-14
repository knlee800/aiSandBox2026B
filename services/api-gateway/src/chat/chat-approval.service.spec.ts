import {
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MAIL_TOOL_ID } from '../connectors/connector-servers';
import { CollaborationStartService } from '../orchestration/collaboration-start.service';
import { TESTS_NOT_PASSED_CODE } from '../orchestration/collaboration-tests-gate';
import {
  CHAT_APPROVAL_CUSTOM_ID,
  CHAT_APPROVAL_LIMITS,
  ChatApprovalService,
  chatApprovalRefusalOf,
  chatStepIsReadOnly,
  cutApprovalRequest,
} from './chat-approval.service';
import { chatReply } from './chat-replies';
import type { ChatComponentPress, ChatReplyMessage } from './chat-transport';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER_OWNER = '99999999-9999-4999-8999-999999999999';
const LINK_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_LINK_ID = '33333333-3333-4333-8333-333333333333';
const DISCORD_ID = '987654321098765432';
const STRANGER = '123456789012345678';
const RUN_ID = '44444444-4444-4444-8444-444444444444';
const REFERRAL_ID = '55555555-5555-4555-8555-555555555555';
const WORKFLOW_ID = '66666666-6666-4666-8666-666666666666';
const MARKER = 'MARKER-c2-request-text-do-not-log';
const T0 = Date.parse('2026-11-14T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

interface Step {
  referralId: string;
  collaborationRunId: string;
  status: string;
  targetBuilderProfileId: string;
  constraintReadOnly: boolean;
  constraintAllowWriteTools: boolean;
  pendingJob: Record<string, unknown> | null;
}

function step(overrides: Partial<Step> = {}): Step {
  return {
    referralId: REFERRAL_ID,
    collaborationRunId: RUN_ID,
    status: 'pending_approval',
    targetBuilderProfileId: 'product-strategy',
    constraintReadOnly: true,
    constraintAllowWriteTools: false,
    pendingJob: { prompt: `What does the market say? ${MARKER}` },
    ...overrides,
  };
}

function workflowSnapshot(connectorToolIds: string[], id = WORKFLOW_ID, name = 'Sales notes') {
  return {
    id,
    name,
    version: 'v1',
    knowledgeScopeIds: [],
    connectorToolIds,
    model: { choice: 'server' },
    testRun: false,
    budgetPerRunCredits: null,
    budgetPerDayCredits: null,
  };
}

describe('ChatApprovalService (CHAT-DISCORD-01 C2)', () => {
  const original = process.env.CHAT_DISCORD_ENABLED;
  let now: number;
  let linksByDiscord: Map<string, { linkId: string; userId: string; locale: 'en' | 'zh-TW' | 'zh-CN' }>;
  let entitled: Set<string>;
  let active: Set<string>;
  let steps: Map<string, Step>;
  let runs: Map<string, { userId: string; status: string }>;
  let deliveryRows: Array<{ collaborationRunId: string; linkId: string; status: string }>;
  let audit: Array<{ eventType: string; subjectId: string; userId: string; payload: Record<string, unknown> }>;
  let approveReferral: jest.Mock;
  let rejectReferral: jest.Mock;
  let useLink: jest.Mock;
  let referralReads: jest.Mock;
  let service: ChatApprovalService;
  let logs: string[];
  let restoreLogs: () => void;

  function build(): ChatApprovalService {
    const orchestration = {
      approveReferral,
      rejectReferral,
      getCollaborationRun: async (id: string) => {
        const run = runs.get(id);
        return run ? { collaborationRunId: id, ...run } : null;
      },
    };
    // The real start service: approveStep is the Team page's approve call.
    const starts = new CollaborationStartService(orchestration as never, {} as never, {} as never);
    return new ChatApprovalService(
      starts,
      orchestration as never,
      { useLinkByExternalUser: useLink } as never,
      { resolveHarnessEntitled: async (id: string) => entitled.has(id) } as never,
      {
        findOne: async ({ where }: { where: { id: string } }) => ({ id: where.id, isActive: active.has(where.id) }),
      } as never,
      {
        findOne: async ({ where }: { where: Record<string, unknown> }) =>
          deliveryRows.find((row) => Object.entries(where).every(([key, value]) => (row as never)[key] === value)) ??
          null,
      } as never,
      { findOne: referralReads } as never,
      { insert: async (row: (typeof audit)[number]) => audit.push(row) } as never,
      { now: () => now },
    );
  }

  const LINK = { id: LINK_ID, userId: OWNER, locale: 'en' };

  async function message(link = LINK, stepNumber = 2): Promise<ChatReplyMessage> {
    return service.approvalMessage(link, RUN_ID, REFERRAL_ID, stepNumber);
  }

  function press(customId: string, overrides: Partial<ChatComponentPress> = {}): ChatComponentPress {
    return {
      channel: 'discord',
      customId,
      externalUserId: DISCORD_ID,
      locale: 'en-US',
      directMessage: true,
      ref: {},
      ...overrides,
    };
  }

  async function buttons(link = LINK): Promise<{ approve: string; reject: string }> {
    const msg = await message(link);
    expect(msg.buttons).toHaveLength(2);
    return { approve: msg.buttons![0].customId, reject: msg.buttons![1].customId };
  }

  beforeEach(() => {
    process.env.CHAT_DISCORD_ENABLED = 'true';
    now = T0;
    linksByDiscord = new Map([[DISCORD_ID, { linkId: LINK_ID, userId: OWNER, locale: 'en' }]]);
    entitled = new Set([OWNER, OTHER_OWNER]);
    active = new Set([OWNER, OTHER_OWNER]);
    steps = new Map([[REFERRAL_ID, step()]]);
    runs = new Map([[RUN_ID, { userId: OWNER, status: 'active' }]]);
    deliveryRows = [{ collaborationRunId: RUN_ID, linkId: LINK_ID, status: 'waiting' }];
    audit = [];
    approveReferral = jest.fn(async (input: { referralId: string }) => {
      const row = steps.get(input.referralId)!;
      row.status = 'approved';
      return { referral: { referralId: input.referralId, status: 'approved' }, executionId: 'exec-1' };
    });
    rejectReferral = jest.fn(async (input: { referralId: string }) => {
      const row = steps.get(input.referralId)!;
      row.status = 'rejected';
      return { referralId: input.referralId, status: 'rejected' };
    });
    useLink = jest.fn(async (_channel: string, externalUserId: string) => linksByDiscord.get(externalUserId) ?? null);
    referralReads = jest.fn(async ({ where }: { where: { referralId: string } }) => {
      const row = steps.get(where.referralId);
      return row ? { ...row } : null;
    });
    service = build();
    logs = [];
    restoreLogs = watchLogs(logs);
  });

  afterEach(() => {
    restoreLogs();
    const all = logs.join('\n') + JSON.stringify(audit);
    // No request text, no Discord id and no button token in logs or audit rows.
    expect(all).not.toContain(MARKER);
    expect(all).not.toContain(DISCORD_ID);
    expect(all).not.toContain(STRANGER);
    expect(all).not.toMatch(/ap1:[ar]:/);
    if (original === undefined) delete process.env.CHAT_DISCORD_ENABLED;
    else process.env.CHAT_DISCORD_ENABLED = original;
  });

  describe('the approval message', () => {
    it('a read-only step: the target, the step number, the request text and Approve and Reject buttons', async () => {
      const msg = await message();
      expect(msg.text).toBe(
        `${chatReply('en', 'approval.request', { step: '2', agent: 'Product Strategy' })}\nWhat does the market say? ${MARKER}`,
      );
      expect(msg.buttons).toEqual([
        { customId: expect.stringMatching(CHAT_APPROVAL_CUSTOM_ID), label: 'Approve', style: 'approve' },
        { customId: expect.stringMatching(CHAT_APPROVAL_CUSTOM_ID), label: 'Reject', style: 'reject' },
      ]);
      expect(service.liveTokens).toBe(1);
    });

    it('custom ids are opaque: no run, step, link or user id, at most 100 characters, one random token per message', async () => {
      const first = await buttons();
      const second = await buttons();
      for (const id of [first.approve, first.reject, second.approve]) {
        expect(id.length).toBeLessThanOrEqual(100);
        for (const raw of [RUN_ID, REFERRAL_ID, LINK_ID, OWNER, DISCORD_ID]) {
          expect(id).not.toContain(raw);
          expect(id).not.toContain(raw.replace(/-/g, ''));
        }
      }
      expect(first.approve.slice(6)).toBe(first.reject.slice(6));
      expect(first.approve.slice(6)).not.toBe(second.approve.slice(6));
    });

    it('acceptance 4: the request text is cut to 1000 characters', async () => {
      const long = `${'需'.repeat(700)}${'x'.repeat(700)}${MARKER}`;
      steps.get(REFERRAL_ID)!.pendingJob = { prompt: long };
      const msg = await message();
      const header = chatReply('en', 'approval.request', { step: '2', agent: 'Product Strategy' });
      const request = msg.text.slice(header.length + 1);
      expect(Array.from(request)).toHaveLength(CHAT_APPROVAL_LIMITS.requestChars);
      expect(request.endsWith('…')).toBe(true);
      expect(msg.text).not.toContain(MARKER);
      expect(cutApprovalRequest('short')).toBe('short');
      expect(Array.from(cutApprovalRequest('y'.repeat(1000)))).toHaveLength(1000);
      expect(cutApprovalRequest('y'.repeat(1000)).endsWith('…')).toBe(false);
    });

    it('in the link language; a workflow step is named by its own name (cut)', async () => {
      steps.set(
        REFERRAL_ID,
        step({
          targetBuilderProfileId: WORKFLOW_ID,
          pendingJob: { prompt: 'Summarise', workflow: workflowSnapshot([], WORKFLOW_ID, `My   ${'w'.repeat(80)}`) },
        }),
      );
      const msg = await message({ ...LINK, locale: 'zh-TW' }, 3);
      expect(msg.text.startsWith(chatReply('zh-TW', 'approval.request', { step: '3', agent: `My ${'w'.repeat(57)}` }))).toBe(
        true,
      );
      expect(msg.buttons!.map((button) => button.label)).toEqual(['核准', '拒絕']);
    });

    it.each([
      ['a write step', { targetBuilderProfileId: 'writer' }],
      ['a review step', { targetBuilderProfileId: 'reviewer' }],
      ['a decided step', { status: 'approved' }],
      ['a step of another run', { collaborationRunId: 'another-run' }],
    ])('%s: the plain Team page line, no buttons, no token', async (_name, overrides) => {
      steps.set(REFERRAL_ID, step(overrides as Partial<Step>));
      expect(await message()).toEqual({ text: chatReply('en', 'result.waitingApproval') });
      expect(service.liveTokens).toBe(0);
    });

    it('a step that is gone: the plain line', async () => {
      steps.clear();
      expect(await message()).toEqual({ text: chatReply('en', 'result.waitingApproval') });
    });

    it('keeps at most 2000 live buttons, oldest dropped first, and drops expired ones', async () => {
      const first = await buttons();
      for (let i = 0; i < CHAT_APPROVAL_LIMITS.maxTokens; i += 1) {
        await message();
      }
      expect(service.liveTokens).toBe(CHAT_APPROVAL_LIMITS.maxTokens);
      expect((await service.handlePress(press(first.approve))).kind).toBe('ephemeral');
      expect(approveReferral).not.toHaveBeenCalled();
      now += DAY;
      await message();
      expect(service.liveTokens).toBe(1);
    });

    it('revoke forgets the buttons of a message that was not sent', async () => {
      const msg = await message();
      service.revoke(msg);
      expect(service.liveTokens).toBe(0);
      expect(await service.handlePress(press(msg.buttons![0].customId))).toEqual({
        kind: 'ephemeral',
        message: { text: chatReply('en', 'approval.unavailable') },
      });
    });
  });

  describe('acceptance 2: the read-only rule', () => {
    it.each([
      ['product-strategy (roster, read, no connector)', step(), true],
      ['technology-advisor (roster, read)', step({ targetBuilderProfileId: 'technology-advisor' }), true],
      ['chief-of-staff (the lead, read, read-only mail and calendar)', step({ targetBuilderProfileId: 'chief-of-staff' }), true],
      ['a workflow with its own snapshot and read-only tools', step({ targetBuilderProfileId: WORKFLOW_ID, pendingJob: { prompt: 'p', workflow: workflowSnapshot([MAIL_TOOL_ID]) } }), true],
      ['writer (write profile)', step({ targetBuilderProfileId: 'writer' }), false],
      ['reviewer (review profile)', step({ targetBuilderProfileId: 'reviewer' }), false],
      ['builder (no profile)', step({ targetBuilderProfileId: 'builder' }), false],
      ['lead (coding lead, not a roster member, not the Chief of Staff)', step({ targetBuilderProfileId: 'lead' }), false],
      ['advisors-lead (not the Chief of Staff)', step({ targetBuilderProfileId: 'advisors-lead' }), false],
      ['an unknown id', step({ targetBuilderProfileId: 'mystery-agent' }), false],
      ['an empty target', step({ targetBuilderProfileId: '' }), false],
      ['a workflow without its snapshot', step({ targetBuilderProfileId: WORKFLOW_ID }), false],
      ['a workflow whose snapshot is another id', step({ targetBuilderProfileId: WORKFLOW_ID, pendingJob: { prompt: 'p', workflow: workflowSnapshot([], OWNER) } }), false],
      ['a workflow with a tool outside the allowlist', step({ targetBuilderProfileId: WORKFLOW_ID, pendingJob: { prompt: 'p', workflow: workflowSnapshot(['mail_send']) } }), false],
      ['a system agent with a workflow snapshot of its own id', step({ targetBuilderProfileId: 'chief-of-staff', pendingJob: { prompt: 'p', workflow: workflowSnapshot([], 'chief-of-staff') } }), false],
      ['constraints not read-only', step({ constraintReadOnly: false }), false],
      ['constraints allowing write tools', step({ constraintAllowWriteTools: true }), false],
    ])('%s: %s', (_name, facts, expected) => {
      expect(chatStepIsReadOnly(facts as never)).toBe(expected);
    });

    it('null or missing facts are not read-only', () => {
      expect(chatStepIsReadOnly(null)).toBe(false);
      expect(chatStepIsReadOnly(undefined)).toBe(false);
    });

    it('a step that is not read-only when pressed is refused with the Team page line and not approved; an audit row says why', async () => {
      const ids = await buttons();
      steps.get(REFERRAL_ID)!.targetBuilderProfileId = 'writer';
      const response = await service.handlePress(press(ids.approve));
      expect(response).toEqual({ kind: 'ephemeral', message: { text: chatReply('en', 'approval.notReadOnly') } });
      expect(approveReferral).not.toHaveBeenCalled();
      expect(steps.get(REFERRAL_ID)!.status).toBe('pending_approval');
      expect(audit).toEqual([
        expect.objectContaining({
          eventType: 'approval_refused',
          payload: { channel: 'discord', linkId: LINK_ID, collaborationRunId: RUN_ID, referralId: REFERRAL_ID, reason: 'not_read_only' },
        }),
      ]);
    });
  });

  describe('acceptance 1: Approve and Reject go through the existing calls with the owner as decidedBy', () => {
    it('Approve: approveReferral as the owner with the tests gate on; the message shows the decision; one audit row', async () => {
      const ids = await buttons();
      const response = await service.handlePress(press(ids.approve));
      expect(approveReferral).toHaveBeenCalledTimes(1);
      expect(approveReferral).toHaveBeenCalledWith({
        collaborationRunId: RUN_ID,
        referralId: REFERRAL_ID,
        decidedBy: OWNER,
        enforceTestsGate: true,
        approveWithoutPassingTests: false,
      });
      expect(rejectReferral).not.toHaveBeenCalled();
      expect(response).toEqual({
        kind: 'update',
        message: { text: chatReply('en', 'approval.approved', { step: '2', agent: 'Product Strategy' }) },
      });
      expect(audit).toEqual([
        expect.objectContaining({
          category: 'chat',
          eventType: 'approval_decided',
          subjectType: 'collaboration_run',
          subjectId: RUN_ID,
          userId: OWNER,
          payload: {
            channel: 'discord',
            linkId: LINK_ID,
            collaborationRunId: RUN_ID,
            referralId: REFERRAL_ID,
            decision: 'approved',
            reason: 'owner',
          },
        }),
      ]);
      expect(logs).toContain(
        `chat approval decided linkId=${LINK_ID} runId=${RUN_ID} referralId=${REFERRAL_ID} decision=approved`,
      );
      // The token is spent: a second press does nothing.
      expect(await service.handlePress(press(ids.approve))).toEqual({
        kind: 'ephemeral',
        message: { text: chatReply('en', 'approval.unavailable') },
      });
      expect(await service.handlePress(press(ids.reject))).toMatchObject({ kind: 'ephemeral' });
      expect(approveReferral).toHaveBeenCalledTimes(1);
      expect(rejectReferral).not.toHaveBeenCalled();
    });

    it('Reject: rejectReferral as the owner with the page omitted-reason token; the message shows the decision', async () => {
      linksByDiscord.get(DISCORD_ID)!.locale = 'zh-CN';
      const ids = await buttons({ ...LINK, locale: 'zh-CN' });
      const response = await service.handlePress(press(ids.reject));
      expect(rejectReferral).toHaveBeenCalledWith({
        collaborationRunId: RUN_ID,
        referralId: REFERRAL_ID,
        decidedBy: OWNER,
        reason: 'omitted',
      });
      expect(approveReferral).not.toHaveBeenCalled();
      expect(response).toEqual({
        kind: 'update',
        message: { text: chatReply('zh-CN', 'approval.rejected', { step: '2', agent: '产品策略' }) },
      });
      expect(audit).toEqual([
        expect.objectContaining({
          eventType: 'approval_decided',
          payload: expect.objectContaining({ decision: 'rejected', reason: 'omitted', referralId: REFERRAL_ID }),
        }),
      ]);
    });

    it.each([
      [new ServiceUnavailableException('AI execution temporarily disabled for maintenance'), 'runs_off', 'approval.runsOff'],
      [new ServiceUnavailableException('Provider anthropic temporarily unavailable'), 'provider_off', 'approval.providerOff'],
      [new HttpException('Insufficient credits', HttpStatus.PAYMENT_REQUIRED), 'no_credits', 'approval.noCredits'],
      [new HttpException('Daily credit limit reached', HttpStatus.TOO_MANY_REQUESTS), 'over_cap', 'approval.overCap'],
      [new ConflictException({ statusCode: 409, message: 'Tests have not passed', code: TESTS_NOT_PASSED_CODE }), 'tests_blocked', 'approval.testsBlocked'],
      [new ConflictException({ statusCode: 409, message: 'x', code: 'WORKFLOW_DISABLED' }), 'workflow', 'approval.workflow'],
      [new Error(`provider said ${MARKER}`), 'refused', 'approval.refused'],
    ] as const)('an approve refusal (%#) answers a translated line; the step keeps waiting and the button keeps working', async (error, reason, key) => {
      const ids = await buttons();
      approveReferral.mockImplementationOnce(async () => {
        throw error;
      });
      expect(await service.handlePress(press(ids.approve))).toEqual({
        kind: 'ephemeral',
        message: { text: chatReply('en', key) },
      });
      expect(audit).toEqual([expect.objectContaining({ eventType: 'approval_refused', payload: expect.objectContaining({ reason }) })]);
      expect((await service.handlePress(press(ids.approve))).kind).toBe('update');
    });

    it('a race with the Team page (already decided at approve time): nothing, and the button is spent', async () => {
      const ids = await buttons();
      approveReferral.mockImplementationOnce(async () => {
        throw new ConflictException(`Referral ${REFERRAL_ID} cannot be approved from status approved`);
      });
      expect(await service.handlePress(press(ids.approve))).toEqual({
        kind: 'ephemeral',
        message: { text: chatReply('en', 'approval.unavailable') },
      });
      expect(service.liveTokens).toBe(0);
      expect(audit).toEqual([]);
    });

    it('chatApprovalRefusalOf maps a missing step to unavailable', () => {
      expect(chatApprovalRefusalOf(new Error('Referral x not found'))).toBe('unavailable');
      expect(chatApprovalRefusalOf(new ConflictException('cannot be rejected'))).toBe('unavailable');
      expect(chatApprovalRefusalOf('nope')).toBe('refused');
    });
  });

  describe('acceptance 3: anyone but the linked owner, a decided step, or after unlink does nothing', () => {
    function expectNothing(response: unknown, key = 'approval.unavailable'): void {
      expect(response).toEqual({ kind: 'ephemeral', message: { text: chatReply('en', key as never) } });
      expect(approveReferral).not.toHaveBeenCalled();
      expect(rejectReferral).not.toHaveBeenCalled();
      expect(audit).toEqual([]);
    }

    it('another Discord user, unlinked or linked to another owner, gets the fixed line; the owner still can', async () => {
      const ids = await buttons();
      expectNothing(await service.handlePress(press(ids.approve, { externalUserId: STRANGER })));
      linksByDiscord.set(STRANGER, { linkId: OTHER_LINK_ID, userId: OTHER_OWNER, locale: 'en' });
      expectNothing(await service.handlePress(press(ids.approve, { externalUserId: STRANGER })));
      expectNothing(await service.handlePress(press(ids.reject, { externalUserId: STRANGER })));
      expect((await service.handlePress(press(ids.approve))).kind).toBe('update');
    });

    it('after unlink, or after unlink and a new link of the same Discord account', async () => {
      const ids = await buttons();
      linksByDiscord.delete(DISCORD_ID);
      expectNothing(await service.handlePress(press(ids.approve)));
      linksByDiscord.set(DISCORD_ID, { linkId: OTHER_LINK_ID, userId: OWNER, locale: 'en' });
      expectNothing(await service.handlePress(press(ids.approve)));
    });

    it('a decided step (approved or rejected on the Team page) does nothing', async () => {
      const ids = await buttons();
      steps.get(REFERRAL_ID)!.status = 'rejected';
      expectNothing(await service.handlePress(press(ids.approve)));
      expect(service.liveTokens).toBe(0);
    });

    it('a run that ended, is not the owner’s, or is no longer a waiting Discord delivery does nothing', async () => {
      const ids = await buttons();
      runs.set(RUN_ID, { userId: OWNER, status: 'cancelled' });
      expectNothing(await service.handlePress(press(ids.approve)));
      const again = await buttons();
      runs.set(RUN_ID, { userId: OTHER_OWNER, status: 'active' });
      expectNothing(await service.handlePress(press(again.approve)));
      const third = await buttons();
      runs.set(RUN_ID, { userId: OWNER, status: 'active' });
      deliveryRows[0].status = 'dropped';
      expectNothing(await service.handlePress(press(third.reject)));
    });

    it('an expired button (24 hours) does nothing', async () => {
      const ids = await buttons();
      now += CHAT_APPROVAL_LIMITS.tokenLifetimeMs;
      expectNothing(await service.handlePress(press(ids.approve)));
      expect(service.liveTokens).toBe(0);
    });

    it('forged custom ids do nothing and read nothing', async () => {
      const ids = await buttons();
      const token = ids.approve.slice(6);
      const forged = [
        `ap1:a:${REFERRAL_ID}`,
        `ap1:a:${REFERRAL_ID.replace(/-/g, '').slice(0, 22)}`,
        `ap1:a:${'A'.repeat(22)}`,
        `ap1:x:${token}`,
        `ap2:a:${token}`,
        `ap1:a:${token}x`,
        ` ap1:a:${token}`,
        '',
        'x'.repeat(200),
      ];
      for (const customId of forged) {
        expectNothing(await service.handlePress(press(customId)));
      }
      expectNothing(await service.handlePress(press(undefined as never)));
      expect(useLink).not.toHaveBeenCalled();
      expect(referralReads).toHaveBeenCalledTimes(1); // the message itself
    });

    it('an owner who is inactive or lost harness access gets the fixed refusal', async () => {
      const ids = await buttons();
      entitled.delete(OWNER);
      expectNothing(await service.handlePress(press(ids.approve)), 'notEntitled');
      entitled.add(OWNER);
      active.delete(OWNER);
      expectNothing(await service.handlePress(press(ids.reject)), 'notEntitled');
    });

    it('the switch off, or a press outside the direct message, does nothing', async () => {
      const ids = await buttons();
      process.env.CHAT_DISCORD_ENABLED = 'false';
      expectNothing(await service.handlePress(press(ids.approve)), 'notAvailable');
      process.env.CHAT_DISCORD_ENABLED = 'true';
      expectNothing(await service.handlePress(press(ids.approve, { directMessage: false })));
    });

    it('a failure inside answers the error line and never throws', async () => {
      const ids = await buttons();
      useLink.mockImplementationOnce(async () => {
        throw new TypeError(`db ${MARKER}`);
      });
      expectNothing(await service.handlePress(press(ids.approve)), 'error');
      expect(logs).toContain('chat approval failed reason=TypeError');
    });
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
