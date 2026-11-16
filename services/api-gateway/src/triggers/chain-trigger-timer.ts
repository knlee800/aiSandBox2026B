import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CHAIN_TRIGGER_TICK_MS } from './chain-trigger-match';
import { ChainTriggerRunService } from './chain-trigger-run.service';
import { isChainTriggersEnabled } from './chain-trigger-switch';

/**
 * TRIGGER-CHAIN-01 S2 (stage-start sections 2 and 5): the chain trigger
 * timer, its own 60-second interval beside the schedule, event, mail and
 * knowledge timers. The ScheduleTimer pattern: setInterval, unref() so it
 * never holds the process open, no timer under Jest unless a test sets
 * ChainTriggerTimer.allowUnderJest, a flag that stops overlapping ticks, and
 * errors logged by name only.
 *
 * CHAIN_TRIGGERS_ENABLED (chain-trigger-switch.ts) is read live on every
 * tick. Off: the tick returns at once; it reads no run and writes nothing.
 * The flag never turns runs or the run result tool on: unless both are on as
 * well, the run service reads nothing and records nothing either (Keith's
 * Q1).
 */
@Injectable()
export class ChainTriggerTimer implements OnModuleInit, OnModuleDestroy {
  /** Tests that need the real interval set this; nothing else does. */
  static allowUnderJest = false;

  private readonly logger = new Logger(ChainTriggerTimer.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(private readonly chainRuns: ChainTriggerRunService) {}

  onModuleInit(): void {
    if (process.env.JEST_WORKER_ID && !ChainTriggerTimer.allowUnderJest) {
      return;
    }
    this.timer = setInterval(() => {
      void this.tickOnce();
    }, CHAIN_TRIGGER_TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** One tick. Returns false when it did nothing (switched off, or a tick is still running). */
  async tickOnce(now: Date = new Date()): Promise<boolean> {
    if (!isChainTriggersEnabled()) {
      return false;
    }
    if (this.ticking) {
      return false;
    }
    this.ticking = true;
    try {
      await this.chainRuns.tick(now);
      return true;
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'Error';
      this.logger.error(
        JSON.stringify({
          event: 'chain_trigger.tick_failed',
          errorName: /^[A-Za-z0-9_]{1,64}$/.test(errorName) ? errorName : 'Error',
        }),
      );
      return true;
    } finally {
      this.ticking = false;
    }
  }
}
