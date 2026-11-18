import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { AGENT_CHAIN_TRIGGER_FIRES_ON, AgentChainTriggerFiresOn } from '../entities/agent-chain-trigger.entity';
import { isAcceptedTimeZone, isUuid } from './schedule-validation';

/**
 * TRIGGER-CHAIN-01 S1: the request rules of stage-start sections 2 to 4
 * (frozen for slice S3 when S1 lands) and the save-time cycle rule of
 * section 3. Pure functions; nothing here reads a table.
 *
 * Request body (POST: sourceWorkflowId, target, task and timeZone required;
 * enabled optional, default true. PATCH: any non-empty subset):
 * - sourceWorkflowId: the id of one of the owner's own workflows (a uuid; the
 *   service checks it against the owner's not deleted workflows). Never the
 *   Chief of Staff: anything that is not a uuid string is refused with
 *   chain_trigger_invalid_source.
 * - target: { kind: 'chief-of-staff' } or { kind: 'workflow', workflowId }
 *   (the schedule shape; the workflow is checked against the owner's own
 *   workflows by the service). A workflow target equal to the source is
 *   refused (chain_trigger_same_workflow).
 * - task: a string, trimmed, 1 to 7000 characters (room for the lines the
 *   platform adds at start, slice S2: the finished run's id and time).
 * - timeZone: a string of at most 64 characters that Intl.DateTimeFormat
 *   accepts (the schedule rule).
 * - enabled: a boolean.
 * - firesOn (TRIGGER-CHAIN-FAILED-01 S1): 'completed' or 'failed', the source
 *   run outcome the trigger starts on; anything else is
 *   chain_trigger_invalid_fires_on. Optional on POST (the service stores
 *   'completed' when it is not sent) and allowed on PATCH.
 * Any other field (provider, model, approval, budget, profile, sessionId,
 * armedAt, depth, sourceRunId ...) is refused. Nothing in the body sets them.
 */

export const CHAIN_TRIGGER_TASK_MAX_CHARS = 7000;
export const CHAIN_TRIGGERS_PER_OWNER_LIMIT = 3;

/** Stable error codes. The Schedules page's chain section (slice S3) translates them. */
export const CHAIN_TRIGGER_ERROR_CODES = {
  invalidBody: 'chain_trigger_invalid_body',
  unknownField: 'chain_trigger_unknown_field',
  missingField: 'chain_trigger_missing_field',
  emptyChange: 'chain_trigger_empty_change',
  invalidSource: 'chain_trigger_invalid_source',
  invalidTarget: 'chain_trigger_invalid_target',
  sameWorkflow: 'chain_trigger_same_workflow',
  invalidTask: 'chain_trigger_invalid_task',
  invalidTimeZone: 'chain_trigger_invalid_time_zone',
  invalidEnabled: 'chain_trigger_invalid_enabled',
  invalidFiresOn: 'chain_trigger_invalid_fires_on',
  notFound: 'chain_trigger_not_found',
  workflowNotFound: 'chain_trigger_workflow_not_found',
  limitReached: 'chain_trigger_limit_reached',
  cycle: 'chain_trigger_cycle',
} as const;

export type ChainTriggerErrorCode = (typeof CHAIN_TRIGGER_ERROR_CODES)[keyof typeof CHAIN_TRIGGER_ERROR_CODES];

const CHAIN_TRIGGER_ERROR_MESSAGES: Readonly<Record<ChainTriggerErrorCode, string>> = {
  chain_trigger_invalid_body: 'The request body must be an object',
  chain_trigger_unknown_field: 'The request has a field that is not allowed',
  chain_trigger_missing_field: 'A required field is missing',
  chain_trigger_empty_change: 'Nothing to change',
  chain_trigger_invalid_source: 'sourceWorkflowId must be one of your workflows',
  chain_trigger_invalid_target: 'target must be the Chief of Staff or one of your workflows',
  chain_trigger_same_workflow: 'The target cannot be the source workflow',
  chain_trigger_invalid_task: `task must be 1 to ${CHAIN_TRIGGER_TASK_MAX_CHARS} characters`,
  chain_trigger_invalid_time_zone: 'timeZone must be a known time zone',
  chain_trigger_invalid_enabled: 'enabled must be true or false',
  chain_trigger_invalid_fires_on: "firesOn must be 'completed' or 'failed'",
  chain_trigger_not_found: 'Chain trigger not found',
  chain_trigger_workflow_not_found: 'Workflow not found',
  chain_trigger_limit_reached: `At most ${CHAIN_TRIGGERS_PER_OWNER_LIMIT} chain triggers per account`,
  chain_trigger_cycle: 'This trigger would close a loop of chain triggers',
};

const CHAIN_TRIGGER_ERROR_STATUS: Readonly<Record<ChainTriggerErrorCode, HttpStatus>> = {
  chain_trigger_invalid_body: HttpStatus.BAD_REQUEST,
  chain_trigger_unknown_field: HttpStatus.BAD_REQUEST,
  chain_trigger_missing_field: HttpStatus.BAD_REQUEST,
  chain_trigger_empty_change: HttpStatus.BAD_REQUEST,
  chain_trigger_invalid_source: HttpStatus.BAD_REQUEST,
  chain_trigger_invalid_target: HttpStatus.BAD_REQUEST,
  chain_trigger_same_workflow: HttpStatus.BAD_REQUEST,
  chain_trigger_invalid_task: HttpStatus.BAD_REQUEST,
  chain_trigger_invalid_time_zone: HttpStatus.BAD_REQUEST,
  chain_trigger_invalid_enabled: HttpStatus.BAD_REQUEST,
  chain_trigger_invalid_fires_on: HttpStatus.BAD_REQUEST,
  chain_trigger_not_found: HttpStatus.NOT_FOUND,
  chain_trigger_workflow_not_found: HttpStatus.NOT_FOUND,
  chain_trigger_limit_reached: HttpStatus.CONFLICT,
  chain_trigger_cycle: HttpStatus.CONFLICT,
};

const ERROR_NAMES: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
};

/** `{ statusCode, message, error, code, ...extra }`, as the other trigger routes answer. */
export function chainTriggerError(
  code: ChainTriggerErrorCode,
  extra: Record<string, string | number> = {},
): HttpException {
  const statusCode = CHAIN_TRIGGER_ERROR_STATUS[code];
  const body = {
    statusCode,
    message: CHAIN_TRIGGER_ERROR_MESSAGES[code],
    error: ERROR_NAMES[statusCode],
    code,
    ...extra,
  };
  return statusCode === HttpStatus.BAD_REQUEST
    ? new BadRequestException(body)
    : new HttpException(body, statusCode);
}

export type ChainTriggerTargetInput = { kind: 'chief-of-staff' } | { kind: 'workflow'; workflowId: string };

/** A parsed POST body. */
export interface ChainTriggerCreateInput {
  sourceWorkflowId: string;
  target: ChainTriggerTargetInput;
  task: string;
  timeZone: string;
  enabled: boolean;
  /** Present only when sent; the service stores 'completed' when it is absent. */
  firesOn?: AgentChainTriggerFiresOn;
}

/** A parsed PATCH body: only the fields that were sent. */
export type ChainTriggerPatchInput = Partial<ChainTriggerCreateInput>;

/** TRIGGER-CHAIN-FAILED-01 S1: what a trigger without a sent or stored firesOn fires on. */
export const CHAIN_TRIGGER_DEFAULT_FIRES_ON: AgentChainTriggerFiresOn = 'completed';

const REQUIRED_FIELDS = ['sourceWorkflowId', 'target', 'task', 'timeZone'] as const;
const ALLOWED_FIELDS: ReadonlySet<string> = new Set([...REQUIRED_FIELDS, 'enabled', 'firesOn']);

/** Refuses a workflow target equal to the source. The refusal names no value. */
export function assertNotSameWorkflow(sourceWorkflowId: string, target: ChainTriggerTargetInput): void {
  if (target.kind === 'workflow' && target.workflowId === sourceWorkflowId) {
    throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.sameWorkflow);
  }
}

export function readChainTriggerCreate(body: unknown): ChainTriggerCreateInput {
  const record = readRecord(body);
  for (const field of REQUIRED_FIELDS) {
    if (!(field in record) || record[field] === undefined) {
      throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.missingField, { field });
    }
  }
  const parsed = readFields(record);
  const input: ChainTriggerCreateInput = {
    sourceWorkflowId: parsed.sourceWorkflowId!,
    target: parsed.target!,
    task: parsed.task!,
    timeZone: parsed.timeZone!,
    enabled: parsed.enabled ?? true,
  };
  if (parsed.firesOn !== undefined) {
    input.firesOn = parsed.firesOn;
  }
  assertNotSameWorkflow(input.sourceWorkflowId, input.target);
  return input;
}

/**
 * A PATCH body. The same-workflow rule needs the stored source or target when
 * only one of them is sent, so the service checks it on the merged row; a
 * body that sends both is checked here too.
 */
export function readChainTriggerPatch(body: unknown): ChainTriggerPatchInput {
  const record = readRecord(body);
  const parsed = readFields(record);
  if (Object.keys(parsed).length === 0) {
    throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.emptyChange);
  }
  if (parsed.sourceWorkflowId !== undefined && parsed.target !== undefined) {
    assertNotSameWorkflow(parsed.sourceWorkflowId, parsed.target);
  }
  return parsed;
}

/** One stored or proposed chain trigger, as the cycle rule sees it. */
export interface ChainTriggerEdge {
  /** The trigger id; a proposed new trigger has an id no stored edge has. */
  id: string;
  sourceWorkflowId: string;
  targetKind: ChainTriggerTargetInput['kind'];
  workflowId: string | null;
}

/**
 * Stage-start section 3, bound 1: true when saving `candidate` closes a cycle
 * among the owner's chain triggers. `existing` is every one of the owner's
 * chain triggers, switched on or off; a stored edge with the candidate's id
 * is the trigger being changed and is replaced by the candidate. The Chief of
 * Staff is never a source, so an edge to it ends there and never closes a
 * cycle. A workflow target equal to the source is a cycle of one (refused
 * earlier as chain_trigger_same_workflow). Otherwise the save closes a cycle
 * exactly when the candidate's target already reaches its source.
 */
export function closesChainCycle(existing: readonly ChainTriggerEdge[], candidate: ChainTriggerEdge): boolean {
  if (candidate.targetKind !== 'workflow' || candidate.workflowId === null) {
    return false;
  }
  if (candidate.workflowId === candidate.sourceWorkflowId) {
    return true;
  }
  const next = new Map<string, string[]>();
  for (const edge of existing) {
    if (edge.id === candidate.id || edge.targetKind !== 'workflow' || edge.workflowId === null) {
      continue;
    }
    const targets = next.get(edge.sourceWorkflowId) ?? [];
    targets.push(edge.workflowId);
    next.set(edge.sourceWorkflowId, targets);
  }
  const seen = new Set<string>();
  const stack = [candidate.workflowId];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === candidate.sourceWorkflowId) {
      return true;
    }
    if (seen.has(node)) {
      continue;
    }
    seen.add(node);
    stack.push(...(next.get(node) ?? []));
  }
  return false;
}

function readRecord(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.invalidBody);
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_FIELDS.has(key)) {
      // The field name only; never its value.
      throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.unknownField, { field: key.slice(0, 64) });
    }
  }
  return record;
}

function readFields(record: Record<string, unknown>): ChainTriggerPatchInput {
  const parsed: ChainTriggerPatchInput = {};
  if (record.sourceWorkflowId !== undefined) parsed.sourceWorkflowId = readSource(record.sourceWorkflowId);
  if (record.target !== undefined) parsed.target = readTarget(record.target);
  if (record.task !== undefined) parsed.task = readTask(record.task);
  if (record.timeZone !== undefined) parsed.timeZone = readTimeZone(record.timeZone);
  if (record.enabled !== undefined) parsed.enabled = readEnabled(record.enabled);
  if (record.firesOn !== undefined) parsed.firesOn = readFiresOn(record.firesOn);
  return parsed;
}

/** A uuid string, lower-cased. The Chief of Staff, null or any other value is refused; the refusal never echoes it. */
function readSource(value: unknown): string {
  if (!isUuid(value)) {
    throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.invalidSource);
  }
  return value.toLowerCase();
}

function readTarget(value: unknown): ChainTriggerTargetInput {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.invalidTarget);
  }
  const target = value as Record<string, unknown>;
  const keys = Object.keys(target).sort();
  if (target.kind === 'chief-of-staff') {
    if (keys.length !== 1) {
      throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.invalidTarget);
    }
    return { kind: 'chief-of-staff' };
  }
  if (target.kind === 'workflow') {
    if (keys.join(',') !== 'kind,workflowId' || typeof target.workflowId !== 'string') {
      throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.invalidTarget);
    }
    // A string that is not a uuid cannot be one of the owner's workflows:
    // it answers 404 like an unknown id (the service never queries with it).
    if (!isUuid(target.workflowId)) {
      throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.workflowNotFound);
    }
    return { kind: 'workflow', workflowId: target.workflowId.toLowerCase() };
  }
  throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.invalidTarget);
}

function readTask(value: unknown): string {
  if (typeof value !== 'string') {
    throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.invalidTask);
  }
  const task = value.trim();
  if (task.length === 0 || task.length > CHAIN_TRIGGER_TASK_MAX_CHARS) {
    throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.invalidTask);
  }
  return task;
}

function readTimeZone(value: unknown): string {
  if (!isAcceptedTimeZone(value)) {
    throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.invalidTimeZone);
  }
  return value;
}

function readEnabled(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.invalidEnabled);
  }
  return value;
}

/** Exactly 'completed' or 'failed' (case-sensitive). The refusal never echoes the value. */
function readFiresOn(value: unknown): AgentChainTriggerFiresOn {
  if (typeof value !== 'string' || !(AGENT_CHAIN_TRIGGER_FIRES_ON as readonly string[]).includes(value)) {
    throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.invalidFiresOn);
  }
  return value as AgentChainTriggerFiresOn;
}
