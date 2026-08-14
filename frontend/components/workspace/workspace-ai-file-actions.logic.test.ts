import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  acquireExecutionApplyGuard,
  applySequentialFileActions,
  buildConfirmBuildApplyRequestUrl,
  confirmBuildApplyIfQualifying,
  qualifyBuildApplyConfirmation,
  requestBuildApplyConfirmation,
  isRiskyFileActionBatch,
  isWorkspaceFileAction,
  resolveWorkspaceFileActionErrorCopy,
  type ApplySequentialFileActionsResult,
  type WorkspaceFileAction,
} from './workspace-ai-file-actions.logic';
import { shouldApplyFileActionsForExecutionIntent } from './workspace-execution-intent.logic';
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

function buildAppliedSuccessResult(
  paths: string[],
): ApplySequentialFileActionsResult {
  return {
    applyStatus: 'applied',
    skipReason: null,
    results: paths.map((path) => ({
      action: 'write' as const,
      path,
      status: 'success' as const,
      error: null,
    })),
  };
}

describe('PRIVATE-BETA-BLOCKER-03D-B build apply confirmation qualification', () => {
  test('one-action full success qualifies with counts from the apply result', () => {
    const payload = qualifyBuildApplyConfirmation(
      buildAppliedSuccessResult(['src/a.ts']),
    );

    assert.deepEqual(payload, {
      applyStatus: 'applied',
      totalActions: 1,
      successCount: 1,
    });
  });

  test('multi-action full success qualifies with counts from the apply result', () => {
    const payload = qualifyBuildApplyConfirmation(
      buildAppliedSuccessResult(['src/a.ts', 'src/b.ts', 'src/c.ts']),
    );

    assert.deepEqual(payload, {
      applyStatus: 'applied',
      totalActions: 3,
      successCount: 3,
    });
  });

  test('first action failure does not qualify', () => {
    assert.equal(
      qualifyBuildApplyConfirmation({
        applyStatus: 'applied',
        skipReason: null,
        results: [
          {
            action: 'write',
            path: 'src/a.ts',
            status: 'failed',
            error: 'simulated write error',
          },
          {
            action: 'write',
            path: 'src/b.ts',
            status: 'skipped',
            error: 'stale-session',
          },
        ],
      }),
      null,
    );
  });

  test('partial apply does not qualify', () => {
    assert.equal(
      qualifyBuildApplyConfirmation({
        applyStatus: 'applied',
        skipReason: null,
        results: [
          {
            action: 'write',
            path: 'src/a.ts',
            status: 'success',
            error: null,
          },
          {
            action: 'write',
            path: 'src/b.ts',
            status: 'failed',
            error: 'simulated write error',
          },
        ],
      }),
      null,
    );
  });

  test('skipped apply does not qualify', () => {
    assert.equal(
      qualifyBuildApplyConfirmation({
        applyStatus: 'skipped',
        skipReason: 'stale-session',
        results: [
          {
            action: 'write',
            path: 'src/a.ts',
            status: 'skipped',
            error: 'stale-session',
          },
        ],
      }),
      null,
    );
  });

  test('zero actions does not qualify even when applyStatus is applied', () => {
    assert.equal(
      qualifyBuildApplyConfirmation({
        applyStatus: 'applied',
        skipReason: null,
        results: [],
      }),
      null,
    );
  });

  test('session-expired apply does not qualify', () => {
    assert.equal(
      qualifyBuildApplyConfirmation({
        applyStatus: 'applied',
        skipReason: null,
        results: [
          {
            action: 'write',
            path: 'src/app.ts',
            status: 'failed',
            error: WORKSPACE_FILE_WRITE_SESSION_EXPIRED_CODE,
          },
        ],
      }),
      null,
    );
  });

  test('file-write/network failure does not qualify', () => {
    assert.equal(
      qualifyBuildApplyConfirmation({
        applyStatus: 'applied',
        skipReason: null,
        results: [
          {
            action: 'write',
            path: 'src/app.ts',
            status: 'failed',
            error: 'Failed to fetch',
          },
        ],
      }),
      null,
    );
  });
});

describe('PRIVATE-BETA-BLOCKER-03D-B confirm-build-apply trigger', () => {
  test('one-action full success confirms exactly once with that executionId', async () => {
    const confirmations: Array<{ executionId: string; payload: unknown }> = [];
    const status = await confirmBuildApplyIfQualifying({
      executionId: 'exec-one',
      applyResult: buildAppliedSuccessResult(['src/a.ts']),
      confirmBuildApply: async (input) => {
        confirmations.push(input);
      },
    });

    assert.equal(status, 'confirmed');
    assert.equal(confirmations.length, 1);
    assert.equal(confirmations[0]?.executionId, 'exec-one');
    assert.deepEqual(confirmations[0]?.payload, {
      applyStatus: 'applied',
      totalActions: 1,
      successCount: 1,
    });
  });

  test('multi-action full success confirms exactly once with derived counts', async () => {
    const confirmations: Array<{ executionId: string; payload: unknown }> = [];
    const status = await confirmBuildApplyIfQualifying({
      executionId: 'exec-multi',
      applyResult: buildAppliedSuccessResult(['src/a.ts', 'src/b.ts']),
      confirmBuildApply: async (input) => {
        confirmations.push(input);
      },
    });

    assert.equal(status, 'confirmed');
    assert.equal(confirmations.length, 1);
    assert.equal(confirmations[0]?.executionId, 'exec-multi');
    assert.deepEqual(confirmations[0]?.payload, {
      applyStatus: 'applied',
      totalActions: 2,
      successCount: 2,
    });
  });

  test('first-action failure, partial, skipped, zero, session-expired, and network failure send zero confirmations', async () => {
    const confirmations: unknown[] = [];
    const confirmBuildApply = async () => {
      confirmations.push('called');
    };

    const skippedResults = await Promise.all([
      confirmBuildApplyIfQualifying({
        executionId: 'exec-first-fail',
        applyResult: {
          applyStatus: 'applied',
          skipReason: null,
          results: [
            {
              action: 'write',
              path: 'src/a.ts',
              status: 'failed',
              error: 'simulated write error',
            },
          ],
        },
        confirmBuildApply,
      }),
      confirmBuildApplyIfQualifying({
        executionId: 'exec-partial',
        applyResult: {
          applyStatus: 'applied',
          skipReason: null,
          results: [
            {
              action: 'write',
              path: 'src/a.ts',
              status: 'success',
              error: null,
            },
            {
              action: 'write',
              path: 'src/b.ts',
              status: 'failed',
              error: 'simulated write error',
            },
          ],
        },
        confirmBuildApply,
      }),
      confirmBuildApplyIfQualifying({
        executionId: 'exec-skipped',
        applyResult: {
          applyStatus: 'skipped',
          skipReason: 'inactive-session',
          results: [
            {
              action: 'write',
              path: 'src/a.ts',
              status: 'skipped',
              error: 'inactive-session',
            },
          ],
        },
        confirmBuildApply,
      }),
      confirmBuildApplyIfQualifying({
        executionId: 'exec-zero',
        applyResult: { applyStatus: 'applied', skipReason: null, results: [] },
        confirmBuildApply,
      }),
      confirmBuildApplyIfQualifying({
        executionId: 'exec-expired',
        applyResult: {
          applyStatus: 'applied',
          skipReason: null,
          results: [
            {
              action: 'write',
              path: 'src/app.ts',
              status: 'failed',
              error: WORKSPACE_FILE_WRITE_SESSION_EXPIRED_CODE,
            },
          ],
        },
        confirmBuildApply,
      }),
      confirmBuildApplyIfQualifying({
        executionId: 'exec-network',
        applyResult: {
          applyStatus: 'applied',
          skipReason: null,
          results: [
            {
              action: 'write',
              path: 'src/app.ts',
              status: 'failed',
              error: 'Failed to fetch',
            },
          ],
        },
        confirmBuildApply,
      }),
    ]);

    assert.deepEqual(skippedResults, [
      'skipped',
      'skipped',
      'skipped',
      'skipped',
      'skipped',
      'skipped',
    ]);
    assert.equal(confirmations.length, 0);
  });

  test('Ask/conversation executions never send Build confirmation', async () => {
    const confirmations: unknown[] = [];
    assert.equal(shouldApplyFileActionsForExecutionIntent('conversation'), false);

    const status = await confirmBuildApplyIfQualifying({
      executionId: 'exec-ask',
      applyResult: {
        applyStatus: 'skipped',
        skipReason: 'conversation-intent',
        results: [],
      },
      confirmBuildApply: async () => {
        confirmations.push('called');
      },
    });

    assert.equal(status, 'skipped');
    assert.equal(confirmations.length, 0);
  });

  test('confirmation HTTP failure does not retry confirmation or re-apply workspace files', async () => {
    const appliedExecutionIds = new Set<string>();
    const writeCalls: string[] = [];
    assert.equal(acquireExecutionApplyGuard('exec-confirm-fail', appliedExecutionIds), true);

    const applyResult = await applySequentialFileActions({
      sessionId: 'session-active',
      actions: [{ action: 'write', path: 'src/app.ts', content: 'ok' }],
      getSelectedSessionId: () => 'session-active',
      getSessionById: () => activeSession,
      writeFile: async (action) => {
        writeCalls.push(action.path);
      },
    });

    let confirmCalls = 0;
    const status = await confirmBuildApplyIfQualifying({
      executionId: 'exec-confirm-fail',
      applyResult,
      confirmBuildApply: async () => {
        confirmCalls += 1;
        throw new Error('confirmation network failure');
      },
    });

    assert.equal(status, 'confirmation-failed');
    assert.equal(confirmCalls, 1);
    assert.deepEqual(writeCalls, ['src/app.ts']);
    assert.equal(applyResult.applyStatus, 'applied');
    assert.equal(applyResult.results[0]?.status, 'success');
    assert.equal(acquireExecutionApplyGuard('exec-confirm-fail', appliedExecutionIds), false);
    assert.deepEqual(writeCalls, ['src/app.ts']);
  });

  test('confirmation failure does not roll back successful workspace files', async () => {
    const writeCalls: string[] = [];
    const applyResult = await applySequentialFileActions({
      sessionId: 'session-active',
      actions: createActions(),
      getSelectedSessionId: () => 'session-active',
      getSessionById: () => activeSession,
      writeFile: async (action) => {
        writeCalls.push(action.path);
      },
    });

    await confirmBuildApplyIfQualifying({
      executionId: 'exec-no-rollback',
      applyResult,
      confirmBuildApply: async () => {
        throw new Error('confirmation HTTP 502');
      },
    });

    assert.deepEqual(writeCalls, ['src/a.ts', 'src/b.ts']);
    assert.equal(applyResult.applyStatus, 'applied');
    assert.equal(
      applyResult.results.every((result) => result.status === 'success'),
      true,
    );
  });

  test('requestBuildApplyConfirmation posts only the apply-result payload', async () => {
    const originalFetch = globalThis.fetch;
    const fetchCalls: Array<{ url: string; init: RequestInit | undefined }> = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init });
      return new Response(JSON.stringify({ triggered: true, reason: 'deducted' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    try {
      await requestBuildApplyConfirmation({
        executionId: 'exec-payload',
        payload: {
          applyStatus: 'applied',
          totalActions: 2,
          successCount: 2,
        },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(fetchCalls.length, 1);
    assert.equal(
      fetchCalls[0]?.url,
      buildConfirmBuildApplyRequestUrl('exec-payload'),
    );
    assert.equal(fetchCalls[0]?.init?.method, 'POST');
    assert.equal(
      fetchCalls[0]?.init?.body,
      JSON.stringify({
        applyStatus: 'applied',
        totalActions: 2,
        successCount: 2,
      }),
    );
    const body = JSON.parse(String(fetchCalls[0]?.init?.body)) as Record<string, unknown>;
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'executionIntent'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'tokensUsed'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'creditAmount'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'balance'), false);
  });

  test('client confirmation URL does not target the internal Gateway endpoint', () => {
    assert.equal(
      buildConfirmBuildApplyRequestUrl('exec-1'),
      '/api/ai/executions/exec-1/confirm-build-apply',
    );
    assert.equal(
      buildConfirmBuildApplyRequestUrl('exec-1').includes('/api/internal/'),
      false,
    );
  });

  test('client apply logic never contains the internal service key', () => {
    const logicSource = readFileSync(
      new URL('./workspace-ai-file-actions.logic.ts', import.meta.url),
      'utf8',
    );
    assert.doesNotMatch(logicSource, /INTERNAL_SERVICE_KEY/);
    assert.doesNotMatch(logicSource, /X-Internal-Service-Key/);
    assert.doesNotMatch(logicSource, /NEXT_PUBLIC_INTERNAL_SERVICE_KEY/);
  });

  test('page source confirms only after applySequentialFileActions and preserves apply-once plus coherence', () => {
    const pageSource = readFileSync(
      new URL('../../app/[locale]/app/page.tsx', import.meta.url),
      'utf8',
    );

    const applyFnIndex = pageSource.indexOf('async function applyExecutionFileActions(');
    const maybeApplyIndex = pageSource.indexOf(
      'async function maybeApplyExecutionFileActions(',
    );
    assert.ok(applyFnIndex >= 0);
    assert.ok(maybeApplyIndex > applyFnIndex);
    const applyFnSlice = pageSource.slice(applyFnIndex, maybeApplyIndex);

    const guardIndex = applyFnSlice.indexOf(
      'if (!acquireExecutionApplyGuard(executionId, appliedFileActionsExecutionIdsRef.current))',
    );
    const sequentialApplyIndex = applyFnSlice.indexOf(
      'const applyResult = await applySequentialFileActions({',
    );
    const setStateIndex = applyFnSlice.indexOf('setExecutionFileActionState(executionId, {');
    const confirmIndex = applyFnSlice.indexOf('await confirmBuildApplyIfQualifying({');

    assert.ok(guardIndex >= 0);
    assert.ok(sequentialApplyIndex > guardIndex);
    assert.ok(setStateIndex > sequentialApplyIndex);
    assert.ok(confirmIndex > setStateIndex);
    assert.equal((applyFnSlice.match(/applySequentialFileActions\(/g) ?? []).length, 1);
    assert.equal((applyFnSlice.match(/confirmBuildApplyIfQualifying\(/g) ?? []).length, 1);
    assert.match(applyFnSlice, /confirmBuildApply: requestBuildApplyConfirmation/);
    assert.doesNotMatch(applyFnSlice, /INTERNAL_SERVICE_KEY/);
    assert.doesNotMatch(applyFnSlice, /X-Internal-Service-Key/);
    assert.doesNotMatch(applyFnSlice, /\/api\/internal\/executions\//);

    const conversationSkipSlice = pageSource.slice(
      pageSource.indexOf('if (!shouldApplyFileActionsForExecutionIntent(executionIntent))'),
      pageSource.indexOf(
        'const existingFileActions = executionFileActionsByExecutionIdRef.current[executionId]',
      ),
    );
    assert.match(conversationSkipSlice, /skipReason: 'conversation-intent'/);
    assert.doesNotMatch(conversationSkipSlice, /confirmBuildApplyIfQualifying/);

    assert.match(
      pageSource,
      /void \(async \(\) => \{\s+for \(const executionId of executionIds\) \{\s+await maybeRunExecutionCoherence\(executionId\);/,
    );
    assert.doesNotMatch(pageSource, /NEXT_PUBLIC_INTERNAL_SERVICE_KEY/);
    assert.doesNotMatch(pageSource, /INTERNAL_SERVICE_KEY/);
    assert.doesNotMatch(pageSource, /X-Internal-Service-Key/);
    assert.doesNotMatch(pageSource, /build-apply-confirm-proxy\.server/);
  });
});
