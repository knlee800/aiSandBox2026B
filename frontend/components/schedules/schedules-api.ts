import { collaborationFetch } from '@/lib/collaboration/api';
import { loadResultsWorkflows } from '@/components/results/results-api';
import {
  parseSchedule,
  parseScheduleRuns,
  parseSchedulesList,
  scheduleErrorKey,
  type ScheduleItem,
  type ScheduleRequestBody,
  type ScheduleRun,
  type SchedulesList,
  type WorkflowOption,
} from './schedules.logic';

/**
 * TRIGGER-UI-01: the Schedules page's fetch functions. Every call goes through
 * collaborationFetch (credentials: 'include', CSRF header on writes).
 *
 * GET    /api/schedules             the owner's schedules and the switches
 * POST   /api/schedules             create
 * PATCH  /api/schedules/:id         change any non-empty subset
 * DELETE /api/schedules/:id         delete
 * GET    /api/schedules/:id/runs    the last 30 occurrences
 * GET    /api/collaboration/workflows (through loadResultsWorkflows): the target picker
 */

export type SchedulesFetcher = (path: string, init?: RequestInit) => Promise<Response>;

export type SchedulesResult<T> =
  | { type: 'ok'; value: T }
  | { type: 'unauthorized' }
  | { type: 'forbidden' }
  | { type: 'failed'; errorKey: string };

function failed<T>(errorKey: string): SchedulesResult<T> {
  return { type: 'failed', errorKey };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function refusal<T>(response: Response): Promise<SchedulesResult<T>> {
  if (response.status === 401) return { type: 'unauthorized' };
  if (response.status === 403) return { type: 'forbidden' };
  const body = await readJson(response);
  const code =
    body && typeof body === 'object' && typeof (body as { code?: unknown }).code === 'string'
      ? (body as { code: string }).code
      : null;
  return failed(scheduleErrorKey(code));
}

export async function loadSchedules(
  fetcher: SchedulesFetcher = collaborationFetch,
): Promise<SchedulesResult<SchedulesList>> {
  try {
    const response = await fetcher('/api/schedules');
    if (!response.ok) return refusal(response);
    const parsed = parseSchedulesList(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}

export async function createSchedule(
  body: ScheduleRequestBody,
  fetcher: SchedulesFetcher = collaborationFetch,
): Promise<SchedulesResult<ScheduleItem>> {
  try {
    const response = await fetcher('/api/schedules', { method: 'POST', body: JSON.stringify(body) });
    if (!response.ok) return refusal(response);
    const parsed = parseSchedule(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}

export async function updateSchedule(
  id: string,
  patch: Partial<ScheduleRequestBody>,
  fetcher: SchedulesFetcher = collaborationFetch,
): Promise<SchedulesResult<ScheduleItem>> {
  try {
    const response = await fetcher(`/api/schedules/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (!response.ok) return refusal(response);
    const parsed = parseSchedule(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}

export async function deleteSchedule(
  id: string,
  fetcher: SchedulesFetcher = collaborationFetch,
): Promise<SchedulesResult<null>> {
  try {
    const response = await fetcher(`/api/schedules/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) return refusal(response);
    return { type: 'ok', value: null };
  } catch {
    return failed('errors.network');
  }
}

export async function loadScheduleRuns(
  id: string,
  fetcher: SchedulesFetcher = collaborationFetch,
): Promise<SchedulesResult<ScheduleRun[]>> {
  try {
    const response = await fetcher(`/api/schedules/${encodeURIComponent(id)}/runs`);
    if (!response.ok) return refusal(response);
    const parsed = parseScheduleRuns(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}

/** The existing workflow list (read-only). Any failure leaves the Chief of Staff only. */
export async function loadWorkflowOptions(
  fetcher: SchedulesFetcher = collaborationFetch,
): Promise<WorkflowOption[]> {
  return loadResultsWorkflows(fetcher);
}
