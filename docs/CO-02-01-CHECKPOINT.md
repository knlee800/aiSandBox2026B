# CO-02-01 CHECKPOINT — Billing and Plans Foundation

## Task Metadata

| Field | Value |
|---|---|
| Task ID | CO-02-01 |
| Title | Billing and Plans Foundation |
| Family | CO-01 (Commercial Readiness) |
| Nature | IMPLEMENTATION (COMMERCIAL READINESS, PLAN/ENTITLEMENT FOUNDATION) |
| Status | COMPLETE and LOCKED |
| Checkpoint | `docs/CO-02-01-CHECKPOINT.md` |
| Dependencies | CO-01-01 (Complete and Locked) |

---

## Objective Completed

Implemented the first bounded billing/plans foundation so the platform has a minimal plan/entitlement model and user-visible plan state, without expanding into full payment-provider complexity.

The work was additive and minimal:

**Backend:** A new `Plan` entity was introduced (code, name, max_active_sessions, max_sessions_24h, max_tokens_24h, is_active). The `User` entity received a new nullable `plan_status` column (active / cancelled / expired) alongside the pre-existing `planType` column. The `UsersModule` was extended to register the `Plan` entity. `UsersService` now resolves plan state at request time: it looks up the assigned plan from the `plans` table, falls back to hardcoded `QuotaConfig` values if no plan row is found, and degrades to the `free` plan when plan status is `cancelled` or `expired`. The `UserMeResponseDto` and `UserQuotasResponseDto` were extended additively with `planCode`, `planName`, and `planStatus` fields so plan state flows to callers of existing endpoints.

**Frontend:** `WorkspaceUserSummary` in `workspace-shell.logic.ts` was extended with `planCode`, `planName`, and `planStatus` fields (additive). The existing `DashboardSummary` component in `workspace-shell.tsx` now shows `Plan: <name> (<status>)` in the Current User card. The active-sessions counter in the sidebar now uses `quotaSummary.maxActiveSessions` (plan-aware) instead of the hard-coded `5`. All changes are additive to the existing CO-01-01 quota/usage surfaces.

---

## Exact Files Changed

### New files — api-gateway
- `services/api-gateway/src/entities/plan.entity.ts`
- `services/api-gateway/src/migrations/1771589000000-AddPlansFoundation.ts`

### Modified files — api-gateway
- `services/api-gateway/src/entities/index.ts` — exported `Plan` entity
- `services/api-gateway/src/entities/user.entity.ts` — added `planStatus` column (varchar 20, default `'active'`)
- `services/api-gateway/src/users/dto/user-me-response.dto.ts` — added `planCode`, `planName`, `planStatus` fields
- `services/api-gateway/src/users/dto/user-quotas-response.dto.ts` — added `planCode`, `planName`, `planStatus` fields
- `services/api-gateway/src/users/users.module.ts` — registered `Plan` entity in `TypeOrmModule.forFeature`
- `services/api-gateway/src/users/users.service.ts` — injected `Plan` repository; added `resolvePlanStateForUser`, `normalizePlanStatus` helpers; `getCurrentUser` and `getQuotas` extended additively with plan state; `findActiveUserOrThrow` now selects `planType` and `planStatus`
- `services/api-gateway/src/users/users.service.spec.ts` — rewrote spec suite to cover plan state in `getCurrentUser`, `getUsage`, `getQuotas`, and cancelled-status fallback
- `services/api-gateway/src/users/users.controller.spec.ts` — updated mock return values to include new plan fields

### Modified files — frontend
- `frontend/components/workspace/workspace-shell.logic.ts` — added `planCode`, `planName`, `planStatus` to `WorkspaceUserSummary` interface
- `frontend/components/workspace/workspace-shell.tsx` — rendered `Plan: <name> (<status>)` in `DashboardSummary` Current User card; sidebar active-sessions counter now reads `quotaSummary?.maxActiveSessions`
- `frontend/components/workspace/workspace-shell.test.tsx` — added `planCode`, `planName`, `planStatus` to `userSummary` fixture; extended primary render assertion to check `Plan: Free (active)`
- `frontend/components/workspace/workspace-shell.logic.test.ts` — updated two `userSummary` objects in dashboard logic tests to include plan fields

---

## Exact Tests Run and Results

- `services/api-gateway`: `npm test -- users.service.spec.ts users.controller.spec.ts` → **PASS** (2 suites, 12 tests)
- `services/api-gateway`: `npm run build` → **PASS**
- `frontend`: `npm test -- workspace-shell.logic.test.ts workspace-shell.test.tsx workspace-quota-usage.logic.test.ts` → **PASS** (19 suites, 142 tests)
- `frontend`: `npx tsc --noEmit` → **PASS**
- Changed-file lints (all modified files, backend + frontend) → no linter errors
- `frontend/tsconfig.tsbuildinfo` was reverted before final diff; it is a generated incremental build metadata file and is not intentionally tracked.

---

## Migration Was Required

A TypeORM migration was added and is required before production deployment:

**File:** `services/api-gateway/src/migrations/1771589000000-AddPlansFoundation.ts`

**What it adds (up):**
- `plans` table: `id` (uuid PK), `code` (varchar 50, unique), `name` (varchar 120), `max_active_sessions` (integer), `max_sessions_24h` (integer), `max_tokens_24h` (integer), `is_active` (boolean, default true), `created_at`, `updated_at`
- Unique index `idx_plans_code_unique` on `plans.code`
- `users.plan_status` column: varchar 20, NOT NULL, default `'active'` (idempotent `ADD COLUMN IF NOT EXISTS`)
- Seed rows for `free` and `pro` plans (idempotent `INSERT ... ON CONFLICT DO UPDATE`)

**What it removes (down):** drops `users.plan_status`, `idx_plans_code_unique`, and `plans` table in reverse order.

---

## Scope Statement

Scope stayed fully within CO-02-01. No payment-provider integration. No invoicing/tax/accounting workflow. No admin backoffice expansion. No quota model redesign. No polling, timers, or background workers. No auth redesign. No broad dashboard redesign. No refactors of existing modules beyond the strictly necessary plan-state injection.

---

## Preserved Behaviors

- **Existing token-usage tracking** — `UsageRecord` entity and `usage_records` table are unchanged. Token-usage queries in `QuotaService` are unchanged.
- **Existing quota enforcement (request-time/deterministic shape)** — `TokenQuotaGuard` and `SessionQuotaGuard` still reference `QuotaConfig` constants for enforcement. The `QuotaConfig` static constants themselves were not changed. Guard logic, advisory-lock enforcement, and 429/403 error shapes are unchanged. Plan-aware limits are exposed only in the user-visible `getQuotas` response; enforcement guard behavior is not altered by this slice.
- **Existing session lifecycle** — CREATED → ACTIVE → TERMINATED semantics unchanged.
- **CO-01-01 quota/usage UX surfaces preserved and extended additively** — The `DashboardSummary` component, quota indicator card, and request-driven refresh triggers introduced in CO-01-01 are intact and extended only by the plan name/status addition.
- **PR-01/02/03, AI-03, AI-04 workspace/project/chat behavior** — All workspace, project, file-action, coherence, and chat persistence flows are unchanged.
- **JWT auth and ownership** — All existing `JwtAuthGuard`-protected endpoints remain unchanged. No new public endpoints were added. Plan data is only accessible via existing `GET /api/users/me` and `GET /api/users/me/quotas` endpoints under the same JWT guard.
- **Request-driven behavior** — Plan state is resolved at request time by `resolvePlanStateForUser`, with no background sync, polling, or timer.

---

## Delivered Capability

1. **`Plan` entity and seed data** — `plans` table with `free` and `pro` seed rows (idempotent), each defining `max_active_sessions`, `max_sessions_24h`, and `max_tokens_24h`.

2. **User plan lifecycle state** — `users.plan_status` column holds `active`, `cancelled`, or `expired`. Default `'active'` for all existing and new users.

3. **Plan-aware quota resolution** — `UsersService.resolvePlanStateForUser` reads the user's assigned `planType`, looks up the plan row, and returns plan-derived limits. Cancelled or expired status degrades to the `free` plan limits. Falls back to `QuotaConfig` static values if no plan row exists.

4. **Plan state visible on existing user-facing surfaces** — `GET /api/users/me` and `GET /api/users/me/quotas` now return `planCode`, `planName`, `planStatus`. Frontend `DashboardSummary` shows `Plan: <name> (<status>)`. Sidebar active-sessions counter uses plan-aware `maxActiveSessions`.

5. **No payment-provider expansion** — This slice intentionally stops before payment-provider integration, invoicing, or subscription management workflows.

---

## Follow-up Boundary

The next commercial-readiness step is `CO-03-01` (Admin and Operational Completeness), which covers admin-only tooling, operational visibility, and any remaining commercial-safety completeness work. That work is out of scope for CO-02-01 and has not been started.
