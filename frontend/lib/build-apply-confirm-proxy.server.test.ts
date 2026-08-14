import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, test } from 'node:test';
import { POST as confirmBuildApplyRoutePost } from '../app/api/ai/executions/[executionId]/confirm-build-apply/route';
import { NextRequest } from 'next/server';
import {
  parseBuildApplyConfirmationProxyPayload,
  proxyConfirmBuildApply,
  readInternalServiceKeyFromEnv,
  readSessionTokenFromCookieHeader,
} from './build-apply-confirm-proxy.server';

const originalInternalServiceKey = process.env.INTERNAL_SERVICE_KEY;
const originalApiGatewayUrl = process.env.API_GATEWAY_URL;
const TEST_INTERNAL_KEY = 'test-internal-service-key-03d-b';
const QUALIFYING_PAYLOAD = {
  applyStatus: 'applied' as const,
  totalActions: 2,
  successCount: 2,
};

afterEach(() => {
  if (originalInternalServiceKey === undefined) {
    delete process.env.INTERNAL_SERVICE_KEY;
  } else {
    process.env.INTERNAL_SERVICE_KEY = originalInternalServiceKey;
  }
  if (originalApiGatewayUrl === undefined) {
    delete process.env.API_GATEWAY_URL;
  } else {
    process.env.API_GATEWAY_URL = originalApiGatewayUrl;
  }
});

type MockCall = {
  url: string;
  init?: RequestInit;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createFetchMock(handler: (url: string, init?: RequestInit) => Response) {
  const calls: MockCall[] = [];
  const fetchImpl: typeof fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const resolvedUrl = String(url);
    calls.push({ url: resolvedUrl, init });
    return handler(resolvedUrl, init);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function ownerFetchHandler(url: string): Response {
  if (url.endsWith('/api/auth/me')) {
    return jsonResponse(200, { id: 'user-owner' });
  }
  if (url.includes('/api/ai/executions/') && !url.includes('confirm-build-apply')) {
    return jsonResponse(200, { executionId: 'exec-owned', status: 'completed' });
  }
  if (url.includes('/api/internal/executions/') && url.endsWith('/confirm-build-apply')) {
    return jsonResponse(200, {
      executionId: 'exec-owned',
      triggered: true,
      reason: 'deducted',
      INTERNAL_SERVICE_KEY: TEST_INTERNAL_KEY,
      'X-Internal-Service-Key': TEST_INTERNAL_KEY,
    });
  }
  return jsonResponse(500, { error: 'unexpected' });
}

describe('PRIVATE-BETA-BLOCKER-03D-B confirm-build-apply proxy', () => {
  test('authenticated owner + valid payload forwards once with the server-side key', async () => {
    process.env.INTERNAL_SERVICE_KEY = TEST_INTERNAL_KEY;
    process.env.API_GATEWAY_URL = 'http://gateway.test';
    const { fetchImpl, calls } = createFetchMock(ownerFetchHandler);

    const result = await proxyConfirmBuildApply({
      executionId: 'exec-owned',
      cookieHeader: 'aisandbox_session=session-owner',
      incomingInternalServiceKeyHeader: 'browser-supplied-key',
      payload: QUALIFYING_PAYLOAD,
      fetchImpl,
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.executionId, 'exec-owned');
    assert.equal(result.body.triggered, true);
    assert.equal(result.body.reason, 'deducted');
    assert.equal(Object.prototype.hasOwnProperty.call(result.body, 'INTERNAL_SERVICE_KEY'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(result.body, 'X-Internal-Service-Key'), false);

    const confirmCalls = calls.filter((call) =>
      call.url.includes('/api/internal/executions/exec-owned/confirm-build-apply'),
    );
    assert.equal(confirmCalls.length, 1);
    assert.equal(confirmCalls[0]?.init?.method, 'POST');
    assert.equal(
      confirmCalls[0]?.init?.body,
      JSON.stringify(QUALIFYING_PAYLOAD),
    );
    const headers = new Headers(confirmCalls[0]?.init?.headers);
    assert.equal(headers.get('X-Internal-Service-Key'), TEST_INTERNAL_KEY);
    assert.notEqual(headers.get('X-Internal-Service-Key'), 'browser-supplied-key');
  });

  test('unauthenticated requests are rejected without calling confirm-build-apply', async () => {
    process.env.INTERNAL_SERVICE_KEY = TEST_INTERNAL_KEY;
    const { fetchImpl, calls } = createFetchMock(ownerFetchHandler);

    const missingCookie = await proxyConfirmBuildApply({
      executionId: 'exec-owned',
      cookieHeader: null,
      incomingInternalServiceKeyHeader: null,
      payload: QUALIFYING_PAYLOAD,
      fetchImpl,
    });
    const invalidSession = await proxyConfirmBuildApply({
      executionId: 'exec-owned',
      cookieHeader: 'aisandbox_session=expired',
      incomingInternalServiceKeyHeader: null,
      payload: QUALIFYING_PAYLOAD,
      fetchImpl: createFetchMock((url) => {
        if (url.endsWith('/api/auth/me')) {
          return jsonResponse(401, { message: 'Unauthorized' });
        }
        return jsonResponse(500, { error: 'unexpected' });
      }).fetchImpl,
    });

    assert.equal(missingCookie.status, 401);
    assert.equal(invalidSession.status, 401);
    assert.equal(
      calls.filter((call) => call.url.includes('/confirm-build-apply')).length,
      0,
    );
  });

  test('different-user execution is rejected and does not call confirm-build-apply', async () => {
    process.env.INTERNAL_SERVICE_KEY = TEST_INTERNAL_KEY;
    const { fetchImpl, calls } = createFetchMock((url) => {
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse(200, { id: 'user-b' });
      }
      if (url.includes('/api/ai/executions/exec-other')) {
        return jsonResponse(404, { message: 'Execution not found' });
      }
      return jsonResponse(500, { error: 'unexpected' });
    });

    const result = await proxyConfirmBuildApply({
      executionId: 'exec-other',
      cookieHeader: 'aisandbox_session=session-b',
      incomingInternalServiceKeyHeader: null,
      payload: QUALIFYING_PAYLOAD,
      fetchImpl,
    });

    assert.equal(result.status, 404);
    assert.equal(
      calls.filter((call) => call.url.includes('/api/internal/')).length,
      0,
    );
  });

  test('arbitrary executionId cannot bypass ownership', async () => {
    process.env.INTERNAL_SERVICE_KEY = TEST_INTERNAL_KEY;
    const { fetchImpl, calls } = createFetchMock((url) => {
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse(200, { id: 'user-b' });
      }
      if (url.includes('/api/ai/executions/00000000-0000-4000-8000-000000000001')) {
        return jsonResponse(404, { message: 'Execution not found' });
      }
      return jsonResponse(500, { error: 'unexpected' });
    });

    const result = await proxyConfirmBuildApply({
      executionId: '00000000-0000-4000-8000-000000000001',
      cookieHeader: 'aisandbox_session=session-b',
      incomingInternalServiceKeyHeader: TEST_INTERNAL_KEY,
      payload: QUALIFYING_PAYLOAD,
      fetchImpl,
    });

    assert.equal(result.status, 404);
    assert.equal(
      calls.filter((call) => call.url.includes('/api/internal/')).length,
      0,
    );
  });

  test('malformed payloads are rejected without calling confirm-build-apply', async () => {
    process.env.INTERNAL_SERVICE_KEY = TEST_INTERNAL_KEY;
    const { fetchImpl, calls } = createFetchMock(ownerFetchHandler);

    const cases = [
      null,
      { applyStatus: 'skipped', totalActions: 1, successCount: 1 },
      { applyStatus: 'applied', totalActions: -1, successCount: 0 },
      { applyStatus: 'applied', totalActions: 1.5, successCount: 1 },
      { applyStatus: 'applied' },
      {
        applyStatus: 'applied',
        totalActions: 1,
        successCount: 1,
        creditAmount: 99,
      },
    ];

    for (const payload of cases.slice(0, 5)) {
      const result = await proxyConfirmBuildApply({
        executionId: 'exec-owned',
        cookieHeader: 'aisandbox_session=session-owner',
        incomingInternalServiceKeyHeader: null,
        payload,
        fetchImpl,
      });
      assert.equal(result.status, 400);
      assert.equal(result.body.error, 'malformed_payload');
    }

    assert.deepEqual(
      parseBuildApplyConfirmationProxyPayload({
        applyStatus: 'applied',
        totalActions: 1,
        successCount: 1,
        creditAmount: 99,
      }),
      {
        applyStatus: 'applied',
        totalActions: 1,
        successCount: 1,
      },
    );
    assert.equal(
      calls.filter((call) => call.url.includes('/api/internal/')).length,
      0,
    );
  });

  test('internal key is added server-side from env and never returned', async () => {
    process.env.INTERNAL_SERVICE_KEY = TEST_INTERNAL_KEY;
    const { fetchImpl, calls } = createFetchMock(ownerFetchHandler);

    const result = await proxyConfirmBuildApply({
      executionId: 'exec-owned',
      cookieHeader: 'aisandbox_session=session-owner',
      incomingInternalServiceKeyHeader: 'from-browser',
      payload: QUALIFYING_PAYLOAD,
      fetchImpl,
    });

    const confirmHeaders = new Headers(
      calls.find((call) => call.url.includes('/api/internal/'))?.init?.headers,
    );
    assert.equal(confirmHeaders.get('X-Internal-Service-Key'), TEST_INTERNAL_KEY);
    assert.equal(JSON.stringify(result.body).includes(TEST_INTERNAL_KEY), false);
    assert.equal(JSON.stringify(result.body).includes('from-browser'), false);
  });

  test('API Gateway internal failure is handled without leaking the key', async () => {
    process.env.INTERNAL_SERVICE_KEY = TEST_INTERNAL_KEY;
    const { fetchImpl } = createFetchMock((url) => {
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse(200, { id: 'user-owner' });
      }
      if (url.includes('/api/ai/executions/') && !url.includes('confirm-build-apply')) {
        return jsonResponse(200, { executionId: 'exec-owned', status: 'completed' });
      }
      return jsonResponse(503, {
        error: 'upstream',
        INTERNAL_SERVICE_KEY: TEST_INTERNAL_KEY,
      });
    });

    const result = await proxyConfirmBuildApply({
      executionId: 'exec-owned',
      cookieHeader: 'aisandbox_session=session-owner',
      incomingInternalServiceKeyHeader: null,
      payload: QUALIFYING_PAYLOAD,
      fetchImpl,
    });

    assert.equal(result.status, 503);
    assert.equal(result.body.error, 'upstream');
    assert.equal(Object.prototype.hasOwnProperty.call(result.body, 'INTERNAL_SERVICE_KEY'), false);
    assert.equal(JSON.stringify(result.body).includes(TEST_INTERNAL_KEY), false);
  });

  test('duplicate same confirmation remains safe from the frontend proxy perspective', async () => {
    process.env.INTERNAL_SERVICE_KEY = TEST_INTERNAL_KEY;
    let confirmCount = 0;
    const { fetchImpl } = createFetchMock((url) => {
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse(200, { id: 'user-owner' });
      }
      if (url.includes('/api/ai/executions/') && !url.includes('confirm-build-apply')) {
        return jsonResponse(200, { executionId: 'exec-owned', status: 'completed' });
      }
      confirmCount += 1;
      return jsonResponse(200, {
        executionId: 'exec-owned',
        triggered: confirmCount === 1,
        reason: confirmCount === 1 ? 'deducted' : 'duplicate',
      });
    });

    const first = await proxyConfirmBuildApply({
      executionId: 'exec-owned',
      cookieHeader: 'aisandbox_session=session-owner',
      incomingInternalServiceKeyHeader: null,
      payload: QUALIFYING_PAYLOAD,
      fetchImpl,
    });
    const second = await proxyConfirmBuildApply({
      executionId: 'exec-owned',
      cookieHeader: 'aisandbox_session=session-owner',
      incomingInternalServiceKeyHeader: null,
      payload: QUALIFYING_PAYLOAD,
      fetchImpl,
    });

    assert.equal(first.status, 200);
    assert.equal(first.body.triggered, true);
    assert.equal(second.status, 200);
    assert.equal(second.body.triggered, false);
    assert.equal(second.body.reason, 'duplicate');
    assert.equal(confirmCount, 2);
  });

  test('route handler authenticates from the session cookie and does not echo the internal key', async () => {
    process.env.INTERNAL_SERVICE_KEY = TEST_INTERNAL_KEY;
    process.env.API_GATEWAY_URL = 'http://gateway.test';
    const originalFetch = globalThis.fetch;
    const confirmUrls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const resolvedUrl = String(url);
      if (resolvedUrl.endsWith('/api/auth/me')) {
        return jsonResponse(200, { id: 'user-owner' });
      }
      if (resolvedUrl.includes('/api/ai/executions/') && !resolvedUrl.includes('confirm-build-apply')) {
        return jsonResponse(200, { executionId: 'exec-route', status: 'completed' });
      }
      confirmUrls.push(resolvedUrl);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('X-Internal-Service-Key'), TEST_INTERNAL_KEY);
      return jsonResponse(200, {
        executionId: 'exec-route',
        triggered: true,
        reason: 'deducted',
        'X-Internal-Service-Key': TEST_INTERNAL_KEY,
      });
    }) as typeof fetch;

    try {
      const request = new NextRequest(
        'http://localhost:3002/api/ai/executions/exec-route/confirm-build-apply',
        {
          method: 'POST',
          headers: {
            cookie: 'aisandbox_session=session-owner',
            'content-type': 'application/json',
            'x-internal-service-key': 'from-browser',
          },
          body: JSON.stringify(QUALIFYING_PAYLOAD),
        },
      );
      const response = await confirmBuildApplyRoutePost(request, {
        params: Promise.resolve({ executionId: 'exec-route' }),
      });
      const body = (await response.json()) as Record<string, unknown>;

      assert.equal(response.status, 200);
      assert.equal(body.executionId, 'exec-route');
      assert.equal(Object.prototype.hasOwnProperty.call(body, 'X-Internal-Service-Key'), false);
      assert.equal(JSON.stringify(body).includes(TEST_INTERNAL_KEY), false);
      assert.equal(confirmUrls.length, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('readSessionTokenFromCookieHeader requires aisandbox_session', () => {
    assert.equal(readSessionTokenFromCookieHeader(null), null);
    assert.equal(readSessionTokenFromCookieHeader(''), null);
    assert.equal(readSessionTokenFromCookieHeader('aisandbox_csrf=abc'), null);
    assert.equal(
      readSessionTokenFromCookieHeader('aisandbox_csrf=abc; aisandbox_session=tok-1'),
      'tok-1',
    );
  });

  test('server helper reads INTERNAL_SERVICE_KEY from env and never NEXT_PUBLIC', () => {
    process.env.INTERNAL_SERVICE_KEY = TEST_INTERNAL_KEY;
    assert.equal(readInternalServiceKeyFromEnv(), TEST_INTERNAL_KEY);

    const helperSource = readFileSync(
      new URL('./build-apply-confirm-proxy.server.ts', import.meta.url),
      'utf8',
    );
    const routeSource = readFileSync(
      new URL(
        '../app/api/ai/executions/[executionId]/confirm-build-apply/route.ts',
        import.meta.url,
      ),
      'utf8',
    );
    assert.doesNotMatch(helperSource, /NEXT_PUBLIC_INTERNAL_SERVICE_KEY/);
    assert.doesNotMatch(routeSource, /NEXT_PUBLIC_INTERNAL_SERVICE_KEY/);
    assert.match(helperSource, /process\.env\.INTERNAL_SERVICE_KEY/);
  });
});
