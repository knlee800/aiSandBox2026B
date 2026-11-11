import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { UserAgentOptions, UserWorkflowSummaryItem } from '@/hooks/useUserAgents';
import { userAgentSwitchBody } from '@/hooks/useUserAgents';
import AgentStationCard, { getStatusBadgeClasses } from '@/components/platform/agent-station-card';
import type { WorkflowUsageView } from '@/components/platform/agent-workflow-fields';
import CreateAgentForm from '@/components/platform/create-agent-form';
import type { CreateAgentFormLabels } from '@/components/platform/create-agent-form';
import AgentDetailPanel from '@/components/platform/agent-detail-panel';
import AgentWorkflowSummary, {
  WORKFLOW_NOT_TESTED_CODE,
  nextWorkflowSwitchPhase,
  openOnTeamHref,
  workflowSummaryLines,
  workflowSwitchFailureKind,
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
    assert.match(html, /<a [^>]*data-testid="agent-open-on-team"[^>]*href="\/en\/collaboration\?workflowId=agent-1"/);
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
  test('points at the Team page under the locale prefix, with the workflow id when given', () => {
    assert.equal(openOnTeamHref('/en'), '/en/collaboration');
    assert.equal(openOnTeamHref('/en', 'wf-1'), '/en/collaboration?workflowId=wf-1');
    assert.equal(openOnTeamHref('/zh-TW', 'a b'), '/zh-TW/collaboration?workflowId=a%20b');
    assert.equal(openOnTeamHref('/zh-TW'), '/zh-TW/collaboration');
    assert.equal(openOnTeamHref(''), '/collaboration');
  });

  test('the link is present on a tested workflow too', () => {
    assert.match(render(), /<a [^>]*data-testid="agent-open-on-team"[^>]*href="\/en\/collaboration\?workflowId=agent-1"/);
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
      'usageLoading', 'usageFailed', 'team', 'teamNone',
      'approval', 'approvalEvery', 'approvalCredits', 'approvalReadOnly',
    ];
    for (const key of used) {
      for (const messages of [enMessages, zhTwMessages, zhCnMessages]) {
        assert.ok(resolve(messages as Messages, `platform.agentWorkflow.summary.${key}`), key);
      }
    }
    assert.equal(used.length, Object.keys(en).length);
  });
});

describe('WORKFLOW-CREATE-01 a new workflow is a draft', () => {
  test('an untested draft shows the switch Off, disabled, with "Run a test first"', () => {
    const html = render({ status: 'draft', item: item({ status: 'draft', tested: false }) });
    const button = /<button[^>]*role="switch"[^>]*>/.exec(html)?.[0] ?? '';
    assert.ok(button.includes('aria-checked="false"'));
    assert.ok(button.includes('disabled=""'));
    assert.match(html, /data-testid="agent-switch-state">Off</);
    assert.match(html, /data-testid="agent-switch-needs-test"/);
  });

  test('after a passing test the draft switch is still Off but can be switched on', () => {
    const html = render({ status: 'draft', item: item({ status: 'draft', tested: true }) });
    const button = /<button[^>]*role="switch"[^>]*>/.exec(html)?.[0] ?? '';
    assert.ok(button.includes('aria-checked="false"'));
    assert.ok(!button.includes('disabled=""'));
    assert.ok(!html.includes('data-testid="agent-switch-needs-test"'));
    assert.deepEqual(workflowSwitchGate('draft', true), { isOn: false, canSwitchOn: true, showNeedsTest: false });
  });

  test('switching on sends status active, and the row then reads On', () => {
    assert.deepEqual(userAgentSwitchBody(true), { status: 'active' });
    const html = render({ status: 'active', item: item({ status: 'active', tested: true }) });
    assert.match(html, /data-testid="agent-switch-state">On</);
  });

  test('the Off state reads in Chinese for a draft', () => {
    for (const messages of [zhTwMessages, zhCnMessages] as Messages[]) {
      const t = (key: string) => resolve(messages, `platform.agentWorkflow.${key}`) ?? `MISSING:${key}`;
      const html = render({ t, status: 'draft', item: item({ status: 'draft', tested: false }) });
      assert.ok(html.includes(`data-testid="agent-switch-state">${t('summary.switchOff')}<`));
      assert.match(t('summary.switchOff'), /[一-鿿]/);
    }
  });
});

describe('WORKFLOW-STATUS-02 the server refusal of an untested switch-on', () => {
  test('a failed switch-on reads as "Run a test first" by its code or once known untested', () => {
    assert.equal(workflowSwitchFailureKind(null, false), 'none');
    assert.equal(workflowSwitchFailureKind({ on: true, code: WORKFLOW_NOT_TESTED_CODE }, true), 'needsTest');
    assert.equal(workflowSwitchFailureKind({ on: true, code: WORKFLOW_NOT_TESTED_CODE }, null), 'needsTest');
    assert.equal(workflowSwitchFailureKind({ on: true }, false), 'needsTest');
    assert.equal(workflowSwitchFailureKind({ on: true }, true), 'generic');
    assert.equal(workflowSwitchFailureKind({ on: true }, null), 'generic');
    assert.equal(workflowSwitchFailureKind({ on: true, code: 'OTHER' }, true), 'generic');
    assert.equal(workflowSwitchFailureKind({ on: false }, false), 'generic');
    assert.equal(workflowSwitchFailureKind({ on: false, code: WORKFLOW_NOT_TESTED_CODE }, false), 'generic');
    assert.equal(WORKFLOW_NOT_TESTED_CODE, 'WORKFLOW_NOT_TESTED');
  });

  test('the refusal code shows the "Run a test first" line as the alert, with Open on Team, even on a stale tested summary', () => {
    const html = render({
      status: 'draft',
      item: item({ status: 'draft', tested: true }),
      initialFailure: { on: true, code: WORKFLOW_NOT_TESTED_CODE },
    });
    const line = /<p[^>]*data-testid="agent-switch-needs-test"[^>]*>/.exec(html)?.[0] ?? '';
    assert.ok(line.includes('role="alert"'));
    assert.ok(line.includes('data-refused="true"'));
    assert.ok(html.includes('Run a test first'));
    assert.match(html, /<a [^>]*data-testid="agent-open-on-team"[^>]*href="\/en\/collaboration\?workflowId=agent-1"/);
    assert.ok(!html.includes('data-testid="agent-switch-error"'));
    assert.ok(!html.includes('Could not change the switch'));
  });

  test('a refused switch-on without a code shows the same alert once the reloaded summary says untested', () => {
    const html = render({
      status: 'draft',
      item: item({ status: 'draft', tested: false }),
      initialFailure: { on: true },
    });
    const line = /<p[^>]*data-testid="agent-switch-needs-test"[^>]*>/.exec(html)?.[0] ?? '';
    assert.ok(line.includes('role="alert"'));
    assert.equal(html.split('Run a test first').length - 1, 1);
    assert.ok(!html.includes('data-testid="agent-switch-error"'));
  });

  test('an untested off workflow without a failed switch keeps the plain hint, not an alert', () => {
    const html = render({ status: 'draft', item: item({ status: 'draft', tested: false }) });
    const line = /<p[^>]*data-testid="agent-switch-needs-test"[^>]*>/.exec(html)?.[0] ?? '';
    assert.ok(line.length > 0);
    assert.ok(!line.includes('role="alert"'));
    assert.ok(!line.includes('data-refused'));
  });

  test('any other failed switch keeps the generic translated error', () => {
    const on = render({ status: 'draft', item: item({ status: 'draft', tested: true }), initialFailure: { on: true } });
    assert.match(on, /data-testid="agent-switch-error"[^>]*>Could not change the switch/);
    const off = render({ initialFailure: { on: false } });
    assert.match(off, /data-testid="agent-switch-error"[^>]*>Could not change the switch/);
    assert.ok(!off.includes('data-refused'));
  });

  test('the refusal reads in Chinese', () => {
    for (const messages of [zhTwMessages, zhCnMessages] as Messages[]) {
      const t = (key: string) => resolve(messages, `platform.agentWorkflow.${key}`) ?? `MISSING:${key}`;
      const html = render({
        t,
        status: 'draft',
        item: item({ status: 'draft', tested: true }),
        initialFailure: { on: true, code: WORKFLOW_NOT_TESTED_CODE },
      });
      const hint = t('summary.needsTestHint');
      assert.match(hint, /[一-鿿]/);
      assert.ok(html.includes(`<span>${hint}</span>`));
      assert.ok(!html.includes('MISSING:'));
    }
  });
});

describe('WORKFLOW-STATUS-02 the Draft badge', () => {
  function card(status: 'active' | 'draft' | 'disabled', label: string): string {
    return renderToStaticMarkup(
      <AgentStationCard
        id="user-agent-1"
        name="Digest"
        role="Helper"
        description="Does things"
        status={status}
        enabled={status === 'active'}
        statusLabel={label}
        actionHint="Open"
        selected={false}
        onSelect={() => {}}
      />,
    );
  }

  function badge(html: string): string {
    return /<span[^>]*data-testid="agent-station-status-user-agent-1"[^>]*>/.exec(html)?.[0] ?? '';
  }

  test('a draft card has its own amber in-progress badge with a pencil icon and the Draft label', () => {
    const html = card('draft', 'Draft');
    assert.match(html, /data-testid="agent-station-card-user-agent-1"[^>]*data-status="draft"/);
    const draftBadge = badge(html);
    assert.ok(draftBadge.includes('bg-amber-50'));
    assert.ok(draftBadge.includes('text-amber-800'));
    assert.ok(draftBadge.includes('border-amber-200'));
    assert.ok(!draftBadge.includes('bg-gray-100'));
    assert.match(html, /data-testid="agent-station-status-user-agent-1"[^>]*><svg[^>]*aria-hidden="true"/);
    assert.match(html, /<\/svg>Draft<\/span>/);
  });

  test('Draft, Off and Active badges are distinct', () => {
    const draftBadge = badge(card('draft', 'Draft'));
    const offBadge = badge(card('disabled', 'Disabled'));
    const activeBadge = badge(card('active', 'Active'));
    assert.ok(offBadge.includes('bg-gray-100'));
    assert.ok(activeBadge.includes('bg-emerald-100'));
    assert.notEqual(draftBadge, offBadge);
    assert.notEqual(draftBadge, activeBadge);
    assert.ok(!card('disabled', 'Disabled').includes('<svg'));
  });

  test('every badge state has its own classes', () => {
    const classes = (['active', 'coming_soon', 'draft', 'disabled'] as const).map((status) =>
      getStatusBadgeClasses(status),
    );
    assert.equal(new Set(classes).size, 4);
  });
});

describe('USER-TEAMS-01C the team line', () => {
  const WF_A = 'f0f0f0f0-0000-4000-8000-00000000000a';
  const teamChoices = [
    { id: 'product-strategy', kind: 'system' as const, name: 'Product Strategy', status: 'active' },
    { id: WF_A, kind: 'workflow' as const, name: 'Tax helper', status: 'active' },
  ];

  test('names the team in order, advisors by their translated name', () => {
    const html = render({ teamMemberIds: ['product-strategy', WF_A], teamChoices });
    assert.match(html, /<dt[^>]*>Team<\/dt><dd[^>]*data-testid="agent-summary-team">Product Strategy, Tax helper</);
  });

  test('an empty team reads "None"', () => {
    const html = render({ teamMemberIds: [], teamChoices });
    assert.match(html, /data-testid="agent-summary-team">None</);
  });

  test('without a team list the line is left out', () => {
    const html = render();
    assert.ok(!html.includes('agent-summary-team'));
  });

  test('a member that is no longer a choice reads as unavailable, not as an id', () => {
    const html = render({ teamMemberIds: ['f0f0f0f0-0000-4000-8000-0000000000ff'], teamChoices });
    assert.ok(html.includes(enT('teamUnknown')));
    assert.ok(!html.includes('f0f0f0f0-0000-4000-8000-0000000000ff'));
  });

  test('the line reads in Traditional and Simplified Chinese', () => {
    for (const messages of [zhTwMessages, zhCnMessages]) {
      const t = (key: string): string => resolve(messages as Messages, `platform.agentWorkflow.${key}`) ?? `MISSING:${key}`;
      const lines = workflowSummaryLines(item(), t, enScope, models, { ids: ['product-strategy'], choices: teamChoices });
      assert.equal(lines.team, t('teamNames.product-strategy'));
      assert.notEqual(lines.team, 'Product Strategy');
      const none = workflowSummaryLines(item(), t, enScope, models, { ids: [], choices: teamChoices });
      assert.equal(none.team, t('summary.teamNone'));
      assert.match(t('summary.team'), /[一-鿿]/);
    }
  });
});

describe('APPROVAL-SET-01C the approval line', () => {
  test('reads every hand-off, read-only agents automatic, or automatic under N credits', () => {
    assert.match(render({ approvalMode: 'every' }), /<dt[^>]*>Approval<\/dt><dd[^>]*data-testid="agent-summary-approval">Every hand-off</);
    assert.match(render({ approvalMode: 'read_only' }), /data-testid="agent-summary-approval">Read-only agents automatic</);
    assert.match(
      render({ approvalMode: 'credits', approvalCreditLimit: 25 }),
      /data-testid="agent-summary-approval">Automatic under 25 credits</,
    );
  });

  test('credits without a saved limit reads as every hand-off, the safe reading', () => {
    assert.match(render({ approvalMode: 'credits', approvalCreditLimit: null }), /agent-summary-approval">Every hand-off</);
  });

  test('without a setting the line is left out', () => {
    assert.ok(!render().includes('agent-summary-approval'));
  });

  test('the line reads in Traditional and Simplified Chinese', () => {
    for (const messages of [zhTwMessages, zhCnMessages]) {
      const t = (key: string): string => resolve(messages as Messages, `platform.agentWorkflow.${key}`) ?? `MISSING:${key}`;
      assert.equal(
        workflowSummaryLines(item(), t, enScope, models, undefined, { mode: 'read_only', creditLimit: null }).approval,
        t('summary.approvalReadOnly'),
      );
      const credits = workflowSummaryLines(item(), t, enScope, models, undefined, { mode: 'credits', creditLimit: 7 }).approval;
      assert.ok(credits && credits.includes('7') && /[一-鿿]/.test(credits));
      assert.match(t('summary.approval'), /[一-鿿]/);
    }
  });
});
