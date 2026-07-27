# PRIVATE-BETA-STAGING-EXECUTION-04C — Package Manager Policy

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04C-PACKAGE-MANAGER-POLICY  
**Parent task:** PRIVATE-BETA-STAGING-EXECUTION-04C — Dependency Install + Build  
**Predecessor decision:** PRIVATE-BETA-STAGING-EXECUTION-04C-PACKAGE-MANAGER-DECISION — Outcome E (Source unclear) — 2026-07-26  
**Date:** 2026-07-27  
**Nature:** Governance / policy decision only — no server action — no install — no build — no env access — no secrets disclosed — no source/package/lockfile implementation changes — no git commit/push — no subagents used.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Policy task | PRIVATE-BETA-STAGING-EXECUTION-04C-PACKAGE-MANAGER-POLICY |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04C |
| Grandparent | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL blocker for 04C install |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| VPS repo path | `/opt/aisandbox` |
| Inherited commit | `c55a278` |
| Preceding decision report | `docs/PRIVATE-BETA-STAGING-EXECUTION-04C-PACKAGE-MANAGER-DECISION-REPORT.md` |
| Preceding 04C runbook | `docs/PRIVATE-BETA-STAGING-EXECUTION-04C-DEPENDENCY-INSTALL-BUILD-RUNBOOK.md` |

---

## 2. Current Blocker

04C is **ACTIVE — PAUSED / BLOCKED before install**.

Prior decision Outcome **E — Source unclear** recorded that:

- Live VPS under `/opt/aisandbox` has **no lockfile paths**
- Root `package.json` declares `packageManager=bun@1.x`
- Workspaces are `services/*` and `frontend`
- Staging runtime baseline has Node.js + npm only (no Bun)
- Local root `package-lock.json` exists but is **gitignored / untracked**
- `npm install` without lockfile is not recommended
- 04C runbook currently authorizes **no install command**

This policy task chooses exactly one official staging package-manager path so a later bounded source/runtime task can implement it safely before 04C resume.

---

## 3. Live VPS Evidence

From Keith live pre-check (recorded in the Outcome E decision report):

```text
cd /opt/aisandbox
find /opt/aisandbox -maxdepth 3 \( -name package-lock.json -o -name npm-shrinkwrap.json -o -name pnpm-lock.yaml -o -name yarn.lock -o -name bun.lock -o -name bun.lockb \) -print
# (no lockfile paths printed)

node -p "require('./package.json').packageManager || 'no packageManager field'"
# bun@1.x

node -p "JSON.stringify(require('./package.json').workspaces || [], null, 2)"
# ["services/*", "frontend"]
```

Interpretation:

- Clean git clone at commit `c55a278` has no install lockfile on disk.
- Root metadata declares Bun + npm workspaces.
- No install/build has occurred on VPS.

---

## 4. Local Repo Evidence

| Path | Finding |
|------|---------|
| Root `package.json` | Present — `packageManager: bun@1.x` — workspaces `services/*`, `frontend` — `engines.node >=20.0.0` |
| Root `package-lock.json` | Present on local disk only — ~595,738 bytes — `lockfileVersion` 3 — name `aisandbox` — last write observed 2026-07-09 |
| Root lockfile workspaces | Includes `frontend`, `services/ai-service`, `services/api-gateway`, `services/container-manager` |
| Root package entry count | ~1206 `packages` keys |
| Root `bun.lock` / `bun.lockb` | Absent |
| Root `pnpm-lock.yaml` / `yarn.lock` / `npm-shrinkwrap.json` | Absent |
| `frontend/package.json` | No `packageManager` field — npm-compatible scripts (`next build`) |
| `services/*/package.json` | No `packageManager` field — npm-compatible scripts (`tsc` build) |
| Nested `services/api-gateway/package-lock.json` | Present locally (~374 KB) — also gitignored / not authoritative for VPS clone |

---

## 5. Lockfile Tracking Evidence

| Check | Result |
|-------|--------|
| `git ls-files` for install lockfiles | None tracked (`package-lock.json`, `bun.lock`, `bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`) |
| `git status --ignored -- package-lock.json` | `!! package-lock.json` (ignored) |
| VPS absence of lockfile | Explained by git ignore / non-tracking — not a clone failure |
| Official install lockfile in git | **None** |

Conclusion: staging cannot use `npm ci` until a root `package-lock.json` is intentionally tracked and deployed.

---

## 6. `.gitignore` Finding

`.gitignore` line 6 ignores:

```text
package-lock.json
```

Also ignores `yarn.lock` and `pnpm-lock.yaml`.

No explicit ignore for `bun.lock` / `bun.lockb` was found, but no Bun lockfile exists locally or on VPS.

**Policy implication:** if npm + tracked lockfile is chosen, `.gitignore` must later stop ignoring the **root** `package-lock.json` (or otherwise allow tracking it) in a separate source task. That change is **not** performed in this decision step.

---

## 7. Package Manager Field Finding

| Location | `packageManager` |
|----------|------------------|
| Root `aisandbox` | `bun@1.x` |
| `frontend` | Absent |
| `services/api-gateway` | Absent |
| `services/ai-service` | Absent |
| `services/container-manager` | Absent |

Root also declares npm workspaces and Node `engines`. Metadata is ambiguous if read alone, but staging planning already resolved the operational intent.

---

## 8. Runtime Baseline Finding

From PRIVATE-BETA-STAGING-EXECUTION-02 (COMPLETE and LOCKED) and SETUP-04:

| Item | Staging baseline / plan |
|------|-------------------------|
| OS | Ubuntu 24.04.4 LTS |
| Node.js | v20.20.2 |
| npm | 10.8.2 |
| Bun | **Not installed / not part of runtime baseline** |
| SETUP-04 staging package manager | **Use npm; Bun not used for staging** |
| SETUP-04 local-dev note | Bun may be used locally per root `packageManager` |
| Preferred install when lockfile exists | Root `npm ci` |
| Docker frontend build path | Already uses root-context `npm ci` (BUILD-FRONTEND-01) |

**Verdict:** staging already has a Node/npm runtime. Bun would require a new runtime baseline task. No evidence proves Bun is required for staging builds.

---

## 9. npm Option Analysis

### Pros

- Matches EXECUTION-02 runtime baseline (Node + npm already present).
- Matches SETUP-04 staging decision (npm; Bun local-dev only).
- Matches 04C / SETUP-07 preferred deterministic path (`npm ci`).
- Matches existing frontend Docker build pattern (`npm ci`).
- Local root `package-lock.json` already exists and already covers workspace packages.
- Reproducible installs once lockfile is tracked and present on VPS.

### Cons / required follow-through

- Root lockfile is currently gitignored and untracked.
- VPS will not receive lockfile until source change is committed and pulled.
- Local lockfile may be stale relative to current `package.json` files (observed last write 2026-07-09) and must be intentionally refreshed/validated before commit.
- Nested local `services/api-gateway/package-lock.json` must not become the staging authority.

### Staging posture if chosen

Official staging package manager = **npm**.  
Authorized future install command after implementation + VPS sync = **root `npm ci`**.

---

## 10. Bun Option Analysis

### Pros

- Root `packageManager=bun@1.x` signals Bun intent for some local workflows.

### Cons / blockers

- No `bun.lock` / `bun.lockb` exists locally or on VPS.
- Bun is not on EXECUTION-02 runtime baseline.
- SETUP-04 explicitly chose npm for staging and deferred any Bun VPS install to a separate decision.
- Choosing Bun now would require installing/pinning Bun on VPS, amending runtime docs, generating and tracking a Bun lockfile, and rewriting 04C install/build commands.
- No strong evidence that staging builds require Bun.

### Verdict

Bun is **not** required for staging. Do not choose Outcome B.

---

## 11. npm-Without-Lockfile Risk Analysis

Running `npm install` on VPS without a tracked lockfile would:

- Resolve a non-reproducible dependency graph at install time
- Risk staging drift vs local/CI/Docker
- Possibly mutate or create lockfiles on the server outside git authority
- Violate preferred safety posture for private-beta staging

SETUP-04 mentioned `npm install` as a planning-time fallback when lockfile presence was UNKNOWN. Live evidence has now clarified the cause (gitignore). That fallback is **not** accepted for 04C.

### Verdict

Do not choose Outcome C.

---

## 12. Decision Outcome

### Outcome A — npm policy with tracked lockfile

**Chosen outcome: A**

| Rejected outcome | Why rejected |
|------------------|--------------|
| **B — Bun policy** | Bun not on runtime baseline; no Bun lockfile; SETUP-04 already chose npm for staging; Bun not proven required |
| **C — npm without lockfile** | Reproducibility risk intentionally rejected |
| **D — keep blocked pending broader cleanup** | Source is clear enough: staging should use npm; blocker is missing tracked lockfile, not unknown package manager |

**Official staging package-manager policy:**

1. Staging uses **npm** (Node.js 20 + bundled npm already on VPS).
2. Staging install must use a **tracked root `package-lock.json`** and **`npm ci`** from `/opt/aisandbox`.
3. Bun is **local-dev only** for staging purposes; Bun is not the staging package manager.
4. Non-lockfile `npm install` is **not authorized** for 04C staging install.
5. 04C remains paused until the npm lockfile tracking source task is implemented, committed, pulled to VPS, and the 04C runbook is amended to authorize root `npm ci`.

---

## 13. Required Next Implementation Task

Register and complete a separate bounded **source** task (recommended ID):

**`PRIVATE-BETA-STAGING-EXECUTION-04C-NPM-LOCKFILE-TRACKING`**

Scope (source/docs only — no VPS install/build in that task unless later explicitly split):

1. Stop ignoring root `package-lock.json` in `.gitignore` (keep ignoring nested accidental lockfiles if needed, but root must be trackable).
2. Intentionally add/refresh root `package-lock.json` against current workspace `package.json` files.
3. Verify the refreshed lockfile covers workspaces: `frontend`, `services/api-gateway`, `services/ai-service`, `services/container-manager`.
4. Amend 04C runbook (and related staging docs if needed) to authorize **only** root `npm ci` after the lockfile is present on VPS.
5. Do **not** perform staging dependency install/build in that source task.
6. Optionally clarify `packageManager=bun@1.x` as local-dev-only metadata, or defer that package.json metadata cleanup to a follow-up — do not block lockfile tracking on Bun metadata cleanup.

After that source task is merged/available on `main`, a later 04C resume step must `git pull` on VPS so `/opt/aisandbox/package-lock.json` exists before `npm ci`.

---

## 14. Required 04C Runbook Amendment

Yes — later amendment required (not in this decision step beyond recording policy status in governance).

When the npm lockfile tracking source task completes, amend:

`docs/PRIVATE-BETA-STAGING-EXECUTION-04C-DEPENDENCY-INSTALL-BUILD-RUNBOOK.md`

to:

1. Replace Outcome E “no install authorized” with Outcome A policy.
2. Require root `package-lock.json` present on VPS before install.
3. Authorize exactly one install command: `cd /opt/aisandbox && npm ci`.
4. Keep build commands as package-local `npm run build` after successful `npm ci`.
5. Continue forbidding services/migrations/DNS/TLS/secret printing.

Until that amendment + VPS lockfile presence, Sections 13–16 remain blocked.

---

## 15. 04C Status Recommendation

| Item | Recommendation |
|------|----------------|
| PRIVATE-BETA-STAGING-EXECUTION-04C | Remains **ACTIVE — PAUSED / BLOCKED before install** |
| Install/build | Still unauthorized |
| Parent EXECUTION-04 | Remains ACTIVE |
| PRIVATE-BETA-DEPLOYMENT-READINESS | Remains BLOCKED / PAUSED |
| Resume condition | npm lockfile tracking implemented + available on VPS + 04C runbook amended to authorize root `npm ci` |

---

## 16. Secret Safety Confirmation

| Check | Confirmed |
|-------|-----------|
| No `.env` opened | Yes |
| No env values printed | Yes |
| No secrets disclosed | Yes |
| No SSH / AWS CLI / server action | Yes |
| No dependency install | Yes |
| No build | Yes |
| No Docker / PostgreSQL / Redis action | Yes |
| No production secrets modified | Yes |

---

## 17. No-Go Confirmations

| No-go | Confirmed |
|-------|-----------|
| No install/build | Yes |
| No app services started | Yes |
| No migrations | Yes |
| No DNS/TLS | Yes |
| No source/package/lockfile implementation edits in this step | Yes |
| No `.gitignore` change in this step | Yes |
| No git commit / push | Yes |
| No subagents used | Yes |

---

## 18. Exact Next Action

**Keith’s exact next Cursor action:**

Register and implement the bounded source task  
**`PRIVATE-BETA-STAGING-EXECUTION-04C-NPM-LOCKFILE-TRACKING`**  
to stop ignoring / intentionally refresh / track root `package-lock.json`, ensure workspace coverage, and amend the 04C runbook to authorize root `npm ci` only — with **no** staging install/build yet.

Until that task completes and the tracked lockfile is present on `/opt/aisandbox`, do **not** resume 04C Sections 13–16.

---

## Answers to Required Questions

1. **Official package manager for staging:** **npm**
2. **`packageManager=bun@1.x`:** Treat as **local-dev only** for staging; change/clarify later in the npm lockfile tracking task or a follow-up — do not treat as staging authority.
3. **Should root `package-lock.json` be tracked?** **Yes**
4. **Should `.gitignore` stop ignoring root `package-lock.json`?** **Yes** (in the later source task)
5. **Is existing local `package-lock.json` trustworthy enough to commit now?** **Useful candidate only** — structure covers workspaces, but it is untracked/gitignored and may be stale (last write ~2026-07-09). Refresh/validate intentionally in the later source task before commit. Do not treat today’s local file as already-approved deployable authority.
6. **If npm chosen, exact later source task before resuming 04C:** `PRIVATE-BETA-STAGING-EXECUTION-04C-NPM-LOCKFILE-TRACKING` (track/refresh root lockfile + amend runbook; no VPS install yet)
7. **If Bun chosen, exact later runtime task:** N/A — Bun not chosen
8. **Should 04C remain paused until policy implemented and deployed to VPS?** **Yes**
9. **Exact next Cursor action:** Register/implement `PRIVATE-BETA-STAGING-EXECUTION-04C-NPM-LOCKFILE-TRACKING`

---

## Final Decision Line

**OUTCOME A — npm policy with tracked lockfile. Staging package manager is npm. 04C remains paused until root `package-lock.json` is tracked, refreshed, deployed to VPS, and the 04C runbook authorizes root `npm ci`.**
