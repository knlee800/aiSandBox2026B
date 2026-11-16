import { Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EventTriggerTimer } from './event-trigger-timer';
import { MAIL_TRIGGER_TICK_MS } from './mail-trigger-match';
import { MailTriggerRunService } from './mail-trigger-run.service';
import { MailTriggerTimer } from './mail-trigger-timer';
import { ScheduleTimer } from './schedule-timer';

/** TRIGGER-MAIL-01 S3 acceptance 2 and 12: the mail timer (stage-start section 7). */

const EMPTY_SUMMARY = { evaluated: 0, started: 0, skipped: 0, capped: 0, interrupted: 0, pruned: 0 };

describe('MailTriggerTimer (TRIGGER-MAIL-01 S3)', () => {
  const originalMail = process.env.MAIL_TRIGGERS_ENABLED;
  const originalEvent = process.env.EVENT_TRIGGERS_ENABLED;
  const originalSchedules = process.env.SCHEDULES_ENABLED;
  let tick: jest.Mock;
  let timer: MailTriggerTimer;

  function restore(name: string, value: string | undefined): void {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  beforeEach(() => {
    tick = jest.fn(async () => ({ ...EMPTY_SUMMARY }));
    timer = new MailTriggerTimer({ tick } as unknown as MailTriggerRunService);
  });

  afterEach(() => {
    timer.onModuleDestroy();
    MailTriggerTimer.allowUnderJest = false;
    jest.useRealTimers();
    jest.restoreAllMocks();
    restore('MAIL_TRIGGERS_ENABLED', originalMail);
    restore('EVENT_TRIGGERS_ENABLED', originalEvent);
    restore('SCHEDULES_ENABLED', originalSchedules);
  });

  describe('acceptance 12: no timer under Jest unless a test allows it', () => {
    it('onModuleInit sets no interval under Jest', () => {
      const spy = jest.spyOn(global, 'setInterval');
      timer.onModuleInit();
      expect(spy).not.toHaveBeenCalled();
    });

    it('allowing the schedule or the event timer does not allow the mail timer', () => {
      ScheduleTimer.allowUnderJest = true;
      EventTriggerTimer.allowUnderJest = true;
      try {
        const spy = jest.spyOn(global, 'setInterval');
        timer.onModuleInit();
        expect(spy).not.toHaveBeenCalled();
      } finally {
        ScheduleTimer.allowUnderJest = false;
        EventTriggerTimer.allowUnderJest = false;
      }
    });

    it('when a test allows it: one 60-second interval, unref()ed, cleared on destroy', async () => {
      MailTriggerTimer.allowUnderJest = true;
      jest.useFakeTimers();
      process.env.MAIL_TRIGGERS_ENABLED = 'true';
      const setSpy = jest.spyOn(global, 'setInterval');
      timer.onModuleInit();
      expect(setSpy).toHaveBeenCalledTimes(1);
      expect(setSpy.mock.calls[0][1]).toBe(MAIL_TRIGGER_TICK_MS);
      expect(MAIL_TRIGGER_TICK_MS).toBe(60 * 1000);
      const handle = setSpy.mock.results[0].value as { unref: () => void };
      expect(typeof handle.unref).toBe('function');

      await jest.advanceTimersByTimeAsync(MAIL_TRIGGER_TICK_MS);
      expect(tick).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(MAIL_TRIGGER_TICK_MS);
      expect(tick).toHaveBeenCalledTimes(2);

      const clearSpy = jest.spyOn(global, 'clearInterval');
      timer.onModuleDestroy();
      expect(clearSpy).toHaveBeenCalledWith(handle);
      await jest.advanceTimersByTimeAsync(MAIL_TRIGGER_TICK_MS * 3);
      expect(tick).toHaveBeenCalledTimes(2);
    });

    it('the source unrefs the interval and checks JEST_WORKER_ID first (the schedule timer pattern)', () => {
      const source = readFileSync(join(__dirname, 'mail-trigger-timer.ts'), 'utf8');
      expect(source).toMatch(/process\.env\.JEST_WORKER_ID && !MailTriggerTimer\.allowUnderJest/);
      expect(source).toMatch(/this\.timer\.unref\(\);/);
      expect(source.match(/setInterval\(/g)).toHaveLength(1);
      expect(source).not.toMatch(/readRecentMail|ConnectorBroker|approveStep|CollaborationStartService/);
    });
  });

  describe('acceptance 2: MAIL_TRIGGERS_ENABLED off, the tick signs in nowhere and writes nothing', () => {
    it.each([[undefined], [''], ['false'], ['TRUE'], ['1'], [' true']])('MAIL_TRIGGERS_ENABLED=%j', async (value) => {
      restore('MAIL_TRIGGERS_ENABLED', value);
      expect(await timer.tickOnce(new Date())).toBe(false);
      expect(tick).not.toHaveBeenCalled();
    });

    it('EVENT_TRIGGERS_ENABLED and SCHEDULES_ENABLED do not switch the mail timer on', async () => {
      delete process.env.MAIL_TRIGGERS_ENABLED;
      process.env.EVENT_TRIGGERS_ENABLED = 'true';
      process.env.SCHEDULES_ENABLED = 'true';
      expect(await timer.tickOnce(new Date())).toBe(false);
      expect(tick).not.toHaveBeenCalled();
    });

    it('the exact string true ticks', async () => {
      process.env.MAIL_TRIGGERS_ENABLED = 'true';
      const now = new Date('2026-11-16T00:00:00Z');
      expect(await timer.tickOnce(now)).toBe(true);
      expect(tick).toHaveBeenCalledWith(now);
    });
  });

  describe('ticks never overlap', () => {
    it('a tick while one is running does nothing; the next one after it runs', async () => {
      process.env.MAIL_TRIGGERS_ENABLED = 'true';
      let release: () => void = () => undefined;
      tick.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ ...EMPTY_SUMMARY });
          }),
      );
      const first = timer.tickOnce();
      expect(await timer.tickOnce()).toBe(false);
      expect(await timer.tickOnce()).toBe(false);
      expect(tick).toHaveBeenCalledTimes(1);
      release();
      expect(await first).toBe(true);
      expect(await timer.tickOnce()).toBe(true);
      expect(tick).toHaveBeenCalledTimes(2);
    });

    it('a failed tick logs the error name only and frees the flag', async () => {
      process.env.MAIL_TRIGGERS_ENABLED = 'true';
      const lines: string[] = [];
      jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
        lines.push(String(message));
      });
      class SecretError extends Error {
        name = 'QueryFailedError';
      }
      tick.mockRejectedValueOnce(new SecretError('MARKER-subject boss@example.com in the message'));
      expect(await timer.tickOnce()).toBe(true);
      expect(lines).toEqual([JSON.stringify({ event: 'mail_trigger.tick_failed', errorName: 'QueryFailedError' })]);
      expect(lines.join('\n')).not.toContain('MARKER');
      expect(lines.join('\n')).not.toContain('boss@example.com');
      expect(await timer.tickOnce()).toBe(true);
      expect(tick).toHaveBeenCalledTimes(2);
    });
  });
});
