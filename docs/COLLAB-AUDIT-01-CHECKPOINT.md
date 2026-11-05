# COLLAB-AUDIT-01 — Checkpoint

**Task:** COLLAB-AUDIT-01 — Store collaboration audit and limit events
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** AGENT. **Lifecycle:** 3-STEP under the GOV-OS-04 record rules. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** CURRENT.
**Source:** registered by GOV-COLLAB-PLAN-01 (Option A); ACCESS-READY-01 plan section 4 recommends it before ACCESS-01B. Keith approved the scope and admitted it on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | with GOV-COLLAB-PLAN-01 | 80337dc2881cbdd52d4b2890ef7a3fed6a19fb90 |
| 1b. Admission | Lane 1 with GATEWAY and MIGRATION, scope approved by Keith | 12be3faa7a9b11ef655fa3078e28d4c4378610c6 |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-xhigh (migration work), resolved Grok 4.7 256K Extra High, session d1b5e483-b5a5-4cef-b7b6-97dfd8f3d6d4, one run | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

- Migration services/api-gateway/src/migrations/1800000000000-CreateAuditEventsTable.ts: table audit_events (uuid id, category, event_type, subject_type, subject_id, user_id nullable with no foreign key, payload jsonb, occurred_at, created_at), index idx_audit_events_subject_occurred, function audit_events_refuse_change and trigger trg_audit_events_refuse_change that raise on any UPDATE or DELETE. down drops trigger, function, index and table. Mocked spec in src/migrations/__tests__/.
- Entity services/api-gateway/src/entities/audit-event.entity.ts (AuditEventEntity), no update or delete helpers.
- services/api-gateway/src/orchestration/orchestration-audit.recorder.ts: StoredOrchestrationAuditRecorder extends the in-memory recorder; record() keeps the list and the JSON log line, then inserts one row (category orchestration, subject collaboration_run, subject_id the run ID, user_id null, payload the whole event, occurred_at the event time) without awaiting. A rejected or throwing insert logs "orchestration audit insert failed eventType=… collaborationRunId=…" and never fails the action.
- orchestration.module.ts registers AuditEventEntity and provides the stored recorder for the InMemoryOrchestrationAuditRecorder token, so OrchestrationService's constructor, emitAuditEvent, the 14 event types and their payloads are unchanged.
- New spec src/orchestration/stored-orchestration-audit.recorder.spec.ts: row shape, rejected insert, synchronous insert failure, module provider and repository registration. No existing test was edited.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| `npx jest src/orchestration src/migrations` | 16 suites, 266 passed |
| api-gateway `npm test` | 2660 passed, 7 skipped, 14 failed; the only failing suite is smoke.integration (runtime-only baseline); 2653 passed before, plus 7 new tests |
| api-gateway `npm run build` | exit 0 |
| Diff review | only the six allowed files changed; `git status` otherwise shows the untracked docs/ai/ |
| Staging database | PostgreSQL 15.19 (read-only check), so EXECUTE FUNCTION in the trigger is supported |

Cursor's run: first `npm test` on its default Node 24 failed to load better-sqlite3 (built for Node 22); its reported gates used Node 22.14.0 and match the reviewer's.

Evidence in `C:/Users/knlee/aisb-preflight/COLLAB-AUDIT-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-au.txt` | 5030 | `acc5143a09f3faa978e87a2afe9fd7e7d01225b0026e4b03c0aee8aaa7157aaf` |
| `cursor-result.json` | 6988 | `ab4789b3cf1570b07a60ad59f82f9bf51b31823ec82a752e0c43b78093eadf64` |
| `cursor-run.out` | 6120 | `f2fd4ab0d92d77e2bb084319030d92e56ccdcd6592b727815b8619d245bc7957` |
| `reviewer-npm-test.out` | 284 | `d4e1fbb8f73786df646602a96adcbf8056832c6bdfb7a886270d7805e71b25e6` |

## Acceptance criteria

All eight met by diff review and the reviewer run; the migration's up and down and the trigger are proven by the mocked spec, not on a database. Not LOCKED by an implementer: locked by the control plane.

## Limits

- Not deployed; the next staging deploy runs this migration, so the migration hash changes. The trigger is first exercised on a real database there.
- Insert is fire-and-forget: an event can be lost if the database write fails, but the log line remains as today. No read route; events are read by SQL only.
- user_id is null for collaboration events; the owner is collaboration_runs.user_id through subject_id.

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; GATEWAY and MIGRATION released UNOWNED.
