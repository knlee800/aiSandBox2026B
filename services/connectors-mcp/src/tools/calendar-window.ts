import {
  IcalCalendarFeed,
  checkCalendarWindow,
  type CalendarWindowEvent,
  type CalendarWindowFeed,
  type CalendarWindowInput,
} from '../clients/ical-feed';
import { capJsonItems, errorText, redact, requiredString } from '../limits';

/**
 * TRIGGER-EVENT-01 S1: the gateway-only window read for event triggers. The gateway
 * never offers this tool to a model or a workflow; it calls it itself, as the owner.
 */
export interface CalendarWindowResult {
  events: CalendarWindowEvent[];
}

/** An ISO 8601 instant with a date, a time and a zone (Z or an offset). */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function instant(value: unknown, label: string): Date {
  if (typeof value !== 'string' || !ISO_INSTANT.test(value)) {
    throw new Error(`${label} must be an ISO time`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be an ISO time`);
  }
  return date;
}

export function readCalendarWindowArguments(raw: unknown): CalendarWindowInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('calendar arguments are required');
  }
  const args = raw as Record<string, unknown>;
  const icalUrl = requiredString(args.icalUrl, 'icalUrl');
  const from = instant(args.from, 'from');
  const to = instant(args.to, 'to');
  checkCalendarWindow(from, to);
  return { icalUrl, from, to };
}

export async function calendarListWindow(feed: CalendarWindowFeed, raw: unknown): Promise<CalendarWindowResult> {
  const args = readCalendarWindowArguments(raw);
  try {
    const events = await feed.listWindow(args);
    return {
      events: capJsonItems(events, (kept) => ({ events: kept })),
    };
  } catch (error) {
    throw new Error(redact(errorText(error), [args.icalUrl]));
  }
}

export function defaultCalendarWindowFeed(): CalendarWindowFeed {
  return new IcalCalendarFeed();
}
