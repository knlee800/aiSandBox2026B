# PRIVATE-BETA-STAGING-SETUP-08 — Checkpoint

**Task ID:** PRIVATE-BETA-STAGING-SETUP-08
**Title:** Migration Readiness / Verification Plan
**Step:** 3 — Consolidation / Handoff to Parent PRIVATE-BETA-STAGING-SETUP Final Consolidation
**Final Status:** COMPLETE and LOCKED — 2026-07-23
**Date:** 2026-07-23
**Nature:** Governance / checkpoint only — no migration execution, no DB connection, no backup/snapshot creation, no deployment, no app/API/browser smoke, no PostgreSQL/Redis action, no env file created/opened/edited, no secrets printed/requested/generated, no implementation, no source/test/package/migration/entity/environment/Docker/deployment files changed.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-SETUP-08 |
| Title | Migration Readiness / Verification Plan |
| Parent | PRIVATE-BETA-STAGING-SETUP — Staging / Production-like Deployment Target Setup |
| Family | BETA READY / PRIVATE BETA / STAGING SETUP / DEPLOYMENT TARGET |
| Priority | CRITICAL |
| Nature | PLANNING / CHECKLIST / SECURITY-ADJACENT — migration readiness and verification planning only |
| Risk | HIGH — must not execute migrations, connect to staging DB, create backups, create snapshots, deploy, or run smoke |
| Step 1 | COMPLETE — Registration — 2026-07-23 |
| Step 2 | COMPLETE — Migration Readiness / Verification Plan — 2026-07-23 — Verdict: PASS |
| Step 3 | COMPLETE — Consolidation / Handoff to parent PRIVATE-BETA-STAGING-SETUP final consolidation — 2026-07-23 |
| Keith Approval | "go" — 2026-07-23 |
| Registered | 2026-07-23 |
| Completed | 2026-07-23 |

---

## 2. Final Status

**PRIVATE-BETA-STAGING-SETUP-08: COMPLETE and LOCKED — 2026-07-23**

All 3 steps complete. Migration readiness / verification plan created at `docs/PRIVATE-BETA-STAGING-SETUP-08-MIGRATION-READINESS-PLAN.md`. Step 2 verdict: PASS — all criteria met — no blockers identified. 25 migration files discovered in `services/api-gateway/src/migrations/`. Migration command `npm run migration:run:prod` confirmed. `migration:revert:prod` NOT FOUND — manual revert path documented. TypeORM `data-source.ts` analyzed — uses `DATABASE_URL` only — `synchronize: false` confirmed. 26 entities mapped to migrations — all core app flows covered. Known gap: `api_keys` entity has no dedicated migration (low MVP impact). Mandatory pre-migration PostgreSQL backup gate documented. Mandatory Lightsail snapshot gate documented. Keith explicit migration approval gate documented. No migration execution occurred. No DB connection occurred. No backup/snapshot creation occurred. No env file created/opened/edited. No secrets printed/requested/generated. No implementation occurred. Checkpoint created. Governance files updated.

---

## 3. Parent Task Status

**PRIVATE-BETA-STAGING-SETUP:** ACTIVE — Steps 1–2 COMPLETE — Step 3 executing via 8 child tasks — SETUP-01 COMPLETE and LOCKED (2026-07-21) — SETUP-02 COMPLETE and LOCKED (2026-07-21) — SETUP-03 COMPLETE and LOCKED (2026-07-21) — SETUP-04 COMPLETE and LOCKED (2026-07-21) — SETUP-05 COMPLETE and LOCKED (2026-07-21) — SETUP-06 COMPLETE and LOCKED (2026-07-22) — SETUP-07 COMPLETE and LOCKED (2026-07-22) — SETUP-08 COMPLETE and LOCKED (2026-07-23).

**All 8 child tasks COMPLETE and LOCKED.** Parent Step 3 (child task chain) is now fully complete. Parent Step 4 — Consolidation / Handoff to PRIVATE-BETA-DEPLOYMENT-READINESS — remains PENDING. Parent PRIVATE-BETA-STAGING-SETUP remains ACTIVE until parent Step 4 is executed.

---

## 4. Why This Child Task Existed

SETUP-01 through SETUP-07 documented: AWS instance decisions, server baseline, domain/DNS/TLS, runtime/container deployment, env variable presence, database/Redis setup, and app deployment/health smoke plans. SETUP-07 explicitly documented that migration execution requires separate Keith approval and that SETUP-08 handles migration readiness. Before any staging deployment can be considered production-ready, TypeORM migrations must be understood, inventoried, and safely planned with mandatory pre-migration backup and Lightsail snapshot gates. SETUP-08 was created to produce that complete migration readiness and verification plan — covering all 25 scope items defined at registration — so that Keith has a full, safe, documented plan for executing migrations when the time comes.

---

## 5. Migration Readiness Plan Path

**Plan document:** `docs/PRIVATE-BETA-STAGING-SETUP-08-MIGRATION-READINESS-PLAN.md`

Created 2026-07-23. Status: CREATED — Step 2 verdict: PASS — all 25 scope items covered.

**Known gap:** `migration:revert:prod` convenience script not found in `package.json`. Manual revert path documented. Not a planning blocker.

**Known gap:** `api_keys` entity has no dedicated migration. Impact LOW for staging MVP. Monitor API Gateway startup for related errors.

---

## 6. Confirmed Staging / Migration Decisions

Carried forward from SETUP-01 through SETUP-07 (all COMPLETE and LOCKED) unchanged:

| # | Decision | Confirmed Value |
|---|----------|-----------------|
| 1 | Provider | AWS Lightsail |
| 2 | Region | Singapore / ap-southeast-1 |
| 3 | Instance | 8 GB RAM / 2 vCPU / 160 GB SSD |
| 4 | Instance name | aisandbox-staging |
| 5 | Static IP planned | aisandbox-staging-ip |
| 6 | Staging domain | https://staging.ainow.biz |
| 7 | Architecture | Single VPS staging |
| 8 | Repo path on VPS | /opt/aisandbox |
| 9 | Env file path on VPS | /opt/aisandbox/.env |
| 10 | Env file permission | chmod 600 |
| 11 | PostgreSQL 15 | localhost:5432 only |
| 12 | Redis 7 | localhost:6379 only with requirepass |
| 13 | Database name | `aisandbox` |
| 14 | Database app user | `aisandbox` |
| 15 | Migration execution | Requires separate explicit Keith approval |
| 16 | Pre-migration PostgreSQL backup | Required before any migration execution |
| 17 | Pre-migration Lightsail snapshot | Required before any migration execution |
| 18 | Beta invite | Requires separate explicit Keith approval |
| 19 | Billing/payment | Disabled — `BILLING_CHARGES_ENABLED=false` |
| 20 | Risky AI/container execution | Disabled by kill switches |
| 21 | `synchronize` | `false` in both TypeORM configurations — migrations are the only schema change mechanism |

---

## 7. Migration Inventory

**25 migration files discovered in `services/api-gateway/src/migrations/`.**

| # | Filename | Timestamp | Apparent Purpose |
|---|----------|-----------|------------------|
| 1 | `1769160618009-InitSchema20260123.ts` | 1769160618009 | **Initial schema** — creates `users`, `sessions`, `conversations`, `chat_messages`, `git_checkpoints`, `containers`, `token_usage` tables + enum types |
| 2 | `1738843200000-CreateUsageRecordsTable.ts` | 1738843200000 | Creates `usage_records` table |
| 3 | `1738843300000-CreateBillingSnapshotsTable.ts` | 1738843300000 | Creates `billing_snapshots` table |
| 4 | `1738900000000-CreateInvoicesTable.ts` | 1738900000000 | Creates `invoices` table |
| 5 | `1740355200000-AddRequestIdToUsageRecords.ts` | 1740355200000 | Adds `request_id` to `usage_records` |
| 6 | `1740355300000-AddExecutionStatusToUsageRecords.ts` | 1740355300000 | Adds `execution_status` to `usage_records` |
| 7 | `1771494478022-AddSessionTermination.ts` | 1771494478022 | Adds session termination columns |
| 8 | `1771495000000-AddExecutionStatusCancelStates.ts` | 1771495000000 | Adds execution status cancel states |
| 9 | `1771495100000-AddChatMessagesAndAlignConversations.ts` | 1771495100000 | Adds chat message columns and aligns conversations schema |
| 10 | `1771496000000-CreateGitCheckpointsTable.ts` | 1771496000000 | Creates/updates `git_checkpoints` table |
| 11 | `1771587000000-AddProjectsAndSessionProjectId.ts` | 1771587000000 | Creates `projects` table and adds `project_id` to sessions |
| 12 | `1771589000000-AddPlansFoundation.ts` | 1771589000000 | Creates `plans` and `subscriptions` tables |
| 13 | `1771592000000-AddProjectVisibility.ts` | 1771592000000 | Adds project visibility column |
| 14 | `1771593000000-AddWorkspacesAndProjectWorkspaceId.ts` | 1771593000000 | Creates `workspaces` table and adds workspace relationship |
| 15 | `1771700000000-AddAuthSchemaFoundation.ts` | 1771700000000 | **Auth schema** — alters `users`; creates `oauth_accounts`, `verification_tokens`, `auth_sessions` |
| 16 | `1771701000000-AddEmailVerificationColumns.ts` | 1771701000000 | Adds email verification columns |
| 17 | `1771800000000-CreateUserAiInstructionsTable.ts` | 1771800000000 | Creates `user_ai_instructions` table |
| 18 | `1771900000000-CreateProjectAiContextTable.ts` | 1771900000000 | Creates `project_ai_context` table |
| 19 | `1772000000000-CreateProjectRepoDocsTable.ts` | 1772000000000 | Creates `project_repo_docs` table |
| 20 | `1772100000000-CreateCreditBalanceAndDeductionTables.ts` | 1772100000000 | Creates `credit_balances` and `credit_deduction_records` tables |
| 21 | `1772200000000-AlignSubscriptionsTableWithTypeORM.ts` | 1772200000000 | Aligns subscriptions table with TypeORM entity definitions |
| 22 | `1772200100000-AddStripeCustomerIdUniqueIndex.ts` | 1772200100000 | Adds unique index on `stripe_customer_id` |
| 23 | `1772300000000-CreateWebhookEventsTable.ts` | 1772300000000 | Creates `webhook_events` table |
| 24 | `1772400000000-CreateCreditGrantsTable.ts` | 1772400000000 | Creates `credit_grants` table |
| 25 | `1772500000000-CreateUserAgentsTable.ts` | 1772500000000 | **Create Agent table** — creates `user_agents` table with FK to users and indexes |

Additional file: `README.md` — migration documentation.

**Migration inventory status:** IDENTIFIED — 25 migration files.

---

## 8. Migration Command Discovery

| # | Script Name | Full Command | Environment |
|---|-------------|-------------|-------------|
| 1 | `migration:run` | `typeorm-ts-node-commonjs migration:run -d data-source.ts` | Local dev only (ts-node) |
| 2 | `migration:run:prod` | `typeorm migration:run -d dist/data-source.js` | **Staging/production** (compiled) |
| 3 | `migration:revert` | `typeorm-ts-node-commonjs migration:revert -d data-source.ts` | Local dev only |
| 4 | `migration:show` | `typeorm-ts-node-commonjs migration:show -d data-source.ts` | Local dev only |
| 5 | `migration:create` | `typeorm migration:create` | Development tool |

**`npm run migration:run:prod` confirmed in `package.json`.**

**`migration:revert:prod` NOT FOUND.** Manual staging revert: `npx typeorm migration:revert -d dist/data-source.js` (run from `services/api-gateway/` on VPS). DATABASE_URL already in environment.

**`migration:show:prod` NOT FOUND.** Manual staging show: `npx typeorm migration:show -d dist/data-source.js`.

---

## 9. TypeORM / Migration Runner Configuration

| # | Property | Value | Notes |
|---|----------|-------|-------|
| 1 | Data source file | `services/api-gateway/data-source.ts` (source) / `dist/data-source.js` (compiled) | Single export: `AppDataSource` |
| 2 | Type | `postgres` | PostgreSQL driver |
| 3 | Connection | `process.env.DATABASE_URL` | **ONLY source** — throws Error if not set |
| 4 | Entities | `src/**/*.entity{.ts,.js}` | Auto-discovered |
| 5 | Migrations | `src/migrations/*.{ts,js}` | Auto-discovered |
| 6 | `synchronize` | `false` | Confirmed in both data-source.ts and database.config.ts |
| 7 | Logging | `true` in non-production; `false` in production | Controlled by `NODE_ENV` |

**`DATABASE_URL` ONLY.** The migration CLI reads `DATABASE_URL` exclusively — not individual `POSTGRES_*` vars.

**`synchronize: false` confirmed** in both `data-source.ts` (migration CLI) and `database.config.ts` (runtime config).

**Build requirement:** `migration:run:prod` uses `dist/data-source.js` — API Gateway must be built before running production migrations.

---

## 10. Entity / Schema Relationship

**26 entity files discovered in `services/api-gateway/src/entities/`.**

| App Flow | Required Tables | Migration Coverage |
|----------|-----------------|-------------------|
| User registration / auth | `users`, `oauth_accounts`, `auth_sessions`, `verification_tokens` | InitSchema (#1) + AuthSchemaFoundation (#15) + EmailVerification (#16) — COVERED |
| Create Agent CRUD | `user_agents` | CreateUserAgentsTable (#25) — COVERED |
| Session lifecycle | `sessions`, `containers` | InitSchema (#1) + SessionTermination (#7) — COVERED |
| Chat / conversation | `conversations`, `chat_messages` | InitSchema (#1) + ChatMessagesAndAlignConversations (#9) — COVERED |
| Git checkpoints | `git_checkpoints` | InitSchema (#1) + CreateGitCheckpointsTable (#10) — COVERED |
| Projects / workspaces | `projects`, `workspaces` | AddProjects (#11) + AddWorkspaces (#14) — COVERED |
| Token usage | `token_usage` | InitSchema (#1) — COVERED |
| Billing (disabled) | `usage_records`, `billing_snapshots`, `invoices`, `plans`, `subscriptions`, `credit_*`, `webhook_events` | Migrations #2–#6, #12, #20–#24 — COVERED (tables exist; billing disabled) |
| User AI instructions | `user_ai_instructions` | CreateUserAiInstructionsTable (#17) — COVERED |
| Project AI context | `project_ai_context` | CreateProjectAiContextTable (#18) — COVERED |
| Project repo docs | `project_repo_docs` | CreateProjectRepoDocsTable (#19) — COVERED |

**Known gap:** `api-key.entity.ts` defines `api_keys` table — no dedicated migration found. LOW impact for staging MVP. Monitor API Gateway startup for related errors.

---

## 11. Current Local Migration Status Assumptions

| # | Assumption |
|---|------------|
| 1 | All 25 migration files confirmed in `services/api-gateway/src/migrations/` |
| 2 | Local development database assumed to have all migrations applied |
| 3 | Staging database is EMPTY — no migrations applied — not yet created |
| 4 | All 25 migrations will need to run on staging for first-time setup |
| 5 | Migrations run sequentially by TypeORM timestamp order (standard behavior) |
| 6 | Some migrations use defensive `IF NOT EXISTS` / `IF EXISTS` guards |
| 7 | Initial migration (#1) creates foundational tables |
| 8 | Build must be current before running `migration:run:prod` |

---

## 12. Staging Database Readiness Prerequisites

Before migration execution, ALL of the following must be confirmed:

| # | Prerequisite | Source Plan | Status at SETUP-08 |
|---|-------------|------------|-------------------|
| 1 | PostgreSQL 15 installed and running | SETUP-06 | Not yet done — future execution |
| 2 | PostgreSQL listening on localhost only | SETUP-06 | Not yet done — future execution |
| 3 | Database `aisandbox` created | SETUP-06 | Not yet done — future execution |
| 4 | App user `aisandbox` created with password | SETUP-06 | Not yet done — future execution |
| 5 | `pg_hba.conf` configured for localhost-only app access | SETUP-06 | Not yet done — future execution |
| 6 | `pg_isready` returns exit code 0 | SETUP-06 | Not yet done — future execution |
| 7 | `/opt/aisandbox/.env` exists with `chmod 600` | SETUP-05 | Not yet done — future execution |
| 8 | `DATABASE_URL` set in `.env` (value is Keith-only) | SETUP-05 / SETUP-06 | Not yet done — future execution |
| 9 | Repo cloned to `/opt/aisandbox` | SETUP-07 | Not yet done — future execution |
| 10 | `npm install` completed | SETUP-07 | Not yet done — future execution |
| 11 | API Gateway built (`npm run build` in `services/api-gateway/`) | SETUP-07 | Not yet done — future execution |
| 12 | `dist/data-source.js` exists (build output) | SETUP-07 | Not yet done — future execution |
| 13 | Pre-migration `pg_dump` backup created | This plan | Not yet done — future gate |
| 14 | Pre-migration Lightsail snapshot created | This plan | Not yet done — future gate |
| 15 | Keith explicit migration execution approval granted | This plan | NOT APPROVED |

---

## 13. Required Pre-Migration PostgreSQL Backup

A PostgreSQL backup via `pg_dump` **MUST** be created before any migration execution on staging. This is non-negotiable.

**Future backup procedure (not executed now):**

| # | Step | Command | Notes |
|---|------|---------|-------|
| 1 | Create backup directory | `mkdir -p /home/ubuntu/backups` | If not already done |
| 2 | Create pg_dump backup | `pg_dump -U aisandbox -h 127.0.0.1 -d aisandbox > /home/ubuntu/backups/aisandbox_pre_migration_$(date +%Y%m%d_%H%M%S).sql` | Timestamped filename |
| 3 | Verify backup file exists | `ls -la /home/ubuntu/backups/aisandbox_pre_migration_*.sql` | File must exist and have non-zero size |
| 4 | Verify backup file is readable | `head -5 /home/ubuntu/backups/aisandbox_pre_migration_*.sql` | Should show PostgreSQL dump header |

Rules: `pg_dump` backup mandatory before every migration execution. Must have non-zero size. Do NOT proceed if backup fails. No backup created in this planning step.

---

## 14. Required Lightsail Snapshot

A Lightsail instance snapshot **MUST** be created before any migration execution. This provides full-VPS rollback capability.

**Future snapshot procedure (not executed now):** Keith navigates to AWS Lightsail console → selects `aisandbox-staging` instance → creates manual snapshot named `aisandbox-staging-pre-migration-YYYYMMDD` → waits for "Available" status → records snapshot name/timestamp privately (NOT in chat/AI tools).

Rules: Snapshot mandatory before every migration execution. Must show "Available" before proceeding. Snapshot name is private — Keith records locally. No snapshot created in this planning step.

---

## 15. Approval Gate Before Migration Execution

| # | Condition | Status |
|---|-----------|--------|
| 1 | Staging DB exists and `pg_isready` passes | Future — not yet |
| 2 | App is stopped or in safe state | Future — not yet |
| 3 | Pre-migration `pg_dump` backup exists and is non-empty | Future — not yet |
| 4 | Pre-migration Lightsail snapshot exists and shows "Available" | Future — not yet |
| 5 | Keith explicitly states "approved" for migration execution | **NOT APPROVED** |
| 6 | API Gateway is built (`dist/data-source.js` exists) | Future — not yet |
| 7 | `DATABASE_URL` is set in environment on VPS | Future — not yet |

**ALL 7 gate conditions must be met before migration execution can proceed.** Keith explicit verbal/written "approved" is required — implicit approval is insufficient. SETUP-08 Steps 2 and 3 do NOT satisfy the approval gate. Migration execution is a separate explicit future step.

---

## 16. Dry-Run / Non-Mutating Verification Options

**Option 1: `migration:show` — Non-Destructive Status Check**

```bash
cd /opt/aisandbox/services/api-gateway
npx typeorm migration:show -d dist/data-source.js
```

Lists all migrations with `[X]` (applied) / `[ ]` (pending). Read-only — does NOT modify the database. Requires `DATABASE_URL` set, `dist/data-source.js` present, PostgreSQL running.

**Option 2: Review Migration SQL Before Execution**

Each migration file contains explicit SQL statements visible in the `.ts` source files. Keith can review before approving.

**Option 3: TypeORM Logging**

Set `NODE_ENV=development` (or omit) when running migrations to see executed SQL. Caution: logs may contain DATABASE_URL in connection output — review on VPS terminal only; do not paste into chat.

**Recommended approach:** Run `migration:show` first (non-destructive) → review source files → only then (after backup + snapshot + approval) run `migration:run:prod`.

---

## 17. Migration Execution Command Plan (Without Running)

**Future execution command (NOT executed now):**

```bash
cd /opt/aisandbox/services/api-gateway
npm run migration:run:prod
```

This executes: `typeorm migration:run -d dist/data-source.js`

**What this does:** TypeORM reads `dist/data-source.js` → creates `migrations` tracking table if not exists → compares migration files against tracking table → executes all pending migrations in timestamp order → records each after success.

**Expected on first-time staging:** All 25 migrations pending — TypeORM will create all enum types, all tables, all indexes, foreign keys, constraints, and the `migrations` tracking table itself.

**Prerequisites before running:** Build exists (`dist/data-source.js`), `DATABASE_URL` set, PostgreSQL running, pre-migration backup exists, Lightsail snapshot "Available", Keith explicit approval.

**Rules:** Do NOT run in SETUP-08. Do NOT run without backup. Do NOT run without snapshot. Do NOT run without Keith explicit approval. If command fails, STOP — do not retry without investigation.

---

## 18. Migration Rollback / Revert Command Plan (Without Running)

**Formal production revert script `migration:revert:prod`: NOT FOUND in `package.json`.**

**Manual production revert command (future — not executed now):**

```bash
cd /opt/aisandbox/services/api-gateway
npx typeorm migration:revert -d dist/data-source.js
```

**What this does:** Identifies the most recently applied migration → executes its `down()` method → removes it from `migrations` tracking table. Only ONE migration reverted per invocation.

**Rollback limitations:**
- Reverts only ONE migration at a time — must run repeatedly to roll back multiple
- Some `down()` methods may fail if data exists (e.g., `AuthSchemaFoundation`'s `down()` refuses to set `password_hash` NOT NULL if null values exist)
- No `migration:revert:prod` convenience script exists

**Alternative rollback: restore from `pg_dump` backup** (if TypeORM revert fails). Or full VPS rollback from Lightsail snapshot (destructive — last resort, Keith decision only).

**Rules:** Do NOT run revert in SETUP-08. Revert is last resort — prefer forward-fixing with a new migration. Never run without knowing which migration will be reverted.

---

## 19. Post-Migration Verification Plan

After successful migration execution (future — not executed now):

| # | Check | Method | Expected |
|---|-------|--------|----------|
| 1 | All 25 migrations applied | `npx typeorm migration:show -d dist/data-source.js` | All 25 show `[X]` |
| 2 | `users` table exists | `psql ... -c "\dt users"` | Table listed |
| 3 | `sessions` table exists | `psql ... -c "\dt sessions"` | Table listed |
| 4 | `conversations` table exists | `psql ... -c "\dt conversations"` | Table listed |
| 5 | `chat_messages` table exists | `psql ... -c "\dt chat_messages"` | Table listed |
| 6 | `git_checkpoints` table exists | `psql ... -c "\dt git_checkpoints"` | Table listed |
| 7 | `containers` table exists | `psql ... -c "\dt containers"` | Table listed |
| 8 | `token_usage` table exists | `psql ... -c "\dt token_usage"` | Table listed |
| 9 | `auth_sessions` table exists | `psql ... -c "\dt auth_sessions"` | Table listed |
| 10 | `oauth_accounts` table exists | `psql ... -c "\dt oauth_accounts"` | Table listed |
| 11 | `verification_tokens` table exists | `psql ... -c "\dt verification_tokens"` | Table listed |
| 12 | `user_agents` table exists | `psql ... -c "\dt user_agents"` | Table listed |
| 13 | `projects` table exists | `psql ... -c "\dt projects"` | Table listed |
| 14 | `workspaces` table exists | `psql ... -c "\dt workspaces"` | Table listed |
| 15 | `plans` table exists | `psql ... -c "\dt plans"` | Table listed |
| 16 | `subscriptions` table exists | `psql ... -c "\dt subscriptions"` | Table listed |
| 17 | `user_ai_instructions` table exists | `psql ... -c "\dt user_ai_instructions"` | Table listed |
| 18 | `project_ai_context` table exists | `psql ... -c "\dt project_ai_context"` | Table listed |
| 19 | `project_repo_docs` table exists | `psql ... -c "\dt project_repo_docs"` | Table listed |
| 20 | Comprehensive table listing | `psql -U aisandbox -d aisandbox -h 127.0.0.1 -c "\dt"` | All tables listed |

---

## 20. Schema / Table Readiness Checks

| # | Flow | Required Tables | Migration Creates Them |
|---|------|----------------|----------------------|
| 1 | User registration | `users` | InitSchema (#1) |
| 2 | Google OAuth login | `users`, `oauth_accounts` | InitSchema (#1) + AuthSchemaFoundation (#15) |
| 3 | Session management | `auth_sessions` | AuthSchemaFoundation (#15) |
| 4 | Create Agent CRUD | `user_agents` | CreateUserAgentsTable (#25) |
| 5 | Projects / workspaces | `projects`, `workspaces` | AddProjects (#11) + AddWorkspaces (#14) |
| 6 | Chat / conversation | `conversations`, `chat_messages` | InitSchema (#1) + ChatMessagesAndAlignConversations (#9) |
| 7 | Git checkpoints | `git_checkpoints` | InitSchema (#1) + CreateGitCheckpointsTable (#10) |

**`user_agents` key columns:** `id` (uuid), `user_id` (uuid — FK to users), `name` (varchar 100), `role` (varchar 200), `description` (text), `status` (varchar 20, default `'active'`), `initials` (varchar 4, nullable), `created_at`, `updated_at`, `deleted_at` (nullable).

**`auth_sessions` key columns:** `id` (uuid), `user_id` (uuid — FK to users), `session_token_hash` (varchar 255, unique), `expires_at`, `last_active_at`, `revoked_at` (nullable), `created_at`.

---

## 21. Create Agent Data-Path Readiness

**Create Agent persistence path requires:** `users` table (user must exist) + `user_agents` table (stores agent records) + FK constraint (`user_agents.user_id` → `users.id` ON DELETE CASCADE) + indexes on `user_id`, `status`, and composite partial index.

**Migration dependency:** `user_agents` (#25) depends on `users` (#1).

**If migration has NOT been executed:** Create Agent API calls return database errors (table not found). Create Agent bounded smoke is BLOCKED — record BLOCKED, not FAILED. EXPECTED condition if migration not yet approved.

**If migration HAS been executed:** Create Agent CRUD (create, list, detail) should work. No AI execution triggered (kill switches disabled).

---

## 22. Auth / Session Table Readiness

**Auth/session path requires:** `users` (core records) + `oauth_accounts` (Google/Apple OAuth) + `auth_sessions` (session tokens with expiry/revocation) + `verification_tokens` (email verification).

**If migration has NOT been executed:** Login page renders (frontend only). Google OAuth redirect works. OAuth callback FAILS (cannot create user/session — tables missing). Auth smoke BLOCKED.

**If migration HAS been executed:** Full auth flow (Google OAuth → user creation → session creation → authenticated routes) should work. Session cookies with Secure, HttpOnly, SameSite attributes function over HTTPS.

---

## 23. Billing Disabled-State Schema Impact

The following billing tables ARE created by migrations but are DISABLED at the application level via kill switches:

| Table | Migration | Kill Switch |
|-------|-----------|-------------|
| `usage_records` | #2 | Application-level billing disabled |
| `billing_snapshots` | #3 | `BILLING_SNAPSHOT_ENABLED=false` |
| `invoices` | #4 | `PAYMENT_EXECUTION_ENABLED=false` |
| `plans`, `subscriptions` | #12 | Application uses but billing disabled |
| `credit_balances`, `credit_deduction_records` | #20 | `BILLING_CHARGES_ENABLED=false` |
| `webhook_events` | #23 | No Stripe webhook configured |
| `credit_grants` | #24 | `BILLING_CHARGES_ENABLED=false` |

**All billing tables WILL be created by migrations** — expected and correct. No billing operations will execute — kill switches prevent all payment/billing paths. No Stripe SDK installed. Tables are empty but present — inert when kill switches are disabled.

---

## 24. Agent Harness Data-Path Readiness

**Agent harness requires:** `sessions`, `conversations`, `chat_messages`, `token_usage`, `containers` tables + Redis/BullMQ queue.

All required tables are created by migrations #1 (InitSchema) through #9 (ChatMessagesAndAlignConversations).

**Agent harness is DISABLED via kill switches:**
- `GLOBAL_EXECUTION_ENABLED=false`
- `AGENT_HARNESS_ENABLE_TOOL_LOOP=false`
- `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false`
- `AI_PROVIDER=stub`

Tables will exist after migration but no AI execution flows through them. BullMQ queue created on startup but no jobs dispatched. No impact on staging safety — agent harness completely disabled.

---

## 25. DB Health / Readiness Endpoint Relationship

| Endpoint | Path | Migration Dependency |
|----------|------|---------------------|
| Basic health | `GET /api/health` | NONE — does not query DB |
| DB health | `GET /api/health/db` | Requires DB connection; does NOT require specific tables (`SELECT 1` only) |
| Readiness | `GET /api/health/ready` | Requires DB connection + env vars + kill switches; does NOT require specific tables |

**API Gateway may start and health endpoints may PASS even if migrations have NOT been run.** TypeORM with `synchronize: false` does not check table existence at startup. Health endpoints pass, but application routes querying missing tables return 500 errors at runtime.

**Recommendation:** Run `migration:show` (non-destructive) after API Gateway starts to confirm migration status before approving execution.

---

## 26. Failure Scenarios and Stop Conditions

| # | Scenario | Impact | Action |
|---|----------|--------|--------|
| 1 | Pre-migration backup missing | No rollback safety net | STOP — create backup before proceeding |
| 2 | Lightsail snapshot missing | No full-VPS rollback | STOP — create snapshot before proceeding |
| 3 | `.env` presence incomplete | Migration runner cannot connect | STOP — verify `DATABASE_URL` presence |
| 4 | DB connection fails | Migration runner cannot reach PostgreSQL | STOP — verify PostgreSQL running |
| 5 | Migration fails mid-execution | Partial schema | STOP — check `migration:show`; investigate; consider revert or restore |
| 6 | Migration partially applies | Inconsistent schema state | STOP — run `migration:show`; restore from backup if needed |
| 7 | Schema mismatch after migration | TypeORM drift | Investigate — may need new migration |
| 8 | Create Agent smoke blocked by schema | `user_agents` missing | EXPECTED if migration not approved — record BLOCKED, not FAILED |
| 9 | `migration:revert:prod` unavailable | Convenience script missing | Use `npx typeorm migration:revert -d dist/data-source.js`; or restore from backup |
| 10 | Evidence would expose secrets | Migration output contains DATABASE_URL | Sanitize — remove connection strings; record migration names and PASS/FAIL only |
| 11 | `dist/data-source.js` missing or stale | Production migration runner fails | STOP — rebuild API Gateway before retrying |
| 12 | `api_keys` table missing causes startup failure | Entity exists but no migration | Investigate — may need new migration as follow-up task |
| 13 | Staging DB target unclear | Risk of running against wrong database | BLOCKED — verify DATABASE_URL target |
| 14 | TypeORM config unclear | Risk of unsafe synchronize | BLOCKED — verify config |

---

## 27. Evidence Collection Rules

**Allowed future evidence:**

| # | Evidence | Safe to Share |
|---|----------|---------------|
| 1 | Migration filenames | YES |
| 2 | Command names (e.g., `npm run migration:run:prod`) | YES |
| 3 | PASS/FAIL summaries per migration | YES |
| 4 | Applied migration names from `migration:show` (`[X]` / `[ ]` markers) | YES |
| 5 | Table names from `\dt` output | YES |
| 6 | Column names from `\d table_name` output | YES |
| 7 | HTTP status codes from health endpoints | YES |
| 8 | `pg_isready` exit code | YES |
| 9 | Sanitized log excerpts (migration names and status only) | YES |

**Forbidden evidence:** Full `DATABASE_URL` (contains password), `POSTGRES_PASSWORD`, `.env` file contents, tokens/cookies/session IDs, OAuth callback parameters, `REDIS_URL` or `REDIS_PASSWORD`, raw database dumps, unsanitized logs with connection strings, AWS account credentials.

---

## 28. Known Gaps / Execution-Time Risks

| # | Gap / Risk | Impact | Mitigation |
|---|-----------|--------|------------|
| 1 | `migration:revert:prod` convenience script missing | Manual revert required on VPS | Use `npx typeorm migration:revert -d dist/data-source.js` manually |
| 2 | `api_keys` entity has no dedicated migration | `api_keys` table will NOT exist after migration | Monitor API Gateway startup; if required, create new migration as follow-up task |
| 3 | `dist/data-source.js` must be current build | Stale or missing build will cause `migration:run:prod` to fail | Rebuild API Gateway before migration execution |
| 4 | First-time staging: all 25 migrations pending | Large schema creation in one migration run | Standard TypeORM behavior; monitor for errors; stop if any migration fails |
| 5 | Some `down()` methods may fail if data exists | Revert may be blocked after data entry | Rely on `pg_dump` backup restore if TypeORM revert fails |
| 6 | Staging DB not yet created | No migration can run yet | All staging DB prerequisites must be met first (see Section 12) |

---

## 29. What Was Not Done

| # | Not Done |
|---|---------|
| 1 | No migration execution |
| 2 | No rollback/revert execution |
| 3 | No DB connection |
| 4 | No staging DB inspected |
| 5 | No PostgreSQL commands run |
| 6 | No Redis commands run |
| 7 | No backups created |
| 8 | No Lightsail snapshots created |
| 9 | No deployment |
| 10 | No repo cloned |
| 11 | No dependencies installed |
| 12 | No services built or started |
| 13 | No PM2 processes created |
| 14 | No Caddy configuration |
| 15 | No SSH to any server |
| 16 | No `.env` file created, opened, or edited |
| 17 | No real `.env`, `.env.local`, `.env.staging`, `.env.production` opened |
| 18 | No credential, key, certificate, or token file opened |
| 19 | No secret values printed, requested, or generated |
| 20 | No Docker used |
| 21 | No implementation |
| 22 | No source code changes |
| 23 | No test file changes |
| 24 | No package file changes |
| 25 | No migration file changes |
| 26 | No entity file changes |
| 27 | No environment file changes |
| 28 | No Docker file changes |
| 29 | No deployment file changes |
| 30 | No tests or builds run |
| 31 | No APIs called |
| 32 | No browser opened |
| 33 | No beta users invited |
| 34 | No git commit or push |
| 35 | No subagents used |

---

## 30. Safety Boundaries Preserved

| # | Safety Boundary | Preserved |
|---|----------------|-----------|
| 1 | No migration execution | YES |
| 2 | No rollback/revert execution | YES |
| 3 | No DB connection | YES |
| 4 | No staging DB inspected | YES |
| 5 | No PostgreSQL commands run | YES |
| 6 | No Redis commands run | YES |
| 7 | No backups created | YES |
| 8 | No Lightsail snapshots created | YES |
| 9 | No deployment | YES |
| 10 | No repo cloned | YES |
| 11 | No dependencies installed | YES |
| 12 | No services built or started | YES |
| 13 | No PM2 processes created | YES |
| 14 | No Caddy configuration | YES |
| 15 | No SSH to any server | YES |
| 16 | No `.env` file created, opened, or edited | YES |
| 17 | No real `.env`, `.env.local`, `.env.staging`, `.env.production` opened | YES |
| 18 | No credential, key, certificate, or token file opened | YES |
| 19 | No secret values printed, requested, or generated | YES |
| 20 | No Docker used | YES |
| 21 | No implementation | YES |
| 22 | No source/test/package/migration/entity/environment/Docker/deployment files changed | YES |
| 23 | No runtime, Docker, DB, browser, API, test, build, migration execution, deployment, git commit, or git push occurred | YES |
| 24 | No secret-bearing environment file opened | YES |
| 25 | No subagents used | YES |

---

## 31. Product Impact

SETUP-08 COMPLETE and LOCKED means:

- The complete migration readiness and verification plan is documented and available to Keith for future execution.
- 25 migration files have been inventoried — full schema coverage confirmed for core app flows.
- The migration command (`npm run migration:run:prod`) is confirmed and documented.
- TypeORM `data-source.ts` is analyzed — `DATABASE_URL` requirement confirmed — `synchronize: false` confirmed.
- The mandatory pre-migration PostgreSQL backup gate is documented.
- The mandatory Lightsail snapshot gate is documented.
- The Keith explicit migration approval gate is documented.
- The missing `migration:revert:prod` script gap is recorded with manual fallback.
- The `api_keys` entity gap is recorded with low-impact assessment.
- Create Agent, auth/session, billing disabled-state, and agent harness data-path readiness are all documented.
- DB health/readiness endpoint relationship to migration status is documented.
- Failure scenarios and stop conditions are documented.
- Evidence collection rules prevent secret exposure during future migration execution.
- All 8 SETUP child tasks (SETUP-01 through SETUP-08) are now COMPLETE and LOCKED.
- Parent PRIVATE-BETA-STAGING-SETUP Step 3 (child task chain) is fully complete.
- Parent Step 4 — Final Consolidation / Handoff to PRIVATE-BETA-DEPLOYMENT-READINESS — is now unblocked.

---

## 32. Dependency / Handoff to Parent PRIVATE-BETA-STAGING-SETUP Final Consolidation

| Field | Value |
|-------|-------|
| Parent task | PRIVATE-BETA-STAGING-SETUP |
| Parent status | ACTIVE — Steps 1–2 COMPLETE — Step 3 complete (all 8 child tasks done) |
| Child tasks 01–08 | All COMPLETE and LOCKED |
| Parent Step 4 | PENDING — Final Consolidation / Handoff to PRIVATE-BETA-DEPLOYMENT-READINESS |
| What SETUP-08 hands off | Migration readiness plan, migration inventory, command discovery, TypeORM config analysis, entity coverage, backup/snapshot gate requirements, approval gate, dry-run options, execution plan, rollback plan, post-migration verification, schema readiness checks, known gaps |
| Next step | Parent PRIVATE-BETA-STAGING-SETUP Step 4 — Final Consolidation / Handoff to PRIVATE-BETA-DEPLOYMENT-READINESS |

After SETUP-08 consolidation (this step), parent PRIVATE-BETA-STAGING-SETUP Step 3 is fully complete. Parent Step 4 consolidates all 8 child task outputs and hands off to PRIVATE-BETA-DEPLOYMENT-READINESS. Migration execution is NOT part of parent Step 4 — it requires a separate future step with Keith explicit approval, pre-migration backup, and Lightsail snapshot.

---

## 33. Acceptance Criteria Disposition

### Step 1 — Registration (COMPLETE 2026-07-23)
- [x] PRIVATE-BETA-STAGING-SETUP-08 added to TASKS_BACKLOG_FULL.md
- [x] PRIVATE-BETA-STAGING-SETUP-08 activated in TASKS.md
- [x] SETUP-01 through SETUP-07 remain COMPLETE and LOCKED
- [x] Parent PRIVATE-BETA-STAGING-SETUP remains ACTIVE
- [x] 3-step child workflow registered
- [x] 25-item Step 2 scope documented
- [x] Recommended defaults recorded
- [x] Safety boundaries recorded
- [x] No migration execution, DB connection, backup/snapshot during registration
- [x] No real env file created/opened/edited
- [x] No secrets printed/requested/generated
- [x] No implementation during registration
- [x] No subagents used

### Step 2 — Migration Readiness / Verification Plan (COMPLETE 2026-07-23 — Verdict: PASS)
- [x] All 25 scope items covered in `docs/PRIVATE-BETA-STAGING-SETUP-08-MIGRATION-READINESS-PLAN.md`
- [x] Migration inventory documented (25 files)
- [x] Migration commands discovered (`migration:run:prod` confirmed; `migration:revert:prod` NOT FOUND — manual fallback documented)
- [x] Approval gate documented (7 conditions)
- [x] Pre-migration backup procedure documented
- [x] Lightsail snapshot procedure documented
- [x] Execution command plan documented (without running)
- [x] Rollback/revert command plan documented (without running)
- [x] Post-migration verification plan documented (20 checks)
- [x] PASS/BLOCKED criteria documented
- [x] No migration execution occurred
- [x] No DB connection occurred
- [x] No backup/snapshot creation occurred
- [x] No real env file created, opened, or edited
- [x] No secret values printed, requested, or committed
- [x] Keith explicit approval recorded before starting Step 2 ("go" — 2026-07-23)
- [x] Step 2 verdict: PASS — all criteria met — no blockers identified

### Step 3 — Consolidation / Handoff to Parent PRIVATE-BETA-STAGING-SETUP Final Consolidation (COMPLETE 2026-07-23)
- [x] Migration readiness plan created: `docs/PRIVATE-BETA-STAGING-SETUP-08-MIGRATION-READINESS-PLAN.md`
- [x] Checkpoint document created: `docs/PRIVATE-BETA-STAGING-SETUP-08-CHECKPOINT.md`
- [x] PRIVATE-BETA-STAGING-SETUP-08 marked COMPLETE and LOCKED in TASKS.md and TASKS_BACKLOG_FULL.md
- [x] AINOW-EXECUTION-ROADMAP.md updated
- [x] Parent PRIVATE-BETA-STAGING-SETUP final consolidation NOT performed in this step

---

## 34. Locked-State Instruction

**PRIVATE-BETA-STAGING-SETUP-08 is COMPLETE and LOCKED as of 2026-07-23.**

This task must not be edited except for explicitly approved documentation correction.

The migration readiness plan at `docs/PRIVATE-BETA-STAGING-SETUP-08-MIGRATION-READINESS-PLAN.md` must not be modified.

The following tasks remain COMPLETE and LOCKED and must not be modified:
- PRIVATE-BETA-STAGING-SETUP-01 (2026-07-21)
- PRIVATE-BETA-STAGING-SETUP-02 (2026-07-21)
- PRIVATE-BETA-STAGING-SETUP-03 (2026-07-21)
- PRIVATE-BETA-STAGING-SETUP-04 (2026-07-21)
- PRIVATE-BETA-STAGING-SETUP-05 (2026-07-21)
- PRIVATE-BETA-STAGING-SETUP-06 (2026-07-22)
- PRIVATE-BETA-STAGING-SETUP-07 (2026-07-22)
- PRIVATE-BETA-STAGING-SETUP-08 (2026-07-23)

Migration execution, backup creation, Lightsail snapshot creation, and beta user invitation remain pending — they require separate future steps with Keith explicit approval.

---

## 35. Exact Next Action

**Next recommended action: Parent PRIVATE-BETA-STAGING-SETUP Step 4 — Final Consolidation / Handoff to PRIVATE-BETA-DEPLOYMENT-READINESS.**

Parent Step 4 scope: Consolidate all 8 child task outputs (SETUP-01 through SETUP-08). Summarize staging setup decisions, plans, and readiness state. Update governance files. Hand off to PRIVATE-BETA-DEPLOYMENT-READINESS. Do NOT execute migrations, deployments, or runtime actions in parent Step 4.

Parent Step 4 requires Keith explicit approval before starting.

After parent PRIVATE-BETA-STAGING-SETUP Step 4 is complete, PRIVATE-BETA-DEPLOYMENT-READINESS (currently BLOCKED / PAUSED) may resume.

No migration execution. No rollback/revert execution. No DB connection. No backup/snapshot creation. No deployment. No app/API/browser smoke. No PostgreSQL/Redis action. No env file created/opened/edited. No secrets printed/requested/generated. No implementation. No subagents.

---

**Checkpoint created:** 2026-07-23
**Task status:** COMPLETE and LOCKED — 2026-07-23
**Parent task status:** PRIVATE-BETA-STAGING-SETUP — ACTIVE — Step 3 complete (all 8 child tasks done) — Step 4 PENDING
**Migration readiness plan:** `docs/PRIVATE-BETA-STAGING-SETUP-08-MIGRATION-READINESS-PLAN.md` — Step 2 verdict PASS
**Migration inventory:** 25 migration files identified
**Migration command:** `npm run migration:run:prod` confirmed — NOT executed
**Rollback command:** `migration:revert:prod` NOT FOUND — manual revert documented — NOT executed
**TypeORM config:** `data-source.ts` analyzed — `DATABASE_URL` only — `synchronize: false`
**Entity/schema:** 26 entities mapped — all core app flows covered
**Known gaps:** `migration:revert:prod` missing (manual fallback documented); `api_keys` entity has no dedicated migration (low MVP impact)
**No migration execution occurred.**
**No rollback/revert execution occurred.**
**No DB connection occurred.**
**No DB/Redis command occurred.**
**No backup/snapshot creation occurred.**
**No deployment occurred.**
**No app/API/browser smoke occurred.**
**No env file was created/opened/edited.**
**No secret values were printed/requested/generated.**
**No implementation occurred.**
**No source/test/package/migration/entity/environment/Docker/deployment files changed.**
**No runtime, Docker, DB, browser, API, test, build, migration execution, deployment, git commit, or git push occurred.**
**No secret-bearing environment file opened.**
**No subagents used.**
