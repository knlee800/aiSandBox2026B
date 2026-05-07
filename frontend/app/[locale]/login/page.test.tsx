import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const React = require('react');
const originalLoad = Module._load;
const originalReactGlobal = (globalThis as typeof globalThis & { React?: unknown }).React;

function createPageHarness(search: string) {
  const stateStore: unknown[] = [];
  const router = { push: () => undefined };
  let stateIndex = 0;

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
        default: { post: async () => ({}) },
      };
    }

    if (request === '@/components/LanguageSwitcher') {
      return {
        __esModule: true,
        default: () => React.createElement('div', null),
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

  return function renderPage(): string {
    stateIndex = 0;
    return renderToStaticMarkup(React.createElement(Page));
  };
}

afterEach(() => {
  Module._load = originalLoad;
  delete require.cache[require.resolve('./page.tsx')];
  (globalThis as typeof globalThis & { React?: unknown }).React = originalReactGlobal;
});

function renderLoginPage(search: string): string {
  (globalThis as typeof globalThis & { React?: unknown }).React = React;
  const renderPage = createPageHarness(search);
  return renderPage();
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
