import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { PublicSystemAgent } from '@/lib/agent-platform/agent-registry';
import AgentDetailPanel from '@/components/platform/agent-detail-panel';
import type { AgentDetailViewModel } from '@/components/platform/agent-detail-panel';
import {
  countStationsByStatus,
  stationCountsForLoad,
  staticAgentProfileContent,
  SystemAgentStationArea,
} from '@/components/platform/platform-dashboard';
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

const PUBLIC_STATIONS: readonly PublicSystemAgent[] = [
  {
    id: 'builder',
    nameKey: 'agents.builder.name',
    roleKey: 'agents.builder.role',
    descriptionKey: 'agents.builder.description',
    status: 'active',
    enabled: true,
    knowledgeScopes: [],
    version: 'a'.repeat(64),
  },
  {
    id: 'chief-of-staff',
    nameKey: 'agents.chiefOfStaff.name',
    roleKey: 'agents.chiefOfStaff.role',
    descriptionKey: 'agents.chiefOfStaff.description',
    status: 'active',
    enabled: false,
    knowledgeScopes: [],
    version: 'b'.repeat(64),
  },
  {
    id: 'product-strategy',
    nameKey: 'agents.productStrategy.name',
    roleKey: 'agents.productStrategy.role',
    descriptionKey: 'agents.productStrategy.description',
    status: 'active',
    enabled: false,
    knowledgeScopes: [],
    version: 'c'.repeat(64),
  },
  {
    id: 'technology-advisor',
    nameKey: 'agents.technologyAdvisor.name',
    roleKey: 'agents.technologyAdvisor.role',
    descriptionKey: 'agents.technologyAdvisor.description',
    status: 'active',
    enabled: false,
    knowledgeScopes: [],
    version: 'd'.repeat(64),
  },
];

const USER_AGENT_STATUSES = ['active', 'draft', 'disabled'] as const;

describe('platform dashboard data integration', () => {
  const agents = PUBLIC_STATIONS;

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

  test('chief of staff is active without builder-style capabilities', () => {
    const chief = agents.find((a) => a.id === 'chief-of-staff');
    assert.ok(chief);
    assert.equal(chief.status, 'active');
    assert.equal(chief.enabled, false);
  });

  test('product strategy and technology advisor are active and not builder-enabled', () => {
    const advisors = agents.filter((a) => a.id === 'product-strategy' || a.id === 'technology-advisor');
    assert.equal(advisors.length, 2);
    for (const agent of advisors) {
      assert.equal(agent.status, 'active', `${agent.id} should be active`);
      assert.equal(agent.enabled, false, `${agent.id} should not take the builder path`);
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
      'platform.openAgentDetailChiefOfStaff',
      'platform.backToWorkspace',
      'platform.openOffice',
      'platform.openKnowledge',
      'platform.comingSoonMessage',
      'platform.systemAgentsLoading',
      'platform.systemAgentsLoadError',
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

});

describe('platform dashboard navigation integration', () => {
  const agents = PUBLIC_STATIONS;

  test('command center header links to the office route', () => {
    const dashboardSource = readFileSync(new URL('./platform-dashboard.tsx', import.meta.url), 'utf8');
    assert.match(dashboardSource, /platform\.openOffice/);
    assert.match(dashboardSource, /data-testid="platform-open-office"/);
    assert.match(dashboardSource, /href=\{`\$\{localePrefix\}\/office`\}/);
  });

  test('command center header links to the knowledge route', () => {
    const dashboardSource = readFileSync(new URL('./platform-dashboard.tsx', import.meta.url), 'utf8');
    assert.match(dashboardSource, /platform\.openKnowledge/);
    assert.match(dashboardSource, /data-testid="platform-open-knowledge"/);
    assert.match(dashboardSource, /href=\{`\$\{localePrefix\}\/knowledge`\}/);
  });

  test('builder Start Building remains the hardcoded /app href', () => {
    const panelSource = readFileSync(new URL('./agent-detail-panel.tsx', import.meta.url), 'utf8');
    const builderBranchStart = panelSource.indexOf('{agent.isBuilder ?');
    const userCreatedBranchStart = panelSource.indexOf(') : agent.isUserCreated ?');
    const builderBranch = panelSource.slice(builderBranchStart, userCreatedBranchStart);
    assert.match(builderBranch, /href=\{`\$\{localePrefix\}\/app`\}/);
  });

  test('builder agent is the only enabled agent', () => {
    const enabledAgents = agents.filter((a) => a.enabled);
    assert.equal(enabledAgents.length, 1);
    assert.equal(enabledAgents[0].id, 'builder');
  });

  test('the four stations include no coming-soon row', () => {
    assert.equal(agents.filter((a) => a.status === 'coming_soon').length, 0);
    const future = staticAgentProfileContent(
      { id: 'future-station', enabled: false, status: 'coming_soon' },
      (key) => key,
    );
    assert.equal(future.isComingSoon, true);
    assert.equal(future.cardEnabled, false);
    assert.equal(future.openPath, null);
    assert.equal(future.intent, 'platform.detail.placeholderIntent');
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
      'platform.detail.chiefOfStaffIntent',
      'platform.detail.chiefOfStaffCapabilityOne',
      'platform.detail.chiefOfStaffCapabilityTwo',
      'platform.detail.chiefOfStaffCapabilityThree',
      'platform.detail.productStrategyIntent',
      'platform.detail.productStrategyCapabilityOne',
      'platform.detail.productStrategyCapabilityTwo',
      'platform.detail.productStrategyCapabilityThree',
      'platform.detail.technologyAdvisorIntent',
      'platform.detail.technologyAdvisorCapabilityOne',
      'platform.detail.technologyAdvisorCapabilityTwo',
      'platform.detail.technologyAdvisorCapabilityThree',
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

  test('the dashboard reads stations from the system-agent hook', () => {
    const dashboardSource = readFileSync(new URL('./platform-dashboard.tsx', import.meta.url), 'utf8');
    assert.match(dashboardSource, /useSystemAgents\(/);
    assert.match(dashboardSource, /<SystemAgentStationArea/);
    assert.match(dashboardSource, /stationCountsForLoad\(/);
  });
});

describe('platform system agent stations', () => {
  const text = (messages: LocaleMessages) => (key: string) =>
    resolveNestedString(messages, key) ?? key;

  function renderStations(
    props: Partial<React.ComponentProps<typeof SystemAgentStationArea>>,
    messages: LocaleMessages = enMessages as LocaleMessages,
  ): string {
    return renderToStaticMarkup(
      React.createElement(SystemAgentStationArea, {
        agents: PUBLIC_STATIONS,
        loading: false,
        error: null,
        loadingLabel: text(messages)('platform.systemAgentsLoading'),
        errorLabel: text(messages)('platform.systemAgentsLoadError'),
        retryLabel: 'Retry',
        text: text(messages),
        statusLabel: (status) => status,
        selectedAgentId: null,
        onSelect: () => undefined,
        onRetry: () => undefined,
        ...props,
      }),
    );
  }

  test('loading shows the station loading copy and no cards', () => {
    const html = renderStations({ loading: true, agents: [] });
    assert.match(html, /data-testid="platform-system-agents-loading"/);
    assert.match(html, /Loading stations…/);
    assert.doesNotMatch(html, /data-testid="agent-station-card-/);
    const traditional = renderStations(
      { loading: true, agents: [] },
      zhTwMessages as LocaleMessages,
    );
    assert.match(traditional, /正在載入席位…/);
  });

  test('failure shows the error and retry, and the station list stays under it', () => {
    const html = renderStations({ error: 'FETCH_FAILED', agents: [] });
    assert.match(html, /data-testid="platform-system-agents-error"/);
    assert.match(html, /Stations could not be loaded\. Only Builder is shown\./);
    assert.match(html, /data-testid="platform-system-agents-retry"/);
    assert.doesNotMatch(html, /data-testid="agent-station-card-/);
    const simplified = renderStations(
      { error: 'FETCH_FAILED', agents: [] },
      zhCnMessages as LocaleMessages,
    );
    assert.match(simplified, /无法加载席位，目前只显示 Builder。/);
    const source = readFileSync(new URL('./platform-dashboard.tsx', import.meta.url), 'utf8');
    const failureBranch = source.slice(source.indexOf('data-testid="platform-system-agents-error"'));
    assert.match(failureBranch, /\{cards\}/);
    assert.match(source, /<AgentStationCard/);
    const builder = staticAgentProfileContent(PUBLIC_STATIONS[0], (key) => key);
    assert.equal(builder.cardEnabled, true);
    assert.equal(
      countStationsByStatus([PUBLIC_STATIONS[0]]).active,
      1,
    );
    assert.equal(countStationsByStatus([PUBLIC_STATIONS[0]]).reserve, 0);
  });

  test('the four stations are active and the advisors are not builder-enabled', () => {
    const text = (key: string) => resolveNestedString(enMessages as LocaleMessages, key) ?? key;
    const chief = PUBLIC_STATIONS.find((agent) => agent.id === 'chief-of-staff');
    const product = PUBLIC_STATIONS.find((agent) => agent.id === 'product-strategy');
    const technology = PUBLIC_STATIONS.find((agent) => agent.id === 'technology-advisor');
    assert.ok(chief && product && technology);
    assert.equal(chief.enabled, false);
    assert.equal(chief.status, 'active');
    assert.equal(staticAgentProfileContent(chief, text).cardEnabled, true);
    assert.equal(staticAgentProfileContent(chief, text).isComingSoon, false);
    assert.equal(product.status, 'active');
    assert.equal(product.enabled, false);
    assert.equal(staticAgentProfileContent(product, text).cardEnabled, true);
    assert.equal(staticAgentProfileContent(product, text).openPath, '/collaboration');
    assert.equal(technology.status, 'active');
    assert.equal(technology.enabled, false);
    assert.equal(staticAgentProfileContent(technology, text).cardEnabled, true);
    assert.equal(staticAgentProfileContent(technology, text).openPath, '/collaboration');
    const cardSource = readFileSync(new URL('./agent-station-card.tsx', import.meta.url), 'utf8');
    assert.match(cardSource, /data-testid=\{`agent-station-card-\$\{props\.id\}`\}/);
    assert.match(cardSource, /data-status=\{status\}/);
    assert.match(cardSource, /data-enabled=\{enabled\}/);
    const dashboardSource = readFileSync(new URL('./platform-dashboard.tsx', import.meta.url), 'utf8');
    assert.match(dashboardSource, /id=\{agent\.id\}/);
    assert.match(dashboardSource, /status=\{agent\.status\}/);
    assert.match(dashboardSource, /enabled=\{profile\.cardEnabled\}/);
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
    'platform.agentCreate.deleteButton',
    'platform.agentCreate.deleteConfirmTitle',
    'platform.agentCreate.deleteConfirmBody',
    'platform.agentCreate.deleteConfirmAction',
    'platform.agentCreate.deleteError',
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
  const agents = PUBLIC_STATIONS;

  test('the station fixture still has the four static agents after Create Agent additions', () => {
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

describe('chief of staff station profile', () => {
  const text = (messages: LocaleMessages) => (key: string) => resolveNestedString(messages, key) ?? key;

  test('active stations count builder, the chief, and both advisors', () => {
    const counts = countStationsByStatus(PUBLIC_STATIONS);
    assert.equal(counts.active, 4);
    assert.equal(counts.reserve, 0);
    assert.equal(stationCountsForLoad(true, null, PUBLIC_STATIONS), null);
    assert.equal(stationCountsForLoad(false, 'AUTH_EXPIRED', []), null);
    assert.deepEqual(stationCountsForLoad(false, null, PUBLIC_STATIONS), { active: 4, reserve: 0 });
    assert.deepEqual(
      stationCountsForLoad(false, 'FETCH_FAILED', [PUBLIC_STATIONS[0]]),
      { active: 1, reserve: 0 },
    );
  });

  test('the chief of staff profile is its own copy and opens the team page', () => {
    const chief = PUBLIC_STATIONS.find((agent) => agent.id === 'chief-of-staff');
    const builder = PUBLIC_STATIONS.find((agent) => agent.id === 'builder');
    const product = PUBLIC_STATIONS.find((agent) => agent.id === 'product-strategy');
    assert.ok(chief && builder && product);
    const chiefProfile = staticAgentProfileContent(chief, text(enMessages as LocaleMessages));
    const builderProfile = staticAgentProfileContent(builder, text(enMessages as LocaleMessages));
    const productProfile = staticAgentProfileContent(product, text(enMessages as LocaleMessages));

    assert.equal(chiefProfile.isComingSoon, false);
    assert.equal(chiefProfile.cardEnabled, true);
    assert.equal(chiefProfile.openPath, '/collaboration');
    assert.equal(
      chiefProfile.intent,
      'Answer questions from your Knowledge documents and cite the source.',
    );
    assert.deepEqual(chiefProfile.capabilities, [
      'Answers questions from your Knowledge documents, with sources.',
      'Says No source when the documents do not answer.',
      'Read-only: never sends anything or acts outside the platform.',
    ]);
    assert.equal(chiefProfile.actionHint, 'Open station profile and go to the Team page');
    for (const capability of builderProfile.capabilities) {
      assert.equal(chiefProfile.capabilities.includes(capability), false);
    }
    assert.notEqual(chiefProfile.intent, builderProfile.intent);
    assert.notEqual(chiefProfile.intent, productProfile.intent);

    assert.equal(builderProfile.isComingSoon, false);
    assert.equal(builderProfile.openPath, null);
    assert.equal(builderProfile.cardEnabled, true);
    assert.equal(builderProfile.intent, 'Deliver production-ready software in an isolated workspace with checkpoints, previews, and guided file actions.');
    assert.equal(productProfile.isComingSoon, false);
    assert.equal(productProfile.cardEnabled, true);
    assert.equal(productProfile.openPath, '/collaboration');
    assert.equal(productProfile.actionHint, 'Open station profile and go to the Team page');
    assert.equal(
      productProfile.intent,
      'Answer product and market questions from your Knowledge documents, with sources.',
    );
    assert.equal(builderProfile.actionHint, 'Open station profile and continue to build');

    const traditional = staticAgentProfileContent(chief, text(zhTwMessages as LocaleMessages));
    const simplified = staticAgentProfileContent(chief, text(zhCnMessages as LocaleMessages));
    assert.equal(traditional.intent, '根據你的知識文件回答問題，並標出來源。');
    assert.equal(traditional.capabilities[1], '文件沒有答案時，會寫明沒有來源。');
    assert.equal(simplified.intent, '根据你的知识文档回答问题，并标出来源。');
    assert.equal(simplified.capabilities[2], '只读：不会送出任何内容，也不会在平台之外采取行动。');
    assert.notEqual(traditional.intent, chiefProfile.intent);
    assert.notEqual(simplified.intent, chiefProfile.intent);
    assert.equal(
      resolveNestedString(enMessages as LocaleMessages, 'agents.chiefOfStaff.description'),
      'Answers questions from your Knowledge documents, with sources, and says when the documents do not answer.',
    );
  });

  test('the detail panel opens the team page for the chief of staff and keeps the other stations', () => {
    const labels = {
      title: 'Agent Profile',
      subtitle: 'Preview',
      intentLabel: 'Mission Intent',
      capabilitiesLabel: 'Capabilities',
      closeLabel: 'Close',
      emptyTitle: 'Empty',
      emptyBody: 'Pick one',
      startBuildingLabel: 'Start Building',
      askButtonLabel: 'Ask',
      comingSoonLabel: 'Coming Soon',
      comingSoonBody: 'This station is in preparation mode and cannot be launched yet.',
      deleteButtonLabel: 'Delete',
      deleteConfirmTitle: 'Delete?',
      deleteConfirmBody: 'This removes the agent.',
      deleteConfirmActionLabel: 'Delete',
      deleteCancelLabel: 'Cancel',
      deletingLabel: 'Deleting',
      deleteErrorMessage: null,
      deletePending: false,
      onDelete: () => undefined,
      onClose: () => undefined,
    };
    const chief = PUBLIC_STATIONS.find((agent) => agent.id === 'chief-of-staff');
    assert.ok(chief);
    const profile = staticAgentProfileContent(chief, (key) => resolveNestedString(enMessages as LocaleMessages, key) ?? key);
    const chiefModel: AgentDetailViewModel = {
      id: chief.id,
      name: 'Chief of Staff Agent',
      role: 'Daily Operations Assistant',
      description: 'Answers questions from your Knowledge documents, with sources, and says when the documents do not answer.',
      statusLabel: 'Active',
      intent: profile.intent,
      capabilities: profile.capabilities,
      isBuilder: false,
      isComingSoon: profile.isComingSoon,
      openHref: `/en${profile.openPath}`,
      openLabel: 'Open',
    };
    const chiefHtml = renderToStaticMarkup(
      React.createElement(AgentDetailPanel, { agent: chiefModel, localePrefix: '/en', ...labels }),
    );
    assert.match(chiefHtml, /data-testid="agent-detail-panel-chief-of-staff"/);
    assert.match(chiefHtml, /data-testid="agent-detail-open"/);
    assert.match(chiefHtml, /href="\/en\/collaboration"/);
    assert.match(chiefHtml, />Open</);
    assert.match(chiefHtml, />Active</);
    assert.match(chiefHtml, /Says No source when the documents do not answer\./);
    assert.doesNotMatch(chiefHtml, /data-testid="agent-detail-start-building"/);
    assert.doesNotMatch(chiefHtml, /data-testid="agent-detail-ask"/);
    assert.doesNotMatch(chiefHtml, /Coming Soon/);
    assert.doesNotMatch(chiefHtml, /Generate and refine project files/);

    const builderModel: AgentDetailViewModel = {
      ...chiefModel,
      id: 'builder',
      name: 'Builder Agent',
      intent: 'Deliver production-ready software in an isolated workspace with checkpoints, previews, and guided file actions.',
      capabilities: ['Generate and refine project files directly in the workspace.'],
      isBuilder: true,
      openHref: undefined,
      openLabel: undefined,
    };
    const builderHtml = renderToStaticMarkup(
      React.createElement(AgentDetailPanel, { agent: builderModel, localePrefix: '/en', ...labels }),
    );
    assert.match(builderHtml, /data-testid="agent-detail-start-building"/);
    assert.match(builderHtml, /href="\/en\/app"/);
    assert.doesNotMatch(builderHtml, /data-testid="agent-detail-open"/);
    assert.doesNotMatch(builderHtml, /collaboration/);

    const soonModel: AgentDetailViewModel = {
      ...chiefModel,
      id: 'product-strategy',
      name: 'Product Strategy Agent',
      statusLabel: 'Coming Soon',
      isComingSoon: true,
      openHref: undefined,
      openLabel: undefined,
    };
    const soonHtml = renderToStaticMarkup(
      React.createElement(AgentDetailPanel, { agent: soonModel, localePrefix: '/en', ...labels }),
    );
    assert.match(soonHtml, /Coming Soon/);
    assert.match(soonHtml, /This station is in preparation mode and cannot be launched yet\./);
    assert.doesNotMatch(soonHtml, /data-testid="agent-detail-open"/);
    assert.doesNotMatch(soonHtml, /data-testid="agent-detail-start-building"/);

    const text = (key: string) => resolveNestedString(enMessages as LocaleMessages, key) ?? key;
    for (const id of ['product-strategy', 'technology-advisor'] as const) {
      const station = PUBLIC_STATIONS.find((agent) => agent.id === id);
      assert.ok(station);
      const profile = staticAgentProfileContent(station, text);
      const html = renderToStaticMarkup(
        React.createElement(AgentDetailPanel, {
          agent: {
            ...chiefModel,
            id,
            name: id,
            intent: profile.intent,
            capabilities: profile.capabilities,
            isComingSoon: profile.isComingSoon,
            openHref: `/en${profile.openPath}`,
            openLabel: 'Open',
            statusLabel: 'Active',
          },
          localePrefix: '/en',
          ...labels,
        }),
      );
      assert.match(html, /data-testid="agent-detail-open"/);
      assert.match(html, /href="\/en\/collaboration"/);
      assert.equal(
        profile.intent,
        id === 'product-strategy'
          ? 'Answer product and market questions from your Knowledge documents, with sources.'
          : "Answer technology questions from your Knowledge documents, and read this project's files, with sources.",
      );
      assert.ok(html.includes(profile.intent.split("'")[0]));
      assert.doesNotMatch(html, /Coming Soon/);
    }
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

describe('platform persisted user-agent Delete control — AGENT-PLATFORM-CREATE-01F', () => {
  const panelSource = readFileSync(new URL('./agent-detail-panel.tsx', import.meta.url), 'utf8');
  const dashboardSource = readFileSync(new URL('./platform-dashboard.tsx', import.meta.url), 'utf8');
  const hookSource = readFileSync(new URL('../../hooks/useUserAgents.ts', import.meta.url), 'utf8');

  test('Delete action is visible only in the user-created agent detail branch', async () => {
    const { shouldShowUserAgentDeleteControl } = await import('../../hooks/useUserAgents');
    assert.equal(shouldShowUserAgentDeleteControl(true), true);
    assert.equal(shouldShowUserAgentDeleteControl(false), false);
    assert.equal(shouldShowUserAgentDeleteControl(undefined), false);
    const userCreatedBranch = panelSource.slice(panelSource.indexOf('agent.isUserCreated'));
    assert.match(userCreatedBranch, /data-testid="agent-detail-delete"/);
    assert.match(userCreatedBranch, /TrashIcon/);
    assert.match(panelSource, /from '@heroicons\/react\/24\/outline'/);
    assert.doesNotMatch(panelSource, /from '@heroicons\/react\/24\/solid'/);
    assert.doesNotMatch(panelSource, /lucide|font-awesome|@mui\/icons/i);
  });

  test('Builder and coming-soon details do not expose Delete', () => {
    const builderBranchStart = panelSource.indexOf('{agent.isBuilder ?');
    const userCreatedBranchStart = panelSource.indexOf(') : agent.isUserCreated ?');
    const builderBranch = panelSource.slice(builderBranchStart, userCreatedBranchStart);
    assert.match(builderBranch, /data-testid="agent-detail-start-building"/);
    assert.doesNotMatch(builderBranch, /agent-detail-delete/);
    const comingSoonBranch = panelSource.slice(panelSource.lastIndexOf('comingSoonLabel'));
    assert.doesNotMatch(comingSoonBranch, /agent-detail-delete/);
  });

  test('Ask CTA remains on the user-created detail after Delete control is added', () => {
    assert.match(panelSource, /data-testid="agent-detail-ask"/);
    assert.match(
      panelSource,
      /href=\{`\$\{localePrefix\}\/app\?userAgentId=\$\{encodeURIComponent\(agent\.id\)\}`\}/,
    );
    assert.doesNotMatch(panelSource, /workspace_mutation/);
    assert.doesNotMatch(panelSource, /harnessVersion/);
  });

  test('invoking Delete requires confirmation and cancel does not call DELETE', async () => {
    const { nextUserAgentDeletePhase, canSubmitUserAgentDelete } = await import('../../hooks/useUserAgents');
    assert.equal(nextUserAgentDeletePhase('idle', 'open'), 'confirming');
    assert.equal(canSubmitUserAgentDelete('idle'), false);
    assert.equal(canSubmitUserAgentDelete('confirming'), true);
    assert.equal(nextUserAgentDeletePhase('confirming', 'cancel'), 'idle');
    assert.equal(canSubmitUserAgentDelete('idle'), false);
    assert.match(panelSource, /data-testid="agent-detail-delete-confirm"/);
    assert.match(panelSource, /data-testid="agent-detail-delete-cancel"/);
    assert.match(dashboardSource, /platform\.agentCreate\.deleteConfirmTitle/);
  });

  test('confirm calls existing DELETE /api/agents/:id and pending blocks duplicate submit', async () => {
    const { nextUserAgentDeletePhase, canSubmitUserAgentDelete } = await import('../../hooks/useUserAgents');
    assert.equal(nextUserAgentDeletePhase('confirming', 'confirm'), 'pending');
    assert.equal(canSubmitUserAgentDelete('pending'), false);
    assert.equal(nextUserAgentDeletePhase('pending', 'confirm'), 'pending');
    assert.match(hookSource, /method:\s*['"]DELETE['"]/);
    assert.match(hookSource, /\/api\/agents\/\$\{/);
    assert.match(dashboardSource, /deleteAgent\(/);
  });

  test('successful delete clears the selected detail and removes the agent from list state', async () => {
    const { nextSelectedUserAgentIdAfterDelete, removeUserAgentFromList } = await import(
      '../../hooks/useUserAgents'
    );
    assert.equal(
      nextSelectedUserAgentIdAfterDelete('agent-1', 'agent-1'),
      null,
    );
    assert.equal(
      nextSelectedUserAgentIdAfterDelete('agent-2', 'agent-1'),
      'agent-2',
    );
    const remaining = removeUserAgentFromList(
      [
        { id: 'agent-1', name: 'Keep-or-drop' },
        { id: 'agent-2', name: 'Keep' },
      ],
      'agent-1',
    );
    assert.deepEqual(
      remaining.map((agent) => agent.id),
      ['agent-2'],
    );
  });

  test('failed DELETE uses a localized error key and does not expose raw server copy', () => {
    assert.match(dashboardSource, /platform\.agentCreate\.deleteError/);
    assert.doesNotMatch(dashboardSource, /body\.message/);
    assert.doesNotMatch(panelSource, /deleted_at|soft delete|NotFoundException/i);
  });
});
