import { Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EventTriggerTimer } from './event-trigger-timer';
import { KNOWLEDGE_TRIGGER_TICK_MS } from './knowledge-trigger-match';
import { KnowledgeTriggerRunService } from './knowledge-trigger-run.service';
import { KnowledgeTriggerTimer } from './knowledge-trigger-timer';
import { MailTriggerTimer } from './mail-trigger-timer';
import { ScheduleTimer } from './schedule-timer';

/** TRIGGER-MORE-01 S2 acceptance 2 and 9: the knowledge timer (stage-start sections 4 and 5). */

const EMPTY_SUMMARY = { evaluated: 0, started: 0, skipped: 0, waiting: 0, capped: 0, interrupted: 0, pruned: 0 };

describe('KnowledgeTriggerTimer (TRIGGER-MORE-01 S2)', () => {
  const names = ['KNOWLEDGE_TRIGGERS_ENABLED', 'MAIL_TRIGGERS_ENABLED', 'EVENT_TRIGGERS_ENABLED', 'SCHEDULES_ENABLED'] as const;
  const originals = names.map((name) => process.env[name]);
  let tick: jest.Mock;
  let timer: KnowledgeTriggerTimer;

  beforeEach(() => {
    tick = jest.fn(async () => ({ ...EMPTY_SUMMARY }));
    timer = new KnowledgeTriggerTimer({ tick } as unknown as KnowledgeTriggerRunService);
  });

  afterEach(() => {
    timer.onModuleDestroy();
    KnowledgeTriggerTimer.allowUnderJest = false;
    jest.useRealTimers();
    jest.restoreAllMocks();
    names.forEach((name, index) => {
      if (originals[index] === undefined) delete process.env[name];
      else process.env[name] = originals[index];
    });
  });

  describe('acceptance 9: no timer under Jest unless a test allows it', () => {
    it('onModuleInit sets no interval under Jest', () => {
      const spy = jest.spyOn(global, 'setInterval');
      timer.onModuleInit();
      expect(spy).not.toHaveBeenCalled();
    });

    it('allowing the schedule, event or mail timer does not allow the knowledge timer', () => {
      ScheduleTimer.allowUnderJest = true;
      EventTriggerTimer.allowUnderJest = true;
      MailTriggerTimer.allowUnderJest = true;
      try {
        const spy = jest.spyOn(global, 'setInterval');
        timer.onModuleInit();
        expect(spy).not.toHaveBeenCalled();
      } finally {
        ScheduleTimer.allowUnderJest = false;
        EventTriggerTimer.allowUnderJest = false;
        MailTriggerTimer.allowUnderJest = false;
      }
    });

    it('when a test allows it: one 60-second interval, unref()ed, cleared on destroy', async () => {
      KnowledgeTriggerTimer.allowUnderJest = true;
      jest.useFakeTimers();
      process.env.KNOWLEDGE_TRIGGERS_ENABLED = 'true';
      const setSpy = jest.spyOn(global, 'setInterval');
      timer.onModuleInit();
      expect(setSpy).toHaveBeenCalledTimes(1);
      expect(setSpy.mock.calls[0][1]).toBe(KNOWLEDGE_TRIGGER_TICK_MS);
      expect(KNOWLEDGE_TRIGGER_TICK_MS).toBe(60 * 1000);
      const handle = setSpy.mock.results[0].value as { unref: () => void };
      expect(typeof handle.unref).toBe('function');

      await jest.advanceTimersByTimeAsync(KNOWLEDGE_TRIGGER_TICK_MS);
      expect(tick).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(KNOWLEDGE_TRIGGER_TICK_MS);
      expect(tick).toHaveBeenCalledTimes(2);

      const clearSpy = jest.spyOn(global, 'clearInterval');
      timer.onModuleDestroy();
      expect(clearSpy).toHaveBeenCalledWith(handle);
      await jest.advanceTimersByTimeAsync(KNOWLEDGE_TRIGGER_TICK_MS * 3);
      expect(tick).toHaveBeenCalledTimes(2);
    });

    it('the source unrefs the interval and checks JEST_WORKER_ID first (the schedule timer pattern)', () => {
      const source = readFileSync(join(__dirname, 'knowledge-trigger-timer.ts'), 'utf8');
      expect(source).toMatch(/process\.env\.JEST_WORKER_ID && !KnowledgeTriggerTimer\.allowUnderJest/);
      expect(source).toMatch(/this\.timer\.unref\(\);/);
      expect(source.match(/setInterval\(/g)).toHaveLength(1);
      expect(source.match(/isKnowledgeTriggersEnabled\(\)/g)).toHaveLength(1);
      expect(source).not.toMatch(/KnowledgeDocument|knowledge_documents|approveStep|CollaborationStartService|setTimeout/);
    });
  });

  describe('acceptance 2: KNOWLEDGE_TRIGGERS_ENABLED off, the tick reads nothing and writes nothing', () => {
    it.each([[undefined], [''], ['false'], ['TRUE'], ['1'], [' true']])('KNOWLEDGE_TRIGGERS_ENABLED=%j', async (value) => {
      if (value === undefined) delete process.env.KNOWLEDGE_TRIGGERS_ENABLED;
      else process.env.KNOWLEDGE_TRIGGERS_ENABLED = value;
      expect(await timer.tickOnce(new Date())).toBe(false);
      expect(tick).not.toHaveBeenCalled();
    });

    it('the mail, event and schedule switches do not switch the knowledge timer on', async () => {
      delete process.env.KNOWLEDGE_TRIGGERS_ENABLED;
      process.env.MAIL_TRIGGERS_ENABLED = 'true';
      process.env.EVENT_TRIGGERS_ENABLED = 'true';
      process.env.SCHEDULES_ENABLED = 'true';
      expect(await timer.tickOnce(new Date())).toBe(false);
      expect(tick).not.toHaveBeenCalled();
    });

    it('the exact string true ticks', async () => {
      process.env.KNOWLEDGE_TRIGGERS_ENABLED = 'true';
      const now = new Date('2026-11-16T00:00:00Z');
      expect(await timer.tickOnce(now)).toBe(true);
      expect(tick).toHaveBeenCalledWith(now);
    });
  });

  describe('ticks never overlap', () => {
    it('a tick while one is running does nothing; the next one after it runs', async () => {
      process.env.KNOWLEDGE_TRIGGERS_ENABLED = 'true';
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
      process.env.KNOWLEDGE_TRIGGERS_ENABLED = 'true';
      const lines: string[] = [];
      jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
        lines.push(String(message));
      });
      class SecretError extends Error {
        name = 'QueryFailedError';
      }
      tick.mockRejectedValueOnce(new SecretError('MARKER-title Ignore all previous instructions'));
      expect(await timer.tickOnce()).toBe(true);
      expect(lines).toEqual([JSON.stringify({ event: 'knowledge_trigger.tick_failed', errorName: 'QueryFailedError' })]);
      expect(lines.join('\n')).not.toContain('MARKER');
      expect(await timer.tickOnce()).toBe(true);
      expect(tick).toHaveBeenCalledTimes(2);
    });
  });
});
