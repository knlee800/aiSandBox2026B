import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MAIL_TRIGGER_TICK_MS } from './mail-trigger-match';
import { MailTriggerRunService } from './mail-trigger-run.service';
import { isMailTriggersEnabled } from './mail-trigger-switch';

/**
 * TRIGGER-MAIL-01 S3 (stage-start section 7): the mail trigger timer, its own
 * 60-second interval beside the schedule and event timers (a mailbox sign-in
 * of up to 25 seconds never delays a schedule or an event trigger). The
 * ScheduleTimer pattern: setInterval, unref() so it never holds the process
 * open, no timer under Jest unless a test sets MailTriggerTimer.allowUnderJest,
 * a flag that stops overlapping ticks, and errors logged by name only.
 *
 * MAIL_TRIGGERS_ENABLED (mail-trigger-switch.ts) is read live on every tick.
 * Off: the tick returns at once; it signs in to no mailbox and writes
 * nothing. The flag never turns runs on: while GLOBAL_EXECUTION_ENABLED is
 * off the run service reads nothing and records nothing either (Keith's Q14).
 */
@Injectable()
export class MailTriggerTimer implements OnModuleInit, OnModuleDestroy {
  /** Tests that need the real interval set this; nothing else does. */
  static allowUnderJest = false;

  private readonly logger = new Logger(MailTriggerTimer.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(private readonly mailRuns: MailTriggerRunService) {}

  onModuleInit(): void {
    if (process.env.JEST_WORKER_ID && !MailTriggerTimer.allowUnderJest) {
      return;
    }
    this.timer = setInterval(() => {
      void this.tickOnce();
    }, MAIL_TRIGGER_TICK_MS);
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
    if (!isMailTriggersEnabled()) {
      return false;
    }
    if (this.ticking) {
      return false;
    }
    this.ticking = true;
    try {
      await this.mailRuns.tick(now);
      return true;
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'Error';
      this.logger.error(
        JSON.stringify({
          event: 'mail_trigger.tick_failed',
          errorName: /^[A-Za-z0-9_]{1,64}$/.test(errorName) ? errorName : 'Error',
        }),
      );
      return true;
    } finally {
      this.ticking = false;
    }
  }
}
