# PRIVATE-BETA-STAGING-EXECUTION-04D3 — Migration Boundary Decision Report

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04D3  
**Title:** StartupGuard Required Schema / Migration Boundary Decision  
**Step:** 2 — Decision report  
**Date:** 2026-07-27  
**Nature:** GOVERNANCE / DECISION ONLY — no migrations — no table creation — no source changes — no env access — no runtime/server action — no Docker/PostgreSQL/Redis — no git commit or push — no subagents

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04D3 |
| Title | StartupGuard Required Schema / Migration Boundary Decision |
| Step | 2 — Migration Boundary Decision Report |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04D |
| Grandparent | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL BLOCKER |
| Nature | Decision / planning only |
| Risk | MEDIUM — authorizes a separate migration slice or rejects schema-check bypass |
| Registered | 2026-07-27 |
| Step 1 | COMPLETE (Registration — 2026-07-27) |
| Parent 04D status | ACTIVE / BLOCKED by 04D3 |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED |

---

## 2. Purpose

Resolve the deployment-boundary conflict between:

1. **StartupGuard** — fails API Gateway startup when required PostgreSQL tables are missing.
2. **04D scope** — PM2 start + health-only smoke, which **explicitly forbids** migrations and table creation.

This report decides the safe next path. It does **not** run migrations, create tables, change source, open env files, or resume PM2 health smoke.

---

## 3. Evidence Source

**Evidence type:** Static repository inspection + recorded VPS blocker evidence from 04D2 retry / 04D3 registration.

**Primary artifacts read:**

| Artifact | Role |
|----------|------|
| `TASKS.md` | Active ledger — 04D / 04D1 / 04D2 / 04D3 status and scope |
| `TASKS_BACKLOG_FULL.md` | Backlog authority (targeted search) |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Program roadmap context |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04D-PM2-HEALTH-SMOKE-RUNBOOK.md` | 04D no-migration boundary |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04D1-EVIDENCE-REVIEW.md` | Prior SQLite blocker context |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04D2-EVIDENCE-REVIEW.md` | Provider stub exception + next-phase schema risk |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04-APP-DEPLOYMENT-BASELINE-RUNBOOK.md` | Deferred migration policy |
| `docs/PRIVATE-BETA-STAGING-SETUP-06-CHECKPOINT.md` | Pre-migration snapshot / DATABASE_URL rules |
| `docs/PRIVATE-BETA-STAGING-SETUP-07-CHECKPOINT.md` | `migration:run:prod` Keith-approval rule |
| `services/api-gateway/src/startup/startup-guard.service.ts` | Required-table schema validation |
| `services/api-gateway/src/startup/*` | Startup validators / module wiring |
| `services/api-gateway/src/health/health.controller.ts` | Health endpoint table dependencies |
| `services/api-gateway/package.json` | Actual migration scripts |
| `services/api-gateway/data-source.ts` | TypeORM CLI data source |
| `services/api-gateway/src/config/database.config.ts` | Runtime TypeORM config (`synchronize: false`) |
| `services/api-gateway/src/migrations/*` | Active migration chain |
| `services/api-gateway/migrations/*` | Legacy migration folder (not wired to CLI) |
| Entity files for `usage_records`, `billing_snapshots`, `invoices` | Table ownership confirmation |

**Not used as evidence:** `.env` files, env values, SSH/AWS output, credentials, secret-bearing files, live database queries, migration execution output.

---

## 4. Current Blocker Summary

During 04D2 VPS sync/rebuild/PM2 retry:

- Prior SQLite missing-directory blocker passed (04D1).
- StartupGuard stub-provider exception worked: `AI_PROVIDER=stub` permitted because `GLOBAL_EXECUTION_ENABLED=false`.
- Production guardrails validated.
- Database reachable; authentication successful; schema exists.
- API Gateway then failed StartupGuard **required schema validation**:

```text
Startup failure: Database schema validation failed
Reason: Required tables missing
Expected: usage_records, billing_snapshots, invoices
Missing: usage_records, billing_snapshots, invoices
Remediation: Run database migrations
Command: npm run migrate:up
Exit Code: 1
```

- Restart loop was stopped.
- DB public table count remains **0** (no migrations run under 04D).
- 04D health smoke remains paused.

**Policy conflict:** StartupGuard remediation says run migrations; 04D forbids migrations/table creation. Therefore a separate approved boundary decision is required before continuing.

---

## 5. StartupGuard Schema-Validation Location

**Exact location:**

- File: `services/api-gateway/src/startup/startup-guard.service.ts`
- Method: `phase3DatabaseConnectivity()`
- Phase: Phase 3 / Checks 13–15 (after connectivity + `SELECT 1`)

**Behavior:**

1. Confirms `DataSource` is initialized.
2. Runs `SELECT 1`.
3. Queries `information_schema.tables` for public tables named:
   - `usage_records`
   - `billing_snapshots`
   - `invoices`
4. If fewer than 3 matches, throws `[STARTUP FAILURE] Database schema validation failed` and `process.exit(1)`.

There is **no** health-only / kill-switch exception around this table check. Unlike the 04D2 provider stub exception, schema validation is unconditional once Phase 3 is reached.

---

## 6. Required Tables

StartupGuard currently requires exactly these three tables:

| Required table | Entity | Primary role |
|----------------|--------|--------------|
| `usage_records` | `UsageRecord` (`src/entities/usage-record.entity.ts`) | Immutable AI execution / usage ledger |
| `billing_snapshots` | `BillingSnapshot` (`src/entities/billing-snapshot.entity.ts`) | Immutable billing snapshots derived from usage |
| `invoices` | `Invoice` (`src/entities/invoice.entity.ts`) | Immutable invoices derived from billing snapshots |

**Are these legitimate app/runtime prerequisites?**

**Yes.** They are first-class TypeORM entities wired into usage-ledger, billing, quota, admin, and invoice modules. StartupGuard treats them as critical production/staging schema prerequisites. Source evidence does **not** support classifying them as optional for process start.

Note: StartupGuard checks only these three tables as a minimum gate. A clean staging database still needs the **full** API Gateway migration chain for coherent runtime schema (users, sessions, auth, credits, etc.). Creating only these three tables by hand would be unsafe and is rejected.

---

## 7. Table Ownership and Migration Mapping

### Creating migrations (active CLI path: `src/migrations/`)

| Table | Creating migration | Class |
|-------|--------------------|-------|
| `usage_records` | `src/migrations/1738843200000-CreateUsageRecordsTable.ts` | `CreateUsageRecordsTable1738843200000` |
| `billing_snapshots` | `src/migrations/1738843300000-CreateBillingSnapshotsTable.ts` | `CreateBillingSnapshotsTable1738843300000` |
| `invoices` | `src/migrations/1738900000000-CreateInvoicesTable.ts` | `CreateInvoicesTable1738900000000` |

### Follow-on migrations that alter `usage_records`

| Migration | Effect |
|-----------|--------|
| `1740355200000-AddRequestIdToUsageRecords.ts` | Adds `request_id` + unique index |
| `1740355300000-AddExecutionStatusToUsageRecords.ts` | Adds execution-status columns; includes null-cleanup `DELETE` statements (no-op on empty table) |
| `1771495000000-AddExecutionStatusCancelStates.ts` | Extends execution_status check constraint |

### Legacy folder (not used by current CLI)

`services/api-gateway/migrations/` contains older files (`InitialSchema`, `AddApiKeysTable`, `AlignUsersSchema`).  
`data-source.ts` points **only** to `src/migrations/*.{ts,js}`. Do **not** run the legacy folder for staging baseline.

### Expected seed / data side effects in full chain

On a clean empty database, full `migration:run` / `migration:run:prod` primarily creates schema. Known non-empty data behavior:

| Migration | Data behavior | Staging impact on empty DB |
|-----------|---------------|----------------------------|
| `1771589000000-AddPlansFoundation.ts` | Upserts plan rows (`free`, `pro`) | Expected reference-data seed |
| `1771593000000-AddWorkspacesAndProjectWorkspaceId.ts` | Backfills default workspaces for existing users | No-op if no users |
| `1740355300000-AddExecutionStatusToUsageRecords.ts` | Deletes null-model/token rows during harden | No-op if table empty |

No migration evidence indicates Stripe/payment enablement, AI execution enablement, DNS/TLS, or container execution enablement.

---

## 8. Migration Command / Configuration Review

### Package scripts (authoritative)

From `services/api-gateway/package.json`:

| Script | Command | Intended use |
|--------|---------|--------------|
| `migration:run` | `typeorm-ts-node-commonjs migration:run -d data-source.ts` | Source/ts-node path |
| `migration:run:prod` | `typeorm migration:run -d dist/data-source.js` | Compiled/prod path after build |
| `migration:show` | `typeorm-ts-node-commonjs migration:show -d data-source.ts` | Pending/applied status |
| `migration:revert` | `typeorm-ts-node-commonjs migration:revert -d data-source.ts` | Revert last migration |

### Critical command correction

StartupGuard remediation text says:

```text
Command: npm run migrate:up
```

**That script does not exist** in `services/api-gateway/package.json` (repo-wide search found no `migrate:up`).

For staging VPS after 04C build, the source-grounded command is:

```text
npm run migration:run:prod
```

(or `migration:run` if deliberately using the ts-node path with `DATABASE_URL` loaded).

The future migration slice must **confirm the exact command** during preflight and must not follow the stale `migrate:up` string blindly.

### Data-source / runtime config

| Item | Finding |
|------|---------|
| CLI data source | `services/api-gateway/data-source.ts` |
| Connection secret | `DATABASE_URL` only (required) |
| Migrations glob | `__dirname + '/src/migrations/*.{ts,js}'` (compiled path resolves under `dist`) |
| `synchronize` | `false` in both `data-source.ts` and `database.config.ts` |
| `migrationsRun` | Not enabled in runtime `TypeOrmModule.forRoot(databaseConfig())` |
| Auto-migrate on boot | **No** — migrations are explicit CLI actions |

### Answers to required analysis questions (command/config)

5. **Does `npm run migrate:up` target the correct database layer?**  
   No — script missing. Correct layer is API Gateway TypeORM via `migration:run` / `migration:run:prod` against PostgreSQL using `DATABASE_URL`.

6. **Does migration execution require secrets beyond existing VPS `.env` values?**  
   No additional secrets beyond existing `DATABASE_URL` (already required by 04B env prep). Do not print values.

7. **Can migration be run without printing secret values?**  
   Yes — load env privately; use `migration:show` / migration logs that report migration names/status; never `cat`/echo `DATABASE_URL` or passwords.

8. **Does migration enable billing/payment/AI/container execution?**  
   No. Schema/reference-data only. Execution remains gated by kill switches / env policy (`GLOBAL_EXECUTION_ENABLED=false`, etc.).

9. **Does migration configure DNS/TLS?**  
   No.

10. **Schema only vs seed/modify business data?**  
    Primarily schema. Expected limited reference/backfill seeds noted above. Not a business-data import.

---

## 9. Risk Analysis

| Risk | Severity | Notes |
|------|----------|-------|
| Running migrations inside 04D | High (governance) | Explicitly forbidden by 04D runbook |
| Bypassing StartupGuard schema check | High | False-positive “ready” process with empty/incomplete schema |
| Using stale `migrate:up` command | Medium | Command does not exist; wastes attempt / confuses operators |
| Partial manual table creation | High | Leaves schema incomplete; later migrations may conflict |
| Full migration on clean DB | Medium (acceptable) | Creates full baseline schema; expected for staging |
| Unexpected seed rows | Low | Known plans upsert; workspace backfill no-op without users |
| Secret disclosure during migrate | High if mishandled | Mitigate by never printing `.env` / `DATABASE_URL` |
| No pre-migration snapshot | High | Rollback path would be weak |
| Resuming 04D before migration evidence review | Medium | Could re-enter restart loops |

### Required analysis answers (remaining)

11. **Rollback/restore via pre-migration Lightsail snapshot?**  
    Yes — standard staging pattern (SETUP-06/07 + prior EXECUTION snapshots). Migration slice must require a **new pre-migration snapshot Available** before execution. Snapshot restore is the primary rollback path for a failed/unexpected migration outcome.

12. **Would bypassing schema validation create false-positive health readiness?**  
    Yes. Process could bind and return `/health` / `/health/ready` (ready checks only `SELECT 1`, not required tables) while critical entities remain absent → false readiness.

13. **Can local health endpoints be meaningful if required tables are missing?**  
    Only as shallow liveness/connectivity. They cannot prove schema readiness. More importantly, with StartupGuard intact the process never stays up to serve them when tables are missing.

14. **Smallest safe next task?**  
    Register a separate migration baseline slice (Outcome A), not a StartupGuard exception.

15. **What remains blocked after the decision?**  
    See Section 19.

---

## 10. Outcome A Analysis — Separate Migration Slice

**Description:** Register a bounded task to run required database migrations safely, with runbook, preflight, snapshot, Keith approval, one-shot execution, evidence review, rollback/restore plan, and consolidation — then resume 04D.

**Fit to evidence:**

- StartupGuard correctly reports missing legitimate tables.
- 04D forbids migrations; therefore migration cannot be absorbed into 04D.
- Existing deployment docs already deferred migrations to a separate approved step (`migration:run:prod` + Keith approval).
- Full TypeORM chain exists and is the supported pathway (`synchronize: false`, no boot-time migrate).

**Pros:**

- Preserves StartupGuard integrity.
- Aligns with 04D boundary.
- Produces a real staging schema baseline.
- Clear rollback via Lightsail snapshot.
- Unblocks later 04D PM2 health smoke honestly.

**Cons / costs:**

- Adds one more staging execution slice before 04D can finish.
- Full migration creates many tables beyond the three StartupGuard checks (acceptable and desirable).
- Requires careful secret-safe operator procedure.

**Verdict:** **Recommended / Selected.**

---

## 11. Outcome B Analysis — Health-Only Schema-Check Exception

**Description:** Add a source-controlled StartupGuard exception so health-only startup can pass without required tables when execution remains disabled.

**Fit to evidence:**

- Health endpoints do not themselves query these tables.
- However, StartupGuard deliberately blocks process start before traffic.
- Entities/modules depending on these tables are real runtime surfaces.
- 04D2 already added a narrow stub-provider exception; widening StartupGuard again increases false-readiness risk.
- Source does **not** prove API Gateway can safely operate (even health-only) with an empty public schema long-term.

**Pros:**

- Might let PM2 show “online” faster without DB work.

**Cons:**

- Creates false-positive readiness.
- Weakens production hardening for staging convenience.
- Leaves table count at 0 while claiming progress.
- Does not create the schema eventually required by staging.
- Violates preferred default unless strong safety proof exists — proof is absent.

**Verdict:** **Rejected.**

---

## 12. Outcome C Analysis — Other Source-Grounded Safe Option

Candidates considered:

| Candidate | Assessment |
|-----------|------------|
| Manual SQL `CREATE TABLE` for only 3 tables | Rejected — bypasses migration ledger; incomplete schema; future migrate conflicts |
| Enable TypeORM `synchronize: true` | Rejected — explicitly forbidden by migration policy (`synchronize: false`) |
| Enable `migrationsRun` on boot | Rejected — silent/auto migration during PM2 start; outside approved operator control |
| Fold migration into remaining 04D steps | Rejected — 04D runbook hard-forbids migrations |
| Defer to EXECUTION-05 only | Inferior naming — migration is needed to unblock 04D inside the EXECUTION-04 family now |

No better existing pathway than a separate approved migration slice was found.

**Verdict:** **No superior Outcome C selected.**

---

## 13. Decision

```text
Outcome A — Separate approved migration slice
```

---

## 14. Rationale

1. StartupGuard is correctly failing: required tables are missing on a clean staging DB (public table count 0).
2. The three tables are legitimate application entities with owning migrations — not optional cosmetics.
3. 04D explicitly forbids migrations/table creation; therefore remediation cannot happen inside 04D.
4. Source evidence does **not** justify weakening schema validation for health-only startup.
5. Existing staging governance already anticipates a separate Keith-approved `migration:run:prod` step with pre-migration snapshot/backup.
6. A sibling slice under EXECUTION-04 preserves numbering clarity without pretending migration is part of PM2 health smoke.

---

## 15. Required Guardrails for Chosen Path

The next migration slice **must** require:

- Keith explicit approval before any migration execution.
- Pre-migration Lightsail snapshot created and **Available** before proceeding.
- Prefer also a private `pg_dump` backup if practical (SETUP-06/07 pattern), without printing secrets.
- No `.env` printing.
- No secret output (`DATABASE_URL`, passwords, keys).
- No DNS/TLS work.
- No PM2 service start during the migration task unless explicitly scoped later.
- No AI / billing-payment / container execution enablement.
- No Google OAuth enablement.
- Confirm exact migration command before execution (`migration:run:prod` preferred on built VPS; do **not** use nonexistent `migrate:up`).
- Confirm target DB identity safely (host/db name checks without printing credentials).
- Run migration **only once** in the approved window.
- Record migration output safely (migration names/status only).
- Verify exact post-migration table list.
- Verify required tables exist: `usage_records`, `billing_snapshots`, `invoices`.
- Verify no unexpected business-data seeding beyond known expected reference/backfill behavior.
- Preserve rollback path via pre-migration snapshot.
- Keep `PRIVATE-BETA-DEPLOYMENT-READINESS` **BLOCKED / PAUSED**.
- Do not mark 04D complete from the migration slice.
- Resume 04D health smoke only after migration evidence review passes.

---

## 16. Rejected Options

| Option | Status | Why rejected |
|--------|--------|--------------|
| Outcome B — health-only schema-check exception | Rejected | False-positive readiness; weakens StartupGuard; no source safety proof |
| Manual create of only 3 tables | Rejected | Incomplete schema; bypasses TypeORM migration history |
| `synchronize: true` | Rejected | Violates locked migration policy |
| Boot-time `migrationsRun` | Rejected | Uncontrolled migrate during PM2 start |
| Run migrations inside 04D | Rejected | Hard scope prohibition |
| Follow StartupGuard `migrate:up` literally | Rejected | Script does not exist |

---

## 17. Residual Risks

| Residual risk | Mitigation |
|---------------|------------|
| Full migration chain may fail on first staging run | Preflight `migration:show`; snapshot restore; stop and register fix slice |
| Operator uses wrong command (`migrate:up`) | Runbook must state `migration:run:prod` / `migration:run` explicitly |
| Compiled migration path / `dist` layout mismatch | Preflight confirm `dist/data-source.js` and migration artifacts after 04C build |
| Later StartupGuard phases or other services surface new blockers after migrate | Treat as new bounded blockers; do not widen this decision |
| 04D1/04D2 still pending consolidation | Keep them ACTIVE pending consolidation; do not conflate with migration execution |
| Plans seed appears as “data changed” | Document as expected reference seed |

---

## 18. Exact Next Task to Register

**Recommended task ID / title:**

```text
PRIVATE-BETA-STAGING-EXECUTION-04E — Staging Database Migration Baseline
```

**Naming rationale:**

- Prefer **04E** (sibling under `PRIVATE-BETA-STAGING-EXECUTION-04`) over `04D4`.
- Reason: 04D’s written scope forbids migrations; nesting migration under 04D would blur that boundary.
- Letter sequence remains coherent: 04A → 04B → 04C → 04D (paused) → **04E migration** → resume 04D.
- Prefer 04E over `EXECUTION-05` because this work unblocks the still-active EXECUTION-04 / 04D path; EXECUTION-05 remains a later post-04 registration/deferral item.

**Parent:** `PRIVATE-BETA-STAGING-EXECUTION-04`  
**Blocks resume of:** `PRIVATE-BETA-STAGING-EXECUTION-04D` PM2 health-only smoke  
**Does not replace:** 04D3 consolidation; 04D1/04D2 final consolidation

**Expected 04E shape (registration later):**

1. Registration  
2. Runbook + preflight (command confirmation, snapshot, target DB checks without secrets)  
3. Keith-approved one-shot migration execution + evidence  
4. Evidence review  
5. Consolidation/checkpoint  
6. Then return to 04D resume / remaining 04D3 workflow steps as appropriate

---

## 19. What Remains Blocked

After this decision (and until 04E succeeds):

- Resume of 04D PM2 health-only smoke (still blocked pending schema baseline).
- Claiming API Gateway staging startup healthy / ready.
- Any migration execution (blocked until 04E registered + Keith approval + snapshot Available).
- DNS/TLS configuration.
- Billing/payment enablement.
- AI execution enablement.
- Container execution enablement.
- Google OAuth enablement.
- Marking 04D / EXECUTION-04 complete.
- Advancing `PRIVATE-BETA-DEPLOYMENT-READINESS` (remains **BLOCKED / PAUSED**).

Also remain open (not solved by this decision report):

- 04D3 later steps (register 04E; later evidence/consolidation).
- 04D1 final consolidation.
- 04D2 final consolidation.

---

## 20. Final Recommendation

```text
Outcome A — Register a separate migration slice before resuming 04D.
Exact next task: PRIVATE-BETA-STAGING-EXECUTION-04E — Staging Database Migration Baseline
```

Do **not** weaken StartupGuard schema validation for health-only convenience.  
Do **not** run migrations inside 04D.  
Do **not** use the nonexistent `npm run migrate:up` command; use API Gateway `migration:run:prod` (preferred on built VPS) or `migration:run` after command confirmation.

**Immediate next action after this report:**  
Register `PRIVATE-BETA-STAGING-EXECUTION-04E` (governance registration only — still no migration execution until that task’s approved runbook/preflight/Keith gate).

---

## Validation of This Step

| Check | Result |
|-------|--------|
| Decision report file created | Yes — this file |
| All required sections 1–20 present | Yes |
| Decision explicit | Outcome A |
| Migration/table mapping documented | Yes — Section 7 |
| Exact next task named | `PRIVATE-BETA-STAGING-EXECUTION-04E` |
| Source files changed | No |
| Migration files changed | No |
| Env files opened/created/edited | No |
| Env values printed | No |
| Migrations run | No |
| PostgreSQL tables created | No |
| Runtime/server action | No |
| Docker/PostgreSQL/Redis action | No |
| Git commit/push | No |
| Subagents used | No |

---

**End of decision report.**
