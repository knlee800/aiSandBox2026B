import { HttpException } from '@nestjs/common';
import { WORKFLOW_REFUSAL_CODES } from '../orchestration/collaboration-workflow';

/**
 * TRIGGER-01 S2 (stage-start sections 4 D5 and 5): the reason codes a
 * skipped occurrence records, in agent_schedule_runs.reason and in its
 * run_skipped audit row. Codes only; never text from the task or a provider.
 */
export const SCHEDULE_SKIP_REASONS = [
  'runs_off',
  'inactive',
  'not_entitled',
  'workflow_gone',
  'workflow_off',
  'workflow_not_tested',
  'workflow_invalid',
  'workflow_budget',
  'over_cap',
  'provider_off',
  'no_credits',
  'missed',
  'interrupted',
  'refused',
] as const;

export type ScheduleSkipReason = (typeof SCHEDULE_SKIP_REASONS)[number];

/** The reasons scheduleRefusalOf can answer (a refusal at start, approve or the cap pre-check). */
export type ScheduleRefusal = Extract<
  ScheduleSkipReason,
  | 'runs_off'
  | 'workflow_gone'
  | 'workflow_off'
  | 'workflow_not_tested'
  | 'workflow_invalid'
  | 'workflow_budget'
  | 'over_cap'
  | 'provider_off'
  | 'no_credits'
  | 'refused'
>;

/**
 * WORKFLOW_NOT_FOUND is the chat mapper's workflow_not_found; for a schedule
 * it is workflow_gone (the workflow row is gone or not the owner's).
 */
const WORKFLOW_REFUSALS: Readonly<Record<string, ScheduleRefusal>> = {
  [WORKFLOW_REFUSAL_CODES.notFound]: 'workflow_gone',
  [WORKFLOW_REFUSAL_CODES.disabled]: 'workflow_off',
  [WORKFLOW_REFUSAL_CODES.invalid]: 'workflow_invalid',
  [WORKFLOW_REFUSAL_CODES.notTested]: 'workflow_not_tested',
  [WORKFLOW_REFUSAL_CODES.budgetDay]: 'workflow_budget',
  [WORKFLOW_REFUSAL_CODES.budgetRun]: 'workflow_budget',
};

/**
 * Maps a start, approve or cap refusal to a reason code, by the rules of
 * chatRunRefusalOf (chat/chat-run.service.ts), copied rather than shared so
 * that chat/ is not edited (decision D5; one shared mapper is follow-up F6).
 * It reads only the status, a code and the platform's own message. Two chat
 * codes have no schedule meaning: workflow_not_found is workflow_gone, and
 * bad_task (the stored task is validated at save) is refused.
 * schedule-refusal.spec.ts pins it against chatRunRefusalOf on the same errors.
 */
export function scheduleRefusalOf(error: unknown): ScheduleRefusal {
  if (!(error instanceof HttpException)) {
    return 'refused';
  }
  const status = error.getStatus();
  const response = error.getResponse();
  const body = typeof response === 'object' && response !== null ? (response as Record<string, unknown>) : {};
  const message = typeof response === 'string' ? response : typeof body.message === 'string' ? body.message : '';
  const code = typeof body.code === 'string' ? body.code : '';
  if (code && WORKFLOW_REFUSALS[code]) {
    return WORKFLOW_REFUSALS[code];
  }
  if (status === 402) {
    return 'no_credits';
  }
  if (status === 429) {
    return 'over_cap';
  }
  if (status === 503) {
    if (message.includes('disabled for maintenance')) return 'runs_off';
    if (/^Provider \S+ temporarily unavailable$/.test(message)) return 'provider_off';
    if (message === 'Insufficient credit balance') return 'no_credits';
    if (message === 'Token quota exceeded') return 'over_cap';
    return 'refused';
  }
  return 'refused';
}
