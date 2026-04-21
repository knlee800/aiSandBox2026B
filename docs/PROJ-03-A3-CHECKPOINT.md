# PROJ-03-A3 CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-A3
- Title: Replace Raw Session Lifecycle Strings With Recovery Vocabulary
- Nature: FRONTEND UX / PHASE A COPY CLEANUP
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-A3-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase A / Slice A.3
- Depends on: PROJ-03-A0 (COMPLETE and LOCKED), PROJ-03-A1 (COMPLETE and LOCKED)

## Objective

Replace all user-visible raw session/runtime lifecycle strings in the main workspace surfaces with the recovery vocabulary from the PROJ-03-A0 copy bundle when `PROJECT_FIRST_UX` is enabled, and surface a safe "Reopen project" primary action on disconnected exec states that reuses the existing project-open flow.

## Scope Statement

This is **wording and presentation cleanup only**. No session lifecycle logic, open/stop/restore/preview, or cleanup behavior was changed. The sessions sidebar and session-list controls were not modified. A2 session demotion was not implemented. No New/Open runtime behavior changed. No backend, auth, schema, or operator console changes were made.

## Files Changed

| File | Change |
|---|---|
| `frontend/lib/recovery-copy.ts` | Extended. New `workspace` namespace added with 22 string keys for panel/status helper copy. |
| `frontend/components/workspace/workspace-shell.tsx` | Modified. Flag-gated wording changes across main-panel surfaces; `projectFirstUxEnabled` threaded to affected subcomponents; optional `primaryAction*` props added to `StateMessage`; safe `Reopen project` button for exec 404/410 and shell error states. |
| `frontend/components/workspace/workspace-shell.test.tsx` | Modified. Two new flag-on tests added; all 66 existing tests pass unchanged. |

## recovery-copy.ts Extension

The `workspace` namespace was added to centralize all new A3 strings rather than scattering literals across `workspace-shell.tsx`. This keeps the copy auditable as a single source of truth and makes it straightforward to adjust wording without hunting through component code.

Keys added (22 total):

```
trustNote, loading, unavailable, openProjectToStart, ready, help,
chatReady, openProjectToSendPrompts, buildReady, openProjectToRunBuild,
filesLoading, noFilesAvailable, filesReady,
previewLoading, previewReady, previewUnavailable, previewError,
openProjectToCreateSavePoint, openProjectToCompareHistory,
openProjectToInspectDiffs, openProjectToInspectSnapshots,
openProjectToOpenLiveFile, openProjectToEnableRevert,
openOrReopenProject
```

## Surfaces Updated in workspace-shell.tsx (flag-on only)

| Surface | Flag-off (preserved exactly) | Flag-on (new wording) |
|---|---|---|
| Trust note | "Workspace data is session-scoped. If a state fails, use the suggested retry action below." | `recoveryCopy.workspace.trustNote` |
| Shell state — loading | "Loading sessions and preparing baseline workspace panels." | `recoveryCopy.workspace.loading` |
| Shell state — error | "Session load error: …" / "Unable to load sessions …" | "Workspace load error: …" / `recoveryCopy.workspace.unavailable` |
| Shell state — empty heading | "No session selected" | "No project open" |
| Shell state — empty body/action | "Create or select a session …" / "Use New Session in the sidebar." | `recoveryCopy.workspace.openProjectToStart` / `recoveryCopy.workspace.help` |
| Shell state — ready body/action | "Shell ready. Full panel behavior…" | `recoveryCopy.workspace.ready` / "Continue with project work and history review." |
| Chat hint (no session) | "Select an active session to send prompts." | `recoveryCopy.workspace.openProjectToSendPrompts` |
| Chat hint (session present) | "Prompt runs through the existing AI execution flow." | `recoveryCopy.workspace.chatReady` |
| Build hint (no session) | "Select an active session to run a build target." | `recoveryCopy.workspace.openProjectToRunBuild` |
| Build hint (session present) | "Build runs through the existing session exec path." | `recoveryCopy.workspace.buildReady` |
| Exec idle body | "Submit a command for the selected active session." | "Run commands inside the current workspace." |
| Exec sending body | "Sending command to session exec endpoint." | "Sending command to the current workspace." |
| Exec 404 heading/body/action | "Session not found (404)" / "The selected session is no longer available." / … | `recoveryCopy.status.workspaceDisconnected` / `recoveryCopy.detail.workspaceExpired` / `recoveryCopy.detail.reconnectByReopening` |
| Exec 410 heading/body/action | "Session terminated (410)" / "This session is terminated …" / … | same recovery vocabulary as 404 above |
| Editor loading body | "Loading workspace files for the active session." | `recoveryCopy.workspace.filesLoading` |
| Editor empty body/action | "No files were found for the active session workspace." / "Run a command…" | `recoveryCopy.workspace.noFilesAvailable` / `recoveryCopy.workspace.openOrReopenProject` |
| Editor error action | "Select the session again to retry." | `recoveryCopy.workspace.openOrReopenProject` |
| Editor ready body | "Workspace file navigation is ready for this active session." | `recoveryCopy.workspace.filesReady` |
| Preview loading body | "Checking and loading the active session preview." | `recoveryCopy.workspace.previewLoading` |
| Preview ready body | "The active session preview is rendering." | `recoveryCopy.workspace.previewReady` |
| Preview unavailable body | "No running preview is available for this active session yet." | `recoveryCopy.workspace.previewUnavailable` |
| Preview error body | "The preview failed to load for this active session." | `recoveryCopy.workspace.previewError` |
| Save point idle body/action (no session) | "Select an active session to create a save point." | `recoveryCopy.workspace.openProjectToCreateSavePoint` |
| Save point idle body (session present) | "Create a manual checkpoint for the active session." | "Create a manual save point for the current workspace." |
| Save point creating body | "Checkpoint creation request is in flight for the active session." | "Save point request is in flight for the current workspace." |
| Save point created action | "History list is refreshed for this session." | "History list is refreshed for this workspace." |
| Save point failed action | "Retry Save Point for the active session." | "Retry Save Point for the current workspace." |
| Compare idle (no session) | "Select an active session before entering compare mode." | `recoveryCopy.workspace.openProjectToCompareHistory` |
| Diff idle (no session) | "Select an active session to inspect checkpoint diffs." | `recoveryCopy.workspace.openProjectToInspectDiffs` |
| Snapshot idle (no session) | "Select an active session to inspect checkpoint snapshots." | `recoveryCopy.workspace.openProjectToInspectSnapshots` |
| Open-in-live idle (no session) | "Select an active session to jump from history file items to live workspace files." | `recoveryCopy.workspace.openProjectToOpenLiveFile` |
| Revert idle (no session) | "Select an active session to enable checkpoint revert." | `recoveryCopy.workspace.openProjectToEnableRevert` |
| Footer session count | "Sessions: N" | "Workspaces: N" |

## Reopen Project Primary Action

An optional "Reopen project" button was added to `StateMessage` via three new optional props: `primaryActionLabel`, `onPrimaryAction`, `primaryActionTestId`. The button renders only when both label and handler are provided.

The button is wired on exec 404, exec 410, and shell error states when **all** of the following conditions are met:
- `projectFirstUxEnabled` is `true`
- `props.selectedProjectId` is present (a project is already selected)
- `props.onOpenWorkspaceProject` is present (the callback already exists from `page.tsx`)

The handler calls the pre-existing `props.onOpenWorkspaceProject()` — the same callback already wired through PROJ-02-01's deterministic hydration path. No new logic path was invented.

`data-testid` values: `workspace-exec-reopen-project` (exec panel), `workspace-shell-reopen-project` (shell state).

## Minimal Prop/Wiring Changes

`projectFirstUxEnabled` was threaded as a required `boolean` prop to these subcomponents (all internal to `workspace-shell.tsx`):
`WorkspaceChatPanel`, `WorkspaceBuildPanel`, `WorkspaceExecPanel`, `WorkspacePreviewPanel`, `WorkspaceEditorPanel`, `EditorStateMessage`, `ExecStateMessage`, `PreviewStateMessage`, `HistoryCreateCheckpointPanel`, `HistoryCreateStateMessage`, `HistoryCheckpointList`, `HistoryCompareStateMessage`, `HistoryDiffStateMessage`, `HistorySnapshotStateMessage`, `HistoryOpenLiveStateMessage`, `HistoryRevertStateMessage`, `ShellStateMessage`.

`canReopenProject` and `onReopenProject` were threaded to `WorkspaceExecPanel`, `ExecStateMessage`, and `ShellStateMessage` only — the three surfaces where the optional reopen action can appear.

No public-interface change to `WorkspaceShellProps` was required beyond what already existed (`selectedProjectId` and `onOpenWorkspaceProject` were already present from prior slices).

## Test Coverage

Two new flag-on tests added to `workspace-shell.test.tsx`:

**`renders project-first recovery wording in main helper surfaces`**
- Verifies: trust note, chat/build/shell-state empty wording, editor ready, preview unavailable, save point idle, footer count
- Verifies: flag-off strings absent when flag is on

**`renders reopen project action for disconnected exec state behind feature flag`**
- Renders with `execState: { status: 'http-410' }`, `selectedProjectId: 'project-1'`, `onOpenWorkspaceProject` callback
- Asserts: `Workspace disconnected`, recovery detail text, `workspace-exec-reopen-project` data-testid, `>Reopen project<`
- Asserts: "Session terminated (410)" and original body absent

All 66 prior tests pass unchanged (flag-off behavior verified implicitly by existing assertions).

## Validation

### 1. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no errors.

### 2. Component tests

```
frontend $ npx tsx --test components/workspace/workspace-shell.test.tsx
```

Result: **PASS** — 69 tests / 2 suites, 0 failures. Includes both new A3 flag-on tests and all prior 66 tests.

### 3. Targeted lint attempt

```
frontend $ npm run lint -- --file components/workspace/workspace-shell.tsx ...
```

Result: Known repo issue — `next lint` throws `Couldn't find any pages or app directory` when run from the workspace root (same issue documented in PROJ-03-A0 and PROJ-03-A1 checkpoints; not introduced by A3).

### 4. File-level lint check

`ReadLints` run on:
- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/components/workspace/workspace-shell.test.tsx`
- `frontend/lib/recovery-copy.ts`

Result: **No linter errors found.**

## Preserved Invariants

| Invariant | Status |
|---|---|
| `PROJECT_FIRST_UX` is a kill-switch to today's behavior | ✅ Flag off: every string site returns the original literal unchanged |
| No regression to project-open hydration discipline (PROJ-02-01) | ✅ `onOpenWorkspaceProject` is called, not replaced; no hydration logic touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| Sessions sidebar / session-list controls untouched (A2 not implemented) | ✅ Sidebar JSX unchanged |
| No New/Open runtime behavior change | ✅ No handler logic modified |
| No backend, auth, schema, or operator console changes | ✅ Frontend only |
