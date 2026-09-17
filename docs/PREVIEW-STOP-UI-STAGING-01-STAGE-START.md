# PREVIEW-STOP-UI-STAGING-01 — Stage-start / live frontend version check + apply/proof freeze

**Task ID:** PREVIEW-STOP-UI-STAGING-01
**Title:** Apply and prove Stop Preview button on staging
**Date:** 2026-09-17
**Nature:** IMPLEMENTATION / staging-ops — high-risk live version check plus possible staging apply of already-committed Stop Preview frontend (`e165ede`), then live workspace-UI proof that the Stop Preview button is visible and stops preview via already-CURRENT public POST `/api/preview/:sessionId/stop`
**Lifecycle:** 4-step IMPLEMENTATION
**Step:** 2 COMPLETE — stage-start / exact freeze
**Step status:** Step 1 COMPLETE — 2026-09-17 (registration / control-plane only; registered at `045fe3b0eaab5ecae986bffb0f91067cbea3947d` `docs: register preview stop ui staging`) — Step 2 COMPLETE — 2026-09-17 — Steps 3-4 NOT AUTHORIZED
**This document:** Authoritative Step 2 freeze of the exact staging apply/proof procedure. It does **not** authorize admission, runtime, SSH, PM2, browser, Harness, orchestration, Stripe, apex cutover, invitations, EXEC-01C6A reopen, PREVIEW-STOP-STAGING-APPLY-01 changes, or follow-on registration.

**Parents:** PREVIEW-STOP-UI-01 COMPLETE AND LOCKED — PASS — 2026-09-17 — Checkpoint: `docs/PREVIEW-STOP-UI-01-STAGE-START.md` — implementation `e165ede0b611210b98894066d516dc02f6071bc8` (`feat: add preview stop control`); lock `fbf00964772ebba319fe2e10bc284bcc834befac` (`docs: lock preview stop ui`); LOCAL-TESTS 466/466. PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01 COMPLETE AND LOCKED — Checkpoint: `docs/PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01-STAGE-START.md` — evidence `3c67e2d` (public-origin POST `/stop` HTTP 200 JSON; **no UI button**).
**Observed gap (must not rewrite):** Locked PREVIEW-STOP-UI-01 is LOCAL-TESTS only. Locked PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01 proved operator/DevTools public POST `/stop` HTTP 200 JSON and recorded **no UI Stop Preview button**. Remaining Builder blocker: user-visible Stop Preview from the workspace UI on staging.
**Hygiene precedent:** PREVIEW-NODE-STAGING-HYGIENE-01 COMPLETE AND LOCKED. Later Step 3 must STOP on a dirty remote worktree.
**Occupancy hash (end-state):** `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d` (Lane 1 EMPTY, Lane 2 EMPTY, GOVERNANCE UNOWNED)

```
STEP1_COMPLETE=YES
STEP2_COMPLETE=YES
STEP2_AUTHORIZED=YES
STEP3_AUTHORIZED=NO
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
FRONTEND_SOURCE_EDIT=FORBIDDEN_THIS_TASK
I18N_WRITE=FORBIDDEN_THIS_TASK
GATEWAY_REWRITE=FORBIDDEN_THIS_TASK
CONTAINER_MANAGER_REWRITE=FORBIDDEN_THIS_TASK
PREVIEW_STOP_STAGING_APPLY_01=UNCHANGED
ASK_BUILD=NO
PROVIDER_LIVE=NO
CREDIT=NO
LOCAL_RUNTIME=NO
MUTEXES_DECLARED=FRONTEND,STAGING
MUTEXES_ACQUIRED=NO
I18N_DECLARED=NO
GATEWAY_DECLARED=NO
CONTAINER_MANAGER_DECLARED=NO
STAGING_AUTHORIZED=NO
STAGING_EXECUTION_AUTHORIZED=NO
SSH_USED=NO
AWS_USED=NO
PM2_RESTART=NO
APPLY=NO
GIT_PULL=NO
FRONTEND_BUILD=NO
LIVE_CLASS=NOT_EXECUTED
EVIDENCE_CLASS=STAGING-RUNTIME
HOST=https://staging.ainow.biz
LIGHTSAIL=aisandbox-staging
STAGING_PATH=/opt/aisandbox
LOCKED_IMPLEMENTATION=e165ede0b611210b98894066d516dc02f6071bc8
LOCKED_UI_LOCK=fbf00964772ebba319fe2e10bc284bcc834befac
REGISTRATION=045fe3b0eaab5ecae986bffb0f91067cbea3947d
MINIMUM_APPLY_UNIT=aisandbox-frontend
PUBLIC_STOP_VERB=POST
PUBLIC_STOP_ROUTE=POST /api/preview/:sessionId/stop
PROOF_PATH=WORKSPACE_UI_BUTTON
DEVTOOLS_POST_AS_PROOF=FORBIDDEN
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

Keith authorized this Step 2 freeze only. Occupancy remains EMPTY. Sidecar candidate is `status=READY` / `writeSetPrecision=EXACT` / `writePaths=[]` / `admissionUncertain=true` so the candidate is **not** in S (`Test-Admissible` = ADMISSION_UNCERTAIN). Do **not** admit Lane 1 or Lane 2. Do **not** execute staging. Do **not** SSH / PM2 / browser. Do **not** register follow-on tasks. Do **not** reopen AGENT-PLATFORM-EXEC-01C6A. Do **not** lock or modify PREVIEW-STOP-STAGING-APPLY-01. BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON. Steps 3–4 remain NOT AUTHORIZED.

---

## 1. Inherited product / architecture facts (must not reopen)

- `PRD.md` CURRENT includes integrated workspace preview, HTTP/WebSocket (HMR/dev servers), and predictable lifecycle behavior for sessions, workspaces, and previews.
- `ARCHITECTURE.md` §6 records preview strategy resolution, Gateway preview proxy to container-manager, and `node-dev-server` as CURRENT HOW.
- Locked PREVIEW-STOP-01 productized already-CURRENT CM stop (`PreviewService.stopPreview`; public POST `/api/preview/:sessionId/stop` with DELETE alias) with LOCAL-TESTS. Freeze recorded **no Stop Preview button**.
- Locked PREVIEW-STOP-PUBLIC-ROUTE-01 added the dedicated Gateway `POST :sessionId/stop` Nest JSON 200 handler (committed `0af3a17`).
- Locked PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01 proved public-origin POST `/stop` HTTP 200 JSON on staging. Freeze recorded **no UI Stop Preview button**; public stop remained operator DevTools POST.
- Locked PREVIEW-STOP-UI-01 added the workspace Stop Preview button / frontend caller (committed `e165ede`; LOCAL-TESTS 466/466). Evidence class LOCAL-TESTS only; not yet live-proven on staging.
- Locked PREVIEW-NODE-01 / PREVIEW-NODE-STAGING-01 / PREVIEW-NODE-STAGING-APPLY-01 proved Vite start. Static Preview remains the baseline that must not regress.
- BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON.
- Working single-shot Builder Ask/Build remains the product to complete, not to replace. This proof must not use Ask/Build.
- Product-visible Harness / orchestration / Stripe / apex production routing remain FUTURE/gated.
- EXEC-01C6A remains `startCondition=NOT_READY` / not reopened.
- PREVIEW-STOP-STAGING-APPLY-01 remains REGISTERED / READY / NOT ADMITTED / Step 3 COMPLETE / Step 4 EVALUATED NOT LOCKED / not locked / partial pass. This freeze does not rewrite APPLY-01.

This freeze does not rewrite `PRD.md` or `ARCHITECTURE.md`.

---

## 2. Source-grounded e165ede fingerprints

Classification is of the **running** frontend `.next` bundle, not of git HEAD alone. Fingerprints are the committed PREVIEW-STOP-UI-01 behavior at `e165ede0b611210b98894066d516dc02f6071bc8` (or later, including lock `fbf0096` and registration `045fe3b`).

Frozen-read this window (not written):

- `frontend/components/workspace/workspace-shell.tsx` (`WorkspacePreviewPanel`)
- `frontend/components/workspace/workspace-shell.test.tsx`
- `frontend/messages/en.json` / `zh-TW.json` / `zh-CN.json`

### 2.1 Locked PREVIEW-STOP-UI-01 behavior (e165ede-equivalent)

From `docs/PREVIEW-STOP-UI-01-STAGE-START.md` §4–§5 and the committed five-file write set:

| Surface | Locked fingerprint |
|---|---|
| Stop button testid | `data-testid="workspace-preview-stop"` in `WorkspacePreviewPanel` |
| Stop error testid | `data-testid="workspace-preview-stop-error"` (shown only on failed stop) |
| Public stop caller | `POST /api/preview/${selectedSessionId}/stop` — `fetch(\`/api/preview/${props.selectedSessionId}/stop\`, { method: 'POST', })` — **no body**, no `Content-Type`, no CSRF, no DELETE, same-origin `fetch` like Start |
| Visibility | Render Stop only when `selectedSessionId` is set **and** (`previewState === 'loading'` OR `'ready'` OR `previewStopInFlight`) |
| Success | `response.ok` then existing `onRefreshPreview()` so Start Preview can run again. Do **not** require a specific JSON `message` string |
| i18n keys (already committed; **no write this task**) | `preview.stopPreview` / `preview.stopFailed` — en `Stop Preview` / `Failed to stop preview.`; zh-TW `停止預覽` / `無法停止預覽。`; zh-CN `停止预览` / `无法停止预览。` |
| Distinct from Advanced session Stop | `workspace-advanced-stop-session` / `POST /api/sessions/:id/stop` remains hard cleanup, not this proof |

Do **not** use DevTools `POST /api/preview/:sessionId/stop` as the proof path. That path is already locked by PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01. This child proves the **workspace button**.

### 2.2 Compiled / running frontend bundle fingerprints

Search the identified running frontend `.next` tree (server + client chunks; `.js` and `.json` only). Classification uses the **running** `.next`, not source HEAD.

**Required for `LIVE_LOCKED` (all three):**

1. `workspace-preview-stop` as a Stop-button testid, not solely as the substring of `workspace-preview-stop-error`. Frozen check: after removing every `workspace-preview-stop-error` occurrence, the remaining text still contains `workspace-preview-stop`.
2. `workspace-preview-stop-error`
3. POST preview-stop fetch, any accepted compiled equivalent in a file that also contains required testid (1), including:
   - `` `/api/preview/${props.selectedSessionId}/stop` ``
   - `` `/api/preview/${<ident>}/stop` ``
   - `"/api/preview/"+` … `+"/stop"` / `` `/api/preview/` `` concat `"/stop"`
   - `method: "POST"` / `method:'POST'` / `method:"POST"` in that same file

**Confirmatory (record HIT/NO; do not override required (1)–(3)):**

- keys `stopPreview` / `stopFailed`
- locale strings `Stop Preview` / `Failed to stop preview.` if present in built assets

Quote-style fallback applies (single vs double quotes). Minified concatenation is accepted for (3).

### 2.3 Classification of the live running frontend artifact

| Class | Meaning | Step 3 action |
|---|---|---|
| `LIVE_OLD` | Running `.next` missing one or more §2.2 required fingerprints | Apply allowed after remaining stop-conditions pass, then prove |
| `LIVE_LOCKED` | Running `.next` contains **all** §2.2 required fingerprints in Phase A | **Skip apply.** Do not git update. Do not build. Do not PM2 restart. **Still proceed to proof** (Phase D) |
| `LIVE_UNKNOWN` | Cannot identify frontend process, cwd, script/start path, or readable `.next` | **STOP.** Do not apply. Do not prove |

Source vs `.next` nuance (does not override the running-artifact class):

- Source locked + running `.next` old → `LIVE_OLD` (rebuild frontend only; no git update)
- Source old + running `.next` old → `LIVE_OLD` (git update of clean tree to a revision containing `e165ede` / `fbf0096` / `045fe3b` or later, then frontend build + restart)
- Source locked + running `.next` locked → `LIVE_LOCKED`
- `.next` / path unreadable → `LIVE_UNKNOWN`

Ancestor SHAs (any one at or after `e165ede` is sufficient for git-update eligibility):

| SHA | Role |
|---|---|
| `e165ede0b611210b98894066d516dc02f6071bc8` | Locked UI implementation (`feat: add preview stop control`) — **minimum** |
| `fbf00964772ebba319fe2e10bc284bcc834befac` | Locked UI checkpoint (`docs: lock preview stop ui`) |
| `045fe3b0eaab5ecae986bffb0f91067cbea3947d` | This child's registration (`docs: register preview stop ui staging`) |

---

## 3. Answers to the mandatory Step 2 questions

1. **Exact live version-check fingerprints against committed `e165ede`:** §2.2 required testids + compiled POST `/api/preview/${sessionId}/stop`. Confirmatory i18n strings recorded, not required to override (1)–(3). Classify `LIVE_OLD` / `LIVE_LOCKED` / `LIVE_UNKNOWN` from the running `.next`.
2. **Exact staging apply unit if `LIVE_OLD`:** Frontend-only. Clean-tree `git fetch` + `git pull --ff-only` to a revision containing `e165ede` / `fbf0096` / `045fe3b` or later **only if source is old**; then `npm run build` in `/opt/aisandbox/frontend` only; then `pm2 restart aisandbox-frontend` only. No `--update-env`. No `.env` edit. No Gateway / container-manager / AI-service / watchdog restart. Health: frontend `:3002` plus Gateway `:4000/api/health/ready` (Gateway is read-only).
3. **Exact workspace-UI Stop Preview proof:** Signed-in `https://staging.ainow.biz/en/app`. Disposable ZIP-import Vite + static fixtures. Start Preview → marker → **Stop Preview button visible** → **click the button** (not DevTools POST) → process/port/map gone → Start Preview available again → same-session restart if feasible → stop again. Static: marker + Stop visible + click succeeds / no Vite node process. Projects retained; sessions stopped.
4. **I18N write needed?** **No.** Locale keys already committed in `e165ede`. I18N remains undeclared. Do not edit `frontend/messages/*.json`.
5. **GATEWAY / CONTAINER-MANAGER remain undeclared:** **Yes.** No Gateway rewrite. No CM rewrite. Gateway ready is a read-only health check. CM process/port inspect in Phase D is read-only (workspace exec preferred; SSH fallback only if Step 3 later authorizes SSH).
6. **PREVIEW-STOP-STAGING-APPLY-01 remains unchanged / not locked:** **Yes.** This freeze does not alter APPLY-01 board, registry, stage-start, or sidecar.

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
| Public stop proof | **Workspace Stop Preview button** `workspace-preview-stop`. DevTools POST is **forbidden as the proof action**. Network-tab observation of the button's POST is allowed as evidence that the click issued `POST /api/preview/{sessionId}/stop` |

Do **not** create the projects, ZIPs, SSH, PM2, or run any of the procedure during Step 2.

### 4.1 Frozen live frontend apply path (established staging)

From PRIVATE-BETA 04D / 04J frontend deploy evidence and later staging PM2 names (not executed this window):

| Item | Freeze |
|---|---|
| PM2 app name | `aisandbox-frontend` (count must be exactly 1) |
| cwd | `/opt/aisandbox/frontend` |
| Start command (historical / expected) | `PORT=3002` + `npm start` → `next start` (PM2 `npm -- start`). Do **not** change the start command. Do **not** `--update-env` |
| Compiled artifact | `$FE_CWD/.next` (Next.js build). Not a Nest `dist/main.js` |
| Listen | `3002` (or the already-configured PM2 `PORT` if Phase A records a different listen port; do not mutate PORT) |
| Build | `cd /opt/aisandbox/frontend && npm run build` (`next build`) |
| Restart | `pm2 restart aisandbox-frontend` only |
| Frontend health | `GET http://127.0.0.1:3002` HTTP 200 / 307 / 308, and `GET http://127.0.0.1:3002/en/app` HTTP 200 (follow one redirect if needed) |
| Gateway health (read-only) | `GET http://127.0.0.1:4000/api/health/ready` HTTP 200 |
| Forbidden restarts | `aisandbox-api-gateway`, `aisandbox-container-manager`, `aisandbox-ai-service`, `aisandbox-ops-watchdog`, `pm2 restart all` |
| Forbidden | `npm install` (PACKAGE undeclared); `.env` edits; `--update-env` |

If `aisandbox-frontend` is missing: do **not** invent a second name. STOP `S_UNKNOWN_PATH`. Discovery of a unique PM2 process whose cwd is `/opt/aisandbox/frontend` may be **recorded** as evidence of mismatch, but it does not authorize restart under a different name.

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
git -C /opt/aisandbox merge-base --is-ancestor e165ede0b611210b98894066d516dc02f6071bc8 HEAD && echo ANCESTOR_e165ede=YES || echo ANCESTOR_e165ede=NO
git -C /opt/aisandbox merge-base --is-ancestor fbf00964772ebba319fe2e10bc284bcc834befac HEAD && echo ANCESTOR_fbf0096=YES || echo ANCESTOR_fbf0096=NO
git -C /opt/aisandbox merge-base --is-ancestor 045fe3b0eaab5ecae986bffb0f91067cbea3947d HEAD && echo ANCESTOR_045fe3b=YES || echo ANCESTOR_045fe3b=NO

# A2. Running frontend process / cwd / script
pm2 describe aisandbox-frontend
pm2 jlist | python3 -c "import json,sys; procs=[p for p in json.load(sys.stdin) if p.get('name')=='aisandbox-frontend'];
assert len(procs)==1, 'FE_COUNT='+str(len(procs));
p=procs[0]; env=p.get('pm2_env',{});
print('name', p.get('name')); print('pm_id', p.get('pm_id')); print('status', env.get('status')); print('cwd', env.get('pm_cwd')); print('exec', env.get('pm_exec_path')); print('script', env.get('pm_exec_path') or p.get('script')); print('args', env.get('args') or env.get('pm_exec_args')); print('pid', p.get('pid')); print('port_env', (env.get('PORT') or (env.get('env') or {}).get('PORT'))); print('restarts', env.get('restart_time'))"
```

STOP (`S_UNKNOWN_PATH`) if any of:

- `aisandbox-frontend` count !== 1
- status is not `online`
- cwd is missing or not `/opt/aisandbox/frontend` (or a realpath of that directory)
- exec/script path is missing or not a file
- `$FE_CWD/.next` is missing, not a directory, or unreadable

STOP (`S_DIRTY_TREE`) if `git -C /opt/aisandbox status --short` is non-empty.

Then grep the **running** compiled frontend `.next` (do not mutate):

```bash
# A3. Running frontend .next fingerprints
FE_CWD=<from Phase A>
NEXT_DIR="$FE_CWD/.next"
SRC_SHELL=/opt/aisandbox/frontend/components/workspace/workspace-shell.tsx
echo "NEXT_DIR=$NEXT_DIR"
test -d "$NEXT_DIR" && echo NEXT_DIR_EXISTS=YES || echo NEXT_DIR_EXISTS=NO

python3 - "$NEXT_DIR" <<'PY'
import pathlib, sys
root = pathlib.Path(sys.argv[1])
files = [p for p in root.rglob('*') if p.is_file() and p.suffix in {'.js', '.json'}]
req = {
    'TESTID_STOP': False,
    'TESTID_ERR': False,
    'FETCH_STOP': False,
}
conf = {
    'KEY_stopPreview': False,
    'KEY_stopFailed': False,
    'STR_Stop_Preview': False,
    'STR_Failed_to_stop': False,
}
fetch_needles = (
    '/api/preview/${props.selectedSessionId}/stop',
    '/api/preview/${',
)
for p in files:
    try:
        text = p.read_text(encoding='utf-8', errors='replace')
    except OSError:
        continue
    stripped = text.replace('workspace-preview-stop-error', '')
    if 'workspace-preview-stop' in stripped:
        req['TESTID_STOP'] = True
    if 'workspace-preview-stop-error' in text:
        req['TESTID_ERR'] = True
    has_preview = '/api/preview/' in text
    has_stop = '/stop' in text
    has_post = ('method:"POST"' in text) or ("method:'POST'" in text) or ('method: "POST"' in text) or ("method: 'POST'" in text)
    if has_preview and has_stop and has_post and ('workspace-preview-stop' in stripped):
        req['FETCH_STOP'] = True
    if 'stopPreview' in text:
        conf['KEY_stopPreview'] = True
    if 'stopFailed' in text:
        conf['KEY_stopFailed'] = True
    if 'Stop Preview' in text:
        conf['STR_Stop_Preview'] = True
    if 'Failed to stop preview.' in text:
        conf['STR_Failed_to_stop'] = True
print('FILES_SCANNED', len(files))
for k, v in req.items():
    print(k, 'YES' if v else 'NO')
for k, v in conf.items():
    print(k, 'YES' if v else 'NO')
print('LIVE_REQUIRED_ALL', 'YES' if all(req.values()) else 'NO')
PY

echo "SRC_SHELL_EXISTS=$([ -f "$SRC_SHELL" ] && echo YES || echo NO)"
if [ -f "$SRC_SHELL" ]; then
  for NEED in \
    'data-testid="workspace-preview-stop"' \
    'data-testid="workspace-preview-stop-error"' \
    '/api/preview/${props.selectedSessionId}/stop'
   do
    echo "SRC_SHELL_NEED=$NEED"
    grep -F "$NEED" "$SRC_SHELL" >/dev/null && echo SRC_SHELL_HIT=YES || echo SRC_SHELL_HIT=NO
  done
fi
```

`LIVE_LOCKED` requires **all** of:

- `TESTID_STOP=YES`
- `TESTID_ERR=YES`
- `FETCH_STOP=YES`
- `LIVE_REQUIRED_ALL=YES`

Any required HIT=NO → `LIVE_OLD` (unless `.next` / files were unreadable, which is `LIVE_UNKNOWN`). Source HITs are recorded to decide whether Phase B needs git update; they do not override the running-artifact class. Confirmatory i18n HIT/NO is recorded only.

Classify using §2.3. Record `LIVE_*`, `ANCESTOR_*`, HEAD, cwd, exec/script/args, PORT, `.next` path, and each HIT/NO.

- `LIVE_UNKNOWN` → STOP (`S_UNKNOWN_PATH`)
- Dirty tree already stopped above (`S_DIRTY_TREE`)
- `LIVE_LOCKED` → skip Phase B/C apply; do a read-only frontend `:3002` + Gateway `:4000/api/health/ready` check; if either is not an accepted success code, STOP `S_HEALTH_FAIL` with **no** mutation; otherwise continue to Phase D
- `LIVE_OLD` → continue to Phase B

Do **not** `pm2 restart`. Do **not** `npm run build`. Do **not** `git pull`. Do **not** edit `.env`. Do **not** touch Gateway / AI service / watchdog / container-manager / Docker / Postgres / Redis.

### Phase B — Apply committed frontend only if `LIVE_OLD`

Capture rollback handles **before** any write:

```bash
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
FE_CWD=<from Phase A>
FE_PID=<from Phase A>
NEXT_DIR="$FE_CWD/.next"
cp -a "$NEXT_DIR" "/tmp/preview-stop-ui-staging-01-next-$STAMP"
git -C /opt/aisandbox rev-parse HEAD > /tmp/preview-stop-ui-staging-01-pre-head-$STAMP.txt
echo "$FE_PID" > /tmp/preview-stop-ui-staging-01-pre-pid-$STAMP.txt
pm2 jlist | python3 -c "import json,sys
names=['aisandbox-api-gateway','aisandbox-container-manager','aisandbox-ai-service','aisandbox-frontend','aisandbox-ops-watchdog']
procs=json.load(sys.stdin)
for n in names:
    rows=[p for p in procs if p.get('name')==n]
    r=rows[0] if rows else {}
    print(n, 'count', len(rows), 'pid', r.get('pid'), 'restarts', (r.get('pm2_env') or {}).get('restart_time'))
" > /tmp/preview-stop-ui-staging-01-pre-pm2-$STAMP.txt
```

**B1. Git update only if source is old and the remote worktree is still clean.**

If Phase A source already has all three SRC_SHELL HIT=YES: skip git; go to B2.

If source is old:

```bash
git -C /opt/aisandbox status --short   # must still be empty
git -C /opt/aisandbox fetch origin
git -C /opt/aisandbox merge-base --is-ancestor e165ede0b611210b98894066d516dc02f6071bc8 FETCH_HEAD && echo FETCH_HAS_e165ede=YES || echo FETCH_HAS_e165ede=NO
```

STOP (`S_UNKNOWN_PATH` / abort apply) if `FETCH_HAS_e165ede=NO`.
STOP (`S_DIRTY_TREE`) if status became dirty.
Do **not** `git reset --hard`. Do **not** stash. Do **not** force-push. Do **not** create branches. Do **not** switch branches.

If the current branch is clean and FETCH_HEAD contains `e165ede`, update using the established pull of that already-checked-out branch (current main containing `e165ede` / `fbf0096` / `045fe3b` or later):

```bash
git -C /opt/aisandbox pull --ff-only
git -C /opt/aisandbox rev-parse HEAD
git -C /opt/aisandbox merge-base --is-ancestor e165ede0b611210b98894066d516dc02f6071bc8 HEAD && echo ANCESTOR_e165ede=YES || echo ANCESTOR_e165ede=NO
```

STOP (`S_FF_FAIL`) if `--ff-only` fails (conflicts / non-ff). Leave the previous frontend process running.

Confirm source now contains the three SRC_SHELL fingerprints before building.

**B2. Build only frontend.**

```bash
cd /opt/aisandbox/frontend && npm run build
```

Do **not** `npm install`. Do **not** build Gateway / container-manager / AI-service.

STOP (`S_BUILD_FAIL`) if build exits non-zero. Do **not** restart PM2. Previous `.next/` remains what PM2 is serving until a successful build + restart.

Re-run the Phase A3 scanner on the new `$FE_CWD/.next`. STOP (`S_BUILD_FAIL`) if the new `.next` is still missing required fingerprints.

**B3. Restart only `aisandbox-frontend`.**

```bash
pm2 restart aisandbox-frontend
```

Do **not** `pm2 restart all`. Do **not** restart `aisandbox-api-gateway`, `aisandbox-container-manager`, `aisandbox-ai-service`, or `aisandbox-ops-watchdog`. Do **not** `--update-env` (this apply is `.next`/code, not `.env`). Do **not** edit `.env`.

### Phase C — Health after apply

Only after Phase B. Skip apply-health restart checks when Phase A classified `LIVE_LOCKED` (Phase A already did the read-only health check).

```bash
pm2 describe aisandbox-frontend
curl -sS -o /dev/null -w 'frontend_root=%{http_code}\n' http://127.0.0.1:3002
curl -sS -o /dev/null -w 'frontend_en_app=%{http_code}\n' http://127.0.0.1:3002/en/app
# Re-identify exec/cwd; re-scan .next for §2.2; must now classify LIVE_LOCKED
curl -sS -o /dev/null -w 'gateway_ready=%{http_code}\n' http://127.0.0.1:4000/api/health/ready
# Confirm other PM2 apps untouched vs pre-pm2 snapshot (pids/restarts)
```

Accepted frontend_root: `200`, `307`, or `308`. Accepted frontend_en_app: `200` (one redirect follow is allowed if the first hop is 307/308 then 200). Accepted gateway_ready: `200`.

PASS only if **all** are true:

- `aisandbox-frontend` status `online`
- frontend health accepted as above
- running `.next` now `LIVE_LOCKED`
- Gateway ready HTTP 200 on `:4000` (read-only; **do not** restart Gateway if this fails)
- other named PM2 apps not restarted

STOP (`S_HEALTH_FAIL`) otherwise.

- If frontend is not online or frontend HTTP is not accepted or running `.next` is not `LIVE_LOCKED`: execute §7 rollback (restore `.next` backup + restart frontend only).
- If frontend is healthy and `LIVE_LOCKED` but Gateway ready is not 200: **do not** restart Gateway; **do not** rollback frontend (Gateway was not mutated); STOP and return to control plane.
- Skip-apply `LIVE_LOCKED` health fail: no mutation.

Do not start the browser proof after `S_HEALTH_FAIL`.

### Phase D — Live workspace-UI proof (Vite + static)

Enter Phase D only when running frontend `.next` is `LIVE_LOCKED` (Phase A skip-apply, or Phase C after apply). Host `https://staging.ainow.biz/en/app` only. **No Ask/Build/Send.** No provider/credit.

Reuse the frozen ZIP-import fixture pattern from `docs/PREVIEW-STOP-STAGING-APPLY-01-STAGE-START.md` §5 Phase D / `docs/PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01-STAGE-START.md` §5 Phase D / `docs/PREVIEW-NODE-STAGING-01-STAGE-START.md` §5, with **new timestamps** and this task's marker text. Existing APPLY-01 / PUBLIC-ROUTE ZIP **contents** may be copied and re-stamped. Do **not** reuse prior APPLY-01 / PUBLIC-ROUTE / STAGING-01 project/session IDs as the proof subject.

**This proof is the public button path, not DevTools POST.** Click `workspace-preview-stop`. Do **not** `fetch('/api/preview/.../stop')` in the console as the stop action. Network-tab observation of the click's POST is allowed as supporting evidence.

**D0. Preflight (read-only).** Browser: `https://staging.ainow.biz/en` → Continue to Workspace or Sign in → `https://staging.ainow.biz/en/app`. Confirm HTTPS lock. No `localhost`. No apex. Confirm chat is not used. STOP (`S_SIGNED_OUT` / `S_WRONG_HOST`) if signed-out, wrong host, or any 5xx on `/en/app`.

**D1. Local ZIP fixtures (operator workstation).** Create two tiny ZIPs with Windows Explorer “Compress to ZIP” or PowerShell `Compress-Archive` so entries sit at archive root. No `__MACOSX`, no nested folder, no `node_modules`, no `.git`, no secrets. Each ZIP well under 5 MB.

ZIP A filename: `preview-stop-ui-staging-01-vite-YYYYMMDD-HHMM.zip`

`package.json`:

```json
{
  "name": "preview-stop-ui-staging-01-vite-fixture",
  "private": true,
  "scripts": {
    "dev": "vite"
  },
  "devDependencies": {
    "vite": "5.4.11"
  }
}
```

`index.html` heading marker: **`PREVIEW-STOP-UI-STAGING-01 Vite OK`**. No `vite.config.js`. No lockfile.

ZIP B filename: `preview-stop-ui-staging-01-static-YYYYMMDD-HHMM.zip` — only `index.html`, heading marker **`PREVIEW-STOP-UI-STAGING-01 Static OK`**.

**D2. Disposable projects.** Create two new projects (do not reuse prior E2E / STAGING-01 / APPLY-01 / PUBLIC-ROUTE experiments):

- Vite: `preview-stop-ui-staging-01-vite-YYYYMMDD-HHMM`
- Static: `preview-stop-ui-staging-01-static-YYYYMMDD-HHMM`

Create via `workspace-projects-new-project-button` / `workspace-projects-create-confirm-button`. Wait for empty file tree.

**D3. Import Vite fixture (no Ask/Build).** History → Import Project → ZIP A only. Open `index.html` and confirm the Vite marker text. Do not Ask/Build. Do not editor-Save to invent files.

**D4. Start Preview once (Vite).** Click `workspace-preview-start` once. No request body. Wait for iframe `workspace-preview-iframe` to show **`PREVIEW-STOP-UI-STAGING-01 Vite OK`**. Expected start JSON: `status: "running"`, `framework: "Vite"`, `port` in `3001`–`3100`. STOP (`S_VITE_START_FAIL`) if start 400 / timeout / `unavailable` / marker miss after 180s.

**D5. Stop Preview button visible (Vite, before click).** With preview `loading` or `ready`, `workspace-preview-stop` **must be visible** in the preview toolbar (project-first preview section and/or Preview tab — either surface is sufficient if it is the visible panel). Label is locale `preview.stopPreview` (en: **Stop Preview**). STOP (`S_STOP_BUTTON_ABSENT`) if the button is absent after `LIVE_LOCKED` running `.next`. Do **not** invent a source fix. Do **not** substitute DevTools POST.

**D6. Inspect process/port (Vite session still open, before stop).** Workspace exec preferred; SSH fallback only if later authorized:

```bash
docker ps --format '{{.Names}} {{.Status}}' | grep sandbox-session-
docker exec sandbox-session-{viteSessionId} sh -c 'ps aux; ls /tmp/preview-*.log 2>/dev/null; ss -lntp || netstat -lntp'
```

Record pid and listen port in `3001`–`3100`. PASS this step only if a Vite/node process exists and the allocated port listens.

**D7. Click Stop Preview (Vite).** Click `workspace-preview-stop` **once**. Do not click Advanced session Stop. Optional Network evidence: the click issues `POST /api/preview/{viteSessionId}/stop` with empty body on the signed-in origin (HTTP 200 `application/json` expected from already-locked public route). PASS stop:

- Stop button click is the action (not console `fetch`)
- After the click: `GET /api/preview/{viteSessionId}/status` → `running: false` / `'No active preview for this session'` (map cleared), **or** equivalent UI: Start Preview enabled again (`workspace-preview-start` no longer disabled for this session) and iframe no longer showing the running Vite marker
- Re-run D6 inspect: captured pid dead; **no** listen on `3001`–`3100`
- `workspace-preview-stop` hidden once preview is `unavailable` (locked visibility). Start Preview available again

FAIL (`S_STOP_CLICK_FAIL`) if the button click does not stop preview (process still alive, port still listening, status still `running`/`starting`, Start Preview still disabled because preview remains ready/loading). If running `.next` was confirmed `LIVE_LOCKED`, record FAIL and **do not invent a source fix**. Session Stop is hard cleanup only (§7); it does not convert this FAIL into PASS.

A visible `workspace-preview-stop-error` after the click is `S_STOP_CLICK_FAIL` unless inspect already showed no process **and** status is already not running (do not treat a failed POST as PASS).

**D8. Restart on the same session if feasible.** Click Start Preview once again on the **same** Vite session. Confirm the Vite marker loads again, a process/port exists (new pid and a port in `3001`–`3100` are allowed), and Stop Preview is visible again. STOP (`S_VITE_RESTART_FAIL`) if start fails, marker misses, or no process/port. Then click Stop Preview again and confirm cleanup (same PASS rules as D7). If the same-session restart UI is not feasible after a successful D7 (record why), do **not** convert D7 PASS into FAIL solely for restart infeasibility; record `RESTART_FEASIBLE=NO` and continue to static. Default: restart **is** feasible because success refresh reuses `onRefreshPreview` to `unavailable`.

**D9. Static fixture.** Open the static disposable project. Import ZIP B only. Confirm file tree is only `index.html` (no `package.json`). Click Start Preview once. Confirm marker **`PREVIEW-STOP-UI-STAGING-01 Static OK`**. Confirm no Vite/node process for this session. Confirm `workspace-preview-stop` **visible**. Click the Stop Preview button (not DevTools POST). PASS static stop: Stop click succeeds; no Vite/node process created or left; Start Preview available again. FAIL (`S_STATIC_STOP_FAIL`) if Stop is absent, click fails, a Vite/node process appears, or static preview was mis-detected as Vite.

### Phase E — Cleanup (always)

- Click Stop Preview if a preview is still mapped, or `POST /api/preview/{sessionId}/stop` only as **cleanup** (not as the proof).
- Advanced **Stop** both disposable sessions (`workspace-advanced-stop-session`) as hard cleanup. If the Advanced drawer is unreachable, `POST /api/sessions/{id}/stop` is the established equivalent (APPLY-01 E14).
- Confirm both containers are gone (`docker ps` fallback only if SSH authorized).
- Retain the named disposable projects. Do **not** call a project-delete endpoint unless Step 3 later proves that endpoint is already safe/current. Default: retain.
- Leave `GLOBAL_EXECUTION_ENABLED` / Builder live gate ON.
- Leave frontend online on the surviving `.next` (new if apply PASS; restored if rollback; untouched if `LIVE_LOCKED` skip-apply).
- Remove `/tmp/preview-stop-ui-staging-01-*` copies only after Step 3 evidence is recorded, or keep them until Step 4.
- No `.env` restore (this task must not have edited `.env`).
- Local ZIP files may be deleted from the operator workstation; they are not repo files.
- Do not `pm2 restart` during cleanup. Do not invite. Do not touch EXEC-01C6A artifacts. Do not restart Gateway / container-manager / AI / watchdog.

---

## 6. Frozen stop conditions

| ID | Trigger | Mutation after trigger |
|---|---|---|
| `S_UNKNOWN_PATH` | Frontend process count !== 1, not `online`, cwd not `/opt/aisandbox/frontend`, script missing, `.next` missing/unreadable, or `aisandbox-frontend` name missing | None |
| `S_DIRTY_TREE` | `git -C /opt/aisandbox status --short` non-empty at Phase A or before git update | None |
| `S_BUILD_FAIL` | `npm run build` non-zero, or new `.next` still missing §2.2 required fingerprints | No PM2 restart. Previous process keeps old `.next` |
| `S_HEALTH_FAIL` | After restart: frontend not online, frontend HTTP not accepted, running `.next` not `LIVE_LOCKED`, or Gateway ready not 200. Also: skip-apply `LIVE_LOCKED` read-only health not accepted | Rollback frontend `.next` + restart frontend only when frontend itself is unhealthy (§7). Skip-apply: no mutation. Gateway-only fail after healthy frontend: no Gateway restart, no frontend rollback |
| `S_FF_FAIL` | `git pull --ff-only` fails | No build, no restart |
| `S_SIGNED_OUT` | Phase D not signed in on `https://staging.ainow.biz/en/app` | None (no apply if not yet applied; cleanup any created projects/sessions) |
| `S_WRONG_HOST` | Apex / localhost / non-staging host | None |
| `S_ASK_BUILD` | Ask/Build/Send used | Stop proof; session Stop cleanup only |
| `S_VITE_START_FAIL` | Vite Start Preview 400 / timeout / `unavailable` / marker miss after 180s | Session Stop as hard cleanup |
| `S_STOP_BUTTON_ABSENT` | `workspace-preview-stop` not visible after Start Preview once running `.next` is `LIVE_LOCKED` | Record FAIL. Do not invent source fix. Session Stop as hard cleanup only |
| `S_STOP_CLICK_FAIL` | Stop Preview button click does not stop preview (process/port/map not cleared, Start Preview not available again, or stop-error shown as the only outcome) after `LIVE_LOCKED` | Record FAIL. Do not invent source fix. Session Stop as hard cleanup only |
| `S_VITE_RESTART_FAIL` | Second Start Preview on the same session does not load the marker or has no process/port, when restart was feasible | Session Stop as hard cleanup |
| `S_STATIC_STOP_FAIL` | Static preview missing, mis-detected as Vite, launches a process, Stop button absent, or Stop click fails | Session Stop as hard cleanup |

`LIVE_LOCKED` is **not** a stop-id. It skips apply and continues to proof. `LIVE_UNKNOWN` maps to `S_UNKNOWN_PATH`.

---

## 7. Cleanup / rollback criteria

| Event | Action |
|---|---|
| Phase A stop (`S_DIRTY_TREE` / `S_UNKNOWN_PATH`) | None. SSH session ends. Gate ON. No proof |
| Build fail | No restart. Previous process keeps serving old frontend `.next` |
| Frontend health fail after restart (frontend not online / HTTP not accepted / `.next` not `LIVE_LOCKED`) | Restore `/tmp/preview-stop-ui-staging-01-next-$STAMP` over `$FE_CWD/.next` (`rm -rf "$FE_CWD/.next"` then `cp -a` backup), then `pm2 restart aisandbox-frontend` only (no `--update-env`). Re-check frontend health. Do not restart Gateway/CM/AI/watchdog |
| Gateway ready fail after healthy frontend apply | Record FAIL. Do not restart Gateway. Do not rollback frontend. Return to control plane |
| Stop button absent or click fails after `LIVE_LOCKED` | Record FAIL. Do not edit source. Session Stop as hard cleanup only |
| Proof-session leak / failed stop | Advanced session Stop both disposable sessions. Retain projects. Gate ON |
| Successful proof | Session Stop both; retain projects; gate ON; frontend remains on surviving `LIVE_LOCKED` `.next` |

Do not delete DB rows. Do not `docker compose down`. Do not restore-false the live gate. Do not invent a source fix from proof failure.

---

## 8. Exact write set (EXACT)

| Path | This Step 2 | Later Step 3 | Later Step 4 |
|---|---|---|---|
| `docs/PREVIEW-STOP-UI-STAGING-01-STAGE-START.md` | Created (this freeze) | Evidence append only | Checkpoint append / lock record |
| `TASKS.md` CURRENT EXECUTION BOARD fields | Yes | End-status only | End-status only |
| `TASKS_BACKLOG_FULL.md` PREVIEW-STOP-UI-STAGING-01 body | Step 2 fields | Step 3 fields | Step 4 fields |
| `docs/control-plane/lane-saturation-state.json` | `writeSetPrecision=EXACT`; `writePaths=[]`; occupancy EMPTY; `admissionUncertain=true`; `stagingAuthorized=false` | Occupancy / `stagingAuthorized` only if a later Step 3 authorization changes them | Lock fields only if lock is authorized |
| `docs/control-plane/SATURATION_PROOF.json` | Validator output only | Validator output only | Validator output only |
| `frontend/components/workspace/workspace-shell.tsx` | **No** | **No** | **No** |
| `frontend/components/workspace/workspace-shell.test.tsx` | **No** | **No** | **No** |
| `frontend/messages/*.json` | **No** | **No** | **No** |
| Gateway / container-manager source | **No** | **No** | **No** |
| PREVIEW-STOP-STAGING-APPLY-01 artifacts | **No** | **No** | **No** |
| `.env` | **No** | **No** | **No** |

Candidate `writePaths=[]`. Implementation write set is ops/procedure only. Staging git / frontend `.next` / PM2 mutation exists only as later Step 3 runtime, not as a repo write path.

---

## 9. Step 3 runtime / mutex needs (declared, not acquired this window)

| Need | Step 2 | Later Step 3 |
|---|---|---|
| Mutex FRONTEND | Declared, not acquired | Required for apply/build/restart ownership. Acquire only if Step 3 is authorized and apply proceeds past `LIVE_OLD` |
| Mutex STAGING | Declared, not acquired | Required for Lightsail staging host + browser proof. Acquire only if Step 3 is authorized |
| GOVERNANCE | Transient board/registry write then UNOWNED | Evidence/board write then UNOWNED |
| I18N | **Undeclared** (no locale write) | Still undeclared |
| GATEWAY | **Undeclared** | Still undeclared. Gateway ready is read-only. Do not rewrite or restart Gateway |
| CONTAINER-MANAGER | **Undeclared** | Still undeclared. Process/port inspect is read-only. Do not rewrite or restart CM |
| SSH | Not used | Required for Phase A–C on `aisandbox-staging` |
| AWS | Not used | Only as needed for that Lightsail host access. No instance lifecycle |
| PM2 restart | No | **Only** `aisandbox-frontend` and **only** if `LIVE_OLD` apply proceeds (Phase B3). `LIVE_LOCKED` / dirty / unknown-path: no restart. No `--update-env` |
| LOCAL-RUNTIME | Undeclared | **No** |
| PROVIDER-LIVE | Undeclared | **No** |
| CREDIT | Undeclared | **No** |
| ENV / PACKAGE / COMPOSE | Undeclared | **No** |
| Browser / signed-in operator | Not used | Required for Phase D |
| `stagingAuthorized` | `false` | `true` only if a later control-plane Step 3 authorization sets it. This freeze does not |

---

## 10. Out of scope (frozen)

- Application source edits (`workspace-shell.tsx`, tests, i18n JSON, Gateway, CM)
- Gateway rewrite or Gateway restart
- Container-manager rewrite or CM restart (inspect/health-only read is allowed)
- PREVIEW-STOP-STAGING-APPLY-01 board/registry/stage-start/sidecar changes
- Ask/Build / Send / provider / credit
- EXEC-01C6A reopen or PM2 overlays / Harness
- `.env` / live-gate mutation (`GLOBAL_EXECUTION_ENABLED` stays ON)
- `--update-env`
- Stripe / orchestration / apex `ainow.biz` / invitations
- Next.js / CRA / Vue / Express preview productization
- Preview refresh behavior (distinct from stop/restart)
- Docker/Postgres/Redis / `docker compose down`
- Git commit/push / branch / worktree
- Registering named later children
- Locking this task or locking PREVIEW-STOP-STAGING-APPLY-01
- Inventing a source fix from proof failure

---

## 11. Exact Step 3 evidence list (when later authorized)

| ID | Evidence |
|---|---|
| E1 | Remote `git status --short` empty; HEAD; `ANCESTOR_e165ede` / `ANCESTOR_fbf0096` / `ANCESTOR_045fe3b` |
| E2 | Frontend pm_id, pid, status, cwd, exec/script/args, PORT |
| E3 | `.next` path; each §2.2 required HIT/NO (`TESTID_STOP`, `TESTID_ERR`, `FETCH_STOP`) plus confirmatory i18n HIT/NO |
| E4 | Classification `LIVE_OLD` / `LIVE_LOCKED` / `LIVE_UNKNOWN` and which stop-id if stopped |
| E5 | Pre-HEAD, pre-PID, `.next` backup path; git update yes/no; post-HEAD |
| E6 | Build exit; post-build `.next` HIT; `pm2 restart aisandbox-frontend` yes/no (no `--update-env`) |
| E7 | Frontend `:3002` health; Gateway `:4000` ready; other PM2 apps untouched |
| E8 | Post-apply classification (must be `LIVE_LOCKED` to enter Phase D; skip-apply `LIVE_LOCKED` also enters Phase D) |
| E9 | Vite project name, projectId, sessionId; ZIP A filename; Ask/Build=0 |
| E10 | Vite Start Preview: marker visible; process/port inspect; **Stop Preview button visible** |
| E11 | Vite **button click** (not DevTools POST): process/port/map gone; Start Preview available again; optional Network POST 200 JSON |
| E12 | Same-session second Start Preview if feasible: marker + process/port + Stop visible; second button-click stop + cleanup |
| E13 | Static project: marker; no Vite/node process; Stop visible; button-click stop succeeds |
| E14 | Cleanup: both sessions Stopped; projects retained; gate ON |
| E15 | Any stop-id, rollback performed, and FAIL-without-source-fix if button absent/click failed after `LIVE_LOCKED` |

Screenshots: Vite iframe marker (start + restart), Stop button visible before click, static iframe marker. Do not capture cookies, CSRF tokens, or Authorization headers.

---

## 12. Invariants this freeze must not change

- Occupancy EMPTY. Not admitted. Lane 3 DISABLED.
- GOVERNANCE UNOWNED at end-state.
- FRONTEND + STAGING declared, not acquired.
- I18N / GATEWAY / CONTAINER-MANAGER undeclared.
- `stagingAuthorized=false`. `STAGING_EXECUTION_AUTHORIZED=NO`.
- EXEC-01C6A `startCondition=NOT_READY` UNCHANGED / not reopened.
- BUILDER-LIVE-GATE-01 COMPLETE AND LOCKED / gate LEFT ON.
- PREVIEW-STOP-UI-01 remains COMPLETE AND LOCKED (LOCAL-TESTS parent).
- PREVIEW-STOP-PUBLIC-ROUTE-STAGING-01 remains COMPLETE AND LOCKED.
- PREVIEW-STOP-PUBLIC-ROUTE-01 / PREVIEW-STOP-01 remain COMPLETE AND LOCKED.
- PREVIEW-STOP-STAGING-APPLY-01 remains REGISTERED / READY / NOT ADMITTED / not locked / partial pass. Not rewritten.
- PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.
- No application source. `writePaths=[]`.

---

## 13. Admission / saturation

- After this Step 2: candidate `status=READY` / `saturationClass=FORCING` / `writeSetPrecision=EXACT` / `writePaths=[]` / `admissionUncertain=true`.
- `Test-Admissible` = ADMISSION_UNCERTAIN. Not in S.
- Occupancy EMPTY. Idle implementation capacity is valid.
- This freeze does not admit a lane.
- `stagingAuthorized` remains `false` until a later Step 3 authorization.

---

## 14. Keith-decision boundary (after this Step 2 freeze)

```
KEITH_DECISION_REQUIRED_BEFORE_STAGE_START=NO (Step 2 COMPLETE)
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

This freeze does **not** reopen EXEC-01C6A. It does **not** change BUILDER-LIVE-GATE-01. Gate remains ON. It does **not** lock or reopen PREVIEW-STOP-STAGING-APPLY-01. It does **not** authorize Step 3.

---

## 15. Step 2 acceptance

- [x] Read-only live version-check fingerprints frozen against committed `e165ede` frontend Stop Preview UI
- [x] Classification frozen: `LIVE_LOCKED` / `LIVE_OLD` / `LIVE_UNKNOWN`
- [x] Running-bundle fingerprints frozen: `workspace-preview-stop`, `workspace-preview-stop-error`, compiled POST `/api/preview/${sessionId}/stop`; confirmatory `preview.stopPreview` / `preview.stopFailed` strings if present
- [x] PM2 apply path frozen: `aisandbox-frontend` / `/opt/aisandbox/frontend` / `.next` / `npm run build` / `pm2 restart aisandbox-frontend` only / no `--update-env` / no `.env`
- [x] STOP frozen for dirty tree, unknown PM2 path, `LIVE_UNKNOWN`, build fail, frontend health fail, Stop button absent after `LIVE_LOCKED`, Stop click fail
- [x] `LIVE_OLD` apply frozen: ff-only to a revision containing `e165ede` / `fbf0096` / `045fe3b` or later; build frontend only; restart frontend only; health frontend `:3002` + Gateway ready `:4000`; running `.next` becomes `LIVE_LOCKED`
- [x] `LIVE_LOCKED` skips apply and still proceeds to proof
- [x] Browser proof frozen: signed-in `/en/app`; ZIP-import Vite + static; button path not DevTools POST; process/port/map; Start available again; same-session restart if feasible; projects retained / sessions stopped
- [x] Rollback frozen: build fail → no restart; frontend health fail after restart → restore `.next` backup + restart frontend only; no source fix from proof failure
- [x] I18N write not needed; GATEWAY / CONTAINER-MANAGER undeclared; APPLY-01 unchanged
- [x] Out of scope confirmed (source, Gateway/CM rewrite, Ask/Build, provider/credit, EXEC-01C6A / Harness, `.env` / live gate, Stripe/orchestration/apex/invites)
- [x] EXACT `writePaths=[]`; `admissionUncertain=true`; occupancy EMPTY; GOVERNANCE UNOWNED; `stagingAuthorized=false`
- [x] FRONTEND + STAGING declared, not acquired
- [x] Steps 3–4 NOT AUTHORIZED; procedure not executed this window

---

## 16. Activity ledger (Step 2)

**Step 2 HEAD:** not queried this window except as validator output (`scripts/validate-lane-capacity.ps1` + `git diff --check`)
**Step 2 activity ledger:** LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=0, application source=0, frontend=0, i18n=0, tests executed=0 except lane-capacity validator, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0, named other children registered=0, Stripe=0, credit mutation=0, follow-on registration=0. Governance writes: `docs/PREVIEW-STOP-UI-STAGING-01-STAGE-START.md`; TASKS.md CURRENT EXECUTION BOARD fields; TASKS_BACKLOG_FULL.md PREVIEW-STOP-UI-STAGING-01 body; sidecar candidate `writeSetPrecision=EXACT` (`writePaths=[]`; occupancy EMPTY / GOVERNANCE UNOWNED; `admissionUncertain=true`; `stagingAuthorized=false`); SATURATION_PROOF.json only as validator output.

**Invitation invariant:** PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.

**Lane 3 invariant:** Lane 3 remains DISABLED.

**Activation effect:** NONE this freeze window.
**Rollback boundary:** Step 2 = discard this child's stage-start plus this window's board/registry/sidecar precision-field updates. Ordinary Builder Ask/Build/static Preview path, locked PREVIEW-STOP-UI-01 LOCAL-TESTS evidence, locked PUBLIC-ROUTE-01 / STAGING-01 public stop evidence, locked Vite start path, APPLY-01 Step 3 staging apply/proof, live gate, and credit UX are untouched.
