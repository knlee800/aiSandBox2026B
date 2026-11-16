import { SCHEDULE_SKIP_REASONS, type ScheduleSkipReason } from './schedule-refusal';

/**
 * TRIGGER-MORE-01 S2 (stage-start section 5): the reason codes a skipped
 * batch records, on every agent_knowledge_trigger_runs row of the batch and
 * in its one knowledge_run_skipped audit row. Codes only; never text from the
 * task, a document title, a document's content or a provider.
 *
 * Thirteen of the fourteen schedule codes are reused unchanged
 * (schedule-refusal.ts; the refusal mapper scheduleRefusalOf is imported by
 * the run service, not copied), and day_limit (here: the trigger already
 * started KNOWLEDGE_TRIGGER_DAY_LIMIT runs on the batch's local day). No new
 * reason code. Not used: missed (there is no catch-up; a document version
 * older than 60 minutes is ignored with no record).
 */
export const KNOWLEDGE_TRIGGER_SCHEDULE_REASONS = SCHEDULE_SKIP_REASONS.filter(
  (code): code is Exclude<ScheduleSkipReason, 'missed'> => code !== 'missed',
);

export const KNOWLEDGE_TRIGGER_SKIP_REASONS = [...KNOWLEDGE_TRIGGER_SCHEDULE_REASONS, 'day_limit'] as const;

export type KnowledgeTriggerSkipReason = Exclude<ScheduleSkipReason, 'missed'> | 'day_limit';

/** Keith's Q11: at most this many starts per trigger per local day (distinct runs). */
export const KNOWLEDGE_TRIGGER_DAY_LIMIT = 5;

/**
 * Keith's Q11 (stage-start section 4, Limits): at most this many history rows
 * per trigger per local day (an account holds 50 documents). Past it nothing
 * is written (one count-only log line a tick).
 */
export const KNOWLEDGE_TRIGGER_DAY_ROW_CAP = 50;

/** TRIGGER-MORE-01 S2: the timer's audit rows (stage-start section 5). */
export const KNOWLEDGE_TRIGGER_RUN_AUDIT_EVENTS = {
  runStarted: 'knowledge_run_started',
  runSkipped: 'knowledge_run_skipped',
  triggerDisabled: 'knowledge_trigger_disabled',
} as const;

/** The cancel reason of a run that was created and then refused. */
export function knowledgeTriggerCancelReason(reason: KnowledgeTriggerSkipReason): string {
  return `knowledge_trigger_skipped:${reason}`;
}
