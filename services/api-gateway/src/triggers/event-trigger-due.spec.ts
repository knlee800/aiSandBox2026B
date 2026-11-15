import { createHash } from 'crypto';
import {
  eventLocalDate,
  eventLocalTimeText,
  eventTriggerDue,
  instantOf,
  occurrenceKeyOf,
  titleMatches,
  type EventTriggerDueInput,
} from './event-trigger-due';

/** TRIGGER-EVENT-01 S3 acceptance 1: the due rule (stage-start sections 2 and 4). */

const TRIGGER_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const MINUTE = 60 * 1000;

function trigger(overrides: Partial<EventTriggerDueInput> = {}): EventTriggerDueInput {
  return {
    id: TRIGGER_ID,
    leadMinutes: 15,
    titleFilter: null,
    timeZone: 'Asia/Singapore',
    armedAt: new Date('2026-11-01T00:00:00Z'),
    ...overrides,
  };
}

function event(start: string, overrides: Partial<{ uid: string; title: string; end: string }> = {}) {
  return {
    uid: 'event-uid-1@example.com',
    title: 'Weekly sync',
    start,
    end: new Date(new Date(start).getTime() + 30 * MINUTE).toISOString(),
    ...overrides,
  };
}

describe('eventTriggerDue (TRIGGER-EVENT-01 S3 acceptance 1)', () => {
  /** An event at 10:00 Singapore = 02:00Z on 2026-11-16; lead 15 so the trigger time is 01:45Z. */
  const START = '2026-11-16T02:00:00.000Z';

  describe('the lead and the trigger time', () => {
    it.each([
      ['01:44:59Z, before the trigger time', '2026-11-16T01:44:59Z', { due: false, reason: 'before_time' }],
      ['01:45:00Z, exactly the trigger time', '2026-11-16T01:45:00Z', { due: true, missed: false }],
      ['01:50:00Z, late but before the event', '2026-11-16T01:50:00Z', { due: true, missed: false }],
      ['01:59:59Z, a second before the event', '2026-11-16T01:59:59Z', { due: true, missed: false }],
      ['02:00:00Z, the event has begun: missed', '2026-11-16T02:00:00Z', { due: true, missed: true }],
      ['02:10:00Z, during the event: missed', '2026-11-16T02:10:00Z', { due: true, missed: true }],
    ])('%s', (_label, now, expected) => {
      expect(eventTriggerDue(trigger(), event(START), new Date(now))).toMatchObject(expected);
    });

    it.each([
      [5, '2026-11-16T01:55:00Z', '2026-11-16T01:54:59Z'],
      [60, '2026-11-16T01:00:00Z', '2026-11-16T00:59:59Z'],
      [120, '2026-11-16T00:00:00Z', '2026-11-15T23:59:59Z'],
    ])('lead %i minutes: due from %s, not at %s', (lead, dueAt, notAt) => {
      const result = eventTriggerDue(trigger({ leadMinutes: lead }), event(START), new Date(dueAt));
      expect(result).toMatchObject({ due: true, missed: false, triggerAt: new Date(dueAt) });
      expect(eventTriggerDue(trigger({ leadMinutes: lead }), event(START), new Date(notAt))).toEqual({
        due: false,
        reason: 'before_time',
      });
    });

    it('answers the start, end, trigger time, local date and the occurrence key', () => {
      const result = eventTriggerDue(trigger(), event(START), new Date('2026-11-16T01:46:00Z'));
      expect(result).toEqual({
        due: true,
        missed: false,
        start: new Date(START),
        end: new Date('2026-11-16T02:30:00.000Z'),
        triggerAt: new Date('2026-11-16T01:45:00Z'),
        localDate: '2026-11-16',
        occurrenceKey: occurrenceKeyOf(TRIGGER_ID, 'event-uid-1@example.com', new Date(START)),
      });
    });
  });

  describe('armed_at: the trigger time must be strictly after it', () => {
    it.each([
      ['armed a second before the trigger time', '2026-11-16T01:44:59Z', true],
      ['armed exactly at the trigger time', '2026-11-16T01:45:00Z', false],
      ['armed after the trigger time, before the event (switched on at 10:00 with a 30-minute lead)', '2026-11-16T01:50:00Z', false],
    ])('%s', (_label, armedAt, due) => {
      const result = eventTriggerDue(trigger({ armedAt: new Date(armedAt) }), event(START), new Date('2026-11-16T01:55:00Z'));
      expect(result.due).toBe(due);
      if (!due) expect(result).toEqual({ due: false, reason: 'not_armed' });
    });

    it('switched on at 10:00 with a 30-minute lead: a 10:10 meeting never fires, not even as missed', () => {
      const armed = trigger({ leadMinutes: 30, armedAt: new Date('2026-11-16T02:00:00Z') });
      const meeting = event('2026-11-16T02:10:00Z');
      for (const now of ['2026-11-16T02:00:30Z', '2026-11-16T02:09:00Z', '2026-11-16T02:15:00Z']) {
        expect(eventTriggerDue(armed, meeting, new Date(now))).toEqual({ due: false, reason: 'not_armed' });
      }
    });

    it('armed_at given as a string is read as an instant; an unreadable one is never due', () => {
      expect(
        eventTriggerDue(trigger({ armedAt: '2026-11-01T00:00:00Z' as unknown as Date }), event(START), new Date('2026-11-16T01:50:00Z')).due,
      ).toBe(true);
      expect(
        eventTriggerDue(trigger({ armedAt: 'not a date' as unknown as Date }), event(START), new Date('2026-11-16T01:50:00Z')),
      ).toEqual({ due: false, reason: 'not_armed' });
    });
  });

  describe("the title filter (Keith's Q3)", () => {
    it.each([
      [null, 'Anything at all', true],
      ['', 'Anything at all', true],
      ['   ', 'Anything at all', true],
      ['standup', 'Daily STANDUP with sales', true],
      ['StandUp', 'daily standup', true],
      ['  standup ', 'daily standup', true],
      ['board', 'Daily standup', false],
      ['standup', '', false],
    ])('filter %j, title %j: %s', (filter, title, matches) => {
      expect(titleMatches(filter, title)).toBe(matches);
      const result = eventTriggerDue(trigger({ titleFilter: filter }), event(START, { title }), new Date('2026-11-16T01:50:00Z'));
      if (matches) expect(result.due).toBe(true);
      else expect(result).toEqual({ due: false, reason: 'no_match' });
    });
  });

  describe('events the rule refuses', () => {
    it.each([
      ['no start', { start: '' }],
      ['an unreadable start', { start: 'tomorrow' }],
      ['no end', { end: '' }],
      ['an end before the start', { end: '2026-11-16T01:00:00Z' }],
      ['no uid', { uid: '' }],
    ])('%s', (_label, overrides) => {
      const bad = { ...event(START), ...overrides };
      expect(eventTriggerDue(trigger(), bad, new Date('2026-11-16T01:50:00Z'))).toEqual({ due: false, reason: 'bad_event' });
    });

    it('a zone Intl refuses', () => {
      expect(eventTriggerDue(trigger({ timeZone: 'Mars/Olympus' }), event(START), new Date('2026-11-16T01:50:00Z'))).toEqual({
        due: false,
        reason: 'bad_zone',
      });
    });
  });

  describe('the local date (the day limit and the row) across a local-day boundary', () => {
    it('an event at 00:05 local, triggered at 23:50 the evening before, belongs to the event day', () => {
      // 00:05 on 2026-11-17 in Singapore = 16:05Z on 2026-11-16.
      const result = eventTriggerDue(trigger(), event('2026-11-16T16:05:00Z'), new Date('2026-11-16T15:50:00Z'));
      expect(eventLocalDate('Asia/Singapore', new Date('2026-11-16T15:50:00Z'))).toBe('2026-11-16');
      expect(result).toMatchObject({ due: true, localDate: '2026-11-17' });
    });

    it('an event at 23:55 local belongs to that day, a minute later the next', () => {
      expect(eventTriggerDue(trigger(), event('2026-11-16T15:55:00Z'), new Date('2026-11-16T15:45:00Z'))).toMatchObject({
        localDate: '2026-11-16',
      });
      expect(eventTriggerDue(trigger(), event('2026-11-16T16:00:00Z'), new Date('2026-11-16T15:50:00Z'))).toMatchObject({
        localDate: '2026-11-17',
      });
    });

    it('the same instant is a different local date in another zone', () => {
      const instant = '2026-11-16T16:05:00Z';
      const now = new Date('2026-11-16T15:55:00Z');
      expect(eventTriggerDue(trigger({ timeZone: 'Asia/Singapore' }), event(instant), now)).toMatchObject({ localDate: '2026-11-17' });
      expect(eventTriggerDue(trigger({ timeZone: 'Europe/London' }), event(instant), now)).toMatchObject({ localDate: '2026-11-16' });
    });
  });

  describe('DST dates: instants, so the trigger never shifts', () => {
    it('spring forward (America/New_York, 2026-03-08): a 03:15 EDT event with a 30-minute lead fires 30 real minutes before, at 01:45 EST = 06:45Z', () => {
      // 03:15 EDT = 07:15Z. 30 minutes before is 06:45Z (= 01:45 EST, the wall clock jumps at 07:00Z).
      const ny = trigger({ timeZone: 'America/New_York', leadMinutes: 30, armedAt: new Date('2026-01-01T00:00:00Z') });
      const dstEvent = event('2026-03-08T07:15:00Z');
      expect(eventTriggerDue(ny, dstEvent, new Date('2026-03-08T06:44:59Z'))).toEqual({ due: false, reason: 'before_time' });
      expect(eventTriggerDue(ny, dstEvent, new Date('2026-03-08T06:45:00Z'))).toMatchObject({
        due: true,
        missed: false,
        localDate: '2026-03-08',
      });
      expect(eventLocalTimeText('America/New_York', new Date('2026-03-08T07:15:00Z'))).toBe('2026-03-08 03:15');
    });

    it('fall back (Europe/London, 2026-10-25): two events at 01:30 local, an hour apart, are two occurrences', () => {
      const london = trigger({ timeZone: 'Europe/London', leadMinutes: 15, armedAt: new Date('2026-01-01T00:00:00Z') });
      // 01:30 BST = 00:30Z; 01:30 GMT = 01:30Z.
      const first = eventTriggerDue(london, event('2026-10-25T00:30:00Z'), new Date('2026-10-25T00:15:00Z'));
      const second = eventTriggerDue(london, event('2026-10-25T01:30:00Z'), new Date('2026-10-25T01:15:00Z'));
      expect(first).toMatchObject({ due: true, localDate: '2026-10-25', triggerAt: new Date('2026-10-25T00:15:00Z') });
      expect(second).toMatchObject({ due: true, localDate: '2026-10-25', triggerAt: new Date('2026-10-25T01:15:00Z') });
      expect((first as { occurrenceKey: string }).occurrenceKey).not.toBe((second as { occurrenceKey: string }).occurrenceKey);
      expect(eventLocalTimeText('Europe/London', new Date('2026-10-25T00:30:00Z'))).toBe('2026-10-25 01:30');
      expect(eventLocalTimeText('Europe/London', new Date('2026-10-25T01:30:00Z'))).toBe('2026-10-25 01:30');
    });

    it('an event spanning the change keeps its exact length: the lead counts real minutes', () => {
      const ny = trigger({ timeZone: 'America/New_York', leadMinutes: 120, armedAt: new Date('2026-01-01T00:00:00Z') });
      // 03:30 EDT = 07:30Z; 120 real minutes before = 05:30Z (00:30 EST).
      expect(eventTriggerDue(ny, event('2026-03-08T07:30:00Z'), new Date('2026-03-08T05:30:00Z'))).toMatchObject({
        due: true,
        triggerAt: new Date('2026-03-08T05:30:00Z'),
      });
    });
  });

  describe('the occurrence key (stage-start section 4)', () => {
    it('is the SHA-256 hex of trigger id, uid and the start instant', () => {
      const start = new Date('2026-11-16T02:00:00Z');
      const expected = createHash('sha256').update(`${TRIGGER_ID}\nuid-1\n2026-11-16T02:00:00.000Z`, 'utf8').digest('hex');
      expect(occurrenceKeyOf(TRIGGER_ID, 'uid-1', start)).toBe(expected);
      expect(occurrenceKeyOf(TRIGGER_ID, 'uid-1', start)).toMatch(/^[0-9a-f]{64}$/);
    });

    it("a moved event (another start) is another occurrence (Keith's Q6); the same start in another notation is the same", () => {
      const a = occurrenceKeyOf(TRIGGER_ID, 'uid-1', new Date('2026-11-16T02:00:00Z'));
      expect(occurrenceKeyOf(TRIGGER_ID, 'uid-1', new Date('2026-11-16T02:30:00Z'))).not.toBe(a);
      expect(occurrenceKeyOf(TRIGGER_ID, 'uid-1', new Date('2026-11-16T10:00:00+08:00'))).toBe(a);
      expect(occurrenceKeyOf('aaaaaaaa-0000-4000-8000-000000000002', 'uid-1', new Date('2026-11-16T02:00:00Z'))).not.toBe(a);
      expect(occurrenceKeyOf(TRIGGER_ID, 'uid-2', new Date('2026-11-16T02:00:00Z'))).not.toBe(a);
    });

    it('the key does not contain the uid', () => {
      const uid = 'secret-uid-0123456789abcdef@calendar.example.com';
      expect(occurrenceKeyOf(TRIGGER_ID, uid, new Date('2026-11-16T02:00:00Z'))).not.toContain('secret');
    });
  });

  it('instantOf reads ISO instants only', () => {
    expect(instantOf('2026-11-16T02:00:00Z')).toEqual(new Date('2026-11-16T02:00:00Z'));
    expect(instantOf('')).toBeNull();
    expect(instantOf('soon')).toBeNull();
    expect(instantOf(42)).toBeNull();
    expect(instantOf(undefined)).toBeNull();
  });

  it('the local time text is 24-hour in the zone', () => {
    expect(eventLocalTimeText('Asia/Singapore', new Date('2026-11-16T02:00:00Z'))).toBe('2026-11-16 10:00');
    expect(eventLocalTimeText('Asia/Singapore', new Date('2026-11-16T16:05:00Z'))).toBe('2026-11-17 00:05');
    expect(eventLocalTimeText('Mars/Olympus', new Date())).toBeNull();
  });
});
