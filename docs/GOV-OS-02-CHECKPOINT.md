# GOV-OS-02 — Permanent Next-Work Selection Protocol — Final Checkpoint

**Task ID:** GOV-OS-02
**Title:** Permanent Next-Work Selection Protocol
**Step:** 3 — Independent Verification + Checkpoint + Final Lock
**Checkpoint Date:** 2026-08-28
**Final Verdict:** COMPLETE AND LOCKED — PASS — 2026-08-28
**Nature:** GOVERNANCE / DEVELOPMENT OS / ANTI-DRIFT
**Lifecycle:** 3-step (Step 1 registration — Step 2 install bounded OS/bootstrap/board changes — Step 3 independent verification + checkpoint + final lock)

---

## 1. Task / lifecycle identity

| Field | Value |
|---|---|
| Task ID | GOV-OS-02 |
| Title | Permanent Next-Work Selection Protocol |
| Family | GOVERNANCE / DEVELOPMENT OS / ANTI-DRIFT |
| Predecessor | GOV-OS-01 COMPLETE AND LOCKED — PASS — 2026-08-18; GOV-PARALLEL-01 COMPLETE AND LOCKED — PASS — 2026-08-27 |
| Step | 3 — Independent Verification + Checkpoint + Final Lock |
| Completion date | 2026-08-28 |
| Step 3 window | independent verification only — this window did not implement Step 2 |
| Stage-start | NOT REQUIRED (implementation contract frozen at Step 1) |

## 2. Base / implementation HEAD evidence

```
GOV_OS_02_STEP_3_BASE_HEAD = cad5bd1f97879cbc0e7e3c57944bbda8d86d3015
BRANCH = main
INITIAL_TREE = CLEAN
```

| Step | HEAD | Commit | Write set |
|---|---|---|---|
| Step 1 registration | `9dc5ad2fab2eef10d9597b1ef44a3a6f8eedc340` | `1fca74b register GOV-OS-02 next-work selection protocol` | `TASKS.md`, `TASKS_BACKLOG_FULL.md` |
| Step 2 implementation | `cad5bd1f97879cbc0e7e3c57944bbda8d86d3015` | `cad5bd1 install permanent next-work selection protocol` | `AGENTS.md`, `CLAUDE.md`, `TASKS.md` |
| Step 3 open | `cad5bd1f97879cbc0e7e3c57944bbda8d86d3015` | same as Step 2 (committed; tree CLEAN) | none until this lock |

Git at Step 3 open: `git branch --show-current` = `main`; `git status --short` empty; latest HEAD is the Step 2 implementation commit affecting `AGENTS.md`, `CLAUDE.md`, `TASKS.md`.

## 3. Step 1 registration result

Step 1 (2026-08-28) froze the implementation contract in `TASKS_BACKLOG_FULL.md` and admitted GOV-OS-02 as GOVERNANCE owner:

- Exact trigger frozen (three conjuncts; cannot be bypassed by “already selected” outside the current board)
- Non-triggers frozen
- Living mandatory authority set frozen
- Conditional evidence set frozen
- Source-map / historical-document authority classification frozen
- Anti-memory prohibitions frozen
- Anti-reaudit prohibition frozen
- Empty-board-valid invariant frozen
- Invitation and Lane 3 invariants unchanged
- Lifecycle = 3-step; stage-start NOT REQUIRED
- Step 2 exact write set frozen: `CLAUDE.md`, `AGENTS.md`, `TASKS.md`
- No product frontier selected
- No CLAUDE.md / AGENTS.md / PRD.md / ARCHITECTURE.md / source-map / source change in Step 1

**STEP_1_RESULT = COMPLETE — PASS — 2026-08-28**

## 4. Step 2 implementation result

Committed HEAD `cad5bd1f97879cbc0e7e3c57944bbda8d86d3015` (`install permanent next-work selection protocol`).

Exact Step 2 write set (verified `git show --name-status`):

```
M AGENTS.md
M CLAUDE.md
M TASKS.md
```

3 files changed, 99 insertions, 10 deletions. No other files in the commit.

Step 2 installed:

- Standing `Next-Work Selection Protocol` in `CLAUDE.md` Development OS / control-plane area, immediately after the new-window boot sequence
- Missing new-window boot branch: if no admitted next product/architecture gate exists AND next work is being selected → apply protocol; do not start implementation; do not select from memory
- Thin `AGENTS.md` boot-sequence pointer (step 4) plus standing anti-memory sentence
- Persistent CURRENT EXECUTION BOARD flag: `NEXT-WORK SELECTION PROTOCOL = MANDATORY` pointing to `CLAUDE.md`

**STEP_2_RESULT = COMPLETE — PASS — 2026-08-28**

## 5. Step 3 independent verification

This window independently verified the committed Step 2 tree against the frozen Step 1 contract. No protocol redesign. No silent Step 2 repair. `AGENTS.md` and `CLAUDE.md` were not edited in Step 3.

**STEP_3_INDEPENDENT_VERIFICATION = PASS**

## 6. Installed trigger

Standing section `### Next-Work Selection Protocol` exists in `CLAUDE.md` at the Development OS / Parallel Control Plane v1 area, immediately after `### New-window boot sequence`. A fresh window that follows boot logic encounters the protocol from the boot branch before any product/architecture selection.

Trigger applies when ALL are true:

1. genuinely new PRODUCT or ARCHITECTURE work is being proposed, recommended, chosen, or registered
2. `TASKS.md` CURRENT EXECUTION BOARD does not already admit that work as the current gate
3. the work is not already ACTIVE or LANE-DONE

The protocol applies at the **first** recommendation, selection, registration, or admission. A claim that the task was “already selected” outside the current board does not bypass this protocol.

**TRIGGER_VERIFIED = YES**

## 7. Non-triggers

The installed full protocol does not unnecessarily run for:

- implementation of already-admitted work
- validation of already-admitted work
- consolidation / checkpoint / lock of already-admitted work
- routine named-task continuation
- status questions
- mutex / lane / scheduler mechanics
- Lane 2 execution of an already-admitted pair
- routine control-plane lock or consolidation

If Keith explicitly names a new product/architecture task for registration: only a light CURRENT/FUTURE authority check for that named task; no broad frontier-selection audit.

**NON_TRIGGERS_VERIFIED = YES**

## 8. Living authority set

Mandatory targeted reads when the trigger fires:

1. `TASKS.md` CURRENT EXECUTION BOARD only — stop at LEGACY / FROZEN — current scheduler
2. `PRD.md` — targeted CURRENT / LIMITED PRIVATE-BETA / APPROVED FUTURE — living PRODUCT WHAT
3. `ARCHITECTURE.md` — Authority Notice; CURRENT vs PLANNED/FUTURE; relevant subsystem — living TECHNICAL HOW
4. `TASKS_BACKLOG_FULL.md` — SEARCH for an existing registered candidate — canonical task registry

Targeted reads are explicitly preferred. “Use targeted reads. Do not recreate GOV-PRD-02 / GOV-ARCH-02 every time.” “Do not read the entire backlog unless genuinely necessary.”

**LIVING_AUTHORITY_SET_VERIFIED = YES**

## 9. Conditional evidence set

Consult only when relevant; not standing living authority:

- GOV-PRD / GOV-ARCH source maps and checkpoints when CURRENT-vs-FUTURE classification is genuinely disputed
- PRIVATE-BETA-GO-NO-GO evidence if invitation / beta rollout is proposed
- GOV-PARALLEL decision if Lane 3 / scheduler capacity is proposed
- named checkpoint / stage-start for a specific candidate
- `docs/AINOW-EXECUTION-ROADMAP.md` / `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` as secondary historical context only

```
FROZEN_SOURCE_MAPS_ARE_LIVING_AUTHORITY = NO
LOCKED_CHECKPOINTS_ARE_SCHEDULERS = NO
HISTORICAL_ROADMAP_SCHEDULER_AUTHORITY = NO
AINOW_EXECUTION_ROADMAP_CURRENT_NEXT_TASK_AUTHORITY = NO
AGENT_PLATFORM_00_SCHEDULER_AUTHORITY = NO
TASKS_LEGACY_FROZEN_SELECTION_AUTHORITY = NO
```

Installed wording: “Frozen source maps are NOT living authority. Locked checkpoints are NOT schedulers.” Historical roadmap / Platform-00 appear only as secondary historical context and are listed under “Do not select next work from.”

**CONDITIONAL_EVIDENCE_VERIFIED = YES**

## 10. Anti-memory prohibition

Installed as standing prohibitions, not recommendations:

```
Do not select next work from chat memory.
Do not select next work from model memory.
Do not select next work from window/session memory.
```

`AGENTS.md`: “Do not select next product/architecture work from chat, model, or window memory.”

`CLAUDE.md` boot branch: “do not select from chat, model, or window memory.”

`TASKS.md` persistent flag: “Do not select from chat/model/window memory.”

No alternative wording weakens this into a preference. Repository authority, not conversational memory, controls selection. The protocol states: “Repository authority, not memory, drives next-work selection.”

```
NEXT_WORK_FROM_CHAT_MEMORY = PROHIBITED
NEXT_WORK_FROM_MODEL_MEMORY = PROHIBITED
NEXT_WORK_FROM_WINDOW_MEMORY = PROHIBITED
```

**ANTI_MEMORY_VERIFIED = YES**

## 11. Anti-reaudit prohibition

Installed:

- Do not invent GOV-PRD-03, GOV-ARCH-03, a new roadmap, a new source map, or a new master plan merely because next work is not remembered
- Forgetting is not evidence of product or architecture drift
- A new reconciliation requires actual material drift/new evidence plus normal governance authorization
- Output is normally a concise evidence-grounded recommendation or a bounded Keith decision — not another broad strategic audit / reconciliation / roadmap / source-map document
- `TASKS.md` persistent flag: “Do not start another product/architecture reconciliation merely because next work is unknown”

```
FORGETTING_IS_NOT_DRIFT_EVIDENCE = YES
UNKNOWN_NEXT_WORK_DOES_NOT_REQUIRE_NEW_RECONCILIATION = YES
```

**ANTI_REAUDIT_VERIFIED = YES**

## 12. Empty-board-valid invariant

Installed:

- An empty board is valid
- Do not invent a successor merely to fill available lane capacity
- If current authorities and backlog still leave multiple genuinely valid frontiers: present the bounded decision to Keith; do not silently choose based on model preference

```
EMPTY_BOARD_IS_VALID = YES
```

Available lane capacity does not create a requirement to fill lanes. Confirmed by standing CLAUDE.md rule: “Capacity 2 is a maximum, not a requirement to fill both lanes.”

**EMPTY_BOARD_VERIFIED = YES**

## 13. CLAUDE.md new-window boot branch

Installed immediately after the existing admitted-task boot steps:

```
If no admitted next product/architecture gate exists AND next work is being selected:
- apply the Next-Work Selection Protocol below
- do not start implementation
- do not select from chat, model, or window memory

This branch does not weaken admission, mutex, lane, or governance rules.
```

Existing admitted-task boot remains intact: AGENTS → CLAUDE → CURRENT BOARD → exact admitted TASK ID; if the board does not admit the task: **DO NOT START.** `PRD.md` / `ARCHITECTURE.md` are read only where an already-admitted task’s scope requires product or technical authority (tightened, not weakened).

Admission / mutex / lane / governance rules were not weakened. Lane 3 remains DISABLED. MAX_IMPLEMENTATION_LANES remains 2. Standing-governance anti-drift rule unchanged.

**BOOT_BRANCH_VERIFIED = YES**
**ADMISSION_MUTEX_LANE_GOVERNANCE_NOT_WEAKENED = YES**

## 14. AGENTS.md thin-bootstrap result

`AGENTS.md` remains a thin bootstrap. It does not duplicate the full protocol or the four-file checklist.

Boot step 4:

```
If the board does not admit the requested product/architecture work and the user is selecting genuinely new next work: do not start implementation; follow CLAUDE.md "Next-Work Selection Protocol"; do not select from chat, model, or window memory.
```

Boot step 5 remains: if the task is not admitted: **DO NOT START.**

**AGENTS_THIN_BOOTSTRAP_VERIFIED = YES**
**AGENTS_DOES_NOT_DUPLICATE_PROTOCOL = YES**

## 15. TASKS.md persistent-flag result

CURRENT EXECUTION BOARD (line 7, above LEGACY / FROZEN) contains:

```
NEXT-WORK SELECTION PROTOCOL = MANDATORY
```

It points to `CLAUDE.md` “Next-Work Selection Protocol”. It does not duplicate the protocol. It does not name Knowledge, Collaboration, Harness, OAuth, Stripe, invitations, or any other product frontier as next.

Current next product gate remains: no admitted next product gate / selection pending. GOV-OS-02 is GOVERNANCE anti-drift, not a product-frontier selection, and does not fill that gate.

**TASKS_PERSISTENT_FLAG_VERIFIED = YES**
**NO_PRODUCT_FRONTIER_NAMED_AS_NEXT = YES**

## 16. Recurrence test

Scenario reasoned using only the installed repository rules.

A fresh model opens a new window. Board: Lane 1 EMPTY, Lane 2 EMPTY, no admitted next product gate. Keith asks: “What should we work on next?”

Forced path:

1. Do not answer from chat / model / window memory (`AGENTS.md`, `CLAUDE.md` boot branch, protocol anti-memory prohibitions, board flag)
2. Do not start implementation (boot branch + AGENTS step 4)
3. Inspect CURRENT EXECUTION BOARD only (stop at LEGACY / FROZEN)
4. Targeted `PRD.md` read (living PRODUCT WHAT)
5. Targeted `ARCHITECTURE.md` read (living TECHNICAL HOW)
6. `TASKS_BACKLOG_FULL.md` candidate search
7. Conditional evidence only if necessary
8. Evidence-grounded recommendation OR bounded Keith decision
9. Only afterward may registration / admission occur (protocol does not admit work; `TASKS.md` remains the scheduler)

Prohibited:

- guessing Knowledge from memory
- guessing Harness from memory
- jumping to invitations (`INVITATION_EXECUTION_PERMITTED=NO`; PRIVATE-BETA-INVITE-01 PARKED)
- resurrecting historical roadmap Current Next Task
- creating a new reconciliation merely because next work was forgotten
- automatically filling both implementation lanes (empty board is valid)

```
RECURRENCE_PATH_BLOCKED = YES
```

If this had been NO, Step 3 would have STOPPED without lock.

## 17. Exact Step 2 write set

```
C:\Users\knlee\aiSandBox2026B\AGENTS.md
C:\Users\knlee\aiSandBox2026B\CLAUDE.md
C:\Users\knlee\aiSandBox2026B\TASKS.md
```

Not in Step 2 commit: `PRD.md`, `ARCHITECTURE.md`, `TASKS_BACKLOG_FULL.md`, source maps, locked checkpoints, application source, package files, env, compose, dependencies, runtime configuration. No new roadmap / source map / master plan.

**STEP_2_WRITE_SET_EXACT = YES**

## 18. Invitation invariant

```
PRIVATE-BETA-INVITE-01 = PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
INVITATION_EXECUTION_PERMITTED = NO
```

Unchanged across all three GOV-OS-02 steps. No invitation work registered or started.

**INVITATION_INVARIANT_PRESERVED = YES**

## 19. Lane 3 invariant

```
Lane 3 = DISABLED
LANE3_DECISION = KEEP_DISABLED_UNTIL_FUTURE_MATERIAL_NEED
MAX_IMPLEMENTATION_LANES = 2
```

Unchanged. GOV-PARALLEL-01 remains COMPLETE AND LOCKED — PASS — 2026-08-27. No scheduler-capacity change.

**LANE3_INVARIANT_PRESERVED = YES**

## 20. Next product gate / no frontier selected

```
Current next product gate = no admitted next product gate / selection pending
GOV_OS_02_NOT_PRODUCT_FRONTIER = YES
GOV_OS_02_PRODUCT_GATE_SELECTED = NO
```

Step 3 did not select, recommend, register, or admit a next product task. Empty board remains valid.

**NO_PRODUCT_FRONTIER_SELECTED = YES**

## 21. Final lock state

```
GOV-OS-02 = COMPLETE AND LOCKED — PASS — 2026-08-28
Step 1 = COMPLETE
Step 2 = COMPLETE
Step 3 = COMPLETE
GOVERNANCE = UNOWNED
Lane 1 = EMPTY
Lane 2 = EMPTY
Lane 3 = DISABLED
ACTIVE_IMPLEMENTATION_LANES = 0/2
```

## 22. Step 3 activity ledger

```
LIVE = 0
SSH = 0
staging = 0
provider = 0
credits = 0
gates = 0
runtime = 0
Docker = 0
Postgres = 0
Redis = 0
dev servers = 0
browser smoke = 0
product implementation = 0
test implementation = 0
source changes = 0
dependencies = 0
migrations = 0
Git mutations = 0
tests executed = 0
PRD.md edits = 0
ARCHITECTURE.md edits = 0
CLAUDE.md edits = 0
AGENTS.md edits = 0
scheduler capacity changes = 0
Lane 3 enablement = 0
Lane 3 = DISABLED
invitation registration = 0
new work registration = 0
product-frontier selection = 0
source-map edits = 0
roadmap / master-plan created = 0
subagents = 0
worktrees = 0
```

Allowed Step 3 writes: this checkpoint, `TASKS.md` CURRENT EXECUTION BOARD lock fields, `TASKS_BACKLOG_FULL.md` GOV-OS-02 final status.

Keith owns Git. No Git mutations by this step.

## 23. Final PASS/FAIL

Independent verification of the committed Step 2 implementation against the registered Step 1 contract: **PASS**.

All lock criteria satisfied. Recurrence path blocked. Protocol installed. Living PRD/ARCHITECTURE authority drives new product/architecture selection. Forgetting what comes next is not evidence of strategic drift.

**FINAL_VERDICT = COMPLETE AND LOCKED — PASS — 2026-08-28**

---

*Locked 2026-08-28 — GOV-OS-02 Step 3 — independent verification PASS — RECURRENCE_PATH_BLOCKED=YES — FORGETTING_IS_NOT_DRIFT_EVIDENCE=YES — EMPTY_BOARD_IS_VALID=YES — NEXT-WORK SELECTION PROTOCOL MANDATORY — current next product gate remains selection pending / no admitted next product gate — Lane 1 EMPTY — Lane 2 EMPTY — Lane 3 DISABLED — MAX_IMPLEMENTATION_LANES=2 — PRIVATE-BETA-INVITE-01 PARKED — GOVERNANCE released UNOWNED — GOV-OS-02 COMPLETE AND LOCKED — PASS — 2026-08-28.*
