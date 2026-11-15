import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { isAcceptedTimeZone, isUuid } from './schedule-validation';

/**
 * TRIGGER-EVENT-01 S2: the request rules of stage-start sections 2 and 8
 * (frozen for slice S4 when S2 lands). Pure functions; nothing here reads a
 * table.
 *
 * Request body (POST: target, task and timeZone required; leadMinutes
 * optional, default 15; titleFilter optional, default null; enabled optional,
 * default true. PATCH: any non-empty subset):
 * - target: { kind: 'chief-of-staff' } or { kind: 'workflow', workflowId }
 *   (the schedule shape; the workflow is checked against the owner's own
 *   workflows by the service).
 * - task: a string, trimmed, 1 to 7500 characters (room for the lines the
 *   platform adds at start, slice S3).
 * - leadMinutes: an integer 5 to 120.
 * - titleFilter: null, or a string trimmed to at most 100 characters; an
 *   empty or blank string means null (every timed event).
 * - timeZone: a string of at most 64 characters that Intl.DateTimeFormat
 *   accepts (the schedule rule).
 * - enabled: a boolean.
 * Any other field (provider, model, approval, budget, profile, sessionId ...)
 * is refused. Nothing in the body sets them.
 */

export const EVENT_TRIGGER_TASK_MAX_CHARS = 7500;
export const EVENT_TRIGGER_TITLE_FILTER_MAX_CHARS = 100;
export const EVENT_TRIGGER_LEAD_MIN_MINUTES = 5;
export const EVENT_TRIGGER_LEAD_MAX_MINUTES = 120;
export const EVENT_TRIGGER_LEAD_DEFAULT_MINUTES = 15;
export const EVENT_TRIGGERS_PER_OWNER_LIMIT = 3;

/** Stable error codes. The Schedules page's event section (slice S4) translates them. */
export const EVENT_TRIGGER_ERROR_CODES = {
  invalidBody: 'event_trigger_invalid_body',
  unknownField: 'event_trigger_unknown_field',
  missingField: 'event_trigger_missing_field',
  emptyChange: 'event_trigger_empty_change',
  invalidTarget: 'event_trigger_invalid_target',
  invalidTask: 'event_trigger_invalid_task',
  invalidLead: 'event_trigger_invalid_lead',
  invalidFilter: 'event_trigger_invalid_filter',
  invalidTimeZone: 'event_trigger_invalid_time_zone',
  invalidEnabled: 'event_trigger_invalid_enabled',
  notFound: 'event_trigger_not_found',
  workflowNotFound: 'event_trigger_workflow_not_found',
  limitReached: 'event_trigger_limit_reached',
} as const;

export type EventTriggerErrorCode = (typeof EVENT_TRIGGER_ERROR_CODES)[keyof typeof EVENT_TRIGGER_ERROR_CODES];

const EVENT_TRIGGER_ERROR_MESSAGES: Readonly<Record<EventTriggerErrorCode, string>> = {
  event_trigger_invalid_body: 'The request body must be an object',
  event_trigger_unknown_field: 'The request has a field that is not allowed',
  event_trigger_missing_field: 'A required field is missing',
  event_trigger_empty_change: 'Nothing to change',
  event_trigger_invalid_target: 'target must be the Chief of Staff or one of your workflows',
  event_trigger_invalid_task: `task must be 1 to ${EVENT_TRIGGER_TASK_MAX_CHARS} characters`,
  event_trigger_invalid_lead: `leadMinutes must be a whole number from ${EVENT_TRIGGER_LEAD_MIN_MINUTES} to ${EVENT_TRIGGER_LEAD_MAX_MINUTES}`,
  event_trigger_invalid_filter: `titleFilter must be empty or at most ${EVENT_TRIGGER_TITLE_FILTER_MAX_CHARS} characters`,
  event_trigger_invalid_time_zone: 'timeZone must be a known time zone',
  event_trigger_invalid_enabled: 'enabled must be true or false',
  event_trigger_not_found: 'Event trigger not found',
  event_trigger_workflow_not_found: 'Workflow not found',
  event_trigger_limit_reached: `At most ${EVENT_TRIGGERS_PER_OWNER_LIMIT} event triggers per account`,
};

const EVENT_TRIGGER_ERROR_STATUS: Readonly<Record<EventTriggerErrorCode, HttpStatus>> = {
  event_trigger_invalid_body: HttpStatus.BAD_REQUEST,
  event_trigger_unknown_field: HttpStatus.BAD_REQUEST,
  event_trigger_missing_field: HttpStatus.BAD_REQUEST,
  event_trigger_empty_change: HttpStatus.BAD_REQUEST,
  event_trigger_invalid_target: HttpStatus.BAD_REQUEST,
  event_trigger_invalid_task: HttpStatus.BAD_REQUEST,
  event_trigger_invalid_lead: HttpStatus.BAD_REQUEST,
  event_trigger_invalid_filter: HttpStatus.BAD_REQUEST,
  event_trigger_invalid_time_zone: HttpStatus.BAD_REQUEST,
  event_trigger_invalid_enabled: HttpStatus.BAD_REQUEST,
  event_trigger_not_found: HttpStatus.NOT_FOUND,
  event_trigger_workflow_not_found: HttpStatus.NOT_FOUND,
  event_trigger_limit_reached: HttpStatus.CONFLICT,
};

const ERROR_NAMES: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
};

/** `{ statusCode, message, error, code, ...extra }`, as the schedule routes answer. */
export function eventTriggerError(
  code: EventTriggerErrorCode,
  extra: Record<string, string | number> = {},
): HttpException {
  const statusCode = EVENT_TRIGGER_ERROR_STATUS[code];
  const body = {
    statusCode,
    message: EVENT_TRIGGER_ERROR_MESSAGES[code],
    error: ERROR_NAMES[statusCode],
    code,
    ...extra,
  };
  return statusCode === HttpStatus.BAD_REQUEST
    ? new BadRequestException(body)
    : new HttpException(body, statusCode);
}

export type EventTriggerTargetInput =
  | { kind: 'chief-of-staff' }
  | { kind: 'workflow'; workflowId: string };

/** A parsed POST body. */
export interface EventTriggerCreateInput {
  target: EventTriggerTargetInput;
  task: string;
  leadMinutes: number;
  titleFilter: string | null;
  timeZone: string;
  enabled: boolean;
}

/** A parsed PATCH body: only the fields that were sent. */
export type EventTriggerPatchInput = Partial<EventTriggerCreateInput>;

const REQUIRED_FIELDS = ['target', 'task', 'timeZone'] as const;
const ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  ...REQUIRED_FIELDS,
  'leadMinutes',
  'titleFilter',
  'enabled',
]);

export function readEventTriggerCreate(body: unknown): EventTriggerCreateInput {
  const record = readRecord(body);
  for (const field of REQUIRED_FIELDS) {
    if (!(field in record) || record[field] === undefined) {
      throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.missingField, { field });
    }
  }
  const parsed = readFields(record);
  return {
    target: parsed.target!,
    task: parsed.task!,
    leadMinutes: parsed.leadMinutes ?? EVENT_TRIGGER_LEAD_DEFAULT_MINUTES,
    titleFilter: parsed.titleFilter ?? null,
    timeZone: parsed.timeZone!,
    enabled: parsed.enabled ?? true,
  };
}

export function readEventTriggerPatch(body: unknown): EventTriggerPatchInput {
  const record = readRecord(body);
  const parsed = readFields(record);
  if (Object.keys(parsed).length === 0) {
    throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.emptyChange);
  }
  return parsed;
}

function readRecord(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.invalidBody);
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_FIELDS.has(key)) {
      // The field name only; never its value.
      throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.unknownField, { field: key.slice(0, 64) });
    }
  }
  return record;
}

function readFields(record: Record<string, unknown>): EventTriggerPatchInput {
  const parsed: EventTriggerPatchInput = {};
  if (record.target !== undefined) parsed.target = readTarget(record.target);
  if (record.task !== undefined) parsed.task = readTask(record.task);
  if (record.leadMinutes !== undefined) parsed.leadMinutes = readLead(record.leadMinutes);
  // titleFilter: null is a value (clear the filter), so only undefined means "not sent".
  if (record.titleFilter !== undefined) parsed.titleFilter = readFilter(record.titleFilter);
  if (record.timeZone !== undefined) parsed.timeZone = readTimeZone(record.timeZone);
  if (record.enabled !== undefined) parsed.enabled = readEnabled(record.enabled);
  return parsed;
}

function readTarget(value: unknown): EventTriggerTargetInput {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.invalidTarget);
  }
  const target = value as Record<string, unknown>;
  const keys = Object.keys(target).sort();
  if (target.kind === 'chief-of-staff') {
    if (keys.length !== 1) {
      throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.invalidTarget);
    }
    return { kind: 'chief-of-staff' };
  }
  if (target.kind === 'workflow') {
    if (keys.join(',') !== 'kind,workflowId' || typeof target.workflowId !== 'string') {
      throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.invalidTarget);
    }
    // A string that is not a uuid cannot be one of the owner's workflows:
    // it answers 404 like an unknown id (the service never queries with it).
    if (!isUuid(target.workflowId)) {
      throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.workflowNotFound);
    }
    return { kind: 'workflow', workflowId: target.workflowId.toLowerCase() };
  }
  throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.invalidTarget);
}

function readTask(value: unknown): string {
  if (typeof value !== 'string') {
    throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.invalidTask);
  }
  const task = value.trim();
  if (task.length === 0 || task.length > EVENT_TRIGGER_TASK_MAX_CHARS) {
    throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.invalidTask);
  }
  return task;
}

function readLead(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < EVENT_TRIGGER_LEAD_MIN_MINUTES ||
    value > EVENT_TRIGGER_LEAD_MAX_MINUTES
  ) {
    throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.invalidLead);
  }
  return value;
}

function readFilter(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.invalidFilter);
  }
  const filter = value.trim();
  if (filter.length === 0) {
    return null;
  }
  if (filter.length > EVENT_TRIGGER_TITLE_FILTER_MAX_CHARS) {
    throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.invalidFilter);
  }
  return filter;
}

function readTimeZone(value: unknown): string {
  if (!isAcceptedTimeZone(value)) {
    throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.invalidTimeZone);
  }
  return value;
}

function readEnabled(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.invalidEnabled);
  }
  return value;
}
