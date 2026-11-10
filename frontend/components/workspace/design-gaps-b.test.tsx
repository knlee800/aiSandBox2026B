import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, test } from 'node:test';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Spinner from '../ui/Spinner';
import enMessages from '../../messages/en.json';
import zhTwMessages from '../../messages/zh-TW.json';
import zhCnMessages from '../../messages/zh-CN.json';

const reactGlobal = globalThis as typeof globalThis & { React?: unknown };
reactGlobal.React = React;

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

function collectTsx(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue;
      collectTsx(full, found);
    } else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) {
      found.push(full);
    }
  }
  return found;
}

const frontendRoot = path.resolve(new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const sourceFiles = [
  ...collectTsx(path.join(frontendRoot, 'app')),
  ...collectTsx(path.join(frontendRoot, 'components')),
];

const PRIMARY_BUTTON_FILES = [
  '../workspace/workspace-shell.tsx',
  '../collaboration/collaboration-view.tsx',
  '../platform/platform-dashboard.tsx',
  '../platform/agent-detail-panel.tsx',
  '../platform/create-agent-form.tsx',
  '../office/office-desk-panel.tsx',
  '../knowledge/knowledge-screen.tsx',
  '../connections/connections-screen.tsx',
  '../billing/billing-topup-section.tsx',
  '../SystemReadiness.tsx',
  '../ErrorRemediation.tsx',
];

describe('DESIGN-GAPS-01B gap 1: one primary action color', () => {
  test('primary buttons use the declared brand token, not blue-600 or indigo-600/500', () => {
    for (const file of PRIMARY_BUTTON_FILES) {
      const source = read(file);
      assert.match(source, /bg-brand/, file);
      assert.doesNotMatch(source, /\bbg-blue-600\b|\bbg-indigo-600\b|hover:bg-blue-700|hover:bg-indigo-500|disabled:bg-blue-300/, file);
    }
  });

  test('send and start buttons keep the brand fill, hover and disabled state', () => {
    const shell = read('./workspace-shell.tsx');
    assert.match(
      shell,
      /rounded-lg bg-brand px-4 py-1\.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50/,
    );
    const collab = read('../collaboration/collaboration-view.tsx');
    assert.match(collab, /bg-brand px-4 py-1\.5 text-sm font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50/);
  });
});

describe('DESIGN-GAPS-01B gap 7: one success color', () => {
  test('no green-* utility remains in app or components', () => {
    for (const file of sourceFiles) {
      assert.doesNotMatch(readFileSync(file, 'utf8'), /\b(bg|text|border|ring)-green-\d/, file);
    }
  });

  test('the live dot and readiness chip use emerald', () => {
    assert.match(read('./workspace-shell.tsx'), /rounded-full bg-emerald-500/);
    assert.match(read('../SystemReadiness.tsx'), /bg-emerald-600/);
  });
});

describe('DESIGN-GAPS-01B gap 8: one focus style', () => {
  test('no focus ring uses indigo or blue utilities', () => {
    for (const file of sourceFiles) {
      assert.doesNotMatch(readFileSync(file, 'utf8'), /focus(-visible|-within)?:ring-(indigo|blue)-\d/, file);
    }
  });

  test('chat and collaboration textareas show a brand focus ring', () => {
    for (const file of ['./workspace-shell.tsx', '../collaboration/collaboration-view.tsx']) {
      const source = read(file);
      assert.match(source, /focus:border-brand focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/, file);
      assert.doesNotMatch(source, /focus:outline-none/, file);
    }
  });

  test('auth inputs use focus-visible with the brand ring', () => {
    for (const page of ['login', 'register', 'forgot-password', 'reset-password']) {
      const source = read(`../../app/[locale]/${page}/page.tsx`);
      assert.doesNotMatch(source, /focus:ring-2/, page);
    }
  });
});

describe('DESIGN-GAPS-01B gap 9: shared spinner', () => {
  test('renders an aria-hidden svg and a translated label when given', () => {
    const html = renderToStaticMarkup(<Spinner label="Loading..." />);
    assert.match(html, /<svg[^>]*aria-hidden="true"/);
    assert.match(html, /animate-spin/);
    assert.match(html, /motion-reduce:animate-none/);
    assert.match(html, /role="status"/);
    assert.match(html, /<span class="sr-only">Loading\.\.\.<\/span>/);
  });

  test('has no status role or label text when decorative', () => {
    const html = renderToStaticMarkup(<Spinner />);
    assert.doesNotMatch(html, /role="status"/);
    assert.doesNotMatch(html, /sr-only/);
  });

  test('replaces the pulsing gray dot in the shell loading rows', () => {
    const shell = read('./workspace-shell.tsx');
    assert.doesNotMatch(shell, /bg-gray-400 animate-pulse/);
    assert.match(shell, /import Spinner from '\.\.\/ui\/Spinner'/);
    assert.match(shell, /data-testid="history-project-list-loading"[\s\S]{0,200}<Spinner/);
    assert.match(shell, /data-testid="history-snapshot-list-loading"[\s\S]{0,200}<Spinner/);
  });
});

describe('DESIGN-GAPS-01B gap 13: collaboration selection', () => {
  test('selected run uses the brand border', () => {
    const source = read('../collaboration/collaboration-view.tsx');
    assert.match(source, /border-brand bg-indigo-50/);
    assert.doesNotMatch(source, /border-indigo-300/);
  });
});

describe('DESIGN-GAPS-01B slice A leftovers', () => {
  test('SystemReadiness and ConfigurationControl use Heroicons, not emoji', () => {
    for (const file of ['../SystemReadiness.tsx', '../ConfigurationControl.tsx']) {
      const source = read(file);
      assert.match(source, /@heroicons\/react\/24\/outline/, file);
      assert.doesNotMatch(source, /[✓⏳✗✕⚙❌⚠📖💡🔄]/u, file);
    }
    assert.doesNotMatch(read('../SystemReadiness.tsx'), /'✓ text-/);
  });

  test('tab orientation toggle and sidebar label come from messages', () => {
    const bar = read('./workspace-tab-bar.tsx');
    assert.doesNotMatch(bar, /'Horizontal tabs'|'Vertical tabs'/);
    assert.match(bar, /props\.horizontalTabsLabel/);
    const shell = read('./workspace-shell.tsx');
    assert.doesNotMatch(shell, /aria-label="Open sidebar"/);
    assert.match(shell, /tabMessages\.horizontalTabs/);
  });

  test('ConfigurationControl has no hardcoded English labels', () => {
    const source = read('../ConfigurationControl.tsx');
    for (const text of ['Runtime Configuration', 'Loading configuration', 'Retry', 'Show Instructions', 'Restart Required']) {
      assert.doesNotMatch(source, new RegExp(`>\\s*${text}`), text);
    }
    assert.match(source, /useTranslations\('configuration'\)/);
  });
});

describe('DESIGN-GAPS-01B message keys', () => {
  const configKeys = Object.keys(enMessages.configuration);

  test('workspace, tabs and configuration keys exist in all three locales', () => {
    for (const messages of [enMessages, zhTwMessages, zhCnMessages]) {
      assert.equal(typeof messages.workspace.openSidebar, 'string');
      assert.equal(typeof messages.tabs.horizontalTabs, 'string');
      assert.equal(typeof messages.tabs.verticalTabs, 'string');
      assert.deepEqual(Object.keys(messages.configuration), configKeys);
    }
  });

  test('zh-TW and zh-CN are translated, not copies of English', () => {
    for (const messages of [zhTwMessages, zhCnMessages]) {
      assert.notEqual(messages.workspace.openSidebar, enMessages.workspace.openSidebar);
      assert.notEqual(messages.tabs.horizontalTabs, enMessages.tabs.horizontalTabs);
      assert.notEqual(messages.configuration.title, enMessages.configuration.title);
      assert.notEqual(messages.configuration.loading, enMessages.configuration.loading);
    }
  });
});
