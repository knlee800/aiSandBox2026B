import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createKnowledgeTrigger,
  deleteKnowledgeTrigger,
  loadKnowledgeTriggerRuns,
  loadKnowledgeTriggers,
  updateKnowledgeTrigger,
  type KnowledgeTriggersFetcher,
} from '@/components/schedules/knowledge-triggers-api';
import { draftToBody, emptyKnowledgeDraft } from '@/components/schedules/knowledge-triggers.logic';

interface Call {
  path: string;
  method: string;
  body: unknown;
}

function stub(status: number, payload: unknown): { fetcher: KnowledgeTriggersFetcher; calls: Call[] } {
  const calls: Call[] = [];
  const fetcher: KnowledgeTriggersFetcher = async (path, init = {}) => {
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
  scopeId: 'policies',
  timeZone: 'UTC',
  enabled: true,
  createdAt: 'x',
  updatedAt: 'x',
  lastRun: null,
};

const failing: KnowledgeTriggersFetcher = async () => {
  throw new Error('offline');
};

describe('knowledge triggers api', () => {
  test('loadKnowledgeTriggers reads the list and the switches', async () => {
    const { fetcher, calls } = stub(200, {
      enabled: true,
      runsEnabled: false,
      limit: 3,
      triggers: [TRIGGER],
    });
    const result = await loadKnowledgeTriggers(fetcher);
    assert.equal(result.type, 'ok');
    assert.equal(result.type === 'ok' && result.value.runsEnabled, false);
    assert.equal(result.type === 'ok' && result.value.triggers[0].scopeId, 'policies');
    assert.equal(result.type === 'ok' && result.value.triggers.length, 1);
    assert.deepEqual(calls, [{ path: '/api/knowledge-triggers', method: 'GET', body: undefined }]);
  });

  test('401 and 403 are their own results; every other failure becomes a translated key', async () => {
    assert.deepEqual(await loadKnowledgeTriggers(stub(401, {}).fetcher), { type: 'unauthorized' });
    assert.deepEqual(await loadKnowledgeTriggers(stub(403, {}).fetcher), { type: 'forbidden' });
    assert.deepEqual(await loadKnowledgeTriggers(stub(500, {}).fetcher), { type: 'failed', errorKey: 'errors.generic' });
    assert.deepEqual(await loadKnowledgeTriggers(failing), { type: 'failed', errorKey: 'errors.network' });
    assert.deepEqual(await loadKnowledgeTriggers(stub(200, { nope: true }).fetcher), {
      type: 'failed',
      errorKey: 'errors.generic',
    });
  });

  test('createKnowledgeTrigger posts the body and maps an knowledge_trigger_* code', async () => {
    const draft = draftToBody({ ...emptyKnowledgeDraft('UTC'), task: 'Prepare me', scopeId: 'policies' });
    assert.ok(draft.ok);
    const ok = stub(201, TRIGGER);
    const created = await createKnowledgeTrigger(draft.body, ok.fetcher);
    assert.equal(created.type, 'ok');
    assert.equal(ok.calls[0].method, 'POST');
    assert.equal(ok.calls[0].path, '/api/knowledge-triggers');
    assert.deepEqual(ok.calls[0].body, draft.body);
    assert.equal((ok.calls[0].body as { scopeId: string }).scopeId, 'policies');
    const full = stub(409, { statusCode: 409, code: 'knowledge_trigger_limit_reached' });
    assert.deepEqual(await createKnowledgeTrigger(draft.body, full.fetcher), {
      type: 'failed',
      errorKey: 'errors.knowledge_trigger_limit_reached',
    });
    assert.deepEqual(await createKnowledgeTrigger(draft.body, failing), { type: 'failed', errorKey: 'errors.network' });
  });

  test('updateKnowledgeTrigger patches only what is sent and keeps an unknown code generic', async () => {
    const { fetcher, calls } = stub(200, { ...TRIGGER, enabled: false });
    const result = await updateKnowledgeTrigger('e 1', { enabled: false }, fetcher);
    assert.equal(result.type === 'ok' && result.value.enabled, false);
    assert.deepEqual(calls, [{ path: '/api/knowledge-triggers/e%201', method: 'PATCH', body: { enabled: false } }]);
    const missing = stub(404, { code: 'knowledge_trigger_not_found' });
    assert.deepEqual(await updateKnowledgeTrigger('x', { enabled: true }, missing.fetcher), {
      type: 'failed',
      errorKey: 'errors.knowledge_trigger_not_found',
    });
    const odd = stub(400, { code: 'event_trigger_invalid_task' });
    assert.deepEqual(await updateKnowledgeTrigger('x', { enabled: true }, odd.fetcher), {
      type: 'failed',
      errorKey: 'errors.generic',
    });
  });

  test('deleteKnowledgeTrigger uses DELETE', async () => {
    const { fetcher, calls } = stub(200, { id: 'e1', deleted: true });
    assert.deepEqual(await deleteKnowledgeTrigger('e1', fetcher), { type: 'ok', value: null });
    assert.deepEqual(calls, [{ path: '/api/knowledge-triggers/e1', method: 'DELETE', body: undefined }]);
    assert.deepEqual(await deleteKnowledgeTrigger('e1', failing), { type: 'failed', errorKey: 'errors.network' });
  });

  test('loadKnowledgeTriggerRuns reads the history', async () => {
    const { fetcher, calls } = stub(200, {
      runs: [
        {
          id: 'r1',
          changedAt: '2026-11-15T10:00:00.000Z',
          localDate: '2026-11-15',
          outcome: 'skipped',
          reason: 'day_limit',
          collaborationRunId: null,
          at: 'x',
        },
      ],
    });
    const result = await loadKnowledgeTriggerRuns('e1', fetcher);
    assert.equal(result.type === 'ok' && result.value[0].reason, 'day_limit');
    assert.equal(calls[0].path, '/api/knowledge-triggers/e1/runs');
    assert.deepEqual(await loadKnowledgeTriggerRuns('e1', stub(404, { code: 'knowledge_trigger_not_found' }).fetcher), {
      type: 'failed',
      errorKey: 'errors.knowledge_trigger_not_found',
    });
  });
});
