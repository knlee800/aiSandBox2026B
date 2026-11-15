import { CALENDAR_WINDOW_MAX_MS, IcalCalendarFeed, windowEventsFromIcs } from '../clients/ical-feed';
import type { CalendarWindowFeed } from '../clients/ical-feed';
import { MAX_RESULT_CHARS, MAX_TEXT_CHARS } from '../limits';
import { fetchPublicHttps } from '../net/public-https';
import { calendarListWindow, defaultCalendarWindowFeed, readCalendarWindowArguments } from '../tools/calendar-window';

/**
 * TRIGGER-EVENT-01 S1: the gateway-only window read. Fixtures only; no network.
 */
function calendar(body: string): string {
  return `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//aisb//test//EN\n${body}\nEND:VCALENDAR\n`;
}

const FEED_URL = 'https://calendar.example/feed.ics?token=super-secret-token';
const FROM = new Date('2026-11-16T08:00:00.000Z');
const TO = new Date('2026-11-16T11:00:00.000Z');

const HOURLY = `BEGIN:VEVENT
UID:hourly-1@example
DTSTAMP:20261101T000000Z
DTSTART:20261116T080000Z
DTEND:20261116T083000Z
RRULE:FREQ=HOURLY;COUNT=6
EXDATE:20261116T090000Z
SUMMARY:Sync
ORGANIZER;CN=Ada:mailto:ada@example.com
ATTENDEE;CN=Owner;PARTSTAT=ACCEPTED:mailto:owner@example.com
DESCRIPTION:Secret agenda
LOCATION:Room 7
END:VEVENT
BEGIN:VEVENT
UID:hourly-1@example
DTSTAMP:20261101T000000Z
RECURRENCE-ID:20261116T100000Z
DTSTART:20261116T101500Z
DTEND:20261116T104500Z
SUMMARY:Sync moved
END:VEVENT`;

describe('calendar window events (TRIGGER-EVENT-01 S1)', () => {
  it('returns only uid, title, start and end, expanding a repeating event with an exception and an override', () => {
    const events = windowEventsFromIcs(calendar(HOURLY), FROM, TO);
    expect(events).toEqual([
      { uid: 'hourly-1@example', title: 'Sync', start: '2026-11-16T08:00:00.000Z', end: '2026-11-16T08:30:00.000Z' },
      { uid: 'hourly-1@example', title: 'Sync moved', start: '2026-11-16T10:15:00.000Z', end: '2026-11-16T10:45:00.000Z' },
    ]);
    for (const event of events) {
      expect(Object.keys(event).sort()).toEqual(['end', 'start', 'title', 'uid']);
    }
    const rendered = JSON.stringify(events);
    for (const absent of ['ada@example.com', 'owner@example.com', 'Secret agenda', 'Room 7', 'ACCEPTED']) {
      expect(rendered).not.toContain(absent);
    }
  });

  it('finds an override moved into the window from an occurrence outside it', () => {
    const ics = calendar(`BEGIN:VEVENT
UID:weekly@example
DTSTAMP:20261101T000000Z
DTSTART:20261102T150000Z
DTEND:20261102T160000Z
RRULE:FREQ=WEEKLY
SUMMARY:Weekly
END:VEVENT
BEGIN:VEVENT
UID:weekly@example
DTSTAMP:20261101T000000Z
RECURRENCE-ID:20261116T150000Z
DTSTART:20261116T090000Z
DTEND:20261116T100000Z
SUMMARY:Weekly early
END:VEVENT`);
    expect(windowEventsFromIcs(ics, FROM, TO)).toEqual([
      { uid: 'weekly@example', title: 'Weekly early', start: '2026-11-16T09:00:00.000Z', end: '2026-11-16T10:00:00.000Z' },
    ]);
  });

  it('drops all-day events and cancelled events, including a cancelled occurrence of a repeating event', () => {
    const ics = calendar(`BEGIN:VEVENT
UID:holiday@example
DTSTAMP:20261101T000000Z
DTSTART;VALUE=DATE:20261116
DTEND;VALUE=DATE:20261117
SUMMARY:Holiday
END:VEVENT
BEGIN:VEVENT
UID:gone@example
DTSTAMP:20261101T000000Z
DTSTART:20261116T090000Z
DTEND:20261116T093000Z
STATUS:CANCELLED
SUMMARY:Gone
END:VEVENT
BEGIN:VEVENT
UID:lower@example
DTSTAMP:20261101T000000Z
DTSTART:20261116T091000Z
DTEND:20261116T093000Z
STATUS:cancelled
SUMMARY:Gone too
END:VEVENT
BEGIN:VEVENT
UID:kept@example
DTSTAMP:20261101T000000Z
DTSTART:20261116T094500Z
DTEND:20261116T100000Z
STATUS:CONFIRMED
SUMMARY:Kept
END:VEVENT
BEGIN:VEVENT
UID:series@example
DTSTAMP:20261101T000000Z
DTSTART:20261116T080000Z
DTEND:20261116T081500Z
RRULE:FREQ=HOURLY;COUNT=3
SUMMARY:Series
END:VEVENT
BEGIN:VEVENT
UID:series@example
DTSTAMP:20261101T000000Z
RECURRENCE-ID:20261116T090000Z
DTSTART:20261116T090000Z
DTEND:20261116T091500Z
STATUS:CANCELLED
SUMMARY:Series
END:VEVENT`);
    expect(windowEventsFromIcs(ics, FROM, TO)).toEqual([
      { uid: 'series@example', title: 'Series', start: '2026-11-16T08:00:00.000Z', end: '2026-11-16T08:15:00.000Z' },
      { uid: 'kept@example', title: 'Kept', start: '2026-11-16T09:45:00.000Z', end: '2026-11-16T10:00:00.000Z' },
      { uid: 'series@example', title: 'Series', start: '2026-11-16T10:00:00.000Z', end: '2026-11-16T10:15:00.000Z' },
    ]);
  });

  it('lists an occurrence only when its start is in [from, to)', () => {
    const ics = calendar(`BEGIN:VEVENT
UID:ongoing@example
DTSTAMP:20261101T000000Z
DTSTART:20261116T073000Z
DTEND:20261116T083000Z
SUMMARY:Already running
END:VEVENT
BEGIN:VEVENT
UID:at-from@example
DTSTAMP:20261101T000000Z
DTSTART:20261116T080000Z
DTEND:20261116T081000Z
SUMMARY:At from
END:VEVENT
BEGIN:VEVENT
UID:at-to@example
DTSTAMP:20261101T000000Z
DTSTART:20261116T110000Z
DTEND:20261116T111000Z
SUMMARY:At to
END:VEVENT`);
    expect(windowEventsFromIcs(ics, FROM, TO).map((event) => event.uid)).toEqual(['at-from@example']);
  });

  it('cuts titles at 300 characters and removes control characters, as today', () => {
    const title = `\u0001${'T'.repeat(400)}`;
    const ics = calendar(`BEGIN:VEVENT
UID:long@example
DTSTAMP:20261101T000000Z
DTSTART:20261116T090000Z
DTEND:20261116T100000Z
SUMMARY:${title}
END:VEVENT`);
    const [event] = windowEventsFromIcs(ics, FROM, TO);
    expect(event.title).toBe('T'.repeat(MAX_TEXT_CHARS));
    expect(event.title).not.toContain('\u0001');
  });
});

describe('calendar_list_window arguments and feed (TRIGGER-EVENT-01 S1)', () => {
  it('accepts a window of exactly 3 hours and refuses a longer, empty, reversed or non-ISO window', () => {
    expect(CALENDAR_WINDOW_MAX_MS).toBe(3 * 60 * 60 * 1000);
    expect(readCalendarWindowArguments({ icalUrl: FEED_URL, from: FROM.toISOString(), to: TO.toISOString() })).toEqual({
      icalUrl: FEED_URL,
      from: FROM,
      to: TO,
    });
    expect(() =>
      readCalendarWindowArguments({ icalUrl: FEED_URL, from: FROM.toISOString(), to: '2026-11-16T11:00:00.001Z' }),
    ).toThrow('the window must be at most 3 hours');
    expect(() => readCalendarWindowArguments({ icalUrl: FEED_URL, from: FROM.toISOString(), to: FROM.toISOString() })).toThrow(
      'to must be after from',
    );
    expect(() => readCalendarWindowArguments({ icalUrl: FEED_URL, from: TO.toISOString(), to: FROM.toISOString() })).toThrow(
      'to must be after from',
    );
    for (const bad of ['2026-11-16', '2026-11-16T08:00:00', 'tomorrow', 1763280000000, undefined]) {
      expect(() => readCalendarWindowArguments({ icalUrl: FEED_URL, from: bad, to: TO.toISOString() })).toThrow(
        'from must be an ISO time',
      );
    }
    expect(() => readCalendarWindowArguments({ from: FROM.toISOString(), to: TO.toISOString() })).toThrow('icalUrl is required');
    expect(() => readCalendarWindowArguments(null)).toThrow('calendar arguments are required');
  });

  it('refuses a window over 3 hours before fetching the feed', async () => {
    const fetchFeed = jest.fn();
    const feed = new IcalCalendarFeed(fetchFeed);
    await expect(
      calendarListWindow(feed, { icalUrl: FEED_URL, from: FROM.toISOString(), to: '2026-11-16T12:00:00.000Z' }),
    ).rejects.toThrow('the window must be at most 3 hours');
    await expect(
      feed.listWindow({ icalUrl: FEED_URL, from: FROM, to: new Date(FROM.getTime() + CALENDAR_WINDOW_MAX_MS + 1) }),
    ).rejects.toThrow('the window must be at most 3 hours');
    expect(fetchFeed).not.toHaveBeenCalled();
  });

  it('fetches with the same public HTTPS fetcher and parses the feed', async () => {
    const fetchFeed = jest.fn(async () => Buffer.from(calendar(HOURLY), 'utf8'));
    const feed = new IcalCalendarFeed(fetchFeed);
    const result = await calendarListWindow(feed, { icalUrl: FEED_URL, from: FROM.toISOString(), to: TO.toISOString() });
    expect(fetchFeed).toHaveBeenCalledWith(FEED_URL);
    expect(result.events.map((event) => event.start)).toEqual(['2026-11-16T08:00:00.000Z', '2026-11-16T10:15:00.000Z']);
    const fallback = defaultCalendarWindowFeed() as unknown as { fetchFeed: unknown };
    expect(fallback).toBeInstanceOf(IcalCalendarFeed);
    expect(fallback.fetchFeed).toBe(fetchPublicHttps);
  });

  it('caps the tool result and never returns the calendar link in an error', async () => {
    const events = Array.from({ length: 400 }, (_unused, index) => ({
      uid: `uid-${index}`,
      title: 'T'.repeat(300),
      start: new Date(Date.UTC(2026, 10, 16, 8, 0, index)).toISOString(),
      end: new Date(Date.UTC(2026, 10, 16, 9, 0, index)).toISOString(),
    }));
    const feed: CalendarWindowFeed = { async listWindow() { return events; } };
    const capped = await calendarListWindow(feed, { icalUrl: FEED_URL, from: FROM.toISOString(), to: TO.toISOString() });
    expect(JSON.stringify(capped).length).toBeLessThanOrEqual(MAX_RESULT_CHARS);
    expect(capped.events.length).toBeGreaterThan(0);
    expect(capped.events.length).toBeLessThan(events.length);

    const failing = new IcalCalendarFeed(async () => {
      throw new Error(`fetch failed ${FEED_URL}`);
    });
    const error = await calendarListWindow(failing, { icalUrl: FEED_URL, from: FROM.toISOString(), to: TO.toISOString() }).then(
      () => null,
      (caught) => caught,
    );
    expect(error).toBeInstanceOf(Error);
    expect(error.message).not.toContain('super-secret-token');
    expect(error.message).not.toContain(FEED_URL);
  });
});
