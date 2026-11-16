import { collaborationFetch } from '@/lib/collaboration/api';
import type { SchedulesFetcher, SchedulesResult } from './schedules-api';
import {
  mailTriggerErrorKey,
  parseMailTrigger,
  parseMailTriggerList,
  parseMailTriggerRuns,
  type MailTriggerItem,
  type MailTriggerList,
  type MailTriggerRequestBody,
  type MailTriggerRun,
} from './mail-triggers.logic';

/**
 * TRIGGER-MAIL-01 S4: the "When mail arrives" section's fetch functions. Every
 * call goes through collaborationFetch (credentials: 'include', CSRF header on
 * writes).
 *
 * GET    /api/mail-triggers the owner triggers, the switches and the mailbox state
 * POST   /api/mail-triggers            create
 * PATCH  /api/mail-triggers/:id        change any non-empty subset
 * DELETE /api/mail-triggers/:id        delete
 * GET    /api/mail-triggers/:id/runs   the last 30 occurrences
 */

export type MailTriggersFetcher = SchedulesFetcher;
export type MailTriggersResult<T> = SchedulesResult<T>;

function failed<T>(errorKey: string): MailTriggersResult<T> {
  return { type: 'failed', errorKey };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function refusal<T>(response: Response): Promise<MailTriggersResult<T>> {
  if (response.status === 401) return { type: 'unauthorized' };
  if (response.status === 403) return { type: 'forbidden' };
  const body = await readJson(response);
  const code =
    body && typeof body === 'object' && typeof (body as { code?: unknown }).code === 'string'
      ? (body as { code: string }).code
      : null;
  return failed(mailTriggerErrorKey(code));
}

export async function loadMailTriggers(
  fetcher: MailTriggersFetcher = collaborationFetch,
): Promise<MailTriggersResult<MailTriggerList>> {
  try {
    const response = await fetcher('/api/mail-triggers');
    if (!response.ok) return refusal(response);
    const parsed = parseMailTriggerList(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}

export async function createMailTrigger(
  body: MailTriggerRequestBody,
  fetcher: MailTriggersFetcher = collaborationFetch,
): Promise<MailTriggersResult<MailTriggerItem>> {
  try {
    const response = await fetcher('/api/mail-triggers', { method: 'POST', body: JSON.stringify(body) });
    if (!response.ok) return refusal(response);
    const parsed = parseMailTrigger(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}

export async function updateMailTrigger(
  id: string,
  patch: Partial<MailTriggerRequestBody>,
  fetcher: MailTriggersFetcher = collaborationFetch,
): Promise<MailTriggersResult<MailTriggerItem>> {
  try {
    const response = await fetcher(`/api/mail-triggers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (!response.ok) return refusal(response);
    const parsed = parseMailTrigger(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}

export async function deleteMailTrigger(
  id: string,
  fetcher: MailTriggersFetcher = collaborationFetch,
): Promise<MailTriggersResult<null>> {
  try {
    const response = await fetcher(`/api/mail-triggers/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) return refusal(response);
    return { type: 'ok', value: null };
  } catch {
    return failed('errors.network');
  }
}

export async function loadMailTriggerRuns(
  id: string,
  fetcher: MailTriggersFetcher = collaborationFetch,
): Promise<MailTriggersResult<MailTriggerRun[]>> {
  try {
    const response = await fetcher(`/api/mail-triggers/${encodeURIComponent(id)}/runs`);
    if (!response.ok) return refusal(response);
    const parsed = parseMailTriggerRuns(await readJson(response));
    return parsed ? { type: 'ok', value: parsed } : failed('errors.generic');
  } catch {
    return failed('errors.network');
  }
}
