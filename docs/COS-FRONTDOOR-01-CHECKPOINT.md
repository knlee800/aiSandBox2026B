# COS-FRONTDOOR-01 — Checkpoint (slice 01A: roster store)

**Task:** COS-FRONTDOOR-01 — Chief of Staff front door and report-back. This task is slice 01A, the roster store. Slices 01B and 01C are COS-FRONTDOOR-01B and COS-FRONTDOOR-01C.
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01 (plan row 34). Keith approved Stage 4 on 2026-11-10 ("yes"), with DECISION A (the Team page) and DECISION B (advisors and workflows, at most 3) ("ok").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | GOV-BIZ-AGENT-OPS-PLAN-01 | (2026-11-09) |
| 2. Stage-start | docs/COS-FRONTDOOR-01-STAGE-START.md, drafted by a fable subagent; approved, with 01B and 01C registered and 01A admitted | 8ddd651 |
| 3. Implementation | opus subagent (Opus 5.5: a migration and owner-scoped routes) in worktree lane/COS-FRONTDOOR-01, fast-forwarded onto main | 1314d47 |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

**Migration `1805000000000-CreateCollaborationRostersTable`.**
- Up: `CREATE TABLE "public"."collaboration_rosters" ("user_id" uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, "member_ids" jsonb NOT NULL DEFAULT '[]'::jsonb, "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)`.
- Down: `DROP TABLE "public"."collaboration_rosters"`.
- Each probes `information_schema.tables` first and refuses if the table is already present (up) or absent (down). An unreadable probe refuses both ways.
- No other index, no backfill, no transaction calls. Reversible; down loses only the saved rosters.
- The foreign key to users with `ON DELETE CASCADE` follows the per-user user_entitlements pattern. The control plane accepted it at review: a user's roster goes with the user.
- The 1804 spec's "latest" line moved to the `<=` form.

**Entity:** `CollaborationRosterEntity` (`userId`, `memberIds`, `updatedAt`).

**`CollaborationRosterService`.**
- **Members** are system candidates or the owner's workflows:
  - System candidates are registry agents with a team role outside coding, a read profile, not chief-of-staff or advisors-lead, and active. Today that is product-strategy and technology-advisor.
  - Workflows are the owner's own rows; any status may be saved.
- **Limits:** at most 3 members (the 4-agent run limit A5 counts the Chief of Staff), in order, with no duplicates.
- **`membersForStart`** returns `{ agents, rosterWorkflows, used, skipped }` for slice 01B:
  - each workflow is re-checked at start (active, renderable, tested at its current version) and carries a snapshot with `testRun: false`;
  - members that cannot run are skipped with a reason: draft, not_tested, off, missing, coming_soon or invalid.

**Routes** (`SessionOrApiKeyAuthGuard`; the collaboration entitlement rule: 401 with no identity, 403 without harness access).
- `GET /api/collaboration/roster` returns `{ members, choices }`. Each entry is `{ id, kind, name, usable, reason }`, with no instructions.
- `PUT /api/collaboration/roster` takes exactly `{ memberIds }`, upserts atomically and answers like GET.
- 400 codes:
  - `ROSTER_INVALID_BODY`
  - `ROSTER_TOO_MANY`
  - `ROSTER_DUPLICATE`
  - `ROSTER_MEMBER_NOT_ALLOWED`
  - `ROSTER_MEMBER_UNKNOWN`
  - `ROSTER_MEMBER_NOT_FOUND` (another owner's workflow answers exactly as a missing one)
- The owner id comes only from the identity, so an owner only ever reads and writes their own row.

**Unchanged:** `orchestration.service.ts` (frozen-path diff empty), `collaboration.controller.ts`, the registry, ai-service and the frontend.

**Tests:** 71 new.
- Migration 1805: 20, covering order, the entity match, exact up and down, the probes, and fail-closed cases.
- Roster service: 34, covering the member rule, every refusal, owner isolation, `membersForStart` with skips and re-checks, and a damaged stored value.
- Roster controller: 17, covering 401 and 403 with nothing read, save and read back, the 400 cases, owner scoping, and another owner's workflow treated as missing.

Files (10): under `services/api-gateway/src/`, `orchestration/collaboration-roster.entity.ts`, `collaboration-roster.ts` and its spec, `collaboration-roster.controller.ts` and its spec, `orchestration.module.ts`, `orchestration/__tests__/orchestration.persistence.spec.ts` (controller pin), `migrations/1805000000000-CreateCollaborationRostersTable.ts` and its spec, and the 1804 spec's latest line.

## Gates (control-plane rerun on main after the fast-forward)

| Gate | Result |
|---|---|
| gateway `npx jest --maxWorkers=2` | 3475 passed (3404 + 71), 7 skipped, 14 failed; the 14 are the known smoke.integration failures |
| gateway `npm run build` | exit 0 |
| ai-service `npx jest --runInBand` | 1296 passed, 1 skipped, 0 failed |
| frozen-path diff (orchestration.service.ts, src/ai, ai-service) | empty |
| line endings | the 10 files are LF |

## Limits

- **Not deployed.** STAGING-DEPLOY-FD-01 carries migration 1805 and takes a pre-migration backup.
- **Nothing calls the roster yet.** Slice 01B does.
- **The SQL has run only against mocks.**

CHECKLIST: EVERY 11/11, BACKEND 6/6 (3: n/a, no template; 4: no frozen contract touched, diff empty; 6: only the 14 known smoke failures), MIGRATION 4/4 (1: MIGRATION held, 4-step, opus per GOV-ROUTING-01; 3: down written and tested with mocks)
FOLLOWUPS: 0 registered / 2 superseded / 0 dropped / 0 undisposed.
- The seventh start reason, `invalid` (a stored workflow that no longer renders), needs translated text. It is folded into COS-FRONTDOOR-01C.
- The system members' labels and summaries live in `ROSTER_SYSTEM_MEMBER_TEXT` in collaboration-roster.ts, not in the registry. COS-FRONTDOOR-01B decides whether to move them, since it already changes the registry.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 is released EMPTY. GATEWAY and MIGRATION are released UNOWNED. COS-FRONTDOOR-01B is next.
