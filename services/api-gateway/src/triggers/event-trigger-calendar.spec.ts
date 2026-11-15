import { Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { CalendarWindowEvent } from '../connectors/connector-broker';
import { CALENDAR_WINDOW_MAX_MS } from '../connectors/connector-servers';
import type { AgentEventTrigger } from '../entities/agent-event-trigger.entity';
import { EVENT_TRIGGER_CALENDAR_LIMITS, EventTriggerCalendar } from './event-trigger-calendar';

/**
 * TRIGGER-EVENT-01 S3 (stage-start section 3): the 10-minute calendar reads,
 * the memory copy, the calendar state and the confirm read.
 */

const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '22222222-2222-4222-8222-222222222222';
const OWNER_C = '33333333-3333-4333-8333-333333333333';
const OWNER_D = '44444444-4444-4444-8444-444444444444';
const OWNER_E = '55555555-5555-4555-8555-555555555555';
const TITLE_MARKER = 'MARKER-title-ignore-previous-instructions';
const UID_MARKER = 'MARKER-uid-0f3c@calendar.example.com';
const NOW = new Date('2026-11-16T01:00:00Z');
const MINUTE = 60 * 1000;

let counter = 0;

function triggerRow(overrides: Partial<AgentEventTrigger> = {}): AgentEventTrigger {
  counter += 1;
  return {
    id: `aaaaaaaa-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    userId: OWNER_A,
    targetKind: 'chief-of-staff',
    workflowId: null,
    task: 'MARKER-task plan the meeting',
    leadMinutes: 15,
    titleFilter: null,
    timeZone: 'Asia/Singapore',
    enabled: true,
    armedAt: new Date('2026-11-01T00:00:00Z'),
    calendarState: 'ok',
    calendarStateAt: null,
    createdAt: new Date(`2026-11-01T00:00:${String(counter % 60).padStart(2, '0')}Z`),
    updatedAt: new Date('2026-11-01T00:00:00Z'),
    ...overrides,
  };
}

function calendarEvent(): CalendarWindowEvent {
  return { uid: UID_MARKER, title: `${TITLE_MARKER} weekly sync`, start: '2026-11-16T01:10:00Z', end: '2026-11-16T01:40:00Z' };
}

function later(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * MINUTE);
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe('EventTriggerCalendar (TRIGGER-EVENT-01 S3)', () => {
  const originalGlobal = process.env.GLOBAL_EXECUTION_ENABLED;
  const originalEvent = process.env.EVENT_TRIGGERS_ENABLED;
  let triggers: AgentEventTrigger[];
  let connected: Set<string>;
  let active: Map<string, boolean>;
  let entitled: Set<string>;
  let auditRows: Record<string, unknown>[];
  let updates: Array<{ where: Record<string, unknown>; patch: Record<string, unknown> }>;
  let broker: { readCalendarWindow: jest.Mock };
  let counts: jest.Mock;
  let calendar: EventTriggerCalendar;
  let logs: string[];

  function newCalendar(): EventTriggerCalendar {
    const triggerRepo = {
      find: jest.fn(async ({ where }: { where: { userId: string } }) =>
        triggers
          .filter((row) => row.userId === where.userId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((row) => ({ ...row })),
      ),
      update: jest.fn(async (where: { userId: string }, patch: Partial<AgentEventTrigger>) => {
        updates.push({ where, patch: patch as Record<string, unknown> });
        let affected = 0;
        for (const row of triggers) {
          if (row.userId === where.userId) {
            Object.assign(row, patch);
            affected += 1;
          }
        }
        return { affected };
      }),
    };
    counts = jest.fn(async ({ where }: { where: { userId: string; kind: string } }) =>
      where.kind === 'ical' && connected.has(where.userId) ? 1 : 0,
    );
    return new EventTriggerCalendar(
      triggerRepo as never,
      { count: counts } as never,
      {
        findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
          active.has(where.id) ? { id: where.id, isActive: active.get(where.id) } : null,
        ),
      } as never,
      { insert: jest.fn(async (row: Record<string, unknown>) => auditRows.push(row)) } as never,
      broker as never,
      { resolveHarnessEntitled: jest.fn(async (id: string) => entitled.has(id)) } as never,
    );
  }

  beforeEach(() => {
    process.env.GLOBAL_EXECUTION_ENABLED = 'true';
    process.env.EVENT_TRIGGERS_ENABLED = 'true';
    triggers = [];
    connected = new Set([OWNER_A, OWNER_B, OWNER_C, OWNER_D, OWNER_E]);
    active = new Map([OWNER_A, OWNER_B, OWNER_C, OWNER_D, OWNER_E].map((id) => [id, true]));
    entitled = new Set([OWNER_A, OWNER_B, OWNER_C, OWNER_D, OWNER_E]);
    auditRows = [];
    updates = [];
    broker = { readCalendarWindow: jest.fn(async () => [calendarEvent()]) };
    calendar = newCalendar();
    logs = [];
    for (const method of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      jest.spyOn(Logger.prototype, method).mockImplementation((...args: unknown[]) => {
        logs.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
      });
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Stage-start section 6: titles and uids are never in a log line, an audit row or a trigger row.
    const written = `${logs.join('\n')}\n${JSON.stringify(auditRows)}\n${JSON.stringify(updates)}`;
    expect(written).not.toContain('MARKER-title');
    expect(written).not.toContain('MARKER-uid');
    expect(written).not.toContain('MARKER-task');
    restoreEnv('GLOBAL_EXECUTION_ENABLED', originalGlobal);
    restoreEnv('EVENT_TRIGGERS_ENABLED', originalEvent);
  });

  describe('acceptance 2: flag off or runs off, no broker call and nothing written', () => {
    it.each([
      ['EVENT_TRIGGERS_ENABLED off', 'EVENT_TRIGGERS_ENABLED', 'false'],
      ['runs off', 'GLOBAL_EXECUTION_ENABLED', 'false'],
    ])('%s', async (_label, name, value) => {
      process.env[name] = value;
      triggers.push(triggerRow());
      connected.clear();
      await calendar.refresh(triggers, NOW);
      expect(broker.readCalendarWindow).not.toHaveBeenCalled();
      expect(counts).not.toHaveBeenCalled();
      expect(updates).toEqual([]);
      expect(auditRows).toEqual([]);
    });

    it("Keith's Q12: runs off, the confirm read reads nothing and answers runs_off", async () => {
      process.env.GLOBAL_EXECUTION_ENABLED = 'false';
      expect(await calendar.confirm(OWNER_A, later(10), NOW)).toEqual({ kind: 'runs_off' });
      expect(broker.readCalendarWindow).not.toHaveBeenCalled();
      expect(counts).not.toHaveBeenCalled();
    });
  });

  describe('the owner must be active and have harness access', () => {
    it.each([
      ['inactive', () => active.set(OWNER_A, false)],
      ['missing', () => active.delete(OWNER_A)],
      ['no harness access', () => entitled.delete(OWNER_A)],
    ])('%s: no broker call', async (_label, arrange) => {
      arrange();
      triggers.push(triggerRow());
      await calendar.refresh(triggers, NOW);
      expect(broker.readCalendarWindow).not.toHaveBeenCalled();
      expect(calendar.eventsFor(OWNER_A, NOW)).toEqual([]);
    });
  });

  describe('acceptance 3: no ical connection, no broker call and state connector_missing', () => {
    it("all the owner's triggers (enabled or not) get connector_missing and its time, with one audit row", async () => {
      const first = triggerRow();
      const off = triggerRow({ enabled: false });
      const other = triggerRow({ userId: OWNER_B });
      triggers.push(first, off, other);
      connected.delete(OWNER_A);
      await calendar.refresh([first, other], NOW);
      expect(broker.readCalendarWindow).toHaveBeenCalledTimes(1);
      expect(broker.readCalendarWindow).toHaveBeenCalledWith(OWNER_B, NOW, expect.any(Date));
      expect(counts).toHaveBeenCalledWith({ where: { userId: OWNER_A, kind: 'ical' } });
      expect(first.calendarState).toBe('connector_missing');
      expect(off.calendarState).toBe('connector_missing');
      expect(first.calendarStateAt).toEqual(NOW);
      expect(off.calendarStateAt).toEqual(NOW);
      expect(other.calendarState).toBe('ok');
      expect(auditRows).toEqual([
        {
          category: 'trigger',
          eventType: 'calendar_state_changed',
          subjectType: 'agent_event_trigger',
          subjectId: first.id,
          userId: OWNER_A,
          payload: { triggerId: first.id, state: 'connector_missing' },
          occurredAt: NOW,
        },
      ]);

      // Ten minutes on, still not connected: no new write and no new audit row.
      await calendar.refresh([first, other], later(10));
      expect(auditRows).toHaveLength(1);
      expect(updates).toHaveLength(1);
      expect(broker.readCalendarWindow.mock.calls.filter(([userId]) => userId === OWNER_A)).toHaveLength(0);
    });

    it('a broker 404 (the connection went between the count and the read) is connector_missing too', async () => {
      const row = triggerRow();
      triggers.push(row);
      broker.readCalendarWindow.mockRejectedValueOnce(new NotFoundException('Connection not found'));
      await calendar.refresh(triggers, NOW);
      expect(row.calendarState).toBe('connector_missing');
      expect(auditRows).toHaveLength(1);
    });

    it('connecting again: the next good read sets ok with one audit row', async () => {
      const row = triggerRow();
      triggers.push(row);
      connected.delete(OWNER_A);
      await calendar.refresh(triggers, NOW);
      connected.add(OWNER_A);
      await calendar.refresh(triggers, later(10));
      expect(row.calendarState).toBe('ok');
      expect(auditRows.map((entry) => (entry.payload as { state: string }).state)).toEqual(['connector_missing', 'ok']);
    });
  });

  describe("Keith's Q9: the window and the pace", () => {
    it("reads now .. now + the owner's longest enabled lead + 15 minutes", async () => {
      triggers.push(triggerRow({ leadMinutes: 15 }), triggerRow({ leadMinutes: 45 }), triggerRow({ leadMinutes: 120, enabled: false }));
      await calendar.refresh(triggers, NOW);
      expect(broker.readCalendarWindow).toHaveBeenCalledTimes(1);
      const [userId, from, to] = broker.readCalendarWindow.mock.calls[0] as [string, Date, Date];
      expect(userId).toBe(OWNER_A);
      expect(from).toEqual(NOW);
      expect(to.getTime() - from.getTime()).toBe((45 + 15) * MINUTE);
    });

    it('the window never exceeds the broker cap of 3 hours', async () => {
      expect(EVENT_TRIGGER_CALENDAR_LIMITS.windowMaxMs).toBe(CALENDAR_WINDOW_MAX_MS);
      triggers.push(triggerRow({ leadMinutes: 120 }));
      await calendar.refresh(triggers, NOW);
      const [, from, to] = broker.readCalendarWindow.mock.calls[0] as [string, Date, Date];
      expect(to.getTime() - from.getTime()).toBe(135 * MINUTE);
      broker.readCalendarWindow.mockClear();
      triggers[0].leadMinutes = 500; // not a valid lead; the cap still holds
      await calendar.refresh(triggers, later(10));
      const [, from2, to2] = broker.readCalendarWindow.mock.calls[0] as [string, Date, Date];
      expect(to2.getTime() - from2.getTime()).toBe(CALENDAR_WINDOW_MAX_MS);
    });

    it('one read per owner every 10 minutes: none at 1 and 9 minutes, one at 10', async () => {
      triggers.push(triggerRow());
      await calendar.refresh(triggers, NOW);
      await calendar.refresh(triggers, later(1));
      await calendar.refresh(triggers, later(9));
      expect(broker.readCalendarWindow).toHaveBeenCalledTimes(1);
      await calendar.refresh(triggers, later(10));
      expect(broker.readCalendarWindow).toHaveBeenCalledTimes(2);
    });

    it('a failed read waits 10 minutes too (the pace counts every attempt)', async () => {
      triggers.push(triggerRow());
      broker.readCalendarWindow.mockRejectedValue(new ServiceUnavailableException('busy'));
      for (let minute = 0; minute < 10; minute += 1) {
        await calendar.refresh(triggers, later(minute));
      }
      expect(broker.readCalendarWindow).toHaveBeenCalledTimes(1);
    });
  });

  describe('the memory copy', () => {
    it('holds the events for the owner; dropped after 20 minutes', async () => {
      triggers.push(triggerRow());
      await calendar.refresh(triggers, NOW);
      expect(calendar.eventsFor(OWNER_A, later(1))).toEqual([calendarEvent()]);
      expect(calendar.eventsFor(OWNER_A, later(19))).toEqual([calendarEvent()]);
      expect(calendar.eventsFor(OWNER_B, later(1))).toEqual([]);
      expect(calendar.eventsFor(OWNER_A, later(20))).toEqual([]);
    });

    it('acceptance 5: a restart (a new instance) starts with empty memory', async () => {
      triggers.push(triggerRow());
      await calendar.refresh(triggers, NOW);
      const restarted = newCalendar();
      expect(restarted.eventsFor(OWNER_A, later(1))).toEqual([]);
    });

    it('an owner with no enabled trigger is forgotten', async () => {
      const row = triggerRow();
      triggers.push(row);
      await calendar.refresh(triggers, NOW);
      await calendar.refresh([], later(1));
      expect(calendar.eventsFor(OWNER_A, later(1))).toEqual([]);
    });

    it('a failed read keeps the last good copy until it expires', async () => {
      triggers.push(triggerRow());
      await calendar.refresh(triggers, NOW);
      broker.readCalendarWindow.mockRejectedValueOnce(new ServiceUnavailableException('busy'));
      await calendar.refresh(triggers, later(10));
      expect(calendar.eventsFor(OWNER_A, later(11))).toEqual([calendarEvent()]);
      expect(calendar.eventsFor(OWNER_A, later(20))).toEqual([]);
    });

    it('the memory is never written to a table: the source only reads the broker into a Map', () => {
      const source = readFileSync(join(__dirname, 'event-trigger-calendar.ts'), 'utf8');
      expect(source).toMatch(/private readonly memory = new Map<string, OwnerMemory>\(\);/);
      // The only writes: the trigger state (two columns) and the audit row.
      expect(source.match(/\.update\(/g)).toHaveLength(1);
      expect(source).toMatch(/this\.triggers\.update\(\{ userId \}, \{ calendarState: state, calendarStateAt: now \}\)/);
      expect(source.match(/\.insert\(/g)).toHaveLength(1);
      expect(source).not.toMatch(/\.save\(|events\b.*logger|title.*logger|logger.*title|logger.*uid/);
    });
  });

  describe('acceptance 10: three failed reads set read_failed, one good read sets ok, one audit row each', () => {
    it('two failures change nothing; the third sets read_failed; a good read sets ok', async () => {
      const first = triggerRow();
      const second = triggerRow({ enabled: false });
      triggers.push(first, second);
      broker.readCalendarWindow.mockRejectedValue(new ServiceUnavailableException('busy'));
      await calendar.refresh([first], NOW);
      await calendar.refresh([first], later(10));
      expect(first.calendarState).toBe('ok');
      expect(auditRows).toEqual([]);
      await calendar.refresh([first], later(20));
      expect(first.calendarState).toBe('read_failed');
      expect(second.calendarState).toBe('read_failed');
      expect(first.calendarStateAt).toEqual(later(20));
      expect(auditRows).toHaveLength(1);
      expect(auditRows[0]).toMatchObject({ eventType: 'calendar_state_changed', payload: { triggerId: first.id, state: 'read_failed' } });

      // A fourth failure: no new audit row.
      await calendar.refresh([first], later(30));
      expect(auditRows).toHaveLength(1);

      broker.readCalendarWindow.mockResolvedValue([calendarEvent()]);
      await calendar.refresh([first], later(40));
      expect(first.calendarState).toBe('ok');
      expect(second.calendarState).toBe('ok');
      expect(first.calendarStateAt).toEqual(later(40));
      expect(auditRows).toHaveLength(2);
      expect(auditRows[1]).toMatchObject({ eventType: 'calendar_state_changed', payload: { triggerId: first.id, state: 'ok' } });
      expect(Object.keys(auditRows[1].payload as object).sort()).toEqual(['state', 'triggerId']);

      // Good reads while ok: nothing written.
      await calendar.refresh([first], later(50));
      expect(auditRows).toHaveLength(2);
    });

    it('a good read between failures starts the count again', async () => {
      const row = triggerRow();
      triggers.push(row);
      broker.readCalendarWindow
        .mockRejectedValueOnce(new ServiceUnavailableException('busy'))
        .mockRejectedValueOnce(new ServiceUnavailableException('busy'))
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new ServiceUnavailableException('busy'))
        .mockRejectedValueOnce(new ServiceUnavailableException('busy'));
      for (let step = 0; step < 5; step += 1) {
        await calendar.refresh(triggers, later(step * 10));
      }
      expect(row.calendarState).toBe('ok');
      expect(auditRows).toEqual([]);
    });

    it('a new trigger (ok, no time) beside a recorded read_failed: the owner still shows read_failed, so no audit row; all rows aligned', async () => {
      const failed = triggerRow({ calendarState: 'read_failed', calendarStateAt: new Date('2026-11-15T00:00:00Z') });
      const fresh = triggerRow();
      triggers.push(failed, fresh);
      broker.readCalendarWindow.mockRejectedValue(new ServiceUnavailableException('busy'));
      await calendar.refresh(triggers, NOW);
      await calendar.refresh(triggers, later(10));
      await calendar.refresh(triggers, later(20));
      expect(fresh.calendarState).toBe('read_failed');
      expect(auditRows).toEqual([]);
    });

    it('a failed read logs the owner id and the error name only', async () => {
      triggers.push(triggerRow());
      class LeakyError extends Error {
        name = 'ServiceUnavailableException';
      }
      broker.readCalendarWindow.mockRejectedValueOnce(new LeakyError(`https://calendar.example.com/${TITLE_MARKER}`));
      await calendar.refresh(triggers, NOW);
      expect(logs).toEqual([`event trigger calendar read failed userId=${OWNER_A} reason=ServiceUnavailableException`]);
    });
  });

  describe('acceptance 11: at most 3 owner reads a tick, one at a time', () => {
    it('five owners: three this tick, never two at once, the other two on the next tick', async () => {
      for (const owner of [OWNER_A, OWNER_B, OWNER_C, OWNER_D, OWNER_E]) {
        triggers.push(triggerRow({ userId: owner }));
      }
      let inFlight = 0;
      let most = 0;
      broker.readCalendarWindow.mockImplementation(async () => {
        inFlight += 1;
        most = Math.max(most, inFlight);
        await new Promise((resolve) => setImmediate(resolve));
        await new Promise((resolve) => setImmediate(resolve));
        inFlight -= 1;
        return [];
      });
      const first = await calendar.refresh(triggers, NOW);
      expect(first.read).toBe(3);
      expect(broker.readCalendarWindow).toHaveBeenCalledTimes(3);
      expect(most).toBe(1);
      const firstOwners = broker.readCalendarWindow.mock.calls.map(([userId]) => userId);

      const second = await calendar.refresh(triggers, later(1));
      expect(second.read).toBe(2);
      const secondOwners = broker.readCalendarWindow.mock.calls.slice(3).map(([userId]) => userId);
      expect(new Set([...firstOwners, ...secondOwners]).size).toBe(5);
      expect(most).toBe(1);

      // Nobody is due again until 10 minutes after their read.
      await calendar.refresh(triggers, later(2));
      expect(broker.readCalendarWindow).toHaveBeenCalledTimes(5);
    });

    it('connector-missing and not-allowed owners count toward the 3 as well', async () => {
      for (const owner of [OWNER_A, OWNER_B, OWNER_C, OWNER_D]) {
        triggers.push(triggerRow({ userId: owner }));
      }
      connected.delete(OWNER_A);
      entitled.delete(OWNER_B);
      await calendar.refresh(triggers, NOW);
      expect(broker.readCalendarWindow).toHaveBeenCalledTimes(1);
      await calendar.refresh(triggers, later(1));
      expect(broker.readCalendarWindow).toHaveBeenCalledTimes(2);
    });

    it('runs switched off between owners: the rest wait', async () => {
      for (const owner of [OWNER_A, OWNER_B, OWNER_C]) {
        triggers.push(triggerRow({ userId: owner }));
      }
      broker.readCalendarWindow.mockImplementationOnce(async () => {
        process.env.GLOBAL_EXECUTION_ENABLED = 'false';
        return [];
      });
      await calendar.refresh(triggers, NOW);
      expect(broker.readCalendarWindow).toHaveBeenCalledTimes(1);
    });
  });

  describe('the confirm read', () => {
    it('no connection: connector_missing without a broker call', async () => {
      connected.delete(OWNER_A);
      expect(await calendar.confirm(OWNER_A, later(10), NOW)).toEqual({ kind: 'connector_missing' });
      expect(broker.readCalendarWindow).not.toHaveBeenCalled();
    });

    it('reads now .. the start plus a minute and answers the events; the state does not change', async () => {
      const row = triggerRow();
      triggers.push(row);
      expect(await calendar.confirm(OWNER_A, later(10), NOW)).toEqual({ kind: 'ok', events: [calendarEvent()] });
      const [userId, from, to] = broker.readCalendarWindow.mock.calls[0] as [string, Date, Date];
      expect(userId).toBe(OWNER_A);
      expect(from).toEqual(NOW);
      expect(to).toEqual(later(11));
      expect(updates).toEqual([]);
      expect(auditRows).toEqual([]);
    });

    it('a broker 404 is connector_missing; any other failure is failed; neither changes the state', async () => {
      triggers.push(triggerRow());
      broker.readCalendarWindow.mockRejectedValueOnce(new NotFoundException('Connection not found'));
      expect(await calendar.confirm(OWNER_A, later(10), NOW)).toEqual({ kind: 'connector_missing' });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        broker.readCalendarWindow.mockRejectedValueOnce(new ServiceUnavailableException('busy'));
        expect(await calendar.confirm(OWNER_A, later(10), NOW)).toEqual({ kind: 'failed' });
      }
      expect(updates).toEqual([]);
      expect(auditRows).toEqual([]);
    });
  });
});
