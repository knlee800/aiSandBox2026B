# UX-IA-38 CHECKPOINT — Hide Project Trust Note / Recoverable Box

**Task ID:** UX-IA-38
**Family:** UX-IA (Product & UX/UI Redesign — Evolutionary)
**Status:** COMPLETE and LOCKED
**Priority:** Low
**Nature:** FRONTEND-ONLY / PROJECT WORKSPACE CLUTTER CLEANUP
**Risk:** Low
**Depends on:** UX-IA-37 (COMPLETE and LOCKED — `docs/UX-IA-37-CHECKPOINT.md`)
**Date:** 2026-06-04

---

## Problem

The "Your project stays recoverable..." trust note box (`data-testid="workspace-trust-note"`) appeared in the Project Workspace and Projects view in three render locations. It was non-actionable (no buttons, no callbacks, pure informational text) and visually cluttered the workspace surfaces established by the UX-IA family. All real recovery, history, checkpoint, restore, and reopen capabilities live independently in the History panel and error-state `StateMessage` components, which are entirely unaffected.

---

## Objective

Remove the visual trust note box from all render locations in `workspace-shell.tsx`. Preserve all actual recovery, history, checkpoint, restore, reopen, and error-state behavior. Keep `trustNote` i18n keys in locale files untouched.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | Removed `projectTrustNote` JSX variable; removed both `{projectTrustNote}` render sites; removed inline trust-note block from `projectsWorkspaceContent` |
| `frontend/components/workspace/workspace-shell.test.tsx` | Renamed and updated 3 test blocks; added 1 regression test |

---

## Implementation Detail

**workspace-shell.tsx — four removals:**

1. Removed `projectTrustNote` JSX variable (was lines 1126–1137):
   ```tsx
   const projectTrustNote = (
     <div className="px-2 pt-2">
       <p ... data-testid="workspace-trust-note">
         {projectFirstUxEnabled ? recoveryCopy.workspace.trustNote : 'Workspace data is session-scoped...'}
       </p>
     </div>
   );
   ```

2. Removed `{projectTrustNote}` from `projectWorkspaceContent` (desktop layout, was line 1301).

3. Removed inline trust-note block from `projectsWorkspaceContent` (was lines 1387–1394):
   ```tsx
   <div className="px-2 pt-2">
     <p ... data-testid="workspace-trust-note">{recoveryCopy.workspace.trustNote}</p>
   </div>
   ```

4. Removed `{projectTrustNote}` from mobile/responsive project layout (was line 2080).

---

## Preserved Recovery / History / Checkpoint Behavior

The following capabilities are entirely independent of the trust note and remain fully intact:

- `ProjectHistory` component — snapshot list, restore buttons (`history-project-history-restore-*`)
- Reopen project action — wired into 404/410/disconnect error states via `StateMessage`
- Error-state `StateMessage` components — `recoveryCopy.detail` and `recoveryCopy.status` keys unchanged
- Loading/error/empty state messages — unchanged
- `computeWorkspaceShellState` logic — unchanged
- `workspace-shell.logic.ts` / `workspace-shell.logic.test.ts` — unchanged

---

## Not Changed

- `frontend/messages/en.json` — **unchanged** (`trustNote` key preserved as dead key)
- `frontend/messages/zh-TW.json` — **unchanged**
- `frontend/messages/zh-CN.json` — **unchanged**
- No backend changes
- No sidebar changes
- No Command Input changes
- No Build Targets changes
- No History/Chat replacement-mode changes
- No routing changes
- No new dependencies
- No `workspace-shell.logic.ts` changes

---

## Tests Updated

**File:** `frontend/components/workspace/workspace-shell.test.tsx`

| Test | Change |
|---|---|
| `renders build targets toolbar between project header and trust note in project view` | Renamed to `renders build targets toolbar after project header in project view`; removed `trustNoteIndex` variable, trust-note presence assertion, and three-way ordering assertion; replaced with `assert.ok(headerIndex < buildPanelIndex, ...)` |
| `renders project-first recovery wording in main helper surfaces` | Removed `assert.match` for `/Your project stays recoverable.../` |
| `renders trust note and responsive layout classes` | Renamed to `renders responsive layout classes`; removed `assert.match(html, /Workspace data is session-scoped\./)` |
| *(new)* `does not render trust note in project view` | Added: asserts `assert.doesNotMatch(html, /workspace-trust-note/)` with `projectFirstUxEnabled: true, workspaceView: 'project'` |

---

## Validation Results

- `npx tsc --noEmit` — **PASS**
- `npm test` — **PASS** — 577 tests, 577 pass, 0 fail
- `ReadLints` on touched files — **PASS** (no linter errors)
- Live browser test — **PASS** — trust note box absent in Project Workspace and Projects view; History panel, restore, and reopen actions confirmed unaffected
- `frontend/tsconfig.tsbuildinfo` — restored after validation (no artifact left)

---

## Non-Goals Confirmed

- No i18n file changes
- No backend changes
- No recovery/checkpoint/history behavior changes
- No Build Targets changes
- No Command Input changes
- No Chat/History replacement changes
- No sidebar changes
- No broad Project Workspace redesign

---

## Next Recommended Step

UX-IA-38 is COMPLETE and LOCKED. The UX-IA family remains active. The next slice should be identified from the backlog or user direction — no follow-up work is registered at this time.

**Reference:** See `TASKS.md` → UX-IA-38. See `TASKS_BACKLOG_FULL.md` → UX-IA-38.
