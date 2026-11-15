import { createHash } from 'crypto';
import type { AgentEventTrigger } from '../entities/agent-event-trigger.entity';
import { localTimeIn } from './schedule-due';

/**
 * TRIGGER-EVENT-01 S3 (stage-start sections 2 and 4): when an event
 * occurrence is due for a trigger.
 *
 * Pure: no clock, no database, no calendar. The caller passes `now` and one
 * event from the calendar read (held in memory only).
 *
 * Event times are instants, so a DST change never moves a trigger: the
 * trigger time is the event's start minus lead_minutes, as an instant. The
 * trigger's time_zone is used only for the local date of the occurrence (the
 * day limit and the history row) and to print the times in the task.
 *
 * An occurrence is due when:
 *  - the event has a valid start and end (the window read lists timed,
 *    not-cancelled events only; all-day events never reach here);
 *  - its title contains the trigger's title_filter, ignoring case (no filter,
 *    or an empty one, matches every timed event; Keith's Q3);
 *  - its trigger time is strictly after armed_at (switching on at 10:00 with
 *    a 30-minute lead does not fire for a 10:10 meeting);
 *  - trigger time <= now < start: it starts, late or not, until the event
 *    begins.
 * Once the event has begun (start <= now) it is `missed`: the caller records
 * that only for an occurrence it already holds in memory and that has no row
 * (there is no catch-up: a fresh read begins at "now").
 */

/** The timer's tick. */
export const EVENT_TRIGGER_TICK_MS = 60 * 1000;

/** The event fields the due rule reads (the window read's shape). */
export interface EventTriggerDueEvent {
  uid: string;
  title: string;
  start: string;
  end: string;
}

export type EventTriggerDueInput = Pick<AgentEventTrigger, 'id' | 'leadMinutes' | 'titleFilter' | 'timeZone' | 'armedAt'>;

export type EventTriggerDueResult =
  | {
      due: true;
      /** true once the event has begun: recorded as skipped / missed, never started. */
      missed: boolean;
      start: Date;
      end: Date;
      triggerAt: Date;
      /** 'YYYY-MM-DD' of the event's start in the trigger's zone. */
      localDate: string;
      occurrenceKey: string;
    }
  | {
      due: false;
      reason: 'bad_event' | 'bad_zone' | 'no_match' | 'not_armed' | 'before_time';
    };

/** An ISO instant from the read; null when it is not one. */
export function instantOf(value: unknown): Date | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Keith's Q3: the title contains the filter, ignoring case; no filter (or an empty one) matches every event. */
export function titleMatches(filter: string | null | undefined, title: string): boolean {
  if (filter === null || filter === undefined) {
    return true;
  }
  const needle = filter.trim().toLocaleLowerCase('en-US');
  if (needle.length === 0) {
    return true;
  }
  return typeof title === 'string' && title.toLocaleLowerCase('en-US').includes(needle);
}

/** 'YYYY-MM-DD' of `at` in `timeZone`; null for a zone Intl refuses. */
export function eventLocalDate(timeZone: string, at: Date): string | null {
  return localTimeIn(timeZone, at)?.localDate ?? null;
}

/** 'YYYY-MM-DD HH:MM' of `at` in `timeZone` (24-hour); null for a zone Intl refuses. */
export function eventLocalTimeText(timeZone: string, at: Date): string | null {
  const local = localTimeIn(timeZone, at);
  if (!local) {
    return null;
  }
  const hour = String(Math.floor(local.minute / 60)).padStart(2, '0');
  const minute = String(local.minute % 60).padStart(2, '0');
  return `${local.localDate} ${hour}:${minute}`;
}

/**
 * Stage-start section 4: SHA-256 hex of the trigger id, the event uid and the
 * start instant. The raw uid is never stored; a moved event (a new start) is a
 * new occurrence (Keith's Q6).
 */
export function occurrenceKeyOf(triggerId: string, uid: string, start: Date): string {
  return createHash('sha256').update(`${triggerId}\n${uid}\n${start.toISOString()}`, 'utf8').digest('hex');
}

export function eventTriggerDue(
  trigger: EventTriggerDueInput,
  event: EventTriggerDueEvent,
  now: Date,
): EventTriggerDueResult {
  const start = instantOf(event?.start);
  const end = instantOf(event?.end);
  if (!start || !end || typeof event.uid !== 'string' || event.uid.length === 0 || end.getTime() < start.getTime()) {
    return { due: false, reason: 'bad_event' };
  }
  const localDate = eventLocalDate(trigger.timeZone, start);
  if (!localDate) {
    return { due: false, reason: 'bad_zone' };
  }
  if (!titleMatches(trigger.titleFilter, event.title)) {
    return { due: false, reason: 'no_match' };
  }
  const lead = Number(trigger.leadMinutes);
  if (!Number.isInteger(lead) || lead <= 0) {
    return { due: false, reason: 'bad_event' };
  }
  const triggerAt = new Date(start.getTime() - lead * 60 * 1000);
  const armedAt = trigger.armedAt instanceof Date ? trigger.armedAt : new Date(trigger.armedAt);
  if (Number.isNaN(armedAt.getTime()) || triggerAt.getTime() <= armedAt.getTime()) {
    return { due: false, reason: 'not_armed' };
  }
  if (now.getTime() < triggerAt.getTime()) {
    return { due: false, reason: 'before_time' };
  }
  return {
    due: true,
    missed: now.getTime() >= start.getTime(),
    start,
    end,
    triggerAt,
    localDate,
    occurrenceKey: occurrenceKeyOf(trigger.id, event.uid, start),
  };
}
