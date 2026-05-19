# AUTH-MODULE-01C Checkpoint — Template File Generation Engine

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-MODULE-01C |
| Title | Template File Generation Engine |
| Family | AUTH |
| Parent | AUTH-MODULE-01 — Reusable App-Auth Module for aiSandBox-Created Apps |
| Status | COMPLETE and LOCKED |
| Nature | FRONTEND ONLY — new files under `frontend/lib/auth-module/`; no backend or production source modifications |
| Date | 2026-05-19 |
| Depends on | AUTH-MODULE-01B (COMPLETE and LOCKED — `docs/AUTH-MODULE-01B-CHECKPOINT.md`) |

---

## Objective

Implement a pure, stateless file generation engine that accepts a selected auth template, an eligibility result from AUTH-MODULE-01B, and optional existing workspace file contents (`package.json`, `prisma/schema.prisma`, `.env.example`), and returns a `WorkspaceFileAction[]` array ready for `applySequentialFileActions`. Perform safe package.json dependency merging (add only, never remove or overwrite), safe Prisma schema merging (append only missing Auth.js models), safe `.env.example` merging (append only missing env vars), enforce relative path safety on all generated paths, and guard all generated content against platform auth token references. No IO, no file reads, no API calls.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/lib/auth-module/auth-module-generator.ts` | **Created** — generation engine implementation |
| `frontend/lib/auth-module/auth-module-generator.test.ts` | **Created** — 8 tests |
| `docs/AUTH-MODULE-01C-CHECKPOINT.md` | **Created** — this document |
| `TASKS.md` | Updated — AUTH-MODULE-01C COMPLETE and LOCKED; AUTH-MODULE-01D ACTIVE; stage updated |
| `TASKS_BACKLOG_FULL.md` | Updated — mirrored from TASKS.md |

**Production source files changed: None.**

---

## Generator API Summary (`auth-module-generator.ts`)

### Exported Function

| Function | Signature | Purpose |
|---|---|---|
| `generateAuthModuleFileActions` | `(input: GenerateAuthModuleFileActionsInput): WorkspaceFileAction[]` | Primary generation entry point — produces the complete file action array for the auth module install |

### Exported Types

| Type | Purpose |
|---|---|
| `GenerateAuthModuleFileActionsInput` | Input bag: `template`, `eligibility`, `packageJsonContent`, optional `prismaSchemaContent`, optional `dotEnvExampleContent` |
| `AuthModuleGenerationError` | Typed error class with `code: AuthModuleGenerationErrorCode` and `name: 'AuthModuleGenerationError'` |

### Error Codes (`AuthModuleGenerationErrorCode`)

| Code | Trigger |
|---|---|
| `INELIGIBLE` | `eligibility.eligible === false` — generation refused before any work |
| `MALFORMED_PACKAGE_JSON` | `packageJsonContent` fails `JSON.parse` or is not a plain object |
| `UNSAFE_TEMPLATE_PATH` | A template file path fails the safe relative path check |
| `FORBIDDEN_TEMPLATE_CONTENT` | Generated content for any file contains a forbidden platform token |

### Input Shape

```
{
  template: AuthTemplate                      // from AUTH-MODULE-01A registry
  eligibility: AuthModuleEligibilityResult    // from AUTH-MODULE-01B detection
  packageJsonContent: string                  // existing workspace package.json raw text
  prismaSchemaContent?: string | null         // optional existing prisma/schema.prisma content
  dotEnvExampleContent?: string | null        // optional existing .env.example content
}
```

### Output Shape

`WorkspaceFileAction[]` — only `create` and `update` actions; no `delete` actions ever emitted.

---

## Package.json Merge Summary

- Parses existing `package.json` via `JSON.parse`; throws `AuthModuleGenerationError('MALFORMED_PACKAGE_JSON')` on failure.
- Preserves all existing top-level fields (`name`, `version`, `scripts`, `dependencies`, `devDependencies`, etc.) unchanged.
- Iterates `template.manifest.dependencies`; for each entry:
  - Skips if the package name already appears in either `dependencies` or `devDependencies` (existing version is never overwritten).
  - If missing, adds the template version to the correct bucket (`dependency` → `dependencies`, `devDependency` → `devDependencies`).
- Serializes the merged object with `JSON.stringify(…, null, 2)` + trailing newline.
- Emits an `update` action for `package.json`.

---

## Prisma Schema Handling Summary

| Scenario | Action type | Behaviour |
|---|---|---|
| No existing schema (null / empty) | `create` | Full template schema (`PRISMA_SCHEMA_CONTENT`) emitted as-is |
| Existing schema, all four Auth.js models present | `update` | Content returned unchanged |
| Existing schema, one or more Auth.js models missing | `update` | Missing model blocks appended after `trimEnd()` of existing content, separated by blank lines |

Auth.js model names checked: `User`, `Account`, `Session`, `VerificationToken`.

Duplicate detection uses a per-model regex anchored to `^model <Name> {` in multiline mode. Only models absent from the existing schema are appended.

---

## `.env.example` Handling Summary

| Scenario | Action type | Behaviour |
|---|---|---|
| No existing content (null / empty) | `create` | Full template `.env.example` content emitted as-is |
| Existing content, all required vars present | `update` | Content returned unchanged |
| Existing content, one or more vars missing | `update` | Missing `KEY=example` lines appended under a `# Auth.js / NextAuth` comment |

Existing var detection uses a per-line `KEY=` regex. Duplicate env lines are never emitted.

---

## Safety Guards

- **Path safety:** every template file path is checked with `isSafeRelativePath` before emission; throws `UNSAFE_TEMPLATE_PATH` on failure.
- **Content safety:** every generated content string (package.json, prisma schema, .env.example, all other files) is scanned for forbidden platform tokens; throws `FORBIDDEN_TEMPLATE_CONTENT` on any match.
- **Ineligibility guard:** throws `INELIGIBLE` immediately if `eligibility.eligible === false`; no partial output is produced.

---

## Tests Summary (`auth-module-generator.test.ts`)

8 tests using Node `node:test` style, consistent with existing frontend test conventions.

| # | Test |
|---|---|
| 1 | Clean eligible Next.js project generates required file actions (all template paths present, `package.json` included, no `delete` actions) |
| 2 | Ineligible project throws `AuthModuleGenerationError` with code `INELIGIBLE`; no actions produced |
| 3 | `package.json` dependency merge preserves existing dependencies, scripts, and metadata fields |
| 4 | `package.json` dependency merge adds all auth `dependencies` and `devDependencies` to a clean project |
| 5 | Existing Prisma schema without Auth.js models receives `update` action containing all four Auth.js model blocks alongside original models |
| 6 | Existing Prisma schema containing all Auth.js models receives `update` action with no duplicated model blocks |
| 7 | All generated action paths pass `isSafeRelativePath` check |
| 8 | Combined generated content contains none of the seven forbidden platform auth tokens |

Forbidden platform tokens asserted absent in test 8:
- `aisandbox_session`
- `aisandbox_csrf`
- `X-Internal-Service-Key`
- `SessionCookieGuard`
- `CsrfGuard`
- `PreviewOwnershipGuard`
- `aisandbox_oauth_state`

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | **PASS** |
| `npm test` | `frontend/` | **PASS — 408 tests, 408 passed, 0 failed, 35 suites** |
| `ReadLints` on both new files | — | **PASS — 0 errors** |

`npm test` includes all three auth-module test files:
- `auth-template-registry.test.ts` (from AUTH-MODULE-01A)
- `auth-module-detection.test.ts` (from AUTH-MODULE-01B)
- `auth-module-generator.test.ts` (this slice)

Previous baseline (AUTH-MODULE-01B): 400 tests. This slice adds 8, bringing the total to 408.

`npm run build` not required — this slice creates no runtime code, introduces no new imports into any built file, and changes no build config.

---

## Non-Goals Confirmed

- No AUTH-MODULE-01D/E/Z implementation
- No framework detection changes
- No live install/apply flow
- No `readWorkspaceFile` / `writeWorkspaceFile` integration
- No AI prompt recognition
- No backend/API changes
- No platform dependency changes
- No generated-app runtime execution
- No readWorkspaceFile, fetch, or IO calls in the generator
- No changes to existing frontend, backend, or auth platform source files

---

## Invariants Preserved

- All existing 400 tests continue to pass (408 total with 8 new)
- `frontend/package.json` runtime behavior (`dev`, `build`, `start`, `lint`) unchanged
- `tsc --noEmit` 0-error baseline maintained
- aiSandBox platform auth tokens (`aisandbox_session`, `aisandbox_csrf`, guards) have zero presence in new files
- AUTH-MODULE-01A registry files unchanged
- AUTH-MODULE-01B detection files unchanged

---

## Carry-Forwards

None. AUTH-MODULE-01C is clean.

---

## Next Task

**AUTH-MODULE-01D — Auth Module Install Flow Integration**

- Wire `handleInstallAuthModule` into `frontend/app/[locale]/app/page.tsx`
- Pre-install named checkpoint before file writes
- Eligibility detection via `detectAuthModuleEligibility` (AUTH-MODULE-01B)
- File action generation via `generateAuthModuleFileActions` (AUTH-MODULE-01C)
- Apply via `applySequentialFileActions` with existing confirmation guard
- Post-apply coherence / checkpoint / refresh
- Surface setup instructions in chat thread
- No bypass of `isRiskyFileActionBatch` or `acquireExecutionApplyGuard`
- `npm run build` required for this slice (touches `page.tsx`)

---

## Reference

- `docs/AUTH-MODULE-01A-CHECKPOINT.md` — Auth Template Registry Foundation
- `docs/AUTH-MODULE-01B-CHECKPOINT.md` — Framework Detection & Eligibility Check
- `docs/AUTH-MODULE-01-CHECKPOINT.md` — parent family summary (created at AUTH-MODULE-01Z)
- `TASKS.md` → AUTH-MODULE-01C
- `TASKS_BACKLOG_FULL.md` → AUTH-MODULE-01C
