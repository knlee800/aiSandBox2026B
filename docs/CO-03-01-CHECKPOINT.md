# CO-03-01 CHECKPOINT — Admin and Operational Completeness

## Task Metadata

| Field | Value |
|---|---|
| Task ID | CO-03-01 |
| Title | Admin and Operational Completeness |
| Family | CO-01 (Commercial Readiness) |
| Nature | IMPLEMENTATION (COMMERCIAL READINESS, ADMIN / OPERATIONAL COMPLETENESS) |
| Status | COMPLETE and LOCKED |
| Checkpoint | `docs/CO-03-01-CHECKPOINT.md` |
| Dependencies | CO-02-01 (Complete and Locked) |

---

## Objective Completed

Completed the minimal admin/operational layer needed to support coherent visibility into users, plans, and sessions, and added the smallest bounded operator action required for core support operations — admin session terminate — using existing termination semantics.

The work was additive and minimal:

**Backend:** The existing `AdminDashboardService` (TASK-68B-3) was extended with three new methods:

- `getAdminUserDetail(userId)` — returns user detail including activity summary, plan state (`planCode`, `planName`, `planStatus`), and a `quotas` block with plan-derived limits and current usage values.
- `terminateSessionAsAdmin(sessionId, adminActor)` — terminates a session using the identical `sessionService.terminateSession(sessionId, 'manual')` path and best-effort `containerManagerHttpClient.stopSession(sessionId)` call used by the existing user-facing DELETE endpoint; emits structured audit log events on success and on best-effort container stop failure.
- `toAdminUserSummary` / `resolvePlan` / per-user query helpers — private helpers extracted to produce a coherent, reusable user summary with plan state included.

The existing `AdminUserSummaryDto` was extended additively with `planCode`, `planName`, and `planStatus` fields. New `AdminUserQuotaVisibilityDto` and `AdminUserDetailDto` were added.

A new `AdminRoleGuard` was added that enforces `UserRole.ADMIN` role presence on the request user object after JWT auth. A new `AdminOperationalController` was added under the `admin` route prefix with `JwtAuthGuard` + `AdminRoleGuard` at controller level, exposing role-guarded variants of the admin user list, user detail, session list, and session terminate endpoints. The existing internal `AdminDashboardController` (under `internal/admin`, protected by `InternalServiceAuthGuard`) is unchanged.

`AdminModule` was updated to import `SessionModule` (for `SessionService` and `ContainerManagerHttpClient` already exported by it) and add `Plan` to `TypeOrmModule.forFeature`, and register `AdminOperationalController`.

**Tests:** The two existing cross-surface coherence specs (`cross-surface-visibility-coherence`, `reporting-contract-determinism`) required a one-line fix to pass the new `planRepository` argument to the `UsersService` constructor (added by CO-02-01). Four new spec files were added for the CO-03-01 slice.

---

## Exact Files Changed

### New files
- `services/api-gateway/src/guards/admin-role.guard.ts`
- `services/api-gateway/src/admin/admin-operational.controller.ts`
- `services/api-gateway/src/admin/admin-operational.controller.spec.ts`
- `services/api-gateway/src/guards/admin-role.guard.spec.ts`

### Modified files
- `services/api-gateway/src/admin/dto/admin-users-response.dto.ts` — added `planCode`, `planName`, `planStatus` to `AdminUserSummaryDto`; added `AdminUserQuotaVisibilityDto` and `AdminUserDetailDto`
- `services/api-gateway/src/admin/admin-dashboard.service.ts` — injected `Plan` repository, `ContainerManagerHttpClient`, `SessionService`; added `getAdminUserDetail`, `terminateSessionAsAdmin`, `toAdminUserSummary`, `resolvePlan`, `getSessionStatsForUser`, `getTokensUsed24hForUser`, `getPlanByCodeMap` helpers; updated `getAdminUsers` to include plan state in user summaries
- `services/api-gateway/src/admin/admin.module.ts` — added `SessionModule` import, added `Plan` to `TypeOrmModule.forFeature`, registered `AdminOperationalController`; removed redundant `ContainerManagerHttpClient` direct provider (now provided via `SessionModule`)
- `services/api-gateway/src/admin/admin-dashboard.service.spec.ts` — added `planRepository`, `ContainerManagerHttpClient`, `SessionService` mocks; updated user fixture to include `planStatus`; added `planCode`/`planName` assertions; added two new tests for `getAdminUserDetail` and `terminateSessionAsAdmin`
- `services/api-gateway/src/admin/admin-dashboard.controller.spec.ts` — updated user fixture to include `planCode`, `planName`, `planStatus` fields
- `services/api-gateway/src/admin/__tests__/admin-dashboard.integration.spec.ts` — added `planRepository`, `ContainerManagerHttpClient`, `SessionService` mocks; added `planCode` assertion
- `services/api-gateway/src/admin/__tests__/cross-surface-visibility-coherence.spec.ts` — added `usersPlanRepository` mock; fixed `UsersService` constructor call to pass three arguments (CO-02-01 change); added `planRepository`, `containerClient`, `adminSessionService` mocks for `AdminDashboardService`; added `planStatus` to user fixture
- `services/api-gateway/src/admin/__tests__/reporting-contract-determinism.spec.ts` — same constructor fix and additions as above; added `planCode`, `planName`, `planStatus` to field-completeness assertion

---

## Exact Tests Run and Results

- `services/api-gateway`: `npm test -- src/admin/admin-operational.controller.spec.ts src/guards/admin-role.guard.spec.ts src/admin/admin-dashboard.controller.spec.ts src/admin/admin-dashboard.service.spec.ts src/admin/__tests__/admin-dashboard.integration.spec.ts src/admin/__tests__/cross-surface-visibility-coherence.spec.ts src/admin/__tests__/reporting-contract-determinism.spec.ts`
  - First run: **FAIL** (2 suites failed — `cross-surface-visibility-coherence.spec.ts` and `reporting-contract-determinism.spec.ts` failed to run due to CO-02-01 `UsersService` constructor arity mismatch; 5 suites PASS, 18 tests passed)
  - Second run after fix: **PASS** (7 suites, 24 tests, 0 failures)
- `services/api-gateway`: `npm run build` → **PASS**
- `services/api-gateway`: `npm test -- src/sessions/session.controller.spec.ts src/projects/projects.controller.spec.ts src/conversations/conversation.controller.spec.ts` → **PASS** (3 suites, 34 tests, 0 failures)
- Changed-file lints (`ReadLints` on all touched files) → **no linter errors**

---

## No Migration Was Required

No database schema changes were made. All new behavior reads from existing `users`, `sessions`, `usage_records`, and `plans` tables already in place. No new migration file was added.

---

## Scope Statement

Scope stayed fully within CO-03-01. No broad backoffice suite. No analytics expansion. No payment-provider operations. No invoicing/tax/accounting workflows. No background workers. No auth redesign. No broad dashboard redesign. No refactors outside the strictly required plan-state injection and module wiring. No new entities.

---

## Preserved Behaviors

- **Session lifecycle (CREATED → ACTIVE → TERMINATED)** — Admin terminate calls `sessionService.terminateSession(sessionId, 'manual')` and `containerManagerHttpClient.stopSession(sessionId)` (best-effort), identical to the existing user-facing `DELETE /api/sessions/:id` path. TERMINATED is permanent and irreversible. No resurrection semantics changes.
- **JWT auth and ownership on non-admin endpoints** — All existing `JwtAuthGuard`-protected user/session/project/conversation/checkpoint endpoints are unchanged. No new public endpoints added.
- **Existing quota enforcement, token-usage tracking, and request-driven behavior** — `TokenQuotaGuard`, `SessionQuotaGuard`, `QuotaService`, and `UsageRecord` flows are unchanged. All admin/operational behavior is request-driven only; no polling, no timers, no background workers.
- **CO-01-01 quota/usage UX surfaces** — `DashboardSummary` quota indicator, `workspace-quota-usage.logic.ts` helpers, and request-driven dashboard refresh triggers are unchanged.
- **CO-02-01 plan state surfaces** — `GET /api/users/me` and `GET /api/users/me/quotas` plan state responses, frontend `Plan: <name> (<status>)` display, and sidebar active-sessions counter are unchanged.
- **All workspace/project/chat behavior (PR-01/02/03, AI-03, AI-04)** — Workspace, project, file-action, coherence, and chat persistence flows are unchanged.
- **Existing admin/internal endpoint separation** — The existing internal `AdminDashboardController` (under `/api/internal/admin`, protected by `InternalServiceAuthGuard` / `X-Internal-Service-Key`) is unchanged. The new `AdminOperationalController` is under `/api/admin`, protected by `JwtAuthGuard` + `AdminRoleGuard` — a distinct auth surface for admin users, not a merger of the internal service path.
- **Phase 41A metrics endpoint and Prometheus/Grafana monitoring stack** — `RuntimeController`, `RuntimeService`, and observability stack are unchanged.

---

## Delivered Capability

1. **Admin user list with plan state** — `GET /api/admin/users` (JWT + AdminRoleGuard) returns the existing `AdminUsersResponseDto` shape extended with `planCode`, `planName`, and `planStatus` for each user. Supports same `search` and `quotaStatus` filter params as the internal endpoint.

2. **Admin user detail with quota / usage / plan state** — `GET /api/admin/users/:userId` (JWT + AdminRoleGuard) returns `AdminUserDetailDto` with full user summary plus a `quotas` block showing plan-derived limits (`maxActiveSessions`, `maxSessions24h`, `maxTokens24h`) and current usage values (`currentActiveSessions`, `currentSessions24h`, `currentTokens24h`).

3. **Admin session visibility** — `GET /api/admin/sessions` (JWT + AdminRoleGuard) returns cross-user session visibility with the same filter params (`status`, `userId`, `dateRange`, `startDate`, `endDate`) as the internal endpoint.

4. **Admin session terminate** — `DELETE /api/admin/sessions/:sessionId` (JWT + AdminRoleGuard) terminates a session using existing semantics. Idempotent: returns `{ message: 'Session already terminated' }` if already terminated. Best-effort container stop with fallback on failure. Structured audit log emitted with `event: admin.session.terminated`, `sessionId`, `adminActor`, and `userId`.

5. **Admin role guard** — `AdminRoleGuard` enforces `UserRole.ADMIN` on request user. Returns 401 if no identity, 403 if role is not admin. Applied at controller level on all `AdminOperationalController` routes, ensuring no non-admin JWT holder can reach admin actions.

6. **Structured audit logging** — `AdminDashboardService.terminateSessionAsAdmin` emits a structured JSON log entry on session termination and a structured warn log if best-effort container stop fails. No separate audit table or broad audit platform introduced.

---

## Follow-up Boundary

The CO-01 Commercial Readiness family is now complete through CO-03-01. The next area of work, if promoted, would be CO-04 (API and Key Management) or other Phase 5 commercial-readiness items per the master plan. That work is out of scope for CO-03-01 and has not been started.
