# PM2-RECOVERY-P5-J2-AMENDMENT-02 — Stage-Start / Step 2 Decision-Package Freeze

**Task:** PM2-RECOVERY-P5-J2-AMENDMENT-02 — Prospective J-2 amendment decision package for residual current-host unknowns after locked SEARCH-01 (PID 1193674 disclosed uncertainty; unrecorded `--vault` / `--workdir` remainder; pending-operation and post-search-activity evidence method)
**Nature:** GOVERNANCE / DECISION (4-step). No implementation lane. No sidecar candidate. No saturationClass.
**Step:** 2 of 4 — FROZEN FOR REVIEW. **NOTHING ADOPTED.** Step 3 NOT AUTHORIZED. Step 4 NOT AUTHORIZED. **Step 2 correction #1 (C1) applied 2026-10-01 (§14)** — localized; same documentation-only preparation authorization; same baseline; corrected sections are marked "(C1)". **Step 2 correction #2 (C2) applied 2026-10-01 (§15)** — localized; same authorization; same baseline; corrected text is marked "(C2)"; C1 remains the historical record of correction #1.
**Step 3 record:** 2026-10-01 — Keith's explicit selection recorded against this freeze as reviewed at SHA-256 `8e191e7267d7369fb05ba45b855cb7c508b091e6002e0579ca8c3ce435e8f8d6` (§16): D-PID-GONE = PID-B; D-PID-SAME = PID-S-REFUSE; D-REM = REM-ii; D-PEND = PEND-ADOPT + AGE-A + ROOT-A. Frozen wording unaltered. Nothing satisfied for (H, A). Step 4 NOT AUTHORIZED. Task NOT LOCKED. The **Step:** line above is preserved as the historical Step 2 status.
**Step 4 record:** 2026-10-01 — independent verification **PASS**; task **COMPLETE AND LOCKED** (§17). Verified input: this file at SHA-256 `1f3e0a2b020883021b37400c8a48a5d9503675a339c551b7f3abcbec9c443f47` before any Step 4 write, containing the C2 freeze SHA-256 `8e191e7267d7369fb05ba45b855cb7c508b091e6002e0579ca8c3ce435e8f8d6` unaltered. Lock scope = this decision record only (D-PID-GONE = PID-B; D-PID-SAME = PID-S-REFUSE; D-REM = REM-ii; D-PEND = PEND-ADOPT + AGE-A + ROOT-A, adopted as frozen). Satisfies nothing for (H, A); creates no execution, inspection, acceptance, or registration authority. The **Step:** and **Step 3 record:** lines above are preserved as historical status.
**Date:** 2026-10-01
**Baseline (Steps 1–2, same window):** `7a5f65fbf348e23a45f0f28a61efb34f66bee7e2` (branch main; index empty at window open; inherited dirtiness preserved unchanged: `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/PM2-RECOVERY-P5-J2-U1-PRIV-INSPECTION-01-STAGE-START.md` (uncommitted §17 proposal), `docs/control-plane/SATURATION_PROOF.json`)
**Registration:** `TASKS_BACKLOG_FULL.md` § PM2-RECOVERY-P5-J2-AMENDMENT-02 (Step 1 COMPLETE in this window)
**Authorization recorded:** Keith authorized documentation-only Steps 1–2 (registration and preparation of a prospective J-2 amendment decision package) at the baseline above. Not authorized: adoption, Step 3, Step 4 / lock, implementation, runtime tests, host / SSH / sudo / AWS access, inspection, transfer, acceptance, recovery, reopening, additional successor registration, staging, commit, push, subagents.
**Starting material:** the chat-only consolidated decision proposal of 2026-10-01 (not a repository artifact), as corrected by Keith's six review findings. The uncommitted PRIV-INSPECTION-01 §17 proposal is a separate advisory artifact and is **not** incorporated, edited, or superseded by this freeze.

---

## §0. Invariants preserved by this freeze (not re-decided)

1. J-2 is the adopted P5 journal-applicability rule (P5-JOURNAL-01 §2 / §7.2, LOCKED). Its criteria 1–6, scope-approval gate, E-J5 validity / invalidation regime, and E1 independence are unchanged by this freeze.
2. AMENDMENT-01 Option B is the adopted J-2 amendment (AMENDMENT-01 §10–§11, LOCKED). Its application sequence (1)–(4), U-1 / U-2 definitions, Classification paragraph, conditions (a)–(e), B.6 outcomes, and B.7 revalidation are the controlling text amended **prospectively** by the proposals below. Nothing here edits that locked body.
3. SEARCH-01 is COMPLETE AND LOCKED (`680387c3237cfdf35bceadbb78e7058b8defa94c`); its §14.7 residual U-1 rows remain **blocking**; its §14.6 evidence (search window `SEARCH-01-START 2026-09-29T11:01:02Z` / `SEARCH-01-END 2026-09-29T11:01:05Z`; PID 1193674 `ps` rc 1, environ inaccessible) is the only accepted current-host observation of those rows.
4. U1-RESOLUTION-01 Option B (separately authorized sudo / read-only inspection) is the locked selection (`efd2140c9a8b0742bae76a9b1ef9566ab27ba68d`). Option C remains unselected. §6 cross-option constraints (incl. item 3 attestation-time pending; item 4 no closure of U1-unexplored by claiming a default) remain binding.
5. PRIV-INSPECTION-01 remains NOT LOCKED. Its Step 4 disposition stands: evidence integrity PASS; execution compliance FAIL; coverage INCOMPLETE; lock eligibility NOT ELIGIBLE. **The 2026-09-30 session is not accepted closure evidence for any U-1 row and is not used by this freeze to classify PID 1193674.** Its uncommitted §17 proposal remains PROPOSED — NOT ADOPTED and is not altered here.
6. **BASELINE-GOV-01 A1 and A2 are ADOPTED policy** (BASELINE-GOV-01 §14.5 / §15.4; ACQUISITION-01 §16.4): A1 = A1-F first-run applicability text (contract text only; clauses (a)–(f) unsatisfied for any host); A2 = P-A REQUIRED provenance policy with AM-1…AM-5, matrix M-1 (I-1), D4 REISSUE_PER_WINDOW, D5 comparison-only, D6 PROVENANCE_RECORD, D7 LEDGER_ONLY, D8 EXCLUDE; D2b = ACCEPTANCE; D9 = ACCEPT. I-4 / I-5 OPEN. Preserved status lines elsewhere reading "A1 OPEN / A2 OPEN" (POLICY-01 header; VERIFY-01 line 845) are historical text superseded by that lock. **This freeze does not re-propose, re-adopt, narrow, or widen A1 or A2.** To avoid collision, every clause proposed here is named `J2-A2-*` and the bare tokens "A1" / "A2" in this document refer only to the adopted BASELINE-GOV-01 policies.
7. ACQUISITION-01 C-ADOPT is adopted with Q1-A ABORT_IF_ABSENT, Q2-B TOOLING, Q3-A NO_RETRY (§15–§16, LOCKED). `EXECUTION_AUTHORIZED=NO`; no C-ACQ exists; the §3.6 residual auto-launch race is **not** accepted for any current invocation; §4.5 separation from P7 is binding.
8. CAPTURE-01 is COMPLETE AND LOCKED (`MECHANISM_ESTABLISHED=YES`; NOT approved for live use; not transferred).
9. `P7_ACCEPTED=NO`. `HOST_CLEAN=NO`. Host UNCLEAN / HOLD. Reopen gate UNSATISFIED. EXEC-01C6A `startCondition=NOT_READY`. Builder gate ON. Lane 3 DISABLED. PRIVATE-BETA-INVITE-01 PARKED / PROHIBITED.
10. No search, privilege, sudo, SSH, AWS, transfer, acquisition, acceptance, U-2(e), P5 satisfaction, C-ACQ, HOST_CLEAN, P7, reopen, or canary is created, performed, or authorized by this freeze.

---

## §1. Controlling authority and the problem

### 1.1 Adopted rule (identified by reference; not restated)

J-2 as adopted (P5-JOURNAL-01 §2 criteria 1–6; scope-approval gate; E-J5 / E-J6 in §3.1–§3.2) as amended by AMENDMENT-01 Option B (§2 Option B B.1–B.10; adopted §10; locked §11). The current-host scope for (H = aisandbox-staging, A = {aisandbox-api-gateway, aisandbox-ai-service}) was approved as proposed by J2-SCOPE-01 and searched by SEARCH-01.

### 1.2 Locked residual state

| Row (SEARCH-01 §14.7; U1-RESOLUTION-01 §2) | Locked status | Can the Option B privileged inspection resolve it within the frozen closed path set (PRIV-INSPECTION-01 §2.2)? |
|---|---|---|
| U1-G1 `/root/.pm2` | U1-REMAINS / E-J6 | Yes — a compliant privileged `stat` / name listing can yield RESOLVED-ABSENT, or a present `.pm2` requiring the §4.3 material-inside observation |
| U1-G2 inaccessible current-home `.pm2` (caddy, redis, pollinate, chrony) | U1-REMAINS / E-J6 | Yes — same class |
| U1-G3 PM2 home of PID 1193674 unidentified | U1-REMAINS | **No historical closure under this freeze (C2).** A SAME-PROCESS observation (§3.2 E5 table; §3.3) yields an observed *current* fact only; continuity with the 2026-09-29 match is inferred, and the only candidate exception for that inference (PID-S) is BLOCKED / NOT SELECTABLE (§3.6). If the process no longer exists, no observation can identify its home |
| U1-G4-current PID 1193674 unmatched by `ps` / environ | U1-REMAINS | Same limitation |
| U1-G5-dormant named-root traversal incomplete | U1-REMAINS | Yes within the closed roots, maxdepth 4; outside them, no |
| U1-G6-leftover `/root` leftover; inaccessible `/var/lib` subtrees | U1-REMAINS | Yes within the closed roots (`ls -1A` proposed) |
| U1-reloc relocation destinations under inaccessible paths | U1-REMAINS | Only names found inside the closed roots |
| U1-pending | U1-REMAINS (attestation-time) | **No method defined** for the acceptance-time assertion (SCOPE-01 GAP-8: "asserted by the control plane at approval / attestation time") |
| U1-unexplored unrecorded `--vault` / `--workdir` remainder | U1-REMAINS | **No** — an unrecorded operator-chosen path is outside every closed set by construction |

### 1.3 The problem this package addresses

Under adopted Option B condition (a), "no U-1 unknown remains" is required before U-2(e) and before attestation acceptance. Three residual rows cannot be brought to RESOLVED by any observation the locked Option B selection permits:

- **U1-G3 / U1-G4-current** when PID 1193674 is no longer the same process (nothing remains to observe; the SEARCH-01 record cannot identify it retroactively);
- **U1-unexplored** (an unrecorded path cannot be enumerated into a closed set; U1-RESOLUTION-01 §6 item 4 forbids closing it by claiming a default);
- **U1-pending** (the rule names the element but no adopted text defines the evidence that satisfies it at acceptance time).

Separately, the frozen inspection plan's execution-stop requirement (PRIV-INSPECTION-01 §8 item 7: stop the session when a capture cap or timeout is hit) cannot be enforced by the current carrier (INVENTORY-01 §4.3 whole-script stdin writer; local `Kill` of `ssh.exe` only; §0.11 / §9.9 no remote cleanup guarantee). That is a **mechanism gap**, not a rule gap; it is carried in §6 as unverified candidate work and is not hidden behind the principle that a capped or timed-out session resolves nothing.

Without an adopted treatment of the three rows, the Option B route cannot reach attestation acceptance regardless of how compliant a future privileged session is. This package offers Keith explicit, bounded choices, including refusal of each.

### 1.4 Lifecycle and naming

P5-JOURNAL-01 §0.8 / §4.1 govern: Step 2 proposes, adopts nothing; Step 3 is Keith's explicit selection constituting adoption; Step 4 is independent verification and lock in a separate window; locked predecessor bodies remain physically unchanged. AMENDMENT-01 is the precedent container.

Proposed clauses: **J2-A2-PID** (§3), **J2-A2-REM** (§4), **J2-A2-PEND** (§5). Each is independently adoptable or refusable (§8). None is adopted here.

---

## §2. Every affected provision, classified

Classes used in this section:

- **FACT** — factual resolution: the provision is satisfied by evidence, with no rule change.
- **EXCEPTION** — a proposed acceptance exception: the provision's current requirement is not met and a new rule would let Keith accept a disclosed residual instead. This is a weakening and is labelled as such.
- **BLOCKING** — unresolved blocking evidence: the provision is not satisfied, no exception is proposed, and the route stops there until evidence exists.
- **UNCHANGED** — preserved verbatim; listed because it is adjacent and must not be read as affected.

| # | Provision (source) | Current requirement | Class under this package | Clause |
|---|---|---|---|---|
| 1 | J-2 scope-approval gate "Coverage justification" (P5-JOURNAL-01 §2): "must cover every location where prior 01C6A-class recovery material could exist … cite specific facts, not assumptions" | every possible location covered; facts only | **EXCEPTION** (C1): the justification can cite facts only for the fact-supported set; the territory each clause excludes (a possible PM2 home of the 2026-09-29 process; the indication-free unrecorded remainder) is a location where material *could* exist and is **not covered**. Each clause is therefore also an exception to this element for its excluded territory. The facts-not-assumptions rule itself is UNCHANGED | PID, REM |
| 2 | Option B (U-1) element "unknown PM2 home directories on H" (AMENDMENT-01 B.1) | blocking at attestation | **EXCEPTION** for exactly one item — the PM2 home that may exist for the 2026-09-29 holder of PID 1193674 — and only on PID-GONE / PID-REUSED eligibility (§3.2). **(C2)** On a SAME-PROCESS result **no** exception is available in this freeze: PID-S is BLOCKED / NOT SELECTABLE (§3.6) because reconciling it with the possibly unidentified historical home would require exceptions to condition (b), the coverage-justification element, and criterion 3 beyond the §3.1 proposal; the rows remain U1-REMAINS with the observed current fact recorded. The environ-without-`PM2_HOME` branch and every UNCLASSIFIABLE outcome have **no** exception and are BLOCKING (C1 / C2) | J2-A2-PID |
| 3 | Option B (U-1) element "unexplored filesystem areas on H where material could currently exist" | blocking at attestation | **EXCEPTION** under REM-ii for the indication-free unrecorded remainder only; **BLOCKING** for every named, denied, timed-out, incompletely listed, or indicated path (E-J6 preserved) | J2-A2-REM |
| 4 | Option B (U-1) element "any pending operation that could produce material before attestation acceptance" | blocking; no method defined | **EXCEPTION** in the sense of §5.1: the proposed clause fixes an observational evidence standard where the adopted text is unbounded; residual unobservable pending operations become a disclosed, accepted residual. Not labelled "no threshold change" | J2-A2-PEND |
| 5 | Option B Classification paragraph: "Uncertainty about whether a location still exists is unresolved present-day coverage (U-1), not a U-2 historical unknown" | U-1 | **EXCEPTION** (REM-ii narrows this for paths with *no indication at all* of historical choice or current existence); UNCHANGED for any path with any indication | J2-A2-REM |
| 6 | Option B condition (a) "no U-1 unknown remains" | absolute | **EXCEPTION** — accepts the disclosed U-1 residuals of items 2 and 3 above (PID-GONE / PID-REUSED and REM-ii only; **not** the SAME-PROCESS continuity inference — C2) and the §5 pending residual (incl. the ROOT-B root-path residual; **not** any artifact whose status evidence is insufficient — C2), each only under its clause's eligibility and Keith's distinct recorded decision | all three |
| 7 | Option B condition (b) "search covering **all** U-1 current relevant locations … completed … no H1 / UNCLASSIFIED … E-J6 for incomplete / inaccessible / privilege-blocked" | absolute for every current relevant location, named or not | **BLOCKING** where any named location is denied, timed out, incompletely listed, or unreached (E-J6 preserved verbatim); **FACT only for the named, fact-supported set** when compliant observation yields RESOLVED-ABSENT or RESOLVED-COVERED for each; **EXCEPTION** (C1) for the excluded territory of each clause — (b) as adopted covers *all* current relevant locations and the excluded territory is never searched, so (b) is **not met as a whole**; the attestation must state separately "observed facts: … RESOLVED" and "accepted uncertainty: … not searched" and must never describe excluded territory as resolved | PID, REM |
| 7a | J-2 scope-approval gate "Incomplete coverage" element: "If approved scope is later found to omit a relevant location, the attestation is invalidated" | — | UNCHANGED; it is the adopted basis for the invalidation triggers in §3.5 / §4.5 (a later-identified PM2 home or vault path is an omitted relevant location) | — |
| 8 | Option B condition (c) testimony | preserved as given | UNCHANGED | — |
| 9 | Option B condition (d) disclosure statement | lists unresolved historical unknowns | **extended** (not weakened): must additionally name each accepted J2-A2 residual and state that criterion 5 excludes it from the absence claim (§3.4, §4.4, §5.4) | all three |
| 10 | Option B condition (e) Keith's U-2(e) acceptance | historical residual only | **extended**: the same attestation-time acceptance act carries the J2-A2 acceptances; each is a distinct recorded decision | all three |
| 11 | J-2 criterion 1 (states the defined scope) | — | FACT (scope = J2-SCOPE-01 approved scope + any quoted-path extension approved before the privileged session) | — |
| 12 | J-2 criterion 3 ("states that no applicable recovery material was found within the defined scope **and that the scope covered the expected locations for (H, A)**") | the scope covered the expected locations | **EXCEPTION** (C1): a possible PM2 home of a PM2-heuristic process and an operator-chosen vault / workdir are *expected-location categories*; the clauses exclude them, so the criterion-3 statement as adopted cannot be made truthfully. Under the clauses the statement is bounded: "covered the fact-supported expected locations [enumerated]; the following expected-location categories were not covered and are accepted as disclosed uncertainty under J2-A2-x: …". Excluded territory is **never** described as covered or resolved | PID, REM |
| 13 | J-2 criterion 4 (classify H0 / H1; UNCLASSIFIED blocks) | — | UNCHANGED; any filename-class hit enters the §7 B5 classification stage under separate authorization (E-J4) | — |
| 14 | J-2 criterion 5 (does not claim absence outside searched scope) | — | UNCHANGED; it **limits the claim**, it does not resolve any unknown (U1-RESOLUTION-01 §6 item 4) | — |
| 15 | J-2 criterion 6 (records post-search activity; invalidates if it could have produced material) | — | **method supplied** (§5.3); threshold unchanged; residual: unknown activity not visible to any named source (BASELINE-GOV-01 Rule D-2: E2 proves known, not exclusive, activity) | J2-A2-PEND |
| 16 | E-J5 validity / invalidation (P5-JOURNAL-01 §3.2) | material discovery; new activity; scope inadequacy; revocation | UNCHANGED; **additional triggers** added per clause (§3.5, §4.5, §5.5) | all three |
| 17 | E-J6 missing / inaccessible / incomplete evidence | blocks C-ACQ | **UNCHANGED and explicitly preserved** for every known inaccessible or incompletely observed path, including the PRIV-INSPECTION-01 §2.2 closed set and the SEARCH-01 stderr paths once quoted | — |
| 18 | Option B B.7 revalidation (new scope approval before any new search) | — | UNCHANGED; applies after any invalidation including the new triggers | — |
| 19 | SEARCH-01 §3.1 U-1 classes / §7.4 result vocabulary (RESOLVED-COVERED / RESOLVED-ABSENT / FOUND-MATERIAL / U1-REMAINS) | — | UNCHANGED vocabulary; the clauses add the result **ACCEPTED-RESIDUAL (J2-A2-x)** recorded alongside U1-REMAINS, never replacing it | all three |
| 20 | U1-RESOLUTION-01 §6 item 3 (U1-pending is attestation-time) and item 4 (U1-unexplored cannot be closed by claiming a default) | — | UNCHANGED; J2-A2-REM does **not** claim a default; J2-A2-PEND defines the attestation-time method | — |
| 21 | A1 (BASELINE-GOV-01 A1-F) clause (a) UNCLASSIFIED rule; clause (b) H2 attestation; D2b ACCEPTANCE; Rule B-1 | — | UNCHANGED; the H2 attestation must independently disclose the same unrecorded-activity gaps | — |
| 22 | A2 (BASELINE-GOV-01 P-A) provenance policy; M-1; I-4 / I-5 | — | UNCHANGED; carried operationally in §7 | — |

### 2.1 Explicit weakening statement

If adopted as worded, J2-A2-PID, J2-A2-REM (REM-ii) and J2-A2-PEND together **lower the current U-1 acceptance requirement** from "every current-host unknown resolved by observation" to "every *fact-supported, named* current-host location resolved by compliant observation, plus disclosed residuals Keith explicitly accepts." Nothing in this package should be read as finding that those residuals are empty.

(C1) The same clauses are also exceptions to **four scope-sufficiency provisions**, not only to condition (a): the coverage-justification element (§2 item 1), condition (b) "all U-1 current relevant locations" (item 7), criterion 3 "scope covered the expected locations" (item 12), and — for J2-A2-PEND — the pending element itself (item 4) and, if ROOT-B is selected (§5.6), the re-observation of root-owned covered locations at acceptance time. Each clause's wording (§3.1, §4.3, §5.2) names these provisions. **Presentation rule carried into every attestation under these clauses:** observed facts (RESOLVED-ABSENT / RESOLVED-COVERED, with session identifiers) and accepted uncertainty (ACCEPTED-RESIDUAL, with the clause and Keith's recorded decision) are stated in separate, labelled sections; excluded territory is never described as resolved, covered, absent, or searched.

### 2.2 The risk being accepted — undiscovered current PM2 home or recovery directory

A PM2 daemon or a 01C6A-class `--vault` / `--workdir` directory may currently exist on H at a location that is (i) the home of the process that was PID 1193674 on 2026-09-29, now unidentifiable, or (ii) an operator-chosen path never recorded anywhere, in an area with no indication of existence. If so:

- the attestation would be factually wrong about the territory it does not name;
- the P5 journal component would be declared conditionally inapplicable (P5-JOURNAL-01 §2 "Conditional inapplicability") while an applicable journal (`overlay_commands.json`) might exist;
- a first run under A1-F would proceed on a false first-run premise; discovery later withdraws the premise (A1-F (a)) and invalidates the attestation and any U-2(e) / J2-A2 acceptance (E-J5; B.7), but cannot undo a dispatched run.

Mitigations are disclosure, the invalidation triggers, and the independent H2 attestation. They do not reduce the probability that such a location exists.

---

## §3. Proposed clause J2-A2-PID — disclosed unresolved current-process item (PID 1193674 only)

### 3.1 Exact proposed wording

> **J2-A2-PID — Disclosed unresolved current-process item, PID 1193674 only.** Locked SEARCH-01 (2026-09-29T11:01:02Z–11:01:05Z) recorded a `pgrep -f "God Daemon"` match for PID 1193674 with `ps` rc 1 and `/proc/1193674/environ` inaccessible; no retained record identifies that process or its `PM2_HOME` (SEARCH-01 §14.6 OG-UNIT-DAEMON; §14.7 U1-G3, U1-G4-current). Where a **compliant privileged observation** (§3.2 eligibility) classifies that PID as **PID-GONE** or **PID-REUSED**, Keith may, at attestation acceptance for (H, A) and as a distinct recorded decision, accept a disclosed uncertainty covering **both** (i) the identity of the process that held PID 1193674 on 2026-09-29 and (ii) a PM2 home directory that may currently exist for it at a location not in any approved scope. This acceptance: does not find that the pgrep match was false; does not find any PM2 home absent; does not rely on any observation from a session whose execution compliance is FAIL; does not reclassify any path; is, for this one item only, an exception to Option B condition (a), to condition (b) ("all U-1 current relevant locations"), to the scope-approval coverage-justification element, and to J-2 criterion 3 ("scope covered the expected locations") — the possible home of that process is an expected location that is **not searched** and is recorded as accepted uncertainty, never as covered, absent, or resolved; leaves U1-G3 and U1-G4-current recorded as U1-REMAINS with the additional result ACCEPTED-RESIDUAL (J2-A2-PID); is subject to E-J5, B.7, and the §3.5 triggers. PID-REUSED is established **only** by a parseable `lstart` strictly later than 2026-09-29T11:01:05Z; a changed `comm` or argument string alone never establishes reuse. **(C2)** SAME-PROCESS is established only by a parseable `lstart` **not later** than 2026-09-29T11:01:05Z **together with** a recorded command identity consistent with the 2026-09-29 `pgrep -f "God Daemon"` match (§3.2 E5 table); a not-later `lstart` with an inconsistent command identity is **UNCLASSIFIABLE** and blocking. If the compliant observation classifies **SAME-PROCESS**, this clause does not apply and §3.3 governs. If the observation yields any other outcome, this clause cannot be invoked.

### 3.2 Eligibility — precise, fail-closed

The exception may be invoked only when **all** of the following are recorded in the evidence of one privileged inspection session executed under a frozen successor plan (§7 B4) whose own preconditions (PRIV-INSPECTION-01 §7 class: P-AUTH … P-NO-COMINGLE, incl. P-HOSTKEY confirmed by Keith) were satisfied and whose execution-stop requirements were enforced (§6 feasibility gates passed and adopted into that plan):

| E# | Requirement | If not met |
|---|---|---|
| E1 | Session state `RUNNING` at the moment the PID class is entered; the filesystem classes completed before it without a stop | not eligible; U1-G3 / U1-G4-current remain U-1 |
| E2 | Bind success recorded **before** `sudo`: `whoami` = `ubuntu` and `id -u` = `1000` (both published in locked SEARCH-01 §14.4 markers `WHOAMI: ubuntu` / `UID: 1000`), **and** `hostname` equal to an expected string whose source is cited in the successor plan's authorization. **(C1) No published retained source for the expected hostname exists:** SEARCH-01's published record omits the hostname marker, and INVENTORY-01's `HOSTNAME` marker (§2.7 script) was captured but not published (INVENTORY-01 §7.3 allowlist; §18 verification 3g). This freeze cites none and invents none. Until Keith supplies the expected string, or a published retained record is cited, **hostname binding is an unsatisfied precondition (P-HOSTBIND)** of any successor plan and E2 cannot be met. Any mismatch is a session stop before `sudo` | not eligible (failed or unverifiable host / process binding is **never** accepted uncertainty) |
| E3 | The PID observation command ran under the adopted per-command wrapper and exited **0** with a complete, parseable output line set (status line present; no cap hit; no truncation marker) | not eligible: TIMEOUT (exit 124 / 137), DENIED (`sudo -n` refusal or EACCES), INVOCATION-FAIL, OTHER-ERROR, UNCLASSIFIABLE, malformed or missing marker → U-1 remains |
| E4 | **Discriminator first (C1):** the read of PID 844871 (`pid`, `comm` only) succeeded and shows a process distinct from 1193674. This read is placed **before** the 1193674 classification command, because PID-GONE / PID-REUSED / UNBOUND stop the session (PRIV-INSPECTION-01 §8 item 6) and no command may follow them | not eligible |
| E5 | Outcome class of the 1193674 classification command is exactly **PID-GONE** or **PID-REUSED** as defined by the deterministic classification table below (C2). Absence is a successful observation, not an error; the wrapper's expected-absence mapping is adopted with the successor plan | any other class (SAME-PROCESS, UNCLASSIFIABLE, UNBOUND, or an E3 failure class) → not eligible |
| E6 | Evidence integrity for that session independently verified (hashes; capture completeness; command-by-command conformance to the frozen plan) **before** any acceptance | not eligible |
| E7 | The session did not also perform U-2(e), P5, C-ACQ, E1, HOST_CLEAN, P7, or reopen (P-NO-COMINGLE) | not eligible |

Denial, timeout, malformed evidence, cap-hit, UNBOUND, unverifiable or failed binding, and UNCLASSIFIABLE therefore never convert into accepted uncertainty. They leave the rows U-1 / E-J6 and the route stopped (§8 outcomes).

**(C2) Deterministic classification table for PID 1193674** — exactly one row applies; the inputs are the wrapper exit class (E3), `/proc/1193674` existence, `ps -o pid=,lstart=,comm= -p 1193674` under `LC_ALL=C TZ=UTC`, and the recorded command identity (`comm`, plus `args` only if the successor plan's frozen command includes it). "Consistent command identity" means the recorded identity would satisfy the 2026-09-29 `pgrep -f "God Daemon"` match; the exact predicate is fixed in the successor plan and is a plan parameter, not a Step 3 choice. `T_END` = 2026-09-29T11:01:05Z.

| Wrapper / E3 | `/proc/1193674` | `ps` output | `lstart` vs `T_END` | command identity | Class | Session effect (PRIV-INSPECTION-01 §8) |
|---|---|---|---|---|---|---|
| failure class (TIMEOUT / DENIED / INVOCATION-FAIL / OTHER-ERROR / cap-hit / malformed marker) | any | any | any | any | **E3 failure class** | item 7 stop where cap / timeout; not eligible |
| success | ENOENT | empty, rc 1 | — | — | **PID-GONE** | item 6 stop |
| success | exists | `lstart` present, parseable | **later** | any (recorded, not evaluated) | **PID-REUSED** | item 6 stop |
| success | exists | `lstart` present, parseable | **not later** | **consistent** | **SAME-PROCESS** (§3.3) | continue to environ path |
| success | exists | `lstart` present, parseable | **not later** | **inconsistent** | **UNCLASSIFIABLE** — the `lstart` does not exclude the 2026-09-29 process and the identity does not confirm it; ambiguity is preserved as blocking, not resolved either way | stop; not eligible; no environ read |
| success | exists | `lstart` absent or unparseable | — | any | **UNBOUND** (PRIV-INSPECTION-01 §6.2 item 5) | item 6 stop; not eligible; no environ read |
| success | ENOENT vs `ps` disagree (one present, the other absent) | — | — | — | **UNCLASSIFIABLE** | stop; not eligible |

No row maps a `comm` / argument mismatch to PID-REUSED, and no input combination maps to two classes.

### 3.3 SAME-PROCESS branch and its non-atomic limitation

If the PID observation shows `/proc/1193674` present, `lstart` present, parseable, and **not later** than 2026-09-29T11:01:05Z, **and** the recorded command identity is consistent with the 2026-09-29 match (§3.2 E5 table — C2; an inconsistent identity is UNCLASSIFIABLE and stops the session before any environ read), the class is SAME-PROCESS and J2-A2-PID is inapplicable. The successor plan's environ path then applies: read `PM2_HOME` from `/proc/1193674/environ` under `sudo -n` (NUL-separated; `PM2_HOME` value only retained), followed by a post-check of `pid` / `lstart` / `comm`.

Limitation (stated, not removable): identity pre-check, environ read, and post-check are three separate commands. The process may exit and the PID be reused between them. The pre / post `lstart` equality check fails closed on any difference but `lstart` has one-second resolution; a reuse that starts within the same second as the original process's recorded start is not excluded by it.

**(C1) What a matching read establishes.** Matching pre / post reads establish an **observed current fact**: at observation time a process holding PID 1193674 with the recorded `lstart` had the recorded `PM2_HOME` (or none). They do **not** establish factual closure of the *historical* question in U1-G3 / U1-G4-current — that the process observed is the one that matched `pgrep` on 2026-09-29 — because continuity is inferred from PID + `lstart`, not observed, and the one-second window above is not excluded. The attestation must record the result as "observed current; historical continuity inferred (PID + `lstart` ≤ search end); non-atomic limitation disclosed". Closing the historical question on that inference would be **accepted uncertainty**, not fact. **(C2) No such acceptance is available in this freeze.** Reconciling it with every affected coverage requirement shows that, if the inference is wrong, the 2026-09-29 process's PM2 home is an unidentified expected location — the same excluded territory §3.1 names for PID-GONE / PID-REUSED — so an acceptance would have to be an exception to condition (b), the coverage-justification element, and criterion 3 as well as to condition (a). That is an exception beyond the §3.1 proposal. Rather than expand the policy, the candidate variant **PID-S is marked BLOCKED / NOT SELECTABLE** (§3.6). On every SAME-PROCESS outcome the rows therefore remain **U1-REMAINS** with the observed current fact recorded; the Option B route does not reach attestation on a SAME-PROCESS result under this freeze.

Outcomes of SAME-PROCESS (each preserved as its own branch):

| Branch | Observed fact | Treatment |
|---|---|---|
| `PM2_HOME` present in environ and already within the approved scope | current home identified | **U1-REMAINS, observed current fact recorded (C2).** The observed location is covered as a *current* location by compliant observation; the *historical* rows U1-G3 / U1-G4-current are not closed and no exception is available (PID-S BLOCKED / NOT SELECTABLE). Never "RESOLVED (FACT)" for the historical row; never ACCEPTED-RESIDUAL under this freeze |
| Command identity inconsistent with a not-later `lstart` (E5 table) | — | **UNCLASSIFIABLE**; not SAME-PROCESS; environ **not** read; BLOCKING; not eligible for any exception (C2) |
| `PM2_HOME` present and **outside** the approved scope | new relevant location | **U-1 until covered** under a new scope approval naming it **before** any search of it (Option B sequence; B.7). Neither J2-A2-PID nor PID-S covers the location |
| `PM2_HOME` **absent** from environ | the process has no explicit `PM2_HOME`; PM2's default would be the process owner's `$HOME/.pm2`, and the owner is **not read** under the frozen plan (environ `PM2_HOME` value only) | **BLOCKING; unresolved branch; no exception proposed in this freeze.** Identifying the owner would widen process access (a `/proc/<pid>/status` read) and is a plan modification for a future authorization, not a clause here |
| environ denied / timed out / malformed / post-check mismatch | — | U-1 / E-J6; BLOCKING; not eligible for any exception |

### 3.4 Disclosure and what acceptance establishes

The U-2(d)-class disclosure must name J2-A2-PID, state the observation class (PID-GONE or PID-REUSED) and session identifier, state that the identity and PM2 home of the 2026-09-29 process remain unknown, and state that criterion 5 excludes that home from the absence claim. Acceptance establishes only that Keith accepted that disclosed residual for (H, A) at that time. It establishes no absence, no CLEAN, no P5 satisfaction by itself.

### 3.5 Invalidation triggers (in addition to E-J5 and B.7)

- later identification of the 2026-09-29 process, its home, or any 01C6A-class material attributable to it;
- any later observation of a PM2 daemon on H other than `pm2-ubuntu.service` MainPID 844871 (or its documented successor PID after a recorded restart). **(C1) Carve-out for authorized acquisition:** PM2 *client* processes created by an authorized C-ACQ invocation (identified by the capture child's attempt directory and the E2 entry) are authorized activity and are not this trigger; a daemon appearing during that invocation **is** this trigger (ACQUISITION-01 §3.5 / §3.6 AUTO_LAUNCH_SUSPECTED, IDENTITY_CHANGE);
- any later evidence that PID 1193674 was a PM2 daemon owned by an account not in the SEARCH-01 account set.

After invalidation: B.7 — new scope approval before any new search; the acceptance cannot be reinstated.

### 3.6 Variants for Step 3

Two independent sub-items (C1):

**D-PID-GONE** (the process is no longer observable):
- **PID-A** — as worded (PID-GONE and PID-REUSED eligible; REUSED by `lstart` only).
- **PID-B** — narrower: PID-GONE only; PID-REUSED is not eligible.
- **PID-REFUSE** — no exception. If the process is gone, U1-G3 / U1-G4-current remain U-1 and the Option B route cannot reach attestation; Option C / D (U1-RESOLUTION-01 §5) or AMENDMENT-01 Option A's consequence become the live alternatives.

**D-PID-SAME** (the process is observed SAME-PROCESS with `PM2_HOME` inside scope):
- **PID-S** — **BLOCKED / NOT SELECTABLE for this freeze (C2).** As drafted in C1 it was an exception to condition (a) only. Reconciliation (§3.3) shows it would also have to except condition (b), the coverage-justification element, and criterion 3 for a possibly unidentified historical PM2 home — an exception beyond the §3.1 proposal. The policy is not expanded here; the variant is retained in the record only so that Step 3 cannot select it by omission. Recording PID-S at Step 3 is CONTRADICTORY (§8.4).
- **PID-S-REFUSE** — the observed fact is recorded; the rows remain U1-REMAINS; the route cannot reach attestation on a SAME-PROCESS result. This is the only recordable option for D-PID-SAME under this freeze (or UNRESOLVED, with the same effect).

Risk Keith would accept under PID-A / PID-B: §2.2 (i). No SAME-PROCESS risk is offered for acceptance in this freeze (C2).

---

## §4. Proposed clause J2-A2-REM — unrecorded `--vault` / `--workdir` remainder

### 4.1 Current state (FACT)

The remainder is U1-REMAINS (SEARCH-01 §14.7 U1-unexplored; U1-RESOLUTION-01 §2 and §6 item 4; PRIV-INSPECTION-01 §10). Criterion 5 limits the claim and resolves nothing. The tooling supplies no default `--vault` / `--workdir`; the operator path, if any was ever used on H, was not recorded. Keith's testimony ("probably no, but uncertain") is preserved and not converted (Option B (c)).

### 4.2 Treatment REM-i — fact-supported closure (no rule change)

REM-i is available **only** if a new fact-supported finding establishes the complete set of current relevant locations for (H, A): every current account home, every identified PM2 home, the unit / daemon environment, and every named root, each RESOLVED by compliant observation — **and** facts (retained records, deployment configuration, or tooling constraints) establishing that no operator-chosen path outside that set was ever used on H. No such facts are on the record. REM-i is listed because it is the only treatment that does not weaken U-1; it is **not expected to be available** and is not presumed.

### 4.3 Treatment REM-ii — exact proposed wording (EXCEPTION)

> **J2-A2-REM — Unrecorded-path remainder.** An operator-chosen `--vault` / `--workdir` path for (H, A) for which **no** retained record, host observation, process environment, unit or service configuration, shell history available to the search, or filename-class hit indicates either historical choice or current existence is a **disclosed unavailable-record item**, eligible for Keith's attestation-time acceptance as a distinct recorded decision only when all of the following hold: (1) every fact-supported current relevant location — all current account homes; all identified PM2 homes; the `/proc` environment of every current PM2-heuristic process other than the item covered by J2-A2-PID; every path in the approved scope and in the privileged closed set; and every SEARCH-01 stderr path once quoted into an approved plan — is RESOLVED-COVERED or RESOLVED-ABSENT under compliant observation, with no DENIED, TIMEOUT, cap-hit, or incompletely listed result among them; (2) no H1 or UNCLASSIFIED item exists for (H, A); (3) the disclosure statement names this remainder, states that the territory was not enumerable, and states that criterion 5 excludes it from the absence claim. This clause is, for that remainder only, an exception to Option B condition (a), to condition (b) ("all U-1 current relevant locations"), to the scope-approval coverage-justification element, and to J-2 criterion 3 ("scope covered the expected locations"): the remainder is an expected-location category that is **not searched**, is recorded as accepted uncertainty, and is never described as covered, absent, or resolved. Any path for which **any** indication of historical choice or current existence appears, now or later, is U-1 and blocking under E-J6 until covered; this clause never applies to it. U1-unexplored remains recorded U1-REMAINS with the additional result ACCEPTED-RESIDUAL (J2-A2-REM). This clause claims no default location and establishes no absence.

### 4.4 Branches that remain BLOCKING under REM-ii (E-J6 preserved)

| Branch | Treatment |
|---|---|
| Present `.pm2` (or any directory with a PM2 / 01C6A filename-class name) found at a closed-set path | **Observe relevant material inside it** — in the inspection session: names and `stat` only (`dump.pm2`, `module_conf.json`, `pm2.log`, `overlay_commands.json`, `pending_apps.json`, `protected/`); a present directory is **not** RESOLVED-ABSENT and an empty listing is RESOLVED-COVERED only if the listing itself was complete (no cap, no denial). If any material name is present → §7 B5 classification stage under the evidence tiers below |
| New relevant location (a `PM2_HOME`, vault, or workdir path appearing in any environ, config, or listing) | **U-1 until covered**: new scope approval naming it **before** any search of it (Option B sequence; B.7). REM-ii cannot cover it |
| Positive filename-class hit | **Preserve in place** (POLICY-01 §4.3 / §6.2: no deletion, move, rename, rotation, or "clearance"; success of any later stage never requires removal); record the name; **stop that command class** (PRIV-INSPECTION-01 §8 item 8); classification is a **separate Keith authorization** (P5-JOURNAL-01 §3.2 E-J4); UNCLASSIFIED blocks (criterion 4; A1-F (a)); H1 → journal must be produced and cross-checked under J-1 / E-J1; the first-run premise is withdrawn |
| **(C1) Classification evidence — what is adequate** | Names and `stat` are **not presumed sufficient**. Tiers, each a separate Keith authorization naming the item: **Tier 1** — name, `stat` (size, mtime, ctime, owner, mode), directory structure to depth 2, and the item's position relative to known H0 preparation records; adequate only when it alone fixes H0 vs H1 (e.g., the item is a documented E1 / capture / ledger artifact with matching provenance). **Tier 2** — bounded **non-secret structural read**: JSON top-level key names and entry counts, status / enum fields, timestamps, file SHA-256; no values, no command bodies, no `protected/*.value` contents, output under the publication allowlist (INVENTORY-01 §7.3 class) and the frozen capture caps. **Tier 3** — anything requiring value or body contents is **not** classification evidence under these clauses; the item stays UNCLASSIFIED and blocks. If Tier 1–2 leave the item ambiguous → UNCLASSIFIED → blocking. Tier 2 reads are a plan modification requiring their own frozen command class; this freeze authorizes none |
| SEARCH-01 stderr paths (snapd cache / cookie / void; apt lists; update-notifier; any other) | **Not in scope until quoted**: the exact path strings must be read from the locked evidence package `C:\Users\knlee\aisb-k4-evidence\PM2-RECOVERY-P5-J2-SEARCH-01\run-1-20260929-185706` and written into the successor plan's authorization **before** any session is granted (PRIV-INSPECTION-01 §2.2). Unquoted → stays U-1; a session cannot add them |
| Denied, timed out, cap-hit, truncated, or incompletely listed path | **BLOCKING** (E-J6). Not eligible for REM-ii; not accepted uncertainty |
| Find maxdepth 4 under `/root` reaching only three levels inside `/root/.pm2` | depth is a plan parameter; a deeper tree is **incompletely listed** → BLOCKING unless the plan's depth is widened by a recorded plan modification before the session |

### 4.5 Invalidation triggers (in addition to E-J5 and B.7)

- any later indication (record, testimony, log, listing, environ) of an operator-chosen `--vault` / `--workdir` path on H;
- discovery of any current account, PM2 home, or named root not in the fact-supported set.

### 4.6 Variants for Step 3

- **REM-i** — selectable only together with the supporting facts; absent facts, it is REQUIRES_INPUT, not adoption.
- **REM-ii** — as worded.
- **REM-REFUSE** — U1-unexplored remains U-1; the Option B route cannot reach attestation; alternatives as in §3.6.

Risk Keith would accept under REM-ii: §2.2 (ii).

---

## §5. Proposed clause J2-A2-PEND — pending-operation and post-search-activity evidence

### 5.1 Why this is not "no threshold change"

The adopted U-1 element reads "any pending operation that could produce material before attestation acceptance" (Option B B.1; P5-JOURNAL-01 §2 gate), and SCOPE-01 GAP-8 says it is "asserted by the control plane at approval / attestation time" without a method. An assertion grounded in observation can only say *no pending operation was observed by the defined sources at time T*. Operations that are unobservable to those sources — `at` / `cron` jobs under inaccessible spools, an operator shell with a pending command, a process in an inaccessible area, intent not yet started — remain possible. Defining the method therefore **fixes an observational standard where the adopted text is unbounded**; accepting the unobservable residual is an acceptance exception and is labelled as such. It is not asserted here that this is a mere clarification.

**(C1) Additional threshold changes stated explicitly:**
1. **Root-owned covered locations.** The acceptance-time observation is unprivileged unless a separate `sudo` grant is authorized for it. Unprivileged access **cannot be presumed sufficient** for root-owned covered locations (the PRIV-INSPECTION-01 §2.2 closed set and any quoted path). Under **ROOT-B** (§5.6) those locations are **not re-observed** at acceptance time; the pending residual then also covers operations that would leave traces only there. That is a second, explicit threshold reduction beyond the one above. Under **ROOT-A** a separately authorized privileged acceptance-time read of those locations is required; nothing here grants it.
2. **No maximum age for the compliant search.** Neither adopted J-2 nor Option B imposes an age on the search itself; this freeze adds none. The search's continued validity rests on criterion 6 / E-J5 over the interval to acceptance (§5.3), not on a freshness judgment. The AGE options (§5.6) bound only the acceptance-time observation. Any proposal to add an age for the search would be a further change and is **not** made here.
3. Classification evidence tiers (§4.4) and the authorized-acquisition carve-out (§3.5, §5.5) are evidence-method and trigger-scope definitions within the proposed clauses; they change no adopted threshold.
4. **(C2) Evidence classes replace the C1 mtime rule.** C1's (iii) treated every file with an mtime inside the interval as an in-progress operation. That rule is removed as over-inclusive (it would have classed the §7.3 preparation writes as pending work) and under-protective (it implied that an artifact classified H0 contains no pending operation). §5.2 now separates (A) evidence of activity requiring criterion-6 assessment, (B) evidence of an actual pending operation, and (C) explicitly classified preparation artifacts, and requires **adequate non-secret status evidence** for any artifact whose format can encode a queued or deferred operation. This is **not a further weakening**: interval modifications remain recorded and assessed under criterion 6; H0 classification alone no longer satisfies the pending element; where status evidence is insufficient the element remains **BLOCKING** rather than becoming an accepted residual. The accepted residual under J2-A2-PEND is unchanged in kind — operations unobservable to the defined sources at the observer's privilege. No artifact deletion, move, or alteration is required or permitted for any outcome.

### 5.2 Exact proposed wording — pending operations

> **J2-A2-PEND(a) — Pending operations.** At attestation acceptance for (H, A), the control plane records an **acceptance-time observation** whose age at the moment of acceptance does not exceed the adopted maximum (§5.6), performed within the approved scope under the authorization that authorizes the acceptance step. **(C2) The observation distinguishes three evidence classes; none is inferred from another.**
>
> **(B) Evidence of an actual pending operation** — the element is unsatisfied while any of these is present: (i) a `systemctl list-jobs` entry, or a `systemctl list-timers` entry whose unit refers to PM2 or the 01C6A operator bundle; (ii) a process-table match (ACQUISITION-01 §3.3 criteria): a PM2 CLI child, `pm2 save` / `update` / `resurrect` / `startup`, or a 01C6A-class operator-bundle process; (iii) at every covered location **readable by the observer's privilege** (ROOT-A / ROOT-B, §5.6), a lock or transient name (`.run.lock`, other lock names, `*.tmp`, `*.partial`, `*.part`) **with a live holder process** identified by non-secret means readable at that privilege, or a queued-operation entry in a readable user spool (`atq`, `crontab -l` for the observer) referring to PM2 or the operator bundle; (iv) a **queue-capable artifact whose status evidence shows queued or deferred work** (below). If (B) is present, acceptance waits until the job / process has **ended** or the queued entry is shown complete by status evidence, and the affected locations are re-observed under the same authorization; artifacts left behind are preserved and classified; if the operation produced activity that could yield applicable material, E-J5 applies.
>
> **(A) Evidence of activity requiring criterion-6 assessment** — not itself a pending operation: any file or directory at a covered readable location whose mtime or ctime falls inside the interval from the relevant compliant search to the observation; a changed `stat` of `/home/ubuntu/.pm2/dump.pm2` or `pm2.log`; a lock or transient name **without** a live holder. Each (A) item is recorded under §5.3 / criterion 6 and **attributed** by non-secret evidence: attribution to an enumerated (C) preparation write, to the unchanged daemon's own lifecycle (MainPID 844871 and `lstart` unchanged — corroborating for `pm2.log` growth only), or to another recorded known activity → recorded, not invalidating unless it could have produced applicable material; a changed `dump.pm2` is treated as a `pm2 save` / `update`-class event and invalidates (§5.5; E-J5); an (A) item that **cannot be attributed** is unresolved activity at a covered location and leaves the element **BLOCKING** — it is never converted into the accepted residual. A filename-class name among (A) items is additionally a §7 B5 hit.
>
> **(C) Explicitly classified preparation artifacts** — the §7.3 host-writing prerequisites (E1 vault registry entry, E2 host-ledger structure, the transferred capture child and its private directory, `.run.lock` when no C-ACQ is live) and persistent classified material (`overlay_commands.json`, `pending_apps.json`, `protected/*.value`, a dump consumed on daemon start). Each is **enumerated in the attestation scope with its provenance** (A1-F (a) H0 preparation record; criterion 4 classification under §4.4 tiers); its interval mtime is expected and is neither unattributed (A) activity nor a (B) indicator. **H0 classification alone does not establish that an artifact contains no pending operation.** For every artifact whose format can encode a queued or deferred operation (`pending_apps.json`, `overlay_commands.json`, a PM2 dump, the E2 ledger's open-attempt state, any 01C6A queue file), the attestation must additionally cite **adequate non-secret status evidence** — §4.4 Tier 2 class: status / enum fields, entry counts, completion timestamps, or an empty-queue structure, under its own separate authorization and the frozen capture caps; no values, bodies, or `protected/*.value` contents. Where that evidence is unavailable, unauthorized, ambiguous, or shows queued work, the pending element is **BLOCKING** for that artifact (queued work → (B)(iv)). All (C) artifacts are **preserved in place**; nothing is removed, moved, rotated, or altered; no outcome of this clause requires or permits deletion.
>
> Absence of (B) and attribution of every (A) item is **observed absence at that time**, not permanent closure and not proof that no pending operation exists. Keith's acceptance of the attestation records the pending residual — operations not observable by the (B) sources at the observer's privilege — as a disclosed, accepted residual. Unattributed activity and insufficient status evidence are **not** part of that residual. U1-pending remains recorded U1-REMAINS (attestation-time) with the additional result ACCEPTED-RESIDUAL (J2-A2-PEND).

### 5.3 Exact proposed wording — post-search activity (criterion 6)

> **J2-A2-PEND(b) — Post-search activity.** The attestation records, per J-2 criterion 6, every known operator or automated activity on (H, A) in the interval from the end of the **relevant compliant search** to acceptance. The relevant compliant search is the union of (1) locked SEARCH-01 (`SEARCH-01-END 2026-09-29T11:01:05Z`) and (2) the compliant privileged inspection session relied on for the closed-set rows; the interval opens at the earlier end time and the attestation names both. Sources: the E2 host ledger once it exists (known activity only — BASELINE-GOV-01 Rule D-2; E2 proves known, not exclusive, activity), the A1-F (b) H2 attestation inputs, the acceptance-time observation (daemon MainPID 844871 and its `lstart` unchanged; no new PM2-heuristic process; `/home/ubuntu/.pm2` dump / log metadata unchanged), and `last` / `journalctl --since` login and service-restart records where readable without privilege. Any activity that could have produced applicable material invalidates (criterion 6; E-J5); revalidation requires a new scope approval before any new search (B.7). **(C2)** Every §5.2 class (A) item and every enumerated class (C) preparation write inside the interval is an input to this record: the §7.3 preparation writes are **known activity**, recorded with their provenance and judged under criterion 6 as H0 preparation that produces no applicable material; an unattributed (A) item is recorded and leaves the pending element BLOCKING (§5.2) — it is not resolved by this record. Activity not visible to any source remains a disclosed residual; this clause does not claim that no such activity occurred and does not demand permanent closure of future activity.

### 5.4 Limitations (stated)

- Observation (i)–(iv) is bounded by the observer's privilege (ROOT-A / ROOT-B); inaccessible spools and directories, and under ROOT-B every root-owned covered location, are not covered. Known inaccessible paths remain E-J6 regardless of this clause.
- `last` / `journalctl` may be rotated, unreadable, or absent; they are corroborating, not sufficient.
- Freshness (C1): an acceptance-time observation older than the adopted AGE is void and must be renewed under its own authorization. The compliant privileged session has **no** age under this clause (§5.1 item 2); its result stands or falls on the criterion 6 / E-J5 activity record over the interval from its end to acceptance (§5.3). **No discretionary freshness judgment exists under J-2**; D2b ACCEPTANCE is the threshold for the A1-F (b) H2 *host-history* attestation only and is **not** authority for any J-2 judgment.
- The clause supplies a method; it does not make the pending element FACT.
- (C2) Status evidence for queue-capable artifacts is a Tier 2 read requiring its own frozen command class and separate authorization (§4.4); this freeze authorizes none. Until it exists, any such artifact present at a covered location leaves the pending element BLOCKING; this is not an accepted residual and not a Step 3 choice.
- (C2) Observation interval: it opens at the earlier of the relevant compliant search's end times (§5.3) and closes at the acceptance-time observation; the §7.3 preparation writes fall inside it by design and are handled as class (C), not as (B). An acceptance-time observation that predates a §7.3 host write is void for that write's location and must be renewed (§7.3 scheduling rule).

### 5.5 Invalidation triggers (in addition to E-J5 and B.7)

- any observed `pm2 save` / `update` / `resurrect` / `startup`, deploy, restart, or 01C6A-class operator-bundle process on (H, A) after the acceptance-time observation and before the C-ACQ P6 reads, **and** any PM2 client process **other than** those created by the authorized C-ACQ invocation itself (C1 carve-out: the capture child's `pm2 jlist` reads, identified by attempt directory and E2 entry, are authorized activity recorded under criterion 6, not a trigger; AUTO_LAUNCH_SUSPECTED / IDENTITY_CHANGE / DAEMON_DISAPPEARED during that invocation remain triggers);
- daemon MainPID or `lstart` change (also an S2 expiry event — POLICY-01 §5.4).

### 5.6 Maximum-age policy — reviewable choices (no default; an open value authorizes nothing)

| Option | Maximum age of the acceptance-time observation at acceptance | Consequence |
|---|---|---|
| **AGE-A** | same authorized window; ≤ 2 h; acceptance recorded before the STAGING lease is released | tightest; acceptance and observation co-scheduled; two STAGING leases if the privileged session was earlier |
| **AGE-B** | ≤ 24 h | one lease may cover observation and acceptance across a day; wider residual |
| **AGE-C** | no fixed age, but the observation is void on any known E2 / ledger activity, and must be renewed before C-ACQ ACQ-1 | weakest; relies on Rule D-2 known activity only |
| **AGE-UNRESOLVED** | — | J2-A2-PEND cannot be applied; the pending element remains BLOCKING; **no acceptance may rely on an unselected value** |

If J2-A2-PEND is adopted without an AGE option, its status is REQUIRES_CLARIFICATION, not adopted.

**(C1) Root-owned covered locations at acceptance time — reviewable choices (no default):**

| Option | Acceptance-time observation of root-owned covered locations | Consequence |
|---|---|---|
| **ROOT-A** | performed under a **separately authorized** `sudo -n` read-only grant for the acceptance-time observation (its own P-PRIV-GRANT, P-RO, STAGING lease; same safeguards class as the inspection plan) | element (iii) covers the closed set; requires a further privileged authorization and a verified mechanism (§6) |
| **ROOT-B** | **not re-observed**; the compliant privileged session's result for those locations stands, and the pending residual explicitly includes operations leaving traces only there | explicit additional threshold reduction (§5.1 item 1); no further privilege |
| **ROOT-UNRESOLVED** | — | J2-A2-PEND cannot be applied to any attestation whose covered set includes root-owned locations; **no acceptance may rely on an unselected value** |

### 5.7 Variants for Step 3

- **PEND-ADOPT + AGE-{A,B,C} + ROOT-{A,B}** — clauses (a) and (b) as worded with the chosen age and root-path option.
- **PEND-REFUSE** — the element remains BLOCKING with no method; the Option B route cannot reach attestation (the control plane cannot assert GAP-8 on nothing).

Risk Keith would accept: an unobservable pending operation or unknown activity in the interval produces applicable material that the attestation does not name.

---

## §6. Inspection-control mechanism — unverified candidate (no implementation, no tests, no authority)

### 6.1 Status

**UNVERIFIED CANDIDATE.** Neither an incremental / gated stdin writer nor remote `cap` / `timeout` wrappers is a verified solution. INVENTORY-01 §4.3 verified a whole-script writer with a local byte / line budget and Stopwatch deadline; §0.11 / §9.9 record that killing `ssh.exe` guarantees nothing remotely. PRIV-INSPECTION-01 §8 item 7 requires that a cap or timeout **stop the session**; the current carrier cannot prevent already-delivered later commands from running.

### 6.2 Candidate selected for future verification: local gated dispatcher + remote per-command timeout

Design to be verified later (not built here):

- A dispatcher sends command *n* only after (a) a complete end marker for command *n−1* has been observed on **both** stdout and stderr paths (either `2>&1` per command with the marker last, or a separate stderr marker), (b) reserved bytes / lines leave headroom above a declared per-command worst-case, (c) elapsed < deadline − remote escalation (15 s) − grace. Each command runs `</dev/null`.
- Every remote command is wrapped `timeout --signal=TERM --kill-after=1s 14 …` (a proposed 14 / 15 s reading of the frozen 15 s ceiling; adoption belongs to the successor plan).
- Local cap / deadline handling unchanged; it now affects at most one in-flight command.

Alternatives not selected (recorded): remote-only wrappers with a remote aggregate budget (`cap` awk function; INVENTORY-01 §2.0) — guarantee would rest on remote code that cannot be exercised offline against this host's tool versions; a remote whole-script `timeout` — cannot distinguish cap from deadline and leaves descendants.

### 6.3 Future verification must cover (feasibility gates; each UNRESOLVED now)

| FG | Question | Pass condition (to be fixed in the implementation task) |
|---|---|---|
| FG-1 stdout / stderr completion | Can the dispatcher know a command has fully completed on both streams before dispatching the next? | marker observed on both streams (or merged stream with marker last) in 100 % of fixture runs incl. a command emitting 10 000 stderr lines |
| FG-2 marker ambiguity | Can command output forge or split a marker? | per-session nonce + sequence; marker accepted only as a complete line; fixture with marker-like file names and partial-line output never yields a false completion |
| FG-3 atomic stop-vs-dispatch | Can a cap / deadline event race with a dispatch already in flight? | single-threaded state machine; "dispatched" = bytes handed to stdin, counted even if the stop fires the same tick; fixture asserts `withheldFromIndex` is exact and no byte of command *n+1* is in the fixture's received-stdin log after a stop |
| FG-4 expected-absence outcomes | Are ENOENT / rc 1 / empty output distinguishable from denial, timeout, and invocation failure? | rc + stderr classification table; fixture cases for `stat` ENOENT, EACCES, `sudo -n` refusal, `timeout` 124 / 137, missing binary, each mapped to exactly one class |
| FG-5 delivery delays | Does SSH latency or a late marker break the cutoff arithmetic? | injected 0–5 s delays; **within that injected range** the in-flight command's remote 124 / 137 precedes the local deadline; late markers after a stop are recorded, never acted on. The fixture bounds nothing outside its injected range (C1) |
| FG-6 privileged child termination | Does TERM / KILL to `timeout` → `sudo` → root child terminate the root child and its descendants? | Linux container fixture, non-root uid 1000 with passwordless `sudo -n`: `timeout … sudo -n <hang>` and `… sudo -n sh -c '<grandchild>; <hang>'`; record exit codes, timing, and which processes survive. **(C2) Pass requires that no root child or descendant survives its wrapper in any case; observed survival is a demonstrated violation of the adopted stop requirement (PRIV-INSPECTION-01 §8 items 6–7) and FAILS this gate.** Recording or reporting survivors is not a passing mitigation |
| FG-7 budget boundary | Byte-exact aggregate limit with marker headroom | re-run of INVENTORY-01 Test 7 class on the dispatcher |
| FG-8 `</dev/null` isolation | Can a child consume the next script line? | fixture child reading stdin receives EOF; next command still dispatched intact |

**(C1) Property classes — kept separate; none is unconditional:**

| Class | What passing fixtures would establish | What they cannot establish |
|---|---|---|
| **L — local dispatch** | after a cap, deadline, missing marker, or non-success status, **no further bytes are handed to the local `ssh.exe` stdin** (FG-3); the aggregate stdout / stderr budget is byte-exact and local (FG-7) | nothing about bytes already handed over |
| **D — remote delivery** | within the fixture's injected delay range, a dispatched command's remote escalation precedes the local deadline (FG-5) | bytes already handed to `ssh.exe` may be in flight or buffered remotely and **cannot be recalled**; real SSH latency is not bounded by the fixture; a command delivered just before a stop may begin executing after the local stop |
| **T — termination** | on the fixture's `sudo` / `timeout` builds, TERM / KILL to `timeout` → `sudo` → root child produced the recorded exit codes and survivor table (FG-6) | `sudo` signal relay and descendant exit on **H's** builds; exit 124 / 137 never prove descendants exited; SIGHUP on channel loss is not guaranteed |
| **A — target-host applicability** | — | fixture results do **not** transfer to H's kernel, `sudo`, `timeout`, `awk`, or `ps` versions; this remains an unverified assumption at every host use and must be disclosed as such in any successor-plan authorization |

**(C2) Mechanism-readiness rule.** The adopted stop requirement is PRIV-INSPECTION-01 §8 items 6–7: a PID stop class, a capture cap, or a timeout **stops the session**, and no command runs after it. Any fixture result demonstrating a violation of that requirement — a byte of a withheld command reaching the received-stdin log (FG-3), a dispatched command's remote escalation not preceding the local deadline inside the injected range (FG-5), or any root child or descendant surviving its wrapper (FG-6) — **FAILS mechanism readiness**. Reporting, tabulating, or disclosing survivors or late execution is not a passing mitigation. Fixture passes establish class **L** only. Compliance of classes **D** and **T** with the stop requirement is **UNRESOLVED** by any fixture (bytes already handed to `ssh.exe` cannot be recalled; H's `sudo` / `timeout` behaviour is not exercised) and is therefore **BLOCKED for host use** until **either** a separately reviewed design is shown to satisfy the requirement as adopted **or** a separately authorized rule change to PRIV-INSPECTION-01's stop requirement explicitly addresses it. This freeze proposes neither and grants neither.

**Failure consequences (to be adopted with the successor plan; stated here so they are not invented later):**

- **TERMINATION-UNCONFIRMED** — the in-flight command returned no wrapper exit code or marker after escalation, or the channel closed first: the session outcome is STOPPED / TERMINATION-UNCONFIRMED; the in-flight row and every row after it stay U-1; the operator does **not** reconnect to kill or inspect; the command text, dispatch time, and PID (if captured) are recorded as a **known host activity item** under criterion 6 and in the H2 attestation inputs; Keith decides any follow-up under a new authorization. **(C2) Session-wide rule preserved:** if any command is found to have run after the stop (a withheld command observed executing remotely, or a later command dependent on the in-flight one), execution compliance is **FAIL** for the whole session and **no row closure is accepted from it** (PRIV-INSPECTION-01 Step 4 disposition class: post-stop output is not a compliant-session result).
- **SURVIVING CHILD** — FG-6 shows a root child or grandchild outliving its wrapper: **readiness FAIL** (rule above). Host evidence of a survivor (a later session's bind or process observation, or E2 / H2 inputs): **(C2)** the survivor's behaviour is **unverified**; the §5 command set is read-only by design but the survivor is not shown to be confined to it, so no write-risk claim is made. It is recorded as unconfirmed host activity under criterion 6; the session that produced it has execution compliance FAIL (session-wide rule); any later session's bind / process observations must account for it; it is never silently killed; follow-up is Keith's decision under a new authorization.
- **LATE OUTPUT** — bytes arriving after a local stop are captured **only within the remaining frozen aggregate budget** (PRIV-INSPECTION-01 §6.3: 65536 B / 2000 L for stdout + stderr); bytes beyond that budget are not retained — only their count is recorded. **(C2)** No capture beyond the aggregate budget is promised. Late output is never classified, never acted on, and never a compliant-session result; the affected row remains U-1; the session-wide rule above applies if it evidences post-stop execution.

Residual limitations that **no** fixture result removes: one in-flight command may run up to the escalation time after a local stop; classes D, T, and A above remain assumptions on H; D / T compliance with the adopted stop requirement remains BLOCKED for host use (rule above).

### 6.4 What is required before any host use

Passing FG-1…FG-8 on fixtures (Windows synthetic suite + Linux container) is a **necessary, not sufficient, precondition** for the successor plan's P-SUPERVISOR; it establishes class L and bounded evidence for D and T only; class A is never established before host use. **(C2)** Host use additionally remains **BLOCKED** until D / T compliance with the adopted stop requirement is resolved by a separately reviewed design or a separately authorized rule change (§6.3 readiness rule); any fixture-demonstrated violation is FAIL regardless of other passes. The successor plan must additionally record the mechanism's hashes, the adopted outcome-class table (FG-4), the 14 / 15 s reading, the failure consequences above, and the expected hostname source (§3.2 E2, P-HOSTBIND).

---

## §7. Dependency route (corrected) and prerequisite-write check

### 7.1 Route

| # | Work | Authority / current status | Output |
|---|---|---|---|
| B1 | **This task**: Step 3 Keith decision on §8 matrix; Step 4 independent verification / lock | Steps 3–4 NOT AUTHORIZED | adopted / refused clauses |
| B2 | Quote the exact SEARCH-01 stderr paths from the locked evidence package into a successor-plan authorization (local read only) | PRIV-INSPECTION-01 §2.2 condition; no registration here | quoted closed-set extension |
| B3 | Inspection-control mechanism task (§6; §10 scope) — registration, fixture verification, lock | **not registered; no authority** | verified dispatcher or recorded failure |
| B4 | Successor privileged-inspection plan task (PRIV-INSPECTION-01's four steps are consumed; a second session has no slot): frozen §§0–13 class + adopted modifications (filesystem-before-PID order, `ls -1A`, wrapper, FG-4 outcome classes, bind predicates incl. the expected hostname source (**P-HOSTBIND — currently unsatisfied; no published source**), discriminator-before-classification order, quoted paths, SAME-PROCESS environ rule, §3.2 eligibility evidence fields, §6 failure consequences); P-HOSTKEY confirmation; P-AUTH naming the plan commit; script hash + static conformance review before connection; independent evidence review | **not registered; no authority** | compliant observation or stop |
| B5 | Classification stage (only if any filename-class hit): separate Keith authorization per item and per tier (E-J4); Tier 1 names / `stat` / structure, Tier 2 bounded non-secret structural read under its own frozen command class (§4.4); **preserve in place — no removal is ever a success condition**; H0 / H1 per item; UNCLASSIFIED blocks; H1 → E-J1 path | P5-JOURNAL-01 §3.2; POLICY-01 §4.3 / §6.2; A1-F (a) | classified items or stop |
| B6 | Acceptance-time observation (§5.2 evidence classes (B) / (A) / (C) — C2) within the adopted AGE, at the privilege fixed by the adopted ROOT option (ROOT-A requires its own privileged grant and the §6 mechanism) | J2-A2-PEND if adopted | pending / activity evidence |
| B7 | Attestation package: U-1 disposition table (RESOLVED / ACCEPTED-RESIDUAL / U1-REMAINS) with **observed facts and accepted uncertainty in separate labelled sections** (§2.1 presentation rule); U-2(d)-class disclosure incl. §3.4 / §4.3(3) / §5 residuals; criteria 1–6 with criterion 3 bounded as in §2 item 12; Keith's attestation acceptance carrying U-2(e) and each J2-A2 acceptance as distinct recorded decisions → E-J5 conditional inapplicability of the journal component. H2 attestation (A1-F (b)) drafted from the same inputs; D2b ACCEPTANCE governs the H2 attestation **only** | Option B B.1(4), B.5; P5-JOURNAL-01 §2; BASELINE-GOV-01 §2.2 (b) | valid attestation or stop |
| B8 | Operational prerequisites (A2 adopted; carried, not re-decided): E1 vault registry entry (ACQUISITION-01 §2.1); E2 host-ledger structure (POLICY-01 §4.4); C-TOOL-TRANSFER of the CAPTURE-01 child; host tool / target-tuple confirmation (ACQUISITION-01 §15.6); I-4 (both apps REQUIRED until an explicit I-1 amendment) and I-5 (PV-1 vs fresh PV-3) resolved or explicitly handled; per-key provenance approvals → **C-REF: B(H)** under P-A / AM-1…5 / M-1 with per-key adoption records (Rule C-5) and the external provenance / authorization record (BASELINE-GOV-01 §5.1) | BASELINE-GOV-01 §14.7 / §15.5; ACQUISITION-01 §4.1 | E1, E2, child on host, **B(H) constructed** |
| B9 | **C-ACQ**: P4 externally supplied (E2 review; `.run.lock`; board exclusivity); P5 process-table at ACQ-1e / ACQ-3d with the B7 journal component; Keith accepts the **§3.6 residual auto-launch race for this invocation** (distinct from P7 — ACQUISITION-01 §4.5); explicit invocation / attempt scope sized for the two P6 reads (POLICY-01 §5.3 step 5) under Q3-A NO_RETRY; STAGING owned | ACQUISITION-01 §4.1 C-ACQ, §4.2–§4.3 | raw dual-field observations + meta + E2 entries |
| B10 | **C-VERIFY**: verifier live-use authorization lifted; compare B9 against **B(H) (B8, already constructed)** → A1-F (c) evidence: MATCH required; MISMATCH → separately authorized corrective decision and a new C-ACQ; DIVERGENT = P6 FAIL; INVALID_INPUT / INTERNAL_ERROR cannot satisfy | ACQUISITION-01 §4.1 C-VERIFY; A1-F (c); POLICY-01 §5.3 | comparison report |
| B11 | **C-HOST / S2 CLEAN**: P4; P5 at T1 and before each P6 read; P6 from B10; **P7 daemon-buffer acceptance** (host-and-time, separate decision); A1-F (a)(b)(d)(e)(f); record bounded to (H, A, key set, [T0, T1], daemon PID) | POLICY-01 §2 S2, §3.1, §5.3–§5.4, §6.1; ACQUISITION-01 §4.1 C-HOST | CLEAN record with expiry |
| B12 | **S3 / P8**: Keith reopen authorization; distinct control-plane `startCondition` write; C1 acceptance-contract amendment if required | POLICY-01 §2 S3, §3.1 P8; BASELINE-GOV-01 §14.7 | EXEC-01C6A reopened, not admitted |
| B13 | **S4**: separate canary authorization and lane admission | POLICY-01 §2 S4 | — |

Ordering constraints preserved: B(H) (B8) **before** C-VERIFY (B10); C-VERIFY **before** C-HOST (B11); C-ACQ race acceptance (B9) ≠ P7 (B11); P8 and canary separate.

### 7.2 Validity windows

S2 CLEAN expires at T1, any E5 event, daemon PID change, `pm2 save` / `update` / `resurrect`, deploy of A, or revocation (POLICY-01 §5.4). P5 expires immediately after the P6 read (§5.2). The J-2 attestation and every J2-A2 acceptance are invalidated by any activity that could produce applicable material (E-J5; criterion 6; §3.5 / §4.5 / §5.5). B6–B11 must therefore be scheduled inside one quiet window; any PM2 activity between them restarts from the affected gate.

### 7.3 Prerequisite writes / transfers — do they invalidate the attestation?

| Prerequisite | Host write? | Could it "produce applicable material" (criterion 6 / E-J5)? | Scheduling |
|---|---|---|---|
| E1 vault registry entry | depends on where the registry lives (ACQUISITION-01 §2.1 does not fix a host path); if it **creates a vault directory on H**, that is a new relevant location | creates a *location*, not recovery material; it is an H0 preparation record (A1-F (a) carve-out) | **before B6 / B7** if host-side, enumerated in the attestation's scope and the H2 attestation; if performed after acceptance → treated as new activity: record under criterion 6, Keith re-judges; if it creates a location → **invalidation + B.7 revalidation** |
| E2 host-ledger structure (POLICY-01 §4.4) | yes if on H | no (ledger is a record, H0 class) | **before B6 / B7**, recorded as known activity (A1-F (b)(i)); after acceptance → criterion 6 record; not invalidating by itself |
| C-TOOL-TRANSFER of the capture child | yes (files under a private, off-repo, mode-0700 directory — ACQUISITION-01 §5.1) | no (tooling; attempt directories hold acquisition captures = H0) | **before B6 / B7**; recorded as known activity; the private directory is named in the attestation scope so a later listing does not read as an unknown location |
| B(H) construction (C-REF) | no host write required (reference document under A2 policy) | no | any time before B10 |
| C-ACQ invocation (B9) | yes: one `pm2 jlist` client per read; captures written to the private attempt directory | the read itself produces no recovery material; **an auto-launched daemon** (ACQUISITION-01 §3.6 residual race) would create or reuse a PM2 home for the invoking user — a new or changed relevant location → **invalidates** the attestation and all J2-A2 acceptances (E-J5; §3.5 trigger 2). The invocation's own `pm2 jlist` client processes are authorized activity under the §3.5 / §5.5 carve-out and are recorded under criterion 6, not treated as triggers | necessarily **after** B7; the attestation must remain valid through ACQ-3d; AUTO_LAUNCH_SUSPECTED → stop, E-J5 invalidation, separate Keith decision; this risk is disclosed with the C-ACQ race acceptance |
| Verifier live-use / comparison (B10) | no host write | no | after B9 |

Rule derived (proposed as scheduling guidance, not as new policy): **all host-writing prerequisites occur before the acceptance-time observation (B6) and are enumerated in B7; anything host-writing after B7 is recorded under criterion 6 and, if it creates or changes a relevant location, invalidates under E-J5 with B.7 revalidation.** **(C2)** Under §5.2 these enumerated writes are evidence class (C): their interval mtimes are expected and are neither unattributed activity nor pending-operation indicators; a B6 observation that predates any of them is void for that location and is renewed; queue-capable artifacts among them (e.g. the E2 ledger's open-attempt state) still require status evidence.

---

## §8. Decision matrix for Step 3 (nothing selected)

### 8.1 Independent items

| Item | Options | Notes |
|---|---|---|
| D-PID-GONE | PID-A / PID-B / PID-REFUSE | §3.6 (C1: REUSED by `lstart` only) |
| D-PID-SAME | PID-S (**BLOCKED / NOT SELECTABLE** — C2) / PID-S-REFUSE | §3.6; the only recordable option is PID-S-REFUSE (or UNRESOLVED, same effect) |
| D-REM | REM-i (REQUIRES_INPUT absent facts) / REM-ii / REM-REFUSE | §4.6 |
| D-PEND | PEND-ADOPT + {AGE-A, AGE-B, AGE-C} + {ROOT-A, ROOT-B} / PEND-REFUSE | §5.7; PEND-ADOPT without AGE or without ROOT = REQUIRES_CLARIFICATION (C1) |

### 8.2 Completeness rules

- Each item must be recorded as exactly one option or as REQUIRES_INPUT / REQUIRES_CLARIFICATION / UNRESOLVED. Silence is UNRESOLVED, not refusal and not adoption.
- Any adopted clause is adopted **as worded in this freeze** (or in a Keith-directed localized correction recorded before Step 3, by its own correction record); Step 3 does not rewrite wording.
- Adoption of any clause does not satisfy it for (H, A); satisfaction is attestation-time evidence (§7 B7).

### 8.3 Outcomes per combination

| D-PID-GONE | D-PID-SAME | D-REM | D-PEND | Can the Option B route reach attestation acceptance (given compliant B4 evidence and no hits)? | Where it stops otherwise |
|---|---|---|---|---|---|
| A or B | any | REM-ii | ADOPT+AGE+ROOT | **Possibly**, if B4 yields PID-GONE (or REUSED under A) — still requires every closed-set row RESOLVED, every quoted path RESOLVED, no DENIED / TIMEOUT, no H1 / UNCLASSIFIED, §3.2 E1–E7 incl. P-HOSTBIND satisfied, B6 within AGE at the ROOT privilege, Keith's acceptance | — |
| any | PID-S | any | any | **Not available (C2)** — PID-S is BLOCKED / NOT SELECTABLE; recording it is CONTRADICTORY (§8.4) | §3.6 |
| any | PID-S-REFUSE or UNRESOLVED | any | any, **with B4 yielding SAME-PROCESS** | **No** (C2) — the observed current fact is recorded; the continuity inference has no available exception; U1-G3 / U1-G4-current remain U1-REMAINS | U1-G3 / U1-G4-current |
| REFUSE | any | any | any | **No** on any PID outcome: GONE / REUSED have no treatment; SAME-PROCESS has none in this freeze | U1-G3 / U1-G4-current |
| any | any | any | any, **with SAME-PROCESS and `PM2_HOME` outside scope or absent from environ** | **No** — new location U-1 until covered; owner-identification branch has no exception (§3.3 table) | U1-G3 / new location |
| any | any | any | any, **with the 1193674 classification UNCLASSIFIABLE or UNBOUND** (E5 table: identity inconsistent with a not-later `lstart`; `lstart` unreadable; `/proc` vs `ps` disagreement) | **No** (C2) — ambiguity is blocking; no exception | §3.2 E5 |
| any | any | any | ADOPT+AGE+ROOT, **with an unattributed §5.2 class (A) item, or a queue-capable artifact without adequate status evidence** | **No** (C2) — the pending element is BLOCKING for that item; not an accepted residual | §5.2 / §5.4 |
| any | any | any | any, **with §6 D / T stop-requirement compliance unresolved or any fixture-demonstrated violation** | **No** (C2) — host use BLOCKED; no B4 session can be authorized; no B6 ROOT-A observation can be authorized | §6.3 readiness rule |
| any | any | REFUSE | any | only if REM-i facts materialize | U1-unexplored |
| any | any | REM-i | any | only with the supporting facts (none on record) | REQUIRES_INPUT |
| any | any | any | REFUSE, or UNRESOLVED AGE or ROOT | **No** | U1-pending (no method or open value) |
| any | any | any | any, **with any DENIED / TIMEOUT / cap-hit / incompletely listed closed-set or quoted path** | **No** (E-J6) | that path |
| any | any | any | any, **with a filename-class hit** | not until B5 classifies every item H0 under Tier 1–2; H1 → route changes to J-1 / E-J1 | criterion 4 |
| any | any | any | any, **with P-HOSTBIND unsatisfied** | **No** — no successor plan can be frozen with an uncited hostname; E2 cannot be met | §3.2 E2 |

Full refusal (REFUSE / S-REFUSE / REFUSE / REFUSE) is a valid outcome; so is any combination in which every available route to attestation is closed by the C2 rows above: J-2 remains as adopted by Option B; the residual rows remain blocking; the live alternatives are U1-RESOLUTION-01 Option C (host / provider-assisted evidence), Option D (defer J-2 acceptance), or AMENDMENT-01 Option A's consequence (route blocked in practice).

### 8.4 Incompatibilities

- PEND-ADOPT with AGE-UNRESOLVED or ROOT-UNRESOLVED → REQUIRES_CLARIFICATION (not adopted).
- REM-i recorded without facts → REQUIRES_INPUT (not adopted).
- Any adoption expressed as "A1 / A2 amendment" → CONTRADICTORY; A1 / A2 are BASELINE-GOV-01 adopted policies and are not objects of this task.
- Any selection that treats a `comm` / argument change alone as PID-REUSED, or a matching SAME-PROCESS read as factual historical closure → CONTRADICTORY with §3.2 E5 / §3.3 (C1 / C2).
- (C2) Recording **PID-S** as selected → CONTRADICTORY; PID-S is BLOCKED / NOT SELECTABLE in this freeze (§3.6).
- (C2) Any selection that treats an UNCLASSIFIABLE or UNBOUND 1193674 class, an unattributed §5.2 class (A) item, or a queue-capable artifact without status evidence as an accepted residual → CONTRADICTORY (§3.2 E5 table; §5.2).
- (C2) Any successor-plan authorization that treats a §6 fixture with surviving children, post-stop bytes, or unresolved D / T compliance as mechanism-ready → CONTRADICTORY with the §6.3 readiness rule.

### 8.5 Route preconditions outside the matrix (C1)

These are not Step 3 choices; no selection satisfies them: (1) **P-HOSTBIND** — an expected hostname string with a cited source (§3.2 E2); (2) §6 feasibility gates FG-1…FG-8 passed and the failure consequences adopted into the successor plan; (3) quoted SEARCH-01 stderr paths (§4.4); (4) separate authorizations for B3, B4, B5 tiers, B6 ROOT-A, and acceptance; (5) **(C2)** §6 D / T compliance with the adopted stop requirement resolved by a separately reviewed design or a separately authorized rule change — host use BLOCKED until then; (6) **(C2)** a frozen, separately authorized Tier 2 status-evidence command class for any queue-capable artifact present at a covered location. Each is currently unsatisfied.

---

## §9. Disclosed risks Keith would accept (consolidated)

1. **J2-A2-PID:** on 2026-09-29 a process matching the `God Daemon` command-line heuristic held PID 1193674; **whether it was a PM2 daemon, who owned it, and whether it had a PM2 home are unknown** (C1 — it is not asserted that a PM2 daemon existed). If it was one, it may have a PM2 home with an applicable journal at an unsearched location (§2.2 (i)). **(C2)** No SAME-PROCESS acceptance is offered: on a SAME-PROCESS result the rows remain U1-REMAINS and the route stops; the continuity-inference risk is therefore not among the risks Keith would accept under this freeze.
2. **J2-A2-REM (REM-ii):** an unrecorded operator-chosen vault / workdir may exist in an unexamined area (§2.2 (ii)); testimony is "probably no, but uncertain" and is not converted.
3. **J2-A2-PEND:** a pending operation unobservable to the §5.2 class (B) sources at the observer's privilege (under ROOT-B, including anything leaving traces only in root-owned covered locations), or activity in the post-search interval not visible to any named source, produces applicable material the attestation does not name; the longer the interval and AGE, the larger the residual. **(C2)** Unattributed activity at a covered location and queue-capable artifacts without adequate status evidence are **not** within this residual; they block.
4. **Compound:** the residuals above are accepted alongside — not under — the D2b ACCEPTANCE threshold that governs the separate H2 host-history attestation; the first run would rest on disclosed, not closed, history. Discovery later withdraws the first-run premise but cannot undo a dispatched run.
5. **C-ACQ race (separate, later acceptance):** an auto-launched daemon would invalidate the attestation after the fact (§7.3).

None of these risks is reduced by adoption; adoption changes only whether Keith may proceed with them disclosed.

---

## §10. Exact future implementation / verification scope (recorded; **no implementation authority granted**)

**Object:** inspection-control mechanism of §6.2, verified against FG-1…FG-8 (§6.3).

**Registration (future, separate):** a bounded task of its own. Nature to be fixed at that registration by the control plane: IMPLEMENTATION if repository source is produced (then: `AISB_MACHINE_REG_V1` stanza `nature=IMPLEMENTATION`; sidecar candidate; `saturationClass` declared explicitly — no default; one lane); or GOVERNANCE / EVIDENCE tooling following the INVENTORY-01 precedent if kept off-repo under `C:\Users\knlee\aisb-preflight\<task>\` with sources and fixtures hashed into its stage-start. This freeze recommends neither; it records both.

**Proposed primary write scope (if in-repo):** `ops/pm2-recovery-inspect/` (new; supervisor source, fixtures, tests, `SHA256SUMS`). No `services/`, `frontend/`, compose, env, or package mutation. **If off-repo:** no repository source; stage-start records hashes.

**Mutexes:** GOVERNANCE transiently for records; LOCAL-RUNTIME transiently **only** for the Linux container fixture (FG-6) under explicit Keith authorization (INVENTORY-01 Step 3 run 3 precedent: disposable container, network none, removed after); no STAGING, no SSH, no host.

**Evidence class:** LOCAL-TESTS. **Hot-file leases:** none. **Shared contracts:** PRIV-INSPECTION-01 frozen §6.3 ceilings (15 s / 120 s / 65536 B / 2000 L) and §8 stop conditions as the acceptance envelope; the 14 / 15 s reading adopted only by the successor plan. **Revert isolation:** acceptable (new tooling only).

**Verification deliverables:** Windows synthetic suite (fixture child echoing markers; cases: cap mid-command, deadline mid-command, missing marker, non-zero status, stalled child, marker-forgery, delayed marker, stdin-consuming child, byte-exact boundary) with assertions from the fixture's received-stdin log; Linux container fixture (uid 1000, passwordless `sudo -n`; `timeout --signal=TERM --kill-after=1s 14` over `sudo -n` hang and grandchild cases; exit code / timing / survivor table); FG-4 outcome-class table; hashes; independent Step 4 review.

**Not included:** any host run; any SSH; any change to CAPTURE-01, VERIFY-01, or the operator bundle; any PRIV-INSPECTION-01 edit.

---

## §11. Step 3 / Step 4 acceptance criteria (future; NOT AUTHORIZED here)

### 11.1 Step 3 — Keith's explicit selection

- Keith's statement recorded verbatim with baseline; object = §8 matrix items D-PID-GONE, D-PID-SAME, D-REM, D-PEND.
- Each item recorded as exactly one option or REQUIRES_INPUT / REQUIRES_CLARIFICATION / UNRESOLVED (§8.2).
- No wording altered; adopted clauses identified by reference to this freeze's §3.1, §4.3, §5.2–§5.3 as corrected by §14 and §15, and the chosen AGE and ROOT options. PID-S is not an adoptable object (BLOCKED / NOT SELECTABLE — C2).
- Explicit non-effects restated: no satisfaction for (H, A); no search; no privilege; no U-2(e); no P5; no C-ACQ; no HOST_CLEAN; no P7; no reopen; A1 / A2 untouched; locked predecessor bodies untouched.
- Step 4 NOT AUTHORIZED by Step 3.

### 11.2 Step 4 — independent verification and lock (separate window)

- Selections faithfully recorded against §8; completeness and incompatibility rules applied.
- Weakening statement (§2.1) and risks (§9) present and consistent with adopted clauses.
- E-J6 preservation (§2 item 17; §4.4) verified.
- No A1 / A2 re-adoption; no edit to AMENDMENT-01, JOURNAL-01, SEARCH-01, U1-RESOLUTION-01, PRIV-INSPECTION-01 (incl. uncommitted §17), SCOPE-01, J2-SCOPE-01, INVENTORY-01, ACQUISITION-01, POLICY-01, BASELINE-GOV-01, CAPTURE-01, VERIFY-01.
- Lock = decision record only; creates no execution, inspection, acceptance, or registration authority.

---

## §12. Explicit non-effects of this window

- Adopts nothing. Satisfies nothing for (H, A). Accepts no residual.
- Does not register B3 or B4 (additional successor registration NOT AUTHORIZED).
- Does not implement, build, test, or run any mechanism; does not quote any evidence-package path (B2 is future work).
- Does not perform SSH, sudo, AWS, host inspection, search, PM2, Docker, Postgres, Redis, runtime, transfer, acquisition, recovery, reopening, staging, or canary activity.
- Does not alter A1 / A2 (BASELINE-GOV-01 LOCKED), C-ADOPT selections (ACQUISITION-01 LOCKED), CAPTURE-01, or any locked predecessor body.
- Does not edit the uncommitted PRIV-INSPECTION-01 §17 proposal, `docs/control-plane/SATURATION_PROOF.json`, the sidecar, `lockedTaskIds`, or the mutex catalog.
- Does not change EXEC-01C6A `startCondition=NOT_READY`, `P7_ACCEPTED=NO`, `HOST_CLEAN=NO`, reopen gate UNSATISFIED, Builder gate ON, Lane 3 DISABLED, INVITE-01 PARKED.
- No Git commit, push, reset, restore, clean, or stage.

---

## §13. Step 1 / Step 2 acceptance criteria (this window)

**Step 1 — registration**
- [x] Identifier `PM2-RECOVERY-P5-J2-AMENDMENT-02` confirmed unused across `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/` (zero matches before registration); no equivalent unfinished J-2 amendment task (AMENDMENT-01 is LOCKED and is the predecessor, not a conflict)
- [x] `AISB_MACHINE_REG_V1` stanza `nature=GOVERNANCE` in `TASKS_BACKLOG_FULL.md`; no sidecar candidate; no saturationClass
- [x] Board records in `TASKS.md` (header, program line, governance owner / state, GOVERNANCE and STAGING ledger lines, field block)
- [x] Dependencies confirmed LOCKED: AMENDMENT-01, JOURNAL-01, SEARCH-01, U1-RESOLUTION-01, J2-SCOPE-01, SCOPE-01, INVENTORY-01, ACQUISITION-01, POLICY-01, BASELINE-GOV-01, CAPTURE-01; PRIV-INSPECTION-01 NOT LOCKED and not reopened
- [x] GOVERNANCE acquired transiently then released UNOWNED; STAGING not acquired; occupancy EMPTY

**Step 2 — freeze**
- [x] Stage-start created: `docs/PM2-RECOVERY-P5-J2-AMENDMENT-02-STAGE-START.md` (UTF-8, no BOM, LF)
- [x] Proposed clauses named distinctly from adopted A1 / A2 (`J2-A2-*`); A1 / A2 preserved and not re-proposed (§0 item 6; §8.4)
- [x] Every affected U-1 / scope-sufficiency provision classified FACT / EXCEPTION / BLOCKING / UNCHANGED (§2); weakening stated (§2.1); undiscovered-home risk described (§2.2); E-J6 preserved (§2 item 17; §4.4)
- [x] PID eligibility fail-closed (§3.2); denial / timeout / malformed / failed binding never accepted; SAME-PROCESS branch and non-atomic limitation stated (§3.3)
- [x] Pending / activity checks treated as bounded evidence with stated limitations; threshold change acknowledged (§5.1); freshness tied to the relevant compliant search (§5.3); AGE options reviewable, no default, open value authorizes nothing (§5.6)
- [x] Dispatcher kept as unverified candidate; FG-1…FG-8 cover stdout / stderr completion, marker ambiguity, atomic stop-vs-dispatch, expected-absence outcomes, delivery delays, privileged child termination (§6); nothing built or tested
- [x] Prerequisite writes / transfers checked for invalidation and scheduled (§7.3); B(H) before C-VERIFY; C-VERIFY before C-HOST; C-ACQ race ≠ P7; remaining operational prerequisites carried (§7.1 B8)
- [x] Refusal / partial-adoption outcomes (§8.3); disclosed risks (§9); future implementation / verification scope recorded with no authority (§10)
- [x] Validator run once with proof under `$env:TEMP`; repository `SATURATION_PROOF.json` not mutated
- [x] Dirty files preserved: uncommitted §17 proposal and inherited `SATURATION_PROOF.json` untouched
- [x] No Git commit / push / reset / restore / clean / stage

**Activity ledger (Steps 1–2):** LIVE=0, SSH=0, staging=0, STAGING lease=0, AWS=0, sudo=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, host inspection=0, search execution=0, evidence-package read=0, privilege grant=0, transfer=0, acquisition=0, canary=0, U-2(e)=0, J2-A2 acceptance=0, P5=0, C-ACQ=0, E1=0, HOST_CLEAN=0, P7=0, reopen=0, successor registration=0, implementation=0, tests=0, subagents=0, browser automation=0, predecessor body edits=0, §17 edits=0, sidecar edits=0, lockedTaskIds edits=0, SATURATION_PROOF.json not mutated, Git commit/push/reset/restore/clean/stage=0; files written under transient GOVERNANCE: `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/PM2-RECOVERY-P5-J2-AMENDMENT-02-STAGE-START.md`. Lane-capacity validator result PASS exit 0; proof `C:\Users\knlee\AppData\Local\Temp\PM2-RECOVERY-P5-J2-AMENDMENT-02-steps1-2-saturation-proof.json` SHA-256 `b6aa85ced446b90d3668ff3f6fa20014a064c56cc1a71c47323c5c36866ec97d` / 2496 bytes; occupancy hash unchanged `942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d`; `idleCode=NO_PAIRWISE_ADMISSIBLE_CANDIDATE`; `workingTreeDirty=true` (inherited dirtiness plus this window's writes).

---

## §14. Step 2 correction #1 (C1) — documentation-only, localized (2026-10-01; same uncommitted Step 2 freeze; baseline `7a5f65fbf348e23a45f0f28a61efb34f66bee7e2`)

Keith-directed correction under the existing documentation-only Steps 1–2 preparation authorization. No new task; no broader rewrite; nothing adopted. Frozen §13 Step 1 / Step 2 checklists are not rewritten; this section carries its own checklist. Locked predecessors, the inherited uncommitted PRIV-INSPECTION-01 §17 proposal, and the inherited `docs/control-plane/SATURATION_PROOF.json` are unchanged.

### 14.1 Corrections applied (each marked "(C1)" in place)

| # | Finding | Correction | Where |
|---|---|---|---|
| 1 | Exceptions were reconciled only with condition (a); condition (b), criterion 3, and the coverage-justification element were called FACT or UNCHANGED for territory the clauses exclude | Items 1, 7, 12 reclassified EXCEPTION for excluded territory; new item 7a ("Incomplete coverage" element UNCHANGED as trigger basis); §2.1 extended with the four-provision statement and the **presentation rule** (observed facts vs accepted uncertainty in separate labelled sections; excluded territory never called resolved / covered / absent / searched); §3.1 and §4.3 wording name conditions (a), (b), coverage justification, criterion 3 | §2, §2.1, §3.1, §4.3, §7 B7 |
| 2 | PID eligibility inconsistent with session stops (discriminator after a stopping classification); `comm` / args alone could prove reuse; a matching non-atomic read was called RESOLVED (FACT) for the historical row; unresolved branches not preserved; §9 asserted a PM2 daemon "existed" | Discriminator read moved to E4, **before** the classification command (E5); PID-REUSED requires parseable `lstart` strictly later than search end — `comm` / args mismatch alone → UNCLASSIFIABLE or SAME-PROCESS; §3.3 rewritten: matching reads = observed current fact, historical continuity **inferred**, closure only under new separately selectable **PID-S**; environ-without-`PM2_HOME` branch preserved as BLOCKING with no exception; §9 item 1 reworded: whether the process was a PM2 daemon is unknown | §3.1, §3.2, §3.3, §3.6, §2 items 2 / 6, §9 |
| 3 | E2 cited a hostname string "retained in locked evidence"; SEARCH-01's published markers omit the hostname and INVENTORY-01's `HOSTNAME` marker was not published | No source cited or invented; `whoami` / `id -u` cited from SEARCH-01 §14.4 published markers; hostname binding recorded as **unsatisfied precondition P-HOSTBIND**; added to B4, §6.4, §8.3, §8.5 | §3.2 E2, §7 B4, §6.4, §8.3, §8.5 |
| 4 | Pending (iii) presumed unprivileged access sufficient for root paths; listed persistent material artifacts as pending indicators; implied completion = disappearance; B5 / §4.4 assumed names / `stat` suffice; §3.5 / §5.5 triggers would fire on the authorized C-ACQ's own PM2 client; §5.4 used D2b as freshness authority | §5.1 adds explicit threshold changes 1–3; §5.2 separates in-progress indicators from persistent material (routed to criterion 4; never removed; presence after H0 classification does not block); ROOT-A / ROOT-B / ROOT-UNRESOLVED option table; §4.4 classification evidence Tiers 1–3 with separate authorization per item and tier; §3.5 / §5.5 carve-out for authorized C-ACQ client processes (daemon appearance remains a trigger); §5.4 freshness bullet rewritten — no search age added, no discretionary judgment, D2b confined to the H2 attestation | §4.4, §5.1, §5.2, §5.4, §5.5, §5.6, §5.7, §3.5, §7 B5 / B6 / B7 / §7.3, §9 items 3–4 |
| 5 | §6 claimed guarantees ("always precedes", "ever delivered") from bounded fixture delays; no failure consequences for unconfirmed termination or surviving children | FG-5 pass condition bounded to the injected range; guarantee paragraph replaced by property classes **L / D / T / A** (local dispatch; remote delivery; termination; target-host applicability) with what fixtures cannot establish; failure consequences TERMINATION-UNCONFIRMED / SURVIVING CHILD / LATE OUTPUT defined; §6.4 states class A is never established before host use | §6.3, §6.4 |
| 6 | Decision matrix and board / backlog fields did not reflect the above | §8.1 split D-PID into D-PID-GONE / D-PID-SAME; D-PEND gains ROOT; §8.3 rows rebuilt incl. SAME-PROCESS outside-scope / absent-environ row and P-HOSTBIND row; §8.4 new incompatibility; §8.5 route preconditions outside the matrix; §11.1 object list updated; this task's `TASKS.md` field block and `TASKS_BACKLOG_FULL.md` body updated (C1 fields / record only) | §8, §11.1, board, backlog |

### 14.2 What C1 does not do

- Adopts nothing; selects nothing; satisfies nothing for (H, A).
- Does not register B3 / B4 or any successor; grants no implementation, test, host, SSH, sudo, AWS, inspection, transfer, acquisition, acceptance, staging, or Git authority.
- Does not edit any locked predecessor body, the uncommitted PRIV-INSPECTION-01 §17 proposal, `docs/control-plane/SATURATION_PROOF.json`, the sidecar, `lockedTaskIds`, or the mutex catalog.
- Does not rewrite frozen §13 checklists or the Step 1–2 ledger; does not add an age for the compliant search; does not supply or invent a hostname.

### 14.3 C1 checklist

- [x] Items 1 / 7 / 12 reclassified; item 7a added; §2.1 four-provision statement and presentation rule present; excluded territory nowhere called resolved
- [x] Discriminator precedes the classification that stops the session; REUSED by `lstart` only; SAME-PROCESS = observed current fact with inferred continuity; PID-S separately selectable; absent-`PM2_HOME` branch BLOCKING with no exception; §9 item 1 corrected
- [x] Hostname: no source cited or invented; P-HOSTBIND recorded unsatisfied; propagated to B4 / §6.4 / §8.3 / §8.5
- [x] Pending: privilege-bounded (iii); in-progress vs persistent material separated; preservation explicit; classification Tiers 1–3 with separate authorization; C-ACQ carve-out in §3.5 / §5.5 / §7.3; D2b removed from J-2 freshness; threshold changes 1–3 stated
- [x] §6: FG-5 bounded; classes L / D / T / A separated; failure consequences defined; no unconditional guarantee remains
- [x] §8 matrix and §11.1 propagated; board / backlog fields for this task only
- [x] Validator run once with proof under `$env:TEMP`; repository `SATURATION_PROOF.json` not mutated
- [x] Inherited dirty files untouched; no Git commit / push / reset / restore / clean / stage

**C1 activity ledger:** LIVE=0, SSH=0, STAGING lease=0, AWS=0, sudo=0, host inspection=0, search=0, evidence-package read=0, PM2=0, Docker=0, Postgres=0, Redis=0, runtime=0, privilege grant=0, transfer=0, acquisition=0, U-2(e)=0, J2-A2 acceptance=0, P5=0, C-ACQ=0, HOST_CLEAN=0, P7=0, reopen=0, successor registration=0, implementation=0, tests=0, subagents=0, predecessor body edits=0, §17 edits=0, sidecar edits=0, SATURATION_PROOF.json not mutated, Git commit/push/reset/restore/clean/stage=0; files written under transient GOVERNANCE: `docs/PM2-RECOVERY-P5-J2-AMENDMENT-02-STAGE-START.md`, `TASKS.md` (this task's fields), `TASKS_BACKLOG_FULL.md` (this task's body). Validator proof: recorded in §14.4.

### 14.4 Validator proof (C1)

`scripts/validate-lane-capacity.ps1 -ProofPath C:\Users\knlee\AppData\Local\Temp\PM2-RECOVERY-P5-J2-AMENDMENT-02-c1-saturation-proof.json` → **PASS**, exit 0; proof SHA-256 `b6aa85ced446b90d3668ff3f6fa20014a064c56cc1a71c47323c5c36866ec97d` / 2496 bytes (byte-identical to the Step 1–2 proof: same HEAD `7a5f65fb…`, same occupancy hash `942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d`, same sidecar `271eaeda…`, same mutex catalog `64232fa4…`); `admissibleForcingCandidates=[]`; `idleCode=NO_PAIRWISE_ADMISSIBLE_CANDIDATE`; `workingTreeDirty=true`. Repository `docs/control-plane/SATURATION_PROOF.json` not written (blob `50ce410efe547a7e24f06ef75b9410916d5dae8a` unchanged). PRIV-INSPECTION-01 stage-start blob `b711d3a6af74ec3eb40c32a52840967eccb911ba` unchanged.

---

## §15. Step 2 correction #2 (C2) — documentation-only, localized (2026-10-01; same uncommitted Step 2 freeze; baseline `7a5f65fbf348e23a45f0f28a61efb34f66bee7e2`)

Keith-directed correction under the existing documentation-only Steps 1–2 preparation authorization. No new task; no broader rewrite; no new decision variants; nothing adopted. §14 (C1) is preserved as the historical record of correction #1 and is not rewritten; where C2 supersedes a C1 formulation the superseding text is marked "(C2)" in place and listed here. Frozen §13 checklists are not rewritten.

### 15.1 Corrections applied (each marked "(C2)" in place)

| # | Finding | Correction | Where |
|---|---|---|---|
| 1 | E5 mapped the identical "command mismatch + not-later `lstart`" case to both UNCLASSIFIABLE and SAME-PROCESS; §3.3 made SAME-PROCESS "whatever `comm` shows"; PID-S (C1) excepted condition (a) only while a wrong continuity inference leaves the historical PM2 home unidentified — the excluded territory of condition (b), coverage justification, and criterion 3 | E5 replaced by a **deterministic classification table** (one class per input combination; SAME-PROCESS requires not-later `lstart` **and** consistent command identity; mismatch with not-later `lstart` → UNCLASSIFIABLE blocking; `lstart` unreadable → UNBOUND; `/proc` vs `ps` disagreement → UNCLASSIFIABLE; no mismatch maps to REUSED); §3.1 and §3.3 aligned; the "live PID not reassigned" justification removed. PID-S reconciled: it would require exceptions beyond §3.1 → **PID-S marked BLOCKED / NOT SELECTABLE** for this freeze instead of expanding the policy; §3.3 table and §3.6 updated; the rows remain U1-REMAINS on every SAME-PROCESS result; §1.2, §2 items 2 / 6, §9 item 1, §11.1 propagated | §1.2, §2, §3.1, §3.2 E5 + table, §3.3, §3.6, §9, §11.1 |
| 2 | §5.2 (iii) treated every file with an interval mtime as an in-progress operation (over-inclusive: would class §7.3 preparation writes as pending; under-protective: implied H0 = no pending operation); names / `stat` presumed to settle status | §5.2 rewritten into evidence classes **(B) actual pending operation**, **(A) activity requiring criterion-6 assessment** (attributed → recorded; unattributed → BLOCKING; changed `dump.pm2` → save-class invalidation), **(C) explicitly classified preparation artifacts** (enumerated with provenance; interval mtimes expected); **H0 alone does not establish absence of a pending operation**; queue-capable artifacts require **adequate non-secret status evidence** (Tier 2 class, separate authorization); insufficient → BLOCKING, not residual; preservation explicit, no deletion for any outcome; §5.1 item 4 states that this is not a further weakening; §5.3 takes (A) / (C) items as criterion-6 inputs; §5.4 adds the status-evidence and interval limitations; §7.3 reconciled (preparation writes = class (C); B6 observation predating a write is renewed); §9 item 3 bounds the residual | §5.1, §5.2, §5.3, §5.4, §7 B6, §7.3, §9 |
| 3 | §6 lacked a readiness verdict for fixture-demonstrated violations of the adopted stop requirement; FG-6 allowed survivors with "residual limitations stated"; SURVIVING CHILD claimed "write risk is nil"; LATE OUTPUT implied unlimited post-cap capture; D / T compliance was left as an assumption rather than a block | **Mechanism-readiness rule** added: any fixture-demonstrated violation (FG-3 post-stop bytes, FG-5 escalation after local deadline inside the injected range, FG-6 survivors) **FAILS**; reporting survivors is not a mitigation; D / T compliance **BLOCKED for host use** until a separately reviewed design satisfies the requirement or a separately authorized rule change addresses it; FG-6 pass condition = no survivor; "write risk is nil" removed (survivor behaviour unverified; no write-risk claim); LATE OUTPUT bounded to the frozen 65536 B / 2000 L aggregate budget, count-only beyond it; **session-wide evidence-rejection rule preserved** (post-stop execution → execution compliance FAIL → no row closure from that session); §6.4 made necessary-not-sufficient with the host-use block | §6.3, §6.4 |
| 4 | Matrix and current records did not reflect the above | §8.1 D-PID-SAME shows PID-S BLOCKED / NOT SELECTABLE; §8.3 rows rebuilt (PID-S not available; SAME-PROCESS → No; UNCLASSIFIABLE / UNBOUND → No; unattributed (A) / missing status evidence → No; D / T unresolved → No); §8.4 four new incompatibilities; §8.5 items (5) and (6); this task's `TASKS.md` field block and `TASKS_BACKLOG_FULL.md` body updated (C2 fields / record only) | §8, board, backlog |

### 15.2 What C2 does not do

- Adopts nothing; selects nothing; satisfies nothing for (H, A); adds no decision variant (PID-S is restricted, not replaced; AGE / ROOT options unchanged).
- Does not implement, build, or run any mechanism or fixture; does not define the command-identity consistency predicate (successor-plan parameter); does not authorize any Tier 2 status-evidence read.
- Does not propose or make any change to PRIV-INSPECTION-01's adopted stop requirement; records only that D / T compliance with it is BLOCKED for host use.
- Does not register B3 / B4 or any successor; grants no implementation, test, host, SSH, sudo, AWS, inspection, transfer, acquisition, acceptance, staging, or Git authority.
- Does not edit any locked predecessor body, the uncommitted PRIV-INSPECTION-01 §17 proposal, `docs/control-plane/SATURATION_PROOF.json`, the sidecar, `lockedTaskIds`, the mutex catalog, or any other task's board / backlog text.
- Does not rewrite §13 or §14; does not require or permit deletion of any host artifact.

### 15.3 C2 checklist

- [x] E5 deterministic: one class per input combination; mismatch + not-later `lstart` → UNCLASSIFIABLE; §3.1 / §3.3 consistent; ambiguous outcomes blocking
- [x] PID-S reconciled with the possibly unidentified historical home and every affected coverage requirement → BLOCKED / NOT SELECTABLE; no policy expansion; propagated to §1.2, §2, §3.3, §3.6, §8, §9, §11.1
- [x] Unconditional interval-mtime rule removed; classes (A) / (B) / (C) separated; H0 ≠ no pending operation; status evidence required where the format can encode queued work; insufficient → BLOCKING; interval / revalidation reconciled with §7.3; no deletion required
- [x] Fixture-demonstrated stop-requirement violation = readiness FAIL; survivors not a mitigation; D / T compliance BLOCKED for host use pending separately reviewed design or separately authorized rule change; "write risk is nil" removed; late output within the aggregate budget; session-wide rejection preserved
- [x] Matrix and this task's board / backlog current-record text propagated; C1 preserved as historical record
- [x] Validator run once with proof under `$env:TEMP`; repository `SATURATION_PROOF.json` not mutated
- [x] Inherited dirty files untouched; no Git commit / push / reset / restore / clean / stage

**C2 activity ledger:** LIVE=0, SSH=0, STAGING lease=0, AWS=0, sudo=0, host inspection=0, search=0, evidence-package read=0, PM2=0, Docker=0, Postgres=0, Redis=0, runtime=0, fixtures run=0, privilege grant=0, transfer=0, acquisition=0, U-2(e)=0, J2-A2 acceptance=0, P5=0, C-ACQ=0, HOST_CLEAN=0, P7=0, reopen=0, successor registration=0, implementation=0, tests=0, subagents=0, predecessor body edits=0, §17 edits=0, sidecar edits=0, SATURATION_PROOF.json not mutated, Git commit/push/reset/restore/clean/stage=0; files written under transient GOVERNANCE: `docs/PM2-RECOVERY-P5-J2-AMENDMENT-02-STAGE-START.md`, `TASKS.md` (this task's fields), `TASKS_BACKLOG_FULL.md` (this task's body). GOVERNANCE released UNOWNED.

### 15.4 Validator proof (C2)

`scripts/validate-lane-capacity.ps1 -ProofPath C:\Users\knlee\AppData\Local\Temp\PM2-RECOVERY-P5-J2-AMENDMENT-02-c2-saturation-proof.json` → **PASS**, exit 0; proof SHA-256 `b6aa85ced446b90d3668ff3f6fa20014a064c56cc1a71c47323c5c36866ec97d` / 2496 bytes (byte-identical to the Step 1–2 and C1 proofs: same HEAD `7a5f65fb…`, same occupancy hash `942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d`, same sidecar and mutex catalog); `admissibleForcingCandidates=[]`; `idleCode=NO_PAIRWISE_ADMISSIBLE_CANDIDATE`; `workingTreeDirty=true`. Repository `docs/control-plane/SATURATION_PROOF.json` not written (blob `50ce410efe547a7e24f06ef75b9410916d5dae8a` unchanged). PRIV-INSPECTION-01 stage-start blob `b711d3a6af74ec3eb40c32a52840967eccb911ba` unchanged.

---

## §16. Step 3 — Keith's explicit selection (2026-10-01)

**Step:** 3 of 4 — record Keith's explicit selection
**Step 3 date:** 2026-10-01
**Step 3 HEAD at window open:** `7a5f65fbf348e23a45f0f28a61efb34f66bee7e2` (branch main; index empty; inherited dirtiness preserved unchanged: `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/PM2-RECOVERY-P5-J2-U1-PRIV-INSPECTION-01-STAGE-START.md` (uncommitted §17 proposal, blob `b711d3a6af74ec3eb40c32a52840967eccb911ba`), `docs/control-plane/SATURATION_PROOF.json` (blob `50ce410efe547a7e24f06ef75b9410916d5dae8a`); this stage-start untracked)
**Authorization scope:** Step 3 only, documentation-only. Step 4 (independent verification and lock) remains **NOT AUTHORIZED**. Task **NOT LOCKED**.
**Object selected:** the §8 matrix items of this document as frozen and reviewed at SHA-256 `8e191e7267d7369fb05ba45b855cb7c508b091e6002e0579ca8c3ce435e8f8d6` (git blob `5f21808a8beff3b09e6421599adf136863173d13`; 110,118 bytes; §§0–15 including correction records §14 (C1) and §15 (C2)), **without alteration**.
**Pre-write verification:** HEAD equal to the stated baseline; the file's SHA-256 equal to the value Keith cited, before any Step 3 write; a byte copy was retained at `C:\Users\knlee\AppData\Local\Temp\AMENDMENT-02-STAGE-START.frozen-C2.md` (same SHA-256). The Step 3 writes to this file are insertions only: the header "Step 3 record" line and this §16.

### 16.1 Authorization evidence (verbatim)

**Keith's authorization (verbatim, received in this window):**

> Authorize PM2-RECOVERY-P5-J2-AMENDMENT-02 Step 3 only,
> documentation-only, at baseline
> 7a5f65fbf348e23a45f0f28a61efb34f66bee7e2.
>
> Use the reviewed C2 freeze, SHA-256:
> 8e191e7267d7369fb05ba45b855cb7c508b091e6002e0579ca8c3ce435e8f8d6.
>
> Record my selections:
> D-PID-GONE = PID-B
> D-PID-SAME = PID-S-REFUSE
> D-REM = REM-ii
> D-PEND = PEND-ADOPT + AGE-A + ROOT-A
>
> I understand these permit later acceptance of disclosed uncertainty;
> they do not establish absence or satisfy the clauses for this host now.
>
> Verify the baseline and reviewed content before writing.
> Record the selections without rewriting the frozen wording.
> Preserve historical records and all inherited changes.
> Return the updated decision record and review diff.
>
> Step 4, lock, implementation, tests, host access, inspection,
> successor registration, attestation acceptance, staging,
> commit and push remain unauthorized.

**Relationship:** this is Keith's own statement. No other conditions, modifications, or options were stated.
**Date recorded:** 2026-10-01
**Baseline at selection:** `7a5f65fbf348e23a45f0f28a61efb34f66bee7e2`

### 16.2 Selections

| Item (§8.1) | Selected | Not selected | Frozen definition |
|---|---|---|---|
| D-PID-GONE | **PID-B** — narrower: PID-GONE only; PID-REUSED is not eligible | PID-A; PID-REFUSE | §3.6 |
| D-PID-SAME | **PID-S-REFUSE** — the observed fact is recorded; the rows remain U1-REMAINS; the route cannot reach attestation on a SAME-PROCESS result | PID-S (BLOCKED / NOT SELECTABLE in this freeze; not recorded) | §3.3; §3.6 |
| D-REM | **REM-ii** — as worded | REM-i; REM-REFUSE | §4.3; §4.6 |
| D-PEND | **PEND-ADOPT + AGE-A + ROOT-A** — clauses (a) and (b) as worded, with AGE-A and ROOT-A | PEND-REFUSE; AGE-B; AGE-C; ROOT-B | §5.2; §5.3; §5.6; §5.7 |

Under P5-JOURNAL-01 §0.8 / §4.1 and §1.4 of this document, Keith's selection is the **explicit adoption** of the prospective J-2 amendment clauses J2-A2-PID (as narrowed by PID-B), J2-A2-REM (REM-ii) and J2-A2-PEND (AGE-A, ROOT-A), each as frozen. Its character as an amendment is acknowledged: these clauses lower the U-1 acceptance requirement as stated in §2.1. Adoption is made by this explicit decision, not by interpretation of existing locked authority. The adoption is **not yet independently verified or locked**; Step 4 is not authorized.

### 16.3 Completeness and incompatibility check (§8.2 / §8.4)

| Rule | Result |
|---|---|
| Each item recorded as exactly one option, or as REQUIRES_INPUT / REQUIRES_CLARIFICATION / UNRESOLVED | PASS — four items, one option each |
| PEND-ADOPT without AGE or without ROOT → REQUIRES_CLARIFICATION | not triggered — AGE-A and ROOT-A both selected |
| REM-i without facts → REQUIRES_INPUT | not triggered — REM-i not selected |
| PID-S recorded as selected → CONTRADICTORY | not triggered — PID-S-REFUSE recorded |
| Adoption expressed as an "A1 / A2 amendment" → CONTRADICTORY | not triggered — the clauses are `J2-A2-*`; BASELINE-GOV-01 A1 / A2 untouched |
| `comm` / argument change as PID-REUSED; SAME-PROCESS read as historical closure; UNCLASSIFIABLE / UNBOUND / unattributed (A) / missing status evidence as accepted residual; §6 fixture violation as mechanism-ready → CONTRADICTORY | not triggered — no selection makes such a treatment; under PID-B, PID-REUSED is not eligible at all |
| Wording altered at Step 3 | No — §§0–15 unaltered |

No item is CONTRADICTORY, REQUIRES_INPUT, REQUIRES_CLARIFICATION, or UNRESOLVED.

### 16.4 Adopted content identified by reference (not restated)

| Adopted clause | Frozen location | Reading under the selection |
|---|---|---|
| J2-A2-PID (PID-B) | §3.1 wording; §3.2 E1–E7 and the C2 deterministic classification table; §3.4 disclosure; §3.5 invalidation triggers | Only **PID-GONE** is eligible. The §3.1 / §3.2 E5 / §3.4 references to PID-REUSED are inoperative under PID-B (frozen text not rewritten). A PID-REUSED result leaves U1-G3 / U1-G4-current U-1 with no treatment |
| SAME-PROCESS treatment (PID-S-REFUSE) | §3.3 text and table; §3.6 D-PID-SAME | Observed current fact recorded; U1-G3 / U1-G4-current remain U1-REMAINS; no exception for any SAME-PROCESS branch |
| J2-A2-REM (REM-ii) | §4.3 wording; §4.4 blocking branches incl. classification evidence tiers; §4.5 invalidation triggers | As worded |
| J2-A2-PEND (a) and (b) | §5.2 wording incl. C2 evidence classes (A) / (B) / (C); §5.3 wording; §5.4 limitations; §5.5 invalidation triggers | As worded |
| AGE-A | §5.6 AGE table, row AGE-A | Acceptance-time observation in the same authorized window, ≤ 2 h old at acceptance; acceptance recorded before the STAGING lease is released; two STAGING leases if the privileged inspection session was earlier |
| ROOT-A | §5.6 ROOT table, row ROOT-A | Root-owned covered locations re-observed at acceptance time under a **separately authorized** `sudo -n` read-only grant with its own P-PRIV-GRANT, P-RO and STAGING lease, using a verified mechanism (§6). The ROOT-B additional threshold reduction (§5.1 item 1, second half) is **not** adopted |
| Cross-cutting provisions | §2 classifications; §2.1 weakening statement and presentation rule; §5.1 threshold statements items 1 (ROOT-A branch), 2, 3, 4; §7.3 scheduling guidance; §9 disclosed risks 1–5 as applicable to the selected clauses | Apply to every attestation under the adopted clauses |

### 16.5 Consequences of the selected combination (from the frozen §8.3 / §8.5; no new rule)

- **Matrix row:** "A or B | any | REM-ii | ADOPT+AGE+ROOT" → the Option B route can **possibly** reach attestation acceptance only if a compliant B4 session yields **PID-GONE**. All other conditions in that row must also hold: every closed-set row and every quoted path RESOLVED; no DENIED / TIMEOUT; no H1 / UNCLASSIFIED; §3.2 E1–E7 including P-HOSTBIND satisfied; B6 within AGE-A at ROOT-A privilege; Keith's acceptance.
- **Outcomes that stop the route under this selection:** PID-REUSED (no treatment under PID-B); SAME-PROCESS on any branch (PID-S-REFUSE row); UNCLASSIFIABLE or UNBOUND; any DENIED / TIMEOUT / cap-hit / incompletely listed closed-set or quoted path (E-J6); an unattributed §5.2 class (A) item, or a queue-capable artifact without adequate status evidence; unresolved §6 D / T stop-requirement compliance, or any fixture-demonstrated violation. A filename-class hit routes to the B5 classification stage, and H1 changes the route to J-1 / E-J1.
- **ROOT-A dependency:** B6 needs its own privileged grant and the §6 mechanism. The §6.3 readiness rule therefore blocks B6 for host use exactly as it blocks B4 (§8.5 (5)).
- **§8.5 route preconditions (1)–(6) remain unsatisfied:** P-HOSTBIND; FG-1…FG-8 and the adopted failure consequences; quoted SEARCH-01 stderr paths; separate authorizations for B3, B4, B5 tiers, B6 ROOT-A and acceptance; D / T compliance; a Tier 2 status-evidence command class.
- **Current route state:** the Option B route **cannot reach attestation acceptance now**. The rows recorded in §1.2 remain as locked.

### 16.6 Keith's acknowledgement recorded

Keith stated: "I understand these permit later acceptance of disclosed uncertainty; they do not establish absence or satisfy the clauses for this host now." This is consistent with §8.2 ("Adoption of any clause does not satisfy it for (H, A); satisfaction is attestation-time evidence"). Every acceptance under the adopted clauses remains a later, distinct, recorded decision at attestation time (§2 items 9–10).

### 16.7 Historical records preserved

- §§0–15 are unaltered. The header **Step:** line, the C1 / C2 "NOTHING ADOPTED" statements, and the §13 / §14 / §15 checklists are historical records of Step 2 and its corrections, true when written. They are superseded in current status only by the header "Step 3 record" line and this §16.
- PID-S remains recorded as BLOCKED / NOT SELECTABLE (§3.6); this Step 3 neither selects nor revives it.

### 16.8 What this decision does NOT do

1. Does **not** satisfy any adopted clause for (H, A). It establishes no absence, accepts no residual, and accepts no attestation.
2. Does **not** approve any host-specific scope, perform U-2(e), or establish P5.
3. Does **not** unblock C-ACQ or authorize transfer, acquisition, B(H), or verifier live use.
4. Does **not** change `HOST_CLEAN=NO`, `P7_ACCEPTED=NO`, reopen gate UNSATISFIED, host UNCLEAN / HOLD, or EXEC-01C6A `startCondition=NOT_READY`.
5. Does **not** authorize search, privilege, `sudo`, SSH, AWS, host inspection, PM2, staging, canary, or any runtime activity. Separate authorizations are still required for every B2–B13 step.
6. Does **not** register B3, B4, or any successor, and grants no implementation or test authority.
7. Does **not** supply a hostname (P-HOSTBIND stays unsatisfied) or a command-identity predicate (successor-plan parameter). It does not resolve §6 D / T compliance or authorize any Tier 2 read.
8. Does **not** alter BASELINE-GOV-01 A1 / A2, ACQUISITION-01 C-ADOPT selections, or any locked predecessor body. It does not edit the uncommitted PRIV-INSPECTION-01 §17 proposal, `docs/control-plane/SATURATION_PROOF.json`, the sidecar, `lockedTaskIds`, the mutex catalog, or any other task's records.
9. Does **not** convert testimony. Keith's testimony remains "probably no, but uncertain".
10. Does **not** treat D2b as authority for any J-2 judgment.
11. Does **not** LOCK this task. Step 4 remains NOT AUTHORIZED.

### 16.9 §11.1 checklist

- [x] Keith's statement recorded verbatim with baseline; object = §8 matrix items D-PID-GONE, D-PID-SAME, D-REM, D-PEND
- [x] Each item recorded as exactly one option (§8.2); no CONTRADICTORY / REQUIRES_* outcome (§16.3)
- [x] No wording altered; adopted clauses identified by reference to §3.1, §4.3, §5.2–§5.3 as corrected by §14 and §15, plus AGE-A and ROOT-A; PID-S not adopted
- [x] Explicit non-effects restated (§16.8): no satisfaction for (H, A); no search; no privilege; no U-2(e); no P5; no C-ACQ; no HOST_CLEAN; no P7; no reopen; A1 / A2 untouched; locked predecessor bodies untouched
- [x] Step 4 NOT AUTHORIZED by Step 3
- [x] Baseline and reviewed SHA-256 verified before writing; Step 3 file writes are insertions only

### 16.10 Activity ledger (Step 3) and validator proof

LIVE=0, SSH=0, STAGING lease=0, AWS=0, sudo=0, host inspection=0, search=0, evidence-package read=0, PM2=0, Docker=0, Postgres=0, Redis=0, runtime=0, fixtures run=0, privilege grant=0, transfer=0, acquisition=0, U-2(e)=0, J2-A2 acceptance=0, attestation acceptance=0, P5=0, C-ACQ=0, HOST_CLEAN=0, P7=0, reopen=0, successor registration=0, implementation=0, tests=0 (apart from the lane-capacity validator, with its proof written to `$env:TEMP`), subagents=0, frozen wording altered=0, predecessor body edits=0, §17 edits=0, sidecar / lockedTaskIds / mutex-catalog edits=0, other-task record edits=0, SATURATION_PROOF.json not mutated, Git commit/push/reset/restore/clean/stage=0. Selections recorded: D-PID-GONE=PID-B; D-PID-SAME=PID-S-REFUSE; D-REM=REM-ii; D-PEND=PEND-ADOPT+AGE-A+ROOT-A. Files written under transient GOVERNANCE: this stage-start (header Step 3 record line plus §16, insertions only), `TASKS.md` (this task's board records), `TASKS_BACKLOG_FULL.md` (this task's canonical body). GOVERNANCE released UNOWNED. STAGING not acquired.

Lane-capacity validator (`scripts/validate-lane-capacity.ps1 -ProofPath $env:TEMP\PM2-RECOVERY-P5-J2-AMENDMENT-02-step3-saturation-proof.json`): result PASS, exit 0, idleCode `NO_PAIRWISE_ADMISSIBLE_CANDIDATE`, admissibleForcingCandidates `[]`, headSha `7a5f65fbf348e23a45f0f28a61efb34f66bee7e2`. Proof SHA-256 `b6aa85ced446b90d3668ff3f6fa20014a064c56cc1a71c47323c5c36866ec97d`, 2496 bytes, byte-identical to the Step 1–2, C1 and C2 proofs because the inputs are the same. Occupancy hash unchanged at `942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d`. Inherited `docs/control-plane/SATURATION_PROOF.json` blob `50ce410efe547a7e24f06ef75b9410916d5dae8a` unchanged.

**Status: PM2-RECOVERY-P5-J2-AMENDMENT-02 — Step 3 COMPLETE (Keith's explicit selection recorded against the C2 freeze SHA-256 `8e191e7267d7369fb05ba45b855cb7c508b091e6002e0579ca8c3ce435e8f8d6`: D-PID-GONE = PID-B; D-PID-SAME = PID-S-REFUSE; D-REM = REM-ii; D-PEND = PEND-ADOPT + AGE-A + ROOT-A; prospective J-2 amendment clauses adopted as frozen; nothing satisfied for (H, A)) — 2026-10-01 at baseline `7a5f65fbf348e23a45f0f28a61efb34f66bee7e2`. Step 4 NOT AUTHORIZED. Task NOT LOCKED.**

---

## §17. Step 4 — Independent verification and lock (2026-10-01)

**Step:** 4 of 4 — independent verification and lock
**Step 4 date:** 2026-10-01
**Step 4 HEAD at window open:** `7a5f65fbf348e23a45f0f28a61efb34f66bee7e2` (branch main; index empty; inherited dirtiness preserved unchanged: `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/PM2-RECOVERY-P5-J2-U1-PRIV-INSPECTION-01-STAGE-START.md` (uncommitted §17 proposal), `docs/control-plane/SATURATION_PROOF.json`; this stage-start untracked; matches the expected baseline)
**Authorization (verbatim excerpt of Keith's Step 4 statement, received in this window):**

> Perform Step 4 only for PM2-RECOVERY-P5-J2-AMENDMENT-02:
> independent verification and, only on PASS, documentation lock.
>
> Keith authorizes this documentation-only Step 4.
> This authorization grants no inspection or recovery execution.

The same statement names the expected HEAD, the expected Step 3 stage-start SHA-256, the reviewed C2 freeze SHA-256, and the two inherited blobs, and excludes implementation, fixtures, runtime tests, host connection, SSH, sudo, AWS, PM2, Docker, Postgres, Redis, provider or credit use, inspection, transfer, acquisition, attestation acceptance, U-2(e), recovery, reopen, successor registration, subagents, and Git staging / commit / push / stash / reset / restore / clean.
**Separate window:** this verification ran in a window separate from the Step 3 window and checked the records directly rather than relying on the Step 3 worker report.

### 17.1 Verification scope and evidence base

Frozen §§0–15 and the Step 3 record (§16) are not rewritten. Step 4 writes to this file are insertions only: the header "Step 4 record" line and this §17.

| Input | Expected | Observed | Result |
|---|---|---|---|
| HEAD | `7a5f65fbf348e23a45f0f28a61efb34f66bee7e2` | same | MATCH |
| This stage-start before any Step 4 write | SHA-256 `1f3e0a2b020883021b37400c8a48a5d9503675a339c551b7f3abcbec9c443f47` | same; 124,686 bytes; UTF-8 without BOM; LF; 761 lines | MATCH |
| C2 freeze contained in it | SHA-256 `8e191e7267d7369fb05ba45b855cb7c508b091e6002e0579ca8c3ce435e8f8d6` | removing exactly the header "Step 3 record" line (line 6) and the appended block (lines 633–761: blank, `---`, blank, §16) reproduces 110,118 bytes, SHA-256 `8e191e7267d7369fb05ba45b855cb7c508b091e6002e0579ca8c3ce435e8f8d6`, git blob `5f21808a8beff3b09e6421599adf136863173d13` | MATCH |
| Step 3 retained byte copy `C:\Users\knlee\AppData\Local\Temp\AMENDMENT-02-STAGE-START.frozen-C2.md` | C2 SHA-256 | same SHA-256 and size; `git diff --no-index` from it to this file shows `@@ -5,0 +6 @@` and `@@ -631,0 +633,129 @@` — insertions only, zero deletions | MATCH (corroborating) |
| PRIV-INSPECTION-01 stage-start incl. proposed §17 | git blob `b711d3a6af74ec3eb40c32a52840967eccb911ba` | same | MATCH |
| `docs/control-plane/SATURATION_PROOF.json` | git blob `50ce410efe547a7e24f06ef75b9410916d5dae8a` | same | MATCH |
| Keith's Step 3 statement (§16.1) | verbatim | the 24 quoted lines are character-identical to the message received in the Step 3 window | MATCH |

Tracked changes since HEAD before any Step 4 write (`git diff --name-status HEAD`): `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/PM2-RECOVERY-P5-J2-U1-PRIV-INSPECTION-01-STAGE-START.md`, `docs/control-plane/SATURATION_PROOF.json`. Every `TASKS_BACKLOG_FULL.md` hunk lies in the PRIV-INSPECTION-01 body (NOT LOCKED; inherited §17 records) or in this task's body. Every `TASKS.md` hunk is the board header, the program and governance-owner lines, the GOVERNANCE and STAGING ledger lines, or this task's field block. No other `docs/` file differs from HEAD. `docs/control-plane/lane-saturation-state.json`, `docs/control-plane/mutex-catalog.json`, `scripts/validate-lane-capacity.ps1`, `CLAUDE.md`, `AGENTS.md`, `PRD.md`, and `ARCHITECTURE.md` have zero diff.

**Predecessor provisions consulted:** P5-JOURNAL-01 §4.1 (Step 4 verifies that the decision record is internally consistent and correctly recorded; no new authority) and §4.2 (a locked decision record establishes no host satisfaction and does not unblock C-ACQ); P5-JOURNAL-01 §3.1–§3.2 E-J6 (missing, inaccessible, or incomplete evidence blocks C-ACQ); AMENDMENT-01 §11 (Step 4 lock precedent for this amendment container; a GOVERNANCE task is absent from `lockedTaskIds`); sidecar candidate AGENT-PLATFORM-EXEC-01C6A (`startCondition=NOT_READY`).

### 17.2 Criterion-by-criterion findings

| # | Criterion (source) | Verdict | Evidence |
|---|---|---|---|
| 1 | Keith's authorization recorded (§11.1; §16.1) | **PASS** | §16.1 records the statement verbatim with baseline and freeze SHA-256; the 24 quoted lines match the Step 3 window's received message character for character. §16.1 states it is Keith's own statement with no other conditions |
| 2 | Selections faithfully recorded against §8 (§11.2 bullet 1) | **PASS** | §16.2: D-PID-GONE = PID-B; D-PID-SAME = PID-S-REFUSE; D-REM = REM-ii; D-PEND = PEND-ADOPT + AGE-A + ROOT-A. Each is a defined option (§8.1; §3.6; §4.6; §5.7). Identical to Keith's statement, to the board field `STEP_3_SELECTIONS`, and to the backlog Step 3 record |
| 3 | Completeness and incompatibility rules applied (§11.2 bullet 1; §8.2; §8.4) | **PASS** | Each item has exactly one option. PEND-ADOPT carries both AGE-A and ROOT-A, so it is not REQUIRES_CLARIFICATION. REM-i is not selected, so REQUIRES_INPUT does not arise. PID-S is not recorded, so it is not CONTRADICTORY. Nothing is framed as an "A1 / A2 amendment"; the clauses are `J2-A2-*` (§0 item 6). No selection treats a `comm` / argument change as PID-REUSED, a SAME-PROCESS read as historical closure, UNCLASSIFIABLE / UNBOUND / unattributed class (A) / missing status evidence as an accepted residual, or a §6 fixture violation as mechanism-ready. This independent check agrees with §16.3 |
| 4 | Adoption references the reviewed frozen wording without changing it (§11.1; §8.2 bullet 2) | **PASS** | §17.1 reconstruction proves §§0–15 are byte-identical to the reviewed C2 freeze. §16.4 identifies the clauses by location (§3.1–§3.5; §4.3–§4.5; §5.2–§5.6) and states a reading only where the selection narrows them: PID-B makes the PID-REUSED references inoperative, ROOT-A fixes the privilege of the acceptance-time observation, and ROOT-B's reduction is not adopted. These readings are the frozen option definitions (§3.6; §5.6), not new wording. Frozen §2 items 2 and 6 tie the PID exception to §3.2 eligibility, so the PID-B narrowing carries to them by reference |
| 5 | Weakening statement (§2.1) and risks (§9) present and consistent with the adopted clauses (§11.2 bullet 2) | **PASS** | §2.1 names exactly the three adopted clauses (J2-A2-PID, J2-A2-REM (REM-ii), J2-A2-PEND) and the four scope-sufficiency provisions they except; its ROOT-B sentence is conditional ("if ROOT-B is selected") and does not apply. §9 item 1 (PID; no SAME-PROCESS risk offered), item 2 (REM-ii), item 3 (PEND; its ROOT-B clause does not apply under ROOT-A), item 4 (compound), and item 5 (C-ACQ race; separate later acceptance) match the selection, as do §3.6 (PID-B risk = §2.2 (i)) and §4.6 (REM-ii risk = §2.2 (ii)). Every adopted clause has a disclosed risk; no disclosed risk depends on an unselected option |
| 6 | E-J6 preserved for known inaccessible or incomplete paths (§11.2 bullet 3; §2 item 17; §4.4) | **PASS** | §2 item 17 is UNCHANGED. §4.4 keeps denied, timed-out, cap-hit, truncated, and incompletely listed paths BLOCKING and ineligible for REM-ii. REM-ii condition (1) requires no DENIED / TIMEOUT / cap-hit / incompletely listed result, and any indicated path stays U-1 under E-J6. §5.4: "Known inaccessible paths remain E-J6 regardless of this clause." §3.2 failure classes never become accepted uncertainty. §16.5 lists these as route stops. No selection touches E-J6 |
| 7 | PID-S unavailable; PID-REUSED ineligible under PID-B | **PASS** | PID-S is BLOCKED / NOT SELECTABLE (§3.6; §8.1; §8.4), not recorded at §16.2, and preserved as blocked (§16.7). PID-B (§3.6) admits PID-GONE only; §16.2, §16.4, and §16.5 state that PID-REUSED has no treatment; board `ROUTE_STATE` agrees |
| 8 | ROOT-B's additional threshold reduction not adopted | **PASS** | §16.2 lists ROOT-B as not selected. §16.4 ROOT-A row: "The ROOT-B additional threshold reduction (§5.1 item 1, second half) is **not** adopted." §16.4 cross-cutting row limits §5.1 item 1 to its ROOT-A branch. Under ROOT-A, root-owned covered locations require a separately authorized privileged acceptance-time read (§5.6); none is granted |
| 9 | Historical records and locked predecessor bodies preserved; no A1 / A2 re-adoption (§11.2 bullet 4) | **PASS** | §§0–15 byte-preserved (§17.1). The header **Step:** line and the C1 / C2 "NOTHING ADOPTED" statements remain as historical text (§16.7). No stage-start of AMENDMENT-01, JOURNAL-01, SEARCH-01, U1-RESOLUTION-01, SCOPE-01, J2-SCOPE-01, INVENTORY-01, ACQUISITION-01, POLICY-01, BASELINE-GOV-01, CAPTURE-01, or VERIFY-01 differs from HEAD. The PRIV-INSPECTION-01 stage-start including its uncommitted §17 is unchanged at blob `b711d3a6af74ec3eb40c32a52840967eccb911ba`. Backlog hunks are confined to PRIV-INSPECTION-01 (inherited) and this task. A1 / A2 appear only as preserved (§0 item 6; §16.8 item 8) |
| 10 | Adoption satisfies nothing for this host | **PASS** | §8.2 bullet 3; Keith's acknowledgement (§16.6); §16.8 items 1–3; board `J2_RULE` "satisfies nothing for (H, A)"; P5-JOURNAL-01 §4.2 item 1 |
| 11 | All six §8.5 route preconditions remain unsatisfied | **PASS** | (1) P-HOSTBIND: no hostname source is on record (§3.2 E2; §16.8 item 7). (2) FG-1…FG-8: no mechanism task is registered and nothing is built or tested (board `MECHANISM=UNVERIFIED CANDIDATE`; `SUCCESSOR_REGISTERED=NO`; this task is the last registered backlog entry). (3) Quoted SEARCH-01 stderr paths: none quoted; B2 not performed; evidence-package reads are zero in every ledger. (4) Separate authorizations for B3, B4, B5 tiers, B6 ROOT-A, and acceptance: none recorded. (5) §6 D / T compliance: unresolved. (6) Tier 2 status-evidence command class: none frozen |
| 12 | Inspection-mechanism host use remains BLOCKED | **PASS** | §6.3 mechanism-readiness rule; §6.4; §8.3 D / T row; §16.5 ROOT-A dependency (B6 is blocked exactly as B4 is) |
| 13 | PRIV-INSPECTION-01 remains NOT LOCKED | **PASS** | Its canonical backlog Status reads "task NOT LOCKED"; it is absent from sidecar `lockedTaskIds`; its §17 proposal remains PROPOSED — NOT ADOPTED; Step 4 does not touch it |
| 14 | `HOST_CLEAN=NO`, `P7_ACCEPTED=NO`, `REOPEN_GATE=UNSATISFIED`, EXEC-01C6A `startCondition=NOT_READY` unchanged | **PASS** | This task's board fields read NO / NO / UNSATISFIED / NOT_READY. Every `*_HOST_CLEAN`, `*_P7_ACCEPTED`, `*_REOPEN_GATE`, and `*_PARENT_START_CONDITION` field above the LEGACY / FROZEN boundary reads NO / UNSATISFIED / NOT_READY. Sidecar AGENT-PLATFORM-EXEC-01C6A has `startCondition=NOT_READY`. Step 4 writes none of these |
| 15 | Lock = decision record only; creates no execution, inspection, acceptance, or registration authority (§11.2 bullet 5) | **PASS** | Applied in §17.4 |

No criterion failed. No finding required a correction to the adopted wording or the selections.

### 17.3 §11.2 checklist (verified here; frozen §11.2 bullets not rewritten)

- [x] Selections faithfully recorded against §8; completeness and incompatibility rules applied (rows 1–3)
- [x] Weakening statement (§2.1) and risks (§9) present and consistent with adopted clauses (row 5)
- [x] E-J6 preservation (§2 item 17; §4.4) verified (row 6)
- [x] No A1 / A2 re-adoption; no edit to AMENDMENT-01, JOURNAL-01, SEARCH-01, U1-RESOLUTION-01, PRIV-INSPECTION-01 (incl. uncommitted §17), SCOPE-01, J2-SCOPE-01, INVENTORY-01, ACQUISITION-01, POLICY-01, BASELINE-GOV-01, CAPTURE-01, VERIFY-01 (row 9)
- [x] Lock = decision record only; creates no execution, inspection, acceptance, or registration authority (§17.4)

### 17.4 Lock definition

This task — PM2-RECOVERY-P5-J2-AMENDMENT-02 — is **COMPLETE AND LOCKED**.

**Lock scope:** the decision record only — the C2 freeze (§§0–15; SHA-256 `8e191e7267d7369fb05ba45b855cb7c508b091e6002e0579ca8c3ce435e8f8d6`) and Keith's Step 3 selection (§16) of D-PID-GONE = PID-B, D-PID-SAME = PID-S-REFUSE, D-REM = REM-ii, D-PEND = PEND-ADOPT + AGE-A + ROOT-A, verified as faithfully and consistently recorded. The adopted prospective J-2 amendment clauses are J2-A2-PID (PID-B), J2-A2-REM (REM-ii), and J2-A2-PEND (AGE-A, ROOT-A), as frozen.

The lock confirms:

1. Keith explicitly made the four selections at Step 3. PID-S was not selected and remains BLOCKED / NOT SELECTABLE. PID-REUSED is not eligible. ROOT-B's threshold reduction is not adopted.
2. The adopted wording is the frozen C2 text without alteration.
3. The decision record is internally consistent, and its weakening statement and disclosed risks match the selection.
4. E-J6 and every BLOCKING branch are preserved.

**This lock closes a decision record only and creates no additional authority.** It does NOT:

- satisfy any adopted clause for (H, A), establish any absence, accept any residual, or accept any attestation;
- approve any host-specific scope, perform U-2(e), or establish P5;
- satisfy any §8.5 route precondition (1)–(6), supply a hostname (P-HOSTBIND), or resolve §6 D / T compliance; inspection-mechanism host use remains BLOCKED;
- authorize inspection, search, privilege, `sudo`, SSH, AWS, PM2, staging, transfer, acquisition, C-ACQ, B(H), verifier live use, recovery, canary, or any runtime activity;
- register or authorize B3, B4, or any successor, or grant implementation or test authority;
- lock, reopen, or edit PRIV-INSPECTION-01 or its uncommitted §17 proposal;
- change `HOST_CLEAN=NO`, `P7_ACCEPTED=NO`, reopen gate UNSATISFIED, host UNCLEAN / HOLD, or EXEC-01C6A `startCondition=NOT_READY`;
- alter BASELINE-GOV-01 A1 / A2, ACQUISITION-01 C-ADOPT selections, or any locked predecessor body, or edit the sidecar, `lockedTaskIds`, the mutex catalog, or repository `SATURATION_PROOF.json`;
- convert testimony ("probably no, but uncertain") or treat D2b as authority for any J-2 judgment.

Route state is unchanged: the Option B route cannot reach attestation acceptance now (§16.5).

### 17.5 Activity ledger (Step 4) and validator proof

LIVE=0, SSH=0, STAGING lease=0, AWS=0, sudo=0, host connection=0, host inspection=0, search=0, evidence-package read=0, PM2=0, Docker=0, Postgres=0, Redis=0, runtime=0, provider=0, credits=0, fixtures run=0, privilege grant=0, transfer=0, acquisition=0, U-2(e)=0, J2-A2 acceptance=0, attestation acceptance=0, P5=0, C-ACQ=0, HOST_CLEAN=0, P7=0, recovery=0, reopen=0, successor registration=0, implementation=0, tests=0 (apart from the lane-capacity validator, with its proof written to `$env:TEMP`), subagents=0, frozen wording altered=0, selections altered=0, predecessor body edits=0, PRIV-INSPECTION-01 / §17 edits=0, sidecar / lockedTaskIds / mutex-catalog / validator-source edits=0, other-task record edits=0, SATURATION_PROOF.json not mutated, Git stage / commit / push / stash / reset / restore / clean=0. Files written under transient GOVERNANCE: this stage-start (header "Step 4 record" line plus §17, insertions only), `TASKS.md` (this task's board records), `TASKS_BACKLOG_FULL.md` (this task's canonical body). GOVERNANCE released UNOWNED. STAGING not acquired.

Lane-capacity validator, run on the end state after the board and backlog lock writes (`scripts/validate-lane-capacity.ps1 -ProofPath $env:TEMP\PM2-RECOVERY-P5-J2-AMENDMENT-02-step4-saturation-proof.json`): result PASS, exit 0, idleCode `NO_PAIRWISE_ADMISSIBLE_CANDIDATE`, admissibleForcingCandidates `[]`, headSha `7a5f65fbf348e23a45f0f28a61efb34f66bee7e2`, `workingTreeDirty=true`. Proof SHA-256 `b6aa85ced446b90d3668ff3f6fa20014a064c56cc1a71c47323c5c36866ec97d`, 2496 bytes, byte-identical to the Step 1–2, C1, C2 and Step 3 proofs because the inputs are the same (occupancy hash `942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d`; sidecar `271eaedae340c9a06c9c835c103bc9566d66544aeb0c946b7c9c3b95583bcc42`; mutex catalog `64232fa4b478f75a4b5542342d1bfa868398338a7b60cd86233552dd64c8d4df`). Inherited `docs/control-plane/SATURATION_PROOF.json` blob `50ce410efe547a7e24f06ef75b9410916d5dae8a` unchanged.

**Status: PM2-RECOVERY-P5-J2-AMENDMENT-02 — COMPLETE AND LOCKED — 2026-10-01 at baseline `7a5f65fbf348e23a45f0f28a61efb34f66bee7e2`. Step 4 independent verification PASS. Lock = decision record only (D-PID-GONE = PID-B; D-PID-SAME = PID-S-REFUSE; D-REM = REM-ii; D-PEND = PEND-ADOPT + AGE-A + ROOT-A, adopted as frozen). Nothing satisfied for (H, A); §8.5 route preconditions (1)–(6) unsatisfied; inspection-mechanism host use BLOCKED; PRIV-INSPECTION-01 NOT LOCKED; no successor registered.**
