import {
  SCHEDULE_OUTCOMES,
  SCHEDULE_SKIP_REASONS,
  browserTimeZone,
  type ScheduleTarget,
} from './schedules.logic';

/**
 * TRIGGER-EVENT-01 S4: pure helpers for the "Before a meeting" section of the
 * Schedules page. Shapes follow the S2 routes as built
 * (docs/TRIGGER-EVENT-01-STAGE-START.md section 8). The code lists below are
 * copies of the backend lists, pinned by a test.
 */

/** event-trigger-validation.ts EVENT_TRIGGER_ERROR_CODES. */
export const EVENT_TRIGGER_ERROR_CODES = [
  'event_trigger_invalid_body',
  'event_trigger_unknown_field',
  'event_trigger_missing_field',
  'event_trigger_empty_change',
  'event_trigger_invalid_target',
  'event_trigger_invalid_task',
  'event_trigger_invalid_lead',
  'event_trigger_invalid_filter',
  'event_trigger_invalid_time_zone',
  'event_trigger_invalid_enabled',
  'event_trigger_not_found',
  'event_trigger_workflow_not_found',
  'event_trigger_limit_reached',
] as const;

/** event-trigger-reasons.ts EVENT_TRIGGER_NEW_SKIP_REASONS. */
export const EVENT_TRIGGER_NEW_SKIP_REASONS = [
  'day_limit',
  'event_changed',
  'calendar_read_failed',
  'connector_missing',
] as const;

/** The fourteen schedule reasons plus the four new ones (EVENT_TRIGGER_SKIP_REASONS). */
export const EVENT_TRIGGER_SKIP_REASONS = [
  ...SCHEDULE_SKIP_REASONS,
  ...EVENT_TRIGGER_NEW_SKIP_REASONS,
] as const;

/** AGENT_EVENT_TRIGGER_RUN_OUTCOMES (the same three as the schedule outcomes). */
export const EVENT_TRIGGER_OUTCOMES = SCHEDULE_OUTCOMES;

/** AGENT_EVENT_TRIGGER_CALENDAR_STATES. */
export const EVENT_TRIGGER_CALENDAR_STATES = ['ok', 'connector_missing', 'read_failed'] as const;
export type EventTriggerCalendarState = (typeof EVENT_TRIGGER_CALENDAR_STATES)[number];

export const EVENT_TRIGGER_TASK_MAX_CHARS = 7500;
export const EVENT_TRIGGER_TITLE_FILTER_MAX_CHARS = 100;
export const EVENT_TRIGGER_LEAD_MIN_MINUTES = 5;
export const EVENT_TRIGGER_LEAD_MAX_MINUTES = 120;
export const EVENT_TRIGGER_LEAD_DEFAULT_MINUTES = 15;
export const EVENT_TRIGGER_TIME_ZONE_MAX_CHARS = 64;
export const EVENT_TRIGGERS_DEFAULT_LIMIT = 3;

export interface EventTriggerLastRun {
  eventStart: string;
  localDate: string;
  outcome: string;
  reason: string | null;
  collaborationRunId: string | null;
  at: string;
}

export interface EventTriggerRun extends EventTriggerLastRun {
  id: string;
}

export interface EventTriggerItem {
  id: string;
  target: ScheduleTarget;
  task: string;
  leadMinutes: number;
  titleFilter: string | null;
  timeZone: string;
  enabled: boolean;
  lastRun: EventTriggerLastRun | null;
}

export interface EventTriggerCalendar {
  connected: boolean;
  state: EventTriggerCalendarState;
  stateAt: string | null;
}

export interface EventTriggerList {
  enabled: boolean;
  runsEnabled: boolean;
  limit: number;
  calendar: EventTriggerCalendar;
  triggers: EventTriggerItem[];
}

/** The form's state. `targetId` is '' for the Chief of Staff, else a workflow id. */
export interface EventTriggerDraft {
  targetId: string;
  task: string;
  /** Kept as text while typing; checked by draftToBody. */
  leadMinutes: string;
  titleFilter: string;
  timeZone: string;
  enabled: boolean;
}

export type EventTriggerRequestBody = {
  target: { kind: 'chief-of-staff' } | { kind: 'workflow'; workflowId: string };
  task: string;
  leadMinutes: number;
  titleFilter: string | null;
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
    return {
      kind: 'workflow',
      workflowId: value.workflowId,
      name: readText(value.name),
      missing: value.status === 'missing' || typeof value.name !== 'string',
    };
  }
  return null;
}

function readLastRun(value: unknown): EventTriggerLastRun | null {
  if (!isRecord(value) || typeof value.localDate !== 'string' || typeof value.outcome !== 'string') {
    return null;
  }
  return {
    eventStart: typeof value.eventStart === 'string' ? value.eventStart : '',
    localDate: value.localDate,
    outcome: value.outcome,
    reason: readText(value.reason),
    collaborationRunId: readText(value.collaborationRunId),
    at: typeof value.at === 'string' ? value.at : '',
  };
}

/** One event trigger, or null when the body is not one. */
export function parseEventTrigger(value: unknown): EventTriggerItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) return null;
  const target = readTarget(value.target);
  if (
    !target ||
    typeof value.task !== 'string' ||
    typeof value.leadMinutes !== 'number' ||
    typeof value.timeZone !== 'string' ||
    typeof value.enabled !== 'boolean'
  ) {
    return null;
  }
  return {
    id: value.id,
    target,
    task: value.task,
    leadMinutes: value.leadMinutes,
    titleFilter: readText(value.titleFilter),
    timeZone: value.timeZone,
    enabled: value.enabled,
    lastRun: readLastRun(value.lastRun),
  };
}

function readCalendar(value: unknown): EventTriggerCalendar {
  if (!isRecord(value)) return { connected: false, state: 'ok', stateAt: null };
  const state = (EVENT_TRIGGER_CALENDAR_STATES as readonly unknown[]).includes(value.state)
    ? (value.state as EventTriggerCalendarState)
    : 'ok';
  return {
    connected: value.connected === true,
    state,
    stateAt: readText(value.stateAt),
  };
}

/** The GET /api/event-triggers body, or null. Malformed triggers are left out. */
export function parseEventTriggerList(body: unknown): EventTriggerList | null {
  if (!isRecord(body) || !Array.isArray(body.triggers)) return null;
  const limit = typeof body.limit === 'number' && body.limit > 0 ? body.limit : EVENT_TRIGGERS_DEFAULT_LIMIT;
  return {
    enabled: body.enabled === true,
    runsEnabled: body.runsEnabled === true,
    limit,
    calendar: readCalendar(body.calendar),
    triggers: body.triggers
      .map((entry) => parseEventTrigger(entry))
      .filter((entry): entry is EventTriggerItem => entry !== null),
  };
}

/** The GET /api/event-triggers/:id/runs body, or null. */
export function parseEventTriggerRuns(body: unknown): EventTriggerRun[] | null {
  if (!isRecord(body) || !Array.isArray(body.runs)) return null;
  const runs: EventTriggerRun[] = [];
  for (const entry of body.runs) {
    const last = readLastRun(entry);
    if (last && isRecord(entry) && typeof entry.id === 'string') {
      runs.push({ ...last, id: entry.id });
    }
  }
  return runs;
}

/** The message key (inside the schedules.events namespace) for a backend error code. */
export function eventTriggerErrorKey(code: string | null): string {
  return code !== null && (EVENT_TRIGGER_ERROR_CODES as readonly string[]).includes(code)
    ? `errors.${code}`
    : 'errors.generic';
}

export function eventReasonKey(reason: string): string {
  return (EVENT_TRIGGER_SKIP_REASONS as readonly string[]).includes(reason)
    ? `reasons.${reason}`
    : 'reasons.unknown';
}

export function eventOutcomeKey(outcome: string): string {
  return (EVENT_TRIGGER_OUTCOMES as readonly string[]).includes(outcome)
    ? `outcomes.${outcome}`
    : 'outcomes.unknown';
}

/**
 * What the page shows for the calendar. No calendar link on file reads as
 * "not connected" whatever state was last recorded.
 */
export function calendarDisplayState(calendar: EventTriggerCalendar): EventTriggerCalendarState {
  return calendar.connected ? calendar.state : 'connector_missing';
}

export function calendarStateKey(state: EventTriggerCalendarState): string {
  return `calendar.${state}`;
}

/** True when the owner has to look at the Connections page. */
export function calendarNeedsAttention(calendar: EventTriggerCalendar): boolean {
  return calendarDisplayState(calendar) !== 'ok';
}

export function emptyEventDraft(timeZone: string = browserTimeZone()): EventTriggerDraft {
  return {
    targetId: '',
    task: '',
    leadMinutes: String(EVENT_TRIGGER_LEAD_DEFAULT_MINUTES),
    titleFilter: '',
    timeZone,
    enabled: true,
  };
}

export function draftFromEventTrigger(trigger: EventTriggerItem): EventTriggerDraft {
  return {
    targetId: trigger.target.kind === 'workflow' ? trigger.target.workflowId : '',
    task: trigger.task,
    leadMinutes: String(trigger.leadMinutes),
    titleFilter: trigger.titleFilter ?? '',
    timeZone: trigger.timeZone,
    enabled: trigger.enabled,
  };
}

/**
 * The calendar tool is the Chief of Staff's. The workflow list the page loads
 * (id and name only) does not say which tools a workflow has, so every
 * workflow target gets the general warning.
 */
export function showWorkflowCalendarWarning(draft: Pick<EventTriggerDraft, 'targetId'>): boolean {
  return draft.targetId !== '';
}

export type EventDraftResult =
  | { ok: true; body: EventTriggerRequestBody }
  | { ok: false; errorKey: string };

/** The same rules the gateway applies, so an obvious mistake never leaves the page. */
export function draftToBody(draft: EventTriggerDraft): EventDraftResult {
  const task = draft.task.trim();
  if (task.length === 0 || task.length > EVENT_TRIGGER_TASK_MAX_CHARS) {
    return { ok: false, errorKey: eventTriggerErrorKey('event_trigger_invalid_task') };
  }
  const leadText = draft.leadMinutes.trim();
  const lead = /^\d+$/.test(leadText) ? Number(leadText) : Number.NaN;
  if (!Number.isInteger(lead) || lead < EVENT_TRIGGER_LEAD_MIN_MINUTES || lead > EVENT_TRIGGER_LEAD_MAX_MINUTES) {
    return { ok: false, errorKey: eventTriggerErrorKey('event_trigger_invalid_lead') };
  }
  const filter = draft.titleFilter.trim();
  if (filter.length > EVENT_TRIGGER_TITLE_FILTER_MAX_CHARS) {
    return { ok: false, errorKey: eventTriggerErrorKey('event_trigger_invalid_filter') };
  }
  const zone = draft.timeZone.trim();
  if (zone.length === 0 || zone.length > EVENT_TRIGGER_TIME_ZONE_MAX_CHARS) {
    return { ok: false, errorKey: eventTriggerErrorKey('event_trigger_invalid_time_zone') };
  }
  return {
    ok: true,
    body: {
      target:
        draft.targetId === ''
          ? { kind: 'chief-of-staff' }
          : { kind: 'workflow', workflowId: draft.targetId },
      task,
      leadMinutes: lead,
      titleFilter: filter.length === 0 ? null : filter,
      timeZone: zone,
      enabled: draft.enabled,
    },
  };
}

export function eventLimitReached(list: EventTriggerList): boolean {
  return list.triggers.length >= list.limit;
}
