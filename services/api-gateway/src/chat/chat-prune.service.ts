import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { ChatApprovalService } from './chat-approval.service';
import { ChatDeliveryService } from './chat-delivery.service';
import { ChatLimits } from './chat-limits';
import { ChatLinkService } from './chat-link.service';

/** CHAT-PRUNE-01: the prune runs once an hour. */
export const CHAT_PRUNE_INTERVAL_MS = 60 * 60 * 1000;

/** Optional provider token: tests pass options (allowUnderJest, now, intervalMs). */
export const CHAT_PRUNE_OPTIONS = Symbol('CHAT_PRUNE_OPTIONS');

export interface ChatPruneOptions {
  allowUnderJest?: boolean;
  now?: () => number;
  intervalMs?: number;
}

/** What one pass deleted, by step. A failed step counts 0 and is named in `failed`. */
export interface ChatPruneResult {
  linkCodes: number;
  deliveries: number;
  limitHits: number;
  approvalTokens: number;
  failed: string[];
}

function errorName(error: unknown): string {
  const name = error instanceof Error ? error.name : 'Error';
  return /^[A-Za-z0-9_[\]]{1,64}$/.test(name) ? name : 'Error';
}

/**
 * CHAT-PRUNE-01: old chat rows are deleted on a schedule whether or not
 * Discord is switched on (the delivery poll only prunes while it is on and a
 * delivery waits; link codes were only deleted inside link calls). At boot and
 * then hourly it deletes expired chat_link_codes, delivered, failed and
 * dropped chat_run_deliveries older than 30 days, chat_limit_hits older than
 * an hour and expired chat_approval_tokens, by calling each owner's existing
 * prune. The timer is unref'd, a pass never overlaps another, nothing runs
 * under Jest unless a test allows it, and the module's destroy stops it.
 * Each step is independent: a failing step is logged with a reason code and
 * the others still run. One counts-only line per pass when anything went.
 */
@Injectable()
export class ChatPruneService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('ChatPrune');
  private readonly testEnvironment: boolean;
  private readonly now: () => number;
  private readonly intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private destroyed = false;

  constructor(
    private readonly links: ChatLinkService,
    private readonly deliveries: ChatDeliveryService,
    @Optional() private readonly limits?: ChatLimits,
    @Optional() private readonly approvals?: ChatApprovalService,
    @Optional() @Inject(CHAT_PRUNE_OPTIONS) options?: ChatPruneOptions,
  ) {
    this.testEnvironment = process.env.JEST_WORKER_ID !== undefined && options?.allowUnderJest !== true;
    this.now = options?.now ?? Date.now;
    this.intervalMs = options?.intervalMs ?? CHAT_PRUNE_INTERVAL_MS;
  }

  onApplicationBootstrap(): void {
    this.start();
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    this.stop();
  }

  /** True while the hourly timer runs. */
  get scheduled(): boolean {
    return this.timer !== null;
  }

  /** Runs a pass now and starts the hourly timer. Never under Jest unless allowed. Never throws. */
  start(): void {
    if (this.testEnvironment || this.destroyed || this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.intervalMs);
    this.timer.unref?.();
    void this.runOnce();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** One pass over the four tables. Returns null when a pass is already running. Never throws. */
  async runOnce(): Promise<ChatPruneResult | null> {
    if (this.running) {
      return null;
    }
    this.running = true;
    const result: ChatPruneResult = { linkCodes: 0, deliveries: 0, limitHits: 0, approvalTokens: 0, failed: [] };
    try {
      const now = this.now();
      result.linkCodes = await this.step(result, 'link_codes', () => this.links.pruneExpiredCodes(now));
      result.deliveries = await this.step(result, 'deliveries', () => this.deliveries.prune());
      if (this.limits) {
        const limits = this.limits;
        result.limitHits = await this.step(result, 'limit_hits', () => limits.prune(now));
      }
      if (this.approvals) {
        const approvals = this.approvals;
        result.approvalTokens = await this.step(result, 'approval_tokens', () => approvals.pruneExpired());
      }
      const total = result.linkCodes + result.deliveries + result.limitHits + result.approvalTokens;
      if (total > 0) {
        this.logger.log(
          `chat prune linkCodes=${result.linkCodes} deliveries=${result.deliveries} limitHits=${result.limitHits} approvalTokens=${result.approvalTokens}`,
        );
      }
    } finally {
      this.running = false;
    }
    return result;
  }

  private async step(result: ChatPruneResult, name: string, run: () => Promise<number>): Promise<number> {
    try {
      return await run();
    } catch (error) {
      result.failed.push(name);
      this.logger.warn(`chat prune step failed step=${name} reason=${errorName(error)}`);
      return 0;
    }
  }
}
