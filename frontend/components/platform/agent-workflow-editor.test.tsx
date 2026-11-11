import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { UserAgent, UserAgentOptions } from '@/hooks/useUserAgents';
import CreateAgentForm from '@/components/platform/create-agent-form';
import type { AgentWorkflowConfig, CreateAgentFormLabels } from '@/components/platform/create-agent-form';
import {
  DEFAULT_WORKFLOW_LIMITS,
  NEVER_DO_CODES,
  REFUSAL_CODE_MAP,
  REPLY_LANGUAGE_CHOICES,
  budgetProblems,
  buildBlankBody,
  buildPatchBody,
  buildTemplateBody,
  checkWorkflowDraft,
  parseApprovalLimit,
  emptyWorkflowDraft,
  liveInstructionsCount,
  mapRefusal,
  neverDoLines,
  parseBudgetInput,
  teamChoiceRows,
  teamMemberName,
  teamNamesFor,
  templatePrefillPatch,
  toggleTeamMember,
  visibleConnectorTools,
  workflowDraftFromAgent,
} from '@/components/platform/agent-workflow-model';
import { getUserAgentStatusLabel, templatePrefillFor } from '@/components/platform/platform-dashboard';
import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';

type Messages = Record<string, unknown>;

const LOCALES: ReadonlyArray<{ code: string; messages: Messages }> = [
  { code: 'en', messages: enMessages as Messages },
  { code: 'zh-TW', messages: zhTwMessages as Messages },
  { code: 'zh-CN', messages: zhCnMessages as Messages },
];

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

const labels: CreateAgentFormLabels = {
  formTitle: 'Create New Agent',
  nameLabel: 'Name',
  namePlaceholder: 'name here',
  roleLabel: 'Role',
  rolePlaceholder: 'role here',
  descriptionLabel: 'Description',
  descriptionPlaceholder: 'description here',
  submitButton: 'Create Agent',
  cancelButton: 'Cancel',
  submitting: 'Creating...',
  nameRequired: 'Agent name is required',
  nameTooLong: 'too long',
  roleRequired: 'Agent role is required',
  roleTooLong: 'too long',
  descriptionRequired: 'Agent description is required',
  descriptionTooLong: 'too long',
  createError: 'Failed to create agent. Please try again.',
  createSuccess: 'Agent created successfully!',
};

const options: UserAgentOptions = {
  replyLanguages: ['owner', 'en', 'zh-TW', 'zh-CN'],
  toolProfiles: ['read'],
  knowledgeScopes: [
    { id: 'company-monthly-reports', type: 'shared' },
    { id: 'three-year-goals', type: 'shared' },
    { id: 'strategy-docs', type: 'shared' },
    { id: 'policies', type: 'shared' },
    { id: 'meeting-summaries', type: 'shared' },
    { id: 'codebase-context', type: 'specialist' },
    { id: 'contract-templates', type: 'specialist' },
    { id: 'market-data', type: 'specialist' },
    { id: 'tech-landscape', type: 'specialist' },
  ],
  connectorTools: [
    { id: 'mail_list_unread_metadata', kind: 'imap' },
    { id: 'calendar_list_today', kind: 'ical' },
  ],
  connectedKinds: [],
  models: [
    { id: 'claude-opus-5-5', provider: 'anthropic', creditsPer1kTokens: 1 },
    { id: 'claude-sonnet-5-5', provider: 'anthropic', creditsPer1kTokens: 1 },
  ],
  templates: ['chief-of-staff'],
  limits: {
    maxInstructionsChars: 4000,
    maxToneChars: 120,
    maxKnowledgeScopes: 9,
    maxBudgetCredits: 1_000_000,
    platformDailyCreditsPerUser: 500,
  },
};

function savedAgent(overrides: Partial<UserAgent> = {}): UserAgent {
  return {
    id: 'agent-1',
    name: 'Weekly digest',
    role: 'Summarises the week',
    description: 'Reads the week and reports.',
    status: 'active',
    initials: 'WD',
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
    tone: 'Brief',
    replyLanguage: 'en',
    purpose: 'Summarise.',
    procedure: 'Read, then list.',
    result: 'A short list.',
    toolProfile: 'read',
    knowledgeScopeIds: ['policies', 'market-data'],
    connectorToolIds: ['mail_list_unread_metadata'],
    model: { choice: 'platform', id: 'claude-sonnet-5-5' },
    budgetPerRunCredits: 20,
    budgetPerDayCredits: 100,
    templateId: null,
    neverDo: [
      { code: 'FILES_NO_CHANGE' },
      { code: 'MAIL_READ_ONLY' },
      { code: 'CALENDAR_NONE' },
      { code: 'KNOWLEDGE_ONLY_SCOPES', scopeIds: ['policies', 'market-data'] },
      { code: 'EXTERNAL_ACTIONS_NONE' },
      { code: 'DECISIONS_OWNER' },
      { code: 'ACCESS_FIXED' },
    ],
    grants: {
      toolProfile: 'read',
      knowledgeScopeIds: ['policies', 'market-data'],
      connectorToolIds: ['mail_list_unread_metadata'],
      dropped: { toolProfile: null, knowledgeScopeIds: [], connectorToolIds: [], missingConnections: [] },
    },
    instructionsChars: 1234,
    maxInstructionsChars: 4000,
    ...overrides,
  };
}

function config(overrides: Partial<AgentWorkflowConfig> = {}): AgentWorkflowConfig {
  return {
    mode: 'create',
    t: enT,
    scopeName: enScope,
    localePrefix: '/en',
    options,
    optionsLoading: false,
    optionsError: false,
    onRetryOptions: () => {},
    onSave: async () => ({}),
    ...overrides,
  };
}

function render(workflow?: AgentWorkflowConfig): string {
  return renderToStaticMarkup(
    <CreateAgentForm labels={labels} onSubmit={async () => ({})} onCancel={() => {}} workflow={workflow} />,
  );
}

describe('workflow editor request bodies', () => {
  test('a blank create left at its defaults sends only name, role and description', () => {
    const draft = { ...emptyWorkflowDraft(), name: ' Digest ', role: 'Helper', description: 'Does things' };
    const body = buildBlankBody(draft);
    assert.deepEqual(body, { name: 'Digest', role: 'Helper', description: 'Does things' });
    assert.deepEqual(Object.keys(body).sort(), ['description', 'name', 'role']);
  });

  test('a blank create with the full workflow maps every field', () => {
    const draft = {
      ...emptyWorkflowDraft(),
      name: 'Digest',
      role: 'Helper',
      description: 'Does things',
      tone: 'Plain',
      replyLanguage: 'zh-TW' as const,
      purpose: 'P',
      procedure: 'Q',
      result: 'R',
      knowledgeScopeIds: ['policies'],
      connectorToolIds: ['calendar_list_today'],
      modelChoice: 'claude-opus-5-5',
      budgetPerRun: '10',
      budgetPerDay: '50',
    };
    assert.deepEqual(buildBlankBody(draft), {
      name: 'Digest',
      role: 'Helper',
      description: 'Does things',
      tone: 'Plain',
      replyLanguage: 'zh-TW',
      purpose: 'P',
      procedure: 'Q',
      result: 'R',
      knowledgeScopeIds: ['policies'],
      connectorToolIds: ['calendar_list_today'],
      model: { choice: 'platform', id: 'claude-opus-5-5' },
      budgetPerRunCredits: 10,
      budgetPerDayCredits: 50,
    });
  });

  test('a template copy sends the template id, name, role and an optional description only', () => {
    const draft = { ...emptyWorkflowDraft(), name: 'My CoS', role: 'Briefs me', description: '', purpose: 'ignored' };
    assert.deepEqual(buildTemplateBody('chief-of-staff', draft), {
      templateId: 'chief-of-staff',
      name: 'My CoS',
      role: 'Briefs me',
    });
    const withDescription = buildTemplateBody('chief-of-staff', { ...draft, description: ' Hello ' });
    assert.equal(withDescription.description, 'Hello');
    assert.equal('purpose' in withDescription, false);
  });

  test('a PATCH sends every editable field, clears with null, and never sends the tool profile', () => {
    const draft = workflowDraftFromAgent(savedAgent());
    const body = buildPatchBody({ ...draft, tone: '', replyLanguage: '', budgetPerRun: '', budgetPerDay: '', modelChoice: 'server' });
    assert.equal(body.tone, null);
    assert.equal(body.replyLanguage, null);
    assert.equal(body.budgetPerRunCredits, null);
    assert.equal(body.budgetPerDayCredits, null);
    assert.deepEqual(body.model, { choice: 'server' });
    assert.equal('toolProfile' in body, false);
    assert.deepEqual(body.knowledgeScopeIds, ['policies', 'market-data']);
    assert.deepEqual(body.connectorToolIds, ['mail_list_unread_metadata']);
    assert.equal(body.purpose, 'Summarise.');
  });

  test('the draft built from a saved workflow maps back to the same PATCH values', () => {
    const body = buildPatchBody(workflowDraftFromAgent(savedAgent()));
    assert.equal(body.tone, 'Brief');
    assert.equal(body.replyLanguage, 'en');
    assert.deepEqual(body.model, { choice: 'platform', id: 'claude-sonnet-5-5' });
    assert.equal(body.budgetPerRunCredits, 20);
    assert.equal(body.budgetPerDayCredits, 100);
  });
});

describe('workflow editor budget and limit checks', () => {
  test('budget input parsing', () => {
    assert.equal(parseBudgetInput(''), null);
    assert.equal(parseBudgetInput(' 12 '), 12);
    assert.ok(Number.isNaN(parseBudgetInput('0')));
    assert.ok(Number.isNaN(parseBudgetInput('1.5')));
    assert.ok(Number.isNaN(parseBudgetInput('-3')));
    assert.ok(Number.isNaN(parseBudgetInput('abc')));
  });

  test('the per-day budget must be at least the per-run budget', () => {
    assert.deepEqual(budgetProblems({ budgetPerRun: '50', budgetPerDay: '20' }, 1_000_000), ['order']);
    assert.deepEqual(budgetProblems({ budgetPerRun: '20', budgetPerDay: '20' }, 1_000_000), []);
    assert.deepEqual(budgetProblems({ budgetPerRun: '20', budgetPerDay: '' }, 1_000_000), []);
    assert.deepEqual(budgetProblems({ budgetPerRun: '', budgetPerDay: '5' }, 1_000_000), []);
    assert.deepEqual(budgetProblems({ budgetPerRun: 'x', budgetPerDay: '5' }, 1_000_000), ['perRunInvalid']);
    assert.deepEqual(budgetProblems({ budgetPerRun: '2000000', budgetPerDay: '' }, 1_000_000), ['perRunInvalid']);
  });

  test('checkWorkflowDraft puts the order message on the per-day field', () => {
    const draft = { ...emptyWorkflowDraft(), budgetPerRun: '50', budgetPerDay: '20' };
    const errors = checkWorkflowDraft({
      draft,
      limits: DEFAULT_WORKFLOW_LIMITS,
      instructions: liveInstructionsCount(draft, null, 4000),
      scope: 'workflow',
    });
    assert.equal(errors.budgetPerDay, 'errors.budgetOrder');
    assert.equal(errors.budgetPerRun, undefined);
  });

  test('checkWorkflowDraft ignores workflow fields for a plain create', () => {
    const draft = { ...emptyWorkflowDraft(), budgetPerRun: '50', budgetPerDay: '20', tone: 'x'.repeat(500) };
    const errors = checkWorkflowDraft({
      draft,
      limits: DEFAULT_WORKFLOW_LIMITS,
      instructions: liveInstructionsCount(draft, null, 4000),
      scope: 'basic',
    });
    assert.deepEqual(errors, {});
  });

  test('the instructions count is exact against the saved count and flags the limit', () => {
    const saved = savedAgent({ instructionsChars: 1234 });
    const same = liveInstructionsCount(workflowDraftFromAgent(saved), saved, 4000);
    assert.equal(same.used, 1234);
    assert.equal(same.max, 4000);
    assert.equal(same.exact, true);
    assert.equal(same.over, false);

    const longer = liveInstructionsCount({ ...workflowDraftFromAgent(saved), procedure: 'x'.repeat(3000) }, saved, 4000);
    assert.equal(longer.used, 1234 + (3000 - 'Read, then list.'.length));
    assert.equal(longer.over, true);

    const fresh = liveInstructionsCount({ ...emptyWorkflowDraft(), purpose: 'abcde' }, null, 4000);
    assert.equal(fresh.used, 5);
    assert.equal(fresh.exact, false);
  });
});

describe('workflow editor refusal-code mapping', () => {
  const expected: Record<string, { field: string; key: string }> = {
    SPEC_INVALID: { field: 'instructions', key: 'errors.specInvalid' },
    INSTRUCTIONS_TOO_LONG: { field: 'instructions', key: 'errors.instructionsTooLong' },
    TOOL_PROFILE_NOT_ALLOWED: { field: 'form', key: 'errors.toolProfileNotAllowed' },
    KNOWLEDGE_SCOPE_UNKNOWN: { field: 'knowledge', key: 'errors.knowledgeScopeUnknown' },
    CONNECTOR_TOOL_UNKNOWN: { field: 'connectors', key: 'errors.connectorToolUnknown' },
    CONNECTION_MISSING: { field: 'connectors', key: 'errors.connectionMissing' },
    MODEL_INVALID: { field: 'model', key: 'errors.modelInvalid' },
    BUDGET_INVALID: { field: 'budget', key: 'errors.budgetInvalid' },
    TEMPLATE_NOT_ALLOWED: { field: 'start', key: 'errors.templateNotAllowed' },
    // USER-TEAMS-01C: the team rule shares the Chief of Staff roster codes.
    ROSTER_TOO_MANY: { field: 'team', key: 'errors.teamTooMany' },
    ROSTER_DUPLICATE: { field: 'team', key: 'errors.teamMemberRefused' },
    ROSTER_INVALID_BODY: { field: 'team', key: 'errors.teamMemberRefused' },
    ROSTER_MEMBER_UNKNOWN: { field: 'team', key: 'errors.teamMemberRefused' },
    ROSTER_MEMBER_NOT_ALLOWED: { field: 'team', key: 'errors.teamMemberRefused' },
    ROSTER_MEMBER_NOT_FOUND: { field: 'team', key: 'errors.teamMemberRefused' },
    ROSTER_MEMBER_SELF: { field: 'team', key: 'errors.teamMemberSelf' },
    // APPROVAL-SET-01C: the approval setting's refusals.
    APPROVAL_LIMIT_REQUIRED: { field: 'approval', key: 'errors.approvalLimitRequired' },
    APPROVAL_LIMIT_INVALID: { field: 'approval', key: 'errors.approvalLimitInvalid' },
    APPROVAL_MODE_INVALID: { field: 'approval', key: 'errors.approvalModeInvalid' },
  };

  test('each gateway refusal code maps to a field and a message key', () => {
    assert.deepEqual(Object.keys(REFUSAL_CODE_MAP).sort(), Object.keys(expected).sort());
    for (const [code, want] of Object.entries(expected)) {
      const mapped = mapRefusal(code);
      assert.equal(mapped.field, want.field, code);
      assert.equal(mapped.messageKey, want.key, code);
    }
  });

  test('an unknown or missing code falls back to the generic message', () => {
    assert.equal(mapRefusal(undefined).messageKey, 'errors.generic');
    assert.equal(mapRefusal('SOMETHING_NEW').messageKey, 'errors.generic');
    assert.equal(mapRefusal('toString').messageKey, 'errors.generic');
    assert.equal(mapRefusal('SOMETHING_NEW').field, 'form');
  });

  test('every mapped message exists in all three languages', () => {
    for (const locale of LOCALES) {
      for (const mapping of [...Object.values(REFUSAL_CODE_MAP), mapRefusal('x')]) {
        const text = resolve(locale.messages, `platform.agentWorkflow.${mapping.messageKey}`);
        assert.ok(text && text.length > 0, `${locale.code}: ${mapping.messageKey}`);
      }
    }
  });
});

describe('workflow editor connector ticks', () => {
  test('connector tools are hidden for kinds the owner has not connected', () => {
    const result = visibleConnectorTools({ ...options, connectedKinds: [] }, []);
    assert.deepEqual(result.rows, []);
    assert.deepEqual(result.hiddenKinds.sort(), ['ical', 'imap']);
  });

  test('a connected kind shows its tool; a tool already held stays visible', () => {
    const connected = visibleConnectorTools({ ...options, connectedKinds: ['imap'] }, []);
    assert.deepEqual(connected.rows.map((row) => row.id), ['mail_list_unread_metadata']);
    assert.deepEqual(connected.hiddenKinds, ['ical']);
    const held = visibleConnectorTools({ ...options, connectedKinds: [] }, ['calendar_list_today']);
    assert.deepEqual(held.rows, [{ id: 'calendar_list_today', kind: 'ical', connected: false }]);
  });

  test('the form shows no connector ticks and links to Connections when nothing is connected', () => {
    const html = render(config());
    assert.ok(!html.includes('agent-workflow-tool-mail_list_unread_metadata'));
    assert.ok(!html.includes('agent-workflow-tool-calendar_list_today'));
    assert.ok(html.includes('data-testid="agent-workflow-connect-hint"'));
    assert.ok(html.includes('href="/en/connections"'));
  });

  test('the form shows a tick for a connected mailbox and keeps the hint for the calendar', () => {
    const html = render(config({ options: { ...options, connectedKinds: ['imap'] } }));
    assert.ok(html.includes('data-testid="agent-workflow-tool-mail_list_unread_metadata"'));
    assert.ok(!html.includes('data-testid="agent-workflow-tool-calendar_list_today"'));
    assert.ok(html.includes('data-testid="agent-workflow-connect-hint"'));
  });

  test('with both kinds connected there is no Connections hint', () => {
    const html = render(config({ options: { ...options, connectedKinds: ['ical', 'imap'] } }));
    assert.ok(html.includes('data-testid="agent-workflow-tool-calendar_list_today"'));
    assert.ok(!html.includes('agent-workflow-connect-hint'));
  });
});

describe('workflow editor rendering', () => {
  test('the plain three-field create keeps its test IDs and shows no workflow controls', () => {
    const html = render(undefined);
    for (const id of [
      'create-agent-form',
      'create-agent-name',
      'create-agent-role',
      'create-agent-description',
      'create-agent-submit',
      'create-agent-cancel',
    ]) {
      assert.ok(html.includes(`data-testid="${id}"`), id);
    }
    assert.ok(!html.includes('agent-workflow-'));
    assert.ok(html.includes('Create Agent'));
  });

  test('the editor in create mode keeps the three-field IDs and adds the new controls', () => {
    const html = render(config());
    for (const id of [
      'create-agent-name',
      'create-agent-role',
      'create-agent-description',
      'create-agent-submit',
      'agent-workflow-start-blank',
      'agent-workflow-start-chief-of-staff',
      'agent-workflow-tone',
      'agent-workflow-reply-language',
      'agent-workflow-purpose',
      'agent-workflow-procedure',
      'agent-workflow-result',
      'agent-workflow-model',
      'agent-workflow-budget-run',
      'agent-workflow-budget-day',
      'agent-workflow-tool-profile',
    ]) {
      assert.ok(html.includes(`data-testid="${id}"`), id);
    }
    for (const scope of options.knowledgeScopes) {
      assert.ok(html.includes(`data-testid="agent-workflow-scope-${scope.id}"`), scope.id);
    }
  });

  test('the tool profile is shown as read only and is not an input', () => {
    const html = render(config());
    assert.ok(html.includes('data-testid="agent-workflow-tool-profile-value"'));
    assert.ok(html.includes(enT('toolProfileRead')));
    assert.ok(!html.includes('name="toolProfile"'));
  });

  test('the model list shows each model with its credit cost', () => {
    const html = render(config());
    assert.ok(html.includes('claude-sonnet-5-5 (1 credit per 1K tokens)'));
    assert.ok(html.includes(enT('modelServer')));
  });

  test('a new workflow shows the typed count and the not-yet-saved note for the never-do list', () => {
    const html = render(config());
    assert.ok(html.includes('0 of 4000 characters typed'));
    assert.ok(html.includes('data-testid="agent-workflow-never-do-pending"'));
    assert.ok(!html.includes('data-testid="agent-workflow-grants"'));
  });

  test('editing shows used of max from the server, the never-do list and the grants', () => {
    const html = render(config({ mode: 'edit', agent: savedAgent() }));
    assert.ok(html.includes('1234 of 4000 characters used'));
    assert.ok(html.includes('data-testid="agent-workflow-never-do"'));
    for (const line of savedAgent().neverDo ?? []) {
      assert.ok(html.includes(`data-testid="agent-workflow-never-do-${line.code}"`), line.code);
    }
    assert.ok(html.includes('Read any Knowledge folder except: Policies, Market data.'));
    assert.ok(html.includes('data-testid="agent-workflow-grants"'));
    assert.ok(html.includes('data-testid="agent-workflow-grants-folders"'));
    assert.ok(html.includes('Edit workflow'));
    assert.ok(html.includes(enT('saveButton')));
  });

  test('editing starts from the saved values', () => {
    const html = render(config({ mode: 'edit', agent: savedAgent() }));
    assert.ok(html.includes('value="Weekly digest"'));
    assert.ok(html.includes('value="Brief"'));
    assert.ok(html.includes('value="20"'));
    assert.ok(html.includes('value="100"'));
  });

  test('the over-limit state turns the counter red in the edit view', () => {
    const agent = savedAgent({ instructionsChars: 4100 });
    const html = render(config({ mode: 'edit', agent }));
    assert.ok(html.includes('4100 of 4000 characters used'));
    assert.ok(html.includes('text-red-400'));
  });

  test('loading shows the spinner and disables the submit button', () => {
    const html = render(config({ options: null, optionsLoading: true }));
    assert.ok(html.includes('data-testid="agent-workflow-options-loading"'));
    assert.ok(html.includes('data-testid="ui-spinner"'));
    assert.ok(html.includes(enT('optionsLoading')));
    assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="create-agent-submit"/);
  });

  test('a failed options load shows the message and Try again, and a plain create stays possible', () => {
    const html = render(config({ options: null, optionsError: true }));
    assert.ok(html.includes('data-testid="agent-workflow-options-error"'));
    assert.ok(html.includes('data-testid="agent-workflow-options-retry"'));
    assert.ok(!html.includes('data-testid="agent-workflow-purpose"'));
    assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*data-testid="create-agent-submit"/);
  });

  test('editing without options cannot be saved', () => {
    const html = render(config({ mode: 'edit', agent: savedAgent(), options: null, optionsError: true }));
    assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="create-agent-submit"/);
  });

  test('after a copy from a template the editor says so', () => {
    const html = render(config({ mode: 'edit', agent: savedAgent(), createdNotice: true }));
    assert.ok(html.includes('data-testid="agent-workflow-copied"'));
    assert.ok(html.includes(enT('templateCopied')));
  });
});

describe('workflow editor never-do lines', () => {
  test('each code renders through a translation key', () => {
    const lines = neverDoLines([{ code: 'MAIL_NONE' }, { code: 'KNOWLEDGE_ONLY_SCOPES', scopeIds: ['policies'] }]);
    assert.deepEqual(lines.map((line) => line.messageKey), ['neverDo.MAIL_NONE', 'neverDo.KNOWLEDGE_ONLY_SCOPES']);
    assert.deepEqual(lines[1].scopeIds, ['policies']);
    assert.deepEqual(neverDoLines(undefined), []);
  });
});

describe('workflow editor translations', () => {
  const baseline = flatten((enMessages as Messages & { platform: Record<string, unknown> }).platform.agentWorkflow);
  const keys = Object.keys(baseline);

  test('every language has the same keys, none empty', () => {
    assert.ok(keys.length > 80);
    for (const locale of LOCALES) {
      const own = flatten((locale.messages as { platform: Record<string, unknown> }).platform.agentWorkflow);
      assert.deepEqual(Object.keys(own).sort(), [...keys].sort(), locale.code);
      for (const [key, value] of Object.entries(own)) {
        assert.ok(value.trim().length > 0, `${locale.code}: ${key}`);
      }
    }
  });

  test('zh-TW and zh-CN are translated, not copies of the English', () => {
    const sameAllowed = new Set(['templates.chief-of-staff']);
    for (const code of ['zh-TW', 'zh-CN']) {
      const locale = LOCALES.find((item) => item.code === code)!;
      const own = flatten((locale.messages as { platform: Record<string, unknown> }).platform.agentWorkflow);
      for (const key of keys) {
        if (sameAllowed.has(key)) continue;
        assert.notEqual(own[key], baseline[key], `${code}: ${key}`);
        assert.match(own[key], /[一-鿿]/, `${code}: ${key}`);
      }
    }
  });

  test('placeholders match across languages', () => {
    for (const locale of LOCALES) {
      const own = flatten((locale.messages as { platform: Record<string, unknown> }).platform.agentWorkflow);
      for (const key of keys) {
        const want = (baseline[key].match(/\{\w+\}/g) ?? []).sort();
        const have = (own[key].match(/\{\w+\}/g) ?? []).sort();
        assert.deepEqual(have, want, `${locale.code}: ${key}`);
      }
    }
  });

  test('every key the editor looks up exists', () => {
    const wanted: string[] = [
      ...NEVER_DO_CODES.map((code) => `neverDo.${code}`),
      ...REPLY_LANGUAGE_CHOICES.map((code) => `replyLanguage.${code}`),
      'replyLanguage.unset',
      'tools.mail_list_unread_metadata',
      'tools.calendar_list_today',
      'templates.chief-of-staff',
      'errors.toneTooLong',
      'errors.instructionsOver',
      'errors.budgetPerRunInvalid',
      'errors.budgetPerDayInvalid',
      'errors.budgetOrder',
      'errors.generic',
      'errors.saveFailed',
      'editButton',
      'editTitle',
      'saveButton',
      'saving',
      'saved',
      'templateNote',
      'templateCopied',
      'shownPending',
    ];
    for (const key of wanted) {
      assert.ok(keys.includes(key), key);
    }
    for (const locale of LOCALES) {
      for (const scope of options.knowledgeScopes) {
        assert.ok(resolve(locale.messages, `knowledge.scopes.${scope.id}`), `${locale.code}: ${scope.id}`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// WORKFLOW-CREATE-01: Role and Description prefilled from the template and explained
// ---------------------------------------------------------------------------

const chiefOfStaffAgent = {
  id: 'chief-of-staff',
  roleKey: 'agents.chiefOfStaff.role',
  descriptionKey: 'agents.chiefOfStaff.description',
};

function localeText(messages: Messages): (key: string) => string {
  return (key: string) => resolve(messages, key) ?? key;
}

function localeLabels(messages: Messages): CreateAgentFormLabels {
  const text = (key: string) => resolve(messages, `platform.agentCreate.${key}`) ?? `MISSING:${key}`;
  return {
    ...labels,
    roleLabel: text('roleLabel'),
    descriptionLabel: text('descriptionLabel'),
    roleHint: text('roleHint'),
    descriptionHint: text('descriptionHint'),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

describe('WORKFLOW-CREATE-01 template prefill', () => {
  const cos = { role: 'Daily Operations Assistant', description: 'Answers questions.' };

  test('empty fields take the template text', () => {
    assert.deepEqual(templatePrefillPatch({ role: '', description: '  ' }, null, cos), cos);
  });

  test('text the owner typed is kept', () => {
    assert.deepEqual(templatePrefillPatch({ role: 'My role', description: 'Mine' }, null, cos), {
      role: 'My role',
      description: 'Mine',
    });
  });

  test('going back to blank clears the untouched prefill but keeps an edit', () => {
    assert.deepEqual(templatePrefillPatch({ role: cos.role, description: 'Edited by me' }, cos, null), {
      role: '',
      description: 'Edited by me',
    });
  });

  test('the copy uses the template keys from the system agents list in every language', () => {
    for (const locale of LOCALES) {
      const text = localeText(locale.messages);
      const prefill = templatePrefillFor('chief-of-staff', [chiefOfStaffAgent], text);
      assert.deepEqual(
        prefill,
        {
          role: resolve(locale.messages, 'agents.chiefOfStaff.role'),
          description: resolve(locale.messages, 'agents.chiefOfStaff.description'),
        },
        locale.code,
      );
      assert.ok(prefill!.role.length > 0 && prefill!.description.length > 0, locale.code);
    }
  });

  test('without the system agents list it falls back to the registry key names; unknown gives null', () => {
    const text = localeText(enMessages as Messages);
    assert.deepEqual(templatePrefillFor('chief-of-staff', [], text), {
      role: resolve(enMessages as Messages, 'agents.chiefOfStaff.role'),
      description: resolve(enMessages as Messages, 'agents.chiefOfStaff.description'),
    });
    assert.equal(templatePrefillFor('no-such-template', [], text), null);
  });

  test('the form opened on the template shows its role and description, still editable', () => {
    for (const locale of LOCALES) {
      const text = localeText(locale.messages);
      const html = render(
        config({
          initialStart: 'chief-of-staff',
          templatePrefill: (id) => templatePrefillFor(id, [chiefOfStaffAgent], text),
        }),
      );
      const role = resolve(locale.messages, 'agents.chiefOfStaff.role')!;
      const description = resolve(locale.messages, 'agents.chiefOfStaff.description')!;
      const roleInput = /<input[^>]*data-testid="create-agent-role"[^>]*>/.exec(html)?.[0] ?? '';
      assert.ok(roleInput.includes(`value="${escapeHtml(role)}"`), locale.code);
      assert.ok(!roleInput.includes('disabled=""'), locale.code);
      const area = /<textarea[^>]*data-testid="create-agent-description"[^>]*>([\s\S]*?)<\/textarea>/.exec(html);
      assert.equal(area?.[1], escapeHtml(description), locale.code);
      assert.match(html, /<input[^>]*data-testid="agent-workflow-start-chief-of-staff"[^>]*checked=""/);
    }
  });

  test('a blank start leaves role and description empty', () => {
    const html = render(config({ templatePrefill: () => cos }));
    const roleInput = /<input[^>]*data-testid="create-agent-role"[^>]*>/.exec(html)?.[0] ?? '';
    assert.ok(roleInput.includes('value=""'));
  });
});

describe('WORKFLOW-CREATE-01 role and description hints', () => {
  test('both hints render under their fields in all three languages', () => {
    for (const locale of LOCALES) {
      const own = localeLabels(locale.messages);
      for (const workflow of [config(), config({ mode: 'edit', agent: savedAgent() }), undefined]) {
        const html = renderToStaticMarkup(
          <CreateAgentForm labels={own} onSubmit={async () => ({})} onCancel={() => {}} workflow={workflow} />,
        );
        assert.ok(html.includes(`data-testid="create-agent-role-hint">${escapeHtml(own.roleHint!)}<`), locale.code);
        assert.ok(
          html.includes(`data-testid="create-agent-description-hint">${escapeHtml(own.descriptionHint!)}<`),
          locale.code,
        );
        assert.match(html, /<input[^>]*aria-describedby="agent-role-hint"[^>]*data-testid="create-agent-role"/);
        assert.match(
          html,
          /<textarea[^>]*aria-describedby="agent-description-hint"[^>]*data-testid="create-agent-description"/,
        );
      }
    }
  });

  test('the hints are real translations and say the text is not part of the instructions', () => {
    const en = localeLabels(enMessages as Messages);
    assert.match(en.roleHint!, /card/);
    assert.match(en.roleHint!, /Not part of the workflow's instructions/);
    assert.match(en.descriptionHint!, /Not part of the workflow's instructions/);
    for (const code of ['zh-TW', 'zh-CN']) {
      const own = localeLabels(LOCALES.find((locale) => locale.code === code)!.messages);
      for (const hint of [own.roleHint!, own.descriptionHint!]) {
        assert.notEqual(hint, en.roleHint);
        assert.match(hint, /[一-鿿]/, code);
        assert.match(hint, /卡片/, code);
      }
    }
  });

  test('without hint labels the fields render as before', () => {
    const html = render(config());
    assert.ok(!html.includes('create-agent-role-hint'));
    assert.ok(!html.includes('aria-describedby="agent-role-hint"'));
  });
});

describe('WORKFLOW-CREATE-01 draft badge', () => {
  test('a draft reads Draft on its card in every language', () => {
    for (const locale of LOCALES) {
      assert.equal(
        getUserAgentStatusLabel('draft', locale.messages),
        resolve(locale.messages, 'platform.agentCreate.agentStatusDraft'),
        locale.code,
      );
    }
    assert.equal(getUserAgentStatusLabel('draft', enMessages as Messages), 'Draft');
  });
});

// ---------------------------------------------------------------------------
// USER-TEAMS-01C: the Team block in the workflow form
// ---------------------------------------------------------------------------

const WF_A = 'f0f0f0f0-0000-4000-8000-00000000000a';
const WF_B = 'f0f0f0f0-0000-4000-8000-00000000000b';
const WF_C = 'f0f0f0f0-0000-4000-8000-00000000000c';
const WF_GONE = 'f0f0f0f0-0000-4000-8000-0000000000ff';

const teamOptions: UserAgentOptions = {
  ...options,
  teamChoices: [
    { id: 'product-strategy', kind: 'system', name: 'Product Strategy', status: 'active' },
    { id: 'technology-advisor', kind: 'system', name: 'Technology Advisor', status: 'active' },
    { id: WF_A, kind: 'workflow', name: 'Tax helper', status: 'active' },
    { id: WF_B, kind: 'workflow', name: 'Draft helper', status: 'draft' },
    { id: WF_C, kind: 'workflow', name: 'Paused helper', status: 'disabled' },
  ],
};

describe('USER-TEAMS-01C team request bodies', () => {
  test('a blank create with no team sends no teamMemberIds, so it stays as before', () => {
    const body = buildBlankBody({ ...emptyWorkflowDraft(), name: 'D', role: 'R', description: 'x' });
    assert.equal('teamMemberIds' in body, false);
  });

  test('a blank create sends the ticked team in order', () => {
    const body = buildBlankBody({
      ...emptyWorkflowDraft(),
      name: 'D',
      role: 'R',
      description: 'x',
      teamMemberIds: ['product-strategy', WF_A],
    });
    assert.deepEqual(body.teamMemberIds, ['product-strategy', WF_A]);
  });

  test('a PATCH always sends teamMemberIds, and [] when the team was emptied', () => {
    const draft = workflowDraftFromAgent(savedAgent({ teamMemberIds: [WF_A] }));
    assert.deepEqual(buildPatchBody(draft).teamMemberIds, [WF_A]);
    assert.deepEqual(buildPatchBody({ ...draft, teamMemberIds: [] }).teamMemberIds, []);
    assert.deepEqual(buildPatchBody(workflowDraftFromAgent(savedAgent())).teamMemberIds, []);
  });

  test('the draft keeps a copy of the saved team', () => {
    const agent = savedAgent({ teamMemberIds: ['technology-advisor'] });
    const draft = workflowDraftFromAgent(agent);
    assert.deepEqual(draft.teamMemberIds, ['technology-advisor']);
    draft.teamMemberIds.push(WF_A);
    assert.deepEqual(agent.teamMemberIds, ['technology-advisor']);
  });
});

describe('USER-TEAMS-01C team ticks and rows', () => {
  test('a fourth tick is refused and the list stays as it was', () => {
    const three = ['product-strategy', 'technology-advisor', WF_A];
    const refused = toggleTeamMember(three, WF_B);
    assert.deepEqual(refused, { ids: three, limitHit: true });
    assert.notEqual(refused.ids, three);
    assert.deepEqual(toggleTeamMember(three, WF_A), {
      ids: ['product-strategy', 'technology-advisor'],
      limitHit: false,
    });
    assert.deepEqual(toggleTeamMember([], WF_B), { ids: [WF_B], limitHit: false });
  });

  test('the rows leave out the workflow being edited, in any letter case', () => {
    const rows = teamChoiceRows(teamOptions, [], WF_A.toUpperCase());
    assert.deepEqual(
      rows.map((row) => row.id),
      ['product-strategy', 'technology-advisor', WF_B, WF_C],
    );
    assert.equal(teamChoiceRows(teamOptions, [], null).length, 5);
  });

  test('a draft or switched-off workflow carries a note; advisors and active rows do not', () => {
    const rows = teamChoiceRows(teamOptions, [], null);
    const note = (id: string) => rows.find((row) => row.id === id)?.note;
    assert.equal(note('product-strategy'), null);
    assert.equal(note(WF_A), null);
    assert.equal(note(WF_B), 'draft');
    assert.equal(note(WF_C), 'off');
  });

  test('a saved member that is no longer a choice stays listed so it can be unticked', () => {
    const rows = teamChoiceRows(teamOptions, [WF_GONE], null);
    const gone = rows[rows.length - 1];
    assert.equal(gone.id, WF_GONE);
    assert.equal(gone.name, '');
    assert.equal(teamMemberName(enT, gone), enT('teamUnknown'));
  });

  test('options from an older gateway without teamChoices give no rows', () => {
    assert.deepEqual(teamChoiceRows(options, [], null), []);
  });

  test('names: advisors are translated, workflows keep their own name, a missing one reads unknown', () => {
    assert.deepEqual(teamNamesFor(enT, ['product-strategy', WF_A, WF_GONE], teamOptions.teamChoices), [
      'Product Strategy',
      'Tax helper',
      enT('teamUnknown'),
    ]);
    const zhTw = (key: string) => resolve(zhTwMessages as Messages, `platform.agentWorkflow.${key}`) ?? key;
    assert.deepEqual(teamNamesFor(zhTw, ['technology-advisor', WF_A], teamOptions.teamChoices), [
      zhTw('teamNames.technology-advisor'),
      'Tax helper',
    ]);
  });
});

describe('USER-TEAMS-01C team refusals', () => {
  test('a 400 without a code that names teamMemberIds reads as the team limit', () => {
    const mapped = mapRefusal(undefined, 'teamMemberIds must contain no more than 3 elements');
    assert.deepEqual(mapped, { field: 'team', messageKey: 'errors.teamTooMany' });
    assert.equal(mapRefusal(undefined, 'something else').messageKey, 'errors.generic');
    assert.equal(mapRefusal(undefined).messageKey, 'errors.generic');
  });

  test('the client check refuses more than three members on the team field', () => {
    const draft = { ...emptyWorkflowDraft(), teamMemberIds: ['a', 'b', 'c', 'd'] };
    const errors = checkWorkflowDraft({
      draft,
      limits: DEFAULT_WORKFLOW_LIMITS,
      instructions: liveInstructionsCount(draft, null, 4000),
      scope: 'workflow',
    });
    assert.equal(errors.team, 'errors.teamTooMany');
  });
});

describe('USER-TEAMS-01C team block rendering', () => {
  test('the form lists the choices with kind text, notes, a count and the approval hint', () => {
    const html = render(config({ options: teamOptions }));
    assert.ok(html.includes('data-testid="agent-workflow-team"'));
    for (const id of ['product-strategy', 'technology-advisor', WF_A, WF_B, WF_C]) {
      assert.ok(html.includes(`data-testid="agent-workflow-team-${id}"`), id);
    }
    assert.ok(html.includes('Tax helper'));
    assert.ok(html.includes('Product Strategy'));
    assert.ok(html.includes(enT('teamKindSystem')));
    assert.ok(html.includes(enT('teamKindWorkflow')));
    assert.ok(html.includes(`data-testid="agent-workflow-team-note-${WF_B}"`));
    assert.ok(html.includes(`data-testid="agent-workflow-team-note-${WF_C}"`));
    assert.ok(!html.includes(`data-testid="agent-workflow-team-note-${WF_A}"`));
    assert.ok(html.includes('0 of 3 picked'));
    assert.ok(html.includes(enT('teamApprovalHint')));
    assert.ok(!html.includes('agent-workflow-team-limit'));
  });

  test('the Advanced details stay closed with no team and open when a team is saved', () => {
    const closed = render(config({ options: teamOptions }));
    const detailsTag = (html: string) => /<details[^>]*data-testid="agent-workflow-advanced"[^>]*>/.exec(html)![0];
    assert.doesNotMatch(detailsTag(closed), / open=/);
    const open = render(
      config({ mode: 'edit', agent: savedAgent({ id: WF_C, teamMemberIds: [WF_A] }), options: teamOptions }),
    );
    assert.match(detailsTag(open), / open=/);
    assert.ok(open.includes('1 of 3 picked'));
    assert.match(open, new RegExp(`<input[^>]*data-testid="agent-workflow-team-${WF_A}" checked=""`));
  });

  test('editing leaves the row itself out of the list', () => {
    const html = render(config({ mode: 'edit', agent: savedAgent({ id: WF_A }), options: teamOptions }));
    assert.ok(!html.includes(`data-testid="agent-workflow-team-${WF_A}"`));
    assert.ok(html.includes(`data-testid="agent-workflow-team-${WF_B}"`));
  });

  test('with no other agents the block says so instead of showing an empty list', () => {
    const html = render(config({ options }));
    assert.ok(html.includes('data-testid="agent-workflow-team-empty"'));
    assert.ok(html.includes(enT('teamEmpty')));
  });

  test('the Advanced heading names the team in every language', () => {
    assert.equal(enT('sectionAdvanced'), 'Advanced: model, budget, team and approval');
    for (const locale of LOCALES.slice(1)) {
      const text = resolve(locale.messages, 'platform.agentWorkflow.sectionAdvanced')!;
      assert.match(text, /團隊|团队/, locale.code);
      assert.match(text, /核准|批准/, locale.code);
    }
  });

  test('every new Team key exists in all three languages with the same placeholders', () => {
    const wanted = [
      'teamLabel', 'teamHint', 'teamApprovalHint', 'teamCount', 'teamLimit', 'teamEmpty',
      'teamKindSystem', 'teamKindWorkflow', 'teamNoteDraft', 'teamNoteOff', 'teamUnknown',
      'teamNames.product-strategy', 'teamNames.technology-advisor',
      'summary.team', 'summary.teamNone',
      'errors.teamTooMany', 'errors.teamMemberRefused', 'errors.teamMemberSelf',
    ];
    const holders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of wanted) {
      const english = resolve(enMessages as Messages, `platform.agentWorkflow.${key}`);
      assert.ok(english && english.length > 0, `en ${key}`);
      for (const locale of LOCALES.slice(1)) {
        const own = resolve(locale.messages, `platform.agentWorkflow.${key}`);
        assert.ok(own && own.length > 0, `${locale.code} ${key}`);
        assert.match(own, /[一-鿿]/, `${locale.code} ${key}`);
        assert.deepEqual(holders(own), holders(english), `${locale.code} ${key}`);
      }
    }
  });
});

describe('APPROVAL-SET-01C approval request bodies', () => {
  const base = { ...emptyWorkflowDraft(), name: 'D', role: 'R', description: 'x' };

  test('a blank create left at "every" sends neither approval field, so it stays as before', () => {
    const body = buildBlankBody(base);
    assert.equal('approvalMode' in body, false);
    assert.equal('approvalCreditLimit' in body, false);
  });

  test('a blank create sends the mode and the limit for credits', () => {
    const body = buildBlankBody({ ...base, approvalMode: 'credits', approvalCreditLimit: ' 25 ' });
    assert.equal(body.approvalMode, 'credits');
    assert.equal(body.approvalCreditLimit, 25);
  });

  test('a blank create with read_only sends a null limit', () => {
    const body = buildBlankBody({ ...base, approvalMode: 'read_only', approvalCreditLimit: '99' });
    assert.equal(body.approvalMode, 'read_only');
    assert.equal(body.approvalCreditLimit, null);
  });

  test('a PATCH always sends the mode; the limit is a number only for credits', () => {
    const draft = workflowDraftFromAgent(savedAgent());
    assert.equal(draft.approvalMode, 'every');
    assert.equal(draft.approvalCreditLimit, '');
    const every = buildPatchBody(draft);
    assert.equal(every.approvalMode, 'every');
    assert.equal(every.approvalCreditLimit, null);
    const credits = buildPatchBody({ ...draft, approvalMode: 'credits', approvalCreditLimit: '40' });
    assert.equal(credits.approvalMode, 'credits');
    assert.equal(credits.approvalCreditLimit, 40);
    const readOnly = buildPatchBody({ ...draft, approvalMode: 'read_only', approvalCreditLimit: '40' });
    assert.equal(readOnly.approvalMode, 'read_only');
    assert.equal(readOnly.approvalCreditLimit, null);
  });

  test('the draft reads the saved setting; an unknown stored mode reads as every', () => {
    const credits = workflowDraftFromAgent(savedAgent({ approvalMode: 'credits', approvalCreditLimit: 12 }));
    assert.equal(credits.approvalMode, 'credits');
    assert.equal(credits.approvalCreditLimit, '12');
    const odd = workflowDraftFromAgent(savedAgent({ approvalMode: 'sometimes' as unknown as 'every' }));
    assert.equal(odd.approvalMode, 'every');
  });

  test('the limit is a whole number from 1 to 1,000,000', () => {
    assert.equal(parseApprovalLimit('1'), 1);
    assert.equal(parseApprovalLimit('1000000'), 1_000_000);
    for (const bad of ['', '0', '-3', '1.5', 'abc', '1000001']) assert.equal(parseApprovalLimit(bad), null, bad);
  });
});

describe('APPROVAL-SET-01C approval checks and refusals', () => {
  const check = (draft: ReturnType<typeof emptyWorkflowDraft>) =>
    checkWorkflowDraft({
      draft,
      limits: DEFAULT_WORKFLOW_LIMITS,
      instructions: { used: 0, max: 4000, exact: false, over: false },
      scope: 'workflow',
    });

  test('credits needs a number: empty and bad values get their own message', () => {
    assert.equal(check({ ...emptyWorkflowDraft(), approvalMode: 'credits' }).approval, 'errors.approvalLimitRequired');
    assert.equal(
      check({ ...emptyWorkflowDraft(), approvalMode: 'credits', approvalCreditLimit: '0' }).approval,
      'errors.approvalLimitInvalid',
    );
    assert.equal(check({ ...emptyWorkflowDraft(), approvalMode: 'credits', approvalCreditLimit: '5' }).approval, undefined);
    assert.equal(check({ ...emptyWorkflowDraft(), approvalMode: 'read_only' }).approval, undefined);
    assert.equal(check(emptyWorkflowDraft()).approval, undefined);
  });

  test('a 400 without a code that names the approval fields reads as the approval message', () => {
    assert.deepEqual(mapRefusal(undefined, 'approvalMode must be one of the following values: every, credits, read_only'), {
      field: 'approval',
      messageKey: 'errors.approvalInvalid',
    });
    assert.equal(mapRefusal(undefined, 'approvalCreditLimit must not be greater than 1000000').field, 'approval');
    assert.equal(mapRefusal('SOMETHING_NEW', 'approvalMode is bad').field, 'form');
  });
});

describe('APPROVAL-SET-01C approval fieldset rendering', () => {
  const detailsTag = (html: string) => /<details[^>]*data-testid="agent-workflow-advanced"[^>]*>/.exec(html)![0];
  const inputTag = (html: string, id: string) =>
    new RegExp(`<input[^>]*data-testid="${id}"[^>]*>`).exec(html)?.[0] ?? '';

  test('three choices render, "every" is checked by default and no limit input shows', () => {
    const html = render(config({ options: teamOptions }));
    assert.ok(html.includes('data-testid="agent-workflow-approval"'));
    for (const mode of ['every', 'read_only', 'credits']) {
      assert.ok(html.includes(`data-testid="agent-workflow-approval-${mode}"`), mode);
    }
    assert.match(inputTag(html, 'agent-workflow-approval-every'), /checked=""/);
    assert.doesNotMatch(inputTag(html, 'agent-workflow-approval-credits'), /checked=""/);
    assert.doesNotMatch(html, /data-testid="agent-workflow-approval-limit"/);
    assert.ok(html.includes(enT('approvalNever')));
    assert.match(html, /data-testid="agent-workflow-approval-first"[^>]*>The first step/);
    assert.ok(html.includes(enT('approvalHint')));
    assert.ok(html.includes(enT('teamApprovalHint')));
    assert.ok(!html.includes(enT('teamApprovalHintAuto')));
    assert.doesNotMatch(detailsTag(html), / open=/);
  });

  test('a saved credits setting opens the details, shows the limit and the automatic team hint', () => {
    const html = render(
      config({
        mode: 'edit',
        agent: savedAgent({ id: WF_C, teamMemberIds: [WF_A], approvalMode: 'credits', approvalCreditLimit: 30 }),
        options: teamOptions,
      }),
    );
    assert.match(detailsTag(html), / open=/);
    assert.match(inputTag(html, 'agent-workflow-approval-limit'), /value="30"/);
    assert.match(inputTag(html, 'agent-workflow-approval-credits'), /checked=""/);
    assert.ok(html.includes(enT('teamApprovalHintAuto')));
    assert.ok(!html.includes('agent-workflow-approval-no-team'));
  });

  test('a read-only setting with no team says it has no effect yet', () => {
    const html = render(config({ mode: 'edit', agent: savedAgent({ approvalMode: 'read_only' }), options: teamOptions }));
    assert.match(detailsTag(html), / open=/);
    assert.ok(html.includes('data-testid="agent-workflow-approval-no-team"'));
    assert.ok(html.includes(enT('approvalNoTeam')));
    assert.doesNotMatch(html, /data-testid="agent-workflow-approval-limit"/);
  });

  test('the existing Team and budget test ids are kept', () => {
    const html = render(config({ options: teamOptions }));
    for (const id of ['agent-workflow-team', 'agent-workflow-team-count', 'agent-workflow-team-approval', 'agent-workflow-budget-run']) {
      assert.ok(html.includes(`data-testid="${id}"`), id);
    }
  });

  test('every approval key exists in all three languages with the same placeholders and real Chinese', () => {
    const wanted = [
      'approvalLabel', 'approvalHint', 'approvalEvery', 'approvalReadOnly', 'approvalCredits',
      'approvalCreditsLimit', 'approvalLimitPlaceholder', 'approvalNever', 'approvalNoTeam',
      'teamApprovalHintAuto', 'summary.approval', 'summary.approvalEvery', 'summary.approvalCredits',
      'summary.approvalReadOnly', 'errors.approvalLimitInvalid', 'errors.approvalLimitRequired',
      'errors.approvalModeInvalid', 'errors.approvalInvalid',
    ];
    const holders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of wanted) {
      const english = resolve(enMessages as Messages, `platform.agentWorkflow.${key}`);
      assert.ok(english && english.length > 0, `en ${key}`);
      for (const locale of LOCALES.slice(1)) {
        const own = resolve(locale.messages, `platform.agentWorkflow.${key}`);
        assert.ok(own && own.length > 0, `${locale.code} ${key}`);
        assert.deepEqual(holders(own), holders(english), `${locale.code} ${key}`);
        assert.match(own, /[一-鿿]/, `${locale.code} ${key}`);
        assert.notEqual(own, english, `${locale.code} ${key}`);
      }
    }
  });
});
