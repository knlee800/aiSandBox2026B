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
import {
  collaborationAutoApprovalWaitingText,
  collaborationAutoApprovedText,
  AUTO_APPROVAL_WAIT_REASONS,
  DRAFT_INVALID_REASONS,
  DRAFT_PARTS,
  DRAFT_PROBLEM_REASONS,
} from '../../lib/collaboration/api';
import { useCollaborationScreen } from './collaboration-page';
import {
  buildDraftCard,
  draftFieldKey,
  draftInvalidKey,
  draftProblemKey,
  draftReviewHref,
  readHandoffDraft,
} from './collaboration-draft';
import CollaborationView, {
  type CollaborationRosterRowView,
  type CollaborationRosterView,
  type CollaborationViewLabels,
  type CollaborationWorkflowPickerView,
  type CollaborationWorkflowStartView,
} from './collaboration-view';
import {
  ROSTER_MAX_MEMBERS,
  ROSTER_REASON_KEYS,
  collaborationChiefStartBody,
  isReportBackHandoff,
  readRoster,
  readRunAgents,
  readStartSkipped,
  reportBackStepKey,
  rosterPickerRows,
  rosterSaveBody,
  rosterSaveErrorKey,
  toggleRosterMember,
} from './collaboration-roster';
import {
  WORKFLOW_REFUSAL_MESSAGE_KEYS,
  collaborationWorkflowActions,
  collaborationWorkflowRefusal,
  collaborationWorkflowSpentLine,
  collaborationWorkflowStartBody,
  collaborationWorkflowSummary,
  preselectWorkflowId,
  readCollaborationBusiness,
  readCollaborationWorkflows,
  readRunWorkflow,
  useCollaborationWorkflowList,
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

  test('TEAM-NO-SESSION-02: leaves sessionId out of the workflow body when there is none', () => {
    for (const sessionId of [undefined, '', '   ']) {
      const body = collaborationWorkflowStartBody({
        sessionId,
        task: ' Brief me ',
        workflowId: WORKFLOW_ID,
        testRun: false,
      });
      assert.deepEqual(body, { task: 'Brief me', workflowId: WORKFLOW_ID, testRun: false });
      assert.equal(Object.prototype.hasOwnProperty.call(body, 'sessionId'), false);
    }
  });

  test('TEAM-NO-SESSION-02: reads the business project from the workflow list, or null', () => {
    assert.deepEqual(readCollaborationBusiness({ workflows: [], business: { projectId: 'p-9' } }), {
      projectId: 'p-9',
    });
    assert.equal(readCollaborationBusiness({ workflows: [], business: null }), null);
    assert.equal(readCollaborationBusiness({ workflows: [] }), null);
    assert.equal(readCollaborationBusiness({ business: { projectId: '' } }), null);
    assert.equal(readCollaborationBusiness({ business: { projectId: 7 } }), null);
    assert.equal(readCollaborationBusiness('junk'), null);
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

describe('TEAM-NO-SESSION-02 Team page view without a session', () => {
  const selected = [
    { id: 'w1', name: 'Morning brief', statusLabel: 'On', testedLabel: 'Tested', selected: true },
  ];
  const notSelected = [{ ...selected[0], selected: false }];

  function noSession(overrides: Record<string, unknown>): string {
    return render({ sessionReady: false, workflowPicker: picker('loaded', selected), ...overrides });
  }

  test('a selected workflow shows the task box, Start and Start test run, and no team picker', () => {
    const markup = noSession({ workflowStart: startView({ canTest: true, canRun: true }) });
    assert.match(markup, /data-testid="collaboration-no-session"/);
    assert.match(markup, /data-testid="collaboration-task"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-team-picker"/);
    assert.match(markup, /data-testid="collaboration-workflow-picker"/);
    assert.match(markup, /<button[^>]*type="submit"[^>]*data-testid="collaboration-start"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-start"[^>]*disabled=""/);
    assert.match(markup, /data-testid="collaboration-start-test"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-start-test"[^>]*disabled=""/);
    assert.doesNotMatch(markup, /collaboration-missing-session/);
  });

  test('follows workflowStart: test only with its hint, neither when off, and the spend line', () => {
    const testOnly = noSession({
      workflowStart: startView({ canTest: true, canRun: false, hint: EN.workflowNeedsTest }),
    });
    assert.doesNotMatch(testOnly, /data-testid="collaboration-start"/);
    assert.match(testOnly, /<button[^>]*type="submit"[^>]*data-testid="collaboration-start-test"/);
    assert.match(testOnly, /data-testid="collaboration-workflow-hint"/);
    assert.ok(testOnly.includes(EN.workflowNeedsTest));

    const off = noSession({
      workflowStart: startView({ canTest: false, canRun: false, hint: EN.workflowOffHint }),
    });
    assert.doesNotMatch(off, /data-testid="collaboration-start"/);
    assert.doesNotMatch(off, /data-testid="collaboration-start-test"/);
    assert.ok(off.includes(EN.workflowOffHint));

    const spent = fillTemplate(EN.workflowSpentToday, { spent: '3', budget: '10' });
    const withSpend = noSession({ workflowStart: startView({ spentLine: spent }) });
    assert.match(withSpend, /data-testid="collaboration-workflow-spent"/);
    assert.ok(withSpend.includes(spent));
  });

  test('a start with an empty task box stays disabled, and deciding shows Starting', () => {
    const empty = noSession({ task: '   ', workflowStart: startView({}) });
    assert.match(empty, /data-testid="collaboration-start"[^>]*disabled=""/);
    const deciding = noSession({ deciding: true, workflowStart: startView({}) });
    assert.ok(deciding.includes(EN.starting));
  });

  for (const [locale, catalog] of CATALOGS) {
    test(`no workflow selected: no task box, no team picker, disabled buttons and the reworded hint (${locale})`, () => {
      const markup = render({
        labels: catalog as unknown as CollaborationViewLabels,
        sessionReady: false,
        workflowPicker: picker('loaded', notSelected),
        workflowStart: null,
      });
      assert.match(markup, /data-testid="collaboration-no-session"/);
      assert.doesNotMatch(markup, /data-testid="collaboration-task"/);
      assert.doesNotMatch(markup, /data-testid="collaboration-team-picker"/);
      assert.match(markup, /<button[^>]*data-testid="collaboration-start"[^>]*disabled=""/);
      assert.match(markup, /<button[^>]*data-testid="collaboration-start-test"[^>]*disabled=""/);
      assert.match(markup, /data-testid="collaboration-missing-session"/);
      assert.ok(markup.includes(catalog.missingSession), locale);
    });
  }

  test('the reworded hint says workflows run without a workspace and teams need one', () => {
    assert.equal(
      EN.missingSession,
      'Your workflows and the Chief of Staff run here without a workspace. The coding team and the advisors start from a workspace session: open Team from a workspace for those.',
    );
    for (const [locale, catalog] of CATALOGS) {
      assert.doesNotMatch(catalog.missingSession, /\u2014/, locale);
      assert.ok(catalog.pastRunsBusiness.length > 0, locale);
    }
    for (const [locale, catalog] of CATALOGS.slice(1)) {
      for (const key of ['missingSession', 'pastRunsBusiness']) {
        assert.notEqual(catalog[key], EN[key], `${locale} ${key}`);
        assert.match(catalog[key], /\p{Script=Han}/u, `${locale} ${key}`);
      }
    }
  });

  test('with a session the team picker shows next to the workflows, as before', () => {
    const markup = render({
      sessionReady: true,
      workflowPicker: picker('loaded', selected),
      workflowStart: startView({}),
    });
    assert.match(markup, /data-testid="collaboration-team-picker"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-no-session"/);
  });

  test('past runs: the business note shows, and an empty list says so instead of needing a project', () => {
    const markup = render({
      sessionReady: false,
      projectReady: true,
      pastRunsNote: EN.pastRunsBusiness,
      workflowPicker: picker('loaded', notSelected),
    });
    assert.match(markup, /data-testid="collaboration-past-runs-note"/);
    assert.ok(markup.includes(EN.pastRunsBusiness));
    assert.ok(markup.includes(EN.pastRunsEmpty));
    assert.doesNotMatch(markup, /collaboration-missing-project/);
    assert.doesNotMatch(render({}), /collaboration-past-runs-note/);
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
    assert.match(source, /queryWorkflowId,\n(?: {4}rosterEnabled: true,\n)?  \}\);/);
    // COS-FRONTDOOR-01C: the page client turns the roster picker on.
    assert.match(source, /rosterEnabled: true,/);
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
  let probeProjectId = '';
  let gets: string[] = [];
  let workflowsBody: unknown = null;

  function Probe(props: { catalog: Catalog }) {
    latest = useCollaborationScreen({
      t: (key: string) => props.catalog[key] ?? key,
      locale: 'en',
      sessionId: probeSessionId,
      queryProjectId: probeProjectId,
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
    probeProjectId = '';
    gets = [];
    workflowsBody = null;
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'POST' && url === '/api/collaboration/runs') {
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        posts.push(body);
        return onPost(body);
      }
      if (method === 'GET') {
        gets.push(url);
      }
      if (url === '/api/collaboration/workflows' && workflowsBody) {
        return jsonResponse(200, workflowsBody);
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

  function startedBody(overrides: Record<string, unknown> = {}) {
    return jsonResponse(201, {
      collaborationRunId: 'run-1',
      projectId: 'biz-project',
      status: 'active',
      referralId: 'ref-1',
      handoffStatus: 'pending_approval',
      source: 'user',
      target: WORKFLOW_ID,
      conversationId: 'c-1',
      conversationCreated: true,
      ...overrides,
    });
  }

  test('TEAM-NO-SESSION-02: without a session a workflow starts with no sessionId, the Chief of Staff starts and coding does not', async () => {
    probeSessionId = '';
    onPost = () => startedBody();
    await renderProbe();
    assert.equal(latest?.sessionReady, false);
    // COS-FRONTDOOR-01C: no workflow selected means the Chief of Staff (the only team without a
    // session); its body has no sessionId. The coding team is not offered and never posts.
    assert.equal(latest?.selectedTeam, 'chief-of-staff');
    await act(async () => {
      latest!.onTaskChange('Fix it');
    });
    await act(async () => {
      latest!.onStart();
    });
    await flush();
    assert.deepEqual(posts, [{ task: 'Fix it', team: 'chief-of-staff' }]);
    posts = [];
    await act(async () => {
      latest!.onTeamChange('coding');
    });
    assert.equal(latest?.selectedTeam, 'chief-of-staff');

    await act(async () => {
      latest!.workflowPicker!.onSelect(WORKFLOW_ID);
      latest!.onTaskChange('  Brief me  ');
    });
    assert.equal(latest?.workflowStart?.canRun, true);
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
    assert.deepEqual(posts, [
      { task: 'Brief me', workflowId: WORKFLOW_ID, testRun: true },
      { task: 'Brief me again', workflowId: WORKFLOW_ID, testRun: false },
    ]);
    // The run's project becomes the past-runs list; the conversation notice is for sessions only.
    assert.ok(gets.includes('/api/collaboration/runs?projectId=biz-project'));
    assert.equal(latest?.projectReady, true);
    assert.equal(latest?.conversationCreated, false);
    assert.equal(latest?.pastRunsNote, (enMessages.collaboration as Catalog).pastRunsBusiness);
    assert.equal(latest?.task, '');
  });

  test('TEAM-NO-SESSION-02: the start hint and spend line show without a session', async () => {
    probeSessionId = '';
    probeWorkflows = {
      ...workflows,
      items: [
        item({ budgetPerDayCredits: 10, spentTodayCredits: 4 }),
        ...workflows.items.slice(1),
      ],
    };
    await renderProbe();
    await act(async () => {
      latest!.workflowPicker!.onSelect(WORKFLOW_ID);
    });
    assert.equal(
      latest?.workflowStart?.spentLine,
      fillTemplate((enMessages.collaboration as Catalog).workflowSpentToday, { spent: '4', budget: '10' }),
    );
    await act(async () => {
      latest!.workflowPicker!.onSelect('f0f0f0f0-0000-4000-8000-000000000002');
    });
    assert.deepEqual(
      { canTest: latest?.workflowStart?.canTest, canRun: latest?.workflowStart?.canRun },
      { canTest: true, canRun: false },
    );
    assert.equal(latest?.workflowStart?.hint, (enMessages.collaboration as Catalog).workflowNeedsTest);
  });

  test('TEAM-NO-SESSION-02: the business project is the past-runs list without a session and ignored with one', async () => {
    probeSessionId = '';
    probeWorkflows = { ...workflows, business: { projectId: 'biz-project' } };
    await renderProbe();
    await flush();
    assert.deepEqual(gets, ['/api/collaboration/runs?projectId=biz-project']);
    assert.equal(latest?.projectReady, true);

    // The URL's project wins over the business project.
    gets = [];
    probeProjectId = 'url-project';
    await renderProbe();
    await flush();
    assert.deepEqual(gets, ['/api/collaboration/runs?projectId=url-project']);
  });

  test('TEAM-NO-SESSION-02: with a session the business project is ignored and the bodies keep sessionId', async () => {
    probeWorkflows = { ...workflows, business: { projectId: 'biz-project' } };
    onPost = () => startedBody({ projectId: 'p-1', conversationCreated: true });
    await renderProbe();
    await flush();
    assert.equal(gets.length, 0);
    assert.equal(latest?.pastRunsNote, undefined);
    await act(async () => {
      latest!.workflowPicker!.onSelect(WORKFLOW_ID);
      latest!.onTaskChange('Brief me');
    });
    await act(async () => {
      latest!.onStartTest();
    });
    await flush();
    assert.deepEqual(posts, [
      { sessionId: 'session-1', task: 'Brief me', workflowId: WORKFLOW_ID, testRun: true },
    ]);
    assert.equal(latest?.conversationCreated, true);
    assert.ok(gets.includes('/api/collaboration/runs?projectId=p-1'));
    assert.ok(!gets.some((url) => url.includes('biz-project')));
  });

  test('TEAM-NO-SESSION-02: the workflow list hook reads the business project', async () => {
    let listed: CollaborationWorkflowList | null = null;
    function ListProbe() {
      listed = useCollaborationWorkflowList(true);
      return createElement('div');
    }
    workflowsBody = { workflows: [], business: { projectId: 'biz-project' } };
    await act(async () => {
      root!.render(createElement(ListProbe));
    });
    await flush();
    assert.equal(listed!.state, 'loaded');
    assert.deepEqual(listed!.business, { projectId: 'biz-project' });

    workflowsBody = { workflows: [], business: null };
    await act(async () => {
      listed!.onRetry();
    });
    await flush();
    assert.equal(listed!.business, null);
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

// ---------------------------------------------------------------------------
// COS-FRONTDOOR-01C: the Chief of Staff roster picker, the session-less start, the
// skipped hint, member labels and the report-back step.
// ---------------------------------------------------------------------------

const ROSTER_KEYS = [
  'rosterHeading',
  'rosterIntro',
  'rosterLoading',
  'rosterEmpty',
  'rosterFailed',
  'rosterRetry',
  'rosterSave',
  'rosterSaving',
  'rosterSaved',
  'rosterCount',
  'rosterLimit',
  'rosterSaveFailed',
  'rosterSaveMemberRefused',
  'rosterKindSystem',
  'rosterKindWorkflow',
  'rosterMemberUnknown',
  'rosterReasonDraft',
  'rosterReasonNotTested',
  'rosterReasonOff',
  'rosterReasonMissing',
  'rosterReasonComingSoon',
  'rosterReasonInvalid',
  'rosterSkippedHint',
  'rosterSkippedItem',
  'reportBackStep',
  'reportBackNoEdit',
  'teamChiefOfStaffHint',
  'chiefOfStaffSummary',
  'fileAccessReadOnly',
  'missingSession',
];

function rosterRowView(
  id: string,
  overrides: Partial<CollaborationRosterRowView> = {},
): CollaborationRosterRowView {
  return {
    id,
    name: `Name ${id}`,
    kindLabel: EN.rosterKindSystem,
    checked: false,
    canTick: true,
    reasonLabel: null,
    ...overrides,
  };
}

function rosterView(overrides: Partial<CollaborationRosterView> = {}): CollaborationRosterView {
  return {
    state: 'loaded',
    saveState: 'idle',
    labels: {
      heading: EN.rosterHeading,
      intro: fillTemplate(EN.rosterIntro, { max: '3' }),
      loading: EN.rosterLoading,
      empty: EN.rosterEmpty,
      failed: EN.rosterFailed,
      retry: EN.rosterRetry,
      save: EN.rosterSave,
      saving: EN.rosterSaving,
      saved: EN.rosterSaved,
      count: fillTemplate(EN.rosterCount, { count: '1', max: '3' }),
    },
    rows: [rosterRowView('a', { checked: true }), rosterRowView('b')],
    message: null,
    dirty: false,
    onToggle: () => {},
    onSave: () => {},
    onRetry: () => {},
    ...overrides,
  };
}

const THREE_TEAMS = [
  { id: 'coding' as const, label: 'Coding team', hint: 'coding hint' },
  { id: 'chief-of-staff' as const, label: 'Chief of Staff', hint: 'chief hint' },
  { id: 'advisors' as const, label: 'Advisors', hint: 'advisors hint' },
];

describe('COS-FRONTDOOR-01C roster helpers', () => {
  test('reads the roster body and leaves out malformed members', () => {
    const view = readRoster({
      members: [
        { id: 'product-strategy', kind: 'system', name: 'Product Strategy', usable: true, reason: null },
        { id: 'bad-kind', kind: 'robot', name: 'x', usable: true, reason: null },
        { id: '', kind: 'system', name: 'x', usable: true, reason: null },
      ],
      choices: [
        { id: 'w1', kind: 'workflow', name: 'Brief', usable: false, reason: 'draft' },
        { id: 'w2', kind: 'workflow', name: '  ', usable: false, reason: 'surprise' },
        { id: 'w1', kind: 'workflow', name: 'Duplicate', usable: true, reason: null },
        'junk',
      ],
    });
    assert.deepEqual(view?.members, [
      { id: 'product-strategy', kind: 'system', name: 'Product Strategy', usable: true, reason: null },
    ]);
    assert.deepEqual(view?.choices, [
      { id: 'w1', kind: 'workflow', name: 'Brief', usable: false, reason: 'draft' },
      // An unknown reason on an unusable member reads as invalid; a blank name reads as none.
      { id: 'w2', kind: 'workflow', name: null, usable: false, reason: 'invalid' },
    ]);
    assert.equal(readRoster(null), null);
    assert.equal(readRoster({ members: [] }), null);
  });

  test('a fourth tick is refused and an untick always works', () => {
    assert.deepEqual(toggleRosterMember([], 'a'), { selected: ['a'], limitHit: false });
    assert.deepEqual(toggleRosterMember(['a', 'b'], 'c'), { selected: ['a', 'b', 'c'], limitHit: false });
    assert.deepEqual(toggleRosterMember(['a', 'b', 'c'], 'd'), {
      selected: ['a', 'b', 'c'],
      limitHit: true,
    });
    assert.deepEqual(toggleRosterMember(['a', 'b', 'c'], 'b'), { selected: ['a', 'c'], limitHit: false });
    assert.equal(ROSTER_MAX_MEMBERS, 3);
  });

  test('the save body holds the picked ids only, and failures map to translated message keys', () => {
    assert.deepEqual(rosterSaveBody(['a', 'b']), { memberIds: ['a', 'b'] });
    assert.equal(rosterSaveErrorKey(400, { code: 'ROSTER_TOO_MANY' }), 'rosterLimit');
    for (const code of ['ROSTER_MEMBER_NOT_FOUND', 'ROSTER_MEMBER_NOT_ALLOWED', 'ROSTER_MEMBER_UNKNOWN']) {
      assert.equal(rosterSaveErrorKey(400, { code }), 'rosterSaveMemberRefused', code);
    }
    for (const body of [{ code: 'ROSTER_DUPLICATE' }, { code: 'ROSTER_INVALID_BODY' }, null, {}]) {
      assert.equal(rosterSaveErrorKey(500, body), 'rosterSaveFailed');
    }
  });

  test('picker rows are the choices, then stored members that are no longer choices', () => {
    const rows = rosterPickerRows({
      choices: [{ id: 'a', kind: 'system', name: 'A', usable: true, reason: null }],
      members: [
        { id: 'a', kind: 'system', name: 'A', usable: true, reason: null },
        { id: 'gone', kind: 'workflow', name: null, usable: false, reason: 'missing' },
      ],
    });
    assert.deepEqual(
      rows.map((row) => row.id),
      ['a', 'gone'],
    );
  });

  test('every roster reason has a translation key, including invalid', () => {
    assert.deepEqual(
      Object.keys(ROSTER_REASON_KEYS).sort(),
      ['coming_soon', 'draft', 'invalid', 'missing', 'not_tested', 'off'],
    );
    for (const [locale, catalog] of CATALOGS) {
      for (const key of Object.values(ROSTER_REASON_KEYS)) {
        assert.equal(typeof catalog[key], 'string', `${locale} ${key}`);
        assert.ok(catalog[key].length > 0, `${locale} ${key}`);
      }
    }
  });

  test('reads roster.skipped from a start response, and agents from a run detail', () => {
    assert.deepEqual(
      readStartSkipped({
        roster: {
          used: ['a'],
          skipped: [{ id: 'w1', reason: 'draft' }, { id: 'w2', reason: 'zzz' }, { reason: 'off' }],
        },
      }),
      [
        { id: 'w1', reason: 'draft' },
        { id: 'w2', reason: 'invalid' },
      ],
    );
    assert.deepEqual(readStartSkipped({ collaborationRunId: 'run-1' }), []);
    assert.deepEqual(readStartSkipped(null), []);
    assert.deepEqual(
      readRunAgents([{ name: 'w1', label: 'Tax helper' }, { name: 'w2', label: null }, { label: 'x' }]),
      [
        { name: 'w1', label: 'Tax helper' },
        { name: 'w2', label: null },
      ],
    );
    assert.deepEqual(readRunAgents(undefined), []);
  });

  test('a step from an agent back to the Chief of Staff is a report-back', () => {
    assert.equal(isReportBackHandoff('product-strategy', 'chief-of-staff'), true);
    assert.equal(isReportBackHandoff(WORKFLOW_ID, 'chief-of-staff'), true);
    assert.equal(isReportBackHandoff('user', 'chief-of-staff'), false);
    assert.equal(isReportBackHandoff('chief-of-staff', 'product-strategy'), false);
    assert.equal(isReportBackHandoff('advisors-lead', 'chief-of-staff'), false);
    assert.equal(isReportBackHandoff('lead', 'writer'), false);
  });

  test('the Chief of Staff start body has no sessionId without a session and no roster at any time', () => {
    assert.deepEqual(collaborationChiefStartBody({ sessionId: '', task: '  Brief me  ' }), {
      task: 'Brief me',
      team: 'chief-of-staff',
    });
    assert.deepEqual(collaborationChiefStartBody({ task: 'Brief me' }), {
      task: 'Brief me',
      team: 'chief-of-staff',
    });
    assert.deepEqual(collaborationChiefStartBody({ sessionId: ' s-1 ', task: 'Brief me' }), {
      sessionId: 's-1',
      task: 'Brief me',
      team: 'chief-of-staff',
    });
  });

  test('the roster copy exists in en, zh-TW and zh-CN, translated, with the same placeholders', () => {
    const SAME_IN_ALL = ['reportBackStep'];
    for (const key of ROSTER_KEYS) {
      const english = EN[key];
      assert.equal(typeof english, 'string', key);
      assert.ok(english.trim().length > 0, key);
      const placeholders = (english.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
      for (const [locale, catalog] of CATALOGS.slice(1)) {
        const value = catalog[key];
        assert.equal(typeof value, 'string', `${locale} ${key}`);
        if (!SAME_IN_ALL.includes(key)) {
          assert.notEqual(value, english, `${locale} ${key}`);
          assert.match(value, /\p{Script=Han}/u, `${locale} ${key}`);
        }
        assert.deepEqual((value.match(/\{[a-zA-Z]+\}/g) ?? []).sort(), placeholders, `${locale} ${key}`);
      }
    }
  });

  test('the three message files have the same collaboration keys', () => {
    const keys = Object.keys(EN).sort();
    assert.deepEqual(Object.keys(zhTwMessages.collaboration).sort(), keys);
    assert.deepEqual(Object.keys(zhCnMessages.collaboration).sort(), keys);
  });

  test('the Chief of Staff wording no longer says it does not hand off', () => {
    assert.doesNotMatch(EN.teamChiefOfStaffHint, /does not hand off/);
    assert.doesNotMatch(EN.chiefOfStaffSummary, /hand off\./);
    assert.doesNotMatch(EN.fileAccessReadOnly, /hand off/);
    assert.ok(EN.teamChiefOfStaffHint.includes('roster'));
  });
});

describe('COS-FRONTDOOR-01C roster picker view', () => {
  function chief(overrides: Record<string, unknown> = {}): string {
    return render({
      teamChoices: THREE_TEAMS,
      selectedTeam: 'chief-of-staff',
      roster: rosterView(),
      ...overrides,
    });
  }

  test('loaded: a checkbox per member with the saved ones ticked, Save disabled until a change', () => {
    const markup = chief();
    assert.match(markup, /data-testid="collaboration-roster"/);
    assert.ok(markup.includes(EN.rosterHeading));
    assert.ok(markup.includes(fillTemplate(EN.rosterIntro, { max: '3' })));
    assert.match(markup, /data-testid="collaboration-roster-option-a"/);
    assert.match(markup, /data-testid="collaboration-roster-option-b"/);
    assert.equal((markup.match(/<input type="checkbox"[^>]*checked=""/g) ?? []).length, 1);
    assert.match(markup, /data-testid="collaboration-roster-save"[^>]*disabled=""/);
    assert.ok(markup.includes(fillTemplate(EN.rosterCount, { count: '1', max: '3' })));
    assert.doesNotMatch(markup, /collaboration-roster-saved/);
    // The picker sits under the team options, before the workflow picker and the task box.
    assert.ok(markup.indexOf('collaboration-roster"') > markup.indexOf('collaboration-team-option-advisors'));
    assert.ok(markup.indexOf('collaboration-roster"') < markup.indexOf('data-testid="collaboration-task"'));
  });

  test('a change enables Save, and saving shows the saving text and disables it', () => {
    assert.doesNotMatch(
      chief({ roster: rosterView({ dirty: true }) }),
      /data-testid="collaboration-roster-save"[^>]*disabled=""/,
    );
    const saving = chief({ roster: rosterView({ dirty: true, saveState: 'saving' }) });
    assert.match(saving, /data-testid="collaboration-roster-save"[^>]*disabled=""/);
    assert.ok(saving.includes(EN.rosterSaving));
  });

  test('saved: shows the saved line only while the list is unchanged', () => {
    const saved = chief({ roster: rosterView({ saveState: 'saved', dirty: false }) });
    assert.match(saved, /data-testid="collaboration-roster-saved"/);
    assert.ok(saved.includes(EN.rosterSaved));
    assert.doesNotMatch(
      chief({ roster: rosterView({ saveState: 'saved', dirty: true }) }),
      /collaboration-roster-saved/,
    );
  });

  test('a message under Save shows the fourth-tick hint or a save failure', () => {
    const limit = fillTemplate(EN.rosterLimit, { max: '3' });
    const markup = chief({ roster: rosterView({ message: limit }) });
    assert.match(markup, /data-testid="collaboration-roster-message"/);
    assert.ok(markup.includes(limit));
    assert.doesNotMatch(
      chief({ roster: rosterView({ message: limit, saveState: 'saved' }) }),
      /collaboration-roster-saved/,
    );
  });

  test('loading, failed with retry, and empty each show their own text', () => {
    const loading = chief({ roster: rosterView({ state: 'loading' }) });
    assert.match(loading, /data-testid="collaboration-roster-loading"/);
    assert.ok(loading.includes(EN.rosterLoading));
    assert.doesNotMatch(loading, /collaboration-roster-save"/);

    const failed = chief({ roster: rosterView({ state: 'failed' }) });
    assert.match(failed, /data-testid="collaboration-roster-failed"/);
    assert.match(failed, /data-testid="collaboration-roster-retry"/);
    assert.ok(failed.includes(EN.rosterFailed));
    assert.ok(failed.includes(EN.rosterRetry));

    const empty = chief({ roster: rosterView({ rows: [] }) });
    assert.match(empty, /data-testid="collaboration-roster-empty"/);
    assert.ok(empty.includes(EN.rosterEmpty));
  });

  test('an unusable member shows its reason and cannot be newly ticked', () => {
    const markup = chief({
      roster: rosterView({
        rows: [
          rosterRowView('draft-1', { canTick: false, reasonLabel: EN.rosterReasonDraft }),
          rosterRowView('gone', { checked: true, canTick: true, reasonLabel: EN.rosterReasonMissing }),
        ],
      }),
    });
    assert.match(markup, /data-testid="collaboration-roster-reason-draft-1"/);
    assert.ok(markup.includes(EN.rosterReasonDraft));
    assert.ok(markup.includes(EN.rosterReasonMissing));
    const draftInput = markup.match(/<input type="checkbox"[^>]*value="draft-1"[/]>/)?.[0] ?? '';
    const goneInput = markup.match(/<input type="checkbox"[^>]*value="gone"[/]>/)?.[0] ?? '';
    assert.match(draftInput, /disabled=""/);
    assert.ok(goneInput.length > 0);
    assert.doesNotMatch(goneInput, /disabled=""/);
  });

  test('every reason renders in all three languages', () => {
    for (const [locale, catalog] of CATALOGS) {
      for (const key of Object.values(ROSTER_REASON_KEYS)) {
        const markup = render({
          labels: catalog as unknown as CollaborationViewLabels,
          teamChoices: THREE_TEAMS,
          selectedTeam: 'chief-of-staff',
          roster: rosterView({ rows: [rosterRowView('x', { canTick: false, reasonLabel: catalog[key] })] }),
        });
        assert.ok(markup.includes(catalog[key]), `${locale} ${key}`);
      }
    }
  });

  test('the picker is hidden for coding, for advisors and when a workflow is selected', () => {
    assert.doesNotMatch(chief({ selectedTeam: 'coding' }), /collaboration-roster"/);
    assert.doesNotMatch(chief({ selectedTeam: 'advisors' }), /collaboration-roster"/);
    assert.doesNotMatch(
      chief({
        workflowPicker: picker('loaded', [
          { id: 'w1', name: 'Morning brief', statusLabel: 'On', testedLabel: 'Tested', selected: true },
        ]),
        workflowStart: startView({}),
      }),
      /collaboration-roster"/,
    );
    assert.doesNotMatch(chief({ roster: null }), /collaboration-roster"/);
    assert.match(chief(), /collaboration-roster"/);
  });

  test('without a session the Chief of Staff option and the form show, and coding and advisors do not', () => {
    const markup = render({
      sessionReady: false,
      chiefStartWithoutSession: true,
      teamChoices: THREE_TEAMS,
      selectedTeam: 'chief-of-staff',
      roster: rosterView(),
    });
    assert.match(markup, /data-testid="collaboration-no-session"/);
    assert.match(markup, /data-testid="collaboration-team-option-chief-of-staff"/);
    assert.doesNotMatch(markup, /collaboration-team-option-coding/);
    assert.doesNotMatch(markup, /collaboration-team-option-advisors/);
    assert.match(markup, /data-testid="collaboration-task"/);
    assert.match(markup, /<button[^>]*type="submit"[^>]*data-testid="collaboration-start"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-start"[^>]*disabled=""/);
    assert.match(markup, /data-testid="collaboration-roster"/);
    assert.match(markup, /data-testid="collaboration-missing-session"/);
    assert.ok(markup.includes(EN.missingSession));
    // An empty task box still stops the start.
    assert.match(
      render({
        sessionReady: false,
        chiefStartWithoutSession: true,
        task: ' ',
        teamChoices: THREE_TEAMS,
        selectedTeam: 'chief-of-staff',
      }),
      /data-testid="collaboration-start"[^>]*disabled=""/,
    );
  });

  test('without a session and without the front door the old disabled view stays', () => {
    const markup = render({ sessionReady: false, teamChoices: THREE_TEAMS });
    assert.doesNotMatch(markup, /data-testid="collaboration-team-picker"/);
    assert.match(markup, /<button[^>]*data-testid="collaboration-start"[^>]*disabled=""/);
  });

  test('the skipped hint shows under the form, naming the members', () => {
    const hint = fillTemplate(EN.rosterSkippedHint, { members: 'Tax helper (still a draft, test it first)' });
    const markup = chief({ rosterSkippedHint: hint });
    assert.match(markup, /data-testid="collaboration-roster-skipped"/);
    assert.ok(markup.includes(hint));
    assert.doesNotMatch(chief(), /collaboration-roster-skipped/);
  });

  test('a waiting report-back step has no Edit task button and says why; other steps keep it', () => {
    const base = {
      statusLabel: 'Waiting for you',
      asked: 'x',
      prompt: 'The owner asked: ...',
      answer: null,
      handoffNote: null,
      failureReason: null,
      decidedBy: null,
      rejectReason: null,
      waiting: true,
      canChangeFiles: false,
      changedPaths: [],
      savePoint: null,
      tests: [],
      roundLabel: null,
      diff: null,
      diffUnavailable: false,
      testsGate: 'not_required' as const,
      testsBlockReason: null,
      approveWithoutTests: false,
      sources: [],
      showUnsourced: false,
      droppedSourceCount: 0,
    };
    const markup = chief({
      handoffs: [
        { ...base, referralId: 'rb-1', reportBack: true },
        { ...base, referralId: 'plain-1' },
      ],
    });
    const rb = markup.slice(
      markup.indexOf('collaboration-handoff-rb-1'),
      markup.indexOf('collaboration-handoff-plain-1'),
    );
    const plain = markup.slice(markup.indexOf('collaboration-handoff-plain-1'));
    assert.doesNotMatch(rb, /data-testid="collaboration-edit-task"/);
    assert.match(rb, /data-testid="collaboration-report-back-note-rb-1"/);
    assert.ok(rb.includes(labels.reportBackNoEdit));
    assert.match(rb, /data-testid="collaboration-approve-rb-1"/);
    assert.match(rb, /data-testid="collaboration-reject-rb-1"/);
    assert.match(plain, /data-testid="collaboration-edit-task"/);
    assert.doesNotMatch(plain, /collaboration-report-back-note/);
  });
});

describe('COS-FRONTDOOR-01C Team page with the roster', () => {
  let createRoot: (typeof import('react-dom/client'))['createRoot'];
  let originalDocument: Document | undefined;
  let originalFetch: typeof fetch;
  let root: Root | null = null;
  let latest: ReturnType<typeof useCollaborationScreen> | null = null;
  let posts: unknown[] = [];
  let puts: unknown[] = [];
  let gets: string[] = [];
  let detailBody: unknown = null;
  let startBody: Record<string, unknown> = {};
  let rosterStatus = 200;
  let putStatus = 200;
  let putErrorBody: unknown = null;
  let rosterBody: unknown = null;
  let probeSessionId = 'session-1';
  const WF2 = 'f0f0f0f0-0000-4000-8000-000000000002';
  const WF3 = 'f0f0f0f0-0000-4000-8000-000000000003';

  function member(id: string, kind: 'system' | 'workflow', name: string | null, reason: string | null = null) {
    return { id, kind, name, usable: reason === null, reason };
  }

  const defaultRoster = () => ({
    members: [member('product-strategy', 'system', 'Product Strategy')],
    choices: [
      member('product-strategy', 'system', 'Product Strategy'),
      member('technology-advisor', 'system', 'Technology Advisor'),
      member(WORKFLOW_ID, 'workflow', 'Morning brief'),
      member(WF2, 'workflow', 'Tax helper'),
      member(WF3, 'workflow', 'Draft helper', 'draft'),
    ],
  });

  function Probe() {
    latest = useCollaborationScreen({
      t: (key: string) => (enMessages.collaboration as Catalog)[key] ?? key,
      locale: 'en',
      sessionId: probeSessionId,
      queryProjectId: '',
      rosterEnabled: true,
      workflows: {
        state: 'loaded',
        items: [item()],
        onRetry: () => {},
        onStale: () => {},
      },
    });
    return createElement('div');
  }

  async function renderProbe() {
    await act(async () => {
      root!.render(createElement(Probe));
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
    puts = [];
    gets = [];
    detailBody = null;
    latest = null;
    rosterStatus = 200;
    putStatus = 200;
    putErrorBody = null;
    rosterBody = defaultRoster();
    probeSessionId = 'session-1';
    startBody = {
      collaborationRunId: 'run-1',
      projectId: 'p-1',
      status: 'active',
      referralId: 'ref-1',
      handoffStatus: 'pending_approval',
      source: 'user',
      target: 'chief-of-staff',
      conversationId: 'c-1',
      conversationCreated: false,
    };
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url === '/api/collaboration/roster') {
        if (method === 'PUT') {
          const body = init?.body ? JSON.parse(String(init.body)) : null;
          puts.push(body);
          if (putStatus !== 200) {
            return jsonResponse(putStatus, putErrorBody ?? { message: 'no' });
          }
          const ids: string[] = body.memberIds;
          const base = defaultRoster();
          return jsonResponse(200, {
            members: ids.map(
              (id) => base.choices.find((choice) => choice.id === id) ?? member(id, 'system', id),
            ),
            choices: base.choices,
          });
        }
        gets.push(url);
        return rosterStatus === 200
          ? jsonResponse(200, rosterBody)
          : jsonResponse(rosterStatus, { message: 'no' });
      }
      if (method === 'POST' && url === '/api/collaboration/runs') {
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        posts.push(body);
        return jsonResponse(201, startBody);
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

  async function openChief() {
    await renderProbe();
    await act(async () => {
      latest!.onTeamChange('chief-of-staff');
    });
    await flush();
  }

  function viewMarkup(): string {
    return renderToStaticMarkup(
      React.createElement(CollaborationView, {
        ...latest!,
        task: '',
      } as React.ComponentProps<typeof CollaborationView>),
    );
  }

  test('the roster is not requested for coding, and loads once when the Chief of Staff is picked', async () => {
    await renderProbe();
    await flush();
    assert.deepEqual(gets, []);
    assert.equal(latest?.roster?.state, 'loading');
    await act(async () => {
      latest!.onTeamChange('chief-of-staff');
    });
    await flush();
    assert.deepEqual(gets, ['/api/collaboration/roster']);
    assert.equal(latest?.roster?.state, 'loaded');
    // Going back and forth does not read it again.
    await act(async () => {
      latest!.onTeamChange('advisors');
    });
    await act(async () => {
      latest!.onTeamChange('chief-of-staff');
    });
    await flush();
    assert.deepEqual(gets, ['/api/collaboration/roster']);
  });

  test('loaded: rows from choices with the saved member ticked, names translated, unusable reasons shown', async () => {
    await openChief();
    const rows = latest!.roster!.rows;
    assert.deepEqual(
      rows.map((row) => [row.id, row.checked, row.canTick]),
      [
        ['product-strategy', true, true],
        ['technology-advisor', false, true],
        [WORKFLOW_ID, false, true],
        [WF2, false, true],
        [WF3, false, false],
      ],
    );
    assert.equal(rows[0].name, EN.productStrategy);
    assert.equal(rows[0].kindLabel, EN.rosterKindSystem);
    assert.equal(rows[2].name, 'Morning brief');
    assert.equal(rows[2].kindLabel, EN.rosterKindWorkflow);
    assert.equal(rows[4].reasonLabel, EN.rosterReasonDraft);
    assert.equal(rows[0].reasonLabel, null);
    assert.equal(latest!.roster!.dirty, false);
    assert.equal(latest!.roster!.labels.count, fillTemplate(EN.rosterCount, { count: '1', max: '3' }));
    assert.equal(latest!.roster!.message, null);
  });

  test('a fourth tick is refused with a hint and the list stays; an untick clears the hint', async () => {
    await openChief();
    await act(async () => {
      latest!.roster!.onToggle('technology-advisor');
    });
    await act(async () => {
      latest!.roster!.onToggle(WORKFLOW_ID);
    });
    assert.deepEqual(
      latest!.roster!.rows.filter((row) => row.checked).map((row) => row.id),
      ['product-strategy', 'technology-advisor', WORKFLOW_ID],
    );
    assert.equal(latest!.roster!.message, null);
    await act(async () => {
      latest!.roster!.onToggle(WF2);
    });
    assert.deepEqual(
      latest!.roster!.rows.filter((row) => row.checked).map((row) => row.id),
      ['product-strategy', 'technology-advisor', WORKFLOW_ID],
    );
    assert.equal(latest!.roster!.message, fillTemplate(EN.rosterLimit, { max: '3' }));
    await act(async () => {
      latest!.roster!.onToggle(WORKFLOW_ID);
    });
    assert.equal(latest!.roster!.message, null);
    assert.equal(latest!.roster!.dirty, true);
  });

  test('Save sends only memberIds in order, then shows saved and is no longer dirty', async () => {
    await openChief();
    await act(async () => {
      latest!.roster!.onToggle(WF2);
    });
    await act(async () => {
      latest!.roster!.onToggle('product-strategy');
    });
    assert.equal(latest!.roster!.dirty, true);
    await act(async () => {
      latest!.roster!.onSave();
    });
    await flush();
    assert.deepEqual(puts, [{ memberIds: [WF2] }]);
    assert.equal(latest!.roster!.saveState, 'saved');
    assert.equal(latest!.roster!.dirty, false);
    assert.equal(latest!.roster!.message, null);
    assert.deepEqual(
      latest!.roster!.rows.filter((row) => row.checked).map((row) => row.id),
      [WF2],
    );
    // A further change takes the saved line away.
    await act(async () => {
      latest!.roster!.onToggle('product-strategy');
    });
    assert.equal(latest!.roster!.saveState, 'idle');
  });

  test('a refused save shows a translated message and keeps the ticks', async () => {
    await openChief();
    await act(async () => {
      latest!.roster!.onToggle(WF2);
    });
    putStatus = 400;
    putErrorBody = { code: 'ROSTER_MEMBER_NOT_FOUND' };
    await act(async () => {
      latest!.roster!.onSave();
    });
    await flush();
    assert.equal(latest!.roster!.saveState, 'failed');
    assert.equal(latest!.roster!.message, EN.rosterSaveMemberRefused);
    assert.equal(latest!.roster!.dirty, true);
    putStatus = 500;
    putErrorBody = {};
    await act(async () => {
      latest!.roster!.onSave();
    });
    await flush();
    assert.equal(latest!.roster!.message, EN.rosterSaveFailed);
    putStatus = 400;
    putErrorBody = { code: 'ROSTER_TOO_MANY' };
    await act(async () => {
      latest!.roster!.onSave();
    });
    await flush();
    assert.equal(latest!.roster!.message, fillTemplate(EN.rosterLimit, { max: '3' }));
  });

  test('a failed load shows failed, and retry loads it', async () => {
    rosterStatus = 500;
    await openChief();
    assert.equal(latest!.roster!.state, 'failed');
    rosterStatus = 200;
    await act(async () => {
      latest!.roster!.onRetry();
    });
    await flush();
    assert.equal(latest!.roster!.state, 'loaded');
    assert.equal(gets.length, 2);
  });

  test('an empty roster list shows no rows', async () => {
    rosterBody = { members: [], choices: [] };
    await openChief();
    assert.equal(latest!.roster!.state, 'loaded');
    assert.deepEqual(latest!.roster!.rows, []);
    assert.match(viewMarkup(), /data-testid="collaboration-roster-empty"/);
  });

  test('the picker shows for the Chief of Staff and not once a workflow is selected', async () => {
    await renderProbe();
    assert.equal(latest!.selectedTeam, 'coding');
    assert.doesNotMatch(viewMarkup(), /data-testid="collaboration-roster"/);
    await act(async () => {
      latest!.onTeamChange('chief-of-staff');
    });
    await flush();
    assert.match(viewMarkup(), /data-testid="collaboration-roster"/);
    await act(async () => {
      latest!.workflowPicker!.onSelect(WORKFLOW_ID);
    });
    assert.doesNotMatch(viewMarkup(), /data-testid="collaboration-roster"/);
  });

  test('without a session the Chief of Staff starts with a body that has no sessionId', async () => {
    probeSessionId = '';
    await renderProbe();
    await flush();
    assert.equal(latest!.sessionReady, false);
    assert.equal(latest!.selectedTeam, 'chief-of-staff');
    assert.equal(latest!.chiefStartWithoutSession, true);
    // The roster loads at once: the Chief of Staff is the team.
    assert.deepEqual(gets, ['/api/collaboration/roster']);
    await act(async () => {
      latest!.onTaskChange('  Brief me  ');
    });
    await act(async () => {
      latest!.onStart();
    });
    await flush();
    assert.deepEqual(posts, [{ task: 'Brief me', team: 'chief-of-staff' }]);
    assert.equal('sessionId' in (posts[0] as object), false);
    assert.equal(latest!.task, '');
  });

  test('with a session the Chief of Staff body keeps sessionId and sends no roster', async () => {
    await openChief();
    await act(async () => {
      latest!.onTaskChange('Brief me');
    });
    await act(async () => {
      latest!.onStart();
    });
    await flush();
    assert.deepEqual(posts, [{ sessionId: 'session-1', task: 'Brief me', team: 'chief-of-staff' }]);
  });

  test('the coding team body is unchanged', async () => {
    await renderProbe();
    await act(async () => {
      latest!.onTaskChange('Fix it');
    });
    await act(async () => {
      latest!.onStart();
    });
    await flush();
    assert.deepEqual(posts, [{ sessionId: 'session-1', task: 'Fix it', team: 'coding' }]);
  });

  test('roster.skipped in the start response becomes a hint naming each member and why', async () => {
    startBody = {
      ...startBody,
      roster: {
        used: ['technology-advisor'],
        skipped: [
          { id: WF3, reason: 'draft' },
          { id: 'product-strategy', reason: 'off' },
          { id: 'f0f0f0f0-0000-4000-8000-0000000000ff', reason: 'missing' },
        ],
      },
    };
    await openChief();
    await act(async () => {
      latest!.onTaskChange('Brief me');
    });
    await act(async () => {
      latest!.onStart();
    });
    await flush();
    assert.equal(
      latest!.rosterSkippedHint,
      fillTemplate(EN.rosterSkippedHint, {
        members: [
          `Draft helper (${EN.rosterReasonDraft})`,
          `${EN.productStrategy} (${EN.rosterReasonOff})`,
          `${EN.rosterMemberUnknown} (${EN.rosterReasonMissing})`,
        ].join(' · '),
      }),
    );
    assert.match(viewMarkup(), /data-testid="collaboration-roster-skipped"/);
    // A start without skipped members clears it.
    startBody = { ...startBody, roster: { used: [], skipped: [] } };
    await act(async () => {
      latest!.onTaskChange('Again');
    });
    await act(async () => {
      latest!.onStart();
    });
    await flush();
    assert.equal(latest!.rosterSkippedHint, null);
  });

  test('the skipped hint is cleared when a past run is opened', async () => {
    startBody = {
      ...startBody,
      roster: { used: [], skipped: [{ id: 'product-strategy', reason: 'off' }] },
    };
    await openChief();
    await act(async () => {
      latest!.onTaskChange('Brief me');
    });
    await act(async () => {
      latest!.onStart();
    });
    await flush();
    assert.ok(latest!.rosterSkippedHint);
    await act(async () => {
      latest!.onOpenRun('run-1');
    });
    assert.equal(latest!.rosterSkippedHint, null);
  });

  function frontDoorDetail() {
    const base = {
      status: 'completed',
      prompt: 'p',
      handoffNote: null,
      failureReason: null,
      decidedBy: null,
      rejectReason: null,
    };
    return {
      run: {
        collaborationRunId: 'run-1',
        projectId: 'p-1',
        status: 'active',
        createdAt: '2026-11-10T00:00:00.000Z',
        updatedAt: '2026-11-10T00:00:00.000Z',
        completedAt: null,
        failedAt: null,
      },
      teamId: 'chief-of-staff',
      team: ['chief-of-staff', 'product-strategy', WF2],
      workflow: null,
      agents: [
        { name: 'chief-of-staff', label: 'Chief of Staff' },
        { name: 'product-strategy', label: 'Product Strategy' },
        { name: WF2, label: 'Tax helper' },
      ],
      handoffs: [
        { ...base, referralId: 'r1', source: 'user', target: 'chief-of-staff', answer: 'Ask tax.' },
        { ...base, referralId: 'r2', source: 'chief-of-staff', target: WF2, answer: 'Due in April.' },
        {
          ...base,
          referralId: 'r3',
          status: 'pending_approval',
          source: WF2,
          target: 'chief-of-staff',
          answer: null,
          prompt: 'x'.repeat(5000),
        },
        { ...base, referralId: 'r4', source: 'chief-of-staff', target: 'product-strategy', answer: 'Yes.' },
      ],
    };
  }

  test('a step shows the member label from agents, and a report-back reads agent to Chief of Staff', async () => {
    detailBody = frontDoorDetail();
    await renderProbe();
    await act(async () => {
      latest!.onOpenRun('run-1');
    });
    await flush();
    const handoffs = latest!.handoffs;
    assert.equal(handoffs[0].asked, fillTemplate(EN.asked, { source: EN.you, target: EN.chiefOfStaff }));
    // The workflow member is named by its stored label, not its id.
    assert.equal(
      handoffs[1].asked,
      fillTemplate(EN.asked, { source: EN.chiefOfStaff, target: 'Tax helper' }),
    );
    assert.equal(
      handoffs[2].asked,
      fillTemplate(EN.reportBackStep, { source: 'Tax helper', target: EN.chiefOfStaff }),
    );
    assert.deepEqual(
      handoffs.map((entry) => entry.reportBack),
      [false, false, true, false],
    );
    // A system member keeps its translated label.
    assert.equal(
      handoffs[3].asked,
      fillTemplate(EN.asked, { source: EN.chiefOfStaff, target: EN.productStrategy }),
    );
    assert.ok(!handoffs.some((entry) => entry.asked.includes(WF2)));
    assert.deepEqual(latest!.runTeam?.roles, [EN.chiefOfStaff, EN.productStrategy, 'Tax helper']);
  });

  test('a long report-back prompt is shown in full and has no edit, so nothing fails silently', async () => {
    detailBody = frontDoorDetail();
    await renderProbe();
    await act(async () => {
      latest!.onOpenRun('run-1');
    });
    await flush();
    const rb = latest!.handoffs[2];
    assert.equal(rb.prompt?.length, 5000);
    assert.equal(rb.waiting, true);
    const markup = viewMarkup();
    assert.match(markup, /data-testid="collaboration-report-back-note-r3"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-edit-task"/);
    assert.match(markup, /data-testid="collaboration-approve-r3"/);
  });
  // ---- USER-TEAMS-01C ----------------------------------------------------

  function teamRunDetail() {
    const base = {
      status: 'completed',
      prompt: 'p',
      handoffNote: null,
      failureReason: null,
      decidedBy: null,
      rejectReason: null,
    };
    return {
      run: {
        collaborationRunId: 'run-1',
        projectId: 'p-1',
        status: 'active',
        createdAt: '2026-11-11T00:00:00.000Z',
        updatedAt: '2026-11-11T00:00:00.000Z',
        completedAt: null,
        failedAt: null,
      },
      teamId: null,
      team: [WORKFLOW_ID, 'product-strategy', WF2],
      workflow: { id: WORKFLOW_ID, name: 'Morning brief', testRun: false },
      agents: [
        { name: WORKFLOW_ID, label: 'Morning brief' },
        { name: 'product-strategy', label: 'Product Strategy' },
        { name: WF2, label: 'Tax helper' },
      ],
      handoffs: [
        { ...base, referralId: 't1', source: 'user', target: WORKFLOW_ID, answer: 'Ask tax.' },
        { ...base, referralId: 't2', source: WORKFLOW_ID, target: WF2, answer: 'Due in April.' },
        {
          ...base,
          referralId: 't3',
          status: 'pending_approval',
          source: WF2,
          target: WORKFLOW_ID,
          answer: null,
          prompt: 'x'.repeat(5000),
        },
        {
          ...base,
          referralId: 't4',
          status: 'pending_approval',
          source: 'product-strategy',
          target: WORKFLOW_ID,
          answer: null,
        },
        { ...base, referralId: 't5', source: WORKFLOW_ID, target: 'product-strategy', answer: 'Yes.' },
      ],
    };
  }

  test('isReportBackHandoff takes the lead: a user workflow lead gets report-backs, others keep their rules', () => {
    assert.equal(isReportBackHandoff(WF2, WORKFLOW_ID, WORKFLOW_ID), true);
    assert.equal(isReportBackHandoff('product-strategy', WORKFLOW_ID, WORKFLOW_ID), true);
    assert.equal(isReportBackHandoff('user', WORKFLOW_ID, WORKFLOW_ID), false);
    assert.equal(isReportBackHandoff(WORKFLOW_ID, WF2, WORKFLOW_ID), false);
    assert.equal(isReportBackHandoff(WORKFLOW_ID, WORKFLOW_ID, WORKFLOW_ID), false);
    // A step to the Chief of Staff is not a report-back on a run led by a workflow.
    assert.equal(isReportBackHandoff(WF2, 'chief-of-staff', WORKFLOW_ID), false);
    // The default lead is the Chief of Staff, as before.
    assert.equal(isReportBackHandoff(WF2, 'chief-of-staff'), true);
    assert.equal(isReportBackHandoff(WF2, 'chief-of-staff', 'chief-of-staff'), true);
    // A fixed team lead never has report-back steps (a coding writer sending work to the lead).
    for (const lead of ['lead', 'writer', 'reviewer', 'advisors-lead', 'product-strategy']) {
      assert.equal(isReportBackHandoff('writer', lead, lead), false, lead);
      assert.equal(isReportBackHandoff('reviewer', 'lead', lead), false, lead);
    }
    assert.equal(reportBackStepKey('chief-of-staff'), 'reportBackStep');
    assert.equal(reportBackStepKey(WORKFLOW_ID), 'reportBackStepLead');
  });

  test('a report-back to a workflow lead reads "{agent} → {lead} (report-back)" with no Edit; the rest read as asked', async () => {
    detailBody = teamRunDetail();
    await renderProbe();
    await act(async () => {
      latest!.onOpenRun('run-1');
    });
    await flush();
    const handoffs = latest!.handoffs;
    assert.deepEqual(
      handoffs.map((entry) => entry.reportBack),
      [false, false, true, true, false],
    );
    assert.equal(
      handoffs[2].asked,
      fillTemplate(EN.reportBackStepLead, { agent: 'Tax helper', lead: 'Morning brief' }),
    );
    assert.equal(handoffs[2].asked, 'Tax helper → Morning brief (report-back)');
    assert.equal(
      handoffs[3].asked,
      fillTemplate(EN.reportBackStepLead, { agent: EN.productStrategy, lead: 'Morning brief' }),
    );
    assert.equal(
      handoffs[1].asked,
      fillTemplate(EN.asked, { source: 'Morning brief', target: 'Tax helper' }),
    );
    assert.ok(!handoffs.some((entry) => entry.asked.includes(WF2)));
    const markup = viewMarkup();
    assert.match(markup, /data-testid="collaboration-report-back-note-t3"/);
    assert.match(markup, /data-testid="collaboration-report-back-note-t4"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-edit-task"/);
    assert.match(markup, /data-testid="collaboration-approve-t3"/);
  });

  test('after a workflow start the skipped members are named from the workflow list and the advisor labels', async () => {
    startBody = {
      ...startBody,
      target: WORKFLOW_ID,
      roster: {
        used: [],
        skipped: [
          { id: 'product-strategy', reason: 'off' },
          { id: WORKFLOW_ID, reason: 'draft' },
          { id: WF3, reason: 'missing' },
        ],
      },
    };
    await renderProbe();
    await act(async () => {
      latest!.workflowPicker!.onSelect(WORKFLOW_ID);
    });
    await act(async () => {
      latest!.onTaskChange('Do it');
    });
    await act(async () => {
      latest!.onStart();
    });
    await flush();
    assert.equal(posts.length, 1);
    assert.equal((posts[0] as { workflowId?: string }).workflowId, WORKFLOW_ID);
    // The roster view is not loaded for a workflow start.
    assert.deepEqual(gets, []);
    assert.equal(
      latest!.rosterSkippedHint,
      fillTemplate(EN.rosterSkippedHint, {
        members: [
          `${EN.productStrategy} (${EN.rosterReasonOff})`,
          `Morning brief (${EN.rosterReasonDraft})`,
          `${EN.rosterMemberUnknown} (${EN.rosterReasonMissing})`,
        ].join(' · '),
      }),
    );
    assert.match(viewMarkup(), /data-testid="collaboration-roster-skipped"/);
  });
});

describe('USER-TEAMS-01C copy and codes', () => {
  test('reportBackStepLead exists in all three languages, with agent and lead, and is translated', () => {
    for (const [locale, catalog] of CATALOGS) {
      const value = catalog.reportBackStepLead;
      assert.equal(typeof value, 'string', locale);
      assert.deepEqual((value.match(/\{[a-zA-Z]+\}/g) ?? []).sort(), ['{agent}', '{lead}'], locale);
    }
    assert.equal(EN.reportBackStepLead, '{agent} → {lead} (report-back)');
    for (const [locale, catalog] of CATALOGS.slice(1)) {
      assert.match(catalog.reportBackStepLead, /回[報报]/, locale);
    }
  });

  test('a ROSTER_MEMBER_SELF refusal reads as a refused member, never as a generic failure', () => {
    assert.equal(rosterSaveErrorKey(400, { code: 'ROSTER_MEMBER_SELF' }), 'rosterSaveMemberRefused');
  });
});

describe('APPROVAL-SET-01C automatic approval on the Team page', () => {
  const tFor = (catalog: Catalog) => (key: string): string => catalog[key] ?? `MISSING:${key}`;
  const tEn = tFor(EN);

  const step = (overrides: Record<string, unknown>) => ({
    referralId: 'ap-1',
    statusLabel: 'Waiting for you',
    asked: 'x',
    prompt: 'Look this up',
    answer: null,
    handoffNote: null,
    failureReason: null,
    decidedBy: null,
    rejectReason: null,
    waiting: true,
    canChangeFiles: false,
    changedPaths: [],
    savePoint: null,
    tests: [],
    roundLabel: null,
    diff: null,
    diffUnavailable: false,
    testsGate: 'not_required' as const,
    testsBlockReason: null,
    approveWithoutTests: false,
    sources: [],
    showUnsourced: false,
    droppedSourceCount: 0,
    ...overrides,
  });

  test('read-only and credits approvals read as words, with the estimate and the limit', () => {
    const owner = '11111111-2222-4333-8444-555555555555';
    assert.equal(
      collaborationAutoApprovedText(
        { decidedBy: owner, autoApproved: { mode: 'read_only', estimateCredits: null, creditLimit: null } },
        tEn,
      ),
      EN.autoApprovedReadOnly,
    );
    const credits = collaborationAutoApprovedText(
      { decidedBy: owner, autoApproved: { mode: 'credits', estimateCredits: 6, creditLimit: 20 } },
      tEn,
    );
    assert.equal(credits, 'Approved automatically: the last step used about 6 credits, under your limit of 20 credits');
    const amounts = (estimate: number, limit: number) =>
      collaborationAutoApprovedText(
        { decidedBy: owner, autoApproved: { mode: 'credits', estimateCredits: estimate, creditLimit: limit } },
        tEn,
      );
    assert.equal(amounts(1, 2), 'Approved automatically: the last step used about 1 credit, under your limit of 2 credits');
    assert.equal(amounts(2, 1), 'Approved automatically: the last step used about 2 credits, under your limit of 1 credit');
    for (const catalog of [CATALOGS[1][1], CATALOGS[2][1]]) {
      const zh = collaborationAutoApprovedText(
        { decidedBy: owner, autoApproved: { mode: 'credits', estimateCredits: 1, creditLimit: 20 } },
        tFor(catalog),
      );
      assert.ok(zh && zh.includes('1 ') && zh.includes('20 ') && !zh.includes('{') && !zh.includes('MISSING'));
    }
    assert.equal(
      collaborationAutoApprovedText(
        { decidedBy: owner, autoApproved: { mode: 'credits', estimateCredits: null, creditLimit: null } },
        tEn,
      ),
      EN.autoApprovedCreditsShort,
    );
    assert.equal(collaborationAutoApprovedText({ decidedBy: owner, autoApproved: null }, tEn), null);
    assert.equal(collaborationAutoApprovedText({ decidedBy: owner }, tEn), null);
  });

  test('a waiting reason shows only while the step waits, and only for a known reason', () => {
    for (const reason of AUTO_APPROVAL_WAIT_REASONS) {
      const text = collaborationAutoApprovalWaitingText({ status: 'pending_approval', autoApprovalWaiting: reason }, tEn);
      assert.ok(text && !text.startsWith('MISSING'), reason);
    }
    assert.equal(collaborationAutoApprovalWaitingText({ status: 'pending_approval', autoApprovalWaiting: null }, tEn), null);
    assert.equal(collaborationAutoApprovalWaitingText({ status: 'completed', autoApprovalWaiting: 'writes' }, tEn), null);
    assert.equal(
      collaborationAutoApprovalWaitingText(
        { status: 'pending_approval', autoApprovalWaiting: 'toString' as unknown as 'writes' },
        tEn,
      ),
      null,
    );
  });

  test('an approved step shows the automatic line and not the raw decidedBy id', () => {
    const owner = '11111111-2222-4333-8444-555555555555';
    const markup = render({
      handoffs: [
        step({
          waiting: false,
          statusLabel: 'Completed',
          decidedBy: owner,
          autoApprovedText: EN.autoApprovedReadOnly,
        }),
      ],
    });
    assert.match(markup, /data-testid="collaboration-auto-approved-ap-1"/);
    assert.ok(markup.includes(EN.autoApprovedReadOnly));
    assert.ok(!markup.includes(owner));
    assert.ok(!markup.includes(`${EN.decidedBy}:`));
  });

  test('a person-decided step keeps the decidedBy line', () => {
    const markup = render({ handoffs: [step({ waiting: false, statusLabel: 'Completed', decidedBy: 'user-7' })] });
    assert.ok(markup.includes(`${EN.decidedBy}: user-7`));
    assert.doesNotMatch(markup, /collaboration-auto-approved-/);
  });

  test('a waiting step shows the reason and keeps the Approve and Reject buttons', () => {
    const markup = render({
      handoffs: [step({ autoApprovalWaitingText: EN.autoApprovalWaitingOverLimit })],
    });
    assert.match(markup, /data-testid="collaboration-auto-waiting-ap-1"/);
    assert.ok(markup.includes(EN.autoApprovalWaitingOverLimit));
    assert.match(markup, /data-testid="collaboration-approve-ap-1"/);
    assert.match(markup, /data-testid="collaboration-reject-ap-1"/);
  });

  test('a waiting step without a reason shows no reason line', () => {
    const markup = render({ handoffs: [step({})] });
    assert.doesNotMatch(markup, /collaboration-auto-waiting-/);
    assert.match(markup, /data-testid="collaboration-approve-ap-1"/);
  });

  test('every new key exists in all three languages, with the same placeholders and real Chinese', () => {
    const keys = [
      'autoApprovedReadOnly',
      'autoApprovedCredits',
      'autoApprovedCreditsShort',
      'creditAmountOne',
      'creditAmountMany',
      'autoApprovalWaitingWrites',
      'autoApprovalWaitingUnknownCost',
      'autoApprovalWaitingOverLimit',
      'autoApprovalWaitingChecksFailed',
      'autoApprovalWaitingLeadMissing',
    ];
    const holders = (text: string) => (text.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
    for (const key of keys) {
      assert.equal(typeof EN[key], 'string', `en ${key}`);
      for (const [locale, catalog] of CATALOGS.slice(1)) {
        assert.equal(typeof catalog[key], 'string', `${locale} ${key}`);
        assert.deepEqual(holders(catalog[key]), holders(EN[key]), `${locale} ${key}`);
        assert.match(catalog[key], /[一-鿿]/, `${locale} ${key}`);
      }
    }
    assert.deepEqual(holders(EN.autoApprovedCredits), ['{estimate}', '{limit}']);
  });
});

describe('COS-DRAFTS-01B draft card on the Team page', () => {
  const tFor = (catalog: Catalog) => (key: string): string => catalog[key] ?? `MISSING:${key}`;
  const tEn = tFor(EN);
  const RUN = 'run-1';
  const STEP = 'ref-9';

  const validDraft = (overrides: Record<string, unknown> = {}) => ({
    kind: 'workflow',
    fields: {
      name: 'Weekly sales digest',
      role: 'Sales analyst',
      description: 'Sums up the sales mail.',
      tone: 'calm',
      replyLanguage: 'zh-TW',
      purpose: 'Keep the owner informed.',
      procedure: 'Read the mail. Add it up.',
      result: 'One short report.',
    },
    problems: [],
    invalid: null,
    unknownLabels: [],
    answerWithoutDraft: 'Here is a draft for you.',
    ...overrides,
  });

  const step = (extra: Record<string, unknown>) => ({
    referralId: STEP,
    statusLabel: 'Completed',
    asked: 'x',
    prompt: null,
    answer: 'Here is a draft for you.',
    handoffNote: null,
    failureReason: null,
    decidedBy: null,
    rejectReason: null,
    waiting: false,
    canChangeFiles: false,
    changedPaths: [],
    savePoint: null,
    tests: [],
    roundLabel: null,
    diff: null,
    diffUnavailable: false,
    testsGate: 'not_required' as const,
    testsBlockReason: null,
    approveWithoutTests: false,
    sources: [],
    showUnsourced: false,
    droppedSourceCount: 0,
    ...extra,
  });

  const cardFor = (value: unknown, locale = 'en', t = tEn) => {
    const draft = readHandoffDraft(value);
    assert.ok(draft);
    return buildDraftCard(draft, { t, locale, runId: RUN, referralId: STEP });
  };

  test('a valid draft shows its title, parts, the not-saved sentences and one Review and save link', () => {
    const markup = render({
      handoffs: [step({ draft: cardFor(validDraft()), answerShown: 'Here is a draft for you.' })],
    });
    assert.match(markup, /data-testid="collaboration-draft-ref-9"/);
    assert.ok(markup.includes('Draft workflow: Weekly sales digest'));
    for (const text of ['Sales analyst', 'Sums up the sales mail.', 'calm', 'zh-TW', 'One short report.']) {
      assert.ok(markup.includes(text), text);
    }
    assert.match(markup, /<details[^>]*data-testid="collaboration-draft-parts-ref-9"/);
    assert.ok(markup.includes(EN.draftNotSaved));
    assert.ok(markup.includes(EN.draftOwnerSets));
    assert.ok(markup.includes(EN.draftReview));
    assert.match(markup, /href="\/en\/platform\?draftRun=run-1&amp;draftStep=ref-9"/);
    assert.doesNotMatch(markup, /collaboration-draft-invalid-/);
    assert.match(markup, /data-testid="collaboration-answer-ref-9"/);
    assert.ok(markup.includes('Here is a draft for you.'));
  });

  test('the link carries the locale prefix and encodes both ids', () => {
    assert.equal(draftReviewHref('zh-TW', 'a b', 'c/d'), '/zh-TW/platform?draftRun=a%20b&draftStep=c%2Fd');
    const card = cardFor(validDraft(), 'zh-CN');
    assert.equal(card.reviewHref, '/zh-CN/platform?draftRun=run-1&draftStep=ref-9');
  });

  test('an agent draft names the agent kind and lists its three parts', () => {
    const card = cardFor(validDraft({ kind: 'agent', fields: { name: 'Helper', role: 'r', description: 'd' } }));
    assert.equal(card.title, 'Draft agent: Helper');
    assert.deepEqual(
      card.parts.map((part) => part.part),
      ['name', 'role', 'description'],
    );
  });

  test('dropped parts and their reasons are named', () => {
    const card = cardFor(
      validDraft({
        problems: [
          { part: 'role', reason: 'too_long' },
          { part: 'procedure', reason: 'prompt_too_long' },
        ],
      }),
    );
    assert.ok(card.droppedText);
    assert.ok(card.droppedText.includes(`Role (${EN.draftProblemTooLong})`));
    assert.ok(card.droppedText.includes(`Procedure (${EN.draftProblemPromptTooLong})`));
    const markup = render({ handoffs: [step({ draft: card })] });
    assert.match(markup, /data-testid="collaboration-draft-dropped-ref-9"/);
    assert.match(markup, /collaboration-draft-review-ref-9/);
  });

  test('an invalid draft shows its translated reason, names unknown labels and has no link', () => {
    const card = cardFor({
      kind: 'workflow',
      fields: { name: 'Leak' },
      problems: [],
      invalid: 'unknown_label',
      unknownLabels: ['tools', 'budget'],
      answerWithoutDraft: 'Text',
    });
    assert.equal(card.reviewHref, null);
    assert.equal(card.valid, false);
    // An invalid draft carries no parts, whatever the server sent.
    assert.deepEqual(card.parts, []);
    const markup = render({ handoffs: [step({ draft: card })] });
    assert.match(markup, /data-testid="collaboration-draft-invalid-ref-9"/);
    assert.ok(markup.includes(EN.draftInvalidUnknownLabel));
    assert.match(markup, /data-testid="collaboration-draft-unknown-labels-ref-9"/);
    assert.ok(markup.includes('tools, budget'));
    assert.doesNotMatch(markup, /collaboration-draft-review-/);
    assert.doesNotMatch(markup, /collaboration-draft-parts-/);
    assert.ok(markup.includes(EN.draftNotSaved));
  });

  test('every invalid and problem reason has copy in all three languages', () => {
    for (const [locale, catalog] of CATALOGS) {
      const t = tFor(catalog);
      for (const reason of DRAFT_INVALID_REASONS) {
        const text = t(draftInvalidKey(reason));
        assert.ok(text && !text.startsWith('MISSING:'), `${locale} ${reason}`);
        const card = buildDraftCard(
          { kind: 'workflow', fields: {}, problems: [], invalid: reason, unknownLabels: [], answerWithoutDraft: '' },
          { t, locale, runId: RUN, referralId: STEP },
        );
        assert.equal(card.invalidText, text, `${locale} ${reason}`);
        assert.equal(card.reviewHref, null);
      }
      for (const reason of DRAFT_PROBLEM_REASONS) {
        const text = t(draftProblemKey(reason));
        assert.ok(text && !text.startsWith('MISSING:'), `${locale} ${reason}`);
      }
    }
  });

  test('the reader fails closed on a bad shape', () => {
    assert.equal(readHandoffDraft(null), null);
    assert.equal(readHandoffDraft(undefined), null);
    assert.equal(readHandoffDraft('draft'), null);
    assert.equal(readHandoffDraft([]), null);
    assert.equal(readHandoffDraft({ kind: 'team', fields: { name: 'x' }, invalid: null })?.invalid, 'invalid_kind');
    assert.equal(readHandoffDraft({ kind: 'agent', fields: { role: 'r' }, invalid: null })?.invalid, 'missing_name');
    assert.equal(readHandoffDraft({ kind: 'agent', fields: { name: 'x' }, invalid: 'weird' })?.invalid, 'malformed_tag');
    const read = readHandoffDraft({
      kind: 'workflow',
      fields: { name: 'x', tools: 'shell', model: 'big', budget: '9', role: 5, replyLanguage: 'fr' },
      problems: [
        { part: 'role', reason: 'nope' },
        { part: 'tools', reason: 'too_long' },
      ],
      invalid: null,
    });
    assert.deepEqual(read?.fields, { name: 'x' });
    assert.deepEqual(read?.problems, []);
  });

  test('a step without a draft renders as before, with the answer whole', () => {
    const markup = render({ handoffs: [step({ draft: null, answer: 'Plain answer' })] });
    assert.doesNotMatch(markup, /collaboration-draft-/);
    assert.match(markup, /data-testid="collaboration-answer-ref-9"/);
    assert.ok(markup.includes('Plain answer'));
  });

  test('a draft with no text before it shows the card without an empty answer box', () => {
    const markup = render({
      handoffs: [step({ draft: cardFor(validDraft()), answerShown: '' })],
    });
    assert.match(markup, /collaboration-draft-ref-9/);
    assert.doesNotMatch(markup, /data-testid="collaboration-answer-ref-9"/);
    assert.ok(!markup.includes(EN.noAnswerYet));
  });

  test('the new keys exist in all three languages, with the same placeholders and real Chinese', () => {
    const keys = [
      'draftTitle',
      'draftTitleInvalid',
      'draftKindAgent',
      'draftKindWorkflow',
      'draftParts',
      'draftNotSaved',
      'draftOwnerSets',
      'draftDropped',
      'draftProblemItem',
      'draftUnknownLabels',
      'draftReview',
      ...DRAFT_PARTS.map(draftFieldKey),
      ...DRAFT_INVALID_REASONS.map(draftInvalidKey),
      ...DRAFT_PROBLEM_REASONS.map(draftProblemKey),
    ];
    const holders = (text: string) => (text.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
    for (const key of keys) {
      assert.equal(typeof EN[key], 'string', `en ${key}`);
      for (const [locale, catalog] of CATALOGS.slice(1)) {
        assert.equal(typeof catalog[key], 'string', `${locale} ${key}`);
        assert.deepEqual(holders(catalog[key]), holders(EN[key]), `${locale} ${key}`);
        assert.match(catalog[key], /[一-鿿]/, `${locale} ${key}`);
      }
    }
  });

  test('the page maps the server draft into the card, and the card only links and reads', () => {
    const source = readFileSync(join(process.cwd(), 'components/collaboration/collaboration-page.tsx'), 'utf8');
    assert.match(source, /readHandoffDraft\(handoff\.draft\)/);
    assert.match(source, /answerShown: draftView \? draftView\.answerWithoutDraft : null/);
    const draftSource = readFileSync(join(process.cwd(), 'components/collaboration/collaboration-draft.ts'), 'utf8');
    assert.doesNotMatch(draftSource, /fetch\(|collaborationFetch|method:/);
  });
});
