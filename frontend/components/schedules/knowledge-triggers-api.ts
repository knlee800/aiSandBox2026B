import { collaborationFetch } from '@/lib/collaboration/api';
import type { SchedulesFetcher, SchedulesResult } from './schedules-api';
import {
  knowledgeTriggerErrorKey,
  parseKnowledgeTrigger,
  parseKnowledgeTriggerList,
  parseKnowledgeTriggerRuns,
  type KnowledgeTriggerItem,
  type KnowledgeTriggerList,
  type KnowledgeTriggerRequestBody,
  type KnowledgeTriggerRun,
} from './knowledge-triggers.logic';

/**
 * TRIGGER-MORE-01 S3: the "When a file is added" section's fetch functions. Every
 * call goes through collaborationFetch (credentials: 'include', CSRF header on
 * writes).
 *
 * GET    /api/knowledge-triggers the owner triggers and the switches
 * POST   /api/knowledge-triggers            create
 * PATCH  /api/knowledge-triggers/:id        change any non-empty subset
 * DELETE /api/knowledge-triggers/:id        delete
 * GET    /api/knowledge-triggers/:id/runs   the last 30 occurrences
 */

export type KnowledgeTriggersFetcher = SchedulesFetcher;
export type KnowledgeTriggersResult<T> = SchedulesResult<T>;

function failed<T>(errorKey: string): KnowledgeTriggersResult<T> {
  return { type: 'failed', errorKey };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function refusal<T>(response: Response): Promise<KnowledgeTriggersResult<T>> {
  if (response.status === 401) return { type: 'unauthorized' };
  if (response.status === 403) return { type: 'forbidden' };
  const body = await readJson(response);
  const code =
    body && typeof body === 'object' && typeof (body as { code?: unknown }).code === 'string'
      ? (body as { code: string }).code
      : null;
  return failed(knowledgeTriggerErrorKey(code));
}

export async function loadKnowledgeTriggers(
  fetcher: KnowledgeTriggersFetcher = collaborationFetch,
): Promise<KnowledgeTriggersResult<KnowledgeTriggerList>> {
  try {
    const response = await fetcher('/api/knowledge-triggers');
    if (!response.ok) return refusal(response);
    const parsed = parseKnowledgeTriggerList(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}

export async function createKnowledgeTrigger(
  body: KnowledgeTriggerRequestBody,
  fetcher: KnowledgeTriggersFetcher = collaborationFetch,
): Promise<KnowledgeTriggersResult<KnowledgeTriggerItem>> {
  try {
    const response = await fetcher('/api/knowledge-triggers', { method: 'POST', body: JSON.stringify(body) });
    if (!response.ok) return refusal(response);
    const parsed = parseKnowledgeTrigger(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}

export async function updateKnowledgeTrigger(
  id: string,
  patch: Partial<KnowledgeTriggerRequestBody>,
  fetcher: KnowledgeTriggersFetcher = collaborationFetch,
): Promise<KnowledgeTriggersResult<KnowledgeTriggerItem>> {
  try {
    const response = await fetcher(`/api/knowledge-triggers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (!response.ok) return refusal(response);
    const parsed = parseKnowledgeTrigger(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}

export async function deleteKnowledgeTrigger(
  id: string,
  fetcher: KnowledgeTriggersFetcher = collaborationFetch,
): Promise<KnowledgeTriggersResult<null>> {
  try {
    const response = await fetcher(`/api/knowledge-triggers/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) return refusal(response);
    return { type: 'ok', value: null };
  } catch {
    return failed('errors.network');
  }
}

export async function loadKnowledgeTriggerRuns(
  id: string,
  fetcher: KnowledgeTriggersFetcher = collaborationFetch,
): Promise<KnowledgeTriggersResult<KnowledgeTriggerRun[]>> {
  try {
    const response = await fetcher(`/api/knowledge-triggers/${encodeURIComponent(id)}/runs`);
    if (!response.ok) return refusal(response);
    const parsed = parseKnowledgeTriggerRuns(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}
