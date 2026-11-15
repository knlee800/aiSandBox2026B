import type { AgentSchedule } from '../entities/agent-schedule.entity';

/**
 * TRIGGER-01 S2 (stage-start section 3): when a schedule is due.
 *
 * Pure: no clock, no database. The caller passes `now` and, when it has read
 * them, the local dates that already have an agent_schedule_runs row.
 *
 * The local date, weekday and minute are read in the schedule's own IANA
 * time zone with Intl.DateTimeFormat (no library, no stored next-run time).
 * Due means:
 *  - today's local weekday is ticked in `days` (Monday = 1 ... Sunday = 64);
 *  - the local minute is at or after `time_of_day`;
 *  - the occurrence (today's local date at `time_of_day`) is after
 *    `armed_at`, compared as local wall time in the same zone;
 *  - no row exists for (schedule, today's local date).
 * Only today's local date is ever looked at: there is no catch-up for an
 * earlier day. Within SCHEDULE_LATE_WINDOW_MINUTES of `time_of_day` the
 * occurrence starts; later than that it is recorded as missed (Keith's Q4).
 *
 * DST, as wall time: on a spring-forward day a time inside the missing hour is
 * first seen after the jump (02:30 is first seen at 03:00, 30 minutes late) and
 * starts then; on a fall-back day the first 01:30 starts and the second finds
 * the day's row. Both follow from "one row per local date".
 */

/** The timer's tick. */
export const SCHEDULE_TICK_MS = 60 * 1000;
/** Later than this after time_of_day: recorded as missed, not started. */
export const SCHEDULE_LATE_WINDOW_MINUTES = 60;

export interface ScheduleLocalTime {
  /** 'YYYY-MM-DD' in the zone. */
  localDate: string;
  /** 1 = Monday ... 7 = Sunday. */
  weekday: number;
  /** Minutes after local midnight, 0..1439. */
  minute: number;
  /** Seconds after the local minute, 0..59. */
  second: number;
}

export type ScheduleDueResult =
  | { due: true; localDate: string; late: false; minutesLate: number }
  | { due: true; localDate: string; late: true; minutesLate: number }
  | {
      due: false;
      reason: 'bad_zone' | 'not_today' | 'before_time' | 'not_armed' | 'recorded';
      localDate: string | null;
    };

export type ScheduleDueInput = Pick<AgentSchedule, 'days' | 'timeOfDay' | 'timeZone' | 'armedAt'>;

const WEEKDAYS: Readonly<Record<string, number>> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The local date, weekday and minute of `at` in `timeZone`; null for a zone Intl refuses. */
export function localTimeIn(timeZone: string, at: Date): ScheduleLocalTime | null {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = formatterFor(timeZone).formatToParts(at);
  } catch {
    return null;
  }
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  const weekday = WEEKDAYS[part('weekday')];
  const year = part('year');
  const month = part('month');
  const day = part('day');
  // Some ICU builds still print '24' for midnight; it is hour 0 of the same date.
  const hour = Number(part('hour')) % 24;
  const minute = Number(part('minute'));
  const second = Number(part('second'));
  if (
    weekday === undefined ||
    !/^\d{4}$/.test(year) ||
    !/^\d{2}$/.test(month) ||
    !/^\d{2}$/.test(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second)
  ) {
    return null;
  }
  return { localDate: `${year}-${month}-${day}`, weekday, minute: hour * 60 + minute, second };
}

/** The `days` bit of a weekday (1 = Monday = bit 1 ... 7 = Sunday = bit 64). */
export function weekdayBit(weekday: number): number {
  return 1 << (weekday - 1);
}

/**
 * Whether the schedule is due at `now`, and for which local date.
 * `recordedLocalDates` holds the local dates that already have a row for
 * this schedule (the claim's unique index is the final word either way).
 */
export function scheduleDue(
  schedule: ScheduleDueInput,
  now: Date,
  recordedLocalDates: ReadonlySet<string> = new Set(),
): ScheduleDueResult {
  const local = localTimeIn(schedule.timeZone, now);
  if (!local) {
    return { due: false, reason: 'bad_zone', localDate: null };
  }
  if ((schedule.days & weekdayBit(local.weekday)) === 0) {
    return { due: false, reason: 'not_today', localDate: local.localDate };
  }
  if (local.minute < schedule.timeOfDay) {
    return { due: false, reason: 'before_time', localDate: local.localDate };
  }
  if (!occurrenceAfterArmed(schedule, local.localDate)) {
    return { due: false, reason: 'not_armed', localDate: local.localDate };
  }
  if (recordedLocalDates.has(local.localDate)) {
    return { due: false, reason: 'recorded', localDate: local.localDate };
  }
  const minutesLate = local.minute - schedule.timeOfDay;
  if (minutesLate > SCHEDULE_LATE_WINDOW_MINUTES) {
    return { due: true, localDate: local.localDate, late: true, minutesLate };
  }
  return { due: true, localDate: local.localDate, late: false, minutesLate };
}

/**
 * Today's occurrence (local date at time_of_day, second 0) is strictly after
 * armed_at, both read as wall time in the schedule's zone. A schedule armed
 * at 07:00:30 for 07:00 waits for the next ticked day; one armed at 06:59:59
 * starts at 07:00.
 */
function occurrenceAfterArmed(schedule: ScheduleDueInput, localDate: string): boolean {
  const armedAt = schedule.armedAt instanceof Date ? schedule.armedAt : new Date(schedule.armedAt);
  if (Number.isNaN(armedAt.getTime())) {
    return false;
  }
  const armed = localTimeIn(schedule.timeZone, armedAt);
  if (!armed) {
    return false;
  }
  if (armed.localDate !== localDate) {
    return armed.localDate < localDate;
  }
  return armed.minute * 60 + armed.second < schedule.timeOfDay * 60;
}
