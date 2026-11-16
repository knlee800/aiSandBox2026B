import {
  SCHEDULE_OUTCOMES,
  SCHEDULE_SKIP_REASONS,
  browserTimeZone,
  type ScheduleTarget,
} from './schedules.logic';

/**
 * TRIGGER-CHAIN-01 S3: pure helpers for the "After a workflow finishes"
 * section of the Schedules page. Shapes follow the S1 routes as built
 * (docs/TRIGGER-CHAIN-01-STAGE-START.md sections 2 to 5). The code lists below
 * are copies of the backend lists, pinned by a test.
 */

/** chain-trigger-validation.ts CHAIN_TRIGGER_ERROR_CODES. */
export const CHAIN_TRIGGER_ERROR_CODES = [
  'chain_trigger_invalid_body',
  'chain_trigger_unknown_field',
  'chain_trigger_missing_field',
  'chain_trigger_empty_change',
  'chain_trigger_invalid_source',
  'chain_trigger_invalid_target',
  'chain_trigger_same_workflow',
  'chain_trigger_invalid_task',
  'chain_trigger_invalid_time_zone',
  'chain_trigger_invalid_enabled',
  'chain_trigger_not_found',
  'chain_trigger_workflow_not_found',
  'chain_trigger_limit_reached',
  'chain_trigger_cycle',
] as const;

/**
 * chain-trigger-reasons.ts CHAIN_TRIGGER_SKIP_REASONS: the schedule reasons
 * except `missed`, plus `day_limit` and `chain_depth`.
 */
export const CHAIN_TRIGGER_SKIP_REASONS = [
  ...SCHEDULE_SKIP_REASONS.filter((code) => code !== 'missed'),
  'day_limit',
  'chain_depth',
] as const;

/** AGENT_CHAIN_TRIGGER_RUN_OUTCOMES (the same three as the schedule outcomes). */
export const CHAIN_TRIGGER_OUTCOMES = SCHEDULE_OUTCOMES;

export const CHAIN_TRIGGER_TASK_MAX_CHARS = 7000;
export const CHAIN_TRIGGER_TIME_ZONE_MAX_CHARS = 64;
export const CHAIN_TRIGGERS_DEFAULT_LIMIT = 3;

export interface ChainTriggerLastRun {
  sourceRunId: string;
  sourceCompletedAt: string;
  localDate: string;
  depth: number;
  outcome: string;
  reason: string | null;
  collaborationRunId: string | null;
  at: string;
}

export interface ChainTriggerRun extends ChainTriggerLastRun {
  id: string;
}

export interface ChainTriggerItem {
  id: string;
  sourceWorkflowId: string;
  target: ScheduleTarget;
  task: string;
  timeZone: string;
  enabled: boolean;
  lastRun: ChainTriggerLastRun | null;
}

export interface ChainTriggerList {
  enabled: boolean;
  runsEnabled: boolean;
  resultToolEnabled: boolean;
  limit: number;
  triggers: ChainTriggerItem[];
}

/** The form's state. `sourceId` is '' until one is chosen; `targetId` is '' for the Chief of Staff. */
export interface ChainTriggerDraft {
  sourceId: string;
  targetId: string;
  task: string;
  timeZone: string;
  enabled: boolean;
}

export type ChainTriggerRequestBody = {
  sourceWorkflowId: string;
  target: { kind: 'chief-of-staff' } | { kind: 'workflow'; workflowId: string };
  task: string;
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

function readLastRun(value: unknown): ChainTriggerLastRun | null {
  if (!isRecord(value) || typeof value.localDate !== 'string' || typeof value.outcome !== 'string') {
    return null;
  }
  return {
    sourceRunId: typeof value.sourceRunId === 'string' ? value.sourceRunId : '',
    sourceCompletedAt: typeof value.sourceCompletedAt === 'string' ? value.sourceCompletedAt : '',
    localDate: value.localDate,
    depth: typeof value.depth === 'number' && value.depth >= 1 ? value.depth : 1,
    outcome: value.outcome,
    reason: readText(value.reason),
    collaborationRunId: readText(value.collaborationRunId),
    at: typeof value.at === 'string' ? value.at : '',
  };
}

/** One chain trigger, or null when the body is not one. */
export function parseChainTrigger(value: unknown): ChainTriggerItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) return null;
  const target = readTarget(value.target);
  if (
    !target ||
    typeof value.sourceWorkflowId !== 'string' ||
    value.sourceWorkflowId.length === 0 ||
    typeof value.task !== 'string' ||
    typeof value.timeZone !== 'string' ||
    typeof value.enabled !== 'boolean'
  ) {
    return null;
  }
  return {
    id: value.id,
    sourceWorkflowId: value.sourceWorkflowId,
    target,
    task: value.task,
    timeZone: value.timeZone,
    enabled: value.enabled,
    lastRun: readLastRun(value.lastRun),
  };
}

/** The GET /api/chain-triggers body, or null. Malformed triggers are left out. */
export function parseChainTriggerList(body: unknown): ChainTriggerList | null {
  if (!isRecord(body) || !Array.isArray(body.triggers)) return null;
  const limit = typeof body.limit === 'number' && body.limit > 0 ? body.limit : CHAIN_TRIGGERS_DEFAULT_LIMIT;
  return {
    enabled: body.enabled === true,
    runsEnabled: body.runsEnabled === true,
    resultToolEnabled: body.resultToolEnabled === true,
    limit,
    triggers: body.triggers
      .map((entry) => parseChainTrigger(entry))
      .filter((entry): entry is ChainTriggerItem => entry !== null),
  };
}

/** The GET /api/chain-triggers/:id/runs body, or null. */
export function parseChainTriggerRuns(body: unknown): ChainTriggerRun[] | null {
  if (!isRecord(body) || !Array.isArray(body.runs)) return null;
  const runs: ChainTriggerRun[] = [];
  for (const entry of body.runs) {
    const last = readLastRun(entry);
    if (last && isRecord(entry) && typeof entry.id === 'string') {
      runs.push({ ...last, id: entry.id });
    }
  }
  return runs;
}

/** The message key (inside the schedules.chain namespace) for a backend error code. */
export function chainTriggerErrorKey(code: string | null): string {
  return code !== null && (CHAIN_TRIGGER_ERROR_CODES as readonly string[]).includes(code)
    ? `errors.${code}`
    : 'errors.generic';
}

export function chainReasonKey(reason: string): string {
  return (CHAIN_TRIGGER_SKIP_REASONS as readonly string[]).includes(reason)
    ? `reasons.${reason}`
    : 'reasons.unknown';
}

export function chainOutcomeKey(outcome: string): string {
  return (CHAIN_TRIGGER_OUTCOMES as readonly string[]).includes(outcome)
    ? `outcomes.${outcome}`
    : 'outcomes.unknown';
}

export function emptyChainDraft(timeZone: string = browserTimeZone()): ChainTriggerDraft {
  return { sourceId: '', targetId: '', task: '', timeZone, enabled: true };
}

export function draftFromChainTrigger(trigger: ChainTriggerItem): ChainTriggerDraft {
  return {
    sourceId: trigger.sourceWorkflowId,
    targetId: trigger.target.kind === 'workflow' ? trigger.target.workflowId : '',
    task: trigger.task,
    timeZone: trigger.timeZone,
    enabled: trigger.enabled,
  };
}

/** True when the draft names the same workflow as source and as target (chain_trigger_same_workflow). */
export function chainSameWorkflow(draft: Pick<ChainTriggerDraft, 'sourceId' | 'targetId'>): boolean {
  return draft.sourceId !== '' && draft.sourceId === draft.targetId;
}

/**
 * True when saving the draft would close a loop (chain_trigger_cycle): the
 * edges are source to target over the owner's other chain triggers, switched
 * on or off, plus the draft's own. The Chief of Staff is never a source, so an
 * edge to it ends there. The same rule the gateway applies at save.
 */
export function chainWouldLoop(
  triggers: readonly ChainTriggerItem[],
  draft: Pick<ChainTriggerDraft, 'sourceId' | 'targetId'>,
  editingId: string | null,
): boolean {
  if (draft.sourceId === '' || draft.targetId === '' || draft.sourceId === draft.targetId) return false;
  const edges = new Map<string, string[]>();
  const add = (from: string, to: string) => edges.set(from, [...(edges.get(from) ?? []), to]);
  for (const trigger of triggers) {
    if (trigger.id === editingId || trigger.target.kind !== 'workflow') continue;
    add(trigger.sourceWorkflowId, trigger.target.workflowId);
  }
  add(draft.sourceId, draft.targetId);
  // A loop through the draft edge exists when the draft's target can reach its source.
  const seen = new Set<string>();
  const stack = [draft.targetId];
  while (stack.length > 0) {
    const node = stack.pop() as string;
    if (node === draft.sourceId) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    stack.push(...(edges.get(node) ?? []));
  }
  return false;
}

export type ChainDraftResult =
  | { ok: true; body: ChainTriggerRequestBody }
  | { ok: false; errorKey: string };

/** The same rules the gateway applies, so an obvious mistake never leaves the page. */
export function draftToBody(
  draft: ChainTriggerDraft,
  context: { triggers: readonly ChainTriggerItem[]; editingId: string | null } = { triggers: [], editingId: null },
): ChainDraftResult {
  if (draft.sourceId.length === 0) {
    return { ok: false, errorKey: chainTriggerErrorKey('chain_trigger_invalid_source') };
  }
  if (chainSameWorkflow(draft)) {
    return { ok: false, errorKey: chainTriggerErrorKey('chain_trigger_same_workflow') };
  }
  const task = draft.task.trim();
  if (task.length === 0 || task.length > CHAIN_TRIGGER_TASK_MAX_CHARS) {
    return { ok: false, errorKey: chainTriggerErrorKey('chain_trigger_invalid_task') };
  }
  const zone = draft.timeZone.trim();
  if (zone.length === 0 || zone.length > CHAIN_TRIGGER_TIME_ZONE_MAX_CHARS) {
    return { ok: false, errorKey: chainTriggerErrorKey('chain_trigger_invalid_time_zone') };
  }
  if (chainWouldLoop(context.triggers, draft, context.editingId)) {
    return { ok: false, errorKey: chainTriggerErrorKey('chain_trigger_cycle') };
  }
  return {
    ok: true,
    body: {
      sourceWorkflowId: draft.sourceId,
      target:
        draft.targetId === ''
          ? { kind: 'chief-of-staff' }
          : { kind: 'workflow', workflowId: draft.targetId },
      task,
      timeZone: zone,
      enabled: draft.enabled,
    },
  };
}

export function chainLimitReached(list: ChainTriggerList): boolean {
  return list.triggers.length >= list.limit;
}
