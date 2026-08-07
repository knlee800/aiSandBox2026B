# ADMIN-CONSOLE-01A — Checkpoint
## Admin Credit Grant Domain + Audit Schema

**Status:** COMPLETE AND LOCKED — 2026-08-07
**Task ID:** ADMIN-CONSOLE-01A
**Parent:** ADMIN-CONSOLE-01 (Private Beta Operator Console) — remains ACTIVE
**Family:** ADMIN CONSOLE / CREDIT GRANT DOMAIN
**Workflow:** 4-step (registration → stage-start → implementation → checkpoint)
**Checkpoint created:** 2026-08-07
**Implementation commit:** not recorded in this consolidation step (governance-only; no Git commit/push)

---

## Summary

ADMIN-CONSOLE-01A extended the credit-grant domain to support audited `grantType='admin'` grants and added durable audit columns on `credit_grants`. Source migration, entity, service, repository, and focused tests are complete and validated.

**SOURCE MIGRATION COMPLETE.**  
**STAGING APPLICATION DEFERRED** — intentional per the registered 01A contract. The migration has **not** been run on staging. Staging schema availability for admin credit grants is **not** claimed.

No admin HTTP API exists yet (ADMIN-CONSOLE-01B).  
No frontend admin console exists yet (ADMIN-CONSOLE-01C / 01D).

---

## Step Status

| Step | Result |
|------|--------|
| Step 1 Registration | COMPLETE — 2026-08-07 |
| Step 2 Stage-Start / Design-Lock | COMPLETE — 2026-08-07 |
| Step 3 Implementation | COMPLETE — validated |
| Step 4 Checkpoint / Consolidation | COMPLETE — 2026-08-07 |

---

## Files Created / Modified (Step 3 Implementation Evidence)

### Created

| File | Description |
|------|-------------|
| `services/api-gateway/src/migrations/1772900000000-AddAdminGrantAuditColumns.ts` | TypeORM migration — admin audit columns + partial index |
| `services/api-gateway/src/billing/credit-grant/__tests__/credit-grant-admin-audit-migration.spec.ts` | Migration spec |

### Modified

| File | Description |
|------|-------------|
| `services/api-gateway/src/entities/credit-grant.entity.ts` | Maps `grantedByUserId`, `reason` |
| `services/api-gateway/src/billing/credit-grant/credit-grant.service.ts` | Admin branch: validation, `sourceType`/`provider`, balance semantics |
| `services/api-gateway/src/billing/credit-grant/credit-grant.repository.ts` | Persists `grantedByUserId`, `reason` |
| `services/api-gateway/src/billing/credit-grant/__tests__/credit-grant.service.spec.ts` | Admin path + validation + idempotency coverage |
| `services/api-gateway/src/billing/credit-grant/__tests__/credit-grant.repository.spec.ts` | Audit field persistence coverage |
| `services/api-gateway/src/entities` path via entity tests: `services/api-gateway/src/billing/credit-grant/__tests__/credit-grant.entity.spec.ts` | Entity field mapping coverage |

No other implementation files changed in Step 3.

---

## Migration — Source Complete / Staging Deferred

### Migration file

`1772900000000-AddAdminGrantAuditColumns.ts`

### `up()`

1. `ALTER TABLE "credit_grants" ADD COLUMN IF NOT EXISTS "granted_by_user_id" uuid;`
2. `ALTER TABLE "credit_grants" ADD COLUMN IF NOT EXISTS "reason" TEXT;`
3. `CREATE INDEX IF NOT EXISTS "idx_credit_grants_granted_by" ON "credit_grants" ("granted_by_user_id") WHERE "granted_by_user_id" IS NOT NULL;`

### `down()`

1. `DROP INDEX IF EXISTS "idx_credit_grants_granted_by";`
2. `ALTER TABLE "credit_grants" DROP COLUMN IF EXISTS "reason";`
3. `ALTER TABLE "credit_grants" DROP COLUMN IF EXISTS "granted_by_user_id";`

### Constraints / scope

- No FK on `granted_by_user_id`
- No CHECK constraint changes (`grant_type` / `source_type` already include `'admin'`)
- No unrelated schema changes

### Staging status (authoritative)

| Item | Status |
|------|--------|
| Source migration implemented | **COMPLETE** |
| Staging `migration:run` | **NOT APPLIED** |
| Staging application intentional? | **Yes** — deferred by registered 01A contract |
| Staging schema availability claimed? | **No** |
| Required before staging validation of admin credit grants | **Yes** — apply this migration in a later approved ADMIN-CONSOLE deployment step |

---

## Domain Implementation

### `CreditGrantRequest`

Supports `grantType='admin'` with:

- `amount`
- `grantedByUserId`
- `reason`

### Admin validation (service boundary)

| Field | Rule | Error |
|-------|------|-------|
| `amount` | explicit, number, integer, `> 0` | `INVALID_AMOUNT` — Admin grant amount must be a positive integer |
| `reason` | string, trimmed, non-empty | `INVALID_REASON` — Admin grant reason is required |
| `grantedByUserId` | string, trimmed, non-empty | `MISSING_GRANTED_BY_USER_ID` — Admin grant grantedByUserId is required |

Deferred to ADMIN-CONSOLE-01B (API layer) where applicable:

- amount ceiling
- UUID-format validation for `grantedByUserId`
- 500-char reason max

### Internal derivation (not caller-controlled)

| Path | `sourceType` | `provider` |
|------|--------------|------------|
| Admin | `admin` | `admin` |
| Existing (topup/subscription) | `webhook` | `stripe` |

---

## Transaction / Balance Semantics

Existing sanctioned `CreditGrantService` flow preserved:

- `source_event_id` pre-check
- transaction
- `FOR UPDATE` balance lock
- `balanceBefore`
- `balanceAfter = balanceBefore + amount`
- `credit_grants` audit row
- current balance update
- mark granted

Admin grant modifies **current balance only**.

Does **not** alter:

- `monthly_allocation`
- `rollover_balance`
- `plan_id`
- subscription
- billing period
- historical overflow
- prior deduction records

---

## Audit

`credit_grants` now supports durable fields:

- `granted_by_user_id`
- `reason`

Repository persists both. Non-admin paths use null defaults. Admin actor/reason are durable DB fields rather than opaque metadata.

---

## Idempotency

Existing `source_event_id` mechanism preserved:

1. pre-check
2. unique DB constraint
3. `23505` race fallback

Duplicate successful admin grant:

- no second balance mutation
- no second grant
- returns original `grantId` / `amount` / `balanceBefore` / `balanceAfter` with `status='duplicate'`

`CreditGrantResult` was intentionally **not** expanded in 01A.

---

## Validation Evidence (Step 3)

| Check | Result |
|-------|--------|
| `npx jest --testPathPatterns="credit-grant" --runInBand` | **PASS** — 7 suites, 113 tests, 0 failed |
| `npx tsc --noEmit` (api-gateway) | **PASS** |
| `npm run build` (api-gateway) | **PASS** |
| Existing topup/subscription credit-grant tests | **PASS** |
| Staging / database / Docker / provider action during implementation | **None** |

No behavioral regression detected in existing credit-grant paths.

---

## Acceptance Criteria — Final Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Migration `1772900000000-AddAdminGrantAuditColumns.ts`: idempotent `up()` adds `granted_by_user_id` (uuid nullable), `reason` (text nullable), `idx_credit_grants_granted_by` partial index; safe `down()` drops index then columns | ✓ PASS |
| 2 | CreditGrant entity maps `grantedByUserId` and `reason` | ✓ PASS |
| 3 | `CreditGrantRequest` grantType union includes `'admin'`; `amount`, `grantedByUserId`, `reason` fields present | ✓ PASS |
| 4 | Admin grant: amount must be explicit positive integer (service boundary) | ✓ PASS |
| 5 | Admin grant: reason required and non-empty (service boundary) | ✓ PASS |
| 6 | Admin grant: `grantedByUserId` required (service boundary) | ✓ PASS |
| 7 | Admin grant: `sourceType='admin'`, `provider='admin'` set internally — not caller-controlled | ✓ PASS |
| 8 | Admin grant: current balance incremented atomically | ✓ PASS |
| 9 | Admin grant: `monthly_allocation` unchanged | ✓ PASS |
| 10 | Admin grant: `rollover_balance` unchanged | ✓ PASS |
| 11 | Admin grant: plan/subscription unchanged | ✓ PASS |
| 12 | Admin grant: historical overflow not applied | ✓ PASS |
| 13 | `source_event_id` idempotency contract preserved (3-layer) | ✓ PASS |
| 14 | Existing topup/subscription_monthly/subscription_initial paths behaviorally unchanged | ✓ PASS |
| 15 | Focused tests pass: admin happy path, amount/reason/grantedByUserId validation, duplicate idempotency | ✓ PASS |
| 16 | `npx tsc --noEmit` passes for api-gateway | ✓ PASS |
| 17 | `npm run build` passes for api-gateway | ✓ PASS |
| 18 | `npm test` passes (credit-grant suite + migration spec) | ✓ PASS |
| 19 | No runtime/database/provider/Docker action during implementation | ✓ PASS |
| 20 | Staging migration execution deferred to a later approved deployment step | ✓ PASS (deferred by contract) |

**Acceptance criteria satisfied: 20 / 20.**

---

## What 01A Establishes / Does Not Establish

**01A establishes:**

- Source migration for admin audit columns + partial index
- Domain support for audited admin credit grants
- Service/repository persistence of `granted_by_user_id` + `reason`
- Focused test coverage and api-gateway tsc/build green

**01A does NOT establish:**

- Staging schema for admin audit columns (migration not applied)
- Admin credit grant HTTP API (ADMIN-CONSOLE-01B)
- Frontend admin console shell (ADMIN-CONSOLE-01C)
- Admin credit grant UI (ADMIN-CONSOLE-01D)
- Parent ADMIN-CONSOLE-01 completion
- PRIVATE-BETA-INVITE-01 authorization

---

## Parent / Downstream State

| Task | Status |
|------|--------|
| ADMIN-CONSOLE-01A | **COMPLETE AND LOCKED — 2026-08-07** |
| ADMIN-CONSOLE-01 (parent) | **ACTIVE** — 01A locked; 01B is exact next child |
| ADMIN-CONSOLE-01B | Exact next child — Authenticated Admin Credit Grant API |
| ADMIN-CONSOLE-01C / 01D / 01E | NOT STARTED |
| PRIVATE-BETA-INVITE-01 | **NOT STARTED** — blocked until ADMIN-CONSOLE-01 COMPLETE AND LOCKED |
| BILLING-READY-08 / 08A / 08B | COMPLETE AND LOCKED — not modified |
| PRIVATE-BETA-FUNCTIONAL-READINESS-04 | COMPLETE AND LOCKED — not modified |

---

## Locked Predecessors (Not Modified)

- `docs/BILLING-READY-08-CHECKPOINT.md`
- `docs/BILLING-READY-08A-CHECKPOINT.md`
- `docs/BILLING-READY-08B-CHECKPOINT.md`
- `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04-CHECKPOINT.md`
- Related locked BILLING-READY / FR-04 predecessor checkpoints

---

## Consolidation Confirmation

This Step 4 consolidation:

- Did **not** modify implementation code
- Did **not** create/run/revert migrations
- Did **not** modify database / staging / `.env`
- Did **not** use Docker / Postgres / Redis
- Did **not** restart services
- Did **not** make provider calls
- Did **not** commit or push Git

---

## Next Exact Step

**ADMIN-CONSOLE-01B** — Authenticated Admin Credit Grant API

Requires:

1. Explicit Keith approval for 01B implementation (per parent registration)
2. New window recommended for child slice start
3. Depends on ADMIN-CONSOLE-01A COMPLETE AND LOCKED (satisfied)

Admin credit grant staging validation remains blocked until the deferred migration is applied in a later approved ADMIN-CONSOLE deployment step.
