import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { FindOperator } from 'typeorm';
import { ChatLimitHit } from '../entities/chat-limit-hit.entity';
import {
  CHAT_LIMIT_PRUNE_AFTER_MS,
  ChatLimits,
  chatLimitLockKey,
  chatLimitSubjectOfExternalUser,
  MemoryChatLimitStore,
  RepositoryChatLimitStore,
} from './chat-limits';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const T0 = Date.parse('2026-11-19T10:00:00.000Z');
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const FAILURES = { threshold: 100, windowMs: HOUR, pauseBucket: 'link_pause' as const, pauseMs: HOUR };

/**
 * CHAT-STATE-PERSIST-01: the persisted chat limits. Every "restart" below is a
 * new ChatLimits over the same store (the table).
 */
describe('ChatLimits (CHAT-STATE-PERSIST-01)', () => {
  let store: MemoryChatLimitStore;
  let limits: ChatLimits;

  beforeEach(() => {
    store = new MemoryChatLimitStore();
    limits = ChatLimits.inMemory(store);
  });

  describe('take', () => {
    it('counts inside the window; at the limit it refuses, does not count, and says when to try again from the oldest row', async () => {
      for (let i = 0; i < 5; i += 1) {
        expect(await limits.take('code_create', OWNER, { limit: 5, windowMs: HOUR }, T0 + i * MINUTE)).toEqual({ allowed: true });
      }
      expect(await limits.take('code_create', OWNER, { limit: 5, windowMs: HOUR }, T0 + 10 * MINUTE)).toEqual({
        allowed: false,
        retryAfterSeconds: (HOUR - 10 * MINUTE) / 1000,
      });
      expect(store.rows).toHaveLength(5);
      // Another subject or bucket is counted on its own.
      expect((await limits.take('code_create', OTHER, { limit: 5, windowMs: HOUR }, T0)).allowed).toBe(true);
      expect((await limits.take('command', OWNER, { limit: 5, windowMs: HOUR }, T0)).allowed).toBe(true);
    });

    it('the count survives a restart: the sixth is refused by a new instance', async () => {
      for (let i = 0; i < 5; i += 1) {
        await limits.take('code_create', OWNER, { limit: 5, windowMs: HOUR }, T0 + i);
      }
      const restarted = ChatLimits.inMemory(store);
      expect((await restarted.take('code_create', OWNER, { limit: 5, windowMs: HOUR }, T0 + 10)).allowed).toBe(false);
    });

    it('rows older than the window are deleted on the write, and the slot is free again', async () => {
      for (let i = 0; i < 10; i += 1) {
        await limits.take('command', OWNER, { limit: 10, windowMs: MINUTE }, T0 + i);
      }
      expect((await limits.take('command', OWNER, { limit: 10, windowMs: MINUTE }, T0 + MINUTE - 1)).allowed).toBe(false);
      expect((await limits.take('command', OWNER, { limit: 10, windowMs: MINUTE }, T0 + MINUTE)).allowed).toBe(true);
      expect(store.rows.filter((row) => row.bucket === 'command')).toHaveLength(10);
      expect(Math.min(...store.rows.map((row) => row.at))).toBe(T0 + 1);
    });

    it('two processes cannot both take the last slot (the count and the insert hold the lock)', async () => {
      const a = ChatLimits.inMemory(store);
      const b = ChatLimits.inMemory(store);
      const results = await Promise.all(
        Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? a : b).take('command', OWNER, { limit: 10, windowMs: MINUTE }, T0)),
      );
      expect(results.filter((result) => result.allowed)).toHaveLength(10);
      expect(store.rows).toHaveLength(10);
    });

    it('a store error is thrown to the caller (which refuses the action)', async () => {
      const broken = ChatLimits.inMemory({
        locked: async () => {
          throw new Error('db down');
        },
        times: async () => [],
        pruneUpTo: async () => 0,
      });
      await expect(broken.take('command', OWNER, { limit: 10, windowMs: MINUTE }, T0)).rejects.toThrow('db down');
      await expect(broken.recordFailure('claim_failed', 'discord', FAILURES, T0)).rejects.toThrow('db down');
    });
  });

  describe('recordFailure and the pause', () => {
    it('failure 101 within the hour pauses once; the failures are cleared; a restart does not reset either', async () => {
      for (let i = 0; i < 60; i += 1) {
        expect(await limits.recordFailure('claim_failed', 'discord', FAILURES, T0 + i)).toEqual({ paused: false, failedAttempts: i + 1 });
      }
      limits = ChatLimits.inMemory(store);
      for (let i = 60; i < 100; i += 1) {
        await limits.recordFailure('claim_failed', 'discord', FAILURES, T0 + i);
      }
      expect(await limits.isPaused('link_pause', 'discord', HOUR, T0 + 100)).toBe(false);
      expect(await limits.recordFailure('claim_failed', 'discord', FAILURES, T0 + 100)).toEqual({ paused: true, failedAttempts: 101 });
      expect(store.rows.filter((row) => row.bucket === 'link_pause')).toEqual([{ bucket: 'link_pause', subjectKey: 'discord', at: T0 + 100 }]);
      expect(store.rows.filter((row) => row.bucket === 'claim_failed')).toEqual([]);

      const restarted = ChatLimits.inMemory(store);
      expect(await restarted.isPaused('link_pause', 'discord', HOUR, T0 + 100 + HOUR - 1)).toBe(true);
      expect(await restarted.isPaused('link_pause', 'discord', HOUR, T0 + 100 + HOUR)).toBe(false);
    });

    it('while a pause is live, more failures never write a second pause row', async () => {
      for (let i = 0; i < 101; i += 1) {
        await limits.recordFailure('claim_failed', 'discord', FAILURES, T0);
      }
      for (let i = 0; i < 101; i += 1) {
        expect((await limits.recordFailure('claim_failed', 'discord', FAILURES, T0 + MINUTE)).paused).toBe(false);
      }
      expect(store.rows.filter((row) => row.bucket === 'link_pause')).toHaveLength(1);
    });

    it('two processes counting at once: exactly one is told paused (one audit row)', async () => {
      const a = ChatLimits.inMemory(store);
      const b = ChatLimits.inMemory(store);
      const results = await Promise.all(
        Array.from({ length: 110 }, (_, i) => (i % 2 === 0 ? a : b).recordFailure('claim_failed', 'discord', FAILURES, T0)),
      );
      expect(results.filter((result) => result.paused)).toHaveLength(1);
      expect(store.rows.filter((row) => row.bucket === 'link_pause')).toHaveLength(1);
    });

    it('failures older than the window do not count', async () => {
      for (let i = 0; i < 100; i += 1) {
        await limits.recordFailure('claim_failed', 'discord', FAILURES, T0);
      }
      expect(await limits.recordFailure('claim_failed', 'discord', FAILURES, T0 + HOUR)).toEqual({ paused: false, failedAttempts: 1 });
    });
  });

  it('prune deletes every row older than an hour (the delivery pass)', async () => {
    expect(CHAT_LIMIT_PRUNE_AFTER_MS).toBe(HOUR);
    store.rows.push(
      { bucket: 'command', subjectKey: OWNER, at: T0 - HOUR - 1 },
      { bucket: 'claim_attempt', subjectKey: 'x', at: T0 - HOUR },
      { bucket: 'code_create', subjectKey: OWNER, at: T0 - HOUR + 1 },
    );
    expect(await limits.prune(T0)).toBe(2);
    expect(store.rows.map((row) => row.bucket)).toEqual(['code_create']);
  });

  it('the claim subject is the SHA-256 hex of the Discord id (64 characters, never the id)', () => {
    const subject = chatLimitSubjectOfExternalUser('987654321098765432');
    expect(subject).toBe(createHash('sha256').update('987654321098765432').digest('hex'));
    expect(subject).toMatch(/^[0-9a-f]{64}$/);
    expect(subject).not.toContain('987654321098765432');
  });

  it('the lock key is a signed 64-bit integer, stable per bucket and subject', () => {
    const key = chatLimitLockKey('claim_failed', 'discord');
    expect(key).toBe(chatLimitLockKey('claim_failed', 'discord'));
    expect(key).not.toBe(chatLimitLockKey('claim_failed', 'other'));
    expect(key).not.toBe(chatLimitLockKey('command', 'discord'));
    const value = BigInt(key);
    expect(value >= -(BigInt(2) ** BigInt(63)) && value < BigInt(2) ** BigInt(63)).toBe(true);
  });

  describe('RepositoryChatLimitStore (the TypeORM store; no database is started)', () => {
    function fakeRepository() {
      const calls: string[] = [];
      const inner = {
        find: jest.fn(async (options: Record<string, unknown>) => {
          calls.push('find');
          void options;
          return [{ occurredAt: new Date(T0 - 2 * MINUTE) }, { occurredAt: new Date(T0 - MINUTE) }];
        }),
        insert: jest.fn(async (row: Record<string, unknown>) => {
          calls.push('insert');
          void row;
          return {};
        }),
        delete: jest.fn(async (where: Record<string, unknown>) => {
          calls.push('delete');
          void where;
          return { affected: 1 };
        }),
      };
      const manager = {
        query: jest.fn(async (sql: string, parameters: unknown[]) => {
          calls.push(`query:${sql}:${JSON.stringify(parameters)}`);
          return [];
        }),
        getRepository: jest.fn((target: unknown) => {
          calls.push(target === ChatLimitHit ? 'getRepository:ChatLimitHit' : 'getRepository:other');
          return inner;
        }),
      };
      const repository = {
        ...inner,
        manager: {
          transaction: jest.fn(async (work: (m: typeof manager) => Promise<unknown>) => {
            calls.push('begin');
            const result = await work(manager);
            calls.push('commit');
            return result;
          }),
        },
      };
      return { repository, inner, manager, calls };
    }

    it('take runs in one transaction: the advisory lock first, then the delete, the count and the insert', async () => {
      const fake = fakeRepository();
      const repoLimits = new ChatLimits(fake.repository as never);
      expect(await repoLimits.take('command', OWNER, { limit: 10, windowMs: MINUTE }, T0)).toEqual({ allowed: true });
      expect(fake.calls).toEqual([
        'begin',
        `query:SELECT pg_advisory_xact_lock($1::bigint):${JSON.stringify([chatLimitLockKey('command', OWNER)])}`,
        'getRepository:ChatLimitHit',
        'delete',
        'find',
        'insert',
        'commit',
      ]);
      const deleted = fake.inner.delete.mock.calls[0][0] as Record<string, unknown>;
      expect(deleted).toMatchObject({ bucket: 'command', subjectKey: OWNER });
      expect((deleted.occurredAt as FindOperator<Date>).type).toBe('lessThanOrEqual');
      expect((deleted.occurredAt as FindOperator<Date>).value).toEqual(new Date(T0 - MINUTE));
      const read = fake.inner.find.mock.calls[0][0] as { where: Record<string, unknown>; order: unknown };
      expect(read.where).toMatchObject({ bucket: 'command', subjectKey: OWNER });
      expect((read.where.occurredAt as FindOperator<Date>).type).toBe('moreThan');
      expect(read.order).toEqual({ occurredAt: 'ASC' });
      expect(fake.inner.insert).toHaveBeenCalledWith({ bucket: 'command', subjectKey: OWNER, occurredAt: new Date(T0) });
    });

    it('at the limit nothing is inserted, and retryAfterSeconds comes from the oldest row', async () => {
      const fake = fakeRepository();
      const repoLimits = new ChatLimits(fake.repository as never);
      expect(await repoLimits.take('code_create', OWNER, { limit: 2, windowMs: HOUR }, T0)).toEqual({
        allowed: false,
        retryAfterSeconds: (HOUR - 2 * MINUTE) / 1000,
      });
      expect(fake.inner.insert).not.toHaveBeenCalled();
    });

    it('isPaused and prune read and delete outside a transaction', async () => {
      const fake = fakeRepository();
      const repoLimits = new ChatLimits(fake.repository as never);
      expect(await repoLimits.isPaused('link_pause', 'discord', HOUR, T0)).toBe(true);
      expect(await repoLimits.prune(T0)).toBe(1);
      expect(fake.repository.manager.transaction).not.toHaveBeenCalled();
      const pruned = fake.inner.delete.mock.calls[0][0] as Record<string, unknown>;
      expect(Object.keys(pruned)).toEqual(['occurredAt']);
      expect((pruned.occurredAt as FindOperator<Date>).value).toEqual(new Date(T0 - HOUR));
    });

    it('a failed transaction is thrown to the caller', async () => {
      const fake = fakeRepository();
      fake.repository.manager.transaction.mockRejectedValueOnce(new Error('could not serialize'));
      await expect(new ChatLimits(fake.repository as never).take('command', OWNER, { limit: 1, windowMs: MINUTE }, T0)).rejects.toThrow(
        'could not serialize',
      );
    });

    it('Nest injects the chat_limit_hits repository; without it the limits are in memory', async () => {
      const fake = fakeRepository();
      const moduleRef = await Test.createTestingModule({
        providers: [ChatLimits, { provide: getRepositoryToken(ChatLimitHit), useValue: fake.repository }],
      }).compile();
      await moduleRef.get(ChatLimits).take('command', OWNER, { limit: 10, windowMs: MINUTE }, T0);
      expect(fake.repository.manager.transaction).toHaveBeenCalledTimes(1);
      expect(new RepositoryChatLimitStore(fake.repository as never)).toBeInstanceOf(RepositoryChatLimitStore);

      const bare = await Test.createTestingModule({ providers: [ChatLimits] }).compile();
      expect((await bare.get(ChatLimits).take('command', OWNER, { limit: 1, windowMs: MINUTE }, T0)).allowed).toBe(true);
      expect((await bare.get(ChatLimits).take('command', OWNER, { limit: 1, windowMs: MINUTE }, T0)).allowed).toBe(false);
    });
  });
});
