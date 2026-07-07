# BILLING-READY-03A Checkpoint — Schema and Persistence Design

**Task ID:** BILLING-READY-03A
**Parent:** BILLING-READY-03
**Status:** COMPLETE and LOCKED
**Completed:** 2026-07-07
**Family:** BILLING / CREDIT BALANCE PERSISTENCE
**Checkpoint file:** docs/BILLING-READY-03A-CHECKPOINT.md

---

## Summary

Governance/design-only child slice of BILLING-READY-03. Produced a comprehensive schema and persistence design document defining two new database tables (`credit_balances`, `credit_deduction_records`), entity schemas, repository contracts, idempotency model, transaction semantics, migration plan, and concrete acceptance criteria for BILLING-READY-03B implementation. No production source files, tests, entities, migrations, or runtime behavior were changed.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `TASKS.md` | Modified | Added BILLING-READY-03A entry (COMPLETE and LOCKED) |
| `TASKS_BACKLOG_FULL.md` | Modified | Added BILLING-READY-03A entry (COMPLETE and LOCKED) |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Modified | Added 7E-a row and current task description for BILLING-READY-03A |
| `docs/BILLING-READY-03A-SCHEMA-PERSISTENCE-DESIGN.md` | Created | Comprehensive schema/persistence design document |
| `docs/BILLING-READY-03A-CHECKPOINT.md` | Created | This checkpoint file |

**Total: 5 files (3 modified, 2 created). All governance/documentation only.**

---

## Files NOT Changed (Confirmed)

- No files under `services/` changed
- No files under `frontend/` changed
- No files under `database/` changed
- No `.env*` files changed
- No `docker*` files changed
- No `package*.json` files changed
- No TypeORM entities created
- No database migrations created
- No repository implementations created
- No test files created or modified
- No gateway implementations created
- No Stripe/payment code touched

---

## Design Decisions

### Entity Design
1. **One balance row per user** — simplest model; plan changes update the existing row.
2. **Integer credits** — whole units per CREDIT_RATES config; avoids floating-point issues.
3. **`ownerType` discriminator** — enables future team/org billing without schema migration.
4. **JSONB lineItems** — matches existing `BillingSnapshot.lineItems` pattern; avoids join table.
5. **No FK to users table** — loose coupling; credit system does not cascade on user deletion.

### Idempotency
6. **`sourceEventId` unique constraint** — database-enforced; eliminates application-level race conditions.
7. **Duplicate detection via SELECT then catch unique violation** — covers both check-first and race-condition paths.
8. **`skippedDuplicate` is a response flag, not a stored status** — existing rows retain their original status.

### Transaction
9. **`SELECT ... FOR UPDATE` row lock** — serializes per-user deductions; simpler than SERIALIZABLE isolation.
10. **Atomic: lock → calculate → insert record → update balance → commit** — all-or-nothing semantics.
11. **Rollback on any failure** — balance never partially mutated.

### Persistence Architecture
12. **`PersistentCreditDeductionGateway` extends `CreditDeductionGateway`** — preserves single entry point contract.
13. **Gateway becomes async** — `applyDeduction` returns `Promise<CreditDeductionResult>` for DB operations.
14. **`CalculatingCreditDeductionGateway` reused internally** — persistent gateway delegates credit calculation to it.
15. **Immutable deduction records** — no UPDATE permitted; reversals create new records.

---

## Acceptance Criteria — All Satisfied

- [x] `CreditBalance` entity schema defined (fields, types, constraints, indexes)
- [x] `CreditDeductionRecord` entity schema defined (fields, types, constraints, indexes)
- [x] Repository interface contracts defined (`CreditBalanceRepository`, `CreditDeductionRecordRepository`)
- [x] `PersistentCreditDeductionGateway` interaction design documented
- [x] `sourceEventId` uniqueness constraint design confirmed
- [x] `balanceAfter` derivation design confirmed (snapshot at deduction time)
- [x] `creditsOverflow` threshold design confirmed (cap at available balance)
- [x] Transaction model documented (FOR UPDATE lock, atomic commit, rollback)
- [x] Migration plan documented for BILLING-READY-03B (tables, indexes, constraints, rollback)
- [x] BILLING-READY-03B acceptance criteria checklist defined (Section 9 of design doc)
- [x] Schema design document created: `docs/BILLING-READY-03A-SCHEMA-PERSISTENCE-DESIGN.md`
- [x] Checkpoint created: `docs/BILLING-READY-03A-CHECKPOINT.md`
- [x] No implementation files changed
- [x] TASKS.md and TASKS_BACKLOG_FULL.md updated
- [x] AINOW-EXECUTION-ROADMAP.md updated

---

## Validation Performed

### Governance Consistency
- [x] BILLING-READY-03A entry exists in TASKS.md (COMPLETE and LOCKED)
- [x] BILLING-READY-03A entry exists in TASKS_BACKLOG_FULL.md (COMPLETE and LOCKED)
- [x] AINOW-EXECUTION-ROADMAP.md shows BILLING-READY-03A in strategic sequence and near-term table
- [x] BILLING-READY-03 remains ACTIVE as parent umbrella
- [x] AGENT-HARNESS-06C remains deferred
- [x] AGENT-PLATFORM-04 remains future/not registered
- [x] BILLING-READY-03B not yet registered as ACTIVE (design only precedes implementation)

### Design Completeness
- [x] Both entity schemas have all required fields per task specification
- [x] Idempotency model is documented with deduplication flow and race condition handling
- [x] Transaction model covers lock acquisition, deduction, rollback, and failure modes
- [x] Repository contracts cover all CRUD operations needed by 03B/03C
- [x] Migration plan specifies exact DDL for UP and DOWN
- [x] Nullable vs required analysis is explicit
- [x] Non-goals are stated to prevent scope creep

### File System Integrity
- [x] No files under `services/` were modified
- [x] No files under `frontend/` were modified
- [x] No entity, migration, repository, gateway, test, or config files were created
- [x] Only governance/docs files were touched

---

## Dependency Chain

```
BILLING-READY-00 (Audit/Planning) — COMPLETE and LOCKED
  └── BILLING-READY-01A (Architecture Review) — COMPLETE and LOCKED
        └── BILLING-READY-01 (Credit Ledger Foundation) — COMPLETE and LOCKED
              └── BILLING-READY-02A (Gateway Architecture) — COMPLETE and LOCKED
                    └── BILLING-READY-02B (Runtime Wiring) — COMPLETE and LOCKED
                          └── BILLING-READY-02C (Calculation Layer) — COMPLETE and LOCKED
                                └── BILLING-READY-02D (Simulation Validation) — COMPLETE and LOCKED
                                      └── BILLING-READY-03 (Registration) — ACTIVE
                                            └── BILLING-READY-03A (Schema Design) — COMPLETE and LOCKED ← THIS
```

---

## Next Recommended Step

**BILLING-READY-03B — DB schema/migration/repository foundation.**

Register and implement BILLING-READY-03B using the design in `docs/BILLING-READY-03A-SCHEMA-PERSISTENCE-DESIGN.md` as the authoritative reference. Concrete implementation: TypeORM entities, database migration, repository layer. Acceptance criteria defined in Section 9 of the design document.

---

## No Further Changes Needed

BILLING-READY-03A is fully complete. The schema and persistence design document is comprehensive and ready to guide BILLING-READY-03B implementation. No implementation files were touched. Governance documents are synchronized.
