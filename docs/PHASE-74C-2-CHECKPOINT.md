# PHASE-74C-2-CHECKPOINT.md

## Metadata

**Phase:** 74  
**Stage:** 74C-2  
**Task ID:** TASK-74C-2  
**Title:** Reporting Contract Determinism Validation  
**Status:** COMPLETE  
**Date:** 2026-05-24  
**Nature:** VALIDATION / DOCUMENTATION (NO NEW IMPLEMENTATION)

---

## 1. Objective

Validate that existing visibility/reporting surfaces produce deterministic, reproducible, ordering-stable outputs suitable for commercial reporting use cases, within the bounded non-monetary family scope.

---

## 2. Endpoints Validated

Bounded to the surfaces listed in PHASE-74B-CHECKPOINT.md Section 5.

### A) Admin Visibility Surfaces (Internal Service Auth)

| Endpoint | Validation Target |
|----------|-------------------|
| `GET /api/internal/admin/users` | Ordering stability, field completeness, failure semantics |
| `GET /api/internal/admin/sessions` | Ordering stability, field completeness, failure semantics |

### B) User-Facing Usage/Quota Surfaces (JWT-Authenticated)

| Endpoint | Validation Target |
|----------|-------------------|
| `GET /api/users/me/usage` | Field completeness, time-of-request variability, failure semantics |
| `GET /api/users/me/quotas` | Field completeness, time-of-request variability, failure semantics |
| `GET /api/sessions?includeTerminated=true` | Ordering stability, field completeness |
| `GET /api/users/me` | In-scope surface; no ordering/determinism concerns on single-record endpoint |

### C) Runtime/Operational Visibility Surfaces (Internal Service Auth)

| Endpoint | Validation Target |
|----------|-------------------|
| `GET /api/runtime/metrics` | Field completeness, expected time-of-request variability |
| `GET /api/internal/stats` | Container-manager endpoint; called by api-gateway runtime metrics path |

---

## 3. Ordering Stability Findings

### A) `GET /api/internal/admin/users`

**Source:** `AdminDashboardService.getAdminUsers()` in `services/api-gateway/src/admin/admin-dashboard.service.ts`

**Finding: PASS — Deterministic ordering established.**

- Primary DB query uses `order: { createdAt: 'DESC' }` via `userRepository.find(...)`.
- Post-filter operations (`search` substring filter, `quotaStatus` filter) do not re-sort; established order is preserved.
- All derived fields (`estimatedCost`, `quotaStatus`) are computed deterministically from the DB-returned usage data and static thresholds (`QuotaConfig`), with no random or non-deterministic inputs.
- Spec test (`reporting-contract-determinism.spec.ts`) confirms ordering: repeated calls with identical mock inputs produce identical user order `['user-2', 'user-1']`.

### B) `GET /api/internal/admin/sessions`

**Source:** `AdminDashboardService.getAdminSessions()` in `services/api-gateway/src/admin/admin-dashboard.service.ts`

**Finding: PASS — Deterministic ordering established.**

- Query builder uses `.orderBy('session.createdAt', 'DESC')`.
- All filter conditions (`userId`, `status`, `dateRange`, `startDate`, `endDate`) add `andWhere` clauses but do not alter the established sort.
- Spec test confirms ordering: repeated calls with identical mock inputs produce identical session order `['session-b', 'session-a']`.

### C) `GET /api/sessions?includeTerminated=true` (user-facing)

**Source:** `SessionRepository.findByUser()` in `services/api-gateway/src/repositories/session.repository.ts`

**Finding: PASS — Deterministic ordering established.**

- When `includeTerminated=true`, uses `repository.find({ where: { userId }, order: { createdAt: 'DESC' } })`.
- When `includeTerminated=false` (active only), delegates to `findActiveByUser()` which also uses `order: { createdAt: 'DESC' }`.
- Spec test confirms ordering stability: repeated calls with identical mock inputs produce identical session list.

---

## 4. Field Completeness Findings

### A) `AdminUserSummaryDto` (15 fields)

**Contract defined in:** `services/api-gateway/src/admin/dto/admin-users-response.dto.ts`

Fields: `userId`, `email`, `role`, `planCode`, `planName`, `planType`, `planStatus`, `isActive`, `activeSessions`, `totalSessions`, `sessionsCreated24h`, `tokensUsed24h`, `estimatedCost`, `quotaStatus`, `createdAt`

**Finding: PASS — All 15 fields are always present.**

- `planCode`/`planName` fall back to the raw `planType` string and `QuotaConfig` defaults if the plan record is not found.
- `planStatus` defaults to `'active'` if the stored value is null/empty.
- `activeSessions`, `totalSessions`, `sessionsCreated24h` default to `0` if no session stats row exists for the user.
- `tokensUsed24h` defaults to `0` if no usage records exist in the 24h window.
- `estimatedCost` is always computed (can be `0.0` but never undefined/null).
- `quotaStatus` is always one of `'OK' | 'WARN' | 'EXCEEDED'`.
- `createdAt` is always the stored ISO 8601 string.
- Spec test asserts exact sorted field set on `adminUsersFirst.users[0]`.

### B) `AdminSessionVisibilityDto` (9 fields)

**Contract defined in:** `services/api-gateway/src/admin/dto/admin-sessions-response.dto.ts`

Fields: `sessionId`, `userId`, `userEmail`, `status`, `isTerminated`, `terminationReason`, `createdAt`, `lastActivityAt`, `expiresAt`

**Finding: PASS — All 9 fields are always present.**

- `userEmail` defaults to `''` if the joined user record is absent.
- `terminationReason` is explicitly `null` when not set (correctly typed `string | null`).
- `isTerminated` is always a boolean derived from `!!session.terminatedAt`.
- `createdAt`, `lastActivityAt`, `expiresAt` are always ISO 8601 strings (stored timestamps, not computed at request time).
- Spec test asserts exact sorted field set on `adminFirst.sessions[0]`.

### C) `UserUsageResponseDto` (5 fields)

**Contract defined in:** `services/api-gateway/src/users/dto/user-usage-response.dto.ts`

Fields: `activeSessions`, `sessionsCreated24h`, `tokensUsed24h`, `estimatedCost`, `resetAt`

**Finding: PASS — All 5 fields are always present.**

- `resetAt` is correctly typed `string | null` and will be `null` when no usage records exist in the 24h window. This is documented contract behavior, not unexpected variability.
- All numeric fields are always present (never undefined).

### D) `UserQuotasResponseDto` (10 fields)

**Contract defined in:** `services/api-gateway/src/users/dto/user-quotas-response.dto.ts`

Fields: `planCode`, `planName`, `planStatus`, `maxActiveSessions`, `currentActiveSessions`, `maxSessions24h`, `currentSessions24h`, `maxTokens24h`, `currentTokens24h`, `resetAt`

**Finding: PASS — All 10 fields are always present.**

- Plan resolution falls back to `QuotaConfig` defaults if no plan record found.
- `planStatus` is normalized to `'active' | 'cancelled' | 'expired'` — never an unexpected value.
- `resetAt` follows the same null-when-no-usage contract as `UserUsageResponseDto`.

### E) `GET /api/runtime/metrics` — `RuntimeMetrics`

**Contract defined in:** `services/api-gateway/src/runtime/runtime.service.ts`

Fields: `activeSessionCount`, `runningContainerCount`, `terminatedSessionCount`, `terminationReasons`, `serviceUptimeSeconds`, `dockerConnectivity`, `databaseConnectivity`, `timestamp`

**Finding: PASS — All 8 fields are always present.**

- On container-manager connectivity failure, `runningContainerCount` defaults to `0` and `dockerConnectivity` to `false`.
- On DB query failure, all counts default to `0` and `terminationReasons` to `[]`.
- `timestamp` is time-of-request — see Section 5.

### F) `GET /api/internal/stats` (container-manager)

**Note:** This endpoint is served by the container-manager service (`InternalStatsController`), not by the api-gateway. The api-gateway calls it via `ContainerManagerHttpClient` as part of the `GET /api/runtime/metrics` path.

Fields: `dockerConnectivity`, `runningContainerCount`, `timestamp`

**Finding: PASS — Fields are always present; behavior is consistent with a runtime health endpoint.**

---

## 5. Time-of-Request Variability Findings

**Finding: PASS — No unexpected time-of-request variability detected.**

All variability observed is expected and documented:

| Field / Source | Variability Type | Classification |
|----------------|-----------------|----------------|
| `resetAt` (usage, quotas) | Derived from oldest 24h usage record timestamp + 24h offset | **Expected rolling-window behavior** |
| `estimatedCost` | Derived from rolling 24h `tokensUsed24h` | **Expected rolling-window behavior** |
| `quotaStatus` | Derived from rolling 24h usage signals | **Expected rolling-window behavior** |
| `sessionsCreated24h`, `tokensUsed24h` | Rolling 24h window sums | **Expected rolling-window behavior** |
| `twentyFourHoursAgo` boundary (admin users/sessions queries) | Computed fresh per request | **Expected rolling-window behavior** |
| `serviceUptimeSeconds` (`/api/runtime/metrics`) | Increases monotonically | **Expected for health/diagnostic endpoint** |
| `timestamp` (`/api/runtime/metrics`, `/api/internal/stats`) | Time-of-request ISO 8601 | **Expected for health/diagnostic endpoint** |

No fields were found that introduce non-deterministic variability for a given fixed database state (beyond the expected rolling-window and health-endpoint patterns above).

---

## 6. Failure Semantics Findings

**Finding: PASS — Consistent failure semantics confirmed across user-facing and admin-facing surfaces.**

| Surface | Trigger | Exception | HTTP Status |
|---------|---------|-----------|-------------|
| `GET /api/users/me/usage` | User not found / inactive | `UnauthorizedException` | 401 |
| `GET /api/users/me/quotas` | User not found / inactive | `UnauthorizedException` | 401 |
| `GET /api/internal/admin/users?quotaStatus=INVALID` | Invalid enum value | `BadRequestException` | 400 |
| `GET /api/internal/admin/sessions?status=INVALID` | Invalid enum value | `BadRequestException` | 400 |
| `GET /api/internal/admin/sessions?startDate=INVALID` | Unparseable ISO date | `BadRequestException` | 400 |
| `GET /api/internal/admin/sessions?endDate=INVALID` | Unparseable ISO date | `BadRequestException` | 400 |
| `GET /api/runtime/metrics` (DB failure) | Fail-soft | Defaults to zero counts | 200 |
| `GET /api/runtime/metrics` (container-manager failure) | Fail-soft | Defaults to 0 containers, false connectivity | 200 |

**Coherence observation:** The user-facing surfaces throw hard `UnauthorizedException` for invalid identity (appropriate for user-controlled auth surface). The admin surfaces throw `BadRequestException` for invalid filter parameters (appropriate for operator-controlled internal surface). This asymmetry is correct and intentional.

All four primary user/admin failure cases are verified by the spec test (`reporting-contract-determinism.spec.ts`, test: `'preserves failure semantics consistently across reporting surfaces'`).

---

## 7. Tests Executed

**Pre-existing test suite validated:**

File: `services/api-gateway/src/admin/__tests__/reporting-contract-determinism.spec.ts`

```
npx jest reporting-contract-determinism --no-coverage
```

Result:

- ✅ 1 suite passed
- ✅ 3 tests passed
- ✅ 0 failed

Test coverage:

1. `keeps admin/user reporting outputs ordering-stable and field-complete` — covers `GET /api/internal/admin/users` ordering, field completeness (15 fields asserted), and `GET /api/users/me/usage` / `GET /api/users/me/quotas` determinism
2. `keeps includeTerminated and admin sessions ordering-stable and field-complete` — covers `GET /api/internal/admin/sessions` ordering, field completeness (9 fields asserted), and `GET /api/sessions?includeTerminated=true` ordering
3. `preserves failure semantics consistently across reporting surfaces` — covers `UnauthorizedException` on user surfaces and `BadRequestException` on admin surfaces

---

## 8. Gaps and Follow-ups

### Gap-74C-2-001: Debug Instrumentation Artifacts in `session.controller.ts` (Non-blocking)

**Location:** `services/api-gateway/src/sessions/session.controller.ts`, method `execInSession`, lines 174, 198, 208

**Description:** Three `fetch` calls to `http://127.0.0.1:7870/ingest/eba94f28-6765-4a01-9905-123e592de80f` remain in the `execInSession` handler. These are debug instrumentation fragments from a prior debugging session that were not removed.

**Risk:**
- Hardcoded localhost address in production source code
- Debug-only external call pattern in a production handler
- Generates fire-and-forget HTTP calls on every `exec` invocation (silently swallowed via `.catch(() => {})`, so no runtime failure, but adds noise)
- Does not affect reporting contract determinism for the bounded family surfaces
- Out of scope for this validation task

**Recommendation:** Register a bounded cleanup task to remove the debug instrumentation from `session.controller.ts` `execInSession` before a production deployment.

**Blocking for TASK-74C-2?** No. This endpoint (`POST /api/sessions/:id/exec`) is outside the bounded endpoint list for this family. TASK-74C-2 is not blocked.

---

## 9. Files Changed

**No source files were changed.**

Files created:
- `docs/PHASE-74C-2-CHECKPOINT.md` (this file)

Governance files updated:
- `TASKS.md` — TASK-74C-2 status updated to COMPLETE and LOCKED
- `TASKS_BACKLOG_FULL.md` — TASK-74C-2 status updated to COMPLETE and LOCKED

---

## 10. Preserved Invariants

- ✅ Existing endpoints only — no new endpoints or surfaces created
- ✅ No source code changes
- ✅ No schema changes
- ✅ No new service boundaries
- ✅ No background-worker patterns
- ✅ No monetization scope expansion
- ✅ No architecture expansion
- ✅ No broader refactors
- ✅ `PRD.md` and `ARCHITECTURE.md` remained higher authority
- ✅ Minimal diff only (governance updates only)

---

## 11. Explicit Out-of-Scope Confirmation

- No billing changes
- No subscription changes
- No invoicing/tax/accounting scope
- No new endpoints
- No refactors outside this bounded validation slice
- No frontend changes
- No backend code changes of any kind

---

## 12. Validation Conclusion

**Reporting contract determinism is confirmed for all bounded surfaces.**

All validation dimensions passed:
- ✅ Ordering stability: `GET /api/internal/admin/users` (createdAt DESC), `GET /api/internal/admin/sessions` (createdAt DESC), `GET /api/sessions?includeTerminated=true` (createdAt DESC) — all deterministic
- ✅ Field completeness: All DTO contracts are fully populated on every response path, with correct fallback behavior for absent records
- ✅ Time-of-request variability: No unexpected variability found; all observed variability is expected rolling-window or health-endpoint behavior
- ✅ Failure semantics: Consistent and correct across user-facing (UnauthorizedException) and admin-facing (BadRequestException) surfaces
- ✅ Pre-existing spec suite passes: 3/3 tests pass in `reporting-contract-determinism.spec.ts`
- ✅ One non-blocking gap documented (Gap-74C-2-001) — does not affect this family's bounded surfaces and does not block completion

One non-blocking gap (debug instrumentation artifact in `session.controller.ts`) was identified and documented for follow-up. It does not affect the reporting contract determinism of the bounded family surfaces and does not block TASK-74C-2 completion.

---

## 13. Sign-Off

**Task:** TASK-74C-2  
**Status:** COMPLETE  
**Checkpoint:** `docs/PHASE-74C-2-CHECKPOINT.md`
