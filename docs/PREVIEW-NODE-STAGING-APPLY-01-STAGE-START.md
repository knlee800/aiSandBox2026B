# PREVIEW-NODE-STAGING-APPLY-01 — Stage-start / live version check + staging apply freeze

**Task ID:** PREVIEW-NODE-STAGING-APPLY-01
**Title:** Staging apply of locked PREVIEW-NODE-01 Vite preview
**Date:** 2026-09-15
**Nature:** IMPLEMENTATION / staging-ops — high-risk live version check plus possible staging apply of already-locked container-manager Vite preview
**Lifecycle:** 4-step IMPLEMENTATION
**Step:** 4 COMPLETE AND LOCKED — independent verification / checkpoint / lock
**Step status:** Step 1 COMPLETE — 2026-09-15 (registration / control-plane only; registered at `a4a89f2`); Step 2 COMPLETE — 2026-09-15 (freeze committed `158786d`); Step 3 AUTHORIZED and PASS — 2026-09-15 (retry after PREVIEW-NODE-STAGING-HYGIENE-01; supersedes §14 `S_DIRTY_TREE` BLOCKED; committed `a1561a9`); Step 4 COMPLETE AND LOCKED — 2026-09-15
**This document:** Authoritative Step 2 freeze, Step 3 evidence, and Step 4 checkpoint. §16 retry supersedes §14 BLOCKED. Step 4 did **not** admit a lane, did **not** edit application source, `.env`, provider, credit, or EXEC-01C6A, and did **not** use runtime/SSH/PM2/Git.

**Parent:** PREVIEW-NODE-01 COMPLETE AND LOCKED — Checkpoint: `docs/PREVIEW-NODE-01-STAGE-START.md` — implementation HEAD `443d7eeecba7d8ef403fc77a3eee37d6d62f418a` (`feat: support vite preview`) — lock `26a1333` (`docs: lock vite preview slice`)
**Sibling proof:** PREVIEW-NODE-STAGING-01 COMPLETE AND LOCKED this same Step 4 window — historical Step 3 FAIL remains in §16; APPLY-01 Phase D reran the same frozen §5 procedure as §17 PASS. Frozen proof procedure: same document §5 Phases 0–8. Dual-lock decision: §18.
**Occupancy hash (end-state):** `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d` (Lane 1 EMPTY, Lane 2 EMPTY, GOVERNANCE UNOWNED)

```
STEP1_COMPLETE=YES
STEP2_COMPLETE=YES
STEP3_AUTHORIZED=YES
STEP3_COMPLETE=YES
STEP3_VERDICT=PASS
STOP_ID=NONE
LIVE_CLASS=LIVE_LOCKED
LIVE_CLASS_PHASE_A=LIVE_OLD
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
PREVIEW_SERVICE_TS_EDIT=FORBIDDEN_THIS_TASK
TEST_HARNESS_EXPANSION=NONE
ASK_BUILD=NO
PROVIDER_LIVE=NO
CREDIT=NO
LOCAL_RUNTIME=NO
MUTEXES_DECLARED=CONTAINER-MANAGER,STAGING
MUTEXES_ACQUIRED=NO
STAGING_AUTHORIZED=NO
STAGING_EXECUTION_AUTHORIZED=NO
SSH_USED=YES
AWS_USED=NO
PM2_RESTART=YES (aisandbox-container-manager only)
APPLY=YES
GIT_PULL=YES
CM_BUILD=YES
EVIDENCE_CLASS=STAGING-RUNTIME
HOST=https://staging.ainow.biz
LIGHTSAIL=aisandbox-staging
STAGING_PATH=/opt/aisandbox
LOCKED_IMPLEMENTATION=443d7eeecba7d8ef403fc77a3eee37d6d62f418a
MINIMUM_APPLY_UNIT=aisandbox-container-manager
APEX_AINOW_BIZ=OUT_OF_SCOPE
HARNESS_ENABLEMENT=NO
ORCHESTRATION=NO
STRIPE=NO
APEX_ROUTING=NO
EXEC_01C6A_REOPENED=NO
EXEC_01C6A_START_CONDITION=NOT_READY
BUILDER_LIVE_GATE_01=COMPLETE AND LOCKED / LEFT_ON
PREVIEW_NODE_STAGING_01_STEP4=COMPLETE AND LOCKED (same window)
LANE_1=EMPTY
LANE_2=EMPTY
LANE_3=DISABLED
GOVERNANCE=UNOWNED (end-state)
PRIVATE_BETA_INVITE_01=PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
FOLLOW_ON_REGISTERED=NO
```

Keith authorized Step 4 checkpoint/lock after Step 3 PASS (committed `a1561a9`). Occupancy remains EMPTY. Sidecar candidate is `status=LOCKED` / `writeSetPrecision=EXACT` / `admissionUncertain=false` so the candidate is **not** in S (`Test-Admissible` = NOT_READY). Do **not** admit Lane 1 or Lane 2. Do **not** register follow-on tasks. Do **not** reopen AGENT-PLATFORM-EXEC-01C6A. BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON. Step 3 verdict = **PASS**. Step 4 verdict = **COMPLETE AND LOCKED**. §16 retry supersedes §14 BLOCKED. Phase A classified `LIVE_OLD` on a clean tree; Phase B/C applied locked container-manager code to `LIVE_LOCKED`; Phase D reran PREVIEW-NODE-STAGING-01 §5 Vite/static proof. PREVIEW-NODE-STAGING-01 is COMPLETE AND LOCKED in this same window (dual-lock decision §18).

---

## 1. Inherited product / architecture facts (must not reopen)

- `PRD.md` CURRENT includes integrated workspace preview and HTTP/WebSocket (HMR/dev servers).
- `ARCHITECTURE.md` records `PreviewStrategyResolver` `node-dev-server` via `package.json` as CURRENT HOW. Private-beta proven path remains static `index.html`.
- Locked PREVIEW-NODE-01 productized Vite-only launch with LOCAL-TESTS (38/38 + tsc PASS) and deferred staging/browser proof as `STAGING_BROWSER_PROOF=LATER_CHILD`.
- PREVIEW-NODE-STAGING-01 is that later proof. Step 3 FAIL matched pre-443d7ee `preview.service` behavior. This child applies the locked code to staging if a read-only version check confirms old code, then retries that frozen proof.
- Locked PREVIEW-STRATEGY-01A / PREVIEW-STATIC-01B / PREVIEW-AUTOSTART-01A closed the static-html family. They are the regression baseline.
- BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON (`GLOBAL_EXECUTION_ENABLED=true`). Gate ON is **not** authorization to use Ask/Build.
- Working single-shot Builder Ask/Build remains the product to complete, not to replace. This apply must not call it.
- Product-visible Harness / orchestration / Stripe / apex production routing remain FUTURE/gated.
- EXEC-01C6A remains `startCondition=NOT_READY` / not reopened.

This freeze does not rewrite `PRD.md` or `ARCHITECTURE.md`. It does not add Next.js / CRA / Vue / Express support. It does not edit `preview.service.ts`.

---

## 2. Source-grounded locked vs pre-443d7ee fingerprints

Authority: locked PREVIEW-NODE-01 freeze (`docs/PREVIEW-NODE-01-STAGE-START.md` §3–§5, § wait/health) and current `services/container-manager/src/preview/preview.service.ts` (reference only this window).

### 2.1 Locked PREVIEW-NODE-01 behavior (443d7ee-equivalent)

Vite path only, after resolver `framework === 'Vite'` and `command === 'npm run dev'`:

| Fact | Locked value |
|---|---|
| Install gate | `[ -d /workspace/node_modules ]`; install only when exit code !== 0 |
| Install command | foreground `npm install --no-audit --no-fund` |
| Install timeout | `NPM_INSTALL_TIMEOUT_MS = 120000` |
| `npm ci` | No |
| Launch | `npm run dev -- --host 0.0.0.0 --port $PORT` (`VITE_LAUNCH_COMMAND`) |
| Wait | `VITE_WAIT_TIMEOUT_MS = 20000`; poll `VITE_WAIT_POLL_MS = 500`; axios GET any HTTP `>= 100` → `running` |
| Wait-clear | timeout → kill PID, `releasePort`, `activePreviews.delete(sessionId)`, throw `Preview server did not become reachable in time.` Vite must **not** remain `starting` |
| Install failure | Do not launch; release port; no PID left mapped |

Literal strings that must appear in the **running** container-manager artifact (PM2 script / compiled `preview.service.js` and, when readable, the matching `.ts` source):

1. `npm install --no-audit --no-fund`
2. `[ -d /workspace/node_modules ]`
3. `npm run dev -- --host 0.0.0.0 --port`
4. `Preview server did not become reachable in time`
5. `Preview could not install npm dependencies` **or** `Preview npm install timed out`
6. Wait-clear: compiled form of `this.activePreviews.delete(sessionId)` on the wait-fail path (source has the delete inside the `if (!didStart)` block)

### 2.2 Pre-443d7ee behavior (PREVIEW-NODE-01 stage-start §2.2; STAGING-01 §16)

| Fact | Pre-443d7ee / observed staging FAIL |
|---|---|
| Install | **None.** Missing `node_modules` fails the start command |
| Host bind | **Not injected.** Bare `vite` via `npm run dev` |
| Wait | 5s / 400ms |
| Wait fail | Status stays **`starting`**; port and PID remain |
| STAGING-01 §16 | `NODE_MODULES=NO`; log `> vite` / `sh: vite: not found`; `GET /status` `starting` past 180s; `POST /start` and `POST /stop` HTTP 400 |

### 2.3 Classification of the live running artifact

Authority is the artifact PM2 is **actually executing**, not checkout HEAD alone.

| Class | Meaning | Step 3 action |
|---|---|---|
| `LIVE_OLD` | Running dist/script missing one or more locked fingerprints in §2.1 (especially install + wait-clear) | Apply allowed after remaining stop-conditions pass |
| `LIVE_LOCKED` | Running dist/script contains **all** §2.1 fingerprints | **STOP.** Do not apply. Do not edit `preview.service.ts`. Return to control plane |
| `LIVE_UNKNOWN` | Cannot identify process, script path, cwd, or readable dist/source | **STOP.** Do not apply |

Source-vs-dist mismatch:

- Source locked + running dist old → `LIVE_OLD` (rebuild + restart only; no git update)
- Source old + running dist old → `LIVE_OLD` (git update of clean tree, then container-manager build + restart)
- Source locked + running dist locked → `LIVE_LOCKED`

Git HEAD containing `443d7ee` is **not** sufficient if PM2 is not running that dist.

---

## 3. Answers to the ten mandatory Step 2 questions

1. **Read-only live version check:** SSH to `aisandbox-staging` as in §5 Phase A. Identify PM2 `aisandbox-container-manager` script/cwd/dist. Grep running dist then source for §2.1 fingerprints. Classify `LIVE_OLD` / `LIVE_LOCKED` / `LIVE_UNKNOWN`. No write, no restart, no `.env` edit in this phase.
2. **Apply if old:** Existing pattern only: optional clean-tree git update of `/opt/aisandbox` to a revision that contains `443d7ee`, then `npm run build` in `services/container-manager` only, then `pm2 restart aisandbox-container-manager` only. Health as in §5 Phase C. Success = CM online + HTTP 200 + running dist now `LIVE_LOCKED`.
3. **No-apply / abort if already locked:** `LIVE_LOCKED` → STOP immediately. Do not git update. Do not build. Do not PM2 restart. Do not edit `preview.service.ts`. Record evidence and return to control plane (PREVIEW-NODE-STAGING-01 FAIL then persists against locked code → later product/fix child, not this task).
4. **`preview.service.ts`:** Forbidden for this entire task. If a later authorized Step 3 version check proves `LIVE_LOCKED` and STAGING-01 FAIL still stands (or proof retry still fails after apply), STOP and return to control plane. Do not silently product-fix.
5. **Later STAGING-01 proof retry:** After a successful apply (`LIVE_LOCKED` running + health PASS), rerun `docs/PREVIEW-NODE-STAGING-01-STAGE-START.md` §5 Phases 0–8 exactly (new ZIP timestamps). Do **not** start PREVIEW-NODE-STAGING-01 Step 4.
6. **Cleanup / rollback:** Gate LEFT ON. If build fails: do not restart; previous process keeps serving. If restart/health fails: restore pre-apply `dist/` copy then restart CM only. Dirty-tree / unknown-path / `LIVE_LOCKED` / Vite-proof-still-fails: no further mutation. Session stop from the proof retry follows STAGING-01 Phase 8. Do not delete DB rows. Do not `docker compose down`.
7. **Write set:** No application source. EXACT `writePaths=[]`. Step 2 writes this document plus board/registry/sidecar precision fields. Step 3/4 may append evidence/checkpoint docs only under GOVERNANCE.
8. **Mutexes:** CONTAINER-MANAGER + STAGING remain declared. LOCAL-RUNTIME / PROVIDER-LIVE / CREDIT remain undeclared. SSH/AWS are host access only, not additional mutex IDs. PM2 restart only if apply proceeds.
9. **Out of scope confirmed:** No Harness, orchestration, Stripe, apex DNS, invitation, Ask/Build, or EXEC-01C6A work.
10. **Invariants:** Builder live gate remains ON. EXEC-01C6A remains `startCondition=NOT_READY`.

---

## 4. Host / operator identity

| Item | Freeze |
|---|---|
| Live Builder | `https://staging.ainow.biz` — Lightsail `aisandbox-staging` (`18.136.141.186`, `/opt/aisandbox`) |
| Apex `https://ainow.biz` | Different site. **Out of scope.** Do not use it |
| SSH host alias | `Host aisandbox-staging` in `C:\Users\knlee\.ssh\config` |
| AWS | Lightsail host access only if SSH config needs it. Do **not** start/stop/reboot the instance. Do **not** change security groups, IPs, or snapshots |
| Staging git checkout | `/opt/aisandbox` (established live path; no separate test clone) |
| Container-manager source | `/opt/aisandbox/services/container-manager/` |
| Container-manager build | `npm run build` → `tsc` → `/opt/aisandbox/services/container-manager/dist/` |
| PM2 process name | `aisandbox-container-manager` |
| Expected script/cwd | cwd `/opt/aisandbox/services/container-manager`; script under that tree’s `dist/` (typically `dist/src/main.js` or `dist/main.js`) |
| Health | `curl` `http://127.0.0.1:4002/api/health` → HTTP 200 `{"status":"ok","service":"container-manager"}` |
| Chat / Ask / Build / Send | **Forbidden** |

Do **not** SSH, classify, apply, restart, or rerun the browser proof during Step 2.

Existing deployment pattern (PRIVATE-BETA-BLOCKER-03F / 03I): manual source update via git on `/opt/aisandbox` → service-specific `npm run build` → `pm2 restart <process-name>`. No ecosystem.config.js / CI/CD for this unit. Minimum unit for this task is **container-manager only**.

---

## 5. Frozen Step 3 procedure (exactly this)

Step 3 is **not** authorized by this freeze. When Keith later authorizes Step 3, execute the phases in order. Stop on the first stop-condition in §6. Do **not** admit a lane unless that later authorization also admits. Default occupancy remains EMPTY until a later control-plane admission.

### Phase A — Read-only live version check (no mutation)

SSH to `aisandbox-staging`. Record evidence. Print paths and SHAs. Never print `.env` secrets, API keys, cookies, or session cookies.

```bash
# A1. Identity
hostname -f || hostname
pwd
git -C /opt/aisandbox rev-parse --show-toplevel
git -C /opt/aisandbox rev-parse HEAD
git -C /opt/aisandbox branch --show-current
git -C /opt/aisandbox status --short
git -C /opt/aisandbox merge-base --is-ancestor 443d7eeecba7d8ef403fc77a3eee37d6d62f418a HEAD && echo ANCESTOR_443d7ee=YES || echo ANCESTOR_443d7ee=NO

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

Then grep the **running** compiled preview module next to the identified dist root (do not mutate):

```bash
# A3. Running dist fingerprints (adjust DIST_PREVIEW to the file that exists beside the identified dist root)
# Try in order; STOP S_UNKNOWN_PATH if none exist:
#   $CM_CWD/dist/preview/preview.service.js
#   $CM_CWD/dist/src/preview/preview.service.js
DIST_PREVIEW=<resolved-from-identified-dist>
SRC_PREVIEW=/opt/aisandbox/services/container-manager/src/preview/preview.service.ts
for NEED in \
  'npm install --no-audit --no-fund' \
  '[ -d /workspace/node_modules ]' \
  'npm run dev -- --host 0.0.0.0 --port' \
  'Preview server did not become reachable in time'
 do
  echo "DIST_NEED=$NEED"
  grep -F "$NEED" "$DIST_PREVIEW" >/dev/null && echo DIST_HIT=YES || echo DIST_HIT=NO
done
echo "SRC_EXISTS=$([ -f "$SRC_PREVIEW" ] && echo YES || echo NO)"
if [ -f "$SRC_PREVIEW" ]; then
  for NEED in \
    'npm install --no-audit --no-fund' \
    '[ -d /workspace/node_modules ]' \
    'npm run dev -- --host 0.0.0.0 --port' \
    'Preview server did not become reachable in time' \
    'activePreviews.delete'
   do
    echo "SRC_NEED=$NEED"
    grep -F "$NEED" "$SRC_PREVIEW" >/dev/null && echo SRC_HIT=YES || echo SRC_HIT=NO
  done
fi
```

Classify using §2.3. Record `LIVE_*`, `ANCESTOR_443d7ee`, HEAD, cwd, exec/script, dist path, and each HIT/NO.

- `LIVE_UNKNOWN` → STOP (`S_UNKNOWN_PATH`)
- `LIVE_LOCKED` → STOP (`S_ALREADY_LOCKED`)
- `LIVE_OLD` → continue to Phase B

Do **not** `pm2 restart`. Do **not** `npm run build`. Do **not** `git pull`. Do **not** edit `.env`. Do **not** touch Gateway / frontend / AI service / Docker / Postgres / Redis.

### Phase B — Apply locked code only if `LIVE_OLD`

Capture rollback handles **before** any write:

```bash
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
CM_CWD=<from Phase A>
CM_PID=<from Phase A>
DIST_DIR="$CM_CWD/dist"
cp -a "$DIST_DIR" "/tmp/preview-node-staging-apply-01-dist-$STAMP"
git -C /opt/aisandbox rev-parse HEAD > /tmp/preview-node-staging-apply-01-pre-head-$STAMP.txt
echo "$CM_PID" > /tmp/preview-node-staging-apply-01-pre-pid-$STAMP.txt
```

**B1. Git update only if source is old and the remote worktree is still clean.**

If Phase A source already has all §2.1 fingerprints: skip git; go to B2.

If source is old:

```bash
git -C /opt/aisandbox status --short   # must still be empty
git -C /opt/aisandbox fetch origin
git -C /opt/aisandbox merge-base --is-ancestor 443d7eeecba7d8ef403fc77a3eee37d6d62f418a FETCH_HEAD && echo FETCH_HAS_443d7ee=YES || echo FETCH_HAS_443d7ee=NO
```

STOP (`S_UNKNOWN_PATH` / abort apply) if `FETCH_HAS_443d7ee=NO`.
STOP (`S_DIRTY_TREE`) if status became dirty.
Do **not** `git reset --hard`. Do **not** stash. Do **not** force-push. Do **not** create branches.

If the current branch is clean and FETCH_HEAD contains `443d7ee`, update using the established pull/merge of that already-checked-out branch:

```bash
git -C /opt/aisandbox pull --ff-only
git -C /opt/aisandbox rev-parse HEAD
git -C /opt/aisandbox merge-base --is-ancestor 443d7eeecba7d8ef403fc77a3eee37d6d62f418a HEAD && echo ANCESTOR_443d7ee=YES || echo ANCESTOR_443d7ee=NO
```

STOP if `--ff-only` fails (conflicts / non-ff). Leave the previous process running.

Confirm source now contains §2.1 fingerprints before building.

**B2. Build only container-manager.**

```bash
cd /opt/aisandbox/services/container-manager && npm run build
```

STOP (`S_BUILD_FAIL`) if build exits non-zero. Do **not** restart PM2. Previous `dist/` remains what PM2 is serving until a successful build + restart.

Re-grep the new dist file for §2.1 fingerprints. STOP (`S_BUILD_FAIL`) if the new dist is still missing locked fingerprints.

**B3. Restart only `aisandbox-container-manager`.**

```bash
pm2 restart aisandbox-container-manager
```

Do **not** `pm2 restart all`. Do **not** restart `aisandbox-api-gateway`, `aisandbox-frontend`, `aisandbox-ai-service`, or `aisandbox-ops-watchdog`. Do **not** `--update-env` unless a later stop-condition proves the process did not reload the new `dist/` (default: no `--update-env`; this apply is dist/code, not `.env`).

### Phase C — Health after apply

```bash
pm2 describe aisandbox-container-manager
curl -sS -o /tmp/preview-node-staging-apply-01-cm-health.json -w '%{http_code}' http://127.0.0.1:4002/api/health
cat /tmp/preview-node-staging-apply-01-cm-health.json
# Re-identify exec/script; re-grep DIST_PREVIEW for §2.1; must now classify LIVE_LOCKED
curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/api/health/ready
```

PASS only if **all** are true:

- `aisandbox-container-manager` status `online`
- CM health HTTP 200 with `service":"container-manager"` (or established `status":"ok"` body)
- Running dist now `LIVE_LOCKED`
- Gateway ready HTTP 200 (read-only; **do not** restart Gateway if this fails — STOP `S_HEALTH_FAIL` and roll back CM only)

STOP (`S_HEALTH_FAIL`) otherwise. Execute §7 rollback. Do not start the browser proof.

### Phase D — Rerun PREVIEW-NODE-STAGING-01 frozen Vite/static proof

Only after Phase C PASS.

Execute `docs/PREVIEW-NODE-STAGING-01-STAGE-START.md` §5 Phases 0–8 **exactly**, with new ZIP timestamps. Inherited freeze remains in force:

- Host `https://staging.ainow.biz/en/app` only
- ZIP import; **no Ask/Build/Send**
- UI Start Preview once; no request body
- Vite marker `PREVIEW-NODE-STAGING-01 Vite OK`
- Static marker `PREVIEW-NODE-STAGING-01 Static OK`
- Orphan/port-leak inspect
- Session Stop cleanup; projects retained; gate LEFT ON

Do **not** start PREVIEW-NODE-STAGING-01 Step 4. Do **not** lock either task in this Step 3.

STOP (`S_VITE_PROOF_FAIL`) if that frozen proof hits S4/S5/S6 (or any other STAGING-01 stop-condition) after a confirmed `LIVE_LOCKED` apply. Do not edit `preview.service.ts`. Return to control plane.

### Phase E — Cleanup (always)

- Proof sessions: STAGING-01 Phase 8 (Stop preview if mapped; Advanced session Stop; retain named disposable projects)
- Leave `GLOBAL_EXECUTION_ENABLED` / Builder live gate ON
- Leave CM online on the surviving dist (new if apply PASS; restored if rollback)
- Remove `/tmp/preview-node-staging-apply-01-*` copies only after Step 3 evidence is recorded, or keep them until Step 4
- No `.env` restore (this task must not have edited `.env`)
- No Docker / Postgres / Redis / compose mutation
- No local Git commit/push

---

## 6. Frozen stop conditions

Stop immediately on the first match. Do not continue later phases.

| ID | Condition | Mutation after stop |
|---|---|---|
| `S_UNKNOWN_PATH` | CM process count !== 1, not `online`, cwd/script missing, script not under `/opt/aisandbox/services/container-manager/dist`, or fingerprint files unreadable | None |
| `S_DIRTY_TREE` | `git -C /opt/aisandbox status --short` non-empty at Phase A or before git update | None |
| `S_ALREADY_LOCKED` | Running artifact is `LIVE_LOCKED` (443d7ee-equivalent install + wait-clear already live) | None. Do not apply. Do not edit `preview.service.ts` |
| `S_BUILD_FAIL` | `npm run build` non-zero, or new dist still missing §2.1 fingerprints | No PM2 restart. Previous process keeps old dist |
| `S_HEALTH_FAIL` | After restart: CM not online, CM health not 200, running dist not `LIVE_LOCKED`, or Gateway ready not 200 | Rollback CM dist + restart CM only (§7) |
| `S_VITE_PROOF_FAIL` | After confirmed apply, STAGING-01 §5 Vite proof still fails (S4/S5/S6 or marker miss) | No further apply. Do not edit `preview.service.ts`. Proof cleanup only |
| `S_FF_FAIL` | `git pull --ff-only` fails | No build, no restart |
| `S_FETCH_MISSING_443d7ee` | FETCH_HEAD is not a descendant of `443d7ee` | No pull, no build, no restart |

Also stop (inherited, still in force during Phase D): STAGING-01 S1–S8 (wrong host, signed-out, Ask/Build used, Vite start fail, status stuck `starting`, marker miss, leak, static regression).

This task does **not** convert `S_ALREADY_LOCKED` or `S_VITE_PROOF_FAIL` into a `preview.service.ts` product fix.

---

## 7. Cleanup / rollback criteria

| Event | Rollback |
|---|---|
| Phase A stop | None. SSH session ends. Gate ON |
| `S_BUILD_FAIL` | None to runtime. Discard failed build outputs by leaving PM2 on the pre-build process. Keep `/tmp/...-dist-$STAMP` |
| `S_HEALTH_FAIL` | `rm -rf "$DIST_DIR" && cp -a /tmp/preview-node-staging-apply-01-dist-$STAMP "$DIST_DIR" && pm2 restart aisandbox-container-manager`. Re-check CM health 200. Do not git rollback unless Keith separately authorizes. Do not restart other PM2 apps |
| `S_VITE_PROOF_FAIL` after apply PASS | Leave the applied locked dist in place (it is the intended code). Do not roll back solely because the product proof failed. Cleanup proof sessions only |
| Apply PASS + proof PASS | Keep new dist. Keep `/tmp` copies until Step 4. Gate ON |
| Accidental other-service restart | Out of scope; stop and report. Do not improvise further restarts |

Builder live gate remains LEFT ON in every path. Do not persist `GLOBAL_EXECUTION_ENABLED=false`.

---

## 8. Exact write set (EXACT)

| Path | This Step 2 | Later Step 3 | Later Step 4 |
|---|---|---|---|
| `docs/PREVIEW-NODE-STAGING-APPLY-01-STAGE-START.md` | Created (this freeze) | Evidence append only | Checkpoint append / lock record |
| `TASKS.md` CURRENT EXECUTION BOARD fields | Yes | End-status only | End-status only |
| `TASKS_BACKLOG_FULL.md` PREVIEW-NODE-STAGING-APPLY-01 body | Step 2 fields | Step 3 fields | Step 4 fields |
| `docs/control-plane/lane-saturation-state.json` | `writeSetPrecision=EXACT`; `writePaths=[]`; occupancy EMPTY; `admissionUncertain=true` | Occupancy only if a later admission changes it | Lock fields only if lock is authorized |
| `docs/control-plane/SATURATION_PROOF.json` | Validator output only | Validator output only | Validator output only |
| `services/container-manager/src/preview/preview.service.ts` | **No** | **No** | **No** |
| `services/container-manager/src/preview/preview.service.spec.ts` | **No** | **No** | **No** |
| Frontend / i18n | **No** | **No** | **No** |
| `.env` | **No** | **No** | **No** |

Candidate `writePaths=[]`. Implementation write set is ops/procedure only. Staging git / `dist/` / PM2 mutation exists only as later Step 3 runtime, not as a repo write path.

---

## 9. Step 3 runtime / mutex needs (declared, not acquired this window)

| Need | Step 2 | Later Step 3 |
|---|---|---|
| Mutex CONTAINER-MANAGER | Declared, not acquired | Required for apply/build/restart ownership. Acquire only if Step 3 is authorized and apply proceeds past `LIVE_OLD` |
| Mutex STAGING | Declared, not acquired | Required for Lightsail staging host + proof retry. Acquire only if Step 3 is authorized |
| GOVERNANCE | Transient board/registry write then UNOWNED | Evidence/board write then UNOWNED |
| SSH | Not used | Required for Phase A–C on `aisandbox-staging` |
| AWS | Not used | Only as needed for that Lightsail host access. No instance lifecycle |
| PM2 restart | No | **Only** `aisandbox-container-manager` and **only** if `LIVE_OLD` apply proceeds (Phase B3). Version-check-only / `LIVE_LOCKED` / dirty / unknown-path: no restart |
| LOCAL-RUNTIME | Undeclared | **No** |
| PROVIDER-LIVE | Undeclared | **No** |
| CREDIT | Undeclared | **No** |
| ENV / GATEWAY / FRONTEND / I18N / PACKAGE / COMPOSE / MIGRATION / AI-SERVICE | Undeclared | **No** |
| Ask / Build / Send | Forbidden | **No** |
| Docker / Postgres / Redis / compose | No | **No** (inspect-only `docker` is not required; STAGING-01 proof uses product exec API) |
| Admission | No | Keith decision still required. This freeze does not admit |

`stagingAuthorized=false` this window. `STAGING_EXECUTION_AUTHORIZED=NO` this window. `PROVIDER_LIVE_AUTHORIZED=NO`. `CREDIT_MUTATION_AUTHORIZED=NO`. `LOCAL_RUNTIME_AUTHORIZED=NO`.

---

## 10. Out of scope (frozen)

- Editing `preview.service.ts` / `preview.service.spec.ts` / any application source
- Frontend / i18n
- Additional framework support
- Ask / Build / Send / provider / credit
- Restarting Gateway, frontend, AI service, or `pm2 restart all`
- `.env` / harness flags / live gate flip
- Docker compose / Postgres / Redis / `docker compose down`
- Apex `ainow.biz` DNS or production routing
- Harness enablement; EXEC-01C6A reopen
- PREVIEW-NODE-STAGING-01 Step 4
- PRIVATE-BETA-INVITE-01
- Local Git commit / push / branch / worktree
- Registering named later children

---

## 11. Exact Step 3 evidence list (when later authorized)

| ID | Record |
|---|---|
| E1 | SSH host, `/opt/aisandbox` HEAD, branch, `status --short`, `ANCESTOR_443d7ee` |
| E2 | PM2 name, pm_id, status, cwd, exec/script, PID |
| E3 | Resolved `DIST_PREVIEW` path and each DIST_HIT / SRC_HIT |
| E4 | Classification `LIVE_OLD` / `LIVE_LOCKED` / `LIVE_UNKNOWN` and which stop-id if stopped |
| E5 | If apply: pre-HEAD, pre-PID, dist backup path, whether git update ran, post-HEAD |
| E6 | `npm run build` exit; post-build DIST_HIT |
| E7 | `pm2 restart aisandbox-container-manager` yes/no; post PID; CM health HTTP + body; Gateway ready HTTP |
| E8 | Post-apply classification (must be `LIVE_LOCKED` to enter Phase D) |
| E9 | STAGING-01 §5 proof evidence E1–E16 (new timestamps) or stop-id that skipped it |
| E10 | Cleanup: sessions stopped, gate ON, other PM2 apps untouched, `.env` untouched |
| E11 | Confirmation `preview.service.ts` was not edited |
| E12 | Confirmation EXEC-01C6A not reopened; BUILDER-LIVE-GATE-01 gate LEFT ON |

Do not capture cookies, CSRF tokens, Authorization headers, or `.env` secret values.

---

## 12. Invariants this freeze must not change

- Occupancy EMPTY; not admitted; not LANE-DONE
- Lane 3 DISABLED
- EXEC-01C6A `startCondition=NOT_READY` / not reopened
- BUILDER-LIVE-GATE-01 COMPLETE AND LOCKED / gate LEFT ON
- PREVIEW-NODE-01 remains COMPLETE AND LOCKED
- PREVIEW-NODE-STAGING-01 COMPLETE AND LOCKED this Step 4 window (historical §16 FAIL preserved; §17 PASS is lock evidence)
- PRIVATE-BETA-INVITE-01 PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED

---

## 13. Activity ledger (Step 2)

**Step 2 HEAD:** not queried this window (Keith instruction: Do not Git except validator + `git diff --check`)
**Step 2 activity ledger:** LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=0, application source=0, frontend=0, i18n=0, tests executed=0, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0, PREVIEW-NODE-STAGING-01 Step 3 retry=0, PREVIEW-NODE-STAGING-01 Step 4 started=0, named other children registered=0. Governance writes: `docs/PREVIEW-NODE-STAGING-APPLY-01-STAGE-START.md`; TASKS.md CURRENT EXECUTION BOARD fields; TASKS_BACKLOG_FULL.md PREVIEW-NODE-STAGING-APPLY-01 body; sidecar candidate `writeSetPrecision=EXACT` (`writePaths=[]`; occupancy EMPTY / GOVERNANCE UNOWNED); SATURATION_PROOF.json only as validator output.

**Activation effect:** NONE
**Rollback boundary:** Step 2 = discard this document plus this window’s board/registry/sidecar write-set field updates. Ordinary Builder Ask/Build/static Preview path, locked PREVIEW-NODE-01, PREVIEW-NODE-STAGING-01 Step 3 FAIL evidence, and the live gate are untouched.
**Follow-on:** Step 3 BLOCKED (`S_DIRTY_TREE`). A later Keith-authorized Step 3 retry may apply only after the remote worktree is clean (or an explicit exception is frozen). Do not start Step 4.

---

## 14. Step 3 evidence (2026-09-15) — BLOCKED (`S_DIRTY_TREE`)

**Verdict:** **BLOCKED**
**Stop:** `S_DIRTY_TREE` — `git -C /opt/aisandbox status --short` was non-empty. Frozen procedure forbids apply/build/restart on a dirty remote worktree.
**Classification:** `LIVE_OLD` (running dist missing all four locked §2.1 fingerprints). Apply was **not** started.
**Admission:** NO. Occupancy EMPTY. Step 4 NOT AUTHORIZED. PREVIEW-NODE-STAGING-01 §5 proof **not run**.

### E1–E12

| ID | Record |
|---|---|
| E1 | SSH `aisandbox-staging` (`ip-172-26-6-228.ap-southeast-1.compute.internal`). Toplevel `/opt/aisandbox`. Branch `main`. HEAD `b6b94516aff9981101ae8815aec2e2d36b8b231b`. `status --short`: `?? services/ai-service/dist.outgoing-20260910T082304Z-467f0d51/`. `ANCESTOR_443d7ee=NO` (`fatal: Not a valid commit name 443d7eeecba7d8ef403fc77a3eee37d6d62f418a` — object not in the staging clone). |
| E2 | PM2 `aisandbox-container-manager` count=1, `pm_id=1`, status `online`, cwd `/opt/aisandbox/services/container-manager`, exec/script `/opt/aisandbox/services/container-manager/dist/main.js` (file exists), pid `844883`, uptime 4D, restarts 0. Path known. Not `S_UNKNOWN_PATH`. |
| E3 | `DIST_PREVIEW=/opt/aisandbox/services/container-manager/dist/preview/preview.service.js` (mtime Aug 17 11:02). DIST_HIT: `npm install --no-audit --no-fund`=NO; `[ -d /workspace/node_modules ]`=NO; `npm run dev -- --host 0.0.0.0 --port`=NO; `Preview server did not become reachable in time`=NO. SRC `/opt/aisandbox/services/container-manager/src/preview/preview.service.ts` EXISTS. SRC_HIT: same four strings NO; `activePreviews.delete`=YES (legacy stop path, not wait-clear). |
| E4 | `LIVE_OLD`. Stop-id **`S_DIRTY_TREE`** (outranks apply). Not `LIVE_LOCKED`. Not `LIVE_UNKNOWN`. |
| E5 | Apply **not started**. No dist backup. No git fetch/pull. pre-HEAD remains `b6b94516aff9981101ae8815aec2e2d36b8b231b`. pre-PID `844883`. |
| E6 | `npm run build` **not run**. |
| E7 | `pm2 restart aisandbox-container-manager` **no**. Post PID still `844883`. CM health / Gateway ready **not required** after Phase A stop (no apply). Post-stop `pm2 list`: CM online 4D ↺0; Gateway pid 898373 31h ↺2; frontend/AI/watchdog 4D ↺0. |
| E8 | Running dist remains `LIVE_OLD`. Phase D not entered. |
| E9 | STAGING-01 §5 proof **not run** (stop-condition). New E1–E16 = N/A. |
| E10 | No proof sessions created. Gate not flipped. Other PM2 apps not restarted. `.env` not read or edited. Helper scripts `/tmp/aisb-apply01-phase-a.sh`, `/tmp/aisb-apply01-phase-a3.sh`, `/tmp/aisb-apply01-pm2.json` removed. Untracked `services/ai-service/dist.outgoing-20260910T082304Z-467f0d51/` left untouched. |
| E11 | Local and remote `preview.service.ts` **not edited**. |
| E12 | EXEC-01C6A not reopened. BUILDER-LIVE-GATE-01 gate LEFT ON (not inspected via `.env`; not flipped). |

### Runtime commands used

- `ssh` / `scp` to `aisandbox-staging` (BatchMode)
- Frozen A1: `hostname`, `git -C /opt/aisandbox rev-parse` / `branch` / `status --short` / `merge-base --is-ancestor 443d7ee...`
- Frozen A2: `pm2 describe aisandbox-container-manager`; `pm2 jlist` python extract
- Frozen A3: `ls` dist candidates; `grep -F` of §2.1 strings in running `dist/preview/preview.service.js` and source `.ts`
- `pm2 list` (read-only confirmation after stop)
- `rm -f` of `/tmp/aisb-apply01-phase-a.sh` `/tmp/aisb-apply01-phase-a3.sh` `/tmp/aisb-apply01-pm2.json`

**Not used:** `git pull` / `fetch` / `reset` / `stash`; `npm run build`; `pm2 restart`; `.env` grep of secrets; AWS instance APIs; Docker/Postgres/Redis; Ask/Build; browser proof.

### Cleanup confirmation

- No apply, no CM restart, no other-service restart
- No `.env` edit; Builder gate left ON
- No disposable projects/sessions created this window
- Remote helper scripts removed
- Dirty untracked `dist.outgoing-*` directory **not** deleted (would be a mutation)
- No local Git commit/push

**Activation effect:** NONE (Phase A stop)
**Rollback boundary:** Step 3 BLOCKED = discard §14 plus this window’s board/registry field updates. No runtime rollback (no apply). Locked PREVIEW-NODE-01, STAGING-01 §16 FAIL evidence, and the live gate are untouched.
**Follow-on:** later Step 3 retry after the staging worktree is clean, or an explicit control-plane exception. Do not convert this BLOCKED into a `preview.service.ts` product fix. Do not start Step 4.

---

## 15. Hygiene unblocker pointer (2026-09-15) — PREVIEW-NODE-STAGING-HYGIENE-01

Separate GOVERNANCE task PREVIEW-NODE-STAGING-HYGIENE-01 COMPLETE AND LOCKED — PASS. Checkpoint: `docs/PREVIEW-NODE-STAGING-HYGIENE-01-CHECKPOINT.md`.

The untracked `services/ai-service/dist.outgoing-20260910T082304Z-467f0d51/` directory was **moved** (not deleted) to `/home/ubuntu/aisb-preserved/dist.outgoing-20260910T082304Z-467f0d51/`. Remote `git -C /opt/aisandbox status --short` is now empty.

This pointer does **not** itself lock PREVIEW-NODE-STAGING-APPLY-01. Step 3 retry evidence is §16.

---

## 16. Step 3 retry evidence (2026-09-15) — PASS (supersedes §14)

**Supersedes:** §14 BLOCKED / `S_DIRTY_TREE` (dirty `?? services/ai-service/dist.outgoing-20260910T082304Z-467f0d51/`). Hygiene PREVIEW-NODE-STAGING-HYGIENE-01 COMPLETE AND LOCKED PASS moved that artifact to `/home/ubuntu/aisb-preserved/dist.outgoing-20260910T082304Z-467f0d51/`.
**Stop:** none. Step 4 NOT AUTHORIZED. Task not locked.
**Phase A:** `LIVE_OLD`. Remote `git -C /opt/aisandbox status --short` empty (0 bytes). HEAD before git update `b6b94516aff9981101ae8815aec2e2d36b8b231b`. CM `aisandbox-container-manager` pm_id=1 online pid `844883` cwd `/opt/aisandbox/services/container-manager` script `dist/main.js`. Running `dist/preview/preview.service.js` missing all four §2.1 locked fingerprints (`DIST_HIT=NO`). Not `S_DIRTY_TREE` / `S_UNKNOWN_PATH` / `S_ALREADY_LOCKED`.
**Phase B:** dist backup `/tmp/preview-node-staging-apply-01-dist-20260915T140643Z`. `git fetch` then `git pull --ff-only` → POST_HEAD `cbeb5c6aa0f8af50114bacd27e1dbd8e269d8b5c` (`FETCH_HAS_443d7ee=YES`). `npm run build` in `services/container-manager` only; `BUILD_EXIT=0`. New dist contains all four §2.1 fingerprints (`DIST_HIT=YES`).
**Phase B3/C:** `pm2 restart aisandbox-container-manager` only (no `--update-env`; no restart of Gateway/frontend/AI-service/watchdog). New pid `924496` restarts=1. CM `GET :4002/api/health` HTTP 200 `{"status":"ok","service":"container-manager",...}`. Gateway `GET :4000/api/health/ready` HTTP 200. Running dist classified **`LIVE_LOCKED`**. Other PM2 apps untouched (AI pid 844882 ↺0; frontend 844894 ↺0; gateway 898373 ↺2; watchdog 844905 ↺0).
**Phase D:** PREVIEW-NODE-STAGING-01 §5 Phases 0–8 rerun with new ZIP timestamps. Result **PASS**. Evidence also appended to `docs/PREVIEW-NODE-STAGING-01-STAGE-START.md` §17.

### APPLY-01 E1–E12

| ID | Record |
|---|---|
| **E1** | Host `aisandbox-staging` → `18.136.141.186` user `ubuntu`. Path `/opt/aisandbox`. Pre-pull HEAD `b6b94516aff9981101ae8815aec2e2d36b8b231b`. Post-pull HEAD `cbeb5c6aa0f8af50114bacd27e1dbd8e269d8b5c`. `status --short` empty. `FETCH_HAS_443d7ee=YES` after fetch. |
| **E2** | `aisandbox-container-manager` pm_id=1 online. Pre-apply pid `844883`. Post-apply pid `924496` restarts=1. cwd `/opt/aisandbox/services/container-manager`. script `/opt/aisandbox/services/container-manager/dist/main.js`. |
| **E3** | `DIST_PREVIEW=/opt/aisandbox/services/container-manager/dist/preview/preview.service.js`. Phase A: all four locked fingerprints `DIST_HIT=NO`. Post-build / running: all four `DIST_HIT=YES` (`npm install --no-audit --no-fund`; `[ -d /workspace/node_modules ]`; `npm run dev -- --host 0.0.0.0 --port`; `Preview server did not become reachable in time`). |
| **E4** | Phase A **`LIVE_OLD`**. Stop-id none (tree clean). Not `LIVE_UNKNOWN`. After apply **`LIVE_LOCKED`**. |
| **E5** | Pre-HEAD `b6b94516…`. Pre-PID `844883`. Dist backup `/tmp/preview-node-staging-apply-01-dist-20260915T140643Z`. Git update **yes** (`pull --ff-only`). Post-HEAD `cbeb5c6aa0f8af50114bacd27e1dbd8e269d8b5c`. |
| **E6** | `npm run build` exit 0 (tsc in container-manager only). Post-build all four `DIST_HIT=YES`. |
| **E7** | `pm2 restart aisandbox-container-manager` **yes**. Post PID `924496`. CM health HTTP 200. Gateway ready HTTP 200. |
| **E8** | Post-apply **`LIVE_LOCKED`**. Phase D entered. |
| **E9** | STAGING-01 §5 proof **PASS** — see that document §17 (new ZIP stamp `20260915-2211`). |
| **E10** | Vite session `08a1491f-bb30-490e-8c4b-bb59fda0ac78` Advanced Stop → `stopped`. Static session `1927d645-c7ce-4fdf-b76b-9e4f63b01adb` Advanced Stop → `stopped`. Projects retained. Gate ON. Other PM2 apps not restarted this retry after the CM-only apply. `.env` not read/edited. Dist backup kept under `/tmp/` until Step 4. |
| **E11** | `preview.service.ts` **not edited**. No application source rewrite in the repo. Staging tree updated only by frozen clean-tree git pull of already-committed locked code. |
| **E12** | EXEC-01C6A not reopened / `startCondition=NOT_READY` UNCHANGED. BUILDER-LIVE-GATE-01 gate LEFT ON. |

### Runtime commands used (apply)

- SSH `aisandbox-staging`: `git -C /opt/aisandbox rev-parse HEAD`; `git status --short`; `pm2 jlist`; fingerprint grep of running `dist/preview/preview.service.js`; `curl` CM `:4002/api/health` and Gateway `:4000/api/health/ready`
- `git fetch` + `git pull --ff-only` in `/opt/aisandbox`
- `npm run build` in `/opt/aisandbox/services/container-manager` only
- `pm2 restart aisandbox-container-manager` only (no `--update-env`)

### Cleanup confirmation

- Proof sessions Stopped (Advanced session Stop + OK confirm). Projects retained.
- Gate LEFT ON. CM remains online on `LIVE_LOCKED` dist. Dist backup retained until Step 4.
- No `.env` restore (`.env` not edited). No Docker/Postgres/Redis. No Git commit/push.
- Isolated CDP Chrome (temp user-data-dir) stopped; Keith’s signed-in Profile 5 Chrome was not killed.

**Follow-on:** Step 4 COMPLETE AND LOCKED this window (Keith 2026-09-15). Dual-lock with PREVIEW-NODE-STAGING-01 recorded in §18. Do not admit a lane. Do not reopen EXEC-01C6A.

---

## 18. Dual-lock decision (Step 4 window)

**Question:** May PREVIEW-NODE-STAGING-APPLY-01 and PREVIEW-NODE-STAGING-01 both be marked COMPLETE AND LOCKED in this one Step 4 checkpoint window?

**Verdict:** **YES.**

Grounded rules:

1. CLAUDE.md “each admitted implementation lane may contain only ONE bounded implementation task” is a **lane occupancy** rule. Neither task occupies Lane 1 or Lane 2. Occupancy remains EMPTY.
2. Control-plane LOCK / consolidation may cover related completed work in one window when Keith authorizes checkpoint lock (`KEITH_DECISION_REQUIRED_BEFORE_CHECKPOINT_LOCK`).
3. The 4-step anti-collapse rule is already satisfied: freeze (Step 2), apply/proof (Step 3, committed `a1561a9`), and this lock are separate Keith-authorized windows. This window is lock-only (no runtime, SSH, PM2, or Git).
4. APPLY-01 freeze §12 anticipated “a later control-plane write after a successful proof retry” for STAGING-01. This window is that write.
5. APPLY-01 Step 3 freeze forbade starting STAGING-01 Step 4 **during Step 3**. That prohibition does not survive Keith’s explicit Step 4 dual-lock check.
6. STAGING-01 registered purpose is proven by §17 PASS of the frozen §5 procedure after `LIVE_LOCKED` apply. Historical §16 FAIL is preserved as the pre-apply attempt and is not rewritten.
7. GOV-OS-03: both candidates become `status=LOCKED` / `admissionUncertain=false` and are **not** in S (`Test-Admissible` = NOT_READY). Occupancy EMPTY. Idle implementation capacity remains valid. EXEC-01C6A `startCondition=NOT_READY` UNCHANGED.

Each task keeps its own checkpoint record in its stage-start document (this §18–§21; STAGING-01 §18–§21). No follow-on task is registered.

---

## 19. Step 4 acceptance (COMPLETE AND LOCKED — 2026-09-15)

- [x] Independent verification of Step 3 PASS against freeze + committed evidence `a1561a9`
- [x] Phase A `LIVE_OLD` on clean tree; apply to `LIVE_LOCKED`; CM health 200; Gateway ready 200
- [x] PREVIEW-NODE-STAGING-01 frozen §5 Vite/static proof PASS (`docs/PREVIEW-NODE-STAGING-01-STAGE-START.md` §17)
- [x] Dual-lock with PREVIEW-NODE-STAGING-01 authorized and recorded (§18)
- [x] no application source; no `.env`; no Ask/Build; no provider/credit
- [x] EXEC-01C6A `startCondition=NOT_READY` UNCHANGED / not reopened
- [x] BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON
- [x] sidecar `status=LOCKED` / `admissionUncertain=false`; `lockedTaskIds` includes PREVIEW-NODE-STAGING-APPLY-01
- [x] Occupancy EMPTY; no lane admitted; no runtime mutex acquired this lock window; no follow-on registered
- [x] Validator PASS this lock window
- [x] `git diff --check` PASS
- [x] No Git commit/push by the worker
- [x] No runtime/SSH/AWS/PM2/Docker/Postgres/Redis this window

---

## 20. Authorization state (end of Step 4 lock)

```
IMPLEMENTATION_AUTHORIZED=NO (ops already COMPLETE; this window is lock-only)
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
PREVIEW_NODE_STAGING_01_LOCKED=YES (same window)
```

Previous (end of Step 3 retry): STEP4_AUTHORIZED=NO; LOCKED=NO; PREVIEW_NODE_STAGING_01_STEP4=NOT_AUTHORIZED.

---

## 21. Activity ledger (Step 4) and lock evidence

**Step 4 lock ledger (this window):** LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=0, application source=0, frontend=0, i18n=0, tests executed=0, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, EXEC-01C6A reopened=0, follow-on registration=0, Ask/Build=0. Governance writes: this stage-start Step 4 checkpoint; `docs/PREVIEW-NODE-STAGING-01-STAGE-START.md` Step 4 checkpoint; `TASKS.md` CURRENT EXECUTION BOARD fields; `TASKS_BACKLOG_FULL.md` APPLY-01 and STAGING-01 bodies; sidecar candidates `status=LOCKED` / `admissionUncertain=false` + `lockedTaskIds`; `SATURATION_PROOF.json` only as validator output. Occupancy facts unchanged (EMPTY / GOVERNANCE UNOWNED).

**Invitation invariant:** PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.

**Lane 3 invariant:** Lane 3 remains DISABLED.

**Activation effect:** NONE
**Rollback boundary:** this lock = discard this window’s board/registry/stage-start/sidecar lock field updates. Staging `LIVE_LOCKED` dist, locked PREVIEW-NODE-01, HYGIENE-01, and the live gate are untouched.

### Verdict

**PREVIEW-NODE-STAGING-APPLY-01 is COMPLETE AND LOCKED.**

**Step 3 committed HEAD (user-supplied; not re-queried this window):** `a1561a9`

**Scope:** staging apply of locked PREVIEW-NODE-01 container-manager Vite preview (`LIVE_OLD` → `LIVE_LOCKED`) plus frozen STAGING-01 Vite/static proof. No `preview.service.ts` edit. No application source. No `.env`. No Ask/Build.

**Sibling:** PREVIEW-NODE-STAGING-01 COMPLETE AND LOCKED this same window. Checkpoint: `docs/PREVIEW-NODE-STAGING-01-STAGE-START.md`.

**Invariants:** EXEC-01C6A `startCondition=NOT_READY` UNCHANGED / not reopened. BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON. PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED. Lane 3 remains DISABLED. No follow-on task registered. No admitted next product gate / selection pending.
