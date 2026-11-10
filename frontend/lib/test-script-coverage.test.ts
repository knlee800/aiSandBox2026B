import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

// Guard: every *.test.ts / *.test.tsx file under frontend/ must be matched by a
// glob in the "test" script of package.json, or `npm test` silently skips it.
// The runner expands the globs with Node's glob rules: `*` does not cross `/`
// and `[...]` is a character class, so a literal `app/[locale]/...` matches nothing.

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const SKIPPED_DIRS = new Set(['node_modules', '.next', 'out', 'dist', 'build', 'coverage', '.git', '.turbo']);
const TEST_PREFIX = 'tsx --test ';

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

function readTestGlobs(): string[] {
  const pkg = JSON.parse(readFileSync(path.join(FRONTEND_ROOT, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const script = pkg.scripts?.test ?? '';
  const index = script.indexOf(TEST_PREFIX);
  assert.notEqual(index, -1, `the "test" script must contain "${TEST_PREFIX.trim()}"`);
  return script
    .slice(index + TEST_PREFIX.length)
    .split(/\s+/)
    .filter(Boolean);
}

function findTestFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) findTestFiles(path.join(dir, entry.name), out);
    } else if (/\.test\.tsx?$/.test(entry.name)) {
      out.push(toPosix(path.relative(FRONTEND_ROOT, path.join(dir, entry.name))));
    }
  }
  return out;
}

function matchedByAny(file: string, globs: string[]): boolean {
  return globs.some((glob) => path.posix.matchesGlob(file, glob));
}

describe('test-script-coverage', () => {
  test('the test script has globs', () => {
    assert.ok(readTestGlobs().length > 0);
  });

  test('every test file is matched by a glob in the test script', () => {
    const globs = readTestGlobs();
    const files = findTestFiles(FRONTEND_ROOT).sort();
    assert.ok(files.length > 0, 'expected to find test files');
    const missed = files.filter((file) => !matchedByAny(file, globs));
    assert.deepEqual(
      missed,
      [],
      `test files matched by no glob in the "test" script (npm test would skip them):\n${missed.join('\n')}`,
    );
  });

  test('this test file is itself matched', () => {
    assert.ok(matchedByAny('lib/test-script-coverage.test.ts', readTestGlobs()));
  });

  test('a literal [locale] glob does not match its own path (the trap), a wildcard does', () => {
    assert.equal(path.posix.matchesGlob('app/[locale]/x.test.ts', 'app/[locale]/x.test.ts'), false);
    assert.equal(path.posix.matchesGlob('app/[locale]/x.test.ts', 'app/*/x.test.ts'), true);
  });

  test('* does not cross a slash', () => {
    assert.equal(path.posix.matchesGlob('lib/a/b.test.ts', 'lib/*.test.ts'), false);
    assert.equal(path.posix.matchesGlob('lib/b.test.ts', 'lib/*.test.ts'), true);
  });
});
