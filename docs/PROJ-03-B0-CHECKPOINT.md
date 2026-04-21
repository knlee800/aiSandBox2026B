# PROJ-03-B0 CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-B0
- Title: Add Fresh-Session-Open Helper Primitive Behind Feature Flag
- Nature: FRONTEND / PHASE B PRIMITIVE HELPER
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-B0-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase B — prerequisite helper slice
- Depends on: All PROJ-03 Phase A slices (A0, A1, A3, A2a, A2b) — all COMPLETE and LOCKED

## Objective

Introduce one frontend helper primitive for opening a project in a newly created fresh session, reusing existing session-create and project-open contracts, without switching any user-visible call site.

## Scope Statement

This is **helper-only, test-heavy, and introduces zero user-visible behavior change**. No user-facing call sites were switched in this slice. No UI component was modified. `frontend/app/[locale]/app/page.tsx` was inspected only and **remained unchanged**. `PROJECT_FIRST_UX` remains the only posture for later call sites; no UI wiring was performed. No later-phase work (B1/B2/B3/B4) was performed.

## Files Changed

| File | Change |
|---|---|
| `frontend/lib/open-project-in-fresh-session.ts` | New. Exports `openProjectInFreshSession(...)` async helper. |
| `frontend/lib/open-project-in-fresh-session.test.ts` | New. Six focused unit tests. |

No other source files were modified. `frontend/app/[locale]/app/page.tsx` unchanged.

## Helper Behavior

### Exported function

```ts
export async function openProjectInFreshSession(
  args: OpenProjectInFreshSessionArgs,
): Promise<OpenProjectInFreshSessionResult>
```

Args: `{ token, projectId, snapshotId?, fetchImpl? }`

Return: `{ projectId, sessionId, restoredSnapshotId }`

### Sequence (every step `await`ed, no fire-and-forget)

1. **Snapshot resolution** — if `snapshotId` is not explicitly provided, fetches the user's snapshot list via `loadWorkspaceSnapshots(...)` and resolves the latest project-scoped snapshot id via `resolveProjectScopedLatestSnapshotId(...)`. If an explicit `snapshotId` is provided, this fetch is skipped entirely.

2. **Fresh session creation** — calls `POST /api/sessions` directly (same contract as `handleCreateSession` in `page.tsx`). Throws on 403 with a specific quota-blocked message; throws with the API's own message on any other non-OK response.

3. **Project-open path** (branch on snapshot availability):
   - **With snapshot:** calls the existing `openWorkspaceProject(...)` from `workspace-projects.logic.ts`, passing the newly created session id and the resolved snapshot id. Returns its result directly.
   - **Without snapshot:** calls the existing `associateWorkspaceProjectSession(...)` from `workspace-projects.logic.ts` to bind the new session to the project. Returns `{ projectId, sessionId, restoredSnapshotId: null }`.

### Invariant maintained

The helper is plain async code. It has no React state, no `projectOpenInProgressRef`, no component dependencies. The call sites in B1/B2/B3 that eventually invoke it will set/clear `projectOpenInProgressRef` around the call — that remains the component's responsibility, not the helper's.

## Test Coverage

Six tests in `frontend/lib/open-project-in-fresh-session.test.ts`:

| Test | What it proves |
|---|---|
| `creates one session and opens the project with the new session id` | `POST /api/sessions` called once; `POST /api/projects/:id/open` called once with the session id returned from create; body contains correct `sessionId` and `snapshotId` |
| `uses the associate path when no project snapshot exists` | When snapshot list is empty, falls back to `POST /api/projects/:id/sessions/:sessionId`; `restoredSnapshotId` is `null` |
| `awaits the full open sequence with no fire-and-forget open call` | After create and open calls have been made, the outer promise is still pending while the open deferred is unresolved; resolves only after the deferred resolves |
| `throws on session-create failure before calling the project-open path` | 403 response throws quota message; only snapshot-fetch and session-create calls are made; open-project path is never reached |
| `throws an identifiable error when the project-open call fails` | Non-2xx from open-project endpoint propagates the API error message |
| `skips snapshot lookup when an explicit snapshot id is provided` | When `snapshotId` arg is given, only 2 calls are made (session-create + open); no snapshot list fetch |

Test runner: `node:test` + `npx tsx --test` (same pattern as all other `workspace-*.logic.test.ts` files in the repo).

## Validation

### 1. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no errors.

### 2. Focused tests (helper + adjacent primitives it composes)

```
frontend $ npx tsx --test lib/open-project-in-fresh-session.test.ts components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts
```

Result: **PASS** — 22 tests / 3 suites, 0 failures.
- `workspace-projects.logic` — 8/8 pass
- `workspace-snapshots.logic` — 8/8 pass
- `open-project-in-fresh-session` — 6/6 pass

### 3. Targeted lint attempt

```
frontend $ npm run lint -- --file lib/open-project-in-fresh-session.ts --file lib/open-project-in-fresh-session.test.ts
```

Result: Same known pre-existing `next lint` script-path issue: `Couldn't find any pages or app directory` (same issue documented in A0, A1, A3, A2a, A2b checkpoints; not introduced by B0).

### 4. File-level lint check

`ReadLints` run on:
- `frontend/lib/open-project-in-fresh-session.ts` — no linter errors
- `frontend/lib/open-project-in-fresh-session.test.ts` — no linter errors

### 5. Cleanup note

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run and restored via `git restore` so the working-tree diff is limited to the two new B0 source files.

## Preserved Invariants

| Invariant | Status |
|---|---|
| No user-visible behavior change in this slice | ✅ Helper has no UI callers; zero behavior change |
| `PROJECT_FIRST_UX` is only posture for later call sites; no UI wiring yet | ✅ Not imported or referenced in the helper |
| `frontend/app/[locale]/app/page.tsx` unchanged | ✅ Inspected only |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ `handleOpenWorkspaceProject` and `projectOpenInProgressRef` not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| No B1/B2/B3/B4 or later-phase work | ✅ Helper-only and test-heavy; this slice is complete |
