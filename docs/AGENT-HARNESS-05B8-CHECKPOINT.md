# AGENT-HARNESS-05B8 — Checkpoint

**Task ID:** AGENT-HARNESS-05B8
**Title:** Seed Test User Password Hash Correction
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-26
**Verdict:** PASS

---

## 1. Context from AGENT-HARNESS-05B7

AGENT-HARNESS-05B7 (ai-service Provider/Model Execution Validation Against Production Compose) is COMPLETE and LOCKED as of 2026-06-26.

During 05B7, login as `test@aisandbox.com` (documented password: `password123`) failed immediately at the auth step. The seeded `password_hash` in the runtime database did not match `password123`. Keith approved a targeted runtime DB data correction during 05B7 to unblock provider/model execution validation:

```sql
UPDATE users SET password_hash = <verified bcrypt hash for password123> WHERE email = 'test@aisandbox.com';
```

After that correction, login succeeded and 05B7 passed. The root problem identified was a source-level inconsistency: the seed SQL files that populate `test@aisandbox.com` (and `demo@aisandbox.com`) contained bcrypt hashes that did not match the documented test passwords. Any future fresh database initialization would reproduce the same broken auth state. AGENT-HARNESS-05B8 was registered to correct the source seed files.

---

## 2. Root Cause Confirmation

All inspected seed files contained bcrypt hashes that did not match their documented passwords.

Verification was performed using `bcrypt.compare()` with `bcrypt@5.1.1` from:

```
C:\Users\knlee\aiSandBox2026B\services\api-gateway\node_modules
```

Results:
- `test@aisandbox.com` documented password `password123`: **old hash did not match.**
- `demo@aisandbox.com` documented password `demo123`: **old hash did not match.**
- The previously suggested hash from task notes also failed verification, likely due to copy/paste mangling during documentation.

---

## 3. Files Changed

The following seed/schema SQL files were corrected during the implementation step. No other files were modified.

| File | Change |
|------|--------|
| `database/init/001_schema.sql` | Corrected `test@aisandbox.com` bcrypt hash |
| `database/schema.sql` | Corrected `test@aisandbox.com` bcrypt hash |
| `database/schema-sqlite.sql` | Corrected `test@aisandbox.com` bcrypt hash |
| `database/init/003_add_demo_user.sql` | Corrected `demo@aisandbox.com` bcrypt hash |
| `database/add-demo-user.sql` | Corrected `demo@aisandbox.com` bcrypt hash |

All changed files are seed/schema SQL files only. No auth logic, no migration files, no TypeScript/NestJS source, no frontend, no package files, no Docker files, and no `.env` were modified.

---

## 4. Users Corrected and Why

### `test@aisandbox.com`
- **Documented password:** `password123`
- **Reason for correction:** This is the primary platform test user used in all provider/model execution smoke tests. Its hash mismatch directly caused the 05B7 auth blocker. Three seed files contained this user's INSERT and all three were corrected.

### `demo@aisandbox.com`
- **Documented password:** `demo123`
- **Reason for correction:** Scope review confirmed `demo@aisandbox.com` is seeded in two additional SQL files and its documented password is `demo123`. Its hash was also mismatched. Per scope criteria, both demo user files were corrected in the same implementation slice.

---

## 5. New Verified Hashes

| User | Password | Verified Hash |
|------|----------|---------------|
| `test@aisandbox.com` | `password123` | `$2b$12$Euh2JBgTe8dUbsF1VDloVuZbh2tuQMxHT4xODHyDQUqdEXmFI5PL6` |
| `demo@aisandbox.com` | `demo123` | `$2b$12$DWbQPZwzAAW8s9KRmh30/.7xTIihmziooIXxrxGNVWGj6IyqLwHhi` |

Both hashes use bcrypt cost factor 12, consistent with the platform's auth service configuration.

---

## 6. Hash Generation and Verification Method

1. Fresh hashes were generated via `bcrypt.hash(password, 12)` using `bcrypt@5.1.1` from `services/api-gateway/node_modules`.
2. Each generated hash was verified with `bcrypt.compare(password, hash)`.
3. A temporary standalone script `database/verify-seed-hashes.js` was created for verification purposes and deleted immediately after both verifications returned `true` and exit code 0.
4. No permanent test files or scripts were added.

---

## 7. Tests and Checks

### bcrypt Round-Trip Verification
**Result: PASS**
- `bcrypt.compare('password123', newHash)` → `true`
- `bcrypt.compare('demo123', newHash)` → `true`
- Exit code: 0

### services/api-gateway npm test
**Result: 95/112 suites passed. 978/1088 tests passed.**

Auth-related suites that passed:
- `auth.service.spec.ts` — PASS
- `auth.controller.spec.ts` — PASS
- `auth.service.reset.spec.ts` — PASS
- `auth.service.verify.spec.ts` — PASS

No existing seed validation tests were found in the repository.

### Pre-existing api-gateway Test Failures (17 failures — not caused by this task)

The following 17 failures are pre-existing and unrelated to AGENT-HARNESS-05B8:
- QueueService DI resolution failures.
- Jest worker crash failures.

These failures were present before this task and are documented in prior AGENT-HARNESS checkpoints. They are not caused by any seed hash change and do not affect the acceptance verdict for this task.

---

## 8. Confirmations and Non-Goals

- No auth logic changed.
- Only bcrypt hash values in SQL `INSERT` statements were replaced.
- No runtime DB mutation performed.
- No Docker or PostgreSQL commands executed.
- No `.env` changes.
- No Dockerfile changes.
- No frontend changes.
- No provider/model execution run.
- No browser_smoke run.
- No sessionId UUID validation fix (separate task, deferred).
- No Agent Harness `harnessVersion` validation.
- No Docker Compose validation.
- No database migration.
- No schema structural changes.
- No changes to user roles, plans, or quotas.
- No changes to auth session or API key behavior.

---

## 9. Locked Invariants

The following invariants are locked and must be preserved by all subsequent tasks:

1. The verified hash `$2b$12$Euh2JBgTe8dUbsF1VDloVuZbh2tuQMxHT4xODHyDQUqdEXmFI5PL6` for `test@aisandbox.com / password123` is the correct source-of-truth seed hash. Do not replace it without re-verification.
2. The verified hash `$2b$12$DWbQPZwzAAW8s9KRmh30/.7xTIihmziooIXxrxGNVWGj6IyqLwHhi` for `demo@aisandbox.com / demo123` is the correct source-of-truth seed hash. Do not replace it without re-verification.
3. All five seed files listed in Section 3 are now consistent and must remain consistent with the verified hashes above.
4. bcrypt cost factor 12 must be preserved for all seed hash generation.
5. Auth logic, guards, session behavior, and API key behavior remain unchanged from the state locked at AGENT-HARNESS-05B7.
6. No plaintext passwords may be introduced in source code (existing credential comments in seed files are acceptable documentation).

---

## 10. Next Recommended Task

Register a separate follow-up task for **sessionId UUID input validation before ledger write**, if Keith approves. This was identified as a non-goal in AGENT-HARNESS-05B8 and deferred. The Agent Harness flow currently accepts non-UUID sessionId values at the ledger endpoint without validation; this should be hardened before further production smoke testing.
