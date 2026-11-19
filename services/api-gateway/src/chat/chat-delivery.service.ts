import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, IsNull, LessThan, LessThanOrEqual, Not, Repository } from 'typeorm';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ChatLink } from '../entities/chat-link.entity';
import { ChatRunDelivery } from '../entities/chat-run-delivery.entity';
import type { CollaborationReferralEntity } from '../orchestration/collaboration-referral.entity';
import { finalAnswerOf } from '../orchestration/collaboration-results';
import type { CollaborationReferral } from '../orchestration/orchestration.contracts';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { ChatApprovalService } from './chat-approval.service';
import { chunkChatText } from './chat-chunk';
import {
  CHAT_AUDIT_CATEGORY,
  CHAT_CHANNEL_DISCORD,
  ChatChannel,
  ChatLinkLocale,
  normalizeChatLocale,
} from './chat-link.service';
import { chatReply, ChatReplyKey } from './chat-replies';
import { isChatDiscordEnabled } from './chat-switch';
import {
  CHAT_TRANSPORT,
  ChatActivityNotifier,
  ChatDirectMessageRefusedError,
  ChatReplyMessage,
  ChatSendOptions,
  ChatTransport,
  ChatTransportNotReadyError,
} from './chat-transport';

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
 *   message (slice C2, ChatApprovalService.approvalMessage): a positively
 *   read-only step gets its request text cut to 1000 characters with Approve
 *   and Reject buttons; any other step gets the "waiting for your approval on
 *   the Team page" line. Without the approval service (C1): one line for all.
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
 *
 * CHAT-USER-INSTALL-01: every message goes through transport.sendToUser (a
 * follow-up to the user's latest interaction while it is fresh, else the
 * direct message). A direct message Discord refuses
 * (ChatDirectMessageRefusedError) is not a failed attempt: the row stays
 * waiting and is held (held_at on the row), with one log line (`chat delivery held
 * runId=... linkId=... reason=dm_refused`) and no audit row. The poller skips
 * held rows (apart from the 24-hour drop) until that user's next command or
 * button press (ChatActivityNotifier), which releases the user's held rows
 * and runs a pass at once; the transport sends the parts as follow-ups after
 * the command's own answer. Approval notices are held the same way and are
 * marked notified only once sent. The 24-hour drop, the retries for other
 * errors, the part limits, the one-message-a-second spacing and the Results
 * page are unchanged.
 *
 * CHAT-STATE-PERSIST-01 (stage-start sections 3.1, 4, 5): the delivery state
 * lives on the row, so a restart continues where it stopped:
 * - parts_sent: each part's success is written before the next part is sent;
 *   a new pass continues at part parts_sent + 1 (parts are cut again from the
 *   same stored answer, so they are the same parts). Each result part goes
 *   with a dedupe key (run id and part number), which the Discord transport
 *   turns into the direct message's nonce, so a part re-sent after a crash
 *   between Discord's "sent" and the database write is dropped by Discord.
 * - send_failures and next_attempt_at: the retries and their backoff; the
 *   fourth failure still fails the row with one audit row. Rows in backoff
 *   are left out of the pass's query.
 * - held_at: a held row is left out of the pass's query (no direct-message
 *   retry, no log line per restart); the user's next command or press clears
 *   held_at for that link's waiting rows and runs a pass. The 24-hour drop
 *   still applies to held rows.
 * - claimed_by and claimed_until: before working on a row the process claims
 *   it for 120 seconds (one UPDATE that succeeds only when no live claim
 *   exists); each part's write is a compare-and-set on parts_sent under the
 *   claim and extends it; the claim is released at the end of the row, and a
 *   crashed process's claim runs out by itself. Zero rows changed: another
 *   process has the row, so this one stops.
 * - Repair rule (approval buttons): a step that is waiting, already
 *   notified and positively read-only, with no live token row (its buttons
 *   died with an old process or a rollback), gets one fresh message with new
 *   buttons; the new token row stops a second one. Steps that only get the
 *   Team page line are never sent again.
 *
 * CHAT-TIDY-01:
 * - The pass no longer prunes: ChatPruneService (CHAT-PRUNE-01) deletes old
 *   deliveries, limit rows and expired tokens hourly whatever the switch
 *   says, through prune() here and the limit and approval prunes.
 * - A send that finds the transport not ready (ChatTransportNotReadyError)
 *   is not an attempt: the row keeps waiting with no failure and no part
 *   counted; an approval notice is not marked and its buttons are forgotten.
 * - resume() makes at most one query per command and none for a user with
 *   no held row: the process keeps the outside ids of users with held rows
 *   (refreshed from the table on every pass, added on every hold; unknown
 *   until the first pass, when resume reads as before). With the link the
 *   command has already read, the release is one UPDATE by link id.
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
  /** CHAT-STATE-PERSIST-01: a claim on a row lasts this long unless renewed (after each part) or released. */
  claimMs: 120 * 1000,
  /** CHAT-TIDY-01: held rows read per pass to know who has held rows; more makes it unknown (resume reads). */
  heldRead: 500,
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
  /** CHAT-STATE-PERSIST-01: this process's claim id (claimed_by), made at boot. */
  private readonly processId = randomUUID();
  private readonly lastSentAt = new Map<string, number>();
  private readonly stopListening: (() => void) | null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  /** A pass was asked for while one was running: run once more after it. */
  private again = false;
  private destroyed = false;
  /**
   * CHAT-TIDY-01: the outside ids of users with held rows, or null while
   * unknown (before the first pass, or too many held rows). Memory only;
   * never logged.
   */
  private heldUsers: Set<string> | null = null;

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
    @Optional() private readonly approvals?: ChatApprovalService,
    @Optional() activity?: ChatActivityNotifier,
  ) {
    this.testEnvironment = process.env.JEST_WORKER_ID !== undefined && options?.allowUnderJest !== true;
    this.now = options?.now ?? Date.now;
    this.sleep = options?.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms).unref?.()));
    this.intervalMs = options?.intervalMs ?? CHAT_DELIVERY_LIMITS.intervalMs;
    this.spacingMs = options?.spacingMs ?? CHAT_DELIVERY_LIMITS.spacingMs;
    this.stopListening = activity
      ? activity.onActivity((channel, externalUserId, linkId) => {
          void this.resume(channel, externalUserId, linkId);
        })
      : null;
  }

  onApplicationBootstrap(): void {
    this.wake();
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    this.stopTimer();
    this.stopListening?.();
  }

  /** True while the poller's timer runs. */
  get polling(): boolean {
    return this.timer !== null;
  }

  /** CHAT-STATE-PERSIST-01: this process's claim id (what it writes to claimed_by). */
  get claimId(): string {
    return this.processId;
  }

  /**
   * CHAT-USER-INSTALL-01: the outside user used a command or pressed a
   * button. Their held rows are released and a pass runs at once (or right
   * after the one running); the transport sends the messages as follow-ups
   * after the command's own answer. Never throws. Returns the rows released.
   * CHAT-STATE-PERSIST-01: the holds are on the rows (held_at): the user's
   * link is read and held_at is cleared on that link's waiting rows; no link
   * or nothing held: no pass. CHAT-TIDY-01: a user this process knows has no
   * held row costs no query; with knownLinkId (the link the command already
   * read) the release is one UPDATE.
   */
  async resume(channel: ChatChannel, externalUserId: string, knownLinkId?: string): Promise<number> {
    if (channel !== CHAT_CHANNEL_DISCORD || this.testEnvironment || this.destroyed) {
      return 0;
    }
    if (this.heldUsers && !this.heldUsers.has(externalUserId)) {
      return 0;
    }
    // Removed before the release: a hold that lands meanwhile adds the user again.
    this.heldUsers?.delete(externalUserId);
    let released = 0;
    let linkId = '';
    try {
      if (typeof knownLinkId === 'string' && knownLinkId.length > 0) {
        linkId = knownLinkId;
      } else {
        const link = await this.links.findOne({ where: { channel, externalUserId } });
        if (!link) {
          return 0;
        }
        linkId = link.id;
      }
      const result = await this.deliveries.update(
        { linkId, status: 'waiting', heldAt: Not(IsNull()) },
        { heldAt: null },
      );
      released = result.affected ?? 0;
    } catch (error) {
      // Unknown again, so the next command reads instead of skipping.
      this.heldUsers?.add(externalUserId);
      this.logger.warn(`chat delivery resume failed reason=${errorName(error)}`);
      return 0;
    }
    if (released === 0) {
      return 0;
    }
    this.logger.log(`chat delivery resumed linkId=${linkId} runs=${released}`);
    this.wake();
    if (this.ticking) {
      this.again = true;
    } else {
      await this.tick();
    }
    return released;
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

  /** One poll (CHAT-TIDY-01: no prune; ChatPruneService prunes hourly): up to 20 waiting rows. Returns the number read. */
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
      // CHAT-TIDY-01: no prune here; ChatPruneService does it hourly.
      await this.dropOldHolds();
      await this.refreshHeldUsers();
      // CHAT-USER-INSTALL-01 / CHAT-STATE-PERSIST-01: held rows, rows in
      // backoff and rows another process has claimed are left out.
      const now = new Date(this.now());
      const ready = { status: 'waiting' as const, heldAt: IsNull() };
      const rows = await this.deliveries.find({
        where: [
          { ...ready, nextAttemptAt: IsNull(), claimedUntil: IsNull() },
          { ...ready, nextAttemptAt: LessThanOrEqual(now), claimedUntil: IsNull() },
          { ...ready, nextAttemptAt: IsNull(), claimedUntil: LessThan(now) },
          { ...ready, nextAttemptAt: LessThanOrEqual(now), claimedUntil: LessThan(now) },
        ],
        order: { createdAt: 'ASC' },
        take: CHAT_DELIVERY_LIMITS.batch,
      });
      if (rows.length === 0) {
        // Held, backing-off or claimed rows still wait: keep polling (held rows are dropped at 24 hours).
        const waiting = await this.deliveries.find({ where: { status: 'waiting' }, take: 1 });
        if (waiting.length === 0) {
          this.stopTimer();
        }
        return 0;
      }
      for (const row of rows) {
        try {
          await this.deliverClaimed(row);
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
      if (this.again) {
        this.again = false;
        if (!this.destroyed) {
          void this.tick();
        }
      }
    }
  }

  /**
   * CHAT-USER-INSTALL-01: a held row older than 24 hours is dropped (the
   * Results page keeps the result). CHAT-STATE-PERSIST-01: read from held_at.
   */
  private async dropOldHolds(): Promise<void> {
    const cutoff = new Date(this.now() - CHAT_DELIVERY_LIMITS.maxAgeMs);
    const old = await this.deliveries.find({
      where: { status: 'waiting', heldAt: Not(IsNull()), createdAt: LessThan(cutoff) },
      order: { createdAt: 'ASC' },
      take: CHAT_DELIVERY_LIMITS.batch,
    });
    for (const row of old) {
      await this.finish(row, 'dropped', 'too_old');
    }
  }

  /**
   * CHAT-TIDY-01: who has held rows now: the outside ids of the links of the
   * waiting held rows (two reads per pass, ids only). More than heldRead held
   * rows, or a failed read, makes it unknown (resume then reads). Never throws.
   */
  private async refreshHeldUsers(): Promise<void> {
    try {
      const held = await this.deliveries.find({
        where: { status: 'waiting', heldAt: Not(IsNull()) },
        take: CHAT_DELIVERY_LIMITS.heldRead + 1,
      });
      if (held.length > CHAT_DELIVERY_LIMITS.heldRead) {
        this.heldUsers = null;
        return;
      }
      const linkIds = [...new Set(held.map((row) => row.linkId))];
      const users = new Set<string>();
      if (linkIds.length > 0) {
        const links = await this.links.find({ where: { id: In(linkIds) } });
        for (const link of links) {
          users.add(link.externalUserId);
        }
      }
      this.heldUsers = users;
    } catch (error) {
      this.heldUsers = null;
      this.logger.warn(`chat delivery holds read failed reason=${errorName(error)}`);
    }
  }

  /**
   * CHAT-USER-INSTALL-01: holds a row after a refused direct message; one log
   * line, ids only, no audit row. CHAT-STATE-PERSIST-01: held_at is written
   * under this process's claim; a held row is left out of every later pass
   * (in any process, after any restart) until the user is active again.
   * CHAT-TIDY-01: the user is added to the held users at once.
   */
  private async hold(row: ChatRunDelivery, link: ChatLink): Promise<void> {
    this.heldUsers?.add(link.externalUserId);
    await this.deliveries.update(
      { collaborationRunId: row.collaborationRunId, status: 'waiting', claimedBy: this.processId },
      { heldAt: new Date(this.now()) },
    );
    this.logger.log(`chat delivery held runId=${row.collaborationRunId} linkId=${row.linkId} reason=dm_refused`);
  }

  /**
   * CHAT-STATE-PERSIST-01: claims the row (one UPDATE: waiting and no live
   * claim), reads it again under the claim (another process may have moved
   * it on), works on it and releases the claim. Not claimed: skipped.
   */
  private async deliverClaimed(candidate: ChatRunDelivery): Promise<void> {
    const runId = candidate.collaborationRunId;
    if (!(await this.claim(runId))) {
      return;
    }
    try {
      const row = await this.deliveries.findOne({
        where: { collaborationRunId: runId, status: 'waiting', claimedBy: this.processId },
      });
      if (!row || row.heldAt) {
        return;
      }
      if (row.nextAttemptAt && new Date(row.nextAttemptAt).getTime() > this.now()) {
        return;
      }
      await this.deliverOne(row);
    } finally {
      await this.release(runId);
    }
  }

  /** True when this process now holds the row's claim (no claim, or an expired one). */
  private async claim(collaborationRunId: string): Promise<boolean> {
    const now = this.now();
    const result = await this.deliveries.update(
      [
        { collaborationRunId, status: 'waiting', claimedUntil: IsNull() },
        { collaborationRunId, status: 'waiting', claimedUntil: LessThan(new Date(now)) },
      ],
      { claimedBy: this.processId, claimedUntil: new Date(now + CHAT_DELIVERY_LIMITS.claimMs) },
    );
    return (result.affected ?? 0) === 1;
  }

  /** Releases this process's claim on the row; a failure is logged and the claim runs out by itself. */
  private async release(collaborationRunId: string): Promise<void> {
    try {
      await this.deliveries.update(
        { collaborationRunId, claimedBy: this.processId },
        { claimedBy: null, claimedUntil: null },
      );
    } catch (error) {
      this.logger.warn(`chat delivery release failed runId=${collaborationRunId} reason=${errorName(error)}`);
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

    // CHAT-STATE-PERSIST-01: continue at part parts_sent + 1; each part's
    // success is written (compare-and-set under the claim) before the next.
    let partsSent = Math.max(0, Number(row.partsSent ?? 0) || 0);
    while (partsSent < result.parts.length) {
      try {
        await this.send(
          link,
          { text: result.parts[partsSent] },
          { dedupeKey: `chat-result:${runId}:${partsSent + 1}` },
        );
      } catch (error) {
        await this.sendFailed(row, link, partsSent, now, error);
        return;
      }
      const advanced = await this.deliveries.update(
        { collaborationRunId: runId, status: 'waiting', partsSent, claimedBy: this.processId },
        { partsSent: partsSent + 1, claimedUntil: new Date(this.now() + CHAT_DELIVERY_LIMITS.claimMs) },
      );
      if ((advanced.affected ?? 0) !== 1) {
        this.logger.warn(`chat delivery claim lost runId=${runId} linkId=${row.linkId} partsSent=${partsSent + 1}`);
        return;
      }
      partsSent += 1;
    }
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

  /**
   * A part could not be sent. A refused direct message holds the row (not a
   * failed attempt; the parts sent so far are kept). Any other error counts
   * one failure on the row (send_failures, next_attempt_at); the fourth fails
   * the row with one delivery_failed audit row. CHAT-TIDY-01: a transport
   * that is not ready is not an attempt: the row keeps waiting as it is (no
   * failure, the parts sent so far kept) for a later pass.
   */
  private async sendFailed(
    row: ChatRunDelivery,
    link: ChatLink,
    partsSent: number,
    now: number,
    error: unknown,
  ): Promise<void> {
    const runId = row.collaborationRunId;
    if (error instanceof ChatTransportNotReadyError) {
      this.logger.log(`chat delivery not sent runId=${runId} linkId=${row.linkId} reason=not_ready partsSent=${partsSent}`);
      return;
    }
    if (error instanceof ChatDirectMessageRefusedError) {
      await this.hold(row, link);
      return;
    }
    const failures = Math.max(0, Number(row.sendFailures ?? 0) || 0) + 1;
    if (failures > CHAT_DELIVERY_LIMITS.retries) {
      await this.finish(row, 'failed', 'send_failed');
      await this.writeAudit(CHAT_RUN_AUDIT_EVENTS.deliveryFailed, link.userId, runId, {
        channel: CHAT_CHANNEL_DISCORD,
        linkId: row.linkId,
        collaborationRunId: runId,
        attempts: failures,
        partsSent,
        reason: errorName(error),
      });
      return;
    }
    await this.deliveries.update(
      { collaborationRunId: runId, status: 'waiting', claimedBy: this.processId },
      { sendFailures: failures, nextAttemptAt: new Date(now + CHAT_DELIVERY_LIMITS.backoffMs[failures - 1]) },
    );
    this.logger.warn(
      `chat delivery send failed runId=${runId} linkId=${row.linkId} attempt=${failures} reason=${errorName(error)}`,
    );
  }

  /**
   * One message per hand-off newly waiting for approval. C2: the approval
   * message (buttons for a positively read-only step, else the Team page
   * line). C1 without the approval service: one Team page line for all.
   * A step is marked notified only once its message is sent.
   */
  private async announceWaiting(
    row: ChatRunDelivery,
    link: ChatLink,
    locale: ChatLinkLocale,
    referrals: readonly CollaborationReferral[],
  ): Promise<void> {
    const notified = Array.isArray(row.notifiedReferralIds) ? row.notifiedReferralIds : [];
    const waiting = referrals.filter((referral) => referral.status === 'pending_approval');
    const fresh = waiting.filter((referral) => !notified.includes(referral.referralId));
    const approvals = this.approvals;
    if (this.transport.state !== 'ready' || (fresh.length === 0 && (!approvals || waiting.length === 0))) {
      return;
    }
    // CHAT-STATE-PERSIST-01, the repair rule: notified read-only steps with no live token.
    const repairs: CollaborationReferral[] = [];
    if (approvals) {
      for (const referral of waiting) {
        if (notified.includes(referral.referralId) && (await approvals.needsFreshButtons(row.collaborationRunId, referral.referralId))) {
          repairs.push(referral);
        }
      }
    }
    if (fresh.length === 0 && repairs.length === 0) {
      return;
    }
    const sent: string[] = [];
    let repaired = 0;
    let buttons = 0;
    try {
      if (!approvals) {
        await this.send(link, { text: chatReply(locale, 'result.waitingApproval') });
        sent.push(...fresh.map((referral) => referral.referralId));
      } else {
        for (const referral of [...fresh, ...repairs]) {
          const repair = !fresh.includes(referral);
          const step = referrals.indexOf(referral) + 1;
          const message = await approvals.approvalMessage(link, row.collaborationRunId, referral.referralId, step);
          if (repair && !(message.buttons && message.buttons.length > 0)) {
            // No longer read-only or waiting: the Team page line was already sent once.
            continue;
          }
          try {
            await this.send(link, message);
          } catch (error) {
            await approvals.revoke(message);
            throw error;
          }
          if (repair) {
            repaired += 1;
          } else {
            sent.push(referral.referralId);
            if (message.buttons && message.buttons.length > 0) buttons += 1;
          }
        }
      }
    } catch (error) {
      if (error instanceof ChatDirectMessageRefusedError) {
        // CHAT-USER-INSTALL-01: held like a result; the step is not marked, so it is sent on the user's next command.
        await this.hold(row, link);
      } else if (error instanceof ChatTransportNotReadyError) {
        // CHAT-TIDY-01: not an attempt; the step is not marked and is sent on a later pass.
        this.logger.log(`chat delivery notice not sent runId=${row.collaborationRunId} linkId=${row.linkId} reason=not_ready`);
      } else {
        this.logger.warn(
          `chat delivery notice failed runId=${row.collaborationRunId} linkId=${row.linkId} reason=${errorName(error)}`,
        );
      }
    }
    if (repaired > 0) {
      this.logger.log(`chat delivery approval repaired runId=${row.collaborationRunId} linkId=${row.linkId} steps=${repaired}`);
    }
    if (sent.length === 0) {
      return;
    }
    const next = [...notified, ...sent];
    await this.deliveries.update({ collaborationRunId: row.collaborationRunId }, { notifiedReferralIds: next });
    this.logger.log(
      `chat delivery approval notice runId=${row.collaborationRunId} linkId=${row.linkId} waiting=${sent.length} buttons=${buttons}`,
    );
  }

  /**
   * One message, at most one a second per owner. The transport sends it with
   * mentions off: a follow-up to the user's latest interaction when it is
   * fresh, else the direct message (CHAT-USER-INSTALL-01).
   */
  private async send(link: ChatLink, message: ChatReplyMessage, options?: ChatSendOptions): Promise<void> {
    const last = this.lastSentAt.get(link.id);
    const now = this.now();
    if (last !== undefined && now - last < this.spacingMs) {
      await this.sleep(this.spacingMs - (now - last));
    }
    await this.transport.sendToUser(link.externalUserId, message, options);
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
