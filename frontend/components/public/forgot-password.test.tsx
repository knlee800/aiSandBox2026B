import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const React = require('react');
const originalLoad = Module._load;
const originalReactGlobal = (globalThis as typeof globalThis & { React?: unknown }).React;

type AxiosCall = [string, unknown, { headers?: Record<string, string> }?];

function resolveTree(node: any): any {
  if (Array.isArray(node)) {
    return node.map((entry) => resolveTree(entry));
  }

  if (!React.isValidElement(node)) {
    return node;
  }

  if (node.type === React.Suspense) {
    return resolveTree(node.props.children);
  }

  if (typeof node.type === 'function') {
    return resolveTree(node.type(node.props));
  }

  const children = node.props?.children;
  const resolvedChildren = Array.isArray(children)
    ? children.map((entry: any) => resolveTree(entry))
    : resolveTree(children);

  return React.cloneElement(node, { ...node.props }, resolvedChildren);
}

function findElement(node: any, matcher: (value: any) => boolean): any | null {
  if (Array.isArray(node)) {
    for (const entry of node) {
      const match = findElement(entry, matcher);
      if (match) {
        return match;
      }
    }
    return null;
  }

  if (!React.isValidElement(node)) {
    return null;
  }

  if (matcher(node)) {
    return node;
  }

  return findElement(node.props?.children, matcher);
}

function createForgotPasswordHarness(options?: { rejectRequest?: boolean }) {
  const stateStore: unknown[] = [];
  const axiosCalls: AxiosCall[] = [];
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

  const axiosMock = {
    post: async (url: string, data: unknown, config?: { headers?: Record<string, string> }) => {
      axiosCalls.push([url, data, config]);
      if (options?.rejectRequest) {
        throw new Error('Request failed');
      }
      return {};
    },
  };

  Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
    if (request === 'react') {
      return fakeReact;
    }

    if (request === 'next/navigation') {
      return {
        useParams: () => ({ locale: 'en' }),
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
        default: axiosMock,
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

  delete require.cache[require.resolve('../../app/[locale]/forgot-password/page.tsx')];
  const Page = require('../../app/[locale]/forgot-password/page.tsx').default;

  return {
    getAxiosCalls: () => axiosCalls,
    renderTree: () => {
      stateIndex = 0;
      return resolveTree(React.createElement(Page));
    },
    renderHtml: () => {
      stateIndex = 0;
      return renderToStaticMarkup(React.createElement(Page));
    },
  };
}

afterEach(() => {
  Module._load = originalLoad;
  delete require.cache[require.resolve('../../app/[locale]/forgot-password/page.tsx')];
  (globalThis as typeof globalThis & { React?: unknown }).React = originalReactGlobal;
});

describe('ForgotPasswordPage', () => {
  test('renders email form, submits reset request, and shows success state', async () => {
    (globalThis as typeof globalThis & { React?: unknown }).React = React;
    const harness = createForgotPasswordHarness();

    const initialHtml = harness.renderHtml();
    assert.match(initialHtml, /forgotPassword\.email/);
    assert.match(initialHtml, /forgotPassword\.submitButton/);

    let tree = harness.renderTree();
    const emailInput = findElement(
      tree,
      (element) => element.type === 'input' && element.props?.id === 'forgot-password-email',
    );
    assert.ok(emailInput);
    emailInput.props.onChange({ target: { value: 'reset-user@example.com' } });

    tree = harness.renderTree();
    const form = findElement(tree, (element) => element.type === 'form');
    assert.ok(form);
    await form.props.onSubmit({ preventDefault: () => undefined });

    const calls = harness.getAxiosCalls();
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], '/api/auth/password-reset/request');
    assert.deepEqual(calls[0][1], { email: 'reset-user@example.com' });
    assert.equal(calls[0][2]?.headers?.['Accept-Language'], 'en');

    const html = harness.renderHtml();
    assert.match(html, /forgotPassword\.sentMessage/);
  });

  test('handles rejected request gracefully', async () => {
    (globalThis as typeof globalThis & { React?: unknown }).React = React;
    const harness = createForgotPasswordHarness({ rejectRequest: true });

    let tree = harness.renderTree();
    const emailInput = findElement(
      tree,
      (element) => element.type === 'input' && element.props?.id === 'forgot-password-email',
    );
    assert.ok(emailInput);
    emailInput.props.onChange({ target: { value: 'reset-user@example.com' } });

    tree = harness.renderTree();
    const form = findElement(tree, (element) => element.type === 'form');
    assert.ok(form);
    await form.props.onSubmit({ preventDefault: () => undefined });

    const html = harness.renderHtml();
    assert.match(html, /errors\.network/);
  });
});
