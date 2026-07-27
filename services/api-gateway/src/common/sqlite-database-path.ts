import * as fs from 'fs';
import * as path from 'path';

const SQLITE_DB_DIRNAME = 'database';
const SQLITE_DB_FILENAME = 'aisandbox.db';
const REPO_ROOT_MARKER = path.join('services', 'api-gateway', 'package.json');
const MAX_WALK_DEPTH = 8;

/**
 * Locate the monorepo root by walking upward from cwd until
 * `services/api-gateway/package.json` is found.
 *
 * Intentionally does NOT use compiled `__dirname` depth — Nest emits
 * `dist/src/...`, so `../../../..` from `dist/src/admin` resolves to
 * `services/database` instead of repo-root `database`.
 */
export function findRepoRoot(startDir: string): string | null {
  let current = path.resolve(startDir);

  for (let i = 0; i < MAX_WALK_DEPTH; i++) {
    if (fs.existsSync(path.join(current, REPO_ROOT_MARKER))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return null;
}

/**
 * Resolve `<repo-root>/database/aisandbox.db` for API Gateway runtime.
 *
 * Prefer walking from `process.cwd()` (PM2 starts with
 * `--cwd .../services/api-gateway`). Fallback assumes cwd is the
 * api-gateway package directory and uses `../../database/aisandbox.db`.
 */
export function resolveSqliteDatabasePath(cwd: string = process.cwd()): string {
  const repoRoot = findRepoRoot(cwd);
  if (repoRoot) {
    return path.join(repoRoot, SQLITE_DB_DIRNAME, SQLITE_DB_FILENAME);
  }

  return path.resolve(cwd, '..', '..', SQLITE_DB_DIRNAME, SQLITE_DB_FILENAME);
}

/**
 * Ensure the SQLite parent directory exists before `new Database(dbPath)`.
 * better-sqlite3 throws if the parent directory is missing.
 */
export function ensureSqliteDatabaseDirectory(dbPath: string): string {
  const directory = path.dirname(path.resolve(dbPath));
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

/**
 * Resolve the repo-root SQLite path and ensure its parent directory exists.
 */
export function prepareSqliteDatabasePath(cwd: string = process.cwd()): string {
  const dbPath = resolveSqliteDatabasePath(cwd);
  ensureSqliteDatabaseDirectory(dbPath);
  return dbPath;
}
