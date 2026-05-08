# AUTH-APP-01H4 Checkpoint — Manual Smoke + Secrets Audit + Final AUTH-APP-01H Consolidation

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-01H4 |
| Title | Manual Smoke + Secrets Audit + Final AUTH-APP-01H Consolidation |
| Family | AUTH |
| Parent | AUTH-APP-01H (VALIDATION COMPLETE — manual smoke deferred) |
| Status | COMPLETE and LOCKED |
| Nature | VALIDATION AND GOVERNANCE ONLY — no production source files changed |
| Date | 2026-05-08 |
| Depends on | AUTH-APP-01H3 (COMPLETE and LOCKED) |
| Spec | `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md` |

---

## Objective

Run the secrets grep audit, reconfirm targeted automated validation from H2/H3, record manual smoke disposition, and produce the H4 task checkpoint and the AUTH-APP-01H family summary checkpoint. This is a validation and governance slice only — no production source code is modified.

---

## Secrets Audit

### Method

`git grep` used as the primary tool. `git grep` searches only tracked files and inherently excludes `node_modules`, `dist`, `.next`, `coverage`, and all untracked artifacts.

### First-pass audit finding — CRITICAL (resolved before H4 completion)

During the initial secrets audit run, two tracked files were found containing real API credentials:

- `.envxxx` — tracked by git index; contained an active (uncommented) assignment of a real Anthropic API key
- `.env.prod` — tracked by git index; contained a commented real Anthropic API key and a commented real XAI API key

Both files also contained `REDIS_PASSWORD=aisandboxredis123` (a real dev Redis password).

**H4 was paused immediately upon discovery.** No checkpoints were created and no automated validation was run while the exposure existed.

### Local cleanup performed (user action, prior to resuming H4)

- `.envxxx` and `.env.prod` were removed from git tracking
- `git log --all -- .envxxx .env.prod` returned no output — confirmed absent from history
- `git ls-files` for `.envxxx`, `.env.prod`, `.env`, `*/.env` returned no tracked env files
- `git status --short` returned clean

### Post-cleanup audit results

Commands run from `C:\Users\knlee\aiSandBox2026B`:

| Command | Result |
|---|---|
| `git ls-files "*.p8"` | No output — CLEAN |
| `git ls-files -- ".env" ".envxxx" ".env.prod" "*/.env" "*/.env.local" "*/.env.production"` | No output — CLEAN |
| `git grep -rn "BEGIN PRIVATE KEY"` | 2 matches — both safe (see below) |
| `git grep -rn "BEGIN EC PRIVATE KEY"` | No output — CLEAN |
| `git grep -rn "BEGIN RSA PRIVATE KEY"` | No output — CLEAN |
| `git grep -l "GOCSPX-"` | No output — CLEAN |
| `git grep -l "AIzaSy"` | No output — CLEAN |
| `git grep -rn "sk-ant-"` | Matches — all safe (see below) |
| `git grep -l "sk-proj-"` | 1 file — safe (see below) |
| `git grep -rn "APPLE_PRIVATE_KEY"` | Multiple matches — all safe (variable name refs, docs, placeholder) |
| `git grep -rn "GOOGLE_CLIENT_SECRET"` | Multiple matches — all safe (variable name refs, docs, placeholder) |
| `git grep -rn "change_this_in_production"` | Multiple matches — all safe (fallback defaults in source + `.env.example` placeholders) |
| `git status --short` | No output — working tree clean |

### PEM header matches — both expected and safe

1. `services/api-gateway/.env.example:27` — placeholder: `-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----`
2. `services/api-gateway/src/auth/__tests__/apple.strategy.spec.ts:15` — test value: `'-----BEGIN PRIVATE KEY-----\\nabc123\\n-----END PRIVATE KEY-----'`

Neither contains real key material.

### `sk-ant-` matches — all safe

All remaining `sk-ant-` hits are one of:
- `.env.example` and docs placeholders: `sk-ant-your-api-key-here`, `sk-ant-...`
- Test values: `sk-ant-test`, `sk-ant-short`, `sk-ant-api03-1234567890abcdef...` (synthetic)
- Source code prefix strings: `apiKeyPrefix: 'sk-ant-'`, `startsWith('sk-ant-')`
- Error message fragments in test assertions (negation checks)

No real production `sk-ant-api03-` key values remain in any tracked file.

### `sk-proj-xxxxx` match — safe

`.cursor/rules/typescript-security.md:14` — example in a security rule file: `const apiKey = "sk-proj-xxxxx"`. This is a placeholder, not a real key.

### `APPLE_PRIVATE_KEY` and `GOOGLE_CLIENT_SECRET` — all safe

All matches are variable name references in source, docs, spec documents, and placeholder values in `.env.example` files. No real assigned credential values exist in any tracked file.

### `change_this_in_production` — all safe

Matches appear only as:
- Fallback default strings in `api-gateway/src/auth/auth.module.ts`, `jwt.strategy.ts`, `main.ts`, `container-manager/src/previews/previews.controller.ts` — correct usage pattern (fallback when env var not set)
- `.env.example` placeholder values — correct
- Spec and architecture docs — documentation only

No real production secret uses this string as its actual value.

### `.env.example` visual inspection — `services/api-gateway/.env.example`

All required OAuth/session variables confirmed as placeholder-only:

| Variable | Value in `.env.example` | Safe |
|---|---|---|
| `JWT_SECRET` | `change_this_in_production_use_a_long_random_string` | ✓ |
| `SESSION_SECRET` | `change_this_in_production_use_a_different_long_random_string` | ✓ |
| `OAUTH_STATE_SECRET` | `change_this_in_production_use_a_separate_long_random_string` | ✓ |
| `GOOGLE_CLIENT_ID` | `your_google_client_id` | ✓ |
| `GOOGLE_CLIENT_SECRET` | `your_google_client_secret` | ✓ |
| `GOOGLE_CALLBACK_URL` | `http://localhost:4000/api/auth/google/callback` | ✓ |
| `APPLE_CLIENT_ID` | `your_apple_services_id` | ✓ |
| `APPLE_TEAM_ID` | `your_apple_team_id` | ✓ |
| `APPLE_KEY_ID` | `your_apple_key_id` | ✓ |
| `APPLE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----` | ✓ |
| `APPLE_CALLBACK_URL` | `http://localhost:4000/api/auth/apple/callback` | ✓ |

### Secrets audit verdict

**CLEAN** — no real credentials exist in any tracked source file after cleanup. Working tree is clean.

### Mandatory follow-up (outside H4 scope — user action required)

The Anthropic key and XAI key that were previously committed must be treated as compromised regardless of the local history cleanup. They must be rotated at the provider console before any future deployment or push of this repository. The Redis password `aisandboxredis123` should be rotated if that instance is reachable from any network.

---

## Automated Validation

### api-gateway TypeScript typecheck

```powershell
Set-Location "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx tsc --noEmit
```

**Result: PASS** (exit 0, no errors)

### api-gateway targeted tests — csrf.guard (H2) + events.controller.guard (H3) + ai-execution-guards (H3)

```powershell
Set-Location "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
npx jest --testPathPatterns="csrf.guard|events.controller.guard|ai-execution-guards" --runInBand
```

**Result: PASS**

| Suite | Tests | Result |
|---|---|---|
| `csrf.guard.spec.ts` | 5 | PASS |
| `events.controller.guard.spec.ts` | 4 | PASS |
| `ai-execution-guards.integration.spec.ts` | 31 | PASS |
| **Total** | **40** | **PASS** |

### container-manager TypeScript typecheck

```powershell
Set-Location "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npx tsc --noEmit
```

**Result: PASS** (exit 0, no errors)

### container-manager files tests

```powershell
Set-Location "C:\Users\knlee\aiSandBox2026B\services\container-manager"
npm test -- files --runInBand
```

**Result: PASS** — 2/2 (`files.service.spec.ts`)

### Frontend

Not run. H4 creates no frontend files. H2 frontend changes were validated at H2 (256 tests PASS, build PASS, typecheck PASS). No drift risk — H3 and H4 do not touch frontend.

### Full `npm test`

Not run — Redis environment constraint remains (pre-existing since AUTH-APP-01B). Targeted test strategy is the established workaround. This is not a regression.

---

## Lint Disposition

`npm run lint` was added in H3 (ESLint config file created). H3 result: **353 pre-existing errors** across many unrelated files. The H3-touched file (`ai-execution-guards.integration.spec.ts`) no longer appears in lint output.

H4 adds no source files. Lint baseline is unchanged from H3. `npm run lint` was not rerun in H4 — no new lint surface exists.

**Status:** 353 pre-existing errors remain. Carry-forward to a dedicated lint cleanup slice.

---

## Manual Smoke Checklist

**Status: NOT RUN — deferred to user live environment.**

**Reason:** No live Docker/PostgreSQL/Redis/api-gateway/frontend/browser environment is available in this validation session. Dev servers are user-controlled per project governance (`CLAUDE.md`). Live OAuth flows, cookie behavior, CSRF enforcement, and rate limiting cannot be verified without a running environment.

### F-family (22 items from `docs/AUTH-APP-01F4-CHECKPOINT.md`)

All 22 items: **NOT RUN**

These items have been deferred continuously since AUTH-APP-01F4. They remain pending against a live environment.

### G-family (12 items from `docs/AUTH-APP-01G4-CHECKPOINT.md`)

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
| 10 | zh-TW and zh-CN auth UX surfaces render localized text without raw key strings | NOT RUN |
| 11 | `/[locale]/keys` unauthenticated redirects to `/[locale]/login` | NOT RUN |
| 12 | `/[locale]/driver` remains separate DRIVER_API_KEY flow; unaffected by G-family | NOT RUN |

### H-specific (6 items)

| # | Item | Status |
|---|---|---|
| H1 | After login, `aisandbox_csrf` cookie is present, `httpOnly: false`, readable by frontend JS | NOT RUN |
| H2 | `POST /api/auth/logout` without `X-CSRF-Token` header returns 403; frontend still redirects and clears workspace state | NOT RUN |
| H3 | `POST /api/auth/login` with 11 rapid requests within 60 s returns 429 on the 11th | NOT RUN |
| H4 | `POST /api/auth/register` with 6 rapid requests within 60 s returns 429 on the 6th | NOT RUN |
| H5 | `POST /api/auth/apple/callback` succeeds without `X-CSRF-Token` (CSRF exclusion confirmed) | NOT RUN |
| H6 | `POST /api/events/file-changed` without `X-Internal-Service-Key` returns 403 | NOT RUN |

**Total deferred: 22 (F-family) + 12 (G-family) + 6 (H-specific) = 40 items, all NOT RUN.**

### Smoke item correction note

The H1 spec (Section 11) originally listed: *"POST to `/api/auth/login` without `X-CSRF-Token` header returns 403 (if CSRF fully implemented)"*. This is factually incorrect relative to the actual H2 implementation. `CsrfGuard` is applied only to `POST /api/auth/logout`. Login and register are public entry points with no active session — they are deliberately excluded from CSRF enforcement. The corrected item H2 above reflects the actual implementation.

---

## Files Changed

| File | Change |
|---|---|
| `docs/AUTH-APP-01H4-CHECKPOINT.md` | **Created** — this document |
| `docs/AUTH-APP-01H-CHECKPOINT.md` | **Created** — AUTH-APP-01H family summary |
| `TASKS.md` | AUTH-APP-01H4 → COMPLETE and LOCKED; AUTH-APP-01H parent → VALIDATION COMPLETE; current stage → AUTH-APP-01Z |
| `TASKS_BACKLOG_FULL.md` | Same status updates; checkpoint references added |

**Production source files changed: None.**

---

## Non-Goals Confirmed

- No production source file edits of any kind
- No new features added
- No refactoring
- No auth endpoint changes
- No CSRF/rate-limiting changes
- No container-manager changes
- No frontend changes
- No dependency additions
- No repo-wide lint cleanup
- No AUTH-APP-01C2 work (BLOCKED — email provider not chosen)
- No preview proxy auth implementation
- No manual smoke execution (deferred to user live environment)

---

## Risks and Carry-Forwards

| Item | Severity | Status |
|---|---|---|
| Anthropic and XAI provider keys found in prior git commits must be rotated before any future push/deployment | CRITICAL | User action required — outside H4 scope |
| Preview proxy `/api/preview/*` fully open — no auth | MEDIUM | Carry-forward — dedicated future investigation slice |
| api-gateway lint baseline — 353 pre-existing errors | LOW | Carry-forward — separate lint cleanup slice |
| Backend full `npm test` — Redis environment constraint | LOW | Carry-forward — targeted test strategy sufficient |
| 40 manual smoke items deferred | MEDIUM | Deferred to user live environment |
| In-memory throttler state resets on api-gateway restart during smoke testing | LOW | Known H2 limitation; documented |

---

## Reference

- `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md` — governing spec
- `docs/AUTH-APP-01H1-CHECKPOINT.md` — H1 inventory
- `docs/AUTH-APP-01H2-CHECKPOINT.md` — H2 CSRF + rate limiting
- `docs/AUTH-APP-01H3-CHECKPOINT.md` — H3 events guards + tooling
- `docs/AUTH-APP-01H-CHECKPOINT.md` — H-family summary (this session)
- `TASKS.md` → AUTH-APP-01H4
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01H4

---

## Next Recommended Task

**AUTH-APP-01Z — Final AUTH-APP-01 Consolidation (PLANNED — next)**

AUTH-APP-01C2 remains BLOCKED pending transactional email provider selection. AUTH-APP-01Z does not depend on AUTH-APP-01C2. The preview proxy investigation and lint cleanup remain as separate carry-forward slices not blocking AUTH-APP-01Z.
