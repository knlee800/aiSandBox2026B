# AUTH-MODULE-01A Checkpoint — Auth Template Registry Foundation

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-MODULE-01A |
| Title | Auth Template Registry Foundation |
| Family | AUTH |
| Parent | AUTH-MODULE-01 — Reusable App-Auth Module for aiSandBox-Created Apps |
| Status | COMPLETE and LOCKED |
| Nature | FRONTEND ONLY — new files under `frontend/lib/auth-module/`; no backend or production source modifications |
| Date | 2026-05-19 |
| Depends on | AUTH-MODULE-01 plan phase (COMPLETE) |

---

## Objective

Define the complete typed template registry for the Next.js App Router + Auth.js v5 + PostgreSQL auth starter. All generated file contents are stored as typed string constants. The registry defines the file manifest, dependency manifest, env var manifest, and template metadata. Tests confirm template validity, safe relative paths, required file presence, dependency completeness, env var presence, and the absence of any aiSandBox platform auth references.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/lib/auth-module/auth-template-types.ts` | **Created** — type definitions |
| `frontend/lib/auth-module/auth-template-files.ts` | **Created** — template file string constants |
| `frontend/lib/auth-module/auth-template-registry.ts` | **Created** — assembled v1 registry |
| `frontend/lib/auth-module/auth-template-registry.test.ts` | **Created** — 8 tests |
| `frontend/package.json` | **Updated** — test discovery fix (added `lib/auth-module/*.test.ts` to test glob) |
| `docs/AUTH-MODULE-01A-CHECKPOINT.md` | **Created** — this document |
| `TASKS.md` | Updated — AUTH-MODULE-01A COMPLETE and LOCKED; AUTH-MODULE-01B ACTIVE; stage updated |
| `TASKS_BACKLOG_FULL.md` | Updated — mirrored from TASKS.md |

**Production source files changed: None.**

---

## Type Summary (`auth-template-types.ts`)

| Type | Purpose |
|---|---|
| `AuthTemplateFramework` | `'nextjs'` — v1 only |
| `AuthTemplateRouter` | `'app-router'` — v1 only |
| `AuthTemplatePackageKind` | `'dependency' \| 'devDependency'` |
| `AuthTemplateMetadata` | `id`, `name`, `version`, `description` |
| `AuthTemplateSupportedFramework` | `framework`, `router`, `packageName`, `supportedMajorVersions` |
| `AuthTemplateDependency` | `name`, `version`, `kind`, `reason` |
| `AuthTemplateEnvVar` | `name`, `required`, `description`, `example` |
| `AuthTemplateFile` | `path`, `description`, `content` |
| `AuthTemplateManifest` | `dependencies`, `env`, `filePaths` |
| `AuthTemplate` | Root type — `metadata`, `supportedFramework`, `manifest`, `files` |

---

## Registry Summary (`auth-template-registry.ts`)

**Template:** `AUTH_TEMPLATE_NEXTJS_AUTHJS_PRISMA_V1`

| Field | Value |
|---|---|
| `id` | `nextjs-authjs-prisma-v1` |
| `name` | Next.js App Router Auth Starter (Auth.js + Prisma) |
| `version` | `1.0.0` |
| `framework` | `nextjs` / `app-router` |
| `supportedMajorVersions` | `['14', '15']` |

**Exported registry:** `AUTH_TEMPLATES_V1` — array containing exactly one v1 template.

---

## Dependency Manifest

| Package | Version | Kind |
|---|---|---|
| `next-auth` | `^5.0.0-beta` | dependency |
| `@auth/prisma-adapter` | `^2.7.0` | dependency |
| `@prisma/client` | `^5.22.0` | dependency |
| `bcryptjs` | `^2.4.3` | dependency |
| `prisma` | `^5.22.0` | devDependency |
| `@types/bcryptjs` | `^2.4.6` | devDependency |

These are dependencies for the **generated user app**, not for the aiSandBox platform itself.

---

## Env Var Manifest

| Var | Required | Purpose |
|---|---|---|
| `AUTH_SECRET` | Yes | Auth.js token signing secret |
| `DATABASE_URL` | Yes | PostgreSQL connection string for Prisma |
| `NEXTAUTH_URL` | Yes | Public origin for callback URLs |
| `GOOGLE_CLIENT_ID` | No | Google OAuth (user's own credentials) |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth (user's own credentials) |
| `APPLE_CLIENT_ID` | No | Apple OAuth (user's own credentials) |
| `APPLE_CLIENT_SECRET` | No | Apple OAuth (user's own credentials) |

---

## Template File Manifest (15 files)

| Path | Description |
|---|---|
| `auth.ts` | Auth.js root config and provider setup (Credentials, Google, Apple) |
| `auth.config.ts` | Shared NextAuth config for edge-compatible middleware and route handlers |
| `app/api/auth/[...nextauth]/route.ts` | Auth.js route handler export for App Router |
| `middleware.ts` | Route protection middleware for authenticated surfaces |
| `prisma/schema.prisma` | Prisma schema with User, Account, Session, VerificationToken |
| `app/(auth)/login/page.tsx` | Login page component |
| `app/(auth)/register/page.tsx` | Register page component |
| `app/(auth)/layout.tsx` | Shared layout for auth pages |
| `components/auth/login-form.tsx` | Client login form with credentials and OAuth buttons |
| `components/auth/register-form.tsx` | Client registration form using server action |
| `components/auth/logout-button.tsx` | Client logout button using NextAuth `signOut` |
| `components/auth/auth-provider.tsx` | `SessionProvider` wrapper for client trees |
| `lib/auth-actions.ts` | Server action for credentials registration with bcrypt |
| `.env.example` | Generated app environment variable template |
| `SETUP-AUTH.md` | Manual setup instructions (deps, Prisma, env vars, dev server) |

---

## Test Summary (`auth-template-registry.test.ts`)

8 tests, all passing. Node `node:test` style matching existing frontend test conventions.

| # | Test |
|---|---|
| 1 | Registry has exactly one v1 template |
| 2 | Template id, version, and name are present |
| 3 | Dependency manifest includes all required auth starter packages |
| 4 | All template file paths are relative and safe |
| 5 | Required files exist in file manifest |
| 6 | Env var manifest includes `AUTH_SECRET` and `DATABASE_URL` |
| 7 | Template contents do not include platform auth/session tokens or guard names |
| 8 | Template content references Auth.js / NextAuth, not platform auth implementation |

**Platform auth tokens verified absent:** `aisandbox_session`, `aisandbox_csrf`, `X-Internal-Service-Key`, `SessionCookieGuard`, `CsrfGuard`, `PreviewOwnershipGuard`, `aisandbox_oauth_state`.

---

## Test Discovery Fix (`frontend/package.json`)

**Root cause:** The `npm test` script only targeted `components/workspace/*.test.ts*` and `components/public/*.test.ts*`. The new file at `lib/auth-module/auth-template-registry.test.ts` is outside those globs.

**Fix:** Added `lib/auth-module/*.test.ts` to the `npm test` glob list.

This is a test-configuration-only change. No runtime or build behavior is affected.

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | **PASS** |
| `npm test` | `frontend/` | **PASS — 391 tests, 0 failures** (was 383 before test discovery fix) |
| `npx tsx --test lib/auth-module/auth-template-registry.test.ts` | `frontend/` | **PASS — 8/8** |
| `ReadLints` on all 4 new files | — | **PASS — 0 errors** |

---

## Non-Goals Confirmed

- No AUTH-MODULE-01B/C/D/E/Z implementation
- No framework or package-manager detection
- No file-action generation engine
- No install/apply flow
- No AI prompt recognition
- No backend/API changes
- No platform dependency changes
- No changes to existing frontend, backend, or auth platform files
- No generated-app runtime execution

---

## Invariants Preserved

- All existing 383 tests continue to pass (391 total with 8 new)
- `frontend/package.json` runtime behavior (`dev`, `build`, `start`, `lint`) unchanged
- `tsc --noEmit` 0-error baseline maintained
- aiSandBox platform auth (`aisandbox_session`, `aisandbox_csrf`, guards) has zero presence in generated template content

---

## Carry-Forwards

None. AUTH-MODULE-01A is clean.

---

## Next Task

**AUTH-MODULE-01B — Framework Detection & Eligibility Check**

- Create `frontend/lib/auth-module/auth-module-detection.ts`
- Create `frontend/lib/auth-module/auth-module-detection.test.ts`
- Detect Next.js via `package.json`, Prisma presence, and package manager from lockfiles
- Return typed `AuthModuleEligibilityResult` with clear unsupported-stack messages
- No template generation, no install flow, no backend changes

---

## Reference

- `docs/AUTH-MODULE-01-CHECKPOINT.md` — parent family summary (created at AUTH-MODULE-01Z)
- `TASKS.md` → AUTH-MODULE-01A
- `TASKS_BACKLOG_FULL.md` → AUTH-MODULE-01A
