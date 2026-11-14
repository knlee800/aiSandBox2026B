import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ChatLink } from '../entities/chat-link.entity';
import { ChatRunDelivery } from '../entities/chat-run-delivery.entity';
import type { CollaborationReferralEntity } from '../orchestration/collaboration-referral.entity';
import { finalAnswerOf } from '../orchestration/collaboration-results';
import type { CollaborationReferral } from '../orchestration/orchestration.contracts';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { chunkChatText } from './chat-chunk';
import { CHAT_AUDIT_CATEGORY, CHAT_CHANNEL_DISCORD, ChatLinkLocale, normalizeChatLocale } from './chat-link.service';
import { chatReply, ChatReplyKey } from './chat-replies';
import { isChatDiscordEnabled } from './chat-switch';
import { CHAT_TRANSPORT, ChatTransport } from './chat-transport';

/**
 * CHAT-DISCORD-01 slice C1 (stage-start sections 6.3, 7; decisions D5, D6):
 * results of chat-started runs, sent back by direct message.
 *
 * The poller reads each waiting delivery's run the way the Team page's poll
 * does (OrchestrationService.getCollaborationRunWithReferrals, which syncs
 * and settles; nothing about settling changes). It runs every 10 seconds
 * while a delivery waits and stops when none does; a start wakes it and the
 * boot wakes it once to pick up rows from before a restart. It never runs
 * under Jest unless a test allows it, never blocks the boot (an unref'd
 * timer) and never overlaps itself. Each tick reads at most 20 rows.
 *
 * - Run still active: each hand-off newly waiting for approval gets one
 *   "waiting for your approval on the Team page" line (slice C2 adds buttons).
 * - Run completed: the final answer (the Results page's rule: the last
 *   completed hand-off's answer) in parts of at most 1900 characters, at most
 *   5 parts, the fifth ending with the cut notice. No answer: one line.
 * - Run failed, timed out or cancelled: one translated line, no raw text.
 * - Every message goes through the transport, which sends it with mentions
 *   off (allowed_mentions parse []). At most one message a second per owner.
 * - Sending fails: retried 3 times with backoff (10 s, 30 s, 90 s), then the
 *   row is failed and a delivery_failed audit row is written. The result is
 *   on the Results page in every case. result_seen_at is never touched.
 * - Transport not connected: the row keeps waiting (no attempt counted).
 * - A row older than 24 hours without an end, a run that is gone or not the
 *   link owner's, or a link that is gone: dropped.
 * - Delivered, failed and dropped rows older than 30 days are pruned.
 *
 * Log lines and audit rows carry ids, states, reason codes and counts only:
 * never the answer, the task, the outside user id or any Discord text.
 */

export const CHAT_RUN_AUDIT_EVENTS = {
  runStarted: 'run_started',
  runRefused: 'run_refused',
  resultDelivered: 'result_delivered',
  deliveryFailed: 'delivery_failed',
} as const;

export const CHAT_DELIVERY_LIMITS = {
  intervalMs: 10 * 1000,
  batch: 20,
  maxAgeMs: 24 * 60 * 60 * 1000,
  retentionMs: 30 * 24 * 60 * 60 * 1000,
  retries: 3,
  backoffMs: [10 * 1000, 30 * 1000, 90 * 1000] as readonly number[],
  spacingMs: 1000,
} as const;

/** Optional provider token: tests pass options (allowUnderJest, clock, sleep). */
export const CHAT_DELIVERY_OPTIONS = Symbol('CHAT_DELIVERY_OPTIONS');

export interface ChatDeliveryOptions {
  allowUnderJest?: boolean;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  intervalMs?: number;
  spacingMs?: number;
}

export type ChatDeliveryOutcome = 'completed' | 'no_answer' | 'failed' | 'timed_out' | 'cancelled';

interface AttemptState {
  failures: number;
  nextAt: number;
  partsSent: number;
}

const END_LINES: Readonly<Record<Exclude<ChatDeliveryOutcome, 'completed'>, ChatReplyKey>> = {
  no_answer: 'result.noAnswer',
  failed: 'result.failed',
  timed_out: 'result.timedOut',
  cancelled: 'result.cancelled',
};

function errorName(error: unknown): string {
  const name = error instanceof Error ? error.name : 'Error';
  return /^[A-Za-z0-9_[\]]{1,64}$/.test(name) ? name : 'Error';
}

/** The Results page's final answer rule over the Team page's read (run order). */
export function chatFinalAnswer(referrals: readonly CollaborationReferral[]): string | null {
  const rows = referrals.map(
    (referral) =>
      ({ status: referral.status, resultSummary: referral.result?.summary ?? null }) as unknown as CollaborationReferralEntity,
  );
  const answer = finalAnswerOf(rows);
  return typeof answer === 'string' && answer.trim().length > 0 ? answer : null;
}

/** The messages for an ended run, or null while it is active. */
export function chatResultMessages(
  locale: ChatLinkLocale,
  status: string,
  referrals: readonly CollaborationReferral[],
): { outcome: ChatDeliveryOutcome; parts: string[]; cut: boolean } | null {
  if (status === 'completed') {
    const answer = chatFinalAnswer(referrals);
    if (answer === null) {
      return { outcome: 'no_answer', parts: [chatReply(locale, END_LINES.no_answer)], cut: false };
    }
    const chunks = chunkChatText(answer, chatReply(locale, 'result.cut'));
    return { outcome: 'completed', parts: chunks.parts, cut: chunks.cut };
  }
  if (status === 'failed' || status === 'timed_out' || status === 'cancelled') {
    return { outcome: status, parts: [chatReply(locale, END_LINES[status])], cut: false };
  }
  return null;
}

@Injectable()
export class ChatDeliveryService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('ChatDelivery');
  private readonly testEnvironment: boolean;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly intervalMs: number;
  private readonly spacingMs: number;
  private readonly attempts = new Map<string, AttemptState>();
  private readonly lastSentAt = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private destroyed = false;

  constructor(
    @Inject(CHAT_TRANSPORT) private readonly transport: ChatTransport,
    private readonly orchestration: OrchestrationService,
    @InjectRepository(ChatRunDelivery)
    private readonly deliveries: Repository<ChatRunDelivery>,
    @InjectRepository(ChatLink)
    private readonly links: Repository<ChatLink>,
    @InjectRepository(AuditEventEntity)
    private readonly audit: Repository<AuditEventEntity>,
    @Optional() @Inject(CHAT_DELIVERY_OPTIONS) options?: ChatDeliveryOptions,
  ) {
    this.testEnvironment = process.env.JEST_WORKER_ID !== undefined && options?.allowUnderJest !== true;
    this.now = options?.now ?? Date.now;
    this.sleep = options?.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms).unref?.()));
    this.intervalMs = options?.intervalMs ?? CHAT_DELIVERY_LIMITS.intervalMs;
    this.spacingMs = options?.spacingMs ?? CHAT_DELIVERY_LIMITS.spacingMs;
  }

  onApplicationBootstrap(): void {
    this.wake();
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    this.stopTimer();
  }

  /** True while the poller's timer runs. */
  get polling(): boolean {
    return this.timer !== null;
  }

  /** Starts the poller if it is not running. Never under Jest unless allowed. Never throws. */
  wake(): void {
    if (this.testEnvironment || this.destroyed || this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    this.timer.unref?.();
  }

  /** One poll: prune, then up to 20 waiting rows. Returns the number of waiting rows read. */
  async tick(): Promise<number> {
    if (this.ticking) {
      return 0;
    }
    this.ticking = true;
    try {
      if (!isChatDiscordEnabled()) {
        this.stopTimer();
        return 0;
      }
      await this.prune();
      const rows = await this.deliveries.find({
        where: { status: 'waiting' },
        order: { createdAt: 'ASC' },
        take: CHAT_DELIVERY_LIMITS.batch,
      });
      if (rows.length === 0) {
        this.stopTimer();
        return 0;
      }
      for (const row of rows) {
        try {
          await this.deliverOne(row);
        } catch (error) {
          this.logger.warn(`chat delivery read failed runId=${row.collaborationRunId} reason=${errorName(error)}`);
        }
      }
      return rows.length;
    } catch (error) {
      this.logger.warn(`chat delivery tick failed reason=${errorName(error)}`);
      return 0;
    } finally {
      this.ticking = false;
    }
  }

  /** Deletes delivered, failed and dropped rows older than 30 days. */
  async prune(): Promise<number> {
    const before = new Date(this.now() - CHAT_DELIVERY_LIMITS.retentionMs);
    const result = await this.deliveries.delete({
      status: In(['delivered', 'failed', 'dropped']),
      createdAt: LessThan(before),
    });
    const pruned = result.affected ?? 0;
    if (pruned > 0) {
      this.logger.log(`chat deliveries pruned count=${pruned}`);
    }
    return pruned;
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async deliverOne(row: ChatRunDelivery): Promise<void> {
    const runId = row.collaborationRunId;
    const now = this.now();
    const state = this.attempts.get(runId);
    if (state && state.nextAt > now) {
      return;
    }
    if (now - new Date(row.createdAt).getTime() > CHAT_DELIVERY_LIMITS.maxAgeMs) {
      await this.finish(row, 'dropped', 'too_old');
      return;
    }
    const link = await this.links.findOne({ where: { id: row.linkId } });
    if (!link) {
      await this.finish(row, 'dropped', 'no_link');
      return;
    }
    const detail = await this.orchestration.getCollaborationRunWithReferrals(runId);
    if (!detail || detail.run.userId !== link.userId) {
      await this.finish(row, 'dropped', 'no_run');
      return;
    }
    const locale = normalizeChatLocale(link.locale);

    if (detail.run.status === 'active') {
      await this.announceWaiting(row, link, locale, detail.referrals);
      return;
    }
    const result = chatResultMessages(locale, detail.run.status, detail.referrals);
    if (!result) {
      await this.finish(row, 'dropped', 'unknown_status');
      return;
    }
    if (this.transport.state !== 'ready') {
      return;
    }

    const attempt = state ?? { failures: 0, nextAt: 0, partsSent: 0 };
    try {
      while (attempt.partsSent < result.parts.length) {
        await this.send(link, result.parts[attempt.partsSent]);
        attempt.partsSent += 1;
      }
    } catch (error) {
      attempt.failures += 1;
      if (attempt.failures > CHAT_DELIVERY_LIMITS.retries) {
        this.attempts.delete(runId);
        await this.finish(row, 'failed', 'send_failed');
        await this.writeAudit(CHAT_RUN_AUDIT_EVENTS.deliveryFailed, link.userId, runId, {
          channel: CHAT_CHANNEL_DISCORD,
          linkId: row.linkId,
          collaborationRunId: runId,
          attempts: attempt.failures,
          partsSent: attempt.partsSent,
          reason: errorName(error),
        });
        return;
      }
      attempt.nextAt = now + CHAT_DELIVERY_LIMITS.backoffMs[attempt.failures - 1];
      this.attempts.set(runId, attempt);
      this.logger.warn(
        `chat delivery send failed runId=${runId} linkId=${row.linkId} attempt=${attempt.failures} reason=${errorName(error)}`,
      );
      return;
    }
    this.attempts.delete(runId);
    await this.finish(row, 'delivered', result.outcome);
    await this.writeAudit(CHAT_RUN_AUDIT_EVENTS.resultDelivered, link.userId, runId, {
      channel: CHAT_CHANNEL_DISCORD,
      linkId: row.linkId,
      collaborationRunId: runId,
      outcome: result.outcome,
      parts: result.parts.length,
      cut: result.cut ? 1 : 0,
    });
  }

  /** C1: one line per hand-off newly waiting for approval (decide on the Team page). */
  private async announceWaiting(
    row: ChatRunDelivery,
    link: ChatLink,
    locale: ChatLinkLocale,
    referrals: readonly CollaborationReferral[],
  ): Promise<void> {
    const notified = Array.isArray(row.notifiedReferralIds) ? row.notifiedReferralIds : [];
    const fresh = referrals.filter(
      (referral) => referral.status === 'pending_approval' && !notified.includes(referral.referralId),
    );
    if (fresh.length === 0 || this.transport.state !== 'ready') {
      return;
    }
    try {
      await this.send(link, chatReply(locale, 'result.waitingApproval'));
    } catch (error) {
      this.logger.warn(
        `chat delivery notice failed runId=${row.collaborationRunId} linkId=${row.linkId} reason=${errorName(error)}`,
      );
      return;
    }
    const next = [...notified, ...fresh.map((referral) => referral.referralId)];
    await this.deliveries.update({ collaborationRunId: row.collaborationRunId }, { notifiedReferralIds: next });
    this.logger.log(
      `chat delivery approval notice runId=${row.collaborationRunId} linkId=${row.linkId} waiting=${fresh.length}`,
    );
  }

  /** One message, at most one a second per owner. The transport sends it with mentions off. */
  private async send(link: ChatLink, text: string): Promise<void> {
    const last = this.lastSentAt.get(link.id);
    const now = this.now();
    if (last !== undefined && now - last < this.spacingMs) {
      await this.sleep(this.spacingMs - (now - last));
    }
    await this.transport.sendDirectMessage(link.externalUserId, { text });
    this.lastSentAt.set(link.id, this.now());
  }

  private async finish(
    row: ChatRunDelivery,
    status: 'delivered' | 'failed' | 'dropped',
    reason: string,
  ): Promise<void> {
    await this.deliveries.update(
      { collaborationRunId: row.collaborationRunId, status: 'waiting' },
      status === 'delivered' ? { status, deliveredAt: new Date(this.now()) } : { status },
    );
    this.logger.log(
      `chat delivery ${status} runId=${row.collaborationRunId} linkId=${row.linkId} reason=${reason}`,
    );
  }

  private async writeAudit(
    eventType: string,
    userId: string,
    collaborationRunId: string,
    payload: Record<string, string | number>,
  ): Promise<void> {
    try {
      await this.audit.insert({
        category: CHAT_AUDIT_CATEGORY,
        eventType,
        subjectType: 'collaboration_run',
        subjectId: collaborationRunId,
        userId,
        payload,
        occurredAt: new Date(this.now()),
      });
    } catch (error) {
      this.logger.warn(`chat delivery audit insert failed event=${eventType} reason=${errorName(error)}`);
    }
  }
}
