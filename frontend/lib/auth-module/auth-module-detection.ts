import type { AuthTemplateFramework } from './auth-template-types';

export type AuthModulePackageManager = 'npm' | 'yarn' | 'pnpm';
export type AuthModuleDependencySource = 'dependencies' | 'devDependencies';

export type AuthModuleEligibilityCode =
  | 'ELIGIBLE'
  | 'MISSING_PACKAGE_JSON'
  | 'MALFORMED_PACKAGE_JSON'
  | 'UNSUPPORTED_FRAMEWORK';

export interface AuthModuleFrameworkInfo {
  expected: AuthTemplateFramework;
  packageName: 'next';
  detected: boolean;
  detectedFrom: AuthModuleDependencySource | null;
  version: string | null;
}

export interface AuthModulePrismaInfo {
  detected: boolean;
  packages: readonly ('prisma' | '@prisma/client')[];
  detectedFrom: readonly AuthModuleDependencySource[];
}

export interface AuthModuleEligibilityResult {
  eligible: boolean;
  code: AuthModuleEligibilityCode;
  reason: string;
  framework: AuthModuleFrameworkInfo;
  packageManager: AuthModulePackageManager;
  prisma: AuthModulePrismaInfo;
  warnings: readonly string[];
}

export interface DetectAuthModuleEligibilityInput {
  packageJsonContent: string | null | undefined;
  lockfiles?: readonly string[];
}

interface ParsedPackageJson {
  dependencies: Record<string, unknown>;
  devDependencies: Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePackageJson(
  packageJsonContent: string | null | undefined,
): ParsedPackageJson | 'MISSING_PACKAGE_JSON' | 'MALFORMED_PACKAGE_JSON' {
  if (typeof packageJsonContent !== 'string' || packageJsonContent.trim().length === 0) {
    return 'MISSING_PACKAGE_JSON';
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(packageJsonContent);
  } catch {
    return 'MALFORMED_PACKAGE_JSON';
  }

  if (!isPlainObject(parsed)) {
    return 'MALFORMED_PACKAGE_JSON';
  }

  const dependencies = isPlainObject(parsed.dependencies) ? parsed.dependencies : {};
  const devDependencies = isPlainObject(parsed.devDependencies) ? parsed.devDependencies : {};

  return {
    dependencies,
    devDependencies,
  };
}

function detectPackageVersion(
  packageName: string,
  packageJson: ParsedPackageJson,
): { found: boolean; source: AuthModuleDependencySource | null; version: string | null } {
  const dependencyValue = packageJson.dependencies[packageName];
  if (typeof dependencyValue === 'string' && dependencyValue.trim().length > 0) {
    return { found: true, source: 'dependencies', version: dependencyValue };
  }

  const devDependencyValue = packageJson.devDependencies[packageName];
  if (typeof devDependencyValue === 'string' && devDependencyValue.trim().length > 0) {
    return { found: true, source: 'devDependencies', version: devDependencyValue };
  }

  return { found: false, source: null, version: null };
}

export function detectPackageManagerFromLockfiles(
  lockfiles: readonly string[] = [],
): AuthModulePackageManager {
  const lockfileSet = new Set(lockfiles);
  if (lockfileSet.has('pnpm-lock.yaml')) return 'pnpm';
  if (lockfileSet.has('yarn.lock')) return 'yarn';
  if (lockfileSet.has('package-lock.json')) return 'npm';
  return 'npm';
}

function buildUnsupportedResult(
  code: Exclude<AuthModuleEligibilityCode, 'ELIGIBLE'>,
  reason: string,
  packageManager: AuthModulePackageManager,
): AuthModuleEligibilityResult {
  return {
    eligible: false,
    code,
    reason,
    framework: {
      expected: 'nextjs',
      packageName: 'next',
      detected: false,
      detectedFrom: null,
      version: null,
    },
    packageManager,
    prisma: {
      detected: false,
      packages: [],
      detectedFrom: [],
    },
    warnings: [],
  };
}

export function detectAuthModuleEligibility(
  input: DetectAuthModuleEligibilityInput,
): AuthModuleEligibilityResult {
  const packageManager = detectPackageManagerFromLockfiles(input.lockfiles ?? []);
  const parsed = parsePackageJson(input.packageJsonContent);

  if (parsed === 'MISSING_PACKAGE_JSON') {
    return buildUnsupportedResult(
      'MISSING_PACKAGE_JSON',
      'Workspace package.json is missing or empty.',
      packageManager,
    );
  }

  if (parsed === 'MALFORMED_PACKAGE_JSON') {
    return buildUnsupportedResult(
      'MALFORMED_PACKAGE_JSON',
      'Workspace package.json is malformed and could not be parsed.',
      packageManager,
    );
  }

  const nextDetection = detectPackageVersion('next', parsed);
  const prismaClientDetection = detectPackageVersion('@prisma/client', parsed);
  const prismaCliDetection = detectPackageVersion('prisma', parsed);

  const prismaPackages: ('prisma' | '@prisma/client')[] = [];
  const prismaSources = new Set<AuthModuleDependencySource>();
  if (prismaClientDetection.found) {
    prismaPackages.push('@prisma/client');
    if (prismaClientDetection.source) prismaSources.add(prismaClientDetection.source);
  }
  if (prismaCliDetection.found) {
    prismaPackages.push('prisma');
    if (prismaCliDetection.source) prismaSources.add(prismaCliDetection.source);
  }

  const framework: AuthModuleFrameworkInfo = {
    expected: 'nextjs',
    packageName: 'next',
    detected: nextDetection.found,
    detectedFrom: nextDetection.source,
    version: nextDetection.version,
  };

  const prisma: AuthModulePrismaInfo = {
    detected: prismaPackages.length > 0,
    packages: prismaPackages,
    detectedFrom: [...prismaSources],
  };

  if (!nextDetection.found) {
    return {
      eligible: false,
      code: 'UNSUPPORTED_FRAMEWORK',
      reason: 'Auth module installation currently supports Next.js projects only.',
      framework,
      packageManager,
      prisma,
      warnings: ['Package "next" was not found in dependencies or devDependencies.'],
    };
  }

  const warnings: string[] = [];
  if (!prisma.detected) {
    warnings.push('Prisma packages are not present and will be added during auth module generation.');
  }

  return {
    eligible: true,
    code: 'ELIGIBLE',
    reason: 'Workspace is eligible for auth module installation.',
    framework,
    packageManager,
    prisma,
    warnings,
  };
}
