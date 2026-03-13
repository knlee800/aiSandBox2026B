import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { refreshPostExecSurfaces } from './workspace-post-exec.logic';

describe('workspace post-exec refresh logic', () => {
  test('triggers all refresh actions after successful exec response', async () => {
    const calls: string[] = [];

    const wasRefreshed = await refreshPostExecSurfaces({
      execState: {
        status: 'result',
        result: {
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
        },
      },
      refreshCheckpoints: async () => {
        calls.push('checkpoints');
      },
      refreshSessions: async () => {
        calls.push('sessions');
      },
      refreshDashboard: async () => {
        calls.push('dashboard');
      },
    });

    assert.equal(wasRefreshed, true);
    assert.equal(calls.includes('checkpoints'), true);
    assert.equal(calls.includes('sessions'), true);
    assert.equal(calls.includes('dashboard'), true);
    assert.equal(calls.length, 3);
  });

  test('does not trigger refresh actions when exec is not successful', async () => {
    const calls: string[] = [];

    const wasRefreshed = await refreshPostExecSurfaces({
      execState: {
        status: 'network-error',
        result: null,
      },
      refreshCheckpoints: async () => {
        calls.push('checkpoints');
      },
      refreshSessions: async () => {
        calls.push('sessions');
      },
      refreshDashboard: async () => {
        calls.push('dashboard');
      },
    });

    assert.equal(wasRefreshed, false);
    assert.equal(calls.length, 0);
  });
});
