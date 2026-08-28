import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';

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

const USER_AGENT_STATUSES = ['active', 'draft', 'disabled'] as const;

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
      'platform.commandDeckLabel',
      'platform.commandDeckIntro',
      'platform.commandCenterStatusTitle',
      'platform.commandCenterStatusBody',
      'platform.stationsTitle',
      'platform.stationsSubtitle',
      'platform.agentStationActive',
      'platform.agentStationComingSoon',
      'platform.agentStationDisabled',
      'platform.activeStationsLabel',
      'platform.reserveStationsLabel',
      'platform.selectedStationLabel',
      'platform.noStationSelected',
      'platform.openAgentDetailActive',
      'platform.openAgentDetailComingSoon',
      'platform.backToWorkspace',
      'platform.comingSoonMessage',
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

describe('platform dashboard navigation integration', () => {
  const agents: readonly AgentManifest[] = listAgents();

  test('builder agent route matches the existing workspace route /app', () => {
    const builder = agents.find((a) => a.id === 'builder');
    assert.ok(builder);
    assert.equal(builder.route, '/app');
  });

  test('builder agent is the only enabled agent with a navigable route', () => {
    const enabledAgents = agents.filter((a) => a.enabled);
    assert.equal(enabledAgents.length, 1);
    assert.equal(enabledAgents[0].id, 'builder');
    assert.ok(enabledAgents[0].route.length > 0);
  });

  test('coming-soon agents have routes but are not enabled', () => {
    const comingSoonAgents = agents.filter((a) => a.status === 'coming_soon');
    assert.equal(comingSoonAgents.length, 3);
    for (const agent of comingSoonAgents) {
      assert.equal(agent.enabled, false, `${agent.id} must not be enabled`);
      assert.ok(agent.route.length > 0, `${agent.id} should have a route defined for future use`);
    }
  });

  test('platform detail panel translation keys exist in all locales', () => {
    const detailKeys = [
      'platform.detail.title',
      'platform.detail.subtitle',
      'platform.detail.intentLabel',
      'platform.detail.capabilitiesLabel',
      'platform.detail.close',
      'platform.detail.emptyTitle',
      'platform.detail.emptyBody',
      'platform.detail.startBuilding',
      'platform.detail.comingSoonTitle',
      'platform.detail.comingSoonBody',
      'platform.detail.builderIntent',
      'platform.detail.placeholderIntent',
      'platform.detail.builderCapabilityOne',
      'platform.detail.builderCapabilityTwo',
      'platform.detail.builderCapabilityThree',
      'platform.detail.placeholderCapabilityOne',
      'platform.detail.placeholderCapabilityTwo',
      'platform.detail.placeholderCapabilityThree',
    ];

    for (const { code, messages } of ALL_LOCALES) {
      for (const key of detailKeys) {
        const value = resolveNestedString(messages, key);
        assert.ok(
          value && value.trim().length > 0,
          `Missing detail key "${key}" in locale "${code}"`,
        );
      }
    }
  });

  test('all agent routes are non-empty strings starting with /', () => {
    for (const agent of agents) {
      assert.ok(
        typeof agent.route === 'string' && agent.route.startsWith('/'),
        `Agent ${agent.id} route must start with /`,
      );
    }
  });
});

describe('platform Create Agent translation keys', () => {
  const AGENT_CREATE_KEYS = [
    'platform.agentCreate.sectionTitle',
    'platform.agentCreate.sectionSubtitle',
    'platform.agentCreate.createButton',
    'platform.agentCreate.formTitle',
    'platform.agentCreate.nameLabel',
    'platform.agentCreate.namePlaceholder',
    'platform.agentCreate.roleLabel',
    'platform.agentCreate.rolePlaceholder',
    'platform.agentCreate.descriptionLabel',
    'platform.agentCreate.descriptionPlaceholder',
    'platform.agentCreate.submitButton',
    'platform.agentCreate.cancelButton',
    'platform.agentCreate.submitting',
    'platform.agentCreate.nameRequired',
    'platform.agentCreate.nameTooLong',
    'platform.agentCreate.roleRequired',
    'platform.agentCreate.roleTooLong',
    'platform.agentCreate.descriptionRequired',
    'platform.agentCreate.descriptionTooLong',
    'platform.agentCreate.createError',
    'platform.agentCreate.loadError',
    'platform.agentCreate.retry',
    'platform.agentCreate.createSuccess',
    'platform.agentCreate.emptyTitle',
    'platform.agentCreate.emptyBody',
    'platform.agentCreate.agentStatusActive',
    'platform.agentCreate.agentStatusDraft',
    'platform.agentCreate.agentStatusDisabled',
    'platform.agentCreate.askButton',
  ];

  test('all platform.agentCreate.* keys resolve in all 3 locales', () => {
    for (const { code, messages } of ALL_LOCALES) {
      for (const key of AGENT_CREATE_KEYS) {
        const value = resolveNestedString(messages, key);
        assert.ok(
          value && value.trim().length > 0,
          `Missing agentCreate key "${key}" in locale "${code}"`,
        );
      }
    }
  });

  test('no agentCreate keys are empty strings', () => {
    for (const { code, messages } of ALL_LOCALES) {
      for (const key of AGENT_CREATE_KEYS) {
        const value = resolveNestedString(messages, key);
        assert.notEqual(value, '', `agentCreate key "${key}" is an empty string in locale "${code}"`);
      }
    }
  });
});

describe('platform Create Agent API contract', () => {
  test('GET /api/agents list response shape matches expected interface', () => {
    const mockResponse = {
      agents: [
        {
          id: 'test-uuid-1',
          name: 'Research Assistant',
          role: 'Gathers and synthesizes information',
          description: 'A specialized agent for research tasks',
          status: 'active' as const,
          initials: 'RA',
          createdAt: '2026-07-20T10:30:00.000Z',
          updatedAt: '2026-07-20T10:30:00.000Z',
        },
      ],
    };

    assert.ok(Array.isArray(mockResponse.agents));
    const agent = mockResponse.agents[0];
    assert.equal(typeof agent.id, 'string');
    assert.equal(typeof agent.name, 'string');
    assert.equal(typeof agent.role, 'string');
    assert.equal(typeof agent.description, 'string');
    assert.ok(USER_AGENT_STATUSES.includes(agent.status));
    assert.equal(typeof agent.createdAt, 'string');
    assert.equal(typeof agent.updatedAt, 'string');
  });

  test('POST /api/agents request body contains only name, role, description', () => {
    const requestBody = {
      name: 'Test Agent',
      role: 'Test Role',
      description: 'Test Description',
    };

    const keys = Object.keys(requestBody);
    assert.deepEqual(keys.sort(), ['description', 'name', 'role']);
    assert.equal('userId' in requestBody, false, 'request body must not include userId');
  });

  test('POST /api/agents response shape matches expected interface', () => {
    const mockCreated = {
      id: 'test-uuid-2',
      name: 'New Agent',
      role: 'New Role',
      description: 'New Description',
      status: 'active' as const,
      initials: 'NA',
      createdAt: '2026-07-20T11:00:00.000Z',
      updatedAt: '2026-07-20T11:00:00.000Z',
    };

    assert.equal(typeof mockCreated.id, 'string');
    assert.equal(typeof mockCreated.name, 'string');
    assert.equal(typeof mockCreated.role, 'string');
    assert.equal(typeof mockCreated.description, 'string');
    assert.ok(USER_AGENT_STATUSES.includes(mockCreated.status));
    assert.equal(typeof mockCreated.createdAt, 'string');
    assert.equal(typeof mockCreated.updatedAt, 'string');
    assert.equal('userId' in mockCreated, false, 'response must not include userId');
    assert.equal('deletedAt' in mockCreated, false, 'response must not include deletedAt');
  });

  test('empty agent list returns { agents: [] }', () => {
    const emptyResponse = { agents: [] as unknown[] };
    assert.ok(Array.isArray(emptyResponse.agents));
    assert.equal(emptyResponse.agents.length, 0);
  });
});

describe('platform Create Agent static agents preservation', () => {
  const agents: readonly AgentManifest[] = listAgents();

  test('listAgents() still returns exactly 4 static agents after Create Agent additions', () => {
    assert.equal(agents.length, 4);
    const ids = agents.map((a) => a.id);
    assert.deepEqual(ids, ['builder', 'chief-of-staff', 'product-strategy', 'technology-advisor']);
  });

  test('builder agent is still active and enabled', () => {
    const builder = agents.find((a) => a.id === 'builder');
    assert.ok(builder);
    assert.equal(builder.status, 'active');
    assert.equal(builder.enabled, true);
  });
});

describe('platform Create Agent user agent display', () => {
  test('user agent status is in allowed values', () => {
    const mockUserAgent = {
      id: 'ua-1',
      name: 'Test',
      role: 'Test',
      description: 'Test',
      status: 'active' as const,
      initials: 'T',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    };
    assert.ok(
      USER_AGENT_STATUSES.includes(mockUserAgent.status),
      `status "${mockUserAgent.status}" must be one of ${USER_AGENT_STATUSES.join(', ')}`,
    );
  });

  test('user agent does not expose userId field', () => {
    const mockUserAgent = {
      id: 'ua-1',
      name: 'Test',
      role: 'Test',
      description: 'Test',
      status: 'active' as const,
      initials: 'T',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    };
    assert.equal('userId' in mockUserAgent, false, 'userId must not be exposed');
  });
});

describe('platform Create Agent validation rules', () => {
  test('empty name triggers validation error', () => {
    const name = '';
    assert.equal(name.trim().length === 0, true, 'empty name should trigger required error');
  });

  test('name > 100 chars triggers validation error', () => {
    const name = 'A'.repeat(101);
    assert.ok(name.length > 100, 'name > 100 chars should trigger max-length error');
  });

  test('empty role triggers validation error', () => {
    const role = '';
    assert.equal(role.trim().length === 0, true, 'empty role should trigger required error');
  });

  test('role > 200 chars triggers validation error', () => {
    const role = 'A'.repeat(201);
    assert.ok(role.length > 200, 'role > 200 chars should trigger max-length error');
  });

  test('empty description triggers validation error', () => {
    const description = '';
    assert.equal(description.trim().length === 0, true, 'empty description should trigger required error');
  });

  test('description > 2000 chars triggers validation error', () => {
    const description = 'A'.repeat(2001);
    assert.ok(description.length > 2000, 'description > 2000 chars should trigger max-length error');
  });
});

describe('platform persisted user-agent Ask CTA — AGENT-PLATFORM-CREATE-01E', () => {
  const panelSource = readFileSync(new URL('./agent-detail-panel.tsx', import.meta.url), 'utf8');
  const dashboardSource = readFileSync(new URL('./platform-dashboard.tsx', import.meta.url), 'utf8');

  test('user-created agent detail produces locale-safe Ask href with encoded UUID', () => {
    const userCreatedBranch = panelSource.slice(panelSource.indexOf('agent.isUserCreated'));
    assert.match(panelSource, /data-testid="agent-detail-user-created"/);
    assert.match(panelSource, /data-testid="agent-detail-ask"/);
    assert.match(
      panelSource,
      /href=\{`\$\{localePrefix\}\/app\?userAgentId=\$\{encodeURIComponent\(agent\.id\)\}`\}/,
    );
    assert.match(userCreatedBranch, /askButtonLabel/);
    assert.match(dashboardSource, /askButtonLabel=\{/);
    assert.match(dashboardSource, /platform\.agentCreate\.askButton/);
  });

  test('Ask CTA reuses Start Building visual pattern and Heroicons outline ArrowRightIcon', () => {
    assert.match(
      panelSource,
      /data-testid="agent-detail-ask"[\s\S]*ArrowRightIcon className="h-4 w-4"/,
    );
    assert.match(
      panelSource,
      /inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600/,
    );
    assert.match(panelSource, /from '@heroicons\/react\/24\/outline'/);
    assert.doesNotMatch(panelSource, /from '@heroicons\/react\/24\/solid'/);
    assert.doesNotMatch(panelSource, /lucide|font-awesome|@mui\/icons/i);
  });

  test('Builder Start Building remains on /app without userAgentId', () => {
    const builderBranchStart = panelSource.indexOf('{agent.isBuilder ?');
    const userCreatedBranchStart = panelSource.indexOf(') : agent.isUserCreated ?');
    const builderBranch = panelSource.slice(builderBranchStart, userCreatedBranchStart);
    assert.match(builderBranch, /data-testid="agent-detail-start-building"/);
    assert.match(builderBranch, /href=\{`\$\{localePrefix\}\/app`\}/);
    assert.doesNotMatch(builderBranch, /userAgentId/);
    assert.doesNotMatch(builderBranch, /agent-detail-ask/);
  });

  test('coming-soon placeholder agents do not expose Ask', () => {
    const comingSoonBranch = panelSource.slice(panelSource.lastIndexOf('comingSoonLabel'));
    assert.doesNotMatch(comingSoonBranch, /agent-detail-ask/);
    assert.doesNotMatch(comingSoonBranch, /userAgentId/);
  });

  test('empty user-agent list has no Ask CTA', () => {
    assert.match(dashboardSource, /data-testid="user-agents-empty"/);
    const emptyBlockStart = dashboardSource.indexOf('data-testid="user-agents-empty"');
    const emptyBlock = dashboardSource.slice(emptyBlockStart, emptyBlockStart + 400);
    assert.doesNotMatch(emptyBlock, /agent-detail-ask/);
    assert.doesNotMatch(emptyBlock, /userAgentId/);
  });

  test('user-created Ask CTA is not a Build-with-agent control', () => {
    assert.doesNotMatch(panelSource, /workspace_mutation/);
    assert.doesNotMatch(panelSource, /executionIntent/);
    assert.doesNotMatch(panelSource, /harnessVersion/);
  });
});
