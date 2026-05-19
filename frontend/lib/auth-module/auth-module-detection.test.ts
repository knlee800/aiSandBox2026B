import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  detectAuthModuleEligibility,
  detectPackageManagerFromLockfiles,
} from './auth-module-detection';

function createPackageJson(params: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}): string {
  return JSON.stringify(
    {
      name: 'sample-app',
      private: true,
      version: '1.0.0',
      dependencies: params.dependencies ?? {},
      devDependencies: params.devDependencies ?? {},
    },
    null,
    2,
  );
}

describe('auth module eligibility detection', () => {
  test('detects Next.js from dependencies', () => {
    const packageJsonContent = createPackageJson({
      dependencies: { next: '^15.1.3' },
    });

    const result = detectAuthModuleEligibility({
      packageJsonContent,
      lockfiles: ['package-lock.json'],
    });

    assert.equal(result.eligible, true);
    assert.equal(result.code, 'ELIGIBLE');
    assert.equal(result.framework.detected, true);
    assert.equal(result.framework.detectedFrom, 'dependencies');
  });

  test('detects Next.js from devDependencies', () => {
    const packageJsonContent = createPackageJson({
      devDependencies: { next: '^15.1.3' },
    });

    const result = detectAuthModuleEligibility({
      packageJsonContent,
      lockfiles: ['package-lock.json'],
    });

    assert.equal(result.eligible, true);
    assert.equal(result.framework.detected, true);
    assert.equal(result.framework.detectedFrom, 'devDependencies');
  });

  test('rejects non-Next.js projects', () => {
    const packageJsonContent = createPackageJson({
      dependencies: { react: '^19.0.0' },
    });

    const result = detectAuthModuleEligibility({
      packageJsonContent,
      lockfiles: ['package-lock.json'],
    });

    assert.equal(result.eligible, false);
    assert.equal(result.code, 'UNSUPPORTED_FRAMEWORK');
    assert.equal(result.framework.detected, false);
    assert.match(result.reason, /supports Next\.js projects only/i);
  });

  test('rejects missing package.json content', () => {
    const result = detectAuthModuleEligibility({
      packageJsonContent: undefined,
      lockfiles: ['package-lock.json'],
    });

    assert.equal(result.eligible, false);
    assert.equal(result.code, 'MISSING_PACKAGE_JSON');
  });

  test('rejects malformed package.json content', () => {
    const result = detectAuthModuleEligibility({
      packageJsonContent: '{ "name": "broken-app", ',
      lockfiles: ['package-lock.json'],
    });

    assert.equal(result.eligible, false);
    assert.equal(result.code, 'MALFORMED_PACKAGE_JSON');
  });

  test('detects Prisma from dependencies', () => {
    const packageJsonContent = createPackageJson({
      dependencies: {
        next: '^15.1.3',
        '@prisma/client': '^5.22.0',
      },
    });

    const result = detectAuthModuleEligibility({
      packageJsonContent,
      lockfiles: ['package-lock.json'],
    });

    assert.equal(result.eligible, true);
    assert.equal(result.prisma.detected, true);
    assert.equal(result.prisma.packages.includes('@prisma/client'), true);
    assert.equal(result.prisma.detectedFrom.includes('dependencies'), true);
  });

  test('detects Prisma from devDependencies', () => {
    const packageJsonContent = createPackageJson({
      dependencies: { next: '^15.1.3' },
      devDependencies: { prisma: '^5.22.0' },
    });

    const result = detectAuthModuleEligibility({
      packageJsonContent,
      lockfiles: ['package-lock.json'],
    });

    assert.equal(result.eligible, true);
    assert.equal(result.prisma.detected, true);
    assert.equal(result.prisma.packages.includes('prisma'), true);
    assert.equal(result.prisma.detectedFrom.includes('devDependencies'), true);
  });

  test('detects package manager from lockfiles (pnpm/yarn/npm)', () => {
    assert.equal(detectPackageManagerFromLockfiles(['pnpm-lock.yaml']), 'pnpm');
    assert.equal(detectPackageManagerFromLockfiles(['yarn.lock']), 'yarn');
    assert.equal(detectPackageManagerFromLockfiles(['package-lock.json']), 'npm');
    assert.equal(
      detectPackageManagerFromLockfiles(['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json']),
      'pnpm',
      'pnpm should take priority when multiple lockfiles are present',
    );
  });

  test('falls back to npm when no lockfile exists', () => {
    assert.equal(detectPackageManagerFromLockfiles([]), 'npm');

    const packageJsonContent = createPackageJson({
      dependencies: { next: '^15.1.3' },
    });
    const result = detectAuthModuleEligibility({
      packageJsonContent,
      lockfiles: [],
    });

    assert.equal(result.packageManager, 'npm');
  });
});
