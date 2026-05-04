import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseStoredChatThreadMessages } from './workspace-chat-thread.logic';

describe('workspace chat thread logic', () => {
  test('parses legacy persisted thread messages without file-action state', () => {
    const raw = JSON.stringify([
      {
        id: 'm1',
        role: 'assistant',
        content: 'Legacy assistant response',
      },
    ]);

    const parsed = parseStoredChatThreadMessages(raw);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].id, 'm1');
    assert.equal(parsed[0].content, 'Legacy assistant response');
    assert.equal(parsed[0].fileActionState, undefined);
  });

  test('parses persisted assistant message with file-action state', () => {
    const raw = JSON.stringify([
      {
        id: 'm2',
        role: 'assistant',
        content: 'Updated files.',
        executionId: 'exec-1',
        fileActionState: {
          executionId: 'exec-1',
          source: 'status',
          fileActions: [{ action: 'write', path: 'src/a.ts', content: 'a' }],
          applyStatus: 'applied',
          confirmationRequired: false,
          skipReason: null,
          results: [{ action: 'write', path: 'src/a.ts', status: 'success', error: null }],
        },
      },
    ]);

    const parsed = parseStoredChatThreadMessages(raw);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].executionId, 'exec-1');
    assert.equal(parsed[0].fileActionState?.applyStatus, 'applied');
    assert.equal(parsed[0].fileActionState?.confirmationRequired, false);
    assert.equal(parsed[0].fileActionState?.results[0].status, 'success');
  });

  test('sanitizes restored awaiting-confirmation file-action state', () => {
    const raw = JSON.stringify([
      {
        id: 'm-awaiting',
        role: 'assistant',
        content: 'Pending approval.',
        executionId: 'exec-awaiting',
        fileActionState: {
          executionId: 'exec-awaiting',
          source: 'status',
          fileActions: [{ action: 'delete', path: 'delete-test.html' }],
          applyStatus: 'awaiting-confirmation',
          confirmationRequired: true,
          skipReason: null,
          results: [],
        },
      },
    ]);

    const parsed = parseStoredChatThreadMessages(raw);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].fileActionState?.applyStatus, 'skipped');
    assert.equal(parsed[0].fileActionState?.skipReason, 'session-restored');
    assert.equal(parsed[0].fileActionState?.confirmationRequired, false);
  });

  test('preserves restored skipped file-action state', () => {
    const raw = JSON.stringify([
      {
        id: 'm-skipped',
        role: 'assistant',
        content: 'Skipped action.',
        executionId: 'exec-skipped',
        fileActionState: {
          executionId: 'exec-skipped',
          source: 'status',
          fileActions: [{ action: 'delete', path: 'old-file.html' }],
          applyStatus: 'skipped',
          confirmationRequired: false,
          skipReason: 'user-cancelled',
          results: [],
        },
      },
    ]);

    const parsed = parseStoredChatThreadMessages(raw);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].fileActionState?.applyStatus, 'skipped');
    assert.equal(parsed[0].fileActionState?.skipReason, 'user-cancelled');
    assert.equal(parsed[0].fileActionState?.confirmationRequired, false);
  });

  test('preserves restored failed file-action state', () => {
    const raw = JSON.stringify([
      {
        id: 'm-failed',
        role: 'assistant',
        content: 'Delete failed.',
        executionId: 'exec-failed',
        fileActionState: {
          executionId: 'exec-failed',
          source: 'status',
          fileActions: [{ action: 'delete', path: 'missing.html' }],
          applyStatus: 'applied',
          confirmationRequired: false,
          skipReason: null,
          results: [
            {
              action: 'delete',
              path: 'missing.html',
              status: 'failed',
              error: 'File not found: missing.html',
            },
          ],
        },
      },
    ]);

    const parsed = parseStoredChatThreadMessages(raw);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].fileActionState?.applyStatus, 'applied');
    assert.equal(parsed[0].fileActionState?.results[0].status, 'failed');
    assert.equal(parsed[0].fileActionState?.results[0].error, 'File not found: missing.html');
  });

  test('parses persisted assistant message with provider/model attribution', () => {
    const raw = JSON.stringify([
      {
        id: 'm3',
        role: 'assistant',
        content: 'Response from selected provider.',
        executionId: 'exec-2',
        provider: 'openai',
        model: 'gpt-4o',
      },
    ]);

    const parsed = parseStoredChatThreadMessages(raw);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].executionId, 'exec-2');
    assert.equal(parsed[0].provider, 'openai');
    assert.equal(parsed[0].model, 'gpt-4o');
  });
});
