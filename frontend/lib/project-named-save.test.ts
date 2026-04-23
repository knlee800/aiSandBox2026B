import assert from 'node:assert/strict';
import { test } from 'node:test';

import { attemptNamedProjectSave } from './project-named-save';

async function withPatchedConsoleError<T>(run: () => Promise<T>): Promise<T> {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    return await run();
  } finally {
    console.error = originalConsoleError;
  }
}

function createSnapshotResponse(label: string): Response {
  return new Response(
    JSON.stringify({
      id: 'snapshot-1',
      userId: 'user-1',
      label,
      createdAt: '2026-04-23T00:00:00.000Z',
      fileCount: 3,
    }),
    { status: 200 },
  );
}

test('returns saved and sends a named project snapshot label for non-blank names', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    return createSnapshotResponse('[project-id:project-1:name:Working draft]');
  };

  const result = await attemptNamedProjectSave({
    token: 'token-1',
    sessionId: 'session-1',
    projectId: 'project-1',
    name: '  Working draft  ',
    fetchImpl: fetchImpl as typeof fetch,
  });

  assert.equal(result.status, 'saved');
  assert.deepEqual(result.savedSnapshot, {
    id: 'snapshot-1',
    userId: 'user-1',
    label: '[project-id:project-1:name:Working draft]',
    createdAt: '2026-04-23T00:00:00.000Z',
    fileCount: 3,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/sessions/session-1/snapshot');
  assert.equal(calls[0].init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    label: '[project-id:project-1:name:Working draft]',
  });
});

test('returns saved and sends the unnamed label shape for whitespace-only names', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    return createSnapshotResponse('[project-id:project-1]');
  };

  const result = await attemptNamedProjectSave({
    token: 'token-1',
    sessionId: 'session-1',
    projectId: 'project-1',
    name: '   ',
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
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    label: '[project-id:project-1]',
  });
});

test('returns failed when save fetch rejects', async () => {
  const result = await withPatchedConsoleError(() =>
    attemptNamedProjectSave({
      token: 'token-1',
      sessionId: 'session-1',
      projectId: 'project-1',
      name: 'Working draft',
      fetchImpl: (async () => {
        throw new Error('network down');
      }) as typeof fetch,
    }),
  );

  assert.deepEqual(result, { status: 'failed' });
});

test('returns failed when save returns a non-ok response', async () => {
  const result = await withPatchedConsoleError(() =>
    attemptNamedProjectSave({
      token: 'token-1',
      sessionId: 'session-1',
      projectId: 'project-1',
      name: 'Working draft',
      fetchImpl: (async () =>
        new Response(JSON.stringify({ message: 'snapshot failed' }), {
          status: 500,
        })) as typeof fetch,
    }),
  );

  assert.deepEqual(result, { status: 'failed' });
});
