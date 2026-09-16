import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, before, beforeEach, describe, test } from 'node:test';
import { act, createElement, type ReactElement } from 'react';
import type { Root } from 'react-dom/client';
import type { UseCreditBalanceResult } from './useCreditBalance';

type FetchCall = {
  url: string;
  init?: RequestInit;
};

const listeners = new Map<string, Array<(event: { type: string }) => void>>();
const fetchCalls: FetchCall[] = [];

let latest: UseCreditBalanceResult | null = null;
let root: Root | null = null;
let container: { ownerDocument: unknown } | null = null;
let createRoot: (typeof import('react-dom/client'))['createRoot'];
let useCreditBalance: (typeof import('./useCreditBalance'))['useCreditBalance'];

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

function HookProbe(): ReactElement {
  latest = useCreditBalance();
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

const provisionedBalancePayload = {
  balance: 42,
  monthlyAllocation: 500,
  planId: 'free',
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-08-01T00:00:00.000Z',
  status: 'active',
};

const unprovisionedBalancePayload = {
  balance: 0,
  monthlyAllocation: 0,
  planId: 'free',
  periodStart: null,
  periodEnd: null,
  status: 'active',
};

describe('useCreditBalance', () => {
  before(async () => {
    installMinimalDom();
    ({ createRoot } = await import('react-dom/client'));
    ({ useCreditBalance } = await import('./useCreditBalance'));
  });

  beforeEach(() => {
    fetchCalls.length = 0;
    listeners.clear();
    latest = null;
    fetchImpl = async (url) => {
      if (url === '/api/billing/balance') {
        return mockResponse(200, provisionedBalancePayload);
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

  test('initial fetch calls only GET /api/billing/balance with credentials include', async () => {
    await renderHook();

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0]?.url, '/api/billing/balance');
    assert.equal(fetchCalls[0]?.init?.credentials, 'include');
    assert.equal(fetchCalls[0]?.init?.method, undefined);
    assert.equal(latest?.loading, false);
    assert.equal(latest?.error, null);
    assert.equal(latest?.balance, 42);
  });

  test('successful JSON exposes numeric balance with no scaling', async () => {
    await renderHook();

    assert.equal(latest?.balance, 42);
    assert.equal(latest?.balance, provisionedBalancePayload.balance);
    assert.equal(Object.is(latest?.balance, 42), true);
  });

  test('HTTP error sets FETCH_FAILED and balance null', async () => {
    fetchImpl = async () => mockResponse(500, { message: 'error' });

    await renderHook();

    assert.equal(latest?.loading, false);
    assert.equal(latest?.error, 'FETCH_FAILED');
    assert.equal(latest?.balance, null);
  });

  test('unprovisioned 200 balance 0 exposes 0', async () => {
    fetchImpl = async (url) => {
      if (url === '/api/billing/balance') {
        return mockResponse(200, unprovisionedBalancePayload);
      }
      return mockResponse(404, { error: 'not found' });
    };

    await renderHook();

    assert.equal(latest?.loading, false);
    assert.equal(latest?.error, null);
    assert.equal(latest?.balance, 0);
  });
});

describe('useCreditBalance source contract', () => {
  const source = readFileSync(resolve(__dirname, './useCreditBalance.ts'), 'utf-8');
  const subscriptionPath = ['/api/billing/', 'subscription'].join('');
  const stripeNeedle = ['str', 'ipe'].join('');
  const checkoutNeedle = ['chec', 'kout'].join('');
  const topUpCamel = ['top', 'Up'].join('');
  const topUpHyphen = ['top', '-up'].join('');
  const postMethod = ['method:', " '", 'POST', "'"].join('');

  test('source reads only /api/billing/balance and stays GET-only', () => {
    assert.match(source, /\/api\/billing\/balance/);
    assert.equal(source.includes(subscriptionPath), false);
    assert.equal(source.toLowerCase().includes(stripeNeedle), false);
    assert.equal(source.toLowerCase().includes(checkoutNeedle), false);
    assert.equal(source.includes(topUpCamel), false);
    assert.equal(source.toLowerCase().includes(topUpHyphen), false);
    assert.equal(source.includes(postMethod), false);
    assert.equal(/method:\s*['"]POST['"]/.test(source), false);
  });

  test('listens for window focus and removes the listener on cleanup', () => {
    assert.match(source, /window\.addEventListener\(\s*['"]focus['"]/);
    assert.match(source, /window\.removeEventListener\(\s*['"]focus['"]/);
    assert.match(source, /return \(\) => \{/);
  });
});
