import assert from 'node:assert/strict';
import { test } from 'node:test';

import { attemptProjectAutosave } from './project-autosave';

async function withPatchedConsoleError<T>(run: () => Promise<T>): Promise<T> {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    return await run();
  } finally {
    console.error = originalConsoleError;
  }
}

function createSnapshotResponse(): Response {
  return new Response(
    JSON.stringify({
      id: 'snapshot-1',
      userId: 'user-1',
      label: '[project-id:project-1]',
      createdAt: '2026-04-23T00:00:00.000Z',
      fileCount: 3,
    }),
    { status: 200 },
  );
}

test('returns skipped-rate-limited and does not call save when under the default interval', async () => {
  let callCount = 0;
  const fetchImpl = async (): Promise<Response> => {
    callCount += 1;
    return createSnapshotResponse();
  };

  const result = await attemptProjectAutosave({
    token: 'token-1',
    sessionId: 'session-1',
    projectId: 'project-1',
    now: 59_999,
    lastAutosaveAt: 0,
    fetchImpl: fetchImpl as typeof fetch,
  });

  assert.deepEqual(result, { status: 'skipped-rate-limited' });
  assert.equal(callCount, 0);
});

test('returns saved and calls save once with the source-plus-hint project-scoped snapshot label', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    return createSnapshotResponse();
  };

  const result = await attemptProjectAutosave({
    token: 'token-1',
    sessionId: 'session-1',
    projectId: 'project-1',
    source: 'preview',
    hint: 'index.html',
    now: 60_000,
    lastAutosaveAt: 0,
    fetchImpl: fetchImpl as typeof fetch,
  });

  assert.equal(result.status, 'saved');
  assert.deepEqual(result.savedSnapshot, {
    id: 'snapshot-1',
    userId: 'user-1',
    label: '[project-id:project-1]',
    createdAt: '2026-04-23T00:00:00.000Z',
    fileCount: 3,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/sessions/session-1/snapshot');
  assert.equal(calls[0].init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    label: '[project-id:project-1:source:preview:hint:index.html]',
  });
});

test('returns failed when save fetch rejects', async () => {
  const result = await withPatchedConsoleError(() =>
    attemptProjectAutosave({
      token: 'token-1',
      sessionId: 'session-1',
      projectId: 'project-1',
      now: 60_000,
      lastAutosaveAt: 0,
      fetchImpl: (async () => {
        throw new Error('network down');
      }) as typeof fetch,
    }),
  );

  assert.deepEqual(result, { status: 'failed' });
});

test('returns failed when save returns a non-ok response', async () => {
  const result = await withPatchedConsoleError(() =>
    attemptProjectAutosave({
      token: 'token-1',
      sessionId: 'session-1',
      projectId: 'project-1',
      now: 60_000,
      lastAutosaveAt: 0,
      fetchImpl: (async () =>
        new Response(JSON.stringify({ message: 'snapshot failed' }), {
          status: 500,
        })) as typeof fetch,
    }),
  );

  assert.deepEqual(result, { status: 'failed' });
});

test('honors a custom minIntervalMs override', async () => {
  let callCount = 0;
  const fetchImpl = async (): Promise<Response> => {
    callCount += 1;
    return createSnapshotResponse();
  };

  const skippedResult = await attemptProjectAutosave({
    token: 'token-1',
    sessionId: 'session-1',
    projectId: 'project-1',
    now: 9,
    lastAutosaveAt: 0,
    minIntervalMs: 10,
    fetchImpl: fetchImpl as typeof fetch,
  });

  const savedResult = await attemptProjectAutosave({
    token: 'token-1',
    sessionId: 'session-1',
    projectId: 'project-1',
    now: 10,
    lastAutosaveAt: 0,
    minIntervalMs: 10,
    fetchImpl: fetchImpl as typeof fetch,
  });

  assert.deepEqual(skippedResult, { status: 'skipped-rate-limited' });
  assert.equal(savedResult.status, 'saved');
  assert.equal(callCount, 1);
});

test('allows autosave when lastAutosaveAt is null', async () => {
  let callCount = 0;
  const fetchImpl = async (): Promise<Response> => {
    callCount += 1;
    return createSnapshotResponse();
  };

  const result = await attemptProjectAutosave({
    token: 'token-1',
    sessionId: 'session-1',
    projectId: 'project-1',
    now: 0,
    lastAutosaveAt: null,
    fetchImpl: fetchImpl as typeof fetch,
  });

  assert.equal(result.status, 'saved');
  assert.equal(callCount, 1);
});
