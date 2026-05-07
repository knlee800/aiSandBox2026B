import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createWorkspaceCheckpoint } from './workspace-checkpoint-create.logic';

describe('workspace checkpoint create logic', () => {
  test('posts manual checkpoint commit with minimal payload when description is empty', async () => {
    let url = '';
    let init: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, requestInit) => {
      url = String(input);
      init = requestInit;
      return new Response(null, { status: 200 });
    };

    await createWorkspaceCheckpoint({
      sessionId: 'session-abc',
      userId: 'user-xyz',
      description: '   ',
      fetchImpl,
    });

    assert.equal(url, '/api/sessions/session-abc/checkpoints');
    assert.equal(init?.method, 'POST');
    assert.equal((init?.headers as Record<string, string>)['Content-Type'], 'application/json');
    assert.equal(init?.body, JSON.stringify({ userId: 'user-xyz', messageNumber: 0 }));
  });

  test('includes optional description when provided', async () => {
    let body = '';
    const fetchImpl: typeof fetch = async (_input, requestInit) => {
      body = String(requestInit?.body ?? '');
      return new Response(null, { status: 200 });
    };

    await createWorkspaceCheckpoint({
      sessionId: 'session-abc',
      userId: 'user-xyz',
      description: 'Save point before risky change',
      fetchImpl,
    });

    assert.equal(
      body,
      JSON.stringify({
        userId: 'user-xyz',
        messageNumber: 0,
        description: 'Save point before risky change',
      }),
    );
  });

  test('throws when checkpoint create request fails', async () => {
    const fetchImpl: typeof fetch = async () => new Response(null, { status: 500 });

    await assert.rejects(
      () =>
        createWorkspaceCheckpoint({
          sessionId: 'session-abc',
          userId: 'user-xyz',
          fetchImpl,
        }),
      /Checkpoint create failed \(500\)/,
    );
  });
});
