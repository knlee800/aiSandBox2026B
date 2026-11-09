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

export function eventsFromIcs(ics: string, timeZone: string, now: Date, ownerEmail?: string): CalendarEvent[] {
  const bounds = zonedDayBounds(now, timeZone);
  const parsed = parseICS(ics);
  const events: CalendarEvent[] = [];
  for (const component of Object.values(parsed)) {
    if (!component || component.type !== 'VEVENT') {
      continue;
    }
    let instances: EventInstance[] = [];
    try {
      instances = expandRecurringEvent(component, {
        from: bounds.start,
        to: new Date(bounds.end.getTime() - 1),
        expandOngoing: true,
        excludeExdates: true,
        includeOverrides: true,
      });
    } catch {
      continue;
    }
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

export class IcalCalendarFeed implements CalendarFeed {
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
}
