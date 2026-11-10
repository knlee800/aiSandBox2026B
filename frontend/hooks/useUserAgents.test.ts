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

describe('useUserAgents deleteUserAgentRequest — AGENT-PLATFORM-CREATE-01F', () => {
  beforeEach(() => {
    fetchCalls.length = 0;
  });

  afterEach(() => {
    restoreFetch();
  });

  test('DELETE /api/agents/:id uses credentials include and the given agent ID', async () => {
    const { deleteUserAgentRequest } = await import('./useUserAgents');
    installMockFetch(async () => mockResponse(204, null));

    const result = await deleteUserAgentRequest('agent-42');

    assert.equal(result.error, undefined);
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, '/api/agents/agent-42');
    assert.equal(fetchCalls[0].init?.method, 'DELETE');
    assert.equal(fetchCalls[0].init?.credentials, 'include');
    assert.equal(fetchCalls[0].init?.body, undefined);
  });

  test('successful DELETE does not parse a response body', async () => {
    const { deleteUserAgentRequest } = await import('./useUserAgents');
    installMockFetch(async () => mockResponse(204, { secret: 'do-not-show' }));

    const result = await deleteUserAgentRequest('agent-42');
    assert.equal(result.error, undefined);
  });

  test('401 maps to AUTH_EXPIRED without leaking server copy', async () => {
    const { deleteUserAgentRequest } = await import('./useUserAgents');
    installMockFetch(async () => mockResponse(401, { message: 'Authentication required' }));

    const result = await deleteUserAgentRequest('agent-42');
    assert.equal(result.error, 'AUTH_EXPIRED');
  });

  test('404 and 500 map to DELETE_FAILED without leaking server copy', async () => {
    const { deleteUserAgentRequest } = await import('./useUserAgents');
    installMockFetch(async () => mockResponse(404, { message: 'Not Found', error: 'NotFoundException' }));
    const missing = await deleteUserAgentRequest('missing-id');
    assert.equal(missing.error, 'DELETE_FAILED');

    installMockFetch(async () => mockResponse(500, { message: 'Internal Server Error' }));
    const failed = await deleteUserAgentRequest('agent-42');
    assert.equal(failed.error, 'DELETE_FAILED');
  });

  test('removeUserAgentFromList drops only the deleted id', async () => {
    const { removeUserAgentFromList } = await import('./useUserAgents');
    const remaining = removeUserAgentFromList(
      [
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
      ],
      'b',
    );
    assert.deepEqual(remaining.map((agent) => agent.id), ['a', 'c']);
  });
});

describe('useUserAgents workflow routes — BIZ-USER-01B', () => {
  beforeEach(() => {
    fetchCalls.length = 0;
  });

  afterEach(() => {
    restoreFetch();
  });

  const created = {
    id: 'new-1',
    name: 'Digest',
    role: 'Helper',
    description: 'Does things',
    status: 'active',
    initials: 'D',
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
    neverDo: [{ code: 'FILES_NO_CHANGE' }],
    instructionsChars: 900,
    maxInstructionsChars: 4000,
  };

  test('createUserAgentRequest posts the body as given to /api/agents with credentials', async () => {
    const { createUserAgentRequest } = await import('./useUserAgents');
    installMockFetch(async () => mockResponse(201, created));

    const dto = { name: 'Digest', role: 'Helper', description: 'Does things' };
    const result = await createUserAgentRequest(dto);

    assert.equal(fetchCalls[0].url, '/api/agents');
    assert.equal(fetchCalls[0].init?.method, 'POST');
    assert.equal(fetchCalls[0].init?.credentials, 'include');
    assert.deepEqual(JSON.parse(fetchCalls[0].init!.body as string), dto);
    assert.equal(result.agent?.id, 'new-1');
    assert.equal(result.agent?.instructionsChars, 900);
  });

  test('createUserAgentFromTemplateRequest posts to /api/agents/from-template', async () => {
    const { createUserAgentFromTemplateRequest } = await import('./useUserAgents');
    installMockFetch(async () => mockResponse(201, created));

    const result = await createUserAgentFromTemplateRequest({
      templateId: 'chief-of-staff',
      name: 'Digest',
      role: 'Helper',
    });

    assert.equal(fetchCalls[0].url, '/api/agents/from-template');
    assert.equal(fetchCalls[0].init?.method, 'POST');
    assert.deepEqual(JSON.parse(fetchCalls[0].init!.body as string), {
      templateId: 'chief-of-staff',
      name: 'Digest',
      role: 'Helper',
    });
    assert.equal(result.agent?.id, 'new-1');
  });

  test('updateUserAgentRequest sends PATCH to /api/agents/:id with the encoded id', async () => {
    const { updateUserAgentRequest } = await import('./useUserAgents');
    installMockFetch(async () => mockResponse(200, created));

    const result = await updateUserAgentRequest('a/b', { name: 'New', tone: null, budgetPerRunCredits: null });

    assert.equal(fetchCalls[0].url, '/api/agents/a%2Fb');
    assert.equal(fetchCalls[0].init?.method, 'PATCH');
    assert.equal(fetchCalls[0].init?.credentials, 'include');
    assert.deepEqual(JSON.parse(fetchCalls[0].init!.body as string), {
      name: 'New',
      tone: null,
      budgetPerRunCredits: null,
    });
    assert.equal(result.error, undefined);
  });

  test('a 400 with a refusal code returns the code and message', async () => {
    const { updateUserAgentRequest } = await import('./useUserAgents');
    installMockFetch(async () =>
      mockResponse(400, { statusCode: 400, message: 'The workflow budget is invalid.', code: 'BUDGET_INVALID' }),
    );

    const result = await updateUserAgentRequest('agent-1', { budgetPerDayCredits: 1 });

    assert.equal(result.agent, undefined);
    assert.equal(result.code, 'BUDGET_INVALID');
    assert.equal(result.error, 'The workflow budget is invalid.');
  });

  test('a 400 without a code returns the message only', async () => {
    const { createUserAgentRequest } = await import('./useUserAgents');
    installMockFetch(async () => mockResponse(400, { message: ['name must be shorter', 'role is empty'] }));

    const result = await createUserAgentRequest({ name: 'x', role: 'y', description: 'z' });

    assert.equal(result.code, undefined);
    assert.equal(result.error, 'name must be shorter; role is empty');
  });

  test('401, 404, 500 and a network error map to stable error values', async () => {
    const { updateUserAgentRequest, createUserAgentRequest } = await import('./useUserAgents');

    installMockFetch(async () => mockResponse(401, {}));
    assert.equal((await updateUserAgentRequest('a', { name: 'n' })).error, 'AUTH_EXPIRED');

    installMockFetch(async () => mockResponse(404, {}));
    assert.equal((await updateUserAgentRequest('a', { name: 'n' })).error, 'NOT_FOUND');

    installMockFetch(async () => mockResponse(500, {}));
    assert.equal((await updateUserAgentRequest('a', { name: 'n' })).error, 'UPDATE_FAILED');
    assert.equal((await createUserAgentRequest({ name: 'n', role: 'r', description: 'd' })).error, 'CREATE_FAILED');

    installMockFetch(async () => {
      throw new Error('offline');
    });
    assert.equal((await updateUserAgentRequest('a', { name: 'n' })).error, 'UPDATE_FAILED');
  });

  test('fetchUserAgentOptionsRequest reads /api/agents/options', async () => {
    const { fetchUserAgentOptionsRequest } = await import('./useUserAgents');
    const body = {
      replyLanguages: ['owner'],
      toolProfiles: ['read'],
      knowledgeScopes: [{ id: 'policies', type: 'shared' }],
      connectorTools: [{ id: 'mail_list_unread_metadata', kind: 'imap' }],
      connectedKinds: ['imap'],
      models: [{ id: 'claude-sonnet-5-5', provider: 'anthropic', creditsPer1kTokens: 1 }],
      templates: ['chief-of-staff'],
      limits: {
        maxInstructionsChars: 4000,
        maxToneChars: 120,
        maxKnowledgeScopes: 9,
        maxBudgetCredits: 1000000,
        platformDailyCreditsPerUser: 500,
      },
    };
    installMockFetch(async () => mockResponse(200, body));

    const result = await fetchUserAgentOptionsRequest();

    assert.equal(fetchCalls[0].url, '/api/agents/options');
    assert.equal(fetchCalls[0].init?.credentials, 'include');
    assert.deepEqual(result.options, body);

    installMockFetch(async () => mockResponse(500, {}));
    assert.equal((await fetchUserAgentOptionsRequest()).error, 'OPTIONS_FAILED');
    installMockFetch(async () => mockResponse(401, {}));
    assert.equal((await fetchUserAgentOptionsRequest()).error, 'AUTH_EXPIRED');
  });
});
