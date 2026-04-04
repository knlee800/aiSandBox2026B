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
          skipReason: null,
          results: [{ action: 'write', path: 'src/a.ts', status: 'success', error: null }],
        },
      },
    ]);

    const parsed = parseStoredChatThreadMessages(raw);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].executionId, 'exec-1');
    assert.equal(parsed[0].fileActionState?.applyStatus, 'applied');
    assert.equal(parsed[0].fileActionState?.results[0].status, 'success');
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
