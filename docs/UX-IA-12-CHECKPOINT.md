# UX-IA-12 Checkpoint — Upgrade Flow + Dashboard Polish

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-12 |
| Title | Upgrade Flow + Dashboard Polish |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Status | COMPLETE and LOCKED |
| Date closed | 2026-05-14 |
| Master spec | `docs/UX-IA-00-MASTER-PLAN.md` |
| Depends on | UX-IA-11 (COMPLETE and LOCKED — `docs/UX-IA-11-CHECKPOINT.md`) |
| Risk | Low-Medium |
| Loop | 3-step (plan — implement — verify tests + consolidate) |
| Model | Sonnet 4.6 |

---

## Objective

Polish the Upgrade CTA and compact usage/quota display in the authenticated workspace sidebar. Improve visual hierarchy and legibility of the usage summary. Fix two hardcoded English strings with i18n keys. Preserve all locked UX-IA-04 through UX-IA-11 invariants. No billing or payment implementation.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-sidebar.tsx` | Upgrade CTA restyle; compact usage layout refactor; two new i18n key reads in `getWorkspaceScaffoldMessages` |
| `frontend/messages/en.json` | Added `workspace.activeSessions` and `workspace.tokens` |
| `frontend/messages/zh-TW.json` | Added `workspace.activeSessions` and `workspace.tokens` |
| `frontend/messages/zh-CN.json` | Added `workspace.activeSessions` and `workspace.tokens` |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added 3 new tests for upgrade button and compact usage block |

**Not changed:** `frontend/components/workspace/workspace-shell.tsx`, `frontend/components/workspace/workspace-account-menu.tsx`, `frontend/components/workspace/workspace-tab-registry.ts`, `frontend/components/workspace/workspace-tab-bar.tsx`, `frontend/app/[locale]/app/page.tsx`, all backend files, all auth files.

---

## Implementation Summary

### `getWorkspaceScaffoldMessages` addition

Two new key reads added after `comingSoon`:

```typescript
activeSessions: read('workspace.activeSessions'),
tokens: read('workspace.tokens'),
```

### Upgrade CTA restyle

**Before:**
```tsx
<button
  type="button"
  disabled
  className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-600"
  data-testid="workspace-sidebar-upgrade-button"
>
  {messages.upgrade}
</button>
```

**After:**
```tsx
<button
  type="button"
  disabled
  className="flex w-full items-center justify-between rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700"
  data-testid="workspace-sidebar-upgrade-button"
>
  <span>{messages.upgrade}</span>
  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
    {messages.comingSoon}
  </span>
</button>
```

Changes:
- `disabled` retained — preserves billing/no-charge safety; no click handler wired
- `bg-gray-100 text-gray-600` → `bg-white text-gray-700` — reads as intentional future CTA, not broken disabled control
- `flex items-center justify-between` added for label + badge layout
- Inline "Coming soon" badge using existing `messages.comingSoon` (`tabs.comingSoon`) — no new i18n key required
- `data-testid="workspace-sidebar-upgrade-button"` preserved exactly

### Compact usage block refactor

**Before:**
```tsx
<div className="mt-6 rounded border border-gray-200 bg-gray-50 p-3"
     data-testid="workspace-sidebar-compact-usage">
  <p className="truncate text-sm font-medium text-gray-900">{props.userSummary?.email}</p>
  <p className="mt-1 text-xs text-gray-500">
    {props.userSummary?.planName} ({props.userSummary?.planStatus})
  </p>
  <div className="mt-3 grid grid-cols-1 gap-2">
    <div className="rounded border border-gray-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">Active sessions</p>
      <p className="text-sm font-semibold text-gray-900">
        {props.activeSessions ?? 0}/{props.quotaSummary?.maxActiveSessions ?? 0}
      </p>
    </div>
    <div className="rounded border border-gray-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">Tokens</p>
      <p className="text-sm font-semibold text-gray-900">
        {props.usageSummary?.tokensUsed24h ?? 0}/{props.quotaSummary?.maxTokens24h ?? 0}
      </p>
    </div>
  </div>
</div>
```

**After:**
```tsx
<div className="mt-6 rounded border border-gray-200 bg-gray-50 p-3"
     data-testid="workspace-sidebar-compact-usage">
  <p className="text-xs font-medium text-gray-700">{props.userSummary?.planName}</p>
  <p className="text-[11px] text-gray-500">{props.userSummary?.planStatus}</p>
  <div className="mt-3 space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{messages.activeSessions}</span>
      <span className="text-xs font-medium text-gray-700">
        {props.activeSessions ?? 0} / {props.quotaSummary?.maxActiveSessions ?? 0}
      </span>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{messages.tokens}</span>
      <span className="text-xs font-medium text-gray-700">
        {props.usageSummary?.tokensUsed24h ?? 0} /{' '}
        {props.quotaSummary?.maxTokens24h ?? 0}
      </span>
    </div>
  </div>
</div>
```

Changes:
- Email line removed — redundant with account avatar trigger directly below
- Plan name and status kept but separated into distinct lines without parentheses
- Two identical `bg-white rounded border` stat boxes replaced with two inline `flex justify-between` rows
- Hardcoded `"Active sessions"` → `messages.activeSessions` (i18n)
- Hardcoded `"Tokens"` → `messages.tokens` (i18n)
- Values unchanged: same ratios `activeSessions / maxActiveSessions`, `tokensUsed24h / maxTokens24h`
- `data-testid="workspace-sidebar-compact-usage"` preserved exactly

---

## i18n Summary

Two new keys added to the `workspace` namespace in all three locale files simultaneously:

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `workspace.activeSessions` | `"Active sessions"` | `"活躍工作階段"` | `"活跃会话"` |
| `workspace.tokens` | `"Tokens"` | `"代幣"` | `"令牌"` |

No new keys were required for the upgrade badge — `tabs.comingSoon` was already present in all three locale files and available via the existing `messages.comingSoon` read in `getWorkspaceScaffoldMessages`.

---

## UX/UI Advisory Note

**Impeccable (advisory):** Identical card grid pattern removed from compact usage block — two identical `bg-white rounded border` boxes replaced with differentiated inline rows. Upgrade CTA visual language changed from "broken disabled control" (`bg-gray-100 text-gray-600`) to intentional future CTA (`bg-white text-gray-700` with inline badge). Conservative application using the existing Tailwind token system.

**Emil Kowalski (advisory):** No animation added. The upgrade CTA leads nowhere in this slice — no click handler wired, `disabled` retained. Badge treatment is quiet and non-intrusive. No press feedback added to a disabled element.

Both skills applied as advisory only. No architecture, slice boundary, or test conventions overridden.

---

## Test Summary

| Change | Description |
|---|---|
| New | `'renders upgrade CTA button in the project-first sidebar footer'` — asserts `workspace-sidebar-upgrade-button` present |
| New | `'renders compact usage block in project-first sidebar when summary data is available'` — asserts `workspace-sidebar-compact-usage` present when `userSummary`, `usageSummary`, `quotaSummary` all provided |
| New | `'compact usage block is hidden in project-first sidebar when usage summary is unavailable'` — asserts `workspace-sidebar-compact-usage` absent when `usageSummary: null` |
| Unchanged | All 317 prior tests — no regressions |

Prior baseline: 317 tests (from UX-IA-11). Net new from UX-IA-12: 3 new tests. Total: 320 tests, 320 passed.

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | PASS — 0 errors |
| `npm test` | `frontend/` | PASS — 320 tests, 320 passed, 0 failed |
| `npm run build` | `frontend/` | PASS — Next.js production build successful |
| `ReadLints` on touched files | — | PASS — 0 errors |
| `git restore -- frontend/tsconfig.tsbuildinfo` | repo root | Completed |

---

## Non-Goals Confirmed

- No real billing/checkout implementation
- No Stripe or payment integration
- No backend or API changes
- No auth changes
- No route cleanup (deferred to UX-IA-14)
- No account/profile backend
- No project mode or tab architecture changes
- No Visual Edit Mode (deferred to UX-IA-15+)
- No broad refactor
- No new dependencies
- No new files created
- No changes to `workspace-shell.tsx`
- No changes to `workspace-account-menu.tsx`
- No changes to `workspace-tab-registry.ts`
- No changes to `workspace-tab-bar.tsx`
- No changes to `page.tsx`
- `WorkspaceShellProps` interface unchanged

---

## Preserved Invariants

- `WorkspaceShellProps` interface — unchanged
- `WorkspaceChatPanel`, `WorkspaceExecPanel`, `WorkspaceBuildPanel` props — unchanged; all AI-WS flows unaffected
- `WorkspacePreviewPanel` props — unchanged; iframe pointer-event path unaffected; `window.postMessage` path preserved; Visual Edit Mode compatibility maintained (UX-IA-15 constraint)
- `WorkspaceEditorPanel` props — unchanged; all AI-WS file action flows unaffected
- UX-IA-11 testids: `workspace-tab-placeholder` — preserved
- UX-IA-10 testids: `preview-panel-shell`, `editor-panel-shell`, `workspace-tab-content` with overflow-hidden layout — preserved
- UX-IA-09 testids: `workspace-ai-panel-toggle`, `workspace-ai-panel-view-chat`, `workspace-ai-panel-view-history`, `workspace-restore-confirm-bar`, `workspace-restore-confirm-button`, `workspace-restore-cancel-button` — preserved
- UX-IA-08 testids: `workspace-project-view`, `workspace-project-mode-header`, `workspace-project-back-button`, `workspace-project-ai-panel`, `workspace-project-content-panel` — preserved
- UX-IA-08B testids: `workspace-tab-bar`, `workspace-ai-panel-collapse-toggle` — preserved
- UX-IA-07 testids: `workspace-account-menu`, `workspace-sidebar-account-avatar`, `workspace-header-logout-button` — preserved
- Sidebar testids: `workspace-sidebar`, `workspace-sidebar-nav-home`, `workspace-sidebar-nav-projects`, `workspace-sidebar-nav-templates`, `workspace-sidebar-workspace-select` — preserved
- `workspace-sidebar-upgrade-button` testid — preserved
- `workspace-sidebar-compact-usage` testid — preserved
- Existing billing safety state — no-charge behavior unchanged; `disabled` attribute retained on upgrade button
- PROJ-02-01 hydration chain — unaffected
- AUTH-APP-01/02 invariants — preserved
- All UX-IA-04 through UX-IA-11 invariants — preserved

---

## Carry-Forwards

| Item | Target |
|---|---|
| Responsive / Mobile Polish | UX-IA-13 |
| Route Cleanup / Redirects | UX-IA-14 |
| Visual Edit Mode Foundation | UX-IA-15 (requires UX-IA-08 + UX-IA-10 COMPLETE — now met) |
| Upgrade billing integration (real checkout) | Future task outside UX-IA family scope |
| Dark mode implementation | Deferred (no assigned task) |
| Tab bar visual polish (icons, design tokens) | Future polish pass |
| AUTH-MODULE-01 enablement | Requires UX-IA-08 + UX-IA-10 COMPLETE — now met |

---

## Next Recommended Task

**UX-IA-13 — Responsive / Mobile Polish**

Polish the workspace sidebar and shell for small-screen viewports. Risk: Low-Medium. Model: Sonnet 4.6.

Reference: `TASKS.md` → UX-IA-13. Reference: `docs/UX-IA-00-MASTER-PLAN.md` → UX-IA-13 section.
