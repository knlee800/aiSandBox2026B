# OFFICE-01 — Checkpoint

**Task:** OFFICE-01 — Static office: your agents and their run status on one screen
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP under the GOV-OS-04 record rules. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** APPROVED_FUTURE, futureAuthorization AUTHORIZED.
**Source:** first slice of RPG-OFFICE-01, docs/RPG-OFFICE-01-PLAN.md. Keith authorized it with the plan and admitted it on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | with the approved plan | b5494adbb40109a0ab5f4c9fc17ddc649083a02b |
| 1b. Admission | Lane 1 with FRONTEND and I18N, after both prerequisites locked | 75e8144b4e9b1efbaa18ad64a27ac767133a1d49 |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, session 74bcf39f-1c4f-486c-b799-9e20bf274918, two runs (build, then one reviewer fix) | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

New: frontend/app/[locale]/office/page.tsx (server page); frontend/components/office/office-screen.tsx, office-desk.tsx, office-desk-panel.tsx, office-art.tsx; frontend/hooks/useOfficeRuns.ts; frontend/lib/office/office.logic.ts; tests office.logic.test.ts and office-screen.test.tsx. 2,583 lines including tests.

Changed: frontend/components/platform/platform-dashboard.tsx (one header link to the office), its test, and the office namespace plus platform.openOffice in en.json, zh-TW.json and zh-CN.json (47 lines each).

Behaviour, as the plan with its [CP edit] changes: one desk per registry agent (coming-soon agents vacant), per user agent, a Team desk for runs with a collaborationRunId (role from builderProfileId) and a Former agents desk when needed; a desk panel with the current run and the last five; server-known states only, never "applied"; elapsed time for active runs and durationMs or "—" for finished ones; 5-second polling of the active list only while a desk is Queued, Working or Stopping, paused while the tab is hidden; simple geometric SVG art; every string from the three message files. The only controls are select desk, close panel, refresh and retry.

Reviewer fix (second run): when a run left the active list, polling stopped and the recent list was never reloaded, so the desk fell back to an older "Last run". activeRunsEnded now triggers one reload of both lists; four tests cover it.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| `npx tsx --test lib/office/office.logic.test.ts components/office/office-screen.test.tsx components/platform/platform-dashboard.test.ts` | 82 passed, 0 failed |
| `npx tsc --noEmit` | exit 0 |
| frontend `npm test` | 833 passed, 0 failed |
| frontend `npm run build` | exit 0; route /[locale]/office built; frontend/tsconfig.tsbuildinfo restored |

Evidence in `C:/Users/knlee/aisb-preflight/OFFICE-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-office-tests.txt` | 17822 | `e1cf48393e17630f7234ca2acf70389af74d77337c33510585f301436e6c7ac9` |
| `reviewer-tsc.txt` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `reviewer-frontend-test.txt` | 179695 | `43b8d6aa173ae03b61240edcc10fece071391a7811527af1cce82c1dc370b588` |
| `reviewer-frontend-build.txt` | 3024 | `03423686294bee574d4037c350ef3524baf5b16a29168a0a6e03c66e9a495ec2` |

## Acceptance criteria

All seven met by diff review and the reviewer run. Not LOCKED by an implementer: locked by the control plane.

## Limits

- Not seen in a browser and not deployed (ainow-staging-01 runs a28c489). The deploy and Keith's browser check are an item of RPG-OFFICE-01.
- frontend `npm test` lists fixed folders and does not run the office or platform tests; they ran separately above. Registered as FE-TEST-COVERAGE-01 item.
- Chinese copy is a first draft for Keith's review.

FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed (npm test coverage of the office and platform tests, as an FE-TEST-COVERAGE-01 item)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED; GOVERNANCE UNOWNED.
