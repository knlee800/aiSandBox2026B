# GOV-PARALLEL-01 — Third Implementation Lane Admission — Step 2 Formal Decision

**Task ID:** GOV-PARALLEL-01
**Step:** 2 — Formal Evidence-Based Decision
**Date:** 2026-08-27
**Status:** Step 2 DECISION COMPLETE — Step 3 PENDING (consolidation/lock)
**Decision:** KEEP_DISABLED_UNTIL_FUTURE_MATERIAL_NEED
**Predecessor:** PILOT-2LANE-01 — COMPLETE AND LOCKED — PASS — 2026-08-27
**Plan:** `docs/GOV-PARALLEL-01-PLAN.md`

---

## 1. Task / date

| Field | Value |
|---|---|
| Task ID | GOV-PARALLEL-01 |
| Title | Third Implementation Lane Admission Decision |
| Step | 2 — Formal Evidence-Based Decision |
| Decision date | 2026-08-27 |
| Step 2 HEAD | `448cab8948768c393944702b11a7e2c5c59e1a18` |
| Step 1 HEAD | `bb9b3efa213088055b95dd09de9937958d35315a` |
| Lane 3 state | DISABLED (no change) |
| MAX_IMPLEMENTATION_LANES | 2 (no change) |

## 2. Decision question

Should aiSandBox2026B increase its maximum concurrent implementation capacity from TWO source lanes to THREE source lanes now?

## 3. Authoritative evidence

| Evidence source | Status |
|---|---|
| PILOT-2LANE-01 checkpoint | COMPLETE AND LOCKED — PASS — 2026-08-27 |
| GOV-PARALLEL-01 Step 1 plan | Frozen — evidence dimensions / decision framework established |
| GOV-OS-01 | LOCKED — established Lane 3 DISABLED with explicit gating criteria |
| GOV-ARCH-02 | LOCKED — architecture reconciled |
| GOV-PRD-02 | LOCKED — product reconciled |

## 4. Safety evidence

### PROVEN at two lanes:

| # | Control | Grade |
|---|---|---|
| 1 | Write-set admission (disjoint) | PROVEN |
| 2 | Mutex admission (non-conflicting) | PROVEN |
| 3 | Dirty-tree discrimination (binary: mine vs theirs) | PROVEN |
| 4 | Governance serialization (workers never write governance) | PROVEN |
| 5 | Combined integrated validation | PROVEN |
| 6 | Keith/operator Git authority preserved | PROVEN |
| 7 | Runtime isolation (no runtime used) | PROVEN |
| 8 | Zero worker Git mutations | PROVEN |

### NOT PROVEN:

| # | Property | Grade |
|---|---|---|
| 1 | Failure isolation (one lane fails, other continues) | NOT EXERCISED |
| 2 | Selective revert (failed lane reverted, surviving lane intact) | NOT EXERCISED |
| 3 | Ternary dirt discrimination (3 lanes) | NOT EXERCISED |
| 4 | Three-way admission (3 non-conflicting tasks) | NOT EXERCISED |
| 5 | Multi-party failure attribution | NOT EXERCISED |
| 6 | Elapsed-time benefit of parallelism | UNPROVEN |

## 5. Missing safety evidence

1. **Failure isolation** — the primary safety mechanism enabling parallelism has never been empirically exercised at any lane count. The design is theoretically sound (disjoint write sets → revert isolation by construction), but practice may differ from theory.

2. **Three-lane-specific controls** — ternary dirt discrimination, 3-way admission, and multi-party failure attribution are qualitatively new conditions that have never been tested.

3. **Operator selective revert under multi-lane conditions** — Keith has never performed a selective revert of one failed lane while preserving another.

## 6. Throughput evidence

```
PARALLEL_ELAPSED_TIME_BENEFIT=UNPROVEN
SEQUENTIAL_BASELINE_EXISTS=NO
PER_LANE_TIMESTAMPS_RECORDED=NO
GOVERNANCE_OVERHEAD_DOMINATED=YES (fixture repairs, Step 1/2/4 governance)
MEASURED_TWO_LANE_SPEEDUP=NONE
```

No throughput benefit has been demonstrated. No sequential baseline exists. Governance overhead dominated the pilot's actual calendar time. The theoretical benefit of parallelism is real but unmeasured.

## 7. Operator complexity

| Dimension | At 2 lanes | At 3 lanes | Growth |
|---|---|---|---|
| Worker windows to track | 2 | 3 | +50% |
| Write-set pairs to verify | 1 | 3 | 3× |
| Mutex conflict checks | 1 | 3 | 3× |
| Peer dirt sets per worker | 1 | 2 | 2× |
| Non-empty failure subsets | 3 | 7 | 2.3× |
| Failure attribution | binary | multi-party | qualitative change |
| Selective revert complexity | 1 peer | 2 peers | qualitative change |
| Validation sequencing | 2 write sets | 3 write sets | non-linear |
| Dirty-file count (pilot example) | 9 (4+5) | 12–15+ | estimate |
| Worker prompt size | baseline | ~+50% per worker | increased |

Keith, as the sole Git/operator, absorbs all of this complexity directly. The growth is non-linear in cognitive load even if linear in individual dimensions.

## 8. Control-plane complexity

| Aspect | At 2 lanes | At 3 lanes |
|---|---|---|
| Admission analysis | verify 1 pair disjoint | verify 3 pairs disjoint |
| Candidate selection | find 1 non-conflicting pair | find 1 non-conflicting triple |
| Failure scenarios | A fails / B fails / both fail | A / B / C / AB / AC / BC / ABC (7 scenarios) |
| Partial-failure recovery | straightforward (one survivor) | complex (1 or 2 survivors) |
| LANE-DONE integration | merge 2 write sets | merge 3 write sets |
| Revert permutations | revert A keep B / revert B keep A | 6 non-trivial revert combinations |
| Governance prompt burden | moderate | significantly increased |

## 9. Resource / mutex constraints

The project's mutex structure naturally limits useful 3-lane occupancy:

| Constraint | Impact |
|---|---|
| 14 named mutexes + 12 HOTFILE leases | Large set but most tasks need 1–3 broad mutexes |
| GATEWAY, FRONTEND, AI-SERVICE, CONTAINER-MANAGER | 4 major service mutexes; most tasks need one |
| I18N (atomic 3-file) | Frequently co-required with FRONTEND |
| MIGRATION | Frequently co-required with a service mutex |
| PACKAGE, COMPOSE, ENV | Infrastructure mutexes needed by many tasks |
| Structural independence | Project has ~4 major writable domains; 3 non-conflicting tasks require all different domains |

**Candidate supply evidence:** The pilot inventory examined 7 frontier candidates and found only 1 EXCELLENT pair (GATEWAY + FRONTEND/I18N). Finding an EXCELLENT triple requires 3 tasks with mutually disjoint write scopes AND mutually non-conflicting mutexes AND no shared contracts. Given the project's ~4-domain structure, this is structurally rare.

## 10. 2→3 qualitative differences

| Dimension | 2 lanes | 3 lanes | Nature of change |
|---|---|---|---|
| Pairwise write-set comparisons | 1 (C(2,2)=1) | 3 (C(3,2)=3) | Quantitative (3×) |
| Mutex admission comparisons | 1 | 3 | Quantitative (3×) |
| Dirty-tree classification | Binary (mine / theirs) | Ternary (mine / peer-A / peer-B) | **QUALITATIVE** — new error class |
| Failure ownership attribution | Binary | Multi-party | **QUALITATIVE** — new diagnostic complexity |
| Non-empty failure subsets | 3 (2^2−1) | 7 (2^3−1) | Quantitative but approaching qualitative |
| Worker prompt peer-set embedding | 1 peer set | 2 peer sets | Quantitative (+50% prompt size) |
| Operator selective-revert reasoning | 1 failed + 1 survivor | up to 1 failed + 2 survivors (or 2 failed + 1 survivor) | **QUALITATIVE** — multi-survivor recovery |
| Control-plane scheduling | find 1 pair | find 1 triple from sparse candidate supply | **QUALITATIVE** — combinatorial difficulty |

Four qualitatively new conditions are introduced at 3 lanes. None have been exercised.

## 11. Option A analysis — ENABLE NOW

**Positive safety evidence:**
- Two-lane collision safety PROVEN (all OS controls functioned correctly)
- Zero violations across the entire pilot lifecycle
- Theoretically sound design (disjoint write sets → isolation by construction)

**Missing safety evidence:**
- Failure isolation: NOT EXERCISED at any lane count
- Ternary dirt discrimination: NOT EXERCISED
- Multi-party failure attribution: NOT EXERCISED
- Operator selective revert: NOT EXERCISED

**Demonstrated benefit:** NONE measured.

**Unproven benefit:** Theoretical parallel speedup (unmeasured; governance overhead may dominate).

**Control-plane changes required:**
- `CLAUDE.md` §Parallel capacity: update MAX from 2 to 3; remove DISABLED state
- `TASKS.md` board: add Lane 3 EMPTY; update capacity display
- Worker prompts: embed 2 peer write sets (ternary discrimination)
- Admission logic: 3-way pairwise checks
- Failure/recovery documentation: expanded partial-failure procedures
- `AGENTS.md`: no change needed (thin bootstrap only)

**Rollback/reversibility:** Reversible — can re-disable Lane 3 by updating the same documents.

**Residual risk:** HIGH — enabling capacity without proven failure isolation, without demonstrated benefit, and without candidate supply is all cost with no proven upside.

**VERDICT: OPTION A — REJECTED.**

Basis: Fail-closed posture requires positive evidence. "Two lanes didn't fail" ≠ "three lanes are justified." Missing failure-isolation evidence alone disqualifies enablement. Missing throughput evidence compounds the concern. Missing candidate supply evidence makes the capacity practically moot.

## 12. Option B analysis — FAILURE EVIDENCE FIRST

**Premise:** Prove failure isolation works at 2 lanes before considering 3.

**Required evidence (as frozen in Step 1 §15):**
1. Two independent admitted source tasks
2. One lane deliberately stopped (controlled failure)
3. Failed lane's output quarantined correctly by control plane
4. Surviving lane continues safely to LANE-DONE
5. Revert of failed lane does NOT invalidate surviving lane's evidence
6. Combined validation on surviving-lane-only tree passes
7. Git operator actions are unambiguous
8. Per-lane wall-clock timestamps recorded

**Assessment:** This is a legitimate safety prerequisite. Failure isolation IS the primary safety mechanism. Proving it at 2 lanes is necessary before extending to 3.

**However:** This option creates a standing obligation to run another pilot solely to collect evidence for Lane 3. This is appropriate only if Lane 3 is expected to be useful. Given the candidate supply constraint (1 EXCELLENT pair from 7 candidates; finding an EXCELLENT triple is structurally harder), the practical utility of Lane 3 is questionable.

**VERDICT: OPTION B — NOT SELECTED as the primary decision.**

Basis: Logically correct as a prerequisite, but manufacturing a pilot solely to justify capacity that may rarely be useful is inefficient governance. The evidence requirement is valid; the obligation to immediately pursue it is not.

## 13. Option C analysis — FAILURE + THROUGHPUT

**Premise:** Require both dimensions before reconsidering Lane 3.

**Additional throughput evidence requirements:**
- A two-lane pilot with per-lane wall-clock start/finish timestamps
- A defensible sequential-execution baseline or estimate
- Demonstrated net time savings after accounting for governance overhead
- Threshold: parallel execution produces a material wall-clock reduction large enough to justify added control-plane/operator overhead

**Assessment:** Maximally conservative. Both evidence dimensions are legitimate. However, this option imposes an even larger standing obligation (two different evidence-collection exercises) to justify capacity that the candidate supply constraint makes structurally rare.

**VERDICT: OPTION C — NOT SELECTED as the primary decision.**

Basis: Correct in principle but creates disproportionate governance overhead relative to the likelihood that Lane 3 would be practically useful given the project's structure.

## 14. Option D analysis — TWO-LANE CAP UNTIL FUTURE MATERIAL NEED

**Premise:** Standardize on MAX_IMPLEMENTATION_LANES=2 until a future concrete workload demonstrates that two lanes are an actual bottleneck. Do not manufacture evidence-gathering work solely to justify Lane 3.

**Supporting evidence:**

1. **Candidate supply is structurally limited.** The pilot inventory found only 1 EXCELLENT pair from 7 candidates. The project has ~4 major writable domains (GATEWAY, AI-SERVICE, CONTAINER-MANAGER, FRONTEND). Finding 3 mutually independent tasks is combinatorially harder and structurally rare.

2. **Two lanes may exceed practical need.** If 7 frontier candidates yield only 1 excellent pair, the project rarely has even 2 truly independent tasks simultaneously ready. A third lane would often sit EMPTY.

3. **No measured throughput benefit.** Without evidence that 2-lane parallelism saves time, there is no basis to believe 3-lane parallelism would help.

4. **Operator burden is non-trivial even at 2.** Adding a third lane increases cognitive load non-linearly for a single operator.

5. **Governance overhead scales with lane count.** Each additional lane requires admission analysis, monitoring, consolidation, and potential failure recovery — all governance cycles that could be spent on actual implementation.

6. **Failure isolation is unproven.** Even the 2-lane safety property is incomplete (failure path never exercised). This doesn't block 2-lane operation (which has positive collision-safety evidence), but it blocks capacity increases.

7. **Mutex contention naturally caps useful parallelism.** With ~4 major service domains and frequent infrastructure mutex needs (PACKAGE, ENV, COMPOSE, MIGRATION), practical 3-lane occupancy is constrained regardless of capacity.

**Risk:** Forecloses optionality if future project expansion creates abundant independent work. But this is not permanent — a future material need would reopen the question through a new governance task.

**VERDICT: OPTION D — SELECTED.**

## 15. Decision matrix

| # | Dimension | A (Enable) | B (Failure first) | C (Both) | D (Future need) |
|---|---|---|---|---|---|
| 1 | Source-write collision risk | INCREASED | UNCHANGED | UNCHANGED | UNCHANGED |
| 2 | Mutex pressure | INCREASED | UNCHANGED | UNCHANGED | UNCHANGED |
| 3 | Control-plane complexity | SIGNIFICANTLY INCREASED | UNCHANGED | UNCHANGED | UNCHANGED |
| 4 | Operator burden | INCREASED | UNCHANGED | UNCHANGED | UNCHANGED |
| 5 | Dirty-tree discrimination | INCREASED (ternary) | UNCHANGED (binary) | UNCHANGED | UNCHANGED |
| 6 | Failure containment | UNPROVEN at 3 | PROVEN at 2 (after pilot) | PROVEN at 2 | N/A (stays at 2) |
| 7 | Failure recovery | MORE COMPLEX | UNCHANGED | UNCHANGED | UNCHANGED |
| 8 | Runtime resource contention | POTENTIALLY INCREASED | UNCHANGED | UNCHANGED | UNCHANGED |
| 9 | Staging/provider contention | POTENTIALLY INCREASED | UNCHANGED | UNCHANGED | UNCHANGED |
| 10 | Git/operator complexity | INCREASED | UNCHANGED | UNCHANGED | UNCHANGED |
| 11 | Expected throughput gain | UNPROVEN | UNKNOWN | MEASURED | NOT PURSUED |
| 12 | Evidence supporting throughput | NONE | NONE | STRONG | N/A |
| 13 | Evidence supporting safety | INSUFFICIENT | SUPPORTED | STRONG | N/A (2-lane PROVEN) |
| 14 | Observability/debuggability | DECREASED | UNCHANGED | UNCHANGED | UNCHANGED |
| 15 | Reversibility | REVERSIBLE | REVERSIBLE | REVERSIBLE | REVERSIBLE (new governance task) |
| 16 | Governance overhead created | HIGH (enablement changes) | MODERATE (1 pilot) | HIGH (2 pilots) | ZERO (no standing obligation) |

**Matrix conclusion:** Option D is the only option that:
- Creates ZERO additional governance overhead
- Preserves all current safety properties without regression
- Does not manufacture work solely to justify rarely-needed capacity
- Remains reversible through a future governance task
- Matches the project's actual structural constraints (limited candidate supply, limited service domains)

Options B and C are logically sound prerequisites but create standing obligations to collect evidence for capacity that the project's structure makes impractical. Option A fails the fail-closed evidence standard.

## 16. Formal selected decision

```
LANE3_DECISION = KEEP_DISABLED_UNTIL_FUTURE_MATERIAL_NEED
```

## 17. Reasoning

The burden of proof is on increasing concurrency. The evidence must demonstrate BOTH safety AND benefit.

**Safety:** The two-lane pilot proved that the Development OS controls work correctly at the 2-lane operating point. It did NOT prove failure isolation (never exercised), did NOT exercise any 3-lane-specific condition (ternary discrimination, multi-party attribution, 3-way admission), and provides no logical basis to extrapolate safety to 3 lanes.

**Benefit:** No throughput benefit has been measured. No sequential baseline exists. Governance overhead dominated pilot calendar time.

**Candidate supply:** The pilot inventory found only 1 EXCELLENT pair from 7 candidates. Finding an EXCELLENT triple from this project's ~4-domain structure is structurally rare. Even 2 lanes may exceed what's frequently useful.

**Operator cost:** Keith, as sole Git/operator, absorbs all multi-lane complexity. Going from 2 to 3 lanes introduces qualitatively new cognitive demands (ternary classification, multi-survivor recovery) without proven benefit.

**Policy choice:** DISABLED UNTIL FUTURE NEED JUSTIFIES REOPENING — not DISABLED PENDING SPECIFIC EVIDENCE. The distinction matters: this decision avoids manufacturing governance/pilot work solely to justify capacity that the project's structure makes impractical. If a future material need arises (recurring 2-lane bottleneck with abundant independent candidates), a new governance task would define and collect whatever evidence is required.

## 18. Lane 3 current state

```
LANE3_CURRENT_STATE = DISABLED
```

No change from before this decision.

## 19. Max implementation lanes

```
MAX_IMPLEMENTATION_LANES_CURRENT = 2
```

No change from before this decision.

## 20. Reopen trigger

Lane 3 may be reconsidered ONLY when ALL of the following are demonstrably true:

1. **Recurring two-lane bottleneck:** There are repeated, documented instances where a third implementation task is READY and cannot be admitted solely due to lane capacity (not due to mutex/resource conflicts that would prevent admission regardless of lane count).

2. **Structural evolution:** The project's writable domains have expanded sufficiently that 3+ mutually independent bounded tasks with non-conflicting mutexes are a regular occurrence, not a rare exception.

3. **Explicit governance task:** A new governance lifecycle is registered specifically to reassess Lane 3, defining its own evidence requirements (which should include at minimum: empirical failure-isolation proof at 2 lanes, and assessed 2→3 complexity acceptance).

The absence of any of these conditions means Lane 3 remains DISABLED without further action.

```
REOPEN_TRIGGER = RECURRING_2LANE_BOTTLENECK + STRUCTURAL_DOMAIN_EXPANSION + EXPLICIT_GOVERNANCE_TASK
```

## 21. Immediate follow-up requirement

```
IMMEDIATE_FOLLOWUP_PILOT_REQUIRED = NO
```

No pilot, evidence-collection exercise, or successor task is registered or required by this decision. The decision is complete and self-contained. Future work proceeds with MAX_IMPLEMENTATION_LANES=2 as the standing operational capacity.

## 22. Reversibility

The decision is reversible. A future governance task can:
- Reopen the Lane 3 question
- Define evidence requirements appropriate to the future context
- Collect whatever evidence is needed
- Enable Lane 3 through documented `CLAUDE.md` / `TASKS.md` updates

No permanent architectural constraint is created. The Development OS remains structurally capable of 3+ lanes. The decision is a policy choice, not a technical limitation.

## 23. Invitation state (preserved)

```
PRIVATE-BETA-INVITE-01 = PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
INVITATION_EXECUTION_PERMITTED = NO
LIVE_STAGING_VALIDATED = YES
BUILDER_PRIVATE_BETA_READINESS = GO
```

This decision does not authorize invitations.

## 24. Runtime authorization state (preserved)

```
RUNTIME_EXECUTION_AUTHORIZED = NO
PROVIDER_CALL_AUTHORIZED = NO
CREDIT_MUTATION_AUTHORIZED = NO
STAGING_MUTATION_AUTHORIZED = NO
```

No runtime required for this decision.

## 25. Step 3 lock criteria

Step 3 (consolidation/lock) requires:

1. This decision document exists and is complete
2. `TASKS.md` board reflects Step 2 DECISION COMPLETE
3. `TASKS_BACKLOG_FULL.md` reflects Step 2 DECISION COMPLETE
4. No conflicting state exists
5. Keith commits the Step 2 state
6. Step 3 window verifies committed state, marks COMPLETE AND LOCKED
7. Lane 3 remains DISABLED
8. MAX_IMPLEMENTATION_LANES remains 2

---

## Step 2 activity ledger

```
LIVE=0
SSH=0
staging=0
provider=0
credits=0
gates=0
runtime=0
Docker=0
Postgres=0
Redis=0
dev servers=0
browser smoke=0
product implementation=0
test implementation=0
source changes=0
dependencies=0
migrations=0
Git mutations=0
tests executed=0
PRD.md edits=0
ARCHITECTURE.md edits=0
CLAUDE.md edits=0
AGENTS.md edits=0
scheduler capacity changes=0
Lane 3 enablement=0
Lane 3=DISABLED
invitation registration=0
```

Allowed Step 2 writes: this decision document, `TASKS.md` CURRENT EXECUTION BOARD, `TASKS_BACKLOG_FULL.md` GOV-PARALLEL-01 status.

---

## Failure-isolation prerequisite assessment (detailed)

**Question:** Is empirical proof of "Lane A fails while Lane B continues safely" a mandatory prerequisite before permitting THREE lanes?

**Answer:** YES — but it is subsumed by the broader decision.

**Reasoning:**
1. Failure isolation is the primary safety mechanism enabling parallelism at any scale.
2. If failure isolation doesn't work at 2 lanes, it certainly won't work at 3.
3. Increasing concurrency without proven containment amplifies the blast radius of any failure.
4. The design (disjoint write sets → revert isolation by construction) is theoretically sound but practically unproven.
5. Keith must actually perform selective reverts correctly; this has never been tested.

However, this prerequisite is subsumed by the Option D decision: since Lane 3 is kept disabled until a future material need (which itself requires a new governance lifecycle), that future lifecycle would naturally include failure-isolation evidence as a prerequisite for enablement.

## Throughput prerequisite assessment (detailed)

**Question:** Is it rational to add a third implementation lane when we have not yet shown that the second lane provides material wall-clock benefit?

**Answer:** NO — it is not rational.

**Reasoning:**
1. The only purpose of parallel lanes is throughput (doing work faster).
2. If 2-lane parallelism doesn't measurably reduce elapsed time, 3-lane parallelism certainly won't.
3. Governance overhead (admission, monitoring, consolidation, failure recovery) is a real per-lane cost.
4. If governance overhead dominates implementation time for small bounded tasks, additional lanes provide zero net benefit.
5. The pilot's actual calendar time was dominated by governance steps, fixture repairs, and serialized validation — not by parallel implementation time.

This assessment reinforces Option D: without demonstrated throughput benefit, there is no rational basis to increase capacity.

## Candidate-supply assessment (detailed)

**Question:** Are three mutually independent tasks likely to occur often enough to justify permanent additional control-plane complexity?

**Answer:** NO — based on available evidence.

**Evidence:**
- The pilot inventory examined 7 frontier candidates across all workstreams
- Only 1 EXCELLENT pair was found (GATEWAY + FRONTEND/I18N)
- 3 plausible pairs were scored; 2 were rejected for conflict
- The project has ~4 major writable domains
- Finding 3 tasks with mutually non-conflicting write scopes AND non-conflicting mutexes AND no shared contracts requires all different domains
- Many tasks need infrastructure mutexes (PACKAGE, MIGRATION, ENV) that limit combinatorial freedom

**Conclusion:** Three-lane capacity would be unused far more often than used. The governance cost of maintaining that capacity (documentation, prompt infrastructure, admission logic, failure-recovery procedures) would rarely be justified by actual parallel execution.

---

*Decision frozen 2026-08-27 — GOV-PARALLEL-01 Step 2 — LANE3_DECISION=KEEP_DISABLED_UNTIL_FUTURE_MATERIAL_NEED — evidence from PILOT-2LANE-01 analyzed — fail-closed posture upheld — Lane 3 DISABLED — MAX_IMPLEMENTATION_LANES=2 — no scheduler-capacity change — no source change — no CLAUDE.md change — invitations PARKED.*
