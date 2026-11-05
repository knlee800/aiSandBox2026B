# ACCESS-01B — Stage-start

**Task:** ACCESS-01B — Per-user entitlements table replacing the env allowlist. Lane 1; GATEWAY, MIGRATION, ENV; LOCAL-TESTS; 4-STEP. Implementer: grok-4.7-xhigh.

## 1. Scope and non-goals

This task adds the `user_entitlements` table, reads `harness_enabled` for browser sessions and `/api/auth/me`, adds one admin-only set route that writes one `audit_events` row per change, and starts the cutover from `AGENT_HARNESS_BROWSER_SESSION_USER_IDS`. The columns `agent_write_enabled`, `plan_override` and `daily_token_limit_override` are stored and validated but not read by any gate: ACCESS-01C reads the write flag, ACCESS-01D reads the plan and limit overrides. Out of scope: API-key entitlement (`ai:harness` scope stays as is), the three routes that read `identity.harnessEntitled`, any frontend, any GET/list route, the `ApiKeyIdentity` shape.

## 2. Current state

| Fact | Citation |
|---|---|
| Browser-session entitlement is a comma list of UUIDs in env; one malformed token grants nobody | `services/api-gateway/src/auth/session-or-api-key.guard.ts:13-40` |
| Guard synthesizes `ApiKeyIdentity {userId, apiKeyId:'browser-session', scopes:['ai:execute'], isInternal:true}` and sets `harnessEntitled = true` only when the env list contains `user.id` | `session-or-api-key.guard.ts:80-89` |
| `/api/auth/me` returns `getUserById(...)` plus `harnessEntitled: isBrowserSessionHarnessEntitled(req.user.userId)` | `auth/auth.controller.ts:26, 372-380` |
| API keys get `harnessEntitled` from the `ai:harness` scope (DB) or the static test map; independent of the env list | `auth/api-key-auth.guard.ts:73-95`; `auth/api-key.config.ts:20, 32-41` |
| Readers only test `identity.harnessEntitled !== true` | `ai/ai-execution.controller.ts:746`; `orchestration/collaboration.controller.ts:333`; `knowledge/knowledge.controller.ts:147` |
| Per request, `validateSessionToken` already does one SELECT with user join and one UPDATE | `auth/auth.service.ts:302-325` |
| Admin = `req.user.role === 'admin'`; `SessionCookieGuard` sets `req.user {userId,email,role,plan}` | `guards/admin-role.guard.ts:14-21`; `auth/session-cookie.guard.ts:36-41` |
| Admin write pattern: class-level `@UseGuards(SessionCookieGuard, AdminRoleGuard)`, `POST users/:userId/credits`, actor from `request.user.userId`, 404 when target missing, class-validator DTO | `admin/admin-operational.controller.ts:41-82`; `admin/admin-credit-grant.service.ts:19-31`; `admin/dto/admin-credit-grant.dto.ts` |
| Global `ValidationPipe({whitelist:true, transform:true})` | `main.ts:62-66` |
| `audit_events` is append-only (trigger refuses UPDATE/DELETE), `user_id` nullable with no FK; the only writer inserts fire-and-forget | `migrations/1800000000000-CreateAuditEventsTable.ts`; `entities/audit-event.entity.ts`; `orchestration/orchestration-audit.recorder.ts:53-75` |
| Entities and migrations load by glob; `synchronize:false`; staging runs `migration:run -d dist/data-source.js` with `gateway.env` loaded | `config/database.config.ts:21-22, 55-59`; `data-source.ts:29-30`; `ops/clean-baseline/systemd/aisandbox-migrate.service:12-13` |
| Template line `AGENT_HARNESS_BROWSER_SESSION_USER_IDS=`; staging baseline keeps it empty and Keith's windows set it temporarily | `ops/clean-baseline/env/gateway.env.template:17`; `docs/STAGING-DEPLOY-05-CHECKPOINT.md:26` |
| `users.id` uuid; `users.role` enum user/admin/beta; `plan_type` and `credit_balances.plan_id` are varchar(50) | `migrations/1769160618009-InitSchema20260123.ts:7, 14-18`; `entities/user.entity.ts:60-71`; `entities/credit-balance.entity.ts:41` |
| Three out-of-scope specs build the guard through DI with only `ApiKeyAuthGuard` and `AuthService` mocked | `ai/__tests__/ai-execution.run-status.http.spec.ts:98-101`, `ai-execution.ownership.http.spec.ts:72-73`, `ai-execution.confirm-build-apply.http.spec.ts:101-103` |
| A type named `UserEntitlement` already exists (plan-level model, unrelated) | `credit-ledger/types/user-entitlement.ts:46-53` |

## 3. Data

Table `user_entitlements`, one row per user, absent row = all defaults.

| Column | Type | Constraint |
|---|---|---|
| `user_id` | uuid | PRIMARY KEY, `REFERENCES users(id) ON DELETE CASCADE` (as `knowledge_documents`); audit rows survive because `audit_events` has no FK |
| `harness_enabled` | boolean | NOT NULL DEFAULT false |
| `agent_write_enabled` | boolean | NOT NULL DEFAULT false |
| `plan_override` | varchar(50) | NULL |
| `daily_token_limit_override` | integer | NULL, `CHECK (daily_token_limit_override IS NULL OR daily_token_limit_override > 0)` |
| `updated_by` | uuid | NOT NULL, no FK (actor may later be deleted; matches `audit_events.user_id`) |
| `updated_at` | timestamptz | NOT NULL DEFAULT CURRENT_TIMESTAMP |

No index beyond the primary key: the only read is by `user_id`. No `created_at`: history is in `audit_events`.

Entity: `services/api-gateway/src/entities/user-entitlement.entity.ts`, class `UserEntitlementEntity` (name avoids the existing `UserEntitlement` type), `@Entity('user_entitlements')`, `@PrimaryColumn('uuid', {name:'user_id'})`, plain columns, no relation decorators (no change to `user.entity.ts`), no delete helper.

Migration `services/api-gateway/src/migrations/1801000000000-CreateUserEntitlementsTable.ts`, class `CreateUserEntitlementsTable1801000000000`. `up`: one `CREATE TABLE` as above, raw SQL, no transaction calls, no seed. `down`: `DROP TABLE IF EXISTS "user_entitlements"` (the FK goes with the table). Spec `migrations/__tests__/1801000000000-CreateUserEntitlementsTable.spec.ts` in the mocked-runner style of the 1800 spec: exact SQL sequence for up and down, asserts `ON DELETE CASCADE`, the CHECK, no `ALTER TABLE`, no transaction calls.

## 4. Read path

New `EntitlementService` in `services/api-gateway/src/auth/entitlement.service.ts`:

- `isHarnessEnabled(userId): Promise<boolean>` — `findOne({where:{userId}, select:['harnessEnabled']})`; no row → `false`; row → `harnessEnabled === true`. Any repository error is caught, logged at warn with the userId only, and returns `false`. Fail closed: the request stays authenticated but unentitled (gated routes give 403; ordinary execution is unaffected); `/me` reports `false`. The guard never throws 500 for an entitlement read.
- `resolveHarnessEntitled(userId)` — the cutover rule (section 5): returns the row's `harness_enabled` when a row exists; when no row exists, returns `isBrowserSessionHarnessEntitled(userId)`. Both callers use this method, nothing else reads the env.

`SessionOrApiKeyAuthGuard`: constructor gains `@Optional() entitlements?: EntitlementService`; after `validateSessionToken`, `if (await this.entitlements?.resolveHarnessEntitled(user.id)) identity.harnessEntitled = true`. `@Optional()` is required because three out-of-scope specs instantiate the guard with only two mocked providers; absent service means never entitled, which is fail-closed and identical to today's behaviour with an empty env in those specs. `AuthModule` always provides it; a wiring test proves it. Bearer path untouched.

`/api/auth/me`: `harnessEntitled: await this.entitlements.resolveHarnessEntitled(req.user.userId)`; response shape unchanged (no new fields; 01C/01D decide what else `/me` exposes). `AuthController` gains the service as second constructor argument (all constructions are in `auth/` specs).

Cost: one primary-key SELECT per browser-session request on the gated routes and `/me`, beside the existing SELECT+UPDATE in `validateSessionToken`. No cache in this task: revocation must be immediate, and traffic is one or two users. A short grant-only cache would be safe later; a cache that delays revocation is not.

## 5. Cutover

Rule in code: **row wins; env is consulted only when the user has no row; env removed means no row equals not entitled.** An admin revocation (`harness_enabled=false` row) therefore cannot be overridden by the env line.

| Step | Where | Who |
|---|---|---|
| 1. Code: table, entity, migration, service, guard and `/me`, admin route, startup warn log "AGENT_HARNESS_BROWSER_SESSION_USER_IDS is deprecated; rows in user_entitlements win" when the env value is non-empty | this task | implementer |
| 2. Template: keep line 17 of `gateway.env.template` as is (an empty value is the baseline and removing a key changes the baseline hash) | this task | implementer |
| 3. Deploy: `aisandbox-migrate` creates the table; gateway starts; Keith is admin regardless of entitlement | next staging deploy | Keith with control plane |
| 4. Seed: Keith calls `PATCH /api/admin/users/<keith>/entitlements {harnessEnabled:true, reason}`; verifies `/api/auth/me` shows `harnessEntitled:true` with the env line empty | same deploy | Keith |
| 5. Retire: the env line is no longer set in any window; follow-up task deletes `isBrowserSessionHarnessEntitled`, the fallback branch, the warn log, the template line and the two legacy spec blocks | follow-up (section 11) | later |

Keith is never without access: before step 4 the env window still works (no row), after step 4 the row works, and the fallback is read until the follow-up removes it. The env stops being read at the follow-up's deploy. On the staging baseline the env is already empty, so step 4 is the first moment Keith has standing (non-window) entitlement.

## 6. Admin route

`PATCH /api/admin/users/:userId/entitlements` on `AdminOperationalController` (class guards `SessionCookieGuard, AdminRoleGuard` apply; D4: no admin-creation route; plus `CsrfGuard` if Keith accepts decision 3). `:userId` through `ParseUUIDPipe` (400). Body `AdminSetEntitlementsRequestDto` (class-validator, whitelisted):

| Field | Validation |
|---|---|
| `harnessEnabled?` | boolean |
| `agentWriteEnabled?` | boolean |
| `planOverride?` | `null` or one of the ids in `PLAN_DEFINITIONS` (free, starter, pro, team) |
| `dailyTokenLimitOverride?` | `null` or integer 1..100,000,000 |
| `reason` | required string, trimmed, 1..500 (as credit grant) |

At least one of the four fields present, else 400. Target user must exist (404), as in `AdminCreditGrantService`. Semantics: upsert; absent fields keep the current value or the column default when no row existed; `updated_by = req.user.userId`, `updated_at = now`.

One transaction, awaited (unlike the collaboration recorder): upsert `user_entitlements`, then insert `audit_events { category:'entitlement', event_type:'entitlement.updated', subject_type:'user', subject_id:<target>, user_id:<acting admin>, payload:{ targetUserId, actorUserId, reason, before: <row or null>, after: <row>, changedFields: [...] }, occurred_at: <same timestamp as updated_at> }`. If the audit insert fails the entitlement change rolls back (500); there is never a change without its row. One row per successful PATCH, including a no-op (records intent; `changedFields` empty).

Response 200: `{ userId, before: <row|null>, after: <row>, auditEventId }` with camelCase fields and ISO timestamps. Self-change: allowed (decision 2); the audit row records actor = subject.

## 7. Placement

Inside `auth/`: `entitlement.service.ts`, `entitlement.service.spec.ts`, DTO under `admin/dto/`. `AuthModule` adds `UserEntitlementEntity` and `AuditEventEntity` to `forFeature`, provides and exports `EntitlementService`; `AdminModule` already imports `AuthModule`. Reasons: the reader is a guard in `AuthModule`; no new module, no `app.module.ts` change; ACCESS-01D's quota guard can import `AuthModule` to read overrides. ACCESS-01I's plan-resolving `EntitlementService` may later extract an `entitlements/` module; not now.

## 8. Tests per acceptance criterion

- Migration: mocked-runner spec, up SQL sequence and down sequence (section 3).
- Table read for browser sessions and `/me`: guard spec — row true → `harnessEntitled:true`; row false → unset even when env lists the user; no row and env lists the user → true; no row and env empty → unset; repository throws → unset and warn; Bearer path never calls the service; service absent → unset. `auth.controller.spec` — `/me` true/false from the service, profile fields unchanged. Existing env-only blocks in both specs are rewritten to the "no row" case.
- Admin route: `admin-operational.controller.spec` — 401 without session, 403 role user/beta, 400 bad UUID/empty body/bad plan/limit 0/missing reason, 404 unknown user, 200 shape, actor from `req.user.userId`; `entitlement.service.spec` — upsert from no row, partial update keeps other fields, null clears overrides, audit row shape with before/after/changedFields and `user_id` = actor, audit failure rolls back the change (transaction mock), self-change writes actor = subject.
- Stored-not-read: a grep-style test is not meaningful; covered by the guard spec asserting only `harnessEnabled` is selected and by scope review.
- Cutover rule: the four guard cases above plus the startup warn test.
- Wiring: `AuthModule` metadata provides and exports `EntitlementService` and registers both entities (pattern: `stored-orchestration-audit.recorder.spec.ts`).
- Gates: `npm test` (only the 14 smoke.integration failures), `npm run build`.

## 9. Risks

- New guard dependency breaks DI in out-of-scope specs → `@Optional()` with fail-closed absence; wiring test guards production.
- Env fallback kept → bounded by row-wins rule, warn log, and a registered removal task.
- Audit insert slow/failing → awaited transaction; the write fails loudly rather than silently diverging.
- Admin lockout → admin role is independent of entitlements; self-change allowed.
- Migration first runs on staging → down path specified and tested; FK on `users(id)` exists in every environment.
- Cookie-authenticated write without CSRF → decision 3.
- Deleted user → cascade removes the row; audit history remains.

## 10. Decisions for Keith

1. **Env fallback** — Recommend: keep for one deploy with the row-wins rule, remove in a registered follow-up. Alternative: table-only now (no fallback, no warn log, template line deleted in this task); staging baseline already grants nobody, so only Keith's window habit changes.
2. **Admin may set own row** — Recommend: yes (Keith must seed himself; audited). Alternative: refuse self-change and seed by SQL once.
3. **CsrfGuard on the new route** — Recommend: yes, as on the auth controller's mutating routes (`x-csrf-token` must equal the `aisandbox_csrf` cookie; curl can send both). Alternative: match the existing `/credits` POST, which has no CSRF guard.

## 11. Follow-ups

| Follow-up | Proposed disposition |
|---|---|
| Remove `isBrowserSessionHarnessEntitled`, fallback branch, warn log, template line 17 and legacy spec blocks | Register `ACCESS-01B-ENV-RETIRE` (GATEWAY, ENV, LOCAL-TESTS, 2-STEP); READY when the staging deploy after ACCESS-01B shows Keith's row with `harness_enabled=true`; Keith decides; OPTIONAL |
| `POST /api/admin/users/:userId/credits` has no CSRF guard | Register `ADMIN-CSRF-01` NOT_READY, Keith decides; or Keith's drop if decision 3 chooses the alternative |
| Admin GET of a user's entitlements | Drop: the PATCH response and `audit_events` show state until ACCESS-01G/01H |
| `/me` exposing `agentWriteEnabled` and overrides | Superseded by ACCESS-01C and ACCESS-01D (they decide what their gates expose) |
| Extracting an `entitlements/` module | Superseded by ACCESS-01I (plan-resolving EntitlementService) |

**Files read:** TASKS_BACKLOG_FULL.md (ACCESS-01B/01C/01D bodies); docs/ACCESS-READY-01-PLAN.md; docs/COLLAB-AUDIT-01-CHECKPOINT.md; docs/STAGING-DEPLOY-05-CHECKPOINT.md (grep); docs/HARNESS-LIVE-01-STAGE-START.md (grep); services/api-gateway: src/auth/{session-or-api-key.guard.ts, auth.controller.ts (26, 372-380), auth.controller.spec.ts (150-214), __tests__/session-or-api-key.guard.spec.ts (1-60, test names), api-key-auth.guard.ts, api-key.config.ts, auth.module.ts, session-cookie.guard.ts, csrf.guard.ts, auth.service.ts (302-325, 697-714), __tests__/auth.module.google.spec.ts}; src/guards/admin-role.guard.ts; src/admin/{admin-operational.controller.ts, admin.controller.ts, admin-credit-grant.service.ts, admin.module.ts, dto/admin-credit-grant.dto.ts}; src/entities/{audit-event.entity.ts, user.entity.ts, user-role.enum.ts}; src/orchestration/{orchestration-audit.recorder.ts, orchestration.module.ts (grep)}; src/migrations/{1800…, 1799…, __tests__/1800….spec.ts, 1769160618009-InitSchema (1-30)}; src/config/database.config.ts; src/app.module.ts; src/main.ts (grep); src/credit-ledger/types/user-entitlement.ts; data-source.ts (grep); package.json (grep); greps over ai/, orchestration/, knowledge/, ai/__tests__, entities/, credit-ledger/config/plan-definitions.config.ts; ops/clean-baseline/env/gateway.env.template; ops/clean-baseline/systemd/aisandbox-migrate.service, aisandbox-gateway.service (grep).

**Assumptions:**
- `PLAN_DEFINITIONS` ids are exactly free/starter/pro/team (grep of ids only; file not read in full).
- The frontend admin page does not send `x-csrf-token` (grep found none under `frontend/components/admin`); adding `CsrfGuard` affects only future UI work and Keith's manual calls.
- `admin-operational.controller.spec.ts` constructs the controller directly and can take a new constructor argument (not read).
- TypeORM `Repository.manager.transaction` is available for the awaited upsert+audit transaction under the existing test mocks; the implementer may mock `DataSource`/`EntityManager` as other specs do (not surveyed).
- Keith's staging user exists in `users` and he holds `role=admin` there (plan D4 says set by DB update).

---

## Control-plane review and Keith's decisions (binding; these override the sections above where they differ)

Drafted by Fable 5.1 (requested claude-fable-5-1-thinking-high, resolved "Claude Fable 5.1 300K High") through Cursor in read-only mode. The control plane checked the citations against the code: auth.controller.ts 372-380, the three readers (ai-execution.controller.ts 746, collaboration.controller.ts 333, knowledge.controller.ts 147), the admin controller's class-level SessionCookieGuard and AdminRoleGuard, AdminModule importing AuthModule, the plan ids free/starter/pro/team, and the JavaScript-readable aisandbox_csrf cookie (main.ts 46-47; frontend/lib/collaboration/api.ts readCsrfToken) are correct.

**Correction — Keith is not admin on staging.** A read-only query on 2026-11-05 shows one user on staging, Keith, with role user. Assumption 5 is wrong. The next staging deploy sets his role to admin with one SQL update (D4: "set in the database"), as a host step Keith approves, before he calls the route.

**Keith's decisions, 2026-11-05:**

1. **Table only, no env fallback.** This task removes isBrowserSessionHarnessEntitled and every read of AGENT_HARNESS_BROWSER_SESSION_USER_IDS from the gateway; there is no startup warn log; ops/clean-baseline/env/gateway.env.template line 17 is deleted. resolveHarnessEntitled is the table read only: row with harness_enabled true gives true; no row, a false row or a read error gives false. Existing env-only spec blocks in auth/ are rewritten to table cases, and one test proves a non-empty env value no longer grants anything. The staging baseline already grants nobody, so nobody loses access.
2. **An admin may change their own row**, audited with actor = subject.
3. **CsrfGuard on the new route** (x-csrf-token must equal the aisandbox_csrf cookie).

**Cutover (replaces section 5):** (1) this task's code; (2) next staging deploy: migration creates the table, gateway starts, nobody is entitled (same as today's baseline); (3) a host step Keith approves sets users.role = admin for his account; (4) Keith calls PATCH /api/admin/users/<his id>/entitlements with harnessEnabled true and a reason from the browser console on staging (a one-line fetch that reads the aisandbox_csrf cookie); (5) /api/auth/me shows harnessEntitled true and Knowledge opens. Later check windows set or clear the row instead of editing gateway.env.

**Follow-up dispositions (replace section 11):**

| Follow-up | Disposition |
|---|---|
| Remove the env fallback (ACCESS-01B-ENV-RETIRE) | Not needed: decision 1 removes the env read in this task |
| POST /api/admin/users/:userId/credits has no CSRF guard | Register ADMIN-CSRF-01, NOT_READY, Keith decides; registered at this task's LOCK |
| Admin GET of a user's entitlements | Dropped by Keith 2026-11-05: the PATCH response and audit_events show state until ACCESS-01G/01H |
| /me exposing agentWriteEnabled and the overrides | Superseded by ACCESS-01C and ACCESS-01D |
| Extracting an entitlements/ module | Superseded by ACCESS-01I |
