# PREVIEW-STOP-PUBLIC-ROUTE-01 — Stage-start / exact-scope freeze

**Task ID:** PREVIEW-STOP-PUBLIC-ROUTE-01
**Title:** Public preview stop route returns correct 200 JSON
**Date:** 2026-09-17
**Nature:** IMPLEMENTATION — high-risk; public API response / Gateway preview proxy / stop-response contract
**Lifecycle:** 4-step IMPLEMENTATION
**Step:** 2 COMPLETE — stage-start / exact write-set freeze
**Step status:** Step 1 COMPLETE — 2026-09-17 (registration / control-plane only) — Step 2 COMPLETE — 2026-09-17 — Step 3 NOT AUTHORIZED — Step 4 NOT AUTHORIZED
**This document:** Authoritative Step 2 freeze for PREVIEW-STOP-PUBLIC-ROUTE-01. It does **not** authorize admission, implementation, runtime, staging/browser proof, Harness, orchestration, Stripe, apex cutover, invitations, EXEC-01C6A reopen, or follow-on registration.

**Parent:** PREVIEW-STOP-01 COMPLETE AND LOCKED — Checkpoint: `docs/PREVIEW-STOP-01-STAGE-START.md` — implementation HEAD `79510ca200c9bfda999cb6140c6596d65ccec02f` (`fix: make preview stop reliable`) — LOCAL-TESTS only
**Observed gap (must not rewrite):** `docs/PREVIEW-STOP-STAGING-APPLY-01-STAGE-START.md` §18 E11–E13 / E15 — public origin `POST /api/preview/{sessionId}/stop` HTTP 400 `text/html; charset=utf-8` empty body; CM `:4002` POST stop HTTP 200 JSON; process/port/map cleanup still happened. APPLY-01 remains REGISTERED / READY / NOT ADMITTED / not locked / partial pass and is **not** machine `dependsOn`.
**Occupancy hash (end-state):** `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d` (Lane 1 EMPTY, Lane 2 EMPTY, GOVERNANCE UNOWNED)

```
STEP1_COMPLETE=YES
STEP2_COMPLETE=YES
STEP2_AUTHORIZED=YES
STEP3_AUTHORIZED=NO
STEP3_COMPLETE=NO
STEP4_AUTHORIZED=NO
LOCKED=NO
IMPLEMENTATION_STARTED=NO
ADMITTED=NO
WRITE_SET_PRECISION=EXACT
CANDIDATE_STATUS=READY
ADMISSION_UNCERTAIN=true
TEST_ADMISSIBLE=ADMISSION_UNCERTAIN
MUTEXES_DECLARED=GATEWAY
MUTEXES_ACQUIRED=NO
GATEWAY_DECLARED=YES
GATEWAY_ACQUIRED=NO
CONTAINER_MANAGER_DECLARED=NO
FRONTEND_I18N=NO
PUBLIC_STOP_VERB=POST
DELETE_STOP_ALIAS=KEEP_EXISTING_CATCHALL_FORWARD
STOP_RESPONSE=HTTP_200_JSON
STOP_HTML_FORBIDDEN=YES
NO_ACTIVE_PREVIEW=CM_IDEMPOTENT_SUCCESS
EVIDENCE_CLASS=LOCAL-TESTS
STAGING_BROWSER_PROOF=LATER_CHILD_NOT_REGISTERED
HARNESS_ENABLEMENT=NO
ORCHESTRATION=NO
STRIPE=NO
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

Keith authorized this Step 2 freeze. Occupancy remains EMPTY. Sidecar candidate is `status=READY` / `writeSetPrecision=EXACT` / exact Gateway `writePaths` / `admissionUncertain=true` so the candidate is **not** in S (`Test-Admissible` = ADMISSION_UNCERTAIN). Do **not** admit Lane 1 or Lane 2. Do **not** start Step 3. Do **not** register follow-on tasks. Do **not** reopen AGENT-PLATFORM-EXEC-01C6A. BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON.

---

## 1. Inherited product / architecture facts (must not reopen)

- `PRD.md` CURRENT includes integrated workspace preview, HTTP/WebSocket (HMR/dev servers), and predictable lifecycle behavior for sessions, workspaces, and previews.
- `ARCHITECTURE.md` §6 records preview strategy resolution, Gateway preview proxy to container-manager, and `node-dev-server` as CURRENT HOW.
- Locked PREVIEW-STOP-01 productized already-CURRENT stop (`PreviewService.stopPreview`; public POST `/api/preview/:sessionId/stop` with DELETE alias) with LOCAL-TESTS only. CM POST + DELETE stop, idempotent empty-map success, process-tree/port kill, and restart-after-stop remain LOCKED HOW. This child does not rewrite CM stop semantics.
- PREVIEW-STOP-STAGING-APPLY-01 Step 3 proved process/port/map cleanup on staging after `LIVE_LOCKED` apply, and recorded the remaining public HTTP 200 JSON FAIL. APPLY-01 is sequencing context, not machine `dependsOn`.
- Locked PREVIEW-NODE-01 / PREVIEW-NODE-STAGING-01 / PREVIEW-NODE-STAGING-APPLY-01 proved Vite start. Static Preview remains the baseline that must not regress.
- BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON.
- Working single-shot Builder Ask/Build remains the product to complete, not to replace.
- Product-visible Harness / orchestration / Stripe / apex production routing remain FUTURE/gated.
- EXEC-01C6A remains `startCondition=NOT_READY` / not reopened.
- There is **no** UI Stop Preview button. Public stop remains operator `POST /api/preview/:sessionId/stop`.

This freeze does not rewrite `PRD.md` or `ARCHITECTURE.md`.

---

## 2. Source-grounded diagnosis (Step 2)

### 2.1 Observed gap (APPLY-01 Step 3 evidence; not re-run this window)

From `docs/PREVIEW-STOP-STAGING-APPLY-01-STAGE-START.md` §18:

- Running CM became `LIVE_LOCKED` (POST+DELETE stop compiled; process-group/port fingerprints HIT).
- Operator `POST /api/preview/{sessionId}/stop` on signed-in origin `https://staging.ainow.biz`: HTTP **400**, `Content-Type: text/html; charset=utf-8`, **empty body**. Same with and without `X-CSRF-Token`. Cookie **name** `aisandbox_csrf` present.
- After ~2s: `GET /status` HTTP 200 `{"running":false,"message":"No active preview for this session"}`. Vite pid gone; no listen on `3001`–`3100`. Restart on the same session worked.
- Direct CM `POST :4002/api/preview/{id}/stop` HTTP **200** JSON `{"success":true,"message":"No active preview for this session"}` (after public POST had already cleared — CM idempotent success).
- Gateway `:4000` POST without cookie HTTP **401 JSON** (not 400 HTML).
- Static public POST `/stop` also HTTP 400 `text/html` empty; process behavior still safe.
- No Ask/Build / provider / credit. No Gateway/frontend restart. No CM source fix invented.

Therefore container-manager stop **service** is working. The remaining hole is the **public Gateway response** for POST `/stop`.

### 2.2 Answers to the three root-cause questions

**Q1. Is Gateway treating `/stop` as a proxy route incorrectly?**

Yes, in the control-plane sense. Gateway `PreviewController` (`services/api-gateway/src/preview/preview.controller.ts`) has **no** dedicated stop handler. Every preview HTTP verb/path, including POST `:sessionId/stop`, falls through:

```
@Controller('preview')
@UseGuards(SessionCookieGuard, PreviewOwnershipGuard)
@All('*')
proxyToContainerManager → axios({ method: req.method, url: CONTAINER_MANAGER_URL + req.path, data: req.body, headers: sanitizeProxyHeaders(...) })
```

The only special-case inside that catch-all is `req.path.includes('/proxy')` → `responseType: 'stream'` and `response.data.pipe(res)`. `/stop` does **not** take the stream branch (`responseType: 'json'`), but it is still reconstructed as a generic proxy response: copy **all** upstream headers onto Express `res`, then `res.status(response.status); res.send(response.data)` of axios-parsed JSON.

That is the wrong reconstruction for a control-plane JSON command. It is the HTML/iframe proxy machinery, not a Nest JSON handler.

**Q2. Does `@All('*')` or proxy body/method handling cause POST `/stop` to return HTML/400 while still forwarding?**

Method forwarding is **not** the remaining hole. PREVIEW-STOP-01 already added CM `@Post(':sessionId/stop')`. Staging process/port/map cleanup plus direct CM 200 JSON prove POST is reaching `stopPreview`.

Body is **not** uniquely proven as the 400. Operator/UI start is also empty POST (`fetch(..., { method: 'POST' })` with no body). CSRF is **not** the 400: preview has no `CsrfGuard` (`CsrfGuard` is 403 and unused here); APPLY-01 E11 400 HTML happened with and without `X-CSRF-Token`. Gateway unauthenticated POST is 401 JSON via `HttpExceptionFilter` (always `.json(...)`), not HTML.

The source-grounded Gateway defect that **can** yield a public 400 `text/html` empty body **after** CM has already succeeded:

1. Axios `responseType: 'json'` parses CM's body into an object.
2. The catch-all copies **every** axios response header onto Express, including hop-by-hop / already-decoded headers (`content-length`, `transfer-encoding`, `connection`, upstream `content-type`).
3. `res.send(parsedObject)` then serializes a **new** JSON body under those copied headers.
4. Conflicting `content-length` / `transfer-encoding` on a small JSON stop body is a classic Node proxy malformation. An origin in front of Gateway (Next `fallback` rewrite `/api/:path*` in `frontend/next.config.js`, then Caddy) commonly surfaces that as HTTP 400 `text/html; charset=utf-8` with an empty body — matching APPLY-01 E11 — while the upstream CM work already completed.

Step 3 must **not** guess Caddy/Next as a write target. Step 3 must make Gateway's own POST `/stop` return Nest JSON 200 without copying hop-by-hop headers, so the public contract no longer depends on catch-all reconstruction.

**Q3. Is there an existing start/status/proxy special route that needs an explicit stop route?**

On **container-manager**, yes: start / stop / status / proxy are distinct routes. Stop is already `@Post(':sessionId/stop')` plus `@Delete(':sessionId/stop')` wrapping `{ success: true, ...serviceResult }`.

On **Gateway**, no start/status special routes exist. Only `/proxy` is special-cased (stream). Start and status ride `@All('*')` today and must remain so (regression). Stop needs an **explicit** Gateway `POST :sessionId/stop` JSON handler declared **before** `@All('*')`, analogous to CM's dedicated stop route, so stop cannot be reconstructed by the HTML/proxy catch-all.

Do **not** add Gateway start/status special routes in this slice. Do **not** rewrite the catch-all globally (iframe proxy regression risk).

### 2.3 Layer table

| Layer | Finding | In Step 3 write set? |
|---|---|---|
| Frontend | No stop caller. Start is empty POST. No Stop Preview button. | **No** |
| Next rewrite | `frontend/next.config.js` fallback `/api/:path*` → Gateway. Method-transparent. Frozen-read only. Origin may surface malformed catch-all JSON as 400 HTML. Not a Step 3 write. | **No** |
| Caddy / origin | Public 400 HTML observed on origin. Direct Gateway `:4000` unauthenticated is 401 JSON. Not a Step 3 write. Staging re-proof is a later child. | **No** |
| CSRF / session | Preview uses `SessionCookieGuard` + `PreviewOwnershipGuard` only. Not `CsrfGuard`. 401 JSON without cookie. 400 HTML with cookie is not CSRF. | **No** |
| Gateway catch-all | `@All('*')` forwards POST `/stop` (CM runs) then copies hop-by-hop headers + `res.send(parsed JSON)`. No dedicated stop route. Endpoint-contract tests cover status/start/proxy, not POST `/stop`. | **Yes** |
| CM route / service | Locked POST+DELETE stop; idempotent empty-map HTTP 200 `{ success: true, message: 'No active preview for this session' }`. Staging `:4002` 200 JSON. No contract/test fixture gap that requires CM files in this slice. | **No** |
| Plural `src/previews/` | Not the workspace Start/Stop contract. | **No** |

### 2.4 CONTAINER-MANAGER write-set decision

**Undeclared.** Direct CM POST already returns the public JSON contract. Gateway tests mock axios. No CM controller/service/spec fixture is required for Step 3.

---

## 3. Frozen public contract

- **Public verb:** `POST /api/preview/:sessionId/stop`
- **When CM stop succeeds (including idempotent empty-map):** Gateway returns **HTTP 200** with **JSON** body. Must include `success: true` and CM's `message`.
  - Active stop: `{ "success": true, "message": "Preview stopped successfully" }`
  - No active preview: `{ "success": true, "message": "No active preview for this session" }`
- **Content-Type:** `application/json` (charset optional). **Forbidden:** `text/html` for this route.
- **DELETE alias:** already public/current via Gateway `@All('*')` forwarding DELETE to CM `@Delete(':sessionId/stop')`. **Keep** catch-all DELETE forwarding. **Do not** add a new Gateway `@Delete` handler. **Do not** remap POST→DELETE. **Do not** broaden DELETE semantics.
- Guards remain controller-level `SessionCookieGuard` + `PreviewOwnershipGuard`. Unauthenticated remains JSON 401/403, not HTML.
- Connect-fail remains JSON 502 `{ error: 'Proxy error', message: 'Failed to connect to container manager' }` (same idea as today's catch-all catch).
- Non-2xx CM JSON (session unusable 404/410, etc.) may pass through as JSON with CM's status. Do not convert them to HTML. Do not convert idempotent empty-map success into 404.

Frontend remains without a Stop Preview button.

---

## 4. Frozen Step 3 behavior (NOT authorized this window)

Add an explicit Gateway handler **declared before** `@All('*')`:

```
@Post(':sessionId/stop')
```

Behavior:

1. Build `POST ${CONTAINER_MANAGER_URL}/api/preview/${sessionId}/stop` (CM global prefix is `api`; default `CONTAINER_MANAGER_URL` remains `http://localhost:4002`).
2. axios POST, `responseType: 'json'`, `validateStatus: () => true`. Do **not** send a fabricated JSON body. Do **not** copy hop-by-hop request/response headers. Do **not** use the `/proxy` stream branch.
3. Respond with Nest/Express **JSON** (`res.status(cmStatus).json(cmBody)` or equivalent). Never `res.send` of a parsed object under copied upstream headers. Never `pipe`.
4. On axios/connect throw: existing 502 JSON shape.
5. Keep `@All('*')` for start / status / proxy (and DELETE `/stop` compatibility).
6. Keep `sanitizeProxyHeaders` and the stream `/proxy` branch unchanged.
7. Keep zero-arg `PreviewController` construction (`containerManagerUrl` field initializer). Do not introduce DI that breaks `preview.proxy-target.spec.ts`.

Do not edit container-manager. Do not edit frontend / i18n / next.config.js / Caddy / compose / env.

---

## 5. Exact write set

`writeSetPrecision=EXACT`. Paths are repo-relative POSIX.

### 5.1 Step 2 this window (governance only)

1. `docs/PREVIEW-STOP-PUBLIC-ROUTE-01-STAGE-START.md`
2. `TASKS.md` CURRENT EXECUTION BOARD fields
3. `TASKS_BACKLOG_FULL.md` PREVIEW-STOP-PUBLIC-ROUTE-01 body
4. `docs/control-plane/lane-saturation-state.json` candidate `writeSetPrecision=EXACT`, exact `writePaths` below, occupancy EMPTY, `admissionUncertain=true`
5. `docs/control-plane/SATURATION_PROOF.json` only as validator output

### 5.2 Step 3 (NOT authorized this window)

**Modify (machine `writePaths`):**

1. `services/api-gateway/src/preview/preview.controller.ts`
2. `services/api-gateway/src/preview/__tests__/preview.endpoint-contract.spec.ts`

Sidecar `writePaths` is exactly those two paths, in that order.

**Create:** none.
**Container-manager / frontend / i18n:** none.

POST-stop decorator metadata and HTTP contract tests live in `preview.endpoint-contract.spec.ts`. Do **not** add a third file.

### 5.3 Frozen-read (must not be written)

- `services/api-gateway/src/preview/preview.module.ts`
- `services/api-gateway/src/preview/preview-ownership.guard.ts`
- `services/api-gateway/src/preview/__tests__/preview.proxy-target.spec.ts`
- `services/api-gateway/src/preview/__tests__/preview.header-sanitization.spec.ts`
- `services/api-gateway/src/preview/__tests__/preview.controller.guard.spec.ts`
- `services/api-gateway/src/filters/http-exception.filter.ts`
- `services/api-gateway/src/main.ts`
- `services/container-manager/src/preview/**`
- `services/container-manager/src/previews/**`
- `frontend/**` including `frontend/next.config.js` and `frontend/messages/*.json`
- `PRD.md` / `ARCHITECTURE.md` / `CLAUDE.md` / `AGENTS.md`
- Harness / EXEC-01C6A / orchestration / apex / invite files
- session Stop callers (`POST /api/sessions/:id/stop`)

### 5.4 Explicitly excluded unless the control plane expands scope

- Stop Preview button, i18n copy, workspace-shell/page.tsx stop wiring
- Gateway start/status special routes; global catch-all rewrite; POST→DELETE remap; new Gateway `@Delete`
- Container-manager service/controller rewrite or extra CM tests
- Caddy / Next rewrite / PM2 / env / deploy
- Staging/SSH/AWS/browser proof in Step 3
- Docker/compose/package.json/lockfiles
- Ask/Build execute path
- Next.js / CRA / Vue / Express preview productization
- Preview refresh UX
- APPLY-01 Step 4 lock

Anything outside the frozen write set is forbidden by default.

---

## 6. Tests and verification plan

Evidence class: **LOCAL-TESTS**. No Docker/Postgres/Redis. No browser. No provider-live. No staging in Step 3.

### 6.1 Required tests (Step 3, later)

Add to `preview.endpoint-contract.spec.ts`:

1. **POST stop JSON 200.** `POST /api/preview/:sessionId/stop` with mocked axios 200 `{ success: true, message: 'Preview stopped successfully' }` returns HTTP 200, JSON (not `text/html`), body includes `success: true` and that message. Axios called with `method: 'POST'` and URL containing `/api/preview/:sessionId/stop`. `responseType` is not `'stream'`.
2. **No active preview surfaces CM idempotent success.** Mocked axios 200 `{ success: true, message: 'No active preview for this session' }` → Gateway HTTP 200 JSON with the same `success` + `message`. Do **not** expect 404.
3. **Stop is an explicit POST route.** `PreviewController` has a POST handler on `:sessionId/stop` (decorator metadata). Catch-all remains `@All('*')` on `proxyToContainerManager`.
4. **Regression start.** Existing `POST /api/preview/:sessionId/start` still 200 and still axios-forwards POST `/start`.
5. **Regression status.** Existing `GET /api/preview/:sessionId/status` still 200 and still axios-forwards GET `/status`.
6. **Regression proxy.** Existing `GET /api/preview/:sessionId/proxy*` still 200 and still axios-forwards GET `/proxy...`.
7. **DELETE alias not broadened.** `DELETE /api/preview/:sessionId/stop` still hits the catch-all axios forward (`method: 'DELETE'`, URL containing `/stop`). Do **not** add a Gateway `@Delete` handler.

Existing guard / header-sanitization / proxy-target specs remain green (read-only; not in `writePaths`).

Do not add Playwright/browser tests. Do not add frontend tests. Do not add container-manager tests.

### 6.2 Step 3 verification commands (NOT authorized this window)

When Step 3 is later authorized:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test -- src/preview/__tests__/preview.endpoint-contract.spec.ts src/preview/__tests__/preview.proxy-target.spec.ts src/preview/__tests__/preview.header-sanitization.spec.ts src/preview/__tests__/preview.controller.guard.spec.ts
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx tsc --noEmit
```

If the repo’s `npm test` runner is the established equivalent and stays inside these preview specs plus already-green neighbors, it may be used instead. Do not start Docker/dev servers.

### 6.3 Step 2 this window

```powershell
powershell -NoProfile -File "C:\Users\knlee\aiSandBox2026B\scripts\validate-lane-capacity.ps1"
git -C "C:\Users\knlee\aiSandBox2026B" diff --check
```

No gateway tests. No tsc. No runtime. No browser.

---

## 7. Mutexes / runtime needs (declared, not acquired now)

| Item | Step 2 (this window) | Step 3 (later authorization) |
|---|---|---|
| GOVERNANCE | Held for this doc/board/registry/sidecar write, then released UNOWNED | Held only if later admission/lock requires board writes |
| GATEWAY | Declared, **not acquired** | Acquire only if Step 3 is admitted |
| CONTAINER-MANAGER | **Undeclared** (Step 2 proved CM files not required) | Still undeclared |
| FRONTEND | Undeclared | Still undeclared |
| I18N | Undeclared | Still undeclared |
| LOCAL-RUNTIME | Undeclared | Still undeclared |
| STAGING | Undeclared | Still undeclared |
| PROVIDER-LIVE | Undeclared | Still undeclared |
| CREDIT | Undeclared | Still undeclared |
| HOTFILE | none | none |

`stagingAuthorized=false`. `STAGING_EXECUTION_AUTHORIZED=NO`. `PROVIDER_LIVE_AUTHORIZED=NO`. `CREDIT_MUTATION_AUTHORIZED=NO`. `LOCAL_RUNTIME_AUTHORIZED=NO`.

Admission remains **not** performed. `admissionUncertain=true` is intentional (keeps the candidate out of S; residual origin/Caddy/Next proof is a later child). It is **not** an admission.

---

## 8. Shared contracts

- `sharedContractIds=[]`. `mutatesSharedContractIds=[]`.
- `HARNESS_ENTITLEMENT_PROOF_V1` remains FROZEN and is not consumed or mutated.
- Public preview stop verb POST + JSON 200 is a product HTTP convention, not a catalog shared-contract ID.

---

## 9. Rollback / revert isolation

Step 2 revert = discard this stage-start and restore PREVIEW-STOP-PUBLIC-ROUTE-01 board/registry/sidecar fields to Step 1 (`writeSetPrecision=PROVISIONAL`, empty `writePaths`, mutexes `GATEWAY`, `admissionUncertain=true`). Occupancy is already EMPTY / GOVERNANCE UNOWNED.

Must not mutate EXEC-01C6A prepared artifacts. Cannot invalidate locked PREVIEW-STOP-01 / BUILDER-CREDIT-UX-01 / PREVIEW-NODE-01 / PREVIEW-NODE-STAGING-01 / PREVIEW-NODE-STAGING-APPLY-01 / BUILDER-LIVE-GATE-01 evidence. Cannot silently rewrite PREVIEW-STOP-STAGING-APPLY-01 Step 3 partial-pass evidence.

---

## 10. Keith-decision boundary after this freeze

```
KEITH_DECISION_REQUIRED_BEFORE_STAGE_START=NO (Step 2 authorized and COMPLETE this window)
KEITH_DECISION_REQUIRED_BEFORE_ADMISSION=YES
KEITH_DECISION_REQUIRED_BEFORE_IMPLEMENTATION=YES
KEITH_DECISION_REQUIRED_BEFORE_CHECKPOINT_LOCK=YES
KEITH_DECISION_REQUIRED_BEFORE_STAGING_OR_BROWSER_PROOF=YES
KEITH_DECISION_REQUIRED_BEFORE_REOPENING_EXEC_01C6A=YES
KEITH_DECISION_REQUIRED_BEFORE_HARNESS_ENABLEMENT=YES
KEITH_DECISION_REQUIRED_BEFORE_STRIPE_OR_TOP_UP=YES
KEITH_DECISION_REQUIRED_BEFORE_APEX_PRODUCTION_ROUTING=YES
KEITH_DECISION_REQUIRED_BEFORE_REGISTERING_NAMED_CHILDREN=YES
```

This freeze does **not** reopen EXEC-01C6A. It does **not** change BUILDER-LIVE-GATE-01. Gate remains ON. Named later children remain unregistered (Stop Preview button, APPLY-01 Step 4 lock, staging origin re-proof after Gateway JSON 200, preview refresh UX, Next/CRA/Vue/Express, mobile polish, apex routing).

---

## 11. Step 2 acceptance

- [x] Source boundary frozen: Gateway catch-all treats POST `/stop` as generic proxy reconstruction; CM stop service is working; CSRF/frontend/Caddy are not Step 3 writes
- [x] `@All('*')` still forwards (explains cleanup-while-400); remaining hole is Gateway JSON response, not CM method mismatch
- [x] Explicit Gateway `POST :sessionId/stop` required before `@All('*')`; start/status stay on catch-all; `/proxy` stream unchanged
- [x] Public stop verb frozen as POST; DELETE kept as existing catch-all forward only
- [x] HTTP 200 JSON contract frozen; `text/html` forbidden; no-active-preview surfaces CM idempotent success
- [x] Exact Step 3 write set frozen: two Gateway preview files; CM/frontend out
- [x] Tests frozen: POST stop JSON 200, idempotent message, explicit POST metadata, start/status/proxy regression, DELETE still catch-all
- [x] No UI redesign/i18n; no Ask/Build/provider/credit; no Harness/EXEC-01C6A; no orchestration; no staging/browser in Step 3; no runtime/PM2/env/deploy
- [x] Sidecar `writeSetPrecision=EXACT`; exact `writePaths`; `admissionUncertain=true`; occupancy EMPTY
- [x] GATEWAY declared not acquired; CONTAINER-MANAGER/FRONTEND undeclared
- [x] No implementation source edits this window
- [x] No runtime / browser / Git commit

---

## 12. Step 2 activity ledger

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=0, application source=0, frontend=0, i18n=0, tests executed=0, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0, named other children registered=0, Stripe=0, credit mutation=0, follow-on registration=0.

Governance writes: `docs/PREVIEW-STOP-PUBLIC-ROUTE-01-STAGE-START.md`; `TASKS.md` CURRENT EXECUTION BOARD fields; `TASKS_BACKLOG_FULL.md` PREVIEW-STOP-PUBLIC-ROUTE-01 body; sidecar candidate `writeSetPrecision=EXACT` / exact `writePaths` / mutexes `GATEWAY` only / occupancy EMPTY / GOVERNANCE UNOWNED / `admissionUncertain=true`; `SATURATION_PROOF.json` only as validator output.

---

## 13. Authorization state (end of Step 2)

```
IMPLEMENTATION_AUTHORIZED=NO
ADMISSION_AUTHORIZED=NO
STAGING_AUTHORIZED=NO
LOCAL_RUNTIME_AUTHORIZED=NO
PROVIDER_LIVE_AUTHORIZED=NO
CREDIT_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
TESTS_EXECUTED=NO (lane-capacity validator + git diff --check only)
APPLICATION_SOURCE_CHANGED=NO
LANE_1=EMPTY
LANE_2=EMPTY
GATEWAY_DECLARED=YES
GATEWAY_ACQUIRED=NO
CONTAINER_MANAGER_DECLARED=NO
FRONTEND_I18N=NO
STEP3_AUTHORIZED=NO
STEP4_AUTHORIZED=NO
LOCKED=NO
FOLLOW_ON_REGISTERED=NO
EXEC_01C6A_REOPENED=NO
```

**Invitation invariant:** PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.

**Lane 3 invariant:** Lane 3 remains DISABLED.

**Activation effect:** NONE
**Rollback boundary:** discard this document plus this window’s board/registry/sidecar write-set field updates. Ordinary Builder Ask/Build/static Preview path, locked PREVIEW-STOP-01 LOCAL-TESTS evidence, locked Vite start path, APPLY-01 Step 3 staging apply/proof, live gate, and credit UX are untouched.
