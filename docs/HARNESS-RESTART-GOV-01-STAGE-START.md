# HARNESS-RESTART-GOV-01 — Stage-Start / Decision Freeze

**Task ID:** HARNESS-RESTART-GOV-01
**Title:** Decide the safe path to resume Harness after Builder completion
**Step:** 4 — independent verification / checkpoint / lock
**Step status:** Step 1 COMPLETE — 2026-09-17 (registration `8eb40707c1dfdc903354c1c3b88049030b7b63a4` `docs: register harness restart governance`); Step 2 COMPLETE — 2026-09-17 (freeze `2376ae8f6d30d0ac5ce2bb80a0b241f2a21efcca` `docs: freeze harness restart governance`); Step 3 COMPLETE — 2026-09-18 (decision `2a477b5aac78794e83894c772a6b84f8a47812bc` `docs: select harness fencing recovery direction`) — **OUTCOME_A under R1**; Step 4 COMPLETE AND LOCKED — 2026-09-18 — **OUTCOME_A / R1**
**Nature:** GOVERNANCE / DECISION — does NOT consume Lane 1 or Lane 2
**Risk:** HIGH (path selection after Builder closeout; EXEC-01C6A PM2 overlay blocker; product-visible Harness remains FUTURE/gated)
**Lifecycle:** 4-step GOVERNANCE
**Parent:** none. Not a child of AGENT-PLATFORM-EXEC-01C6A. Does **not** reopen EXEC-01C6A.
**This document:** Authoritative frozen A/B/C options, evidence thresholds, Step 3 selection matrix, the Step 3 selected-outcome record, and the Step 4 checkpoint / lock. It is not a scheduler. It does not admit EXEC-01C6A. Step 3 selected OUTCOME_A; Step 4 locks that GOVERNANCE decision. PASS means the freeze is satisfied. It does not establish a supported fence, authorize UNKNOWN_PENDING_OVERLAY recovery policy, or prove Harness recovery or activation.
**Exact next step after this freeze:** none authorized. This task is COMPLETE AND LOCKED. No successor is registered. EXEC-01C6A remains `startCondition=NOT_READY`.
**Step 2 base HEAD:** `8eb40707c1dfdc903354c1c3b88049030b7b63a4` (branch `main`; registration commit; occupancy EMPTY / GOVERNANCE UNOWNED)
**Step 3 base HEAD:** `2376ae8f6d30d0ac5ce2bb80a0b241f2a21efcca` (branch `main`; Step 2 freeze commit; occupancy EMPTY / GOVERNANCE UNOWNED)
**Step 4 base HEAD:** `2a477b5aac78794e83894c772a6b84f8a47812bc` (branch `main`; Step 3 decision commit; occupancy EMPTY / GOVERNANCE UNOWNED)
**Occupancy hash (end-state):** `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d` (Lane 1 EMPTY, Lane 2 EMPTY, GOVERNANCE UNOWNED)

Step 2 remains a bounded, local, read-only decision freeze. It did **not** select an outcome.

Step 3 independently applied the frozen §7 matrix and recorded exactly one outcome: **OUTCOME_A under R1**. Step 4 independently verified that record and locked it. The lock does **not** reopen EXEC-01C6A. It does **not** change sidecar `startCondition=NOT_READY`. It does **not** register a fencing/recovery successor. It does **not** establish that a supported fence exists. It does **not** authorize UNKNOWN_PENDING_OVERLAY recovery policy. It does **not** create an operator bundle, implementation code, or runtime procedure. It does **not** authorize live canary, PM2 overlay, staging, runtime mutation, or operator-bundle change.

```
STEP1_COMPLETE=YES
STEP2_COMPLETE=YES
STEP3_AUTHORIZED=YES
STEP3_COMPLETE=YES
STEP4_AUTHORIZED=YES
STEP4_COMPLETE=YES
LOCKED=YES
OUTCOME_SELECTED=OUTCOME_A
MATRIX_ROW=R1
EXEC_01C6A_REOPENED=NO
EXEC_01C6A_START_CONDITION=NOT_READY
EXEC_01C6A_ADMITTED=NO
EXEC_01C6A_LANE_DONE=NO
EXEC_01C6A_LOCKED=NO
SUCCESSOR_REGISTERED=NO
FENCE_VS_POLICY_RESOLVED=NO
F1_F5_PROVEN=NO
P1_P8_AUTHORIZED=NO
HOST_CLEAN_ATTESTED=NO
RESIDUAL_DAEMON_BUFFER_RISK_ACCEPTED=NO
IMPLEMENTATION_STARTED=NO
SIDECAR_CANDIDATE_ADDED=NO
STAGING_EXECUTION_AUTHORIZED=NO
PM2_AUTHORIZED=NO
ENV_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
PROVIDER_LIVE=NO
LOCAL_RUNTIME_AUTHORIZED=NO
HARNESS_FLAGS_MUTATED=NO
LANE_1=EMPTY
LANE_2=EMPTY
LANE_3=DISABLED
GOVERNANCE_FINAL=UNOWNED
```

---

## 0. Step 2 statement (historical; unchanged)

This freeze defined the **exact A/B/C options** and the evidence that Step 3 may use to choose exactly one of:

1. **OUTCOME_A** — new fencing/recovery capability so EXEC-01C6A can be reopened later;
2. **OUTCOME_B** — different bounded Harness child that avoids PM2 process-env overlay;
3. **OUTCOME_C** — keep Harness parked and choose another CURRENT product slice.

Step 3 must apply the frozen decision matrix in §7. Step 3 must not invent runtime, PM2-daemon, staging, or product-frontier facts. Step 2 does not fill the selected-outcome cell.

Source evidence consulted this window does **not** make exactly one option source-grounded. Therefore:

```
OUTCOME_SELECTED=NONE
```

## 0A. Step 3 decision record — 2026-09-18

Keith authorized Step 3 only and explicitly selected option A. Missing evidence was not filled by assumption.

Authorized facts applied to the frozen §7 matrix:

1. Keith authorizes A **and** records that a new fencing/recovery successor will be registered before any EXEC-01C6A reopen, because PM2-FENCE-01 OUTCOME_BLOCKED has no reopen gate. **R1 is true.**
2. Therefore the first matching row is **R1**. Selected outcome: **OUTCOME_A**.

This selects a **direction**. It does **not** establish that a supported fence exists. It does **not** authorize UNKNOWN_PENDING_OVERLAY recovery policy.

Fence-capability versus recovery-policy remains **unresolved**. Selecting A does **not**:

- prove F1–F5
- authorize P1–P8
- accept residual daemon-buffer risk
- attest host CLEAN
- reopen EXEC-01C6A
- change sidecar or canonical `startCondition=NOT_READY`
- register the successor
- authorize live canary execution

PM2-FENCE-01 remains COMPLETE AND LOCKED with **OUTCOME_BLOCKED under M3**. Rejected fencing claims remain rejected: CLI completion, timeout, process kill, point-in-time snapshots (`jlist`/`dump_env`), `pm2 save`, filesystem lock, and assumed daemon ordering are still not a supported fence.

Required sequence before any EXEC-01C6A reopen (frozen §3.3; recorded as the R1 condition):

1. A new fencing/recovery successor must be separately registered and authorized. Do not reuse PM2-FENCE-01. Do not treat HARNESS-RESTART-GOV-01 as that successor.
2. That successor must establish the applicable frozen reopen gate (F1–F5 fence path **or** authorized P1–P8 policy path) and be COMPLETE AND LOCKED.
3. Only a later separately authorized control-plane step may change EXEC-01C6A `startCondition`.
4. Live canary execution requires its own authorization.

This Step 3 does not perform items 1–4. Historical Step 3 record: Step 4 was **not** authorized in that window. This task was **not** locked in that window.

AGENT-PLATFORM-EXEC-01C6A remains `startCondition=NOT_READY`. It is not reopened, admitted, LANE-DONE, or LOCKED.

No live canary, PM2 overlay, staging, runtime mutation, operator-bundle change, Harness-flag mutation, or successor registration is authorized.

GOVERNANCE was acquired only for this decision-record write, then released UNOWNED. End-state occupancy remains Lane 1 EMPTY / Lane 2 EMPTY / GOVERNANCE UNOWNED. No sidecar candidate was added. `lane-saturation-state.json` was not edited.

---

## 0B. Step 4 checkpoint / lock — 2026-09-18

Keith authorized Step 4 only: independent verification, checkpoint, and lock of the completed GOVERNANCE decision.

Independent verification (no new investigation; no invented runtime/PM2/host/product-frontier facts):

1. Step 3 recorded Keith’s explicit option A selection (`docs: select harness fencing recovery direction` `2a477b5aac78794e83894c772a6b84f8a47812bc`).
2. Frozen matrix R1 applies: **OUTCOME_SELECTED=OUTCOME_A**. First matching row remains **R1**.
3. The decision requires a separately registered and authorized fencing/recovery successor before any EXEC-01C6A reopen. Do not reuse PM2-FENCE-01. Do not treat HARNESS-RESTART-GOV-01 as that successor.
4. No supported fence, F1–F5 proof, P1–P8 authorization, host CLEAN attestation, or residual-risk acceptance is claimed.
5. Fence-capability versus UNKNOWN_PENDING_OVERLAY recovery-policy remains **unresolved**.
6. EXEC-01C6A sidecar and canonical `startCondition` remain `NOT_READY`. Not reopened. Not admitted. Not LANE-DONE. Not LOCKED.
7. Step 3 changed only its authorized governance files: `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/HARNESS-RESTART-GOV-01-STAGE-START.md`, `docs/control-plane/SATURATION_PROOF.json`.

**Verdict:** HARNESS-RESTART-GOV-01 is **COMPLETE AND LOCKED** with **OUTCOME_A / R1**.

PASS means the GOVERNANCE decision satisfies its freeze. It does **not** mean Harness recovery or activation is proven.

This checkpoint states:

- OUTCOME_SELECTED=OUTCOME_A. MATRIX_ROW=R1.
- Direction only: a new fencing/recovery successor must be separately registered and authorized before any EXEC-01C6A reopen.
- Fence-capability versus recovery-policy remains unresolved.
- F1–F5 are not proven. P1–P8 are not authorized. Host CLEAN is not attested. Residual daemon-buffer risk is not accepted.
- EXEC-01C6A remains `startCondition=NOT_READY` / not reopened / not admitted / not LANE-DONE / not LOCKED.
- PM2-FENCE-01 remains COMPLETE AND LOCKED with **OUTCOME_BLOCKED under M3**.
- BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON.
- Occupancy EMPTY. GOVERNANCE UNOWNED. No successor registered. No implementation candidate created.

`lane-saturation-state.json` was **not** edited. Freeze Decision 7 (`lockedTaskIds` append on COMPLETE AND LOCKED) is the implementation-candidate dependency-proof mechanism. This GOVERNANCE task has no sidecar candidate. No candidate `dependsOn` HARNESS-RESTART-GOV-01. The closest analog, PM2-FENCE-01 COMPLETE AND LOCKED, left the sidecar unedited. The validator does not fail closed for a locked GOVERNANCE ID absent from `lockedTaskIds` unless a candidate depends on it. Therefore recording this ID is not required for this lock.

GOVERNANCE was acquired only for this checkpoint write, then released UNOWNED. End-state occupancy remains Lane 1 EMPTY / Lane 2 EMPTY / GOVERNANCE UNOWNED.

No SSH, AWS, PM2, Docker, database, Redis, browser, package installation, application tests, provider calls, credit activity, or canary submission ran.

---

## 1. Authority and allowed evidence

### 1.1 Authority

- `TASKS.md` CURRENT EXECUTION BOARD is the only scheduler.
- `TASKS_BACKLOG_FULL.md` is the canonical task registry.
- This document is evidence for HARNESS-RESTART-GOV-01 Steps 2–4. It is not a scheduler and does not admit EXEC-01C6A. The Step 4 lock records the GOVERNANCE decision only.
- The sidecar `docs/control-plane/lane-saturation-state.json` is not a scheduler. EXEC-01C6A `startCondition=NOT_READY` remains UNCHANGED.
- Locked Builder checkpoints are evidence only that Builder is no longer the CURRENT closeout blocker. They do not admit Harness, reopen EXEC-01C6A, or select A/B/C.
- `docs/AINOW-EXECUTION-ROADMAP.md` and `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` are historical / strategic only. They have no admission or selection authority here.

### 1.2 Evidence actually consulted (read-only)

| Source | Role this window |
|---|---|
| Canonical HARNESS-RESTART-GOV-01 body | Named decision container; A/B/C identity frozen at Step 1; OUTCOME_SELECTED=NONE |
| Canonical AGENT-PLATFORM-EXEC-01C / 01C6 / 01C6A bodies | Umbrella still READY / NOT ADMITTED / PROVISIONAL; 01C6A MACHINE BLOCKER ENFORCED / startCondition=NOT_READY; 01C6B and 01C7 unregistered |
| Canonical AGENT-PLATFORM-EXEC-01C6A-PM2-FENCE-01 body + `docs/AGENT-PLATFORM-EXEC-01C6A-PM2-FENCE-01-STAGE-START.md` | COMPLETE AND LOCKED OUTCOME_BLOCKED under M3; F1–F5 / P1–P8 / no-reopen-gate |
| `docs/AGENT-PLATFORM-EXEC-01C6-STAGE-START.md` | Shared PM2 worker; module-load Harness flags; `--update-env` as the later-authorized process-env path; local app tests / local runtime not the canary venue |
| `docs/control-plane/lane-saturation-state.json` | Occupancy EMPTY; EXEC-01C6A candidate `startCondition=NOT_READY`; no HARNESS-RESTART-GOV-01 implementation candidate |
| `docs/BUILDER-LIVE-GATE-01-CHECKPOINT.md` | Builder Ask gate LEFT ON (`GLOBAL_EXECUTION_ENABLED=true`); does not reopen EXEC-01C6A |
| `docs/PREVIEW-STOP-UI-STAGING-01-STAGE-START.md` | Stop Preview UI live-proven on staging; Builder UI closeout locked; does not reopen EXEC-01C6A |
| TASKS.md CURRENT EXECUTION BOARD above LEGACY / FROZEN | HARNESS-RESTART-GOV-01 REGISTERED / READY / NOT ADMITTED; occupancy EMPTY |

No application source, canary script, operator bundle, sidecar candidate, PRD, ARCHITECTURE, CLAUDE, AGENTS, validator, or mutex-catalog file was edited for investigation. No SSH, AWS, PM2, Docker, database, Redis, browser, npm/jest/tsc, provider, credit, or canary submission ran.

### 1.3 Established facts (inputs to Step 3, not an outcome)

These are already-present source facts. They are not a selected outcome.

1. Builder CURRENT closeout is locked enough to move on: BUILDER-LIVE-GATE-01 COMPLETE AND LOCKED / gate LEFT ON; PREVIEW-STOP-UI-STAGING-01 COMPLETE AND LOCKED (workspace Stop Preview Vite+static PASS). Vite/static preview and public preview stop HTTP 200 JSON are already locked by ancestry. BUILDER-CREDIT-UX-01 is locked. Builder is **not** the remaining Harness-resume blocker.
2. Product-visible Harness / tool-loop remains FUTURE / gated / disabled / unavailable. EXEC-01C records that as living authority. This freeze does not edit PRD.md or ARCHITECTURE.md.
3. AGENT-PLATFORM-EXEC-01C6A remains MACHINE BLOCKER ENFORCED. Sidecar and canonical `startCondition=NOT_READY`. Not admitted. Not LANE-DONE. Not LOCKED. Prepared artifacts exist and must remain untouched.
4. AGENT-PLATFORM-EXEC-01C6A-PM2-FENCE-01 is COMPLETE AND LOCKED with **OUTCOME_BLOCKED under M3**. M1 false (no non-invented F1–F5 fence). M2 false (UNKNOWN_PENDING_OVERLAY P1–P8 not authorized). That outcome has **no reopen gate**.
5. AGENT-PLATFORM-EXEC-01C6B remains unregistered and frozen-depends on EXEC-01C6A COMPLETE AND LOCKED. AGENT-PLATFORM-EXEC-01C7 remains unregistered. No other unfinished Harness-restart GOVERNANCE successor is registered.
6. Occupancy is EMPTY. HARNESS-RESTART-GOV-01 is GOVERNANCE and has no implementation sidecar candidate. Idle implementation capacity is valid.

---

## 2. Why this freeze exists

EXEC-01C6A live canary is blocked by a **temporary canary-procedure safety issue**: a timed-out PM2 process-env overlay cannot be proven cleared before restore, so the shared staging worker could retain Harness/tool-loop flags after a failed canary. That is not an application regression. Production source, deployed dist, current flags, and accepted preparation artifacts are unchanged by this freeze.

Builder completion removes the prior CURRENT-product reason to defer the Harness-resume **decision**. It does not reopen EXEC-01C6A. It does not authorize PM2 overlays. It does not force A, B, or C.

---

## 3. Frozen option A — new fencing/recovery capability so EXEC-01C6A can be reopened later

### 3.1 What A is

A later, separately authorized capability that supplies one of the two reopen gates already frozen by PM2-FENCE-01:

- **Fence path:** supported PM2 completion/fencing satisfying F1–F5 in `docs/AGENT-PLATFORM-EXEC-01C6A-PM2-FENCE-01-STAGE-START.md` §5; or
- **Policy path:** Keith-authorized UNKNOWN_PENDING_OVERLAY recovery policy with P1–P8 recorded, then later host CLEAN, as frozen in that document §6.

Selecting A in a later Step 3 does **not** itself reopen EXEC-01C6A, change `startCondition=NOT_READY`, acquire STAGING/PM2/ENV, or run the canary.

### 3.2 Why PM2-FENCE-01 OUTCOME_BLOCKED is not enough

PM2-FENCE-01 lock records that **no safe supported mechanism currently exists**. Explicitly:

| Frozen PM2-FENCE-01 fact | Why it cannot reopen EXEC-01C6A |
|---|---|
| Selected row M3 / OUTCOME_BLOCKED | That outcome has **no reopen gate** |
| M1 false | F1–F5 are not established by non-invented supported evidence |
| M2 false | UNKNOWN_PENDING_OVERLAY policy P1–P8 is not authorized |
| Child lock records the decision only | It does **not** lock or close parent EXEC-01C6A and must **not** change sidecar `startCondition=NOT_READY` |
| Rejected proofs remain rejected | CLI exit/timeout/kill/reap, point-in-time `jlist`/`dump_env`, `pm2 save`, filesystem lock, and assumed daemon ordering are still not fencing |

OUTCOME_BLOCKED is a **negative** decision: do not reopen on the existing overlay procedure. It is not a fencing capability, not a recovery policy, and not a startCondition change.

### 3.3 Evidence that would be required before A can later reopen EXEC-01C6A

All of the following, in order. This Step 2 freeze satisfies none of them.

1. A **new** registered task (not a silent reopen of EXEC-01C6A; not a rewrite of locked PM2-FENCE-01) whose purpose is either:
   - to establish a supported fencing capability meeting F1–F5 without using §4 rejected proofs; or
   - to authorize and record UNKNOWN_PENDING_OVERLAY policy P1–P8.
2. That successor COMPLETE AND LOCKED with the matching reopen gate satisfied:
   - Fence path: F1–F5 proven; automation must not report `restore_ok=True` after ACK_LOST.
   - Policy path: P1–P8 recorded; host later attested CLEAN; residual daemon-buffer risk accepted by Keith.
3. A **separately authorized** control-plane write that changes EXEC-01C6A `startCondition` from `NOT_READY`. CLEAN or F1–F5 proof does not itself admit the canary.
4. Explicit Keith authorization before STAGING, PM2, ENV (if then required), CREDIT (if optional stub finalize remains), and any canary submission.

### 3.4 What must be registered later before reopening EXEC-01C6A

If Step 3 later selects A, register **before** any EXEC-01C6A reopen attempt:

1. A new GOVERNANCE and/or IMPLEMENTATION successor for the chosen gate (fence capability or UNKNOWN_PENDING_OVERLAY policy). Do not reuse PM2-FENCE-01. Do not treat HARNESS-RESTART-GOV-01 as that successor.
2. After that successor is locked with its reopen gate satisfied: a distinct control-plane step to change EXEC-01C6A `startCondition` and, only then, any live-execution admission.
3. Do **not** register EXEC-01C6B or EXEC-01C7 as a substitute reopen of EXEC-01C6A. Frozen 01C6B still depends on EXEC-01C6A COMPLETE AND LOCKED.

This Step 2 did not register those successors. Step 3 (2026-09-18) selected A. This Step 3 window still does **not** register those successors.

---

## 4. Frozen option B — different bounded Harness child that avoids PM2 process-env overlays

### 4.1 What “non-overlay” means

**Overlay** (forbidden for a B child) is any procedure that mutates named process-env keys on named shared PM2 apps by dispatching PM2 process-env overlay or restore commands, including `pm2 restart --update-env`, equivalent `--update-env` merges, or restore watchdogs racing those commands.

Named apps from the locked PM2-FENCE-01 freeze: `aisandbox-ai-service` (worker) and, for xAI, `aisandbox-api-gateway`. Named overlay keys include at least `AGENT_HARNESS_ENABLE_TOOL_LOOP`, `HARNESS_ENTITLEMENT_HMAC_SECRET`, dummy `XAI_API_KEY`, and (xAI only) Gateway `GLOBAL_EXECUTION_ENABLED` / HMAC.

**Non-overlay** means all of the following:

1. The child does **not** dispatch overlay/restore PM2 process-env commands against those named apps for those named keys.
2. The child does **not** persist Harness/tool-loop flags into `/opt/aisandbox/.env`.
3. The child does **not** require proving ACK_LOST overlay clearance before restore.
4. Submit-script / one-shot process env is **not** treated as worker flag enablement. EXEC-01C6 freeze: `DEFAULT_AGENT_HARNESS_CONFIG_V1` is created at module load from `process.env`; submit-script env does not affect the already-running shared PM2 worker.

Non-overlay is **not** a claim that Harness flags may be enabled by some other silent path. This GOVERNANCE task must **not** mutate Harness/live flags.

### 4.2 Candidate shape for a later child if B is chosen

If Step 3 later selects B, the later child must be a **new bounded IMPLEMENTATION ID**, not a reopen of EXEC-01C6A.

Frozen shape constraints (registration later; not this window):

| Constraint | Frozen rule |
|---|---|
| Identity | New canonical ID. Not EXEC-01C6A. Not a rewrite of PM2-FENCE-01. Not EXEC-01C6B (still depends on EXEC-01C6A LOCK). Not EXEC-01C7 unless a later freeze independently authorizes that ID. |
| Parent program | Remains inside EXEC-01C / EXEC-01C6 human program authority unless a later named-task CURRENT/FUTURE check says otherwise. Product-visible Harness stays FUTURE/gated. |
| Overlay | Must satisfy §4.1 non-overlay. |
| Isolated worker/queue | EXEC-01C6A recorded that an isolated canary worker/queue does not exist and adding one would be a production capability change **forbidden in that child**. B must not silently add that capability. If an isolated worker is later required, it is a separately authorized capability task, not an implicit B default. |
| Flag mutation | Must not enable `AGENT_HARNESS_ENABLE_TOOL_LOOP` or equivalent; must not send frontend `harnessVersion`; must not weaken Gateway `agentId` + `harnessVersion` rejection. |
| Local machine | Local application tests / local runtime remain invalid as a **live Harness canary venue** (EXEC-01C6 environment correction). A later LOCAL-TESTS contract slice is allowed only if it is not claimed as staging canary proof. |
| This window | Must not mutate Harness/live flags. Must not register the child. Must not author canary scripts. |

Allowed later shapes (examples of bound, not a selection and not a registration):

- **B1. Contract/static LOCAL-TESTS slice** that proves wiring, fail-closed advertisement, or entitlement-proof consumers without enabling tool-loop on the shared worker and without PM2 overlay.
- **B2. Staging canary that uses already-present process env** without overlay. While Harness/tool-loop flags remain false, this **cannot** be claimed as tool-loop-enabled canary proof.

This freeze does not choose B1 or B2. Step 3, if it selects B, still must not invent a child ID or write set here.

### 4.3 Allowed evidence class and mutexes for a later B child

Frozen **ceiling** for a later B registration. Exact values are frozen at that later registration, not now.

| Class of later B child | evidenceClass | Declared mutexes (not acquired here) | Forbidden in that child |
|---|---|---|---|
| Contract/static tests only | LOCAL-TESTS | AI-SERVICE if write paths are under `services/ai-service`; GOVERNANCE for registration only | STAGING, ENV, PROVIDER-LIVE, CREDIT, LOCAL-RUNTIME as canary venue, PM2 overlay |
| Staging canary without overlay | STAGING-RUNTIME | AI-SERVICE + STAGING; CREDIT only if an optional accounting path remains and is explicitly declared; ENV remains **undeclared** unless a later control-plane freeze adds it for a non-overlay reason | PM2 `--update-env` overlay/restore; `/opt/aisandbox/.env` Harness-flag writes; PROVIDER-LIVE unless a distinct later child; LOCAL-RUNTIME canary venue |

GOVERNANCE must not appear on the IMPLEMENTATION candidate mutex list. This GOVERNANCE task acquires no implementation mutex.

---

## 5. Frozen option C — keep Harness parked and choose another CURRENT product slice

### 5.1 What C is

Keep EXEC-01C6A `startCondition=NOT_READY`. Do not register a fencing successor. Do not register a non-overlay Harness child in the same decision. Leave product-visible Harness FUTURE/gated. If further CURRENT work is wanted, select it by the Next-Work Selection Protocol — not by filling empty lanes.

C is a **parking decision**, not a claim that the EXEC-01C program is cancelled, not a PRD/ARCHITECTURE edit, and not an invitation/Lane 3 change.

### 5.2 Evidence that would justify parking Harness

Step 3 may select C only if all of the following remain true at that later window (they are true now, but that does **not** auto-select C):

1. Builder CURRENT closeout is locked (BUILDER-LIVE-GATE-01 LEFT ON; PREVIEW-STOP-UI-STAGING-01 locked). Builder is not waiting on Harness.
2. Product-visible Harness remains FUTURE/gated in living PRD/ARCHITECTURE/EXEC-01C authority.
3. EXEC-01C6A remains blocked with no reopen gate (PM2-FENCE-01 OUTCOME_BLOCKED).
4. Keith accepts that the next CURRENT slice, if any, is **not** Harness-resume via A or B in this decision.
5. Parking is recorded as GOVERNANCE, occupancy EMPTY, EXEC-01C6A still NOT_READY.

Builder completion is evidence that parking is **available**, not that parking is mandatory. Keith named this decision container after Builder completion; that naming keeps A and B live until Step 3 chooses.

### 5.3 How to avoid inventing work just to fill lanes

Frozen anti-invention rules if C is later selected (and already binding on this freeze):

1. Empty implementation lanes are valid. Capacity 2 is a maximum, not a requirement to fill both lanes. Lane 3 remains DISABLED.
2. GOV-OS-03: if no registered FORCING candidate is safely admissible, idle is valid. Do not search roadmap, chat, window memory, or FUTURE to invent work.
3. Next-Work Selection Protocol applies before recommending or registering genuinely new PRODUCT or ARCHITECTURE work. Mandatory targeted reads: TASKS.md board above LEGACY/FROZEN; PRD CURRENT / LIMITED PRIVATE-BETA / APPROVED FUTURE; ARCHITECTURE CURRENT vs PLANNED; backlog search for an existing candidate.
4. Do not select next work from `docs/AINOW-EXECUTION-ROADMAP.md`, Platform-00, frozen source maps, locked-checkpoint “next recommended” prose, or TASKS.md below LEGACY/FROZEN.
5. Do not promote APPROVED FUTURE / gated Harness into CURRENT product merely because code or plans exist.
6. Do not manufacture a successor merely to fill available lane capacity.
7. If multiple genuinely valid CURRENT frontiers remain, present a bounded choice to Keith. Do not silently choose by model preference.
8. This Step 2 does **not** register a replacement product slice, even as a “helpful” follow-on.

---

## 6. Builder-completion evidence (not a Harness admit)

Consulted only to prove Builder is no longer the CURRENT closeout blocker:

| Locked evidence | What it proves | What it does not prove |
|---|---|---|
| BUILDER-LIVE-GATE-01 COMPLETE AND LOCKED / gate LEFT ON | Normal Builder Ask/Build gate is ON (`GLOBAL_EXECUTION_ENABLED=true`) | EXEC-01C6A reopen; Harness enablement; A/B/C selection |
| PREVIEW-STOP-UI-STAGING-01 COMPLETE AND LOCKED | Workspace Stop Preview button live-proven on staging (Vite+static) | EXEC-01C6A reopen; PM2 overlay safety; product-visible Harness |

---

## 7. Frozen decision matrix (Step 3 applied; matrix unchanged)

Step 3 evaluates rows in order. The first matching row is the **only** allowed selection. Missing evidence is not filled by assumption, chat memory, roadmap, or web research unless Keith later authorizes a specific evidence source.

| Row | Condition | Select |
|---|---|---|
| R1 | Keith authorizes A **and** records that a new fencing/recovery successor will be registered before any EXEC-01C6A reopen, because PM2-FENCE-01 OUTCOME_BLOCKED has no reopen gate | **OUTCOME_A** |
| R2 | R1 is false **and** Keith authorizes B **and** the later child is constrained to §4 non-overlay (no EXEC-01C6A reopen; no silent isolated-worker expansion; no Harness-flag mutation in this governance task) | **OUTCOME_B** |
| R3 | R1 is false **and** R2 is false **and** Keith authorizes C **and** any later CURRENT slice will use Next-Work Selection Protocol rather than lane-filling | **OUTCOME_C** |
| R0 | Default if Step 3 would need invented runtime, PM2-daemon, staging, or product-frontier facts to prefer R1 or R2, **or** if Keith has not chosen among A/B/C | **do not invent a row; return to Keith. Do not select from chat/model memory.** |

Tie-break / safety:

- Safety outranks convenience. This freeze does not auto-prefer A because Harness was previously the development program, and does not auto-prefer C because Builder is done.
- PM2-FENCE-01 OUTCOME_BLOCKED is **not** R1. It is an input that A still requires a new successor.
- Builder lock evidence is **not** R3 by itself.
- Existence of empty lanes is **not** R1, R2, or R3.
- EXEC-01C6B remaining unregistered is **not** R2.
- Local application tests are **not** valid live-canary evidence for A or B.

Step 2 selected row: **NONE** (historical).

Step 3 selected row: **R1 → OUTCOME_A** (2026-09-18). Keith authorized A and recorded that a new fencing/recovery successor will be registered before any EXEC-01C6A reopen, because PM2-FENCE-01 OUTCOME_BLOCKED has no reopen gate. Fence-capability versus UNKNOWN_PENDING_OVERLAY recovery-policy remains unresolved. F1–F5 are not proven. P1–P8 are not authorized. Host CLEAN is not attested. Residual daemon-buffer risk is not accepted. Selecting A does not reopen EXEC-01C6A.

Current source-grounded application of the matrix (Step 3):

- R1 matches: Keith authorizes A and records the successor-before-reopen sequence. First matching row is R1.
- R2 is not reached.
- R3 is not reached.
- R0 is not reached.
- Therefore OUTCOME_SELECTED = **OUTCOME_A**. MATRIX_ROW = **R1**.

---

## 8. Exact condition under which EXEC-01C6A stays `startCondition=NOT_READY`

Frozen for this entire HARNESS-RESTART-GOV-01 task, including later Step 3 / Step 4 unless a **later separately authorized** control-plane step explicitly writes otherwise:

> AGENT-PLATFORM-EXEC-01C6A sidecar and canonical `startCondition` remain `NOT_READY`. HARNESS-RESTART-GOV-01 must not reopen EXEC-01C6A. Selecting A in Step 3 still does not change `startCondition` until the §3.3 reopen sequence is complete. Selecting B or C never reopens EXEC-01C6A.

```
EXEC-01C6A startCondition = NOT_READY
EXEC-01C6A Test-Admissible = NOT_READY
EXEC-01C6A admitted = NO
EXEC-01C6A LANE-DONE = NO
EXEC-01C6A LOCKED = NO
HARNESS-RESTART-GOV-01 outcome = OUTCOME_A (Step 4 COMPLETE AND LOCKED; MATRIX_ROW=R1; direction only)
SUCCESSOR_REGISTERED = NO
FENCE_VS_POLICY_RESOLVED = NO
LOCKED = YES
```

---

## 9. What this freeze / Step 3 does not authorize

- Selecting OUTCOME_B or OUTCOME_C (Step 3 selected OUTCOME_A / R1 only)
- Establishing that a supported fence exists; proving F1–F5
- Authorizing UNKNOWN_PENDING_OVERLAY recovery policy P1–P8; accepting residual daemon-buffer risk; attesting host CLEAN
- Reinterpreting CLI completion, timeout, process kill, snapshots, or assumed daemon ordering as a supported fence
- Reopening AGENT-PLATFORM-EXEC-01C6A
- Changing EXEC-01C6A `startCondition=NOT_READY`
- Registering a fencing/recovery successor, a non-overlay Harness child, EXEC-01C6B, EXEC-01C7, or another CURRENT product slice
- Creating an implementation sidecar candidate for this GOVERNANCE task
- Occupying Lane 1 or Lane 2
- STAGING, PM2, ENV, CREDIT, PROVIDER-LIVE, LOCAL-RUNTIME, SSH, Docker, database, Redis
- Flags, key creation, canary submission, packet capture
- Local npm / jest / vitest / playwright / tsc / frontend / gateway / ai-service / container-manager / docker / compose
- Operator-bundle edits
- Implementation code or a new runtime procedure
- Editing the three prepared 01C6A canary artifacts
- Enabling Lane 3
- Editing PRD.md, ARCHITECTURE.md, CLAUDE.md, AGENTS.md, validator, mutex catalog, or the EXEC-01C6A sidecar candidate
- Treating this lock as Harness recovery or activation proof

---

## 10. Step 3 / Step 4 boundary

**Step 3 (COMPLETE — 2026-09-18):** Independently applied §7 and recorded exactly one outcome: **OUTCOME_A under R1**. Did not invent runtime facts. Did not reopen EXEC-01C6A. Did not register a successor. Did not implement a fence, recovery policy, non-overlay child, or replacement product slice. Fence-capability versus recovery-policy remains unresolved. Write set remained control-plane / this document only.

**Step 4 (COMPLETE AND LOCKED — 2026-09-18):** Independent verification / checkpoint / lock of this GOVERNANCE decision. Frozen Step 3 result confirmed: OUTCOME_A under R1. Task status COMPLETE AND LOCKED. PASS means the freeze is satisfied; it does not prove Harness recovery or activation. EXEC-01C6A remains `startCondition=NOT_READY` / not reopened / not admitted / not LANE-DONE / not LOCKED. No successor registered.

---

## 11. Invariants unchanged

- PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.
- Lane 3 remains DISABLED.
- Product-visible Harness remains FUTURE / gated / disabled / unavailable.
- `HARNESS_ENTITLEMENT_PROOF_V1` remains FROZEN.
- BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON.
- PREVIEW-STOP-UI-STAGING-01 remains COMPLETE AND LOCKED.
- PM2-FENCE-01 remains COMPLETE AND LOCKED / OUTCOME_BLOCKED under M3.
- Prepared artifacts preserved: `services/ai-service/scripts/canary-01c6a-stub-submit.ts`, `services/ai-service/scripts/canary-01c6a-xai-negative.ts`, `docs/AGENT-PLATFORM-EXEC-01C6A-CANARY-EVIDENCE.md`.
- Occupancy remains EMPTY. No implementation sidecar candidate for HARNESS-RESTART-GOV-01.

---

## 12. Activity ledger (Step 2 window)

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, canary submission=0, operator-bundle mutation=0, canary-script mutation=0, evidence-doc mutation=0, sidecar mutation=0, application source=0, local application tests=0, tests executed=0 except lane-capacity validator, dependencies=0, migrations=0, PRD.md=0, ARCHITECTURE.md=0, CLAUDE.md=0, AGENTS.md=0, validator edits=0, mutex-catalog edits=0, Git commit/push=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, EXEC-01C6A reopened=0, EXEC-01C6B registered=0, EXEC-01C7 registered=0, outcome selected=0.

Governance writes expected (Step 2): this document; `TASKS.md`; `TASKS_BACKLOG_FULL.md` HARNESS-RESTART-GOV-01 body; `docs/control-plane/SATURATION_PROOF.json` only if the validator regenerates it. `docs/control-plane/lane-saturation-state.json` occupancy/candidates/lockedTaskIds unchanged unless the validator strictly requires a rewrite (not expected: occupancy EMPTY / GOVERNANCE UNOWNED / no candidate added).

---

## 13. Activity ledger (Step 3 window)

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, canary submission=0, operator-bundle mutation=0, canary-script mutation=0, evidence-doc mutation=0, sidecar mutation=0, application source=0, local application tests=0, tests executed=0 except lane-capacity validator, dependencies=0, migrations=0, PRD.md=0, ARCHITECTURE.md=0, CLAUDE.md=0, AGENTS.md=0, validator edits=0, mutex-catalog edits=0, Git commit/push=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, EXEC-01C6A reopened=0, EXEC-01C6B registered=0, EXEC-01C7 registered=0, fencing/recovery successor registered=0, outcome selected=OUTCOME_A (R1; direction only; fence-vs-policy unresolved).

Governance writes expected (Step 3): this document; `TASKS.md` current board fields; `TASKS_BACKLOG_FULL.md` HARNESS-RESTART-GOV-01 body; `docs/control-plane/SATURATION_PROOF.json` only if the validator regenerates it. `docs/control-plane/lane-saturation-state.json` occupancy/candidates/lockedTaskIds unchanged (occupancy EMPTY / GOVERNANCE UNOWNED / no candidate added).

---

## 14. Activity ledger (Step 4 window)

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, canary submission=0, operator-bundle mutation=0, canary-script mutation=0, evidence-doc mutation=0, sidecar mutation=0, application source=0, local application tests=0, tests executed=0 except lane-capacity validator, dependencies=0, migrations=0, PRD.md=0, ARCHITECTURE.md=0, CLAUDE.md=0, AGENTS.md=0, validator edits=0, mutex-catalog edits=0, Git commit/push=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, EXEC-01C6A reopened=0, EXEC-01C6A locked=0, EXEC-01C6B registered=0, EXEC-01C7 registered=0, fencing/recovery successor registered=0, outcome selected=OUTCOME_A (R1; independently verified; direction only; fence-vs-policy unresolved; PASS = freeze satisfied, not Harness recovery/activation proof).

Governance writes (Step 4): this document (Step 4 checkpoint / lock); `TASKS.md` current board fields; `TASKS_BACKLOG_FULL.md` HARNESS-RESTART-GOV-01 body; `docs/control-plane/SATURATION_PROOF.json` only as validator output. `docs/control-plane/lane-saturation-state.json` occupancy/candidates/lockedTaskIds unchanged (occupancy EMPTY / GOVERNANCE UNOWNED / no candidate added; this GOVERNANCE ID not appended). GOVERNANCE acquired transiently then released UNOWNED. End-state occupancy EMPTY / GOVERNANCE UNOWNED. Prepared 01C6A canary artifacts preserved untouched. Task COMPLETE AND LOCKED. EXEC-01C6A remains NOT_READY / not locked. No successor registered.
