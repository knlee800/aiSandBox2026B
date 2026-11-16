import { NotFoundException } from '@nestjs/common';
import { SCHEDULE_SKIP_REASONS, type ScheduleSkipReason } from './schedule-refusal';

/**
 * TRIGGER-MAIL-01 S3 (stage-start section 6): the reason codes a skipped
 * message records, in agent_mail_trigger_runs.reason and in its
 * mail_run_skipped audit row. Codes only; never text from the task, the
 * filters, the mailbox or a provider.
 *
 * Thirteen of the fourteen schedule codes are reused unchanged
 * (schedule-refusal.ts; the refusal mapper scheduleRefusalOf is imported by
 * the run service, not copied), and day_limit from event triggers (here: the
 * trigger already started MAIL_TRIGGER_DAY_LIMIT runs on the arrival's local
 * day). No new reason code. Not used:
 *  - missed: there is no memory copy; a message is acted on in the tick that
 *    reads it, and mail older than 60 minutes is ignored with no record;
 *  - event_changed and calendar_read_failed: there is no confirm read.
 * The mailbox not connected or unreadable is the trigger's mail_state
 * (connector_missing, read_failed), not a history row.
 */
export const MAIL_TRIGGER_SCHEDULE_REASONS = SCHEDULE_SKIP_REASONS.filter(
  (code): code is Exclude<ScheduleSkipReason, 'missed'> => code !== 'missed',
);

export const MAIL_TRIGGER_SKIP_REASONS = [...MAIL_TRIGGER_SCHEDULE_REASONS, 'day_limit'] as const;

export type MailTriggerSkipReason = Exclude<ScheduleSkipReason, 'missed'> | 'day_limit';

/** Keith's Q7: at most this many starts per trigger per local day (the arrival's date in the trigger's zone). */
export const MAIL_TRIGGER_DAY_LIMIT = 5;

/**
 * Keith's Q7 (stage-start section 2): at most this many history rows per
 * trigger per local day. Past it a match writes nothing (one count-only log
 * line a tick), so a flood of matching mail cannot fill the tables.
 */
export const MAIL_TRIGGER_DAY_ROW_CAP = 20;

/** TRIGGER-MAIL-01 S3: the timer's audit rows (stage-start section 6). */
export const MAIL_TRIGGER_RUN_AUDIT_EVENTS = {
  runStarted: 'mail_run_started',
  runSkipped: 'mail_run_skipped',
  triggerDisabled: 'mail_trigger_disabled',
  mailStateChanged: 'mail_state_changed',
} as const;

/** The cancel reason of a run that was created and then refused. */
export function mailTriggerCancelReason(reason: MailTriggerSkipReason): string {
  return `mail_trigger_skipped:${reason}`;
}

/**
 * The mailbox state after a failed read: the broker answers 404 when the
 * owner's mail connection row is gone (connector_missing); anything else
 * (a refused sign-in, the host, a timeout, busy, an old child without the
 * tool, a bad result, a missing key) is a failed read. Reads the error's
 * class only, never its message.
 */
export function mailReadFailureOf(error: unknown): 'connector_missing' | 'read_failed' {
  return error instanceof NotFoundException ? 'connector_missing' : 'read_failed';
}
