# KNOW-03 — Checkpoint

**Task:** KNOW-03 — Citations in business answers
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** AGENT. **Lifecycle:** 3-STEP under the GOV-OS-04 record rules. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** APPROVED_FUTURE, futureAuthorization AUTHORIZED.
**Source:** second slice of AGENT-KNOWLEDGE-01, docs/AGENT-BIZ-KNOWLEDGE-PLAN.md. Keith admitted it on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | with the approved plan | 54da4ebaf3b8b487c5f68bb179e6e9f99745268d |
| 1b. Admission | write set set; Lane 1 with GATEWAY, FRONTEND and I18N | c46b8cac4c816105ed6bc9792269359a7820f40f |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, session d18c5916-97f3-41e5-ac56-a69293a02274, one run | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

Gateway: services/api-gateway/src/orchestration/collaboration-citations.ts parses [source: <documentId>#<heading>] markers (heading optional; UUID ids only; deduplicated in order of first appearance), keeps a marker only when its document is an active knowledge document of the run owner (KnowledgeService.findActiveOwnedByIds, owner-bound, new, with spec), counts every dropped marker, and sets unsourced for a completed answer with no valid source. BUSINESS_ROLE_PROFILE_IDS is empty, so showUnsourced is false for every role until BIZ-01. collaboration.controller.ts adds sources, droppedSourceCount, unsourced and showUnsourced to the hand-off view, computed on read from the stored answer; orchestration.module.ts imports KnowledgeModule. No database column, no migration, no change to the job contract.

Frontend: the Team page shows a Sources list on a finished hand-off (title, scope name, heading; never document content), the Unsourced label when the server says so, and a dropped-marker count; three strings in en, zh-TW and zh-CN.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| api-gateway `npm test` | 2634 passed, 7 skipped, 14 failed; all 14 are the known runtime-only smoke.integration failures |
| api-gateway `npm run build` | exit 0 |
| `npx tsx --test lib/collaboration.test.ts` | 14 passed, 0 failed |
| frontend `npx tsc --noEmit` | exit 0 |
| frontend `npm test` | 836 passed, 0 failed |
| frontend `npm run build` | exit 0; frontend/tsconfig.tsbuildinfo restored |
| Cursor's run | `npx jest src/orchestration src/knowledge` 14 suites, 234 passed |

Evidence in `C:/Users/knlee/aisb-preflight/KNOW-03/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-gateway-test.txt` | 243876 | `e72948281b5e7cbec5ea4dc76f7ff58cec8073a8f50b2ad33acc9c1b89978460` |
| `reviewer-gateway-build.txt` | 45 | `7d45362984464872d740f22adcbdc4c1b9ae9c96e82aa10cfa855a6f328d6742` |
| `reviewer-collab-tests.txt` | 3162 | `194dd30997ea108075e8912e2c09900dd12039326098f8f55d93c6a6c35dfca6` |
| `reviewer-tsc.txt` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `reviewer-frontend-test.txt` | 180355 | `b44d5251c453174c831cbb2f6c65d5b2142c586a3bf59d0a1291840e8f94675e` |
| `reviewer-frontend-build.txt` | 3108 | `5b674417a44cd039f972531df8973ee0fa0f846a320cd5cc7e84f920f93f0d92` |

## Acceptance criteria

All six met by diff review and the reviewer run. Not LOCKED by an implementer: locked by the control plane.

## Limits

Mocked only; not deployed (staging runs 1aee7ed). No role cites documents yet: agents get knowledge tools in KNOW-02 and the first business role in BIZ-01.

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; GATEWAY, FRONTEND and I18N released UNOWNED; GOVERNANCE UNOWNED.
