# AUTH-MODULE-01 Checkpoint — Reusable App-Auth Module for aiSandBox-Created Apps

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-MODULE-01 |
| Title | Reusable App-Auth Module for aiSandBox-Created Apps |
| Family | AUTH |
| Status | COMPLETE and LOCKED |
| Nature | FRONTEND ONLY — all changes under `frontend/`; no backend, API, or infrastructure changes |
| Date | 2026-05-19 |
| Depends on | AUTH-APP-01 (VALIDATION COMPLETE); AUTH-APP-02 through AUTH-APP-02D (COMPLETE and LOCKED); UX-IA-08–UX-IA-10 (COMPLETE and LOCKED); AI-WS file-action system (COMPLETE and LOCKED) |

---

## Objective

Deliver a deterministic, frontend-only auth module installer for aiSandBox-created apps. When a user asks to "add authentication" in the chat, the system detects the intent, checks project eligibility, generates a complete set of auth files (Next.js App Router + Auth.js v5 + PostgreSQL + Prisma), and applies them through the existing file-action confirmation flow with pre-install and post-install checkpoints. The generated content is fully isolated from aiSandBox platform authentication.

---

## Child Slice Summary

| Slice | Title | Status | Checkpoint |
|---|---|---|---|
| AUTH-MODULE-01A | Auth Template Registry Foundation | COMPLETE and LOCKED | `docs/AUTH-MODULE-01A-CHECKPOINT.md` |
| AUTH-MODULE-01B | Framework Detection & Eligibility Check | COMPLETE and LOCKED | `docs/AUTH-MODULE-01B-CHECKPOINT.md` |
| AUTH-MODULE-01C | Template File Generation Engine | COMPLETE and LOCKED | `docs/AUTH-MODULE-01C-CHECKPOINT.md` |
| AUTH-MODULE-01D | Auth Module Install Flow Integration | COMPLETE and LOCKED | `docs/AUTH-MODULE-01D-CHECKPOINT.md` |
| AUTH-MODULE-01E | AI Prompt Recognition & UX Polish | COMPLETE and LOCKED | `docs/AUTH-MODULE-01E-CHECKPOINT.md` |
| AUTH-MODULE-01Z | Validation & Consolidation | COMPLETE and LOCKED | `docs/AUTH-MODULE-01Z-CHECKPOINT.md` |

---

## Feature Summary

### AUTH-MODULE-01A — Auth Template Registry Foundation

Defined the complete typed template registry for the Next.js App Router + Auth.js v5 + PostgreSQL auth starter. All 15 generated file contents stored as typed string constants. Registry exports `AUTH_TEMPLATES_V1`.

**Stack:** `next-auth@^5.0.0-beta`, `@auth/prisma-adapter@^2.7.0`, `@prisma/client@^5.22.0`, `bcryptjs@^2.4.3`, `prisma@^5.22.0` (devDep), `@types/bcryptjs@^2.4.6` (devDep).

**15 generated files:** auth.ts, auth.config.ts, API route handler, middleware.ts, Prisma schema, login/register/layout pages, login/register/logout/provider components, server action, .env.example, SETUP-AUTH.md.

---

### AUTH-MODULE-01B — Framework Detection & Eligibility Check

Implemented pure, stateless detection logic: `detectAuthModuleEligibility(input)` and `detectPackageManagerFromLockfiles(lockfiles)`. Accepts raw `package.json` content and lockfile names, returns typed `AuthModuleEligibilityResult` with eligibility codes (`ELIGIBLE`, `MISSING_PACKAGE_JSON`, `MALFORMED_PACKAGE_JSON`, `UNSUPPORTED_FRAMEWORK`), detected framework info, Prisma presence, and package manager. No IO.

---

### AUTH-MODULE-01C — Template File Generation Engine

Implemented `generateAuthModuleFileActions(input): WorkspaceFileAction[]`. Accepts template, eligibility result, and optional existing `package.json`, `prisma/schema.prisma`, `.env.example`. Performs safe merges (add-only for deps, append-only for Prisma models and env vars). Guards all generated paths (relative path safety) and content (platform token absence). Emits only `create` and `update` actions; never `delete`.

---

### AUTH-MODULE-01D — Auth Module Install Flow Integration

Wired `handleInstallAuthModule` into `frontend/app/[locale]/app/page.tsx`. Pre-install named checkpoint before any file writes; eligibility check; file action generation; apply via existing `maybeApplyExecutionFileActions` / `applySequentialFileActions` (no bypass of `isRiskyFileActionBatch` or `acquireExecutionApplyGuard`); coherence checkpoint on completion. Extended `WorkspaceShellProps` with `onInstallAuthModule?: () => void | Promise<void>`.

**New constants:** `AUTH_MODULE_PREINSTALL_CHECKPOINT_DESCRIPTION = "Auth module install — pre-install snapshot"`, `AUTH_MODULE_INSTALL_CHECKPOINT_DESCRIPTION = "Auth module installed"`.

---

### AUTH-MODULE-01E — AI Prompt Recognition & UX Polish

Implemented `detectAuthModuleIntent(prompt: string): boolean` with strict two-phase logic: negative blocklist first, then positive verb + subject match. Wired intercept in `handleSubmitChatPrompt` before all AI paths. Immediate assistant status message: `"Installing auth module — preparing your workspace..."`. Refined completion summary surfaced in chat thread on success.

---

## Files Changed Across AUTH-MODULE-01

### New Files Created

| File | Slice |
|---|---|
| `frontend/lib/auth-module/auth-template-types.ts` | 01A |
| `frontend/lib/auth-module/auth-template-files.ts` | 01A |
| `frontend/lib/auth-module/auth-template-registry.ts` | 01A |
| `frontend/lib/auth-module/auth-template-registry.test.ts` | 01A |
| `frontend/lib/auth-module/auth-module-detection.ts` | 01B |
| `frontend/lib/auth-module/auth-module-detection.test.ts` | 01B |
| `frontend/lib/auth-module/auth-module-generator.ts` | 01C |
| `frontend/lib/auth-module/auth-module-generator.test.ts` | 01C |
| `frontend/lib/auth-module/auth-module-intent.ts` | 01E |
| `frontend/lib/auth-module/auth-module-intent.test.ts` | 01E |

### Modified Files

| File | Slices | Change |
|---|---|---|
| `frontend/package.json` | 01A | Test discovery glob extended to include `lib/auth-module/*.test.ts` |
| `frontend/app/[locale]/app/page.tsx` | 01D, 01E | `handleInstallAuthModule`, coherence resolver, intercept in `handleSubmitChatPrompt` |
| `frontend/components/workspace/workspace-shell.tsx` | 01D | `onInstallAuthModule?: () => void \| Promise<void>` prop added to `WorkspaceShellProps` |
| `frontend/components/workspace/workspace-shell.test.tsx` | 01D, 01E | Tests for install flow, constants, ref, coherence resolver, prompt routing |

### Governance / Docs Files

| File | Slice |
|---|---|
| `docs/AUTH-MODULE-01A-CHECKPOINT.md` | 01A |
| `docs/AUTH-MODULE-01B-CHECKPOINT.md` | 01B |
| `docs/AUTH-MODULE-01C-CHECKPOINT.md` | 01C |
| `docs/AUTH-MODULE-01D-CHECKPOINT.md` | 01D |
| `docs/AUTH-MODULE-01E-CHECKPOINT.md` | 01E |
| `docs/AUTH-MODULE-01Z-CHECKPOINT.md` | 01Z |
| `docs/AUTH-MODULE-01-CHECKPOINT.md` | 01Z |
| `TASKS.md` | 01A–01Z |
| `TASKS_BACKLOG_FULL.md` | 01A–01Z |

**Production source files changed outside `frontend/`: None.**

---

## Final Validation Summary

All commands executed from `C:\Users\knlee\aiSandBox2026B\frontend` at AUTH-MODULE-01Z.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **PASS — 0 errors** |
| `npm test` | **PASS — 437 tests, 437 passed, 0 failed, 38 suites** |
| `npm run build` | **PASS — Next.js 15.5.12 production build** |
| `git restore -- frontend/tsconfig.tsbuildinfo` | Completed |
| `ReadLints` on all 14 touched files | **PASS — 0 errors** |

### Test count progression

| Slice | Tests added | Cumulative total |
|---|---|---|
| Pre-AUTH-MODULE-01 baseline | — | 383 |
| AUTH-MODULE-01A | 8 | 391 |
| AUTH-MODULE-01B | 9 | 400 |
| AUTH-MODULE-01C | 8 | 408 |
| AUTH-MODULE-01D | 10 | 418 |
| AUTH-MODULE-01E | 19 | 437 |
| **AUTH-MODULE-01Z (final)** | **0** | **437** |

---

## Manual Smoke Checklist

**Status: SKIPPED — no running app/session available**

All 14 items SKIPPED with reason: no running aiSandBox app/session in this environment. No items marked PASS or FAIL.

Carry-forward: smoke checklist should be executed against a live stack as part of QA before production deployment of this feature.

---

## Non-Goals Confirmed

- No backend or API changes at any slice
- No platform authentication changes
- No generated-app runtime execution
- No dependency installation or migration execution at the platform level
- No architectural boundaries crossed
- No i18n file changes
- No new platform dependencies
- No confirmation bypass or direct file writes outside existing helpers

---

## Invariants Preserved

- All 437 tests pass (383 pre-existing + 54 new across slices)
- `tsc --noEmit` 0-error baseline maintained throughout all slices
- `npm run build` passes (confirmed at 01D and 01E)
- `isRiskyFileActionBatch` and `acquireExecutionApplyGuard` paths unchanged
- `handleInstallAuthModule` pre-flight failure behavior preserved through 01E
- Existing orchestrated and non-orchestrated AI paths not modified (01E intercept is strictly pre-AI)
- aiSandBox platform auth tokens (`aisandbox_session`, `aisandbox_csrf`, `X-Internal-Service-Key`, `SessionCookieGuard`, `CsrfGuard`, `PreviewOwnershipGuard`, `aisandbox_oauth_state`) have zero presence in all generated template content — verified by test 7 in 01A and test 8 in 01C
- No pre-install checkpoint bypass — pre-install snapshot lands before any file writes (01D)

---

## Carry-Forwards / Known Limitations

1. **Manual smoke SKIPPED** — needs live-stack execution before production deployment.
2. **Checkpoint labels (resolved)** — Implemented constants are `AUTH_MODULE_PREINSTALL_CHECKPOINT_DESCRIPTION = "Auth Module: pre-install snapshot"` and `AUTH_MODULE_INSTALL_CHECKPOINT_DESCRIPTION = "Auth Module: installed authentication starter"`. These match the manual smoke checklist exactly. A prior carry-forward note listed incorrect values; this note supersedes it.
3. **v1 stack only** — registry supports `nextjs / app-router` only. Non-Next.js projects receive a clear `UNSUPPORTED_FRAMEWORK` message. Additional framework support is a future task.
4. **Generated app dependencies not auto-installed** — the module writes `package.json` with auth deps but does not run `npm install`. SETUP-AUTH.md instructs the user.

---

## Reference

- `docs/AUTH-MODULE-01A-CHECKPOINT.md`
- `docs/AUTH-MODULE-01B-CHECKPOINT.md`
- `docs/AUTH-MODULE-01C-CHECKPOINT.md`
- `docs/AUTH-MODULE-01D-CHECKPOINT.md`
- `docs/AUTH-MODULE-01E-CHECKPOINT.md`
- `docs/AUTH-MODULE-01Z-CHECKPOINT.md`
- `TASKS.md` → AUTH-MODULE-01
- `TASKS_BACKLOG_FULL.md` → AUTH-MODULE-01
