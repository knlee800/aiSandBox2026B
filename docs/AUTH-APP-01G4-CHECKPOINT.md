# AUTH-APP-01G4 Checkpoint — Auth UX Validation + Checkpoint

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-01G4 |
| Title | Auth UX Validation + Checkpoint |
| Family | AUTH |
| Parent | AUTH-APP-01G |
| Status | COMPLETE and LOCKED |
| Nature | VALIDATION AND DOCUMENTATION ONLY — no production source files changed |
| Date | 2026-05-07 |
| Depends on | AUTH-APP-01G3 (COMPLETE and LOCKED) |
| Checkpoint | `docs/AUTH-APP-01G4-CHECKPOINT.md` |
| Family checkpoint | `docs/AUTH-APP-01G-CHECKPOINT.md` |
| Scope spec | `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` Section 12 |

---

## Objective

Run the full automated validation suite for the AUTH-APP-01G family (G1–G3 implementation complete), record the manual smoke checklist disposition, create the G4 task checkpoint and the AUTH-APP-01G parent/family checkpoint, and advance current stage to AUTH-APP-01H.

---

## Automated Validation Results

All commands run from `C:\Users\knlee\aiSandBox2026B\frontend`.

### 1. Frontend build

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run build
```

**Result: PASS**

- Next.js 15.5.12
- Compiled successfully in 2.6s
- Linting and type validity: PASS
- Static pages generated: 4/4
- All 13 routes compiled without error

Routes compiled:
- `/_not-found`
- `/[locale]`
- `/[locale]/account`
- `/[locale]/app`
- `/[locale]/driver`
- `/[locale]/gallery`
- `/[locale]/keys`
- `/[locale]/login`
- `/[locale]/projects`
- `/[locale]/register`
- `/[locale]/share`
- `/[locale]/share/[projectId]`
- `/test`

### 2. Type check

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit
```

**Result: PASS** — no output, exit code 0.

### 3. Full test suite

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test
```

**Result: PASS**

| Metric | Value |
|---|---|
| Tests | 256 |
| Suites | 22 |
| Pass | 256 |
| Fail | 0 |
| Cancelled | 0 |
| Skipped | 0 |
| Duration | 1048.5ms |

Test scope: `components/workspace/*.test.ts*` and `components/public/*.test.ts*` — includes the 3 G3 logout button tests added to `workspace-shell.test.tsx`.

### 4. Login page direct test (OAuth error banner)

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"
$p = (Resolve-Path -LiteralPath "app\[locale]\login\page.test.tsx").Path
npx tsx "$p"
```

**Result: PASS**

| Test | Result |
|---|---|
| Does not render OAuth error banner when no `?error` param | PASS |
| Renders provider-agnostic failure message for `oauth_failed` | PASS |
| Renders account conflict message for `account_conflict` | PASS |

3 tests, 1 suite, 0 failures.

Note: Direct `npx tsx` invocation required (not `npx tsx --test`) due to `[locale]` bracket in path — consistent with G2 checkpoint.

### 5. Keys page direct test (auth bootstrap)

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"
$p = (Resolve-Path -LiteralPath "app\[locale]\keys\page.test.tsx").Path
npx tsx "$p"
```

**Result: PASS**

| Test | Result |
|---|---|
| Redirects to login when `/api/auth/me` is not ok | PASS |
| Redirects to login when `/api/auth/me` returns invalid user id | PASS |
| Renders key management surface after successful auth bootstrap | PASS |

3 tests, 1 suite, 0 failures.

### `tsconfig.tsbuildinfo` restore

`frontend/tsconfig.tsbuildinfo` was modified by `npm run build`. Restored:

```powershell
git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo
```

Post-restore `git status`: clean — `nothing to commit, working tree clean`.

---

## Manual Smoke Checklist

**Status: NOT RUN — deferred to user live environment.**

**Reason:** No live frontend/backend/browser environment is available in this validation session. Dev servers are user-controlled per project governance. Live OAuth/cookie flows cannot be verified through docs-only automation.

| # | Item | Status |
|---|---|---|
| 1 | Login with valid credentials redirects to `/[locale]/app` | NOT RUN |
| 2 | Wrong login credentials show inline error; no redirect | NOT RUN |
| 3 | Google and Apple OAuth buttons render with expected interaction polish | NOT RUN |
| 4 | `/login?error=oauth_failed` shows provider-agnostic error message | NOT RUN |
| 5 | `/login?error=account_conflict` shows account conflict error message | NOT RUN |
| 6 | Register with new email/password shows stay-on-page success message | NOT RUN |
| 7 | Workspace header logout calls `POST /api/auth/logout`; redirects to `/[locale]/login` | NOT RUN |
| 8 | After logout, returning to `/[locale]/app` redirects to `/[locale]/login` | NOT RUN |
| 9 | `PROJECT_FIRST_UX=true` `/[locale]/account` renders account auth section above API Keys | NOT RUN |
| 10 | zh-TW and zh-CN auth UX surfaces render localized text without raw i18n key strings | NOT RUN |
| 11 | `/[locale]/keys` unauthenticated redirects to `/[locale]/login` | NOT RUN |
| 12 | `/[locale]/driver` remains separate DRIVER_API_KEY flow; unaffected by G-family changes | NOT RUN |

Items 1–10 are from `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` Section 12. Items 11–12 are supplemental additions from the G4 stage-start.

---

## No Production Source Files Changed

This task is validation and documentation only. Confirmed:

- No frontend source files modified
- No backend source files modified
- No message JSON files modified
- No new dependencies added
- `frontend/tsconfig.tsbuildinfo` touched by build and restored; not left as a tracked change

---

## Non-Goals Confirmed

- No new source code changes
- No new features
- No refactoring
- No backend changes
- No OAuth implementation changes
- No email verification
- No workspace redesign
- No keys page token migration

---

## Invariants Preserved

- All 256 automated tests pass (up from 253 after G2 + 3 new after G3)
- All 3 G2 OAuth error banner tests pass directly
- All 3 pre-existing keys page auth bootstrap tests pass directly
- Cookie-session auth behavior unchanged
- Login/register page structure unchanged
- OAuth button interaction polish (G2) preserved
- Logout button behavior (G3) preserved
- `account/page.tsx` redirect behavior preserved
- All i18n keys in all three locales preserved
- No `frontend/tsconfig.tsbuildinfo` modification left in working tree

---

## Deferred Items (Non-Blocking for AUTH-APP-01G Closure)

These items were identified during AUTH-APP-01G1 inventory and explicitly scoped out of all G-family slices in `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` Section 14:

| Item | Detail | Target |
|---|---|---|
| `login.testCredentials` dead i18n key | Key exists in all three locales but is never rendered | Future task |
| `register.name` dead i18n key | Key exists in all three locales but no name field is rendered | Future task |
| Keys page raw Tailwind classes | `keys/page.tsx` uses zero UX-IA-02 tokens — pre-existing since before UX-IA-02 | Future task |
| Google callback hardcodes `oauth_failed` | Backend always emits `oauth_failed` regardless of error type; Apple-only for `account_conflict` | Documentation only — no change needed |

AUTH-APP-01F carry-forwards are tracked under the AUTH-APP-01F family boundary, not under AUTH-APP-01G.

---

## Next Recommended Task

**AUTH-APP-01H — Security Hardening + Validation Checklist** (pending).

AUTH-APP-01C2 remains BLOCKED pending transactional email provider selection.

---

## Reference

- `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` — governing scope for AUTH-APP-01G (Section 12 for G4)
- `docs/AUTH-APP-01G-CHECKPOINT.md` — parent/family checkpoint for AUTH-APP-01G
- `docs/AUTH-APP-01G1-CHECKPOINT.md` — G1 inventory and scope
- `docs/AUTH-APP-01G2-CHECKPOINT.md` — G2 OAuth error + button polish
- `docs/AUTH-APP-01G3-CHECKPOINT.md` — G3 logout + account surface
- `TASKS.md` → AUTH-APP-01G4
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01G4
