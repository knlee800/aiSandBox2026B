# PRIVATE-BETA-STAGING-EXECUTION-04C — Package Manager / Lockfile Decision Report

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04C-PACKAGE-MANAGER-DECISION  
**Parent task:** PRIVATE-BETA-STAGING-EXECUTION-04C — Dependency Install + Build  
**Date:** 2026-07-26  
**Nature:** Documentation / source-analysis decision only — no server action — no install — no build — no env access — no secrets disclosed — no subagents used.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Decision task | PRIVATE-BETA-STAGING-EXECUTION-04C-PACKAGE-MANAGER-DECISION |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04C |
| Grandparent | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL blocker for 04C install |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| VPS repo path | `/opt/aisandbox` |
| Inherited commit | `c55a278` |

---

## 2. Current Blocker

During live VPS 04C pre-check, Keith ran lockfile detection under `/opt/aisandbox` and **no package lockfile paths were printed**.

Root `package.json` reports:

- `packageManager` = `bun@1.x`
- `workspaces` = `["services/*", "frontend"]`

The 04C runbook expected a root `package-lock.json` and preferred `npm ci`. Live VPS evidence does **not** show that lockfile. **04C install/build is stopped before install.**

---

## 3. Live VPS Evidence

Exact safe commands Keith ran:

```text
cd /opt/aisandbox
find /opt/aisandbox -maxdepth 3 \( -name package-lock.json -o -name npm-shrinkwrap.json -o -name pnpm-lock.yaml -o -name yarn.lock -o -name bun.lock -o -name bun.lockb \) -print
node -p "require('./package.json').packageManager || 'no packageManager field'"
node -p "JSON.stringify(require('./package.json').workspaces || [], null, 2)"
```

Exact safe output recorded:

```text
bun@1.x
[
  "services/*",
  "frontend"
]
```

Interpretation:

- No lockfile paths printed on VPS.
- Root `packageManager` is `bun@1.x`.
- Root workspaces exist.
- 04C runbook expected root `package-lock.json`, but live VPS evidence does not show it.
- 04C install/build remains stopped before install.

---

## 4. Files Reviewed

| # | Path | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Active 04C / staging status |
| 2 | `TASKS_BACKLOG_FULL.md` | Backlog mirror / 04C status |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Active staging roadmap |
| 4 | `docs/PRIVATE-BETA-STAGING-EXECUTION-04C-DEPENDENCY-INSTALL-BUILD-RUNBOOK.md` | 04C install/build runbook |
| 5 | `docs/PRIVATE-BETA-STAGING-EXECUTION-04B-CHECKPOINT.md` | Inherited 04B final state |
| 6 | `docs/PRIVATE-BETA-STAGING-SETUP-04-RUNTIME-CONTAINER-DEPLOYMENT-PLAN.md` | Staging package-manager policy |
| 7 | `docs/PRIVATE-BETA-STAGING-EXECUTION-02-CHECKPOINT.md` | Runtime baseline (Node/npm; no Bun) |
| 8 | `package.json` | Root packageManager + workspaces |
| 9 | `package-lock.json` (local disk presence check) | Local lockfile inventory |
| 10 | `bun.lock` / `bun.lockb` / `pnpm-lock.yaml` / `yarn.lock` (presence checks) | Lockfile inventory |
| 11 | `.gitignore` | Lockfile ignore policy |
| 12 | `frontend/package.json` | Workspace package metadata |
| 13 | `services/api-gateway/package.json` | Workspace package metadata |
| 14 | `services/ai-service/package.json` | Workspace package metadata |
| 15 | `services/container-manager/package.json` | Workspace package metadata |

No `.env` or secret-bearing files were opened.

---

## 5. Local Lockfile Inventory

| Path | Present on local disk? | Notes |
|------|------------------------|-------|
| Root `package-lock.json` | **Yes** (local working tree only) | `lockfileVersion` 3; name `aisandbox`; ~1206 packages entries; ~596 KB |
| Root `bun.lock` | **No** | Absent |
| Root `bun.lockb` | **No** | Absent |
| Root `pnpm-lock.yaml` | **No** | Absent |
| Root `yarn.lock` | **No** | Absent |
| Root `npm-shrinkwrap.json` | **No** | Absent |
| `frontend/` lockfile | **No** | Absent |
| `services/api-gateway/package-lock.json` | **Yes** (local disk) | Nested npm lockfile present locally |
| `services/ai-service/` lockfile | **No** | Absent |
| `services/container-manager/` lockfile | **No** | Absent |

Important: local presence of an untracked/gitignored `package-lock.json` does **not** mean a VPS git clone will have it.

---

## 6. Git-Tracked Lockfile Finding

Commands used (safe):

```text
git ls-files -- package-lock.json bun.lock bun.lockb pnpm-lock.yaml yarn.lock **/package-lock.json ...
git check-ignore -v package-lock.json yarn.lock pnpm-lock.yaml bun.lock bun.lockb
```

Findings:

| Finding | Result |
|---------|--------|
| Any root `package-lock.json` tracked by git? | **No** |
| Any `bun.lock` / `bun.lockb` tracked? | **No** |
| Any `pnpm-lock.yaml` / `yarn.lock` tracked? | **No** |
| Only lock-like tracked file found | `skills-lock.json` (unrelated Cursor/skills artifact — not an npm/bun install lockfile) |
| `.gitignore` ignores `package-lock.json` | **Yes** (line-level ignore) |
| `.gitignore` ignores `yarn.lock` | **Yes** |
| `.gitignore` ignores `pnpm-lock.yaml` | **Yes** |
| `.gitignore` ignores `bun.lock` / `bun.lockb` | **No explicit ignore found** |

Conclusion: **No official install lockfile is git-tracked.** A clean clone to `/opt/aisandbox` is expected to lack `package-lock.json`. Keith’s VPS result matches git policy, not a clone failure.

---

## 7. Package Manager Field Finding

| Package | `packageManager` field |
|---------|------------------------|
| Root `aisandbox` | **`bun@1.x`** |
| `frontend` | Absent |
| `services/api-gateway` | Absent |
| `services/ai-service` | Absent |
| `services/container-manager` | Absent |

Root also declares:

```json
"engines": { "node": ">=20.0.0" }
```

So metadata simultaneously:

- Declares Bun via `packageManager`
- Requires Node >= 20 via `engines`
- Declares npm-style workspaces

This is ambiguous for staging install policy.

---

## 8. Workspace Finding

Root workspaces (confirmed locally and on VPS):

```json
[
  "services/*",
  "frontend"
]
```

Interpretation:

- Install should be workspace-aware from repo root once package-manager policy is decided.
- Per-package installs without a clear root lockfile policy are higher risk and must not be improvised during 04C.

---

## 9. Runtime Baseline Relevance

From PRIVATE-BETA-STAGING-EXECUTION-02 (COMPLETE and LOCKED) and SETUP-04 plan:

| Item | Staging baseline |
|------|------------------|
| OS | Ubuntu 24.04.4 LTS |
| Node.js | v20.20.2 |
| npm | 10.8.2 |
| Bun | **Not installed / not part of runtime baseline** |
| Staging package-manager decision (SETUP-04) | **Use npm on staging; bun not used for staging** |
| SETUP-04 lockfile status at planning time | Explicitly **UNKNOWN** — verify at execution |
| SETUP-04 fallback note | If lockfile missing, `npm install` may be needed first — execution-time concern |

Relevance:

- Runtime baseline covers **Node + npm**, not Bun.
- SETUP-04 preferred npm + `npm ci` when lockfile exists.
- SETUP-04 also acknowledged lockfile presence was unknown.
- Current evidence shows **no tracked lockfile**, so SETUP-04’s preferred `npm ci` path is not currently available on VPS.
- `packageManager: bun@1.x` conflicts with the staging “use npm / bun not used” decision unless Bun is treated as local-dev only **and** an npm lockfile policy is finalized.

---

## 10. Risk Assessment

| Risk | Severity | Notes |
|------|----------|-------|
| Run `npm ci` with no lockfile | High | Will fail; no lockfile on VPS |
| Run `npm install` without lockfile | High | Non-reproducible dependency graph; may mutate tree; staging drift risk |
| Install Bun ad hoc and proceed | High | Outside EXECUTION-02 runtime baseline; version pin / security / ops unknown |
| Treat local untracked `package-lock.json` as authoritative | High | Not in git; VPS cannot receive it via clone; may differ from future committed lock |
| Proceed with 04C install now | High | Package-manager policy unresolved |
| Leave 04C runbook claiming root lockfile “Present” | High | Factually wrong for git/VPS state; caused the current false expectation |

---

## 11. Decision Outcome

### Outcome E — Source unclear

**Chosen outcome: E**

Why not the others:

| Outcome | Why not chosen |
|---------|----------------|
| **A** — Use npm with existing tracked root `package-lock.json` | Root `package-lock.json` is **not** git-tracked. VPS absence is expected, not a clone mismatch. |
| **B** — Use Bun | `packageManager` says `bun@1.x`, but no bun lockfile exists, Bun is not on the runtime baseline, and SETUP-04 explicitly says staging uses npm / bun not used. No safe Bun install plan approved. |
| **C** — Create official lockfile first | Attractive if staging npm policy is reaffirmed, but `.gitignore` currently ignores `package-lock.json`, and root metadata still declares Bun. Creating/committing an npm lockfile requires a formal policy choice first (including whether to stop ignoring npm lockfiles). |
| **D** — `npm install` without lockfile | Not recommended. No explicit acceptance of reproducibility risk for this staging slice. 04C runbook itself forbids improvising `npm install` without amendment + justification. |

**Verdict:** Package-manager / lockfile policy is **not clear enough** to authorize any 04C dependency install command.

---

## 12. Recommended Next Action

**Exact action Keith should take next:**

1. **Do not install dependencies.**
2. **Do not build.**
3. **Do not start app services.**
4. Keep `/opt/aisandbox/.env` private and unprinted.
5. Treat 04C manual install as **PAUSED / BLOCKED** pending a formal package-manager policy decision.
6. In a later Cursor governance step, register and decide a bounded policy task that chooses **one** of:
   - **npm staging path:** stop ignoring / intentionally generate + commit root `package-lock.json`, sync VPS, then resume 04C with `npm ci`; or
   - **Bun staging path:** amend runtime baseline, install pinned Bun on VPS, generate + commit `bun.lock`/`bun.lockb`, then resume 04C with Bun; or
   - **Explicit non-lockfile npm risk acceptance:** only if formally approved, amend 04C to `npm install` and accept non-reproducibility.

Until that policy task completes, Keith should not continue 04C Sections 13–16 install/build.

---

## 13. Required 04C Runbook Amendment

Yes — amend `docs/PRIVATE-BETA-STAGING-EXECUTION-04C-DEPENDENCY-INSTALL-BUILD-RUNBOOK.md` to:

1. Record this blocker and Outcome E.
2. Correct the false local finding that root `package-lock.json` is present for VPS/git purposes.
3. State clearly that **no install command is authorized** until package-manager policy is decided.
4. Change Exact Next Action from “Keith executes install/build” to “stop; wait for policy decision.”

This amendment does **not** authorize a new install path.

---

## 14. Stop Conditions

Stop immediately (already triggered):

| # | Condition | Status |
|---|-----------|--------|
| 1 | Lockfile / package manager unclear | **Triggered** |
| 2 | VPS has no lockfile while runbook assumed root `package-lock.json` | **Triggered** |
| 3 | `packageManager: bun@1.x` conflicts with staging npm baseline without Bun runtime | **Triggered** |
| 4 | No tracked official lockfile in git | **Triggered** |

Do not invent workarounds. Do not install. Do not build.

---

## 15. Secret Safety Confirmation

| Check | Confirmed |
|-------|-----------|
| No `.env` opened | Yes |
| No env values printed | Yes |
| No secrets disclosed | Yes |
| No SSH / AWS CLI / server action in this Cursor step | Yes |
| No dependency install | Yes |
| No build | Yes |
| No Docker / PostgreSQL / Redis action | Yes |
| No source/package/lockfile files modified | Yes |
| No git commit / push | Yes |
| No subagents used | Yes |

---

## Answers to Required Questions

1. **Does the local repo currently contain any lockfile?**  
   Yes on disk: untracked/gitignored root `package-lock.json` and local `services/api-gateway/package-lock.json`. No `bun.lock` / `bun.lockb` / `pnpm-lock.yaml` / `yarn.lock`.

2. **Is any lockfile tracked by git?**  
   No install lockfile is tracked. Only unrelated `skills-lock.json` appears in `git ls-files` lock-like names.

3. **Was the 04C runbook wrong to assume root `package-lock.json` exists?**  
   Yes — wrong for git-tracked / VPS clone state. Local untracked lockfile existence was over-interpreted as deployable authority.

4. **Does `packageManager=bun@1.x` mean staging should install Bun?**  
   Not by itself. It is a strong signal for Bun intent, but staging SETUP-04 + EXECUTION-02 baseline chose npm and did not install Bun. Requires formal policy decision.

5. **Is Bun installed on the VPS baseline, according to prior runtime docs?**  
   No. Baseline is Node.js v20.20.2 + npm 10.8.2. Bun is not covered.

6. **Is it safe to run `npm install` without a lockfile in this task?**  
   No — not recommended for 04C without explicit risk acceptance.

7. **Safer option among the listed choices?**  
   Stop 04C until package-manager policy is formally decided (Outcome E). Then, if npm is reaffirmed, prefer creating/committing an official lockfile in a separate source task before resume.

8. **What exact action should Keith take next?**  
   Stop. Do not install/build. Wait for a formal package-manager policy decision task; keep secrets private.

---

## Final Decision Line

**OUTCOME E — Source unclear. 04C dependency install remains blocked. Register/complete a package-manager policy decision before any install.**
