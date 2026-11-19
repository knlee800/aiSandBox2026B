import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { CollaborationRunStartedNotifier } from '../orchestration/collaboration-start.service';
import { CHAT_APPROVAL_CUSTOM_ID, ChatApprovalService } from './chat-approval.service';
import { CHAT_DELIVERY_LIMITS, ChatDeliveryService, chatResultMessages } from './chat-delivery.service';
import { chatReply } from './chat-replies';
import { ChatRunService } from './chat-run.service';
import { ChatActivityNotifier, ChatDirectMessageRefusedError, FakeChatTransport } from './chat-transport';
import { DiscordCalls, DiscordConnection, DiscordTransport } from './discord/discord-transport';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '99999999-9999-4999-8999-999999999999';
const LINK_ID = '22222222-2222-4222-8222-222222222222';
const DISCORD_ID = '987654321098765432';
const RUN_ID = 'collab-run-1';
const MARKER = 'MARKER-c1-answer-text-do-not-log';
const T0 = Date.parse('2026-11-14T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

type Row = {
  collaborationRunId: string;
  linkId: string;
  status: string;
  notifiedReferralIds: string[];
  createdAt: Date;
  deliveredAt: Date | null;
  /** CHAT-STATE-PERSIST-01: the persisted delivery state (migration 1817). */
  partsSent: number;
  sendFailures: number;
  nextAttemptAt: Date | null;
  heldAt: Date | null;
  claimedBy: string | null;
  claimedUntil: Date | null;
  origin: string | null;
};

function asNumber(value: unknown): number {
  return value instanceof Date ? value.getTime() : Number(value);
}

function satisfies(actual: unknown, expected: FindOperator<unknown>): boolean {
  if (expected.type === 'not') {
    const child = expected.child;
    return child ? !satisfies(actual, child) : actual !== expected.value;
  }
  if (expected.type === 'in') return (expected.value as unknown[]).includes(actual);
  if (expected.type === 'isNull') return actual === null || actual === undefined;
  if (actual === null || actual === undefined) return false;
  if (expected.type === 'lessThan') return asNumber(actual) < asNumber(expected.value);
  if (expected.type === 'lessThanOrEqual') return asNumber(actual) <= asNumber(expected.value);
  throw new Error(`unsupported operator ${expected.type}`);
}

/** A where object, or an array of them (OR), as TypeORM reads it. */
function matches(row: Record<string, unknown>, where: Record<string, unknown> | Array<Record<string, unknown>>): boolean {
  if (Array.isArray(where)) {
    return where.some((one) => matches(row, one));
  }
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected instanceof FindOperator) {
      return satisfies(actual, expected);
    }
    return actual === expected;
  });
}

type Where = Record<string, unknown> | Array<Record<string, unknown>>;

/** chat_run_deliveries in memory: one store shared by every service instance (a restart is a new instance). */
class DeliveryRepo {
  rows: Row[] = [];
  /** Every update's where, for the claim and compare-and-set checks. */
  readonly updates: Array<{ where: Where; patch: Partial<Row> }> = [];
  async find(options: { where: Where; take?: number }): Promise<Row[]> {
    return this.rows
      .filter((row) => matches(row, options.where))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, options.take ?? Infinity)
      .map((row) => ({ ...row, notifiedReferralIds: [...row.notifiedReferralIds] }));
  }
  async findOne(options: { where: Where }): Promise<Row | null> {
    return (await this.find({ where: options.where, take: 1 }))[0] ?? null;
  }
  async update(where: Where, patch: Partial<Row>): Promise<{ affected: number }> {
    this.updates.push({ where, patch });
    let affected = 0;
    for (const row of this.rows) {
      if (matches(row, where)) {
        Object.assign(row, patch);
        affected += 1;
      }
    }
    return { affected };
  }
  async delete(where: Record<string, unknown>): Promise<{ affected: number }> {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !matches(row, where));
    return { affected: before - this.rows.length };
  }
  /** CHAT-RESULTS-OTHER-01: ChatRunService's insert-or-ignore chain (a row whose run id exists is kept). */
  createQueryBuilder() {
    let values: Row | null = null;
    let ignore = false;
    const chain = {
      insert: () => chain,
      into: () => chain,
      values: (row: Row) => {
        values = row;
        return chain;
      },
      orIgnore: () => {
        ignore = true;
        return chain;
      },
      execute: async () => {
        if (!ignore || !values) throw new Error('insert without orIgnore');
        const row = values as Row;
        if (!this.rows.some((existing) => existing.collaborationRunId === row.collaborationRunId)) {
          // The column defaults of migration 1817 (origin defaults to platform).
          this.rows.push({ ...newRowDefaults(), ...row, notifiedReferralIds: [...row.notifiedReferralIds] });
        }
        return { identifiers: [], raw: [] };
      },
    };
    return chain;
  }
}

function newRowDefaults(): Pick<
  Row,
  'partsSent' | 'sendFailures' | 'nextAttemptAt' | 'heldAt' | 'claimedBy' | 'claimedUntil' | 'origin'
> {
  return {
    partsSent: 0,
    sendFailures: 0,
    nextAttemptAt: null,
    heldAt: null,
    claimedBy: null,
    claimedUntil: null,
    origin: 'platform',
  };
}

interface FakeReferral {
  referralId: string;
  status: string;
  result: { summary: string } | null;
}

describe('ChatDeliveryService (CHAT-DISCORD-01 C1)', () => {
  const original = process.env.CHAT_DISCORD_ENABLED;
  let now: number;
  let sleeps: number[];
  let deliveries: DeliveryRepo;
  let links: Map<string, { id: string; userId: string; externalUserId: string; locale: string }>;
  let audit: Array<{ eventType: string; subjectId: string; userId: string; payload: Record<string, unknown> }>;
  let runs: Map<string, { run: { userId: string; status: string }; referrals: FakeReferral[] }>;
  let reads: jest.Mock;
  let transport: FakeChatTransport;
  let service: ChatDeliveryService;
  let logs: string[];
  let restoreLogs: () => void;

  /** chat_links: by id (the pass) or by channel and outside user id (resume). */
  function linkRepo() {
    return {
      findOne: async ({ where }: { where: { id?: string; channel?: string; externalUserId?: string } }) =>
        where.id !== undefined
          ? (links.get(where.id) ?? null)
          : ([...links.values()].find((row) => where.channel === 'discord' && row.externalUserId === where.externalUserId) ?? null),
    };
  }

  /** CHAT-STATE-PERSIST-01: the rows held now (held_at set). */
  function held(): number {
    return deliveries.rows.filter((row) => row.status === 'waiting' && row.heldAt !== null).length;
  }

  function build(
    target: { sendToUser: unknown; state: unknown } = transport,
    options: Record<string, unknown> = {},
    activity?: ChatActivityNotifier,
  ) {
    return new ChatDeliveryService(
      target as never,
      { getCollaborationRunWithReferrals: reads } as never,
      deliveries as never,
      linkRepo() as never,
      { insert: async (row: (typeof audit)[number]) => audit.push(row) } as never,
      {
        allowUnderJest: true,
        now: () => now,
        sleep: async (ms: number) => {
          sleeps.push(ms);
          now += ms;
        },
        ...options,
      },
      undefined,
      activity,
    );
  }

  function waiting(runId = RUN_ID, createdAt = new Date(T0), extra: Partial<Row> = {}): void {
    deliveries.rows.push({
      ...newRowDefaults(),
      collaborationRunId: runId,
      linkId: LINK_ID,
      status: 'waiting',
      notifiedReferralIds: [],
      createdAt,
      deliveredAt: null,
      origin: 'chat',
      ...extra,
    });
  }

  function ended(status: string, summary: string | null, runId = RUN_ID, userId = OWNER): void {
    runs.set(runId, {
      run: { userId, status },
      referrals: [
        { referralId: 'r1', status: 'completed', result: { summary: 'first step answer' } },
        { referralId: 'r2', status: status === 'completed' ? 'completed' : status, result: summary === null ? null : { summary } },
      ],
    });
  }

  beforeEach(async () => {
    process.env.CHAT_DISCORD_ENABLED = 'true';
    now = T0 + 60 * 1000;
    sleeps = [];
    deliveries = new DeliveryRepo();
    links = new Map([[LINK_ID, { id: LINK_ID, userId: OWNER, externalUserId: DISCORD_ID, locale: 'en' }]]);
    audit = [];
    runs = new Map();
    reads = jest.fn(async (runId: string) => runs.get(runId) ?? null);
    transport = new FakeChatTransport();
    await transport.connect(async () => null);
    service = build();
    logs = [];
    restoreLogs = watchLogs(logs);
  });

  afterEach(() => {
    service.onModuleDestroy();
    restoreLogs();
    const all = logs.join('\n') + JSON.stringify(audit);
    // Acceptance 6: no result text and no Discord id in logs or audit rows.
    expect(all).not.toContain(MARKER);
    expect(all).not.toContain(DISCORD_ID);
    if (original === undefined) delete process.env.CHAT_DISCORD_ENABLED;
    else process.env.CHAT_DISCORD_ENABLED = original;
  });

  it('a completed run: the final answer by direct message, the row delivered, one audit row with counts', async () => {
    waiting();
    ended('completed', `The answer ${MARKER}`);
    expect(await service.tick()).toBe(1);
    expect(transport.directMessages).toEqual([{ externalUserId: DISCORD_ID, message: { text: `The answer ${MARKER}` } }]);
    expect(deliveries.rows[0]).toMatchObject({ status: 'delivered', deliveredAt: new Date(now) });
    expect(reads).toHaveBeenCalledWith(RUN_ID);
    expect(audit).toEqual([
      expect.objectContaining({
        category: 'chat',
        eventType: 'result_delivered',
        subjectType: 'collaboration_run',
        subjectId: RUN_ID,
        userId: OWNER,
        payload: { channel: 'discord', linkId: LINK_ID, collaborationRunId: RUN_ID, outcome: 'completed', parts: 1, cut: 0 },
      }),
    ]);
    expect(logs).toContain(`chat delivery delivered runId=${RUN_ID} linkId=${LINK_ID} reason=completed`);
    // Delivered once only.
    await service.tick();
    expect(transport.directMessages).toHaveLength(1);
  });

  it('acceptance 5: a long answer goes in at most 5 parts of at most 1900 characters, cut notice in the link language', async () => {
    links.get(LINK_ID)!.locale = 'zh-TW';
    waiting();
    ended('completed', Array.from({ length: 200 }, (_, i) => `${i} ${MARKER} ${'答案 '.repeat(60)}`).join('\n\n'));
    await service.tick();
    const texts = transport.directMessages.map((entry) => entry.message.text);
    expect(texts).toHaveLength(5);
    for (const text of texts) {
      expect(Array.from(text).length).toBeLessThanOrEqual(1900);
    }
    expect(texts[4].endsWith(chatReply('zh-TW', 'result.cut'))).toBe(true);
    expect(audit[0].payload).toMatchObject({ outcome: 'completed', parts: 5, cut: 1 });
    // At most one message a second per owner.
    expect(sleeps).toEqual([1000, 1000, 1000, 1000]);
  });

  it('acceptance 5: through the Discord transport every message has mentions off and fits the limit', async () => {
    const calls: Array<{ userId: string; body: { content: string; allowed_mentions: unknown; flags?: number } }> = [];
    const gateway = new EventEmitter() as EventEmitter & { connect: () => Promise<void>; destroy: () => void };
    gateway.connect = () => new Promise<void>(() => undefined);
    gateway.destroy = () => undefined;
    const discordCalls: DiscordCalls = {
      reply: async () => undefined,
      defer: async () => undefined,
      editReply: async () => undefined,
      deleteReply: async () => undefined,
      registerGlobalCommands: async () => undefined,
      sendDirectMessage: async (userId, body) => {
        calls.push({ userId, body: body as never });
      },
      updateMessage: async () => undefined,
      deferUpdate: async () => undefined,
      followUp: async () => undefined,
    };
    const discord = new DiscordTransport({
      env: { CHAT_DISCORD_ENABLED: 'true', DISCORD_BOT_TOKEN: 'test-token-value' },
      factory: async (): Promise<DiscordConnection> => ({ calls: discordCalls, gateway, close: () => undefined }),
    });
    await discord.connect(async () => null);
    gateway.emit('ready', { application: { id: '111111111111111111', flags: 0 } }, 0);
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));
    expect(discord.state).toBe('ready');

    service = build(discord);
    waiting();
    ended('completed', `@everyone <@123456789012345678> ${MARKER} ${'x'.repeat(12000)}`);
    await service.tick();
    expect(calls.length).toBeGreaterThan(1);
    expect(calls.length).toBeLessThanOrEqual(5);
    for (const call of calls) {
      expect(call.userId).toBe(DISCORD_ID);
      expect(call.body.allowed_mentions).toEqual({ parse: [] });
      expect(call.body.flags).toBeUndefined();
      expect(Array.from(call.body.content).length).toBeLessThanOrEqual(1900);
    }
    await discord.disconnect();
  });

  it.each([
    ['failed', 'result.failed'],
    ['timed_out', 'result.timedOut'],
    ['cancelled', 'result.cancelled'],
  ] as const)('a %s run: one translated line, never the stored failure text', async (status, key) => {
    links.get(LINK_ID)!.locale = 'zh-CN';
    waiting();
    ended(status, `provider said ${MARKER}`);
    await service.tick();
    expect(transport.directMessages.map((entry) => entry.message.text)).toEqual([chatReply('zh-CN', key)]);
    expect(deliveries.rows[0].status).toBe('delivered');
    expect(audit[0].payload).toMatchObject({ outcome: status, parts: 1, cut: 0 });
  });

  it('a completed run without an answer: one line', async () => {
    waiting();
    runs.set(RUN_ID, { run: { userId: OWNER, status: 'completed' }, referrals: [{ referralId: 'r1', status: 'failed', result: { summary: MARKER } }] });
    await service.tick();
    expect(transport.directMessages.map((entry) => entry.message.text)).toEqual([chatReply('en', 'result.noAnswer')]);
    expect(audit[0].payload).toMatchObject({ outcome: 'no_answer' });
  });

  it('an active run: one notice per hand-off newly waiting for approval; the row keeps waiting', async () => {
    waiting();
    const referrals: FakeReferral[] = [
      { referralId: 'r1', status: 'completed', result: { summary: MARKER } },
      { referralId: 'r2', status: 'pending_approval', result: null },
    ];
    runs.set(RUN_ID, { run: { userId: OWNER, status: 'active' }, referrals });
    await service.tick();
    await service.tick();
    expect(transport.directMessages.map((entry) => entry.message.text)).toEqual([chatReply('en', 'result.waitingApproval')]);
    expect(deliveries.rows[0]).toMatchObject({ status: 'waiting', notifiedReferralIds: ['r2'] });
    referrals.push({ referralId: 'r3', status: 'pending_approval', result: null });
    await service.tick();
    expect(transport.directMessages).toHaveLength(2);
    expect(deliveries.rows[0].notifiedReferralIds).toEqual(['r2', 'r3']);
    expect(audit).toEqual([]);
  });

  describe('C2: approval messages', () => {
    let steps: Map<string, Record<string, unknown>>;
    let approvals: ChatApprovalService;

    function step(referralId: string, target: string, prompt: string): void {
      steps.set(referralId, {
        referralId,
        collaborationRunId: RUN_ID,
        status: 'pending_approval',
        targetBuilderProfileId: target,
        constraintReadOnly: true,
        constraintAllowWriteTools: false,
        pendingJob: { prompt },
      });
    }

    function withApprovals(target: { sendToUser: unknown; state: unknown } = transport): ChatDeliveryService {
      approvals = new ChatApprovalService(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        { findOne: async ({ where }: { where: { referralId: string } }) => steps.get(where.referralId) ?? null } as never,
        {} as never,
        { now: () => now },
      );
      return new ChatDeliveryService(
        target as never,
        { getCollaborationRunWithReferrals: reads } as never,
        deliveries as never,
        linkRepo() as never,
        { insert: async (row: (typeof audit)[number]) => audit.push(row) } as never,
        { allowUnderJest: true, now: () => now, sleep: async (ms: number) => void (now += ms) },
        approvals,
      );
    }

    beforeEach(() => {
      steps = new Map();
      service.onModuleDestroy();
      service = withApprovals();
    });

    it('a read-only step gets its request (cut to 1000 characters) with Approve and Reject; another step the Team page line', async () => {
      waiting();
      step('r2', 'product-strategy', `${'q'.repeat(1200)} ${MARKER}`);
      const referrals: FakeReferral[] = [
        { referralId: 'r1', status: 'completed', result: { summary: 'lead answer' } },
        { referralId: 'r2', status: 'pending_approval', result: null },
      ];
      runs.set(RUN_ID, { run: { userId: OWNER, status: 'active' }, referrals });
      await service.tick();
      await service.tick();
      expect(transport.directMessages).toHaveLength(1);
      const sent = transport.directMessages[0].message;
      const header = chatReply('en', 'approval.request', { step: '2', agent: 'Product Strategy' });
      expect(sent.text.startsWith(`${header}\n`)).toBe(true);
      expect(Array.from(sent.text.slice(header.length + 1))).toHaveLength(1000);
      expect(sent.text).not.toContain(MARKER);
      expect(sent.buttons?.map((button) => [button.style, button.label])).toEqual([
        ['approve', 'Approve'],
        ['reject', 'Reject'],
      ]);
      for (const button of sent.buttons ?? []) expect(button.customId).toMatch(CHAT_APPROVAL_CUSTOM_ID);
      expect(deliveries.rows[0].notifiedReferralIds).toEqual(['r2']);
      expect(logs).toContain(`chat delivery approval notice runId=${RUN_ID} linkId=${LINK_ID} waiting=1 buttons=1`);

      step('r3', 'writer', `write files ${MARKER}`);
      referrals.push({ referralId: 'r3', status: 'pending_approval', result: null });
      await service.tick();
      expect(transport.directMessages[1].message).toEqual({ text: chatReply('en', 'result.waitingApproval') });
      expect(deliveries.rows[0].notifiedReferralIds).toEqual(['r2', 'r3']);
      expect(approvals.liveTokens).toBe(1);
      expect(audit).toEqual([]);
    });

    it('CHAT-RESULTS-OTHER-01: a run started on the Team page (row from the start listener) gets the approval notice, then the result', async () => {
      const notifier = new CollaborationRunStartedNotifier();
      const runsService = new ChatRunService(
        {} as never,
        {} as never,
        { wake: jest.fn() } as never,
        deliveries as never,
        { insert: async () => ({}), find: async () => [] } as never,
        { findOne: async ({ where }: { where: { userId: string } }) => [...links.values()].find((row) => row.userId === where.userId) ?? null } as never,
        { findOne: async () => ({ id: OWNER, isActive: true }) } as never,
        notifier,
      );
      // What CollaborationStartService.start does for a page start: ids only.
      expect(await runsService.onRunStarted({ collaborationRunId: RUN_ID, userId: OWNER })).toBe(true);
      expect(deliveries.rows).toEqual([
        expect.objectContaining({ collaborationRunId: RUN_ID, linkId: LINK_ID, status: 'waiting', notifiedReferralIds: [], origin: 'platform' }),
      ]);
      step('r1', 'chief-of-staff', `plan my week ${MARKER}`);
      const referrals: FakeReferral[] = [{ referralId: 'r1', status: 'pending_approval', result: null }];
      runs.set(RUN_ID, { run: { userId: OWNER, status: 'active' }, referrals });
      await service.tick();
      expect(transport.directMessages).toHaveLength(1);
      const notice = transport.directMessages[0].message;
      expect(notice.text.startsWith(chatReply('en', 'approval.request', { step: '1', agent: 'Chief of Staff' }))).toBe(true);
      expect(notice.buttons?.map((button) => button.style)).toEqual(['approve', 'reject']);
      expect(deliveries.rows[0].notifiedReferralIds).toEqual(['r1']);

      ended('completed', `The page run answer ${MARKER}`);
      await service.tick();
      expect(transport.directMessages[1]).toEqual({
        externalUserId: DISCORD_ID,
        message: { text: `The page run answer ${MARKER}` },
      });
      expect(deliveries.rows[0]).toMatchObject({ status: 'delivered' });
      runsService.onModuleDestroy();
    });

    it('a send that fails: the button is forgotten, the step is not marked, the next tick sends it again', async () => {
      waiting();
      step('r2', 'chief-of-staff', 'Report back');
      runs.set(RUN_ID, {
        run: { userId: OWNER, status: 'active' },
        referrals: [{ referralId: 'r2', status: 'pending_approval', result: null }],
      });
      const failing = {
        state: 'ready',
        sendToUser: jest.fn(async (): Promise<void> => {
          throw new Error(`discord said ${MARKER}`);
        }),
      };
      service = withApprovals(failing);
      await service.tick();
      expect(failing.sendToUser).toHaveBeenCalledTimes(1);
      expect(approvals.liveTokens).toBe(0);
      expect(deliveries.rows[0].notifiedReferralIds).toEqual([]);
      expect(logs).toContain(`chat delivery notice failed runId=${RUN_ID} linkId=${LINK_ID} reason=Error`);
      failing.sendToUser.mockImplementation(async () => undefined);
      await service.tick();
      expect(deliveries.rows[0].notifiedReferralIds).toEqual(['r2']);
      expect(approvals.liveTokens).toBe(1);
    });

    it('CHAT-USER-INSTALL-01: a refused approval message is held: its button is forgotten, the step not marked; the next command sends it', async () => {
      waiting();
      step('r2', 'chief-of-staff', 'Report back');
      runs.set(RUN_ID, {
        run: { userId: OWNER, status: 'active' },
        referrals: [{ referralId: 'r2', status: 'pending_approval', result: null }],
      });
      transport.refusedUsers.add(DISCORD_ID);
      await service.tick();
      expect(approvals.liveTokens).toBe(0);
      expect(deliveries.rows[0].notifiedReferralIds).toEqual([]);
      expect(held()).toBe(1);
      expect(logs).toContain(`chat delivery held runId=${RUN_ID} linkId=${LINK_ID} reason=dm_refused`);
      await service.tick();
      expect(transport.directMessages).toEqual([]);
      transport.refusedUsers.delete(DISCORD_ID);
      expect(await service.resume('discord', DISCORD_ID)).toBe(1);
      expect(transport.directMessages).toHaveLength(1);
      expect(transport.directMessages[0].message.buttons?.map((button) => button.style)).toEqual(['approve', 'reject']);
      expect(deliveries.rows[0].notifiedReferralIds).toEqual(['r2']);
      expect(approvals.liveTokens).toBe(1);
      expect(audit).toEqual([]);
    });

    it('through the Discord transport the approval message has one row of buttons and mentions off', async () => {
      const calls: Array<{ body: Record<string, unknown> }> = [];
      const gateway = new EventEmitter() as EventEmitter & { connect: () => Promise<void>; destroy: () => void };
      gateway.connect = () => new Promise<void>(() => undefined);
      gateway.destroy = () => undefined;
      const discord = new DiscordTransport({
        env: { CHAT_DISCORD_ENABLED: 'true', DISCORD_BOT_TOKEN: 'test-token-value' },
        factory: async (): Promise<DiscordConnection> => ({
          calls: {
            reply: async () => undefined,
            defer: async () => undefined,
            editReply: async () => undefined,
            deleteReply: async () => undefined,
            registerGlobalCommands: async () => undefined,
            sendDirectMessage: async (_userId, body) => void calls.push({ body: body as never }),
            updateMessage: async () => undefined,
            deferUpdate: async () => undefined,
            followUp: async () => undefined,
          },
          gateway,
          close: () => undefined,
        }),
      });
      await discord.connect(async () => null);
      gateway.emit('ready', { application: { id: '111111111111111111', flags: 0 } }, 0);
      for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));
      service = withApprovals(discord);
      waiting();
      step('r2', 'technology-advisor', '@everyone which stack?');
      runs.set(RUN_ID, {
        run: { userId: OWNER, status: 'active' },
        referrals: [{ referralId: 'r2', status: 'pending_approval', result: null }],
      });
      await service.tick();
      expect(calls).toHaveLength(1);
      expect(calls[0].body.allowed_mentions).toEqual({ parse: [] });
      expect(calls[0].body.flags).toBeUndefined();
      const rows = calls[0].body.components as Array<{ type: number; components: Array<Record<string, unknown>> }>;
      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe(1);
      expect(rows[0].components.map((button) => [button.type, button.style, button.label])).toEqual([
        [2, 3, 'Approve'],
        [2, 4, 'Reject'],
      ]);
      await discord.disconnect();
    });
  });

  it('the transport is not connected: nothing is sent and the row keeps waiting', async () => {
    await transport.disconnect();
    waiting();
    ended('completed', MARKER);
    await service.tick();
    expect(transport.directMessages).toEqual([]);
    expect(deliveries.rows[0].status).toBe('waiting');
    expect(audit).toEqual([]);
  });

  it('sending fails: 3 retries with backoff, then failed with a delivery_failed audit row', async () => {
    let sends = 0;
    transport.sendToUser = async () => {
      sends += 1;
      throw new Error(`discord said ${MARKER}`);
    };
    waiting();
    ended('completed', MARKER);
    await service.tick();
    expect(sends).toBe(1);
    now += 5 * 1000;
    await service.tick();
    expect(sends).toBe(1);
    for (const wait of CHAT_DELIVERY_LIMITS.backoffMs) {
      now += wait;
      await service.tick();
    }
    expect(sends).toBe(4);
    expect(deliveries.rows[0].status).toBe('failed');
    expect(audit).toEqual([
      expect.objectContaining({
        eventType: 'delivery_failed',
        subjectId: RUN_ID,
        payload: { channel: 'discord', linkId: LINK_ID, collaborationRunId: RUN_ID, attempts: 4, partsSent: 0, reason: 'Error' },
      }),
    ]);
    now += DAY;
    await service.tick();
    expect(sends).toBe(4);
  });

  it('a retry after a failed part sends only the parts not yet sent', async () => {
    const sent: string[] = [];
    let failOnce = true;
    transport.sendToUser = async (_id, message) => {
      if (sent.length === 1 && failOnce) {
        failOnce = false;
        throw new Error('rate limited');
      }
      sent.push(message.text);
    };
    waiting();
    ended('completed', `${'a'.repeat(1800)}\n\n${'b'.repeat(1800)}`);
    await service.tick();
    expect(sent).toEqual(['a'.repeat(1800)]);
    now += CHAT_DELIVERY_LIMITS.backoffMs[0];
    await service.tick();
    expect(sent).toEqual(['a'.repeat(1800), 'b'.repeat(1800)]);
    expect(deliveries.rows[0].status).toBe('delivered');
  });

  it('dropped: no end within 24 hours, a run that is gone or not the owner’s, a link that is gone', async () => {
    waiting('old', new Date(now - DAY - 1));
    ended('completed', MARKER, 'old');
    waiting('gone');
    waiting('foreign');
    ended('completed', MARKER, 'foreign', OTHER);
    await service.tick();
    expect(deliveries.rows.map((row) => [row.collaborationRunId, row.status])).toEqual([
      ['old', 'dropped'],
      ['gone', 'dropped'],
      ['foreign', 'dropped'],
    ]);
    links.clear();
    waiting('unlinked');
    ended('completed', MARKER, 'unlinked');
    await service.tick();
    expect(deliveries.rows[3].status).toBe('dropped');
    expect(transport.directMessages).toEqual([]);
  });

  it('acceptance 7: delivered, failed and dropped rows older than 30 days are pruned; waiting and newer rows stay', async () => {
    const old = new Date(now - 30 * DAY - 1);
    const recent = new Date(now - 29 * DAY);
    for (const [id, status, createdAt] of [
      ['d-old', 'delivered', old],
      ['f-old', 'failed', old],
      ['x-old', 'dropped', old],
      ['d-new', 'delivered', recent],
      ['w-old', 'waiting', old],
    ] as const) {
      deliveries.rows.push({ ...newRowDefaults(), collaborationRunId: id, linkId: LINK_ID, status, notifiedReferralIds: [], createdAt, deliveredAt: null });
    }
    expect(await service.prune()).toBe(3);
    expect(deliveries.rows.map((row) => row.collaborationRunId)).toEqual(['d-new', 'w-old']);
    expect(logs).toContain('chat deliveries pruned count=3');
  });

  describe('CHAT-USER-INSTALL-01: a refused direct message is held until the user is active', () => {
    const LINK_2 = '33333333-3333-4333-8333-333333333333';
    const OTHER_DISCORD = '123456789012345678';
    const HELD_LINE = `chat delivery held runId=${RUN_ID} linkId=${LINK_ID} reason=dm_refused`;
    let activity: ChatActivityNotifier;

    async function settle(until: () => boolean): Promise<void> {
      for (let i = 0; i < 200 && !until(); i += 1) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    beforeEach(() => {
      service.onModuleDestroy();
      activity = new ChatActivityNotifier();
      service = build(transport, {}, activity);
    });

    it('the row keeps waiting and is held: one log line with ids only, no audit row, no failed attempt', async () => {
      transport.refusedUsers.add(DISCORD_ID);
      waiting();
      ended('completed', `The answer ${MARKER}`);
      expect(await service.tick()).toBe(1);
      expect(transport.directMessages).toEqual([]);
      expect(deliveries.rows[0].status).toBe('waiting');
      expect(held()).toBe(1);
      expect(logs.filter((line) => line.startsWith('chat delivery held'))).toEqual([HELD_LINE]);

      // The poller skips the held row: nothing read, nothing sent, no retry counted, no audit, no new line.
      reads.mockClear();
      for (const wait of [...CHAT_DELIVERY_LIMITS.backoffMs, 60 * 1000]) {
        now += wait;
        expect(await service.tick()).toBe(0);
      }
      expect(reads).not.toHaveBeenCalled();
      expect(deliveries.rows[0].status).toBe('waiting');
      expect(audit).toEqual([]);
      expect(logs.filter((line) => line.startsWith('chat delivery held'))).toHaveLength(1);
      expect(logs.some((line) => line.includes('send failed') || line.includes('delivery failed'))).toBe(false);
    });

    it('the user’s next command or button press (the notifier) sends it and the row is delivered', async () => {
      transport.refusedUsers.add(DISCORD_ID);
      waiting();
      ended('completed', `The answer ${MARKER}`);
      await service.tick();
      expect(held()).toBe(1);

      // Another user, or another channel: nothing happens.
      activity.notify('discord', OTHER_DISCORD);
      expect(await service.resume('line' as never, DISCORD_ID)).toBe(0);
      expect(held()).toBe(1);

      // The user runs a command: the transport can now answer them (a follow-up in Discord).
      transport.refusedUsers.delete(DISCORD_ID);
      activity.notify('discord', DISCORD_ID);
      await settle(() => deliveries.rows[0].status === 'delivered');
      expect(transport.directMessages).toEqual([{ externalUserId: DISCORD_ID, message: { text: `The answer ${MARKER}` } }]);
      expect(deliveries.rows[0].status).toBe('delivered');
      expect(held()).toBe(0);
      expect(logs).toContain(`chat delivery resumed linkId=${LINK_ID} runs=1`);
      expect(audit).toEqual([
        expect.objectContaining({
          eventType: 'result_delivered',
          payload: { channel: 'discord', linkId: LINK_ID, collaborationRunId: RUN_ID, outcome: 'completed', parts: 1, cut: 0 },
        }),
      ]);
    });

    it('a part already sent is not sent again: only the rest goes out after the hold', async () => {
      const sent: string[] = [];
      let blocked = false;
      transport.sendToUser = async (_id, message) => {
        if (blocked) throw new ChatDirectMessageRefusedError();
        sent.push(message.text);
        blocked = true;
      };
      waiting();
      ended('completed', `${'a'.repeat(1800)}\n\n${'b'.repeat(1800)}`);
      await service.tick();
      expect(sent).toEqual(['a'.repeat(1800)]);
      expect(held()).toBe(1);
      blocked = false;
      transport.sendToUser = async (_id, message) => void sent.push(message.text);
      expect(await service.resume('discord', DISCORD_ID)).toBe(1);
      expect(sent).toEqual(['a'.repeat(1800), 'b'.repeat(1800)]);
      expect(deliveries.rows[0].status).toBe('delivered');
      expect(audit[0].payload).toMatchObject({ outcome: 'completed', parts: 2 });
    });

    it('a held row is dropped at 24 hours like any waiting row; the poller keeps running until then', async () => {
      transport.refusedUsers.add(DISCORD_ID);
      waiting();
      ended('completed', MARKER);
      service.wake();
      await service.tick();
      expect(await service.tick()).toBe(0);
      expect(service.polling).toBe(true);
      now = T0 + DAY + 1;
      await service.tick();
      expect(deliveries.rows[0].status).toBe('dropped');
      expect(held()).toBe(0);
      expect(logs).toContain(`chat delivery dropped runId=${RUN_ID} linkId=${LINK_ID} reason=too_old`);
      await service.tick();
      expect(service.polling).toBe(false);
      expect(transport.directMessages).toEqual([]);
      expect(audit).toEqual([]);
    });

    it('an approval notice that is refused is held and not marked; the next command sends it and marks it', async () => {
      transport.refusedUsers.add(DISCORD_ID);
      waiting();
      runs.set(RUN_ID, {
        run: { userId: OWNER, status: 'active' },
        referrals: [{ referralId: 'r2', status: 'pending_approval', result: null }],
      });
      await service.tick();
      expect(deliveries.rows[0].notifiedReferralIds).toEqual([]);
      expect(held()).toBe(1);
      expect(logs).toContain(HELD_LINE);
      expect(logs.some((line) => line.startsWith('chat delivery notice failed'))).toBe(false);
      transport.refusedUsers.delete(DISCORD_ID);
      expect(await service.resume('discord', DISCORD_ID)).toBe(1);
      expect(transport.directMessages.map((entry) => entry.message.text)).toEqual([chatReply('en', 'result.waitingApproval')]);
      expect(deliveries.rows[0]).toMatchObject({ status: 'waiting', notifiedReferralIds: ['r2'] });
      expect(audit).toEqual([]);
    });

    it('held rows do not take the batch from other users', async () => {
      links.set(LINK_2, { id: LINK_2, userId: OWNER, externalUserId: OTHER_DISCORD, locale: 'en' });
      transport.refusedUsers.add(DISCORD_ID);
      for (let i = 0; i < CHAT_DELIVERY_LIMITS.batch; i += 1) {
        const runId = `held-${String(i).padStart(2, '0')}`;
        waiting(runId, new Date(T0 + i));
        ended('completed', MARKER, runId);
      }
      await service.tick();
      expect(held()).toBe(CHAT_DELIVERY_LIMITS.batch);
      deliveries.rows.push({
        ...newRowDefaults(),
        collaborationRunId: 'other-run',
        linkId: LINK_2,
        status: 'waiting',
        notifiedReferralIds: [],
        createdAt: new Date(T0 + 100),
        deliveredAt: null,
      });
      ended('completed', 'Other answer', 'other-run');
      expect(await service.tick()).toBe(1);
      expect(transport.directMessages).toEqual([{ externalUserId: OTHER_DISCORD, message: { text: 'Other answer' } }]);
    });

    it('resume does nothing without holds, under Jest unless allowed, or after shutdown', async () => {
      expect(await service.resume('discord', DISCORD_ID)).toBe(0);
      expect(reads).not.toHaveBeenCalled();
      const idle = build(transport, { allowUnderJest: false }, new ChatActivityNotifier());
      expect(await idle.resume('discord', DISCORD_ID)).toBe(0);
      transport.refusedUsers.add(DISCORD_ID);
      waiting();
      ended('completed', MARKER);
      await service.tick();
      service.onModuleDestroy();
      activity.notify('discord', DISCORD_ID);
      expect(await service.resume('discord', DISCORD_ID)).toBe(0);
      expect(transport.directMessages).toEqual([]);
    });

    it('end to end through the Discord transport: refused, held, then a follow-up after the next command’s own reply', async () => {
      const order: string[] = [];
      const followUps: Array<{ token: string; body: Record<string, unknown> }> = [];
      const gateway = new EventEmitter() as EventEmitter & { connect: () => Promise<void>; destroy: () => void };
      gateway.connect = () => new Promise<void>(() => undefined);
      gateway.destroy = () => undefined;
      const discordCalls: DiscordCalls = {
        reply: async () => void order.push('reply'),
        defer: async () => undefined,
        editReply: async () => undefined,
        deleteReply: async () => undefined,
        registerGlobalCommands: async () => undefined,
        sendDirectMessage: async () => {
          order.push('dm');
          throw Object.assign(new Error('Cannot send messages to this user'), { status: 403, code: 50278 });
        },
        updateMessage: async () => undefined,
        deferUpdate: async () => undefined,
        followUp: async (_appId, token, body) => {
          order.push('followUp');
          followUps.push({ token, body: body as never });
        },
      };
      const discord = new DiscordTransport({
        env: { CHAT_DISCORD_ENABLED: 'true', DISCORD_BOT_TOKEN: 'test-token-value' },
        factory: async (): Promise<DiscordConnection> => ({ calls: discordCalls, gateway, close: () => undefined }),
        now: () => now,
      });
      // The command handler tells the notifier, as ChatCommandService does.
      await discord.connect(async (invocation) => {
        activity.notify('discord', invocation.externalUserId);
        return { text: 'status reply' };
      });
      gateway.emit('ready', { application: { id: '111111111111111111' }, user: { id: '222222222222222222' } }, 0);
      await settle(() => discord.state === 'ready');
      service.onModuleDestroy();
      service = build(discord, {}, activity);

      waiting();
      ended('completed', `The answer @everyone ${MARKER}`);
      await service.tick();
      expect(order).toEqual(['dm']);
      expect(held()).toBe(1);
      expect(deliveries.rows[0].status).toBe('waiting');

      gateway.emit(
        'dispatch',
        {
          t: 'INTERACTION_CREATE',
          d: {
            id: '444444444444444444',
            application_id: '111111111111111111',
            type: 2,
            token: 'user-install-token',
            context: 1,
            authorizing_integration_owners: { '1': DISCORD_ID },
            user: { id: DISCORD_ID, username: 'someone' },
            data: { type: 1, name: 'status', options: [] },
          },
        },
        0,
      );
      await settle(() => deliveries.rows[0].status === 'delivered');
      expect(order).toEqual(['dm', 'reply', 'followUp']);
      expect(followUps).toEqual([
        {
          token: 'user-install-token',
          body: { content: `The answer @everyone ${MARKER}`, allowed_mentions: { parse: [] } },
        },
      ]);
      expect(deliveries.rows[0].status).toBe('delivered');
      expect(audit.map((row) => row.eventType)).toEqual(['result_delivered']);
      await discord.disconnect();
    });
  });

  describe('CHAT-STATE-PERSIST-01: a restart (a new service instance over the same rows) continues where it stopped', () => {
    const LONG = Array.from({ length: 200 }, (_, i) => `${i} ${MARKER} ${'word '.repeat(60)}`).join('\n\n');

    function expectedParts(): string[] {
      const result = chatResultMessages('en', 'completed', runs.get(RUN_ID)!.referrals as never);
      expect(result?.parts).toHaveLength(5);
      return result!.parts;
    }

    function restart(activity?: ChatActivityNotifier): ChatDeliveryService {
      service.onModuleDestroy();
      service = build(transport, {}, activity);
      return service;
    }

    it('a crashed process left part 2 of 5 sent and its claim ran out: the new instance takes the row over and sends parts 3 to 5 only', async () => {
      ended('completed', LONG);
      waiting(RUN_ID, new Date(T0), { partsSent: 2, claimedBy: 'dead-process-0000-0000-000000000000', claimedUntil: new Date(now - 1) });
      const parts = expectedParts();
      restart();
      expect(await service.tick()).toBe(1);
      expect(transport.directMessages.map((entry) => entry.message.text)).toEqual(parts.slice(2));
      // Each part carries its dedupe key (run id and part number), the Discord nonce's source.
      expect(transport.dedupeKeys).toEqual([`chat-result:${RUN_ID}:3`, `chat-result:${RUN_ID}:4`, `chat-result:${RUN_ID}:5`]);
      expect(deliveries.rows[0]).toMatchObject({ status: 'delivered', partsSent: 5, claimedBy: null, claimedUntil: null });
      expect(audit[0].payload).toMatchObject({ outcome: 'completed', parts: 5 });
    });

    it('each part is written (compare-and-set on parts_sent under the claim) before the next part is sent', async () => {
      ended('completed', LONG);
      waiting();
      const seen: Array<{ part: number; partsSent: number; claimedBy: string | null; claimedUntil: number | null }> = [];
      transport.sendToUser = async (_id, message, options) => {
        const row = deliveries.rows[0];
        seen.push({
          part: Number(options?.dedupeKey?.split(':').pop()),
          partsSent: row.partsSent,
          claimedBy: row.claimedBy,
          claimedUntil: row.claimedUntil ? row.claimedUntil.getTime() : null,
        });
        transport.directMessages.push({ externalUserId: DISCORD_ID, message });
      };
      await service.tick();
      expect(seen.map((entry) => [entry.part, entry.partsSent])).toEqual([[1, 0], [2, 1], [3, 2], [4, 3], [5, 4]]);
      for (const entry of seen) {
        expect(entry.claimedBy).toBe(service.claimId);
        expect(entry.claimedBy).toMatch(/^[0-9a-f-]{36}$/);
        expect(entry.claimedUntil).toBeGreaterThan(now - 5 * 1000);
      }
      const advances = deliveries.updates.filter((entry) => 'partsSent' in entry.patch);
      expect(advances.map((entry) => [(entry.where as Record<string, unknown>).partsSent, entry.patch.partsSent])).toEqual([
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
      ]);
      for (const entry of advances) {
        expect(entry.where).toMatchObject({ collaborationRunId: RUN_ID, status: 'waiting', claimedBy: service.claimId });
      }
      expect(deliveries.rows[0]).toMatchObject({ status: 'delivered', claimedBy: null, claimedUntil: null });
    });

    it('failures and backoff carry over a restart; the fourth failure fails the row with one audit row', async () => {
      ended('completed', LONG);
      waiting();
      let sends = 0;
      const failAfterTwo = async (_id: string, message: { text: string }) => {
        sends += 1;
        if (sends > 2) throw new Error(`discord said ${MARKER}`);
        transport.directMessages.push({ externalUserId: DISCORD_ID, message });
      };
      transport.sendToUser = failAfterTwo;
      // The backoff counts from the start of the pass (the one-second spacing moves the test clock on).
      const passStart = now;
      await service.tick();
      expect(transport.directMessages).toHaveLength(2);
      expect(deliveries.rows[0]).toMatchObject({ partsSent: 2, sendFailures: 1, nextAttemptAt: new Date(passStart + 10 * 1000) });

      // A restart inside the backoff: nothing is tried early.
      restart();
      transport.sendToUser = failAfterTwo;
      now += 5 * 1000;
      expect(await service.tick()).toBe(0);
      expect(sends).toBe(3);

      for (const [index, wait] of CHAT_DELIVERY_LIMITS.backoffMs.entries()) {
        now += wait;
        restart();
        transport.sendToUser = failAfterTwo;
        await service.tick();
        expect(sends).toBe(4 + index);
      }
      expect(deliveries.rows[0].status).toBe('failed');
      expect(audit).toEqual([
        expect.objectContaining({
          eventType: 'delivery_failed',
          payload: { channel: 'discord', linkId: LINK_ID, collaborationRunId: RUN_ID, attempts: 4, partsSent: 2, reason: 'Error' },
        }),
      ]);
      expect(transport.directMessages).toHaveLength(2);
    });

    it('a held row stays held after a restart: no send and no log line; the next command clears the hold and the rest goes out', async () => {
      ended('completed', LONG);
      waiting();
      let sends = 0;
      transport.sendToUser = async (_id, message) => {
        sends += 1;
        if (sends > 1) throw new ChatDirectMessageRefusedError();
        transport.directMessages.push({ externalUserId: DISCORD_ID, message });
      };
      await service.tick();
      expect(held()).toBe(1);
      expect(deliveries.rows[0]).toMatchObject({ partsSent: 1, sendFailures: 0, heldAt: new Date(now) });
      expect(logs.filter((line) => line.startsWith('chat delivery held'))).toHaveLength(1);

      const activity = new ChatActivityNotifier();
      restart(activity);
      service.wake();
      reads.mockClear();
      for (let i = 0; i < 3; i += 1) {
        now += 60 * 1000;
        expect(await service.tick()).toBe(0);
      }
      expect(reads).not.toHaveBeenCalled();
      expect(sends).toBe(2);
      expect(logs.filter((line) => line.startsWith('chat delivery held'))).toHaveLength(1);
      // The poller keeps running while a held row waits (it is dropped at 24 hours).
      expect(service.polling).toBe(true);

      transport.sendToUser = async (_id, message) => void transport.directMessages.push({ externalUserId: DISCORD_ID, message });
      expect(await service.resume('discord', DISCORD_ID)).toBe(1);
      expect(transport.directMessages.map((entry) => entry.message.text)).toEqual(expectedParts());
      expect(deliveries.rows[0]).toMatchObject({ status: 'delivered', heldAt: null, partsSent: 5 });
      expect(logs).toContain(`chat delivery resumed linkId=${LINK_ID} runs=1`);
    });

    it('a held row is dropped at 24 hours by another instance', async () => {
      transport.refusedUsers.add(DISCORD_ID);
      ended('completed', MARKER);
      waiting();
      await service.tick();
      expect(held()).toBe(1);
      restart();
      now = T0 + DAY + 1;
      await service.tick();
      expect(deliveries.rows[0].status).toBe('dropped');
      expect(logs).toContain(`chat delivery dropped runId=${RUN_ID} linkId=${LINK_ID} reason=too_old`);
      expect(transport.directMessages).toEqual([]);
    });

    it('a row another process has claimed is skipped (no read, no send); once its claim runs out it is taken over', async () => {
      ended('completed', `The answer ${MARKER}`);
      waiting(RUN_ID, new Date(T0), { claimedBy: 'other-process-0000-0000-000000000000', claimedUntil: new Date(now + 30 * 1000) });
      expect(await service.tick()).toBe(0);
      expect(reads).not.toHaveBeenCalled();
      expect(transport.directMessages).toEqual([]);
      expect(deliveries.rows[0]).toMatchObject({ status: 'waiting', claimedBy: 'other-process-0000-0000-000000000000' });

      now += 30 * 1000 + 1;
      expect(await service.tick()).toBe(1);
      expect(transport.directMessages.map((entry) => entry.message.text)).toEqual([`The answer ${MARKER}`]);
      expect(deliveries.rows[0]).toMatchObject({ status: 'delivered', claimedBy: null });
    });

    it('the claim is one UPDATE that succeeds only without a live claim', async () => {
      ended('completed', MARKER);
      waiting();
      await service.tick();
      const claim = deliveries.updates.find((entry) => 'claimedBy' in entry.patch && entry.patch.claimedBy !== null)!;
      expect(Array.isArray(claim.where)).toBe(true);
      const [noClaim, expired] = claim.where as Array<Record<string, FindOperator<unknown> | string>>;
      expect(noClaim).toMatchObject({ collaborationRunId: RUN_ID, status: 'waiting' });
      expect((noClaim.claimedUntil as FindOperator<unknown>).type).toBe('isNull');
      expect((expired.claimedUntil as FindOperator<unknown>).type).toBe('lessThan');
      expect(claim.patch.claimedUntil).toEqual(new Date(T0 + 60 * 1000 + CHAT_DELIVERY_LIMITS.claimMs));
    });

    it('two processes over the same rows: each part goes out once', async () => {
      ended('completed', LONG);
      waiting();
      const other = build();
      await Promise.all([service.tick(), other.tick()]);
      await Promise.all([service.tick(), other.tick()]);
      expect(transport.directMessages.map((entry) => entry.message.text)).toEqual(expectedParts());
      expect(audit.filter((row) => row.eventType === 'result_delivered')).toHaveLength(1);
      other.onModuleDestroy();
    });

    it('a lost compare-and-set (another process moved the row on) stops sending at once', async () => {
      ended('completed', LONG);
      waiting();
      transport.sendToUser = async (_id, message) => {
        transport.directMessages.push({ externalUserId: DISCORD_ID, message });
        // While the first part is in flight the claim runs out and another process takes the row.
        deliveries.rows[0].claimedBy = 'other-process-0000-0000-000000000000';
      };
      await service.tick();
      expect(transport.directMessages).toHaveLength(1);
      expect(deliveries.rows[0]).toMatchObject({ status: 'waiting', partsSent: 0, claimedBy: 'other-process-0000-0000-000000000000' });
      expect(logs).toContain(`chat delivery claim lost runId=${RUN_ID} linkId=${LINK_ID} partsSent=1`);
      expect(audit).toEqual([]);
    });

    it('a row in backoff does not take a place in the batch', async () => {
      for (let i = 0; i < CHAT_DELIVERY_LIMITS.batch; i += 1) {
        const runId = `backoff-${String(i).padStart(2, '0')}`;
        waiting(runId, new Date(T0 + i), { sendFailures: 1, nextAttemptAt: new Date(now + 10 * 1000) });
        ended('completed', MARKER, runId);
      }
      waiting('ready-run', new Date(T0 + 100));
      ended('completed', 'Ready answer', 'ready-run');
      expect(await service.tick()).toBe(1);
      expect(transport.directMessages.map((entry) => entry.message.text)).toEqual(['Ready answer']);
    });

    it('approval notices carry no dedupe key (only result parts do)', async () => {
      waiting();
      runs.set(RUN_ID, {
        run: { userId: OWNER, status: 'active' },
        referrals: [{ referralId: 'r2', status: 'pending_approval', result: null }],
      });
      await service.tick();
      expect(transport.directMessages).toHaveLength(1);
      expect(transport.dedupeKeys).toEqual([undefined]);
    });
  });

  describe('poller', () => {
    it('never runs under Jest unless allowed, and boot never waits', () => {
      const idle = build(transport, { allowUnderJest: false });
      idle.onApplicationBootstrap();
      idle.wake();
      expect(idle.polling).toBe(false);
    });

    it('wakes on start, stops when nothing waits, and stops on shutdown', async () => {
      jest.useFakeTimers();
      try {
        const tick = jest.spyOn(service, 'tick');
        service.wake();
        service.wake();
        expect(service.polling).toBe(true);
        jest.advanceTimersByTime(CHAT_DELIVERY_LIMITS.intervalMs);
        expect(tick).toHaveBeenCalledTimes(1);
        await tick.mock.results[0].value;
        expect(service.polling).toBe(false);

        waiting();
        runs.set(RUN_ID, { run: { userId: OWNER, status: 'active' }, referrals: [] });
        service.wake();
        jest.advanceTimersByTime(CHAT_DELIVERY_LIMITS.intervalMs);
        await tick.mock.results[1].value;
        expect(service.polling).toBe(true);
        service.onModuleDestroy();
        expect(service.polling).toBe(false);
        service.wake();
        expect(service.polling).toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });

    it('the switch off: nothing is read or sent and the poller stops', async () => {
      process.env.CHAT_DISCORD_ENABLED = 'false';
      waiting();
      ended('completed', MARKER);
      service.wake();
      expect(await service.tick()).toBe(0);
      expect(reads).not.toHaveBeenCalled();
      expect(transport.directMessages).toEqual([]);
      expect(service.polling).toBe(false);
    });

    it('reads at most 20 waiting rows a tick, oldest first', async () => {
      for (let i = 0; i < 25; i += 1) {
        waiting(`run-${String(i).padStart(2, '0')}`, new Date(T0 + i));
        runs.set(`run-${String(i).padStart(2, '0')}`, { run: { userId: OWNER, status: 'active' }, referrals: [] });
      }
      expect(await service.tick()).toBe(20);
      expect(reads).toHaveBeenCalledTimes(20);
      expect(reads.mock.calls[0][0]).toBe('run-00');
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
