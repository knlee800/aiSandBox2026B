import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { isAcceptedTimeZone, isUuid } from './schedule-validation';

/**
 * TRIGGER-MAIL-01 S2: the request rules of stage-start sections 2 and 8
 * (frozen for slice S4 when S2 lands). Pure functions; nothing here reads a
 * table.
 *
 * Request body (POST: target, task, senderFilter and timeZone required;
 * subjectFilter optional, default null; enabled optional, default true.
 * PATCH: any non-empty subset):
 * - target: { kind: 'chief-of-staff' } or { kind: 'workflow', workflowId }
 *   (the schedule shape; the workflow is checked against the owner's own
 *   workflows by the service).
 * - task: a string, trimmed, 1 to 7500 characters (room for the lines the
 *   platform adds at start, slice S3).
 * - senderFilter: required, a string trimmed to at most 254 characters: one
 *   full address (local@domain) or @ and a domain (@example.com). Stored in
 *   lower case (the match ignores case). A domain matches that domain
 *   exactly, not its subdomains (slice S3). No display name, no list, no
 *   wildcard (`*` or `?`), no quoted local part, no IP address, no
 *   non-ASCII (an international domain is written in punycode): anyone can
 *   write any display name.
 * - subjectFilter: null, or a string trimmed to at most 100 characters; an
 *   empty or blank string means null (any subject from that sender).
 * - timeZone: a string of at most 64 characters that Intl.DateTimeFormat
 *   accepts (the schedule rule).
 * - enabled: a boolean.
 * Any other field (provider, model, approval, budget, profile, sessionId,
 * mailState, armedAt ...) is refused. Nothing in the body sets them.
 */

export const MAIL_TRIGGER_TASK_MAX_CHARS = 7500;
export const MAIL_TRIGGER_SENDER_FILTER_MAX_CHARS = 254;
export const MAIL_TRIGGER_SUBJECT_FILTER_MAX_CHARS = 100;
export const MAIL_TRIGGERS_PER_OWNER_LIMIT = 3;

/** Stable error codes. The Schedules page's mail section (slice S4) translates them. */
export const MAIL_TRIGGER_ERROR_CODES = {
  invalidBody: 'mail_trigger_invalid_body',
  unknownField: 'mail_trigger_unknown_field',
  missingField: 'mail_trigger_missing_field',
  emptyChange: 'mail_trigger_empty_change',
  invalidTarget: 'mail_trigger_invalid_target',
  invalidTask: 'mail_trigger_invalid_task',
  invalidSender: 'mail_trigger_invalid_sender',
  invalidSubject: 'mail_trigger_invalid_subject',
  invalidTimeZone: 'mail_trigger_invalid_time_zone',
  invalidEnabled: 'mail_trigger_invalid_enabled',
  notFound: 'mail_trigger_not_found',
  workflowNotFound: 'mail_trigger_workflow_not_found',
  limitReached: 'mail_trigger_limit_reached',
} as const;

export type MailTriggerErrorCode = (typeof MAIL_TRIGGER_ERROR_CODES)[keyof typeof MAIL_TRIGGER_ERROR_CODES];

const MAIL_TRIGGER_ERROR_MESSAGES: Readonly<Record<MailTriggerErrorCode, string>> = {
  mail_trigger_invalid_body: 'The request body must be an object',
  mail_trigger_unknown_field: 'The request has a field that is not allowed',
  mail_trigger_missing_field: 'A required field is missing',
  mail_trigger_empty_change: 'Nothing to change',
  mail_trigger_invalid_target: 'target must be the Chief of Staff or one of your workflows',
  mail_trigger_invalid_task: `task must be 1 to ${MAIL_TRIGGER_TASK_MAX_CHARS} characters`,
  mail_trigger_invalid_sender: `senderFilter must be one email address or @ and a domain, at most ${MAIL_TRIGGER_SENDER_FILTER_MAX_CHARS} characters`,
  mail_trigger_invalid_subject: `subjectFilter must be empty or at most ${MAIL_TRIGGER_SUBJECT_FILTER_MAX_CHARS} characters`,
  mail_trigger_invalid_time_zone: 'timeZone must be a known time zone',
  mail_trigger_invalid_enabled: 'enabled must be true or false',
  mail_trigger_not_found: 'Mail trigger not found',
  mail_trigger_workflow_not_found: 'Workflow not found',
  mail_trigger_limit_reached: `At most ${MAIL_TRIGGERS_PER_OWNER_LIMIT} mail triggers per account`,
};

const MAIL_TRIGGER_ERROR_STATUS: Readonly<Record<MailTriggerErrorCode, HttpStatus>> = {
  mail_trigger_invalid_body: HttpStatus.BAD_REQUEST,
  mail_trigger_unknown_field: HttpStatus.BAD_REQUEST,
  mail_trigger_missing_field: HttpStatus.BAD_REQUEST,
  mail_trigger_empty_change: HttpStatus.BAD_REQUEST,
  mail_trigger_invalid_target: HttpStatus.BAD_REQUEST,
  mail_trigger_invalid_task: HttpStatus.BAD_REQUEST,
  mail_trigger_invalid_sender: HttpStatus.BAD_REQUEST,
  mail_trigger_invalid_subject: HttpStatus.BAD_REQUEST,
  mail_trigger_invalid_time_zone: HttpStatus.BAD_REQUEST,
  mail_trigger_invalid_enabled: HttpStatus.BAD_REQUEST,
  mail_trigger_not_found: HttpStatus.NOT_FOUND,
  mail_trigger_workflow_not_found: HttpStatus.NOT_FOUND,
  mail_trigger_limit_reached: HttpStatus.CONFLICT,
};

const ERROR_NAMES: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
};

/** `{ statusCode, message, error, code, ...extra }`, as the schedule and event trigger routes answer. */
export function mailTriggerError(
  code: MailTriggerErrorCode,
  extra: Record<string, string | number> = {},
): HttpException {
  const statusCode = MAIL_TRIGGER_ERROR_STATUS[code];
  const body = {
    statusCode,
    message: MAIL_TRIGGER_ERROR_MESSAGES[code],
    error: ERROR_NAMES[statusCode],
    code,
    ...extra,
  };
  return statusCode === HttpStatus.BAD_REQUEST
    ? new BadRequestException(body)
    : new HttpException(body, statusCode);
}

export type MailTriggerTargetInput =
  | { kind: 'chief-of-staff' }
  | { kind: 'workflow'; workflowId: string };

/** A parsed POST body. */
export interface MailTriggerCreateInput {
  target: MailTriggerTargetInput;
  task: string;
  senderFilter: string;
  subjectFilter: string | null;
  timeZone: string;
  enabled: boolean;
}

/** A parsed PATCH body: only the fields that were sent. */
export type MailTriggerPatchInput = Partial<MailTriggerCreateInput>;

const REQUIRED_FIELDS = ['target', 'task', 'senderFilter', 'timeZone'] as const;
const ALLOWED_FIELDS: ReadonlySet<string> = new Set([...REQUIRED_FIELDS, 'subjectFilter', 'enabled']);

/**
 * The local part of an address: dot-atom text (RFC 5322 atext separated by
 * single dots), at most 64 characters, without `*` and `?` so that nothing
 * reads as a wildcard (the match is exact). Quoted local parts are refused.
 */
const LOCAL_PART_PATTERN = /^[a-z0-9!#$%&'+/=^_`{|}~-]+(?:\.[a-z0-9!#$%&'+/=^_`{|}~-]+)*$/;
const LOCAL_PART_MAX_CHARS = 64;
/** One DNS label: letters, digits and inner hyphens, 1 to 63 characters (punycode allowed). */
const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DOMAIN_MAX_CHARS = 253;

/**
 * True for a lower-case `local@domain` or `@domain` (what readSenderFilter
 * stores). The domain has at least two labels and its last label is not all
 * digits, so an IP address is not a domain.
 */
export function isAcceptedSenderFilter(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAIL_TRIGGER_SENDER_FILTER_MAX_CHARS) {
    return false;
  }
  const at = value.indexOf('@');
  if (at < 0 || at !== value.lastIndexOf('@')) {
    return false;
  }
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.length > 0 && (local.length > LOCAL_PART_MAX_CHARS || !LOCAL_PART_PATTERN.test(local))) {
    return false;
  }
  if (domain.length === 0 || domain.length > DOMAIN_MAX_CHARS) {
    return false;
  }
  const labels = domain.split('.');
  if (labels.length < 2 || !labels.every((label) => DOMAIN_LABEL_PATTERN.test(label))) {
    return false;
  }
  return !/^\d+$/.test(labels[labels.length - 1]);
}

export function readMailTriggerCreate(body: unknown): MailTriggerCreateInput {
  const record = readRecord(body);
  for (const field of REQUIRED_FIELDS) {
    if (!(field in record) || record[field] === undefined) {
      throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.missingField, { field });
    }
  }
  const parsed = readFields(record);
  return {
    target: parsed.target!,
    task: parsed.task!,
    senderFilter: parsed.senderFilter!,
    subjectFilter: parsed.subjectFilter ?? null,
    timeZone: parsed.timeZone!,
    enabled: parsed.enabled ?? true,
  };
}

export function readMailTriggerPatch(body: unknown): MailTriggerPatchInput {
  const record = readRecord(body);
  const parsed = readFields(record);
  if (Object.keys(parsed).length === 0) {
    throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.emptyChange);
  }
  return parsed;
}

function readRecord(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.invalidBody);
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_FIELDS.has(key)) {
      // The field name only; never its value.
      throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.unknownField, { field: key.slice(0, 64) });
    }
  }
  return record;
}

function readFields(record: Record<string, unknown>): MailTriggerPatchInput {
  const parsed: MailTriggerPatchInput = {};
  if (record.target !== undefined) parsed.target = readTarget(record.target);
  if (record.task !== undefined) parsed.task = readTask(record.task);
  if (record.senderFilter !== undefined) parsed.senderFilter = readSender(record.senderFilter);
  // subjectFilter: null is a value (clear the filter), so only undefined means "not sent".
  if (record.subjectFilter !== undefined) parsed.subjectFilter = readSubject(record.subjectFilter);
  if (record.timeZone !== undefined) parsed.timeZone = readTimeZone(record.timeZone);
  if (record.enabled !== undefined) parsed.enabled = readEnabled(record.enabled);
  return parsed;
}

function readTarget(value: unknown): MailTriggerTargetInput {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.invalidTarget);
  }
  const target = value as Record<string, unknown>;
  const keys = Object.keys(target).sort();
  if (target.kind === 'chief-of-staff') {
    if (keys.length !== 1) {
      throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.invalidTarget);
    }
    return { kind: 'chief-of-staff' };
  }
  if (target.kind === 'workflow') {
    if (keys.join(',') !== 'kind,workflowId' || typeof target.workflowId !== 'string') {
      throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.invalidTarget);
    }
    // A string that is not a uuid cannot be one of the owner's workflows:
    // it answers 404 like an unknown id (the service never queries with it).
    if (!isUuid(target.workflowId)) {
      throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.workflowNotFound);
    }
    return { kind: 'workflow', workflowId: target.workflowId.toLowerCase() };
  }
  throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.invalidTarget);
}

function readTask(value: unknown): string {
  if (typeof value !== 'string') {
    throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.invalidTask);
  }
  const task = value.trim();
  if (task.length === 0 || task.length > MAIL_TRIGGER_TASK_MAX_CHARS) {
    throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.invalidTask);
  }
  return task;
}

/** Required: never null or blank. The refusal never echoes the text. */
function readSender(value: unknown): string {
  if (typeof value !== 'string') {
    throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.invalidSender);
  }
  const sender = value.trim().toLowerCase();
  if (!isAcceptedSenderFilter(sender)) {
    throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.invalidSender);
  }
  return sender;
}

function readSubject(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.invalidSubject);
  }
  const subject = value.trim();
  if (subject.length === 0) {
    return null;
  }
  if (subject.length > MAIL_TRIGGER_SUBJECT_FILTER_MAX_CHARS) {
    throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.invalidSubject);
  }
  return subject;
}

function readTimeZone(value: unknown): string {
  if (!isAcceptedTimeZone(value)) {
    throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.invalidTimeZone);
  }
  return value;
}

function readEnabled(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.invalidEnabled);
  }
  return value;
}
