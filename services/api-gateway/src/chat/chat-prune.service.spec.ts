import { Logger } from '@nestjs/common';
import { ChatLimits, MemoryChatLimitStore } from './chat-limits';
import { CHAT_PRUNE_INTERVAL_MS, ChatPruneService } from './chat-prune.service';

const HOUR = 60 * 60 * 1000;
const T0 = Date.parse('2026-11-19T10:00:00.000Z');

describe('ChatPruneService (CHAT-PRUNE-01)', () => {
  const originalSwitch = process.env.CHAT_DISCORD_ENABLED;
  let now: number;
  let logs: string[];
  let warns: string[];
  let spies: jest.SpyInstance[];
  let services: ChatPruneService[];

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    now = T0;
    logs = [];
    warns = [];
    services = [];
    spies = [
      jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => void logs.push(String(message))),
      jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => void warns.push(String(message))),
    ];
    delete process.env.CHAT_DISCORD_ENABLED;
  });

  afterEach(() => {
    for (const service of services) service.onModuleDestroy();
    spies.forEach((spy) => spy.mockRestore());
    jest.useRealTimers();
    if (originalSwitch === undefined) delete process.env.CHAT_DISCORD_ENABLED;
    else process.env.CHAT_DISCORD_ENABLED = originalSwitch;
  });

  function build(
    overrides: {
      codes?: () => Promise<number>;
      deliveries?: () => Promise<number>;
      limits?: ChatLimits | undefined;
      approvals?: { pruneExpired: () => Promise<number> } | undefined;
      options?: Record<string, unknown>;
    } = {},
  ) {
    const codes = jest.fn(overrides.codes ?? (async () => 0));
    const deliveries = jest.fn(overrides.deliveries ?? (async () => 0));
    const service = new ChatPruneService(
      { pruneExpiredCodes: codes } as never,
      { prune: deliveries } as never,
      overrides.limits,
      overrides.approvals as never,
      { allowUnderJest: true, now: () => now, ...overrides.options },
    );
    services.push(service);
    return { service, codes, deliveries };
  }

  it('one pass deletes from each table and logs one counts-only line; recent limit rows stay', async () => {
    const rows = new MemoryChatLimitStore();
    rows.rows.push(
      { bucket: 'command', subjectKey: '1234567890123456', at: now - HOUR - 1 },
      { bucket: 'command', subjectKey: '1234567890123456', at: now - 1000 },
    );
    const approvals = { pruneExpired: jest.fn(async () => 4) };
    const { service, codes, deliveries } = build({
      codes: async () => 2,
      deliveries: async () => 3,
      limits: ChatLimits.inMemory(rows),
      approvals,
    });

    const result = await service.runOnce();

    expect(result).toEqual({ linkCodes: 2, deliveries: 3, limitHits: 1, approvalTokens: 4, failed: [] });
    expect(codes).toHaveBeenCalledWith(T0);
    expect(deliveries).toHaveBeenCalledTimes(1);
    expect(approvals.pruneExpired).toHaveBeenCalledTimes(1);
    expect(rows.rows).toHaveLength(1);
    expect(logs).toEqual(['chat prune linkCodes=2 deliveries=3 limitHits=1 approvalTokens=4']);
  });

  it('logs nothing when nothing was deleted', async () => {
    const { service } = build({
      limits: ChatLimits.inMemory(new MemoryChatLimitStore()),
      approvals: { pruneExpired: async () => 0 },
    });
    await service.runOnce();
    expect(logs).toEqual([]);
    expect(warns).toEqual([]);
  });

  it('a failing step is logged with a reason code only and the others still run', async () => {
    const secret = new Error('boom 123456789012345678 display name');
    secret.name = 'QueryFailedError';
    const { service, deliveries } = build({
      codes: async () => {
        throw secret;
      },
      deliveries: async () => 5,
      limits: ChatLimits.inMemory(new MemoryChatLimitStore()),
      approvals: {
        pruneExpired: async () => {
          throw new Error('x');
        },
      },
    });

    const result = await service.runOnce();

    expect(result).toEqual({
      linkCodes: 0,
      deliveries: 5,
      limitHits: 0,
      approvalTokens: 0,
      failed: ['link_codes', 'approval_tokens'],
    });
    expect(deliveries).toHaveBeenCalledTimes(1);
    expect(warns).toEqual([
      'chat prune step failed step=link_codes reason=QueryFailedError',
      'chat prune step failed step=approval_tokens reason=Error',
    ]);
    expect(JSON.stringify([...warns, ...logs])).not.toContain('123456789012345678');
    expect(logs).toEqual(['chat prune linkCodes=0 deliveries=5 limitHits=0 approvalTokens=0']);
  });

  it('runs at boot and then every hour with the Discord switch off, and never overlaps itself', async () => {
    expect(process.env.CHAT_DISCORD_ENABLED).toBeUndefined();
    let release: () => void = () => undefined;
    let first = true;
    const { service, deliveries } = build({
      deliveries: () => {
        if (first) {
          first = false;
          return new Promise<number>((resolve) => {
            release = () => resolve(0);
          });
        }
        return Promise.resolve(0);
      },
    });

    service.onApplicationBootstrap();
    expect(service.scheduled).toBe(true);
    await jest.advanceTimersByTimeAsync(0);
    expect(deliveries).toHaveBeenCalledTimes(1);

    // The first pass is still running when the hour comes: that tick is skipped.
    await jest.advanceTimersByTimeAsync(CHAT_PRUNE_INTERVAL_MS);
    expect(deliveries).toHaveBeenCalledTimes(1);
    expect(await service.runOnce()).toBeNull();

    release();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(CHAT_PRUNE_INTERVAL_MS);
    expect(deliveries).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(CHAT_PRUNE_INTERVAL_MS);
    expect(deliveries).toHaveBeenCalledTimes(3);
  });

  it('the timer is unref d', () => {
    const unref = jest.fn();
    const spy = jest.spyOn(global, 'setInterval').mockReturnValue({ unref } as never);
    try {
      const { service } = build({ options: { intervalMs: 1000 } });
      service.start();
      expect(unref).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('does nothing under Jest unless allowed', async () => {
    const { service, deliveries } = build({ options: { allowUnderJest: false } });
    service.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(CHAT_PRUNE_INTERVAL_MS * 2);
    expect(service.scheduled).toBe(false);
    expect(deliveries).not.toHaveBeenCalled();
  });

  it('is stopped on module destroy and does not start again', async () => {
    const { service, deliveries } = build();
    service.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    expect(deliveries).toHaveBeenCalledTimes(1);

    service.onModuleDestroy();
    expect(service.scheduled).toBe(false);
    await jest.advanceTimersByTimeAsync(CHAT_PRUNE_INTERVAL_MS * 3);
    expect(deliveries).toHaveBeenCalledTimes(1);
    service.start();
    expect(service.scheduled).toBe(false);
  });

  it('works without the optional limit and approval services', async () => {
    const { service } = build({ codes: async () => 1 });
    expect(await service.runOnce()).toEqual({
      linkCodes: 1,
      deliveries: 0,
      limitHits: 0,
      approvalTokens: 0,
      failed: [],
    });
  });
});
