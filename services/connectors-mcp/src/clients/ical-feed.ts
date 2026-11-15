import { expandRecurringEvent, parseICS, type EventInstance, type ParameterValue, type VEvent } from 'node-ical';

import { errorText, limitText, redact, stripControls } from '../limits';
import { fetchPublicHttps } from '../net/public-https';

export interface CalendarPerson {
  name: string;
  address: string;
}

export interface CalendarEvent {
  title: string;
  start: string;
  end: string;
  organizer: CalendarPerson | null;
  attendeeCount: number;
  ownerResponse: string | null;
}

export interface CalendarTodayInput {
  icalUrl: string;
  timeZone: string;
  ownerEmail?: string;
  now?: string | Date;
}

export interface CalendarFeed {
  listToday(input: CalendarTodayInput): Promise<CalendarEvent[]>;
}

/**
 * TRIGGER-EVENT-01 S1: one occurrence for the gateway's event triggers. Only the
 * event id, the title and the two instants: no organizer, attendees, description
 * or location.
 */
export interface CalendarWindowEvent {
  uid: string;
  title: string;
  start: string;
  end: string;
}

export interface CalendarWindowInput {
  icalUrl: string;
  from: Date;
  to: Date;
}

export interface CalendarWindowFeed {
  listWindow(input: CalendarWindowInput): Promise<CalendarWindowEvent[]>;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function timeZoneFormatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    throw new Error('invalid time zone');
  }
}

function zonedParts(date: Date, formatter: Intl.DateTimeFormat): ZonedParts {
  const map: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  let hour = Number(map.hour);
  if (hour === 24) {
    hour = 0;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function offsetMs(date: Date, formatter: Intl.DateTimeFormat): number {
  const parts = zonedParts(date, formatter);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function zonedInstant(year: number, month: number, day: number, formatter: Intl.DateTimeFormat): Date {
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const first = guess - offsetMs(new Date(guess), formatter);
  const second = guess - offsetMs(new Date(first), formatter);
  return new Date(second);
}

export function zonedDayBounds(now: Date, timeZone: string): { start: Date; end: Date; ymd: string } {
  const formatter = timeZoneFormatter(timeZone);
  const parts = zonedParts(now, formatter);
  const ymd = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  const start = zonedInstant(parts.year, parts.month, parts.day, formatter);
  const end = zonedInstant(parts.year, parts.month, parts.day + 1, formatter);
  return { start, end, ymd };
}

function localYmd(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function parameterText(value: ParameterValue | undefined): string {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return typeof value.val === 'string' ? value.val : '';
}

function emailAddress(raw: string): string {
  return stripControls(raw.replace(/^mailto:/i, '').trim());
}

function personFrom(value: unknown): CalendarPerson | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    const address = emailAddress(value);
    return address ? { name: '', address } : null;
  }
  if (typeof value !== 'object') {
    return null;
  }
  const record = value as { val?: unknown; params?: { CN?: unknown } };
  const address = typeof record.val === 'string' ? emailAddress(record.val) : '';
  const name = typeof record.params?.CN === 'string' ? stripControls(record.params.CN) : '';
  if (!address && !name) {
    return null;
  }
  return { name, address };
}

function attendeesOf(value: unknown): Array<{ person: CalendarPerson; partstat: string | null }> {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const attendees = [];
  for (const entry of list) {
    const person = personFrom(entry);
    if (!person) {
      continue;
    }
    let partstat: string | null = null;
    if (entry && typeof entry === 'object' && 'params' in entry) {
      const params = (entry as { params?: { PARTSTAT?: unknown } }).params;
      if (typeof params?.PARTSTAT === 'string') {
        partstat = stripControls(params.PARTSTAT).toUpperCase();
      }
    }
    attendees.push({ person, partstat });
  }
  return attendees;
}

function occursToday(instance: EventInstance, bounds: { start: Date; end: Date; ymd: string }): boolean {
  const fullDay = instance.isFullDay || instance.start.dateOnly === true;
  if (fullDay) {
    const startYmd = localYmd(instance.start);
    const endYmd = instance.end ? localYmd(instance.end) : startYmd;
    if (endYmd <= startYmd) {
      return startYmd === bounds.ymd;
    }
    return startYmd <= bounds.ymd && bounds.ymd < endYmd;
  }
  const start = instance.start.getTime();
  const end = instance.end.getTime();
  return start < bounds.end.getTime() && end > bounds.start.getTime();
}

function eventFromInstance(instance: EventInstance, ownerEmail: string | undefined): CalendarEvent {
  const source: VEvent = instance.event;
  const attendees = attendeesOf(source.attendee);
  const owner = ownerEmail ? ownerEmail.trim().toLowerCase() : '';
  const match = owner ? attendees.find((entry) => entry.person.address.toLowerCase() === owner) : undefined;
  const organizer = personFrom(source.organizer);
  return {
    title: limitText(parameterText(instance.summary)),
    start: instance.start.toISOString(),
    end: instance.end.toISOString(),
    organizer: organizer ? { name: organizer.name, address: organizer.address } : null,
    attendeeCount: attendees.length,
    ownerResponse: match ? match.partstat : null,
  };
}

/**
 * The events of a parsed feed, each with its occurrences between `from` and `to`
 * (both inclusive): repeating events expanded, EXDATE exceptions left out and
 * RECURRENCE-ID overrides applied. An event that cannot be expanded is skipped.
 */
function expandedEvents(ics: string, from: Date, to: Date): Array<{ component: VEvent; instances: EventInstance[] }> {
  const parsed = parseICS(ics);
  const out: Array<{ component: VEvent; instances: EventInstance[] }> = [];
  for (const component of Object.values(parsed)) {
    if (!component || component.type !== 'VEVENT') {
      continue;
    }
    try {
      const instances = expandRecurringEvent(component, {
        from,
        to,
        expandOngoing: true,
        excludeExdates: true,
        includeOverrides: true,
      });
      out.push({ component, instances });
    } catch {
      continue;
    }
  }
  return out;
}

export function eventsFromIcs(ics: string, timeZone: string, now: Date, ownerEmail?: string): CalendarEvent[] {
  const bounds = zonedDayBounds(now, timeZone);
  const events: CalendarEvent[] = [];
  for (const { instances } of expandedEvents(ics, bounds.start, new Date(bounds.end.getTime() - 1))) {
    for (const instance of instances) {
      if (!occursToday(instance, bounds)) {
        continue;
      }
      events.push(eventFromInstance(instance, ownerEmail));
    }
  }
  events.sort((left, right) => left.start.localeCompare(right.start) || left.title.localeCompare(right.title));
  return events;
}

/** TRIGGER-EVENT-01 S1: a window read covers at most 3 hours. */
export const CALENDAR_WINDOW_MAX_MS = 3 * 60 * 60 * 1000;

/** Throws unless `to` is after `from` and at most 3 hours later. */
export function checkCalendarWindow(from: Date, to: Date): void {
  if (!(from instanceof Date) || !(to instanceof Date) || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('from and to must be ISO times');
  }
  const span = to.getTime() - from.getTime();
  if (span <= 0) {
    throw new Error('to must be after from');
  }
  if (span > CALENDAR_WINDOW_MAX_MS) {
    throw new Error('the window must be at most 3 hours');
  }
}

function isCancelled(event: VEvent): boolean {
  const status: unknown = event.status;
  return typeof status === 'string' && stripControls(status).trim().toUpperCase() === 'CANCELLED';
}

/**
 * TRIGGER-EVENT-01 S1: the timed, not-cancelled occurrences whose start is in
 * [from, to). All-day events never count. A cancelled override cancels only its
 * own occurrence. An event without a UID cannot be told apart, so it is skipped.
 */
export function windowEventsFromIcs(ics: string, from: Date, to: Date): CalendarWindowEvent[] {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const events: CalendarWindowEvent[] = [];
  for (const { component, instances } of expandedEvents(ics, from, new Date(toMs - 1))) {
    for (const instance of instances) {
      if (instance.isFullDay || instance.start.dateOnly === true) {
        continue;
      }
      const source: VEvent = instance.event || component;
      if (isCancelled(source)) {
        continue;
      }
      const start = instance.start.getTime();
      if (!(start >= fromMs && start < toMs)) {
        continue;
      }
      const rawUid = typeof source.uid === 'string' && source.uid.length > 0 ? source.uid : component.uid;
      const uid = typeof rawUid === 'string' ? limitText(rawUid).trim() : '';
      if (!uid) {
        continue;
      }
      events.push({
        uid,
        title: limitText(parameterText(instance.summary)),
        start: instance.start.toISOString(),
        end: instance.end.toISOString(),
      });
    }
  }
  events.sort((left, right) => left.start.localeCompare(right.start) || left.uid.localeCompare(right.uid));
  return events;
}

export class IcalCalendarFeed implements CalendarFeed, CalendarWindowFeed {
  constructor(private readonly fetchFeed: (url: string) => Promise<Buffer> = fetchPublicHttps) {}

  async listToday(input: CalendarTodayInput): Promise<CalendarEvent[]> {
    const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
    if (Number.isNaN(now.getTime())) {
      throw new Error('now must be an ISO time');
    }
    zonedDayBounds(now, input.timeZone);
    try {
      const body = await this.fetchFeed(input.icalUrl);
      return eventsFromIcs(body.toString('utf8'), input.timeZone, now, input.ownerEmail);
    } catch (error) {
      throw new Error(redact(errorText(error), [input.icalUrl]));
    }
  }

  async listWindow(input: CalendarWindowInput): Promise<CalendarWindowEvent[]> {
    checkCalendarWindow(input.from, input.to);
    try {
      const body = await this.fetchFeed(input.icalUrl);
      return windowEventsFromIcs(body.toString('utf8'), input.from, input.to);
    } catch (error) {
      throw new Error(redact(errorText(error), [input.icalUrl]));
    }
  }
}
