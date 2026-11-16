import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { findKnowledgeScope } from '../knowledge/knowledge-scopes';
import { CHIEF_OF_STAFF_KNOWLEDGE_SCOPE_IDS } from '../system-agents/system-agent-registry';
import { isAcceptedTimeZone, isUuid } from './schedule-validation';

/**
 * TRIGGER-MORE-01 S1: the request rules of stage-start sections 4 and 5
 * (frozen for slice S3 when S1 lands). Pure functions; nothing here reads a
 * table.
 *
 * Request body (POST: target, task, scopeId and timeZone required; enabled
 * optional, default true. PATCH: any non-empty subset):
 * - target: { kind: 'chief-of-staff' } or { kind: 'workflow', workflowId }
 *   (the schedule shape; the workflow is checked against the owner's own
 *   workflows by the service).
 * - task: a string, trimmed, 1 to 7000 characters (room for the lines the
 *   platform adds at start, slice S2: up to ten document ids).
 * - scopeId: exactly one of the nine fixed Knowledge folder ids
 *   (knowledge-scopes.ts, findKnowledgeScope). A Chief of Staff trigger is
 *   refused on a folder the Chief of Staff cannot read
 *   (knowledge_trigger_folder_not_readable); the readable folders come from
 *   the system-agent registry (CHIEF_OF_STAFF_KNOWLEDGE_SCOPE_IDS). A workflow
 *   target is allowed on any of the nine: its ticked folders can change later,
 *   so the page warns instead.
 * - timeZone: a string of at most 64 characters that Intl.DateTimeFormat
 *   accepts (the schedule rule).
 * - enabled: a boolean.
 * Any other field (provider, model, approval, budget, profile, sessionId,
 * armedAt, documentId ...) is refused. Nothing in the body sets them.
 */

export const KNOWLEDGE_TRIGGER_TASK_MAX_CHARS = 7000;
export const KNOWLEDGE_TRIGGERS_PER_OWNER_LIMIT = 3;

/** Stable error codes. The Schedules page's knowledge section (slice S3) translates them. */
export const KNOWLEDGE_TRIGGER_ERROR_CODES = {
  invalidBody: 'knowledge_trigger_invalid_body',
  unknownField: 'knowledge_trigger_unknown_field',
  missingField: 'knowledge_trigger_missing_field',
  emptyChange: 'knowledge_trigger_empty_change',
  invalidTarget: 'knowledge_trigger_invalid_target',
  invalidTask: 'knowledge_trigger_invalid_task',
  invalidFolder: 'knowledge_trigger_invalid_folder',
  folderNotReadable: 'knowledge_trigger_folder_not_readable',
  invalidTimeZone: 'knowledge_trigger_invalid_time_zone',
  invalidEnabled: 'knowledge_trigger_invalid_enabled',
  notFound: 'knowledge_trigger_not_found',
  workflowNotFound: 'knowledge_trigger_workflow_not_found',
  limitReached: 'knowledge_trigger_limit_reached',
} as const;

export type KnowledgeTriggerErrorCode =
  (typeof KNOWLEDGE_TRIGGER_ERROR_CODES)[keyof typeof KNOWLEDGE_TRIGGER_ERROR_CODES];

const KNOWLEDGE_TRIGGER_ERROR_MESSAGES: Readonly<Record<KnowledgeTriggerErrorCode, string>> = {
  knowledge_trigger_invalid_body: 'The request body must be an object',
  knowledge_trigger_unknown_field: 'The request has a field that is not allowed',
  knowledge_trigger_missing_field: 'A required field is missing',
  knowledge_trigger_empty_change: 'Nothing to change',
  knowledge_trigger_invalid_target: 'target must be the Chief of Staff or one of your workflows',
  knowledge_trigger_invalid_task: `task must be 1 to ${KNOWLEDGE_TRIGGER_TASK_MAX_CHARS} characters`,
  knowledge_trigger_invalid_folder: 'scopeId must be one of the Knowledge folders',
  knowledge_trigger_folder_not_readable: 'The Chief of Staff cannot read this Knowledge folder',
  knowledge_trigger_invalid_time_zone: 'timeZone must be a known time zone',
  knowledge_trigger_invalid_enabled: 'enabled must be true or false',
  knowledge_trigger_not_found: 'Knowledge trigger not found',
  knowledge_trigger_workflow_not_found: 'Workflow not found',
  knowledge_trigger_limit_reached: `At most ${KNOWLEDGE_TRIGGERS_PER_OWNER_LIMIT} knowledge triggers per account`,
};

const KNOWLEDGE_TRIGGER_ERROR_STATUS: Readonly<Record<KnowledgeTriggerErrorCode, HttpStatus>> = {
  knowledge_trigger_invalid_body: HttpStatus.BAD_REQUEST,
  knowledge_trigger_unknown_field: HttpStatus.BAD_REQUEST,
  knowledge_trigger_missing_field: HttpStatus.BAD_REQUEST,
  knowledge_trigger_empty_change: HttpStatus.BAD_REQUEST,
  knowledge_trigger_invalid_target: HttpStatus.BAD_REQUEST,
  knowledge_trigger_invalid_task: HttpStatus.BAD_REQUEST,
  knowledge_trigger_invalid_folder: HttpStatus.BAD_REQUEST,
  knowledge_trigger_folder_not_readable: HttpStatus.BAD_REQUEST,
  knowledge_trigger_invalid_time_zone: HttpStatus.BAD_REQUEST,
  knowledge_trigger_invalid_enabled: HttpStatus.BAD_REQUEST,
  knowledge_trigger_not_found: HttpStatus.NOT_FOUND,
  knowledge_trigger_workflow_not_found: HttpStatus.NOT_FOUND,
  knowledge_trigger_limit_reached: HttpStatus.CONFLICT,
};

const ERROR_NAMES: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
};

/** `{ statusCode, message, error, code, ...extra }`, as the schedule, event and mail trigger routes answer. */
export function knowledgeTriggerError(
  code: KnowledgeTriggerErrorCode,
  extra: Record<string, string | number> = {},
): HttpException {
  const statusCode = KNOWLEDGE_TRIGGER_ERROR_STATUS[code];
  const body = {
    statusCode,
    message: KNOWLEDGE_TRIGGER_ERROR_MESSAGES[code],
    error: ERROR_NAMES[statusCode],
    code,
    ...extra,
  };
  return statusCode === HttpStatus.BAD_REQUEST
    ? new BadRequestException(body)
    : new HttpException(body, statusCode);
}

export type KnowledgeTriggerTargetInput =
  | { kind: 'chief-of-staff' }
  | { kind: 'workflow'; workflowId: string };

/** A parsed POST body. */
export interface KnowledgeTriggerCreateInput {
  target: KnowledgeTriggerTargetInput;
  task: string;
  scopeId: string;
  timeZone: string;
  enabled: boolean;
}

/** A parsed PATCH body: only the fields that were sent. */
export type KnowledgeTriggerPatchInput = Partial<KnowledgeTriggerCreateInput>;

const REQUIRED_FIELDS = ['target', 'task', 'scopeId', 'timeZone'] as const;
const ALLOWED_FIELDS: ReadonlySet<string> = new Set([...REQUIRED_FIELDS, 'enabled']);

/** The folders the Chief of Staff reads, from the system-agent registry (never a copied list). */
const CHIEF_OF_STAFF_READABLE: ReadonlySet<string> = new Set(CHIEF_OF_STAFF_KNOWLEDGE_SCOPE_IDS);

/** True for exactly one of the nine fixed Knowledge folder ids. */
export function isKnowledgeTriggerFolder(value: unknown): value is string {
  return typeof value === 'string' && findKnowledgeScope(value)?.id === value;
}

/**
 * True when the target can read the folder: the Chief of Staff only its own
 * folders; a workflow any folder (the page warns, stage-start section 4).
 */
export function canTargetReadFolder(targetKind: KnowledgeTriggerTargetInput['kind'], scopeId: string): boolean {
  return targetKind !== 'chief-of-staff' || CHIEF_OF_STAFF_READABLE.has(scopeId);
}

/** Refuses a Chief of Staff trigger on a folder it cannot read. The refusal names no value. */
export function assertTargetCanReadFolder(targetKind: KnowledgeTriggerTargetInput['kind'], scopeId: string): void {
  if (!canTargetReadFolder(targetKind, scopeId)) {
    throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.folderNotReadable);
  }
}

export function readKnowledgeTriggerCreate(body: unknown): KnowledgeTriggerCreateInput {
  const record = readRecord(body);
  for (const field of REQUIRED_FIELDS) {
    if (!(field in record) || record[field] === undefined) {
      throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.missingField, { field });
    }
  }
  const parsed = readFields(record);
  const input: KnowledgeTriggerCreateInput = {
    target: parsed.target!,
    task: parsed.task!,
    scopeId: parsed.scopeId!,
    timeZone: parsed.timeZone!,
    enabled: parsed.enabled ?? true,
  };
  assertTargetCanReadFolder(input.target.kind, input.scopeId);
  return input;
}

/**
 * A PATCH body. The folder rule needs the stored target or folder when only
 * one of them is sent, so the service checks it on the merged row; a body
 * that sends both is checked here too.
 */
export function readKnowledgeTriggerPatch(body: unknown): KnowledgeTriggerPatchInput {
  const record = readRecord(body);
  const parsed = readFields(record);
  if (Object.keys(parsed).length === 0) {
    throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.emptyChange);
  }
  if (parsed.target !== undefined && parsed.scopeId !== undefined) {
    assertTargetCanReadFolder(parsed.target.kind, parsed.scopeId);
  }
  return parsed;
}

function readRecord(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.invalidBody);
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_FIELDS.has(key)) {
      // The field name only; never its value.
      throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.unknownField, { field: key.slice(0, 64) });
    }
  }
  return record;
}

function readFields(record: Record<string, unknown>): KnowledgeTriggerPatchInput {
  const parsed: KnowledgeTriggerPatchInput = {};
  if (record.target !== undefined) parsed.target = readTarget(record.target);
  if (record.task !== undefined) parsed.task = readTask(record.task);
  if (record.scopeId !== undefined) parsed.scopeId = readFolder(record.scopeId);
  if (record.timeZone !== undefined) parsed.timeZone = readTimeZone(record.timeZone);
  if (record.enabled !== undefined) parsed.enabled = readEnabled(record.enabled);
  return parsed;
}

function readTarget(value: unknown): KnowledgeTriggerTargetInput {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.invalidTarget);
  }
  const target = value as Record<string, unknown>;
  const keys = Object.keys(target).sort();
  if (target.kind === 'chief-of-staff') {
    if (keys.length !== 1) {
      throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.invalidTarget);
    }
    return { kind: 'chief-of-staff' };
  }
  if (target.kind === 'workflow') {
    if (keys.join(',') !== 'kind,workflowId' || typeof target.workflowId !== 'string') {
      throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.invalidTarget);
    }
    // A string that is not a uuid cannot be one of the owner's workflows:
    // it answers 404 like an unknown id (the service never queries with it).
    if (!isUuid(target.workflowId)) {
      throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.workflowNotFound);
    }
    return { kind: 'workflow', workflowId: target.workflowId.toLowerCase() };
  }
  throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.invalidTarget);
}

function readTask(value: unknown): string {
  if (typeof value !== 'string') {
    throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.invalidTask);
  }
  const task = value.trim();
  if (task.length === 0 || task.length > KNOWLEDGE_TRIGGER_TASK_MAX_CHARS) {
    throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.invalidTask);
  }
  return task;
}

/** Exactly one of the nine ids: no trimming, no case folding. The refusal never echoes the value. */
function readFolder(value: unknown): string {
  if (!isKnowledgeTriggerFolder(value)) {
    throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.invalidFolder);
  }
  return value;
}

function readTimeZone(value: unknown): string {
  if (!isAcceptedTimeZone(value)) {
    throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.invalidTimeZone);
  }
  return value;
}

function readEnabled(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.invalidEnabled);
  }
  return value;
}
