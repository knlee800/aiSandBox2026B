import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

describe('DESIGN-GAPS-01 slice A', () => {
  test('auth page titles use font-semibold', () => {
    for (const page of ['login', 'register', 'forgot-password', 'reset-password']) {
      const source = read(`../../app/[locale]/${page}/page.tsx`);
      assert.match(source, /text-2xl font-semibold/, page);
      assert.doesNotMatch(source, /text-2xl font-bold/, page);
    }
  });

  test('forgot and reset auth cards match login and register', () => {
    for (const page of ['login', 'register', 'forgot-password', 'reset-password']) {
      const source = read(`../../app/[locale]/${page}/page.tsx`);
      assert.match(source, /rounded-xl border border-border bg-surface-base[^"]*shadow-lg/, page);
    }
    for (const page of ['forgot-password', 'reset-password']) {
      const source = read(`../../app/[locale]/${page}/page.tsx`);
      assert.doesNotMatch(source, /p-8 shadow-md/, page);
    }
  });

  test('mobile sidebar toggle uses a Heroicon, not an inline SVG', () => {
    const source = read('./workspace-shell.tsx');
    assert.match(source, /Bars3Icon/);
    assert.match(source, /data-testid="workspace-sidebar-mobile-toggle"\s+aria-label=\{workspaceMessages\.openSidebar\}\s*>\s*<Bars3Icon/);
    assert.doesNotMatch(source, /M3 5H17/);
  });

  test('tab orientation toggle uses Heroicons, not text glyphs', () => {
    const source = read('./workspace-tab-bar.tsx');
    assert.match(source, /ArrowsRightLeftIcon/);
    assert.match(source, /ArrowsUpDownIcon/);
    assert.doesNotMatch(source, /[⇔⇕]/);
    assert.match(source, /workspace-tab-orientation-toggle/);
  });
});
