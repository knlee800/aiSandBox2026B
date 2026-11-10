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
  emptyWorkflowDraft,
  liveInstructionsCount,
  mapRefusal,
  neverDoLines,
  parseBudgetInput,
  templatePrefillPatch,
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
