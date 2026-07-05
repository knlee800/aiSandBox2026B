import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { listAgents } from '@/lib/agent-platform/agent-registry';
import type { AgentManifest } from '@/lib/agent-platform/agent-registry';
import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';

type LocaleMessages = Record<string, unknown>;

const ALL_LOCALES: ReadonlyArray<{ code: string; messages: LocaleMessages }> = [
  { code: 'en', messages: enMessages as LocaleMessages },
  { code: 'zh-TW', messages: zhTwMessages as LocaleMessages },
  { code: 'zh-CN', messages: zhCnMessages as LocaleMessages },
];

function resolveNestedString(source: LocaleMessages, fullKey: string): string | null {
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

describe('platform dashboard data integration', () => {
  const agents: readonly AgentManifest[] = listAgents();

  test('registry exposes exactly four agents for the dashboard', () => {
    assert.equal(agents.length, 4);
    const ids = agents.map((a) => a.id);
    assert.deepEqual(ids, ['builder', 'chief-of-staff', 'product-strategy', 'technology-advisor']);
  });

  test('builder agent renders as active and enabled', () => {
    const builder = agents.find((a) => a.id === 'builder');
    assert.ok(builder);
    assert.equal(builder.status, 'active');
    assert.equal(builder.enabled, true);
  });

  test('placeholder agents render as coming_soon and disabled', () => {
    const placeholders = agents.filter((a) => a.id !== 'builder');
    assert.equal(placeholders.length, 3);
    for (const agent of placeholders) {
      assert.equal(agent.status, 'coming_soon', `${agent.id} should be coming_soon`);
      assert.equal(agent.enabled, false, `${agent.id} should be disabled`);
    }
  });

  test('all agent name/role/description keys resolve in all locales', () => {
    for (const agent of agents) {
      for (const { code, messages } of ALL_LOCALES) {
        for (const key of [agent.nameKey, agent.roleKey, agent.descriptionKey]) {
          const value = resolveNestedString(messages, key);
          assert.ok(
            value && value.trim().length > 0,
            `Missing translation for key "${key}" in locale "${code}"`,
          );
        }
      }
    }
  });

  test('platform dashboard translation keys exist in all locales', () => {
    const platformKeys = [
      'platform.title',
      'platform.subtitle',
      'platform.agentStationActive',
      'platform.agentStationComingSoon',
      'platform.agentStationDisabled',
    ];

    for (const { code, messages } of ALL_LOCALES) {
      for (const key of platformKeys) {
        const value = resolveNestedString(messages, key);
        assert.ok(
          value && value.trim().length > 0,
          `Missing platform key "${key}" in locale "${code}"`,
        );
      }
    }
  });

  test('each agent has a non-empty avatarRef', () => {
    for (const agent of agents) {
      assert.ok(
        agent.avatarRef && agent.avatarRef.trim().length > 0,
        `Agent ${agent.id} must have an avatarRef`,
      );
    }
  });
});
