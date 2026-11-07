import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OfficeScreenView, type OfficeScreenViewProps } from '@/components/office/office-screen';
import {
  BUILDER_DESK_ID,
  FORMER_DESK_ID,
  TEAM_DESK_ID,
  buildOfficeDesks,
  officeRegistryFromManifests,
  type OfficeDesk,
  type OfficeRun,
  type OfficeUserAgentRef,
} from '@/lib/office/office.logic';
import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';

const NOW = Date.parse('2026-11-05T06:00:00.000Z');
const SHARED_SCOPE_IDS = [
  'company-monthly-reports',
  'three-year-goals',
  'strategy-docs',
  'policies',
  'meeting-summaries',
];

function stationScopes(specialist: string) {
  return [...SHARED_SCOPE_IDS, specialist].map((id) => ({ id }));
}

const STATION_FIXTURE = [
  { id: 'builder', status: 'active', nameKey: 'agents.builder.name', roleKey: 'agents.builder.role', knowledgeScopes: stationScopes('codebase-context') },
  { id: 'chief-of-staff', status: 'active', nameKey: 'agents.chiefOfStaff.name', roleKey: 'agents.chiefOfStaff.role', knowledgeScopes: stationScopes('contract-templates') },
  { id: 'product-strategy', status: 'active', nameKey: 'agents.productStrategy.name', roleKey: 'agents.productStrategy.role', knowledgeScopes: stationScopes('market-data') },
  { id: 'technology-advisor', status: 'active', nameKey: 'agents.technologyAdvisor.name', roleKey: 'agents.technologyAdvisor.role', knowledgeScopes: stationScopes('tech-landscape') },
];
const registry = officeRegistryFromManifests(STATION_FIXTURE);

const OFFICE_COPY = {
  en: {
    title: 'Office',
    subtitle: 'Your agents at work',
    loading: 'Loading…',
    backToPlatform: 'Command Center',
    refresh: 'Refresh',
    updatedAgo: 'Updated {seconds}s ago',
    emptyTitle: 'The office is quiet',
    emptyBody: 'Create an agent in the Command Center to fill a desk.',
    runsLoadError: 'Could not load run status.',
    agentsLoadError: 'Could not load your agents.',
    systemAgentsLoadError: 'Stations could not be loaded. Only the Builder desk is shown.',
    retry: 'Try again',
    deskHint: 'Open desk',
    formerAgents: 'Former agents',
    teamDesk: 'Team',
    teamRole: 'Role: {role}',
    lastRun: 'Last run',
    currentRun: 'Current run',
    recentRuns: 'Recent runs',
    noRuns: 'No runs yet',
    outcomeUnknown: 'Finished — check the workspace for applied changes.',
    started: 'Started',
    duration: 'Duration',
    tokens: 'Tokens',
    openWorkspace: 'Open workspace',
    agentProfile: 'Agent profile',
    closePanel: 'Close',
    comingSoonBody: 'This desk is reserved for a future agent.',
    knowledgeBadge: '{count} documents',
    knowledgeBadgeOne: '{count} document',
    'status.queued': 'Queued',
    'status.working': 'Working',
    'status.stopping': 'Stopping',
    'status.done': 'Done',
    'status.failed': 'Failed',
    'status.stopped': 'Stopped',
    'status.timedOut': 'Timed out',
    'status.idle': 'Idle',
    'status.vacant': 'Vacant desk',
    'mode.ask': 'Ask',
    'mode.build': 'Build',
    'mode.agent': 'Agent',
    'mode.unknown': 'Run',
  },
  'zh-TW': {
    title: '辦公室',
    subtitle: '你的代理正在工作',
    loading: '載入中…',
    backToPlatform: '指揮中心',
    refresh: '重新整理',
    updatedAgo: '{seconds} 秒前更新',
    emptyTitle: '辦公室很安靜',
    emptyBody: '到指揮中心建立代理來填補座位。',
    runsLoadError: '無法載入執行狀態。',
    agentsLoadError: '無法載入你的代理。',
    systemAgentsLoadError: '無法載入席位，目前只顯示 Builder 的座位。',
    retry: '再試一次',
    deskHint: '開啟座位',
    formerAgents: '已離職代理',
    teamDesk: '團隊',
    teamRole: '角色：{role}',
    lastRun: '上次執行',
    currentRun: '目前執行',
    recentRuns: '最近執行',
    noRuns: '尚無執行',
    outcomeUnknown: '已完成 — 請到工作區確認已套用的變更。',
    started: '開始',
    duration: '時長',
    tokens: '代幣',
    openWorkspace: '開啟工作區',
    agentProfile: '代理檔案',
    closePanel: '關閉',
    comingSoonBody: '此座位保留給未來的代理。',
    knowledgeBadge: '{count} 份文件',
    knowledgeBadgeOne: '{count} 份文件',
    'status.queued': '排隊中',
    'status.working': '工作中',
    'status.stopping': '停止中',
    'status.done': '已完成',
    'status.failed': '失敗',
    'status.stopped': '已停止',
    'status.timedOut': '逾時',
    'status.idle': '閒置',
    'status.vacant': '空座位',
    'mode.ask': '提問',
    'mode.build': '建置',
    'mode.agent': '代理人',
    'mode.unknown': '執行',
  },
  'zh-CN': {
    title: '办公室',
    subtitle: '你的代理正在工作',
    loading: '加载中…',
    backToPlatform: '指挥中心',
    refresh: '刷新',
    updatedAgo: '{seconds} 秒前更新',
    emptyTitle: '办公室很安静',
    emptyBody: '到指挥中心创建代理来填补座位。',
    runsLoadError: '无法加载运行状态。',
    agentsLoadError: '无法加载你的代理。',
    systemAgentsLoadError: '无法加载席位，目前只显示 Builder 的座位。',
    retry: '重试',
    deskHint: '打开工位',
    formerAgents: '已离职代理',
    teamDesk: '团队',
    teamRole: '角色：{role}',
    lastRun: '上次运行',
    currentRun: '当前运行',
    recentRuns: '最近运行',
    noRuns: '暂无运行',
    outcomeUnknown: '已完成 — 请到工作区确认已应用的更改。',
    started: '开始',
    duration: '时长',
    tokens: '令牌',
    openWorkspace: '打开工作区',
    agentProfile: '代理档案',
    closePanel: '关闭',
    comingSoonBody: '此工位保留给未来的代理。',
    knowledgeBadge: '{count} 份文档',
    knowledgeBadgeOne: '{count} 份文档',
    'status.queued': '排队中',
    'status.working': '工作中',
    'status.stopping': '停止中',
    'status.done': '已完成',
    'status.failed': '失败',
    'status.stopped': '已停止',
    'status.timedOut': '超时',
    'status.idle': '空闲',
    'status.vacant': '空工位',
    'mode.ask': '提问',
    'mode.build': '构建',
    'mode.agent': '智能体',
    'mode.unknown': '运行',
  },
} as const;

const LOCALES = [
  { code: 'en' as const, messages: enMessages, openOffice: 'Office' },
  { code: 'zh-TW' as const, messages: zhTwMessages, openOffice: '辦公室' },
  { code: 'zh-CN' as const, messages: zhCnMessages, openOffice: '办公室' },
];

function readMessage(source: Record<string, unknown>, path: string): string | null {
  let current: unknown = source;
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : null;
}

function run(overrides: Partial<OfficeRun> = {}): OfficeRun {
  return {
    executionId: 'exec-1',
    status: 'running',
    sessionId: 'session-1',
    provider: 'anthropic',
    model: 'model-a',
    tokensUsed: 12,
    startedAt: '2026-11-05T05:58:00.000Z',
    durationMs: null,
    mode: 'build',
    agentId: null,
    collaborationRunId: null,
    builderProfileId: null,
    ...overrides,
  };
}

function floor(input: {
  userAgents?: OfficeUserAgentRef[];
  activeRuns?: OfficeRun[];
  recentRuns?: OfficeRun[];
}): OfficeDesk[] {
  return buildOfficeDesks({
    registry,
    userAgents: input.userAgents ?? [],
    activeRuns: input.activeRuns ?? [],
    recentRuns: input.recentRuns ?? [],
  });
}

function translator(messages: Record<string, unknown>, namespace?: string) {
  return (key: string) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    return readMessage(messages, fullKey) ?? fullKey;
  };
}

function renderOffice(
  overrides: Partial<OfficeScreenViewProps> = {},
  messages: Record<string, unknown> = enMessages as Record<string, unknown>,
): string {
  const props: OfficeScreenViewProps = {
    t: translator(messages, 'office'),
    resolveText: translator(messages),
    locale: 'en',
    loading: false,
    desks: floor({}),
    userAgents: [],
    selectedDeskId: null,
    showEmpty: false,
    runsError: false,
    agentsError: false,
    stale: false,
    updatedAt: null,
    nowMs: NOW,
    reducedMotion: false,
    knowledgeDocuments: null,
    onSelectDesk: () => undefined,
    onClosePanel: () => undefined,
    onRefresh: () => undefined,
    onRetryRuns: () => undefined,
    onRetryAgents: () => undefined,
    systemAgents: STATION_FIXTURE,
    systemAgentsError: false,
    onRetrySystemAgents: () => undefined,
    ...overrides,
  };
  return renderToStaticMarkup(<OfficeScreenView {...props} />);
}

describe('office locale copy', () => {
  test('every office key matches the approved copy in all three locales', () => {
    for (const { code, messages, openOffice } of LOCALES) {
      const expected = OFFICE_COPY[code];
      for (const [path, value] of Object.entries(expected)) {
        assert.equal(
          readMessage(messages as Record<string, unknown>, `office.${path}`),
          value,
          `${code} office.${path}`,
        );
      }
      assert.equal(
        readMessage(messages as Record<string, unknown>, 'platform.openOffice'),
        openOffice,
        `${code} platform.openOffice`,
      );
    }
  });
});

describe('office screen states', () => {
  test('loading shows the office loading copy and no desks', () => {
    const html = renderOffice({ loading: true, desks: [] });
    assert.match(html, /data-testid="office-loading"/);
    assert.match(html, /Loading…/);
    assert.doesNotMatch(html, /data-testid="office-desk-/);
    const traditional = renderOffice(
      { loading: true, desks: [] },
      zhTwMessages as Record<string, unknown>,
    );
    assert.match(traditional, /載入中…/);
  });

  test('an empty office still shows the builder desk and the command center link', () => {
    const html = renderOffice({ showEmpty: true, desks: floor({}) });
    assert.match(html, /The office is quiet/);
    assert.match(html, /Create an agent in the Command Center to fill a desk\./);
    assert.match(html, /data-testid="office-empty-platform"/);
    assert.match(html, /href="\/en\/platform"/);
    assert.match(html, /data-testid="office-desk-registry:builder"/);
    assert.match(html, />Idle</);
    assert.equal((html.match(/data-kind="vacant"/g) ?? []).length, 0);
    assert.match(html, /data-testid="office-desk-registry:product-strategy"[^>]*data-kind="occupied"|data-kind="occupied"[^>]*data-testid="office-desk-registry:product-strategy"/);
    assert.match(html, /data-testid="office-desk-registry:technology-advisor"[^>]*data-kind="occupied"|data-kind="occupied"[^>]*data-testid="office-desk-registry:technology-advisor"/);
    assert.match(html, /data-testid="office-desk-registry:chief-of-staff"[^>]*data-kind="occupied"|data-kind="occupied"[^>]*data-testid="office-desk-registry:chief-of-staff"/);
    assert.doesNotMatch(html, /data-testid="office-knowledge-badge"/);
    assert.doesNotMatch(html, /data-testid="office-desk-team"/);
    assert.doesNotMatch(html, /data-testid="office-desk-former"/);
    assert.match(html, /data-testid="office-no-runs"|No runs yet|Open desk/);
  });

  test('a run fetch error keeps the desks and offers retry', () => {
    const html = renderOffice({
      runsError: true,
      desks: floor({}),
      showEmpty: false,
    });
    assert.match(html, /data-testid="office-runs-error"/);
    assert.match(html, /Could not load run status\./);
    assert.match(html, /data-testid="office-runs-retry"/);
    assert.match(html, /Try again/);
    assert.match(html, /data-testid="office-desk-registry:builder"/);
    assert.doesNotMatch(html, /data-testid="office-stale"/);
  });

  test('a system-agent fetch error shows the builder desk and offers retry', () => {
    const builderOnly = officeRegistryFromManifests([{ id: 'builder', status: 'active' }]);
    const desks = buildOfficeDesks({
      registry: builderOnly,
      userAgents: [],
      activeRuns: [],
      recentRuns: [],
    });
    const html = renderOffice({
      systemAgentsError: true,
      systemAgents: [STATION_FIXTURE[0]],
      desks,
    });
    assert.match(html, /data-testid="office-system-agents-error"/);
    assert.match(html, /Stations could not be loaded\. Only the Builder desk is shown\./);
    assert.match(html, /data-testid="office-system-agents-retry"/);
    assert.match(html, /Try again/);
    assert.match(html, /data-testid="office-desk-registry:builder"/);
    assert.doesNotMatch(html, /data-testid="office-desk-registry:chief-of-staff"/);
    const traditional = renderOffice(
      {
        systemAgentsError: true,
        systemAgents: [STATION_FIXTURE[0]],
        desks,
      },
      zhTwMessages as Record<string, unknown>,
    );
    assert.match(traditional, /無法載入席位，目前只顯示 Builder 的座位。/);
  });

  test('the four-agent fixture keeps a chief collaboration run on that desk', () => {
    const desks = floor({
      activeRuns: [
        run({
          collaborationRunId: 'collab-1',
          builderProfileId: 'chief-of-staff',
          agentId: null,
        }),
      ],
    });
    const html = renderOffice({ desks });
    assert.ok(desks.some((desk) => desk.id === 'registry:chief-of-staff'));
    assert.match(html, /data-testid="office-desk-registry:chief-of-staff"/);
  });

  test('an agent fetch error offers its own retry', () => {
    const html = renderOffice({ agentsError: true, desks: floor({}) });
    assert.match(html, /data-testid="office-agents-error"/);
    assert.match(html, /Could not load your agents\./);
    assert.match(html, /data-testid="office-agents-retry"/);
  });

  test('a stale refresh keeps the last desks and the error banner', () => {
    const html = renderOffice({
      runsError: true,
      stale: true,
      updatedAt: NOW - 12_000,
      desks: floor({ activeRuns: [run()] }),
      selectedDeskId: BUILDER_DESK_ID,
    });
    assert.match(html, /data-testid="office-stale"/);
    assert.match(html, /data-testid="office-runs-error"/);
    assert.match(html, /Updated 12s ago/);
    assert.match(html, /data-stale="true"/);
    assert.match(html, />Working</);
    assert.match(html, /data-testid="office-current-run"/);
  });

  test('the builder panel shows the current run, elapsed time, and workspace links', () => {
    const html = renderOffice({
      updatedAt: NOW - 12_000,
      desks: floor({
        activeRuns: [run({ provider: 'anthropic', model: 'model-a', tokensUsed: 12 })],
      }),
      selectedDeskId: BUILDER_DESK_ID,
      reducedMotion: true,
    });
    assert.match(html, /Updated 12s ago/);
    assert.match(html, /data-testid="office-current-run"/);
    assert.match(html, /Build/);
    assert.match(html, /anthropic \/ model-a/);
    assert.match(html, /2m/);
    assert.match(html, /Tokens 12/);
    assert.match(html, /href="\/en\/app"/);
    assert.doesNotMatch(html, /userAgentId/);
    assert.match(html, /href="\/en\/platform"/);
    assert.match(html, /Open workspace/);
    assert.match(html, /Agent profile/);
    assert.match(html, /data-reduced-motion="true"/);
    assert.match(html, /prefers-reduced-motion/);
    assert.doesNotMatch(html, /applied/i);
  });

  test('a user agent workspace link carries userAgentId', () => {
    const user: OfficeUserAgentRef = {
      id: 'ua/1',
      name: 'Research Writer',
      role: 'Writer',
      description: 'Notes',
    };
    const html = renderOffice({
      userAgents: [user],
      desks: floor({
        userAgents: [user],
        activeRuns: [run({ executionId: 'ua-run', agentId: 'ua/1', mode: 'ask' })],
      }),
      selectedDeskId: 'user:ua/1',
    });
    assert.match(html, /Research Writer/);
    assert.match(html, /href="\/en\/app\?userAgentId=ua%2F1"/);
    assert.match(html, /Ask/);
  });

  test('a finished build run shows the outcome sentence and an ask run does not', () => {
    const buildHtml = renderOffice({
      desks: floor({
        recentRuns: [
          run({
            executionId: 'built',
            status: 'completed',
            mode: 'build',
            startedAt: '2026-11-05T04:00:00.000Z',
            durationMs: 12000,
          }),
        ],
      }),
      selectedDeskId: BUILDER_DESK_ID,
    });
    assert.match(buildHtml, /Last run/);
    assert.match(buildHtml, />Done</);
    assert.match(buildHtml, /12s/);
    assert.match(buildHtml, /Finished — check the workspace for applied changes\./);
    assert.equal((buildHtml.match(/applied/gi) ?? []).length, 1);

    const askHtml = renderOffice({
      desks: floor({
        recentRuns: [
          run({
            executionId: 'asked',
            status: 'completed',
            mode: 'ask',
            startedAt: '2026-11-05T04:00:00.000Z',
            durationMs: null,
          }),
        ],
      }),
      selectedDeskId: BUILDER_DESK_ID,
    });
    assert.match(askHtml, /—/);
    assert.doesNotMatch(askHtml, /applied/i);
    assert.doesNotMatch(askHtml, /data-testid="office-outcome-unknown"/);
  });

  test('the panel lists the last five runs', () => {
    const recentRuns = [1, 2, 3, 4, 5, 6].map((hour) =>
      run({
        executionId: `e${hour}`,
        status: 'completed',
        mode: 'ask',
        startedAt: `2026-11-05T0${hour}:00:00.000Z`,
        durationMs: 9000,
      }),
    );
    const html = renderOffice({
      desks: floor({ recentRuns }),
      selectedDeskId: BUILDER_DESK_ID,
    });
    assert.equal((html.match(/data-testid="office-recent-run"/g) ?? []).length, 5);
  });

  test('team and former desks render only from the supplied floor', () => {
    const quiet = renderOffice({ desks: floor({}) });
    assert.doesNotMatch(quiet, /data-testid="office-desk-team"/);
    assert.doesNotMatch(quiet, /data-testid="office-desk-former"/);

    const user: OfficeUserAgentRef = {
      id: 'ua-1',
      name: 'Research Writer',
      role: 'Writer',
      description: 'Notes',
    };
    const html = renderOffice({
      userAgents: [user],
      desks: floor({
        userAgents: [user],
        activeRuns: [
          run({
            executionId: 'team-run',
            collaborationRunId: 'collab-1',
            agentId: 'ua-1',
            builderProfileId: 'lead',
          }),
        ],
        recentRuns: [
          run({
            executionId: 'gone',
            agentId: 'deleted-1',
            status: 'failed',
            startedAt: '2026-11-05T03:00:00.000Z',
            durationMs: 1000,
            collaborationRunId: null,
          }),
        ],
      }),
      selectedDeskId: TEAM_DESK_ID,
    });
    assert.match(html, /data-testid="office-desk-team"/);
    assert.match(html, /Role: lead/);
    assert.match(html, /data-testid="office-desk-former"[^>]*data-muted="true"|data-muted="true"[^>]*data-testid="office-desk-former"/);
    assert.match(html, /Former agents/);
  });

  test('a vacant desk explains the reservation and has no workspace link', () => {
    const vacantRegistry = officeRegistryFromManifests([
      { id: 'builder', status: 'active' },
      { id: 'future-advisor', status: 'coming_soon' },
    ]);
    const html = renderOffice({
      desks: buildOfficeDesks({
        registry: vacantRegistry,
        userAgents: [],
        activeRuns: [],
        recentRuns: [],
      }),
      selectedDeskId: 'registry:future-advisor',
      systemAgents: [
        STATION_FIXTURE[0],
        {
          id: 'future-advisor',
          status: 'coming_soon',
          nameKey: 'agents.productStrategy.name',
          roleKey: 'agents.productStrategy.role',
          knowledgeScopes: [],
        },
      ],
    });
    assert.match(html, /This desk is reserved for a future agent\./);
    assert.match(html, /Vacant desk/);
    assert.doesNotMatch(html, /data-testid="office-open-workspace"/);
    assert.doesNotMatch(html, /data-testid="office-open-team"/);
    assert.match(html, /data-testid="office-agent-profile"/);
    assert.match(html, /href="\/en\/platform"/);
  });

  test('the chief of staff desk shows the knowledge count and opens the team page', () => {
    const chiefDocuments = [
      { scopeId: 'contract-templates', status: 'active' },
      { scopeId: 'contract-templates', status: 'active' },
      { scopeId: 'contract-templates', status: 'active' },
    ];
    const html = renderOffice({
      desks: floor({}),
      selectedDeskId: 'registry:chief-of-staff',
      knowledgeDocuments: chiefDocuments,
    });
    assert.match(html, /data-kind="occupied"/);
    assert.equal((html.match(/data-testid="office-knowledge-badge"/g) ?? []).length, 3);
    assert.equal((html.match(/data-testid="office-panel-knowledge-badge"/g) ?? []).length, 1);
    assert.equal((html.match(/3 documents/g) ?? []).length, 3);
    assert.match(html, /Chief of Staff Agent\. 3 documents\./);
    assert.match(html, /Product Strategy Agent\. 0 documents\./);
    assert.match(html, /href="\/en\/collaboration"/);
    assert.match(html, /data-testid="office-open-team"/);
    assert.match(html, />Open</);
    assert.doesNotMatch(html, /data-testid="office-open-workspace"/);
    assert.doesNotMatch(html, /Secret handbook|document title|upload/i);
    assert.doesNotMatch(html, />\s*(Approve|Reject|Upload)\s*</);

    const none = renderOffice({
      desks: floor({}),
      selectedDeskId: 'registry:chief-of-staff',
      knowledgeDocuments: null,
    });
    assert.doesNotMatch(none, /data-testid="office-knowledge-badge"/);
    assert.doesNotMatch(none, /data-testid="office-panel-knowledge-badge"/);
    assert.match(none, /data-testid="office-open-team"/);

    const zero = renderOffice({
      desks: floor({}),
      selectedDeskId: 'registry:chief-of-staff',
      knowledgeDocuments: [],
    });
    assert.equal((zero.match(/0 documents/g) ?? []).length, 7);

    const one = renderOffice({
      desks: floor({}),
      selectedDeskId: 'registry:chief-of-staff',
      knowledgeDocuments: [{ scopeId: 'contract-templates', status: 'active' }],
    });
    assert.equal((one.match(/1 document/g) ?? []).length, 3);
    assert.doesNotMatch(one, /1 documents/);

    const traditional = renderOffice(
      {
        locale: 'zh-TW',
        desks: floor({}),
        selectedDeskId: 'registry:chief-of-staff',
        knowledgeDocuments: chiefDocuments,
      },
      zhTwMessages as Record<string, unknown>,
    );
    assert.equal((traditional.match(/3 份文件/g) ?? []).length, 3);
    assert.match(traditional, /href="\/zh-TW\/collaboration"/);
    assert.match(traditional, />開啟</);

    const product = renderOffice({
      desks: floor({}),
      selectedDeskId: 'registry:product-strategy',
      knowledgeDocuments: [
        { scopeId: 'market-data', status: 'active' },
        { scopeId: 'market-data', status: 'active' },
        { scopeId: 'policies', status: 'archived' },
      ],
    });
    assert.match(product, /Product Strategy Agent\. 2 documents\./);
    assert.match(product, /Chief of Staff Agent\. 0 documents\./);
    assert.match(product, /data-testid="office-open-team"/);
    assert.match(product, /href="\/en\/collaboration"/);
    assert.doesNotMatch(product, /data-testid="office-open-workspace"/);

    const failed = renderOffice({
      desks: floor({}),
      selectedDeskId: 'registry:product-strategy',
      knowledgeDocuments: null,
    });
    assert.doesNotMatch(failed, /data-testid="office-knowledge-badge"/);
    assert.doesNotMatch(failed, /data-testid="office-panel-knowledge-badge"/);
    assert.match(failed, /data-testid="office-open-team"/);
  });

  test('the screen has no approve, reject, handoff, cancel, delete, or apply control', () => {
    const html = renderOffice({
      runsError: true,
      agentsError: true,
      desks: floor({ activeRuns: [run()] }),
      selectedDeskId: BUILDER_DESK_ID,
    });
    assert.doesNotMatch(html, />\s*(Approve|Reject|Hand off|Cancel|Delete|Apply)\s*</);
    const screen = readFileSync(new URL('./office-screen.tsx', import.meta.url), 'utf8');
    const panel = readFileSync(new URL('./office-desk-panel.tsx', import.meta.url), 'utf8');
    const hook = readFileSync(new URL('../../hooks/useOfficeRuns.ts', import.meta.url), 'utf8');
    assert.match(screen, /useTranslations\('office'\)/);
    assert.match(screen, /from '@\/hooks\/useTranslations'/);
    assert.match(screen, /fetch\('\/api\/auth\/me'\)/);
    assert.match(screen, /router\.replace\(`\/\$\{locale\}\/login`\)/);
    assert.match(hook, /credentials:\s*'include'/);
    assert.match(hook, /\/api\/ai\/executions\?state=\$\{state\}&limit=50/);
    assert.match(hook, /fetchOfficeRunList\('active'\)/);
    assert.match(hook, /fetchOfficeRunList\('recent'\)/);
    assert.match(hook, /document\.hidden/);
    assert.match(hook, /visibilitychange/);
    assert.match(hook, /OFFICE_POLL_MS/);
    assert.match(screen, /knowledgeFetch\('\/api\/knowledge\/documents'\)/);
    assert.match(screen, /useSystemAgents\(/);
    assert.match(screen, /\}, \[authReady\]\)/);
    assert.doesNotMatch(screen, /listAgents\(/);
    assert.doesNotMatch(screen, /getAgentById\(/);
    assert.doesNotMatch(screen, /title: document|document\.title|content:/);
    assert.doesNotMatch(`${screen}\n${panel}\n${hook}`, /method:\s*'POST'|method:\s*'DELETE'|applied/i);
  });
});
