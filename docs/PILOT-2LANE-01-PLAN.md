# PILOT-2LANE-01 — First Genuine 2-Source-Lane Pilot — Step 1 Plan / Registration / Concurrency Contract

**Task ID:** PILOT-2LANE-01
**Title:** First Genuine 2-Source-Lane Pilot (shared checkout)
**Step:** 1 — Registration + candidate pair selection + concurrency contract
**Date:** 2026-08-24
**Status:** Step 1 COMPLETE — Steps 2/3/4 PENDING — IMPLEMENTATION NOT AUTHORIZED
**Family:** GOVERNANCE / DEVELOPMENT OS / PARALLEL CONTROL PLANE v1
**Workstream:** GOVERNANCE (taxonomy only; zero admission weight)
**Lifecycle:** 4-step (registration → stage-start/admission preflight → parallel implementation → consolidation/review/lock)
**Evidence class (this step):** GOVERNANCE
**Nature (this step):** GOVERNANCE / DESIGN ONLY — zero implementation, zero runtime, zero provider, zero credit, zero staging, zero Git mutation

Step 1 pre-write observation (read-only):

```
branch = main
HEAD   = 113ad6ffa27153c2f72b94c34d5675b4eaa58efe
         lock GOV-PRD-02 product requirements
git status --short = empty (CLEAN)
git log -5:
  113ad6f lock GOV-PRD-02 product requirements
  6322b8f reconcile authoritative product requirements
  2619715 complete GOV-PRD-02 product gap inventory
  61a2f25 register GOV-PRD-02 product reconciliation
  35b5ff2 complete and lock GOV-ARCH-02 architecture reconciliation with final checkpoint and verification
```

---

## 1. Purpose

Prove whether two independent implementation workers (two primary Cursor windows / source lanes) can operate concurrently in the single shared checkout `C:\Users\knlee\aiSandBox2026B` under explicit lane + write-ownership + mutex governance, using two REAL, independently valuable, currently pending product tasks — not fabricated demo work.

The pilot is the planned successor to GOV-PRD-02:

```
GOV-PRD-02 (LOCKED)
→ PILOT-2LANE-01 (this pilot)
→ pilot review
→ explicit future Lane 3 decision
```

## 2. Authoritative predecessor state

- GOV-ARCH-02 — COMPLETE AND LOCKED — PASS — 2026-08-24 — `docs/GOV-ARCH-02-CHECKPOINT.md` — ARCHITECTURE.md is authoritative TECHNICAL HOW.
- GOV-PRD-02 — COMPLETE AND LOCKED — PASS — 2026-08-24 — `docs/GOV-PRD-02-CHECKPOINT.md` — PRD.md is authoritative PRODUCT WHAT.
- GOV-OS-01 — COMPLETE AND LOCKED — Development OS / Parallel Control Plane v1 installed (`docs/GOV-OS-01-CHECKPOINT.md`, `docs/GOV-OS-01-STAGE-START.md`).
- Board state at Step 1 start: Lane 1 EMPTY, Lane 2 EMPTY, Lane 3 DISABLED, GOVERNANCE UNOWNED, all resources UNOWNED, active implementation lanes 0/2.
- `LIVE_STAGING_VALIDATED=YES`, `BUILDER_PRIVATE_BETA_READINESS=GO`.
- PRIVATE-BETA-INVITE-01: PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED. `INVITATION_EXECUTION_PERMITTED=NO`. This pilot does not move toward invitations.

**Identifier resolution:** No authoritative planned pilot identifier existed. Repo-wide searches of `TASKS.md` (current board), `TASKS_BACKLOG_FULL.md`, `docs/GOV-OS-01-CHECKPOINT.md`, `docs/GOV-OS-01-STAGE-START.md`, `docs/GOV-ARCH-02-CHECKPOINT.md`, `docs/GOV-PRD-02-CHECKPOINT.md`, and all docs found only the descriptive phrase "first genuine 2-source-lane pilot" (always "NOT REGISTERED") and zero matches for any `PILOT-*` identifier. **PILOT-2LANE-01** is therefore proposed and used as the canonical identifier: concise, self-describing (2 source lanes, first instance), zero collision with any existing ID family (GOV-*, PRIVATE-BETA-*, AGENT-*, I18N-*, ADMIN-CONSOLE-*, etc.).

## 3. Shared-checkout decision

The prior authoritative review conclusion stands and no later decision superseded it: the pilot runs in the SINGLE shared checkout `C:\Users\knlee\aiSandBox2026B`.

- NO Git worktrees, NO duplicate checkouts, NO separate Docker stacks, NO alternate databases, NO alternate staging.
- Mutex/write ownership serializes conflicting writes; worktrees would not isolate shared Docker/ports/Postgres/staging/provider resources and would add Git/operator complexity.
- The pilot deliberately tests Development OS lane/mutex discipline on the same tree.

## 4. Candidate inventory

All discovery was grounded in authoritative pending state (accepted limitations, documented non-goals/residuals, ARCHITECTURE CURRENT gaps). No registered-but-unstarted implementation tasks exist on the frontier; candidates derive from documented pending gaps.

| # | Candidate | Source of pendingness | Surface | Mutexes | Runtime needs | Verdict |
|---|-----------|----------------------|---------|---------|---------------|---------|
| CAND-A | User-created agent DELETE API (soft delete) | PRD.md line ~295: "Delete is not currently available (accepted private-beta limitation)"; GO-NO-GO accepted limitation T7; GOV-PRD-02 stage-start F6 | `services/api-gateway/src/user-agent/**` — entity already has `deleted_at` (`@DeleteDateColumn`) and migration applied → NO new migration | GATEWAY | None (jest unit tests, mocked repos, in-process supertest) | SELECTED — Lane 1 |
| CAND-B | Workspace StateMessage heading/action i18n migration (bounded) | I18N-SHELL-05 (LOCKED) explicit non-goal: "No status panel StateMessage heading/body/action migration beyond strings already supplied by recoveryCopy" — 60 `heading="…"` + 57 `action="…"` hardcoded English literals remain in `workspace-shell.tsx`; violates standing Multilingual-First rule; PRD §3.J multilingual UX is core CURRENT | `frontend/components/workspace/workspace-shell.tsx` + tests + 3 message files | FRONTEND + I18N | None (tsc + jest/jsdom) | SELECTED — Lane 2 |
| CAND-C | `search_workspace` harness tool implementation | ARCHITECTURE/GOV-ARCH-02: "NOT IMPLEMENTED (schema only)"; `implementationStatus: 'planned'` in tool-registry | `services/ai-service/src/agent-harness/**` + `worker.processor.ts` | AI-SERVICE | None nominally | REJECTED — frozen contract tests (`worker.processor.spec.ts` asserts `search_workspace` is NOT registered; `tool-registration-gates.spec.ts`) make this a deliberate frozen-invariant change requiring its own contract-change lifecycle; contradicts just-locked ARCHITECTURE CURRENT |
| CAND-D | `start_preview` harness tool implementation | Same 'planned' gate | Same | AI-SERVICE | None nominally | REJECTED — same frozen-gate reason as CAND-C |
| CAND-E | Delete-agent frontend UI (button/confirm/i18n) | Same product gap as CAND-A | `frontend/**` + messages | FRONTEND + I18N | None | REJECTED for pairing with CAND-A — cross-lane feature coupling (consumes Lane 1's unfinished endpoint); viable as a later sequential slice |
| CAND-F | Preview manual-refresh button | GO-NO-GO accepted limitation "Preview may require manual refresh" | frontend | FRONTEND | Browser smoke | REJECTED — already implemented (`workspace-preview-refresh` test id exists); not pending |
| CAND-G | Monitoring dashboard / cross-user isolation live test / support channel selection | GO-NO-GO limitations / GOV-PRD-02 §14 | broad / staging / decision | STAGING etc. | Staging, runtime, or Keith decision | REJECTED — staging mutation, runtime, unbounded, or a product decision not implementation |

## 5. Candidate-pair scoring

Scale: EXCELLENT / GOOD / MARGINAL / REJECT.

| Criterion | PAIR-1: CAND-A + CAND-B (recommended) | PAIR-2: CAND-A + CAND-C | PAIR-3: CAND-A + CAND-E |
|---|---|---|---|
| 1. Write-set separation | EXCELLENT — different services/trees; zero shared files | EXCELLENT — different services | EXCELLENT — backend vs frontend files |
| 2. Mutex separation | EXCELLENT — GATEWAY vs FRONTEND+I18N | EXCELLENT — GATEWAY vs AI-SERVICE | GOOD — GATEWAY vs FRONTEND+I18N |
| 3. Runtime independence | EXCELLENT — neither needs Docker/Postgres/Redis/staging/provider/browser | GOOD | GOOD — E2E proof of UI needs live backend |
| 4. Test independence | EXCELLENT — separate jest projects, mocked deps, no ports/DB/shared caches | GOOD — worker.processor tests are contract-heavy | GOOD |
| 5. Business value | EXCELLENT — closes a PRD-documented accepted limitation; removes 117 multilingual violations in core workspace UX | GOOD — harness is gated/out of beta | GOOD |
| 6. Boundedness | EXCELLENT — one endpoint+tests; one mechanical key-migration slice | MARGINAL — touches core worker processor | GOOD |
| 7. Reversibility | EXCELLENT — each lane trivially revertible without touching the other | GOOD | GOOD |
| 8. Validation clarity | EXCELLENT — deterministic unit tests + tsc in each lane | GOOD | MARGINAL — UI correctness vs missing endpoint ambiguity |
| 9. Hidden cross-lane dependency risk | EXCELLENT (none found: frontend does not call DELETE /agents; gateway does not read workspace-shell or messages) | MARGINAL — frozen gate tests create governance coupling | REJECT-level — Lane 2 consumes Lane 1's contract |
| 10. First-pilot suitability | EXCELLENT | MARGINAL | MARGINAL |
| **Overall** | **EXCELLENT — SELECTED** | MARGINAL | MARGINAL |

Only three plausible pairs exist from the legitimate candidate pool; no alternatives were manufactured.

## 6. Selected Lane 1 task — AGENT-PLATFORM-CREATE-01C

**Title:** User-Created Agent Delete API (soft delete)
**Identifier:** verified unused repo-wide before this registration.
**Product purpose:** Users can delete a user-created agent profile they own. Closes the PRD-documented accepted limitation "Delete is not currently available".
**PRD basis:** PRD.md §3.I (user-created agents CURRENT persist/list/view; delete named as accepted limitation). GOV-PRD-02 stage-start F6 table lists "Delete agent — NOT IMPLEMENTED (accepted beta limitation)".
**Architecture basis:** ARCHITECTURE.md §13.2 — `UserAgent` entity / `user_agents` table with `deleted_at` `@DeleteDateColumn` already present; migration `CreateUserAgentsTable1772500000000` already applied. DELETE extends the existing persistence/API surface (`POST/GET /api/agents`) — persistence/API only, still not an execution runtime.
**Scope:** Add `DELETE /api/agents/:id` (SessionCookieGuard, ownership-scoped `id + userId`, soft delete via `deleted_at`, 204 on success, 404 when not found/not owned), service method, controller tests (ownership isolation, 404, 204, idempotency behavior), optional service spec. NO migration. NO frontend. NO i18n (no UI copy). NO auth-core change (existing guard reused). NO admin surface change.
**Tests/validation (lane-local):** `Set-Location services\api-gateway; npm test` and `npm run build`. Unit tests use mocked repositories and in-process supertest — no DB, no fixed ports, no Docker/Redis.
**Runtime/staging/provider/DB-migration requirements:** NONE.
**Evidence class:** LOCAL-TESTS.
**Mutex:** GATEWAY (exclusive at Step 2 admission).

## 7. Selected Lane 2 task — I18N-SHELL-06

**Title:** Workspace StateMessage heading/action locale migration (bounded residual of I18N-SHELL-05)
**Identifier:** verified unused repo-wide; next in the established I18N-SHELL-01…05 family sequence.
**Product purpose:** zh-TW / zh-CN users currently see 117 hardcoded English fragments (60 `heading`, 57 `action` literals) in core workspace status panes (editor save, file navigation, exec, preview, history, save point, compare mode). Migrate them to the 3-locale message system.
**PRD basis:** PRD.md §3.J — multilingual UX (en / zh-TW / zh-CN) is a core CURRENT requirement.
**Governance basis:** CLAUDE.md Multilingual-First UX/UI rule; I18N-SHELL-05 (COMPLETE and LOCKED) explicitly deferred exactly this surface as a non-goal — this is its documented successor.
**Scope:** Replace the hardcoded `heading="…"`/`action="…"` literals in `StateMessage` call sites within `workspace-shell.tsx` with locale-backed copy following the established `getRecoveryCopy(locale)` / `getWorkspaceMessages` manual locale-switch pattern; add keys to all three message files; add/update source assertions in `workspace-shell.test.tsx` (keys exist in 3 locales; targeted literals removed). Preserve layout, classNames, behavior, and all `data-testid` values. NO redesign, NO routing change, NO backend, NO new dependencies, NO Heroicons change (no new icons needed).
**Tests/validation (lane-local):** `Set-Location frontend; npx tsc --noEmit` and `npm test`. `npm run build` is deliberately EXCLUDED from the parallel window (it rewrites `frontend/tsconfig.tsbuildinfo`, whose restore requires a Git mutation forbidden to workers) and is deferred to serialized combined validation.
**Runtime/staging/provider/DB-migration requirements:** NONE. No browser smoke required to prove correctness (source assertions + jsdom tests are decisive for key wiring).
**Mutexes:** FRONTEND + I18N (exclusive at Step 2 admission).
**Evidence class:** LOCAL-TESTS.

## 8. Why the pair is independent

- Different trees: `services/api-gateway/**` vs `frontend/**`. Zero shared writable files.
- No call-path coupling: the frontend does not call `DELETE /api/agents/:id` anywhere (endpoint is additive/backward compatible); the gateway never reads `workspace-shell.tsx` or message files.
- No shared contract requires freezing between the lanes (the DELETE contract matters only to a FUTURE frontend slice, not to Lane 2).
- Different mutexes; no HOTFILE overlap (all listed HOTFILE leases are e2e runner files owned by neither lane).
- Both are pure LOCAL-TESTS evidence class; neither starts any runtime.
- Reverting either lane's files leaves the other lane's implementation and test evidence fully valid.

## 9. Exact expected write ownership map

**EXCLUSIVE LANE 1 WRITE SET (AGENT-PLATFORM-CREATE-01C):**
- `services/api-gateway/src/user-agent/user-agent.controller.ts`
- `services/api-gateway/src/user-agent/user-agent.service.ts`
- `services/api-gateway/src/user-agent/__tests__/user-agent.controller.spec.ts`
- `services/api-gateway/src/user-agent/__tests__/user-agent.service.spec.ts` (new file, optional)

**EXCLUSIVE LANE 2 WRITE SET (I18N-SHELL-06):**
- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/components/workspace/workspace-shell.test.tsx`
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`
- `frontend/lib/recovery-copy.ts` ONLY if extending the existing locale-provider pattern requires it (declared here to make the lease explicit; still exclusively Lane 2)

Any write outside a lane's exclusive set is forbidden by default and is a pilot collision (STOP + escalate). Scope expansion requires returning to the control plane.

## 10. Shared read set (read-only for both lanes)

`PRD.md`, `ARCHITECTURE.md`, `CLAUDE.md`, `AGENTS.md`, `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/**`, and any source files outside the two exclusive write sets (e.g. Lane 1 may read `frontend/` for contract context; Lane 2 may read `frontend/lib/*.ts` locale providers, `frontend/i18n/**`, other components). Reading is always permitted; writing is not.

## 11. Serialized write set

- `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/PILOT-2LANE-01-*` — written ONLY by the control plane holding GOVERNANCE, at Step 1 (done), Step 2 admission, and Step 4 consolidation. Never during the parallel implementation window, never by workers.
- `PRD.md` §3.I one-line correction (delete now available) and `ARCHITECTURE.md` §13.2 one-line correction (DELETE endpoint exists) — Step 4 control-plane consolidation only, bounded doc patches, never by workers.
- Combined validation runs (Step 4) — serialized after both lanes reach their gate.
- `frontend/tsconfig.tsbuildinfo` — must not be dirtied during the window (Lane 2 does not run `npm run build`); any build artifact handling happens at Step 4 under control-plane/Keith Git authority.

## 12. Forbidden concurrent write set (neither lane may ever write)

`CLAUDE.md`, `AGENTS.md`, `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `PRD.md`, `ARCHITECTURE.md`, any `package.json` / lockfile, `docker-compose*.yml`, any `.env*`, migrations (`services/*/src/migrations/**`), auth/session/CSRF/internal-key code, credit/billing code, e2e runner HOTFILE files (`e2e/builder-golden-path/**`), `frontend/tsconfig.tsbuildinfo`, the other lane's exclusive write set, and everything else not in the lane's exclusive set.

## 13. Mutex / resource ownership plan

| Resource | Step 1 (now) | Step 2–3 (parallel window) | Step 4 |
|---|---|---|---|
| GOVERNANCE | Held transiently by PILOT-2LANE-01 control plane for this registration | UNOWNED during implementation (workers never take it) | Re-acquired transiently by control plane for consolidation/lock |
| GATEWAY | UNOWNED — reserved (not owned) for Lane 1 | OWNED by Lane 1 (AGENT-PLATFORM-CREATE-01C) | Released at LANE-DONE/lock |
| FRONTEND | UNOWNED — reserved (not owned) for Lane 2 | OWNED by Lane 2 (I18N-SHELL-06) | Released at LANE-DONE/lock |
| I18N | UNOWNED — reserved (not owned) for Lane 2 | OWNED by Lane 2 (atomic lease over all 3 message files) | Released at LANE-DONE/lock |
| AI-SERVICE / CONTAINER-MANAGER / MIGRATION / PACKAGE / COMPOSE / ENV / LOCAL-RUNTIME / STAGING / PROVIDER-LIVE / CREDIT | UNOWNED | UNOWNED — needed by neither lane; a lane discovering a need for any of these must STOP | UNOWNED |
| HOTFILE leases (e2e runner set) | UNOWNED | UNOWNED — untouched by both lanes | UNOWNED |
| Additional un-named collision surfaces checked | `frontend/tsconfig.tsbuildinfo` (excluded via no-build rule); jest caches (per-package, disjoint); node_modules (read-only, no installs); Windows file locks on shared reads (read-only, safe) | — | — |

The two lanes never concurrently write any owned resource. No same-resource-different-moments case exists; if one is discovered, that lane STOPS and the control plane serializes explicitly. Collisions are made impossible by admission rule, not probability.

## 14. Git rule

- Keith owns Git. Workers may READ Git state (`git status --short`, `git diff -- <own paths>`, `git log`).
- Workers must NOT: commit, push, pull, stash, reset, restore, checkout, switch, rebase, merge, cherry-pick — including `git restore` of `tsconfig.tsbuildinfo` (hence the Lane 2 no-build rule).
- All Git mutations across the whole pilot are performed by Keith on control-plane instruction at step boundaries.

## 15. Governance-write strategy (frozen rule)

1. Step 1 and Step 2 governance (board, registry, plan docs) are written centrally by the control plane holding GOVERNANCE BEFORE the parallel window opens.
2. During Steps 2–3 implementation, workers NEVER write `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `CLAUDE.md`, `AGENTS.md`, `PRD.md`, `ARCHITECTURE.md`, or any `docs/` governance file.
3. Each worker returns results/evidence in its own chat report (files changed, exact validation output, deviations).
4. The control plane records LANE-DONE / RETURN-TO-READY / REJECTED on the board and performs Step 4 consolidation, combined validation, doc patches, checkpoint, and LOCK.
5. Concurrent editing of TASKS.md by two workers is therefore structurally impossible.

## 16. Dirty-tree interpretation rule

- Step 2 preflight requires `git status --short` EMPTY (clean) at window open; the admission HEAD is recorded.
- During the parallel window a dirty tree is EXPECTED. Interpretation rule for every worker before and during work:
  - dirty path ∈ own exclusive write set → own work (fine)
  - dirty path ∈ other lane's declared exclusive write set → AUTHORIZED OTHER-LANE CHANGE — do not read-depend on it, do not touch it, do not revert it, do not "fix" it
  - dirty path outside BOTH sets → UNEXPECTED / OUT-OF-SCOPE — STOP the lane, report to control plane
- Evidence for this discrimination: this plan's §9 write map is embedded in each worker prompt; workers verify with `git status --short` and path comparison only. A worker must never revert or overwrite the other lane's files under any circumstance.

## 17. Runtime / infrastructure rule

- Neither lane requires Docker, PostgreSQL, Redis, dev servers, browser smoke, staging, provider calls, credits, or LIVE anything. That absence is a selection criterion of this pair.
- `RUNTIME_EXECUTION_AUTHORIZED=NO`, `PROVIDER_CALL_AUTHORIZED=NO`, `CREDIT_MUTATION_AUTHORIZED=NO`, `STAGING_MUTATION_AUTHORIZED=NO` for all pilot steps unless a future explicit gate changes them (none planned).
- Workers must not start/stop/reconfigure any shared infrastructure. No `docker compose down -v`, no destructive DB work, no migrations, no provider retries, no unregistered LIVE activity. A lane that believes it needs runtime has hit a stop condition.

## 18. Validation rule (lane-local)

- **Lane 1:** `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test` then `npm run build`. Mocked-repo unit tests; no DB/ports; safe to run while Lane 2 tests run.
- **Lane 2:** `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit` then `npm test`. jsdom unit tests; no ports. `npm run build` PROHIBITED during the window (tsbuildinfo/Git rule).
- Concurrency analysis: separate package directories, separate jest configs/caches, mocked externals, no shared test database, no fixed ports, no shared generated files, no snapshots crossing packages, no global env mutation. Concurrent execution is safe; only CPU/RAM are shared.
- Workers report exact command output; environmental failures reported separately from code failures; no false claims.

## 19. Lane failure / stop rules

A lane must STOP immediately (report to control plane; make no further writes) if:

1. it needs to write any file owned by the other lane or outside its exclusive set
2. it discovers a dependency on the other lane's unfinished work
3. it needs an unadmitted mutex (PACKAGE, ENV, MIGRATION, AI-SERVICE, etc.)
4. unexpected dirty files appear outside the union of both admitted write sets
5. tests reveal cross-lane coupling (e.g. a frontend test asserting gateway behavior or vice versa)
6. runtime resources collide or a runtime need appears
7. root cause of any defect becomes unclear
8. scope materially expands (e.g. Lane 2 discovering the migration requires touching components outside `workspace-shell.tsx`)
9. a PRD/ARCHITECTURE conflict appears

## 20. Independent recovery / one-lane-fails behavior

- One lane stopping does NOT automatically terminate the other. The control plane assesses: if the surviving lane's write set, mutexes, and validation remain untouched by the failure cause, it CONTINUES to its own gate.
- A stopped lane is recorded RETURN-TO-READY or REJECTED by the control plane; its partial file changes are quarantined by path (they live only in its exclusive write set) and reverted by Keith on control-plane instruction without touching the other lane's paths.
- Because write sets are disjoint, reverting one lane cannot invalidate the other lane's implementation or test evidence (revert isolation holds by construction).

## 21. Combined validation requirement (Step 4, serialized)

After both lanes reach their gate (or one lane survives alone), the control plane serially runs on the integrated tree:

1. `services/api-gateway`: `npm test` + `npm run build`
2. `frontend`: `npx tsc --noEmit` + `npm test` + `npm run build` (tsbuildinfo handled under Keith's Git authority)
3. Cross-check: no writes outside the two exclusive sets since admission HEAD (`git status --short` + `git diff --stat`)

LANE-DONE is lane-local only; LOCK requires this integrated validation plus bounded PRD/ARCHITECTURE doc patches plus checkpoint.

## 22. Pilot success criteria

1. Two independent lanes worked concurrently in one shared checkout without file collision.
2. Write ownership prevented all collisions (zero cross-set writes).
3. Mutex ownership prevented runtime/resource collisions (trivially — no runtime used).
4. Each worker correctly recognized authorized other-lane dirt vs out-of-scope dirt.
5. A lane stop/failure (if any) did not corrupt the other lane.
6. Each lane's validation completed independently and passed.
7. Step 4 consolidation lost/overwrote nothing (integrated combined validation green).
8. Elapsed-time observation recorded: did parallelism meaningfully beat sequential execution net of governance overhead?
9. Rule-change recommendations captured for the pilot review.
10. Evidence for/against a future Lane 3 captured — WITHOUT enabling Lane 3.

## 23. Pilot failure criteria

- Any worker writes outside its exclusive set; any worker mutates Git or governance files; any worker reverts the other lane's files.
- Cross-lane coupling forces serialized rework of either task.
- Combined validation fails due to lane interaction (not lane-local defect).
- Governance overhead so dominates that the pilot review concludes parallel execution is net-negative — this is a valid, reportable outcome, not something to hide.

## 24. Step 2 preflight requirements

Before any implementation is authorized:

1. Fresh control-plane window (boot sequence: AGENTS.md → CLAUDE.md → TASKS.md board → PILOT-2LANE-01 + both child IDs in registry → this plan).
2. Read-only Git preflight: branch = main, `git status --short` EMPTY, record admission HEAD. If dirty → STOP (Keith owns Git).
3. Re-verify both candidate surfaces are unchanged since Step 1 (no drift in `user-agent/*`, `workspace-shell.tsx` StateMessage literals, message files, frozen gate tests).
4. Board flip by control plane holding GOVERNANCE: Lane 1 RESERVED→ACTIVE (AGENT-PLATFORM-CREATE-01C, GATEWAY owned), Lane 2 RESERVED→ACTIVE (I18N-SHELL-06, FRONTEND+I18N owned), active lanes 2/2, Lane 3 DISABLED.
5. Two fresh implementation windows (one per lane), each given a worker prompt embedding: exact task scope + AC, exclusive write set, other lane's write set (for dirt discrimination), forbidden set, Git rule, stop rules, validation commands, no-governance-writes rule, no-subagents rule.
6. Runtime flags re-asserted NO. Docker/Postgres/Redis not started.
7. Workers start only after both admissions are recorded on the board.

## 25. Explicit Lane 3 prohibition

Lane 3 remains DISABLED throughout this pilot. This pilot cannot and does not enable Lane 3. A future increase requires completed pilot evidence, the pilot review, an explicit governance task, and updated board/CLAUDE.md rules.

## 26. Invitation parked state and successor sequence

```
LIVE_STAGING_VALIDATED=YES
BUILDER_PRIVATE_BETA_READINESS=GO
PRIVATE-BETA-INVITE-01=PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
INVITATION_EXECUTION_PERMITTED=NO
```

This pilot does not authorize invitations, does not register invite work, and does not move toward invitations.

Successor sequence (not registered beyond this pilot):

```
PILOT-2LANE-01 (Steps 2–4)
→ pilot review
→ explicit future Lane 3 decision
```

---

## Step 1 activity ledger

```
LIVE = 0
SSH = 0
staging = 0
provider = 0
credits = 0
gates = 0
runtime = 0
Docker = 0
Postgres = 0
Redis = 0
product implementation = 0
frontend implementation = 0
backend implementation = 0
tests executed = 0
dependencies = 0
PRD.md edits = 0
ARCHITECTURE.md edits = 0
Git mutations = 0
Lane 1 implementation = 0
Lane 2 implementation = 0
Lane 3 = DISABLED
invitation registration = 0
```

Allowed Step 1 writes: this plan, `TASKS.md` CURRENT EXECUTION BOARD, `TASKS_BACKLOG_FULL.md` pilot registration.

*Frozen 2026-08-24 — PILOT-2LANE-01 Step 1 — candidate pair frozen (AGENT-PLATFORM-CREATE-01C / I18N-SHELL-06) — concurrency contract frozen — implementation NOT authorized until Step 2 preflight — Lane 3 DISABLED — invitations PARKED.*
