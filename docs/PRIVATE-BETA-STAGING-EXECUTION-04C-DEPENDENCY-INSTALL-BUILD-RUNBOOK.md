# PRIVATE-BETA-STAGING-EXECUTION-04C — Dependency Install + Build Runbook

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04C
**Title:** Dependency Install + Build
**Step:** 2 — Dependency Install + Build Runbook
**Date created:** 2026-07-26
**Last amended:** 2026-07-27 — PRIVATE-BETA-STAGING-EXECUTION-04C-NPM-LOCKFILE-TRACKING (Outcome A implemented locally)
**Nature:** Runbook for Keith manual execution inside AWS Lightsail browser SSH. Source/docs lockfile-policy amendments may occur in Cursor; no VPS install/build in the lockfile-tracking source task. No env files opened/created/edited. No secrets disclosed. No subagents used.

---

## POLICY NOTICE — Package Manager Resolved (Outcome A) — 2026-07-27

**Status:** Package-manager policy is **resolved**. 04C install/build remains **ACTIVE — PAUSED** until the tracked root lockfile is present on the VPS.

**Policy decision:** Outcome **A — npm with tracked root package-lock.json**  
**Policy doc:** `docs/PRIVATE-BETA-STAGING-EXECUTION-04C-PACKAGE-MANAGER-POLICY.md`  
**Prior Outcome E report (historical):** `docs/PRIVATE-BETA-STAGING-EXECUTION-04C-PACKAGE-MANAGER-DECISION-REPORT.md`  
**Source implementation task:** `PRIVATE-BETA-STAGING-EXECUTION-04C-NPM-LOCKFILE-TRACKING` — implemented locally 2026-07-27

### Policy facts (authoritative)

| Item | Decision |
|------|----------|
| Official staging package manager | **npm** |
| Root `package-lock.json` | **Intentionally tracked** in git (`.gitignore` allows root via `!/package-lock.json`; nested `package-lock.json` remains ignored) |
| `packageManager=bun@1.x` | **Local-dev only** for staging until separately changed — **not** staging install authority |
| Authorized install command (after VPS sync) | Root **`npm ci`** only: `cd /opt/aisandbox && npm ci` |
| Bun for staging 04C | **Do not use** |
| `npm install` on VPS | **Do not use** |
| Install/build authorization | **Not authorized** until `/opt/aisandbox/package-lock.json` exists on the VPS |

### Resume / stop rules for install

1. If `/opt/aisandbox/package-lock.json` is **still missing** on VPS → **STOP**. Sync/pull the tracked lockfile (commit containing root `package-lock.json`) before any install.
2. Only after the tracked root lockfile is present on VPS may Keith run root `npm ci`.
3. Do **not** use Bun for staging 04C.
4. Do **not** use `npm install` on VPS.
5. No install/build is authorized until the tracked root lockfile is present on the VPS.

**Authorized action now (local source task complete):** Commit/push is out of scope for the lockfile-tracking Cursor step. Next human action is to get the tracked root lockfile onto `/opt/aisandbox`, then resume Section 12 lockfile check and Sections 13–16 with root `npm ci` only.

---

## HISTORICAL BLOCKER NOTICE — Outcome E (2026-07-26) — SUPERSEDED

**Superseded by Outcome A + NPM-LOCKFILE-TRACKING (2026-07-27).** Retained for audit only.

Prior Outcome **E — Source unclear** recorded that VPS had no lockfile paths, root declared `packageManager=bun@1.x`, and no install lockfile was git-tracked. That blocked install until policy was decided. Policy is now Outcome A; remaining gate is **VPS presence of tracked root `package-lock.json`**.

---

## Section 1 — Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04C |
| Title | Dependency Install + Build |
| Parent task | PRIVATE-BETA-STAGING-EXECUTION-04 |
| Family | PRIVATE BETA / STAGING EXECUTION |
| Priority | CRITICAL |
| Nature | HIGH-RISK — real staging server action; dependency install and build on production-like VPS |
| Registered | 2026-07-26 |
| Instance | `aisandbox-staging` — Singapore / ap-southeast-1 |
| Runbook for | Keith — manual execution inside AWS Lightsail browser SSH only |
| Child slice | 3 of 4 of EXECUTION-04 manual execution split |

### Authoritative state carried forward

| Item | State |
|------|-------|
| PRIVATE-BETA-STAGING-EXECUTION-04A | COMPLETE and LOCKED — 2026-07-25 |
| PRIVATE-BETA-STAGING-EXECUTION-04B | COMPLETE and LOCKED — 2026-07-26 |
| PRIVATE-BETA-STAGING-EXECUTION-04B-GOOGLE-OAUTH-DECISION | COMPLETE and LOCKED — 2026-07-26 — Outcome B |
| PRIVATE-BETA-STAGING-EXECUTION-04C | ACTIVE — Step 1 COMPLETE (Registration — 2026-07-26) — PAUSED pending VPS lockfile sync |
| PRIVATE-BETA-STAGING-EXECUTION-04C-PACKAGE-MANAGER-POLICY | COMPLETE and LOCKED — 2026-07-27 — Outcome A |
| PRIVATE-BETA-STAGING-EXECUTION-04C-NPM-LOCKFILE-TRACKING | Implemented locally — 2026-07-27 — awaiting commit/VPS sync |
| Parent PRIVATE-BETA-STAGING-EXECUTION-04 | ACTIVE |
| PRIVATE-BETA-DEPLOYMENT-READINESS | BLOCKED / PAUSED |

---

## Section 2 — Purpose

This runbook tells Keith exactly what to do manually inside the AWS Lightsail browser SSH console during the EXECUTION-04C manual execution step.

The sole goal of this child slice is to install project dependencies and build app packages on the staging VPS — without:

- starting app services (PM2 / systemd app processes)
- running migrations
- configuring DNS or TLS
- enabling real AI / billing / container execution
- disclosing any secret value to this chat

This runbook is the authoritative reference for the 04C manual execution session. Follow it section by section without skipping.

---

## Section 3 — What 04C Does

When executed by Keith, this slice:

1. Confirms EXECUTION-04A / 04B final state is intact.
2. Creates a pre-install Lightsail snapshot as a rollback point.
3. Verifies repo path, owner, branch, and commit (must include tracked root `package-lock.json` after sync).
4. Verifies `/opt/aisandbox/.env` exists with owner `ubuntu:ubuntu` and chmod `600` **without printing values**.
5. Verifies Google OAuth keys remain intentionally omitted (no fake placeholders).
6. Confirms root `package-lock.json` is present on VPS (Outcome A).
7. Runs root **`npm ci`** only.
8. Discovers and runs safe build commands for frontend and services.
9. Captures safe install/build evidence summaries only.
10. Confirms no app services started, no migrations run, no DNS/TLS configured, and no secrets printed.

---

## Section 4 — What 04C Does Not Do

This slice does **not**:

- Start PM2 app processes or configure PM2 startup
- Start systemd app services (`aisandbox`, `api-gateway`, etc.)
- Run app health checks against started services
- Run database migrations (`migration:run`, `migration:run:prod`, `db:migrate`, `db:reset`)
- Create database tables
- Configure DNS A records
- Configure TLS / Caddy site routes / certificates
- Enable real AI provider calls
- Enable billing / payment execution
- Enable container execution
- Print `.env` contents or any secret env values
- Ask Keith to paste any secret value into chat
- Modify source code (unless a later separate task explicitly approves a build fix)
- Commit or push git
- Proceed to 04D (PM2 Service Start + Health-Only Smoke)
- Use Bun for staging install/build
- Use `npm install` on the VPS

---

## Section 5 — Preconditions from 04A/04B

Before starting manual execution, confirm all of the following:

| # | Precondition | Required state |
|---|-------------|----------------|
| 1 | EXECUTION-04A | COMPLETE and LOCKED — 2026-07-25 — Evidence verdict PASS |
| 2 | EXECUTION-04B | COMPLETE and LOCKED — 2026-07-26 — Evidence review verdict PASS |
| 3 | Google OAuth decision | COMPLETE and LOCKED — 2026-07-26 — Outcome B — deferred |
| 4 | EXECUTION-04C Step 1 (Registration) | COMPLETE — 2026-07-26 |
| 5 | Package-manager policy | COMPLETE and LOCKED — Outcome A — npm + tracked root lockfile |
| 6 | NPM lockfile tracking (local) | Implemented — root `package-lock.json` intended to be tracked |
| 7 | VPS tracked lockfile | `/opt/aisandbox/package-lock.json` **must exist** after sync/pull — if missing, STOP |
| 8 | Repo path | `/opt/aisandbox` exists |
| 9 | Repo owner | `ubuntu:ubuntu` |
| 10 | Repo branch | `main` |
| 11 | Repo commit | Must be a revision that includes tracked root `package-lock.json` (may be newer than `c55a278`) |
| 12 | `/opt/aisandbox/.env` | Exists privately |
| 13 | `.env` owner | `ubuntu:ubuntu` |
| 14 | `.env` chmod | `600` |
| 15 | Required non-Google keys | 47 present (from 04B) |
| 16 | Google OAuth keys | Intentionally omitted — no fake placeholders |
| 17 | Staging auth path | Email/password |
| 18 | Kill switches | Confirmed false (from 04B) |
| 19 | Dependency install | Not yet performed |
| 20 | Build | Not yet performed |
| 21 | App services | Not started |
| 22 | Migrations | Not run — public table count 0 |
| 23 | DNS/TLS | Not configured |
| 24 | Secrets | Not disclosed |
| 25 | Runtime baseline | Ubuntu 24.04.4 LTS — Node.js v20.20.2 — npm 10.8.2 — Docker Engine 29.6.2 — Docker Compose v5.3.1 — PM2 7.0.3 — Caddy v2.11.4 |
| 26 | Prior snapshots | Through `aisandbox-staging-postclone-preenv-2026-07-26` Available |

If any precondition is not met, stop and resolve before proceeding.

### Staging state inherited from 04B (record)

```text
VPS repo path: /opt/aisandbox
Repo owner: ubuntu:ubuntu
Branch: main
Commit: c55a278 (pre-lockfile baseline — must sync/pull to a revision with tracked package-lock.json before install)
/opt/aisandbox/.env exists privately
.env owner: ubuntu:ubuntu
.env chmod: 600
47 required non-Google keys present
Google OAuth deferred
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL intentionally omitted
No fake Google OAuth placeholders used
Email/password is intended staging auth path
Kill switches confirmed false
No secrets disclosed
No dependency install yet
No build yet
No app services started
No migrations run
No DNS/TLS configured
```

---

## Section 6 — Lightsail Browser SSH Instruction

**All server commands in this runbook must be run inside the AWS Lightsail browser SSH console.**

**Do NOT run server commands in PowerShell, CMD, or local terminal.**

**Do NOT use AWS CLI from this Cursor session.**

To open the Lightsail browser SSH console:

1. Log into AWS Console → Lightsail.
2. Select the `aisandbox-staging` instance.
3. Click **Connect using SSH** (or the terminal icon).
4. The browser SSH console opens.
5. Run all commands in that console.

Default user is `ubuntu`. Commands requiring root use `sudo`.

**Nano editor shortcuts in the Lightsail browser SSH session (if needed):**
- `Ctrl+O` then `Enter` — save (write out)
- `Ctrl+X` — exit
- **Do NOT use `Ctrl+W`** in Lightsail browser SSH — it may close the browser tab.

---

## Section 7 — Secret Safety Rules

These rules are **absolute** and must be followed at all times during this child slice.

| # | Rule |
|---|------|
| 1 | Do NOT paste any `.env` file contents into this chat or any AI tool |
| 2 | Do NOT run `cat /opt/aisandbox/.env` |
| 3 | Do NOT echo secret env values |
| 4 | Do NOT paste `DATABASE_URL` or `REDIS_URL` |
| 5 | Do NOT paste DB / Redis passwords |
| 6 | Do NOT paste JWT / session / internal keys (`JWT_SECRET`, `SESSION_SECRET`, `OAUTH_STATE_SECRET`, `INTERNAL_SERVICE_KEY`, etc.) |
| 7 | Do NOT paste provider keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) |
| 8 | Do NOT paste OAuth secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, etc.) |
| 9 | Do NOT paste SSH private keys or AWS credentials |
| 10 | `/opt/aisandbox/.env` may be used by tooling only as runtime input — never print it |
| 11 | Capture only safe summary logs; redact any accidental secret before pasting evidence |
| 12 | If any secret appears in logs or chat, **stop immediately** and rotate exposed secrets |

---

## Section 8 — Pre-Install Snapshot Recommendation

**Create this Lightsail snapshot before installing dependencies.**

### Recommended snapshot name

```text
aisandbox-staging-preinstall-build-2026-07-26
```

### Critical rules

- Snapshot is created in the **AWS Lightsail UI**, not by SSH.
- Wait until snapshot status is **Available**.
- Do **not** proceed if snapshot creation fails.
- Do **not** proceed if snapshot remains **Pending**.

### Snapshot instructions (Lightsail UI)

1. Open AWS Console → Lightsail → instance `aisandbox-staging`.
2. Open the **Snapshots** tab.
3. Create snapshot named exactly:

```text
aisandbox-staging-preinstall-build-2026-07-26
```

4. Wait until status shows **Available**.
5. Only then continue to Section 9.

### Why this snapshot matters

This is the rollback point immediately before dependency install and build. If install/build corrupts the working tree, fills disk unexpectedly, or leaves the host in a bad state, restore from this snapshot.

---

## Section 9 — Repo Baseline Verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Before install, ensure the VPS repo includes the tracked root lockfile (sync/pull first if still on pre-lockfile commit `c55a278`).

```bash
cd /opt/aisandbox
pwd
ls -ld /opt/aisandbox
git rev-parse --show-toplevel
git remote -v
git branch --show-current
git rev-parse HEAD
git log -1 --oneline
git status --short
test -f /opt/aisandbox/package-lock.json && echo "ROOT_PACKAGE_LOCK=yes" || echo "ROOT_PACKAGE_LOCK=no"
```

### Expected results

| Check | Expected |
|-------|----------|
| Path | `/opt/aisandbox` |
| Owner | `ubuntu:ubuntu` (from `ls -ld`) |
| Branch | `main` |
| Commit | A revision that includes tracked root `package-lock.json` |
| `ROOT_PACKAGE_LOCK` | `yes` |
| Git status | Review carefully — `.env` may appear as untracked if not gitignored; do not commit |

### Stop if

- Repo path missing
- Owner unexpected
- Branch not `main`
- `ROOT_PACKAGE_LOCK=no` (tracked lockfile not yet on VPS — sync/pull before install)
- Unexpected source modifications already present before install

---

## Section 10 — `.env` Existence and Permission Verification Without Printing Values

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
test -f /opt/aisandbox/.env && echo "ENV_EXISTS=yes" || echo "ENV_EXISTS=no"
stat -c '%U %G %a %n' /opt/aisandbox/.env
```

### Expected results

| Check | Expected |
|-------|----------|
| Exists | `ENV_EXISTS=yes` |
| Stat line | `ubuntu ubuntu 600 /opt/aisandbox/.env` |

### Absolute prohibitions

- Do **not** run `cat /opt/aisandbox/.env`
- Do **not** run `head`, `tail`, `less`, `more`, or `sed` against `.env`
- Do **not** print any key values

### Stop if

- `.env` missing
- Owner not `ubuntu:ubuntu`
- Permission not `600`

---

## Section 11 — Google OAuth Deferred Verification

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Confirm Google OAuth remains deferred per Outcome B. Check **key names only** — never print values.

```bash
python3 - <<'PY'
from pathlib import Path
p = Path('/opt/aisandbox/.env')
text = p.read_text(encoding='utf-8', errors='replace')
keys = set()
for line in text.splitlines():
    s = line.strip()
    if not s or s.startswith('#') or '=' not in s:
        continue
    k = s.split('=', 1)[0].strip()
    keys.add(k)
for name in ('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'):
    print(f'{name}_PRESENT={"yes" if name in keys else "no"}')
# Fail closed if obvious fake placeholders appear as values for Google keys
bad_markers = ('changeme', 'placeholder', 'your-client', 'xxx', 'TODO', 'replace-me')
for line in text.splitlines():
    s = line.strip()
    if not s or s.startswith('#') or '=' not in s:
        continue
    k, v = s.split('=', 1)
    k = k.strip()
    if k in ('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'):
        low = v.strip().strip('"').strip("'").lower()
        if any(m.lower() in low for m in bad_markers) or low in ('', 'null', 'none', 'false'):
            print(f'GOOGLE_FAKE_OR_EMPTY_PLACEHOLDER={k}')
print('GOOGLE_OAUTH_DEFERRED_CHECK=done')
PY
```

### Expected results

| Check | Expected |
|-------|----------|
| `GOOGLE_CLIENT_ID_PRESENT` | `no` |
| `GOOGLE_CLIENT_SECRET_PRESENT` | `no` |
| `GOOGLE_CALLBACK_URL_PRESENT` | `no` |
| Fake / empty placeholders | None reported |
| Intended staging auth path | Email/password (unchanged from 04B) |

### Stop if

- Any Google OAuth key is present unexpectedly and looks like a fake placeholder
- Evidence indicates Google OAuth was re-enabled with placeholders instead of real deferred omission

---

## Section 12 — Package Manager / Lockfile Detection

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Detect package manager safely before any install.

```bash
cd /opt/aisandbox
node -v
npm -v
ls -la package.json package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock bun.lockb bun.lock 2>/dev/null || true
find /opt/aisandbox -maxdepth 3 -name package.json -print
find /opt/aisandbox -maxdepth 3 \( -name package-lock.json -o -name pnpm-lock.yaml -o -name yarn.lock -o -name bun.lockb -o -name bun.lock -o -name npm-shrinkwrap.json \) -print
test -f /opt/aisandbox/package-lock.json && echo "ROOT_PACKAGE_LOCK=yes" || echo "ROOT_PACKAGE_LOCK=no"
```

Also inspect the root package metadata (safe — scripts/workspaces only):

```bash
cd /opt/aisandbox
node -e "const p=require('./package.json'); console.log(JSON.stringify({name:p.name, packageManager:p.packageManager||null, workspaces:p.workspaces||null, scripts:p.scripts||{}}, null, 2))"
```

### Decision logic (mandatory) — Outcome A

| Condition | Action |
|-----------|--------|
| Root `package-lock.json` **present** on VPS | Authorized install = **`cd /opt/aisandbox && npm ci`** only |
| Root `package-lock.json` **missing** on VPS | **STOP** — sync/pull tracked lockfile before install |
| `pnpm-lock.yaml` / `yarn.lock` as competing authority | **Stop** and report |
| Only Bun lockfiles | **Stop** — Bun not authorized for staging 04C |
| Temptation to run `npm install` | **Forbidden** |
| Temptation to run Bun install | **Forbidden** |

### Policy finding recorded (local + governance — 2026-07-27)

| Item | Finding |
|------|---------|
| Official staging package manager | **npm** |
| Root `package-lock.json` | Intentionally tracked after NPM-LOCKFILE-TRACKING |
| `.gitignore` | Ignores nested `package-lock.json`; root allowed via `!/package-lock.json` |
| Root `packageManager` field | Still declares `bun@1.x` — treat as **local-dev only** until separately changed |
| Bun for staging 04C | **Do not use** |
| `npm install` on VPS | **Do not use** |
| Staging runtime | Node.js v20.20.2 + npm 10.8.2 — Bun not installed |

### Decision for staging (current)

1. Package-manager policy is **Outcome A** (resolved).
2. Authorized install command after VPS sync: root **`npm ci`**.
3. If `/opt/aisandbox/package-lock.json` is missing → **STOP** and sync/pull first.
4. Do **not** run `npm install` on VPS.
5. Do **not** use Bun for staging 04C.
6. No install/build authorized until tracked root lockfile is present on VPS.

### Stop if

- `ROOT_PACKAGE_LOCK=no` ← stop and sync/pull
- Multiple conflicting lockfiles with no clear preferred path
- Unexpected lockfile types appear

---

## Section 13 — Dependency Install Command Selection

**Do not run install until Section 12 confirms root `package-lock.json` is present on VPS.**

### Selected install command (Outcome A — 2026-07-27)

**Authorized only when `/opt/aisandbox/package-lock.json` exists:**

```bash
cd /opt/aisandbox
npm ci
echo "NPM_CI_EXIT=$?"
```

### Explicitly forbidden

Do **not** run:

```bash
npm install
bun install
```

### Why this command is selected

- Outcome A: staging uses npm with a tracked root `package-lock.json`.
- `npm ci` is the deterministic install path matching SETUP-04 / Docker frontend build patterns.
- `packageManager=bun@1.x` is local-dev only for staging; Bun is not the staging package manager.
- Non-lockfile `npm install` remains rejected for reproducibility.

### Explicit warnings

| Warning | Rule |
|---------|------|
| Missing VPS lockfile | If `/opt/aisandbox/package-lock.json` missing → STOP; sync/pull tracked lockfile first |
| No Bun | Do **not** use Bun for staging 04C |
| No `npm install` | Do **not** use `npm install` on VPS |
| Lockfile integrity | Do **not** modify lockfiles ad hoc on the VPS |
| Side effects | Stop if install starts services, runs migrations, or prints secrets |
| Evidence | Capture only safe summary logs |

### Commands that are out of scope / forbidden during install

Do **not** run:

```bash
npm run start:all
npm run start:all:bash
npm run dev
npm run dev:build
npm run db:migrate
npm run db:reset
npm run db:test
```

### Stop if

- Root lockfile missing on VPS
- Install command would modify lockfile unexpectedly
- Install command starts services
- Install command runs migrations
- Dependency install fails

---

## Section 14 — Build Target Discovery

**Run inside AWS Lightsail browser SSH — not PowerShell. Discovery only — no build yet.**

Inspect root scripts:

```bash
cd /opt/aisandbox
node -e "const p=require('./package.json'); console.log(JSON.stringify(p.scripts||{}, null, 2))"
```

Inspect package scripts for the four app packages:

```bash
cd /opt/aisandbox
for pkg in frontend services/api-gateway services/ai-service services/container-manager; do
  echo "==== $pkg ===="
  node -e "const p=require('./$pkg/package.json'); console.log(JSON.stringify({name:p.name, scripts:p.scripts||{}}, null, 2))"
done
```

### Metadata finding recorded for this repo (local source review — 2026-07-26)

| Package | Script | Command meaning | Safe for 04C? |
|---------|--------|-----------------|---------------|
| Root `aisandbox` | *(no `build` script)* | N/A | Do **not** invent a root build |
| Root | `db:migrate` / `db:reset` / `dev` / `start:all*` | Runtime / migration / docker | **Forbidden** in 04C |
| `@aisandbox/frontend` | `build` → `next build` | Next.js production build | Yes |
| `@aisandbox/api-gateway` | `build` → `tsc` | TypeScript compile to `dist/` | Yes |
| `@aisandbox/ai-service` | `build` → `tsc` | TypeScript compile to `dist/` | Yes |
| `@aisandbox/container-manager` | `build` → `tsc` | TypeScript compile to `dist/` | Yes |
| `@aisandbox/api-gateway` | `migration:run` / `migration:run:prod` | TypeORM migrations | **Forbidden** in 04C |
| Any package | `start` / `dev` | Starts app processes | **Forbidden** in 04C |

### Selected build commands (after successful install)

```bash
cd /opt/aisandbox/services/api-gateway
npm run build

cd /opt/aisandbox/services/ai-service
npm run build

cd /opt/aisandbox/services/container-manager
npm run build

cd /opt/aisandbox/frontend
npm run build
```

### Build discovery stop rules

Stop if discovered build scripts would:

- Run migrations
- Start PM2 / app processes
- Configure DNS/TLS
- Print env values / secrets

---

## Section 15 — Safe Install Execution

**STATUS: Authorized only after VPS has tracked root `package-lock.json`. Until then, STOP — do not execute install.**

**Run inside AWS Lightsail browser SSH — not PowerShell — only after unlock.**

Preconditions for this section:

1. Pre-install snapshot **Available**
2. Repo baseline verified (includes tracked lockfile revision)
3. `.env` exists with `600`
4. Google OAuth deferred verification passed
5. Package manager / lockfile decision clear → **Outcome A**
6. `/opt/aisandbox/package-lock.json` exists → if **no**, STOP and sync/pull first

### Execute install

```bash
cd /opt/aisandbox
npm ci
echo "NPM_CI_EXIT=$?"
```

Do **not** run `npm install`. Do **not** run Bun.

### Safe post-install checks (no secrets)

```bash
cd /opt/aisandbox
test -d node_modules && echo "ROOT_NODE_MODULES=yes" || echo "ROOT_NODE_MODULES=no"
test -d frontend/node_modules -o -d node_modules/@aisandbox/frontend && echo "FRONTEND_DEPS_VISIBLE=yes" || echo "FRONTEND_DEPS_VISIBLE=check"
git status --short
```

Review `git status` for expected generated artifacts only (`node_modules` should normally be ignored). Do **not** commit.

### Stop if

- Root lockfile missing
- `npm ci` fails
- Lockfile changes unexpectedly
- Install starts services
- Install runs migrations
- Install prints secrets
- Source files are modified unexpectedly

---

## Section 16 — Safe Build Execution

**Run inside AWS Lightsail browser SSH — not PowerShell.**

Build only after install succeeds.

### Rules for build

Build must only:

- Build frontend / services
- Avoid starting app services
- Avoid running migrations
- Avoid configuring DNS/TLS
- Avoid enabling real AI / billing / container execution
- Avoid printing env values

If build requires env, it may use `/opt/aisandbox/.env` as runtime input but must **never** print the file or values.

### Execute builds in order

```bash
cd /opt/aisandbox/services/api-gateway
npm run build
echo "API_GATEWAY_BUILD_EXIT=$?"

cd /opt/aisandbox/services/ai-service
npm run build
echo "AI_SERVICE_BUILD_EXIT=$?"

cd /opt/aisandbox/services/container-manager
npm run build
echo "CONTAINER_MANAGER_BUILD_EXIT=$?"

cd /opt/aisandbox/frontend
npm run build
echo "FRONTEND_BUILD_EXIT=$?"
```

### Safe artifact checks (summaries only)

```bash
cd /opt/aisandbox
test -d services/api-gateway/dist && echo "API_GATEWAY_DIST=yes" || echo "API_GATEWAY_DIST=no"
test -d services/ai-service/dist && echo "AI_SERVICE_DIST=yes" || echo "AI_SERVICE_DIST=no"
test -d services/container-manager/dist && echo "CONTAINER_MANAGER_DIST=yes" || echo "CONTAINER_MANAGER_DIST=no"
test -d frontend/.next && echo "FRONTEND_NEXT=yes" || echo "FRONTEND_NEXT=no"
```

Frontend `next build` may take several minutes. Do not interrupt unless hung.

### Forbidden during build

Do **not** run:

```bash
npm run start
npm run start --prefix services/api-gateway
npm run migration:run
npm run migration:run:prod
npm run db:migrate
pm2 start ...
```

### Stop if

- Any build fails
- Build starts services
- Build runs migrations
- Build configures DNS/TLS
- Build prints env values / secrets
- Source files are modified unexpectedly (beyond generated `dist/` / `.next/` artifacts)

---

## Section 17 — Safe Evidence Capture

Capture only safe summaries for later paste into chat.

Include:

- Snapshot name + Available Yes/No
- Repo baseline Yes/No (path/owner/branch/commit)
- Root `package-lock.json` present on VPS Yes/No
- `.env` exists + permission stat line only
- Package manager / lockfile detected
- Install command used (must be root `npm ci` if install ran)
- Install result pass/fail (+ short error summary if fail, secrets redacted)
- Build commands used
- Build result pass/fail per package
- Generated artifact summary (`dist/` / `.next/` / `node_modules` presence) — no secrets
- PM2 / systemd no-service outputs
- Database public table count
- DNS/TLS non-goal Yes/No
- Secret safety Yes/No
- Warnings / unexpected outputs
- Stop conditions triggered (none / list)

### Do not capture

- Full install logs if noisy
- Full build logs if they may contain env/path noise with secrets
- Any `.env` contents
- `DATABASE_URL` / `REDIS_URL` / passwords / keys / tokens

Ask for **summaries and errors only**, with secrets redacted.

---

## Section 18 — Confirm No App Services Started

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
pm2 list
systemctl is-active aisandbox 2>/dev/null || echo "No aisandbox systemd service — OK"
systemctl is-active api-gateway 2>/dev/null || echo "No api-gateway systemd service — OK"
systemctl is-active ai-service 2>/dev/null || echo "No ai-service systemd service — OK"
systemctl is-active container-manager 2>/dev/null || echo "No container-manager systemd service — OK"
systemctl is-active caddy 2>/dev/null || true
```

### Expected

| Check | Expected |
|-------|----------|
| `pm2 list` | Empty / no app processes for aisandbox services |
| `aisandbox` systemd | Not active — OK message acceptable |
| `api-gateway` systemd | Not active — OK message acceptable |
| App processes | None started by 04C |

### Stop if

- PM2 app service appears unexpectedly
- Unexpected app systemd service is active because of this slice

---

## Section 19 — Confirm No Migrations

**Run inside AWS Lightsail browser SSH — not PowerShell.**

```bash
sudo -u postgres psql -d aisandbox -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
```

### Expected

```text
0
```

Database public table count must remain `0`.

### Stop if

- Table count changes from `0`
- Any migration command was run

---

## Section 20 — Confirm No DNS/TLS

DNS/TLS remains an explicit non-goal for 04C.

Confirm by intent and evidence:

| Check | Expected |
|-------|----------|
| DNS A record changes for staging hostname | Not performed in this slice |
| Caddy site/TLS certificate configuration | Not performed in this slice |
| Certbot / ACME actions | Not performed in this slice |

Do **not** edit Caddyfile, request certificates, or change DNS during 04C.

Record in evidence: `DNS/TLS non-goal preserved: Yes/No`.

---

## Section 21 — Confirm No Secrets Printed

Before submitting evidence, confirm:

| # | Confirmation |
|---|--------------|
| 1 | `.env` was never printed |
| 2 | `DATABASE_URL` / `REDIS_URL` were never pasted |
| 3 | DB/Redis passwords were never pasted |
| 4 | JWT/session/internal keys were never pasted |
| 5 | Provider keys were never pasted |
| 6 | OAuth secrets were never pasted |
| 7 | Install/build logs pasted to chat were redacted if needed |
| 8 | No secret appears in the evidence template answers |

If any secret appeared, stop and rotate exposed secrets before continuing any later slice.

---

## Section 22 — Stop Conditions

Stop immediately and report if any of the following occur:

| # | Stop condition |
|---|----------------|
| 1 | Pre-install snapshot not Available |
| 2 | Repo path missing |
| 3 | Repo owner / branch / commit unexpected |
| 4 | `.env` missing |
| 5 | `.env` permission not `600` |
| 6 | Google OAuth fake placeholders present |
| 7 | Root `package-lock.json` missing on VPS |
| 8 | Multiple conflicting lockfiles with no clear preferred path |
| 9 | Install command would modify lockfile unexpectedly |
| 10 | Install command starts services |
| 11 | Install command runs migrations |
| 12 | Build command starts services |
| 13 | Build command runs migrations |
| 14 | Build command configures DNS/TLS |
| 15 | Build command prints env values / secrets |
| 16 | Dependency install fails |
| 17 | Build fails |
| 18 | Database table count changes from `0` |
| 19 | PM2 app service appears unexpectedly |
| 20 | Source files modified unexpectedly |
| 21 | Secret disclosed |
| 22 | Attempt to use Bun or `npm install` for staging 04C |

Do not invent workarounds. Capture safe evidence and stop.

---

## Section 23 — Expected Final State

After successful future 04C manual execution:

| Item | Expected state |
|------|----------------|
| Pre-install snapshot | `aisandbox-staging-preinstall-build-2026-07-26` Available |
| Root `package-lock.json` on VPS | Present (tracked) |
| Dependencies | Installed successfully via root `npm ci` |
| Build | Completed successfully for api-gateway, ai-service, container-manager, frontend |
| `.env` | Remains private and unprinted — owner `ubuntu:ubuntu` — chmod `600` |
| Google OAuth | Remains omitted intentionally |
| Fake Google OAuth placeholders | None |
| App services | Not started |
| PM2 | Remains empty for app processes |
| Migrations | Not run |
| Database public table count | Remains `0` |
| DNS/TLS | Not configured |
| Secrets | Not disclosed |
| Parent PRIVATE-BETA-STAGING-EXECUTION-04 | Remains ACTIVE |
| Next child after 04C | **04D — PM2 Service Start + Health-Only Smoke** (registration later) |
| PRIVATE-BETA-DEPLOYMENT-READINESS | Remains BLOCKED / PAUSED |

---

## Section 24 — Safe Evidence Template

Paste this template after manual execution. Fill only safe values. Redact secrets.

```text
PRIVATE-BETA-STAGING-EXECUTION-04C — Evidence Report
Date:
Instance: aisandbox-staging

1) Pre-install snapshot
- Created: Yes/No
- Name: aisandbox-staging-preinstall-build-2026-07-26
- Status: Available / Pending / Failed / Other

2) Repo baseline
- Path /opt/aisandbox exists: Yes/No
- Owner ubuntu:ubuntu: Yes/No
- Branch main: Yes/No
- Commit (must include tracked package-lock.json):
- ROOT_PACKAGE_LOCK present: Yes/No
- git status reviewed (no commit): Yes/No

3) .env existence / permissions (NO VALUES)
- Exists: Yes/No
- Stat line (owner group mode path only):

4) Google OAuth deferred verification
- GOOGLE_CLIENT_ID present: no/yes
- GOOGLE_CLIENT_SECRET present: no/yes
- GOOGLE_CALLBACK_URL present: no/yes
- Fake placeholders found: No/Yes
- Email/password remains intended auth path: Yes/No

5) Package manager / lockfile detection
- node -v:
- npm -v:
- Root package-lock.json present: Yes/No
- pnpm-lock.yaml present: Yes/No
- yarn.lock present: Yes/No
- bun lock present: Yes/No
- Nested lockfiles observed (paths only):
- Decision used: npm ci from root / STOP missing lockfile / Other (explain)

6) Dependency install
- Command used: (must be npm ci if ran)
- Result: PASS/FAIL / NOT RUN (paused)
- Safe summary / redacted errors only:

7) Build
- Commands used:
  - services/api-gateway: npm run build — PASS/FAIL / NOT RUN
  - services/ai-service: npm run build — PASS/FAIL / NOT RUN
  - services/container-manager: npm run build — PASS/FAIL / NOT RUN
  - frontend: npm run build — PASS/FAIL / NOT RUN
- Safe summary / redacted errors only:

8) Generated artifact summary (no secrets)
- ROOT_NODE_MODULES:
- API_GATEWAY_DIST:
- AI_SERVICE_DIST:
- CONTAINER_MANAGER_DIST:
- FRONTEND_NEXT:

9) No app services started
- pm2 list summary:
- systemd aisandbox:
- systemd api-gateway:
- Unexpected app process started: No/Yes

10) No migrations
- Public table count:

11) No DNS/TLS
- DNS/TLS non-goal preserved: Yes/No

12) Secret safety
- No secrets printed/pasted: Yes/No

13) Warnings / unexpected outputs
-

14) Stop conditions triggered
- None / list:

15) Ready for evidence review
- Yes/No
```

---

## Section 25 — Exact Next Action

### Current next action (after NPM-LOCKFILE-TRACKING — 2026-07-27)

1. Outcome A is implemented **locally**: root `package-lock.json` is trackable and refreshed; 04C runbook authorizes root `npm ci` only after VPS has the lockfile.
2. **No VPS install/build has occurred** and remains unauthorized until `/opt/aisandbox/package-lock.json` exists.
3. Get the tracked root lockfile onto the VPS (commit/push out of this Cursor step’s scope; then sync/pull on `/opt/aisandbox`).
4. If `/opt/aisandbox/package-lock.json` is still missing after attempted sync → **STOP**; do not install.
5. When lockfile is present: resume Section 12 check, then Sections 13–16 with **`cd /opt/aisandbox && npm ci`** only.
6. Do **not** use Bun. Do **not** use `npm install` on VPS.

### Explicit non-actions (still in force until VPS lockfile present + install resume)

- Do **not** install dependencies yet if lockfile missing on VPS.
- Do **not** build the app yet if install not done.
- Do **not** start app services.
- Do **not** run migrations.
- Do **not** configure DNS/TLS.
- Do **not** open/create/edit `.env`.
- Do **not** print env values.
- Do **not** register or start 04D in this step.
- Do **not** install or use Bun for staging 04C.
- Do **not** run `npm install` on VPS.

**Exact next recommended action:** Sync/pull the repo update so `/opt/aisandbox/package-lock.json` exists, then resume 04C lockfile check and run root `npm ci`.
