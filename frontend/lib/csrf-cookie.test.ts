import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { CSRF_COOKIE_NAMES, readCookieValue, readCsrfCookie } from './csrf-cookie';

// COOKIE-PREFIX-01: one CSRF cookie reader for the four call sites.
describe('readCsrfCookie (COOKIE-PREFIX-01)', () => {
  test('tries __Host-aisandbox_csrf first, then aisandbox_csrf', () => {
    assert.deepEqual([...CSRF_COOKIE_NAMES], ['__Host-aisandbox_csrf', 'aisandbox_csrf']);
    assert.equal(readCsrfCookie('aisandbox_csrf=old; __Host-aisandbox_csrf=new'), 'new');
    assert.equal(readCsrfCookie('__Host-aisandbox_csrf=new; aisandbox_csrf=old'), 'new');
  });

  test('uses the old name when it is alone', () => {
    assert.equal(readCsrfCookie('theme=dark; aisandbox_csrf=old'), 'old');
  });

  test('ignores names that only contain or extend a CSRF name', () => {
    assert.equal(readCsrfCookie('x__Host-aisandbox_csrf=planted'), null);
    assert.equal(readCsrfCookie('x_aisandbox_csrf=planted; aisandbox_csrfx=planted'), null);
    assert.equal(readCsrfCookie('x__Host-aisandbox_csrf=planted; aisandbox_csrf=old'), 'old');
  });

  test('gives null with no cookie, an empty value, or no document', () => {
    assert.equal(readCsrfCookie(''), null);
    assert.equal(readCsrfCookie('theme=dark'), null);
    assert.equal(readCsrfCookie('__Host-aisandbox_csrf='), null);
    assert.equal(readCsrfCookie('__Host-aisandbox_csrf=; aisandbox_csrf=old'), 'old');
    assert.equal(typeof document, 'undefined');
    assert.equal(readCsrfCookie(), null);
  });

  test('reads document.cookie by default', () => {
    const holder = globalThis as { document?: { cookie: string } };
    holder.document = { cookie: 'aisandbox_csrf=old; __Host-aisandbox_csrf=from-document' };
    try {
      assert.equal(readCsrfCookie(), 'from-document');
    } finally {
      delete holder.document;
    }
  });

  test('readCookieValue matches the exact name and trims spaces', () => {
    assert.equal(readCookieValue(' a = 1 ;b=2', 'a'), '1');
    assert.equal(readCookieValue('ab=1', 'a'), null);
    assert.equal(readCookieValue('a', 'a'), null);
  });

  test('the four call sites use the shared reader and no local cookie parse', () => {
    const files = [
      '../app/[locale]/app/page.tsx',
      '../components/auth/logout-button.tsx',
      '../components/knowledge/knowledge-api.ts',
      './collaboration/api.ts',
    ];
    for (const file of files) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      assert.match(source, /import \{ readCsrfCookie \} from '[^']*lib\/csrf-cookie'|from '\.\.\/csrf-cookie'/, file);
      assert.match(source, /return readCsrfCookie\(\);/, file);
      assert.doesNotMatch(source, /aisandbox_csrf=/, file);
      assert.doesNotMatch(source, /document\.cookie/, file);
    }
  });
});
