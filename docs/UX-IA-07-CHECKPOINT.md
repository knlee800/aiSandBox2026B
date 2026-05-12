# UX-IA-07 Checkpoint — Account Menu + Settings + Language/Theme

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-07 |
| Title | Account Menu + Settings + Language/Theme |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Status | COMPLETE and LOCKED |
| Date closed | 2026-05-11 |
| Master spec | `docs/UX-IA-00-MASTER-PLAN.md` |
| Depends on | UX-IA-06 (COMPLETE and LOCKED — `docs/UX-IA-06-CHECKPOINT.md`) |

---

## Objective

Add account avatar in the workspace sidebar footer that opens a popup account menu. Integrate the existing `LanguageSwitcher` locale-switching mechanism into the account menu via a prop-driven callback rather than direct component import (necessary to avoid Next.js hook incompatibility in the SSR-based test harness). Add theme preference placeholder (light active; dark deferred). Add Settings, Help, and Referral placeholder menu items. Reuse existing user identity (`userSummary.email`) and logout flow. Preserve all UX-IA-04/05/06 scaffolding and auth/session behavior unchanged.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-account-menu.tsx` | **New** — presentational `WorkspaceAccountMenu` popup component |
| `frontend/components/workspace/workspace-sidebar.tsx` | Import `WorkspaceAccountMenu`; expose 7 new `account.*` keys in `getWorkspaceScaffoldMessages`; add `onLanguageChange` prop; add `accountMenuOpen` state + `accountMenuRef` + outside-click handler; replace old standalone logout button with avatar trigger and menu |
| `frontend/components/workspace/workspace-shell.tsx` | Add optional `onLanguageChange?: (locale: string) => void` to `WorkspaceShellProps`; pass through to `WorkspaceSidebar` |
| `frontend/app/[locale]/app/page.tsx` | Import `usePathname`; add `handleLanguageChange(newLocale)`; wire `onLanguageChange={handleLanguageChange}` into `WorkspaceShell` |
| `frontend/components/workspace/workspace-shell.test.tsx` | Import `WorkspaceAccountMenu`; add `buildWorkspaceAccountMenuProps` + `renderWorkspaceAccountMenu` helpers; extend `withPatchedReactHooks` to stub `useRef`; update one existing test; add 9 new focused tests |

**Not changed:** `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json` — all `account.*` keys (`settings`, `language`, `theme`, `help`, `referral`, `affiliate`, `logout`, `light`, `dark`) were already present in all three locale files. No new keys were required.

---

## Account Menu Summary

`WorkspaceAccountMenu` (`workspace-account-menu.tsx`) — new presentational `'use client'` component with no Next.js hooks and no `LanguageSwitcher` import.

```typescript
interface WorkspaceAccountMenuProps {
  userEmail?: string;
  isOpen: boolean;
  onClose?: () => void;
  onLogout?: () => void;
  currentLocale?: string;
  onLanguageChange?: (locale: string) => void;
  settingsLabel?: string;
  languageLabel?: string;
  themeLabel?: string;
  helpLabel?: string;
  referralLabel?: string;
  logoutLabel?: string;
  lightLabel?: string;
  darkLabel?: string;
}
```

Renders nothing when `isOpen` is false. When open:

- Avatar circle showing initials from first character of `userEmail` (uppercase; fallback `U`)
- User email display
- Language section (`data-testid="workspace-account-menu-language"`) — locale buttons for `en`, `zh-TW`, `zh-CN` with hardcoded display labels (`English`, `繁體中文`, `简体中文`); active locale highlighted; clicking calls `onLanguageChange(code)` then `onClose()`
- Theme section (`data-testid="workspace-account-menu-theme"`) — Light button active, Dark button disabled/placeholder
- Placeholder items section — Settings, Help, Referral (all disabled)
- Logout section (`data-testid="workspace-account-menu-logout"`) — button with `data-testid="workspace-header-logout-button"` preserved for backward compatibility; calls `onLogout()` then `onClose()`

---

## Language/Theme Behavior Summary

**Language switching** uses the existing path-segment locale mechanism. `WorkspaceAccountMenu` fires `onLanguageChange(code)` which propagates up through `WorkspaceSidebar.onLanguageChange` → `WorkspaceShell.onLanguageChange` → `handleLanguageChange(newLocale)` in `page.tsx`. The handler:

```typescript
function handleLanguageChange(newLocale: string): void {
  if (!newLocale || newLocale === locale || !pathname) return;
  const segments = pathname.split('/');
  if (segments.length < 2) return;
  segments[1] = newLocale;
  router.push(segments.join('/'));
}
```

No parallel state-based locale system introduced. `LanguageSwitcher` was not modified.

**Theme placeholder** — Light button active (dark style), Dark button disabled with muted styling. No Tailwind `dark:` variants or CSS custom properties added. Dark mode is deferred to a later slice.

---

## Implementation Summary

### `WorkspaceSidebar` changes

`getWorkspaceScaffoldMessages` now additionally exposes:

| Key | Reads from |
|---|---|
| `settings` | `account.settings` |
| `language` | `account.language` |
| `theme` | `account.theme` |
| `help` | `account.help` |
| `referral` | `account.referral` |
| `light` | `account.light` |
| `dark` | `account.dark` |

`logout` was already present. No message file changes needed.

New `WorkspaceSidebarProps` field:
```typescript
onLanguageChange?: (locale: string) => void;
```

New local state in `WorkspaceSidebar`:
```typescript
const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);
const accountMenuRef = React.useRef<HTMLDivElement | null>(null);
```

Outside-click close via `useEffect` listening on `document mousedown`; only registered when menu is open; cleans up on unmount/close.

Avatar trigger in sidebar footer (`data-testid="workspace-sidebar-account-avatar"`) shows initials, email, and language label in a row. `WorkspaceAccountMenu` rendered inside the same `relative`-positioned `div` (ref'd), appearing `bottom-full` of the trigger. Upgrade button left unchanged. `footerContent` / `WorkspaceAdvancedDrawer` left unchanged.

The old standalone logout button (which required `props.onLogout` to render) was removed from the footer; logout is now accessed through the account menu.

### `WorkspaceShell` change

Single optional prop addition:
```typescript
onLanguageChange?: (locale: string) => void;
```
Passed to `WorkspaceSidebar`.

### `page.tsx` change

Added `usePathname` import. Added `handleLanguageChange` function (see above). Wired `onLanguageChange={handleLanguageChange}` to `WorkspaceShell`. No auth/logout changes.

---

## Test Summary

Extended `withPatchedReactHooks` in `workspace-shell.test.tsx` to stub `React.useRef` (returns `{ current: initialValue }`). This was required because the sidebar now uses `useRef` for the outside-click handler, which is called inside `renderWorkspaceShellElementByTestId`.

New test helpers added:
- `buildWorkspaceAccountMenuProps(overrides)` — builds default open-menu props from the `userSummary` fixture
- `renderWorkspaceAccountMenu(overrides)` — wraps `renderToStaticMarkup` on `WorkspaceAccountMenu`

| Test | Coverage |
|---|---|
| Updated: `renders account avatar trigger in the project-first sidebar footer` | `workspace-sidebar-account-avatar` present; `workspace-account-menu` and `workspace-header-logout-button` absent when closed |
| New: `account menu is closed by default in the project-first sidebar` | `workspace-account-menu` absent in default render |
| New: `account menu renders user email when open` | `workspace-account-menu`, `user@example.com` present |
| New: `account menu renders language options` | `workspace-account-menu-language`, `English`, `繁體中文`, `简体中文` present |
| New: `account menu renders logout option` | `workspace-account-menu-logout`, `workspace-header-logout-button`, `Log out` present |
| New: `account menu renders settings placeholder` | `workspace-account-menu-settings`, `Settings` present |
| New: `account menu renders theme placeholder` | `workspace-account-menu-theme`, `Light`, `Dark` present |
| New: `clicking logout in account menu calls onLogout` | Click on `workspace-header-logout-button` calls handler once |
| New: `clicking language option calls onLanguageChange with locale code` | Click on `workspace-account-menu-language-zh-TW` calls handler with `'zh-TW'` |

Total tests: 294 (286 pre-UX-IA-07 + 8 net new; 1 existing test updated).

---

## Acceptance Checks

| Check | Result |
|---|---|
| UX-IA-07 registered in TASKS.md and TASKS_BACKLOG_FULL.md | PASS |
| Account avatar visible in sidebar footer; clicking opens popup | PASS — `workspace-sidebar-account-avatar` renders; `accountMenuOpen` state toggles |
| Account menu closes on outside click or explicit close | PASS — `useRef` + `useEffect` mousedown listener; `onClose` wired to language/logout buttons |
| Language switcher in account menu calls existing locale mechanism | PASS — `onLanguageChange` propagates to `handleLanguageChange` in `page.tsx` via router.push |
| Logout action calls existing logout handler | PASS — `workspace-header-logout-button` preserved; calls `props.onLogout` |
| Settings, Help, Referral items rendered (placeholder/disabled) | PASS — all rendered as disabled buttons with correct testids |
| Theme toggle placeholder rendered (light active; dark deferred) | PASS — `workspace-account-menu-theme-light` (active), `workspace-account-menu-theme-dark` (disabled) |
| All new user-facing strings use i18n keys | PASS — all labels passed as props from `getWorkspaceScaffoldMessages`; no hardcoded English except the language display labels which are locale-script names (not translatable) |
| `npx tsc --noEmit` | PASS |
| `npm test` (294 tests) | PASS — 294/294 |
| `npm run build` | PASS — Next.js production build successful |
| `ReadLints` on all touched files | PASS — no linter errors |
| `git restore -- frontend/tsconfig.tsbuildinfo` | Completed |
| No regressions to UX-IA-04/05/06, AUTH-APP-01/02, PROJ-02 | PASS — 294/294 |

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | PASS |
| `npm test` | `frontend/` | PASS — 294 tests, 0 failures |
| `npm run build` | `frontend/` | PASS — Next.js production build successful |
| `ReadLints` on touched files | — | PASS — no linter errors |
| `git restore -- frontend/tsconfig.tsbuildinfo` | repo root | Completed |

---

## Non-Goals Confirmed

- No profile editing UI or backend
- No real billing or upgrade flow
- No dark theme implementation beyond placeholder
- No settings persistence or backend
- No project mode shell or tab system (UX-IA-08/10/11)
- No backend or API changes
- No auth changes
- No route cleanup (UX-IA-14)
- No responsive/mobile work (UX-IA-13)
- No broad refactor of AI-WS, preview, or file logic
- No new i18n namespaces
- No message file changes
- `LanguageSwitcher` component not modified
- `WorkspaceAdvancedDrawer` and `footerContent` prop unchanged
- No Tailwind `dark:` variants or CSS custom properties added
- All prior checkpoint invariants (UX-IA-01 through UX-IA-06, AUTH-APP-01/02, PROJ-02-01/02/03) preserved

---

## Invariants Preserved

- All prior checkpoint invariants (UX-IA-01, UX-IA-02, UX-IA-03, UX-IA-04, UX-IA-05, UX-IA-06, AUTH-APP-01, AUTH-APP-02, PROJ-02-01, PROJ-02-02, PROJ-02-03) remain intact.
- PROJ-02-01 `hydrateWorkspaceForProjectOpen` and `projectOpenInProgressRef` guard chain unchanged.
- `HistoryProjectPanel` and its existing handler wiring unchanged.
- UX-IA-04 sidebar, Home view, and project-mode behavior preserved.
- UX-IA-05 Projects view (`workspace-projects-view`, `WorkspaceProjectCard`, grid/list toggle) preserved.
- UX-IA-06 Templates view (`workspace-templates-view`, `WorkspaceTemplateCard`, search, fork) preserved.
- `WorkspaceView` state and `workspaceView` prop interface unchanged.
- `workspace-header-logout-button` testid preserved inside `WorkspaceAccountMenu` for backward-compatible test assertions.
- Session-scoped (non-project-first) logout button path in `workspace-shell.tsx` unchanged.

---

## Carry-Forwards

| Item | Target task |
|---|---|
| Dark mode implementation | Deferred to a later slice (no assigned task yet) |
| Profile editing UI | No task planned (explicitly out of scope) |
| Responsive/mobile polish for account menu | UX-IA-13 |
| Project mode shell redesign | UX-IA-08 — Project Mode Shell |

---

## Next Recommended Task

**UX-IA-08 — Project Mode Shell**

Depends on UX-IA-07 (now COMPLETE and LOCKED). When a project is opened, the workspace transforms into project mode: AI panel (left) + tabbed content (right). Back button returns to workspace. Risk: Medium-High (core structural change; must preserve all AI-WS capabilities). Loop: 4-step (plan, implement, verify tests, consolidate). Model: Opus 4.6.

Reference: `TASKS.md` → UX-IA-08. Reference: `docs/UX-IA-00-MASTER-PLAN.md` → UX-IA-08 section.
