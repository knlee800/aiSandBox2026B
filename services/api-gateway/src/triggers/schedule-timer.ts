import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SCHEDULE_TICK_MS } from './schedule-due';
import { ScheduleRunService } from './schedule-run.service';
import { isSchedulesEnabled } from './schedule-switch';

/**
 * TRIGGER-01 S2 (stage-start section 3): the schedule timer, in the pattern of
 * orchestration/collaboration-sweep.worker.ts: setInterval every 60 seconds,
 * unref() so it never holds the process open, no timer under Jest unless a
 * test sets ScheduleTimer.allowUnderJest, a flag that stops overlapping
 * ticks, and errors logged by name only.
 *
 * SCHEDULES_ENABLED (schedule-switch.ts) is read live on every tick. Off: the
 * tick returns at once; it reads nothing and writes nothing (Keith's Q6:
 * silent). The flag never turns runs on: GLOBAL_EXECUTION_ENABLED, the
 * provider switches, credits and caps still apply (schedule-run.service.ts).
 */
@Injectable()
export class ScheduleTimer implements OnModuleInit, OnModuleDestroy {
  /** Tests that need the real interval set this; nothing else does. */
  static allowUnderJest = false;

  private readonly logger = new Logger(ScheduleTimer.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(private readonly scheduleRuns: ScheduleRunService) {}

  onModuleInit(): void {
    if (process.env.JEST_WORKER_ID && !ScheduleTimer.allowUnderJest) {
      return;
    }
    this.timer = setInterval(() => {
      void this.tickOnce();
    }, SCHEDULE_TICK_MS);
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
    if (!isSchedulesEnabled()) {
      return false;
    }
    if (this.ticking) {
      return false;
    }
    this.ticking = true;
    try {
      await this.scheduleRuns.tick(now);
      return true;
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'Error';
      this.logger.error(
        JSON.stringify({
          event: 'schedule.tick_failed',
          errorName,
        }),
      );
      return true;
    } finally {
      this.ticking = false;
    }
  }
}
