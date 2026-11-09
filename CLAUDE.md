# CLAUDE.md — AI Sandbox Platform Governance & Working Contract

---

## Project Overview

AI Sandbox Platform enables users to build software by chatting with AI inside isolated containers.

The platform consists of:

- Frontend: Next.js, React, Monaco Editor
- Backend services: NestJS / TypeScript services under `services/`
- Sandbox runtime: Docker (gVisor is PLANNED, not current)
- Git auto-commit and checkpoint/revert system
- Usage/quota tracking and future commercial readiness surfaces
- AI execution, streaming, workspace file actions, preview, editor, and checkpoint history

---

## Repository Root and Path Rules

The repository root is:

```powershell
C:\Users\knlee\aiSandBox2026B
```

All source paths must be relative to the repository root unless the user explicitly asks for another form.

Use full Windows filesystem paths when giving commands or handoff prompts.

Examples:

```text
C:\Users\knlee\aiSandBox2026B\frontend\...
C:\Users\knlee\aiSandBox2026B\services\api-gateway\...
C:\Users\knlee\aiSandBox2026B\services\ai-service\...
C:\Users\knlee\aiSandBox2026B\services\container-manager\...
C:\Users\knlee\aiSandBox2026B\docs\...
```

Do not reference a non-existent `aiSandBox/` subdirectory.

---

## Current Directory Structure

```text
C:\Users\knlee\aiSandBox2026B\
  CLAUDE.md
  ARCHITECTURE.md
  PRD.md
  TASKS.md
  TASKS_BACKLOG_FULL.md
  docker-compose.yml
  package.json
  frontend\
  services\
    api-gateway\
    ai-service\
    container-manager\
  docs\
```

Any structural deviation must be explicitly approved.

---

## Authority by Domain

Authority is domain-based. There is no global file-rank that overrides these domains.

| Artifact | Domain | Authority |
|---|---|---|
| `C:\Users\knlee\aiSandBox2026B\PRD.md` | PRODUCT WHAT | Current product requirements; current / gated / planned distinctions; user-facing product semantics |
| `C:\Users\knlee\aiSandBox2026B\ARCHITECTURE.md` | TECHNICAL HOW | System architecture; service boundaries; APIs; data/transport/execution architecture; technical invariants |
| `C:\Users\knlee\aiSandBox2026B\CLAUDE.md` | DEVELOPMENT OS / RULES | Workflow; task lifecycle; lane/admission rules; mutexes; model routing; Git/operator rules; validation/process rules; UX implementation conventions |
| `C:\Users\knlee\aiSandBox2026B\AGENTS.md` | THIN BOOTSTRAP | Tells Cursor/agents where to obtain authoritative operating context. Must not duplicate this manual |
| `C:\Users\knlee\aiSandBox2026B\TASKS.md` CURRENT EXECUTION BOARD | ONLY CURRENT SCHEDULER | Admitted lanes, mutex ownership, current gates/blockers, governance owner. Not the task-body registry |
| `C:\Users\knlee\aiSandBox2026B\TASKS_BACKLOG_FULL.md` | CANONICAL TASK REGISTRY | ID, scope, AC, dependencies, history, checkpoint references, LOCKED state |
| `C:\Users\knlee\aiSandBox2026B\docs\control-plane\task-checklists.md` | RULE CHECKLISTS | Short checklists by task type, taken from this file; briefs copy them and checkpoints report them (GOV-OS-07). CLAUDE.md wins on conflict |
| `C:\Users\knlee\aiSandBox2026B\DESIGN.md` | VISUAL DESIGN REFERENCE | Colors, type, spacing, components and states as built; advisory under the UX/UI Work Rules; never overrides PRD.md, ARCHITECTURE.md, CLAUDE.md, admitted scope or tests |
| `C:\Users\knlee\aiSandBox2026B\PRODUCT.md` | DESIGN CONTEXT | Users, tone and design principles read by the design skills; not product authority (PRD.md is) |
| Locked checkpoint / stage-start documents under `C:\Users\knlee\aiSandBox2026B\docs\` | EVIDENCE | Named evidence for a specific task/step. Not a scheduler |
| `C:\Users\knlee\aiSandBox2026B\docs\AINOW-EXECUTION-ROADMAP.md` | HISTORICAL / STRATEGIC REFERENCE | Not scheduler. Not current task authority |
| `C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` | HISTORICAL / STRATEGIC VISION | Not current product authority. Not current technical architecture. Not scheduler |

Conflict-resolution:

- `CLAUDE.md` defines admission / scheduling **RULES**.
- The `TASKS.md` board **applies** those rules to particular tasks.
- `CLAUDE.md` cannot itself admit or schedule a task.
- The `TASKS.md` board cannot violate `CLAUDE.md` admission / mutex / lifecycle rules.
- `PRD.md` remains authoritative only in the PRODUCT WHAT domain.
- `ARCHITECTURE.md` remains authoritative only in the TECHNICAL HOW domain.

---

## Development OS / Parallel Control Plane v1

Parallel Development Architecture **v1** is standing repository governance.

### Standing-governance anti-drift rule

Ordinary implementation, UX, roadmap, registration, consolidation, product, or architecture tasks may not bypass, weaken, replace, or silently reinterpret this OS: lane capacity, scheduler authority, admission rules, mutex semantics, worker permissions, or boot/recovery rules.

Changing those OS semantics requires an explicitly registered governance task.

### OS-mutation quiescence rule

A governance task that changes Development OS / Parallel Architecture semantics must begin with zero ACTIVE or LANE-DONE implementation lanes.

Routine control-plane operations such as registration, admission, board-status updates, integration, consolidation, LOCK, and mutex release are not OS mutation and may operate while managing admitted lanes.

### Scheduler vs registry

- The `TASKS.md` CURRENT EXECUTION BOARD is the **only** current scheduler.
- `TASKS_BACKLOG_FULL.md` is the canonical task registry (bodies, AC, dependencies, history, LOCKED state).
- Locked checkpoint / stage-start documents are evidence only.
- Roadmap and Platform-00 are historical / strategic only. They have no admission authority.
- Do not determine current work from content below the TASKS `LEGACY / FROZEN` boundary.
- Do not recover current work by grepping historical ACTIVE, reading roadmap Current Next Task, reading Platform-00, or using chat memory.

Post-cutover status mirroring:

- Scheduler state lives on the `TASKS.md` board.
- Canonical task body / history / AC / LOCKED state lives in `TASKS_BACKLOG_FULL.md`.
- Control-plane steps mirror **end status** into both: (1) board fields and (2) the canonical backlog body.
- Do **not** full-body mirror TASKS and backlog.
- Do **not** append current-state information to the Program Status mega-paragraph. That mechanism is permanently retired.

### Parallel capacity

- Maximum admitted implementation lanes: **2**
- Lane 3: **DISABLED**
- Capacity 2 is a maximum, not a requirement to fill both lanes. Using only one lane is valid.
- Lane 3 must not enable automatically. A future increase to 3 requires completed pilot evidence, an explicit governance task, and an updated board / `CLAUDE.md` rule.
- Never derive lane count from the five logical workstreams.

### Lane contents

Each admitted **implementation** lane may contain only **ONE** bounded implementation task.

A large task must still be divided into bounded child slices where necessary.

Governance / control-plane tasks are **not** implementation lanes. They hold GOVERNANCE and are tracked under Governance owner / state.

### Logical workstreams

Five labels only: CORE, AGENT, PRODUCT, COMMERCIAL, RELIABILITY.

They are taxonomy / ownership / planning labels only. They **NEVER** authorize parallel execution. Workstream label has **zero** admission weight.

### Lane states

External implementation-lane states:

| State | Meaning |
|---|---|
| ACTIVE | Admitted and currently in its lifecycle |
| LANE-DONE | Implementation + lane-local validation completed. NOT integrated. NOT deployed. NOT beta-ready. NOT dependency-unblocking. NOT LOCKED |
| LOCKED | Control-plane integration / consolidation completed and required integrated validation / evidence passed |

If a lane fails admission / integration or must be returned, the control plane records REJECTED or RETURN-TO-READY.

Workers do not self-declare LOCKED or LANE-DONE on the board.

LANE-DONE is an implementation-lane state only. Governance tasks do not use LANE-DONE.

Lane-local green is insufficient for LOCK.

### Board modification authority

The `TASKS.md` board may be modified only by a control-plane / governance step holding the **GOVERNANCE** mutex.

Ordinary implementation workers may **NOT**:

- self-register, self-admit, choose a lane, change their lane, or change another lane
- acquire / release mutexes in `TASKS.md` themselves
- change NEXT / current gate
- declare themselves LOCKED
- modify `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `CLAUDE.md`, or `AGENTS.md`

Implementation workers report results to the control plane. The governance / control-plane step performs board / registry updates.

### Resource / mutex model

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

Definitions:

**GOVERNANCE** — Writes to `CLAUDE.md`, `AGENTS.md`, `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `PRD.md`, `ARCHITECTURE.md`, roadmap / master-plan governance state, or governance checkpoints as applicable.

**GATEWAY** — Writer under `services/api-gateway` relevant application source.

**AI-SERVICE** — Writer under `services/ai-service` relevant source.

**CONTAINER-MANAGER** — Writer under `services/container-manager` relevant source.

**FRONTEND** — Frontend source writer. v1 is deliberately conservative.

**MIGRATION** — Migration authoring plus related schema / entity changes that require migration / order integrity.

**PACKAGE** — `package.json` / dependency / lockfile mutations.

**COMPOSE** — `docker-compose*.yml` / equivalent compose topology mutations.

**ENV** — Environment / gate configuration mutation including relevant `.env` / example or deployment gate state.

**LOCAL-RUNTIME** — Ownership of local Docker / PostgreSQL / Redis / Next / Gateway / services runtime.

**STAGING** — Staging deployment / PM2 / Caddy / staging env / runtime state.

**PROVIDER-LIVE** — Controlled real paid-provider execution. Evidence / budget isolation; prevents two lanes from contaminating provider-live validation simultaneously.

**CREDIT** — Intentional credit / balance / accounting state mutation or evidence-sensitive credit validation.

**I18N** — One atomic lease for all three:

- `C:\Users\knlee\aiSandBox2026B\frontend\messages\en.json`
- `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-TW.json`
- `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-CN.json`

**HOTFILE:<path>** — Explicit lease for structurally shared / collision-prone files not sufficiently protected by another broader mutex. Case-insensitive matching applies on Windows. Avoid redundant HOTFILE leases where the entire relevant service is already exclusive through GATEWAY / AI-SERVICE / CONTAINER-MANAGER / FRONTEND.

### Admission rules

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

### Fail-closed lane saturation (GOV-OS-03)

`TASKS.md` remains the only scheduler. The machine sidecar `docs/control-plane/lane-saturation-state.json` is not a scheduler and cannot admit, rank, select, or invent tasks.

After the GOV-OS-03 enforcement epoch (`<!-- AISB_GOV_OS_03_ENFORCEMENT_EPOCH_V1 -->` in `TASKS_BACKLOG_FULL.md`), every newly registered canonical task must carry exactly one `AISB_MACHINE_REG_V1` machine-registration stanza (`taskId`, `nature`). Completeness is derived from that canonical registry, not from model memory, chat, or `IDLE_REASON` / `SAFE_TWO_LANE_PAIR` prose. Pre-epoch historical tasks are grandfathered: they are not mass-migrated and are not scanned from `Status` / `Nature` / `Previous:` / `ACTIVE` / `READY` lifecycle prose.

If `nature=IMPLEMENTATION`, the sidecar must contain a corresponding candidate object with `nature=IMPLEMENTATION` and an explicit `saturationClass` of `FORCING` or `OPTIONAL`. There is no default. Missing classification on an existing candidate fails closed. Missing the entire candidate object fails closed (`MISSING_CANDIDATE_RECORD`). Missing the machine stanza fails closed (`MISSING_MACHINE_REGISTRATION`). `nature=GOVERNANCE` requires the stanza but does not require an implementation candidate and does not occupy implementation-lane capacity. Governance tasks are not implementation candidates.

This completeness check runs before OS-mutation suspension short-circuit and before idle derivation. `saturationSuspended=true` must not hide a missing candidate record.

The validator `scripts/validate-lane-capacity.ps1` is a proof checker over proposed END occupancy. It derives admissibility and idle result. It does not select tasks. Agent-written `IDLE_REASON`, `SAFE_TWO_LANE_PAIR`, `NOT_NEEDED`, and `UNRESOLVED` prose is not authoritative. Historical `Previous:` / `ACTIVE` text is not occupancy.

Mandatory postcondition (when saturation is not suspended):

FREE IMPLEMENTATION LANE AND nonempty set S of safely admissible FORCING candidates = proposed control-plane end state is invalid.

If S is empty, idle implementation capacity is valid. Safety outranks saturation. Maximum implementation lanes remains 2. Lane 3 remains DISABLED.

Always evaluate pairwise safety against proposed END occupancy, not only against an empty board.

The validator is mandatory at machine-relevant control-plane transitions (implementation registration, canonical post-epoch machine-registration metadata change, enforcement-epoch marker change, candidate classification/status/write-set changes, admission, stage-start, mutex acquire/release, dependency LOCK proof changes, shared-contract freeze/unfreeze, LANE-DONE, lane release, LOCK, REJECTED, RETURN-TO-READY, begin/end OS mutation). It is a postcondition over proposed end state. Workers cannot update machine state, occupancy block, sidecar, catalog, or proof.

During an active Development OS mutation, saturation is suspended, implementation lanes must be zero, and idle is required (`OS_MUTATION_QUIESCENCE`). When suspension ends, the normal saturation postcondition applies immediately.

If no registered FORCING candidate is safely admissible, GOV-OS-03 permits idle and does not search roadmap, chat, or FUTURE. Genuinely new product/architecture selection remains GOV-OS-02 Next-Work Selection Protocol. GOV-OS-03 never invents work.

### Shared-contract freeze / change protocol

If two lanes depend on a shared API / schema / auth / session / tool / config contract, that contract must be frozen before parallel execution.

Implementation workers may not silently change a frozen contract.

If a contract change becomes necessary:

1. stop affected lane(s)
2. return to control plane
3. perform bounded contract / governance change
4. re-freeze
5. reassess admission

### Revert / evidence isolation

Parallel work is allowed only if reverting one lane does not invalidate the other lane’s implementation evidence.

Before LOCK:

- the integrated tree contains the correct surviving lane state
- relevant integrated tests are rerun
- another lane’s LANE-DONE evidence remains valid after integration / revert

### Lean future registration metadata

Required near-frontier task metadata after GOV-OS-01:

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
- saturationClass (`FORCING` or `OPTIONAL`; mandatory for newly registered implementation tasks after GOV-OS-03 LOCK; no default)
- machine candidate record in `docs/control-plane/lane-saturation-state.json` (implementation tasks only; not a scheduler)

Evidence class values: LOCAL-TESTS, LOCAL-RUNTIME, STAGING-RUNTIME, PROVIDER-LIVE.

Do **not** require Blocks, giant forbidden-scope essays, duplicated global CLAUDE rules, or huge conflict lists derivable from mutex / write scope.

Anything outside declared write scope is forbidden by default unless the control plane expands scope explicitly.

Do not mass-migrate historical tasks onto this template.

### New-window boot sequence

Deterministic process:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `TASKS.md` CURRENT EXECUTION BOARD ONLY (stop at the LEGACY / FROZEN boundary)
4. exact admitted TASK ID in `TASKS_BACKLOG_FULL.md`
5. named stage-start / checkpoint only where needed

If the TASKS board does not admit the task: **DO NOT START.**

`PRD.md` / `ARCHITECTURE.md`: read only where an already-admitted task’s scope requires product or technical authority.

If no admitted next product/architecture gate exists AND next work is being selected:

- apply the Next-Work Selection Protocol below
- do not start implementation
- do not select from chat, model, or window memory

This branch does not weaken admission, mutex, lane, or governance rules.

### Next-Work Selection Protocol

Standing anti-drift rule. Repository authority, not memory, drives next-work selection. This section does not admit work. `TASKS.md` remains the scheduler.

Apply at the **first** recommendation, selection, registration, or admission of genuinely new product/architecture work. A claim that the task was “already selected” outside the current board does not bypass this protocol.

**Trigger — apply when ALL are true:**

1. someone is proposing, recommending, choosing, or registering genuinely new PRODUCT or ARCHITECTURE work;
2. `TASKS.md` CURRENT EXECUTION BOARD does not already admit that work as the current gate;
3. the work is not already ACTIVE or LANE-DONE.

**Non-triggers — do not run the full protocol for:**

- implementation of already-admitted work
- validation of already-admitted work
- consolidation / checkpoint / lock of already-admitted work
- routine named-task continuation
- status questions
- mutex / lane / scheduler mechanics
- Lane 2 execution of an already-admitted pair
- routine control-plane lock or consolidation

If Keith explicitly names a new product/architecture task for registration: perform only the light CURRENT/FUTURE authority check needed for that named task; do not launch a broad frontier-selection audit.

**Mandatory targeted reads before recommending or registering genuinely new product/architecture work:**

1. `TASKS.md` CURRENT EXECUTION BOARD only — stop at LEGACY / FROZEN; inspect current gate, lanes, blockers, parked/prohibited state
2. `PRD.md` — targeted CURRENT / LIMITED PRIVATE-BETA / APPROVED FUTURE sections; living PRODUCT WHAT
3. `ARCHITECTURE.md` — Authority Notice; CURRENT vs PLANNED/FUTURE boundary; relevant subsystem only; living TECHNICAL HOW
4. `TASKS_BACKLOG_FULL.md` — SEARCH for an existing registered candidate; do not read the entire backlog unless genuinely necessary; reuse an existing canonical task rather than inventing a duplicate

Use targeted reads. Do not recreate GOV-PRD-02 / GOV-ARCH-02 every time.

**Conditional evidence — consult only when relevant:**

- latest relevant GOV-PRD / GOV-ARCH source map or checkpoint when the CURRENT-vs-FUTURE classification of a named candidate is genuinely disputed
- PRIVATE-BETA-GO-NO-GO evidence if invitation / beta rollout is proposed
- GOV-PARALLEL decision if Lane 3 / scheduler capacity is proposed
- named checkpoint / stage-start for a specific candidate
- `docs/AINOW-EXECUTION-ROADMAP.md` / `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` only as secondary historical context

Frozen source maps are NOT living authority. Locked checkpoints are NOT schedulers.

**Anti-drift prohibitions:**

Do not select next work from chat memory.
Do not select next work from model memory.
Do not select next work from window/session memory.

Do not select next work from:

- `docs/AINOW-EXECUTION-ROADMAP.md` Current Next Task
- `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md`
- `TASKS.md` below LEGACY / FROZEN
- frozen source maps
- locked checkpoint “next recommended” prose

Do not promote APPROVED FUTURE or GATED functionality into CURRENT product merely because code/plans exist.

Do not invent GOV-PRD-03, GOV-ARCH-03, a new roadmap, a new source map, or a new master plan merely because next work is not remembered.

Forgetting is not evidence of product or architecture drift.

A new reconciliation requires actual material drift/new evidence plus normal governance authorization.

An empty board is valid.

Do not invent a successor merely to fill available lane capacity.

If current authorities and backlog still leave multiple genuinely valid frontiers: present the bounded decision to Keith. Do not silently choose based on model preference.

**Output:**

Normally: a concise evidence-grounded recommendation, OR a bounded choice for Keith when genuine ambiguity remains.

List registered READY tasks, and NOT_READY tasks whose readiness condition is met or is Keith's decision. Plans and checkpoints are not sources: their follow-ups reach selection only through registration.

Not normally: another broad strategic audit, another reconciliation task, or another roadmap/source-map document.

### Record economy (GOV-OS-04)

This section changes how many records are made, not what they must prove.

- Registration and admission of one task are one record and one commit when the task is admitted at once.
- A task with evidence class LOCAL-TESTS: code and LOCK may be one commit, after the control plane has read the diff and rerun the gates. Tasks with any other evidence class keep a separate LOCK record.
- A live task that needs a fix pauses instead of returning to READY. The control plane sets `stagingAuthorized`, `providerLiveAuthorized` and `creditAuthorized` false and `runtimeAuthorization.liveWindowPaused` true in the sidecar. A LOCAL-TESTS task may then run in the other lane. The validator allows only that pair, and only while the marker is true and all three are false. LOCAL-RUNTIME beside a live lane stays refused. Mutex, write-scope and shared-contract checks still apply.
- A live lane with its flags off and no marker is not paused and does not make a LOCAL-TESTS candidate admissible. The marker comes off before any of the three goes back to true, which requires the other lane to be released first.
- Board lines state the current state only. They replace the old text and do not chain it. History lives in the backlog body, checkpoints and Git.
- The control plane may land its own records directly.

Unchanged: two implementation lanes, mutexes, the scheduler, admission rules, the validator at machine-relevant transitions, a checkpoint for every task, approval of drafts, Keith's live judgement, verification before commit.

### Tester window (GOV-OS-06)

A tester window lets a trusted person use staging with AI runs on while development continues.

- The window is a staging state, not a lane. The sidecar key `runtimeAuthorization.testerWindowOpen` is true while it is open; absent means false; any other value is MALFORMED. It holds no lane and no mutex. The board states it on one line.
- A registered task opens it. That task holds STAGING, ENV, PROVIDER-LIVE and CREDIT while it switches runs on, records the window's env file hashes, and locks with the window left open. A registered task closes it, holding STAGING and ENV, and returns the env files to their baseline hashes. The validator runs at both.
- While it is open, LOCAL-TESTS and LOCAL-RUNTIME tasks are admitted under the usual rules. STAGING-RUNTIME tasks (deploys) are admitted under the usual rules; they check the window's env hashes instead of the baselines, and their evidence says the tester may be active. Because the host deploy tool refuses while GLOBAL_EXECUTION_ENABLED is not false, a deploy during an open window also holds ENV: once nothing is running it saves the window gateway.env, switches GLOBAL_EXECUTION_ENABLED off for the deploy only, deploys, then restores the saved file byte for byte and checks the window hashes and that runs are back on. Keith is told first that runs pause for a few minutes (GOV-DEPLOY-WINDOW-01).
- While it is open, a task whose evidence class is PROVIDER-LIVE, or whose mutexes or runtime needs include PROVIDER-LIVE or CREDIT, is refused with TESTER_WINDOW_OPEN, as a candidate and in a lane. Close the window first.

Unchanged: two implementation lanes, mutexes, the scheduler, admission rules, the existing pair rules, saturation, the GOV-OS-04 pause rule, and Keith's approval of every record.

### Rule checklists (GOV-OS-07)

Rules that a machine or a required line checks get followed; rules that live only as prose get missed. So:

- `docs/control-plane/task-checklists.md` holds short checklists by task type (EVERY, UI, FLOWS, BACKEND, MIGRATION, DEPLOY, LIVE, READINESS, GOVERNANCE). Each item names its CLAUDE.md section or is marked GOV-OS-07; items marked GOV-OS-07 are rules of this section. If the file and CLAUDE.md differ, CLAUDE.md wins, and a CLAUDE.md change that affects a list updates the file in the same record.
- A brief for Cursor or another worker copies the lists for its task type from that file, never from an earlier brief.
- Every checkpoint carries one line `CHECKLIST: <list> <met>/<total>, ...` naming each list that applies. An item counted as not applicable states why. The control plane reads the line together with the diff before LOCK.
- A condition that must hold before a named milestone (for example before a second user) is listed where that milestone's readiness is tracked, in the same record that names it.

Unchanged: lanes, mutexes, the scheduler, admission rules, the validator, saturation, the record economy, the tester window, and Keith's approval of every record.

---

## Project Governance Loop

Product-work sequencing loop (not a scheduler; not a global file-rank that overrides domain authority):

```text
PRD → ARCHITECTURE → TASKS_BACKLOG_FULL → TASKS → CHECKPOINTS → CODE → CHECKPOINTS/TASKS
```

Rules:

- No code may be written without an admitted task on the TASKS board.
- No task may be completed without a checkpoint.
- No checkpoint may exist without a source task.
- Every follow-up named in a plan, decision record, stage-start, checkpoint, review or live-run finding, or approved by Keith in chat, gets exactly one disposition before the naming task's lifecycle ends (LOCK, REJECTED, RETURN-TO-READY or Keith's drop), or in the same control-plane record when no task names it:
  1. **Registered** in `TASKS_BACKLOG_FULL.md` and, for implementation tasks, in the sidecar as status=READY, startCondition=NOT_READY, not admitted. The body states what makes it READY and who decides. Keith names its saturationClass. productClass follows PRD (APPROVED_FUTURE stays APPROVED_FUTURE). Undesigned work uses writeSetPrecision=PROVISIONAL with admissionUncertain=true.
  2. **Superseded** by a named task and acceptance criterion, with any remainder registered.
  3. **Dropped** by Keith: one line with date and reason in the backlog's Dropped follow-ups list.
- "Not registered" is not a disposition. The closing record carries `FOLLOWUPS: n registered / n superseded / n dropped / 0 undisposed`.
- Dispositions for follow-ups named in locked documents are recorded in the backlog and in the deciding checkpoint. The locked documents are not edited.
- "Do not register X" in a task body limits that task's own write step only, unless Keith recorded X as PARKED or PROHIBITED.
- The TASKS.md CURRENT EXECUTION BOARD is the only current scheduler.
- `TASKS_BACKLOG_FULL.md` is the canonical task registry.
- Control-plane end status is mirrored into board fields and the canonical backlog body. Do not full-body mirror. Do not append to Program Status.
- Completed work must be marked `COMPLETE and LOCKED` by the control plane after required integration / evidence.
- Locked tasks must not be edited except for explicitly approved documentation correction.
- No undocumented work is permitted.
- If scope changes materially, update governance docs before implementation.

If governance conflicts with convenience, governance wins.

---

## Task Workflow Rules

Preserve the existing 2 / 3 / 4 model. Parallelism changes scheduling, not quality discipline.

### Tiny implementation / obvious fix
Use a 2-step loop:

1. Implementation
2. Consolidation/checkpoint

### Normal bounded feature or bug fix
Use a 3-step loop:

1. Registration or activation
2. Implementation
3. Consolidation/checkpoint

### Risky, architectural, security-sensitive, governance, migration, or ambiguous work
Use a 4-step loop:

1. Registration
2. Stage-start / triage / plan
3. Implementation
4. Consolidation/checkpoint

Always prefer smaller bounded child slices over large mixed changes.

Do not fix two unrelated issues at once. Register or defer follow-up issues.

Each admitted implementation lane still contains only one bounded implementation task.

---

## New Window Rules

Open a NEW Cursor window when starting a new task lifecycle.

For high-risk or context-heavy work, also use a fresh window for major lifecycle transitions such as:

- stage-start / freeze
- implementation after a substantial stage-start
- validation / live smoke when context isolation matters
- consolidation / checkpoint

Also open a new window for:

- Heavy context or slow Cursor sessions
- Security-sensitive or architecture-heavy work
- Any time Cursor shows `Append data exceeds maximum size of 52428800 bytes`

Same-window continuation is acceptable only for the exact same tiny follow-up within an already-started task where context remains small and unambiguous.

These window rules apply to Cursor runs. Subagent runs happen inside the control-plane session.

Fresh windows must always follow the deterministic boot sequence: `AGENTS.md` → `CLAUDE.md` → `TASKS.md` CURRENT EXECUTION BOARD → exact admitted TASK ID in `TASKS_BACKLOG_FULL.md`.

### Subagent implementers (GOV-OS-08)

The control plane may run an admitted task's implementation as a Claude subagent instead of Cursor. A subagent implementer:

- gets the same self-contained brief a Cursor run gets (boot sequence, write scope, checklists copied from `docs/control-plane/task-checklists.md`, gates, stop conditions, report contract);
- works in its own git worktree (see Git / Operator Rules) unless the task changes only records;
- is reviewed the same way: the control plane reads the diff, reruns the gates and never accepts the self-report;
- has the same limits as any implementation worker: no records, board, registry, sidecar or governance files; no admission or mutexes; no push; it never spawns further subagents.

A subagent is a worker, not a second control plane. Spawning one does not add a lane: each admitted lane still holds one task, and Lane 3 stays disabled.

---

## Model Routing

Last reviewed: 2026-11-09

Cursor runs:

- **Implementation:** grok-4.7-high
- **grok-4.7-xhigh** only for:
  - hard / risky implementation
  - difficult debugging
  - unclear root cause
  - migration / data-integrity-sensitive work
  - architecture-heavy implementation
  - after High has failed or repeatedly made mistakes
- **Registration / consolidation:** grok-4.7-high
- **High-risk independent architecture / review:** Opus may be used when justified
- Always pass the model explicitly. Never use Auto.

Choosing the worker (GOV-ROUTING-01):

- Default to a Claude subagent for tasks with evidence class LOCAL-TESTS.
- Use a Cursor desktop prompt for anything that needs Keith's browser or console sign-in, and Cursor CLI when Keith asks for it or for a second opinion.

Claude subagent model (GOV-ROUTING-01):

- **sonnet (Sonnet 5.5):** 3-step slices in one service or in the frontend, with no migration, auth, security, frozen-contract or cross-service change (UI copy and layout, small bug fixes, tests only).
- **opus (Opus 5.5):** 4-step tasks; anything touching auth, guards, CSRF, credentials, encryption, migrations, a frozen shared contract, internal routes, child processes or data deletion; cross-service changes; every independent review.
- **fable (Fable 5.1):** design and planning documents and stage-start drafts; architecture-heavy slices; hard implementation, unclear root causes, or work where opus failed.
- When unsure between two, take the stronger. The model is passed explicitly in the Agent call and never inherited. The brief names the model and the reason, Keith hears them in one line before the dispatch, and the checkpoint records the model used.

Do not duplicate this table in `AGENTS.md`, the TASKS board, or every future task body.

Stay cost-aware. Do not use stronger models for routine bounded edits.

---

## Git / Operator Rules

- Keith / user owns Git.
- Implementation workers never push, never merge, never commit to `main` and never create, switch or delete branches or worktrees themselves.
- Worktree isolation (GOV-OS-08): the control plane may give an admitted task its own git worktree on its own branch (`lane/<TASK-ID>`), created from the current `main`. The worker edits files only there. A Claude subagent worker may commit on that branch; a Cursor worker runs no git (at most `git status --short`), and the control plane commits on the branch for it.
- Only the control plane brings a branch into `main`: it reads the diff, reruns the gates on the branch, then merges with `git merge --ff-only`; if `main` has moved since the branch was cut, it cherry-picks the branch's commits onto `main` instead (rebase stays denied). It then reruns the gates on `main` where the task's evidence needs it, and removes the worktree and the branch. No merge commits, no force push.
- Worktree procedure (GOV-ROUTING-01): worktrees live in `C:\Users\knlee\aisb-worktrees\<TASK-ID>`. `node_modules` is linked from the main checkout (Windows junctions for the root and for each workspace that has its own) and unlinked before the worktree is removed, so removing the worktree never touches the main checkout's packages. An abandoned branch is deleted with `git branch -D lane/<TASK-ID>`.
- Worktrees do not change admission: two lanes, the same mutexes, write-set and HOTFILE conflicts, PACKAGE and I18N leases all still apply, because conflicting branches would clash when merged.
- The control plane commits and pushes only work Keith has authorized, after reading the diff and rerunning the gates.
- Do not include commit / push steps in routine prompts unless explicitly asked.

---

## Commands and Shell Rules

Use Windows PowerShell 5.x only.

- Use full Windows filesystem paths.
- Do not use CMD.
- Do not require PowerShell 7.

Preferred command style:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test
```

Do not start dev servers unless explicitly instructed.

---

## Runtime / Live-Smoke Rules

Do not perform destructive database operations.
Do not run `docker compose down -v`.

Do not start Docker, PostgreSQL, Redis, migrations, application servers, or other local runtime infrastructure unless the admitted active task explicitly requires that runtime.

When runtime is required, state the requirement before implementation / validation and use only the resources authorized by the active task.

Do not assume Docker, PostgreSQL, or Redis are running.

Browser / live smoke that requires interactive / user-controlled behavior must explicitly involve Keith unless browser automation has been enabled and specifically requested.

Do not falsely claim live-smoke success.

---

## Multilingual-First UX/UI Rule

For all aiSandBox2026B UX/UI work, multilingual support is a top priority.

Any new or changed user-facing UI text must be implemented multilingual-first:

- Add or update keys in:
  - `C:\Users\knlee\aiSandBox2026B\frontend\messages\en.json`
  - `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-TW.json`
  - `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-CN.json`
- Use the existing translation hook/pattern.
- Do not add hardcoded English UI copy unless explicitly approved as temporary developer/debug-only text.
- Tests or source assertions should verify translation keys or rendered translated copy where practical.

This applies to empty states, loading, error, warning, and success messages, buttons, labels, tabs, headings, form text, chat/system status messages, auth-module UX copy, checkpoint/history/revert UX copy, mobile/responsive UI copy, tooltips, help text, banners, and inline guidance.

If a UX/UI task proposes new visible text without i18n updates, stop and revise the scope before implementation.

---

## Icons

Normal UI icons: Heroicons v2 Outline.

---

## UX/UI Work Rules

UX/UI work must be bounded and reversible.

UI briefs name both advisory skills, which live in `.agents/skills/impeccable` and `.agents/skills/emil-design-eng`. The worker reads them before changing UI, and the checkpoint says what was applied or why not:

- Impeccable: broad UI/UX audit, visual hierarchy, spacing, anti-slop polish.
- Emil Kowalski design engineering: component polish, interaction quality, motion restraint, empty/loading/error states.

Once `DESIGN.md` exists, UI work follows it. Like the skills, it is advisory and never overrides the list below.

These skills are advisory only and must never override:

- `PRD.md`
- `ARCHITECTURE.md`
- `CLAUDE.md`
- registered / admitted scope
- tests

UX/UI tasks must not introduce broad redesigns, routing changes, backend work, new dependencies, or architecture refactors unless explicitly approved.

---

## Common Validation Commands

Frontend:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run build
git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo
```

API Gateway:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build
```

Container Manager:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm test
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm run build
```

When `npm run build` updates `frontend/tsconfig.tsbuildinfo`, restore it unless that artifact change is explicitly intended.

---

## Source and Scope Rules

Workers must:

- Only work on the admitted task/module explicitly specified by the user and present on the TASKS board.
- Stop after the assigned task is complete.
- Never refactor unrelated code unless explicitly requested.
- Ask before adding dependencies.
- Avoid architectural changes unless explicitly approved.
- Keep changes minimal and reversible.
- Preserve existing test IDs unless the task explicitly changes them.
- Add or update tests for behavior changes.
- Report exact files changed and validation results.

Workers must not:

- Register unrelated follow-up work inside the current implementation step.
- Hide failures or claim validation passed without running it.
- Convert a bug fix into a broad redesign.
- Modify locked tasks unless explicitly approved.
- Touch production source files during consolidation-only steps.

---

## Architecture and Document Loading Rules

When asked to use large governance docs:

- Read targeted sections only.
- Do not paste entire files.
- Summarize only the relevant section.
- Do not load broad docs unnecessarily in implementation steps.

For new windows, use the deterministic boot sequence. List only the needed files.

---

## Internal API Endpoints

The following API Gateway endpoints are internal service endpoints and must not be treated as public external APIs.

### Session Lifecycle
Container-manager → api-gateway:

```text
POST /api/internal/sessions/:sessionId/start
POST /api/internal/sessions/:sessionId/stop
POST /api/internal/sessions/:sessionId/error
```

### Git Checkpoint Ledger
Container-manager → api-gateway:

```text
POST /api/internal/git-checkpoints
```

Internal service endpoints must preserve existing internal authentication and guard behavior. Do not expose them to the frontend or external users.

Do not change internal route security, guard strategy, or service identity behavior unless the active task explicitly authorizes it.

---

## Auth and Security Rules

Do not alter platform auth, session cookies, CSRF behavior, internal service keys, guards, or authorization logic unless the active task explicitly requires it.

Generated apps must remain isolated from aiSandBox platform auth:

- Do not reference `aisandbox_session`.
- Do not reference `aisandbox_csrf`.
- Do not reference `aisandbox_oauth_state`.
- Do not reuse `X-Internal-Service-Key`.
- Do not import platform guards or platform auth services into generated app templates.

Platform auth and generated-app auth are separate systems.

---

## Checkpoint and Revert Rules

Checkpoint integrity is production-critical.

- Preserve existing checkpoint creation, listing, and revert behavior unless the active task targets it.
- Revert must restore workspace files, editor state, file tree, preview, and checkpoint list.
- Do not add a parallel undo system unless explicitly approved.
- Do not bypass confirmation flows for risky file actions.
- Any checkpoint/revert change requires tests and live smoke where practical.

---

## AI Workspace File-Action Rules

AI-proposed file changes must use the existing file-action flow.

Do not bypass:

- file-action parsing
- risky batch confirmation
- apply-once guards
- sequential file writes
- post-action coherence
- checkpoint creation
- refresh of file tree/editor/preview/checkpoints

Do not introduce direct DOM rollback, direct workspace mutation, or unconfirmed auto-apply paths unless explicitly approved.

---

## Testing and Validation Rules

Before claiming success:

- Run the validation commands relevant to the changed files.
- Report exact command results.
- Report known environmental failures separately from code failures.
- Use live browser smoke for UI flows that cannot be proven by tests, subject to the runtime / live-smoke rules above.
- Do not mark tasks complete if required live smoke is blocked and the task acceptance criteria require it.

When a validation artifact changes unintentionally, restore it.

---

## Diff Output Rule

When showing code changes, use standard unified diff format.

Requirements:

- Use `git diff` style.
- Start with `diff --git a/... b/...`.
- Include `---` and `+++`.
- Include `@@` hunk headers.
- Keep context to about 3 lines.
- Do not reprint whole files.
- Do not describe changes as separate deleted/added blocks.

---

## Final Authority Clause

This file is authoritative in the DEVELOPMENT OS / RULES domain.

It does not override `PRD.md` (PRODUCT WHAT) or `ARCHITECTURE.md` (TECHNICAL HOW).
The `TASKS.md` board cannot violate this file’s admission / mutex / lifecycle rules.
This file cannot admit or schedule a task.

If any instruction conflicts with:

- convenience refactors
- broad AI helpfulness
- implementation assumptions
- unregistered scope
- shortcuts around validation or governance

this file’s OS / rules domain wins.
