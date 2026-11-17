/**
 * TRIGGER-UI-01: pure helpers for the Schedules page. Shapes follow the frozen
 * TRIGGER-01 contract (docs/TRIGGER-01-CHECKPOINT.md, "Shapes as built"). The
 * code lists below are copies of the backend lists, pinned by a test.
 */

/** schedule-validation.ts SCHEDULE_ERROR_CODES. */
export const SCHEDULE_ERROR_CODES = [
  'schedule_invalid_body',
  'schedule_unknown_field',
  'schedule_missing_field',
  'schedule_empty_change',
  'schedule_invalid_target',
  'schedule_invalid_task',
  'schedule_invalid_time',
  'schedule_invalid_days',
  'schedule_invalid_time_zone',
  'schedule_invalid_enabled',
  'schedule_not_found',
  'schedule_workflow_not_found',
  'schedule_limit_reached',
] as const;

/** schedule-refusal.ts SCHEDULE_SKIP_REASONS. */
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

/** AgentScheduleRunOutcome. */
export const SCHEDULE_OUTCOMES = ['claimed', 'started', 'skipped'] as const;

export const SCHEDULE_TASK_MAX_CHARS = 8000;
export const SCHEDULE_TIME_ZONE_MAX_CHARS = 64;
export const SCHEDULE_DAY_NUMBERS = [1, 2, 3, 4, 5, 6, 7] as const;
const TASK_PREVIEW_CHARS = 90;

export type ScheduleTarget =
  | { kind: 'chief-of-staff' }
  | { kind: 'workflow'; workflowId: string; name: string | null; missing: boolean };

export interface ScheduleLastRun {
  localDate: string;
  outcome: string;
  reason: string | null;
  collaborationRunId: string | null;
  at: string;
}

export interface ScheduleRun extends ScheduleLastRun {
  id: string;
}

export interface ScheduleItem {
  id: string;
  target: ScheduleTarget;
  task: string;
  timeOfDay: string;
  days: number[];
  timeZone: string;
  enabled: boolean;
  lastRun: ScheduleLastRun | null;
}

export interface SchedulesList {
  enabled: boolean;
  runsEnabled: boolean;
  limit: number;
  schedules: ScheduleItem[];
}

export interface WorkflowOption {
  id: string;
  name: string;
  /** CHAIN-SOURCE-OFF-01: passed through from the workflows route; absent when unknown. */
  status?: 'active' | 'draft' | 'disabled';
}

/** The form's state. `targetId` is '' for the Chief of Staff, else a workflow id. */
export interface ScheduleDraft {
  targetId: string;
  task: string;
  timeOfDay: string;
  days: number[];
  timeZone: string;
  enabled: boolean;
}

export type ScheduleRequestBody = {
  target: { kind: 'chief-of-staff' } | { kind: 'workflow'; workflowId: string };
  task: string;
  timeOfDay: string;
  days: number[];
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

function readLastRun(value: unknown): ScheduleLastRun | null {
  if (!isRecord(value) || typeof value.localDate !== 'string' || typeof value.outcome !== 'string') {
    return null;
  }
  return {
    localDate: value.localDate,
    outcome: value.outcome,
    reason: readText(value.reason),
    collaborationRunId: readText(value.collaborationRunId),
    at: typeof value.at === 'string' ? value.at : '',
  };
}

/** One schedule, or null when the body is not one. */
export function parseSchedule(value: unknown): ScheduleItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) return null;
  const target = readTarget(value.target);
  if (
    !target ||
    typeof value.task !== 'string' ||
    typeof value.timeOfDay !== 'string' ||
    !Array.isArray(value.days) ||
    typeof value.timeZone !== 'string' ||
    typeof value.enabled !== 'boolean'
  ) {
    return null;
  }
  return {
    id: value.id,
    target,
    task: value.task,
    timeOfDay: value.timeOfDay,
    days: value.days.filter((day): day is number => typeof day === 'number'),
    timeZone: value.timeZone,
    enabled: value.enabled,
    lastRun: readLastRun(value.lastRun),
  };
}

/** The GET /api/schedules body, or null. Malformed schedules are left out. */
export function parseSchedulesList(body: unknown): SchedulesList | null {
  if (!isRecord(body) || !Array.isArray(body.schedules)) return null;
  const limit = typeof body.limit === 'number' && body.limit > 0 ? body.limit : 5;
  return {
    enabled: body.enabled === true,
    runsEnabled: body.runsEnabled === true,
    limit,
    schedules: body.schedules
      .map((entry) => parseSchedule(entry))
      .filter((entry): entry is ScheduleItem => entry !== null),
  };
}

/** The GET /api/schedules/:id/runs body, or null. */
export function parseScheduleRuns(body: unknown): ScheduleRun[] | null {
  if (!isRecord(body) || !Array.isArray(body.runs)) return null;
  const runs: ScheduleRun[] = [];
  for (const entry of body.runs) {
    const last = readLastRun(entry);
    if (last && isRecord(entry) && typeof entry.id === 'string') {
      runs.push({ ...last, id: entry.id });
    }
  }
  return runs;
}

/** The message key (inside the schedules namespace) for a backend error code. */
export function scheduleErrorKey(code: string | null): string {
  return code !== null && (SCHEDULE_ERROR_CODES as readonly string[]).includes(code)
    ? `errors.${code}`
    : 'errors.generic';
}

export function reasonKey(reason: string): string {
  return (SCHEDULE_SKIP_REASONS as readonly string[]).includes(reason)
    ? `reasons.${reason}`
    : 'reasons.unknown';
}

export function outcomeKey(outcome: string): string {
  return (SCHEDULE_OUTCOMES as readonly string[]).includes(outcome)
    ? `outcomes.${outcome}`
    : 'outcomes.unknown';
}

export function taskPreview(task: string): string {
  const flat = task.replace(/\s+/g, ' ').trim();
  return flat.length > TASK_PREVIEW_CHARS ? `${flat.slice(0, TASK_PREVIEW_CHARS - 1)}…` : flat;
}

export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function emptyDraft(timeZone: string = browserTimeZone()): ScheduleDraft {
  return { targetId: '', task: '', timeOfDay: '09:00', days: [1, 2, 3, 4, 5], timeZone, enabled: true };
}

export function draftFromSchedule(schedule: ScheduleItem): ScheduleDraft {
  return {
    targetId: schedule.target.kind === 'workflow' ? schedule.target.workflowId : '',
    task: schedule.task,
    timeOfDay: schedule.timeOfDay,
    days: [...schedule.days],
    timeZone: schedule.timeZone,
    enabled: schedule.enabled,
  };
}

export function toggleDay(days: readonly number[], day: number): number[] {
  const next = days.includes(day) ? days.filter((entry) => entry !== day) : [...days, day];
  return next.sort((a, b) => a - b);
}

export type DraftResult =
  | { ok: true; body: ScheduleRequestBody }
  | { ok: false; errorKey: string };

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The same rules the gateway applies, so an obvious mistake never leaves the page. */
export function draftToBody(draft: ScheduleDraft): DraftResult {
  const task = draft.task.trim();
  if (task.length === 0 || task.length > SCHEDULE_TASK_MAX_CHARS) {
    return { ok: false, errorKey: scheduleErrorKey('schedule_invalid_task') };
  }
  if (!TIME_PATTERN.test(draft.timeOfDay)) {
    return { ok: false, errorKey: scheduleErrorKey('schedule_invalid_time') };
  }
  if (draft.days.length === 0) {
    return { ok: false, errorKey: scheduleErrorKey('schedule_invalid_days') };
  }
  const zone = draft.timeZone.trim();
  if (zone.length === 0 || zone.length > SCHEDULE_TIME_ZONE_MAX_CHARS) {
    return { ok: false, errorKey: scheduleErrorKey('schedule_invalid_time_zone') };
  }
  return {
    ok: true,
    body: {
      target:
        draft.targetId === ''
          ? { kind: 'chief-of-staff' }
          : { kind: 'workflow', workflowId: draft.targetId },
      task,
      timeOfDay: draft.timeOfDay,
      days: [...draft.days].sort((a, b) => a - b),
      timeZone: zone,
      enabled: draft.enabled,
    },
  };
}

export function limitReached(list: SchedulesList): boolean {
  return list.schedules.length >= list.limit;
}
