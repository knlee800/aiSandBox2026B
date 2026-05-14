# UX-IA-11 Checkpoint — Future Product Tab Placeholders

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-11 |
| Title | Future Product Tab Placeholders |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Status | COMPLETE and LOCKED |
| Date closed | 2026-05-14 |
| Master spec | `docs/UX-IA-00-MASTER-PLAN.md` |
| Depends on | UX-IA-10 (COMPLETE and LOCKED — `docs/UX-IA-10-CHECKPOINT.md`) |
| Risk | Low |
| Loop | 3-step (implement — verify tests — consolidate) |
| Model | Sonnet 4.6 |

---

## Objective

Refine placeholder content and layout for the 11 non-functional product tabs in the UX-IA-08 tab registry (Database, Auth, Security, Analytics, Env Vars, Publishing, Deploy, Payment, Domain, App Storage, Agent Skills). Replace the single centered gray string with a structured placeholder showing the tab name as a heading and "Coming soon" as a rounded status badge. Preserve all Preview and Code & Files tab behavior from UX-IA-10 unchanged.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | Added `activeTabLabel` useMemo; replaced placeholder block |
| `frontend/components/workspace/workspace-shell.test.tsx` | Expanded existing placeholder test to assert all 11 placeholder tab IDs |

**Not changed:** `frontend/components/workspace/workspace-tab-registry.ts`, `frontend/components/workspace/workspace-tab-bar.tsx`, `frontend/messages/en.json`, `frontend/messages/zh-TW.json`, `frontend/messages/zh-CN.json`, `frontend/app/[locale]/app/page.tsx`, all backend files, all auth files.

---

## Implementation Summary

### activeTabLabel derivation

Added after the `comingSoonLabel` useMemo (line 430):

```tsx
const activeTabLabel = React.useMemo(
  () => tabBarTabs.find((tab) => tab.id === activeTabId)?.label ?? activeTabId,
  [tabBarTabs, activeTabId],
);
```

- Reuses `tabBarTabs` (already computed, locale-aware, all 13 tab labels resolved)
- Falls back to `activeTabId` raw string if lookup misses
- No new imports, no new props, no registry change

### Placeholder block replacement

**Before:**
```tsx
{activeTabId !== 'preview' && activeTabId !== 'codeFiles' ? (
  <div className="flex items-center justify-center flex-1 p-4 text-sm text-gray-400"
       data-testid="workspace-tab-placeholder">
    {comingSoonLabel}
  </div>
) : null}
```

**After:**
```tsx
{activeTabId !== 'preview' && activeTabId !== 'codeFiles' ? (
  <div
    className="flex flex-col items-center justify-center flex-1 gap-3 p-8"
    data-testid="workspace-tab-placeholder"
  >
    <p className="text-sm font-medium text-gray-700">{activeTabLabel}</p>
    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
      {comingSoonLabel}
    </span>
  </div>
) : null}
```

Layout changes:
- `flex-col` + `gap-3` + `p-8`: vertical rhythm and breathing room (was horizontal `p-4`)
- `<p>` with `text-gray-700 font-medium`: tab name as visible heading
- `rounded-full bg-gray-100 px-3 py-1`: badge shape for "Coming soon" — reads as status, not body text
- `data-testid="workspace-tab-placeholder"` preserved exactly
- No animation (tab switching is frequent; per Emil Kowalski framework: "tens of times/day — remove or drastically reduce")
- No new i18n keys — tab label from existing `tabBarTabs`; badge from existing `tabs.comingSoon`

---

## UX/UI Advisory Note

**Impeccable (advisory):** Tab name as heading with badge-as-status corrects visual hierarchy. The prior single gray string had no structure — heading and status were conflated. Conservative application using the existing Tailwind token system.

**Emil Kowalski (advisory):** No animation added. Tab switching is a frequent action; the Animation Decision Framework calls for removing or drastically reducing animation at that frequency. The badge shape is a quiet, non-interactive status indicator appropriate for coming-soon content.

Both skills applied as advisory only. No architecture, slice boundary, or test conventions overridden.

---

## Test Summary

| Change | Description |
|---|---|
| Updated existing | `'renders placeholder tabs with Coming soon text'` — added 6 missing tab ID assertions to both `tabBarHtml` and `shellHtml`: `workspace-tab-publishing`, `workspace-tab-deploy`, `workspace-tab-payment`, `workspace-tab-domain`, `workspace-tab-appStorage`, `workspace-tab-agentSkills` |
| Unchanged | `'default preview tab does not render workspace tab placeholder'` — `workspace-tab-placeholder` still absent on default Preview render |
| Unchanged | All other 315 tests — no regressions |

Prior baseline: 317 tests (from UX-IA-10). Net new from UX-IA-11: 0 new tests (1 existing test expanded). Total: 317 tests, 317 passed.

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | PASS — 0 errors |
| `npm test` | `frontend/` | PASS — 317 tests, 317 passed, 0 failed |
| `npm run build` | `frontend/` | PASS — Next.js production build successful |
| `ReadLints` on touched files | — | PASS — 0 errors |
| `git restore -- frontend/tsconfig.tsbuildinfo` | repo root | Completed |

---

## Non-Goals Confirmed

- No functional Database/Auth/Security/Analytics/Env Var/Payment/Domain/App Storage/Agent Skills implementation
- No backend or API changes
- No auth changes
- No Visual Edit Mode (deferred to UX-IA-15+)
- No Preview or Code & Files tab refactoring
- No route cleanup (deferred to UX-IA-14)
- No broad refactor
- No new dependencies
- No new props on `WorkspaceShellProps`
- No `page.tsx` changes
- No `workspace-project-mode.tsx` creation
- No new i18n keys
- No changes to `workspace-tab-registry.ts`
- No changes to `workspace-tab-bar.tsx`

---

## Preserved Invariants

- `WorkspaceShellProps` interface — unchanged
- `WorkspaceChatPanel`, `WorkspaceExecPanel`, `WorkspaceBuildPanel` props — unchanged; all AI-WS flows unaffected
- `WorkspacePreviewPanel` props — unchanged; iframe `src`, `onLoad`, `onError`, `title`, `data-testid` unchanged; `window.postMessage` path preserved; Visual Edit Mode compatibility maintained (UX-IA-15 constraint)
- `WorkspaceEditorPanel` props — unchanged; file tree selection, file content display, save handler, `onChange`, AI-WS file action flows unchanged
- UX-IA-10 testids: `preview-panel-shell`, `editor-panel-shell`, `workspace-tab-content` with overflow-hidden layout — preserved
- UX-IA-09 testids: `workspace-ai-panel-toggle`, `workspace-ai-panel-view-chat`, `workspace-ai-panel-view-history`, `workspace-restore-confirm-bar`, `workspace-restore-confirm-button`, `workspace-restore-cancel-button` — preserved
- UX-IA-08 testids: `workspace-project-view`, `workspace-project-mode-header`, `workspace-project-back-button`, `workspace-project-ai-panel`, `workspace-project-content-panel` — preserved
- UX-IA-08B testids: `workspace-tab-bar`, `workspace-ai-panel-collapse-toggle` — preserved
- `workspace-tab-placeholder` testid — preserved
- `projectPreviewSection`, `projectEditorSection`, `projectWorkspaceContent` variables — unchanged; legacy path continues working
- PROJ-02-01 hydration chain — unaffected
- AUTH-APP-01/02 invariants — preserved
- All UX-IA-04 through UX-IA-10 invariants — preserved

---

## Carry-Forwards

| Item | Target |
|---|---|
| Upgrade Flow + Dashboard Polish | UX-IA-12 |
| Responsive / Mobile Polish | UX-IA-13 |
| Route Cleanup / Redirects | UX-IA-14 |
| Visual Edit Mode Foundation | UX-IA-15 (requires UX-IA-08 + UX-IA-10 COMPLETE — now met) |
| Tab bar visual polish (icons, design tokens, styled empty states) | future polish pass |
| AUTH-MODULE-01 enablement | requires UX-IA-08 + UX-IA-10 COMPLETE — now met |

---

## Next Recommended Task

**UX-IA-12 — Upgrade Flow + Dashboard Polish**

Upgrade CTA in sidebar opens a placeholder upgrade view. Dashboard usage display in sidebar becomes compact. Risk: Low–Medium. Model: Sonnet 4.6.

Reference: `TASKS.md` → UX-IA-12. Reference: `docs/UX-IA-00-MASTER-PLAN.md` → UX-IA-12 section.
