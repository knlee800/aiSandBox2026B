import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import enMessages from '../../messages/en.json';
import zhTWMessages from '../../messages/zh-TW.json';
import zhCNMessages from '../../messages/zh-CN.json';
import {
  AGENT_STATUSES,
  BUILDER_FALLBACK_AGENT,
  getAgentById,
  listAgentsByStatus,
  listEnabledAgents,
  parseSystemAgents,
  type PublicSystemAgent,
} from './agent-registry';

const VERSION = 'a'.repeat(64);

const ALL_LOCALES: ReadonlyArray<{ code: string; messages: Record<string, unknown> }> = [
  { code: 'en', messages: enMessages as Record<string, unknown> },
  { code: 'zh-TW', messages: zhTWMessages as Record<string, unknown> },
  { code: 'zh-CN', messages: zhCNMessages as Record<string, unknown> },
];

const FIXTURE: readonly PublicSystemAgent[] = [
  {
    id: 'builder',
    nameKey: 'agents.builder.name',
    roleKey: 'agents.builder.role',
    descriptionKey: 'agents.builder.description',
    status: 'active',
    enabled: true,
    knowledgeScopes: [],
    version: VERSION,
  },
  {
    id: 'chief-of-staff',
    nameKey: 'agents.chiefOfStaff.name',
    roleKey: 'agents.chiefOfStaff.role',
    descriptionKey: 'agents.chiefOfStaff.description',
    status: 'active',
    enabled: false,
    knowledgeScopes: [{ id: 'policies', type: 'shared' }],
    version: VERSION,
  },
  {
    id: 'product-strategy',
    nameKey: 'agents.productStrategy.name',
    roleKey: 'agents.productStrategy.role',
    descriptionKey: 'agents.productStrategy.description',
    status: 'coming_soon',
    enabled: false,
    knowledgeScopes: [],
    version: VERSION,
  },
  {
    id: 'technology-advisor',
    nameKey: 'agents.technologyAdvisor.name',
    roleKey: 'agents.technologyAdvisor.role',
    descriptionKey: 'agents.technologyAdvisor.description',
    status: 'coming_soon',
    enabled: false,
    knowledgeScopes: [],
    version: VERSION,
  },
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

function agent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'builder',
    nameKey: 'agents.builder.name',
    roleKey: 'agents.builder.role',
    descriptionKey: 'agents.builder.description',
    status: 'active',
    enabled: true,
    knowledgeScopes: [],
    version: VERSION,
    ...overrides,
  };
}

describe('system agent parser', () => {
  test('keeps a well-formed extra agent and drops unknown keys', () => {
    const parsed = parseSystemAgents({
      agents: [
        agent({ instructions: 'secret prompt', toolProfile: 'write', modelChoice: 'server' }),
        agent({
          id: 'research',
          nameKey: 'agents.research.name',
          roleKey: 'agents.research.role',
          descriptionKey: 'agents.research.description',
          status: 'disabled',
          enabled: false,
          teamRole: { teamId: 'coding', roleName: 'lead' },
        }),
      ],
    });
    assert.ok(parsed);
    assert.deepEqual(
      parsed.map((item) => item.id),
      ['builder', 'research'],
    );
    assert.equal('instructions' in parsed[0], false);
    assert.equal('toolProfile' in parsed[0], false);
    assert.equal('modelChoice' in parsed[0], false);
    assert.equal('teamRole' in parsed[1], false);
    assert.equal(parsed[1].status, 'disabled');
  });

  test('rejects empty, malformed, and bad-status payloads', () => {
    assert.equal(parseSystemAgents(null), null);
    assert.equal(parseSystemAgents({}), null);
    assert.equal(parseSystemAgents([]), null);
    assert.equal(parseSystemAgents({ agents: [] }), null);
    assert.equal(parseSystemAgents({ agents: [agent({ status: 'draft' })] }), null);
    assert.equal(parseSystemAgents({ agents: [agent({ version: 'FALLBACK' })] }), null);
    assert.equal(parseSystemAgents({ agents: [agent({ version: 'abc' })] }), null);
    assert.equal(parseSystemAgents({ agents: [agent({ enabled: 'true' })] }), null);
    assert.equal(
      parseSystemAgents({ agents: [agent({ knowledgeScopes: [{ id: 'policies', type: 'shared' }, { id: '', type: 'shared' }] })] }),
      null,
    );
  });

  test('the builder fallback is one public row and not a hash', () => {
    assert.equal(BUILDER_FALLBACK_AGENT.id, 'builder');
    assert.equal(BUILDER_FALLBACK_AGENT.nameKey, 'agents.builder.name');
    assert.equal(BUILDER_FALLBACK_AGENT.roleKey, 'agents.builder.role');
    assert.equal(BUILDER_FALLBACK_AGENT.descriptionKey, 'agents.builder.description');
    assert.equal(BUILDER_FALLBACK_AGENT.status, 'active');
    assert.equal(BUILDER_FALLBACK_AGENT.enabled, true);
    assert.deepEqual(BUILDER_FALLBACK_AGENT.knowledgeScopes, []);
    assert.equal(BUILDER_FALLBACK_AGENT.version, 'fallback');
    assert.equal(VERSION_LIKE(BUILDER_FALLBACK_AGENT.version), false);
    assert.equal('instructions' in BUILDER_FALLBACK_AGENT, false);
    assert.equal('toolProfile' in BUILDER_FALLBACK_AGENT, false);
  });

  test('helpers read the caller array', () => {
    assert.equal(getAgentById(FIXTURE, 'product-strategy')?.id, 'product-strategy');
    assert.equal(getAgentById(FIXTURE, 'unknown-agent-id'), undefined);
    assert.deepEqual(
      listEnabledAgents(FIXTURE).map((item) => item.id),
      ['builder'],
    );
    assert.deepEqual(
      listAgentsByStatus(FIXTURE, 'active').map((item) => item.id),
      ['builder', 'chief-of-staff'],
    );
    assert.deepEqual(
      listAgentsByStatus(FIXTURE, 'coming_soon').map((item) => item.id),
      ['product-strategy', 'technology-advisor'],
    );
    assert.deepEqual(listAgentsByStatus(FIXTURE, 'disabled'), []);
  });

  test('fixture name keys resolve in en, zh-TW, and zh-CN', () => {
    for (const item of FIXTURE) {
      for (const key of [item.nameKey, item.roleKey, item.descriptionKey]) {
        assert.equal(key.startsWith('agents.'), true);
        for (const locale of ALL_LOCALES) {
          const value = resolveNestedString(locale.messages, key);
          assert.equal(value !== null && value.trim().length > 0, true, `Missing ${key} in ${locale.code}`);
        }
      }
    }
  });

  test('the new station messages exist and the Chinese copy is not English', () => {
    const keys = [
      'platform.systemAgentsLoading',
      'platform.systemAgentsLoadError',
      'office.systemAgentsLoadError',
    ];
    const english = ALL_LOCALES[0];
    for (const key of keys) {
      const en = resolveNestedString(english.messages, key);
      assert.ok(en && en.trim().length > 0, key);
      for (const locale of ALL_LOCALES.slice(1)) {
        const value = resolveNestedString(locale.messages, key);
        assert.ok(value && value.trim().length > 0, `${key} in ${locale.code}`);
        assert.notEqual(value, en, `${key} in ${locale.code}`);
      }
    }
    assert.equal(resolveNestedString(ALL_LOCALES[1].messages, 'platform.systemAgentsLoading'), '正在載入席位…');
    assert.equal(resolveNestedString(ALL_LOCALES[2].messages, 'platform.systemAgentsLoading'), '正在加载席位…');
    assert.equal(
      resolveNestedString(ALL_LOCALES[1].messages, 'platform.systemAgentsLoadError'),
      '無法載入席位，目前只顯示 Builder。',
    );
    assert.equal(
      resolveNestedString(ALL_LOCALES[2].messages, 'platform.systemAgentsLoadError'),
      '无法加载席位，目前只显示 Builder。',
    );
    assert.equal(
      resolveNestedString(ALL_LOCALES[1].messages, 'office.systemAgentsLoadError'),
      '無法載入席位，目前只顯示 Builder 的座位。',
    );
    assert.equal(
      resolveNestedString(ALL_LOCALES[2].messages, 'office.systemAgentsLoadError'),
      '无法加载席位，目前只显示 Builder 的座位。',
    );
  });
});

function VERSION_LIKE(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

describe('WORKFLOW-STATUS-02 draft badge state', () => {
  test('draft is a card status, but a system agent payload with draft is still rejected', () => {
    assert.ok((AGENT_STATUSES as readonly string[]).includes('draft'));
    assert.deepEqual([...AGENT_STATUSES], ['active', 'coming_soon', 'draft', 'disabled']);
    assert.equal(parseSystemAgents({ agents: [agent({ status: 'draft' })] }), null);
  });
});
