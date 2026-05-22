# AUTH-MODULE-03A Checkpoint — Pre-install Auth Module Checkpoint Missing

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-MODULE-03A |
| Title | Pre-install Auth Module Checkpoint Missing |
| Parent | AUTH-MODULE-03 — Auth Module Final Live Smoke Fixes |
| Family | AUTH |
| Status | COMPLETE and LOCKED |
| Nature | FULL-STACK — frontend, api-gateway, container-manager |
| Date | 2026-05-21 |
| Depends on | AUTH-MODULE-03 registration (DONE) |
| Checkpoint | `docs/AUTH-MODULE-03A-CHECKPOINT.md` |

---

## Objective

Fix the missing pre-install checkpoint in `handleInstallAuthModule`. A clean workspace (no staged changes) silently skipped the pre-install snapshot because `createWorkspaceCheckpoint` called `git commit` without `--allow-empty`, which exits with a non-zero code on a clean tree. The frontend then received `commitHash: null` and dropped the checkpoint without aborting or surfacing an error.

The fix threads `allowEmpty: true` from the frontend call site through every layer down to `GitService.commit()`, so that a real empty git commit is created even when the workspace has no pending changes. A `commitHash: null` guard was also added so `handleInstallAuthModule` aborts safely if the pre-install commit still fails for any reason.

---

## Root Cause

`GitService.commit()` in the container-manager called `git commit -m <message>` without `--allow-empty`. On a clean workspace this exits non-zero and no commit hash is produced. The api-gateway and frontend had no way to distinguish "clean tree, nothing to commit" from a real error, and both silently returned `commitHash: null`. `handleInstallAuthModule` did not check that return value before proceeding to write auth files, so it continued without a valid rollback point.

---

## Files Changed

### Source

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-checkpoint-create.logic.ts` | Added `allowEmpty?: boolean` parameter to `createWorkspaceCheckpoint()`; forwarded in request body |
| `frontend/app/[locale]/app/page.tsx` | `handleInstallAuthModule` now captures `preinstallResult`; passes `allowEmpty: true` to pre-install checkpoint call; adds null-guard: aborts with error message if `preinstallResult.commitHash` is null; `loadCheckpoints` runs only after confirming non-null commit hash |
| `services/api-gateway/src/checkpoints/checkpoints.controller.ts` | Added `allowEmpty?: boolean` to `CreateCheckpointDto`; forwarded to `checkpointsService.createCheckpoint()` |
| `services/api-gateway/src/checkpoints/checkpoints.service.ts` | Added `allowEmpty?: boolean` parameter to `createCheckpoint()`; forwarded to `ContainerManagerHttpClient.createCheckpoint()` |
| `services/api-gateway/src/clients/container-manager-http.client.ts` | Added `allowEmpty?: boolean` to `createCheckpoint()` POST body; forwarded to container-manager request |
| `services/container-manager/src/git/git.controller.ts` | Added `allowEmpty?: boolean` extraction from `@Body()`; forwarded to `gitService.commit()` |
| `services/container-manager/src/git/git.service.ts` | Added `allowEmpty?: boolean` parameter to `commit()`; when true appends `--allow-empty` flag to the `git commit` exec call |

### Tests

| File | Change |
|---|---|
| `services/container-manager/src/git/git.service.spec.ts` | Added/updated tests: `allowEmpty: true` triggers `--allow-empty` flag; `allowEmpty: false/undefined` does not; clean-workspace + allowEmpty true yields a real commit hash; clean-workspace + allowEmpty false returns `commitHash: null` |
| `services/api-gateway/src/checkpoints/checkpoints.service.spec.ts` | Added/updated tests: `allowEmpty` forwarded through service to HTTP client; null commit hash handling; 11 tests total PASS |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added/updated tests: `handleInstallAuthModule` passes `allowEmpty: true`; null `commitHash` guard triggers abort; `loadCheckpoints` called only on non-null result |

---

## allowEmpty Threading Summary

```
frontend createWorkspaceCheckpoint({ allowEmpty: true })
  → POST /api/sessions/:id/checkpoints  { ..., allowEmpty: true }
    → CheckpointsController.createCheckpoint (DTO: allowEmpty)
      → CheckpointsService.createCheckpoint(sessionId, userId, description, allowEmpty)
        → ContainerManagerHttpClient.createCheckpoint(sessionId, userId, description, allowEmpty)
          → POST /api/git/:sessionId/checkpoint  { ..., allowEmpty: true }
            → GitController.createCheckpoint (@Body allowEmpty)
              → GitService.commit(workspacePath, message, allowEmpty)
                → git commit --allow-empty -m <message>
```

---

## GitService Empty-Commit Behavior Summary

| Scenario | `allowEmpty` | Behavior |
|---|---|---|
| Dirty workspace | any | Normal `git commit -m <message>` — commit created with staged/tracked changes |
| Clean workspace | `true` | `git commit --allow-empty -m <message>` — real empty commit created, commit hash returned |
| Clean workspace | `false` / `undefined` | `git commit -m <message>` — exits non-zero, `commitHash: null` returned |

Dirty workspace behavior is unchanged. The `--allow-empty` flag is only appended when `allowEmpty === true`.

---

## Frontend Pre-install Checkpoint Guard Summary

`handleInstallAuthModule` prior to this fix:

1. Called `createWorkspaceCheckpoint("Auth Module: pre-install snapshot")` — no `allowEmpty`
2. Did not capture the return value
3. Continued to write auth files regardless of whether a checkpoint was created

`handleInstallAuthModule` after this fix:

1. Calls `createWorkspaceCheckpoint("Auth Module: pre-install snapshot", { allowEmpty: true })`
2. Captures result as `preinstallResult`
3. Checks: if `preinstallResult.commitHash === null` → sets error message and returns early; no auth files are written
4. Calls `loadCheckpoints()` immediately after the pre-install commit to surface the new checkpoint in the UI
5. Only then proceeds to write auth template files

---

## Tests Added / Updated

| Suite | Count | Result |
|---|---|---|
| `services/container-manager` full test run | 5 suites, 38 tests | **PASS** |
| `services/api-gateway` checkpoints service | 11 tests | **PASS** |
| `frontend` workspace-shell targeted test | targeted suite | **PASS** |
| `frontend` full `npm test` | full suite | **PASS** |

---

## Validation Results

| Check | Result |
|---|---|
| `container-manager npm test` | **PASS — 5 suites, 38 tests** |
| `container-manager npm run build` | **PASS** |
| `api-gateway checkpoints.service npm test` | **PASS — 11 tests** |
| `api-gateway npm run build` | **PASS** |
| `frontend workspace-shell npm test` (targeted) | **PASS** |
| `frontend npm test` (full) | **PASS** |
| `frontend npx tsc --noEmit` | **PASS** |
| `ReadLints` on all touched files | **PASS — 0 new errors** |

---

## Live Verification PASS Evidence

### Item 5 — Pre-install snapshot visible in UI: PASS

- **Action:** Typed "add authentication to my app" in workspace chat
- **Expected:** Checkpoint "Auth Module: pre-install snapshot" appears in checkpoint panel before any file actions are approved
- **Observed:** Checkpoint "Auth Module: pre-install snapshot" (commit `ba03a2bc`) appeared in the checkpoint panel immediately after the prompt was processed, before any auth files were written
- **Result:** **PASS**

### Item 13 — Revert removes auth files and dependencies: PASS

- **Action:** Installed auth module (all 16 files written), then reverted to "Auth Module: pre-install snapshot"
- **Expected:** All 16 auth template files removed; `package.json` reverted to clean Next.js starter with no auth dependencies
- **Observed:** All 16 auth files removed; `package.json` reverted to clean Next.js starter with no auth dependencies
- **Result:** **PASS**

No browser console errors or server errors were reported during either verification run.

---

## Known Caveat — Environmental Build Issue

`frontend npm run build` failed with:

```
UNABLE_TO_VERIFY_LEAF_SIGNATURE
```

when fetching the `Inter` font from Google Fonts during the Next.js build optimization phase.

**Classification:** Environmental — TLS/certificate chain issue in the local dev environment preventing outbound HTTPS to `fonts.googleapis.com`. This is not caused by any AUTH-MODULE-03A logic change.

**Impact:** Zero. All TypeScript compilation, unit tests, and live browser verification passed. The build failure is a network-layer issue in the build host environment only.

---

## Non-Goals Confirmed

- No auth template changes
- No checkpoint flow redesign
- No new undo system
- No broad workspace history refactor
- No changes to dirty-workspace commit path
- No changes to any endpoint route registrations
- No changes to any other task's files

---

## Invariants Preserved

- `POST /api/sessions/:id/checkpoints` (create manual checkpoint) — unchanged for normal dirty-workspace use
- `GET /api/sessions/:id/checkpoints` (list checkpoints) — unchanged
- `GET /api/sessions/:id/checkpoints/:hash/diff` (get diff) — unchanged
- Clean workspace + `allowEmpty: false/undefined` still returns `commitHash: null` — no behavior change for callers not passing the flag
- `SessionCookieGuard` on all checkpoint endpoints — unchanged
- All existing container-manager session/docker/git service contracts — unchanged
- No breaking changes to existing checkpoint response shapes

---

## Next Task

**AUTH-MODULE-03B — Friendly Unsupported Message for Missing package.json**

Live smoke item 14 failed. A blank/non-Next.js workspace produced a raw backend error:

> "Auth module installation failed: unable to read package.json (File read failed (500))."

Expected: a friendly unsupported-project eligibility message. AUTH-MODULE-03B traces the `readWorkspaceFile` failure path and adds appropriate error mapping.

---

## Reference

- `TASKS.md` → AUTH-MODULE-03A
- `TASKS_BACKLOG_FULL.md` → AUTH-MODULE-03A
- Parent: AUTH-MODULE-03 — Auth Module Final Live Smoke Fixes
- Sibling (next): `docs/AUTH-MODULE-03B-CHECKPOINT.md` (not yet created)
