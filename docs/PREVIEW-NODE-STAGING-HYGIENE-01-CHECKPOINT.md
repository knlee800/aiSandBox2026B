# PREVIEW-NODE-STAGING-HYGIENE-01 — Freeze + checkpoint

**Task ID:** PREVIEW-NODE-STAGING-HYGIENE-01
**Title:** Preserve/move untracked staging `ai-service` dist.outgoing artifact out of `/opt/aisandbox`
**Date:** 2026-09-15
**Nature:** GOVERNANCE / staging-hygiene (not a product frontier; not an implementation lane)
**Lifecycle:** 2-step GOVERNANCE (tiny) — registration/freeze and execute/lock in this Keith-authorized window
**Verdict:** COMPLETE AND LOCKED — PASS

Keith 2026-09-15 authorized this named hygiene unblocker for PREVIEW-NODE-STAGING-APPLY-01 `S_DIRTY_TREE`. This window did **not** retry PREVIEW-NODE-STAGING-APPLY-01 Step 3. It did **not** apply Vite code, restart PM2, edit `.env`, or Git commit/push.

**Parent / sibling:** PREVIEW-NODE-STAGING-APPLY-01 remains REGISTERED / READY / NOT ADMITTED — Step 3 historically BLOCKED (`LIVE_OLD` + `S_DIRTY_TREE`; evidence `docs/PREVIEW-NODE-STAGING-APPLY-01-STAGE-START.md` §14). Later Step 3 retry requires a separate Keith authorization.

**Occupancy hash (end-state):** `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d` (Lane 1 EMPTY, Lane 2 EMPTY, GOVERNANCE UNOWNED)

```
STEP1_COMPLETE=YES
STEP2_COMPLETE=YES
LOCKED=YES
VERDICT=PASS
NATURE=GOVERNANCE
ADMITTED=NO
APPLICATION_SOURCE=NONE
PREVIEW_SERVICE_TS_EDIT=FORBIDDEN
APPLY=NO
GIT_PULL=NO
CM_BUILD=NO
PM2_RESTART=NO
DELETE=NO
MOVE_ONLY=YES
MOVED_OK=YES
REMOTE_GIT_STATUS=CLEAN
ENV_EDIT=NO
DOCKER=NO
POSTGRES=NO
REDIS=NO
AWS=NO
PROVIDER_LIVE=NO
CREDIT=NO
ASK_BUILD=NO
EXEC_01C6A_REOPENED=NO
EXEC_01C6A_START_CONDITION=NOT_READY
BUILDER_LIVE_GATE_01=COMPLETE AND LOCKED / LEFT_ON
PREVIEW_NODE_STAGING_APPLY_01_STEP3_RETRY=NOT_AUTHORIZED
PREVIEW_NODE_STAGING_01_STEP4=NOT_AUTHORIZED
LANE_1=EMPTY
LANE_2=EMPTY
LANE_3=DISABLED
GOVERNANCE=UNOWNED (end-state)
STAGING_EXECUTION_AUTHORIZED=NO
STAGING_HYGIENE_AUTHORIZED=YES (named mv only)
HOST=aisandbox-staging
HOSTNAME=ip-172-26-6-228
STAGING_PATH=/opt/aisandbox
STAGING_HEAD=b6b94516aff9981101ae8815aec2e2d36b8b231b
SRC=/opt/aisandbox/services/ai-service/dist.outgoing-20260910T082304Z-467f0d51
DEST=/home/ubuntu/aisb-preserved/dist.outgoing-20260910T082304Z-467f0d51
SRC_GONE=YES
DEST_EXISTS=YES
FOLLOW_ON_REGISTERED=NO
```

---

## 1. Frozen remote action (exactly this)

Read-only inspect, then preserve-by-move. Do **not** delete. Do **not** restart. Do **not** apply.

### 1.1 Inspect (read-only)

On `aisandbox-staging`:

1. `hostname`
2. `git -C /opt/aisandbox status --short`
3. Confirm source exists as a directory:
   `/opt/aisandbox/services/ai-service/dist.outgoing-20260910T082304Z-467f0d51`
4. Record `ls -ld`, `du -sh`, and top-level `ls -la` (bounded)

STOP without move if the source path is missing.

### 1.2 Preserve directory

Create `/home/ubuntu/aisb-preserved/` if needed (`mkdir -p` of that parent only).

### 1.3 Move (not delete)

```text
mv /opt/aisandbox/services/ai-service/dist.outgoing-20260910T082304Z-467f0d51 \
   /home/ubuntu/aisb-preserved/dist.outgoing-20260910T082304Z-467f0d51
```

STOP without overwrite if the destination already exists. Do not `rm`. Do not `rm -rf`.

### 1.4 Post-move git status

`git -C /opt/aisandbox status --short`

- Empty porcelain, or only known unrelated dirt: record PASS for this hygiene (does not authorize APPLY-01 retry).
- Additional dirty items: STOP further work; record them; do not apply/restart.

### 1.5 Forbidden

Delete of the artifact; PM2 restart/stop/start/save; `git pull` / fetch / reset / stash; `npm run build`; Vite/container-manager apply; `.env` read/edit; Docker/Postgres/Redis; AWS APIs; provider/credit; EXEC-01C6A reopen; PREVIEW-NODE-STAGING-APPLY-01 Step 3 retry; Git commit/push.

---

## 2. Remote inspection summary

SSH `aisandbox-staging` as `ubuntu` (BatchMode). Host `ip-172-26-6-228`. Toplevel `/opt/aisandbox`. Branch `main`. HEAD `b6b94516aff9981101ae8815aec2e2d36b8b231b` (unchanged; no git mutation).

**Pre-move `git -C /opt/aisandbox status --short`:** exactly one untracked item:

```text
?? services/ai-service/dist.outgoing-20260910T082304Z-467f0d51/
```

No other dirty items.

| Fact | Value |
|---|---|
| Path | `/opt/aisandbox/services/ai-service/dist.outgoing-20260910T082304Z-467f0d51` |
| Type | directory (`drwxrwxr-x` ubuntu:ubuntu) |
| mtime | Jul 27 11:37 (directory); parent `ai-service` listing dated Sep 10 16:23 |
| Size | `2.6M` (`du -sh`) |
| Preserve parent | `/home/ubuntu/aisb-preserved/` was absent before `mkdir -p` |
| Destination before move | absent |

**Top-level contents:** compiled Nest `ai-service` dist tree (`main.js`, `app.module.js`, `tsconfig.tsbuildinfo`, `__tests__`, `agent-harness`, `ai-execution`, `claude`, `clients`, `config`, `conversations`, `errors`, `internal`, `messages`, `metrics`, `observability`, `queue`, `quota`, `streaming`, `worker`). Consistent with a preserved outgoing dist artifact, not live source.

---

## 3. Move result

`MOVED_OK=YES`

Exact destination:

```text
/home/ubuntu/aisb-preserved/dist.outgoing-20260910T082304Z-467f0d51
```

| Check | Result |
|---|---|
| Destination after move | `drwxrwxr-x` ubuntu:ubuntu; mtime Jul 27 11:37 preserved |
| Destination size | `2.6M` |
| Source gone | `SRC_GONE=YES` (`SRC_ABSENT`) |
| Delete used | NO (`mv` only) |
| Destination overwrite | NO (dest did not exist) |

Remote helper scripts `/tmp/aisb-hygiene-01-inspect.sh` and `/tmp/aisb-hygiene-01-move.sh` were removed after use. Local copies were not left in the repo.

---

## 4. Final remote git status

`git -C /opt/aisandbox status --short` → **empty** (`wc -c` = 0).

Remote worktree is clean. No additional dirty items.

Staging HEAD remains `b6b94516aff9981101ae8815aec2e2d36b8b231b` on `main`.

---

## 5. Control-plane end state

- Occupancy: Lane 1 EMPTY, Lane 2 EMPTY, Lane 3 DISABLED, GOVERNANCE UNOWNED
- Occupancy hash unchanged: `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d`
- Sidecar: no PREVIEW-NODE-STAGING-HYGIENE-01 implementation candidate (GOVERNANCE)
- PREVIEW-NODE-STAGING-APPLY-01 candidate unchanged: `status=READY` / `writeSetPrecision=EXACT` / `admissionUncertain=true` (not in S)
- `stagingAuthorized=false`. `STAGING_EXECUTION_AUTHORIZED=NO`. Hygiene used a named `mv` only.
- EXEC-01C6A `startCondition=NOT_READY` UNCHANGED / not reopened
- BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON
- PREVIEW-NODE-STAGING-APPLY-01 Step 3 retry NOT AUTHORIZED
- PREVIEW-NODE-STAGING-01 Step 4 NOT AUTHORIZED

---

## 6. Confirmation (this window)

| Action | Done? |
|---|---|
| Delete artifact | **NO** (moved, not deleted) |
| PM2 restart / stop / start / save | **NO** (PM2 not invoked) |
| Apply / build / deploy / git pull | **NO** |
| `.env` read or edit | **NO** |
| Docker / Postgres / Redis / AWS / provider / credit | **NO** |
| Git commit / push | **NO** |
| APPLY-01 Step 3 retry | **NO** |
| EXEC-01C6A reopen | **NO** |

**Activation effect:** NONE for product/apply. Hygiene only: untracked dist.outgoing artifact now lives outside `/opt/aisandbox`.
**Rollback boundary:** move the preserved directory back to `/opt/aisandbox/services/ai-service/dist.outgoing-20260910T082304Z-467f0d51/` if this hygiene must be undone. Do not delete the preserved copy to “undo.”
**Follow-on:** later Keith-authorized PREVIEW-NODE-STAGING-APPLY-01 Step 3 retry may proceed against a clean remote worktree. Do not start that retry in this window.
