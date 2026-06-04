# UX-IA-39 Checkpoint — Build Targets Content-Panel Tab + Side-Tab Rail Fix

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-39 |
| Title | Relocate Build Targets to Preview Panel (revised: first-class content-panel tab) |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Status | COMPLETE and LOCKED |
| Depends on | UX-IA-38 (COMPLETE and LOCKED — `docs/UX-IA-38-CHECKPOINT.md`) |
| Checkpoint created | 2026-06-04 |

---

## Final Implementation Summary

### Build Targets — first-class content-panel tab

- `buildTargets` added to `TAB_REGISTRY` (order 2, between `codeFiles` and `database`).
- Clicking the Build Targets tab switches the right content panel to a dedicated `build-targets-panel-shell` container.
- `WorkspaceBuildPanel` renders inside `build-targets-panel-shell` when the Build Targets tab is active.
- `workspace-project-content-panel` tab switching is exclusive: only one of `preview-panel-shell`, `editor-panel-shell` (codeFiles), `build-targets-panel-shell`, or `workspace-tab-placeholder` is rendered at a time.
- All existing build `data-testid` values preserved:
  - `workspace-build-panel`
  - `workspace-build-target-selector`
  - `workspace-build-trigger`
  - `workspace-build-status`
  - `workspace-build-error`
  - `workspace-build-output`

### Rollback of incorrect Preview-header slot approach

The initial implementation placed `WorkspaceBuildPanel` inside the `WorkspacePreviewPanel` header via a `buildControls` slot prop. This was incorrect UX. It was fully removed:

- `projectBuildControls` JSX variable removed.
- `buildControls={projectBuildControls}` removed from both `WorkspacePreviewPanel` call sites.
- `buildControls?: React.ReactNode` prop removed from `WorkspacePreviewPanel`.
- `{props.buildControls ? ... }` render slot removed from `WorkspacePreviewPanel` header.
- `flex-wrap` classes on preview header reverted back to `flex`.
- `WorkspacePreviewPanel` is no longer coupled to Build Targets.

### Side-tab rail layout fix

Previous bug: when vertical side-tab mode was ON, tabs became vertical but remained stacked above the content panel (parent was always `flex-col`).

Fix: `workspace-project-content-panel` (`<main>`) now conditionally switches layout:
- Horizontal mode: `flex flex-col`
- Vertical mode: `flex flex-row`

`workspace-tab-content` gained `min-w-0` to prevent width overflow as a flex-row sibling.

### Vertical tab icons

When `tabOrientation === 'vertical'`, each tab button renders an icon-only layout (`h-5 w-5`) with `title={tab.label}` for accessibility. Horizontal tabs keep their text labels.

Icons used (all from `@heroicons/react/24/outline`, Heroicons v2):

| Tab | Icon |
|---|---|
| preview | `EyeIcon` |
| codeFiles | `CodeBracketIcon` |
| buildTargets | `WrenchScrewdriverIcon` |
| database | `CircleStackIcon` |
| auth | `KeyIcon` |
| security | `ShieldExclamationIcon` |
| analytics | `ChartBarIcon` |
| envVars | `AdjustmentsHorizontalIcon` |
| publishing | `CloudArrowUpIcon` |
| deploy | `RocketLaunchIcon` |
| payment | `CreditCardIcon` |
| domain | `GlobeAltIcon` |
| appStorage | `ArchiveBoxIcon` |
| agentSkills | `CpuChipIcon` |

Icon map is a static `TAB_ICONS` const inside `workspace-tab-bar.tsx`, not exported, not in the registry. `WorkspaceTabBarTab` interface and `resolveTabBarTabs()` were not changed.

---

## i18n Key Added

| Locale file | Key | Value |
|---|---|---|
| `frontend/messages/en.json` | `tabs.buildTargets` | `"Build Targets"` |
| `frontend/messages/zh-TW.json` | `tabs.buildTargets` | `"建構目標"` |
| `frontend/messages/zh-CN.json` | `tabs.buildTargets` | `"构建目标"` |

No other i18n keys were added or modified. No hardcoded English visible text introduced.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-tab-registry.ts` | Added `buildTargets` entry (order 2) |
| `frontend/components/workspace/workspace-shell.tsx` | Removed `projectBuildToolbar`, removed `buildControls` slot, added `buildTargets` tab branch, fixed `workspace-project-content-panel` flex direction, added `min-w-0` to `workspace-tab-content` |
| `frontend/components/workspace/workspace-tab-bar.tsx` | Added Heroicons imports, added `TAB_ICONS` map, added icon-only rendering in vertical mode, added `title` to tab buttons |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added/updated tests (see Tests section below) |
| `frontend/messages/en.json` | Added `tabs.buildTargets` |
| `frontend/messages/zh-TW.json` | Added `tabs.buildTargets` |
| `frontend/messages/zh-CN.json` | Added `tabs.buildTargets` |

---

## Tests Updated

All in `frontend/components/workspace/workspace-shell.test.tsx`:

- Build Targets tab button renders in tab bar (`workspace-tab-buildTargets`).
- Build Targets tab renders `build-targets-panel-shell` when active.
- `workspace-build-panel` renders inside `build-targets-panel-shell`.
- `preview-panel-shell` does not render when Build Targets tab is active.
- Preview tab does not render `build-targets-panel-shell` or `workspace-build-panel`.
- Build Targets is not a full-width toolbar after project header.
- Build Targets is not inside chat panel / `chat-panel-shell`.
- Legacy non-project-first path does not render `workspace-build-panel`.
- Build status/error/output tests use `renderWorkspaceShellWithForcedActiveTab('buildTargets')`.
- `tabs.buildTargets` i18n key coverage for en / zh-TW / zh-CN.
- Source assertion confirms `buildControls` slot wiring was fully removed.
- Vertical tab orientation applies `flex-row` to `workspace-project-content-panel`.
- Horizontal tab orientation keeps `flex-col` on `workspace-project-content-panel`.
- Vertical tab mode renders icon-only buttons with `h-5 w-5`.

---

## Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 585 tests, 585 pass, 0 fail |
| `ReadLints` on touched files | PASS — no linter errors |
| `frontend/tsconfig.tsbuildinfo` | Restored via `git restore` |
| Live browser test | PASS |

---

## Non-Goals Confirmed

- No backend changes.
- No sidebar changes.
- No Command Input changes.
- No Chat/History panel changes.
- No route/entity/model changes.
- No new npm dependencies (Heroicons was already declared `^2.2.0`).
- No broad Preview panel redesign.
- No build behavior redesign.

---

## Next Recommended Step

Register and implement `UX-PV-01 — Preview Auto-Start and First-Load Error Resilience`.

Root cause investigation complete (see prior session). Implementation prompt is ready.
