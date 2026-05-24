# UX-IA-18 CHECKPOINT — Multilingual Chat Empty State + System Message Distinction

**Status:** COMPLETE and LOCKED
**Task ID:** UX-IA-18
**Family:** UX-IA
**Nature:** FRONTEND-ONLY
**Completed:** 2026-05-24
**Depends on:** UX-IA-17 (`docs/UX-IA-17-CHECKPOINT.md`)

---

## Files Changed

- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/components/workspace/workspace-shell.test.tsx`
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`
- `frontend/app/[locale]/app/page.tsx`

No backend files changed. No auth logic changed.

---

## UX Changes

1. **Chat empty states** — replaced bare fallback with three multilingual contextual states:
   - No active session: `ai.emptyNoSession`
   - Active session / no messages: `ai.emptyWithSession`
   - Subtle helper chip: `ai.emptyAuthSuggestion`

2. **System message distinction** — added optional `messageKind?: 'ai' | 'system'` to message rendering:
   - System messages render with a translated "System" label (`ai.roleSystem`) and a subtle visual distinction
   - `data-message-kind="system"` attribute added for testability
   - Auth-module install/status/eligibility thread appends in `page.tsx` marked as `messageKind: 'system'`
   - Auth logic was not changed

---

## i18n Keys Added

Namespace `ai` in all three locale files (`en.json`, `zh-TW.json`, `zh-CN.json`):

| Key | Purpose |
|-----|---------|
| `ai.emptyNoSession` | No-session empty state copy |
| `ai.emptyWithSession` | Active-session / no-messages empty state copy |
| `ai.emptyAuthSuggestion` | Subtle helper chip suggestion copy |
| `ai.roleSystem` | Translated "System" label for system messages |

---

## Validation Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (frontend/) | PASS |
| `npm test` (frontend/) | PASS — 469 tests, 469 pass, 0 fail |
| `ReadLints` on touched files | PASS — 0 new errors |
| `frontend/tsconfig.tsbuildinfo` | Restored after validation |

---

## Non-Goals Confirmed

- No backend changes
- No auth logic changes
- No StateMessage component redesign
- No loading skeletons
- No revert button styling
- No broad workspace-shell refactor
- No new external dependencies

---

## Preserved Invariants

- All existing `data-testid` contracts in workspace-shell — unchanged
- Visual Edit Mode wiring (UX-IA-15/16/17) — untouched
- Auth-module install flow and guard behavior — untouched
- Internal session API endpoints — untouched

---

## Next Recommended Step

Select next task from UX-IA family or backlog. Open new window for next registration/activation step per CLAUDE.md new-window rules.
