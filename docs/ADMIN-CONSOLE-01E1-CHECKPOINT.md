# ADMIN-CONSOLE-01E1 Checkpoint

**Task:** ADMIN-CONSOLE-01E1 — Invalid Locale Redirect Origin Fix  
**Status:** COMPLETE AND LOCKED — 2026-08-08  
**Parent:** ADMIN-CONSOLE-01E (ACTIVE — Step 4 consolidation now unblocked)  
**Grandparent:** ADMIN-CONSOLE-01 (ACTIVE)  
**Workflow:** 3-step blocker (registration + investigation → implementation + focused validation → consolidation + staging re-smoke)  
**Commit:** `4d431e3da9a89e548e88ba3b10d6f378eb988135`  
**Commit message:** `fix(i18n): preserve public origin for locale redirects`

---

## Blocking Context Resolved

**Original defect (ADMIN-CONSOLE-01E Step 3 PASS WITH LIMITATIONS blocker):**

`https://staging.ainow.biz/zh-tw/login` → browser redirected to `https://localhost:3002/en/zh-tw/login`

This exposed the internal Next.js bind address (`localhost:3002`) to the browser, blocking ADMIN-CONSOLE-01E Step 4 consolidation.

**Resolution:**

`https://staging.ainow.biz/zh-tw/login` → browser redirected to `https://staging.ainow.biz/zh-TW/login`

No localhost in any tested redirect path.

---

## Root Cause (Confirmed — Step 1 Investigation)

**Bug A — Case-sensitive locale matching:**  
`hasLocalePrefix()` in `frontend/middleware.ts` compared the incoming path segment against the literal array `['en', 'zh-TW', 'zh-CN']` using exact/case-sensitive comparison. `/zh-tw/` did not match `/zh-TW/`, so the path fell through to the default redirect handler, which prefixed `/en` and produced `/en/zh-tw/login`.

**Bug B — localhost:3002 redirect origin:**  
The default redirect handler cloned `request.nextUrl`. In Next.js 15 middleware running behind Caddy, `request.nextUrl` is constructed from the server's internal bind address (`localhost:3002`), not from the `Host` or `X-Forwarded-Host` header. Cloning `request.nextUrl` and redirecting produced `Location: https://localhost:3002/en/zh-tw/login`.

**Files responsible:** `frontend/middleware.ts` only.

---

## Implementation Summary

**Files changed:**

1. `frontend/middleware.ts` — production fix
2. `frontend/middleware.test.ts` — focused test suite (new file)

**No other files changed.** No backend, no env, no Caddy, no translation files, no dependencies.

**Changes to `frontend/middleware.ts`:**

- Added `normalizeLocale()` helper: case-insensitive lookup against supported locales (`en`, `zh-TW`, `zh-CN`); returns canonical casing if matched, `null` otherwise.
- `hasLocalePrefix()` updated: uses `normalizeLocale()` for case-insensitive detection; case-mismatched locales (e.g., `zh-tw`) trigger a canonical-casing redirect (`/zh-TW/login`) instead of falling to the default handler.
- Default redirect origin construction: replaced `request.nextUrl.clone()` origin with a URL constructed from forwarded headers — `x-forwarded-host` (falls back to `host`, then `request.nextUrl.host`); `x-forwarded-proto` (falls back to `request.nextUrl.protocol`). Both headers are bounded/sanitized; malformed inputs fall back safely.
- Existing default-English fallback preserved.
- Query strings preserved through all redirect paths.
- Skip rules (`/api`, `/_next`, `/favicon.ico`, file extension) preserved.

---

## Local Validation

| Check | Result |
|---|---|
| Focused middleware tests (`frontend/middleware.test.ts`) | **17 / 17 PASS** |
| Full frontend test suite | **644 / 644 PASS** |
| TypeScript (`npx tsc --noEmit`) | **PASS** |
| `tsconfig.tsbuildinfo` | Restored (not committed) |

---

## Staging Deployment Evidence

| Item | Value |
|---|---|
| Pre-deploy staging HEAD | `60fba74e02256f0a3ed3e757350e6d7117e5ceda` |
| Post-deploy staging HEAD | `4d431e3da9a89e548e88ba3b10d6f378eb988135` |
| Deployment method | `git fetch origin` + `git merge --ff-only origin/main` |
| Files changed on staging | `frontend/middleware.ts`, `frontend/middleware.test.ts` only |
| Frontend build | `npm run build` — PASS |
| PM2 restart | `aisandbox-frontend` only |
| PM2 restart result | PASS — online |

**Final PM2 restart counts (post-deploy):**

| Service | Restarts |
|---|---|
| aisandbox-ai-service | 3 |
| aisandbox-api-gateway | 216 |
| aisandbox-container-manager | 0 |
| aisandbox-frontend | 8 |

All services online. No unrelated service restarted.

**Frontend HTTP check:** `https://staging.ainow.biz/en/login` — HTTP 200

**Final staging Git state:**

- Branch: `main`
- HEAD: `4d431e3da9a89e548e88ba3b10d6f378eb988135`
- `origin/main` up to date
- Working tree clean

---

## Browser Re-Smoke Evidence (Step 3 PASS Gate)

All 8 cases executed against `https://staging.ainow.biz` after deployment.

| Case | Input URL | Expected Final URL | Result |
|---|---|---|---|
| A | `/zh-tw/login` | `/zh-TW/login` | **PASS** — `https://staging.ainow.biz/zh-TW/login` — no localhost |
| B | `/zh-cn/login` | `/zh-CN/login` | **PASS** — `https://staging.ainow.biz/zh-CN/login` — no localhost |
| C | `/login` | `/en/login` | **PASS** — `https://staging.ainow.biz/en/login` — no localhost |
| D | `/en/login` | loads normally | **PASS** — canonical route, no unexpected redirect |
| E | `/zh-TW/login` | loads normally | **PASS** — canonical route, no unexpected redirect |
| F | `/zh-CN/login` | loads normally | **PASS** — canonical route, no unexpected redirect |
| G | `/zh-tw/login?test=1` | `/zh-TW/login?test=1` | **PASS** — `https://staging.ainow.biz/zh-TW/login?test=1` — query preserved |
| H | `/fr/login` | `/en/fr/login` | **PASS** — `https://staging.ainow.biz/en/fr/login` — fallback semantics preserved, no localhost |

**Step 3 PASS Gate verdict: ALL 10 CRITERIA SATISFIED**

| # | Criterion | Result |
|---|---|---|
| 1 | `/zh-tw/login` → `staging.ainow.biz/zh-TW/login` | PASS |
| 2 | `/zh-cn/login` → `staging.ainow.biz/zh-CN/login` | PASS |
| 3 | `/login` → `staging.ainow.biz/en/login` | PASS |
| 4 | Canonical `/en/login`, `/zh-TW/login`, `/zh-CN/login` load normally | PASS |
| 5 | Query string `?test=1` preserved through redirect | PASS |
| 6 | Unsupported locale fallback remains on `staging.ainow.biz` | PASS |
| 7 | No tested redirect contains `localhost:3002` or any localhost origin | PASS |
| 8 | Frontend build exited with 0 errors | PASS |
| 9 | `aisandbox-frontend` stable after PM2 restart | PASS |
| 10 | No unrelated services restarted or changed | PASS |

---

## Security Assessment

- **Open redirect:** Not introduced. Redirect origin is derived from `x-forwarded-host` (bounded to Caddy-controlled headers); no user-controlled input is accepted as origin.
- **Host header injection:** `x-forwarded-host` is only trusted when supplied; malformed/missing forwarded-host falls back to `request.nextUrl.host` (internal bind address — safe for redirect construction in trusted-proxy deployment). Automated tests cover malformed forwarded-host inputs.
- **No secrets introduced.**
- **No auth behavior changed.**
- **No internal API exposure.**

---

## Original Blocker Resolution

| Scenario | Before fix | After fix |
|---|---|---|
| `https://staging.ainow.biz/zh-tw/login` | `https://localhost:3002/en/zh-tw/login` ✗ | `https://staging.ainow.biz/zh-TW/login` ✅ |

**ORIGINAL BLOCKER: RESOLVED.**

---

## Governance Impact

- **ADMIN-CONSOLE-01E1:** COMPLETE AND LOCKED — 2026-08-08
- **ADMIN-CONSOLE-01E:** ACTIVE — Step 4 consolidation now unblocked. Step 3 PASS WITH LIMITATIONS verdict remains valid; limitation (locale redirect localhost origin) is resolved by this checkpoint.
- **ADMIN-CONSOLE-01:** ACTIVE — 01A–01D COMPLETE AND LOCKED; 01E ACTIVE (Steps 1–3 done; Step 4 unblocked); parent NOT COMPLETE.
- **PRIVATE-BETA-INVITE-01:** NOT STARTED — blocked until ADMIN-CONSOLE-01 COMPLETE AND LOCKED.

**Exact next step:** ADMIN-CONSOLE-01E Step 4 — Consolidation (new window).

---

## Lock Notice

ADMIN-CONSOLE-01E1 is COMPLETE AND LOCKED.  
Do not modify this checkpoint document.  
Do not reopen or re-implement without explicit approval.

*Checkpoint created by Cursor/Sonnet 4.6 — 2026-08-08*
