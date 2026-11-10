'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { collaborationFetch } from '@/lib/collaboration/api';
import { fillTemplate } from '@/lib/collaboration/logic';

/**
 * BIZ-USER-01C D13: the owner's workflows on the Team page. The page lists
 * them from GET /api/collaboration/workflows, starts a test run or a normal
 * run with { sessionId, task, workflowId, testRun }, and translates the
 * WORKFLOW_* refusal codes. Nothing of the spec is sent from the browser.
 *
 * TEAM-NO-SESSION-02: without a session the body has no sessionId and the
 * server runs the workflow on the owner's business project; the list's
 * `business` field names that project for "Past runs".
 */

export type CollaborationWorkflowStatus = 'active' | 'draft' | 'disabled';

export type CollaborationWorkflowModel =
  | { choice: 'server' }
  | { choice: 'platform'; id: string }
  | null;

export interface CollaborationWorkflowItem {
  id: string;
  name: string;
  role: string;
  status: CollaborationWorkflowStatus;
  tested: boolean;
  knowledgeScopeIds: string[];
  model: CollaborationWorkflowModel;
  budgetPerRunCredits: number | null;
  budgetPerDayCredits: number | null;
  spentTodayCredits: number;
  lastRunCredits: number | null;
}

export interface CollaborationRunWorkflow {
  id: string;
  name: string;
  testRun: boolean;
}

export type CollaborationWorkflowListState = 'loading' | 'failed' | 'loaded';

/** TEAM-NO-SESSION-02 D10: the owner's business project, once a session-less run created it. */
export interface CollaborationBusinessProject {
  projectId: string;
}

export interface CollaborationWorkflowList {
  state: CollaborationWorkflowListState;
  items: CollaborationWorkflowItem[];
  /** TEAM-NO-SESSION-02: null until the first session-less run; absent when not read. */
  business?: CollaborationBusinessProject | null;
  onRetry: () => void;
  /** Called when a run ends, so tested flags and spend are read again. */
  onStale: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function readModel(value: unknown): CollaborationWorkflowModel {
  if (!isRecord(value)) {
    return null;
  }
  if (value.choice === 'server') {
    return { choice: 'server' };
  }
  if (value.choice === 'platform' && typeof value.id === 'string' && value.id.length > 0) {
    return { choice: 'platform', id: value.id };
  }
  return null;
}

function readStatus(value: unknown): CollaborationWorkflowStatus {
  return value === 'active' || value === 'draft' ? value : 'disabled';
}

/** The workflows from GET /api/collaboration/workflows. Malformed entries are left out. */
export function readCollaborationWorkflows(body: unknown): CollaborationWorkflowItem[] {
  if (!isRecord(body) || !Array.isArray(body.workflows)) {
    return [];
  }
  const items: CollaborationWorkflowItem[] = [];
  for (const entry of body.workflows) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || entry.id.length === 0) {
      continue;
    }
    if (typeof entry.name !== 'string' || entry.name.length === 0) {
      continue;
    }
    items.push({
      id: entry.id,
      name: entry.name,
      role: typeof entry.role === 'string' ? entry.role : '',
      status: readStatus(entry.status),
      tested: entry.tested === true,
      knowledgeScopeIds: Array.isArray(entry.knowledgeScopeIds)
        ? entry.knowledgeScopeIds.filter((id): id is string => typeof id === 'string')
        : [],
      model: readModel(entry.model),
      budgetPerRunCredits: readCount(entry.budgetPerRunCredits),
      budgetPerDayCredits: readCount(entry.budgetPerDayCredits),
      spentTodayCredits: readCount(entry.spentTodayCredits) ?? 0,
      lastRunCredits: readCount(entry.lastRunCredits),
    });
  }
  return items;
}

/** TEAM-NO-SESSION-02 D10: `business` from GET /api/collaboration/workflows, or null. */
export function readCollaborationBusiness(body: unknown): CollaborationBusinessProject | null {
  if (!isRecord(body) || !isRecord(body.business)) {
    return null;
  }
  const projectId = body.business.projectId;
  return typeof projectId === 'string' && projectId.trim().length > 0
    ? { projectId: projectId.trim() }
    : null;
}

/** The workflow a listed or opened run ran, or null for a team run. */
export function readRunWorkflow(value: unknown): CollaborationRunWorkflow | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') {
    return null;
  }
  if (value.id.length === 0 || value.name.length === 0) {
    return null;
  }
  return { id: value.id, name: value.name, testRun: value.testRun === true };
}

/** TEAM-NO-SESSION-02 D11: an empty or missing sessionId is left out of the body. */
export function collaborationWorkflowStartBody(input: {
  sessionId?: string;
  task: string;
  workflowId: string;
  testRun: boolean;
}): { sessionId?: string; task: string; workflowId: string; testRun: boolean } {
  const sessionId = input.sessionId?.trim() ?? '';
  return {
    ...(sessionId.length > 0 ? { sessionId } : {}),
    task: input.task.trim(),
    workflowId: input.workflowId,
    testRun: input.testRun,
  };
}

export type CollaborationWorkflowHint = 'needsTest' | 'draft' | 'off' | null;

/**
 * D13: Start test run for any workflow that is not off; Start only when the
 * workflow is on and tested at its current version. Otherwise a hint.
 */
export function collaborationWorkflowActions(item: CollaborationWorkflowItem): {
  canTest: boolean;
  canRun: boolean;
  hint: CollaborationWorkflowHint;
} {
  if (item.status === 'disabled') {
    return { canTest: false, canRun: false, hint: 'off' };
  }
  if (item.status === 'draft') {
    return { canTest: true, canRun: false, hint: item.tested ? 'draft' : 'needsTest' };
  }
  if (!item.tested) {
    return { canTest: true, canRun: false, hint: 'needsTest' };
  }
  return { canTest: true, canRun: true, hint: null };
}

export interface CollaborationWorkflowSummaryLabels {
  folders: string;
  modelServer: string;
  budgetPerRun: string;
  noBudget: string;
}

/** The roster line: role, folder count, model and the per-run budget. */
export function collaborationWorkflowSummary(
  item: CollaborationWorkflowItem,
  labels: CollaborationWorkflowSummaryLabels,
): string {
  const parts: string[] = [];
  if (item.role.trim().length > 0) {
    parts.push(item.role.trim());
  }
  parts.push(fillTemplate(labels.folders, { count: String(item.knowledgeScopeIds.length) }));
  if (item.model?.choice === 'platform') {
    parts.push(item.model.id);
  } else {
    parts.push(labels.modelServer);
  }
  parts.push(
    item.budgetPerRunCredits !== null
      ? fillTemplate(labels.budgetPerRun, { credits: String(item.budgetPerRunCredits) })
      : labels.noBudget,
  );
  return parts.join(' · ');
}

/** The spend line, shown only when a per-day budget is set. */
export function collaborationWorkflowSpentLine(
  item: CollaborationWorkflowItem,
  template: string,
): string | null {
  if (item.budgetPerDayCredits === null) {
    return null;
  }
  return fillTemplate(template, {
    spent: String(item.spentTodayCredits),
    budget: String(item.budgetPerDayCredits),
  });
}

export const WORKFLOW_REFUSAL_MESSAGE_KEYS: Readonly<Record<string, string>> = {
  WORKFLOW_NOT_FOUND: 'refusalWorkflowNotFound',
  WORKFLOW_DISABLED: 'refusalWorkflowDisabled',
  WORKFLOW_INVALID: 'refusalWorkflowInvalid',
  WORKFLOW_NOT_TESTED: 'refusalWorkflowNotTested',
  WORKFLOW_BUDGET_DAY: 'refusalWorkflowBudgetDay',
  WORKFLOW_BUDGET_RUN: 'refusalWorkflowBudgetRun',
};

/**
 * The page reads body.code first: a WORKFLOW_* code maps to its message key
 * and the numbers it shows. Anything else returns null and falls to the
 * status mapping as before.
 */
export function collaborationWorkflowRefusal(
  body: unknown,
): { key: string; values: Record<string, string> } | null {
  if (!isRecord(body) || typeof body.code !== 'string') {
    return null;
  }
  const key = WORKFLOW_REFUSAL_MESSAGE_KEYS[body.code];
  if (!key) {
    return null;
  }
  const values: Record<string, string> = {};
  for (const field of ['budget', 'spent', 'lastRun'] as const) {
    const count = readCount(body[field]);
    if (count !== null) {
      values[field] = String(count);
    }
  }
  return { key, values };
}

/**
 * Loads the owner's workflows; the route is owner-scoped and needs no session. Kept out of
 * useCollaborationScreen so the screen's own requests are unchanged.
 */
/** TEAM-PRESELECT-01: the id to preselect, or null when the list has no such workflow. */
export function preselectWorkflowId(
  items: readonly CollaborationWorkflowItem[],
  workflowId: string,
): string | null {
  return workflowId !== '' && items.some((entry) => entry.id === workflowId) ? workflowId : null;
}

export function useCollaborationWorkflowList(enabled: boolean): CollaborationWorkflowList {
  const [state, setState] = useState<CollaborationWorkflowListState>('loading');
  const [items, setItems] = useState<CollaborationWorkflowItem[]>([]);
  const [business, setBusiness] = useState<CollaborationBusinessProject | null>(null);
  const [generation, setGeneration] = useState(0);
  const quiet = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    if (!quiet.current) {
      setState('loading');
    }
    collaborationFetch('/api/collaboration/workflows')
      .then(async (response) => {
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setState('failed');
          return;
        }
        const body: unknown = await response.json();
        if (cancelled) {
          return;
        }
        setItems(readCollaborationWorkflows(body));
        setBusiness(readCollaborationBusiness(body));
        setState('loaded');
      })
      .catch(() => {
        if (!cancelled) {
          setState('failed');
        }
      })
      .finally(() => {
        quiet.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, generation]);

  const onRetry = useCallback(() => {
    quiet.current = false;
    setGeneration((value) => value + 1);
  }, []);
  const onStale = useCallback(() => {
    quiet.current = true;
    setGeneration((value) => value + 1);
  }, []);

  return { state, items, business, onRetry, onStale };
}
