import { IcalCalendarFeed, type CalendarEvent, type CalendarFeed, type CalendarTodayInput } from '../clients/ical-feed';
import { capJsonItems, errorText, optionalNow, optionalString, redact, requiredString } from '../limits';

export interface CalendarTodayResult {
  events: CalendarEvent[];
}

export function readCalendarArguments(raw: unknown): CalendarTodayInput {
  if (!raw || typeof raw !== 'object') {
    throw new Error('calendar arguments are required');
  }
  const args = raw as Record<string, unknown>;
  const icalUrl = requiredString(args.icalUrl, 'icalUrl');
  const timeZone = requiredString(args.timeZone, 'timeZone');
  const ownerEmail = optionalString(args.ownerEmail);
  const now = args.now === undefined ? undefined : optionalNow(args.now).toISOString();
  return { icalUrl, timeZone, ownerEmail, now };
}

export async function calendarListToday(feed: CalendarFeed, raw: unknown): Promise<CalendarTodayResult> {
  const args = readCalendarArguments(raw);
  try {
    const events = await feed.listToday(args);
    return {
      events: capJsonItems(events, (kept) => ({ events: kept })),
    };
  } catch (error) {
    throw new Error(redact(errorText(error), [args.icalUrl]));
  }
}

export function defaultCalendarFeed(): CalendarFeed {
  return new IcalCalendarFeed();
}
