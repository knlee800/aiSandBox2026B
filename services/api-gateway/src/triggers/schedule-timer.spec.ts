import { Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SCHEDULE_TICK_MS } from './schedule-due';
import { ScheduleRunService } from './schedule-run.service';
import { ScheduleTimer } from './schedule-timer';

/** TRIGGER-01 S2 acceptance 2 and 10: the timer (stage-start section 3). */

describe('ScheduleTimer (TRIGGER-01 S2)', () => {
  const original = process.env.SCHEDULES_ENABLED;
  let tick: jest.Mock;
  let timer: ScheduleTimer;

  beforeEach(() => {
    tick = jest.fn(async () => ({ evaluated: 0, started: 0, skipped: 0, interrupted: 0, pruned: 0 }));
    timer = new ScheduleTimer({ tick } as unknown as ScheduleRunService);
  });

  afterEach(() => {
    timer.onModuleDestroy();
    ScheduleTimer.allowUnderJest = false;
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (original === undefined) delete process.env.SCHEDULES_ENABLED;
    else process.env.SCHEDULES_ENABLED = original;
  });

  describe('acceptance 10: no timer under Jest unless a test allows it', () => {
    it('onModuleInit sets no interval under Jest', () => {
      const spy = jest.spyOn(global, 'setInterval');
      timer.onModuleInit();
      expect(spy).not.toHaveBeenCalled();
    });

    it('when a test allows it: one 60-second interval, unref()ed, cleared on destroy', async () => {
      ScheduleTimer.allowUnderJest = true;
      jest.useFakeTimers();
      process.env.SCHEDULES_ENABLED = 'true';
      const setSpy = jest.spyOn(global, 'setInterval');
      timer.onModuleInit();
      expect(setSpy).toHaveBeenCalledTimes(1);
      expect(setSpy.mock.calls[0][1]).toBe(SCHEDULE_TICK_MS);
      const handle = setSpy.mock.results[0].value as { unref: () => void };
      expect(typeof handle.unref).toBe('function');

      await jest.advanceTimersByTimeAsync(SCHEDULE_TICK_MS);
      expect(tick).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(SCHEDULE_TICK_MS);
      expect(tick).toHaveBeenCalledTimes(2);

      const clearSpy = jest.spyOn(global, 'clearInterval');
      timer.onModuleDestroy();
      expect(clearSpy).toHaveBeenCalledWith(handle);
      await jest.advanceTimersByTimeAsync(SCHEDULE_TICK_MS * 3);
      expect(tick).toHaveBeenCalledTimes(2);
    });

    it('the source unrefs the interval and checks JEST_WORKER_ID first (the sweep worker pattern)', () => {
      const source = readFileSync(join(__dirname, 'schedule-timer.ts'), 'utf8');
      expect(source).toMatch(/process\.env\.JEST_WORKER_ID && !ScheduleTimer\.allowUnderJest/);
      expect(source).toMatch(/this\.timer\.unref\(\);/);
      expect(source.match(/setInterval\(/g)).toHaveLength(1);
    });
  });

  describe('acceptance 2: switched off, the tick reads nothing and writes nothing', () => {
    it.each([[undefined], [''], ['false'], ['TRUE'], ['1'], [' true']])('SCHEDULES_ENABLED=%j', async (value) => {
      if (value === undefined) delete process.env.SCHEDULES_ENABLED;
      else process.env.SCHEDULES_ENABLED = value;
      expect(await timer.tickOnce(new Date())).toBe(false);
      expect(tick).not.toHaveBeenCalled();
    });

    it('the exact string true ticks', async () => {
      process.env.SCHEDULES_ENABLED = 'true';
      const now = new Date('2026-11-16T00:00:00Z');
      expect(await timer.tickOnce(now)).toBe(true);
      expect(tick).toHaveBeenCalledWith(now);
    });
  });

  describe('acceptance 10: ticks never overlap', () => {
    it('a tick while one is running does nothing; the next one after it runs', async () => {
      process.env.SCHEDULES_ENABLED = 'true';
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
      process.env.SCHEDULES_ENABLED = 'true';
      const lines: string[] = [];
      jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
        lines.push(String(message));
      });
      class SecretError extends Error {
        name = 'QueryFailedError';
      }
      tick.mockRejectedValueOnce(new SecretError('MARKER-task-text in the message'));
      expect(await timer.tickOnce()).toBe(true);
      expect(lines).toEqual([JSON.stringify({ event: 'schedule.tick_failed', errorName: 'QueryFailedError' })]);
      expect(lines.join('\n')).not.toContain('MARKER');
      expect(await timer.tickOnce()).toBe(true);
      expect(tick).toHaveBeenCalledTimes(2);
    });
  });
});
