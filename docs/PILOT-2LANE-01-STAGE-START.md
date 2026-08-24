# PILOT-2LANE-01 — Step 2 Stage-Start / Exact Lane Admission / Shared-Checkout Preflight

## 1. Identity / date

**Task ID:** PILOT-2LANE-01
**Step:** 2 — Stage-start + exact lane admission + shared-checkout preflight
**Date:** 2026-08-24
**Nature:** GOVERNANCE / CONTROL PLANE ONLY — zero implementation, zero runtime, zero provider, zero credit, zero staging, zero Git mutation
**Predecessor plan:** `docs/PILOT-2LANE-01-PLAN.md` (Step 1, frozen 2026-08-24)
**This step's verdict:** PASS — both lanes exactly admitted. Implementation authorized ONLY after Keith commits this Step 2 state and `git status --short` is empty.

## 2. Predecessor state

- PILOT-2LANE-01 Step 1 COMPLETE — 2026-08-24 — committed by Keith as `00d9d9b register first two-lane pilot`.
- GOV-PRD-02 / GOV-ARCH-02 / GOV-OS-01 — COMPLETE AND LOCKED.
- Frozen candidate pair (Step 1): Lane 1 = AGENT-PLATFORM-CREATE-01C, Lane 2 = I18N-SHELL-06.
- Shared-checkout topology confirmed (no worktrees, no duplicate checkouts, no alternate stacks).
- Lane 3 DISABLED. PRIVATE-BETA-INVITE-01 PARKED. `LIVE_STAGING_VALIDATED=YES`, `BUILDER_PRIVATE_BETA_READINESS=GO`.

## 3. PILOT_ADMISSION_BASE_HEAD

Read-only Git preflight at Step 2 open:

```
branch = main
git status --short = empty (CLEAN)
PILOT_ADMISSION_BASE_HEAD=00d9d9b85a55b48c3f2176d72c4974234125624c
git log -5:
  00d9d9b register first two-lane pilot
  113ad6f lock GOV-PRD-02 product requirements
  6322b8f reconcile authoritative product requirements
  2619715 complete GOV-PRD-02 product gap inventory
  61a2f25 register GOV-PRD-02 product reconciliation
```

`PILOT_ADMISSION_BASE_HEAD` is the clean HEAD inspected BEFORE Step 2 governance writes. It is distinct from `PILOT_WORKER_LAUNCH_HEAD`, which is the clean HEAD AFTER Keith commits this Step 2 state (unknowable now; substituted into worker prompts at launch).

## 4. Pair drift re-verification

Only the frozen pair was reverified. No rescoring of the backlog was performed. No substitution occurred.

**Lane 1 (AGENT-PLATFORM-CREATE-01C) — NO DRIFT:**
- `services/api-gateway/src/user-agent/` contains exactly: `user-agent.controller.ts`, `user-agent.service.ts`, `user-agent.module.ts`, `dto/create-agent.dto.ts`, `__tests__/user-agent.controller.spec.ts`. No DELETE route exists; no service delete method exists; no service spec file exists — matches Step 1 assumptions.
- Entity `services/api-gateway/src/entities/user-agent.entity.ts` has `@DeleteDateColumn({ name: 'deleted_at' }) deletedAt` — soft-delete support present.
- Migration `1772500000000-CreateUserAgentsTable.ts` creates `deleted_at TIMESTAMP NULL` plus partial index `WHERE deleted_at IS NULL` — already applied per locked staging evidence (ARCHITECTURE.md §13.2).
- Frontend has NO caller of DELETE `/api/agents/:id` (checked `frontend/hooks/useUserAgents.ts` and all `/api/agents` references) — endpoint is purely additive; zero cross-lane coupling.

**Lane 2 (I18N-SHELL-06) — NO DRIFT:**
- Exact recount from current source (see §9): 60 `heading="` + 57 `action="` = 117 hardcoded literals — identical to Step 1.
- `getRecoveryCopy(locale)` pattern and the three message files unchanged in structure.

## 5. Lane 1 product/technical preflight

**Frozen product contract (WHAT level) — no new product policy invented; all semantics reuse existing repository conventions:**

- `DELETE /api/agents/:id` on the existing `@Controller('agents')` (global prefix `api`), protected by the existing controller-level `SessionCookieGuard` (no guard change needed — the new route inherits it).
- Authenticated owner deletes their own persisted agent profile: ownership scoping by `id + req.user.userId` (session-derived userId; never from request input) — same pattern as existing `GET :id`.
- Soft delete via the existing `deleted_at` `@DeleteDateColumn` (TypeORM soft-delete semantics). Row persists; `deleted_at` set.
- Success: **204 No Content**, empty body.
- Missing / already-soft-deleted / non-owned agent: **404 NotFoundException** — identical to the existing ownership not-found semantics of `GET :id` (404, never 403; existence is not revealed to non-owners). TypeORM `findOne` excludes soft-deleted rows by default, so already-deleted and never-existed are indistinguishable (correct).
- Repeat DELETE after success → 404 (existing not-found semantics; not idempotent-204).
- Soft-deleted agents automatically disappear from `GET /api/agents` and `GET /api/agents/:id` (TypeORM default soft-delete filtering on `find`/`findOne`).
- Unauthenticated → 401 (existing guard behavior).
- NO execution/runtime behavior added; NO cascade into agent execution (user-created agents remain non-executable persistent profiles per PRD §3.I).
- NO frontend Delete UI in this slice. NO i18n copy (API-only; no user-facing text).

**Technical verification results:**
- deleted_at / soft-delete support already exists — VERIFIED (entity + migration).
- No migration required — VERIFIED (column + partial index already applied).
- No entity/schema edit required — VERIFIED (`user-agent.entity.ts` is read-only for Lane 1).
- No auth/core guard change required — VERIFIED (controller-level guard covers the new route).
- Existing ownership model supports ownership-scoped delete — VERIFIED (`findOneByIdAndUserId` pattern).
- No frontend change required — VERIFIED (no frontend caller of DELETE).
- No other service change required — VERIFIED (user-agent module self-contained; module.ts needs no edit — controller/service already registered).
- Bounded controller/service/test slice — VERIFIED.

**Test-file strategy — RESOLVED (Step 1 "optional" eliminated):**
Decision = **B: a new exact service spec IS REQUIRED.** Rationale: the existing `user-agent.controller.spec.ts` fully mocks `UserAgentService`, so the ownership-scoped soft-delete repository semantics (criteria `{ id, userId }`, affected/absent handling, soft- vs hard-delete call) can only be proven at the service level. The frozen set is exactly:
- `services/api-gateway/src/user-agent/__tests__/user-agent.controller.spec.ts` (extend — DELETE contract: 204, 404 not-found, 404 non-owned, 401 unauthenticated, no body leak, cross-user isolation)
- `services/api-gateway/src/user-agent/__tests__/user-agent.service.spec.ts` (NEW, REQUIRED — mocked repository; soft-delete call semantics and ownership scoping)

No additional writable file is reasonably required (no module/dto/entity/app-module edits needed).

## 6. Exact Lane 1 write set

**LANE_1_EXCLUSIVE_WRITE_SET (exact, complete, no optional entries, no globs):**

```
services/api-gateway/src/user-agent/user-agent.controller.ts
services/api-gateway/src/user-agent/user-agent.service.ts
services/api-gateway/src/user-agent/__tests__/user-agent.controller.spec.ts
services/api-gateway/src/user-agent/__tests__/user-agent.service.spec.ts   (new file — REQUIRED)
```

## 7. Exact Lane 1 forbidden set

**LANE_1_FORBIDDEN_WRITE_SET** — everything not in §6, explicitly including:

- All Lane 2 files: `frontend/components/workspace/workspace-shell.tsx`, `frontend/components/workspace/workspace-shell.test.tsx`, `frontend/messages/en.json`, `frontend/messages/zh-TW.json`, `frontend/messages/zh-CN.json`
- Governance: `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `CLAUDE.md`, `AGENTS.md`, all of `docs/`
- `PRD.md`, `ARCHITECTURE.md`
- All `package.json` / `package-lock.json` / lockfiles; `docker-compose*.yml`; all `.env*`
- All migrations: `services/api-gateway/src/migrations/**` (and all other services' migrations)
- Entity/schema: `services/api-gateway/src/entities/**` (including `user-agent.entity.ts` — READ ONLY)
- Module/dto: `services/api-gateway/src/user-agent/user-agent.module.ts`, `services/api-gateway/src/user-agent/dto/create-agent.dto.ts` (READ ONLY)
- Auth core: `services/api-gateway/src/auth/**` (READ ONLY)
- Credits/billing code; internal-service endpoints; session lifecycle code
- `services/api-gateway/jest.config.js`, `services/api-gateway/tsconfig.json`
- e2e runner HOTFILE set: `e2e/builder-golden-path/**`
- `frontend/**` in its entirety; `frontend/tsconfig.tsbuildinfo`
- All other services (`ai-service`, `container-manager`) and every other unadmitted file

## 8. Lane 2 i18n preflight

- `workspace-shell.tsx` (~8,900 lines) defines the local `StateMessage` component (props: `tone`, `heading: string`, `body: string`, `action: string`, plus optional primary-action props) and renders 64 `<StateMessage` call sites.
- The established in-file locale pattern: `workspace-shell.tsx` already imports `enMessages`/`zhTwMessages`/`zhCnMessages` from `@/messages/*.json` directly and defines local per-namespace getters — `getTabMessages`, `getProjectPanelMessages`, `getCommonMessages`, `getWorkspaceMessages`, `getPreviewMessages`, `getAiMessages` — each `React.useMemo`-resolved from `props.locale`. `getRecoveryCopy(locale)` from `frontend/lib/recovery-copy.ts` supplies the `recovery` namespace the same way.
- `workspace-shell.test.tsx` (~8,500 lines) already uses the established source-assertion convention: `readFileSync` of `workspace-shell.tsx` and `JSON.parse(readFileSync(...))` of all three message files with key-presence and literal-absence assertions — Lane 2 extends this existing pattern.
- Frontend `npm test` = `tsx --test components/workspace/*.test.ts* components/public/*.test.ts* lib/*.test.ts lib/auth-module/*.test.ts` (Node test runner via tsx — not jest; no snapshots; no ports; no tracked writes).
- I18N-SHELL-05 (LOCKED) explicitly deferred exactly this heading/action surface as a documented non-goal; I18N-SHELL-06 is its registered successor. PRD §3.J multilingual UX (en / zh-TW / zh-CN) is core CURRENT; CLAUDE.md Multilingual-First rule applies.
- UX/UI advisory skills (Impeccable, Emil Kowalski) are ADVISORY ONLY; this is i18n remediation, not redesign. No icon changes (Heroicons v2 Outline rule remains authoritative for any incidental inspection; no icons added/changed).

## 9. Exact hardcoded-literal recount (current source, case-sensitive)

| Pattern | Count | Meaning |
|---|---|---|
| ` heading="` | **60** | hardcoded English StateMessage heading literals (migration target) |
| ` action="` | **57** | hardcoded English StateMessage action literals (migration target) |
| ` heading={` | 4 | already-dynamic headings (out of migration scope) |
| ` action={` | 7 | already-dynamic actions (out of migration scope) |
| `<StateMessage` | 64 | total call sites (60+4 headings = 64; 57+7 actions = 64 — fully consistent) |

**Total admitted surface: 117 literals — EXACTLY matches Step 1. NO SOURCE DRIFT.**

Residual note (not drift, not scope): 30 ` body="` literals also exist in `workspace-shell.tsx`. Step 1 froze the scope as heading (60) + action (57) only. The `body` literals remain a documented out-of-scope residual for a possible future successor slice. Lane 2 MUST NOT migrate them in this task.

## 10. recovery-copy.ts resolution

**RESOLVED: `frontend/lib/recovery-copy.ts` = READ ONLY / NOT REQUIRED / REMOVED from Lane 2's write set.**

Rationale from current source: the established extension pattern for new message namespaces lives inside `workspace-shell.tsx` itself (direct 3-JSON imports + local `getXMessages(locale)` getters). Lane 2 adds its new keys as a namespace/sub-namespace in the three message files and resolves them through a local getter in `workspace-shell.tsx`, exactly like the six existing getters. `getRecoveryCopy`'s shape (`typeof enMessages.recovery`) is untouched as long as Lane 2 does not remove/rename existing `recovery` keys — and it must not. No conditional writable path remains.

## 11. Exact Lane 2 write set

**LANE_2_EXCLUSIVE_WRITE_SET (exact, complete, no optional entries, no globs):**

```
frontend/components/workspace/workspace-shell.tsx
frontend/components/workspace/workspace-shell.test.tsx
frontend/messages/en.json
frontend/messages/zh-TW.json
frontend/messages/zh-CN.json
```

The three message files are one atomic I18N lease: all new/migrated keys must land in all three locales; no other lane may write any of them while Lane 2 is ACTIVE.

## 12. Exact Lane 2 forbidden set

**LANE_2_FORBIDDEN_WRITE_SET** — everything not in §11, explicitly including:

- `frontend/lib/recovery-copy.ts` (READ ONLY — resolved §10)
- All Lane 1 files: `services/api-gateway/src/user-agent/user-agent.controller.ts`, `services/api-gateway/src/user-agent/user-agent.service.ts`, `services/api-gateway/src/user-agent/__tests__/user-agent.controller.spec.ts`, `services/api-gateway/src/user-agent/__tests__/user-agent.service.spec.ts`
- Governance: `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `CLAUDE.md`, `AGENTS.md`, all of `docs/`
- `PRD.md`, `ARCHITECTURE.md`
- All `package.json` / lockfiles; `docker-compose*.yml`; all `.env*`; all migrations
- `frontend/tsconfig.json`, `frontend/tsconfig.tsbuildinfo` (NEVER written, NEVER git-restored by the worker)
- All other `frontend/` files (components, lib, hooks, i18n utilities, app routes) — READ ONLY
- e2e runner HOTFILE set: `e2e/builder-golden-path/**`
- All of `services/**` and every other unadmitted file

## 13. Mutex ownership

| Resource | Owner during Step 3 window |
|---|---|
| GATEWAY | Lane 1 — AGENT-PLATFORM-CREATE-01C (exclusive) |
| FRONTEND | Lane 2 — I18N-SHELL-06 (exclusive) |
| I18N | Lane 2 — I18N-SHELL-06 (atomic lease over all 3 message files) |
| GOVERNANCE | OWNED by control plane only during this Step 2 write window; RELEASED (UNOWNED) when Step 2 writes finish; re-acquired transiently at Step 4. Workers NEVER hold it. |
| STAGING / PROVIDER-LIVE / CREDIT / ENV / PACKAGE / MIGRATION / AI-SERVICE / CONTAINER-MANAGER / LOCAL-RUNTIME / COMPOSE / all HOTFILE leases | UNOWNED — needed by neither lane; a lane discovering a need for any of these must STOP |

**MUTEX_OVERLAP=NO** (GATEWAY vs FRONTEND+I18N — disjoint by construction).

## 14. Runtime prohibitions

```
RUNTIME_EXECUTION_AUTHORIZED=NO
PROVIDER_CALL_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
STAGING_MUTATION_AUTHORIZED=NO
```

Neither lane may use Docker, PostgreSQL, Redis, dev servers, browser smoke, staging, provider calls, credits, or LIVE anything. A worker discovering a need for any of these must STOP that lane.

## 15. Validation commands (frozen, concurrent-safe)

**Lane 1 (concurrent window):**

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test -- user-agent
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build
```

**Lane 2 (concurrent window):**

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit --incremental false
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test
```

**Deferred to serialized Step 4 (control plane / Keith Git authority):**
- api-gateway FULL `npm test` (default `jest` also matches `src/__tests__/smoke.integration.spec.ts`, which requires live PostgreSQL on 5432 and a real provider key — prohibited runtime; its status is a pre-existing environmental matter assessed at Step 4)
- frontend `npm run build` (rewrites tracked `frontend/tsconfig.tsbuildinfo`; restore is a Git mutation forbidden to workers)

## 16. Validation side-effect analysis

| Command | Writes | Tracked/shared impact |
|---|---|---|
| Lane 1 `npm test -- user-agent` | jest cache only (temp / untracked) | NONE — targeted run of user-agent specs only; mocked repositories + in-process supertest; no DB, no fixed ports, no snapshots (repo has zero tracked `.snap` files); excludes the DB-dependent smoke integration spec |
| Lane 1 `npm run build` (`tsc`) | `services/api-gateway/dist/**` incl. `dist/tsconfig.tsbuildinfo` | NONE tracked — `dist/` and `*.tsbuildinfo` are gitignored; `git ls-files` confirms no tracked dist/buildinfo in api-gateway |
| Lane 2 `npx tsc --noEmit --incremental false` | nothing | NONE — empirically verified (§17) |
| Lane 2 `npm test` (`tsx --test`) | tsx cache only (untracked/ignored) | NONE — Node test runner; no snapshots, no ports, no test DB, no global env mutation, no tracked writes |

No shared ports, no shared test DB, no shared caches, no lockfile/package mutation, no global env mutation in any frozen command. Separate package directories; only CPU/RAM are shared. Concurrent execution is safe.

## 17. tsconfig.tsbuildinfo decision

**Finding:** `frontend/tsconfig.json` sets `"incremental": true` (plus `"noEmit": true`), and `frontend/tsconfig.tsbuildinfo` is **git-tracked** (tracked files are unaffected by the root `.gitignore` `*.tsbuildinfo` entry). Therefore plain `npx tsc --noEmit` reads AND rewrites the tracked buildinfo → **UNSAFE during the parallel window**.

**Frozen safe command:** `npx tsc --noEmit --incremental false` — the CLI boolean override disables buildinfo read/write entirely (supported by the installed TypeScript ^5; command-line options override tsconfig.json).

**Empirical verification (this Step 2, at PILOT_ADMISSION_BASE_HEAD):** SHA256 of `frontend/tsconfig.tsbuildinfo` captured before/after one run:

```
TSC_EXIT=0
HASH_BEFORE=7B61ECA02BEFD168EAA9F9066D5F6523C280B5E8E6650E8883C466EF9921E8F0
HASH_AFTER =7B61ECA02BEFD168EAA9F9066D5F6523C280B5E8E6650E8883C466EF9921E8F0
HASH_UNCHANGED=True
git status --short = empty after run
```

(Bonus baseline: the frontend typechecks clean at the admission HEAD.)

**Worker guard (mandatory):** after every typecheck, Lane 2 runs `git status --short` and confirms `frontend/tsconfig.tsbuildinfo` is NOT dirty. If it ever appears dirty: STOP the lane and report. The worker must NEVER run `git restore` (or any Git mutation) on it.

`TSC_BUILDINFO_SIDE_EFFECT_RESOLVED=YES` — typecheck is ADMITTED to the concurrent window with the frozen non-incremental invocation; frontend `npm run build` remains EXCLUDED and serialized into Step 4.

## 18. Dirty-tree contract

Both workers operate in the same checkout. At worker launch (after Keith commits Step 2): tree MUST be CLEAN and governance files clean.

Each worker receives `PILOT_WORKER_LAUNCH_HEAD` (the committed Step 2 HEAD — substituted by Keith/control plane before launch).

Once concurrent work begins, for Lane 1:
- dirt in Lane 1's exact write set (§6) = own admitted dirt — fine
- dirt in Lane 2's exact write set (§11) = **AUTHORIZED OTHER-LANE DIRT** — read only; never restore; never overwrite; never stage/commit; never read-depend on it; never "fix" it
- dirt outside Lane 1 + Lane 2 exact sets = UNEXPECTED — **STOP the lane, report**

For Lane 2: the same rule with the sets reversed.

If `TASKS.md` / `TASKS_BACKLOG_FULL.md` (or any governance file) become dirty while workers are running: **STOP BOTH LANES and escalate.** No implementation worker writes governance.

## 19. Git contract

Keith owns Git. Workers MAY use read-only Git commands: `git status --short`, `git diff -- <own files>`, `git diff --name-only`, `git rev-parse HEAD`, `git log`.

Workers MUST NOT: `git add`, `git commit`, `git push`, `git pull`, `git stash`, `git reset`, `git restore`, `git checkout`, `git switch`, `git rebase`, `git merge`, `git cherry-pick`, `git clean`. Workers must not "clean up" the other lane. All Git mutations across the pilot are performed by Keith on control-plane instruction at step boundaries.

## 20. Lane stop conditions

A lane must immediately STOP (no further writes; return evidence) if:

1. it needs to modify any file outside its frozen exclusive set
2. it needs the other lane's file
3. a hidden cross-lane dependency appears
4. an unadmitted mutex/resource becomes necessary
5. an unexpected dirty file appears outside both admitted sets
6. governance files become dirty
7. validation needs shared runtime
8. a test discovers cross-lane coupling
9. root cause/scope becomes unclear
10. a PRD/ARCHITECTURE contradiction appears
11. the task requires a dependency/package/config/migration change
12. the frozen endpoint/i18n contract is insufficient

Do not solve around the contract. STOP and return evidence.

## 21. One-lane failure behavior

If one lane stops, the other lane MAY continue only if: the failure cause does not touch its write set; no shared mutex is implicated; no unexpected global dirt exists; and its assumptions remain valid. Stopped-lane files are quarantined by path (they exist only inside its exclusive write set). No worker reverts them. Keith decides later Git recovery on control-plane instruction. Revert isolation holds by construction (disjoint write sets).

## 22. Lane 1 worker prompt (exact)

````text
Task: PILOT-2LANE-01 — Lane 1 Worker — AGENT-PLATFORM-CREATE-01C
Implement DELETE /api/agents/:id (ownership-scoped soft delete)

Repo root:
C:\Users\knlee\aiSandBox2026B

Model: Grok 4.6 High
Do not use subagents. Do not create worktrees. Use the existing shared main checkout.

============================================================
LANE IDENTITY
============================================================

You are Lane 1 of PILOT-2LANE-01, the first genuine 2-source-lane pilot.
Lane 2 (I18N-SHELL-06, a different Cursor window) is working CONCURRENTLY
in the SAME checkout on frontend i18n files. This is expected and authorized.

Your task: AGENT-PLATFORM-CREATE-01C — User-Created Agent Delete API (soft delete).
Admission evidence: docs/PILOT-2LANE-01-STAGE-START.md (Step 2).
You hold the GATEWAY mutex. You hold NO other mutex.

============================================================
LAUNCH PRECONDITION
============================================================

PILOT_WORKER_LAUNCH_HEAD=<PILOT_WORKER_LAUNCH_HEAD>

Run READ-ONLY:
  git -C "C:\Users\knlee\aiSandBox2026B" rev-parse HEAD
  git -C "C:\Users\knlee\aiSandBox2026B" branch --show-current
  git -C "C:\Users\knlee\aiSandBox2026B" status --short

Require at YOUR start: branch = main; HEAD = PILOT_WORKER_LAUNCH_HEAD above;
status clean OR dirty ONLY inside Lane 2's write set (listed below).
If HEAD differs or unexpected dirt exists outside both lanes' sets: STOP. Do not begin.

============================================================
YOUR EXCLUSIVE WRITE SET (the ONLY files you may modify/create)
============================================================

services/api-gateway/src/user-agent/user-agent.controller.ts
services/api-gateway/src/user-agent/user-agent.service.ts
services/api-gateway/src/user-agent/__tests__/user-agent.controller.spec.ts
services/api-gateway/src/user-agent/__tests__/user-agent.service.spec.ts   (NEW file — required)

Nothing else. No optional files. No "other tests if needed".

============================================================
LANE 2's WRITE SET (for dirt discrimination ONLY — NEVER touch)
============================================================

frontend/components/workspace/workspace-shell.tsx
frontend/components/workspace/workspace-shell.test.tsx
frontend/messages/en.json
frontend/messages/zh-TW.json
frontend/messages/zh-CN.json

Dirt in these files during your work = AUTHORIZED OTHER-LANE DIRT:
read only; never restore; never overwrite; never stage/commit; never "fix";
never read-depend on its in-progress content.

Dirt in YOUR set = your own work. Dirt OUTSIDE both sets = STOP and report.
If TASKS.md / TASKS_BACKLOG_FULL.md / any governance file becomes dirty: STOP.

============================================================
FORBIDDEN WRITES (non-exhaustive; everything outside your 4 files)
============================================================

TASKS.md, TASKS_BACKLOG_FULL.md, CLAUDE.md, AGENTS.md, PRD.md, ARCHITECTURE.md, docs/**
services/api-gateway/src/entities/** (user-agent.entity.ts is READ ONLY)
services/api-gateway/src/migrations/** (NO migration — deleted_at already exists)
services/api-gateway/src/user-agent/user-agent.module.ts (READ ONLY — no wiring change needed)
services/api-gateway/src/user-agent/dto/** (READ ONLY — DELETE has no body)
services/api-gateway/src/auth/** (READ ONLY — existing controller-level SessionCookieGuard covers your route)
Any package.json/lockfile, docker-compose*, .env*, jest.config.js, tsconfig*
frontend/** entirely; e2e/** entirely; services/ai-service/**; services/container-manager/**
Credits/billing code; internal endpoints; session lifecycle code

============================================================
GIT CONTRACT (Keith owns Git)
============================================================

Allowed READ-ONLY: git status --short, git diff -- <own files>,
git diff --name-only, git rev-parse HEAD, git log.
FORBIDDEN: add, commit, push, pull, stash, reset, restore, checkout, switch,
rebase, merge, cherry-pick, clean. Never "clean up" the other lane.

============================================================
RUNTIME PROHIBITION
============================================================

RUNTIME_EXECUTION_AUTHORIZED=NO / PROVIDER_CALL_AUTHORIZED=NO /
CREDIT_MUTATION_AUTHORIZED=NO / STAGING_MUTATION_AUTHORIZED=NO.
No Docker, PostgreSQL, Redis, dev servers, browser smoke, staging, provider
calls, credits, or LIVE anything. If you believe you need any: STOP.

============================================================
FROZEN IMPLEMENTATION SCOPE
============================================================

Add DELETE /api/agents/:id:

- Route on the existing @Controller('agents') — the controller-level
  SessionCookieGuard automatically protects it. Do not add/modify guards.
- Ownership scoping: id + req.user.userId (session-derived; never from input) —
  same pattern as existing GET :id.
- Soft delete via the existing deleted_at @DeleteDateColumn (TypeORM
  soft-delete; e.g. repository.softDelete with { id, userId } criteria or
  find-then-softRemove — follow existing service style).
- Success: 204 No Content, empty body (@HttpCode(HttpStatus.NO_CONTENT)).
- Missing / already-deleted / non-owned: 404 NotFoundException — identical to
  existing GET :id ownership not-found semantics (404, never 403).
- Repeat DELETE after success → 404 (not idempotent-204).
- Soft-deleted agents no longer appear in GET list / GET :id (TypeORM default
  soft-delete filtering — verify in tests, do not re-implement).
- NO hard delete. NO execution/runtime behavior. NO cascade (user-created
  agents are not executable). NO frontend UI. NO i18n copy. NO refactor of
  existing create/list/get code.

Service: add one delete method to UserAgentService following its existing
style. Controller: add one delete handler reusing toAgentResponse-adjacent
conventions (no response body on 204).

TDD where practical: verify absent contract first, implement minimum
behavior, targeted tests, own-file diff review (git diff -- <own files>).

============================================================
EXACT TESTS
============================================================

Extend services/api-gateway/src/user-agent/__tests__/user-agent.controller.spec.ts:
- DELETE returns 204 with empty body for owned agent (supertest HTTP contract)
- DELETE returns 404 for nonexistent agent
- DELETE returns 404 when agent belongs to another user (never 403; cross-user isolation)
- DELETE returns 401 unauthenticated
- service delete method called with (id, session userId) — never body-derived
- response contains no userId/deletedAt/internal fields (204 empty body)

Create services/api-gateway/src/user-agent/__tests__/user-agent.service.spec.ts (NEW):
- mocked Repository<UserAgent> (same mocking style as controller spec)
- delete uses soft-delete semantics scoped by { id, userId }
- returns/throws distinguishably when no row matched (not found / not owned / already deleted)
- does NOT hard-delete (repository delete/remove NOT called)

Preserve all existing tests and test IDs. Do not weaken existing assertions.

============================================================
VALIDATION (frozen concurrent-safe commands — use EXACTLY these)
============================================================

Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test -- user-agent
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build

- npm test -- user-agent runs ONLY the user-agent specs (mocked repos,
  in-process supertest; no DB/ports). Do NOT run the full `npm test` (it
  includes src/__tests__/smoke.integration.spec.ts, which needs live
  Postgres + provider — prohibited runtime; full suite runs at Step 4).
- npm run build writes only gitignored dist/** — verify with
  git status --short that no tracked file outside your write set changed.
- Report exact command output. Report environmental failures separately from
  code failures. No false claims.

============================================================
STOP CONDITIONS (immediately stop; no further writes; report)
============================================================

1. You need to modify any file outside your 4-file write set
2. You need a Lane 2 file
3. A hidden cross-lane dependency appears
4. An unadmitted mutex/resource becomes necessary
5. Unexpected dirty file outside both admitted sets
6. Governance files become dirty
7. Validation needs shared runtime
8. A test discovers cross-lane coupling
9. Root cause/scope becomes unclear
10. PRD/ARCHITECTURE contradiction appears
11. You need a dependency/package/config/migration change
12. The frozen endpoint contract is insufficient

Do not solve around the contract. STOP and return evidence.

============================================================
GOVERNANCE / STATE SEMANTICS
============================================================

You NEVER write TASKS.md, TASKS_BACKLOG_FULL.md, CLAUDE.md, AGENTS.md,
PRD.md, ARCHITECTURE.md, or docs/**. You do NOT self-declare board states.

Your terminal report states either LANE-DONE or STOP:

LANE-DONE means: implementation + your admitted lane-local validation
complete. It is NOT pilot-locked, NOT integrated, NOT deployable as a pilot
conclusion, NOT authorization for governance writes, NOT dependency-unblocking.
Step 4 (control plane) alone performs integrated validation and final LOCK.

============================================================
RETURN SCHEMA
============================================================

Return:
1. verdict: LANE-DONE or STOP (with stop-condition number + evidence)
2. HEAD verification result at start
3. exact files changed (must be a subset of your 4-file write set)
4. unified git diff summary of own files (git diff --stat -- <own files>)
5. exact npm test -- user-agent output (pass/fail counts)
6. exact npm run build result
7. git status --short at finish (with dirt classification: own / other-lane / unexpected)
8. confirmation: no Git mutations, no governance writes, no runtime, no
   dependency changes, no writes outside write set
9. deviations / discovered risks (if any)
````

## 23. Lane 2 worker prompt (exact)

````text
Task: PILOT-2LANE-01 — Lane 2 Worker — I18N-SHELL-06
Workspace-shell StateMessage heading/action multilingual remediation

Repo root:
C:\Users\knlee\aiSandBox2026B

Model: Grok 4.6 High
Do not use subagents. Do not create worktrees. Use the existing shared main checkout.

============================================================
LANE IDENTITY
============================================================

You are Lane 2 of PILOT-2LANE-01, the first genuine 2-source-lane pilot.
Lane 1 (AGENT-PLATFORM-CREATE-01C, a different Cursor window) is working
CONCURRENTLY in the SAME checkout on api-gateway user-agent files. This is
expected and authorized.

Your task: I18N-SHELL-06 — migrate the 117 hardcoded English StateMessage
heading/action literals in workspace-shell.tsx to the 3-locale message system.
Admission evidence: docs/PILOT-2LANE-01-STAGE-START.md (Step 2).
You hold the FRONTEND and I18N mutexes (I18N = one atomic lease over all
three message files). You hold NO other mutex.

============================================================
LAUNCH PRECONDITION
============================================================

PILOT_WORKER_LAUNCH_HEAD=<PILOT_WORKER_LAUNCH_HEAD>

Run READ-ONLY:
  git -C "C:\Users\knlee\aiSandBox2026B" rev-parse HEAD
  git -C "C:\Users\knlee\aiSandBox2026B" branch --show-current
  git -C "C:\Users\knlee\aiSandBox2026B" status --short

Require at YOUR start: branch = main; HEAD = PILOT_WORKER_LAUNCH_HEAD above;
status clean OR dirty ONLY inside Lane 1's write set (listed below).
If HEAD differs or unexpected dirt exists outside both lanes' sets: STOP. Do not begin.

============================================================
YOUR EXCLUSIVE WRITE SET (the ONLY files you may modify)
============================================================

frontend/components/workspace/workspace-shell.tsx
frontend/components/workspace/workspace-shell.test.tsx
frontend/messages/en.json
frontend/messages/zh-TW.json
frontend/messages/zh-CN.json

Nothing else. frontend/lib/recovery-copy.ts is READ ONLY (resolved at Step 2:
NOT required — the established extension pattern lives inside
workspace-shell.tsx itself). No optional files. No "if needed".

============================================================
LANE 1's WRITE SET (for dirt discrimination ONLY — NEVER touch)
============================================================

services/api-gateway/src/user-agent/user-agent.controller.ts
services/api-gateway/src/user-agent/user-agent.service.ts
services/api-gateway/src/user-agent/__tests__/user-agent.controller.spec.ts
services/api-gateway/src/user-agent/__tests__/user-agent.service.spec.ts

Dirt in these files during your work = AUTHORIZED OTHER-LANE DIRT:
read only; never restore; never overwrite; never stage/commit; never "fix";
never read-depend on its in-progress content.

Dirt in YOUR set = your own work. Dirt OUTSIDE both sets = STOP and report.
If TASKS.md / TASKS_BACKLOG_FULL.md / any governance file becomes dirty: STOP.

============================================================
FORBIDDEN WRITES (non-exhaustive; everything outside your 5 files)
============================================================

TASKS.md, TASKS_BACKLOG_FULL.md, CLAUDE.md, AGENTS.md, PRD.md, ARCHITECTURE.md, docs/**
frontend/lib/recovery-copy.ts (READ ONLY)
frontend/tsconfig.json, frontend/tsconfig.tsbuildinfo (NEVER write it, NEVER git-restore it)
All other frontend files (components, lib, hooks, i18n utilities, app routes) — READ ONLY
Any package.json/lockfile, docker-compose*, .env*, migrations
services/** entirely; e2e/** entirely

============================================================
GIT CONTRACT (Keith owns Git)
============================================================

Allowed READ-ONLY: git status --short, git diff -- <own files>,
git diff --name-only, git rev-parse HEAD, git log.
FORBIDDEN: add, commit, push, pull, stash, reset, restore, checkout, switch,
rebase, merge, cherry-pick, clean. Never "clean up" the other lane.
You must NOT git-restore frontend/tsconfig.tsbuildinfo under any circumstance.

============================================================
RUNTIME PROHIBITION
============================================================

RUNTIME_EXECUTION_AUTHORIZED=NO / PROVIDER_CALL_AUTHORIZED=NO /
CREDIT_MUTATION_AUTHORIZED=NO / STAGING_MUTATION_AUTHORIZED=NO.
No Docker, PostgreSQL, Redis, dev servers, browser smoke, staging, provider
calls, credits, or LIVE anything. No `npm run build`. No `next dev`.
If you believe you need any: STOP.

============================================================
FROZEN IMPLEMENTATION SCOPE
============================================================

Admitted surface (recounted and frozen at Step 2, case-sensitive):
- 60 hardcoded ` heading="..."` literals on <StateMessage ...> call sites
- 57 hardcoded ` action="..."` literals on <StateMessage ...> call sites
- Total 117; 64 StateMessage call sites; the 4 heading={...} and
  7 action={...} dynamic usages are ALREADY migrated — leave them alone.

Migration pattern (follow the file's OWN established pattern):
- workspace-shell.tsx already imports enMessages / zhTwMessages / zhCnMessages
  from @/messages/*.json and defines local getters (getTabMessages,
  getWorkspaceMessages, getPreviewMessages, getAiMessages, getCommonMessages,
  getProjectPanelMessages), each resolved from props.locale via React.useMemo.
- Add your new keys as a namespace (or coherent sub-namespaces) in ALL THREE
  message files and resolve them with a local getter in workspace-shell.tsx
  following exactly that pattern. Do NOT modify recovery-copy.ts. Do NOT
  remove/rename existing keys in any namespace.
- Every new/migrated key MUST exist in ALL THREE locales: en.json, zh-TW.json,
  zh-CN.json (I18N atomic lease). Translations must be real zh-TW / zh-CN
  translations consistent with the existing style in those files, not English
  copies and not machine-garbled text.
- After migration, ZERO hardcoded English heading="/action=" string literals
  may remain on StateMessage call sites in workspace-shell.tsx.

OUT OF SCOPE (do not touch):
- the 30 ` body="..."` literals (documented residual for a future slice)
- any copy rewrite (translate meaning 1:1; do not "improve" English copy)
- UX redesign, interaction redesign, new user-facing concepts
- icons (no additions/changes; Heroicons v2 Outline rule untouched)
- dependencies, routing, backend
- layout, classNames, behavior, and ALL data-testid values must be preserved

Advisory skills (Impeccable / Emil Kowalski design-engineering) are ADVISORY
ONLY. This is i18n remediation, not redesign. Do not expand scope based on
skill suggestions.

============================================================
EXACT TESTS
============================================================

Extend frontend/components/workspace/workspace-shell.test.tsx using its OWN
established source-assertion convention (readFileSync of workspace-shell.tsx
+ JSON.parse of the three message files):

- every new StateMessage key exists in en.json, zh-TW.json, zh-CN.json
- no hardcoded ` heading="` literal remains in workspace-shell.tsx
  (expected count 0)
- no hardcoded ` action="` literal remains in workspace-shell.tsx
  (expected count 0)
- zh-TW / zh-CN values are non-empty and differ from English where a real
  translation is expected (consistent with existing test style)
- preserve all existing tests and test IDs; do not weaken existing assertions

============================================================
VALIDATION (frozen concurrent-safe commands — use EXACTLY these)
============================================================

Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit --incremental false
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test

- The --incremental false flag is MANDATORY: plain `tsc --noEmit` rewrites the
  git-tracked frontend/tsconfig.tsbuildinfo (incremental: true in
  tsconfig.json). The frozen flag was empirically verified at Step 2 to leave
  the file byte-identical and the tree clean.
- MANDATORY GUARD after every typecheck: run git status --short and confirm
  frontend/tsconfig.tsbuildinfo is NOT dirty. If it is dirty: STOP the lane
  and report. NEVER git-restore it.
- npm test runs the frontend suite via tsx --test (no ports, no snapshots,
  no tracked writes) — safe concurrently with Lane 1.
- `npm run build` is PROHIBITED during this window (runs at Step 4).
- Report exact command output. Report environmental failures separately from
  code failures. No false claims.

============================================================
STOP CONDITIONS (immediately stop; no further writes; report)
============================================================

1. You need to modify any file outside your 5-file write set
   (including recovery-copy.ts or any other component)
2. You need a Lane 1 file
3. A hidden cross-lane dependency appears
4. An unadmitted mutex/resource becomes necessary
5. Unexpected dirty file outside both admitted sets
6. Governance files become dirty
7. Validation needs shared runtime
8. A test discovers cross-lane coupling
9. Root cause/scope becomes unclear
10. PRD/ARCHITECTURE contradiction appears
11. You need a dependency/package/config/migration change
12. The frozen i18n contract is insufficient (e.g. the migration cannot stay
    within the declared files)
Plus: tsconfig.tsbuildinfo becomes dirty at any point.

Do not solve around the contract. STOP and return evidence.

============================================================
GOVERNANCE / STATE SEMANTICS
============================================================

You NEVER write TASKS.md, TASKS_BACKLOG_FULL.md, CLAUDE.md, AGENTS.md,
PRD.md, ARCHITECTURE.md, or docs/**. You do NOT self-declare board states.

Your terminal report states either LANE-DONE or STOP:

LANE-DONE means: implementation + your admitted lane-local validation
complete. It is NOT pilot-locked, NOT integrated, NOT deployable as a pilot
conclusion, NOT authorization for governance writes, NOT dependency-unblocking.
Step 4 (control plane) alone performs integrated validation and final LOCK.

============================================================
RETURN SCHEMA
============================================================

Return:
1. verdict: LANE-DONE or STOP (with stop-condition number + evidence)
2. HEAD verification result at start
3. exact files changed (must be a subset of your 5-file write set)
4. unified git diff summary of own files (git diff --stat -- <own files>)
5. literal recount after migration: heading=" count and action=" count in
   workspace-shell.tsx (both must be 0)
6. key-parity confirmation across en / zh-TW / zh-CN
7. exact typecheck output (npx tsc --noEmit --incremental false) + buildinfo
   guard result
8. exact npm test output (pass/fail counts)
9. git status --short at finish (with dirt classification: own / other-lane /
   unexpected; tsconfig.tsbuildinfo must be absent)
10. confirmation: no Git mutations, no governance writes, no runtime, no
    build, no dependency changes, no writes outside write set, all
    data-testid values preserved
11. deviations / discovered risks (if any)
````

## 24. Step 3 launch procedure (frozen)

1. Step 2 control-plane writes finish (this document + board + registry).
2. Fable returns Step 2 evidence + both worker prompts.
3. Keith commits/pushes ONLY the Step 2 governance files (`docs/PILOT-2LANE-01-STAGE-START.md`, `TASKS.md`, `TASKS_BACKLOG_FULL.md`).
4. Keith verifies `git status --short` returns empty.
5. Record the resulting committed HEAD as `PILOT_WORKER_LAUNCH_HEAD`.
6. Because the commit changes HEAD from `PILOT_ADMISSION_BASE_HEAD` (00d9d9b…), workers MUST use the committed Step 2 HEAD: substitute the actual SHA for `<PILOT_WORKER_LAUNCH_HEAD>` in BOTH worker prompts before launch. Do NOT embed the pre-Step2 SHA as the launch SHA.
7. Open TWO fresh Cursor windows.
8. Start Lane 1 and Lane 2 from the same clean committed tree (either order; both verify HEAD + clean-or-authorized-dirt at their own start).
9. Do not edit governance while either worker is active.
10. Each lane returns LANE-DONE or STOP to the control plane.
11. Do not commit either lane independently until the control-plane consolidation strategy is reviewed.
12. Step 4 runs serialized integrated validation before any pilot lock.

## 25. Step 4 combined-validation requirement (serialized; control plane)

After both lanes reach their gate (or one lane survives alone):

1. `services/api-gateway`: full `npm test` + `npm run build` on the integrated tree (the `smoke.integration.spec.ts` suite requires live Postgres/provider — its environmental status is assessed and reported by the control plane, not hidden).
2. `frontend`: `npx tsc --noEmit` + `npm test` + `npm run build` — tsbuildinfo handling under Keith's Git authority (`git restore -- frontend/tsconfig.tsbuildinfo` if the artifact change is unintended, per CLAUDE.md).
3. Cross-check: no writes outside the two exclusive sets since `PILOT_WORKER_LAUNCH_HEAD` (`git status --short` + `git diff --stat`).
4. Bounded control-plane doc patches: PRD.md §3.I one-line delete-availability correction; ARCHITECTURE.md §13.2 one-line DELETE-endpoint addition.
5. Pilot review evidence (elapsed time, collision observations, rule-change recommendations, Lane 3 evidence — without enabling Lane 3), checkpoint, LOCK.

LANE-DONE is lane-local only. LOCK requires this integrated validation plus doc patches plus checkpoint.

## 26. Lane 3 prohibition

Lane 3 remains DISABLED throughout this pilot. This pilot cannot and does not enable Lane 3. A future increase requires completed pilot evidence, the pilot review, an explicit governance task, and updated board / CLAUDE.md rules.

## 27. Invitation parked state

```
LIVE_STAGING_VALIDATED=YES
BUILDER_PRIVATE_BETA_READINESS=GO
PRIVATE-BETA-INVITE-01=PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
INVITATION_EXECUTION_PERMITTED=NO
```

This pilot does not authorize invitations, does not register invite work, and does not move toward invitations.

---

## Step 2 activity ledger

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
application tests executed = 0   (one read-only tsc --noEmit --incremental false
                                  side-effect probe was executed as the mandated
                                  tsbuildinfo safety check; it ran no application
                                  tests, wrote nothing, and left the tree clean)
dependencies = 0
PRD.md edits = 0
ARCHITECTURE.md edits = 0
Git mutations = 0
Lane 1 implementation = 0
Lane 2 implementation = 0
Lane 3 = DISABLED
invitation registration = 0
```

Allowed Step 2 writes: this document, `TASKS.md` CURRENT EXECUTION BOARD, `TASKS_BACKLOG_FULL.md` (PILOT-2LANE-01 + its two admitted child tasks only).

*Frozen 2026-08-24 — PILOT-2LANE-01 Step 2 — both source lanes exactly admitted with non-overlapping write sets and mutexes — validation side effects frozen — implementation may begin only after Keith commits this Step 2 state and the shared checkout is clean — Lane 3 DISABLED — invitations PARKED.*
