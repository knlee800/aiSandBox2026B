import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createSchedule,
  deleteSchedule,
  loadScheduleRuns,
  loadSchedules,
  loadWorkflowOptions,
  updateSchedule,
  type SchedulesFetcher,
} from '@/components/schedules/schedules-api';
import { emptyDraft, draftToBody } from '@/components/schedules/schedules.logic';

interface Call {
  path: string;
  method: string;
  body: unknown;
}

function stub(status: number, payload: unknown): { fetcher: SchedulesFetcher; calls: Call[] } {
  const calls: Call[] = [];
  const fetcher: SchedulesFetcher = async (path, init = {}) => {
    calls.push({
      path,
      method: (init.method ?? 'GET').toUpperCase(),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    return new Response(JSON.stringify(payload), { status });
  };
  return { fetcher, calls };
}

const SCHEDULE = {
  id: 's1',
  target: { kind: 'chief-of-staff' },
  task: 'Brief me',
  timeOfDay: '09:00',
  days: [1, 2],
  timeZone: 'UTC',
  enabled: true,
  lastRun: null,
};

const failing: SchedulesFetcher = async () => {
  throw new Error('offline');
};

describe('schedules api', () => {
  test('loadSchedules reads the list and the switches', async () => {
    const { fetcher, calls } = stub(200, { enabled: true, runsEnabled: false, limit: 5, schedules: [SCHEDULE] });
    const result = await loadSchedules(fetcher);
    assert.equal(result.type, 'ok');
    assert.equal(result.type === 'ok' && result.value.runsEnabled, false);
    assert.equal(result.type === 'ok' && result.value.schedules.length, 1);
    assert.deepEqual(calls, [{ path: '/api/schedules', method: 'GET', body: undefined }]);
  });

  test('401 and 403 are their own results and other codes become translated keys', async () => {
    assert.deepEqual(await loadSchedules(stub(401, {}).fetcher), { type: 'unauthorized' });
    assert.deepEqual(await loadSchedules(stub(403, {}).fetcher), { type: 'forbidden' });
    assert.deepEqual(await loadSchedules(stub(500, {}).fetcher), { type: 'failed', errorKey: 'errors.generic' });
    assert.deepEqual(await loadSchedules(failing), { type: 'failed', errorKey: 'errors.network' });
    assert.deepEqual(await loadSchedules(stub(200, { nope: true }).fetcher), { type: 'failed', errorKey: 'errors.generic' });
  });

  test('createSchedule posts the body and maps a schedule_* code', async () => {
    const draft = draftToBody({ ...emptyDraft('UTC'), task: 'Brief me' });
    assert.ok(draft.ok);
    const ok = stub(201, SCHEDULE);
    const created = await createSchedule(draft.body, ok.fetcher);
    assert.equal(created.type, 'ok');
    assert.equal(ok.calls[0].method, 'POST');
    assert.deepEqual(ok.calls[0].body, draft.body);
    const full = stub(409, { statusCode: 409, code: 'schedule_limit_reached', limit: 5 });
    assert.deepEqual(await createSchedule(draft.body, full.fetcher), {
      type: 'failed',
      errorKey: 'errors.schedule_limit_reached',
    });
    assert.deepEqual(await createSchedule(draft.body, failing), { type: 'failed', errorKey: 'errors.network' });
  });

  test('updateSchedule patches only what is sent', async () => {
    const { fetcher, calls } = stub(200, { ...SCHEDULE, enabled: false });
    const result = await updateSchedule('s 1', { enabled: false }, fetcher);
    assert.equal(result.type === 'ok' && result.value.enabled, false);
    assert.deepEqual(calls, [{ path: '/api/schedules/s%201', method: 'PATCH', body: { enabled: false } }]);
    const missing = stub(404, { code: 'schedule_not_found' });
    assert.deepEqual(await updateSchedule('x', { enabled: true }, missing.fetcher), {
      type: 'failed',
      errorKey: 'errors.schedule_not_found',
    });
  });

  test('deleteSchedule uses DELETE', async () => {
    const { fetcher, calls } = stub(200, { id: 's1', deleted: true });
    assert.deepEqual(await deleteSchedule('s1', fetcher), { type: 'ok', value: null });
    assert.deepEqual(calls, [{ path: '/api/schedules/s1', method: 'DELETE', body: undefined }]);
    assert.deepEqual(await deleteSchedule('s1', failing), { type: 'failed', errorKey: 'errors.network' });
  });

  test('loadScheduleRuns reads the history', async () => {
    const { fetcher, calls } = stub(200, {
      runs: [{ id: 'r1', localDate: '2026-11-14', outcome: 'skipped', reason: 'runs_off', collaborationRunId: null, at: 'x' }],
    });
    const result = await loadScheduleRuns('s1', fetcher);
    assert.equal(result.type === 'ok' && result.value[0].reason, 'runs_off');
    assert.equal(calls[0].path, '/api/schedules/s1/runs');
    assert.deepEqual(await loadScheduleRuns('s1', stub(404, { code: 'schedule_not_found' }).fetcher), {
      type: 'failed',
      errorKey: 'errors.schedule_not_found',
    });
  });

  test('loadWorkflowOptions reuses the workflow list and falls back to empty', async () => {
    const { fetcher, calls } = stub(200, { workflows: [{ id: 'w1', name: 'Digest', role: 'r', status: 'enabled' }] });
    assert.deepEqual(await loadWorkflowOptions(fetcher), [{ id: 'w1', name: 'Digest', status: 'disabled' }]);
    assert.equal(calls[0].path, '/api/collaboration/workflows');
    assert.deepEqual(await loadWorkflowOptions(failing), []);
  });
});
