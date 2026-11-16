import { SCHEDULE_SKIP_REASONS, type ScheduleSkipReason } from './schedule-refusal';

/**
 * TRIGGER-CHAIN-01 S2 (stage-start section 3): the reason codes a skipped
 * chain start records, on its agent_chain_trigger_runs row and in its one
 * chain_run_skipped audit row. Codes only; never text from the task, a
 * workflow name, a run's answer or a provider.
 *
 * Thirteen of the fourteen schedule codes are reused unchanged
 * (schedule-refusal.ts; the refusal mapper scheduleRefusalOf is imported by
 * the run service, not copied), then day_limit (the trigger already started
 * CHAIN_TRIGGER_DAY_LIMIT runs on the finished run's local day) and one new
 * code, chain_depth (the start would be past CHAIN_TRIGGER_MAX_DEPTH in
 * chain-trigger-match.ts). Not used: missed (there is no catch-up; a run
 * completed more than 60 minutes before the read is ignored with no record).
 */
export const CHAIN_TRIGGER_SCHEDULE_REASONS = SCHEDULE_SKIP_REASONS.filter(
  (code): code is Exclude<ScheduleSkipReason, 'missed'> => code !== 'missed',
);

export const CHAIN_TRIGGER_SKIP_REASONS = [...CHAIN_TRIGGER_SCHEDULE_REASONS, 'day_limit', 'chain_depth'] as const;

export type ChainTriggerSkipReason = Exclude<ScheduleSkipReason, 'missed'> | 'day_limit' | 'chain_depth';

/** Keith's Q3: at most this many starts per trigger per local day. */
export const CHAIN_TRIGGER_DAY_LIMIT = 5;

/**
 * Keith's Q3 (stage-start section 4, Limits): at most this many history rows
 * per trigger per local day. Past it nothing is written (one count-only log
 * line a tick).
 */
export const CHAIN_TRIGGER_DAY_ROW_CAP = 20;

/** TRIGGER-CHAIN-01 S2: the timer's audit rows (stage-start section 4, Audit). */
export const CHAIN_TRIGGER_RUN_AUDIT_EVENTS = {
  runStarted: 'chain_run_started',
  runSkipped: 'chain_run_skipped',
  triggerDisabled: 'chain_trigger_disabled',
} as const;

/** The cancel reason of a run that was created and then refused. */
export function chainTriggerCancelReason(reason: ChainTriggerSkipReason): string {
  return `chain_trigger_skipped:${reason}`;
}
