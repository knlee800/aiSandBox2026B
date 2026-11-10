# GOV-ARCH-SYNC-01 — Checkpoint

**Task:** GOV-ARCH-SYNC-01 — Sync ARCHITECTURE.md with the built collaboration and office
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** CORE. **Nature:** GOVERNANCE (documentation only). **Lifecycle:** 2-STEP. **Mutex:** GOVERNANCE, held only for this record.
**Source:** registered 2026-11-05 by GOV-BIZ-KNOWLEDGE-PLAN-01. Started 2026-11-10 under Keith's instruction to keep starting the next tasks ("do not stop!!! ... keep looking for the next task to start"). No implementation lane is used, and this is not a Development OS change.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Draft | A fable subagent drafted 45 exact old-to-new edits, read-only, each citing its task, checkpoint or code file:line (uniqueness checked by script) | scratchpad only |
| 2. Apply and LOCK | The control plane rechecked every edit against main and applied them, added two rows for BIZ-USER-01A, and wrote this checkpoint and the records | this record |

## What changed in ARCHITECTURE.md (47 edits, 1158 → 1217 lines)

- **Authority notice:** a bounded-sync line for 2026-11-10.
- **Hard constraints:** collaboration is CURRENT, gated per user and owner-approved. OrchestrationService is PostgreSQL-backed and reachable through `/api/internal/collaboration` and the gated `/api/collaboration`. It is no longer in-memory or unreachable.
- **§1 and §3 (system diagram and ownership):**
  - the /collaboration, /office, /knowledge and /connections pages;
  - the six newer tables;
  - the Gateway's orchestration, system-agents, knowledge, connectors, entitlements and audit;
  - the AI Service's signed per-job tool profiles, knowledge and connector tools and proof check;
  - per-user entitlements, daily limits, Socket.IO auth and CORS.
- **§7 and §8 (persistence and APIs):** collaboration, knowledge, audit_events, user_entitlements and connector_connections rows; the public run-list, cancel, system-agents, collaboration, knowledge, connectors and admin entitlement routes; and the internal collaboration and knowledge routes.
- **§11 and §12:**
  - the Gateway sets the identity fields on hand-off jobs;
  - the write flag is a kill switch since ACCESS-01C;
  - the per-user harness access and signed proof;
  - `collaborationRunId` and `referralTraceId` are CURRENT (gated);
  - per-plan daily limits;
  - the run list fields, cancel and RUN-STOP-01.
- **§13 (agents):**
  - the office as CURRENT first slices;
  - the gateway-owned system-agent registry, with AGENT-SPEC-01 fields (not deployed);
  - the Chief of Staff and advisors as gated team roles;
  - the referral runtime and durable orchestration as CURRENT;
  - connectors live since STAGING-DEPLOY-CONN-01, with the Chief of Staff listing both tools;
  - Knowledge store, tools and citations as CURRENT (plain text, no embeddings).
  - Parallel fan-out, several reviewers and RSI stay FUTURE.
  - The §13.3 "not current" list drops what is now built, including a `search_workspace` line that contradicted §12.1.
  - §13.5 is "partly current".
- **§14 to §16 (transports, scheduling, summary):** the Gateway runs connectors-mcp over stdio; the worker reaches the Gateway's knowledge and connector routes over HTTP; the session-authenticated Socket.IO gateway; the 5-minute CollaborationSweepWorker; and a corrected "not operational" summary.
- **BIZ-USER-01A (added by the control plane):** the `user_agents` rows say each row also stores a workflow (six-part spec, budgets, template id; migration 1803000000000, not deployed), with the new owner routes. Running a workflow is BIZ-USER-01C.

Every edit states CURRENT, deployed or not deployed from locked records and code. Nothing planned or gated was promoted without a locked task.

## Checks

- Each of the 45 drafted "old" strings occurs exactly once in ARCHITECTURE.md on main before applying (control-plane recheck).
- The file is LF, with box-drawing and dash characters intact.
- No other governance file changed except the records below.

CHECKLIST: EVERY 11/11 (3: fable, passed explicitly; 4: self-contained brief; 5: ARCHITECTURE.md and records only; 6 and 7: n/a, documentation only, no code or tests; 8 and 9: n/a), GOVERNANCE 9/9 (1: GOVERNANCE held for this record, no OS-semantics change; 2: GOV-PRD-SYNC-01 registered with its stanza; 3: n/a, no admission; 4: n/a, no lane; 5: governance record, not LOCAL-TESTS; 6: board and backlog mirrored; 7: n/a, no new product work selected; 8: no locked task or document edited; 9: validator run)
FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed. GOV-PRD-SYNC-01 covers both items the drafter left for Keith:
- PRD.md's office note (line 625) still says "approved FUTURE; not current; not scheduled", while OFFICE-01, 05, 06 and 07 are built and the first slices are live;
- ARCHITECTURE.md §2's "no cron / no platform schedulers" principle sits beside the 5-minute collaboration sweep.

Left as they are on purpose: §11.5 "staging proof pending C1 repeat", the harness audit recorder line, the registry's `enabled: false` flags and the §12.2 diagram, which the drafter could not prove.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. GOVERNANCE released UNOWNED. Both implementation lanes are unchanged: BIZ-USER-01B in Lane 1, AI-SERVICE-AUTH-01 in Lane 2.
