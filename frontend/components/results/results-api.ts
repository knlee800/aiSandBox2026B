import { collaborationFetch } from '@/lib/collaboration/api';
import { readCollaborationSources, readDroppedSourceCount } from '@/lib/collaboration/logic';
import { readCollaborationWorkflows } from '@/components/collaboration/collaboration-workflows';
import {
  resultsQueryString,
  type ResultDetail,
  type ResultListItem,
  type ResultWorkflow,
  type ResultsFilters,
  type ResultsPage,
} from './results.logic';

/**
 * RESULTS-01 D16: the Results page's fetch functions. Every call goes through
 * collaborationFetch (credentials: 'include', CSRF header on POST).
 *
 * GET  /api/results?...             the list (D8)
 * GET  /api/results/unread-count    the header badge (D10)
 * POST /api/results/:runId/seen     first open (D11)
 * GET  /api/collaboration/runs/:id  the detail, unchanged (D13)
 * GET  /api/collaboration/workflows the workflow filter's options
 */

export type ResultsFetcher = (path: string, init?: RequestInit) => Promise<Response>;

export type ResultsLoad<T> =
  | { type: 'ok'; value: T }
  | { type: 'unauthorized' }
  | { type: 'forbidden' }
  | { type: 'not_found' }
  | { type: 'failed' };

export interface ResultsWorkflowOption {
  id: string;
  name: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readWorkflow(value: unknown): ResultWorkflow | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') {
    return null;
  }
  return { id: value.id, name: value.name, testRun: value.testRun === true };
}

function readListItem(value: unknown): ResultListItem | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.collaborationRunId !== 'string' ||
    value.collaborationRunId.length === 0 ||
    typeof value.status !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null;
  }
  return {
    collaborationRunId: value.collaborationRunId,
    projectId: typeof value.projectId === 'string' ? value.projectId : '',
    status: value.status,
    createdAt: value.createdAt,
    finishedAt: readText(value.finishedAt),
    teamId: typeof value.teamId === 'string' ? value.teamId : 'coding',
    workflow: readWorkflow(value.workflow),
    task: readText(value.task),
    excerpt: readText(value.excerpt),
    seenAt: readText(value.seenAt),
  };
}

function readCount(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback;
}

/** The D8 body, or null when it is not one. Malformed items are left out. */
export function parseResultsPage(body: unknown): ResultsPage | null {
  if (!isRecord(body) || !Array.isArray(body.results)) {
    return null;
  }
  const results = body.results
    .map((entry) => readListItem(entry))
    .filter((entry): entry is ResultListItem => entry !== null);
  return {
    results,
    page: Math.max(1, readCount(body.page, 1)),
    pageSize: Math.max(1, readCount(body.pageSize, 20)),
    total: readCount(body.total, results.length),
  };
}

function finishedAtOfRun(run: Record<string, unknown>): string | null {
  const status = run.status;
  if (status === 'completed') return readText(run.completedAt) ?? readText(run.updatedAt);
  if (status === 'failed') return readText(run.failedAt) ?? readText(run.updatedAt);
  if (status === 'timed_out' || status === 'cancelled') return readText(run.updatedAt);
  return null;
}

/**
 * D2 (DECISION A): the final answer is the last completed hand-off's answer,
 * with its sources. A failed or timed-out run also shows the last hand-off's
 * failure reason. The task is the first hand-off's prompt.
 */
export function parseResultDetail(body: unknown): ResultDetail | null {
  if (!isRecord(body) || !isRecord(body.run) || !Array.isArray(body.handoffs)) {
    return null;
  }
  const run = body.run;
  if (typeof run.collaborationRunId !== 'string' || typeof run.status !== 'string') {
    return null;
  }
  const handoffs = body.handoffs.filter(isRecord);
  let answerStep: Record<string, unknown> | null = null;
  for (let index = handoffs.length - 1; index >= 0; index -= 1) {
    if (handoffs[index].status === 'completed' && typeof handoffs[index].answer === 'string') {
      answerStep = handoffs[index];
      break;
    }
  }
  const last = handoffs[handoffs.length - 1];
  const stopped = run.status === 'failed' || run.status === 'timed_out';
  const answer = answerStep ? (answerStep.answer as string) : null;
  return {
    collaborationRunId: run.collaborationRunId,
    status: run.status,
    createdAt: typeof run.createdAt === 'string' ? run.createdAt : '',
    finishedAt: finishedAtOfRun(run),
    teamId: typeof body.teamId === 'string' ? body.teamId : 'coding',
    workflow: readWorkflow(body.workflow),
    task: readText(handoffs[0]?.prompt),
    answer: answer !== null && answer.trim().length > 0 ? answer : null,
    sources: answerStep ? readCollaborationSources(answerStep.sources) : [],
    showUnsourced: answerStep?.showUnsourced === true,
    droppedSourceCount: answerStep ? readDroppedSourceCount(answerStep.droppedSourceCount) : 0,
    failureReason: stopped && last ? readText(last.failureReason) : null,
  };
}

function refusal<T>(status: number): ResultsLoad<T> {
  if (status === 401) return { type: 'unauthorized' };
  if (status === 403) return { type: 'forbidden' };
  if (status === 404) return { type: 'not_found' };
  return { type: 'failed' };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function loadResults(
  filters: ResultsFilters,
  page: number,
  fetcher: ResultsFetcher = collaborationFetch,
): Promise<ResultsLoad<ResultsPage>> {
  try {
    const response = await fetcher(`/api/results?${resultsQueryString(filters, page)}`);
    if (!response.ok) {
      return refusal(response.status);
    }
    const parsed = parseResultsPage(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : { type: 'failed' };
  } catch {
    return { type: 'failed' };
  }
}

/** D15: the count, or null on any non-200 or a bad body. The badge then shows nothing. */
export async function loadUnreadCount(fetcher: ResultsFetcher = collaborationFetch): Promise<number | null> {
  try {
    const response = await fetcher('/api/results/unread-count');
    if (response.status !== 200) {
      return null;
    }
    const body = await readJson(response);
    if (!isRecord(body)) {
      return null;
    }
    const count = body.count;
    return typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : null;
  } catch {
    return null;
  }
}

/** D11: the stored first-open time, or null when the mark could not be set. */
export async function markResultSeen(
  collaborationRunId: string,
  fetcher: ResultsFetcher = collaborationFetch,
): Promise<string | null> {
  try {
    const response = await fetcher(`/api/results/${encodeURIComponent(collaborationRunId)}/seen`, {
      method: 'POST',
    });
    if (!response.ok) {
      return null;
    }
    const body = await readJson(response);
    return isRecord(body) ? readText(body.seenAt) : null;
  } catch {
    return null;
  }
}

export async function loadResultDetail(
  collaborationRunId: string,
  fetcher: ResultsFetcher = collaborationFetch,
): Promise<ResultsLoad<ResultDetail>> {
  try {
    const response = await fetcher(`/api/collaboration/runs/${encodeURIComponent(collaborationRunId)}`);
    if (!response.ok) {
      return refusal(response.status);
    }
    const parsed = parseResultDetail(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : { type: 'failed' };
  } catch {
    return { type: 'failed' };
  }
}

/** The workflow filter's options. Any failure leaves the filter with "All runs" only. */
export async function loadResultsWorkflows(
  fetcher: ResultsFetcher = collaborationFetch,
): Promise<ResultsWorkflowOption[]> {
  try {
    const response = await fetcher('/api/collaboration/workflows');
    if (!response.ok) {
      return [];
    }
    return readCollaborationWorkflows(await readJson(response)).map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
    }));
  } catch {
    return [];
  }
}
