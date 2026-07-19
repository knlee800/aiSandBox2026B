import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const React = require('react');
const originalLoad = Module._load;
const originalReactGlobal = (globalThis as typeof globalThis & { React?: unknown }).React;
const originalFetch = globalThis.fetch;

type FetchResultShape = {
  ok: boolean;
  json: () => Promise<{ id?: unknown }>;
};

type PageHarnessOptions = {
  search?: string;
  fetchImpl?: () => Promise<FetchResultShape>;
  axiosPostImpl?: () => Promise<unknown>;
};

type ElementLike = {
  type?: unknown;
  props?: {
    children?: unknown;
    onSubmit?: (event: { preventDefault: () => void }) => Promise<void>;
  };
};

type PageHarness = {
  renderPage: () => string;
  renderElement: () => ElementLike;
  runEffects: () => Promise<void>;
  pushCalls: string[];
  replaceCalls: string[];
};

function createPageHarness(options: PageHarnessOptions = {}) {
  const search = options.search ?? '';
  const stateStore: unknown[] = [];
  const effectStore: Array<() => void | (() => void)> = [];
  const pushCalls: string[] = [];
  const replaceCalls: string[] = [];
  const router = {
    push: (href: string) => {
      pushCalls.push(href);
    },
    replace: (href: string) => {
      replaceCalls.push(href);
    },
  };
  const fetchImpl =
    options.fetchImpl ??
    (async () => ({
      ok: false,
      json: async () => ({}),
    }));
  const axiosPostImpl = options.axiosPostImpl ?? (async () => ({}));
  let stateIndex = 0;

  globalThis.fetch = fetchImpl as unknown as typeof fetch;

  const fakeReact = {
    ...React,
    useState<T>(initialValue: T | (() => T)) {
      const currentIndex = stateIndex;
      stateIndex += 1;

      if (!(currentIndex in stateStore)) {
        stateStore[currentIndex] =
          typeof initialValue === 'function'
            ? (initialValue as () => T)()
            : initialValue;
      }

      const setState = (nextValue: T | ((previousValue: T) => T)) => {
        const previousValue = stateStore[currentIndex] as T;
        stateStore[currentIndex] =
          typeof nextValue === 'function'
            ? (nextValue as (previousValue: T) => T)(previousValue)
            : nextValue;
      };

      return [stateStore[currentIndex] as T, setState] as const;
    },
    useEffect(effect: () => void | (() => void)) {
      effectStore.push(effect);
    },
  };

  Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
    if (request === 'react') {
      return fakeReact;
    }

    if (request === 'next/navigation') {
      return {
        useRouter: () => router,
        useParams: () => ({ locale: 'en' }),
        useSearchParams: () => new URLSearchParams(search),
      };
    }

    if (request === 'next/link') {
      return {
        __esModule: true,
        default: ({ href, children, ...props }: { href: string; children: unknown }) =>
          React.createElement('a', { href, ...props }, children),
      };
    }

    if (request === 'axios') {
      return {
        __esModule: true,
        default: { post: axiosPostImpl },
      };
    }

    if (request === '@/components/LanguageSwitcher') {
      return {
        __esModule: true,
        default: () => React.createElement('div', null),
      };
    }

    if (request === '@heroicons/react/24/outline') {
      const IconStub = () => React.createElement('span');
      return {
        __esModule: true,
        EnvelopeIcon: IconStub,
        LockClosedIcon: IconStub,
        ExclamationTriangleIcon: IconStub,
        CheckCircleIcon: IconStub,
      };
    }

    if (request.includes('hooks/useTranslations')) {
      return {
        useTranslations: (namespace?: string) => (key: string) => `${namespace}.${key}`,
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[require.resolve('./page.tsx')];
  const Page = require('./page.tsx').default;

  function renderElement(): ElementLike {
    stateIndex = 0;
    return Page() as ElementLike;
  }

  function renderPage(): string {
    return renderToStaticMarkup(React.createElement(Page));
  }

  async function runEffects(): Promise<void> {
    for (const effect of effectStore) {
      effect();
    }
    await Promise.resolve();
    await Promise.resolve();
  }

  const harness: PageHarness = {
    renderPage,
    renderElement,
    runEffects,
    pushCalls,
    replaceCalls,
  };

  return harness;
}

afterEach(() => {
  Module._load = originalLoad;
  delete require.cache[require.resolve('./page.tsx')];
  (globalThis as typeof globalThis & { React?: unknown }).React = originalReactGlobal;
  globalThis.fetch = originalFetch;
});

function renderLoginPage(search: string): string {
  (globalThis as typeof globalThis & { React?: unknown }).React = React;
  const harness = createPageHarness({ search });
  return harness.renderPage();
}

function toNodeArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  return value == null ? [] : [value];
}

function findElementByType(node: unknown, type: string): ElementLike | null {
  if (!node || typeof node !== 'object') {
    return null;
  }

  const element = node as ElementLike;
  if (element.type === type) {
    return element;
  }

  const children = toNodeArray(element.props?.children);
  for (const child of children) {
    const match = findElementByType(child, type);
    if (match) {
      return match;
    }
  }

  return null;
}

describe('LoginPage OAuth error banner', () => {
  test('does not render the OAuth error banner when there is no error query param', () => {
    const html = renderLoginPage('');

    assert.ok(!html.includes('errors.oauthFailed'));
    assert.ok(!html.includes('errors.accountConflict'));
  });

  test('renders the provider-agnostic OAuth failure message for oauth_failed', () => {
    const html = renderLoginPage('error=oauth_failed');

    assert.match(html, /errors\.oauthFailed/);
    assert.ok(!html.includes('errors.accountConflict'));
  });

  test('renders the account conflict message for account_conflict', () => {
    const html = renderLoginPage('error=account_conflict');

    assert.match(html, /errors\.accountConflict/);
    assert.ok(!html.includes('errors.oauthFailed'));
  });
});

describe('LoginPage redirects', () => {
  test('successful login navigates with router.replace and not push', async () => {
    const harness = createPageHarness();
    const element = harness.renderElement();
    const form = findElementByType(element, 'form');
    const submitHandler = form?.props?.onSubmit;
    assert.ok(submitHandler, 'expected login form onSubmit handler');

    await submitHandler({
      preventDefault: () => undefined,
    });

    assert.deepEqual(harness.replaceCalls, ['/en/app']);
    assert.deepEqual(harness.pushCalls, []);
  });

  test('auth guard redirects authenticated user on mount', async () => {
    const harness = createPageHarness({
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ id: 'user-123' }),
      }),
    });

    harness.renderPage();
    await harness.runEffects();

    assert.deepEqual(harness.replaceCalls, ['/en/app']);
  });

  test('auth guard does not redirect unauthenticated user', async () => {
    const harness = createPageHarness({
      fetchImpl: async () => ({
        ok: false,
        json: async () => ({}),
      }),
    });

    harness.renderPage();
    await harness.runEffects();

    assert.deepEqual(harness.replaceCalls, []);
  });

  test('fetch failure keeps login form visible', async () => {
    const harness = createPageHarness({
      fetchImpl: async () => {
        throw new Error('network failure');
      },
    });

    const html = harness.renderPage();
    await harness.runEffects();

    assert.match(html, /login\.title/);
    assert.deepEqual(harness.replaceCalls, []);
  });
});
