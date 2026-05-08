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

**Program status:** REL-01-01 (PLANNED) ??release readiness phase active


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

**Status:** COMPLETE and LOCKED  
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


#### TASK-41B: Security Hardening 嚙碼 Rate Limits + Internal Endpoint Protection

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


#### TASK-41C: Abuse Hardening ??Proxy-Aware IP Normalization

**Status:** COMPLETE and LOCKED  
**Nature:** IMPLEMENTATION (MINIMAL, ADDITIVE ONLY)  
**Checkpoint:** `docs/PHASE-41C-CHECKPOINT.md`

**Objective:**  
Improve rate limiting accuracy by correctly parsing client IP addresses from proxy headers.

**Scope:**
- Parse X-Forwarded-For header correctly (first public IP only)
- Skip private IP ranges (10.x, 192.168.x, 172.16-31.x, 127.x)
- Normalize IPv6 formats (::ffff:x.x.x.x ??x.x.x.x)
- Fallback chain: X-Forwarded-For ??request.ip ??socket.remoteAddress ??'unknown'
- Deterministic behavior (same input ??same output)
- Minimal change inside RateLimitGuard only

**Non-Goals:**
- ??No external IP services
- ??No IP reputation checking
- ??No blacklist/whitelist
- ??No schema changes
- ??No refactors outside RateLimitGuard
- ??No changes to rate limit logic

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-41C for full details

---

### Phase 42: Hard Quota Enforcement

**Current Stage:** 42A

**Active Task:** TASK-42A-1

#### TASK-42A-1: Hard Quota Enforcement ??Max Active Sessions Per User

**Status:** COMPLETE and LOCKED  
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
- ??No rolling 24h session limit (TASK-42A-2)
- ??No token quota enforcement (TASK-42A-3)
- ??No billing system redesign
- ??No background workers
- ??No schema changes

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-42A-1 for full details

---

#### TASK-42A-2: Hard Quota Enforcement ??Max Sessions Per Rolling 24h

**Status:** COMPLETE and LOCKED  
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

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-42A-2 for full details

---

#### TASK-42A-3: Hard Quota Enforcement ??Max Tokens Per Rolling 24h

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

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-42A-3 for full details

---

#### TASK-42A-4: Hard Quota Enforcement ??PS 5.x Verification + PHASE-42A Finalization

**Status:** COMPLETE and LOCKED  
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

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-42A-4 for full details

---

### Phase 43C: Execution Reliability ??Reconciliation

**Current Stage:** 43C-2

**Active Task:** TASK-43C-2

#### TASK-43C-2: Orphan Cleanup + Reconciliation Worker

**Status:** COMPLETE and LOCKED  
**Nature:** IMPLEMENTATION (MINIMAL, ADDITIVE ONLY)  
**Checkpoint:** `docs/PHASE-43C-2-CHECKPOINT.md`

**Objective:**  
Deterministic background reconciliation of orphaned pending execution records.

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-43C-2

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
- ??No code changes in 60A
- ??No implementation of alerting systems
- ??No schema changes

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-60A for full details

---

#### TASK-60B: External Monitoring Contract & Runbook Implementation

**Status:** COMPLETE and LOCKED  
**Nature:** DOCUMENTATION (NO CODE)  
**Checkpoint:** `docs/PHASE-60B-CHECKPOINT.md`

**Objective:**  
Implement external monitoring contract and runbook documents to make Phase 60A design operationally usable.

**Scope:**
- External monitoring contract for existing endpoints
- Polling/evaluation rules based on Phase 60A design
- Runbook implementation documents for the 5 defined incident categories

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-60B for full details

---

### Phase 61: Backup & Disaster Recovery

**Current Stage:** 61B

**Active Task:** TASK-61B

#### TASK-61A: Backup & Disaster Recovery Design

**Status:** COMPLETE and LOCKED  
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
- ??No code changes in 61A
- ??No implementation of backup systems
- ??No schema changes

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-61A for full details

---

#### TASK-61B: Backup & Restore Runbook Implementation

**Status:** COMPLETE and LOCKED  
**Nature:** DOCUMENTATION (NO CODE)  
**Checkpoint:** `docs/PHASE-61B-CHECKPOINT.md`

**Objective:**  
Implement operational backup procedure documents and restore runbooks for the Phase 61A recovery scenarios. Documentation only?o platform code, schema, or endpoint changes.

**Scope:**
- Operational backup procedure documents
- Restore runbooks for Phase 61A recovery scenarios
- Recovery verification steps
- Rollback / retry guidance
- Operator prerequisites, dependencies, and safety checks

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-61B for full details

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

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-62A for full details

---

#### TASK-62B: Backup & Restore Validation Drill Runbook Implementation

**Status:** COMPLETE and LOCKED  
**Nature:** DOCUMENTATION (NO CODE)  
**Checkpoint:** `docs/PHASE-62B-CHECKPOINT.md`

**Objective:**  
Implement operator-ready validation drill runbooks for Phase 62A scenarios. Documentation only?o platform code, schema, or endpoint changes.

**Scope:**
- Operator-ready validation drill runbooks
- Drill execution steps for Phase 62A scenarios (database, config, full stack, backup integrity, corrupted deployment)
- Evidence capture requirements
- Pass/fail recording requirements
- Abort / rollback conditions
- Post-drill cleanup and signoff

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-62B for full details

---

### Phase 63: Security Operations & Compliance Readiness

**Current Stage:** 63B

**Active Task:** TASK-63B

#### TASK-63A: Security Operations & Compliance Readiness Design

**Status:** COMPLETE and LOCKED  
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
- ??No code changes in 63A
- ??No implementation of security systems
- ??No schema changes

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-63A for full details

---

#### TASK-63B: Security Runbooks & Compliance Operational Documentation

**Status:** COMPLETE and LOCKED  
**Nature:** DOCUMENTATION (NO CODE)  
**Checkpoint:** `docs/PHASE-63B-CHECKPOINT.md`

**Objective:**  
Implement operator-ready security runbooks and compliance operational documentation per Phase 63A design. Documentation only?o platform code, schema, or endpoint changes.

**Scope:**
- Operator-ready security runbooks
- Audit review procedures
- Security incident handling procedures
- Secrets / credential handling procedures
- Backup protection / restore-time sensitive data handling procedures
- Privacy / compliance operational checklists
- Evidence / signoff requirements

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-63B for full details

---

### Phase 64: Legal, Privacy & User Data Rights Readiness

**Current Stage:** 64B

**Active Task:** TASK-64B

#### TASK-64A: Legal, Privacy & User Data Rights Readiness Design

**Status:** COMPLETE and LOCKED  
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
- ??No code changes in 64A

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-64A for full details

---

#### TASK-64B: Legal, Privacy & User Data Rights Operational Documentation

**Status:** COMPLETE and LOCKED  
**Nature:** DOCUMENTATION (NO CODE)
**Checkpoint:** `docs/PHASE-64B-CHECKPOINT.md`

**Objective:**  
Implement operator-ready legal/privacy operational documentation per Phase 64A design. Documentation only?o platform code, schema, or endpoint changes.

**Scope:**
- Operator-ready legal/privacy operational docs
- User data access/export request procedure
- User data deletion request procedure
- Identity verification and request intake handling
- Evidence / tracking / signoff requirements
- Cookie / consent / disclosure operational checklist where applicable

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-64B for full details

---

### Phase 65: Admin Tools & Launch Operations

**Current Stage:** 65C

**Active Task:** TASK-65C

#### TASK-65A: Admin Tools & Launch Operations Design

**Status:** COMPLETE and LOCKED  
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
- ??No code changes in 65A

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-65A for full details

---

#### TASK-65B: Admin Operations & Operator Procedure Documentation

**Status:** COMPLETE and LOCKED  
**Nature:** DOCUMENTATION (NO CODE)  
**Checkpoint:** `docs/PHASE-65B-CHECKPOINT.md`

**Objective:**  
Implement operator-ready admin procedures per Phase 65A design. Documentation only?o platform code, schema, or endpoint changes.

**Scope:**
- Operator-ready admin procedures
- Abuse / suspension / ban handling procedures
- Refund / credit / manual quota adjustment procedures
- Launch-day admin health / visibility checklist
- Audit / evidence / signoff requirements for admin actions
- Operator permissions / approval workflow guidance

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-65B for full details

---

#### TASK-65C: Admin Tools & Launch Operations Final Validation + Checkpoint

**Status:** COMPLETE and LOCKED  
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
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-65C for full details

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
- ??No code changes in 66A

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-66A for full details

---

#### TASK-66B: Analytics & Growth Visibility Operational Documentation

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION (NO CODE)
**Checkpoint:** `docs/PHASE-66B-CHECKPOINT.md`

**Objective:**
Implement operator-ready analytics review procedures and stakeholder/founder reporting procedures per Phase 66A design. Documentation only?o platform code, schema, or endpoint changes.

**Scope:**
- Operator-ready analytics review procedures
- Stakeholder / founder reporting procedures
- Metric review cadence and ownership
- Evidence / signoff / interpretation guidance
- Dashboard usage guidance for product, cost, reliability, and growth visibility

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-66B for full details

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
- ??No implementation
- ??No frontend code changes
- ??No backend code changes
- ??No schema changes
- ??No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-67A for full details

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
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-67B for full details

**Validation Result:** ??PASS ??All Phase 67A checkpoints consistent, aligned, and launch-ready. No fixes required.

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
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-67C for full details

**Completion Summary:**
- ??All Phase 67A checkpoints reviewed (67A-1, 67A-2, 67A-3)
- ??Phase 67B validation reviewed
- ??Cross-slice coherence confirmed
- ??PRD alignment confirmed
- ??ARCHITECTURE alignment confirmed
- ??Documentation-only scope preserved
- ??No code/schema/endpoint changes occurred
- ??Final checkpoint created: `docs/PHASE-67-FINAL-CHECKPOINT.md`

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
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No implementation
- ??No frontend code changes
- ??No backend code changes

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-68A for full details

**Completion Summary:**
- ??Implementation sequence defined (6 stages: 68B ??68C ??68D ??68E ??68F ??68G)
- ??Backend dependencies mapped (9 endpoints identified, prioritized)
- ??Frontend dependencies mapped (22 frontend tasks identified, sequenced)
- ??Implementation sliced into controlled stages (6 stages, clear boundaries)
- ??Blockers identified (backend endpoints block frontend history/dashboard)
- ??Ready-to-implement work identified (7 tasks can start immediately)
- ??Implementation tasks defined (25 tasks total: 3 backend, 22 frontend)
- ??Validation expectations defined (tests, acceptance criteria, launch checklist)
- ??Risks identified (5 risks, mitigations provided)
- ??Checkpoint created: `docs/PHASE-68A-CHECKPOINT.md`

---

**Current Stage:** 68F-0

**Active Task:** TASK-68F

#### TASK-68B: Backend UX/UI Support Endpoints ??History/Control Slice

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
- ??No user dashboard endpoints (deferred to TASK-68B-2)
- ??No admin dashboard endpoints (deferred to TASK-68B-3)
- ??No schema changes (use existing git_checkpoints table)
- ??No frontend work
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-68B for full details

**Completion Summary:**
- ??All 3 endpoints implemented (checkpoints list, diff, revert)
- ??All tests passing (37 tests: 10 controller, 9 service, 18 integration)
- ??No schema changes
- ??No frontend changes
- ??Scope remained narrow
- ??Checkpoint created: `docs/PHASE-68B-CHECKPOINT.md`

---

#### TASK-68B-2: Backend UX/UI Support Endpoints ??User Dashboard Slice

**Status:** COMPLETE and LOCKED
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
- ??No admin dashboard endpoints (deferred to TASK-68B-3)
- ??No history/control endpoints (already complete in TASK-68B)
- ??No schema changes (use existing tables)
- ??No frontend work
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-68B-2 for full details

**Completion Summary:**
- ??Implemented `GET /api/users/me`
- ??Implemented `GET /api/users/me/usage`
- ??Implemented `GET /api/users/me/quotas`
- ??Extended `GET /api/sessions` with `includeTerminated=true`
- ??Added focused tests (17 passing across user/session slice specs)
- ??No schema changes
- ??No frontend changes
- ??Scope remained narrow
- ??Checkpoint created: `docs/PHASE-68B-2-CHECKPOINT.md`

---

#### TASK-68B-3: Backend UX/UI Support Endpoints ??Admin Dashboard Slice

**Status:** COMPLETE and LOCKED  
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
- ??No user dashboard endpoints (already complete in TASK-68B-2)
- ??No history/control endpoints (already complete in TASK-68B)
- ??No public-facing endpoints
- ??No frontend work
- ??No schema changes unless explicitly approved by existing design authority
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-68B-3 for full details

---

#### TASK-68B-FINAL: Backend UX/UI Support Endpoints Final Consolidation

**Status:** COMPLETE and LOCKED  
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
- ??No new endpoint implementation
- ??No frontend work
- ??No refactors
- ??No architecture redesign

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-68B-FINAL for full details

---

#### TASK-68C: Frontend Core Workspace Slice 1

**Status:** COMPLETE and LOCKED
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
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No history/control UI
- ??No dashboard UI
- ??No public-facing UI

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-68C for full details

---

#### TASK-68D: Frontend History/Control Slice 1

**Status:** COMPLETE and LOCKED
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
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No dashboard UI
- ??No public-facing UI
- ??No broader workspace redesign outside this history/control slice

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-68D for full details

---

#### TASK-68E: Frontend Dashboard Slice 1

**Status:** COMPLETE and LOCKED
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
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No public-facing UI
- ??No broader workspace redesign outside this dashboard slice

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-68E for full details

---

#### TASK-68F: Frontend Public-Facing Slice 1

**Status:** COMPLETE and LOCKED
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
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No authenticated workspace/dashboard/history-control scope
- ??No broader marketing/docs-site expansion outside this first slice

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-68F for full details

---

**Current Stage:** 68-FINAL-0

**Active Task:** TASK-68-FINAL

#### TASK-68G: Launch Polish Slice 1

**Status:** COMPLETE and LOCKED
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
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new product feature scope
- ??No major redesign of completed surfaces

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-68G for full details

---

#### TASK-68-FINAL: Phase 68 Final Consolidation

**Status:** COMPLETE and LOCKED
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
- ??No new implementation
- ??No backend changes
- ??No frontend feature expansion
- ??No schema changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-68-FINAL for full details

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
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-69A for full details

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
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-69B for full details

---

#### TASK-69-FINAL: Phase 69 Final Consolidation

**Status:** COMPLETE and LOCKED
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
- ??No new implementation
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-69-FINAL for full details

---

### Phase 70: Launch Readiness Validation

**Current Stage:** 70B-0

**Active Task:** TASK-70-FINAL

#### TASK-70A: Launch Readiness Validation Planning

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / PLANNING (NO CODE)
**Checkpoint:** `docs/PHASE-70A-CHECKPOINT.md`

**Objective:**
Plan launch-readiness validation coverage and sequencing after completed UX/UI design, implementation, and validation phases.

**Scope:**
- Plan validation coverage across product, operational, and user-facing launch surfaces
- Plan targeted release-readiness checks for authenticated app, public-facing surfaces, backend support paths, and user-critical flows
- Plan remaining pre-launch validation boundaries, evidence requirements, and pass/fail criteria
- Plan sequencing for any final validation-only slices if needed before broader launch sign-off

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-70A for full details

---

#### TASK-70B: Launch Readiness Validation Execution

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION / DOCUMENTATION (NO CODE)
**Checkpoint:** `docs/PHASE-70B-CHECKPOINT.md`

**Objective:**
Execute the launch-readiness validation plan defined in `TASK-70A` and document findings, evidence, risks, and pass/fail outcomes before broader launch sign-off.

**Scope:**
- Execute validation coverage across product, operational, and user-facing launch surfaces
- Execute targeted release-readiness checks for authenticated app, public-facing surfaces, backend support paths, and user-critical flows
- Document launch-readiness findings, evidence, gaps, risks, and pass/fail outcomes
- Explicitly determine whether any blocking issues remain before broader launch sign-off

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-70B for full details

---

**Current Stage:** 70-FINAL-0

**Active Task:** TASK-70-FINAL

#### TASK-70-FINAL: Phase 70 Final Consolidation

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / VALIDATION (NO NEW IMPLEMENTATION)
**Checkpoint:** `docs/PHASE-70-FINAL-CHECKPOINT.md`

**Objective:**
Validate and consolidate completed Phase 70 planning and validation outputs and close Phase 70 with a final checkpoint.

**Scope:**
- Validate and consolidate `TASK-70A` and `TASK-70B`
- Confirm launch-readiness planning and execution outputs are coherent
- Confirm no blocking issues remain before broader launch sign-off
- Confirm Phase 70 remained documentation/validation-only
- Confirm no code/schema/endpoint changes occurred
- Create final Phase 70 checkpoint

**Non-Goals:**
- ??No new implementation
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-70-FINAL for full details

---

### Phase 71: Master Plan Reconciliation

**Current Stage:** 71-FINAL-0

**Active Task:** TASK-71-FINAL

#### TASK-71A: Master Plan Gap Analysis

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / PLANNING (NO CODE)
**Checkpoint:** `docs/PHASE-71A-CHECKPOINT.md`

**Objective:**
Compare the broader master plan against the currently completed/narrowed implementation path and define the next authoritative post-Phase-70 priorities.

**Scope:**
- Compare master plan vision against current PRD/ARCHITECTURE and completed implementation path
- Identify what is complete, partially complete, deferred, missing, or incompatible with current constraints
- Reconcile master plan vision with current PRD, ARCHITECTURE, TASKS, and TASKS_BACKLOG state
- Identify next authoritative post-Phase-70 product/workstream priorities
- Propose high-level sequencing for remaining master-plan work only

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-71A for full details

---

#### TASK-71B: Deferred Task Closure Planning

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / PLANNING (NO CODE)
**Checkpoint:** `docs/PHASE-71B-CHECKPOINT.md`

**Objective:**
Review deferred authoritative tasks already present in TASKS/TASKS_BACKLOG, identify the first post-Phase-70 deferred tasks that must be closed before broader master-plan expansion, and propose a closure sequence.

**Scope:**
- Review deferred authoritative tasks already present in current TASKS/TASKS_BACKLOG
- Identify first post-Phase-70 deferred tasks that must be closed before broader master-plan expansion
- Priority ordering across deferred runbook/documentation/support tasks already recognized by current project governance
- Selection of next active closure sequence from existing deferred task families only
- High-level sequencing proposal for deferred-task closure only

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-71B for full details

---

#### TASK-71C: TASKS.md Status Reconciliation

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / VALIDATION (NO CODE)
**Checkpoint:** `docs/PHASE-71C-CHECKPOINT.md`

**Objective:**
Reconcile TASKS.md status markers against checkpoint evidence already present in the repo. Normalize active/completed/locked status tracking based on existing authoritative checkpoint evidence only.

**Scope:**
- Reconcile TASKS.md status markers against checkpoint evidence already in the repo
- Identify tasks/phases that are complete in substance but not correctly reflected in TASKS.md
- Normalize active/completed/locked status tracking based on existing checkpoint evidence only
- Bulk status update in TASKS.md for all tasks where checkpoint evidence confirms completion

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors
- ??No new implementation work

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-71C for full details

---

#### TASK-71-FINAL: Phase 71 Final Consolidation

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / VALIDATION (NO CODE)
**Checkpoint:** `docs/PHASE-71-FINAL-CHECKPOINT.md`

**Objective:**
Validate and consolidate completed Phase 71 planning/validation/reconciliation work (TASK-71A, TASK-71B, TASK-71C) and close Phase 71 with a final checkpoint.

**Scope:**
- Validate and consolidate TASK-71A, TASK-71B, and TASK-71C
- Confirm the master-plan reconciliation, deferred-task closure planning, and TASKS.md status reconciliation outputs are coherent
- Explicitly record the remaining reconciliation exception for TASK-42A-4 due to missing checkpoint evidence
- Confirm Phase 71 remained documentation/validation-only
- Confirm no platform code/schema/endpoint changes occurred
- Create final Phase 71 checkpoint

**Non-Goals:**
- ??No new implementation
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-71-FINAL for full details

---

### Phase 72: TASK-42A-4 Evidence Resolution

**Current Stage:** 72-FINAL-0

**Active Task:** TASK-72-FINAL

#### TASK-72A: TASK-42A-4 Evidence Resolution

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / VALIDATION (NO CODE)
**Checkpoint:** `docs/PHASE-72A-CHECKPOINT.md`

**Objective:**
Resolve the remaining TASK-42A-4 reconciliation exception identified in Phase 71 by investigating missing checkpoint evidence and determining the correct corrective path.

**Scope:**
- Investigate the missing checkpoint evidence for TASK-42A-4 (`docs/PHASE-42A-CHECKPOINT.md` not present in repo)
- Determine whether TASK-42A-4 is complete but missing checkpoint evidence, incomplete and still legitimately active, or mis-tracked in TASKS.md
- Plan the minimum corrective path based on evidence only

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors
- ??No new implementation

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-72A for full details

---

#### TASK-72B: Execute TASK-42A-4

**Status:** COMPLETE and LOCKED
**Nature:** PLANNING / ACTIVATION (NO CODE)
**Checkpoint:** `docs/PHASE-72B-CHECKPOINT.md`

**Objective:**
Activate execution of still-incomplete TASK-42A-4 using the existing authoritative TASK-42A-4 objective/scope only, and normalize tracking so TASK-42A-4 is no longer an unresolved reconciliation issue.

**Scope:**
- Activate execution path for TASK-42A-4 as the next work item
- Carry forward original TASK-42A-4 scope from TASKS/TASKS_BACKLOG authoritative definitions only
- Normalize current task tracking for TASK-42A-4 based on Phase 72A evidence conclusion

**Non-Goals:**
- ??No platform code changes in this registration step
- ??No schema changes
- ??No endpoint changes
- ??No refactors
- ??No scope expansion beyond original TASK-42A-4 intent

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-72B for full details

---

#### TASK-72C: Implement Original TASK-42A-4

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (VERIFICATION + DOCUMENTATION ONLY)
**Checkpoint:** `docs/PHASE-72C-CHECKPOINT.md`

**Objective:**
Execute the original authoritative TASK-42A-4 work exactly as already defined in current TASKS/TASKS_BACKLOG definitions, and complete the missing Phase 42A finalization work without scope expansion.

**Scope:**
- Execute original TASK-42A-4 objective/scope exactly as already defined
- Perform comprehensive PowerShell 5.x verification across TASK-42A-1, TASK-42A-2, and TASK-42A-3
- Complete missing finalization checkpoint work at `docs/PHASE-42A-CHECKPOINT.md`
- Normalize project tracking by completing the still-pending original task

**Non-Goals:**
- ??No scope expansion beyond original TASK-42A-4 intent
- ??No replacement/redefinition of original TASK-42A-4 scope
- ??No refactors outside original verification/finalization boundaries

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-72C for full details

---

#### TASK-72-FINAL: Phase 72 Final Consolidation

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / VALIDATION (NO NEW IMPLEMENTATION)
**Checkpoint:** `docs/PHASE-72-FINAL-CHECKPOINT.md`

**Objective:**
Validate and consolidate completed Phase 72 evidence-resolution, activation, and implementation outputs (`TASK-72A`, `TASK-72B`, `TASK-72C`) and close Phase 72 with a final checkpoint.

**Scope:**
- Validate and consolidate TASK-72A, TASK-72B, and TASK-72C
- Confirm former TASK-42A-4 reconciliation exception is fully resolved
- Confirm original TASK-42A-4 execution/finalization completed without scope expansion
- Confirm Phase 72 remained within approved validation/activation/verification boundaries
- Confirm no schema/endpoint changes occurred
- Create final Phase 72 checkpoint

**Non-Goals:**
- ??No new implementation
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-72-FINAL for full details

---

### Phase 73: Post-Reconciliation Priority Selection

**Current Stage:** 73-FINAL-0

**Active Task:** TASK-73-FINAL

#### TASK-73A: Post-Reconciliation Priority Selection

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / PLANNING (NO CODE)
**Checkpoint:** `docs/PHASE-73A-CHECKPOINT.md`

**Objective:**
Select the next authoritative product/workstream priority after closure of the Phase 71 reconciliation track and Phase 72 exception-resolution track, under current PRD/ARCHITECTURE constraints.

**Scope:**
- Review remaining candidate workstreams already implied by current TASKS/TASKS_BACKLOG and the broader master plan
- Determine which remaining workstream should become the next active implementation priority under current PRD/ARCHITECTURE constraints
- Provide a high-level sequencing recommendation for the next immediate work family only

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-73A for full details

---

#### TASK-73B: Bounded Commercial Foundation Planning

**Status:** COMPLETE and LOCKED
**Nature:** PLANNING / TASK REGISTRATION (NO CODE)
**Checkpoint:** `docs/PHASE-73B-CHECKPOINT.md`

**Objective:**
Plan the first bounded commercial-foundation work family selected in Phase 73A under current PRD/ARCHITECTURE constraints.

**Scope:**
- Define immediate commercial-foundation scope allowed under current PRD/ARCHITECTURE constraints
- Identify minimum implementation slices required for that bounded commercial foundation
- Exclude broader commercial expansion beyond the first bounded family
- Provide sequencing recommendation for immediate commercial-foundation sub-stages only

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-73B for full details

---

#### TASK-73C-1: Commercial Readiness Contract Baseline

**Status:** PLANNED
**Nature:** IMPLEMENTATION (MINIMAL, ADDITIVE, BOUNDED)
**Checkpoint:** `docs/PHASE-73C-1-CHECKPOINT.md`

**Objective:**
Implement the first non-monetary, architecture-neutral commercial-readiness slice by normalizing and locking deterministic usage/quota contract behavior on existing surfaces only.

**Scope:**
- Normalize deterministic usage/quota contract behavior on existing surfaces only
- Keep implementation additive and architecture-neutral
- Improve readiness of existing usage/quota surfaces for future commercial packaging
- Preserve current request-driven governance and deterministic error semantics

**Non-Goals:**
- ??No monetary billing
- ??No subscriptions
- ??No invoicing
- ??No tax/accounting scope
- ??No new service boundaries
- ??No background-worker patterns
- ??No scope expansion beyond selected bounded family
- ??No schema changes unless explicitly authorized by current PRD/ARCHITECTURE constraints and absolutely required by bounded-family scope

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-73C-1 for full details

---

#### TASK-73C-2: Commercial Readiness Validation Path

**Status:** PLANNED
**Nature:** VALIDATION / DOCUMENTATION (NO NEW IMPLEMENTATION)
**Checkpoint:** `docs/PHASE-73C-2-CHECKPOINT.md`

**Objective:**
Validate the bounded non-monetary commercial-readiness contract baseline completed in TASK-73C-1 and confirm deterministic usage/quota behavior is coherent, stable, and packaging-ready on existing surfaces only.

**Scope:**
- Validate bounded usage/quota contract consistency on existing surfaces only
- Confirm deterministic usage/quota behavior and failure semantics remain coherent and stable
- Document bounded-family validation findings and readiness conclusions
- Preserve architecture-neutral, request-driven constraints while validating existing behavior

**Non-Goals:**
- ??No monetary billing
- ??No subscriptions
- ??No invoicing
- ??No tax/accounting scope
- ??No new service boundaries
- ??No background-worker patterns
- ??No scope expansion beyond selected bounded family
- ??No schema changes unless explicitly authorized by current PRD/ARCHITECTURE constraints and absolutely required by bounded validation scope

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-73C-2 for full details

---

#### TASK-73C-FINAL: Commercial Readiness Family Consolidation

**Status:** PLANNED
**Nature:** VALIDATION / DOCUMENTATION (NO NEW IMPLEMENTATION)
**Checkpoint:** `docs/PHASE-73C-FINAL-CHECKPOINT.md`

**Objective:**
Validate and consolidate completed bounded commercial-readiness outputs (`TASK-73C-1`, `TASK-73C-2`) and confirm the non-monetary usage/quota family is coherent and packaging-ready on existing surfaces only.

**Scope:**
- Validate and consolidate `TASK-73C-1` and `TASK-73C-2`
- Confirm bounded non-monetary commercial-readiness coherence and packaging-readiness on existing surfaces only
- Confirm no monetary billing/subscription/invoicing/tax scope was introduced
- Confirm no architecture expansion, new service boundaries, or background-worker patterns were introduced
- Confirm no schema changes occurred unless explicitly authorized and actually required by bounded family scope
- Create final 73C family checkpoint

**Non-Goals:**
- ??No new implementation
- ??No refactors
- ??No monetary billing/subscription/invoicing/tax scope expansion
- ??No architecture expansion or new service boundaries
- ??No background-worker patterns
- ??No scope expansion beyond selected bounded commercial family

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-73C-FINAL for full details

---

#### TASK-73-FINAL: Phase 73 Final Consolidation

**Status:** PLANNED
**Nature:** DOCUMENTATION / VALIDATION (NO NEW IMPLEMENTATION)
**Checkpoint:** `docs/PHASE-73-FINAL-CHECKPOINT.md`

**Objective:**
Validate and consolidate completed Phase 73 planning and bounded commercial-foundation outputs, and close Phase 73 with a final checkpoint.

**Scope:**
- Validate and consolidate `TASK-73A`, `TASK-73B`, `TASK-73C-1`, `TASK-73C-2`, and `TASK-73C-FINAL`
- Confirm selected bounded commercial foundation was the correct post-reconciliation next priority under current `PRD.md` / `ARCHITECTURE.md` constraints
- Confirm bounded non-monetary commercial-readiness family completed without monetary scope or architecture expansion
- Confirm no schema changes occurred
- Create final Phase 73 checkpoint: `docs/PHASE-73-FINAL-CHECKPOINT.md`

**Non-Goals:**
- ??No new implementation
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-73-FINAL for full details

---

### Phase 74: Next Bounded Commercial Family Selection

**Current Stage:** 74-FINAL-0

**Active Task:** TASK-74-FINAL

#### TASK-74A: Next Bounded Commercial Family Selection

**Status:** COMPLETE and LOCKED
**Nature:** PLANNING / TASK REGISTRATION (NO CODE)
**Checkpoint:** `docs/PHASE-74A-CHECKPOINT.md`

**Objective:**
Select the next bounded commercial-foundation family after completion of the Phase 73 non-monetary usage/quota readiness family, under current PRD/ARCHITECTURE constraints.

**Scope:**
- Review remaining deferred commercial candidates already implied by current governance sources and the broader master plan
- Determine which next bounded commercial family is allowed under current PRD/ARCHITECTURE constraints
- Exclude commercial candidates that still require broader architectural expansion or monetization scope not yet authorized
- Provide a high-level sequencing recommendation for the next immediate bounded commercial family only

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-74A for full details

---

#### TASK-74B: Commercial Visibility and Usage Reporting Family Planning

**Status:** COMPLETE and LOCKED
**Nature:** PLANNING / TASK REGISTRATION (NO CODE)
**Checkpoint:** `docs/PHASE-74B-CHECKPOINT.md`

**Objective:**
Plan the selected bounded family from Phase 74A (`Non-Monetary Commercial Visibility and Usage Reporting Readiness`) under current `PRD.md` / `ARCHITECTURE.md` constraints.

**Scope:**
- Define immediate allowed bounded scope for this selected family under current authority constraints
- Identify minimum implementation and validation slices required for this family
- Exclude monetization/billing/subscription/invoicing/tax/accounting scope and broader architecture expansion
- Provide immediate sub-stage sequencing recommendation for this family only
- Keep planning documentation-only with no platform code/schema/endpoint changes

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No implementation work
- ??No refactors
- ??No broader architectural expansion
- ??No monetization scope expansion beyond current authority constraints

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-74B for full details

---

#### TASK-74C-1: Cross-Surface Visibility Coherence Baseline

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (MINIMAL, ADDITIVE, BOUNDED)
**Checkpoint:** `docs/PHASE-74C-1-CHECKPOINT.md`

**Objective:**
Verify and normalize cross-surface coherence between user-facing usage/quota surfaces and admin-facing visibility surfaces on existing endpoints only, establishing a coherent visibility baseline for non-monetary commercial reporting readiness.

**Scope:**
- Verify that user-facing usage/quota data (`GET /api/users/me/usage`, `GET /api/users/me/quotas`) is coherent with admin-facing visibility data (`GET /api/internal/admin/users`) for the same underlying state
- Verify that user-facing session data (`GET /api/sessions?includeTerminated=true`) is coherent with admin-facing session data (`GET /api/internal/admin/sessions`) for the same user
- If cross-surface inconsistency is found, apply minimal normalization to align existing surface contracts
- If no inconsistency is found, document findings as validation-only
- Keep scope additive, bounded, and architecture-neutral
- Bounded to existing endpoints only ??no new endpoints

**Non-Goals:**
- ??No monetary billing
- ??No subscriptions
- ??No invoicing
- ??No tax/accounting scope
- ??No new service boundaries
- ??No background-worker patterns
- ??No schema changes unless explicitly authorized by current PRD/ARCHITECTURE constraints and absolutely required by this bounded slice
- ??No scope expansion beyond selected bounded family
- ??No new endpoints or surfaces
- ??No broader architectural expansion

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-74C-1 for full details

---

#### TASK-74C-2: Reporting Contract Determinism Validation

**Status:** PLANNED
**Nature:** VALIDATION / DOCUMENTATION (NO NEW IMPLEMENTATION)
**Checkpoint:** `docs/PHASE-74C-2-CHECKPOINT.md`

**Objective:**
Validate that existing visibility/reporting surfaces produce deterministic, reproducible, ordering-stable outputs suitable for commercial reporting use cases, within the bounded non-monetary family scope.

**Scope:**
- Validate response ordering stability on admin visibility surfaces (user list ordering, session list ordering)
- Validate field completeness and absence of time-of-request variability (beyond expected timestamps)
- Validate consistent failure semantics across user-facing and admin-facing reporting surfaces
- Document bounded-family validation findings and readiness conclusions
- No new implementation expected; if a blocking gap is found, scope it for a subsequent bounded slice

**Non-Goals:**
- ??No monetary billing
- ??No subscriptions
- ??No invoicing
- ??No tax/accounting scope
- ??No new service boundaries
- ??No background-worker patterns
- ??No schema changes unless explicitly authorized by current PRD/ARCHITECTURE constraints and absolutely required by this bounded validation scope
- ??No scope expansion beyond selected bounded family
- ??No new endpoints or surfaces
- ??No broader architectural expansion

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-74C-2 for full details

---

#### TASK-74C-FINAL: Visibility and Usage Reporting Family Consolidation

**Status:** PLANNED
**Nature:** DOCUMENTATION / VALIDATION (NO NEW IMPLEMENTATION)
**Checkpoint:** `docs/PHASE-74C-FINAL-CHECKPOINT.md`

**Objective:**
Validate and consolidate completed bounded visibility/reporting family outputs (`TASK-74C-1`, `TASK-74C-2`) and confirm the non-monetary family is coherent and packaging-ready on existing surfaces only.

**Scope:**
- Validate and consolidate `TASK-74C-1` and `TASK-74C-2`
- Confirm bounded non-monetary visibility/reporting family coherence and packaging-readiness on existing surfaces only
- Confirm no billing/subscription/invoicing/tax scope was introduced
- Confirm no architecture expansion, new service boundaries, or background-worker patterns were introduced
- Confirm no schema changes occurred unless explicitly authorized and actually required
- Create final 74C family checkpoint

**Non-Goals:**
- ??No new implementation
- ??No refactors
- ??No monetary billing/subscription/invoicing/tax scope expansion
- ??No architecture expansion or new service boundaries
- ??No background-worker patterns
- ??No scope expansion beyond selected bounded family

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-74C-FINAL for full details

---

#### TASK-74-FINAL: Phase 74 Final Consolidation

**Status:** PLANNED
**Nature:** DOCUMENTATION / VALIDATION (NO NEW IMPLEMENTATION)
**Checkpoint:** `docs/PHASE-74-FINAL-CHECKPOINT.md`

**Objective:**
Validate and consolidate completed Phase 74 planning and bounded visibility/reporting family outputs, and close Phase 74 with a final checkpoint.

**Scope:**
- Validate and consolidate `TASK-74A`, `TASK-74B`, `TASK-74C-1`, `TASK-74C-2`, and `TASK-74C-FINAL`
- Confirm selected bounded visibility/reporting family was the correct next bounded commercial family under current `PRD.md` / `ARCHITECTURE.md` constraints
- Confirm bounded non-monetary visibility and usage reporting family completed without billing/subscription/invoicing/tax scope or architecture expansion
- Confirm no schema changes occurred
- Create final Phase 74 checkpoint: `docs/PHASE-74-FINAL-CHECKPOINT.md`

**Non-Goals:**
- ??No new implementation
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-74-FINAL for full details

---

### Phase 75: Next Bounded Commercial Family Selection

**Current Stage:** 75A-0

**Active Task:** TASK-75A

#### TASK-75A: Next Bounded Commercial Family Selection

**Status:** PLANNED
**Nature:** DOCUMENTATION / PLANNING (NO CODE)
**Checkpoint:** `docs/PHASE-75A-CHECKPOINT.md`

**Objective:**
Select the next bounded commercial-foundation family after completion of the Phase 74 non-monetary visibility and usage reporting readiness family, under current PRD/ARCHITECTURE constraints.

**Scope:**
- Review remaining deferred commercial candidates already implied by current governance sources and the broader master plan
- Determine which next bounded commercial family is allowed under current PRD/ARCHITECTURE constraints
- Exclude commercial candidates that still require broader architectural expansion or monetization scope not yet authorized
- Provide a high-level sequencing recommendation for the next immediate bounded commercial family only

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-75A for full details

---

### Phase 76: End-to-End Manual App Validation

**Current Stage:** 76-FINAL-COMPLETE

**Active Task:** TASK-76-FINAL (COMPLETE and LOCKED)

#### TASK-76A: End-to-End Manual App Validation Planning

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / PLANNING (NO CODE)
**Checkpoint:** `docs/PHASE-76A-CHECKPOINT.md`

**Objective:**
Pause further readiness/commercial-readiness family execution until the current app is manually validated end to end. Define a manual validation/UAT plan for the current app using already implemented product surfaces.

**Scope:**
- Define manual validation/UAT plan covering all implemented product surfaces
- Plan validation coverage across: authenticated workspace, session/history flow, dashboard flow, public-facing flow, loading/empty/error states, responsive behavior, key user-critical flows
- Define evidence capture and pass/fail criteria for manual validation
- Define how discovered product issues should be recorded and prioritized one at a time
- Pause commercial-readiness family progression until manual validation is complete

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-76A for full details

---

#### TASK-76B: End-to-End Manual App Validation Execution

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION / DOCUMENTATION (NO CODE)
**Checkpoint:** `docs/PHASE-76B-CHECKPOINT.md`

**Objective:**
Execute the manual end-to-end app validation plan defined in Phase 76A against the running app. Capture evidence, determine pass/fail per area and overall, log discovered issues, and determine whether the current app is ready to resume paused readiness/commercial-readiness work.

**Scope:**
- Execute Phase 76A manual validation plan across all 9 defined areas in recommended order
- Capture evidence per Phase 76A evidence capture requirements
- Determine per-step, per-area, and overall pass/fail per Phase 76A criteria
- Log discovered issues using Phase 76A issue format (ISSUE-76-NNN) and prioritize one at a time
- Explicitly determine readiness to resume paused commercial-readiness family execution

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-76B for full details

**Validation Result:** FAIL ??ISSUE-76-001 (BLOCKING). Readiness/commercial-readiness work remains paused.

---

#### TASK-76C: Resolve ISSUE-76-001 ??Validation Environment Readiness

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (MINIMAL, TARGETED FIX)
**Checkpoint:** `docs/PHASE-76C-CHECKPOINT.md`

**Objective:**
Resolve the BLOCKING issue ISSUE-76-001 identified during Phase 76B manual validation: the validation environment is not fully runnable for end-to-end manual app validation. Frontend is unreachable at expected port. Authenticated and internal positive-path validations are blocked by missing validation credentials/keys.

**Scope:**
- Resolve ISSUE-76-001 only (one-issue-at-a-time product correction)
- Ensure frontend dev server is startable and reachable at expected port for UI/responsive validation
- Ensure at least one test user JWT is available for authenticated API endpoint validation
- Ensure internal service key (`X-Internal-Service-Key`) is available for admin endpoint validation
- Minimum required fix path only ??no unrelated improvements
- Verification/tests for ISSUE-76-001 resolution only
- Checkpoint/evidence update for this issue-resolution task only

**Non-Goals:**
- ??No unrelated fixes
- ??No scope expansion beyond ISSUE-76-001
- ??No refactors unless absolutely required for the minimum safe fix
- ??No schema changes unless absolutely required
- ??No broader architectural expansion
- ??No commercial-readiness work (still paused pending re-validation)

**Dependencies:** TASK-76B (Complete)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-76C for full details

---

#### TASK-76D: Post-Fix Manual Validation Recheck

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION / DOCUMENTATION (NO CODE)
**Checkpoint:** `docs/PHASE-76D-CHECKPOINT.md`

**Objective:**  
Re-execute the manual validation gate after the Phase 76C fix for `ISSUE-76-001` and determine whether the app now passes the previously failed gate and whether readiness/commercial-readiness work may resume.

**Scope:**
- Re-execute the relevant manual validation gate previously blocked by `ISSUE-76-001`
- Confirm pass/fail outcome for the post-fix manual validation recheck
- Confirm whether readiness/commercial-readiness work may resume
- Confirm `ISSUE-76-001` status based on recheck evidence (resolved or not resolved)
- Capture validation evidence and produce task checkpoint output

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors
- ??No unrelated issue work

**Dependencies:** TASK-76C (Complete)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-76D for full details

**Validation Result:** FAIL ??ISSUE-76-002, ISSUE-76-003, ISSUE-76-004 (all BLOCKING). Readiness/commercial-readiness work remains paused.

---

#### TASK-76E: Resolve ISSUE-76-004 ??Frontend Process Degraded/Hung

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (MINIMAL, TARGETED FIX)
**Checkpoint:** `docs/PHASE-76E-CHECKPOINT.md`

**Objective:**
Resolve the BLOCKING issue ISSUE-76-004 identified during Phase 76D post-fix manual validation recheck: the frontend process on port 3002 is in a degraded/hung state ??accepts TCP connections but does not serve HTTP responses, blocking UI validation for Areas 1, 2, and 8.

**Scope:**
- Resolve ISSUE-76-004 only (one-issue-at-a-time product correction)
- Diagnose why the frontend Node.js process on port 3002 accepts connections but hangs serving HTTP responses
- Apply minimum required fix to restore frontend HTTP response serving at expected validation port
- Verification/tests for ISSUE-76-004 resolution only
- Checkpoint/evidence update for this issue-resolution task only

**Non-Goals:**
- ??No unrelated fixes
- ??No scope expansion beyond ISSUE-76-004
- ??No refactors unless absolutely required for the minimum safe fix
- ??No schema changes
- ??No endpoint changes
- ??No broader architectural expansion
- ??No commercial-readiness work (still paused pending re-validation)

**Dependencies:** TASK-76D (Complete)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-76E for full details

---

#### TASK-76F: Resolve ISSUE-76-002 ??DELETE Session Returns HTTP 500

**Status:** COMPLETE
**Nature:** IMPLEMENTATION (MINIMAL, TARGETED FIX)
**Checkpoint:** `docs/PHASE-76F-CHECKPOINT.md`

**Objective:**
Resolve the BLOCKING issue ISSUE-76-002 identified during Phase 76D post-fix manual validation recheck: `DELETE /api/sessions/:id` returns HTTP 500 with an empty body. The session is not terminated. Subsequent `GET /api/sessions/:id` shows `terminatedAt: null`. Subsequent `POST /api/sessions/:id/exec` returns HTTP 404 instead of the expected HTTP 410 Gone. This blocks Area 3 (Session Lifecycle Flow) completion and Area 6 (Quota & Rate Limiting) prerequisites.

**Scope:**
- Resolve ISSUE-76-002 only (one-issue-at-a-time product correction)
- Diagnose why `DELETE /api/sessions/:id` returns HTTP 500 and fails to terminate the session
- Apply minimum required fix to restore correct session deletion/termination behavior
- Verification/tests for ISSUE-76-002 resolution only
- Checkpoint/evidence update for this issue-resolution task only

**Non-Goals:**
- ??No unrelated fixes
- ??No scope expansion beyond ISSUE-76-002
- ??No refactors unless absolutely required for the minimum safe fix
- ??No schema changes unless absolutely required and clearly justified by the documented issue scope
- ??No endpoint changes unless absolutely required and clearly justified by the documented issue scope
- ??No broader architectural expansion
- ??No commercial-readiness work (still paused pending re-validation)

**Dependencies:** TASK-76E (Complete)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-76F for full details

---

#### TASK-76G: Resolve ISSUE-76-003 ??GET Checkpoints Returns HTTP 500

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (MINIMAL, TARGETED FIX)
**Checkpoint:** `docs/PHASE-76G-CHECKPOINT.md`

**Objective:**
Resolve the BLOCKING issue ISSUE-76-003 identified during Phase 76D post-fix manual validation recheck: `GET /api/sessions/:id/checkpoints` returns HTTP 500 with an empty body for a valid active session. Expected behavior is HTTP 200 with a checkpoint list (empty array acceptable if no checkpoints yet). This blocks Area 4 (Session History/Checkpoint Flow) completion.

**Scope:**
- Resolve ISSUE-76-003 only (one-issue-at-a-time product correction)
- Diagnose why `GET /api/sessions/:id/checkpoints` returns HTTP 500
- Apply minimum required fix to restore correct checkpoints endpoint behavior
- Verification/tests for ISSUE-76-003 resolution only
- Checkpoint/evidence update for this issue-resolution task only

**Non-Goals:**
- ??No unrelated fixes
- ??No scope expansion beyond ISSUE-76-003
- ??No refactors unless absolutely required for the minimum safe fix
- ??No schema changes unless absolutely required and clearly justified by the documented issue scope
- ??No endpoint changes unless absolutely required and clearly justified by the documented issue scope
- ??No broader architectural expansion
- ??No commercial-readiness work (still paused pending re-validation)

**Dependencies:** TASK-76F (Complete)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-76G for full details

---

#### TASK-76H: Full Post-Fix Manual Validation Rerun

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION / DOCUMENTATION (NO CODE)
**Checkpoint:** `docs/PHASE-76H-CHECKPOINT.md`

**Objective:**
Execute a full rerun of the Phase 76A manual end-to-end app validation plan after completion of all known blocking fixes (TASK-76E, TASK-76F, TASK-76G). Capture evidence across all 9 validation areas, determine overall pass/fail for the current app state, and make an explicit gate decision on whether paused readiness/commercial-readiness work may resume.

**Scope:**
- Full rerun of the Phase 76A manual validation plan across all 9 areas
- Evidence capture per Phase 76A evidence capture requirements
- Per-step, per-area, and overall pass/fail determination
- Explicit gate decision: readiness/commercial-readiness work may or may not resume
- No platform code changes
- No schema changes beyond already-completed approved changes
- No endpoint changes

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors
- ??No unrelated issue work
- ??No commercial-readiness work (gate decision produced by this task, not assumed)

**Dependencies:** TASK-76G (Complete)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-76H for full details

---

#### TASK-76-FINAL: Phase 76 Final Consolidation

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / VALIDATION (NO NEW IMPLEMENTATION)
**Checkpoint:** `docs/PHASE-76-FINAL-CHECKPOINT.md`

**Objective:**
Validate and consolidate completed Phase 76 manual-validation planning, execution, issue-resolution, and rerun work (TASK-76A through TASK-76H) and close Phase 76 with a final checkpoint.

**Scope:**
- Validate and consolidate TASK-76A, TASK-76B, TASK-76C, TASK-76D, TASK-76E, TASK-76F, TASK-76G, and TASK-76H
- Confirm the manual validation gate process was executed correctly end-to-end
- Confirm ISSUE-76-001, ISSUE-76-002, ISSUE-76-003, and ISSUE-76-004 were each resolved within bounded one-issue-at-a-time scope
- Confirm the final rerun (TASK-76H) produced CONDITIONAL PASS and opened the gate for readiness/commercial-readiness work to resume
- Explicitly record ISSUE-76-005 (exec route gap) as NON-BLOCKING carry-forward only ??not a gate blocker
- Confirm no unauthorized scope expansion or refactors occurred across Phase 76
- Create final checkpoint: `docs/PHASE-76-FINAL-CHECKPOINT.md`

**Non-Goals:**
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors
- ??No new implementation

**Dependencies:** TASK-76H (Complete)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-76-FINAL for full details

---

### Phase 77: Resolve ISSUE-76-005 ??Exec Route Gap

**Current Stage:** 77-FINAL-COMPLETE

**Active Task:** TASK-77-FINAL (COMPLETE and LOCKED)

#### TASK-77A: Resolve ISSUE-76-005 ??POST /api/sessions/:id/exec Route Gap

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (MINIMAL, TARGETED FIX)
**Checkpoint:** `docs/PHASE-77A-CHECKPOINT.md`

**Objective:**
Resolve ISSUE-76-005 identified during Phase 76H full post-fix manual validation rerun: `POST /api/sessions/:id/exec` returns HTTP 404 because the route does not exist in the API Gateway. AI execution is implemented at `POST /api/ai/execute`. Resolve the gap with the minimum required fix path only.

**Scope:**
- Resolve ISSUE-76-005 only (one-issue-at-a-time product correction)
- Diagnose whether `POST /api/sessions/:id/exec` should exist per PRD/ARCHITECTURE authority
- Apply minimum required fix: either (a) implement the missing session-scoped exec route delegating to the AI execution path, or (b) document the correct validated route path and update the Phase 76A validation plan reference, whichever is the minimum safe resolution
- Verification/tests for ISSUE-76-005 resolution only
- Checkpoint/evidence update for this issue-resolution task only

**Non-Goals:**
- ??No unrelated fixes
- ??No scope expansion beyond ISSUE-76-005
- ??No refactors unless absolutely required for the minimum safe fix
- ??No schema changes unless absolutely required
- ??No broader architectural expansion
- ??No commercial-readiness work

**Dependencies:** TASK-76-FINAL (Complete)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-77A for full details

---

**Current Stage:** 77-FINAL-COMPLETE

**Active Task:** TASK-77-FINAL (COMPLETE and LOCKED)

#### TASK-77-FINAL: Phase 77 Final Consolidation

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / VALIDATION (NO NEW IMPLEMENTATION)
**Checkpoint:** `docs/PHASE-77-FINAL-CHECKPOINT.md`

**Objective:**
Validate and consolidate completed Phase 77 bounded fix outputs (`TASK-77A`) and close Phase 77 with a final checkpoint.

**Scope:**
- Validate and consolidate `TASK-77A`
- Confirm ISSUE-76-005 was resolved within bounded one-issue-at-a-time scope
- Confirm `POST /api/sessions/:id/exec` now matches the intended public API contract per PRD.md / ARCHITECTURE.md
- Confirm no unauthorized scope expansion or refactors occurred
- Confirm no schema changes occurred
- Create final Phase 77 checkpoint: `docs/PHASE-77-FINAL-CHECKPOINT.md`

**Non-Goals:**
- ??No new implementation
- ??No platform code changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors

**Dependencies:** TASK-77A (Complete)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-77-FINAL for full details

---

### Phase 78: Real Workspace Exec Interaction Slice

**Current Stage:** 78-FINAL-COMPLETE

**Active Task:** TASK-78-FINAL (COMPLETE and LOCKED)

#### TASK-78A: Core Exec Interaction Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-78A-CHECKPOINT.md`

**Objective:**
Wire the workspace's existing command input surface to `POST /api/sessions/:id/exec` and display real exec results (`exitCode`, `stdout`, `stderr`) in the workspace, with correct busy / success / error state feedback.

**Scope:**
- Connect the workspace command input UI to `POST /api/sessions/:id/exec`
- Manage exec lifecycle state: idle ??sending ??result
- Disable input while request is in flight
- Display `exitCode`, `stdout`, `stderr` in the workspace result/output area
- Visually distinguish success (`exitCode === 0`) from failure (`exitCode !== 0`)
- Handle HTTP 400, 404, 410, and network/unexpected error as distinct frontend states
- Frontend-only changes ??additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No checkpoint/history refresh (deferred to TASK-78B)
- ??No terminal emulation or streaming
- ??No broader workspace redesign
- ??No new endpoints

**Dependencies:** TASK-77A (Complete), TASK-68C (Complete), TASK-68D (Complete), Phase 76 gate OPEN

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-78A for full details

---

#### TASK-78B: Post-Exec Surface Coherence

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-78B-CHECKPOINT.md`

**Objective:**
After a successful exec, refresh the checkpoint list and session-state indicators in the workspace using already-available backend capabilities only, so workspace surfaces stay coherent with actual session state.

**Scope:**
- After a successful exec response, trigger refresh of `GET /api/sessions/:id/checkpoints`
- Reflect updated checkpoint list in the existing history/control surface
- Refresh session status/activity indicator in the existing workspace shell where already wired
- Use only already-available backend capabilities
- Frontend-only changes ??additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No polling or timer-based refresh
- ??No websocket/realtime work
- ??No diff/revert UI changes

**Dependencies:** TASK-78A (Complete and Locked), TASK-68D (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-78B for full details

---

#### TASK-78-FINAL: Phase 78 Final Consolidation

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION / DOCUMENTATION ONLY (NO CODE)
**Checkpoint:** `docs/PHASE-78-FINAL-CHECKPOINT.md`

**Objective:**
Validate and consolidate completed Phase 78 slices (`TASK-78A`, `TASK-78B`) and close Phase 78 with a final checkpoint confirming the real workspace exec interaction slice is complete, bounded, and coherent.

**Scope:**
- Validate and consolidate `TASK-78A` and `TASK-78B` outputs
- Confirm exec interaction end-to-end (workspace input ??exec request ??result rendering ??post-exec surface refresh)
- Confirm scope remained frontend-only and additive
- Confirm no backend changes, no schema changes, no refactors
- Confirm PRD / ARCHITECTURE alignment (exec contract, HTTP semantics, JWT/ownership)
- Confirm no regressions across workspace shell, session sidebar, and history/control surfaces
- Create final Phase 78 checkpoint

**Non-Goals:**
- ??No new implementation
- ??No platform code changes
- ??No backend changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors
- ??No new product scope
- ??No TASK-79 work

**Dependencies:** TASK-78A (Complete and Locked), TASK-78B (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-78-FINAL for full details

**Completion Summary:**
- ??TASK-78A validated ??core exec interaction slice complete and locked
- ??TASK-78B validated ??post-exec surface coherence complete and locked
- ??End-to-end exec interaction confirmed (workspace input ??exec request ??result rendering ??post-exec refresh)
- ??Scope confirmed frontend-only and additive across all Phase 78 work
- ??No backend changes, schema changes, endpoint changes, or refactors
- ??PRD/ARCHITECTURE alignment confirmed (`exitCode`/`stdout`/`stderr`, HTTP 400/404/410, JWT/ownership)
- ??39/39 tests pass; 0 regressions
- ??Final checkpoint created: `docs/PHASE-78-FINAL-CHECKPOINT.md`

---

### Phase 79: Core Preview Interaction Slice

**Current Stage:** 79-FINAL-0

**Active Task:** TASK-79-FINAL

#### TASK-79A: Core Preview Interaction Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-79A-CHECKPOINT.md`

**Objective:**
Make the workspace preview panel meaningfully usable by wiring the existing preview surface to the already-available preview route/proxy path, with clear loading / ready / error / unavailable states.

**Scope:**
- Connect the existing workspace preview panel to the already-available preview URL/path for the active session only
- Render the real preview surface inside the existing workspace panel
- Add clear preview lifecycle states: loading, ready, unavailable / not yet running, error
- Add manual refresh control for the preview surface only
- Keep integration localized to the existing workspace shell and preview panel
- Frontend-only changes ??additive only
- Focused frontend tests for this slice
- Slice-specific checkpoint output

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No terminal/streaming work
- ??No editor/file-tree work in this task
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-78-FINAL (Complete and Locked), TASK-68C (Complete), TASK-78A (Complete and Locked), TASK-78B (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-79A for full details

**Completion Summary:**
- ??Preview panel wired to existing preview proxy path for the active session only
- ??All four preview lifecycle states rendered (loading, ready, unavailable, error)
- ??Manual refresh control scoped to preview panel only ??no full page reload
- ??Preview tied strictly to active session; resets on session switch
- ??Frontend-only and additive ??no backend, schema, endpoint, or refactor changes
- ??45/45 tests pass; 0 regressions
- ??Checkpoint created: `docs/PHASE-79A-CHECKPOINT.md`

---

#### TASK-79B: Core Editor File Navigation Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-79B-CHECKPOINT.md`

**Objective:**
Make the workspace editor area meaningfully usable by wiring the existing editor/file-navigation surface to already-available workspace file capabilities, so the user can browse files and switch the active file inside the main workspace.

**Scope:**
- Connect the existing workspace editor/file-navigation surface to already-available file listing / file-content capabilities only
- Render a real file list/tree surface for the active session only
- Allow selecting a file from that surface
- Load and display the selected file in the existing editor area
- Add clear localized UI states: loading, ready, empty / no file available, error
- Keep file-navigation state tied to the active session only
- Keep integration localized to the existing workspace shell, editor panel, and file-navigation surface
- Frontend-only changes ??additive only
- Focused frontend tests for this slice
- Slice-specific checkpoint output

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No file editing/save behavior in this task
- ??No file create/delete/rename/upload in this task
- ??No terminal/streaming work
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** Phase 78 (Complete and Locked), TASK-79A (Complete and Locked), TASK-68C (Complete)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-79B for full details

---

#### TASK-79-FINAL: Phase 79 Final Consolidation

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION / DOCUMENTATION ONLY (NO CODE)
**Checkpoint:** `docs/PHASE-79-FINAL-CHECKPOINT.md`

**Objective:**
Validate and consolidate completed Phase 79 slices (`TASK-79A`, `TASK-79B`) and close Phase 79 with a final checkpoint confirming the workspace preview and editor/file-navigation usability slice is complete, bounded, and coherent.

**Scope:**
- Validate and consolidate `TASK-79A` and `TASK-79B`
- Confirm scope remained frontend-only and additive
- Confirm no backend, schema, or refactor changes occurred
- Confirm PRD / ARCHITECTURE alignment for preview panel, active-session scoping, and file capability reuse
- Confirm no regressions across all workspace surfaces
- Create final Phase 79 checkpoint

**Non-Goals:**
- ??No new implementation
- ??No platform code changes
- ??No backend changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors
- ??No new product scope
- ??No TASK-80 work

**Dependencies:** TASK-79A (Complete and Locked), TASK-79B (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-79-FINAL for full details

**Completion Summary:**
- ??TASK-79A validated ??core preview interaction slice complete and locked
- ??TASK-79B validated ??core editor file navigation slice complete and locked
- ??End-to-end preview and file-navigation usability confirmed
- ??Scope confirmed frontend-only and additive across all Phase 79 work
- ??No backend changes, schema changes, endpoint changes, or refactors
- ??PRD/ARCHITECTURE alignment confirmed (preview proxy, session scoping, file capability reuse)
- ??49/49 tests pass; 0 regressions
- ??Final checkpoint created: `docs/PHASE-79-FINAL-CHECKPOINT.md`

---

### Phase 80: Core Manual Workspace Slices

**Current Stage:** 80C-COMPLETE

**Active Task:** TASK-80C (COMPLETE and LOCKED)

#### TASK-80A: Core Editor Save Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-80A-CHECKPOINT.md`

**Objective:**
Make the workspace editor meaningfully usable for actual code changes by wiring the existing editor surface to already-available file write capability, so the user can edit the active file and save it from the main workspace.

**Scope:**
- Reuse the existing active-session file-navigation/editor surface from TASK-79B
- Allow editing of the currently selected file content inside the existing editor area
- Add save action for the active file using already-available file write capability only
- Add localized save-related UI states: clean, dirty, saving, saved, save-error
- Keep editing/saving strictly tied to the active session and selected file only
- Preserve session-switch safety and stale-request guards
- Keep integration localized to the existing workspace shell/editor panel
- Frontend-only changes ??additive only
- Focused frontend tests for this slice
- Slice-specific checkpoint output

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No create/delete/rename/upload in this task
- ??No diff viewer in this task
- ??No autosave in this task
- ??No collaborative editing
- ??No terminal/streaming work
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** Phase 79 (Complete and Closed), TASK-79B (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-80A for full details

**Completion Summary:**
- ??Editor content made editable in existing editor area
- ??Save action wired to existing `POST /api/files/:sessionId/write` capability only
- ??Five distinct save states rendered: clean, dirty, saving, saved, save-error
- ??Session-switch and file-change safety preserved; stale-request guards in place
- ??No backend, schema, endpoint, refactor, or polling changes
- ??51/51 frontend tests pass; 0 regressions
- ??Checkpoint created: `docs/PHASE-80A-CHECKPOINT.md`

---

#### TASK-80B: Core Manual Checkpoint Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-80B-CHECKPOINT.md`

**Objective:**
Make workspace version-control usability meaningfully better by wiring the existing history/control surface to already-available checkpoint creation capability, so the user can create a manual checkpoint ("Save Point") for the active session from the main workspace.

**Scope:**
- Reuse the existing history/control surface from TASK-68D and existing active-session wiring
- Add manual checkpoint creation action for the active session only using already-available checkpoint capability
- Support optional short description input if already supported by the existing checkpoint capability; otherwise use minimal request shape already supported
- Refresh the checkpoint list after successful manual checkpoint creation using existing checkpoint fetch patterns
- Add localized checkpoint-creation UI states: idle, creating, created, create-error
- Keep checkpoint creation strictly tied to the active session only
- Keep integration localized to the existing workspace shell and history/control surface
- Frontend-only changes ??additive only
- Focused frontend tests for this slice
- Slice-specific checkpoint output

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No diff viewer in this task
- ??No revert flow in this task
- ??No branching/star/filter/search in this task
- ??No autosave checkpointing
- ??No polling/websocket behavior
- ??No broader workspace redesign
- ??No multi-task work

**Dependencies:** Phase 78 (Complete and Closed), Phase 79 (Complete and Closed), TASK-80A (Complete and Locked), TASK-68D (Complete)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-80B for full details

---

#### TASK-80C: Core Manual Revert Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-80C-CHECKPOINT.md`

**Objective:**
Make workspace version-control usability meaningfully better by wiring the existing history/control surface to already-available checkpoint revert capability, so the user can restore the active session to a chosen checkpoint from the main workspace.

**Scope:**
- Reuse the existing history/control surface and active-session checkpoint list from TASK-68D / TASK-80B
- Add manual revert action for a selected checkpoint using already-available revert capability only
- Add explicit confirmation step before revert is submitted
- Scope revert strictly to the active session and the selected checkpoint only
- Refresh relevant workspace surfaces after successful revert using existing fetch patterns only (checkpoint/history, file navigation/editor, preview where supported by existing request-driven paths)
- Add localized revert UI states: idle, confirming, reverting, reverted, revert-error
- Keep integration localized to the existing workspace shell and history/control surface
- Frontend-only changes ??additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No diff viewer in this task
- ??No partial/file-level revert in this task
- ??No branching/star/filter/search in this task
- ??No autosave checkpointing
- ??No polling/websocket behavior
- ??No broader workspace redesign
- ??No multi-task work

**Dependencies:** Phase 78 (Complete and Closed), Phase 79 (Complete and Closed), TASK-80A (Complete and Locked), TASK-80B (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-80C for full details

---

#### TASK-80-FINAL: Phase 80 Final Consolidation

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION / DOCUMENTATION ONLY (NO CODE)
**Checkpoint:** `docs/PHASE-80-FINAL-CHECKPOINT.md`

**Objective:**
Validate and consolidate completed Phase 80 slices (`TASK-80A`, `TASK-80B`) and close Phase 80 with a final checkpoint confirming the editor save and manual checkpoint workspace usability slice is complete, bounded, and coherent.

**Scope:**
- Validate and consolidate `TASK-80A` and `TASK-80B`
- Confirm end-to-end workspace usability for editor save and manual checkpoint creation
- Confirm scope remained frontend-only and additive
- Confirm no backend, schema, or refactor changes occurred
- Confirm PRD / ARCHITECTURE alignment
- Confirm no regressions across all workspace surfaces
- Create final checkpoint: `docs/PHASE-80-FINAL-CHECKPOINT.md`

**Non-Goals:**
- ??No new implementation
- ??No platform code changes
- ??No backend changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors
- ??No new product scope
- ??No TASK-81 work

**Dependencies:** TASK-80A (Complete and Locked), TASK-80B (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-80-FINAL for full details

**Completion Summary:**
- ??TASK-80A validated ??core editor save slice complete and locked
- ??TASK-80B validated ??core manual checkpoint slice complete and locked
- ??End-to-end editor save and manual checkpoint creation confirmed
- ??Scope confirmed frontend-only and additive across all Phase 80 work
- ??No backend changes, schema changes, endpoint changes, or refactors
- ??PRD/ARCHITECTURE alignment confirmed (file write reuse, checkpoint reuse, session scoping, request-driven behavior)
- ??55/55 tests pass; 0 regressions
- ??Final checkpoint created: `docs/PHASE-80-FINAL-CHECKPOINT.md`
- ?? NOTE: This closure predates TASK-80C. Superseded by TASK-80-RECONSOLIDATE.

---

#### TASK-80-RECONSOLIDATE: Phase 80 Final Re-Consolidation

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION / DOCUMENTATION ONLY (NO CODE)
**Checkpoint:** `docs/PHASE-80-RECONSOLIDATED-FINAL-CHECKPOINT.md`

**Objective:**
Re-validate and re-consolidate Phase 80 so the final Phase 80 closure correctly includes `TASK-80A`, `TASK-80B`, and `TASK-80C`, replacing the now-outdated earlier `TASK-80-FINAL` closure which only covered `TASK-80A` and `TASK-80B`.

**Scope:**
- Validate and consolidate `TASK-80A`, `TASK-80B`, and `TASK-80C`
- Confirm end-to-end workspace usability for editor save, manual checkpoint creation, and manual checkpoint revert
- Confirm scope remained frontend-only and additive across all three slices
- Confirm no backend, schema, or refactor changes occurred
- Confirm PRD / ARCHITECTURE alignment
- Confirm no regressions across all workspace surfaces
- Supersede the earlier `TASK-80-FINAL` closure with an updated final Phase 80 checkpoint

**Non-Goals:**
- ??No new implementation
- ??No platform code changes
- ??No backend changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors
- ??No new product scope
- ??No TASK-81 work

**Dependencies:** TASK-80A (Complete and Locked), TASK-80B (Complete and Locked), TASK-80C (Complete and Locked)

**Completion Summary:**
- ??TASK-80A validated ??core editor save slice complete and locked
- ??TASK-80B validated ??core manual checkpoint slice complete and locked
- ??TASK-80C validated ??core manual revert slice complete and locked
- ??End-to-end editor save, manual checkpoint creation, and manual checkpoint revert confirmed
- ??Scope confirmed frontend-only and additive across all three Phase 80 slices
- ??No backend changes, schema changes, endpoint changes, or refactors
- ??PRD/ARCHITECTURE alignment confirmed (file write reuse, checkpoint reuse, revert reuse, session scoping, request-driven behavior)
- ??58/58 tests pass; 0 regressions
- ??Earlier PHASE-80-FINAL-CHECKPOINT.md superseded
- ??Final reconsolidated checkpoint created: `docs/PHASE-80-RECONSOLIDATED-FINAL-CHECKPOINT.md`

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-80-RECONSOLIDATE for full details

---

## Phase 81 ??History/Control-Surface Usability Family

**Status:** CLOSED  
**Final stage:** TASK-81-FINAL-CLOSE (COMPLETE and LOCKED)  
**Final test baseline:** 93/93 passing, 0 failures, 0 regressions  
**Authoritative closure:** `docs/PHASE-81-FINAL-CHECKPOINT.md`

---

#### TASK-81A: Core Checkpoint Diff Viewer Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81A-CHECKPOINT.md`

**Objective:**
Make workspace history/version-control usability meaningfully better by wiring the existing history/control surface to already-available checkpoint diff capability, so the user can inspect what changed at a chosen checkpoint from the main workspace.

**Scope:**
- Reuse the existing history/control surface and active-session checkpoint list
- Add a diff-view action for a selected checkpoint using existing checkpoint diff capability only
- Render a localized diff viewer inside the existing workspace/history-control area only
- Show distinct diff-viewer UI states: idle / loading / ready / empty / diff-error
- Active-session-scoped diff viewing only
- Refresh diff content when a different checkpoint is selected
- Frontend-only, additive changes
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No new endpoints
- ??No refactors
- ??No revert or manual checkpoint changes in this task
- ??No advanced compare-any-two-checkpoints flow
- ??No polling/websocket behavior
- ??No broader workspace redesign

**Dependencies:** Phase 78??0 complete and closed; existing history/control surface and checkpoint list fetch pattern present; existing checkpoint diff capability already available

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81A for full details

---

#### TASK-81B: Enhanced Checkpoint Diff Summary Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81B-CHECKPOINT.md`

**Objective:**
Make checkpoint comparison more usable by enhancing the existing diff viewer with clear file-change summary and easier file-by-file diff navigation, using the already-available checkpoint diff capability only.

**Scope:**
- Reuse the existing TASK-81A checkpoint diff viewer and existing diff endpoint only
- Add a clear changed-files summary (files added / modified / deleted) for the selected checkpoint diff
- Add localized file-by-file navigation within the existing diff viewer area
- Allow user to switch between changed files in the currently loaded diff result
- Keep rendering bounded to the existing workspace/history/control area
- Preserve active-session-scoped and selected-checkpoint-scoped diff viewing
- Frontend-only, additive changes
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No new endpoints
- ??No refactors
- ??No compare-any-two-checkpoints flow in this task
- ??No side-by-side Monaco diff editor in this task
- ??No revert or manual checkpoint changes in this task
- ??No search/filter/star/timeline enhancements in this task
- ??No polling/websocket behavior
- ??No broader workspace redesign

**Dependencies:** TASK-81A complete and locked; existing diff capability at `GET /api/sessions/:id/checkpoints/:hash/diff`

**Completion Summary:**
- ??Changed-files summary (added/modified/deleted counts and grouped file paths) added inside existing diff viewer
- ??Localized file-by-file navigation added inside existing diff viewer area
- ??Selection defaults to first file; resets safely when checkpoint or session changes
- ??Selected-file detail pane renders status badge, file path, and diff text
- ??Existing TASK-81A diff viewer behavior (all five states: idle/loading/ready/empty/diff-error) preserved
- ??Scope confirmed frontend-only and additive; no existing logic restructured
- ??No backend changes, schema changes, endpoint changes, or refactors
- ??PRD/ARCHITECTURE alignment confirmed (request-driven, session-scoped, existing diff endpoint reused)
- ??61/61 tests pass; 0 regressions
- ??Checkpoint created: `docs/PHASE-81B-CHECKPOINT.md`

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81B for full details

---

#### TASK-81C: Readable Checkpoint Diff Rendering Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81C-CHECKPOINT.md`

**Objective:**
Make checkpoint diff inspection more usable by upgrading the existing diff viewer from raw preformatted text to structured, readable unified-diff rendering, using the already-available checkpoint diff response only.

**Scope:**
- Reuse the existing TASK-81A / TASK-81B diff viewer and existing diff endpoint only
- Parse and render the existing unified diff text from the already-loaded diff response only
- Show diff hunks and changed lines in a more readable structured view inside the existing history/control area
- Visually distinguish added lines, removed lines, context lines, and hunk headers
- Keep file summary and per-file navigation from TASK-81B intact
- Preserve active-session-scoped and selected-checkpoint-scoped diff viewing
- Keep rendering bounded to the existing workspace/history/control area
- Frontend-only, additive changes
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No new endpoints
- ??No refactors
- ??No compare-any-two-checkpoints flow in this task
- ??No side-by-side Monaco diff editor in this task
- ??No syntax-highlighting engine integration if that expands scope
- ??No revert or manual checkpoint changes in this task
- ??No search/filter/star/timeline enhancements in this task
- ??No polling/websocket behavior
- ??No broader workspace redesign

**Dependencies:** TASK-81A and TASK-81B complete and locked; existing diff capability at `GET /api/sessions/:id/checkpoints/:hash/diff`

**Completion Summary:**
- ??Structured unified-diff rendering added for selected-file diff content inside existing `HistoryCheckpointDiffViewer`
- ??Line parser classifies lines as `hunk` / `added` / `removed` / `context`
- ??Distinct per-line visual styling and `data-testid` hooks for all four line types
- ??Empty diff fallback preserved
- ??Existing TASK-81B changed-file summary and per-file navigation unchanged
- ??Existing TASK-81A five diff states (`idle` / `loading` / `ready` / `empty` / `diff-error`) unchanged
- ??Session-switch and checkpoint-switch scoping preserved unchanged
- ??Scope confirmed frontend-only and additive; no existing logic restructured
- ??No backend changes, schema changes, endpoint changes, or refactors
- ??62/62 tests pass; 0 regressions
- ??Checkpoint created: `docs/PHASE-81C-CHECKPOINT.md`

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81C for full details

---

#### TASK-81-FINAL: Phase 81 Final Consolidation

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION / DOCUMENTATION ONLY (NO CODE)
**Checkpoint:** `docs/PHASE-81-FINAL-CHECKPOINT.md`

**Objective:**
Validate and consolidate completed Phase 81 slices (`TASK-81A`, `TASK-81B`, `TASK-81C`) and close Phase 81 with a final checkpoint confirming the checkpoint diff viewer usability family is complete, bounded, and coherent.

**Scope:**
- Validate and consolidate `TASK-81A`, `TASK-81B`, and `TASK-81C`
- Confirm end-to-end checkpoint diff usability improvement across all three slices
- Confirm scope remained frontend-only and additive
- Confirm no backend, schema, or refactor changes occurred
- Confirm PRD / ARCHITECTURE alignment
- Confirm no regressions across all workspace surfaces
- Create final checkpoint: `docs/PHASE-81-FINAL-CHECKPOINT.md`

**Non-Goals:**
- ??No new implementation
- ??No platform code changes
- ??No backend changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors
- ??No new product scope
- ??No TASK-82 work

**Completion Summary:**
- ??TASK-81A confirmed COMPLETE and LOCKED ??core checkpoint diff viewer wiring, five diff states, stale-request guard, session-scoped diff handling
- ??TASK-81B confirmed COMPLETE and LOCKED ??changed-file summary (added/modified/deleted counts), grouped file paths, per-file diff navigation
- ??TASK-81C confirmed COMPLETE and LOCKED ??structured unified-diff line rendering, visual distinction for hunk/added/removed/context lines
- ??End-to-end checkpoint diff usability confirmed across all three slices
- ??Scope confirmed frontend-only and additive; no backend, schema, endpoint, or refactor changes
- ??PRD/ARCHITECTURE alignment confirmed (request-driven, session-scoped, existing diff endpoint reused)
- ??62/62 tests pass; 0 regressions across all surfaces
- ??Checkpoint created: `docs/PHASE-81-FINAL-CHECKPOINT.md`

**Dependencies:** TASK-81A (Complete and Locked), TASK-81B (Complete and Locked), TASK-81C (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81-FINAL for full details

---

#### TASK-81D: Compare Two Checkpoints Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81D-CHECKPOINT.md`

**Objective:**
Make checkpoint history comparison more usable by allowing the user to choose two checkpoints from the existing history/control surface and inspect the diff between them, using already-available checkpoint diff capability only.

**Scope:**
- Reuse the existing history/control surface and existing diff viewer family from TASK-81A / 81B / 81C
- Add a bounded compare mode: choose a base checkpoint + a target checkpoint from the active session
- Show compare mode only inside the existing history/control area
- Use existing checkpoint diff capability only ??no new endpoints
- Support active-session-scoped comparison only
- Add localized compare-mode UI states: idle / selecting / loading / ready / compare-error
- Reuse existing changed-file summary, per-file navigation, and readable diff rendering for the compared result
- Frontend-only, additive changes
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No new endpoints
- ??No refactors
- ??No side-by-side Monaco diff editor in this task
- ??No branching in this task
- ??No revert / manual-checkpoint changes in this task
- ??No timeline / search / filter / star enhancements in this task
- ??No polling/websocket behavior
- ??No broader workspace redesign

**Dependencies:** TASK-81A, TASK-81B, and TASK-81C complete and locked; existing history/control surface, checkpoint diff capability, changed-file summary, and readable diff rendering all present

**Completion Summary:**

- ??Compare mode added inside existing `history-control-slice` boundary ??no new panels or routes
- ??Base + target checkpoint selection with `Set Base` / `Set Target` buttons per checkpoint entry
- ??Five compare-mode states implemented: idle / selecting / loading / ready / compare-error
- ??Existing diff capability (`GET /api/sessions/:id/checkpoints/:hash/diff`) reused ??no new endpoint
- ??Bounded pair validation: `compare-error` when pair is incomplete, duplicate, or non-adjacent (parentHash mismatch)
- ??Compare-ready result rendered via existing `HistoryCheckpointDiffViewer` ??changed-file summary, file navigation, and structured diff lines all reused intact
- ??Active-session scoping and stale-request guard pattern applied (`checkpointCompareRequestIdRef`)
- ??Session-switch compare-state reset added to existing `useEffect([selectedSessionId])`
- ??Scope confirmed frontend-only and additive; no backend, schema, endpoint, or refactor changes
- ??PRD/ARCHITECTURE alignment confirmed (request-driven, session-scoped, existing diff endpoint reused)
- ??63/63 tests pass; 0 regressions across all workspace surfaces
- ??Checkpoint created: `docs/PHASE-81D-CHECKPOINT.md`

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81D for full details

---

#### TASK-81-RECONSOLIDATE: Phase 81 Final Re-Consolidation

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION / DOCUMENTATION ONLY (NO CODE)
**Checkpoint:** `docs/PHASE-81-RECONSOLIDATED-FINAL-CHECKPOINT.md`

**Objective:**
Re-validate and re-consolidate Phase 81 so the final Phase 81 closure correctly includes `TASK-81A`, `TASK-81B`, `TASK-81C`, and `TASK-81D`, replacing the now-outdated earlier `TASK-81-FINAL` closure which was written before `TASK-81D` existed.

**Scope:**
- Validate and consolidate `TASK-81A`, `TASK-81B`, `TASK-81C`, and `TASK-81D`
- Confirm end-to-end checkpoint diff usability improvement across all four slices (diff viewer, summary, readable rendering, compare mode)
- Confirm scope remained frontend-only and additive across all four slices
- Confirm no backend, schema, endpoint, or refactor changes occurred across any slice
- Confirm PRD / ARCHITECTURE alignment
- Confirm no regressions across all workspace surfaces
- Supersede the earlier `TASK-81-FINAL` closure with an updated final checkpoint at `docs/PHASE-81-RECONSOLIDATED-FINAL-CHECKPOINT.md`

**Non-Goals:**
- ??No new implementation
- ??No platform code changes
- ??No backend changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors
- ??No new product scope
- ??No TASK-82 work

**Dependencies:** TASK-81A (Complete and Locked), TASK-81B (Complete and Locked), TASK-81C (Complete and Locked), TASK-81D (Complete and Locked); prior `TASK-81-FINAL` exists but is now outdated

**Completion Summary:**
- ??TASK-81A confirmed COMPLETE and LOCKED ??core checkpoint diff viewer wiring, five diff states (`idle` / `loading` / `ready` / `empty` / `diff-error`), stale-request guard, active-session and selected-checkpoint scoping
- ??TASK-81B confirmed COMPLETE and LOCKED ??changed-file summary (added/modified/deleted counts and grouped paths), per-file diff navigation, local file selection with safe reset on diff/session change
- ??TASK-81C confirmed COMPLETE and LOCKED ??structured unified-diff line rendering, visual distinction for hunk headers/added/removed/context lines, `parseUnifiedDiffLines` / `getUnifiedDiffLineType` helpers
- ??TASK-81D confirmed COMPLETE and LOCKED ??bounded compare mode with five compare states, base/target selection, bounded pair validation, existing diff capability and diff viewer reused for compare result
- ??End-to-end checkpoint diff usability confirmed across all four slices
- ??Scope confirmed frontend-only and additive; no backend, schema, endpoint, or refactor changes
- ??PRD/ARCHITECTURE alignment confirmed (request-driven, session-scoped, existing diff endpoint reused)
- ??63/63 tests pass; 0 regressions across all surfaces
- ??`docs/PHASE-81-RECONSOLIDATED-FINAL-CHECKPOINT.md` created; supersedes `docs/PHASE-81-FINAL-CHECKPOINT.md`

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81-RECONSOLIDATE for full details

---

#### TASK-81E: Checkpoint Search and Filter Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81E-CHECKPOINT.md`

**Objective:**
Make checkpoint history easier to use by adding bounded client-side search and filter controls to the existing history/control surface, using the already-loaded checkpoint list only.

**Scope:**
- Add bounded client-side text search over visible checkpoint metadata/description within the existing history/control area
- Add bounded client-side filter controls using already-available checkpoint metadata only
- Keep diff viewer, compare mode, manual checkpoint, and manual revert surfaces intact
- Preserve active-session-scoped history behavior
- Frontend-only, additive changes
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No new endpoints
- ??No refactors
- ??No persistence of saved filters
- ??No starred/favorited checkpoints
- ??No timeline redesign
- ??No fuzzy-search library or dependency expansion if avoidable
- ??No polling/websocket behavior
- ??No broader workspace redesign
- ??No multi-task work

**Dependencies:** TASK-81A (Complete and Locked), TASK-81B (Complete and Locked), TASK-81C (Complete and Locked), TASK-81D (Complete and Locked); existing history/control surface and checkpoint list load path already present

**Completion evidence:**
- ??Bounded text search input (`history-search-input`) and description filter (`history-description-filter`) added inside existing `data-testid="history-control-slice"` boundary
- ??`filterVisibleWorkspaceCheckpoints()` pure helper added to `workspace-shell.logic.ts` ??no backend/endpoint/schema changes
- ??Search/filter state resets on session switch via `useEffect([selectedSessionId])`
- ??Compare run gating aligned to visible filtered checkpoint subset
- ??`services/` and `backend/` untouched ??confirmed by `git diff --name-only -- services/ backend/` ??empty
- ??67/67 tests pass; +4 net new tests for this slice; 0 regressions

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81E for full details

---

#### TASK-81-RERECONSOLIDATE: Phase 81 Final Re-Re-Consolidation

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION / DOCUMENTATION ONLY (NO CODE)
**Checkpoint:** `docs/PHASE-81-RERECONSOLIDATED-FINAL-CHECKPOINT.md`

**Supersession Notice:**
This task supersedes the earlier `TASK-81-RECONSOLIDATE` closure (`docs/PHASE-81-RECONSOLIDATED-FINAL-CHECKPOINT.md`). That closure was written after `TASK-81D` and before `TASK-81E` was scoped, implemented, or locked. It does not include `TASK-81E` (Checkpoint Search and Filter Slice). This re-re-consolidation produces the authoritative and complete Phase 81 closure across all five slices.

**Objective:**
Re-validate and re-re-consolidate Phase 81 so the final Phase 81 closure correctly includes `TASK-81A`, `TASK-81B`, `TASK-81C`, `TASK-81D`, and `TASK-81E`.

**Dependencies:** TASK-81A (Complete and Locked), TASK-81B (Complete and Locked), TASK-81C (Complete and Locked), TASK-81D (Complete and Locked), TASK-81E (Complete and Locked)

**Completion:**
- ??TASK-81A confirmed COMPLETE and LOCKED ??core checkpoint diff viewer wiring, five diff states (`idle` / `loading` / `ready` / `empty` / `diff-error`), stale-request guard, active-session and selected-checkpoint scoping
- ??TASK-81B confirmed COMPLETE and LOCKED ??changed-file summary (added/modified/deleted counts and grouped paths), per-file diff navigation, local file selection with safe reset on diff/session change
- ??TASK-81C confirmed COMPLETE and LOCKED ??structured unified-diff line rendering, visual distinction for hunk headers/added/removed/context lines, `parseUnifiedDiffLines` / `getUnifiedDiffLineType` helpers
- ??TASK-81D confirmed COMPLETE and LOCKED ??bounded compare mode with five compare states, base/target selection, bounded pair validation, existing diff capability and diff viewer reused for compare result
- ??TASK-81E confirmed COMPLETE and LOCKED ??bounded client-side text search over checkpoint metadata, description-presence filter from already-loaded data, active-session-scoped state reset, compare-run safety aligned to visible filtered set
- ??Phase 81 final closure: 67/67 tests pass, frontend-only additive scope, no backend/schema/endpoint/refactor changes, no regressions
- ??Authoritative checkpoint: `docs/PHASE-81-RERECONSOLIDATED-FINAL-CHECKPOINT.md` (supersedes `PHASE-81-RECONSOLIDATED-FINAL-CHECKPOINT.md` and `PHASE-81-FINAL-CHECKPOINT.md`)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81-RERECONSOLIDATE for full details

---

#### TASK-81F: Visual Checkpoint Timeline Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81F-CHECKPOINT.md`

**Objective:**
Make checkpoint history easier to scan by adding a bounded visual timeline presentation to the existing history/control surface, using the already-loaded checkpoint list only.

**Scope:**
- Add bounded visual timeline presentation for checkpoints inside the existing history/control area
- Use already-available checkpoint metadata only (order, timestamps, descriptions)
- Improve scanability: checkpoint order, current/selected item emphasis, timestamps/descriptions
- Keep existing search/filter, diff viewer, compare mode, manual checkpoint, and manual revert surfaces intact
- Active-session-scoped; localized to existing workspace shell and history/control surface
- Frontend-only, additive changes
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No new endpoints
- ??No refactors
- ??No branching visualization
- ??No drag/drop reorder
- ??No persistence of timeline preferences
- ??No timeline redesign outside existing history/control slice boundary
- ??No fuzzy-search/dependency expansion
- ??No polling/websocket behavior
- ??No broader workspace redesign
- ??No multi-task work

**Dependencies:** TASK-81A (Complete and Locked), TASK-81B (Complete and Locked), TASK-81C (Complete and Locked), TASK-81D (Complete and Locked), TASK-81E (Complete and Locked); existing history/control surface and checkpoint list load path already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81F for full details

---

#### TASK-81-RERERECONSOLIDATE: Phase 81 Final Re-Re-Re-Consolidation

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION / DOCUMENTATION ONLY (NO CODE)
**Checkpoint:** `docs/PHASE-81-RERERECONSOLIDATED-FINAL-CHECKPOINT.md`

**Objective:**
Re-validate and re-re-re-consolidate Phase 81 so the final Phase 81 closure correctly includes `TASK-81A`, `TASK-81B`, `TASK-81C`, `TASK-81D`, `TASK-81E`, and `TASK-81F`, replacing the now-outdated earlier final consolidation states (`TASK-81-FINAL`, `TASK-81-RECONSOLIDATE`, `TASK-81-RERECONSOLIDATE`).

**Scope:**
- Validate and consolidate all six slices (81A through 81F)
- Confirm end-to-end checkpoint diff/history usability including visual timeline
- Confirm frontend-only additive scope; no backend/schema/endpoint/refactor changes
- Confirm PRD/ARCHITECTURE alignment and no regressions
- Supersede earlier final consolidation checkpoints with updated closure

**Non-Goals:** No new implementation; no platform code changes; no TASK-82 work

**Dependencies:** TASK-81A through TASK-81F (all Complete and Locked); prior `TASK-81-FINAL`, `TASK-81-RECONSOLIDATE`, and `TASK-81-RERECONSOLIDATE` exist but are outdated (written before TASK-81F)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81-RERERECONSOLIDATE for full details

---

#### TASK-81-RERERERECONSOLIDATE: Phase 81 Final Re-Re-Re-Re-Consolidation

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION / DOCUMENTATION ONLY (NO CODE)
**Checkpoint:** `docs/PHASE-81-RERERERECONSOLIDATED-FINAL-CHECKPOINT.md`

**Objective:**
Re-validate and re-re-re-re-consolidate Phase 81 so the final Phase 81 closure correctly includes `TASK-81A`, `TASK-81B`, `TASK-81C`, `TASK-81D`, `TASK-81E`, `TASK-81F`, and `TASK-81G`, replacing the now-outdated earlier final consolidation states (`TASK-81-FINAL`, `TASK-81-RECONSOLIDATE`, `TASK-81-RERECONSOLIDATE`, `TASK-81-RERERECONSOLIDATE`).

**Scope:**
- Validate and consolidate all seven slices (81A through 81G)
- Confirm end-to-end checkpoint diff/history usability including git-log-style browser
- Confirm frontend-only additive scope; no backend/schema/endpoint/refactor changes
- Confirm PRD/ARCHITECTURE alignment and no regressions
- Supersede earlier final consolidation checkpoints with updated closure

**Non-Goals:** No new implementation; no platform code changes; no TASK-82 work

**Dependencies:** TASK-81A through TASK-81G (all Complete and Locked); prior `TASK-81-FINAL`, `TASK-81-RECONSOLIDATE`, `TASK-81-RERECONSOLIDATE`, and `TASK-81-RERERECONSOLIDATE` exist but are outdated (written before TASK-81G)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81-RERERERECONSOLIDATE for full details

---

#### TASK-81G: Git-Log Style Checkpoint Browser Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81G-CHECKPOINT.md`

**Objective:**
Make checkpoint history easier to inspect by adding a bounded git-log-style browser inside the existing history/control surface, using the already-loaded checkpoint list and existing history metadata only.

**Scope:**
- Add bounded git-log-style presentation for checkpoints inside the existing history/control area
- Use only already-available checkpoint metadata (ordering, hash visibility, timestamps, descriptions)
- Improve inspectability: commit/checkpoint ordering, hash visibility, timestamps/descriptions, currently selected/acted-on item emphasis
- Keep existing search/filter, visual timeline, diff viewer, compare mode, manual checkpoint, and manual revert surfaces intact
- Active-session-scoped; localized to existing workspace shell and history/control surface
- Frontend-only, additive changes
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No new endpoints
- ??No refactors
- ??No export/history markdown in this task
- ??No full code-at-that-point restoration flow in this task
- ??No branching visualization
- ??No persistence of browser view preferences
- ??No timeline redesign outside existing history/control slice boundary
- ??No fuzzy-search/dependency expansion
- ??No polling/websocket behavior
- ??No broader workspace redesign
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81F (all Complete and Locked); existing history/control surface and checkpoint list load path already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81G for full details

---

#### TASK-81H: Checkpoint File Snapshot Viewer Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81H-CHECKPOINT.md`

**Objective:**
Make checkpoint history more useful by allowing the user to inspect file content at a selected checkpoint from the existing history/control surface, without restoring the workspace.

**Scope:**
- Add a bounded checkpoint snapshot viewer inside the existing history/control area
- Allow the user to inspect file content for a selected checkpoint using already-available history/file capability only
- Keep this strictly read-only; no restore/revert action in this task
- Active-session-scoped behavior only
- Keep existing diff viewer, compare mode, search/filter, timeline, git-log browser, manual checkpoint, and manual revert surfaces intact
- Frontend-only, additive changes
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints unless already available in existing architecture
- ??No restore/revert action in this task
- ??No editing/saving from checkpoint snapshot in this task
- ??No branching visualization
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81G (all Complete and Locked); existing history/control surface and checkpoint/history capability already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81H for full details

---

#### TASK-81I: Jump From History To Live File Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81I-CHECKPOINT.md`

**Objective:**
Make checkpoint history more actionable by allowing the user to jump from a selected checkpoint file item in the existing history/control surface to the corresponding live file in the current workspace, without restoring the checkpoint.

**Scope:**
- Reuse existing history/control surface, diff viewer, snapshot viewer, and live file-navigation/editor surfaces only
- Add a bounded "open in live workspace" action from history-derived file items only
- Support action only when the corresponding file exists in the active live workspace
- Switch workspace focus to corresponding live file using existing file-navigation/editor capabilities only
- Keep strictly non-restorative: no revert, no restore, no writing checkpoint content into the live file
- Active-session-scoped behavior only
- Keep diff viewer, compare mode, search/filter, timeline, git-log browser, snapshot viewer, manual checkpoint, and manual revert surfaces intact
- Frontend-only, additive changes
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No auto-open if the live file is missing
- ??No restore/revert action in this task
- ??No editing/saving of checkpoint snapshot content in this task
- ??No branching visualization
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-79B, TASK-80A, TASK-81A through TASK-81H (all Complete and Locked); existing live file-navigation/editor surface and history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81I for full details

---

#### TASK-81J: Pinned Comparison Reference Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81J-CHECKPOINT.md`

**Objective:**
Make checkpoint history workflows faster by allowing the user to pin one checkpoint as the active comparison reference inside the existing history/control surface, so later diff/compare actions can reuse that reference without repeated re-selection.

**Scope:**
- Reuse the existing history/control surface and already-loaded checkpoint list only
- Add a bounded "pin as compare reference" action for checkpoint items inside the existing history/control area
- Keep the pinned reference frontend-only and session-scoped
- Allow existing compare/diff actions to reuse the pinned checkpoint where appropriate without introducing new backend contracts
- Make pinned state clearly visible in the existing history/control surface
- Preserve existing manual compare mode, diff viewer, search/filter, timeline, git-log browser, snapshot viewer, jump-to-live-file, manual checkpoint, and manual revert surfaces
- Frontend-only changes
- Additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No persistence of pinned state beyond current session/view
- ??No automatic compare execution without explicit user action
- ??No broader workflow redesign
- ??No branching visualization
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81I (all Complete and Locked); existing history/control surface and compare/diff flows already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81J for full details

---

#### TASK-81K: Checkpoint Details Inspector Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81K-CHECKPOINT.md`

**Objective:**
Make checkpoint history easier to inspect by adding a bounded checkpoint details inspector inside the existing history/control surface for the currently selected checkpoint, using already-loaded checkpoint metadata only.

**Scope:**
- Reuse the existing history/control surface and already-loaded checkpoint list only
- Add a bounded checkpoint details inspector inside the existing history/control area
- Show details for the currently selected checkpoint using already-available loaded metadata only
- Improve inspectability for full hash, timestamp, description/label, and current acted-on states already derived in the UI
- Keep existing diff viewer, compare mode, search/filter, visual timeline, git-log browser, snapshot viewer, jump-to-live-file, pinned comparison reference, manual checkpoint, and manual revert surfaces intact
- Frontend-only changes
- Additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No editing of checkpoint metadata in this task
- ??No export/share action in this task
- ??No branching visualization
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81J (all Complete and Locked); existing history/control surface and checkpoint list load path already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81K for full details

---

#### TASK-81L: Revert Preview Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81L-CHECKPOINT.md`

**Objective:**
Make revert workflows safer and easier to understand by adding a bounded revert preview inside the existing history/control surface before the user confirms a revert, using already-loaded checkpoint metadata and existing diff/snapshot capabilities only.

**Scope:**
- Reuse the existing history/control surface, existing revert flow, and existing diff/snapshot viewer surfaces only
- Add a bounded revert-preview state inside the existing history/control area before final revert confirmation
- Show the user which checkpoint is about to be reverted to using already-loaded checkpoint metadata
- Reuse existing diff/snapshot capability where already available to help preview the target checkpoint
- Keep final revert execution explicitly user-confirmed
- Preserve active-session-scoped behavior only
- Keep diff viewer, compare mode, search/filter, timeline, git-log browser, snapshot viewer, jump-to-live-file, pinned comparison reference, details inspector, manual checkpoint, and manual revert surfaces intact
- Frontend-only changes
- Additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic revert in this task
- ??No partial/file-level revert in this task
- ??No restore/rewrite of live files outside the existing revert endpoint
- ??No branching visualization
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-80C, TASK-81A through TASK-81K (all Complete and Locked); existing history/control surface, revert flow, and diff/snapshot surfaces already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81L for full details

---

#### TASK-81M: Checkpoint Changed Files Inspector Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81M-CHECKPOINT.md`

**Objective:**
Make checkpoint history easier to inspect by adding a bounded changed-files inspector for the currently selected checkpoint inside the existing history/control surface, using already-available loaded diff/snapshot metadata only.

**Scope:**
- Reuse the existing history/control surface and existing checkpoint selection patterns only
- Add a bounded changed-files inspector inside the existing history/control area
- Show a stable file list for the currently selected checkpoint using already-available data only
- Improve inspectability for changed file paths, file status where already derivable, and quick switching between changed files inside the selected checkpoint context
- Keep existing diff viewer, compare mode, search/filter, visual timeline, git-log browser, snapshot viewer, jump-to-live-file, pinned comparison reference, details inspector, revert preview, manual checkpoint, and manual revert surfaces intact
- Preserve active-session-scoped behavior only
- Frontend-only changes
- Additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic diff opening in this task
- ??No restore/revert action in this task
- ??No editing/saving from changed-files inspector in this task
- ??No branching visualization
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81L (all Complete and Locked); existing history/control surface and diff/snapshot surfaces already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81M for full details

---

#### TASK-81N: History Working Set Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81N-CHECKPOINT.md`

**Objective:**
Make checkpoint history workflows easier to manage by allowing the user to temporarily add checkpoint items to a bounded frontend-only working set inside the existing history/control surface for short-term review.

**Scope:**
- Reuse the existing history/control surface and already-loaded checkpoint list only
- Add a bounded working-set feature inside the existing history/control area
- Allow the user to add/remove checkpoint items to/from the working set using already-loaded checkpoint metadata only
- Keep the working set frontend-only, temporary, and session-scoped
- Make working-set membership clearly visible in the existing history/control surface
- Allow the working set to coexist with all existing history surface flows
- Keep integration localized to the existing workspace shell and history/control surface
- Frontend-only changes
- Additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No persistence of working-set state beyond current session/view
- ??No bulk actions in this task
- ??No export/share in this task
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81M (all Complete and Locked); existing history/control surface and checkpoint list load path already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81N for full details

---

#### TASK-81O: History Surface Reset Controls Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81O-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to manage by adding bounded reset/clear controls for temporary frontend-only history state inside the existing history/control surface.

**Scope:**
- Reuse the existing history/control surface only
- Add bounded reset/clear controls for temporary frontend-only history state inside the existing history/control area
- Cover only already-existing frontend-only temporary state: pinned comparison reference, working set, search/filter inputs, and local inspector selections
- Keep all reset actions explicitly user-triggered
- Keep reset behavior scoped to the active session only
- Keep all existing history surface flows intact
- Keep integration localized to the existing workspace shell and history/control surface
- Frontend-only changes
- Additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic resets
- ??No persistence of reset preferences
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81N (all Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81O for full details

---

#### TASK-81P: Unified Active Checkpoint Highlight Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81P-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to read by adding a bounded unified active-checkpoint highlight inside the existing history/control surface, so the user can immediately tell which checkpoint is currently active across existing history interactions.

**Scope:**
- Reuse the existing history/control surface and already-loaded checkpoint list only
- Add a bounded unified active-checkpoint highlight system inside the existing history/control area
- Reflect already-existing active/acted-on checkpoint state only (diff target, compare base/target, pinned reference, revert/preview target, snapshot target, inspector target)
- Make active state clearer and more consistent across the existing checkpoint list presentation
- Keep all existing history surface flows intact
- Keep integration localized to the existing workspace shell and history/control surface
- Frontend-only changes
- Additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No new durable state
- ??No automatic history actions
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81O (all Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81P for full details

---

#### TASK-81Q: History State Summary Bar Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81Q-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to understand at a glance by adding a bounded history-state summary bar inside the existing history/control surface, using already-available frontend state and already-loaded checkpoint data only.

**Scope:**
- Reuse the existing history/control surface and already-loaded checkpoint list only
- Add a bounded summary bar inside the existing history/control area
- Surface already-existing active history state in one compact area (diff target, compare base/target, pinned reference, snapshot target, revert preview/revert target, inspector target, working-set count, search/filter status)
- Keep the summary read-only and informational
- Keep all existing history surface flows intact
- Keep integration localized to the existing workspace shell and history/control surface
- Frontend-only changes
- Additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No new durable state
- ??No automatic history actions
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81P (all Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81Q for full details

---

#### TASK-81R: Compare Metadata Summary Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81R-CHECKPOINT.md`

**Objective:**
Make checkpoint comparison easier to understand at a glance by adding a bounded compare-metadata summary inside the existing history/control surface, using already-loaded checkpoint data and existing compare selection state only.

**Scope:**
- Reuse the existing history/control surface, already-loaded checkpoint list, and existing compare selection state only
- Add a bounded compare-metadata summary inside the existing history/control area
- Show a compact summary for the currently selected compare base and compare target using already-loaded checkpoint metadata only (identity, full hash, timestamp, description/label)
- Keep the summary read-only and informational
- Keep all existing history surface flows intact
- Keep integration localized to the existing workspace shell and history/control surface
- Frontend-only changes
- Additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic compare execution in this task
- ??No new durable state
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81Q (all Complete and Locked); existing history/control surface and compare selection flow already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81R for full details

---

#### TASK-81S: Checkpoint Inspection Readiness Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81S-CHECKPOINT.md`

**Objective:**
Make checkpoint inspection smoother by adding a bounded readiness/status surface inside the existing history/control area that shows whether the current checkpoint has loaded context available for downstream inspection tools, using only already-available frontend state and already-loaded checkpoint data.

**Scope:**
- Reuse the existing history/control surface, already-loaded checkpoint list, and already-derived in-surface frontend state only
- Add a bounded checkpoint inspection readiness surface inside the existing history/control area
- Show compact readiness/status indicators for the current checkpoint context (diff metadata available, snapshot metadata available, changed-files metadata available, compare selection readiness, live-file jump availability) where already derivable from loaded state
- Keep the surface read-only and informational
- Keep all existing history surface flows intact
- Keep integration localized to the existing workspace shell and history/control surface
- Frontend-only changes
- Additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic loading in this task
- ??No automatic action triggering in this task
- ??No new durable state
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81R (all Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81S for full details

---

#### TASK-81T: Current Checkpoint Summary Card Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81T-CHECKPOINT.md`

**Objective:**
Make checkpoint inspection easier at a glance by adding a bounded current-checkpoint summary card inside the existing history/control surface, using already-available frontend state and already-loaded checkpoint data only.

**Scope:**
- Reuse the existing history/control surface, already-loaded checkpoint list, and already-derived current checkpoint context only
- Add a bounded current-checkpoint summary card inside the existing history/control area
- Show a compact read-only summary for the current checkpoint context (identity, full hash, timestamp, description/label, currently active roles) using already-loaded checkpoint metadata only
- Keep the summary read-only and informational
- Keep all existing history surface flows intact
- Keep integration localized to the existing workspace shell and history/control surface
- Frontend-only changes
- Additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic action triggering in this task
- ??No new durable state
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81S (all Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81T for full details

---

#### TASK-81U: History Action Availability Hints Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81U-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to understand by showing bounded inline availability hints for existing history actions, using only already-derived frontend state and already-loaded checkpoint data.

**Scope:**
- Reuse the existing history/control surface only
- Add bounded inline hints indicating when existing history actions are available/unavailable
- Cover relevant existing actions (compare, diff, snapshot, jump-to-live-file, revert) where derivable from already-loaded state
- Keep hints read-only and informational
- Keep all existing history surface flows intact
- Active-session scoped only
- Frontend-only changes
- Additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No new durable state
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81T (all Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81U for full details

---

#### TASK-81V: Checkpoint Role Legend Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81V-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to understand by adding a bounded legend for existing checkpoint role labels/highlights inside the existing history/control surface, using only already-derived frontend state and already-loaded checkpoint data.

**Scope:**
- Reuse the existing history/control surface only
- Add a compact read-only legend explaining already-present role labels/highlights (diff target, compare base/target, pinned reference, revert/preview target, snapshot target, details inspector target, changed-files inspector target)
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep the legend read-only and informational
- Keep all existing history surface flows intact
- Active-session scoped only
- Frontend-only changes
- Additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No new durable state
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81U (all Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81V for full details

---

#### TASK-81W: History Selection Breadcrumb Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81W-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to follow by adding a bounded breadcrumb-style selection trail inside the existing history/control surface, using only already-derived frontend state and already-loaded checkpoint data.

**Scope:**
- Reuse the existing history/control surface only
- Add a compact read-only breadcrumb trail for the current history selection context (current checkpoint context, compare base/target, pinned reference, snapshot target, revert target/preview target, details inspector target, changed-files inspector target)
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep it informational only
- Keep all existing history surface flows intact
- Active-session scoped only
- Frontend-only changes
- Additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No new durable state
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81V (all Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81W for full details

---

#### TASK-81X: History Empty-State Guidance Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81X-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to understand by adding bounded empty/unavailable guidance for the existing history/control surface, using only already-derived frontend state and already-loaded checkpoint data.

**Scope:**
- Reuse the existing history/control surface only
- Add compact read-only empty/unavailable guidance where relevant (no checkpoint selected, no compare base/target, no snapshot target context, no changed-files metadata loaded, no working-set members, no active checkpoint context)
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep it informational only
- Preserve all existing Phase 81 surfaces
- Active-session scoped only
- Frontend-only changes
- Additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No new durable state
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81W (all Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81X for full details

---

#### TASK-81Y: History Context Density Toggle Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81Y-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to scan by adding a bounded frontend-only density toggle inside the existing history/control surface, so users can switch between compact and expanded history context presentation without changing underlying behavior.

**Scope:**
- Reuse the existing history/control surface only
- Add a compact/expanded density toggle for the existing history presentation
- Affect presentation only for already-existing history UI blocks where relevant
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the toggle frontend-only, temporary, and active-session scoped
- Keep it informational/presentation-only
- Preserve all existing Phase 81 surfaces
- Frontend-only changes
- Additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81X (all Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81Y for full details

---

#### TASK-81Z: History Surface Focus Mode Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-81Z-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to focus on by adding a bounded frontend-only focus mode inside the existing history/control surface, so users can temporarily reduce visual noise while inspecting checkpoint context.

**Scope:**
- Reuse the existing history/control surface only
- Add a compact focus-mode toggle for the existing history presentation
- Focus mode affects presentation only for already-existing history UI blocks where relevant
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep focus mode frontend-only, temporary, and active-session scoped
- Keep it informational/presentation-only
- Preserve all existing Phase 81 surfaces
- Frontend-only changes
- Additive only
- Focused frontend tests for this slice

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state
- ??No broader workspace redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81Y (all Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81Z for full details

---

#### TASK-81-FINAL-CLOSE: Phase 81 Final Consolidation and Closure

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION / DOCUMENTATION ONLY (NO CODE)
**Checkpoint:** `docs/PHASE-81-FINAL-CHECKPOINT.md`

**Objective:**
Perform the true final consolidation for Phase 81 and close the Phase 81 history/control-surface usability family after TASK-81A through TASK-81Z.

**Scope:**
- Validate and consolidate TASK-81A through TASK-81Z
- Confirm final Phase 81 baseline is 93/93 tests
- Confirm the whole family remained frontend-only and additive
- Confirm no backend/schema/endpoint/refactor changes across the family
- Confirm no regressions across workspace shell, session sidebar, exec interaction, preview panel, file navigation/save, manual checkpoint, manual revert, and all history/control surfaces
- Produce the authoritative final Phase 81 checkpoint at `docs/PHASE-81-FINAL-CHECKPOINT.md`
- Mark Phase 81 closed so the next bounded slice starts under Phase 82, not Phase 81

**Non-Goals:**
- ??No new implementation
- ??No product code changes
- ??No backend changes
- ??No schema changes
- ??No endpoint changes
- ??No refactors
- ??No Phase 82 implementation in this task

**Dependencies:** TASK-81A through TASK-81Z (all Complete and Locked)

**Completion Summary:**
- ??TASK-81A through TASK-81Z confirmed COMPLETE and LOCKED (all 26 implementation slices)
- ??All 5 prior consolidation documents (TASK-81-FINAL, TASK-81-RECONSOLIDATE, TASK-81-RERECONSOLIDATE, TASK-81-RERERECONSOLIDATE, TASK-81-RERERERECONSOLIDATE) superseded by `docs/PHASE-81-FINAL-CHECKPOINT.md`
- ??Final test baseline confirmed: 93/93 passing, 0 failures, 0 regressions
- ??Whole family confirmed frontend-only and additive across all 26 slices
- ??No backend/schema/endpoint/refactor changes confirmed across all 26 slices
- ??No regressions confirmed across workspace shell, session sidebar, exec interaction, preview panel, file navigation/save, manual checkpoint, manual revert, and all history/control surfaces
- ??Authoritative final Phase 81 checkpoint produced at `docs/PHASE-81-FINAL-CHECKPOINT.md`
- ??Phase 81 marked CLOSED; next bounded work starts under Phase 82

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-81-FINAL-CLOSE for full details

---

## Phase 82 ??History Surface Usability Continued

**Status:** CLOSED  
**Current stage:** TASK-82-FINAL-CLOSE (COMPLETE and LOCKED)

---

#### TASK-82-FINAL-CLOSE: Phase 82 Final Consolidation and Closure

**Status:** COMPLETE and LOCKED  
**Nature:** VALIDATION / DOCUMENTATION ONLY (NO CODE)  
**Checkpoint:** `docs/PHASE-82-FINAL-CHECKPOINT.md`

**Objective:**  
Close Phase 82 as a complete, bounded history/control-surface usability family covering all 24 slices (TASK-82A through TASK-82X).

**Outcome:**
- ??All 24 slices (TASK-82A through TASK-82X) confirmed COMPLETE and LOCKED
- ??No backend/schema/endpoint/refactor changes confirmed across all 24 slices
- ??No regressions ??100/100 tests passing (baseline preserved)
- ??Authoritative final Phase 82 checkpoint produced at `docs/PHASE-82-FINAL-CHECKPOINT.md`
- ??Phase 82 marked CLOSED

**Reference:** `docs/PHASE-82-FINAL-CHECKPOINT.md`

---

---

#### TASK-82A: History Surface Section Collapse Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82A-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to manage at larger scale by adding bounded section collapse/expand controls inside the existing history/control surface, using only already-derived frontend state and already-loaded checkpoint data.

**Scope:**
- Reuse existing history/control surface only
- Add compact collapse/expand controls for major existing history surface sections where relevant
- Affect presentation/visibility only for already-existing history UI sections
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep collapse state frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-81A through TASK-81Z and TASK-81-FINAL-CLOSE (all Complete and Locked); existing history/control surface already present

**Completion Summary:**
- ??Bounded collapse/expand control strip added inside existing `history-control-slice`
- ??Four collapsible sections: Controls, Summaries, Inspectors, Checkpoint Browser
- ??Session-scoped local state (`collapsedHistorySections`); resets to all-expanded on session change
- ??All existing Phase 81 history/control surfaces preserved and unchanged in behavior
- ??Scope confirmed frontend-only and additive; no backend, schema, endpoint, or refactor changes
- ??95/95 tests pass; 0 regressions (baseline 93; net +2)
- ??Checkpoint created: `docs/PHASE-82A-CHECKPOINT.md`

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82A for full details

---

#### TASK-82B: History Surface Quick Expand/Collapse All Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82B-CHECKPOINT.md`

**Objective:**
Make the history workflow faster to manage by adding bounded quick expand-all / collapse-all controls for the existing history surface sections, using only already-derived frontend state and already-loaded checkpoint data.

**Scope:**
- Reuse existing history/control surface only
- Build on existing section-collapse capability from TASK-82A
- Add compact expand-all / collapse-all controls for existing history sections
- Affect presentation/visibility only for already-existing history UI sections
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep controls frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A (Complete and Locked); existing `collapsedHistorySections` state already present

**Completion Summary:**
- ??Quick `Expand All` / `Collapse All` controls added inside existing `history-section-collapse-controls` strip
- ??Read-only collapsed-section count indicator (`Collapsed X/4 sections`) added
- ??Controls operate only on existing `collapsedHistorySections` frontend state from TASK-82A
- ??Session-scoped; resets to all-expanded on session change (inherited from TASK-82A)
- ??All Phase 81 and TASK-82A history/control surfaces preserved and unchanged in behavior
- ??Scope confirmed frontend-only and additive; no backend, schema, endpoint, or refactor changes
- ??95/95 tests pass; 0 regressions
- ??Checkpoint created: `docs/PHASE-82B-CHECKPOINT.md`

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82B for full details

---

#### TASK-82C: History Surface Collapsed-State Summary Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82C-CHECKPOINT.md`

**Objective:**
Make the collapsed history workflow easier to understand by adding a bounded compact read-only summary of currently collapsed/expanded sections inside the existing history/control surface, using only already-derived frontend state and already-loaded checkpoint data.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A and TASK-82B section-collapse state
- Add a compact read-only collapsed-state summary for existing history sections
- Show which major sections are currently collapsed/expanded
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the summary frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A/TASK-82B behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A and TASK-82B (Complete and Locked); existing `collapsedHistorySections` state already present

**Completion Summary:**
- ??Compact read-only per-section collapsed/expanded summary added inside existing `history-section-collapse-controls` strip
- ??Summary derives only from existing `collapsedHistorySections` frontend state (no new data sources)
- ??Four section state chips rendered: Controls, Summaries, Inspectors, Checkpoint Browser
- ??Active-session scoping preserved; resets on session change (inherited from TASK-82A)
- ??All Phase 81, TASK-82A, and TASK-82B history/control behaviors remain unchanged
- ??Scope confirmed frontend-only and additive; no backend, schema, endpoint, or refactor changes
- ??95/95 tests pass; 0 regressions
- ??Checkpoint created: `docs/PHASE-82C-CHECKPOINT.md`

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82C for full details

---

#### TASK-82D: History Surface Section Order Persistence Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82D-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to manage by adding bounded frontend-only section-order persistence within the active session for existing history surface sections, building on the section-collapse family without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82C section organization behavior
- Add bounded frontend-only persistence of the current section presentation order within the active session
- Affect presentation/order only for already-existing history UI sections
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep ordering state temporary and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A/TASK-82C behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A, TASK-82B, and TASK-82C (Complete and Locked); existing history/control surface already present

**Completion Evidence:**
- ??Bounded in-session section-order state added to `HistoryCheckpointList`; resets on `selectedSessionId` change
- ??`moveHistoryCollapsibleSectionOrderItem` helper added for bounded earlier/later moves
- ??Presentation-only section-order controls added inside existing `history-section-collapse-controls` surface
- ??Section-order uses only existing `collapsedHistorySections` and in-surface state; no new data sources
- ??Active-session scoping preserved; order resets on session change
- ??All Phase 81, TASK-82A, TASK-82B, and TASK-82C history/control behaviors remain unchanged
- ??Scope confirmed frontend-only and additive; no backend, schema, endpoint, refactor, fetch, polling, or websocket changes
- ??97/97 tests pass; 0 regressions
- ??Checkpoint created: `docs/PHASE-82D-CHECKPOINT.md`

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82D for full details

---

#### TASK-82E: History Surface Section Order Reset Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82E-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to recover from temporary layout changes by adding a bounded reset-to-default order control for existing history sections, building on the section-order family without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82D section organization behavior
- Add a compact reset-to-default order control for existing history sections
- Affect presentation/order only for already-existing history UI sections
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep reset behavior frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A/TASK-82D behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A, TASK-82B, TASK-82C, and TASK-82D (Complete and Locked); existing history/control surface already present

**Completion Evidence:**
- ??Compact reset-to-default section order control added inside existing `history-section-collapse-controls` surface
- ??`resetHistoryCollapsibleSectionOrderToDefault()` helper added for bounded default order return
- ??Reset control is disabled when order already matches default; enabled only after moves are applied
- ??Reset uses only existing in-session `historyCollapsibleSectionOrder` state; no new data sources, fetches, endpoints, polling, or websocket behavior
- ??Active-session scoping preserved; resets on session change (consistent with TASK-82A through TASK-82D)
- ??All Phase 81, TASK-82A, TASK-82B, TASK-82C, and TASK-82D history/control behaviors remain unchanged
- ??Scope confirmed frontend-only and additive; no backend, schema, endpoint, refactor, fetch, polling, or websocket changes
- ??98/98 tests pass; 0 regressions
- ??Checkpoint created: `docs/PHASE-82E-CHECKPOINT.md`

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82E for full details

---

#### TASK-82F: History Surface Section Visibility Preset Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82F-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to manage by adding bounded frontend-only section-visibility presets for the existing history surface, building on the section-collapse family without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82E section organization behavior
- Add compact visibility presets for existing history sections (e.g. overview-oriented and inspection-oriented presets)
- Affect presentation/visibility only for already-existing history UI sections
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep preset behavior frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A/TASK-82E behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions beyond explicit preset selection
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A, TASK-82B, TASK-82C, TASK-82D, and TASK-82E (Complete and Locked); existing history/control surface already present

**Completion Summary:**
- ??Bounded section-visibility preset controls added inside existing `history-section-collapse-controls` strip
- ??Two presets: `overview-oriented` (collapses Inspectors) and `inspection-oriented` (collapses Controls and Summaries)
- ??Active-preset indicator reports `Overview-Oriented`, `Inspection-Oriented`, or `Custom`
- ??Presets operate only on existing `collapsedHistorySections` frontend state from TASK-82A; session-scoped
- ??All Phase 81 and TASK-82A/TASK-82E history/control surfaces preserved and unchanged in behavior
- ??Scope confirmed frontend-only and additive; no backend, schema, endpoint, or refactor changes
- ??99/99 tests pass; 0 regressions (baseline 98; net +1)
- ??Checkpoint created: `docs/PHASE-82F-CHECKPOINT.md`

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82F for full details

---

#### TASK-82G: History Surface Preset Reset Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82G-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to recover from temporary preset changes by adding a bounded reset-to-default visibility preset control for the existing history surface, building on the section-visibility preset family without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82F section organization and preset behavior
- Add a compact reset-to-default visibility preset control
- Affect presentation/visibility only for already-existing history UI sections
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep reset behavior frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A/TASK-82F behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A, TASK-82B, TASK-82C, TASK-82D, TASK-82E, and TASK-82F (Complete and Locked); existing history/control surface already present

**Completion evidence:**
- ??Compact reset-to-default visibility preset control added inside `history-section-visibility-preset-controls`
- ??`getDefaultHistorySectionVisibilityPresetState()` helper exported; bounded to existing four section keys
- ??Active preset indicator updated: reports `Default`, `Overview-Oriented`, `Inspection-Oriented`, or `Custom`
- ??Reset button disabled when default visibility state is already active
- ??All changes wired only to existing in-session `collapsedHistorySections` state; no backend/fetch/durable changes
- ??All TASK-82A through TASK-82F controls and behaviors remain intact
- ??100/100 tests pass; 0 regressions (baseline 99; net +1)
- ??Checkpoint created: `docs/PHASE-82G-CHECKPOINT.md`

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82G for full details

---

#### TASK-82H: History Surface Section Visibility Status Summary Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82H-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to understand by adding a bounded read-only summary of the currently active section-visibility preset/state inside the existing history/control surface, building on TASK-82A through TASK-82G without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82G section organization and preset behavior
- Add a compact read-only summary of current section-visibility state
- Reflect presentation/visibility state only for already-existing history UI sections
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the summary frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A/TASK-82G behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A, TASK-82B, TASK-82C, TASK-82D, TASK-82E, TASK-82F, and TASK-82G (Complete and Locked); existing history/control surface already present

**Completion Summary:**
- ??Compact read-only `history-section-visibility-status-summary` added inside existing `history-section-collapse-controls` surface
- ??Summary reflects active preset label, visible section count, and collapsed section labels from existing in-session state
- ??All existing Phase 81 and TASK-82A through TASK-82G history/control behaviors preserved and unchanged
- ??Scope confirmed frontend-only and additive; no backend, schema, endpoint, or refactor changes
- ??100/100 tests pass; 0 regressions (baseline 100; no net change in count)
- ??Checkpoint created: `docs/PHASE-82H-CHECKPOINT.md`

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82H for full details

---

#### TASK-82I: History Surface Visibility Preset Description Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82I-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to understand by adding a bounded read-only explanation of the existing section-visibility presets inside the existing history/control surface, building on TASK-82A through TASK-82H without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82H section organization, preset behavior, and visibility-status summary behavior
- Add a compact read-only description of the existing visibility presets
- Explain only already-existing preset modes and their intended presentation focus
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the description frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A/TASK-82H behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A, TASK-82B, TASK-82C, TASK-82D, TASK-82E, TASK-82F, TASK-82G, and TASK-82H (Complete and Locked); existing history/control surface already present

**Completion notes:**
- ??Compact read-only `history-section-visibility-preset-description` added inside existing `history-section-collapse-controls` surface
- ??Description explains Overview-Oriented and Inspection-Oriented preset modes and their intended presentation focus using existing in-session state
- ??All existing Phase 81 and TASK-82A through TASK-82H history/control behaviors preserved and unchanged
- ??Scope confirmed frontend-only and additive; no backend, schema, endpoint, or refactor changes
- ??100/100 tests pass; 0 regressions (baseline 100; no net change in count)
- ??Checkpoint created: `docs/PHASE-82I-CHECKPOINT.md`

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82I for full details

---

#### TASK-82J: History Surface Hidden Sections Summary Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82J-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to understand by adding a bounded read-only summary of which existing history sections are currently hidden by the active visibility preset/state inside the existing history/control surface, building on TASK-82A through TASK-82I without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82I section organization, preset behavior, visibility-status summary behavior, and preset description behavior
- Add a compact read-only summary of currently hidden history sections
- Reflect visibility state only for already-existing history UI sections
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the summary frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A/TASK-82I behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A, TASK-82B, TASK-82C, TASK-82D, TASK-82E, TASK-82F, TASK-82G, TASK-82H, and TASK-82I (Complete and Locked); existing history/control surface already present

**Completion notes:**
- ??Compact read-only `history-section-hidden-sections-summary` added inside existing `history-section-collapse-controls` surface
- ??Summary reports which already-existing history sections are currently hidden using existing in-session collapsed-section state
- ??All existing Phase 81 and TASK-82A through TASK-82I history/control behaviors preserved and unchanged
- ??Scope confirmed frontend-only and additive; no backend, schema, endpoint, or refactor changes
- ??100/100 tests pass; 0 regressions (baseline 100; no net change in count)
- ??Checkpoint created: `docs/PHASE-82J-CHECKPOINT.md`

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82J for full details

---

#### TASK-82K: History Surface Visible Sections Summary Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82K-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to scan by adding a bounded read-only summary of which existing history sections are currently visible in the active section-visibility preset/state inside the existing history/control surface, building on TASK-82A through TASK-82J without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82J section organization, preset behavior, visibility-status summary behavior, preset description behavior, and hidden-sections summary behavior
- Add a compact read-only summary of currently visible history sections
- Reflect visibility state only for already-existing history UI sections
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the summary frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A/TASK-82J behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A, TASK-82B, TASK-82C, TASK-82D, TASK-82E, TASK-82F, TASK-82G, TASK-82H, TASK-82I, and TASK-82J (Complete and Locked); existing history/control surface already present

**Completion notes:**
- ??Compact read-only `history-section-visible-sections-summary` added inside existing `history-section-collapse-controls` surface
- ??Summary reports which already-existing history sections are currently visible using existing in-session collapsed-section state
- ??All existing Phase 81 and TASK-82A through TASK-82J history/control behaviors preserved and unchanged
- ??Scope confirmed frontend-only and additive; no backend, schema, endpoint, or refactor changes
- ??100/100 tests pass; 0 regressions (baseline 100; no net change in count)
- ??Checkpoint created: `docs/PHASE-82K-CHECKPOINT.md`

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82K for full details

---

#### TASK-82L: History Surface Preset Match Status Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82L-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to understand by adding a bounded read-only indication of whether the current section-visibility state still matches one of the existing presets inside the existing history/control surface, building on TASK-82A through TASK-82K without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82K section organization, preset behavior, visibility summaries, and preset description behavior
- Add a compact read-only preset-match status indicator
- Indicate only whether the current visibility state matches an already-existing preset or has diverged into a custom/in-between state
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the indicator frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A/TASK-82K behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A, TASK-82B, TASK-82C, TASK-82D, TASK-82E, TASK-82F, TASK-82G, TASK-82H, TASK-82I, TASK-82J, and TASK-82K (Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82L for full details

---

#### TASK-82M: History Surface Visibility Delta Summary Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82M-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to interpret by adding a bounded read-only summary of how the current section-visibility state differs from the nearest existing preset inside the existing history/control surface, building on TASK-82A through TASK-82L without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82L section organization, preset behavior, visibility summaries, preset description behavior, and preset-match status behavior
- Add a compact read-only summary of the current visibility delta relative to an already-existing preset when applicable
- Reflect only already-existing history UI sections and already-existing presets
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the summary frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A/TASK-82L behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A through TASK-82L (Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82M for full details

---

#### TASK-82N: History Surface Preset Comparison Baseline Label Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82N-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to read by adding a bounded read-only label that identifies which existing preset is currently being used as the comparison baseline for visibility-status interpretation inside the existing history/control surface, building on TASK-82A through TASK-82M without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82M section organization, preset behavior, visibility summaries, preset description behavior, preset-match status behavior, and visibility-delta summary behavior
- Add a compact read-only comparison-baseline label
- Identify only an already-existing preset already implied by the current frontend visibility interpretation
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the label frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A/TASK-82M behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A through TASK-82M (Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82N for full details

---

#### TASK-82O: History Surface Preset Match Explanation Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82O-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to understand by adding a bounded read-only explanation of why the current section-visibility state is considered an exact preset match or a custom/diverged state inside the existing history/control surface, building on TASK-82A through TASK-82N without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82N section organization, preset behavior, visibility summaries, preset interpretation behavior, and comparison-baseline labeling
- Add a compact read-only preset-match explanation
- Explain only already-existing preset/state interpretation already implied by current frontend visibility logic
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the explanation frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A/TASK-82N behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A through TASK-82N (Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82O for full details

---

#### TASK-82P: History Surface Visibility State Consistency Note Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82P-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to trust by adding a bounded read-only note that confirms the currently displayed visibility summaries and preset interpretation are all based on the same active in-session section-visibility state inside the existing history/control surface, building on TASK-82A through TASK-82O without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82O section organization, preset behavior, visibility summaries, preset interpretation behavior, comparison-baseline labeling, and preset-match explanation behavior
- Add a compact read-only consistency note
- Describe only already-existing frontend visibility interpretation and summary state
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the note frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A/TASK-82O behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A through TASK-82O (Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82P for full details

---

#### TASK-82Q: History Surface Visibility Summary Group Label Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82Q-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to scan by adding a bounded read-only group label for the existing visibility-related summaries inside the existing history/control surface, building on TASK-82A through TASK-82P without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82P section organization, preset behavior, visibility summaries, preset interpretation behavior, comparison-baseline labeling, preset-match explanation behavior, and consistency-note behavior
- Add a compact read-only group label for the existing visibility-related summaries
- Group only already-existing visibility/preset interpretation summaries already present in the frontend
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the group label frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A through TASK-82P behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A through TASK-82P (Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82Q for full details

---

#### TASK-82R: History Surface Visibility Summary Order Label Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82R-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to scan by adding a bounded read-only label that clarifies the interpretation order of the existing visibility-related summaries inside the existing history/control surface, building on TASK-82A through TASK-82Q without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82Q section organization, preset behavior, visibility summaries, preset interpretation behavior, comparison-baseline labeling, preset-match explanation behavior, consistency-note behavior, and visibility-summary grouping behavior
- Add a compact read-only order label for the existing visibility-related summaries
- Clarify only the reading/interpretation order of already-existing summaries already present in the frontend
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the order label frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A through TASK-82Q behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A through TASK-82Q (Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82R for full details

---

#### TASK-82S: History Surface Visibility Summary Scope Label Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82S-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to understand by adding a bounded read-only label that clarifies the scope of the existing visibility-related summaries inside the existing history/control surface, building on TASK-82A through TASK-82R without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82R section organization, preset behavior, visibility summaries, preset interpretation behavior, comparison-baseline labeling, preset-match explanation behavior, consistency-note behavior, visibility-summary grouping behavior, and visibility-summary order labeling
- Add a compact read-only scope label for the existing visibility-related summaries
- Clarify only the scope of already-existing summaries already present in the frontend
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the scope label frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A through TASK-82R behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A through TASK-82R (Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82S for full details

---

#### TASK-82T: History Surface Visibility Summary Audience Label Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82T-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to understand by adding a bounded read-only label that clarifies who the existing visibility-related summaries are for inside the existing history/control surface, building on TASK-82A through TASK-82S without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82S section organization, preset behavior, visibility summaries, preset interpretation behavior, comparison-baseline labeling, preset-match explanation behavior, consistency-note behavior, visibility-summary grouping behavior, visibility-summary order labeling, and visibility-summary scope labeling
- Add a compact read-only audience label for the existing visibility-related summaries
- Clarify only the audience/usage framing of already-existing summaries already present in the frontend
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the audience label frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A through TASK-82S behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A through TASK-82S (Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82T for full details

---

#### TASK-82U: History Surface Visibility Summary Brevity Label Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82U-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to scan by adding a bounded read-only label that clarifies the concise nature of the existing visibility-related summaries inside the existing history/control surface, building on TASK-82A through TASK-82T without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82T section organization, preset behavior, visibility summaries, preset interpretation behavior, comparison-baseline labeling, preset-match explanation behavior, consistency-note behavior, visibility-summary grouping behavior, visibility-summary order labeling, visibility-summary scope labeling, and visibility-summary audience labeling
- Add a compact read-only brevity label for the existing visibility-related summaries
- Clarify only the concise/at-a-glance nature of already-existing summaries already present in the frontend
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the brevity label frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A through TASK-82T behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A through TASK-82T (Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82U for full details

---

#### TASK-82V: History Surface Visibility Summary Placement Label Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82V-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to scan by adding a bounded read-only label that clarifies the intended placement role of the existing visibility-related summaries inside the existing history/control surface, building on TASK-82A through TASK-82U without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82U section organization, preset behavior, visibility summaries, preset interpretation behavior, comparison-baseline labeling, preset-match explanation behavior, consistency-note behavior, visibility-summary grouping behavior, visibility-summary order labeling, visibility-summary scope labeling, visibility-summary audience labeling, and visibility-summary brevity labeling
- Add a compact read-only placement label for the existing visibility-related summaries
- Clarify only the intended placement/presentation role of already-existing summaries already present in the frontend
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the placement label frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A through TASK-82U behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A through TASK-82U (Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82V for full details

---

#### TASK-82W: History Surface Visibility Summary Context Label Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82W-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to scan by adding a bounded read-only label that clarifies the contextual purpose of the existing visibility-related summaries inside the existing history/control surface, building on TASK-82A through TASK-82V without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82V section organization, preset behavior, visibility summaries, preset interpretation behavior, comparison-baseline labeling, preset-match explanation behavior, consistency-note behavior, visibility-summary grouping behavior, visibility-summary order labeling, visibility-summary scope labeling, visibility-summary audience labeling, visibility-summary brevity labeling, and visibility-summary placement labeling
- Add a compact read-only context label for the existing visibility-related summaries
- Clarify only the contextual purpose of already-existing summaries already present in the frontend
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the context label frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A through TASK-82V behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A through TASK-82V (Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82W for full details

---

#### TASK-82X: History Surface Visibility Summary Intent Label Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-82X-CHECKPOINT.md`

**Objective:**
Make the history workflow easier to scan by adding a bounded read-only label that clarifies the intended use/intent of the existing visibility-related summaries inside the existing history/control surface, building on TASK-82A through TASK-82W without changing underlying behavior.

**Scope:**
- Reuse existing history/control surface only
- Build on TASK-82A through TASK-82W section organization, preset behavior, visibility summaries, preset interpretation behavior, comparison-baseline labeling, preset-match explanation behavior, consistency-note behavior, visibility-summary grouping behavior, visibility-summary order labeling, visibility-summary scope labeling, visibility-summary audience labeling, visibility-summary brevity labeling, visibility-summary placement labeling, and visibility-summary context labeling
- Add a compact read-only intent label for the existing visibility-related summaries
- Clarify only the intended use/intent of already-existing summaries already present in the frontend
- Use only already-derived frontend state and already-loaded checkpoint data
- Keep all existing history actions and behaviors unchanged
- Keep the intent label frontend-only, temporary, and active-session scoped
- Preserve all closed Phase 81 history/control capabilities and TASK-82A through TASK-82W behavior
- Frontend-only, additive only

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No automatic actions
- ??No durable state outside current session
- ??No broader redesign
- ??No polling/websocket behavior
- ??No multi-task work

**Dependencies:** TASK-82A through TASK-82W (Complete and Locked); existing history/control surface already present

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-82X for full details

---

## Phase 83 ??Config Surface and UX Fixes

**Current stage:** TASK-83F (COMPLETE and LOCKED)

---

#### TASK-83A: Config Modal Close/Dismiss Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-83A-CHECKPOINT.md`

**Objective:**
Fix the real UX bug where the Config popup can open from the existing frontend but cannot be cleanly dismissed, by adding bounded close/dismiss behavior without changing unrelated product behavior.

**Scope:**
- Reuse the existing Config popup/modal only
- Fix dismiss/close behavior for the existing Config surface
- Support at least one clear user-controlled close path
- Preserve existing modal content and existing config-related behavior
- Keep the fix frontend-only and additive
- Keep the change bounded to the existing modal/dialog behavior
- Preserve all closed Phase 81 and Phase 82 behavior
- Do not expand into unrelated configuration redesign

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No redesign of the config surface
- ??No unrelated modal cleanup
- ??No multi-task work

**Dependencies:** Phase 81 and Phase 82 (Complete and Locked); existing Config popup present in frontend

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-83A for full details

---

#### TASK-83B: Top-Right Control Overlap Layout Fix Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-83B-CHECKPOINT.md`

**Objective:**
Fix the real UX bug where the top-right control cluster on authenticated frontend pages allows Config and System Ready controls to overlap/block nearby buttons and information, by applying a bounded layout fix without redesigning the surface or changing unrelated behavior.

**Scope:**
- Reuse the existing authenticated page top-right control area only
- Fix overlap/blocking behavior involving Config and System Ready controls
- Ensure nearby top-right buttons and information remain visible and reachable
- Preserve existing control behavior and existing content
- Keep the fix frontend-only and additive
- Keep the change bounded to layout/stacking/spacing behavior of the current top-right cluster
- Preserve all closed Phase 81 and Phase 82 behavior and completed Phase 83A behavior
- Do not expand into unrelated header redesign

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new endpoints
- ??No redesign of the authenticated page shell
- ??No unrelated responsive cleanup
- ??No multi-task work

**Dependencies:** Phase 81, Phase 82 (Complete and Locked); TASK-83A (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-83B for full details

---

#### TASK-83D: Driver Execution Result Surfacing Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, BOUNDED)
**Checkpoint:** `docs/PHASE-83D-CHECKPOINT.md`

**Objective:**
Fix the real frontend UX gap where the existing `/en/driver` page can submit an execution request but does not surface the final execution result clearly to the user, by applying the smallest bounded result-state/UI fix without redesigning the route or changing unrelated behavior.

**Scope:**
- Reuse the existing `/en/driver` page only
- Preserve the current execute request flow
- Improve result surfacing/retrieval for the existing execution flow
- Address the current UX gap where the page remains at queued and refresh clears visible output
- Keep the fix frontend-only and tightly bounded
- Preserve all closed Phase 81 and Phase 82 behavior and completed Phase 83A/83B behavior
- Do not expand into unrelated driver redesign

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new product surface
- ??No unrelated polling architecture redesign
- ??No multi-task work

**Dependencies:** Phase 81, Phase 82 (Complete and Locked); TASK-83A, TASK-83B (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-83D for full details

---

#### TASK-83E: Driver Rate-Limit Explanation Clarity Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, BOUNDED)
**Checkpoint:** `docs/PHASE-83E-CHECKPOINT.md`

**Objective:**
Improve the `/en/driver` UX when a rate-limit/quota error occurs by clarifying the meaning of the current error state, especially when visible token balance remains, without changing backend enforcement behavior or redesigning the route.

**Scope:**
- Reuse the existing `/en/driver` page only
- Preserve the current execute flow and current error handling flow
- Improve user-facing explanation/clarity around the current quota/rate-limit error state
- Address the current confusion where users can see remaining tokens but still receive a quota/rate-limit failure
- Keep the fix frontend-only and tightly bounded
- Preserve all closed Phase 81 and Phase 82 behavior and completed Phase 83A/83B/83D behavior
- Do not expand into unrelated driver redesign

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No new quota system
- ??No unrelated polling redesign
- ??No multi-task work

**Dependencies:** Phase 81, Phase 82 (Complete and Locked); TASK-83A, TASK-83B, TASK-83D (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-83E for full details

---

#### TASK-83F: Session Stop/Remove Sidebar Action Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (BOUNDED UX / SESSION LIFECYCLE)
**Checkpoint:** `docs/PHASE-83F-CHECKPOINT.md`

**Objective:**
Improve `/en/app` session management by adding bounded sidebar actions that let users clean up unusable sessions safely, without silently destroying checkpoint history or redesigning the workspace shell.

**Scope:**
- Reuse the existing `/en/app` left session sidebar only
- Add a Stop action for active/usable sessions using an existing safe stop/terminate path
- Add a Remove action only for expired or terminated/unusable sessions
- Remove only removes already-unusable sessions from the visible list (existing safe backend delete path, or bounded frontend hide path if deletion is not safe)
- Preserve checkpoint/history behavior ??do not silently destroy history
- If the currently selected session is stopped/removed, auto-switch to another usable session or clear selection cleanly
- Keep change bounded to session list actions and session-list refresh/update behavior
- Preserve all closed Phase 81 and Phase 82 behavior and completed Phase 83 behavior

**Non-Goals:**
- ??No session-management redesign
- ??No backend schema changes
- ??No refactors
- ??No new quota system
- ??No destructive delete of active usable sessions
- ??No silent history deletion
- ??No multi-task work

**Dependencies:** Phase 81, Phase 82 (Complete and Locked); TASK-83A, TASK-83B, TASK-83D, TASK-83E (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-83F for full details

---

## Phase 84 ??Workspace Chat Panel

**Current stage:** TASK-84G (COMPLETE and LOCKED)

---

#### TASK-84A: Workspace Chat Panel ??Basic Prompt Submit and Response Surface Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-84A-CHECKPOINT.md`

**Objective:**
Turn the current `/en/app` Chat Panel from a placeholder/exec-labeled surface into a bounded real AI prompt/response experience by wiring a basic natural-language prompt input and response display to the existing backend AI execution flow, without redesigning the workspace shell or changing backend behavior.

**Scope:**
- Reuse the existing `/en/app` Chat Panel area only
- Add a bounded natural-language prompt input for AI requests
- Submit prompts to the already-existing AI execution path
- Surface returned assistant response text in the Chat Panel
- Keep the slice minimal: single prompt submit + response display
- Preserve the existing exec panel behavior unless explicitly separated visually within the same shell
- Keep the change frontend-only and tightly scoped
- Preserve all closed Phase 81, Phase 82, and Phase 83 behavior
- Do not expand into full chat-product redesign yet

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No multi-conversation redesign
- ??No full chat-history persistence redesign
- ??No model/provider settings redesign
- ??No streaming redesign unless already trivially available from the current frontend path
- ??No multi-task work

**Dependencies:** Phase 81, Phase 82 (Complete and Locked); Phase 83 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-84A for full details

---

#### TASK-84B: Workspace Chat Panel Message Thread Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-84B-CHECKPOINT.md`

**Objective:**
Extend the working `/en/app` Chat Panel from a single prompt/response surface into a bounded user/assistant message thread, without redesigning the workspace shell or changing backend behavior.

**Scope:**
- Reuse the existing `/en/app` Chat Panel only
- Preserve the working TASK-84A prompt submit + response flow
- Add a simple visible message thread in the Chat Panel
- Show at least user prompt entries and assistant response entries
- Keep the thread bounded to the current in-panel experience
- Keep the change frontend-only and tightly scoped
- Preserve all closed Phase 81, Phase 82, Phase 83, and Phase 84A behavior
- Do not expand into full conversation persistence redesign yet

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No multi-session conversation redesign
- ??No streaming redesign beyond existing behavior
- ??No model/provider settings redesign
- ??No multi-task work

**Dependencies:** Phase 81, Phase 82 (Complete and Locked); Phase 83 (Complete and Locked); TASK-84A (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-84B for full details

---

#### TASK-84C: Workspace Chat Panel Quota Error Clarity Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-84C-CHECKPOINT.md`

**Objective:**
Improve `/en/app` Chat Panel UX when chat execution is blocked by quota/rate-limit errors, by replacing the raw assistant-side failure string with clearer user-facing guidance while preserving the current thread behavior.

**Scope:**
- Reuse the existing `/en/app` Chat Panel only
- Preserve the working TASK-84A/84B prompt submit and message thread flow
- Improve user-facing rendering of quota/rate-limit failures in the assistant message area
- Keep earlier messages intact
- Keep the change frontend-only and tightly scoped
- Preserve all completed Phase 83 and Phase 84 behavior
- Do not expand into broader quota redesign

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No model/provider redesign
- ??No conversation persistence redesign
- ??No multi-task work

**Dependencies:** Phase 81, Phase 82 (Complete and Locked); Phase 83 (Complete and Locked); TASK-84A, TASK-84B (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-84C for full details

---

#### TASK-84D: Chat Panel Final Response Persistence and Error De-dup Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-84D-CHECKPOINT.md`

**Objective:**
Fix the remaining `/en/app` Chat Panel message-thread issues where a valid assistant reply is overwritten by final "no response text" completion handling, and quota/error messages can be duplicated in the thread, without redesigning the chat surface or changing backend behavior.

**Scope:**
- Reuse the existing `/en/app` Chat Panel only
- Preserve the working TASK-84A/84B/84C prompt submit, thread, and error-clarity flow
- Ensure streamed/received assistant reply text persists after completion
- Prevent duplicated assistant-side quota/error messages in the thread
- Keep the change frontend-only and tightly scoped
- Preserve all completed Phase 83 and Phase 84 behavior
- Do not expand into broader chat redesign

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No conversation persistence redesign
- ??No streaming redesign beyond fixing current frontend handling
- ??No multi-task work

**Dependencies:** Phase 81, Phase 82 (Complete and Locked); Phase 83 (Complete and Locked); TASK-84A, TASK-84B, TASK-84C (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-84D for full details

---

#### TASK-84E: Workspace Chat Panel Refresh Persistence Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-84E-CHECKPOINT.md`

**Objective:**
Improve `/en/app` Chat Panel UX by making the current chat thread persist across page refresh for the active workspace session, without redesigning the chat surface or changing backend behavior.

**Scope:**
- Reuse the existing `/en/app` Chat Panel only
- Preserve the working TASK-84A/84B/84C/84D prompt submit, response, thread, and error-handling flow
- Persist the current chat thread across refresh
- Keep persistence scoped to the active workspace session
- Restore the thread cleanly after refresh
- Clear or switch cleanly when the active session changes
- Keep the change frontend-only and tightly scoped
- Preserve all completed Phase 83 and Phase 84 behavior
- Do not expand into full conversation-history redesign yet

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No multi-session conversation redesign
- ??No long-term/global chat history system
- ??No cross-device sync
- ??No model/provider settings redesign
- ??No multi-task work

**Dependencies:** Phase 81, Phase 82 (Complete and Locked); Phase 83 (Complete and Locked); TASK-84A, TASK-84B, TASK-84C, TASK-84D (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-84E for full details

---

#### TASK-84F: Chat Panel Session Input Reset and Live Response De-dup Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (FRONTEND ONLY, ADDITIVE)
**Checkpoint:** `docs/PHASE-84F-CHECKPOINT.md`

**Objective:**
Fix the remaining `/en/app` Chat Panel session-state/render issues where unsent prompt text carries into a new session and long assistant responses can render twice during live update flow, without redesigning the chat surface or changing backend behavior.

**Scope:**
- Reuse the existing `/en/app` Chat Panel only
- Clear/reset AI Prompt input on new-session creation and session switch
- Prevent duplicate live rendering of the same assistant response content
- Preserve the working TASK-84A??4E submit, thread, error, and refresh-persistence flow
- Keep the change frontend-only and tightly scoped
- Preserve all completed Phase 83 and Phase 84 behavior
- Do not expand into broader chat redesign

**Non-Goals:**
- ??No backend changes
- ??No schema changes
- ??No refactors
- ??No conversation persistence redesign
- ??No model/provider redesign
- ??No multi-task work

**Dependencies:** Phase 81, Phase 82 (Complete and Locked); Phase 83 (Complete and Locked); TASK-84A, TASK-84B, TASK-84C, TASK-84D, TASK-84E (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-84F for full details

---

#### TASK-84G: Workspace Route Auth Gate Slice

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (AUTH GATING / FRONTEND-FIRST)
**Checkpoint:** `docs/PHASE-84G-CHECKPOINT.md`

**Objective:**
Fix the real product/auth gap where unauthenticated users can still enter `/en/app` and see the workspace shell before hitting HTTP_401 inside it, by applying a bounded auth gate so the workspace route behaves correctly for logged-out users.

**Scope:**
- Reuse the existing `/en/app` route only
- Prevent unauthenticated users from entering the workspace shell normally
- Prefer redirect to login or a dedicated auth-required gate before workspace bootstrap begins
- Avoid exposing protected workspace UI/state to logged-out users
- Keep the change bounded to auth gating for the workspace route and its immediate shell bootstrap
- Preserve current authenticated workspace behavior
- Preserve all completed Phase 83 and Phase 84 behavior for logged-in users

**Non-Goals:**
- ??No backend changes unless strictly required
- ??No schema changes
- ??No refactors
- ??No login flow redesign
- ??No broad auth architecture redesign
- ??No multi-task work

**Dependencies:** Phase 81, Phase 82 (Complete and Locked); Phase 83 (Complete and Locked); TASK-84A through TASK-84F (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??TASK-84G for full details

---

## AI-03 ??AI-to-Workspace Actions (Core Product Loop)

**Current stage:** AI-03-02 (COMPLETE and LOCKED)
**Family status:** COMPLETE and LOCKED ??All bounded spec tasks complete (AI-03-01A/B/C, AI-03-02).

---

#### AI-03-01: AI-to-Workspace File Actions ??Umbrella Parent

**Status:** COMPLETE and LOCKED
**Nature:** UMBRELLA WORK FAMILY (CORE PRODUCT LOOP)

AI-03-01 was completed through its three bounded child slices (AI-03-01A, AI-03-01B, AI-03-01C). Post-action workspace coherence was completed separately in AI-03-02.

**Child slices:**
- AI-03-01A ??Backend File-Action Output Pipeline (COMPLETE and LOCKED)
- AI-03-01B ??Frontend File-Action Application (COMPLETE and LOCKED)
- AI-03-01C ??Frontend Chat File-Action Result Surfacing (COMPLETE and LOCKED)

**Dependencies:** Phase 84 (Complete and Locked); AI execution pipeline (operational); workspace file system (operational)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??AI-03-01 for full details; `docs/specs/AI-03-01-ai-to-workspace-file-actions.md` for spec

---

#### AI-03-01A: Backend File-Action Output Pipeline

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (CORE PRODUCT LOOP, BACKEND FIRST SLICE)
**Checkpoint:** `docs/AI-03-01A-CHECKPOINT.md`

**Objective:**
Implement the first backend slice of AI-03-01 so AI execution can produce structured file-action instructions, validate them, and expose them through both the execution stream and the durable execution result/status path, without yet applying any file writes to the workspace.

**Why this exists:**
Before frontend can apply AI file actions safely, the backend must produce a reliable structured file-action payload. This slice establishes the contract and dual-channel delivery path needed for later slices while preserving existing text-response behavior.

**Scope:**
- Define structured file-action contract for AI execution output
- Modify AI execution flow so model output can include parseable file-action instructions
- Parse file-action instructions from AI output
- Preserve pure text response separately from file-action payload
- Validate file paths and reject traversal / invalid paths
- Publish structured file-actions in execution stream events
- Expose structured fileActions through the durable execution result/status path used by GET /api/ai/executions/:id
- Keep non-file-action prompts working normally with empty fileActions
- Keep existing submit / poll / stream / cancel behavior intact

**Non-Goals:**
- ??No file writes to workspace
- ??No frontend behavioral changes beyond minimal type compatibility if absolutely required
- ??No file tree refresh, editor reload, preview refresh, auto-checkpoint
- ??No chat result rendering changes
- ??No multi-step orchestration
- ??No shell-first behavior
- ??No agent framework
- ??No schema redesign unless a tiny bounded persistence change is strictly required
- ??No quota / billing / auth redesign

**Dependencies:** Phase 84 (Complete and Locked); AI execution pipeline (operational)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??AI-03-01A for full details; `docs/specs/AI-03-01-ai-to-workspace-file-actions.md` for parent spec

---

#### AI-03-01B: Frontend File-Action Application

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (CORE PRODUCT LOOP, FRONTEND SIDE-EFFECT SLICE)
**Checkpoint:** `docs/AI-03-01B-CHECKPOINT.md`

**Objective:**
Implement the second slice of AI-03-01 so the frontend can consume backend fileActions from either the execution stream or the durable execution status path, and apply those file actions exactly once to the active session workspace using the existing workspace file write path.

**Why this exists:**
AI-03-01A established the backend fileActions contract and dual-channel delivery. AI-03-01B is the first slice that causes real workspace side effects. It must apply file actions safely, exactly once per execution, without yet doing broader workspace coherence or chat-result rendering.

**Scope:**
- Consume fileActions from stream event path and GET /api/ai/executions/:id fallback path
- Store fileActions per execution in frontend state
- Apply file actions exactly once per execution ID
- Use existing workspace file write capability only
- Apply file actions sequentially for the first slice
- Enforce active-session guard
- Enforce stale-session guard
- Enforce terminated-session guard
- Collect structured per-file success/failure results in frontend state for later slices
- Preserve existing chat submit / stream / poll / cancel behavior

**Non-Goals:**
- ??No chat result rendering changes
- ??No file tree refresh, editor reload, preview refresh, auto-checkpoint
- ??No AI-03-02 behavior
- ??No backend file-action contract redesign
- ??No new product endpoints
- ??No shell-first behavior
- ??No agent framework
- ??No retry framework beyond current minimal behavior
- ??No quota / billing / auth redesign

**Dependencies:** AI-03-01A (COMPLETE and LOCKED); Phase 84 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??AI-03-01B for full details; `docs/specs/AI-03-01-ai-to-workspace-file-actions.md` for parent spec

---

#### AI-03-01C: Frontend Chat File-Action Result Surfacing

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (CORE PRODUCT LOOP, FRONTEND RESULT-SURFACING SLICE)
**Checkpoint:** `docs/AI-03-01C-CHECKPOINT.md`

**Objective:**
Implement the third slice of AI-03-01 so the chat thread surfaces the structured per-file success/failure results produced by AI-03-01B, making AI file changes visible to the user without yet introducing broader workspace coherence behavior.

**Why this exists:**
AI-03-01A established the backend fileActions contract. AI-03-01B safely applied file actions and stored structured per-file results in frontend state. AI-03-01C completes AI-03-01 by making those results visible in the existing assistant message thread, while keeping file tree refresh, editor reload, preview refresh, and auto-checkpoint in AI-03-02.

**Scope:**
- Surface structured per-file file-action results inside the existing assistant chat thread entry
- Show per-file action + path + success/failure state
- Show per-file error message when a write failed
- Show appropriate message when application was skipped due to stale-session or terminated-session guard
- Preserve text-only responses when no file actions exist
- Keep structured file-action result data compatible with existing chat persistence (Phase 84E localStorage)
- Preserve existing chat submit / stream / poll / cancel behavior

**Non-Goals:**
- ??No file tree refresh, editor reload, preview refresh, auto-checkpoint
- ??No AI-03-02 behavior
- ??No backend contract or file write behavior redesign
- ??No new product endpoints
- ??No diff viewer in chat
- ??No clickable file navigation beyond current surface
- ??No chat layout redesign
- ??No quota / billing / auth redesign

**Dependencies:** AI-03-01B (COMPLETE and LOCKED); Phase 84 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??AI-03-01C for full details; `docs/specs/AI-03-01-ai-to-workspace-file-actions.md` for parent spec

---

#### AI-03-02: Post-AI-Action Workspace Coherence

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (CORE PRODUCT LOOP, POST-ACTION COHERENCE)
**Checkpoint:** `docs/AI-03-02-CHECKPOINT.md`

**Objective:**
After AI file actions complete, update the workspace surfaces coherently using existing request-driven patterns: file tree refresh, active-file editor reload when affected, preview refresh, auto-checkpoint creation through the existing commit path, and checkpoint-list refresh.

**Why this exists:**
AI-03-01 completed the minimal AI file-action loop. AI-03-02 makes the workspace reflect those AI changes coherently without introducing polling, watchers, websocket orchestration, or broader checkpoint redesign.

**Scope:**
- Trigger file tree refresh after AI file actions complete using existing file-tree loading pattern
- Reload editor content if the currently selected file was affected
- Trigger preview refresh using existing preview refresh path
- Auto-create checkpoint using existing `POST /api/git/:sessionId/commit` path
- Use simple AI-oriented checkpoint description string only
- Refresh checkpoint list after successful AI-triggered checkpoint creation
- Keep all refresh behavior request-driven only
- Reuse existing stale-request guard patterns where applicable

**Non-Goals:**
- ??No polling
- ??No filesystem watchers
- ??No websocket push coherence layer
- ??No richer checkpoint metadata
- ??No checkpoint schema redesign
- ??No AI orchestration / agent framework
- ??No project persistence work
- ??No backend chat persistence work
- ??No quota / billing / auth redesign
- ??No shell-first behavior
- ??No broad workspace redesign

**Dependencies:** AI-03-01C (COMPLETE and LOCKED); Phase 79/80 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??AI-03-02 for full details; `docs/specs/AI-03-02-post-ai-workspace-coherence.md` for spec

---

## AI-05 ??AI File-Action Diagnostics

**Family status:** ACTIVE

**Current stage:** AI-05-02 (COMPLETE and LOCKED)

---

#### AI-05-01: Diagnose AI File Creation Failure Path

**Status:** COMPLETE and LOCKED
**Nature:** BUG INVESTIGATION (CORE PRODUCT LOOP, AI-TO-WORKSPACE FAILURE)
**Checkpoint:** `docs/AI-05-01-CHECKPOINT.md`

**Objective:**
Trace why the AI says it cannot create a file, despite the existing AI-to-workspace file-action system, and isolate the exact failing stage in the end-to-end path.

**Scope:**
- Trace the end-to-end path for a real file-creation request
- Inspect provider/model selection and prompt path
- Inspect raw AI response shape
- Inspect backend file-action parsing result
- Inspect stream/completion payload for fileActions
- Inspect frontend file-action apply state/result
- Inspect any session/stale/terminated guard that may skip writes
- Identify and document the exact failing stage clearly

**Out of scope:**
- ??No broad AI system redesign
- ??No file-action contract redesign
- ??No UX polish work
- ??No scope expansion
- ??No feature work

**Acceptance criteria:**
- Exact failing stage identified clearly
- Evidence documented across backend/frontend boundaries
- Issue narrowed enough for a single bounded follow-up fix task

**Dependencies:** AI-03 (Complete and Locked), AI-04 (Complete and Locked)

---

#### AI-05-02: Strengthen File Action Output Contract For Normal File Creation Prompts

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (CORE PRODUCT LOOP, MODEL OUTPUT CONTRACT)
**Checkpoint:** `docs/AI-05-02-CHECKPOINT.md`

**Objective:**
Make normal file-creation prompts reliably produce valid file-action output so the existing parser, stream, persistence, and frontend apply path can actually create files during ordinary usage.

**Scope:**
- Inspect the current system/execution prompt instructions for file-action generation
- Strengthen the model output contract so ordinary file-create requests emit valid fenced file-actions JSON by default
- Preserve plain conversational behavior for non-file tasks
- Preserve the existing file-action parser/contract shape unless a tiny wording-alignment change is absolutely required
- Verify with real file-create prompts that non-empty fileActions are produced through the existing path

**Out of scope:**
- ??No parser redesign
- ??No frontend apply redesign
- ??No broad orchestration redesign
- ??No provider marketplace/model redesign
- ??No scope expansion

**Acceptance criteria:**
- Ordinary file-create prompts produce valid non-empty fileActions through the normal execution path
- Non-file prompts still behave normally
- Existing parser/stream/persistence/frontend flow remains intact
- Fix is documented in `docs/AI-05-02-CHECKPOINT.md`

**Dependencies:** AI-05-01 (COMPLETE and LOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??AI-05-02 for full details

---

## PREV-01 ??Preview Availability Diagnostics

**Family status:** COMPLETE and LOCKED

**Current stage:** none active (PREV-01 wave complete)

**Completed tasks:** PREV-01-01, PREV-01-02, PREV-01-03 ??all COMPLETE and LOCKED.

**Final checkpoint:** `docs/PREV-01-FINAL-CHECKPOINT.md`

---

#### PREV-01-01: Diagnose Preview Unavailable For AI-Created Files

**Status:** COMPLETE and LOCKED
**Nature:** BUG INVESTIGATION (PREVIEW PATH, CORE WORKSPACE USABILITY)
**Checkpoint:** `docs/PREV-01-01-CHECKPOINT.md`

**Objective:**
Determine why preview remains unavailable after AI creates files, and isolate whether preview correctly requires a running dev server or is failing to detect/serve a valid previewable output.

**Scope:**
- Inspect preview availability/status path
- Inspect what conditions mark a session as previewable
- Inspect whether static HTML files should be previewable or whether a dev server is always required
- Inspect preview status endpoint behavior for the real failing scenario
- Identify the exact failing/expected stage and document it clearly
- No fix in this task unless a trivially obvious diagnostic correction is absolutely required

**Out of scope:**
- ??No preview redesign
- ??No frontend redesign
- ??No broad workspace redesign
- ??No scope expansion
- ??No feature work

**Acceptance criteria:**
- Exact preview gating/availability condition is identified clearly
- Exact reason the real scenario showed "Preview unavailable" is documented
- Issue is narrowed enough for one bounded follow-up fix task, or clearly confirmed as expected behavior
- No unrelated work is mixed into this task

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PREV-01-01 for full details

---

#### PREV-01-02: Fix Preview Start Source Of Truth For Session Workspace

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (PREVIEW PATH, WORKSPACE SOURCE-OF-TRUTH)
**Checkpoint:** `docs/PREV-01-02-CHECKPOINT.md`

**Objective:**
Fix the preview start/status path so preview availability is determined from the actual session workspace/runtime source of truth, instead of failing when AI-created files exist in the session but preview start checks the wrong workspace source.

**Scope:**
- Inspect preview start/status source-of-truth assumptions
- Align preview start with the real session workspace/runtime source
- Preserve the existing preview status/proxy model
- Keep the fix tightly scoped to preview availability/start detection
- Verify preview can become available from the real session workspace path after the fix
- Document exact cause and resolution

**Out of scope:**
- ??No broad preview redesign
- ??No full static-site preview redesign unless strictly required by the current architecture
- ??No frontend redesign
- ??No workspace redesign
- ??No scope expansion

**Acceptance criteria:**
- Preview start/status uses the correct session workspace source
- A valid previewable session no longer fails just because container-manager checked the wrong workspace location
- Preview status/proxy behave coherently after start
- Fix is documented clearly

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PREV-01-02 for full details

---

#### PREV-01-03: Add Preview Start Action In Workspace UI

**Status:** COMPLETE and LOCKED
**Nature:** UX FIX (PREVIEW PATH, FRONTEND ACTION GAP)
**Checkpoint:** `docs/PREV-01-03-CHECKPOINT.md`

**Objective:**
Add a user-visible preview start action in the workspace UI so users can actually start preview for AI-created previewable files instead of being stuck on a refresh-only unavailable state.

**Scope:**
- Inspect preview unavailable UI state in the workspace
- Add a clear Start Preview action
- Wire it to the existing preview start endpoint
- Refresh preview status after successful start
- Preserve existing preview refresh/status/proxy behavior
- Verify the actual UI path can start preview for an AI-created index.html session

**Out of scope:**
- ??No backend preview redesign
- ??No broad preview UX redesign
- ??No workspace redesign
- ??No scope expansion

**Acceptance criteria:**
- Unavailable preview state includes a visible start action
- Clicking it calls the existing preview start path
- Preview status/proxy update correctly after success
- Refresh-only dead-end is removed
- Fix is documented clearly

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PREV-01-03 for full details

---

## PREV-02 ??Preview Post-Persistence Regression

**Family status:** ACTIVE

**Current stage:** PREV-02-02 (COMPLETE and LOCKED)

---

#### PREV-02-01: Diagnose Preview 500 After Snapshot Persistence Fix

**Status:** COMPLETE and LOCKED
**Nature:** BUG INVESTIGATION (PREVIEW PATH, POST-PERSISTENCE REGRESSION)
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PREV-02-01-CHECKPOINT.md`

**Objective:**
Determine why preview now returns {"statusCode":500,"message":"Internal server error"} after project persistence has been fixed.

**Acceptance criteria:**
- Exact preview 500 failing stage is identified clearly
- Logs/evidence identify the real error, not just generic 500
- Issue is narrowed enough for one bounded fix task
- No unrelated work is mixed in

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PREV-02-01 for full details

---

#### PREV-02-02: Fix Static HTML Preview Entry File Selection

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (PREVIEW PATH, STATIC HTML ENTRYPOINT)
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PREV-02-02-CHECKPOINT.md`

**Objective:**
Fix static HTML preview so sessions with an HTML file other than index.html do not start preview successfully and then fail with 500 when proxy tries to serve missing index.html.

**Acceptance criteria:**
- index.html preview still works
- hello.html-only workspace no longer produces proxy 500 after successful start
- behavior is clear and consistent
- fix is documented clearly

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PREV-02-02 for full details

---

## PROJ-01 ??Project/Public Flow Diagnostics

**Family status:** ACTIVE

**Current stage:** PROJ-01-23 (COMPLETE and LOCKED)

---

#### PROJ-01-01: Diagnose Saved Project Open Flow And Public Projects Unauthorized Error

**Status:** COMPLETE and LOCKED
**Nature:** BUG INVESTIGATION (PROJECT/PUBLIC FLOW, CORE PRODUCT USABILITY)
**Checkpoint:** `docs/PROJ-01-01-CHECKPOINT.md`

**Objective:**
Determine why saved projects do not open correctly and why Public Projects fails with unauthorized, and isolate the exact failing stage(s) in the end-to-end project/public flow.

**Scope:**
- Trace the saved project open flow end to end
- Trace the public projects load flow end to end
- Inspect frontend request path, backend endpoint/guard path, and session/project binding behavior
- Identify the exact failing stage(s) and document them clearly
- No fix in this task unless a trivially obvious diagnostic correction is absolutely required

**Out of scope:**
- ??No project-system redesign
- ??No public sharing redesign
- ??No feature expansion
- ??No scope expansion

**Acceptance criteria:**
- Exact failing stage for saved project open is identified clearly
- Exact failing stage for Public Projects unauthorized is identified clearly
- Issue(s) are narrowed enough for one or two small bounded follow-up fix tasks
- No unrelated work is mixed into this task

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PROJ-01-01 for full details

---

#### PROJ-01-02: Fix Public Projects Route Collision

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (PROJECT/PUBLIC FLOW, ROUTING)
**Checkpoint:** `docs/PROJ-01-02-CHECKPOINT.md`

**Objective:**
Fix the backend route collision so `GET /api/projects/public` resolves to the intended public-projects list endpoint instead of being intercepted by the authenticated `@Get(':id')` route in `ProjectsController`.

**Scope:**
- Inspect route ordering/resolution for projects/public endpoints
- Apply the smallest safe fix so `/api/projects/public` resolves correctly
- Preserve existing `/api/projects/:id` behavior
- Preserve public project detail behavior
- Verify public projects list works unauthenticated as intended

**Out of scope:**
- ??No public sharing redesign
- ??No project-system redesign
- ??No feature expansion
- ??No scope expansion

**Acceptance criteria:**
- `GET /api/projects/public` resolves to the intended public list endpoint
- Public list works unauthenticated without wrong auth/route interception
- Existing project-id routes remain intact
- Fix is documented clearly

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PROJ-01-02 for full details

---

#### PROJ-01-03: Make Project Open Restore Latest Saved Snapshot By Default

**Status:** COMPLETE and LOCKED
**Nature:** UX FIX (PROJECT OPEN FLOW, PERSISTENCE EXPECTATION)
**Checkpoint:** `docs/PROJ-01-03-CHECKPOINT.md`

**Objective:**
Make opening a saved project restore the latest saved project snapshot by default so users experience "open project" as actually opening their saved work rather than only rebinding session metadata.

**Scope:**
- Inspect the current project open flow
- Identify the smallest safe way to restore the latest saved snapshot by default when opening a project
- Preserve explicit snapshot restore behavior if already supported
- Preserve project/session binding behavior
- Verify opening a saved project restores usable content through the normal UI/API path

**Out of scope:**
- ??No project-system redesign
- ??No snapshot-system redesign
- ??No feature expansion
- ??No scope expansion

**Acceptance criteria:**
- Opening a project without explicit `snapshotId` restores the latest saved snapshot by default
- Explicit snapshot behavior remains intact
- Project/session binding remains intact
- Fix is documented clearly

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PROJ-01-03 for full details

---

#### PROJ-01-04: Refresh Workspace State After Project Open

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (PROJECT OPEN FLOW, FRONTEND REFRESH)
**Checkpoint:** `docs/PROJ-01-04-CHECKPOINT.md`

**Objective:**
Ensure that after a project is opened and restored successfully, the workspace UI refreshes its file tree/editor state so the restored project contents actually appear to the user.

**Scope:**
- Inspect the frontend open-project success path
- Inspect whether file tree/editor reload is triggered after project open
- Inspect whether selected file/editor content need reset/reload
- Apply the smallest safe fix so opened/restored project contents appear in the workspace
- Preserve existing project open backend behavior
- Verify the real UI path now shows files after project open

**Out of scope:**
- ??No project-system redesign
- ??No snapshot-system redesign
- ??No workspace redesign
- ??No scope expansion

**Acceptance criteria:**
- After successful project open, workspace file tree refreshes correctly
- Restored files become visible in the UI
- Editor/content state is coherent after open
- Existing project open behavior remains intact
- Fix is documented clearly

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PROJ-01-04 for full details

---

#### PROJ-01-05: Diagnose Project Open Still Shows Empty Workspace

**Status:** COMPLETE and LOCKED
**Nature:** BUG INVESTIGATION (PROJECT OPEN FLOW, REAL UI FAILURE)
**Checkpoint:** `docs/PROJ-01-05-CHECKPOINT.md`

**Objective:**
Determine why the real UI still shows an empty workspace after "Project opened in selected session," despite the earlier backend/open-refresh fixes.

**Scope:**
- Reproduce the real UI/API project-open flow again
- Inspect selected-session state before and after open
- Inspect backend open/restore result for the exact project used
- Inspect frontend file-tree reload, selected-file reset, and session-target logic
- Identify the exact failing stage and document it clearly
- No fix in this task unless a trivially obvious diagnostic correction is absolutely required, which normally should not be done here

**Out of scope:**
- ??No project-system redesign
- ??No snapshot-system redesign
- ??No workspace redesign
- ??No scope expansion

**Acceptance criteria:**
- The exact remaining failing stage is identified clearly
- Evidence is documented across backend/frontend boundaries as needed
- The issue is narrowed enough for one bounded follow-up fix task
- No unrelated work is mixed into this task

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PROJ-01-05 for full details

---

#### PROJ-01-06: Make Project Open Use Project Scoped Latest Snapshot

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (PROJECT OPEN FLOW, SNAPSHOT SELECTION)
**Checkpoint:** `docs/PROJ-01-06-CHECKPOINT.md`

**Objective:**
Fix project open so the default snapshot chosen for restore comes from the selected project's own latest snapshot, instead of using the user's global latest snapshot.

**Scope:**
- Inspect the frontend snapshot-selection logic used by project open
- Switch the default restore choice to the selected project's own latest snapshot
- Preserve explicit snapshot selection behavior if present
- Preserve safe bind-only fallback when the selected project has no snapshots
- Verify opening a saved project through the real UI/API path restores the correct project content

**Out of scope:**
- ??No project-system redesign
- ??No snapshot-system redesign
- ??No workspace redesign
- ??No scope expansion

**Acceptance criteria:**
- Default project open no longer uses unrelated global latest snapshots
- Opening a saved project restores the selected project's latest snapshot when available
- Projects with no snapshots still behave safely
- Fix is documented clearly

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PROJ-01-06 for full details

---

#### PROJ-01-07: Diagnose Real UI Save And Open Project Flow Still Opens Empty

**Status:** COMPLETE and LOCKED
**Nature:** BUG INVESTIGATION (PROJECT FLOW, REAL USER PATH)
**Checkpoint:** `docs/PROJ-01-07-CHECKPOINT.md`

**Objective:**
Determine why the real UI still opens a saved project into an empty workspace, despite earlier fixes to snapshot selection and refresh behavior.

**Scope:**
- Trace the exact real user save/open flow end to end
- Inspect what "save project" actually persists
- Inspect whether a project-scoped snapshot is created/updated during the real save flow
- Inspect what exact data the real open flow sends
- Inspect whether the selected project actually has a restorable snapshot at open time
- Identify the exact remaining failing stage and document it clearly
- No fix in this task unless a trivially obvious diagnostic correction is absolutely required, which normally should not be done here

**Out of scope:**
- ??No project-system redesign
- ??No snapshot-system redesign
- ??No workspace redesign
- ??No scope expansion

**Acceptance criteria:**
- Exact remaining failure is identified clearly
- Clear distinction is made between project metadata save vs content snapshot save if relevant
- Issue is narrowed enough for one bounded follow-up fix task
- No unrelated work is mixed into this task

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PROJ-01-07 for full details

---

#### PROJ-01-08: Auto Save Initial Project Snapshot On Project Create

**Status:** COMPLETE and LOCKED
**Nature:** UX FIX (PROJECT SAVE SEMANTICS, CONTENT PERSISTENCE)
**Checkpoint:** `docs/PROJ-01-08-CHECKPOINT.md`

**Objective:**
Make project creation persist the current workspace content by automatically saving an initial project-scoped snapshot, so users experience "create/save project" as saving both project identity and current files.

**Scope:**
- Inspect the current project create flow
- Automatically create the initial project-scoped snapshot when creating a project from a workspace
- Preserve existing explicit Save Snapshot behavior
- Preserve safe behavior when workspace is empty
- Verify that a newly created project can later be opened with its content intact

**Out of scope:**
- ??No project-system redesign
- ??No snapshot-system redesign
- ??No workspace redesign
- ??No scope expansion

**Acceptance criteria:**
- Creating a project from a workspace with files results in a project-scoped snapshot being created automatically
- Later opening that project restores content without requiring a separate manual snapshot first
- Empty-workspace project creation remains safe
- Existing explicit snapshot behavior remains intact
- Fix is documented clearly

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PROJ-01-08 for full details

---

#### PROJ-01-09: Fix File Tree Refresh After Project Open Without Browser Reload

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (PROJECT OPEN FLOW, FRONTEND REFRESH)
**Checkpoint:** `docs/PROJ-01-09-CHECKPOINT.md`

**Objective:**
After opening a project, refresh workspace file tree/editor state immediately so restored files appear without requiring a browser reload.

**Scope:**
- Inspect post-open frontend refresh path
- Ensure file tree reload happens after restore completes
- Reset selected file/editor state if needed
- Preserve backend project restore behavior
- Verify files appear after Open Project without browser reload

**Out of scope:**
- ??No project-system redesign
- ??No snapshot redesign
- ??No workspace redesign

**Acceptance criteria:**
- Open Project shows restored files without browser reload
- Editor/file tree state is coherent
- Existing project open behavior remains intact
- Fix is documented clearly

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PROJ-01-09 for full details

---

#### PROJ-01-10: Diagnose Project Open UI Still Requires Browser Reload

**Status:** COMPLETE and LOCKED
**Nature:** BUG INVESTIGATION (PROJECT OPEN FLOW, FRONTEND STATE RACE)
**Checkpoint:** `docs/PROJ-01-10-CHECKPOINT.md`

**Objective:**
Determine why the real UI still requires a browser reload for restored project files to appear after Open Project, despite the earlier post-open refresh fix.

**Scope:**
- Reproduce the real UI project-open flow again
- Inspect post-open file tree reload timing
- Inspect selected session state before/after open
- Inspect whether a later state update overwrites the refreshed file tree/editor state
- Identify the exact remaining failing stage clearly
- No fix in this task unless a trivially obvious diagnostic correction is absolutely required, which normally should not be done here

**Out of scope:**
- ??No project-system redesign
- ??No snapshot redesign
- ??No workspace redesign
- ??No scope expansion

**Acceptance criteria:**
- Exact remaining frontend failing stage is identified clearly
- Issue is narrowed enough for one bounded follow-up fix task
- No unrelated work is mixed into this task

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PROJ-01-10 for full details

---

#### PROJ-01-11: Remove Duplicate File Reload Race After Project Open

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (PROJECT OPEN FLOW, FRONTEND STATE RACE)
**Checkpoint:** `docs/PROJ-01-11-CHECKPOINT.md`

**Objective:**
Fix the post-open frontend state race so restored project files appear immediately without browser reload by ensuring project open performs one coherent file-tree/editor refresh for the selected session.

**Scope:**
- Inspect the duplicate post-open reload paths
- Remove or coordinate the duplicate reload for project-open flow
- Preserve normal selected-session reload behavior outside this path
- Keep file-tree/editor state coherent after project open
- Verify restored files appear immediately without browser reload

**Out of scope:**
- ??No project-system redesign
- ??No snapshot redesign
- ??No workspace redesign
- ??No scope expansion

**Acceptance criteria:**
- Open Project results in one coherent post-open refresh for the target session
- Restored files appear immediately without browser reload
- Selected-session behavior outside project open remains intact
- Fix is documented clearly

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PROJ-01-11 for full details

---

#### PROJ-01-12: Diagnose Real UI File Tree Still Empty After Project Open

**Status:** COMPLETE and LOCKED
**Nature:** BUG INVESTIGATION (PROJECT OPEN FLOW, RENDERED UI STATE)
**Checkpoint:** `docs/PROJ-01-12-CHECKPOINT.md`

**Objective:**
Determine why the real UI still renders an empty file tree after successful project open, even after the duplicate reload race fix, while a full browser refresh makes the files appear.

**Scope:**
- Inspect the real UI file-tree/render state after project open
- Inspect whether loaded files are present in state but not rendered
- Inspect whether another effect/reset/path clears rendered file navigation state after successful load
- Inspect selected file/file tree derivation path after open
- Identify the exact remaining failing stage clearly
- No fix in this task unless a trivially obvious diagnostic correction is absolutely required, which normally should not be done here

**Out of scope:**
- ??No project-system redesign
- ??No snapshot redesign
- ??No workspace redesign
- ??No scope expansion

**Acceptance criteria:**
- Exact remaining rendered-state failure is identified clearly
- Issue is narrowed enough for one bounded follow-up fix task
- No unrelated work is mixed into this task

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PROJ-01-12 for full details

---

#### PROJ-01-13: Preserve Selected Session And File State When Session Reload Fails After Project Open

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (PROJECT OPEN FLOW, FRONTEND STATE DESTRUCTION)
**Checkpoint:** `docs/PROJ-01-13-CHECKPOINT.md`

**Objective:**
Prevent successful project-open file state from being destroyed when the post-open session reload path encounters an error.

**Scope:**
- Inspect loadSessions error handling in the project-open path
- Stop destructive selectedSession/file-state reset on session reload failure after successful project open
- Preserve normal session reload behavior where appropriate
- Verify successful project-open content remains visible even if session reload fails

**Out of scope:**
- ??No project-system redesign
- ??No snapshot redesign
- ??No workspace redesign
- ??No scope expansion

**Acceptance criteria:**
- Successful project-open content is not wiped by later session reload failure
- Selected session remains stable after successful open
- File tree/editor state remains visible without browser reload
- No unrelated work is mixed into this task

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PROJ-01-13 for full details

---

---

#### PROJ-01-14: Diagnose Project Download Absolute Path Failure

**Status:** COMPLETE and LOCKED
**Nature:** BUG INVESTIGATION (PROJECT DOWNLOAD, PATH GUARD)
**Checkpoint:** `docs/PROJ-01-14-CHECKPOINT.md`

**Objective:**
Determine why Download Project fails with "Absolute paths outside /workspace not allowed" and isolate the exact failing stage in the export/download flow.

**Scope:**
- Trace the project download/export flow end to end
- Inspect archive/export path generation
- Inspect which path is passed into the guarded read/download step
- Identify the exact failing stage clearly
- No fix in this task unless a trivially obvious diagnostic correction is absolutely required, which normally should not be done here

**Out of scope:**
- No project-system redesign
- No storage redesign
- No workspace redesign
- No scope expansion

**Acceptance criteria:**
- Exact failing stage is identified clearly
- Issue is narrowed enough for one bounded fix task
- No unrelated work is mixed into this task

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-01-14 for full details

---

#### PROJ-01-15: Fix Nested Project Export Path Construction

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (PROJECT DOWNLOAD, ARCHIVE PATHS)
**Checkpoint:** `docs/PROJ-01-15-CHECKPOINT.md`

**Objective:**
Fix project export so nested directories are traversed using valid workspace-relative paths instead of invalid absolute paths like /src that are rejected by the workspace path guard.

**Scope:**
- Inspect recursive archive path construction
- Correct nested recursion to use valid workspace-relative paths
- Preserve existing root export behavior
- Verify nested project export works end to end
- Document exact cause and resolution

**Out of scope:**
- No export redesign
- No path-guard redesign
- No workspace redesign
- No scope expansion

**Acceptance criteria:**
- Export succeeds for projects with nested directories
- Existing root-only export still works
- Path guard behavior remains intact
- Fix is documented clearly

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-01-15 for full details

---

#### PROJ-01-16: Diagnose Project Open Files Still Not Reloading Automatically

**Status:** COMPLETE and LOCKED
**Nature:** BUG INVESTIGATION (PROJECT OPEN FLOW, REAL UI REGRESSION)
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-01-16-CHECKPOINT.md`

**Objective:**
Determine why project-open still does not automatically reload files into the workspace in real UI usage, despite the earlier project-open refresh and race-condition fixes.

**Acceptance criteria:**
- Exact remaining failure is identified clearly
- Issue is narrowed enough for one bounded follow-up fix task
- No unrelated work is mixed into this task

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-01-16 for full details

---

#### PROJ-01-17: Load Project Snapshot At Open Time To Avoid Snapshot Race

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (PROJECT OPEN FLOW, SNAPSHOT RACE)
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-01-17-CHECKPOINT.md`

**Objective:**
Fix project open so it does not depend on stale or temporarily empty React snapshot state when deciding whether to restore a project snapshot.

**Acceptance criteria:**
- Open Project no longer depends on temporarily empty workspaceSnapshots state
- Opening a saved project restores content immediately after session switch
- Projects with no snapshots still fall back safely
- Fix is documented clearly

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-01-17 for full details

---

#### PROJ-01-18: Diagnose Editor Panel Not Updating After Project Open

**Status:** COMPLETE and LOCKED
**Nature:** BUG INVESTIGATION (PROJECT OPEN FLOW, EDITOR STATE)
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-01-18-CHECKPOINT.md`

**Objective:**
Determine why the editor panel does not update automatically after opening a project, even after project snapshot restore and file reload fixes.

**Acceptance criteria:**
- Exact editor-panel failing stage is identified clearly
- Clear distinction is made between file tree refresh, selected file state, and editor content state
- Issue is narrowed enough for one bounded follow-up fix task
- No unrelated work is mixed into this task

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-01-18 for full details

---

#### PROJ-01-19: Prevent AI File Action Coherence From Invalidating Project Open Editor Load

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (PROJECT OPEN FLOW, EDITOR STATE RACE)
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-01-19-CHECKPOINT.md`

**Objective:**
Fix the project-open editor load race where AI file-action coherence invalidates the in-flight editor content request after project open.

**Acceptance criteria:**
- Project open loads file tree and editor content without browser reload
- Stale AI file-action coherence does not invalidate project-open editor content load
- Normal AI file-action coherence still works
- Fix is documented clearly

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-01-19 for full details

---

#### PROJ-01-20: Diagnose Project Snapshot Persistence Loss Across Server Restart

**Status:** COMPLETE and LOCKED
**Nature:** CRITICAL BUG INVESTIGATION (PROJECT PERSISTENCE, RESTART RESTORE)
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-01-20-CHECKPOINT.md`

**Objective:**
Determine why a saved project can be opened into a new session before server restart, but opens empty after all servers are restarted.

**Acceptance criteria:**
- Clearly state whether project metadata survives restart
- Clearly state whether project-scoped snapshot metadata survives restart
- Clearly state whether snapshot/archive file content survives restart
- Clearly state why restore works before restart but not after restart
- Issue is narrowed enough for one bounded fix task

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-01-20 for full details

---

#### PROJ-01-21: Persist Snapshot Store Across Docker Restarts

**Status:** COMPLETE and LOCKED
**Nature:** CRITICAL BUG FIX (PROJECT PERSISTENCE, SNAPSHOT STORAGE)
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-01-21-CHECKPOINT.md`

**Objective:**
Make project snapshot storage persistent across Docker container restarts so saved projects remain restorable after `docker compose down` and restart.

**Acceptance criteria:**
- `/snapshot-store/` persists across api-gateway container recreation
- Saved project snapshot files survive `docker compose down` without `-v`
- Saved project opens correctly after stack restart
- Existing immediate project open behavior remains intact
- Fix is documented clearly

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-01-21 for full details

---

#### PROJ-01-22: Diagnose Files Not Loading Automatically After Project Open

**Status:** COMPLETE and LOCKED
**Nature:** BUG INVESTIGATION (PROJECT OPEN FLOW, FILE TREE EDITOR STATE)
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-01-22-CHECKPOINT.md`

**Objective:**
Determine why files still do not load automatically after opening a project, despite project persistence, snapshot restore, and previous frontend state-race fixes.

**Acceptance criteria:**
- Exact remaining file-loading failure is identified clearly
- Clear distinction between backend restore, file-tree reload, selected-file state, editor-content state, and rendered UI
- Issue is narrowed enough for one bounded follow-up fix task
- No unrelated work is mixed in

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-01-22 for full details

---

#### PROJ-01-23: Suppress Project State Reset During Project Open Session Transition

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (PROJECT OPEN FLOW, SESSION EFFECT RACE)
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-01-23-CHECKPOINT.md`

**Objective:**
Prevent the selected-session change effect from clearing project/open UI state while Open Project is still executing across a session transition.

**Acceptance criteria:**
- Open Project no longer gets disrupted by the session-change reset effect
- Files/editor load automatically after project open
- Normal manual session switching still resets/reloads correctly
- Fix is documented clearly

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-01-23 for full details

---


## PROJ-02 — Project Open Hydration Cleanup

**Family status:** ACTIVE

**Current stage:** PROJ-02-03 (COMPLETE and LOCKED)

---

#### PROJ-02-01: Refactor Project Open Into Deterministic Workspace Hydration Flow

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND ARCHITECTURE FIX / STATE FLOW CLEANUP
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-02-01-CHECKPOINT.md`

**Objective:**
Replace the fragile project-open UI state/race chain with one deterministic workspace hydration flow so opening a project reliably loads restored files and editor content without browser refresh.

**Acceptance criteria:**
- Open Project loads restored file tree automatically
- Open Project loads editor content automatically
- No browser refresh is required
- Normal manual session switching still works
- Existing project persistence behavior remains intact
- Fix is documented clearly

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-02-01 for full details

---

#### PROJ-02-02: Validate Real UI Project Open Hydration Failure With Docker Running

**Status:** COMPLETE and LOCKED
**Nature:** BUG INVESTIGATION (PROJECT OPEN HYDRATION, REAL UI VALIDATION)
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-02-02-CHECKPOINT.md`

**Objective:**
Reproduce and diagnose why the real UI still fails to load files automatically after project open, despite PROJ-02-01's deterministic hydration refactor passing static/unit validation.

**Acceptance criteria:**
- Exact "fail to load files" stage is identified clearly
- Evidence includes live-stack/API results, not only source inspection
- Issue is narrowed enough for one bounded follow-up fix task
- No unrelated work is mixed in

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-02-02 for full details

---

#### PROJ-02-03: Exclude Git Internals From Project Snapshots And Restore

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (PROJECT SNAPSHOTS, RESTORE BINARY FILE FAILURE)
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-02-03-CHECKPOINT.md`

**Objective:**
Prevent project snapshots/restores from including `.git/` internals so restoring a saved project does not fail on binary git files like `.git/index`.

**Acceptance criteria:**
- New project snapshots do not include `.git/` internals
- Restore ignores/skips `.git/` internals if present in older snapshots
- Project open no longer returns 500 due to `.git/index`
- Normal source files still restore correctly
- Fix is documented clearly

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-02-03 for full details

---


## PROJ-03 — Project-First UX Redesign

**Family status:** ACTIVE — Phase A complete (A0, A1, A3, A2a, A2b all COMPLETE and LOCKED); Phase B complete (B0, B1, B2a, B2b, B3a, B4a, B4b all COMPLETE and LOCKED; B3b deferred); C1a COMPLETE and LOCKED; C1b-pre COMPLETE and LOCKED; C1b-cta COMPLETE and LOCKED; C1c deferred; C2a-rate-limit COMPLETE and LOCKED; C2b-trigger-preview COMPLETE and LOCKED; C2c-label-format COMPLETE and LOCKED; C2c-handler COMPLETE and LOCKED; C2c-cta-handler-pre COMPLETE and LOCKED; C2c-cta-button COMPLETE and LOCKED; C2c-display COMPLETE and LOCKED; C2d-expiry-warn COMPLETE and LOCKED; C2d-unload deferred; C2e COMPLETE and LOCKED; C2e-hotfix COMPLETE and LOCKED; C2f-file-save COMPLETE and LOCKED; C2f-idle-timer SKIPPED (unnecessary — container-state autosave already covered by C2b/C2d-expiry-warn/C2e/C2f-file-save; idle debounce would not capture unsaved Monaco buffer edits); C3 deferred; C4 COMPLETE and LOCKED; D0 COMPLETE and LOCKED; D0b COMPLETE and LOCKED; D0c COMPLETE and LOCKED; D0d COMPLETE and LOCKED; D0e COMPLETE and LOCKED; D0e-hotfix COMPLETE and LOCKED; D1a COMPLETE and LOCKED; D1b COMPLETE and LOCKED; D1c COMPLETE and LOCKED; D1d COMPLETE and LOCKED; D1d-hotfix COMPLETE and LOCKED. C3/C2d-unload deferred and not yet registered.

**Current stage:** PROJ-03-D1d-hotfix (COMPLETE and LOCKED)

---

#### PROJ-03-01: Design Project First UX Auto Session Flow Git Backed Autosave And Internal Recovery UI

**Status:** COMPLETE and LOCKED
**Nature:** PRODUCT / UX / ARCHITECTURE DESIGN
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-03-01-DESIGN.md`

**Objective:**
Design the next-stage product model so the app becomes project-first and more user-friendly, with sessions mostly hidden from normal users, autosave/history redesigned around a git-backed model, and an internal operator recovery UI planned for emergencies.

**Acceptance criteria:**
- A clear product model is proposed
- Normal user flows are simplified and project-first
- Session handling is clarified as hidden runtime machinery where appropriate
- Autosave/history model is clarified
- Internal recovery/admin UI requirements are outlined
- Future UX extension points are considered
- Document is concrete enough to guide later implementation slicing

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-01 for full details. Implementation plan: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md`.

---

#### PROJ-03-A0: Add Feature Flag Infrastructure And Recovery Vocabulary Copy Bundle

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND INFRASTRUCTURE / PHASE A PREREQUISITE
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-03-A0-CHECKPOINT.md`

**Objective:**
Introduce the `PROJECT_FIRST_UX` feature flag and a centralized recovery-vocabulary copy bundle so all Phase A and later slices can be merged behind a kill-switch and shipped without behavior change when the flag is off.

**Bounded scope:**
- Frontend only
- New `frontend/lib/feature-flags.ts` (or equivalent) exporting `PROJECT_FIRST_UX` boolean read from env
- New `frontend/lib/recovery-copy.ts` exporting string constants for Phase A–B vocabulary ("Reopen project", "Workspace disconnected", "All changes saved", etc.)
- Wire flag into page.tsx and workspace-shell.tsx as consumption points only — no string substitution yet
- No behavior change; no UI string changed in this slice

**Non-goals:**
- No actual UI changes
- No route additions
- No backend env vars or internal-endpoint changes
- No auth work
- No operator console work

**Acceptance criteria:**
- Flag defaults to `false` in all environments
- Flag is flippable in dev via env var without code change
- Copy bundle exports all strings the design will need (none consumed yet)
- Existing test suites pass with no new failures (65/65 workspace-shell, typecheck clean)
- `PROJECT_FIRST_UX=false` is an unambiguous kill-switch to today's behavior

**Invariants preserved:**
- No change to project-open hydration (PROJ-02-01)
- No change to `.git/` snapshot exclusion (PROJ-02-03)
- No change to snapshot-store persistence volume (PROJ-01-21)
- No change to stop-session timeout behavior (OPS-01-04)
- Static preview `index.html` requirement unchanged (PREV-02-02)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-A0. Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase 0 / Slice 0.1.

---

#### PROJ-03-A1: Add Project-First Top-Level Routes And Labels Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND ARCHITECTURE / PHASE A IA SHELL
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-03-A1-CHECKPOINT.md`

**Objective:**
Stand up the project-first information architecture (Home, Projects, Workspace, Gallery, Account) as a thin route/nav shell behind `PROJECT_FIRST_UX`, wrapping existing functionality with no behavior change.

**Bounded scope:**
- Frontend only
- Add `/[locale]/projects`, `/[locale]/gallery`, `/[locale]/account` top-level routes — each wraps or redirects to its current equivalent surface
- Update primary nav header (workspace-shell or equivalent) to show new labels under the flag
- `/[locale]/app/...` workspace route stays intact; new `/[locale]/projects/:id` workspace view reuses it
- Flag off: product is byte-equivalent to today's behavior

**Non-goals:**
- No new page functionality beyond routing/labels
- No sessions list removal yet (A.2, not registered in this batch)
- No history tab
- No share modal
- No gallery data fetching
- No backend changes
- No auth changes

**Acceptance criteria:**
- Flag on: new top-level nav renders with correct labels; all routes resolve to existing equivalent content with no 404s, no console errors, no broken links
- Flag off: product is byte-equivalent to today's behavior
- Existing test suites pass; new tests verify flag-gated rendering
- Manual smoke pass: open a project, write a file, run preview, see the new nav — all work

**Dependencies:** PROJ-03-A0 (flag infrastructure must exist first)

**Invariants preserved:** same as PROJ-03-A0

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-A1. Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase A / Slice A.1.

---

#### PROJ-03-A3: Replace Raw Session Lifecycle Strings With Recovery Vocabulary

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND UX / PHASE A COPY CLEANUP
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-03-A3-CHECKPOINT.md`

**Objective:**
Replace all user-visible raw session/container lifecycle strings (e.g. "session expired", "container exited", "session disconnected") with the recovery vocabulary from the copy bundle, presenting a single primary "Reopen project" action that wraps the existing project-open path.

**Bounded scope:**
- Frontend only
- Under `PROJECT_FIRST_UX` flag: all known raw lifecycle strings on the user surface are replaced using recovery-copy bundle strings
- "Reopen project" primary button wires to the existing `handleOpenWorkspaceProject` / open-project path — no new behavior, just surfaces the action where there was previously only a raw error
- No new endpoint, no new backend call, no new retry logic

**Non-goals:**
- No change to the underlying session lifecycle logic
- No change to backend error shapes
- No stop-session UX relocation (that is A.2, not registered in this batch)
- No history, autosave, or persistence changes

**Acceptance criteria:**
- Flag on: no user-visible string contains raw container/session/runtime mechanics
- All recovery paths present "Reopen project" as the primary action
- "Reopen project" correctly invokes the existing open-project flow
- Flag off: today's string behavior unchanged
- Existing test suites pass; key new tests verify string replacements and button wiring

**Dependencies:** PROJ-03-A0 (copy bundle), PROJ-03-A1 (routes/labels baseline)

**Invariants preserved:**
- Existing project-open hydration behavior (PROJ-02-01) is called, not replaced
- No regression to `.git/` snapshot exclusion (PROJ-02-03)
- No regression to snapshot-store persistence (PROJ-01-21)
- Stop-session flow from OPS-01-04 is not affected
- Static preview index.html requirement (PREV-02-02) unchanged

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-A3. Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase A / Slice A.3.

---

#### PROJ-03-A2a: Add Advanced Drawer Shell Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND UX / PHASE A ADVANCED SURFACE SHELL
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-03-A2a-CHECKPOINT.md`

**Objective:**
Introduce a collapsed Advanced drawer structure inside the workspace shell behind `PROJECT_FIRST_UX`, populated with read-only informational content (session ID + runtime status). No active controls are relocated in this slice.

**Bounded scope:**
- Frontend only
- Collapsible Advanced section added to workspace shell, visible only when `PROJECT_FIRST_UX` is on
- Collapsed by default
- Renders session ID as read-only with copy affordance (consistent with existing UI patterns)
- Renders container/runtime status indicator as read-only
- No relocation of active controls in this slice

**Non-goals:**
- No stop-session relocation (that is A2b)
- No sessions list visibility change (that is A2b)
- No backend, auth, or schema changes
- No new endpoints
- No Advanced content beyond session ID and runtime status in this slice

**Acceptance criteria:**
- Flag on: Advanced drawer is present, collapsed by default, expands correctly; session ID is readable and copyable; status indicator is visible
- Flag off: no Advanced drawer, layout and behavior byte-equivalent to today
- Existing workspace-shell tests pass with no new failures
- Typecheck clean; no lint errors introduced on changed files

**Dependencies:** PROJ-03-A0 (flag), PROJ-03-A1 (IA shell), PROJ-03-A3 (vocabulary) — all COMPLETE and LOCKED

**Invariants preserved:**
- `PROJECT_FIRST_UX` remains kill switch
- Workspace layout/overflow must not regress
- No regression to project-open hydration (PROJ-02-01)
- No regression to `.git/` snapshot exclusion (PROJ-02-03)
- No regression to snapshot-store persistence (PROJ-01-21)
- Stop-session flow (OPS-01-04) untouched
- Static preview `index.html` requirement (PREV-02-02) unchanged

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-A2a.

---

#### PROJ-03-A2b: Hide Sessions List And Relocate Stop-Session To Advanced Drawer

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND UX / PHASE A SESSION DEMOTION
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-03-A2b-CHECKPOINT.md`

**Objective:**
Hide the sessions list from the primary workspace surface and move the stop-session control into the Advanced drawer built in A2a, both behind `PROJECT_FIRST_UX`. The stop-session handler and all underlying session logic are unchanged.

**Bounded scope:**
- Frontend only
- Under flag: sessions list hidden from primary surface (component stays mounted; only its primary-surface render is suppressed)
- Under flag: stop-session rendered inside the Advanced drawer from A2a
- Advanced drawer then contains: session ID + status (from A2a) + stop-session button
- Existing stop-session handler and API call are unchanged — only render location changes

**Non-goals:**
- No change to stop-session logic, handler, or API call
- No change to session creation or selection behavior
- No backend, auth, or schema changes
- No copy-cleanup expansion beyond what is strictly necessary for relocated labels
- No Phase B auto-fresh-session behavior
- No history, autosave, or persistence changes

**Acceptance criteria:**
- Flag on: sessions list not visible in primary surface; no "Sessions" word in primary nav
- Flag on: stop-session reachable from Advanced drawer and executes correctly
- Flag off: sessions list and stop-session are in their current locations, unchanged
- Existing workspace-shell tests pass; new flag-on tests verify stop-session renders in Advanced drawer and sessions list is absent from primary
- Typecheck clean; no lint errors introduced on changed files

**Dependencies:** PROJ-03-A2a (Advanced drawer shell MUST be COMPLETE and LOCKED first)

**Invariants preserved:**
- `PROJECT_FIRST_UX` remains kill switch
- Stop-session must remain reachable and functional behind the flag
- Hidden sessions list must not introduce React render or state errors
- No regression to project-open hydration (PROJ-02-01)
- No regression to `.git/` snapshot exclusion (PROJ-02-03)
- No regression to snapshot-store persistence (PROJ-01-21)
- Stop-session flow (OPS-01-04) called, not replaced
- Static preview `index.html` requirement (PREV-02-02) unchanged

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-A2b.

---

#### PROJ-03-B0: Add Fresh-Session-Open Helper Primitive Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND / PHASE B PRIMITIVE HELPER
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-03-B0-CHECKPOINT.md`

**Objective:**
Introduce one frontend helper primitive for opening a project in a newly created fresh session, reusing the existing session-create flow and the existing `handleOpenWorkspaceProject` path, without changing any user-visible call site yet.

**Bounded scope:**
- Frontend only
- New helper module/function plus focused unit tests
- Helper wraps existing primitives only: create session → call existing `handleOpenWorkspaceProject` with the new session id
- Preserve existing deterministic await sequencing and hydration discipline from PROJ-02 family
- No user-visible call sites switched in this slice
- No change to `handleOpenWorkspaceProject` internals
- Zero user-visible behavior change (helper has no UI callers in this slice)

**Non-goals:**
- No New Project wiring yet (B1)
- No Open Project wiring yet (B2)
- No Reopen banner wiring yet (B3)
- No Resume Latest CTA (B4)
- No backend, auth, schema, or internal-API changes
- No snapshot or persistence redesign

**Acceptance criteria:**
- Helper exists and is covered by focused unit tests
- Tests prove: session-create called once; `handleOpenWorkspaceProject` called once with newly created session id; sequence is fully awaited (no fire-and-forget); project-open guard shape is preserved
- Zero user-visible behavior change; helper has no UI callers
- Existing page and workspace-shell tests remain green
- Typecheck clean; no introduced lint errors

**Dependencies:** All PROJ-03 Phase A slices (COMPLETE and LOCKED)

**Invariants preserved:**
- `PROJECT_FIRST_UX` remains kill switch; flag on/off has no user-visible difference in this slice
- This helper is the primitive B1/B2/B3/B4 will call; it must preserve the PROJ-02-01 hydration contract exactly
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-B0.

---

#### PROJ-03-B1: Auto-Create Fresh Session On New Project Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND / PHASE B NEW PROJECT WIRING
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-03-B1-CHECKPOINT.md`

**Objective:**
Behind `PROJECT_FIRST_UX`, after a successful New Project creation, invoke the locked B0 helper (`openProjectInFreshSession`) so the user lands in the workspace with the new project opened in a freshly created session, with no intermediate session-selection step.

**Bounded scope:**
- Frontend only
- Single call-site wiring in the existing New Project flow
- Under flag only, after successful project creation: call `openProjectInFreshSession(...)`, awaited end-to-end, wrapped with the existing `projectOpenInProgressRef` discipline (set before call; clear in `finally`)
- Perform the same hydration follow-ups already used by the existing open-project flow
- Preserve B0 helper contract and existing project-open sequencing discipline
- Flag off preserves current New Project flow exactly

**Non-goals:**
- No change to `handleOpenWorkspaceProject` internals
- No change to B0 helper internals
- No change to New Project UI affordance itself
- No Open Project wiring yet (B2)
- No Reopen banner wiring yet (B3)
- No Resume Latest CTA (B4)
- No backend, auth, schema, or internal-API changes
- No autosave, history, or persistence work
- No Phase C/D/E work

**Acceptance criteria:**
- Flag on: New Project creates the project, creates a fresh session, opens the new project in that fresh session; no intermediate session-selection step
- Flag on: post-create state matches the existing open-project hydrated state shape
- Flag on: `projectOpenInProgressRef` set before helper call and cleared in `finally`; failures surface coherently
- Flag off: New Project flow unchanged
- Existing relevant page/workspace tests remain green
- Typecheck clean; no introduced lint errors

**Dependencies:** PROJ-03-B0 (COMPLETE and LOCKED)

**Invariants preserved:**
- `projectOpenInProgressRef` discipline is the key non-obvious constraint; forgetting `finally`-clear risks reintroducing PROJ-02 race behavior
- Hydration follow-up parity with the existing open-project path must be preserved
- Newly created projects may have no snapshot; B0 fallback semantics must remain intact
- `PROJECT_FIRST_UX` remains kill switch
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-B1.

---

#### PROJ-03-B2a: Wire Open Project Handler To Open Project In Fresh Session Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND / PHASE B OPEN PROJECT HANDLER WIRING
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-03-B2a-CHECKPOINT.md`

**Objective:**
Behind `PROJECT_FIRST_UX`, change `handleOpenWorkspaceProject` so a successful open goes through the locked B0 helper (`openProjectInFreshSession`) instead of opening into the currently selected session, while keeping the existing Open Project UI affordance and enablement gating unchanged in this slice.

**Bounded scope:**
- Frontend only
- Single edit to `handleOpenWorkspaceProject` in `frontend/app/[locale]/app/page.tsx`
- Under flag only, after existing precondition passes: call `openProjectInFreshSession({ token, projectId: selectedProjectId, snapshotId: trimmed selectedSnapshotId when set })`, awaited end-to-end, wrapped with `projectOpenInProgressRef` discipline (set before call; clear in `finally`) and `skipNextSessionEffectFileReloadRef` cleared in same `finally`
- Mirror the existing open-project follow-up sequence
- Preserve explicit `selectedSnapshotId` semantics when provided; omit when not set
- Flag-off path preserves existing `handleOpenWorkspaceProject` behavior exactly
- Minimal flag-on success-message neutralization allowed if the existing wording would be inaccurate

**Non-goals:**
- No change to Open Project button enablement, label, or visibility (deferred to B2b)
- No relaxation of `selectedSessionId` gating yet (that is B2b)
- No change to `handleOpenWorkspaceProject` signature or external interface
- No change to B0 helper internals
- No change to B1 path
- No Reopen banner wiring yet (B3)
- No Resume Latest CTA (B4)
- No backend, auth, schema, or internal-API changes
- No autosave, history, or persistence work
- No Phase C/D/E work

**Acceptance criteria:**
- Flag on (via test/programmatic path): `openProjectInFreshSession` called once with the selected project id; `snapshotId` passed only when explicitly selected; post-open settled state matches the existing open-project settled-state shape
- Flag on: `projectOpenInProgressRef` and `skipNextSessionEffectFileReloadRef` both cleared in `finally` on success and error paths
- Flag off: legacy `handleOpenWorkspaceProject` behavior unchanged
- Existing relevant page/workspace/helper tests remain green
- Typecheck clean; no introduced lint errors

**Dependencies:** PROJ-03-B1 (COMPLETE and LOCKED)

**Invariants preserved:**
- This is a PROJ-02-sensitive surface; `projectOpenInProgressRef` discipline must remain exact
- `selectedSessionId` is intentionally ignored by the flag-on open path; UI gating unchanged so path is not normally user-reachable in this slice
- Explicit `selectedSnapshotId` behavior must remain intact
- `PROJECT_FIRST_UX` remains kill switch
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-B2a.

---

#### PROJ-03-B2b: Relax Open Project Precondition To Enable Fresh-Session Open Path Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND / PHASE B OPEN PROJECT PRECONDITION ACTIVATION
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-03-B2b-CHECKPOINT.md`

**Objective:**
Behind `PROJECT_FIRST_UX`, relax `handleOpenWorkspaceProject`'s precondition so it no longer requires `selectedSessionId`, making the already-locked B2a fresh-session open path normally user-reachable from the existing Open Project button and the existing Reopen Project affordances.

**Bounded scope:**
- Frontend only
- Single edit to the precondition block of `handleOpenWorkspaceProject` in `frontend/app/[locale]/app/page.tsx`
- Under flag only:
  - require only `selectedProjectId`
  - allow `selectedSessionId` to be null
  - if needed for accuracy, neutralize rejection error wording under the flag to project-only wording
- Flag-off path preserves current precondition and current error wording exactly
- Reuse the already-locked B2a flag-on branch unchanged
- No new open path introduced in this slice

**Non-goals:**
- No change to Open Project button JSX (label, visibility, disabled expression)
- No change to Reopen Project affordances
- No change to `handleOpenWorkspaceProject` signature
- No change to the B0 helper
- No change to the B1 path
- No change to the B2a flag-on branch body
- No relaxation of the flag-off precondition
- No backend, auth, schema, or internal-API changes
- No autosave, history, or persistence work
- No B3/B4 or Phase C/D/E work

**Acceptance criteria:**
- Flag on: `selectedProjectId` set and `selectedSessionId` null now proceeds into the existing B2a branch
- Flag on: `selectedProjectId` set and `selectedSessionId` set behaves unchanged from B2a
- Flag on: `selectedProjectId` missing still rejects with accurate flag-on wording
- Flag off: both `selectedSessionId` and `selectedProjectId` still required; current error wording unchanged
- Existing relevant helper/workspace/project/snapshot tests remain green
- Typecheck clean; no introduced lint errors on changed files

**Dependencies:** PROJ-03-B2a (COMPLETE and LOCKED)

**Invariants preserved:**
- This is the activation slice that makes the B2a path user-reachable; it touches a PROJ-02-sensitive surface even though the code change is small
- `selectedSessionId` null becomes an allowed entry shape only under the flag
- `projectOpenInProgressRef` / `skipNextSessionEffectFileReloadRef` must continue to clear via the existing outer finally
- `selectedSnapshotId` carryover behavior is unchanged in this slice
- `PROJECT_FIRST_UX` remains the kill switch
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-B2b.

---

### PROJ-03-B3a — Confirm And Lock Existing Reopen Project Affordances Route Through Fresh-Session Path Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-03-B3a-CHECKPOINT.md`

**Objective:** Lock the post-B2b reality that the existing A3 Reopen Project affordances now route through the fresh-session open path under `PROJECT_FIRST_UX`, by adding focused verification tests and documenting remaining uncovered recovery surfaces for a later slice.

**Bounded scope:**
- Frontend only
- Focused tests only, primarily in `frontend/components/workspace/workspace-shell.test.tsx`
- Verify that with `projectFirstUxEnabled = true`, `selectedProjectId` present, `selectedSessionId` null, and `onOpenWorkspaceProject` provided, the existing Reopen Project buttons on exec 404, exec 410, and shell error states render and call `onOpenWorkspaceProject`
- Include a short audit of recovery surfaces (covered vs uncovered) in the eventual checkpoint
- No production behavior change in this slice

**Non-goals:**
- No change to `handleOpenWorkspaceProject` or any handler
- No change to `WorkspaceShell` JSX, `StateMessage` props, or Reopen button gating
- No change to A3 recovery-copy bundle
- No change to B0 helper, B1 path, B2a, or B2b
- No new Reopen affordance on additional surfaces (B3b scope)
- No backend/auth/schema/internal-API changes
- No B3b/B4 or Phase C/D/E work

**Acceptance checks:**
- New tests prove that under `PROJECT_FIRST_UX` with `selectedSessionId` null and `selectedProjectId` present: exec 404 Reopen button renders and calls `onOpenWorkspaceProject` once; exec 410 Reopen button renders and calls `onOpenWorkspaceProject` once; shell error Reopen button renders and calls `onOpenWorkspaceProject` once
- Existing relevant focused test suites remain green
- Typecheck clean, no introduced lint errors
- Checkpoint includes audit table of covered vs uncovered recovery surfaces

**Invariants to preserve:**
- `PROJECT_FIRST_UX` remains the kill switch
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-B3a.

---

### PROJ-03-B4a — Add Open Project By Id In Fresh Session Handler Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND / PHASE B HANDLER WIRING
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-03-B4a-CHECKPOINT.md`

**Objective:**
Behind `PROJECT_FIRST_UX`, add a parameterized handler (`handleResumeWorkspaceProjectById(projectId: string)`) in `frontend/app/[locale]/app/page.tsx` that opens a caller-supplied `projectId` in a freshly created session by directly invoking the locked B0 helper, mirroring the B1/B2a hydration follow-up sequence, and expose it as a new optional callback prop on `WorkspaceShell`. No UI consumer in this slice.

**Bounded scope:**
- Frontend only
- Add `handleResumeWorkspaceProjectById(projectId: string)` in `frontend/app/[locale]/app/page.tsx`:
  - Returns early when `PROJECT_FIRST_UX` is false
  - Returns early when `projectId` is empty/invalid
  - Sets `projectOpenInProgressRef.current = true` before helper call
  - Calls `openProjectInFreshSession({ token, projectId })`
  - Mirrors the same B1/B2a hydration follow-up sequence
  - Clears `projectOpenInProgressRef` and `skipNextSessionEffectFileReloadRef` in `finally`
  - Sets project action success state/message consistently with B2a
- Add one new optional prop to `WorkspaceShell`: `onResumeWorkspaceProjectById?: (projectId: string) => Promise<void>`
- Pass the new handler from `page.tsx` to `WorkspaceShell` only
- No UI consumer in this slice

**Non-goals:**
- No CTA, banner, or button yet
- No change to `WorkspaceShell` JSX or panel/state-message rendering
- No change to A3 recovery copy bundle
- No change to `handleOpenWorkspaceProject`, `handleCreateWorkspaceProject`, or existing handler bodies
- No change to B0 helper, B2a, B2b, or B3a
- No "most recent" computation logic yet
- No new route or IA change
- No backend/auth/schema/internal-API changes
- No autosave, history, or persistence work
- No B4b or Phase C/D/E work

**Acceptance checks:**
- New handler exists and is passed through the new optional `WorkspaceShell` prop
- Flag off: handler returns early without calling `openProjectInFreshSession` and without setting `projectOpenInProgressRef`
- Flag on with empty/invalid `projectId`: handler returns early without calling `openProjectInFreshSession`
- Flag on with valid `projectId`: handler runs the full hydration sequence and clears refs in `finally`
- Existing relevant helper/workspace/project/snapshot tests remain green
- Typecheck clean, no introduced lint errors
- No JSX/copy changes in `workspace-shell.tsx`

**Invariants to preserve:**
- This is a handler-only preparatory slice; the visible CTA belongs to B4b, not here
- Hydration follow-up sequence must mirror B1/B2a exactly
- `projectOpenInProgressRef` and `skipNextSessionEffectFileReloadRef` must clear on every exit path
- Unused optional prop is acceptable in this slice
- `PROJECT_FIRST_UX` remains the kill switch
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Dependencies:** PROJ-03-B3a (COMPLETE and LOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-B4a.

---

### PROJ-03-B4b — Add Resume Latest Project CTA In Shell Empty State Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND / PHASE B CTA UI
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-03-B4b-CHECKPOINT.md`
**Source:** `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase B — B4 Resume Latest Project CTA (split: B4a handler wiring, B4b CTA UI)

**Objective:**
Behind `PROJECT_FIRST_UX`, add a single "Resume latest project" primary-action button to the existing `shellState === 'empty'` `StateMessage` in `WorkspaceShell`. The CTA computes the latest project from the existing `workspaceProjects` prop (by `updatedAt` descending, tie-break by project id) and calls the locked B4a `onResumeWorkspaceProjectById` callback. No route or IA change.

**Bounded scope:**
- Frontend only
- Primary implementation in `frontend/components/workspace/workspace-shell.tsx`:
  - Local helper to compute latest project from `workspaceProjects`
  - CTA mounted in the existing `shellState === 'empty'` `StateMessage` via its primary action seam
- Add one new additive copy entry in `frontend/lib/recovery-copy.ts`:
  - `actions.resumeLatestProject` (label: "Resume latest project")
- Add focused tests in `frontend/components/workspace/workspace-shell.test.tsx`
- Behavior:
  - Compute latest project from `workspaceProjects` only (not public projects)
  - Deterministic latest selection: `updatedAt` descending, tie-break by project id
  - Render CTA only when `PROJECT_FIRST_UX` is on, latest project exists, and `onResumeWorkspaceProjectById` is provided
  - Mount only in the existing `shellState === 'empty'` `StateMessage`
  - Clicking the CTA calls `onResumeWorkspaceProjectById(latestProject.id)` exactly once

**Non-goals:**
- No new route or IA change
- No change to nav/header
- No change to existing Open Project button
- No change to Reopen Project affordances
- No change to B4a handler internals
- No change to B0/B1/B2a/B2b/B3a paths
- No change to existing `recoveryCopy` entries other than the one additive resume-latest label
- No "last workspace touch" telemetry
- No backend/auth/schema/internal-API changes
- No autosave/history/persistence work
- No Phase C/D/E work

**Acceptance checks:**
- Flag off: no resume-latest CTA renders
- Flag on + non-empty `workspaceProjects` + `onResumeWorkspaceProjectById` provided: CTA renders in shell-empty state; click calls handler exactly once with resolved latest project id
- Flag on + empty `workspaceProjects`: CTA absent
- Flag on + handler absent: CTA absent
- Existing relevant focused test suites remain green
- Typecheck clean, no introduced lint errors
- No JSX/copy change outside shell-empty `StateMessage` and the single new copy entry

**Invariants to preserve:**
- Latest-project computation must use `workspaceProjects` only, not public projects
- `updatedAt` availability/shape to be verified during stage-start
- `PROJECT_FIRST_UX` remains the kill switch
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Dependencies:** PROJ-03-B4a (COMPLETE and LOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-B4b.

---

### PROJ-03-C1a — Add Read-Only Project History Panel Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND / PHASE C READ-ONLY HISTORY PANEL
**Checkpoint:** `C:\Users\knlee\aiSandBox2026B\docs\PROJ-03-C1a-CHECKPOINT.md`
**Source:** `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C1 Workspace History tab (split: C1a read-only panel, C1b Restore wiring)

**Objective:**
Behind `PROJECT_FIRST_UX`, add a read-only History panel inside the workspace that lists the current project's existing project-scoped snapshots newest-first, with a human label and timestamp. No Restore action, no writes, no new endpoints, no git-checkpoint union.

**Bounded scope:**
- Frontend only
- Reuse existing project-scoped snapshot data already available to the workspace/page flow — no new fetcher
- New local helper / view-model to derive `HistoryRow[]` from existing snapshot source
- Sort by `createdAt` descending; tie-break by snapshot id (deterministic)
- Mount the panel inside an existing workspace shell slot; no new layout primitive
- Empty state may use one additive `recoveryCopy` entry if needed
- Focused render tests only (flag off, flag on + snapshots, flag on + no snapshots)

**Non-goals:**
- No Restore action of any kind
- No git checkpoints in the list
- No autosave, named save, save dialog, or any write
- No backend changes, new endpoints, or new fetchers
- No retention/compaction
- No vocabulary purge ("snapshot" → "history") outside the new panel itself
- No change to existing snapshots panel
- No change to locked B-phase handlers (B0/B1/B2a/B2b/B3a/B4a/B4b)
- No change to A3 recovery copy bundle entries beyond one additive entry if needed
- No Phase D/E work

**Acceptance checks:**
- Flag off: no history panel visible anywhere
- Flag on + selected project + snapshots present: panel renders rows in deterministic newest-first order with label + timestamp
- Flag on + no snapshots: empty state renders correctly
- No Restore button, no row action, no write of any kind
- Existing focused suites remain green; typecheck clean; no introduced lint errors on touched files

**Invariants to preserve:**
- Reuse existing in-memory snapshot source only; do not create a parallel fetch path
- No layout regression outside the chosen existing workspace shell slot
- `PROJECT_FIRST_UX` remains the kill switch
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Dependencies:** PROJ-03-B4b (COMPLETE and LOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-C1a.

---

### PROJ-03-C1b-pre — Add Restore Project From Snapshot Handler Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND / PHASE C RESTORE HANDLER (PREPARATORY)
**Checkpoint:** `docs/PROJ-03-C1b-pre-CHECKPOINT.md`
**Source:** `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C1b split: C1b-pre handler-only slice

**Objective:**
Behind `PROJECT_FIRST_UX`, add a parameterized handler in `frontend/app/[locale]/app/page.tsx` that opens a supplied project at a supplied snapshot via the locked B0 helper in a freshly created session, mirroring the locked B4a hydration sequence exactly, and expose it as a new optional callback prop on `WorkspaceShell`. No UI consumer in this slice.

**Bounded scope:**
- Frontend only
- Primary implementation in `frontend/app/[locale]/app/page.tsx`:
  - New async handler: `handleRestoreWorkspaceProjectFromSnapshotById(projectId: string, snapshotId: string): Promise<void>`
  - Early return when `PROJECT_FIRST_UX` is false
  - Early return when normalized `projectId` is empty/invalid
  - Early return when normalized `snapshotId` is empty/invalid
  - Token guard mirrors B4a
  - Set `projectActionState('opening')`, clear messages/errors
  - Set `projectOpenInProgressRef.current = true` before helper call
  - Call `openProjectInFreshSession({ token, projectId, snapshotId })`
  - Mirror the same hydration follow-up sequence as B4a exactly
  - Set success message consistently (`Project opened.`)
  - Clear `projectOpenInProgressRef` and `skipNextSessionEffectFileReloadRef` in `finally`
- Add one new optional prop on `WorkspaceShell`:
  - `onRestoreWorkspaceProjectFromSnapshotById?: (projectId: string, snapshotId: string) => Promise<void>`
- Pass the new handler from `page.tsx` into `WorkspaceShell` only
- No UI consumer in this slice

**Non-goals:**
- No Restore button in `ProjectHistoryPanel` rows yet
- No recovery-copy restore label yet
- No change to C1a `ProjectHistoryPanel` JSX
- No change to `handleResumeWorkspaceProjectById` or any other locked handler
- No change to B0 helper internals
- No new fetcher, endpoint, or backend change
- No git-checkpoint integration
- No autosave, named save, retention/compaction, or vocabulary purge
- No Phase D/E work

**Acceptance checks:**
- New handler exists in `page.tsx` and is passed through the new optional `WorkspaceShell` prop
- Flag off: returns early before setting refs and before any API call
- Flag on + invalid/empty `projectId`: returns early without side effects
- Flag on + invalid/empty `snapshotId`: returns early without side effects
- Flag on + valid `projectId` + valid `snapshotId`: full hydration sequence runs and refs clear in `finally`
- Existing focused suites remain green
- Typecheck clean, no introduced lint errors
- No JSX/copy change in C1a panel
- `frontend/lib/open-project-in-fresh-session.ts` unchanged

**Invariants to preserve:**
- This is a handler-only preparatory slice; the visible Restore row button belongs to a follow-on slice
- Hydration follow-up sequence must mirror B4a exactly
- `projectOpenInProgressRef` and `skipNextSessionEffectFileReloadRef` must clear on every exit path
- The handler must read neither `selectedProjectId` nor `selectedSnapshotId` from React state
- `PROJECT_FIRST_UX` remains the kill switch
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Dependencies:** PROJ-03-C1a (COMPLETE and LOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-C1b-pre.

---

### PROJ-03-C1b-cta — Wire Restore Action On Project History Rows Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-C1b-cta-CHECKPOINT.md`
**Nature:** FRONTEND / PHASE C RESTORE BUTTON UI
**Source:** `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C1b split: C1b-cta visible Restore-button UI slice

**Objective:**
Behind `PROJECT_FIRST_UX`, render one Restore button per row in the locked C1a `ProjectHistoryPanel`, gated by an inline `window.confirm`, that calls the locked C1b-pre `onRestoreWorkspaceProjectFromSnapshotById` prop with `(selectedProjectId, row.id)`. No new handler, no new fetcher, no layout change.

**Bounded scope:**
- Frontend only
- Changes allowed in:
  - `frontend/lib/recovery-copy.ts`: two additive copy entries — Restore label and confirm text
  - `frontend/components/workspace/workspace-shell.tsx`: new optional `onRestore?: (snapshotId: string) => void` on `ProjectHistoryPanel`; derive local restore callback in `WorkspaceShell`; render row-level Restore button when callback exists
  - `frontend/components/workspace/workspace-shell.test.tsx`: 4–5 focused tests
- Handler derivation gated on: `projectFirstUxEnabled` + `selectedProjectId` + `onRestoreWorkspaceProjectFromSnapshotById`
- Click path: inline `window.confirm` guard (SSR-safe, mirrors A2b pattern); on accept → call handler once; on decline → no-op
- `page.tsx` unchanged in this slice

**Non-goals:**
- No change to C1b-pre handler internals
- No change to B0 helper
- No new fetcher, endpoint, or backend change
- No git-checkpoint union
- No autosave, named save, retention/compaction, or vocabulary purge
- No change to C1a row ordering, labels, timestamps, or empty-state behavior
- No change to existing `HistorySnapshotPanel` actions
- No new layout primitive
- No Phase D/E work

**Acceptance checks:**
- Flag off: no Restore button renders even when rows are present
- Flag on + `selectedProjectId` + handler provided + rows present: each row renders a Restore button with deterministic `data-testid="history-project-history-restore-{id}"`; click with confirm accepted calls handler exactly once with `(selectedProjectId, row.id)`
- Flag on + handler absent: no Restore button
- Flag on + `selectedProjectId` null: no Restore button
- Click with confirm declined: handler not called
- Existing focused suites remain green; typecheck clean; no introduced lint errors
- `page.tsx` unchanged; `frontend/lib/open-project-in-fresh-session.ts` unchanged

**Invariants to preserve:**
- This is the first visible Restore affordance in the new History panel; keep it narrowly bounded
- Inline confirm mirrors the locked A2b pattern exactly
- `selectedProjectId` captured at click time; no other state read for IDs
- `PROJECT_FIRST_UX` remains the kill switch
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Dependencies:** PROJ-03-C1b-pre (COMPLETE and LOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-C1b-cta.

---

### PROJ-03-C2a-rate-limit — Add Per-Minute Autosave Safety-Net Pure-Logic Helper Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-C2a-rate-limit-CHECKPOINT.md`
**Nature:** FRONTEND / PHASE C AUTOSAVE RATE-LIMIT SCAFFOLDING
**Source:** `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2 first slice: pure-logic safety-net helper

**Objective:**
Add a single pure-logic helper module (`frontend/lib/autosave-rate-limit.ts`) that defines the autosave rate-limit contract every future C2 trigger will use. No consumers, no write-path changes, no UI change. Mirrors the A0 mechanical-scaffolding pattern.

**Bounded scope:**
- Frontend only
- Changes allowed in:
  - `frontend/lib/autosave-rate-limit.ts` (new): pure-logic helper; exports `AUTOSAVE_MIN_INTERVAL_MS = 60_000` and `shouldAllowAutosaveNow({ now, lastSnapshotAt, minIntervalMs }): boolean`
  - `frontend/lib/autosave-rate-limit.test.ts` (new): comprehensive unit tests under `node:test`
- Pure logic only; no side effects, no consumer wiring
- No changes to `page.tsx`, `workspace-shell.tsx`, `workspace-snapshots.logic.ts`, `open-project-in-fresh-session.ts`, or any locked path

**Non-goals:**
- No trigger wiring of any kind
- No write-path change
- No UI change
- No new fetcher, no new effect, no new `useEffect`
- No backend change
- No label-format extension
- No retention/compaction (C3)
- No vocabulary purge (C4)
- No Phase D/E work
- No decision on where "last autosave timestamp" state lives (deferred to first consumer slice)

**Acceptance checks:**
- `shouldAllowAutosaveNow` returns `true` when `lastSnapshotAt` is `null`
- Returns `true` when `now - lastSnapshotAt >= minIntervalMs`
- Returns `false` when `now - lastSnapshotAt < minIntervalMs`
- Boundary behavior (exactly equal) is explicit and covered by tests
- Zero-interval and negative-interval inputs are explicit and covered by tests
- Pure function: identical inputs → identical outputs; no observable side effects
- Existing focused suites remain green; typecheck clean; no introduced lint errors
- No other production files changed

**Invariants to preserve:**
- Keep helper signature minimal; no over-design of future trigger state storage
- No consumer wiring in this slice
- `PROJECT_FIRST_UX` remains the kill-switch posture for any future consumer
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Dependencies:** PROJ-03-C1b-cta (COMPLETE and LOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-C2a-rate-limit.

---

### PROJ-03-C2b-trigger-preview — Add Preview-Start Success Autosave Trigger Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-C2b-trigger-preview-CHECKPOINT.md`
**Nature:** FRONTEND / PHASE C AUTOSAVE TRIGGER — PREVIEW-START SUCCESS
**Source:** `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2 first behavioral trigger slice

**Objective:**
Behind `PROJECT_FIRST_UX`, after a successful preview-start in `handleStartPreview`, attempt one project-scoped snapshot via the existing `saveWorkspaceSnapshot` fetcher and the locked C2a `shouldAllowAutosaveNow` rate-limit, then reload the user's snapshot list so the new row appears in the locked C1a `ProjectHistoryPanel`. Skip silently when the flag is off, when no project or session is selected, when project-open hydration is in progress, when rate-limited, or when the save fails. No UI surface change.

**Bounded scope:**
- Frontend only
- New files:
  - `frontend/lib/project-autosave.ts`: exports `attemptProjectAutosave(...)` helper; uses locked C2a `shouldAllowAutosaveNow`; reuses existing `saveWorkspaceSnapshot` + `buildProjectScopedSnapshotLabel`; returns discriminated result (`saved` / `skipped-rate-limited` / `failed`); never throws on save failure
  - `frontend/lib/project-autosave.test.ts`: focused unit tests under `node:test`
- Additive changes in `frontend/app/[locale]/app/page.tsx`:
  - One new import: `attemptProjectAutosave`
  - One new `useRef<number | null>(null)` declaration: `lastProjectAutosaveAtRef`
  - One additive block at end of `handleStartPreview` success branch, gated on `PROJECT_FIRST_UX && selectedProjectId && selectedSessionId && !projectOpenInProgressRef.current`
  - On `saved`: update last autosave ref + reload user snapshot list
  - On `skipped-rate-limited` or `failed`: no-op
- No change to `workspace-shell.tsx`, `recovery-copy.ts`, `workspace-snapshots.logic.ts`, `open-project-in-fresh-session.ts`, `handleSaveWorkspaceSnapshot`, or any locked C1 path

**Non-goals:**
- No UI affordance, toast, banner, or new status surface
- No change to `recovery-copy.ts`
- No change to `handleSaveWorkspaceSnapshot`
- No idle-debounce, AI-boundary, lifecycle, or named-save triggers
- No label-format extension
- No retention/compaction (C3)
- No vocabulary purge (C4)
- No git-checkpoint union (deferred C1c)
- No backend/auth/schema/internal-API change
- No new `useEffect`
- No Phase D/E work

**Acceptance checks:**
- Helper tests prove rate-limit skip path does not call save fetcher
- Helper tests prove save success returns `saved` and calls save once with correct project-scoped label
- Helper tests prove save failure returns `failed` without throwing
- Custom `minIntervalMs` override is honored
- Custom `fetchImpl` wiring is honored
- page.tsx trigger: flag off / no project / no session / open-in-progress each suppress helper call
- On `saved`: snapshot list reload occurs; new row visible in `ProjectHistoryPanel`
- Existing focused suites remain green; typecheck clean; no introduced lint errors
- No change to locked C1a/C1b-pre/C1b-cta/C2a-rate-limit paths

**Invariants to preserve:**
- This is the first autosave write trigger; bounded to preview-start success only
- `projectOpenInProgressRef` guard is mandatory even though `handleStartPreview` is not currently in the open-path chain
- In-memory ref only for last autosave timestamp in this slice; no persistence decision yet
- Save failure swallowed into helper result, not surfaced as new UI
- `PROJECT_FIRST_UX` remains the kill switch
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Dependencies:** PROJ-03-C2a-rate-limit (COMPLETE and LOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-C2b-trigger-preview.

---

### PROJ-03-C2c-label-format — Add Project Snapshot Label Name Extension Pure-Logic Helpers Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-C2c-label-format-CHECKPOINT.md`
**Nature:** FRONTEND / PHASE C SNAPSHOT LABEL FORMAT EXTENSION — PURE LOGIC
**Source:** `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2c first slice: label-format scaffolding

**Objective:**
Add pure-logic helpers that support an optional user-supplied name in project-scoped snapshot labels while preserving exact backward compatibility with the current unnamed `[project-id:...]` label shape produced and consumed since B0/B4. No consumers yet. No write-path change. No UI change. Mirrors the C2a-rate-limit and A0 mechanical-scaffolding pattern.

**Bounded scope:**
- Frontend only
- Allowed production changes:
  - `frontend/components/workspace/workspace-snapshots.logic.ts` (additive only):
    - Keep existing `buildProjectScopedSnapshotLabel(projectId)` output byte-identical for unnamed labels
    - Add either a sibling `buildProjectScopedSnapshotLabelWithName(projectId, name)` helper or a backward-compatible optional-name extension (preferred: sibling to avoid touching the existing exported signature)
    - Add `parseProjectScopedSnapshotName(label: string | null): string | null` helper
    - Preserve compatibility of `parseProjectIdFromSnapshotLabel` and `resolveProjectScopedLatestSnapshotId` for both old and new label shapes
- Allowed test changes:
  - `frontend/components/workspace/workspace-snapshots.logic.test.ts` (additive only)
- No consumer wiring in this slice

**Non-goals:**
- No named-save dialog
- No `page.tsx` named-save handler
- No `workspace-shell.tsx` UI or copy changes
- No change to preview autosave trigger behavior
- No change to `attemptProjectAutosave`
- No backend/API/schema change
- No retention/compaction (C3)
- No vocabulary purge (C4)
- No git-checkpoint union (deferred C1c)
- No Phase D/E work

**Acceptance checks:**
- Existing unnamed label build path remains byte-identical
- New named-label build path is deterministic and parseable back to the same `projectId`
- Existing project-id parser continues to work for both old and new label shapes
- New name parser returns trimmed name when present and `null` otherwise
- Empty/whitespace-only names normalize to the unnamed label shape (no `[name:]` artifact)
- Name normalization behavior (e.g. character stripping, length cap) is explicit and covered by tests
- Existing latest-snapshot resolution continues to work for both old and new label shapes
- Existing focused suites remain green; typecheck clean; no introduced lint errors
- No production file outside `workspace-snapshots.logic.ts` is touched

**Invariants to preserve:**
- Keep format extension unambiguous and backward-compatible
- No consumer wiring in this slice
- `PROJECT_FIRST_UX` remains the kill-switch posture for future consumers
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Dependencies:** PROJ-03-C2b-trigger-preview (COMPLETE and LOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-C2c-label-format.

---

### PROJ-03-C2c-handler — Add Named Project Snapshot Save Pure-Logic Helper Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-C2c-handler-CHECKPOINT.md`
**Nature:** FRONTEND / PHASE C NAMED SAVE PURE LOGIC — HELPER SCAFFOLDING
**Source:** `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2c second slice: named-save handler helper

**Objective:**
Provide a pure-logic helper that performs a single project-scoped named save by composing the locked C2c-label-format `buildProjectScopedSnapshotLabelWithName` helper with the existing `saveWorkspaceSnapshot` fetcher. Returns a discriminated result and never throws. No consumer wiring. No UI. Mirrors the helper-only scaffolding pattern used by C2a-rate-limit and C2c-label-format.

**Bounded scope:**
- Frontend only
- New file: `frontend/lib/project-named-save.ts`
  - Export `NamedProjectSaveResult` type: `{ status: 'saved'; savedSnapshot: WorkspaceSnapshotSummary } | { status: 'failed' }`
  - Export `attemptNamedProjectSave({ token, sessionId, projectId, name, fetchImpl? }): Promise<NamedProjectSaveResult>`
  - Uses `buildProjectScopedSnapshotLabelWithName(projectId, name)` to build the label
  - Calls `saveWorkspaceSnapshot` exactly once on success
  - Returns `{ status: 'saved', savedSnapshot }` on HTTP success
  - Returns `{ status: 'failed' }` on fetch rejection or non-ok response; never re-throws
- New test file: `frontend/lib/project-named-save.test.ts` (additive only)
- No changes to any existing production file
- No consumer imports in this slice

**Non-goals:**
- No `page.tsx` named-save handler or import
- No `workspace-shell.tsx` prop/UI/dialog changes
- No `recovery-copy.ts` changes
- No change to `attemptProjectAutosave` or `handleSaveWorkspaceSnapshot`
- No rate-limit gating (named saves are user-initiated)
- No backend/API/schema change
- No retention/compaction (C3)
- No vocabulary purge (C4)
- No git-checkpoint union (deferred C1c)
- No C2c-cta, C2c-display, C2d/C2e/C2f, C3, C4, or Phase D/E work

**Acceptance checks:**
- Helper uses `buildProjectScopedSnapshotLabelWithName(projectId, name)` to build the label
- Helper calls `saveWorkspaceSnapshot` exactly once on success
- Returns `{ status: 'saved', savedSnapshot }` on HTTP success
- Returns `{ status: 'failed' }` on fetch rejection
- Returns `{ status: 'failed' }` on non-ok HTTP response
- Blank/whitespace-only `name` results in the unnamed label shape being sent (delegated to `buildProjectScopedSnapshotLabelWithName`)
- Helper not imported anywhere in production code (verified by grep)
- No production file other than the new helper file is touched
- Existing focused suites remain green; typecheck clean; no introduced lint errors

**Invariants to preserve:**
- Helper-only; no consumer wiring in this slice
- Delegate name normalization entirely to locked `buildProjectScopedSnapshotLabelWithName`; do not re-implement trim/blank-fallback
- Do not refactor `attemptProjectAutosave` or create a shared abstraction in this slice
- `PROJECT_FIRST_UX` remains the kill-switch posture for future consumers (gating deferred to call site)
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Dependencies:** PROJ-03-C2c-label-format (COMPLETE and LOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-C2c-handler.

---

### PROJ-03-C2c-cta-handler-pre — Add Page-Level Named Project Save Handler Wired To Helper Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-C2c-cta-handler-pre-CHECKPOINT.md`
**Nature:** FRONTEND / PHASE C NAMED SAVE — PAGE HANDLER WIRING (NO UI)
**Source:** `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2c third slice: page-level handler pre-step

**Objective:**
Add one new `handleSaveNamedProjectSnapshot(name: string)` callback in `page.tsx` that calls the locked `attemptNamedProjectSave` helper, reloads the workspace snapshots list on success, and exposes the callback as a new optional `onSaveNamedProjectSnapshot` prop on `WorkspaceShell`. No visible UI in this slice.

**Bounded scope:**
- Frontend only
- Additive changes in `frontend/app/[locale]/app/page.tsx`:
  - New callback `handleSaveNamedProjectSnapshot(name: string): Promise<void>`
  - Gated on `PROJECT_FIRST_UX`; short-circuits when token, `selectedProjectId`, `selectedSessionId`, or `projectOpenInProgressRef.current` are missing/true
  - Calls locked `attemptNamedProjectSave({ token, sessionId, projectId, name })`
  - On `{ status: 'saved' }` → calls `loadWorkspaceSnapshotsForUser(token)` (best-effort reload)
  - On `{ status: 'failed' }` → logs and returns; no UI surface
  - Passes callback into `<WorkspaceShell ...>` as `onSaveNamedProjectSnapshot`
- Additive changes in `frontend/components/workspace/workspace-shell.tsx`:
  - New optional prop only: `onSaveNamedProjectSnapshot?: (name: string) => Promise<void>`
  - Prop is not consumed inside `WorkspaceShell` in this slice (no derived callback, no rendered element)

**Non-goals:**
- No visible button
- No dialog or `window.prompt`
- No `recovery-copy.ts` change
- No derived callback inside `WorkspaceShell`
- No change to `attemptNamedProjectSave`, `attemptProjectAutosave`, or label helpers
- No new effect, no new ref, no layout change
- No backend/API/schema change
- No retention/compaction (C3)
- No vocabulary purge (C4)
- No git-checkpoint union (deferred C1c)
- No C2c-cta-button, C2c-display, C2d/C2e/C2f, C3, C4, or Phase D/E work

**Acceptance checks:**
- New page-level handler exists and is passed into `WorkspaceShell`
- Handler is fully gated by flag / token / `selectedProjectId` / `selectedSessionId` / `projectOpenInProgressRef`
- On `{ status: 'saved' }`, snapshot list reload occurs (best-effort)
- On `{ status: 'failed' }`, no throw and no UI change
- `WorkspaceShell` optional prop is accepted without changing rendered output
- Existing focused suites remain green
- Typecheck clean, no introduced lint errors
- No visible UI added in this slice

**Invariants to preserve:**
- Handler must not fire while a project open is in flight (`projectOpenInProgressRef.current === true`)
- Snapshot reload best-effort only; no new failure path introduced
- `PROJECT_FIRST_UX` remains the kill-switch posture
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Dependencies:** PROJ-03-C2c-handler (COMPLETE and LOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-C2c-cta-handler-pre.

---

### PROJ-03-C2c-cta-button — Add Named Save Button With Prompt To Project History Panel Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-C2c-cta-button-CHECKPOINT.md`
**Nature:** FRONTEND / PHASE C NAMED SAVE — VISIBLE BUTTON UI
**Source:** `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2c fourth slice: named-save visible CTA

**Objective:**
Behind `PROJECT_FIRST_UX`, render one "Save" button in `ProjectHistoryPanel` that triggers `window.prompt` for a snapshot name, then calls the locked `onSaveNamedProjectSnapshot` prop. First visible user-initiated named-save affordance.

**Bounded scope:**
- Frontend only
- Additive changes in `frontend/lib/recovery-copy.ts`:
  - New copy entry for save button label (e.g. `actions.saveNamedSnapshot`)
  - New copy entry for prompt message (e.g. `workspace.saveNamedSnapshotPrompt`)
- Additive changes in `frontend/components/workspace/workspace-shell.tsx`:
  - New derived callback inside `WorkspaceShell` gated on `projectFirstUxEnabled` + `props.selectedProjectId` + `props.onSaveNamedProjectSnapshot`
  - Derived callback calls `window.prompt(...)` with the configured prompt message
  - SSR-safe guard: if `typeof window === 'undefined'`, do nothing
  - If prompt returns `null` (cancelled), do nothing
  - If prompt returns empty/whitespace-only string, do nothing
  - Otherwise calls `props.onSaveNamedProjectSnapshot(name)` with the trimmed name
  - New optional prop `onSave?: () => void` on `ProjectHistoryPanel`
  - One Save button rendered in `ProjectHistoryPanel` header area; renders only when `onSave` is present
  - Deterministic `data-testid`: `history-project-history-save`
  - `onSave={handleSaveNamedProjectSnapshot}` passed into `<ProjectHistoryPanel>` at the existing mount site
- Additive changes in `frontend/components/workspace/workspace-shell.test.tsx`:
  - Focused tests mirroring C1b-cta pattern (flag off/on, handler absent/present, prompt cancelled, prompt empty, prompt with text)
- No `page.tsx` change in this slice

**Non-goals:**
- No modal/dialog component; `window.prompt` only
- No change to `page.tsx` or `handleSaveNamedProjectSnapshot`
- No change to `attemptNamedProjectSave`, `attemptProjectAutosave`, or label helpers
- No change to history row ordering, timestamps, Restore buttons, or empty-state behavior
- No display of saved names in rows (that is C2c-display)
- No new effect, ref, or layout restructuring
- No backend/API/schema change
- No retention/compaction (C3)
- No vocabulary purge (C4)
- No git-checkpoint union (deferred C1c)
- No C2c-display, C2d/C2e/C2f, C3, C4, or Phase D/E work

**Acceptance checks:**
- Save button visible in `ProjectHistoryPanel` header when flag on + `selectedProjectId` present + handler present
- No Save button when flag off, or `selectedProjectId` absent, or handler absent
- Click triggers `window.prompt` with the configured prompt text
- Prompt cancelled → handler not called
- Prompt empty/whitespace → handler not called
- Prompt with text → `onSaveNamedProjectSnapshot` called with the prompted name
- Existing Restore buttons and history rows unchanged
- Existing focused suites remain green
- Typecheck clean, no introduced lint errors
- No visible history-row display change

**Invariants to preserve:**
- This is the first visible named-save UI; narrowly bounded to one button + prompt only
- `window.prompt` must be SSR-guarded (`typeof window === 'undefined'` check)
- Empty/blank input treated as cancel/do-nothing; handler not called
- No visible failure UI introduced in this slice
- `PROJECT_FIRST_UX` remains the kill-switch posture
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Dependencies:** PROJ-03-C2c-cta-handler-pre (COMPLETE and LOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-C2c-cta-button.

---

### PROJ-03-C2c-display — Show Parsed Snapshot Name In Project History Rows Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-C2c-display-CHECKPOINT.md`
**Nature:** FRONTEND / PHASE C NAMED SAVE — HISTORY ROW DISPLAY
**Source:** `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2c fifth slice: named-save row display

**Objective:**
Behind `PROJECT_FIRST_UX`, update project history row labeling so named snapshots show the parsed user-supplied name, while unnamed snapshots continue to display the existing default label. No layout change, no new component, no new prop, no handler change.

**Bounded scope:**
- Frontend only
- Changes allowed in `frontend/components/workspace/workspace-shell.tsx`:
  - Import locked `parseProjectScopedSnapshotName` from `workspace-snapshots.logic.ts`
  - Update `computeProjectHistoryRows(...)` `.map()` callback so the row label uses the parsed snapshot name when present, falling back to the existing default label when absent
  - Preserve existing sort/order, row structure, header, Save button, Restore button, timestamps, and empty state
- Additive changes in `frontend/components/workspace/workspace-shell.test.tsx`:
  - New fixture snapshots with named labels
  - Tests for named-label display, unnamed-label default, and mixed-list correctness
- No `page.tsx` change
- No `recovery-copy.ts` change
- No change to `workspace-snapshots.logic.ts`

**Non-goals:**
- No change to Save button or prompt flow
- No change to `page.tsx` handlers
- No change to `attemptNamedProjectSave`, `attemptProjectAutosave`, or label helpers
- No change to `ProjectHistoryPanel` layout or props
- No history row ordering change
- No timestamp or empty-state change
- No backend/API/schema change
- No retention/compaction (C3)
- No vocabulary purge (C4)
- No git-checkpoint union (deferred C1c)
- No C2d/C2e/C2f, C3, C4, or Phase D/E work

**Acceptance checks:**
- Named-label snapshots display the parsed user-supplied name
- Unnamed-label snapshots still display the existing default label
- Mixed lists render each row correctly
- Sort order unchanged
- Empty-state behavior unchanged
- Save button, Restore buttons, header, and timestamps unchanged
- Existing focused suites remain green
- Typecheck clean, no introduced lint errors
- No `page.tsx` change
- No new prop on `WorkspaceShell` or `ProjectHistoryPanel`

**Invariants to preserve:**
- Change narrowly bounded to history-row display text only
- Rely on locked `parseProjectScopedSnapshotName`; do not duplicate parsing logic
- Backward compatibility for unnamed / pre-C2c snapshots preserved
- `PROJECT_FIRST_UX` remains the kill-switch posture
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Dependencies:** PROJ-03-C2c-cta-button (COMPLETE and LOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-C2c-display.

---

### PROJ-03-C2d-expiry-warn — Add Session-Expiry Warning Autosave Trigger Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-C2d-expiry-warn-CHECKPOINT.md`
**Nature:** FRONTEND / PHASE C AUTOSAVE TRIGGER — SESSION-EXPIRY WARNING
**Source:** `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2d first slice: in-app expiry-warning lifecycle trigger

**Objective:**
Behind `PROJECT_FIRST_UX`, when the workspace detects a session-expiry warning (or equivalent session-terminated warning boundary), attempt one project-scoped autosave snapshot using the locked `attemptProjectAutosave` helper and the existing `lastProjectAutosaveAtRef` rate-limit ref, then reload the snapshot list. Skip silently when the flag is off, when no project or session is selected, when project-open hydration is in progress, when rate-limited, or when the save fails.

**Bounded scope:**
- Frontend only
- Additive production changes allowed in `frontend/app/[locale]/app/page.tsx`:
  - Identify the existing session-expiry / terminated-warning detection path
  - Add one guarded `attemptProjectAutosave(...)` call at that boundary
  - Reuse locked `attemptProjectAutosave`, `shouldAllowAutosaveNow`, and `lastProjectAutosaveAtRef`
  - Guards (all must pass): `PROJECT_FIRST_UX`, `selectedProjectId`, `selectedSessionId`, `!projectOpenInProgressRef.current`
  - On `saved`: update `lastProjectAutosaveAtRef.current`, reload snapshot list
  - On `skipped-rate-limited` or `failed`: no-op
- Additive test changes in the most appropriate existing frontend test file(s)
- No new helper module in this slice unless stage-start proves it absolutely necessary

**Non-goals:**
- No `beforeunload` / `pagehide` / `visibilitychange` / route-away handling (deferred to C2d-unload)
- No unload / close / beacon work
- No UI affordance, toast, banner, or new visible status surface
- No change to `workspace-shell.tsx` UI
- No change to named-save flow or label helpers
- No backend/API/schema change
- No retention/compaction (C3)
- No vocabulary purge (C4)
- No git-checkpoint union (deferred C1c)
- No C2d-unload/C2e/C2f, C3, C4, or Phase D/E work

**Acceptance checks:**
- Expiry-warning trigger fires → flag on + project + session + not hydrating + not rate-limited → one autosave attempt
- Rate-limited: skip silently
- Flag off: no autosave
- No project or no session: no autosave
- Project-open in progress: no autosave
- Autosave fails: no crash, no visible error
- Snapshot list reload on saved result
- Existing C2b preview-start trigger unaffected
- Existing C2c named-save flow unaffected
- Existing focused suites remain green
- Typecheck clean, no introduced lint errors

**Invariants to preserve:**
- Bounded to in-app session-expiry warning boundary only; unload/close deferred
- Reuse locked rate-limit and autosave helper patterns; no new save path
- `projectOpenInProgressRef` guard mandatory
- `PROJECT_FIRST_UX` remains the kill-switch posture
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Dependencies:** PROJ-03-C2c-display (COMPLETE and LOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-C2d-expiry-warn.

---

### PROJ-03-C2e — Add AI-Action-Boundary Autosave Trigger Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-C2e-CHECKPOINT.md`
**Nature:** FRONTEND / PHASE C AUTOSAVE TRIGGER — AI ACTION BOUNDARY
**Source:** `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2e: AI file-action coherence boundary trigger

**Objective:**
Behind `PROJECT_FIRST_UX`, after every Nth successful AI file-action coherence completion (`result.ran === true` from `runAiActionCoherence`), attempt one project-scoped autosave snapshot using the locked `attemptProjectAutosave` helper and the existing `lastProjectAutosaveAtRef` rate-limit ref. Reset the counter on any autosave attempt and on project switch. Skip silently when the flag is off, when guards fail, or when rate-limited.

**Bounded scope:**
- Frontend only
- Production changes to `frontend/app/[locale]/app/page.tsx`:
  - Add `aiActionsCompletedSinceLastAutosaveRef` (`useRef<number>`, initial value 0)
  - Define module-level constant `AI_ACTIONS_PER_AUTOSAVE = 5`
  - Modify `maybeRunExecutionCoherence` to capture the return value of `await runAiActionCoherence(...)`:
    - When `result.ran === true`: increment counter
    - When counter >= `AI_ACTIONS_PER_AUTOSAVE`: apply guards and call `attemptProjectAutosave(...)`
      - Guards (all must pass): `PROJECT_FIRST_UX`, token, `selectedProjectId`, `selectedSessionId`, `!projectOpenInProgressRef.current`
      - On `saved`: reset counter to 0, update `lastProjectAutosaveAtRef.current`, best-effort `void loadWorkspaceSnapshotsForUser(token)`
      - On `skipped-rate-limited` or `failed`: reset counter to 0
  - Reset counter to 0 on `selectedProjectId` change
- Additive test changes only if needed in existing frontend test files
- No new helper module

**Non-goals:**
- No unload/close lifecycle handling (C2d-unload deferred)
- No idle-debounce trigger (C2f)
- No change to `runAiActionCoherence(...)` module or `workspace-ai-coherence.logic.ts`
- No UI affordance, toast, banner, or visible status surface
- No change to `workspace-shell.tsx` UI
- No change to named-save flow or label helpers
- No backend/API/schema change
- No retention/compaction (C3)
- No vocabulary purge (C4)
- No git-checkpoint union (deferred C1c)
- No Phase D/E work

**Acceptance checks:**
- Every Nth coherence completion where `result.ran === true` triggers one autosave attempt when guards pass
- Fewer than N completions: no autosave from this trigger
- Counter resets to 0 after any autosave attempt (`saved`, `skipped-rate-limited`, or `failed`)
- Counter resets to 0 on project switch
- Flag off: no autosave, no active counter behavior
- `result.ran === false`: counter not incremented
- Existing C2b preview-start trigger unaffected
- Existing C2c named-save flow unaffected
- Existing C2d-expiry-warn trigger unaffected
- Existing focused suites remain green
- Typecheck clean, no introduced lint errors

**Invariants to preserve:**
- Modification bounded to `maybeRunExecutionCoherence` body only; no new save path
- Reuse locked rate-limit and autosave helper patterns
- Counter reset discipline mandatory
- `projectOpenInProgressRef` guard mandatory
- `PROJECT_FIRST_UX` remains the kill-switch posture
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Dependencies:** PROJ-03-C2d-expiry-warn (COMPLETE and LOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-C2e.

---

### PROJ-03-C2f-file-save — Add User-File-Save Autosave Trigger Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-C2f-file-save-CHECKPOINT.md`
**Nature:** FRONTEND / PHASE C AUTOSAVE TRIGGER — USER FILE SAVE
**Source:** `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2f first slice: user file-save boundary trigger

**Objective:**
Behind `PROJECT_FIRST_UX`, after the user successfully saves a file via `handleSaveWorkspaceFile`, attempt one project-scoped autosave snapshot using the locked `attemptProjectAutosave` helper and the existing `lastProjectAutosaveAtRef` rate-limit ref. Skip silently when the flag is off, when guards fail, or when rate-limited.

**Bounded scope:**
- Frontend only
- Additive production changes allowed in `frontend/app/[locale]/app/page.tsx`:
  - In `handleSaveWorkspaceFile`, after the stale-request guard and after saved-state updates, add one guarded autosave attempt
  - Guards (all must pass): `PROJECT_FIRST_UX`, token (already in scope), `selectedProjectId`, `selectedSessionId` (already validated), `!projectOpenInProgressRef.current`
  - Call locked `attemptProjectAutosave(...)` with `lastProjectAutosaveAtRef.current`
  - On `saved`: update `lastProjectAutosaveAtRef.current`, best-effort `void loadWorkspaceSnapshotsForUser(token)`
  - On `skipped-rate-limited` or `failed`: no-op
- Additive test changes only if needed in existing frontend test files
- No new helper module

**Non-goals:**
- No timer-based idle debounce (C2f-idle-timer deferred)
- No max-deferral behavior
- No debounce on editor keystrokes or unsaved Monaco buffer changes
- No unload/close lifecycle handling (C2d-unload deferred)
- No change to `workspace-shell.tsx` UI
- No change to named-save flow or label helpers
- No backend/API/schema change
- No retention/compaction (C3)
- No vocabulary purge (C4)
- No git-checkpoint union (deferred C1c)
- No Phase D/E work

**Acceptance checks:**
- Successful file save (flag on + project + session + not hydrating + not rate-limited) → one autosave attempt
- Rate-limited: skip silently
- Flag off: no autosave
- No project selected: no autosave
- Project-open in progress: no autosave
- File save fails (`writeWorkspaceFile` throws): no autosave attempted
- File save superseded (stale requestId): no autosave attempted
- Existing C2b preview-start trigger unaffected
- Existing C2c named-save flow unaffected
- Existing C2d-expiry-warn trigger unaffected
- Existing C2e AI-action trigger unaffected
- Existing focused suites remain green
- Typecheck clean, no introduced lint errors

**Invariants to preserve:**
- Bounded to successful file-save boundary only; autosave placed after stale-request guard
- Snapshot reload best-effort and must not interfere with file-save success path
- Reuse locked rate-limit and autosave helper patterns; no new save path
- `projectOpenInProgressRef` guard mandatory
- `PROJECT_FIRST_UX` remains the kill-switch posture
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Dependencies:** PROJ-03-C2e (COMPLETE and LOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-C2f-file-save.

---

### PROJ-03-C4 — Replace User-Facing Snapshot Wording With History Vocabulary Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-C4-CHECKPOINT.md`
**Nature:** FRONTEND / PHASE C UX VOCABULARY — USER-FACING WORDING ONLY
**Source:** `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C4: vocabulary swap
**Dependencies:** PROJ-03-C2f-file-save (COMPLETE and LOCKED)

**Objective:**
Behind `PROJECT_FIRST_UX`, replace user-facing strings that say "snapshot/snapshots" with the project-first "history/save" vocabulary already adopted in `ProjectHistoryPanel` and related project-first UI surfaces. Keep all internal TypeScript identifiers, helpers, DTOs, routes, and backend concepts unchanged.

**Bounded scope:**
- Frontend only
- Additive or narrowly scoped wording changes only in user-facing frontend files rendered when `PROJECT_FIRST_UX` is on
- Behavior:
  - Update user-visible wording on `PROJECT_FIRST_UX` surfaces from snapshot/snapshots to history/save vocabulary where appropriate
  - Preserve legacy wording when `PROJECT_FIRST_UX` is off (kill-switch)
  - Do not rename internal TypeScript identifiers, helpers, DTO names, route names, or backend concepts
  - Prefer existing centralized copy sources where already present; otherwise keep changes minimal and localized
- No backend/API/schema change

**Non-goals:**
- No rename of TypeScript identifiers such as `WorkspaceSnapshotSummary`, `loadWorkspaceSnapshotsForUser`, `saveWorkspaceSnapshot`, etc.
- No backend route / DTO / DB column rename
- No change to label formats (`[project-id:...]` / `[project-id:...:name:...]`)
- No change to `ProjectHistoryPanel` layout or behavior
- No autosave trigger changes
- No retention/compaction (C3)
- No git-checkpoint union (C1c)
- No Phase D/E work

**Acceptance checks:**
- With `PROJECT_FIRST_UX=true`, targeted user-facing project-first surfaces no longer use snapshot wording where history/save vocabulary is intended
- With `PROJECT_FIRST_UX=false`, legacy wording remains unchanged
- Typecheck clean
- Focused regression suite green
- No introduced lint errors
- No internal identifier renames

**Invariants to preserve:**
- Cosmetic/user-facing only; no behavioral change
- `PROJECT_FIRST_UX` remains the kill-switch posture
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-C4.

---

### PROJ-03-D0 — Project-First Entry Shell Wiring Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-D0-CHECKPOINT.md`
**Nature:** FRONTEND / PHASE D ENTRY-SHELL WIRING
**Source:** Diagnostic gap identified post-PROJ-03-C4; closes the session-first visible entry shell
**Dependencies:** PROJ-03-C4 (COMPLETE and LOCKED)

**Objective:**
Behind `PROJECT_FIRST_UX`, make the visible entry shell behave consistently with the already-locked project-first handlers. The current local dev env has `PROJECT_FIRST_UX` off by default (no `NEXT_PUBLIC_PROJECT_FIRST_UX` env var is set in a normal local run). Even when the flag is on, the entry shell remains session-first because: (a) the "New Session" button is rendered unconditionally, and (b) Create/Open Project buttons are gated by `selectedSessionId`. The underlying `page.tsx` handlers already provision fresh sessions automatically. This slice wires the entry-shell surface to match handler semantics, without building a new landing page UI.

**Bounded scope:**
- Frontend only
- Narrow changes allowed in:
  - `frontend/components/workspace/workspace-shell.tsx`
  - `frontend/components/workspace/workspace-shell.test.tsx`
  - local-dev flag enablement/documentation surface only if needed for testing clarity
- Behavior:
  - When `PROJECT_FIRST_UX` is true:
    - Do not render the New Session button block
    - Allow Create Project without requiring `selectedSessionId`
    - Allow Open Project without requiring `selectedSessionId`
  - When `PROJECT_FIRST_UX` is false:
    - Keep current behavior byte-equivalent
  - Reuse existing `page.tsx` handlers as-is; no handler change
  - No change to `/[locale]/projects/page.tsx` route pass-through behavior in this slice
- No backend/API/schema change

**Non-goals:**
- No dedicated `/projects` landing page
- No redesign of `AppPage`
- No change to project history/autosave/restore/named save handlers
- No route redesign
- No removal of legacy code paths when flag is off
- No Phase D/E follow-up beyond this bounded entry-shell wiring
- No change to internal identifiers or helper names

**Acceptance checks:**
- With `PROJECT_FIRST_UX=true`:
  - New Session button absent
  - Create Project button usable without `selectedSessionId`
  - Open Project button usable without `selectedSessionId` (subject to existing `selectedProjectId` requirement only)
- With `PROJECT_FIRST_UX=false`:
  - Legacy entry shell unchanged
- Existing handler behavior remains unchanged and reused
- Existing focused suites remain green
- Typecheck clean, no introduced lint errors

**Invariants to preserve:**
- Entry-shell wiring only; no new landing page
- Do not alter underlying handler semantics
- `PROJECT_FIRST_UX` remains the kill-switch posture
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-D0.

---

### PROJ-03-D0b — Enable PROJECT_FIRST_UX In Local Docker Frontend Build For Testing

**Status:** PLANNED
**Checkpoint:** `docs/PROJ-03-D0b-CHECKPOINT.md`
**Nature:** CONFIG / LOCAL TESTING ENABLEMENT
**Source:** Post-D0 diagnostic: `NEXT_PUBLIC_PROJECT_FIRST_UX` not passed as build arg in `docker-compose.prod.yml`; Next.js inlines `NEXT_PUBLIC_*` at build time so the D0 bundle shipped with the flag off
**Dependencies:** PROJ-03-D0 (COMPLETE and LOCKED)

**Objective:**
Enable the already-implemented project-first frontend path in the local Docker production-style frontend by wiring `NEXT_PUBLIC_PROJECT_FIRST_UX=true` into the frontend build args in `docker-compose.prod.yml`. No code changes. D0 UX logic is already locked; this slice makes it reachable at `http://localhost:3000/en/app` after a frontend service rebuild.

**Bounded scope:**
- Config/testing slice only
- One file: `docker-compose.prod.yml` — add `NEXT_PUBLIC_PROJECT_FIRST_UX: "true"` to the `frontend.build.args` block
- No frontend component/code changes
- No handler changes
- No route changes
- No backend/service config changes

**Non-goals:**
- No frontend component or code changes
- No dedicated `/projects` landing page
- No broader env/config refactor
- No dev-server `.env.local` work in this slice
- No deployment pipeline redesign
- No production release policy change
- No D1, no C3, no C2d-unload

**Acceptance checks:**
- Rebuilding the frontend service from `docker-compose.prod.yml` produces a bundle with `PROJECT_FIRST_UX` enabled
- At `http://localhost:3000/en/app`, locked D0 behavior is visible: New Session hidden; Create Project usable without selected session; Open Project usable without selected session when a project is selected
- No code changes to `workspace-shell.tsx` or page handlers required
- No introduced compose syntax errors

**Invariants to preserve:**
- Local Docker testing enablement only; no production release implications
- Scope limited to the single frontend build arg in `docker-compose.prod.yml`
- All locked D0 handler/component semantics unchanged
- `PROJECT_FIRST_UX` remains the kill-switch posture in code

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-D0b.

---

### PROJ-03-D0c — Load Project List In Project-First No-Session Entry Path

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-D0c-CHECKPOINT.md`
**Nature:** FRONTEND / LOAD-PATH WIRING
**Source:** Post-D0b diagnostic: `loadWorkspaceProjectsForUser(token)` is only invoked from the `[selectedSessionId]` effect which early-returns when `selectedSessionId` is null; on project-first entry there is no session yet so the project picker appears empty even though projects exist
**Dependencies:** PROJ-03-D0b (COMPLETE and LOCKED)

**Objective:**
Behind `PROJECT_FIRST_UX`, ensure the existing project picker is populated on first entry even when no session is selected, by calling the user-scoped project list loader from the token/bootstrap path rather than relying only on the session-keyed effect.

**Bounded scope:**
- Frontend only
- Narrow changes allowed in:
  - `frontend/app/[locale]/app/page.tsx` — add `loadWorkspaceProjectsForUser(token)` call (and optionally `loadPublicWorkspaceProjectsList()`) in the existing bootstrap/token-availability path, guarded by `PROJECT_FIRST_UX`
  - directly relevant tests only if needed
- Behavior:
  - When `PROJECT_FIRST_UX` is true and a token is available in the bootstrap path, call `loadWorkspaceProjectsForUser(token)` so existing user-owned projects appear in the project picker before any session is created
  - Keep the existing `[selectedSessionId]` effect fully intact
  - No backend/API/schema changes
  - No new UI surface
  - No landing-page redesign

**Non-goals:**
- No dedicated `/projects` landing page
- No redesign of `AppPage`
- No change to project create/open handlers
- No change to project history/autosave/restore/named save behavior
- No route redesign
- No backend changes
- No D1
- No C3 / C2d-unload work

**Acceptance checks:**
- With `PROJECT_FIRST_UX=true` and no selected session, existing user-owned projects are fetched and appear in the existing project picker on first entry
- With `PROJECT_FIRST_UX=false`, legacy behavior unchanged
- Existing `[selectedSessionId]`-driven behavior remains intact and unmodified
- Typecheck clean
- Focused regression suite green
- No introduced lint errors

**Invariants to preserve:**
- Load-path wiring only; no new surface
- Do not change backend behavior
- `PROJECT_FIRST_UX` remains the kill-switch posture
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-D0c.

---

### PROJ-03-D0d — Add Tab-Scoped Project And Session Selection Seed Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-D0d-CHECKPOINT.md`
**Nature:** FRONTEND / TAB ISOLATION
**Source:** Post-D0c diagnostic: `selectedProjectId` and `selectedSessionId` are React-only state; on refresh they reset to null; bootstrap reload + default-selection logic picks the first project/session from backend lists (ordered `updatedAt DESC`); two tabs independently converge onto the same most-recent project after refresh
**Dependencies:** PROJ-03-D0c (COMPLETE and LOCKED)

**Objective:**
Behind `PROJECT_FIRST_UX`, persist `selectedProjectId` and `selectedSessionId` in tab-scoped `sessionStorage` and seed them back into the initial project/session selection flow on cold mount, so each browser tab/window can retain its own project/session after refresh without changing backend behavior or routing.

**Bounded scope:**
- Frontend only
- Narrow changes allowed in:
  - `frontend/app/[locale]/app/page.tsx` — write selections to `sessionStorage` on change; read seed on cold mount bootstrap; honor seed only if it still exists in freshly loaded lists; fall back to existing default-selection behavior otherwise
  - directly relevant tests only if needed
- Behavior (when `PROJECT_FIRST_UX` is true):
  - write `selectedProjectId` to `sessionStorage` when it changes
  - write `selectedSessionId` to `sessionStorage` when it changes
  - on cold mount/bootstrap, read seeded project/session ids from `sessionStorage`
  - allow those seeds to win only if they still exist in the freshly loaded project/session lists
  - otherwise fall back to existing default-selection behavior (first usable item)
  - keep existing `[selectedSessionId]` effect intact and unmodified
  - no backend/API/schema changes
  - no route changes
  - no new UI surface

**Non-goals:**
- No URL parameter or route-based selection
- No dedicated `/projects` landing page
- No redesign of `AppPage`
- No change to project create/open handlers
- No change to project history/autosave/restore/named save behavior
- No backend changes
- No D1
- No C3 / C2d-unload work

**Acceptance checks:**
- With `PROJECT_FIRST_UX=true`, Window A and Window B can keep different `selectedProjectId`/`selectedSessionId` after refresh
- Valid `sessionStorage` seed is honored over the current first-item default
- Invalid/missing/expired seed falls back to current default-selection behavior
- With `PROJECT_FIRST_UX=false`, legacy behavior unchanged
- Existing `[selectedSessionId]`-driven behavior remains intact
- Typecheck clean
- Focused regression suite green
- No introduced lint errors

**Risks and invariants:**
- Tab-scoped selection seeding only; do not move auth or other global state out of `localStorage`
- Do not change backend behavior or project/session ordering
- Seed must be applied only on cold mount/bootstrap, not during in-progress project open (`projectOpenInProgressRef`)
- Seed must only win when it matches freshly loaded lists; invalid seed is silently discarded
- `PROJECT_FIRST_UX` remains the kill-switch posture
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-D0d.

---

### PROJ-03-C2e-hotfix — Autosave After Every Successful AI Action Boundary Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-C2e-hotfix-CHECKPOINT.md`
**Nature:** FRONTEND / AUTOSAVE CADENCE HOTFIX
**Source:** Post-C2e behavioral gap: current `AI_ACTIONS_PER_AUTOSAVE = 5` threshold counter only captures a project autosave snapshot after every 5th successful AI coherence completion; AI-created/modified files can still be lost if the browser/session ends before the threshold is reached and before another autosave trigger fires. The backend filesystem write already happened; only project history/snapshot capture is delayed.
**Dependencies:** PROJ-03-C2e (COMPLETE and LOCKED)

**Objective:**
Behind `PROJECT_FIRST_UX`, change the AI-action autosave trigger so every successful AI coherence completion (`coherenceResult.ran === true`) attempts a project autosave immediately, instead of waiting for the 5-action threshold. Reuse the existing `attemptProjectAutosave(...)` path and all existing guards. No UI change.

**Bounded scope:**
- Frontend only
- Narrow changes allowed in:
  - `frontend/app/[locale]/app/page.tsx` — remove or bypass the every-5th threshold logic in the C2e path so autosave is attempted after each successful coherence completion
  - directly relevant tests only if needed
- Behavior:
  - Remove or bypass the current every-5th threshold logic in the C2e path
  - After each successful AI coherence completion, attempt autosave immediately
  - Preserve all existing guards: `PROJECT_FIRST_UX`, token present, `selectedProjectId` present, `selectedSessionIdRef.current` present, `!projectOpenInProgressRef.current`
  - Preserve existing result handling: on saved → update `lastProjectAutosaveAtRef.current` and best-effort reload workspace snapshots; on skipped-rate-limited or failed → no crash, no UI change
  - No backend/API/schema change
  - No new UI surface

**Non-goals:**
- No manual editor draft protection
- No unload/close lifecycle handling
- No change to preview-start autosave
- No change to expiry-warning autosave
- No change to explicit file-save autosave
- No change to named-save flow
- No backend changes
- No D1
- No C3 / C2d-unload work
- No Phase D/E work

**Acceptance checks:**
- Each successful AI coherence completion now attempts autosave immediately when guards pass
- No threshold counter remains in effect for AI autosave
- Existing guards and best-effort snapshot reload behavior remain intact
- With `PROJECT_FIRST_UX=false`, legacy behavior unchanged
- Typecheck clean
- Focused regression suite green
- No introduced lint errors

**Risks and invariants:**
- Keep this to AI autosave cadence only
- Do not change non-AI autosave triggers (preview-start, expiry-warning, explicit file-save, named-save)
- Do not introduce UI/UX surface changes
- Preserve existing C2e guard behavior and no-crash behavior
- `PROJECT_FIRST_UX` remains the kill-switch posture
- Preserve all existing behavior except the AI autosave threshold cadence
- Existing rate-limit (`attemptProjectAutosave`) provides natural backpressure when AI actions land in tight bursts
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-C2e-hotfix.

---

### PROJ-03-D0e — Restore Unsaved Editor Draft Per Tab Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-D0e-CHECKPOINT.md`
**Nature:** FRONTEND / TAB-SCOPED DRAFT PERSISTENCE
**Source:** Post-D0d gap: manual editor typing that was never explicitly saved to disk lives only in frontend state and is lost on refresh/close. AI-created file loss was addressed by C2e-hotfix; this slice covers the remaining human-typed-but-unsaved buffer case.
**Dependencies:** PROJ-03-D0d (COMPLETE and LOCKED)

**Objective:**
Behind `PROJECT_FIRST_UX`, persist the current unsaved editor buffer in tab-scoped `sessionStorage` and restore it when the same tab returns to the same project/session/file context, so manual unsaved typing is not lost on refresh/close unless the tab is fully gone or the draft is no longer applicable. Do not autosave the workspace file to disk in this slice.

**Bounded scope:**
- Frontend only
- Narrow changes allowed in:
  - `frontend/app/[locale]/app/page.tsx`
  - directly relevant tests only if needed
- Behavior (when `PROJECT_FIRST_UX` is true):
  - persist unsaved editor draft content in `sessionStorage`
  - key the draft by the current project/session/file context
  - restore the draft only when the current tab returns to the same applicable context
  - remove the draft when the file is successfully saved or when the draft is no longer applicable
  - no backend/API/schema changes
  - no true save-to-disk autosave
  - no new UI surface unless strictly required
  - keep the current explicit save flow intact

**Non-goals:**
- No backend autosave of editor contents
- No unload/close lifecycle handling
- No cross-tab draft sharing
- No URL/routing changes
- No project create/open handler changes
- No D1
- No C3 / C2d-unload work
- No Phase D/E work

**Acceptance checks:**
- With `PROJECT_FIRST_UX=true`, unsaved typing in the editor survives refresh within the same tab for the same applicable file/project/session context
- Explicit file save clears or supersedes the stored draft appropriately
- Draft does not restore into the wrong file/project/session context
- With `PROJECT_FIRST_UX=false`, legacy behavior unchanged
- Typecheck clean
- Focused regression suite green
- No introduced lint errors

**Risks and invariants:**
- Keep this to draft persistence only, not disk persistence
- Do not silently overwrite actual workspace files
- Do not move auth/global state out of `localStorage`
- Keep draft storage tab-scoped only
- Draft restore must be context-matched and conservative
- `PROJECT_FIRST_UX` remains the kill-switch posture
- Preserve all existing behavior except per-tab unsaved draft restoration in the flag-on path
- No regression to project-open hydration / restore discipline (PROJ-02-01)
- No regression to snapshot-store persistence (PROJ-01-21)
- No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03)
- No regression to static preview `/workspace/index.html` rule (PREV-02-02)
- No regression to stop-session cleanup behavior (OPS-01-04)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-D0e.

---

### PROJ-03-D0e-hotfix — Fix Draft Restore Match And One-Shot Consumption Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-D0e-hotfix-CHECKPOINT.md`
**Nature:** FRONTEND / TAB-SCOPED DRAFT PERSISTENCE / BUG FIX
**Source:** Post-D0e inspection: the D0e write path is correct but the restore path has two defects — the cold-mount draft ref is cleared unconditionally on the first `loadWorkspaceFileContent` call (one-shot consumption regardless of match outcome), and the `projectId` check compares against `selectedProjectId` which may still be `null` at the time of the first file load after refresh (project-list fetch races behind session/file hydration). Result: draft restore fails silently and the draft is permanently discarded.
**Dependencies:** PROJ-03-D0e (COMPLETE and LOCKED)

**Objective:**
Behind `PROJECT_FIRST_UX`, fix the D0e restore-path bug so a tab-scoped unsaved editor draft is not discarded before a valid restore match occurs, and so project matching tolerates the bootstrap hydration race after refresh. Preserve the existing conservative per-tab draft model and explicit save flow.

**Bounded scope:**
- Frontend only
- Narrow changes allowed in:
  - `frontend/app/[locale]/app/page.tsx`
  - directly relevant tests only if needed
- Behavior:
  - only clear the cold-mount draft ref after a successful restore match
  - keep failed/non-matching first load attempts from discarding the draft
  - make project match use current `selectedProjectId` when available, otherwise fall back to the tab-seeded project id from `sessionStorage` (the D0d seed source `TAB_SELECTED_PROJECT_STORAGE_KEY`) during the cold-mount restore path
  - preserve existing `sessionId` and `filePath` exact-match requirements
  - no backend/API/schema changes
  - no true save-to-disk autosave
  - no new UI surface
  - keep the current explicit save flow intact

**Non-goals:**
- No true autosave-to-disk
- No unload/close lifecycle handling
- No cross-tab draft sharing
- No URL/routing changes
- No project create/open handler changes
- No D1
- No C3 / C2d-unload work
- No Phase D/E work

**Acceptance checks:**
- With `PROJECT_FIRST_UX=true`, unsaved typing still writes to `sessionStorage` as before
- On refresh in the same tab, draft restore succeeds for the same project/session/file context even when `selectedProjectId` hydrates later than the first file load
- Non-matching first load attempts do not discard the draft prematurely
- Explicit file save still clears the draft appropriately
- With `PROJECT_FIRST_UX=false`, legacy behavior unchanged
- Typecheck clean
- Focused regression suite green
- No introduced lint errors

**Risks and invariants:**
- Keep this to D0e restore-path correction only
- Do not broaden into true autosave-to-disk
- Do not change write-path semantics except as needed to preserve restore correctness
- Do not silently overwrite actual workspace files
- Keep draft storage tab-scoped only
- Restore must remain conservative and context-matched
- `PROJECT_FIRST_UX` remains the kill-switch posture
- Preserve all existing behavior except fixing the restore-path race/consumption bug
- No regression to: project-open hydration / restore discipline; snapshot/history persistence behavior; `.git/` exclusion from snapshots/restores; static preview `/workspace/index.html` rule; stop-session cleanup behavior

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-D0e-hotfix.

---

### PROJ-03-D1a — Add Unified Versions Entry Point And Last-Protected Indicator Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-D1a-CHECKPOINT.md`
**Nature:** FRONTEND / UX DISCOVERABILITY
**Source:** Post-D0e-hotfix gap: the app now has multiple protection mechanisms (project history, named saves, restore, autosaves, AI autosave hotfix, tab-scoped draft persistence) but no single obvious user-facing entry point to discover them. Users lack a clear "I can always go back" reassurance signal.
**Dependencies:** PROJ-03-D0e-hotfix (COMPLETE and LOCKED)

**Objective:**
Behind `PROJECT_FIRST_UX`, add one obvious user-facing "Versions" / "History" entry point and one small "last protected" reassurance indicator so users can discover the existing version/history protection model without changing backend behavior or redesigning the entire project history UX.

**Bounded scope:**
- Frontend only
- Narrow changes allowed in:
  - `frontend/components/workspace/workspace-shell.tsx`
  - `frontend/lib/recovery-copy.ts`
  - directly relevant tests only if needed
- Behavior:
  - add one clear History / Versions entry point in the existing project-first workspace surface
  - add one small visible reassurance indicator (e.g. "last protected" / "last saved version") grounded in already-available history state
  - reuse existing project history / named save / restore surfaces and data
  - no backend/API/schema changes
  - no new route
  - no full history redesign
  - no diff/preview flow
  - keep `PROJECT_FIRST_UX` as the gate

**Non-goals:**
- No dedicated /projects or /versions landing page
- No diff viewer
- No preview-before-restore
- No true editor autosave-to-disk
- No unload handling
- No backend changes
- No git-system redesign
- No broader D1 redesign beyond this small discoverability/reassurance slice
- No C3 / C2d-unload work
- No Phase D/E work

**Acceptance checks:**
- With `PROJECT_FIRST_UX=true`, users can clearly find the existing history/versions surface from an obvious entry point
- With `PROJECT_FIRST_UX=true`, a small "last protected" style reassurance indicator is visible and grounded in existing state
- With `PROJECT_FIRST_UX=false`, legacy behavior unchanged
- Existing save/history/restore behavior unchanged
- Typecheck clean
- Focused regression suite green
- No introduced lint errors

**Risks and invariants:**
- Keep this UX-only and additive
- Do not invent misleading reassurance text not backed by actual existing state
- Reuse existing history state rather than adding new backend calls if possible
- Do not change actual save/restore semantics in this slice
- `PROJECT_FIRST_UX` remains the kill-switch posture
- Preserve all existing protection behavior; only improve discoverability and confidence
- No regression to: project-open hydration / restore discipline; snapshot/history persistence behavior; `.git/` exclusion from snapshots/restores; static preview `/workspace/index.html` rule; stop-session cleanup behavior

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-D1a.

---

### PROJ-03-D1b — Add Source-Tagged Automatic Version Labels Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-D1b-CHECKPOINT.md`
**Nature:** FRONTEND / UX LABEL IMPROVEMENT
**Source:** Post-D1a gap: all automatic saves (AI, file-save, preview, expiry) produce the identical label `[project-id:<id>]`, which renders as the generic fallback `'Saved version'` in the history list. Users cannot distinguish AI saves, file saves, preview builds, or session-expiry saves from each other by label alone.
**Dependencies:** PROJ-03-D1a (COMPLETE and LOCKED)

**Objective:**
Behind `PROJECT_FIRST_UX`, make automatic project-history entries easier to distinguish by encoding a stable source tag into automatic snapshot labels and rendering source-specific fallback names in the history list, while leaving manual named saves unchanged.

**Bounded scope:**
- `frontend/components/workspace/workspace-snapshots.logic.ts`
- `frontend/lib/project-autosave.ts`
- `frontend/app/[locale]/app/page.tsx`
- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/lib/recovery-copy.ts`
- Directly relevant tests only if needed

**Key constraints:**
- Source tags are stable and internal only (e.g. `'ai'`, `'file-save'`, `'preview'`, `'expiry'`), not display strings, in stored labels
- Old labels without a source tag fall back cleanly to the existing `'Saved version'` generic label
- Manual named saves are unchanged
- No backend/API/schema changes
- `PROJECT_FIRST_UX` kill-switch preserved
- No regression to hydration/restore/snapshot invariants

**Acceptance checks:**
- Automatic AI/file-save/preview/expiry history entries render distinct, clearer labels
- Manual named saves continue to render the user-supplied name unchanged
- Older unlabeled entries still render safely with the existing generic fallback
- Timestamp display remains separate and unchanged
- `PROJECT_FIRST_UX=false` → legacy behavior unchanged
- Typecheck clean, lint clean, focused regression suite green

**Non-goals:**
- No backend or schema changes
- No manual named-save redesign
- No diff viewer
- No broader D1 history redesign
- No C3 / C2d-unload work

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-D1b.

---

### PROJ-03-D1c — Add Heuristic Content-Related Automatic Version Labels Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-D1c-CHECKPOINT.md`
**Nature:** FRONTEND / UX LABEL IMPROVEMENT
**Source:** Post-D1b gap: source-only labels like "AI changes saved" are still too generic when multiple nearby automatic versions exist. Deterministic heuristics derived from already-available saved context (changed file paths, file counts, trigger source) can make these labels more distinguishable without AI-generated labeling.
**Dependencies:** PROJ-03-D1b (COMPLETE and LOCKED)

**Objective:**
Behind `PROJECT_FIRST_UX`, improve automatic project-history labels using deterministic heuristics derived from existing saved context (changed file paths / file counts / trigger source) so nearby versions are easier to distinguish, without requiring AI-generated labels.

**Bounded scope:**
- `frontend/components/workspace/workspace-snapshots.logic.ts`
- `frontend/lib/project-autosave.ts`
- `frontend/app/[locale]/app/page.tsx`
- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/lib/recovery-copy.ts`
- Directly relevant tests only if needed

**Key constraints:**
- Deterministic heuristics only — no AI call, no async naming pipeline
- Preserve manual named saves unchanged
- Preserve backward compatibility with older source-tagged or unlabeled entries
- No backend/API/schema changes
- `PROJECT_FIRST_UX` kill-switch preserved
- No regression to hydration/restore/snapshot invariants

**Acceptance checks:**
- Automatic version labels become more distinguishable than the current source-only labels
- Manual named saves continue to render the user-supplied name unchanged
- Older labels remain backward-compatible
- `PROJECT_FIRST_UX=false` → legacy behavior unchanged
- Typecheck clean, lint clean, focused regression suite green

**Non-goals:**
- No AI-generated version labels
- No backend or schema changes
- No diff viewer
- No broader D1 history redesign
- No C3 / C2d-unload work

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-D1c.

---

### PROJ-03-D1d — Reuse Existing Active Session When Reopening Same Project Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-D1d-CHECKPOINT.md`
**Nature:** FRONTEND + THIN BACKEND EXPOSURE / SESSION REUSE
**Source:** Post-D1c gap: every "Open Project" and "Resume latest project" action always creates a new container session via `openProjectInFreshSession`, even when an active usable session already belongs to the same project. The backend already tracks `Session.projectId` but the sessions list response does not expose it, so the frontend cannot detect a reusable session.
**Dependencies:** PROJ-03-D1c (COMPLETE and LOCKED)

**Objective:**
Behind `PROJECT_FIRST_UX`, when reopening a project, reuse an existing active usable session already attached to that same project if one exists; otherwise create a fresh session as today. Keep explicit snapshot restore on the always-fresh-session path. Preserve hydration and all existing project-open safety invariants.

**Bounded scope:**
- `services/api-gateway/src/sessions/session.controller.ts` (expose `projectId` in sessions list response)
- Any directly relevant backend DTO/type if needed — no schema migration
- `frontend/components/workspace/workspace-shell.logic.ts` (add `projectId` to `WorkspaceShellSession` type)
- `frontend/lib/open-project-in-fresh-session.ts` (add session-reuse branch)
- `frontend/app/[locale]/app/page.tsx` (pass `sessions` to reuse-aware open helper at relevant call sites)
- Directly relevant tests only if needed

**Key constraints:**
- `SESSION.projectId` already exists in the DB; only expose it — no schema/migration change
- Reuse only active usable sessions (`isUsableSession` = not terminated, not expired)
- Hydration still runs on reused sessions
- Explicit snapshot restore (`handleRestoreWorkspaceProjectFromSnapshotById`) must remain always-fresh
- `PROJECT_FIRST_UX` kill-switch preserved
- Tab-isolated session selection from D0d unaffected
- `projectOpenInProgressRef` guard and all open/restore invariants unaffected

**Acceptance checks:**
- Opening a project reuses an existing active usable session for the same project when one exists
- Opening a project creates a fresh session when no usable same-project session exists
- Resume-latest-project path reuses same-project active session when available
- Explicit snapshot restore still always creates a fresh session
- Hydration still runs on reused sessions
- Typecheck clean, focused regression suite green, no introduced lint errors

**Non-goals:**
- No schema/database migration
- No broader session-management redesign
- No "choose session" UI or modal
- No change to explicit snapshot restore safety rule
- No broader D1 redesign
- No C3 / C2d-unload work

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-D1d.

---

### PROJ-03-D1d-hotfix — Refresh Sessions Before Same-Project Reuse Check Behind Feature Flag

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PROJ-03-D1d-hotfix-CHECKPOINT.md`
**Nature:** FRONTEND / CORRECTIVE HOTFIX FOR D1d STALE-STATE REUSE BUG
**Source:** Post-D1d bug: the D1d reuse check in `openProjectInFreshSession` consults the in-memory `sessions` React state, which can be stale. A session terminated server-side by idle_timeout after the last `loadSessions()` call will still show `terminatedAt: null` in memory, pass `isUsableSession`, be selected for reuse, and cause the backend to return 410 Gone ("Session has been terminated (reason: idle_timeout)"). The reuse logic itself is correct against the data it has; the data is stale.
**Dependencies:** PROJ-03-D1d (COMPLETE and LOCKED)

**Objective:**
Behind `PROJECT_FIRST_UX`, eliminate stale same-project session reuse by refreshing the sessions list immediately before the reuse decision in normal project-open/resume flows, so reuse only ever consults current server state. Preserve explicit snapshot restore as always-fresh and leave all other D1d behavior intact.

**Bounded scope:**
- Frontend only
- `frontend/app/[locale]/app/page.tsx` — call `await loadSessions(token)` at `handleOpenWorkspaceProject` (PROJECT_FIRST_UX branch) and `handleResumeWorkspaceProjectById` immediately before each `openProjectInFreshSession` call, then pass the freshly-loaded `sessions` state as `existingSessions`
- Directly relevant tests only if needed

**Key constraints:**
- `loadSessions` is already defined in scope; this is a two-call-site additive change
- Explicit snapshot restore (`handleRestoreWorkspaceProjectFromSnapshotById`) remains unchanged and always-fresh
- No backend, API, or schema changes
- No retry-on-410 recovery logic in this slice
- `PROJECT_FIRST_UX` kill-switch preserved

**Acceptance checks:**
- Opening a project refreshes sessions before the reuse decision
- Resume-latest-project path refreshes sessions before the reuse decision
- Terminated same-project sessions are no longer reused due to stale frontend state
- Explicit snapshot restore still always creates a fresh session
- Existing reuse behavior still works when a same-project usable session truly exists
- Typecheck clean, focused regression suite green, no introduced lint errors

**Non-goals:**
- No backend or schema changes
- No retry-on-410 recovery flow
- No broader session-management redesign
- No "choose session" UI or modal
- No change to explicit snapshot restore safety rule
- No broader D1 redesign
- No C3 / C2d-unload work

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PROJ-03-D1d-hotfix.

---


## AI-04 ??Chat Persistence (Core Product Loop)

**Current stage:** AI-04-01 (COMPLETE and LOCKED)
**Family status:** COMPLETE and LOCKED ??All bounded spec tasks complete (AI-04-01).

---


#### AI-04-01: Backend Chat Persistence Wiring

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (CORE PRODUCT LOOP, CHAT PERSISTENCE)
**Checkpoint:** `docs/AI-04-01-CHECKPOINT.md`

**Objective:**
Wire the workspace chat panel to backend conversation/message persistence so chat history becomes session-scoped and server-side, while preserving current Phase 84 chat behavior and keeping localStorage only as a compatibility / fallback layer where needed.

**Why this exists:**
Phase 84 made the workspace chat usable, but chat persistence is still localStorage-first and device-bound. AI-04-01 upgrades the existing chat flow to durable backend persistence without redesigning the chat UI and without coupling this task to new workspace file-action behavior.

**Scope:**
- Load prior session chat messages from backend on session selection
- Persist user prompt messages to backend per session
- Persist assistant response messages to backend per session
- Maintain correct session-scoped isolation
- Preserve existing thread rendering and session-switch behavior
- Keep localStorage only as compatibility / fallback if backend persistence/load is temporarily unavailable
- Reuse existing conversation / chat-message persistence paths where possible
- Preserve existing submit / stream / poll / cancel behavior

**Non-Goals:**
- ??No global chat history
- ??No cross-session conversation system
- ??No conversation export or branching
- ??No multi-AI conversation threading
- ??No chat UI redesign
- ??No workspace coherence work
- ??No project persistence work
- ??No quota / billing / auth redesign
- ??No new agent/orchestration behavior

**Dependencies:** Phase 84 (Complete and Locked); AI-03-02 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??AI-04-01 for full details; `docs/specs/AI-04-01-backend-chat-persistence.md` for spec

---

## PR-01 ??Project Persistence

**Current stage:** PR-03-01 (COMPLETE and LOCKED)
**Family status:** COMPLETE and LOCKED ??All bounded spec tasks complete (PR-01-01, PR-02-01, PR-03-01).

---

#### PR-01-01: Project Save and Restore

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (PROJECT PERSISTENCE, FILES-ONLY SNAPSHOT FOUNDATION)
**Checkpoint:** `docs/PR-01-01-CHECKPOINT.md`

**Objective:**
Implement the first project-persistence slice so a user can save the current workspace state from an active session and later restore that saved files-only snapshot into a session, without yet introducing a persistent project entity.

**Why this exists:**
The AI-first workspace loop now works, but work is still tied to ephemeral sessions. PR-01-01 is the first durability step: save and restore files-only workspace state so session expiry does not imply work loss, while keeping project identity and broader project management for later work.

**Scope:**
- Save current workspace files from an active session into durable storage as a files-only snapshot
- Restore a saved files-only snapshot into a session workspace
- Allow listing available saved snapshots for the current user
- Provide minimum frontend path to trigger save and restore
- Preserve existing workspace file tree / editor / preview / checkpoint / chat behavior
- Keep auth and ownership enforcement on all save/restore operations
- Keep restore behavior deterministic and bounded

**Non-Goals:**
- ??No persistent project entity yet
- ??No project list / project naming system beyond minimal snapshot labeling if required
- ??No import/export archive UX beyond this save/restore path
- ??No public sharing
- ??No collaborative access
- ??No real-time sync between sessions
- ??No broad git/history redesign
- ??No quota / billing / auth redesign
- ??No background workers

**Dependencies:** AI-04-01 (Complete and Locked); Phase 79/80 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PR-01-01 for full details; `docs/specs/PR-01-01-project-save-restore.md` for spec

---

#### PR-02-01: Project Import and Export

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (PROJECT PORTABILITY, ARCHIVE IMPORT/EXPORT)
**Checkpoint:** `docs/PR-02-01-CHECKPOINT.md`

**Objective:**
Implement the next project-persistence slice so a user can download their current workspace as an archive and upload/import an archive into a session workspace, using bounded files-only behavior built on the existing snapshot/save foundation.

**Why this exists:**
PR-01-01 gave the product durable files-only save/restore. PR-02-01 adds portability: users can bring work in and take work out, without yet introducing persistent project identity or broader external repository workflows.

**Scope:**
- Backend export endpoint to download current workspace files as an archive
- Backend import endpoint to upload/import an archive into a session workspace
- Archive validation and bounded safety checks
- Minimum frontend path for export/download and import/upload
- Preserve existing workspace file tree / editor / preview / checkpoint / chat behavior
- Keep auth and ownership enforcement on all import/export operations
- Deterministic overwrite behavior for first slice

**Non-Goals:**
- ??No persistent project entity yet
- ??No GitHub/GitLab integration
- ??No real-time sync with external repositories
- ??No partial/selective import
- ??No public sharing
- ??No collaborative access
- ??No quota / billing / auth redesign
- ??No background workers
- ??No refactors unless absolutely required

**Dependencies:** PR-01-01 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PR-02-01 for full details; `docs/specs/PR-02-01-project-import-export.md` for spec

---

#### PR-03-01: Project Identity

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (PROJECT PERSISTENCE, PERSISTENT PROJECT ENTITY)
**Checkpoint:** `docs/PR-03-01-CHECKPOINT.md`

**Objective:**
Introduce a persistent project entity on top of the completed files-only save/restore and import/export foundations, so users have a stable named project handle distinct from ephemeral sessions.

**Why this exists:**
PR-01-01 delivered files-only save/restore. PR-02-01 delivered import/export portability. PR-03-01 now adds stable project identity so saved work can be organized and reopened through a persistent project concept rather than only through snapshots and session-bound flows.

**Scope:**
- Add persistent project entity with minimal fields
- Allow creating a named project
- Allow listing user projects
- Allow associating sessions with a project
- Allow opening a project into a session using the existing save/restore foundation
- Provide minimal frontend project list / create / open flow
- Preserve existing session lifecycle and workspace behavior
- Keep auth and ownership enforcement on all project operations

**Non-Goals:**
- ??No public sharing
- ??No team or collaborative project access
- ??No marketplace/templates
- ??No advanced project settings
- ??No GitHub/GitLab integration
- ??No quota / billing / auth redesign
- ??No background workers
- ??No broad workspace redesign
- ??No refactors unless absolutely required

**Dependencies:** PR-01-01 (Complete and Locked), PR-02-01 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??PR-03-01 for full details; `docs/specs/PR-03-01-project-identity.md` for spec

---

## CO-01 ??Commercial Readiness

**Current stage:** CO-03-01 (COMPLETE and LOCKED)
**Family status:** COMPLETE and LOCKED ??All bounded spec tasks complete (CO-01-01, CO-02-01, CO-03-01).

---

#### CO-01-01: Quota and Usage UX Alignment

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (COMMERCIAL READINESS, USER-VISIBLE USAGE/QUOTA ALIGNMENT)
**Checkpoint:** `docs/CO-01-01-CHECKPOINT.md`

**Objective:**
Align workspace-visible quota/usage information with existing backend enforcement so users can clearly see current usage/limits and understand rate-limit or quota failures without changing the underlying quota model.

**Why this exists:**
Core product loop and project persistence are now in place. The next bounded commercial-readiness step is to make quota and usage behavior visible and coherent on existing surfaces, using existing backend data rather than inventing frontend-only approximations.

**Scope:**
- Add/request a backend usage/quota status path if needed using existing usage/quota data sources
- Show current usage/quota information in the workspace UI
- Align user-visible error messaging for rate-limit / quota failures with backend behavior
- Keep refresh request-driven only
- Preserve existing workspace / chat / project behavior

**Out of scope:**
- ??No billing/subscription implementation
- ??No admin-only tooling
- ??No quota model redesign
- ??No polling/timers
- ??No background workers
- ??No auth / billing redesign
- ??No broad dashboard redesign
- ??No refactors unless absolutely required

**Dependencies:** PR-03-01 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??CO-01-01 for full details; `docs/specs/CO-01-01-quota-usage-ux.md` for spec

---

#### CO-02-01: Billing and Plans Foundation

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (COMMERCIAL READINESS, PLAN/ENTITLEMENT FOUNDATION)
**Checkpoint:** `docs/CO-02-01-CHECKPOINT.md`

**Objective:**
Implement the first bounded billing/plans foundation so the platform has a minimal plan/entitlement model and user-visible plan state, without yet expanding into full payment-provider complexity.

**Why this exists:**
CO-01-01 aligned visible usage/quota UX with existing enforcement. CO-02-01 now adds the minimum foundation for plan-aware product behavior so future billing/commercial work has a stable base.

**Scope:**
- Introduce minimal plan/entitlement model for users
- Make current plan state visible on existing user-facing surfaces
- Wire existing usage/quota behavior to plan state where needed in a minimal, deterministic way
- Keep commercial behavior bounded and request-driven only
- Preserve existing workspace/project/chat behavior

**Out of scope:**
- ??No full payment provider integration unless spec requires only smallest foundation
- ??No invoicing/tax/accounting workflows
- ??No admin backoffice expansion beyond strictly required
- ??No quota model redesign beyond bounded plan-aware foundation
- ??No polling/timers
- ??No background workers
- ??No auth redesign
- ??No broad dashboard redesign
- ??No refactors unless absolutely required

**Dependencies:** CO-01-01 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??CO-02-01 for full details; `docs/specs/CO-02-01-billing-plans-foundation.md` for spec

---

#### CO-03-01: Admin and Operational Completeness

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (COMMERCIAL READINESS, ADMIN / OPERATIONAL COMPLETENESS)
**Checkpoint:** `docs/CO-03-01-CHECKPOINT.md`

**Objective:**
Implement the next bounded commercial-readiness slice so core admin and operational surfaces are complete enough to support user/account/session visibility and bounded operator actions on the existing platform.

**Why this exists:**
CO-01-01 aligned quota/usage UX. CO-02-01 added minimal plans foundation. CO-03-01 now completes the bounded operational/admin layer needed to manage users, plans, sessions, and key support actions without expanding into a full backoffice platform.

**Scope:**
- Complete minimal admin visibility for users, plans, and sessions on existing admin/internal surfaces
- Add bounded operator actions only where required for core operational completeness
- Preserve existing internal/admin endpoint separation
- Preserve existing workspace/project/chat behavior
- Keep all admin/operational behavior request-driven only

**Out of scope:**
- ??No broad backoffice suite
- ??No analytics expansion beyond required admin visibility
- ??No payment-provider operations
- ??No invoicing/tax/accounting workflows
- ??No background workers
- ??No auth redesign
- ??No broad dashboard redesign
- ??No refactors unless absolutely required

**Dependencies:** CO-02-01 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??CO-03-01 for full details; `docs/specs/CO-03-01-admin-operational.md` for spec

---

## ADV-01 ??Advanced Product Expansion

**Current stage:** ADV-05-01 (COMPLETE and LOCKED)
**Family status:** COMPLETE and LOCKED ??All bounded spec tasks complete (ADV-01-01 through ADV-05-01).

---

#### ADV-01-01: Multi-AI Collaboration

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (ADVANCED PRODUCT, MULTI-MODEL WORKSPACE SUPPORT)
**Checkpoint:** `docs/ADV-01-01-CHECKPOINT.md`

**Objective:**
Implement the first bounded multi-AI slice so a user can choose between supported AI models/providers in the workspace and see which model produced a given result, without yet introducing orchestrated multi-agent workflows.

**Why this exists:**
The core AI workspace loop is now complete and durable. The next bounded advanced step is to expose controlled multi-model choice/collaboration on top of the existing AI execution path, while keeping the product grounded in the current single-user workspace loop.

**Scope:**
- Allow choosing among supported AI providers/models on existing workspace AI surfaces
- Persist/display which model produced each execution/result where relevant
- Keep execution flow and workspace side effects coherent across supported models
- Preserve existing chat/workspace/project/commercial behavior
- Keep behavior request-driven only

**Out of scope:**
- ??No autonomous multi-agent orchestration
- ??No conversational orchestrator
- ??No agent debate/planning system
- ??No provider marketplace
- ??No billing/provider-cost optimization redesign
- ??No quota/billing/auth redesign
- ??No broad chat/workspace redesign
- ??No background workers
- ??No refactors unless absolutely required

**Dependencies:** CO-03-01 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??ADV-01-01 for full details; `docs/specs/ADV-01-01-multi-ai-collaboration.md` for spec

---

#### ADV-02-01: Conversational Orchestrator

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (ADVANCED PRODUCT, SINGLE-MODEL MULTI-STEP ORCHESTRATION)
**Checkpoint:** `docs/ADV-02-01-CHECKPOINT.md`

**Objective:**
Implement the first bounded conversational orchestrator slice so the workspace can execute a controlled multi-step AI workflow within a single user request, while preserving the existing request-driven execution model and without expanding into autonomous agent systems.

**Why this exists:**
ADV-01-01 added controlled multi-model selection and attribution. ADV-02-01 now adds a bounded single-model multi-step orchestration layer so the product can handle richer conversational workflows without introducing autonomous agents, background processes, or broad orchestration complexity.

**Scope:**
- Allow a bounded multi-step conversational workflow inside the existing workspace execution loop
- Keep orchestration single-request and request-driven only
- Make orchestration state/result visible on existing chat/workspace surfaces where required
- Preserve existing file-action/workspace semantics and model attribution behavior
- Preserve existing chat/workspace/project/commercial behavior

**Out of scope:**
- ??No autonomous agents
- ??No long-running background orchestration
- ??No provider marketplace
- ??No debate/planning swarm
- ??No billing/quota redesign
- ??No broad chat/workspace redesign
- ??No background workers
- ??No refactors unless absolutely required

**Dependencies:** ADV-01-01 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??ADV-02-01 for full details; `docs/specs/ADV-02-01-conversational-orchestrator.md` for spec

---

#### ADV-03-01: Mobile / Mac / iOS Build Support

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (ADVANCED PRODUCT, CROSS-PLATFORM BUILD SUPPORT)
**Checkpoint:** `docs/ADV-03-01-CHECKPOINT.md`

**Objective:**
Implement the first bounded cross-platform build support slice so the workspace can target mobile / Mac / iOS build flows in a controlled way, without expanding into a broad device-cloud platform.

**Why this exists:**
The core workspace, persistence, commercial foundation, and bounded advanced AI features are now in place. ADV-03-01 adds the first practical cross-platform build capability so supported projects can be prepared and built for mobile / Mac / iOS targets within the existing workspace model.

**Scope:**
- Add bounded build-target support for mobile / Mac / iOS related workflows on existing workspace surfaces
- Expose target/build selection only where required
- Keep build execution within existing request-driven workspace patterns
- Preserve existing chat/workspace/project/commercial behavior
- Keep behavior request-driven only

**Out of scope:**
- ??No full device cloud
- ??No remote device farm
- ??No app-store submission workflow
- ??No broad CI/CD platform
- ??No autonomous orchestration
- ??No billing/quota redesign
- ??No broad workspace redesign
- ??No background workers
- ??No refactors unless absolutely required

**Dependencies:** ADV-02-01 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??ADV-03-01 for full details; `docs/specs/ADV-03-01-mobile-mac-ios-build.md` for spec

---

#### ADV-04-01: Public API Platform and Ecosystem

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (ADVANCED PRODUCT, EXTERNAL API FOUNDATION)
**Checkpoint:** `docs/ADV-04-01-CHECKPOINT.md`

**Objective:**
Implement the first bounded public API foundation so external clients can access a controlled subset of platform capabilities through dedicated public API surfaces, without exposing internal-only routes or expanding into a broad integration marketplace.

**Why this exists:**
The core workspace, persistence, commercial foundation, and bounded advanced features are now in place. ADV-04-01 adds the first external API foundation so the product can be used programmatically, while preserving internal/public separation and avoiding broad ecosystem/platform expansion.

**Scope:**
- Add dedicated public API surfaces for a minimal supported capability set
- Keep public APIs separate from existing internal-only routes
- Provide bounded external authentication/access model only where needed
- Preserve existing workspace/project/chat/commercial behavior
- Keep behavior request-driven only

**Out of scope:**
- ??No integration marketplace
- ??No broad webhook/event platform
- ??No public exposure of internal-only routes
- ??No SDK/platform sprawl
- ??No billing/quota redesign
- ??No broad admin redesign
- ??No background workers
- ??No refactors unless absolutely required

**Dependencies:** ADV-03-01 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??ADV-04-01 for full details; `docs/specs/ADV-04-01-public-api-platform.md` for spec

---

#### ADV-05-01: Public Sharing and Community Layer

**Status:** COMPLETE and LOCKED
**Nature:** IMPLEMENTATION (ADVANCED PRODUCT, PUBLIC SHARING FOUNDATION)
**Checkpoint:** `docs/ADV-05-01-CHECKPOINT.md`

**Objective:**
Implement the first bounded public-sharing slice so a user can publish a controlled public view of selected project/workspace output, without expanding into a full social/community platform.

**Why this exists:**
The core workspace, persistence, commercial foundation, advanced AI features, and public API foundation are now in place. ADV-05-01 adds the first bounded public-sharing capability so work can be shared outward in a controlled way, while avoiding broad community/platform sprawl.

**Scope:**
- Allow controlled public sharing of selected project/workspace output
- Add bounded public-view surface only where required
- Preserve ownership and privacy boundaries
- Preserve existing workspace/project/chat/commercial behavior
- Keep behavior request-driven only

**Out of scope:**
- ??No broad social/community feed
- ??No comments/likes/follow systems
- ??No broad moderation platform
- ??No marketplace/templates ecosystem
- ??No billing/quota redesign
- ??No broad admin redesign
- ??No background workers
- ??No refactors unless absolutely required

**Dependencies:** ADV-04-01 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??ADV-05-01 for full details; `docs/specs/ADV-05-01-public-sharing-community.md` for spec

---

## REL-01 ??Release Readiness

**Family status:** COMPLETE and LOCKED

**Current stage:** none active (release-readiness wave complete)

---

## REL-02 ??Deployment Rehearsal

**Family status:** COMPLETE and LOCKED

**Current stage:** none active (deployment-readiness wave complete)

---

## OPS-01 ??Runtime Cleanup Diagnostics

**Family status:** ACTIVE

**Current stage:** OPS-01-04 (COMPLETE and LOCKED)

---

#### OPS-01-04: Fix Stop Session Returning 500 After Successful Cleanup

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (RUNTIME CLEANUP, API RESPONSE)
**Checkpoint:** `docs/OPS-01-04-CHECKPOINT.md`

**Objective:**
Fix `POST /api/sessions/:id/stop` so it returns a successful response when cleanup succeeds, instead of returning 500 after the container is already removed and DB state is stopped.

**Acceptance criteria:**
- Stop session removes the container
- DB/session state remains stopped
- API returns success, not 500
- Terminate path remains intact

---

#### OPS-01-03: Verify Session Container Cleanup After Stop Terminate Fix

**Status:** COMPLETE and LOCKED
**Nature:** BUG INVESTIGATION (RUNTIME CLEANUP, POST-FIX VERIFICATION)
**Checkpoint:** `docs/OPS-01-03-CHECKPOINT.md`

**Objective:**
Determine whether the remaining Docker session containers are only pre-fix leftovers or whether new sessions are still accumulating after the OPS-01-02 cleanup fix.

**Scope:**
- Inspect current `sandbox-session-*` containers
- Compare creation/start timing where possible
- Create one or more fresh sessions after the fix
- Stop/terminate those fresh sessions through the normal app/API flow
- Verify whether those new session containers are removed correctly
- Identify whether remaining accumulation is historical residue or an ongoing bug
- No fix in this task unless a trivially obvious diagnostic correction is absolutely required

**Out of scope:**
- No cleanup redesign
- No broad ops redesign
- No scope expansion
- No unrelated feature work

**Acceptance criteria:**
- Clear distinction between old leftover containers and new post-fix behavior
- Exact remaining issue, if any, identified clearly
- Issue narrowed enough for one bounded follow-up fix task if needed

**Dependencies:** OPS-01-02 (Complete and Locked)

---

#### OPS-01-02: Make Stop Terminate Flow Physically Remove Session Containers

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (RUNTIME CLEANUP, SESSION CONTAINERS)
**Checkpoint:** `docs/OPS-01-02-CHECKPOINT.md`

**Objective:**
Fix the normal stop/terminate flow so session containers are physically stopped and removed, not just marked stopped in app state.

**Scope:**
- Inspect normal API stop/terminate wiring
- Route stop/terminate through the existing physical stop/remove path at the smallest safe boundary
- Preserve existing DB/session termination semantics
- Verify stopped/terminated sessions no longer leave running containers behind
- Document exact cause and resolution

**Out of scope:**
- ??No runtime redesign
- ??No broad cleanup redesign
- ??No scope expansion
- ??No unrelated feature work

**Acceptance criteria:**
- Normal stop/terminate flow physically removes session containers
- Session DB/status semantics remain intact
- No extra running containers are left behind for stopped/terminated sessions
- Fix is documented clearly

**Dependencies:** OPS-01-01 (Complete and Locked)

---

#### OPS-01-01: Diagnose Accumulated Docker Session Containers

**Status:** COMPLETE and LOCKED
**Nature:** BUG INVESTIGATION (RUNTIME CLEANUP, SESSION CONTAINERS)
**Checkpoint:** `docs/OPS-01-01-CHECKPOINT.md`

**Objective:**
Determine why many session-related Docker containers are accumulating, and identify whether they are expected stopped remnants, active leaked runtimes, or a cleanup/removal bug.

**Scope:**
- Inspect current Docker session containers
- Determine which are running vs exited
- Inspect naming/session mapping
- Inspect cleanup/termination code path and intended removal behavior
- Determine whether expired/terminated sessions are leaving behind containers unexpectedly
- Identify the exact failing or expected stage clearly

**Out of scope:**
- ??No cleanup redesign
- ??No broad ops redesign
- ??No scope expansion
- ??No unrelated feature work
- ??No fix in this task unless a trivially obvious diagnostic correction is absolutely required

**Acceptance criteria:**
- Clear distinction between running vs exited accumulated session containers
- Exact intended cleanup behavior identified
- Exact remaining issue, if any, identified clearly
- Issue narrowed enough for one bounded follow-up fix task if needed

---

## OPS-LOCAL — Local Testing Config

**Family status:** ACTIVE

**Current stage:** OPS-LOCAL-AUTH-JWT (PLANNED)

---

#### OPS-LOCAL-SESSION-LIMITS: Add Env Overrides For Local Session Limits And Raise Them In Docker Compose For Testing

**Status:** PLANNED
**Checkpoint:** `docs/OPS-LOCAL-SESSION-LIMITS-CHECKPOINT.md`
**Nature:** CONFIG / LOCAL TESTING ENABLEMENT
**Source:** Post-D0 testing diagnostic — session creation blocked by hard-coded limits of 5 active / 20 per 24h; local QA cannot test project-first UX without hitting these caps

**Objective:**
Preserve code defaults of 5 active sessions and 20 sessions per 24h, but add env-driven overrides in api-gateway `QuotaConfig` and set local Docker compose values to `1000000` each, so local QA is not blocked by session caps during project-first testing.

**Bounded scope:**
- Narrow code/config slice only
- Changes allowed in:
  - `services/api-gateway/src/quota/quota.config.ts` — add env-based resolvers for `MAX_ACTIVE_SESSIONS_PER_USER` and `MAX_SESSIONS_PER_24H`; preserve defaults of 5 / 20
  - `docker-compose.prod.yml` — add `MAX_ACTIVE_SESSIONS_PER_USER: "1000000"` and `MAX_SESSIONS_PER_24H: "1000000"` to the `api-gateway` service environment block
  - directly relevant tests only if env-based resolver changes cause failures
- No change to enforcement logic beyond reading the resolved values

**Non-goals:**
- No change to token quotas
- No change to login/auth/session-expiry behavior
- No change to frontend UI
- No production policy redesign
- No broader quota-system refactor
- No unrelated docker-compose cleanup
- No PROJ-03 changes

**Acceptance checks:**
- Defaults remain 5 / 20 when env vars are absent
- Local docker compose can override to 1000000 / 1000000
- Active sessions guard uses overridden value
- 24h sessions guard uses overridden value
- Relevant tests pass
- `api-gateway` rebuilds cleanly
- `docker compose ... config` parses cleanly

**Invariants to preserve:**
- Local-testing only; do not treat this as production policy
- Use large finite integers, not Infinity
- Preserve existing enforcement paths and behavior except resolved thresholds
- Do not affect token quota handling
- Keep the diff small and reversible

**Reference:** See `TASKS_BACKLOG_FULL.md` -> OPS-LOCAL-SESSION-LIMITS.

---

#### OPS-LOCAL-AUTH-JWT: Extend Local Docker JWT Lifetime For Testing

**Status:** PLANNED
**Checkpoint:** `docs/OPS-LOCAL-AUTH-JWT-CHECKPOINT.md`
**Nature:** CONFIG / LOCAL TESTING ENABLEMENT
**Source:** Post-OPS-LOCAL-SESSION-LIMITS diagnostic — auth access token is 15m with no refresh mechanism; local QA is forcibly logged out every 15 minutes, interrupting testing

**Objective:**
Override `JWT_EXPIRES_IN` for the local Docker `api-gateway` service to `30d` so local QA is not interrupted by frequent forced re-login, without changing auth architecture or production defaults.

**Bounded scope:**
- Narrow config slice only
- Changes allowed in:
  - `docker-compose.prod.yml` — add `JWT_EXPIRES_IN: "30d"` under the `api-gateway` service `environment` block
- No code changes
- No refresh-token implementation
- No frontend auth logic change
- No cookie/session architecture change

**Non-goals:**
- No refresh-token system
- No `/auth/refresh` endpoint
- No frontend silent refresh or axios interceptor work
- No production policy change
- No auth refactor
- No PROJ-03 changes
- No D1 / C3 / C2d-unload work

**Acceptance checks:**
- `docker-compose.prod.yml` parses cleanly
- `api-gateway` can be rebuilt and restarted
- New `api-gateway` environment includes `JWT_EXPIRES_IN=30d`
- Newly issued local tokens use the longer lifetime
- No code changes required

**Invariants to preserve:**
- Local-testing only; do not treat 30d access tokens as production policy
- Existing tokens issued before the change remain short-lived; user must log in once after the rebuild
- No auth architecture change; no change to frontend logout-on-401 behavior
- Keep the diff tiny and reversible

**Reference:** See `TASKS_BACKLOG_FULL.md` -> OPS-LOCAL-AUTH-JWT.

---

## UX-02 ??Account Entry

**Family status:** ACTIVE

**Current stage:** UX-02-02 (COMPLETE and LOCKED)

---

#### UX-02-01: Add User Registration Page And Wire Login CTA

**Status:** COMPLETE and LOCKED
**Nature:** UX FIX (FUNCTIONAL GAP, ACCOUNT ENTRY)
**Checkpoint:** `docs/UX-02-01-CHECKPOINT.md`

**Objective:**
Add a real user registration page and wire the login-page registration CTA to it so a normal user can create an account through the UI.

**Scope:**
- Add/register a user-facing registration page
- Wire existing login-page registration CTA to the real route
- Submit to existing backend register endpoint
- Show success/error clearly
- Preserve existing login flow

**Out of scope:**
- ??No auth-system redesign
- ??No profile system
- ??No onboarding redesign
- ??No password-reset work
- ??No scope expansion

**Acceptance criteria:**
- User can reach registration from login page
- User can submit registration through UI
- Success/error handling is clear
- Existing login flow remains intact

**Dependencies:** UX-01 (Complete and Locked)

---

#### UX-02-02: Simplify Project Management UI And Make Visibility Secondary

**Status:** COMPLETE and LOCKED
**Nature:** UX FIX (PROJECT AREA CLARITY, INFORMATION ARCHITECTURE)
**Checkpoint:** `docs/UX-02-02-CHECKPOINT.md`

**Objective:**
Restructure the confusing project area so normal project creation/opening is clear, private-by-default, and visually separated from public-sharing controls.

**Scope:**
- Simplify the project area UI/labels/layout
- Make normal project creation/opening the primary path
- Make project visibility/share controls secondary
- Keep private as the default for normal project creation
- Separate "My Projects" from "Public Projects" visually and conceptually
- Preserve existing project/public functionality
- Verify the project workflow is clearer after the change

**Out of scope:**
- ??No project-system redesign
- ??No public-sharing feature redesign
- ??No backend behavior redesign unless a tiny UI-support change is strictly required
- ??No scope expansion

**Acceptance criteria:**
- Creating/opening a normal project is visually obvious
- Private/public choice is no longer required-feeling during normal project creation
- Public project browsing is clearly separate from private project management
- Existing functionality remains intact
- Fix is documented clearly

**Dependencies:** UX-02-01 (Complete and Locked)

---

## UX-01 ??Manual UX/UI Acceptance

**Family status:** COMPLETE and LOCKED

**Current stage:** none active (UX-01 wave complete)

**Completed tasks:** UX-01, UX-01-01, UX-01-02, UX-01-03, UX-01-04, UX-01-05, UX-01-06, UX-01-07, UX-01-08, UX-01-09, UX-01-10 ??all COMPLETE and LOCKED.

---

#### UX-01: Manual UX UI Acceptance and Polish

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION (PRODUCT QUALITY, MANUAL UX/UI ACCEPTANCE)
**Checkpoint:** `docs/UX-01-CHECKPOINT.md`

**Objective:**
Run a bounded manual UX/UI acceptance pass across the core product journeys so remaining usability, clarity, and polish issues can be identified and then fixed through small bounded follow-up tasks.

**Review areas:**
- Workspace entry / initial load
- Auth/login flow
- Session create/select/terminate
- File tree / editor / preview flow
- Chat prompt/response/thread readability
- AI file-action visibility/coherence
- Checkpoint/history/diff/revert clarity
- Project create/open/share flow
- Quota/plan visibility
- Obvious UI inconsistency on core surfaces

**Out of scope:**
- ??No implementation in this task
- ??No feature redesign
- ??No roadmap expansion
- ??No broad refactor
- ??No scope expansion

**Dependencies:** REL-02 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??UX-01 for full details

---

#### UX-01-01: Remove or Gate Test Credentials Block From Login Page

**Status:** COMPLETE and LOCKED
**Nature:** UX FIX (BLOCKER, LOGIN SURFACE)
**Checkpoint:** `docs/UX-01-01-CHECKPOINT.md`

**Objective:**
Remove or appropriately gate the development-era test credentials block from the login page so non-development users do not see demo credentials as the most prominent login-page content.

**Scope:**
- Inspect the login page rendering path
- Remove the visible test-credentials block or gate it behind a clearly local/dev-only condition
- Preserve the rest of the login flow and error handling

**Out of scope:**
- ??No broader login redesign
- ??No registration/sign-up UX work
- ??No auth flow redesign
- ??No unrelated style cleanup

**Acceptance criteria:**
- Test credentials block is no longer visible to normal users
- Login form still renders and works normally
- Error handling remains intact

**Dependencies:** UX-01 (Complete and Locked)

---

#### UX-01-02: Remove Internal Task Slice Labels From Workspace UI

**Status:** COMPLETE and LOCKED
**Nature:** UX FIX (BLOCKER, WORKSPACE CLARITY)
**Checkpoint:** `docs/UX-01-02-CHECKPOINT.md`

**Objective:**
Remove internal build-phase/task/spec labels from the rendered workspace UI and replace them with user-meaningful labels so users do not see implementation scaffolding text.

**Scope:**
- Inspect rendered workspace headings/labels
- Remove internal task/slice/spec wording from user-visible UI
- Replace with concise user-meaningful labels where needed
- Preserve layout, behavior, and feature scope

**Out of scope:**
- ??No broader information-architecture redesign
- ??No new features
- ??No visual redesign beyond label cleanup
- ??No unrelated text/content rewrite

**Acceptance criteria:**
- Internal task/slice/spec labels no longer rendered to users
- Replacement labels are concise and user-meaningful
- Workspace layout/behavior remains intact

**Dependencies:** UX-01 (Complete and Locked)

---

#### UX-01-03: Replace Raw UUID Header With User Email Or Display Name

**Status:** COMPLETE and LOCKED
**Nature:** UX FIX (IMPORTANT, WORKSPACE HEADER CLARITY)
**Checkpoint:** `docs/UX-01-03-CHECKPOINT.md`

**Objective:**
Replace the raw user UUID shown in the workspace header with a more human-readable identifier such as email or display name so the header communicates user identity clearly.

**Scope:**
- Inspect the workspace header user identity rendering path
- Replace raw UUID display with existing user email or display name if already available
- Keep the fix tightly scoped to the rendered header identity label
- Preserve existing auth/session behavior

**Out of scope:**
- ??No user profile redesign
- ??No account settings work
- ??No auth flow redesign
- ??No broader header redesign

**Acceptance criteria:**
- Raw UUID no longer appears as the primary user label in the workspace header
- Header shows a human-readable user identity label
- Existing behavior remains intact

**Dependencies:** UX-01 (Complete and Locked)

---

#### UX-01-10: Format Quota Reset Timestamp As Human Readable

**Status:** COMPLETE and LOCKED
**Nature:** UX FIX (IMPORTANT, DASHBOARD CLARITY)
**Checkpoint:** `docs/UX-01-10-CHECKPOINT.md`

**Objective:**
Replace the raw quota reset ISO timestamp with a more human-readable date/time presentation so users can quickly understand when quota resets.

**Scope:**
- Inspect the quota reset rendering path in the workspace dashboard
- Format the displayed reset timestamp into concise human-readable text
- Preserve the underlying quota data and behavior
- Keep the fix tightly scoped to display clarity only

**Out of scope:**
- ??No quota-system redesign
- ??No dashboard redesign beyond this formatting improvement
- ??No relative-time system unless trivially local
- ??No scope expansion

**Acceptance criteria:**
- Raw ISO quota reset string no longer appears in the user-facing dashboard
- Reset time displays in a clear readable format
- Existing quota behavior remains intact

**Dependencies:** UX-01 (Complete and Locked)

---

#### UX-01-09: Add Navigation Link To API Keys Page From Workspace Shell

**Status:** COMPLETE and LOCKED
**Nature:** UX FIX (IMPORTANT, NAVIGATION DISCOVERABILITY)
**Checkpoint:** `docs/UX-01-09-CHECKPOINT.md`

**Objective:**
Add a clear navigation link from the workspace shell to the API Keys page so users do not need to know the route manually.

**Scope:**
- Inspect the workspace shell navigation/header area
- Add a small, clear link or CTA to the API Keys page
- Preserve existing workspace layout and behavior
- Keep the fix tightly scoped to navigation discoverability only

**Out of scope:**
- ??No broader navigation redesign
- ??No account/settings IA redesign
- ??No API keys page redesign
- ??No scope expansion

**Acceptance criteria:**
- Workspace provides a visible path to the API Keys page
- Existing workspace behavior remains intact
- Change is concise and user-meaningful

**Dependencies:** UX-01 (Complete and Locked)

---

#### UX-01-08: Replace API Keys Page Alert Confirm With Inline Feedback

**Status:** COMPLETE and LOCKED
**Nature:** UX FIX (IMPORTANT, API KEYS FEEDBACK)
**Checkpoint:** `docs/UX-01-08-CHECKPOINT.md`

**Objective:**
Replace jarring browser alert()/confirm() usage on the API Keys page with calmer inline feedback/confirmation so the page feels consistent with the rest of the product.

**Scope:**
- Inspect the API Keys page feedback/confirmation path
- Replace alert()/confirm() with small in-page feedback/confirmation handling
- Preserve existing copy/revoke behavior
- Keep the fix tightly scoped to this page only

**Out of scope:**
- ??No broader modal/toast framework
- ??No API keys flow redesign
- ??No unrelated page redesign
- ??No scope expansion

**Acceptance criteria:**
- Copy/revoke feedback no longer depends on native alert()/confirm()
- API key actions still work normally
- Page behavior remains intact

**Dependencies:** UX-01 (Complete and Locked)

---

#### UX-01-07: Add Stop Session Confirmation

**Status:** COMPLETE and LOCKED
**Nature:** UX FIX (IMPORTANT, SESSION SAFETY)
**Checkpoint:** `docs/UX-01-07-CHECKPOINT.md`

**Objective:**
Add a confirmation step before stopping a session so users do not accidentally terminate a session with a single click.

**Scope:**
- Inspect the stop-session action path in the session sidebar/workspace shell
- Add a small confirmation step before stop executes
- Preserve existing stop-session behavior after confirmation
- Keep the fix tightly scoped to this action only

**Out of scope:**
- ??No broader session-management redesign
- ??No multi-step destructive-action framework
- ??No unrelated sidebar redesign
- ??No scope expansion

**Acceptance criteria:**
- Stop-session action requires confirmation before executing
- Confirmed stop still works normally
- Surrounding session/sidebar behavior remains intact

**Dependencies:** UX-01 (Complete and Locked)

---

#### UX-01-06: Add Registration Link Or CTA To Login Page

**Status:** COMPLETE and LOCKED
**Nature:** UX FIX (IMPORTANT, LOGIN FLOW)
**Checkpoint:** `docs/UX-01-06-CHECKPOINT.md`

**Objective:**
Add a clear registration link or call to action on the login page so users who need an account have an obvious path forward.

**Scope:**
- Inspect the current login page structure
- Add a small, clear registration path/CTA
- Preserve the existing login form and error flow
- Keep the fix tightly scoped to login-page navigation clarity only

**Out of scope:**
- ??No auth-system redesign
- ??No broader onboarding redesign
- ??No registration-flow redesign beyond linking/CTA clarity
- ??No unrelated style cleanup

**Acceptance criteria:**
- Login page includes a clear registration/sign-up path
- Login form and error handling remain intact
- Change is concise and user-meaningful

**Dependencies:** UX-01 (Complete and Locked)

---

#### UX-01-05: Render AI Prose Responses In Normal Readable Font

**Status:** COMPLETE and LOCKED
**Nature:** UX FIX (IMPORTANT, CHAT READABILITY)
**Checkpoint:** `docs/UX-01-05-CHECKPOINT.md`

**Objective:**
Improve chat readability by rendering normal AI prose responses in a standard readable font instead of monospaced code-style text, while preserving code readability where needed.

**Scope:**
- Inspect assistant message rendering path
- Change prose response rendering to normal readable text styling
- Preserve code/preformatted readability where needed
- Keep the fix tightly scoped to chat rendering only

**Out of scope:**
- ??No markdown/rendering-system redesign
- ??No syntax-highlighting redesign
- ??No broader chat redesign
- ??No scope expansion

**Acceptance criteria:**
- Prose AI responses no longer render as monospaced code-style blocks by default
- Code/preformatted content remains readable
- Chat behavior remains intact

**Dependencies:** UX-01 (Complete and Locked)

---

#### UX-01-04: Remove Or Simplify Workspace Footer Internal State Label

**Status:** COMPLETE and LOCKED
**Nature:** UX FIX (IMPORTANT, WORKSPACE CLARITY)
**Checkpoint:** `docs/UX-01-04-CHECKPOINT.md`

**Objective:**
Remove or simplify the raw internal workspace state label shown in the footer so the workspace does not expose internal state-machine wording to users.

**Scope:**
- Inspect the workspace footer rendering path
- Remove the internal state label or replace it with concise user-facing wording if needed
- Preserve existing workspace behavior
- Keep the change tightly scoped to footer clarity only

**Out of scope:**
- ??No broader footer redesign
- ??No state-machine redesign
- ??No status-system redesign
- ??No unrelated copy cleanup

**Acceptance criteria:**
- Raw internal state label no longer appears in the workspace footer
- Any replacement wording is concise and user-meaningful
- Existing behavior remains intact

**Dependencies:** UX-01 (Complete and Locked)

---

**Completed deployment-readiness tasks:**
- REL-02-01 (Deployment Rehearsal and Packaging) ??COMPLETE and LOCKED
- REL-02-02 (Runbook Reconciliation After Deployment Rehearsal) ??COMPLETE and LOCKED

**Final deployment smoke:** PASS ??runbook now matches validated live-stack behavior.

**Final checkpoint:** `docs/REL-02-FINAL-CHECKPOINT.md`

---

#### REL-02-01: Deployment Rehearsal and Packaging

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION (RELEASE READINESS, DEPLOYMENT REHEARSAL)
**Checkpoint:** `docs/REL-02-01-CHECKPOINT.md`

**Objective:**
Run one bounded deployment rehearsal from the validated runbook so the stack can be brought up, migrated, checked, and shut down in a reproducible prod-style flow.

**Scope:**
- Rehearse prod-style stack startup from documented prerequisites
- Run migration/app startup in the intended order
- Run bounded health and smoke checks from the runbook
- Verify shutdown/restart behavior is clean
- Verify packaging/startup assumptions are reproducible
- Document exact rehearsal steps and outcome

**Out of scope:**
- ??No new feature work
- ??No roadmap expansion
- ??No broad infra redesign
- ??No CI/CD platform work
- ??No release automation platform
- ??No scope expansion

**Dependencies:** REL-01-05 (Complete and Locked), `docs/REL-01-05-CHECKPOINT.md` (operational runbook)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??REL-02-01 for full details

---

#### REL-02-02: Runbook Reconciliation After Deployment Rehearsal

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION (RELEASE READINESS, RUNBOOK ALIGNMENT)
**Checkpoint:** `docs/REL-02-02-CHECKPOINT.md`

**Objective:**
Reconcile the operational runbook with the concrete mismatches discovered during REL-02-01 so the documented deployment procedure matches validated reality.

**Scope:**
- Update operational runbook to match validated rehearsal behavior
- Correct: migration CLI prerequisites; auth token field; API-key request/response shape; public API auth header; execute payload (conversationId required)
- Documentation-only changes only

**Out of scope:**
- ??No product code changes
- ??No feature work
- ??No deployment redesign
- ??No release automation
- ??No scope expansion

**Dependencies:** REL-02-01 (Complete and Locked), `docs/REL-02-01-CHECKPOINT.md`

**Reference:** See `TASKS_BACKLOG_FULL.md` ??REL-02-02 for full details

---

**Completed validation/hardening tasks:**
- REL-01-01 (Migration Validation) ??COMPLETE and LOCKED
- REL-01-02 (Integration Smoke Sweep) ??COMPLETE and LOCKED
- REL-01-03 (Environment and Config Audit) ??COMPLETE and LOCKED
- REL-01-05 (Operational Runbook Update) ??COMPLETE and LOCKED

**Concrete blockers resolved:**
- REL-01-01A/B (Docker recovery; plans migration defect)
- REL-01-02A/B/C/D (startup migration; slug; snapshot path; public API status lookup)
- REL-01-03A/B (env template defects; production provider key coherence)

**Final checkpoint:** `docs/REL-01-FINAL-CHECKPOINT.md`

---

#### REL-01-01A: Docker PostgreSQL Validation Environment Recovery

**Status:** COMPLETE and LOCKED
**Nature:** BLOCKER RESOLUTION (RELEASE READINESS, VALIDATION PREREQUISITE)
**Checkpoint:** `docs/REL-01-01A-CHECKPOINT.md`

**Objective:**
Restore a usable Docker/PostgreSQL validation environment so REL-01-01 migration validation can run against a real PostgreSQL instance.

**Scope:**
- Diagnose Docker Desktop / Docker service availability
- Restore daemon availability if possible
- Verify Docker responds normally
- Verify PostgreSQL container stack can start
- Document exact blocker resolution steps and outcome

**Out of scope:**
- ??No migration validation itself yet
- ??No feature work
- ??No broad environment cleanup
- ??No unrelated bug fixing
- ??No scope expansion

**Dependencies:** REL-01-01 (BLOCKED ??environment prerequisite unmet)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??REL-01-01A for full details; `docs/REL-01-01-CHECKPOINT.md` for blocker context

---

#### REL-01-01B: Fix Plans Foundation Migration Defect

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (RELEASE READINESS, MIGRATION BLOCKER)
**Checkpoint:** `docs/REL-01-01B-CHECKPOINT.md`

**Objective:**
Fix the concrete migration defect found during REL-01-01 so the plans foundation migration (`1771589000000-AddPlansFoundation.ts`) can run successfully on a real PostgreSQL instance.

**Scope:**
- Inspect failing migration and current user/plans schema assumptions
- Apply smallest safe fix for `column "plan_type" does not exist` (42703) failure
- Preserve intended plan foundation outcome
- Rerun specific migration validation path to prove the fix
- Document exact cause and resolution

**Out of scope:**
- ??No broader billing redesign
- ??No unrelated schema cleanup
- ??No feature work
- ??No broad regression sweep
- ??No scope expansion

**Dependencies:** REL-01-01 (FAILED ??migration defect; see `docs/REL-01-01-CHECKPOINT.md`)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??REL-01-01B for full details

---

#### REL-01-01: Migration Validation

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION (RELEASE READINESS, DATABASE SAFETY)
**Checkpoint:** `docs/REL-01-01-CHECKPOINT.md`

**Objective:**
Validate the migrations introduced during the completed spec-execution wave against a real PostgreSQL instance so release-readiness work starts from a known-correct schema baseline.

**Scope:**
- Run relevant migrations against a real PostgreSQL instance
- Verify rollback/down path where supported
- Verify resulting schema shape, defaults, nullable behavior, key FKs/indexes
- Verify no incompatibility with current Docker/dev environment
- Document exact validation steps and outcomes

**Relevant migrations:**
- `services/api-gateway/src/migrations/1771587000000-AddProjectsAndSessionProjectId.ts`
- `services/api-gateway/src/migrations/1771589000000-AddPlansFoundation.ts`
- `services/api-gateway/src/migrations/1771592000000-AddProjectVisibility.ts`

**Out of scope:**
- ??No feature work
- ??No broad regression sweep
- ??No environment/doc cleanup beyond what is strictly needed
- ??No bug-fix sweep unless migration validation finds a concrete issue
- ??No release packaging
- ??No scope expansion

**Dependencies:** PROGRAM-SPEC-EXECUTION-FINAL-CHECKPOINT (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??REL-01-01 for full details

---

#### REL-01-02: Integration Smoke Sweep

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION (RELEASE READINESS, CROSS-SURFACE REGRESSION SWEEP)
**Checkpoint:** `docs/REL-01-02-CHECKPOINT.md`

**Objective:**
Run a bounded end-to-end integration smoke sweep across the preserved regression-gate surfaces so release-readiness work can confirm the feature wave still behaves coherently as one system.

**Scope:**
- Session lifecycle and sidebar actions
- Checkpoint creation/history/diff/snapshot
- Editor file loading/saving
- Preview routing/status
- Chat prompt/response/thread behavior
- Per-session chat persistence
- Auth gating for workspace access
- Quota enforcement and visibility
- API-key based AI execution flow
- Route bootstrapping and workspace loading behavior

**Out of scope:**
- ??No new feature work
- ??No bug-fix sweep unless this task finds a concrete defect
- ??No environment/config audit yet
- ??No release packaging
- ??No scope expansion

**Dependencies:** REL-01-01 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??REL-01-02 for full details

#### REL-01-02A: Fix Projects Migration Startup Defect

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (RELEASE READINESS, LIVE-STACK BLOCKER)
**Checkpoint:** `docs/REL-01-02A-CHECKPOINT.md`

**Objective:**
Fix the concrete migration defect blocking live-stack startup so api-gateway can boot and REL-01-02 integration smoke validation can resume.

**Scope:**
- Inspect failing migration `1771587000000-AddProjectsAndSessionProjectId.ts`
- Apply smallest safe fix so `updated_at` column exists before index creation
- Rerun migration validation path to prove fix on clean database
- Document cause and resolution

**Out of scope:** ??No broader project redesign, unrelated schema cleanup, feature work, broad regression sweep, or scope expansion

**Dependencies:** REL-01-02 (BLOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??REL-01-02A for full details

#### REL-01-02B: Fix Project Creation Slug Defect

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (RELEASE READINESS, LIVE-SMOKE BLOCKER)
**Checkpoint:** `docs/REL-01-02B-CHECKPOINT.md`

**Objective:**
Fix the concrete live-stack defect blocking REL-01-02 so authenticated project creation works during the integration smoke sweep.

**Scope:**
- Inspect project entity + create flow assumptions around `slug`
- Apply smallest safe fix so project creation supplies/persists a valid slug
- Rerun specific live-stack validation path to prove fix
- Document cause and resolution

**Out of scope:** ??No broader project redesign, public sharing redesign, unrelated schema cleanup, feature work, broad regression sweep, or scope expansion

**Dependencies:** REL-01-02 (BLOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??REL-01-02B for full details

#### REL-01-02C: Fix Snapshot Path Validation After Checkpoint

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (RELEASE READINESS, LIVE-SMOKE BLOCKER)
**Checkpoint:** `docs/REL-01-02C-CHECKPOINT.md`

**Objective:**
Fix the concrete live-stack defect blocking REL-01-02 so snapshot creation still works after checkpoint creation in the same session.

**Scope:**
- Inspect snapshot creation flow and path enumeration assumptions after checkpoint
- Identify why checkpoint-created state introduces non-workspace absolute paths into snapshot input
- Apply smallest safe fix so snapshot only processes valid workspace-relative paths
- Preserve existing checkpoint and snapshot behavior
- Rerun specific live-stack validation path to prove fix
- Document cause and resolution

**Out of scope:** ??No broader snapshot redesign, checkpoint redesign, unrelated path/schema cleanup, feature work, broad regression sweep, or scope expansion

**Dependencies:** REL-01-02 (BLOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??REL-01-02C for full details

#### REL-01-02D: Fix Public API Execution Status Lookup

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (RELEASE READINESS, LIVE-SMOKE BLOCKER)
**Checkpoint:** `docs/REL-01-02D-CHECKPOINT.md`

**Objective:**
Fix the concrete live-stack defect blocking REL-01-02 so public API execution status lookup works after successful API-key execution submission.

**Scope:**
- Inspect public AI execute/status flow assumptions
- Identify why execution submission succeeds but public execution lookup returns 404
- Apply smallest safe fix so public execution status lookup resolves correctly
- Preserve internal/public separation and existing internal execution behavior
- Rerun specific live-stack validation path to prove fix
- Document cause and resolution

**Out of scope:** ??No broader public API redesign, internal route redesign, feature work, broad regression sweep, or scope expansion

**Dependencies:** REL-01-02 (BLOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??REL-01-02D for full details

---

#### REL-01-03: Environment and Config Audit

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION (RELEASE READINESS, ENVIRONMENT / CONFIG CONSISTENCY)
**Checkpoint:** `docs/REL-01-03-CHECKPOINT.md`

**Objective:**
Validate and consolidate the environment/config assumptions required by the now-completed product wave so release-readiness work can proceed from a consistent Docker, env-var, and startup baseline.

**Scope:**
- Audit required environment variables across the current stack
- Verify docker-compose and docker-compose.prod assumptions against current runtime behavior
- Verify .env / .env.example / startup expectations are coherent where those files exist
- Identify missing, stale, or inconsistent config entries directly relevant to current features
- Document exact findings and required corrections

**Out of scope:** ??No feature work, no broad deployment redesign, no bug-fix sweep beyond concrete config defects found during this audit, no release packaging, no scope expansion

**Dependencies:** REL-01-02 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??REL-01-03 for full details

#### REL-01-03A: Fix Environment Template Defects

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (RELEASE READINESS, CONFIG BLOCKER)
**Checkpoint:** `docs/REL-01-03A-CHECKPOINT.md`

**Objective:**
Fix the concrete environment-template defects blocking REL-01-03 so release-readiness config audit can complete with coherent example/template files.

**Scope:**
- Correct `.env.prod.example`: replace `AI_PROVIDER=stub` with a valid non-stub provider default
- Correct `.env.prod.example`: add required `LAUNCH_STATE` entry
- Correct `services/ai-service/.env.example`: add `REDIS_URL`
- Correct `services/ai-service/.env.example`: add `DATABASE_URL`
- Rerun targeted config-audit checks to prove templates are now coherent
- Document exact cause and resolution

**Out of scope:** ??No feature work, no runtime code changes, no broad config redesign, no unrelated env cleanup, no scope expansion

**Dependencies:** REL-01-03 (BLOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??REL-01-03A for full details

#### REL-01-03B: Fix Production Provider Template Key Defect

**Status:** COMPLETE and LOCKED
**Nature:** BUG FIX (RELEASE READINESS, CONFIG BLOCKER)
**Checkpoint:** `docs/REL-01-03B-CHECKPOINT.md`

**Objective:**
Fix the concrete production env-template defect blocking REL-01-03 so the production example config is coherent with provider-validator expectations.

**Scope:**
- Correct only the identified production template defect in `.env.prod.example`
- Preserve current runtime behavior
- Rerun only targeted config-audit checks for this defect
- Document exact cause and resolution

**Out of scope:** ??No feature work, no runtime code changes, no broad config redesign, no unrelated env cleanup, no scope expansion

**Dependencies:** REL-01-03 (BLOCKED)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??REL-01-03B for full details

#### REL-01-05: Operational Runbook Update

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION (RELEASE READINESS, OPERATIONAL RUNBOOK)
**Checkpoint:** `docs/REL-01-05-CHECKPOINT.md`

**Objective:**
Create/update a minimal operational runbook so the now-validated stack can be started, migrated, checked, and recovered consistently for release-readiness and handoff.

**Scope:**
- Document startup order and stack prerequisites
- Document migration/run order and validation order
- Document key health checks and smoke checks
- Document core recovery steps for the blockers already encountered
- Document required env/config assumptions at a concise operational level

**Out of scope:** ??No feature work, no deployment redesign, no packaging/release automation, no broad ops platform work, no scope expansion

**Dependencies:** REL-01-01 (Complete and Locked), REL-01-02 (Complete and Locked), REL-01-03 (Complete and Locked)

**Reference:** See `TASKS_BACKLOG_FULL.md` ??REL-01-05 for full details

---

## WS — Workspace Rollout

**Family status:** ACTIVE — WS-01 COMPLETE and LOCKED; WS-02 COMPLETE and LOCKED; WS-03 COMPLETE and LOCKED; WS-04 COMPLETE and LOCKED; WS-05 COMPLETE and LOCKED; WS-06 COMPLETE and LOCKED; WS-07 COMPLETE and LOCKED

**Current stage:** WS-07 (COMPLETE and LOCKED)

---

#### WS-01: Workspace Schema, Entity, And Backfill Foundation

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/WS-01-CHECKPOINT.md`
**Nature:** BACKEND / SCHEMA / MIGRATION — workspace data model foundation
**Source:** Workspace v1 planning session (Apr 2026) — agreed bounded v1 plan

**Objective:**
Add the Workspace entity/table and nullable `Project.workspaceId` foundation, then perform safe idempotent backfill so each user has one default Personal workspace and all existing projects are assigned to that workspace. This slice is backend/schema only and intentionally stops before any new API or frontend UX.

**Bounded scope:**
- Backend/schema only
- Allowed files/surfaces:
  - new Workspace entity and module foundations as needed for schema wiring
  - Project entity update to add nullable `workspaceId` / workspace relation
  - User entity relation only if minimally needed for wiring
  - one TypeORM migration: workspaces table + nullable `workspace_id` on projects + indexes + idempotent backfill
- Workspaces table fields: `id`, `userId`, `name`, `slug`, `isDefault`, `createdAt`, `updatedAt`
- Indexes/constraints: unique `(userId, slug)`, index on `userId`, index on `(userId, isDefault)`
- Backfill: create one default Personal workspace per user if missing; assign existing projects with null `workspace_id` to that user's default workspace
- No frontend/UI
- No workspace CRUD endpoints
- No project create/list workspace-aware behavior
- No schema NOT NULL enforcement in this slice
- No member/role/billing/shared-workspace features

**Non-goals:**
- No frontend workspace selector
- No workspace CRUD API
- No workspace filtering in project list
- No move-project-between-workspaces
- No members / roles / billing / shared integrations
- No nested workspaces
- No session-to-workspace relationship
- No D1/PROJ-03 work
- No Phase D/E or unrelated work

**Acceptance checks:**
- New `workspaces` table exists with agreed v1 fields
- Projects have nullable `workspace_id` column and TypeORM relation wiring
- Exactly one default Personal workspace is created per user when missing
- Existing projects are backfilled to the user's default workspace
- Migration is idempotent/safe for rerun expectations
- Existing behavior outside workspace awareness remains unchanged
- Relevant backend typecheck/tests pass
- No schema migration beyond this bounded foundation

**Risks / invariants:**
- Workspace is personal-only in v1; no shared/team features
- Sessions remain attached to projects, not workspaces
- `workspace_id` must remain nullable in this slice
- Backfill must be safe and idempotent
- Do not break existing project ownership/user scoping
- Do not alter current project/session/history semantics
- Keep future expansion to members/roles/billing possible without redesign

**Dependencies:** PROJ-03-D1d-hotfix (Complete and Locked)

---

#### WS-02: Workspace CRUD API Foundation

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/WS-02-CHECKPOINT.md`
**Nature:** BACKEND / API — workspace CRUD endpoints
**Source:** WS v1 rollout — second slice; follows WS-01 schema foundation

**Objective:**
Add the minimal authenticated backend API for v1 personal workspaces: create, list, read, rename, and delete (non-default only). Keep all operations strictly user-scoped and additive. Stop before any frontend UX or project workspace-awareness changes.

**Bounded scope:**
- Backend/API only
- Allowed files/surfaces:
  - new workspaces service, controller, module
  - DTOs for create/update/list/read as needed
  - minimal repository/service wiring against the WS-01 Workspace entity
  - directly relevant unit tests
- Endpoints:
  - `POST /api/workspaces` — create workspace for current user
  - `GET /api/workspaces` — list current user's workspaces
  - `GET /api/workspaces/:id` — read one current-user workspace
  - `PATCH /api/workspaces/:id` — rename/update current-user workspace
  - `DELETE /api/workspaces/:id` — delete a non-default current-user workspace
- All access is owner-only via authenticated user
- Default workspace cannot be deleted
- Deletion of a non-default workspace reassigns its projects to the user's default workspace before removal
- No frontend/UI
- No project create/list workspace-awareness changes
- No members/roles/billing/shared-workspace behavior

**Non-goals:**
- No frontend workspace selector/UI
- No project list filtering by workspace
- No project creation with workspace choice
- No move-project-between-workspaces
- No members / roles / billing / shared integrations
- No nested workspaces
- No session-to-workspace relationship
- No D1/PROJ-03 work
- No Phase D/E or unrelated work

**Acceptance checks:**
- Authenticated user can create/list/read/update/delete their own workspaces via API
- Default workspace is protected from deletion
- Deleting a non-default workspace safely reassigns its projects to the default workspace first
- Cross-user access is rejected
- Existing behavior outside workspace CRUD remains unchanged
- Relevant backend build/tests pass

**Risks / invariants:**
- Workspace remains personal-only in v1
- Ownership is strictly user-scoped
- Do not break WS-01 backfill/default-workspace assumptions
- Do not alter existing project/session/history semantics beyond what is minimally required for safe workspace deletion
- Keep future member/role/billing expansion possible without redesign
- Scope is backend-only

**Dependencies:** WS-01 (Complete and Locked)

---

#### WS-03: Project Create/List Workspace-Awareness Foundation

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/WS-03-CHECKPOINT.md`
**Nature:** BACKEND / API — project create/list workspace-awareness
**Source:** WS v1 rollout — third slice; follows WS-02 CRUD API foundation

**Objective:**
Make backend project create/list/read flows workspace-aware by allowing project creation into a chosen workspace, defaulting to the user's default workspace when omitted, supporting optional workspace filtering on project list, and surfacing `workspaceId` in project responses — while keeping all ownership checks user-scoped and stopping before any frontend workspace selector/UI.

**Bounded scope:**
- Backend/API only
- Allowed files/surfaces:
  - project DTO(s) — add optional `workspaceId` to create DTO; add optional `workspaceId` query param to list
  - projects controller — accept and pass through `workspaceId` for create and list
  - projects service — resolve default workspace when `workspaceId` is omitted; validate ownership of provided `workspaceId`; filter list by workspace when requested
  - directly relevant tests
- Behavior:
  - `POST /api/projects` accepts optional `workspaceId`; omitted → user's default workspace; provided → must belong to current user
  - `GET /api/projects` supports optional `workspaceId` query filter
  - `GET /api/projects/:id` response includes `workspaceId`
  - all ownership checks remain user-scoped
  - no frontend/UI
  - no move-project-between-workspaces
  - no session-to-workspace changes

**Non-goals:**
- No frontend workspace selector/UI
- No workspace switcher/filter UI
- No move-project-between-workspaces
- No nested workspaces
- No members / roles / billing / shared integrations
- No session-to-workspace relationship
- No D1/PROJ-03 work
- No Phase D/E or unrelated work

**Acceptance checks:**
- User can create a project with an explicit owned `workspaceId`
- User can create a project without `workspaceId` and it lands in the default workspace
- Cross-user `workspaceId` is rejected
- `GET /api/projects` can filter by `workspaceId`
- Project responses surface `workspaceId`
- Existing user-scoped project behavior otherwise remains unchanged
- Relevant backend build/tests pass

**Risks / invariants:**
- Workspace remains personal-only in v1
- Ownership is strictly user-scoped
- Do not break WS-01 default-workspace assumptions
- Do not break existing project/session/history semantics
- Do not introduce frontend behavior in this slice
- Keep future move-project / members / billing expansion possible
- Keep scope backend-only

**Dependencies:** WS-02 (Complete and Locked)

---

#### WS-04: Frontend Workspace Types And API Helpers

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/WS-04-CHECKPOINT.md`
**Nature:** FRONTEND / PLUMBING — workspace types and API helpers
**Source:** WS v1 rollout — fourth slice; follows WS-03 project workspace-awareness

**Objective:**
Add the minimal frontend type definitions and API helper functions required to consume v1 personal workspaces and workspace-aware project responses. Stop before any visible workspace selector or management UI.

**Bounded scope:**
- Frontend only
- Allowed files/surfaces:
  - workspace-related frontend type file(s)
  - workspace API helper function(s) (list, read, create, update, delete)
  - project frontend types/helpers updated so `workspaceId` is represented where backend now returns it
  - directly relevant tests
- Behavior:
  - add frontend `Workspace` type(s) matching current backend response shape
  - add helper functions for all current workspace CRUD endpoints
  - update existing project frontend types/helpers to include `workspaceId` where applicable
  - no visible UI
  - no workspace selector/switcher yet
  - no create/rename/delete workspace UI yet
  - no move-project-between-workspaces yet

**Non-goals:**
- No visible frontend workspace UI
- No workspace selector/filter UI
- No project move UI
- No backend changes
- No D1/PROJ-03 work
- No Phase D/E or unrelated work

**Acceptance checks:**
- Frontend types accurately represent current backend workspace payloads
- Frontend project types include `workspaceId` where appropriate
- Helper functions exist for all current backend workspace CRUD endpoints
- Existing frontend runtime behavior unchanged (no UI consumes the new helpers yet)
- Relevant frontend typecheck/tests pass

**Risks / invariants:**
- Keep to frontend plumbing only — no visible workspace UX
- Do not change current frontend runtime behavior beyond additive types/helpers
- Keep v1 workspace model personal-only
- Preserve compatibility with current backend response shapes
- Keep scope minimal so WS-05 can build on top cleanly

**Dependencies:** WS-03 (Complete and Locked)

---

#### WS-05: Workspace Selector And Filtered Project List

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND / UX — workspace selector and project list filtering
**Source:** WS v1 rollout — fifth slice; follows WS-04 frontend plumbing
**Checkpoint:** `docs/WS-05-CHECKPOINT.md`

**Objective:**
Add the first visible workspace UX by loading the user's workspaces, showing a workspace selector in the existing project-first project surface, persisting the selected workspace in lightweight frontend state/storage, and filtering the visible project list to the selected workspace. Stop before workspace management UI and before moving projects between workspaces.

**Bounded scope:**
- Frontend only
- Allowed files/surfaces:
  - `page.tsx`
  - `workspace-shell.tsx`
  - `workspace-workspaces.logic.ts` / `workspace-projects.logic.ts` only if minimal helper adjustments are needed
  - directly relevant tests
- Behavior:
  - load workspaces for the current user
  - determine/select an active workspace (defaulting sensibly, likely the default/personal workspace)
  - render a workspace selector in the existing project-first project surface
  - filter project loading/list display to the active workspace
  - persist selected workspace in lightweight frontend storage if appropriate
  - no workspace create/rename/delete UI yet
  - no move-project-between-workspaces yet
  - no broader redesign beyond this selector/filter slice

**Non-goals:**
- No workspace create/rename/delete UI yet
- No move-project-between-workspaces yet
- No nested workspaces
- No members / roles / billing / shared integrations
- No session-to-workspace relationship
- No D1/PROJ-03 work
- No Phase D/E or unrelated work

**Acceptance checks:**
- User can see and switch between their workspaces in the project-first surface
- Project list reflects the selected workspace only
- Selected workspace persists appropriately across refresh/navigation if chosen for v1
- Existing project open/create behavior continues working within the selected workspace
- No workspace management UI appears
- Relevant frontend typecheck/tests pass

**Risks / invariants:**
- Keep to selector/filter UX only — no workspace CRUD management UI
- Preserve existing project-open/session/history behavior
- Keep workspace model personal-only in v1
- Preserve compatibility with current backend response shapes
- Keep scope minimal so WS-06 can build on top cleanly

**Dependencies:** WS-04 (Complete and Locked)

---

#### WS-06: Workspace Create/Rename/Delete UI

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND / UX — workspace management UI
**Source:** WS v1 rollout — sixth slice; follows WS-05 selector/filter surface
**Checkpoint:** `docs/WS-06-CHECKPOINT.md`

**Objective:**
Add the minimal user-facing UI for creating, renaming, and deleting personal workspaces using the existing WS-02 CRUD API and WS-05 selector surface. Keep it lightweight, safe, and additive. Stop before project move UI and broader workspace redesign.

**Bounded scope:**
- Frontend only
- Allowed files/surfaces:
  - `page.tsx`
  - `workspace-shell.tsx`
  - `workspace-workspaces.logic.ts` only if tiny helper adjustments are needed
  - directly relevant tests
- Behavior:
  - user can create a workspace from the existing workspace surface
  - user can rename the currently selected workspace
  - user can delete a non-default workspace
  - default workspace delete action is hidden or disabled
  - after create/rename/delete, workspace list and selected workspace state refresh correctly
  - deletion follows existing backend rule safely
  - no move-project-between-workspaces yet
  - no broader redesign beyond this management slice

**Non-goals:**
- No move-project-between-workspaces yet
- No nested workspaces
- No members / roles / billing / shared integrations
- No session-to-workspace relationship
- No D1/PROJ-03 work
- No Phase D/E or unrelated work

**Acceptance checks:**
- User can create a workspace from the visible workspace surface
- User can rename a workspace
- User can delete a non-default workspace
- Default workspace delete is not offered or is clearly disabled
- Workspace selector/list refreshes correctly after create/rename/delete
- Selected workspace state behaves sensibly after delete
- Existing project list/project-open behavior remains intact
- Relevant frontend typecheck/tests pass

**Risks / invariants:**
- Keep this to workspace management UI only
- Do not broaden into move-project-between-workspaces
- Preserve existing project-open/session/history behavior
- Keep workspace model personal-only in v1
- Preserve compatibility with current backend CRUD behavior
- Keep scope minimal and avoid broader sidebar redesign

**Dependencies:** WS-05 (Complete and Locked)

---

#### WS-07: Move Project Between Workspaces

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/WS-07-CHECKPOINT.md`
**Nature:** BACKEND + FRONTEND — move project workspace assignment
**Source:** WS v1 rollout — seventh slice; follows WS-06 workspace management UI

**Objective:**
Allow a user to move an existing owned project from its current workspace to another owned workspace, with strict ownership validation and safe frontend state refresh. The move changes only the project.workspaceId relationship and does not affect sessions, files, snapshots, history, or saved versions.

**Bounded scope:**
- Backend + frontend minimal move support
- Allowed files/surfaces:
  - backend project update/move endpoint or existing PATCH project route if present
  - backend projects service/controller/DTO and tests
  - frontend workspace/project helper for move action
  - `page.tsx` handler and state refresh
  - `workspace-shell.tsx` minimal move control in the existing project surface
  - directly relevant tests
- Behavior:
  - user can move a selected/existing project to another owned workspace
  - backend validates: project belongs to current user; target workspace belongs to current user
  - move updates only project.workspaceId
  - after move, frontend refreshes the current workspace project list
  - moved project disappears from current filtered list if it no longer belongs to the selected workspace
  - if moved project was currently selected/open, active session/files/history are not closed or mutated in this slice; only list membership changes
  - no nested workspaces, no team/shared workspaces, no sessions-to-workspaces, no history/snapshot changes

**Non-goals:**
- No drag-and-drop move UI
- No bulk move
- No nested workspaces
- No members / roles / billing / shared integrations
- No session-to-workspace relationship
- No file/session/history mutation
- No D1/PROJ-03 work
- No Phase D/E or unrelated work

**Acceptance checks:**
- User can move an owned project to another owned workspace
- Cross-user project move is rejected
- Cross-user target workspace is rejected
- Moving project only changes workspaceId
- Project list refreshes correctly after move
- Project open/session/history behavior remains unchanged
- Relevant backend/frontend typecheck/tests pass

**Risks / invariants:**
- Moving a project is metadata-only
- Do not mutate project files, sessions, snapshots, history, or saved versions
- Keep workspace ownership strictly user-scoped
- Preserve current open project/session if it is moved while open
- Preserve project-first UX and existing workspace selector/filter behavior
- Keep UI simple; no drag-and-drop or broad redesign

**Dependencies:** WS-06 (Complete and Locked)

---

## AI-CTX — AI Workspace Context Awareness

**Family status:** AI-CTX-01 COMPLETE and LOCKED

**Current stage:** AI-CTX-01 (COMPLETE and LOCKED)

---

#### AI-CTX-01: Inject Workspace File Tree And Selected File Path Into AI Prompts

**Status:** COMPLETE and LOCKED
**Nature:** CROSS-LAYER CONTEXT PLUMBING — frontend → api-gateway → queue → ai-service worker
**Source:** Inspection session (Apr 2026) — AI answers "list files" like a generic chatbot because the execution path carries no workspace context

**Objective:**
Make the active AI execution path aware of the current workspace file list and selected file path so non-mutating questions like "list all files" can be answered correctly without adding destructive actions, schema changes, new endpoints, or broad AI tooling changes.

**Bounded scope:**
- Serialize a compact flat list of workspace file paths from the existing `workspaceFileTree` state
- Include selected file path if present
- Pass this as optional `workspaceContext` through:
  - frontend execute request body (`page.tsx`)
  - api-gateway AI execution controller/request type/queue forwarding
  - queue job data type
  - ai-service worker prompt builder (`worker.processor.ts`)
- Worker prepends a concise workspace context section to the model prompt when context is present
- If context is absent, existing behavior remains unchanged (backward-compatible)
- Do not include full file contents in this slice
- Do not add new API endpoints or schema changes
- Do not change file-action schema or parsing
- Do not add AI file delete support

**Allowed files/surfaces:**
- `frontend/app/[locale]/app/page.tsx`
- api-gateway AI execution request DTO/controller/queue forwarding surfaces
- queue job data type(s)
- `services/ai-service/src/worker/worker.processor.ts`
- directly relevant tests

**Non-goals:**
- No AI file delete support
- No selected file content injection
- No full file-content prompt stuffing
- No new backend or container-manager endpoints
- No schema or migration changes
- No new tool system
- No broad AI agent refactor
- No UX/UI polish
- No workspace rollout (WS family) work

**Acceptance checks:**
- Asking AI to list files can use the injected file-path context
- Context includes a compact workspace file path list
- Context includes selected file path when present
- Existing AI execute calls still work when `workspaceContext` is absent
- Existing file-action create/write/update behavior remains unchanged
- Typecheck/build passes for all touched layers
- Relevant focused tests pass
- No introduced lint errors

**Risks / invariants:**
- Keep context compact — do not include file contents (token/cost blowup risk)
- Preserve current file-action output contract; context is prepended, not mixed in
- Keep `workspaceContext` optional and backward-compatible at every layer
- Do not introduce container-manager dependency into ai-service worker
- Preserve existing provider selection and queue execution semantics
- No destructive action support in this slice

**Dependencies:** None (standalone context plumbing slice)

---

## AI-WS — AI Workspace Capability

**Family status:** ACTIVE — AI-WS-06 COMPLETE and LOCKED; AI-WS-03-hotfix COMPLETE and LOCKED; AI-WS-03-hotfix2 COMPLETE and LOCKED; AI-WS-03-hotfix3 COMPLETE and LOCKED; AI-WS-02-hotfix COMPLETE and LOCKED; AI-WS-03-hotfix4 COMPLETE and LOCKED; AI-WS-03-hotfix5 COMPLETE and LOCKED; AI-WS-06-hotfix COMPLETE and LOCKED; AI-WS-06-hotfix2 COMPLETE and LOCKED; AI-WS-06-hotfix3 COMPLETE and LOCKED

**Current stage:** AI-WS-06-hotfix3 (COMPLETE and LOCKED)

---

#### AI-WS-01: Selected File Content Context Injection

**Status:** COMPLETE and LOCKED
**Nature:** CROSS-LAYER CONTEXT PLUMBING — frontend → api-gateway → queue → ai-service worker
**Source:** Planning session (Apr 2026) — AI cannot explain or reason about the selected/open file because its content is never included in the execution context
**Depends on:** AI-CTX-01 (COMPLETE and LOCKED)

**Objective:**
Extend the existing `workspaceContext` plumbing introduced in AI-CTX-01 to include the content of the currently selected/open file, capped and safely filtered, so the AI can answer questions about the selected file without adding named file read, workspace search, file delete, new endpoints, or broad AI tooling.

**Bounded scope:**
- Source selected file content from existing frontend `selectedFileContent` state
- Include content only when `selectedFilePath` is present and `selectedFileContent` is available
- Cap content at approximately 8,000 characters; truncate safely with a clear marker if exceeded
- Exclude content for known-sensitive and unsuitable file types:
  - `.env` and any file matching `*.env`, `.env.*`, `*.env.*`
  - files with secret/credential-like names (`.secret`, `*.key`, `*.pem`, `*.cert`, etc.)
  - binary/asset files (images, fonts, compiled outputs)
  - package lock files (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, etc.)
  - generated/minified files detectable by path pattern
- Pass `selectedFileContent` as an additional optional field through:
  - frontend execute request body (`page.tsx`)
  - api-gateway AI execution request type/controller/queue forwarding
  - queue job data type (`AiExecutionJob` / `WorkspaceContext`)
  - ai-service worker prompt builder (`worker.processor.ts` — `buildWorkspaceContextBlock`)
- Worker includes selected file content in the context block under the existing context section
- If content is absent or excluded, existing behavior is unchanged (backward-compatible)
- Do not add named file read support
- Do not add workspace search support
- Do not add AI file delete support
- Do not add new API endpoints or schema changes
- Do not change file-action schema or parsing

**Allowed files/surfaces:**
- `frontend/app/[locale]/app/page.tsx`
- `services/api-gateway/src/clients/ai-service-http.client.ts`
- `services/api-gateway/src/ai/ai-execution.controller.ts` (if forwarding changes needed)
- `services/ai-service/src/queue/job.types.ts`
- `services/ai-service/src/worker/worker.processor.ts`
- directly relevant tests

**Non-goals:**
- No AI file delete support
- No named file read support
- No workspace search support
- No full-project content prompt stuffing
- No arbitrary file read from backend/container-manager
- No selected multiple-file content injection
- No new backend or container-manager endpoints
- No schema or migration changes
- No new tool system
- No broad AI agent refactor
- No UX/UI polish
- No unrelated workspace rollout work

**Acceptance checks:**
- When a file is selected/open and content is eligible, AI prompt context includes capped selected file content
- AI can answer questions about the selected file (e.g. "explain this file", "what are these buttons for?")
- Existing file-path list and selected-file-path context from AI-CTX-01 still work unchanged
- Large selected file content is truncated with a clear marker
- Sensitive/unsuitable files (`.env`, lock files, binary assets) are not injected
- Existing AI execute calls still work when selected file content is absent
- Existing file-action create/write/update behavior remains unchanged
- Typecheck/build passes for all touched layers
- Relevant focused tests pass
- No introduced lint errors

**Risks / invariants:**
- Content injection is selected-file-only; never inject all project files
- Cap at ~8,000 characters to avoid token/cost blowup
- Never inject obvious secrets/env/credential files
- Do not inject binary/assets or lock files
- Keep `workspaceContext` optional and backward-compatible at every layer
- Preserve current file-action output contract; context block is prepended, not mixed in
- Do not introduce container-manager dependency into ai-service worker
- Preserve existing provider selection and queue execution semantics
- No destructive action support in this slice

**Dependencies:** AI-CTX-01 (COMPLETE and LOCKED)

---

#### AI-WS-02: AI File Action Safety And Confirmation Foundation

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND SAFETY/INTERCEPT LAYER — file-action batch classification and confirmation UI before risky AI writes apply
**Source:** Planning session (Apr 2026) — before adding destructive action support (delete), a safety/confirmation foundation is needed so risky AI file-action batches can be intercepted and approved
**Depends on:** AI-WS-01 (COMPLETE and LOCKED)

**Objective:**
Add a frontend safety/confirmation foundation for risky AI file actions before expanding destructive capabilities. Small safe create/write/update batches continue to apply as today. Risky batches are held for user approval. The design leaves a clear extension point for future delete confirmation.

**Bounded scope:**
- Frontend safety/intercept layer only
- Add a confirmation/intercept path before applying risky AI file-action batches
- Keep normal small create/write/update actions applying as today (backward-compatible)
- Classify risky batches conservatively, for example:
  - more than 3 file actions in a single batch
  - single file content larger than a defined size threshold
  - file paths matching obvious config/env/package patterns (e.g. `package.json`, `.env`, config files)
- User can approve pending risky actions; approved actions flow through the existing `applySequentialFileActions` path
- User can cancel pending risky actions; cancelled actions are not applied
- Future delete actions should have a clear place to plug in, but delete itself is not implemented here
- Do not add AI file delete support
- Do not change file-action schema or parser
- No backend/API/schema changes

**Allowed files/surfaces:**
- `frontend/app/[locale]/app/page.tsx`
- `frontend/components/workspace/workspace-ai-file-actions.logic.ts`
- `frontend/components/workspace/workspace-shell.tsx` or a small confirmation component if needed
- directly relevant tests

**Non-goals:**
- No AI file delete support
- No named file read support
- No workspace search support
- No file-action parser or schema changes
- No backend/API/container-manager changes
- No automatic snapshot integration in this slice
- No full diff viewer
- No broad UX redesign
- No unrelated workspace rollout work

**Acceptance checks:**
- Small safe create/write/update batches still apply immediately as before
- Risky batches are held for confirmation before applying
- User can approve and actions apply through existing `applySequentialFileActions` logic
- User can cancel and nothing is applied
- Existing AI create/write/update backward-compatible behavior preserved for safe batches
- Design leaves a clear extension point for future delete confirmation
- Frontend typecheck passes
- Relevant focused tests pass
- No introduced lint errors

**Risks / invariants:**
- Do not block ordinary safe AI edits unnecessarily
- Do not apply risky actions before user approval
- Do not change file-action parser/schema in this slice
- Do not add delete support in this slice
- Preserve existing idempotency guards and `applySequentialFileActions` semantics
- Preserve project/session/history behavior
- Keep this a safety foundation, not a broad UX redesign

**Dependencies:** AI-WS-01 (COMPLETE and LOCKED)

---
#### AI-WS-03: AI File Delete Support

**Status:** COMPLETE and LOCKED
**Nature:** CROSS-LAYER FILE-ACTION EXTENSION — extend file-action contract to allow AI-proposed delete, always held for confirmation, frontend delete call through api-gateway to container-manager
**Source:** Planning session (Apr 2026) — delete is the next destructive capability after safety confirmation foundation is in place
**Depends on:** AI-WS-02 (COMPLETE and LOCKED)

**Objective:**
Add support for AI-proposed file delete actions through the active file-actions path, with mandatory confirmation before deletion and safe editor/file-tree cleanup after successful deletion. Delete must be metadata/action-safe and must not change unrelated file-action behavior.

**Bounded scope:**
- Extend active ile-actions contract to allow delete action type
- Delete action requires path; does not require content
- Parser accepts delete and validates path using existing path safety rules
- Frontend file-action type/guard accepts delete without content
- Delete actions are always treated as risky and held for confirmation via AI-WS-02 confirmation flow
- Approved delete calls a frontend delete helper
- Frontend delete helper calls api-gateway delete route
- Api-gateway proxies to existing container-manager delete file endpoint/client
- After successful delete: refresh file tree; if deleted file is selected/open file, clear selected file/editor state safely
- No directory delete in v1
- No bulk-delete special UI beyond existing confirmation list
- No schema/database changes

**Allowed files/surfaces:**
- services/ai-service/src/worker/worker.processor.ts
- services/ai-service/src/ai-execution/types.ts
- services/ai-service/src/ai-execution/file-actions.parser.ts
- services/api-gateway/src/sessions/session.controller.ts
- services/api-gateway/src/clients/container-manager-http.client.ts
- rontend/components/workspace/workspace-ai-file-actions.logic.ts
- rontend/components/workspace/workspace-file-navigation.logic.ts
- rontend/app/[locale]/app/page.tsx
- rontend/components/workspace/workspace-shell.tsx (only if minimal confirmation/status wording needed)
- directly relevant tests

**Non-goals:**
- No named file read support
- No workspace search support
- No broad tool-system refactor
- No directory delete
- No bulk-delete UX beyond existing confirmation
- No automatic snapshot integration unless trivially available and safe
- No full diff viewer
- No unrelated workspace rollout work
- No D1/PROJ-03 work

**Acceptance checks:**
- AI can emit a valid delete file-action
- Delete action without content parses successfully
- Delete action is always held for confirmation
- Cancelling delete applies nothing
- Approving delete deletes the target file through existing container-manager support
- File tree refreshes after delete
- If selected/open file is deleted, editor/file selection clears safely
- Create/write/update existing behavior remains unchanged
- Backend/frontend/ai-service builds and focused tests pass
- No introduced lint errors

**Risks / invariants:**
- Delete is destructive and must always require confirmation
- Do not allow delete before user approval
- Do not delete directories in v1
- Keep existing path traversal protections
- Do not bypass session usability checks
- Preserve existing create/write/update behavior
- Preserve idempotency and duplicate-delivery guards
- Preserve project/session/history behavior
- No schema or migration
- No broad AI agent refactor

**Dependencies:** AI-WS-02 (COMPLETE and LOCKED)

---

#### AI-WS-04: Project And Workspace Metadata Context

**Status:** COMPLETE and LOCKED
**Nature:** CROSS-LAYER CONTEXT PLUMBING — extend `workspaceContext` with lightweight project/workspace metadata for better prompt grounding
**Source:** Planning session (Apr 2026) — after file and selected-file awareness are in place, AI should understand the current workspace/project it is operating in
**Depends on:** AI-WS-03 (COMPLETE and LOCKED)

**Objective:**
Extend the existing AI `workspaceContext` plumbing to include lightweight project/workspace metadata so AI responses can reference the current workspace/project context accurately, without adding file reads, search, new endpoints, schema changes, or broader AI tooling.

**Bounded scope:**
- Cross-layer context plumbing only
- Include current project name if available
- Include current workspace name if available
- Omit project id, workspace id, session id, and session status to keep context concise
- Preserve existing file path list, selected file path, and selected file content context
- Worker prepends concise metadata inside the existing workspace context block
- Context remains optional and backward-compatible
- If metadata is absent, existing behavior remains unchanged
- No new endpoints
- No schema/database changes
- No named file read
- No workspace search
- No AI file delete changes
- No file-action schema/parser changes

**Allowed files/surfaces:**
- `frontend/app/[locale]/app/page.tsx`
- api-gateway AI execution request type/controller/queue forwarding surfaces if needed
- ai-service queue job type
- `services/ai-service/src/worker/worker.processor.ts`
- directly relevant tests

**Non-goals:**
- No named file read support
- No workspace search support
- No full-project content stuffing
- No new backend/container-manager endpoint
- No schema or migration
- No new tool system
- No broad AI agent refactor
- No UX/UI polish
- No unrelated workspace rollout work
- No D1/PROJ-03 work

**Acceptance checks:**
- AI prompt context includes project/workspace names when available
- Existing file path list, selected file path, and selected file content context still work
- Existing AI execute calls still work if metadata is absent
- Existing file-action create/write/update/delete behavior remains unchanged
- Context stays compact and avoids leaking auth/user/secrets
- Relevant frontend/api-gateway/ai-service typecheck/build/tests pass
- No introduced lint errors

**Risks / invariants:**
- Keep metadata lightweight
- Do not include auth tokens, user email, user id, secrets, or billing data
- Names only; no ids/session metadata
- Preserve optional/backward-compatible `workspaceContext` behavior
- Do not change file-action schema/parser/delete support
- Do not introduce container-manager dependency into ai-service worker
- Preserve provider selection and queue execution semantics
- No destructive action changes in this slice

**Dependencies:** AI-WS-03 (COMPLETE and LOCKED)

---

#### AI-WS-05: Named File Read Support

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND-LED NAMED FILE CONTEXT INJECTION — detect explicitly named workspace files, read bounded safe contents through existing frontend file-read capability, and pass them through existing `workspaceContext`
**Source:** Planning session (Apr 2026) — AI still cannot explain a named file unless that file is currently selected/open
**Depends on:** AI-WS-04 (COMPLETE and LOCKED)

**Objective:**
Allow the AI to answer questions about one or more named workspace files by using existing frontend file-read capability to include bounded, safe file contents for explicitly mentioned files, without adding workspace search, broad tool-system refactor, schema changes, or full-project content stuffing.

**Bounded scope:**
- Cross-layer / frontend-led named file read support
- Detect explicitly named file paths from the user prompt when they match existing workspace file paths
- Read a small bounded number of matched named files per prompt (target: max 3)
- Include matched named file contents in `workspaceContext` as named file content blocks
- Cap each named file content at approximately 8,000 characters and include a truncation marker when capped
- Reuse the same sensitive/unsuitable path exclusions as selected file content
- Do not include contents for unmatched paths
- Do not read arbitrary paths outside `workspaceFileTree`
- Do not search file contents
- Preserve selected-file content context from AI-WS-01
- Preserve project/workspace metadata context from AI-WS-04
- If no named files match, existing behavior remains unchanged
- Do not add new backend/container-manager endpoint if existing frontend read helper is sufficient
- Do not add workspace search support
- Do not add grep/search endpoint
- Do not add broad tool-system refactor
- Do not add provider-native tool calling
- Do not add full-project content stuffing
- Do not add arbitrary backend/container-manager reads beyond matched workspace files
- Do not add AI file delete changes
- Do not change file-action schema/parser
- No schema/database changes

**Allowed files/surfaces:**
- `frontend/app/[locale]/app/page.tsx`
- `frontend/components/workspace/workspace-file-navigation.logic.ts` if existing read helper needs a small adjustment
- AI workspace context type surfaces if needed
- `services/api-gateway/src/clients/ai-service-http.client.ts` if context shape changes
- `services/ai-service/src/queue/job.types.ts` if context shape changes
- `services/ai-service/src/worker/worker.processor.ts` if context prompt block changes
- directly relevant tests

**Non-goals:**
- No workspace search support
- No grep/search endpoint
- No broad tool-system refactor
- No provider-native tool calling
- No full-project content stuffing
- No arbitrary backend/container-manager reads beyond matched workspace files
- No AI file delete changes
- No file-action schema/parser changes
- No schema or migration
- No broad UX/UI polish
- No unrelated workspace rollout work
- No D1/PROJ-03 work

**Acceptance checks:**
- User can ask about a named file that is not currently selected/open, and AI receives that file's bounded content
- Only file paths present in current `workspaceFileTree` are eligible
- Named file contents are capped and marked if truncated
- Sensitive/binary/lock/generated paths are excluded
- Existing selected-file content, file list, and project/workspace metadata context remain intact
- Existing AI create/write/update/delete behavior remains unchanged
- Typecheck/build/focused tests pass
- No introduced lint errors

**Risks / invariants:**
- Keep named file read explicit and bounded
- Do not search arbitrary content in this slice
- Do not inject entire project contents
- Do not read paths not present in `workspaceFileTree`
- Do not inject secrets/env/binary/lock/generated files
- Keep token/cost caps strict
- Preserve optional/backward-compatible `workspaceContext` behavior
- Do not change file-action schema/parser/delete behavior
- Do not introduce container-manager dependency into ai-service worker
- Preserve provider selection and queue semantics

---

#### AI-WS-06: Workspace Content Search Support

**Status:** COMPLETE and LOCKED
**Nature:** BOUNDED WORKSPACE CONTENT SEARCH — safely search text-like workspace files for explicit locate/find questions without broad tool refactors or arbitrary command execution
**Source:** Planning session (Apr 2026) — AI still cannot search across workspace file contents for prompts like "where is login implemented?" or "which files mention this text?"
**Depends on:** AI-WS-05 (COMPLETE and LOCKED)

**Objective:**
Add a bounded, safe workspace content search capability so AI can answer questions like "where is login implemented?" or "which files mention this text?" without full-project content stuffing, arbitrary command execution, provider-native tool refactors, or broad agent redesign.

**Bounded scope:**
- Safe workspace search support only
- Support user prompts that explicitly ask to search/find text or locate where something is implemented
- Search only text-like files under the current workspace/session
- Cap result size strictly, for example max files/results/characters
- Exclude sensitive/unsuitable paths:
  - env/secrets/credentials
  - binary/assets
  - lock/generated/vendor directories
- Do not expose arbitrary shell command execution to the model
- Do not stuff all file contents into prompt
- Do not change file-action schema/parser/delete support
- Do not add provider-native tool calling
- No schema/database changes
- No broad agent refactor
- If search cannot run safely, fail closed with a clear message

**Allowed files/surfaces:**
- `frontend/app/[locale]/app/page.tsx`
- `frontend/components/workspace/workspace-file-navigation.logic.ts` or a new small workspace-search helper if needed
- `services/api-gateway/src/sessions/session.controller.ts` only if a safe search route is needed
- `services/api-gateway/src/clients/container-manager-http.client.ts` only if proxy support is needed
- `services/container-manager/src/files` or session exec/search surface only if a safe bounded search endpoint is needed
- `services/ai-service/src/worker/worker.processor.ts` only if prompt/context contract needs search-result wording
- workspaceContext type surfaces if search results are injected into prompt context
- directly relevant tests

**Non-goals:**
- No provider-native tool calling
- No broad AI agent/tool-system refactor
- No arbitrary shell command execution
- No full-project content stuffing
- No vector index / embeddings
- No database schema/migration
- No semantic search
- No recursive binary/asset scanning
- No search across other projects/workspaces
- No AI file delete changes
- No file-action parser/schema changes
- No unrelated workspace rollout work
- No D1/PROJ-03 work

**Acceptance checks:**
- AI can answer a prompt asking where a named text/function/component is used, based on bounded search results
- Search is scoped to the current workspace/session only
- Search skips sensitive/binary/generated/vendor paths
- Search output is capped
- Search cannot execute arbitrary commands
- Existing file list, selected file, selected content, named-file content, metadata, create/write/update/delete behavior remain unchanged
- Relevant frontend/backend/typecheck/build/tests pass
- No introduced lint errors

**Risks / invariants:**
- Search must be bounded and safe
- Do not introduce arbitrary command execution controlled by the model
- Keep result payload compact to avoid token/cost blowup
- Keep search scoped to current workspace/session
- Do not leak secrets/env files
- Preserve optional/backward-compatible `workspaceContext` behavior
- Preserve provider selection and queue semantics
- Preserve existing file-action behavior
- No destructive action changes in this slice

---

#### AI-WS-03-hotfix: Correct AI Execute 403 Error Wording

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/AI-WS-03-hotfix-CHECKPOINT.md`
**Nature:** FRONTEND WORDING HOTFIX — correct misleading AI execute error guidance for generic 403 responses without changing backend enforcement or AI behavior
**Source:** Inspection session (Apr 2026) — frontend currently maps generic `POST /api/ai/execute` 403 failures to quota wording even when the failure can be access/launch/scope/auth related
**Depends on:** AI-WS-06 (COMPLETE and LOCKED)

**Objective:**
Fix the frontend error guidance so generic 403 AI execute failures are not mislabeled as quota failures.

**Bounded scope:**
- Frontend only
- Likely files:
  - `frontend/components/workspace/workspace-quota-usage.logic.ts`
  - `frontend/components/workspace/workspace-quota-usage.logic.test.ts` only if a directly relevant seam exists
- Do not map all 403 responses to quota wording
- Keep quota/rate-limit wording when:
  - status code is 429, or
  - raw message clearly includes quota/rate-limit wording
- For 403 without quota/rate-limit wording:
  - preserve useful backend message if available, or
  - use a generic access fallback such as "Request blocked by access rules. Check your API key permissions or launch access."

**Non-goals:**
- No backend changes
- No quota enforcement changes
- No launch/auth guard changes
- No provider logic changes
- No AI delete behavior changes
- No file-action parser/schema changes

**Acceptance checks:**
- 429 still maps to quota/rate-limit guidance
- 403 with quota wording still maps to quota guidance
- 403 without quota wording maps to access/permission guidance, not quota
- Typecheck and focused tests pass
- No introduced lint errors

**Risks / invariants:**
- Frontend wording fix only
- Do not change actual quota, auth, launch, or provider behavior
- Do not affect AI file-action handling or delete flow
- Preserve existing non-403/non-429 behavior unless directly affected

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AI-WS-03-hotfix.

---

#### AI-WS-03-hotfix2: Accept Raw JSON File-Actions Fallback

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/AI-WS-03-hotfix2-CHECKPOINT.md`
**Nature:** AI SERVICE PARSER HOTFIX — add a safe fallback extraction path for bare `{"file-actions":[...]}` model output so that delete/create/write/update actions survive the known contract-violation output shape without changing the primary fenced block contract
**Source:** Inspection session (May 2026) — model sometimes emits raw JSON `{"file-actions":[...]}` instead of a fenced ```file-actions block; the current parser only reads fenced blocks, so no file actions are extracted and no confirmation appears
**Depends on:** AI-WS-03 (COMPLETE and LOCKED); AI-WS-03-hotfix (COMPLETE and LOCKED)

**Objective:**
Make the ai-service file-action parser tolerate the known malformed-but-clear model output shape `{"file-actions":[...]}` so delete/create/write/update actions inside that raw JSON can still enter the existing frontend apply/confirmation pipeline, without changing fenced block extraction, frontend behavior, or backend file handling.

**Bounded scope:**
- AI service parser only, plus focused parser tests
- Likely files:
  - `services/ai-service/src/ai-execution/file-actions.parser.ts`
  - `services/ai-service/src/ai-execution/__tests__/file-actions.parser.spec.ts`
  - `services/ai-service/src/worker/worker.processor.ts` only if a tiny prompt wording clarification is needed
  - directly relevant tests
- Existing fenced ```file-actions block extraction remains unchanged (primary path)
- If no fenced file-actions block is found, parser may fall back to detecting a bare JSON object with a top-level `"file-actions"` array in the text output
- Fallback accepts only clear JSON object payloads with a top-level array
- Actions inside fallback still go through existing action/path/content validation
- Delete without content still parses correctly as supported by AI-WS-03
- Non-delete actions still require content
- Malformed JSON or unsafe action/path must fail closed and produce no file actions
- No frontend changes
- No backend/API/container-manager changes
- No file-action apply logic changes
- No preview routing changes

**Non-goals:**
- No change to AI delete application behavior
- No change to confirmation UI
- No preview/static routing fix
- No file-action schema expansion beyond existing AI-WS-03 actions
- No named file read/search changes
- No backend/API/container-manager changes
- No UX/UI changes
- No unrelated workspace rollout work
- No D1/PROJ-03 work

**Acceptance checks:**
- Raw JSON `{"file-actions":[{"action":"delete","path":"foo.html"}]}` extracts a delete action
- Raw JSON create/write/update with valid content extracts correctly
- Non-delete raw JSON action without content is rejected (no action extracted)
- Existing fenced block tests still pass
- Malformed raw JSON does not crash and extracts no actions
- Unsafe paths remain rejected by existing path validation
- AI service build and focused parser tests pass
- No introduced lint errors

**Risks / invariants:**
- Fenced block contract remains the primary expected model format
- Fallback must be narrow and safe — do not parse arbitrary prose as actions
- Do not loosen path safety
- Do not change frontend confirmation or apply semantics
- Delete remains risky/confirmation-gated downstream as established by AI-WS-02
- No backend or frontend behavior changes beyond parser extraction

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AI-WS-03-hotfix2.

---

#### AI-WS-03-hotfix3: Surface Backend Delete Error Message

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/AI-WS-03-hotfix3-CHECKPOINT.md`
**Nature:** FRONTEND HELPER HOTFIX — update `deleteWorkspaceFile` to surface the backend error message on failed delete responses instead of discarding the response body
**Source:** Inspection session (May 2026) — after AI-WS-03-hotfix2, delete reaches the apply pipeline but `deleteWorkspaceFile` throws generic `File delete failed (404)` instead of surfacing the container-manager's useful `File not found: index2.html` message
**Depends on:** AI-WS-03-hotfix2 (COMPLETE and LOCKED)

**Objective:**
Update the frontend delete helper to read and surface the backend `message` field from non-OK delete responses, while preserving existing fallback behavior for non-JSON or empty error bodies.

**Bounded scope:**
- Frontend helper only, plus focused tests
- Likely files:
  - `frontend/components/workspace/workspace-file-navigation.logic.ts`
  - `frontend/components/workspace/workspace-file-navigation.logic.test.ts`
- On failed `deleteWorkspaceFile(...)` response:
  - try to parse JSON response body
  - if body has useful string `message`, throw that message
  - otherwise keep fallback: `File delete failed (<status>)`
  - non-JSON error body must not crash
- Successful delete behavior unchanged
- No backend changes
- No AI parser changes
- No file-action apply logic changes
- No confirmation UI changes
- No delete route/body changes
- No preview changes

**Non-goals:**
- No backend changes
- No AI parser changes
- No file-action apply logic changes
- No confirmation UI changes
- No delete route/body changes
- No preview changes
- No unrelated workspace rollout work
- No D1/PROJ-03 work

**Acceptance checks:**
- 404 with JSON `{ message: "File not found: index2.html" }` throws `File not found: index2.html`
- 404 with non-JSON body falls back to `File delete failed (404)`
- 204/OK delete still resolves successfully
- Existing read/write/list helper behavior unchanged
- Frontend typecheck and focused tests pass
- No introduced lint errors

**Risks / invariants:**
- Frontend-only
- Do not alter delete route, confirmation gate, parser, or backend behavior
- Preserve fallback for non-JSON errors
- Preserve existing file-action apply semantics

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AI-WS-03-hotfix3.

---

#### AI-WS-02-hotfix: Sanitize Restored Pending File-Action Confirmations

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/AI-WS-02-hotfix-CHECKPOINT.md`
**Nature:** FRONTEND CHAT-THREAD RESTORE HOTFIX — sanitize stale `awaiting-confirmation` file-action states when restoring persisted chat messages, so ghost Apply buttons are never rendered after session restore or page reload
**Source:** Inspection session (May 2026) — after AI-WS-03-hotfix3, observed that delete-test.html appeared to not delete when Apply was pressed; root cause traced to a prior unconfirmed execution's awaiting-confirmation state being restored from localStorage, while `pendingConfirmationExecutionIdsRef` was cleared — pressing Apply silently returned with no action
**Depends on:** AI-WS-02 (COMPLETE and LOCKED)

**Objective:**
In `parseStoredChatThreadMessages`, when a restored message has `fileActionState.applyStatus === 'awaiting-confirmation'`, convert it to `applyStatus: 'skipped'` with `skipReason: 'session-restored'` and `confirmationRequired: false`, so the message shows a neutral skipped indicator rather than a non-functional Apply button.

**Bounded scope:**
- Frontend chat-thread restore normalization only, plus focused tests
- Likely files:
  - `frontend/components/workspace/workspace-chat-thread.logic.ts`
  - `frontend/components/workspace/workspace-chat-thread.logic.test.ts`
- In `parseStoredChatThreadMessages`, convert restored `awaiting-confirmation` → `skipped` with `skipReason: 'session-restored'`
- Already applied states remain unchanged
- Already skipped/failed states remain unchanged
- In-session confirmation behavior remains unchanged
- No changes outside the restore/parse path

**Non-goals:**
- No change to live confirmation/apply flow
- No change to `pendingConfirmationExecutionIdsRef` logic
- No model output contract changes
- No backend/API/container-manager changes
- No parser/schema changes
- No delete behavior changes
- No broad chat persistence refactor
- No confirmation UI redesign
- No preview changes

**Acceptance checks:**
- Restored message with `applyStatus: 'awaiting-confirmation'` becomes `applyStatus: 'skipped'` with `skipReason: 'session-restored'` and `confirmationRequired: false`
- Restored message with `applyStatus: 'applied'` remains unchanged
- Restored message with `applyStatus: 'skipped'` remains unchanged
- Restored message with no `fileActionState` remains unchanged
- Existing chat-thread parsing behavior intact
- Frontend typecheck and focused tests pass
- No introduced lint errors

**Risks / invariants:**
- Frontend-only
- Do not affect live in-session confirmation flow
- Do not silently apply stale actions after restore
- Do not render dead Apply buttons after restore
- Preserve existing applied/skipped/failed historical messages

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AI-WS-02-hotfix.

---

#### AI-WS-03-hotfix4: Preserve Delete File Actions In API Gateway Execution Results

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/AI-WS-03-hotfix4-CHECKPOINT.md`
**Nature:** API GATEWAY DTO / PARSER HOTFIX — update execution-result DTO and metadata parser to accept and return delete file-actions, preventing status/execute responses from stripping delete actions out of completed execution results
**Source:** Inspection session (May 2026) — delete file-actions arrive correctly through SSE but the status/execute response returns `fileActions: []` for delete executions because `parseExecutionResultMetadata` only accepts create/write/update, silently dropping delete; this causes the frontend pending confirmation state to be overwritten with an empty action array, making the Apply button disappear
**Depends on:** AI-WS-03 (COMPLETE and LOCKED)

**Objective:**
Update `FileActionDto` and `parseExecutionResultMetadata` in the API gateway so delete file-actions stored in execution metadata are included in status/execute responses, matching the AI-WS-03 action schema.

**Bounded scope:**
- API gateway execution-result DTO and metadata parser only, plus focused tests
- Likely files:
  - `services/api-gateway/src/ai/dto/execution-result.dto.ts`
  - `services/api-gateway/src/ai/ai-execution.controller.ts`
  - focused test file for execution result metadata parsing
- `FileActionDto.action` extends to include `"delete"`
- `content` is optional or absent for delete actions in the DTO
- `parseExecutionResultMetadata` accepts delete actions with string `path` and no `content`
- create/write/update actions still require string `content`
- invalid actions still dropped
- No frontend changes
- No ai-service parser changes
- No container-manager changes
- No delete route/body changes
- No confirmation UI changes
- No file-action apply logic changes

**Non-goals:**
- No frontend changes
- No ai-service changes
- No container-manager changes
- No delete route changes
- No confirmation UI redesign
- No apply logic changes
- No unrelated status shape changes

**Acceptance checks:**
- Metadata with delete action returns `fileActions` containing the delete entry
- Metadata with mixed create + delete returns both
- Delete action without `content` is accepted
- Non-delete action without `content` is still rejected
- Existing create/write/update parsing tests pass
- API gateway build and focused tests pass
- No introduced lint errors

**Risks / invariants:**
- API gateway DTO must align with AI-WS-03 action schema
- Do not loosen content validation for create/write/update
- Do not change frontend behavior in this task
- Preserve existing status response shape; only extend to allow delete with no content

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AI-WS-03-hotfix4.

---

#### AI-WS-03-hotfix5: Route File Delete Through Container Exec

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/AI-WS-03-hotfix5-CHECKPOINT.md`
**Nature:** CONTAINER-MANAGER ROUTING HOTFIX — route file delete through Docker exec (matching read/write/list) instead of host `fs.unlink()` via FilesController; update API gateway HTTP client to target the internal sessions delete route
**Source:** Inspection session (May 2026) — deleting an existing file fails with "File not found" because `ContainerManagerHttpClient.deleteSessionFile` calls `DELETE /api/files/${sessionId}/delete` (FilesController → host fs.unlink), while all other file operations route through `InternalSessionsController` → Docker exec; on Windows/Docker Desktop bind mounts this produces a filesystem view mismatch
**Depends on:** AI-WS-03 (COMPLETE and LOCKED)

**Bounded scope:**
- Container-manager delete path and API gateway HTTP client target URL only
- Likely files:
  - `services/container-manager/src/docker/docker-runtime.service.ts`
  - `services/container-manager/src/sessions/sessions.service.ts`
  - `services/container-manager/src/sessions/internal-sessions.controller.ts`
  - `services/api-gateway/src/clients/container-manager-http.client.ts`
  - focused tests for changed surfaces
- No frontend changes
- No AI parser changes
- No file-action apply logic changes
- No confirmation UI changes
- No API gateway user-facing route changes
- No schema/migration
- No broad file API refactor
- Existing FilesController delete route may remain but must no longer be called by the API gateway client

**Acceptance checks:**
- Deleting a file that exists in the active container workspace succeeds
- Deleting a missing file returns a useful not-found error
- Path traversal is rejected
- API gateway client calls the new internal sessions delete route
- Read/write/list behavior unchanged
- Container-manager and API-gateway builds and focused tests pass
- No introduced lint errors

**Risks / invariants:**
- Must not introduce arbitrary shell command execution
- Use existing container exec safety patterns (validateWorkspacePath)
- Keep delete scoped to current session workspace
- Do not delete directories recursively — file-only delete in v1
- Preserve frontend/API gateway public route behavior
- Preserve AI file-action apply and confirmation gate behavior

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AI-WS-03-hotfix5.

----

#### AI-WS-06-hotfix: Route Workspace Search Through Container Exec

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/AI-WS-06-hotfix-CHECKPOINT.md`

#### AI-WS-06-hotfix2: Simplify Container Search Script And Log Failures

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/AI-WS-06-hotfix2-CHECKPOINT.md`
**Nature:** CONTAINER-MANAGER DOCKER RUNTIME HOTFIX — simplify the multi-line shell search script to eliminate `mktemp`/temp-file dependency that may silently fail in minimal container images; add diagnostic stderr logging when exec exits non-zero with empty stdout so failures are no longer invisible
**Source:** Inspection session (May 2026) — after AI-WS-06-hotfix, search routes correctly through Docker exec but still returns empty results; named-file read confirms keyword exists in `key.txt`; inspection shows the entire route chain and prompt/context flow are correct; likely failure is inside the search shell script itself: `mktemp` or `find` may not be available in the minimal sandbox image, causing script to exit non-zero with empty stdout, which is silently swallowed and returned as `{ results: [] }` — indistinguishable from a genuine no-match
**Depends on:** AI-WS-06-hotfix (COMPLETE and LOCKED)

**Bounded scope:**
- `services/container-manager/src/docker/docker-runtime.service.ts` — replace `mktemp`/temp-file pattern with direct `find ... | while read` pipeline; add stderr warning log on non-zero empty-stdout exit
- `services/container-manager/src/docker/docker-runtime.service.spec.ts` — add focused tests for stderr logging path and `.txt` file match parsing

**Non-goals:**
- No API gateway changes
- No frontend changes
- No AI service prompt/context changes
- No route changes
- No schema/migration
- No semantic/vector search
- No file-action or delete behavior changes
- No change to query validation, safety caps, exclusions, or response shape

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AI-WS-06-hotfix2.

#### AI-WS-06-hotfix3: Force Grep Filename Prefix In Container Search

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/AI-WS-06-hotfix3-CHECKPOINT.md`
**Nature:** CONTAINER-MANAGER SEARCH SCRIPT ONE-LINE FIX — add `-H` flag to `grep` call inside `searchFilesInContainer` shell script so output always includes the filename prefix, making results parseable by the existing TypeScript parser
**Source:** Inspection session (May 2026) — after AI-WS-06-hotfix2, search still returns no matches; live container test confirmed that `grep -Fni` omits filename when searching a single file (output: `1:SPECIAL_TEST_KEYWORD`), but the parser expects `path:line:preview` (e.g. `/workspace/key.txt:1:SPECIAL_TEST_KEYWORD`); `grep -FnHi` forces filename inclusion; BusyBox grep (used by `node:20-alpine`) supports `-H`
**Depends on:** AI-WS-06-hotfix2 (COMPLETE and LOCKED)

**Bounded scope:**
- `services/container-manager/src/docker/docker-runtime.service.ts` — change `grep -Fni` to `grep -FnHi` in `searchFilesInContainer` shell script
- `services/container-manager/src/docker/docker-runtime.service.spec.ts` — assert generated script contains `grep -FnHi` (update/extend existing assertion)

**Non-goals:**
- No API gateway changes
- No frontend changes
- No AI service prompt/context changes
- No route changes
- No parser response shape changes
- No semantic/vector search
- No file-action or delete behavior changes
- No query validation or safety cap changes

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AI-WS-06-hotfix3.
**Nature:** CONTAINER-MANAGER ROUTING HOTFIX — route AI workspace content search through Docker exec inside the active sandbox container, matching the read/write/list/delete architecture; update API gateway HTTP client to target the internal sessions search route
**Source:** Inspection session (May 2026) — AI-WS-06 workspace search can run but returns no matches even when named-file read can see the content; root cause is the same host/container filesystem mismatch that affected delete before AI-WS-03-hotfix5: `FilesService.searchFiles()` uses `fs.readdir()` + `fs.readFile()` against the host `workspacePath`, while files live in the active container `/workspace/` view; on Windows/Docker Desktop/WSL2 this produces empty results
**Depends on:** AI-WS-06 (COMPLETE and LOCKED); AI-WS-03-hotfix5 (COMPLETE and LOCKED)

**Objective:**
Route AI workspace content search through the same active-container execution path as read/write/list/delete, preserving all AI-WS-06 safety caps, exclusions, and result format.

**Bounded scope:**
- `services/container-manager/src/docker/docker-runtime.service.ts` — add `searchFilesInContainer(sessionId, query)` using safe Docker exec (grep or equivalent), bounded by AI-WS-06 caps
- `services/container-manager/src/sessions/sessions.service.ts` — add `searchFilesInContainer(sessionId, query)` with existing session governance checks
- `services/container-manager/src/sessions/internal-sessions.controller.ts` — add `POST :id/files/search` route guarded by `InternalServiceAuthGuard`
- `services/api-gateway/src/clients/container-manager-http.client.ts` — change `searchSessionFiles()` target from `POST /api/files/${sessionId}/search` to `POST /api/internal/sessions/${sessionId}/files/search` with internal service key header
- Focused tests for the above

**Non-goals (explicit):**
- No frontend changes
- No AI service prompt/context changes
- No file-action parser changes
- No delete behavior changes
- No schema/migration
- No broad file API refactor
- No semantic/vector/embedding search
- No arbitrary shell command execution exposed to the model

**Required behavior:**
- Plain text query only; no shell interpolation of query into command string
- Max query length enforced (same cap as AI-WS-06: 120 chars)
- Max files scanned, max matches, max preview chars, max total response chars (same caps as AI-WS-06)
- Text-like files only; binary detection preserved
- Skip env/secrets/credentials files
- Skip binary/asset extensions
- Skip lock/generated/vendor/dist/node_modules directories
- Empty or unsafe query rejected or fail-closed
- Existing `FilesController` search route remains but is no longer used by API gateway client
- Existing frontend `searchWorkspaceFiles(...)` and public API gateway route stay unchanged

**Risks / invariants:**
- Do not introduce arbitrary shell command execution
- Keep search scoped to current session `/workspace` only
- Keep result payload compact and bounded
- Preserve AI-WS-06 exclusions, caps, and result format
- Preserve frontend and API gateway public route behavior
- Preserve AI prompt/context behavior
- Preserve all read/write/list/delete behavior

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AI-WS-06-hotfix.

---

## PREVIEW — Preview Routing & Static Serving

**Family status:** ACTIVE — PREVIEW-hotfix COMPLETE and LOCKED

**Current stage:** PREVIEW-hotfix (COMPLETE and LOCKED)

---

#### PREVIEW-hotfix: Preserve Static HTML Relative Links Under Proxy Route

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/PREVIEW-hotfix-CHECKPOINT.md`
**Nature:** CONTAINER-MANAGER STATIC PREVIEW HOTFIX — inject a `<base>` tag into served static HTML responses so relative links resolve under the `/proxy/` route namespace without changing file storage, write paths, or AI behavior
**Source:** Inspection session (May 2026) — static HTML preview iframe is loaded at `/api/preview/<sessionId>/proxy`; relative links like `href="page2.html"` resolve to `/api/preview/<sessionId>/page2.html` and miss the `/proxy/` route, causing 404
**Depends on:** AI-WS-03-hotfix2 (COMPLETE and LOCKED)

**Objective:**
Make normal static HTML relative links and buttons work inside the preview iframe by injecting a correct `<base>` tag into served static HTML responses so relative URLs resolve under `/api/preview/<sessionId>/proxy/`, without changing file write paths, AI file actions, workspace storage, or broad preview architecture.

**Bounded scope:**
- Container-manager static preview serving only
- Likely files:
  - `services/container-manager/src/preview/preview.service.ts`
  - focused preview test (existing spec or new focused spec alongside)
  - directly relevant tests
- When serving static HTML preview content, inject `<base href="/api/preview/<sessionId>/proxy/">` into `<head>` if present; otherwise insert safely near the top of the document
- Only apply to HTML responses — do not modify CSS, JS, images, or other assets
- Do not inject if a `<base>` tag is already present in the document
- Do not change workspace file storage paths
- Do not change AI file-action paths
- Do not change session file read/write/delete APIs
- Do not change non-static (dynamic/server) preview behavior
- Keep implementation small and testable

**Non-goals:**
- No AI parser changes
- No AI prompt changes
- No file-action changes
- No workspace storage changes
- No route redesign
- No SPA routing overhaul
- No broad preview refactor
- No D1/PROJ-03 work
- No unrelated workspace rollout work

**Acceptance checks:**
- Static HTML response includes correct `<base href="/api/preview/<sessionId>/proxy/">`
- HTML with `<head>` gets base tag injected inside `<head>`
- HTML with an existing `<base>` tag is not double-injected
- Non-HTML assets are not modified
- Relative links like `page2.html` resolve to `/api/preview/<sessionId>/proxy/page2.html`
- Relevant build/tests pass
- No introduced lint errors

**Risks / invariants:**
- Inject only in served response — do not rewrite user files on disk
- Do not modify non-HTML content
- Do not break existing asset loading
- Do not change file write/read/delete behavior
- Do not change AI behavior
- Keep fix limited to static preview content serving

**Reference:** See `TASKS_BACKLOG_FULL.md` -> PREVIEW-hotfix.

---

## UX-FILETREE — Workspace File Tree UX

**Family status:** COMPLETE and LOCKED — UX-FILETREE-hotfix COMPLETE and LOCKED

**Current stage:** none active (UX-FILETREE-hotfix wave complete)

**Completed tasks:** UX-FILETREE-hotfix — COMPLETE and LOCKED.

---

#### UX-FILETREE-hotfix: Hide Internal Git Files From Workspace File Tree

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND FILE-TREE DISPLAY/FILTER HOTFIX — exclude `.git/` and everything under `.git/` from the user-facing Files panel, applied consistently after initial load, create refresh, delete refresh, and manual refresh; no change to on-disk files or internal git/checkpoint behavior
**Source:** User observation (May 2026) — after create or delete operations, the workspace file tree can show internal `.git/` contents (hooks, objects, logs, refs, HEAD, index, config) which should not be visible to the user
**Depends on:** (none)

**Bounded scope:**
- `frontend/components/workspace/workspace-file-navigation.logic.ts` — added `isInternalGitTreeEntry()` filter in `loadWorkspaceFileTree()` before sort and recursion
- `frontend/components/workspace/workspace-file-navigation.logic.test.ts` — added focused `.git` filtering regression test (10 tests total, all pass)
- `frontend/app/[locale]/app/page.tsx` — not changed (filtering is entirely in the shared logic module)

**Non-goals:**
- No change to git/checkpoint behavior
- No deletion of `.git` from disk
- No change to file create/write/delete behavior
- No change to AI file-action behavior
- No broad file tree redesign
- No hiding of other dotfiles beyond `.git/`

**Reference:** See `TASKS_BACKLOG_FULL.md` -> UX-FILETREE-hotfix. See `docs/UX-FILETREE-hotfix-CHECKPOINT.md`.

---

## UX-IA — Product & UX/UI Redesign (Evolutionary)

**Family status:** ACTIVE — AUTH-APP-01 NEXT (cross-family; UX-IA-04 follows after)

**Current stage:** AUTH-APP-01 (not started — register under AUTH family before implementing)

**Master spec:** `docs/UX-IA-00-MASTER-PLAN.md`

**Ordered slices:**
1. UX-IA-00 — Master spec (COMPLETE — `docs/UX-IA-00-MASTER-PLAN.md`)
2. UX-IA-01 — i18n Foundation & Locale Middleware (COMPLETE and LOCKED — `docs/UX-IA-01-CHECKPOINT.md`)
3. UX-IA-02 — Design Token Foundation (COMPLETE and LOCKED — `docs/UX-IA-02-CHECKPOINT.md`)
4. UX-IA-03 — Public Landing Redesign + Login/Register Polish (COMPLETE and LOCKED — `docs/UX-IA-03-CHECKPOINT.md`)
   ↳ AUTH-APP-01 — aiSandBox First-Party User Authentication (cross-family — NEXT; see `docs/UX-IA-00-MASTER-PLAN.md` AUTH-APP-01 entry; register under AUTH family before starting)
5. UX-IA-04 — Workspace Shell + Sidebar + Home View (pending — note: confirm AUTH-APP-01 stability before UX-IA-04 reaches users)
6. UX-IA-05 — Projects Grid/List + Recent Projects (pending)
7. UX-IA-06 — Templates / Community View (pending)
8. UX-IA-07 — Account Menu + Settings + Language/Theme (pending)
9. UX-IA-08 — Project Mode Shell (pending)
10. UX-IA-09 — Project AI + History Panel (pending)
11. UX-IA-10 — Preview + Code & Files Tabs (pending)
12. UX-IA-11 — Future Product Tab Placeholders (pending)
13. UX-IA-12 — Upgrade Flow + Dashboard Polish (pending)
14. UX-IA-13 — Responsive / Mobile Polish (pending)
15. UX-IA-14 — Route Cleanup / Redirects (pending)
16. UX-IA-15 — Visual Edit Mode Foundation (pending — requires UX-IA-08 + UX-IA-10 COMPLETE)
17. UX-IA-16 — Visual Edit AI Patch Flow (pending — requires UX-IA-15 COMPLETE)
18. UX-IA-17 — Visual Edit Undo / Checkpoint Integration (pending — requires UX-IA-16 COMPLETE)
   ↳ AUTH-MODULE-01 — Reusable App-Auth Module for aiSandBox-Created Apps (cross-family — later product capability; requires AUTH-APP-01 + UX-IA-08–UX-IA-10 COMPLETE; see `docs/UX-IA-00-MASTER-PLAN.md` AUTH-MODULE-01 entry; register under AUTH family before starting)

---

#### UX-IA-01: i18n Foundation & Locale Middleware

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/UX-IA-01-CHECKPOINT.md`
**Nature:** FRONTEND I18N INFRASTRUCTURE — expand translation files to all required namespaces, implement English fallback in `useTranslations`, add locale middleware for default locale redirect, decide namespace access pattern and `sandbox` namespace migration strategy; no visual or layout changes
**Source:** UX-IA-00 master plan (May 2026) — multilingual is mandatory; all later UX phases must use translation keys from day one to prevent hardcoded-string debt
**Depends on:** UX-IA-00 (COMPLETE)

**Bounded scope:**
- `frontend/middleware.ts` (new) — default locale redirect, must not interfere with `/api/*`
- `frontend/messages/en.json` — expand with all namespaces
- `frontend/messages/zh-TW.json` — expand with all namespaces
- `frontend/messages/zh-CN.json` — expand with all namespaces
- `frontend/hooks/useTranslations.ts` — add English fallback (active locale → English → key)
- `frontend/components/TranslationProvider.tsx` — pass `fallbackMessages` (en.json) alongside active locale messages
- `frontend/app/[locale]/layout.tsx` — if needed to import en.json as fallback
- `frontend/components/LanguageSwitcher.tsx` — minor polish if needed

**Non-goals:**
- No visual redesign
- No workspace layout changes
- No AI-WS logic changes
- No route cleanup beyond locale middleware
- No recoveryCopy rewrite
- No public landing redesign
- No deletion of existing `sandbox` namespace keys (migration strategy decided within this slice, applied gradually)

**Decision points (resolve and record during consolidation):**
- Namespace access pattern: components call `useTranslations` once per namespace (current pattern), or hook extended for cross-namespace dot paths
- `sandbox` namespace migration strategy: keep existing keys for now / migrate gradually / mark deprecated

**Reference:** See `TASKS_BACKLOG_FULL.md` -> UX-IA-01.

---

#### UX-IA-02: Design Token Foundation

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/UX-IA-02-CHECKPOINT.md`
**Nature:** FRONTEND CSS / TAILWIND CONFIG — establish brand, surface, border, text, and muted token strategy; define light theme CSS custom properties in `:root`; prepare dark theme placeholders if low-risk; no component or layout changes
**Source:** UX-IA-00 master plan (May 2026) — all subsequent visual phases must build on a shared token system to avoid palette drift
**Depends on:** UX-IA-01 (COMPLETE and LOCKED)

**Bounded scope:**
- `frontend/tailwind.config.js` — extend theme with brand, surface, border, text, and muted color tokens; add font family and radius tokens
- `frontend/app/globals.css` — define CSS custom properties for light theme in `:root`; add dark theme placeholder block if low-risk
- `frontend/app/[locale]/layout.tsx` — add `next/font` Inter font import if needed; keep all i18n/TranslationProvider wiring unchanged

**Non-goals:**
- No workspace layout changes
- No public landing redesign
- No login/register redesign
- No component restructuring
- No full dark mode implementation (placeholders only)
- No new external dependencies (Next.js built-ins only)
- No i18n changes
- No AI-WS changes

**Acceptance checks:**
- `frontend/tailwind.config.js` has brand/surface/border/text/muted token extensions
- `frontend/app/globals.css` has `:root` CSS variable block for light theme tokens
- Font loads correctly in running app
- Frontend typecheck passes (`npx tsc --noEmit`)
- Frontend tests pass (`npm run test`)
- Frontend build passes (`npm run build`)
- No lint/read errors on touched files
- No visual regressions to existing pages beyond token defaults naturally applying
- No regressions to locale middleware or `TranslationProvider`

**Reference:** See `TASKS_BACKLOG_FULL.md` -> UX-IA-02.

---

#### UX-IA-03: Public Landing Redesign + Login/Register Polish

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/UX-IA-03-CHECKPOINT.md`
**Nature:** FRONTEND UI / I18N — redesign public landing as "Build anything" entry experience with prompt chatbox and CTA; polish login/register pages using UX-IA-02 design tokens; full i18n for all three pages; no auth changes, no workspace changes
**Source:** UX-IA-00 master plan (May 2026) — public landing and login/register are the first user-facing surfaces; must reflect the new product direction before workspace redesign begins
**Depends on:** UX-IA-01 (COMPLETE and LOCKED), UX-IA-02 (COMPLETE and LOCKED)

**Bounded scope:**
- `frontend/components/public/public-landing-slice.tsx` — redesign with "Build anything" headline, subtitle, prompt chatbox, sign-in/register CTA
- `frontend/app/[locale]/page.tsx` — wire updated landing component props
- `frontend/app/[locale]/login/page.tsx` — visual polish using design tokens + full i18n
- `frontend/app/[locale]/register/page.tsx` — visual polish using design tokens + full i18n
- `frontend/components/LanguageSwitcher.tsx` — ensure visible on all three pages if not already
- `frontend/messages/en.json` — add/complete landing/login/register i18n keys
- `frontend/messages/zh-TW.json` — same
- `frontend/messages/zh-CN.json` — same
- Focused tests for prompt sessionStorage preservation if test setup supports them

**Required behavior:**
- `/[locale]` public landing shows: "Build anything" headline, short subtitle, prompt input, sign-in/register CTA
- Submitting the prompt before login must **not** create a project
- Submitting the prompt before login must store the prompt text in `sessionStorage` and redirect to login or register
- Login/register pages remain functionally unchanged — visual/i18n polish only
- Login/register use design token CSS classes where practical (colors, font, radius)
- All landing/login/register user-facing strings use `useTranslations` i18n keys
- UX-IA-01 English fallback behavior unchanged
- UX-IA-02 font and token foundation unchanged

**Auth non-goals (explicitly forbidden in this slice):**
- No Auth.js / NextAuth
- No Google OAuth / Apple OAuth
- No database-backed auth or session changes
- No API guards or backend auth changes
- No password reset flows
- No email verification
- No provider account linking
- No route/API protection changes
- All of the above belong to AUTH-APP-01 (later)

**Other non-goals:**
- No authenticated workspace redesign
- No workspace shell/sidebar changes
- No project mode changes
- No preview tab changes (Visual Edit Mode is roadmap-only — see master plan Section 12)
- No AI-WS changes
- No billing/upgrade changes
- No new external dependencies
- No route cleanup

**Acceptance checks:**
- `/en` renders public landing with "Build anything" headline and prompt input
- `/zh-TW` and `/zh-CN` render localized landing/login/register text
- Prompt submission before login stores text in `sessionStorage` and redirects to login/register
- Login and register flows still work as before
- Missing locale keys fall back to English (UX-IA-01 behavior)
- Frontend typecheck passes (`npx tsc --noEmit`)
- Frontend tests pass (`npm run test`)
- Frontend build passes (`npm run build`)
- No lint/read errors on touched files
- No regression to locale middleware redirects

**Risks / invariants:**
- Do not break existing auth form functionality
- Do not hardcode new landing/login/register strings (all must use `t('key')`)
- Do not change workspace or AI-WS behavior
- Keep this slice public/auth-page UI only
- Visual Edit Mode remains roadmap-only after this slice
- AUTH-APP-01 remains roadmap-only after this slice

**Reference:** See `TASKS_BACKLOG_FULL.md` -> UX-IA-03.

---

## AUTH — aiSandBox First-Party Authentication

**Family status:** VALIDATION COMPLETE (AUTH-APP-01C2 ACTIVE — AUTH-APP-01C2A COMPLETE; AUTH-APP-01C2B COMPLETE; AUTH-APP-01C2C COMPLETE; AUTH-APP-01C2D PLANNED; manual smoke deferred) — AUTH-APP-01E COMPLETE — AUTH-APP-01F VALIDATION COMPLETE (carry-forwards pending) — AUTH-APP-01F1 COMPLETE — AUTH-APP-01F2 COMPLETE — AUTH-APP-01F3 COMPLETE — AUTH-APP-01F4 COMPLETE — AUTH-APP-01G VALIDATION COMPLETE (manual smoke deferred) — AUTH-APP-01G1 COMPLETE — AUTH-APP-01G2 COMPLETE — AUTH-APP-01G3 COMPLETE — AUTH-APP-01G4 COMPLETE — AUTH-APP-01H VALIDATION COMPLETE (manual smoke deferred) — AUTH-APP-01H1 COMPLETE — AUTH-APP-01H2 COMPLETE — AUTH-APP-01H3 COMPLETE — AUTH-APP-01H4 COMPLETE — AUTH-APP-01Z COMPLETE

**Current stage:** AUTH-APP-01C2D — Password Reset Backend Flow

**Master spec:** `docs/AUTH-APP-01-SPEC.md` (decision-complete as of AUTH-APP-01A)
**Reference master plan:** `docs/UX-IA-00-MASTER-PLAN.md` (AUTH-APP-01 entry)

**Important distinction:**
- `AUTH-APP-01` — authentication for the aiSandBox platform itself (this family)
- `AUTH-MODULE-01` — reusable generated app-auth for user-created apps (later, separate family)

**Parent roadmap: AUTH-APP-01 — aiSandBox First-Party User Authentication**

**Parent status: VALIDATION COMPLETE — AUTH-APP-01C2 ACTIVE (AUTH-APP-01C2A COMPLETE; AUTH-APP-01C2B COMPLETE; AUTH-APP-01C2C COMPLETE; AUTH-APP-01C2D PLANNED); manual smoke deferred; carry-forwards pending**
**Parent checkpoint:** `docs/AUTH-APP-01-CHECKPOINT.md`

Goal: add production-ready authentication (email, Google, Apple) for the aiSandBox hosted app so real users can sign in securely before using platform features.

Confirmed child slices (AUTH-APP-01C1 further split — stage-start found backend + frontend surface too large for one slice):
1. AUTH-APP-01A — Auth Architecture & Implementation Spec (COMPLETE and LOCKED)
2. AUTH-APP-01B — Database / Schema Migrations (COMPLETE and LOCKED)
3. AUTH-APP-01C1A — Backend Cookie Session Foundation (COMPLETE and LOCKED)
4. AUTH-APP-01C1B — Frontend localStorage/Bearer Migration (COMPLETE and LOCKED)
5. AUTH-APP-01C2 — Email Verification / Password Reset / Rate Limiting (ACTIVE — AUTH-APP-01C2A COMPLETE; AUTH-APP-01C2B COMPLETE; AUTH-APP-01C2C COMPLETE; AUTH-APP-01C2D PLANNED)
6. AUTH-APP-01D — Google OAuth (COMPLETE and LOCKED)
7. AUTH-APP-01E — Apple OAuth (COMPLETE and LOCKED)
8. AUTH-APP-01F — Route / API Protection (VALIDATION COMPLETE — carry-forwards/manual smoke deferred — child slices all complete):
   - AUTH-APP-01F1 — Route/API Protection Inventory + Spec (COMPLETE and LOCKED)
   - AUTH-APP-01F2 — Backend API Protection Gaps (COMPLETE and LOCKED)
   - AUTH-APP-01F3 — Frontend Protected Route Behavior (COMPLETE and LOCKED)
   - AUTH-APP-01F4 — Protection Validation + Consolidation (COMPLETE and LOCKED)
9. AUTH-APP-01G — Auth UX Integration (VALIDATION COMPLETE — manual smoke deferred — all child slices COMPLETE and LOCKED):
   - AUTH-APP-01G1 — Auth UX Inventory + Scope (COMPLETE and LOCKED)
   - AUTH-APP-01G2 — Login/Register OAuth Error + Button Polish (COMPLETE and LOCKED)
   - AUTH-APP-01G3 — Logout + Basic Account Surface (COMPLETE and LOCKED)
   - AUTH-APP-01G4 — Auth UX Validation + Checkpoint (COMPLETE and LOCKED)
10. AUTH-APP-01H — Security Hardening + Validation Checklist (VALIDATION COMPLETE — manual smoke deferred — all child slices COMPLETE and LOCKED):
    - AUTH-APP-01H1 — Security Hardening Inventory (COMPLETE and LOCKED)
    - AUTH-APP-01H2 — CSRF + Rate Limiting + Redirect Hardening (COMPLETE and LOCKED)
    - AUTH-APP-01H3 — Events Endpoint Guards + Test/Tooling Triage (COMPLETE and LOCKED)
    - AUTH-APP-01H4 — Manual Smoke + Secrets Audit + Final AUTH-APP-01H Consolidation (COMPLETE and LOCKED)
11. AUTH-APP-01Z — Final Consolidation (COMPLETE and LOCKED)

**Sequencing note:** AUTH-APP-01D (Google OAuth) depends on AUTH-APP-01C1A (session cookie infrastructure must exist for OAuth callbacks to set cookies). AUTH-APP-01D does NOT need to wait for AUTH-APP-01C1B or AUTH-APP-01C2. AUTH-APP-01C2 is now ACTIVE; AUTH-APP-01C2A is the current stage.

**AUTH-APP-01C2 provider decision:** Resend selected as v1 transactional email provider (decided 2026-05-08). AUTH-APP-01C2 is unblocked. Required env vars: EMAIL_PROVIDER=resend, RESEND_API_KEY, AUTH_EMAIL_FROM, APP_BASE_URL. EmailProvider abstraction required — auth business logic must not call Resend directly.

---

#### AUTH-APP-01A: Auth Architecture & Implementation Spec

**Status:** COMPLETE and LOCKED
**Nature:** SPEC / ARCHITECTURE DOCUMENT ONLY
**Source:** UX-IA-00 master plan (May 2026) AUTH-APP-01 entry; cross-family next step after UX-IA-03
**Depends on:** UX-IA-03 (COMPLETE and LOCKED)
**Completed:** 2026-05-06
**Checkpoint:** `docs/AUTH-APP-01A-CHECKPOINT.md`
**Spec:** `docs/AUTH-APP-01-SPEC.md`

**Key decisions recorded:**
1. **Auth stack:** Extend existing NestJS + Passport + JWT backend. Auth.js / NextAuth explicitly rejected (would create two parallel auth systems).
2. **Token/session storage:** HTTP-only secure cookie session with server-side `auth_sessions` table. localStorage `access_token` removed.
3. **OAuth callback flow:** Server-side session establishment. No token in redirect URL. `state` parameter validated. Post-login redirect uses allowlist.
4. **Account linking:** Verified-email auto-link allowed (Google same-email → existing account). Apple private relay email never auto-linked. Conflict cases return safe errors.
5. **Data model changes (AUTH-APP-01B):** Make `password_hash` nullable; add `oauth_accounts`, `verification_tokens`, `auth_sessions` tables.
6. **Email provider:** Transactional email provider unresolved — blocks AUTH-APP-01C email verification and password reset. Must be resolved before AUTH-APP-01C stage-start.
7. **Slice order:** AUTH-APP-01B → C → D → E → F → G → H → Z (locked; C may split into C1 + C2).

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01A. See `docs/AUTH-APP-01-SPEC.md`.

---

#### AUTH-APP-01B: Database / Schema Migrations

**Status:** COMPLETE and LOCKED
**Source:** AUTH-APP-01A spec (`docs/AUTH-APP-01-SPEC.md` Section 5); locked slice order
**Depends on:** AUTH-APP-01A (COMPLETE and LOCKED)
**Completed:** 2026-05-06
**Checkpoint:** `docs/AUTH-APP-01B-CHECKPOINT.md`

**Implemented:**
- `users.password_hash` made nullable (fixes schema/entity mismatch blocking OAuth users)
- Added missing `users` columns already declared in entity: `auth_provider`, `oauth_id`, `last_login_at`, `stripe_customer_id`
- Created `oauth_accounts` table with FK, unique constraint, and index
- Created `verification_tokens` table with FK, unique token_hash, and composite index
- Created `auth_sessions` table with FK, unique session_token_hash, and expires_at index
- Created `OauthAccount`, `VerificationToken`, `AuthSession` TypeORM entities
- Added legacy/backward-compat comments to `User.authProvider` and `User.oauthId`
- Added `User.oauthAccounts` OneToMany relation
- Registered all three new entities in `AuthModule.TypeOrmModule.forFeature`

**Validation:**
- `npx tsc --noEmit`: PASS
- `npm test`: FAIL — pre-existing environment issue (REDIS_URL not set during test bootstrap); not caused by this slice
- `npm run lint`: FAIL — pre-existing tooling issue (ESLint config not discoverable by package lint script); not caused by this slice

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01B. See `docs/AUTH-APP-01B-CHECKPOINT.md`.

---

#### AUTH-APP-01C1A: Backend Cookie Session Foundation

**Status:** COMPLETE and LOCKED
**Source:** AUTH-APP-01C1 stage-start (scope split; backend surface isolated here)
**Depends on:** AUTH-APP-01B (COMPLETE and LOCKED)
**Completed:** 2026-05-06
**Checkpoint:** `docs/AUTH-APP-01C1A-CHECKPOINT.md`

**Implemented:**
- `cookie-parser` + `@types/cookie-parser` installed; `app.use(cookieParser())` in `main.ts`
- `SessionCookieGuard` created — reads `aisandbox_session`, SHA-256 hashes, validates `auth_sessions` (not expired, not revoked), attaches `req.user`; exported from `AuthModule`
- `AuthService.createSession(userId)`, `validateSessionToken(rawToken)`, `revokeSession(rawToken)` added; `Repository<AuthSession>` injected
- `POST /auth/login` — sets HTTP-only `aisandbox_session` cookie (SameSite=Lax, Secure in production, 7-day maxAge); returns `{ user }` only — **`access_token` removed from response**
- `GET /auth/me` — guard switched from `JwtAuthGuard` to `SessionCookieGuard`
- `POST /auth/logout` — added; uses `SessionCookieGuard`, revokes session, clears cookie, returns `{ ok: true }`
- `JwtAuthGuard` replaced with `SessionCookieGuard` on 9 browser-facing controllers: `projects`, `sessions`, `conversations`, `users`, `checkpoints`, `workspaces`, `api-key`, `admin-operational`, `public-projects`
- `JwtStrategy` / `JwtAuthGuard` preserved in codebase (not deleted)
- 9 affected controller specs updated to `overrideGuard(SessionCookieGuard)`
- No frontend files changed

**Validation:**
- `npx tsc --noEmit`: PASS
- `npm test`: NOT FULLY PASSING — pre-existing blockers only (see checkpoint)
  - 64 unit suites pass; 1 fails (`ai-execution.controller.spec.ts`) — pre-existing, file not in C1A changeset
  - 10 integration/smoke suites fail — Redis not host-port-bound in this environment; pre-existing constraint
- `npm run lint`: FAIL — pre-existing ESLint config discovery issue in `services/api-gateway`

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01C1A. See `docs/AUTH-APP-01C1A-CHECKPOINT.md`.

---

#### AUTH-APP-01C1B: Frontend localStorage / Bearer Migration

**Status:** COMPLETE and LOCKED
**Completed:** 2026-05-06
**Checkpoint:** `docs/AUTH-APP-01C1B-CHECKPOINT.md`
**Source:** AUTH-APP-01C1 stage-start (scope split; frontend surface isolated here)
**Depends on:** AUTH-APP-01C1A (COMPLETE and LOCKED)

**Bounded scope:**
- Remove `localStorage.setItem('access_token', ...)` and `setItem('userId', ...)` from `login/page.tsx`
- Replace `localStorage.getItem('access_token')` / `getItem('userId')` in `app/page.tsx` with `/api/auth/me` call on init
- Remove `localStorage.removeItem('access_token')` / `removeItem('userId')` from logout in `app/page.tsx`; replace with `POST /api/auth/logout` call
- Remove `Authorization: Bearer ${token}` from all inline fetch calls in `app/page.tsx` and `keys/page.tsx`
- Remove `token: string` parameter from workspace logic helpers (`workspace-exec.logic.ts`, `workspace-checkpoint-diff.logic.ts`, `workspace-file-navigation.logic.ts`, `workspace-snapshots.logic.ts`, `workspace-workspaces.logic.ts`, `workspace-checkpoint-revert.logic.ts`, `workspace-projects.logic.ts`, `workspace-chat-persistence.logic.ts`, `workspace-checkpoint-create.logic.ts`) and `open-project-in-fresh-session.ts`; remove corresponding `Authorization` headers from each
- Update all `*.logic.test.ts` and `*.test.tsx` files that pass `token` args or assert `Authorization` header presence
- Verify zero production frontend references to `access_token` or `userId` via localStorage after changes
- No backend behavior changes beyond what AUTH-APP-01C1A already established

**Non-goals:**
- No backend auth changes (those are AUTH-APP-01C1A)
- No Google/Apple OAuth
- No email verification or password reset
- No rate limiting
- No auth UX redesign beyond removing localStorage + adding logout fetch

**Acceptance checks (all met):**
- [x] Zero `localStorage.getItem/setItem/removeItem('access_token')` in production frontend code
- [x] Zero `localStorage.getItem/setItem/removeItem('userId')` in production frontend code
- [x] Zero `Authorization: Bearer ${token}` in browser-side session-auth fetch calls
- [x] All workspace logic function signatures no longer require `token`
- [x] All affected test files updated and passing
- [x] `npx tsc --noEmit` passes in `frontend`
- [x] `npm run build` passes in `frontend`
- [x] `npm test` passes in `frontend`
- [x] No backend files changed

**Validation:**
- `npx tsc --noEmit`: PASS
- `npm test`: PASS
- `npm run build`: PASS
- ReadLints: PASS — no linter errors on touched files
- Safety grep: zero matches for `access_token` and `Bearer ${token}`
- `DRIVER_API_KEY` bearer headers preserved

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01C1B. See `docs/AUTH-APP-01C1B-CHECKPOINT.md`.

---

#### AUTH-APP-01C2: Email Verification / Password Reset / Rate Limiting

**Status:** ACTIVE — AUTH-APP-01C2A COMPLETE; AUTH-APP-01C2B COMPLETE; AUTH-APP-01C2C COMPLETE; AUTH-APP-01C2D PLANNED

**Provider decision:** Resend selected as v1 transactional email provider (decided 2026-05-08). AUTH-APP-01C2 is unblocked. EmailProvider abstraction required — auth service must not call Resend directly.

**Source:** AUTH-APP-01A spec (Sections 7 + 12); AUTH-APP-01C split confirmed at registration
**Depends on:** AUTH-APP-01C1 (COMPLETE) + Resend as chosen email provider

**Child slices (AUTH-APP-01C2 split — surface too large for one slice):**
1. AUTH-APP-01C2A — Email Verification / Password Reset Spec + Provider Abstraction Plan (COMPLETE and LOCKED)
2. AUTH-APP-01C2B — Email Provider Foundation with Resend Adapter (COMPLETE and LOCKED)
3. AUTH-APP-01C2C — Email Verification Backend Flow (COMPLETE and LOCKED — checkpoint: `docs/AUTH-APP-01C2C-CHECKPOINT.md`)
4. AUTH-APP-01C2D — Password Reset Backend Flow (PLANNED — current stage)
5. AUTH-APP-01C2E — Frontend Auth Email UX (PLANNED)
6. AUTH-APP-01C2F — Email Auth Validation + Consolidation (PLANNED)

**Bounded scope:**
- Select and configure transactional email provider; document required env vars
- Add EmailProvider abstraction; ResendEmailProvider v1 adapter; future SES/SendGrid adapters as separate tasks
- Add email verification flow: token generation → email send → verification endpoint → mark user verified
- Add password reset flow: request → email with reset token → confirm with new password → revoke active sessions
- Use `verification_tokens` table from AUTH-APP-01B (SHA-256 hashed tokens, expiry, used_at)
- Add rate limiting on auth endpoints: login, register, email-verify resend, password-reset-request
- No OAuth implementation

**Non-goals:**
- No Google or Apple OAuth
- No frontend auth redesign beyond verify/reset pages
- No billing or subscription changes

**Acceptance checks:**
- Email verification token generated and sent on register
- Verification endpoint marks user verified and marks token used
- Password reset request sends email; confirm endpoint validates token, updates password, revokes sessions
- Rate limiting applied to all auth endpoints per spec Section 7.5
- `npx tsc --noEmit` passes in `services/api-gateway`

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01C2. See `docs/AUTH-APP-01-SPEC.md` Sections 7, 12.

---

#### AUTH-APP-01C2A: Email Verification / Password Reset Spec + Provider Abstraction Plan

**Status:** COMPLETE and LOCKED
**Nature:** SPEC AND DOCUMENTATION ONLY — no production source files changed
**Parent:** AUTH-APP-01C2 (ACTIVE)
**Family:** AUTH
**Depends on:** AUTH-APP-01C2 unblocked (Resend chosen — DONE)
**Registered:** 2026-05-08
**Completed:** 2026-05-08
**Checkpoint:** `docs/AUTH-APP-01C2A-CHECKPOINT.md`
**Spec:** `docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md`

**Key decisions recorded:**
1. `EmailProvider` interface: `sendEmail({ to, subject, html, text? }): Promise<void>`
2. `EMAIL_PROVIDER` NestJS injection token; auth service depends on abstraction only
3. `ResendEmailProvider` v1; `StubEmailProvider` for tests (`EMAIL_PROVIDER=stub`)
4. `EmailModule` factory selects provider from `EMAIL_PROVIDER` env var
5. Future SES/SendGrid: adapter-only switch — no auth logic changes
6. `email_verified` column added to `users` in C2C (`DEFAULT false`); OAuth users set `true` at creation
7. `locale` column added to `verification_tokens` in C2C for post-verification redirect
8. Verification resend: unauthenticated, `{ email }` body, always `200`, 3/hr/email
9. Password reset: always `200` (anti-enumeration), 1h TTL, revokes all sessions on confirm
10. No CSRF on any of the four new public routes
11. Dual-key rate limiting for `POST /password-reset/request` via `EmailThrottlerGuard`
12. `AuthService.revokeAllUserSessions(userId)` new method in C2D

**Production source files changed: None.**

**Acceptance checks:**
- [x] EmailProvider interface defined in spec
- [x] ResendEmailProvider adapter boundary defined
- [x] Future provider switch path (SES, SendGrid) documented
- [x] Env vars defined: EMAIL_PROVIDER, RESEND_API_KEY, AUTH_EMAIL_FROM, APP_BASE_URL
- [x] DB/token requirements confirmed against AUTH-APP-01B schema
- [x] Backend route plan complete
- [x] Frontend UX plan complete
- [x] Security rules documented
- [x] Test/validation plan documented

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01C2A. See `docs/AUTH-APP-01C2A-CHECKPOINT.md`. See `docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md`.

---

#### AUTH-APP-01C2B: Email Provider Foundation with Resend Adapter

**Status:** COMPLETE and LOCKED
**Nature:** BACKEND — email provider abstraction; Resend adapter; module wiring; no auth routes, no DB migration
**Parent:** AUTH-APP-01C2 (ACTIVE)
**Family:** AUTH
**Depends on:** AUTH-APP-01C2A (COMPLETE and LOCKED)
**Registered:** 2026-05-08
**Completed:** 2026-05-08
**Checkpoint:** `docs/AUTH-APP-01C2B-CHECKPOINT.md`

**Files changed:**
- `services/api-gateway/package.json` — `resend` added to dependencies
- `services/api-gateway/.env.example` — email env var block added
- `services/api-gateway/src/email/email-provider.interface.ts` — **created** — `EmailProvider` interface + `EMAIL_PROVIDER` symbol
- `services/api-gateway/src/email/stub-email.provider.ts` — **created** — `StubEmailProvider` (no-op for local/test)
- `services/api-gateway/src/email/resend-email.provider.ts` — **created** — `ResendEmailProvider` v1 Resend adapter
- `services/api-gateway/src/email/email.module.ts` — **created** — `EmailModule` with factory provider
- `services/api-gateway/src/email/__tests__/email.module.spec.ts` — **created** — factory/env unit tests
- `services/api-gateway/src/email/__tests__/resend-email.provider.spec.ts` — **created** — SDK mock unit tests
- `services/api-gateway/src/auth/auth.module.ts` — `EmailModule` added to imports
- `services/api-gateway/src/auth/auth.service.ts` — `@Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider` added to constructor
- `services/api-gateway/src/auth/auth.service.spec.ts` — minimal `EMAIL_PROVIDER` DI mock added

**Production source files changed:** `auth.module.ts`, `auth.service.ts` (wiring only; no auth business logic changed).

**Acceptance checks:**
- [x] `resend` installed in `services/api-gateway`
- [x] `EmailProvider` interface and `EMAIL_PROVIDER` injection token defined
- [x] `StubEmailProvider` — no-op; no network; safe for all tests
- [x] `ResendEmailProvider` — validates `RESEND_API_KEY` + `AUTH_EMAIL_FROM`; uses `replyTo` camelCase; throws on SDK error
- [x] `EmailModule` factory — validates `APP_BASE_URL`; selects stub/resend; throws on unknown provider
- [x] `AuthModule` imports `EmailModule`
- [x] `AuthService` injects `EMAIL_PROVIDER`; no email-sending methods yet
- [x] `.env.example` updated with all email vars and safety comments
- [x] `npx tsc --noEmit` PASS
- [x] Email module unit tests: 2 suites, 14 tests PASS
- [x] Auth tests: 2 suites, 20 tests PASS (after minimal DI mock fix)

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01C2B. See `docs/AUTH-APP-01C2B-CHECKPOINT.md`. See `docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md`.

---

#### AUTH-APP-01D: Google OAuth

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/AUTH-APP-01D-CHECKPOINT.md`

**Source:** AUTH-APP-01A spec (Section 6 — OAuth providers); AUTH-APP-01D confirmed at AUTH family registration
**Depends on:** AUTH-APP-01C1A (COMPLETE), AUTH-APP-01B (COMPLETE)

**Bounded scope:**
- Add `passport-google-oauth20` strategy with `cookie-session` OAuth state management
- `GET /api/auth/google` — initiate OAuth flow, persist locale in state cookie
- `GET /api/auth/google/callback` — create `auth_sessions` server-side session, set `aisandbox_session` cookie, redirect to app
- `AuthService.findOrCreateGoogleUser()` — link existing user by provider account or verified email; create new user if no match
- Minimal "Continue with Google" link on login/register pages with i18n keys
- OAuth env vars documented in `services/api-gateway/docs/SMOKE-PACK-README.md` (`.env.example` write denied by tool)

**Non-goals:**
- No Apple OAuth (AUTH-APP-01E)
- No email verification or password reset (AUTH-APP-01C2)
- No frontend auth redesign beyond minimal button (AUTH-APP-01G)
- No AUTH-MODULE-01

**Validation:**
- `npx tsc --noEmit` (api-gateway): PASS
- Google auth unit tests (2 suites, 6 tests): PASS
- `npm test` (api-gateway full): FAIL — carry-forward only (REDIS_URL, ai-execution.controller.spec.ts, ESLint config)
- `npx tsc --noEmit` (frontend): PASS
- `npm test` (frontend): PASS — 253 tests
- `npm run build` (frontend): PASS

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01D. See `docs/AUTH-APP-01D-CHECKPOINT.md`.

---

#### AUTH-APP-01E: Apple OAuth

**Status:** COMPLETE and LOCKED
**Checkpoint:** `docs/AUTH-APP-01E-CHECKPOINT.md`

**Source:** AUTH-APP-01A spec (Section 9 — Apple OAuth slice); AUTH-APP-01E confirmed at AUTH family registration
**Depends on:** AUTH-APP-01C1A (COMPLETE), AUTH-APP-01D (COMPLETE), AUTH-APP-01B (COMPLETE)

**Bounded scope:**
- Add `@nicokaiser/passport-apple` strategy (`apple.strategy.ts`); private key normalized from env with `.replace(/\\n/g, '\n')`
- `GET /api/auth/apple` — initiate Apple OAuth flow; persist locale in existing `aisandbox_oauth_state` state cookie
- `POST /api/auth/apple/callback` — create `auth_sessions` server-side session, set `aisandbox_session` cookie, redirect to app (Apple callback is POST not GET)
- `AuthService.findOrCreateAppleUser()` — provider account lookup; private relay email creates new user without auto-link; real email auto-links; inactive user rejected
- `AuthModule` registers `AppleStrategy`
- Minimal "Continue with Apple" link on login/register pages with i18n keys (`login.continueWithApple`, `register.continueWithApple`) in en/zh-TW/zh-CN
- Apple OAuth env vars documented in `services/api-gateway/docs/SMOKE-PACK-README.md`

**Environment variables:**
- `APPLE_CLIENT_ID` (Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_CALLBACK_URL`
- `OAUTH_STATE_SECRET` reused from AUTH-APP-01D

**Non-goals:**
- No Google OAuth behavior changes
- No email verification or password reset (AUTH-APP-01C2)
- No frontend auth redesign beyond minimal link (AUTH-APP-01G)
- No AUTH-MODULE-01
- No migrations or entity changes

**Validation:**
- `npx tsc --noEmit` (api-gateway): PASS
- `npx jest src/auth/auth.service.spec.ts src/auth/__tests__/apple.strategy.spec.ts --runInBand`: PASS — 2 suites, 12 tests
- `npx tsc --noEmit` (frontend): PASS
- `npm test` (frontend): PASS — 253 tests
- `npm run build` (frontend): PASS
- `frontend/tsconfig.tsbuildinfo` modified by build; restored via `git restore`

**Carry-forward blockers (pre-existing, not introduced by AUTH-APP-01E):**
- `npm test` backend full suite: fails — `REDIS_URL` not set in test environment; `ai-execution.controller.spec.ts` pre-existing failures
- `npm run lint` backend: ESLint config not discoverable in `services/api-gateway`

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01E. See `docs/AUTH-APP-01E-CHECKPOINT.md`.

---

#### AUTH-APP-01F1: Route/API Protection Inventory + Spec

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / SPEC ONLY — no production code changes
**Parent:** AUTH-APP-01F (VALIDATION COMPLETE — carry-forwards pending)
**Family:** AUTH
**Depends on:** AUTH-APP-01E (COMPLETE and LOCKED)
**Completed:** 2026-05-07
**Checkpoint:** `docs/AUTH-APP-01F1-CHECKPOINT.md`
**Spec:** `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md`

**Implemented:**
- Inspected all 30 backend controllers across `services/api-gateway/src/`
- Inspected all frontend routes under `frontend/app/`
- Confirmed `JwtAuthGuard` removed from all active controllers (zero remaining usages)
- Documented full guard coverage: `SessionCookieGuard` (10 controllers/surfaces), `ApiKeyAuthGuard` (5 controllers), `InternalServiceAuthGuard` (7 internal controllers), intentionally public (9 endpoints)
- Identified 8 protection gaps/decisions for F2 (AI execution cancel/get, service-to-service endpoints, runtime metrics, preview proxy, dead file cleanup)
- Identified 2 frontend protection gaps for F3 (`/keys`, `/account` — no login redirect on 401)
- Confirmed no `middleware.ts` exists — all frontend auth is reactive/client-side
- Locked 11 behavior decisions and 6 governing invariants
- Defined F2/F3/F4 implementation boundaries

**Non-goals confirmed:**
- No route guard implementation (AUTH-APP-01F2)
- No frontend middleware/redirect implementation (AUTH-APP-01F3)
- No OAuth or email/password changes
- No AUTH-MODULE-01
- No workspace UX changes
- No Visual Edit Mode

**Carry-forward blockers (pre-existing, not introduced by F1):**
- `npm test` backend full suite: fails — `REDIS_URL` not set in test environment; `ai-execution.controller.spec.ts` pre-existing failures
- `npm run lint` backend: ESLint config not discoverable in `services/api-gateway`

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01F1. See `docs/AUTH-APP-01F1-CHECKPOINT.md`. See `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md`.

---

#### AUTH-APP-01F2: Backend API Protection Gaps

**Status:** COMPLETE and LOCKED
**Parent:** AUTH-APP-01F (VALIDATION COMPLETE — carry-forwards pending)
**Family:** AUTH
**Depends on:** AUTH-APP-01F1 (COMPLETE and LOCKED)
**Completed:** 2026-05-07
**Checkpoint:** `docs/AUTH-APP-01F2-CHECKPOINT.md`
**Spec:** `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md` (Sections 4.5, 6, 10)

**Implemented:**
- Added method-level `@UseGuards(ApiKeyAuthGuard)` to `POST /api/ai/executions/:executionId/cancel`, `GET /api/ai/executions/:executionId`, and `GET /api/ai/executions/:executionId/stream`
- `POST /api/ai/execute` guard stack left unchanged
- Added class-level `@UseGuards(InternalServiceAuthGuard)` to `ChatMessageController` (`POST /api/chat-messages/add-by-session`) — Option B; ai-service caller already sends `X-Internal-Service-Key`
- Added class-level `@UseGuards(InternalServiceAuthGuard)` to `TokenUsageController` (`POST /api/token-usage/record`) — Option B; ai-service caller already sends `X-Internal-Service-Key`
- Added class-level `@UseGuards(InternalServiceAuthGuard)` to `RuntimeController` (`GET /api/runtime/metrics`)
- Deleted `services/api-gateway/src/auth/api-key.controllerXXXXX.ts` (stale dead file; not imported anywhere active)
- Deleted `services/api-gateway/src/auth/jwt-auth.guard.ts` (only reference was the dead controller; comment-only in `session-quota.guard.ts`)
- Added targeted guard metadata tests for all newly guarded endpoints
- Recorded accepted exceptions for events endpoints (Option C carry-forward) and preview proxy (deferred)

**Non-goals confirmed:**
- No frontend files changed
- No events endpoint guard added (container-manager callers do not send `X-Internal-Service-Key`)
- No preview proxy guard added (cross-service ownership validation deferred)
- No OAuth or email/password changes
- No route path migrations
- No new npm dependencies

**Carry-forward blockers (pre-existing, not introduced by F2):**
- `npm test` backend full suite: fails — `REDIS_URL` not set; `ai-execution.controller.spec.ts` pre-existing failures
- `ai-execution-guards.integration.spec.ts` full suite: `QuotaService` unresolved dependencies (pre-existing)
- `npm run lint` backend: ESLint config not discoverable in `services/api-gateway`

**Carry-forward items (not resolved in F2):**
- Events endpoints (`file-changed`, `checkpoint-created`, `token-updated`) still unguarded — requires container-manager callers to send `X-Internal-Service-Key` before guard can be added (AUTH-APP-01F2a or AUTH-APP-01H)
- Preview proxy (`@All /api/preview/*`) still unguarded — requires coordinated api-gateway + container-manager auth-forwarding investigation

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01F2. See `docs/AUTH-APP-01F2-CHECKPOINT.md`. See `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md`.

---

#### AUTH-APP-01F3: Frontend Protected Route Behavior

**Status:** COMPLETE and LOCKED
**Parent:** AUTH-APP-01F (VALIDATION COMPLETE — carry-forwards pending)
**Family:** AUTH
**Depends on:** AUTH-APP-01F2 (COMPLETE and LOCKED)
**Completed:** 2026-05-07
**Checkpoint:** `docs/AUTH-APP-01F3-CHECKPOINT.md`
**Spec:** `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md` (Sections 3.2, 7)

**Implemented:**
- Added `authLoading` state to `ApiKeysPage` (`frontend/app/[locale]/keys/page.tsx`)
- Replaced mount-only `loadKeys()` effect with `GET /api/auth/me` bootstrap
- Redirects to `/${locale}/login` when `/api/auth/me` is non-OK or returns no valid `id`
- On valid auth: clears `authLoading` and calls existing `loadKeys()`
- Added early loading gate before key-management render
- Preserved all existing `loadKeys()`, `handleCreateKey()`, `handleRevokeKey()`, `ErrorRemediation` handling, and authenticated UI behavior
- `/[locale]/account` inherits the redirect fix automatically (delegates to `/keys` or renders same `ApiKeysPage` component)
- Added focused auth bootstrap tests in `frontend/app/[locale]/keys/page.test.tsx`

**Non-goals confirmed:**
- No backend files changed
- No `middleware.ts` created
- No `/driver` changes (intentionally separate `DRIVER_API_KEY` flow)
- No `/test` changes (dev artifact, out of scope)
- No `/account` changes (inherits fix automatically)
- No `/projects` changes
- No i18n message key additions
- No OAuth or email/password changes
- No new npm dependencies

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01F3. See `docs/AUTH-APP-01F3-CHECKPOINT.md`. See `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md`.

---

#### AUTH-APP-01F4: Protection Validation + Consolidation

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION AND CONSOLIDATION ONLY — no production source files changed
**Parent:** AUTH-APP-01F (VALIDATION COMPLETE — carry-forwards pending)
**Family:** AUTH
**Depends on:** AUTH-APP-01F3 (COMPLETE and LOCKED)
**Completed:** 2026-05-07
**Checkpoint:** `docs/AUTH-APP-01F4-CHECKPOINT.md`
**Family checkpoint:** `docs/AUTH-APP-01F-CHECKPOINT.md`
**Spec:** `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md` (Section 8)

**Validation results:**
- Backend targeted tests (6 guard metadata tests): PASS
  - `AIExecutionController guard metadata`: 3/3 (cancel, get, stream — ApiKeyAuthGuard)
  - `ChatMessageController guard metadata`: 1/1 (InternalServiceAuthGuard)
  - `TokenUsageController guard metadata`: 1/1 (InternalServiceAuthGuard)
  - `RuntimeController guard metadata`: 1/1 (InternalServiceAuthGuard)
- Frontend build: PASS (Next.js 15.5.12 — compiled in 2.3s)
- Frontend `npx tsc --noEmit`: PASS
- Frontend `npm test`: PASS — 253 tests, 22 suites, 0 failures
- Frontend `/keys` direct auth bootstrap test: PASS — 3/3 tests
- Manual smoke checklist: NOT RUN (no live environment) — carried to AUTH-APP-01H

**Carry-forward items:**
- Events endpoints (`file-changed`, `checkpoint-created`, `token-updated`) still unguarded — container-manager callers don't send `X-Internal-Service-Key` → AUTH-APP-01F2a or AUTH-APP-01H
- Preview proxy (`@All /api/preview/*`) still unguarded — cross-service coordination needed → dedicated investigation slice
- Manual smoke checklist (22 items) — not run → AUTH-APP-01H
- Backend full `npm test` Redis env blocker — pre-existing since AUTH-APP-01B → carry-forward
- `ai-execution-guards` full suite `QuotaService` blocker — pre-existing → carry-forward
- `npm run lint` ESLint config blocker — pre-existing since AUTH-APP-01B → carry-forward

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01F4. See `docs/AUTH-APP-01F4-CHECKPOINT.md`. See `docs/AUTH-APP-01F-CHECKPOINT.md`.

---

#### AUTH-APP-01G1: Auth UX Inventory + Scope

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / SPEC ONLY — no production source files changed
**Parent:** AUTH-APP-01G (ACTIVE)
**Family:** AUTH
**Depends on:** AUTH-APP-01F4 (COMPLETE and LOCKED)
**Completed:** 2026-05-07
**Checkpoint:** `docs/AUTH-APP-01G1-CHECKPOINT.md`
**Spec:** `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md`

**Objective:**
Produce an inventory and implementation scope for auth UX integration now that password login, Google OAuth, Apple OAuth, cookie sessions, and protected routes are all in place. Decide the precise boundaries for AUTH-APP-01G2 and AUTH-APP-01G3 before any UX code is written.

**Key findings:**
- OAuth error query param gap: backend emits `?error=oauth_failed` / `?error=account_conflict` but login page does not consume them; `errors.oauthFailed` and `errors.accountConflict` i18n keys exist unused
- `errors.oauthFailed` is Google-specific; Apple also uses `oauth_failed` — must be made provider-agnostic in G2
- Logout complete absence: no frontend component calls `POST /api/auth/logout`; backend endpoint is fully implemented
- `/account` redirects to `/keys` (flag=false) or renders `ApiKeysPage` (flag=true); no profile/auth section
- Keys page uses zero UX-IA-02 tokens — deferred
- Login/register pages are token-consistent; OAuth buttons are generic (no brand visual)

**Validation:**
- No production source files changed — confirmed by `git status`
- No frontend or backend behavior changed
- No tests run — docs-only

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01G1. See `docs/AUTH-APP-01G1-CHECKPOINT.md`. See `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md`.

---

#### AUTH-APP-01G2: Login/Register OAuth Error + Button Polish

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND UI ONLY — no backend files changed
**Parent:** AUTH-APP-01G (ACTIVE)
**Family:** AUTH
**Depends on:** AUTH-APP-01G1 (COMPLETE and LOCKED)
**Completed:** 2026-05-07
**Checkpoint:** `docs/AUTH-APP-01G2-CHECKPOINT.md`

**Implemented:**
- `OAuthErrorBanner` sub-component added to `login/page.tsx` — reads `?error` via `useSearchParams()`; renders `errors.accountConflict` for `account_conflict`, `errors.oauthFailed` for all other codes; wrapped in `<Suspense fallback={null}>`; placed above existing form error block
- `errors.oauthFailed` updated to provider-agnostic wording in en, zh-TW, zh-CN
- OAuth button polish applied to all four `<a>` links (login Google/Apple, register Google/Apple): `transition-colors` → `transition`; added `active:scale-[0.97]`; added `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`
- Register success stay-on-page behavior preserved — no auto-redirect added
- New test file: `frontend/app/[locale]/login/page.test.tsx` — 3 tests for `OAuthErrorBanner`

**Validation:**
- `npm run build`: PASS
- `npx tsc --noEmit`: PASS
- `npm test`: PASS — 253 tests, 22 suites, 0 failures
- Login page test (direct): PASS — 3 tests, 0 failures
- `frontend/tsconfig.tsbuildinfo` modified by build; restored via `git restore`

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01G2. See `docs/AUTH-APP-01G2-CHECKPOINT.md`. See `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` Sections 5 and 10.

---

#### AUTH-APP-01G3: Logout + Basic Account Surface

**Status:** COMPLETE and LOCKED
**Nature:** FRONTEND ONLY — no backend files changed
**Parent:** AUTH-APP-01G (ACTIVE)
**Family:** AUTH
**Depends on:** AUTH-APP-01G2 (COMPLETE and LOCKED)
**Checkpoint:** `docs/AUTH-APP-01G3-CHECKPOINT.md`

**Objective:**
Add logout button/caller wired to `POST /api/auth/logout`, redirect to `/${locale}/login` on success, and add minimal account/auth surface if safely achievable.

**Files changed:**
- `frontend/app/[locale]/app/page.tsx` — added `handleLogout()`; passed `onLogout` to `WorkspaceShell`
- `frontend/components/workspace/workspace-shell.tsx` — added `onLogout?: () => void` prop; logout button in header for both UX flag paths
- `frontend/app/[locale]/account/page.tsx` — added `<LogoutButton />` above `<ApiKeysPage />` for `PROJECT_FIRST_UX=true`
- `frontend/components/auth/logout-button.tsx` — new: `'use client'` component; `GET /api/auth/me` on mount; email display; logout + redirect
- `frontend/components/workspace/workspace-shell.test.tsx` — 3 logout button tests added

**Validation:**
- `npm run build`: PASS
- `npx tsc --noEmit`: PASS
- `npm test`: PASS — 256 tests, 22 suites, 0 failures
- `frontend/tsconfig.tsbuildinfo` modified by build; restored via `git restore`

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01G3. See `docs/AUTH-APP-01G3-CHECKPOINT.md`. See `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` Sections 6 and 11.

---

#### AUTH-APP-01G4: Auth UX Validation + Checkpoint

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION AND DOCUMENTATION ONLY — no production source files changed
**Parent:** AUTH-APP-01G (VALIDATION COMPLETE — manual smoke deferred)
**Family:** AUTH
**Depends on:** AUTH-APP-01G3 (COMPLETE and LOCKED)
**Checkpoint:** `docs/AUTH-APP-01G4-CHECKPOINT.md`
**Family checkpoint:** `docs/AUTH-APP-01G-CHECKPOINT.md`

**Objective:**
Run full automated validation suite, record manual smoke as deferred, and create G4 task checkpoint plus AUTH-APP-01G family checkpoint.

**Automated validation results:**
- `npm run build`: PASS — Next.js 15.5.12, compiled in 2.6s
- `npx tsc --noEmit`: PASS
- `npm test`: PASS — 256 tests, 22 suites, 0 failures
- Login page direct test: PASS — 3 tests, 0 failures
- Keys page direct test: PASS — 3 tests, 0 failures
- `frontend/tsconfig.tsbuildinfo` modified by build; restored via `git restore`

**Manual smoke checklist:** NOT RUN — deferred to user live environment (no live frontend/backend/browser available in automated session; dev servers user-controlled).

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01G4. See `docs/AUTH-APP-01G4-CHECKPOINT.md`. See `docs/AUTH-APP-01G-CHECKPOINT.md`. See `docs/AUTH-APP-01G-AUTH-UX-SCOPE.md` Section 12.

---

#### AUTH-APP-01H: Security Hardening + Validation Checklist (Phase Parent)

**Status:** VALIDATION COMPLETE — manual smoke deferred
**Parent:** AUTH-APP-01
**Family:** AUTH
**Depends on:** AUTH-APP-01G4 (COMPLETE and LOCKED)
**Registered:** 2026-05-07
**Checkpoint:** `docs/AUTH-APP-01H-CHECKPOINT.md`

**Objective:**
Deliver all remaining AUTH-APP-01 security hardening and validation work before AUTH-APP-01Z final consolidation. Covers CSRF protection, rate limiting on auth endpoints, redirect allowlist hardening, OAuth state parameter audit, events endpoint carry-forward resolution, preview proxy scope decision, test/tooling blocker triage, secrets env audit, and full manual smoke verification.

**Confirmed child slices:**
1. AUTH-APP-01H1 — Security Hardening Inventory (COMPLETE and LOCKED)
2. AUTH-APP-01H2 — CSRF + Rate Limiting + Redirect Hardening (COMPLETE and LOCKED)
3. AUTH-APP-01H3 — Events Endpoint Guards + Test/Tooling Triage (COMPLETE and LOCKED)
4. AUTH-APP-01H4 — Manual Smoke + Secrets Audit + Final AUTH-APP-01H Consolidation (COMPLETE and LOCKED)

**AUTH-APP-01C2 remains BLOCKED:** Transactional email provider not yet chosen. AUTH-APP-01H does not unblock AUTH-APP-01C2.

**Carry-forwards:**
- Preview proxy `/api/preview/*` — MEDIUM risk; dedicated future investigation slice required
- api-gateway lint baseline — 353 pre-existing errors; separate future slice
- 40 manual smoke items (22 F-family + 12 G-family + 6 H-specific) — deferred to user live environment

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01H. See `docs/AUTH-APP-01H-CHECKPOINT.md`. See `docs/AUTH-APP-01-SPEC.md`. See `docs/AUTH-APP-01F-CHECKPOINT.md` (carry-forwards). See `docs/AUTH-APP-01G-CHECKPOINT.md` (carry-forwards).

---

#### AUTH-APP-01H1: Security Hardening Inventory

**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / SPEC ONLY — no production source files changed
**Parent:** AUTH-APP-01H (ACTIVE)
**Family:** AUTH
**Depends on:** AUTH-APP-01G4 (COMPLETE and LOCKED)
**Completed:** 2026-05-07
**Checkpoint:** `docs/AUTH-APP-01H1-CHECKPOINT.md`
**Spec:** `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md`

**Key findings:**
- CSRF protection: MISSING — no synchronizer token or middleware; `SameSite=Lax` partial mitigation only
- Auth endpoint rate limiting: MISSING — `@nestjs/throttler` not installed, no decorators/guards
- OAuth state parameter: PARTIAL — `state: true` functional; `OAUTH_STATE_SECRET`/`SESSION_SECRET` undocumented
- Redirect allowlist: NO OPEN REDIRECT — no formal allowlist constant
- Secrets/env documentation: SIGNIFICANT GAP — all OAuth + session vars missing from `api-gateway/.env.example`
- Events endpoints: UNGUARDED — 3 endpoints; 2 callers use raw `HttpService`, no auth header
- Preview proxy: UNGUARDED — formally deferred; product decision required
- Backend full `npm test`: ENVIRONMENT BLOCKER (Redis absent) — targeted-test workaround
- `ai-execution-guards` QuotaService: TEST BLOCKER — missing mock provider
- ESLint config: TOOLING BLOCKER — no `.eslintrc.*` in `services/api-gateway`

**H2/H3/H4 boundaries defined in spec:**
- H2: CSRF + rate limiting (login/register) + redirect allowlist + env docs — **pending `@nestjs/throttler` user approval**
- H3: events guards + container-manager caller updates + ESLint config + QuotaService mock + preview deferral
- H4: secrets grep audit + manual smoke (34 items) + family checkpoint

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01H1. See `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md`. See `docs/AUTH-APP-01H1-CHECKPOINT.md`.

---

#### AUTH-APP-01H2: CSRF + Rate Limiting + Redirect Hardening

**Status:** COMPLETE and LOCKED
**Nature:** BACKEND + FRONTEND IMPLEMENTATION
**Parent:** AUTH-APP-01H (ACTIVE)
**Family:** AUTH
**Depends on:** AUTH-APP-01H1 (COMPLETE and LOCKED)
**Completed:** 2026-05-07
**Checkpoint:** `docs/AUTH-APP-01H2-CHECKPOINT.md`
**Spec:** `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md`

**Dependency added:** `@nestjs/throttler@^6.5.0` (in-memory only; explicitly approved)

**Key changes:**
- CSRF double-submit cookie middleware (`aisandbox_csrf`, non-HttpOnly) added to `main.ts`
- `CsrfGuard` created; applied to `POST /auth/logout` only — Apple callback, login, register explicitly excluded
- Frontend logout callers (`page.tsx`, `logout-button.tsx`) send `X-CSRF-Token` from cookie when present
- `ThrottlerModule` registered in `app.module.ts` (in-memory); per-route throttling: login 10/60s/IP, register 5/60s/IP
- `ALLOWED_POST_OAUTH_REDIRECTS` allowlist added to `auth.controller.ts`; all OAuth redirects validated through it
- `api-gateway/.env.example` updated with placeholders for all missing auth/session/OAuth vars

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01H2. See `docs/AUTH-APP-01H2-CHECKPOINT.md`. See `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md`.

#### AUTH-APP-01H3: Events Endpoint Guards + Test/Tooling Triage

**Status:** COMPLETE and LOCKED
**Nature:** BACKEND IMPLEMENTATION + TEST/TOOLING FIXES
**Parent:** AUTH-APP-01H (ACTIVE)
**Family:** AUTH
**Depends on:** AUTH-APP-01H2 (COMPLETE and LOCKED)
**Completed:** 2026-05-07
**Checkpoint:** `docs/AUTH-APP-01H3-CHECKPOINT.md`
**Spec:** `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md`

**Key changes:**
- `InternalServiceAuthGuard` path check extended to protect `/api/events/*` in addition to `/api/internal/*`; global `APP_GUARD` registration unchanged
- All three events endpoints (`file-changed`, `checkpoint-created`, `token-updated`) now require `X-Internal-Service-Key`
- `ApiGatewayHttpClient` (container-manager) gained `notifyFileChanged()` and `notifyCheckpointCreated()` methods sending `X-Internal-Service-Key`
- `GitService.emitCheckpointCreated()` replaced raw `httpService.post()` with `apiGatewayClient.notifyCheckpointCreated()`
- `FilesModule` imports `ClientsModule`; `FilesService` injects `ApiGatewayHttpClient`; `FilesService.emitFileChange()` replaced raw `httpService.post()` with `apiGatewayClient.notifyFileChanged()`
- Created `services/api-gateway/.eslintrc.js` (ESLint 8 legacy config) — `npm run lint` now runs; repo-wide baseline of 353 pre-existing errors documented
- `ai-execution-guards.integration.spec.ts`: real `QuotaService` replaced with `useValue` mock; kill-switch tests corrected to use `process.env.AI_PROVIDER`; local lint violations cleaned
- New `events.controller.guard.spec.ts` — 4 guard unit tests (PASS 4/4)
- Preview proxy formally deferred — no implementation

**Carry-forwards to H4:**
- Preview proxy `/api/preview/*` — deferred (product decision + cross-service auth design required)
- api-gateway lint baseline — 353 pre-existing errors across unrelated files; separate future slice

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01H3. See `docs/AUTH-APP-01H3-CHECKPOINT.md`. See `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md`.

---

#### AUTH-APP-01H4: Manual Smoke + Secrets Audit + Final AUTH-APP-01H Consolidation

**Status:** COMPLETE and LOCKED
**Nature:** VALIDATION AND GOVERNANCE ONLY — no production source files changed
**Parent:** AUTH-APP-01H (VALIDATION COMPLETE — manual smoke deferred)
**Family:** AUTH
**Depends on:** AUTH-APP-01H3 (COMPLETE and LOCKED)
**Completed:** 2026-05-08
**Checkpoint:** `docs/AUTH-APP-01H4-CHECKPOINT.md`
**Family checkpoint:** `docs/AUTH-APP-01H-CHECKPOINT.md`
**Spec:** `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md`

**Key findings and actions:**
- Secrets audit initially found real Anthropic and XAI API keys in tracked `.envxxx` and `.env.prod` files — H4 paused immediately
- Local history cleanup performed (user action): both files removed from git tracking; `git ls-files` returns clean; working tree clean
- Post-cleanup secrets audit: CLEAN — no real credentials in any tracked source file; all `sk-ant-` and PEM header hits are placeholders/tests/docs
- Old provider keys (Anthropic, XAI) must be rotated before any future push/deployment — treat as compromised
- api-gateway typecheck: PASS; container-manager typecheck: PASS
- Targeted tests: 40/40 PASS (csrf.guard: 5, events.controller.guard: 4, ai-execution-guards: 31, files.service: 2)
- Manual smoke: 40 items NOT RUN — deferred to user live environment (22 F-family + 12 G-family + 6 H-specific)
- CSRF smoke item correction recorded: `CsrfGuard` applies to `POST /auth/logout` only; login/register are correctly excluded

**Carry-forwards:**
- Preview proxy `/api/preview/*` — MEDIUM risk; dedicated future investigation slice
- api-gateway lint baseline — 353 pre-existing errors; separate future slice
- 40 manual smoke items deferred to user live environment
- Provider key rotation — user action required before any push

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01H4. See `docs/AUTH-APP-01H4-CHECKPOINT.md`. See `docs/AUTH-APP-01H-CHECKPOINT.md`. See `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md`.

---

#### AUTH-APP-01Z: Final AUTH-APP-01 Consolidation

**Status:** COMPLETE and LOCKED
**Nature:** GOVERNANCE AND DOCUMENTATION ONLY — no production source files changed
**Parent:** AUTH-APP-01 (VALIDATION COMPLETE — AUTH-APP-01C2 BLOCKED; manual smoke deferred)
**Family:** AUTH
**Depends on:** AUTH-APP-01H4 (COMPLETE and LOCKED)
**Completed:** 2026-05-08
**Checkpoint:** `docs/AUTH-APP-01Z-CHECKPOINT.md`
**Family checkpoint:** `docs/AUTH-APP-01-CHECKPOINT.md`
**Spec:** `docs/AUTH-APP-01-SPEC.md` (Section 14 — slice order)

**What AUTH-APP-01Z delivered:**
- `docs/AUTH-APP-01Z-CHECKPOINT.md` — Z task checkpoint
- `docs/AUTH-APP-01-CHECKPOINT.md` — AUTH-APP-01 family summary
- `TASKS.md` and `TASKS_BACKLOG_FULL.md` updated: AUTH-APP-01Z COMPLETE and LOCKED; AUTH-APP-01 parent VALIDATION COMPLETE; stale child list entries corrected

**AUTH-APP-01 parent status:** VALIDATION COMPLETE — AUTH-APP-01C2 ACTIVE (AUTH-APP-01C2A COMPLETE; AUTH-APP-01C2B COMPLETE; AUTH-APP-01C2C COMPLETE; AUTH-APP-01C2D PLANNED); manual smoke deferred; carry-forwards pending

**Carry-forwards recorded:**
- AUTH-APP-01C2 ACTIVE — AUTH-APP-01C2A COMPLETE and LOCKED; AUTH-APP-01C2B COMPLETE and LOCKED; AUTH-APP-01C2C COMPLETE and LOCKED; AUTH-APP-01C2D PLANNED (current stage)
- 40 manual smoke items deferred to user live environment
- Preview proxy `/api/preview/*` — MEDIUM risk; dedicated investigation slice required
- api-gateway lint baseline — 353 pre-existing errors; separate cleanup slice
- Old Anthropic/XAI provider keys must be rotated before any push/deployment

**Next recommended work (independent paths):**
1. Implement AUTH-APP-01C2D — Password Reset Backend Flow
2. Run 40-item manual smoke checklist in live environment
3. Rotate old Anthropic/XAI keys before any push/deploy
4. Approve preview proxy investigation slice
5. Address api-gateway lint baseline

**Reference:** See `TASKS_BACKLOG_FULL.md` -> AUTH-APP-01Z. See `docs/AUTH-APP-01Z-CHECKPOINT.md`. See `docs/AUTH-APP-01-CHECKPOINT.md`. See `docs/AUTH-APP-01-SPEC.md`.

