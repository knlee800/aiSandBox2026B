import { IcalCalendarFeed, eventsFromIcs } from '../clients/ical-feed';
import { calendarListToday } from '../tools/calendar-today';
import { MAX_RESULT_CHARS, MAX_TEXT_CHARS } from '../limits';
import type { CalendarFeed } from '../clients/ical-feed';

function calendar(body: string): string {
  return `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//aisb//test//EN\n${body}\nEND:VCALENDAR\n`;
}

const DAILY = `BEGIN:VEVENT
UID:daily-1
DTSTAMP:20261101T000000Z
DTSTART:20261101T090000Z
DTEND:20261101T093000Z
RRULE:FREQ=DAILY
SUMMARY:Standup
ORGANIZER;CN=Ada:mailto:ada@example.com
ATTENDEE;CN=Owner;PARTSTAT=ACCEPTED:mailto:owner@example.com
ATTENDEE;PARTSTAT=NEEDS-ACTION:mailto:other@example.com
END:VEVENT`;

describe('today calendar events', () => {
  const now = new Date('2026-11-09T12:00:00.000Z');

  it('expands a daily event once for today and reports the owner response', () => {
    const events = eventsFromIcs(calendar(DAILY), 'UTC', now, 'owner@example.com');
    expect(events).toEqual([
      {
        title: 'Standup',
        start: '2026-11-09T09:00:00.000Z',
        end: '2026-11-09T09:30:00.000Z',
        organizer: { name: 'Ada', address: 'ada@example.com' },
        attendeeCount: 2,
        ownerResponse: 'ACCEPTED',
      },
    ]);
  });

  it('skips an occurrence excluded by EXDATE', () => {
    const ics = calendar(DAILY.replace('RRULE:FREQ=DAILY', 'RRULE:FREQ=DAILY\nEXDATE:20261109T090000Z'));
    expect(eventsFromIcs(ics, 'UTC', now, 'owner@example.com')).toEqual([]);
  });

  it('uses the requested time zone for today', () => {
    const ics = calendar(`BEGIN:VEVENT
UID:early
DTSTAMP:20261101T000000Z
DTSTART:20261109T020000Z
DTEND:20261109T030000Z
SUMMARY:Early
END:VEVENT`);
    expect(eventsFromIcs(ics, 'Asia/Taipei', now).map((event) => event.title)).toEqual(['Early']);
    expect(eventsFromIcs(ics, 'America/New_York', now)).toEqual([]);
  });

  it('includes an all-day event on that calendar date', () => {
    const ics = calendar(`BEGIN:VEVENT
UID:holiday
DTSTAMP:20261101T000000Z
DTSTART;VALUE=DATE:20261109
DTEND;VALUE=DATE:20261110
SUMMARY:Holiday
END:VEVENT`);
    expect(eventsFromIcs(ics, 'UTC', now).map((event) => event.title)).toEqual(['Holiday']);
    expect(eventsFromIcs(ics, 'Asia/Taipei', now).map((event) => event.title)).toEqual(['Holiday']);
    expect(eventsFromIcs(ics, 'America/New_York', new Date('2026-11-09T02:00:00.000Z'))).toEqual([]);
  });

  it('cuts titles at 300 characters and removes control characters', () => {
    const title = `\u0001${'T'.repeat(400)}`;
    const ics = calendar(`BEGIN:VEVENT
UID:long
DTSTAMP:20261101T000000Z
DTSTART:20261109T100000Z
DTEND:20261109T110000Z
SUMMARY:${title}
END:VEVENT`);
    const [event] = eventsFromIcs(ics, 'UTC', now);
    expect(event.title).toBe('T'.repeat(MAX_TEXT_CHARS));
    expect(event.title).not.toContain('\u0001');
    expect(event.organizer).toBeNull();
    expect(event.ownerResponse).toBeNull();
    expect(event.attendeeCount).toBe(0);
  });

  it('caps the tool result and never returns the calendar link in an error', async () => {
    const events = Array.from({ length: 120 }, (_unused, index) => ({
      title: 'T'.repeat(300),
      start: new Date(Date.UTC(2026, 10, 9, 0, index)).toISOString(),
      end: new Date(Date.UTC(2026, 10, 9, 0, index, 30)).toISOString(),
      organizer: null,
      attendeeCount: 0,
      ownerResponse: null,
    }));
    const feed: CalendarFeed = { async listToday() { return events; } };
    const capped = await calendarListToday(feed, {
      icalUrl: 'https://calendar.example/feed.ics',
      timeZone: 'UTC',
      now: now.toISOString(),
    });
    expect(JSON.stringify(capped).length).toBeLessThanOrEqual(MAX_RESULT_CHARS);
    expect(capped.events.length).toBeGreaterThan(0);
    expect(capped.events.length).toBeLessThan(events.length);

    const secret = 'https://calendar.example/feed.ics?token=super-secret-token';
    const failing = new IcalCalendarFeed(async () => {
      throw new Error(`fetch failed ${secret}`);
    });
    const error = await failing.listToday({ icalUrl: secret, timeZone: 'UTC', now }).then(() => null, (caught) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).not.toContain('super-secret-token');
    expect(error.message).not.toContain(secret);
  });

  it('rejects an invalid time zone before fetching', async () => {
    const fetchFeed = jest.fn();
    const feed = new IcalCalendarFeed(fetchFeed);
    await expect(feed.listToday({ icalUrl: 'https://calendar.example/feed.ics', timeZone: 'Not/AZone' })).rejects.toThrow(/time zone/);
    expect(fetchFeed).not.toHaveBeenCalled();
  });
});
