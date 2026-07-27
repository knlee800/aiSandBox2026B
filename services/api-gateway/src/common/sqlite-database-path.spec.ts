import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';
import {
  ensureSqliteDatabaseDirectory,
  findRepoRoot,
  prepareSqliteDatabasePath,
  resolveSqliteDatabasePath,
} from './sqlite-database-path';

describe('sqlite-database-path (PRIVATE-BETA-STAGING-EXECUTION-04D1)', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'api-gw-sqlite-path-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  function createFakeRepo(): {
    repoRoot: string;
    apiGatewayCwd: string;
    expectedDbPath: string;
    brokenCompiledDbPath: string;
  } {
    const repoRoot = path.join(tempRoot, 'aisandbox');
    const apiGatewayCwd = path.join(repoRoot, 'services', 'api-gateway');
    fs.mkdirSync(apiGatewayCwd, { recursive: true });
    fs.writeFileSync(
      path.join(apiGatewayCwd, 'package.json'),
      JSON.stringify({ name: '@aisandbox/api-gateway' }),
    );

    // Simulate compiled layout depth without using it for resolution.
    fs.mkdirSync(path.join(apiGatewayCwd, 'dist', 'src', 'admin'), {
      recursive: true,
    });

    return {
      repoRoot,
      apiGatewayCwd,
      expectedDbPath: path.join(repoRoot, 'database', 'aisandbox.db'),
      brokenCompiledDbPath: path.join(
        repoRoot,
        'services',
        'database',
        'aisandbox.db',
      ),
    };
  }

  it('finds repo root from api-gateway cwd (PM2 --cwd contract)', () => {
    const { repoRoot, apiGatewayCwd } = createFakeRepo();
    expect(findRepoRoot(apiGatewayCwd)).toBe(repoRoot);
  });

  it('resolves repo-root database/aisandbox.db, not services/database', () => {
    const { apiGatewayCwd, expectedDbPath, brokenCompiledDbPath } =
      createFakeRepo();

    const resolved = resolveSqliteDatabasePath(apiGatewayCwd);

    expect(resolved).toBe(expectedDbPath);
    expect(resolved).not.toBe(brokenCompiledDbPath);
    expect(resolved.includes(`${path.sep}dist${path.sep}`)).toBe(false);
  });

  it('resolves the same path when started from repo root cwd', () => {
    const { repoRoot, expectedDbPath } = createFakeRepo();
    expect(resolveSqliteDatabasePath(repoRoot)).toBe(expectedDbPath);
  });

  it('falls back to ../../database when repo marker is absent', () => {
    const orphanCwd = path.join(tempRoot, 'orphan-service');
    fs.mkdirSync(orphanCwd, { recursive: true });

    const resolved = resolveSqliteDatabasePath(orphanCwd);
    const expected = path.resolve(orphanCwd, '..', '..', 'database', 'aisandbox.db');

    expect(resolved).toBe(expected);
  });

  it('creates the missing SQLite parent directory', () => {
    const { expectedDbPath } = createFakeRepo();
    const parentDir = path.dirname(expectedDbPath);

    expect(fs.existsSync(parentDir)).toBe(false);

    const ensured = ensureSqliteDatabaseDirectory(expectedDbPath);

    expect(ensured).toBe(path.resolve(parentDir));
    expect(fs.existsSync(parentDir)).toBe(true);
  });

  it('prepareSqliteDatabasePath creates parent dir and allows better-sqlite3 open', () => {
    const { apiGatewayCwd, expectedDbPath, brokenCompiledDbPath } =
      createFakeRepo();

    expect(fs.existsSync(path.dirname(expectedDbPath))).toBe(false);
    expect(fs.existsSync(path.dirname(brokenCompiledDbPath))).toBe(false);

    const prepared = prepareSqliteDatabasePath(apiGatewayCwd);

    expect(prepared).toBe(expectedDbPath);
    expect(fs.existsSync(path.dirname(prepared))).toBe(true);

    const db = new Database(prepared);
    try {
      db.exec('SELECT 1');
    } finally {
      db.close();
    }

    expect(fs.existsSync(prepared)).toBe(true);
    expect(fs.existsSync(brokenCompiledDbPath)).toBe(false);
  });
});
