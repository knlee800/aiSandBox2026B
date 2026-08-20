# PRIVATE-BETA-BLOCKER-03K — Step 3 Investigation Evidence

**Task ID:** PRIVATE-BETA-BLOCKER-03K  
**Title:** Builder Session Idle-Timeout Investigation  
**Step:** 3 — Bounded Investigation + Root-Cause Evidence  
**Date:** 2026-08-20  
**Nature:** READ-ONLY investigation. No application source, test, config, staging, database, provider, credit, env, or Git mutation.

```
ROOT_CAUSE_PROVEN=YES
OUTCOME_CLASS=EXPECTED_TIMEOUT_TEST_PROCEDURE_CAUSE_PROVEN
NO_FIX_IMPLEMENTED=YES
NO_STAGING_MUTATION=YES
NO_PROVIDER_OR_CREDIT_ACTIVITY=YES
NO_LOCAL_GIT_MUTATION=YES
```

This document is the only normal repository write authorized in Step 3.  
Do not treat this file as a scheduler. `TASKS.md` / `TASKS_BACKLOG_FULL.md` remain Step 4 control-plane work.

---

## 1. Bootstrap / Admission

| Check | Result |
|-------|--------|
| AGENTS.md | READ |
| CLAUDE.md | APPLIED |
| TASKS.md CURRENT EXECUTION BOARD only | READ; stopped at LEGACY / FROZEN |
| Canonical PRIVATE-BETA-BLOCKER-03K | READ |
| Frozen plan `docs/PRIVATE-BETA-BLOCKER-03K-STAGE-START.md` | READ IN FULL |
| E2E-04 checkpoint + execution evidence | READ (relevant sections) |
| Lane 1 | PRIVATE-BETA-BLOCKER-03K ACTIVE |
| Lane 1 mutex | STAGING |
| Lane 2 | EMPTY |
| Lane 3 | DISABLED |
| PROVIDER-LIVE | UNOWNED |
| CREDIT | UNOWNED |
| ENV | UNOWNED |
| PRIVATE-BETA-INVITE-01 | PROHIBITED |
| Admission | PASS — investigation started |

---

## 2. Local Baseline (pre-write)

```
PRE_STEP3_HEAD=b176a119342a2a48506e504ac3b2db9013e13652
PRE_STEP3_GIT_STATUS=(empty — clean working tree)
PRE_STEP3_HEAD_SUBJECT=freeze PRIVATE-BETA-BLOCKER-03K investigation plan
```

Expected post-Step-2 clean tree MATCHES. No unexpected local changes. Continue.

---

## 3. Implementation Facts Used (reconfirmed, not reopened)

Authoritative idle state:

- Container Manager `SessionsService.lastActivity: Map<string, number>` (in-memory only).
- `checkAndEnforceIdleTimeout` reads **only** that Map. It does **not** read SQLite `last_activity_at` or PostgreSQL `last_activity_at`.
- Session creation does **not** initialize the Map.
- First applicable check with no map entry: `lastActivity.set(sessionId, Date.now()); return;` (no timeout).
- After success, `updateLastActivity(sessionId)` sets `Date.now()`.
- Comparison operator: **`>`** (`elapsedMs > idleTimeoutMs`).
- Default `SESSION_IDLE_TIMEOUT_MS = 1800000` (30 minutes) via `governance.config.ts` `parseEnvInt`.
- Default `SESSION_MAX_LIFETIME_MS = 86400000` (24 hours).
- Request-driven only. No background sweeper.
- Active AI execution does not suppress idle enforcement.
- `activeExecs` tracks container `execInContainer` only, not provider executions.

Activity-touch YES (after success) for:

- `execInContainer`
- `readFileFromContainer`
- `writeFileToContainer`
- `deleteFileFromContainer`
- `searchFilesInContainer`
- `listDirectoryInContainer`
- `statPathInContainer`

Activity-touch NO for:

- session create / container start
- git `initializeGit` (host `simpleGit`; does not call `execInContainer`)
- preview start/status/proxy
- Builder submit / AI execution create
- provider streaming
- AI completion
- `finalize_accounting.build_awaiting_apply`
- frontend heartbeat (does not exist)

File-path split (contextual vs authoritative):

- Gateway public `POST /api/sessions/:id/files/write` → Container Manager `InternalSessionsController` → `writeFileToContainer` → Map only.
- `FilesService.writeFile` → `SessionsService.updateActivity()` → SQLite `last_activity_at` only (not the Map).
- PostgreSQL `touchLastActivity` / `touchSessionActivity` has **no production callers**.

E2E-04 was **plain path** (`enableToolLoop=false`).

These facts are **not** the root-cause verdict by themselves.

---

## 4. Deployed / Source Baseline

| Item | Value |
|------|--------|
| Staging SSH | PASS — `aisandbox-staging` / hostname `ip-172-26-6-228` |
| Staging HEAD | `c3e39279abe3c0d6c348daa312107c8f6fc592b7` |
| Staging `git status --short` | empty (clean) |
| Staging `git log -1` | `c3e3927 fix: add public build apply confirmation route` |
| E2E-04 expected HEAD | `c3e39279abe3c0d6c348daa312107c8f6fc592b7` |
| Source parity vs E2E-04 | MATCH |
| Local HEAD vs staging | DIFFERENT (`b176a119` is the 03K stage-start freeze only) |
| `sessions.service.ts` / `governance.config.ts` since `c3e39279` | NO commits (empty `git log` range) |

Current local source is sufficient to interpret historical E2E-04 idle behavior. Staging was **not** mutated to recreate an old tree.

---

## 5. Container Manager Process Lifetime (H12)

| Field | Value |
|-------|--------|
| PM2 name | `aisandbox-container-manager` |
| PM2 id | `1` |
| PID | `376195` |
| status | online |
| restart count | `2` |
| PM2 `created at` | `2026-08-17T03:02:16.700Z` |
| OS process start | `Mon Aug 17 11:02:16 2026` local (UTC+8) = **2026-08-17T03:02:16Z** |
| elapsed at capture | `3-03:43:37` |
| Nest start marker | `08/17/2026, 11:02:17 AM` local — `Nest application successfully started` / `🐳 Container Manager started!` |
| Nest start markers on 2026-08-19 | **NONE** |

**CM restarted during E2E-04 evidence window 2026-08-19T03:47:00Z–2026-08-19T04:25:00Z?** **NO.**

Consequence: the in-memory `lastActivity` Map for this session was **not** cleared by a process restart during the session lifetime. H12 is FALSIFIED.

Gateway **did** restart during the later E2E window (Phase P enable-gate): Nest start `08/19/2026, 12:16:19 PM` local = `2026-08-19T04:16:19Z`. Gateway restart does **not** clear Container Manager `lastActivity`.

---

## 6. Effective Runtime Timeout Config

Safe inspection: `pm2 env 1` key **counts** only (no secret dump).

| Key | Presence in CM process env | Effective value |
|-----|----------------------------|-----------------|
| `SESSION_IDLE_TIMEOUT_MS` | ABSENT (count=0) | default **1800000** ms |
| `SESSION_MAX_LIFETIME_MS` | ABSENT (count=0) | default **86400000** ms |
| `SESSION_TIMEOUT_MINUTES` | PRESENT (count=1), value `120` | **NOT READ** by `checkAndEnforceIdleTimeout` |

```
EFFECTIVE_SESSION_IDLE_TIMEOUT_MS=1800000
EFFECTIVE_SESSION_MAX_LIFETIME_MS=86400000
CONFIGURED_IDLE_TIMEOUT_MS=1800000
IDLE_COMPARISON_OPERATOR=>
```

Default semantics apply because deployed source at `c3e39279` matches those defaults.

`SESSION_TIMEOUT_MINUTES=120` is a non-authoritative leftover env key. Do not treat it as the idle threshold.

No unrelated environment values are recorded here. A prior broad `grep SESSION_` accidentally surfaced a secret in the investigator terminal; that value is **not** copied into this document.

---

## 7. PostgreSQL Session Row (contextual)

Query: frozen SELECT against `sessions` for `1492ed19-9417-4a93-a1fc-c5034d41d22e`.

`SHOW TimeZone` = `Asia/Hong_Kong` (+08). Columns are `timestamp without time zone` storing **local wall-clock**, not UTC. Frozen `AT TIME ZONE 'UTC'` therefore **mis-labels** local values as UTC. Authoritative normalization: `stored_local − 8h`.

| Column | Stored text (local, +08) | UTC |
|--------|--------------------------|-----|
| id | `1492ed19-9417-4a93-a1fc-c5034d41d22e` | — |
| status | `stopped` | — |
| container_id | empty | — |
| created_at | `2026-08-19 11:29:46.83897` | **2026-08-19T03:29:46.83897Z** |
| expires_at | `2026-08-19 12:29:46.838` | **2026-08-19T04:29:46.838Z** |
| last_activity_at | `2026-08-19 11:29:46.838` | **2026-08-19T03:29:46.838Z** |
| terminated_at | `2026-08-19 12:17:58.819` | **2026-08-19T04:17:58.819Z** |
| termination_reason | `idle_timeout` | — |
| user_id | `7f772841-7844-401b-a3da-e928b0c7b79c` | — |
| project_id | `f5de42f3-c52d-4b48-95d5-651db1af88eb` | — |

```
POSTGRES_LAST_ACTIVITY_AT=2026-08-19T03:29:46.838Z
POSTGRES_LAST_ACTIVITY_AT_CLASS=CONTEXTUAL ONLY — not the Map
POSTGRES_TERMINATED_AT=2026-08-19T04:17:58.819Z
POSTGRES_TERMINATED_AT_CLASS=DOWNSTREAM RECONCILIATION — not automatically IDLE_ENFORCEMENT_TIME
```

PostgreSQL `last_activity_at` equals create time and was never updated (`touchSessionActivity` has no callers).

---

## 8. Execution / Usage Row

Frozen SELECT against `usage_records` for `12a8e444-5f4b-4966-a4ee-e040a5bfd0b5`.

`timestamp` is `timestamp without time zone` local.

| Field | Value |
|-------|--------|
| execution_id | `12a8e444-5f4b-4966-a4ee-e040a5bfd0b5` |
| user_id | `7f772841-7844-401b-a3da-e928b0c7b79c` |
| session_id | `1492ed19-9417-4a93-a1fc-c5034d41d22e` |
| conversation_id | `1492ed19-9417-4a93-a1fc-c5034d41d22e` |
| provider | `xai` |
| adapter | `xai` |
| model (column) | empty |
| tokens_used | `1176` |
| execution_duration_ms | empty (column null) |
| execution_status | `completed` |
| timestamp local | `2026-08-19 12:17:55.619175` |
| timestamp UTC | **2026-08-19T04:17:55.619175Z** |

Metadata used (no secrets; file body omitted):

- `requestedModel=grok-4.5`
- `requestedProvider=xai`
- `executionIntent=workspace_mutation`
- `fileActions` count=1, path=`e2e-04.html`, action=`create`
- `parseMethod=structured_json`
- `apiKeyId=browser-session`

All usage rows for this session: **1 row** (this execution).

Git checkpoints: **0 rows**.  
Credit deduction records: **0 rows**.

AI-service runtime duration (stronger than the null DB column):

```
duration_ms=2934
queue_wait_ms=23
tokens=1176
selectedPath=plain
enableToolLoop=false
```

The provider call lasted **~3 seconds**, not ~48 minutes.

---

## 9. SQLite Contextual Evidence

DB path on staging: `/opt/aisandbox/database/aisandbox.db` (mtime `2026-08-19 12:17` local). Read-only URI.

SQLite `datetime('now')` is UTC.

Sessions row:

| Column | Value |
|--------|--------|
| id | `1492ed19-9417-4a93-a1fc-c5034d41d22e` |
| user_id | `7f772841-7844-401b-a3da-e928b0c7b79c` |
| project_id | `null` |
| status | `active` (idle path writes `terminated_at` but does not set `status='stopped'`) |
| created_at | `2026-08-19 03:29:46` UTC |
| expires_at | `2026-08-19 05:29:46` UTC |
| last_activity_at | `2026-08-19 03:29:46` UTC |
| terminated_at | `2026-08-19 04:17:58` UTC |
| termination_reason | `idle_timeout` |

```
PERSISTED_ACTIVITY_TIMESTAMP_CONTEXTUAL=2026-08-19T03:29:46Z (SQLite last_activity_at)
AUTHORITATIVE_RUNTIME_LAST_ACTIVITY=NOT THIS VALUE
```

SQLite `last_activity_at` is written by `FilesService` / `updateActivity()`, **not** by `InternalSessionsController` / `updateLastActivity`. It remained at insert default. It is **not** from the E2E-04 apply path.

Governance events (one row):

| Field | Value |
|-------|--------|
| id | 6 |
| session_id | `1492ed19-9417-4a93-a1fc-c5034d41d22e` |
| user_id | `7f772841-7844-401b-a3da-e928b0c7b79c` |
| termination_reason | `idle_timeout` |
| terminated_at | **`2026-08-19T04:17:58.644Z`** |
| source | `container-manager` |
| created_at | `2026-08-19 04:17:58` UTC |

`governance_events.terminated_at` is written by `checkAndEnforceIdleTimeout` via `new Date().toISOString()` at the enforcement instant. This is the best exact `IDLE_ENFORCEMENT_TIME`.

---

## 10. Narrow Log Evidence

Window used: `2026-08-19T03:29:00Z` through `2026-08-19T04:25:00Z` (session create through after apply), with idle-window focus `03:47Z–04:25Z`.

Identifiers: session `1492ed19-9417-4a93-a1fc-c5034d41d22e`, execution `12a8e444-5f4b-4966-a4ee-e040a5bfd0b5`, project `f5de42f3-c52d-4b48-95d5-651db1af88eb`.

Proven log sources only. No grep for unlogged function names as if they were log lines.

### 10.1 Container Manager out

```
✓ Container created: sandbox-session-1492ed19-9417-4a93-a1fc-c5034d41d22e (234ec446ca6954ac66e0cb7421904cb895b78fa57562ced9450e4f29caf36423)
✓ Container started: 234ec446ca6954ac66e0cb7421904cb895b78fa57562ced9450e4f29caf36423
[Nest] 376195  - 08/19/2026, 11:29:47 AM  LOG [ApiGatewayHttpClient] Session started: 1492ed19-9417-4a93-a1fc-c5034d41d22e
[Nest] 376195  - 08/19/2026, 12:17:58 PM  LOG [ApiGatewayHttpClient] Session stopped: 1492ed19-9417-4a93-a1fc-c5034d41d22e (reason: idle_timeout)
✓ Container stopped: 234ec446ca6954ac66e0cb7421904cb895b78fa57562ced9450e4f29caf36423
✓ Container removed: 234ec446ca6954ac66e0cb7421904cb895b78fa57562ced9450e4f29caf36423
```

UTC:

- Session started notify: **2026-08-19T03:29:47Z**
- Session stopped notify: **2026-08-19T04:17:58Z**

No per-request file/exec logs exist in Container Manager (source-proven).

### 10.2 Container Manager error — first Map-init proxy

One matching line, last write of the error log:

```
[Task 9.5A] Quota evaluation failed for session 1492ed19-9417-4a93-a1fc-c5034d41d22e, failing open: no such table: token_usage
```

Error-log mtime: **`2026-08-19 11:29:47.276997496 +0800`** = **2026-08-19T03:29:47.277Z**.

Source order on workspace ops: idle check **then** quota. Quota fail-open therefore proves a workspace op **passed** idle (first-access init) at that instant, then would `updateLastActivity` after success.

This is the **first proven in-memory Map initialization/touch**.

No later quota lines exist for this session → no later successful-past-idle workspace ops were logged.

### 10.3 API Gateway (relevant only)

```
08/19/2026, 11:29:47 AM  DEBUG Internal route access granted: /api/internal/sessions/1492ed19-9417-4a93-a1fc-c5034d41d22e/start
[Preview Proxy] GET/POST /api/preview/1492ed19-.../status|start  (no Nest timestamp on these lines; after start, before 12:16 restart)
08/19/2026, 12:16:19 PM  Nest application starting...  (Phase P gateway restart; CM untouched)
08/19/2026, 12:17:55 PM  execution.intent_written timestamp=2026-08-19T04:17:55.623Z executionId=12a8e444-...
08/19/2026, 12:17:58 PM  Internal route access granted: /api/internal/executions/12a8e444-.../finalize-accounting
08/19/2026, 12:17:58 PM  finalize_accounting.request_received timestamp=2026-08-19T04:17:58.573Z
08/19/2026, 12:17:58 PM  finalize_accounting.build_awaiting_apply timestamp=2026-08-19T04:17:58.575Z
08/19/2026, 12:17:58 PM  Internal route access granted: /api/internal/sessions/1492ed19-.../stop
08/19/2026, 12:20:16 PM  Nest start (Phase restore GLOBAL_EXECUTION_ENABLED=false)
```

Gateway does **not** log public `GET /api/sessions/:id/files/list` or `POST .../files/write` request lines. Those ops are inferred from source + CM quota/idle side effects.

Preview proxy is source-proven **NO** Map touch.

No `files/write` success log exists (apply failed). No git-checkpoint internal grant for this session.

### 10.4 AI service

```
08/19/2026, 12:17:55 PM  Worker received/claimed executionId=12a8e444-...
agent_harness.route_evaluated enableToolLoop=false selectedPath=plain
Executing AI request via adapter (model=grok-4.5, provider=xai, session=1492ed19-...)
08/19/2026, 12:17:58 PM  AI execution completed tokens=1176
file_action.parse_result fileActionCount=1 executionIntent=workspace_mutation
execution_completed duration_ms=2934 queue_wait_ms=23
Ledger finalized
```

UTC: start **2026-08-19T04:17:55Z**, complete **2026-08-19T04:17:58Z**.

---

## 11. Activity-Touch Reconstruction Table

Only rows with a timestamp **and** source-proven Map semantics.

| UTC_TIMESTAMP | SERVICE | REQUEST/EVENT | SESSION_ID | TOUCHES_CONTAINER_MANAGER_LAST_ACTIVITY | EVIDENCE_SOURCE | CONFIDENCE |
|---------------|---------|---------------|------------|-----------------------------------------|-----------------|------------|
| 2026-08-19T03:29:46.839Z | API Gateway / CM | session create | 1492ed19-… | NO | PG/SQLite created_at; source `createSession` | EXACT |
| 2026-08-19T03:29:47Z | CM | container start + `Session started` notify | 1492ed19-… | NO | CM out log; source start path | EXACT |
| 2026-08-19T03:29:47.277Z | CM | first workspace op that reached quota (almost certainly `listDirectoryInContainer` after workspace open) | 1492ed19-… | YES (first-access init + post-success `updateLastActivity`) | CM error log + mtime; source idle-then-quota order; frontend `files/list` | EXACT time; CONDITIONAL exact route (list vs read/stat) |
| ~03:29:47Z–04:16:19Z | Gateway preview proxy | preview status/start | 1492ed19-… | NO | Gateway preview proxy lines; source preview bypass | PROVEN BOUNDED |
| 2026-08-19T04:16:19Z | Gateway | PM2 restart (enable execution gate) | n/a | NO | Gateway Nest start; CM PID unchanged | EXACT |
| 2026-08-19T04:17:55.623Z | Gateway / AI | execution create / provider start | 1492ed19-… | NO | Gateway `execution.intent_written`; AI worker logs; source plain path | EXACT |
| 2026-08-19T04:17:55Z–04:17:58Z | AI | provider streaming | 1492ed19-… | NO | duration_ms=2934; source streaming bypass | EXACT |
| 2026-08-19T04:17:58Z | AI | completion + file-action parse | 12a8e444-… | NO | AI `execution_completed` | EXACT |
| 2026-08-19T04:17:58.575Z | Gateway | `finalize_accounting.build_awaiting_apply` | 12a8e444-… | NO | Gateway JSON log | EXACT |
| 2026-08-19T04:17:58.644Z | CM | idle enforcement on inbound workspace request (apply write and/or post-completion file list) | 1492ed19-… | NO (throws before `updateLastActivity`) | governance_events `terminated_at`; CM `Session stopped ... idle_timeout` | EXACT enforcement; CONDITIONAL which HTTP route |
| 2026-08-19T04:17:58Z | Gateway | internal `/stop` receipt | 1492ed19-… | NO | Gateway debug grant | EXACT |
| 2026-08-19T04:17:58.819Z | Gateway Postgres | `terminateSession` reconciliation | 1492ed19-… | NO | PG terminated_at | EXACT |
| 2026-08-19T04:17:58Z | CM Docker | container stop+remove | 1492ed19-… | NO | CM out `Container stopped/removed` | EXACT (second resolution) |

Do not mark YES merely because the browser stayed open.

---

## 12. Authoritative Last-Activity Reconstruction

```
RECONSTRUCTED_AUTHORITATIVE_LAST_ACTIVITY_TIME=2026-08-19T03:29:47.277Z
RECONSTRUCTION_CONFIDENCE=EXACT
FIRST_PROVEN_MAP_INITIALIZATION_OR_TOUCH=2026-08-19T03:29:47.277Z
LAST_PROVEN_ACTIVITY_TOUCH=2026-08-19T03:29:47.277Z
```

Basis: the only logged workspace op that passed idle+quota for this session occurred at error-log mtime `03:29:47.277Z`. No later quota/touch evidence exists. CM process did not restart. Session create is **not** Map start.

Not substituted: PostgreSQL `last_activity_at`, SQLite `last_activity_at`, `updated_at`, `created_at` (those are contextual / equal to create).

Route identity of that first op is CONDITIONAL (workspace `files/list` is the source-typical open path). The **time** of the Map write is EXACT.

---

## 13. Idle Enforcement Time

```
IDLE_ENFORCEMENT_TIME=2026-08-19T04:17:58.644Z
IDLE_ENFORCEMENT_CONFIDENCE=EXACT
```

Evidence: `governance_events.terminated_at = 2026-08-19T04:17:58.644Z` written inside `checkAndEnforceIdleTimeout` at fire time.

Related but **not** equivalent:

| Event | UTC | Relation |
|-------|-----|----------|
| AI complete | 04:17:58Z | nearby; not enforcement |
| accounting finalize | 04:17:58.575Z | 69 ms **before** governance ISO; gateway-only |
| CM stop notify log | 04:17:58Z | same-second notify after fire |
| Gateway `/stop` grant | 04:17:58Z local 12:17:58 | async notify receipt |
| Postgres terminated_at | 04:17:58.819Z | **175 ms after** governance ISO; downstream reconciliation |
| Docker remove | 04:17:58Z | async cleanup after 410 |

Propagation: CM fire → SQLite `terminated_at` + governance row → `setImmediate` notify Gateway `/stop` → Postgres `terminated_at=04:17:58.819Z` → Docker stop/remove.

---

## 14. Timeout Arithmetic

```
ACTUAL_IDLE_DURATION_MS = 2026-08-19T04:17:58.644Z − 2026-08-19T03:29:47.277Z
                        = 2,891,367 ms
                        ≈ 48 min 11.367 s

CONFIGURED_IDLE_TIMEOUT_MS = 1,800,000

DELTA_FROM_THRESHOLD = 2,891,367 − 1,800,000
                     = +1,091,367 ms
                     ≈ +18 min 11.367 s

OPERATOR = >
THRESHOLD_WOULD_BE_REACHED_AT ≈ 2026-08-19T03:59:47.277Z
```

`DELTA_FROM_THRESHOLD > 0`: the configured idle threshold was **genuinely exceeded**. Not premature vs the implementation.

Even the conservative bound (last touch must be before `04:17:58.644Z − 1800000ms = 03:47:58.644Z` for idle to fire) is satisfied: proven last touch is **18+ minutes before** that bound.

---

## 15. First Map Initialization

Session create does **not** initialize the Map.

First request that caused `lastActivity.set(sessionId, Date.now())`:

- Time: **2026-08-19T03:29:47.277Z**
- Mechanism: missing-map idle check (init + return) then successful workspace op `updateLastActivity`
- Evidence: quota fail-open after idle, log mtime
- Typical route: frontend workspace open `GET /api/sessions/:id/files/list`

```
SESSION_CREATED_AT ≠ AUTHORITATIVE_LAST_ACTIVITY_START
SESSION_CREATED_AT=2026-08-19T03:29:46.839Z
FIRST_MAP_INIT=2026-08-19T03:29:47.277Z
```

~0.4 s after create. Subsequent 48 minutes had **no** proven Map touch.

---

## 16. Normalized E2E-04 UTC Timeline

| Field | UTC | Class |
|-------|-----|--------|
| SESSION_CREATED_AT | 2026-08-19T03:29:46.839Z | PROVEN EXACT |
| CONTAINER_STARTED_AT | 2026-08-19T03:29:47Z | PROVEN EXACT (log second) |
| FIRST_PROVEN_MAP_INITIALIZATION_OR_TOUCH | 2026-08-19T03:29:47.277Z | PROVEN EXACT |
| LAST_PROVEN_ACTIVITY_TOUCH | 2026-08-19T03:29:47.277Z | PROVEN EXACT |
| E2E procedure continues (credit baseline, gate enable) | 03:29:47Z–04:16:19Z | CONTEXTUAL (execution doc Phases N–Q) |
| GATEWAY_RESTART (enable execution) | 2026-08-19T04:16:19Z | PROVEN EXACT |
| EXECUTION_CREATED/STARTED | 2026-08-19T04:17:55.623Z | PROVEN EXACT |
| PROVIDER_ACTIVITY | 04:17:55Z–04:17:58Z (2934 ms) | PROVEN EXACT |
| AI_COMPLETION | 2026-08-19T04:17:58Z | PROVEN EXACT |
| ACCOUNTING_FINALIZATION | 2026-08-19T04:17:58.575Z | PROVEN EXACT |
| IDLE_ENFORCEMENT | 2026-08-19T04:17:58.644Z | PROVEN EXACT |
| POSTGRES TERMINATION RECONCILIATION | 2026-08-19T04:17:58.819Z | PROVEN EXACT |
| CONTAINER_REMOVAL | 2026-08-19T04:17:58Z | PROVEN EXACT (second) |
| WORKSPACE_APPLY_ATTEMPT | ≈2026-08-19T04:17:58.644Z (same request that fired idle, or immediately adjacent file-list then write) | PROVEN BOUNDED (no gateway write access log; 410 + UI fail coincide) |

E2E procedure fact: session was created in Phase L at 03:29:46Z; the frozen Builder prompt was submitted in Phase R at 04:17:55Z — **~48 minutes later**. That gap is setup (Phases N–Q), **not** provider latency.

---

## 17. Hypothesis Verdict Matrix

| ID | Verdict | Evidence |
|----|---------|----------|
| **H1** Configured idle threshold genuinely exceeded | **SUPPORTED** | ACTUAL_IDLE_DURATION_MS=2,891,367 > 1,800,000; DELTA=+1,091,367; operator `>`; CM up continuously |
| **H2** Frontend heartbeat absent/failure | **SUPPORTED as contributing condition, not root cause** | Source: no heartbeat exists. Absence allowed the 48 min setup gap to count as idle. The timeout still fired because the gap exceeded 30 min, not because a heartbeat “failed.” |
| **H3** Heartbeat sent but wrong store | **FALSIFIED** | No heartbeat implementation exists to misroute |
| **H4** Builder execution start does not touch activity | **SUPPORTED as mechanism; not this incident’s duration cause** | Source YES; logs: execution started 04:17:55Z, 18 min **after** threshold already passed at 03:59:47Z |
| **H5** Streaming does not touch activity | **SUPPORTED as mechanism; not this incident’s duration cause** | Source YES; stream lasted 2934 ms only |
| **H6** Sweeper ignores in-flight AI | **FALSIFIED** | No sweeper. Enforcement is request-driven on the apply/list that arrived after AI completed |
| **H7** Race vs nearby timestamps | **FALSIFIED as causal race** | AI complete / accounting / idle are within ~1 s because apply followed a 3 s execution. Idle condition had already been true for ~18 min. Nearby clocks describe unfortunate click timing, not a boundary race |
| **H8** Timestamp/clock calculation defect | **FALSIFIED** | Idle math is `Date.now()` minus `Date.now()`; effective timeout is default 1800000; PG timezone confusion does not feed the Map |
| **H9** Cleanup too early / manual stop | **FALSIFIED** | Only `idle_timeout` path; Gateway `/stop` is CM notify; no admin stop; SQLite+governance+PG reason all `idle_timeout` |
| **H10** Frontend/backend lifecycle disagreement | **SUPPORTED as UX consequence** | UI still offered apply; backend Map already idle. Not an independent mechanism |
| **H11** Implementation correct; product timeout contract incompatible with long Builder execution | **WEAKENED / NOT THE CAUSE OF THIS INCIDENT** | Implementation matched the 30 min contract. This run’s provider call was 3 s. The 48 min gap was E2E **procedure delay after session open**, not a long provider call. H11 remains a **latent product risk** for future long executions, not the proven cause here |
| **H12** CM restart cleared Map | **FALSIFIED** | PID 376195 started 2026-08-17T03:02:16Z; no 08/19 start marker; uptime 3d+ through the window |

No additional H13 required. The extra fact is **test-procedure idle**, which is H1 + E2E phase timing, classified as the outcome class below.

---

## 18. Root-Cause Proof Assessment

Frozen proof standard:

1. **Implementation contract identified:** YES — `checkAndEnforceIdleTimeout` / `>` / 1800000 default / Map-only.
2. **E2E-04 runtime facts identified:** YES — effective timeout, CM lifetime, last touch, enforcement time, execution duration.
3. **Expected behavior calculated:** YES — last touch 03:29:47.277Z + 1800000 ms → eligible to fire after 03:59:47.277Z.
4. **Actual vs expected:** YES — fire at 04:17:58.644Z, 18 min 11 s after threshold, on the next workspace request.
5. **Competing hypotheses addressed:** YES — H3/H6/H7/H8/H9/H12 falsified; H4/H5/H11 not duration-causal here; H2/H10 contributing.
6. **Responsible mechanism named:** YES — request-driven idle enforcement on a session with no Map touch for 48 min 11 s, because the E2E runbook created the session ~48 min before apply, and neither heartbeat nor AI/plain-path refreshed the Map.

```
ROOT_CAUSE_PROVEN=YES
OUTCOME_CLASS=EXPECTED_TIMEOUT_TEST_PROCEDURE_CAUSE_PROVEN
```

Not forced into an implementation-defect class. The idle subsystem did what it is coded to do.

---

## 19. Exact Proven Causal Mechanism

1. Phase L created session `1492ed19-…` at **03:29:46.839Z**.
2. ~**03:29:47.277Z** a workspace op (typical: file list) initialized `lastActivity` and passed quota fail-open.
3. Phases N–Q (credit baseline, enable `GLOBAL_EXECUTION_ENABLED`, gateway restart) occupied wall-clock until **04:16:19Z** with **no** Container Manager Map touch (preview ≠ touch; gateway restart ≠ CM restart).
4. Phase R submitted the Builder prompt at **04:17:55.623Z**. Plain-path AI ran **2934 ms** and did not touch the Map. By then idle had already been over threshold since **03:59:47.277Z**.
5. After `build_awaiting_apply` at **04:17:58.575Z**, the qualifying apply (and/or a file-list refresh) hit `writeFileToContainer` / `listDirectoryInContainer`.
6. `checkAndEnforceIdleTimeout` computed `elapsedMs=2,891,367 > 1,800,000`, wrote SQLite/governance `idle_timeout`, scheduled cleanup, notified Gateway, threw 410.
7. Apply failed. `e2e-04.html` was not saved. Confirm-build-apply was never reached.

**Owning mechanism:** Container Manager idle enforcement, triggered by a workspace request after a genuine >30 min Map idle caused by E2E procedure timing plus absence of any keepalive on the AI/plain path.

**Contributing conditions (not root cause):**

- No frontend heartbeat (H2)
- Plain-path AI does not touch activity (H4/H5) — would matter for long executions; here AI was 3 s
- Request-driven enforcement with no user warning (H10)
- Latent product gap for future long Builder calls (H11)

**Major hypotheses falsified:** H3, H6, H7 (as race), H8, H9, H12.

---

## 20. Missing Evidence

| Missing | Why it matters | Permanently unavailable? | Bounded non-provider repro? | New provider-live E2E? |
|---------|----------------|--------------------------|-----------------------------|------------------------|
| Gateway access log for `files/list` / `files/write` | Exact HTTP route of first touch and of the 410 request | Likely yes for this historical run (never logged) | Yes — add logging later; not required to prove idle math | Not required to prove **this** cause |
| In-memory Map dump at fire time | Direct lastActivity read | Yes — ephemeral; process still up but session entry deleted at fire | N/A | N/A |
| Browser network log | Confirm apply vs list as the 410 trigger | Yes unless Keith retained HAR | Optional | Optional |

None of these gaps undo H1 arithmetic or the procedure-gap timeline.

---

## 21. Smallest Separate Repair Recommendation (NOT implemented)

03K must **not** fix. A later registered task should choose among (smallest first):

1. **Procedure-only (may be sufficient for the next E2E if product keeps 30 min idle):** create the session immediately before the Builder prompt, or perform a workspace op (list/stat) within 30 min of apply. No code change.
2. **If product intends long-lived Builder work / thinking time / long provider calls:** add an explicit activity touch or idle-suppression at execution **start** (and optionally completion) in Container Manager, **or** a frontend heartbeat to a Map-updating route. Do not “fix” by only writing PostgreSQL/SQLite `last_activity_at`.

Likely owning service/file/function if a code fix is chosen:

- Primary: `services/container-manager/src/sessions/sessions.service.ts` — `checkAndEnforceIdleTimeout`, `updateLastActivity`
- If heartbeat: frontend workspace shell + new Gateway/CM activity route
- If execution-start touch: Gateway AI execution start → CM internal activity endpoint (does not exist today)

Required future tests:

- Unit: idle `>` 1800000; first-access init; execution start does/does not touch (per chosen contract)
- Integration: workspace list then 30 min+ then write → 410 under current contract
- If code changes keepalive: execution-in-flight then write still allowed
- Live: **fresh** provider-live E2E after any product-behavior change (do not reuse E2E-04)

Likely future mutex/resources:

- If procedure-only E2E rerun: STAGING, PROVIDER-LIVE, CREDIT, ENV (execution gate)
- If CM keepalive: CONTAINER-MANAGER, possibly GATEWAY; FRONTEND+I18N if heartbeat UX
- Not required: MIGRATION (no schema for Map)

```
CONFIG_OR_MIGRATION_IMPLICATED=NO
FUTURE_FRESH_PROVIDER_LIVE_E2E_REQUIRED=YES (to clear the private-beta E2E gate after whichever repair/procedure is chosen)
NON_PROVIDER_REPRODUCTION_NEEDED=NO to prove this incident
NON_PROVIDER_REPRODUCTION_POSSIBLE=YES (wait >30 min after a list, then write)
```

---

## 22. Explicit No-Fix / No-Mutation Statement

Step 3 did **not**:

- modify application source, tests, or config
- restart or reload any service
- deploy
- modify staging Git or files
- modify database rows
- change environment variables
- enable execution gates
- create a project/session/container
- reopen or retry E2E-04
- call any AI provider
- mutate credits
- perform local Git mutation

`TASKS.md` and `TASKS_BACKLOG_FULL.md` were **not** updated.

Lane 1 remains ACTIVE and retains STAGING.

---

## 23. Recommended Step 4 Input

Control plane should:

1. Record Step 3 COMPLETE with `ROOT_CAUSE_PROVEN=YES` and `OUTCOME_CLASS=EXPECTED_TIMEOUT_TEST_PROCEDURE_CAUSE_PROVEN`.
2. Keep PRIVATE-BETA-INVITE-01 prohibited.
3. Keep builder private-beta NO-GO pending a **fresh** E2E (E2E-04 still FAIL/BLOCKED; do not reuse it).
4. Decide in a **separate** registered task whether the next action is:
   - procedure change only (session create immediately before Build), or
   - a product keepalive/idle-suppression implementation (H11 latent risk for real long runs).
5. Do not treat missing heartbeat as the proven root cause of this incident.
6. Do not treat a 48-minute provider call as proven; it is **falsified** (`duration_ms=2934`).

---

*Created 2026-08-20 — PRIVATE-BETA-BLOCKER-03K Step 3 investigation write only — no application / test / staging / provider / credit / env / Git mutation.*
