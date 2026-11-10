import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { act, createElement } from 'react';
import type { Root } from 'react-dom/client';
import type { ResultsFetcher } from '@/components/results/results-api';
import { useResults, type UseResults } from '@/components/results/use-results';

// A small DOM, enough for createRoot and act (same approach as collaboration-workflows.test.tsx).
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

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function listBody(seenAt: string | null = null) {
  return {
    results: [
      {
        collaborationRunId: 'run-1',
        projectId: 'p',
        status: 'completed',
        createdAt: '2026-11-09T08:00:00.000Z',
        finishedAt: '2026-11-09T08:05:00.000Z',
        teamId: 'coding',
        workflow: null,
        task: 'task',
        excerpt: 'answer',
        seenAt,
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
  };
}

const DETAIL = {
  run: { collaborationRunId: 'run-1', status: 'completed', createdAt: 'c', updatedAt: 'u', completedAt: 'd', failedAt: null },
  teamId: 'coding',
  workflow: null,
  handoffs: [{ status: 'completed', prompt: 'task', answer: 'answer' }],
};

describe('useResults (RESULTS-01 D14)', () => {
  let createRoot: (typeof import('react-dom/client'))['createRoot'];
  let originalDocument: Document | undefined;
  let root: Root | null = null;
  let latest: UseResults | null = null;
  let calls: Array<{ path: string; method: string }> = [];
  let respond: (path: string, method: string) => Response;
  let unauthorized = 0;

  const fetcher: ResultsFetcher = async (path, init = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    calls.push({ path, method });
    return respond(path, method);
  };
  const onUnauthorized = () => {
    unauthorized += 1;
  };

  function Probe(props: { enabled: boolean }) {
    latest = useResults({ enabled: props.enabled, onUnauthorized, fetcher });
    return createElement('div');
  }

  async function renderProbe(enabled = true) {
    await act(async () => {
      root!.render(createElement(Probe, { enabled }));
    });
    await flush();
  }

  async function flush() {
    await act(async () => {
      for (let step = 0; step < 30; step += 1) {
        await Promise.resolve();
      }
    });
  }

  function seenPosts() {
    return calls.filter((call) => call.method === 'POST');
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
    calls = [];
    latest = null;
    unauthorized = 0;
    respond = (path, method) => {
      if (path.startsWith('/api/results?')) return json(200, listBody());
      if (path === '/api/collaboration/workflows') return json(200, { workflows: [] });
      if (path === '/api/collaboration/runs/run-1') return json(200, DETAIL);
      if (method === 'POST' && path === '/api/results/run-1/seen') {
        return json(200, { seenAt: '2026-11-10T12:00:00.000Z' });
      }
      return json(404, {});
    };
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
  });

  test('loads nothing until sign-in is confirmed, then the first page', async () => {
    await renderProbe(false);
    assert.equal(calls.length, 0);
    await renderProbe(true);
    assert.equal(latest?.phase, 'ready');
    assert.equal(latest?.page?.results.length, 1);
    assert.ok(calls.some((call) => call.path === '/api/results?page=1&pageSize=20'));
  });

  test('opening an unread result loads the detail, posts seen once and clears the mark in place', async () => {
    await renderProbe();
    const listReads = calls.filter((call) => call.path.startsWith('/api/results?')).length;
    await act(async () => {
      latest!.openResult('run-1');
    });
    await flush();
    assert.equal(latest?.detail?.phase, 'ready');
    assert.equal(latest?.detail?.detail?.answer, 'answer');
    assert.deepEqual(seenPosts(), [{ path: '/api/results/run-1/seen', method: 'POST' }]);
    assert.equal(latest?.page?.results[0].seenAt, '2026-11-10T12:00:00.000Z');
    assert.equal(calls.filter((call) => call.path.startsWith('/api/results?')).length, listReads);

    await act(async () => {
      latest!.closeResult();
    });
    await act(async () => {
      latest!.openResult('run-1');
    });
    await flush();
    assert.equal(seenPosts().length, 1);
  });

  test('an already seen result is not posted again', async () => {
    respond = (path) => {
      if (path.startsWith('/api/results?')) return json(200, listBody('2026-11-01T00:00:00.000Z'));
      if (path === '/api/collaboration/runs/run-1') return json(200, DETAIL);
      return json(200, { workflows: [] });
    };
    await renderProbe();
    await act(async () => {
      latest!.openResult('run-1');
    });
    await flush();
    assert.equal(latest?.detail?.phase, 'ready');
    assert.equal(seenPosts().length, 0);
  });

  test('a 404 detail is not found and a failed detail is an error; neither posts seen', async () => {
    await renderProbe();
    respond = (path) => (path === '/api/collaboration/runs/run-1' ? json(404, {}) : json(200, listBody()));
    await act(async () => {
      latest!.openResult('run-1');
    });
    await flush();
    assert.equal(latest?.detail?.phase, 'not_found');
    respond = (path) => (path === '/api/collaboration/runs/run-1' ? json(500, {}) : json(200, listBody()));
    await act(async () => {
      latest!.retryDetail();
    });
    await flush();
    assert.equal(latest?.detail?.phase, 'error');
    assert.equal(seenPosts().length, 0);
    assert.equal(latest?.page?.results[0].seenAt, null);
  });

  test('a refused seen mark leaves the item unread and is tried again on the next open', async () => {
    respond = (path, method) => {
      if (path.startsWith('/api/results?')) return json(200, listBody());
      if (path === '/api/collaboration/runs/run-1') return json(200, DETAIL);
      if (method === 'POST') return json(500, {});
      return json(200, { workflows: [] });
    };
    await renderProbe();
    await act(async () => {
      latest!.openResult('run-1');
    });
    await flush();
    assert.equal(latest?.page?.results[0].seenAt, null);
    await act(async () => {
      latest!.openResult('run-1');
    });
    await flush();
    assert.equal(seenPosts().length, 2);
  });

  test('filters reset to page 1 and paging reads the next page', async () => {
    await renderProbe();
    await act(async () => {
      latest!.goToPage(2);
    });
    await flush();
    assert.ok(calls.some((call) => call.path === '/api/results?page=2&pageSize=20'));
    await act(async () => {
      latest!.applyFilters({ status: 'failed', workflowId: '', from: '', to: '' });
    });
    await flush();
    assert.ok(calls.some((call) => call.path === '/api/results?status=failed&page=1&pageSize=20'));
  });

  test('403 is the forbidden phase, 500 the error phase with retry, 401 goes to sign-in', async () => {
    respond = (path) => (path.startsWith('/api/results?') ? json(403, {}) : json(200, { workflows: [] }));
    await renderProbe();
    assert.equal(latest?.phase, 'forbidden');

    respond = (path) => (path.startsWith('/api/results?') ? json(500, {}) : json(200, { workflows: [] }));
    await act(async () => {
      latest!.retry();
    });
    await flush();
    assert.equal(latest?.phase, 'error');

    respond = (path) => (path.startsWith('/api/results?') ? json(401, {}) : json(200, { workflows: [] }));
    await act(async () => {
      latest!.retry();
    });
    await flush();
    assert.equal(unauthorized, 1);
  });
});
