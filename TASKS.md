## Authority & Scope

This file lists currently ACTIVE and SELECTED tasks.

All tasks originate from:

`TASKS_BACKLOG_FULL.md`

Rules:

- This file does NOT define new tasks
- This file only activates tasks from the backlog
- Completed tasks must produce checkpoints
- Locked tasks must not be modified

If conflicts exist, TASKS_BACKLOG_FULL.md takes precedence.


\# TASKS.md ??Master Task Index



---



\## Authority Notice



This file defines the official task structure.



All implementation work must map to tasks listed here.



Checkpoint files must reference these paths.



---



\## Repository Context



All task files are relative to repository root.



There is NO aiSandBox/ directory.



All module paths start from root.



---



\## Task Organization Model



Tasks are organized by subsystem.



Each subsystem owns its own file.



No cross-ownership.



---



\## Modules



\### Core Platform



\- Session Management  

&nbsp; ??`TASKS/session\_management.md`



\- Chat System  

&nbsp; ??`TASKS/chat\_system.md`



\- Container Manager  

&nbsp; ??`TASKS/container\_manager.md`



\- AI Execution  

&nbsp; ??`TASKS/ai\_execution.md`



---



\### Infrastructure



\- Git \& Checkpoints  

&nbsp; ??`TASKS/git\_checkpoint.md`



\- Preview System  

&nbsp; ??`TASKS/preview\_system.md`



\- Import \& Export  

&nbsp; ??`TASKS/import\_export.md`



\- Deployment  

&nbsp; ??`TASKS/deployment.md`



---



\### Business Layer



\- Billing  

&nbsp; ??`TASKS/billing.md`



\- Quota \& Usage  

&nbsp; ??`TASKS/quota.md`



\- Accounts  

&nbsp; ??`TASKS/accounts.md`



---



\## Task File Standards



Every task file MUST contain:



1\. Scope

2\. Preconditions

3\. Deliverables

4\. Invariants

5\. Tests

6\. Rollback

7\. Checkpoint rules



---



\## Naming Convention



```

TASK-X.Y.Z.md

```



Where:



\- X = Phase

\- Y = Stage

\- Z = Subtask



Example:



```

TASK-12.2-C.md

```



---



\## Workflow Integration



\### Standard Flow



1\. Select task

2\. Lock scope

3\. Generate Claude prompt

4\. Implement

5\. Verify

6\. Checkpoint

7\. Lock



No skipping steps.



---



\## Checkpoint Binding



Each completed task must produce:



```

/docs/PHASE-X-STAGE-Y-CHECKPOINT.md

```



Referencing:



\- TASK ID

\- Files changed

\- Tests

\- Invariants



---



\## Status Tracking



Task status must be one of:



\- PLANNED

\- ACTIVE

\- BLOCKED

\- COMPLETE

\- LOCKED



Only LOCKED is immutable.



---



\## Modification Rules



\- No silent scope expansion

\- No retroactive edits

\- No merging tasks

\- No splitting without approval



---



\## Final Authority Clause



If any implementation conflicts with this file:



This file wins.



No exceptions.



---



\## Active Tasks



\### Phase 40B: Runtime Hardening



**Current Stage:** 40B-3



**Active Task:** TASK-40B-3R



\#### TASK-40B-3R: Runtime Hardening ??Concurrency & Stress Verification

**Status:** ACTIVE  
**Nature:** DIAGNOSTIC + FIX-IF-REQUIRED  
**Checkpoint:** `docs/PHASE-40B-3R-CHECKPOINT.md`

**Objective:**  
Validate session and container runtime correctness under concurrency and stress conditions on Windows.

**Scope:**
- Rapid session create/delete cycles
- Multiple sessions per user behavior
- Concurrent requests during lifecycle changes
- Service restart during active sessions
- Orphan resource detection (containers, volumes, networks)
- Deterministic error behavior under load**Non-Goals:**
- ??No database schema changes or migrations
- ??No architectural refactors
- ??No performance optimization (unless fixing correctness bugs)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-40B-3R for full details

---

### Phase 41: Observability & Runtime Metrics Foundation



**Current Stage:** 41C



**Active Task:** TASK-41C



#### TASK-41A: Observability & Runtime Metrics Foundation

**Status:** COMPLETE and LOCKED  
**Nature:** IMPLEMENTATION (ADDITIVE ONLY)  
**Checkpoint:** `docs/PHASE-41A-CHECKPOINT.md`

**Objective:**  
Introduce minimal runtime observability for diagnostic visibility into session and container runtime state.

**Scope:**
- Lightweight `/api/runtime/metrics` endpoint in api-gateway
- Session statistics (active count, terminated count, termination reasons)
- Container statistics (running count via Docker API)
- Health diagnostics enhancement (database + Docker connectivity)
- Structured logging improvements (minimal)

**Non-Goals:**
- ??No external monitoring systems (Prometheus, Grafana, etc.)
- ??No database schema changes
- ??No background workers
- ??No architectural refactors
- ??No performance optimization

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-41A for full details

---


#### TASK-41B: Security Hardening �X Rate Limits + Internal Endpoint Protection

**Status:** COMPLETE and LOCKED  
**Nature:** IMPLEMENTATION (MINIMAL, ADDITIVE ONLY)  
**Checkpoint:** `docs/PHASE-41B-CHECKPOINT.md`

**Objective:**  
Add minimal rate limiting to high-risk endpoints and harden internal endpoint protection to prevent abuse.

**Scope:**
- Rate limiting for `POST /api/sessions` (10 per minute per IP)
- Rate limiting for `DELETE /api/sessions/:id` (5 per minute per IP)
- Rate limiting for `POST /api/ai/execute` (20 per minute per IP)
- Verify all `/api/internal/*` routes require InternalServiceAuthGuard
- Tighten auth checks if any endpoint bypasses guard
- HTTP 429 Too Many Requests with Retry-After header
- In-memory rate limiter (no Redis/external dependencies)

**Non-Goals:**
- ??No external WAF/CDN
- ??No database schema changes
- ??No new authentication system
- ??No background workers
- ??No architectural refactors
- ??No dependency-heavy security frameworks
- ??No UI changes

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-41B for full details

---


#### TASK-41C: Abuse Hardening — Proxy-Aware IP Normalization

**Status:** COMPLETE and LOCKED  
**Nature:** IMPLEMENTATION (MINIMAL, ADDITIVE ONLY)  
**Checkpoint:** `docs/PHASE-41C-CHECKPOINT.md`

**Objective:**  
Improve rate limiting accuracy by correctly parsing client IP addresses from proxy headers.

**Scope:**
- Parse X-Forwarded-For header correctly (first public IP only)
- Skip private IP ranges (10.x, 192.168.x, 172.16-31.x, 127.x)
- Normalize IPv6 formats (::ffff:x.x.x.x → x.x.x.x)
- Fallback chain: X-Forwarded-For → request.ip → socket.remoteAddress → 'unknown'
- Deterministic behavior (same input → same output)
- Minimal change inside RateLimitGuard only

**Non-Goals:**
- ❌ No external IP services
- ❌ No IP reputation checking
- ❌ No blacklist/whitelist
- ❌ No schema changes
- ❌ No refactors outside RateLimitGuard
- ❌ No changes to rate limit logic

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-41C for full details

---

### Phase 42: Hard Quota Enforcement

**Current Stage:** 42A

**Active Task:** TASK-42A-1

#### TASK-42A-1: Hard Quota Enforcement — Max Active Sessions Per User

**Status:** ACTIVE  
**Nature:** IMPLEMENTATION (MINIMAL, ADDITIVE ONLY)  
**Checkpoint:** `docs/PHASE-42A-1-CHECKPOINT.md`

**Objective:**  
Implement deterministic, database-backed hard quota enforcement for maximum concurrent active sessions per user.

**Scope:**
- Enforce ceiling on concurrent active (non-terminated) sessions
- Check before container creation in `POST /api/sessions`
- Query database: `COUNT(*) WHERE user_id = ? AND terminated_at IS NULL`
- Return HTTP 403 Forbidden if limit exceeded (limit: 5)
- Deterministic error response with quota details
- Hard stop behavior (no container started if quota exceeded)

**Non-Goals:**
- ❌ No rolling 24h session limit (TASK-42A-2)
- ❌ No token quota enforcement (TASK-42A-3)
- ❌ No billing system redesign
- ❌ No background workers
- ❌ No schema changes

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-42A-1 for full details

---

#### TASK-42A-2: Hard Quota Enforcement — Max Sessions Per Rolling 24h

**Status:** PLANNED  
**Nature:** IMPLEMENTATION (MINIMAL, ADDITIVE ONLY)  
**Checkpoint:** `docs/PHASE-42A-2-CHECKPOINT.md`

**Objective:**  
Implement deterministic, database-backed hard quota enforcement for maximum total sessions created per rolling 24-hour window.

**Scope:**
- Enforce ceiling on session creation rate (rolling 24h, limit: 20)
- Query database: `COUNT(*) WHERE user_id = ? AND created_at > NOW() - INTERVAL 24 HOUR`
- Return HTTP 403 Forbidden if limit exceeded
- Deterministic error response with reset_at timestamp

**Dependencies:** TASK-42A-1

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-42A-2 for full details

---

#### TASK-42A-3: Hard Quota Enforcement — Max Tokens Per Rolling 24h

**Status:** COMPLETE and LOCKED  
**Nature:** IMPLEMENTATION (MINIMAL, ADDITIVE ONLY)  
**Checkpoint:** `docs/PHASE-42A-3-CHECKPOINT.md`

**Objective:**  
Implement deterministic, database-backed hard quota enforcement for maximum AI tokens consumed per rolling 24-hour window.

**Scope:**
- Enforce ceiling on AI token consumption (rolling 24h, limit: 100000)
- Query database: `SUM(tokens_used) WHERE user_id = ? AND timestamp > NOW() - INTERVAL 24 HOUR`
- Enforce based on current usage (tokens recorded after execution)
- Return HTTP 403 Forbidden if limit exceeded
- Hard stop behavior (no AI provider called if quota exceeded)

**Dependencies:** TASK-42A-2

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-42A-3 for full details

---

#### TASK-42A-4: Hard Quota Enforcement — PS 5.x Verification + PHASE-42A Finalization

**Status:** ACTIVE  
**Nature:** VERIFICATION + DOCUMENTATION  
**Checkpoint:** `docs/PHASE-42A-CHECKPOINT.md`

**Objective:**  
Comprehensive verification of all PHASE-42A quota enforcement mechanisms using PowerShell 5.x scripts. Finalize PHASE-42A checkpoint.

**Scope:**
- PowerShell 5.x verification scripts for all quota types
- Integration verification (all three quota types work together)
- No interference with rate limiting (PHASE-41B) or metrics (PHASE-41A)
- PHASE-42A checkpoint finalization with rollback procedures

**Dependencies:** TASK-42A-1, TASK-42A-2, TASK-42A-3

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-42A-4 for full details

---

### Phase 43C: Execution Reliability — Reconciliation

**Current Stage:** 43C-2

**Active Task:** TASK-43C-2

#### TASK-43C-2: Orphan Cleanup + Reconciliation Worker

**Status:** COMPLETE  
**Nature:** IMPLEMENTATION (MINIMAL, ADDITIVE ONLY)  
**Checkpoint:** `docs/PHASE-43C-2-CHECKPOINT.md`

**Objective:**  
Deterministic background reconciliation of orphaned pending execution records.

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-43C-2

---

### Phase 60: Alerting & Incident Readiness

**Current Stage:** 60A

**Active Task:** TASK-60A

#### TASK-60A: Alerting & Incident Readiness Design

**Status:** ACTIVE  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)  
**Checkpoint:** `docs/PHASE-60A-CHECKPOINT.md`

**Objective:**  
Define production alerting scope, alert thresholds, incident signal definitions, and runbook requirements aligned with current architecture constraints.

**Scope:**
- Production alerting scope
- Alert thresholds
- Incident signal definitions
- Runbook requirements
- Alignment with architecture constraints (no background workers, request-driven)

**Non-Goals:**
- ❌ No code changes in 60A
- ❌ No implementation of alerting systems
- ❌ No schema changes

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-60A for full details

---
