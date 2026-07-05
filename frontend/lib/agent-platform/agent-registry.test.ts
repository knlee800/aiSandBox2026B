import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import enMessages from '../../messages/en.json';
import zhTWMessages from '../../messages/zh-TW.json';
import zhCNMessages from '../../messages/zh-CN.json';
import {
  AGENT_MANIFESTS,
  getAgentById,
  listAgents,
  listAgentsByStatus,
  listEnabledAgents,
} from './agent-registry';

const EXPECTED_AGENT_IDS = [
  'builder',
  'chief-of-staff',
  'product-strategy',
  'technology-advisor',
] as const;

const PLACEHOLDER_AGENT_IDS = [
  'chief-of-staff',
  'product-strategy',
  'technology-advisor',
] as const;

const ALL_LOCALES: ReadonlyArray<Record<string, unknown>> = [
  enMessages as Record<string, unknown>,
  zhTWMessages as Record<string, unknown>,
  zhCNMessages as Record<string, unknown>,
];

function resolveNestedString(source: Record<string, unknown>, fullKey: string): string | null {
  const keyParts = fullKey.split('.');
  let current: unknown = source;

  for (const part of keyParts) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === 'string' ? current : null;
}

describe('agent registry foundation', () => {
  test('registry contains the four expected agents', () => {
    const ids = listAgents().map((agent) => agent.id);
    assert.equal(ids.length, EXPECTED_AGENT_IDS.length);
    assert.deepEqual(ids, [...EXPECTED_AGENT_IDS]);
  });

  test('builder agent is active and enabled', () => {
    const builder = getAgentById('builder');
    assert.ok(builder);
    assert.equal(builder.status, 'active');
    assert.equal(builder.enabled, true);
  });

  test('placeholder agents are coming_soon and disabled', () => {
    for (const id of PLACEHOLDER_AGENT_IDS) {
      const agent = getAgentById(id);
      assert.ok(agent);
      assert.equal(agent.status, 'coming_soon');
      assert.equal(agent.enabled, false);
    }
  });

  test('getAgentById returns matching agent for valid id', () => {
    const productStrategy = getAgentById('product-strategy');
    assert.ok(productStrategy);
    assert.equal(productStrategy.id, 'product-strategy');
  });

  test('getAgentById returns undefined for invalid id', () => {
    const missing = getAgentById('unknown-agent-id');
    assert.equal(missing, undefined);
  });

  test('listEnabledAgents returns only enabled agents', () => {
    const enabledAgents = listEnabledAgents();
    assert.equal(enabledAgents.length, 1);
    assert.equal(enabledAgents[0].id, 'builder');
    assert.equal(enabledAgents.every((agent) => agent.enabled), true);
  });

  test('listAgentsByStatus filters agents by status', () => {
    const activeAgents = listAgentsByStatus('active');
    const comingSoonAgents = listAgentsByStatus('coming_soon');
    const disabledAgents = listAgentsByStatus('disabled');

    assert.equal(activeAgents.length, 1);
    assert.equal(activeAgents[0].id, 'builder');
    assert.equal(comingSoonAgents.length, 3);
    assert.deepEqual(
      comingSoonAgents.map((agent) => agent.id),
      [...PLACEHOLDER_AGENT_IDS],
    );
    assert.equal(disabledAgents.length, 0);
  });

  test('all agents use translation keys for name, role, and description', () => {
    for (const agent of AGENT_MANIFESTS) {
      for (const key of [agent.nameKey, agent.roleKey, agent.descriptionKey]) {
        assert.equal(
          key.startsWith('agents.'),
          true,
          `Expected translation key to start with agents.: ${key}`,
        );

        for (const localeMessages of ALL_LOCALES) {
          const value = resolveNestedString(localeMessages, key);
          assert.equal(value !== null && value.trim().length > 0, true, `Missing key: ${key}`);
        }
      }
    }
  });

  test('manifest invariants are valid', () => {
    const seenIds = new Set<string>();

    for (const manifest of AGENT_MANIFESTS) {
      assert.equal(seenIds.has(manifest.id), false, `Duplicate manifest id: ${manifest.id}`);
      seenIds.add(manifest.id);

      assert.equal(manifest.route.startsWith('/'), true, `Route must start with /: ${manifest.route}`);
      assert.equal(
        Number.isInteger(manifest.manifestVersion) && manifest.manifestVersion > 0,
        true,
        `Manifest version must be a positive integer for ${manifest.id}`,
      );
      assert.equal(
        manifest.modelProfile.maxTokensPerTurn > 0 && manifest.modelProfile.maxTurnsPerSession > 0,
        true,
        `Model profile limits must be positive for ${manifest.id}`,
      );
      assert.equal(
        manifest.toolPermissions.maxToolCallsPerTurn > 0 &&
          manifest.toolPermissions.maxToolCallsPerSession > 0,
        true,
        `Tool permission limits must be positive for ${manifest.id}`,
      );
      assert.equal(manifest.knowledgeScopes.length > 0, true, `Missing scopes for ${manifest.id}`);
      assert.equal(
        manifest.knowledgeScopes.every((scope) => scope.id.trim().length > 0),
        true,
        `Invalid knowledge scope id for ${manifest.id}`,
      );

      if (manifest.status === 'active') {
        assert.equal(manifest.enabled, true, `Active agents must be enabled: ${manifest.id}`);
      } else {
        assert.equal(manifest.enabled, false, `Non-active agents must be disabled: ${manifest.id}`);
      }
    }
  });
});
