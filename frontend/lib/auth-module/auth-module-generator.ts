import type { WorkspaceFileAction } from '../../components/workspace/workspace-ai-file-actions.logic';
import type { AuthTemplate } from './auth-template-types';
import type { AuthModuleEligibilityResult } from './auth-module-detection';

type AuthModuleGenerationErrorCode =
  | 'INELIGIBLE'
  | 'MALFORMED_PACKAGE_JSON'
  | 'UNSAFE_TEMPLATE_PATH'
  | 'FORBIDDEN_TEMPLATE_CONTENT';

const AUTH_PRISMA_MODEL_NAMES = ['User', 'Account', 'Session', 'VerificationToken'] as const;
const FORBIDDEN_PLATFORM_TOKENS = [
  'aisandbox_session',
  'aisandbox_csrf',
  'X-Internal-Service-Key',
  'SessionCookieGuard',
  'CsrfGuard',
  'PreviewOwnershipGuard',
  'aisandbox_oauth_state',
] as const;

type JsonRecord = Record<string, unknown>;

export interface GenerateAuthModuleFileActionsInput {
  template: AuthTemplate;
  eligibility: AuthModuleEligibilityResult;
  packageJsonContent: string;
  prismaSchemaContent?: string | null;
  dotEnvExampleContent?: string | null;
}

export class AuthModuleGenerationError extends Error {
  readonly code: AuthModuleGenerationErrorCode;

  constructor(code: AuthModuleGenerationErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'AuthModuleGenerationError';
  }
}

function isPlainObject(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeRelativePath(path: string): boolean {
  if (!path || path.startsWith('/')) return false;
  if (path.includes('\\')) return false;
  if (/^[A-Za-z]:/.test(path)) return false;
  if (path.includes('\0')) return false;

  const segments = path.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    return false;
  }
  return true;
}

function parsePackageJsonContent(packageJsonContent: string): JsonRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(packageJsonContent);
  } catch {
    throw new AuthModuleGenerationError(
      'MALFORMED_PACKAGE_JSON',
      'Cannot generate auth module actions because package.json is malformed.',
    );
  }

  if (!isPlainObject(parsed)) {
    throw new AuthModuleGenerationError(
      'MALFORMED_PACKAGE_JSON',
      'Cannot generate auth module actions because package.json is not a JSON object.',
    );
  }

  return parsed;
}

function hasOwnKey(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function mergePackageJsonDependencies(
  packageJson: JsonRecord,
  template: AuthTemplate,
): string {
  const dependencies = isPlainObject(packageJson.dependencies)
    ? { ...packageJson.dependencies }
    : {};
  const devDependencies = isPlainObject(packageJson.devDependencies)
    ? { ...packageJson.devDependencies }
    : {};

  for (const dependency of template.manifest.dependencies) {
    const alreadyPresent =
      hasOwnKey(dependencies, dependency.name) || hasOwnKey(devDependencies, dependency.name);
    if (alreadyPresent) {
      continue;
    }

    if (dependency.kind === 'dependency') {
      dependencies[dependency.name] = dependency.version;
    } else {
      devDependencies[dependency.name] = dependency.version;
    }
  }

  const mergedPackageJson: JsonRecord = {
    ...packageJson,
    dependencies,
    devDependencies,
  };

  return `${JSON.stringify(mergedPackageJson, null, 2)}\n`;
}

function ensureNoForbiddenPlatformTokens(content: string, filePath: string): void {
  for (const token of FORBIDDEN_PLATFORM_TOKENS) {
    if (content.includes(token)) {
      throw new AuthModuleGenerationError(
        'FORBIDDEN_TEMPLATE_CONTENT',
        `Generated content for "${filePath}" contains forbidden platform token "${token}".`,
      );
    }
  }
}

function getModelBlockMap(schemaContent: string): Map<string, string> {
  const map = new Map<string, string>();
  const modelBlockPattern = /^\s*model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{[\s\S]*?^\}/gm;
  let match = modelBlockPattern.exec(schemaContent);

  while (match) {
    const modelName = match[1];
    const block = match[0].trim();
    map.set(modelName, block);
    match = modelBlockPattern.exec(schemaContent);
  }

  return map;
}

function schemaHasModel(schemaContent: string, modelName: string): boolean {
  const modelPattern = new RegExp(`^\\s*model\\s+${modelName}\\s*\\{`, 'm');
  return modelPattern.test(schemaContent);
}

function mergePrismaSchemaContent(
  templateSchemaContent: string,
  existingSchemaContent: string | null | undefined,
): { action: 'create' | 'update'; content: string } {
  if (typeof existingSchemaContent !== 'string' || existingSchemaContent.trim().length === 0) {
    return {
      action: 'create',
      content: templateSchemaContent,
    };
  }

  const templateModelBlocks = getModelBlockMap(templateSchemaContent);
  const missingModelBlocks: string[] = [];

  for (const modelName of AUTH_PRISMA_MODEL_NAMES) {
    if (schemaHasModel(existingSchemaContent, modelName)) {
      continue;
    }
    const modelBlock = templateModelBlocks.get(modelName);
    if (modelBlock) {
      missingModelBlocks.push(modelBlock);
    }
  }

  if (missingModelBlocks.length === 0) {
    return {
      action: 'update',
      content: existingSchemaContent,
    };
  }

  const base = existingSchemaContent.trimEnd();
  return {
    action: 'update',
    content: `${base}\n\n${missingModelBlocks.join('\n\n')}\n`,
  };
}

function extractEnvVarNames(content: string): Set<string> {
  const names = new Set<string>();
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (match) {
      names.add(match[1]);
    }
  }
  return names;
}

function mergeDotEnvExampleContent(
  template: AuthTemplate,
  existingDotEnvExampleContent: string | null | undefined,
  templateDotEnvExampleContent: string,
): { action: 'create' | 'update'; content: string } {
  if (
    typeof existingDotEnvExampleContent !== 'string' ||
    existingDotEnvExampleContent.trim().length === 0
  ) {
    return {
      action: 'create',
      content: templateDotEnvExampleContent,
    };
  }

  const existing = existingDotEnvExampleContent.trimEnd();
  const existingVarNames = extractEnvVarNames(existingDotEnvExampleContent);
  const missingLines = template.manifest.env
    .filter((envVar) => !existingVarNames.has(envVar.name))
    .map((envVar) => `${envVar.name}=${envVar.example}`);

  if (missingLines.length === 0) {
    return {
      action: 'update',
      content: existingDotEnvExampleContent,
    };
  }

  return {
    action: 'update',
    content: `${existing}\n\n# Auth.js / NextAuth\n${missingLines.join('\n')}\n`,
  };
}

export function generateAuthModuleFileActions(
  input: GenerateAuthModuleFileActionsInput,
): WorkspaceFileAction[] {
  if (!input.eligibility.eligible) {
    throw new AuthModuleGenerationError(
      'INELIGIBLE',
      `Cannot generate auth module file actions: ${input.eligibility.code} (${input.eligibility.reason}).`,
    );
  }

  const packageJson = parsePackageJsonContent(input.packageJsonContent);
  const fileActions: WorkspaceFileAction[] = [];
  const mergedPackageJsonContent = mergePackageJsonDependencies(packageJson, input.template);
  ensureNoForbiddenPlatformTokens(mergedPackageJsonContent, 'package.json');
  fileActions.push({
    action: 'update',
    path: 'package.json',
    content: mergedPackageJsonContent,
  });

  for (const file of input.template.files) {
    if (!isSafeRelativePath(file.path)) {
      throw new AuthModuleGenerationError(
        'UNSAFE_TEMPLATE_PATH',
        `Template file path "${file.path}" is not a safe relative path.`,
      );
    }

    if (file.path === 'prisma/schema.prisma') {
      const prismaAction = mergePrismaSchemaContent(file.content, input.prismaSchemaContent);
      ensureNoForbiddenPlatformTokens(prismaAction.content, file.path);
      fileActions.push({
        action: prismaAction.action,
        path: file.path,
        content: prismaAction.content,
      });
      continue;
    }

    if (file.path === '.env.example') {
      const envAction = mergeDotEnvExampleContent(
        input.template,
        input.dotEnvExampleContent,
        file.content,
      );
      ensureNoForbiddenPlatformTokens(envAction.content, file.path);
      fileActions.push({
        action: envAction.action,
        path: file.path,
        content: envAction.content,
      });
      continue;
    }

    ensureNoForbiddenPlatformTokens(file.content, file.path);
    fileActions.push({
      action: 'create',
      path: file.path,
      content: file.content,
    });
  }

  return fileActions;
}
