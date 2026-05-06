# UX-IA-00: Master Product & UX/UI Plan

## Date

2026-05-05

## Purpose

Formal specification for the next major product direction of the AI Sandbox platform. This document records the complete UX/UI redesign plan, information architecture, multilingual strategy, and phased implementation roadmap. No implementation should start from this document alone — each phase must be registered as a task before work begins.

---

## 1. Current App Reality Check

### Routes that exist today

| Route | Purpose | i18n? |
|---|---|---|
| `/[locale]` | Public landing page (`PublicLandingSlice`) | No (hardcoded English) |
| `/[locale]/login` | Login form | Yes (`login` namespace via `useTranslations`) |
| `/[locale]/register` | Registration form | Partial (some labels hardcoded) |
| `/[locale]/app` | Main workspace (all-in-one orchestrator) | No (English + `recoveryCopy.ts`) |
| `/[locale]/keys` | API key management | No |
| `/[locale]/account` | Wrapper — redirects to `/keys` or re-exports keys content | No |
| `/[locale]/projects` | Wrapper — redirects to `/app` or re-exports app content | No |
| `/[locale]/gallery` | Wrapper — redirects to `/share` or re-exports share content | No |
| `/[locale]/share` | Public project browse list | No |
| `/[locale]/share/[projectId]` | Single public project viewer | No |
| `/[locale]/driver` | Internal/debug | No |
| `/test` | Debug page, no locale segment | No |

### i18n structure that exists

| Item | Status |
|---|---|
| Path-segment locale routing (`[locale]` param) | Exists: `en`, `zh-TW`, `zh-CN` validated in locale layout |
| Translation files (`messages/*.json`) | Exist: 3 files, 3 namespaces (`login`, `sandbox`, `languages`), ~30 keys each |
| `TranslationProvider` (React context) | Exists: `components/TranslationProvider.tsx` |
| `useTranslations(namespace)` hook | Exists: `hooks/useTranslations.ts` — dot-key lookup, returns key string on miss |
| `LanguageSwitcher` component | Exists: `components/LanguageSwitcher.tsx` — swaps locale path segment |
| Locale middleware (default redirect) | Missing — no `middleware.ts` exists |
| `sandbox` namespace keys | Dead code — defined in JSON but never consumed by `useTranslations` |
| Workspace UI strings | Hardcoded English in JSX and `recoveryCopy.ts` |

### Existing functions that map to the desired plan

| Desired feature | Current state | Files |
|---|---|---|
| Workspace CRUD + switching | Functional (WS-01 through WS-07 COMPLETE) | `workspace-workspaces.logic.ts`, `workspace-shell.tsx` (`HistoryProjectPanel`) |
| Project CRUD / open / restore / fork | Functional | `workspace-projects.logic.ts`, `workspace-shell.tsx` |
| AI chat + file actions | Functional (AI-WS-01 through AI-WS-06 + all hotfixes COMPLETE) | `workspace-chat-*.logic.ts`, `workspace-ai-*.logic.ts`, `workspace-shell.tsx` (`WorkspaceChatPanel`) |
| File tree + editor | Functional | `workspace-file-navigation.logic.ts`, `workspace-shell.tsx` (`WorkspaceEditorPanel`, `FileTreeNode`) |
| Preview | Functional | `workspace-preview.logic.ts`, `workspace-shell.tsx` (`WorkspacePreviewPanel`) |
| Project history (snapshot timeline + restore) | Functional | `workspace-snapshots.logic.ts`, `workspace-shell.tsx` (`ProjectHistoryPanel`) |
| Checkpoint create / revert / diff / compare | Functional | `workspace-checkpoint-*.logic.ts`, `workspace-shell.tsx` (`HistoryCheckpointList`) |
| Public project list + view + fork | Functional | `workspace-projects.logic.ts`, `/share` pages |
| Dashboard / usage summary | Functional | `workspace-quota-usage.logic.ts`, `workspace-shell.tsx` (`DashboardSummary`) |
| Feature flag system (`PROJECT_FIRST_UX`) | Functional | `lib/feature-flags.ts` |
| Build targets + command exec | Functional | `workspace-build-targets.logic.ts`, `workspace-exec.logic.ts` |

### What is missing

- Public landing chatbox ("Build anything" with prompt input)
- Workspace sidebar with Home / Projects / Templates / Recent Projects / Upgrade / Account nav
- Project mode with AI left panel + tabbed right panel
- Tab registry system (Preview, Code, Database, Auth, etc.)
- Account dropdown menu (profile, settings, language, theme, help, logout)
- Upgrade / billing UI
- Theme switcher (light/dark)
- GitHub integration placeholder
- Publish / deploy UI
- Product tabs (Database, Auth, Security, Analytics, Env Var, Payment, Domain, Storage, Agent Skills)
- Workspace-wide i18n (all workspace strings are hardcoded English)
- Default locale middleware (`/` → `/en` redirect)
- Responsive project-mode layout (current layout scrolls vertically, not fixed panels)

---

## 2. Migration Principle

**This is an evolutionary redesign, not a rewrite.**

Core rules:

1. **Preserve existing routes.** `/[locale]`, `/[locale]/login`, `/[locale]/register`, `/[locale]/app`, `/[locale]/share/*` remain as primary routes. New views are added as internal states within existing routes.
2. **Preserve completed AI-WS functionality.** All AI-WS tasks (AI-WS-01 through AI-WS-06) and all hotfixes (AI-WS-02-hotfix, AI-WS-03-hotfix through hotfix5, AI-WS-06-hotfix through hotfix3, PREVIEW-hotfix, UX-FILETREE-hotfix) are COMPLETE and LOCKED. Their logic, components, and data flows must not be broken or restructured unless a specific slice explicitly requires extraction with tests preserved.
3. **Wrap, reorganize, and extract incrementally.** Existing working functions (chat, file actions, project history, preview, editor, workspace switching) should be wrapped in new layout containers, not rewritten. When extracting a component from `workspace-shell.tsx`, preserve its test coverage and data contract.
4. **Avoid broad refactors.** Each implementation slice should change the minimum set of files needed for that slice. Do not combine unrelated refactors into a single slice.
5. **Reuse existing state management.** The app uses React `useState`/`useRef` with prop-drilling from `page.tsx` to `WorkspaceShell`. This pattern continues for v1. No state management library migration.
6. **Reuse existing locale routing.** The `[locale]` path-segment pattern, `TranslationProvider`, `useTranslations` hook, and `LanguageSwitcher` component are the foundation. Expand them; do not replace them.
7. **Feature flag continuity.** `PROJECT_FIRST_UX` remains the primary feature flag. New UX work should either build on this flag or introduce a scoped flag if needed.

---

## 3. Proposed Final Information Architecture

```
PUBLIC (unauthenticated)
├── /[locale]              → Public landing: "Build anything" + chatbox + sign-in CTA
├── /[locale]/login        → Login form (existing, polished)
├── /[locale]/register     → Registration form (existing, polished)
└── /[locale]/share/[id]   → Public project viewer (existing, read-only)

WORKSPACE (authenticated, single route)
└── /[locale]/app          → Workspace shell (existing route, evolved)
    ├── [view: home]       → "Build anything" + chatbox (authenticated version)
    ├── [view: projects]   → Project grid/list for current workspace
    ├── [view: templates]  → Templates / showcases / community browser
    ├── [view: project]    → Project mode (AI panel + tabbed workspace)
    └── sidebar always visible:
        ├── Workspace dropdown (switch workspace)
        ├── Home
        ├── Projects
        ├── Templates
        ├── Recent projects (clickable → opens project mode)
        ├── Usage / dashboard (compact)
        ├── Upgrade CTA
        └── Account avatar → popup menu

ACCOUNT MENU (popup, not a separate page)
├── Profile / Settings
├── Language (en / zh-TW / zh-CN)
├── Theme (Light / Dark)
├── Help
├── Referral / Affiliate (placeholder)
└── Log out
```

Project mode is an internal view state within `/[locale]/app`, not a separate route.

---

## 4. Route / View Map

### Routes (files on disk)

| Route file | URL | Purpose | Change |
|---|---|---|---|
| `app/[locale]/page.tsx` | `/[locale]` | Public landing with chatbox | Redesign content, add chatbox |
| `app/[locale]/login/page.tsx` | `/[locale]/login` | Login | Polish + full i18n |
| `app/[locale]/register/page.tsx` | `/[locale]/register` | Register | Polish + full i18n |
| `app/[locale]/app/page.tsx` | `/[locale]/app` | Workspace (all views) | Evolve layout, add view state |
| `app/[locale]/share/[projectId]/page.tsx` | `/[locale]/share/[id]` | Public project view | Minor polish |
| `middleware.ts` (new) | N/A | Default locale redirect | New file |

### Routes to deprecate later (UX-IA-14)

| Current route | Action |
|---|---|
| `/[locale]/keys` | Redirect to `/[locale]/app` with settings |
| `/[locale]/account` | Redirect to `/[locale]/app` |
| `/[locale]/projects` | Redirect to `/[locale]/app` |
| `/[locale]/gallery` | Redirect to `/[locale]/app` |

### Internal view states within `/[locale]/app`

```typescript
type WorkspaceView = 'home' | 'projects' | 'templates' | 'project';
```

Managed via React state in `page.tsx`. The sidebar controls which view is active. Clicking a recent project sets `view = 'project'` and opens that project.

---

## 5. Workspace Page Spec

### Overall layout

```
┌──────────┬──────────────────────────────────────────────┐
│          │                                              │
│ SIDEBAR  │          RIGHT CONTENT AREA                  │
│ (fixed)  │          (varies by view)                    │
│          │                                              │
│ ~260px   │          flex-1                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

No separate top header bar. The sidebar IS the chrome.

### Left sidebar sections

```
┌─────────────────────┐
│ ▼ My Workspace      │  workspace name + dropdown to switch
│                     │
│ 🏠 Home             │  → view: home
│ 📁 Projects         │  → view: projects
│ 🌐 Templates        │  → view: templates
│                     │
│ ─── Recent ───      │
│ ○ My Portfolio      │  click → opens project mode
│ ○ Todo App          │
│ ○ Landing Page      │
│                     │
│ (spacer)            │
│                     │
│ ─── bottom ───      │
│ Usage: 24/100 AI    │  compact dashboard summary
│ ⬆ Upgrade           │  upgrade CTA button
│ 👤 John             │  avatar + click → account menu
└─────────────────────┘
```

### Right content — Home view

Shows "Build anything" with chatbox (same experience as public landing, but authenticated). Submitting a prompt creates a new project in the selected workspace and opens project mode.

### Right content — Projects view

Project cards in grid or list view, filtered to selected workspace. `+ New` creates a project. Clicking a card opens project mode. Empty state: "No projects yet. Start building!"

### Right content — Templates view

Public/community projects with search and fork capability. Forking creates a copy in user's workspace and opens project mode. Reuses existing `loadPublicWorkspaceProjects` data.

### Workspace selector behavior

- Dropdown shows all user workspaces (existing workspace CRUD)
- "Create new workspace" option
- Switching workspace filters projects and recent list
- Default workspace auto-created on first login (already implemented WS-01)

### Recent projects behavior

- Last 5–8 opened projects, computed from existing `workspaceProjects` sorted by `updatedAt`
- Click opens project mode directly (locked decision #8)
- Shows project name + last-modified time

### Account menu behavior (popup)

```
┌──────────────────────┐
│ User Name            │
│ user@example.com     │
│ ──────────────────── │
│ Settings             │
│ Language   ▸ English │
│ Theme      ▸ Light   │
│ ──────────────────── │
│ Help                 │
│ Referral (coming)    │
│ ──────────────────── │
│ Log out              │
└──────────────────────┘
```

- Language submenu: en / 繁體中文 / 简体中文 — switching changes `[locale]` URL segment via existing `LanguageSwitcher` mechanism
- Theme submenu: Light / Dark (v1: light only, dark as placeholder)
- Settings opens inline view or modal for API keys / profile

### How existing workspace/project logic is reused

- `workspaceProjects`, `selectedWorkspaceId`, `onCreateWorkspaceProject`, `onOpenWorkspaceProject`, `onResumeWorkspaceProjectById` from `page.tsx` are preserved and wired into the new sidebar/views
- `HistoryProjectPanel` logic (workspace select, project select, create, open, fork) is reused but presented differently (grid/cards instead of `<select>` dropdowns)
- `DashboardSummary` data feeds the compact sidebar usage display

### Responsive behavior

- < 768px: sidebar collapses to hamburger / slide-over
- ≥ 768px: sidebar always visible

---

## 6. Project Mode Spec

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│ [← Back]  Project Name                    [GitHub] [Publish] │
├────────────────────┬─────────────────────────────────────────┤
│                    │ [Preview] [Code] [DB] [Auth] [...]      │
│   AI ASSISTANT     │ ─────────────────────────────────────── │
│                    │                                         │
│   Chat messages    │     ACTIVE TAB CONTENT                  │
│   ...              │                                         │
│                    │     (Preview iframe / Code editor /     │
│   ────────────     │      placeholder for future tabs)       │
│   [⏱ History]     │                                         │
│   ────────────     │                                         │
│   [prompt input]   │                                         │
│   [Send]           │                                         │
├────────────────────┤                                         │
│ [◀ collapse]       │                                         │
└────────────────────┴─────────────────────────────────────────┘
```

### AI assistant / history panel (left)

**Default state — AI chat visible:**

- Reuses existing `WorkspaceChatPanel` logic and handlers
- Prompt input at bottom of panel
- Model selector as compact dropdown in input bar
- Auto-scroll to latest message
- All AI-WS file action confirmation flows preserved

**History icon (⏱) behavior:**

Left panel toggles between AI chat and project history:

```
┌────────────────────┐
│ [🤖 Chat] [⏱ Hist] │  toggle between views
│ ──────────────────── │
│ Project History      │
│                      │
│ ● AI changes saved   │  latest
│   Today 2:30 PM      │
│                      │
│ ● File saved         │
│   Today 1:15 PM      │
│                      │
│ ● Project created    │
│   Yesterday          │
│                      │
│ [Restore this ver.]  │  button on selected entry
└──────────────────────┘
```

- Reuses `ProjectHistoryPanel` data + `computeProjectHistoryRows` + `onRestoreWorkspaceProjectFromSnapshotById`
- Inline restore confirmation (replace `window.confirm` with UI dialog)

**Collapse/expand:**

- Toggle at bottom of left panel
- Collapsed: thin icon strip (~48px) showing AI + History icons
- Expanded: full width (~320px)
- Preference stored in localStorage

### Right-side tab system

**Tab bar position:**

- Default: horizontal tabs across the top of the right panel
- Toggle option: vertical tabs on the left edge of the right panel
- Preference stored in localStorage

**Initial tabs (v1):**

| Tab | Content | Status |
|---|---|---|
| Preview | Live preview iframe (existing `WorkspacePreviewPanel`) | Reuse — needs panel sizing |
| Code & Files | File tree + code editor (existing `WorkspaceEditorPanel` + `FileTreeNode`) | Reuse — needs panel sizing |
| Database | Placeholder: "Coming soon" | Placeholder only |
| Auth | Placeholder | Placeholder only |
| Security | Placeholder | Placeholder only |
| Analytics | Placeholder | Placeholder only |
| Env Var / Secrets | Placeholder | Placeholder only |
| Publishing | Placeholder | Placeholder only |
| Deploy | Placeholder | Placeholder only |
| Payment | Placeholder | Placeholder only |
| Domain | Placeholder | Placeholder only |
| App Storage | Placeholder | Placeholder only |
| Agent Skills | Placeholder | Placeholder only |

**Tab registry model:**

```typescript
interface TabDefinition {
  id: string;
  labelKey: string;          // i18n key, e.g. "tabs.preview"
  icon?: string;
  defaultVisible: boolean;
  defaultPinned: boolean;
  content: React.ComponentType | 'placeholder';
}

const TAB_REGISTRY: TabDefinition[] = [
  { id: 'preview', labelKey: 'tabs.preview', defaultVisible: true, defaultPinned: true, content: PreviewTabContent },
  { id: 'code-files', labelKey: 'tabs.codeFiles', defaultVisible: true, defaultPinned: true, content: CodeFilesTabContent },
  { id: 'database', labelKey: 'tabs.database', defaultVisible: true, defaultPinned: false, content: 'placeholder' },
  // ... remaining tabs
];
```

**Tab pinning/visibility:**

- Pinned tabs: always visible in tab bar
- Visible tabs: accessible from overflow "+" menu
- Hidden tabs: not shown (configurable in settings)
- Default: Preview + Code & Files pinned; others visible in overflow
- User preferences stored in localStorage

**Tab orientation toggle:**

- Small toggle icon in tab bar area
- Switches between horizontal (top) and vertical (left side) layout
- Preference stored in localStorage

**Future extensibility:**

- New tabs added by appending a `TabDefinition` to `TAB_REGISTRY`
- Each tab's label uses an i18n key
- Tab content components are lazy-loaded

### Top-right actions

- **GitHub icon**: placeholder link (v1)
- **Publish icon**: placeholder with "coming soon" (v1)

### Relationship to existing AI-WS capabilities

All existing AI-WS capabilities are preserved and wired through the AI chat panel in project mode:

- File create/write/update (auto-applied)
- File delete with user confirmation
- Named file read
- Workspace search
- File action confirmation/cancellation flow
- Chat thread persistence
- Execution polling

The tab system provides the visual container. The AI chat panel provides the interaction model. File actions from AI are applied to the Code & Files tab's file tree.

### Relationship to existing file tree / editor / preview

- **Code & Files tab** = existing `WorkspaceEditorPanel` content (file tree + editor), resized to fill tab content area
- **Preview tab** = existing `WorkspacePreviewPanel` content (iframe), resized to fill tab content area
- `.git` filtering (UX-FILETREE-hotfix) continues to apply
- File tree moves from being inside the editor card to being the left portion of the Code & Files tab content

---

## 7. New Functionality Required

### A. Already exists (reuse as-is)

- Workspace CRUD and switching (WS-01 through WS-07)
- Project CRUD, open, restore, fork
- AI chat + file actions (AI-WS-01 through AI-WS-06 + all hotfixes)
- File tree, editor, preview
- Project history (snapshot timeline + restore)
- Checkpoint create / revert / diff / compare
- Public project list + view + fork
- Dashboard / quota summary
- `TranslationProvider` + `useTranslations` hook
- `LanguageSwitcher` component
- Translation files structure (3 locales, 3 namespaces)
- Feature flag system (`PROJECT_FIRST_UX`)
- Build targets + command exec

### B. Mostly UI wiring (existing logic, new presentation)

- **Workspace sidebar**: restructure `WorkspaceShell` layout — move workspace selector from history section to sidebar, add Home/Projects/Templates nav
- **Project mode layout**: restructure current 3-column grid into AI panel (left) + tabbed panel (right)
- **Account menu popup**: new component, wires existing user identity + logout + language switcher
- **Recent projects**: computed from existing `workspaceProjects` sorted by `updatedAt`
- **Project/template card grid**: new presentation of existing project data
- **History panel toggle**: new UI to switch left panel between chat and history (existing `ProjectHistoryPanel` data)

### C. New frontend state/model

- `WorkspaceView` state: `'home' | 'projects' | 'templates' | 'project'`
- Tab registry: `TabDefinition[]` array + `activeTabId` state + `tabVisibility` preferences in localStorage
- Tab orientation preference: `'horizontal' | 'vertical'` in localStorage
- AI panel collapse state: `boolean` in localStorage
- Theme preference: `'light' | 'dark'` in localStorage (dark mode implementation deferred)
- Public landing chatbox prompt preservation: sessionStorage through login redirect

### D. New backend/API required

- None for v1 core UX — all workspace, project, AI, file, and history APIs already exist
- Upgrade/billing API: needed when upgrade flow moves beyond placeholder
- GitHub OAuth integration: needed when GitHub tab moves beyond placeholder

### E. Future / later phase (placeholder only in v1)

- Database tab content (requires DB provisioning backend)
- Auth tab content (requires auth configuration backend)
- Security tab content
- Analytics tab content (requires analytics backend)
- Env Var / Secrets tab content (requires secrets management backend)
- Publishing tab content
- Deploy tab content (requires deployment backend)
- Payment tab content (requires payment integration backend)
- Domain tab content (requires domain management backend)
- App Storage tab content (requires storage backend)
- Agent Skills tab content (requires agent system backend)
- GitHub integration
- Dark theme implementation
- Referral / affiliate system

---

## 8. Multilingual Plan

### Current i18n status

- Infrastructure exists and works: path-segment locales, TranslationProvider, useTranslations hook, LanguageSwitcher
- Coverage is ~5%: only login form and language names are translated
- `sandbox` namespace has 16 keys but is unused (dead code)
- `recoveryCopy.ts` has ~50 strings hardcoded in English, not connected to i18n
- Entire workspace UI uses hardcoded English strings

### Required translation key structure

```json
{
  "common": {
    "appName": "AI Sandbox",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "create": "Create",
    "open": "Open",
    "close": "Close",
    "back": "Back",
    "loading": "Loading...",
    "error": "Error",
    "success": "Success",
    "confirm": "Confirm",
    "send": "Send",
    "search": "Search"
  },
  "login": { "/* existing keys + expand */" : "" },
  "register": { "/* mirror login structure */" : "" },
  "landing": {
    "hero": "Build anything",
    "heroSubtitle": "Describe what you want to build...",
    "signIn": "Sign in to start",
    "continueToWorkspace": "Continue to workspace"
  },
  "workspace": {
    "home": "Home",
    "projects": "Projects",
    "templates": "Templates & Community",
    "recentProjects": "Recent",
    "upgrade": "Upgrade",
    "newProject": "New project",
    "noProjects": "No projects yet. Start building!",
    "buildAnything": "Build anything",
    "describeBuild": "Describe what you want to build...",
    "start": "Start"
  },
  "project": {
    "chat": "Chat",
    "history": "History",
    "preview": "Preview",
    "codeFiles": "Code & Files",
    "restore": "Restore this version",
    "restoreConfirm": "Restore this version? Your current workspace will be replaced.",
    "noHistory": "No history yet for this project.",
    "files": "Files",
    "unsavedChanges": "Unsaved changes"
  },
  "tabs": {
    "preview": "Preview",
    "codeFiles": "Code & Files",
    "database": "Database",
    "auth": "Auth",
    "security": "Security",
    "analytics": "Analytics",
    "envVars": "Env Var / Secrets",
    "publishing": "Publishing",
    "deploy": "Deploy",
    "payment": "Payment",
    "domain": "Domain",
    "appStorage": "App Storage",
    "agentSkills": "Agent Skills",
    "comingSoon": "Coming soon"
  },
  "account": {
    "settings": "Settings",
    "language": "Language",
    "theme": "Theme",
    "help": "Help",
    "referral": "Referral",
    "logout": "Log out",
    "light": "Light",
    "dark": "Dark"
  },
  "ai": {
    "prompt": "Ask the assistant...",
    "sending": "Sending...",
    "modelProvider": "Model",
    "fileActions": "File Actions",
    "approvalRequired": "Approval required",
    "apply": "Apply",
    "skip": "Skip"
  },
  "errors": { "/* error messages */" : "" },
  "languages": { "/* existing */" : "" }
}
```

### What text must never be hardcoded

All user-facing labels, buttons, headings, placeholders, tooltips, empty states, error messages, success messages, confirmation dialogs, tab names, menu items, and navigation labels.

### Language menu behavior

- Available in account dropdown menu and on login/register pages
- Switching language changes the `[locale]` URL segment via `router.push` (existing `LanguageSwitcher` mechanism)
- Preference persisted in localStorage for next visit
- Default: browser `Accept-Language` header → best match → fallback to `en`

### Launch languages

1. English (`en`)
2. Traditional Chinese (`zh-TW`)
3. Simplified Chinese (`zh-CN`)

### Fallback language behavior

- If a key is missing in `zh-TW` or `zh-CN`, fall back to `en` value
- Enhance `useTranslations` hook to return English fallback instead of raw key string
- **Implementation note**: `TranslationProvider` or the locale layout must make `en.json` available as a fallback map alongside the active locale's messages. Preferred approach: always import `en.json` as `fallbackMessages` and pass both `messages` and `fallbackMessages` through context, so `useTranslations` checks the active locale first and falls back to English when a key is missing. This avoids a second network/filesystem read for `en` users while still supporting fallback for `zh-TW` and `zh-CN`.

### How to add future languages

1. Create `messages/[locale].json` with all keys
2. Add locale code to validated set in `app/[locale]/layout.tsx`
3. Add locale to `LanguageSwitcher` and `languages` namespace
4. No other code changes needed

### How to keep future tabs multilingual

- Tab definitions reference `labelKey` (e.g., `tabs.database`)
- Adding a tab means adding one key per locale file
- Tab content placeholder strings also use i18n keys

### Migrating existing hardcoded workspace strings

- `recoveryCopy.ts` strings are migrated to i18n keys incrementally — each UX-IA slice that touches a component also migrates its hardcoded strings to translation keys
- Not done in one big pass; done per-slice as components are touched

---

## 9. Visual Direction

### Design system foundation

- **Font**: Inter (via `next/font` or Google Fonts) — clean, modern, professional
- **Color palette**: Neutral grays + one brand accent (blue-600 primary). Extended in Tailwind config with `brand`, `surface`, `border` semantic tokens.
- **Border radius**: `rounded-lg` (8px) for cards/panels, `rounded-md` (6px) for buttons/inputs
- **Shadows**: `shadow-sm` for cards, `shadow-md` for popups — replace most `border border-gray-200` with subtle shadows for primary surfaces
- **Spacing**: 4px grid (Tailwind default), `p-4` panel padding, `gap-3` for grids
- **Minimum text size**: 12px for labels, 14px for body — no more `text-[10px]` or `text-[11px]`

### Component-level direction

| Area | Direction |
|---|---|
| App shell | Full-height sidebar + content layout; sidebar IS the chrome |
| Sidebar | Dark or branded background (slate-900 or brand-dark), white text, active item highlighted |
| Public landing | Clean centered hero, prominent chatbox, minimal chrome |
| Workspace home | Same "Build anything" layout, inside workspace shell |
| Project mode | Two-panel fixed layout (AI left, tabs right), clean panel dividers |
| Cards | White background, subtle shadow, 8px radius, hover elevation |
| Tabs | Underline style (horizontal) or left-accent style (vertical), compact |
| Account menu | Dropdown popup with separators, icons next to items |
| Empty states | Centered icon + one-line message + CTA button |
| Buttons | Primary (brand filled), secondary (border), ghost (text-only) |
| Typography | Inter, weights 400/500/600/700, clear hierarchy |

### Light / dark theme strategy

- v1: light theme only, but all color values go through Tailwind config tokens
- CSS custom properties for surface/text/border/accent defined in `:root` and `[data-theme="dark"]`
- `globals.css` already has `:root` and `prefers-color-scheme: dark` stubs — extend these
- Dark mode implementation deferred; token system makes it easy to add later

### Originality

Inspired by the professional feel of Replit, Lovable, and Base44, but not copying brand elements, logos, or exact layouts. The visual language should feel like a distinct product.

---

## 10. Implementation Roadmap

All phases are incremental evolutions of the existing app. Each phase wraps, reorganizes, or extends existing working code.

---

### UX-IA-00: Master Spec

**Objective**: This document.
**Status**: Complete.

---

### UX-IA-01: i18n Foundation & Locale Middleware

**Objective**: Complete the i18n infrastructure so all subsequent phases use translation keys from day one.

**Likely files**:
- `frontend/middleware.ts` (new) — default locale redirect (`/` → `/en`)
- `frontend/messages/en.json` — expand with all namespaces from section 8
- `frontend/messages/zh-TW.json` — expand
- `frontend/messages/zh-CN.json` — expand
- `frontend/hooks/useTranslations.ts` — add English fallback for missing keys
- `frontend/lib/recovery-copy.ts` — document migration path (not rewrite yet)
- `frontend/components/LanguageSwitcher.tsx` — minor polish

**Existing functions to reuse**: `TranslationProvider`, `useTranslations`, `LanguageSwitcher`, translation JSON structure
**New functionality**: Locale middleware, English fallback in hook, expanded translation keys
**Decision points to resolve during this slice**:
- Namespace access pattern: decide whether components call `useTranslations` once per namespace they need (current pattern, two calls for two namespaces), or whether the hook is extended to support cross-namespace dot paths (e.g., `t('common.save')` from any call site). Do not implement beyond the chosen pattern; record the decision in the consolidation checkpoint.
- `sandbox` namespace migration: decide whether to delete the existing dead `sandbox` keys and replace with the new namespace structure, keep them alongside, or map them into the new structure. Apply the decision in this slice.
**Non-goals**: No visual changes, no layout changes, no `recoveryCopy` rewrite (gradual migration), no deletion of `sandbox` namespace keys until migration strategy is decided within this slice
**Middleware constraint**: The new `middleware.ts` must not interfere with the existing `/api/*` rewrites configured in `next.config.js`. Middleware must either exclude `/api/*` paths explicitly or be scoped to locale-path detection only.
**Risk**: Low
**Loop**: 3-step (implement, verify, consolidate)
**Model**: Sonnet 4.6
**Acceptance**: All translation keys defined in all 3 locale files, middleware redirects `/` → `/en` without breaking `/api/*` rewrites, hook falls back to English for missing keys, existing login page still works with translations, namespace access pattern decision recorded

---

### UX-IA-02: Design Token Foundation

**Objective**: Establish Tailwind design tokens that all visual phases build on.

**Likely files**:
- `frontend/tailwind.config.js` — extend theme (brand colors, shadows, radii, font)
- `frontend/app/globals.css` — Inter font, CSS custom properties for theme tokens
- `frontend/app/[locale]/layout.tsx` — font import if using `next/font`

**Existing functions to reuse**: Existing Tailwind config structure
**New functionality**: Design tokens only
**Non-goals**: No layout changes, no component changes
**Risk**: Low
**Loop**: 2-step (implement, consolidate)
**Model**: Sonnet 4.6
**Acceptance**: Tailwind config has brand/surface/border color tokens, Inter font loads, CSS variables for light theme defined in `:root`

---

### UX-IA-03: Public Landing Redesign + Login/Register Polish

**Objective**: Transform public landing into "Build anything" with chatbox. Polish login and register to match visual system. Full i18n for all three pages.

**Likely files**:
- `frontend/components/public/public-landing-slice.tsx` — redesign with chatbox
- `frontend/app/[locale]/page.tsx` — wire new props
- `frontend/app/[locale]/login/page.tsx` — visual polish + full i18n
- `frontend/app/[locale]/register/page.tsx` — visual polish + full i18n
- `frontend/components/LanguageSwitcher.tsx` — ensure visible on all three pages

**Existing functions to reuse**: `PublicLandingSlice` component, login auth flow, `useTranslations`, `LanguageSwitcher`
**New functionality**: Chatbox UI on landing, sessionStorage prompt preservation through login, i18n for all landing/login/register text
**Non-goals**: No anonymous project creation, no workspace changes, **no visual edit mode** (see Section 12 — Visual Edit Mode is a later capability; UX-IA-03 must not make decisions that would prevent future preview iframe selection events), **no production authentication changes** — UX-IA-03 must not implement Auth.js, NextAuth, Google/Apple OAuth, database-backed sessions, API guards, or password-reset flows; those belong to AUTH-APP-01 which follows immediately after
**Auth constraint**: UX-IA-03 polishes the login and register *page UI* only (design tokens, i18n, layout). It must not alter backend auth flow, session management, or any OAuth configuration. Decisions made in UX-IA-03 must not make AUTH-APP-01 harder (e.g., do not hardcode auth provider assumptions into the login page structure).
**Risk**: Low-Medium (landing is isolated from workspace)
**Loop**: 3-step (implement, verify, consolidate)
**Model**: Sonnet 4.6
**Acceptance**: Landing shows "Build anything" + chatbox, typing prompt before login → redirects to login → prompt preserved in sessionStorage, login/register match design tokens, all text uses i18n keys

---

### AUTH-APP-01: aiSandBox First-Party User Authentication

> **Family note**: AUTH-APP-01 is a separate task family from UX-IA. It is placed here in the roadmap between UX-IA-03 and UX-IA-04 because production authentication must be in place before workspace/project-mode redesign reaches users. AUTH-APP-01 is not a UX-IA slice — it will be tracked under its own task family when registered.

**Objective**: Add production-ready authentication to the aiSandBox app itself. Real users must be able to sign in securely (email, Google, Apple) before accessing hosted aiSandBox features.

**Recommended initial stack**:
- Auth.js / NextAuth-style architecture (evaluate against existing architecture before committing)
- Email auth (magic link or email+password — decide during spec phase)
- Google OAuth sign-in
- Apple OAuth sign-in
- PostgreSQL-backed users / linked accounts / sessions
- HTTP-only secure session cookies

**Scope**:
- **Email authentication**: email login or magic link/password flow (decided during spec); email verification; password reset if password auth is chosen; rate limiting and abuse protection on auth endpoints
- **Google sign-in**: OAuth client setup; redirect URL configuration; account linking behavior for existing email users
- **Apple sign-in**: Apple Developer setup documentation; Services ID / Team ID / Key ID / private key handling; private relay email handling; account linking behavior
- **User/session model**: user table; linked provider accounts table; session persistence; created/updated timestamps; soft-delete or disabled-user handling consistent with existing architecture
- **Route/API protection**: protect all aiSandBox app pages that require login; protect backend APIs that require authenticated user context; consistent redirect/reject behavior for unauthenticated users
- **UX**: login page; register/sign-in entry; logout; basic account page; clear error messages for failed login, OAuth failure, and account-linking edge cases
- **Security**: HTTP-only secure cookies; CSRF protection where applicable; safe redirect handling; no secrets exposed to frontend; OAuth secrets stored only in environment variables; rate-limit auth endpoints; prevent duplicate account creation for same email/provider combinations
- **Testing and verification**: unit tests for auth helpers and guards; integration tests for protected route behavior; build/typecheck/lint must pass; manual OAuth setup checklist for Google and Apple

**Non-goals**:
- Reusable auth module or template for user-generated apps (that is AUTH-MODULE-01, a later separate item)
- Multi-framework auth templates
- Clerk / Supabase / Firebase provider support
- Enterprise SSO / SAML
- Billing/subscription integration
- Admin user-management dashboard (unless already planned in architecture)
- Full identity provider platform

**Complexity note**: AUTH-APP-01 is a real multi-slice phase, not a login-page tweak. Estimated to require several implementation slices (e.g., schema + session model, email auth, Google OAuth, Apple OAuth, route protection, UX polish, testing). Register and stage-start with a plan phase before implementation.

**Recommended sequencing**: AUTH-APP-01 must start after UX-IA-03 is COMPLETE and LOCKED. UX-IA-04 (Workspace Shell) can begin after AUTH-APP-01 is stable enough that route protection will not disrupt workspace restructuring.

---

### UX-IA-04: Workspace Shell + Sidebar + Home View

**Objective**: Evolve `WorkspaceShell` into sidebar + right content layout. Add `WorkspaceView` state. Home view shows "Build anything" chatbox (authenticated — submitting creates project + opens project mode).

**Likely files**:
- `frontend/components/workspace/workspace-shell.tsx` — layout restructure (sidebar + content)
- `frontend/components/workspace/workspace-shell.test.tsx` — test updates
- `frontend/app/[locale]/app/page.tsx` — add `workspaceView` state, wire create-project-from-prompt
- New: `frontend/components/workspace/workspace-sidebar.tsx` (extract sidebar)

**Existing functions to reuse**: Workspace switching (`HistoryProjectPanel` workspace select), `DashboardSummary` data, session/project state from `page.tsx`, `recoveryCopy` strings
**New functionality**: `WorkspaceView` state, sidebar navigation component, home view chatbox, create-project-from-prompt flow
**Non-goals**: No project mode yet, no tab system, no account menu
**Risk**: Medium-High (major layout restructure of main component, many test updates)
**Dependencies / sequencing risk**: `CURRENT-WORKING-STATE-CHECKPOINT.md` recommends PROJ-02-01 (Refactor Project Open Into Deterministic Workspace Hydration Flow) to address the fragile `handleOpenWorkspaceProject` chain in `page.tsx`. UX-IA-04 will restructure `page.tsx` and `workspace-shell.tsx` significantly. PROJ-02-01 should be addressed before or folded into UX-IA-04 to avoid restructuring the project-open flow twice in separate passes. Confirm sequencing before starting UX-IA-04.
**Loop**: 4-step (plan, implement, verify tests, consolidate)
**Model**: Opus 4.6
**Acceptance**: Sidebar renders with workspace selector + nav items, Home view shows chatbox, prompt submission creates project, all text uses i18n keys, existing workspace/project functionality preserved

---

### UX-IA-05: Projects Grid/List + Recent Projects

**Objective**: Projects view shows project cards in grid or list. Recent projects in sidebar are clickable.

**Likely files**:
- `frontend/components/workspace/workspace-shell.tsx` — projects view content
- New: `frontend/components/workspace/workspace-project-card.tsx`
- `frontend/app/[locale]/app/page.tsx` — recent projects computation

**Existing functions to reuse**: `workspaceProjects`, `onOpenWorkspaceProject`, `onCreateWorkspaceProject`, `onResumeWorkspaceProjectById`
**New functionality**: Project card component, grid/list toggle, recent projects list
**Non-goals**: No template/community view
**Risk**: Low-Medium
**Loop**: 3-step (implement, verify, consolidate)
**Model**: Sonnet 4.6
**Acceptance**: Projects grid shows all projects for selected workspace, grid/list toggle works, clicking project opens project mode, sidebar recent projects work, empty state shown

---

### UX-IA-06: Templates / Community View

**Objective**: Templates view shows public/community projects with search and fork.

**Likely files**:
- `frontend/components/workspace/workspace-shell.tsx` — templates view content

**Existing functions to reuse**: `loadPublicWorkspaceProjects`, `onForkPublicWorkspaceProject`, `onViewPublicWorkspaceProject`
**New functionality**: Template card UI, search/filter
**Non-goals**: No template creation, no curation system
**Risk**: Low
**Loop**: 3-step (implement, verify, consolidate)
**Model**: Sonnet 4.6
**Acceptance**: Templates view shows public projects, fork works, forked project opens in project mode

---

### UX-IA-07: Account Menu + Settings + Language/Theme

**Objective**: Account avatar in sidebar opens popup menu. Language switching integrated. Theme toggle (light only for v1, dark as placeholder).

**Likely files**:
- New: `frontend/components/workspace/workspace-account-menu.tsx`
- `frontend/components/workspace/workspace-sidebar.tsx` — wire account menu
- `frontend/components/LanguageSwitcher.tsx` — reuse in account menu

**Existing functions to reuse**: `LanguageSwitcher` mechanism, user identity from `page.tsx`, logout flow
**New functionality**: Account menu popup component, theme preference placeholder
**Non-goals**: No profile editing, no real billing
**Risk**: Low
**Loop**: 2-step (implement, consolidate)
**Model**: Sonnet 4.6
**Acceptance**: Account menu opens/closes, language switching works, logout works, all text i18n

---

### UX-IA-08: Project Mode Shell

**Objective**: When a project is opened, workspace transforms into project mode: AI panel (left) + tabbed content (right). Back button returns to workspace.

**Likely files**:
- `frontend/components/workspace/workspace-shell.tsx` — project mode layout branch
- New: `frontend/components/workspace/workspace-project-mode.tsx` (extract project mode)
- New: `frontend/components/workspace/workspace-tab-registry.ts` (tab definitions)
- New: `frontend/components/workspace/workspace-tab-bar.tsx` (tab bar component)
- `frontend/app/[locale]/app/page.tsx` — wire project mode view

**Existing functions to reuse**: All AI-WS handlers, file tree, editor, preview, project history handlers — passed as props to project mode
**New functionality**: Project mode layout, tab registry model, tab bar with orientation toggle, collapse/expand AI panel, back-to-workspace navigation
**Non-goals**: No tab content beyond shells (Preview + Code & Files wired in next phase)
**Risk**: Medium-High (core structural change, must preserve all AI-WS capabilities)
**Loop**: 4-step (plan, implement, verify tests, consolidate)
**Model**: Opus 4.6
**Acceptance**: Project mode renders with AI panel + tab bar, back button works, collapse/expand works, orientation toggle works, all AI-WS capabilities still function

---

### UX-IA-09: Project AI + History Panel

**Objective**: Wire AI chat into project mode left panel. Add history icon toggle for project history timeline. Inline restore confirmation.

**Likely files**:
- `frontend/components/workspace/workspace-project-mode.tsx` — AI panel content
- `frontend/components/workspace/workspace-shell.tsx` — reuse chat panel logic

**Existing functions to reuse**: `WorkspaceChatPanel` logic, `ProjectHistoryPanel` data + `computeProjectHistoryRows` + `onRestoreWorkspaceProjectFromSnapshotById`
**New functionality**: Chat/History toggle UI, inline restore confirmation dialog
**Non-goals**: No new AI capabilities, no new history features
**Risk**: Medium (must preserve all AI-WS file action flows)
**Loop**: 3-step (implement, verify, consolidate)
**Model**: Sonnet 4.6
**Acceptance**: AI chat works in project mode, history toggle shows timeline, restore works with inline confirmation, all file action confirmation flows preserved

---

### UX-IA-10: Preview + Code & Files Tabs

**Objective**: Wire existing preview and editor content into the tab system as the first two functional tabs. Panels fill available height.

**Likely files**:
- `frontend/components/workspace/workspace-project-mode.tsx` — tab content wiring

**Existing functions to reuse**: `WorkspaceEditorPanel` + `FileTreeNode` logic, `WorkspacePreviewPanel` logic
**New functionality**: Full-height panel sizing, file tree as left section of Code tab
**Non-goals**: No Monaco Editor integration, no new editor features
**Risk**: Medium (panel sizing, iframe behavior)
**Loop**: 3-step (implement, verify, consolidate)
**Model**: Sonnet 4.6
**Acceptance**: Preview tab shows full-height iframe, Code & Files tab shows file tree + editor filling available space, tab switching works, all file operations preserved

---

### UX-IA-11: Future Product Tab Placeholders

**Objective**: Register all future tabs with placeholder content. Tab pinning/visibility settings.

**Likely files**:
- `frontend/components/workspace/workspace-tab-registry.ts` — all tab definitions
- `frontend/components/workspace/workspace-project-mode.tsx` — visibility settings UI

**Existing functions to reuse**: Tab registry model from UX-IA-08
**New functionality**: 11 placeholder tabs, visibility/pinning settings in localStorage
**Non-goals**: No functional tab content beyond placeholder
**Risk**: Low
**Loop**: 2-step (implement, consolidate)
**Model**: Sonnet 4.6
**Acceptance**: All tabs registered, visible in tab bar or overflow menu, pinning toggles work, placeholders show "Coming soon" with i18n

---

### UX-IA-12: Upgrade Flow + Dashboard Polish

**Objective**: Upgrade CTA in sidebar opens placeholder upgrade view. Dashboard usage in sidebar is compact.

**Likely files**:
- `frontend/components/workspace/workspace-sidebar.tsx` — dashboard/upgrade section
- New: `frontend/components/workspace/workspace-upgrade.tsx` (placeholder)

**Existing functions to reuse**: `DashboardSummary` data (user/usage/quota)
**New functionality**: Upgrade view placeholder, compact dashboard display
**Non-goals**: No real billing integration
**Risk**: Low
**Loop**: 2-step (implement, consolidate)
**Model**: Sonnet 4.6
**Acceptance**: Upgrade CTA opens placeholder, sidebar shows compact usage, all i18n

---

### UX-IA-13: Responsive / Mobile Polish

**Objective**: All views work on common viewport sizes. Sidebar collapses on mobile. Project mode stacks panels.

**Likely files**:
- All layout components — responsive breakpoints

**Existing functions to reuse**: N/A (CSS-only changes)
**New functionality**: Responsive CSS only
**Non-goals**: No native mobile app
**Risk**: Low
**Loop**: 2-step (implement, consolidate)
**Model**: Sonnet 4.6
**Acceptance**: Sidebar collapses < 768px, project mode stacks on mobile, all views usable on 375px width

---

### UX-IA-14: Route Cleanup / Redirects

**Objective**: Redirect deprecated routes to workspace. Clean up unused route files.

**Likely files**:
- `frontend/app/[locale]/keys/page.tsx` — redirect to `/[locale]/app`
- `frontend/app/[locale]/account/page.tsx` — redirect
- `frontend/app/[locale]/gallery/page.tsx` — redirect
- `frontend/app/[locale]/projects/page.tsx` — redirect

**Existing functions to reuse**: Next.js `redirect()` (already used in some of these files)
**New functionality**: Redirects only
**Non-goals**: No new features
**Risk**: Low
**Loop**: 2-step (implement, consolidate)
**Model**: Sonnet 4.6
**Acceptance**: Old routes redirect to `/[locale]/app`, no broken links

---

### UX-IA-15: Visual Edit Mode Foundation

**Objective**: Add a preview element picker / selection overlay to the project mode Preview tab. When the user clicks an element in the preview iframe, capture its DOM metadata (selector, text content, bounding box, CSS classes) and surface it as context to the AI chat panel. AI uses the existing AI-WS file-action system to propose and apply source changes. Preview refreshes after a successful file action.

**Likely files**:
- `frontend/components/workspace/workspace-preview.logic.ts` — postMessage bridge for element selection events from the preview iframe
- `frontend/components/workspace/workspace-project-mode.tsx` — selection overlay toggle, selection context state
- `frontend/components/workspace/workspace-chat-*.logic.ts` — inject selected element context into AI prompt

**Existing functions to reuse**: `WorkspacePreviewPanel` iframe logic, existing AI-WS file-action flow, file-action confirmation safety rules
**New functionality**: Element picker toggle in Preview tab toolbar, cross-frame `postMessage` listener, DOM metadata capture, selected-element context injection into AI prompt
**Non-goals**: No inline text editing, no drag/resize, no style panel, no DOM-to-source mapping (deferred to UX-IA-16+), no bypass of existing file-action confirmation rules
**Risk**: Medium (cross-frame communication, iframe origin constraints, AI prompt context injection)
**Dependencies**: UX-IA-08 (Project Mode Shell) and UX-IA-10 (Preview + Code & Files Tabs) must be COMPLETE and LOCKED first — preview must be a stable tab surface before adding selection overlay
**Loop**: 4-step (plan, implement, verify, consolidate)
**Model**: Opus 4.6
**Acceptance**: Element picker toggle appears in Preview tab, clicking an element highlights it with a selection overlay, element metadata (selector, text, classes, bounds) is appended to the AI chat context, AI can propose file changes based on element context, file-action confirmation flow is preserved

---

### UX-IA-16: Visual Edit AI Patch Flow

**Objective**: Improve the AI's ability to act on selected element context. Establish a cleaner prompt contract for visual edit requests. Add structured patch preview/confirmation before applying source changes from visual edit prompts.

**Likely files**:
- `frontend/components/workspace/workspace-chat-*.logic.ts` — visual-edit prompt contract
- Backend AI service — visual-edit system prompt extension

**Existing functions to reuse**: AI-WS file-action system, file-action confirmation UI, checkpoint creation
**New functionality**: Visual-edit prompt contract, structured diff preview for visual patches
**Non-goals**: No drag/resize editing, no inline text editing, no real-time preview patching
**Risk**: Medium (AI prompt engineering, patch correctness)
**Dependencies**: UX-IA-15 (Visual Edit Mode Foundation) must be COMPLETE and LOCKED
**Loop**: 3-step (implement, verify, consolidate)
**Model**: Sonnet 4.6
**Acceptance**: Visual edit requests produce correct file-action proposals, diff is shown before apply, confirmation is required, checkpoint is created on apply

---

### UX-IA-17: Visual Edit Undo / Checkpoint Integration

**Objective**: Integrate visual edit apply actions with the existing project history/snapshot checkpoint system. Applied visual edits create a named checkpoint. Undo restores from checkpoint using the existing restore flow.

**Likely files**:
- `frontend/components/workspace/workspace-snapshots.logic.ts` — trigger snapshot on visual edit apply
- `frontend/components/workspace/workspace-checkpoint-*.logic.ts` — label visual edit checkpoints
- `frontend/components/workspace/workspace-project-mode.tsx` — undo affordance in Preview tab toolbar

**Existing functions to reuse**: `onCreateWorkspaceSnapshot`, `onRestoreWorkspaceProjectFromSnapshotById`, `ProjectHistoryPanel`
**New functionality**: Auto-snapshot on visual edit apply, visual edit checkpoint label, undo button in Preview tab
**Non-goals**: No multi-level undo stack beyond existing snapshot restore, no drag/resize editing
**Risk**: Low (reuses existing snapshot/restore infrastructure)
**Dependencies**: UX-IA-16 (Visual Edit AI Patch Flow) must be COMPLETE and LOCKED
**Loop**: 2-step (implement, consolidate)
**Model**: Sonnet 4.6
**Acceptance**: Applying a visual edit creates a labeled snapshot, undo button triggers restore confirmation, history timeline shows visual edit checkpoints

---

### AUTH-MODULE-01: Reusable User Authentication Module / Template for aiSandBox-Created Apps

> **Family note**: AUTH-MODULE-01 is a separate task family from UX-IA and from AUTH-APP-01. It is a product-level capability that allows aiSandBox *users* to add authentication to *their own apps* via AI-assisted template generation. It must not be confused with AUTH-APP-01 (which is authentication for the aiSandBox platform itself). It will be tracked under its own task family when registered.

**Objective**: Allow aiSandBox users to say "Add user authentication with email, Google, and Apple sign-in to my app" and have aiSandBox generate or install a working auth starter into their project, including routes, database schema, UI, and environment configuration.

**Recommended v1 scope**:
- One stack only to start: Next.js + Auth.js + PostgreSQL
- Generate auth routes and API handlers
- Generate database schema / migrations for users, accounts, sessions
- Generate protected route example
- Generate login / register / logout UI components
- Generate `.env.example` with required variables documented
- Provide Google OAuth and Apple OAuth setup checklist as inline documentation
- Add validation tests for generated auth flows
- Integrate with aiSandBox checkpoint/rollback system: create a named snapshot before applying generated changes so users can revert cleanly

**Non-goals for v1**:
- Universal framework support (Vue, Angular, SvelteKit, etc.)
- Hosted identity provider
- Clerk / Supabase / Firebase auth provider support
- Enterprise SSO / SAML
- Billing / subscription integration
- Advanced admin dashboard

**Complexity note**: AUTH-MODULE-01 is larger than AUTH-APP-01 because it requires template generation, safe file patching into an existing user project, framework detection, environment variable handling, rollback/checkpoint integration, and validation of generated code. Treat as a major multi-slice product module.

**Prerequisites**: AUTH-APP-01 (aiSandBox's own auth) must be COMPLETE and stable. Project mode, preview/code tabs, and file-action system (UX-IA-08 through UX-IA-10 and AI-WS series) must all be stable.

---

### Cross-Family Roadmap Ordering Note

The recommended implementation order across families is:

1. UX-IA-03 — Public Landing Redesign + Login/Register Polish (UI/i18n only)
2. AUTH-APP-01 — aiSandBox First-Party User Authentication (production auth for the platform)
3. UX-IA-04 through UX-IA-14 — Workspace / project-mode redesign continues
4. UX-IA-15 through UX-IA-17 — Visual Edit Mode (requires stable preview tab)
5. AUTH-MODULE-01 — Reusable generated app-auth module (later product capability)

AUTH-APP-01 and AUTH-MODULE-01 are separate task families. They are roadmap entries in this document but must be registered in `TASKS.md` / `TASKS_BACKLOG_FULL.md` under their own family headings before implementation begins.

---

## 11. Recommended First Implementation Slice

**Start with: UX-IA-01 — i18n Foundation & Locale Middleware**

Rationale:

1. **Multilingual is mandatory.** Every subsequent phase creates user-facing text. If i18n infrastructure is not ready first, each phase will either hardcode English (creating migration debt) or block waiting for i18n.
2. **Unblocks all later UI.** With complete translation keys defined, every subsequent phase simply uses `t('key')` instead of hardcoded strings.
3. **Lowest visual risk.** No layout or component changes — purely infrastructure (middleware file, JSON expansion, hook enhancement).
4. **Prevents hardcoded text from spreading.** Starting any visual work before i18n is ready guarantees more hardcoded strings to migrate later.
5. **Preserves all existing work.** No changes to `workspace-shell.tsx`, `page.tsx`, or any AI-WS code.
6. **Quick to verify.** Run existing tests + manual check that login still uses translated strings and new namespace keys resolve correctly.

**Second slice**: UX-IA-02 (Design Token Foundation) — gives every subsequent visual phase a consistent palette without touching application logic.

These two infrastructure slices together establish the foundation that makes all subsequent phases cleanly implementable without backtracking.

---

## Locked User Decisions (Reference)

1. Workspace and project pages share the same `/[locale]/app` route for v1. Opening a project transforms the workspace into project mode.
2. Public page chatbox before login requires create account or login immediately.
3. Projects and Templates/Community are separate views inside the workspace right panel, not separate full pages.
4. Project page tabs always exist, but settings control which are pinned/visible or hidden.
5. Launch languages: English, Traditional Chinese, Simplified Chinese. Easy to add more.
6. Project mode left panel contains AI chat + history icon. History icon shows project history timeline with restore capability.
7. Workspace Home shows the same "Build anything" experience.
8. Recent projects open directly into project mode.

---

## 12. Future Capability: Visual Edit Mode

**Added:** 2026-05-06

### Overview

Visual Edit Mode allows users to make UX/UI changes directly from the preview surface. The user clicks or selects an element in the preview iframe and asks the AI to change that visual element. The AI uses the existing file-action system to propose and apply source changes. The preview refreshes after a successful apply.

This is **not part of UX-IA-01 through UX-IA-14**. It is a later capability requiring a stable project mode preview surface first.

---

### Level A — Visual Edit Foundation (UX-IA-15)

- Preview tab gains an element picker toggle in its toolbar
- When active, a selection overlay is injected into the preview iframe via `postMessage`
- Clicking an element in the preview captures DOM metadata: CSS selector, text content, bounding box, applied classes
- Captured metadata is surfaced as structured context appended to the AI chat prompt
- AI uses the existing AI-WS file-action system to propose source changes
- File-action confirmation rules are preserved — no bypass
- Preview refreshes automatically after a confirmed file action

---

### Level B — Advanced Visual Editor (UX-IA-16 + UX-IA-17)

- Inline text editing directly in the preview (UX-IA-16)
- Structured diff preview and confirmation before applying visual patches (UX-IA-16)
- Named checkpoint created automatically on every visual edit apply (UX-IA-17)
- Undo button in Preview tab toolbar triggers existing restore flow (UX-IA-17)
- History timeline labels visual edit checkpoints (UX-IA-17)

Future (beyond current roadmap, not yet scheduled):
- Drag/resize/reposition elements
- Style controls panel
- Component/file ownership inference
- Real-time preview patching without full refresh
- Better DOM-to-source mapping (treat as hard; defer until foundation proves viable)

---

### Design Constraints / Invariants for All Phases

These constraints apply from UX-IA-04 onward to all phases that touch the Preview tab or project mode layout:

1. **Preview tab iframe must remain capable of supporting an overlay and selection events.** Do not wrap the iframe in a way that blocks pointer events or prevents injection of a selection overlay script.
2. **Cross-frame postMessage communication must not be blocked.** Preview tab structure must not prevent `window.postMessage` / `message` event listener patterns between the app and the preview iframe.
3. **AI-WS file-action confirmation and checkpoint safety remain the only source-change mechanism.** Visual edit must not introduce a bypass path for file writes that skips the existing confirmation flow.
4. **Visual edit must not bypass existing file action safety rules.** Risky file actions proposed by visual edit must follow the same classification and approval logic as AI chat file actions.
5. **Direct manipulation must be introduced gradually.** Start with element selection + AI prompt (UX-IA-15), not full drag/drop/resize editing. DOM-to-source mapping is hard and is explicitly deferred to advanced phases.
6. **Existing project history/checkpoint system is the undo mechanism.** Do not introduce a parallel undo stack. Reuse `onCreateWorkspaceSnapshot` and `onRestoreWorkspaceProjectFromSnapshotById`.

---

### Dependency Ordering

Visual Edit Mode must come after:
- **UX-IA-08** — Project Mode Shell (preview must exist as a stable tab)
- **UX-IA-10** — Preview + Code & Files Tabs (preview tab must be fully wired and sized correctly)

Visual Edit phases must not be started until UX-IA-08 and UX-IA-10 are both COMPLETE and LOCKED.

---

## Invariants

- No implementation should start from this document alone.
- Each phase must be registered as a task in `TASKS.md` / `TASKS_BACKLOG_FULL.md` before work begins.
- All completed AI-WS work and hotfixes remain COMPLETE and LOCKED.
- All prior checkpoint invariants remain intact.
- This document does not modify the PRD or ARCHITECTURE — those are updated separately if scope changes require it.
- Preview tab structure from UX-IA-10 onward must preserve the ability to add a selection overlay and cross-frame postMessage communication (Visual Edit Mode constraint — see Section 12).
