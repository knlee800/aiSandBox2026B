import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();

test('start-all.ps1 uses HTTP health check for frontend, not just TCP', () => {
  const ps1 = readFileSync(join(repoRoot, 'scripts', 'start-all.ps1'), 'utf8');

  assert.match(
    ps1,
    /Test-FrontendHttp/,
    'must define and use an HTTP-based frontend health check function',
  );
  assert.match(
    ps1,
    /Invoke-WebRequest.*localhost:3002/,
    'HTTP health check must probe localhost:3002',
  );
  assert.match(
    ps1,
    /Wait-ForFrontendHttp/,
    'must use HTTP readiness wait for frontend startup',
  );
  assert.match(
    ps1,
    /degraded/i,
    'must detect degraded frontend state (port open but HTTP unresponsive)',
  );
  assert.match(
    ps1,
    /\.next/,
    'must clean .next cache when recycling a degraded process',
  );
});

test('start-all.sh uses HTTP health check for frontend, not just TCP', () => {
  const sh = readFileSync(join(repoRoot, 'scripts', 'start-all.sh'), 'utf8');

  assert.match(
    sh,
    /test_frontend_http/,
    'must define and use an HTTP-based frontend health check function',
  );
  assert.match(
    sh,
    /curl.*localhost:3002/,
    'HTTP health check must probe localhost:3002 via curl',
  );
  assert.match(
    sh,
    /wait_for_frontend_http/,
    'must use HTTP readiness wait for frontend startup',
  );
  assert.match(
    sh,
    /degraded/i,
    'must detect degraded frontend state (port open but HTTP unresponsive)',
  );
  assert.match(
    sh,
    /\.next/,
    'must clean .next cache when recycling a degraded process',
  );
});

test('start-all.ps1 still references port 3002 for frontend', () => {
  const ps1 = readFileSync(join(repoRoot, 'scripts', 'start-all.ps1'), 'utf8');
  assert.match(ps1, /3002/, 'must reference port 3002 for frontend');
  assert.match(ps1, /http:\/\/localhost:3002/, 'must use http://localhost:3002');
});

test('start-all.sh still references port 3002 for frontend', () => {
  const sh = readFileSync(join(repoRoot, 'scripts', 'start-all.sh'), 'utf8');
  assert.match(sh, /3002/, 'must reference port 3002 for frontend');
  assert.match(sh, /http:\/\/localhost:3002/, 'must use http://localhost:3002');
});

test('frontend dev script remains pinned to port 3002', () => {
  const pkg = JSON.parse(
    readFileSync(join(repoRoot, 'frontend', 'package.json'), 'utf8'),
  );
  assert.equal(
    pkg.scripts.dev,
    'next dev -p 3002',
    'frontend dev script must remain on validation port 3002',
  );
});
