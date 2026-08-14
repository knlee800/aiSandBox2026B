import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  acquireExecutionApplyGuard,
  applySequentialFileActions,
  isRiskyFileActionBatch,
  isWorkspaceFileAction,
  resolveWorkspaceFileActionErrorCopy,
  type WorkspaceFileAction,
} from './workspace-ai-file-actions.logic';
import {
  WorkspaceFileWriteError,
  WORKSPACE_FILE_WRITE_SESSION_EXPIRED_CODE,
} from './workspace-file-navigation.logic';
import type { WorkspaceShellSession } from './workspace-shell.logic';

const activeSession: WorkspaceShellSession = {
  id: 'session-active',
  projectId: null,
  status: 'active',
  terminatedAt: null,
  terminationReason: null,
};

function createActions(): WorkspaceFileAction[] {
  return [
    {
      action: 'write',
      path: 'src/a.ts',
      content: 'a',
    },
    {
      action: 'write',
      path: 'src/b.ts',
      content: 'b',
    },
  ];
}

describe('workspace ai file-actions logic', () => {
  test('once-only apply guard rejects duplicate execution id', () => {
    const appliedExecutionIds = new Set<string>();
    const firstAcquire = acquireExecutionApplyGuard('exec-1', appliedExecutionIds);
    const secondAcquire = acquireExecutionApplyGuard('exec-1', appliedExecutionIds);

    assert.equal(firstAcquire, true);
    assert.equal(secondAcquire, false);
  });

  test('stream-delivered file actions apply sequentially', async () => {
    const writeCalls: string[] = [];
    const result = await applySequentialFileActions({
      sessionId: 'session-active',
      actions: createActions(),
      getSelectedSessionId: () => 'session-active',
      getSessionById: () => activeSession,
      writeFile: async (action) => {
        writeCalls.push(action.path);
      },
    });

    assert.deepEqual(writeCalls, ['src/a.ts', 'src/b.ts']);
    assert.equal(result.applyStatus, 'applied');
    assert.equal(result.results.length, 2);
    assert.equal(result.results[0].status, 'success');
    assert.equal(result.results[1].status, 'success');
  });

  test('status-poll-delivered file actions apply sequentially', async () => {
    const writeCalls: string[] = [];
    const result = await applySequentialFileActions({
      sessionId: 'session-active',
      actions: createActions(),
      getSelectedSessionId: () => 'session-active',
      getSessionById: () => activeSession,
      writeFile: async (action) => {
        writeCalls.push(action.path);
      },
    });

    assert.deepEqual(writeCalls, ['src/a.ts', 'src/b.ts']);
    assert.equal(result.applyStatus, 'applied');
  });

  test('stale-session guard blocks writes', async () => {
    const writeCalls: string[] = [];
    const result = await applySequentialFileActions({
      sessionId: 'session-active',
      actions: createActions(),
      getSelectedSessionId: () => 'session-other',
      getSessionById: () => activeSession,
      writeFile: async (action) => {
        writeCalls.push(action.path);
      },
    });

    assert.deepEqual(writeCalls, []);
    assert.equal(result.applyStatus, 'skipped');
    assert.equal(result.skipReason, 'stale-session');
    assert.equal(result.results[0].status, 'skipped');
  });

  test('classifies batches with more than three actions as risky', () => {
    const riskyActions: WorkspaceFileAction[] = [
      ...createActions(),
      { action: 'write', path: 'src/c.ts', content: 'c' },
      { action: 'write', path: 'src/d.ts', content: 'd' },
    ];

    assert.equal(isRiskyFileActionBatch(riskyActions), true);
  });

  test('classifies batches with large content as risky', () => {
    const riskyActions: WorkspaceFileAction[] = [
      {
        action: 'write',
        path: 'src/app.ts',
        content: 'x'.repeat(20_001),
      },
    ];

    assert.equal(isRiskyFileActionBatch(riskyActions), true);
  });

  test('classifies obvious config and env targets as risky', () => {
    assert.equal(
      isRiskyFileActionBatch([
        { action: 'write', path: 'package.json', content: '{}' },
      ]),
      true,
    );
    assert.equal(
      isRiskyFileActionBatch([
        { action: 'write', path: '.env.local', content: 'TOKEN=secret' },
      ]),
      true,
    );
  });

  test('always classifies delete actions as risky', () => {
    assert.equal(
      isRiskyFileActionBatch([{ action: 'delete', path: 'src/old.ts' }]),
      true,
    );
  });

  test('keeps small ordinary write batches auto-applicable', () => {
    assert.equal(isRiskyFileActionBatch(createActions()), false);
  });

  test('guard accepts delete without content', () => {
    assert.equal(isWorkspaceFileAction({ action: 'delete', path: 'src/old.ts' }), true);
  });

  test('guard rejects non-delete actions without content', () => {
    assert.equal(isWorkspaceFileAction({ action: 'write', path: 'src/app.ts' }), false);
  });

  test('terminated-session guard blocks writes', async () => {
    const terminatedSession: WorkspaceShellSession = {
      ...activeSession,
      terminatedAt: '2026-04-03T00:00:00.000Z',
      status: 'stopped',
    };
    const writeCalls: string[] = [];
    const result = await applySequentialFileActions({
      sessionId: 'session-active',
      actions: createActions(),
      getSelectedSessionId: () => 'session-active',
      getSessionById: () => terminatedSession,
      writeFile: async (action) => {
        writeCalls.push(action.path);
      },
    });

    assert.deepEqual(writeCalls, []);
    assert.equal(result.applyStatus, 'skipped');
    assert.equal(result.skipReason, 'terminated-session');
  });

  test('sequential writes continue after a per-file failure', async () => {
    const writeCalls: string[] = [];
    const result = await applySequentialFileActions({
      sessionId: 'session-active',
      actions: createActions(),
      getSelectedSessionId: () => 'session-active',
      getSessionById: () => activeSession,
      writeFile: async (action) => {
        writeCalls.push(action.path);
        if (action.path === 'src/a.ts') {
          throw new Error('simulated write error');
        }
      },
    });

    assert.deepEqual(writeCalls, ['src/a.ts', 'src/b.ts']);
    assert.equal(result.applyStatus, 'applied');
    assert.equal(result.results[0].status, 'failed');
    assert.equal(result.results[1].status, 'success');
  });

  test('HTTP 410 write failures mark the action failed with session_expired and do not retry', async () => {
    const writeCalls: string[] = [];
    const result = await applySequentialFileActions({
      sessionId: 'session-active',
      actions: [
        {
          action: 'write',
          path: 'builder-intent-validation.txt',
          content: 'ok',
        },
      ],
      getSelectedSessionId: () => 'session-active',
      getSessionById: () => activeSession,
      writeFile: async (action) => {
        writeCalls.push(action.path);
        throw new WorkspaceFileWriteError({
          kind: 'session_expired',
          status: 410,
          terminationReason: 'idle_timeout',
          message: WORKSPACE_FILE_WRITE_SESSION_EXPIRED_CODE,
        });
      },
    });

    assert.deepEqual(writeCalls, ['builder-intent-validation.txt']);
    assert.equal(result.applyStatus, 'applied');
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].status, 'failed');
    assert.equal(result.results[0].path, 'builder-intent-validation.txt');
    assert.equal(result.results[0].error, WORKSPACE_FILE_WRITE_SESSION_EXPIRED_CODE);
    assert.notEqual(result.results[0].status, 'success');
  });

  test('generic 502 write failures stay generic and do not retry', async () => {
    const writeCalls: string[] = [];
    const result = await applySequentialFileActions({
      sessionId: 'session-active',
      actions: [{ action: 'write', path: 'src/app.ts', content: 'ok' }],
      getSelectedSessionId: () => 'session-active',
      getSessionById: () => activeSession,
      writeFile: async (action) => {
        writeCalls.push(action.path);
        throw new WorkspaceFileWriteError({
          kind: 'generic_write_failure',
          status: 502,
          message: 'File write failed (502)',
        });
      },
    });

    assert.deepEqual(writeCalls, ['src/app.ts']);
    assert.equal(result.results[0].status, 'failed');
    assert.equal(result.results[0].error, 'File write failed (502)');
  });

  test('network write failures stay generic and do not retry', async () => {
    const writeCalls: string[] = [];
    const result = await applySequentialFileActions({
      sessionId: 'session-active',
      actions: [{ action: 'write', path: 'src/app.ts', content: 'ok' }],
      getSelectedSessionId: () => 'session-active',
      getSessionById: () => activeSession,
      writeFile: async (action) => {
        writeCalls.push(action.path);
        throw new WorkspaceFileWriteError({
          kind: 'generic_write_failure',
          status: null,
          message: 'Failed to fetch',
        });
      },
    });

    assert.deepEqual(writeCalls, ['src/app.ts']);
    assert.equal(result.results[0].status, 'failed');
    assert.equal(result.results[0].error, 'Failed to fetch');
  });

  test('resolves session_expired file-action errors to localized copy', () => {
    assert.equal(
      resolveWorkspaceFileActionErrorCopy(
        WORKSPACE_FILE_WRITE_SESSION_EXPIRED_CODE,
        'This workspace session has expired. The file was not saved. Reopen the project before trying again.',
      ),
      'This workspace session has expired. The file was not saved. Reopen the project before trying again.',
    );
    assert.equal(
      resolveWorkspaceFileActionErrorCopy('File write failed (502)', 'expired copy'),
      'File write failed (502)',
    );
    assert.equal(resolveWorkspaceFileActionErrorCopy(null, 'expired copy'), null);
  });
});
