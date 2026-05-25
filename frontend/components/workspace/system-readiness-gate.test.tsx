import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SystemReadiness from '../SystemReadiness';

const processEnv = process.env as Record<string, string | undefined>;
const originalNodeEnv = processEnv.NODE_ENV;
const originalShowDevTools = processEnv.NEXT_PUBLIC_SHOW_DEV_TOOLS;
const reactGlobal = globalThis as typeof globalThis & { React?: unknown };
const originalReactGlobal = reactGlobal.React;

function renderSystemReadiness(): string {
  return renderToStaticMarkup(React.createElement(SystemReadiness));
}

afterEach(() => {
  if (typeof originalNodeEnv === 'undefined') {
    delete processEnv.NODE_ENV;
  } else {
    processEnv.NODE_ENV = originalNodeEnv;
  }

  if (typeof originalShowDevTools === 'undefined') {
    delete processEnv.NEXT_PUBLIC_SHOW_DEV_TOOLS;
  } else {
    processEnv.NEXT_PUBLIC_SHOW_DEV_TOOLS = originalShowDevTools;
  }

  reactGlobal.React = originalReactGlobal;
});

beforeEach(() => {
  reactGlobal.React = React;
});

describe('SystemReadiness developer controls gate', () => {
  test('does not render in non-development when flag is not true', () => {
    processEnv.NODE_ENV = 'test';
    delete processEnv.NEXT_PUBLIC_SHOW_DEV_TOOLS;

    const html = renderSystemReadiness();
    assert.equal(html, '');
  });

  test('renders when NEXT_PUBLIC_SHOW_DEV_TOOLS is true', () => {
    processEnv.NODE_ENV = 'production';
    processEnv.NEXT_PUBLIC_SHOW_DEV_TOOLS = 'true';

    const html = renderSystemReadiness();
    assert.match(html, /Checking System\.\.\./);
  });

  test('renders in development without the public flag', () => {
    processEnv.NODE_ENV = 'development';
    delete processEnv.NEXT_PUBLIC_SHOW_DEV_TOOLS;

    const html = renderSystemReadiness();
    assert.match(html, /Checking System\.\.\./);
  });
});
