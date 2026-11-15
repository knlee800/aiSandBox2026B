import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createEventTrigger,
  deleteEventTrigger,
  loadEventTriggerRuns,
  loadEventTriggers,
  updateEventTrigger,
  type EventTriggersFetcher,
} from '@/components/schedules/event-triggers-api';
import { draftToBody, emptyEventDraft } from '@/components/schedules/event-triggers.logic';

interface Call {
  path: string;
  method: string;
  body: unknown;
}

function stub(status: number, payload: unknown): { fetcher: EventTriggersFetcher; calls: Call[] } {
  const calls: Call[] = [];
  const fetcher: EventTriggersFetcher = async (path, init = {}) => {
    calls.push({
      path,
      method: (init.method ?? 'GET').toUpperCase(),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    return new Response(JSON.stringify(payload), { status });
  };
  return { fetcher, calls };
}

const TRIGGER = {
  id: 'e1',
  target: { kind: 'chief-of-staff' },
  task: 'Prepare me',
  leadMinutes: 15,
  titleFilter: null,
  timeZone: 'UTC',
  enabled: true,
  createdAt: 'x',
  updatedAt: 'x',
  lastRun: null,
};

const failing: EventTriggersFetcher = async () => {
  throw new Error('offline');
};

describe('event triggers api', () => {
  test('loadEventTriggers reads the list, the switches and the calendar state', async () => {
    const { fetcher, calls } = stub(200, {
      enabled: true,
      runsEnabled: false,
      limit: 3,
      calendar: { connected: true, state: 'read_failed', stateAt: '2026-11-15T10:00:00.000Z' },
      triggers: [TRIGGER],
    });
    const result = await loadEventTriggers(fetcher);
    assert.equal(result.type, 'ok');
    assert.equal(result.type === 'ok' && result.value.runsEnabled, false);
    assert.equal(result.type === 'ok' && result.value.calendar.state, 'read_failed');
    assert.equal(result.type === 'ok' && result.value.triggers.length, 1);
    assert.deepEqual(calls, [{ path: '/api/event-triggers', method: 'GET', body: undefined }]);
  });

  test('401 and 403 are their own results; every other failure becomes a translated key', async () => {
    assert.deepEqual(await loadEventTriggers(stub(401, {}).fetcher), { type: 'unauthorized' });
    assert.deepEqual(await loadEventTriggers(stub(403, {}).fetcher), { type: 'forbidden' });
    assert.deepEqual(await loadEventTriggers(stub(500, {}).fetcher), { type: 'failed', errorKey: 'errors.generic' });
    assert.deepEqual(await loadEventTriggers(failing), { type: 'failed', errorKey: 'errors.network' });
    assert.deepEqual(await loadEventTriggers(stub(200, { nope: true }).fetcher), {
      type: 'failed',
      errorKey: 'errors.generic',
    });
  });

  test('createEventTrigger posts the body and maps an event_trigger_* code', async () => {
    const draft = draftToBody({ ...emptyEventDraft('UTC'), task: 'Prepare me' });
    assert.ok(draft.ok);
    const ok = stub(201, TRIGGER);
    const created = await createEventTrigger(draft.body, ok.fetcher);
    assert.equal(created.type, 'ok');
    assert.equal(ok.calls[0].method, 'POST');
    assert.equal(ok.calls[0].path, '/api/event-triggers');
    assert.deepEqual(ok.calls[0].body, draft.body);
    const full = stub(409, { statusCode: 409, code: 'event_trigger_limit_reached' });
    assert.deepEqual(await createEventTrigger(draft.body, full.fetcher), {
      type: 'failed',
      errorKey: 'errors.event_trigger_limit_reached',
    });
    assert.deepEqual(await createEventTrigger(draft.body, failing), { type: 'failed', errorKey: 'errors.network' });
  });

  test('updateEventTrigger patches only what is sent and keeps an unknown code generic', async () => {
    const { fetcher, calls } = stub(200, { ...TRIGGER, enabled: false });
    const result = await updateEventTrigger('e 1', { enabled: false }, fetcher);
    assert.equal(result.type === 'ok' && result.value.enabled, false);
    assert.deepEqual(calls, [{ path: '/api/event-triggers/e%201', method: 'PATCH', body: { enabled: false } }]);
    const missing = stub(404, { code: 'event_trigger_not_found' });
    assert.deepEqual(await updateEventTrigger('x', { enabled: true }, missing.fetcher), {
      type: 'failed',
      errorKey: 'errors.event_trigger_not_found',
    });
    const odd = stub(400, { code: 'schedule_invalid_task' });
    assert.deepEqual(await updateEventTrigger('x', { enabled: true }, odd.fetcher), {
      type: 'failed',
      errorKey: 'errors.generic',
    });
  });

  test('deleteEventTrigger uses DELETE', async () => {
    const { fetcher, calls } = stub(200, { id: 'e1', deleted: true });
    assert.deepEqual(await deleteEventTrigger('e1', fetcher), { type: 'ok', value: null });
    assert.deepEqual(calls, [{ path: '/api/event-triggers/e1', method: 'DELETE', body: undefined }]);
    assert.deepEqual(await deleteEventTrigger('e1', failing), { type: 'failed', errorKey: 'errors.network' });
  });

  test('loadEventTriggerRuns reads the history', async () => {
    const { fetcher, calls } = stub(200, {
      runs: [
        {
          id: 'r1',
          eventStart: '2026-11-15T10:00:00.000Z',
          localDate: '2026-11-15',
          outcome: 'skipped',
          reason: 'day_limit',
          collaborationRunId: null,
          at: 'x',
        },
      ],
    });
    const result = await loadEventTriggerRuns('e1', fetcher);
    assert.equal(result.type === 'ok' && result.value[0].reason, 'day_limit');
    assert.equal(calls[0].path, '/api/event-triggers/e1/runs');
    assert.deepEqual(await loadEventTriggerRuns('e1', stub(404, { code: 'event_trigger_not_found' }).fetcher), {
      type: 'failed',
      errorKey: 'errors.event_trigger_not_found',
    });
  });
});
