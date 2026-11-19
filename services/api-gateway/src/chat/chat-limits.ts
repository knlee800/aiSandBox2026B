import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { EntityManager, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { ChatLimitBucket, ChatLimitHit } from '../entities/chat-limit-hit.entity';

/**
 * CHAT-STATE-PERSIST-01 (stage-start sections 2, 3.2, 3.4, 5): the chat
 * channel's limits, counted from rows in chat_limit_hits, so a restart does
 * not reset them and two gateway processes share them.
 *
 * - take: counts the rows of a bucket and subject inside a sliding window; at
 *   the limit the action is refused (and not counted) with retryAfterSeconds
 *   from the oldest row in the window; otherwise one row is added.
 * - recordFailure: adds one failure; when the failures in the window pass the
 *   threshold and no pause is live, one pause row is added and the failures
 *   are cleared (as the in-memory counter was). Only the caller that wrote
 *   the pause row is told paused, so only one audit row is written.
 * - isPaused: a pause row younger than the pause length.
 * - Every counting call runs in one transaction under
 *   pg_advisory_xact_lock on (bucket, subject), so two processes cannot both
 *   take the last slot. Rows of the bucket and subject older than the window
 *   are deleted on every write; prune (the delivery pass) deletes every row
 *   older than one hour, the longest window.
 * - A store error is thrown to the caller, which refuses the action.
 * Subjects: an owner id, the SHA-256 hex of a Discord user id
 * (chatLimitSubjectOfExternalUser; never the id itself), or the channel name.
 */

/** Rows older than this are deleted by the delivery pass (the longest window: codes, claims and the pause). */
export const CHAT_LIMIT_PRUNE_AFTER_MS = 60 * 60 * 1000;

/** Optional provider token: tests pass a store (for example a MemoryChatLimitStore shared by two instances). */
export const CHAT_LIMIT_STORE = Symbol('CHAT_LIMIT_STORE');

export interface ChatLimitRule {
  limit: number;
  windowMs: number;
}

export interface ChatFailureRule {
  /** More failures than this in the window pause. */
  threshold: number;
  windowMs: number;
  pauseBucket: ChatLimitBucket;
  pauseMs: number;
}

export type ChatLimitTake = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface ChatFailureResult {
  /** True only for the caller that wrote the pause row. */
  paused: boolean;
  /** Failures counted in the window (including this one) when it was decided. */
  failedAttempts: number;
}

/** The rows of the store, inside or outside a lock. Times are epoch milliseconds. */
export interface ChatLimitRows {
  /** occurred_at of the rows after `after`, oldest first. */
  times(bucket: ChatLimitBucket, subjectKey: string, after: Date): Promise<number[]>;
  add(bucket: ChatLimitBucket, subjectKey: string, at: Date): Promise<void>;
  /** Deletes the rows at or before `atOrBefore`. */
  removeUpTo(bucket: ChatLimitBucket, subjectKey: string, atOrBefore: Date): Promise<number>;
  removeAll(bucket: ChatLimitBucket, subjectKey: string): Promise<number>;
}

export interface ChatLimitStore {
  /** Runs work in one transaction holding the lock on (bucket, subject). */
  locked<T>(bucket: ChatLimitBucket, subjectKey: string, work: (rows: ChatLimitRows) => Promise<T>): Promise<T>;
  times(bucket: ChatLimitBucket, subjectKey: string, after: Date): Promise<number[]>;
  /** Deletes every row at or before `atOrBefore`. */
  pruneUpTo(atOrBefore: Date): Promise<number>;
}

/** The SHA-256 hex of an outside user id: the claim limit's subject. The id itself is never stored. */
export function chatLimitSubjectOfExternalUser(externalUserId: string): string {
  return createHash('sha256').update(externalUserId).digest('hex');
}

/** The advisory lock key of (bucket, subject): the first 8 bytes of a SHA-256, as a signed 64-bit decimal. */
export function chatLimitLockKey(bucket: ChatLimitBucket, subjectKey: string): string {
  return createHash('sha256').update(`chat_limit_hits:${bucket}:${subjectKey}`).digest().readBigInt64BE(0).toString();
}

function rowsOf(repository: Repository<ChatLimitHit>): ChatLimitRows {
  return {
    async times(bucket, subjectKey, after) {
      const rows = await repository.find({
        where: { bucket, subjectKey, occurredAt: MoreThan(after) },
        order: { occurredAt: 'ASC' },
        select: { occurredAt: true },
      });
      return rows.map((row) => new Date(row.occurredAt).getTime());
    },
    async add(bucket, subjectKey, at) {
      await repository.insert({ bucket, subjectKey, occurredAt: at });
    },
    async removeUpTo(bucket, subjectKey, atOrBefore) {
      const result = await repository.delete({ bucket, subjectKey, occurredAt: LessThanOrEqual(atOrBefore) });
      return result.affected ?? 0;
    },
    async removeAll(bucket, subjectKey) {
      const result = await repository.delete({ bucket, subjectKey });
      return result.affected ?? 0;
    },
  };
}

/** chat_limit_hits through TypeORM: one transaction per counting call, under pg_advisory_xact_lock. */
export class RepositoryChatLimitStore implements ChatLimitStore {
  constructor(private readonly hits: Repository<ChatLimitHit>) {}

  locked<T>(bucket: ChatLimitBucket, subjectKey: string, work: (rows: ChatLimitRows) => Promise<T>): Promise<T> {
    return this.hits.manager.transaction(async (manager: EntityManager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1::bigint)', [chatLimitLockKey(bucket, subjectKey)]);
      return work(rowsOf(manager.getRepository(ChatLimitHit)));
    });
  }

  times(bucket: ChatLimitBucket, subjectKey: string, after: Date): Promise<number[]> {
    return rowsOf(this.hits).times(bucket, subjectKey, after);
  }

  async pruneUpTo(atOrBefore: Date): Promise<number> {
    const result = await this.hits.delete({ occurredAt: LessThanOrEqual(atOrBefore) });
    return result.affected ?? 0;
  }
}

/**
 * The same store in memory, with the lock as a queue per (bucket, subject).
 * Used when ChatLimits is built without a repository (a service constructed
 * outside ChatModule, for example in tests); one instance can be shared by
 * several services to stand for the table across a restart.
 */
export class MemoryChatLimitStore implements ChatLimitStore {
  readonly rows: Array<{ bucket: ChatLimitBucket; subjectKey: string; at: number }> = [];
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly memoryRows: ChatLimitRows = {
    times: async (bucket, subjectKey, after) =>
      this.rows
        .filter((row) => row.bucket === bucket && row.subjectKey === subjectKey && row.at > after.getTime())
        .map((row) => row.at)
        .sort((a, b) => a - b),
    add: async (bucket, subjectKey, at) => {
      this.rows.push({ bucket, subjectKey, at: at.getTime() });
    },
    removeUpTo: async (bucket, subjectKey, atOrBefore) =>
      this.remove((row) => row.bucket === bucket && row.subjectKey === subjectKey && row.at <= atOrBefore.getTime()),
    removeAll: async (bucket, subjectKey) => this.remove((row) => row.bucket === bucket && row.subjectKey === subjectKey),
  };

  locked<T>(bucket: ChatLimitBucket, subjectKey: string, work: (rows: ChatLimitRows) => Promise<T>): Promise<T> {
    const key = `${bucket}:${subjectKey}`;
    const before = this.queues.get(key) ?? Promise.resolve();
    const run = before.catch(() => undefined).then(() => work(this.memoryRows));
    this.queues.set(key, run.catch(() => undefined));
    return run;
  }

  times(bucket: ChatLimitBucket, subjectKey: string, after: Date): Promise<number[]> {
    return this.memoryRows.times(bucket, subjectKey, after);
  }

  async pruneUpTo(atOrBefore: Date): Promise<number> {
    return this.remove((row) => row.at <= atOrBefore.getTime());
  }

  private remove(match: (row: { bucket: ChatLimitBucket; subjectKey: string; at: number }) => boolean): number {
    let removed = 0;
    for (let i = this.rows.length - 1; i >= 0; i -= 1) {
      if (match(this.rows[i])) {
        this.rows.splice(i, 1);
        removed += 1;
      }
    }
    return removed;
  }
}

@Injectable()
export class ChatLimits {
  private readonly store: ChatLimitStore;

  constructor(
    @Optional() @InjectRepository(ChatLimitHit) hits?: Repository<ChatLimitHit>,
    @Optional() @Inject(CHAT_LIMIT_STORE) store?: ChatLimitStore,
  ) {
    this.store = store ?? (hits ? new RepositoryChatLimitStore(hits) : new MemoryChatLimitStore());
  }

  /** Limits over a store in memory (a new one unless given). */
  static inMemory(store: ChatLimitStore = new MemoryChatLimitStore()): ChatLimits {
    return new ChatLimits(undefined, store);
  }

  /** Counts one event unless the subject is at the limit inside the window. Throws on a store error. */
  async take(bucket: ChatLimitBucket, subjectKey: string, rule: ChatLimitRule, now: number): Promise<ChatLimitTake> {
    return this.store.locked(bucket, subjectKey, async (rows) => {
      const windowStart = new Date(now - rule.windowMs);
      await rows.removeUpTo(bucket, subjectKey, windowStart);
      const times = await rows.times(bucket, subjectKey, windowStart);
      if (times.length >= rule.limit) {
        return {
          allowed: false as const,
          retryAfterSeconds: Math.max(1, Math.ceil((times[0] + rule.windowMs - now) / 1000)),
        };
      }
      await rows.add(bucket, subjectKey, new Date(now));
      return { allowed: true as const };
    });
  }

  /** Counts one failure; past the threshold (and no live pause) writes the pause row. Throws on a store error. */
  async recordFailure(
    bucket: ChatLimitBucket,
    subjectKey: string,
    rule: ChatFailureRule,
    now: number,
  ): Promise<ChatFailureResult> {
    return this.store.locked(bucket, subjectKey, async (rows) => {
      const windowStart = new Date(now - rule.windowMs);
      await rows.removeUpTo(bucket, subjectKey, windowStart);
      await rows.add(bucket, subjectKey, new Date(now));
      const failedAttempts = (await rows.times(bucket, subjectKey, windowStart)).length;
      if (failedAttempts <= rule.threshold) {
        return { paused: false, failedAttempts };
      }
      const pauses = await rows.times(rule.pauseBucket, subjectKey, new Date(now - rule.pauseMs));
      if (pauses.length > 0) {
        return { paused: false, failedAttempts };
      }
      await rows.removeUpTo(rule.pauseBucket, subjectKey, new Date(now - rule.pauseMs));
      await rows.add(rule.pauseBucket, subjectKey, new Date(now));
      await rows.removeAll(bucket, subjectKey);
      return { paused: true, failedAttempts };
    });
  }

  /** True while a pause row is younger than pauseMs. Throws on a store error. */
  async isPaused(pauseBucket: ChatLimitBucket, subjectKey: string, pauseMs: number, now: number): Promise<boolean> {
    return (await this.store.times(pauseBucket, subjectKey, new Date(now - pauseMs))).length > 0;
  }

  /** The delivery pass: deletes every row older than one hour. */
  prune(now: number): Promise<number> {
    return this.store.pruneUpTo(new Date(now - CHAT_LIMIT_PRUNE_AFTER_MS));
  }
}
