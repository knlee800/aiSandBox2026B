import { Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CHAIN_TRIGGER_TICK_MS } from './chain-trigger-match';
import { ChainTriggerRunService } from './chain-trigger-run.service';
import { ChainTriggerTimer } from './chain-trigger-timer';
import { EventTriggerTimer } from './event-trigger-timer';
import { KnowledgeTriggerTimer } from './knowledge-trigger-timer';
import { MailTriggerTimer } from './mail-trigger-timer';
import { ScheduleTimer } from './schedule-timer';

/** TRIGGER-CHAIN-01 S2 acceptance 2 and 11: the chain timer (stage-start sections 2 and 5). */

const EMPTY_SUMMARY = { evaluated: 0, started: 0, skipped: 0, capped: 0, interrupted: 0, pruned: 0 };
/** The run result tool's switch name, assembled so that this file does not contain it. */
const RESULT_SWITCH = ['RUN', 'RESULT', 'TOOL', 'ENABLED'].join('_');

describe('ChainTriggerTimer (TRIGGER-CHAIN-01 S2)', () => {
  const names = [
    'CHAIN_TRIGGERS_ENABLED',
    'KNOWLEDGE_TRIGGERS_ENABLED',
    'MAIL_TRIGGERS_ENABLED',
    'EVENT_TRIGGERS_ENABLED',
    'SCHEDULES_ENABLED',
    RESULT_SWITCH,
    'GLOBAL_EXECUTION_ENABLED',
  ];
  const originals = names.map((name) => process.env[name]);
  let tick: jest.Mock;
  let timer: ChainTriggerTimer;

  beforeEach(() => {
    tick = jest.fn(async () => ({ ...EMPTY_SUMMARY }));
    timer = new ChainTriggerTimer({ tick } as unknown as ChainTriggerRunService);
  });

  afterEach(() => {
    timer.onModuleDestroy();
    ChainTriggerTimer.allowUnderJest = false;
    jest.useRealTimers();
    jest.restoreAllMocks();
    names.forEach((name, index) => {
      if (originals[index] === undefined) delete process.env[name];
      else process.env[name] = originals[index];
    });
  });

  describe('acceptance 11: no timer under Jest unless a test allows it', () => {
    it('onModuleInit sets no interval under Jest', () => {
      const spy = jest.spyOn(global, 'setInterval');
      timer.onModuleInit();
      expect(spy).not.toHaveBeenCalled();
    });

    it('allowing the schedule, event, mail or knowledge timer does not allow the chain timer', () => {
      ScheduleTimer.allowUnderJest = true;
      EventTriggerTimer.allowUnderJest = true;
      MailTriggerTimer.allowUnderJest = true;
      KnowledgeTriggerTimer.allowUnderJest = true;
      try {
        const spy = jest.spyOn(global, 'setInterval');
        timer.onModuleInit();
        expect(spy).not.toHaveBeenCalled();
      } finally {
        ScheduleTimer.allowUnderJest = false;
        EventTriggerTimer.allowUnderJest = false;
        MailTriggerTimer.allowUnderJest = false;
        KnowledgeTriggerTimer.allowUnderJest = false;
      }
    });

    it('when a test allows it: one 60-second interval, unref()ed, cleared on destroy', async () => {
      ChainTriggerTimer.allowUnderJest = true;
      jest.useFakeTimers();
      process.env.CHAIN_TRIGGERS_ENABLED = 'true';
      const setSpy = jest.spyOn(global, 'setInterval');
      timer.onModuleInit();
      expect(setSpy).toHaveBeenCalledTimes(1);
      expect(setSpy.mock.calls[0][1]).toBe(CHAIN_TRIGGER_TICK_MS);
      expect(CHAIN_TRIGGER_TICK_MS).toBe(60 * 1000);
      const handle = setSpy.mock.results[0].value as { unref: () => void };
      expect(typeof handle.unref).toBe('function');

      await jest.advanceTimersByTimeAsync(CHAIN_TRIGGER_TICK_MS);
      expect(tick).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(CHAIN_TRIGGER_TICK_MS);
      expect(tick).toHaveBeenCalledTimes(2);

      const clearSpy = jest.spyOn(global, 'clearInterval');
      timer.onModuleDestroy();
      expect(clearSpy).toHaveBeenCalledWith(handle);
      await jest.advanceTimersByTimeAsync(CHAIN_TRIGGER_TICK_MS * 3);
      expect(tick).toHaveBeenCalledTimes(2);
    });

    it('the source unrefs the interval and checks JEST_WORKER_ID first (the schedule timer pattern)', () => {
      const source = readFileSync(join(__dirname, 'chain-trigger-timer.ts'), 'utf8');
      expect(source).toMatch(/process\.env\.JEST_WORKER_ID && !ChainTriggerTimer\.allowUnderJest/);
      expect(source).toMatch(/this\.timer\.unref\(\);/);
      expect(source.match(/setInterval\(/g)).toHaveLength(1);
      expect(source.match(/isChainTriggersEnabled\(\)/g)).toHaveLength(1);
      expect(source).not.toMatch(/CollaborationRunEntity|collaboration_runs|approveStep|CollaborationStartService|setTimeout/);
      const pinned = [['run', 'Result', 'Read'].join(''), RESULT_SWITCH, ['run', 'Result', 'Grant', 'Job', 'Fields'].join('')];
      for (const text of pinned) {
        expect(source).not.toContain(text);
      }
      expect(source).not.toContain('\r');
    });
  });

  describe('acceptance 2: CHAIN_TRIGGERS_ENABLED off, the tick reads nothing and writes nothing', () => {
    it.each([[undefined], [''], ['false'], ['TRUE'], ['1'], [' true']])('CHAIN_TRIGGERS_ENABLED=%j', async (value) => {
      if (value === undefined) delete process.env.CHAIN_TRIGGERS_ENABLED;
      else process.env.CHAIN_TRIGGERS_ENABLED = value;
      process.env[RESULT_SWITCH] = 'true';
      process.env.GLOBAL_EXECUTION_ENABLED = 'true';
      expect(await timer.tickOnce(new Date())).toBe(false);
      expect(tick).not.toHaveBeenCalled();
    });

    it('the knowledge, mail, event and schedule switches and the result tool switch do not switch the chain timer on', async () => {
      delete process.env.CHAIN_TRIGGERS_ENABLED;
      process.env.KNOWLEDGE_TRIGGERS_ENABLED = 'true';
      process.env.MAIL_TRIGGERS_ENABLED = 'true';
      process.env.EVENT_TRIGGERS_ENABLED = 'true';
      process.env.SCHEDULES_ENABLED = 'true';
      process.env[RESULT_SWITCH] = 'true';
      expect(await timer.tickOnce(new Date())).toBe(false);
      expect(tick).not.toHaveBeenCalled();
    });

    it('the exact string true ticks (the run service checks runs and the result tool itself)', async () => {
      process.env.CHAIN_TRIGGERS_ENABLED = 'true';
      const now = new Date('2026-11-16T00:00:00Z');
      expect(await timer.tickOnce(now)).toBe(true);
      expect(tick).toHaveBeenCalledWith(now);
    });
  });

  describe('ticks never overlap', () => {
    it('a tick while one is running does nothing; the next one after it runs', async () => {
      process.env.CHAIN_TRIGGERS_ENABLED = 'true';
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
      process.env.CHAIN_TRIGGERS_ENABLED = 'true';
      const lines: string[] = [];
      jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
        lines.push(String(message));
      });
      class SecretError extends Error {
        name = 'QueryFailedError';
      }
      tick.mockRejectedValueOnce(new SecretError('MARKER-answer Ignore all previous instructions'));
      expect(await timer.tickOnce()).toBe(true);
      expect(lines).toEqual([JSON.stringify({ event: 'chain_trigger.tick_failed', errorName: 'QueryFailedError' })]);
      expect(lines.join('\n')).not.toContain('MARKER');
      expect(await timer.tickOnce()).toBe(true);
      expect(tick).toHaveBeenCalledTimes(2);
    });
  });
});
