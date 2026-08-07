# BILLING-READY-08 Step 3 — Staging Deployment + Historical Backfill Migration Checkpoint

**Task ID:** BILLING-READY-08  
**Step:** 3 — Staging Deployment + Historical Backfill Migration  
**Status:** COMPLETE AND LOCKED — 2026-08-07  
**Date:** 2026-08-07  
**Author:** Cursor / Sonnet 4.6  

---

## 1. Scope and Objective

Deploy the BILLING-READY-08 source implementation (Steps 2a and 2b) to staging and execute the historical backfill migration `BackfillCreditBalancesForExistingUsers1772700000000` to provision `credit_balances` rows for all eligible existing staging users.

**Objective:** Ensure that every active, supported-plan staging user has a valid `credit_balances` row before FR-04 Step 3c runtime smoke is attempted. This closes the HTTP 402 `credit_balance_not_provisioned` blocker for all existing users and confirms the migration runs successfully on live staging data.

---

## 2. Keith Approval

**Step 3 approval:** Explicitly granted by Keith prior to execution.  
**Approved action:** Staging deployment, backup, API Gateway rebuild and restart, dry-run inventory queries, migration execution, and post-migration verification. No inference enablement. No user invitations.

---

## 3. Pre-Deployment Staging HEAD

| Item | Value |
|------|-------|
| Staging HEAD before deployment | `df9a9ff582321a1c54e3b3566322ed70da175c19` |
| Predecessor deployment checkpoint | `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04C-CHECKPOINT.md` |

---

## 4. Deployed Commit SHA

| Item | Value |
|------|-------|
| Approved deployed HEAD | `96fe52749df2f9599bf7faa3a5dca5f594fa232b` |
| Branch | `origin/main` |
| Source | Contains all BILLING-READY-08 Step 2a + 2b implementation files |

Expected files confirmed present at deployed HEAD:
- `services/api-gateway/src/auth/auth.service.ts` (modified — atomic `DataSource.transaction()`)
- `services/api-gateway/src/migrations/1772700000000-BackfillCreditBalancesForExistingUsers.ts` (created)

---

## 5. Backup Directory

| Item | Value |
|------|-------|
| Backup path | `/opt/aisandbox-backups/billing-ready-08-step3a-20260806T133718Z` |

Backup contents:
- Pre-deploy HEAD record
- API Gateway compiled `dist` backup
- Pre-deployment migration-status error record
- Runtime safety record

**Note:** Pre-deployment `npm run migration:show` could not run because staging omits the `ts-node` development dependency. No development dependency was installed. The compiled TypeORM CLI (`dist/data-source.js`) was used for all subsequent migration commands.

---

## 6. Fast-Forward Deployment Evidence

| Item | Result |
|------|--------|
| Staging fast-forward | PASS |
| Staging HEAD post-deployment | Matched `origin/main` (`96fe52749df2f9599bf7faa3a5dca5f594fa232b`) |
| Expected BILLING-READY-08 source and migration files | Present at deployed HEAD |

---

## 7. API Gateway Build Evidence

| Item | Result |
|------|--------|
| API Gateway build | PASS |
| `dist/src/main.js` | Present |
| `dist/data-source.js` | Present |
| `dist/src/migrations/1772700000000-BackfillCreditBalancesForExistingUsers.js` | Present |

The compiled layout confirmed the migration class was compiled and available to the TypeORM CLI.

---

## 8. API Gateway PM2 / Health Evidence

| Item | Result |
|------|--------|
| PM2 process name | `aisandbox-api-gateway` |
| PM2 status | `online` |
| API Gateway restart | PASS |
| Health check | HTTP 200 |

---

## 9. Runtime Kill-Switch Evidence (Pre-Migration)

| Variable | Value |
|----------|-------|
| `GLOBAL_EXECUTION_ENABLED` | `false` |
| `AI_PROVIDER` | `xai` |
| `PROVIDER_XAI_ENABLED` | `true` |
| xAI key | Present (not exposed in this record) |

No provider inference occurred. No AI execution was enabled. No users were invited.

---

## 10. Migration Discovery and Ordering

| Item | Value |
|------|-------|
| Migration status before execution | `[ ] BackfillCreditBalancesForExistingUsers1772700000000` |
| Latest applied predecessor | `AddProjectSlug1772600000000` |
| Migration ordering conflict | None |

`BackfillCreditBalancesForExistingUsers1772700000000` was the only pending migration. Its timestamp (`1772700000000`) is correctly ordered after `AddProjectSlug1772600000000` (`1772600000000`).

---

## 11. Pre-Migration Aggregate Inventory

Read-only dry-run inventory executed before migration:

| Category | Count |
|----------|-------|
| Eligible active supported-plan users — `free` | 2 |
| Eligible active supported-plan users — `starter` | 0 |
| Eligible active supported-plan users — `pro` | 0 |
| Eligible active supported-plan users — `team` | 0 |
| Users already with balance | 0 |
| Users missing balance — `free` | 2 |
| Unsupported / null plan users | 0 |
| Duplicate `(owner_id, owner_type)` user-owned balances | 0 |
| Orphan user-owned balances | 0 |

---

## 12. Predicted Insert Count

**Predicted insert count:** 2  
(All 2 eligible users were missing balances; 0 already provisioned; 0 unsupported plans; 0 duplicates.)

---

## 13. Smoke-User Migration-Scope Confirmation

The exact FR-04 controlled smoke user (UUID `7f772841-7844-401b-a3da-e928b0c7b79c`) was traced from the relevant workspace session and confirmed to fall within the migration's eligible scope at inventory time.

**No email address, session token, cookie, or other PII is recorded in this checkpoint.**

---

## 14. Migration Command / Result

| Item | Value |
|------|-------|
| Migration executed | `BackfillCreditBalancesForExistingUsers1772700000000` |
| TypeORM result | Reported successful execution |
| Post-migration status | `[X] 27 BackfillCreditBalancesForExistingUsers1772700000000` |

---

## 15. Transaction Commit Evidence

TypeORM reported a successful transaction commit for `BackfillCreditBalancesForExistingUsers1772700000000`. The migration entry appears as `[X]` in the migration status table (entry 27), confirming it was recorded in the TypeORM `migrations` tracking table.

---

## 16. Post-Migration Balance Counts

| Category | Count |
|----------|-------|
| Eligible users with user-owned `credit_balances` row | 2 |
| Eligible users still missing balance | 0 |

---

## 17. Smoke-User Balance Values

Post-migration read-only verification of FR-04 smoke user (UUID `7f772841-7844-401b-a3da-e928b0c7b79c`):

| Field | Value |
|-------|-------|
| `plan_id` | `free` |
| `balance` | `500` |
| `monthly_allocation` | `500` |
| `status` | `active` |
| `period_start` | `2026-08-01 00:00:00` |
| `period_end` | `2026-09-01 00:00:00` |

Values match the authoritative `MONTHLY_CREDIT_ALLOCATIONS.free = 500` and correct UTC calendar-month boundaries for August 2026.

---

## 18. Unsupported / Duplicate / Orphan Findings

| Category | Count | Action |
|----------|-------|--------|
| Unsupported / null plan users missing balance | 0 | None required |
| Duplicate `(owner_id, owner_type)` user-owned balances | 0 | None required |
| Orphan user-owned balances | 0 | None required |

No data anomalies detected. Migration scope was clean.

---

## 19. `GLOBAL_EXECUTION_ENABLED=false` Final State

`GLOBAL_EXECUTION_ENABLED` confirmed `false` after migration execution and after API Gateway health verification.  
The kill-switch was not modified at any point during Step 3.

---

## 20. No Inference or Invitations

- No provider API was called.
- No xAI inference occurred.
- No AI execution was enabled.
- No private-beta users were invited.
- `PRIVATE-BETA-INVITE-01` remains NOT REGISTERED.
- `GLOBAL_EXECUTION_ENABLED` remained `false` throughout.

---

## 21. Remaining FR-04 Block

FR-04 Step 3c — Controlled xAI Execution Smoke — **remains BLOCKED.**

Step 3 (this checkpoint) has cleared the `credit_balance_not_provisioned` HTTP 402 defect for existing staging users. However, FR-04 Step 3c requires `GLOBAL_EXECUTION_ENABLED=true` to be set by the operator. This is a separate, independent approval gate.

FR-04 Step 3c will remain BLOCKED until:
- BILLING-READY-08 **Step 4** is approved and completed (runtime smoke with `GLOBAL_EXECUTION_ENABLED=true`, xAI smoke verification, kill-switch rollback, consolidation).

---

## 22. Exact Next Action

**BILLING-READY-08 Step 4 — Runtime Smoke + Consolidation**

**Requires:** Separate explicit Keith approval before any action.

Step 4 scope (pending approval):
- Operator sets `GLOBAL_EXECUTION_ENABLED=true` on staging.
- Controlled xAI execution smoke: authenticated AI execute request → verify HTTP 200 (not 402).
- Confirm credit deduction recorded.
- Operator rolls back: `GLOBAL_EXECUTION_ENABLED=false`.
- Verify runtime returns to disabled posture.
- Consolidation checkpoint.
- BILLING-READY-08 marked COMPLETE AND LOCKED.
- FR-04 Step 3c block cleared.

**Do not proceed with Step 4 without separate Keith approval.**

---

## Locked Predecessors Not Modified

- `docs/BILLING-READY-08-STEP-2A-CHECKPOINT.md` — COMPLETE AND LOCKED 2026-08-06 — not modified
- `docs/BILLING-READY-08-STEP-2B-CHECKPOINT.md` — COMPLETE AND LOCKED 2026-08-06 — not modified
- All prior BILLING-READY-03/04/05 checkpoints — not modified
- `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04C-CHECKPOINT.md` — COMPLETE AND LOCKED 2026-08-06 — not modified

---

*Checkpoint created: 2026-08-07. Step 3 COMPLETE AND LOCKED.*
