import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import React, { act, createElement } from 'react';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import enMessages from '../../messages/en.json';
import zhCnMessages from '../../messages/zh-CN.json';
import zhTwMessages from '../../messages/zh-TW.json';
import { fillTemplate } from '../../lib/collaboration/logic';
import { useCollaborationScreen } from './collaboration-page';
import CollaborationView, {
  type CollaborationViewLabels,
  type CollaborationWorkflowPickerView,
  type CollaborationWorkflowStartView,
} from './collaboration-view';
import {
  WORKFLOW_REFUSAL_MESSAGE_KEYS,
  collaborationWorkflowActions,
  collaborationWorkflowRefusal,
  collaborationWorkflowSpentLine,
  collaborationWorkflowStartBody,
  collaborationWorkflowSummary,
  preselectWorkflowId,
  readCollaborationWorkflows,
  readRunWorkflow,
  type CollaborationWorkflowItem,
  type CollaborationWorkflowList,
} from './collaboration-workflows';

const WORKFLOW_ID = 'f0f0f0f0-0000-4000-8000-000000000001';
const labels = enMessages.collaboration as CollaborationViewLabels;
type Catalog = Record<string, string>;
const EN = enMessages.collaboration as Catalog;
const CATALOGS: Array<[string, Catalog]> = [
  ['en', enMessages.collaboration as Catalog],
  ['zh-TW', zhTwMessages.collaboration as Catalog],
  ['zh-CN', zhCnMessages.collaboration as Catalog],
];

const NEW_KEYS = [
  'workflowPickerLabel',
  'workflowsLoading',
  'workflowsEmpty',
  'workflowsFailed',
  'workflowsRetry',
  'workflowStatusActive',
  'workflowStatusDraft',
  'workflowStatusDisabled',
  'workflowTested',
  'workflowNotTested',
  'workflowFolders',
  'workflowModelServer',
  'workflowBudgetPerRun',
  'workflowNoBudget',
  'workflowSpentToday',
  'startTestRun',
  'workflowNeedsTest',
  'workflowDraftHint',
  'workflowOffHint',
  'testRunBadge',
  'chainEmptyWorkflow',
  'refusalWorkflowNotFound',
  'refusalWorkflowDisabled',
  'refusalWorkflowInvalid',
  'refusalWorkflowNotTested',
  'refusalWorkflowBudgetDay',
  'refusalWorkflowBudgetRun',
];

function item(overrides: Partial<CollaborationWorkflowItem> = {}): CollaborationWorkflowItem {
  return {
    id: WORKFLOW_ID,
    name: 'Morning brief',
    role: 'Assistant',
    status: 'active',
    tested: true,
    knowledgeScopeIds: ['policies', 'strategy-docs'],
    model: { choice: 'server' },
    budgetPerRunCredits: null,
    budgetPerDayCredits: null,
    spentTodayCredits: 0,
    lastRunCredits: null,
    ...overrides,
  };
}

const idle = {
  backHref: '/en/app',
  sessionReady: true,
  projectReady: true,
  loading: false,
  notice: null,
  conversationCreated: false,
  deciding: false,
  team: [],
  selectedTeam: 'coding' as const,
  teamChoices: [{ id: 'coding' as const, label: 'Coding', hint: 'hint' }],
  onTeamChange: () => {},
  handoffs: [],
  runs: [],
  runEndedByReject: false,
  rejectReferralId: null,
  rejectReason: '',
  onTaskChange: () => {},
  onStart: () => {},
  onOpenRun: () => {},
  onApprove: () => {},
  onApproveWithoutTestsChange: () => {},
  onBeginReject: () => {},
  onCancelReject: () => {},
  onConfirmReject: () => {},
  onRejectReasonChange: () => {},
  editReferralId: null,
  editPrompt: '',
  onBeginEdit: () => {},
  onCancelEdit: () => {},
  onEditPromptChange: () => {},
  onConfirmEdit: () => {},
  selectedRunActive: false,
  confirmingCancel: false,
  onBeginCancel: () => {},
  onCancelCancel: () => {},
  onConfirmCancel: () => {},
};

function picker(
  state: CollaborationWorkflowPickerView['state'],
  items: CollaborationWorkflowPickerView['items'] = [],
): CollaborationWorkflowPickerView {
  return {
    state,
    labels: {
      heading: EN.workflowPickerLabel,
      loading: EN.workflowsLoading,
      empty: EN.workflowsEmpty,
      failed: EN.workflowsFailed,
      retry: EN.workflowsRetry,
    },
    items,
    onSelect: () => {},
    onRetry: () => {},
  };
}

function render(overrides: Record<string, unknown>): string {
  return renderToStaticMarkup(
    React.createElement(CollaborationView, {
      labels,
      task: 'Brief me',
      ...idle,
      ...overrides,
    } as React.ComponentProps<typeof CollaborationView>),
  );
}

function startView(overrides: Partial<CollaborationWorkflowStartView>): CollaborationWorkflowStartView {
  return {
    canTest: true,
    canRun: true,
    testLabel: (enMessages.collaboration as Catalog).startTestRun,
    hint: null,
    spentLine: null,
    ...overrides,
  };
}

describe('BIZ-USER-01C workflow helpers', () => {
  test('reads the workflow list and leaves out malformed entries', () => {
    const items = readCollaborationWorkflows({
      workflows: [
        {
          id: WORKFLOW_ID,
          name: 'Morning brief',
          role: 'Assistant',
          status: 'draft',
          tested: true,
          knowledgeScopeIds: ['policies', 3],
          model: { choice: 'platform', id: 'claude-haiku-5-5' },
          budgetPerRunCredits: 5,
          budgetPerDayCredits: 50,
          spentTodayCredits: 7,
          lastRunCredits: 4,
          instructions: 'never read',
        },
        { id: '', name: 'x' },
        { id: 'y' },
        'junk',
      ],
    });
    assert.deepEqual(items, [
      {
        id: WORKFLOW_ID,
        name: 'Morning brief',
        role: 'Assistant',
        status: 'draft',
        tested: true,
        knowledgeScopeIds: ['policies'],
        model: { choice: 'platform', id: 'claude-haiku-5-5' },
        budgetPerRunCredits: 5,
        budgetPerDayCredits: 50,
        spentTodayCredits: 7,
        lastRunCredits: 4,
      },
    ]);
    assert.deepEqual(readCollaborationWorkflows(null), []);
    assert.equal(readCollaborationWorkflows({ workflows: [{ id: 'a', name: 'b', status: 'on' }] })[0]?.status, 'disabled');
  });

  test('reads the run workflow, or null for a team run', () => {
    assert.deepEqual(readRunWorkflow({ id: WORKFLOW_ID, name: 'Morning brief', testRun: true }), {
      id: WORKFLOW_ID,
      name: 'Morning brief',
      testRun: true,
    });
    assert.equal(readRunWorkflow(null), null);
    assert.equal(readRunWorkflow({ id: WORKFLOW_ID }), null);
  });

  test('builds the workflow start body with the trimmed task and nothing of the spec', () => {
    assert.deepEqual(
      collaborationWorkflowStartBody({
        sessionId: 's-1',
        task: '  Brief me  ',
        workflowId: WORKFLOW_ID,
        testRun: true,
      }),
      { sessionId: 's-1', task: 'Brief me', workflowId: WORKFLOW_ID, testRun: true },
    );
  });

  test('offers Start only when on and tested, and the test run unless off', () => {
    assert.deepEqual(collaborationWorkflowActions(item()), { canTest: true, canRun: true, hint: null });
    assert.deepEqual(collaborationWorkflowActions(item({ tested: false })), {
      canTest: true,
      canRun: false,
      hint: 'needsTest',
    });
    assert.deepEqual(collaborationWorkflowActions(item({ status: 'draft', tested: false })), {
      canTest: true,
      canRun: false,
      hint: 'needsTest',
    });
    assert.deepEqual(collaborationWorkflowActions(item({ status: 'draft', tested: true })), {
      canTest: true,
      canRun: false,
      hint: 'draft',
    });
    assert.deepEqual(collaborationWorkflowActions(item({ status: 'disabled' })), {
      canTest: false,
      canRun: false,
      hint: 'off',
    });
  });

  test('summarises role, folders, model and budget, and shows spend only with a day budget', () => {
    const catalog = enMessages.collaboration as Catalog;
    const summaryLabels = {
      folders: catalog.workflowFolders,
      modelServer: catalog.workflowModelServer,
      budgetPerRun: catalog.workflowBudgetPerRun,
      noBudget: catalog.workflowNoBudget,
    };
    assert.equal(
      collaborationWorkflowSummary(item(), summaryLabels),
      'Assistant · 2 folders · Server default model · no budget set',
    );
    assert.equal(
      collaborationWorkflowSummary(
        item({ model: { choice: 'platform', id: 'claude-haiku-5-5' }, budgetPerRunCredits: 9 }),
        summaryLabels,
      ),
      'Assistant · 2 folders · claude-haiku-5-5 · up to 9 credits a run',
    );
    assert.equal(collaborationWorkflowSpentLine(item(), catalog.workflowSpentToday), null);
    assert.equal(
      collaborationWorkflowSpentLine(
        item({ budgetPerDayCredits: 20, spentTodayCredits: 12 }),
        catalog.workflowSpentToday,
      ),
      '12 of 20 credits used today by this workflow.',
    );
  });

  test('maps the six refusal codes to translated text with their numbers in three languages', () => {
    assert.deepEqual(Object.keys(WORKFLOW_REFUSAL_MESSAGE_KEYS).sort(), [
      'WORKFLOW_BUDGET_DAY',
      'WORKFLOW_BUDGET_RUN',
      'WORKFLOW_DISABLED',
      'WORKFLOW_INVALID',
      'WORKFLOW_NOT_FOUND',
      'WORKFLOW_NOT_TESTED',
    ]);
    const day = collaborationWorkflowRefusal({ code: 'WORKFLOW_BUDGET_DAY', budget: 20, spent: 21 });
    const run = collaborationWorkflowRefusal({ code: 'WORKFLOW_BUDGET_RUN', budget: 10, lastRun: 12 });
    assert.deepEqual(day, { key: 'refusalWorkflowBudgetDay', values: { budget: '20', spent: '21' } });
    assert.deepEqual(run, { key: 'refusalWorkflowBudgetRun', values: { budget: '10', lastRun: '12' } });
    for (const [locale, catalog] of CATALOGS) {
      const dayText = fillTemplate(catalog[day!.key], day!.values);
      const runText = fillTemplate(catalog[run!.key], run!.values);
      assert.ok(dayText.includes('20') && dayText.includes('21'), locale);
      assert.ok(runText.includes('10') && runText.includes('12'), locale);
      assert.doesNotMatch(dayText + runText, /\{(budget|spent|lastRun)\}/, locale);
      for (const code of Object.keys(WORKFLOW_REFUSAL_MESSAGE_KEYS)) {
        const refusal = collaborationWorkflowRefusal({ code });
        assert.ok(refusal, code);
        assert.equal(typeof catalog[refusal.key], 'string', `${locale} ${refusal.key}`);
      }
    }
    assert.equal(collaborationWorkflowRefusal({ code: 'TESTS_NOT_PASSED' }), null);
    assert.equal(collaborationWorkflowRefusal({ message: 'x' }), null);
    assert.equal(collaborationWorkflowRefusal(null), null);
  });

  test('every new key exists in en, zh-TW and zh-CN, translated, with the same placeholders', () => {
    for (const key of NEW_KEYS) {
      const english = (enMessages.collaboration as Catalog)[key];
      assert.equal(typeof english, 'string', key);
      const placeholders = (english.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
      for (const [locale, catalog] of CATALOGS.slice(1)) {
        const value = catalog[key];
        assert.equal(typeof value, 'string', `${locale} ${key}`);
        assert.notEqual(value, english, `${locale} ${key}`);
        assert.match(value, /\p{Script=Han}/u, `${locale} ${key}`);
        assert.deepEqual((value.match(/\{[a-zA-Z]+\}/g) ?? []).sort(), placeholders, `${locale} ${key}`);
      }
    }
  });
});

describe('BIZ-USER-01C workflow picker view', () => {
  test('renders the loading, empty and failed states with their text, and a retry control', () => {
    const loading = render({ workflowPicker: picker('loading') });
    assert.match(loading, /data-testid="collaboration-workflow-picker"/);
    assert.match(loading, /data-testid="collaboration-workflows-loading"/);
    assert.ok(loading.includes((enMessages.collaboration as Catalog).workflowsLoading));

    const empty = render({ workflowPicker: picker('loaded') });
    assert.match(empty, /data-testid="collaboration-workflows-empty"/);
    assert.ok(empty.includes((enMessages.collaboration as Catalog).workflowsEmpty));

    const failed = render({ workflowPicker: picker('failed') });
    assert.match(failed, /data-testid="collaboration-workflows-failed"/);
    assert.match(failed, /data-testid="collaboration-workflows-retry"/);
    assert.ok(failed.includes((enMessages.collaboration as Catalog).workflowsRetry));
  });

  test('renders each workflow with its status and tested label, and no picker without workflows', () => {
    const markup = render({
      workflowPicker: picker('loaded', [
        { id: WORKFLOW_ID, name: 'Morning brief', statusLabel: 'On', testedLabel: 'Tested', selected: false },
      ]),
    });
    assert.match(markup, new RegExp(`data-testid="collaboration-workflow-option-${WORKFLOW_ID}"`));
    assert.ok(markup.includes('Morning brief'));
    assert.ok(markup.includes('On · Tested'));
    assert.doesNotMatch(render({}), /collaboration-workflow-picker/);
  });

  test('a selected workflow unselects the team choice', () => {
    const markup = render({
      workflowPicker: picker('loaded', [
        { id: WORKFLOW_ID, name: 'Morning brief', statusLabel: 'On', testedLabel: 'Tested', selected: true },
      ]),
      workflowStart: startView({}),
    });
    assert.match(markup, /data-testid="collaboration-team-option-coding" class="[^"]*border-gray-200 bg-white/);
    assert.match(
      markup,
      new RegExp(`data-testid="collaboration-workflow-option-${WORKFLOW_ID}" class="[^"]*border-brand bg-indigo-50`),
    );
  });

  test('shows Start for a tested workflow that is on, with the test run as the second button', () => {
    const markup = render({ workflowStart: startView({ canRun: true, canTest: true }) });
    assert.match(markup, /data-testid="collaboration-start"/);
    assert.match(markup, /type="submit" data-testid="collaboration-start"/);
    assert.match(markup, /type="button" data-testid="collaboration-start-test"/);
    assert.ok(markup.includes((enMessages.collaboration as Catalog).startTestRun));
  });

  test('hides Start until tested and makes the test run the submit button, with the hint', () => {
    const hint = (enMessages.collaboration as Catalog).workflowNeedsTest;
    const markup = render({ workflowStart: startView({ canRun: false, hint }) });
    assert.doesNotMatch(markup, /data-testid="collaboration-start"/);
    assert.match(markup, /type="submit" data-testid="collaboration-start-test"/);
    assert.match(markup, /data-testid="collaboration-workflow-hint"/);
    assert.ok(markup.includes(hint));
  });

  test('shows neither button for a workflow that is off, only the hint', () => {
    const hint = (enMessages.collaboration as Catalog).workflowOffHint;
    const markup = render({ workflowStart: startView({ canRun: false, canTest: false, hint }) });
    assert.doesNotMatch(markup, /data-testid="collaboration-start"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-start-test"/);
    assert.ok(markup.includes(hint));
  });

  test('shows the spend line when given and keeps the plain Start for teams', () => {
    const markup = render({ workflowStart: startView({ spentLine: '12 of 20 credits used today by this workflow.' }) });
    assert.match(markup, /data-testid="collaboration-workflow-spent"/);
    const team = render({});
    assert.match(team, /type="submit" data-testid="collaboration-start"/);
    assert.doesNotMatch(team, /collaboration-start-test/);
  });

  test('shows the Test run badge in past runs and on the chain', () => {
    const markup = render({
      runs: [
        {
          id: 'run-1',
          statusLabel: 'Done',
          when: 'today',
          selected: false,
          teamLabel: 'Morning brief',
          testRunLabel: 'Test run',
        },
        { id: 'run-2', statusLabel: 'Done', when: 'today', selected: false, teamLabel: 'Coding' },
      ],
      runTeam: { label: 'Morning brief', roles: [], badge: 'Test run' },
    });
    assert.match(markup, /data-testid="collaboration-run-test-badge-run-1"/);
    assert.doesNotMatch(markup, /collaboration-run-test-badge-run-2/);
    assert.match(markup, /data-testid="collaboration-run-test-badge"/);
    assert.ok(markup.includes('Morning brief'));
  });
});

// A small DOM, enough for createRoot and act (same approach as lib/collaboration.test.ts).
function createDomNode(tag = 'div') {
  const node: Record<string, unknown> = {
    nodeType: 1,
    nodeName: tag.toUpperCase(),
    tagName: tag.toUpperCase(),
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    style: {},
    attributes: {},
    childNodes: [],
    parentNode: null,
    ownerDocument: null,
    textContent: '',
    setAttribute(this: Record<string, unknown>, key: string, value: string) {
      (this.attributes as Record<string, string>)[key] = value;
    },
    removeAttribute(this: Record<string, unknown>, key: string) {
      delete (this.attributes as Record<string, string>)[key];
    },
    appendChild(this: Record<string, unknown>, child: Record<string, unknown>) {
      (this.childNodes as unknown[]).push(child);
      child.parentNode = this;
      return child;
    },
    removeChild(this: Record<string, unknown>, child: Record<string, unknown>) {
      this.childNodes = (this.childNodes as unknown[]).filter((entry) => entry !== child);
      return child;
    },
    insertBefore(this: Record<string, unknown>, child: Record<string, unknown>) {
      return (this.appendChild as (next: Record<string, unknown>) => unknown)(child);
    },
    addEventListener() {},
    removeEventListener() {},
  };
  return node;
}

function installDom() {
  const doc: Record<string, unknown> = {
    nodeType: 9,
    visibilityState: 'visible',
    cookie: '',
    createElement(tag: string) {
      const node = createDomNode(tag);
      node.ownerDocument = doc;
      return node;
    },
    createElementNS(_ns: string, tag: string) {
      const node = createDomNode(tag);
      node.ownerDocument = doc;
      return node;
    },
    createTextNode(text: string) {
      return { nodeType: 3, nodeName: '#text', textContent: text, parentNode: null, ownerDocument: doc };
    },
    createComment(text: string) {
      return { nodeType: 8, nodeName: '#comment', textContent: text, ownerDocument: doc };
    },
    addEventListener() {},
    removeEventListener() {},
  };
  const body = createDomNode('body');
  body.ownerDocument = doc;
  doc.body = body;
  doc.documentElement = createDomNode('html');
  doc.head = createDomNode('head');
  doc.activeElement = body;
  doc.defaultView = globalThis;
  const g = globalThis as Record<string, unknown>;
  g.document = doc;
  g.HTMLIFrameElement = function HTMLIFrameElement() {};
  g.HTMLElement = function HTMLElement() {};
  g.Element = function Element() {};
  g.Node = function Node() {};
  g.IS_REACT_ACT_ENVIRONMENT = true;
  g.addEventListener = () => {};
  g.removeEventListener = () => {};
  g.dispatchEvent = () => true;
  g.window = globalThis;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: new Headers(),
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('TEAM-NO-SESSION-01 Team page without a session', () => {
  const items = [
    { id: 'w1', name: 'Morning brief', statusLabel: 'On', testedLabel: 'Tested', selected: true },
  ];

  test('lists the workflows with its loading, empty and failed states, and no form', () => {
    const loaded = render({ sessionReady: false, workflowPicker: picker('loaded', items) });
    assert.match(loaded, /data-testid="collaboration-workflow-picker"/);
    assert.match(loaded, /data-testid="collaboration-workflow-option-w1"/);
    assert.doesNotMatch(loaded, /data-testid="collaboration-task"/);
    assert.doesNotMatch(loaded, /data-testid="collaboration-team-picker"/);
    assert.match(render({ sessionReady: false, workflowPicker: picker('loading') }), /collaboration-workflows-loading/);
    assert.match(render({ sessionReady: false, workflowPicker: picker('loaded') }), /collaboration-workflows-empty/);
    const failed = render({ sessionReady: false, workflowPicker: picker('failed') });
    assert.match(failed, /collaboration-workflows-failed/);
    assert.match(failed, /collaboration-workflows-retry/);
  });

  test('Start and Start test run are visible but disabled, with the translated hint', () => {
    const markup = render({ sessionReady: false, workflowPicker: picker('loaded', items) });
    assert.match(markup, /<button[^>]*data-testid="collaboration-start"[^>]*disabled=""/);
    assert.match(markup, /<button[^>]*data-testid="collaboration-start-test"[^>]*disabled=""/);
    assert.ok(markup.includes(labels.start));
    assert.ok(markup.includes(labels.startTestRun));
    assert.match(markup, /data-testid="collaboration-missing-session"/);
    assert.ok(markup.includes(labels.missingSession));
    for (const [locale, catalog] of CATALOGS) {
      assert.ok(catalog.missingSession.length > 0, locale);
    }
    for (const [locale, catalog] of CATALOGS.slice(1)) {
      assert.notEqual(catalog.missingSession, (enMessages.collaboration as Catalog).missingSession, locale);
      assert.match(catalog.missingSession, /\p{Script=Han}/u, locale);
    }
  });

  test('with a session the form is shown and there is no missing-session hint', () => {
    const markup = render({ sessionReady: true, workflowPicker: picker('loaded', items) });
    assert.match(markup, /data-testid="collaboration-task"/);
    assert.doesNotMatch(markup, /collaboration-missing-session/);
    assert.doesNotMatch(markup, /data-testid="collaboration-no-session"/);
  });

  test('the page loads the workflow list whether or not there is a session', () => {
    const source = readFileSync(join(process.cwd(), 'components', 'collaboration', 'collaboration-page.tsx'), 'utf8');
    assert.match(source, /useCollaborationWorkflowList\(true\)/);
    assert.doesNotMatch(source, /useCollaborationWorkflowList\(sessionId/);
  });
});

describe('TEAM-PRESELECT-01 preselectWorkflowId and the query', () => {
  test('returns the id only when the list has that workflow', () => {
    const items = [item(), item({ id: 'other' })];
    assert.equal(preselectWorkflowId(items, WORKFLOW_ID), WORKFLOW_ID);
    assert.equal(preselectWorkflowId(items, 'nope'), null);
    assert.equal(preselectWorkflowId(items, ''), null);
    assert.equal(preselectWorkflowId([], WORKFLOW_ID), null);
  });

  test('the page client reads workflowId from the query next to sessionId and projectId', () => {
    const source = readFileSync(join(process.cwd(), 'components', 'collaboration', 'collaboration-page.tsx'), 'utf8');
    assert.match(source, /searchParams\.get\('workflowId'\)/);
    assert.match(source, /queryWorkflowId,\n  \}\);/);
  });
});

describe('BIZ-USER-01C Team page with workflows', () => {
  let createRoot: (typeof import('react-dom/client'))['createRoot'];
  let originalDocument: Document | undefined;
  let originalFetch: typeof fetch;
  let root: Root | null = null;
  let latest: ReturnType<typeof useCollaborationScreen> | null = null;
  let posts: unknown[] = [];
  let onPost: (body: unknown) => Response = () => jsonResponse(500, {});
  let detailBody: unknown = null;

  const workflows: CollaborationWorkflowList = {
    state: 'loaded',
    items: [
      item(),
      item({ id: 'f0f0f0f0-0000-4000-8000-000000000002', name: 'Draft brief', status: 'draft', tested: false }),
      item({ id: 'f0f0f0f0-0000-4000-8000-000000000003', name: 'Old brief', status: 'disabled' }),
    ],
    onRetry: () => {},
    onStale: () => {},
  };

  let probeWorkflows: CollaborationWorkflowList = workflows;
  let probeWorkflowId = '';
  let probeSessionId = 'session-1';

  function Probe(props: { catalog: Catalog }) {
    latest = useCollaborationScreen({
      t: (key: string) => props.catalog[key] ?? key,
      locale: 'en',
      sessionId: probeSessionId,
      queryProjectId: '',
      workflows: probeWorkflows,
      queryWorkflowId: probeWorkflowId,
    });
    return createElement('div');
  }

  async function renderProbe(catalog: Catalog = enMessages.collaboration as Catalog) {
    await act(async () => {
      root!.render(createElement(Probe, { catalog }));
    });
  }

  async function flush() {
    await act(async () => {
      for (let step = 0; step < 30; step += 1) {
        await Promise.resolve();
      }
    });
  }

  before(async () => {
    originalDocument = globalThis.document;
    installDom();
    ({ createRoot } = await import('react-dom/client'));
  });

  after(() => {
    if (originalDocument === undefined) {
      delete (globalThis as { document?: Document }).document;
    } else {
      globalThis.document = originalDocument;
    }
  });

  beforeEach(() => {
    posts = [];
    detailBody = null;
    latest = null;
    probeWorkflows = workflows;
    probeWorkflowId = '';
    probeSessionId = 'session-1';
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'POST' && url === '/api/collaboration/runs') {
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        posts.push(body);
        return onPost(body);
      }
      if (url.startsWith('/api/collaboration/runs?')) {
        return jsonResponse(200, { runs: [] });
      }
      if (url === '/api/collaboration/runs/run-1' && detailBody) {
        return jsonResponse(200, detailBody);
      }
      return jsonResponse(404, { message: 'missing' });
    }) as typeof fetch;
    const container = (globalThis.document as { createElement: (tag: string) => unknown }).createElement('div');
    root = createRoot(container as unknown as Element);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root!.unmount();
      });
      root = null;
    }
    globalThis.fetch = originalFetch;
  });

  test('TEAM-PRESELECT-01: a matching workflowId is preselected once the list has loaded', async () => {
    probeWorkflowId = WORKFLOW_ID;
    await renderProbe();
    assert.equal(latest?.workflowPicker?.items.find((entry) => entry.id === WORKFLOW_ID)?.selected, true);
    assert.deepEqual(latest?.team.map((member) => member.name), ['Morning brief']);
    assert.equal(latest?.workflowStart?.canRun, true);
    // picking a team afterwards still clears it, and a refresh does not bring it back
    await act(async () => {
      latest!.onTeamChange('chief-of-staff');
    });
    probeWorkflows = { ...workflows, items: [...workflows.items] };
    await renderProbe();
    assert.equal(latest?.workflowPicker?.items.some((entry) => entry.selected), false);
  });

  test('TEAM-NO-SESSION-01: without a session the workflowId is still preselected and sessionReady is false', async () => {
    probeSessionId = '';
    probeWorkflowId = WORKFLOW_ID;
    await renderProbe();
    assert.equal(latest?.sessionReady, false);
    assert.equal(latest?.workflowPicker?.items.find((entry) => entry.id === WORKFLOW_ID)?.selected, true);
    assert.equal(latest?.workflowStart?.canRun, true);
  });

  test('TEAM-PRESELECT-01: waits for the list, then preselects', async () => {
    probeWorkflowId = WORKFLOW_ID;
    probeWorkflows = { ...workflows, state: 'loading', items: [] };
    await renderProbe();
    assert.equal(latest?.workflowStart ?? null, null);
    probeWorkflows = workflows;
    await renderProbe();
    assert.equal(latest?.workflowPicker?.items.find((entry) => entry.id === WORKFLOW_ID)?.selected, true);
  });

  test('TEAM-PRESELECT-01: an unknown workflowId, a failed list or no parameter preselects nothing and shows no error', async () => {
    probeWorkflowId = 'not-a-workflow';
    await renderProbe();
    assert.equal(latest?.workflowPicker?.items.some((entry) => entry.selected), false);
    assert.equal(latest?.workflowStart ?? null, null);
    assert.equal(latest?.notice ?? null, null);

    probeWorkflowId = WORKFLOW_ID;
    probeWorkflows = { ...workflows, state: 'failed', items: [] };
    await renderProbe();
    assert.equal(latest?.workflowStart ?? null, null);
    assert.equal(latest?.notice ?? null, null);

    probeWorkflowId = '';
    probeWorkflows = workflows;
    await renderProbe();
    assert.equal(latest?.workflowPicker?.items.some((entry) => entry.selected), false);
  });

  test('picking a workflow clears the team and picking a team clears the workflow', async () => {
    await renderProbe();
    assert.equal(latest?.workflowPicker?.items.some((entry) => entry.selected), false);
    assert.equal(latest?.workflowStart ?? null, null);

    await act(async () => {
      latest!.workflowPicker!.onSelect(WORKFLOW_ID);
    });
    assert.equal(latest?.workflowPicker?.items.find((entry) => entry.id === WORKFLOW_ID)?.selected, true);
    assert.deepEqual(latest?.team.map((member) => member.name), ['Morning brief']);
    assert.equal(latest?.accessNote, (enMessages.collaboration as Catalog).fileAccessReadOnly);
    assert.deepEqual(latest?.taskPresets, []);
    assert.equal(latest?.workflowStart?.canRun, true);

    await act(async () => {
      latest!.onTeamChange('chief-of-staff');
    });
    assert.equal(latest?.workflowPicker?.items.some((entry) => entry.selected), false);
    assert.equal(latest?.workflowStart ?? null, null);
    assert.equal(latest?.selectedTeam, 'chief-of-staff');
  });

  test('sends the workflow body for a test run and a normal run, and the team body otherwise', async () => {
    onPost = () =>
      jsonResponse(201, {
        collaborationRunId: 'run-1',
        projectId: '',
        status: 'active',
        referralId: 'ref-1',
        handoffStatus: 'pending_approval',
        source: 'user',
        target: WORKFLOW_ID,
        conversationId: 'c-1',
        conversationCreated: false,
      });
    await renderProbe();
    await act(async () => {
      latest!.workflowPicker!.onSelect(WORKFLOW_ID);
      latest!.onTaskChange('  Brief me  ');
    });
    await act(async () => {
      latest!.onStartTest();
    });
    await flush();
    await act(async () => {
      latest!.onTaskChange('Brief me again');
    });
    await act(async () => {
      latest!.onStart();
    });
    await flush();
    await act(async () => {
      latest!.onTeamChange('coding');
      latest!.onTaskChange('Fix it');
    });
    await act(async () => {
      latest!.onStart();
    });
    await flush();
    assert.deepEqual(posts, [
      { sessionId: 'session-1', task: 'Brief me', workflowId: WORKFLOW_ID, testRun: true },
      { sessionId: 'session-1', task: 'Brief me again', workflowId: WORKFLOW_ID, testRun: false },
      { sessionId: 'session-1', task: 'Fix it', team: 'coding' },
    ]);
  });

  test('a draft offers the test run only and an off workflow offers neither', async () => {
    await renderProbe();
    await act(async () => {
      latest!.workflowPicker!.onSelect('f0f0f0f0-0000-4000-8000-000000000002');
    });
    assert.deepEqual(
      { canTest: latest?.workflowStart?.canTest, canRun: latest?.workflowStart?.canRun },
      { canTest: true, canRun: false },
    );
    assert.equal(latest?.workflowStart?.hint, (enMessages.collaboration as Catalog).workflowNeedsTest);
    await act(async () => {
      latest!.workflowPicker!.onSelect('f0f0f0f0-0000-4000-8000-000000000003');
    });
    assert.deepEqual(
      { canTest: latest?.workflowStart?.canTest, canRun: latest?.workflowStart?.canRun },
      { canTest: false, canRun: false },
    );
    assert.equal(latest?.workflowStart?.hint, (enMessages.collaboration as Catalog).workflowOffHint);
  });

  for (const [locale, catalog] of CATALOGS) {
    test(`shows a workflow refusal with its numbers (${locale})`, async () => {
      onPost = () =>
        jsonResponse(429, {
          statusCode: 429,
          code: 'WORKFLOW_BUDGET_DAY',
          message: "This workflow's budget for today is used up",
          budget: 20,
          spent: 21,
        });
      await renderProbe(catalog);
      await act(async () => {
        latest!.workflowPicker!.onSelect(WORKFLOW_ID);
        latest!.onTaskChange('Brief me');
      });
      await act(async () => {
        latest!.onStart();
      });
      await flush();
      assert.equal(latest?.notice, fillTemplate(catalog.refusalWorkflowBudgetDay, { budget: '20', spent: '21' }));
      assert.notEqual(latest?.notice, catalog.refusalRate);
    });
  }

  test('a refusal without a workflow code still maps by status', async () => {
    onPost = () => jsonResponse(503, { message: 'off' });
    await renderProbe();
    await act(async () => {
      latest!.onTaskChange('Fix it');
    });
    await act(async () => {
      latest!.onStart();
    });
    await flush();
    assert.equal(latest?.notice, (enMessages.collaboration as Catalog).refusalOff);
  });

  test("shows the workflow's name and the Test run badge on the opened run's chain", async () => {
    detailBody = {
      run: {
        collaborationRunId: 'run-1',
        projectId: 'p-1',
        status: 'completed',
        createdAt: '2026-11-10T00:00:00.000Z',
        updatedAt: '2026-11-10T00:00:00.000Z',
        completedAt: null,
        failedAt: null,
      },
      teamId: 'workflow',
      team: [WORKFLOW_ID],
      workflow: { id: WORKFLOW_ID, name: 'Renamed brief', testRun: true },
      handoffs: [
        {
          referralId: 'ref-1',
          status: 'completed',
          source: 'user',
          target: WORKFLOW_ID,
          prompt: 'Brief me',
          answer: 'Quiet day.',
          handoffNote: null,
          failureReason: null,
          decidedBy: null,
          rejectReason: null,
        },
      ],
    };
    await renderProbe();
    await act(async () => {
      latest!.onOpenRun('run-1');
    });
    await flush();
    assert.deepEqual(latest?.runTeam, {
      label: 'Renamed brief',
      roles: [],
      badge: (enMessages.collaboration as Catalog).testRunBadge,
    });
    assert.equal(
      latest?.handoffs[0]?.asked,
      fillTemplate((enMessages.collaboration as Catalog).asked, {
        source: (enMessages.collaboration as Catalog).you,
        target: 'Renamed brief',
      }),
    );
    assert.ok(!String(latest?.handoffs[0]?.asked).includes(WORKFLOW_ID));
  });
});
