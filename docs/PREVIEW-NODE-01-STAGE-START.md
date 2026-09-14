# PREVIEW-NODE-01 — Stage-start / implementation freeze

**Task ID:** PREVIEW-NODE-01
**Title:** Node/framework preview productization (first bounded slice)
**Date:** 2026-09-14
**Nature:** IMPLEMENTATION — high-risk; container process launch, ports, process-proxy, sandbox npm/dev-server behavior
**Lifecycle:** 4-step IMPLEMENTATION
**Step:** 3 COMPLETE — bounded implementation of the frozen write set
**Step status:** Step 1 COMPLETE — 2026-09-14 (registration / control-plane only; committed `63b59df` `docs: register node preview productization`); Step 2 COMPLETE — 2026-09-14; Step 3 COMPLETE — 2026-09-14 (Keith-authorized frozen 2-file Vite-only implementation; no implementation lane occupied; LOCAL-TESTS 38/38 + tsc PASS; `git diff --check` PASS; uncommitted); Step 4 NOT AUTHORIZED
**This document:** Authoritative Step 2 freeze and Step 3 completion record for the first Vite-only node/framework preview productization slice. It does **not** authorize Step 4 / LOCK, admission, runtime, staging/browser proof, Harness, orchestration, Stripe, apex cutover, invitations, or EXEC-01C6A reopen.

**Step 1 committed HEAD (user-supplied; not re-queried this window):** `63b59df` (message `docs: register node preview productization`)
**Occupancy hash (end-state):** `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d` (Lane 1 EMPTY, Lane 2 EMPTY, GOVERNANCE UNOWNED)

```
STEP1_COMPLETE=YES
STEP2_COMPLETE=YES
STEP3_AUTHORIZED=YES
STEP3_COMPLETE=YES
STEP4_AUTHORIZED=NO
IMPLEMENTATION_STARTED=YES
ADMITTED=NO
WRITE_SET_PRECISION=EXACT
CANDIDATE_STATUS=READY
ADMISSION_UNCERTAIN=true
TEST_ADMISSIBLE=ADMISSION_UNCERTAIN
MUTEXES_DECLARED=CONTAINER-MANAGER
MUTEXES_ACQUIRED=NO
FRONTEND_I18N=NO
SLICE1_FRAMEWORK=Vite
NEXT_CRA_VUE_EXPRESS_GENERIC=FAIL_CLOSED
STATIC_INDEX_HTML=UNCHANGED
NPM_INSTALL=BOUNDED_ALLOWED
NPM_CI=NO
PACKAGE_LOCK_REQUIRED=NO
HOST_BIND=0.0.0.0
PORT_SOURCE=ALLOCATED_POOL_PLUS_$PORT
WAIT_MS=20000
STAGING_BROWSER_PROOF=LATER_CHILD
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
WRITE_SET_HONORED=YES
LOCAL_TESTS=38/38
TSC=PASS
GIT_DIFF_CHECK=PASS
```

Keith authorized Step 2, then Step 3 source against this freeze. Step 3 stayed inside the frozen 2-file write set. Occupancy remains EMPTY. Sidecar candidate stays `status=READY` / `admissionUncertain=true` / `writeSetPrecision=EXACT` so the candidate is **not** in S. Do **not** admit Lane 1 or Lane 2. Do **not** authorize Step 4 / LOCK in this window. Do **not** register follow-on tasks. Do **not** reopen AGENT-PLATFORM-EXEC-01C6A.

---

## 1. Inherited product / architecture facts (must not reopen)

- `PRD.md` CURRENT includes integrated workspace preview, HTTP/WebSocket (HMR/dev servers), and preview refresh after file actions.
- `ARCHITECTURE.md` §6 records `PreviewStrategyResolver` `node-dev-server` via `package.json` as CURRENT HOW, and records that the private-beta proven path is **static `index.html`**.
- Locked PREVIEW-STRATEGY-01A / PREVIEW-STATIC-01B / PREVIEW-AUTOSTART-01A closed the static-html family. They are predecessors, not this productization, and are not machine `dependsOn`.
- BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON.
- Working single-shot Builder Ask/Build remains the product to complete, not to replace.
- Product-visible Harness / orchestration / Stripe / apex production routing remain FUTURE/gated.
- EXEC-01C6A remains `startCondition=NOT_READY` / not reopened.

This freeze productizes the already-CURRENT `node-dev-server` HOW for **one** named framework. It does not rewrite `PRD.md` or `ARCHITECTURE.md`.

---

## 2. Source-grounded current state (registration HEAD `63b59df`)

### 2.1 Resolver (`services/container-manager/src/preview/preview-strategy.resolver.ts`)

Detection order:

1. Optional `providedCommand` → `node-dev-server` / `process-proxy` (no shell; no framework)
2. `/workspace/package.json` present → framework detection then script override
3. `/workspace/index.html` → `static-html` / `direct-read` (`appRoot=/workspace`)
4. Immediate subdirectory `/workspace/*/index.html` → `static-html` / `direct-read`
5. Root `*.html` without `index.html` → `unknown` / `Static HTML (missing-index)`
6. Else `unknown`

Framework order when `package.json` exists:

| Priority | Dependency key | `framework` | Default command |
|---|---|---|---|
| 1 | `next` | `Next.js` | `npm run dev` |
| 2 | `react-scripts` | `Create React App` | `npm start` |
| 3 | `vite` | `Vite` | `npm run dev` |
| 4 | `@vue/cli-service` | `Vue CLI` | `npm run serve` |
| 5 | `vue` | `Vue` | `npm run dev` |
| 6 | `express` | `Express` | `node server.js` |

Script override after framework detection: `scripts.dev` → `npm run dev`; else `scripts.start` → `npm start`; else `scripts.serve` → `npm run serve`. If both `next` and `vite` are present, the resolver reports **Next.js**.

Static HTML already records command `npx serve -s . -l tcp://0.0.0.0:$PORT` but serving mode is `direct-read` (no process).

### 2.2 Launch (`services/container-manager/src/preview/preview.service.ts`)

- Static HTML: no process; `status=running` immediately; `appRoot` stored.
- Any other resolved command: `(${finalCommand}) >/tmp/preview-${port}.log 2>&1 & echo $!` with env `PORT` + `NODE_ENV=development`, launch timeout 30s.
- `$PORT` in the command string is replaced with the allocated pool port (`3001`–`3100`).
- Host bind is **not** injected. Vite/Next default to localhost, which is not reachable via `getProxyTargetUrl()` (container IP + allocated port).
- **No `npm install`.** Missing `node_modules` fails the start command.
- Wait: `waitForPreviewServer` polls axios GET for **5s**, 400ms interval, 1s probe timeout. Any HTTP status `>= 100` counts as up.
- If wait fails, status stays **`starting`** (not `error`). Port and PID remain. This is the hang/leak path.
- `stopPreview` TERM then KILL by captured PID.
- One in-memory preview per session; early-return if already present.

### 2.3 Proxy (`preview.controller.ts`)

- Static HTML → `readStaticPreviewContent` (path sanitization, `appRoot`, base-tag injection).
- Non-static → `http-proxy-middleware` to `http://<containerIp>:<port>` with WebSocket.
- Proxy is allowed while status is `running` **or** `starting`.

### 2.4 Frontend (read-only this slice)

- `POST /api/preview/:sessionId/start` has **no body** (no `providedCommand` from Workspace).
- Existing surfaces: Start Preview, Refresh, auto-start after file actions (PREVIEW-AUTOSTART-01A), `loading` / `ready` / `unavailable` / `error`.
- Failed start currently falls back to **`unavailable`** after a short status poll. Backend diagnostic text is **not** shown.
- i18n keys `preview.livePreview`, `preview.startPreview`, and workspace recovery copy already exist. No new copy is authorized in slice 1.

### 2.5 Why Vite, not Next.js

Next.js is first in the detector and auth-module templates are Next.js, but Next is **not** the smallest useful first slice:

- Cold `next dev` routinely exceeds the current 5s wait and needs a much longer health window plus a heavier install.
- Extra Next facts (`-H 0.0.0.0 -p`, hostname / turbopack, `.next`) are a second productization.
- Vite start is typically a few seconds after `node_modules` exists. Bind flags are one pair: `--host 0.0.0.0 --port $PORT`.
- Slice 1 must be one named framework with fail-closed neighbors, not “all frameworks the resolver can name.”

---

## 3. Frozen first slice decision

**Slice 1 target = auto-detected Vite only**, at `/workspace/package.json`, with `scripts.dev` present.

In scope (productized path):

1. Resolver still reports `framework === 'Vite'` (existing detection; Next still wins if both deps exist).
2. Bounded `npm install` in `/workspace` when `node_modules` is absent.
3. Launch `npm run dev -- --host 0.0.0.0 --port $PORT` (after `$PORT` substitution) via the existing background-shell pattern.
4. Wait/health with timeout → **error + kill + port release**, never a Vite hang in `starting`.
5. Fail closed (no process) for every other `node-dev-server` result, including Next.js / CRA / Vue CLI / Vue / Express / generic scripts / `providedCommand`.
6. Static `index.html` path unchanged, including auto-start.

Deferred (not this slice):

- Next.js, CRA, Vue CLI, Vue, Express, generic `package.json` scripts
- Subdirectory `package.json` / Vite apps not at `/workspace`
- `providedCommand` productization
- Frontend / i18n status or failure copy
- Staging / browser proof of a Vite preview
- npm registry mirrors, install cache productization, `npm ci`
- HMR correctness beyond “proxy ws:true already exists”
- Ask/Build execute-path changes
- Harness / orchestration / Stripe / apex / invites / EXEC-01C6A

---

## 4. npm install policy

| Item | Freeze |
|---|---|
| Allowed? | **Yes**, bounded, Vite path only |
| When | Before launch, only if `[ -d /workspace/node_modules ]` is false |
| Skip | Directory `/workspace/node_modules` exists (no completeness audit) |
| Command | `npm install --no-audit --no-fund` |
| `npm ci` | **No** |
| `package-lock.json` | **Not required**. If present, stock npm may use it; do not fail closed solely because it is missing |
| cwd | `/workspace` only |
| Global install | **No** (`-g` forbidden) |
| `--prefer-offline` | **Not required** (first install has no cache) |
| Timeout | **120000 ms** |
| Failure | Do **not** launch. Classify `install_timeout` or `install_failed`. Release any allocated port. No PID |
| Network | Inherent to npm; no registry/mirror change in this slice |
| Host cache productization | Out of scope |

Install is a **foreground** exec with timeout. It must not be backgrounded with `&`.

---

## 5. Start command detection

Keep `PreviewStrategyResolver` as detection authority. Do **not** replace it. Do **not** change static-html / missing-index / empty-workspace branches.

Slice 1 launch gate in `PreviewService.startPreview` after `resolve()`:

| Resolved result | Slice 1 action |
|---|---|
| `type === 'static-html'` | Existing early-return. **No edits to this branch** |
| `type === 'unknown'` | Existing `BadRequestException`. Unchanged |
| `type === 'node-dev-server'` and `framework === 'Vite'` and resolved command is `npm run dev` | Productized path |
| `framework === 'Vite'` but command is not `npm run dev` (no `scripts.dev`) | Fail closed; no process |
| Any other `node-dev-server` (Next.js, CRA, Vue, Express, generic, `providedCommand`) | Fail closed; no process |

Vite launch command (service-side rewrite, then existing `$PORT` replace):

```text
npm run dev -- --host 0.0.0.0 --port $PORT
```

Keep the existing background pattern:

```text
(${finalCommand}) >/tmp/preview-${port}.log 2>&1 & echo $!
```

Do not change script-detection identity in the resolver. If a later slice productizes Next.js, that is a new freeze.

`providedCommand`: Workspace does not send it. Slice 1 must **not** launch it. Fail closed with the unsupported-framework diagnostic.

---

## 6. Host / port binding rules

| Item | Freeze |
|---|---|
| Bind address | **`0.0.0.0`** (not `127.0.0.1` / `localhost`) |
| Port | Allocated pool port `3001`–`3100` (existing `allocatePort`) |
| `$PORT` | Existing string replace on the command; env `PORT` still set |
| Vite flags | `--host 0.0.0.0 --port $PORT` appended after `npm run dev --` |
| Static HTML | **Do not change** the unused `npx serve ... tcp://0.0.0.0:$PORT` string; static remains `direct-read` |
| Proxy | Existing process-proxy to `http://<containerIp>:<port>`; no gateway/controller rewrite |
| Why 0.0.0.0 | `getProxyTargetUrl()` uses the container network IP. A localhost-only Vite server is unreachable |

Do not add a second port channel. Do not bind the host’s public interface from outside the session container.

---

## 7. Wait / health strategy

Vite-only constants (do not silently reuse the 5s hang behavior):

| Item | Freeze |
|---|---|
| Wait timeout | **20000 ms** after successful background launch |
| Poll interval | **500 ms** |
| Probe | Existing axios GET of `getProxyTargetUrl()`, probe timeout **1000 ms**, `validateStatus: () => true` |
| Success | HTTP status `>= 100` → `status=running` |
| Timeout | Classify `start_timeout`: kill PID (existing TERM then KILL), `releasePort`, delete `activePreviews` entry, throw `BadRequestException` |
| Launch exec non-zero | Classify `start_failed`; release port; no hang |
| Do **not** | Return `status=starting` as the Vite outcome after wait expiry |
| Static HTML | No wait (already `running`) |

Failure classification (API `BadRequestException` messages; not new UI copy):

| Class | User-safe message |
|---|---|
| `unsupported_framework` | `Framework preview currently supports Vite. This workspace looks like {framework or "a Node app"}.` |
| `vite_missing_dev_script` | `Vite preview requires an npm dev script.` |
| `install_timeout` | `Preview npm install timed out.` |
| `install_failed` | `Preview could not install npm dependencies.` |
| `start_failed` | Keep existing style: `Failed to start preview command (exit …).` plus truncated stdout/stderr |
| `start_timeout` | `Preview server did not become reachable in time.` |

These strings are backend diagnostics. Slice 1 must **not** render them as new frontend copy (existing `unavailable` / `error` i18n remains).

---

## 8. Security / sandbox boundaries

| Boundary | Freeze |
|---|---|
| Exec channel | Only existing `dockerRuntimeService.execInContainerBySessionId` |
| cwd | `/workspace` |
| Workspace scope | Session container bind-mount only. No host-path install, no host process |
| Command composition | Vite start is the frozen template plus an integer port from the pool. Do not interpolate user-supplied shell |
| `providedCommand` | Fail closed; do not launch arbitrary commands in this slice |
| Process leak | Foreground install with timeout. Background start only after install. Kill + port release on start failure/timeout/stop. Non-Vite: zero processes |
| One preview / session | Existing map + early-return unchanged |
| Path traversal | Static sanitization (`..` reject) unchanged; Vite proxy does not read host files through `readStaticPreviewContent` |
| Host escape | No Docker socket, no privileged flags, no compose/network changes |
| Logs | Existing `/tmp/preview-${port}.log` inside the container only |

---

## 9. Frontend UX (slice 1)

**Excluded.** No `FRONTEND` / `I18N` mutex. No edits under `frontend/`.

| Surface | Slice 1 |
|---|---|
| Start Preview / Refresh / auto-start | Unchanged PREVIEW-AUTOSTART-01A behavior |
| Status text | Existing `loading` / `ready` / `unavailable` / `error` |
| Vite-specific “installing / starting” copy | Deferred |
| Preview start failure message | Backend 400; frontend keeps current fallback (`unavailable` after poll). No new i18n keys |
| Manual refresh | Already present; remains the recovery control |

A later named child may add multilingual Vite status / failure copy. That child is **not** registered now.

---

## 10. Static `index.html` regression requirements

Must remain true after Step 3:

1. No `package.json` + `/workspace/index.html` → `static-html` / `direct-read` / `appRoot=/workspace` / `status=running` without a process.
2. Immediate subdirectory `/workspace/*/index.html` still detected and served via `appRoot`.
3. `readStaticPreviewContent` path sanitization, `appRoot` prefixing, and base-tag injection unchanged.
4. Missing-index diagnostic unchanged.
5. Auto-start after Ask/Build file actions unchanged (frontend not in write set).
6. Ask/Build execute path unchanged (no gateway / ai-service / `workspace-execution-intent` edits).

Step 3 must keep existing static describe blocks in `preview.service.spec.ts` and existing resolver static tests green. Do not weaken them.

---

## 11. Exact write set

`writeSetPrecision=EXACT`. Paths are repo-relative POSIX.

**Modify:**

1. `services/container-manager/src/preview/preview.service.ts`
2. `services/container-manager/src/preview/preview.service.spec.ts`

**Explicitly excluded:**

- `preview-strategy.resolver.ts` / `preview-strategy.resolver.spec.ts` (detection identity frozen-read)
- `preview.controller.ts` / `preview.module.ts`
- Docker runtime, Dockerfile, compose, `package.json` / lockfiles
- frontend, i18n, api-gateway, ai-service
- `PRD.md` / `ARCHITECTURE.md` / `CLAUDE.md` / `AGENTS.md`
- this stage-start is a Step 2 governance write, not a Step 3 source file

Anything outside this write set is forbidden unless a later control-plane expansion.

---

## 12. Tests and verification plan

Evidence class: **LOCAL-TESTS**. No Docker/Postgres/Redis. No live `npm install`. No staging/browser. No provider/credit.

Focused Step 3 command (when implementation is later authorized; **not** this window):

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npx jest --testPathPattern "preview\\.(service|strategy\.resolver)\.spec"
```

Focused typecheck (when later authorized):

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npx tsc --noEmit --incremental false
```

Mandatory new/updated tests in `preview.service.spec.ts` (mock `execInContainerBySessionId` and axios; **do not** sleep the full 20s wait):

1. Vite + missing `node_modules` → runs frozen `npm install --no-audit --no-fund` then launch with `--host 0.0.0.0 --port <allocated>`.
2. Vite + existing `node_modules` → skips install; still launches with host/port flags.
3. Install non-zero or install timeout → no background launch; port released; `install_failed` / `install_timeout` message.
4. Wait success → `status=running`.
5. Wait timeout → PID killed; port released; map cleared; `start_timeout`; must **not** remain `starting`.
6. Next.js (and at least one other non-Vite `node-dev-server`) → fail closed; no install; no `& echo $!` launch.
7. `providedCommand` → fail closed; no launch.
8. Static HTML root + subdirectory existing tests still pass; static start must not call `npm install`.
9. Ask/Build regression: **by write-set exclusion** (no execute-path files). Do not add AI-service/gateway tests in this slice.

Resolver spec is not in the write set; existing Vite/Next/static resolver tests must still pass as frozen-read.

Staging/browser proof of a real Vite app is a **later Keith-authorized child**, not Step 3 and not Step 4 of this task.

---

## 13. Mutexes and admission requirements

| Item | Freeze |
|---|---|
| Mutexes | CONTAINER-MANAGER — declared; **not acquired** in Step 2 |
| Hotfiles | none (CONTAINER-MANAGER covers `services/container-manager/`) |
| I18N | false |
| runtimeNeeds | none |
| evidenceClass | LOCAL-TESTS |
| exclusiveCapacity | false |
| sharedContractIds | none |
| mutatesSharedContractIds | none |
| `HARNESS_ENTITLEMENT_PROOF_V1` | remains FROZEN; not consumed; not mutated |
| status | READY |
| startCondition | READY |
| writeSetPrecision | EXACT |
| admissionUncertain | **true** (Step 3 / admission not authorized; keeps candidate out of S) |
| productClass | CURRENT |
| futureAuthorization | NONE |
| saturationClass | FORCING |

Step 2 does **not** admit Lane 1 or Lane 2. Occupancy remains EMPTY. GOVERNANCE is acquired only for this documentation write, then released UNOWNED.

Step 3 was later Keith-authorized and completed without occupying a lane. `admissionUncertain` remains **true**. Setting `admissionUncertain=false` remains **not** this window (Step 4 / LOCK not authorized). Admitting a FORCING EXACT candidate while leaving `admissionUncertain=true` is the GOV-OS-03-safe idle form used by AGENT-PLATFORM-ORCH-PERSIST-01 Step 3.

---

## 14. Risk / rollback plan

| Risk | Mitigation |
|---|---|
| Static HTML regression | Write-set excludes resolver static branches, controller, frontend; existing static tests must stay green |
| Ask/Build break | No gateway / ai-service / workspace-execution files |
| Next.js workspaces that previously hung in `starting` now fail closed | Intentional; fail closed is the trustworthy product. Message names Vite as the supported slice |
| `npm install` inside the sandbox is slow or networked | 120s timeout; skip when `node_modules` exists; no live install in Step 3 tests |
| Process leak | Kill + port release on timeout/failure; non-Vite never launches |
| Host bind miss | Frozen `--host 0.0.0.0 --port $PORT`; tests assert both |
| Frontend shows only `unavailable` on Vite failure | Accepted for slice 1; later i18n child |
| Validator fail-closed if `admissionUncertain=false` with empty lanes | Keep `admissionUncertain=true` until Keith authorizes admission or Step 4 lock |

| Layer | Revert |
|---|---|
| Step 2 governance | Discard this document plus this window’s board/registry/sidecar write-set field updates |
| Step 3 source | Restore the two frozen files (uncommitted) plus this window’s board/registry/stage-start Step 3 field updates |
| Occupancy | Already EMPTY; revert must not admit a lane |
| Ordinary Builder Ask/Build / static Preview | Untouched if write set is honored |

Cannot invalidate locked BUILDER-LIVE-GATE-01 / PREVIEW-STRATEGY-01A / PREVIEW-STATIC-01B / PREVIEW-AUTOSTART-01A / ORCH-ARCH-01 / ORCH-PERSIST-01 / EXEC-01A / 01B / 01C1..01C5B2 / IDENTITY-01 / SCHEMA-01 / KEY-REVOKE-01 / GOV-AUTH-03. EXEC-01C6A `startCondition=NOT_READY` must remain.

---

## 15. Keith-decision boundary (after this Step 3)

```
KEITH_DECISION_REQUIRED_BEFORE_STAGE_START=NO (Step 2 complete)
KEITH_DECISION_REQUIRED_BEFORE_ADMISSION=YES
KEITH_DECISION_REQUIRED_BEFORE_IMPLEMENTATION=NO (Step 3 authorized by Keith and COMPLETE 2026-09-14)
KEITH_DECISION_REQUIRED_BEFORE_CHECKPOINT_LOCK=YES
KEITH_DECISION_REQUIRED_BEFORE_STAGING_OR_BROWSER_PROOF=YES
KEITH_DECISION_REQUIRED_BEFORE_REOPENING_EXEC_01C6A=YES
KEITH_DECISION_REQUIRED_BEFORE_HARNESS_ENABLEMENT=YES
KEITH_DECISION_REQUIRED_BEFORE_STRIPE_OR_TOP_UP=YES
KEITH_DECISION_REQUIRED_BEFORE_APEX_PRODUCTION_ROUTING=YES
KEITH_DECISION_REQUIRED_BEFORE_REGISTERING_NAMED_CHILDREN=YES
```

---

## 16. Step 2 acceptance

- [x] First slice frozen: Vite only; Next/CRA/Vue/Express/generic/`providedCommand` fail closed
- [x] npm install policy frozen (bounded, skip if `node_modules`, no `npm ci`, lockfile not required, 120s)
- [x] Start command: keep resolver; service launches only Vite `npm run dev` plus host/port flags
- [x] Host/port: `0.0.0.0` + allocated `$PORT`; static `direct-read` unchanged
- [x] Wait/health: 20s / 500ms / fail closed with kill; no Vite `starting` hang
- [x] Security/sandbox boundaries frozen
- [x] Frontend UX excluded from slice 1
- [x] Static `index.html` regression requirements frozen
- [x] Exact write set = 2 files
- [x] Tests/verification plan frozen (LOCAL-TESTS; no live install/runtime)
- [x] Risk/rollback frozen
- [x] Admission/mutex: CONTAINER-MANAGER declared not acquired; EXACT + `admissionUncertain=true`; not admitted
- [x] EXEC-01C6A not reopened / `startCondition=NOT_READY` unchanged
- [x] No implementation source, no runtime tools, no Git commit/push this window

---

## 17. Activity ledger (Step 2)

**Step 2 HEAD:** not queried this window (Keith instruction: No Git except `git diff --check`)
**Step 2 activity ledger:** LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=0, application source=0, frontend=0, i18n=0, tests executed=0, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0, named children registered=0. Governance writes: `docs/PREVIEW-NODE-01-STAGE-START.md`; `TASKS.md` CURRENT EXECUTION BOARD fields; `TASKS_BACKLOG_FULL.md` PREVIEW-NODE-01 body; sidecar candidate write-set/precision fields (occupancy facts unchanged EMPTY / GOVERNANCE UNOWNED); `SATURATION_PROOF.json` only as validator output.

---

## 18. Step 3 completion (this window)

Keith authorized Step 3 implementation against this freeze. Source stayed inside the frozen 2-file write set. Occupancy remained EMPTY. CONTAINER-MANAGER was not acquired. Step 4 / LOCK is **not** authorized.

### 18.1 Implementation result

- Static HTML preview unchanged (`direct-read`; no process; no `npm install`).
- Vite-only productized path at `/workspace/package.json` with `scripts.dev`.
- Next.js / CRA / Vue CLI / Vue / Express / generic scripts / `providedCommand` fail closed (no install; no process launch).
- npm install: Vite path only; foreground; cwd `/workspace`; skip if `node_modules` exists; `npm install --no-audit --no-fund`; no `npm ci`; lockfile not required; 120s; timeout/failure fail closed and do not start.
- Start: `npm run dev -- --host 0.0.0.0 --port $PORT` after existing `$PORT` replace; existing background-shell pattern; pool `3001`–`3100`; env `PORT` preserved.
- Wait/health: 20s total, 500ms poll, any HTTP status `>= 100` → `running`; timeout kills PID, releases port, clears map; Vite does not remain `starting`.

### 18.2 Tests

Working directory: `C:\Users\knlee\aiSandBox2026B\services\container-manager`

Requested command:

```powershell
npx jest --testPathPattern "preview\\.(service|strategy\\.resolver)\\.spec"
```

Result: **0 tests matched** (Windows PowerShell / Jest path regex). Equivalent command used:

```powershell
npx jest --testPathPattern "preview.service.spec|preview-strategy.resolver.spec"
```

Result: **PASS** — 2 suites, **38/38** tests (including existing static HTML tests and resolver frozen-read tests).

```powershell
npx tsc --noEmit --incremental false
```

Result: **PASS** (exit 0).

```powershell
git -C "C:\Users\knlee\aiSandBox2026B" diff --check
```

Result: **PASS** (exit 0; CRLF warning only, no whitespace errors).

No Docker / Postgres / Redis / staging / browser / live `npm install`.

### 18.3 Step 3 acceptance

- [x] Implementation stayed inside frozen 2-file write set
- [x] Vite-only; neighbors fail closed; static HTML unchanged
- [x] LOCAL-TESTS 38/38 + tsc PASS; PowerShell regex note recorded
- [x] occupancy EMPTY; not admitted; not LANE-DONE; not LOCKED
- [x] `admissionUncertain=true`; candidate not in S
- [x] CONTAINER-MANAGER declared not acquired
- [x] EXEC-01C6A `startCondition=NOT_READY` UNCHANGED
- [x] Step 4 NOT AUTHORIZED
- [x] No Git commit/push

### 18.4 Authorization state (end of Step 3 reconciliation)

```
IMPLEMENTATION_AUTHORIZED=YES (Step 3 source COMPLETE; frozen 2-file write set only; uncommitted)
ADMISSION_AUTHORIZED=NO
STAGING_AUTHORIZED=NO
LOCAL_RUNTIME_AUTHORIZED=NO
PROVIDER_LIVE_AUTHORIZED=NO
CREDIT_AUTHORIZED=NO
TESTS_EXECUTED=YES (38/38 + tsc PASS)
APPLICATION_SOURCE_CHANGED=YES (frozen 2-file write set only; this reconciliation does not behavior-change those files)
LANE_1=EMPTY
LANE_2=EMPTY
CONTAINER_MANAGER_ACQUIRED=NO
STEP4_AUTHORIZED=NO
LOCKED=NO
FOLLOW_ON_REGISTERED=NO
EXEC_01C6A_REOPENED=NO
```

---

## 19. Activity ledger (Step 3)

**Step 3 HEAD:** not queried this window (Keith instruction: No Git except `git diff --check`; implementation uncommitted)
**Step 3 implementation ledger:** LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, frontend=0, i18n=0, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0. Application source: frozen 2-file write set only. Tests: requested PowerShell regex matched 0 tests; equivalent `npx jest --testPathPattern "preview.service.spec|preview-strategy.resolver.spec"` PASS 2 suites / 38/38; `npx tsc --noEmit --incremental false` PASS; `git diff --check` PASS.
**Step 3 reconciliation ledger (this window):** LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=0, application source=0, frontend=0, i18n=0, tests executed=0, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0. Governance writes: this stage-start Step 3 record; `TASKS.md` CURRENT EXECUTION BOARD fields; `TASKS_BACKLOG_FULL.md` PREVIEW-NODE-01 body; sidecar occupancy/candidate machine fields unchanged; `SATURATION_PROOF.json` only as validator output. Occupancy facts unchanged (EMPTY / GOVERNANCE UNOWNED).
