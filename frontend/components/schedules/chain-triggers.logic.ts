import {
  SCHEDULE_OUTCOMES,
  SCHEDULE_SKIP_REASONS,
  browserTimeZone,
  readTargetStatus,
  targetNotOn,
  targetWorkflowStatus,
  type ScheduleTarget,
  type WorkflowOption,
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

/** CHAIN-SOURCE-OFF-01: a source workflow's status; 'missing' when it is deleted or not the owner's. */
export type ChainSourceStatus = 'active' | 'draft' | 'disabled' | 'missing';

/** The trigger's `source` view (CHAIN-SOURCE-OFF-01), built by the gateway as the target's is. */
export interface ChainTriggerSource {
  workflowId: string;
  name: string | null;
  status: ChainSourceStatus;
}

export interface ChainTriggerItem {
  id: string;
  sourceWorkflowId: string;
  /** null when the gateway did not send it (an older gateway): the page then uses its workflow list. */
  source: ChainTriggerSource | null;
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

/**
 * The source view, or null when it is absent or not for this trigger's source.
 * An unknown status reads as disabled, as the workflows route reads one (fail
 * closed: the page warns rather than says nothing).
 */
function readSource(value: unknown, sourceWorkflowId: string): ChainTriggerSource | null {
  if (!isRecord(value) || value.workflowId !== sourceWorkflowId) return null;
  const missing = value.status === 'missing';
  const status: ChainSourceStatus = missing
    ? 'missing'
    : value.status === 'active' || value.status === 'draft'
      ? value.status
      : 'disabled';
  return { workflowId: sourceWorkflowId, name: missing ? null : readText(value.name), status };
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
    source: readSource(value.source, value.sourceWorkflowId),
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

/**
 * CHAIN-SOURCE-OFF-01: the saved trigger's source status. The gateway's
 * `source` wins; without it (an older gateway) the page's workflow list
 * decides: absent there is 'missing', present without a status is 'active'
 * (today's behaviour: nothing shown).
 */
export function chainSourceStatus(
  trigger: Pick<ChainTriggerItem, 'sourceWorkflowId' | 'source'>,
  workflows: readonly WorkflowOption[],
): ChainSourceStatus {
  if (trigger.source) return trigger.source.status;
  const found = workflows.find((workflow) => workflow.id === trigger.sourceWorkflowId);
  return found ? found.status ?? 'active' : 'missing';
}

/** The saved trigger's source name, from the gateway or the workflow list; null when it is gone. */
export function chainSourceName(
  trigger: Pick<ChainTriggerItem, 'sourceWorkflowId' | 'source'>,
  workflows: readonly WorkflowOption[],
): string | null {
  if (chainSourceStatus(trigger, workflows) === 'missing') return null;
  const listed = workflows.find((workflow) => workflow.id === trigger.sourceWorkflowId);
  return trigger.source?.name ?? listed?.name ?? null;
}

/**
 * The status of the source chosen in the form, from the page's workflow list.
 * When the list carries no status, the saved trigger's own `source` answers for
 * its saved source. null when nothing is chosen, the workflow is not listed
 * (the picker's deleted label covers that), or the status is unknown.
 */
export function chainDraftSourceStatus(
  workflows: readonly WorkflowOption[],
  sourceId: string,
  saved: ChainTriggerSource | null = null,
): ChainSourceStatus | null {
  if (sourceId === '') return null;
  const found = workflows.find((workflow) => workflow.id === sourceId);
  if (!found) return null;
  if (found.status) return found.status;
  return saved && saved.workflowId === sourceId && saved.status !== 'missing' ? saved.status : null;
}

/** True for a source that exists but is not switched on: the trigger will not fire until it is. */
export function chainSourceNotOn(status: ChainSourceStatus | null): status is 'draft' | 'disabled' {
  return status === 'draft' || status === 'disabled';
}

/** The notice key after a switch: switched on with a source that is not on (or gone) says it will not fire. */
export function chainSwitchNoticeKey(enabled: boolean, sourceStatus: ChainSourceStatus): string {
  if (!enabled) return 'notice.switchedOff';
  if (sourceStatus === 'missing') return 'notice.switchedOnSourceGone';
  return chainSourceNotOn(sourceStatus) ? 'notice.switchedOnSourceOff' : 'notice.switchedOn';
}

/**
 * TRIGGER-TARGET-OFF-01: the notice key after a switch, with the target too.
 * When both are off, one combined notice says neither will be there; a gone
 * source wins (nothing the target does can help); otherwise the one that is off.
 */
export function chainSwitchNoticeKeyFor(
  enabled: boolean,
  sourceStatus: ChainSourceStatus,
  target: ScheduleTarget,
): string {
  if (!enabled) return 'notice.switchedOff';
  const targetOff = targetNotOn(targetWorkflowStatus(target));
  if (sourceStatus === 'missing') return 'notice.switchedOnSourceGone';
  if (chainSourceNotOn(sourceStatus)) {
    return targetOff ? 'notice.switchedOnBothOff' : 'notice.switchedOnSourceOff';
  }
  return targetOff ? 'notice.switchedOnTargetOff' : 'notice.switchedOn';
}

/** The notices that carry a warning (shown amber, not as a success). */
export const CHAIN_WARNING_NOTICE_KEYS: readonly string[] = [
  'notice.switchedOnSourceOff',
  'notice.switchedOnSourceGone',
  'notice.switchedOnTargetOff',
  'notice.switchedOnBothOff',
];
