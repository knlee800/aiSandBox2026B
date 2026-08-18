# GOV-OS-01-STAGE-START.md

## GOV-OS-01 Step 2 — Stage-Start / OS v1 Freeze

**Task ID:** GOV-OS-01
**Title:** Development Operating System / Parallel Control Plane v1
**Step:** 2 — Stage-Start / OS v1 Freeze
**Step status:** COMPLETE — 2026-08-18
**Nature:** GOVERNANCE / CONTROL-PLANE ONLY
**Risk:** HIGH
**Lifecycle:** 4-step (Registration → Stage-Start / OS v1 Freeze → Governance Implementation → Consolidation / Checkpoint)
**Predecessor:** PRIVATE-BETA-BLOCKER-03J COMPLETE AND LOCKED — PASS — 2026-08-18 — Checkpoint: `docs/PRIVATE-BETA-BLOCKER-03J-CHECKPOINT.md`
**This document:** Frozen implementation contract for GOV-OS-01 Step 3
**Exact next step after this freeze:** GOV-OS-01 Step 3 — Governance Implementation

---

## 0. Step 2 statement

This document freezes Development Operating System / Parallel Control Plane **v1**.

Step 3 must be mechanical execution of the decisions frozen here.

No material architecture decision is deferred to Step 3.

This step:

- created this freeze artifact
- updated GOV-OS-01 lifecycle status in `TASKS.md` and `TASKS_BACKLOG_FULL.md` under the pre-cutover mirroring model
- did not implement the operating system
- did not modify application source, tests, migrations, schema, env, runtime, deployment, `PRD.md`, or `ARCHITECTURE.md`
- did not register any successor task

---

## 1. Authority model — FROZEN

Authority is domain-based. There is no simple global “file A always outranks every other file” hierarchy.

### 1.1 Domain map

| Artifact | Domain | Authority |
|---|---|---|
| `C:\Users\knlee\aiSandBox2026B\PRD.md` | PRODUCT WHAT | Current product requirements; current / gated / planned distinctions; user-facing product semantics |
| `C:\Users\knlee\aiSandBox2026B\ARCHITECTURE.md` | TECHNICAL HOW | System architecture; service boundaries; APIs; data/transport/execution architecture; technical invariants |
| `C:\Users\knlee\aiSandBox2026B\CLAUDE.md` | DEVELOPMENT OS / RULES | Workflow; task lifecycle; lane/admission rules; mutexes; model routing; Git/operator rules; validation/process rules; UX implementation conventions |
| `C:\Users\knlee\aiSandBox2026B\AGENTS.md` | THIN BOOTSTRAP | Tells Cursor/agents where to obtain authoritative operating context. Must not duplicate the `CLAUDE.md` manual |
| `C:\Users\knlee\aiSandBox2026B\TASKS.md` CURRENT EXECUTION BOARD | ONLY CURRENT SCHEDULER | Admitted lanes, mutex ownership, current gates/blockers, governance owner. Not the task-body registry |
| `C:\Users\knlee\aiSandBox2026B\TASKS_BACKLOG_FULL.md` | CANONICAL TASK REGISTRY | ID, scope, AC, dependencies, history, checkpoint references, LOCKED state |
| Locked checkpoint / stage-start documents under `C:\Users\knlee\aiSandBox2026B\docs\` | EVIDENCE | Named evidence for a specific task/step. Not a scheduler |
| `C:\Users\knlee\aiSandBox2026B\docs\AINOW-EXECUTION-ROADMAP.md` | HISTORICAL / STRATEGIC REFERENCE | Not scheduler. Not current task authority |
| `C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` | HISTORICAL / STRATEGIC VISION | Not current product authority. Not current technical architecture. Not scheduler |

### 1.2 Conflict-resolution rule — FROZEN

- `CLAUDE.md` defines scheduling / admission **RULES**.
- The `TASKS.md` board **applies** those rules to specific tasks.
- `CLAUDE.md` cannot itself admit or schedule a task.
- The `TASKS.md` board cannot violate `CLAUDE.md` admission / mutex / lifecycle rules.
- `PRD.md` remains authoritative only in the PRODUCT WHAT domain.
- `ARCHITECTURE.md` remains authoritative only in the TECHNICAL HOW domain.
- No global rank may override these domain boundaries.

### 1.3 Current conflicts Step 3 must correct

These current statements conflict with the frozen domain model and must be replaced or demoted by Step 3:

- `AGENTS.md` numbered global instruction-priority list (`PRD.md` → `ARCHITECTURE.md` → `CLAUDE.md` → `TASKS.md`).
- `TASKS.md` current line: “If conflicts exist, TASKS_BACKLOG_FULL.md takes precedence.” After cutover this line is historical only (it will sit below the LEGACY / FROZEN boundary). Do not rely on it. Do not rewrite it.
- `CLAUDE.md` “Project Governance Loop” (`PRD → ARCHITECTURE → TASKS_BACKLOG_FULL → TASKS → CHECKPOINTS → CODE`) may remain as a **product-work sequencing loop**. Step 3 must state explicitly that this loop is not a scheduler and not a global file-rank that overrides domain authority.
- `docs/AINOW-EXECUTION-ROADMAP.md` header currently claims it “controls execution order.”
- `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` header currently claims “ACTIVE planning output” / authoritative planning foundation.

### 1.4 Post-cutover status mirroring — FROZEN

After the OS is installed:

- Scheduler state lives on the `TASKS.md` board.
- Canonical task body / history / AC / LOCKED state lives in `TASKS_BACKLOG_FULL.md`.
- Control-plane steps mirror **end status** into both:
  1. the `TASKS.md` board fields, and
  2. the canonical task body in `TASKS_BACKLOG_FULL.md`.
- Full task bodies are not the scheduler.
- The Program Status mega-paragraph is historical evidence only. Stop appending current-state information to it permanently after cutover.
- Existing historical bodies in `TASKS.md` below the LEGACY / FROZEN boundary are not a second registry. Exception: GOV-OS-01 may still update its own already-present `TASKS.md` body lifecycle fields because that body already exists.

---

## 2. TASKS.md board — FROZEN DESIGN

The new board MUST be at the **absolute top** of:

`C:\Users\knlee\aiSandBox2026B\TASKS.md`

It must be short and designed for deterministic fresh-window recovery.

### 2.1 Required board fields

- Parallel Development Architecture version: **v1**
- Maximum admitted implementation lanes: **2**
- Lane 3: **DISABLED**
- Active lane count
- Lane 1: task ID, workstream, state, lifecycle, primary write scope, mutexes/resources
- Lane 2: same fields
- Governance owner / state
- Active mutex / resource ownership
- Frozen contracts, if any
- Current blockers / gates
- Current next product gate
- Explicit statement: fresh post-03J E2E **REQUIRED BUT UNREGISTERED / NOT ADMITTED**
- `PRIVATE-BETA-INVITE-01`: **UNREGISTERED / PROHIBITED**
- Pointer to `TASKS_BACKLOG_FULL.md` for task bodies

### 2.2 Exact board skeleton Step 3 must insert

Use this skeleton, filling dates/states only as required by the GOV-OS-01 lifecycle at the moment of insertion.

```markdown
# TASKS.md — CURRENT EXECUTION BOARD

**Parallel Development Architecture:** v1
**Maximum admitted implementation lanes:** 2
**Lane 3:** DISABLED
**Active implementation lanes:** 0 / 2

Task bodies, AC, dependencies, history, and LOCKED state live in:
`C:\Users\knlee\aiSandBox2026B\TASKS_BACKLOG_FULL.md`

This board is the only current scheduler.
Do not determine current work from content below the LEGACY / FROZEN boundary.

## Lane 1
- Task ID: EMPTY
- Workstream: —
- State: EMPTY
- Lifecycle: —
- Primary write scope: —
- Mutexes/resources: —

## Lane 2
- Task ID: EMPTY
- Workstream: —
- State: EMPTY
- Lifecycle: —
- Primary write scope: —
- Mutexes/resources: —

## Lane 3
DISABLED

## Governance owner / state
- Owner task: GOV-OS-01
- State: ACTIVE — <Step 3 or Step 4 status as applicable>
- Lifecycle: 4-step
- Primary write scope: governance/control-plane files listed in GOV-OS-01
- Mutexes/resources: GOVERNANCE

## Active mutex / resource ownership
- GOVERNANCE: GOV-OS-01
- All other v1 resources: UNOWNED

## Frozen contracts
- none

## Current blockers / gates
- Fresh post-03J E2E: REQUIRED BUT UNREGISTERED / NOT ADMITTED
- PRIVATE-BETA-INVITE-01: UNREGISTERED / PROHIBITED
- BUILDER_PRIVATE_BETA_READINESS: NO_GO_PENDING_FRESH_E2E

## Current next product gate
Fresh controlled post-03J E2E — single lane — REQUIRED BUT UNREGISTERED / NOT ADMITTED.
Not the first parallel pilot.
```

### 2.3 Initial board state after GOV-OS-01 Step 3 file cutover — FROZEN

Immediately after Step 3 installs the board, and until Step 4 LOCKS GOV-OS-01:

- Active implementation lanes: **0 / 2**
- Lane 1: **EMPTY**
- Lane 2: **EMPTY**
- Lane 3: **DISABLED**
- Governance owner: **GOV-OS-01** (governance task, not an implementation lane)
- GOVERNANCE mutex: owned by GOV-OS-01
- No source implementation is admitted merely because GOV-OS-01 exists

After Step 4 LOCKS GOV-OS-01:

- Implementation lanes remain **0 / 2** / EMPTY / DISABLED
- Governance owner: EMPTY unless a later authorized governance step is active
- GOVERNANCE mutex: released
- Fresh post-03J E2E remains REQUIRED BUT UNREGISTERED / NOT ADMITTED
- `PRIVATE-BETA-INVITE-01` remains UNREGISTERED / PROHIBITED

### 2.4 Insertion mechanic — FROZEN

Step 3 **inserts** the board and the LEGACY / FROZEN boundary at the absolute top of the existing `TASKS.md`.

Step 3 does **not** delete, archive, or rewrite the historical body.

The current Program Status mega-paragraph is already near the top of the existing file. Inserting the board + boundary above it is the required “move below the boundary.” Do not cut, rewrite, or relocate that paragraph’s content.

Do not repair the existing garbled first line of `TASKS.md`.

Do not copy multilingual / Heroicons / UX essays onto the board.

---

## 3. LEGACY / FROZEN boundary — FROZEN

Place this multi-line boundary immediately after the board, before all previously existing `TASKS.md` content:

```text
============================================================
LEGACY / FROZEN TASK HISTORY — NOT CURRENT EXECUTION STATE

DO NOT USE CONTENT BELOW THIS LINE TO DETERMINE:
- ACTIVE work
- admitted lanes
- current stage
- next task
- blockers
- mutex ownership
- scheduling

Historical occurrences of:
ACTIVE
Current Stage
Next Recommended Task
Program Status
Selected
Family Status

below this boundary are historical evidence only.

CURRENT EXECUTION AUTHORITY EXISTS ONLY IN THE BOARD ABOVE.
============================================================
```

### 3.1 Semantics — FROZEN

- Workers must never grep below the freeze boundary for current ACTIVE work.
- Historical ACTIVE does not admit a task.
- Historical “next task” / “Next Recommended Task” / “Current Stage” / “Program Status” / “Selected” / “Family Status” text does not authorize registration or admission.
- Historical bodies remain reference / evidence only.
- Do not rewrite thousands of stale historical headings.
- Do not archive or delete the historical body in GOV-OS-01.

---

## 4. Program Status mega-paragraph — FROZEN

- The existing append-only Program Status mega-paragraph must **not** remain in the schedulable / current region.
- It must be retained as historical evidence.
- After Step 3 insertion, it sits below the LEGACY / FROZEN boundary.
- Do not delete its historical content.
- Stop appending new current-state information to it **permanently** after cutover.

Pre-cutover exception used by this Step 2 only: GOV-OS-01 lifecycle was mirrored into that paragraph under the old model because the board does not exist yet. Step 3 must not continue that practice after the board exists.

---

## 5. Board modification authority — FROZEN

The `TASKS.md` board may be modified only by a control-plane / governance step holding the **GOVERNANCE** mutex.

Authorized contexts:

1. Registration / admission
2. Stage / control-plane update where explicitly required
3. Consolidation / checkpoint / integration
4. Explicit Keith-directed governance action executed through the task workflow

Ordinary implementation workers may **NOT**:

- self-register
- self-admit
- choose a lane
- change their lane
- acquire / release mutexes in `TASKS.md` themselves
- change another lane
- change NEXT / current gate
- declare themselves LOCKED
- modify `TASKS.md`
- modify `TASKS_BACKLOG_FULL.md`
- modify `CLAUDE.md`
- modify `AGENTS.md`

Implementation workers report results to the control plane.

The governance / control-plane step performs board / registry updates.

GOV-OS-01 is itself a governance task. During Steps 3 and 4 it holds GOVERNANCE and may edit the listed governance files. It is not an implementation lane.

---

## 6. Lifecycle — FROZEN

Preserve the existing 2 / 3 / 4 model. Parallelism changes scheduling, not quality discipline.

### Tiny

Implementation → Consolidation

### Normal

Registration → Implementation → Consolidation

### Risky / architecture-heavy / governance / security / migration / unclear

Registration → Stage-Start → Implementation → Consolidation

Each admitted **implementation** lane may contain only **ONE** bounded implementation task.

A large task must still be divided into bounded child slices where necessary.

Governance / control-plane tasks are not admitted as implementation lanes. They hold GOVERNANCE and are tracked under Governance owner / state.

---

## 7. Lane state model — FROZEN

External implementation-lane states:

| State | Meaning |
|---|---|
| ACTIVE | Admitted and currently in its lifecycle |
| LANE-DONE | Implementation + lane-local validation completed. NOT integrated. NOT deployed. NOT beta-ready. NOT dependency-unblocking. NOT LOCKED |
| LOCKED | Control-plane integration / consolidation completed and required integrated validation / evidence passed |

If a lane fails admission / integration or must be returned, the control plane records a result such as:

- REJECTED
- RETURN-TO-READY

Do not create a complicated worker state machine.

Workers do not self-declare LOCKED or LANE-DONE on the board.

LANE-DONE is an implementation-lane state only. Governance tasks do not use LANE-DONE.

Lane-local green is insufficient for LOCK.

---

## 8. Parallel capacity — FROZEN

- Pilot maximum admitted implementation lanes: **2**
- Lane 3: **DISABLED**
- A future increase to 3 requires:
  - completed pilot evidence
  - explicit governance decision / task
  - updated board / `CLAUDE.md` rule
- Lane 3 must **not** enable automatically after “things seem fine”
- Never derive lane count from the five logical workstreams
- Using only one lane is valid. Capacity 2 is a maximum, not a requirement to fill both lanes

---

## 9. Logical workstreams — FROZEN

Five labels only:

- CORE
- AGENT
- PRODUCT
- COMMERCIAL
- RELIABILITY

They are taxonomy / ownership / planning labels only.

They **NEVER** authorize parallel execution.

Examples:

- CORE + PRODUCT can still conflict and be rejected.
- Two PRODUCT tasks can theoretically be independent if all admission checks pass.

Physical mutex / write-scope rules determine safety.

Workstream label has **zero** admission weight.

---

## 10. Resource / mutex model — FROZEN

Minimal v1 resource set:

- GOVERNANCE
- GATEWAY
- AI-SERVICE
- CONTAINER-MANAGER
- FRONTEND
- MIGRATION
- PACKAGE
- COMPOSE
- ENV
- LOCAL-RUNTIME
- STAGING
- PROVIDER-LIVE
- CREDIT
- I18N
- HOTFILE:<absolute-or-repo-relative-path>

### Definitions

**GOVERNANCE**
Writes to `CLAUDE.md`, `AGENTS.md`, `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `PRD.md`, `ARCHITECTURE.md`, roadmap / master-plan governance state, or governance checkpoints as applicable.

**GATEWAY**
Writer under `services/api-gateway` relevant application source.

**AI-SERVICE**
Writer under `services/ai-service` relevant source.

**CONTAINER-MANAGER**
Writer under `services/container-manager` relevant source.

**FRONTEND**
Frontend source writer. v1 is deliberately conservative. Later governance may relax this if exact disjoint scopes prove safe.

**MIGRATION**
Migration authoring plus related schema / entity changes that require migration / order integrity.

**PACKAGE**
`package.json` / dependency / lockfile mutations.

**COMPOSE**
`docker-compose*.yml` / equivalent compose topology mutations.

**ENV**
Environment / gate configuration mutation including relevant `.env` / example or deployment gate state.

**LOCAL-RUNTIME**
Ownership of local Docker / PostgreSQL / Redis / Next / Gateway / services runtime.

**STAGING**
Staging deployment / PM2 / Caddy / staging env / runtime state.

**PROVIDER-LIVE**
Controlled real paid-provider execution. This is both evidence / budget isolation and prevents two lanes from contaminating provider-live validation simultaneously.

**CREDIT**
Intentional credit / balance / accounting state mutation or evidence-sensitive credit validation.

**I18N**
One atomic lease for all three:

- `C:\Users\knlee\aiSandBox2026B\frontend\messages\en.json`
- `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-TW.json`
- `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-CN.json`

**HOTFILE:<path>**
Explicit lease for structurally shared / collision-prone files not sufficiently protected by another broader mutex.

Case-insensitive matching applies on Windows.

Avoid redundant HOTFILE leases where the entire relevant service is already exclusive through GATEWAY / AI-SERVICE / CONTAINER-MANAGER / FRONTEND.

Do not create another permanent governance file just to move this mutex model out of `CLAUDE.md`. Install the concise mutex set in `CLAUDE.md`.

---

## 11. Admission rules — FROZEN

A task may be admitted only if ALL are true:

- [ ] lane capacity exists
- [ ] Start condition = READY
- [ ] declared dependencies are satisfied
- [ ] no dependency on unfinished output from another lane
- [ ] primary write scopes do not conflict
- [ ] mutex / resource ownership does not conflict
- [ ] I18N / HOTFILE leases do not conflict
- [ ] shared contracts are frozen where necessary
- [ ] revert isolation is acceptable
- [ ] evidence isolation is acceptable
- [ ] runtime / provider / credit / staging requirements are compatible
- [ ] task has a valid bounded lifecycle

Workstream label has zero admission weight.

If uncertain whether two tasks are independent: **DO NOT ADMIT THEM CONCURRENTLY.**

---

## 12. Registration metadata — FROZEN lean v1

Required near-frontier task metadata:

- Task ID
- Workstream
- Lifecycle
- Start condition
- Depends on
- Primary write scope
- Mutexes / resources
- Hot-file leases
- Shared contracts
- Evidence class
- Revert isolation

Evidence class values:

- LOCAL-TESTS
- LOCAL-RUNTIME
- STAGING-RUNTIME
- PROVIDER-LIVE

Do **not** require:

- Blocks
- Gateway writer yes / no
- giant forbidden-scope essays
- duplicated global CLAUDE rules
- huge conflict lists derivable from mutex / write scope

Anything outside declared write scope is forbidden by default unless the control plane expands scope explicitly.

Future tasks after GOV-OS-01 use this leaner model.

GOV-OS-01 Step 3 must **not** mass-migrate historical tasks onto this template.

---

## 13. Contract rule — FROZEN

If two lanes depend on a shared API / schema / auth / session / tool / config contract, that contract must be frozen before parallel execution.

Implementation workers may not silently change a frozen contract.

If a contract change becomes necessary:

1. stop affected lane(s)
2. return to control plane
3. perform bounded contract / governance change
4. re-freeze
5. reassess admission

Do not allow one lane to break another lane’s assumptions mid-flight.

---

## 14. Revert / evidence isolation — FROZEN

Parallel work is allowed only if reverting one lane does not invalidate the other lane’s implementation evidence.

Before LOCK:

- the integrated tree contains the correct surviving lane state
- relevant integrated tests are rerun
- another lane’s LANE-DONE evidence remains valid after integration / revert

Lane-local green is insufficient for LOCK.

---

## 15. New-window boot sequence — FROZEN

Deterministic process:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `TASKS.md` CURRENT EXECUTION BOARD ONLY (stop at the LEGACY / FROZEN boundary)
4. exact admitted TASK ID in `TASKS_BACKLOG_FULL.md`
5. named stage-start / checkpoint only where needed

`AGENTS.md` must tell the worker to apply `CLAUDE.md`.

If the TASKS board does not admit the task: **DO NOT START.**

Do not recover current work by:

- grepping historical ACTIVE
- reading roadmap Current Next Task
- reading Platform-00 follow-up roadmap
- using chat memory

`PRD.md` / `ARCHITECTURE.md`: read only where task scope requires product or technical authority.

---

## 16. AGENTS.md target — FROZEN

Rewrite `C:\Users\knlee\aiSandBox2026B\AGENTS.md` as a thin bootstrap, roughly 30–60 lines.

It must NOT duplicate:

- security encyclopedia
- testing manual
- detailed mutex definitions
- checkpoint manual
- implementation style guide
- architecture inventories

It must contain only enough to force:

- correct authority interpretation
- `CLAUDE.md`
- board
- exact task
- exact evidence
- no invented work
- conservative behavior when unclear

### 16.1 Exact target draft

Step 3 should replace `AGENTS.md` with content substantially equivalent to:

```markdown
# aiSandBox Agent Instructions

## Purpose

Thin bootstrap only. The operating manual is `C:\Users\knlee\aiSandBox2026B\CLAUDE.md`.
Do not treat this file as a second rulebook.

## Authority by domain

- PRD.md = PRODUCT WHAT
- ARCHITECTURE.md = TECHNICAL HOW
- CLAUDE.md = DEVELOPMENT OS / RULES
- AGENTS.md = this bootstrap
- TASKS.md CURRENT EXECUTION BOARD = only current scheduler
- TASKS_BACKLOG_FULL.md = canonical task registry
- Locked checkpoint / stage-start docs = evidence
- AINOW-EXECUTION-ROADMAP.md = historical / strategic reference, not scheduler
- AGENT-PLATFORM-00 = historical / strategic vision, not current PRD, architecture, or scheduler

CLAUDE.md defines admission / mutex / lifecycle rules.
The TASKS.md board applies those rules to specific tasks.
CLAUDE.md cannot admit a task.
The board cannot violate CLAUDE.md rules.
There is no global file-rank that overrides these domains.

## Boot sequence

1. Read this file.
2. Apply CLAUDE.md.
3. Read the TASKS.md CURRENT EXECUTION BOARD ONLY. Stop at the LEGACY / FROZEN boundary.
4. If your task is not admitted on the board: DO NOT START.
5. Read the exact admitted TASK ID in TASKS_BACKLOG_FULL.md.
6. Read the named stage-start / checkpoint only when that task requires it.
7. Read PRD.md or ARCHITECTURE.md only if the admitted task scope requires product or technical authority.

Do not recover current work by grepping historical ACTIVE, reading roadmap Current Next Task, reading Platform-00, or using chat memory.

## Writers

Implementation workers must not modify TASKS.md, TASKS_BACKLOG_FULL.md, CLAUDE.md, or AGENTS.md.
They must not self-register, self-admit, choose a lane, or acquire / release mutexes.
Report results to the control plane. The control plane updates the board and registry.

## Conservative default

If unclear: do not start, do not invent work, do not expand scope.
Keith/user owns Git. No commit, push, branch, or worktree unless explicitly requested.
No subagents by default.
```

Keep the rewritten file in the 30–60 line range. Do not reintroduce the current security / testing / architecture inventories into `AGENTS.md`.

---

## 17. CLAUDE.md bounded Step 3 scope — FROZEN

Edit `C:\Users\knlee\aiSandBox2026B\CLAUDE.md` only to install OS v1 and correct conflicting statements.

### 17.1 Required installs / replacements

- authority-by-domain model
- TASKS board = only scheduler
- backlog = canonical registry
- end-status / full-body mirroring (board + backlog; stop Program Status appends after cutover)
- lane limit 2; Lane 3 DISABLED
- one bounded implementation task per admitted lane
- admission / mutex rules (the frozen v1 set, including ENV and PROVIDER-LIVE)
- I18N trio as one atomic lease
- governance / control-plane writer rule
- integration / LOCK rule and LANE-DONE semantics
- boot sequence
- current model guidance (replace the stale Sonnet / GPT-5.3 / GPT-5.5 table)
- PowerShell 5.x; full Windows paths
- Keith / user owns Git; no commit / push / branch unless explicitly requested
- no subagents by default
- Docker / PostgreSQL / Redis requirements (do not assume they are running)
- operator-attended browser / live-smoke handling
- multilingual-first (retain concise standing rule)
- Heroicons v2 Outline — one concise standing rule
- Impeccable / Emil advisory-only
- one-line correction that gVisor is **PLANNED**, not current

### 17.2 Explicit non-goals inside CLAUDE.md

- Do not perform broad technical inventory deduplication in this task.
- Do not create another permanent governance file to hold the mutex model.
- Do not delete or relocate the existing auth / checkpoint / file-action / internal-API working-contract sections merely to shorten the file.
- Material growth must be justified. Duplication should decrease, not increase.
- There is no arbitrary hard line-count requirement.

### 17.3 Specific current-line correction

Current:

```text
- Sandbox runtime: Docker + gVisor
```

Frozen replacement intent:

```text
- Sandbox runtime: Docker (gVisor is PLANNED, not current)
```

### 17.4 PowerShell rule — FROZEN

- Use Windows PowerShell 5.x.
- Use full filesystem paths.
- Do not use CMD.
- Do not require PowerShell 7.

---

## 18. Current model-routing rule — FROZEN

Install once in `CLAUDE.md`. Do not duplicate this table in `AGENTS.md`, the TASKS board, or every future task body.

- **Implementation:** Grok 4.6 High
- **Grok 4.6 XHigh** only for:
  - hard / risky implementation
  - difficult debugging
  - unclear root cause
  - migration / data-integrity-sensitive work
  - architecture-heavy implementation
  - after High has failed or repeatedly made mistakes
- **Registration / consolidation:** Grok 4.6 High OR Sonnet 4.6 depending on current Cursor usage / quota
- **High-risk independent architecture / review:** Opus may be used when justified

The GOV-OS-01 registration “Model” field remains historical registration metadata. Do not mass-edit historical task Model fields.

---

## 19. Git / operator rules — FROZEN

- Keith / user owns Git.
- Do not commit.
- Do not push.
- Do not create branches.
- Do not create worktrees unless explicitly requested / authorized by the active control-plane task.
- Do not include commit / push steps in routine prompts unless explicitly asked.

---

## 20. Runtime / live-smoke rule — FROZEN

If backend / runtime validation requires Docker / PostgreSQL / Redis: state this explicitly before implementation / validation.

Do not assume they are running.

Browser / live smoke that requires interactive / user-controlled behavior must explicitly involve Keith unless browser automation has been enabled and specifically requested.

Do not falsely claim live-smoke success.

GOV-OS-01 itself must not start Docker, PostgreSQL, Redis, frontend, backend, staging, provider calls, browser smoke, or E2E.

---

## 21. UX implementation rules — FROZEN

Install concise standing rules in `CLAUDE.md` only. Do not copy these essays into `TASKS.md` or every future task body.

**Multilingual-first**
All new user-facing UX / UI copy updates together:

- `C:\Users\knlee\aiSandBox2026B\frontend\messages\en.json`
- `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-TW.json`
- `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-CN.json`

Use the existing translation hook / pattern.
No hardcoded English user-facing text.

**Icons**
Normal UI icons: Heroicons v2 Outline.

**Advisory skills**
Impeccable and Emil Kowalski skills are advisory only.
They never override PRD, ARCHITECTURE, CLAUDE, registered scope, or tests.

---

## 22. Roadmap demotion banner — FROZEN

File:

`C:\Users\knlee\aiSandBox2026B\docs\AINOW-EXECUTION-ROADMAP.md`

Step 3 may change **only** its header / status / authority banner.

Do not rewrite the body.
Do not reconcile historical “Current Next Task” text.

### 22.1 Required banner intent

The banner must make all of the following unmistakable:

- HISTORICAL / STRATEGIC REFERENCE
- NOT CURRENT EXECUTION AUTHORITY
- `TASKS.md` board is the only scheduler
- historical one-ACTIVE-task / Current Next Task text is not admission authority
- do not use this file to determine current work
- body remains historical evidence and is not reconciled in GOV-OS-01

### 22.2 Exact banner text Step 3 may install

Replace the current Status / Authority header lines with content substantially equivalent to:

```markdown
**Status:** HISTORICAL / STRATEGIC REFERENCE — NOT CURRENT EXECUTION AUTHORITY
**Scheduler:** TASKS.md CURRENT EXECUTION BOARD is the only current scheduler.
**Do not use this file to determine current work, admitted lanes, or next task.**
Historical one-ACTIVE-task / Current Next Task text in this file is not admission authority.
The body below is historical evidence and is not reconciled by GOV-OS-01.
```

Keep `Created` / `Task: ROADMAP-00` if present. Do not edit section bodies.

---

## 23. Platform master-plan demotion banner — FROZEN

File:

`C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md`

Step 3 may modify **only** the top status / banner.

Do not rewrite the body.

### 23.1 Required banner intent

Must state:

- AGENT-PLATFORM-00 is COMPLETE AND LOCKED
- HISTORICAL / STRATEGIC VISION
- preserve long-term vision
- body contains historical planning assumptions that may now be stale
- `PRD.md` = current product WHAT
- `ARCHITECTURE.md` = current technical HOW
- `TASKS.md` board = current execution scheduler
- do not treat this file as current architecture or scheduling authority

### 23.2 Exact banner text Step 3 may install

Replace the current `**Status:** ACTIVE planning output` block with content substantially equivalent to:

```markdown
**Status:** COMPLETE AND LOCKED — HISTORICAL / STRATEGIC VISION
**Task ID:** AGENT-PLATFORM-00
**Current product WHAT:** PRD.md
**Current technical HOW:** ARCHITECTURE.md
**Current execution scheduler:** TASKS.md CURRENT EXECUTION BOARD
Preserve the long-term vision in this file.
The body below contains historical planning assumptions that may now be stale.
Do not treat this file as current architecture, current PRD, or scheduling authority.
```

Do not edit later body sections, including text that historically called this file an authoritative planning foundation.

---

## 24. TASKS_BACKLOG_FULL.md in GOV-OS-01 — FROZEN

During Step 3:

- update GOV-OS-01 itself only as required by its lifecycle
- do not broadly clean the backlog
- do not change locked bodies
- do not classify historical tasks with lane metadata
- do not register GOV-ARCH-02
- do not register GOV-PRD-02
- do not register E2E
- no massive registration-template migration

Future tasks after GOV-OS-01 use the leaner metadata model.

---

## 25. Explicit exclusions — FROZEN

GOV-OS-01 may **NOT**:

- modify `PRD.md`
- modify `ARCHITECTURE.md`
- modify application source
- modify application tests
- modify migrations / schema
- run runtime / staging / provider / E2E
- create worktrees
- archive TASKS history
- mass-correct historical ACTIVE markers
- rewrite roadmap body
- rewrite Platform-00 body
- reconcile post-03J accounting architecture
- reconcile Ask / Build product semantics
- invite beta users
- register successor tasks

---

## 26. Post-GOV-OS sequence — RECORDED, NOT REGISTERED

Recorded here only. Step 3 must not register any of these:

1. GOV-OS-01 LOCKED
2. fresh controlled post-03J E2E
   - single lane
   - NOT first parallel pilot
3. GOV-ARCH-02
4. GOV-PRD-02
5. first genuine two-source-lane pilot
6. pilot review
7. explicit governance decision whether Lane 3 may be enabled

---

## 27. Exact permitted Step 3 files

Step 3 may modify only:

| File | Allowed mutation |
|---|---|
| `C:\Users\knlee\aiSandBox2026B\docs\GOV-OS-01-STAGE-START.md` | Read-only freeze. Do not rewrite in Step 3 |
| `C:\Users\knlee\aiSandBox2026B\CLAUDE.md` | Bounded OS v1 install per §17 |
| `C:\Users\knlee\aiSandBox2026B\AGENTS.md` | Replace with thin bootstrap per §16 |
| `C:\Users\knlee\aiSandBox2026B\TASKS.md` | Insert board + LEGACY boundary at top; update GOV-OS-01 lifecycle fields only; do not clean historical body |
| `C:\Users\knlee\aiSandBox2026B\TASKS_BACKLOG_FULL.md` | Update GOV-OS-01 lifecycle fields only |
| `C:\Users\knlee\aiSandBox2026B\docs\AINOW-EXECUTION-ROADMAP.md` | Header / status / authority banner only |
| `C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` | Top status / banner only |

Step 3 must not create a new permanent governance file.
Step 3 must not create the Step 4 checkpoint document.
Step 3 must not begin Step 4.

---

## 28. Exact prohibited files / actions for Step 3

Prohibited files:

- `C:\Users\knlee\aiSandBox2026B\PRD.md`
- `C:\Users\knlee\aiSandBox2026B\ARCHITECTURE.md`
- all application source
- all application tests
- migrations / schema / entities except as already forbidden
- env / example env
- `docker-compose*.yml` (GOV-OS-01 does not take COMPOSE)
- frontend / gateway / ai-service / container-manager application trees

Prohibited actions:

- Docker / PostgreSQL / Redis / frontend / backend / staging start
- provider calls
- browser smoke
- E2E
- worktrees / branches
- commit / push unless Keith explicitly asks
- subagents
- registering GOV-ARCH-02, GOV-PRD-02, E2E, PRIVATE-BETA-INVITE-01, or any other successor
- inviting beta users
- archiving or deleting TASKS history
- mass-correcting historical ACTIVE markers
- rewriting roadmap or Platform-00 bodies

---

## 29. Step 3 acceptance criteria — FROZEN

Step 3 is complete only if all of the following are true:

- [ ] `TASKS.md` board exists at absolute top with all required v1 fields
- [ ] Active implementation lanes = 0 / 2
- [ ] Lane 1 EMPTY
- [ ] Lane 2 EMPTY
- [ ] Lane 3 DISABLED
- [ ] GOV-OS-01 is governance owner, not an implementation lane
- [ ] LEGACY / FROZEN boundary installed with frozen semantics
- [ ] historical TASKS body retained below the boundary
- [ ] Program Status mega-paragraph is below the boundary and is not appended to as current state
- [ ] `CLAUDE.md` contains authority-by-domain, board-only scheduler, backlog-as-registry, admission/mutex, governance-writer, LOCK/LANE-DONE, boot sequence, frozen model routing, Git/operator, runtime/live-smoke, multilingual/Heroicons/advisory, PowerShell 5.x, gVisor PLANNED correction
- [ ] `AGENTS.md` is a thin 30–60 line bootstrap and no longer uses a global file-rank list
- [ ] roadmap header demoted; body untouched
- [ ] Platform-00 header demoted; body untouched
- [ ] `TASKS_BACKLOG_FULL.md` updated for GOV-OS-01 lifecycle only
- [ ] `PRD.md` untouched
- [ ] `ARCHITECTURE.md` untouched
- [ ] no application source / test / migration / schema / env / runtime / E2E / worktree activity
- [ ] no successor task registered
- [ ] GOV-OS-01 status after Step 3: ACTIVE — Step 3 COMPLETE — Governance Implementation
- [ ] exact next step after Step 3: GOV-OS-01 Step 4 — Consolidation / Checkpoint

---

## 30. Step 2 files changed

| File | Action |
|---|---|
| `C:\Users\knlee\aiSandBox2026B\docs\GOV-OS-01-STAGE-START.md` | CREATED — this freeze |
| `C:\Users\knlee\aiSandBox2026B\TASKS.md` | GOV-OS-01 lifecycle status only |
| `C:\Users\knlee\aiSandBox2026B\TASKS_BACKLOG_FULL.md` | GOV-OS-01 lifecycle status only |

No other files modified in Step 2.

---

## 31. Step 2 acceptance criteria

- [x] GOV-OS-01-STAGE-START.md created
- [x] authority-by-domain model frozen
- [x] CLAUDE rules vs TASKS scheduler relationship frozen
- [x] board design frozen
- [x] board writer authority frozen
- [x] LEGACY/FROZEN semantics frozen
- [x] historical ACTIVE explicitly non-schedulable
- [x] Program Status mega-paragraph preservation/move frozen
- [x] lane capacity frozen at max 2
- [x] Lane 3 explicitly disabled
- [x] five workstreams frozen as labels only
- [x] full mutex/resource model frozen including ENV and PROVIDER-LIVE
- [x] I18N trio atomic ownership frozen
- [x] admission rules frozen
- [x] registration metadata frozen
- [x] contract freeze/change protocol frozen
- [x] revert/evidence isolation frozen
- [x] lane lifecycle frozen
- [x] LANE-DONE semantics frozen
- [x] new-window boot sequence frozen
- [x] AGENTS thin-bootstrap target frozen
- [x] CLAUDE bounded Step 3 scope frozen
- [x] current model routing frozen
- [x] Git/operator rules frozen
- [x] runtime/browser-smoke rules frozen
- [x] multilingual/Heroicons/advisory rules frozen
- [x] roadmap demotion-banner scope frozen
- [x] Platform-00 demotion-banner scope frozen
- [x] TASKS backlog Step 3 scope frozen
- [x] PRD.md explicitly excluded
- [x] ARCHITECTURE.md explicitly excluded
- [x] no source/runtime/E2E/worktree activity
- [x] no future task registration
- [x] GOV-OS-01 marked Step 2 COMPLETE in both task files
- [x] exact next step = GOV-OS-01 Step 3 — Governance Implementation

---

## 32. Confirmation

- No operating-system implementation occurred in Step 2.
- No `PRD.md` / `ARCHITECTURE.md` / application source / test / migration / schema / env / runtime / staging / provider / E2E / worktree / branch / commit / push / subagent activity occurred in Step 2.
- No successor task was registered.

**GOV-OS-01 status:** ACTIVE — Step 2 COMPLETE — Stage-Start / OS v1 Freeze — 2026-08-18

**Exact next step:** GOV-OS-01 Step 3 — Governance Implementation
