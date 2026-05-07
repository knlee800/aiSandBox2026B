import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { loadWorkspaceCheckpointDiff } from './workspace-checkpoint-diff.logic';

describe('workspace checkpoint diff logic', () => {
  test('loads checkpoint diff from existing session checkpoint diff endpoint', async () => {
    let url = '';
    let init: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, requestInit) => {
      url = String(input);
      init = requestInit;
      return new Response(
        JSON.stringify({
          commitHash: 'abc123',
          parentHash: 'def456',
          files: [
            {
              path: 'src/app.ts',
              status: 'modified',
              diff: '@@ -1 +1 @@\n-console.log("old")\n+console.log("new")',
            },
          ],
        }),
        { status: 200 },
      );
    };

    const result = await loadWorkspaceCheckpointDiff({
      sessionId: 'session-abc',
      commitHash: 'abc123',
      fetchImpl,
    });

    assert.equal(url, '/api/sessions/session-abc/checkpoints/abc123/diff');
    assert.equal(init?.method, 'GET');
    assert.equal(result.commitHash, 'abc123');
    assert.equal(result.parentHash, 'def456');
    assert.equal(result.files.length, 1);
    assert.equal(result.files[0].path, 'src/app.ts');
    assert.equal(result.files[0].status, 'modified');
  });

  test('throws when checkpoint diff request fails', async () => {
    const fetchImpl: typeof fetch = async () => new Response(null, { status: 500 });

    await assert.rejects(
      () =>
        loadWorkspaceCheckpointDiff({
          sessionId: 'session-abc',
          commitHash: 'abc123',
          fetchImpl,
        }),
      /Checkpoint diff load failed \(500\)/,
    );
  });
});
