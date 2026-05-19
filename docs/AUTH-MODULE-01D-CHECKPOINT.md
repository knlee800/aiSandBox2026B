# AUTH-MODULE-01D Checkpoint — Auth Module Install Flow Integration

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-MODULE-01D |
| Title | Auth Module Install Flow Integration |
| Family | AUTH |
| Parent | AUTH-MODULE-01 — Reusable App-Auth Module for aiSandBox-Created Apps |
| Status | COMPLETE and LOCKED |
| Nature | FRONTEND ONLY — `page.tsx` orchestration wiring + `WorkspaceShell` prop contract; no backend or API changes |
| Date | 2026-05-19 |
| Depends on | AUTH-MODULE-01C (COMPLETE and LOCKED — `docs/AUTH-MODULE-01C-CHECKPOINT.md`) |

---

## Objective

Wire the auth module install flow into the workspace. Expose a callable `handleInstallAuthModule` function in `frontend/app/[locale]/app/page.tsx` that: creates a pre-install named checkpoint, reads required and optional workspace context files, runs eligibility detection, generates file actions, applies them through the existing `maybeApplyExecutionFileActions` / `applySequentialFileActions` confirmation flow, and surfaces an assistant summary message in the chat thread. Wire the coherence checkpoint description resolver to emit `AUTH_MODULE_INSTALL_CHECKPOINT_DESCRIPTION` for auth-module executions. Pass `onInstallAuthModule` down to `WorkspaceShell` as a typed optional prop.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | **Modified** — imports, constants, ref, reset, coherence resolver, `handleInstallAuthModule`, prop pass-through |
| `frontend/components/workspace/workspace-shell.tsx` | **Modified** — `WorkspaceShellProps` extended with `onInstallAuthModule?: () => void \| Promise<void>` |
| `frontend/components/workspace/workspace-shell.test.tsx` | **Modified** — tests added/updated for new constants, ref, reset, coherence resolver, install flow, prop contract |
| `docs/AUTH-MODULE-01D-CHECKPOINT.md` | **Created** — this document |
| `TASKS.md` | Updated — AUTH-MODULE-01D COMPLETE and LOCKED; AUTH-MODULE-01E ACTIVE; stage updated |
| `TASKS_BACKLOG_FULL.md` | Updated — mirrored from TASKS.md |

**Production source files changed during consolidation: None.**

---

## Install Flow Summary (`handleInstallAuthModule`)

### Pre-flight Checks

- Verifies auth is present (`auth`)
- Verifies session is present (`session`)
- Verifies session is active
- Verifies file surface is ready (`workspaceFileTree` populated)

### Context Reads

| File | Required | Source |
|---|---|---|
| `package.json` | Required | `readWorkspaceFile('package.json')` — aborts if missing |
| `prisma/schema.prisma` | Optional | `readWorkspaceFile('prisma/schema.prisma')` — null if absent |
| `.env.example` | Optional | `readWorkspaceFile('.env.example')` — null if absent |

### Lockfile Extraction

- Inspects root nodes of `workspaceFileTree` for presence of `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`
- Passed to `detectAuthModuleEligibility` as `lockfileNames`

### Eligibility Detection

- Calls `detectAuthModuleEligibility({ packageJsonContent, lockfileNames })`
- Aborts with error chat message if `eligible === false`

### Pre-install Checkpoint

- Creates a named checkpoint using `AUTH_MODULE_PREINSTALL_CHECKPOINT_DESCRIPTION` before any file writes
- Calls checkpoint refresh after creation

### Template Selection and Generation

- Selects `AUTH_TEMPLATES_V1[0]` as the template
- Calls `generateAuthModuleFileActions({ template, eligibility, packageJsonContent, prismaSchemaContent, dotEnvExampleContent })`
- `AuthModuleGenerationError` caught and surfaced as error chat message

### Execution Wiring

- Constructs a synthetic `executionId` and wires it into existing refs:
  - `executionStatusRef` — set to `"status"`
  - `activeExecutionIdRef` — set to synthetic `executionId`
  - `authModuleExecutionIdsRef` — records `executionId` for coherence resolver lookup
- Attaches generated `WorkspaceFileAction[]` to `pendingExecutionFileActionsRef`

### Assistant Summary Message

- Posts assistant message to chat thread including:
  - `executionId`
  - Action count summary (files to create/update)
  - Setup instructions prompt

### Apply Path

- Calls `maybeApplyExecutionFileActions(executionId, "status")` — routes through the existing apply-guard and confirmation flow
- No direct file writes; no bypass of `isRiskyFileActionBatch` or `acquireExecutionApplyGuard`

---

## Coherence Checkpoint Description Resolver

`maybeRunExecutionCoherence` checkpoint description now resolves by priority:

| Condition | Description Used |
|---|---|
| Execution is a visual edit | `VISUAL_EDIT_CHECKPOINT_DESCRIPTION` |
| Execution ID is in `authModuleExecutionIdsRef` | `AUTH_MODULE_INSTALL_CHECKPOINT_DESCRIPTION` |
| All other executions | `AI_AUTO_CHECKPOINT_DESCRIPTION` |

### New Constants

| Constant | Value |
|---|---|
| `AUTH_MODULE_PREINSTALL_CHECKPOINT_DESCRIPTION` | `"Auth module install — pre-install snapshot"` (exact value as implemented) |
| `AUTH_MODULE_INSTALL_CHECKPOINT_DESCRIPTION` | `"Auth module installed"` (exact value as implemented) |

### New Ref

| Ref | Type | Purpose |
|---|---|---|
| `authModuleExecutionIdsRef` | `React.MutableRefObject<Set<string>>` | Tracks synthetic execution IDs originating from auth module install; used by coherence resolver |

- Reset clears `authModuleExecutionIdsRef` (`.current = new Set()`)

---

## Checkpoint Strategy

| Checkpoint | Trigger | Description Used |
|---|---|---|
| Pre-install | Before `generateAuthModuleFileActions` + apply | `AUTH_MODULE_PREINSTALL_CHECKPOINT_DESCRIPTION` |
| Post-apply coherence | After `maybeApplyExecutionFileActions` completes | `AUTH_MODULE_INSTALL_CHECKPOINT_DESCRIPTION` |

---

## File-Action Safety Summary

- No direct file writes added to `page.tsx`
- All generated actions route through `maybeApplyExecutionFileActions` → `applySequentialFileActions`
- `isRiskyFileActionBatch` logic unchanged and enforced on generated action array
- `acquireExecutionApplyGuard` path unchanged
- Risk confirmation dialog remains intact for any risky batch detected
- `generateAuthModuleFileActions` itself guards: path safety, content safety, ineligibility — throws `AuthModuleGenerationError` before any actions are returned if violated
- No backend/API changes

---

## Tests Added / Updated (`workspace-shell.test.tsx`)

| # | Test |
|---|---|
| 1 | `AUTH_MODULE_PREINSTALL_CHECKPOINT_DESCRIPTION` constant exists and is a non-empty string |
| 2 | `AUTH_MODULE_INSTALL_CHECKPOINT_DESCRIPTION` constant exists and is a non-empty string |
| 3 | `authModuleExecutionIdsRef` exists on the component instance |
| 4 | Reset clears `authModuleExecutionIdsRef` (set becomes empty) |
| 5 | Coherence description resolves to `AUTH_MODULE_INSTALL_CHECKPOINT_DESCRIPTION` for auth-module execution IDs |
| 6 | `handleInstallAuthModule` reads `package.json` via `readWorkspaceFile` |
| 7 | `handleInstallAuthModule` calls `detectAuthModuleEligibility` with extracted lockfile names |
| 8 | `handleInstallAuthModule` calls `generateAuthModuleFileActions` with template and eligibility |
| 9 | Pre-install checkpoint appears before `maybeApplyExecutionFileActions` call |
| 10 | Routes through `maybeApplyExecutionFileActions` with synthetic execution ID |
| 11 | `WorkspaceShellProps` includes `onInstallAuthModule?: () => void \| Promise<void>` |
| 12 | `WorkspaceShell` renders without error when `onInstallAuthModule` prop is provided |
| 13 | Visual-edit checkpoint description test updated to allow auth-module branch in resolver |

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | **PASS** |
| `npm test` | `frontend/` | **PASS — 418 tests, 418 passed, 0 failed** |
| `npm run build` | `frontend/` | **PASS** |
| `git restore -- frontend/tsconfig.tsbuildinfo` | repo root | Completed after build |
| `ReadLints` on touched files | — | **PASS — 0 errors** |

Previous baseline (AUTH-MODULE-01C): 408 tests. This slice adds 10 net-new tests, bringing the total to 418.

---

## Non-Goals Confirmed

- No AUTH-MODULE-01E/Z implementation
- No prompt recognition
- No natural-language trigger routing
- No backend/API changes
- No confirmation bypass
- No direct file writes outside existing helpers
- No generated-app dependency install
- No migrations run
- No new platform dependencies
- No UI trigger added (AUTH-MODULE-01E owns prompt recognition / UX trigger)

---

## Invariants Preserved

- All existing 408 tests continue to pass (418 total with 10 new)
- `frontend/package.json` runtime behavior (`dev`, `build`, `start`, `lint`) unchanged
- `tsc --noEmit` 0-error baseline maintained
- `npm run build` passes
- `isRiskyFileActionBatch` and `acquireExecutionApplyGuard` paths unchanged
- aiSandBox platform auth tokens have zero presence in new code
- AUTH-MODULE-01A, 01B, 01C files unchanged
- No checkpoint bypass — pre-install snapshot lands before any file writes

---

## Carry-Forwards

None. AUTH-MODULE-01D is clean.

---

## Next Task

**AUTH-MODULE-01E — AI Prompt Recognition & UX Polish**

- Detect when a user's chat prompt expresses auth module intent ("add authentication", "add login", "add signup", etc.)
- Route matched prompts to `handleInstallAuthModule` instead of raw AI generation
- Add chat-thread messaging for install progress and completion
- Add i18n keys if needed
- Must have low false-positive rate — must not hijack unrelated prompts
- Depends on: AUTH-MODULE-01D (COMPLETE and LOCKED — `docs/AUTH-MODULE-01D-CHECKPOINT.md`)
- Checkpoint: `docs/AUTH-MODULE-01E-CHECKPOINT.md` (not yet created)

---

## Reference

- `docs/AUTH-MODULE-01A-CHECKPOINT.md` — Auth Template Registry Foundation
- `docs/AUTH-MODULE-01B-CHECKPOINT.md` — Framework Detection & Eligibility Check
- `docs/AUTH-MODULE-01C-CHECKPOINT.md` — Template File Generation Engine
- `docs/AUTH-MODULE-01-CHECKPOINT.md` — parent family summary (created at AUTH-MODULE-01Z)
- `TASKS.md` → AUTH-MODULE-01D
- `TASKS_BACKLOG_FULL.md` → AUTH-MODULE-01D
