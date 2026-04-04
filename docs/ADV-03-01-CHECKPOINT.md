# Checkpoint: ADV-03-01 — Mobile / Mac / iOS Build Support

## 1. Task Metadata

| Field | Value |
|-------|-------|
| **Task ID** | ADV-03-01 |
| **Title** | Mobile / Mac / iOS Build Support |
| **Family** | ADV-01 (Advanced Product Expansion) |
| **Status** | COMPLETE and LOCKED |
| **Nature** | IMPLEMENTATION (ADVANCED PRODUCT, CROSS-PLATFORM BUILD SUPPORT) |
| **Checkpoint file** | `docs/ADV-03-01-CHECKPOINT.md` |
| **Spec** | `docs/specs/ADV-03-01-mobile-mac-ios-build.md` |
| **Dependencies** | ADV-02-01 (Complete and Locked) |

---

## 2. Objective Completed

Implemented the first bounded cross-platform build support slice: a minimal build-target selector and trigger panel was added to the existing workspace Chat Panel section. Three bounded targets (Mobile, Mac, iOS) are exposed. Build execution flows through the existing session exec path (`POST /api/sessions/:id/exec`) so all session-scoped, request-driven, auth, and quota semantics are preserved without modification. Build progress, output, and error states are surfaced in the existing workspace UI. Clear bounded error messages distinguish unavailable toolchains from build failures. No device cloud, device farm, app-store submission, CI/CD platform, or autonomous orchestration was introduced.

---

## 3. Exact Files Changed

### Frontend

- `frontend/components/workspace/workspace-build-targets.logic.ts` (new)
  - `WORKSPACE_BUILD_TARGET_OPTIONS` — bounded explicit list of 3 targets: `mobile` (npm build:mobile script), `mac` (xcodebuild availability probe), `ios` (xcodebuild availability probe)
  - `resolveWorkspaceBuildCommand(target)` — maps a target value to its bounded command; falls back to first option for unknown input
  - `detectBuildToolchainUnavailable(input)` — pure helper; detects when exit code indicates toolchain/agent is absent (exit 127, "toolchain unavailable", "xcodebuild: not found", "command not found" patterns)
  - Types: `WorkspaceBuildTarget`

- `frontend/components/workspace/workspace-build-targets.logic.test.ts` (new)
  - 3 focused tests: explicit target resolution to bounded commands; fallback for unknown input; toolchain-unavailable detection

- `frontend/components/workspace/workspace-shell.tsx`
  - Added `selectedBuildTarget`, `onSelectedBuildTargetChange`, `availableBuildTargets`, `onRunBuildTarget`, `buildRequestState`, `buildStatusMessage`, `buildOutput`, `buildError` optional props to `WorkspaceShellProps`
  - Added new `WorkspaceBuildPanel` component: bounded `<select>` for target (`data-testid: workspace-build-target-selector`), Run Build button (`data-testid: workspace-build-trigger`, disabled while submitting or no session), status message, error message, and scrollable output `<pre>` (`data-testid: workspace-build-output`)
  - Rendered `WorkspaceBuildPanel` in the Chat Panel section below the existing `WorkspaceExecPanel`, additive only

- `frontend/components/workspace/workspace-shell.test.tsx`
  - Added `selectedBuildTarget`, `onSelectedBuildTargetChange`, `availableBuildTargets`, `onRunBuildTarget`, `buildRequestState`, `buildStatusMessage`, `buildOutput`, `buildError` to `renderWorkspaceShell` default props
  - Added assertion that "Build Targets (ADV-03-01)", "Build Target", and "Run Build" render in main layout test
  - Added test: renders build output and status in bounded build panel (`completed` state)
  - Added test: renders bounded build failure message (`failed` state with toolchain-unavailable error)

- `frontend/app/[locale]/app/page.tsx`
  - Added import for `detectBuildToolchainUnavailable`, `resolveWorkspaceBuildCommand`, `WORKSPACE_BUILD_TARGET_OPTIONS`, `WorkspaceBuildTarget`
  - Added `selectedBuildTarget` state (default `'mobile'`), `buildRequestState`, `buildStatusMessage`, `buildOutput`, `buildError` states
  - Added `handleRunBuildTarget()` function:
    - Guards: auth token, selected session, terminated-session check
    - Resolves target command via `resolveWorkspaceBuildCommand`
    - Sets `buildRequestState: 'submitting'` and status message
    - Calls `executeSessionCommand` (existing function) — no new exec path invented
    - On non-result exec state: sets `buildRequestState: 'failed'`, surfaces `errorMessage`
    - On result with exit code 0: sets `buildRequestState: 'completed'`, refreshes file tree and dashboard
    - On result with non-zero exit: calls `detectBuildToolchainUnavailable` — shows bounded toolchain-unavailable message or bounded build-failure message, refreshes dashboard
  - Session-switch `useEffect`: resets all build state to idle/empty on session change
  - Wired `selectedBuildTarget`, `availableBuildTargets`, `onRunBuildTarget`, `buildRequestState`, `buildStatusMessage`, `buildOutput`, `buildError` to `WorkspaceShell`
  - `onSelectedBuildTargetChange` resolves via `resolveWorkspaceBuildCommand` before setting state

---

## 4. Tests Run and Results

| Suite / Command | Result | Details |
|---|---|---|
| `frontend`: `npm test -- workspace-build-targets.logic.test.ts workspace-shell.test.tsx workspace-exec.logic.test.ts` | **PASS** | 21 suites, 152 tests |
| `frontend`: `npx tsc --noEmit` | **PASS** | No type errors |
| `services/api-gateway`: `npm test -- src/ai/__tests__/ai-execution.provider-selection.spec.ts src/ai/__tests__/ai-execution.get-execution-file-actions.spec.ts` | **PASS** | 2 suites, 4 tests |
| `services/api-gateway`: `npm run build` | **PASS** | TypeScript compilation clean |
| Changed-file lints (ReadLints on all touched files) | **PASS** | No linter errors |

`frontend/tsconfig.tsbuildinfo` was incidentally modified by the `npx tsc --noEmit` validation run; it was reverted via `git checkout -- frontend/tsconfig.tsbuildinfo` and is not part of this task diff.

---

## 5. Migration

**No migration was required.** No new database entities, schema changes, backend API changes, or backend files were introduced. Build execution routes entirely through the existing `POST /api/sessions/:id/exec` endpoint. All state is frontend-only and session-scoped in React state.

---

## 6. Scope Adherence

**Scope stayed fully within ADV-03-01.** Only the bounded build-target selector/trigger/status slice was implemented:

- No full device cloud introduced
- No remote device farm introduced
- No app-store submission workflow introduced
- No broad CI/CD platform introduced
- No autonomous orchestration introduced
- No billing/quota redesign
- No broad workspace redesign
- No background workers introduced
- No refactors beyond the minimum required to wire the build panel and handler
- No new database entities or backend endpoints

---

## 7. Preserved Behaviors

- **Web-focused workspace remains primary/default experience**: The existing Chat Panel, Exec Panel, Editor, Preview, and History surfaces are unchanged. The build panel is added additively below the Exec Panel in the Chat section; it does not replace or modify any existing surface.
- **Session lifecycle and container isolation preserved**: Build execution uses `executeSessionCommand` with the same session ID and JWT flow as the existing exec panel. Terminated-session guard prevents build submission on a terminated session. No new session lifecycle paths introduced.
- **File system operations, preview architecture, editor/file tree/preview surfaces preserved**: On successful build, `loadWorkspaceFilesForSession` is called via the existing path. No changes to file tree, editor, or preview logic.
- **AI execution pipeline, chat panel, orchestration, and model attribution behavior preserved**: No changes to AI execution, chat thread, orchestration, or attribution code paths.
- **JWT auth, quota enforcement, token-usage tracking preserved**: All build exec requests use the existing `Authorization: Bearer ${token}` header and go through the unchanged `POST /api/sessions/:id/exec` endpoint with its existing auth/quota enforcement.
- **All project/snapshot/checkpoint/revert behavior preserved**: No changes to checkpoint, snapshot, revert, or project logic.
- **CO-01/02/03 quota/plan/admin surfaces preserved**: No changes to quota, plan, or admin controllers/services/UI.
- **Request-driven behavior preserved**: `handleRunBuildTarget` is an async function called only on explicit user button click. No timers, watchers, or background workers introduced.
- **No background workers introduced**: Build execution is a single synchronous-awaiting request-response via `executeSessionCommand`, which itself is a single `fetch` call to the existing exec endpoint.

---

## 8. Delivered Capability

- **Bounded build-target selector/trigger added on existing workspace surface**: A `WorkspaceBuildPanel` (`data-testid: workspace-build-panel`) appears in the Chat Panel section below the Exec Panel. It exposes a bounded `<select>` with three explicit targets: Mobile (generic), Mac (xcodebuild), iOS (xcodebuild). A "Run Build" button (`data-testid: workspace-build-trigger`) triggers the build. The selector and button are disabled when no session is selected or a build is in progress.
- **Build target flows remain session-scoped and request-driven**: Each target maps to an explicit bounded shell command via `resolveWorkspaceBuildCommand`. The command is submitted through the existing `executeSessionCommand` → `POST /api/sessions/:id/exec` path. No new job platform, queue, or endpoint was created.
- **Minimal build progress/output surfaced in existing workspace UI**: `buildStatusMessage` (blue), `buildError` (red), and `buildOutput` (scrollable `<pre>`, `data-testid: workspace-build-output`) render beneath the trigger controls. Build state resets on session switch.
- **Clear bounded error state for unavailable build toolchain/agent**: When `detectBuildToolchainUnavailable` returns true (exit 127, "toolchain unavailable", "xcodebuild: not found", "command not found"), the error message explicitly states: `{target} build toolchain is unavailable in this runtime. Use a compatible build agent/session.`
- **Clear bounded error state for build failure**: When the build exits non-zero and toolchain is present, the error message states: `{target} build failed (exit {code}). Review build output for details.` The raw build output (stdout + stderr combined) is shown in the output panel.
- **No device cloud / device farm / app-store / CI-CD expansion introduced**: All three bounded target commands are deterministic shell probes or npm script invocations that run inside the existing session container. No external build agent integration, no artifact storage service, no new provisioning flow was added.

---

## 9. Next Follow-up Boundary

The current slice establishes the bounded build-target execution foundation. The spec describes further slices: real Mac build agent integration (remote macOS server via SSH/API), iOS simulator screenshot/stream preview, artifact storage and retrieval, and Xcode version management. Any of these would constitute a follow-up task and must not be started until explicitly authorized.
