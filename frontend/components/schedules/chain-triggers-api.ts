import { collaborationFetch } from '@/lib/collaboration/api';
import type { SchedulesFetcher, SchedulesResult } from './schedules-api';
import {
  chainTriggerErrorKey,
  parseChainTrigger,
  parseChainTriggerList,
  parseChainTriggerRuns,
  type ChainTriggerItem,
  type ChainTriggerList,
  type ChainTriggerRequestBody,
  type ChainTriggerRun,
} from './chain-triggers.logic';

/**
 * TRIGGER-CHAIN-01 S3: the "After a workflow finishes" section's fetch
 * functions. Every call goes through collaborationFetch (credentials:
 * 'include', CSRF header on writes).
 *
 * GET    /api/chain-triggers             the owner triggers and the switches
 * POST   /api/chain-triggers             create
 * PATCH  /api/chain-triggers/:id         change any non-empty subset
 * DELETE /api/chain-triggers/:id         delete
 * GET    /api/chain-triggers/:id/runs    the last 30 occurrences
 */

export type ChainTriggersFetcher = SchedulesFetcher;
export type ChainTriggersResult<T> = SchedulesResult<T>;

function failed<T>(errorKey: string): ChainTriggersResult<T> {
  return { type: 'failed', errorKey };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function refusal<T>(response: Response): Promise<ChainTriggersResult<T>> {
  if (response.status === 401) return { type: 'unauthorized' };
  if (response.status === 403) return { type: 'forbidden' };
  const body = await readJson(response);
  const code =
    body && typeof body === 'object' && typeof (body as { code?: unknown }).code === 'string'
      ? (body as { code: string }).code
      : null;
  return failed(chainTriggerErrorKey(code));
}

export async function loadChainTriggers(
  fetcher: ChainTriggersFetcher = collaborationFetch,
): Promise<ChainTriggersResult<ChainTriggerList>> {
  try {
    const response = await fetcher('/api/chain-triggers');
    if (!response.ok) return refusal(response);
    const parsed = parseChainTriggerList(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}

export async function createChainTrigger(
  body: ChainTriggerRequestBody,
  fetcher: ChainTriggersFetcher = collaborationFetch,
): Promise<ChainTriggersResult<ChainTriggerItem>> {
  try {
    const response = await fetcher('/api/chain-triggers', { method: 'POST', body: JSON.stringify(body) });
    if (!response.ok) return refusal(response);
    const parsed = parseChainTrigger(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}

export async function updateChainTrigger(
  id: string,
  patch: Partial<ChainTriggerRequestBody>,
  fetcher: ChainTriggersFetcher = collaborationFetch,
): Promise<ChainTriggersResult<ChainTriggerItem>> {
  try {
    const response = await fetcher(`/api/chain-triggers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (!response.ok) return refusal(response);
    const parsed = parseChainTrigger(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}

export async function deleteChainTrigger(
  id: string,
  fetcher: ChainTriggersFetcher = collaborationFetch,
): Promise<ChainTriggersResult<null>> {
  try {
    const response = await fetcher(`/api/chain-triggers/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) return refusal(response);
    return { type: 'ok', value: null };
  } catch {
    return failed('errors.network');
  }
}

export async function loadChainTriggerRuns(
  id: string,
  fetcher: ChainTriggersFetcher = collaborationFetch,
): Promise<ChainTriggersResult<ChainTriggerRun[]>> {
  try {
    const response = await fetcher(`/api/chain-triggers/${encodeURIComponent(id)}/runs`);
    if (!response.ok) return refusal(response);
    const parsed = parseChainTriggerRuns(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}
