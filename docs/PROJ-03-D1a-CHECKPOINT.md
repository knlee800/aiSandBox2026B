# PROJ-03-D1a CHECKPOINT

## Task Metadata

- **Task ID:** PROJ-03-D1a
- **Title:** Add Unified Versions Entry Point And Last-Protected Indicator Behind Feature Flag
- **Nature:** FRONTEND / UX DISCOVERABILITY
- **Status:** COMPLETE and LOCKED
- **Checkpoint:** `docs/PROJ-03-D1a-CHECKPOINT.md`
- **Source:** Post-D0e-hotfix gap: the platform now has multiple layered protection mechanisms (project history, named saves, restore, autosaves, AI autosave cadence hotfix, tab-scoped editor draft persistence) but no single obvious user-facing entry point to discover them. Users lack a clear "I can always go back" reassurance signal.
- **Depends on:** PROJ-03-D0e-hotfix (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, add one obvious user-facing "Versions" entry point and one small "Last protected" reassurance indicator so users can discover the existing version/history protection model without changing backend behavior or redesigning the entire project history UX.

## Files Changed

| File | Change |
|---|---|
| `frontend/lib/recovery-copy.ts` | Two new copy constants added. |
| `frontend/components/workspace/workspace-shell.tsx` | `ProjectHistoryPanel` updated with Versions badge and Last protected indicator. |
| `frontend/components/workspace/workspace-shell.test.tsx` | Three focused tests added. |

**No new props were added.**

**No backend/API/schema changes were made. No new routes. No new backend calls. No new effects or state additions. No save/restore semantic changes.**

## Locked Scope Actually Implemented

This is a UX-only additive change. All handler semantics, backend calls, autosave flows, save/restore flows, route structure, and legacy code paths are untouched.

### `frontend/lib/recovery-copy.ts`

Two new string constants added to `recoveryCopy.workspace`:

```ts
versionsEntryPoint: 'Versions',
lastProtected: 'Last protected',
```

No existing strings removed or renamed.

### `frontend/components/workspace/workspace-shell.tsx`

Inside the existing `ProjectHistoryPanel` function only. No structural changes outside this function.

#### 1. Derived latest row variable (inside the function body, after the early return)

```ts
const latestHistoryRow = props.rows[0] ?? null;
```

Uses already-passed `props.rows` — no new props.

#### 2. Versions badge added to the existing `Project History` header

The existing single `<p>` heading was wrapped in a `<div className="flex items-center gap-2">` alongside a new `<span>` badge:

```tsx
<div className="flex items-center gap-2">
  <p className="text-xs font-semibold text-gray-700">Project History</p>
  <span
    className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700"
    data-testid="history-project-history-entrypoint"
  >
    {recoveryCopy.workspace.versionsEntryPoint}
  </span>
</div>
```

#### 3. Last protected indicator (between the header row and the rows list)

Renders only when `latestHistoryRow` is non-null (i.e. at least one project history row exists for this project):

```tsx
{latestHistoryRow ? (
  <p
    className="mt-2 text-[11px] text-gray-500"
    data-testid="history-project-history-last-protected"
  >
    {recoveryCopy.workspace.lastProtected}:{' '}
    <time dateTime={latestHistoryRow.createdAt}>
      {formatProjectHistoryTimestamp(latestHistoryRow.createdAt)}
    </time>
  </p>
) : null}
```

Uses the existing `formatProjectHistoryTimestamp` utility already used in the rows list. Does not render when there are no history rows — no misleading text.

### `frontend/components/workspace/workspace-shell.test.tsx`

Three focused tests added immediately after the existing `'renders project history rows in deterministic newest-first order behind feature flag'` test:

1. **`'renders versions entry point in project history surface behind feature flag'`** — verifies `data-testid="history-project-history-entrypoint"` renders with text `'Versions'` when flag is on and project has history rows.
2. **`'renders last protected indicator from latest project history row'`** — verifies `data-testid="history-project-history-last-protected"` renders with `'Last protected'` label and a year-containing timestamp when flag is on and rows exist.
3. **`'does not render versions entry point or last protected indicator when feature flag is off'`** — verifies neither `history-project-history-entrypoint` nor `history-project-history-last-protected` appears in the rendered HTML when `projectFirstUxEnabled=false`.

## Unchanged Code

| Area | Status |
|---|---|
| All save/history/restore handlers | Unchanged |
| `frontend/app/[locale]/app/page.tsx` | Unchanged |
| `frontend/lib/project-autosave.ts` | Unchanged |
| `frontend/lib/autosave-rate-limit.ts` | Unchanged |
| `frontend/lib/project-named-save.ts` | Unchanged |
| `frontend/lib/open-project-in-fresh-session.ts` | Unchanged |
| `frontend/components/workspace/workspace-snapshots.logic.ts` | Unchanged |
| All locked Phase A/B/C1/C2a/C2b/C2c/C2d-expiry-warn/C2e/C2f-file-save/C4/D0/D0b/D0c/D0d/C2e-hotfix/D0e/D0e-hotfix paths | Unchanged |

## Validation

### 1. TypeScript typecheck

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 2. Focused regression suite

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npx tsx --test components/workspace/workspace-shell.test.tsx lib/project-autosave.test.ts lib/project-named-save.test.ts lib/autosave-rate-limit.test.ts lib/open-project-in-fresh-session.test.ts components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts
```

Result: **PASS** — 153/153 tests passing, 0 failures (3 new tests, 150 prior tests). No regressions.

### 3. Targeted lint attempt

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npm run lint -- --file "components/workspace/workspace-shell.tsx" --file "lib/recovery-copy.ts" --file "components/workspace/workspace-shell.test.tsx"
```

Result: Same known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by this task. Same issue documented in all prior PROJ-03 checkpoints from A0 onward.

Fallback: `ReadLints` on all three changed files — **no linter errors found**.

### 4. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run. Restored via `git restore -- "frontend/tsconfig.tsbuildinfo"` so the working-tree diff is limited to the three changed production/test files.

## Honest Note

This is UX-only and additive:

- Reuses existing `props.rows` (already derived from `workspaceSnapshots` and `selectedProjectId` via `computeProjectHistoryRows`) and the existing `formatProjectHistoryTimestamp` utility.
- Adds no backend calls, no new routes, no new effects, no new state, and no save/restore semantic changes.
- The Versions badge is attached to the existing `ProjectHistoryPanel` header which is already flag-gated to `PROJECT_FIRST_UX`.
- The Last protected indicator renders only when at least one project history row exists — no misleading reassurance text when history is empty.
- The entire addition is invisible when `PROJECT_FIRST_UX=false` — it is gated by `ProjectHistoryPanel`'s existing `if (!props.projectFirstUxEnabled ...) return null` guard.

## Preserved Invariants

| Invariant | Status |
|---|---|
| UX-only discoverability/reassurance slice only | ✅ |
| No backend/history semantic changes | ✅ |
| `PROJECT_FIRST_UX` remains the kill-switch posture | ✅ Flag off: byte-identical to pre-D1a |
| No new props added | ✅ |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| No broader D1 redesign | ✅ Not implemented |
| No C3 work | ✅ Not implemented |
| No C2d-unload work | ✅ Not implemented |
| No true editor autosave-to-disk | ✅ Not implemented |
| No unload handling | ✅ Not implemented |
| No later-phase work | ✅ UX discoverability/reassurance only |
