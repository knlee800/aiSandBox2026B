import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  loadSessionChatMessagesFromBackend,
  persistSessionChatMessageToBackend,
} from './workspace-chat-persistence.logic';

describe('workspace chat persistence logic', () => {
  test('loads session chat messages from backend conversation path', async () => {
    const fetchCalls: string[] = [];
    const fetchImpl = (async (url: string) => {
      fetchCalls.push(url);
      if (url.startsWith('/api/sessions/')) {
        return {
          ok: true,
          json: async () => ({ id: 'conv-1', sessionId: 'session-1' }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => [
          { id: 'm1', role: 'user', content: 'hello', createdAt: '2026-01-01T00:00:00.000Z' },
          { id: 'm2', role: 'assistant', content: 'hi', createdAt: '2026-01-01T00:00:01.000Z' },
        ],
      } as Response;
    }) as typeof fetch;

    const messages = await loadSessionChatMessagesFromBackend({
      token: 'token',
      sessionId: 'session-1',
      fetchImpl,
    });

    assert.deepEqual(fetchCalls, [
      '/api/sessions/session-1/conversation',
      '/api/conversations/conv-1/messages?limit=200&offset=0',
    ]);
    assert.equal(messages?.length, 2);
    assert.equal(messages?.[0].role, 'user');
    assert.equal(messages?.[1].role, 'assistant');
  });

  test('returns empty array when no conversation exists for session', async () => {
    const fetchImpl = (async () =>
      ({
        ok: true,
        json: async () => null,
      }) as Response) as typeof fetch;

    const messages = await loadSessionChatMessagesFromBackend({
      token: 'token',
      sessionId: 'session-1',
      fetchImpl,
    });

    assert.deepEqual(messages, []);
  });

  test('persists user message to backend session path', async () => {
    const fetchImpl = (async () =>
      ({
        ok: true,
        json: async () => ({ id: 'm1' }),
      }) as Response) as typeof fetch;

    const messageId = await persistSessionChatMessageToBackend({
      token: 'token',
      sessionId: 'session-1',
      role: 'user',
      content: 'hello',
      fetchImpl,
    });

    assert.equal(messageId, 'm1');
  });

  test('throws when backend chat load fails so caller can fallback', async () => {
    const fetchImpl = (async () =>
      ({
        ok: false,
        status: 503,
        json: async () => ({}),
      }) as Response) as typeof fetch;

    await assert.rejects(
      loadSessionChatMessagesFromBackend({
        token: 'token',
        sessionId: 'session-1',
        fetchImpl,
      }),
      /Chat conversation load failed \(503\)/,
    );
  });

  test('throws when backend message save fails so caller can continue gracefully', async () => {
    const fetchImpl = (async () =>
      ({
        ok: false,
        status: 500,
        json: async () => ({}),
      }) as Response) as typeof fetch;

    await assert.rejects(
      persistSessionChatMessageToBackend({
        token: 'token',
        sessionId: 'session-1',
        role: 'assistant',
        content: 'response',
        fetchImpl,
      }),
      /Chat message persistence failed \(500\)/,
    );
  });
});
