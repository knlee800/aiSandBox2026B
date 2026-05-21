import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { revertWorkspaceCheckpoint } from './workspace-checkpoint-revert.logic';

describe('workspace checkpoint revert logic', () => {
  test('posts checkpoint revert to sessions endpoint with active-session commit hash payload', async () => {
    let url = '';
    let init: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, requestInit) => {
      url = String(input);
      init = requestInit;
      return new Response(null, { status: 200 });
    };

    await revertWorkspaceCheckpoint({
      sessionId: 'session-abc',
      userId: 'user-xyz',
      commitHash: 'abc123def456',
      fetchImpl,
    });

    assert.equal(url, '/api/sessions/session-abc/revert');
    assert.equal(init?.method, 'POST');
    assert.equal((init?.headers as Record<string, string>)['Content-Type'], 'application/json');
    assert.equal(
      init?.body,
      JSON.stringify({
        userId: 'user-xyz',
        commitHash: 'abc123def456',
      }),
    );
  });

  test('throws when checkpoint revert request fails', async () => {
    const fetchImpl: typeof fetch = async () => new Response(null, { status: 500 });

    await assert.rejects(
      () =>
        revertWorkspaceCheckpoint({
          sessionId: 'session-abc',
          userId: 'user-xyz',
          commitHash: 'abc123def456',
          fetchImpl,
        }),
      /Checkpoint revert failed \(500\)/,
    );
  });
});
