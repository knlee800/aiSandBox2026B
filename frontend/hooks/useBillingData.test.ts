import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, before, beforeEach, describe, test } from 'node:test';
import { act, createElement, type ReactElement } from 'react';
import type { Root } from 'react-dom/client';
import type { BillingBalance, BillingData } from './useBillingData';

type FetchCall = {
  url: string;
  init?: RequestInit;
};

type HookSnapshot = BillingData & { refetch: () => Promise<void> };

const listeners = new Map<string, Array<(event: { type: string }) => void>>();
const fetchCalls: FetchCall[] = [];

let latest: HookSnapshot | null = null;
let root: Root | null = null;
let container: { ownerDocument: unknown } | null = null;
let createRoot: (typeof import('react-dom/client'))['createRoot'];
let useBillingData: (typeof import('./useBillingData'))['useBillingData'];

function createDomNode(tag = 'div') {
  const node: Record<string, unknown> = {
    nodeType: 1,
    nodeName: tag.toUpperCase(),
    tagName: tag.toUpperCase(),
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    style: {},
    attributes: {},
    childNodes: [],
    children: [],
    parentNode: null,
    ownerDocument: null,
    textContent: '',
    innerHTML: '',
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
      return (this.appendChild as (c: Record<string, unknown>) => Record<string, unknown>)(child);
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
    cloneNode() {
      return createDomNode(tag);
    },
    contains() {
      return false;
    },
  };
  return node;
}

function installMinimalDom() {
  const doc: Record<string, unknown> = {
    nodeType: 9,
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
      return {
        nodeType: 3,
        nodeName: '#text',
        textContent: text,
        parentNode: null,
        ownerDocument: doc,
      };
    },
    createComment(text: string) {
      return {
        nodeType: 8,
        nodeName: '#comment',
        textContent: text,
        ownerDocument: doc,
      };
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

  const globalObject = globalThis as any;

  function HTMLIFrameElement() {}
  function HTMLElement() {}
  function Element() {}
  function Node() {}

  globalObject.document = doc;
  globalObject.HTMLIFrameElement = HTMLIFrameElement;
  globalObject.HTMLElement = HTMLElement;
  globalObject.Element = Element;
  globalObject.Node = Node;
  globalObject.IS_REACT_ACT_ENVIRONMENT = true;
  globalObject.addEventListener = addWindowListener;
  globalObject.removeEventListener = removeWindowListener;
  globalObject.dispatchEvent = dispatchWindowEvent;
  globalObject.window = globalThis;
  doc.defaultView = globalThis;
}

function addWindowListener(type: string, fn: (event: { type: string }) => void) {
  const current = listeners.get(type) ?? [];
  current.push(fn);
  listeners.set(type, current);
}

function removeWindowListener(type: string, fn: (event: { type: string }) => void) {
  const current = (listeners.get(type) ?? []).filter((item) => item !== fn);
  listeners.set(type, current);
}

function dispatchWindowEvent(event: { type: string }) {
  for (const listener of listeners.get(event.type) ?? []) {
    listener(event);
  }
  return true;
}

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: new Headers(),
    redirected: false,
    statusText: '',
    type: 'basic' as ResponseType,
    url: '',
    clone: () => mockResponse(status, body),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    text: async () => JSON.stringify(body),
    bytes: async () => new Uint8Array(0),
  } as Response;
}

function countBalanceFetches(): number {
  return fetchCalls.filter((call) => call.url === '/api/billing/balance').length;
}

function HookProbe(): ReactElement {
  latest = useBillingData();
  return createElement('div');
}

async function renderHook(): Promise<void> {
  container = (globalThis.document as { createElement: (tag: string) => { ownerDocument: unknown } }).createElement(
    'div',
  );
  root = createRoot(container as unknown as Element);
  await act(async () => {
    root!.render(createElement(HookProbe));
  });
}

async function unmountHook(): Promise<void> {
  if (!root) {
    return;
  }
  await act(async () => {
    root!.unmount();
  });
  root = null;
  container = null;
  latest = null;
}

const originalFetch = globalThis.fetch;
let fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;

const staleBalance: BillingBalance = {
  balance: 3278,
  monthlyAllocation: 500,
  planId: 'free',
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-08-01T00:00:00.000Z',
  status: 'active',
};

const currentBalance: BillingBalance = {
  balance: 30577,
  monthlyAllocation: 500,
  planId: 'free',
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-08-01T00:00:00.000Z',
  status: 'active',
};

describe('useBillingData focus refresh', () => {
  before(async () => {
    installMinimalDom();
    ({ createRoot } = await import('react-dom/client'));
    ({ useBillingData } = await import('./useBillingData'));
  });

  beforeEach(() => {
    fetchCalls.length = 0;
    listeners.clear();
    latest = null;
    fetchImpl = async (url) => {
      if (url === '/api/billing/balance') {
        return mockResponse(200, staleBalance);
      }
      if (url === '/api/billing/subscription') {
        return mockResponse(200, null);
      }
      return mockResponse(404, { error: 'not found' });
    };
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      fetchCalls.push({ url: href, init });
      return fetchImpl(href, init);
    }) as typeof fetch;
  });

  afterEach(async () => {
    await unmountHook();
    globalThis.fetch = originalFetch;
    fetchCalls.length = 0;
    listeners.clear();
  });

  test('fetches billing data on initial mount with credentials include', async () => {
    await renderHook();

    assert.equal(countBalanceFetches(), 1);
    assert.equal(fetchCalls.some((call) => call.url === '/api/billing/subscription'), true);
    for (const call of fetchCalls) {
      assert.equal(call.init?.credentials, 'include');
    }
    assert.equal(latest?.loading, false);
    assert.equal(latest?.error, null);
    assert.equal(latest?.balance?.balance, 3278);
    assert.equal(latest?.subscription, null);
  });

  test('window focus refetches billing data and replaces stale balance', async () => {
    await renderHook();
    assert.equal(latest?.balance?.balance, 3278);

    fetchImpl = async (url) => {
      if (url === '/api/billing/balance') {
        return mockResponse(200, currentBalance);
      }
      if (url === '/api/billing/subscription') {
        return mockResponse(200, null);
      }
      return mockResponse(404, { error: 'not found' });
    };

    await act(async () => {
      (globalThis as typeof globalThis & { dispatchEvent: typeof dispatchWindowEvent }).dispatchEvent({
        type: 'focus',
      });
    });

    assert.equal(countBalanceFetches(), 2);
    assert.equal(latest?.loading, false);
    assert.equal(latest?.error, null);
    assert.equal(latest?.balance?.balance, 30577);
    assert.equal(latest?.balance?.balance, currentBalance.balance);
    assert.notEqual(latest?.balance?.balance, 3278);
  });

  test('focus refresh keeps the current balance visible until the new value arrives', async () => {
    await renderHook();
    assert.equal(latest?.balance?.balance, 3278);
    assert.equal(latest?.loading, false);

    let resolveBalance: ((value: Response) => void) | undefined;
    const pendingBalance = new Promise<Response>((resolve) => {
      resolveBalance = resolve;
    });

    fetchImpl = async (url) => {
      if (url === '/api/billing/balance') {
        return pendingBalance;
      }
      if (url === '/api/billing/subscription') {
        return mockResponse(200, null);
      }
      return mockResponse(404, { error: 'not found' });
    };

    await act(async () => {
      (globalThis as typeof globalThis & { dispatchEvent: typeof dispatchWindowEvent }).dispatchEvent({
        type: 'focus',
      });
    });

    assert.equal(latest?.loading, false);
    assert.equal(latest?.balance?.balance, 3278);
    assert.equal(latest?.error, null);

    await act(async () => {
      resolveBalance!(mockResponse(200, currentBalance));
    });

    assert.equal(latest?.loading, false);
    assert.equal(latest?.balance?.balance, 30577);
  });

  test('unmount removes the focus listener so later focus events do not refetch', async () => {
    await renderHook();
    assert.equal(countBalanceFetches(), 1);
    assert.equal((listeners.get('focus') ?? []).length, 1);

    await unmountHook();
    assert.equal((listeners.get('focus') ?? []).length, 0);

    (globalThis as typeof globalThis & { dispatchEvent: typeof dispatchWindowEvent }).dispatchEvent({
      type: 'focus',
    });

    assert.equal(countBalanceFetches(), 1);
  });

  test('a single focus event does not start overlapping billing fetches', async () => {
    await renderHook();
    assert.equal(countBalanceFetches(), 1);

    let resolveBalance: ((value: Response) => void) | undefined;
    const pendingBalance = new Promise<Response>((resolve) => {
      resolveBalance = resolve;
    });

    fetchImpl = async (url) => {
      if (url === '/api/billing/balance') {
        return pendingBalance;
      }
      if (url === '/api/billing/subscription') {
        return mockResponse(200, null);
      }
      return mockResponse(404, { error: 'not found' });
    };

    const dispatchFocus = (globalThis as typeof globalThis & { dispatchEvent: typeof dispatchWindowEvent })
      .dispatchEvent;

    await act(async () => {
      dispatchFocus({ type: 'focus' });
      dispatchFocus({ type: 'focus' });
    });

    assert.equal(countBalanceFetches(), 2);

    await act(async () => {
      resolveBalance!(mockResponse(200, currentBalance));
    });

    assert.equal(countBalanceFetches(), 2);
    assert.equal(latest?.balance?.balance, 30577);
  });

  test('does not apply numeric transformation to the API balance', async () => {
    fetchImpl = async (url) => {
      if (url === '/api/billing/balance') {
        return mockResponse(200, currentBalance);
      }
      if (url === '/api/billing/subscription') {
        return mockResponse(200, null);
      }
      return mockResponse(404, { error: 'not found' });
    };

    await renderHook();

    assert.equal(latest?.balance?.balance, 30577);
    assert.equal(latest?.balance?.balance, currentBalance.balance);
    assert.equal(Object.is(latest?.balance?.balance, 30577), true);
    assert.equal(latest?.balance?.monthlyAllocation, 500);
  });

  test('failed initial fetch sets FETCH_FAILED without inventing a balance', async () => {
    fetchImpl = async () => mockResponse(500, { message: 'error' });

    await renderHook();

    assert.equal(latest?.loading, false);
    assert.equal(latest?.error, 'FETCH_FAILED');
    assert.equal(latest?.balance, null);
  });
});

describe('useBillingData source contract', () => {
  const source = readFileSync(resolve(__dirname, './useBillingData.ts'), 'utf-8');

  test('listens for window focus and removes the listener on cleanup', () => {
    assert.match(source, /window\.addEventListener\(\s*['"]focus['"]/);
    assert.match(source, /window\.removeEventListener\(\s*['"]focus['"]/);
    assert.match(source, /return \(\) => \{/);
  });

  test('stores API JSON balance without scaling or conversion', () => {
    assert.match(source, /setBalance\(balanceData\)/);
    assert.equal(source.includes('balanceData.balance /'), false);
    assert.equal(source.includes('balanceData.balance *'), false);
    assert.equal(source.includes('Math.floor'), false);
    assert.equal(source.includes('Math.round'), false);
  });
});
