# PREVIEW-NODE-STAGING-01 — Stage-start / live proof procedure freeze

**Task ID:** PREVIEW-NODE-STAGING-01
**Title:** Staging browser proof for Vite preview
**Date:** 2026-09-15
**Nature:** IMPLEMENTATION / validation-ops — high-risk staging/browser proof of locked Vite preview (container process launch, ports, process-proxy, sandbox npm/dev-server)
**Lifecycle:** 4-step IMPLEMENTATION
**Step:** 2 COMPLETE — stage-start / exact live proof procedure freeze
**Step status:** Step 1 COMPLETE — 2026-09-14 (registration / control-plane only; committed `f82d747`); Step 2 COMPLETE — 2026-09-15; Step 3 NOT AUTHORIZED; Step 4 NOT AUTHORIZED
**This document:** Authoritative Step 2 freeze of the exact Step 3 live proof procedure for Vite preview on staging. It does **not** authorize admission, Step 3 execution, staging/browser/SSH/runtime mutation, Harness, orchestration, Stripe, apex cutover, invitations, EXEC-01C6A reopen, application source, or Git.

**Parent:** PREVIEW-NODE-01 COMPLETE AND LOCKED — Checkpoint: `docs/PREVIEW-NODE-01-STAGE-START.md` — implementation HEAD `443d7eeecba7d8ef403fc77a3eee37d6d62f418a` (`feat: support vite preview`) — lock `26a1333` (`docs: lock vite preview slice`)
**Occupancy hash (end-state):** `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d` (Lane 1 EMPTY, Lane 2 EMPTY, GOVERNANCE UNOWNED)

```
STEP1_COMPLETE=YES
STEP2_COMPLETE=YES
STEP3_AUTHORIZED=NO
STEP3_COMPLETE=NO
STEP4_AUTHORIZED=NO
STEP4_COMPLETE=NO
LOCKED=NO
IMPLEMENTATION_STARTED=NO
ADMITTED=NO
WRITE_SET_PRECISION=EXACT
CANDIDATE_STATUS=READY
ADMISSION_UNCERTAIN=true
TEST_ADMISSIBLE=ADMISSION_UNCERTAIN
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

Keith authorized Step 2 only. Occupancy remains EMPTY. Sidecar candidate is `status=READY` / `writeSetPrecision=EXACT` / `admissionUncertain=true` so the candidate is **not** in S (`Test-Admissible` = ADMISSION_UNCERTAIN). Do **not** admit Lane 1 or Lane 2. Do **not** start Step 3. Do **not** reopen AGENT-PLATFORM-EXEC-01C6A. BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON.

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
KEITH_DECISION_REQUIRED_BEFORE_CHECKPOINT_LOCK=YES
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
