# PREVIEW-NODE-STAGING-01 — Stage-start / live proof procedure freeze

**Task ID:** PREVIEW-NODE-STAGING-01
**Title:** Staging browser proof for Vite preview
**Date:** 2026-09-15
**Nature:** IMPLEMENTATION / validation-ops — high-risk staging/browser proof of locked Vite preview (container process launch, ports, process-proxy, sandbox npm/dev-server)
**Lifecycle:** 4-step IMPLEMENTATION
**Step:** 4 COMPLETE AND LOCKED — independent verification / checkpoint / lock
**Step status:** Step 1 COMPLETE — 2026-09-14 (registration / control-plane only; committed `f82d747`); Step 2 COMPLETE — 2026-09-15 (committed `40a0b06`); Step 3 AUTHORIZED — historical FAIL §16 (S4/S5/S6 on `LIVE_OLD`); current proof PASS §17 (APPLY-01 Phase D after `LIVE_LOCKED` apply; committed `a1561a9`); Step 4 COMPLETE AND LOCKED — 2026-09-15
**This document:** Authoritative Step 2 freeze, Step 3 evidence, and Step 4 checkpoint. §16 is the historical signed-in FAIL (S4/S5/S6 on `LIVE_OLD` code). §17 is APPLY-01 Phase D rerun of this frozen §5 procedure after `LIVE_LOCKED` apply — **PASS** — and is the lock evidence. Dual-lock with PREVIEW-NODE-STAGING-APPLY-01 is recorded in §18.

**Parent:** PREVIEW-NODE-01 COMPLETE AND LOCKED — Checkpoint: `docs/PREVIEW-NODE-01-STAGE-START.md` — implementation HEAD `443d7eeecba7d8ef403fc77a3eee37d6d62f418a` (`feat: support vite preview`) — lock `26a1333` (`docs: lock vite preview slice`)
**Occupancy hash (end-state):** `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d` (Lane 1 EMPTY, Lane 2 EMPTY, GOVERNANCE UNOWNED)

```
STEP1_COMPLETE=YES
STEP2_COMPLETE=YES
STEP3_AUTHORIZED=YES
STEP3_COMPLETE=YES
STEP3_VERDICT=FAIL (historical §16)
CURRENT_PROOF_VERDICT=PASS (§17)
STEP4_AUTHORIZED=YES
STEP4_COMPLETE=YES
LOCKED=YES
IMPLEMENTATION_STARTED=NO
ADMITTED=NO
WRITE_SET_PRECISION=EXACT
CANDIDATE_STATUS=LOCKED
ADMISSION_UNCERTAIN=false
TEST_ADMISSIBLE=NOT_READY
APPLICATION_SOURCE=NONE
TEST_HARNESS_EXPANSION=NONE
FIXTURE_PATH=ZIP_IMPORT
ASK_BUILD=NO
PROVIDER_LIVE=NO
CREDIT=NO
LOCAL_RUNTIME=NO
MUTEXES_DECLARED=CONTAINER-MANAGER,STAGING
MUTEXES_ACQUIRED=NO
STAGING_AUTHORIZED=NO
STAGING_EXECUTION_AUTHORIZED=NO
SSH_USED=NO
STEP3_RETRY=YES
STEP3_RETRY_SUPERSEDES=b14e724 BLOCKED / §14
EVIDENCE_CLASS=STAGING-RUNTIME
HOST=https://staging.ainow.biz
APEX_AINOW_BIZ=OUT_OF_SCOPE
SLICE1_FRAMEWORK=Vite
STATIC_INDEX_HTML=MUST_NOT_REGRESS
ORPHAN_PROCESS_CHECK=REQUIRED
PORT_LEAK_CHECK=REQUIRED
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
```

Keith authorized Step 4 checkpoint/lock after APPLY-01 Step 3 PASS and this frozen §5 proof PASS (§17). Occupancy remains EMPTY. Sidecar candidate is `status=LOCKED` / `writeSetPrecision=EXACT` / `admissionUncertain=false` so the candidate is **not** in S (`Test-Admissible` = NOT_READY). Do **not** admit Lane 1 or Lane 2. Do **not** register follow-on tasks. Do **not** reopen AGENT-PLATFORM-EXEC-01C6A. BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON. Historical Step 3 verdict = **FAIL** (§16). Current proof verdict = **PASS** (§17). Step 4 verdict = **COMPLETE AND LOCKED**. Dual-lock with PREVIEW-NODE-STAGING-APPLY-01: `docs/PREVIEW-NODE-STAGING-APPLY-01-STAGE-START.md` §18.

---

## 1. Inherited product / architecture facts (must not reopen)

- `PRD.md` CURRENT includes integrated workspace preview and HTTP/WebSocket (HMR/dev servers).
- `ARCHITECTURE.md` records `PreviewStrategyResolver` `node-dev-server` via `package.json` as CURRENT HOW. Private-beta proven path remains static `index.html`.
- Locked PREVIEW-NODE-01 productized Vite-only launch with LOCAL-TESTS (38/38 + tsc PASS) and deferred this staging/browser proof as `STAGING_BROWSER_PROOF=LATER_CHILD`.
- Locked PREVIEW-STRATEGY-01A / PREVIEW-STATIC-01B / PREVIEW-AUTOSTART-01A closed the static-html family. They are the regression baseline, not this Vite proof.
- BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON (`GLOBAL_EXECUTION_ENABLED=true`). Gate ON is **not** authorization to use Ask/Build for this proof.
- Working single-shot Builder Ask/Build remains the product to complete, not to replace. This proof must not call it.
- Product-visible Harness / orchestration / Stripe / apex production routing remain FUTURE/gated.
- EXEC-01C6A remains `startCondition=NOT_READY` / not reopened.

This freeze proves the already-locked Vite launch through the real app path. It does not rewrite `PRD.md` or `ARCHITECTURE.md`. It does not add Next.js / CRA / Vue / Express support.

---

## 2. Source-grounded launch facts this proof must exercise

Grounded in locked PREVIEW-NODE-01 (`preview.service.ts` / `preview.service.spec.ts`). Do not change these files in this task.

| Fact | Locked behavior this proof expects |
|---|---|
| Detection | `/workspace/package.json` + `vite` in `dependencies` or `devDependencies` + `scripts.dev` → resolver `framework === 'Vite'` / `command === 'npm run dev'` |
| Non-Vite | Next/CRA/Vue/Express/generic/`providedCommand` fail closed; no process |
| Static | No `package.json` + `/workspace/index.html` → `static-html` / `direct-read` / no process |
| Install | Vite only; foreground `npm install --no-audit --no-fund` if `[ -d /workspace/node_modules ]` is false; 120s; skip if directory exists; no `npm ci` |
| Launch | `npm run dev -- --host 0.0.0.0 --port $PORT` via `(${cmd}) >/tmp/preview-${port}.log 2>&1 & echo $!`; pool `3001`–`3100`; env `PORT` + `NODE_ENV=development` |
| Wait | 20000 ms / 500 ms poll / axios GET any HTTP `>= 100` → `running`; timeout kills PID, releases port, clears map; must not remain `starting` |
| UI start | `data-testid="workspace-preview-start"` enabled only when `previewState === 'unavailable'`; `handleStartPreview` → `POST /api/preview/:sessionId/start` **with no body** |
| Success URL | iframe `data-testid="workspace-preview-iframe"` src `/api/preview/{sessionId}/proxy?refresh={timestamp}` |
| Failure UX | Backend 400; frontend polls `GET /status` up to 5 × 800 ms then `unavailable`. No new i18n in this task |
| Stop UI | **No Stop Preview button.** Stop is `POST /api/preview/:sessionId/stop` (operator DevTools) then optional Advanced `workspace-advanced-stop-session` |
| Container name | `sandbox-session-{sessionId}` |
| One preview / session | Existing map + early-return if already present |

---

## 3. Answers to the ten mandatory Step 2 questions

1. **Disposable project/workspace:** Keith, signed-in, on `https://staging.ainow.biz/en/app`. Two New Project creates. Cleanup owner: Keith + Step 3 operator. Projects are **retained** (no project-delete endpoint). Session stop is the runtime cleanup.
2. **Minimal Vite workspace:** Operator-built ZIP fixture imported through existing History → Import Project. **No Ask/Build.** PROVIDER-LIVE and CREDIT remain undeclared and unauthorized. Freeze proves they are avoidable.
3. **UI start-preview path:** Manual **Start Preview** only (`workspace-preview-start`). Do not rely on auto-start (no file-action apply). Success = iframe loads and shows the Vite marker.
4. **Static regression:** Second disposable project with `index.html` only (no `package.json`). Start Preview; iframe shows the static marker. Vite project must not be used for this check.
5. **Orphan / port leak:** Inspect while running, after `POST /stop`, and after session Stop. Fail if vite/node still listens on `3001`–`3100` after stop, or if `/tmp/preview-*.log` PID is still alive.
6. **Cleanup:** Stop preview, stop both sessions, retain named disposable projects, leave gate ON, do not PM2-restart, do not delete DB rows.
7. **Write set:** No tiny test-harness. No application source. EXACT writePaths = empty. Step 3/4 may append evidence/checkpoint docs only under GOVERNANCE.
8. **Mutexes:** CONTAINER-MANAGER + STAGING remain declared. LOCAL-RUNTIME is **not** added. Default is staging/browser only.
9. **Out of scope confirmed:** No Harness, orchestration, Stripe, apex DNS, invitation, or EXEC-01C6A work.
10. **Invariants:** Builder live gate remains ON. EXEC-01C6A remains `startCondition=NOT_READY`.

---

## 4. Host / operator identity

| Item | Freeze |
|---|---|
| Live Builder | `https://staging.ainow.biz` — Lightsail `aisandbox-staging` (`18.136.141.186`, `/opt/aisandbox`) |
| Apex `https://ainow.biz` | Different site. **Out of scope.** Do not use it |
| SSH host alias | `Host aisandbox-staging` in `C:\Users\knlee\.ssh\config` — **fallback only** if workspace exec is unavailable and Keith later authorizes SSH in Step 3 |
| Operator | Keith signed-in staging account (same family as prior staging smokes) |
| Locale | `/en/app` |
| Chat / Ask / Build / Send | **Forbidden** for this proof |

Do **not** create the projects, ZIPs, or run any of the procedure during Step 2.

---

## 5. Frozen Step 3 live proof procedure (exactly this)

Step 3 is **not** authorized by this freeze. When Keith later authorizes Step 3, execute the phases in order. Stop on the first stop-condition.

### Phase 0 — Preflight (read-only)

1. Browser: `https://staging.ainow.biz/en` → Continue to Workspace or Sign in → `https://staging.ainow.biz/en/app`.
2. Confirm HTTPS lock. No `localhost` in the address bar.
3. Open DevTools Network. Filter `preview` and `exec`.
4. Confirm chat is **not** used. Do not type a prompt. Do not click Send.
5. Optional read-only health (only if Step 3 later authorizes STAGING inspect): Gateway ready HTTP 200. Do not restart PM2. Do not edit `.env`. Do not touch harness flags.
6. STOP if signed-out, wrong host (apex), or any 5xx on `/en/app`.

### Phase 1 — Local ZIP fixtures (operator workstation, no staging yet)

Create two tiny ZIPs with Windows Explorer “Compress to ZIP” (or equivalent) so entries sit at archive root. No `__MACOSX`, no nested folder, no `node_modules`, no `.git`, no secrets. Each ZIP must be well under 5 MB.

**ZIP A — Vite fixture** filename:

```text
preview-node-staging-01-vite-YYYYMMDD-HHMM.zip
```

Exact members:

`package.json`

```json
{
  "name": "preview-node-staging-01-vite-fixture",
  "private": true,
  "scripts": {
    "dev": "vite"
  },
  "devDependencies": {
    "vite": "5.4.11"
  }
}
```

`index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>PREVIEW-NODE-STAGING-01 Vite fixture</title>
  </head>
  <body>
    <h1>PREVIEW-NODE-STAGING-01 Vite OK</h1>
  </body>
</html>
```

No `vite.config.js`. No lockfile. Vite 5 serves root `index.html`.

**ZIP B — static HTML fixture** filename:

```text
preview-node-staging-01-static-YYYYMMDD-HHMM.zip
```

Exact member (only this file):

`index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>PREVIEW-NODE-STAGING-01 static fixture</title>
  </head>
  <body>
    <h1>PREVIEW-NODE-STAGING-01 Static OK</h1>
  </body>
</html>
```

Record ZIP filenames and creation method before import.

### Phase 2 — Disposable projects

Create **two** projects. Do not reuse prior E2E / smoke / Vite experiments.

For each:

1. `https://staging.ainow.biz/en/app`
2. Click **New Project** (`workspace-projects-new-project-button`)
3. Type the exact name
4. Click **Create Project** (`workspace-projects-create-confirm-button`)
5. Wait until `workspace-project-view` is shown and file tree is empty

Names (use actual Step 3 date/time):

```text
preview-node-staging-01-vite-YYYYMMDD-HHMM
preview-node-staging-01-static-YYYYMMDD-HHMM
```

Record `projectId` and `sessionId` for each (Advanced drawer `workspace-advanced-session-id`).

STOP if create fails, session does not start, or the wrong existing project opens.

### Phase 3 — Import Vite fixture (no Ask/Build)

In the **Vite** project:

1. Left AI panel visible (Expand panel if collapsed).
2. Clock **Open history** (`workspace-history-drawer-toggle`).
3. Scroll to **Project Snapshots**.
4. Amber **Import Project** (`history-archive-import-label` / `history-archive-import-input`).
5. Choose ZIP A only.
6. Confirm file tree shows exactly `package.json` and `index.html` at workspace root (no nested folder).
7. Open `index.html` in the editor and confirm the Vite marker text.

Do **not** use editor Save to create missing files (Save requires an already-selected path). ZIP import is the only create path. Do **not** Ask/Build.

STOP if import rejects, tree is empty, paths are nested (`folder/package.json`), or extra files appear.

### Phase 4 — UI Start Preview (Vite)

1. Close history if it covers the preview panel.
2. Confirm preview panel `workspace-preview-panel` and Start Preview enabled (`previewState` unavailable).
3. Click **Start Preview** (`workspace-preview-start`) **once**.
4. Wait for `POST /api/preview/{viteSessionId}/start` to finish. First run may `npm install` (up to 120s) plus 20s health wait. Do not navigate away. Do not click Start again. Do not click Refresh until start returns.
5. Expected Network: HTTP 2xx JSON with `status: "running"`, `framework: "Vite"`, `port` in `3001`–`3100`.
6. Expected UI: iframe `workspace-preview-iframe` src `/api/preview/{viteSessionId}/proxy?refresh=...` and visible heading **`PREVIEW-NODE-STAGING-01 Vite OK`**.
7. Optional: click **Refresh** (`workspace-preview-refresh`) once; marker must remain.

PASS for this phase: iframe shows the Vite marker without a second Start click and without Ask/Build.

STOP / FAIL if:

- Start stays `loading` > 180s
- HTTP 400 and UI settles `unavailable` / `error`
- iframe blank, `localhost`, or Vite error overlay that never shows the marker
- `framework` is not Vite
- Request body was sent on `/start` (product path is no-body)

### Phase 5 — Running-process inspect (Vite session still open)

Preferred path (no SSH): Advanced drawer → Command Input (`workspace-exec-input`) → submit these commands one at a time via `POST /api/sessions/{viteSessionId}/exec`:

```sh
ps aux | grep -E 'vite|node' | grep -v grep
ls -l /tmp/preview-*.log 2>/dev/null || true
sh -c 'ss -lntp 2>/dev/null || netstat -lntp 2>/dev/null' | grep -E '300[1-9]|31[0-9]{2}' || true
test -d /workspace/node_modules && echo NODE_MODULES=YES || echo NODE_MODULES=NO
test -f /workspace/package.json && echo PACKAGE_JSON=YES
```

Expected while running:

- A node/vite process
- `/tmp/preview-{port}.log` for the allocated port
- A listen on that port inside the container
- `NODE_MODULES=YES` after the first successful start

Fallback SSH (only if exec is unavailable **and** Keith later authorizes SSH in Step 3):

```bash
docker exec sandbox-session-{viteSessionId} sh -c 'ps aux; ls /tmp/preview-*.log 2>/dev/null; ss -lntp || netstat -lntp'
```

Do not `docker compose down`. Do not restart container-manager unless a later stop-condition + Keith authorization says so (default: **no**).

### Phase 6 — Stop preview and orphan / port-leak check

No Stop Preview button exists. In DevTools console on `staging.ainow.biz` (same signed-in origin):

```javascript
fetch(`/api/preview/${viteSessionId}/stop`, { method: 'POST', credentials: 'include' }).then(r => r.status)
```

Then:

1. `GET /api/preview/{viteSessionId}/status` — expect no running preview / not-found / empty status (product: `getPreviewStatus` returns null → 404/empty). Record exact status code/body.
2. Re-run Phase 5 inspect commands.
3. PASS leak check if: no vite/node listen on `3001`–`3100`, captured PID is dead, and a second Start Preview can allocate a port (do **not** start a second Vite preview unless the leak check is inconclusive; prefer inspect-only).
4. FAIL if the old PID is still alive, the old port still listens, or `POST /start` then reports `No available ports`.

If `POST /stop` fails, Stop the session (`workspace-advanced-stop-session`) and inspect that `docker ps` no longer lists `sandbox-session-{viteSessionId}` (SSH fallback only if authorized). Session stop is the hard cleanup; prefer `/stop` first so the leak check is meaningful.

### Phase 7 — Static HTML regression (separate project)

Open the **static** disposable project (do not import ZIP A into it).

1. Import ZIP B only (same History → Import Project path).
2. File tree shows **only** `index.html`. Confirm there is **no** `package.json`.
3. Click **Start Preview** once.
4. Expected: `POST /start` 2xx `framework` static / HTML (not Vite); iframe shows **`PREVIEW-NODE-STAGING-01 Static OK`**.
5. Confirm no `npm install` and no `/tmp/preview-*.log` vite process for this session (static is `direct-read`).

FAIL if static preview is unavailable, mis-detected as Vite/Node, launches a process, or the Vite project’s leftover process blocks ports.

### Phase 8 — Cleanup / restore

1. `POST /api/preview/{staticSessionId}/stop` if a preview is active (harmless 404 if none).
2. Stop both sessions via Advanced **Stop** (`workspace-advanced-stop-session`).
3. Confirm both containers are gone (`docker ps` fallback only if SSH authorized).
4. Leave projects in the list (retained; no delete endpoint).
5. Leave `GLOBAL_EXECUTION_ENABLED=true`. Do not restore-false.
6. Do not `pm2 restart`, do not edit `.env`, do not invite, do not touch EXEC-01C6A artifacts.
7. Local ZIP files may be deleted from the operator workstation; they are not repo files.

---

## 6. Exact evidence to record (Step 3)

Record in the Step 3 evidence section of this document and/or the later Step 4 checkpoint. Do not claim PASS without these fields.

| ID | Evidence |
|---|---|
| E1 | Date/time (UTC+8), operator, host `https://staging.ainow.biz` |
| E2 | Vite project name, projectId, sessionId |
| E3 | Static project name, projectId, sessionId |
| E4 | ZIP A / ZIP B filenames and that Ask/Build was not used |
| E5 | File-tree screenshot or written list after each import |
| E6 | Network: `POST /api/preview/{viteSessionId}/start` method, status, truncated JSON (`status`, `framework`, `port`) |
| E7 | iframe URL and visible Vite marker text (PASS/FAIL) |
| E8 | Running-process inspect stdout (ps / log / listen / NODE_MODULES) |
| E9 | `POST /stop` status; follow-up status GET; post-stop inspect stdout |
| E10 | Orphan/leak verdict PASS/FAIL with fail criterion if FAIL |
| E11 | Static `POST /start` status/framework; visible Static marker |
| E12 | Confirmation static session had no package.json and no vite process |
| E13 | Session Stop for both; containers gone / sessions stopped |
| E14 | Provider used = 0; credit mutation = 0; Ask/Build = 0; PM2 = 0; `.env` = 0 |
| E15 | Gate still ON; EXEC-01C6A not reopened |
| E16 | Any stop-condition hit, with the phase and the cleanup performed |

Screenshots: Vite iframe marker, static iframe marker, Network `/start` for Vite. Do not capture cookies, CSRF tokens, or Authorization headers.

---

## 7. Stop conditions and rollback / cleanup if preview fails

Stop immediately (do not continue later phases) if any of:

| ID | Condition |
|---|---|
| S1 | Wrong host (apex `ainow.biz` / localhost) |
| S2 | Auth failure or app 5xx |
| S3 | Project create or ZIP import fails |
| S4 | Vite `/start` 400 / timeout / `unavailable` after 180s |
| S5 | Vite remains `starting` (locked PREVIEW-NODE-01 forbids this hang) |
| S6 | Iframe never shows the Vite marker |
| S7 | Process still alive or port still listening after `/stop` |
| S8 | Static preview fails or launches a Node/Vite process |
| S9 | Any Ask/Build / Send / provider call happens (procedure abort; do not retry with AI) |
| S10 | Urge to PM2-restart, flip the gate, edit `.env`, or reopen EXEC-01C6A |
| S11 | Port pool exhausted (`No available ports`) |

Rollback / cleanup on failure (do this even on FAIL):

1. `POST /api/preview/{sessionId}/stop` for any session that started.
2. If PID still alive and exec works: `kill -TERM {pid}; sleep 1; kill -KILL {pid}` inside that session only. Do not `kill -9` unrelated host processes.
3. Advanced **Stop** both disposable sessions.
4. If SSH authorized and container remains: `docker rm -f sandbox-session-{sessionId}` only for these two session IDs. Never `docker compose down` / `-v`.
5. Do **not** restart `aisandbox-container-manager` / Gateway / frontend / AI service unless Keith separately authorizes a wedged-service recovery (not part of this freeze).
6. Leave the live gate ON.
7. Retain the disposable projects.
8. Record E16. Do not claim PASS.

This proof must not invalidate locked PREVIEW-NODE-01 / PREVIEW-STATIC-01B / PREVIEW-AUTOSTART-01A / BUILDER-LIVE-GATE-01 evidence. A FAIL is a later product/fix child, not a silent source edit in Step 3.

---

## 8. Exact write set

`writeSetPrecision=EXACT`. Implementation `writePaths=[]`.

**This Step 2 window (governance only):**

1. `docs/PREVIEW-NODE-STAGING-01-STAGE-START.md`
2. `TASKS.md` CURRENT EXECUTION BOARD fields
3. `TASKS_BACKLOG_FULL.md` PREVIEW-NODE-STAGING-01 body
4. `docs/control-plane/lane-saturation-state.json` candidate `writeSetPrecision=EXACT` (occupancy EMPTY; `admissionUncertain=true`)
5. `docs/control-plane/SATURATION_PROOF.json` only as validator output

**Step 3 (when later authorized):** no application source. Evidence append to this document and/or a Step 4 checkpoint. Staging runtime mutation limited to the two disposable projects/sessions/previews above.

**Explicitly excluded forever for this task unless the control plane expands scope:**

- `services/container-manager/src/preview/**`
- frontend, i18n, api-gateway, ai-service
- Docker/compose/package.json/lockfiles
- `PRD.md` / `ARCHITECTURE.md` / `CLAUDE.md` / `AGENTS.md`
- Harness, EXEC-01C6A, PM2 overlays, apex, invites, Stripe

---

## 9. Mutexes / runtime needs for Step 3 (declared, not acquired now)

| Item | Step 2 (this window) | Step 3 (later authorization) |
|---|---|---|
| GOVERNANCE | Held for this doc/board/registry/sidecar write, then released UNOWNED | Held only if evidence docs are written, then released |
| STAGING | Declared, **not acquired**. `stagingAuthorized=false`. `STAGING_EXECUTION_AUTHORIZED=NO` | Required. Acquire only when Step 3 is authorized. Browser + session/preview on Lightsail |
| CONTAINER-MANAGER | Declared, **not acquired** | Remains declared for preview process/port proof. Acquire only if Step 3 is admitted as an implementation lane **and** the control plane requires the mutex for that occupancy. Empty writePaths: no source writes |
| LOCAL-RUNTIME | Undeclared | Still undeclared. No local Docker/Postgres/Redis/Next |
| PROVIDER-LIVE | Undeclared | Still undeclared. ZIP fixture avoids Ask/Build |
| CREDIT | Undeclared | Still undeclared. Same reason |
| FRONTEND / I18N / GATEWAY / AI-SERVICE / PACKAGE / COMPOSE / ENV | UNOWNED | UNOWNED |
| Browser / manual smoke | Not run | **Required evidence** (Keith-involved browser) |
| SSH / AWS / PM2 / Docker inspect | Not run | SSH/docker exec is **fallback only** if workspace exec fails; PM2 mutation forbidden |

`runtimeNeeds=["STAGING"]` remains. Evidence class remains STAGING-RUNTIME.

---

## 10. Admission / saturation

| Item | Freeze |
|---|---|
| status | READY |
| startCondition | READY |
| writeSetPrecision | EXACT |
| admissionUncertain | **true** (Step 3 / admission not authorized; keeps candidate out of S) |
| saturationClass | FORCING |
| productClass | CURRENT |
| futureAuthorization | NONE |
| exclusiveCapacity | false |
| i18n | false |
| sharedContractIds | none |
| mutatesSharedContractIds | none |
| `HARNESS_ENTITLEMENT_PROOF_V1` | remains FROZEN; not consumed; not mutated |
| Occupancy | EMPTY |

Do **not** set `admissionUncertain=false` in this window. A FORCING EXACT READY candidate with empty lanes and `admissionUncertain=false` would enter S and violate GOV-OS-03 idle.

---

## 11. Keith-decision boundary (after this Step 2)

```
KEITH_DECISION_REQUIRED_BEFORE_STAGE_START=NO (Step 2 complete this window)
KEITH_DECISION_REQUIRED_BEFORE_ADMISSION=YES
KEITH_DECISION_REQUIRED_BEFORE_STAGING_OR_BROWSER_PROOF=YES
KEITH_DECISION_REQUIRED_BEFORE_CHECKPOINT_LOCK=NO (Step 4 authorized by Keith and COMPLETE AND LOCKED 2026-09-15)
KEITH_DECISION_REQUIRED_BEFORE_REOPENING_EXEC_01C6A=YES
KEITH_DECISION_REQUIRED_BEFORE_HARNESS_ENABLEMENT=YES
KEITH_DECISION_REQUIRED_BEFORE_STRIPE_OR_TOP_UP=YES
KEITH_DECISION_REQUIRED_BEFORE_APEX_PRODUCTION_ROUTING=YES
KEITH_DECISION_REQUIRED_BEFORE_REGISTERING_NAMED_CHILDREN=YES
KEITH_DECISION_REQUIRED_BEFORE_ASK_BUILD_FIXTURE=YES (not in this freeze; ZIP path is mandatory)
```

---

## 12. Step 2 acceptance

- [x] Disposable project/workspace procedure frozen (who / where / retain / session-stop cleanup)
- [x] Minimal Vite fixture frozen as ZIP import; Ask/Build forbidden; PROVIDER-LIVE / CREDIT remain unauthorized
- [x] UI Start Preview path frozen (no-body POST `/start`; iframe proxy URL; marker text)
- [x] Static `index.html` regression frozen as a second project
- [x] Orphan-process / port-leak inspect and fail criteria frozen
- [x] Cleanup / restore frozen (stop preview, stop sessions, retain projects, gate stays ON)
- [x] Exact evidence list frozen
- [x] Stop conditions and failure rollback frozen
- [x] No test-harness / application-source write set (EXACT empty writePaths)
- [x] Step 3 mutex/runtime needs declared not acquired: STAGING + CONTAINER-MANAGER; no LOCAL-RUNTIME; no PROVIDER-LIVE; no CREDIT
- [x] EXEC-01C6A not reopened / `startCondition=NOT_READY` unchanged
- [x] BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON
- [x] No implementation source, no runtime tools, no Git commit/push this window

---

## 13. Activity ledger (Step 2)

**Step 2 HEAD:** not queried this window (Keith instruction: No Git except `git diff --check`)
**Step 2 activity ledger:** LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=0, application source=0, frontend=0, i18n=0, tests executed=0, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0, named children registered=0. Governance writes: `docs/PREVIEW-NODE-STAGING-01-STAGE-START.md`; `TASKS.md` CURRENT EXECUTION BOARD fields; `TASKS_BACKLOG_FULL.md` PREVIEW-NODE-STAGING-01 body; sidecar candidate `writeSetPrecision=EXACT` (occupancy facts unchanged EMPTY / GOVERNANCE UNOWNED); `SATURATION_PROOF.json` only as validator output.

**Activation effect:** NONE
**Rollback boundary:** Step 2 = discard this document plus this window’s board/registry/sidecar write-set field updates. Ordinary Builder Ask/Build/static Preview path, locked PREVIEW-NODE-01, and the live gate are untouched.

---

## 14. Step 3 evidence (2026-09-15) — BLOCKED (superseded)

**Superseded by:** §16 signed-in retry — verdict **FAIL**. Keep this section as the first-attempt record (`b14e724`). Do not treat §14 as the current Step 3 verdict.

**Verdict:** BLOCKED (not FAIL of locked Vite preview; the product path was not reached)
**Stop:** Phase 0 — signed-out / S2. Later phases not run.

### E1–E16

| ID | Record |
|---|---|
| E1 | 2026-09-15 16:41–17:05 UTC+8. Operator attempted Keith signed-in staging proof. Host `https://staging.ainow.biz` (HTTPS). Not apex `ainow.biz`. Not localhost. Optional health: `GET https://staging.ainow.biz/api/health/ready` → HTTP 200 JSON `status=ready`, `database=connected`. `/en/app` unauthenticated fetch did not 5xx; signed-in browser redirected to `/en/login`. |
| E2 | Vite project **not created**. projectId=NONE. sessionId=NONE. Intended name would have been `preview-node-staging-01-vite-20260915-1641`. |
| E3 | Static project **not created**. projectId=NONE. sessionId=NONE. Intended name would have been `preview-node-staging-01-static-20260915-1641`. |
| E4 | ZIP A `preview-node-staging-01-vite-20260915-1641.zip` (477 bytes; members `package.json`, `index.html` at archive root). ZIP B `preview-node-staging-01-static-20260915-1641.zip` (267 bytes; member `index.html` only). Created on operator workstation via PowerShell `Compress-Archive` (Explorer-equivalent). Path: `%TEMP%\preview-node-staging-01-20260915-1641\`. **Not imported.** Ask/Build = 0. |
| E5 | File tree after import: **N/A** (import not reached). |
| E6 | Vite `POST /api/preview/{sessionId}/start`: **not sent**. |
| E7 | Vite iframe marker: **not observed**. PASS/FAIL for marker = N/A. |
| E8 | Running-process inspect: **not run**. SSH fallback **not used**. |
| E9 | `POST /stop` / follow-up status GET / post-stop inspect: **not run**. |
| E10 | Orphan/leak verdict: **N/A** (no preview started; no port allocated). |
| E11 | Static `POST /start` / Static marker: **not run**. |
| E12 | Static no-package.json / no-vite-process: **not run**. |
| E13 | Session Stop: no disposable sessions created. Chrome debug processes stopped. No `sandbox-session-*` containers created by this proof. |
| E14 | Provider used = 0. Credit mutation = 0. Ask/Build = 0. Send = 0. PM2 = 0. `.env` = 0. Docker compose / Postgres / Redis / AWS = 0. One platform-auth Google button click on `/en/login` returned `oauth_failed`; not retried; not an AI provider call. |
| E15 | Builder live gate left ON (not inspected via SSH/PM2 this window; not flipped). EXEC-01C6A not reopened; `startCondition=NOT_READY` unchanged. |
| E16 | **S2 / Phase 0 signed-out.** This window has no Cursor browser MCP with an already-signed-in Keith session. Chrome 152 refuses `--remote-debugging-port` on the default User Data directory, so a CDP-attached window cannot present the live Profile 5 workspace session. A Continue-with-Google click on `/en/login` returned `?error=oauth_failed`. Stopped immediately. No disposable projects. No ZIP import. No Start Preview. No SSH. Cleanup: debug Chrome stopped; User Data junction removed; Profile 5 cookie DB restored from the pre-debug copy so `aisandbox_session` remains present in that profile file (values not recorded). Local ZIPs retained in `%TEMP%` for a later authorized retry. |

Screenshots: none captured of Vite/static iframe markers (not reached). Login page observed at `https://staging.ainow.biz/en/login` (and `?error=oauth_failed` after the single Google click). Cookies / CSRF / Authorization headers not recorded.

### Runtime commands used

- Local ZIP creation (`Compress-Archive`) under `%TEMP%\preview-node-staging-01-20260915-1641\`
- Read-only `GET https://staging.ainow.biz/api/health/ready` and `/en` / `/en/app`
- Chrome CDP attach attempts (default User Data blocked; custom user-data-dir / junction used only for signed-in probe)
- One UI click: Continue with Google → `oauth_failed`
- **SSH fallback: not used**

### Cleanup confirmation

- No staging projects or sandbox sessions created
- No preview processes or 3001–3100 ports allocated by this proof
- Debug Chrome stopped (`chrome.exe` count 0 after cleanup)
- Junction `C:\Users\knlee\AppData\Local\Temp\chrome-ud-real` removed
- Profile 5 cookie DB restored from the pre-debug copy
- Builder gate not flipped
- Local ZIP fixtures remain in TEMP (not repo files)

---

## 15. Activity ledger (Step 3)

**Step 3 HEAD:** not mutated (Keith instruction: no Git commit/push; `git diff --check` only)
**Step 3 activity ledger (current / §16 retry):** LIVE/browser=1 (signed-in `/en/app`), SSH=0, AWS=0, provider=0, credits=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=0, application source=0, frontend=0, i18n=0, tests executed=0, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0, named children registered=0, Ask/Build=0, Send=0. Staging project/session/preview mutation=1 Vite disposable project + one session + one Start Preview + session Stop. Static project=0 (S4/S5/S6 stop-condition). Governance writes: this evidence section; `TASKS.md` CURRENT EXECUTION BOARD fields; `TASKS_BACKLOG_FULL.md` PREVIEW-NODE-STAGING-01 body; `SATURATION_PROOF.json` only as validator output. Sidecar occupancy unchanged EMPTY / GOVERNANCE UNOWNED / `admissionUncertain=true` / `stagingAuthorized=false`.

**Activation effect:** NONE
**Rollback boundary:** Step 3 FAIL = discard §16 plus this window’s board/registry field updates. No application source to revert. Vite session already Stopped; project retained. Locked PREVIEW-NODE-01 and the live gate are untouched.
**Follow-on:** a later product/fix child may address `npm install` skip / `sh: vite: not found` while status remains `starting`. Do not silently edit preview source in this task. Do not start Step 4. Do not reopen EXEC-01C6A. Do not admit a lane unless the control plane separately admits.

---

## 16. Step 3 retry evidence (2026-09-15) — FAIL (supersedes §14)

**Verdict:** **FAIL**
**Supersedes:** §14 BLOCKED / committed `b14e724` (Phase 0 signed-out / S2). This retry used Keith’s already-signed-in browser session on `https://staging.ainow.biz/en/app` with no `/en/login` redirect.
**Stop:** S4 (Vite `/start` HTTP 400 + still not `running` after 180s) + S5 (status remained `starting`) + S6 (iframe never showed the Vite marker). Phase 7 static regression **not run** (stop immediately; do not continue later phases).
**Phase 0:** PASS (signed-in). HTTPS `https://staging.ainow.biz/en/app`. User visible in account menu (`knlee807@gmail.com`). No Google login click this retry.

### E1–E16

| ID | Record |
|---|---|
| E1 | 2026-09-15 17:23–17:51 UTC+8. Operator: Keith signed-in staging session (controllable Chrome already on `/en/app`; no `/en/login` redirect). Host `https://staging.ainow.biz` (HTTPS). Not apex `ainow.biz`. Not localhost. |
| E2 | Vite project name `preview-node-staging-01-vite-20260915-1723`. projectId=`df790111-fa99-4f0a-a990-4fbe6e4dfc23`. sessionId=`12bf5d2a-e91d-4f0c-a9be-2ce2838ea8fc`. Empty-workspace auto-start `POST /start` 400 before import (expected). |
| E3 | Static project **not created** (S4/S5/S6 stop-condition). projectId=NONE. sessionId=NONE. ZIP B was prepared and not imported. |
| E4 | ZIP A `preview-node-staging-01-vite-20260915-1723.zip` (477 bytes; members `package.json`, `index.html` at archive root). ZIP B `preview-node-staging-01-static-20260915-1723.zip` (267 bytes; member `index.html` only). Path: `%TEMP%\preview-node-staging-01-retry-20260915-1723\`. Ask/Build = 0. Send = 0. |
| E5 | After Vite ZIP import, Code Files tree: `workspace-file-node-index.html`, `workspace-file-node-package.json` at workspace root (no nested folder). Container `ls /workspace`: `index.html` (208 bytes) + `package.json` (158 bytes) only. |
| E6 | UI Start Preview clicked **once** (`workspace-preview-start`; no request body). Network: `POST /api/preview/12bf5d2a-e91d-4f0c-a9be-2ce2838ea8fc/start` **HTTP 400** body empty. Follow-up `GET /status` HTTP 200 `{"running":true,"port":3003,"status":"starting","framework":"Vite","uptime":0,"previewUrl":"/api/preview/12bf5d2a-e91d-4f0c-a9be-2ce2838ea8fc/proxy"}`. Same `starting` / port 3003 at uptime 263s and 565s. Did **not** return 2xx `status:"running"`. |
| E7 | iframe `src` `https://staging.ainow.biz/api/preview/12bf5d2a-e91d-4f0c-a9be-2ce2838ea8fc/proxy?refresh=1789465123778`. Visible iframe body: `{"error":"Proxy error","message":"Failed to connect to preview server"}`. Vite marker **`PREVIEW-NODE-STAGING-01 Vite OK` not observed**. Marker FAIL. |
| E8 | Advanced Command Input was in the compact-sidebar footer (not visible until expand). Inspect used the same product `POST /api/sessions/{sessionId}/exec` API as Command Input (no SSH). While status=`starting` / port 3003: `ps aux \| grep -E 'vite\|node' \| grep -v grep` → exit 1 empty stdout (no vite/node). `ls -l /tmp/preview-*.log` → `/tmp/preview-3003.log` 35 bytes. Listen `3001`–`3100`: `NO_LISTEN_3001_3100`. `NODE_MODULES=NO`. `PACKAGE_JSON=YES`. Log: `> dev` / `> vite` / `sh: vite: not found`. |
| E9 | `POST /api/preview/{sessionId}/stop` HTTP **400** empty body. Follow-up `GET /status` still HTTP 200 `starting` / Vite / port 3003 / uptime 565. Post-stop inspect: no vite/node; `NO_LISTEN_3001_3100`. |
| E10 | Orphan/leak: **no** vite/node process and **no** listen on `3001`–`3100` while mapped `starting` (launch died immediately). `POST /stop` did **not** clear `starting` (S4). No second Start Preview. After session Stop, preview map is not re-inspected inside a live container. Leak of a listening port: not observed. Fail criterion for leftover `starting` map until session Stop: recorded. |
| E11 | Static `POST /start` / Static marker: **not run** (stop-condition). |
| E12 | Static no-package.json / no-vite-process: **not run**. |
| E13 | Advanced **Stop** (`workspace-advanced-stop-session`) with confirm override → `POST /api/sessions/12bf5d2a-e91d-4f0c-a9be-2ce2838ea8fc/stop` HTTP 200 `{"message":"Session stopped successfully"}`. Advanced sessionStatus=`stopped`. Repeat `POST /stop` HTTP 200 same message. Post-stop exec `echo still-alive` → HTTP 500 `Internal server error` (not a live exec 200). SSH/`docker ps` **not used**. Static session: none. Project retained in the list (no delete endpoint). |
| E14 | Provider used = 0. Credit mutation = 0. Ask/Build = 0. Send = 0. PM2 = 0. `.env` = 0. Docker compose / Postgres / Redis / AWS = 0. No temporary PM2 overlay. |
| E15 | Builder live gate left ON (not inspected via SSH/PM2; not flipped). EXEC-01C6A not reopened; `startCondition=NOT_READY` unchanged. |
| E16 | **S4 / S5 / S6 after signed-in Phase 0–4.** Vite detected (`framework:"Vite"`, port 3003) but `npm install` did not create `/workspace/node_modules`; `npm run dev` ran `vite` and logged `sh: vite: not found`; status remained `starting` past 180s; iframe proxy never connected; `POST /start` and `POST /stop` both HTTP 400 empty. Cleanup: session Stop 200; project retained; gate ON. Static proof skipped by freeze stop-condition. |

### Runtime / browser / SSH commands used

- Local ZIP A/B under `%TEMP%\preview-node-staging-01-retry-20260915-1723\` (not repo files)
- Keith’s already-signed-in Chrome on `https://staging.ainow.biz/en/app` (HWND AI Sandbox tab). No Google OAuth click.
- Console-driven UI: History Import Project (native Open dialog → ZIP A); `workspace-tab-codeFiles`; `workspace-tab-preview`; `workspace-preview-start` once
- `POST /api/preview/{sessionId}/start` (UI, no body)
- `GET /api/preview/{sessionId}/status`
- `POST /api/sessions/{sessionId}/exec` commands (frozen Phase 5 set plus log `cat`): `ps aux | grep -E 'vite|node' | grep -v grep`; `ls -l /tmp/preview-*.log`; `ss`/`netstat` listen grep `3001`–`3100`; `test -d /workspace/node_modules`; `test -f /workspace/package.json`; `ls -la /workspace`; `cat /tmp/preview-3003.log`
- `POST /api/preview/{sessionId}/stop`
- Advanced drawer expand + `workspace-advanced-stop-session` (product `POST /api/sessions/{sessionId}/stop`)
- **SSH fallback: not used**

### Cleanup confirmation

- Vite session Stop HTTP 200; Advanced sessionStatus=`stopped`
- Static session: none created
- Disposable Vite project retained (`preview-node-staging-01-vite-20260915-1723`)
- No `pm2 restart`; no `.env` edit; gate left ON
- Local ZIP fixtures remain in TEMP (not repo files)
- No application source changes
- No Git commit/push

**Root-cause note (evidence only; not a source fix):** first Vite start allocated port 3003 and wrote `/tmp/preview-3003.log` with `sh: vite: not found` because `NODE_MODULES=NO`. Locked PREVIEW-NODE-01 expected foreground `npm install` when `[ -d /workspace/node_modules ]` is false. Status remained `starting` (S5). A later product/fix child may address this; Step 3 must not edit `services/container-manager/src/preview/**`.

---

## 17. APPLY-01 Phase D proof retry (2026-09-15) — PASS

**Context:** PREVIEW-NODE-STAGING-APPLY-01 Step 3 retry applied locked container-manager code (`LIVE_LOCKED`) then reran this frozen §5 procedure. Historical §16 FAIL stands as the pre-apply attempt. This §17 PASS is the lock evidence. PREVIEW-NODE-STAGING-01 is COMPLETE AND LOCKED in the APPLY-01 Step 4 window (decision: APPLY-01 §18 / this document §18).

**Phase 0:** PASS. Keith signed-in Chrome (`knlee801@gmail.com`) already on `https://staging.ainow.biz/en/app`. HTTPS. Not apex, not localhost. No Google login click. Chat unused (Ask/Build/Send = 0).
**Stop:** none for S4/S5/S6. Vite marker visible. Static marker visible.

### E1–E16

| ID | Record |
|---|---|
| **E1** | 2026-09-15 22:11–22:36 UTC+8. Operator: Keith signed-in Chrome on `https://staging.ainow.biz/en/app`. HTTPS. |
| **E2** | Vite `preview-node-staging-01-vite-20260915-2211`. projectId `803d2bc2-a4f1-47f3-9562-38ab9721bf4d`. sessionId `08a1491f-bb30-490e-8c4b-bb59fda0ac78`. |
| **E3** | Static `preview-node-staging-01-static-20260915-2211`. projectId `4a511002-29b4-4459-a468-5c8af0d98116`. sessionId `1927d645-c7ce-4fdf-b76b-9e4f63b01adb`. |
| **E4** | ZIP A `preview-node-staging-01-vite-20260915-2211.zip` (475 B; members `index.html`, `package.json` at archive root). ZIP B `preview-node-staging-01-static-20260915-2211.zip` (266 B; member `index.html` only). Path: `%TEMP%\preview-node-staging-01-apply01-retry-20260915-2211\`. Created via .NET `ZipFile.CreateFromDirectory`. Ask/Build = 0. Send = 0. |
| **E5** | Vite tree after import: `index.html`, `package.json` only. Toast `Workspace archive imported.` Static tree after import: `index.html` only (no `package.json`). |
| **E6** | UI Start Preview clicked **once** (mouse on `workspace-preview-start`; an earlier InvokePattern attempt did not change UI and left Network `POST /start` 400s). Successful path: UI `Preview unavailable` → `Preview ready` in ~8s. Exec showed Vite on port **3001** (`node /workspace/node_modules/.bin/vite --host 0.0.0.0 --port 3001`). Truncated start JSON not captured (no CDP Network on the signed-in profile). |
| **E7** | iframe document title `PREVIEW-NODE-STAGING-01 Vite fixture`. Visible heading **`PREVIEW-NODE-STAGING-01 Vite OK`**. PASS. |
| **E8** | `ps`: pid 182 `node .../vite --host 0.0.0.0 --port 3001`; pid 193 esbuild service. `/tmp/preview-3001.log` 156 bytes. `ss`: `0.0.0.0:3001 LISTEN 182/node`. `NODE_MODULES=YES`. `PACKAGE_JSON=YES`. |
| **E9** | DevTools `POST /api/preview/08a1491f-bb30-490e-8c4b-bb59fda0ac78/stop` HTTP **400** (`net::ERR_ABORTED`). GET `/status` JSON not observed (Promise pending in console a11y). |
| **E10** | After failed `/stop`, pid 182 still listened on 3001 (leak until session Stop). Freeze hard-cleanup: Advanced **Stop** + OK. Runtime status **`stopped`**. No second Start Preview. PASS after session Stop (container gone; leftover listen not re-inspected inside a live container). |
| **E11** | Static Start Preview once. UI `Preview ready`. Document title `PREVIEW-NODE-STAGING-01 static fixture`. Visible heading **`PREVIEW-NODE-STAGING-01 Static OK`**. PASS. |
| **E12** | Static exec: no vite/node lines; `NO_PREVIEW_LOG`; `PACKAGE_JSON=NO`; `NODE_MODULES=NO`. |
| **E13** | Vite session Stopped (`stopped`). Static session Stopped (`stopped`). Projects retained. |
| **E14** | Provider = 0. Credit = 0. Ask/Build = 0. Phase D PM2 restart = 0 (CM restart was APPLY-01 Phase B3 only). `.env` = 0. |
| **E15** | Gate LEFT ON. EXEC-01C6A not reopened. |
| **E16** | No S4/S5/S6. `POST /stop` 400 recorded; session Stop used as frozen hard cleanup. |

### Runtime / browser commands used

- Local ZIP A/B under `%TEMP%\preview-node-staging-01-apply01-retry-20260915-2211\` (not repo files)
- Windows UI Automation against Keith’s already-signed-in Chrome HWND `AI Sandbox - Google Chrome` (no Profile 5 kill; isolated CDP Chrome was signed-out and stopped)
- New Project / Create Project; History Import Project (native Open dialog → ZIP A then ZIP B)
- `workspace-preview-start` once per project (mouse click)
- Advanced Command Input exec (frozen Phase 5 set)
- DevTools console `fetch` for `/stop` (400) and projectId lookup (`GET /api/projects` name filter only)
- Advanced session Stop + confirm OK for both sessions

### Cleanup confirmation

- Both sessions `stopped`. Projects retained (`preview-node-staging-01-vite-20260915-2211`, `preview-node-staging-01-static-20260915-2211`).
- No `.env` edit. Gate ON. No Git commit/push. No application source changes.
- Isolated temp-user-data-dir Chrome stopped. Keith’s signed-in Chrome left running.

---

## 18. Dual-lock decision (Step 4 window)

**Question:** May PREVIEW-NODE-STAGING-01 lock in the same Step 4 window as PREVIEW-NODE-STAGING-APPLY-01?

**Verdict:** **YES.** Authority: `docs/PREVIEW-NODE-STAGING-APPLY-01-STAGE-START.md` §18. Same grounds: no lane occupancy; Keith authorized checkpoint lock; freeze / proof / lock are separate windows; §17 PASS of frozen §5 is this task’s registered purpose; historical §16 FAIL is preserved; GOV-OS-03 idle remains valid after `status=LOCKED` / `admissionUncertain=false`.

---

## 19. Step 4 acceptance (COMPLETE AND LOCKED — 2026-09-15)

- [x] Independent verification of frozen §5 proof PASS after `LIVE_LOCKED` apply (`docs/PREVIEW-NODE-STAGING-01-STAGE-START.md` §17)
- [x] Vite marker `PREVIEW-NODE-STAGING-01 Vite OK` observed
- [x] `NODE_MODULES=YES`; Vite running `--host 0.0.0.0 --port 3001`
- [x] Static marker `PREVIEW-NODE-STAGING-01 Static OK`; static preview did not start Vite/node
- [x] Cleanup complete (both sessions `stopped`; projects retained; gate ON)
- [x] Historical §16 FAIL preserved (pre-apply `LIVE_OLD`)
- [x] Dual-lock with PREVIEW-NODE-STAGING-APPLY-01 authorized and recorded (§18)
- [x] no application source; no `.env`; no Ask/Build; no provider/credit
- [x] EXEC-01C6A `startCondition=NOT_READY` UNCHANGED / not reopened
- [x] BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON
- [x] sidecar `status=LOCKED` / `admissionUncertain=false`; `lockedTaskIds` includes PREVIEW-NODE-STAGING-01
- [x] Occupancy EMPTY; no lane admitted; no runtime mutex acquired this lock window; no follow-on registered
- [x] Validator PASS this lock window
- [x] `git diff --check` PASS
- [x] No Git commit/push by the worker
- [x] No runtime/SSH/AWS/PM2/Docker/Postgres/Redis this window

---

## 20. Authorization state (end of Step 4 lock)

```
IMPLEMENTATION_AUTHORIZED=NO (proof already COMPLETE; this window is lock-only)
ADMISSION_AUTHORIZED=NO
STAGING_AUTHORIZED=NO
STAGING_EXECUTION_AUTHORIZED=NO
LOCAL_RUNTIME_AUTHORIZED=NO
PROVIDER_LIVE_AUTHORIZED=NO
CREDIT_AUTHORIZED=NO
TESTS_EXECUTED=NO (this lock window)
APPLICATION_SOURCE_CHANGED=NO
LANE_1=EMPTY
LANE_2=EMPTY
CONTAINER_MANAGER_ACQUIRED=NO
STAGING_ACQUIRED=NO
STEP4_AUTHORIZED=YES
STEP4_COMPLETE=YES
LOCKED=YES
FOLLOW_ON_REGISTERED=NO
EXEC_01C6A_REOPENED=NO
```

Previous (end of APPLY-01 Phase D evidence append): STEP4_AUTHORIZED=NO; LOCKED=NO.

---

## 21. Activity ledger (Step 4) and lock evidence

**Step 4 lock ledger (this window):** LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=0, application source=0, frontend=0, i18n=0, tests executed=0, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0, follow-on registration=0, Ask/Build=0. Governance writes: this stage-start Step 4 checkpoint; `docs/PREVIEW-NODE-STAGING-APPLY-01-STAGE-START.md` Step 4 checkpoint; `TASKS.md` CURRENT EXECUTION BOARD fields; `TASKS_BACKLOG_FULL.md` STAGING-01 and APPLY-01 bodies; sidecar candidates `status=LOCKED` / `admissionUncertain=false` + `lockedTaskIds`; `SATURATION_PROOF.json` only as validator output. Occupancy facts unchanged (EMPTY / GOVERNANCE UNOWNED).

**Invitation invariant:** PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.

**Lane 3 invariant:** Lane 3 remains DISABLED.

**Activation effect:** NONE
**Rollback boundary:** this lock = discard this window’s board/registry/stage-start/sidecar lock field updates. Staging `LIVE_LOCKED` dist, locked PREVIEW-NODE-01, HYGIENE-01, APPLY-01 Step 3 evidence, and the live gate are untouched.

### Verdict

**PREVIEW-NODE-STAGING-01 is COMPLETE AND LOCKED.**

**Proof evidence:** `docs/PREVIEW-NODE-STAGING-01-STAGE-START.md` §17 (APPLY-01 Phase D; ZIP stamp `20260915-2211`). Historical §16 FAIL preserved.

**Sibling:** PREVIEW-NODE-STAGING-APPLY-01 COMPLETE AND LOCKED this same window. Checkpoint: `docs/PREVIEW-NODE-STAGING-APPLY-01-STAGE-START.md`.

**Invariants:** EXEC-01C6A `startCondition=NOT_READY` UNCHANGED / not reopened. BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON. PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED. Lane 3 remains DISABLED. No follow-on task registered. No admitted next product gate / selection pending.
