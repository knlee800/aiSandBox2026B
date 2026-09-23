# PM2-RECOVERY-P5-JOURNAL-01 — Stage-Start / Decision Freeze

**Task:** PM2-RECOVERY-P5-JOURNAL-01 — Prospective P5 journal-applicability rule and evidence requirements for first acquisition
**Nature:** GOVERNANCE / DECISION (4-step). No implementation lane. No sidecar candidate.
**Step:** 2 of 4 — reviewable freeze of the decision options and evidence requirements
**Step 2 date:** 2026-09-23
**Step 2 HEAD at window open:** `1652d60fe06499d5b129e54fdbdbcdbee4f9d42e` (branch main; working tree clean; matches the expected baseline)
**Registration:** `TASKS_BACKLOG_FULL.md` § PM2-RECOVERY-P5-JOURNAL-01 (Step 1 COMPLETE at HEAD `306b062125a701efa1b890f4314fda4401a810b3`)
**Dependencies:** PM2-RECOVERY-POLICY-01 (COMPLETE AND LOCKED), PM2-RECOVERY-ACQUISITION-01 (COMPLETE AND LOCKED), PM2-RECOVERY-BASELINE-GOV-01 (COMPLETE AND LOCKED). PM2-RECOVERY-CAPTURE-01 remains COMPLETE AND LOCKED and is not reopened.
**Acceptance object:** A prospective P5 journal-applicability rule and its evidence requirements for first acquisition, consistent with ACQUISITION-01 §4.2.
**Step 2 correction #1:** 2026-09-23 — Keith-directed, 3 groups: (1) J-1/E-J2/E-J4: removed "missing journal → empty DISPATCHED set → vacuously satisfied"; journal absence does not establish absence of applicable attempts; E-J2 now blocking; E-J4 reconciled with H1 material. (2) J-2: scope-approval gate added (proposal/approval/coverage justification/unknowns); E1 independently required (ACQUISITION-01 §2.1); conditional inapplicability distinguished from completed cross-check; new activity and discovered material carried into validity/invalidation; removed rationale implying J-2 avoids E1. (3) Amendment lifecycle: §0 invariant 8 added; §4.1 rewritten with five-stage table; predecessor bodies "physically unchanged"; §5.1/§5.3 reconciled; §6 updated with 4 questions including E-J2 investigation gap and scope adequacy standard.
**Step 2 correction #2:** 2026-09-23 — Keith-directed consistency, 4 items: (1) E-J3: replaced duplicated J-2 criteria with reference to §2 J-2 criteria 1–6, scope-approval gate, and E-J5 validity/invalidation; outcome = conditional inapplicability only under adopted J-2, never completed cross-check; E1 independently blocking. (2) E-J2: investigation = evidence, not authority; under J-1 missing journal stays blocked; conditional inapplicability requires adopted J-2 or separate amendment. (3) §4.2 item 5 heading: "Does NOT edit locked predecessor document bodies" matching explanatory text. (4) Backlog "3 → 4 unresolved contract questions"; SATURATION_PROOF.json encoding restored.

---

## §0. Invariants preserved by this freeze

1. **Predecessor bodies unchanged.** POLICY-01, ACQUISITION-01, BASELINE-GOV-01, and CAPTURE-01 locked stage-start documents and backlog bodies remain physically unchanged. This freeze cites locked text; it does not edit any predecessor document file.
2. **P5 process-table component preserved.** Every decision option in this freeze retains the process-table observation (POLICY-01 §5.2 row 1; ACQUISITION-01 §4.3 ACQ-1e / ACQ-3d). No option removes or weakens it.
3. **All other acquisition prerequisites preserved.** P1–P4, P6–P8, E1–E5, A1 clauses (a)–(f), A2, the §4.1 authorization stages, and every other C-ACQ prerequisite are unaffected. E1 (vault registry) remains independently required by ACQUISITION-01 §2.1 regardless of the journal-applicability option adopted.
4. **No host condition established.** This freeze determines no fact about any host, vault, journal, or recovery material. All options that reference host-specific evidence describe **required future evidence**, not evidence that has been obtained.
5. **EXEC-01C6A startCondition=NOT_READY.** Unchanged.
6. **HOST_CLEAN=NO, P7_ACCEPTED=NO, REOPEN_GATE=UNSATISFIED.** Unchanged.
7. **Locked predecessor correction.** ACQUISITION-01 §4.2 correction #3 removed "no vault → vacuously satisfied" because no controlling adopted provision supported that conclusion. The three-state framework (applicable evidence supplied / explicitly determined inapplicable / unresolved → blocks C-ACQ) is the current locked authority. This freeze operates within that framework.
8. **Amendment lifecycle.** Step 2 proposes decision options (including J-2, which is a proposed amendment) but **adopts nothing**. A later explicit Keith selection at Step 3 may adopt the precisely scoped prospective P5 amendment (J-2), or may retain the locked requirement (J-1), or may leave the question unresolved (J-3). Regardless of which option is adopted, locked predecessor document bodies remain physically unchanged and no host-specific satisfaction or operational permission follows from adoption alone.

---

## §1. Controlling requirements

### 1.1 Locked P5 text — two components

**Component 1 — Process-table observation** (POLICY-01 §3.1 row P5; §5.2 row 1):

> Operator-owned PM2 CLI children for the overlay/restore commands are confirmed absent (process-table evidence of those operator children). This proves client absence, **not** daemon quiescence, and is therefore insufficient alone.

Evidence: process-table listing filtered to operator user and `pm2` argv (names only), at T1 and immediately before the P6 read. Stop condition: any operator `pm2` child present. Expiry: immediately after the P6 read completes.

**Source:** POLICY-01 §3.1 P5, §5.2 rows 1 and 3. Adopted at POLICY-01 Step 3 (Keith decision R3 = OUTCOME_POLICY_APPROVED_AMENDED, A4 sole amendment). Binding.

**Component 2 — Journal cross-check** (POLICY-01 §5.2 row 2):

> Every `DISPATCHED` attempt in the registered vault journal has a terminal; UNCERTAIN attempts are listed by id (they remain UNCERTAIN).

Provenance: vault (names only).

**Source:** POLICY-01 §5.2 row 2. Part of the locked P5 attestation form. Binding.

**Status:** Component 1 is directly performable during acquisition (ACQ-1e, ACQ-3d). Component 2 references "the registered vault journal," which presupposes a registered vault containing a journal. The locked text does not define what happens when no vault is registered or when no journal exists within a registered vault.

### 1.2 What A1 does and does not amend

BASELINE-GOV-01 adopted A1-F (§2.2), which amends P2/P3 first-run prerequisites (clauses a–f). **A1-F explicitly does not amend P5:**

> Satisfying (a)–(f) is an amended **prerequisite** set, not evidence that the original P2/P3 requirements have been met; P2/P3 become evidence-bearing for H only after the first dispatch and are then verified per run. Satisfying (a)–(f) does not establish host CLEAN, does not satisfy P4–P8, does not accept P7 residual risk, does not reopen any task, and does not authorize acquisition or a canary.

**Source:** BASELINE-GOV-01 §2.2, clause (f) and concluding paragraph. Binding.

**Consequence:** A1's amendment of P2/P3 first-run prerequisites creates no exception, relaxation, or replacement for P5 or any component of P5. P5's journal cross-check must be independently resolved for a first acquisition just as for any other acquisition.

### 1.3 ACQUISITION-01 §4.2 three-state framework (locked)

ACQUISITION-01 §4.2 established three possible states for the journal cross-check at C-ACQ time:

| State | Meaning | Effect on C-ACQ |
|---|---|---|
| **Applicable journal evidence supplied** | A separately authorized finding confirms the journal cross-check result (all DISPATCHED entries terminal, or UNCERTAIN entries listed) and supplies it as external evidence | P5 journal cross-check satisfied for this acquisition |
| **Explicitly determined inapplicable** | A separately authorized determination, citing its controlling authority, establishes that the P5 journal cross-check does not apply to this (H, A) at this time | P5 journal cross-check requirement removed for this acquisition by that authority |
| **Applicability / evidence unresolved** | Neither the journal evidence nor a controlling inapplicability determination has been supplied | **C-ACQ is blocked** |

**Source:** ACQUISITION-01 §4.2, locked. This freeze selects one of these three paths, or leaves the dependency unresolved.

### 1.4 Distinctions required by scope constraints

| Distinction | Requirement |
|---|---|
| No registered vault ≠ no applicable recovery material | A missing E1 entry does not prove no vault, journal, or other recovery material exists for (H, A). ACQUISITION-01 §4.2: "Neither the absence of a designated vault (no E1) nor the existence of an E1 entry proves that no applicable recovery material exists." |
| Interpretation ≠ amendment | A determination that P5's journal cross-check is inapplicable for a first acquisition could be either (a) an interpretation supported by existing locked authority, or (b) a proposed amendment requiring explicit Keith adoption. This freeze must identify which category each option falls into. |
| Contract-only lock ≠ host-specific satisfaction | Adopting a rule at Step 3 does not establish that any host satisfies it. External host-specific evidence is required separately. |
| Process-table component preserved | Every option preserves P5 component 1 (§1.1 above). The decision concerns component 2 only. |

---

## §2. Decision options

All options below are UNADOPTED. Keith selects one at Step 3. The recommended option is identified but carries no authority until adopted.

### Option J-1: Journal cross-check applies universally — vault registration and inspection required

**Category:** Strict retention of the locked requirement. No interpretation gap; no amendment needed.

**Rule:** The P5 journal cross-check (§1.1 component 2) applies to every acquisition, including a first acquisition. Before C-ACQ for (H, A), a vault must be registered (E1) for (H, A), and the registered vault must be inspected under separate authorization for the presence and content of a journal.

**Evidence to satisfy the cross-check (§3 matrix applies):**

- Vault registered, journal exists → journal cross-check result supplied as external evidence
- Vault registered, no journal file → journal absence does not establish that no DISPATCHED attempts exist for (H, A); absence finding supplied as evidence but **C-ACQ blocked** pending a separately authorized determination of whether applicable attempts occurred outside the journal (§3.2 E-J2)
- Vault registered, journal inaccessible → C-ACQ blocked until accessibility resolved
- No vault registered → C-ACQ blocked until E1 established and vault inspected

**Effect:** Every first acquisition requires vault registration and journal evidence before C-ACQ. This may delay C-ACQ for the time required to register and inspect the vault.

**Amendment needed:** No (retains locked text as-is).

**Risk:** Requires vault interaction (registration + inspection) before first acquisition, which is itself an authorized operation on host state.

### Option J-2: Prospective first-run journal-applicability rule — recovery-material absence attestation required

**Category:** Proposed amendment to P5 for first acquisitions. This goes beyond what the locked text explicitly provides and requires explicit Keith adoption.

**Rule:** For a first acquisition under A1 first-run prerequisites where clause (a) is satisfied (no H1 item for (H, A)):

- **Component 1 (process-table):** Unchanged. Applies at assessment times per §1.1.
- **Component 2 (journal cross-check):** Replaced by a **recovery-material absence attestation** under a prospective scope-approval gate. A dated, host-specific, Keith-accepted written attestation for (H, A) that:
  1. States the defined search scope (filesystem paths, operator accounts, PM2 homes, named apps examined).
  2. Records whether a vault directory, journal file (`overlay_commands.json`), `pending_apps.json`, `protected/*.value` files, or other material consistent with prior 01C6A-class recovery work was found within that scope.
  3. If no such material was found: states that no applicable recovery material was found within the defined scope and that the scope covered the expected locations for (H, A).
  4. If any material was found: classifies each item as H0 (preparation record) or H1 (prior applicable recovery work) per BASELINE-GOV-01 §2.1. Any UNCLASSIFIED item leaves the attestation incomplete and the journal cross-check unresolved.
  5. Does not claim that no material exists outside the searched scope.
  6. Records any relevant new activity on (H, A) that occurred after the search and before attestation acceptance. New activity invalidates the attestation if it could have produced applicable material.

**Prospective scope-approval gate (applies only if J-2 is adopted):**

| Element | Requirement |
|---|---|
| **Scope proposal** | Keith (or a Keith-delegated inspector) proposes the search scope for (H, A), identifying: filesystem paths to examine, operator accounts covered, PM2 home directories, named apps, and the basis for believing these locations are the relevant ones |
| **Scope approval** | Keith approves the proposed scope before the search is performed. Approval records: the approved paths/accounts/homes, the evidence or reasoning justifying that these locations cover the relevant territory for (H, A), and any known limitations |
| **Coverage justification** | The scope must cover every location where prior 01C6A-class recovery material could exist for (H, A) based on known operator history, known PM2 configurations, and known deployment patterns. The justification must cite specific facts, not assumptions |
| **Unknowns that prevent acceptance** | Unknown operator accounts on H; unknown PM2 home directories; unexplored filesystem areas where material could exist; gaps in operator activity history that could conceal prior recovery work; any pending operation that could produce material before attestation acceptance. Any of these leaves the scope insufficient and the attestation cannot be accepted |
| **Incomplete coverage** | If approved scope is later found to omit a relevant location, the attestation is invalidated. Approval alone cannot establish factual absence of material — the search must actually find nothing in an adequate scope |

**Conditional inapplicability vs completed cross-check:** If the attestation is complete and no H1 material is found within the approved scope, the P5 journal cross-check is **conditionally determined inapplicable** for this acquisition under the adopted amendment — because no applicable recovery material exists within the approved scope to produce a journal. This is **not** a completed journal cross-check (which requires an actual journal and actual DISPATCHED-entry evidence under E-J1). The distinction matters: conditional inapplicability is contingent on the attestation remaining valid, while a completed cross-check is contingent on the journal and vault remaining unmodified.

If any H1 material is found, or the attestation is incomplete, or the scope is insufficient: the journal cross-check is not satisfied, and the applicable journal (if any) must be produced and cross-checked under J-1 / E-J1 evidence rules.

**E1 independence:** Adoption of J-2 does **not** remove the E1 (vault registry) requirement from C-ACQ. ACQUISITION-01 §2.1 independently requires "E1 vault registry entry for (host, app set) recorded before first authorized run" as a prerequisite for the acquisition sequence. J-2 resolves only the P5 journal cross-check dependency; E1 registration remains a separate, independent C-ACQ prerequisite that must be satisfied regardless of which journal-applicability option is adopted.

**Effect:** For first acquisitions only, replaces the journal cross-check with a scoped absence attestation subject to a scope-approval gate. Requires host interaction (searching for material) under separate authorization. Does not apply to non-first acquisitions. Does not remove E1 or any other C-ACQ prerequisite.

**Amendment needed:** Yes — this is a new rule not present in locked P5. Explicit Keith adoption required at Step 3.

**Risk:** The attestation scope is inherently bounded; material outside the searched scope is not covered. The attestation is a human claim, subject to the same limitations as H2 in A1(b).

### Option J-3: Leave unresolved — C-ACQ remains blocked

**Category:** Retention of current state. No rule adopted; no determination made.

**Rule:** No journal-applicability rule is adopted. The ACQUISITION-01 §4.2 unresolved dependency remains in effect. C-ACQ is blocked until a future decision resolves the journal-applicability status.

**Evidence:** None required by this option. The question is deferred.

**Effect:** C-ACQ remains blocked. The process-table component of P5 is unaffected. All other acquisition prerequisites are unaffected. The capture mechanism (CAPTURE-01 LOCKED) remains available for future use once C-ACQ is eventually authorized.

**Amendment needed:** No.

**Risk:** Delays C-ACQ indefinitely. May require a future GOVERNANCE / DECISION task to revisit.

### Recommendation (UNADOPTED)

**Recommended option: J-2** (prospective first-run journal-applicability rule with recovery-material absence attestation).

**Rationale:** J-1 retains the locked text strictly but treats a missing journal as blocking (E-J2), which may require significant investigation when no journal has ever been created for (H, A). J-2 directly addresses the underlying question — does applicable recovery material exist for this (H, A)? — through a scoped attestation with a scope-approval gate, without assuming material is absent. Both J-1 and J-2 independently require E1 registration (ACQUISITION-01 §2.1). J-3 defers indefinitely with no progress.

**The recommendation is UNADOPTED.** Keith selects at Step 3.

---

## §3. Evidence requirements matrix

This section defines the required evidence for each possible host-specific state that may be encountered when applying the adopted rule. No actual host condition has been established.

### 3.1 Evidence states

| ID | State | Description |
|---|---|---|
| **E-J1** | Applicable journal available | A registered vault (E1) for (H, A) contains a journal file (`overlay_commands.json`). The journal can be read. |
| **E-J2** | Vault registered, no journal | A registered vault (E1) for (H, A) exists. The vault directory contains no journal file. |
| **E-J3** | No registered vault | No E1 entry exists for (H, A). No vault has been designated. |
| **E-J4** | Recovery material found but no journal | Recovery-relevant material (per §2 Option J-2 attestation criteria) exists for (H, A) but no intact journal file is found. |
| **E-J5** | Evidence of absence within defined scope | A recovery-material absence attestation (per §2 Option J-2) covers the expected locations for (H, A) and finds no applicable material. |
| **E-J6** | Missing, inaccessible, or incomplete evidence | A vault or journal is expected to exist but cannot be accessed, is corrupted, or the search was not completed. |
| **E-J7** | Conflicting evidence | Evidence from different sources disagrees about whether applicable recovery material exists. |

### 3.2 Evidence requirements per state

| State | Required evidence | Provenance | Host/app/time scope | Authorized reviewer | Validity conditions | Invalidation | Blocking outcome |
|---|---|---|---|---|---|---|---|
| **E-J1** | Journal cross-check result: for every DISPATCHED attempt, a terminal status exists; every UNCERTAIN attempt listed by ID | Journal file in the registered vault (names and statuses only; no secret values) | (H, A) for the registered vault's app set; at the time of inspection | Keith (or Keith-delegated reviewer) | Valid until: journal is modified; vault is modified; a new attempt is dispatched; Keith revokes | Any of the validity-ending events | If any DISPATCHED entry lacks a terminal, or inspection incomplete → journal cross-check FAILS → C-ACQ blocked until resolved |
| **E-J2** | Written finding: vault path stated; directory listing shows no `overlay_commands.json`; listing date and method recorded | Authorized inspector under separate Keith authorization | (H, A) for the registered vault path; at inspection time | Keith | Valid until: any file is created in the vault; vault is modified; any new activity on (H, A) occurs; Keith revokes | File creation in vault; vault modification; new activity on (H, A); Keith revocation | **C-ACQ blocked.** Journal absence does not establish that no DISPATCHED attempts exist for (H, A). A separately authorized determination is required. Under J-1, the only resolution path is to produce the applicable journal and perform the cross-check (E-J1). An investigation finding no applicable attempts is evidence that may inform a future determination, but under J-1 it is not authority to waive the journal cross-check and does not by itself unblock C-ACQ; the journal absence remains unresolved. Conditional inapplicability of the journal cross-check requires either adopted J-2 with all its conditions met (§2 Option J-2 criteria 1–6, scope-approval gate, and E-J5 validity/invalidation), or a separately adopted amendment — investigation alone cannot produce conditional inapplicability under J-1. If H1 material exists for (H, A) (E-J4), journal absence is particularly suspect and any future determination must account for the H1 material |
| **E-J3** | Under J-1: C-ACQ blocked until E1 established and vault inspected. Under J-2 (if adopted): full §2 Option J-2 criteria 1–6 apply under the scope-approval gate; E-J5 validity/invalidation rules govern the attestation | Under J-1: N/A (E1 must first be registered). Under J-2: authorized search of approved scope on (H, A) per §2 scope-approval gate | (H, A); under J-2: approved filesystem scope; at search time | Keith | Under J-2: per E-J5 validity conditions (material discovery, new activity, scope inadequacy, Keith revocation) | Under J-2: per E-J5 invalidation rules | Under J-1: C-ACQ blocked; E1 independently blocking until registered (ACQUISITION-01 §2.1). Under adopted J-2 with accepted qualifying evidence meeting all §2 criteria 1–6: **conditional inapplicability** under the adopted amendment (never a completed journal cross-check; contingent on attestation remaining valid per E-J5). Under J-2 with incomplete attestation, insufficient scope, or H1 found: cross-check unresolved → C-ACQ blocked |
| **E-J4** | Classification of each found item as H0 or H1 per BASELINE-GOV-01 §2.1. Any H1 item → journal must be produced and cross-checked; missing journal with H1 material does not satisfy the cross-check | Authorized classification under separate Keith authorization | (H, A); material location and identity | Keith | Valid until: new material discovered; new activity on (H, A) occurs; classification revised; Keith revokes | New discovery; new activity on (H, A); reclassification; Keith revocation | If any item UNCLASSIFIED → attestation incomplete → cross-check unresolved → C-ACQ blocked. If any H1 item found → journal must be produced from or for that material and cross-checked (E-J1 rules); missing journal does not resolve the cross-check because H1 material evidences prior applicable work whose attempts may have been DISPATCHED. If all items classified H0 → does not alone resolve journal applicability; must still satisfy the adopted option's requirements |
| **E-J5** | Recovery-material absence attestation per §2 Option J-2 criteria 1–6 under an approved scope (§2 scope-approval gate) | Authorized search of approved scope on (H, A) | (H, A); approved filesystem scope; at search time | Keith | Valid until: applicable material discovered for (H, A) within or outside the approved scope; new activity on (H, A) that could produce applicable material; scope found to omit a relevant location; Keith revokes | Material discovery (within or outside scope); new activity on (H, A); scope inadequacy discovered; Keith revocation | If attestation complete with no H1 material in approved scope: P5 journal cross-check **conditionally determined inapplicable** for this acquisition under the adopted amendment (not a completed journal cross-check; contingent on attestation remaining valid). Attestation does not cover material outside the approved scope. If scope insufficient, attestation incomplete, or H1 found: cross-check unresolved → C-ACQ blocked |
| **E-J6** | Report of inaccessibility, corruption, or incomplete search with specific details (what was attempted, what failed, error details) | Authorized inspector | (H, A); affected paths; at attempt time | Keith | N/A (blocking condition) | Resolution of accessibility issue | **C-ACQ blocked.** Inaccessible evidence cannot satisfy the journal cross-check under any option. Must resolve accessibility before retrying |
| **E-J7** | Both conflicting findings documented with provenance; Keith decision on how to resolve (re-inspect, accept one source, or commission further investigation) | Both sources documented | (H, A); both evidence sources and their scope/time | Keith | N/A (blocking condition) | Keith resolution decision | **C-ACQ blocked.** Conflicting evidence cannot satisfy the journal cross-check. Keith decision required to resolve |

### 3.3 What evidence does NOT establish

- Evidence produced by this decision **does not establish host CLEAN.**
- Evidence produced by this decision **does not satisfy P4, P6, P7, or P8.**
- Evidence produced by this decision **does not accept residual daemon-buffer risk.**
- Evidence produced by this decision **does not authorize acquisition, canary, or reopen.**
- A complete cross-check (satisfied or inapplicable) **unblocks only the P5 journal-applicability dependency on C-ACQ.** All other C-ACQ prerequisites must be independently satisfied.

---

## §4. Effect of a later decision

### 4.1 Amendment lifecycle — proposal, adoption, application

| Stage | What happens | What does NOT happen |
|---|---|---|
| **Step 2 (this freeze)** | Decision options proposed, including J-2 (a prospective P5 amendment). Evidence requirements frozen. All options UNADOPTED | Nothing adopted. No amendment in force. No host condition established. No operational permission granted |
| **Step 3 (Keith's explicit selection)** | Keith selects one option. If J-2: Keith's selection constitutes explicit adoption of the precisely scoped prospective P5 first-run amendment. If J-1 or J-3: no amendment adopted | Locked predecessor document bodies remain physically unchanged regardless of selection. No host-specific satisfaction. No C-ACQ unblocking. No operational permission |
| **Step 4 (independent verification and lock)** | Decision record verified as internally consistent and correctly recorded. LOCKED | No new authority created beyond what Step 3 adopted. No host-specific satisfaction. No C-ACQ unblocking |
| **Host-specific evidence (separate future window)** | External evidence obtained for a specific (H, A) under separate authorization, applying the adopted rule's requirements | Separate authorization required. Not part of this task |
| **P5 journal cross-check resolved** | The adopted rule's evidence requirements are met for a specific (H, A) with specific accepted evidence. The ACQUISITION-01 §4.2 three-state framework exits the "unresolved" state | Only the P5 journal-applicability dependency on C-ACQ is resolved. All other C-ACQ prerequisites must still be independently satisfied |

### 4.2 What a contract-only lock does NOT do

A LOCKED decision record (Step 4) from this task:

1. **Does NOT establish that any host satisfies P5.** The adopted rule defines what evidence is required. Evidence must be separately obtained and accepted.
2. **Does NOT unblock C-ACQ.** C-ACQ requires the P5 journal cross-check to be satisfied or determined inapplicable **with host-specific evidence**, not merely a rule defining what evidence would be accepted.
3. **Does NOT change HOST_CLEAN, P7_ACCEPTED, or REOPEN_GATE.** These are unchanged.
4. **Does NOT authorize acquisition, transfer, SSH, PM2, host inspection, canary, or any runtime activity.**
5. **Does NOT edit locked predecessor document bodies.** POLICY-01, ACQUISITION-01, BASELINE-GOV-01, and CAPTURE-01 stage-start documents and backlog bodies remain physically unchanged. If J-2 is adopted, this task's lock carries the adopted amendment text; the predecessor documents that the amendment modifies the application of are not themselves edited.
6. **Does NOT change EXEC-01C6A startCondition=NOT_READY.**

### 4.3 Preserved requirements

The process-table component of P5 (§1.1 component 1) remains binding and directly performable during any acquisition (ACQ-1e, ACQ-3d). No decision in this task alters it.

Every other acquisition prerequisite (P1–P4, P6–P8, E1–E5, A1(a)–(f), A2, §4.1 authorization stages) is unaffected by this task's decision.

---

## §5. Step 3 / Step 4 acceptance criteria

### 5.1 Step 3 — record Keith's explicit selection

- [ ] Keith selects exactly one of: J-1, J-2, J-3
- [ ] If J-2 selected: Keith's selection constitutes explicit adoption of the precisely scoped prospective P5 first-run amendment described in §2 Option J-2; the amendment character is acknowledged in the decision record
- [ ] If J-1 selected: no amendment adopted; locked P5 text retained as-is; journal absence treated as blocking per E-J2
- [ ] If J-3 selected: no determination made; C-ACQ remains blocked on the unresolved dependency
- [ ] Selection recorded verbatim with date; no paraphrase, no inference, no supplied value
- [ ] If Keith provides conditions, modifications, or a different option: recorded exactly as stated
- [ ] Locked predecessor document bodies remain physically unchanged regardless of selection
- [ ] No host-specific P5 satisfaction claimed; no C-ACQ unblocked; no operational permission granted
- [ ] §0 invariants confirmed preserved (predecessor bodies physically unchanged; process-table component preserved; all other prerequisites including E1 preserved; no host condition established; EXEC-01C6A NOT_READY; HOST_CLEAN=NO; P7_ACCEPTED=NO; REOPEN_GATE=UNSATISFIED)

### 5.2 Step 4 — independent verification and lock

- [ ] Selected option correctly identified and recorded
- [ ] If J-2: amendment character acknowledged; explicit Keith adoption confirmed
- [ ] Evidence requirements (§3) frozen and internally consistent with the selected option
- [ ] §4 non-effects confirmed (contract-only lock; no host-specific satisfaction; C-ACQ not unblocked without external evidence)
- [ ] §0 invariants verified (predecessor bodies, process-table component, all other prerequisites, host conditions, EXEC-01C6A, HOST_CLEAN, P7, REOPEN_GATE all unchanged)
- [ ] No predecessor body edits
- [ ] Validator run; git diff --check clean

### 5.3 Explicit non-effects (apply to Steps 2, 3, and 4)

- Does NOT accept P7
- Does NOT establish HOST_CLEAN
- Does NOT satisfy the reopen gate
- Does NOT authorize acquisition, transfer, SSH, PM2, host inspection, or canary
- Does NOT change EXEC-01C6A startCondition=NOT_READY
- Does NOT unblock C-ACQ (external evidence separately required)
- Does NOT remove the E1 (vault registry) requirement from C-ACQ (ACQUISITION-01 §2.1)
- Does NOT reopen or physically amend POLICY-01, ACQUISITION-01, BASELINE-GOV-01, or CAPTURE-01 document files
- Does NOT inspect the host, any vault, any journal, or any recovery material
- Does NOT modify sidecar, lockedTaskIds, implementation candidates, or occupancy
- Step 2 proposes but adopts nothing; Step 3 may adopt; locked predecessor document bodies remain physically unchanged throughout

---

## §6. Unresolved contract questions

1. **Search scope adequacy standard.** If J-2 is adopted, the scope-approval gate (§2 Option J-2) requires Keith to approve a proposed scope before the search. The locked contracts do not define a standard for what constitutes adequate scope coverage for (H, A). Scope adequacy depends on host-specific facts (known operator accounts, PM2 configurations, deployment history) that are outside this task's determination. Exact host paths and scope proposals belong to a separately authorized evidence task.

2. **Material outside approved scope.** J-2's attestation explicitly does not cover material outside the approved scope (§2 Option J-2 criterion 5). If applicable material is later discovered outside the scope, the attestation is invalidated. The scope-approval gate requires coverage justification (§2), but the locked contracts do not define a completeness standard. Approval alone cannot establish factual absence — the search must actually find nothing in a scope that is justified as adequate.

3. **E1 (vault registry) requirement.** ACQUISITION-01 §2.1 independently requires E1 vault registration before first authorized run. This requirement applies regardless of which journal-applicability option is adopted and regardless of whether the P5 journal cross-check is satisfied or determined inapplicable. This task resolves only the P5 journal cross-check dependency; E1 remains a separate C-ACQ prerequisite.

4. **Journal absence under J-1 (E-J2).** Under J-1, a registered vault with no journal file triggers C-ACQ blocking (§3.2 E-J2). The locked text does not prescribe a specific procedure for determining whether applicable attempts exist when no journal is found. Under J-1, the only resolution path is to produce the applicable journal and perform the cross-check (E-J1). An investigation finding no applicable attempts is evidence that may inform a future determination, but under J-1 it is not authority to waive the journal cross-check and does not by itself unblock C-ACQ. Conditional inapplicability of the journal cross-check requires either adopted J-2 with all its conditions, or a separately adopted amendment — investigation alone cannot produce conditional inapplicability under J-1.
