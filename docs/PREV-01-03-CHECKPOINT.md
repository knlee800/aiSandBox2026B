# PREV-01-03 CHECKPOINT

## Task Metadata

- Task ID: PREV-01-03
- Title: Add Preview Start Action In Workspace UI
- Nature: UX FIX (PREVIEW PATH, FRONTEND ACTION GAP)
- Status: IN VALIDATION
- Checkpoint: `docs/PREV-01-03-CHECKPOINT.md`

## Objective

Add a user-visible preview start action in the workspace UI so users can start preview for previewable files from the unavailable state, instead of a refresh-only dead-end.

## Exact Files Changed

- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/components/workspace/workspace-shell.test.tsx`
- `frontend/app/[locale]/app/page.tsx`
- `docs/PREV-01-03-CHECKPOINT.md`

## Exact Implementation

1. Added a visible `Start Preview` action in the preview panel action row.
   - New button test id: `workspace-preview-start`
   - Enabled only when a session is selected and preview state is `unavailable`.
2. Kept existing `Refresh` behavior unchanged.
3. Wired frontend start action to existing preview start endpoint in app page state handlers.
   - Added `handleStartPreview()` in `frontend/app/[locale]/app/page.tsx`
   - Calls `POST /api/preview/:sessionId/start`
   - On success, calls existing `refreshPreviewForSession(...)` so normal status/proxy path takes over.
4. Updated unavailable-state guidance text to reflect the new explicit action.
5. Added focused render coverage in `workspace-shell` tests for start-action presence in unavailable state.

## Validation Run / Results

### 1) Frontend lints for changed files

- `ReadLints` on:
  - `frontend/components/workspace/workspace-shell.tsx`
  - `frontend/components/workspace/workspace-shell.test.tsx`
  - `frontend/app/[locale]/app/page.tsx`
- Result: **no linter errors**.

### 2) Focused frontend tests

- Command:
  - `npm test -- components/workspace/workspace-shell.test.tsx` (run from `frontend/`)
- Result:
  - **PASS**
  - `# tests 160`
  - `# pass 160`
  - `# fail 0`

### 3) Runtime preview start path probe

- Attempted end-to-end API probe for preview start/status/proxy with a created `index.html` session:
  - `GET /api/preview/:sessionId/status` (before start)
  - `POST /api/preview/:sessionId/start`
  - `GET /api/preview/:sessionId/status` (after start)
  - `GET /api/preview/:sessionId/proxy`
- Result:
  - API gateway health was `ok`.
  - In this run, `POST /api/preview/:sessionId/start` timed out in the local runtime environment, so this validation did not complete end-to-end here.

## Scope Compliance

- In scope:
  - preview unavailable UI state inspection
  - visible start action
  - start endpoint wiring
  - status refresh on success
  - refresh/status/proxy behavior preserved
- Out of scope respected:
  - no backend preview redesign
  - no broad preview UX redesign
  - no workspace redesign

## Conclusion

Frontend PREV-01-03 implementation is complete and scoped, with passing frontend checks and tests. End-to-end runtime verification for preview start in this local run is currently blocked by preview-start timeout, so task status remains pending final runtime confirmation.
