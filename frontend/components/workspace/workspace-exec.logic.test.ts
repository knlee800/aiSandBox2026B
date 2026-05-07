import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { executeSessionCommand } from './workspace-exec.logic';

describe('workspace exec logic', () => {
  test('calls POST /api/sessions/:id/exec with command payload', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock: typeof fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const state = await executeSessionCommand({
      sessionId: 'session-123',
      command: 'echo ok',
      fetchImpl: fetchMock,
    });

    assert.equal(state.status, 'result');
    assert.equal(state.result?.exitCode, 0);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, '/api/sessions/session-123/exec');
    assert.equal(requests[0].init?.method, 'POST');
    assert.equal((requests[0].init?.headers as Record<string, string>)['Content-Type'], 'application/json');
    assert.equal(requests[0].init?.body, JSON.stringify({ command: 'echo ok' }));
  });

  test('maps HTTP 400, 404, and 410 to distinct frontend states', async () => {
    const fetch400: typeof fetch = (async () => new Response('', { status: 400 })) as typeof fetch;
    const fetch404: typeof fetch = (async () => new Response('', { status: 404 })) as typeof fetch;
    const fetch410: typeof fetch = (async () => new Response('', { status: 410 })) as typeof fetch;

    const state400 = await executeSessionCommand({
      sessionId: 'session-1',
      command: 'echo a',
      fetchImpl: fetch400,
    });
    const state404 = await executeSessionCommand({
      sessionId: 'session-1',
      command: 'echo a',
      fetchImpl: fetch404,
    });
    const state410 = await executeSessionCommand({
      sessionId: 'session-1',
      command: 'echo a',
      fetchImpl: fetch410,
    });

    assert.equal(state400.status, 'http-400');
    assert.equal(state404.status, 'http-404');
    assert.equal(state410.status, 'http-410');
  });

  test('maps network and unexpected failures to network-error state with surfaced detail', async () => {
    const fetchReject: typeof fetch = (async () => {
      throw new Error('network down');
    }) as typeof fetch;
    const fetch500: typeof fetch = (async () =>
      new Response(JSON.stringify({ message: 'exec service unavailable' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    const rejectedState = await executeSessionCommand({
      sessionId: 'session-1',
      command: 'echo a',
      fetchImpl: fetchReject,
    });
    const status500State = await executeSessionCommand({
      sessionId: 'session-1',
      command: 'echo a',
      fetchImpl: fetch500,
    });

    assert.equal(rejectedState.status, 'network-error');
    assert.match(rejectedState.errorMessage ?? '', /network down/);
    assert.equal(status500State.status, 'network-error');
    assert.match(status500State.errorMessage ?? '', /HTTP 500/);
    assert.match(status500State.errorMessage ?? '', /exec service unavailable/);
  });
});
