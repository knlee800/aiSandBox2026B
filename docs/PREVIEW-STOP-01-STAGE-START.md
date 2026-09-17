# PREVIEW-STOP-01 — Stage-start / exact-scope freeze

**Task ID:** PREVIEW-STOP-01
**Title:** Preview stop/restart reliability for static and Vite previews
**Date:** 2026-09-16
**Nature:** IMPLEMENTATION — high-risk; container process stop, ports, process-proxy, Vite/node orphan cleanup
**Lifecycle:** 4-step IMPLEMENTATION
**Step:** 4 COMPLETE AND LOCKED — independent verification / checkpoint / lock
**Step status:** Step 1 COMPLETE — 2026-09-16 (registration / control-plane only) — Step 2 COMPLETE — 2026-09-16 — Step 3 COMPLETE — 2026-09-17 (Keith-authorized frozen write-set implementation; committed `79510ca` `fix: make preview stop reliable`; LOCAL-TESTS PASS) — Step 4 COMPLETE AND LOCKED — 2026-09-17
**This document:** Authoritative Step 2 freeze, Step 3 completion record, and Step 4 checkpoint / lock for PREVIEW-STOP-01. It does **not** authorize admission, runtime, staging/browser proof, Harness, orchestration, Stripe, apex cutover, invitations, EXEC-01C6A reopen, or follow-on registration.

**Occupancy hash (end-state):** `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d` (Lane 1 EMPTY, Lane 2 EMPTY, GOVERNANCE UNOWNED)

```
STEP1_COMPLETE=YES
STEP2_COMPLETE=YES
STEP2_AUTHORIZED=YES
STEP3_AUTHORIZED=YES
STEP3_COMPLETE=YES
STEP4_AUTHORIZED=YES
STEP4_COMPLETE=YES
LOCKED=YES
IMPLEMENTATION_STARTED=YES
ADMITTED=NO
WRITE_SET_PRECISION=EXACT
CANDIDATE_STATUS=LOCKED
ADMISSION_UNCERTAIN=false
TEST_ADMISSIBLE=NOT_READY
MUTEXES_DECLARED=CONTAINER-MANAGER
MUTEXES_ACQUIRED=NO (end-state UNOWNED after Step 4 lock)
GATEWAY_DECLARED=NO
FRONTEND_I18N=NO
PUBLIC_STOP_VERB=POST
DELETE_STOP_ALIAS=YES
STOP_IDEMPOTENT=YES
PROCESS_TREE_AND_PORT_KILL=YES
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
RUNTIME=NO
BROWSER=NO
GIT_COMMIT=NO
```

Keith authorized this Step 4 checkpoint / lock after Step 3 PASS (committed `79510ca`). Occupancy remains EMPTY. Sidecar candidate is `status=LOCKED` / `writeSetPrecision=EXACT` / `admissionUncertain=false` so the candidate is **not** in S (`Test-Admissible` = NOT_READY). Do **not** admit Lane 1 or Lane 2. Do **not** register follow-on tasks. Do **not** reopen AGENT-PLATFORM-EXEC-01C6A. BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON. Step 3 verdict = **PASS**. Step 4 verdict = **COMPLETE AND LOCKED**.

---

## 1. Inherited product / architecture facts (must not reopen)

- `PRD.md` CURRENT includes integrated workspace preview, HTTP/WebSocket (HMR/dev servers), and predictable lifecycle behavior for sessions, workspaces, and previews.
- `ARCHITECTURE.md` §6 records preview strategy resolution, Gateway preview proxy to container-manager, and `node-dev-server` as CURRENT HOW. Stop already exists as CURRENT HOW (`PreviewService.stopPreview`; container-manager `DELETE :sessionId/stop`) but is not reliable enough for Builder completion.
- Locked PREVIEW-NODE-01 / PREVIEW-NODE-STAGING-01 / PREVIEW-NODE-STAGING-APPLY-01 proved Vite start and recorded the stop/orphan gap. They are sequencing context, not machine `dependsOn`.
- Locked PREVIEW-STRATEGY-01A / PREVIEW-STATIC-01B / PREVIEW-AUTOSTART-01A closed the static-html family. Static stop must not regress.
- BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON.
- Working single-shot Builder Ask/Build remains the product to complete, not to replace.
- Product-visible Harness / orchestration / Stripe / apex production routing remain FUTURE/gated.
- EXEC-01C6A remains `startCondition=NOT_READY` / not reopened.

This freeze productizes the already-CURRENT stop path. It does not rewrite `PRD.md` or `ARCHITECTURE.md`.

---

## 2. Source-grounded diagnosis (Step 2)

### 2.1 Observed gap (locked STAGING-01 / APPLY-01 evidence; not re-run this window)

From `docs/PREVIEW-NODE-STAGING-01-STAGE-START.md` §17:

- Vite preview worked after APPLY-01 (`PREVIEW-NODE-STAGING-01 Vite OK`; Vite on port 3001; session `08a1491f-bb30-490e-8c4b-bb59fda0ac78`).
- Operator `POST /api/preview/{viteSessionId}/stop` returned HTTP **400** (`net::ERR_ABORTED`).
- Vite process stayed alive on port 3001 (pid 182 `node .../vite --host 0.0.0.0 --port 3001`) until Advanced session Stop.
- Static preview passed (`PREVIEW-NODE-STAGING-01 Static OK`; no Vite/node process).
- Earlier failed Vite start (pre-apply): `POST /stop` HTTP 400 empty body; `GET /status` remained `starting`; no live listen. Stop did **not** clear the in-memory map.
- No Ask/Build / provider / credit was involved.
- Freeze already recorded: **no Stop Preview button.** Stop is operator `POST /api/preview/:sessionId/stop`, then optional Advanced session Stop as hard cleanup.

### 2.2 Likely source boundary

This is a **combination**, with the public-verb mismatch as the first hop and container-manager stop behavior as the remaining reliability hole.

| Layer | Finding | In Step 3 write set? |
|---|---|---|
| Frontend | No stop caller. `handleStartPreview` is `POST /api/preview/:sessionId/start` with no body. No Stop Preview button. Operator used DevTools POST per STAGING-01 freeze. | **No** |
| Next rewrite | `frontend/next.config.js` fallback `/api/:path*` → Gateway. Method-transparent. | **No** |
| Gateway | `services/api-gateway/src/preview/preview.controller.ts` `@Controller("preview")` + `@All("*")` forwards `req.method` unchanged. Guards: `SessionCookieGuard` + `PreviewOwnershipGuard`. **Not** `CsrfGuard` (`CsrfGuard` is 403, not 400). CSRF/session-cookie is **not** the stop 400: the same operator/UI POST path already succeeded for `/start`. | **No** |
| CM route | `services/container-manager/src/preview/preview.controller.ts` registers `@Delete(':sessionId/stop')` only. Start is `@Post(':sessionId/start')`. | **Yes** |
| CM service | `PreviewService.stopPreview`: 404 if no map entry; pid-only TERM/KILL; on kill throw, **400 and map/port left intact**. Static has no pid. Start early-returns while the map still has `starting`/`running`. | **Yes** |
| Plural `src/previews/` | Public `/previews/:sessionId/*` proxy and internal port registry. Not the workspace Start/Stop contract. | **No** |

**Public/operator stop verb is POST.** Gateway will forward POST as POST. Container-manager currently has no POST stop handler, so operator POST does not invoke `stopPreview`.

NestJS unmatched-method status is typically **404** (`Cannot POST ...`), not 400. The observed HTTP 400 / `net::ERR_ABORTED` is therefore **not uniquely proven from source alone** as the Nest 404 body; it is still the failed public POST stop. Step 3 must make POST invoke `stopPreview`. That is sufficient to close the first hop without guessing Caddy/Chrome abort details.

**Even a correctly routed DELETE/POST stop is not reliable enough:**

1. `stopPreview` throws `NotFoundException('No active preview for this session')` when the map is empty — not idempotent.
2. Kill is `kill -TERM ${pid}` then `kill -KILL ${pid}` on the captured background-subshell pid only. Launch is `(${cmd}) >/tmp/preview-${port}.log 2>&1 & echo $!`. Vite/node/esbuild children can survive. Staging left pid 182 listening on 3001 after failed stop.
3. If `killPreviewPid` / exec throws, the catch converts to `BadRequestException('Failed to stop preview')` **without** `releasePort` / `activePreviews.delete`. Status can stay `starting`/`running`.
4. `startPreview` early-returns if the map still has the session, so restart after a failed stop cannot allocate/run again (`No available ports` is the pool-exhaustion cousin of a leaked map+port).
5. Start-wait race: if stop clears the map during `waitForPreviewServer`, start currently still returns `{ status: preview?.status \|\| 'running' }` and can lie that preview is running.

CSRF, Ask/Build, gateway header sanitization, and Advanced session Stop are **not** the product stop path.

### 2.3 Intended public stop contract

- **Public verb:** `POST /api/preview/:sessionId/stop`
- **Compatibility alias:** keep `DELETE /api/preview/:sessionId/stop` on the same handler
- Gateway remains method-transparent `@All("*")`. Do **not** remap POST→DELETE in Gateway.
- Frontend remains without a Stop Preview button in this slice.

---

## 3. Answers to the ten mandatory Step 2 questions

1. **Root cause / public verb.** Combination: operator/public POST vs CM `@Delete` is the first hop (Gateway forwards POST unchanged; frontend has no stop caller). CSRF is not the 400 (`CsrfGuard` is unused on preview; same-cookie POST `/start` succeeded). Remaining hole is `stopPreview` itself (non-idempotent 404, pid-only kill, 400-without-clear). Public stop verb = **POST**. DELETE stays as alias.
2. **Process tree + port.** Yes. Stop must TERM/KILL the recorded pid **and** its process group, then kill any leftover listener on the allocated preview port only (`3001`–`3100` assigned value), then release that port in the in-memory pool. Do not docker-kill the container. Do not session-stop.
3. **Static vs Vite.** Static `direct-read` has no pid. Stop is still success: skip pid kill, release port, clear map. Second stop is idempotent success. Vite stop must kill process tree + port listener.
4. **Restart.** After successful stop, `activePreviews` has no entry and the port is back in the pool. A second `startPreview` must not early-return; it must allocate and run again. No Advanced session Stop required.
5. **Exact filenames.** Frozen in §5. Gateway/frontend/`src/previews/` (plural) are out.
6. **Stop Preview button.** **No.** FRONTEND + I18N remain undeclared. No caller copy change.
7. **Tests.** Frozen in §6. LOCAL-TESTS only. Existing Vite start tests and static tests remain green. Ask/Build execute path is not in the write set.
8. **Staging/browser proof.** Later child, not this slice. Default LOCAL-TESTS. Do not register that child in this window.
9. **Harness / orchestration / Stripe / apex / invites / EXEC-01C6A.** None included. EXEC-01C6A `startCondition=NOT_READY` unchanged. Gate LEFT ON.
10. **Advanced session Stop.** Remains hard cleanup only. Not the normal product stop path. Do not require it for Start → Stop → Restart.

---

## 4. Frozen behavior

### 4.1 Stop HTTP

Controller `stopPreview` remains the handler. Add `@Post(':sessionId/stop')` and keep `@Delete(':sessionId/stop')` on that same method.

Response shape stays `{ success: true, ...serviceResult }` with HTTP 200.

Service result:

| Precondition | Result |
|---|---|
| Session not usable | Existing `assertSessionUsable` exceptions unchanged (404/410). Not a silent success. |
| No map entry, session usable | Idempotent no-op HTTP 200 `{ message: 'No active preview for this session' }`. **Do not throw 404.** |
| Static preview (no pid) | Release port, delete map, HTTP 200 `{ message: 'Preview stopped successfully' }`. Do not require a process. |
| Vite `starting` or `running` with pid | Kill tree + port listener (best-effort), always release port, always delete map, HTTP 200 `{ message: 'Preview stopped successfully' }`. |
| Kill/exec throws | Catch, log, **still** release port and delete map, HTTP 200 with the success message. **Do not throw `Failed to stop preview` after state is clearable.** |

Stop must clear `starting` as well as `running`. `getPreviewStatus` after stop is `null` (controller already returns `{ running: false, message: 'No active preview for this session' }`).

### 4.2 Kill helper

Keep a single helper used by both `stopPreview` and the existing start-wait timeout path.

Required kill sequence inside the session container (`sh -c`, `|| true`, bounded timeout):

1. If `pid` is a positive integer: `kill -TERM ${pid}` then `kill -TERM -${pid}` (process group).
2. `sleep 1`.
3. If pid still alive: `kill -KILL ${pid}` and `kill -KILL -${pid}`.
4. Port-scoped leftover cleanup for **that allocated preview.port only**. Implementation may use `/proc` and/or `fuser`/`pkill` with `|| true` fallbacks. Must not kill listeners on other ports. Must not `docker kill` / session stop.
5. Existing start-timeout tests assert substrings `kill -TERM 4242` and `kill -KILL 4242`. Those literals must remain in the helper so those tests stay green.

Kill attempts are best-effort. Success of stop is **state cleared + port released**, not “every child wait(2) harvested.”

### 4.3 Restart / start race

- Duplicate Start while map still has the session: existing early-return unchanged (prevents double-start).
- After stop: map empty → Start allocates and launches again.
- If stop runs during `waitForPreviewServer`: after wait, if the map entry is gone, do **not** re-insert and do **not** return `status: 'running'`. Fail closed with `BadRequestException('Preview was stopped before it became ready.')` (or equivalent explicit stopped-before-ready message). The stop path already attempted kill/clear.

Do not change: resolver, Vite launch command, npm install policy, wait timeouts, static `direct-read`, proxy middleware, host bind, port range `3001`–`3100`.

### 4.4 What stop is not

- Not Advanced session Stop.
- Not a new UI control.
- Not a Gateway POST→DELETE adapter.
- Not a change to Ask/Build.

---

## 5. Exact write set

`writeSetPrecision=EXACT`. Paths are repo-relative POSIX.

### 5.1 Step 2 this window (governance only)

1. `docs/PREVIEW-STOP-01-STAGE-START.md`
2. `TASKS.md` CURRENT EXECUTION BOARD fields
3. `TASKS_BACKLOG_FULL.md` PREVIEW-STOP-01 body
4. `docs/control-plane/lane-saturation-state.json` candidate `writeSetPrecision=EXACT`, exact `writePaths` below, occupancy EMPTY, `admissionUncertain=true`
5. `docs/control-plane/SATURATION_PROOF.json` only as validator output

### 5.2 Step 3 (NOT authorized this window)

**Modify (machine `writePaths`):**

1. `services/container-manager/src/preview/preview.service.ts`
2. `services/container-manager/src/preview/preview.controller.ts`
3. `services/container-manager/src/preview/preview.service.spec.ts`

Sidecar `writePaths` is exactly those three paths, in that order.

Route/method mapping tests (POST + DELETE on the stop handler) live in `preview.service.spec.ts` (import controller metadata; do **not** add a fourth file).

**Create:** none.
**Gateway / frontend / i18n:** none.

### 5.3 Frozen-read (must not be written)

- `services/api-gateway/src/preview/preview.controller.ts` and `services/api-gateway/src/preview/__tests__/**`
- `services/container-manager/src/previews/**` (plural public proxy / internal port registry)
- `services/container-manager/src/preview/preview-strategy.resolver.ts` and its spec
- `frontend/**` including `frontend/app/[locale]/app/page.tsx` and `frontend/messages/*.json`
- `PRD.md` / `ARCHITECTURE.md` / `CLAUDE.md` / `AGENTS.md`
- Harness / EXEC-01C6A / orchestration / apex / invite files
- session Stop / Advanced session Stop callers (`POST /api/sessions/:id/stop`)

### 5.4 Explicitly excluded unless the control plane expands scope

- Stop Preview button, i18n copy, workspace-shell/page.tsx stop wiring
- Gateway method remapping or new Gateway tests
- Staging/SSH/AWS/PM2/env/browser proof
- Docker/compose/package.json/lockfiles
- Ask/Build execute path
- Next.js / CRA / Vue / Express preview productization
- Preview refresh UX
- Session-stop map cleanup hook (later if needed; not this slice)

Anything outside the frozen write set is forbidden by default.

---

## 6. Tests and verification plan

Evidence class: **LOCAL-TESTS**. No Docker/Postgres/Redis. No browser. No provider-live. No staging.

### 6.1 Required tests (Step 3, later)

Add to `preview.service.spec.ts`:

1. **Vite running stop.** After a successful Vite start (existing launch mock + health 200), `stopPreview` runs a kill script containing `kill -TERM ${pid}` and `kill -KILL ${pid}` (and the process-group / port-scoped extras), `getPreviewStatus` is `null`, allocated port is back in `portPool` (size 100 / has 3001).
2. **Vite starting stop.** Map entry `status: 'starting'` with pid; stop kills, clears map, releases port; does not throw.
3. **No active preview idempotency.** `stopPreview` on a usable session with empty map returns `{ message: 'No active preview for this session' }` and does **not** throw `NotFoundException` / `Failed to stop preview`.
4. **Static no process.** Static start (no exec launch / no pid); stop does not require a pid kill of a Vite process; map cleared; port released; success message.
5. **Restart after stop.** Vite start → stop → start again. Second start must launch again (exec includes the Vite `& echo $!` command) and must **not** early-return the first port/status without launching.
6. **Kill throw still clears.** `killPreviewPid` / exec throws; stop still deletes the map, releases the port, and returns success (no `Failed to stop preview`).
7. **Start-wait vs stop.** If the map is cleared during wait, start must not return `running`. Fail closed with the frozen stopped-before-ready message.
8. **Route/method mapping.** `PreviewController.stopPreview` is decorated with **both** POST and DELETE on `:sessionId/stop`. Start remains POST `:sessionId/start`. Do not change Gateway `@All("*")` contract tests (Gateway is not in the write set).

Existing Vite start tests (skip install, host/port launch, install timeout/failure, health probe, wait-timeout kill, Next/CRA/providedCommand/Vite-without-dev fail-closed) and static tests remain green. The wait-timeout test’s `kill -TERM 4242` / `kill -KILL 4242` assertions remain valid because those literals stay in the helper.

Do not add Playwright/browser tests. Do not add Gateway tests. Do not add frontend tests.

### 6.2 Step 3 verification commands (NOT authorized this window)

When Step 3 is later authorized:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm test -- src/preview/preview.service.spec.ts
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npx tsc --noEmit
```

If the repo’s `npm test` runner is the established equivalent and stays inside this spec plus already-green neighbors, it may be used instead. Do not start Docker/dev servers.

### 6.3 Step 2 this window

```powershell
powershell -NoProfile -File "C:\Users\knlee\aiSandBox2026B\scripts\validate-lane-capacity.ps1"
git -C "C:\Users\knlee\aiSandBox2026B" diff --check
```

No container-manager tests. No tsc. No runtime. No browser.

---

## 7. Mutexes / runtime needs (declared, not acquired now)

| Item | Step 2 (this window) | Step 3 (later authorization) |
|---|---|---|
| GOVERNANCE | Held for this doc/board/registry/sidecar write, then released UNOWNED | Held only if later admission/lock requires board writes |
| CONTAINER-MANAGER | Declared, **not acquired** | Acquire only if Step 3 is admitted |
| GATEWAY | **Undeclared** (Step 2 proved method-transparent; not in write set) | Still undeclared |
| FRONTEND | Undeclared | Still undeclared |
| I18N | Undeclared | Still undeclared |
| LOCAL-RUNTIME | Undeclared | Still undeclared |
| STAGING | Undeclared | Still undeclared |
| PROVIDER-LIVE | Undeclared | Still undeclared |
| CREDIT | Undeclared | Still undeclared |
| HOTFILE | none | none |

`stagingAuthorized=false`. `STAGING_EXECUTION_AUTHORIZED=NO`. `PROVIDER_LIVE_AUTHORIZED=NO`. `CREDIT_MUTATION_AUTHORIZED=NO`. `LOCAL_RUNTIME_AUTHORIZED=NO`.

Admission remains **not** performed. `admissionUncertain=true` is intentional (keeps the candidate out of S). It is **not** an admission.

---

## 8. Shared contracts

- `sharedContractIds=[]`. `mutatesSharedContractIds=[]`.
- `HARNESS_ENTITLEMENT_PROOF_V1` remains FROZEN and is not consumed or mutated.
- Public preview stop verb POST is a product HTTP convention, not a catalog shared-contract ID.

---

## 9. Rollback / revert isolation

Step 2 revert = discard this stage-start and restore PREVIEW-STOP-01 board/registry/sidecar fields to Step 1 (`writeSetPrecision=PROVISIONAL`, empty `writePaths`, mutexes `CONTAINER-MANAGER` + `GATEWAY`, `admissionUncertain=true`). Occupancy is already EMPTY / GOVERNANCE UNOWNED.

Must not mutate EXEC-01C6A prepared artifacts. Cannot invalidate locked BUILDER-CREDIT-UX-01 / PREVIEW-NODE-01 / PREVIEW-NODE-STAGING-01 / PREVIEW-NODE-STAGING-APPLY-01 / BUILDER-LIVE-GATE-01 / PREVIEW-STRATEGY-01A / PREVIEW-STATIC-01B / PREVIEW-AUTOSTART-01A evidence.

---

## 10. Keith-decision boundary after this freeze

```
KEITH_DECISION_REQUIRED_BEFORE_STAGE_START=NO (Step 2 authorized and COMPLETE this window)
KEITH_DECISION_REQUIRED_BEFORE_ADMISSION=YES
KEITH_DECISION_REQUIRED_BEFORE_IMPLEMENTATION=NO (Step 3 authorized and COMPLETE; committed `79510ca`)
KEITH_DECISION_REQUIRED_BEFORE_CHECKPOINT_LOCK=NO (Step 4 authorized by Keith and COMPLETE AND LOCKED 2026-09-17)
KEITH_DECISION_REQUIRED_BEFORE_STAGING_OR_BROWSER_PROOF=YES
KEITH_DECISION_REQUIRED_BEFORE_REOPENING_EXEC_01C6A=YES
KEITH_DECISION_REQUIRED_BEFORE_HARNESS_ENABLEMENT=YES
KEITH_DECISION_REQUIRED_BEFORE_STRIPE_OR_TOP_UP=YES
KEITH_DECISION_REQUIRED_BEFORE_APEX_PRODUCTION_ROUTING=YES
KEITH_DECISION_REQUIRED_BEFORE_REGISTERING_NAMED_CHILDREN=YES
```

This freeze does **not** reopen EXEC-01C6A. It does **not** change BUILDER-LIVE-GATE-01. Gate remains ON. Named later children remain unregistered (refresh UX, Stop Preview button, Next/CRA/Vue/Express, mobile polish, apex routing, staging/browser proof child).

---

## 11. Step 2 acceptance

- [x] Source boundary frozen: Gateway method-transparent; frontend has no stop caller; CM `@Delete` vs public POST is the first hop; `stopPreview` remains unreliable even after POST is accepted
- [x] Public stop verb frozen as POST; DELETE kept as alias
- [x] Stop idempotent no-op for no active preview
- [x] Stop kills Vite/node process tree and releases the allocated port
- [x] Stop clears `starting`/`running` map state
- [x] Restart after stop can allocate/run again
- [x] Static stop safe / no-op-ish (no process required)
- [x] No full session stop required for normal preview stop
- [x] Exact Step 3 write set frozen: three container-manager preview files; Gateway/frontend out
- [x] Tests frozen: Vite stop, starting stop, idempotent empty, static no process, restart after stop, kill-throw still clears, start-wait race, POST+DELETE mapping
- [x] Existing Vite start tests and static tests remain green
- [x] No UI redesign/i18n; no Ask/Build/provider/credit; no Harness/EXEC-01C6A; no orchestration; no staging/browser in Step 3; no runtime/PM2/env/deploy
- [x] Sidecar `writeSetPrecision=EXACT`; `admissionUncertain=true`; occupancy EMPTY
- [x] CONTAINER-MANAGER declared not acquired; GATEWAY/FRONTEND undeclared
- [x] No implementation source edits this window
- [x] No runtime / browser / Git commit

---

## 12. Step 2 activity ledger

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=0, application source=0, frontend=0, i18n=0, tests executed=0, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0, named other children registered=0, Stripe=0, credit mutation=0, follow-on registration=0.

Governance writes: `docs/PREVIEW-STOP-01-STAGE-START.md`; `TASKS.md` CURRENT EXECUTION BOARD fields; `TASKS_BACKLOG_FULL.md` PREVIEW-STOP-01 body; sidecar candidate `writeSetPrecision=EXACT` / exact `writePaths` / mutexes `CONTAINER-MANAGER` only / occupancy EMPTY / GOVERNANCE UNOWNED / `admissionUncertain=true`; `SATURATION_PROOF.json` only as validator output.

---

## 13. Step 3 / Step 4 (historical freeze note)

Step 3 was NOT authorized in the Step 2 freeze window. Step 3 source was later Keith-authorized and committed at `79510ca`. Step 4 is COMPLETE AND LOCKED in this window.

---

## 14. Step 3 acceptance (preserved; not re-run this lock window)

- [x] Keith authorized Step 3 (implementation committed `79510ca` `fix: make preview stop reliable`)
- [x] Frozen 3-file write set only: `preview.controller.ts`, `preview.service.ts`, `preview.service.spec.ts`
- [x] Public stop verb POST `:sessionId/stop`; DELETE kept as alias (`stopPreviewByDelete` delegates to `stopPreview`)
- [x] Idempotent no-op when no map entry (`No active preview for this session`; no 404)
- [x] Vite running/starting stop kills process tree + port listener, clears map, releases port
- [x] Static stop does not require a pid; clears map and releases port
- [x] Kill/exec throw still clears map and releases port (HTTP 200 success)
- [x] Restart after stop allocates/launches again
- [x] Start-wait vs stop fail-closed: `Preview was stopped before it became ready.`
- [x] `npx jest --testPathPattern "preview\\.service.spec"` PASS — 38/38
- [x] `npx tsc --noEmit --incremental false` PASS
- [x] `git diff --check` PASS
- [x] No runtime/browser/staging/SSH/AWS/PM2/Docker/Postgres/Redis/provider/credit
- [x] No Ask/Build, Gateway, frontend, Harness, orchestration, Stripe, apex
- [x] occupancy EMPTY; not admitted; EXEC-01C6A `startCondition=NOT_READY` UNCHANGED
- [x] BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON

## 15. Step 3 activity ledger

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=1 (frozen 3-file CM preview write set only), application source=1 (frozen write set only), frontend=0, i18n=0, tests executed=1 (preview.service.spec + tsc), dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0 this lock window, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0, named other children registered=0, Stripe=0, credit mutation=0, follow-on registration=0.

Committed implementation HEAD: `79510ca200c9bfda999cb6140c6596d65ccec02f` (`fix: make preview stop reliable`). Three files only.

---

## 16. Step 4 acceptance (COMPLETE AND LOCKED — 2026-09-17)

- [x] Independent verification against freeze + committed HEAD `79510ca200c9bfda999cb6140c6596d65ccec02f` (`fix: make preview stop reliable`)
- [x] Frozen write set confirmed: exactly the three container-manager preview files
- [x] LOCAL-TESTS preserved from Step 3: `npx jest --testPathPattern "preview\\.service.spec"` PASS 38/38; `npx tsc --noEmit --incremental false` PASS
- [x] no runtime/browser/staging/SSH/AWS/PM2/Docker/Postgres/Redis/provider/credit; no Ask/Build, Gateway, frontend, Harness, orchestration, Stripe, apex
- [x] EXEC-01C6A `startCondition=NOT_READY` UNCHANGED
- [x] BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON
- [x] sidecar `status=LOCKED` / `admissionUncertain=false`; `lockedTaskIds` includes PREVIEW-STOP-01
- [x] Occupancy EMPTY; no lane admitted; GOVERNANCE released UNOWNED; no follow-on registered
- [x] Validator PASS this lock window
- [x] `git diff --check` PASS
- [x] No Git commit/push by the worker

---

## 17. Authorization state (end of Step 4 lock)

```
IMPLEMENTATION_AUTHORIZED=YES (Step 3 source COMPLETE AND LOCKED; frozen 3-file CM preview write set only)
ADMISSION_AUTHORIZED=NO
STAGING_AUTHORIZED=NO
LOCAL_RUNTIME_AUTHORIZED=NO
PROVIDER_LIVE_AUTHORIZED=NO
CREDIT_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
TESTS_EXECUTED=YES (jest 38/38; tsc PASS; recorded from Step 3; not re-run this lock window)
APPLICATION_SOURCE_CHANGED=YES (frozen write set only; committed at 79510ca; this lock does not behavior-change those files)
LANE_1=EMPTY
LANE_2=EMPTY
CONTAINER_MANAGER_ACQUIRED=NO
GATEWAY_DECLARED=NO
FRONTEND_I18N=NO
STEP4_AUTHORIZED=YES
STEP4_COMPLETE=YES
LOCKED=YES
FOLLOW_ON_REGISTERED=NO
EXEC_01C6A_REOPENED=NO
```

Previous (end of Step 2): IMPLEMENTATION_AUTHORIZED=NO; ADMISSION_AUTHORIZED=NO; STEP3_AUTHORIZED=NO; STEP4_AUTHORIZED=NO; LOCKED=NO.

---

## 18. Activity ledger (Step 4) and lock evidence

**Step 4 lock ledger (this window):** LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=0, application source=0, frontend=0, i18n=0, tests executed=0, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0, named other children registered=0, Stripe=0, credit mutation=0, follow-on registration=0. Governance writes: this stage-start Step 4 checkpoint; `TASKS.md` CURRENT EXECUTION BOARD fields; `TASKS_BACKLOG_FULL.md` PREVIEW-STOP-01 body; sidecar candidate `status=LOCKED` / `admissionUncertain=false` + `lockedTaskIds`; `SATURATION_PROOF.json` only as validator output. Occupancy facts unchanged (EMPTY / GOVERNANCE UNOWNED).

**Invitation invariant:** PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.

**Lane 3 invariant:** Lane 3 remains DISABLED.

**Activation effect:** NONE
**Rollback boundary:** Step 2 = discard this document’s freeze plus that window’s board/registry/sidecar write-set field updates. Step 3 source = committed at `79510ca` (do not revert in this lock window). This lock = discard this window’s board/registry/stage-start/sidecar lock field updates (candidate `status=LOCKED` / `lockedTaskIds` membership). Ordinary Builder Ask/Build/static Preview path, locked Vite start path, live gate, and credit UX are otherwise untouched.

### Verdict

**PREVIEW-STOP-01 is COMPLETE AND LOCKED.**

**Committed implementation HEAD:** `79510ca200c9bfda999cb6140c6596d65ccec02f` (`fix: make preview stop reliable`)

**Frozen write set (implemented):**

1. `services/container-manager/src/preview/preview.service.ts`
2. `services/container-manager/src/preview/preview.controller.ts`
3. `services/container-manager/src/preview/preview.service.spec.ts`

**Scope:** Public POST `/api/preview/:sessionId/stop` with DELETE alias; idempotent empty-map stop; Vite process-tree + allocated-port kill; static stop without pid; always clear map and release port; restart after stop. No UI. No Gateway remap. No Ask/Build. No Harness. No orchestration. No apex. No invitations. No EXEC-01C6A reopen.

**Tests (preserved Step 3 evidence; not re-run this lock window):** `npx jest --testPathPattern "preview\\.service.spec"` PASS 38/38. `npx tsc --noEmit --incremental false` PASS. `git diff --check` PASS.

**Invariants:** EXEC-01C6A `startCondition=NOT_READY` UNCHANGED / not reopened. BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON. PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED. Lane 3 remains DISABLED. No follow-on task registered. No admitted next product gate / selection pending. Occupancy EMPTY. GOVERNANCE released UNOWNED.
