import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createChainTrigger,
  deleteChainTrigger,
  loadChainTriggerRuns,
  loadChainTriggers,
  updateChainTrigger,
  type ChainTriggersFetcher,
} from '@/components/schedules/chain-triggers-api';
import { draftToBody, emptyChainDraft } from '@/components/schedules/chain-triggers.logic';

interface Call {
  path: string;
  method: string;
  body: unknown;
}

function stub(status: number, payload: unknown): { fetcher: ChainTriggersFetcher; calls: Call[] } {
  const calls: Call[] = [];
  const fetcher: ChainTriggersFetcher = async (path, init = {}) => {
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
  id: 'c1',
  sourceWorkflowId: 'wA',
  target: { kind: 'chief-of-staff' },
  task: 'Prepare me',
  timeZone: 'UTC',
  enabled: true,
  createdAt: 'x',
  updatedAt: 'x',
  lastRun: null,
};

const failing: ChainTriggersFetcher = async () => {
  throw new Error('offline');
};

describe('chain triggers api', () => {
  test('loadChainTriggers reads the list and the three switches', async () => {
    const { fetcher, calls } = stub(200, {
      enabled: true,
      runsEnabled: true,
      resultToolEnabled: false,
      limit: 3,
      triggers: [TRIGGER],
    });
    const result = await loadChainTriggers(fetcher);
    assert.equal(result.type, 'ok');
    assert.equal(result.type === 'ok' && result.value.resultToolEnabled, false);
    assert.equal(result.type === 'ok' && result.value.triggers[0].sourceWorkflowId, 'wA');
    assert.equal(result.type === 'ok' && result.value.triggers.length, 1);
    assert.deepEqual(calls, [{ path: '/api/chain-triggers', method: 'GET', body: undefined }]);
  });

  test('401 and 403 are their own results; every other failure becomes a translated key', async () => {
    assert.deepEqual(await loadChainTriggers(stub(401, {}).fetcher), { type: 'unauthorized' });
    assert.deepEqual(await loadChainTriggers(stub(403, {}).fetcher), { type: 'forbidden' });
    assert.deepEqual(await loadChainTriggers(stub(500, {}).fetcher), { type: 'failed', errorKey: 'errors.generic' });
    assert.deepEqual(await loadChainTriggers(failing), { type: 'failed', errorKey: 'errors.network' });
    assert.deepEqual(await loadChainTriggers(stub(200, { nope: true }).fetcher), {
      type: 'failed',
      errorKey: 'errors.generic',
    });
  });

  test('createChainTrigger posts the body and maps a chain_trigger_* code', async () => {
    const draft = draftToBody({ ...emptyChainDraft('UTC'), sourceId: 'wA', task: 'Prepare me' });
    assert.ok(draft.ok);
    const ok = stub(201, TRIGGER);
    const created = await createChainTrigger(draft.body, ok.fetcher);
    assert.equal(created.type, 'ok');
    assert.equal(ok.calls[0].method, 'POST');
    assert.equal(ok.calls[0].path, '/api/chain-triggers');
    assert.deepEqual(ok.calls[0].body, draft.body);
    assert.equal((ok.calls[0].body as { sourceWorkflowId: string }).sourceWorkflowId, 'wA');
    const full = stub(409, { statusCode: 409, code: 'chain_trigger_limit_reached' });
    assert.deepEqual(await createChainTrigger(draft.body, full.fetcher), {
      type: 'failed',
      errorKey: 'errors.chain_trigger_limit_reached',
    });
    const loop = stub(409, { statusCode: 409, code: 'chain_trigger_cycle' });
    assert.deepEqual(await createChainTrigger(draft.body, loop.fetcher), {
      type: 'failed',
      errorKey: 'errors.chain_trigger_cycle',
    });
    assert.deepEqual(await createChainTrigger(draft.body, failing), { type: 'failed', errorKey: 'errors.network' });
  });

  test('updateChainTrigger patches only what is sent and keeps an unknown code generic', async () => {
    const { fetcher, calls } = stub(200, { ...TRIGGER, enabled: false });
    const result = await updateChainTrigger('c 1', { enabled: false }, fetcher);
    assert.equal(result.type === 'ok' && result.value.enabled, false);
    assert.deepEqual(calls, [{ path: '/api/chain-triggers/c%201', method: 'PATCH', body: { enabled: false } }]);
    const missing = stub(404, { code: 'chain_trigger_not_found' });
    assert.deepEqual(await updateChainTrigger('x', { enabled: true }, missing.fetcher), {
      type: 'failed',
      errorKey: 'errors.chain_trigger_not_found',
    });
    const odd = stub(400, { code: 'knowledge_trigger_invalid_task' });
    assert.deepEqual(await updateChainTrigger('x', { enabled: true }, odd.fetcher), {
      type: 'failed',
      errorKey: 'errors.generic',
    });
  });

  test('CHAIN-SOURCE-OFF-01: the list, a save and a switch-on carry the source view; absent, it reads as null', async () => {
    const off = { workflowId: 'wA', name: 'Researcher', status: 'disabled' };
    const listed = await loadChainTriggers(
      stub(200, {
        enabled: true,
        runsEnabled: true,
        resultToolEnabled: true,
        limit: 3,
        triggers: [
          { ...TRIGGER, source: off },
          { ...TRIGGER, id: 'c2', sourceWorkflowId: 'wD', source: { workflowId: 'wD', name: 'Drafted', status: 'draft' } },
          { ...TRIGGER, id: 'c3', sourceWorkflowId: 'wG', source: { workflowId: 'wG', name: null, status: 'missing' } },
          { ...TRIGGER, id: 'c4' },
        ],
      }).fetcher,
    );
    assert.equal(listed.type, 'ok');
    const triggers = listed.type === 'ok' ? listed.value.triggers : [];
    assert.deepEqual(
      triggers.map((trigger) => trigger.source),
      [
        { workflowId: 'wA', name: 'Researcher', status: 'disabled' },
        { workflowId: 'wD', name: 'Drafted', status: 'draft' },
        { workflowId: 'wG', name: null, status: 'missing' },
        null,
      ],
    );
    // sourceWorkflowId is still read as before.
    assert.deepEqual(
      triggers.map((trigger) => trigger.sourceWorkflowId),
      ['wA', 'wD', 'wG', 'wA'],
    );

    // A save with a switched-off source is an ordinary 201 (warn, not refuse).
    const draft = draftToBody({ ...emptyChainDraft('UTC'), sourceId: 'wA', task: 'Prepare me' });
    assert.ok(draft.ok);
    const created = await createChainTrigger(draft.body, stub(201, { ...TRIGGER, source: off }).fetcher);
    assert.equal(created.type === 'ok' && created.value.source?.status, 'disabled');

    // A switch-on with a switched-off source is an ordinary 200.
    const { fetcher, calls } = stub(200, { ...TRIGGER, enabled: true, source: off });
    const on = await updateChainTrigger('c1', { enabled: true }, fetcher);
    assert.equal(on.type, 'ok');
    assert.equal(on.type === 'ok' && on.value.enabled, true);
    assert.deepEqual(on.type === 'ok' && on.value.source, { workflowId: 'wA', name: 'Researcher', status: 'disabled' });
    assert.deepEqual(calls, [{ path: '/api/chain-triggers/c1', method: 'PATCH', body: { enabled: true } }]);
  });

  test('deleteChainTrigger uses DELETE', async () => {
    const { fetcher, calls } = stub(200, { id: 'c1', deleted: true });
    assert.deepEqual(await deleteChainTrigger('c1', fetcher), { type: 'ok', value: null });
    assert.deepEqual(calls, [{ path: '/api/chain-triggers/c1', method: 'DELETE', body: undefined }]);
    assert.deepEqual(await deleteChainTrigger('c1', failing), { type: 'failed', errorKey: 'errors.network' });
  });

  test('loadChainTriggerRuns reads the history with the depth', async () => {
    const { fetcher, calls } = stub(200, {
      runs: [
        {
          id: 'r1',
          sourceRunId: 'run-1',
          sourceCompletedAt: '2026-11-16T10:00:00.000Z',
          localDate: '2026-11-16',
          depth: 3,
          outcome: 'skipped',
          reason: 'chain_depth',
          collaborationRunId: null,
          at: 'x',
        },
      ],
    });
    const result = await loadChainTriggerRuns('c1', fetcher);
    assert.equal(result.type === 'ok' && result.value[0].reason, 'chain_depth');
    assert.equal(result.type === 'ok' && result.value[0].depth, 3);
    assert.equal(calls[0].path, '/api/chain-triggers/c1/runs');
    assert.deepEqual(await loadChainTriggerRuns('c1', stub(404, { code: 'chain_trigger_not_found' }).fetcher), {
      type: 'failed',
      errorKey: 'errors.chain_trigger_not_found',
    });
  });
});
