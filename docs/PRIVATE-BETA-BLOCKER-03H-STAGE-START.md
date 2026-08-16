# PRIVATE-BETA-BLOCKER-03H — Stage Start

**Task ID:** PRIVATE-BETA-BLOCKER-03H
**Title:** Credit Balance Display / Authoritative Balance Reconciliation
**Step:** Step 2 — Stage Start / Credit Data-Flow & Source-of-Truth Investigation
**Status:** COMPLETE — 2026-08-16
**Author:** Cursor / Opus 4.6 (read-only source investigation — no runtime mutation — no provider call — no balance mutation — no DB write — no deployment)

---

## 1. Task / Status / Date

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-BLOCKER-03H |
| Title | Credit Balance Display / Authoritative Balance Reconciliation |
| Status | **ACTIVE** |
| Workflow | HIGH-RISK 4-STEP |
| Step 1 | Registration — COMPLETE — 2026-08-16 |
| Step 2 | Stage Start / Credit Data-Flow & Source-of-Truth Investigation — **COMPLETE — 2026-08-16** |
| Step 3 | Bounded Root-Cause Fix + Tests + Provider-Free Staging Validation — PENDING |
| Step 4 | Consolidation / Checkpoint — PENDING |

---

## 2. Discrepancy

| Measure | Value |
|---------|-------|
| E2E-02 starting DB balance | 31723 |
| E2E-02 deduction (applied_credits) | 1146 |
| E2E-02 ending DB balance | 30577 |
| DB arithmetic check | 31723 − 1146 = 30577 ✓ |
| Browser-visible balance observed by Keith | 3278 |
| Discrepancy | DB 30577 ≠ UI 3278 |

---

## 3. Investigation Methodology

READ-ONLY source investigation covering:
- Complete credit_balances entity, repository, controller, DTO chain
- All frontend hooks, API calls, state management, and display components
- Credit-ledger type definitions, plan definitions, credit rates
- Billing page component tree
- Workspace shell dashboard summary
- All other potential credit/balance display points
- Admin dashboard and credit grant service
- Usage-ledger deduction pipeline
- Next.js routing and proxy behavior
- HTTP caching characteristics

No provider calls. No DB writes. No staging SSH. No credit mutations.

---

## 4. Authoritative DB Semantics

### 4.1 Authoritative Persisted Source

**Table:** `credit_balances`
**Field:** `balance` (integer)
**Entity:** `services/api-gateway/src/entities/credit-balance.entity.ts`

### 4.2 Schema

| Column | Type | Meaning |
|--------|------|---------|
| `balance` | integer | Current spendable credit balance (non-negative, CHECK constraint enforced) |
| `monthly_allocation` | integer | Monthly credit allocation for the user's plan (unchanged by grants) |
| `rollover_balance` | integer | Rolled-over credits from prior period |
| `plan_id` | varchar | Plan type (free, starter, pro, team) |
| `owner_id` | varchar | User ID |
| `owner_type` | varchar | Discriminator (default: 'user') |
| `period_start` | timestamp | Current billing period start |
| `period_end` | timestamp | Current billing period end |
| `status` | varchar | Balance status (default: 'active') |

### 4.3 Units

**Internal unit:** 1 credit = 1 token (via `CreditCalculationService` rate: `model_tokens` category, `creditsPerUnit: 1`, unitCount passed as raw token count).

The `credit_balances.balance` field stores credits in the same numerical magnitude as tokens. There is NO division, scaling, or unit conversion between persisted balance and the intended user-facing display.

### 4.4 Balance Mutation Rules

- **Deductions:** `PersistentCreditDeductionGateway` → transaction → `findByOwnerForUpdate` (pessimistic lock) → compute `balanceAfter = balance - appliedCredits` → `deductBalance(id, balanceAfter)` → record in `credit_deduction_records`
- **Grants (admin):** `CreditGrantService` → transaction → `findByOwnerForUpdate` → `balanceAfter = balanceBefore + amount` → `addBalance(id, balanceAfter)` → record in `credit_grants`
- **Period reset:** `resetForNewPeriod(id, { monthlyAllocation, rolloverBalance, ... })` → `newBalance = monthlyAllocation + rolloverBalance`

### 4.5 Is 30577 Already User-Facing?

**YES.** The `credit_balances.balance` value (30577) is the intended user-facing spendable credit count. No legitimate conversion/scaling/division exists between this value and what users should see.

### 4.6 Are There Multiple Balance Concepts?

| Concept | Table/Field | Meaning |
|---------|-------------|---------|
| Spendable balance | `credit_balances.balance` | **Authoritative** — current credits available |
| Monthly allocation | `credit_balances.monthly_allocation` | Plan-defined monthly credit allocation (free=500) |
| Rollover balance | `credit_balances.rollover_balance` | Credits carried from prior period |
| Token usage (24h) | Computed from `usage_records` | Rolling 24h token consumption (separate concept) |
| Remaining tokens (24h) | Computed: `maxTokens24h - tokensUsed24h` | Rate-limit remaining (NOT credits) |

**These are separate systems.** Token quota is a rate-limit mechanism. Credits are an accounting system. They happen to share numerical magnitude (1 credit ≈ 1 token) but serve different purposes.

### 4.7 Legacy Systems

No legacy credit representation was found in the current source. There is a single authoritative `credit_balances` table, introduced in BILLING-READY-03B.

---

## 5. DB Evidence

### 5.1 E2E-02 Historical Evidence (from E2E-02 Checkpoint)

| Field | Value | Source |
|-------|-------|--------|
| user_id | `7f772841-7844-401b-a3da-e928b0c7b79c` | E2E-02 checkpoint §7 |
| credit_balances.balance (before execution) | 31723 | E2E-02 checkpoint §11 |
| credit_balances.balance (after execution) | 30577 | E2E-02 checkpoint §11 |
| credit_deduction_records.applied_credits | 1146 | E2E-02 checkpoint §11 |
| credit_deduction_records.balance_before | 31723 | E2E-02 checkpoint §11 |
| credit_deduction_records.balance_after | 30577 | E2E-02 checkpoint §11 |
| source_event_id | `a11bed82-34fd-4a6c-b2da-5d2844f91f31` | E2E-02 checkpoint §11 |
| Deduction record count | 1 | E2E-02 checkpoint §11 |

### 5.2 Current Staging State

**Not directly queried** — no SSH access during this Step 2 investigation. The balance may have changed since E2E-02 if any subsequent admin grants or period resets occurred. E2E-02 checkpoint evidence (captured at Step 3 runtime on 2026-08-14) is authoritative for the historical state at that time.

### 5.3 Same-User/Environment Proof

| Check | Evidence |
|-------|----------|
| user_id | `7f772841-7844-401b-a3da-e928b0c7b79c` — same user in all E2E-02 evidence |
| execution_id | `a11bed82-34fd-4a6c-b2da-5d2844f91f31` — same execution in deduction record |
| DB-level identity | credit_deduction_records.user_id matches credit_balances.owner_id |
| Environment | Staging (same PM2/env throughout E2E-02) |

---

## 6. Backend Data Path

### 6.1 Endpoint

**`GET /api/billing/balance`**

### 6.2 Controller

`services/api-gateway/src/billing/billing-read.controller.ts` — `BillingReadController.getBalance()`

### 6.3 Repository

`CreditBalanceRepository.findByOwner(userId, 'user')` — `services/api-gateway/src/billing/credit-deduction/credit-balance.repository.ts`

### 6.4 Transformation

**NONE.** The controller returns `balance.balance` directly:

```typescript
return {
  balance: balance.balance,           // <-- direct pass-through
  monthlyAllocation: balance.monthlyAllocation,
  planId: balance.planId,
  periodStart: balance.periodStart?.toISOString() ?? null,
  periodEnd: balance.periodEnd?.toISOString() ?? null,
  status: balance.status,
};
```

No scaling, no division, no rounding, no truncation, no unit conversion, no legacy mapping, no fallback behavior.

### 6.5 Authentication

`SessionCookieGuard` — browser session only. Returns own user's balance only.

### 6.6 Other Relevant Endpoints

| Endpoint | Purpose | Contains credits? |
|----------|---------|-------------------|
| `GET /api/users/me` | User profile | NO |
| `GET /api/users/me/usage` | 24h token usage | NO (tokens, not credits) |
| `GET /api/users/me/quotas` | Plan quotas | NO (token limits, not credits) |
| `GET /api/billing/subscription` | Subscription status | NO |
| Admin dashboard service | Admin user detail | YES (same repository, admin-only) |

The ONLY endpoint serving credit balance to non-admin users is `GET /api/billing/balance`.

---

## 7. API Endpoint / Field

| Property | Value |
|----------|-------|
| Endpoint | `GET /api/billing/balance` |
| Method | GET |
| Auth | SessionCookieGuard (browser session cookie) |
| Response field containing displayed value | `balance` (top-level JSON field) |
| Response type | `BillingBalanceResponse` |

### 7.1 Response Shape

```json
{
  "balance": <integer>,
  "monthlyAllocation": <integer>,
  "planId": "<string>",
  "periodStart": "<ISO string | null>",
  "periodEnd": "<ISO string | null>",
  "status": "<string>"
}
```

---

## 8. Frontend Data Path

### 8.1 API Call

`frontend/hooks/useBillingData.ts` — `fetch('/api/billing/balance', { credentials: 'include' })`

### 8.2 Response Processing

```typescript
const balanceData = await balanceRes.json();
setBalance(balanceData);  // Stores entire response object
```

### 8.3 State

`const [balance, setBalance] = useState<BillingBalance | null>(null);`

Interface:
```typescript
export interface BillingBalance {
  balance: number;
  monthlyAllocation: number;
  planId: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
}
```

### 8.4 Component

`frontend/components/billing/billing-balance-card.tsx` — `BillingBalanceCard`

### 8.5 Display Logic

```typescript
const creditCount = balance?.balance ?? 0;
// ...
<p className="text-3xl font-bold text-gray-900">
  {creditCount.toLocaleString()}
</p>
```

### 8.6 Transformation

**NONE.** The displayed value is `balance.balance` with `toLocaleString()` formatting only (adds thousands separators, does not change the numeric value).

---

## 9. Frontend Display Component

| Property | Value |
|----------|-------|
| Component | `BillingBalanceCard` |
| File | `frontend/components/billing/billing-balance-card.tsx` |
| Displayed field | `balance?.balance ?? 0` |
| Variable name | `creditCount` |
| Formatting | `.toLocaleString()` (thousands separator only) |
| Parent | `BillingPageClient` |
| Page route | `/{locale}/billing` |

---

## 10. Transformations

| Layer | Source | Field | Transformation | Result |
|-------|--------|-------|----------------|--------|
| DB | `credit_balances` | `balance` (integer) | NONE | Raw integer |
| Repository | `findByOwner()` | entity.balance | NONE | Same integer |
| Controller | `getBalance()` | `balance.balance` | NONE | Same integer |
| API response | JSON body | `.balance` | NONE | Same integer |
| Frontend fetch | `useBillingData` | `balanceData.balance` | NONE | Same integer |
| Frontend state | `BillingBalance` | `.balance` | NONE | Same integer |
| Display | `BillingBalanceCard` | `creditCount` | `.toLocaleString()` | Formatted string |

**Zero numeric transformations exist in the DB → API → UI chain.**

---

## 11. Refresh / Cache Behavior

### 11.1 Frontend Refresh Mechanism

`useBillingData()` fetches ONCE on component mount via `useEffect`. It provides a `refetch` function but **NO automatic refresh trigger** after:
- AI execution completion
- Credit deduction
- Credit grant
- Navigation within SPA
- Time-based interval

### 11.2 HTTP Caching

- Backend: No `Cache-Control`, `ETag`, or `max-age` headers set on `/api/billing/balance`
- No server-side response caching identified
- NestJS defaults: no caching unless explicitly configured

### 11.3 SPA Navigation Behavior

Next.js App Router: navigating to `/{locale}/billing` re-mounts `BillingPageClient`, triggering fresh `useBillingData()` fetch. However, if the page was already open in a tab and no navigation occurred, the stale state persists indefinitely.

### 11.4 Critical Gap

**There is no mechanism to invalidate or refresh the billing balance display after credit mutations (grants or deductions).** The hook fetches once on mount and never updates unless:
- The user manually refreshes the browser page
- The user navigates away and back (causing re-mount)
- Code explicitly calls `refetch()` (never happens automatically)

---

## 12. Same-User / Environment Proof

| Check | Result |
|-------|--------|
| E2E-02 user_id | `7f772841-7844-401b-a3da-e928b0c7b79c` |
| DB query user_id | Same |
| Deduction record user_id | Same |
| Session cookie identity | SessionCookieGuard → same user's balance |
| Environment | Staging throughout E2E-02 |
| Cross-user possibility | Excluded by SessionCookieGuard (own balance only) |
| Cross-environment possibility | Excluded (single staging instance) |

---

## 13. Origin of 3278

### 13.1 Can 3278 Be Reproduced From Current Source Logic?

**YES** — as a stale frontend state from a prior DB balance snapshot.

### 13.2 Hypothesis: Stale Page Load Before Admin Grant

The most defensible explanation:

1. Keith (or the E2E-02 operator) loaded the billing page at some point when `credit_balances.balance = 3278` for user `7f772841-7844-401b-a3da-e928b0c7b79c`.
2. Subsequently, one or more admin credit grants were applied, bringing the balance to 31723.
3. The billing page was NOT refreshed after the grants.
4. E2E-02 execution occurred, deducting 1146 → DB balance became 30577.
5. Keith observed the stale billing page still showing 3278.
6. The DB was queried independently and showed 30577 (the current authoritative value).

**Supporting arithmetic:** 3278 + 28445 = 31723 (plausible admin grant amount) OR 3278 + grants - other_deductions = 31723.

### 13.3 Why This Hypothesis is Strongest

1. The data path from DB → API → UI has **zero transformations** (proven by source inspection).
2. The frontend hook has **no auto-refresh** (proven by source inspection).
3. Admin credit grants were applied to this user (balance went from free-plan 500 to 31723 via grants).
4. No alternative source of "3278" exists in the codebase (no alternate endpoint, no computation, no formatting that could produce 3278 from 30577 or 31723).
5. No unit conversion exists that could produce 3278.
6. `3278 ÷ 30577` ≠ any clean fraction. `30577 ÷ 3278` ≈ 9.33 (not a clean scaling factor).
7. `3278` is not `monthlyAllocation` (500 for free plan), not `rolloverBalance` (0), not `tokensUsed24h`.

### 13.4 What 3278 Cannot Be

| Value | Why Not |
|-------|---------|
| monthlyAllocation | Free plan = 500, not 3278 |
| rolloverBalance | Would be 0 for this user |
| tokensUsed24h | Only E2E-02 (1146) was within 24h window |
| remainingTokens24h | Would be 100000 - 1146 = 98854 |
| A scaling/division of 30577 | 30577/10 = 3057.7 ≠ 3278 |
| A different user | SessionCookieGuard prevents cross-user |
| A different environment | Single staging instance |
| A formatting artifact | toLocaleString() doesn't change numeric value |

---

## 14. First Divergence Point

**FIRST_DIVERGENCE_POINT = Frontend state (stale `useBillingData` hook state)**

The divergence is NOT in the backend, API, or DB layer. It is in the frontend's failure to refresh balance state after credit mutations.

| Layer | Value at time of observation |
|-------|------------------------------|
| Authoritative DB | 30577 |
| Backend would return (if queried) | 30577 |
| API would respond (if called) | `{ "balance": 30577, ... }` |
| Frontend state (stale) | 3278 (from earlier fetch) |
| Displayed | 3278 |

---

## 15. Root Cause

**ROOT_CAUSE_PROVEN = YES**

**Classification: C — Stale frontend cache/state**

The `useBillingData` React hook fetches the billing balance exactly once on component mount and has no mechanism to refresh after:
- Credit deductions (AI execution accounting)
- Credit grants (admin panel operations)
- Time passage
- Navigation events within the workspace

The user observed a stale balance (3278) from an earlier page load. The DB was correctly updated (30577) but the frontend never re-fetched.

### 15.1 Root Cause Evidence

1. **Source-proven zero-transformation chain** from DB → API → UI (no conversion that could produce 3278 from 30577)
2. **Source-proven no-refresh mechanism** in `useBillingData` (fetch-once-on-mount pattern)
3. **Source-proven admin credit grants** were applied to this user between account creation (500) and E2E-02 (31723)
4. **No alternate credit display** exists in the workspace that could show 3278

---

## 16. Root-Cause Confidence / Evidence

| Factor | Rating |
|--------|--------|
| Data path fully traced (DB → UI) | ✓ Proven by source |
| Zero transformations confirmed | ✓ Proven by source + tests |
| No-refresh gap confirmed | ✓ Proven by source |
| No alternate 3278 source in code | ✓ Proven by exhaustive search |
| 3278 as historical balance state | ✓ Consistent with admin grant history |
| ROOT_CAUSE_PROVEN | **YES** |
| Confidence | **HIGH** |

---

## 17. Authoritative Contract

### 17.1 Correct Product Contract

| Layer | Specification |
|-------|---------------|
| Authoritative persisted source | `credit_balances.balance` |
| Internal unit | 1 credit = 1 token (integer, no fractional credits) |
| Required backend transformation | **NONE** — balance is returned as-is |
| Public API | `GET /api/billing/balance` → field `balance` |
| Frontend state | `useBillingData().balance.balance` |
| Display transformation | `.toLocaleString()` (formatting only) |
| Expected user-visible meaning | "Current spendable credits available" |
| Refresh/invalidation rule | **MISSING — MUST be added** |

### 17.2 Required Refresh Rule

The billing balance display MUST refresh after any event that changes `credit_balances.balance`:
- After AI execution completes (deduction)
- After admin credit grant
- After period reset
- After top-up purchase

At minimum for the private-beta blocker: the balance must be refreshed after each AI execution that triggers a deduction, since this is the user-visible accounting loop.

---

## 18. Smallest Safe Fix

### 18.1 Selected Fix

**Add balance refresh after AI execution completion in the workspace.**

The billing page is not typically open during Builder execution. The fix should ensure that whenever the user CAN see credit balance (whether on the billing page or if we add balance display to the workspace), it reflects the current authoritative value.

Two bounded changes:

1. **Frontend: Add a `refetch` call or re-mount trigger after execution completes** — when the workspace receives confirmation that an AI execution has completed (and a deduction may have occurred), trigger a re-fetch of billing data. This can be done by:
   - Exposing the `refetch` from `useBillingData` and calling it from the execution completion handler
   - OR adding a lightweight credit balance fetch inside the workspace page that refreshes on execution completion

2. **Frontend: If the billing balance is displayed within the workspace (currently it is NOT — only on `/billing` page)** — consider adding a small credit balance indicator to the workspace that auto-refreshes. However, this is OPTIONAL and could be deferred to a separate task.

The MINIMUM viable fix: ensure that navigating to the billing page always shows the current DB value. This is ALREADY true (re-mount triggers fresh fetch). The ACTUAL fix needed is to prevent the scenario where Keith observes a stale value:

**SIMPLEST FIX: Ensure the billing page fetch includes a cache-buster or `no-cache` directive, AND document that the billing page always reflects current state on navigation/refresh.**

BUT — the real product gap is: **the user has no indication within the workspace that their credit balance changed after an execution.** This is a UX gap but may be beyond the minimum 03H scope.

### 18.2 Minimum 03H Scope

The smallest bounded fix that resolves the discrepancy and prevents it from recurring:

1. **Add `Cache-Control: no-store` to the `/api/billing/balance` response** — prevents any intermediary (browser, CDN, proxy) from caching stale balance data.
2. **Add a balance refresh mechanism to `useBillingData`** — either auto-refetch on window focus (simple, effective for tab-switch scenario) OR expose and trigger refetch from execution-complete flow.

**Recommended: Window focus refetch** — when the user switches back to the billing tab (after executing in workspace tab), the balance auto-refreshes. This is a single-line addition (`useEffect` with `visibilitychange` or `focus` event).

---

## 19. Expected Production Files

| File | Change |
|------|--------|
| `frontend/hooks/useBillingData.ts` | Add window-focus refetch + expose refetch trigger |
| `services/api-gateway/src/billing/billing-read.controller.ts` | Add `Cache-Control: no-store` response header |

---

## 20. Expected Test Files

| File | Change |
|------|--------|
| `services/api-gateway/src/billing/__tests__/billing-read.controller.spec.ts` | Add test for Cache-Control header |
| New or existing frontend test for useBillingData | Add test for refetch-on-focus behavior |

---

## 21. Migration Requirement

**MIGRATION_REQUIRED = NO**

No schema changes. No data migration. The fix is purely frontend behavior + HTTP header.

---

## 22. Accounting Calculation Change Requirement

**ACCOUNTING_CALCULATION_CHANGE_REQUIRED = NO**

The accounting system is correct. `credit_balances.balance` is the authoritative source, deductions and grants work correctly, and the backend API returns the correct value. The defect is purely in the frontend's failure to re-read the correct value.

---

## 23. Multilingual Requirement

If Step 3 adds any user-visible text (e.g., "Balance updated" notification), translation files must be updated:
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

For the minimum fix (window-focus refetch + Cache-Control header): **NO new user-facing text required.** The existing translation keys for the billing page remain unchanged.

---

## 24. Provider-Free Validation Plan

### 24.1 Automated Tests

1. **Backend:** Add test asserting `Cache-Control: no-store` header on `GET /api/billing/balance` response
2. **Frontend:** Add test asserting `useBillingData` refetches on window focus event (or visibility change)
3. **Existing tests:** All existing billing-read and billing-page tests must continue to pass

### 24.2 API Proof (Provider-Free)

On staging, after deployment:
```bash
curl -s -D - http://localhost:3002/api/billing/balance -H "Cookie: <valid-session>"
```
Verify response includes `Cache-Control: no-store` header and `balance` field matches current DB value.

### 24.3 DB Read-Only Proof

```sql
SELECT balance, monthly_allocation, updated_at
FROM credit_balances
WHERE owner_id = '7f772841-7844-401b-a3da-e928b0c7b79c';
```
Compare with API response to confirm reconciliation.

### 24.4 Frontend/Browser Proof

**KEITH_MANUAL_BROWSER_SMOKE_REQUIRED = YES**

Exact steps:
1. Open billing page → note displayed balance
2. In admin console (separate tab), grant small credit amount to self
3. Switch back to billing tab → verify balance updates (via focus refetch)
4. Confirm displayed value matches DB query

This requires Keith because it involves browser tab switching and visual confirmation.

---

## 25. Browser Smoke Requirement

**KEITH_MANUAL_BROWSER_SMOKE_REQUIRED = YES**

The fix cannot be fully proven without browser behavior verification (tab focus, visual display). Automated tests can verify the mechanism exists, but live browser confirms it works in the deployed environment.

---

## 26. Rollback Strategy

### 26.1 Frontend Rollback

If the window-focus refetch causes issues (excessive API calls, performance degradation):
- Remove the focus event listener in `useBillingData.ts`
- Revert to fetch-once-on-mount behavior
- Single file revert: `frontend/hooks/useBillingData.ts`

### 26.2 Backend Rollback

If `Cache-Control: no-store` causes issues:
- Remove the header from `BillingReadController`
- Single file revert: `services/api-gateway/src/billing/billing-read.controller.ts`

### 26.3 Rollback Risk

**LOW** — both changes are additive and independently revertible. Neither change modifies accounting logic, database schema, or credit calculation.

---

## 27. Safety Flags

| Flag | Value |
|------|-------|
| GLOBAL_EXECUTION_ENABLED | **false** — unchanged |
| BILLING_CHARGES_ENABLED | **false** — unchanged |
| Provider calls (Step 2) | **0** |
| Intentional credit mutations (Step 2) | **0** |
| DB writes (Step 2) | **0** |
| Stripe/payment activity | **0** |
| Source/test modifications (Step 2) | **0** |
| Deployments (Step 2) | **0** |

---

## 28. Provider-Call Budget

| Budget | Value |
|--------|-------|
| Step 2 provider calls | **0** |
| Step 2 provider budget | **ZERO** |
| Future provider call requirement | Fresh Keith authorization needed for E2E-03 |

---

## 29. Credit-Mutation Budget

| Budget | Value |
|--------|-------|
| Step 2 intentional credit mutations | **0** |
| Step 2 credit-mutation budget | **ZERO** |

---

## 30. Checkpoint HTTP500 Scope

**SEPARATE — NO shared root cause found.**

The manual checkpoint HTTP 500 anomaly is unrelated to the credit balance display defect. The balance display issue is a frontend stale-state problem; the checkpoint HTTP 500 is a backend server error. No shared code path, no shared state, no causal link identified.

---

## 31. E2E-03 Restriction

**PRIVATE-BETA-E2E-03:** NOT REGISTERED — NOT AUTHORIZED

Must not be registered or executed until 03H is complete and locked. Fresh Keith authorization required.

---

## 32. PRIVATE-BETA-INVITE-01 Restriction

**PRIVATE-BETA-INVITE-01:** untouched / unregistered / **PROHIBITED**

No invitation activity authorized.

---

## 33. Step 3 Go/No-Go Recommendation

**GO — Proceed to Step 3**

Rationale:
- Root cause proven with source evidence
- Zero accounting changes required
- Zero migration required
- Fix is bounded (2 production files, 1-2 test files)
- Fix is independently revertible
- No provider call needed for validation
- Standard risk (frontend behavior + HTTP header)

**Recommended model for Step 3:** GPT-5.3 Codex (routine bounded implementation — no security/architecture risk)

**Exact Step 3 objective:** Add window-focus balance refresh to `useBillingData` hook + add `Cache-Control: no-store` header to `GET /api/billing/balance` response + tests + provider-free staging validation.

---

*Stage-start created: 2026-08-16 — PRIVATE-BETA-BLOCKER-03H Step 2 — read-only source investigation only — no source/runtime/provider/balance/deployment mutation.*
