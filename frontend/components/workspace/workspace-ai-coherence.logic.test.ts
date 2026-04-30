import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  acquireExecutionCoherenceGuard,
  runAiActionCoherence,
} from './workspace-ai-coherence.logic';
import type { WorkspaceExecutionFileActionState } from './workspace-ai-file-actions.logic';

function buildAppliedState(
  overrides: Partial<WorkspaceExecutionFileActionState> = {},
): WorkspaceExecutionFileActionState {
  return {
    executionId: 'exec-1',
    source: 'status',
    fileActions: [{ action: 'write', path: 'src/app.ts', content: 'next' }],
    applyStatus: 'applied',
    confirmationRequired: false,
    skipReason: null,
    results: [{ action: 'write', path: 'src/app.ts', status: 'success', error: null }],
    ...overrides,
  };
}

describe('workspace ai coherence logic', () => {
  test('runs deterministic coherence sequence after applied AI file actions', async () => {
    const calls: string[] = [];

    const result = await runAiActionCoherence({
      executionId: 'exec-1',
      fileActionState: buildAppliedState(),
      selectedSessionId: 'session-1',
      executionSessionId: 'session-1',
      isExecutionSessionUsable: true,
      selectedFilePath: 'src/app.ts',
      checkpointDescription: 'AI: applied workspace file actions',
      refreshFileTree: async () => {
        calls.push('tree');
      },
      reloadEditorFile: async (filePath) => {
        calls.push(`editor:${filePath}`);
      },
      refreshPreview: async () => {
        calls.push('preview');
      },
      createCheckpoint: async (description) => {
        calls.push(`checkpoint:${description}`);
        return { commitHash: 'abc123' };
      },
      refreshCheckpoints: async () => {
        calls.push('checkpoint-list');
      },
    });

    assert.deepEqual(calls, [
      'tree',
      'editor:src/app.ts',
      'preview',
      'checkpoint:AI: applied workspace file actions',
      'checkpoint-list',
    ]);
    assert.equal(result.ran, true);
    assert.equal(result.activeFileReloaded, true);
    assert.equal(result.checkpointCreated, true);
  });

  test('reloads editor only when selected file was affected', async () => {
    const calls: string[] = [];
    await runAiActionCoherence({
      executionId: 'exec-2',
      fileActionState: buildAppliedState({
        results: [{ action: 'write', path: 'src/other.ts', status: 'success', error: null }],
      }),
      selectedSessionId: 'session-1',
      executionSessionId: 'session-1',
      isExecutionSessionUsable: true,
      selectedFilePath: 'src/app.ts',
      checkpointDescription: 'AI: applied workspace file actions',
      refreshFileTree: async () => {
        calls.push('tree');
      },
      reloadEditorFile: async () => {
        calls.push('editor');
      },
      refreshPreview: async () => {
        calls.push('preview');
      },
      createCheckpoint: async () => ({ commitHash: 'abc123' }),
      refreshCheckpoints: async () => {
        calls.push('checkpoint-list');
      },
    });

    assert.equal(calls.includes('editor'), false);
  });

  test('does not run coherence for skipped or failed apply status', async () => {
    const skipped = await runAiActionCoherence({
      executionId: 'exec-3',
      fileActionState: buildAppliedState({
        applyStatus: 'skipped',
        skipReason: 'stale-session',
      }),
      selectedSessionId: 'session-1',
      executionSessionId: 'session-1',
      isExecutionSessionUsable: true,
      selectedFilePath: 'src/app.ts',
      checkpointDescription: 'AI: applied workspace file actions',
      refreshFileTree: async () => {},
      reloadEditorFile: async () => {},
      refreshPreview: async () => {},
      createCheckpoint: async () => ({ commitHash: 'abc123' }),
      refreshCheckpoints: async () => {},
    });
    assert.equal(skipped.ran, false);
    assert.equal(skipped.skippedReason, 'not-applied');

    const pending = await runAiActionCoherence({
      executionId: 'exec-4',
      fileActionState: buildAppliedState({
        applyStatus: 'pending',
      }),
      selectedSessionId: 'session-1',
      executionSessionId: 'session-1',
      isExecutionSessionUsable: true,
      selectedFilePath: 'src/app.ts',
      checkpointDescription: 'AI: applied workspace file actions',
      refreshFileTree: async () => {},
      reloadEditorFile: async () => {},
      refreshPreview: async () => {},
      createCheckpoint: async () => ({ commitHash: 'abc123' }),
      refreshCheckpoints: async () => {},
    });
    assert.equal(pending.ran, false);
    assert.equal(pending.skippedReason, 'not-applied');
  });

  test('checkpoint creation failure does not block tree/editor/preview sequence', async () => {
    const calls: string[] = [];
    const result = await runAiActionCoherence({
      executionId: 'exec-5',
      fileActionState: buildAppliedState(),
      selectedSessionId: 'session-1',
      executionSessionId: 'session-1',
      isExecutionSessionUsable: true,
      selectedFilePath: 'src/app.ts',
      checkpointDescription: 'AI: applied workspace file actions',
      refreshFileTree: async () => {
        calls.push('tree');
      },
      reloadEditorFile: async () => {
        calls.push('editor');
      },
      refreshPreview: async () => {
        calls.push('preview');
      },
      createCheckpoint: async () => {
        calls.push('checkpoint');
        throw new Error('failed');
      },
      refreshCheckpoints: async () => {
        calls.push('checkpoint-list');
      },
    });

    assert.deepEqual(calls, ['tree', 'editor', 'preview', 'checkpoint']);
    assert.equal(result.ran, true);
    assert.equal(result.checkpointCreated, false);
  });

  test('does not run coherence when no file writes succeeded', async () => {
    const result = await runAiActionCoherence({
      executionId: 'exec-7',
      fileActionState: buildAppliedState({
        results: [{ action: 'write', path: 'src/app.ts', status: 'failed', error: 'write failed' }],
      }),
      selectedSessionId: 'session-1',
      executionSessionId: 'session-1',
      isExecutionSessionUsable: true,
      selectedFilePath: 'src/app.ts',
      checkpointDescription: 'AI: applied workspace file actions',
      refreshFileTree: async () => {},
      reloadEditorFile: async () => {},
      refreshPreview: async () => {},
      createCheckpoint: async () => ({ commitHash: 'abc123' }),
      refreshCheckpoints: async () => {},
    });

    assert.equal(result.ran, false);
    assert.equal(result.skippedReason, 'no-successful-writes');
  });

  test('checkpoint list refresh runs only after successful checkpoint creation', async () => {
    const calls: string[] = [];
    await runAiActionCoherence({
      executionId: 'exec-6',
      fileActionState: buildAppliedState(),
      selectedSessionId: 'session-1',
      executionSessionId: 'session-1',
      isExecutionSessionUsable: true,
      selectedFilePath: null,
      checkpointDescription: 'AI: applied workspace file actions',
      refreshFileTree: async () => {},
      reloadEditorFile: async () => {},
      refreshPreview: async () => {},
      createCheckpoint: async () => {
        calls.push('checkpoint');
        return { commitHash: null };
      },
      refreshCheckpoints: async () => {
        calls.push('checkpoint-list');
      },
    });
    assert.deepEqual(calls, ['checkpoint']);
  });

  test('coherence guard prevents duplicate run for same execution id', () => {
    const executionIds = new Set<string>();
    assert.equal(acquireExecutionCoherenceGuard('exec-dup', executionIds), true);
    assert.equal(acquireExecutionCoherenceGuard('exec-dup', executionIds), false);
  });
});
