import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { UserAgentOptions, UserWorkflowSummaryItem } from '@/hooks/useUserAgents';
import AgentStationCard from '@/components/platform/agent-station-card';
import type { WorkflowUsageView } from '@/components/platform/agent-workflow-fields';
import CreateAgentForm from '@/components/platform/create-agent-form';
import type { CreateAgentFormLabels } from '@/components/platform/create-agent-form';
import AgentDetailPanel from '@/components/platform/agent-detail-panel';
import AgentWorkflowSummary, {
  nextWorkflowSwitchPhase,
  openOnTeamHref,
  workflowSummaryLines,
  workflowSwitchGate,
  workflowTestedNote,
  workflowUsageLine,
  type AgentWorkflowSummaryProps,
} from '@/components/platform/agent-workflow-summary';
import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';

type Messages = Record<string, unknown>;

function resolve(source: Messages, fullKey: string): string | null {
  let current: unknown = source;
  for (const part of fullKey.split('.')) {
    if (!current || typeof current !== 'object' || !(part in (current as Record<string, unknown>))) {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : null;
}

function flatten(value: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof value === 'string') {
    out[prefix] = value;
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      Object.assign(out, flatten(child, prefix ? `${prefix}.${key}` : key));
    }
  }
  return out;
}

const enT = (key: string): string => resolve(enMessages as Messages, `platform.agentWorkflow.${key}`) ?? `MISSING:${key}`;
const enScope = (id: string): string => resolve(enMessages as Messages, `knowledge.scopes.${id}`) ?? id;

function item(overrides: Partial<UserWorkflowSummaryItem> = {}): UserWorkflowSummaryItem {
  return {
    id: 'agent-1',
    status: 'active',
    tested: true,
    knowledgeScopeIds: ['policies', 'market-data'],
    model: { choice: 'platform', id: 'claude-sonnet-5-5' },
    budgetPerRunCredits: 20,
    budgetPerDayCredits: 100,
    spentTodayCredits: 12,
    lastRunCredits: 5,
    ...overrides,
  };
}

const models = [{ id: 'claude-sonnet-5-5', provider: 'anthropic', creditsPer1kTokens: 1 }];

function props(overrides: Partial<AgentWorkflowSummaryProps> = {}): AgentWorkflowSummaryProps {
  return {
    t: enT,
    scopeName: enScope,
    localePrefix: '/en',
    agentId: 'agent-1',
    status: 'active',
    summaryState: 'loaded',
    item: item(),
    models,
    onRetry: () => {},
    onSwitch: async () => ({}),
    ...overrides,
  };
}

function render(overrides: Partial<AgentWorkflowSummaryProps> = {}): string {
  return renderToStaticMarkup(<AgentWorkflowSummary {...props(overrides)} />);
}

describe('workflow summary rendering', () => {
  test('shows folder names, the model with its credit cost, and both budgets', () => {
    const html = render();
    assert.match(html, /data-testid="agent-summary-folders">[^<]*Policies/);
    assert.ok(html.includes(enScope('market-data')));
    assert.match(html, /data-testid="agent-summary-model">claude-sonnet-5-5 \(1 credit per 1K tokens\)</);
    assert.match(html, /data-testid="agent-summary-budget-run">20 credits</);
    assert.match(html, /data-testid="agent-summary-budget-day">100 credits</);
  });

  test('shows the server default, no limit and no folders when the workflow sets none', () => {
    const lines = workflowSummaryLines(
      item({ knowledgeScopeIds: [], model: { choice: 'server' }, budgetPerRunCredits: null, budgetPerDayCredits: null }),
      enT,
      enScope,
      models,
    );
    assert.equal(lines.folders, 'None');
    assert.equal(lines.model, 'Server default');
    assert.equal(lines.perRun, 'No limit');
    assert.equal(lines.perDay, 'No limit');
  });

  test('one credit reads in the singular and an unknown model shows its id only', () => {
    const lines = workflowSummaryLines(
      item({ budgetPerRunCredits: 1, model: { choice: 'platform', id: 'claude-haiku-5-5' } }),
      enT,
      enScope,
      models,
    );
    assert.equal(lines.perRun, '1 credit');
    assert.equal(lines.model, 'claude-haiku-5-5');
  });
});

describe('workflow tested state', () => {
  test('a tested workflow reads "Tested at this version"', () => {
    const html = render();
    assert.match(html, /data-testid="agent-summary-tested" data-tested="true"/);
    assert.ok(html.includes('Tested at this version'));
    assert.ok(!html.includes('Needs a test run'));
  });

  test('an untested workflow reads "Needs a test run"', () => {
    const html = render({ item: item({ tested: false }) });
    assert.match(html, /data-testid="agent-summary-tested" data-tested="false"/);
    assert.ok(html.includes('Needs a test run'));
  });

  test('the note is absent while the answer is not known', () => {
    assert.equal(workflowTestedNote(enT, null), null);
    assert.deepEqual(workflowTestedNote(enT, true), { text: 'Tested at this version', tone: 'ok' });
    assert.deepEqual(workflowTestedNote(enT, false), { text: 'Needs a test run', tone: 'warn' });
  });

  test('the dashboard card shows the tested note under the description', () => {
    const html = renderToStaticMarkup(
      <AgentStationCard
        id="user-agent-1"
        name="Digest"
        role="Helper"
        description="Does things"
        status="active"
        enabled
        statusLabel="Active"
        actionHint="Open"
        selected={false}
        workflowNote={{ text: 'Needs a test run', tone: 'warn' }}
        onSelect={() => {}}
      />,
    );
    assert.match(html, /data-testid="agent-station-tested-user-agent-1"[^>]*>Needs a test run</);
  });
});

describe('workflow switch gating', () => {
  test('switching on needs a test at the current version', () => {
    assert.deepEqual(workflowSwitchGate('disabled', false), { isOn: false, canSwitchOn: false, showNeedsTest: true });
    assert.deepEqual(workflowSwitchGate('draft', false), { isOn: false, canSwitchOn: false, showNeedsTest: true });
    assert.deepEqual(workflowSwitchGate('draft', true), { isOn: false, canSwitchOn: true, showNeedsTest: false });
    assert.deepEqual(workflowSwitchGate('disabled', true), { isOn: false, canSwitchOn: true, showNeedsTest: false });
  });

  test('while the tested state is unknown an off workflow cannot be switched on and shows no hint', () => {
    assert.deepEqual(workflowSwitchGate('disabled', null), { isOn: false, canSwitchOn: false, showNeedsTest: false });
  });

  test('an active workflow is on whatever the tested state', () => {
    assert.equal(workflowSwitchGate('active', false).isOn, true);
    assert.equal(workflowSwitchGate('active', null).isOn, true);
  });

  test('an untested off workflow shows "Run a test first", Open on Team, and a disabled switch', () => {
    const html = render({ status: 'disabled', item: item({ status: 'disabled', tested: false }) });
    assert.match(html, /data-testid="agent-switch-needs-test"/);
    assert.ok(html.includes('Run a test first'));
    const button = /<button[^>]*role="switch"[^>]*>/.exec(html)?.[0] ?? '';
    assert.ok(button.includes('aria-checked="false"'));
    assert.ok(button.includes('disabled=""'));
    assert.match(html, /<a [^>]*data-testid="agent-open-on-team"[^>]*href="\/en\/collaboration"/);
  });

  test('a tested off workflow has an enabled switch and no hint', () => {
    const html = render({ status: 'disabled', item: item({ status: 'disabled', tested: true }) });
    assert.ok(!html.includes('Run a test first'));
    const button = /<button[^>]*role="switch"[^>]*>/.exec(html)?.[0] ?? '';
    assert.ok(button.includes('aria-checked="false"'));
    assert.ok(!button.includes('disabled=""'));
  });

  test('an active workflow shows the switch on', () => {
    const html = render();
    const button = /<button[^>]*role="switch"[^>]*>/.exec(html)?.[0] ?? '';
    assert.ok(button.includes('aria-checked="true"'));
    assert.match(html, /data-testid="agent-switch-state">On</);
  });
});

describe('switching off asks first', () => {
  test('asking moves idle to confirming, and only confirm moves on to saving', () => {
    assert.equal(nextWorkflowSwitchPhase('idle', 'confirm'), 'idle');
    assert.equal(nextWorkflowSwitchPhase('idle', 'askOff'), 'confirmingOff');
    assert.equal(nextWorkflowSwitchPhase('confirmingOff', 'cancel'), 'idle');
    assert.equal(nextWorkflowSwitchPhase('confirmingOff', 'confirm'), 'saving');
    assert.equal(nextWorkflowSwitchPhase('saving', 'cancel'), 'saving');
    assert.equal(nextWorkflowSwitchPhase('saving', 'settled'), 'idle');
  });

  test('no confirm panel is shown until the switch is asked to turn off', () => {
    assert.ok(!render().includes('agent-switch-confirm-panel'));
  });

  test('the confirm panel names what happens and offers Switch off or Keep on', () => {
    const html = render({ initialPhase: 'confirmingOff' });
    assert.match(html, /data-testid="agent-switch-confirm-panel"/);
    assert.ok(html.includes('Switch this workflow off?'));
    assert.match(html, /data-testid="agent-switch-confirm"[^>]*>(?:<[^>]+>)*<span>Switch off</);
    assert.match(html, /data-testid="agent-switch-cancel"[^>]*>Keep on</);
  });

  test('while saving the confirm button reads Saving... and is disabled', () => {
    const html = render({ initialPhase: 'saving' });
    const confirm = /<button[^>]*data-testid="agent-switch-confirm"[^>]*>/.exec(html)?.[0] ?? '';
    assert.ok(confirm.includes('disabled=""'));
    assert.ok(html.includes('Saving...'));
  });

  test('a failed switch shows a translated error', () => {
    const html = render({ initialError: true });
    assert.match(html, /data-testid="agent-switch-error"[^>]*>Could not change the switch/);
  });
});

describe('Open on Team link', () => {
  test('points at the Team page under the locale prefix without a preselection (the page reads none)', () => {
    assert.equal(openOnTeamHref('/en'), '/en/collaboration');
    assert.equal(openOnTeamHref('/zh-TW'), '/zh-TW/collaboration');
    assert.equal(openOnTeamHref(''), '/collaboration');
  });

  test('the link is present on a tested workflow too', () => {
    assert.match(render(), /<a [^>]*data-testid="agent-open-on-team"[^>]*href="\/en\/collaboration"/);
  });
});

describe('workflow summary states', () => {
  test('loading shows a translated sentence and no lines', () => {
    const html = render({ summaryState: 'loading', item: null });
    assert.match(html, /data-testid="agent-summary-loading"/);
    assert.ok(html.includes('Loading the workflow summary...'));
    assert.ok(!html.includes('agent-summary-lines'));
  });

  test('failed shows the message and a retry button', () => {
    const html = render({ summaryState: 'failed', item: null });
    assert.match(html, /data-testid="agent-summary-failed"/);
    assert.ok(html.includes('Could not load the workflow summary.'));
    assert.match(html, /data-testid="agent-summary-retry"[^>]*>(?:<[^>]+>)*Try again/);
  });

  test('empty shows a translated line when the list has no entry for the workflow', () => {
    const html = render({ summaryState: 'loaded', item: null });
    assert.match(html, /data-testid="agent-summary-empty"/);
    assert.ok(html.includes('No summary for this workflow yet.'));
  });

  test('the same states read in Chinese', () => {
    for (const messages of [zhTwMessages, zhCnMessages]) {
      const t = (key: string) => resolve(messages as Messages, `platform.agentWorkflow.${key}`) ?? `MISSING:${key}`;
      const html = renderToStaticMarkup(
        <AgentWorkflowSummary {...props({ t, summaryState: 'failed', item: null })} />,
      );
      assert.ok(html.includes(t('summary.failed')));
      assert.ok(!html.includes('MISSING:'));
      assert.ok(!html.includes('Could not load'));
    }
  });
});

describe('detail panel slot', () => {
  const panelProps = {
    localePrefix: '/en',
    title: 'Agent',
    subtitle: 'sub',
    intentLabel: 'Intent',
    capabilitiesLabel: 'Capabilities',
    closeLabel: 'Close',
    emptyTitle: 'None',
    emptyBody: 'None',
    startBuildingLabel: 'Build',
    askButtonLabel: 'Ask',
    comingSoonLabel: 'Soon',
    comingSoonBody: 'Soon',
    deleteButtonLabel: 'Delete',
    deleteConfirmTitle: 'Sure?',
    deleteConfirmBody: 'Body',
    deleteConfirmActionLabel: 'Delete',
    deleteCancelLabel: 'Cancel',
    deletingLabel: 'Deleting',
    deleteErrorMessage: null,
    deletePending: false,
    onDelete: () => {},
    onClose: () => {},
  };
  const userAgent = {
    id: 'agent-1',
    name: 'Digest',
    role: 'Helper',
    description: 'Does things',
    statusLabel: 'Active',
    intent: 'Helper',
    capabilities: [],
    isBuilder: false,
    isComingSoon: false,
    isUserCreated: true,
  };

  test('a user-created agent shows the summary slot and keeps its existing test ids', () => {
    const html = renderToStaticMarkup(
      <AgentDetailPanel
        {...panelProps}
        agent={userAgent}
        workflowSummary={<AgentWorkflowSummary {...props()} />}
        editButtonLabel="Edit workflow"
        onEdit={() => {}}
      />,
    );
    assert.match(html, /data-testid="agent-workflow-summary"/);
    for (const id of ['agent-detail-panel-agent-1', 'agent-detail-ask', 'agent-detail-edit', 'agent-detail-delete', 'agent-detail-close']) {
      assert.ok(html.includes(`data-testid="${id}"`), id);
    }
  });

  test('a system agent never shows the slot', () => {
    const html = renderToStaticMarkup(
      <AgentDetailPanel
        {...panelProps}
        agent={{ ...userAgent, isUserCreated: false, openHref: '/en/collaboration', openLabel: 'Open' }}
        workflowSummary={<AgentWorkflowSummary {...props()} />}
      />,
    );
    assert.ok(!html.includes('agent-workflow-summary'));
  });
});

describe('editor budget hint', () => {
  const labels: CreateAgentFormLabels = {
    formTitle: 'Edit',
    nameLabel: 'Name',
    namePlaceholder: 'n',
    roleLabel: 'Role',
    rolePlaceholder: 'r',
    descriptionLabel: 'Description',
    descriptionPlaceholder: 'd',
    submitButton: 'Save',
    cancelButton: 'Cancel',
    submitting: '...',
    nameRequired: 'x',
    nameTooLong: 'x',
    roleRequired: 'x',
    roleTooLong: 'x',
    descriptionRequired: 'x',
    descriptionTooLong: 'x',
    createError: 'x',
    createSuccess: 'x',
  };
  const options: UserAgentOptions = {
    replyLanguages: ['owner', 'en', 'zh-TW', 'zh-CN'],
    toolProfiles: ['read'],
    knowledgeScopes: [{ id: 'policies', type: 'shared' }],
    connectorTools: [],
    connectedKinds: [],
    models,
    templates: [],
    limits: {
      maxInstructionsChars: 4000,
      maxToneChars: 120,
      maxKnowledgeScopes: 9,
      maxBudgetCredits: 1_000_000,
      platformDailyCreditsPerUser: 500,
    },
  };
  const agent = {
    id: 'agent-1',
    name: 'Digest',
    role: 'Helper',
    description: 'Does things',
    status: 'active' as const,
    initials: null,
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
    purpose: 'P',
    procedure: 'Q',
    result: 'R',
    toolProfile: 'read',
    knowledgeScopeIds: [],
    connectorToolIds: [],
    model: { choice: 'platform' as const, id: 'claude-sonnet-5-5' },
    budgetPerRunCredits: 20,
    budgetPerDayCredits: 100,
  };

  function renderEditor(usage: WorkflowUsageView | null, mode: 'create' | 'edit' = 'edit') {
    return renderToStaticMarkup(
      <CreateAgentForm
        labels={labels}
        onSubmit={async () => ({})}
        onCancel={() => {}}
        workflow={{
          mode,
          t: enT,
          scopeName: enScope,
          localePrefix: '/en',
          options,
          optionsLoading: false,
          optionsError: false,
          onRetryOptions: () => {},
          agent: mode === 'edit' ? agent : undefined,
          usage,
          onSave: async () => ({}),
        }}
      />,
    );
  }

  test('usage line shows last run and spend today', () => {
    assert.equal(workflowUsageLine(enT, item()), 'Last run: 5 credits. Spent today: 12 credits.');
    assert.equal(
      workflowUsageLine(enT, item({ lastRunCredits: null, spentTodayCredits: 1 })),
      'Last run: no run yet. Spent today: 1 credit.',
    );
  });

  test('an existing workflow shows the hint under the budget fields', () => {
    const html = renderEditor({ state: 'loaded', line: workflowUsageLine(enT, item()) });
    assert.match(html, /data-testid="agent-workflow-budget-usage"[^>]*>Last run: 5 credits\. Spent today: 12 credits\./);
    assert.ok(html.indexOf('agent-workflow-budget-day') < html.indexOf('agent-workflow-budget-usage'));
  });

  test('loading and failed read as translated sentences', () => {
    assert.ok(renderEditor({ state: 'loading' }).includes('Loading last run and spend...'));
    assert.ok(renderEditor({ state: 'failed' }).includes('Could not load last run and spend.'));
  });

  test('a new workflow has no hint', () => {
    assert.ok(!renderEditor({ state: 'loaded', line: 'x' }, 'create').includes('agent-workflow-budget-usage'));
  });

  test('the existing budget test ids are kept', () => {
    const html = renderEditor(null);
    for (const id of ['agent-workflow-budget-run', 'agent-workflow-budget-day', 'agent-workflow-budget-hint']) {
      assert.ok(html.includes(`data-testid="${id}"`), id);
    }
    assert.ok(!html.includes('agent-workflow-budget-usage'));
  });
});

describe('summary copy in three languages', () => {
  const en = flatten((enMessages as Messages & { platform: { agentWorkflow: { summary: unknown } } }).platform.agentWorkflow.summary);
  const tw = flatten((zhTwMessages as Messages & { platform: { agentWorkflow: { summary: unknown } } }).platform.agentWorkflow.summary);
  const cn = flatten((zhCnMessages as Messages & { platform: { agentWorkflow: { summary: unknown } } }).platform.agentWorkflow.summary);

  test('en, zh-TW and zh-CN carry the same keys', () => {
    assert.ok(Object.keys(en).length >= 30);
    assert.deepEqual(Object.keys(tw).sort(), Object.keys(en).sort());
    assert.deepEqual(Object.keys(cn).sort(), Object.keys(en).sort());
  });

  test('zh-TW and zh-CN are translations, not English, and keep every placeholder', () => {
    for (const [key, text] of Object.entries(en)) {
      for (const other of [tw, cn]) {
        assert.notEqual(other[key], text, key);
        assert.match(other[key], /[一-鿿]/, key);
        assert.deepEqual(other[key].match(/\{\w+\}/g) ?? [], text.match(/\{\w+\}/g) ?? [], key);
      }
    }
  });

  test('every summary key the components read exists in all three files', () => {
    const used = [
      'title', 'loading', 'failed', 'retry', 'empty', 'folders', 'foldersNone', 'model', 'modelServer',
      'budgetPerRun', 'budgetPerDay', 'noLimit', 'creditsOne', 'creditsMany', 'testedYes', 'testedNo',
      'switchLabel', 'switchOn', 'switchOff', 'needsTestHint', 'openOnTeam', 'switchOffTitle', 'switchOffBody',
      'switchOffConfirm', 'switchOffCancel', 'switching', 'switchError', 'usageLine', 'usageNoRun',
      'usageLoading', 'usageFailed',
    ];
    for (const key of used) {
      for (const messages of [enMessages, zhTwMessages, zhCnMessages]) {
        assert.ok(resolve(messages as Messages, `platform.agentWorkflow.summary.${key}`), key);
      }
    }
    assert.equal(used.length, Object.keys(en).length);
  });
});
