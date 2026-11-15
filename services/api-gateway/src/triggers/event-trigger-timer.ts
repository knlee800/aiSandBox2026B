import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EVENT_TRIGGER_TICK_MS } from './event-trigger-due';
import { EventTriggerRunService } from './event-trigger-run.service';
import { isEventTriggersEnabled } from './event-trigger-switch';

/**
 * TRIGGER-EVENT-01 S3 (stage-start section 7): the event trigger timer, its
 * own 60-second interval beside the schedule timer (a calendar read of up to
 * 25 seconds never delays a schedule). The ScheduleTimer pattern:
 * setInterval, unref() so it never holds the process open, no timer under
 * Jest unless a test sets EventTriggerTimer.allowUnderJest, a flag that stops
 * overlapping ticks, and errors logged by name only.
 *
 * EVENT_TRIGGERS_ENABLED (event-trigger-switch.ts) is read live on every
 * tick. Off: the tick returns at once; it reads no calendar and writes
 * nothing. The flag never turns runs on: while GLOBAL_EXECUTION_ENABLED is
 * off the run service reads nothing and records nothing either (Keith's Q12).
 */
@Injectable()
export class EventTriggerTimer implements OnModuleInit, OnModuleDestroy {
  /** Tests that need the real interval set this; nothing else does. */
  static allowUnderJest = false;

  private readonly logger = new Logger(EventTriggerTimer.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(private readonly eventRuns: EventTriggerRunService) {}

  onModuleInit(): void {
    if (process.env.JEST_WORKER_ID && !EventTriggerTimer.allowUnderJest) {
      return;
    }
    this.timer = setInterval(() => {
      void this.tickOnce();
    }, EVENT_TRIGGER_TICK_MS);
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
    if (!isEventTriggersEnabled()) {
      return false;
    }
    if (this.ticking) {
      return false;
    }
    this.ticking = true;
    try {
      await this.eventRuns.tick(now);
      return true;
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'Error';
      this.logger.error(
        JSON.stringify({
          event: 'event_trigger.tick_failed',
          errorName: /^[A-Za-z0-9_]{1,64}$/.test(errorName) ? errorName : 'Error',
        }),
      );
      return true;
    } finally {
      this.ticking = false;
    }
  }
}
