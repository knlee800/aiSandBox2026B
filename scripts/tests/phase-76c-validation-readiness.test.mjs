import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();

test('frontend dev script is pinned to validation port 3002', () => {
  const frontendPackagePath = join(repoRoot, 'frontend', 'package.json');
  const frontendPackage = JSON.parse(readFileSync(frontendPackagePath, 'utf8'));

  assert.equal(
    frontendPackage.scripts.dev,
    'next dev -p 3002',
    'frontend dev script must keep deterministic validation port 3002',
  );
});

test('startup scripts reference frontend readiness on port 3002', () => {
  const startAllPs1 = readFileSync(join(repoRoot, 'scripts', 'start-all.ps1'), 'utf8');
  const startAllSh = readFileSync(join(repoRoot, 'scripts', 'start-all.sh'), 'utf8');

  assert.match(startAllPs1, /Test-Port 3002/);
  assert.match(startAllPs1, /http:\/\/localhost:3002/);

  assert.match(startAllSh, /test_port 3002/);
  assert.match(startAllSh, /http:\/\/localhost:3002/);
});

test('phase 76c readiness verifier covers required positive paths', () => {
  const verifier = readFileSync(
    join(repoRoot, 'scripts', 'verify-phase-76c-readiness.ps1'),
    'utf8',
  );

  assert.match(verifier, /\/api\/auth\/login/);
  assert.match(verifier, /\/api\/sessions/);
  assert.match(verifier, /\/api\/internal\/admin\/users/);
  assert.match(verifier, /X-Internal-Service-Key/);
});
