# UX-IA-37 CHECKPOINT — Hide Workspace Ready Status Box

**Task ID:** UX-IA-37
**Family:** UX-IA (Product & UX/UI Redesign — Evolutionary)
**Status:** COMPLETE and LOCKED
**Priority:** Low
**Nature:** FRONTEND-ONLY / PROJECT WORKSPACE CLUTTER CLEANUP
**Risk:** Low
**Depends on:** UX-IA-36 (COMPLETE and LOCKED — `docs/UX-IA-36-CHECKPOINT.md`)
**Date:** 2026-06-04

---

## Problem

The "Workspace ready" success box appeared in the Project Workspace chat area during the normal ready state. It was non-actionable (no buttons, no recovery path, purely informational static copy) and visually cluttered the now-clean chat/history panel established by UX-IA-36.

---

## Objective

Hide only the ready-state success box by returning `null` from `ShellStateMessage` when `state === 'ready'`. Preserve all other `ShellStateMessage` states unchanged.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | Added `if (state === 'ready') return null;` in `ShellStateMessage` before the final fallthrough return |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added `assert.doesNotMatch(html, /Workspace ready/)` to the existing baseline default render test |

---

## Implementation Detail

In `ShellStateMessage` (workspace-shell.tsx), immediately after the `state === 'empty'` branch closes and before the final `return (<StateMessage tone="success" heading="Workspace ready" .../>)`, the following line was added:

```typescript
if (state === 'ready') return null;
```

The existing final `StateMessage` fallthrough return is now dead code but was left in place to minimize diff surface. The ready state now renders nothing in the chat panel area.

---

## Preserved States

- `loading` → "Workspace is loading" (neutral) — **unchanged, still renders**
- `error` → "Workspace unavailable" (error, with reopen/refresh action) — **unchanged, still renders**
- `empty` → "No project open" / "No session selected" (neutral, with resume/open action) — **unchanged, still renders**

---

## Not Changed

- `computeWorkspaceShellState` logic — **unchanged**
- `frontend/components/workspace/workspace-shell.logic.ts` — **unchanged**
- `frontend/components/workspace/workspace-shell.logic.test.ts` — **unchanged**
- `frontend/messages/en.json` — **unchanged**
- `frontend/messages/zh-TW.json` — **unchanged**
- `frontend/messages/zh-CN.json` — **unchanged**
- No backend changes
- No sidebar changes
- No Command Input changes
- No Build Targets changes
- No History/Chat replacement-mode changes
- No routing changes
- No new dependencies

---

## Tests Updated

**File:** `frontend/components/workspace/workspace-shell.test.tsx`

In `describe('workspace shell component')`, test `'renders authenticated workspace shell layout'` (default render with no overrides — which resolves to `state === 'ready'`):

```typescript
assert.doesNotMatch(html, /Workspace ready/);
```

No new test blocks added. No existing test assertions removed.

---

## Validation Results

- `npx tsc --noEmit` — **PASS**
- `npm test` — **PASS** — 576 tests, 576 pass, 0 fail, 50 suites
- `ReadLints` on touched files — **PASS** (no linter errors)
- Live browser test — **PASS** — "Workspace ready" box absent in normal Project Workspace ready state; loading/error/empty states confirmed unaffected
- `frontend/tsconfig.tsbuildinfo` — restored after validation (no artifact left)

---

## Non-Goals Confirmed

- No History/Chat replacement changes
- No Build Targets changes
- No Command Input changes
- No sidebar changes
- No project trust note changes
- No broader status-message redesign
- No locale/message JSON changes
- No backend changes

---

## Next Recommended Step

UX-IA-37 is COMPLETE and LOCKED. The UX-IA family remains active. The next slice should be identified from the backlog or user direction — no follow-up work is registered at this time.

**Reference:** See `TASKS.md` → UX-IA-37. See `TASKS_BACKLOG_FULL.md` → UX-IA-37.
