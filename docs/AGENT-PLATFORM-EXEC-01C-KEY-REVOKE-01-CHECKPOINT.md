# AGENT-PLATFORM-EXEC-01C-KEY-REVOKE-01 — Source Consolidation Checkpoint

**Task ID:** AGENT-PLATFORM-EXEC-01C-KEY-REVOKE-01
**Title:** Fix revoked API keys being accepted (TypeORM IsNull predicate)
**Step:** 2 — Consolidation / Checkpoint / Source Lock
**Date:** 2026-09-09
**Verdict:** COMPLETE AND LOCKED — PASS — source scope only
**Reviewed implementation commit:** `409dff579f50176e6495b77cc6771c60c925ec13`
**Independent review:** PASS_WITH_NONBLOCKING_NOTES
**Nature:** 2-step IMPLEMENTATION — authentication source repair

---

## 1. Final source verdict

AGENT-PLATFORM-EXEC-01C-KEY-REVOKE-01 is COMPLETE AND LOCKED for its **source** scope.

TypeORM 0.3.28 ignored `where: { revokedAt: null }`, so validation loaded revoked rows. The committed repair uses an explicit `IsNull()` predicate in one production service file, with two focused test files. Isolated Lightsail evidence passed. Independent review found no blockers.

This LOCK does **not** deploy, migrate, restart, or grant privilege. Running staging remains on the old revision with the unfixed predicate. SCHEMA-01 and IDENTITY-01 are not complete and were not admitted.

---

## 2. Problem and minimal correction

**Problem:** TypeORM 0.3.28 `invalidWhereValuesBehavior.null=ignore` strips `revokedAt: null` from `find()`. `ApiKeyService.validateApiKey` therefore accepted revoked plaintext keys. SCHEMA-01 old-application compatibility recorded checks 1–8 PASS / check 9 FAIL against unchanged old revision `b6b94516aff9981101ae8815aec2e2d36b8b231b`. Current main contained the same faulty predicate. IDENTITY-01 `isInternal` propagation had to remain intact.

**Minimal correction (one production file):**

- Import `IsNull` from TypeORM.
- Change validation to `where: { revokedAt: IsNull() }`.

Create/list/revoke behavior, global TypeORM null-handling configuration, schema, and migrations were not changed by this task.

---

## 3. Reviewed implementation commit and exact write set

**HEAD at consolidation:** `409dff579f50176e6495b77cc6771c60c925ec13`
**Branch:** `main`
**Working tree at consolidation open:** CLEAN (no unrelated dirty paths)

The source write set is exactly three files:

| File | Role |
|---|---|
| `services/api-gateway/src/auth/api-key.service.ts` | Production — `validateApiKey` uses `IsNull()` |
| `services/api-gateway/src/auth/__tests__/api-key.service.spec.ts` | Mocked unit tests — assert `where: { revokedAt: IsNull() }`; active accepted; revoked and unknown rejected; ownership and `isInternal` preserved |
| `services/api-gateway/src/auth/__tests__/api-key.service.pg.spec.ts` | Opt-in PostgreSQL regression — real service / repository / bcrypt |

No other production source files are in this task’s write set.

Commit `409dff579f50176e6495b77cc6771c60c925ec13` also recorded contemporaneous control-plane occupancy writes (`TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/control-plane/lane-saturation-state.json`) from the verification window. Those are not production source. This consolidation adds the checkpoint and the LOCK lifecycle writes only.

Working-tree content of the three source files matches that commit (empty `git diff`).

---

## 4. Verification results (existing evidence; tests not rerun)

Evidence directory: `C:\Users\knlee\AppData\Local\Temp\aisb-key-revoke-01-lightsail-evidence-pass`

| Gate | Result |
|---|---|
| Current-source unit tests | **19/19 PASS** (`api-key.service.spec.ts`) |
| Current-source PostgreSQL regression | **1/1 PASS** (`api-key.service.pg.spec.ts`; `PG_JEST_EXIT=0`) |
| Current-source TypeScript | **PASS** (`tsc --noEmit --incremental false`; `CURRENT_TSC_EXIT=0`) |
| Old revision + revocation-only overlay | checks 1–9 **PASS** (`oldfix-results.json` `ok: true`; label `old-revision-plus-revocation-fix`) |
| Explicit `IsNull` predicate | Asserted in mocked tests; PG test SQL matches `revoked_at IS NULL` |
| Active keys accepted | PASS |
| Revoked keys rejected | PASS (current source and old-revision-plus-fix check 9) |
| Unknown keys rejected | PASS |
| Ownership / `isInternal` propagation | Preserved (D1/D2/S4 and PG identity `isInternal: false`) |
| Disposable db cleanup | `aisb_keyrevoke_01_446d9cb6378d` dropped (`DROP_DATABASE_OK`); temp copy removed (`REMOVED_TMP`) |
| Live checkout | Unchanged `b6b94516aff9981101ae8815aec2e2d36b8b231b` dirty=0 after wrap |

Base used for the current-source copy: `7e434f7c91485683c11f0afb1b6914ceb27f3a10` plus the recorded three-file patch later committed as `409dff579f50176e6495b77cc6771c60c925ec13`.

### Tested-content identity (CRLF/LF)

Independent review confirmed committed content matches tested checksums after documented line-ending normalization:

| File | Evidence SHA256 | Normalization |
|---|---|---|
| `api-key.service.ts` | `b0b649ca12e349a39cc6f3ae9b3cc5fdd16e42a2fb4172487586e81da1867ac2` | CRLF bytes match evidence; git blob is LF |
| `api-key.service.spec.ts` | `ff9a09cf9d2ffb0b9515ad6c9f7e5ef71ca7af57ac0c7bef6de621d36e5c3912` | CRLF bytes match evidence; git blob is LF |
| `api-key.service.pg.spec.ts` | `01e7dff0af70ae1f0f9280aa26d170cb7e3e58513cf4c7f75f8e321dcdde0a4f` | LF git blob matches evidence |

Wrap log recorded `TESTED_FILE_SHA_OK`. No untested committed production change.

---

## 5. Independent review

**Verdict:** PASS_WITH_NONBLOCKING_NOTES
**Reviewer window:** KEY-REVOKE-01 independent source and evidence review of `409dff579f50176e6495b77cc6771c60c925ec13`
**Transcript:** [KEY-REVOKE-01 independent review](0c124d17-e902-4ba3-9db0-051ae19baab4)

No blocking findings. Source consolidation is justified.

Non-blocking notes (not hardened in this consolidation):

1. PG spec `DATABASE_URL` is used for name extraction, not as the libpq connection string (host is `/var/run/postgresql`). Optional comment only.
2. Name denylist (`aisandbox` / `postgres` / `template0` / `template1`) is functionally adequate with other checks; a name-pattern allowlist would be optional hardening.

This consolidation does not perform that optional hardening.

---

## 6. PostgreSQL regression operational limitation

`api-key.service.pg.spec.ts` is opt-in (`RUN_API_KEY_REVOKE_PG=true`), refuses a small denylist of database names, and requires `DATABASE_URL` and `AISB_REVOKE_PG_DB` to name the same database.

**Disposable-only safety depends partly on the external creation and target-verification procedure** (uniquely named disposable database created for the wrap, SCHEMA-01 then IDENTITY-01 applied only inside that database, wrap drop). The in-test denylist does **not** prove database provenance. Accidentally creating authentication rows in some other database that is not on the denylist would not be harmless.

The PG regression does not prove live PM2 artifact parity or running-staging behavior.

---

## 7. What this evidence is not

- Passing **old-revision-plus-revocation-fix** checks 1–9 does **not** mean unchanged old code passed check 9. SCHEMA-01’s CHECK9 FAIL against unchanged old revision `b6b94516aff9981101ae8815aec2e2d36b8b231b` remains historical fact and is not reclassified.
- The temporary old-source overlay was **never deployed**.
- Running staging remains at reported old revision `b6b94516aff9981101ae8815aec2e2d36b8b231b` with the unfixed `{ revokedAt: null }` predicate.
- Current-source activation on staging requires the `is_internal` column first (IDENTITY-01 entity mapping). KEY-REVOKE-01 does not apply that migration.
- No deployment, application-database migration, service restart, or privilege grant occurred in this task.
- Passing a patched temp copy does not repair the running application.

---

## 8. Source completion versus deployment

| Item | State |
|---|---|
| Source implementation | COMPLETE — three-file write set committed |
| Lane-local validation | COMPLETE — isolated Lightsail evidence PASS |
| LANE-DONE | Recorded in this consolidation, then immediately LOCKED (LANE-DONE is not a terminal occupancy) |
| Source LOCK | COMPLETE AND LOCKED — this document |
| Staging deployment | NOT DONE — not authorized |
| Application-database migration | NOT DONE — KEY-REVOKE-01 authors none |
| IDENTITY-01 `is_internal` apply | NOT DONE — still a later IDENTITY-01 gate |
| Privilege grant | NOT DONE |
| SCHEMA-01 LOCK | NOT DONE — CHECK9 FAIL remaining acceptance decision |
| EXEC-01C6A | Still READY / NOT ADMITTED / ADMISSION_UNCERTAIN |

IDENTITY-01 required migration evidence, deployment gates, and LOCK criteria remain as previously recorded. This task does **not** add a rule that IDENTITY-01 must LOCK before its migration may execute.

---

## 9. Lifecycle / occupancy after lock

- Candidate retained (`nature=IMPLEMENTATION`) so GOV-OS-03R1 completeness remains satisfied.
- `status` **LOCKED** (`Test-Admissible` = NOT_READY).
- `saturationClass` remains **FORCING**.
- `writeSetPrecision=EXACT`; KEY-REVOKE-01 `admissionUncertain=false`.
- Lane 1 released EMPTY; Lane 2 EMPTY; Lane 3 DISABLED.
- GATEWAY released UNOWNED; GOVERNANCE released UNOWNED; STAGING / MIGRATION UNOWNED.
- SCHEMA-01 remains READY / NOT ADMITTED / PAUSED. CHECK9 FAIL preserved. Residual non-mechanical uncertainty about the remaining SCHEMA-01 acceptance decision is recorded as SCHEMA-01 `admissionUncertain=true` so a free lane with nonempty safely-admissible set S is not created. SCHEMA-01 criteria are not waived. SCHEMA-01 is not admitted.
- IDENTITY-01 remains READY / NOT ADMITTED / BLOCKED pending SCHEMA-01 LOCK (`DEPS_UNSATISFIED`).

| Field | Value |
|---|---|
| Lane 1 | EMPTY / NONE |
| Lane 2 | EMPTY / NONE |
| Lane 3 | DISABLED |
| occupancyHash | `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d` |
| sidecarSha256 | `735845a731f40896b2e285981ca3eb590ea6036526ba54bfe12fb2f8c1659cde` |
| mutexCatalogSha256 | `64232fa4b478f75a4b5542342d1bfa868398338a7b60cd86233552dd64c8d4df` |
| Validator | PASS — `idleCode=NO_PAIRWISE_ADMISSIBLE_CANDIDATE` — S empty — KEY-REVOKE-01 `NOT_READY` — SCHEMA-01 `ADMISSION_UNCERTAIN` — IDENTITY-01 `DEPS_UNSATISFIED` |
| Proof path | `%TEMP%\aisb-key-revoke-01-lock-SATURATION_PROOF.json` (tracked `docs/control-plane/SATURATION_PROOF.json` preserved) |
| `git diff --check` | PASS (exit 0) |

---

## 10. Activity ledger (this consolidation window)

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, local application tests=0, tests executed=0 (existing evidence reused; not rerun), package install=0, migrations=0, deployment=0, privilege grant=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git commit/push=0, Lane 2 admission=0, Lane 3 enablement=0, SCHEMA-01 admission=0, IDENTITY-01 admission=0, invitation registration=0, Harness activation=0, UI=0, browser=0.

Governance writes: this checkpoint, `TASKS.md` CURRENT EXECUTION BOARD fields, KEY-REVOKE-01 canonical body, SCHEMA-01/IDENTITY-01 remaining-gate notes, `docs/control-plane/lane-saturation-state.json`. Validator proof stored only under `%TEMP%`. Tracked `docs/control-plane/SATURATION_PROOF.json` preserved.

---

*Checkpoint document created: 2026-09-09 — Step 2 source consolidation — AGENT-PLATFORM-EXEC-01C-KEY-REVOKE-01 COMPLETE AND LOCKED (source scope) — no source/test/runtime changes — no git add/commit/push.*
