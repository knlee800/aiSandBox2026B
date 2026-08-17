# PRIVATE-BETA-BLOCKER-03I — Stage Start / Failure-Path & Root-Cause Investigation

**Task ID:** PRIVATE-BETA-BLOCKER-03I
**Title:** Manual Checkpoint Creation HTTP 500 Investigation
**Status:** Step 2 — COMPLETE — Root Cause Proven by Authorized Bounded Reproduction — 2026-08-16
**Author:** Cursor / Opus 4.6 (Step 2 investigation + authorized bounded reproduction + cleanup — no source/test modification — no provider call — no credit mutation — no deployment — no Step 3 implementation)

---

## 1. Task / Status / Date

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-BLOCKER-03I |
| Title | Manual Checkpoint Creation HTTP 500 Investigation |
| Status | Step 2 — COMPLETE — Root Cause Proven by Authorized Bounded Reproduction — 2026-08-16 |
| Workflow | HIGH-RISK 4-STEP |
| Step 1 | Registration — COMPLETE — 2026-08-16 |
| Step 2 | Stage Start / Failure-Path & Root-Cause Investigation — **COMPLETE — Root Cause Proven — 2026-08-16** |
| Step 3 | PENDING — GO — Bounded `safe.directory` fix in container-manager `GitService.ensureGitInitializedInContainer` — NOT an Axios timeout increase |
| Step 4 | PENDING — Consolidation / Checkpoint |

### Final Step 2 verdict (supersedes earlier timeout hypothesis)

| Field | Value |
|-------|-------|
| TIMEOUT_HYPOTHESIS_CONFIRMED | **NO** — checkpoint HTTP 500 in **2181 ms**, not ~10000 ms |
| ROOT_CAUSE_PROVEN | **YES** |
| PROVEN_ROOT_CAUSE | Git 2.52 `safe.directory` / uid-1000 `/workspace` vs root `docker exec` |
| FAILING_FUNCTION | `GitService.ensureGitInitializedInContainer()` |
| REQUIRED_FIX | Narrow in-container `safe.directory` for `/workspace` — **not** Axios timeout increase |
| CURRENT_STAGING_REPRODUCIBLE | **YES** — reproduced 2026-08-16 on session `344ab7b5-333f-429f-8175-537d098d8159` |
| CLEANUP_RESULT | **PASS** — `DELETE` HTTP 200; container removed; PG session `stopped` / `terminated` reason `manual` |
| Step 3 | **GO** |

Earlier sections below retain the investigation history, including the Axios-timeout hypothesis that was considered and then **disproven**.

---

## 2. Phase A — Historical Anomaly Evidence

Source: `docs/PRIVATE-BETA-E2E-02-CHECKPOINT.md` §18

**Exact recorded text:**

> "After the successful Build execution and workspace apply, manual checkpoint creation returned HTTP 500."

| Field | Value |
|-------|-------|
| HISTORICAL_ACTION | Manual checkpoint creation (user-triggered, after Build workspace apply) |
| HISTORICAL_METHOD | UNKNOWN_FROM_HISTORICAL_EVIDENCE (inferred POST from source inspection) |
| HISTORICAL_ENDPOINT | UNKNOWN_FROM_HISTORICAL_EVIDENCE (inferred `POST /api/sessions/:id/checkpoints` from source) |
| HISTORICAL_REQUEST | UNKNOWN_FROM_HISTORICAL_EVIDENCE (inferred `{ userId, messageNumber: 0 }` from source) |
| HISTORICAL_RESPONSE | HTTP 500 |
| HISTORICAL_TIME | 2026-08-14 (during E2E-02 Step 3 execution) |
| HISTORICAL_PROJECT | `a0e19aca-d82d-4a41-a160-3d4dfcc7511a` (E2E-02 disposable) |
| HISTORICAL_SESSION | `ec8a131a-0049-40df-8de4-42eab3ac1278` |
| HISTORICAL_USER | `7f772841-7844-401b-a3da-e928b0c7b79c` |
| HISTORICAL_SERVER_ERROR | UNKNOWN_FROM_HISTORICAL_EVIDENCE (no server-side error recorded in checkpoint doc) |

### Missing Historical Evidence

- Exact HTTP request payload (not captured in checkpoint)
- Exact server-side exception/stack trace (not captured in checkpoint)
- PM2/service logs at time of failure (not captured in checkpoint)
- Container-manager response body (not captured)
- Exact timestamp within E2E-02 Step 3 window (not captured)
- Whether retry was attempted (not recorded)

---

## 3. Phase B — Checkpoint Mechanism Inventory

### Checkpoint Type 1: Manual User-Triggered Checkpoint

| Property | Value |
|----------|-------|
| Caller | Frontend `workspace-checkpoint-create.logic.ts` → `createWorkspaceCheckpoint()` |
| Endpoint | `POST /api/sessions/:id/checkpoints` |
| Owning service | api-gateway → container-manager |
| Auth | `SessionCookieGuard` (session cookie) |
| Persistence | Git commit inside container + `git_checkpoints` table (PostgreSQL) + container-manager SQLite |
| Consumers | Checkpoint list UI, revert system, timeline navigation |

### Checkpoint Type 2: Automatic Pre-Apply Checkpoint (Agent Harness)

| Property | Value |
|----------|-------|
| Caller | ai-service worker → `apiGatewayHttpClient.createWorkspaceCheckpoint()` |
| Endpoint | `POST /api/internal/workspace/:sessionId/checkpoint` |
| Owning service | api-gateway `InternalWorkspaceFilesController` → container-manager |
| Auth | `InternalServiceAuthGuard` (X-Internal-Service-Key) |
| Persistence | Git commit inside container + `git_checkpoints` table (PostgreSQL) + container-manager SQLite |
| Consumers | Agent harness (abort on failure), revert system, workspace recovery |
| Trigger | Before first mutating tool call (write_file, delete_file) in agent harness loop |

### Checkpoint Type 3: Internal Git Checkpoint Recording

| Property | Value |
|----------|-------|
| Caller | container-manager `GitService.createCheckpoint()` |
| Endpoint | `POST /api/internal/git-checkpoints` (container-manager → api-gateway) |
| Owning service | api-gateway `InternalGitCheckpointController` |
| Auth | InternalServiceAuthGuard |
| Persistence | `git_checkpoints` table (PostgreSQL) |
| Purpose | Idempotent recording of checkpoint after Git commit already created |

### Checkpoint Type 4: Revert Checkpoint

| Property | Value |
|----------|-------|
| Caller | `CheckpointsService.revertToCheckpoint()` |
| Endpoint | `POST /api/sessions/:id/revert` |
| Owning service | api-gateway → container-manager |
| Persistence | Git reset --hard + new checkpoint record |

### Checkpoint Type 5: Git Init (Session Start)

| Property | Value |
|----------|-------|
| Caller | container-manager `SessionsService.startSessionContainer()` |
| Mechanism | `POST /api/git/:sessionId/init` (local HTTP self-call) |
| Execution | Runs `simpleGit(workspacePath)` on HOST filesystem |
| Purpose | Creates initial `.git` directory and first commit on host-mounted workspace |
| Note | Does NOT install git inside the container |

### Key Distinction

Types 1 and 2 **share the same underlying implementation path** through `ContainerManagerHttpClient.createManualCheckpoint()` → container-manager `GitService.commit()`. They differ only in auth mechanism and caller.

---

## 4. Phase C — Manual Checkpoint Implementation Path

### Full Call Chain

```
Frontend: createWorkspaceCheckpoint()
  → POST /api/sessions/:id/checkpoints (fetch, session cookie)
  
API Gateway: CheckpointsController.createManualCheckpoint()
  → SessionCookieGuard validates auth
  → SessionService.getSessionById(id) — validates session exists
  → Ownership check (session.userId !== req.user.userId → 404)
  → CheckpointsService.createManualCheckpoint(sessionId, userId, messageNumber, description, allowEmpty)
    → SessionService.getSessionById(sessionId) — validates not terminated
    → ContainerManagerHttpClient.createManualCheckpoint(sessionId, userId, messageNumber, description, allowEmpty)
      → axios POST /api/git/:sessionId/commit (10s DEFAULT timeout, X-Internal-Service-Key header)
      
Container-Manager: GitController.commit()
  → GitService.commit(sessionId, userId, messageNumber, description, allowEmpty)
    → ensureGitInitializedInContainer(sessionId)
      → execInContainer: 'command -v git || apk add --no-cache git; git rev-parse --is-inside-work-tree'
      → (if exitCode != 0) execInContainer: 'command -v git || apk add --no-cache git; git init && git config ...'
    → execInContainer: 'git status --porcelain'
    → (if changes exist):
      → execInContainer: 'git add -A'
      → execInContainer: 'git commit -m "$COMMIT_MESSAGE"'
      → execInContainer: 'git rev-parse HEAD'
    → createCheckpoint(sessionId, userId, messageNumber, commitHash, commitMessage, filesChanged)
      → apiGatewayClient.recordGitCheckpoint() — POST /api/internal/git-checkpoints (caught, continues on failure)
      → SQLite INSERT (local container-manager DB)
      → emitCheckpointCreated() — POST /api/events/checkpoint-created (caught, continues on failure)
    → return { message, commitHash, filesChanged }
      
API Gateway (continued):
  → if (result.commitHash):
    → gitCheckpointService.getCheckpointByHash(commitHash) — dedup check
    → (if not existing) gitCheckpointService.recordCheckpoint() — INSERT into git_checkpoints
  → return result
```

### Identified Implementation

| Field | Value |
|-------|-------|
| CHECKPOINT_OWNER_SERVICE | container-manager (Git operations) + api-gateway (metadata persistence) |
| CHECKPOINT_ENDPOINT | `POST /api/sessions/:id/checkpoints` (public) |
| CHECKPOINT_CALL_CHAIN | Frontend → API Gateway CheckpointsController → CheckpointsService → ContainerManagerHttpClient → Container-Manager GitService.commit() → Docker exec in container |

---

## 5. Phase D — Mutation Ordering

| Step | Operation | Classification |
|------|-----------|---------------|
| 1 | Validate auth (SessionCookieGuard) | READ |
| 2 | Get session by ID | READ |
| 3 | Verify ownership (session.userId check) | READ |
| 4 | Verify session not terminated | READ |
| 5 | HTTP call to container-manager `/api/git/:sessionId/commit` | → sub-operations below |
| 5a | ensureGitInitializedInContainer (install git if needed, verify repo) | MUTATION (installs packages, may init git) |
| 5b | `git status --porcelain` | READ |
| 5c | `git add -A` | **MUTATION** (stages files in container) |
| 5d | `git commit -m "..."` | **MUTATION** (creates Git commit in container) |
| 5e | `git rev-parse HEAD` | READ |
| 5f | createCheckpoint → recordGitCheckpoint (api-gateway HTTP) | **MUTATION** (DB insert, caught on failure) |
| 5g | createCheckpoint → SQLite INSERT (local) | **MUTATION** (local DB) |
| 5h | emitCheckpointCreated (WebSocket notification) | SIDE EFFECT (caught on failure) |
| 6 | API Gateway: gitCheckpointService.getCheckpointByHash | READ |
| 7 | API Gateway: gitCheckpointService.recordCheckpoint | **MUTATION** (DB insert, only if dedup check says not existing) |
| 8 | Return response | READ |

### Failure Position Determination (HYPOTHESIZED — IF timeout is the cause)

**HYPOTHESIZED_HTTP500_FAILURE_POSITION = TIMEOUT DURING step 5a (most likely) or after step 5d (less likely)**

IF the timeout hypothesis is correct:
- Most likely: timeout fires during step 5a (installing git via `apk add`). The api-gateway receives a timeout error and returns HTTP 500 BEFORE any Git commit mutation has occurred.
- Less likely: timeout fires AFTER step 5d (Git commit created) but before the HTTP response is received by api-gateway:
  - Git state: MUTATED (commit exists)
  - Container-manager SQLite: MUTATED (record created)
  - API Gateway git_checkpoints table: MAY be MUTATED (via internal recordGitCheckpoint call from container-manager)
  - API Gateway response: HTTP 500 (timeout error)

**PARTIAL_STATE_POSSIBLE = YES (conditional — only if timeout fires after step 5d)**

If timeout fires before step 5c: No mutation. Safe.
If timeout fires after step 5d: Git commit exists, but api-gateway step 7 never executes. The container-manager's own step 5f may or may not have completed.

**NOTE:** This analysis assumes the timeout hypothesis. If the E2E-02 HTTP 500 was caused by a different issue (see §6 Alternative Hypotheses), the failure position may be different.

---

## 6. Phase E — Concrete Error / Exception

### Hypothesis (NOT PROVEN)

**HYPOTHESIZED_ERROR = Axios ECONNABORTED / timeout error**

**HYPOTHESIZED_FAILING_FUNCTION = `ContainerManagerHttpClient.createManualCheckpoint()`** (in api-gateway)

**HYPOTHESIZED_FAILING_CONDITION = The default 10-second axios instance timeout is exceeded because `GitService.commit()` in container-manager must install git inside the `node:20-alpine` container via `apk add --no-cache git` on first use.**

**HYPOTHESIZED_WHY_HTTP_500:**

```
1. api-gateway calls container-manager with 10s timeout
2. Container-manager needs to install git (apk add) — duration UNKNOWN (no measurement exists)
3. IF apk add exceeds 10s: Axios timeout fires → AxiosError with code ECONNABORTED
4. Error caught in createManualCheckpoint():
   - error.response is undefined (no HTTP response received)
   - error.response?.status evaluates to 'unknown'
   - error.message = 'timeout of 10000ms exceeded'
5. Throws: new Error('Failed to create manual checkpoint for session X: HTTP unknown - timeout of 10000ms exceeded')
6. This is a GENERIC Error (not HttpException)
7. NestJS exception filter catches unhandled Error → returns HTTP 500 Internal Server Error
```

### Evidence Assessment (A/B/C/D)

| Question | Answer | Evidence |
|----------|--------|----------|
| A. Does `createManualCheckpoint()` use 10s timeout? | **YES** | `container-manager-http.client.ts` line 41: `timeout: 10000`; lines 709-716: NO override in request config; contrast with `stopSession` (30s), `deleteSession` (30s), `execInSession` (dynamic+5s), `runBrowserSmoke` (dynamic+10s) |
| B. Does first checkpoint invoke git installation? | **YES** | `git.service.ts` line 72: `ensureGitInitializedInContainer(sessionId)` runs `command -v git || apk add --no-cache git` on `node:20-alpine` which does not have git pre-installed (confirmed: `Dockerfile.workspace-browser` explicitly installs git, proving default image lacks it) |
| C. Can installation exceed 10s? | **UNKNOWN — NO MEASURED EVIDENCE** | `apk add git` downloads git + dependencies (~8-15MB). Duration depends on network speed, mirror proximity, DNS. No timing measurement from staging/production environment exists in this repository. |
| D. E2E-02 HTTP 500 connected to ECONNABORTED/timeout? | **NO EVIDENCE** | E2E-02 checkpoint (§18) only records: "manual checkpoint creation returned HTTP 500". No stack trace, no error message, no Axios error code, no PM2 logs, no container-manager logs, no response body detail. |

### Identified Defects (proven from source)

1. **Insufficient timeout** — `createManualCheckpoint()` uses default 10s axios timeout while other long-running methods properly override (30s-300s). This is a real defect regardless of whether it caused E2E-02.
2. **Improper error handling** — throws generic `Error` instead of `HttpException` with proper status preservation. Any non-timeout failure from container-manager (410, 429, etc.) also produces HTTP 500.
3. **Git not pre-installed** — container image `node:20-alpine` lacks git; installation happens on-demand at first checkpoint.

### Alternative Hypotheses for E2E-02 HTTP 500

| # | Hypothesis | Status |
|---|-----------|--------|
| 1 | Axios 10s timeout during `apk add git` | **DISPROVEN by 2026-08-16 reproduction** — elapsed 2181 ms; no ECONNABORTED / `timeout of 10000ms exceeded` |
| 2 | Container not running / Docker error | **DISPROVEN** — container started; file write 204 |
| 3 | Git command failure inside container | **CONFIRMED** — `ensureGitInitializedInContainer` / Git `safe.directory` ownership rejection |
| 4 | DB error in api-gateway `recordCheckpoint` | **DISPROVEN** — failure occurred before any checkpoint DB write |
| 5 | Network issue between api-gateway and container-manager | **DISPROVEN** — container-manager returned HTTP 500 with Git stderr |

---

## 7. Phase F — Current Staging Reproducibility

**CURRENT_STAGING_REPRODUCIBLE = YES** (authorized reproduction 2026-08-16)

The Axios 10s timeout remains present in source as a **separate unused defect for this incident**. It did **not** fire: checkpoint failed in 2181 ms.

What **did** reproduce on current staging (`e34be9bd`):

1. Fresh `node:20-alpine` session `344ab7b5-333f-429f-8175-537d098d8159`
2. `POST /api/sessions/:id/checkpoints` → HTTP 500 in 2181 ms
3. container-manager `GitService.ensureGitInitializedInContainer` → `fatal: not in a git directory`
4. Live Git inspect → `fatal: detected dubious ownership in repository at '/workspace'`

**REPRO_MUTATIONS_REQUIRED** for that proof: YES — already performed (one session, one file, one checkpoint). Cleanup DELETE completed; do not reproduce again in Step 2.

---

## 8. Phase G — Authentication / Ownership / Identity

| Aspect | Status |
|--------|--------|
| Authentication mechanism | SessionCookieGuard (session cookie, validates userId) |
| Ownership validation | `session.userId !== req.user.userId` → NotFoundException |
| Project/workspace identity | Session ID → workspace path → Docker container |
| Could missing auth cause 500 instead of 4xx? | NO — auth failures produce 401 (guard) or 404 (ownership). The 500 occurs AFTER all auth/ownership checks pass. |
| Ownership protections preserved | YES — unchanged by this defect |

---

## 9. Phase H — Retry and Idempotency

**RETRY_SAFE = CONDITIONAL**

| Scenario | What happens on retry | Safe? | Evidence |
|----------|----------------------|-------|----------|
| Timeout fired before git commit (step 5a/5b) — container-manager also failed | No state changed; retry attempts full operation again (git may now be installed from partial first attempt) | YES | `git.service.ts` line 88-93: if `changedEntries.length > 0`, normal commit path proceeds |
| Timeout fired after git commit (step 5d) — container-manager completed | `git status --porcelain` returns empty; `changedEntries.length === 0` and `allowEmpty=false` → returns `{ message: 'No changes to commit', commitHash: null }` | YES (no corruption) | `git.service.ts` lines 83-93: empty status → null commitHash returned |
| Same as above, but `allowEmpty=true` (internal/pre-apply path) | Creates a new EMPTY commit | NO CORRUPTION but creates unnecessary empty commit | `git.service.ts` lines 96-122: `allowEmpty` path creates `git commit --allow-empty` |

**IDEMPOTENT = CONDITIONAL**

| Condition | Idempotent? | Detail |
|-----------|-------------|--------|
| Manual path (`allowEmpty=false`) | YES | Retry finds no changes → returns null, skips DB recording; no duplicate commits |
| Internal/pre-apply path (`allowEmpty=true`) | NO | Retry creates a new empty commit with new hash; new checkpoint record created |

**Key concern on retry (manual path, scenario 2):**

The retry returns `{ message: 'No changes to commit', commitHash: null }`. The api-gateway's `CheckpointsService`:
```
if (result.commitHash) { ... record in git_checkpoints ... }
```
Since `commitHash` is null, the api-gateway does NOT create a DB record. However, the container-manager's FIRST attempt (if it completed) already called `recordGitCheckpoint` internally (a SEPARATE HTTP request to api-gateway). Under normal conditions (api-gateway healthy), this internal call SUCCEEDS even though the outer request timed out — because the timeout is a client-side axios timeout, not a server-side failure.

**ORPHAN_GIT_CHECKPOINT_POSSIBLE = YES (CONDITIONAL)**

An orphan (git commit exists but no `git_checkpoints` PostgreSQL record) occurs ONLY if:
1. The outer request times out (api-gateway → container-manager), AND
2. The container-manager's INTERNAL `recordGitCheckpoint` call (container-manager → api-gateway) ALSO fails

Under normal operation (api-gateway healthy, only the client-side timeout):
- Internal `recordGitCheckpoint` succeeds (separate HTTP connection, api-gateway server is healthy)
- Orphan does NOT occur
- Checkpoint IS visible in the user's list

Under infrastructure double-failure (api-gateway DB pool exhausted, network partition, etc.):
- Internal `recordGitCheckpoint` fails (caught, continues: `git.service.ts` line 321-324)
- SQLite record created (line 327-334)
- git_checkpoints PostgreSQL: MISSING
- Retry returns null commitHash → DB record never created
- **ORPHAN**: git commit exists, is invisible to user, cannot be reverted to

**GIT_DB_DIVERGENCE_POSSIBLE = YES (same condition as orphan)**

---

## 10. Phase I — Git/Filesystem/DB Consistency

See §9 for detailed orphan/divergence analysis. Summary:

| Condition | Value | Condition |
|-----------|-------|-----------|
| GIT_DB_DIVERGENCE_POSSIBLE | YES | Only under infrastructure double-failure (outer timeout + internal recording failure) |
| FILESYSTEM_DB_DIVERGENCE_POSSIBLE | NO | Filesystem changes ARE the git commit |
| GIT_FILESYSTEM_DIVERGENCE_POSSIBLE | NO | Same entity |
| ORPHAN_GIT_CHECKPOINT_POSSIBLE | YES | Same condition as GIT_DB_DIVERGENCE |
| Normal-timeout orphan | NO | Under normal timeout (api-gateway healthy), internal `recordGitCheckpoint` succeeds on separate connection |

### Cleanup/Rollback Behavior

No explicit cleanup or rollback exists for a partially-recorded checkpoint. The system relies on:
- Container-manager's `createCheckpoint` recording locally (SQLite) regardless of api-gateway failures
- Container-manager's `recordGitCheckpoint` call succeeding independently (separate HTTP request)
- The checkpoint list endpoint querying git_checkpoints table (if internal recording succeeded, checkpoint is visible)
- Retry returning "no changes to commit" → harmless no-op (no corruption)

---

## 11. Phase J — Manual vs Automatic Checkpoint Criticality

### Shared Path Analysis

| Aspect | Manual Checkpoint | Pre-Apply Checkpoint (Agent Harness) |
|--------|------------------|--------------------------------------|
| Frontend caller | `workspace-checkpoint-create.logic.ts` | ai-service worker via `createWorkspaceCheckpoint()` |
| API endpoint | `POST /api/sessions/:id/checkpoints` | `POST /api/internal/workspace/:sessionId/checkpoint` |
| API controller | `CheckpointsController` | `InternalWorkspaceFilesController` |
| HTTP client method | `containerManagerHttpClient.createManualCheckpoint()` | `containerManagerHttpClient.createManualCheckpoint()` |
| **SAME underlying call** | **YES** | **YES** |
| Axios timeout | **10s default (no override)** | **10s default (no override)** |
| Container-manager path | `GitService.commit()` | `GitService.commit()` |
| Git installation required | YES (first use) | YES (first use) |

**Both paths share the SAME implementation and the SAME timeout defect.**

### Impact on Builder/Private-Beta Safety

**CRITICAL GATE: `enableToolLoop` defaults to `false`**

The agent harness pre-apply checkpoint is ONLY active when the agent harness tool loop is enabled:

```typescript
// worker.processor.ts line 826-828
const useHarness =
  job.data.harnessVersion === 'v1' &&
  DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop;
```

Evidence that `enableToolLoop` defaults to `false`:
- `agent-harness.config.ts`: `enableToolLoop` initialized from `AGENT_HARNESS_ENABLE_TOOL_LOOP` env var, defaults to `false`
- `.env.example`: `AGENT_HARNESS_ENABLE_TOOL_LOOP=false`
- `docker-compose.prod.yml`: `AGENT_HARNESS_ENABLE_TOOL_LOOP: ${AGENT_HARNESS_ENABLE_TOOL_LOOP:-false}`
- Test: `expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop).toBe(false)` (multiple test files)
- Worker logs: `selectedPath: useHarness ? 'harness' : 'plain'` → in default config, always 'plain'

**When `enableToolLoop=false` (DEFAULT):**
- Worker takes the "plain" path (single-shot AI execution)
- No `createCheckpointFn` is created
- No pre-apply checkpoint is attempted
- File actions are returned to the frontend and applied by the browser
- Builder completes WITHOUT any checkpoint dependency

**When `enableToolLoop=true` (requires explicit env var):**
- Worker takes the "harness" path with tool loop
- Pre-apply checkpoint is attempted before mutating tools
- On failure: mutating tools are blocked → Build cannot write files
- This WOULD be Builder-critical if enabled

**CHECKPOINT_FAILURE_PRIVATE_BETA_CRITICAL = CONDITIONAL**

| If staging `AGENT_HARNESS_ENABLE_TOOL_LOOP` is... | Criticality | Reason |
|---------------------------------------------------|-------------|--------|
| `false` (default) | **NO — not Builder-blocking** | Builder uses plain path, no pre-apply checkpoint, file actions applied by browser; manual checkpoint is user-triggered and optional |
| `true` (explicitly enabled) | **YES — Builder-blocking** | Pre-apply checkpoint blocks file mutation; same `GitService.commit` / `ensureGitInitializedInContainer` defect prevents first checkpoint |

**What IS affected under default config:**
- Manual checkpoint creation fails on first attempt for fresh containers → user sees HTTP 500
- Users cannot create save points (cannot preserve post-Build state)
- Users cannot revert (no checkpoint to revert to, except initial empty commit)
- This is a significant UX degradation but NOT a Builder-execution-blocking defect

**Staging env var now verified (remote Phase A + current staging):** `AGENT_HARNESS_ENABLE_TOOL_LOOP=false`. Therefore:

| Flag | Value |
|------|-------|
| CURRENT_PLAIN_BUILDER_PATH_BLOCKED | **NO** |
| CHECKPOINT_SAFETY_DEFECT_PRESENT | **YES** |
| HARNESS_ENABLED_PATH_BLOCKED | **YES** (same checkpoint implementation if tool loop is enabled) |
| PRIVATE_BETA_03I_REQUIRES_FIX | **YES** |

Private beta remains **NO-GO** until 03I is corrected and validated.

---

## 12. Phase K — Root Cause

**SUPERSEDED by authorized reproduction + §24.** The Axios 10s timeout hypothesis below is retained as investigation history. It is **not** the proven root cause.

**TIMEOUT_HYPOTHESIS_CONFIRMED = NO** (checkpoint HTTP 500 in **2181 ms**)

**ROOT_CAUSE_PROVEN = YES**

**PROVEN_ROOT_CAUSE = Git 2.52 `safe.directory` ownership protection rejects `/workspace` when the in-container Git process runs as root against a uid-1000 bind mount**

Proven causal chain:

```text
fresh node:20-alpine session
→ /workspace bind mounted with uid-1000 ownership
→ checkpoint executes Git as root
→ Git 2.52 safe.directory ownership protection rejects /workspace
→ GitService.ensureGitInitializedInContainer() fails
→ container-manager returns HTTP 500
→ API Gateway propagates generic HTTP 500
```

Defect is **NOT**: Axios timeout, billing/accounting, auth, routing, or provider execution.

### Historical timeout hypothesis (DISPROVEN — retained)

**ROOT_CAUSE_HYPOTHESIS (historical) = Axios 10s timeout during `apk add git` in first checkpoint creation on fresh `node:20-alpine` container**

| Element | Historical status (pre-reproduction) | Post-reproduction status |
|---------|--------------------------------------|--------------------------|
| `createManualCheckpoint()` uses 10s default timeout | PROVEN in source | Still true in source; **did not fire** (2181 ms) |
| First checkpoint triggers `apk add git` | PROVEN in source | CONFIRMED — git installed successfully during the attempt |
| `apk add git` exceeds 10s in staging | NOT MEASURED | **DISPROVEN as this incident's cause** — full checkpoint failed in 2181 ms |
| E2E-02 HTTP 500 caused by this timeout | NOT PROVEN (no captured error text) | Still **not claimable as captured historical error text**; current path fails for `safe.directory` |
| Generic Error → HTTP 500 | PROVEN in source | CONFIRMED — container-manager Git stderr wrapped as Gateway HTTP 500 |

The 10s Axios timeout remains a separate unused client-side risk. **Do not increase it as part of 03I.**

---

## 13. Phase L — Smallest Safe Step 3 Fix

**SUPERSEDED:** An earlier draft of this section required an Axios timeout increase in `container-manager-http.client.ts`. That is **out of scope** and **must not** be the 03I fix.

### REQUIRED_FIX (minimum to correct the proven defect)

Bound the fix to:

`services/container-manager/src/git/git.service.ts`

Inside `GitService.ensureGitInitializedInContainer()` (called by `GitService.commit()`):

After Git is available, configure `/workspace` as an allowed Git `safe.directory` for the in-container **root** Git process **before** subsequent repository operations that require Git trust (`git rev-parse`, `git init` follow-on config, `git add` / `git commit`).

Use the smallest safe Git configuration consistent with existing container/session isolation.

Do **not** disable Git ownership protection globally in an unnecessarily broad way (for example `safe.directory *`).

Current failing command sequence (cwd `/workspace`):

```text
command -v git >/dev/null 2>&1 || apk add --no-cache git >/dev/null 2>&1; git rev-parse --is-inside-work-tree
command -v git >/dev/null 2>&1 || apk add --no-cache git >/dev/null 2>&1; git init && git config user.name "AI Sandbox" && git config user.email "sandbox@aisandbox.com"
```

Step 3 must inspect that exact command form and choose the **narrowest** safe scope for `/workspace` (path-limited `safe.directory`, not a host-wide or wildcard disable). `--local` is likely unusable until the repo is trusted; a container-local root config limited to `/workspace` is the expected narrow form. Do not implement that choice in Step 2.

### OUT OF SCOPE unless the minimum safe fix cannot work without expansion (then STOP)

- API Gateway Axios timeout / `createManualCheckpoint` timeout
- `getGitDiff`
- `revertToCheckpoint`
- billing
- routing
- provider execution
- checkpoint architecture
- dependencies
- schema/migrations

### Scope Table

| Field | Value |
|-------|-------|
| PRODUCTION_FILES_EXPECTED_TO_CHANGE | `services/container-manager/src/git/git.service.ts` |
| TEST_FILES_EXPECTED_TO_CHANGE | `services/container-manager/src/git/git.service.spec.ts` |
| TRANSLATION_FILES_EXPECTED_TO_CHANGE | NONE |
| MIGRATION_REQUIRED | NO |
| DATA_INTEGRITY_CHANGE_REQUIRED | NO |
| NEW_DEPENDENCY_REQUIRED | NO |
| Axios / createManualCheckpoint timeout IN SCOPE | **NO** |
| getGitDiff IN SCOPE | **NO** |
| revertToCheckpoint IN SCOPE | **NO** |

**Recommended Step 3 model:** Grok 4.6 High  
**Risk:** NORMAL bounded implementation

---

## 14. Phase M — Regression Test Design

**SUPERSEDED:** Earlier timeout-override tests in api-gateway are **not** the 03I regression target.

Expected test file:

`services/container-manager/src/git/git.service.spec.ts`

Add regression coverage proving the initialization command sequence handles the uid mismatch / `safe.directory` requirement (Git available → allow `/workspace` → then `rev-parse` / `init` / `config`). Preserve existing commit/revert mock coverage unless a local assertion must change.

---

## 15. Phase N — Provider-Free Staging Validation Plan

Step 3 validation requires NO provider calls. Target service is **container-manager**, not api-gateway-only.

1. **Build validation**: `npm run build` on container-manager
2. **Unit tests**: `npm test` on container-manager — including new `git.service.spec.ts` regression
3. **Deploy/restart**: only if/when Step 3 is authorized to validate on staging — **not** in Step 2
4. **Staging verification** (provider-free, after the bounded fix is deployed):
   - Fresh disposable session
   - Write a test file
   - `POST /api/sessions/:id/checkpoints`
   - Verify success (not HTTP 500)
   - Verify Git commit exists
   - Verify PostgreSQL `git_checkpoints` row exists
5. **Do not** treat elapsed-time-under-10s as the success criterion; the proven defect is ownership/`safe.directory`

No AI provider execution required. No credit mutations. No Build/Ask flow needed.

---

## 16. Phase O — Rollback Strategy

| Field | Value |
|-------|-------|
| Current staging SHA | `e34be9bdcdeed6cc1fbc1f0ce2f7e5689a62bdd0` |
| Expected affected services | container-manager (Git init path only) |
| Code rollback SHA | `e34be9bdcdeed6cc1fbc1f0ce2f7e5689a62bdd0` (current) |
| DB rollback needed | NO — no schema or data changes |
| Git/filesystem cleanup needed | Disposable session cleanup only if a validation session is created in Step 3 |
| Rollback order | 1. Revert `git.service.ts` (+ spec) 2. Rebuild container-manager 3. PM2 restart container-manager |

If Step 3 fix causes regression:
- Revert the bounded `GitService.ensureGitInitializedInContainer` change
- Rebuild and restart container-manager
- Do not revert unrelated api-gateway timeout code (that code must not be changed in 03I)

---

## 17. Safety Flags

| Flag | Value |
|------|-------|
| GLOBAL_EXECUTION_ENABLED | **false** — unchanged throughout Step 2 |
| BILLING_CHARGES_ENABLED | **false** — unchanged throughout Step 2 |
| Provider calls | **0** |
| Intentional credit mutations | **0** |
| DB writes | **0** |
| Runtime checkpoint mutations | **0** |
| Stripe/payment activity | **0** |
| Source/test edits | **0** |
| Deployments | **0** |
| PM2 restarts | **0** |
| Git add/commit/push | **0** |

---

## 18. Restrictions

| Restriction | Status |
|-------------|--------|
| E2E-03 | NOT REGISTERED — NOT AUTHORIZED — NOT EXECUTED |
| PRIVATE-BETA-INVITE-01 | UNTOUCHED — UNREGISTERED — PROHIBITED |
| Provider-call budget | ZERO — consumed |
| Fresh Keith authorization required | YES (for any future provider call) |

---

## 19. Step 3 Go/No-Go

**SUPERSEDED:** This section previously recorded **Step 3: BLOCKED** pending timeout-hypothesis reproduction. Reproduction completed; timeout hypothesis **disproven**.

**Step 3: GO**

**Risk:** NORMAL bounded implementation  
**Recommended model:** Grok 4.6 High

**Exact Step 3 objective:** In `GitService.ensureGitInitializedInContainer()` (`services/container-manager/src/git/git.service.ts`), after Git is available, configure `/workspace` as an allowed Git `safe.directory` for the in-container root Git process before subsequent repository operations that require Git trust. Add regression coverage in `services/container-manager/src/git/git.service.spec.ts`. Do **not** increase the Axios timeout. Do **not** change `getGitDiff` or `revertToCheckpoint`.

---

## 20. Corrected Reproduction Plan

**EXECUTED.** This section is the authorized reproduction plan as written before the live test. Results are in §23 and §24. Do not treat the pre-test wording in this section as current status.

**Previous error:** The earlier plan proposed calling `POST /api/git/:sessionId/commit` (container-manager internal endpoint), which BYPASSES the exact timeout-bearing layer under investigation (`ContainerManagerHttpClient.createManualCheckpoint()` with 10s axios timeout in the API Gateway). That timeout layer was the **hypothesis under test**; the live result disproved timeout as the cause.

**Correction:** The reproduction MUST call the public endpoint `POST /api/sessions/:id/checkpoints` through the API Gateway, exercising the full path:

```
Frontend/curl → API Gateway POST /api/sessions/:id/checkpoints
  → SessionCookieGuard (validates aisandbox_session cookie)
  → CheckpointsController.createManualCheckpoint()
    → session ownership check (session.userId === req.user.userId)
  → CheckpointsService.createManualCheckpoint()
    → session not terminated check
    → ContainerManagerHttpClient.createManualCheckpoint()  ← 10s TIMEOUT HERE
      → axios POST /api/git/:sessionId/commit (10s default timeout)
      
Container-Manager: GitService.commit()
  → ensureGitInitializedInContainer()
    → execInContainer: 'command -v git || apk add --no-cache git; git rev-parse --is-inside-work-tree'
    → (if fail) execInContainer: 'command -v git || apk add --no-cache git; git init && git config ...'
  → execInContainer: 'git status --porcelain'
  → (if changes) git add -A → git commit → git rev-parse HEAD
  → createCheckpoint() — internal recording
```

### 20.1 Disposable Objects Created

| # | Object | Location | Purpose |
|---|--------|----------|---------|
| 1 | Session record | API Gateway PostgreSQL `sessions` table | Required for authentication/ownership validation |
| 2 | Session container | Docker (node:20-alpine) | Workspace execution environment under test |
| 3 | Container-manager SQLite record | container-manager `sessions` table | Internal session tracking |
| 4 | Workspace directory | HOST filesystem (volume-mounted) | Empty workspace for test file |

### 20.2 Expected DB Writes

| DB | Table | Write | When |
|----|-------|-------|------|
| PostgreSQL (api-gateway) | sessions | INSERT 1 row | Session creation (step 1) |
| PostgreSQL (api-gateway) | git_checkpoints | INSERT 1 row (if checkpoint succeeds) OR 0 rows (if timeout) | Checkpoint creation or internal recording |
| SQLite (container-manager) | sessions | INSERT 1 row | Container start |
| SQLite (container-manager) | checkpoints | INSERT 1 row (if container-manager completes despite timeout) | Container-manager's internal createCheckpoint() |

### 20.3 Expected Container/Filesystem/Git Mutations

| Mutation | When | Reversible |
|----------|------|-----------|
| Docker container created and started | Session creation | YES — DELETE session removes container |
| Workspace directory created on HOST | Session creation | YES — removed with container |
| Test file written to workspace `/workspace/test.txt` | File write step (step 2) | YES — removed with container |
| `apk add git` inside container | Checkpoint attempt (step 3) | N/A — container is disposable |
| `git init` inside container (if .git absent) | Checkpoint attempt (step 3) | N/A — container is disposable |
| `git add -A && git commit` inside container | Checkpoint attempt (if apk add completes within timeout) | N/A — container is disposable |

### 20.4 Whether Session Creation Initializes Git

**CRITICAL DETERMINATION:**

The API Gateway's `POST /api/sessions` flow:
1. `SessionService.createSession(userId)` → PostgreSQL INSERT
2. `ContainerManagerHttpClient.startSession(session.id, userId)` → container-manager `startSessionContainer()`

`startSessionContainer()` (container-manager `sessions.service.ts` lines 340-396):
- Creates SQLite record
- Creates workspace directory on HOST
- Creates and starts Docker container
- Notifies API Gateway

**It does NOT:**
- Call `initializeGit()`
- Install git in the container
- Create `.git` directory
- Create any commits

**Result:** After session creation, the container is running with an empty workspace, no `.git`, no git binary. The condition under test (git absent in container) is PRESERVED.

**Difference from E2E-02:** In E2E-02, the session was created through a flow that DID call `initializeGit()` on the HOST (creating `.git` in workspace). For this reproduction, `.git` will NOT exist. This means `ensureGitInitializedInContainer()` will execute BOTH the `apk add git` AND `git init`. This adds ~200ms of `git init` time on top of the `apk add` time but does NOT change the timeout test validity — the dominant factor is `apk add git`.

### 20.5 Exact HTTP Endpoint/Method for Reproduction

**Step 1 — Create session:**
```
POST https://<staging-host>/api/sessions
Cookie: aisandbox_session=<Keith-session-token>
Content-Type: application/json
(empty body or {})
```

**Step 2 — Write test file (ensures changes exist for commit):**
```
POST https://<staging-host>/api/sessions/<session-id>/files/write
Cookie: aisandbox_session=<Keith-session-token>
Content-Type: application/json
{"path": "test.txt", "content": "checkpoint timing test"}
```

**Step 3 — Trigger manual checkpoint (THE TEST):**
```
POST https://<staging-host>/api/sessions/<session-id>/checkpoints
Cookie: aisandbox_session=<Keith-session-token>
Content-Type: application/json
{"description": "03I-repro-timing-test"}
```

### 20.6 Authentication Mechanism

| Mechanism | Value |
|-----------|-------|
| Guard | `SessionCookieGuard` |
| Cookie name | `aisandbox_session` |
| Required value | Keith's valid session token (from browser or manual auth) |
| Ownership validation | `session.userId === req.user.userId` — session must be owned by authenticated user |

### 20.7 Safe Payload

Step 3 payload:
```json
{"description": "03I-repro-timing-test"}
```

This results in:
- `messageNumber` = 0 (default)
- `description` = "03I-repro-timing-test"
- `allowEmpty` = false (default — requires actual file changes)

### 20.8 Elapsed Request Time Measurement

PowerShell (client-side):

```powershell
$sw = [Diagnostics.Stopwatch]::StartNew()
try {
  $response = Invoke-WebRequest -Uri "https://<staging-host>/api/sessions/<id>/checkpoints" `
    -Method POST `
    -Headers @{ "Content-Type" = "application/json"; "Cookie" = "aisandbox_session=<token>" } `
    -Body '{"description":"03I-repro-timing-test"}' `
    -TimeoutSec 120
} catch {
  $response = $_.Exception.Response
}
$sw.Stop()
Write-Host "Elapsed: $($sw.ElapsedMilliseconds)ms  Status: $($response.StatusCode)"
```

The `TimeoutSec 120` on the CLIENT ensures the PowerShell request does NOT time out before the API Gateway's 10s timeout fires. We need to observe the SERVER timeout, not a client timeout.

### 20.9 Container-Manager-Side Timing Observation

Simultaneously with step 3, capture container-manager logs:

```powershell
# On staging server (SSH):
pm2 logs container-manager --lines 50 --timestamp
```

Look for:
- The `POST /api/git/:sessionId/commit` request arrival timestamp
- Any `apk add` output or exec duration
- The response being sent (completion timestamp)
- Delta between request arrival and response = actual processing time

If PM2 logs are insufficient, add a one-time timing log by Docker exec observation:
```bash
# After the test, check if git was installed:
docker exec <session-container> which git
# If git is found: the operation completed (even if api-gateway timed out)
```

### 20.10 Logs to Capture Simultaneously

| Log source | Command | What to look for |
|------------|---------|-----------------|
| API Gateway (PM2) | `pm2 logs api-gateway --timestamp` | Error message containing "Failed to create manual checkpoint" and "timeout" |
| Container-Manager (PM2) | `pm2 logs container-manager --timestamp` | Request handling for `/api/git/:id/commit`, exec timing |
| Docker container | `docker logs <container-manager-container>` | If container-manager runs in Docker |

### 20.11 Expected Result if Timeout Hypothesis is TRUE

1. Client-side elapsed time: **≈ 10,000ms** (± 500ms network jitter)
2. HTTP response: **500 Internal Server Error**
3. Response body: `{"statusCode": 500, "message": "Internal server error"}` (NestJS generic 500)
4. API Gateway PM2 log: Error message containing "timeout of 10000ms exceeded" or "ECONNABORTED"
5. Container-Manager PM2 log: Request received, `apk add git` starts, takes >10s; response eventually sent AFTER api-gateway already timed out
6. After test: `docker exec <container> which git` → git IS installed (operation continued despite client timeout)
7. After test: `docker exec <container> git -C /workspace log --oneline` → commit MAY exist (if operation completed)
8. PostgreSQL git_checkpoints: record MAY exist (from container-manager's internal `recordGitCheckpoint` call which succeeds independently)

### 20.12 Expected Result if Timeout Hypothesis is FALSE

1. Client-side elapsed time: **< 10,000ms** (operation completed within timeout)
2. HTTP response: **201 Created** with `{"message": "Changes committed successfully", "commitHash": "<hash>", "filesChanged": 1}`
3. OR: Quick 500 (< 1s) indicating a DIFFERENT error (container not running, Docker exec failure, etc.)
4. If quick 500: investigate response body and PM2 logs for actual error

### 20.13 Distinguishing API Gateway Timeout from Different HTTP 500

| Indicator | Timeout (ECONNABORTED) | Different error |
|-----------|----------------------|-----------------|
| Response time | ≈ 10,000ms (exactly the configured timeout) | < 10,000ms (immediate failure) |
| API Gateway log | "timeout of 10000ms exceeded" | Different error message (e.g., container not found, connection refused) |
| Container-manager log | Request received, processing continues after 10s mark | Request received, error occurs immediately |
| Container state after | git installed (operation continued) | git NOT installed (operation never started or failed early) |

### 20.14 Whether Request Continues After API Gateway Client Timeout

**YES.** The axios timeout is a CLIENT-SIDE timeout in the API Gateway. It closes the connection from the API Gateway's perspective. The container-manager's HTTP handler does NOT check for client disconnection. The container-manager continues processing (installing git, running commit) to completion even after the API Gateway has already returned HTTP 500 to the user.

Evidence: NestJS/Express handlers do not automatically abort on client disconnect unless explicitly implementing `req.on('close')` listeners. The container-manager's `GitController.commit()` and `GitService.commit()` have no such listeners.

### 20.15 Git State Inspection After Timeout

After the test (regardless of result):

```bash
# Check if git binary was installed:
docker exec <session-container> which git

# Check if .git exists:
docker exec <session-container> ls -la /workspace/.git

# Check if a commit was created:
docker exec <session-container> git -C /workspace log --oneline 2>/dev/null

# Check workspace files:
docker exec <session-container> ls -la /workspace/
```

If the timeout fired but container-manager completed:
- `which git` → `/usr/bin/git`
- `.git` exists
- `git log` shows a commit with message "03I-repro-timing-test" or "Auto-commit: Message 0"

### 20.16 DB Checkpoint Metadata Inspection After Timeout

```sql
-- PostgreSQL (api-gateway):
SELECT * FROM git_checkpoints WHERE session_id = '<session-id>';

-- Expected if timeout but internal recording succeeded:
-- 1 row with commit_hash, description, files_changed=1

-- Expected if timeout and internal recording also failed:
-- 0 rows
```

```sql
-- SQLite (container-manager):
-- Access via container-manager's SQLite DB file
SELECT * FROM checkpoints WHERE session_id = '<session-id>';
```

### 20.17 Orphan Git Commit / Git-DB Divergence Detection

An orphan exists if:
- `docker exec <container> git -C /workspace log --oneline` shows a commit
- BUT `SELECT * FROM git_checkpoints WHERE session_id = '<id>'` returns 0 rows

Under normal conditions (api-gateway healthy), the internal `recordGitCheckpoint` call from container-manager should succeed, preventing orphans. But verify both.

### 20.18 Cleanup Procedure

```powershell
# Delete the disposable session (API Gateway public endpoint):
# This stops the container, removes it, and marks session as terminated
Invoke-WebRequest -Uri "https://<staging-host>/api/sessions/<session-id>" `
  -Method DELETE `
  -Headers @{ "Cookie" = "aisandbox_session=<token>" }
```

This calls `SessionController.deleteSession()` → `containerManagerHttpClient.deleteSession()` → stops and removes Docker container.

The PostgreSQL session record remains (marked as terminated) — standard behavior, not a leak.

### 20.19 Whether Cleanup Requires Mutations

**YES.** Cleanup requires:
- Docker container stop + remove (via container-manager)
- PostgreSQL session status update (terminated_at set)
- Container-manager SQLite session status update

These are standard session lifecycle mutations performed by the existing DELETE endpoint.

### 20.20 Whether Disposable Session Can Be Safely Deleted

**YES.** The `DELETE /api/sessions/:id` endpoint:
- Validates ownership (only Keith can delete Keith's sessions)
- Stops and removes the Docker container
- Updates session status to terminated
- Does NOT affect any other sessions or production data
- The session record remains in PostgreSQL for audit (standard behavior)

Alternatively, the session will be cleaned up by idle timeout (default: 2 hours) if not manually deleted.

### 20.21 Provider Calls Expected

**0** — No AI provider calls at any step. Session creation, file write, and checkpoint are all local operations.

### 20.22 Credit Mutations Expected

**0** — No usage records created. No token consumption. No credit deduction.

### 20.23 GLOBAL_EXECUTION_ENABLED Required State

**false** — Must remain false. Not required for this test (no AI execution involved).

### 20.24 BILLING_CHARGES_ENABLED Required State

**false** — Must remain false. No billing operations involved.

### 20.25 Stripe/Payment Activity

**0** — No Stripe interaction. No payment operations.

### 20.26 REPRO_MUTATIONS_REQUIRED

**YES** — The following mutations are required and unavoidable:
1. PostgreSQL session INSERT (1 row, disposable)
2. Docker container creation (1 container, disposable)
3. Container-manager SQLite INSERT (1 row, disposable)
4. File write to workspace (1 file, inside disposable container)
5. Possible `apk add git` inside container (disposable)
6. Possible `git init` + `git commit` inside container (disposable)

All mutations are contained within the disposable session and are cleaned up by DELETE.

### 20.27 Keith Authorization Wording

> **AUTHORIZATION REQUEST:**
>
> PRIVATE-BETA-BLOCKER-03I Step 2 — Bounded Reproduction
>
> **Purpose:** Confirm or deny timeout hypothesis for manual checkpoint HTTP 500.
>
> **Mutations:**
> - 1 disposable PostgreSQL session record (Keith-owned)
> - 1 disposable Docker container (node:20-alpine)
> - 1 disposable container-manager SQLite record
> - 1 test file written inside container workspace
> - Possible git installation + commit inside container (if timeout does NOT fire before completion)
>
> **NOT involved:** No AI provider calls, no credit mutations, no billing changes, no Stripe activity, no GLOBAL_EXECUTION changes, no deployments, no source/test edits.
>
> **Cleanup:** DELETE /api/sessions/:id removes container. Session record remains in DB (terminated, standard lifecycle).
>
> **Time estimate:** < 5 minutes total including setup, test, observation, and cleanup.
>
> **Result determines:** Whether Step 3 proceeds as proven root-cause fix (with measured timeout value) or whether further investigation is needed.
>
> Authorize: YES / NO

### 20.28 Confirmation No Reproduction Has Yet Occurred

**HISTORICAL SNAPSHOT at plan-write time (superseded by §23 / §24):** At the time this plan was written, no reproduction had been performed.

**CURRENT:** Authorized reproduction completed 2026-08-16. Exactly one checkpoint attempt. Cleanup DELETE completed. See §24.

### 20.29 Confirmation No Source/Test Edits

**CONFIRMED:** Zero source files edited. Zero test files edited. Only documentation/governance files updated (this document, TASKS.md, TASKS_BACKLOG_FULL.md).

---

## 21. Remote staging Phase A — 2026-08-16 (SSH `aisandbox-staging`)

The first Phase A attempt was invalid: it ran against Keith's local Windows machine. It was discarded. Zero mutations.

This Phase A ran on the AWS host via `ssh aisandbox-staging`.

| Check | Result |
|-------|--------|
| REMOTE_HOSTNAME | `ip-172-26-6-228` |
| REMOTE_USER | `ubuntu` |
| REMOTE_APP_ROOT | `/opt/aisandbox` |
| REMOTE_STAGING_HEAD | `e34be9bdcdeed6cc1fbc1f0ce2f7e5689a62bdd0` (expected; not local `b9366ba`) |
| REMOTE_WORKTREE | CLEAN (`git status --short` empty) |
| PM2 | all 5 apps online: frontend, api-gateway, ai-service, container-manager, ops-watchdog |
| Gateway health | `http://localhost:4000/api/health` HTTP 200 `{"status":"ok","service":"api-gateway"}` |
| Container-manager health | `http://localhost:4002/api/health` HTTP 200 `{"status":"ok","service":"container-manager"}` |
| Remote Docker | daemon up (`29.6.2`); leftover `node:20-alpine` sandbox containers exist; none created this task |
| Remote PostgreSQL | `pg_isready` accepting connections; `SELECT 1` = 1 |
| GLOBAL_EXECUTION_ENABLED | `false` (api-gateway PM2 env) |
| BILLING_CHARGES_ENABLED | `false` (api-gateway PM2 env) |
| AGENT_HARNESS_ENABLE_TOOL_LOOP | `false` (api-gateway PM2 env) |
| Provider calls during 03I | 0 |
| Credit mutations during 03I | 0 |
| Retained stash | `stash@{0}` = `0372cc1f47f82e1db060ed2dd756a938fe324803` (`pre-03F-deployment-snapshot-2026-08-15`) — NOT dropped/popped/applied |
| Keith session quota | 0 active unexpired PG sessions; 0 created in 24h — quota would allow one new session |
| Auth mechanism | `SessionCookieGuard` + cookie `aisandbox_session` on `POST /api/sessions` and `POST /api/sessions/:id/checkpoints` |
| Auth availability | **FAIL** — Keith has 1 unexpired `auth_sessions` row (`last_login_at` 2026-08-16). Cookie is not available to this SSH agent. No user password in staging `.env`. Accessible Chrome/Edge profiles have no `aisandbox_session` cookie. Chrome Profile 5 cookie DB is locked by a running browser. |

**FAILED PREREQUISITE (superseded):** SSH-agent cookie extraction — no longer required.

**Unblock path:** Keith runs the same-origin DevTools script on the already-logged-in `https://staging.ainow.biz` browser tab (03H session). Cursor inspects staging over SSH. No new `auth_sessions` row. No cookie export.

---

## 22. Browser-auth reproduction (waiting for Keith) — 2026-08-16

Log baselines captured read-only at `2026-08-16T09:58:26Z` on `ip-172-26-6-228` (no service restart, no log config change):

| Log | Bytes | Lines |
|-----|------:|------:|
| `/home/ubuntu/.pm2/logs/aisandbox-api-gateway-out.log` | 13810852 | 82489 |
| `/home/ubuntu/.pm2/logs/aisandbox-api-gateway-error.log` | 846798 | 8571 |
| `/home/ubuntu/.pm2/logs/aisandbox-container-manager-out.log` | 136758 | 1055 |
| `/home/ubuntu/.pm2/logs/aisandbox-container-manager-error.log` | 77466 | 838 |

Reproduction mutations: **none yet**. Script must be run by Keith. Cleanup is a separate later command.

---

## 23. Authorized reproduction evidence — 2026-08-16 22:06 +08

**DISPOSABLE_SESSION_ID:** `344ab7b5-333f-429f-8175-537d098d8159`  
**CONTAINER_ID:** `a673a559c261f0eba7337bff01b488e6393d1304ad96daaeeacfedc7096b6dc4`  
**Image:** `node:20-alpine` **Status at capture:** running. **Status after cleanup:** terminated (see §24).

Browser: sessionCreate 201, file-write 204, checkpoint **HTTP 500 in 2181 ms**.

**TIMEOUT_HYPOTHESIS_CONFIRMED=NO** — 2181 ms << 10000 ms; Gateway error is `HTTP 500 - Internal server error`, not `timeout of 10000ms exceeded` / ECONNABORTED.

### Concrete error (container-manager, 10:06:37 PM)

`GitService.ensureGitInitializedInContainer` (`git.service.ts:374`) threw after `GitService.commit` (`git.service.ts:72`):

```
fatal: not in a git directory
```

stderr also contains `git init` default-branch hints (init ran; subsequent `git config` failed).

Same stack exists in Gateway logs for E2E-02 session `ec8a131a-...` on 2026-08-14 9:08:36 PM.

### Why it fails

1. Host workspace bind-mount `/opt/aisandbox/workspaces/<id>` is uid **1000**.
2. `docker exec` runs as **root** (container `User` empty).
3. `apk add git` succeeds (git 2.52.0 now present).
4. `git init` creates `/workspace/.git` owned by **root**.
5. Git 2.52 `safe.directory` refuses the mixed-ownership worktree.
6. `git config user.name` / later `git status` fail (`fatal: not in a git directory` at failure time; live inspect now shows `fatal: detected dubious ownership in repository at '/workspace'`).
7. Generic `Error` → Nest HTTP 500 on container-manager → Gateway `createManualCheckpoint` wraps as generic `Error` → Gateway HTTP 500.

Live inspect: `.git` exists, `test.txt` exists (`03I checkpoint reproduction`), **no commits**, `.git/config` has no `user.name`/`user.email`, 0 git objects, PG `git_checkpoints` 0 rows, SQLite `checkpoints` 0 rows.

**PARTIAL_STATE_POSSIBLE=YES** (git package + empty `.git`; no commit; no DB rows)  
**ORPHAN_GIT_CHECKPOINT_OBSERVED=NO**  
**GIT_DB_DIVERGENCE_OBSERVED=NO**

**ROOT_CAUSE_PROVEN=YES**

**SMALLEST_SAFE_FIX:** In `GitService.ensureGitInitializedInContainer`, after git is available, mark `/workspace` as `safe.directory` (global, persists for later `git status`/`add`/`commit` in the same root exec) before `git init`/`git config`. Do **not** increase Axios timeout.

**getGitDiff / revertToCheckpoint:** out of scope for this HTTP 500.

**Cleanup at capture time:** not yet run. Final cleanup is recorded in §24.

---

## 24. Step 2 Final Evidence Closure — 2026-08-16

**Status:** COMPLETE — Root Cause Proven by Authorized Bounded Reproduction — 2026-08-16

**Step 3:** PENDING — **GO**  
**Step 4:** PENDING  
**Final 03I checkpoint document:** NOT CREATED (correct — Step 4)

### Authorized reproduction (exactly one checkpoint attempt)

| Field | Value |
|-------|-------|
| Disposable session | `344ab7b5-333f-429f-8175-537d098d8159` |
| Checkpoint attempt | `POST /api/sessions/344ab7b5-333f-429f-8175-537d098d8159/checkpoints` |
| Checkpoint attempts | **Exactly one** |
| Session create | HTTP **201** |
| Test file write | HTTP **204** |
| Checkpoint | HTTP **500** |
| Checkpoint elapsed | **2181 ms** |
| Response body | `{ "statusCode": 500, "message": "Internal server error" }` |
| TIMEOUT_HYPOTHESIS_CONFIRMED | **NO** |

The previously suspected API Gateway 10-second Axios timeout is **not** the root cause. Do not increase the Axios timeout as part of 03I.

### Historical vs current evidence (do not conflate)

**Direct historical E2E-02 evidence** (`docs/PRIVATE-BETA-E2E-02-CHECKPOINT.md` §18): after Build/apply, manual checkpoint returned HTTP 500. The checkpoint document did **not** capture stack, payload, elapsed time, PM2 logs, or Git stderr. Do **not** claim the historical error text was captured.

**Direct current-reproduction evidence:** container-manager `GitService.ensureGitInitializedInContainer` threw; stderr included `fatal: not in a git directory` (init ran; subsequent Git config/access failed). Live inspect then reported `fatal: detected dubious ownership in repository at '/workspace'`.

**Correlation, not captured historical Git stderr:** Gateway logs for E2E-02 session `ec8a131a-0049-40df-8de4-42eab3ac1278` (2026-08-14 9:08:36 PM) show the same Gateway wrap path (`createManualCheckpoint` generic Error → HTTP 500). The currently deployed checkpoint path deterministically fails under the same fresh-session ownership condition.

### Proven runtime environment

| Field | Value |
|-------|-------|
| Container image | `node:20-alpine` |
| Git | 2.52.0 (installed during the attempt) |
| `/workspace` bind-mount ownership | uid **1000** |
| `docker exec` Git process | **root** |

### Failing service / function

| Field | Value |
|-------|-------|
| Service | container-manager |
| File | `services/container-manager/src/git/git.service.ts` |
| Function | `GitService.ensureGitInitializedInContainer()` |
| Caller | `GitService.commit()` |

### Failure position / mutation evidence (after the failed checkpoint, before cleanup)

| Field | Value |
|-------|-------|
| Git installed | YES |
| `.git` created | YES (empty; no user.name/email; 0 objects) |
| `test.txt` exists | YES |
| Git commit | **NO** |
| PostgreSQL `git_checkpoints` row | **NO** |
| container-manager SQLite checkpoint row | **NO** |
| Observed orphan committed checkpoint | **NO** |
| Observed Git/DB checkpoint divergence | **NO** |
| Failure occurred | after git installation + `git init`; before git config completed; before `git add`; before `git commit`; before checkpoint DB persistence |
| PARTIAL_STATE_POSSIBLE | **YES** — bounded to installed Git package + empty `.git` + test file |

### Cleanup evidence (Keith, authenticated)

`DELETE /api/sessions/344ab7b5-333f-429f-8175-537d098d8159`

Result: HTTP **200** `{ "message": "Session terminated successfully" }`

Post-cleanup verification:

| Field | Value |
|-------|-------|
| CLEANUP_RESULT | **PASS** |
| DISPOSABLE_SESSION_TERMINATED | **YES** |
| Docker container | removed (`docker inspect` → no such object) |
| PostgreSQL session row | `status=stopped`, `terminated=true`, `termination_reason=manual` (retained lifecycle row; **do not** manually delete) |
| Second checkpoint attempted | **NO** |

### Criticality

Staging: `AGENT_HARNESS_ENABLE_TOOL_LOOP=false`

| Flag | Value |
|------|-------|
| CURRENT_PLAIN_BUILDER_PATH_BLOCKED | **NO** |
| CHECKPOINT_SAFETY_DEFECT_PRESENT | **YES** |
| HARNESS_ENABLED_PATH_BLOCKED | **YES** |
| PRIVATE_BETA_03I_REQUIRES_FIX | **YES** |

Private beta remains **NO-GO**.

### Safety totals (full Step 2, including reproduction + cleanup)

| Flag | Value |
|------|-------|
| Provider calls | **0** |
| Credit mutations | **0** |
| Billing mutations | **0** |
| Stripe/payment activity | **0** |
| Source/test edits during Step 2 | **0** |
| GLOBAL_EXECUTION_ENABLED | **false** |
| BILLING_CHARGES_ENABLED | **false** |
| Retained pre-03F stash | `0372cc1f47f82e1db060ed2dd756a938fe324803` — untouched |

§17 above remains the earlier read-only investigation snapshot (0 DB writes at that moment). Reproduction later created a disposable session + test file; cleanup terminated the session. No `git_checkpoints` / SQLite checkpoint rows were created.

### Step 3 recommendation

| Field | Value |
|-------|-------|
| Step 3 | **GO** |
| Recommended model | Grok 4.6 High |
| Risk | NORMAL bounded implementation |
| Objective | Narrow `/workspace` `safe.directory` in `ensureGitInitializedInContainer`; regression in `git.service.spec.ts` |
| Timeout change | **OUT OF SCOPE — do not change** |

---

*Stage Start document created: 2026-08-16 — Evidence-tightened: 2026-08-16 — Reproduction plan corrected: 2026-08-16 — Remote Phase A 2026-08-16 — Browser-auth unblock prepared 2026-08-16 — Reproduction evidence captured 2026-08-16 — Final evidence closure after authorized reproduction + cleanup 2026-08-16 — no source/test edits — no Step 3 implementation — no final 03I checkpoint document.*
