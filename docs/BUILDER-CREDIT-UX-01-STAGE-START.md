# BUILDER-CREDIT-UX-01 — Stage-start / implementation freeze

**Task ID:** BUILDER-CREDIT-UX-01
**Title:** Builder credit visibility and 402 error UX
**Date:** 2026-09-16
**Nature:** IMPLEMENTATION — authenticated Builder workspace credit-balance display + Ask/Build 402 mapping; multilingual-first; no Stripe; no credit mutation
**Lifecycle:** 4-step IMPLEMENTATION
**Step:** 3 COMPLETE — frozen write-set implementation
**Step status:** Step 1 COMPLETE — 2026-09-16 (registration / control-plane only; registered at `a69a0b6`); Step 2 COMPLETE — 2026-09-16; Step 3 COMPLETE — 2026-09-16 (implementation; not admitted; not LOCKED); Step 4 NOT AUTHORIZED
**This document:** Authoritative Step 2 freeze for BUILDER-CREDIT-UX-01, plus Step 3 completion status. It does **not** authorize Step 4 lock, admission, runtime, browser, Stripe/top-up, credit-ledger mutation, Harness, orchestration, apex cutover, invitations, or EXEC-01C6A reopen.

**Step 1 registered HEAD (user-supplied; not re-queried this window):** `a69a0b6`
**Occupancy hash (end-state):** `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d` (Lane 1 EMPTY, Lane 2 EMPTY, GOVERNANCE UNOWNED)

```
STEP1_COMPLETE=YES
STEP2_COMPLETE=YES
STEP2_AUTHORIZED=YES
STEP3_AUTHORIZED=YES
STEP3_COMPLETE=YES
STEP4_AUTHORIZED=NO
LOCKED=NO
IMPLEMENTATION_STARTED=YES
ADMITTED=NO
WRITE_SET_PRECISION=EXACT
CANDIDATE_STATUS=READY
ADMISSION_UNCERTAIN=true
TEST_ADMISSIBLE=ADMISSION_UNCERTAIN
MUTEXES_DECLARED=FRONTEND,I18N
MUTEXES_ACQUIRED=NO (end-state UNOWNED after Step 3 write)
CREDIT_MUTEX=UNDECLARED
CREDIT_MUTATION_AUTHORIZED=NO
STRIPE=NO
TOP_UP=NO
HARNESS_ENABLEMENT=NO
ORCHESTRATION=NO
APEX_ROUTING=NO
EXEC_01C6A_REOPENED=NO
EXEC_01C6A_START_CONDITION=NOT_READY
BUILDER_LIVE_GATE_01=COMPLETE AND LOCKED / LEFT_ON
LANE_1=EMPTY
LANE_2=EMPTY
LANE_3=DISABLED
GOVERNANCE=UNOWNED (end-state)
PRIVATE_BETA_INVITE_01=PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
FOLLOW_ON_REGISTERED=NO
RUNTIME=NO
BROWSER=NO
GIT_COMMIT=NO
```

Keith authorized this Step 3 implementation only. Occupancy remains EMPTY. Sidecar candidate remains `status=READY` / `writeSetPrecision=EXACT` / `admissionUncertain=true` so the candidate is **not** in S (`Test-Admissible` = ADMISSION_UNCERTAIN). Do **not** admit Lane 1 or Lane 2. Do **not** start Step 4. Do **not** register follow-on tasks. Do **not** reopen AGENT-PLATFORM-EXEC-01C6A. BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON.

---

## 1. Inherited product / architecture facts (must not reopen)

- `PRD.md` CURRENT includes free-plan credit allocation, Ask/Build consumption, balance enforcement, a billing page/balance display, governed insufficient-credit errors, and multilingual UI.
- `ARCHITECTURE.md` records `CreditBalanceGuard` on execute as CURRENT HOW.
- Stripe / live payment / credit top-up remains APPROVED FUTURE.
- Locked BILLING-READY-04 / 04A / 04B / 04D locked the guard and deferred frontend billing error UX; they are not this Builder workspace slice.
- Locked PREVIEW-NODE-01 / PREVIEW-NODE-STAGING-01 / PREVIEW-NODE-STAGING-APPLY-01 closed the Vite/node preview chain. They are sequencing context, not machine `dependsOn`.
- BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON (`GLOBAL_EXECUTION_ENABLED=true`).
- Working single-shot Builder Ask/Build remains the product to complete, not to replace.
- Product-visible Harness / orchestration / apex production routing / invitations remain FUTURE/gated.
- EXEC-01C6A remains `startCondition=NOT_READY` / not reopened.
- This freeze surfaces the already-CURRENT credit model in the authenticated Builder workspace. It does not rewrite `PRD.md` or `ARCHITECTURE.md`.

---

## 2. Source-grounded current state (registration HEAD `a69a0b6`)

### 2.1 Authenticated Builder workspace

- Route: `frontend/app/[locale]/app/page.tsx` (`/[locale]/app`).
- Shell: `frontend/components/workspace/workspace-shell.tsx`.
- Persistent usage surface: `frontend/components/workspace/workspace-sidebar.tsx` compact usage panel `data-testid="workspace-sidebar-compact-usage"`.
- That panel currently shows plan name/status, **Active sessions**, and **Tokens**. It is shown only when the sidebar is expanded and `userSummary`, `usageSummary`, and `quotaSummary` are all present (`canShowCompactUsage`). Collapsed rail hides the panel.
- Token/session quota is loaded in `page.tsx` via `GET /api/users/me/quotas` (with `/api/users/me` and `/api/users/me/usage`) and passed through `WorkspaceShell` → `WorkspaceSidebar`.
- Diagnostic dashboard cards in `workspace-shell.tsx` (`DashboardSummary`, `data-testid="dashboard-summary-cards"`) also show sessions/tokens with hardcoded English. They are not the product usage surface for this slice.

### 2.2 Existing credit-balance read path

- Canonical read: `GET /api/billing/balance` (`services/api-gateway/src/billing/billing-read.controller.ts`).
- Session-cookie protected. No credit mutation. No API-key access.
- Response shape (`BillingBalanceResponse`): `{ balance, monthlyAllocation, planId, periodStart, periodEnd, status }`.
- If no ledger row exists, the endpoint still returns HTTP 200 with `balance: 0`, `monthlyAllocation: 0`, `planId: 'free'`, `status: 'active'`. Display must treat this as **0**, not as execute-path `credit_balance_not_provisioned`.
- Frontend consumer today: `frontend/hooks/useBillingData.ts`, used by the billing page. That hook also fetches `GET /api/billing/subscription` in the same `Promise.all`. Subscription/top-up UI lives on the billing page (`frontend/components/billing/*`) and is out of scope.

### 2.3 Existing Ask/Build 402 contract (read-only)

`CreditBalanceGuard` (`services/api-gateway/src/billing/credit-balance.guard.ts`) rejects non-admin execute when unprovisioned or `balance <= 0`. Frozen read-only bodies:

**Unprovisioned**

```json
{
  "statusCode": 402,
  "error": "Payment Required",
  "message": "Credit balance not provisioned",
  "details": {
    "error_code": "credit_balance_not_provisioned"
  }
}
```

**Exhausted (`balance <= 0` with a provisioned row)**

```json
{
  "statusCode": 402,
  "error": "Payment Required",
  "message": "Insufficient credit balance",
  "details": {
    "error_code": "credit_balance_exhausted",
    "current_balance": 0
  }
}
```

Admin users bypass the guard. This slice must not change that.

### 2.4 Existing Ask/Build frontend error path

- `POST /api/ai/execute` failures in `page.tsx` parse JSON via `readResponseErrorMessage` (string `message` / `error` / `detail` only; **does not** read `details.error_code`).
- Guidance then goes through `toChatAssistantFailureMessage` → `toQuotaRateLimitGuidance` (`workspace-quota-usage.logic.ts`).
- That helper handles 429, quota wording, and 403. It does **not** special-case 402. BILLING-READY-04 recorded that 402 currently falls through as raw English backend `message`.
- Quota/rate-limit copy in `workspace-quota-usage.logic.ts` is hardcoded English. This slice must **not** rewrite that helper’s 403/429 behavior. Credit 402 must be mapped on a dedicated path **before** quota guidance, using i18n keys.

### 2.5 i18n

- Workspace sidebar already reads `frontend/messages/{en,zh-TW,zh-CN}.json` via `getWorkspaceScaffoldMessages`.
- Chat Ask/Build copy already uses `getAiMessages(locale)` from the same three files (`ai.*`).
- Billing page already has `billing.balance` = “Credit Balance” / “信用餘額” / “信用余额”. This slice adds **workspace-local** keys so Builder copy does not activate billing-page top-up/subscription strings.
- `workspace.upgrade` already exists on the sidebar Upgrade CTA. This slice must not retarget that button to Stripe/checkout.

---

## 3. Frozen product decisions (mandatory Step 2 questions)

### Q1. Exact Builder workspace surface

**Primary surface:** authenticated workspace left sidebar compact usage panel (`data-testid="workspace-sidebar-compact-usage"`), expanded sidebar only.

Add one dedicated credit row under the existing Active sessions and Tokens rows:

| Element | Frozen `data-testid` |
|---|---|
| Row container | `workspace-sidebar-credit-balance` |
| Numeric value | `workspace-sidebar-credit-balance-value` |
| Distinction hint | `workspace-sidebar-credit-balance-hint` |
| Loading | `workspace-sidebar-credit-balance-loading` |
| Load error | `workspace-sidebar-credit-balance-error` |

Row layout must match sessions/tokens: label left, value right. **No new icon.** Do not use `CreditCardIcon` or other payment-card imagery.

**Visibility**

- Show the credit row only when the compact usage panel is already shown (`!isCompact && canShowCompactUsage`).
- Do **not** add credit to the collapsed icon rail.
- Do **not** add credit to `DashboardSummary` / `dashboard-summary-cards` (hardcoded-English diagnostic slice; out of scope).
- Do **not** add credit to the billing page.

**Empty / loading / error**

- Loading: show `workspace.creditBalanceLoading` in the credit row only. Do not hide sessions/tokens.
- Error / fetch failure: show `workspace.creditBalanceLoadError` in the credit row only. Do not fail the whole sidebar or dashboard.
- Success: show integer `balance` with `workspace.creditBalance` label and `workspace.creditBalanceHint`.
- Unprovisioned GET `balance: 0`: display `0`. Do not render execute-path `credit_balance_not_provisioned` copy in the sidebar.

Credit props on `WorkspaceSidebar` / `WorkspaceShell` are **optional** with defaults (`creditBalance=null`, `creditBalanceLoading=false`, `creditBalanceError=false`) so existing shell/sidebar tests that omit them keep current markup. Production `page.tsx` always passes live hook values.

### Q2. Balance read path

**Do not reuse `useBillingData` as-is.** It also calls `GET /api/billing/subscription`.

**Do not narrow or wrap `useBillingData.ts`.** Leave the billing-page hook unchanged.

**Create** `frontend/hooks/useCreditBalance.ts`:

- `GET /api/billing/balance` with `credentials: 'include'` is the **only** network call.
- Must not call `/api/billing/subscription`, checkout, top-up, grant, or any POST.
- Local type may duplicate the balance JSON fields; do **not** edit `useBillingData.ts` even for a type extract.
- States: `{ balance, loading, error, refetch }` where `balance` is the numeric `balance` field (or `null` on error), `error` is `FETCH_FAILED` or `null`.
- Fetch on mount. Silent refetch on `window` `focus` (same refresh idea as the billing page; still read-only).
- On mapped Ask/Build 402, `page.tsx` must call `refetch()` so a stale positive sidebar number is not left showing.

`GET /api/billing/balance` remains the only balance read path.

### Q3. Credit vs token/session quota distinction

- Credit row label is **Credit balance** (`workspace.creditBalance`), never “Quota”, “Tokens”, or “Sessions”.
- Existing Active sessions / Tokens rows stay unchanged.
- Always show `workspace.creditBalanceHint` under the credit row: “Separate from token and session quota”.
- 402 chat copy must repeat that credit balance is separate from token and session quota.
- Tests must assert the credit label/hint and the existing tokens/sessions labels can appear together without sharing copy.

### Q4. Exact 402 mapping

Parse execute JSON once. Dedicated mapper `toCreditBalanceGuidance` in `frontend/components/workspace/workspace-credit-error.logic.ts`.

| Condition | i18n key | Show `current_balance`? |
|---|---|---|
| `statusCode===402` and `error_code==='credit_balance_exhausted'` | `ai.creditBalanceExhausted` | Yes — interpolate `{count}` from `details.current_balance`; if missing/non-numeric, use `0` |
| `statusCode===402` and `error_code==='credit_balance_not_provisioned'` | `ai.creditBalanceNotProvisioned` | No |
| `statusCode===402` and `error_code` missing/unknown | `ai.creditBalancePaymentRequired` | No |
| `statusCode!==402` | mapper returns `null` | n/a — caller keeps current quota/agent/fallback path |

Parser must read:

1. `details.error_code` / `details.current_balance` on the JSON object (guard’s frozen body)
2. top-level `error_code` / `current_balance` if a filter flattens the body
3. string `message` for fallback logging only; **do not** key off English `message` text when `error_code` is present

Do **not** render backend `error: "Payment Required"` to the user. Do **not** mention Stripe, payment, checkout, or top-up.

### Q5. Where 402 handling lives

**Dedicated mapper**, not inside `workspace-quota-usage.logic.ts`.

`page.tsx` `toChatAssistantFailureMessage` (or its execute-failure callers) must try credit guidance first when `statusCode===402`, then existing persisted-user-agent mapping, then `toQuotaRateLimitGuidance`.

`workspace-quota-usage.logic.ts` remains unchanged. Add a regression test that 402 does **not** become quota/rate-limit guidance.

Apply mapping on `POST /api/ai/execute` failure paths that already funnel through `toChatAssistantFailureMessage`. Do not add orchestration features. Do not change 403/429/agent-not-found mapping.

### Q6. Exact frontend + i18n filenames

See §5. All three locale files are mandatory.

### Q7. Tests

See §6.

### Q8. Out-of-scope confirmation

No Gateway/credit-guard/ledger edits. No Stripe/checkout/subscription/top-up activation. No Harness. No orchestration productization. No apex DNS. No invitations. No EXEC-01C6A reopen. No Ask/Build backend behavior change.

### Q9. Gate / EXEC-01C6A

Builder live gate remains ON. EXEC-01C6A remains `startCondition=NOT_READY`.

### Q10. Later Stripe/top-up child

Remains **unregistered**. Admin credit grants remain the CURRENT operator path. This freeze does not register a top-up child.

---

## 4. Frozen UI behavior

1. Authenticated `/[locale]/app` expanded sidebar compact usage panel shows credit balance as a third usage row.
2. Credit number is the integer from `GET /api/billing/balance` `balance`, formatted with the locale’s default integer grouping (`toLocaleString()` is allowed; no currency symbol; no scaling).
3. Hint always visible on success: credit is not token/session quota.
4. Loading and error are row-local.
5. Ask/Build 402 replaces the current raw English backend message with the mapped i18n string in the existing chat failure surface (`chatError` / assistant failure content). No new modal, toast, or billing redirect.
6. Upgrade CTA, billing page, admin credit-grant UI, and dashboard diagnostic cards are unchanged.
7. Zero displayed balance is valid UI. Blocking copy appears only on execute 402.

---

## 5. Exact write set

`writeSetPrecision=EXACT`. Paths are repo-relative POSIX.

### 5.1 Step 2 this window (governance only)

1. `docs/BUILDER-CREDIT-UX-01-STAGE-START.md`
2. `TASKS.md` CURRENT EXECUTION BOARD fields
3. `TASKS_BACKLOG_FULL.md` BUILDER-CREDIT-UX-01 body
4. `docs/control-plane/lane-saturation-state.json` candidate `writeSetPrecision=EXACT`, `writePaths` listed below, occupancy EMPTY, `admissionUncertain=true`
5. `docs/control-plane/SATURATION_PROOF.json` only as validator output

### 5.2 Step 3 (authorized and COMPLETE this window)

**Create:**

1. `frontend/hooks/useCreditBalance.ts`
2. `frontend/hooks/useCreditBalance.test.ts`
3. `frontend/components/workspace/workspace-credit-error.logic.ts`
4. `frontend/components/workspace/workspace-credit-error.logic.test.ts`
5. `frontend/components/workspace/workspace-sidebar-credit-balance.test.ts`

**Modify (machine `writePaths` — no `[` / `]`):**

6. `frontend/components/workspace/workspace-shell.tsx`
7. `frontend/components/workspace/workspace-sidebar.tsx`
8. `frontend/components/workspace/workspace-quota-usage.logic.test.ts`
9. `frontend/messages/en.json`
10. `frontend/messages/zh-TW.json`
11. `frontend/messages/zh-CN.json`

**Modify (human-required; FRONTEND-covered; cannot be encoded in sidecar `writePaths`):**

12. `frontend/app/[locale]/app/page.tsx` — hook wiring, structured execute-error parse, 402 mapper call, optional `refetch()` on mapped 402. GOV-OS-03 `Normalize-WritePath` rejects `[` and `]`, so this Next.js App Router file must not appear in machine `writePaths`. FRONTEND mutex `pathPrefixes: ["frontend/"]` still covers it. Omitting it from the sidecar is an encoding constraint, not permission to skip the edit or to edit other `frontend/app/` files.

Sidecar `writePaths` is exactly items 1–11, in that order. Item 12 remains a frozen Step 3 required file under FRONTEND.

### 5.3 Frozen-read (must not be written)

- `frontend/hooks/useBillingData.ts` and `frontend/hooks/useBillingData.test.ts`
- `frontend/components/billing/**`
- `frontend/components/workspace/workspace-quota-usage.logic.ts`
- `services/api-gateway/src/billing/credit-balance.guard.ts`
- `services/api-gateway/src/billing/billing-read.controller.ts`
- `services/api-gateway/src/billing/credit-deduction/**`
- admin credit-grant UI
- `PRD.md` / `ARCHITECTURE.md` / `CLAUDE.md` / `AGENTS.md`
- Harness / EXEC-01C6A / orchestration / apex / invite files

### 5.4 Explicitly excluded forever for this task unless the control plane expands scope

- Stripe, checkout, subscription mutation, customer portal, top-up packs
- Credit ledger POST/grant/deduction
- Gateway execute/credit-guard behavior
- Docker/compose/package.json/lockfiles
- Runtime, browser, staging, SSH, AWS, PM2, provider-live
- `workspace-shell.test.tsx` (existing tests must remain green via optional credit props; new render tests go in the dedicated file)

Anything outside the frozen write set is forbidden by default.

---

## 6. Frozen i18n keys and copy

Add keys only. Do not rename or reuse `billing.topUp`, `billing.buyCredits`, `billing.upgradePlan`, or `billing.checkout*`.

### 6.1 `workspace.*` (sidebar display)

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `workspace.creditBalance` | Credit balance | 信用餘額 | 信用余额 |
| `workspace.creditBalanceValue` | `{count}` | `{count}` | `{count}` |
| `workspace.creditBalanceHint` | Separate from token and session quota | 與 token 及工作階段配額不同 | 与 token 及会话配额不同 |
| `workspace.creditBalanceLoading` | Loading credit balance... | 正在載入信用餘額... | 正在加载信用余额... |
| `workspace.creditBalanceLoadError` | Credit balance unavailable | 無法載入信用餘額 | 无法加载信用余额 |

`workspace.creditBalanceValue` interpolates `{count}` with the integer balance. Sidebar may also render the number via `toLocaleString()` in the value node; tests may match the numeric digits and/or the translated label/hint.

Wire these keys through `getWorkspaceScaffoldMessages` in `workspace-sidebar.tsx`.

### 6.2 `ai.*` (Ask/Build 402 chat)

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `ai.creditBalanceExhausted` | Ask/Build is blocked because your credit balance is {count}. Credit balance is separate from token and session quota. | Ask/Build 已停用，因為你的信用餘額為 {count}。信用餘額與 token 及工作階段配額不同。 | Ask/Build 已停用，因为你的信用余额为 {count}。信用余额与 token 及会话配额不同。 |
| `ai.creditBalanceNotProvisioned` | Ask/Build is blocked because a credit balance has not been provisioned for this account. Credit balance is separate from token and session quota. | Ask/Build 已停用，因為此帳戶尚未配置信用餘額。信用餘額與 token 及工作階段配額不同。 | Ask/Build 已停用，因为此账户尚未配置信用余额。信用余额与 token 及会话配额不同。 |
| `ai.creditBalancePaymentRequired` | Ask/Build is blocked because credit is required. Credit balance is separate from token and session quota. | Ask/Build 已停用，因為需要信用餘額。信用餘額與 token 及工作階段配額不同。 | Ask/Build 已停用，因为需要信用余额。信用余额与 token 及会话配额不同。 |

`page.tsx` must resolve these through existing `getAiMessages(locale)` and pass the already-translated strings (with `{count}` replaced) into the mapper. Do not add hardcoded English credit copy in TSX/TS.

Copy rules:

- Must mention Ask/Build blocking on 402 keys
- Must distinguish credit from token/session quota
- Must not mention Stripe, payment card, checkout, buy, top-up, or upgrade

---

## 7. Tests and verification plan

Evidence class: **LOCAL-TESTS**. No Docker/Postgres/Redis. No browser. No provider-live. No credit mutation.

### 7.1 Required tests (Step 3, later)

**Balance render** (`workspace-sidebar-credit-balance.test.ts`):

1. Expanded sidebar with quota summaries + `creditBalance=12` renders `workspace-sidebar-credit-balance`, shows `12`, label “Credit balance”, and hint “Separate from token and session quota”, and still shows Active sessions and Tokens.
2. zh-TW / zh-CN render the frozen labels/hints from §6.1 (no leftover English credit label).
3. `creditBalanceLoading=true` renders `workspace-sidebar-credit-balance-loading` and does not hide tokens/sessions.
4. `creditBalanceError=true` renders `workspace-sidebar-credit-balance-error`.
5. Default/omitted credit props do not render the credit row (existing compact-usage markup unchanged).
6. Compact/collapsed sidebar still does not render `workspace-sidebar-compact-usage` (credit does not appear on the icon rail).

**Balance read path** (`useCreditBalance.test.ts`):

7. Initial fetch calls only `GET /api/billing/balance` with `credentials: 'include'`.
8. Successful JSON `{ balance: 42, ... }` exposes numeric `42` with no scaling.
9. HTTP error sets `FETCH_FAILED` and `balance=null` (does not invent a number).
10. Unprovisioned 200 `{ balance: 0, ... }` exposes `0`.
11. Source contract: file must contain `/api/billing/balance`; must **not** contain `/api/billing/subscription`, `stripe`, `checkout`, `topUp`, `top-up`, or any `method: 'POST'`.

**402 mapping** (`workspace-credit-error.logic.test.ts`):

12. 402 + `credit_balance_exhausted` + `current_balance: 0` → exhausted copy with `0`.
13. 402 + `credit_balance_exhausted` + `current_balance: 3` → exhausted copy with `3`.
14. 402 + `credit_balance_exhausted` without `current_balance` → exhausted copy with `0`.
15. 402 + `credit_balance_not_provisioned` → not-provisioned copy (no `{count}` leak).
16. 402 + missing/unknown `error_code` → generic payment-required copy.
17. 403 quota-like and 429 inputs return `null` (quota path unchanged).
18. Non-402 with the English string “Insufficient credit balance” returns `null` (do not key off message text).

**Quota path regression** (`workspace-quota-usage.logic.test.ts` only; do not edit `.ts`):

19. `statusCode: 402` with raw “Insufficient credit balance” still returns that raw string from `toQuotaRateLimitGuidance` (not quota/rate-limit guidance). Existing 403/429 tests remain green.

**No Stripe / no ledger mutation** (source assertions in the new hook test and/or credit-error test):

20. Frozen write-set Step 3 files listed in §5.2 must not contain `stripe`, `checkout`, `topUp`, `/api/billing/subscription`, `/api/admin/credit`, or credit-grant POST URLs.
21. `useCreditBalance.ts` performs GET only.

Do not add Playwright/browser tests in this task. Do not add Gateway/credit-guard tests. Do not mutate `workspace-shell.test.tsx` unless a later control-plane expansion is required to keep it green; optional credit props are the freeze that should keep it green without editing that file.

### 7.2 Step 3 verification commands (authorized and COMPLETE this window)

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; node --import tsx --test hooks/useCreditBalance.test.ts components/workspace/workspace-credit-error.logic.test.ts components/workspace/workspace-quota-usage.logic.test.ts components/workspace/workspace-sidebar-credit-balance.test.ts
```

If the repo’s `npm test` runner is the established equivalent and stays inside these files plus already-green neighbors, it may be used instead. Do not start Next/dev servers.

If `npm run build` is later authorized and dirty `frontend/tsconfig.tsbuildinfo`, restore it.

### 7.3 Step 2 this window

```powershell
powershell -NoProfile -File "C:\Users\knlee\aiSandBox2026B\scripts\validate-lane-capacity.ps1"
git -C "C:\Users\knlee\aiSandBox2026B" diff --check
```

No frontend tests. No tsc. No runtime. No browser.

---

## 8. Mutexes / runtime needs (declared, not acquired now)

| Item | Step 2 (this window) | Step 3 (later authorization) |
|---|---|---|
| GOVERNANCE | Held for this doc/board/registry/sidecar write, then released UNOWNED | Held only if later admission/lock requires board writes |
| FRONTEND | Declared, **not acquired** | Acquire only if Step 3 is admitted |
| I18N | Declared, **not acquired**; atomic 3-file lease | Acquire only if Step 3 is admitted |
| CREDIT | Undeclared | Still undeclared. Read-only display + 402 mapping |
| GATEWAY | Undeclared | Still undeclared |
| LOCAL-RUNTIME | Undeclared | Still undeclared |
| STAGING | Undeclared | Still undeclared |
| PROVIDER-LIVE | Undeclared | Still undeclared |
| HOTFILE | none | none; I18N covers the three message files |

`stagingAuthorized=false`. `STAGING_EXECUTION_AUTHORIZED=NO`. `PROVIDER_LIVE_AUTHORIZED=NO`. `CREDIT_MUTATION_AUTHORIZED=NO`. `LOCAL_RUNTIME_AUTHORIZED=NO`.

Admission remains **not** performed. `admissionUncertain=true` until a later control-plane admission step.

---

## 9. Shared contracts

- Consumed read-only: existing HTTP 402 JSON from `CreditBalanceGuard` (`credit_balance_exhausted` / `credit_balance_not_provisioned`). Not a catalog freeze; do not mutate the guard.
- `sharedContractIds=[]`. `mutatesSharedContractIds=[]`.
- `HARNESS_ENTITLEMENT_PROOF_V1` remains FROZEN and is not consumed or mutated.

---

## 10. Rollback / revert isolation

Step 2 revert = discard this stage-start and restore BUILDER-CREDIT-UX-01 board/registry/sidecar fields to Step 1 (`writeSetPrecision=PROVISIONAL`, empty `writePaths`, `admissionUncertain=true`). Occupancy is already EMPTY / GOVERNANCE UNOWNED.

Must not mutate EXEC-01C6A prepared artifacts. Cannot invalidate locked PREVIEW-NODE-01 / PREVIEW-NODE-STAGING-01 / PREVIEW-NODE-STAGING-APPLY-01 / BUILDER-LIVE-GATE-01 / BILLING-READY-04 family evidence.

---

## 11. Keith-decision boundary after this freeze

```
KEITH_DECISION_REQUIRED_BEFORE_STAGE_START=NO (Step 2 authorized and COMPLETE this window)
KEITH_DECISION_REQUIRED_BEFORE_ADMISSION=YES
KEITH_DECISION_REQUIRED_BEFORE_IMPLEMENTATION=NO (Step 3 authorized and COMPLETE this window)
KEITH_DECISION_REQUIRED_BEFORE_CHECKPOINT_LOCK=YES
KEITH_DECISION_REQUIRED_BEFORE_REOPENING_EXEC_01C6A=YES
KEITH_DECISION_REQUIRED_BEFORE_HARNESS_ENABLEMENT=YES
KEITH_DECISION_REQUIRED_BEFORE_STRIPE_OR_TOP_UP=YES
KEITH_DECISION_REQUIRED_BEFORE_APEX_PRODUCTION_ROUTING=YES
```

This freeze does **not** reopen EXEC-01C6A. It does **not** change BUILDER-LIVE-GATE-01. Gate remains ON. Stripe/top-up child remains unregistered.

---

## 12. Step 2 acceptance

- [x] Exact Builder workspace surface frozen (sidebar compact usage credit row + testids + loading/error)
- [x] Balance read path frozen (`useCreditBalance` → `GET /api/billing/balance` only; `useBillingData` not reused as-is)
- [x] Credit vs token/session quota distinction frozen in UI and copy
- [x] 402 mapping frozen for `credit_balance_exhausted`, `credit_balance_not_provisioned`, and generic 402 fallback
- [x] Dedicated credit mapper frozen; quota 403/429 path unchanged
- [x] Exact Step 3 write set frozen: 11 sidecar `writePaths` plus human-required `frontend/app/[locale]/app/page.tsx` (FRONTEND-covered; GOV-OS-03 cannot encode `[locale]`); three locale files included
- [x] Tests frozen: balance render, 402 mapping, no Stripe/top-up, no ledger mutation
- [x] No Gateway/credit-guard/ledger, Stripe, Harness, orchestration, apex, invite, or EXEC-01C6A work included
- [x] Builder live gate remains ON; EXEC-01C6A `startCondition=NOT_READY`
- [x] Later Stripe/top-up child remains unregistered
- [x] Sidecar `writeSetPrecision=EXACT`; `admissionUncertain=true`; occupancy EMPTY
- [x] No implementation source edits this window
- [x] No runtime / browser / Git commit

---

## 13. Step 2 activity ledger

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=0, application source=0, frontend=0, i18n=0, tests executed=0, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0, named other children registered=0, Stripe=0, credit mutation=0.

Governance writes: `docs/BUILDER-CREDIT-UX-01-STAGE-START.md`; `TASKS.md` CURRENT EXECUTION BOARD fields; `TASKS_BACKLOG_FULL.md` BUILDER-CREDIT-UX-01 body; sidecar candidate `writeSetPrecision=EXACT` / exact `writePaths` / occupancy EMPTY / GOVERNANCE UNOWNED / `admissionUncertain=true`; `SATURATION_PROOF.json` only as validator output.

---

## 14. Step 3 acceptance

- [x] Keith authorized Step 3 this window
- [x] frozen write set implemented (11 sidecar `writePaths` plus human-required `frontend/app/[locale]/app/page.tsx`)
- [x] `useCreditBalance` calls only `GET /api/billing/balance`
- [x] Builder sidebar compact usage panel shows credit balance row under Active sessions / Tokens
- [x] Credit balance is clearly separate from token/session quota
- [x] Row-local loading and error states
- [x] GET unprovisioned balance 0 displays 0
- [x] 402 mapper: `credit_balance_exhausted` → `ai.creditBalanceExhausted` with `{count}` from `current_balance` default 0; `credit_balance_not_provisioned` → `ai.creditBalanceNotProvisioned`; generic 402 → `ai.creditBalancePaymentRequired`
- [x] Existing quota 403/429 mapping unchanged
- [x] No Stripe/top-up/subscription/upgrade activation
- [x] No ledger POST
- [x] No backend Ask/Build execution behavior change
- [x] Frozen frontend tests PASS 33/33; `npx tsc --noEmit` PASS; existing `workspace-shell.test.tsx` 455/455 PASS
- [x] `git diff --check` PASS
- [x] occupancy EMPTY; not admitted; not LOCKED; sidecar unchanged (`status=READY` / `admissionUncertain=true`)
- [x] EXEC-01C6A `startCondition=NOT_READY` UNCHANGED
- [x] BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON
- [x] No Git commit/push

## 15. Step 3 activity ledger

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=1 (frozen frontend write set only), application source=1 (frozen frontend write set only), frontend=1, i18n=1, tests executed=1, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0, named other children registered=0, Stripe=0, credit mutation=0.

Governance writes: `docs/BUILDER-CREDIT-UX-01-STAGE-START.md` Step 3 status; `TASKS.md` CURRENT EXECUTION BOARD fields; `TASKS_BACKLOG_FULL.md` BUILDER-CREDIT-UX-01 body; sidecar unchanged unless validator requires proof refresh. Occupancy remains EMPTY / GOVERNANCE UNOWNED. Candidate remains READY / not LOCKED.
