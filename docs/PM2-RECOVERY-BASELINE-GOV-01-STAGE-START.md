# PM2-RECOVERY-BASELINE-GOV-01 — Stage-Start / Freeze (Step 2)

**Task:** PM2-RECOVERY-BASELINE-GOV-01 — Decide A1 first-run applicability wording and A2 expected-baseline provenance policy
**Nature:** GOVERNANCE / DECISION (4-step). No implementation lane. No sidecar candidate.
**Step:** 2 of 4 — reviewable freeze of the A1 / A2 decision object and decision matrix.
**Step 2 date:** 2026-09-19
**Step 2 HEAD at window open:** `b3b2f10895c2b90954db31dafaa6da6e2e0427be` (branch main; working tree clean; matches the expected baseline)
**Registration:** `TASKS_BACKLOG_FULL.md` § PM2-RECOVERY-BASELINE-GOV-01 (Step 1 COMPLETE at HEAD `2c01bff9ebdb00c84c3ff30af23201a636f60096`)
**Freeze status:** FROZEN for review. **No decision is selected in this document.** `OUTCOME_SELECTED=NONE`. A1 OPEN. A2 OPEN. K-B1 / K-B2 remain `UNRESOLVED_INPUT`.
**Correction record:** one consolidated Step 2 correction applied 2026-09-19 before any Step 3 (§12). The corrected text below is the controlling freeze.
**Steps 3–4:** NOT AUTHORIZED by this document.

This document freezes *what Keith is being asked to decide* and *what each answer does and does not do*. It adopts nothing. Every wording below is a proposal until Step 3 records exactly one outcome against §7. Any prior chat brief is superseded by this freeze and has no authority.

---

## 0. Invariants preserved by this freeze (not re-decided)

| Invariant | State | Source |
|---|---|---|
| P1 (recovery-policy contract) and P2–P8 | BINDING, unchanged | PM2-FENCE-01 §6; POLICY-01 §3 |
| A4 (P7 residual daemon-buffer wording) | ADOPTED by POLICY-01 R3; unchanged; no host/time-specific attestation exists | POLICY-01 §3.5 / §13 |
| A1, A2 | OPEN / UNADOPTED | POLICY-01 §13.7 / §14.5 |
| A3 | out of this task | POLICY-01 |
| Host state | UNCLEAN / HOLD; `HOST_CLEAN=NO`; `P7_ACCEPTED=NO` | PM2-FENCE-01 §8; POLICY-01 §4 |
| OUTCOME_UNKNOWN_POLICY reopen gate | UNSATISFIED | PM2-FENCE-01 §8 |
| AGENT-PLATFORM-EXEC-01C6A | `startCondition=NOT_READY`; not reopened; not admitted | board / sidecar |
| Builder Ask gate (`GLOBAL_EXECUTION_ENABLED` on Gateway) | LEFT ON (2026-09-14 evidence); not changed here | BUILDER-LIVE-GATE-01 checkpoint |
| Verifier (`compare_dual_env.py` v1.0.0) | COMPLETE AND LOCKED; comparison-only; NOT APPROVED FOR LIVE USE; schema unchanged | VERIFY-01 §4–§5, §14.8 |
| Frozen catalog `HARNESS_ENTITLEMENT_PROOF_V1` | FROZEN; not consumed or mutated | board |
| Restoration payload (per-run preserved vault; EXEC-01C6 §5.3 "unset / previous"; CANARY §4 SET/EMPTY/ABSENT matrix) | UNCHANGED | EXEC-01C6 §5.3 / §16; CANARY-EVIDENCE §4 |
| Recovery-material preservation (E1–E5; no deletion, replacement, rotation, clearance) | BINDING | POLICY-01 §4.3 / §6.2 |

Nothing in §§1–8 weakens a row of this table.

---

## 1. Area A — Authority and acceptance object

### 1.1 What this task decides

This task's **acceptance object** is exactly two contract items carried forward by locked PM2-RECOVERY-POLICY-01 as "later explicit governance record":

- **A1** — a first-run **applicability amendment** to the recovery-policy contract: the prerequisites under which a host/app pair with no prior applicable recovery run may enter the recovery path at all. Approving A1 approves *prerequisite text*. It is not evidence that the prerequisites are met for any host or run.
- **A2** — an **expected-baseline authority policy**: whether an authoritative expected baseline B(H) is required, what it must cover, where its per-key expectations may come from, what makes it valid, what invalidates it, and how (if at all) it may be used or reissued after an invalidating event. Approving A2 approves a *provenance and validity policy*. It designates no source, value, or token.

### 1.2 What this task does not decide and does not perform

The following are **separate objects** with separate authorization. None is advanced by any Step 3 outcome:

| Separate object | Why separate | Where it lives |
|---|---|---|
| Constructing a reference document (`aisb.pm2-dual-env-reference.v1`) | later authorized preparation work; requires an approved provenance policy first, then per-key adoption records | VERIFY-01 §3.3 (vault→reference converter rejected), §4.1 |
| Acquiring an observation (`pm2 jlist` bytes) | VERIFY-01 §3.4 acquisition prerequisite is identified, **unregistered**; involves STAGING / PM2 client side effects (POLICY-01 §5.6) | separately registered task, if ever |
| Accepting host evidence for P4 / P5 / P7 (S2) | host-specific, time-specific attestation; cannot be produced by contract text | POLICY-01 §4 / §8.1 |
| C1 amendment of EXEC-01C6A acceptance / restoration matrix | direction recorded by POLICY-01; the amendment itself is a separately authorized step | POLICY-01 §13 (C1) |
| Reopening EXEC-01C6A (P8) | requires the §8 reopen gate; contract text cannot satisfy it | PM2-FENCE-01 §8 |
| Executing a canary | requires reopen + admission + runtime mutexes | EXEC-01C6A |
| Verifier schema or code change | LOCKED; any change is a new registered task | VERIFY-01 §14.8 |

**Rule A-1 (frozen):** A complete affirmative outcome on both A1 and A2 yields a *defined* first-run contract. It never yields a *usable* first-run path. Usability additionally requires: registration and completion of the acquisition prerequisite; construction of the reference(s) under the approved policy with per-key adoption records; S2 host evidence accepted by Keith; the §8 reopen gate satisfied; EXEC-01C6A reopened and admitted. Each of those is outside this task.

**Rule A-2 (frozen):** A partial or incomplete outcome (any D-item `UNRESOLVED_INPUT`, any refusal, any incompatible pair per §7.5, any contradictory combination per §7.5b) leaves the affected amendment OPEN. OPEN is not "approved pending"; it blocks the dependent items listed in §7.4.

---

## 2. Area B — A1 first-run applicability

### 2.1 Three distinct kinds of "history" (frozen vocabulary)

| Code | Meaning | How it is handled |
|---|---|---|
| **H1** | Evidence of **prior applicable recovery work** for (host H, app A): a prior 01C6A-class overlay dispatch or run on H, or material produced *by such a run* — a per-run preserved vault, a canary journal, a pre-apply capture taken by that run, a restore transcript, an operator ledger entry recording such a dispatch — from any operator, on any date | Presence of any H1 item makes the "first run" premise false for (H, A). The path defined by A1 is **not applicable**; the P2/P3 path for hosts with history governs. All H1 items are preserved unchanged (§2.4). |
| **H0** (not H1) | **First-run preparation records** produced under separately authorized preparation *for* the first run itself: the B(H) reference document and its provenance / authorization record, acquisition observations taken to construct or cross-check B(H), the H2 attestation, the pre-run comparison report | These are prerequisites of the first-run path, not evidence of prior recovery work. They do **not** defeat the first-run premise. They are preserved and ledgered like all recovery material (§2.4). An item is H0 only by **explicit classification**; a preparation record is reclassified H1 if it evidences an actual prior overlay dispatch on H. |
| **UNCLASSIFIED** | Any discovered, potentially relevant recovery material for which the H0 / H1 classification decision has not yet been recorded | Keeps first-run eligibility for (H, A) **unresolved** until classified. UNCLASSIFIED is **not** treated as H0 and is **not** evidence that no H1 item exists; A1 clause (a) cannot be satisfied while any UNCLASSIFIED item for (H, A) exists. Preserved unchanged (§2.4). |
| **H2** | *Gaps* in the record of other operator activity on H that is not itself an applicable recovery run: undocumented `pm2 restart/reload/start --update-env`, `pm2 save`, `pm2 resurrect`, ecosystem edits, manual `pm2 set`/`unset`, daemon restarts, operator sessions with no ledger entry | Cannot be closed by any repository search. A control-plane registry proves only what it recorded. H2 is handled by an **attestation** whose acceptance threshold is Keith's choice (D2b). |
| **H3** | Residual uncertainty about what the running PM2 daemon holds in memory (latent overlay / buffered state) independent of any operator record | Already governed by adopted A4 wording under P7. **Not** attested by this task. No A1 outcome accepts P7 residual risk. |

**Rule B-1 (frozen):** "The repository shows no prior run" is an H2 statement about the repository, not an H1 statement about the host. It never satisfies an H1 requirement.

**Rule B-2 (frozen):** Preparing for a first run (constructing B(H), acquiring an observation to cross-check it, writing the H2 attestation, running the pre-run comparison) creates records that are classified H0 by explicit decision. H0 records never make the first-run premise false. Only evidence of an actual prior overlay dispatch or run on H (H1) does. Until classified, a discovered item is UNCLASSIFIED and leaves eligibility unresolved (§2.1); the classification decision is not inferred from the item's apparent origin.

### 2.2 Proposed A1 wording — Option A1-F (freeze text; for Keith's D2; corrected 2026-09-19, §12)

A1-F preserves every prerequisite of the locked POLICY-01 §3.3 controlling A1 text ((a) history attestation, (b) dual-field pre-mutation baseline read with no divergence, (c) r3 mechanics confirmation) and adds the explicit H0 / H1 / H2 / H3 split, the discovery rule, and the link to A2. It does not remove a prerequisite.

> **A1 (first-run applicability).** For a host H and PM2 application A, **P2 and P3 remain binding obligations for every future applicable run.** Because a first authorized run on H has no prior applicable run to supply a run outcome (P2) or a recovery vault (P3), the **first-run prerequisites** for P2 / P3 are, and only are, the following, all of which must hold at the time of the applicability decision:
>
> (a) **No H1 item exists.** No evidence of prior applicable recovery work for (H, A) — a prior 01C6A-class overlay dispatch or run, or material produced by such a run (per-run vault, canary journal, run pre-apply capture, restore transcript, ledger entry recording such a dispatch) — is known to Keith or has been discovered by the attestation search, **and no discovered item for (H, A) remains UNCLASSIFIED** (§2.1 / §2.4 item 4). First-run preparation records explicitly classified H0 (the B(H) reference and its provenance / authorization record, acquisition observations for B(H), the H2 attestation, the pre-run comparison report) are **not** H1 and do not defeat this clause; an UNCLASSIFIED item is neither H0 nor evidence of no H1 and leaves (a) unsatisfied until classified. If any H1 item is later discovered or an item is classified H1, (a) is false from that moment, the first-run premise is withdrawn for (H, A), and every discovered item is preserved unchanged under POLICY-01 §4.3 / §6.2 pending a separate Keith decision on its designation.
>
> (b) **H2 attestation accepted.** Keith has accepted a dated, host-specific written attestation for (H, named apps) that enumerates (i) every operator activity on H since the last daemon start that is known to Keith, including `--update-env` / restart / `pm2 save` / `pm2 resurrect` / deploy activity, (ii) every period for which no record exists, and (iii) the search performed (repository, ledgers, operator memory, host artefacts reviewed, if any). The attestation does **not** claim absence of unrecorded activity. Acceptance is Keith's decision under the threshold chosen at D2b.
>
> (c) **Valid pre-run dual-field comparison evidence with no divergence.** A dual-field pre-mutation observation of (H, A) has been compared under the LOCKED verifier against the approved reference required by clause (e), and the invocation produced **valid comparison evidence**: an accepted report with `result ∈ {MATCH, MISMATCH, DIVERGENT}` over the complete-coverage reference (Rule C-1), retained under the operator ledger. `INVALID_INPUT` and `INTERNAL_ERROR` outputs are diagnostics only and **cannot satisfy this clause**; the comparison must be re-performed under a new authorized acquisition after the defect is corrected. The accepted result must be **not DIVERGENT** (DIVERGENT is P6 FAIL — never "close enough"). If the result is **MISMATCH**, this clause is **not met**: resolution of a mismatch is a **separately authorized corrective decision** (POLICY-01 §3.4 item 5: a finding to resolve, never a reason to overwrite the reference with the observation, and never permission to ignore the mismatch), and after that decision the clause requires **subsequent evidence** — a new authorized acquisition compared against the reference as it then stands (unchanged, or reissued / corrected under D4 and the approved provenance policy) yielding an accepted `MATCH` with no DIVERGENT key — before it can be met. A MATCH is comparison evidence at the observation time only; no comparison result establishes restoration success, command fate, or host CLEAN. This clause presupposes an authorized acquisition (VERIFY-01 §3.4, currently unregistered); until one exists, A1 is contract text only.
>
> (d) **r3 mechanics confirmed.** Keith has confirmed that the r3 journal-before-dispatch, monotonic latch, and retention mechanics are the ones that will govern the run, and that the run's own per-run preserved vault remains the sole restoration payload (§4.1).
>
> (e) **Expected baseline.** If A2 is adopted as REQUIRED, an approved-provenance, complete-coverage B(H) exists for (H, A) under the A2 policy before the clause (c) observation is compared. If A2 is not adopted as REQUIRED, (e) is **unresolved** and A1 cannot be applied until Keith approves a concrete non-circular alternative reference source (§3.6).
>
> (f) **H3 unchanged.** Residual daemon-buffer uncertainty remains governed by P7 as amended by A4. Nothing in this amendment attests P7 for H.
>
> Satisfying (a)–(f) is an amended **prerequisite** set, not evidence that the original P2 / P3 requirements have been met; P2 / P3 become evidence-bearing for H only after the first dispatch and are then verified per run. Satisfying (a)–(f) does not establish host CLEAN, does not satisfy P4–P8, does not accept P7 residual risk, does not reopen any task, and does not authorize acquisition or a canary.

### 2.3 Alternative A1 wording — Option A1-L (locked POLICY-01 §3.3 controlling text, unchanged)

Keith may instead adopt the locked POLICY-01 §3.3 A1 controlling proposal verbatim ("For a first authorized canary window on host H, P2 and P3 remain binding obligations … first-run prerequisites … (a) a Keith-accepted host-history attestation … (b) a dual-field pre-mutation baseline read with no `BASELINE_DIVERGENT` finding; (c) confirmation that the r3 journal-before-dispatch, monotonic latch, and retention mechanics are the ones that will govern the run … an amended prerequisite, not evidence that the original P2/P3 requirements have been met"). Accurate differences:

| Point | A1-L (locked §3.3 controlling text) | A1-F (§2.2) |
|---|---|---|
| P2 / P3 remain binding for future applicable runs | stated | stated (same) |
| History attestation prerequisite | (a) Keith-accepted host-history attestation for (H, named apps) covering unrecorded `--update-env` / restart activity | (b) same content, enumerating known activity, unrecorded periods, and search performed; explicitly "does not claim absence"; threshold chosen at D2b |
| Pre-mutation baseline read | (b) dual-field read with no `BASELINE_DIVERGENT` finding (r3 guard vocabulary) | (c) valid comparison evidence (accepted MATCH / MISMATCH / DIVERGENT report; INVALID_INPUT / INTERNAL_ERROR cannot satisfy) under the LOCKED verifier against the clause (e) reference; result not DIVERGENT; MISMATCH leaves the clause unmet until a separately authorized corrective decision and a subsequent accepted MATCH; acquisition presupposed and unregistered |
| Discovered material pending classification | not addressed | UNCLASSIFIED keeps eligibility unresolved; not H0, not evidence of no H1 (§2.1) |
| r3 mechanics confirmation | (c) stated | (d) same, plus explicit "per-run vault remains sole restoration payload" |
| H0 / H1 / H2 / H3 vocabulary | not used; "no prior 01C6A run on H exists" is a premise, not a clause | explicit: (a) H1 absence with H0 carve-out; (b) H2; (f) H3 |
| Discovery of H1 material after adoption | requires interpretation | explicit withdrawal of premise + preservation + separate designation decision |
| Preparation records defeating the premise | not addressed | excluded (H0; Rule B-2) |
| Registry-cannot-prove-absence | stated in the §3.3 risk column ("Absence of a recorded dispatch is not evidence of absence") | stated as Rule B-1 and inside clause (b) |
| Link to A2 REQUIRED / non-circular alternative | not stated (the read is "against the baseline"; reference source left to A2) | clause (e) |
| Threshold for accepting an incomplete attestation | Keith's acceptance (no stricter rule) | Keith's acceptance, threshold chosen at D2b |

Neither option contains a categorical "any UNKNOWN disqualifies" rule. That rule is a **separate, unadopted** choice (D2b, §2.5). Neither option waives P2 / P3.

### 2.4 Discovered recovery material — frozen handling (D9)

Applies to every A1 outcome and to the H1 check itself:

1. Discovery may yield **zero, one, or several** items across operators and dates. No count is presumed.
2. **Every** discovered item is preserved unchanged: no deletion, replacement, rotation, renaming into a "superseded" location, clearance, or overwrite; no "fresh vault" is created to stand in for it.
3. No item becomes "the" E1 vault, "the" baseline, or "the" restore payload automatically. Designation of each item (E1 / E2 / E3 / E4 / E5 / not-applicable) is a **separate, explicit, per-item Keith decision**, recorded outside this task.
4. Each discovered item is classified **H0** (first-run preparation record) or **H1** (evidence of prior applicable recovery work) by explicit decision, and is **UNCLASSIFIED** until decided. An UNCLASSIFIED item for (H, A) keeps first-run eligibility **unresolved**: it is not treated as H0 and is not evidence that no H1 item exists (A1 clause (a) is unsatisfied while it stands). Only an H1 classification withdraws the first-run premise for (H, A) (§2.2 (a)). Withdrawal does not by itself decide which P2/P3 path applies; that is the existing contract's job.
5. Discovery of material for a **different** app or host is recorded but does not withdraw the premise for (H, A); it does raise the H2 gap count for the attestation.

### 2.5 Stricter history threshold — separate, unadopted choice (D2b)

- **D2b = ACCEPTANCE** (the locked proposal's threshold): Keith may accept an attestation that discloses H2 gaps, with the gaps recorded. Acceptance is Keith's judgment; disclosure is mandatory.
- **D2b = STRICT**: any disclosed H2 gap (any period without a record of operator activity on H since the last known daemon start) makes the attestation **unacceptable**; the first-run path is not applicable until the gap is closed by evidence. Because the registry cannot prove absence of unrecorded activity (Rule B-1), STRICT is in practice a decision that the first-run path is unavailable for the current staging host unless host-side evidence (outside this task) closes the gaps.
- D2b is meaningful only if D2 ∈ {A1-F, A1-L}. If D2 = NO or UNRESOLVED_INPUT, D2b is VOID.

Neither value is adopted here.

---

## 3. Area C — A2 baseline authority and coverage

### 3.1 What B(H) is (frozen definition)

B(H) is a **declared expected state** for a frozen set of (app, key) pairs on host H, expressed per key for **both** PM2 fields (`pm2_env[k]` and `pm2_env.env[k]`) in the verifier's SET / EMPTY / ABSENT vocabulary. It is **comparison-only** (§4). It is not a restore payload, not an observation, and not evidence of host state. Its authority is `NOT_EVALUATED_BY_VERIFIER` (VERIFY-01 §4.7 / §5.4): the verifier compares what it is given and never certifies the reference.

**Rule C-0 (frozen; LOCKED schema facts):**
- The two field expectations of one key **must be identical** (state and value / token); the verifier refuses anything else (`REFERENCE_FIELDS_INCONSISTENT`, VERIFY-01 §4.1). Unequal field expectations in a reference establish only **schema incompatibility** with the verifier's reference contract; they say nothing about the host, an overlay, or any cause. Consequently every expectation in B(H) is one (app, key) expectation applied to both fields; no field-specific expectation exists.
- Payload shape: `state=SET` on a non-protected key carries exactly `value`; `state=SET` on a protected key carries exactly a RESTRICTED `token` (`sha256:<hex>` of the value, VERIFY-01 §4.6); `state=EMPTY` or `ABSENT` carries **no** payload on any key (a payload there is refused, `EXPECTATION_SHAPE`). Protected keys are therefore tokenised only when expected SET.
- The schema carries **one** `provenance` block per reference (`declared_by`, `source_kind`, `source`, `declared_at`, `authorization_record`), checked for shape only and not copied into the report. **Per-key provenance is not representable inside the schema** and no schema change is included. The per-key provenance mapping (§3.3) lives in the external provenance / authorization record (§5.1) and is linked from the reference through the supported free-text fields `source` and `authorization_record` (each naming the external record's identifier / hash). `source_kind` carries the single enum that describes the reference as a whole (`INTENT_DECLARATION`, `OBSERVATION_ADOPTED_BY_DECISION`, or `OTHER` when the per-key mapping mixes kinds).

### 3.2 Proposed app/key coverage matrix (grounded; proposal only)

Apps (frozen): **G** = `aisandbox-api-gateway`; **W** = `aisandbox-ai-service` (worker).

Coverage classes (frozen vocabulary):
- **REQUIRED** — a complete B(H) must declare both fields for this (app, key). Omission = incomplete coverage = the reference is not complete B(H) regardless of any MATCH.
- **RECOMMENDED** — declared expectation is advisable for conformance evidence; omission does not make B(H) incomplete but is listed as a coverage gap in the governance record.
- **OPTIONAL (D8)** — inclusion is Keith's D8 choice.
- **EXCLUDED** — not in the frozen key set for this task.

Basis rule (proposal, frozen for review): an (app, key) pair is REQUIRED if the EXEC-01C6A apply/restore set (EXEC-01C6 §5.3 / §16; CANARY-EVIDENCE §4 / §4.1) can mutate that key on that app, **or** locked POLICY-01 §6.2 names it as at risk from delayed mutation on that app. Where the cited sources do not fix the app assignment of an applied key, the conservative rule is **both apps REQUIRED**.

**Coverage authority (frozen; corrected 2026-09-19, §12):** locked POLICY-01 §3.4 item 1 requires B(H) to carry the app names (`aisandbox-ai-service`; `aisandbox-api-gateway` "for xAI") and "the exact named-key list" (EXEC-01C6 §5.3 / CANARY-EVIDENCE §4 variables). It does **not** explicitly establish which named keys apply to which app, and it does **not** establish that every named key must be declared on both apps. Per-app coverage is therefore **unresolved by the locked text** and must be fixed by an explicitly approved coverage matrix (I-1). Two proposals are offered, neither adopted:

- **Matrix M-1 (§3.2 table below):** per-app REQUIRED / RECOMMENDED / OPTIONAL(D8) / EXCLUDED classes under the basis rule; RECOMMENDED pairs may be omitted and are recorded as coverage gaps. M-1 relies on proposed amendment AM-5 (§3.4a) for the RECOMMENDED class.
- **Matrix M-2 (conservative-all):** every key in the frozen set (§3.2 rows other than `AI_PROVIDER`; `OPENAI_API_KEY` only via a complete D8 INCLUDE) is REQUIRED on **both** apps; no RECOMMENDED class; every pair needs approved provenance. M-2 does not rely on AM-5. It is an explicitly approvable **conservative proposal**, not a default.

If no matrix is approved at I-1, coverage is **UNRESOLVED** and A2 cannot be ADOPTED. Refusing AM-5 does **not** adopt M-2 or any other coverage policy automatically; it only makes M-1 unavailable (§7.5b compatibility AM-5 ↔ I-1).

**I-4 reconciliation (frozen):** while I-4 (which app(s) the 01C6A dummy `XAI_API_KEY` apply targets) is unresolved, the coverage rule under either matrix is both-REQUIRED; a reference may be **constructed** under that rule only if approved provenance supplies an expectation for the key on **both** apps. If provenance exists for one app only, the other pair is UNDECLARED, the reference is incomplete (Rule C-1), and construction is blocked until either provenance is found or I-4 is resolved and Keith **explicitly amends** I-1 to narrow that pair to RECOMMENDED. Resolving I-4 never narrows coverage automatically; a coverage amendment is a recorded Keith decision.

| Key | G | W | Protected | Basis |
|---|---|---|---|---|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | RECOMMENDED | REQUIRED | no | EXEC-01C6 §5.3 (worker flag); LIVE-GATE observed SET on G (conformance value) |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | RECOMMENDED | REQUIRED | no | EXEC-01C6 §5.3 |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | RECOMMENDED | REQUIRED | no | EXEC-01C6 §5.3 |
| `AGENT_HARNESS_STUB_WRITE_MODE` | RECOMMENDED | REQUIRED | no | EXEC-01C6 §5.3 |
| `HARNESS_ENTITLEMENT_HMAC_SECRET` | REQUIRED | REQUIRED | **yes** | EXEC-01C6 §5.3 (worker and Gateway where signing is required); CANARY §4 |
| `EXECUTION_PROVIDER_RETRY_ATTEMPTS` | RECOMMENDED | REQUIRED | no | CANARY §4 (worker execution provider) |
| `EXECUTION_TIMEOUT_MS` | RECOMMENDED | REQUIRED | no | CANARY §4 |
| `XAI_API_KEY` (01C6A dummy) | REQUIRED (pending I-4) | REQUIRED (pending I-4) | **yes** | CANARY §4 (dummy placeholder; app not fixed); POLICY-01 §3.4 item 1 names G for xAI; adapters are worker-side → conservative both |
| `PROVIDER_XAI_ENABLED` | RECOMMENDED | RECOMMENDED | no | CANARY §4 precondition ("must not be false"); not applied by 01C6A |
| `GLOBAL_EXECUTION_ENABLED` | REQUIRED | RECOMMENDED | no | POLICY-01 §6.2 names G at risk; BUILDER-LIVE-GATE-01 evidence (G, 2026-09-14); not in 01C6A apply set |
| `OPENAI_API_KEY` | OPTIONAL (D8) | OPTIONAL (D8) | **yes** | CANARY §4 (01C6B only); D8 |
| `AI_PROVIDER` | EXCLUDED | EXCLUDED | no | not a named key in EXEC-01C6 §5.3 / CANARY §4; `AI_PROVIDER=xai` establishes nothing about credential presence or location (UNKNOWN) |

**Rule C-1 (frozen):** A reference is **complete B(H)** only if every REQUIRED (app, key) pair (as approved at I-1, adjusted by D8 and any explicitly approved I-1 amendment) carries one expectation applied identically to **both** fields (Rule C-0). A MATCH produced by the verifier over a reference that omits any REQUIRED pair is a MATCH on **reduced coverage**; it is recorded as such and does **not** satisfy complete-coverage B(H). The verifier cannot detect this (it compares only what is declared), so the coverage check is a governance step performed against the approved matrix before the comparison result is used.

**Rule C-2 (frozen):** `UNDECLARED` is a **planning status** used in this document and in the governance record for pairs whose expectation has not been declared. It is not a verifier state. An UNDECLARED REQUIRED pair is a coverage gap; it is omitted from the reference (the verifier rejects any other shape) and listed in the governance record. It never becomes ABSENT by default.

### 3.3 Candidate provenance per expectation and the exact approval each needs

Provenance kinds are proposals; none is accepted here. Each expectation in B(H) must cite exactly one kind and its dated record.

| Code | Candidate provenance | What it can establish | What it cannot establish | Exact approval needed before use |
|---|---|---|---|---|
| **PV-1** | Locked governance evidence naming a value/state for (app, key) — today only BUILDER-LIVE-GATE-01 for (G, `GLOBAL_EXECUTION_ENABLED`) dated 2026-09-14 | a *recorded intended* state on that date, on G, and the fields observed then | current state; W; other keys | Keith adopts the record as the expectation for both fields, dated, noting staleness |
| **PV-2** | Intended configuration read from a staging configuration file (`.env` for the app, ecosystem file, unit env) | *intent* for the **application-effective** plane | the PM2 fields the verifier compares; either PM2 field's actual state; the other app; ABSENT for a key that is missing from the file | (i) a separately authorized STAGING read (not this task); (ii) Keith's explicit per-(app, key) declaration that the intended value is the single expectation applied to **both** PM2 fields (Rule C-0; no field-specific expectation is representable) |
| **PV-3** | Observation adopted by decision: a `pm2 jlist` capture obtained under a separately authorized acquisition (VERIFY-01 §3.4), reviewed key by key | what the daemon reported at capture time | intent; authority; freedom from latent overlay (a divergent observation cannot be adopted as expectation for that key) | (i) the acquisition prerequisite registered and completed; (ii) Keith's explicit per-(app, key) adoption, dated, with the observation id; (iii) the observed pair not DIVERGENT |
| **PV-4** | Application code default | reasoning support for why a key *may* be expected ABSENT or a particular value on the application plane | any PM2-field expectation | not admissible as sole provenance for any REQUIRED pair; may be cited as supporting rationale only |
| **PV-5** | `dump.pm2` / `pm2 save` contents | — | its contents are UNKNOWN; reading it is not authorized; what a future `pm2 resurrect` would restore is UNKNOWN | **not a candidate** for this task; recorded here to close the door |
| **PV-6** | Restoration material from a prior run (E1 vault) | — | first-run premise is false if it exists for (H, A) (§2.1 H1) | **not a candidate** for first-run B(H); if discovered, §2.4 applies |
| **PV-7** | A vault, capture, or journal created **by the blocked canary itself** (the run B(H) is meant to precede) | — | circular; presupposes the run | **not a candidate**; a first-run reference may not depend on the run's own artefacts |

**Rule C-3 (frozen):** Reading `.env` does not make its contents authoritative for either PM2 field of either app. A key **missing** from `.env` does **not** imply expected ABSENT; the expectation for such a pair remains UNDECLARED until Keith declares it via PV-1, PV-2 (with the explicit declaration that the intended value applies to both PM2 fields) or PV-3.

**Rule C-5 (frozen; per-key provenance mapping):** Each (app, key) expectation cites exactly one provenance kind and its dated approval record. This per-key mapping is kept in the external provenance / authorization record (§5.1), outside the LOCKED schema, and is linked from the reference via the supported `provenance.source` and `provenance.authorization_record` fields (Rule C-0). It is reviewed as class C material (VERIFY-01 §6.4); the verifier never evaluates it.

**Rule C-4 (frozen):** Observation adoption (PV-3) requires an explicit, dated, per-(app, key) Keith decision. Blanket adoption ("adopt the whole observation as baseline") is not an available approval form; it would collapse observation and expectation and would give a pre-existing latent state the status of intent.

### 3.4 Proposed A2 provenance policy — Option P-A (for Keith's D3; corrected 2026-09-19, §12)

P-A **preserves** every requirement of locked POLICY-01 §3.4 items 1–5 and departs from them only where §3.4a lists an explicit proposed amendment (AM-1 … AM-6). Nothing in §3.4 is otherwise weakened.

> **A2 (expected baseline authority) — Option P-A.** An authoritative expected baseline B(H) is **REQUIRED** before any first-run pre-run comparison for (H, A). B(H) is a reference document under the LOCKED verifier reference schema (`aisb.pm2-dual-env-reference.v1`), comparison-only, prepared as later authorized work. It is acceptable only if all hold:
>
> 1. **Identity (POLICY §3.4 item 1, preserved; AM-1 applies to the start-time carrier).** B(H) names the host (`aisandbox-staging`), the PM2 home (`/home/ubuntu/.pm2`, carried in `pm2_home`, compared and never echoed), the daemon PID it was prepared against (`daemon_pid`), the app names (`aisandbox-ai-service`, `aisandbox-api-gateway`) and the exact named-key list per app (its `apps` block), and its validity window (`valid_from` / `valid_until`). The daemon **start time** it is valid for is a §3.4 item 1 requirement; because the LOCKED schema has no field for it and none is added, it is carried in the external provenance / authorization record linked via `provenance.authorization_record` (AM-1; D6).
> 2. **Per key, per app, both fields (POLICY §3.4 item 2, preserved).** Every REQUIRED (app, key) pair carries one expectation ∈ {SET, EMPTY, ABSENT} applied identically to `pm2_env[k]` and `pm2_env.env[k]` (Rule C-0); SET non-protected → value; SET protected → `sha256:` token of the value only; EMPTY / ABSENT → no payload. Never a secret value in `docs/`, chat, or Git. Which named pairs are REQUIRED is fixed only by the coverage matrix explicitly approved at I-1 (M-1 with AM-5, or M-2, or an approved amended matrix); the locked text fixes the key list, not per-app coverage (§3.2 coverage authority).
> 3. **Provenance chain (POLICY §3.4 item 3, preserved; AM-4 applies to the carrier).** Every expectation records who declared it, from which source, when; each is *intent* (PV-1 / PV-2) or explicitly labelled observation adopted by Keith decision with date (PV-3). PV-4 is rationale only; PV-5 / PV-6 / PV-7 are excluded. The per-key mapping is carried in the external record and linked through the schema's single `provenance` block (Rule C-5; AM-4).
> 4. **Validity conditions (POLICY §3.4 item 4, preserved; AM-2 adds triggers).** B(H) is invalidated by: daemon restart; `pm2 update` / `resurrect`; any `--update-env` or `pm2 save` on the named apps (the canary's own included — Rule D-1); deploy of the named apps; change to `/opt/aisandbox/.env`; **and (AM-2)** any change to the frozen key set or approved coverage matrix, and expiry of `valid_until`. After invalidation B(H) is **retained** as the record of intended configuration (§4.3) and is **not usable** as a comparison reference unless Keith's D4 rule authorizes a reissue (AM-3).
> 5. **Cross-check before use (POLICY §3.4 item 5, preserved).** Before B(H) is relied upon, it is compared to a fresh dual-field observation under the LOCKED verifier; a MISMATCH is a **finding to resolve by explicit Keith decision**, never a reason to overwrite B(H) with the observation; a DIVERGENT observation cannot be adopted as expectation for the divergent key.
> 6. **Non-effects.** B(H) proves nothing. A MATCH against it is comparison evidence at the observation time; MISMATCH / DIVERGENT are comparison evidence without cause or timing. B(H) does not restore, does not replace the per-run restoration payload, does not attest host CLEAN, and does not satisfy P2–P8.

Option **P-N** (B(H) NOT required) is also available at D3; its consequence is §3.6.

### 3.4a Explicit proposed amendments to POLICY §3.4 carried by P-A (each is a proposal; none adopted; each is approved or refused as part of I-2)

| ID | POLICY §3.4 requirement | P-A departure | Why | If refused |
|---|---|---|---|---|
| **AM-1** | item 1: B(H) *contains* the daemon start time it is valid for | start time carried in the external provenance / authorization record, linked via `provenance.authorization_record`; `daemon_pid` / `valid_from` / `valid_until` inside the reference | LOCKED schema has no start-time field; `UNKNOWN_FIELD` fails closed; no schema change in this task | B(H) cannot be represented under the LOCKED schema; D3 = P-A is blocked until a schema task is separately registered. D6 = PROVENANCE_RECORD together with AM-1 refused is contradictory (§7.5b) |
| **AM-2** | item 4 trigger list | adds as *policy invalidation triggers*: change to the frozen key set / approved coverage matrix; expiry of `valid_until` | a reference whose key set no longer matches the approved matrix is incomplete by Rule C-1; expiry aligns policy with the verifier's existing window check | the policy trigger list is the locked five only. Refusal **cannot disable the verifier's existing validity-window checks**: an observation outside `[valid_from, valid_until]` still fails closed (`OBSERVATION_OUTSIDE_REFERENCE_VALIDITY` → INVALID_INPUT; no comparison evidence). Two distinct conditions must then be recorded separately: **expiry failure** (comparison unavailable; the reference is not "invalidated" by policy but cannot be compared against for that observation) and **missing coverage** (Rule C-1 gap; the reference is incomplete). Neither is a MATCH. |
| **AM-3** | item 4 says "invalidated"; silent on later use | D4 rule: PRE_RUN_ONLY or explicit per-window REISSUE (§4.3) | resolves the registered contradiction without exempting canary writes | invalidated B(H) has no post-event use; D4 must then be PRE_RUN_ONLY — D4 = REISSUE_PER_WINDOW together with AM-3 refused is contradictory (§7.5b); refusal does not itself select D4 |
| **AM-4** | item 3: provenance "per expected value" | per-key mapping kept in the external record; the reference carries one `provenance` block linked to it | schema has a single provenance block; no schema change | per-key provenance cannot be represented inside the reference; the same external record is still required for review, so refusal changes nothing operationally but must be recorded |
| **AM-5** | item 1: "exact named-key list" (fixes the key list; silent on per-app coverage and on omitting a pair) | permits a **RECOMMENDED** class: an approved matrix may designate pairs whose omission does not make B(H) incomplete, recorded as coverage gaps (used by matrix M-1) | avoids declaring worker-only keys on the Gateway without provenance | no RECOMMENDED class exists; matrix M-1 is unavailable; **no other coverage policy is adopted automatically** — coverage remains UNRESOLVED until Keith explicitly approves a matrix with no RECOMMENDED pairs (M-2, or an amended all-REQUIRED matrix) at I-1 (§7.5b) |
| **AM-6** | item 2 token convention (SHA-256 of value) | none — preserved; D7 decides only *where tokens may exist* (§5.2) | recorded so the token rule is visibly unchanged | n/a |

### 3.5 Inputs required to complete a D3 affirmative (recorded; unresolved)

| Input | Content | Exact options | Status |
|---|---|---|---|
| I-1 | Explicit approval of **one** coverage matrix as the frozen REQUIRED set (with D8 applied) | `APPROVE_M1` (§3.2 matrix M-1 as written; requires AM-5 approved) / `APPROVE_M2` (conservative-all; every frozen key REQUIRED on both apps; no AM-5 dependency) / `APPROVE_AMENDED <matrix text>` (Keith's recorded matrix; reviewed under Rule F-3 before approval is derived) / `NOT_APPROVED` / `UNRESOLVED_INPUT` | UNRESOLVED — **explicit approval required**; "recorded", "noted" or silence is not approval; no matrix is a default |
| I-2 | Approval of P-A text including a value for **each** of AM-1 … AM-5 (AM-6 is informational) | `APPROVE` (P-A as written; all listed amendments approved) / `APPROVE_AMENDED <per-amendment values and/or text>` (each AM approved or refused; any text change reviewed under Rule F-3) / `NOT_APPROVED` / `UNRESOLVED_INPUT` | UNRESOLVED — **explicit approval required**; an I-2 answer that omits any AM value is INCOMPLETE_AFFIRMATIVE; AM values are checked for compatibility with D4 / D6 / I-1 (§7.5b) |
| I-3 | D4 / D5 / D6 / D7 resolved (dependent items, §7.4) | as per item | UNRESOLVED |
| I-4 | App assignment of the 01C6A dummy `XAI_API_KEY`; until resolved both apps REQUIRED (§3.2 I-4 reconciliation) | fact input, not an approval; later coverage change requires an explicit I-1 amendment | UNRESOLVED (facts UNKNOWN to this freeze) |
| I-5 | Whether the LIVE-GATE 2026-09-14 record (PV-1) is accepted as expectation for (G, `GLOBAL_EXECUTION_ENABLED`) or a fresh PV-3 adoption is required | reference-construction input; does not block A2 adoption | UNRESOLVED |

No input is filled here.

### 3.6 If B(H) is declined (D3 = P-N)

Constraint 2 (registration) applies verbatim: the first-run **reference prerequisite remains UNRESOLVED**. This freeze identifies **no** concrete non-circular alternative. In particular, the following are not alternatives: a prior-run vault (does not exist by the first-run premise; if it exists, §2.1 H1); a vault or capture created by the canary itself (PV-7, circular); an unadopted observation (PV-3 without adoption is an observation, not an expectation); `.env` contents without a declared PM2-field mapping (Rule C-3). If Keith declines B(H) and names an alternative, it is recorded at D3-ALT for review in a later step; it is not approved by naming it. With D3 = P-N and D3-ALT = NONE, A1 clause (e) is unresolved and A1 cannot be applied even if adopted.

---

## 4. Area D — Restoration and reference lifecycle

### 4.1 Comparison-only; restore payload unchanged (D5)

- B(H) is used only as the `--reference` input of the LOCKED verifier. It is never written to any host, never used as a `--update-env` source, never used as a restore matrix.
- The **sole** restoration payload remains the per-run preserved vault plus the EXEC-01C6 §5.3 "unset / previous" rule and CANARY §4 SET / EMPTY / ABSENT matrix. Changing any restore target (including EXEC-01C6 §16 item 2 `GLOBAL_EXECUTION_ENABLED=false` vs BUILDER-LIVE-GATE-01 LEFT ON) is a **C1 restoration-matrix amendment** of EXEC-01C6A, separately authorized, not this task. A later B(H) declaration for that key must cite which governs; this freeze does not choose.
- Two references may eventually be prepared as later authorized work: B(H) (intent) and a per-run reference derived from the run's own pre-apply capture (fidelity). The verifier does not read vaults; the per-run reference requires its own preparation and provenance (VERIFY-01 §3.3). Neither is prepared here.

### 4.2 What comparison outcomes mean (frozen; restates registration constraint 5)

| Verifier result | Means | Never means |
|---|---|---|
| MATCH (exit 0) | the observed named fields equal the supplied reference at the declared capture time | restoration success; command fate; host CLEAN; policy satisfied; permission; that the reference is authoritative |
| MISMATCH (exit 3) | at least one declared field differs from the reference | when or why it differs; that the difference pre-existed; that a restore failed |
| DIVERGENT (exit 4) | `pm2_env[k]` ≠ `pm2_env.env[k]` in the observation | a proven latent overlay; its cause; its origin time |
| INVALID_INPUT (exit 2) | a **diagnostic report** was emitted (`apps={}`, zero counts, error codes with JSON pointers and fixed detail, identifiers `null` where not validated, constant `non_claims`); **no comparison was performed or accepted** | any accepted comparison; anything about host state; that inputs were "close enough" |
| INTERNAL_ERROR (exit 1) | a **minimal diagnostic report** and one stderr line carrying only the exception type name were emitted | any accepted comparison; anything about host state |

UNKNOWN, unproven restoration, retention and HOLD are unchanged by any result. Only MATCH / MISMATCH / DIVERGENT are **comparison evidence**; INVALID_INPUT / INTERNAL_ERROR are diagnostics and satisfy no prerequisite that requires comparison evidence (A1 clause (c)). An `OBSERVATION_OUTSIDE_REFERENCE_VALIDITY` INVALID_INPUT is an **expiry failure** (comparison unavailable for that observation), distinct from **missing coverage** (Rule C-1 gap) and from MISMATCH.

### 4.3 Invalidation, retained intent, observation validity, authorization — three planes (D4)

The registered contradiction is: P-A item 4 invalidates B(H) on **any** `--update-env`, and the canary itself uses `--update-env`, so a post-run B(H) comparison appears impossible without either exempting the canary's writes or silently renewing authority. Neither is permitted. The freeze separates three planes:

| Plane | Object | Survives an invalidating event? |
|---|---|---|
| **Intent** | the declared expected configuration (the content of B(H)) | **Yes** — retained as record (§3.4 item 4); invalidation does not delete or alter it |
| **Observation validity** | whether a given observation of H may be compared against a given reference (host, PID, validity window, freshness — VERIFY-01 §4.8) | **No** — after the event the old reference's validity assumptions about the daemon no longer hold |
| **Authorization** | whether Keith has authorized use of a reference for a specific comparison in a specific window | **No** — a fresh, explicit authorization is required for any post-event use |

Two D4 options, exactly one to be chosen at Step 3 if D3 = P-A:

- **D4 = PRE_RUN_ONLY.** B(H) is authorized for pre-run comparison only. After the canary's first `--update-env`, B(H) is invalidated and retained; no post-run comparison against B(H) is authorized by the A2 policy. Post-run conformance to *intent* would require a separate future decision. Effect: no contradiction; the post-run P6 record (if C1 later mandates one) compares only against the per-run reference (fidelity), not intent.
- **D4 = REISSUE_PER_WINDOW.** After an invalidating event, Keith may **explicitly** authorize a **new** reference document B(H)-v(n+1) whose *intent content* is the retained content of B(H)-v(n) (unchanged, or changed with a recorded reason), with a new `reference_id`, a new validity window, and a new dated authorization record (D6) that names the invalidating event(s) it follows. **Identity fields reflect evidence, not ceremony:** `daemon_pid`, `pm2_home` and the external daemon start time are re-recorded from the reissue authorization record's evidence — the **same** `daemon_pid` and start time when the invalidating event did not restart the daemon (e.g. a `--update-env` alone), a **new** PID / start time only when the record evidences a restart. A reissue must not declare a PID that the evidence does not support. Each reissue is a separate authorization for a separate window; it is not a renewal, not an exemption for canary writes, and not automatic. Effect: post-run comparison against intent becomes possible per window; the contradiction is resolved by explicit reissue rather than by exemption.

**Rule D-1 (frozen):** Under either option the canary's own `--update-env` operations invalidate the then-current B(H). There is no canary exemption.

**Rule D-2 (frozen):** E2 (the operator ledger of known activity) records **known** activity; it does not prove **exclusive** activity. A reissue authorization may cite E2 but E2 does not establish that nothing else happened. Reissue approval does not substitute for P4 / P5 evidence, does not accept P7 residual risk, and does not lift HOLD.

**Rule D-3 (frozen):** C1 (POLICY-01 direction) does **not** already mandate a post-run B(H) comparison. Whether a post-run P6 record compares against the per-run reference, against B(H)-v(n+1), or both is a C1 acceptance-contract amendment decision, separately authorized. D4 decides only whether the A2 policy *permits* a reissued B(H) to exist; it does not require anyone to use it.

---

## 5. Area E — Evidence representation and handling

### 5.1 Daemon start time vs `valid_from` vs declared PID (D6)

- The LOCKED reference schema has `daemon_pid`, `valid_from`, `valid_until`; it has **no** daemon-start-time field and none is added (VERIFY-01 §4.1 / §14.8).
- `valid_from` is the **reference's** validity start. It is not, and must not be recorded as, the daemon start time.
- `daemon_pid` equality is **declared-field comparison** (VERIFY-01 §4.8 / §5.4 `freshness.limitations`). It does not prove daemon lifetime, continuity, or authenticated identity. PID reuse after restart is undetectable by the tool.
- Therefore the daemon start time B(H) is valid for (POLICY-01 §3.4 item 1) lives in an **external provenance / authorization record** kept with the reference in the operator ledger (class C material per VERIFY-01 §6.4), together with: how the start time was obtained, by whom, when, and what evidence supports it. This record is what D4 REISSUE names when citing invalidating events.

D6 options: **PROVENANCE_RECORD** (the above) / **UNRESOLVED_INPUT**. There is no "put it in the reference" option because the schema forbids unknown fields (`UNKNOWN_FIELD` → `INVALID_INPUT`).

### 5.2 Restricted tokens and secret values (D7; corrected 2026-09-19, §12)

**Existing handling requirements (LOCKED; not weakened by any D7 option):**

- A protected key (`HARNESS_ENTITLEMENT_HMAC_SECRET`, `XAI_API_KEY`, `OPENAI_API_KEY` if D8; VERIFY-01 §4.6 name set and fragments) expected **SET** is represented in a reference **only** by a RESTRICTED `sha256:` token of its value (POLICY §3.4 item 2; VERIFY-01 §4.6). A protected key expected **EMPTY** or **ABSENT** carries **no** token and no value (VERIFY-01 §4.1 shape rule). Tokens exist only for protected SET expectations.
- A token is an equality oracle (reversible by enumeration for low-entropy values) and is RESTRICTED material. **Never** in the comparison report, stdout / stderr, test logs, workflow artifacts, chat, or Git **by default** (VERIFY-01 §4.6 / §6.3). A **secret value** is never in `docs/`, chat, or Git under any option (POLICY §3.4 item 2).
- Existing convention (VERIFY-01 §6.3): tokens are permitted in the reference document and the normalized observation file (0600, operator ledger, class B / C), and in governance evidence **only where Keith so decides** for a specific record under the POLICY §3.4 item 2 convention, with the §4.6 qualification recorded alongside.
- **No token publication occurs in this task.** This freeze, the Step 3 record, the Step 4 checkpoint, `TASKS.md` and `TASKS_BACKLOG_FULL.md` carry key **names**, protection class, expected **state**, coverage class, provenance code, reference ids and file hashes only.

**D7 options (frozen; exactly one to be chosen; each is consistent with the requirements above):**

- **LEDGER_ONLY** — a **proposed tightening** of the existing convention for B(H) and its reissues: tokens exist only inside the reference document and the operator ledger (0600, off-repo, class B / C). No governance evidence document may quote a token for this task's references, even by Keith decision; governance evidence records the reference id and the SHA-256 of the reference **file**. (The existing VERIFY-01 §6.3 Keith-decision allowance is thereby not exercised for these references.)
- **GOVERNANCE_EVIDENCE_PERMITTED** — the **existing** VERIFY-01 §6.3 convention applies unchanged: a token may appear in a governance evidence document **only** when Keith explicitly authorizes that specific record, with the §4.6 equality-oracle qualification recorded alongside; blanket authorization is not an available form. This option is neither tighter nor looser than the locked convention.
- **UNRESOLVED_INPUT**.

Handling options are frozen here **without** any token being produced or published.

### 5.3 What is not included (frozen)

No verifier schema change. No vault adapter or vault→reference converter (VERIFY-01 §3.3 rejected). No reference construction. No observation acquisition. No token generation. Reference preparation is later authorized work and requires an approved A2 policy first.

---

## 6. Facts this freeze treats as UNKNOWN (not to be filled by inference)

| Fact | Status | Note |
|---|---|---|
| Contents of `dump.pm2` on the staging host | UNKNOWN | "no `pm2 save` in a window" establishes nothing about the file |
| What a future restart / `pm2 resurrect` would restore | UNKNOWN | follows from the above |
| Whether credentials for `AI_PROVIDER=xai` are present, and where | UNKNOWN | the setting does not establish credential presence or location |
| Current state of any (app, key) pair in either PM2 field | UNKNOWN | last recorded observation is one Gateway key on 2026-09-14 |
| Which app(s) the 01C6A dummy `XAI_API_KEY` apply targets | UNKNOWN to this freeze (I-4) | conservative both-REQUIRED until resolved |
| Whether any unrecorded operator activity occurred on H | UNKNOWN and **unknowable from the repository** | Rule B-1 |
| Whether any recovery material exists on H | UNKNOWN | discovery is host-side work outside this task |

---

## 7. Area F — Decision matrix (D2–D9; nothing selected)

D1 (authorize registration) was satisfied by Step 1 and is not re-asked. `OUTCOME_SELECTED=NONE`.

### 7.1 Legend

- `UNRESOLVED_INPUT` — Keith declines to answer now; the item stays OPEN and blocks its dependents.
- `INCOMPLETE_AFFIRMATIVE` — a YES whose required components (§7.4) are not all resolved; recorded as OPEN, **not** as approval.
- `REQUIRES_CLARIFICATION` — Keith's answer is recorded in full (subject to Rule F-2 redaction) but is not independently interpretable under §7 (it carries a condition, a source / value / token / observation designation, an alternative policy, an out-of-scope action, or a clause incompatible with another answer); the item is OPEN pending Keith's clarification. Nothing is stripped and no remainder is counted as approval.
- `INCOMPATIBLE` — a combination in §7.5; the affected amendment is blocked; no approval is inferred.
- `CONTRADICTORY` — a combination in §7.5b where individually valid selections cannot jointly produce a coherent result; **each** affected item is OPEN pending clarification; no approval is inferred.
- `VOID` — an item that has no meaning given another answer.

**Option classes (frozen).** Every option in §7.2 / §7.3 / §3.5 belongs to exactly one class:
- **Class F — fixed options:** a bare token (e.g. `A1-F`, `P-A`, `ACCEPT`, `PRE_RUN_ONLY`, `APPROVE_M1`). Independently interpretable only when given with no addition.
- **Class L — options requiring an app list or amendment text:** `D8 INCLUDE <app list>`, `D3 P-A-AMENDED <text>`, `I-1 APPROVE_AMENDED <matrix text>`, `I-2 APPROVE_AMENDED <per-AM values / text>`, `D3-ALT <named alternative>`. The required list / text is **part of the option**; giving the token without it is INCOMPLETE_AFFIRMATIVE. Supplied text is reviewed under Rule F-3 before any approval is derived.
- **Class C — conditions or out-of-scope actions:** any answer that attaches a condition ("provided that…", "once…"), a host attestation, a designation of a source / value / token / observation, an instruction to acquire, construct, reopen, or run, or an alternative policy. Always REQUIRES_CLARIFICATION.

**Rule F-1 (frozen; recording of answers).** Step 3 records **Keith's full answer** for every item, preserving its substance and every condition, subject only to Rule F-2. Step 3 then classifies each answer as exactly one of: (i) **independently interpretable** — a Class F option with no addition, or a Class L option with its required list / text that passes Rule F-3; or (ii) **INCOMPLETE_AFFIRMATIVE** — a Class L token without its list / text; or (iii) **REQUIRES_CLARIFICATION** — a Class C answer, or a Class L text that fails Rule F-3. Step 3 may **not** strip a condition, a designation, or an incompatible clause and count the remainder as the option; may not "read down" a conditional YES into a YES; and may not treat a refusal that supplies an alternative as approval of that alternative. A REQUIRES_CLARIFICATION or INCOMPLETE_AFFIRMATIVE item is OPEN; its dependents are evaluated as if it were UNRESOLVED_INPUT. Clarification is a later explicit Keith answer, recorded in the same way.

**Rule F-2 (frozen; disclosure limit on recording).** "Full answer" never overrides the disclosure restrictions of POLICY §3.4 item 2 and VERIFY-01 §4.6 / §6.3. If an answer contains a secret value, a RESTRICTED token, or other protected material, the governance record carries a **redacted indication** in its place (e.g. `[REDACTED — secret value supplied; not recorded]` / `[REDACTED — restricted token supplied; not recorded]`) together with the surrounding non-protected substance of the answer, classifies the item REQUIRES_CLARIFICATION, and **requests a permissible answer** (an option without the protected material). The protected material is not copied into chat, Git, or any governance record.

**Rule F-3 (frozen; review of amendment-bearing answers).** A Class L text (`P-A-AMENDED`, `I-1 APPROVE_AMENDED`, `I-2 APPROVE_AMENDED`, an amended matrix) is recorded and then reviewed **before** any approval is derived, against: registration constraints 1–6; Rules A-1, A-2, B-1, B-2, C-0 … C-5, D-1 … D-3, F-1, F-2; the §0 invariants; the LOCKED schema facts (Rule C-0); the §7.5b compatibility requirements; and the acceptance-object boundary (§1.2). Review outcomes: **CONSISTENT** — the amended text becomes the controlling text for that item and the item is independently interpretable; **INCONSISTENT** — the item is REQUIRES_CLARIFICATION (the conflicting clause is identified in the record; nothing is stripped); **OUT_OF_SCOPE** — the text designates, acquires, constructs, reopens, runs, or amends a locked predecessor → REQUIRES_CLARIFICATION. Step 3 performs and records the review; Step 4 independently re-performs it. `D3-ALT <named alternative>` is **not** amendment text: it is recorded as a proposal for later review and is never adopted by this task (§3.6).

### 7.2 Independent items

| ID | Question | Exact options | Prerequisite | Effect of each option | Non-effects (all options) |
|---|---|---|---|---|---|
| **D2** | K-B1 — adopt an A1 first-run applicability amendment? | `A1-F` (§2.2 text) / `A1-L` (locked §3.3 text) / `NO` / `UNRESOLVED_INPUT` | none | `A1-F` or `A1-L`: A1 text adopted **as contract text only** once D2b and D9 are resolved (else INCOMPLETE_AFFIRMATIVE). `NO`: A1 REFUSED; first-run path has no defined applicability; P2/P3 govern unchanged; D2b VOID. `UNRESOLVED_INPUT`: A1 OPEN; D2b VOID. | does not attest H for any host; does not satisfy P2–P8; does not accept P7; does not reopen; does not authorize acquisition or canary |
| **D3** | K-B2 — is B(H) REQUIRED, and under which provenance policy? | `P-A` (§3.4 REQUIRED, P-A text; Class F) / `P-A-AMENDED <text>` (REQUIRED with Keith's recorded text changes; Class L; reviewed under Rule F-3 — CONSISTENT required) / `P-N` (not required) / `UNRESOLVED_INPUT` | none | `P-A` / `P-A-AMENDED` (CONSISTENT): A2 adopted **as policy only** once I-1 and I-2 are **explicitly approved**, D4, D5, D6, D7 are resolved, and every §7.5b compatibility requirement holds (else INCOMPLETE_AFFIRMATIVE / CONTRADICTORY). `P-A-AMENDED` without text: INCOMPLETE_AFFIRMATIVE; with INCONSISTENT / OUT_OF_SCOPE text: REQUIRES_CLARIFICATION. `P-N`: A2 REFUSED as REQUIRED; first-run reference prerequisite UNRESOLVED (§3.6) unless D3-ALT later approved; D4 / D6 VOID; D5 / D7 remain live (they also govern any per-run reference). `UNRESOLVED_INPUT`: A2 OPEN. | designates no source, value, or token; constructs nothing; acquires nothing; does not make any observation authoritative |
| **D3-ALT** | If D3 = `P-N`: is a concrete non-circular alternative first-run reference source named? | `NONE` / `<named alternative>` (Class L; a **recorded proposal**, never an adopted alternative in this task) | D3 = `P-N` | `NONE`: first-run reference prerequisite UNRESOLVED; A1 clause (e) unresolved. Named: recorded as a proposal for later separately authorized review; **not approved and not adopted**; the first-run reference prerequisite stays UNRESOLVED; must not be PV-5 / PV-6 / PV-7 or an unadopted observation (if it is, recorded as REQUIRES_CLARIFICATION). | naming is not approval; no D3-ALT value makes DEFINED true |
| **D8** | Include `OPENAI_API_KEY` in the B(H) key set? | `INCLUDE <app list>` (REQUIRED on exactly the app(s) Keith names: G, W, or both) / `EXCLUDE` / `UNRESOLVED_INPUT` | none | `INCLUDE` **with** named app(s) (Class L): adds protected REQUIRED pair(s) on those apps; D7 applies; the approved I-1 matrix must contain exactly those pairs (§7.5b compatibility matrix ↔ D8). `INCLUDE` **without** named app(s): **INCOMPLETE_AFFIRMATIVE** — D8 OPEN; the key is **not** added to the REQUIRED set; this is not read as EXCLUDE and not read as "both apps". `EXCLUDE`: not in the set; recorded as OPTIONAL-not-included. `UNRESOLVED_INPUT`: D8 OPEN; not in the set. | does not block A2 ADOPTED when OPEN (the key is outside the REQUIRED set until a complete INCLUDE); a complete INCLUDE after I-1 approval requires an explicit I-1 amendment |
| **D9** | Handling of discovered recovery material | `ACCEPT` (§2.4 rules 1–5) / `UNRESOLVED_INPUT` | none | `ACCEPT`: §2.4 binds every outcome. `UNRESOLVED_INPUT`: any D2 YES is INCOMPLETE_AFFIRMATIVE (A1 clause (a) depends on §2.4). | never deletes, replaces, rotates, clears, or designates any item |

### 7.3 Dependent items

| ID | Question | Exact options | Depends on | Effect of each option | Non-effects |
|---|---|---|---|---|---|
| **D2b** | H2 attestation acceptance threshold | `ACCEPTANCE` (locked-proposal threshold; gaps disclosed, Keith judges) / `STRICT` (any disclosed gap → unacceptable) / `UNRESOLVED_INPUT` | D2 ∈ {`A1-F`, `A1-L`}; else VOID | `ACCEPTANCE`: A1 clause (b) usable as written. `STRICT`: clause (b) can be satisfied only by host-side evidence closing every gap (outside this task); in practice blocks the current staging host until then. `UNRESOLVED_INPUT`: D2 is INCOMPLETE_AFFIRMATIVE. | neither value attests any host; neither closes H3 |
| **D4** | Post-invalidation use of B(H) | `PRE_RUN_ONLY` / `REISSUE_PER_WINDOW` (§4.3) / `UNRESOLVED_INPUT` | D3 ∈ {`P-A`, `P-A-AMENDED`}; else VOID | `PRE_RUN_ONLY`: no post-run B(H) use under A2. `REISSUE_PER_WINDOW`: explicit per-window reissue permitted (Rules D-1, D-2). `UNRESOLVED_INPUT`: D3 is INCOMPLETE_AFFIRMATIVE (P-A item 4 undefined after the first event). | neither exempts canary writes; neither renews authority; neither mandates post-run use (Rule D-3); neither substitutes for P4/P5/P7 |
| **D5** | B(H) comparison-only; per-run vault + §5.3/§16 + CANARY §4 remain the sole restore payload; two later-prepared references | `ACCEPT` / `REFUSE` / `UNRESOLVED_INPUT` | live under any D3 | `ACCEPT`: §4.1 binds. `REFUSE`: the §4.1 statement is **not accepted**; REFUSE **supplies no alternative restoration policy by itself** — the locked restore payload (EXEC-01C6 §5.3 / §16; CANARY §4) remains in force unchanged, B(H) remains comparison-only by the verifier's construction, and any different restoration policy would be a C1 restoration-matrix amendment outside this task. With D3 = P-A / P-A-AMENDED, REFUSE leaves A2 **OPEN / blocked** (§7.5 row 2) because P-A item 6 depends on §4.1. `UNRESOLVED_INPUT`: D3 affirmative is INCOMPLETE_AFFIRMATIVE. | never amends EXEC-01C6A; REFUSE does not make B(H) a restore payload |
| **D6** | Where the daemon start time B(H) is valid for is recorded | `PROVENANCE_RECORD` (§5.1) / `UNRESOLVED_INPUT` | D3 ∈ {`P-A`, `P-A-AMENDED`}; else VOID | `PROVENANCE_RECORD`: P-A item 1 satisfiable without schema change. `UNRESOLVED_INPUT`: D3 is INCOMPLETE_AFFIRMATIVE (identity requirement undefined). | no schema change under any option |
| **D7** | Where RESTRICTED tokens (protected SET expectations only) may exist | `LEDGER_ONLY` (proposed tightening) / `GOVERNANCE_EVIDENCE_PERMITTED` (existing VERIFY-01 §6.3 convention, per-record Keith authorization) / `UNRESOLVED_INPUT` | live under any D3 (also governs any per-run reference) | `LEDGER_ONLY`: §5.2 tightening binds; governance carries reference ids and file hashes only. `GOVERNANCE_EVIDENCE_PERMITTED`: existing convention unchanged; per-record Keith authorization with §4.6 qualification for each quoted token; blanket authorization not available. `UNRESOLVED_INPUT`: any D3 affirmative is INCOMPLETE_AFFIRMATIVE (protected REQUIRED pairs exist). | neither option weakens the LOCKED token / value handling rules; no token is produced or published by deciding D7 |

### 7.4 Completeness rules (frozen; corrected 2026-09-19, §12)

- **A1 ADOPTED** ⇔ D2 ∈ {A1-F, A1-L} **and** D2b ∈ {ACCEPTANCE, STRICT} **and** D9 = ACCEPT, each independently interpretable (Rule F-1). Otherwise A1 is REFUSED (D2 = NO) or OPEN.
- **A2 ADOPTED (REQUIRED)** ⇔ D3 ∈ {P-A, P-A-AMENDED(CONSISTENT)} **and** I-1 ∈ {APPROVE_M1, APPROVE_M2, APPROVE_AMENDED(CONSISTENT)} (**explicit approval** of exactly one matrix; "recorded", "noted" or silence is not approval; no default matrix exists) **and** I-2 ∈ {APPROVE, APPROVE_AMENDED(CONSISTENT)} with a value for **each** of AM-1 … AM-5 **and** D4 ∈ {PRE_RUN_ONLY, REISSUE_PER_WINDOW} **and** D5 = ACCEPT **and** D6 = PROVENANCE_RECORD **and** D7 ∈ {LEDGER_ONLY, GOVERNANCE_EVIDENCE_PERMITTED}, each independently interpretable (Rule F-1), **and** every §7.5b compatibility requirement holds (AM-3 ↔ D4; AM-5 ↔ I-1; AM-1 ↔ D6; approved matrix ↔ D8). If AM-1 is refused within I-2, A2 is blocked (§3.4a). If any §7.5b requirement fails, the affected items are CONTRADICTORY → OPEN and A2 is OPEN. Otherwise A2 is REFUSED (D3 = P-N) or OPEN.
- **First-run contract DEFINED** ⇔ A1 ADOPTED **and** (A2 ADOPTED or an approved D3-ALT exists — none does). DEFINED ≠ usable (Rule A-1).
- D8 OPEN (UNRESOLVED_INPUT or INCOMPLETE_AFFIRMATIVE) does **not** block A2 ADOPTED **provided** the approved I-1 matrix contains no `OPENAI_API_KEY` pair; `OPENAI_API_KEY` is simply outside the REQUIRED set until a complete INCLUDE is approved together with a matching I-1 (amendment).
- I-4 and I-5 unresolved do **not** block A2 ADOPTED (both-REQUIRED under either matrix and PV-1-or-PV-3 respectively remain well-defined); they may block **reference construction** (§3.2 I-4 reconciliation), which is outside this task, and are carried forward as OPEN inputs.
- Any INCOMPATIBLE combination (§7.5) blocks the affected amendment regardless of the other answers. Any CONTRADICTORY combination (§7.5b) leaves **each** affected item OPEN pending clarification; individually valid selections never jointly yield an ADOPTED result that is incoherent under this freeze. An **independent partial outcome** (§7.5a) blocks nothing beyond the item itself and DEFINED.

### 7.5 Incompatible combinations (frozen; no approval inferred)

An incompatible combination is one where two independently interpretable answers cannot both be given effect under this freeze.

| # | Combination | Why incompatible | Recorded result |
|---|---|---|---|
| 1 | D3 ∈ {P-A, P-A-AMENDED} and D5 = REFUSE | P-A item 6 and Rule A-1 rest on §4.1 (B(H) comparison-only; per-run vault sole restore payload); REFUSE withdraws that statement without supplying a policy | A2 OPEN / blocked; the locked restore payload remains in force; REFUSE is recorded as refusal of §4.1, not as an alternative restoration policy; any alternative is a C1 amendment outside this task |
| 2 | D3 ∈ {P-A, P-A-AMENDED} and I-2 refuses AM-1 | B(H) cannot be represented under the LOCKED schema without the external start-time carrier | A2 OPEN / blocked until a schema task is separately registered |
| 3 | (moved to §7.5b row C-4: approved matrix ↔ D8) | — | — |
| 4 | D2b = STRICT together with an answer that the current staging host's attestation "passes" | STRICT cannot be passed by anything in this task; the two statements cannot both hold | D2b recorded in full as REQUIRES_CLARIFICATION (Rule F-1); A1 OPEN; host state unchanged |
| 5 | D4 = REISSUE_PER_WINDOW with wording exempting the canary's `--update-env` from invalidation | violates Rule D-1 | D4 recorded in full as REQUIRES_CLARIFICATION; A2 OPEN |
| 6 | D7 = GOVERNANCE_EVIDENCE_PERMITTED with a blanket authorization | per-record authorization is the only available form | D7 recorded in full as REQUIRES_CLARIFICATION; A2 OPEN |
| 7 | Any item answered with an option plus a designated source, value, token, observation id, or an alternative policy | designation / alternative policy is outside this task's acceptance object (§1.2); the option cannot be separated from the designation without stripping Keith's answer | item recorded in full (Rule F-2 redaction if protected material is present) as REQUIRES_CLARIFICATION (Rule F-1); the dependent amendment OPEN; the designation is **not** acted on and **not** struck |

### 7.5a Independent partial outcomes (frozen; not incompatibilities)

| # | Answers | Result | Note |
|---|---|---|---|
| a | D2 = NO and A2 ADOPTED | A1 REFUSED; A2 ADOPTED; DEFINED = NO | valid; a policy exists with no first-run applicability |
| b | A1 ADOPTED and D3 = P-N with D3-ALT = NONE | A1 ADOPTED (text); A2 REFUSED; DEFINED = NO; A1 clause (e) unresolved | valid; two independent results recorded plainly |
| c | A1 ADOPTED and A2 OPEN (any INCOMPLETE_AFFIRMATIVE / REQUIRES_CLARIFICATION / UNRESOLVED_INPUT) | DEFINED = NO | A1 text stands; nothing usable follows |
| d | D8 OPEN with A2 ADOPTED | A2 ADOPTED on the approved set without `OPENAI_API_KEY` | D8 remains OPEN; later complete INCLUDE needs an I-1 amendment |
| e | Both D2 and D3 = UNRESOLVED_INPUT | A1 OPEN; A2 OPEN | valid; HOLD continues |

### 7.5b Cross-decision compatibility requirements (frozen; CONTRADICTORY → each affected item OPEN)

Each requirement is checked over the **whole** answer set after individual classification. A failure is recorded as CONTRADICTORY on every item named in the row; no item is read down, re-interpreted, or given priority, and no approval is inferred from either side. Clarification is a later explicit Keith answer (Rule F-1).

| # | Requirement | Compatible combinations | Contradictory combinations | Recorded result |
|---|---|---|---|---|
| C-1 | **AM-3 ↔ D4** | AM-3 approved with D4 ∈ {PRE_RUN_ONLY, REISSUE_PER_WINDOW}; AM-3 refused with D4 = PRE_RUN_ONLY | AM-3 refused with D4 = REISSUE_PER_WINDOW (reissue permitted by D4 but the amendment allowing post-invalidation use is refused) | I-2 (AM-3) and D4 both OPEN pending clarification; A2 OPEN; refusing AM-3 does not select D4 |
| C-2 | **AM-5 ↔ I-1** | AM-5 approved with I-1 ∈ {APPROVE_M1, APPROVE_M2, APPROVE_AMENDED}; AM-5 refused with I-1 ∈ {APPROVE_M2, APPROVE_AMENDED with no RECOMMENDED pair} | AM-5 refused with I-1 = APPROVE_M1, or with APPROVE_AMENDED containing any RECOMMENDED pair (a class that does not exist when AM-5 is refused) | I-2 (AM-5) and I-1 both OPEN pending clarification; coverage UNRESOLVED; A2 OPEN; refusing AM-5 adopts no matrix |
| C-3 | **AM-1 ↔ D6** | AM-1 approved with D6 = PROVENANCE_RECORD | AM-1 refused with D6 = PROVENANCE_RECORD (the carrier D6 selects is the amendment refused); AM-1 approved with D6 = UNRESOLVED_INPUT is not contradictory but INCOMPLETE_AFFIRMATIVE | I-2 (AM-1) and D6 both OPEN pending clarification; A2 blocked in any case while AM-1 is refused (§7.5 row 2) |
| C-4 | **approved coverage matrix ↔ D8** | D8 = EXCLUDE / OPEN with a matrix containing no `OPENAI_API_KEY` pair; D8 = INCLUDE <apps> (complete) with a matrix containing exactly those `OPENAI_API_KEY` pairs as REQUIRED | D8 = INCLUDE <apps> with a matrix lacking any of those pairs or containing others; D8 = EXCLUDE or OPEN with a matrix containing an `OPENAI_API_KEY` pair | I-1 and D8 both OPEN pending clarification (which set is approved?); A2 OPEN |

**AM-2 note (not a compatibility row).** Refusing AM-2 removes expiry and key-set change from the *policy* invalidation triggers only. It cannot disable the verifier's validity-window check: an observation outside `[valid_from, valid_until]` still produces `OBSERVATION_OUTSIDE_REFERENCE_VALIDITY` (INVALID_INPUT; no comparison evidence). Records must distinguish **expiry failure** (comparison unavailable for that observation) from **missing coverage** (Rule C-1 gap). Neither satisfies A1 clause (c).

### 7.6 Illustrative cases — **NOT KEITH'S CHOICES** (corrected 2026-09-19, §12)

| Case | Answers | Derived status | Note |
|---|---|---|---|
| V1 | D2=A1-F, D2b=ACCEPTANCE, D9=ACCEPT; D3=P-A, I-1=APPROVE_M1, I-2=APPROVE (AM-1…AM-5 approved), D4=REISSUE_PER_WINDOW, D5=ACCEPT, D6=PROVENANCE_RECORD, D7=LEDGER_ONLY, D8=EXCLUDE | A1 ADOPTED; A2 ADOPTED; first-run contract DEFINED; all §7.5b rows compatible | still **not usable**: acquisition unregistered, no reference, no S2, gate UNSATISFIED, EXEC-01C6A NOT_READY |
| V2 | as V1 but D4=UNRESOLVED_INPUT | A1 ADOPTED; A2 **OPEN** (INCOMPLETE_AFFIRMATIVE); DEFINED=NO | the invalidation contradiction remains visible and blocking |
| V3 | D2=NO; D3=P-A with all components approved | A1 REFUSED; A2 ADOPTED; DEFINED=NO (§7.5a row a) | policy exists; no first-run applicability |
| V4 | D2=A1-L, D2b=STRICT, D9=ACCEPT; D3=P-N, D3-ALT=NONE | A1 ADOPTED (text); A2 REFUSED; DEFINED=NO (§7.5a row b); clause (a)/(b) of A1-L blocked for current host under STRICT | two independent results, both recorded |
| V5 | D2=UNRESOLVED_INPUT; D3=UNRESOLVED_INPUT | both OPEN (§7.5a row e) | valid outcome; nothing changes; HOLD continues |
| V6 | D2=A1-F, D2b=ACCEPTANCE, D9=UNRESOLVED_INPUT | A1 OPEN (INCOMPLETE_AFFIRMATIVE) | clause (a) has no discovery rule |
| V7 | V1 answers, but D3 given as "P-A, and adopt the LIVE-GATE record as B(H) for G/`GLOBAL_EXECUTION_ENABLED`" | D3 recorded **in full** as REQUIRES_CLARIFICATION (§7.5 row 7; Rule F-1); A2 OPEN; DEFINED=NO | the designation is neither acted on nor struck; I-5 stays a construction input; Keith's clarification (P-A alone, or P-A plus a separately authorized I-5 adoption) is awaited |
| V8 | V1 answers with D5=REFUSE and no further statement | A2 OPEN / blocked (§7.5 row 1) | REFUSE supplies no alternative; the locked restore payload remains in force; a C1 amendment outside this task would be needed for any different policy |
| V9 | V1 answers, but D2 given as "A1-F, provided the H2 attestation for the current staging host is deemed accepted" | D2 recorded **in full** as REQUIRES_CLARIFICATION (Class C: conditional approval carrying a host attestation — outside §1.2); A1 OPEN; DEFINED=NO | not read down to "A1-F"; the condition is not stripped; host attestation remains S2 work outside this task |
| V10 | V1 answers with D8="INCLUDE" and no app named | D8 INCOMPLETE_AFFIRMATIVE (OPEN); `OPENAI_API_KEY` not added; A1 ADOPTED; A2 ADOPTED on the approved set; DEFINED | not read as EXCLUDE and not read as both apps; a later complete INCLUDE needs an explicit I-1 amendment |
| V11 | V1 answers but I-1 given as "noted; proceed" | I-1 not an approval option → A2 INCOMPLETE_AFFIRMATIVE (OPEN); A1 ADOPTED; DEFINED=NO | explicit APPROVE_M1 / APPROVE_M2 / APPROVE_AMENDED is required; no matrix is a default |
| V12 | V1 answers but I-2 = APPROVE_AMENDED with AM-1 refused (D6 = PROVENANCE_RECORD retained) | A2 OPEN / blocked (§7.5 row 2); additionally CONTRADICTORY (§7.5b C-3: AM-1 refused with D6 = PROVENANCE_RECORD) → I-2 and D6 OPEN; A1 ADOPTED; DEFINED=NO | B(H) not representable under the LOCKED schema without the external start-time carrier; D6 is not read down |
| V13 | V1 answers but I-2 = APPROVE_AMENDED with AM-5 refused, I-1 = APPROVE_M2 | A1 ADOPTED; A2 ADOPTED on M-2 (every frozen key REQUIRED on both apps; no RECOMMENDED class); DEFINED; §7.5b C-2 compatible | construction will need approved provenance for every pair; M-2 was **explicitly approved**, not defaulted into |
| V13a | V1 answers but I-2 = APPROVE_AMENDED with AM-5 refused, I-1 = APPROVE_M1 | CONTRADICTORY (§7.5b C-2): I-2 (AM-5) and I-1 both OPEN pending clarification; coverage UNRESOLVED; A2 OPEN; A1 ADOPTED; DEFINED=NO | M-1 uses the RECOMMENDED class that AM-5 refusal removes; neither answer is given priority; no matrix is adopted |
| V14 | V1 answers but I-2 = APPROVE_AMENDED with AM-3 refused, D4 = REISSUE_PER_WINDOW | CONTRADICTORY (§7.5b C-1): I-2 (AM-3) and D4 both OPEN pending clarification; A2 OPEN; A1 ADOPTED; DEFINED=NO | refusing AM-3 does not convert D4 into PRE_RUN_ONLY; D4 is not read down |
| V15 | V1 answers but D8 = INCLUDE G with I-1 = APPROVE_M1 (M-1 as written contains no `OPENAI_API_KEY` pair) | CONTRADICTORY (§7.5b C-4): I-1 and D8 both OPEN pending clarification; A2 OPEN; A1 ADOPTED; DEFINED=NO | resolved only by an explicit I-1 APPROVE_AMENDED containing (G, `OPENAI_API_KEY`) REQUIRED, or a changed D8 |
| V16 | V1 answers but D3 = P-A-AMENDED with text: "item 4: add 'any `pm2 set` / `pm2 unset` on a named app' to the invalidation triggers" | Rule F-3 review: CONSISTENT (adds a trigger; weakens nothing; within §1.2) → D3 independently interpretable with the amended text controlling; A2 ADOPTED (other V1 components); DEFINED | a valid amendment-bearing answer; the amended text is recorded and becomes P-A item 4 text for this task only after the review is recorded (Step 3) and re-performed (Step 4) |
| V16a | V1 answers but D3 = P-A-AMENDED with text: "item 4: the canary's own `--update-env` does not invalidate B(H)" | Rule F-3 review: INCONSISTENT (violates Rule D-1) → D3 REQUIRES_CLARIFICATION; A2 OPEN; DEFINED=NO | the conflicting clause is identified; nothing is stripped; P-A is not adopted "minus the clause" |
| V17 | V1 answers; during the H1 search an operator ledger entry of uncertain nature for (H, W) is discovered and not yet classified | Contract status unchanged (A1 ADOPTED; A2 ADOPTED; DEFINED). **Eligibility** for (H, W): UNRESOLVED — A1 clause (a) unsatisfied while the item is UNCLASSIFIED; item preserved (§2.4) | UNCLASSIFIED is not H0 and not evidence of no H1; classification is a separate explicit per-item Keith decision outside this task |
| V18 | Later (outside this task): the A1-F clause (c) comparison invocation returns `INVALID_INPUT` (`OBSERVATION_OUTSIDE_REFERENCE_VALIDITY`) | Clause (c) **not met**; no comparison evidence exists; a diagnostic report exists and establishes no host-state conclusion; recorded as expiry failure, not as missing coverage and not as MISMATCH | re-perform under a new authorized acquisition with a reference valid for that observation; INVALID_INPUT / INTERNAL_ERROR never satisfy clause (c) |
| V18a | Later (outside this task): the clause (c) comparison returns accepted `MISMATCH` on one non-protected key | Clause (c) **not met**; the mismatch is a finding requiring a separately authorized corrective decision; the reference is not overwritten with the observation; subsequently a new authorized acquisition compared against the reference as it then stands must yield accepted `MATCH` with no DIVERGENT key | MISMATCH establishes neither cause nor timing nor restoration fate; the corrective decision is not permission to ignore the mismatch |
| V19 | V1 answers but D7 given as "LEDGER_ONLY; for reference the current token for (W, `HARNESS_ENTITLEMENT_HMAC_SECRET`) is sha256:…" | Rule F-2: the token is **not recorded**; the record carries `[REDACTED — restricted token supplied; not recorded]` with the remainder of the answer; D7 REQUIRES_CLARIFICATION (Class C designation, §7.5 row 7); a permissible answer is requested; A2 OPEN; DEFINED=NO | "full answer" does not override disclosure limits; the token is not copied into chat, Git, or governance records; "LEDGER_ONLY" is not read down out of the answer |
| V20 | D2 = A1-F, D2b = ACCEPTANCE, D9 = ACCEPT; D3 = P-N; D3-ALT = "use the LIVE-GATE 2026-09-14 record for every key" | A1 ADOPTED (text); A2 REFUSED; D3-ALT recorded as a **proposal** for later review (it names PV-1 material for keys PV-1 cannot establish — flagged in the record); first-run reference prerequisite UNRESOLVED; DEFINED=NO | naming an alternative neither approves nor adopts it; A1 clause (e) stays unresolved |

---

## 8. Recommended package — **UNADOPTED**

Recorded so the review has a concrete proposal to accept, amend, or refuse. Nothing here is selected.

| Item | Recommended | Reason |
|---|---|---|
| D2 | `A1-F` | makes H1/H2/H3, discovery handling, Rule B-1 and the A2 link explicit; A1-L leaves them to interpretation |
| D2b | `ACCEPTANCE` | H2 gaps on the current host are already known to exist and cannot be closed from the repository; STRICT is equivalent to refusing A1 for this host by threshold rather than by an explicit D2 = NO, which is the honest way to refuse |
| D9 | `ACCEPT` | restates binding §4.3 / §6.2 and closes the "one vault" and "fresh vault" assumptions |
| D3 | `P-A` | without a REQUIRED intent reference the first-run pre-run comparison has nothing non-circular to compare against (§3.6) |
| D4 | `REISSUE_PER_WINDOW` | PRE_RUN_ONLY leaves post-run conformance to intent permanently unavailable; per-window explicit reissue resolves the contradiction without exempting canary writes or renewing authority (Rules D-1, D-2, D-3) |
| D5 | `ACCEPT` | the only answer that gives P-A item 6 and Rule A-1 effect; REFUSE changes no restore semantics by itself (the locked payload remains in force) but leaves A2 blocked with no alternative; UNRESOLVED_INPUT leaves A2 incomplete |
| D6 | `PROVENANCE_RECORD` | the only option compatible with the LOCKED schema |
| D7 | `LEDGER_ONLY` | a tightening for this task's references: no token in Git or governance records even by decision; the existing per-record allowance (GOVERNANCE_EVIDENCE_PERMITTED) is not weaker than the locked convention but has no identified use case here |
| D8 | `EXCLUDE` | `OPENAI_API_KEY` is a 01C6B key (CANARY §4); 01C6A does not touch it |
| I-1 | `APPROVE_M1` — §3.2 matrix M-1 as the REQUIRED set, both-REQUIRED for `XAI_API_KEY` until an explicit I-1 amendment | compatible with AM-5 approved (§7.5b C-2); narrowing is a later recorded Keith decision, never automatic. M-2 (conservative-all) is the alternative if Keith prefers no RECOMMENDED class; neither is a default |
| I-2 | `APPROVE` — P-A with AM-1 … AM-5 approved (AM-6 informational) | AM-1 and AM-4 are the only ways to satisfy §3.4 items 1 and 3 under the LOCKED schema; AM-2 aligns policy invalidation with Rule C-1 and the verifier's existing window check; AM-3 is required for the recommended D4; AM-5 is required for the recommended I-1 |
| I-5 | carry forward as OPEN input for reference work | the 2026-09-14 record is dated evidence, not current state; adoption belongs with reference construction |

Adopting this package in full (case V1) yields a **defined** first-run contract and **no** usable path (Rule A-1). Conflicts that remain visible even under full adoption: EXEC-01C6 §16 item 2 vs BUILDER-LIVE-GATE-01 LEFT ON (C1, not this task); the acquisition prerequisite (VERIFY-01 §3.4, unregistered — A1-F clause (c) is text-only until it exists); I-4 and I-5 (reference construction inputs).

---

## 9. Authorization boundary for Steps 3–4 (frozen)

- **Step 3** (explicit Keith decision) records **Keith's full answer** for each of D2–D9 (plus D3-ALT, I-1, I-2 where applicable), subject to Rule F-2 redaction of any secret value or restricted token (redacted indication recorded; permissible answer requested); classifies each under Rule F-1 (option classes F / L / C) as independently interpretable, INCOMPLETE_AFFIRMATIVE, or REQUIRES_CLARIFICATION; performs and records the Rule F-3 review of every amendment-bearing answer; checks every §7.5b compatibility requirement over the whole answer set; derives A1 / A2 / DEFINED status by §7.4–§7.5b; and records nothing else. It may not strip conditions, designations or incompatible clauses; may not designate a source, value, token, or observation; may not adopt a D3-ALT proposal; may not attest a host; may not classify discovered recovery material; may not touch EXEC-01C6A, the sidecar, the verifier, the operator bundle, or any locked freeze.
- **Step 4** (independent verification / checkpoint / lock) verifies that the Step 3 record is consistent with §7, independently re-performs every Rule F-3 review and §7.5b check, and confirms that all non-effects hold; then mirrors end status. Lock of this task is a lock of a **decision record**, not of any host state.
- Neither step authorizes: acquisition; live use of the verifier; P4–P7 host evidence; reference construction; C1 amendment; reopen; canary; STAGING / PM2 / ENV / CREDIT / PROVIDER-LIVE / LOCAL-RUNTIME; `.env` / `dump.pm2` / vault access; Harness flag changes; Git mutation.

---

## 10. Step 2 static consistency check (re-performed on the corrected document, 2026-09-19; second pass §13)

| Check | Result |
|---|---|
| Every registered D-identifier (D2, D2b, D3, D4, D5, D6, D7, D8, D9) appears in §7 with options, prerequisites, effects, non-effects | PASS |
| Every §7 option that is a YES has a completeness rule in §7.4; I-1 and I-2 require explicit approval options, not "recorded" | PASS |
| Every registered constraint 1–6 is enforced by a frozen Rule (1→C-1/C-2; 2→§3.6; 3→§5.1 / AM-1; 4→D-2; 5→§4.2; 6→§1.2 / D-3) | PASS |
| A1-F carries every prerequisite of the locked §3.3 controlling text (history attestation; dual-field pre-mutation read with no divergence; r3 mechanics) and states P2/P3 remain binding | PASS (§2.2 (a)–(f)) |
| First-run preparation records (H0) do not defeat the first-run premise; only H1 does | PASS (Rule B-2; §2.4 item 4) |
| A1-L / A1-F difference table reflects the locked controlling text accurately | PASS (§2.3) |
| P-A preserves POLICY §3.4 items 1–5; every departure is listed as an explicit proposed amendment AM-1 … AM-5 | PASS (§3.4 / §3.4a) |
| Reference expectations identical across both PM2 fields; per-key provenance mapping external and linked through `provenance.source` / `authorization_record`; no schema change | PASS (Rule C-0 / C-5) |
| Reissued identity reflects evidence; no new `daemon_pid` demanded absent a restart | PASS (§4.3 REISSUE_PER_WINDOW) |
| D7 options each consistent with the LOCKED token / value rules; tokens only for protected SET; EMPTY / ABSENT no payload; no token publication in this task | PASS (§5.2) |
| No D-item option designates a source, value, token, or observation | PASS |
| No secret value or token appears in this document | PASS |
| Canary `--update-env` is not exempted under any D4 option | PASS (Rule D-1) |
| A1-L and A1-F both lack a categorical UNKNOWN-disqualifies rule; STRICT is separate (D2b) | PASS |
| `.env` missing ≠ ABSENT; `.env` not authoritative for PM2 fields | PASS (Rule C-3) |
| Keith's full answers are recorded with substance and conditions preserved; conditions / designations / incompatible clauses are never stripped and counted as approval; REQUIRES_CLARIFICATION is the only path for such answers | PASS (Rule F-1; §7.5 rows 4–7; V7, V9) |
| Option classes distinguished: fixed (F); requiring app list / amendment text (L); conditions / out-of-scope actions (C) | PASS (§7.1 option classes; Rule F-1) |
| Amendment-bearing answers (P-A-AMENDED, I-1 / I-2 APPROVE_AMENDED) reviewed against frozen constraints before approval is derived; D3-ALT is a recorded proposal, never adopted | PASS (Rule F-3; §7.2 D3 / D3-ALT; V16, V16a, V20) |
| No secret value or restricted token is reproduced into a governance record; redacted indication + permissible-answer request | PASS (Rule F-2; V19) |
| POLICY §3.4 item 1 is not claimed to establish per-app coverage; coverage fixed only by an explicitly approved matrix (M-1 with AM-5, M-2, or amended); no default matrix; refusing AM-5 adopts nothing | PASS (§3.2 coverage authority; §3.4 item 2; §3.4a AM-5; §3.5 I-1; §7.4) |
| Compatibility requirements AM-3 ↔ D4, AM-5 ↔ I-1, AM-1 ↔ D6, approved matrix ↔ D8 stated; contradictory combinations leave each affected item OPEN; no incoherent ADOPTED result | PASS (§7.5b; §7.4; V12, V13a, V14, V15) |
| Refusing AM-2 does not disable the verifier's validity-window check; expiry failure distinguished from missing coverage | PASS (§3.4a AM-2; §4.2; §7.5b AM-2 note; V18) |
| UNCLASSIFIED discovered material keeps eligibility unresolved; not H0; not evidence of no H1 | PASS (§2.1; Rule B-2; §2.2 (a); §2.4 item 4; V17) |
| A1-F clause (c) requires valid comparison evidence; INVALID_INPUT / INTERNAL_ERROR cannot satisfy it; MISMATCH resolution is a separately authorized corrective decision with required subsequent evidence; no comparison establishes restoration success, fate or CLEAN | PASS (§2.2 (c); §2.3; §4.2; V18, V18a) |
| Rule C-0 makes no cause claim about unequal expectations (schema incompatibility only) | PASS (§3.1) |
| §8 D5 reason does not claim every non-ACCEPT answer changes restore semantics | PASS (§8) |
| D5 REFUSE supplies no alternative restoration policy; locked restore payload unchanged | PASS (§7.3 D5; §7.5 row 1; V8) |
| D8 INCLUDE without named apps is INCOMPLETE_AFFIRMATIVE, not EXCLUDE and not both apps | PASS (§7.2 D8; V10) |
| Independent partial outcomes (§7.5a) separated from incompatible combinations (§7.5) | PASS |
| I-4 conservative coverage, construction prerequisite and later coverage amendment reconciled; no automatic narrowing | PASS (§3.2 I-4 reconciliation) |
| INVALID_INPUT / INTERNAL_ERROR described as emitting diagnostic reports that establish no accepted comparison or host-state conclusion | PASS (§4.2) |
| Every incompatible combination yields OPEN / blocked, never inferred approval | PASS (§7.5) |
| Illustrative cases include conditional approval (V9), incomplete D8 INCLUDE (V10), refused D5 without alternative (V8), missing I-1 approval (V11), AM-1 refusal (V12), AM-5 refusal with explicit M-2 (V13), contradictory AM/D combinations (V12, V13a, V14, V15), valid and invalid amendment-bearing answers (V16, V16a), UNCLASSIFIED material (V17), invalid comparison output and MISMATCH (V18, V18a), redacted protected material (V19), D3-ALT proposal (V20); all marked NOT KEITH'S CHOICES | PASS (§7.6; whole matrix rechecked against §7.4 / §7.5 / §7.5a / §7.5b) |
| Full-package adoption is stated as DEFINED, not usable | PASS (Rule A-1, §8) |
| Invariants table §0 unchanged by any section | PASS |

---

## 11. Step 2 ledger

- Created: `docs/PM2-RECOVERY-BASELINE-GOV-01-STAGE-START.md` (this file)
- Mirrored: `TASKS.md` (this task's fields only); `TASKS_BACKLOG_FULL.md` (this task's body only); `docs/control-plane/SATURATION_PROOF.json` (validator output only)
- Not touched: sidecar `lane-saturation-state.json`, `lockedTaskIds`, any predecessor body or locked freeze, EXEC-01C6A body / candidate, operator bundle, `ops/pm2-recovery-verify/`, workflows, application source, tests, PRD, ARCHITECTURE, CLAUDE, AGENTS
- Mutex: GOVERNANCE acquired transiently for this control-plane step; released UNOWNED at end of step
- Occupancy: Lane 1 EMPTY; Lane 2 EMPTY; Lane 3 DISABLED
- Runtime: none (no Python, tests, mocks, builds, installs, SSH, staging, PM2, config / vault access, workflow dispatch, subagents, Git add / commit / push)
- Result: **Step 2 COMPLETE — freeze ready for review. Steps 3–4 NOT AUTHORIZED. OUTCOME_SELECTED=NONE. A1 OPEN. A2 OPEN.**

---

## 12. Step 2 consolidated correction record (2026-09-19; before any Step 3; same uncommitted freeze; baseline `b3b2f10895c2b90954db31dafaa6da6e2e0427be`)

Keith-directed review findings, verified against locked POLICY-01 §3.3 / §3.4 and VERIFY-01 §4.1 / §4.6 / §4.8 / §5.4 / §6.3 before editing, and corrected together. No decision was selected; no host, gate, or sidecar state changed.

| # | Finding (verified) | Correction |
|---|---|---|
| 1 | A1-F omitted the locked §3.3 prerequisites (b) dual-field pre-mutation baseline read with no divergence and (c) r3 mechanics confirmation; did not state P2/P3 remain binding for future applicable runs; H1 as written would let first-run preparation records (B(H), acquisition observations, attestation) defeat their own premise; difference table inaccurate | §2.2 rewritten as clauses (a)–(f) preserving every locked prerequisite and stating P2/P3 binding; H0 (preparation records) introduced and excluded from H1 (§2.1, Rule B-2, §2.4 item 4); §2.3 difference table rebuilt against the controlling text |
| 2 | P-A identity omitted PM2 home, app names and exact key list (§3.4 item 1); invalidation omitted `pm2 update`, deploy and `.env` change and silently added key-set change / expiry (item 4); cross-check (item 5) omitted; departures unlabelled | §3.4 rewritten item-by-item preserving §3.4 items 1–5; §3.4a lists every departure as an explicit proposed amendment AM-1 … AM-6; I-2 requires a value per amendment |
| 3 | PV-2 offered "field-specific expectation" — refused by the LOCKED schema (`REFERENCE_FIELDS_INCONSISTENT`); per-key provenance mapping location unstated (schema has one `provenance` block); REISSUE demanded a "new `daemon_pid`" regardless of restart | Rule C-0 / C-5: identical expectations across both fields; per-key mapping external, linked through `provenance.source` / `authorization_record`; PV-2 / C-1 / C-3 wording aligned; §4.3 reissue identity reflects evidence (same PID absent a restart) |
| 4 | D7 text said "no token in any Git object or governance document" while VERIFY-01 §6.3 already permits tokens in governance evidence by Keith decision; GOVERNANCE_EVIDENCE_PERMITTED mislabelled as a weakening; token payload not limited to protected SET | §5.2 rewritten: LOCKED handling requirements stated; LEDGER_ONLY labelled a proposed tightening; GOVERNANCE_EVIDENCE_PERMITTED labelled the existing convention; tokens only for protected SET; EMPTY / ABSENT no payload; no token publication in this task; §7.3 D7 and §8 D7 aligned |
| 5 | §7.5 rows 6–7 "struck" Keith's note / designation and counted the remainder as the option; D5 REFUSE was read as "implies B(H) as restore payload" | Rule F-1 and REQUIRES_CLARIFICATION added (§7.1); §7.5 rows 4–7 record verbatim and classify, never strip; §7.3 D5 REFUSE supplies no alternative policy, locked restore payload unchanged; §9 Step 3 recording rule updated |
| 6 | §7.4 accepted I-1 / I-2 as "recorded"; D8 INCLUDE without apps unhandled; §7.5 mixed independent partial outcomes (rows 1, 3) with incompatibilities; I-4 conservative coverage vs construction vs later narrowing unreconciled | I-1 / I-2 given exact approval options and required explicitly (§3.5, §7.4); D8 INCLUDE without apps = INCOMPLETE_AFFIRMATIVE (§7.2); §7.5a created for independent partial outcomes; §3.2 I-4 reconciliation paragraph added (no automatic narrowing; explicit I-1 amendment) |
| 7 | §4.2 said INVALID_INPUT / INTERNAL_ERROR "nothing was compared or published"; VERIFY-01 §5.4 shows diagnostic reports are emitted | §4.2 rows corrected: diagnostic report emitted; no accepted comparison or host-state conclusion |
| 8 | Illustrative cases and §10 no longer matched | V7–V8 corrected; V9–V13 added (conditional approval, incomplete D8 INCLUDE, refused D5 without alternative, missing I-1 approval, AM-1 / AM-5 refusal); §10 re-performed |

Correction write set: this document; `TASKS.md` (this task's fields); `TASKS_BACKLOG_FULL.md` (this task's body); `docs/control-plane/SATURATION_PROOF.json` (validator output). Nothing else. Steps 3–4 remain NOT AUTHORIZED. `OUTCOME_SELECTED=NONE`. A1 OPEN. A2 OPEN. Host UNCLEAN / HOLD. EXEC-01C6A `startCondition=NOT_READY`. Builder gate ON. Occupancy EMPTY. GOVERNANCE released UNOWNED.

---

## 13. Step 2 second correction record — remaining rule conflicts (2026-09-19; before any Step 3; same uncommitted freeze; baseline `b3b2f10895c2b90954db31dafaa6da6e2e0427be`)

Keith-directed review findings, verified against locked POLICY-01 §3.4 item 1 (app names; "exact named-key list"; no per-app coverage statement) and VERIFY-01 §4.1 / §4.6 / §4.8 / §5.4 / §6.3 before editing. §12 improvements preserved. No decision was selected; no host, gate, or sidecar state changed.

| # | Finding (verified) | Correction |
|---|---|---|
| 1 | §3.2 / §3.4a / §3.5 claimed POLICY §3.4 item 1 establishes "every named key on every named app" and made that a default when AM-5 is refused | §3.2 coverage-authority paragraph: the locked text fixes the key list, not per-app coverage; two explicit proposals M-1 (§3.2 table, needs AM-5) and M-2 (conservative-all, no AM-5 dependency); no default; coverage UNRESOLVED when no matrix approved; refusing AM-5 adopts nothing. `APPROVE_LOCKED_DEFAULT` replaced by `APPROVE_M1` / `APPROVE_M2` / `APPROVE_AMENDED`; AM-5 row, §3.4 item 2, §7.4, V11, V13 updated |
| 2 | Recording rule did not distinguish fixed options, list/text-bearing options, and conditions; no review procedure for P-A-AMENDED / APPROVE_AMENDED; "verbatim" could reproduce protected material | §7.1 option classes F / L / C; Rule F-1 re-stated over the classes; Rule F-2 (redacted indication; permissible answer requested; "full answer" never overrides disclosure limits); Rule F-3 (amendment review against frozen constraints → CONSISTENT / INCONSISTENT / OUT_OF_SCOPE before any approval is derived; Step 3 performs, Step 4 re-performs); D3-ALT stated as recorded proposal, never adopted; "verbatim" replaced by "in full" in §7.5 rows 4–7, V7, V9, §9 |
| 3 | No explicit compatibility requirements between AM-3 ↔ D4, AM-5 ↔ I-1, AM-1 ↔ D6, approved matrix ↔ D8; AM-2 refusal wording implied the window check could be handled "as a coverage gap" | §7.5b compatibility table with CONTRADICTORY → each affected item OPEN; §7.4 requires every §7.5b row; Rule A-2 extended; former §7.5 row 3 moved to §7.5b C-4; §3.4a AM-1 / AM-3 refusal rows cross-reference §7.5b; AM-2 refusal row and §7.5b note: verifier validity-window check unaffected; expiry failure distinguished from missing coverage |
| 4 | Discovered material defaulted to UNCLASSIFIED without stating its effect; A1-F (c) did not require valid comparison evidence, did not exclude INVALID_INPUT / INTERNAL_ERROR, and left MISMATCH "resolved by decision" without stating required subsequent evidence | §2.1 UNCLASSIFIED row (eligibility unresolved; not H0; not evidence of no H1); Rule B-2, §2.2 (a), §2.3, §2.4 item 4 aligned; §2.2 (c) rewritten: accepted MATCH / MISMATCH / DIVERGENT report required, diagnostics cannot satisfy, MISMATCH → separately authorized corrective decision → new authorized acquisition yielding accepted MATCH with no DIVERGENT key; no result establishes restoration success, fate or CLEAN; §4.2 closing note |
| 5 | Rule C-0 said unequal expectations "describe a latent overlay"; §8 D5 reason said every non-ACCEPT answer changes restore semantics; stale option names | Rule C-0: schema incompatibility only, no cause claim; §8 D5 reason corrected (REFUSE changes no restore semantics by itself; leaves A2 blocked); §8 I-1 / I-2 reasons aligned to M-1 / M-2 and §7.5b |
| 6 | Illustrative cases and §10 did not cover the corrected rules | V1, V11, V12, V13 updated; V13a, V14, V15, V16, V16a, V17, V18, V18a, V19, V20 added; §10 extended and re-performed over the whole matrix |

Correction write set: this document; `TASKS.md` (this task's fields); `TASKS_BACKLOG_FULL.md` (this task's body); `docs/control-plane/SATURATION_PROOF.json` (validator output). Nothing else. Steps 3–4 remain NOT AUTHORIZED. `OUTCOME_SELECTED=NONE`. A1 OPEN. A2 OPEN. Host UNCLEAN / HOLD. EXEC-01C6A `startCondition=NOT_READY`. Builder gate ON. Occupancy EMPTY. GOVERNANCE released UNOWNED.
