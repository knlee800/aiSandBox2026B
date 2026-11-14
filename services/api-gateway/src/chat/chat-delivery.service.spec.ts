import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { CHAT_DELIVERY_LIMITS, ChatDeliveryService } from './chat-delivery.service';
import { chatReply } from './chat-replies';
import { FakeChatTransport } from './chat-transport';
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
};

function asNumber(value: unknown): number {
  return value instanceof Date ? value.getTime() : Number(value);
}

function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected instanceof FindOperator) {
      if (expected.type === 'in') return (expected.value as unknown[]).includes(actual);
      if (expected.type === 'lessThan') return asNumber(actual) < asNumber(expected.value);
      throw new Error(`unsupported operator ${expected.type}`);
    }
    return actual === expected;
  });
}

class DeliveryRepo {
  rows: Row[] = [];
  async find(options: { where: Record<string, unknown>; take?: number }): Promise<Row[]> {
    return this.rows
      .filter((row) => matches(row, options.where))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, options.take ?? Infinity)
      .map((row) => ({ ...row, notifiedReferralIds: [...row.notifiedReferralIds] }));
  }
  async update(where: Record<string, unknown>, patch: Partial<Row>): Promise<{ affected: number }> {
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

  function build(target: { sendDirectMessage: unknown; state: unknown } = transport, options: Record<string, unknown> = {}) {
    return new ChatDeliveryService(
      target as never,
      { getCollaborationRunWithReferrals: reads } as never,
      deliveries as never,
      { findOne: async ({ where }: { where: { id: string } }) => links.get(where.id) ?? null } as never,
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
    );
  }

  function waiting(runId = RUN_ID, createdAt = new Date(T0)): void {
    deliveries.rows.push({
      collaborationRunId: runId,
      linkId: LINK_ID,
      status: 'waiting',
      notifiedReferralIds: [],
      createdAt,
      deliveredAt: null,
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
    transport.sendDirectMessage = async () => {
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
    transport.sendDirectMessage = async (_id, message) => {
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
      deliveries.rows.push({ collaborationRunId: id, linkId: LINK_ID, status, notifiedReferralIds: [], createdAt, deliveredAt: null });
    }
    expect(await service.prune()).toBe(3);
    expect(deliveries.rows.map((row) => row.collaborationRunId)).toEqual(['d-new', 'w-old']);
    expect(logs).toContain('chat deliveries pruned count=3');
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
