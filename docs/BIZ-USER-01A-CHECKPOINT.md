# BIZ-USER-01A — Checkpoint

**Task:** BIZ-USER-01A — Store user workflows: copy, blank, budget and grants
**Status:** COMPLETE AND LOCKED — 2026-11-10. Built and tested; **not deployed** (a migrating deploy, STAGING-DEPLOY-WF-01, comes later).
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01. Admitted 2026-11-10 under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with GATEWAY and MIGRATION | 4d0a864 |
| 2. Design step and stage-start | docs/BIZ-USER-01A-STAGE-START.md (fable subagent). Keith approved DECISION A (v1 = the nine catalogue folders) and DECISION B (Chief of Staff only): "Yes, both". The control plane settled C (rules are a constant) and the scope question (version hash in 01C) | a3f18cd |
| 3. Implementation | opus subagent in worktree lane/BIZ-USER-01A (24f6688), cherry-picked onto main | 1984673 |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Design step result (BIZ-USER-01)

User workflows extend `user_agents`; no new table. Reused from AGENT-PLATFORM-EXEC-01C:
- the table and entity;
- the ownership lookup;
- the routes;
- the Harness job `agentId` identity.

Not used: the Ask/Build `POST /api/ai/execute` identity block, which stays name, role and description. The 01C6 canary is not needed, because 01C runs through the signed collaboration start path.

## Change (15 files, all in services/api-gateway/src)

**Migration `AddUserAgentWorkflowColumns1803000000000`.** It follows `1802000000000-CreateConnectorConnectionsTable`; the spec checks the order.
- **Probe:** a fail-closed check on all twelve column names.
- **up:** one `ALTER TABLE user_agents` adding twelve columns, with four named CHECKs:
  - tone `varchar(120)` NULL;
  - reply_language `varchar(8)` NULL, checked against the four languages;
  - purpose, procedure and result: `text` NOT NULL DEFAULT '';
  - tool_profile `varchar(8)` DEFAULT 'read', checked;
  - knowledge_scope_ids and connector_tool_ids: `jsonb` DEFAULT '[]';
  - model `jsonb` DEFAULT '{"choice":"server"}';
  - the two budgets: `integer` NULL, checked ≥ 1;
  - template_id `varchar(64)` NULL.
- **down:** drops exactly those twelve columns, and refuses unless all twelve exist.
- **Not destructive:** no UPDATE, DELETE, TRUNCATE, index change or table drop (asserted). Existing rows get the defaults; only data in the new columns is lost on down.

**Saving.** Every create, copy and PATCH:
- renders the spec with `renderAgentInstructions`, using `rules` = `USER_WORKFLOW_RULES` (the Chief of Staff's rules text, checked equal to the registry's; never from the browser);
- checks `systemAgentPromptSpecProblems` and `agentInstructionsWithinLimit`;
- runs `userWorkflowGrants`, a pure function: stored spec ∩ platform allowlist, meaning profile `read` only, catalogue scope ids, and allowlisted tools whose kind the owner has connected.

A save is refused with 400 and a stable code if anything would be dropped. The codes are SPEC_INVALID, INSTRUCTIONS_TOO_LONG, TOOL_PROFILE_NOT_ALLOWED, KNOWLEDGE_SCOPE_UNKNOWN, CONNECTOR_TOOL_UNKNOWN, CONNECTION_MISSING, MODEL_INVALID, BUDGET_INVALID and TEMPLATE_NOT_ALLOWED.

**Create paths.**
- **Blank:** the legacy three-field `POST /api/agents`. It is byte-compatible: today's eight response keys keep the same values.
- **Copy:** `POST /api/agents/from-template` with `templateId: 'chief-of-staff'`. The server copies the spec; the body's spec fields never reach it. The copied Chief of Staff renders exactly `CHIEF_OF_STAFF_INSTRUCTIONS`.

**Routes.** All are under the existing class-level `SessionCookieGuard` and scoped to the owner; another owner's id gets 404. No entitlement check, because running is gated in 01C.
- `GET /api/agents/options` returns:
  - the languages, profiles, nine scopes and connector tools;
  - the owner's connected kinds and the platform models;
  - the templates and limits, including the per-user daily cap.
- `POST /api/agents/from-template`.
- `PATCH /api/agents/:id`.

Responses add the twelve stored fields, `neverDo`, `grants`, `instructionsChars` and `maxInstructionsChars`. The rendered prompt is not returned.

**Budgets** are stored only. Per day must be at least per run. Enforcement is 01C.

**Accepted worker choices:**
- tool ids already stored on a row stay valid on PATCH without a connection, so a copied Chief of Staff can be renamed before mail is connected; run-time grants still intersect with connections;
- duplicate ids are removed silently;
- an empty tone is refused, and null clears it.

Tests (110 new): migration shape and order, grants, rules, service and controller. Two existing controller assertions moved from exact-eight-keys to match-the-eight-values, because new keys were added. The secret-field test is unchanged.

## Gates (control-plane rerun on the branch)

| Command | Result | Baseline |
|---|---|---|
| api-gateway `npx jest` | 3004 passed, 7 skipped, 14 failed, all in `smoke.integration.spec.ts` | 2894 + 110 new; the same 14 known smoke failures |
| api-gateway `npm run build` | exit 0 | |

The worker's first full run had one suite crash with "Jest worker ran out of memory" (`users.integration.spec.ts`). It passed alone, and in the next full run.

## Limits

- Not deployed. The new migration changes the deploy's migration hash, so STAGING-DEPLOY-WF-01 is a migrating deploy that needs the pre-migration backup path.
- No version hash for workflows yet (01C).
- Stored ids that the catalogue or allowlist later drops will block a PATCH that does not resubmit the list. This fails closed, and run-time grants drop them anyway.
- Every `/api/agents` response does one connector-kinds lookup.

CHECKLIST: EVERY 11/11 (3: opus, passed explicitly; 8: no runtime or database started, migration tested with mocks; 9: no tracked artifacts), BACKEND 6/6 (1: existing SessionCookieGuard reused; 4: HARNESS_ENTITLEMENT_PROOF_V1 untouched; 5: MIGRATION held; 6: same known failures), MIGRATION 4/4 (2: order checked and tested; 3: up and down written and tested; 4: down drops only the new columns)

FOLLOWUPS: 0 newly registered / 6 superseded / 0 dropped / 0 undisposed. KNOW-FOLDERS-01 was registered at the stage-start (a3f18cd). Superseded:
- ARCHITECTURE.md rows for the workflow columns and owner routes, by GOV-ARCH-SYNC-01 (in progress);
- the workflow version hash, by BIZ-USER-01C;
- more templates, by COS-DRAFTS-01;
- frontend types and editor, by BIZ-USER-01B;
- budget enforcement and the platform model on a run, by BIZ-USER-01C;
- the legacy identity block, which stays as 01C's acceptance criteria.

Not follow-ups: the worker's notes on stale ids failing closed, the per-response kinds lookup and the duplicated cap default, which are accepted on record.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 released EMPTY; GATEWAY and MIGRATION released UNOWNED.
