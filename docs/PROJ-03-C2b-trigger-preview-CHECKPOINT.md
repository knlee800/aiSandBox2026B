# PROJ-03-C2b-trigger-preview CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-C2b-trigger-preview
- Title: Add Preview-Start Success Autosave Trigger Behind Feature Flag
- Nature: FRONTEND / PHASE C AUTOSAVE TRIGGER — PREVIEW-START SUCCESS
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-C2b-trigger-preview-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2 first behavioral trigger slice
- Depends on: PROJ-03-C2a-rate-limit (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, after a successful preview-start in `handleStartPreview`, attempt one project-scoped snapshot via the existing `saveWorkspaceSnapshot` fetcher and the locked C2a `shouldAllowAutosaveNow` rate-limit, then reload the user's snapshot list so the new row appears in the locked C1a `ProjectHistoryPanel`. Skip silently when the flag is off, when no project or session is selected, when project-open hydration is in progress, when rate-limited, or when the save fails.

**This is the first autosave write trigger to land in Phase C.** It is narrowly bounded to preview-start success only.

## Scope Statement

C2b-trigger-preview introduces two new files and makes additive changes to one existing file. No UI surface was changed. No existing handlers, fetchers, or lock-paths were modified. No C2c/C2d/C2e/C2f, C3, C4, or later-phase work was performed.

`TASKS.md` and `TASKS_BACKLOG_FULL.md` were not edited during the implementation step; they are updated only in this consolidation.

## Files Changed

| File | Change |
|---|---|
| `frontend/lib/project-autosave.ts` | New. Exports `ProjectAutosaveResult` type and `attemptProjectAutosave` helper. |
| `frontend/lib/project-autosave.test.ts` | New. Six focused unit tests under `node:test`. |
| `frontend/app/[locale]/app/page.tsx` | Additive only. One new import, one new `useRef`, one guarded autosave block. |

No other source files were modified. `frontend/components/workspace/workspace-shell.tsx`, `frontend/lib/recovery-copy.ts`, `frontend/components/workspace/workspace-snapshots.logic.ts`, `handleSaveWorkspaceSnapshot`, and `frontend/lib/open-project-in-fresh-session.ts` are all unchanged.

## Implementation Details

### `frontend/lib/project-autosave.ts`

```ts
import { shouldAllowAutosaveNow } from './autosave-rate-limit';
import {
  buildProjectScopedSnapshotLabel,
  saveWorkspaceSnapshot,
  type WorkspaceSnapshotSummary,
} from '../components/workspace/workspace-snapshots.logic';

export type ProjectAutosaveResult =
  | { status: 'saved'; savedSnapshot: WorkspaceSnapshotSummary }
  | { status: 'skipped-rate-limited' }
  | { status: 'failed' };

export async function attemptProjectAutosave(args: {
  token: string;
  sessionId: string;
  projectId: string;
  now: number;
  lastAutosaveAt: number | null;
  minIntervalMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<ProjectAutosaveResult> {
  if (
    !shouldAllowAutosaveNow({
      now: args.now,
      lastSnapshotAt: args.lastAutosaveAt,
      minIntervalMs: args.minIntervalMs,
    })
  ) {
    return { status: 'skipped-rate-limited' };
  }

  try {
    const savedSnapshot = await saveWorkspaceSnapshot({
      token: args.token,
      sessionId: args.sessionId,
      label: buildProjectScopedSnapshotLabel(args.projectId),
      fetchImpl: args.fetchImpl,
    });
    return { status: 'saved', savedSnapshot };
  } catch (error) {
    console.error('Failed to autosave project snapshot:', error);
    return { status: 'failed' };
  }
}
```

**Design decisions:**
- Uses locked C2a `shouldAllowAutosaveNow` as the sole rate-limit gate. No duplicate interval logic.
- Reuses existing `saveWorkspaceSnapshot` and `buildProjectScopedSnapshotLabel` from `workspace-snapshots.logic.ts` — no new fetcher, no new endpoint reference.
- `fetchImpl` is injectable for deterministic unit testing (mirrors the pattern from `open-project-in-fresh-session.ts` and `workspace-snapshots.logic.ts`).
- `lastAutosaveAt` is accepted as a caller-supplied integer, keeping state storage out of the helper (consistent with C2a's design for `lastSnapshotAt`).
- Save errors are caught and returned as `{ status: 'failed' }` — the helper never re-throws. This ensures a snapshot failure cannot propagate into the outer `handleStartPreview` catch block (which would set `previewState` to `'error'`).
- Named exports only; no default export (consistent with other `frontend/lib` helpers).

### `frontend/lib/project-autosave.test.ts`

Six focused tests using `node:test` + `node:assert/strict` with injectable `fetchImpl`:

| # | Test | What it proves |
|---|---|---|
| 1 | `returns skipped-rate-limited and does not call save when under the default interval` | `now: 59_999`, `lastAutosaveAt: 0` → `skipped-rate-limited`; `fetchImpl` not called |
| 2 | `returns saved and calls save once with the project-scoped snapshot label` | `now: 60_000`, `lastAutosaveAt: 0` → `saved`; `fetchImpl` called once with correct URL and `[project-id:project-1]` label in body |
| 3 | `returns failed when save fetch rejects` | `fetchImpl` throws `'network down'` → `failed`; no re-throw |
| 4 | `returns failed when save returns a non-ok response` | `fetchImpl` returns HTTP 500 → `failed`; no re-throw |
| 5 | `honors a custom minIntervalMs override` | `minIntervalMs: 10`; `now: 9` → skipped; `now: 10` → saved; `fetchImpl` called exactly once |
| 6 | `allows autosave when lastAutosaveAt is null` | `now: 0`, `lastAutosaveAt: null` → saved (delegates to C2a's null-allowed contract) |

Tests 3 and 4 use a `withPatchedConsoleError` helper to suppress the expected `console.error` output produced by the helper's catch block, keeping the test output clean.

### `frontend/app/[locale]/app/page.tsx` — additive changes

**Three additive touches, no existing code altered:**

1. **New import** (line 8):
```ts
import { attemptProjectAutosave } from '@/lib/project-autosave';
```

2. **New ref** (immediately after `projectOpenInProgressRef`):
```ts
const lastProjectAutosaveAtRef = useRef<number | null>(null);
```

3. **Guarded autosave block** inside `handleStartPreview`'s `try` branch, after `await refreshPreviewForSession(token, selectedSessionId)`:
```ts
if (
  PROJECT_FIRST_UX &&
  selectedProjectId &&
  selectedSessionId &&
  !projectOpenInProgressRef.current
) {
  const autosaveAttemptedAt = Date.now();
  const autosaveResult = await attemptProjectAutosave({
    token,
    sessionId: selectedSessionId,
    projectId: selectedProjectId,
    now: autosaveAttemptedAt,
    lastAutosaveAt: lastProjectAutosaveAtRef.current,
  });
  if (autosaveResult.status === 'saved') {
    lastProjectAutosaveAtRef.current = autosaveAttemptedAt;
    void loadWorkspaceSnapshotsForUser(token);
  }
}
```

**Guard conditions:**
- `PROJECT_FIRST_UX` — kill switch; autosave never runs when the flag is off.
- `selectedProjectId` — null guard; autosave skipped if no project is selected.
- `selectedSessionId` — null guard; autosave skipped if no session is selected (also redundant with the early return guard on line 3738, but kept independently for TypeScript narrowing and readability).
- `!projectOpenInProgressRef.current` — hydration discipline guard. `handleStartPreview` is not currently called from the project-open path, but this guard is mandatory to protect against future call-site additions and to preserve the invariant that no background write can race a project-open hydration sequence.

**On `saved`:** updates `lastProjectAutosaveAtRef.current` to the recorded attempt timestamp and triggers `void loadWorkspaceSnapshotsForUser(token)` so the new row appears in the locked C1a `ProjectHistoryPanel`.

**On `skipped-rate-limited` or `failed`:** no-op.

## Sequencing Note: `void loadWorkspaceSnapshotsForUser`

`void loadWorkspaceSnapshotsForUser(token)` is used (not `await`) after a successful autosave. This keeps the snapshot-list refresh best-effort and avoids letting a history-reload failure delay or interfere with an otherwise successful preview start. The successful autosave has already been committed to the backend at this point; the `void` only means the UI panel update is fire-and-forget — consistent with the autosave-as-background-operation design intent.

## No UI Change

This slice introduced no UI change. No new visible element, no toast, no banner, no status indicator, no string was added to `recovery-copy.ts`. The only observable effect when the flag is on is that the `ProjectHistoryPanel` (locked in C1a) gains a new auto-save row after a successful preview start — but that is a data effect from an existing component, not a new UI surface.

## Validation

### 1. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 2. Isolated unit tests

```
frontend $ npx tsx --test lib/project-autosave.test.ts
```

Result: **PASS** — 6 tests / 0 suites (top-level), 0 failures.

### 3. Full focused regression suite

```
frontend $ npx tsx --test lib/project-autosave.test.ts lib/autosave-rate-limit.test.ts lib/open-project-in-fresh-session.test.ts components/workspace/workspace-shell.test.tsx components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts
```

Result: **PASS** — 128 tests / 6 suites, 0 failures.

- `workspace-projects.logic` — 8/8 pass
- `workspace shell component` — 88/88 pass
- `workspace shell snapshot surface` — 3/3 pass
- `workspace-snapshots.logic` — 8/8 pass
- `autosave-rate-limit` — 9/9 pass
- `open-project-in-fresh-session` — 6/6 pass
- `project-autosave` — 6/6 pass (top-level, counted in total)

### 4. Targeted lint attempt

```
frontend $ npm run lint -- --file lib/project-autosave.ts --file lib/project-autosave.test.ts --file app/[locale]/app/page.tsx
```

Result: Same known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by C2b-trigger-preview. Same issue documented in all prior Phase A, B, and C checkpoints.

### 5. File-level lint check

`ReadLints` on all three changed source files: **no linter errors found**.

### 6. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run and restored via `git restore` so the working-tree diff is limited to the three changed files.

## Unchanged Code

| Area | Status |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | Unchanged |
| `frontend/lib/recovery-copy.ts` | Unchanged |
| `frontend/components/workspace/workspace-snapshots.logic.ts` | Unchanged |
| `handleSaveWorkspaceSnapshot` handler | Unchanged |
| `frontend/lib/open-project-in-fresh-session.ts` (B0 helper) | Unchanged |
| `frontend/lib/autosave-rate-limit.ts` (C2a locked helper) | Unchanged |
| All locked Phase A/B/C1 paths | Unchanged |

## Preserved Invariants

| Invariant | Status |
|---|---|
| This is the first autosave write trigger; bounded to preview-start success only | ✅ |
| `projectOpenInProgressRef` guard is present even though `handleStartPreview` is not in the open-path call chain | ✅ Guard is mandatory to protect against future call-site additions |
| In-memory ref only for last autosave timestamp in this slice | ✅ `lastProjectAutosaveAtRef` is a `useRef`; no `localStorage`, no persistence decision yet |
| Save failure swallowed into helper result, not surfaced as new UI | ✅ `{ status: 'failed' }` returned; `console.error` only |
| `PROJECT_FIRST_UX` remains the kill switch | ✅ Flag off → guard fails immediately → helper never called |
| No UI change | ✅ |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| No C2c/C2d/C2e/C2f, C3, C4, or Phase D/E work | ✅ |
