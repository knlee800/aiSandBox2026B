import { Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EVENT_TRIGGER_TICK_MS } from './event-trigger-due';
import { EventTriggerRunService } from './event-trigger-run.service';
import { EventTriggerTimer } from './event-trigger-timer';
import { ScheduleTimer } from './schedule-timer';

/** TRIGGER-EVENT-01 S3 acceptance 2 and 12: the event timer (stage-start section 7). */

describe('EventTriggerTimer (TRIGGER-EVENT-01 S3)', () => {
  const originalEvent = process.env.EVENT_TRIGGERS_ENABLED;
  const originalSchedules = process.env.SCHEDULES_ENABLED;
  let tick: jest.Mock;
  let timer: EventTriggerTimer;

  beforeEach(() => {
    tick = jest.fn(async () => ({ evaluated: 0, started: 0, skipped: 0, interrupted: 0, pruned: 0 }));
    timer = new EventTriggerTimer({ tick } as unknown as EventTriggerRunService);
  });

  afterEach(() => {
    timer.onModuleDestroy();
    EventTriggerTimer.allowUnderJest = false;
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (originalEvent === undefined) delete process.env.EVENT_TRIGGERS_ENABLED;
    else process.env.EVENT_TRIGGERS_ENABLED = originalEvent;
    if (originalSchedules === undefined) delete process.env.SCHEDULES_ENABLED;
    else process.env.SCHEDULES_ENABLED = originalSchedules;
  });

  describe('acceptance 12: no timer under Jest unless a test allows it', () => {
    it('onModuleInit sets no interval under Jest', () => {
      const spy = jest.spyOn(global, 'setInterval');
      timer.onModuleInit();
      expect(spy).not.toHaveBeenCalled();
    });

    it('allowing the schedule timer does not allow the event timer', () => {
      ScheduleTimer.allowUnderJest = true;
      try {
        const spy = jest.spyOn(global, 'setInterval');
        timer.onModuleInit();
        expect(spy).not.toHaveBeenCalled();
      } finally {
        ScheduleTimer.allowUnderJest = false;
      }
    });

    it('when a test allows it: one 60-second interval, unref()ed, cleared on destroy', async () => {
      EventTriggerTimer.allowUnderJest = true;
      jest.useFakeTimers();
      process.env.EVENT_TRIGGERS_ENABLED = 'true';
      const setSpy = jest.spyOn(global, 'setInterval');
      timer.onModuleInit();
      expect(setSpy).toHaveBeenCalledTimes(1);
      expect(setSpy.mock.calls[0][1]).toBe(EVENT_TRIGGER_TICK_MS);
      expect(EVENT_TRIGGER_TICK_MS).toBe(60 * 1000);
      const handle = setSpy.mock.results[0].value as { unref: () => void };
      expect(typeof handle.unref).toBe('function');

      await jest.advanceTimersByTimeAsync(EVENT_TRIGGER_TICK_MS);
      expect(tick).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(EVENT_TRIGGER_TICK_MS);
      expect(tick).toHaveBeenCalledTimes(2);

      const clearSpy = jest.spyOn(global, 'clearInterval');
      timer.onModuleDestroy();
      expect(clearSpy).toHaveBeenCalledWith(handle);
      await jest.advanceTimersByTimeAsync(EVENT_TRIGGER_TICK_MS * 3);
      expect(tick).toHaveBeenCalledTimes(2);
    });

    it('the source unrefs the interval and checks JEST_WORKER_ID first (the schedule timer pattern)', () => {
      const source = readFileSync(join(__dirname, 'event-trigger-timer.ts'), 'utf8');
      expect(source).toMatch(/process\.env\.JEST_WORKER_ID && !EventTriggerTimer\.allowUnderJest/);
      expect(source).toMatch(/this\.timer\.unref\(\);/);
      expect(source.match(/setInterval\(/g)).toHaveLength(1);
    });
  });

  describe('acceptance 2: EVENT_TRIGGERS_ENABLED off, the tick reads nothing and writes nothing', () => {
    it.each([[undefined], [''], ['false'], ['TRUE'], ['1'], [' true']])('EVENT_TRIGGERS_ENABLED=%j', async (value) => {
      if (value === undefined) delete process.env.EVENT_TRIGGERS_ENABLED;
      else process.env.EVENT_TRIGGERS_ENABLED = value;
      expect(await timer.tickOnce(new Date())).toBe(false);
      expect(tick).not.toHaveBeenCalled();
    });

    it('SCHEDULES_ENABLED does not switch the event timer on', async () => {
      delete process.env.EVENT_TRIGGERS_ENABLED;
      process.env.SCHEDULES_ENABLED = 'true';
      expect(await timer.tickOnce(new Date())).toBe(false);
      expect(tick).not.toHaveBeenCalled();
    });

    it('the exact string true ticks', async () => {
      process.env.EVENT_TRIGGERS_ENABLED = 'true';
      const now = new Date('2026-11-16T00:00:00Z');
      expect(await timer.tickOnce(now)).toBe(true);
      expect(tick).toHaveBeenCalledWith(now);
    });
  });

  describe('ticks never overlap', () => {
    it('a tick while one is running does nothing; the next one after it runs', async () => {
      process.env.EVENT_TRIGGERS_ENABLED = 'true';
      let release: () => void = () => undefined;
      tick.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ evaluated: 0, started: 0, skipped: 0, interrupted: 0, pruned: 0 });
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
      process.env.EVENT_TRIGGERS_ENABLED = 'true';
      const lines: string[] = [];
      jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
        lines.push(String(message));
      });
      class SecretError extends Error {
        name = 'QueryFailedError';
      }
      tick.mockRejectedValueOnce(new SecretError('MARKER-event-title in the message'));
      expect(await timer.tickOnce()).toBe(true);
      expect(lines).toEqual([JSON.stringify({ event: 'event_trigger.tick_failed', errorName: 'QueryFailedError' })]);
      expect(lines.join('\n')).not.toContain('MARKER');
      expect(await timer.tickOnce()).toBe(true);
      expect(tick).toHaveBeenCalledTimes(2);
    });
  });
});
