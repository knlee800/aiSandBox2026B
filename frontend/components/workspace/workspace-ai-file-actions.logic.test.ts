import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  acquireExecutionApplyGuard,
  applySequentialFileActions,
  isRiskyFileActionBatch,
  type WorkspaceFileAction,
} from './workspace-ai-file-actions.logic';
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

  test('keeps small ordinary write batches auto-applicable', () => {
    assert.equal(isRiskyFileActionBatch(createActions()), false);
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
});
