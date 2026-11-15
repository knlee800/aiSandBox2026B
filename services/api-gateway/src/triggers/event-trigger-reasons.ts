import { NotFoundException } from '@nestjs/common';
import { SCHEDULE_SKIP_REASONS } from './schedule-refusal';

/**
 * TRIGGER-EVENT-01 S3 (stage-start section 6): the reason codes a skipped
 * event occurrence records, in agent_event_trigger_runs.reason and in its
 * event_run_skipped audit row. Codes only; never text from the task, the
 * filter, the calendar or a provider.
 *
 * The fourteen schedule codes are reused unchanged (schedule-refusal.ts; the
 * refusal mapper scheduleRefusalOf is imported by the run service, not
 * copied). Four are new, none of which ever has a run row behind it:
 *  - day_limit: the trigger already started EVENT_TRIGGER_DAY_LIMIT runs on
 *    the occurrence's local day;
 *  - event_changed: at the confirm read the occurrence is gone, cancelled, has
 *    a different start, or no longer matches the title filter;
 *  - calendar_read_failed: the confirm read failed;
 *  - connector_missing: the calendar was disconnected before the confirm read.
 */
export const EVENT_TRIGGER_NEW_SKIP_REASONS = [
  'day_limit',
  'event_changed',
  'calendar_read_failed',
  'connector_missing',
] as const;

export const EVENT_TRIGGER_SKIP_REASONS = [...SCHEDULE_SKIP_REASONS, ...EVENT_TRIGGER_NEW_SKIP_REASONS] as const;

export type EventTriggerSkipReason = (typeof EVENT_TRIGGER_SKIP_REASONS)[number];

/** Keith's Q5: at most this many starts per trigger per local day. */
export const EVENT_TRIGGER_DAY_LIMIT = 3;

/** TRIGGER-EVENT-01 S3: the timer's audit rows (stage-start section 6). */
export const EVENT_TRIGGER_RUN_AUDIT_EVENTS = {
  runStarted: 'event_run_started',
  runSkipped: 'event_run_skipped',
  triggerDisabled: 'event_trigger_disabled',
  calendarStateChanged: 'calendar_state_changed',
} as const;

/** The cancel reason of a run that was created and then refused. */
export function eventTriggerCancelReason(reason: EventTriggerSkipReason): string {
  return `event_trigger_skipped:${reason}`;
}

/**
 * The reason of a failed confirm read: the broker answers 404 when the
 * owner's calendar connection row is gone (connector_missing); anything else
 * (timeout, busy, the feed host, a bad result, a missing key) is
 * calendar_read_failed. Reads the error's class only, never its message.
 */
export function confirmReadReasonOf(error: unknown): Extract<EventTriggerSkipReason, 'connector_missing' | 'calendar_read_failed'> {
  return error instanceof NotFoundException ? 'connector_missing' : 'calendar_read_failed';
}
