# UX-IA-13B Checkpoint — Sidebar Hamburger / Mobile Slide-over

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-13B |
| Title | Sidebar Hamburger / Mobile Slide-over |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Parent | UX-IA-13 — Responsive / Mobile Polish |
| Status | COMPLETE and LOCKED |
| Date closed | 2026-05-14 |
| Master spec | `docs/UX-IA-00-MASTER-PLAN.md` |
| Depends on | UX-IA-13A (COMPLETE and LOCKED — `docs/UX-IA-13A-CHECKPOINT.md`) |
| Risk | Medium |
| Loop | 2-step (implement — verify + consolidate) |
| Model | Sonnet 4.6 |

---

## Objective

Add mobile hamburger toggle and slide-over panel for the workspace sidebar on < 768px. On ≥ 768px the sidebar remains always visible and the desktop layout is entirely unchanged. Introduces one new testid: `workspace-sidebar-mobile-toggle`.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | `isSidebarOpen` state; mobile header strip with hamburger; overlay; sidebar wrapper div |
| `frontend/components/workspace/workspace-shell.test.tsx` | 3 new tests |

**Not changed:** `frontend/components/workspace/workspace-sidebar.tsx`, `frontend/components/workspace/workspace-tab-bar.tsx`, `frontend/components/workspace/workspace-account-menu.tsx`, `frontend/components/workspace/workspace-project-card.tsx`, `frontend/components/workspace/workspace-template-card.tsx`, `frontend/messages/*.json`, `frontend/app/[locale]/app/page.tsx`, all backend files, all auth files.

---

## Implementation Summary

### State

Added `const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)` in `WorkspaceShell`. Positioned after the `templateSearch` state declaration to preserve the call-order invariant required by an existing test that monkey-patches `React.useState` by call count.

### Mobile-Only Header Strip

Inserted as the first child of `<div data-testid="workspace-shell">`, before the main `flex-1 min-h-0` layout div. Hidden on desktop via `md:hidden`.

```tsx
<div className="border-b border-gray-200 bg-white px-4 py-2 md:hidden">
  <button
    type="button"
    onClick={() => setIsSidebarOpen(true)}
    className="rounded p-1.5 text-gray-600 active:scale-[0.97] transition-transform duration-100"
    data-testid="workspace-sidebar-mobile-toggle"
    aria-label="Open sidebar"
  >
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
         xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 5H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 10H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 15H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  </button>
</div>
```

The button is always present in the DOM when `projectFirstUxEnabled` is true; CSS (`md:hidden`) hides it on desktop. This keeps the testid accessible in `renderToStaticMarkup`-based tests without needing viewport simulation.

### Overlay

Conditionally rendered when `isSidebarOpen` is true. Placed inside the flex layout div, before the sidebar wrapper:

```tsx
{isSidebarOpen && (
  <div
    className="fixed inset-0 z-10 bg-black/20 transition-opacity duration-200 ease-out md:hidden"
    aria-hidden="true"
    onClick={() => setIsSidebarOpen(false)}
  />
)}
```

`md:hidden` ensures the overlay does not appear on desktop even if state is somehow true. Click handler closes the sidebar.

### Sidebar Wrapper

`WorkspaceSidebar` is now wrapped in a positioning div. All existing `WorkspaceSidebar` props are preserved exactly.

```tsx
<div
  className={[
    'fixed inset-y-0 left-0 z-20 w-72',
    'transition-transform duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)]',
    isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
    'md:static md:z-auto md:w-auto md:translate-x-0',
  ].join(' ')}
>
  <WorkspaceSidebar ...all existing props unchanged... />
</div>
```

`workspace-sidebar.tsx` is not modified; the aside element inside retains all its existing classes.

---

## Responsive Behavior Summary

| Viewport | Sidebar default | Hamburger button | Overlay |
|---|---|---|---|
| `< 768px` | Off-canvas (`fixed left-0 -translate-x-full`) | Visible in mobile header strip | Rendered when `isSidebarOpen`; tap closes |
| `>= 768px` | Always in-flow (`md:static md:translate-x-0`) | Hidden (`md:hidden`) | `md:hidden` regardless of state |

Desktop layout (flex row, `md:flex-row`) is completely unchanged. The wrapper reverts to `md:static md:w-auto` so the sidebar participates in the flex row exactly as before.

---

## Animation Details (Emil Kowalski advisory — applied within scope)

- **Sidebar slide-over:** `transition-transform duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)]` — iOS-like drawer curve. Only `transform` is animated (GPU-composited; no layout properties).
- **Overlay:** `transition-opacity duration-200 ease-out` — fade in/out.
- **Hamburger press feedback:** `active:scale-[0.97] transition-transform duration-100` — instant tactile feedback.
- No animation library added. Pure CSS transitions, interruptible by CSS retargeting.

Both Impeccable and Emil Kowalski skills applied as advisory only. No architecture, slice boundary, or test conventions overridden.

---

## Test Summary

| Change | Description |
|---|---|
| New | `'renders sidebar mobile toggle button in project-first shell'` — asserts `workspace-sidebar-mobile-toggle` present when `projectFirstUxEnabled: true` |
| New | `'sidebar mobile toggle is absent when projectFirstUxEnabled is false'` — asserts `workspace-sidebar-mobile-toggle` absent in legacy shell |
| New | `'workspace-account-menu testid still resolves after sidebar markup change'` — asserts `workspace-sidebar-account-avatar` present after wrapper div added |
| Unchanged | All 320 prior tests — no regressions |

Prior baseline: 320 tests (from UX-IA-13A). Net new from UX-IA-13B: 3 new tests. Total: 323 tests, 323 passed.

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | PASS — 0 errors |
| `npm test` | `frontend/` | PASS — 323 tests, 323 passed, 0 failed |
| `npm run build` | `frontend/` | PASS — Next.js production build successful |
| `git restore -- frontend/tsconfig.tsbuildinfo` | repo root | Completed after build |
| `ReadLints` on touched files | — | PASS — 0 errors |

---

## Non-Goals Confirmed

- No desktop layout changes
- No `workspace-sidebar.tsx` changes
- No i18n changes
- No backend or API changes
- No auth changes
- No Visual Edit Mode changes
- No billing changes
- No route cleanup (deferred to UX-IA-14)
- No new dependencies
- No new product features
- No `WorkspaceShellProps` interface changes
- No changes to `workspace-sidebar.tsx`, `workspace-account-menu.tsx`, `workspace-tab-bar.tsx`, `workspace-project-card.tsx`, `workspace-template-card.tsx`
- No changes to `frontend/messages/*.json`
- No changes to `frontend/app/[locale]/app/page.tsx`

---

## Preserved Invariants

- `WorkspaceShellProps` interface — unchanged
- `WorkspaceChatPanel`, `WorkspaceExecPanel`, `WorkspaceBuildPanel` props — unchanged; all AI-WS flows unaffected
- `WorkspacePreviewPanel` props — unchanged; iframe pointer-event path unaffected; `window.postMessage` path preserved; Visual Edit Mode compatibility maintained (UX-IA-15 constraint)
- `WorkspaceEditorPanel` props — unchanged; all AI-WS file action flows unaffected
- UX-IA-13A testids: `workspace-project-ai-panel`, `workspace-project-content-panel` — preserved
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
| Route Cleanup / Redirects | UX-IA-14 |
| Visual Edit Mode Foundation | UX-IA-15 (requires UX-IA-08 + UX-IA-10 COMPLETE — now met) |
| Dark mode implementation | Deferred (no assigned task) |
| AUTH-MODULE-01 enablement | Requires UX-IA-08 + UX-IA-10 COMPLETE — now met |

---

## Next Recommended Task

**UX-IA-14 — Route Cleanup / Redirects**

No further child slices in UX-IA-13. Both 13A and 13B are COMPLETE and LOCKED. UX-IA-13 parent is COMPLETE and LOCKED. Proceed to UX-IA-14.

Reference: `TASKS.md` — UX-IA-14. Reference: `docs/UX-IA-00-MASTER-PLAN.md` — UX-IA-14 section.
