import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AUTH_TEMPLATES_V1 } from './auth-template-registry';

const REQUIRED_DEPENDENCIES = [
  'next-auth',
  '@auth/prisma-adapter',
  '@prisma/client',
  'prisma',
  'bcryptjs',
  '@types/bcryptjs',
] as const;

const REQUIRED_FILES = [
  'auth.ts',
  'auth.config.ts',
  'app/api/auth/[...nextauth]/route.ts',
  'middleware.ts',
  'prisma/schema.prisma',
  'app/(auth)/login/page.tsx',
  'app/(auth)/register/page.tsx',
  'app/(auth)/layout.tsx',
  'components/auth/login-form.tsx',
  'components/auth/register-form.tsx',
  'components/auth/logout-button.tsx',
  'components/auth/auth-provider.tsx',
  'lib/auth-actions.ts',
  '.env.example',
  'SETUP-AUTH.md',
] as const;

const FORBIDDEN_PLATFORM_TOKENS = [
  'aisandbox_session',
  'aisandbox_csrf',
  'X-Internal-Service-Key',
  'SessionCookieGuard',
  'CsrfGuard',
  'PreviewOwnershipGuard',
  'aisandbox_oauth_state',
] as const;

function isSafeRelativePath(path: string): boolean {
  if (!path || path.startsWith('/')) return false;
  if (path.includes('\\')) return false;
  if (/^[A-Za-z]:/.test(path)) return false;
  if (path.includes('\0')) return false;

  const segments = path.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return false;
  }
  return true;
}

describe('auth template registry foundation', () => {
  test('registry has exactly one v1 template', () => {
    assert.equal(AUTH_TEMPLATES_V1.length, 1);
  });

  test('template id, version, and name are present', () => {
    const [template] = AUTH_TEMPLATES_V1;
    assert.ok(template.metadata.id.trim().length > 0);
    assert.ok(template.metadata.version.trim().length > 0);
    assert.ok(template.metadata.name.trim().length > 0);
  });

  test('dependency manifest includes required auth starter packages', () => {
    const [template] = AUTH_TEMPLATES_V1;
    const dependencyNames = new Set(template.manifest.dependencies.map((dep) => dep.name));

    for (const dependency of REQUIRED_DEPENDENCIES) {
      assert.equal(
        dependencyNames.has(dependency),
        true,
        `Expected dependency manifest to include ${dependency}`,
      );
    }
  });

  test('all template file paths are relative and safe', () => {
    const [template] = AUTH_TEMPLATES_V1;
    for (const file of template.files) {
      assert.equal(
        isSafeRelativePath(file.path),
        true,
        `Unsafe path found in manifest: ${file.path}`,
      );
    }
  });

  test('required files exist in file manifest', () => {
    const [template] = AUTH_TEMPLATES_V1;
    const filePaths = new Set(template.manifest.filePaths);
    for (const requiredFile of REQUIRED_FILES) {
      assert.equal(filePaths.has(requiredFile), true, `Missing required file: ${requiredFile}`);
    }
  });

  test('env var manifest includes AUTH_SECRET and DATABASE_URL', () => {
    const [template] = AUTH_TEMPLATES_V1;
    const envNames = new Set(template.manifest.env.map((envVar) => envVar.name));
    assert.equal(envNames.has('AUTH_SECRET'), true);
    assert.equal(envNames.has('DATABASE_URL'), true);
  });

  test('template contents do not include platform auth/session tokens or guard names', () => {
    const [template] = AUTH_TEMPLATES_V1;
    const combinedContents = template.files.map((file) => file.content).join('\n');
    for (const forbiddenToken of FORBIDDEN_PLATFORM_TOKENS) {
      assert.equal(
        combinedContents.includes(forbiddenToken),
        false,
        `Template content must not include ${forbiddenToken}`,
      );
    }
  });

  test('template content references Auth.js / NextAuth, not platform auth implementation', () => {
    const [template] = AUTH_TEMPLATES_V1;
    const combinedContents = template.files.map((file) => file.content).join('\n');
    assert.match(combinedContents, /(Auth\.js|NextAuth|next-auth)/i);
  });
});
