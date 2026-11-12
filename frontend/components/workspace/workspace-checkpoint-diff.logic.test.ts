import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  formatWorkspaceCheckpointDiffLimit,
  getWorkspaceCheckpointDiffTruncation,
  loadWorkspaceCheckpointDiff,
} from './workspace-checkpoint-diff.logic';

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

  test('CM-DIFF-NOTICE-01: a whole diff has no truncated or diffLimitBytes', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({ commitHash: 'abc123', parentHash: null, files: [] }),
        { status: 200 },
      );

    const result = await loadWorkspaceCheckpointDiff({
      sessionId: 'session-abc',
      commitHash: 'abc123',
      fetchImpl,
    });

    assert.deepEqual(result, { commitHash: 'abc123', parentHash: null, files: [] });
    assert.deepEqual(getWorkspaceCheckpointDiffTruncation(result), {
      truncated: false,
      diffLimitBytes: null,
    });
  });

  test('CM-DIFF-NOTICE-01: a cut diff keeps truncated and diffLimitBytes', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          commitHash: 'abc123',
          parentHash: 'def456',
          files: [{ path: 'big.txt', status: 'added', diff: '+x' }],
          truncated: true,
          diffLimitBytes: 8388608,
        }),
        { status: 200 },
      );

    const result = await loadWorkspaceCheckpointDiff({
      sessionId: 'session-abc',
      commitHash: 'abc123',
      fetchImpl,
    });

    assert.equal(result.truncated, true);
    assert.equal(result.diffLimitBytes, 8388608);
    assert.equal(result.files.length, 1);
    assert.deepEqual(getWorkspaceCheckpointDiffTruncation(result), {
      truncated: true,
      diffLimitBytes: 8388608,
    });
  });

  test('CM-DIFF-NOTICE-01: the loader drops a stray or invalid diffLimitBytes', async () => {
    const respond = (body: unknown): typeof fetch => async () =>
      new Response(JSON.stringify(body), { status: 200 });
    const base = { commitHash: 'abc123', parentHash: null, files: [] };

    const notCut = await loadWorkspaceCheckpointDiff({
      sessionId: 's',
      commitHash: 'abc123',
      fetchImpl: respond({ ...base, truncated: false, diffLimitBytes: 8388608 }),
    });
    assert.deepEqual(notCut, base);

    const cutNoLimit = await loadWorkspaceCheckpointDiff({
      sessionId: 's',
      commitHash: 'abc123',
      fetchImpl: respond({ ...base, truncated: true, diffLimitBytes: '8388608' }),
    });
    assert.deepEqual(cutNoLimit, { ...base, truncated: true });
  });

  test('CM-DIFF-NOTICE-01: getWorkspaceCheckpointDiffTruncation defaults', () => {
    const whole = { truncated: false, diffLimitBytes: null };
    assert.deepEqual(getWorkspaceCheckpointDiffTruncation(null), whole);
    assert.deepEqual(getWorkspaceCheckpointDiffTruncation(undefined), whole);
    assert.deepEqual(getWorkspaceCheckpointDiffTruncation({}), whole);
    assert.deepEqual(getWorkspaceCheckpointDiffTruncation({ truncated: 'true' }), whole);
    assert.deepEqual(
      getWorkspaceCheckpointDiffTruncation({ truncated: false, diffLimitBytes: 8388608 }),
      whole,
    );
    assert.deepEqual(getWorkspaceCheckpointDiffTruncation({ truncated: true }), {
      truncated: true,
      diffLimitBytes: null,
    });
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, '8388608', null]) {
      assert.deepEqual(
        getWorkspaceCheckpointDiffTruncation({ truncated: true, diffLimitBytes: bad }),
        { truncated: true, diffLimitBytes: null },
      );
    }
  });

  test('CM-DIFF-NOTICE-01: formats the limit as a readable size', () => {
    assert.equal(formatWorkspaceCheckpointDiffLimit(8 * 1024 * 1024), '8 MB');
    assert.equal(formatWorkspaceCheckpointDiffLimit(1024 * 1024), '1 MB');
    assert.equal(formatWorkspaceCheckpointDiffLimit(1.5 * 1024 * 1024), '1.5 MB');
    assert.equal(formatWorkspaceCheckpointDiffLimit(500 * 1024), '500 KB');
    assert.equal(formatWorkspaceCheckpointDiffLimit(1), '1 KB');
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
