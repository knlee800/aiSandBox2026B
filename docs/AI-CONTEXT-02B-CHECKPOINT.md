# AI-CONTEXT-02B Checkpoint — Project AI Instructions Frontend UI

**Task ID:** AI-CONTEXT-02B
**Family:** AI-CONTEXT
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-05

---

## Objective

Expose Project AI Instructions in the existing project settings surface using the backend endpoints delivered in AI-CONTEXT-02A:
- `GET /api/projects/:projectId/ai-context`
- `PUT /api/projects/:projectId/ai-context`

---

## Files Changed

- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/components/workspace/workspace-shell.test.tsx`
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

No backend, service, governance, checkpoint, prompt assembly, repo docs, repo map, or validation contract files were changed.

---

## Implementation Summary

### UI Surface
- Added Project AI Instructions panel inside `HistoryProjectPanel` in `workspace-shell.tsx`, within the existing project controls surface.
- Panel includes: title, helper text, textarea, character count (`current / 4000`), Save button, Clear button, loading state, saving state, saved/success state, load-error state, save-error state, over-limit warning, and Save disabled when over 4000 characters.

### API Helpers Added (workspace-shell.tsx)
- `fetchProjectAiInstructionsFromApi(projectId)` — `GET /api/projects/:projectId/ai-context`
- `saveProjectAiInstructionsToApi(projectId, projectInstructions)` — `PUT /api/projects/:projectId/ai-context`
- `normalizeProjectAiInstructionsForApi(value)` — blank/whitespace normalizes to `null`
- Same-origin session-cookie fetch pattern; no Authorization headers added.
- Clear sends `{ projectInstructions: null }`.

### i18n Keys Added (under `project` namespace in all three locale files)
- `projectAiInstructionsTitle`
- `projectAiInstructionsDescription`
- `projectAiInstructionsPlaceholder`
- `projectAiInstructionsSave`
- `projectAiInstructionsClear`
- `projectAiInstructionsLoading`
- `projectAiInstructionsSaving`
- `projectAiInstructionsSaved`
- `projectAiInstructionsLoadError`
- `projectAiInstructionsSaveError`
- `projectAiInstructionsCharacterCount`
- `projectAiInstructionsTooLong`

### Tests Added (workspace-shell.test.tsx)
- Normalization test for blank/null handling
- Source wiring assertion for GET/PUT endpoint usage
- Locale-key existence test for en / zh-TW / zh-CN (all 12 keys)
- Render test asserting panel and controls present in active project view
- Source assertion for 4000 max-length enforcement and save-disable condition

---

## Validation Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` (frontend) | PASS |
| `npm test` (frontend) | PASS (609 tests, 0 failures) |
| ReadLints on touched files | PASS |
| Live browser test | PASS |

### Live Browser Test Coverage
- UI loaded and Project AI Instructions panel was visible
- Typed instructions, saved, verified persisted after project reopen
- Cleared instructions, verified remained cleared after project reopen
- Entered text exceeding 4000 characters: Save disabled and over-limit message shown

---

## Preserved Invariants

- Global AI Instructions UI in `workspace-account-menu.tsx` unchanged
- No backend, api-gateway, or ai-service files changed
- No prompt assembly files changed
- No Build Targets, Chat/History, or Command Input behavior changed
- No `workspace-tab-registry.ts` or `workspace-tab-bar.tsx` changed
- `frontend/tsconfig.tsbuildinfo` restored after validation
