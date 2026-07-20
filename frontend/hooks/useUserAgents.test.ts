import assert from 'node:assert/strict';
import { describe, test, beforeEach, afterEach } from 'node:test';

type MockFetchFn = (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface FetchCall {
  url: string;
  init?: RequestInit;
}

const fetchCalls: FetchCall[] = [];
let mockFetchImpl: MockFetchFn;

const originalFetch = globalThis.fetch;

function installMockFetch(impl: MockFetchFn) {
  mockFetchImpl = impl;
  fetchCalls.length = 0;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return mockFetchImpl(url, init);
  }) as typeof globalThis.fetch;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
  fetchCalls.length = 0;
}

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: new Headers(),
    redirected: false,
    statusText: '',
    type: 'basic' as ResponseType,
    url: '',
    clone: () => mockResponse(status, body),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    text: async () => JSON.stringify(body),
    bytes: async () => new Uint8Array(0),
  } as Response;
}

describe('useUserAgents hook API contract tests', () => {
  beforeEach(() => {
    fetchCalls.length = 0;
  });

  afterEach(() => {
    restoreFetch();
  });

  test('GET /api/agents is called with credentials: include', async () => {
    installMockFetch(async () => mockResponse(200, { agents: [] }));

    await globalThis.fetch('/api/agents', { credentials: 'include' });

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, '/api/agents');
    assert.equal(fetchCalls[0].init?.credentials, 'include');
  });

  test('GET /api/agents returns agents array on success', async () => {
    const mockAgents = [
      {
        id: 'test-1',
        name: 'Agent One',
        role: 'Role One',
        description: 'Desc One',
        status: 'active',
        initials: 'AO',
        createdAt: '2026-07-20T10:00:00.000Z',
        updatedAt: '2026-07-20T10:00:00.000Z',
      },
    ];

    installMockFetch(async () => mockResponse(200, { agents: mockAgents }));

    const response = await globalThis.fetch('/api/agents', { credentials: 'include' });
    const data = (await response.json()) as { agents: unknown[] };

    assert.ok(Array.isArray(data.agents));
    assert.equal(data.agents.length, 1);
  });

  test('GET /api/agents returns empty array when no user agents', async () => {
    installMockFetch(async () => mockResponse(200, { agents: [] }));

    const response = await globalThis.fetch('/api/agents', { credentials: 'include' });
    const data = (await response.json()) as { agents: unknown[] };

    assert.ok(Array.isArray(data.agents));
    assert.equal(data.agents.length, 0);
  });

  test('GET /api/agents error sets error state', async () => {
    installMockFetch(async () => mockResponse(500, { message: 'Internal Server Error' }));

    const response = await globalThis.fetch('/api/agents', { credentials: 'include' });

    assert.equal(response.ok, false);
    assert.equal(response.status, 500);
  });

  test('POST /api/agents sends only name, role, description', async () => {
    installMockFetch(async () =>
      mockResponse(201, {
        id: 'new-uuid',
        name: 'New Agent',
        role: 'New Role',
        description: 'New Desc',
        status: 'active',
        initials: 'NA',
        createdAt: '2026-07-20T11:00:00.000Z',
        updatedAt: '2026-07-20T11:00:00.000Z',
      }),
    );

    const body = { name: 'New Agent', role: 'New Role', description: 'New Desc' };
    await globalThis.fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].init?.method, 'POST');
    assert.equal(fetchCalls[0].init?.credentials, 'include');

    const sentBody = JSON.parse(fetchCalls[0].init!.body as string) as Record<string, unknown>;
    const keys = Object.keys(sentBody).sort();
    assert.deepEqual(keys, ['description', 'name', 'role']);
    assert.equal('userId' in sentBody, false, 'must not send userId');
  });

  test('POST /api/agents uses credentials: include', async () => {
    installMockFetch(async () =>
      mockResponse(201, {
        id: 'new-uuid',
        name: 'Test',
        role: 'Test',
        description: 'Test',
        status: 'active',
        initials: 'T',
        createdAt: '2026-07-20T11:00:00.000Z',
        updatedAt: '2026-07-20T11:00:00.000Z',
      }),
    );

    await globalThis.fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Test', role: 'Test', description: 'Test' }),
    });

    assert.equal(fetchCalls[0].init?.credentials, 'include');
  });

  test('POST /api/agents returns created agent on success', async () => {
    const created = {
      id: 'new-uuid',
      name: 'Created Agent',
      role: 'Created Role',
      description: 'Created Desc',
      status: 'active',
      initials: 'CA',
      createdAt: '2026-07-20T11:00:00.000Z',
      updatedAt: '2026-07-20T11:00:00.000Z',
    };

    installMockFetch(async () => mockResponse(201, created));

    const response = await globalThis.fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Created Agent', role: 'Created Role', description: 'Created Desc' }),
    });

    assert.equal(response.status, 201);
    const data = (await response.json()) as Record<string, unknown>;
    assert.equal(data.name, 'Created Agent');
    assert.equal(typeof data.id, 'string');
  });

  test('POST /api/agents returns error on 400 validation failure', async () => {
    const errorBody = {
      message: ['name must be shorter than or equal to 100 characters'],
      error: 'Bad Request',
      statusCode: 400,
    };

    installMockFetch(async () => mockResponse(400, errorBody));

    const response = await globalThis.fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'A'.repeat(101), role: 'Test', description: 'Test' }),
    });

    assert.equal(response.status, 400);
    assert.equal(response.ok, false);
    const data = (await response.json()) as { message: string[] };
    assert.ok(Array.isArray(data.message));
  });

  test('POST /api/agents handles 401 correctly', async () => {
    installMockFetch(async () => mockResponse(401, { message: 'Authentication required' }));

    const response = await globalThis.fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Test', role: 'Test', description: 'Test' }),
    });

    assert.equal(response.status, 401);
    assert.equal(response.ok, false);
  });

  test('no userId field/input is exposed or sent in POST body', async () => {
    installMockFetch(async () =>
      mockResponse(201, {
        id: 'new-uuid',
        name: 'Test',
        role: 'Test',
        description: 'Test',
        status: 'active',
        initials: 'T',
        createdAt: '2026-07-20T11:00:00.000Z',
        updatedAt: '2026-07-20T11:00:00.000Z',
      }),
    );

    const dto = { name: 'Test', role: 'Test', description: 'Test' };
    await globalThis.fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(dto),
    });

    const sentBody = JSON.parse(fetchCalls[0].init!.body as string) as Record<string, unknown>;
    assert.equal('userId' in sentBody, false, 'userId must never be sent');
    assert.equal('ownerId' in sentBody, false, 'ownerId must never be sent');
    assert.equal('deletedAt' in sentBody, false, 'deletedAt must never be sent');
  });
});
