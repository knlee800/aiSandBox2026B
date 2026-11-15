import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { COLLABORATION_USER_TASK_MAX_CHARS } from '../orchestration/collaboration-team';

/**
 * TRIGGER-01 S1: the request rules of stage-start section 7 (the frozen
 * contract for TRIGGER-UI-01). Pure functions; nothing here reads a table.
 *
 * Request body (POST: all of target, task, timeOfDay, days, timeZone; enabled
 * optional, default true. PATCH: any non-empty subset):
 * - target: { kind: 'chief-of-staff' } or { kind: 'workflow', workflowId }
 *   (the same shape a response carries; the workflow is checked against the
 *   owner's own workflows by the service).
 * - task: a string, trimmed, 1 to 8000 characters (the Team page's rule).
 * - timeOfDay: "HH:MM", 00:00 to 23:59.
 * - days: a non-empty array of distinct integers 1 to 7, Monday = 1.
 * - timeZone: a string of at most 64 characters that Intl.DateTimeFormat
 *   accepts.
 * - enabled: a boolean.
 * Any other field (provider, model, approval, budget, profile, sessionId ...)
 * is refused. Nothing in the body sets them.
 */

export const SCHEDULE_TASK_MAX_CHARS = COLLABORATION_USER_TASK_MAX_CHARS;
export const SCHEDULE_TIME_ZONE_MAX_CHARS = 64;
export const SCHEDULES_PER_OWNER_LIMIT = 5;

/** Stable error codes. The Schedules page (TRIGGER-UI-01) translates them. */
export const SCHEDULE_ERROR_CODES = {
  invalidBody: 'schedule_invalid_body',
  unknownField: 'schedule_unknown_field',
  missingField: 'schedule_missing_field',
  emptyChange: 'schedule_empty_change',
  invalidTarget: 'schedule_invalid_target',
  invalidTask: 'schedule_invalid_task',
  invalidTime: 'schedule_invalid_time',
  invalidDays: 'schedule_invalid_days',
  invalidTimeZone: 'schedule_invalid_time_zone',
  invalidEnabled: 'schedule_invalid_enabled',
  notFound: 'schedule_not_found',
  workflowNotFound: 'schedule_workflow_not_found',
  limitReached: 'schedule_limit_reached',
} as const;

export type ScheduleErrorCode = (typeof SCHEDULE_ERROR_CODES)[keyof typeof SCHEDULE_ERROR_CODES];

const SCHEDULE_ERROR_MESSAGES: Readonly<Record<ScheduleErrorCode, string>> = {
  schedule_invalid_body: 'The request body must be an object',
  schedule_unknown_field: 'The request has a field that is not allowed',
  schedule_missing_field: 'A required field is missing',
  schedule_empty_change: 'Nothing to change',
  schedule_invalid_target: 'target must be the Chief of Staff or one of your workflows',
  schedule_invalid_task: `task must be 1 to ${COLLABORATION_USER_TASK_MAX_CHARS} characters`,
  schedule_invalid_time: 'timeOfDay must be HH:MM between 00:00 and 23:59',
  schedule_invalid_days: 'days must be a non-empty set of 1 to 7 (Monday = 1)',
  schedule_invalid_time_zone: 'timeZone must be a known time zone',
  schedule_invalid_enabled: 'enabled must be true or false',
  schedule_not_found: 'Schedule not found',
  schedule_workflow_not_found: 'Workflow not found',
  schedule_limit_reached: `At most ${SCHEDULES_PER_OWNER_LIMIT} schedules per account`,
};

const SCHEDULE_ERROR_STATUS: Readonly<Record<ScheduleErrorCode, HttpStatus>> = {
  schedule_invalid_body: HttpStatus.BAD_REQUEST,
  schedule_unknown_field: HttpStatus.BAD_REQUEST,
  schedule_missing_field: HttpStatus.BAD_REQUEST,
  schedule_empty_change: HttpStatus.BAD_REQUEST,
  schedule_invalid_target: HttpStatus.BAD_REQUEST,
  schedule_invalid_task: HttpStatus.BAD_REQUEST,
  schedule_invalid_time: HttpStatus.BAD_REQUEST,
  schedule_invalid_days: HttpStatus.BAD_REQUEST,
  schedule_invalid_time_zone: HttpStatus.BAD_REQUEST,
  schedule_invalid_enabled: HttpStatus.BAD_REQUEST,
  schedule_not_found: HttpStatus.NOT_FOUND,
  schedule_workflow_not_found: HttpStatus.NOT_FOUND,
  schedule_limit_reached: HttpStatus.CONFLICT,
};

const ERROR_NAMES: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
};

/** `{ statusCode, message, error, code, ...extra }`, as the chat link routes answer. */
export function scheduleError(
  code: ScheduleErrorCode,
  extra: Record<string, string | number> = {},
): HttpException {
  const statusCode = SCHEDULE_ERROR_STATUS[code];
  const body = {
    statusCode,
    message: SCHEDULE_ERROR_MESSAGES[code],
    error: ERROR_NAMES[statusCode],
    code,
    ...extra,
  };
  return statusCode === HttpStatus.BAD_REQUEST
    ? new BadRequestException(body)
    : new HttpException(body, statusCode);
}

export type ScheduleTargetInput =
  | { kind: 'chief-of-staff' }
  | { kind: 'workflow'; workflowId: string };

/** A parsed POST body. */
export interface ScheduleCreateInput {
  target: ScheduleTargetInput;
  task: string;
  timeOfDay: number;
  days: number;
  timeZone: string;
  enabled: boolean;
}

/** A parsed PATCH body: only the fields that were sent. */
export type SchedulePatchInput = Partial<ScheduleCreateInput>;

const REQUIRED_FIELDS = ['target', 'task', 'timeOfDay', 'days', 'timeZone'] as const;
const ALLOWED_FIELDS: ReadonlySet<string> = new Set([...REQUIRED_FIELDS, 'enabled']);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Day numbers 1..7 (Monday = 1) to the stored bit mask (Monday = 1 ... Sunday = 64). */
export function daysToMask(days: readonly number[]): number {
  return days.reduce((mask, day) => mask | (1 << (day - 1)), 0);
}

/** The stored bit mask to sorted day numbers 1..7. Bits outside 1..127 are ignored. */
export function maskToDays(mask: number): number[] {
  const days: number[] = [];
  for (let day = 1; day <= 7; day += 1) {
    if ((mask & (1 << (day - 1))) !== 0) {
      days.push(day);
    }
  }
  return days;
}

/** Minutes after midnight to "HH:MM". */
export function formatTimeOfDay(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** True when Intl.DateTimeFormat accepts the name (the connector broker's rule). */
export function isAcceptedTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > SCHEDULE_TIME_ZONE_MAX_CHARS) {
    return false;
  }
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function readScheduleCreate(body: unknown): ScheduleCreateInput {
  const record = readRecord(body);
  for (const field of REQUIRED_FIELDS) {
    if (!(field in record) || record[field] === undefined) {
      throw scheduleError(SCHEDULE_ERROR_CODES.missingField, { field });
    }
  }
  const parsed = readFields(record);
  return {
    target: parsed.target!,
    task: parsed.task!,
    timeOfDay: parsed.timeOfDay!,
    days: parsed.days!,
    timeZone: parsed.timeZone!,
    enabled: parsed.enabled ?? true,
  };
}

export function readSchedulePatch(body: unknown): SchedulePatchInput {
  const record = readRecord(body);
  const parsed = readFields(record);
  if (Object.keys(parsed).length === 0) {
    throw scheduleError(SCHEDULE_ERROR_CODES.emptyChange);
  }
  return parsed;
}

function readRecord(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw scheduleError(SCHEDULE_ERROR_CODES.invalidBody);
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_FIELDS.has(key)) {
      // The field name only; never its value.
      throw scheduleError(SCHEDULE_ERROR_CODES.unknownField, { field: key.slice(0, 64) });
    }
  }
  return record;
}

function readFields(record: Record<string, unknown>): SchedulePatchInput {
  const parsed: SchedulePatchInput = {};
  if (record.target !== undefined) parsed.target = readTarget(record.target);
  if (record.task !== undefined) parsed.task = readTask(record.task);
  if (record.timeOfDay !== undefined) parsed.timeOfDay = readTimeOfDay(record.timeOfDay);
  if (record.days !== undefined) parsed.days = readDays(record.days);
  if (record.timeZone !== undefined) parsed.timeZone = readTimeZone(record.timeZone);
  if (record.enabled !== undefined) parsed.enabled = readEnabled(record.enabled);
  return parsed;
}

function readTarget(value: unknown): ScheduleTargetInput {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw scheduleError(SCHEDULE_ERROR_CODES.invalidTarget);
  }
  const target = value as Record<string, unknown>;
  const keys = Object.keys(target).sort();
  if (target.kind === 'chief-of-staff') {
    if (keys.length !== 1) {
      throw scheduleError(SCHEDULE_ERROR_CODES.invalidTarget);
    }
    return { kind: 'chief-of-staff' };
  }
  if (target.kind === 'workflow') {
    if (keys.join(',') !== 'kind,workflowId' || typeof target.workflowId !== 'string') {
      throw scheduleError(SCHEDULE_ERROR_CODES.invalidTarget);
    }
    // A string that is not a uuid cannot be one of the owner's workflows:
    // it answers 404 like an unknown id (the service never queries with it).
    if (!isUuid(target.workflowId)) {
      throw scheduleError(SCHEDULE_ERROR_CODES.workflowNotFound);
    }
    return { kind: 'workflow', workflowId: target.workflowId.toLowerCase() };
  }
  throw scheduleError(SCHEDULE_ERROR_CODES.invalidTarget);
}

function readTask(value: unknown): string {
  if (typeof value !== 'string') {
    throw scheduleError(SCHEDULE_ERROR_CODES.invalidTask);
  }
  const task = value.trim();
  if (task.length === 0 || task.length > SCHEDULE_TASK_MAX_CHARS) {
    throw scheduleError(SCHEDULE_ERROR_CODES.invalidTask);
  }
  return task;
}

function readTimeOfDay(value: unknown): number {
  if (typeof value !== 'string') {
    throw scheduleError(SCHEDULE_ERROR_CODES.invalidTime);
  }
  const match = TIME_PATTERN.exec(value);
  if (!match) {
    throw scheduleError(SCHEDULE_ERROR_CODES.invalidTime);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function readDays(value: unknown): number {
  if (!Array.isArray(value) || value.length === 0 || value.length > 7) {
    throw scheduleError(SCHEDULE_ERROR_CODES.invalidDays);
  }
  const seen = new Set<number>();
  for (const day of value) {
    if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 7 || seen.has(day)) {
      throw scheduleError(SCHEDULE_ERROR_CODES.invalidDays);
    }
    seen.add(day);
  }
  return daysToMask([...seen]);
}

function readTimeZone(value: unknown): string {
  if (!isAcceptedTimeZone(value)) {
    throw scheduleError(SCHEDULE_ERROR_CODES.invalidTimeZone);
  }
  return value;
}

function readEnabled(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw scheduleError(SCHEDULE_ERROR_CODES.invalidEnabled);
  }
  return value;
}
