import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { KNOWLEDGE_TRIGGER_TICK_MS } from './knowledge-trigger-match';
import { KnowledgeTriggerRunService } from './knowledge-trigger-run.service';
import { isKnowledgeTriggersEnabled } from './knowledge-trigger-switch';

/**
 * TRIGGER-MORE-01 S2 (stage-start sections 4 and 5): the knowledge trigger
 * timer, its own 60-second interval beside the schedule, event and mail
 * timers. The ScheduleTimer pattern: setInterval, unref() so it never holds
 * the process open, no timer under Jest unless a test sets
 * KnowledgeTriggerTimer.allowUnderJest, a flag that stops overlapping ticks,
 * and errors logged by name only.
 *
 * KNOWLEDGE_TRIGGERS_ENABLED (knowledge-trigger-switch.ts) is read live on
 * every tick (Keith's Q13). Off: the tick returns at once; it reads no
 * document and writes nothing. The flag never turns runs on: while
 * GLOBAL_EXECUTION_ENABLED is off the run service reads nothing and records
 * nothing either (Keith's Q14).
 */
@Injectable()
export class KnowledgeTriggerTimer implements OnModuleInit, OnModuleDestroy {
  /** Tests that need the real interval set this; nothing else does. */
  static allowUnderJest = false;

  private readonly logger = new Logger(KnowledgeTriggerTimer.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(private readonly knowledgeRuns: KnowledgeTriggerRunService) {}

  onModuleInit(): void {
    if (process.env.JEST_WORKER_ID && !KnowledgeTriggerTimer.allowUnderJest) {
      return;
    }
    this.timer = setInterval(() => {
      void this.tickOnce();
    }, KNOWLEDGE_TRIGGER_TICK_MS);
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
    if (!isKnowledgeTriggersEnabled()) {
      return false;
    }
    if (this.ticking) {
      return false;
    }
    this.ticking = true;
    try {
      await this.knowledgeRuns.tick(now);
      return true;
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'Error';
      this.logger.error(
        JSON.stringify({
          event: 'knowledge_trigger.tick_failed',
          errorName: /^[A-Za-z0-9_]{1,64}$/.test(errorName) ? errorName : 'Error',
        }),
      );
      return true;
    } finally {
      this.ticking = false;
    }
  }
}
