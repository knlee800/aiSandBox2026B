# AGENT-PLATFORM-EXEC-01C-SCHEMA-01 — Consolidation Checkpoint

**Task ID:** AGENT-PLATFORM-EXEC-01C-SCHEMA-01
**Title:** Additive create-table migration for missing `public.api_keys`
**Step:** 4 — Consolidation / Checkpoint / Lock
**Date:** 2026-09-09
**Verdict:** COMPLETE AND LOCKED — PASS — schema scope only
**Reviewed migration source:** `2cf78fc61dc24fff47d6a6f06282f04f79a9933d`
**Nature:** HIGH-RISK 4-step IMPLEMENTATION — schema/migration

---

## 1. Final schema verdict

AGENT-PLATFORM-EXEC-01C-SCHEMA-01 is COMPLETE AND LOCKED for its **schema** scope.

Staging `aisandbox` now has the additive base table `public.api_keys` from `CreateApiKeysTable1772950000000`. Existing evidence establishes that this table supports the old application’s create, list, active-key validation, ownership enforcement, and persisted revocation operations without schema/query errors.

This LOCK does **not** repair running-application revoked-key rejection. Unchanged old revision `b6b94516aff9981101ae8815aec2e2d36b8b231b` still fails CHECK9. KEY-REVOKE-01 is independently source-LOCKED and remains undeployed. IDENTITY-01 remains unapplied. Running staging must not be described as repaired, security-accepted, or release-ready on this basis.

---

## 2. Scope and exact files

Exact SCHEMA-01 implementation write set:

| File | Role |
|---|---|
| `services/api-gateway/src/migrations/1772950000000-CreateApiKeysTable.ts` | Additive create-table migration |
| `services/api-gateway/src/migrations/__tests__/1772950000000-CreateApiKeysTable.spec.ts` | Focused mocked SQL-shape tests |

Control-plane / evidence (not production source):

- `docs/AGENT-PLATFORM-EXEC-01C-SCHEMA-01-DESIGN.md`
- `docs/AGENT-PLATFORM-EXEC-01C-SCHEMA-01-CHECKPOINT.md` (this file)
- `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/control-plane/lane-saturation-state.json`

**Not modified by this consolidation:** IDENTITY-01 seven-file source, KEY-REVOKE-01 three-file source or checkpoint, historical `services/api-gateway/migrations/**`, `data-source.ts` discovery, auth/entitlement/credit code.

---

## 3. Source and evidence revisions

| Item | Revision |
|---|---|
| Consolidation HEAD (expected baseline) | `e3d18381b087f04cde8416987dae0b67f119c848` |
| Reviewed migration source | `2cf78fc61dc24fff47d6a6f06282f04f79a9933d` |
| Focused Jest / tsc evidence commit | `055796f96dc2811f1d8900656d5bf039e02ff0f6` |
| Disposable PostgreSQL rehearsal evidence commit | `a065b90` (`docs: record SCHEMA-01 PostgreSQL rehearsal pass`) |
| Staging apply / snapshot evidence commit | `7e434f7c91485683c11f0afb1b6914ceb27f3a10` |
| Unchanged old application revision | `b6b94516aff9981101ae8815aec2e2d36b8b231b` |
| KEY-REVOKE-01 source LOCK | `409dff579f50176e6495b77cc6771c60c925ec13` — Checkpoint: `docs/AGENT-PLATFORM-EXEC-01C-KEY-REVOKE-01-CHECKPOINT.md` |

Working tree at consolidation open: CLEAN relative to `e3d18381`. Unrelated dirty paths: none.

This window did not rerun tests, SSH, AWS, database, migration, deployment, restart, or privilege operations.

---

## 4. Independent evidence assessment

Retained evidence locations are the SCHEMA-01 canonical body (`TASKS_BACKLOG_FULL.md`), contemporaneous board records, the KEY-REVOKE-01 checkpoint, and the reviewed source at `2cf78fc61dc24fff47d6a6f06282f04f79a9933d`. Runtime was not repeated.

| Gate | Result | Provenance |
|---|---|---|
| Reviewed migration source | **PASS** — `2cf78fc61dc24fff47d6a6f06282f04f79a9933d` contains the two-file write set | git |
| Focused Jest | **22/22 PASS** — isolated copy `/tmp/aisb-schema-01-fL92BQ/src` | canonical AC; commit `055796f` |
| TypeScript | **PASS** — `tsc --noEmit --incremental false` | canonical AC; commit `055796f` |
| Disposable PostgreSQL rehearsal | **50/50 PASS** — db `aisb_schema01_rehearsal_55aaae2a2b56` created/rehearsed/dropped; PostgreSQL 15.18 / TypeORM 0.3.28; schema, migration history, rollback refusal, concurrent locking | canonical AC; commit `a065b90`; rehearsal script records `ALL_STEPS_PASS` |
| Staging SCHEMA-01-only apply | **PASS** — restricted loader applied `CreateApiKeysTable1772950000000` only; TypeORM transaction committed; exactly one new history entry; applied count 29 → 30; table/FK `fk_api_keys_user` → `"public"."users"("id")` ON DELETE CASCADE; indexes `idx_api_key_hashed` / `idx_api_key_user_id`; column types/defaults/nullability as frozen | canonical AC; apply script `exactly_one_new_history_entry_schema01`; commit `7e434f7` |
| IDENTITY-01 unapplied | **PASS** — `is_internal` absent; `AddInternalAccessToApiKeys1773000000000` not in history | canonical AC; apply script `no_is_internal` / `history_still_no_identity01` |
| Snapshot | **PASS** — `aisandbox-staging-pre-schema01-20260908` created 2026-09-08 19:31 UTC+8; name/time confirmed by screenshot; Available attested by Keith before apply | canonical AC / board |
| Old-code compatibility checks 1–8 | **PASS** — create, persist, list, ownership, active-key validate, unknown-key reject, persisted revoke | canonical AC; compat script `check1`–`check8` against unchanged old revision `b6b94516aff9981101ae8815aec2e2d36b8b231b` |
| Old-code CHECK9 | **FAIL PRESERVED** — revoked plaintext still validates; TypeORM 0.3.28 ignores `where: { revokedAt: null }`; SQL `revoked_at IS NULL` count=0 | canonical AC; compat script `check9_validate_revoked_key_rejected` |
| KEY-REVOKE-01 independent review | **PASS_WITH_NONBLOCKING_NOTES** — source LOCK only | `docs/AGENT-PLATFORM-EXEC-01C-KEY-REVOKE-01-CHECKPOINT.md` |
| Cleanup / live checkout | **PASS** — disposable dbs dropped; temp copies removed; live checkout `/opt/aisandbox` remained `b6b94516aff9981101ae8815aec2e2d36b8b231b` dirty=0 | canonical activity ledgers |

No material evidence gap was found for the clarified schema-compatibility criterion. CHECK9 remains a recorded historical FAIL.

---

## 5. Keith’s acceptance clarification (2026-09-09)

Keith explicitly authorized clarifying SCHEMA-01’s acceptance boundary and completing independent checkpoint/LOCK if the clarified criteria are supported by existing evidence.

This approval accepts demonstrated **schema compatibility** while preserving the old application’s CHECK9 security failure and the outstanding deployment requirement for KEY-REVOKE-01.

### Schema compatibility — eligible for acceptance

Existing evidence must establish that the base table supports the old application’s create, list, active-key validation, ownership enforcement, and persisted revocation operations without schema/query errors.

**Assessment:** Supported. Checks 1–8 PASS against unchanged old revision `b6b94516aff9981101ae8815aec2e2d36b8b231b` on the SCHEMA-01 table. Staging apply created the frozen table/FK/indexes/defaults. `is_internal` remained absent.

### Revoked-key rejection — historical failure with separate remediation

Unchanged old revision `b6b94516aff9981101ae8815aec2e2d36b8b231b` failed CHECK9 because its TypeORM null predicate ignored revocation.

Preserve that failure. Record:

- This is an **application filtering defect**, not a table-schema defect.
- KEY-REVOKE-01 provides an independently reviewed, tested, source-LOCKED correction (`IsNull()` predicate; Checkpoint: `docs/AGENT-PLATFORM-EXEC-01C-KEY-REVOKE-01-CHECKPOINT.md`).
- Old revision plus the correction passed; unchanged old revision did not.
- Deployment is still outstanding.
- Running staging must not be described as repaired, security-accepted, or release-ready on this basis.

This clarification does not broaden other SCHEMA-01 acceptance criteria and does not erase historical CHECK9 FAIL reports.

---

## 6. Outstanding deployment / security requirement

| Item | State |
|---|---|
| SCHEMA-01 table on staging `aisandbox` | Applied (SCHEMA-01-only) |
| IDENTITY-01 `is_internal` column | **NOT applied** |
| Deployed old API-key validation | **Unfixed** — still `{ revokedAt: null }` on revision `b6b94516aff9981101ae8815aec2e2d36b8b231b` |
| KEY-REVOKE-01 | Source COMPLETE AND LOCKED only — not deployed |
| Current-source activation | Requires the IDENTITY-01 column first |
| Deployment of the revocation fix | Needs its own reviewed procedure and authorization |
| API-key security readiness claim | **Forbidden** until the fix is deployed and appropriately verified |

No backport or new deployment task is registered in this window.

---

## 7. Rollback limitations and retained snapshot

- Populated-table `down()` refuses DROP. Restore path for a populated table is the verified pre-apply Lightsail snapshot, not this `down()`.
- Snapshot `aisandbox-staging-pre-schema01-20260908` is retained.
- If IDENTITY-01 is later applied, revert IDENTITY-01 first, then SCHEMA-01.
- `down()` requires an already-active QueryRunner transaction, ACCESS EXCLUSIVE NOWAIT, and an explicit empty COUNT. This consolidation does not execute rollback.

---

## 8. Schema completion versus running-application repair

Schema completion means the base table exists, history records SCHEMA-01, and old create/list/active-validate/ownership/persisted-revoke operations run without schema/query errors.

It does **not** mean:

- revoked keys are rejected by the running application
- KEY-REVOKE-01 is deployed
- IDENTITY-01 is applied
- staging is security-accepted or release-ready

LANE-DONE is recorded in this consolidation only as the completed schema-validation state, then immediately LOCKED. Occupancy was already EMPTY at window open and remains EMPTY. This window did not re-admit SCHEMA-01 to an implementation lane.

---

## 9. Lifecycle / occupancy after lock

- Candidate retained (`nature=IMPLEMENTATION`) so GOV-OS-03R1 completeness remains satisfied.
- `status` **LOCKED** (`Test-Admissible` = NOT_READY).
- `saturationClass` remains **FORCING**.
- `writeSetPrecision=EXACT`; SCHEMA-01 `admissionUncertain=false` (acceptance-related uncertainty resolved by Keith’s clarification).
- Lane 1 EMPTY; Lane 2 EMPTY; Lane 3 DISABLED.
- GATEWAY / MIGRATION / STAGING / GOVERNANCE UNOWNED after transient GOVERNANCE release.
- IDENTITY-01 remains READY / NOT ADMITTED. SCHEMA-01 dependency is now satisfied. Remaining IDENTITY-01 Step 4 gates (migration apply, privilege grant, checkpoint/LOCK) are unresolved. IDENTITY-01 is not admitted. Residual re-admission uncertainty is recorded as IDENTITY-01 `admissionUncertain=true` so a free lane with nonempty safely-admissible set S is not created. Keith withheld IDENTITY-01 admission this window. IDENTITY-01 overlapping KEY-REVOKE-01 write set is unassessed here.
- EXEC-01C6A remains READY / NOT ADMITTED / ADMISSION_UNCERTAIN until IDENTITY-01 is COMPLETE AND LOCKED.

| Field | Value |
|---|---|
| Lane 1 | EMPTY / NONE |
| Lane 2 | EMPTY / NONE |
| Lane 3 | DISABLED |
| occupancyHash | `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d` |
| sidecarSha256 | `9095965f714b00c8bbbd79f99f3f57564a732ec2647375a446c4c95fe1a2ec5b` |
| mutexCatalogSha256 | `64232fa4b478f75a4b5542342d1bfa868398338a7b60cd86233552dd64c8d4df` |
| Validator | PASS — `idleCode=NO_PAIRWISE_ADMISSIBLE_CANDIDATE` — S empty — SCHEMA-01 `NOT_READY` — IDENTITY-01 `ADMISSION_UNCERTAIN` — EXEC-01C6A `ADMISSION_UNCERTAIN` — KEY-REVOKE-01 `NOT_READY` |
| Proof path | `%TEMP%\aisb-schema-01-lock-SATURATION_PROOF.json` (tracked `docs/control-plane/SATURATION_PROOF.json` preserved) |
| `git diff --check` | PASS (exit 0) |

---

## 10. Activity ledger (this consolidation window)

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, local application tests=0, tests executed=0 (existing evidence reused; not rerun), package install=0, migrations=0, deployment=0, privilege grant=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git commit/push=0, Lane 2 admission=0, Lane 3 enablement=0, SCHEMA-01 re-admission=0, IDENTITY-01 admission=0, invitation registration=0, Harness activation=0, UI=0, browser=0.

Governance writes: this checkpoint, SCHEMA-01 design acceptance wording, `TASKS.md` CURRENT EXECUTION BOARD fields, SCHEMA-01/IDENTITY-01 canonical bodies, `docs/control-plane/lane-saturation-state.json`. Validator proof stored only under `%TEMP%`. Tracked `docs/control-plane/SATURATION_PROOF.json` preserved.

---

*Checkpoint document created: 2026-09-09 — Step 4 schema consolidation — AGENT-PLATFORM-EXEC-01C-SCHEMA-01 COMPLETE AND LOCKED (schema scope) — no source/test/runtime changes — no git add/commit/push.*
