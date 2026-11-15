import {
  SCHEDULE_LATE_WINDOW_MINUTES,
  SCHEDULE_TICK_MS,
  localTimeIn,
  scheduleDue,
  weekdayBit,
  type ScheduleDueInput,
} from './schedule-due';

/** TRIGGER-01 S2 acceptance 1: the due rule (stage-start section 3). */

const MON = 1;
const TUE = 2;
const SAT = 32;
const SUN = 64;
const WEEKDAYS = MON | TUE | 4 | 8 | 16;
const EVERY_DAY = 127;

function hm(text: string): number {
  const [hours, minutes] = text.split(':').map(Number);
  return hours * 60 + minutes;
}

function schedule(overrides: Partial<ScheduleDueInput> = {}): ScheduleDueInput {
  return {
    days: WEEKDAYS,
    timeOfDay: hm('07:00'),
    timeZone: 'Asia/Singapore',
    armedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('scheduleDue (TRIGGER-01 S2 acceptance 1)', () => {
  it('uses the code constants of the stage-start: a 60-second tick and a 60-minute window', () => {
    expect(SCHEDULE_TICK_MS).toBe(60_000);
    expect(SCHEDULE_LATE_WINDOW_MINUTES).toBe(60);
  });

  it('reads the local date, weekday and minute in the zone (Monday = 1, Sunday = 7, midnight = 0)', () => {
    expect(localTimeIn('Asia/Singapore', new Date('2026-11-15T16:00:00Z'))).toEqual({
      localDate: '2026-11-16',
      weekday: 1,
      minute: 0,
      second: 0,
    });
    expect(localTimeIn('UTC', new Date('2026-11-15T23:59:30Z'))).toEqual({
      localDate: '2026-11-15',
      weekday: 7,
      minute: hm('23:59'),
      second: 30,
    });
    expect(localTimeIn('Not/AZone', new Date())).toBeNull();
    expect([1, 2, 3, 4, 5, 6, 7].map(weekdayBit)).toEqual([1, 2, 4, 8, 16, 32, 64]);
  });

  describe('the weekday mask', () => {
    // 2026-11-16 is a Monday; 07:05 in Singapore is 23:05 UTC the day before.
    it.each([
      ['a ticked Monday', WEEKDAYS, '2026-11-15T23:05:00Z', true],
      ['an unticked Sunday', WEEKDAYS, '2026-11-14T23:05:00Z', false],
      ['Sunday only, on a Sunday', SUN, '2026-11-14T23:05:00Z', true],
      ['Saturday only, on a Sunday', SAT, '2026-11-14T23:05:00Z', false],
      ['Tuesday only, on a Monday', TUE, '2026-11-15T23:05:00Z', false],
      ['every day', EVERY_DAY, '2026-11-14T23:05:00Z', true],
    ])('%s', (_name, days, at, due) => {
      const result = scheduleDue(schedule({ days }), new Date(at));
      expect(result.due).toBe(due);
      if (!due) expect(result).toMatchObject({ reason: 'not_today' });
    });
  });

  describe('before and after the time, and the 60-minute window', () => {
    // Singapore is UTC+8 all year: 07:00 SGT on Monday 2026-11-16 is 2026-11-15T23:00Z.
    it.each([
      ['06:59', '2026-11-15T22:59:00Z', { due: false, reason: 'before_time', localDate: '2026-11-16' }],
      ['07:00 exactly', '2026-11-15T23:00:00Z', { due: true, late: false, minutesLate: 0, localDate: '2026-11-16' }],
      ['07:30', '2026-11-15T23:30:00Z', { due: true, late: false, minutesLate: 30 }],
      ['08:00 (60 minutes late: still started)', '2026-11-16T00:00:59Z', { due: true, late: false, minutesLate: 60 }],
      ['08:01 (61 minutes late: missed)', '2026-11-16T00:01:00Z', { due: true, late: true, minutesLate: 61 }],
      ['15:00 (missed)', '2026-11-16T07:00:00Z', { due: true, late: true, minutesLate: 480 }],
    ])('%s', (_name, at, expected) => {
      expect(scheduleDue(schedule(), new Date(at))).toMatchObject(expected);
    });
  });

  describe('armed_at', () => {
    const at = new Date('2026-11-15T23:10:00Z'); // Monday 07:10 SGT
    it.each([
      ['armed the day before', '2026-11-15T01:00:00Z', true],
      ['armed the same day before the time (06:59:59)', '2026-11-15T22:59:59Z', true],
      ['armed at the time itself (07:00:00)', '2026-11-15T23:00:00Z', false],
      ['armed after the time (07:00:30)', '2026-11-15T23:00:30Z', false],
      ['armed later the same day (07:05)', '2026-11-15T23:05:00Z', false],
    ])('%s', (_name, armedAt, due) => {
      const result = scheduleDue(schedule({ armedAt: new Date(armedAt) }), at);
      expect(result.due).toBe(due);
      if (!due) expect(result).toMatchObject({ reason: 'not_armed', localDate: '2026-11-16' });
    });

    it('a schedule armed today after its time is due on the next ticked day', () => {
      const armedAt = new Date('2026-11-15T23:05:00Z');
      expect(scheduleDue(schedule({ armedAt }), new Date('2026-11-16T23:00:00Z'))).toMatchObject({
        due: true,
        localDate: '2026-11-17',
      });
    });

    it('an armed_at that is not a date is never due', () => {
      expect(scheduleDue(schedule({ armedAt: new Date('nope') }), at)).toMatchObject({ due: false, reason: 'not_armed' });
    });
  });

  it('a local date that already has a row is not due again', () => {
    const at = new Date('2026-11-15T23:10:00Z');
    expect(scheduleDue(schedule(), at, new Set(['2026-11-16']))).toEqual({
      due: false,
      reason: 'recorded',
      localDate: '2026-11-16',
    });
    // A row for another date does not count.
    expect(scheduleDue(schedule(), at, new Set(['2026-11-15'])).due).toBe(true);
  });

  describe('DST in America/New_York', () => {
    const newYork = (overrides: Partial<ScheduleDueInput>) =>
      schedule({ timeZone: 'America/New_York', days: SUN, ...overrides });

    it('spring forward 2026-03-08: 02:30 does not exist; it is first seen at 03:00 EDT and starts then', () => {
      const s = newYork({ timeOfDay: hm('02:30') });
      // 01:59 EST: before the time.
      expect(scheduleDue(s, new Date('2026-03-08T06:59:00Z'))).toMatchObject({ due: false, reason: 'before_time' });
      // One minute later the clock reads 03:00 EDT.
      expect(scheduleDue(s, new Date('2026-03-08T07:00:00Z'))).toEqual({
        due: true,
        late: false,
        minutesLate: 30,
        localDate: '2026-03-08',
      });
    });

    it('spring forward: a 07:00 schedule still starts at 07:00 EDT', () => {
      const s = newYork({ timeOfDay: hm('07:00') });
      expect(scheduleDue(s, new Date('2026-03-08T10:59:00Z'))).toMatchObject({ due: false, reason: 'before_time' });
      expect(scheduleDue(s, new Date('2026-03-08T11:00:00Z'))).toMatchObject({ due: true, minutesLate: 0 });
    });

    it('fall back 2026-11-01: the first 01:30 (EDT) starts; the second (EST) finds the day row', () => {
      const s = newYork({ timeOfDay: hm('01:30') });
      const first = scheduleDue(s, new Date('2026-11-01T05:30:00Z'));
      expect(first).toEqual({ due: true, late: false, minutesLate: 0, localDate: '2026-11-01' });
      // The second 01:30 is the same local date: the unique row stops it.
      const second = new Date('2026-11-01T06:30:00Z');
      expect(scheduleDue(s, second)).toMatchObject({ due: true, localDate: '2026-11-01' });
      expect(scheduleDue(s, second, new Set(['2026-11-01']))).toMatchObject({ due: false, reason: 'recorded' });
    });
  });

  it('Asia/Singapore (no DST): the local date runs 8 hours ahead of UTC', () => {
    const s = schedule({ timeOfDay: hm('00:30'), days: MON });
    // 16:30 UTC on Sunday 2026-11-15 is 00:30 on Monday 2026-11-16 in Singapore.
    expect(scheduleDue(s, new Date('2026-11-15T16:30:00Z'))).toMatchObject({ due: true, localDate: '2026-11-16' });
    expect(scheduleDue(s, new Date('2026-11-15T16:29:00Z'))).toMatchObject({ due: false, reason: 'before_time' });
  });

  it('a zone a day ahead of UTC (Pacific/Kiritimati, UTC+14): Monday there while it is Sunday in UTC', () => {
    const s = schedule({ timeZone: 'Pacific/Kiritimati', timeOfDay: hm('01:00'), days: MON });
    expect(scheduleDue(s, new Date('2026-11-15T12:00:00Z'))).toMatchObject({ due: true, localDate: '2026-11-16' });
    // Sunday-only in that zone is not due at the same instant, although UTC says Sunday.
    expect(scheduleDue({ ...s, days: SUN }, new Date('2026-11-15T12:00:00Z'))).toMatchObject({
      due: false,
      reason: 'not_today',
      localDate: '2026-11-16',
    });
  });

  describe('the day boundary: only today is looked at, no catch-up', () => {
    const late = schedule({ timeOfDay: hm('23:30'), days: EVERY_DAY });

    it('23:59 is due for that date', () => {
      expect(scheduleDue(late, new Date('2026-11-16T15:59:00Z'))).toMatchObject({
        due: true,
        localDate: '2026-11-16',
        late: false,
      });
    });

    it('00:10 the next day is the next date, before its time: yesterday is never started late', () => {
      expect(scheduleDue(late, new Date('2026-11-16T16:10:00Z'))).toEqual({
        due: false,
        reason: 'before_time',
        localDate: '2026-11-17',
      });
    });
  });

  it('a zone Intl refuses is never due', () => {
    expect(scheduleDue(schedule({ timeZone: 'Mars/Olympus' }), new Date())).toEqual({
      due: false,
      reason: 'bad_zone',
      localDate: null,
    });
  });
});
