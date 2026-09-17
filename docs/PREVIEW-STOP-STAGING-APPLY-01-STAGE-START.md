# PREVIEW-STOP-STAGING-APPLY-01 — Stage-start / live version check + staging apply/proof freeze

**Task ID:** PREVIEW-STOP-STAGING-APPLY-01
**Title:** Apply and prove locked preview stop/restart reliability on staging
**Date:** 2026-09-17
**Nature:** IMPLEMENTATION / staging-ops — high-risk live version check plus possible staging apply of already-locked container-manager stop/restart, then live stop/restart proof
**Lifecycle:** 4-step IMPLEMENTATION
**Step:** 3 COMPLETE — live version check + apply + Vite/static proof
**Step status:** Step 1 COMPLETE — 2026-09-17 (registration / control-plane only) — Step 2 COMPLETE — 2026-09-17 — Step 3 COMPLETE — 2026-09-17 (LIVE_OLD apply to LIVE_LOCKED; Vite start/restart/process-port-map PASS; public POST `/stop` HTTP 200 FAIL; CM `:4002` stop 200 JSON; static no-process PASS; no source fix) — Step 4 NOT AUTHORIZED
**This document:** Authoritative Step 2 freeze plus Step 3 evidence (§18). Step 4 is **not** authorized. Do **not** lock. Do **not** invent a source fix. Do **not** reopen EXEC-01C6A.

**Parent:** PREVIEW-STOP-01 COMPLETE AND LOCKED — Checkpoint: `docs/PREVIEW-STOP-01-STAGE-START.md` — implementation HEAD `79510ca200c9bfda999cb6140c6596d65ccec02f` (`fix: make preview stop reliable`) — LOCAL-TESTS only
**Observed gap (must not rewrite):** `docs/PREVIEW-NODE-STAGING-01-STAGE-START.md` §17 E9/E10/E16 — operator `POST /api/preview/{viteSessionId}/stop` HTTP 400 (`net::ERR_ABORTED`; session `08a1491f-bb30-490e-8c4b-bb59fda0ac78`); Vite pid 182 remained on port 3001 until Advanced session Stop. Static preview had no Vite/node process. Historical §16 FAIL (pre-apply Vite start) is sequencing context, not this child's proof.
**Hygiene precedent:** PREVIEW-NODE-STAGING-HYGIENE-01 COMPLETE AND LOCKED — Checkpoint: `docs/PREVIEW-NODE-STAGING-HYGIENE-01-CHECKPOINT.md`. PREVIEW-NODE-STAGING-APPLY-01 Step 3 historically stopped `S_DIRTY_TREE`. Later Step 3 must STOP on a dirty remote worktree.
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
APPLICATION_SOURCE=NONE
PREVIEW_SERVICE_TS_EDIT=FORBIDDEN_THIS_TASK
PREVIEW_CONTROLLER_TS_EDIT=FORBIDDEN_THIS_TASK
TEST_HARNESS_EXPANSION=NONE
ASK_BUILD=NO
PROVIDER_LIVE=NO
CREDIT=NO
LOCAL_RUNTIME=NO
MUTEXES_DECLARED=CONTAINER-MANAGER,STAGING
MUTEXES_ACQUIRED=NO (end-state; STAGING + CONTAINER-MANAGER acquired for Step 3 then released)
STAGING_AUTHORIZED=NO (end-state)
STAGING_EXECUTION_AUTHORIZED=NO (end-state)
SSH_USED=YES
AWS_USED=NO
PM2_RESTART=YES (aisandbox-container-manager only; no --update-env)
APPLY=YES
GIT_PULL=YES (staging /opt/aisandbox ff-only; no local Git)
CM_BUILD=YES
LIVE_CLASS_PHASE_A=LIVE_OLD
LIVE_CLASS_PHASE_C=LIVE_LOCKED
PUBLIC_STOP_HTTP_200=FAIL
CM_STOP_HTTP_200=PASS
EVIDENCE_CLASS=STAGING-RUNTIME
HOST=https://staging.ainow.biz
LIGHTSAIL=aisandbox-staging
STAGING_PATH=/opt/aisandbox
LOCKED_IMPLEMENTATION=79510ca200c9bfda999cb6140c6596d65ccec02f
MINIMUM_APPLY_UNIT=aisandbox-container-manager
PUBLIC_STOP_VERB=POST
DELETE_STOP_ALIAS=YES
STOP_IDEMPOTENT=YES
PROCESS_TREE_AND_PORT_KILL=YES
LIVE_LOCKED_SKIPS_APPLY=YES
LIVE_LOCKED_STILL_PROVES=YES
APEX_AINOW_BIZ=OUT_OF_SCOPE
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
BROWSER=YES
GIT_COMMIT=NO
```

Keith authorized this Step 3 apply/proof. Occupancy remains EMPTY. Sidecar candidate is unchanged this window (`status=READY` / `writeSetPrecision=EXACT` / `writePaths=[]` / `admissionUncertain=true`; not in S). Do **not** admit Lane 1 or Lane 2. Do **not** start Step 4. Do **not** register follow-on tasks. Do **not** reopen AGENT-PLATFORM-EXEC-01C6A. BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON. Phase A classified `LIVE_OLD` on a clean tree; Phase B/C applied locked container-manager code to `LIVE_LOCKED`; Phase D proved Vite start/restart and process/port/map clear. Public origin `POST /api/preview/{sessionId}/stop` returned HTTP 400 `text/html` empty body; CM `:4002` returned HTTP 200 JSON. No application source fix was invented.

---

## 1. Inherited product / architecture facts (must not reopen)

- `PRD.md` CURRENT includes integrated workspace preview, HTTP/WebSocket (HMR/dev servers), and predictable lifecycle behavior for sessions, workspaces, and previews.
- `ARCHITECTURE.md` §6 records preview strategy resolution, Gateway preview proxy to container-manager, and `node-dev-server` as CURRENT HOW.
- Locked PREVIEW-STOP-01 productized already-CURRENT stop (`PreviewService.stopPreview`; public POST `/api/preview/:sessionId/stop` with DELETE alias) with LOCAL-TESTS only. This child applies and live-proves that locked behavior. It does not rewrite stop semantics.
- Locked PREVIEW-NODE-01 / PREVIEW-NODE-STAGING-01 / PREVIEW-NODE-STAGING-APPLY-01 proved Vite start. They are sequencing context. This child must not regress Vite start or static Preview.
- Locked PREVIEW-STRATEGY-01A / PREVIEW-STATIC-01B / PREVIEW-AUTOSTART-01A closed the static-html family. Static stop must remain a safe no-op (no Vite/node process).
- BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON.
- Working single-shot Builder Ask/Build remains the product to complete, not to replace. This proof must not use Ask/Build.
- Product-visible Harness / orchestration / Stripe / apex production routing remain FUTURE/gated.
- EXEC-01C6A remains `startCondition=NOT_READY` / not reopened.
- There is **no** UI Stop Preview button. Public stop remains operator `POST /api/preview/:sessionId/stop`.

This freeze does not rewrite `PRD.md` or `ARCHITECTURE.md`.

---

## 2. Source-grounded locked vs pre-79510ca fingerprints

Classification is of the **running** container-manager dist/script, not of git HEAD alone. Fingerprints are the locked PREVIEW-STOP-01 behavior at `79510ca200c9bfda999cb6140c6596d65ccec02f`.

### 2.1 Locked PREVIEW-STOP-01 behavior (79510ca-equivalent)

From `docs/PREVIEW-STOP-01-STAGE-START.md` §4 and the locked three-file write set:

| Surface | Locked fingerprint |
|---|---|
| Public stop verb | Controller `PreviewController.stopPreview` is `@Post(':sessionId/stop')` HTTP 200 wrapping `{ success: true, ...serviceResult }` |
| DELETE alias | `@Delete(':sessionId/stop')` on `stopPreviewByDelete`, which delegates to `stopPreview` |
| Idempotent empty map | Session usable + no `activePreviews` entry → HTTP 200 `{ message: 'No active preview for this session' }`. **Do not throw 404 / `NotFoundException`.** |
| Vite process-tree / process-group kill | `kill -TERM ${pid}` then `kill -TERM -${pid}`; `sleep 1`; `kill -KILL ${pid}` and `kill -KILL -${pid}` (`|| true`, bounded exec) |
| Port-scoped leftover cleanup | `fuser -k ${port}/tcp` and `/proc/net/tcp` inode walk for **that allocated preview.port only** (`3001`–`3100` pool). Must not `docker kill` / session Stop |
| Always clear | After kill attempt (including kill/exec throw): `releasePort(preview.port)` and `activePreviews.delete(sessionId)` |
| Static stop | Framework `Static HTML`: skip pid kill; still release port and delete map; HTTP 200 `{ message: 'Preview stopped successfully' }` |
| Restart after stop | Map empty → a later Start Preview allocates and launches again (no early-return of the previous preview) |

Do **not** require a UI Stop Preview button. Gateway remains method-transparent `@All("*")`. Do **not** remap POST→DELETE in Gateway.

### 2.2 Pre-79510ca / STAGING-01 observed gap (must not be treated as current proof)

From `docs/PREVIEW-NODE-STAGING-01-STAGE-START.md` §17 (PASS Vite start after APPLY-01; stop still failed):

- Operator DevTools `POST /api/preview/08a1491f-bb30-490e-8c4b-bb59fda0ac78/stop` HTTP **400** (`net::ERR_ABORTED`).
- Vite pid 182 still listened on port 3001 until Advanced session Stop.
- Static preview had no Vite/node process.
- Earlier pre-apply FAIL (§16): `POST /stop` HTTP 400 empty body; `GET /status` remained `starting`; stop did **not** clear the in-memory map.

Pre-79510ca source facts (PREVIEW-STOP-01 stage-start §2): container-manager had `@Delete` only (no POST stop handler); empty-map stop threw `NotFoundException`; kill was pid-only; a 400-without-clear path existed.

### 2.3 Classification of the live running artifact

| Class | Meaning | Step 3 action |
|---|---|---|
| `LIVE_OLD` | Running dist/script missing one or more locked fingerprints in §2.1 (especially POST stop route, process-group kill, port-scoped cleanup, or idempotent empty-map return) | Apply allowed after remaining stop-conditions pass, then prove |
| `LIVE_LOCKED` | Running dist/script contains **all** §2.1 fingerprints in §5 Phase A | **Skip apply.** Do not git update. Do not build. Do not PM2 restart. **Still proceed to proof** (Phase D). This task exists to prove stop/restart, not only to apply |
| `LIVE_UNKNOWN` | Cannot identify process, script path, cwd, or readable dist/source | **STOP.** Do not apply. Do not prove |

Source vs dist nuance (does not override the running-artifact class):

- Source locked + running dist old → `LIVE_OLD` (rebuild + restart only; no git update)
- Source old + running dist old → `LIVE_OLD` (git update of clean tree to a revision containing `79510ca` or later, then container-manager build + restart)
- Source locked + running dist locked → `LIVE_LOCKED`
- Dist/path unreadable → `LIVE_UNKNOWN`

---

## 3. Answers to the mandatory Step 2 questions

1. **Read-only live version check:** SSH to `aisandbox-staging` `/opt/aisandbox` as in §5 Phase A. Require clean remote `git status`. Record HEAD. Identify PM2 `aisandbox-container-manager` path/cwd/script. Grep running dist then source for §2.1 fingerprints. Classify `LIVE_OLD` / `LIVE_LOCKED` / `LIVE_UNKNOWN`. No write, no restart, no `.env` edit in this phase.
2. **Apply if old:** Only if `LIVE_OLD` and remaining stop-conditions pass. Existing pattern only: optional clean-tree git update of `/opt/aisandbox` to a revision that contains `79510ca` or later, then `npm run build` in `services/container-manager` only, then `pm2 restart aisandbox-container-manager` only (no `--update-env`). Health as in §5 Phase C. Success = CM online + HTTP 200 + Gateway ready 200 + running dist now `LIVE_LOCKED`.
3. **No-apply if already locked:** `LIVE_LOCKED` → skip apply. Do not git update. Do not build. Do not PM2 restart. Do not edit `preview.service.ts`. **Do not abort the task.** Continue to Phase D proof against the already-locked running dist.
4. **STOP if unknown / dirty / apply-health risk:** Dirty remote tree → `S_DIRTY_TREE`. Unprovable running path/dist → `S_UNKNOWN_PATH`. Build fail → `S_BUILD_FAIL` (no restart). Health fail after restart → `S_HEALTH_FAIL` and rollback previous dist backup + restart CM only.
5. **`preview.service.ts` / `preview.controller.ts`:** Forbidden for this entire task. Later apply uses locked PREVIEW-STOP-01 fingerprints only. If Vite stop still fails after a confirmed `LIVE_LOCKED` running dist, record FAIL and return to control plane. Do not invent a source fix.
6. **Vite POST `/stop` + restart proof:** After running dist is `LIVE_LOCKED` (already, or after apply), prove on `https://staging.ainow.biz/en/app` with the disposable Vite ZIP fixture pattern from PREVIEW-NODE-STAGING-01: import, Start Preview once, marker loads, inspect process/port, `POST /api/preview/{sessionId}/stop` succeeds, process gone, `3001`–`3100` port gone, status/map cleared, Start Preview again on the same session, marker loads again with a process/port, stop again and confirm cleanup.
7. **Static stop proof:** Separate disposable static fixture. Start Preview; marker loads; `POST /stop` succeeds safely; no Vite/node process.
8. **Cleanup / rollback:** Gate LEFT ON. Build fail: no restart. Health fail after restart: restore previous dist backup and restart CM only. Proof-session cleanup: Advanced session Stop as hard cleanup only. Retain named disposable projects unless a later Step 3 proves a current safe project-delete endpoint (default: retain; do not delete). Do not `docker compose down`.
9. **Write set:** No application source. EXACT `writePaths=[]`. Step 2 writes this document plus board/registry/sidecar precision fields. Step 3/4 may append evidence/checkpoint docs only under GOVERNANCE.
10. **Mutexes:** STAGING + CONTAINER-MANAGER declared not acquired this window. GOVERNANCE held only for this freeze then released UNOWNED. GATEWAY / FRONTEND / I18N / ENV / PROVIDER-LIVE / CREDIT / LOCAL-RUNTIME undeclared.

---

## 4. Host / operator identity

| Item | Freeze |
|---|---|
| Live Builder | `https://staging.ainow.biz` — Lightsail `aisandbox-staging` (`18.136.141.186`, `/opt/aisandbox`) |
| Apex `https://ainow.biz` | Different site. **Out of scope.** Do not use it |
| SSH host alias | `Host aisandbox-staging` in `C:\Users\knlee\.ssh\config` — required for Phase A–C when Step 3 is later authorized. **Not used this window** |
| Operator | Keith signed-in staging account (same family as prior staging smokes) |
| Locale | `/en/app` |
| Chat / Ask / Build / Send | **Forbidden** for this proof |
| Public stop | Operator DevTools `POST /api/preview/{sessionId}/stop` with `credentials: 'include'` on the signed-in origin. No UI Stop Preview button |

Do **not** create the projects, ZIPs, SSH, PM2, or run any of the procedure during Step 2.

---

## 5. Frozen Step 3 procedure (exactly this)

Step 3 is **not** authorized by this freeze. When Keith later authorizes Step 3, execute the phases in order. Stop on the first stop-condition in §6. Do **not** admit a lane unless that later authorization also admits. Default occupancy remains EMPTY until a later control-plane admission.

### Phase A — Read-only live version check (no mutation)

SSH to `aisandbox-staging`. Record evidence. Print paths and SHAs. Never print `.env` secrets, API keys, cookies, or session cookies.

```bash
# A1. Identity / clean tree / HEAD
hostname -f || hostname
pwd
git -C /opt/aisandbox rev-parse --show-toplevel
git -C /opt/aisandbox rev-parse HEAD
git -C /opt/aisandbox branch --show-current
git -C /opt/aisandbox status --short
git -C /opt/aisandbox merge-base --is-ancestor 79510ca200c9bfda999cb6140c6596d65ccec02f HEAD && echo ANCESTOR_79510ca=YES || echo ANCESTOR_79510ca=NO

# A2. Running process / script / dist path
pm2 describe aisandbox-container-manager
pm2 jlist | python3 -c "import json,sys; procs=[p for p in json.load(sys.stdin) if p.get('name')=='aisandbox-container-manager'];
assert len(procs)==1, 'CM_COUNT='+str(len(procs));
p=procs[0]; print('name', p.get('name')); print('pm_id', p.get('pm_id')); print('status', p.get('pm2_env',{}).get('status')); print('cwd', p.get('pm2_env',{}).get('pm_cwd')); print('exec', p.get('pm2_env',{}).get('pm_exec_path')); print('script', p.get('pm2_env',{}).get('pm_exec_path') or p.get('script')); print('pid', p.get('pid'))"
```

STOP (`S_UNKNOWN_PATH`) if any of:

- `aisandbox-container-manager` count !== 1
- status is not `online`
- cwd is missing or not under `/opt/aisandbox/services/container-manager`
- exec/script path is missing, not a file, or not under `/opt/aisandbox/services/container-manager`
- exec/script is not a `dist/` artifact of that tree

STOP (`S_DIRTY_TREE`) if `git -C /opt/aisandbox status --short` is non-empty.

Then grep the **running** compiled preview modules next to the identified dist root (do not mutate). Try in order; STOP `S_UNKNOWN_PATH` if neither controller nor service dist file exists:

```text
$CM_CWD/dist/preview/preview.controller.js
$CM_CWD/dist/src/preview/preview.controller.js
$CM_CWD/dist/preview/preview.service.js
$CM_CWD/dist/src/preview/preview.service.js
```

```bash
# A3. Running dist fingerprints (adjust DIST_* to the files that exist beside the identified dist root)
DIST_CTRL=<resolved-controller-js>
DIST_PREVIEW=<resolved-service-js>
SRC_CTRL=/opt/aisandbox/services/container-manager/src/preview/preview.controller.ts
SRC_PREVIEW=/opt/aisandbox/services/container-manager/src/preview/preview.service.ts

# Quote-style fallback: if a NEED with single quotes misses, retry the same NEED with double quotes.
# HIT if either quote style matches.

echo "=== CONTROLLER DIST ==="
for NEED in \
  "Post(':sessionId/stop')" \
  "Delete(':sessionId/stop')" \
  'stopPreviewByDelete'
 do
  echo "DIST_CTRL_NEED=$NEED"
  grep -F "$NEED" "$DIST_CTRL" >/dev/null && echo DIST_CTRL_HIT=YES || echo DIST_CTRL_HIT=NO
done

echo "=== SERVICE DIST ==="
for NEED in \
  "return { message: 'No active preview for this session' }" \
  'kill -TERM -' \
  'kill -KILL -' \
  'fuser -k' \
  '/proc/net/tcp' \
  'activePreviews.delete' \
  'releasePort'
 do
  echo "DIST_PREVIEW_NEED=$NEED"
  grep -F "$NEED" "$DIST_PREVIEW" >/dev/null && echo DIST_PREVIEW_HIT=YES || echo DIST_PREVIEW_HIT=NO
done

echo "SRC_CTRL_EXISTS=$([ -f "$SRC_CTRL" ] && echo YES || echo NO)"
echo "SRC_PREVIEW_EXISTS=$([ -f "$SRC_PREVIEW" ] && echo YES || echo NO)"
if [ -f "$SRC_CTRL" ]; then
  for NEED in \
    "@Post(':sessionId/stop')" \
    "@Delete(':sessionId/stop')" \
    'stopPreviewByDelete'
   do
    echo "SRC_CTRL_NEED=$NEED"
    grep -F "$NEED" "$SRC_CTRL" >/dev/null && echo SRC_CTRL_HIT=YES || echo SRC_CTRL_HIT=NO
  done
fi
if [ -f "$SRC_PREVIEW" ]; then
  for NEED in \
    "return { message: 'No active preview for this session' }" \
    'kill -TERM -' \
    'kill -KILL -' \
    'fuser -k' \
    '/proc/net/tcp' \
    'this.activePreviews.delete(sessionId)' \
    'this.releasePort(preview.port)'
   do
    echo "SRC_PREVIEW_NEED=$NEED"
    grep -F "$NEED" "$SRC_PREVIEW" >/dev/null && echo SRC_PREVIEW_HIT=YES || echo SRC_PREVIEW_HIT=NO
  done
fi
```

`LIVE_LOCKED` requires **all** controller dist HITs and **all** service dist HITs. Any required dist HIT=NO → `LIVE_OLD` (unless files were unreadable, which is `LIVE_UNKNOWN`). Source HITs are recorded to decide whether Phase B needs git update; they do not override the running-artifact class.

Classify using §2.3. Record `LIVE_*`, `ANCESTOR_79510ca`, HEAD, cwd, exec/script, dist paths, and each HIT/NO.

- `LIVE_UNKNOWN` → STOP (`S_UNKNOWN_PATH`)
- Dirty tree already stopped above (`S_DIRTY_TREE`)
- `LIVE_LOCKED` → skip Phase B/C apply; continue to Phase D
- `LIVE_OLD` → continue to Phase B

Do **not** `pm2 restart`. Do **not** `npm run build`. Do **not** `git pull`. Do **not** edit `.env`. Do **not** touch Gateway / frontend / AI service / watchdog / Docker / Postgres / Redis.

### Phase B — Apply locked code only if `LIVE_OLD`

Capture rollback handles **before** any write:

```bash
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
CM_CWD=<from Phase A>
CM_PID=<from Phase A>
DIST_DIR="$CM_CWD/dist"
cp -a "$DIST_DIR" "/tmp/preview-stop-staging-apply-01-dist-$STAMP"
git -C /opt/aisandbox rev-parse HEAD > /tmp/preview-stop-staging-apply-01-pre-head-$STAMP.txt
echo "$CM_PID" > /tmp/preview-stop-staging-apply-01-pre-pid-$STAMP.txt
```

**B1. Git update only if source is old and the remote worktree is still clean.**

If Phase A source already has all §2.1 fingerprints: skip git; go to B2.

If source is old:

```bash
git -C /opt/aisandbox status --short   # must still be empty
git -C /opt/aisandbox fetch origin
git -C /opt/aisandbox merge-base --is-ancestor 79510ca200c9bfda999cb6140c6596d65ccec02f FETCH_HEAD && echo FETCH_HAS_79510ca=YES || echo FETCH_HAS_79510ca=NO
```

STOP (`S_UNKNOWN_PATH` / abort apply) if `FETCH_HAS_79510ca=NO`.
STOP (`S_DIRTY_TREE`) if status became dirty.
Do **not** `git reset --hard`. Do **not** stash. Do **not** force-push. Do **not** create branches. Do **not** switch branches.

If the current branch is clean and FETCH_HEAD contains `79510ca`, update using the established pull/merge of that already-checked-out branch (current main containing `79510ca` or later):

```bash
git -C /opt/aisandbox pull --ff-only
git -C /opt/aisandbox rev-parse HEAD
git -C /opt/aisandbox merge-base --is-ancestor 79510ca200c9bfda999cb6140c6596d65ccec02f HEAD && echo ANCESTOR_79510ca=YES || echo ANCESTOR_79510ca=NO
```

STOP (`S_FF_FAIL`) if `--ff-only` fails (conflicts / non-ff). Leave the previous process running.

Confirm source now contains §2.1 fingerprints before building.

**B2. Build only container-manager.**

```bash
cd /opt/aisandbox/services/container-manager && npm run build
```

STOP (`S_BUILD_FAIL`) if build exits non-zero. Do **not** restart PM2. Previous `dist/` remains what PM2 is serving until a successful build + restart.

Re-grep the new dist files for §2.1 fingerprints. STOP (`S_BUILD_FAIL`) if the new dist is still missing locked fingerprints.

**B3. Restart only `aisandbox-container-manager`.**

```bash
pm2 restart aisandbox-container-manager
```

Do **not** `pm2 restart all`. Do **not** restart `aisandbox-api-gateway`, `aisandbox-frontend`, `aisandbox-ai-service`, or `aisandbox-ops-watchdog`. Do **not** `--update-env` (this apply is dist/code, not `.env`).

### Phase C — Health after apply

Only after Phase B. Skip entirely when Phase A classified `LIVE_LOCKED`.

```bash
pm2 describe aisandbox-container-manager
curl -sS -o /tmp/preview-stop-staging-apply-01-cm-health.json -w '%{http_code}' http://127.0.0.1:4002/api/health
cat /tmp/preview-stop-staging-apply-01-cm-health.json
# Re-identify exec/script; re-grep DIST_CTRL + DIST_PREVIEW for §2.1; must now classify LIVE_LOCKED
curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/api/health/ready
```

PASS only if **all** are true:

- `aisandbox-container-manager` status `online`
- CM health HTTP 200 with `service":"container-manager"` (or established `status":"ok"` body) on `:4002`
- Running dist now `LIVE_LOCKED`
- Gateway ready HTTP 200 on `:4000` (read-only; **do not** restart Gateway if this fails — STOP `S_HEALTH_FAIL` and roll back CM only)

STOP (`S_HEALTH_FAIL`) otherwise. Execute §7 rollback. Do not start the browser proof.

### Phase D — Live stop/restart proof (Vite + static)

Enter Phase D only when running dist is `LIVE_LOCKED` (Phase A skip-apply, or Phase C after apply). Host `https://staging.ainow.biz/en/app` only. **No Ask/Build/Send.** No provider/credit.

Reuse the frozen ZIP-import fixture pattern from `docs/PREVIEW-NODE-STAGING-01-STAGE-START.md` §5 Phases 0–3 / 7, with **new timestamps** and this task's marker text. Do **not** reuse prior STAGING-01 project/session IDs as the proof subject.

**D0. Preflight (read-only).** Browser: `https://staging.ainow.biz/en` → Continue to Workspace or Sign in → `https://staging.ainow.biz/en/app`. Confirm HTTPS lock. No `localhost`. No apex. Confirm chat is not used. STOP if signed-out, wrong host, or any 5xx on `/en/app`.

**D1. Local ZIP fixtures (operator workstation).** Create two tiny ZIPs with Windows Explorer “Compress to ZIP” or PowerShell `Compress-Archive` so entries sit at archive root. No `__MACOSX`, no nested folder, no `node_modules`, no `.git`, no secrets. Each ZIP well under 5 MB.

ZIP A filename: `preview-stop-staging-apply-01-vite-YYYYMMDD-HHMM.zip`

`package.json`:

```json
{
  "name": "preview-stop-staging-apply-01-vite-fixture",
  "private": true,
  "scripts": {
    "dev": "vite"
  },
  "devDependencies": {
    "vite": "5.4.11"
  }
}
```

`index.html` heading marker: **`PREVIEW-STOP-STAGING-APPLY-01 Vite OK`**. No `vite.config.js`. No lockfile.

ZIP B filename: `preview-stop-staging-apply-01-static-YYYYMMDD-HHMM.zip` — only `index.html`, heading marker **`PREVIEW-STOP-STAGING-APPLY-01 Static OK`**.

Existing frozen PREVIEW-NODE-STAGING-01 ZIP contents may be copied and re-stamped with the markers/filenames above. Do not import a STAGING-01 project as this proof.

**D2. Disposable projects.** Create two new projects (do not reuse prior E2E / STAGING-01 / APPLY-01 experiments):

- Vite: `preview-stop-staging-apply-01-vite-YYYYMMDD-HHMM`
- Static: `preview-stop-staging-apply-01-static-YYYYMMDD-HHMM`

Create via `workspace-projects-new-project-button` / `workspace-projects-create-confirm-button`. Wait for empty file tree.

**D3. Import Vite fixture (no Ask/Build).** History → Import Project → ZIP A only. Open `index.html` and confirm the Vite marker text. Do not Ask/Build. Do not editor-Save to invent files.

**D4. Start Preview once (Vite).** Click `workspace-preview-start` once. No request body. Wait for iframe `workspace-preview-iframe` to show **`PREVIEW-STOP-STAGING-APPLY-01 Vite OK`**. Expected start JSON: `status: "running"`, `framework: "Vite"`, `port` in `3001`–`3100`. STOP (`S_VITE_START_FAIL`) if start 400 / timeout / `unavailable` / marker miss after 180s.

**D5. Inspect process/port (Vite session still open).** Same inspect as STAGING-01 Phase 5 (workspace exec preferred; SSH fallback only if later authorized):

```bash
docker ps --format '{{.Names}} {{.Status}}' | grep sandbox-session-
docker exec sandbox-session-{viteSessionId} sh -c 'ps aux; ls /tmp/preview-*.log 2>/dev/null; ss -lntp || netstat -lntp'
```

Record pid and listen port in `3001`–`3100`. PASS this step only if a Vite/node process exists and the allocated port listens.

**D6. POST stop (Vite).** No Stop Preview button. In DevTools console on `staging.ainow.biz` (same signed-in origin):

```javascript
fetch(`/api/preview/${viteSessionId}/stop`, { method: 'POST', credentials: 'include' })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => null) }))
```

PASS stop:

- HTTP **200**
- body includes `success: true` and `message: 'Preview stopped successfully'` (or the idempotent empty-map message only if inspect already showed no process — that is not this Vite path)
- `GET /api/preview/{viteSessionId}/status` → `running: false` / `'No active preview for this session'` (map cleared)
- Re-run D5 inspect: captured pid dead; **no** listen on `3001`–`3100`

FAIL (`S_VITE_STOP_FAIL`) if HTTP 400/404/5xx, `net::ERR_ABORTED`, process still alive, port still listening, or status still `running`/`starting`. If running dist was confirmed `LIVE_LOCKED`, record FAIL and **do not invent a source fix**. Session Stop is hard cleanup only (§7); it does not convert this FAIL into PASS.

**D7. Restart on the same session.** Click Start Preview once again on the **same** Vite session. Confirm the Vite marker loads again and a process/port exists (new pid and a port in `3001`–`3100` are allowed). STOP (`S_VITE_RESTART_FAIL`) if start fails, marker misses, or no process/port.

**D8. Stop again and confirm cleanup.** Repeat D6 POST `/stop`. Confirm success, process gone, `3001`–`3100` gone, status/map cleared.

**D9. Static fixture.** Open the static disposable project. Import ZIP B only. Confirm file tree is only `index.html` (no `package.json`). Click Start Preview once. Confirm marker **`PREVIEW-STOP-STAGING-APPLY-01 Static OK`**. Confirm no Vite/node process for this session. Then:

```javascript
fetch(`/api/preview/${staticSessionId}/stop`, { method: 'POST', credentials: 'include' })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => null) }))
```

PASS static stop: HTTP 200 success; no Vite/node process created or left; status/map cleared or no active preview. FAIL (`S_STATIC_STOP_FAIL`) if stop errors, a Vite/node process appears, or static preview was mis-detected as Vite.

### Phase E — Cleanup (always)

- `POST /api/preview/{sessionId}/stop` if a preview is still mapped (harmless if already cleared).
- Advanced **Stop** both disposable sessions (`workspace-advanced-stop-session`) as hard cleanup.
- Confirm both containers are gone (`docker ps` fallback only if SSH authorized).
- Retain the named disposable projects. Do **not** call a project-delete endpoint unless Step 3 later proves that endpoint is already safe/current. Default: retain.
- Leave `GLOBAL_EXECUTION_ENABLED` / Builder live gate ON.
- Leave CM online on the surviving dist (new if apply PASS; restored if rollback; untouched if `LIVE_LOCKED` skip-apply).
- Remove `/tmp/preview-stop-staging-apply-01-*` copies only after Step 3 evidence is recorded, or keep them until Step 4.
- No `.env` restore (this task must not have edited `.env`).
- Local ZIP files may be deleted from the operator workstation; they are not repo files.
- Do not `pm2 restart` during cleanup. Do not invite. Do not touch EXEC-01C6A artifacts.

---

## 6. Frozen stop conditions

| ID | Trigger | Mutation after trigger |
|---|---|---|
| `S_UNKNOWN_PATH` | CM process count !== 1, not `online`, cwd/script missing, script not under `/opt/aisandbox/services/container-manager/dist`, or fingerprint files unreadable | None |
| `S_DIRTY_TREE` | `git -C /opt/aisandbox status --short` non-empty at Phase A or before git update | None |
| `S_BUILD_FAIL` | `npm run build` non-zero, or new dist still missing §2.1 fingerprints | No PM2 restart. Previous process keeps old dist |
| `S_HEALTH_FAIL` | After restart: CM not online, CM health not 200, running dist not `LIVE_LOCKED`, or Gateway ready not 200 | Rollback CM dist + restart CM only (§7) |
| `S_FF_FAIL` | `git pull --ff-only` fails | No build, no restart |
| `S_SIGNED_OUT` | Phase D not signed in on `https://staging.ainow.biz/en/app` | None (no apply if not yet applied; cleanup any created projects/sessions) |
| `S_WRONG_HOST` | Apex / localhost / non-staging host | None |
| `S_ASK_BUILD` | Ask/Build/Send used | Stop proof; session Stop cleanup only |
| `S_VITE_START_FAIL` | Vite Start Preview 400 / timeout / `unavailable` / marker miss after 180s | Session Stop as hard cleanup |
| `S_VITE_STOP_FAIL` | Vite `POST /stop` not success, or process/port/map not cleared, after running dist is `LIVE_LOCKED` | Record FAIL. Do not invent source fix. Session Stop as hard cleanup only |
| `S_VITE_RESTART_FAIL` | Second Start Preview on the same session does not load the marker or has no process/port | Session Stop as hard cleanup |
| `S_STATIC_STOP_FAIL` | Static preview missing, mis-detected as Vite, launches a process, or `POST /stop` is not a safe success | Session Stop as hard cleanup |

`LIVE_LOCKED` is **not** a stop-id. It skips apply and continues to proof.

Also stop (inherited, still in force during Phase D): STAGING-01 S1–S8 analogues that this table already covers (wrong host, signed-out, Ask/Build used, Vite start fail, marker miss, leak, static regression).

---

## 7. Cleanup / rollback criteria

| Event | Action |
|---|---|
| Phase A stop (`S_DIRTY_TREE` / `S_UNKNOWN_PATH`) | None. SSH session ends. Gate ON. No proof |
| Build fail | No restart. Previous process keeps serving old dist |
| Health fail after restart | Restore `/tmp/preview-stop-staging-apply-01-dist-$STAMP` over `$CM_CWD/dist`, then `pm2 restart aisandbox-container-manager` only (no `--update-env`). Re-check CM health. Do not restart Gateway/frontend/AI/watchdog |
| Vite stop still fails after `LIVE_LOCKED` | Record FAIL. Do not edit source. Session Stop as hard cleanup only |
| Proof-session leak / failed stop | Advanced session Stop both disposable sessions. Retain projects. Gate ON |
| Successful proof | Session Stop both; retain projects; gate ON; CM remains on surviving `LIVE_LOCKED` dist |

Do not delete DB rows. Do not `docker compose down`. Do not restore-false the live gate.

---

## 8. Exact write set (EXACT)

| Path | This Step 2 | Later Step 3 | Later Step 4 |
|---|---|---|---|
| `docs/PREVIEW-STOP-STAGING-APPLY-01-STAGE-START.md` | Created (this freeze) | Evidence append only | Checkpoint append / lock record |
| `TASKS.md` CURRENT EXECUTION BOARD fields | Yes | End-status only | End-status only |
| `TASKS_BACKLOG_FULL.md` PREVIEW-STOP-STAGING-APPLY-01 body | Step 2 fields | Step 3 fields | Step 4 fields |
| `docs/control-plane/lane-saturation-state.json` | `writeSetPrecision=EXACT`; `writePaths=[]`; occupancy EMPTY; `admissionUncertain=true` | Occupancy only if a later admission changes it | Lock fields only if lock is authorized |
| `docs/control-plane/SATURATION_PROOF.json` | Validator output only | Validator output only | Validator output only |
| `services/container-manager/src/preview/preview.service.ts` | **No** | **No** | **No** |
| `services/container-manager/src/preview/preview.controller.ts` | **No** | **No** | **No** |
| `services/container-manager/src/preview/preview.service.spec.ts` | **No** | **No** | **No** |
| Frontend / i18n | **No** | **No** | **No** |
| Gateway routes | **No** | **No** | **No** |
| `.env` | **No** | **No** | **No** |

Candidate `writePaths=[]`. Implementation write set is ops/procedure only. Staging git / `dist/` / PM2 mutation exists only as later Step 3 runtime, not as a repo write path.

---

## 9. Step 3 runtime / mutex needs (declared, not acquired this window)

| Need | Step 2 | Later Step 3 |
|---|---|---|
| Mutex CONTAINER-MANAGER | Declared, not acquired | Required for apply/build/restart ownership. Acquire only if Step 3 is authorized and apply proceeds past `LIVE_OLD` |
| Mutex STAGING | Declared, not acquired | Required for Lightsail staging host + browser proof. Acquire only if Step 3 is authorized |
| GOVERNANCE | Transient board/registry write then UNOWNED | Evidence/board write then UNOWNED |
| SSH | Not used | Required for Phase A–C on `aisandbox-staging` |
| AWS | Not used | Only as needed for that Lightsail host access. No instance lifecycle |
| PM2 restart | No | **Only** `aisandbox-container-manager` and **only** if `LIVE_OLD` apply proceeds (Phase B3). `LIVE_LOCKED` / dirty / unknown-path: no restart |
| LOCAL-RUNTIME | Undeclared | **No** |
| PROVIDER-LIVE | Undeclared | **No** |
| CREDIT | Undeclared | **No** |
| GATEWAY / FRONTEND / I18N / ENV / PACKAGE / COMPOSE | Undeclared | **No** |
| Browser / signed-in operator | Not used | Required for Phase D |
| `stagingAuthorized` | `false` | `true` only if a later control-plane Step 3 authorization sets it. This freeze does not |

---

## 10. Out of scope (frozen)

- Application source edits (`preview.service.ts`, `preview.controller.ts`, specs)
- Stop Preview button / frontend / i18n
- Gateway route changes or POST→DELETE adapter
- Ask/Build / Send / provider / credit
- EXEC-01C6A reopen or PM2 overlays
- `.env` / live-gate mutation (`GLOBAL_EXECUTION_ENABLED` stays ON)
- Stripe / orchestration / apex `ainow.biz` / invitations
- Next.js / CRA / Vue / Express preview productization
- Preview refresh behavior (distinct from stop/restart)
- Docker/Postgres/Redis / `docker compose down`
- Git commit/push / branch / worktree
- Registering named later children

---

## 11. Exact Step 3 evidence list (when later authorized)

| ID | Evidence |
|---|---|
| E1 | Remote `git status --short` empty; HEAD; `ANCESTOR_79510ca` |
| E2 | CM pm_id, pid, status, cwd, exec/script |
| E3 | Dist paths; each §2.1 HIT/NO |
| E4 | Classification `LIVE_OLD` / `LIVE_LOCKED` / `LIVE_UNKNOWN` and which stop-id if stopped |
| E5 | Pre-HEAD, pre-PID, dist backup path; git update yes/no; post-HEAD |
| E6 | Build exit; post-build dist HIT; `pm2 restart aisandbox-container-manager` yes/no (no `--update-env`) |
| E7 | CM `:4002` health; Gateway `:4000` ready; other PM2 apps untouched |
| E8 | Post-apply classification (must be `LIVE_LOCKED` to enter Phase D; skip-apply `LIVE_LOCKED` also enters Phase D) |
| E9 | Vite project name, projectId, sessionId; ZIP A filename; Ask/Build=0 |
| E10 | Vite Start Preview: marker visible; process/port inspect |
| E11 | Vite `POST /stop` status+body; follow-up GET `/status`; post-stop inspect (process gone, `3001`–`3100` gone, map cleared) |
| E12 | Same-session second Start Preview: marker + process/port; second stop cleanup |
| E13 | Static project: marker; no Vite/node process; `POST /stop` safe success |
| E14 | Cleanup: both sessions Stopped; projects retained; gate ON |
| E15 | Any stop-id, rollback performed, and FAIL-without-source-fix if Vite stop failed after `LIVE_LOCKED` |

Screenshots: Vite iframe marker (start + restart), static iframe marker. Do not capture cookies, CSRF tokens, or Authorization headers.

---

## 12. Invariants this freeze must not change

- Occupancy EMPTY. Not admitted. Lane 3 DISABLED.
- GOVERNANCE UNOWNED at end-state.
- CONTAINER-MANAGER + STAGING declared, not acquired.
- `stagingAuthorized=false`. `STAGING_EXECUTION_AUTHORIZED=NO`.
- EXEC-01C6A `startCondition=NOT_READY` UNCHANGED / not reopened.
- BUILDER-LIVE-GATE-01 COMPLETE AND LOCKED / gate LEFT ON.
- PREVIEW-STOP-01 remains COMPLETE AND LOCKED (LOCAL-TESTS parent; this child must not reopen or rewrite it).
- PREVIEW-NODE-STAGING-01 §17 E9/E10/E16 stop/orphan evidence is not rewritten.
- PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.
- No application source. `writePaths=[]`.

---

## 13. Admission / saturation

- Candidate `status=READY` / `saturationClass=FORCING` / `writeSetPrecision=EXACT` / `writePaths=[]` / `admissionUncertain=true`.
- `Test-Admissible` = ADMISSION_UNCERTAIN. Not in S.
- Occupancy EMPTY. Idle implementation capacity is valid.
- This Step 2 does not admit a lane. A later Step 3 still requires Keith admission authorization if a lane is to be occupied; default remains not admitted / EMPTY.

---

## 14. Keith-decision boundary (after this Step 2)

```
KEITH_DECISION_REQUIRED_BEFORE_STAGE_START=NO (this window completes Step 2)
KEITH_DECISION_REQUIRED_BEFORE_ADMISSION=YES
KEITH_DECISION_REQUIRED_BEFORE_LIVE_VERSION_CHECK=YES
KEITH_DECISION_REQUIRED_BEFORE_STAGING_APPLY=YES
KEITH_DECISION_REQUIRED_BEFORE_STAGING_OR_BROWSER_PROOF=YES
KEITH_DECISION_REQUIRED_BEFORE_CHECKPOINT_LOCK=YES
KEITH_DECISION_REQUIRED_BEFORE_REOPENING_EXEC_01C6A=YES
KEITH_DECISION_REQUIRED_BEFORE_HARNESS_ENABLEMENT=YES
KEITH_DECISION_REQUIRED_BEFORE_STRIPE_OR_TOP_UP=YES
KEITH_DECISION_REQUIRED_BEFORE_APEX_PRODUCTION_ROUTING=YES
KEITH_DECISION_REQUIRED_BEFORE_REGISTERING_NAMED_CHILDREN=YES
```

This freeze does **not** reopen EXEC-01C6A. It does **not** change BUILDER-LIVE-GATE-01. Gate remains ON.

---

## 15. Step 2 acceptance

- [x] Read-only live version-check fingerprints frozen against locked `79510ca` stop behavior
- [x] Classification frozen: `LIVE_LOCKED` / `LIVE_OLD` / `LIVE_UNKNOWN`
- [x] STOP frozen for dirty tree, `LIVE_UNKNOWN`, and build/apply health risk
- [x] `LIVE_OLD` apply frozen: ff-only to a revision containing `79510ca` or later; build container-manager only; restart `aisandbox-container-manager` only; no `--update-env`; no Gateway/frontend/AI/watchdog restart; verify CM `:4002` and Gateway ready `:4000`; running dist becomes `LIVE_LOCKED`
- [x] `LIVE_LOCKED` skips apply and still proceeds to proof
- [x] Vite POST `/stop` + process/port/map clear + same-session restart + second stop frozen
- [x] Static stop frozen as safe success / no Vite/node process
- [x] ZIP fixture pattern reused from PREVIEW-NODE-STAGING-01; Ask/Build forbidden
- [x] Rollback / FAIL-without-source-fix frozen
- [x] Out of scope confirmed (source, Stop Preview button, Gateway, Ask/Build, provider/credit, EXEC-01C6A / PM2 overlays, `.env` / live gate, Stripe/orchestration/apex/invites)
- [x] EXACT `writePaths=[]`; `admissionUncertain=true`; occupancy EMPTY; GOVERNANCE UNOWNED
- [x] CONTAINER-MANAGER + STAGING declared, not acquired; `stagingAuthorized=false`
- [x] Steps 3–4 NOT AUTHORIZED; procedure not executed this window

---

## 16. Activity ledger (Step 2)

**Step 2 HEAD:** not queried this window (Keith instruction: no Git except validator + `git diff --check`)
**Step 2 activity ledger:** LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=0, application source=0, frontend=0, i18n=0, tests executed=0, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0, named other children registered=0, Stripe=0, credit mutation=0, follow-on registration=0. Governance writes: `docs/PREVIEW-STOP-STAGING-APPLY-01-STAGE-START.md`; TASKS.md CURRENT EXECUTION BOARD fields; TASKS_BACKLOG_FULL.md PREVIEW-STOP-STAGING-APPLY-01 body; sidecar candidate `writeSetPrecision=EXACT` (`writePaths=[]`; occupancy EMPTY / GOVERNANCE UNOWNED; `admissionUncertain=true`); SATURATION_PROOF.json only as validator output.

**Activation effect:** NONE
**Rollback boundary:** Step 2 = discard this document’s freeze plus this window’s board/registry/sidecar write-set field updates. Ordinary Builder Ask/Build/static Preview path, locked PREVIEW-STOP-01 LOCAL-TESTS evidence, locked Vite start path, live gate, and credit UX are untouched.

---

## 17. Authorization state (end of Step 3)

```
STEP3_AUTHORIZED=YES
STEP3_COMPLETE=YES
STEP4_AUTHORIZED=NO
ADMITTED=NO
STAGING_AUTHORIZED=NO (end-state; used then released)
STAGING_EXECUTION_AUTHORIZED=NO (end-state)
SSH=YES (this window; ended)
PM2=YES (aisandbox-container-manager restart only; ended)
BROWSER=YES (this window; ended)
GIT_COMMIT=NO
```

---

## 18. Step 3 evidence (2026-09-17) — COMPLETE (apply PASS; public HTTP 200 FAIL)

**Verdict:** **COMPLETE.** Apply/health **PASS**. Vite start/restart and process/port/map clear **PASS**. Public operator `POST /api/preview/{sessionId}/stop` **FAIL** on frozen HTTP 200 JSON body (HTTP 400 `text/html` empty). CM `:4002` POST stop **PASS** HTTP 200 JSON. Static marker / no Vite-node process **PASS**. Same public HTTP 400 on static stop. **No source fix invented.** Step 4 NOT AUTHORIZED. Task not locked. Occupancy EMPTY. Sidecar unchanged.
**Stop-id:** public HTTP criterion failed (`S_VITE_STOP_FAIL` on HTTP 200 body only). Process/port/map were cleared; restart still ran. Do not treat this as a `preview.service.ts` product fix.
**Admission:** NO.

### Phase A — `LIVE_OLD`

SSH `aisandbox-staging` (`ip-172-26-6-228.ap-southeast-1.compute.internal`). Toplevel `/opt/aisandbox`. Branch `main`. HEAD `cbeb5c6aa0f8af50114bacd27e1dbd8e269d8b5c`. `status --short` empty (0 bytes). `ANCESTOR_79510ca=NO` (`fatal: Not a valid commit name 79510ca200c9bfda999cb6140c6596d65ccec02f` — object not yet in the staging clone). Not `S_DIRTY_TREE`.

CM `aisandbox-container-manager` count=1, `pm_id=1`, status `online`, cwd `/opt/aisandbox/services/container-manager`, exec/script `/opt/aisandbox/services/container-manager/dist/main.js` (file exists), pid `924496`, restarts 1. Dist files: `$CM_CWD/dist/preview/preview.controller.js` and `preview.service.js` exist.

Running dist missing locked stop fingerprints (`LIVE_OLD`): controller `Post(':sessionId/stop')` / `Delete(':sessionId/stop')` / `stopPreviewByDelete` HIT=NO; service empty-map / `kill -TERM -` / `kill -KILL -` / `fuser -k` / `/proc/net/tcp` HIT=NO; legacy `activePreviews.delete` and `releasePort` HIT=YES. Source also old (`@Post(':sessionId/stop')` SRC HIT=NO; `@Delete(':sessionId/stop')` SRC HIT=YES). Not `LIVE_UNKNOWN`.

### Phase B/C — apply to `LIVE_LOCKED`

- Dist backup `/tmp/preview-stop-staging-apply-01-dist-20260917T030550Z`. Pre-HEAD `cbeb5c6aa0f8af50114bacd27e1dbd8e269d8b5c`. Pre-PID `924496`.
- `git fetch origin` then `git pull --ff-only` → POST_HEAD `185e81934e43730117044dff43ac358dec575b45` (`FETCH_HAS_79510ca=YES`; `ANCESTOR_79510ca=YES`). Tree remained clean.
- Post-pull source all §2.1 HIT=YES. `npm run build` in `services/container-manager` only; `BUILD_EXIT=0`.
- New dist compiled POST/DELETE as `(0, common_1.Post)(':sessionId/stop')` and `(0, common_1.Delete)(':sessionId/stop')` (TypeScript decorator emit). Service dist all HIT=YES including empty-map, process-group kill, `fuser -k`, `/proc/net/tcp`. Classified **LIVE_LOCKED**.
- `pm2 restart aisandbox-container-manager` only (no `--update-env`; PM2 printed the unused `--update-env` hint). New pid `963390` restarts=2. Other apps untouched: Gateway pid `898373` ↺2; frontend `844894` ↺0; AI `844882` ↺0; watchdog `844905` ↺0.
- CM `GET :4002/api/health` HTTP 200 `{"status":"ok","service":"container-manager",...}`. Gateway `GET :4000/api/health/ready` HTTP 200. Running dist **LIVE_LOCKED**.

### Phase D — Vite + static

Signed-in `knlee801@gmail.com` on `https://staging.ainow.biz/en/app`. HTTPS. Not apex, not localhost. Ask/Build/Send = 0.

| ID | Record |
|---|---|
| **E1** | Host `aisandbox-staging`. Pre-pull HEAD `cbeb5c6…`. Post-pull HEAD `185e81934e43730117044dff43ac358dec575b45`. `status --short` empty. `FETCH_HAS_79510ca=YES`. `ANCESTOR_79510ca=YES` after pull. |
| **E2** | CM pm_id=1 online. Pre-apply pid `924496`. Post-apply pid `963390` restarts=2. cwd `/opt/aisandbox/services/container-manager`. script `/opt/aisandbox/services/container-manager/dist/main.js`. |
| **E3** | `DIST_CTRL=/opt/aisandbox/services/container-manager/dist/preview/preview.controller.js`. `DIST_PREVIEW=.../preview.service.js`. Phase A: locked POST/DELETE/process-group/port fingerprints HIT=NO. Post-build/running: all §2.1 HIT=YES (controller via compiled `(0, common_1.Post/Delete)(':sessionId/stop')`). |
| **E4** | Phase A **`LIVE_OLD`**. Stop-id none at Phase A. After apply **`LIVE_LOCKED`**. |
| **E5** | Pre-HEAD `cbeb5c6…`. Pre-PID `924496`. Dist backup `/tmp/preview-stop-staging-apply-01-dist-20260917T030550Z`. Git update **yes** (`pull --ff-only`). Post-HEAD `185e819…`. |
| **E6** | `npm run build` exit 0 (tsc in container-manager only). Post-build dist LIVE_LOCKED. `pm2 restart aisandbox-container-manager` **yes**. No `--update-env`. |
| **E7** | CM `:4002` health HTTP 200 `service":"container-manager"`. Gateway `:4000` ready HTTP 200. Other PM2 apps not restarted. |
| **E8** | Post-apply **`LIVE_LOCKED`**. Phase D entered. |
| **E9** | Vite project `preview-stop-staging-apply-01-vite-20260917-1107` projectId `a0ecad78-9a82-48f6-8b5c-ecd17d3e6f4a` sessionId `15ab323e-750e-49be-aa25-7939784dd717`. ZIP A `preview-stop-staging-apply-01-vite-20260917-1107.zip` (489 B; members `index.html`, `package.json` at archive root). Path `%TEMP%\preview-stop-staging-apply-01-20260917-1107\`. Ask/Build=0. Send=0. |
| **E10** | UI Start Preview clicked **once**. Status HTTP 200 `{"running":true,"status":"running","framework":"Vite","port":3001,...}`. Proxy HTML heading **`PREVIEW-STOP-STAGING-APPLY-01 Vite OK`** (`/@vite/client` present). iframe src `/api/preview/15ab323e-…/proxy?refresh=…`. Inspect: node pid **238** `vite --host 0.0.0.0 --port 3001`; listen `0.0.0.0:3001`; `/tmp/preview-3001.log`. |
| **E11** | Operator `POST /api/preview/{viteSessionId}/stop` on signed-in origin: HTTP **400**, `Content-Type: text/html; charset=utf-8`, empty body (with and without `X-CSRF-Token`; cookie **name** `aisandbox_csrf` present, value not recorded). After ~2s: `GET /status` HTTP 200 `{"running":false,"message":"No active preview for this session"}`. Inspect: pid 238 gone; **no** listen on `3001`–`3100`. CM `:4002` POST `/api/preview/{id}/stop` HTTP **200** `{"success":true,"message":"No active preview for this session"}`. Gateway `:4000` POST without cookie HTTP 401 JSON (not 400 HTML). Public HTTP 200 JSON body **not observed**. |
| **E12** | Same-session second Start Preview: status HTTP 200 Vite **port 3002** `running`. Marker **`PREVIEW-STOP-STAGING-APPLY-01 Vite OK`**. New pid **315** listen `0.0.0.0:3002`. Second POST `/stop`: again public HTTP 400 `text/html` empty; after ~2s status `running:false` / no active preview; process/port gone. |
| **E13** | Static project `preview-stop-staging-apply-01-static-20260917-1107` projectId `28c36e21-e0f3-4889-9dab-30621bd0a6ed` sessionId `a7cd7eb4-801f-4244-aa9a-a4d2c7232652`. ZIP B `preview-stop-staging-apply-01-static-20260917-1107.zip` (272 B; `index.html` only). File tree `index.html` only (no `package.json`). Start Preview once: framework **`Static HTML`** port **3003**; marker **`PREVIEW-STOP-STAGING-APPLY-01 Static OK`**; no `/@vite/client`. Inspect: **NO_VITE_NODE**; no listen ports. Public POST `/stop` HTTP 400 `text/html` empty; status then `running:false` / no active preview. CM `:4002` POST HTTP 200 JSON success/no-active-preview. |
| **E14** | `POST /api/sessions/{id}/stop` HTTP 200 `{"message":"Session stopped successfully"}` for both sessions (Advanced-equivalent session Stop; Advanced drawer not reachable in 640px sidebar). Both `sandbox-session-*` containers **gone**. Projects **retained**. Gate LEFT ON (`.env` not read/edited). CM remains pid `963390` on LIVE_LOCKED dist. Dist backup kept under `/tmp/` until Step 4. Helper scripts removed; health/pre-head/pre-pid/stamp files kept. |
| **E15** | Public HTTP 200 stop body **FAIL** after confirmed `LIVE_LOCKED`. Process/port/map **did** clear. No `preview.service.ts` / `preview.controller.ts` edit. No Gateway/frontend/AI/watchdog restart. No `.env`. No PM2 overlay. No provider/credit/Ask/Build. EXEC-01C6A not reopened. Rollback **not** performed (health PASS). |

### Runtime commands used

- SSH/SCP `aisandbox-staging` (BatchMode)
- Frozen A1–A3 git/pm2/fingerprint greps
- Dist backup; `git fetch` + `git pull --ff-only`; `npm run build` in container-manager only; `pm2 restart aisandbox-container-manager` only
- `curl` CM `:4002/api/health` and Gateway `:4000/api/health/ready`; CM POST `/api/preview/{id}/stop`
- Browser on `https://staging.ainow.biz/en/app`: New Project; History Import; Start Preview; operator POST `/stop`; session Stop
- `docker exec sandbox-session-{id}` process/port inspect (SSH fallback authorized)

**Not used:** `git reset` / stash / force; `--update-env`; Gateway/frontend/AI/watchdog restart; Docker/Postgres/Redis compose; Ask/Build/Send; provider/credit; `.env` read/edit; local Git commit/push; sidecar write.

### Cleanup confirmation

- Both proof session containers gone. Named disposable projects retained.
- Gate LEFT ON. CM remains online on surviving `LIVE_LOCKED` dist. Dist backup retained until Step 4.
- No `.env` restore (`.env` not edited). No Docker/Postgres/Redis. No Git commit/push.
- Local ZIPs remain under `%TEMP%\preview-stop-staging-apply-01-20260917-1107\` (not repo files).

**Activation effect:** staging `/opt/aisandbox` fast-forwarded to `185e819` and container-manager rebuilt/restarted onto locked PREVIEW-STOP-01 dist. Frontend/Gateway/AI/watchdog processes unchanged.
**Rollback boundary:** restore `/tmp/preview-stop-staging-apply-01-dist-20260917T030550Z` over `$CM_CWD/dist` and restart CM only if Step 4 later requires it. Do not invent a public `/stop` HTTP 400 source fix in this task.
**Follow-on:** Step 4 NOT AUTHORIZED. Do not admit a lane. Do not reopen EXEC-01C6A.

---
