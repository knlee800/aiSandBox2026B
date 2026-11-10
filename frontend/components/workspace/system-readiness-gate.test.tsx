import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SystemReadiness from '../SystemReadiness';
import { TranslationProvider } from '../TranslationProvider';
import enMessages from '../../messages/en.json';
import zhTwMessages from '../../messages/zh-TW.json';
import zhCnMessages from '../../messages/zh-CN.json';

const processEnv = process.env as Record<string, string | undefined>;
const originalNodeEnv = processEnv.NODE_ENV;
const originalShowDevTools = processEnv.NEXT_PUBLIC_SHOW_DEV_TOOLS;
const reactGlobal = globalThis as typeof globalThis & { React?: unknown };
const originalReactGlobal = reactGlobal.React;

function renderSystemReadiness(
  locale = 'en',
  messages: Record<string, unknown> = enMessages,
): string {
  return renderToStaticMarkup(
    <TranslationProvider locale={locale} messages={messages} fallbackMessages={enMessages}>
      <SystemReadiness />
    </TranslationProvider>,
  );
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

  test('renders translated copy in zh-TW and zh-CN, not English', () => {
    processEnv.NODE_ENV = 'development';
    delete processEnv.NEXT_PUBLIC_SHOW_DEV_TOOLS;

    const zhTw = renderSystemReadiness('zh-TW', zhTwMessages);
    assert.match(zhTw, /正在檢查系統\.\.\./);
    assert.doesNotMatch(zhTw, /Checking System/);
    const zhCn = renderSystemReadiness('zh-CN', zhCnMessages);
    assert.match(zhCn, /正在检查系统\.\.\./);
    assert.doesNotMatch(zhCn, /Checking System/);
  });

  test('systemReadiness keys exist in all three message files and differ from English', () => {
    const en = enMessages.systemReadiness as Record<string, string>;
    const zhTw = zhTwMessages.systemReadiness as Record<string, string>;
    const zhCn = zhCnMessages.systemReadiness as Record<string, string>;
    const keys = Object.keys(en);
    assert.ok(keys.length > 0);
    assert.deepEqual(Object.keys(zhTw).sort(), [...keys].sort());
    assert.deepEqual(Object.keys(zhCn).sort(), [...keys].sort());
    for (const key of ['statusReady', 'statusChecking', 'statusNotReady', 'config', 'recheckNow']) {
      assert.notEqual(zhTw[key], en[key]);
      assert.notEqual(zhCn[key], en[key]);
    }
  });

  test('SystemReadiness source has no hardcoded status copy', () => {
    const source = readFileSync(new URL('../SystemReadiness.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /'System Ready'|'Recheck Now'|>Config</);
    assert.match(source, /useTranslations\('systemReadiness'\)/);
  });
});
