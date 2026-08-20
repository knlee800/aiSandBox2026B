# PRIVATE-BETA-BLOCKER-03K — Final Consolidation Checkpoint

**Task ID:** PRIVATE-BETA-BLOCKER-03K  
**Title:** Builder Session Idle-Timeout Investigation  
**Final Status:** COMPLETE AND LOCKED — PASS — 2026-08-20  
**Workstream:** RELIABILITY  
**Lifecycle:** 4-step HIGH-RISK  
**Evidence class:** STAGING-RUNTIME  
**Nature:** CONTROL-PLANE / GOVERNANCE consolidation only — no application source, test, config, staging, provider, credit, env, or Git mutation  
**Depends on:** PRIVATE-BETA-E2E-04 — COMPLETE AND LOCKED — FAIL/BLOCKED — 2026-08-20

```
ROOT_CAUSE_PROVEN=YES
OUTCOME_CLASS=EXPECTED_TIMEOUT_TEST_PROCEDURE_CAUSE_PROVEN
SOURCE_FIX_REQUIRED=NO
CONFIG_CHANGE_REQUIRED=NO
MIGRATION_REQUIRED=NO
NO_SOURCE_RUNTIME_MUTATION_IN_03K=YES
```

Detailed raw evidence remains in:

- Stage-start: `docs/PRIVATE-BETA-BLOCKER-03K-STAGE-START.md`
- Investigation: `docs/PRIVATE-BETA-BLOCKER-03K-INVESTIGATION.md`

Do not treat this checkpoint as a scheduler.

---

## 1. Task Identity

PRIVATE-BETA-BLOCKER-03K was admitted to discover and prove why PRIVATE-BETA-E2E-04’s workspace session entered `idle_timeout` before the qualifying workspace apply.

03K is investigation-only. It does not repair source, retry E2E-04, call a provider, mutate credits, or change env/runtime gates.

| Field | Value |
|-------|--------|
| Session | `1492ed19-9417-4a93-a1fc-c5034d41d22e` |
| Execution | `12a8e444-5f4b-4966-a4ee-e040a5bfd0b5` |
| Project | `f5de42f3-c52d-4b48-95d5-651db1af88eb` |
| Provider / model | xai / grok-4.5 |
| Path | plain (`enableToolLoop=false`) |

---

## 2. Dependency on E2E-04

PRIVATE-BETA-E2E-04 remains **COMPLETE AND LOCKED — FAIL/BLOCKED — 2026-08-20**.

Checkpoint: `docs/PRIVATE-BETA-E2E-04-CHECKPOINT.md`  
Execution evidence: `docs/PRIVATE-BETA-E2E-04-EXECUTION.md`

03K does **not** rewrite E2E-04. 03K does **not** retroactively make E2E-04 PASS.

Proven E2E-04 symptom (unchanged):

- Builder execution completed with `workspace_mutation` and one fileAction (`e2e-04.html`)
- session entered `idle_timeout` before qualifying apply
- file was not saved
- public 03J confirm-build-apply was never reached
- no credit deduction occurred

---

## 3. Step 1 Result

**COMPLETE — Registration / Admission — 2026-08-20**

Admitted to Lane 1 only. Lane 2 remained EMPTY. Lane 3 remained DISABLED. STAGING reserved for read-only evidence isolation. PROVIDER-LIVE / CREDIT / ENV remained UNOWNED. No source repair selected.

---

## 4. Step 2 Result

**COMPLETE — Stage-Start / Root-Cause Investigation Plan — 2026-08-20**

Frozen plan: `docs/PRIVATE-BETA-BLOCKER-03K-STAGE-START.md`

Step 2 froze the investigation plan, hypothesis matrix, idle-timeout implementation facts, and read-only staging evidence plan. It did **not** select a root-cause class and did **not** select a repair.

---

## 5. Step 3 Investigation Result

**COMPLETE — Root Cause Proven — EXPECTED_TIMEOUT_TEST_PROCEDURE_CAUSE_PROVEN — 2026-08-20**

Evidence: `docs/PRIVATE-BETA-BLOCKER-03K-INVESTIGATION.md`

```
ROOT_CAUSE_PROVEN=YES
OUTCOME_CLASS=EXPECTED_TIMEOUT_TEST_PROCEDURE_CAUSE_PROVEN
```

E2E-04’s `idle_timeout` was valid under the existing implemented timeout contract. The session had already exceeded the configured inactivity threshold before the short Builder execution occurred. The failure was caused by the E2E procedure leaving the workspace session idle too long before Build/apply.

This investigation did **not** prove:

- a premature timer defect
- a Container Manager restart issue
- a race condition
- that the ~3-second provider call itself caused the timeout

---

## 6. Implementation Facts

1. Container Manager idle state is held in `SessionsService.lastActivity: Map<string, number>`.
2. That Map is process-memory only.
3. No persisted DB timestamp is authoritative for Container Manager idle enforcement.
4. Effective idle timeout: `SESSION_IDLE_TIMEOUT_MS=1800000` (30 minutes). Staging PM2 env did not set the key; default from `governance.config.ts` applied.
5. Exact comparison: `elapsedMs > idleTimeoutMs`.
6. Container Manager did **not** restart during the E2E-04 evidence window.
7. Frontend heartbeat does not exist.
8. Plain-path Builder/AI execution start does not update Container Manager activity.
9. Provider streaming does not update Container Manager activity.
10. AI completion does not update Container Manager activity.
11. Active execution does not suppress idle enforcement.
12. Idle enforcement is request-driven through `checkAndEnforceIdleTimeout`, not a periodic sweeper.
13. Workspace operations later encounter the idle check.

`SESSION_TIMEOUT_MINUTES=120` exists in the CM process env as a leftover key and is **not** read by idle enforcement.

---

## 7. Container Manager Process-Lifetime Evidence

| Field | Value |
|-------|--------|
| PM2 name | `aisandbox-container-manager` |
| PID during E2E-04 window | `376195` |
| Process start | 2026-08-17T03:02:16Z |
| Nest start markers on 2026-08-19 | NONE |
| Restart during E2E-04 evidence window | **NO** |

H12 (Map cleared by CM restart) is **FALSIFIED**.

Gateway did restart at 2026-08-19T04:16:19Z (execution-gate enable). Gateway restart does not clear Container Manager `lastActivity`.

---

## 8. Configured Timeout and Source/Default Semantics

```
EFFECTIVE_SESSION_IDLE_TIMEOUT_MS=1800000
EFFECTIVE_SESSION_MAX_LIFETIME_MS=86400000
IDLE_COMPARISON_OPERATOR=>
```

Default semantics apply because `SESSION_IDLE_TIMEOUT_MS` was absent from the CM PM2 environment and deployed source at `c3e39279abe3c0d6c348daa312107c8f6fc592b7` uses default `1800000`.

---

## 9. Reconstructed Activity Evidence

```
RECONSTRUCTED_AUTHORITATIVE_LAST_ACTIVITY_TIME=2026-08-19T03:29:47.277Z
RECONSTRUCTION_CONFIDENCE=EXACT
FIRST_PROVEN_MAP_INITIALIZATION_OR_TOUCH=2026-08-19T03:29:47.277Z
LAST_PROVEN_ACTIVITY_TOUCH=2026-08-19T03:29:47.277Z
```

This timestamp is preserved as corroborating arithmetic. It is **not** the sole foundation of the causal verdict.

The stronger causal proof is:

- `checkAndEnforceIdleTimeout` actually returned `idle_timeout`
- its only authoritative input is the in-memory `lastActivity` Map
- configured threshold was 30 minutes
- Container Manager did not restart during the relevant window
- Builder execution itself lasted ~3 seconds
- Build start / stream / completion did not refresh `lastActivity`
- therefore the session was already beyond the implemented idle threshold when the later workspace operation triggered enforcement

PostgreSQL and SQLite `last_activity_at` remain **contextual only** and were not substituted for the Map.

---

## 10. Timeout Arithmetic

```
RECONSTRUCTED_AUTHORITATIVE_LAST_ACTIVITY_TIME=2026-08-19T03:29:47.277Z
IDLE_ENFORCEMENT_TIME=2026-08-19T04:17:58.644Z
ACTUAL_IDLE_DURATION_MS=2891367
≈ 48 minutes 11.367 seconds

CONFIGURED_IDLE_TIMEOUT_MS=1800000
DELTA_FROM_THRESHOLD=+1091367 ms
≈ +18 minutes 11.367 seconds
```

Threshold was therefore already crossed well before the ~3-second Builder execution.

Related timestamps (not equivalent to enforcement):

| Event | UTC |
|-------|-----|
| Provider execution duration | approximately 2934 ms |
| AI completion / accounting | approximately 04:17:58Z / `finalize_accounting.build_awaiting_apply` 04:17:58.575Z |
| Idle enforcement | 2026-08-19T04:17:58.644Z |
| PostgreSQL lifecycle reconciliation | 2026-08-19T04:17:58.819Z |

---

## 11. Hypothesis Verdict Summary

| ID | Verdict |
|----|---------|
| H1 Configured idle threshold genuinely exceeded | SUPPORTED |
| H2 Frontend heartbeat absent | Contributing condition, **not** root cause |
| H3 Heartbeat sent but wrong store | FALSIFIED — no heartbeat exists |
| H4 Builder execution start does not touch activity | Mechanism YES; **not** this incident’s duration cause |
| H5 Streaming does not touch activity | Mechanism YES; stream lasted 2934 ms only |
| H6 Sweeper ignores in-flight AI | FALSIFIED — no sweeper |
| H7 Race vs nearby timestamps | FALSIFIED as causal race |
| H8 Timestamp/clock calculation defect | FALSIFIED |
| H9 Cleanup too early / manual stop | FALSIFIED |
| H10 Frontend/backend lifecycle disagreement | UX consequence, not independent mechanism |
| H11 Product timeout contract incompatible with long Builder execution | Latent product question; **not** the cause of this incident |
| H12 CM restart cleared Map | FALSIFIED |

---

## 12. Final Causal Mechanism

PRIVATE-BETA-E2E-04 failed because its fresh workspace session was opened approximately 48 minutes before the qualifying workspace operation while the configured Container Manager idle threshold was 30 minutes. No qualifying Container Manager activity refresh occurred during that interval. The later workspace operation therefore encountered the expected request-driven idle_timeout enforcement. The short Builder provider execution itself was not the cause.

Do **not** read this as:

- a 48-minute provider call
- provider execution timing the session out
- a Container Manager timer bug
- a heartbeat bug causing the incident
- a race condition
- a premature timeout

Those conclusions are not supported.

---

## 13. Contributing / Latent Conditions (Not Root Cause)

Recorded separately from root cause:

- no frontend heartbeat exists
- plain Builder execution does not touch Container Manager activity
- active AI execution does not suppress idle timeout
- user receives no proactive warning from this request-driven mechanism

These were **not** the primary cause of E2E-04 because the session had already exceeded the 30-minute threshold before the ~3-second Build execution.

They may be legitimate future product-design considerations for genuinely long-running work. 03K does **not** establish that they require an immediate source fix. They are not converted into separate blockers by this consolidation.

---

## 14. Fix Verdict

```
SOURCE_FIX_REQUIRED=NO
CONFIG_CHANGE_REQUIRED=NO
MIGRATION_REQUIRED=NO
```

No source-fix task is registered from 03K. No heartbeat is implemented to fix this historical E2E procedure.

### Corrected E2E procedure (smallest corrective action)

- create/open the fresh E2E workspace session immediately before the controlled Build journey
- avoid spending the 30-minute idle window performing unrelated preflight after session creation
- complete baseline/preflight work before opening the evidence session where possible
- once the fresh session is created, proceed promptly through Build → apply → confirm → deduction evidence

---

## 15. Latent Long-Running-AI Product Question

Documented, **not resolved**, and **not registered**:

If ainow.biz intentionally needs workspace sessions to survive genuinely long-running AI executions beyond the idle threshold, a separate product/architecture decision may later consider:

- activity touch at execution start
- execution-aware timeout suppression
- heartbeat/keepalive
- other session-lifecycle semantics

This is **not** required to close 03K.

---

## 16. 03J / E2E-04 / Private-Beta Status After 03K

| Item | State |
|------|--------|
| PRIVATE-BETA-E2E-04 | COMPLETE AND LOCKED — FAIL/BLOCKED — unchanged |
| 03J staging deployment parity | PROVEN (`c3e39279abe3c0d6c348daa312107c8f6fc592b7`) |
| 03J live public confirm-build-apply path | still UNPROVEN — E2E-04 never reached successful apply |
| Builder private-beta readiness | **NO_GO_PENDING_FRESH_E2E** |
| PRIVATE-BETA-INVITE-01 | UNREGISTERED / UNAUTHORIZED / UNTOUCHED / PROHIBITED |

The investigation explains why E2E-04 failed. It does **not** satisfy the required fresh E2E proof.

A new fresh controlled post-03J E2E is still required. Do **not** reuse or reopen PRIVATE-BETA-E2E-04.

---

## 17. Immediate Next Recommended Lifecycle

Because the proven cause is procedural and no source fix is required, do **not** treat a code-fix blocker as the immediate next task.

Immediate next recommended lifecycle after 03K lock:

**Register a NEW fresh post-03J controlled Builder E2E using the corrected procedure.**

This Step 4 does **not** register that E2E. Subsequent control-plane registration must verify the next unused E2E ID. A likely candidate may be PRIVATE-BETA-E2E-05; that identifier is **not assumed and not admitted here**.

The new E2E stage-start must incorporate:

- perform staging/safety/balance preflight before opening the fresh workspace session where possible
- create/open the fresh E2E project/session immediately before Build
- capture session creation time
- verify remaining idle-window headroom before provider call
- hard-stop before provider call if insufficient headroom remains
- one provider call maximum
- continue promptly through apply and confirm
- preserve all prior accounting / 03J / 03H / checkpoint evidence requirements
- restore `GLOBAL_EXECUTION_ENABLED=false` at end

---

## 18. 03K Final Task Verdict

03K successfully completed its investigation purpose.

```
PRIVATE-BETA-BLOCKER-03K
COMPLETE AND LOCKED — PASS — 2026-08-20

ROOT_CAUSE_PROVEN=YES
OUTCOME=EXPECTED_TIMEOUT_TEST_PROCEDURE_CAUSE_PROVEN
NO SOURCE FIX SELECTED OR REQUIRED FOR THIS INCIDENT
```

Lifecycle:

1. COMPLETE — Registration / Admission — 2026-08-20
2. COMPLETE — Stage-Start / Root-Cause Investigation Plan — 2026-08-20
3. COMPLETE — Root Cause Proven — EXPECTED_TIMEOUT_TEST_PROCEDURE_CAUSE_PROVEN — 2026-08-20
4. COMPLETE — Consolidation / Root-Cause Verdict — 2026-08-20

---

## 19. Mutation Boundary

03K did **not**:

- modify application source, tests, or runtime config
- implement a keepalive
- change timeout behavior
- SSH-mutate staging, restart services, or change env/runtime gates
- create a session/project
- call a provider
- mutate credits
- retry or rewrite E2E-04
- register a source-fix task
- register the next fresh E2E
- perform Git mutation (Keith owns Git)

---

*Created 2026-08-20 — PRIVATE-BETA-BLOCKER-03K Step 4 control-plane / governance consolidation only.*
