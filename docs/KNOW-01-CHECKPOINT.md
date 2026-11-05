# KNOW-01 — Checkpoint

**Task:** KNOW-01 — Knowledge store and page
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** AGENT. **Lifecycle:** 3-STEP under the GOV-OS-04 record rules. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** APPROVED_FUTURE, futureAuthorization AUTHORIZED.
**Source:** first slice of AGENT-KNOWLEDGE-01, docs/AGENT-BIZ-KNOWLEDGE-PLAN.md. Keith approved the plan and admitted the slice on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | with the approved plan | 54da4ebaf3b8b487c5f68bb179e6e9f99745268d |
| 1b. Admission | Lane 1 with GATEWAY, MIGRATION, FRONTEND and I18N | 15a9452cae8aefb387fed2460a43a99270d3542c |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-xhigh (migration work), resolved Grok 4.7 256K Extra High, session ce95584d-5934-4787-8587-546ccd72d259, one run | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

Gateway: entity knowledge_documents (services/api-gateway/src/entities/knowledge-document.entity.ts) and migration 1799000000000-CreateKnowledgeDocumentsTable with up and down and a mocked spec (uuid id, user_id foreign key to users with cascade delete, scope, title, content, sha256 hash, byte size, timestamps, soft delete; an index on user and scope and a unique active title per user and scope). Module services/api-gateway/src/knowledge/: the server scope registry, content validation, service, controller, upload interceptor and specs, registered in app.module.ts. Routes under /api/knowledge (scopes; list without content; read one; create or replace by JSON or multipart .md/.txt; soft delete), all behind SessionOrApiKeyAuthGuard and the harnessEntitled check, every query bound to the caller. Limits 200 KB per document, 50 active documents and 4 MB per account; another user's document returns 404.

Frontend: frontend/app/[locale]/knowledge/page.tsx and frontend/components/knowledge/ (scope picker, list, paste or file upload, replace, delete with confirmation, loading, empty and error states, limits shown); a Knowledge link in the platform header; the knowledge namespace and platform.openKnowledge in en, zh-TW and zh-CN.

Correction to the plan: the frontend registry has nine unique scopes, not ten. legal-contracts is not in the registry, so the server does not register it; the parity test compares against the registry.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| api-gateway `npm test` | 2609 passed, 7 skipped, 14 failed; all 14 are the known runtime-only smoke.integration failures |
| api-gateway `npm run build` | exit 0 |
| `npx tsx --test components/knowledge/*.test.ts* components/platform/platform-dashboard.test.ts` | 56 passed, 0 failed |
| frontend `npx tsc --noEmit` | exit 0 |
| frontend `npm test` | 833 passed, 0 failed |
| frontend `npm run build` | exit 0; route /[locale]/knowledge built; frontend/tsconfig.tsbuildinfo restored |
| Cursor's run | `npx jest src/knowledge src/migrations` 8 suites, 84 passed |

Evidence in `C:/Users/knlee/aisb-preflight/KNOW-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-gateway-test.txt` | 245216 | `aa59c2753a1e6e821314df59730c033d6f1e4c598d4014550d38702c31c9b077` |
| `reviewer-gateway-build.txt` | 45 | `7d45362984464872d740f22adcbdc4c1b9ae9c96e82aa10cfa855a6f328d6742` |
| `reviewer-knowledge-tests.txt` | 12362 | `580292bcc77abdb988165974c04a56d92da82bcf1b36298e8df19623728f55d5` |
| `reviewer-tsc.txt` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `reviewer-frontend-test.txt` | 179695 | `512f92892c9c0747355d95945a50ef8f23b67f2b6de493d6fbeb9b8bc365f2b4` |
| `reviewer-frontend-build.txt` | 3108 | `4f39ab03e8593ce789d42510677851ab280bfef72c76de7fd258bed1e6354693` |

## Acceptance criteria

All six met by diff review and the reviewer run; the migration's up and down are proven by its mocked spec, not on a database. Not LOCKED by an implementer: locked by the control plane.

## Limits

- Not deployed and not seen in a browser; the next staging deploy runs this migration, so the migration hash changes.
- The account-usage check loads every document's content to sum sizes; fine at 4 MB per account. JSON uploads larger than the gateway's existing JSON parser limit fail before the handler; the page sends multipart, which reaches 200 KB.
- frontend npm test does not run the knowledge tests (FE-TEST-COVERAGE-01 item already registered); they ran separately above.

FOLLOWUPS: 2 registered / 0 superseded / 0 dropped / 0 undisposed (the usage-check and JSON-limit notes, as AGENT-KNOWLEDGE-01 items)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; GATEWAY, MIGRATION, FRONTEND and I18N released UNOWNED; GOVERNANCE UNOWNED.
