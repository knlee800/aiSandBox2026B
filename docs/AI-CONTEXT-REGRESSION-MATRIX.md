# AI-CONTEXT Regression Matrix (AI-CONTEXT-06A)

## 1. Purpose

Lock down the complete AI context pipeline behavior delivered across AI-CONTEXT-01A through AI-CONTEXT-05A so future changes do not regress:

- prompt placement and authority boundaries
- context activation logic
- session/project linkage behavior
- Active Context Indicator readiness semantics

This document is the final hardening reference for regression checks before moving to another feature family.

## 2. Scope and non-goals

### In scope

- Document system/user prompt placement invariants.
- Define regression scenarios across Global Instructions, Project Instructions, and Repo Docs states.
- Map expected UI readiness states to backend execution readiness.
- Map existing automated tests to each major behavior.
- Capture manual smoke and operational notes.

### Non-goals

- No new context feature behavior.
- No prompt assembly refactor.
- No Repo Docs injection logic changes.
- No UI redesign or UX copy changes.
- No backend schema/API/provider changes.

## 3. Context pipeline summary

Execution path summary:

1. API Gateway resolves session + user identity.
2. API Gateway resolves optional Global AI Instructions and Project AI Instructions.
3. API Gateway resolves Repo Docs from project registry by `session.projectId`, reads docs from session workspace, and appends `workspaceContext.repoDocContents` only when readable.
4. AI Service builds prompt parts:
   - `system`: contract + instruction layers
   - `user`: repo docs (if present) + workspace context + user request
5. Frontend Active Context Indicator shows Global/Project/Repo Docs readiness for the current selected session/project context.

## 4. Source-of-truth table

| Area | Source of truth | Why it is authoritative |
|---|---|---|
| Prompt assembly and block ordering | `services/ai-service/src/worker/worker.processor.ts` and `services/ai-service/src/worker/worker.processor.spec.ts` | Final prompt parts are composed here; tests explicitly assert ordering and boundaries. |
| Global/project/repo-doc queue payload shaping | `services/api-gateway/src/ai/ai-execution.controller.ts` and `services/api-gateway/src/ai/__tests__/ai-execution.workspace-context.spec.ts` | Decides which context blocks are forwarded into queued jobs. |
| Repo Docs linkage dependency | `session.projectId` resolution in API Gateway controller flow | Repo Docs are project-scoped and resolved via session linkage, not UI selection alone. |
| Active Context Indicator readiness rendering | `frontend/components/workspace/workspace-shell.tsx` and `frontend/components/workspace/workspace-shell.test.tsx` | UI state is derived from configured status plus session/project linkage checks. |
| Operational behavior and prior validations | `docs/AI-CONTEXT-04C-CHECKPOINT.md`, `docs/AI-CONTEXT-05A-CHECKPOINT.md` | Captures hardened behavior, smoke outcomes, and known local-env constraints. |

## 5. Prompt placement invariants

These are required invariants for all regressions.

### System message order

1. `FILE_ACTION_OUTPUT_CONTRACT`
2. Global AI Instructions (if present)
3. Project AI Instructions (if present)

### User message order

1. Repo Docs block (if present)
2. Workspace context
3. User request

### Boundary invariants

- System message must not contain Repo Docs or User request.
- User message must not contain contract/global/project instruction blocks.
- Empty or whitespace-only instruction values are omitted.
- Repo Docs block is omitted when no readable docs exist.

## 6. Regression matrix

| ID | Global | Project | Repo Docs | `session.projectId` state | Expected prompt placement | Expected readiness in UI | Coverage |
|---|---|---|---|---|---|---|---|
| RM-01 | Off | Off | Off | `null` | System: contract only. User: workspace + request. | Global Off, Project Off, Repo Docs Off | Existing tests in `worker.processor.spec.ts`, `workspace-shell.test.tsx` |
| RM-02 | On | Off | Off | `null` | System: contract -> global. User unchanged ordering. | Global On, Project Off, Repo Docs Off | Existing tests in `worker.processor.spec.ts` |
| RM-03 | Off | On | Off | linked project | System: contract -> project. User unchanged ordering. | Global Off, Project On, Repo Docs Off | Existing tests in `worker.processor.spec.ts`, `ai-execution.workspace-context.spec.ts` |
| RM-04 | On | On | Off | linked project | System: contract -> global -> project. User unchanged ordering. | Global On, Project On, Repo Docs Off | Existing tests in `worker.processor.spec.ts` |
| RM-05 | On/Off | On/Off | On | linked (`session.projectId == selectedProjectId`) | User: repo docs block first, then workspace, then request. | Repo Docs On | Existing tests in all three suites |
| RM-06 | On/Off | On/Off | On | mismatched (`session.projectId != selectedProjectId`) | Backend still resolves by session project; selected project is not execution source. | Repo Docs Unavailable + warning | Existing plus new focused frontend test in `workspace-shell.test.tsx` |
| RM-07 | On/Off | On/Off | On | `null` | No repo docs forwarded to queue/prompt. | Repo Docs Unavailable when docs configured for selected project | Existing tests in gateway/frontend suites |
| RM-08 | On/Off | On/Off | configured but unreadable | linked | Unreadable docs skipped; readable subset only. | Repo Docs state based on configured+linkage, not file-read success details | Existing tests in gateway suite |
| RM-09 | On/Off | On/Off | none registered | linked | No repo docs block. | Repo Docs Off | Existing tests in gateway/frontend suites |

## 7. Active Context Indicator matrix

| Condition | Global badge | Project badge | Repo Docs badge | Expected helper message |
|---|---|---|---|---|
| No global instructions | Off | - | - | none |
| Global instructions configured | On | - | - | none |
| No project instructions | - | Off | - | none |
| Project instructions configured for selected project | - | On | - | none |
| Repo docs not configured | - | - | Off | none |
| Repo docs configured + selected session linked to selected project | - | - | On | none |
| Repo docs configured + selected session not linked (missing or mismatched) | - | - | Unavailable | "Repo Docs unavailable - open this project in the current session first." |

Indicator intent: it must represent effective execution readiness, not merely saved settings.

## 8. Repo Docs linkage matrix

| Case | `selectedProjectId` | `selectedSession.projectId` | `session.projectId` at execution | Repo Docs injected? | Indicator |
|---|---|---|---|---|---|
| Linked | `project-1` | `project-1` | `project-1` | Yes (if docs readable) | On |
| Mismatched | `project-1` | `project-2` | `project-2` | For session project only, not selected project docs | Unavailable |
| Session unlinked | `project-1` | `null` | `null` | No | Unavailable |
| No selected project + no configured docs | `null` | any | session value unchanged | No selected-project docs context | Off |

Important: Repo Docs resolution depends on backend `session.projectId`, not just frontend project selection state.

## 9. Existing automated test coverage map

### AI Service prompt assembly

File: `services/ai-service/src/worker/worker.processor.spec.ts`

- Contract placement in system prompt.
- Repo Docs block before workspace context and user request.
- Global/project instruction inclusion/omission and trimming.
- System/user boundary assertions (no cross-leakage of authority blocks).
- System prompt limited to contract + instruction blocks.

### API Gateway context forwarding and linkage

File: `services/api-gateway/src/ai/__tests__/ai-execution.workspace-context.spec.ts`

- Global/project instruction inclusion/omission in queue payload.
- Session-based identity handling.
- Repo docs inclusion when readable.
- Unreadable docs skipped while keeping readable docs.
- Omission when `session.projectId` is `null`.
- Omission on session owner mismatch.
- Omission when registry is empty.

### Frontend Active Context Indicator

File: `frontend/components/workspace/workspace-shell.test.tsx`

- Indicator presence and default Off states.
- Global and project On/Off display.
- Repo Docs On (linked) and Unavailable (missing link) display.
- i18n key presence and source usage checks.
- Added in AI-CONTEXT-06A: explicit mismatched project linkage assertion for Repo Docs Unavailable state.

## 10. Manual live smoke checklist

Use this when runtime behavior changes or before releases touching context pipeline code.

1. Ensure backend services run the latest build artifacts.
2. Prepare one project with:
   - global instructions saved for user
   - project instructions saved for project
   - repo docs configured
3. Run these scenarios:
   - Linked session/project -> Global On, Project On, Repo Docs On, prompt includes repo docs block first in user message.
   - Missing link (`session.projectId = null`) -> Repo Docs Unavailable, no repo docs block injected.
   - Mismatched link (`session.projectId != selectedProjectId`) -> Repo Docs Unavailable, execution follows session project linkage.
   - No repo docs configured -> Repo Docs Off.
4. Ask prompt: "What repo docs have you read?" and verify response reflects registered readable docs only when linked.
5. Verify no instruction blocks appear in user message and no repo-doc/user-request blocks appear in system message.

## 11. Operational notes and known environment issues

- Services must be restarted after backend build when using compiled `npm start` (`node dist/main.js`).
- Repo Docs injection depends on `session.projectId`.
- In local dev with `PROJECT_FIRST_UX=false`, selected project and selected session can differ until Open Project is clicked.
- In `PROJECT_FIRST_UX=true`, project open/create links sessions automatically.
- Active Context Indicator should represent backend execution readiness, not merely configured settings.
- Known local environment caveat from prior checkpoint: network certificate constraints may require local workaround for some frontend build-time font fetches; treat as environment issue, not context pipeline behavior.

## 12. Rollback / recovery guidance

If a regression is introduced in future changes:

1. Re-run focused tests first:
   - `services/ai-service`: `npm test -- worker.processor.spec.ts`
   - `services/api-gateway`: `npm test -- ai-execution.workspace-context.spec.ts`
   - `frontend`: `npm test -- workspace-shell.test.tsx`
2. Compare behavior against sections 5-8 in this matrix.
3. Revert only the smallest offending slice in the touched family (prompt assembly, gateway payload shaping, or indicator rendering).
4. Rebuild and restart backend services before re-smoke when using compiled start scripts.
5. Re-validate matrix scenarios and re-check indicator/output alignment.
