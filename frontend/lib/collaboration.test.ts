import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import React, { act, createElement } from 'react';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { useCollaborationScreen } from '../components/collaboration/collaboration-page';
import CollaborationView, {
  type CollaborationViewLabels,
} from '../components/collaboration/collaboration-view';
import enMessages from '../messages/en.json';
import zhCnMessages from '../messages/zh-CN.json';
import zhTwMessages from '../messages/zh-TW.json';
import {
  COLLABORATION_POLL_MS,
  collaborationRefusal,
  collaborationRefusalMessageKey,
  createSingleFlight,
  sendBackRoundNumbers,
  shouldPollCollaboration,
} from './collaboration/logic';

const labels = enMessages.collaboration as CollaborationViewLabels;

function renderChain(handoffs: Array<{
  referralId: string;
  statusLabel: string;
  waiting: boolean;
  answer: string | null;
  prompt: string | null;
  canChangeFiles?: boolean;
  changedPaths?: string[];
  savePoint?: string | null;
  tests?: Array<{ command: string; passed: boolean }>;
  roundLabel?: string | null;
  diff?: string | null;
  diffUnavailable?: boolean;
}>) {
  return renderToStaticMarkup(
    React.createElement(CollaborationView, {
      labels,
      backHref: '/en/app',
      sessionReady: true,
      projectReady: true,
      loading: false,
      notice: null,
      conversationCreated: false,
      task: 'Look at the login form',
      deciding: false,
      team: [
        { name: labels.lead, summary: labels.leadSummary },
        { name: labels.writer, summary: labels.writerSummary },
        { name: labels.reviewer, summary: labels.reviewerSummary },
      ],
      handoffs: handoffs.map((handoff) => ({
        referralId: handoff.referralId,
        statusLabel: handoff.statusLabel,
        asked: 'You asked Lead',
        prompt: handoff.prompt,
        answer: handoff.answer,
        handoffNote: null,
        failureReason: null,
        decidedBy: null,
        rejectReason: null,
        waiting: handoff.waiting,
        canChangeFiles: handoff.canChangeFiles === true,
        changedPaths: handoff.changedPaths ?? [],
        savePoint: handoff.savePoint ?? null,
        tests: handoff.tests ?? [],
        roundLabel: handoff.roundLabel ?? null,
        diff: handoff.diff === undefined ? null : handoff.diff,
        diffUnavailable: handoff.diffUnavailable === true,
      })),
      runs: [],
      rejectReferralId: null,
      rejectReason: '',
      onTaskChange: () => {},
      onStart: () => {},
      onOpenRun: () => {},
      onApprove: () => {},
      onBeginReject: () => {},
      onCancelReject: () => {},
      onConfirmReject: () => {},
      onRejectReasonChange: () => {},
    }),
  );
}

describe('collaboration page', () => {
  test('a waiting hand-off shows Approve and Reject, and a finished one does not', () => {
    const markup = renderChain([
      {
        referralId: 'waiting-1',
        statusLabel: enMessages.collaboration.statusPendingApproval,
        waiting: true,
        answer: null,
        prompt: 'Please look at the form.',
      },
      {
        referralId: 'done-1',
        statusLabel: enMessages.collaboration.statusCompleted,
        waiting: false,
        answer: 'The form is fine.',
        prompt: 'Checked.',
      },
    ]);

    assert.match(markup, /data-testid="collaboration-approve-waiting-1"/);
    assert.match(markup, /data-testid="collaboration-reject-waiting-1"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-approve-done-1"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-reject-done-1"/);
    assert.match(markup, /<details/);
    assert.doesNotMatch(markup, /<details[^>]*\sopen/);
  });

  test('a refusal notice shows the translated message', () => {
    const markup = renderToStaticMarkup(
      React.createElement(CollaborationView, {
        labels,
        backHref: '/zh-TW/app',
        sessionReady: true,
        projectReady: true,
        loading: false,
        notice: zhTwMessages.collaboration.refusalCredits,
        conversationCreated: false,
        task: '',
        deciding: false,
        team: [],
        handoffs: [],
        runs: [],
        rejectReferralId: null,
        rejectReason: '',
        onTaskChange: () => {},
        onStart: () => {},
        onOpenRun: () => {},
        onApprove: () => {},
        onBeginReject: () => {},
        onCancelReject: () => {},
        onConfirmReject: () => {},
        onRejectReasonChange: () => {},
      }),
    );
    assert.equal(collaborationRefusal(402, 'Insufficient credit balance'), 'credits');
    assert.equal(collaborationRefusalMessageKey('credits'), 'refusalCredits');
    assert.equal(zhTwMessages.collaboration.refusalCredits, '點數不足。');
    assert.match(markup, /data-testid="collaboration-notice"/);
    assert.match(markup, /點數不足。/);
  });

  test('a waiting writer step warns before approve, and a finished step shows the work', () => {
    const markup = renderChain([
      {
        referralId: 'writer-wait',
        statusLabel: enMessages.collaboration.statusPendingApproval,
        waiting: true,
        answer: null,
        prompt: 'Fix the form.',
        canChangeFiles: true,
      },
      {
        referralId: 'lead-wait',
        statusLabel: enMessages.collaboration.statusPendingApproval,
        waiting: true,
        answer: null,
        prompt: 'Look first.',
        canChangeFiles: false,
      },
      {
        referralId: 'writer-done',
        statusLabel: enMessages.collaboration.statusCompleted,
        waiting: false,
        answer: 'Updated the form.',
        prompt: 'Fix the form.',
        canChangeFiles: true,
        changedPaths: ['src/form.ts'],
        savePoint: 'abc123save',
        tests: [
          { command: 'npm test', passed: true },
          { command: 'npm run build', passed: false },
        ],
      },
    ]);

    const warningAt = markup.indexOf('data-testid="collaboration-write-warning-writer-wait"');
    const approveAt = markup.indexOf('data-testid="collaboration-approve-writer-wait"');
    assert.ok(warningAt >= 0 && approveAt > warningAt);
    assert.match(markup, new RegExp(enMessages.collaboration.writerWarning));
    assert.doesNotMatch(markup, /data-testid="collaboration-write-warning-lead-wait"/);
    assert.match(markup, /data-testid="collaboration-changed-writer-done-0"/);
    assert.match(markup, /src\/form\.ts/);
    assert.match(markup, /data-testid="collaboration-save-point-writer-done"/);
    assert.match(markup, /abc123save/);
    assert.match(markup, /npm test Passed/);
    assert.match(markup, /npm run build Failed/);
    assert.match(markup, /data-testid="collaboration-workspace-writer-done"/);
    assert.match(markup, /href="\/en\/app"/);
    assert.match(markup, new RegExp(enMessages.collaboration.reviewOrRevert));
    assert.equal(
      zhTwMessages.collaboration.writerWarning,
      '核准這一步後，撰寫者可以修改檔案。',
    );
    assert.equal(
      zhCnMessages.collaboration.writerWarning,
      '批准这一步后，撰写者可以修改文件。',
    );
    assert.doesNotMatch(markup, /data-testid="collaboration-work-writer-wait"/);
  });

  test('labels send-back rounds and shows the writer diff as text', () => {
    const diff = 'diff --git a/src/form.ts b/src/form.ts\n+fixed\n<script>alert(1)</script>';
    const markup = renderChain([
      {
        referralId: 'writer-diff',
        statusLabel: enMessages.collaboration.statusCompleted,
        waiting: false,
        answer: 'Updated the form.',
        prompt: 'Fix the form.',
        canChangeFiles: true,
        diff,
      },
      {
        referralId: 'round-1',
        statusLabel: enMessages.collaboration.statusPendingApproval,
        waiting: true,
        answer: null,
        prompt: 'Fix the listed items.',
        roundLabel: 'Round 1',
      },
      {
        referralId: 'round-2',
        statusLabel: enMessages.collaboration.statusPendingApproval,
        waiting: true,
        answer: null,
        prompt: 'Fix the remaining items.',
        roundLabel: 'Round 2',
        diffUnavailable: true,
      },
    ]);

    assert.match(markup, /data-testid="collaboration-round-round-1"/);
    assert.match(markup, /Round 1/);
    assert.match(markup, /data-testid="collaboration-round-round-2"/);
    assert.match(markup, /Round 2/);
    assert.match(markup, /data-testid="collaboration-diff-text-writer-diff"/);
    assert.match(markup, /diff --git a\/src\/form\.ts/);
    assert.match(markup, /font-mono/);
    assert.match(markup, /overflow-auto/);
    assert.match(markup, /max-w-full/);
    assert.match(markup, /whitespace-pre/);
    assert.doesNotMatch(markup, /<details[^>]*\sopen/);
    assert.match(markup, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(markup, /<script/);
    assert.match(markup, new RegExp(enMessages.collaboration.diffUnavailable));
    assert.deepStrictEqual(sendBackRoundNumbers([
      { source: 'lead', target: 'writer' },
      { source: 'writer', target: 'reviewer' },
      { source: 'reviewer', target: 'writer' },
      { source: 'writer', target: 'reviewer' },
      { source: 'reviewer', target: 'writer' },
    ]), [null, null, 1, null, 2]);
    assert.equal(zhTwMessages.collaboration.sendBackRound, '第 {round} 輪');
    assert.equal(zhCnMessages.collaboration.sendBackRound, '第 {round} 轮');
    assert.equal(zhTwMessages.collaboration.diff, '差異');
    assert.equal(zhCnMessages.collaboration.diff, '差异');
    assert.notEqual(zhTwMessages.collaboration.diffUnavailable, enMessages.collaboration.diffUnavailable);
    assert.notEqual(zhCnMessages.collaboration.diffEmpty, enMessages.collaboration.diffEmpty);
  });

  test('an answer containing a script tag renders as text', () => {
    const markup = renderChain([
      {
        referralId: 'answer-1',
        statusLabel: enMessages.collaboration.statusCompleted,
        waiting: false,
        answer: '<script>alert(1)</script>',
        prompt: '<script>prompt</script>',
      },
    ]);
    assert.match(markup, /data-testid="collaboration-answer-answer-1"/);
    assert.match(markup, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(markup, /<script/);
  });

  test('collaboration sources do not render HTML or markdown', () => {
    const files = [
      new URL('../components/collaboration/collaboration-view.tsx', import.meta.url),
      new URL('../components/collaboration/collaboration-page.tsx', import.meta.url),
      new URL('./collaboration/api.ts', import.meta.url),
      new URL('./collaboration/logic.ts', import.meta.url),
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
      assert.doesNotMatch(source, /react-markdown|ReactMarkdown|marked\(/);
    }
  });

  test('every collaboration key exists in en, zh-TW, and zh-CN', () => {
    const catalogs = [enMessages.collaboration, zhTwMessages.collaboration, zhCnMessages.collaboration];
    const keys = Object.keys(enMessages.collaboration).sort();
    assert.ok(keys.length > 0);
    for (const catalog of catalogs) {
      assert.deepEqual(Object.keys(catalog).sort(), keys);
      for (const key of keys) {
        const value = catalog[key as keyof typeof catalog];
        assert.equal(typeof value, 'string');
        assert.equal(value.trim().length > 0, true);
      }
    }
    for (const key of keys) {
      const english = enMessages.collaboration[key as keyof typeof enMessages.collaboration];
      const traditional = zhTwMessages.collaboration[key as keyof typeof zhTwMessages.collaboration];
      const simplified = zhCnMessages.collaboration[key as keyof typeof zhCnMessages.collaboration];
      assert.notEqual(traditional, english);
      assert.notEqual(simplified, english);
      assert.match(traditional, /\p{Script=Han}/u);
      assert.match(simplified, /\p{Script=Han}/u);
    }
  });

  test('a second approval cannot start while the first is in flight', () => {
    const flight = createSingleFlight();
    assert.equal(flight.tryBegin(), true);
    assert.equal(flight.tryBegin(), false);
    flight.end();
    assert.equal(flight.tryBegin(), true);
  });

  test('polling runs only while the collaboration is active and the tab is visible', () => {
    assert.equal(shouldPollCollaboration({ runStatus: 'active', documentHidden: false }), true);
    assert.equal(shouldPollCollaboration({ runStatus: 'active', documentHidden: true }), false);
    assert.equal(shouldPollCollaboration({ runStatus: 'completed', documentHidden: false }), false);
    assert.equal(shouldPollCollaboration({ runStatus: 'failed', documentHidden: false }), false);
    assert.equal(collaborationRefusal(503, 'Execution globally disabled'), 'off');
    assert.equal(collaborationRefusal(429, 'Token quota exceeded'), 'tokens');
    assert.equal(collaborationRefusal(429, 'rate limit exceeded'), 'rate');
    assert.equal(collaborationRefusal(404, 'Collaboration run not found'), 'notFound');
    assert.equal(collaborationRefusal(409, 'Session is not usable'), 'session');
    assert.equal(collaborationRefusal(409, 'Referral is not pending approval'), 'generic');
  });
});

type ScheduledPoll = { fn: () => void; delay: number };

const fetchCalls: string[] = [];
const intervals = new Map<number, ScheduledPoll>();
let nextIntervalId = 1;
let scheduleCount = 0;
let runStatus = 'active';
let root: Root | null = null;
let latest: {
  notice: string | null;
  loading: boolean;
  onOpenRun: (runId: string) => void;
} | null = null;
let createRoot: (typeof import('react-dom/client'))['createRoot'];
let originalFetch: typeof fetch;
let originalSetInterval: typeof setInterval;
let originalClearInterval: typeof clearInterval;
let originalDocument: Document | undefined;

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
    getAttribute(this: Record<string, unknown>, key: string) {
      return (this.attributes as Record<string, string>)[key] ?? null;
    },
    removeAttribute(this: Record<string, unknown>, key: string) {
      delete (this.attributes as Record<string, string>)[key];
    },
    hasAttribute(this: Record<string, unknown>, key: string) {
      return key in (this.attributes as Record<string, string>);
    },
    appendChild(this: Record<string, unknown>, child: Record<string, unknown>) {
      (this.childNodes as unknown[]).push(child);
      child.parentNode = this;
      return child;
    },
    removeChild(this: Record<string, unknown>, child: Record<string, unknown>) {
      this.childNodes = (this.childNodes as unknown[]).filter((item) => item !== child);
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

function installScreenDom() {
  const doc: Record<string, unknown> = {
    nodeType: 9,
    visibilityState: 'visible',
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
    createDocumentFragment() {
      const node = createDomNode('#fragment');
      node.ownerDocument = doc;
      return node;
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
  const globalObject = globalThis as Record<string, unknown>;
  globalObject.document = doc;
  globalObject.HTMLIFrameElement = function HTMLIFrameElement() {};
  globalObject.HTMLElement = function HTMLElement() {};
  globalObject.Element = function Element() {};
  globalObject.Node = function Node() {};
  globalObject.IS_REACT_ACT_ENVIRONMENT = true;
  globalObject.addEventListener = () => {};
  globalObject.removeEventListener = () => {};
  globalObject.dispatchEvent = () => true;
  globalObject.window = globalThis;
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

function runPayload(status: string) {
  return {
    collaborationRunId: 'run-1',
    projectId: 'proj-1',
    status,
    createdAt: '2026-11-03T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
    completedAt: null,
    failedAt: null,
  };
}

function installFetch() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    fetchCalls.push(url);
    if (url.startsWith('/api/collaboration/runs?')) {
      return jsonResponse(200, { runs: [runPayload(runStatus)] });
    }
    if (url === '/api/collaboration/runs/run-1') {
      return jsonResponse(200, {
        run: runPayload(runStatus),
        team: ['lead', 'writer', 'reviewer'],
        handoffs: [],
      });
    }
    return jsonResponse(404, { message: 'missing' });
  }) as typeof fetch;
}

function installIntervals() {
  globalThis.setInterval = ((fn: () => void, delay?: number) => {
    const id = nextIntervalId;
    nextIntervalId += 1;
    scheduleCount += 1;
    intervals.set(id, { fn, delay: delay ?? 0 });
    return id as unknown as ReturnType<typeof setInterval>;
  }) as typeof setInterval;
  globalThis.clearInterval = ((id?: ReturnType<typeof setInterval>) => {
    if (typeof id === 'number') {
      intervals.delete(id);
    }
  }) as typeof clearInterval;
}

function Probe(props: { generation: number; projectId: string }) {
  const catalog = enMessages.collaboration as Record<string, string>;
  const generation = props.generation;
  const t = (key: string) => `${generation}:${catalog[key] ?? key}`;
  latest = useCollaborationScreen({
    t,
    locale: 'en',
    sessionId: 'session-1',
    queryProjectId: props.projectId,
  });
  return createElement('div');
}

async function renderScreen(generation: number, projectId: string) {
  await act(async () => {
    root!.render(createElement(Probe, { generation, projectId }));
  });
}

async function firePoll() {
  assert.equal(intervals.size, 1);
  const scheduled = [...intervals.values()][0];
  assert.ok(scheduled);
  assert.equal(scheduled.delay, COLLABORATION_POLL_MS);
  await act(async () => {
    scheduled.fn();
    for (let step = 0; step < 30; step += 1) {
      await Promise.resolve();
    }
  });
}

describe('collaboration screen reload', () => {
  before(async () => {
    originalDocument = globalThis.document;
    installScreenDom();
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
    fetchCalls.length = 0;
    intervals.clear();
    nextIntervalId = 1;
    scheduleCount = 0;
    runStatus = 'active';
    latest = null;
    originalFetch = globalThis.fetch;
    originalSetInterval = globalThis.setInterval;
    originalClearInterval = globalThis.clearInterval;
    installFetch();
    installIntervals();
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
    latest = null;
    globalThis.fetch = originalFetch;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
    fetchCalls.length = 0;
    intervals.clear();
  });

  test('a new t on each render does not fetch again', async () => {
    await renderScreen(0, '');
    assert.deepEqual(fetchCalls, []);
    await renderScreen(1, '');
    assert.deepEqual(fetchCalls, []);

    await renderScreen(2, 'proj-1');
    assert.deepEqual(fetchCalls, ['/api/collaboration/runs?projectId=proj-1']);
    assert.equal(latest?.loading, false);
    assert.equal(latest?.notice, null);

    for (const generation of [3, 4, 5, 6]) {
      await renderScreen(generation, 'proj-1');
    }
    assert.deepEqual(fetchCalls, ['/api/collaboration/runs?projectId=proj-1']);

    await renderScreen(7, 'proj-2');
    assert.deepEqual(fetchCalls, [
      '/api/collaboration/runs?projectId=proj-1',
      '/api/collaboration/runs?projectId=proj-2',
    ]);
    for (const generation of [8, 9, 10]) {
      await renderScreen(generation, 'proj-2');
    }
    assert.equal(fetchCalls.length, 2);
    assert.equal(latest?.notice, null);
  });

  test('polling fires every 5 seconds while active and stops when finished', async () => {
    await renderScreen(1, 'proj-1');
    assert.deepEqual(fetchCalls, ['/api/collaboration/runs?projectId=proj-1']);
    assert.equal(scheduleCount, 0);

    await act(async () => {
      latest!.onOpenRun('run-1');
    });
    assert.deepEqual(fetchCalls, [
      '/api/collaboration/runs?projectId=proj-1',
      '/api/collaboration/runs/run-1',
    ]);
    assert.equal(scheduleCount, 1);
    assert.equal(latest?.notice, null);

    await renderScreen(2, 'proj-1');
    await renderScreen(3, 'proj-1');
    assert.equal(fetchCalls.length, 2);
    assert.equal(scheduleCount, 1);

    await firePoll();
    assert.equal(fetchCalls.length, 4);
    assert.equal(scheduleCount, 1);
    await firePoll();
    assert.equal(fetchCalls.length, 6);
    assert.equal(scheduleCount, 1);

    runStatus = 'completed';
    await firePoll();
    assert.equal(fetchCalls.length, 8);
    assert.equal(intervals.size, 0);
    assert.equal(scheduleCount, 1);
    assert.equal(latest?.notice, null);

    const stopped = fetchCalls.length;
    await renderScreen(4, 'proj-1');
    assert.equal(fetchCalls.length, stopped);
    assert.equal(intervals.size, 0);
  });
});
