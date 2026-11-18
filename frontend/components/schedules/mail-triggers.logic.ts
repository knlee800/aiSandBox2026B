import {
  SCHEDULE_OUTCOMES,
  SCHEDULE_SKIP_REASONS,
  browserTimeZone,
  readTargetStatus,
  type ScheduleTarget,
} from './schedules.logic';

/**
 * TRIGGER-MAIL-01 S4: pure helpers for the "When mail arrives" section of the
 * Schedules page. Shapes follow the S2 routes as built
 * (docs/TRIGGER-MAIL-01-STAGE-START.md section 8). The code lists below are
 * copies of the backend lists, pinned by a test.
 */

/** mail-trigger-validation.ts MAIL_TRIGGER_ERROR_CODES. */
export const MAIL_TRIGGER_ERROR_CODES = [
  'mail_trigger_invalid_body',
  'mail_trigger_unknown_field',
  'mail_trigger_missing_field',
  'mail_trigger_empty_change',
  'mail_trigger_invalid_target',
  'mail_trigger_invalid_task',
  'mail_trigger_invalid_sender',
  'mail_trigger_invalid_subject',
  'mail_trigger_invalid_time_zone',
  'mail_trigger_invalid_enabled',
  'mail_trigger_not_found',
  'mail_trigger_workflow_not_found',
  'mail_trigger_limit_reached',
] as const;

/**
 * mail-trigger-reasons.ts MAIL_TRIGGER_SKIP_REASONS: the schedule reasons
 * except `missed`, plus `day_limit`.
 */
export const MAIL_TRIGGER_SKIP_REASONS = [
  ...SCHEDULE_SKIP_REASONS.filter((code) => code !== 'missed'),
  'day_limit',
] as const;

/** AGENT_MAIL_TRIGGER_RUN_OUTCOMES (the same three as the schedule outcomes). */
export const MAIL_TRIGGER_OUTCOMES = SCHEDULE_OUTCOMES;

/** AGENT_MAIL_TRIGGER_MAIL_STATES. */
export const MAIL_TRIGGER_MAIL_STATES = [
  'ok',
  'connector_missing',
  'read_failed',
  'sign_in_refused',
] as const;
export type MailTriggerMailState = (typeof MAIL_TRIGGER_MAIL_STATES)[number];

export const MAIL_TRIGGER_TASK_MAX_CHARS = 7500;
export const MAIL_TRIGGER_SENDER_FILTER_MAX_CHARS = 254;
export const MAIL_TRIGGER_SUBJECT_FILTER_MAX_CHARS = 100;
export const MAIL_TRIGGER_TIME_ZONE_MAX_CHARS = 64;
export const MAIL_TRIGGERS_DEFAULT_LIMIT = 3;

export interface MailTriggerLastRun {
  arrivedAt: string;
  localDate: string;
  outcome: string;
  reason: string | null;
  collaborationRunId: string | null;
  at: string;
}

export interface MailTriggerRun extends MailTriggerLastRun {
  id: string;
}

export interface MailTriggerItem {
  id: string;
  target: ScheduleTarget;
  task: string;
  senderFilter: string;
  subjectFilter: string | null;
  timeZone: string;
  enabled: boolean;
  lastRun: MailTriggerLastRun | null;
}

export interface MailTriggerMailbox {
  connected: boolean;
  state: MailTriggerMailState;
  stateAt: string | null;
}

export interface MailTriggerList {
  enabled: boolean;
  runsEnabled: boolean;
  limit: number;
  mail: MailTriggerMailbox;
  triggers: MailTriggerItem[];
}

/** The form's state. `targetId` is '' for the Chief of Staff, else a workflow id. */
export interface MailTriggerDraft {
  targetId: string;
  task: string;
  senderFilter: string;
  subjectFilter: string;
  timeZone: string;
  enabled: boolean;
}

export type MailTriggerRequestBody = {
  target: { kind: 'chief-of-staff' } | { kind: 'workflow'; workflowId: string };
  task: string;
  senderFilter: string;
  subjectFilter: string | null;
  timeZone: string;
  enabled: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readTarget(value: unknown): ScheduleTarget | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'chief-of-staff') return { kind: 'chief-of-staff' };
  if (value.kind === 'workflow' && typeof value.workflowId === 'string') {
    const status = readTargetStatus(value.status);
    return {
      kind: 'workflow',
      workflowId: value.workflowId,
      name: readText(value.name),
      missing: value.status === 'missing' || typeof value.name !== 'string',
      ...(status ? { status } : {}),
    };
  }
  return null;
}

function readLastRun(value: unknown): MailTriggerLastRun | null {
  if (!isRecord(value) || typeof value.localDate !== 'string' || typeof value.outcome !== 'string') {
    return null;
  }
  return {
    arrivedAt: typeof value.arrivedAt === 'string' ? value.arrivedAt : '',
    localDate: value.localDate,
    outcome: value.outcome,
    reason: readText(value.reason),
    collaborationRunId: readText(value.collaborationRunId),
    at: typeof value.at === 'string' ? value.at : '',
  };
}

/** One mail trigger, or null when the body is not one. */
export function parseMailTrigger(value: unknown): MailTriggerItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) return null;
  const target = readTarget(value.target);
  if (
    !target ||
    typeof value.task !== 'string' ||
    typeof value.senderFilter !== 'string' ||
    typeof value.timeZone !== 'string' ||
    typeof value.enabled !== 'boolean'
  ) {
    return null;
  }
  return {
    id: value.id,
    target,
    task: value.task,
    senderFilter: value.senderFilter,
    subjectFilter: readText(value.subjectFilter),
    timeZone: value.timeZone,
    enabled: value.enabled,
    lastRun: readLastRun(value.lastRun),
  };
}

function readMailbox(value: unknown): MailTriggerMailbox {
  if (!isRecord(value)) return { connected: false, state: 'ok', stateAt: null };
  const state = (MAIL_TRIGGER_MAIL_STATES as readonly unknown[]).includes(value.state)
    ? (value.state as MailTriggerMailState)
    : 'ok';
  return {
    connected: value.connected === true,
    state,
    stateAt: readText(value.stateAt),
  };
}

/** The GET /api/mail-triggers body, or null. Malformed triggers are left out. */
export function parseMailTriggerList(body: unknown): MailTriggerList | null {
  if (!isRecord(body) || !Array.isArray(body.triggers)) return null;
  const limit = typeof body.limit === 'number' && body.limit > 0 ? body.limit : MAIL_TRIGGERS_DEFAULT_LIMIT;
  return {
    enabled: body.enabled === true,
    runsEnabled: body.runsEnabled === true,
    limit,
    mail: readMailbox(body.mail),
    triggers: body.triggers
      .map((entry) => parseMailTrigger(entry))
      .filter((entry): entry is MailTriggerItem => entry !== null),
  };
}

/** The GET /api/mail-triggers/:id/runs body, or null. */
export function parseMailTriggerRuns(body: unknown): MailTriggerRun[] | null {
  if (!isRecord(body) || !Array.isArray(body.runs)) return null;
  const runs: MailTriggerRun[] = [];
  for (const entry of body.runs) {
    const last = readLastRun(entry);
    if (last && isRecord(entry) && typeof entry.id === 'string') {
      runs.push({ ...last, id: entry.id });
    }
  }
  return runs;
}

/** The message key (inside the schedules.mail namespace) for a backend error code. */
export function mailTriggerErrorKey(code: string | null): string {
  return code !== null && (MAIL_TRIGGER_ERROR_CODES as readonly string[]).includes(code)
    ? `errors.${code}`
    : 'errors.generic';
}

export function mailReasonKey(reason: string): string {
  return (MAIL_TRIGGER_SKIP_REASONS as readonly string[]).includes(reason)
    ? `reasons.${reason}`
    : 'reasons.unknown';
}

export function mailOutcomeKey(outcome: string): string {
  return (MAIL_TRIGGER_OUTCOMES as readonly string[]).includes(outcome)
    ? `outcomes.${outcome}`
    : 'outcomes.unknown';
}

/**
 * What the page shows for the mailbox. No mail link on file reads as
 * "not connected" whatever state was last recorded.
 */
export function mailboxDisplayState(mail: MailTriggerMailbox): MailTriggerMailState {
  return mail.connected ? mail.state : 'connector_missing';
}

export function mailboxStateKey(state: MailTriggerMailState): string {
  return `mailbox.${state}`;
}

/** True when the owner has to look at the Connections page. */
export function mailboxNeedsAttention(mail: MailTriggerMailbox): boolean {
  return mailboxDisplayState(mail) !== 'ok';
}

export function emptyMailDraft(timeZone: string = browserTimeZone()): MailTriggerDraft {
  return {
    targetId: '',
    task: '',
    senderFilter: '',
    subjectFilter: '',
    timeZone,
    enabled: true,
  };
}

export function draftFromMailTrigger(trigger: MailTriggerItem): MailTriggerDraft {
  return {
    targetId: trigger.target.kind === 'workflow' ? trigger.target.workflowId : '',
    task: trigger.task,
    senderFilter: trigger.senderFilter,
    subjectFilter: trigger.subjectFilter ?? '',
    timeZone: trigger.timeZone,
    enabled: trigger.enabled,
  };
}

/**
 * The mail tool is the Chief of Staff's. The workflow list the page loads
 * (id and name only) does not say which tools a workflow has, so every
 * workflow target gets the general warning.
 */
export function showWorkflowMailWarning(draft: Pick<MailTriggerDraft, 'targetId'>): boolean {
  return draft.targetId !== '';
}

/**
 * A light copy of the gateway's sender rule (one address or @ and a domain,
 * no display name, no wildcard, no spaces), so an obvious mistake never
 * leaves the page. The gateway stays the judge.
 */
export function looksLikeSenderFilter(value: string): boolean {
  if (value.length === 0 || value.length > MAIL_TRIGGER_SENDER_FILTER_MAX_CHARS) return false;
  if (/[\s<>*?"',;()[\]\\]/.test(value)) return false;
  // eslint-disable-next-line no-control-regex
  if (/[^\x21-\x7e]/.test(value)) return false;
  const at = value.indexOf('@');
  if (at < 0 || at !== value.lastIndexOf('@')) return false;
  const domain = value.slice(at + 1);
  return domain.length > 0 && domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}

export type MailDraftResult =
  | { ok: true; body: MailTriggerRequestBody }
  | { ok: false; errorKey: string };

/** The same rules the gateway applies, so an obvious mistake never leaves the page. */
export function draftToBody(draft: MailTriggerDraft): MailDraftResult {
  const task = draft.task.trim();
  if (task.length === 0 || task.length > MAIL_TRIGGER_TASK_MAX_CHARS) {
    return { ok: false, errorKey: mailTriggerErrorKey('mail_trigger_invalid_task') };
  }
  const sender = draft.senderFilter.trim().toLowerCase();
  if (!looksLikeSenderFilter(sender)) {
    return { ok: false, errorKey: mailTriggerErrorKey('mail_trigger_invalid_sender') };
  }
  const subject = draft.subjectFilter.trim();
  if (subject.length > MAIL_TRIGGER_SUBJECT_FILTER_MAX_CHARS) {
    return { ok: false, errorKey: mailTriggerErrorKey('mail_trigger_invalid_subject') };
  }
  const zone = draft.timeZone.trim();
  if (zone.length === 0 || zone.length > MAIL_TRIGGER_TIME_ZONE_MAX_CHARS) {
    return { ok: false, errorKey: mailTriggerErrorKey('mail_trigger_invalid_time_zone') };
  }
  return {
    ok: true,
    body: {
      target:
        draft.targetId === ''
          ? { kind: 'chief-of-staff' }
          : { kind: 'workflow', workflowId: draft.targetId },
      task,
      senderFilter: sender,
      subjectFilter: subject.length === 0 ? null : subject,
      timeZone: zone,
      enabled: draft.enabled,
    },
  };
}

export function mailLimitReached(list: MailTriggerList): boolean {
  return list.triggers.length >= list.limit;
}
