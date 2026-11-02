# COLLAB-CHOOSE-01 — Checkpoint

**Task:** COLLAB-CHOOSE-01 — Agents request hand-offs in their answers; cleanup of finished and waiting hand-offs
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** Keith approved the draft on 2026-11-02. Registered and admitted in dd60edfcd95c2a32c4a8c8c89058ac5d39df75c3. Code and lock are one commit under the GOV-OS-04 rules.

## What changed

A first hand-off may carry a list of up to 4 agents with names and instructions, kept in `pending_job` and copied to children. Each job is told its role, the others, and the request format. An answer ending with `<handoff to="name">task</handoff>` on its own last line creates one waiting hand-off on read-back, with an idempotency key from the parent's id. The next prompt is the task and then the answer without the request. Malformed requests and refusals create no job, do not fail the parent, and appear as `handoffNote` on GET. A sweep every 5 minutes reads finished hand-offs back, closes finished runs, expires hand-offs waiting 24 hours or more to `timed_out`, fails empty runs older than that, and never approves anything.

## Implementer

Cursor CLI, requested grok-4.7-high, one run.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| api-gateway `npx jest` | 2526 passed, 7 skipped, 14 failed; only the known smoke.integration failures |
| api-gateway `npm run build` | exit 0 |
| Validator | exit 0 at this record |

## Limits

Not deployed. If the Gateway stops between completing a hand-off and creating the requested one, that request is lost, because the parent is no longer in progress; no job runs and the run can close. The request must be the exact last line, so a model that formats it differently gets a malformed note. A to B to A stays refused, so a reviewer cannot send work back. Agents see only text. Every hand-off still needs approval.
