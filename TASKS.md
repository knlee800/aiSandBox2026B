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


\# TASKS.md — Master Task Index



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

&nbsp; → `TASKS/session\_management.md`



\- Chat System  

&nbsp; → `TASKS/chat\_system.md`



\- Container Manager  

&nbsp; → `TASKS/container\_manager.md`



\- AI Execution  

&nbsp; → `TASKS/ai\_execution.md`



---



\### Infrastructure



\- Git \& Checkpoints  

&nbsp; → `TASKS/git\_checkpoint.md`



\- Preview System  

&nbsp; → `TASKS/preview\_system.md`



\- Import \& Export  

&nbsp; → `TASKS/import\_export.md`



\- Deployment  

&nbsp; → `TASKS/deployment.md`



---



\### Business Layer



\- Billing  

&nbsp; → `TASKS/billing.md`



\- Quota \& Usage  

&nbsp; → `TASKS/quota.md`



\- Accounts  

&nbsp; → `TASKS/accounts.md`



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



\#### TASK-40B-3R: Runtime Hardening — Concurrency & Stress Verification

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
- ❌ No database schema changes or migrations
- ❌ No architectural refactors
- ❌ No performance optimization (unless fixing correctness bugs)

**Reference:** See `TASKS_BACKLOG_FULL.md` → TASK-40B-3R for full details

---
