import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BUILDER_FALLBACK_AGENT } from './agent-registry';
import { loadSystemAgents } from './use-system-agents';

const VERSION = 'b'.repeat(64);

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

function publicAgent(id: string) {
  return {
    id,
    nameKey: `agents.${id}.name`,
    roleKey: `agents.${id}.role`,
    descriptionKey: `agents.${id}.description`,
    status: 'active',
    enabled: id === 'builder',
    knowledgeScopes: [],
    version: VERSION,
  };
}

describe('loadSystemAgents', () => {
  test('a 200 response parses and keeps an extra agent', async () => {
    let seenUrl = '';
    let seenInit: RequestInit | undefined;
    const result = await loadSystemAgents(async (url, init) => {
      seenUrl = String(url);
      seenInit = init;
      return jsonResponse(200, {
        agents: [publicAgent('builder'), publicAgent('research')],
      });
    });
    assert.equal(seenUrl, '/api/system-agents');
    assert.equal(seenInit?.credentials, 'include');
    assert.equal(result.error, null);
    assert.deepEqual(
      result.agents.map((agent) => agent.id),
      ['builder', 'research'],
    );
    assert.equal(result.agents[0].version, VERSION);
  });

  test('401 leaves the list empty and does not install the fallback', async () => {
    const result = await loadSystemAgents(async () => jsonResponse(401, { agents: [publicAgent('builder')] }));
    assert.equal(result.error, 'AUTH_EXPIRED');
    assert.deepEqual(result.agents, []);
    assert.notEqual(result.agents[0], BUILDER_FALLBACK_AGENT);
  });

  test('404, an empty object, and an empty list fall back to Builder only', async () => {
    const missing = await loadSystemAgents(async () => jsonResponse(404, { message: 'not found' }));
    const emptyObject = await loadSystemAgents(async () => jsonResponse(200, {}));
    const emptyList = await loadSystemAgents(async () => jsonResponse(200, []));
    const emptyAgents = await loadSystemAgents(async () => jsonResponse(200, { agents: [] }));
    for (const result of [missing, emptyObject, emptyList, emptyAgents]) {
      assert.equal(result.error, 'FETCH_FAILED');
      assert.equal(result.agents.length, 1);
      assert.deepEqual(result.agents[0], BUILDER_FALLBACK_AGENT);
    }
  });

  test('a network error falls back to Builder only', async () => {
    const result = await loadSystemAgents(async () => {
      throw new Error('offline');
    });
    assert.equal(result.error, 'FETCH_FAILED');
    assert.deepEqual(result.agents, [BUILDER_FALLBACK_AGENT]);
  });
});
