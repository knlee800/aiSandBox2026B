import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { WorkspaceFileAction } from '../../components/workspace/workspace-ai-file-actions.logic';
import { detectAuthModuleEligibility } from './auth-module-detection';
import {
  AuthModuleGenerationError,
  generateAuthModuleFileActions,
} from './auth-module-generator';
import { AUTH_TEMPLATES_V1 } from './auth-template-registry';

const FORBIDDEN_PLATFORM_TOKENS = [
  'aisandbox_session',
  'aisandbox_csrf',
  'X-Internal-Service-Key',
  'SessionCookieGuard',
  'CsrfGuard',
  'PreviewOwnershipGuard',
  'aisandbox_oauth_state',
] as const;

function createPackageJson(params: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}): string {
  return JSON.stringify(
    {
      name: 'sample-app',
      private: true,
      version: '1.0.0',
      scripts: params.scripts ?? {},
      dependencies: params.dependencies ?? {},
      devDependencies: params.devDependencies ?? {},
    },
    null,
    2,
  );
}

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

function countPrismaModel(content: string, modelName: string): number {
  const pattern = new RegExp(`^\\s*model\\s+${modelName}\\s*\\{`, 'gm');
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

type WriteAction = Exclude<WorkspaceFileAction, { action: 'delete' }>;

function isWriteAction(action: WorkspaceFileAction): action is WriteAction {
  return action.action === 'create' || action.action === 'write' || action.action === 'update';
}

function getWriteActionByPath(
  actions: WorkspaceFileAction[],
  path: string,
): WriteAction {
  const action = actions.find((candidate) => candidate.path === path);
  assert.ok(action);
  if (!isWriteAction(action)) {
    assert.fail(`Expected write action for ${path}`);
  }
  return action;
}

describe('auth module file generation engine', () => {
  test('clean eligible Next.js project generates required file actions', () => {
    const template = AUTH_TEMPLATES_V1[0];
    const packageJsonContent = createPackageJson({
      dependencies: { next: '^15.1.3', react: '^19.0.0' },
    });
    const eligibility = detectAuthModuleEligibility({
      packageJsonContent,
      lockfiles: ['package-lock.json'],
    });

    const actions = generateAuthModuleFileActions({
      template,
      eligibility,
      packageJsonContent,
    });

    const paths = new Set(actions.map((action) => action.path));
    assert.equal(paths.has('package.json'), true);
    for (const expectedFilePath of template.manifest.filePaths) {
      assert.equal(paths.has(expectedFilePath), true, `Missing generated path: ${expectedFilePath}`);
    }
    assert.equal(actions.some((action) => action.action === 'delete'), false);
  });

  test('ineligible project returns typed failure and no actions', () => {
    const template = AUTH_TEMPLATES_V1[0];
    const packageJsonContent = createPackageJson({
      dependencies: { react: '^19.0.0' },
    });
    const eligibility = detectAuthModuleEligibility({
      packageJsonContent,
      lockfiles: ['package-lock.json'],
    });

    assert.equal(eligibility.eligible, false);
    assert.throws(
      () =>
        generateAuthModuleFileActions({
          template,
          eligibility,
          packageJsonContent,
        }),
      (error: unknown) => {
        assert.equal(error instanceof AuthModuleGenerationError, true);
        assert.equal((error as AuthModuleGenerationError).code, 'INELIGIBLE');
        return true;
      },
    );
  });

  test('package.json dependency merge preserves existing dependencies and scripts', () => {
    const template = AUTH_TEMPLATES_V1[0];
    const packageJsonContent = createPackageJson({
      dependencies: {
        next: '^15.1.3',
        react: '^19.0.0',
        'next-auth': '^4.24.0',
      },
      devDependencies: { typescript: '^5.8.2' },
      scripts: { dev: 'next dev', build: 'next build' },
    });
    const eligibility = detectAuthModuleEligibility({
      packageJsonContent,
      lockfiles: ['package-lock.json'],
    });

    const actions = generateAuthModuleFileActions({
      template,
      eligibility,
      packageJsonContent,
    });
    const packageAction = getWriteActionByPath(actions, 'package.json');
    assert.equal(packageAction.action, 'update');
    const merged = JSON.parse(packageAction.content) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };

    assert.equal(merged.scripts.dev, 'next dev');
    assert.equal(merged.scripts.build, 'next build');
    assert.equal(merged.dependencies.react, '^19.0.0');
    assert.equal(
      merged.dependencies['next-auth'],
      '^4.24.0',
      'existing dependency versions must not be overwritten',
    );
  });

  test('package.json dependency merge adds auth dependencies and devDependencies', () => {
    const template = AUTH_TEMPLATES_V1[0];
    const packageJsonContent = createPackageJson({
      dependencies: { next: '^15.1.3' },
    });
    const eligibility = detectAuthModuleEligibility({
      packageJsonContent,
      lockfiles: ['package-lock.json'],
    });

    const actions = generateAuthModuleFileActions({
      template,
      eligibility,
      packageJsonContent,
    });
    const packageAction = getWriteActionByPath(actions, 'package.json');
    const merged = JSON.parse(packageAction.content) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    assert.equal(typeof merged.dependencies['next-auth'], 'string');
    assert.equal(typeof merged.dependencies['@auth/prisma-adapter'], 'string');
    assert.equal(typeof merged.dependencies['@prisma/client'], 'string');
    assert.equal(typeof merged.dependencies.bcryptjs, 'string');
    assert.equal(typeof merged.devDependencies.prisma, 'string');
    assert.equal(typeof merged.devDependencies['@types/bcryptjs'], 'string');
  });

  test('existing Prisma schema appends missing Auth.js models', () => {
    const template = AUTH_TEMPLATES_V1[0];
    const packageJsonContent = createPackageJson({
      dependencies: { next: '^15.1.3' },
    });
    const existingPrismaSchemaContent = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Post {
  id    String @id @default(cuid())
  title String
}
`;
    const eligibility = detectAuthModuleEligibility({
      packageJsonContent,
      lockfiles: ['package-lock.json'],
    });

    const actions = generateAuthModuleFileActions({
      template,
      eligibility,
      packageJsonContent,
      prismaSchemaContent: existingPrismaSchemaContent,
    });

    const prismaAction = getWriteActionByPath(actions, 'prisma/schema.prisma');
    assert.equal(prismaAction.action, 'update');
    assert.match(prismaAction.content, /model Post \{/);
    assert.match(prismaAction.content, /model User \{/);
    assert.match(prismaAction.content, /model Account \{/);
    assert.match(prismaAction.content, /model Session \{/);
    assert.match(prismaAction.content, /model VerificationToken \{/);
  });

  test('existing Prisma schema with auth models does not duplicate models', () => {
    const template = AUTH_TEMPLATES_V1[0];
    const packageJsonContent = createPackageJson({
      dependencies: { next: '^15.1.3' },
    });
    const templatePrisma = template.files.find((file) => file.path === 'prisma/schema.prisma');
    assert.ok(templatePrisma);
    const existingPrismaSchemaContent = `${templatePrisma.content.trimEnd()}\n`;
    const eligibility = detectAuthModuleEligibility({
      packageJsonContent,
      lockfiles: ['package-lock.json'],
    });

    const actions = generateAuthModuleFileActions({
      template,
      eligibility,
      packageJsonContent,
      prismaSchemaContent: existingPrismaSchemaContent,
    });

    const prismaAction = getWriteActionByPath(actions, 'prisma/schema.prisma');
    assert.equal(countPrismaModel(prismaAction.content, 'User'), 1);
    assert.equal(countPrismaModel(prismaAction.content, 'Account'), 1);
    assert.equal(countPrismaModel(prismaAction.content, 'Session'), 1);
    assert.equal(countPrismaModel(prismaAction.content, 'VerificationToken'), 1);
  });

  test('generated paths are relative and safe', () => {
    const template = AUTH_TEMPLATES_V1[0];
    const packageJsonContent = createPackageJson({
      dependencies: { next: '^15.1.3' },
    });
    const eligibility = detectAuthModuleEligibility({
      packageJsonContent,
      lockfiles: ['package-lock.json'],
    });

    const actions = generateAuthModuleFileActions({
      template,
      eligibility,
      packageJsonContent,
    });

    for (const action of actions) {
      assert.equal(isSafeRelativePath(action.path), true, `Unsafe generated path: ${action.path}`);
    }
  });

  test('generated content contains no platform auth references', () => {
    const template = AUTH_TEMPLATES_V1[0];
    const packageJsonContent = createPackageJson({
      dependencies: { next: '^15.1.3' },
    });
    const eligibility = detectAuthModuleEligibility({
      packageJsonContent,
      lockfiles: ['package-lock.json'],
    });

    const actions = generateAuthModuleFileActions({
      template,
      eligibility,
      packageJsonContent,
    });
    const combinedContent = actions
      .filter(isWriteAction)
      .map((action) => action.content)
      .join('\n');

    for (const forbiddenToken of FORBIDDEN_PLATFORM_TOKENS) {
      assert.equal(
        combinedContent.includes(forbiddenToken),
        false,
        `Generated content must not include ${forbiddenToken}`,
      );
    }
  });
});
