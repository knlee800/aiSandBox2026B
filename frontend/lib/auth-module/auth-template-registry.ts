import { AUTH_TEMPLATE_FILES } from './auth-template-files';
import type { AuthTemplate, AuthTemplateDependency, AuthTemplateEnvVar } from './auth-template-types';

export const AUTH_TEMPLATE_DEPENDENCIES: readonly AuthTemplateDependency[] = [
  {
    name: 'next-auth',
    version: '^5.0.0-beta',
    kind: 'dependency',
    reason: 'Auth.js / NextAuth runtime for App Router authentication.',
  },
  {
    name: '@auth/prisma-adapter',
    version: '^2.7.0',
    kind: 'dependency',
    reason: 'Prisma adapter wiring for Auth.js persistence.',
  },
  {
    name: '@prisma/client',
    version: '^5.22.0',
    kind: 'dependency',
    reason: 'Prisma Client runtime dependency.',
  },
  {
    name: 'bcryptjs',
    version: '^2.4.3',
    kind: 'dependency',
    reason: 'Credentials password hashing and verification.',
  },
  {
    name: 'prisma',
    version: '^5.22.0',
    kind: 'devDependency',
    reason: 'Prisma schema tooling and manual migration commands.',
  },
  {
    name: '@types/bcryptjs',
    version: '^2.4.6',
    kind: 'devDependency',
    reason: 'Type definitions for bcryptjs usage in TypeScript.',
  },
] as const;

export const AUTH_TEMPLATE_ENV_VARS: readonly AuthTemplateEnvVar[] = [
  {
    name: 'AUTH_SECRET',
    required: true,
    description: 'Auth.js secret used to sign and verify tokens.',
    example: 'replace-with-32-byte-random-secret',
  },
  {
    name: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL connection string used by Prisma adapter.',
    example: 'postgresql://postgres:postgres@localhost:5432/app_auth',
  },
  {
    name: 'NEXTAUTH_URL',
    required: true,
    description: 'Public origin for callback URLs in local/runtime environments.',
    example: 'http://localhost:3000',
  },
  {
    name: 'GOOGLE_CLIENT_ID',
    required: false,
    description: 'Google OAuth client id for optional social sign-in.',
    example: 'replace-with-google-client-id',
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    required: false,
    description: 'Google OAuth client secret for optional social sign-in.',
    example: 'replace-with-google-client-secret',
  },
  {
    name: 'APPLE_CLIENT_ID',
    required: false,
    description: 'Apple OAuth client id for optional social sign-in.',
    example: 'replace-with-apple-client-id',
  },
  {
    name: 'APPLE_CLIENT_SECRET',
    required: false,
    description: 'Apple OAuth client secret for optional social sign-in.',
    example: 'replace-with-apple-client-secret',
  },
] as const;

export const AUTH_TEMPLATE_NEXTJS_AUTHJS_PRISMA_V1: AuthTemplate = {
  metadata: {
    id: 'nextjs-authjs-prisma-v1',
    name: 'Next.js App Router Auth Starter (Auth.js + Prisma)',
    version: '1.0.0',
    description:
      'Deterministic generated-app authentication starter for Next.js App Router using Auth.js and PostgreSQL Prisma adapter.',
  },
  supportedFramework: {
    framework: 'nextjs',
    router: 'app-router',
    packageName: 'next',
    supportedMajorVersions: ['14', '15'],
  },
  manifest: {
    dependencies: AUTH_TEMPLATE_DEPENDENCIES,
    env: AUTH_TEMPLATE_ENV_VARS,
    filePaths: AUTH_TEMPLATE_FILES.map((file) => file.path),
  },
  files: AUTH_TEMPLATE_FILES,
};

export const AUTH_TEMPLATES_V1: readonly AuthTemplate[] = [
  AUTH_TEMPLATE_NEXTJS_AUTHJS_PRISMA_V1,
] as const;
