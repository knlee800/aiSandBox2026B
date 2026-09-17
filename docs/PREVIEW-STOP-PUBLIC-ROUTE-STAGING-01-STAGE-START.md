# PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01 — Stage-start / live Gateway version check + apply/proof freeze

**Task ID:** PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01
**Title:** Apply and prove public preview stop route on staging
**Date:** 2026-09-17
**Nature:** IMPLEMENTATION / staging-ops — high-risk live version check plus possible staging apply of already-committed Gateway public stop JSON route (`0af3a17`), then live public-origin proof of POST `/api/preview/:sessionId/stop` HTTP 200 JSON
**Lifecycle:** 4-step IMPLEMENTATION
**Step:** 2 COMPLETE — freeze read-only live version check and apply/proof procedure (not executed)
**Step status:** Step 1 COMPLETE — 2026-09-17 (registration / control-plane only) — Step 2 COMPLETE — 2026-09-17 — Steps 3–4 NOT AUTHORIZED
**This document:** Authoritative Step 2 freeze for PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01. It does **not** authorize admission, Step 3 apply/proof, Step 4 lock, runtime, SSH, PM2, browser, Harness, orchestration, Stripe, apex cutover, invitations, EXEC-01C6A reopen, or follow-on registration.

**Parent:** PREVIEW-STOP-PUBLIC-ROUTE-01 REGISTERED / READY / NOT ADMITTED — Step 3 COMPLETE — committed `0af3a17bcbc556b42099404b4657f9814edab49a` (`fix: return json for preview stop route`) — LOCAL-TESTS 9/9 — not LOCKED — Stage-start: `docs/PREVIEW-STOP-PUBLIC-ROUTE-01-STAGE-START.md`
**Observed gap (must not rewrite):** `docs/PREVIEW-STOP-STAGING-APPLY-01-STAGE-START.md` §18 E11–E13 / E15 — public origin `POST /api/preview/{sessionId}/stop` HTTP 400 `text/html; charset=utf-8` empty body; CM `:4002` POST stop HTTP 200 JSON; process/port/map cleanup still happened. APPLY-01 remains REGISTERED / READY / NOT ADMITTED / not locked / partial pass and is **not** machine `dependsOn`.
**Hygiene precedent:** PREVIEW-NODE-STAGING-HYGIENE-01 COMPLETE AND LOCKED. Later Step 3 must STOP on a dirty remote worktree.
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
WRITE_PATHS=[]
CANDIDATE_STATUS=READY
ADMISSION_UNCERTAIN=true
TEST_ADMISSIBLE=ADMISSION_UNCERTAIN
APPLICATION_SOURCE=NONE
PREVIEW_CONTROLLER_TS_EDIT=FORBIDDEN_THIS_TASK
PREVIEW_ENDPOINT_CONTRACT_SPEC_EDIT=FORBIDDEN_THIS_TASK
FRONTEND_STOP_BUTTON=FORBIDDEN_THIS_TASK
CONTAINER_MANAGER_REWRITE=FORBIDDEN_THIS_TASK
ASK_BUILD=NO
PROVIDER_LIVE=NO
CREDIT=NO
LOCAL_RUNTIME=NO
MUTEXES_DECLARED=GATEWAY,STAGING
MUTEXES_ACQUIRED=NO
STAGING_AUTHORIZED=NO
STAGING_EXECUTION_AUTHORIZED=NO
SSH_USED=NO
AWS_USED=NO
PM2_RESTART=NO
APPLY=NO
GIT_PULL=NO
GATEWAY_BUILD=NO
EVIDENCE_CLASS=STAGING-RUNTIME
HOST=https://staging.ainow.biz
LIGHTSAIL=aisandbox-staging
STAGING_PATH=/opt/aisandbox
LOCKED_IMPLEMENTATION=0af3a17bcbc556b42099404b4657f9814edab49a
MINIMUM_APPLY_UNIT=aisandbox-api-gateway
PUBLIC_STOP_VERB=POST
DELETE_GATEWAY_STOP_ROUTE=FORBIDDEN
STOP_RESPONSE=HTTP_200_JSON
STOP_HTML_FORBIDDEN=YES
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
BROWSER=NO
GIT_COMMIT=NO
```

Keith authorized this Step 2 freeze only. Occupancy remains EMPTY. Sidecar candidate remains `status=READY` / `writeSetPrecision=EXACT` / `writePaths=[]` / `admissionUncertain=true` so the candidate is **not** in S (`Test-Admissible` = ADMISSION_UNCERTAIN) and is **not** locked. Do **not** admit Lane 1 or Lane 2. Do **not** start Step 3. Do **not** start Step 4. Do **not** register follow-on tasks. Do **not** reopen AGENT-PLATFORM-EXEC-01C6A. BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON. This freeze does **not** execute SSH, PM2, git pull, build, browser, or live proof.

---

## 1. Inherited product / architecture facts (must not reopen)

- `PRD.md` CURRENT includes integrated workspace preview, HTTP/WebSocket (HMR/dev servers), and predictable lifecycle behavior for sessions, workspaces, and previews.
- `ARCHITECTURE.md` §6 records preview strategy resolution, Gateway preview proxy to container-manager, and `node-dev-server` as CURRENT HOW.
- Locked PREVIEW-STOP-01 productized already-CURRENT CM stop (`PreviewService.stopPreview`; public POST `/api/preview/:sessionId/stop` with DELETE alias) with LOCAL-TESTS only. Implementation HEAD `79510ca`. This child does not rewrite CM stop semantics.
- PREVIEW-STOP-PUBLIC-ROUTE-01 Step 3 added the dedicated Gateway `POST :sessionId/stop` Nest JSON 200 handler (committed `0af3a17`; LOCAL-TESTS 9/9). Parent is not LOCKED. This child applies and live-proves that already-CURRENT public-route fix. It does not re-author Gateway source.
- PREVIEW-STOP-STAGING-APPLY-01 Step 3 proved process/port/map cleanup on staging after `LIVE_LOCKED` CM apply, and recorded the remaining public HTTP 200 JSON FAIL (HTTP 400 `text/html` empty). APPLY-01 is sequencing context, not machine `dependsOn`.
- Locked PREVIEW-NODE-01 / PREVIEW-NODE-STAGING-01 / PREVIEW-NODE-STAGING-APPLY-01 proved Vite start. Static Preview remains the baseline that must not regress.
- BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON.
- Working single-shot Builder Ask/Build remains the product to complete, not to replace. This proof must not use Ask/Build.
- Product-visible Harness / orchestration / Stripe / apex production routing remain FUTURE/gated.
- EXEC-01C6A remains `startCondition=NOT_READY` / not reopened.
- There is **no** UI Stop Preview button. Public stop remains operator `POST /api/preview/:sessionId/stop`.

This freeze does not rewrite `PRD.md` or `ARCHITECTURE.md`.

---

## 2. Source-grounded 0af3a17 fingerprints

Classification is of the **running** Gateway dist/script, not of git HEAD alone. Fingerprints are the committed PREVIEW-STOP-PUBLIC-ROUTE-01 behavior at `0af3a17bcbc556b42099404b4657f9814edab49a`.

Frozen-read this window (not written):

- `services/api-gateway/src/preview/preview.controller.ts`
- `services/api-gateway/src/preview/__tests__/preview.endpoint-contract.spec.ts`

### 2.1 Locked PREVIEW-STOP-PUBLIC-ROUTE-01 behavior (0af3a17-equivalent)

From `docs/PREVIEW-STOP-PUBLIC-ROUTE-01-STAGE-START.md` §3–§4 / §14 and the committed two-file write set:

| Surface | Locked fingerprint |
|---|---|
| Dedicated POST stop route | Gateway `PreviewController.stopPreview` is `@Post(':sessionId/stop')`, declared **before** `@All('*')` |
| JSON reconstruction | Stop handler returns Nest/Express JSON via `res.status(response.status).json(response.data)` (or compiled equivalent). **Forbidden:** `res.send` of parsed JSON under copied upstream headers; **forbidden:** `text/html` for this route |
| No hop-by-hop copy for stop | Stop axios call does **not** copy request/response hop-by-hop headers. Stop handler does **not** `Object.keys(response.headers).forEach(...)` / `res.setHeader` of upstream axios headers. Catch-all may still copy headers for start/status/proxy |
| No Gateway DELETE stop route | **No** Gateway `@Delete(':sessionId/stop')`. DELETE `/stop` remains catch-all forward only |
| Catch-all remains | `@All('*')` `proxyToContainerManager` stays for start / status / proxy (and DELETE `/stop` compatibility). `/proxy` stream branch unchanged |
| Public contract | HTTP **200** `application/json` with `success: true` and CM `message`: `Preview stopped successfully` or `No active preview for this session` as applicable |

Do **not** require a UI Stop Preview button. Do **not** remap POST→DELETE. Do **not** add a Gateway `@Delete` handler. Do **not** rewrite container-manager.

### 2.2 Pre-0af3a17 / APPLY-01 observed gap (must not be treated as current proof)

From `docs/PREVIEW-STOP-STAGING-APPLY-01-STAGE-START.md` §18:

- Operator `POST /api/preview/{sessionId}/stop` on signed-in origin `https://staging.ainow.biz`: HTTP **400**, `Content-Type: text/html; charset=utf-8`, **empty body**.
- After ~2s: process/port/map cleared; restart on the same session worked.
- Direct CM `POST :4002/api/preview/{id}/stop` HTTP **200** JSON.
- Gateway `:4000` POST without cookie HTTP **401 JSON** (not 400 HTML).
- Pre-0af3a17 Gateway had **no** dedicated stop handler; POST `/stop` rode `@All('*')` catch-all reconstruction (`sanitizeProxyHeaders` + copy all upstream headers + `res.send(parsed JSON)`).

### 2.3 Classification of the live running Gateway artifact

| Class | Meaning | Step 3 action |
|---|---|---|
| `LIVE_OLD` | Running Gateway dist/script missing one or more §2.1 fingerprints (especially dedicated POST stop before catch-all, `res.status(...).json(...)`, no hop-by-hop copy on stop, or a Gateway DELETE stop route is present) | Apply allowed after remaining stop-conditions pass, then prove |
| `LIVE_LOCKED` | Running Gateway dist/script contains **all** §2.1 fingerprints in §5 Phase A | **Skip apply.** Do not git update. Do not build. Do not PM2 restart. **Still proceed to proof** (Phase D). This task exists to prove public HTTP 200 JSON, not only to apply |
| `LIVE_UNKNOWN` | Cannot identify Gateway process, script path, cwd, or readable dist/source | **STOP.** Do not apply. Do not prove |

Source vs dist nuance (does not override the running-artifact class):

- Source locked + running dist old → `LIVE_OLD` (rebuild + restart Gateway only; no git update)
- Source old + running dist old → `LIVE_OLD` (git update of clean tree to a revision containing `0af3a17` or later, then api-gateway build + restart)
- Source locked + running dist locked → `LIVE_LOCKED`
- Dist/path unreadable → `LIVE_UNKNOWN`

---

## 3. Answers to the mandatory Step 2 questions

1. **Read-only live version check:** SSH to `aisandbox-staging` `/opt/aisandbox` as in §5 Phase A. Require clean remote `git status`. Record HEAD. Identify PM2 `aisandbox-api-gateway` path/cwd/script. Grep running Gateway dist then source for §2.1 fingerprints. Classify `LIVE_OLD` / `LIVE_LOCKED` / `LIVE_UNKNOWN`. No write, no restart, no `.env` edit in this phase.
2. **Apply if old:** Only if `LIVE_OLD` and remaining stop-conditions pass. Existing pattern only: optional clean-tree git update of `/opt/aisandbox` to a revision that contains `0af3a17` or later, then `npm run build` in `services/api-gateway` only, then `pm2 restart aisandbox-api-gateway` only (no `--update-env`). Health as in §5 Phase C. Success = Gateway ready HTTP 200 + CM health HTTP 200 + running Gateway dist now `LIVE_LOCKED`.
3. **No-apply if already locked:** `LIVE_LOCKED` → skip apply. Do not git update. Do not build. Do not PM2 restart. Do not edit `preview.controller.ts`. **Do not abort the task.** Continue to Phase D proof against the already-locked running Gateway dist.
4. **STOP if unknown / dirty / apply-health risk:** Dirty remote tree → `S_DIRTY_TREE`. Unprovable running path/dist → `S_UNKNOWN_PATH`. Build fail → `S_BUILD_FAIL` (no restart). Health fail after restart → `S_HEALTH_FAIL` and rollback previous Gateway dist backup + restart Gateway only.
5. **Gateway / CM / frontend source:** Forbidden for this entire task. Later apply uses committed PREVIEW-STOP-PUBLIC-ROUTE-01 fingerprints only (`0af3a17`). If public POST `/stop` still returns 400/`text/html` after a confirmed `LIVE_LOCKED` running Gateway dist, record FAIL and return to control plane. Do not invent a source fix.
6. **Vite public POST `/stop` + restart proof:** After running Gateway dist is `LIVE_LOCKED` (already, or after apply), prove on `https://staging.ainow.biz/en/app` with the disposable Vite ZIP fixture pattern from PREVIEW-STOP-STAGING-APPLY-01 / PREVIEW-NODE-STAGING-01: import, Start Preview once, marker loads, public `POST /api/preview/{sessionId}/stop` returns HTTP 200 `application/json` with `success: true` and the applicable message, Vite process/port gone, active preview cleared, Start Preview again on the same session, marker loads again, stop again with the same HTTP 200 JSON and cleanup.
7. **Static stop proof:** Separate disposable static fixture. Start Preview; marker loads; public POST `/stop` HTTP 200 JSON; no Vite/node process.
8. **Cleanup / rollback:** Gate LEFT ON. Build fail: no restart. Health fail after restart: restore previous Gateway dist backup and restart Gateway only. Public 400/`text/html` after `LIVE_LOCKED`: record FAIL; no source fix. Proof-session cleanup: Advanced session Stop as hard cleanup only. Retain named disposable projects. Do not `docker compose down`.
9. **Write set:** No application source. EXACT `writePaths=[]`. Step 2 writes this document plus board/registry/sidecar precision fields. Step 3/4 may append evidence/checkpoint docs only under GOVERNANCE.
10. **Mutexes:** GATEWAY + STAGING declared not acquired this window. GOVERNANCE held only for this freeze then released UNOWNED. CONTAINER-MANAGER undeclared (no CM rewrite; health-only read is allowed later without acquiring CONTAINER-MANAGER). FRONTEND / I18N / ENV / PROVIDER-LIVE / CREDIT / LOCAL-RUNTIME undeclared.

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
git -C /opt/aisandbox merge-base --is-ancestor 0af3a17bcbc556b42099404b4657f9814edab49a HEAD && echo ANCESTOR_0af3a17=YES || echo ANCESTOR_0af3a17=NO

# A2. Running Gateway process / script / dist path
pm2 describe aisandbox-api-gateway
pm2 jlist | python3 -c "import json,sys; procs=[p for p in json.load(sys.stdin) if p.get('name')=='aisandbox-api-gateway'];
assert len(procs)==1, 'GW_COUNT='+str(len(procs));
p=procs[0]; print('name', p.get('name')); print('pm_id', p.get('pm_id')); print('status', p.get('pm2_env',{}).get('status')); print('cwd', p.get('pm2_env',{}).get('pm_cwd')); print('exec', p.get('pm2_env',{}).get('pm_exec_path')); print('script', p.get('pm2_env',{}).get('pm_exec_path') or p.get('script')); print('pid', p.get('pid'))"
```

STOP (`S_UNKNOWN_PATH`) if any of:

- `aisandbox-api-gateway` count !== 1
- status is not `online`
- cwd is missing or not under `/opt/aisandbox/services/api-gateway`
- exec/script path is missing, not a file, or not under `/opt/aisandbox/services/api-gateway`
- exec/script is not a `dist/` artifact of that tree

STOP (`S_DIRTY_TREE`) if `git -C /opt/aisandbox status --short` is non-empty.

Then grep the **running** compiled Gateway preview controller next to the identified dist root (do not mutate). Try in order; STOP `S_UNKNOWN_PATH` if the controller dist file does not exist:

```text
$GW_CWD/dist/preview/preview.controller.js
$GW_CWD/dist/src/preview/preview.controller.js
```

```bash
# A3. Running Gateway dist fingerprints (adjust DIST_CTRL to the file that exists beside the identified dist root)
DIST_CTRL=<resolved-gateway-controller-js>
SRC_CTRL=/opt/aisandbox/services/api-gateway/src/preview/preview.controller.ts

# Quote-style fallback: if a NEED with single quotes misses, retry the same NEED with double quotes.
# Compiled Nest decorator emit is also accepted: (0, common_1.Post)(':sessionId/stop')
# HIT if any accepted form matches.

echo "=== GATEWAY CONTROLLER DIST ==="
for NEED in \
  "Post(':sessionId/stop')" \
  "(0, common_1.Post)(':sessionId/stop')" \
  'res.status(response.status).json(response.data)' \
  'stopPreview' \
  "All('*')" \
  "(0, common_1.All)('*')"
 do
  echo "DIST_CTRL_NEED=$NEED"
  grep -F "$NEED" "$DIST_CTRL" >/dev/null && echo DIST_CTRL_HIT=YES || echo DIST_CTRL_HIT=NO
done

echo "=== GATEWAY DELETE STOP MUST BE ABSENT ==="
for FORBID in \
  "Delete(':sessionId/stop')" \
  "(0, common_1.Delete)(':sessionId/stop')"
 do
  echo "DIST_CTRL_FORBID=$FORBID"
  grep -F "$FORBID" "$DIST_CTRL" >/dev/null && echo DIST_CTRL_DELETE_PRESENT=YES || echo DIST_CTRL_DELETE_PRESENT=NO
done

python3 - "$DIST_CTRL" <<'PY'
import pathlib, re, sys
p = pathlib.Path(sys.argv[1])
text = p.read_text(encoding='utf-8', errors='replace')
i1 = text.find('stopPreview')
i2 = text.find('proxyToContainerManager')
print('STOP_BEFORE_CATCHALL', 'YES' if 0 <= i1 < i2 else 'NO')
m = re.search(r'async stopPreview\s*\([^)]*\)\s*\{', text)
body_hit_json = 'NO'
body_hop = 'UNKNOWN'
if m:
    start = m.end()
    depth = 1
    i = start
    while i < len(text) and depth:
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
        i += 1
    body = text[start:i]
    body_hit_json = 'YES' if 'res.status(response.status).json(response.data)' in body or '.json(response.data)' in body else 'NO'
    hop = ('Object.keys(response.headers)' in body) or ('res.setHeader' in body)
    body_hop = 'YES' if hop else 'NO'
    print('STOP_BODY_EXTRACTED YES')
else:
    print('STOP_BODY_EXTRACTED NO')
print('STOP_BODY_JSON', body_hit_json)
print('STOP_BODY_HOP_BY_HOP', body_hop)
PY

echo "SRC_CTRL_EXISTS=$([ -f "$SRC_CTRL" ] && echo YES || echo NO)"
if [ -f "$SRC_CTRL" ]; then
  for NEED in \
    "@Post(':sessionId/stop')" \
    'res.status(response.status).json(response.data)' \
    'async stopPreview'
   do
    echo "SRC_CTRL_NEED=$NEED"
    grep -F "$NEED" "$SRC_CTRL" >/dev/null && echo SRC_CTRL_HIT=YES || echo SRC_CTRL_HIT=NO
  done
  for FORBID in \
    "@Delete(':sessionId/stop')"
   do
    echo "SRC_CTRL_FORBID=$FORBID"
    grep -F "$FORBID" "$SRC_CTRL" >/dev/null && echo SRC_CTRL_DELETE_PRESENT=YES || echo SRC_CTRL_DELETE_PRESENT=NO
  done
fi
```

`LIVE_LOCKED` requires **all** of:

- Dedicated POST stop HIT=YES (either `Post(':sessionId/stop')` or compiled `(0, common_1.Post)(':sessionId/stop')`)
- `STOP_BEFORE_CATCHALL=YES`
- `STOP_BODY_EXTRACTED=YES` and `STOP_BODY_JSON=YES`
- `STOP_BODY_HOP_BY_HOP=NO`
- Gateway DELETE stop `DIST_CTRL_DELETE_PRESENT=NO` for both forbid forms
- Catch-all remains HIT=YES (either `All('*')` or compiled `(0, common_1.All)('*')`)

Any required dist HIT=NO, hop-by-hop YES, DELETE present, or stop-not-before-catch-all → `LIVE_OLD` (unless files were unreadable, which is `LIVE_UNKNOWN`). Source HITs are recorded to decide whether Phase B needs git update; they do not override the running-artifact class.

Classify using §2.3. Record `LIVE_*`, `ANCESTOR_0af3a17`, HEAD, cwd, exec/script, dist path, and each HIT/NO.

- `LIVE_UNKNOWN` → STOP (`S_UNKNOWN_PATH`)
- Dirty tree already stopped above (`S_DIRTY_TREE`)
- `LIVE_LOCKED` → skip Phase B/C apply; do a read-only Gateway `:4000` ready + CM `:4002` health check; if either is not HTTP 200, STOP `S_HEALTH_FAIL` with **no** mutation; otherwise continue to Phase D
- `LIVE_OLD` → continue to Phase B

Do **not** `pm2 restart`. Do **not** `npm run build`. Do **not** `git pull`. Do **not** edit `.env`. Do **not** touch frontend / AI service / watchdog / container-manager / Docker / Postgres / Redis.

### Phase B — Apply committed Gateway code only if `LIVE_OLD`

Capture rollback handles **before** any write:

```bash
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
GW_CWD=<from Phase A>
GW_PID=<from Phase A>
DIST_DIR="$GW_CWD/dist"
cp -a "$DIST_DIR" "/tmp/preview-stop-public-route-staging-01-dist-$STAMP"
git -C /opt/aisandbox rev-parse HEAD > /tmp/preview-stop-public-route-staging-01-pre-head-$STAMP.txt
echo "$GW_PID" > /tmp/preview-stop-public-route-staging-01-pre-pid-$STAMP.txt
```

**B1. Git update only if source is old and the remote worktree is still clean.**

If Phase A source already has all §2.1 fingerprints: skip git; go to B2.

If source is old:

```bash
git -C /opt/aisandbox status --short   # must still be empty
git -C /opt/aisandbox fetch origin
git -C /opt/aisandbox merge-base --is-ancestor 0af3a17bcbc556b42099404b4657f9814edab49a FETCH_HEAD && echo FETCH_HAS_0af3a17=YES || echo FETCH_HAS_0af3a17=NO
```

STOP (`S_UNKNOWN_PATH` / abort apply) if `FETCH_HAS_0af3a17=NO`.
STOP (`S_DIRTY_TREE`) if status became dirty.
Do **not** `git reset --hard`. Do **not** stash. Do **not** force-push. Do **not** create branches. Do **not** switch branches.

If the current branch is clean and FETCH_HEAD contains `0af3a17`, update using the established pull/merge of that already-checked-out branch (current main containing `0af3a17` or later):

```bash
git -C /opt/aisandbox pull --ff-only
git -C /opt/aisandbox rev-parse HEAD
git -C /opt/aisandbox merge-base --is-ancestor 0af3a17bcbc556b42099404b4657f9814edab49a HEAD && echo ANCESTOR_0af3a17=YES || echo ANCESTOR_0af3a17=NO
```

STOP (`S_FF_FAIL`) if `--ff-only` fails (conflicts / non-ff). Leave the previous Gateway process running.

Confirm source now contains §2.1 fingerprints before building.

**B2. Build only api-gateway.**

```bash
cd /opt/aisandbox/services/api-gateway && npm run build
```

STOP (`S_BUILD_FAIL`) if build exits non-zero. Do **not** restart PM2. Previous `dist/` remains what PM2 is serving until a successful build + restart.

Re-grep the new Gateway dist file for §2.1 fingerprints. STOP (`S_BUILD_FAIL`) if the new dist is still missing locked fingerprints.

**B3. Restart only `aisandbox-api-gateway`.**

```bash
pm2 restart aisandbox-api-gateway
```

Do **not** `pm2 restart all`. Do **not** restart `aisandbox-frontend`, `aisandbox-ai-service`, `aisandbox-container-manager`, or `aisandbox-ops-watchdog`. Do **not** `--update-env` (this apply is dist/code, not `.env`). Do **not** edit `.env`.

### Phase C — Health after apply

Only after Phase B. Skip apply-health restart checks when Phase A classified `LIVE_LOCKED` (Phase A already did the read-only health check).

```bash
pm2 describe aisandbox-api-gateway
curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/api/health/ready
# Re-identify exec/script; re-grep DIST_CTRL for §2.1; must now classify LIVE_LOCKED
curl -sS -o /tmp/preview-stop-public-route-staging-01-cm-health.json -w '%{http_code}' http://127.0.0.1:4002/api/health
cat /tmp/preview-stop-public-route-staging-01-cm-health.json
```

PASS only if **all** are true:

- `aisandbox-api-gateway` status `online`
- Gateway ready HTTP 200 on `:4000`
- Running Gateway dist now `LIVE_LOCKED`
- CM health HTTP 200 with `service":"container-manager"` (or established `status":"ok"` body) on `:4002` (read-only; **do not** restart container-manager if this fails — STOP `S_HEALTH_FAIL` and roll back Gateway only)

STOP (`S_HEALTH_FAIL`) otherwise. Execute §7 rollback. Do not start the browser proof.

### Phase D — Live public-route proof (Vite + static)

Enter Phase D only when running Gateway dist is `LIVE_LOCKED` (Phase A skip-apply, or Phase C after apply). Host `https://staging.ainow.biz/en/app` only. **No Ask/Build/Send.** No provider/credit.

Reuse the frozen ZIP-import fixture pattern from `docs/PREVIEW-STOP-STAGING-APPLY-01-STAGE-START.md` §5 Phase D / `docs/PREVIEW-NODE-STAGING-01-STAGE-START.md` §5, with **new timestamps** and this task's marker text. Existing APPLY-01 ZIP **contents** may be copied and re-stamped. Do **not** reuse prior APPLY-01 / STAGING-01 project/session IDs as the proof subject.

**D0. Preflight (read-only).** Browser: `https://staging.ainow.biz/en` → Continue to Workspace or Sign in → `https://staging.ainow.biz/en/app`. Confirm HTTPS lock. No `localhost`. No apex. Confirm chat is not used. STOP if signed-out, wrong host, or any 5xx on `/en/app`.

**D1. Local ZIP fixtures (operator workstation).** Create two tiny ZIPs with Windows Explorer “Compress to ZIP” or PowerShell `Compress-Archive` so entries sit at archive root. No `__MACOSX`, no nested folder, no `node_modules`, no `.git`, no secrets. Each ZIP well under 5 MB.

ZIP A filename: `preview-stop-public-route-staging-01-vite-YYYYMMDD-HHMM.zip`

`package.json`:

```json
{
  "name": "preview-stop-public-route-staging-01-vite-fixture",
  "private": true,
  "scripts": {
    "dev": "vite"
  },
  "devDependencies": {
    "vite": "5.4.11"
  }
}
```

`index.html` heading marker: **`PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01 Vite OK`**. No `vite.config.js`. No lockfile.

ZIP B filename: `preview-stop-public-route-staging-01-static-YYYYMMDD-HHMM.zip` — only `index.html`, heading marker **`PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01 Static OK`**.

**D2. Disposable projects.** Create two new projects (do not reuse prior E2E / STAGING-01 / APPLY-01 experiments):

- Vite: `preview-stop-public-route-staging-01-vite-YYYYMMDD-HHMM`
- Static: `preview-stop-public-route-staging-01-static-YYYYMMDD-HHMM`

Create via `workspace-projects-new-project-button` / `workspace-projects-create-confirm-button`. Wait for empty file tree.

**D3. Import Vite fixture (no Ask/Build).** History → Import Project → ZIP A only. Open `index.html` and confirm the Vite marker text. Do not Ask/Build. Do not editor-Save to invent files.

**D4. Start Preview once (Vite).** Click `workspace-preview-start` once. No request body. Wait for iframe `workspace-preview-iframe` to show **`PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01 Vite OK`**. Expected start JSON: `status: "running"`, `framework: "Vite"`, `port` in `3001`–`3100`. STOP (`S_VITE_START_FAIL`) if start 400 / timeout / `unavailable` / marker miss after 180s.

**D5. Inspect process/port (Vite session still open).** Workspace exec preferred; SSH fallback only if later authorized:

```bash
docker ps --format '{{.Names}} {{.Status}}' | grep sandbox-session-
docker exec sandbox-session-{viteSessionId} sh -c 'ps aux; ls /tmp/preview-*.log 2>/dev/null; ss -lntp || netstat -lntp'
```

Record pid and listen port in `3001`–`3100`. PASS this step only if a Vite/node process exists and the allocated port listens.

**D6. Public POST stop (Vite).** No Stop Preview button. In DevTools console on `staging.ainow.biz` (same signed-in origin):

```javascript
fetch(`/api/preview/${viteSessionId}/stop`, { method: 'POST', credentials: 'include' })
  .then(async r => ({
    status: r.status,
    contentType: r.headers.get('content-type'),
    body: await r.json().catch(() => null),
    text: null
  }))
```

PASS stop:

- HTTP **200**
- `Content-Type` matches `application/json` (charset optional). **Forbidden:** `text/html`
- body includes `success: true` and `message: 'Preview stopped successfully'` (or `No active preview for this session` only if inspect already showed no process — that is not this Vite path)
- `GET /api/preview/{viteSessionId}/status` → `running: false` / `'No active preview for this session'` (map cleared)
- Re-run D5 inspect: captured pid dead; **no** listen on `3001`–`3100`

FAIL (`S_PUBLIC_STOP_FAIL`) if HTTP 400/404/5xx, `text/html`, empty/non-JSON body, `net::ERR_ABORTED`, process still alive, port still listening, or status still `running`/`starting`. If running Gateway dist was confirmed `LIVE_LOCKED`, record FAIL and **do not invent a source fix**. Session Stop is hard cleanup only (§7); it does not convert this FAIL into PASS.

**D7. Restart on the same session.** Click Start Preview once again on the **same** Vite session. Confirm the Vite marker loads again and a process/port exists (new pid and a port in `3001`–`3100` are allowed). STOP (`S_VITE_RESTART_FAIL`) if start fails, marker misses, or no process/port.

**D8. Stop again and confirm cleanup.** Repeat D6 public POST `/stop`. Confirm HTTP 200 JSON, process gone, `3001`–`3100` gone, status/map cleared.

**D9. Static fixture.** Open the static disposable project. Import ZIP B only. Confirm file tree is only `index.html` (no `package.json`). Click Start Preview once. Confirm marker **`PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01 Static OK`**. Confirm no Vite/node process for this session. Then:

```javascript
fetch(`/api/preview/${staticSessionId}/stop`, { method: 'POST', credentials: 'include' })
  .then(async r => ({
    status: r.status,
    contentType: r.headers.get('content-type'),
    body: await r.json().catch(() => null)
  }))
```

PASS static stop: HTTP 200 `application/json`; `success: true` with `Preview stopped successfully` or `No active preview for this session` as applicable; no Vite/node process created or left. FAIL (`S_STATIC_STOP_FAIL`) if stop is 400/`text/html`, a Vite/node process appears, or static preview was mis-detected as Vite.

### Phase E — Cleanup (always)

- `POST /api/preview/{sessionId}/stop` if a preview is still mapped (harmless if already cleared).
- Advanced **Stop** both disposable sessions (`workspace-advanced-stop-session`) as hard cleanup. If the Advanced drawer is unreachable, `POST /api/sessions/{id}/stop` is the established equivalent (APPLY-01 E14).
- Confirm both containers are gone (`docker ps` fallback only if SSH authorized).
- Retain the named disposable projects. Do **not** call a project-delete endpoint unless Step 3 later proves that endpoint is already safe/current. Default: retain.
- Leave `GLOBAL_EXECUTION_ENABLED` / Builder live gate ON.
- Leave Gateway online on the surviving dist (new if apply PASS; restored if rollback; untouched if `LIVE_LOCKED` skip-apply).
- Remove `/tmp/preview-stop-public-route-staging-01-*` copies only after Step 3 evidence is recorded, or keep them until Step 4.
- No `.env` restore (this task must not have edited `.env`).
- Local ZIP files may be deleted from the operator workstation; they are not repo files.
- Do not `pm2 restart` during cleanup. Do not invite. Do not touch EXEC-01C6A artifacts. Do not restart container-manager / frontend / AI / watchdog.

---

## 6. Frozen stop conditions

| ID | Trigger | Mutation after trigger |
|---|---|---|
| `S_UNKNOWN_PATH` | Gateway process count !== 1, not `online`, cwd/script missing, script not under `/opt/aisandbox/services/api-gateway/dist`, or fingerprint files unreadable | None |
| `S_DIRTY_TREE` | `git -C /opt/aisandbox status --short` non-empty at Phase A or before git update | None |
| `S_BUILD_FAIL` | `npm run build` non-zero, or new Gateway dist still missing §2.1 fingerprints | No PM2 restart. Previous process keeps old dist |
| `S_HEALTH_FAIL` | After restart: Gateway not online, Gateway ready not 200, running dist not `LIVE_LOCKED`, or CM health not 200. Also: skip-apply `LIVE_LOCKED` read-only health not 200 | Rollback Gateway dist + restart Gateway only (§7). Skip-apply: no mutation |
| `S_FF_FAIL` | `git pull --ff-only` fails | No build, no restart |
| `S_SIGNED_OUT` | Phase D not signed in on `https://staging.ainow.biz/en/app` | None (no apply if not yet applied; cleanup any created projects/sessions) |
| `S_WRONG_HOST` | Apex / localhost / non-staging host | None |
| `S_ASK_BUILD` | Ask/Build/Send used | Stop proof; session Stop cleanup only |
| `S_VITE_START_FAIL` | Vite Start Preview 400 / timeout / `unavailable` / marker miss after 180s | Session Stop as hard cleanup |
| `S_PUBLIC_STOP_FAIL` | Public `POST /stop` is not HTTP 200 `application/json` with `success: true` and the applicable message, or process/port/map not cleared, after running Gateway dist is `LIVE_LOCKED` | Record FAIL. Do not invent source fix. Session Stop as hard cleanup only |
| `S_VITE_RESTART_FAIL` | Second Start Preview on the same session does not load the marker or has no process/port | Session Stop as hard cleanup |
| `S_STATIC_STOP_FAIL` | Static preview missing, mis-detected as Vite, launches a process, or public POST `/stop` is not HTTP 200 JSON | Session Stop as hard cleanup |

`LIVE_LOCKED` is **not** a stop-id. It skips apply and continues to proof.

---

## 7. Cleanup / rollback criteria

| Event | Action |
|---|---|
| Phase A stop (`S_DIRTY_TREE` / `S_UNKNOWN_PATH`) | None. SSH session ends. Gate ON. No proof |
| Build fail | No restart. Previous process keeps serving old Gateway dist |
| Health fail after restart | Restore `/tmp/preview-stop-public-route-staging-01-dist-$STAMP` over `$GW_CWD/dist`, then `pm2 restart aisandbox-api-gateway` only (no `--update-env`). Re-check Gateway ready. Do not restart CM/frontend/AI/watchdog |
| Public route still 400/`text/html` after `LIVE_LOCKED` | Record FAIL. Do not edit source. Session Stop as hard cleanup only |
| Proof-session leak / failed stop | Advanced session Stop both disposable sessions. Retain projects. Gate ON |
| Successful proof | Session Stop both; retain projects; gate ON; Gateway remains on surviving `LIVE_LOCKED` dist |

Do not delete DB rows. Do not `docker compose down`. Do not restore-false the live gate.

---

## 8. Exact write set (EXACT)

| Path | This Step 2 | Later Step 3 | Later Step 4 |
|---|---|---|---|
| `docs/PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01-STAGE-START.md` | Created (this freeze) | Evidence append only | Checkpoint append / lock record |
| `TASKS.md` CURRENT EXECUTION BOARD fields | Yes | End-status only | End-status only |
| `TASKS_BACKLOG_FULL.md` PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01 body | Step 2 fields | Step 3 fields | Step 4 fields |
| `docs/control-plane/lane-saturation-state.json` | `writeSetPrecision=EXACT`; `writePaths=[]`; occupancy EMPTY; `admissionUncertain=true` | Occupancy only if a later admission changes it | Lock fields only if lock is authorized |
| `docs/control-plane/SATURATION_PROOF.json` | Validator output only | Validator output only | Validator output only |
| `services/api-gateway/src/preview/preview.controller.ts` | **No** | **No** | **No** |
| `services/api-gateway/src/preview/__tests__/preview.endpoint-contract.spec.ts` | **No** | **No** | **No** |
| Container-manager source | **No** | **No** | **No** |
| Frontend / i18n | **No** | **No** | **No** |
| `.env` | **No** | **No** | **No** |

Candidate `writePaths=[]`. Implementation write set is ops/procedure only. Staging git / Gateway `dist/` / PM2 mutation exists only as later Step 3 runtime, not as a repo write path.

---

## 9. Step 3 runtime / mutex needs (declared, not acquired this window)

| Need | Step 2 | Later Step 3 |
|---|---|---|
| Mutex GATEWAY | Declared, not acquired | Required for apply/build/restart ownership. Acquire only if Step 3 is authorized and apply proceeds past `LIVE_OLD` |
| Mutex STAGING | Declared, not acquired | Required for Lightsail staging host + browser proof. Acquire only if Step 3 is authorized |
| GOVERNANCE | Transient board/registry write then UNOWNED | Evidence/board write then UNOWNED |
| CONTAINER-MANAGER | **Undeclared** | Still undeclared. CM health is read-only. Do not rewrite or restart CM unless a later control-plane expansion says otherwise |
| SSH | Not used | Required for Phase A–C on `aisandbox-staging` |
| AWS | Not used | Only as needed for that Lightsail host access. No instance lifecycle |
| PM2 restart | No | **Only** `aisandbox-api-gateway` and **only** if `LIVE_OLD` apply proceeds (Phase B3). `LIVE_LOCKED` / dirty / unknown-path: no restart |
| LOCAL-RUNTIME | Undeclared | **No** |
| PROVIDER-LIVE | Undeclared | **No** |
| CREDIT | Undeclared | **No** |
| FRONTEND / I18N / ENV / PACKAGE / COMPOSE | Undeclared | **No** |
| Browser / signed-in operator | Not used | Required for Phase D |
| `stagingAuthorized` | `false` | `true` only if a later control-plane Step 3 authorization sets it. This freeze does not |

---

## 10. Out of scope (frozen)

- Application source edits (`preview.controller.ts`, endpoint-contract spec, CM files)
- Stop Preview button / frontend / i18n
- Container-manager rewrite or CM restart (health-only read is allowed)
- Ask/Build / Send / provider / credit
- EXEC-01C6A reopen or PM2 overlays
- `.env` / live-gate mutation (`GLOBAL_EXECUTION_ENABLED` stays ON)
- Stripe / orchestration / apex `ainow.biz` / invitations
- Next.js / CRA / Vue / Express preview productization
- Preview refresh behavior (distinct from stop/restart)
- Docker/Postgres/Redis / `docker compose down`
- Git commit/push / branch / worktree
- Registering named later children
- Locking PREVIEW-STOP-PUBLIC-ROUTE-01 or PREVIEW-STOP-STAGING-APPLY-01

---

## 11. Exact Step 3 evidence list (when later authorized)

| ID | Evidence |
|---|---|
| E1 | Remote `git status --short` empty; HEAD; `ANCESTOR_0af3a17` |
| E2 | Gateway pm_id, pid, status, cwd, exec/script |
| E3 | Dist path; each §2.1 HIT/NO including `STOP_BEFORE_CATCHALL`, `STOP_BODY_JSON`, `STOP_BODY_HOP_BY_HOP`, DELETE absent |
| E4 | Classification `LIVE_OLD` / `LIVE_LOCKED` / `LIVE_UNKNOWN` and which stop-id if stopped |
| E5 | Pre-HEAD, pre-PID, Gateway dist backup path; git update yes/no; post-HEAD |
| E6 | Build exit; post-build dist HIT; `pm2 restart aisandbox-api-gateway` yes/no (no `--update-env`) |
| E7 | Gateway `:4000` ready; CM `:4002` health; other PM2 apps untouched |
| E8 | Post-apply classification (must be `LIVE_LOCKED` to enter Phase D; skip-apply `LIVE_LOCKED` also enters Phase D) |
| E9 | Vite project name, projectId, sessionId; ZIP A filename; Ask/Build=0 |
| E10 | Vite Start Preview: marker visible; process/port inspect |
| E11 | Vite public `POST /stop` status + `Content-Type` + JSON body; follow-up GET `/status`; post-stop inspect (process gone, `3001`–`3100` gone, map cleared) |
| E12 | Same-session second Start Preview: marker + process/port; second public stop HTTP 200 JSON + cleanup |
| E13 | Static project: marker; no Vite/node process; public POST `/stop` HTTP 200 JSON |
| E14 | Cleanup: both sessions Stopped; projects retained; gate ON |
| E15 | Any stop-id, rollback performed, and FAIL-without-source-fix if public stop failed after `LIVE_LOCKED` |

Screenshots: Vite iframe marker (start + restart), static iframe marker. Do not capture cookies, CSRF tokens, or Authorization headers.

---

## 12. Invariants this freeze must not change

- Occupancy EMPTY. Not admitted. Lane 3 DISABLED.
- GOVERNANCE UNOWNED at end-state.
- GATEWAY + STAGING declared, not acquired.
- CONTAINER-MANAGER undeclared.
- `stagingAuthorized=false`. `STAGING_EXECUTION_AUTHORIZED=NO`.
- EXEC-01C6A `startCondition=NOT_READY` UNCHANGED / not reopened.
- BUILDER-LIVE-GATE-01 COMPLETE AND LOCKED / gate LEFT ON.
- PREVIEW-STOP-01 remains COMPLETE AND LOCKED (LOCAL-TESTS parent).
- PREVIEW-STOP-PUBLIC-ROUTE-01 remains REGISTERED / READY / NOT ADMITTED / Step 3 COMPLETE / not locked / committed `0af3a17`.
- PREVIEW-STOP-STAGING-APPLY-01 Step 3 partial-pass evidence is not rewritten.
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

- [x] Read-only live version-check fingerprints frozen against committed `0af3a17` Gateway stop-public-route behavior
- [x] Classification frozen: `LIVE_LOCKED` / `LIVE_OLD` / `LIVE_UNKNOWN`
- [x] STOP frozen for dirty tree, `LIVE_UNKNOWN`, and build/apply health risk
- [x] `LIVE_OLD` apply frozen: ff-only to a revision containing `0af3a17` or later; build `services/api-gateway` only; restart `aisandbox-api-gateway` only; no `--update-env`; no `.env` edit; no frontend/AI/container-manager/watchdog restart; verify Gateway ready `:4000` and CM health `:4002`; running Gateway dist becomes `LIVE_LOCKED`
- [x] `LIVE_LOCKED` skips apply and still proceeds to proof
- [x] Dedicated POST `:sessionId/stop` before catch-all; `res.status(...).json(...)`; no hop-by-hop copy for stop; no Gateway DELETE stop route
- [x] Vite public POST `/stop` HTTP 200 `application/json` with `success: true` and applicable message + process/port/map clear + same-session restart + second stop frozen
- [x] Static public POST stop frozen as HTTP 200 JSON / no Vite/node process
- [x] ZIP fixture pattern reused from APPLY-01 / PREVIEW-NODE-STAGING-01; Ask/Build forbidden
- [x] Rollback / FAIL-without-source-fix frozen (public 400/`text/html` after `LIVE_LOCKED` records FAIL; no invented source fix)
- [x] Out of scope confirmed (source, Stop Preview button, CM rewrite/restart unless health-only read, Ask/Build, provider/credit, EXEC-01C6A / PM2 overlays, `.env` / live gate, Stripe/orchestration/apex/invites)
- [x] EXACT `writePaths=[]`; `admissionUncertain=true`; occupancy EMPTY; GOVERNANCE UNOWNED
- [x] GATEWAY + STAGING declared, not acquired; `stagingAuthorized=false`
- [x] Steps 3–4 NOT AUTHORIZED; procedure not executed this window

---

## 16. Activity ledger (Step 2)

**Step 2 HEAD:** not queried this window (Keith instruction: no Git except validator + `git diff --check`)
**Step 2 activity ledger:** LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=0, application source=0, frontend=0, i18n=0, tests executed=0, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0, named other children registered=0, Stripe=0, credit mutation=0, follow-on registration=0. Governance writes: `docs/PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01-STAGE-START.md`; TASKS.md CURRENT EXECUTION BOARD fields; TASKS_BACKLOG_FULL.md PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01 body; sidecar candidate `writeSetPrecision=EXACT` (`writePaths=[]`; occupancy EMPTY / GOVERNANCE UNOWNED; `admissionUncertain=true`); SATURATION_PROOF.json only as validator output.

---

## 17. Authorization state (end of Step 2)

```
IMPLEMENTATION_AUTHORIZED=NO
ADMISSION_AUTHORIZED=NO
STAGING_AUTHORIZED=NO
STAGING_EXECUTION_AUTHORIZED=NO
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
STAGING_DECLARED=YES
STAGING_ACQUIRED=NO
CONTAINER_MANAGER_DECLARED=NO
FRONTEND_I18N=NO
STEP3_AUTHORIZED=NO
STEP4_AUTHORIZED=NO
LOCKED=NO
FOLLOW_ON_REGISTERED=NO
EXEC_01C6A_REOPENED=NO
CANDIDATE_STATUS=READY
ADMISSION_UNCERTAIN=true
WRITE_SET_PRECISION=EXACT
WRITE_PATHS=[]
BUILDER_LIVE_GATE_01=COMPLETE AND LOCKED / LEFT_ON
SSH=NO
PM2=NO
BROWSER=NO
GIT_COMMIT=NO
```

**Invitation invariant:** PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.

**Lane 3 invariant:** Lane 3 remains DISABLED.

**Activation effect:** NONE
**Rollback boundary:** Step 2 = discard this document’s freeze plus this window’s board/registry/sidecar write-set field updates. Ordinary Builder Ask/Build/static Preview path, locked PREVIEW-STOP-01 LOCAL-TESTS evidence, locked Vite start path, APPLY-01 Step 3 staging apply/proof, PUBLIC-ROUTE-01 committed `0af3a17` LOCAL-TESTS evidence, live gate, and credit UX are untouched.
