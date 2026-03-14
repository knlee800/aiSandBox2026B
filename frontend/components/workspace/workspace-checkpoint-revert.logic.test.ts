import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { revertWorkspaceCheckpoint } from './workspace-checkpoint-revert.logic';

describe('workspace checkpoint revert logic', () => {
  test('posts checkpoint revert with active-session commit hash payload', async () => {
    let url = '';
    let init: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, requestInit) => {
      url = String(input);
      init = requestInit;
      return new Response(null, { status: 200 });
    };

    await revertWorkspaceCheckpoint({
      token: 'token-123',
      sessionId: 'session-abc',
      userId: 'user-xyz',
      commitHash: 'abc123def456',
      fetchImpl,
    });

    assert.equal(url, '/api/git/session-abc/revert');
    assert.equal(init?.method, 'POST');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer token-123');
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
          token: 'token-123',
          sessionId: 'session-abc',
          userId: 'user-xyz',
          commitHash: 'abc123def456',
          fetchImpl,
        }),
      /Checkpoint revert failed \(500\)/,
    );
  });
});
