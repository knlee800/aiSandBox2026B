# ADMIN-CONSOLE-01B — Checkpoint
## Authenticated Admin Credit Grant API

**Status:** COMPLETE AND LOCKED — 2026-08-07
**Task ID:** ADMIN-CONSOLE-01B
**Parent:** ADMIN-CONSOLE-01 (Private Beta Operator Console) — remains ACTIVE
**Family:** ADMIN CONSOLE / CREDIT GRANT API
**Workflow:** 3-step (registration → implementation → checkpoint)
**Checkpoint created:** 2026-08-07
**Implementation commit:** not recorded in this consolidation step (governance-only; no Git commit/push)

---

## Summary

ADMIN-CONSOLE-01B delivered the authenticated browser-admin credit grant API and admin user-detail credit balance read path.

- `POST /api/admin/users/:userId/credits` on `AdminOperationalController`
- Guards preserved: `SessionCookieGuard` + `AdminRoleGuard`
- Thin `AdminCreditGrantService` orchestrates target-user existence + `CreditGrantService.processGrant`
- `GET /api/admin/users/:userId` now includes locked `creditBalance` shape (or `null`)
- No frontend. No migration apply. No staging/runtime/provider action.

---

## Step Status

| Step | Result |
|------|--------|
| Step 1 Registration | COMPLETE — 2026-08-07 |
| Step 2 Implementation | COMPLETE — validated |
| Step 3 Checkpoint / Consolidation | COMPLETE — 2026-08-07 |

---

## Files Created / Modified (Implementation Evidence)

### Created

| File | Description |
|------|-------------|
| `services/api-gateway/src/admin/dto/admin-credit-grant.dto.ts` | Request/response DTOs |
| `services/api-gateway/src/admin/admin-credit-grant.service.ts` | Thin grant orchestration |
| `services/api-gateway/src/admin/admin-credit-grant.service.spec.ts` | Service unit coverage |

### Modified

| File | Description |
|------|-------------|
| `services/api-gateway/src/admin/admin-operational.controller.ts` | POST credits endpoint; actor extraction |
| `services/api-gateway/src/admin/admin-operational.controller.spec.ts` | Guard/DTO/HTTP contract tests |
| `services/api-gateway/src/admin/admin-dashboard.service.ts` | User-detail `creditBalance` read path |
| `services/api-gateway/src/admin/admin-dashboard.service.spec.ts` | creditBalance present/null coverage |
| `services/api-gateway/src/admin/admin.module.ts` | CreditGrantModule + CreditPersistenceModule + AdminCreditGrantService |
| `services/api-gateway/src/admin/dto/admin-users-response.dto.ts` | `AdminUserCreditBalanceDto` + detail field |

No other implementation files were changed for 01B.

---

## Delivered Contract

### Endpoint

`POST /api/admin/users/:userId/credits`

Authorization: `SessionCookieGuard` + `AdminRoleGuard`

### Request

```ts
{
  amount: number;          // @IsInt() @Min(1)
  reason: string;          // trimmed, non-empty, max 500
  idempotencyKey: string;  // @IsUUID()
}
```

Caller cannot control: `grantedByUserId`, `grantType`, `sourceType`, `provider`.

### Admin actor

`grantedByUserId = request.user.userId` only. Missing actor → 401.

### AdminCreditGrantService

1. Target user existence check
2. Unknown user → 404; `CreditGrantService` not called
3. `CreditGrantService.processGrant` with:
   - `ownerId` = path `:userId`
   - `grantType` = `'admin'`
   - `amount`, `reason`
   - `grantedByUserId` = authenticated admin
   - `sourceEventId` = `idempotencyKey` (1:1)

### Response

```ts
{
  grantId: string;
  status: 'granted' | 'duplicate' | 'failed';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
}
```

- No `grantedAt`
- No HTTP 409
- Failed `CreditGrantService` result remains HTTP 200 with `status:'failed'`

### Admin user detail

`GET /api/admin/users/:userId` includes:

```ts
creditBalance: {
  balance: number;
  monthlyAllocation: number;
  rolloverBalance: number;
  planId: string;
  status: string;
} | null
```

- Read path: `CreditBalanceRepository.findByOwner(userId, 'user')`
- No balance row → `creditBalance = null`
- Read does not create/mutate balance

---

## Optional CreditBalanceRepository Injection Gate — Verdict A (SAFE)

### Questions answered

| # | Question | Answer |
|---|----------|--------|
| 1 | Is `CreditBalanceRepository` guaranteed injected in real Nest runtime via `AdminModule`? | **YES** — `AdminModule` imports `CreditPersistenceModule`, which providers+exports `CreditBalanceRepository`. Nest resolves it into `AdminDashboardService`. |
| 2 | Can optional injection cause production service to silently run without the repository under any supported runtime/module path? | **NO** — Supported production path is `AppModule` → `AdminModule`. With locked imports, the provider is present; `@Optional()` does not suppress injection of an available provider. |
| 3 | If repository absent, what does current code do? | `getCreditBalanceForUser` returns `null` immediately (skip lookup). Same HTTP shape as “no balance row,” but this branch is only reachable when the provider is missing. |
| 4 | Is optional DI merely test compatibility? | **YES** — preserves older direct-instantiation / TestingModule specs that construct `AdminDashboardService` without supplying a credit-balance mock. |
| 5 | Would required injection be architecturally more correct? | **YES as fail-fast hardening** — boot would fail if `CreditPersistenceModule` were removed. Not required to claim current production correctness under locked wiring. |
| 6 | Could tests supply a mock instead? | **YES** — preferred if/when converting to required DI; not a current production blocker. |

### Decision

**A — optional DI is demonstrably safe and does not weaken production behavior under the locked module graph.**

Reasoning:

1. `CreditPersistenceModule` exports `CreditBalanceRepository`.
2. `AdminModule` imports that module and provides `AdminDashboardService`.
3. Nest injects available providers even when decorated `@Optional()`.
4. The only production Nest provider of `AdminDashboardService` is `AdminModule`.
5. Therefore production runtime receives the repository; optional DI does not create a supported silent-no-repo path.
6. Absent-repo → `null` exists for test/direct construction compatibility and unsupported miswiring, not for the locked AppModule path.

Required injection remains preferable fail-fast style, but is **not** a 01B completion blocker given locked module wiring and verified injection availability.

---

## Preserved Operational APIs

Unchanged:

- `GET /api/admin/users`
- `GET /api/admin/users/:userId` (extended with `creditBalance` only)
- `GET /api/admin/sessions`
- `DELETE /api/admin/sessions/:sessionId`

---

## Validation Evidence (Consolidation Re-run)

Focused:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --testPathPatterns="admin-operational|admin-credit-grant|admin-dashboard.service" --runInBand
```

**PASS:** 3 suites / 30 tests / 0 failed

TypeScript:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx tsc --noEmit
```

**PASS**

Build:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build
```

**PASS**

---

## Acceptance Criteria — Final Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `POST /api/admin/users/:userId/credits` on `AdminOperationalController` with SessionCookieGuard + AdminRoleGuard | ✓ PASS |
| 2 | Request DTO validates amount (positive integer), reason (trimmed non-empty, max 500), idempotencyKey (UUID) | ✓ PASS |
| 3 | `grantedByUserId` taken only from `request.user.userId` | ✓ PASS |
| 4 | Only mutation path is `CreditGrantService.processGrant({ grantType:'admin', ... })` | ✓ PASS |
| 5 | `sourceEventId` equals request `idempotencyKey` exactly | ✓ PASS |
| 6 | Response returns `grantId`, `status` (`granted`\|`duplicate`\|`failed`), `amount`, `balanceBefore`, `balanceAfter` — no `grantedAt` | ✓ PASS |
| 7 | Unknown target user → 404 before grant | ✓ PASS |
| 8 | Unauthenticated → 401; non-admin → 403; invalid body → 400 | ✓ PASS |
| 9 | Duplicate returns `status:'duplicate'` without double-credit | ✓ PASS |
| 10 | `GET /api/admin/users/:userId` includes locked `creditBalance` shape (or `null`) | ✓ PASS |
| 11 | AdminModule imports CreditGrantModule + CreditPersistenceModule without cycles | ✓ PASS |
| 12 | Focused tests for per-criterion items pass | ✓ PASS |
| 13 | `npx tsc --noEmit` and `npm run build` pass for api-gateway | ✓ PASS |
| 14 | No frontend/migration/staging/DB/provider/Docker action during implementation/consolidation | ✓ PASS |
| 15 | No role mutation capability added | ✓ PASS |

**Acceptance criteria satisfied: 15 / 15.**

---

## What 01B Establishes / Does Not Establish

**01B establishes:**

- Authenticated admin credit grant HTTP API
- Session-derived admin actor mapping
- Idempotent admin grant orchestration via existing CreditGrantService
- Admin user-detail credit balance read visibility
- Module wiring for CreditGrant + CreditPersistence in AdminModule

**01B does NOT establish:**

- Frontend admin console shell (ADMIN-CONSOLE-01C)
- Admin credit grant UI (ADMIN-CONSOLE-01D)
- Staging migration application for 01A audit columns
- Staging validation of admin credit grants
- Parent ADMIN-CONSOLE-01 completion
- PRIVATE-BETA-INVITE-01 authorization

---

## Parent / Downstream State

| Task | Status |
|------|--------|
| ADMIN-CONSOLE-01B | **COMPLETE AND LOCKED — 2026-08-07** |
| ADMIN-CONSOLE-01 (parent) | **ACTIVE** — 01A + 01B locked; exact next child **ADMIN-CONSOLE-01C** |
| ADMIN-CONSOLE-01A | COMPLETE AND LOCKED — 2026-08-07 (not modified) |
| ADMIN-CONSOLE-01C | Exact next child — Admin Console Shell + Users/Sessions |
| ADMIN-CONSOLE-01D / 01E | NOT STARTED |
| PRIVATE-BETA-INVITE-01 | **NOT STARTED** — blocked until ADMIN-CONSOLE-01 COMPLETE AND LOCKED |
| 01A staging migration | **SOURCE COMPLETE / NOT APPLIED** |

---

## Locked Predecessors (Not Modified)

- `docs/ADMIN-CONSOLE-01A-CHECKPOINT.md`
- `docs/BILLING-READY-08-CHECKPOINT.md`
- `docs/BILLING-READY-08A-CHECKPOINT.md`
- `docs/BILLING-READY-08B-CHECKPOINT.md`
- `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04-CHECKPOINT.md`
- Related locked BILLING-READY / FR-04 predecessor checkpoints

---

## Consolidation Confirmation

This Step 3 consolidation:

- Did **not** modify implementation code
- Did **not** create/run/revert migrations
- Did **not** modify database / staging / `.env`
- Did **not** use Docker / Postgres / Redis
- Did **not** restart services
- Did **not** make provider calls
- Did **not** commit or push Git

---

## Next Exact Step

**ADMIN-CONSOLE-01C** — Admin Console Shell + Users/Sessions

Depends on:

1. ADMIN-CONSOLE-01B COMPLETE AND LOCKED (satisfied)
2. Explicit Keith approval for 01C implementation (per parent registration)
3. New window recommended for child slice start

Admin credit grant staging validation remains blocked until the deferred 01A migration is applied in a later approved ADMIN-CONSOLE deployment / 01E step.
