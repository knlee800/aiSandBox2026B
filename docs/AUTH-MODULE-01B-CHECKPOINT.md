# AUTH-MODULE-01B Checkpoint — Framework Detection & Eligibility Check

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-MODULE-01B |
| Title | Framework Detection & Eligibility Check |
| Family | AUTH |
| Parent | AUTH-MODULE-01 — Reusable App-Auth Module for aiSandBox-Created Apps |
| Status | COMPLETE and LOCKED |
| Nature | FRONTEND ONLY — new files under `frontend/lib/auth-module/`; no backend or production source modifications |
| Date | 2026-05-19 |
| Depends on | AUTH-MODULE-01A (COMPLETE and LOCKED — required) |

---

## Objective

Implement pure, stateless detection logic that accepts raw `package.json` content and a list of present lockfile names, and returns a typed `AuthModuleEligibilityResult` indicating whether the user's workspace project is eligible for the auth module installer. Detect Next.js presence from `dependencies` or `devDependencies`, detect Prisma presence (both `@prisma/client` and `prisma`), determine the package manager from lockfile precedence, and handle missing/malformed `package.json` safely with clear eligibility codes and reason strings. No IO, no file reads, no API calls.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/lib/auth-module/auth-module-detection.ts` | **Created** — detection implementation |
| `frontend/lib/auth-module/auth-module-detection.test.ts` | **Created** — 9 tests |
| `docs/AUTH-MODULE-01B-CHECKPOINT.md` | **Created** — this document |
| `TASKS.md` | Updated — AUTH-MODULE-01B COMPLETE and LOCKED; AUTH-MODULE-01C ACTIVE; stage updated |
| `TASKS_BACKLOG_FULL.md` | Updated — mirrored from TASKS.md |

**Production source files changed: None.**

---

## Detection API Summary (`auth-module-detection.ts`)

### Exported Functions

| Function | Signature | Purpose |
|---|---|---|
| `detectAuthModuleEligibility` | `(input: DetectAuthModuleEligibilityInput): AuthModuleEligibilityResult` | Primary eligibility check — reads parsed package.json content and lockfile list |
| `detectPackageManagerFromLockfiles` | `(lockfiles?: readonly string[]): AuthModulePackageManager` | Derives package manager from list of present lockfile names |

### Exported Types

| Type | Purpose |
|---|---|
| `AuthModulePackageManager` | `'npm' \| 'yarn' \| 'pnpm'` |
| `AuthModuleDependencySource` | `'dependencies' \| 'devDependencies'` |
| `AuthModuleEligibilityCode` | `'ELIGIBLE' \| 'MISSING_PACKAGE_JSON' \| 'MALFORMED_PACKAGE_JSON' \| 'UNSUPPORTED_FRAMEWORK'` |
| `AuthModuleFrameworkInfo` | `expected`, `packageName`, `detected`, `detectedFrom`, `version` |
| `AuthModulePrismaInfo` | `detected`, `packages`, `detectedFrom` |
| `AuthModuleEligibilityResult` | `eligible`, `code`, `reason`, `framework`, `packageManager`, `prisma`, `warnings` |
| `DetectAuthModuleEligibilityInput` | `packageJsonContent: string \| null \| undefined`, `lockfiles?: readonly string[]` |

### Internal Helpers (not exported)

| Helper | Purpose |
|---|---|
| `parsePackageJson` | Parses raw content string; returns `ParsedPackageJson` or error sentinel |
| `detectPackageVersion` | Checks `dependencies` then `devDependencies` for a named package; returns found/source/version |
| `buildUnsupportedResult` | Constructs a uniform ineligible result for error-path codes |
| `isPlainObject` | Type guard for plain JS objects |

---

## AuthModuleEligibilityResult Shape

```
{
  eligible: boolean
  code: AuthModuleEligibilityCode
  reason: string
  framework: {
    expected: 'nextjs'
    packageName: 'next'
    detected: boolean
    detectedFrom: 'dependencies' | 'devDependencies' | null
    version: string | null
  }
  packageManager: 'npm' | 'yarn' | 'pnpm'
  prisma: {
    detected: boolean
    packages: readonly ('prisma' | '@prisma/client')[]
    detectedFrom: readonly ('dependencies' | 'devDependencies')[]
  }
  warnings: readonly string[]
}
```

---

## Package Manager Detection Summary

Lockfile precedence (first match wins):

| Lockfile | Resolved manager |
|---|---|
| `pnpm-lock.yaml` | `pnpm` |
| `yarn.lock` | `yarn` |
| `package-lock.json` | `npm` |
| no known lockfile | `npm` (fallback) |

The `lockfiles` parameter is an array of filenames present in the workspace root. Order in the array does not affect precedence — precedence is defined by the function logic above.

---

## Eligibility Code Semantics

| Code | eligible | Trigger |
|---|---|---|
| `ELIGIBLE` | `true` | `next` found in dependencies or devDependencies |
| `MISSING_PACKAGE_JSON` | `false` | `packageJsonContent` is `null`, `undefined`, or blank string |
| `MALFORMED_PACKAGE_JSON` | `false` | `packageJsonContent` fails `JSON.parse` or is not a plain object |
| `UNSUPPORTED_FRAMEWORK` | `false` | `package.json` parsed but `next` not present in any dep field |

---

## Tests Summary (`auth-module-detection.test.ts`)

9 tests using Node `node:test` style, consistent with existing frontend test conventions.

| # | Test |
|---|---|
| 1 | Detects Next.js from `dependencies` |
| 2 | Detects Next.js from `devDependencies` |
| 3 | Rejects non-Next.js projects (`UNSUPPORTED_FRAMEWORK`) |
| 4 | Rejects missing `package.json` content (`MISSING_PACKAGE_JSON`) |
| 5 | Rejects malformed `package.json` content (`MALFORMED_PACKAGE_JSON`) |
| 6 | Detects Prisma (`@prisma/client`) from `dependencies` |
| 7 | Detects Prisma (`prisma`) from `devDependencies` |
| 8 | Detects package manager from lockfiles (pnpm/yarn/npm); validates pnpm priority when multiple lockfiles present |
| 9 | Falls back to npm when no lockfile present (both direct function call and via `detectAuthModuleEligibility`) |

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | **PASS** |
| `npm test` | `frontend/` | **PASS — 400 tests, 400 passed, 0 failed** |
| `ReadLints` on both new files | — | **PASS — 0 errors** |

`npm test` includes both `auth-template-registry.test.ts` (from AUTH-MODULE-01A) and `auth-module-detection.test.ts` (this slice), confirming the test discovery glob added in AUTH-MODULE-01A covers both files.

---

## Non-Goals Confirmed

- No file-action generation engine
- No template merging
- No install/apply flow
- No AI prompt recognition
- No backend/API changes
- No platform dependency changes
- No generated-app runtime execution
- No readWorkspaceFile, fetch, or IO calls in detection logic
- No changes to existing frontend, backend, or auth platform source files

---

## Invariants Preserved

- All existing 391 tests continue to pass (400 total with 9 new)
- `frontend/package.json` runtime behavior (`dev`, `build`, `start`, `lint`) unchanged
- `tsc --noEmit` 0-error baseline maintained
- aiSandBox platform auth (`aisandbox_session`, `aisandbox_csrf`, guards) has zero presence in new files
- AUTH-MODULE-01A registry files unchanged

---

## Carry-Forwards

None. AUTH-MODULE-01B is clean.

---

## Next Task

**AUTH-MODULE-01C — Template File Generation Engine**

- Create `frontend/lib/auth-module/auth-module-generator.ts`
- Create `frontend/lib/auth-module/auth-module-generator.test.ts`
- Given `AuthModuleEligibilityResult` (from AUTH-MODULE-01B) and `AUTH_TEMPLATES_V1` (from AUTH-MODULE-01A), produce `WorkspaceFileAction[]` ready for `applySequentialFileActions`
- Handle clean-project case and existing-Prisma case
- Merge `package.json` dependencies safely (add only, never remove)
- Validate all generated paths as relative workspace paths with no aiSandBox references
- No install/apply flow, no prompt recognition, no backend changes

---

## Reference

- `docs/AUTH-MODULE-01A-CHECKPOINT.md` — prior slice
- `docs/AUTH-MODULE-01-CHECKPOINT.md` — parent family summary (created at AUTH-MODULE-01Z)
- `TASKS.md` → AUTH-MODULE-01B
- `TASKS_BACKLOG_FULL.md` → AUTH-MODULE-01B
