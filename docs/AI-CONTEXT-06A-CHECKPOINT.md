# AI-CONTEXT-06A Checkpoint — Context System Final Hardening / Regression Matrix

**Task ID:** AI-CONTEXT-06A
**Family:** AI-CONTEXT
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-09

---

## What Was Delivered

Final hardening slice for the AI-CONTEXT pipeline. Created a comprehensive regression matrix document and added one targeted frontend test to close a specific low-risk coverage gap. No runtime behavior was changed.

---

## Files Changed

| File | Change |
|---|---|
| `docs/AI-CONTEXT-REGRESSION-MATRIX.md` | Created — regression matrix document |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added one focused test for Repo Docs Unavailable state on mismatched project/session linkage |

No backend files changed. No prompt assembly files changed. No frontend source behavior changed. No UX/UI text changed. No TASKS governance files changed during implementation.

---

## Regression Matrix Contents

`docs/AI-CONTEXT-REGRESSION-MATRIX.md` covers:

1. **Purpose** — lock down AI-CONTEXT pipeline behavior before moving to another feature family
2. **Scope and non-goals** — documentation/testing only, no new behavior
3. **Context pipeline summary** — full end-to-end path from API Gateway to AI Service to frontend indicator
4. **Source-of-truth table** — authoritative files for each area of the pipeline
5. **Prompt placement invariants** — system and user message ordering requirements
6. **Regression matrix** — 9 scenarios across Global/Project/Repo Docs/linkage states
7. **Active Context Indicator matrix** — badge states and helper messages for all conditions
8. **Repo Docs linkage matrix** — injection and indicator outcomes for linked/mismatched/null cases
9. **Existing automated test coverage map** — test file references for each behavior area
10. **Manual live smoke checklist** — step-by-step procedure for future runtime-touching changes
11. **Operational notes and known environment issues** — restart requirements, linkage dependency, PROJECT_FIRST_UX modes
12. **Rollback / recovery guidance** — steps and focused test commands for regression diagnosis

---

## Prompt Placement Invariants Documented

**System message order:**
1. `FILE_ACTION_OUTPUT_CONTRACT`
2. Global AI Instructions (if present)
3. Project AI Instructions (if present)

**User message order:**
1. Repo Docs block (if present)
2. Workspace context
3. User request

**Boundary invariants:**
- System message must not contain Repo Docs or User request.
- User message must not contain contract/global/project instruction blocks.
- Empty or whitespace-only instruction values are omitted.
- Repo Docs block is omitted when no readable docs exist.

---

## Operational Notes Documented

- Services must be restarted after backend build when using compiled `npm start` (`node dist/main.js`).
- Repo Docs injection depends on `session.projectId`.
- In local dev with `PROJECT_FIRST_UX=false`, selected project and selected session can differ until Open Project is clicked.
- In `PROJECT_FIRST_UX=true`, project open/create links sessions automatically.
- Active Context Indicator must represent backend execution readiness, not merely configured settings.

---

## New Test Added

**File:** `frontend/components/workspace/workspace-shell.test.tsx`

**Test:** `active context indicator shows repo docs unavailable when selected session project mismatches selected project`

**Why:** The existing frontend tests covered linked (`session.projectId === selectedProjectId`) and missing-link (`session.projectId === null`) cases. The mismatched-link case (`session.projectId !== selectedProjectId`, both non-null) was not explicitly asserted in the UI indicator. This gap was low-risk and obvious — the logic was already present but uncovered. The new test verifies that Repo Docs Unavailable is shown when `session.projectId = 'project-2'` and `selectedProjectId = 'project-1'`.

---

## Existing Test Coverage Confirmed

| Suite | File | Behaviors confirmed |
|---|---|---|
| AI Service prompt assembly | `services/ai-service/src/worker/worker.processor.spec.ts` | Contract placement; repo docs ordering; global/project inclusion/omission; system/user boundary isolation; system limited to contract+instructions |
| API Gateway queue payload | `services/api-gateway/src/ai/__tests__/ai-execution.workspace-context.spec.ts` | Global/project forwarding; session-based identity; repo doc inclusion; unreadable doc skip; null projectId omission; user mismatch omission; empty registry omission |
| Frontend Active Context Indicator | `frontend/components/workspace/workspace-shell.test.tsx` | Default Off states; Global/Project On/Off; Repo Docs On (linked); Repo Docs Unavailable (missing link); Repo Docs Unavailable (mismatched link — new); i18n key presence; source key usage |

---

## Validation Results

| Check | Command | Result |
|---|---|---|
| Frontend focused tests | `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test -- workspace-shell.test.tsx` | PASS — 630/630, 0 failed |
| ReadLints — regression matrix doc | ReadLints on `docs/AI-CONTEXT-REGRESSION-MATRIX.md` | PASS — no linter errors |
| ReadLints — frontend test file | ReadLints on `frontend/components/workspace/workspace-shell.test.tsx` | PASS — no linter errors |

Browser smoke: not required — no runtime behavior was changed.

---

## Non-goals Confirmed

- No new context feature behavior.
- No prompt assembly refactor.
- No Repo Docs injection changes.
- No UI redesign.
- No backend schema changes.
- No new API endpoints.
- No provider adapter changes.
- No frontend UX/UI source text changes.
- No broad test rewrite.
- No git commit/push steps.

---

## Rollback Guidance

This task is documentation and test-only. Nothing needs rollback in the runtime path.

To undo the regression matrix document: delete `docs/AI-CONTEXT-REGRESSION-MATRIX.md`.

To undo the new test: remove the test block `active context indicator shows repo docs unavailable when selected session project mismatches selected project` from `frontend/components/workspace/workspace-shell.test.tsx`. No other files are affected.

---

## Prior checkpoint reference

See `docs/AI-CONTEXT-05A-CHECKPOINT.md` for the Context Link Readiness Indicator task this hardening slice covers.
See `docs/AI-CONTEXT-04C-CHECKPOINT.md` for the Repo Docs injection task whose operational notes are captured here.
