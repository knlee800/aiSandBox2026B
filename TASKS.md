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

**Current Stage:** 60B

**Active Task:** TASK-60B

#### TASK-60A: Alerting & Incident Readiness Design

**Status:** COMPLETE and LOCKED  
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

#### TASK-60B: External Monitoring Contract & Runbook Implementation

**Status:** ACTIVE  
**Nature:** DOCUMENTATION (NO CODE)  
**Checkpoint:** `docs/PHASE-60B-CHECKPOINT.md`

**Objective:**  
Implement external monitoring contract and runbook documents to make Phase 60A design operationally usable.

**Scope:**
- External monitoring contract for existing endpoints
- Polling/evaluation rules based on Phase 60A design
- Runbook implementation documents for the 5 defined incident categories

**Non-Goals:**
- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-60B for full details

---

### Phase 61: Backup & Disaster Recovery

**Current Stage:** 61B

**Active Task:** TASK-61B

#### TASK-61A: Backup & Disaster Recovery Design

**Status:** PLANNED  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)  
**Checkpoint:** `docs/PHASE-61A-CHECKPOINT.md`

**Objective:**  
Define backup scope, restore priorities, disaster recovery scenarios, recovery objectives (RPO/RTO), and operational restore/runbook requirements. Design must align with current architecture constraints.

**Scope:**
- Backup scope and backup targets
- Restore priorities and recovery order
- Disaster recovery scenarios
- Recovery objectives (RPO/RTO) where applicable
- Operational restore/runbook requirements
- Alignment with current architecture constraints

**Non-Goals:**
- ❌ No code changes in 61A
- ❌ No implementation of backup systems
- ❌ No schema changes

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-61A for full details

---

#### TASK-61B: Backup & Restore Runbook Implementation

**Status:** PLANNED  
**Nature:** DOCUMENTATION (NO CODE)  
**Checkpoint:** `docs/PHASE-61B-CHECKPOINT.md`

**Objective:**  
Implement operational backup procedure documents and restore runbooks for the Phase 61A recovery scenarios. Documentation only—no platform code, schema, or endpoint changes.

**Scope:**
- Operational backup procedure documents
- Restore runbooks for Phase 61A recovery scenarios
- Recovery verification steps
- Rollback / retry guidance
- Operator prerequisites, dependencies, and safety checks

**Non-Goals:**
- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-61B for full details

---

### Phase 62: Backup & Restore Validation Drill

**Current Stage:** 62B

**Active Task:** TASK-62B

#### TASK-62A: Backup & Restore Validation Drill Design

**Status:** COMPLETE and LOCKED  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)  
**Checkpoint:** `docs/PHASE-62A-CHECKPOINT.md`

**Objective:**  
Produce the Phase 62A design for backup and restore validation drills so the platform can regularly prove that Phase 61 backup and disaster recovery procedures actually work in practice.

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-62A for full details

---

#### TASK-62B: Backup & Restore Validation Drill Runbook Implementation

**Status:** PLANNED  
**Nature:** DOCUMENTATION (NO CODE)  
**Checkpoint:** `docs/PHASE-62B-CHECKPOINT.md`

**Objective:**  
Implement operator-ready validation drill runbooks for Phase 62A scenarios. Documentation only—no platform code, schema, or endpoint changes.

**Scope:**
- Operator-ready validation drill runbooks
- Drill execution steps for Phase 62A scenarios (database, config, full stack, backup integrity, corrupted deployment)
- Evidence capture requirements
- Pass/fail recording requirements
- Abort / rollback conditions
- Post-drill cleanup and signoff

**Non-Goals:**
- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-62B for full details

---

### Phase 63: Security Operations & Compliance Readiness

**Current Stage:** 63B

**Active Task:** TASK-63B

#### TASK-63A: Security Operations & Compliance Readiness Design

**Status:** PLANNED  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)  
**Checkpoint:** `docs/PHASE-63A-CHECKPOINT.md`

**Objective:**  
Define security operations scope for launch readiness, including audit logging, incident response, access control, backup encryption, privacy/compliance, and security runbook requirements. Design must align with current architecture constraints.

**Scope:**
- Security operations scope for launch readiness
- Audit logging and audit review requirements
- Incident response / security event handling requirements
- Access control / secrets handling operational requirements
- Backup encryption / sensitive data protection requirements
- Privacy / compliance readiness requirements where applicable
- Security runbook / review requirements
- Alignment with current architecture constraints

**Non-Goals:**
- ❌ No code changes in 63A
- ❌ No implementation of security systems
- ❌ No schema changes

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-63A for full details

---

#### TASK-63B: Security Runbooks & Compliance Operational Documentation

**Status:** PLANNED  
**Nature:** DOCUMENTATION (NO CODE)  
**Checkpoint:** `docs/PHASE-63B-CHECKPOINT.md`

**Objective:**  
Implement operator-ready security runbooks and compliance operational documentation per Phase 63A design. Documentation only—no platform code, schema, or endpoint changes.

**Scope:**
- Operator-ready security runbooks
- Audit review procedures
- Security incident handling procedures
- Secrets / credential handling procedures
- Backup protection / restore-time sensitive data handling procedures
- Privacy / compliance operational checklists
- Evidence / signoff requirements

**Non-Goals:**
- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-63B for full details

---

### Phase 64: Legal, Privacy & User Data Rights Readiness

**Current Stage:** 64B

**Active Task:** TASK-64B

#### TASK-64A: Legal, Privacy & User Data Rights Readiness Design

**Status:** PLANNED  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)  
**Checkpoint:** `docs/PHASE-64A-CHECKPOINT.md`

**Objective:**  
Define launch-ready legal/privacy document scope, privacy policy/terms/cookie notice requirements, user data rights handling, export/deletion request operational requirements, consent/disclosure requirements, evidence/signoff requirements, aligned with current architecture constraints.

**Scope:**
- Launch-ready legal/privacy document scope
- Privacy policy / terms / cookie notice requirements at platform level
- User data rights handling requirements
- Export / deletion request operational requirements
- Consent / disclosure requirements where applicable
- Evidence / signoff requirements
- Alignment with current architecture constraints

**Non-Goals:**
- ❌ No code changes in 64A

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-64A for full details

---

#### TASK-64B: Legal, Privacy & User Data Rights Operational Documentation

**Status:** PLANNED  
**Nature:** DOCUMENTATION (NO CODE)
**Checkpoint:** `docs/PHASE-64B-CHECKPOINT.md`

**Objective:**  
Implement operator-ready legal/privacy operational documentation per Phase 64A design. Documentation only—no platform code, schema, or endpoint changes.

**Scope:**
- Operator-ready legal/privacy operational docs
- User data access/export request procedure
- User data deletion request procedure
- Identity verification and request intake handling
- Evidence / tracking / signoff requirements
- Cookie / consent / disclosure operational checklist where applicable

**Non-Goals:**
- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-64B for full details

---

### Phase 65: Admin Tools & Launch Operations

**Current Stage:** 65C

**Active Task:** TASK-65C

#### TASK-65A: Admin Tools & Launch Operations Design

**Status:** PLANNED  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)  
**Checkpoint:** `docs/PHASE-65A-CHECKPOINT.md`

**Objective:**  
Define launch-ready admin tool scope, admin actions and operator permissions, abuse/ban/suspension operational requirements, refund/credit/manual quota adjustment operational requirements, admin health/visibility requirements, audit/evidence/signoff requirements for admin actions, aligned with current architecture constraints.

**Scope:**
- Launch-ready admin tool scope
- Admin actions and operator permissions
- Abuse / ban / suspension operational requirements
- Refund / credit / manual quota adjustment operational requirements
- Admin health / visibility requirements
- Audit / evidence / signoff requirements for admin actions
- Alignment with current architecture constraints

**Non-Goals:**
- ❌ No code changes in 65A

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-65A for full details

---

#### TASK-65B: Admin Operations & Operator Procedure Documentation

**Status:** PLANNED  
**Nature:** DOCUMENTATION (NO CODE)  
**Checkpoint:** `docs/PHASE-65B-CHECKPOINT.md`

**Objective:**  
Implement operator-ready admin procedures per Phase 65A design. Documentation only—no platform code, schema, or endpoint changes.

**Scope:**
- Operator-ready admin procedures
- Abuse / suspension / ban handling procedures
- Refund / credit / manual quota adjustment procedures
- Launch-day admin health / visibility checklist
- Audit / evidence / signoff requirements for admin actions
- Operator permissions / approval workflow guidance

**Non-Goals:**
- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-65B for full details

---

#### TASK-65C: Admin Tools & Launch Operations Final Validation + Checkpoint

**Status:** ACTIVE  
**Nature:** VALIDATION / DOCUMENTATION (NO CODE)  
**Checkpoint:** `docs/PHASE-65C-CHECKPOINT.md`

**Objective:**  
Final validation of Phase 65A design and Phase 65B operator documentation, with checkpoint creation.

**Scope:**
- Validation of Phase 65A design and Phase 65B operator docs
- Verification that required admin procedure docs exist
- Verification of admin action coverage, evidence/signoff, and approval workflow guidance
- Verification that architecture constraints remain preserved
- Final checkpoint creation

**Non-Goals:**
- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-65C for full details

---

### Phase 66: Analytics & Growth Visibility

**Current Stage:** 66B

**Active Task:** TASK-66B

#### TASK-66A: Analytics & Growth Visibility Design

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / DESIGN (NO CODE)
**Checkpoint:** `docs/PHASE-66A-CHECKPOINT.md`

**Objective:**
Define launch-ready analytics and growth visibility scope, product usage/retention/feature adoption visibility requirements, error/reliability/cost-per-user visibility requirements, operator/stakeholder dashboard requirements, evidence/review/signoff expectations, aligned with current architecture constraints.

**Scope:**
- Launch-ready analytics and growth visibility scope
- Product usage / retention / feature adoption visibility requirements
- Error / reliability / cost-per-user visibility requirements
- Operator / stakeholder dashboard requirements
- Evidence / review / signoff expectations
- Alignment with current architecture constraints

**Non-Goals:**
- ❌ No code changes in 66A

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-66A for full details

---

#### TASK-66B: Analytics & Growth Visibility Operational Documentation

**Status:** PLANNED
**Nature:** DOCUMENTATION (NO CODE)
**Checkpoint:** `docs/PHASE-66B-CHECKPOINT.md`

**Objective:**
Implement operator-ready analytics review procedures and stakeholder/founder reporting procedures per Phase 66A design. Documentation only—no platform code, schema, or endpoint changes.

**Scope:**
- Operator-ready analytics review procedures
- Stakeholder / founder reporting procedures
- Metric review cadence and ownership
- Evidence / signoff / interpretation guidance
- Dashboard usage guidance for product, cost, reliability, and growth visibility

**Non-Goals:**
- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-66B for full details

---

### Phase 67: Core Product UX/UI Design

**Current Stage:** 67C

**Active Task:** TASK-67C

#### TASK-67A: Core Product UX/UI Design

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / DESIGN (NO CODE)
**Checkpoint:** `docs/PHASE-67A-CHECKPOINT.md`

**Objective:**
Define launch-ready core product UX/UI requirements for the AI Sandbox Platform, focused on the main authenticated product experience and highest-priority user-facing surfaces still blocking launch readiness.

**Scope:**
- Main app UX/UI scope
- Chat / editor / preview workspace UX
- Session layout and navigation UX
- History / timeline UX
- Checkpoint / revert / diff / git-log UX expectations
- User dashboard UX requirements
- Admin dashboard UX requirements at high level only
- Public-facing product surface requirements at high level only where needed for launch coherence
- Responsive / launch-polish requirements
- Alignment with current architecture and existing backend constraints

**Non-Goals:**
- ❌ No implementation
- ❌ No frontend code changes
- ❌ No backend code changes
- ❌ No schema changes
- ❌ No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-67A for full details

---

#### TASK-67B: UX/UI Final Consolidation + Validation

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / VALIDATION (NO CODE)
**Checkpoint:** `docs/PHASE-67B-CHECKPOINT.md`

**Objective:**
Final consolidation and validation of all Phase 67A UX/UI design documentation to ensure consistency, completeness, and launch readiness.

**Scope:**
- Validation of PHASE-67A-1, PHASE-67A-2, and PHASE-67A-3 checkpoint consistency
- Consolidation of core product UX/UI design coverage across all Phase 67A slices
- Conflict/gap review across workspace UX, history/control UX, dashboards, and public-facing surfaces
- PRD / ARCHITECTURE alignment review
- Launch-readiness validation for UX/UI documentation scope
- Final Phase 67 checkpoint creation readiness

**Non-Goals:**
- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-67B for full details

**Validation Result:** ✅ PASS — All Phase 67A checkpoints consistent, aligned, and launch-ready. No fixes required.

---

#### TASK-67C: Phase 67 Final Checkpoint

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION (NO CODE)
**Checkpoint:** `docs/PHASE-67-FINAL-CHECKPOINT.md`

**Objective:**
Create final Phase 67 checkpoint summarizing all UX/UI design work and confirming documentation-only scope compliance.

**Scope:**
- Final validation summary of Phase 67A-1, 67A-2, 67A-3, and 67B
- Confirmation that Phase 67 UX/UI design scope is complete
- Confirmation that scope remained documentation-only
- Confirmation that no code/schema/endpoint changes occurred
- Creation of the final Phase 67 checkpoint

**Non-Goals:**
- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-67C for full details

**Completion Summary:**
- ✅ All Phase 67A checkpoints reviewed (67A-1, 67A-2, 67A-3)
- ✅ Phase 67B validation reviewed
- ✅ Cross-slice coherence confirmed
- ✅ PRD alignment confirmed
- ✅ ARCHITECTURE alignment confirmed
- ✅ Documentation-only scope preserved
- ✅ No code/schema/endpoint changes occurred
- ✅ Final checkpoint created: `docs/PHASE-67-FINAL-CHECKPOINT.md`

---

### Phase 68: UX/UI Implementation Planning

**Current Stage:** 68A

**Active Task:** TASK-68A

#### TASK-68A: UX/UI Implementation Planning

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / PLANNING (NO CODE)
**Checkpoint:** `docs/PHASE-68A-CHECKPOINT.md`

**Objective:**
Convert completed Phase 67 UX/UI design outputs into an implementation-ready execution plan for launch-priority UX/UI work.

**Scope:**
- Recommended implementation sequence for launch-priority UX/UI work
- Backend dependency mapping for UX/UI implementation
- Frontend dependency mapping for UX/UI implementation
- Slicing of implementation into controlled stages
- Validation of what can be implemented immediately versus what depends on missing backend/product surfaces
- Implementation task breakdown and sequencing

**Non-Goals:**
- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes
- ❌ No implementation
- ❌ No frontend code changes
- ❌ No backend code changes

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-68A for full details

**Completion Summary:**
- ✅ Implementation sequence defined (6 stages: 68B → 68C → 68D → 68E → 68F → 68G)
- ✅ Backend dependencies mapped (9 endpoints identified, prioritized)
- ✅ Frontend dependencies mapped (22 frontend tasks identified, sequenced)
- ✅ Implementation sliced into controlled stages (6 stages, clear boundaries)
- ✅ Blockers identified (backend endpoints block frontend history/dashboard)
- ✅ Ready-to-implement work identified (7 tasks can start immediately)
- ✅ Implementation tasks defined (25 tasks total: 3 backend, 22 frontend)
- ✅ Validation expectations defined (tests, acceptance criteria, launch checklist)
- ✅ Risks identified (5 risks, mitigations provided)
- ✅ Checkpoint created: `docs/PHASE-68A-CHECKPOINT.md`

---

**Current Stage:** 68F-0

**Active Task:** TASK-68F

#### TASK-68B: Backend UX/UI Support Endpoints — History/Control Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (BACKEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-68B-CHECKPOINT.md`

**Objective:**
Implement the first minimal backend endpoint slice to unblock frontend history/control UX implementation. This task implements only the three history/control endpoints identified as highest priority in Phase 68A.

**Scope:**
- Implement GET /api/sessions/:id/checkpoints (list checkpoints)
- Implement GET /api/sessions/:id/checkpoints/:hash/diff (get diff)
- Implement POST /api/sessions/:id/revert (revert to checkpoint)
- Endpoint tests (unit, integration, E2E)
- API documentation (OpenAPI/Swagger)

**Non-Goals:**
- ❌ No user dashboard endpoints (deferred to TASK-68B-2)
- ❌ No admin dashboard endpoints (deferred to TASK-68B-3)
- ❌ No schema changes (use existing git_checkpoints table)
- ❌ No frontend work
- ❌ No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-68B for full details

**Completion Summary:**
- ✅ All 3 endpoints implemented (checkpoints list, diff, revert)
- ✅ All tests passing (37 tests: 10 controller, 9 service, 18 integration)
- ✅ No schema changes
- ✅ No frontend changes
- ✅ Scope remained narrow
- ✅ Checkpoint created: `docs/PHASE-68B-CHECKPOINT.md`

---

#### TASK-68B-2: Backend UX/UI Support Endpoints — User Dashboard Slice

**Status:** PLANNED
**Nature:** IMPLEMENTATION (BACKEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-68B-2-CHECKPOINT.md`

**Objective:**
Implement the second minimal backend endpoint slice to unblock frontend user dashboard UX implementation. This task implements only the four user dashboard endpoints identified as high priority in Phase 68A.

**Scope:**
- Implement GET /api/users/me (current user info)
- Implement GET /api/users/me/usage (usage statistics)
- Implement GET /api/users/me/quotas (quota limits + usage)
- Extend GET /api/sessions?includeTerminated=true (session list with terminated)
- Endpoint tests (unit, integration)
- API documentation

**Non-Goals:**
- ❌ No admin dashboard endpoints (deferred to TASK-68B-3)
- ❌ No history/control endpoints (already complete in TASK-68B)
- ❌ No schema changes (use existing tables)
- ❌ No frontend work
- ❌ No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-68B-2 for full details

**Completion Summary:**
- ✅ Implemented `GET /api/users/me`
- ✅ Implemented `GET /api/users/me/usage`
- ✅ Implemented `GET /api/users/me/quotas`
- ✅ Extended `GET /api/sessions` with `includeTerminated=true`
- ✅ Added focused tests (17 passing across user/session slice specs)
- ✅ No schema changes
- ✅ No frontend changes
- ✅ Scope remained narrow
- ✅ Checkpoint created: `docs/PHASE-68B-2-CHECKPOINT.md`

---

#### TASK-68B-3: Backend UX/UI Support Endpoints — Admin Dashboard Slice

**Status:** PLANNED  
**Nature:** IMPLEMENTATION (BACKEND ONLY, ADDITIVE)  
**Checkpoint:** `docs/PHASE-68B-3-CHECKPOINT.md`

**Objective:**  
Implement the third minimal backend endpoint slice to unblock frontend admin dashboard UX implementation. This task implements only the admin dashboard endpoints identified in Phase 68A and keeps scope limited to launch-priority admin visibility.

**Scope:**
- Implement `GET /api/internal/admin/users` (admin user visibility summary)
- Implement `GET /api/internal/admin/sessions` (admin session visibility across users)
- Support admin visibility for users, sessions, usage/cost summary signals, and operational/session status using existing architecture-approved data sources
- Endpoint tests (unit, integration)
- API documentation (internal endpoint contracts only)

**Non-Goals:**
- ❌ No user dashboard endpoints (already complete in TASK-68B-2)
- ❌ No history/control endpoints (already complete in TASK-68B)
- ❌ No public-facing endpoints
- ❌ No frontend work
- ❌ No schema changes unless explicitly approved by existing design authority
- ❌ No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-68B-3 for full details

---

#### TASK-68B-FINAL: Backend UX/UI Support Endpoints Final Consolidation

**Status:** PLANNED  
**Nature:** DOCUMENTATION / VALIDATION (NO NEW IMPLEMENTATION)  
**Checkpoint:** `docs/PHASE-68B-FINAL-CHECKPOINT.md`

**Objective:**  
Validate and consolidate completed backend endpoint slices (`TASK-68B`, `TASK-68B-2`, `TASK-68B-3`) to confirm coherent backend UX/UI support coverage and implementation readiness for frontend phases.

**Scope:**
- Consolidate and validate endpoint coverage across history/control, user dashboard, and admin dashboard backend slices
- Confirm scope remained backend-only and additive
- Confirm no schema changes occurred across all 68B slices
- Confirm PRD and ARCHITECTURE alignment across all completed 68B slice outputs
- Create final consolidation checkpoint: `docs/PHASE-68B-FINAL-CHECKPOINT.md`

**Non-Goals:**
- ❌ No new endpoint implementation
- ❌ No frontend work
- ❌ No refactors
- ❌ No architecture redesign

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-68B-FINAL for full details

---

#### TASK-68C: Frontend Core Workspace Slice 1

**Status:** ACTIVE
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-68C-CHECKPOINT.md`

**Objective:**
Implement only the first minimal, unblocked frontend core workspace slice from Phase 68A to establish the authenticated workspace shell foundation for later frontend slices.

**Scope:**
- Authenticated workspace shell layout only (base panel structure and shell states)
- Initial workspace chrome required for shell usability (header/footer frame and container states)
- Minimal session sidebar shell wiring using already available session capabilities only
- Focused frontend tests for this slice
- Slice-specific documentation/checkpoint output

**Non-Goals:**
- ❌ No backend changes
- ❌ No schema changes
- ❌ No refactors
- ❌ No history/control UI
- ❌ No dashboard UI
- ❌ No public-facing UI

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-68C for full details

---

#### TASK-68D: Frontend History/Control Slice 1

**Status:** PLANNED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-68D-CHECKPOINT.md`

**Objective:**
Implement only the first minimal, unblocked frontend history/control slice from Phase 68A, building on the existing workspace shell from TASK-68C.

**Scope:**
- First smallest history/control UI slice only (launch-priority, narrow scope)
- Use only already available backend history/control capabilities completed in Phase 68B
- Integrate only at the workspace shell boundary established by TASK-68C
- Focused frontend tests for this slice
- Slice-specific documentation/checkpoint output

**Non-Goals:**
- ❌ No backend changes
- ❌ No schema changes
- ❌ No refactors
- ❌ No dashboard UI
- ❌ No public-facing UI
- ❌ No broader workspace redesign outside this history/control slice

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-68D for full details

---

#### TASK-68E: Frontend Dashboard Slice 1

**Status:** PLANNED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-68E-CHECKPOINT.md`

**Objective:**
Implement only the first minimal, unblocked frontend dashboard slice from Phase 68A, building on the existing authenticated frontend baseline.

**Scope:**
- First smallest dashboard UI slice only (launch-priority, narrow scope)
- Use only already available backend dashboard capabilities completed in Phase 68B slices
- Authenticated dashboard UX only for this slice
- Focused frontend tests for this slice
- Slice-specific documentation/checkpoint output

**Non-Goals:**
- ❌ No backend changes
- ❌ No schema changes
- ❌ No refactors
- ❌ No public-facing UI
- ❌ No broader workspace redesign outside this dashboard slice

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-68E for full details

---

#### TASK-68F: Frontend Public-Facing Slice 1

**Status:** PLANNED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-68F-CHECKPOINT.md`

**Objective:**
Implement only the first minimal, unblocked frontend public-facing slice from Phase 68A, with narrow launch-priority scope.

**Scope:**
- First smallest public-facing UI slice only (launch-priority, narrow scope)
- Focus on the core public product surface for this first slice
- Keep backend dependency to none unless already available and clearly required
- Focused frontend tests for this slice
- Slice-specific documentation/checkpoint output

**Non-Goals:**
- ❌ No backend changes
- ❌ No schema changes
- ❌ No refactors
- ❌ No authenticated workspace/dashboard/history-control scope
- ❌ No broader marketing/docs-site expansion outside this first slice

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-68F for full details

---

**Current Stage:** 68-FINAL-0

**Active Task:** TASK-68-FINAL

#### TASK-68G: Launch Polish Slice 1

**Status:** PLANNED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-68G-CHECKPOINT.md`

**Objective:**
Implement only the first minimal, unblocked frontend launch-polish slice from Phase 68A, with narrow launch-priority scope.

**Scope:**
- First smallest launch-polish slice only (launch-priority, narrow scope)
- Responsive polish, state polish, and clarity/trust polish for already-implemented frontend surfaces only
- Focused frontend tests for this slice
- Slice-specific documentation/checkpoint output

**Non-Goals:**
- ❌ No backend changes
- ❌ No schema changes
- ❌ No refactors
- ❌ No new product feature scope
- ❌ No major redesign of completed surfaces

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-68G for full details

---

#### TASK-68-FINAL: Phase 68 Final Consolidation

**Status:** PLANNED
**Nature:** DOCUMENTATION / VALIDATION (NO NEW IMPLEMENTATION)
**Checkpoint:** `docs/PHASE-68-FINAL-CHECKPOINT.md`

**Objective:**
Validate and consolidate completed Phase 68 planning and implementation slices into a final phase-level readiness checkpoint.

**Scope:**
- Validate and consolidate TASK-68A, TASK-68B, TASK-68B-2, TASK-68B-3, TASK-68B-FINAL, TASK-68C, TASK-68D, TASK-68E, TASK-68F, and TASK-68G
- Confirm Phase 68 outputs are coherent and aligned with PRD and ARCHITECTURE
- Confirm approved planning/implementation boundaries were preserved
- Confirm backend/frontend sequencing consistency across completed slices
- Confirm no schema changes occurred across Phase 68 work
- Create final checkpoint: `docs/PHASE-68-FINAL-CHECKPOINT.md`

**Non-Goals:**
- ❌ No new implementation
- ❌ No backend changes
- ❌ No frontend feature expansion
- ❌ No schema changes
- ❌ No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-68-FINAL for full details

---

### Phase 69: UX/UI Validation and End-to-End Readiness Planning

**Current Stage:** 69-FINAL-0

**Active Task:** TASK-69-FINAL

#### TASK-69A: UX/UI Validation and End-to-End Readiness Planning

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / PLANNING (NO CODE)
**Checkpoint:** `docs/PHASE-69A-CHECKPOINT.md`

**Objective:**
Plan validation for completed Phase 67 and Phase 68 UX/UI outputs and define end-to-end readiness review sequencing before wider release-readiness work.

**Scope:**
- Validation planning for completed Phase 67 and Phase 68 UX/UI outputs
- End-to-end readiness review planning across workspace, history/control, dashboard, public-facing slice, and launch-polish outputs
- Identification of remaining UX/UI validation gaps before broader release-readiness work
- Planning for targeted regression validation of newly implemented frontend/backend UX-support slices
- Sequencing for any remaining UX/UI validation/fix slices if needed

**Non-Goals:**
- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes
- ❌ No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-69A for full details

---

#### TASK-69B: UX/UI Validation Execution

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION / DOCUMENTATION (NO CODE)
**Checkpoint:** `docs/PHASE-69B-CHECKPOINT.md`

**Objective:**
Execute the Phase 69A UX/UI validation plan and document end-to-end readiness findings across completed Phase 67/68 outputs.

**Scope:**
- Execute validation coverage for workspace, history/control, dashboard, public-facing, and launch-polish slices
- Execute targeted regression validation for completed frontend/backend UX-support slices
- Document validation findings, gaps, conflicts, and pass/fail outcomes
- Confirm whether follow-up UX/UI validation/fix slices are required

**Non-Goals:**
- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes
- ❌ No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-69B for full details

---

#### TASK-69-FINAL: Phase 69 Final Consolidation

**Status:** PLANNED
**Nature:** DOCUMENTATION / VALIDATION (NO NEW IMPLEMENTATION)
**Checkpoint:** `docs/PHASE-69-FINAL-CHECKPOINT.md`

**Objective:**
Validate and consolidate completed Phase 69 planning/validation outputs and close Phase 69 with a final checkpoint.

**Scope:**
- Validate and consolidate `TASK-69A` and `TASK-69B`
- Confirm Phase 69 outputs are coherent and no follow-up UX/UI fix slices are required
- Confirm Phase 69 remained documentation/validation-only
- Confirm no code/schema/endpoint changes occurred
- Create final Phase 69 checkpoint

**Non-Goals:**
- ❌ No new implementation
- ❌ No platform code changes
- ❌ No schema changes
- ❌ No endpoint changes
- ❌ No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-69-FINAL for full details

---
