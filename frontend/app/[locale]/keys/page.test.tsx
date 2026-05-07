import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const React = require('react');
const originalLoad = Module._load;
const originalFetch = globalThis.fetch;
const originalReactGlobal = (globalThis as typeof globalThis & { React?: unknown }).React;

type FetchMock = (input: string) => Promise<Response>;

async function flushAsyncWork(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function createPageHarness(push: (path: string) => void) {
  const stateStore: unknown[] = [];
  const effectDepsStore: Array<readonly unknown[] | undefined> = [];
  const router = { push };
  let stateIndex = 0;
  let effectIndex = 0;
  let stateUpdated = false;

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
        const resolvedValue =
          typeof nextValue === 'function'
            ? (nextValue as (previousValue: T) => T)(previousValue)
            : nextValue;

        if (!Object.is(previousValue, resolvedValue)) {
          stateStore[currentIndex] = resolvedValue;
          stateUpdated = true;
        }
      };

      return [stateStore[currentIndex] as T, setState] as const;
    },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const currentIndex = effectIndex;
      effectIndex += 1;

      const previousDeps = effectDepsStore[currentIndex];
      const depsChanged =
        !previousDeps ||
        !deps ||
        previousDeps.length !== deps.length ||
        deps.some((dependency, dependencyIndex) => !Object.is(dependency, previousDeps[dependencyIndex]));

      if (depsChanged) {
        effectDepsStore[currentIndex] = deps;
        void effect();
      }
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
      };
    }

    if (request === '@/components/ErrorRemediation') {
      return {
        __esModule: true,
        default: () => null,
        createErrorContext: (error: unknown) => error,
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[require.resolve('./page.tsx')];
  const Page = require('./page.tsx').default;

  return async function renderPage(): Promise<string> {
    let html = '';

    for (let renderCount = 0; renderCount < 6; renderCount += 1) {
      stateUpdated = false;
      stateIndex = 0;
      effectIndex = 0;
      html = renderToStaticMarkup(React.createElement(Page));
      await flushAsyncWork();

      if (!stateUpdated) {
        return html;
      }
    }

    return html;
  };
}

async function renderKeysPage(options: {
  fetchMock: FetchMock;
}): Promise<{ html: string; pushCalls: string[] }> {
  const pushCalls: string[] = [];

  (globalThis as typeof globalThis & { React?: unknown }).React = React;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const resolvedInput =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    return options.fetchMock(resolvedInput);
  }) as typeof fetch;

  const renderPage = createPageHarness((path: string) => {
    pushCalls.push(path);
  });

  const html = await renderPage();

  return { html, pushCalls };
}

afterEach(() => {
  Module._load = originalLoad;
  delete require.cache[require.resolve('./page.tsx')];
  globalThis.fetch = originalFetch;
  (globalThis as typeof globalThis & { React?: unknown }).React = originalReactGlobal;
});

async function assertRedirectsWhenAuthCheckFails(): Promise<void> {
  const fetchCalls: string[] = [];
  const { pushCalls } = await renderKeysPage({
    fetchMock: async (input) => {
      fetchCalls.push(input);

      if (input === '/api/auth/me') {
        return {
          ok: false,
          status: 401,
          json: async () => ({}),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${input}`);
    },
  });

  assert.deepEqual(fetchCalls, ['/api/auth/me']);
  assert.deepEqual(pushCalls, ['/en/login']);
}

async function assertRedirectsWhenAuthResponseHasNoValidId(): Promise<void> {
  const fetchCalls: string[] = [];
  const { pushCalls } = await renderKeysPage({
    fetchMock: async (input) => {
      fetchCalls.push(input);

      if (input === '/api/auth/me') {
        return {
          ok: true,
          json: async () => ({}),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${input}`);
    },
  });

  assert.deepEqual(fetchCalls, ['/api/auth/me']);
  assert.deepEqual(pushCalls, ['/en/login']);
}

async function assertRendersKeyManagementSurfaceAfterSuccessfulBootstrap(): Promise<void> {
  const fetchCalls: string[] = [];
  const { html, pushCalls } = await renderKeysPage({
    fetchMock: async (input) => {
      fetchCalls.push(input);

      if (input === '/api/auth/me') {
        return {
          ok: true,
          json: async () => ({ id: 'user-1' }),
        } as Response;
      }

      if (input === '/api/keys') {
        return {
          ok: true,
          json: async () => [],
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${input}`);
    },
  });

  assert.deepEqual(fetchCalls, ['/api/auth/me', '/api/keys']);
  assert.deepEqual(pushCalls, []);
  assert.match(html, /API Key Management/);
  assert.match(html, /Create New API Key/);
  assert.match(html, /Your API Keys/);
  assert.ok(!html.includes('Loading...'));
}

describe('ApiKeysPage auth bootstrap', () => {
  test('redirects to login when /api/auth/me is not ok', async () => {
    await assertRedirectsWhenAuthCheckFails();
  });

  test('redirects to login when /api/auth/me returns an invalid user id', async () => {
    await assertRedirectsWhenAuthResponseHasNoValidId();
  });

  test('renders the key management surface after successful auth bootstrap', async () => {
    await assertRendersKeyManagementSurfaceAfterSuccessfulBootstrap();
  });
});
