import { collaborationFetch } from '@/lib/collaboration/api';
import type { SchedulesFetcher, SchedulesResult } from './schedules-api';
import {
  eventTriggerErrorKey,
  parseEventTrigger,
  parseEventTriggerList,
  parseEventTriggerRuns,
  type EventTriggerItem,
  type EventTriggerList,
  type EventTriggerRequestBody,
  type EventTriggerRun,
} from './event-triggers.logic';

/**
 * TRIGGER-EVENT-01 S4: the "Before a meeting" section's fetch functions. Every
 * call goes through collaborationFetch (credentials: 'include', CSRF header on
 * writes).
 *
 * GET    /api/event-triggers            the owner's triggers, the switches and the calendar state
 * POST   /api/event-triggers            create
 * PATCH  /api/event-triggers/:id        change any non-empty subset
 * DELETE /api/event-triggers/:id        delete
 * GET    /api/event-triggers/:id/runs   the last 30 occurrences
 */

export type EventTriggersFetcher = SchedulesFetcher;
export type EventTriggersResult<T> = SchedulesResult<T>;

function failed<T>(errorKey: string): EventTriggersResult<T> {
  return { type: 'failed', errorKey };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function refusal<T>(response: Response): Promise<EventTriggersResult<T>> {
  if (response.status === 401) return { type: 'unauthorized' };
  if (response.status === 403) return { type: 'forbidden' };
  const body = await readJson(response);
  const code =
    body && typeof body === 'object' && typeof (body as { code?: unknown }).code === 'string'
      ? (body as { code: string }).code
      : null;
  return failed(eventTriggerErrorKey(code));
}

export async function loadEventTriggers(
  fetcher: EventTriggersFetcher = collaborationFetch,
): Promise<EventTriggersResult<EventTriggerList>> {
  try {
    const response = await fetcher('/api/event-triggers');
    if (!response.ok) return refusal(response);
    const parsed = parseEventTriggerList(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}

export async function createEventTrigger(
  body: EventTriggerRequestBody,
  fetcher: EventTriggersFetcher = collaborationFetch,
): Promise<EventTriggersResult<EventTriggerItem>> {
  try {
    const response = await fetcher('/api/event-triggers', { method: 'POST', body: JSON.stringify(body) });
    if (!response.ok) return refusal(response);
    const parsed = parseEventTrigger(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}

export async function updateEventTrigger(
  id: string,
  patch: Partial<EventTriggerRequestBody>,
  fetcher: EventTriggersFetcher = collaborationFetch,
): Promise<EventTriggersResult<EventTriggerItem>> {
  try {
    const response = await fetcher(`/api/event-triggers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (!response.ok) return refusal(response);
    const parsed = parseEventTrigger(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}

export async function deleteEventTrigger(
  id: string,
  fetcher: EventTriggersFetcher = collaborationFetch,
): Promise<EventTriggersResult<null>> {
  try {
    const response = await fetcher(`/api/event-triggers/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) return refusal(response);
    return { type: 'ok', value: null };
  } catch {
    return failed('errors.network');
  }
}

export async function loadEventTriggerRuns(
  id: string,
  fetcher: EventTriggersFetcher = collaborationFetch,
): Promise<EventTriggersResult<EventTriggerRun[]>> {
  try {
    const response = await fetcher(`/api/event-triggers/${encodeURIComponent(id)}/runs`);
    if (!response.ok) return refusal(response);
    const parsed = parseEventTriggerRuns(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}
