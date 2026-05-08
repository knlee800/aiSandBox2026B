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

function createResetPasswordHarness(options?: {
  search?: string;
  rejectStatus?: number;
}) {
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
      if (options?.rejectStatus) {
        throw {
          response: {
            status: options.rejectStatus,
          },
        };
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
        useSearchParams: () => new URLSearchParams(options?.search ?? ''),
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

  delete require.cache[require.resolve('../../app/[locale]/reset-password/page.tsx')];
  const Page = require('../../app/[locale]/reset-password/page.tsx').default;

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
  delete require.cache[require.resolve('../../app/[locale]/reset-password/page.tsx')];
  (globalThis as typeof globalThis & { React?: unknown }).React = originalReactGlobal;
});

describe('ResetPasswordPage', () => {
  test('shows invalid-or-expired state when token is missing', () => {
    (globalThis as typeof globalThis & { React?: unknown }).React = React;
    const harness = createResetPasswordHarness({ search: '' });

    const html = harness.renderHtml();
    assert.match(html, /errors\.tokenExpired/);
    assert.match(html, /href="\/en\/forgot-password"/);
  });

  test('blocks mismatched passwords on client side', async () => {
    (globalThis as typeof globalThis & { React?: unknown }).React = React;
    const harness = createResetPasswordHarness({ search: 'token=abc123' });

    let tree = harness.renderTree();
    const newPasswordInput = findElement(tree, (element) => element.type === 'input' && element.props?.id === 'new-password');
    const confirmPasswordInput = findElement(
      tree,
      (element) => element.type === 'input' && element.props?.id === 'confirm-password',
    );
    assert.ok(newPasswordInput);
    assert.ok(confirmPasswordInput);
    newPasswordInput.props.onChange({ target: { value: 'password123' } });
    confirmPasswordInput.props.onChange({ target: { value: 'password456' } });

    tree = harness.renderTree();
    const form = findElement(tree, (element) => element.type === 'form');
    assert.ok(form);
    await form.props.onSubmit({ preventDefault: () => undefined });

    assert.equal(harness.getAxiosCalls().length, 0);
    const html = harness.renderHtml();
    assert.match(html, /resetPassword\.passwordMismatch/);
  });

  test('blocks short password on client side', async () => {
    (globalThis as typeof globalThis & { React?: unknown }).React = React;
    const harness = createResetPasswordHarness({ search: 'token=abc123' });

    let tree = harness.renderTree();
    const newPasswordInput = findElement(tree, (element) => element.type === 'input' && element.props?.id === 'new-password');
    const confirmPasswordInput = findElement(
      tree,
      (element) => element.type === 'input' && element.props?.id === 'confirm-password',
    );
    assert.ok(newPasswordInput);
    assert.ok(confirmPasswordInput);
    newPasswordInput.props.onChange({ target: { value: '12345' } });
    confirmPasswordInput.props.onChange({ target: { value: '12345' } });

    tree = harness.renderTree();
    const form = findElement(tree, (element) => element.type === 'form');
    assert.ok(form);
    await form.props.onSubmit({ preventDefault: () => undefined });

    assert.equal(harness.getAxiosCalls().length, 0);
    const html = harness.renderHtml();
    assert.match(html, /resetPassword\.passwordTooShort/);
  });

  test('submits valid reset request and shows success state', async () => {
    (globalThis as typeof globalThis & { React?: unknown }).React = React;
    const harness = createResetPasswordHarness({ search: 'token=valid-token' });

    let tree = harness.renderTree();
    const newPasswordInput = findElement(tree, (element) => element.type === 'input' && element.props?.id === 'new-password');
    const confirmPasswordInput = findElement(
      tree,
      (element) => element.type === 'input' && element.props?.id === 'confirm-password',
    );
    assert.ok(newPasswordInput);
    assert.ok(confirmPasswordInput);
    newPasswordInput.props.onChange({ target: { value: 'password123' } });
    confirmPasswordInput.props.onChange({ target: { value: 'password123' } });

    tree = harness.renderTree();
    const form = findElement(tree, (element) => element.type === 'form');
    assert.ok(form);
    await form.props.onSubmit({ preventDefault: () => undefined });

    const calls = harness.getAxiosCalls();
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], '/api/auth/password-reset/confirm');
    assert.deepEqual(calls[0][1], { token: 'valid-token', newPassword: 'password123' });
    assert.equal(calls[0][2]?.headers?.['Accept-Language'], 'en');

    const html = harness.renderHtml();
    assert.match(html, /resetPassword\.successMessage/);
  });

  test('shows token-expired state for API 400/401 failures', async () => {
    (globalThis as typeof globalThis & { React?: unknown }).React = React;
    const harness = createResetPasswordHarness({
      search: 'token=expired-token',
      rejectStatus: 400,
    });

    let tree = harness.renderTree();
    const newPasswordInput = findElement(tree, (element) => element.type === 'input' && element.props?.id === 'new-password');
    const confirmPasswordInput = findElement(
      tree,
      (element) => element.type === 'input' && element.props?.id === 'confirm-password',
    );
    assert.ok(newPasswordInput);
    assert.ok(confirmPasswordInput);
    newPasswordInput.props.onChange({ target: { value: 'password123' } });
    confirmPasswordInput.props.onChange({ target: { value: 'password123' } });

    tree = harness.renderTree();
    const form = findElement(tree, (element) => element.type === 'form');
    assert.ok(form);
    await form.props.onSubmit({ preventDefault: () => undefined });

    const html = harness.renderHtml();
    assert.match(html, /errors\.tokenExpired/);
  });
});
