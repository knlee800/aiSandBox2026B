import {
  SCHEDULE_OUTCOMES,
  SCHEDULE_SKIP_REASONS,
  browserTimeZone,
  readTargetStatus,
  type ScheduleTarget,
} from './schedules.logic';

/**
 * TRIGGER-MORE-01 S3: pure helpers for the "When a file is added" section of
 * the Schedules page. Shapes follow the S1 routes as built
 * (docs/TRIGGER-MORE-01-STAGE-START.md sections 4 and 5). The code lists below
 * are copies of the backend lists, pinned by a test.
 */

/** knowledge-trigger-validation.ts KNOWLEDGE_TRIGGER_ERROR_CODES. */
export const KNOWLEDGE_TRIGGER_ERROR_CODES = [
  'knowledge_trigger_invalid_body',
  'knowledge_trigger_unknown_field',
  'knowledge_trigger_missing_field',
  'knowledge_trigger_empty_change',
  'knowledge_trigger_invalid_target',
  'knowledge_trigger_invalid_task',
  'knowledge_trigger_invalid_folder',
  'knowledge_trigger_folder_not_readable',
  'knowledge_trigger_invalid_time_zone',
  'knowledge_trigger_invalid_enabled',
  'knowledge_trigger_not_found',
  'knowledge_trigger_workflow_not_found',
  'knowledge_trigger_limit_reached',
] as const;

/**
 * knowledge-trigger-reasons.ts KNOWLEDGE_TRIGGER_SKIP_REASONS: the schedule
 * reasons except `missed`, plus `day_limit`.
 */
export const KNOWLEDGE_TRIGGER_SKIP_REASONS = [
  ...SCHEDULE_SKIP_REASONS.filter((code) => code !== 'missed'),
  'day_limit',
] as const;

/** AGENT_KNOWLEDGE_TRIGGER_RUN_OUTCOMES (the same three as the schedule outcomes). */
export const KNOWLEDGE_TRIGGER_OUTCOMES = SCHEDULE_OUTCOMES;

/** knowledge-scopes.ts: the nine fixed Knowledge folder ids (names are knowledge.scopes.<id>). */
export const KNOWLEDGE_FOLDER_IDS = [
  'company-monthly-reports',
  'three-year-goals',
  'strategy-docs',
  'policies',
  'meeting-summaries',
  'codebase-context',
  'contract-templates',
  'market-data',
  'tech-landscape',
] as const;

/** system-agent-registry.ts CHIEF_OF_STAFF_KNOWLEDGE_SCOPE_IDS: the six folders the Chief of Staff can read. */
export const CHIEF_OF_STAFF_FOLDER_IDS = [
  'company-monthly-reports',
  'three-year-goals',
  'strategy-docs',
  'policies',
  'meeting-summaries',
  'contract-templates',
] as const;

export const KNOWLEDGE_TRIGGER_TASK_MAX_CHARS = 7000;
export const KNOWLEDGE_TRIGGER_TIME_ZONE_MAX_CHARS = 64;
export const KNOWLEDGE_TRIGGERS_DEFAULT_LIMIT = 3;

export interface KnowledgeTriggerLastRun {
  changedAt: string;
  localDate: string;
  outcome: string;
  reason: string | null;
  collaborationRunId: string | null;
  at: string;
}

export interface KnowledgeTriggerRun extends KnowledgeTriggerLastRun {
  id: string;
  documentId: string | null;
}

export interface KnowledgeTriggerItem {
  id: string;
  target: ScheduleTarget;
  task: string;
  scopeId: string;
  timeZone: string;
  enabled: boolean;
  lastRun: KnowledgeTriggerLastRun | null;
}

export interface KnowledgeTriggerList {
  enabled: boolean;
  runsEnabled: boolean;
  limit: number;
  triggers: KnowledgeTriggerItem[];
}

/** The form's state. `targetId` is '' for the Chief of Staff, else a workflow id. */
export interface KnowledgeTriggerDraft {
  targetId: string;
  task: string;
  scopeId: string;
  timeZone: string;
  enabled: boolean;
}

export type KnowledgeTriggerRequestBody = {
  target: { kind: 'chief-of-staff' } | { kind: 'workflow'; workflowId: string };
  task: string;
  scopeId: string;
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

function readLastRun(value: unknown): KnowledgeTriggerLastRun | null {
  if (!isRecord(value) || typeof value.localDate !== 'string' || typeof value.outcome !== 'string') {
    return null;
  }
  return {
    changedAt: typeof value.changedAt === 'string' ? value.changedAt : '',
    localDate: value.localDate,
    outcome: value.outcome,
    reason: readText(value.reason),
    collaborationRunId: readText(value.collaborationRunId),
    at: typeof value.at === 'string' ? value.at : '',
  };
}

/** One knowledge trigger, or null when the body is not one. */
export function parseKnowledgeTrigger(value: unknown): KnowledgeTriggerItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) return null;
  const target = readTarget(value.target);
  if (
    !target ||
    typeof value.task !== 'string' ||
    typeof value.scopeId !== 'string' ||
    typeof value.timeZone !== 'string' ||
    typeof value.enabled !== 'boolean'
  ) {
    return null;
  }
  return {
    id: value.id,
    target,
    task: value.task,
    scopeId: value.scopeId,
    timeZone: value.timeZone,
    enabled: value.enabled,
    lastRun: readLastRun(value.lastRun),
  };
}

/** The GET /api/knowledge-triggers body, or null. Malformed triggers are left out. */
export function parseKnowledgeTriggerList(body: unknown): KnowledgeTriggerList | null {
  if (!isRecord(body) || !Array.isArray(body.triggers)) return null;
  const limit =
    typeof body.limit === 'number' && body.limit > 0 ? body.limit : KNOWLEDGE_TRIGGERS_DEFAULT_LIMIT;
  return {
    enabled: body.enabled === true,
    runsEnabled: body.runsEnabled === true,
    limit,
    triggers: body.triggers
      .map((entry) => parseKnowledgeTrigger(entry))
      .filter((entry): entry is KnowledgeTriggerItem => entry !== null),
  };
}

/** The GET /api/knowledge-triggers/:id/runs body, or null. */
export function parseKnowledgeTriggerRuns(body: unknown): KnowledgeTriggerRun[] | null {
  if (!isRecord(body) || !Array.isArray(body.runs)) return null;
  const runs: KnowledgeTriggerRun[] = [];
  for (const entry of body.runs) {
    const last = readLastRun(entry);
    if (last && isRecord(entry) && typeof entry.id === 'string') {
      runs.push({ ...last, id: entry.id, documentId: readText(entry.documentId) });
    }
  }
  return runs;
}

/** The message key (inside the schedules.knowledge namespace) for a backend error code. */
export function knowledgeTriggerErrorKey(code: string | null): string {
  return code !== null && (KNOWLEDGE_TRIGGER_ERROR_CODES as readonly string[]).includes(code)
    ? `errors.${code}`
    : 'errors.generic';
}

export function knowledgeReasonKey(reason: string): string {
  return (KNOWLEDGE_TRIGGER_SKIP_REASONS as readonly string[]).includes(reason)
    ? `reasons.${reason}`
    : 'reasons.unknown';
}

export function knowledgeOutcomeKey(outcome: string): string {
  return (KNOWLEDGE_TRIGGER_OUTCOMES as readonly string[]).includes(outcome)
    ? `outcomes.${outcome}`
    : 'outcomes.unknown';
}

export function isKnowledgeFolderId(id: string): boolean {
  return (KNOWLEDGE_FOLDER_IDS as readonly string[]).includes(id);
}

/** True when the Chief of Staff can read the folder (a fixed set of six). */
export function chiefCanReadFolder(id: string): boolean {
  return (CHIEF_OF_STAFF_FOLDER_IDS as readonly string[]).includes(id);
}

export function emptyKnowledgeDraft(timeZone: string = browserTimeZone()): KnowledgeTriggerDraft {
  return {
    targetId: '',
    task: '',
    scopeId: KNOWLEDGE_FOLDER_IDS[0],
    timeZone,
    enabled: true,
  };
}

export function draftFromKnowledgeTrigger(trigger: KnowledgeTriggerItem): KnowledgeTriggerDraft {
  return {
    targetId: trigger.target.kind === 'workflow' ? trigger.target.workflowId : '',
    task: trigger.task,
    scopeId: trigger.scopeId,
    timeZone: trigger.timeZone,
    enabled: trigger.enabled,
  };
}

/**
 * A workflow can read a folder only if the folder is ticked for it, and its
 * ticked folders can change later, so every workflow target gets the warning.
 */
export function showWorkflowKnowledgeWarning(draft: Pick<KnowledgeTriggerDraft, 'targetId'>): boolean {
  return draft.targetId !== '';
}

/** True when the draft asks the Chief of Staff to watch a folder it cannot read. */
export function chiefFolderRefused(draft: Pick<KnowledgeTriggerDraft, 'targetId' | 'scopeId'>): boolean {
  return draft.targetId === '' && isKnowledgeFolderId(draft.scopeId) && !chiefCanReadFolder(draft.scopeId);
}

export type KnowledgeDraftResult =
  | { ok: true; body: KnowledgeTriggerRequestBody }
  | { ok: false; errorKey: string };

/** The same rules the gateway applies, so an obvious mistake never leaves the page. */
export function draftToBody(draft: KnowledgeTriggerDraft): KnowledgeDraftResult {
  const task = draft.task.trim();
  if (task.length === 0 || task.length > KNOWLEDGE_TRIGGER_TASK_MAX_CHARS) {
    return { ok: false, errorKey: knowledgeTriggerErrorKey('knowledge_trigger_invalid_task') };
  }
  if (!isKnowledgeFolderId(draft.scopeId)) {
    return { ok: false, errorKey: knowledgeTriggerErrorKey('knowledge_trigger_invalid_folder') };
  }
  if (chiefFolderRefused(draft)) {
    return { ok: false, errorKey: knowledgeTriggerErrorKey('knowledge_trigger_folder_not_readable') };
  }
  const zone = draft.timeZone.trim();
  if (zone.length === 0 || zone.length > KNOWLEDGE_TRIGGER_TIME_ZONE_MAX_CHARS) {
    return { ok: false, errorKey: knowledgeTriggerErrorKey('knowledge_trigger_invalid_time_zone') };
  }
  return {
    ok: true,
    body: {
      target:
        draft.targetId === ''
          ? { kind: 'chief-of-staff' }
          : { kind: 'workflow', workflowId: draft.targetId },
      task,
      scopeId: draft.scopeId,
      timeZone: zone,
      enabled: draft.enabled,
    },
  };
}

export function knowledgeLimitReached(list: KnowledgeTriggerList): boolean {
  return list.triggers.length >= list.limit;
}
