# PM2-RECOVERY-P5-J2-AMENDMENT-01 — Stage-Start / Step 2 Decision-Options Freeze

**Task:** PM2-RECOVERY-P5-J2-AMENDMENT-01 — Assess prospective J-2 amendment for historical uncertainty treatment
**Nature:** GOVERNANCE / DECISION (4-step). No implementation lane. No sidecar candidate.
**Step:** 4 of 4 — independent verification and lock (this record). Step 2 freeze §§0–9 preserved as committed at `2b334ec7492f18fff332946c67dd41b4e8721a25`. Step 3 adoption §10 preserved as committed at `a3398de093941a0e68c8bc89149329eaf5b68865`.
**Step 2 date:** 2026-09-29
**Step 2 HEAD at window open:** `0afbe3704a7d3fe4e0a0dfbaad0a46f6f196fcff` (branch main; working tree clean; matches the expected baseline)
**Step 3 date:** 2026-09-29
**Step 3 HEAD at window open:** `2b334ec7492f18fff332946c67dd41b4e8721a25` (branch main; index empty; expected dirtiness `docs/control-plane/SATURATION_PROOF.json` only, preserved unchanged; matches the expected baseline)
**Step 4 date:** 2026-09-29
**Step 4 HEAD at window open:** `a3398de093941a0e68c8bc89149329eaf5b68865` (branch main; index empty; expected inherited dirtiness `docs/control-plane/SATURATION_PROOF.json` only, preserved unchanged; matches the expected baseline)
**Registration:** `TASKS_BACKLOG_FULL.md` § PM2-RECOVERY-P5-J2-AMENDMENT-01 (Step 1 COMPLETE at HEAD `ba8b0a4d848759e68c042f89ae2a369632273ca6`)
**Dependencies:** PM2-RECOVERY-P5-JOURNAL-01 (COMPLETE AND LOCKED 2026-09-23; J-2 adopted; §0.8 / §4.1 amendment lifecycle), PM2-RECOVERY-P5-SCOPE-01 (COMPLETE AND LOCKED 2026-09-29; BLOCKED scope decision for (H, A)), PM2-RECOVERY-P5-INVENTORY-01 (COMPLETE AND LOCKED 2026-09-28; bounded inventory finding only). PM2-RECOVERY-ACQUISITION-01, PM2-RECOVERY-POLICY-01, PM2-RECOVERY-BASELINE-GOV-01, and PM2-RECOVERY-CAPTURE-01 remain COMPLETE AND LOCKED and are not reopened.
**Authorization:** Keith authorized **Step 2 only** at baseline `0afbe3704a7d3fe4e0a0dfbaad0a46f6f196fcff`. Keith later authorized **Step 3 only** at baseline `2b334ec7492f18fff332946c67dd41b4e8721a25` (see §10). Keith later authorized **Step 4 only** at baseline `a3398de093941a0e68c8bc89149329eaf5b68865` (see §11).
**Acceptance object:** A frozen set of decision options (retain J-2 unchanged, propose a bounded prospective amendment, or leave unresolved) with their evidence requirements, compatibility checks, and practical consequences, for Keith's explicit selection at a separately authorized Step 3.
**Step 2 correction #1 (C1):** 2026-09-29 — documentation-only, localized. (1) Search sequencing: Option B rewritten so current-host scope approval precedes any search; U-2 residual-uncertainty acceptance is attestation-time only. (2) Amendment scope: "exactly one element modified" removed; Option B is a primary replacement of the "Unknowns that prevent acceptance" element, plus consequential historical-territory coverage justification through U-2 disclosure, plus a U-2-specific additional invalidation trigger; current-host coverage justification remains "specific facts, not assumptions." (3) E-J5: existing validity/invalidation regime is preserved; U-2 acceptances carry one additional invalidation trigger. Nothing adopted. Steps 3–4 remain NOT AUTHORIZED. SCOPE-01 BLOCKED remains valid under unamended J-2. C1 has **not** passed independent review.
**Step 2 correction #2 (C2):** 2026-09-29 — documentation-only, localized. Reconciles U-1/U-2 so current relevant locations remain U-1 when access is denied, privileges are unavailable, traversal fails, or current existence/location is uncertain; distinguishes unavailable historical records from unresolved present-day coverage; dormant existing paths, surviving directories of removed accounts, and unresolved current relocation destinations cannot be waived through U-2 solely because their origin is historical; E-J6 blocking preserved; sequence preserved (fact-supported proposal and Keith approval before search; search under approved scope; all U-1 resolved before any U-2(e)); decision-table cases 6–7 added. Nothing adopted. Steps 3–4 remain NOT AUTHORIZED. This C2 record does **not** claim independent review PASS.
**Step 3 record:** 2026-09-29 — Keith selected Option B as frozen in commit `2b334ec7492f18fff332946c67dd41b4e8721a25` (see §10). Step 4 remains NOT AUTHORIZED. Task NOT LOCKED.
**Step 4 record:** 2026-09-29 — independent verification PASS; task COMPLETE AND LOCKED. Lock verifies the adopted amendment and faithful decision recording only; it creates no additional authority. Historical Step 3 record above preserved.

---

## §0. Invariants preserved by this freeze

1. **Predecessor bodies unchanged.** P5-JOURNAL-01, P5-SCOPE-01, P5-INVENTORY-01, ACQUISITION-01, POLICY-01, BASELINE-GOV-01, and CAPTURE-01 stage-start documents and backlog bodies remain physically unchanged. This freeze cites locked text; it does not edit any predecessor document file.
2. **J-2 unchanged by this freeze.** The adopted J-2 scope-approval gate, attestation criteria 1–6, and E-J5 validity/invalidation (P5-JOURNAL-01 §2 / §7.2) are applied as worded in this analysis. This freeze proposes an amendment option (Option B) but **adopts nothing**. J-2 as locked is the current binding rule unless and until a separately authorized amendment is adopted.
3. **SCOPE-01 BLOCKED preserved.** The locked P5-SCOPE-01 BLOCKED decision for (H = aisandbox-staging, A = {aisandbox-api-gateway, aisandbox-ai-service}) was valid under the rule applied at that time (adopted J-2 without amendment) and is not retroactively altered, weakened, or overridden by this freeze. Any future scope decision for (H, A) requires its own authorization.
4. **No host condition established.** No host, vault, journal, or recovery material was inspected. No SSH, AWS, sudo, STAGING lease, PM2, Docker, or runtime. No absence inferred from any record.
5. **Testimony preserved.** Keith's testimony on prior recovery work remains "probably no, but uncertain" — recorded as testimony only; never converted into confirmed absence or confirmed presence. No stronger testimony solicited or fabricated.
6. **D2b = ACCEPTANCE preserved** as the threshold for the later A1-F clause (b) H2 attestation (BASELINE-GOV-01 §2.5, §14.2). It is not a J-2 element and is not a waiver of any J-2 unknown.
7. **No decision selected.** Keith's Step 3 selection (Option A, B, or C) is not selected, predicted, or recommended. The task is not LOCKED.
8. **EXEC-01C6A startCondition=NOT_READY; HOST_CLEAN=NO; P7_ACCEPTED=NO; REOPEN_GATE=UNSATISFIED; E1 UNREGISTERED and independently binding (ACQUISITION-01 §2.1); P5 process-table component unchanged.** All unchanged.
9. **Lane 3 DISABLED; INVITE-01 PARKED / UNAUTHORIZED / PROHIBITED.** Unchanged. Sidecar and `lockedTaskIds` unchanged.
10. **Amendment lifecycle.** This freeze proposes decision options but **adopts nothing**. A later explicit Keith selection at Step 3 may adopt a precisely scoped prospective amendment (Option B), or may retain J-2 unchanged (Option A), or may leave the question unresolved (Option C). Regardless of which option is adopted, locked predecessor document bodies remain physically unchanged and no host-specific satisfaction or operational permission follows from adoption alone.

---

## §1. Controlling authority and the problem

### 1.1 The adopted J-2 rule (P5-JOURNAL-01 §2 / §7.2 — LOCKED)

For a first acquisition under A1 first-run prerequisites where clause (a) is satisfied (no H1 item for (H, A)):

- **Component 1 (process-table):** Unchanged. Applies at assessment times per P5-JOURNAL-01 §1.1.
- **Component 2 (journal cross-check):** Replaced by a recovery-material absence attestation under a prospective scope-approval gate (criteria 1–6).

The scope-approval gate requires (quoted from P5-JOURNAL-01 §2):

| Element | Locked wording |
|---|---|
| **Scope proposal** | "…proposes the search scope for (H, A), identifying: filesystem paths to examine, operator accounts covered, PM2 home directories, named apps, and the basis for believing these locations are the relevant ones" |
| **Scope approval** | "Keith approves the proposed scope before the search is performed. Approval records: the approved paths/accounts/homes, the evidence or reasoning justifying that these locations cover the relevant territory for (H, A), and any known limitations" |
| **Coverage justification** | "The scope must cover every location where prior 01C6A-class recovery material could exist for (H, A) based on known operator history, known PM2 configurations, and known deployment patterns. The justification must cite specific facts, not assumptions" |
| **Unknowns that prevent acceptance** | "Unknown operator accounts on H; unknown PM2 home directories; unexplored filesystem areas where material could exist; gaps in operator activity history that could conceal prior recovery work; any pending operation that could produce material before attestation acceptance. Any of these leaves the scope insufficient and the attestation cannot be accepted" |
| **Incomplete coverage** | "If approved scope is later found to omit a relevant location, the attestation is invalidated. Approval alone cannot establish factual absence of material — the search must actually find nothing in an adequate scope" |

### 1.2 The SCOPE-01 blocking finding (P5-SCOPE-01 §4.1, §10.2 — LOCKED)

SCOPE-01 found J-2 scope approval BLOCKED on the available evidence regardless of the proposed current-host observations. Three historical / operator-history gaps engage J-2 "Unknowns that prevent acceptance" elements:

| Gap | Description | J-2 element engaged |
|---|---|---|
| **GAP-7** | Operator-history gap that could conceal prior 01C6A-class recovery work. The tooling takes operator-chosen `--vault` / `--workdir` with no default (R4). Unrecorded operator activity on H is UNKNOWN and unknowable from the repository (Rule B-1, §6). Keith's testimony is "probably no, but uncertain" — admissible with limited weight, insufficient on the present record. No other historical evidence on the record. | "gaps in operator activity history that could conceal prior recovery work"; coverage justification "specific facts, not assumptions" |
| **GAP-6** | Historical / removed operator accounts on H not visible in current `passwd` enumeration. Current accounts known; past accounts and their possible leftover directories are not. | "unknown operator accounts on H"; "gaps in operator activity history" |
| **GAP-5** | Dormant or deleted custom `PM2_HOME` locations and non-standard paths. The proposed current-state observations do not reconstruct deleted locations; only historical evidence could bear on them. | "unexplored filesystem areas where material could exist" |

Additionally, current-host residuals (GAP-1 through GAP-4) remain unresolved but their resolution would not lift the block established by the historical gaps.

### 1.3 The specific problem this amendment addresses

The "Unknowns that prevent acceptance" element of J-2's scope-approval gate treats each listed unknown category as leaving the scope **insufficient** and the attestation **cannot be accepted**. For a host where:

- the operator's testimony is uncertain ("probably no, but uncertain"),
- no other historical evidence (retained deployment/invocation/configuration/audit/backup records) is on the record,
- the repository cannot record unrecorded sessions (Rule B-1),

the "gaps in operator activity history that could conceal prior recovery work" unknown **cannot be closed** by any current-host observation. The coverage-justification element compounds this: the justification must cite "specific facts, not assumptions" about "known operator history," but the operator history for the relevant territory (operator-chosen vault/workdir locations) is unknown and unknowable from the repository.

This is a structural impasse under the current J-2 wording. The SCOPE-01 finding distinguished this from impossibility under all future evidence (§4.3): relevant new historical evidence could change the analysis. But no such evidence is on the record, and the J-2 gate provides no mechanism for accepting scope approval with explicitly disclosed residual historical uncertainty.

### 1.4 The amendment lifecycle (P5-JOURNAL-01 §0.8 / §4.1)

P5-JOURNAL-01 §0.8 established the amendment lifecycle: Step 2 proposes options but adopts nothing; Step 3 is Keith's explicit selection constituting adoption; Step 4 is independent verification and lock. Locked predecessor document bodies remain physically unchanged regardless of selection.

P5-JOURNAL-01 §4.1 governs the five stages: proposal, adoption, application (host-specific evidence), P5 resolution, and C-ACQ.

This task operates within that lifecycle. The amendment (Option B) is a precisely scoped prospective change to how J-2 treats historical uncertainty — the same kind of governance decision container that P5-JOURNAL-01 itself was.

---

## §2. Decision options

All options below are UNADOPTED. Keith selects one at Step 3 under separate authorization. The controlling reasoning is presented with each option.

### Option A: Retain J-2 unchanged

**Category:** No amendment. J-2 as adopted by P5-JOURNAL-01 §7.2 remains the binding rule without modification.

**Practical consequence:** The SCOPE-01 BLOCKED finding stands. For any (H, A) where the operator-history gap (GAP-7), historical/removed accounts (GAP-6), or dormant/deleted custom paths (GAP-5) cannot be closed by historical evidence, J-2 scope approval remains blocked. C-ACQ remains blocked on the unresolved P5 journal-applicability dependency. The only paths forward are SCOPE-01 P-B (relevant new historical evidence under separate authorization) or SCOPE-01 P-D (a separately authorized J-2 amendment — which is this task).

**Required evidence:** None beyond what J-2 already requires. The existing J-2 rule continues to apply as worded.

**Remaining uncertainty:** The structural impasse described in §1.3 persists. If no historical evidence can be obtained to close the gaps, J-2 scope approval for (H, A) is permanently blocked in practice.

**Reasons to accept:** Preserves the strongest evidence standard. Does not introduce any relaxation that could permit inadequate searches. No risk of accepting residual uncertainty that later proves to conceal actual recovery material.

**Reasons to reject:** If the only host-specific evidence that could close the gaps (definite operator testimony, retained records) does not exist or cannot be obtained, the requirement becomes permanently unsatisfiable — not because recovery material exists, but because the evidence standard cannot be met. This may be disproportionate to the actual risk for a host where no H1 material has been discovered by any means and the operator's own recollection, while uncertain, is "probably no."

### Option B: Bounded prospective amendment for historical uncertainty treatment

**Category:** Proposed amendment to J-2's scope-approval gate under P5-JOURNAL-01 §0.8 / §4.1. This goes beyond what the current locked J-2 text provides and requires explicit Keith adoption at Step 3.

#### B.1 What Option B changes

Option B is **not** a claim that exactly one J-2 element is modified. It:

- **primarily** replaces the J-2 **"Unknowns that prevent acceptance"** element (P5-JOURNAL-01 §2 Option J-2) with the U-1 / U-2 distinction and the application sequence below;
- **consequentially** treats **historical-territory** coverage justification through U-2 disclosure (it does not require specific facts about unknowable history);
- **adds** a U-2-specific additional invalidation trigger carried by U-2 acceptances.

**Current-host coverage justification is preserved unchanged:** the justification for current-host territory must still cite **specific facts, not assumptions**.

The current locked "Unknowns that prevent acceptance" wording is:

> "Unknown operator accounts on H; unknown PM2 home directories; unexplored filesystem areas where material could exist; gaps in operator activity history that could conceal prior recovery work; any pending operation that could produce material before attestation acceptance. Any of these leaves the scope insufficient and the attestation cannot be accepted."

**Proposed replacement wording:**

> "The following categories of unknowns are evaluated when determining whether a current-host search scope may be approved and whether a later attestation can be accepted. A search is not performed before Keith approves the current-host scope.
>
> **Application sequence (mandatory; search never precedes scope approval):**
> (1) The scope proposal identifies U-1 current-host unknowns and U-2 historical unknowns.
> (2) Keith may approve the current-host scope before any search, with U-2 historical uncertainties disclosed as unresolved. That approval is not U-2(e) acceptance and does not clear, close, or resolve U-2 unknowns.
> (3) The bounded current-host search is then performed under that approved scope.
> (4) After the search, if no H1 / UNCLASSIFIED material is found within the approved scope and every U-1 unknown is resolved, Keith may explicitly accept the disclosed residual historical uncertainty at attestation time (U-2(e)). If those conditions are not met, the attestation cannot be accepted.
>
> **(U-1) Current-host unknowns (blocking at attestation):** Current relevant coverage on H, including: unknown operator accounts currently present on H; unknown PM2 home directories on H; unexplored filesystem areas on H where material could currently exist; any pending operation that could produce material before attestation acceptance. A current relevant location **does not cease to be a U-1 unknown** merely because access is denied, privileges are unavailable, traversal fails, the search is incomplete, or the location's current existence or path is uncertain. Inaccessibility, corruption, or incomplete search is **E-J6** (P5-JOURNAL-01 §3.2): C-ACQ is blocked; inaccessible evidence cannot satisfy the journal cross-check under any option, including this Option B. This freeze does not authorize a new search, a new privilege class, or sudo. U-1 unknowns identified in the proposal do not by themselves forbid Keith from approving the current-host search scope. Any U-1 unknown that remains after the approved search leaves the attestation insufficient; the attestation cannot be accepted. U-2(e) cannot be invoked while any U-1 unknown remains.
>
> **Classification (unavailable historical records vs unresolved present-day coverage):** If a candidate location may still exist on H now, it is U-1 even if its origin is historical. That includes dormant existing paths, surviving directories of removed accounts, and unresolved current relocation destinations. Those cannot be waived through U-2 solely because their origin is historical. U-2 covers only (i) gaps in operator activity history and unavailable historical *records* (deployment / invocation / configuration / audit / backup records that are not on the present record), and (ii) locations established as no longer present on H (deleted, not dormant). Uncertainty about whether a location still exists is unresolved present-day coverage (U-1), not a U-2 historical unknown.
>
> **(U-2) Historical unknowns (disclosed at scope approval; eligible for disclosed-residual-uncertainty acceptance at attestation time only):** Gaps in operator activity history that could conceal prior recovery work; unavailable historical records of who had access and which vault/workdir paths were chosen; historically deleted locations that are established as no longer present on H. At scope-approval time these unknowns are disclosed as unresolved; they do not by themselves prevent approval of the current-host search scope. They are eligible for disclosed-residual-uncertainty acceptance **only after** the approved search, under the following conditions, all of which must hold:
>
> (a) Every current-host unknown in U-1 has been resolved after the approved search (no U-1 unknown remains). Unresolved present-day coverage, including inaccessible current paths, is not resolved by recategorizing it as U-2.
>
> (b) The current-host search — covering all U-1 current relevant locations (accounts, PM2 homes, and filesystem areas on H, whether or not they were accessible during the search) as approved by the scope-approval gate **before the search** — has been completed and has found no H1 material (no evidence of prior applicable recovery work) and no UNCLASSIFIED material within the approved scope. An incomplete, inaccessible, or privilege-blocked observation of a U-1 location does not satisfy this condition (E-J6). Condition (b) is an attestation-time requirement. It does not authorize or imply a search before scope approval, and it does not authorize a new search or privilege class.
>
> (c) Keith's testimony on prior recovery work is on the record and preserved as given; it is neither strengthened nor converted. The testimony is assessed for its basis, scope, and consistency with other evidence. Testimony alone, regardless of its content or definiteness, does not close a historical unknown or establish factual absence. It is one admissible input to Keith's acceptance judgment.
>
> (d) A dated, host-specific disclosure statement for (H, A) is recorded, stating:
>   - which historical unknowns remain unresolved and why (citing the specific gap, its J-2 element, and the evidence that was sought but unavailable);
>   - that the current-host search found no H1 material within the approved scope;
>   - that operator testimony is on the record with its stated uncertainty;
>   - that acceptance does not establish factual absence of prior recovery work outside the searched scope or before the observable period;
>   - that acceptance does not clear, close, or retroactively resolve the disclosed historical unknowns.
>
> (e) Keith explicitly accepts the disclosed residual historical uncertainty for (H, A) at attestation time. This acceptance:
>   - permits the attestation to be accepted for (H, A) with the disclosed historical unknowns recorded;
>   - does NOT substitute for, reopen, or replace the prior current-host scope approval;
>   - does NOT establish that no prior recovery work occurred;
>   - does NOT close, resolve, or remove the disclosed historical unknowns;
>   - does NOT claim factual absence of material outside the searched scope;
>   - does NOT weaken the current-host search requirement (U-1 must be fully resolved after the approved search);
>   - does NOT exempt the attestation from the existing E-J5 validity/invalidation regime or from J-2 criteria 1–6;
>   - does NOT change H0/H1/UNCLASSIFIED/H2 classifications or Rule B-1;
>   - remains subject to the existing E-J5 validity/invalidation regime (material discovery, new activity on (H, A), scope inadequacy, Keith revocation). U-2 acceptances carry one additional invalidation trigger: discovery of any historical evidence (retained records, testimony, audit logs) that materially changes the basis for the acceptance.
>
> If conditions (a)–(e) cannot all be met, the historical unknowns remain blocking under U-2 and the attestation cannot be accepted — the same outcome as under the unamended J-2."

#### B.2 Provisions that remain binding

The following J-2 provisions remain binding as locked in P5-JOURNAL-01 §2 / §7.2, except where B.1 states a primary replacement, a consequential historical-territory treatment, or a U-2-specific additional invalidation trigger:

1. **Scope proposal element** — remains: the proposal identifies filesystem paths, operator accounts, PM2 home directories, named apps, and the basis for believing these locations are relevant. Under Option B the proposal must additionally identify U-1 current-host unknowns and U-2 historical unknowns (application sequence step 1).
2. **Scope approval element** — remains: Keith approves the proposed scope **before the search is performed**. Option B does not authorize a search before that approval. Keith may approve the **current-host** scope with U-2 historical uncertainties disclosed as unresolved; that approval is not U-2(e) acceptance.
3. **Coverage justification for current-host territory** — unchanged: must cite **specific facts, not assumptions**.
4. **Coverage justification for historical territory** — consequential treatment under Option B: addressed through U-2 disclosure rather than requiring specific facts about unknowable history. This is stated here; it is not an implicit silent rewrite of another contract.
5. **Incomplete coverage element** — unchanged.
6. **Attestation criteria 1–6** — unchanged.
7. **E-J5** — the existing E-J5 validity/invalidation regime is preserved. U-2 acceptances carry one additional invalidation trigger specified in U-2(e) and §B.7.
8. **Component 1 (process-table)** — unchanged.
9. **Conditional inapplicability vs completed cross-check distinction** — unchanged.
10. **E1 independence** — E1 (vault registry) remains independently required by ACQUISITION-01 §2.1.
11. **E-J6** — preserved: inaccessible, corrupted, or incomplete evidence cannot satisfy the journal cross-check under any option, including Option B. Option B does not recategorize E-J6 conditions as U-2 historical unknowns.

#### B.3 Distinctions preserved

| Distinction | Treatment under Option B |
|---|---|
| **Historical gaps vs current observable gaps** | U-1 unknowns remaining after the approved search block attestation and therefore block U-2(e) acceptance. U-1 unknowns identified in the proposal do not forbid current-host scope approval before the search. The amendment cannot be used to bypass current-host search requirements or to search before scope approval. |
| **Unavailable historical records vs unresolved present-day coverage** | Unavailable historical *records* (who had access; which vault/workdir was chosen; activity not in any retained record) may be U-2. Unresolved present-day coverage — including inaccessible current paths, dormant existing paths, surviving directories of removed accounts, and unresolved current relocation destinations — remains U-1 even if the location's origin is historical. Access denied, privileges unavailable, traversal failure, or uncertain current existence/location does not convert U-1 into U-2. E-J6 remains blocking. |
| **PID 1177465's unresolved historical identity** | PID 1177465 was observed by P5-INVENTORY-01 as a pgrep match with `ps` rc 1 (cause unknown). The historical finding is retained as unresolved with the INVENTORY-01 lock. Under U-1, any currently running process matching PM2 daemon heuristics is a current-host unknown to be resolved. The historical PID 1177465 observation is a separate artifact: fresh observations cannot retroactively establish its identity or explain the earlier `ps` failure. If re-observation shows no matching PID, this does not establish that PID 1177465 was not a PM2 daemon; the historical finding contributes to the GAP-7 historical uncertainty and is addressed through U-2's disclosure mechanism, not cleared through U-1. |
| **Acceptance of disclosed residual uncertainty vs proof of absence** | U-2(e) explicitly states that acceptance does NOT establish factual absence. It permits proceeding with a search that found nothing in an adequate current scope, while disclosing that historical territory could not be fully searched. This is weaker than the unamended J-2 (which requires the historical territory to be searchable) but stronger than ignoring the uncertainty. |

#### B.4 Fact-supported scope proposal requirements

Under Option B, the scope proposal for (H, A) must still identify:

- **Filesystem paths to examine** — all current relevant directories where 01C6A-class recovery material could exist, including known PM2 home directories, account home directories, dormant existing paths, surviving directories of removed accounts if those directories may still exist, unresolved current relocation destinations, and any path where the tooling's `--vault` or `--workdir` arguments could have been directed based on available evidence. Paths that are currently inaccessible, privilege-restricted, or of uncertain present existence remain in this list as U-1 unknowns; they are not omitted because they cannot presently be read.
- **Operator accounts covered** — all accounts currently present on H that could have been used for operator activity, identified from `passwd` enumeration and service configurations, plus any surviving home directories of removed accounts that may still exist on H (U-1). Unavailable historical *records* of past accounts (who had access, when) are U-2; leftover directories that may still exist are not.
- **PM2 home directories** — all current relevant PM2 home directories, including those identified by daemon process titles, systemd unit configurations, and `PM2_HOME` environment variables, whether or not they are currently accessible. Dormant existing `PM2_HOME` paths remain U-1. Deleted (established no longer present) custom homes may be U-2.
- **Named apps** — the specific PM2 application names for which the search is performed (for the present case: aisandbox-api-gateway, aisandbox-ai-service).

The scope proposal must additionally, under Option B (application sequence step 1):

- Identify U-1 current-host unknowns and U-2 historical unknowns, applying the classification in B.1: current relevant locations remain U-1 when access is denied, privileges are unavailable, traversal fails, or current existence/location is uncertain.
- State which U-2 historical unknowns (unavailable historical records; locations established as deleted / no longer present) cannot be resolved by the proposed current-host search and why, disclosing them as unresolved at scope-approval time. Do not list dormant existing paths, surviving leftover directories, or unresolved relocation destinations as U-2.
- State that current-host coverage justification cites specific facts, not assumptions, and that historical territory (U-2 only) is addressed through U-2 disclosure.

Keith may then approve that current-host scope **before any search** (application sequence step 2), with U-2 historical uncertainties remaining disclosed as unresolved. The search follows that approval (step 3). U-2(e) acceptance, if any, is attestation-time only (step 4).

#### B.5 What accepting residual uncertainty would and would not establish

**Would permit:**
- Keith to approve the current-host search scope with U-2 historical uncertainties disclosed as unresolved. That approval is not U-2(e) acceptance and does not authorize a search before approval.
- After that approved search, if no H1 / UNCLASSIFIED material is found and every U-1 unknown is resolved: Keith to accept the disclosed residual historical uncertainty at attestation time (U-2(e)).
- The recovery-material absence attestation (J-2 criteria 1–6) to proceed after those conditions, subject to its own requirements.
- If the attestation is accepted with no H1 material found: conditional inapplicability of the P5 journal cross-check under the amended J-2 for this acquisition (same conditional-inapplicability status as under unamended J-2, not a completed journal cross-check).

**Would NOT establish:**
- That no prior recovery work occurred on (H, A).
- That no recovery material exists outside the searched scope.
- That the disclosed historical unknowns are closed, resolved, or immaterial.
- Host-specific P5 satisfaction (requires the full attestation process separately).
- C-ACQ unblocking (requires all C-ACQ prerequisites independently).
- HOST_CLEAN, P7 acceptance, reopen gate satisfaction, or any operational authorization.
- Any change to H0/H1/UNCLASSIFIED/H2 classifications.
- Any change to Rule B-1 ("the repository shows no prior run" remains an H2 statement, not an H1 statement).

#### B.6 Subsequent bounded search and its outcomes

If Option B is adopted, Keith may approve a current-host scope **before any search**, with U-2 historical uncertainties disclosed as unresolved. The bounded search is then performed under that approved scope. It operates under the same J-2 attestation criteria 1–6 as unamended J-2. The outcomes are:

| Outcome | Treatment |
|---|---|
| **No material found within approved scope** | Attestation criteria 1–6 may be completed. Criterion 5 ("does not claim that no material exists outside the searched scope") remains binding. The disclosure statement (U-2(d)) records the historical unknowns. Keith's U-2(e) acceptance permits conditional inapplicability. |
| **H1 material discovered within scope** | J-2 criteria 4: classify as H1. The attestation is incomplete. The journal cross-check is unresolved. The first-run premise for (H, A) is false from discovery. All discovered items preserved under POLICY-01 §4.3 / §6.2. |
| **UNCLASSIFIED material discovered** | J-2 criteria 4: classify. The attestation is incomplete until classification. A1 clause (a) unsatisfied while any UNCLASSIFIED item stands. |
| **Material discovered outside approved scope** | Attestation invalidated under E-J5 (material discovery). Scope inadequacy discovered. U-2(e) acceptance invalidated. |
| **New activity after search** | J-2 criterion 6: new activity that could produce applicable material invalidates the attestation. U-2(e) acceptance invalidated. |
| **Pending operations** | U-1: any pending operation that could produce material before attestation acceptance blocks the attestation (same as unamended J-2). |
| **Inaccessible / incomplete current path (E-J6)** | **Blocks.** Access denied, privilege unavailable, traversal failure, corruption, or incomplete search of a current relevant location is E-J6. The location remains U-1. It cannot be recategorized as U-2. U-2(e) cannot be invoked. This freeze does not authorize a new search or privilege class. |
| **Dormant existing or surviving historical-origin path** | **Blocks attestation until covered as U-1.** A dormant existing `PM2_HOME`, a surviving directory of a removed account, or an unresolved current relocation destination remains U-1 even if its origin is historical. U-2 cannot waive unresolved present-day coverage. |

#### B.7 Validity period and revalidation triggers

The existing E-J5 validity/invalidation regime (P5-JOURNAL-01 §3.2) is preserved. U-2 acceptances carry one additional invalidation trigger:

- **U-2-specific additional invalidation trigger:** Discovery of historical evidence (retained records, testimony, audit logs, recovered access records) that materially changes the basis for the U-2(e) acceptance. "Materially changes" means: evidence that identifies previously unknown operator accounts that had access to H, or evidence of previously unknown operator activity on H involving PM2 or 01C6A-class tooling, or evidence that the searched scope was inadequate due to previously unknown deployment patterns.
- **Revalidation:** After invalidation, a new attestation requires a new current-host scope approval **before any new search**, a new search under that approval, and a new U-2(e) acceptance (if historical unknowns remain). The previous acceptance cannot be reinstated without a new process. Search is never performed before the new scope approval.

#### B.8 Compatibility with predecessor contracts

| Contract | Compatibility under Option B |
|---|---|
| **A1-F (BASELINE-GOV-01 §2.2)** | Compatible. A1-F clause (a) requires "No H1 item exists." Option B does not change the H1 definition, discovery rules, or the UNCLASSIFIED handling. If H1 material is found, the first-run premise is false regardless of Option B. A1-F clause (b) requires the H2 attestation under D2b = ACCEPTANCE. Option B does not change the H2 attestation requirement or threshold. The historical uncertainty disclosed under U-2 is a different instrument from the H2 attestation: U-2 discloses gaps in the evidence base for J-2's scope gate; H2 attests to gaps in the record of other operator activity for A1-F clause (b). The same factual uncertainty may be relevant to both, but they serve different gates with different consequences. |
| **H0/H1/H2 (BASELINE-GOV-01 §2.1)** | Compatible. Option B does not change H0/H1/H2/UNCLASSIFIED definitions or handling. U-2 acceptance is a J-2-scope-gate mechanism, not an H-classification mechanism. Discovery of H1 material defeats the first-run premise under A1-F regardless of U-2. |
| **Rule B-1 (BASELINE-GOV-01 §2.1)** | Compatible. "The repository shows no prior run" remains an H2 statement, not an H1 statement. Option B does not change Rule B-1. U-2 acceptance does not treat repository-absence as host-absence. |
| **D2b = ACCEPTANCE (BASELINE-GOV-01 §2.5 / §14.2)** | Compatible. D2b governs the threshold for the A1-F clause (b) H2 attestation. Option B governs the J-2 scope-approval gate's treatment of historical unknowns. These are separate instruments with separate gates. D2b is not a J-2 waiver (SCOPE-01 §4.4). U-2 acceptance is not a D2b judgment. |
| **ACQUISITION-01 §4.2 three-state framework** | Compatible. The three states remain: applicable journal evidence supplied, explicitly determined inapplicable, applicability/evidence unresolved → C-ACQ blocked. Option B provides a path from "unresolved" to "explicitly determined inapplicable" via the amended J-2 scope gate, but only when all the U-2 conditions are met and the attestation is complete. This is consistent with the "explicitly determined inapplicable" state requiring "a separately authorized determination, citing its controlling authority." |
| **P5 process-table component** | Compatible. Unchanged. Component 1 applies at assessment times regardless of Option B. |
| **E1 independence** | Compatible. E1 (vault registry) remains independently required by ACQUISITION-01 §2.1. Option B does not remove or modify the E1 requirement. |
| **SCOPE-01 BLOCKED decision** | Compatible. The SCOPE-01 BLOCKED decision was valid under the rule applied at that time (unamended J-2). Option B, if adopted, would create a new rule under which a future scope decision could be made with different evidence requirements. This does not retroactively alter the SCOPE-01 decision; it creates a basis for a new scope-decision task if Keith authorizes one. |

#### B.9 Dependencies on other contracts

Option B does **not** require changing any other locked contract. Specifically:

- It does not amend A1-F, A2, POLICY-01 P1–P8, or any ACQUISITION-01 provision.
- It does not amend BASELINE-GOV-01 H0/H1/H2/Rule B-1/D2b.
- It does not amend the P5 process-table component.
- It does not amend E-J1 through E-J7 evidence states or their blocking outcomes except as described in the replacement wording (U-1/U-2 distinction within the "Unknowns that prevent acceptance" element, plus the stated consequential historical-territory coverage treatment and the U-2-specific additional invalidation trigger). **E-J6 remains blocking.**
- The existing E-J5 validity/invalidation regime is preserved. U-2 acceptances carry one additional invalidation trigger (§B.7).

**No implicit amendment to another contract is required.**

#### B.10 Practical consequence

If adopted at Step 3 and the amended J-2 rule is applied to (H, A) under separate authorization:

1. A scope proposal identifies U-1 current-host unknowns (including residual GAP-1 through GAP-4 from SCOPE-01 as then standing, plus any dormant existing / surviving leftover / unresolved relocation destinations that may still exist on H) and U-2 historical unknowns (unavailable historical records; locations established as deleted / no longer present, as applicable), disclosing the latter as unresolved. Current relevant locations that cannot presently be read remain U-1.
2. Keith may approve the **current-host** scope **before any search**, with those U-2 historical uncertainties disclosed as unresolved. That approval is not U-2(e) acceptance. This freeze does not authorize a new search or privilege class.
3. The bounded current-host search is then performed under that approved scope. The search is not performed before scope approval.
4. After the search, if no H1 or UNCLASSIFIED material is found and every U-1 unknown is resolved, Keith may explicitly accept the disclosed residual historical uncertainty at attestation time (U-2(e)). If those conditions are not met — including any remaining inaccessible current path (E-J6) — the attestation cannot be accepted.
5. If the attestation is then accepted, the resulting conditional inapplicability would be recorded with the disclosed historical unknowns. The existing E-J5 validity/invalidation regime is preserved; U-2 acceptances carry the additional trigger in §B.7.

**Required evidence for Option B adoption itself:** Keith's explicit selection at Step 3 under the P5-JOURNAL-01 §0.8 / §4.1 amendment lifecycle. No host-specific evidence is required for adoption; host-specific evidence is required for application.

**Remaining uncertainty after adoption:** The amendment is contract text only. Whether any specific (H, A) can satisfy the amended rule depends on host-specific facts not determined by this freeze. The historical unknowns remain disclosed, not resolved.

**Amendment needed:** Yes — this is a change to the adopted J-2 rule. Explicit Keith adoption required at Step 3.

**Risk:** The amendment permits proceeding with searches where the historical evidence base is incomplete. If prior recovery work actually occurred and the searched scope happened not to contain the resulting material (because it was placed in a now-deleted location, under a now-removed account, or in an operator-chosen vault/workdir path that is unknown), the attestation would incorrectly find no material. The U-2(e) disclosure mitigates but does not eliminate this risk: the disclosure records that the uncertainty exists, but acceptance still permits proceeding.

### Option C: Leave the amendment question unresolved

**Category:** No determination made. The question of whether to amend J-2's treatment of historical uncertainty is deferred.

**Practical consequence:** J-2 remains unchanged (same as Option A). The SCOPE-01 BLOCKED finding stands. C-ACQ remains blocked. The SCOPE-01 P-B and P-D paths remain available under future separate authorization.

**Required evidence:** None. The question is deferred.

**Remaining uncertainty:** The structural impasse described in §1.3 persists, as does the question of whether it should be addressed.

**Reasons to accept:** Appropriate if Keith determines that more information, reflection, or a different approach is needed before deciding whether to amend J-2. No risk of premature relaxation.

**Reasons to reject:** Delays any progress on the P5 journal-applicability dependency indefinitely. The structural impasse does not resolve itself.

---

## §3. Decision table — proposed wording against concrete cases

This table tests Option B's proposed U-1/U-2 replacement wording against specific scenarios to verify document consistency. These are consistency checks against the proposed rule, not executed tests or host observations.

| # | Scenario | Outcome under Option B | Controlling clause |
|---|---|---|---|
| 1 | **Uncertain history with an otherwise justified current-host scope.** Current-host scope was approved **before** the search, with U-2 historical unknowns disclosed as unresolved. The approved search then resolves all U-1 unknowns (all current relevant accounts, PM2 homes, and filesystem areas covered, including any that required access; none remain inaccessible). No H1 or UNCLASSIFIED material found. Historical unknowns remaining are unavailable historical records and locations established as deleted / no longer present. Keith's testimony is "probably no, but uncertain." | **Permits consideration of U-2(e) at attestation time** only if every U-1 unknown is actually resolved. Current-host scope approval was not blocked by U-2 disclosure. After the search, conditions (a) through (d) can be satisfied. Keith's explicit U-2(e) acceptance is required. If Keith accepts, the attestation proceeds through criteria 1–6 with disclosed residual uncertainty. If Keith does not accept, the attestation cannot be accepted — same outcome as unamended J-2. Dormant existing paths or surviving leftover directories, if any remain unresolved, would still block (cases 6–7). | Application sequence steps 1–4; U-2 conditions (a)–(e); attestation criteria 1–6; existing E-J5 regime preserved; U-2 acceptances carry B.7 additional trigger |
| 2 | **Unresolved current PM2-home/access uncertainty.** `/root/.pm2` existence/contents unknown (GAP-1). Privileged observation not authorized or not completed. Access denied or privileges unavailable. | **Current-host scope approval may still be considered** if the proposal identifies GAP-1 as a U-1 unknown. **Attestation is blocked under U-1 and E-J6** if that unknown remains after the approved search. Access denial or unavailable privilege does **not** recategorize `/root/.pm2` as U-2. U-2(e) cannot be invoked. This freeze does not authorize a new search or privilege class. The search is not performed before scope approval. | Application sequence steps 1–4; U-1; E-J6 (P5-JOURNAL-01 §3.2) |
| 3 | **Newly discovered applicable recovery material within scope.** During the bounded search, an `overlay_commands.json` journal file or `pending_apps.json` is found. | **Blocks.** J-2 criteria 4 requires classification. If classified H1: first-run premise false for (H, A). The attestation is incomplete. The journal cross-check is not satisfied — an actual journal exists and must be cross-checked under E-J1. U-2 acceptance is irrelevant because H1 material was found within the searched scope. | J-2 criterion 4; A1-F clause (a); E-J1 |
| 4 | **New activity after a search.** After the search is completed and the attestation is drafted, a new PM2 operation occurs on (H, A) (e.g., a `pm2 restart --update-env` by any operator). | **Invalidates.** J-2 criterion 6: new activity that could produce applicable material invalidates the attestation. U-2(e) acceptance is also invalidated. The existing E-J5 validity/invalidation regime is preserved; U-2 acceptances carry the B.7 additional trigger as well. A new attestation requires a new current-host scope approval **before** any new search, then a new search and a new acceptance. | J-2 criterion 6; existing E-J5 invalidation regime; U-2(e) / B.7 additional trigger |
| 5 | **The permanently unresolved historical PID 1177465.** The INVENTORY-01 observation of PID 1177465 (pgrep matched, `ps` rc 1, cause unknown) is a historical artifact. Re-observation may or may not find a process at that PID number. | **Addressed through U-1 and U-2 together.** Current state: If re-observation finds a currently running process matching PM2 daemon heuristics at any PID, that is a U-1 current-host unknown to be resolved (identify its PM2 home, check for material). If no matching process is currently found, the current-host check is resolved for that observation. Historical state: The original PID 1177465 observation remains a historical artifact contributing to GAP-7. Fresh observations cannot retroactively establish its identity or explain the earlier `ps` failure. The historical finding is disclosed under U-2(d) as part of the operator-history gap. It is not "resolved" by re-observation — it is disclosed and included in Keith's U-2(e) acceptance judgment. | U-1 for current state; U-2(d) disclosure for historical artifact; U-2(e) acceptance judgment |
| 6 | **Inaccessible current path.** A current relevant location (e.g. `/root/.pm2`, a non-`/home` account home) cannot be read: access denied, privileges unavailable, or traversal fails. | **Blocks acceptance.** The location remains U-1. E-J6 applies. Unresolved present-day coverage cannot be waived through U-2. No new search or privilege is authorized by this freeze. | U-1 classification; E-J6; U-2(a)–(b) |
| 7 | **Surviving or dormant historical-origin path.** A custom `PM2_HOME` or removed-account home directory may still exist on H (dormant existing path, leftover directory, or unresolved relocation destination). Historical *records* of its creation are unavailable. | **Blocks acceptance until covered as U-1.** Historical origin does not recategorize a currently possibly-existing path as U-2. Only locations established as deleted / no longer present, plus unavailable historical records, are U-2. Unresolved current coverage blocks U-2(e). | B.1 classification rule; U-1; U-2 ineligibility for dormant/surviving paths |

**Consistency finding:** The proposed Option B wording produces outcomes consistent with its stated purpose for these scenarios. These are document consistency checks, not executed tests or host observations. Scenario 1 shows U-2 disclosure does not forbid current-host scope approval before search; U-2(e) is attestation-time only and requires all U-1 resolved. Scenario 2 and case 6 demonstrate that remaining U-1 unknowns, including inaccessible current paths (E-J6), cannot be bypassed through U-2. Scenario 3 demonstrates that H1 discovery defeats the attestation regardless of U-2. Scenario 4 demonstrates that the existing E-J5 invalidation regime applies, with revalidation requiring new scope approval before any new search. Scenario 5 demonstrates the correct distinction between current and historical PID observations. Case 7 demonstrates that dormant existing / surviving historical-origin paths remain U-1.

This C2 record does **not** claim independent review PASS. C1 has not passed independent review.

---

## §4. Effect of a later decision

### 4.1 Amendment lifecycle under this task

| Stage | What happens | What does NOT happen |
|---|---|---|
| **Step 2 (this freeze)** | Decision options proposed: Option A (retain J-2), Option B (bounded amendment), Option C (unresolved). None adopted | Nothing adopted. No amendment in force. No host condition established. No operational permission granted. SCOPE-01 BLOCKED decision unchanged |
| **Step 3 (Keith's separately authorized explicit selection)** | Keith selects one option. If Option B: Keith's selection constitutes explicit adoption of the precisely scoped prospective J-2 amendment under P5-JOURNAL-01 §0.8 / §4.1. If Option A or C: no amendment adopted | Locked predecessor document bodies remain physically unchanged. No host-specific satisfaction. No C-ACQ unblocking. No operational permission. SCOPE-01 BLOCKED decision unchanged as historical |
| **Step 4 (independently authorized verification and lock)** | Decision record verified as internally consistent and correctly recorded. LOCKED | No new authority created beyond what Step 3 adopted. No host condition established |
| **Future scope decision (separate task)** | If Option B was adopted: a new scope-decision task may be authorized to apply the amended J-2 to (H, A). The SCOPE-01 BLOCKED decision remains valid as the historical record under the unamended rule | Requires its own registration, authorization, scope proposal, and evidence. Not part of this task |

### 4.2 What a contract-only lock does NOT do (same as P5-JOURNAL-01 §4.2)

A LOCKED decision record from this task:

1. Does NOT establish that any host satisfies P5.
2. Does NOT unblock C-ACQ.
3. Does NOT change HOST_CLEAN, P7_ACCEPTED, or REOPEN_GATE.
4. Does NOT authorize acquisition, transfer, SSH, PM2, host inspection, canary, or any runtime activity.
5. Does NOT edit locked predecessor document bodies.
6. Does NOT change EXEC-01C6A startCondition=NOT_READY.
7. Does NOT override, alter, or retroactively change the SCOPE-01 BLOCKED decision.

---

## §5. Step 3 / Step 4 acceptance criteria

### 5.1 Step 3 — record Keith's explicit selection

- [ ] Keith selects exactly one of: Option A, Option B, Option C
- [ ] If Option B selected: Keith's selection constitutes explicit adoption of the precisely scoped prospective J-2 amendment under P5-JOURNAL-01 §0.8 / §4.1; the amendment character is acknowledged
- [ ] If Option A selected: no amendment adopted; J-2 unchanged; SCOPE-01 BLOCKED stands under the existing rule
- [ ] If Option C selected: no determination made; J-2 unchanged; question deferred
- [ ] Selection recorded verbatim with date; no paraphrase, no inference, no supplied value
- [ ] If Keith provides conditions, modifications, or a different option: recorded exactly as stated
- [ ] Locked predecessor document bodies remain physically unchanged regardless of selection
- [ ] No host-specific P5 satisfaction claimed; no C-ACQ unblocked; no operational permission granted
- [ ] SCOPE-01 BLOCKED decision preserved as valid under the rule applied at that time
- [ ] §0 invariants confirmed preserved
- [ ] Keith's testimony preserved as "probably no, but uncertain" — not strengthened or converted

### 5.2 Step 4 — independent verification and lock

- [ ] Selected option correctly identified and recorded
- [ ] If Option B: amendment character acknowledged; explicit Keith adoption confirmed; proposed wording carried without alteration from §2 Option B
- [ ] Compatibility checks (§B.8) verified
- [ ] Decision table (§3) verified for internal consistency
- [ ] §4 non-effects confirmed
- [ ] §0 invariants verified
- [ ] No predecessor body edits
- [ ] Validator run; git diff --check clean

### 5.3 Explicit non-effects (apply to Steps 2, 3, and 4)

- Does NOT accept P7
- Does NOT establish HOST_CLEAN
- Does NOT satisfy the reopen gate
- Does NOT authorize acquisition, transfer, SSH, PM2, host inspection, or canary
- Does NOT change EXEC-01C6A startCondition=NOT_READY
- Does NOT unblock C-ACQ (external evidence separately required under the adopted or amended rule)
- Does NOT remove the E1 (vault registry) requirement from C-ACQ
- Does NOT reopen or physically amend any predecessor document file
- Does NOT inspect the host, any vault, any journal, or any recovery material
- Does NOT modify sidecar, lockedTaskIds, implementation candidates, or occupancy
- Does NOT retroactively alter the SCOPE-01 BLOCKED decision
- Does NOT convert testimony
- Does NOT treat D2b as a J-2 waiver
- Step 2 proposes but adopts nothing; Step 3 may adopt; locked predecessor document bodies remain physically unchanged throughout

---

## §6. Step 2 AC (from the canonical body requirements and Keith's authorization)

- [x] Authority and baseline established: HEAD `0afbe3704a7d3fe4e0a0dfbaad0a46f6f196fcff` matches expected baseline; branch main; working tree clean; GOVERNANCE UNOWNED available for transient acquisition
- [x] Predecessor documents read and provisions verified: P5-JOURNAL-01 (§0.8, §2, §4.1, §7.2), P5-SCOPE-01 (BLOCKED decision, correction #1, GAP-1..7), P5-INVENTORY-01 (bounded finding, §0 invariants, §8, §9 coverage limitations), POLICY-01 (P5 requirements), ACQUISITION-01 (§4.2 three-state framework, E1), BASELINE-GOV-01 (A1-F, H0/H1/H2, Rule B-1, D2b)
- [x] Three decision options frozen: Option A (retain unchanged), Option B (bounded amendment), Option C (unresolved)
- [x] Option B: primary replacement of the "Unknowns that prevent acceptance" element; consequential historical-territory coverage justification through U-2 disclosure; U-2-specific additional invalidation trigger; current-host coverage justification remains "specific facts, not assumptions"; application sequence makes search follow current-host scope approval; replacement wording provided; distinctions preserved (historical vs current gaps, PID 1177465, acceptance vs proof)
- [x] Option B: fact-supported scope proposal requirements stated; acceptance effects and non-effects stated; subsequent search outcomes addressed; validity/invalidation specified; compatibility with A1-F, H0/H1/H2, Rule B-1, D2b, ACQUISITION-01 §4.2, P5 process-table, E1 checked — no dependency on changing another contract
- [x] Decision table (§3) covers seven concrete cases with controlling clauses (cases 6–7 added at C2); C2 does not claim independent review PASS
- [x] SCOPE-01 BLOCKED decision preserved as valid under the rule applied at that time
- [x] Keith's testimony preserved as "probably no, but uncertain" — not strengthened or converted
- [x] §0 invariants preserved; predecessor bodies physically unchanged; no host inspection, vault/journal access, SSH, AWS, sudo, PM2, runtime, implementation, or predecessor edits
- [x] Validator run and git diff --check recorded after writes
- [x] No Git commit/push by the worker

---

## §7. Activity ledger (Step 2)

LIVE=0, SSH=0 (including preflight / keyscan), STAGING lease=0, AWS=0, sudo=0, host inspection=0, vault/journal access=0, PM2=0, Docker / Postgres / Redis / service runtime=0, provider=0, credits=0, transfer / acquisition / canary / reopen=0, operational authorization=0, scripts / parsers / tests created=0, tests created=0, tests executed=0 except the lane-capacity validator, executable artifacts created=0, subagents=0, J-2 provisions amended=0 (options proposed only; nothing adopted), decision selected=0, evidence plan frozen=0, evidence collection=0, predecessor bodies edited=0, sidecar / lockedTaskIds / mutex-catalog / validator edits=0, stale-board-mirror edits=0, EXEC-01C6A body/candidate edits=0, PRD / ARCHITECTURE / CLAUDE / AGENTS edits=0, Git commit / push / branch / worktree=0, Lane 3 changes=0, builder-gate changes=0; files written under transient GOVERNANCE: this stage-start (created), `TASKS.md` (this task's board records), `TASKS_BACKLOG_FULL.md` (this task's canonical body), `docs/control-plane/SATURATION_PROOF.json` (validator output only). GOVERNANCE released UNOWNED.

**Status: PM2-RECOVERY-P5-J2-AMENDMENT-01 — Step 2 COMPLETE (options/evidence-requirements freeze; three options frozen: A retain, B bounded amendment, C unresolved; nothing adopted) — Step 2-C1 applied 2026-09-29 — Step 2-C2 applied 2026-09-29 (U-1/U-2 current-coverage vs unavailable historical records; E-J6 preserved; C1 has not passed independent review; C2 does not claim independent review PASS) — at baseline `0afbe3704a7d3fe4e0a0dfbaad0a46f6f196fcff`. Steps 3–4 NOT AUTHORIZED. Task NOT LOCKED.**

---

## §8. Step 2 correction #1 (C1) — documentation-only, localized (2026-09-29; same uncommitted Step 2 record at baseline `0afbe3704a7d3fe4e0a0dfbaad0a46f6f196fcff`)

Keith-directed review. Three localized corrections to the unadopted Option B freeze. Nothing adopted. Steps 3–4 remain NOT AUTHORIZED. SCOPE-01 BLOCKED remains valid under unamended J-2. Locked predecessor bodies physically unchanged. No host/runtime activity.

| # | Location | Correction |
|---|---|---|
| 1 | B.1 replacement wording; B.4; B.5; B.6; B.10; §3 rows 1–2 and 4 | **Search sequencing.** Option B now states a mandatory application sequence: (1) scope proposal identifies U-1 and U-2; (2) Keith may approve the current-host scope before any search, with U-2 disclosed as unresolved; (3) bounded current-host search is then performed; (4) after the search, if no H1 / UNCLASSIFIED material is found and all U-1 unknowns are resolved, Keith may accept disclosed residual historical uncertainty at attestation time. U-2 conditions (a)–(e) are attestation-time requirements. Condition (b) does not authorize or imply search before scope approval. B.10 no longer requires resolving U-1 or obtaining U-2(e) acceptance before the search. |
| 2 | B.1 heading and preamble; B.2 items 3–4; §6 AC | **"Exactly one element modified" removed.** Option B is described as primarily replacing the "Unknowns that prevent acceptance" element, with consequential treatment of historical-territory coverage justification through U-2 disclosure, and a U-2-specific additional invalidation trigger. Current-host coverage justification remains "specific facts, not assumptions." |
| 3 | B.2 item 7; U-2(e); B.7; B.9; §3 rows 1 and 4 | **E-J5 wording.** The existing E-J5 validity/invalidation regime is preserved. U-2 acceptances carry one additional invalidation trigger. The phrase "unchanged, with" an added trigger is not used. |

Unchanged by this correction: Options A and C; nothing adopted; Step 3 NOT AUTHORIZED; Step 4 NOT AUTHORIZED; SCOPE-01 BLOCKED as valid under unamended J-2; §0 invariants; testimony ("probably no, but uncertain"); D2b not a J-2 waiver; no host-specific P5 satisfaction; no C-ACQ unblocking; HOST_CLEAN / P7_ACCEPTED / REOPEN_GATE unchanged; EXEC-01C6A startCondition=NOT_READY; no operational authorization; predecessor bodies; sidecar; lockedTaskIds.

Corresponding wording corrections applied only to this task's current board / backlog summaries under transient GOVERNANCE. `docs/control-plane/SATURATION_PROOF.json` is not mutated by this correction. GOVERNANCE acquired transiently then released UNOWNED.

---

## §9. Step 2 correction #2 (C2) — documentation-only, localized (2026-09-29; same uncommitted Step 2 record at baseline `0afbe3704a7d3fe4e0a0dfbaad0a46f6f196fcff`)

Keith-directed. C1 has **not** passed independent review. This C2 record does **not** claim independent review PASS. Nothing adopted. Steps 3–4 remain NOT AUTHORIZED. SCOPE-01 BLOCKED remains valid under unamended J-2. No new search or privilege authorization. Sequence preserved: fact-supported scope proposal and Keith approval before search; search under approved scope; all U-1 unknowns resolved before any U-2(e) attestation-time acceptance.

| # | Location | Correction |
|---|---|---|
| 1 | B.1 U-1; U-2(a)–(b); B.4 | **Current relevant locations remain U-1** when access is denied, privileges are unavailable, traversal fails, the search is incomplete, or current existence/location is uncertain. They do not fall out of U-1 into U-2 by inaccessibility. |
| 2 | B.1 classification; B.3; B.4; B.6; B.10 | **Unavailable historical records vs unresolved present-day coverage.** Dormant existing paths, surviving directories of removed accounts, and unresolved current relocation destinations remain U-1 and cannot be waived through U-2 solely because their origin is historical. U-2 is limited to unavailable historical records and locations established as deleted / no longer present. |
| 3 | B.1 U-1; B.2 item 11; B.6; B.9; §3 cases 2 and 6 | **E-J6 blocking preserved.** Inaccessible, corrupted, or incomplete evidence cannot satisfy the journal cross-check under any option, including Option B. |
| 4 | §3 cases 6–7 | **Decision-table cases** for inaccessible current paths and surviving/dormant historical-origin paths: unresolved current coverage blocks acceptance. |

Unchanged by this correction: Options A and C; nothing adopted; Step 3 NOT AUTHORIZED; Step 4 NOT AUTHORIZED; C1 unpassed independent review; SCOPE-01 BLOCKED; testimony; D2b; no host-specific P5; no C-ACQ unblocking; HOST_CLEAN / P7_ACCEPTED / REOPEN_GATE; EXEC-01C6A startCondition=NOT_READY; no operational authorization; predecessor bodies; sidecar; lockedTaskIds; SATURATION_PROOF.json not mutated.

Corresponding wording corrections applied only to this task's current board / backlog summaries under transient GOVERNANCE. GOVERNANCE acquired transiently then released UNOWNED.

---

## §10. Step 3 — Keith's explicit selection / adoption of Option B (2026-09-29)

**Step:** 3 of 4 — record Keith's explicit selection
**Step 3 date:** 2026-09-29
**Step 3 HEAD at window open:** `2b334ec7492f18fff332946c67dd41b4e8721a25` (branch main; index empty; `docs/control-plane/SATURATION_PROOF.json` dirty as inherited and preserved unchanged)
**Authorization scope:** Step 3 only. Step 4 (independent verification and lock) remains **NOT AUTHORIZED**. Task **NOT LOCKED**.
**Object selected:** Option B as frozen in commit `2b334ec7492f18fff332946c67dd41b4e8721a25` — the committed §2 Option B text, including C1/C2 corrections as frozen in that commit, **without alteration**.

### 10.1 Authorization evidence (verbatim; relationship stated)

**ChatGPT proposal (not Keith's words):**

> Select Option B as frozen in commit 2b334ec7492f18fff332946c67dd41b4e8721a25 and authorize Step 3 only.

**Keith's reply (verbatim):**

> yes, do what you said

**Relationship:** Keith's 2026-09-29 reply affirms the ChatGPT proposal above. The proposal text is **not** Keith's verbatim statement. Keith's actual reply is the five words recorded here. No other conditions, modifications, or different option were stated.

**Date recorded:** 2026-09-29
**Baseline at selection:** `2b334ec7492f18fff332946c67dd41b4e8721a25`

### 10.2 Selection

**Selected option:** Option B (§2 Option B — Bounded prospective amendment for historical uncertainty treatment), as frozen at `2b334ec7492f18fff332946c67dd41b4e8721a25`.
**Options not selected:** Option A, Option C.

Keith's affirmation of the ChatGPT proposal constitutes **explicit adoption**, under P5-JOURNAL-01 §0.8 / §4.1, of the precisely scoped prospective J-2 amendment frozen as Option B. The amendment character is acknowledged: Option B goes beyond locked J-2 as adopted by P5-JOURNAL-01 §7.2 and is adopted through this explicit Keith decision, not through interpretation of existing locked authority.

The adopted text is the frozen Option B wording in this document's §2 (B.1–B.10), including the C1/C2 corrections as they stand in commit `2b334ec7492f18fff332946c67dd41b4e8721a25`. **No wording is altered by this Step 3 record.**

### 10.3 Adopted content identified by reference (not restated)

The adopted Option B is identified by reference to the frozen text:

| Element | Frozen location |
|---|---|
| U-1 / U-2 treatment | §2 Option B **B.1** replacement wording (U-1 current relevant coverage, including inaccessible/uncertain current locations; U-2 unavailable historical records and locations established as deleted / no longer present; classification rule) |
| Historical-territory coverage treatment | §2 Option B **B.1** consequential treatment; **B.2** items 3–4; **B.3** |
| Application sequence | §2 Option B **B.1** steps (1)–(4): fact-supported scope proposal identifying U-1 and U-2; Keith may approve current-host scope before any search with U-2 disclosed as unresolved; search under that approved scope; all U-1 resolved before any U-2(e) attestation-time acceptance |
| Additional invalidation trigger | §2 Option B U-2(e); **B.7** (existing E-J5 regime preserved; U-2 acceptances carry one additional invalidation trigger) |
| E-J6 | §2 Option B **B.1**, **B.2** item 11, **B.6**, **B.9** — blocking, preserved |

### 10.4 Historical C1/C2 statements preserved; later review distinguished

§8 and §9, and the C1/C2 header lines, are **historical Step 2 records** and are not rewritten. Their statements that C1 had not passed independent review and that C2 did not claim independent review PASS remain as written at those times.

**Later fact, recorded only here:** after those C1/C2 records were written, Step 2 including C1/C2 passed ChatGPT's independent artifact review, and the freeze was committed as `2b334ec7492f18fff332946c67dd41b4e8721a25`. That later review-and-commit is distinct from the historical C1/C2 in-progress statements. This Step 3 record adopts the committed freeze; it does not rewrite §§8–9.

### 10.5 What this decision does NOT do

1. Does **not** approve any host-specific J-2 search scope or perform any U-2(e) acceptance for any (H, A).
2. Does **not** establish host-specific P5 satisfaction.
3. Does **not** unblock C-ACQ.
4. Does **not** change HOST_CLEAN, P7_ACCEPTED, or REOPEN_GATE. HOST_CLEAN=NO; P7_ACCEPTED=NO; REOPEN_GATE=UNSATISFIED.
5. Does **not** change EXEC-01C6A startCondition=NOT_READY.
6. Does **not** override, alter, or retroactively change the locked SCOPE-01 BLOCKED decision. That decision remains valid under the unamended J-2 rule applied then.
7. Does **not** authorize search, privilege escalation, acquisition, transfer, SSH, AWS, sudo, PM2, host inspection, canary, or any runtime activity.
8. Does **not** edit locked predecessor document bodies. Sidecar and `lockedTaskIds` unchanged.
9. Does **not** convert testimony. Keith's testimony remains "probably no, but uncertain."
10. Does **not** treat D2b as a J-2 waiver.
11. Does **not** LOCK this task. Step 4 remains NOT AUTHORIZED.

### 10.6 §5.1 checklist

- [x] Keith selects exactly one of: Option A, Option B, Option C — **Option B selected**
- [x] Option B selected: Keith's selection constitutes explicit adoption of the precisely scoped prospective J-2 amendment under P5-JOURNAL-01 §0.8 / §4.1; the amendment character is acknowledged
- [x] Option A not selected; Option C not selected
- [x] Selection recorded with date; Keith's actual reply recorded verbatim; ChatGPT proposal recorded separately and not presented as Keith's verbatim words
- [x] Keith provided no conditions, modifications, or different option beyond affirming the recorded proposal
- [x] Locked predecessor document bodies remain physically unchanged
- [x] No host-specific P5 satisfaction claimed; no C-ACQ unblocked; no operational permission granted
- [x] SCOPE-01 BLOCKED decision preserved as valid under the rule applied at that time
- [x] §0 freeze invariants preserved as historical Step 2 text; adoption is recorded in this §10 rather than by rewriting §§0–9 option text
- [x] Keith's testimony preserved as "probably no, but uncertain" — not strengthened or converted

### 10.7 Activity ledger (Step 3)

LIVE=0, SSH=0, STAGING lease=0, AWS=0, sudo=0, host inspection=0, vault/journal access=0, PM2=0, Docker / Postgres / Redis / service runtime=0, provider=0, credits=0, transfer / acquisition / canary / reopen=0, operational authorization=0, scripts / parsers created=0, tests created=0, tests executed=0 except the lane-capacity validator if run to `$env:TEMP`, executable artifacts created=0, subagents=0, frozen Option B text unaltered=yes, decision selected=Option B, predecessor bodies edited=0, sidecar / lockedTaskIds / mutex-catalog / validator source edits=0, SATURATION_PROOF.json mutated by this step=0, stale-board-mirror edits=0, EXEC-01C6A body/candidate edits=0, PRD / ARCHITECTURE / CLAUDE / AGENTS edits=0, Git commit / push / branch / worktree=0, Lane 3 changes=0; files written under transient GOVERNANCE: this stage-start (§10 appended; header current-status only), `TASKS.md` (this task's board records), `TASKS_BACKLOG_FULL.md` (this task's canonical body). GOVERNANCE released UNOWNED.

**Status: PM2-RECOVERY-P5-J2-AMENDMENT-01 — Step 3 COMPLETE (Keith selected Option B as frozen at `2b334ec7492f18fff332946c67dd41b4e8721a25`; explicit adoption of the prospective J-2 amendment; Options A and C not selected) — 2026-09-29 at baseline `2b334ec7492f18fff332946c67dd41b4e8721a25`. Step 4 NOT AUTHORIZED. Task NOT LOCKED.**

---

## §11. Step 4 — Independent verification and lock (2026-09-29)

**Step:** 4 of 4 — independent verification and lock
**Step 4 date:** 2026-09-29
**Step 4 HEAD at window open:** `a3398de093941a0e68c8bc89149329eaf5b68865` (branch main; index empty; inherited dirtiness `docs/control-plane/SATURATION_PROOF.json` only, preserved unchanged; matches the expected baseline)
**Authorization:** Keith authorized Step 4 only at baseline `a3398de093941a0e68c8bc89149329eaf5b68865`. No successor work or operational activity is authorized.
**Separate window:** This verification window is independent of Step 3. Corroborating Git evidence: Step 2 freeze `2b334ec7492f18fff332946c67dd41b4e8721a25`; Step 3 adoption `a3398de093941a0e68c8bc89149329eaf5b68865` (this window's HEAD). Separation rests on Keith's explicit Step 4 authorization and the provenance boundary (Step 3 = adoption recording; Step 4 = independently initiated verification).

### 11.1 Verification scope and evidence base

This section independently verifies the existing §5.2 acceptance criteria from committed evidence. Frozen §§0–10 are not rewritten. Step 4 creates no additional authority beyond what Step 3 adopted.

**Committed evidence:**
- Baseline / Step 3 adoption commit: `a3398de093941a0e68c8bc89149329eaf5b68865` (`docs: record Keith adoption of PM2 J-2 amendment Option B`)
- Step 2 freeze commit: `2b334ec7492f18fff332946c67dd41b4e8721a25` (`docs: freeze PM2 J-2 amendment Step 2 options with C1/C2 corrections`)
- origin/main at window open: `a3398de093941a0e68c8bc89149329eaf5b68865` (matches HEAD; Keith's push of both commits succeeded)
- Index: empty. Unstaged inherited dirtiness: `docs/control-plane/SATURATION_PROOF.json` only (HEAD blob `1e6078f459826aec36f1f1162342838665b4d597`; work blob `50ce410efe547a7e24f06ef75b9410916d5dae8a`; SHA-256 `7B7215FCA68D0724F15BAF2F73618C57069C53715743040C2B2BFBA959CEB9C2` / 2496 bytes). Preserved unchanged and unstaged.
- Occupancy at window open: `lane1.state=EMPTY`; `lane2.state=EMPTY`; `governance.state=UNOWNED`; `occupancyHash=sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d`
- Step 2 freeze stage-start SHA-256 (UTF-8, LF): `F82609194B185424A2DB8F05FB850A4BE9CC801C322ACBD884311656579A9C4A` (61993 bytes as extracted from freeze blob `bf21e0d9193121e449f7f1bc92cc7b105d52509e`)
- Step 3 adoption stage-start SHA-256 (UTF-8, LF): `C7D1BAEDFF876CC99015AFBDCF43AFD7484C8583937DAE864CBB26C94BC90614` (70206 bytes; blob `8f7966c385d15e86db4e50615aeb4021b93dcf49`)
- Frozen §§0–9 body SHA-256 (from `## §0` through end of freeze file, trailing newlines trimmed): `1858CC31AB35A6A8C3142C73F79604AAB45420DE1950A006151F09682BDD783C` (58471 chars). Identical to Step 3 tree after stripping the `---` delimiter that precedes §10.

**Predecessor provisions consulted:** P5-JOURNAL-01 §0.8 / §2 Option J-2 / §3.2 E-J5 and E-J6 / §4.1 / §4.2 / §7.2; P5-SCOPE-01 §4.1 / §4.4 / §10.2 BLOCKED decision; BASELINE-GOV-01 §2.1 H0/H1/H2/UNCLASSIFIED and Rule B-1 / §2.2 A1-F / §2.5 D2b=ACCEPTANCE; ACQUISITION-01 §2.1 E1 / §4.2 three-state framework.

### 11.2 Criterion-by-criterion findings

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | §10 accurately records Keith's actual reply, “yes, do what you said”, separately from the ChatGPT proposal it affirmed | **PASS** | §10.1 records the ChatGPT proposal in its own block quote (“Select Option B as frozen in commit 2b334ec7492f18fff332946c67dd41b4e8721a25 and authorize Step 3 only.”), then Keith's reply in a separate verbatim block quote: `yes, do what you said`. Relationship sentence states the proposal is **not** Keith's verbatim statement. Captured reply is exactly those five words. |
| 2 | Option B alone was explicitly adopted, as the precise prospective amendment frozen at the Step 2 commit; Options A/C were not selected | **PASS** | §10.2: “Selected option: Option B … as frozen at `2b334ec7492f18fff332946c67dd41b4e8721a25`.” “Options not selected: Option A, Option C.” Object selected is the committed §2 Option B text including C1/C2 “without alteration.” Amendment character acknowledged under P5-JOURNAL-01 §0.8 / §4.1. |
| 3 | Frozen §§0–9, including C2 §9, were preserved by Step 3 (actual commit diff; not the worker report) | **PASS** | `git diff --name-status 2b334ec..a3398de` for the stage-start: header current-status lines only, then `@@ -446,3 +449,88` appending §10 after the unchanged last three lines of §9. Option B slice is byte-identical (27058 chars). Trimmed §§0–9 body including C2 §9 is byte-identical to the freeze file (58471 chars; SHA-256 `1858CC31…DD783C`). C1/C2 headers were not rewritten. |
| 4 | Adoption preserves scope approval before search, attestation-time U-2(e), blocking U-1/E-J6 current coverage, disclosed historical uncertainty, and the additional invalidation trigger | **PASS** | Because Option B text is unaltered: B.1 application sequence (1)–(4) requires Keith current-host scope approval before any search; U-2(e) is attestation-time only; U-1 remains blocking at attestation including inaccessible/uncertain current locations; E-J6 blocking is preserved (B.1, B.2 item 11, B.6, B.9); U-2(d) disclosure and U-2(e) acceptance of disclosed residual historical uncertainty remain; U-2(e) / B.7 carry one additional invalidation trigger while preserving the existing E-J5 regime. §10.5 items 1–11 confirm no host-specific scope approval or U-2(e) acceptance occurred at adoption. |
| 5 | B.8 compatibility and §3's seven scenarios against the controlling provisions; preserve A1-F, H0/H1/UNCLASSIFIED, Rule B-1, D2b, three-state framework, E1 independence, and the P5 process-table component | **PASS** | B.8 checked against BASELINE-GOV-01 §2.1/§2.2/§2.5 (A1-F; H0/H1/H2/UNCLASSIFIED; Rule B-1; D2b=ACCEPTANCE as A1-F clause (b) threshold, not a J-2 waiver — SCOPE-01 §4.4); ACQUISITION-01 §4.2 three states (Option B is a path to “explicitly determined inapplicable” only after U-2 conditions and complete attestation, citing this adopted amendment as controlling authority; unresolved remains blocking); ACQUISITION-01 §2.1 E1 independently required; P5-JOURNAL-01 §1.1/§4.3 process-table unchanged (B.2 item 8). §3 cases 1–7 remain internally consistent with B.1/B.6/B.7 and with E-J6 (JOURNAL-01 §3.2: inaccessible evidence cannot satisfy the journal cross-check under any option), J-2 criterion 4 / A1-F clause (a) on H1 discovery, J-2 criterion 6 / E-J5 on new activity, and SCOPE-01 GAP-4 on PID 1177465. No contradiction found. |
| 6 | §0 and §4 non-effects, accounting for historical “nothing adopted” statements being superseded only by the explicit Step 3 adoption | **PASS** | §0 items 1–10 and C1/C2 headers remain freeze-time historical text (“adopts nothing”; “Steps 3–4 remain NOT AUTHORIZED”). §10.6 records that §0 freeze invariants are preserved as historical Step 2 text and that adoption is recorded in §10 rather than by rewriting §§0–9. §4.1 already distinguished Step 2 (nothing adopted) from Step 3 (if Option B: explicit adoption) from Step 4 (LOCKED; no new authority). §4.2 / §5.3 / §10.5 non-effects remain: no host-specific P5, no C-ACQ unblocking, HOST_CLEAN=NO, P7_ACCEPTED=NO, REOPEN_GATE=UNSATISFIED, EXEC-01C6A startCondition=NOT_READY, no operational permission, predecessor bodies unchanged, testimony unconverted, D2b not a J-2 waiver, SCOPE-01 BLOCKED preserved as valid under the unamended rule applied then. The Step 3 adoption supersedes freeze-time “nothing adopted” for current binding status only; it does not rewrite those historical statements. |
| 7 | Step 3 changed only the three authorized documentation files, with no predecessor, sidecar, lockedTaskIds, source, or operational-gate changes | **PASS** | `git diff --name-only 2b334ec..a3398de` lists exactly: `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/PM2-RECOVERY-P5-J2-AMENDMENT-01-STAGE-START.md`. Zero diff on P5-JOURNAL-01, P5-SCOPE-01, P5-INVENTORY-01, ACQUISITION-01, POLICY-01, BASELINE-GOV-01, CAPTURE-01 stage-starts; zero diff on `docs/control-plane/lane-saturation-state.json` (lockedTaskIds unchanged; this GOVERNANCE task is correctly absent) and `mutex-catalog.json`. Occupancy block unchanged. HOST_CLEAN=NO; P7_ACCEPTED=NO; REOPEN_GATE=UNSATISFIED; EXEC-01C6A startCondition=NOT_READY; E1 UNREGISTERED; Lane 3 DISABLED; INVITE-01 PARKED / UNAUTHORIZED / PROHIBITED. No application source in the commit. |

### 11.3 §5.2 checklist (verified here; frozen §5.2 boxes not rewritten)

- [x] Selected option correctly identified and recorded — Option B (§10.2)
- [x] Option B: amendment character acknowledged; explicit Keith adoption confirmed; proposed wording carried without alteration from §2 Option B (criterion 2–3)
- [x] Compatibility checks (§B.8) verified (criterion 5)
- [x] Decision table (§3) verified for internal consistency (criterion 5)
- [x] §4 non-effects confirmed (criterion 6)
- [x] §0 invariants verified as freeze-time historical text, with adoption recorded in §10 (criterion 6)
- [x] No predecessor body edits (criterion 7)
- [x] Validator run; git diff --check clean (recorded after Step 4 writes)

### 11.4 Lock definition

This task — PM2-RECOVERY-P5-J2-AMENDMENT-01 — is **COMPLETE AND LOCKED**.

**Lock scope:** Verification of the adopted prospective J-2 historical-uncertainty amendment (Option B as frozen at `2b334ec7492f18fff332946c67dd41b4e8721a25` and adopted at `a3398de093941a0e68c8bc89149329eaf5b68865`) and faithful decision recording only.

The lock confirms:

1. Keith explicitly selected Option B at Step 3. Options A and C were not selected.
2. The adopted Option B wording is the frozen §2 text, including C1/C2, without alteration.
3. The decision record (§§0–10) is internally consistent and correctly recorded.
4. §0 freeze invariants and §4 / §5.3 / §10.5 non-effects are preserved.

**This lock creates no additional authority.** It does NOT:

- Approve any host-specific J-2 search scope or perform any U-2(e) acceptance
- Establish host-specific P5 satisfaction
- Unblock C-ACQ
- Change HOST_CLEAN, P7_ACCEPTED, REOPEN_GATE, or EXEC-01C6A startCondition=NOT_READY
- Authorize acquisition, transfer, SSH, AWS, sudo, PM2, host inspection, canary, or any runtime activity
- Edit locked predecessor document bodies, sidecar, lockedTaskIds, or occupancy
- Convert testimony or treat D2b as a J-2 waiver
- Retroactively alter the SCOPE-01 BLOCKED decision
- Authorize any successor task, host-specific scope approval, or operational activity

SCOPE-01 BLOCKED remains valid under the unamended J-2 rule applied then. EXEC-01C6A startCondition=NOT_READY; HOST_CLEAN=NO; P7_ACCEPTED=NO; REOPEN_GATE=UNSATISFIED.

### 11.5 Activity ledger (Step 4)

LIVE=0, SSH=0, STAGING lease=0, AWS=0, sudo=0, host inspection=0, vault/journal access=0, PM2=0, Docker / Postgres / Redis / service runtime=0, provider=0, credits=0, transfer / acquisition / canary / reopen=0, operational authorization=0, scripts / parsers created=0, tests created=0, tests executed=0 except the lane-capacity validator once with proof under `$env:TEMP`, executable artifacts created=0, subagents=0, frozen §§0–10 unaltered except current-status header lines, predecessor bodies edited=0, sidecar / lockedTaskIds / mutex-catalog / validator source edits=0, SATURATION_PROOF.json mutated by this step=0, stale-board-mirror edits=0, EXEC-01C6A body/candidate edits=0, PRD / ARCHITECTURE / CLAUDE / AGENTS edits=0, Git commit / push / branch / worktree=0, Lane 3 changes=0; files written under transient GOVERNANCE: this stage-start (§11 appended; header current-status only), `TASKS.md` (this task's current board records), `TASKS_BACKLOG_FULL.md` (this task's canonical body/status). GOVERNANCE released UNOWNED.

**Status: PM2-RECOVERY-P5-J2-AMENDMENT-01 — COMPLETE AND LOCKED — 2026-09-29 at baseline `a3398de093941a0e68c8bc89149329eaf5b68865`. Lock = verification of the adopted Option B amendment and faithful decision recording only; it creates no additional authority. SCOPE-01 BLOCKED preserved. No host-specific scope approval, U-2(e) acceptance, P5 satisfaction, C-ACQ unblocking, or successor authorization.**
