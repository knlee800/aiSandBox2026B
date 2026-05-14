# UX-IA-13A Checkpoint — Project Mode Mobile Stacking + Minor Responsive Fixes

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-13A |
| Title | Project Mode Mobile Stacking + Minor Responsive Fixes |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Parent | UX-IA-13 — Responsive / Mobile Polish |
| Status | COMPLETE and LOCKED |
| Date closed | 2026-05-14 |
| Master spec | `docs/UX-IA-00-MASTER-PLAN.md` |
| Depends on | UX-IA-13 (ACTIVE — plan phase registered); UX-IA-12 (COMPLETE and LOCKED — `docs/UX-IA-12-CHECKPOINT.md`) |
| Risk | Low |
| Loop | 1-step (implement + verify) |
| Model | Sonnet 4.6 |

---

## Objective

Fix project mode mobile layout. The AI panel and content panel inner container had no responsive flex direction, defaulting to `flex-row` at all viewports. On a 375px screen this made the AI panel and content panel compete side-by-side for narrow horizontal space, leaving the content area near-unusable. This slice adds `flex-col md:flex-row` so the panels stack vertically on < 768px and remain side-by-side on >= 768px. A bounded mobile max-height on the AI panel prevents it from dominating the full screen height when stacked.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | Two Tailwind class additions in the project mode layout section |

**Not changed:** `frontend/components/workspace/workspace-shell.test.tsx`, `frontend/components/workspace/workspace-sidebar.tsx`, `frontend/components/workspace/workspace-tab-bar.tsx`, `frontend/components/workspace/workspace-account-menu.tsx`, `frontend/components/workspace/workspace-project-card.tsx`, `frontend/components/workspace/workspace-template-card.tsx`, `frontend/messages/*.json`, `frontend/app/[locale]/app/page.tsx`, all backend files, all auth files.

---

## Implementation Summary

### Change 1 — Project mode inner container

**Before:**
```tsx
<div className="flex flex-1 min-h-0">
```

**After:**
```tsx
<div className="flex flex-1 min-h-0 flex-col md:flex-row">
```

Effect: on `< 768px` the flex direction becomes column, stacking the AI panel above the content panel. On `>= 768px` (Tailwind `md:` breakpoint) the direction becomes row, restoring the side-by-side layout. No logic, testid, or state change.

### Change 2 — AI panel aside (`data-testid="workspace-project-ai-panel"`)

**Before:**
```tsx
className="w-full md:w-96 border-r border-gray-200 bg-white overflow-y-auto flex flex-col gap-2 p-2"
```

**After:**
```tsx
className="w-full max-h-[50vh] md:w-96 md:max-h-none border-r border-gray-200 bg-white overflow-y-auto flex flex-col gap-2 p-2"
```

Effect: on mobile the AI panel is capped at 50% of the viewport height, leaving the bottom half for the content panel. `overflow-y-auto` was already present and is preserved, so chat messages and history timeline remain scrollable within that bounded height. On `md:` and above `max-h-none` removes the cap, restoring the full-height panel.

---

## UX/UI Advisory Note

**Impeccable (advisory):** `flex-col md:flex-row` is the canonical responsive stack pattern; no design deviation introduced. The 50vh cap on the AI panel is a reasonable split for a two-panel mobile layout, giving equal weight to chat and content.

**Emil Kowalski (advisory):** No animation added. The layout shift on viewport resize is a CSS reflow, not an interactive transition; adding motion here would be disruptive rather than helpful. The stacked layout is structurally correct and does not require further polish in this slice.

Both skills applied as advisory only. No architecture, slice boundary, or test conventions overridden.

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | PASS — 0 errors |
| `npm test` | `frontend/` | PASS — 320 tests, 320 passed, 0 failed |
| `npm run build` | `frontend/` | PASS — Next.js production build successful |
| `git restore -- frontend/tsconfig.tsbuildinfo` | repo root | Completed after build |
| `ReadLints` on `workspace-shell.tsx` | — | PASS — 0 errors |

---

## Non-Goals Confirmed

- No sidebar hamburger / slide-over (deferred to UX-IA-13B)
- No new product features
- No backend or API changes
- No auth changes
- No Visual Edit Mode
- No billing changes
- No route cleanup
- No new dependencies
- No new testids
- No new React state
- No changes to non-`projectFirstUxEnabled` branch
- No changes to `workspace-sidebar.tsx`, `workspace-tab-bar.tsx`, `workspace-account-menu.tsx`, `workspace-project-card.tsx`, `workspace-template-card.tsx`
- No changes to `workspace-shell.test.tsx`
- No i18n key changes

---

## Preserved Invariants

- `WorkspaceShellProps` interface — unchanged
- `WorkspaceChatPanel`, `WorkspaceExecPanel`, `WorkspaceBuildPanel` props — unchanged; all AI-WS flows unaffected
- `WorkspacePreviewPanel` props — unchanged; iframe pointer-event path unaffected; `window.postMessage` path preserved; Visual Edit Mode compatibility maintained (UX-IA-15 constraint)
- `WorkspaceEditorPanel` props — unchanged; all AI-WS file action flows unaffected
- UX-IA-12 testids: `workspace-sidebar-upgrade-button`, `workspace-sidebar-compact-usage` — preserved
- UX-IA-11 testids: `workspace-tab-placeholder` — preserved
- UX-IA-10 testids: `preview-panel-shell`, `editor-panel-shell`, `workspace-tab-content` — preserved
- UX-IA-09 testids: `workspace-ai-panel-toggle`, `workspace-ai-panel-view-chat`, `workspace-ai-panel-view-history`, `workspace-restore-confirm-bar`, `workspace-restore-confirm-button`, `workspace-restore-cancel-button` — preserved
- UX-IA-08 testids: `workspace-project-view`, `workspace-project-mode-header`, `workspace-project-back-button`, `workspace-project-ai-panel`, `workspace-project-content-panel` — preserved
- UX-IA-08B testids: `workspace-tab-bar`, `workspace-ai-panel-collapse-toggle` — preserved
- UX-IA-07 testids: `workspace-account-menu`, `workspace-sidebar-account-avatar`, `workspace-header-logout-button` — preserved
- Sidebar testids: `workspace-sidebar`, `workspace-sidebar-nav-home`, `workspace-sidebar-nav-projects`, `workspace-sidebar-nav-templates`, `workspace-sidebar-workspace-select` — preserved
- PROJ-02-01 hydration chain — unaffected
- AUTH-APP-01/02 invariants — preserved
- All UX-IA-04 through UX-IA-12 invariants — preserved

---

## Carry-Forwards

| Item | Target |
|---|---|
| Sidebar hamburger / slide-over on < 768px | UX-IA-13B (next child slice) |
| Route Cleanup / Redirects | UX-IA-14 |
| Visual Edit Mode Foundation | UX-IA-15 (requires UX-IA-08 + UX-IA-10 COMPLETE — now met) |
| Dark mode implementation | Deferred (no assigned task) |
| AUTH-MODULE-01 enablement | Requires UX-IA-08 + UX-IA-10 COMPLETE — now met |

---

## Next Recommended Task

**UX-IA-13B — Sidebar Hamburger / Mobile Slide-over**

Add hamburger button and slide-over panel for the workspace sidebar on < 768px. Risk: Medium. Model: Sonnet 4.6. New testid: `workspace-sidebar-mobile-toggle`. Adds 3 new tests (323 total).

Reference: `TASKS.md` — UX-IA-13B. Reference: `docs/UX-IA-00-MASTER-PLAN.md` — UX-IA-13 section.
