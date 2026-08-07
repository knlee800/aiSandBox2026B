# BILLING-READY-08A — QuotaGuard Browser-Session Bypass Checkpoint

**Task ID:** BILLING-READY-08A
**Parent:** BILLING-READY-08 — Free-Plan Credit Balance Provisioning
**Step:** Step 4A sub-fix — QuotaGuard browser-session bypass
**Status:** COMPLETE AND LOCKED — 2026-08-07
**Date:** 2026-08-07
**Author:** Cursor / Sonnet 4.6

---

## 1. Root Cause

During BILLING-READY-08 Step 4A (first controlled runtime smoke attempt), the execution pipeline reached `QuotaGuard` after `CreditBalanceGuard` passed. `QuotaGuard` implements the legacy Phase 21B API-key quota path. It validates identity and then checks and records request/token quota against the resolved `apiKeyId`.

Browser sessions do not carry a real API key. When no API key is present, the platform assigns the sentinel identity `apiKeyId === 'browser-session'`. `QuotaGuard` was not aware of this sentinel and treated it as a genuine API-key identity — applying legacy request quota checks, legacy token quota checks, and legacy usage recording against a non-existent API-key quota record.

This caused the execution pipeline to fail for browser users even after `CreditBalanceGuard` (the modern browser-user guard) had already passed.

---

## 2. Why Dashboard Quota and Legacy Quota Differed

**Dashboard quota** (modern, browser-user-targeted) is enforced by three separate guards:
- `CreditBalanceGuard` — checks credit balance row exists and is active
- `TokenQuotaGuard` — checks per-period token consumption against plan allocation
- `RateLimitGuard` — checks per-minute/per-hour request rate

These guards are designed for authenticated browser users and operate on user-scoped data.

**Legacy quota** (`QuotaGuard`) is the Phase 21B API-key quota path:
- Checks request quota against an API-key quota record
- Checks token quota against an API-key quota record
- Records request usage on the API-key quota record
- Records token usage on the API-key quota record

This path was designed for genuine external API-key holders (developer integrations), not browser sessions. It operates on `apiKeyId`-scoped data, not user-scoped data.

Browser users were never intended to flow through the legacy quota path. The modern guard trio (`CreditBalanceGuard` + `TokenQuotaGuard` + `RateLimitGuard`) replaces the legacy path for browser users entirely.

---

## 3. Shared `browser-session` API-Key Identity Problem

The sentinel value `apiKeyId === 'browser-session'` is assigned when:
- The request is authenticated as a browser session (cookie/session auth)
- No real API key is present in the request

`QuotaGuard` performed identity validation but did not distinguish between:
- A genuine external API-key holder (intended legacy quota target)
- A browser session carrying `apiKeyId === 'browser-session'` (not a legacy quota target)

As a result, browser sessions were subjected to legacy quota checks that had no corresponding quota record, causing the execution pipeline to fail after `CreditBalanceGuard` had already passed.

---

## 4. Exact Fix

In `QuotaGuard.canActivate()`:

After identity validation, the guard now checks:

```typescript
if (apiKeyId === 'browser-session') {
  // Browser sessions are governed by CreditBalanceGuard + TokenQuotaGuard + RateLimitGuard.
  // Skip all legacy Phase 21B API-key quota checks and usage recording.
  return true;
}
```

The bypass exits the guard early with `true` (allow) for all `browser-session` identities. No legacy quota check or usage recording occurs for browser sessions. The guard proceeds to legacy quota logic only for genuine API-key identities.

---

## 5. Browser-Session Bypass Behavior

When `apiKeyId === 'browser-session'`:

| Check | Behavior |
|-------|----------|
| Legacy request quota check | **SKIPPED** |
| Legacy token quota check | **SKIPPED** |
| Legacy request usage recording | **SKIPPED** |
| Legacy token usage recording | **SKIPPED** |
| Guard result | `true` (allow — passes to next guard) |

Modern browser-user enforcement remains fully active and unchanged:
- `CreditBalanceGuard` — runs before `QuotaGuard` in the guard chain
- `TokenQuotaGuard` — runs in the guard chain
- `RateLimitGuard` — runs in the guard chain

---

## 6. Genuine API-Key Behavior Preserved

For all requests where `apiKeyId !== 'browser-session'` (genuine external API-key identities):

- Legacy request quota check: **UNCHANGED**
- Legacy token quota check: **UNCHANGED**
- Legacy request usage recording: **UNCHANGED**
- Legacy token usage recording: **UNCHANGED**

No change to the legacy quota path for real API-key holders. The existing behavior is fully preserved.

---

## 7. Guard Ordering Preserved

The guard execution order is unchanged:

1. `AuthGuard` — authentication
2. `CreditBalanceGuard` — credit balance existence (browser users)
3. `TokenQuotaGuard` — per-period token quota (browser users)
4. `RateLimitGuard` — rate limiting (browser users)
5. `QuotaGuard` — legacy API-key quota (genuine API-key holders only, after this fix)

No guard was added, removed, or reordered.

---

## 8. Exact Files Changed

| File | Action |
|------|--------|
| `services/api-gateway/src/quota/quota.guard.ts` | MODIFIED — added `browser-session` bypass before legacy quota logic |
| `services/api-gateway/src/quota/__tests__/quota.guard.spec.ts` | MODIFIED — added focused tests for browser-session bypass behavior |
| `services/api-gateway/src/ai/__tests__/ai-execution-guards.integration.spec.ts` | MODIFIED — added integration assertions confirming browser-session bypasses legacy quota, genuine API-key identity retains legacy quota behavior |

---

## 9. Tests and Validation Results

| Validation | Result |
|-----------|--------|
| Focused tests — `quota.guard.spec.ts` | **PASS** |
| Integration tests — `ai-execution-guards.integration.spec.ts` | **PASS** |
| Total test suites | 2 |
| Total tests | 52 |
| `npx tsc --noEmit` | **PASS** |
| `npm run build` | **PASS** |
| Lint diagnostics | **PASS** |

---

## 10. No Frontend / Billing / Token-Quota / Rate-Limit Changes

The following files and systems were **not modified**:

- Frontend source — no change
- `CreditBalanceGuard` — no change
- `TokenQuotaGuard` — no change
- `RateLimitGuard` — no change
- Billing service / credit ledger — no change
- Auth service / registration paths — no change
- Any previously locked BILLING-READY-08 checkpoint (2a, 2b, Step 3) — not modified

---

## 11. Runtime Execution Remains Disabled

`GLOBAL_EXECUTION_ENABLED` remained `false` throughout this implementation step.

No runtime inference occurred. No AI provider API was called. No database mutation occurred. No environment variable was changed. No staging deployment was performed.

This fix is source-only. It requires a staging commit/push and deployment before the controlled runtime retry can proceed.

---

## 12. Step 4A Previous Smoke Remains FAIL

The BILLING-READY-08 Step 4A controlled runtime smoke attempt failed because of the `QuotaGuard` browser-session identity problem documented in this checkpoint. That smoke remains recorded as FAIL.

This checkpoint documents the resolution of that specific blocker. The Step 4A FAIL result stands and is not retroactively changed.

---

## 13. One Controlled Runtime Retry Still Required

After staging commit/push and deployment of this fix, one controlled runtime retry is required to verify:

- Authenticated browser execute request returns HTTP 200 (not 402/403/500)
- Credit deduction recorded
- `smoke-test.txt` created in workspace
- Kill switch restored: `GLOBAL_EXECUTION_ENABLED=false`

This retry requires separate Keith approval before execution.

---

## 14. No Users Invited

No private-beta users were invited. `PRIVATE-BETA-INVITE-01` remains NOT REGISTERED.

---

## 15. Exact Next Action

1. **Commit and push 08A source changes** (`quota.guard.ts`, `quota.guard.spec.ts`, `ai-execution-guards.integration.spec.ts`) to `origin/main`.
2. **Staging deployment** — pull and rebuild API Gateway on staging.
3. **Controlled runtime retry** (Step 4B) — requires separate Keith approval:
   - Operator sets `GLOBAL_EXECUTION_ENABLED=true`
   - Submit bounded AI prompt
   - Verify HTTP 200, credit deduction, file creation
   - Operator restores `GLOBAL_EXECUTION_ENABLED=false`
4. **BILLING-READY-08 Step 4 consolidation checkpoint** after successful retry.
5. **FR-04 Step 3c block cleared** after BILLING-READY-08 Step 4 consolidation.

---

## Locked Predecessors Not Modified

- `docs/BILLING-READY-08-STEP-2A-CHECKPOINT.md` — COMPLETE AND LOCKED 2026-08-06 — not modified
- `docs/BILLING-READY-08-STEP-2B-CHECKPOINT.md` — COMPLETE AND LOCKED 2026-08-06 — not modified
- `docs/BILLING-READY-08-STEP-3-CHECKPOINT.md` — COMPLETE AND LOCKED 2026-08-07 — not modified
- All prior BILLING-READY-03/04/05 checkpoints — not modified
- `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04C-CHECKPOINT.md` — COMPLETE AND LOCKED 2026-08-06 — not modified

---

*Checkpoint created: 2026-08-07. BILLING-READY-08A COMPLETE AND LOCKED.*
