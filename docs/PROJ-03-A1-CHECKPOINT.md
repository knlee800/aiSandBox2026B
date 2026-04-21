# PROJ-03-A1 CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-A1
- Title: Add Project-First Top-Level Routes And Labels Behind Feature Flag
- Nature: FRONTEND ARCHITECTURE / PHASE A IA SHELL
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-A1-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase A / Slice A.1
- Depends on: PROJ-03-A0 (COMPLETE and LOCKED)

## Objective

Stand up the project-first information architecture (Home, Projects, Workspace, Gallery, Account) as a thin route/nav shell behind `PROJECT_FIRST_UX`, wrapping existing functionality with no behavior change when the flag is off.

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/projects/page.tsx` | New. Thin route page. |
| `frontend/app/[locale]/gallery/page.tsx` | New. Thin route page. |
| `frontend/app/[locale]/account/page.tsx` | New. Thin route page. |
| `frontend/app/[locale]/app/page.tsx` | Added `locale={locale}` prop to `WorkspaceShell` call. |
| `frontend/components/workspace/workspace-shell.tsx` | Added optional `locale` and `projectFirstUxEnabled` props; flag-gated header branch. |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added explicit defaults for new props in test helper; added flag-on header rendering test. |

No other source files were modified. No backend files were touched.

## Locked Scope Actually Implemented

This is IA / route-surface / labeling work only.

- Three thin top-level route pages added behind `PROJECT_FIRST_UX`.
- Header label/nav changed under `PROJECT_FIRST_UX` only.
- All sidebar/panel/runtime behavior unchanged.
- No New/Open runtime behavior changed.
- Sessions UI was not demoted, removed, or relocated — sessions sidebar, "New Session" button, Stop/Remove buttons all remain exactly as today under both flag states.
- No A2 session demotion work was performed.
- No A3 lifecycle-copy replacement work was performed.

## New Thin Routes

### `/[locale]/projects`

```tsx
if (!PROJECT_FIRST_UX) {
  redirect(`/${locale}/app`);
}
return <AppPage />;
```

- Flag off: redirects to the existing `/[locale]/app` workspace. Users arriving at the new URL get the same surface as today.
- Flag on: renders the existing `AppPage` component directly under the new route. No new functionality.

### `/[locale]/gallery`

```tsx
if (!PROJECT_FIRST_UX) {
  redirect(`/${locale}/share`);
}
return <PublicShareBrowsePage />;
```

- Flag off: redirects to the existing `/[locale]/share` public project browse.
- Flag on: renders the existing `PublicShareBrowsePage` component. No new functionality.

### `/[locale]/account`

```tsx
if (!PROJECT_FIRST_UX) {
  redirect(`/${locale}/keys`);
}
return <ApiKeysPage />;
```

- Flag off: redirects to the existing `/[locale]/keys` API key management page.
- Flag on: renders the existing `ApiKeysPage` component. No new functionality.

## Workspace Shell Header Branch

### Flag off (unchanged — identical to pre-A1)

- Title: `"AI Sandbox Workspace"`
- Sub-label: `"Session-scoped workspace"`
- Right-side link: `"API Keys"` → `href="keys"` with existing `data-testid="workspace-header-api-keys-link"`

### Flag on (project-first wording + nav)

- Title: `"AI Sandbox"`, sub-label: `"Workspace"`
- Top-right nav (hidden on small screens): `Projects` / `Gallery` / `Account` links
- Nav links use locale-correct absolute hrefs: `/${locale}/projects`, `/${locale}/gallery`, `/${locale}/account`
- `data-testid="workspace-header-project-first-nav"` on the `<nav>` element
- Sub-label: `"Project-first workspace shell"`
- `"API Keys"` link and `"Session-scoped workspace"` text are absent when flag is on

### Why absolute locale-correct hrefs

The existing workspace shell already uses a relative `href="keys"` link. For the new project-first nav, locale-correct absolute paths (`/${locale}/projects` etc.) were used instead of relative paths to avoid an incorrect resolution when the workspace is nested under `/[locale]/app`. The `locale` value is threaded from `page.tsx` via the new optional `locale` prop.

## locale Prop Threading in page.tsx

`page.tsx` already held `const locale = params.locale as string` from `useParams()`. The single change added `locale={locale}` to the `WorkspaceShell` call so the shell can build correct absolute nav hrefs under the flag-on path. No other prop or behavior in `page.tsx` changed.

## Test Seam for Flag-on Coverage

`WorkspaceShell` received two new optional props:

```tsx
locale?: string;          // defaults to 'en' if not provided
projectFirstUxEnabled?: boolean;  // defaults to PROJECT_FIRST_UX if not provided
```

This allows tests to pass `projectFirstUxEnabled: true` directly without requiring a build-time env var change or mocking `process.env`. The production rendering path defaults `projectFirstUxEnabled` to the real `PROJECT_FIRST_UX` constant, so the flag semantics are unchanged in production.

### New test: `renders project-first header nav behind feature flag`

Exercises `projectFirstUxEnabled: true` with `locale: 'zh-TW'` and asserts:
- `data-testid="workspace-header-project-first-nav"` present
- all three nav link `data-testid` values present
- locale-correct hrefs: `/zh-TW/projects`, `/zh-TW/gallery`, `/zh-TW/account`
- link labels `Projects`, `Gallery`, `Account` present
- `"Session-scoped workspace"` absent
- `workspace-header-api-keys-link` absent

Existing tests continue to use `projectFirstUxEnabled: false` (the new explicit default in `renderWorkspaceShell`) and pass without change.

## Validation

### 1. Type-check

Command:

```
cd frontend
npx tsc --noEmit -p tsconfig.json
```

First attempt (before build): failed because this frontend `tsconfig.json` includes `.next/types/**/*.ts` and those generated type files did not exist yet. This is a pre-existing tsconfig setup: running `tsc` on a clean checkout before a build will always fail this way. Not a code error introduced by A1.

After `npm run build`: **PASS** — clean exit, no type errors.

### 2. Focused workspace-shell test suite

Command:

```
cd frontend
npx tsx --test components/workspace/workspace-shell.logic.test.ts components/workspace/workspace-shell.test.tsx
```

Result: **88/88 tests pass** (21 logic + 64 component + 3 snapshot surface). Includes new flag-on header/nav test. No regressions.

### 3. Production build — flag off (default)

Command:

```
cd frontend
npm run build
```

Result: **PASS** — `✓ Compiled successfully`. New routes present in the route table:

```
├ ƒ /[locale]/account   163 B     107 kB
├ ƒ /[locale]/gallery   1.53 kB   106 kB
├ ƒ /[locale]/projects  159 B     141 kB
```

### 4. Production build — flag on

Command:

```
cd frontend
NEXT_PUBLIC_PROJECT_FIRST_UX=true npm run build
```

Result: **PASS** — same route table, project-first header renders correctly with locale-correct nav links.

### 5. Lint

Attempted:

```
cd frontend
npm run lint -- --file app/[locale]/app/page.tsx --file app/[locale]/projects/page.tsx ...
```

Same known pre-existing `next lint` script-path issue: `Couldn't find any pages or app directory`. Not caused by A1.

Follow-up lint check via `ReadLints` on all six touched source files: **no linter errors found**.

## Invariants Preserved

| Invariant | Status |
|---|---|
| `PROJECT_FIRST_UX` remains the kill switch | ✅ Flag off in all three routes triggers `redirect()` to current equivalents |
| Flag off preserves current behavior | ✅ All existing routes unmodified; shell renders today's exact header |
| No regression to project-open hydration (PROJ-02-01) | ✅ No changes to `handleOpenWorkspaceProject` or any hydration path |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ No backend or Docker volume changes |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ No snapshot or restore logic touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ No preview service changes |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ No session stop path or HTTP client changes |
| Sessions UI not demoted or removed | ✅ Sessions sidebar, New Session button, Stop/Remove remain on primary surface under both flag states |
| No A2 session demotion work | ✅ Not implemented |
| No A3 lifecycle-copy replacement work | ✅ Not implemented |
