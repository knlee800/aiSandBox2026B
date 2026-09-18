# PM2-RECOVERY-POLICY-01 — Stage-Start / Step 2 Decision Freeze

**Task:** PM2-RECOVERY-POLICY-01 — Decide whether to authorize a bounded UNKNOWN_PENDING_OVERLAY recovery policy
**Nature:** GOVERNANCE / DECISION (no implementation lane; no sidecar candidate)
**Step status:** Step 1 COMPLETE — 2026-09-18 (registration `f434ec80ce5e32114f063258ddb9842bd3039446`); Step 2 COMPLETE — 2026-09-18 (freeze `8433346a47bb194295aa60675f5afc46bc358997`; matrix correction `0add5cf6183911770bab8cd58598aa3c183a9eed`); Step 3 COMPLETE — 2026-09-19 (explicit Keith decision; §13; commit `93d36d2a7e49876144f8ca2c383872236250231e`); **Step 4 COMPLETE AND LOCKED — 2026-09-19 (§14); acceptance object = S1 governance decision only**
**Base HEAD (Step 2 window):** `f434ec80ce5e32114f063258ddb9842bd3039446`
**Base HEAD (Step 3 window):** `0add5cf6183911770bab8cd58598aa3c183a9eed`
**Base HEAD (Step 4 window):** `93d36d2a7e49876144f8ca2c383872236250231e` (branch `main`; working tree clean at window open; matches the expected baseline)
**Current status (Step 4 lock):** COMPLETE AND LOCKED — OUTCOME_SELECTED=R3 OUTCOME_POLICY_APPROVED_AMENDED — POLICY_AUTHORIZED=YES (S1 contract only) — SUBSTANTIVE_AMENDMENTS_ADOPTED=A4 only — FIRST_RUN_AMENDMENT_ADOPTED=NO (A1 OPEN) — BASELINE_DESIGNATED=NO (A2 OPEN) — PROCEDURE_SELECTION=VERIFIER (direction only) — ACCEPTANCE_DIRECTION=C1 (direction only) — P7_ACCEPTED=NO — HOST_CLEAN=NO — REOPEN_GATE_SATISFIED=NO — EXEC_01C6A_REOPENED=NO — LOCKED=YES (S1 governance decision only)
**Superseded Step 3 status line (historical):** OUTCOME_SELECTED=R3 OUTCOME_POLICY_APPROVED_AMENDED — POLICY_AUTHORIZED=YES (S1 contract only) — SUBSTANTIVE_AMENDMENTS_ADOPTED=A4 only — FIRST_RUN_AMENDMENT_ADOPTED=NO (A1 OPEN) — BASELINE_DESIGNATED=NO (A2 OPEN) — PROCEDURE_SELECTION=VERIFIER (direction only) — ACCEPTANCE_DIRECTION=C1 (direction only) — P7_ACCEPTED=NO — HOST_CLEAN=NO — REOPEN_GATE_SATISFIED=NO — EXEC_01C6A_REOPENED=NO — LOCKED=NO
**Superseded Step 2 status line (historical):** OUTCOME_SELECTED=NONE — POLICY_AUTHORIZED=NO — FIRST_RUN_AMENDMENT_ADOPTED=NO — P7_ACCEPTED=NO — HOST_CLEAN=NO — EXEC_01C6A_REOPENED=NO

> **Reading order:** §§0–12 are the Step 2 freeze with its two controlling corrections (§3.2, §8.0–§8.2a), preserved unchanged. §13 is the Step 3 decision record, preserved unchanged. §14 is the Step 4 independent-verification checkpoint and lock. Where §§0–12 say "no outcome selected" they describe the Step 2 window; where §13 says LOCKED=NO it describes the Step 3 window; §14 is current.

---

## 0. Authorization and boundaries of this window

Keith 2026-09-18 authorized **Step 2 only**: create this document and freeze a decision-ready structure. This window does **not** select an outcome, authorize the policy, adopt any amendment, designate a baseline, attest P4/P5/P7, register a verifier or implementation child, reopen EXEC-01C6A, amend EXEC-01C6A, or touch any locked freeze, the operator bundle, the workflow, or the sidecar. Static read-only inspection of tracked bundle code was performed to ground the client-side-effect statements in §5.6; nothing was executed.

This document is evidence for Steps 2–4 of this task. It is not a scheduler. `TASKS.md` remains the only scheduler; EXEC-01C6A sidecar `startCondition=NOT_READY` is unchanged.

## 1. Authority consulted (read-only; referenced, not repeated)

| Source | Role |
|---|---|
| `docs/AGENT-PLATFORM-EXEC-01C6A-PM2-FENCE-01-STAGE-START.md` (LOCKED; OUTCOME_BLOCKED / M3) | §3 four fate states; §4 rejected proofs; §5 F1–F5; **§6 UNKNOWN_PENDING_OVERLAY policy (§6.1–§6.5, P1–P8)**; §7 matrix (M2 = policy path); §8 reopen gates |
| `docs/HARNESS-RESTART-GOV-01-STAGE-START.md` (LOCKED; OUTCOME_A / R1) | §3.1 policy path; §3.3 items 1–4 and §3.4 items 1–3: what must exist before any EXEC-01C6A reopen |
| `docs/PM2-DAEMON-INVESTIGATION-01-STAGE-START.md` (LOCKED; PASS_WITH_DISCLOSED_LIMITATIONS) | §12.1 version identity (installed 7.0.3 KNOWN; daemon loaded-code UNKNOWN); §12.2 transport facts, failure-mode matrix, F1–F5 and P1–P8 findings; §12.3 per-mechanism verdicts; §12.4 D1–D4; §13.3 acceptance limits |
| `docs/PM2-OVERLAY-UNKNOWN-01-STAGE-START.md` (LOCKED bounded; r3 `e4473a80…c2a2` @ `17a9855`) | §4.3 latch; §4.7 next-run refusal; §4.8 dual-field verification; §4.9 retention; §4.10 allowlist; §10.3.A F5 boundary; §15.3 / §16.3 evidence limits |
| `ops/aisb-01c6a-operator-bundle/` (tracked r3 tree; **read statically, not executed**) | `lib/overlay_restore.py` `CliPm2` (`restart_update_env` l.240–273; `_pm2_env` / `dump_env` / `dump_env_dual` l.275–305; `_child_env_for_pm2` l.207–215); `lib/orchestrate.py` classification (l.698–734; exit mapping l.950–954; `--vault` argument l.799); `lib/vault.py` (all state is `vault_dir`-scoped; `.run.lock`, `unknown_overlay.json`, journal); `OPERATOR-BUNDLE.md` F5 boundary |
| `docs/AGENT-PLATFORM-EXEC-01C6-STAGE-START.md` §5.3, §14.1, §16 and `docs/AGENT-PLATFORM-EXEC-01C6A-CANARY-EVIDENCE.md` §4, §4.1, §12.3 (both unlocked, **not edited**) | EXEC-01C6A restoration matrix, secure baseline capture, rollback items, CLI exit codes — inputs to §7 compatibility analysis |
| Canonical body PM2-RECOVERY-POLICY-01 (`TASKS_BACKLOG_FULL.md`) | Registered scope boundaries 1–7 (this freeze implements them) |

No SSH, staging, PM2, vendor fetch, network, tests, mocks, builds, installs, browser, provider/credit, or workflow dispatch occurred.

---

## 2. Authority and sequence (FROZEN)

Four objects, strictly ordered. Each is a separate Keith decision and a separate control-plane write. No later object is implied by an earlier one.

| # | Object | What it establishes | What it does **not** establish | Where recorded |
|---|---|---|---|---|
| S1 | **Policy contract** | P1 granted; P2–P8 recorded as the recovery contract with their frozen §6.4 meanings (or as amended under §3 by explicit decision). This is PM2-FENCE-01 §7 row **M2** ("authorization of the policy; host CLEAN is a later gate"). | Host CLEAN; reopen; canary; residual-risk acceptance for any host/time (P7 is a *requirement* the contract names, not an attestation the contract makes) | This task Step 3/4 |
| S2 | **Host-specific gate** | For a named host, named apps, named keys, named time window: P2–P7 satisfied → CLEAN under §6.3–§6.4. Expires per §5.4. | Reopen; canary; anything about a different host, app set, or time | A later Keith-authorized evidence window (not this task) |
| S3 | **Explicit reopen** | P8: Keith authorizes EXEC-01C6A reopen; a distinct control-plane write changes sidecar/canonical `startCondition` (HARNESS-RESTART-GOV-01 §3.3 item 3 / §3.4 item 2) | Admission; mutex acquisition; execution | A later control-plane step (not this task) |
| S4 | **Separately authorized canary** | STAGING / PM2 / ENV (if then required) / CREDIT / PROVIDER-LIVE authorizations; lane admission of EXEC-01C6A | — | EXEC-01C6A lifecycle (not this task) |

**Contract-only lock rule (FROZEN):** if this task locks with S1 approved and nothing else, the lock record **must** state verbatim: *"OUTCOME_UNKNOWN_POLICY reopen gate (PM2-FENCE-01 §8) remains UNSATISFIED; host remains UNCLEAN / HOLD; EXEC-01C6A `startCondition=NOT_READY` unchanged; no canary authorized."* A contract lock is HARNESS-RESTART-GOV-01 §3.3 item 1 only; items 2–4 remain outstanding.

Until Step 3 records a choice: `OUTCOME_SELECTED=NONE`, `POLICY_AUTHORIZED=NO`.

---

## 3. Existing policy versus proposed amendments (FROZEN for decision; nothing adopted)

### 3.1 Exact frozen P1–P8 (PM2-FENCE-01 §6.4; reproduced verbatim so Step 3 decides against the real text)

| ID | Frozen requirement |
|---|---|
| P1 | Keith has authorized this UNKNOWN_PENDING_OVERLAY policy in a later control-plane step. This Step 2 freeze is not that authorization. |
| P2 | Result class for the overlapping overlay remains `UNKNOWN_PENDING_OVERLAY` (never rewritten to restore success). |
| P3 | Recovery vault is intact. |
| P4 | Exclusive operator control of the named PM2 apps is attested: no concurrent 01C6A overlay CLI, no other authorized overlay dispatcher, no competing `--update-env` for those apps. |
| P5 | Operator-owned PM2 CLI children for the overlay/restore commands are confirmed absent (process-table evidence of those operator children). This proves client absence, **not** daemon quiescence, and is therefore insufficient alone. |
| P6 | After P4 and P5, named keys on named apps match the preserved baseline by a Keith-authorized verification procedure. |
| P7 | Keith attests residual daemon-buffer risk is **accepted** for this host at this time. The attestation is the residual-risk acceptance; `jlist` is not the fence. |
| P8 | EXEC-01C6A reopen, if ever, is a **separate** Keith authorization after CLEAN. CLEAN does not admit the canary, acquire STAGING/PM2/ENV/CREDIT/PROVIDER-LIVE, or change sidecar `startCondition` by itself. |

§6.1 (restore may be attempted but cannot clear UNKNOWN), §6.2 (recovery material never deleted), §6.3 (UNCLEAN / HOLD until the gate passes), §6.5 (forbidden proofs) apply unchanged. Mechanics that serve P2/P3 continuity now exist in r3 (PM2-OVERLAY-UNKNOWN-01 §16.3), but **mechanics existing ≠ requirement met on a host**.

### 3.2 Prospective obligation vs evidence of satisfaction (FROZEN distinction)

Every P-ID has two readings that Step 3 must keep apart:

- **Prospective obligation** — what the operator must do / what automation must guarantee during a future window (e.g. P2: automation shall never rewrite UNKNOWN to success; r3 satisfies this *by construction* as fake-verified, §15.3 limits).
- **Evidence of satisfaction** — a dated, host-specific record that the requirement *was* met for a named run (e.g. P2: the journal/marker of run R on host H shows no UNKNOWN, or shows UNKNOWN that was never rewritten).

"P2 is trivially satisfied because no overlay was ever dispatched" conflates the two: it is a prospective statement (nothing to rewrite *yet*) offered as evidence about host state. It is **not** adopted here (§3.3 A1).

**Controlling correction (Step 2, 2026-09-18, Keith-directed; supersedes any "P2/P3 prospectively satisfied" wording elsewhere in this document or in this task's mirrors):**

1. P2 and P3 remain **binding obligations** for any future applicable run. Nothing in this freeze relaxes, waives, or pre-satisfies them.
2. **No existing run outcome and no recovery vault has been verified by this freeze.** No journal, marker, `restore_result.json`, or snapshot for any host has been examined or accepted.
3. If Keith later approves **different first-run prerequisites** for P2/P3 (A1), that approval is an **explicit applicability amendment** to the policy contract. It is **not** evidence that the original P2/P3 requirements are already satisfied for any host or run.
4. Before such an amendment **and** its required host evidence (S2: P4–P7 for a named host/time) are approved, the existing OUTCOME_UNKNOWN_POLICY reopen gate (PM2-FENCE-01 §8) **remains unsatisfied**.

A1, K-B1, and the §8 matrix below are to be read under this correction.

### 3.3 Proposed amendments — decision table

For each row: existing requirement → proposed wording → rationale/evidence → added uncertainty/risk → exact later Keith decision. **All rows are proposals. None is in force.**

**A1 — First-run applicability amendment for P2/P3 (different first-run prerequisites; not a satisfaction claim)**

| Field | Content |
|---|---|
| Existing | P2 "result class … remains UNKNOWN_PENDING_OVERLAY"; P3 "recovery vault is intact". Both presuppose an *overlapping overlay* and a *vault from that run*. **Both remain binding obligations for any future applicable run.** |
| Proposed wording (**controlling, corrected 2026-09-18 per §3.2 correction**) | "For a first authorized canary window on host H, P2 and P3 remain binding obligations. Because no prior 01C6A run on H exists to supply a run outcome (P2) or a recovery vault (P3), the **first-run prerequisites** for P2/P3 are amended to: (a) a Keith-accepted host-history attestation for (H, named apps) covering unrecorded `--update-env` / restart activity (§5.1 P4 form, extended to history); (b) a dual-field pre-mutation baseline read with no `BASELINE_DIVERGENT` finding; (c) confirmation that the r3 journal-before-dispatch, monotonic latch, and retention mechanics are the ones that will govern the run. Satisfying (a)–(c) is an amended **prerequisite**, not evidence that the original P2/P3 requirements have been met; P2/P3 become evidence-bearing for H only after the first dispatch and are then verified per run." |
| Superseded Step 2 wording (historical; **not controlling**) | "For a first authorized canary window on host H in which no 01C6A overlay command has ever been dispatched, P2 and P3 are satisfied prospectively by the r3 mechanics (journal-before-dispatch, monotonic latch, retention) and require no prior-run evidence; they become evidence-bearing only after the first dispatch." — withdrawn because it offered a prospective statement as satisfaction. |
| Rationale / evidence | r3 latches on every uncertain fate and retains all material (PM2-OVERLAY-UNKNOWN-01 §16.3, fake-verified). A first run has no prior journal or vault for P2/P3 to be checked against; the contract must therefore say what a first run must establish *instead*, without declaring P2/P3 met. |
| Added uncertainty / risk | (i) "No overlay has ever been dispatched on H" is a **host-history claim** that no repository journal can prove — the LIVE-11 / 04I era used `pm2 restart --update-env` on staging (PM2-FENCE-01 §1.2 last row; EXEC-01C6A body ENV assessment), and any unrecorded operator command leaves no journal. Absence of a *recorded* dispatch is not evidence of absence. (ii) A latent merge already present in `pm2_env.env` (F4 blind spot) would be detected only by the r3 pre-mutation `BASELINE_DIVERGENT` guard, which is itself point-in-time. (iii) Any first-run prerequisite set replaces two of the seven host-gate checks with history/baseline attestations for the run that has the *least* history; the attestations are human claims, not source findings. (iv) **No existing run outcome or vault has been verified by this freeze**; (a)–(c) have not been performed for any host. |
| Keith decision required | **K-B1:** Approve A1 as an **explicit first-run applicability amendment** defining prerequisites (a)–(c) for P2/P3 (YES / NO / UNRESOLVED_INPUT). YES amends the contract only: it does **not** state that P2/P3 are satisfied for any host, does **not** verify any run or vault, and does **not** satisfy the reopen gate — the gate remains unsatisfied until the amendment's required host evidence (S2) and P8 (S3) are separately approved. If YES, the amendment text is recorded in Step 3; the locked §6.4 table is *not* edited; this task's lock carries the amended prerequisites. |

**A2 — Expected pre-canary baseline**

| Field | Content |
|---|---|
| Existing | P6 compares against "the preserved baseline" — i.e. the vault captured **by the same run** before its first mutation. No baseline exists before a first run. |
| Proposed wording | "An *authoritative expected baseline* B(H) for named apps/keys may be established before any canary and used as the P6 reference for a first run and as the invariant reference for every later restore." |
| Rationale / evidence | Without B(H), a first-run P6 has nothing to compare against except the run's own pre-apply capture, which is an *observation of current state*, not a statement of *desired* state; a pre-existing latent overlay would be captured as "baseline" and restored to. |
| Added uncertainty / risk | Designating B(H) is a **configuration authority decision**, not an observation. Wrong provenance restores the host to a wrong state with a matching snapshot. Secret-bearing keys (`HARNESS_ENTITLEMENT_HMAC_SECRET`, `XAI_API_KEY`) must be recorded as presence class/token, never value (CANARY-EVIDENCE §4.1). |
| Keith decision required | **K-B2:** whether an authoritative B(H) is required before any first run (YES / NO), and, if YES, which provenance from §3.4 is accepted. No value is designated in this task. |

**A3 — P6 verification procedure for the first run**

| Field | Content |
|---|---|
| Existing | P6 requires "a Keith-authorized verification procedure" after P4 and P5. None is authorized. |
| Proposed wording | "P6 is satisfied by the comparison-only procedure in §5.3 (manual or verifier), executed after P4/P5 attestations, against B(H) or the run's preserved baseline, on both `pm2_env[k]` and `pm2_env.env[k]`." |
| Rationale / evidence | Investigation §12.3 dual-field row (verification input only); r3 `dump_env_dual` provides the read; §4.8 defines DIVERGENT. |
| Added uncertainty / risk | Any P6 read is a PM2 client invocation with the side effects in §5.6 (connection, possible daemon auto-launch, process on host). A match is point-in-time (PM2-FENCE-01 §4) and never fate proof. |
| Keith decision required | **K-B3:** authorize the §5.3 procedure as P6 (manual / verifier / neither), and whether it may be executed before B(H) exists. |

**A4 — P7 coverage of the first run**

| Field | Content |
|---|---|
| Existing | P7 "Keith attests residual daemon-buffer risk is accepted for this host at this time." |
| Proposed wording | "P7 for a first run covers the risk that a *pre-existing* unrecorded daemon-side mutation (not produced by the run) applies after CLEAN; P7 for later runs covers the recorded UNKNOWN attempts of prior runs as well." |
| Rationale / evidence | Makes explicit that P7 on a first run is not vacuous. |
| Added uncertainty / risk | Broadens P7 into a statement about host history Keith cannot verify from repository evidence (§12.1.3 (c) loaded-code UNKNOWN). |
| Keith decision required | **K-B4:** accept A4 wording as the meaning of P7 for first runs (YES / NO). Acceptance of the *wording* is still not a P7 *attestation* for any host/time (§6). |

### 3.4 What an acceptable authoritative expected baseline B(H) must contain (FROZEN requirements; no values)

1. **Identity:** host (`aisandbox-staging`), PM2 home (`/home/ubuntu/.pm2`, investigation §12.1.2), daemon start time it is valid for, app names (`aisandbox-ai-service`; `aisandbox-api-gateway` for xAI), and the exact named-key list (EXEC-01C6 §5.3 / CANARY-EVIDENCE §4 variables).
2. **Per key, per app, per field:** expected presence class ∈ {SET, EMPTY, ABSENT} for **both** `pm2_env[k]` and `pm2_env.env[k]`; for SET non-secrets the value; for SET secrets a non-reversible presence token only (SHA-256 of value, CANARY-EVIDENCE §4.1 step 2). Never a secret value in `docs/`, chat, or Git.
3. **Provenance chain:** who declared each expected value, from which source, when; the declaration must be *intent* (configuration authority), not a copy of a snapshot, or it must be explicitly labelled "observation adopted as baseline by Keith decision K-B2 on <date>".
4. **Validity conditions:** invalidated by daemon restart, `pm2 update`/`resurrect`, any `--update-env` or `pm2 save` on the named apps, deploy of the named apps, or `/opt/aisandbox/.env` change (BUILDER-LIVE-GATE-01 changed `GLOBAL_EXECUTION_ENABLED` there and in "PM2 Gateway id 3").
5. **Cross-check requirement:** before use, B(H) must be compared to a fresh dual-field observation; a mismatch is a **finding to resolve by decision**, not a reason to overwrite B(H) with the observation.

**Source candidates (supported by existing evidence only; none selected; none is authoritative until K-B2):**

| Candidate | Supports | Limits |
|---|---|---|
| EXEC-01C6 §5.3 table + CANARY-EVIDENCE §4 matrix | the **key list** and the *canary* values; "Restore" column says "unset / previous" — i.e. it defers to observation | provides schema, not host values |
| BUILDER-LIVE-GATE-01 checkpoint (`GLOBAL_EXECUTION_ENABLED=true` LEFT ON in `/opt/aisandbox/.env` and PM2 Gateway id 3) | intended value for **one** Gateway key | one key; Gateway only; dated 2026-09-14 |
| `/opt/aisandbox/.env` (staging deploy config) | intended values for keys it defines | reading it is a STAGING action (not authorized); it may not define Harness keys (ABSENT is then the intent); values may differ from the running daemon's `pm2_env` |
| Fresh r3 `dump_env_dual` observation | current state, both fields | **an observation, not automatically the desired baseline**; requires K-B2 adoption; a PM2 client invocation (§5.6) |
| `dump.pm2` | — | **prohibited** source (exposes env values; investigation §12.3) |
| Ecosystem file / PM2 start command history | would be intent | none located in repository evidence; not claimed |

### 3.5 Frozen non-claims for §3

Nothing in §3 declares P2 or P3 satisfied, trivially or otherwise; nothing designates a baseline; nothing waives a requirement; the OUTCOME_UNKNOWN_POLICY reopen gate (§8) is unsatisfied.

---

## 4. Host/app HOLD and recovery (FROZEN)

### 4.1 Scope of HOLD

HOLD attaches to **(host, app, named-key set)** — not to a vault directory, run ID, journal file, or operator process. Once any run has latched UNKNOWN for app A on host H, or any unrecorded `--update-env`/restart history exists for A, HOLD on (H, A) persists until an S2 gate passes for (H, A). Creating a new vault (`--vault <new dir>`, `orchestrate.py` l.799), a new run ID (`vault.py` l.343), a new operator checkout, or a new archive extraction **does not** move (H, A) out of HOLD.

### 4.2 What is blocked vs what is permitted while UNKNOWN is latched

| Activity | Status | Basis |
|---|---|---|
| New canary submission; new overlay apply (`restart --update-env` with canary values) on (H, A) | **BLOCKED** pending the applicable S2 gate and S3/S4 | §6.3; §8 |
| Automatic overlay retry | **BLOCKED** | §6.1 |
| A **separately Keith-authorized recovery attempt**: restore-direction `restart --update-env` with the preserved baseline payload, on (H, A), while UNKNOWN remains latched | **PERMITTED** when authorized; the attempt **cannot clear UNKNOWN** and its own fate is journaled | §6.1 ("Restore may still be attempted, but the attempt cannot clear UNKNOWN"); r3 §4.3 |
| Comparison-only reads (`jlist`) for P6 or diagnosis | **PERMITTED** when authorized; side effects per §5.6 | §12.3 dual-field row |
| Requiring CLEAN *before* a recovery attempt | **NOT REQUIRED** (would make recovery impossible under HOLD) | §6.1 |

### 4.3 Prohibited in every outcome

No latch clearance (`unknown_overlay.json` deletion or edit), no journal rewrite (`overlay_commands.json` terminal changes), no deletion or truncation of `pending_apps.json`, `protected/*.value`, `metadata.json`, `restore_result.json`, no directory rotation or `--vault` redirection used to obtain a fresh `refuse_unresolved_vault` pass, no production `fence_proof` provider or override, no automatic or inferred CLEAN. Historical UNKNOWN records remain records (r3 §16.3).

### 4.4 Operational enforcement requirements (no code guard exists; these are procedure)

r3's `refuse_unresolved_vault` and `.run.lock` are **`vault_dir`-scoped** (`vault.py`; `orchestrate.py --vault`). They do not see another vault directory, another operator account, a watchdog, a reconnecting client, or a manual `pm2` command. Therefore an S2 gate or any recovery attempt must additionally record, as operator procedure:

- **E1 — Vault registry:** one designated vault path per (H, A) recorded in the control plane before the first authorized run; any run with a different `--vault` for the same (H, A) is a governance violation, not a fresh start.
- **E2 — Host ledger:** every `pm2` client invocation against H during the window (command, app, purpose, wall time, operator, exit status, ack/uncertain fate) recorded outside the vault, so that (H, A) history exists independently of any one run directory.
- **E3 — Exclusivity window:** P4 attestation (§5.1) must cover the *entire* interval from the earliest unresolved attempt to the P6 read, not the P6 read alone.
- **E4 — No manual `pm2` writes** (`restart`, `reload`, `save`, `update`, `resurrect`, `kill`, `delete`, `--update-env`) on H by anyone during the window except the recorded attempts.
- **E5 — Invalidation:** any E4 violation, daemon restart, or deploy re-latches HOLD for (H, A) regardless of vault state.

These are requirements for a later window; this freeze does not claim they were met.

---

## 5. Evidence procedures — proposals only (nothing authorized; no verifier or child registered)

### 5.1 P4 attestation form (proposal)

Bounded scope: host H, apps A, window [T0, T1]. Required inputs and their provenance:

| Item | Evidence | Provenance |
|---|---|---|
| No concurrent 01C6A overlay CLI | E2 ledger shows no other operator run; `.run.lock` holder absent for the registered vault (E1) | operator ledger + vault state (names only) |
| No other authorized overlay dispatcher | statement that no other registered task holds STAGING/PM2 authorization in [T0,T1] (TASKS.md board); `monitoring/watchdog/ops-watchdog.js` is not a PM2 writer (investigation §12.2 P4 row) | control plane + locked investigation |
| No competing `--update-env` | passive read-only observation at T0 and T1: `rpc.sock` holders (investigation A8 method), `pm2` processes in the process table (names/args only, values redacted) | STAGING read-only (separate authorization) |
| Point-in-time limit | attestation states that observations are point-in-time and that P4 is an *operational* claim by the attesting human, not a source finding | — |

Redacted output: app names, key names, presence classes, PIDs, timestamps. No env values. **Stop conditions:** any `rpc.sock` holder other than the daemon and the recorded client; any `pm2` process not in the ledger; any daemon PID change vs §12.1.2 (844871 at 2026-09-18). **Expiry:** at T1, at any E5 event, or after a Keith-set maximum window.

### 5.2 P5 attestation form (proposal)

| Item | Evidence | Provenance |
|---|---|---|
| Operator-owned `pm2 restart … --update-env` / `jlist` children absent | process-table listing filtered to the operator user and `pm2` argv (names only), at T1 and immediately before the P6 read | STAGING read-only |
| Journal cross-check | every `DISPATCHED` attempt in the registered vault journal has a terminal; UNCERTAIN attempts are listed by id (they remain UNCERTAIN) | vault (names only) |
| Explicit limit statement | "proves client absence, not daemon quiescence; insufficient alone" (§6.4 P5 verbatim) | — |

Stop condition: any operator `pm2` child present. Expiry: immediately after the P6 read completes (a later child invalidates it).

### 5.3 P6 comparison-only procedure (proposal)

Inputs: reference R = B(H) if K-B2 = YES, else the run's preserved dual-field baseline (with the §3.4 item 5 caveat recorded); named apps/keys; P4 and P5 attestations dated within validity.

Steps:
1. Confirm P4/P5 valid at start (§5.1, §5.2).
2. One `pm2 jlist` read per app set (r3 `CliPm2._pm2_env`, or its manual equivalent), taking **both** `pm2_env[k]` and `pm2_env.env[k]` per named key (r3 `dump_env_dual`, §4.8).
3. Classify each field SET/EMPTY/ABSENT; for SET secrets compute the presence token; compare to R on both fields. Any top/nested divergence = `DIVERGENT` → P6 **FAIL** (latent merge) — never "close enough".
4. Record: per app/key/field MATCH / MISMATCH / DIVERGENT, read timestamp, daemon PID, R identity. No values.
5. Repeat step 2–4 once after a Keith-set dwell (bounded); both reads must match. Two matching reads are still point-in-time (PM2-FENCE-01 §4 "Repeated jlist … matching baseline").

Output: redacted P6 record. **P6 PASS means:** named keys matched R on both fields at the read times. **P6 PASS does not mean:** any UNCERTAIN attempt's fate is known, no buffered frame exists, or a fence exists. The latch is **not** cleared by P6; S2 CLEAN is a control-plane record that P2–P7 are all satisfied, and even then the vault marker is retained as history (§4.3).

Stop conditions: any read failure (`BASELINE_READ_FAILED` / `BASELINE_APP_MISSING` / `BASELINE_APP_DUPLICATE` semantics), any DIVERGENT, P4/P5 expiry during the procedure, daemon PID change. Expiry/invalidation of a P6 record: any E5 event; any `pm2` write on (H, A); daemon restart; deploy; a Keith-set maximum age.

### 5.4 Expiry summary

An S2 CLEAN record is valid only for (H, A, key set, [T0, T1], daemon PID). It expires at the earliest of: T1; E5 event; daemon PID change; `pm2 save`/`update`/`resurrect`; deploy of A; Keith revocation. Expired CLEAN → HOLD (no re-latch mechanics needed; HOLD is the default).

### 5.5 Manual procedure vs dedicated verifier

| Aspect | Manual procedure (§5.3 by an operator with `pm2 jlist` + `jq`/Python one-off, values never printed) | Dedicated comparison-only verifier (new bundle entry point or standalone script using `dump_env_dual` + `compare_restore_dual`) |
|---|---|---|
| Implementation | none; procedure text only | requires a registered IMPLEMENTATION child, tests, fake-verified evidence, r4 packaging |
| Redaction guarantee | depends on operator discipline (risk of printing values) | enforced in code (names/tokens only) — r3 already never prints values |
| Repeatability / evidence quality | free-form; two operators may classify differently | deterministic record; machine-checkable DIVERGENT |
| Side effects | identical: one `pm2 jlist` client per read (§5.6) | identical |
| Availability | now (after authorization) | after a child lifecycle |
| Failure modes | human error in SET/EMPTY/ABSENT or token computation | code defects (mitigated by tests; r3 already contains the read/compare code paths, fake-verified) |

**Smallest sufficient option (assessment, not selection):** the r3 tree already contains `dump_env_dual` and `compare_restore_dual` (PM2-OVERLAY-UNKNOWN-01 W1/W3, K4 GREEN). A verifier would be a thin entry point around existing code — smaller than a manual procedure's redaction risk suggests, but still an implementation child with its own lifecycle. A manual procedure is sufficient for a **one-off** first S2 gate if the operator is bound by §5.3 step 4 redaction and two-person review; a verifier becomes the smaller option once more than one gate is anticipated. **K-B3** decides; nothing is registered here.

### 5.6 PM2 client side-effect model (corrects the registration's over-broad wording; grounded per call path)

The canonical Step 1 body stated that "any `pm2` CLI or RPC invocation … may be merged/persisted by the daemon, forwards the client's allowlisted environment". That is too broad. The correct, call-path-grounded model (investigation §12.2 transport facts; r3 `CliPm2`) is:

| Effect | Applies to | Basis | Does **not** apply to |
|---|---|---|---|
| **Connection** to `rpc.sock`; auto-reconnect with backoff; **no request timeout** in the client path | **every** `pm2` client command (`jlist`, `restart`, `ping`, …) | `Client.executeRemote` → `ReqSocket.send`; `Socket.connect` auto-reconnect (`sock.js` l.286–298); queue replay on connect (`queue.js`) | — |
| **Daemon auto-launch** if `pingDaemon` fails: `Client.start` launches a new daemon **from the client's environment** (`PM2_HOME`/`HOME` selects the daemon home) | any client command reaching `Client.start` when no daemon answers | `Client.js` l.51–67 (investigation §12.2 matrix row "Daemon absent") — whether `jlist` specifically takes this path was **not separately traced**; treat as possible until traced | — |
| **Client env forwarding into an app's `pm2_env.env`** (merge at `ActionMethods.js` l.405) | **only** `restart … --update-env` (and equivalent `_operate` actions that construct `new_env` from `process.env` + `envs`, `API.js` l.1361–1369) | §12.2 env-mutation point; r3 restricts the forwarded set via `_child_env_for_pm2` (l.207–215; live-binary allowlist `PATH HOME LANG LC_ALL TEMP TMP` + Windows-only keys + overlay) | `jlist` / `getMonitorData` (a read of live `pm2_env` references, `Methods.js` l.82); `ping` |
| **Process on host** (a Node process under the operator user; inherits the operator's **full** environment for `jlist` because `_pm2_env` calls `check_output` without `env=`, l.276–280) | every client command | r3 code | — (the inherited environment matters only if the auto-launch path is taken or a future command forwards it) |
| **Persistence** to `dump.pm2` | only `pm2 save` / `dump` / `update` / signal-driven `gracefullExit`; **not** `pm2 kill` | §12.2 persistence paths | `jlist`, `restart` alone |

Consequences for P6: a comparison-only `jlist` does **not** merge or persist client environment into any app; it **does** open a connection, may auto-launch a daemon if none is running (a mutation of host state), and is a process P5 must account for. "Read-only comparison" is therefore accurate about *env mutation* and inaccurate as "side-effect-free". This correction is carried into this task's canonical body in Step 2; it does not edit PM2-FENCE-01, the investigation, or r3.

---

## 6. Risk acceptance (FROZEN framing; no acceptance recorded)

### 6.1 P1 versus P7

- **P1** (policy approval) is a *contract* decision: the platform agrees that UNKNOWN-latching-plus-attested-recovery is an acceptable **shape** of procedure. It is host- and time-independent and belongs to this task (S1).
- **P7** (risk acceptance) is a *host-and-time* attestation: for host H at time T, with the specific unresolved attempts (or first-run history, if A4) listed, Keith accepts that a delayed daemon-side mutation may still occur after CLEAN. It belongs to S2 and must be re-given for every gate. **Approving P1 records nothing under P7.**

### 6.2 What a delayed daemon mutation could still do (plain statement; no likelihood estimated)

If an earlier `restart --update-env` frame reached the daemon and merged at `ActionMethods.js` l.405 but its spawn did not occur, or was interrupted, or the merge sits in `pm2_env.env` only:

- the **next crash / auto-restart** of the app (`God.handleExit` → `executeApp(proc.pm2_env)`) spawns the app with the merged values **without any client command**;
- for `aisandbox-ai-service`, `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` (and a dummy `XAI_API_KEY`, a canary HMAC secret) would then be a **standing** module-load capability change on the shared worker (EXEC-01C6 §5.3 flag-scoping rule) until someone notices and restores;
- for `aisandbox-api-gateway` (xAI path), `GLOBAL_EXECUTION_ENABLED` / HMAC changes would alter the Ask gate state BUILDER-LIVE-GATE-01 left ON;
- if a `pm2 save` / `update` / signal-exit dump ran after the merge, the merged values **persist across daemon restarts** via `resurrect`;
- a kernel-buffered frame from a killed client whose bytes were not yet read could be read later and produce the same outcome.

No evidence exists to estimate how likely any of these is on staging (investigation §12.1.3 (c) loaded-code UNKNOWN; F1 NOT ESTABLISHED). This freeze records the consequences, not a probability.

### 6.3 Snapshot does not resolve fate

A matching dual-field snapshot (P6 PASS) shows the daemon's *current* `pm2_env` / `pm2_env.env` for the named keys. It does not show whether an UNCERTAIN attempt's frame was read, whether a stop/start is still in progress, or whether a buffered frame remains. It is therefore not F1, F2, F3, or a fence (PM2-FENCE-01 §4; §6.5). The r3 result class for a fully acked, matching production run is `RESTORE_ATTEMPTED_ACKED_MATCHED_UNPROVEN` for exactly this reason (`OPERATOR-BUNDLE.md` F5 boundary).

---

## 7. Acceptance compatibility — r3 mandatory INCOMPLETE vs EXEC-01C6A (unresolved; must be decided before any live run)

### 7.1 The mechanic (static reading of tracked r3; not executed)

`orchestrate.py` l.698–734: `next_canary_allowed` requires `restore_ok` / `overlays_restored`; `OBSERVATION_COMPLETE` requires either `next_canary_allowed` or (`accepted.intended_accepted` **and** `network_independent == "PASS"` **and** `restore_ok`). Production `fence_proof` is constant `NONE` with no input path (PM2-OVERLAY-UNKNOWN-01 §10.3.A / §16.3), so `restore_ok=False` always → classification **`INCOMPLETE`**, exit **3** (l.952–953), `next_canary_allowed=False`, result class at best `RESTORE_ATTEMPTED_ACKED_MATCHED_UNPROVEN`. `bin/restore-overlays.sh` exits 1 while `ok=False`.

### 7.2 EXEC-01C6A criteria affected (identified; **not amended**)

| EXEC-01C6A criterion (source) | Effect of mandatory INCOMPLETE |
|---|---|
| EXEC-01C6 §16 item 1 — "Restore process-scoped Harness flags, HMAC secret, … on the staging processes that were changed" (every exit path) | r3 *attempts* restore on every path but can never *certify* it; the operator's own tool reports INCOMPLETE even when every restore acked and matched |
| EXEC-01C6 §16 item 2 — "Do not leave harness flags enabled on the shared worker" | proof of this requirement cannot come from r3's success bit; it can only come from an S2-style P6 record plus P7 acceptance |
| EXEC-01C6 §16 item 9 — working-tree / evidence expectations; CANARY-EVIDENCE §12.3 exit-code matrix (`0` intended evidence … `3` incomplete observations) for the **canary scripts** | the canary scripts' exit codes are independent of the orchestrator's; but the bundle's orchestrated flow gates the **next** canary on `next_canary_allowed` (`allows_next_canary`), so the xAI-negative canary after the stub canary is **structurally blocked** inside the bundle flow |
| CANARY-EVIDENCE §4 "PM2 restoration remains unresolved" and §4.1 step 4 "do not destroy recovery information … until restore is verified" | consistent with r3 retention; but "restore is verified" now has no in-bundle path — verification must be external (P6) |
| EXEC-01C6A body Step 2 "Reopen requires … explicit UNKNOWN-pending-overlay recovery policy" | a policy contract alone (S1) does not resolve the acceptance mismatch; a live run under S1 would still end INCOMPLETE |

### 7.3 Unresolved choices and consequences (presented, not selected)

| Choice | Meaning | Consequences |
|---|---|---|
| **C1 — External acceptance.** Treat r3 `INCOMPLETE` + `RESTORE_ATTEMPTED_ACKED_MATCHED_UNPROVEN` as the *expected* orchestrator result, and accept EXEC-01C6A restoration criteria via a separate P6 record + P7 attestation (S2 procedure applied post-run) | requires a later explicit EXEC-01C6A amendment (its stage-start / AC / evidence doc) by its own control-plane step; the two-canary sequence must be re-planned because `next_canary_allowed` will not release the xAI canary in-bundle (either two separately authorized runs each with its own S2 gate, or an amended flow — implementation scope) |
| **C2 — Proof provider.** Give the bundle an authorized production `fence_proof` input so `restore_ok` can be True | this is OUTCOME_FENCE territory: no F1–F5 mechanism is established (investigation §12.2; PM2-FENCE-01 M1 false); would require a new fencing successor and implementation; **not available from existing evidence** |
| **C3 — Remain blocked.** Do not run EXEC-01C6A on the shared staging PM2 worker under the overlay procedure | HARNESS-RESTART-GOV-01 option B/C territory; would be a new selection under the Next-Work Selection Protocol, not this task |

**Frozen rule:** none of C1–C3 may be chosen implicitly. Evidence fields (`commands_acked`, `snapshot_matched`) are **not** acceptance. EXEC-01C6A, its stage-start, and its evidence document are **not** edited by this task in any step. Resolution (**K-C**) is required before any live run and is recorded as a Keith decision in Step 3 *as a direction*; the actual EXEC-01C6A amendment, if C1, is a later separately authorized control-plane step.

---

## 8. Decision matrix and checkpoint (FROZEN; Step 3 applies; this window selects nothing)

### 8.0 Controlling Step 2 correction of the matrix (2026-09-18, Keith-directed; base commit `8433346a47bb194295aa60675f5afc46bc358997`)

The matrix originally frozen in this section (retained verbatim below as §8.1-H / §8.2-H, **not controlling**) had three defects: (1) K-B3's values (MANUAL / VERIFIER / NEITHER) were evaluated as if they were YES/NO amendment answers in R2/R3; (2) R0 could override an explicit K-A approval merely because an independently selectable amendment or later host evidence was unresolved; (3) the mapping was not exhaustive for valid combinations. §8.1–§8.2c below are controlling. No Step 3 selection is made here; `OUTCOME_SELECTED=NONE`, `POLICY_AUTHORIZED=NO`.

### 8.1 Decision classes (controlling; Step 3 records exactly one value per ID)

Three classes. Only class I and class II drive the outcome row. Classes III and IV are **recorded separately** in every row and grant nothing.

**Class I — Policy contract**

| ID | Decision | Allowed values |
|---|---|---|
| **K-A** | Authorize the UNKNOWN_PENDING_OVERLAY recovery policy (P1) with P2–P8 recorded in their frozen §6.4 meanings, as amended **only** by class II decisions that are *complete affirmatives* | APPROVE / REFUSE / UNRESOLVED_INPUT |

**Class II — Substantive contract amendments** (A1, A2, A4; each independently selectable; none is a prerequisite of another or of K-A)

| ID | Amendment | Allowed values | *Complete affirmative* means |
|---|---|---|---|
| **K-B1** | A1 first-run applicability amendment — different first-run prerequisites (a)–(c) for P2/P3 (§3.3; §3.2 correction applies: P2/P3 remain binding; not a satisfaction claim; no run or vault verified; reopen gate unsatisfied) | YES / NO / UNRESOLVED_INPUT | YES |
| **K-B2** | A2 authoritative expected baseline B(H) required before any first run, **with** explicit accepted provenance from the §3.4 candidates | YES(+provenance) / NO / UNRESOLVED_INPUT | YES **and** the record names the accepted §3.4 source candidate(s), the provenance chain accepted (§3.4 item 3), and the validity conditions accepted (§3.4 item 4). **YES without that provenance is an INCOMPLETE_AFFIRMATIVE**: recorded verbatim as "YES — provenance not stated", mapped as *not approved* (equivalent to UNRESOLVED_INPUT for row selection), never as approval and never as refusal. No provenance is inferred, supplied, or invented by the control plane. |
| **K-B4** | A4 P7 first-run wording (wording only; never a P7 attestation) | YES / NO / UNRESOLVED_INPUT | YES |

**Class III — Procedure selection** (not an amendment; not a YES/NO question; never evaluated in R2/R3)

| ID | Selection | Allowed values | Effect of recording |
|---|---|---|---|
| **K-B3** | P6 comparison-only procedure form (§5.3 / §5.5) | MANUAL / VERIFIER / NEITHER / UNRESOLVED_INPUT | MANUAL: §5.3 procedure text becomes the frozen manual form a later S2 window must follow — **not authorized to run**. VERIFIER: a verifier child *may later* be registered by a separate control-plane step — **none is registered by this task**. NEITHER: P6 has no authorized procedure; S2 impossible until one is authorized. UNRESOLVED_INPUT: recorded as open. No value grants execution, STAGING, PM2, or reopen permission. |

**Class IV — Acceptance direction** (not an amendment; never evaluated in R2/R3)

| ID | Direction | Allowed values | Effect of recording |
|---|---|---|---|
| **K-C** | r3 mandatory INCOMPLETE vs EXEC-01C6A acceptance (§7.3) | C1 / C2 / C3 / UNRESOLVED_INPUT | Direction only. C1 requires a later, separately authorized EXEC-01C6A amendment step; C2 is not available from existing evidence and would require a fencing successor; C3 returns the question to the control plane. No value amends EXEC-01C6A, changes `startCondition`, or grants execution permission. |

Rules across classes: K-A is independent of class II — approval may be recorded with every amendment refused or unresolved. Class II values cannot be complete affirmatives if K-A = REFUSE (they are recorded but void, "not applicable — policy refused"). Class III/IV values are recorded whatever K-A is. Silence on any ID is **not** a value; it is handled by §8.2 R0 only if it prevents interpreting K-A, otherwise the ID is recorded as `NOT_RECORDED` and treated as UNRESOLVED_INPUT for that ID alone.

### 8.2 Outcome mapping (controlling; exhaustive and disjoint over K-A; class II decides R2 vs R3 only)

**Three kinds of "unresolved" — never conflated:**

| Kind | Definition | Matrix effect |
|---|---|---|
| **(U-i) Interpretive gap** | Information missing that is necessary to interpret the *current* K-A decision itself: K-A absent, ambiguous, conditional on a fact not in the record ("approve if host history is clean"), or referencing an amendment text that is not recorded | R0 — the only case where the outcome is withheld |
| **(U-ii) Explicit UNRESOLVED_INPUT choice** | Keith records UNRESOLVED_INPUT as the value of an ID | K-A → R4. Any class II/III/IV ID → that ID is recorded OPEN; K-A's row is **not** affected |
| **(U-iii) Later-window operational evidence** | P4 / P5 / P6 records, P7 attestation, B(H) values, host history attestation, daemon identity, r3 transfer — evidence intentionally required only in a later host window (S2) or later step (S3/S4) | **Never a matrix input.** Its absence cannot move any row, cannot block R2/R3, and cannot be inferred as approval of anything |

No missing information of any kind is ever inferred as approval.

**Rows (exactly one applies):**

| Row | Condition on K-A | Condition on class II (K-B1, K-B2, K-B4) | Outcome | Lock effect |
|---|---|---|---|---|
| **R0** | (U-i) interpretive gap — K-A cannot be read as exactly one of APPROVE / REFUSE / UNRESOLVED_INPUT | — | **OUTCOME_UNRESOLVED_INPUT** `cause=INTERPRETIVE_GAP` | No policy; the missing information listed verbatim; Keith may re-record in a later Step 3; HOLD unchanged |
| **R1** | REFUSE | any (all class II recorded void) | **OUTCOME_POLICY_REFUSED** | Lock records refusal; OUTCOME_UNKNOWN_POLICY path closed for now; HARNESS-RESTART-GOV-01 R1 successor question returns to the control plane; HOLD unchanged |
| **R2** | APPROVE | **zero** complete affirmatives (each of K-B1, K-B2, K-B4 ∈ {NO, UNRESOLVED_INPUT, INCOMPLETE_AFFIRMATIVE, NOT_RECORDED}) | **OUTCOME_POLICY_APPROVED_UNAMENDED** | **Contract approval only** (S1): contract = frozen §6.4 exactly. Open amendments listed as OPEN (decidable only by a later explicit governance record, never by silence). §2 contract-only rule text mandatory |
| **R3** | APPROVE | **one or more** complete affirmatives | **OUTCOME_POLICY_APPROVED_AMENDED** | **Contract approval only** (S1) with **only** the complete-affirmative amendment texts applied verbatim as *prerequisites* for future runs; NO / OPEN / INCOMPLETE amendments recorded as such and not applied. §2 contract-only rule text mandatory. Does **not** imply host CLEAN, satisfied operational evidence (P2–P7 for any host/run), a verified run outcome or vault, or reopen permission; reopen gate remains UNSATISFIED until S2 host evidence and S3 are separately approved |
| **R4** | UNRESOLVED_INPUT (explicit, U-ii) | — | **OUTCOME_UNRESOLVED_INPUT** `cause=EXPLICIT_UNRESOLVED` | No policy; class II/III/IV values still recorded; HOLD unchanged |

Exhaustiveness: K-A is either uninterpretable (R0) or exactly one of REFUSE (R1), UNRESOLVED_INPUT (R4), APPROVE (R2 xor R3, decided by whether the count of complete affirmatives is 0 or ≥ 1). No other K-A state exists; no two rows can match.

**Separate records (present in every row; never change the row; grant nothing):**

```
PROCEDURE_SELECTION=<K-B3 value>      # MANUAL / VERIFIER / NEITHER / UNRESOLVED_INPUT / NOT_RECORDED
ACCEPTANCE_DIRECTION=<K-C value>      # C1 / C2 / C3 / UNRESOLVED_INPUT / NOT_RECORDED
```

Neither record authorizes execution, STAGING, PM2, ENV, CREDIT, PROVIDER-LIVE, a verifier implementation, an EXEC-01C6A amendment, a `startCondition` change, or reopen.

**Safety rules (controlling):** missing evidence stays missing; nothing defaults to APPROVE or REFUSE; (U-iii) evidence is never a matrix input; K-B3 and K-C never select or alter a row; no row attests P4/P5/P7, declares CLEAN, verifies a run outcome or vault, designates B(H) values, registers a child, amends EXEC-01C6A, or touches `startCondition`; every contract-only lock restriction in §2 applies to R2 and R3 alike. The six decisions remain separate: policy authorization (K-A); first-run applicability amendment (K-B1); baseline provenance (K-B2); comparison procedure (K-B3); host/time-specific residual-risk acceptance (P7 — S2 attestation, never recorded by this task; K-B4 decides wording only); acceptance-contract compatibility (K-C).

### 8.2a Static verification of the controlling matrix (illustrative combinations only — **none records Keith's actual choices**)

| # | K-A | K-B1 | K-B2 | K-B4 | K-B3 | K-C | Row | Outcome | Separate records | What is **not** granted |
|---|---|---|---|---|---|---|---|---|---|---|
| V1 | APPROVE | UNRESOLVED_INPUT | UNRESOLVED_INPUT | UNRESOLVED_INPUT | VERIFIER | UNRESOLVED_INPUT | R2 | POLICY_APPROVED_UNAMENDED; A1/A2/A4 OPEN | PROCEDURE_SELECTION=VERIFIER (child may later be registered by a separate step; none registered); ACCEPTANCE_DIRECTION=UNRESOLVED_INPUT | no verifier implementation, no S2, no reopen |
| V2 | APPROVE | NO | NO | NO | MANUAL | C3 | R2 | POLICY_APPROVED_UNAMENDED; contract = frozen §6.4 exactly | PROCEDURE_SELECTION=MANUAL (§5.3 text frozen; not authorized to run); ACCEPTANCE_DIRECTION=C3 | no procedure execution, no S2, no reopen |
| V3 | APPROVE | YES | NO | NO | NEITHER | C1 | R3 | POLICY_APPROVED_AMENDED; A1 applied as prerequisites only; A2/A4 refused | PROCEDURE_SELECTION=NEITHER (S2 impossible until a procedure is authorized); ACCEPTANCE_DIRECTION=C1 (later separate EXEC-01C6A amendment step required) | no host CLEAN, no P2/P3 satisfaction, no run/vault verified, no reopen |
| V4 | REFUSE | YES | YES(+provenance) | YES | MANUAL | C1 | R1 | POLICY_REFUSED; all class II void ("not applicable — policy refused") | PROCEDURE_SELECTION=MANUAL; ACCEPTANCE_DIRECTION=C1 (recorded; inert) | nothing |
| V5 | UNRESOLVED_INPUT | NO | NO | NO | MANUAL | C3 | R4 | OUTCOME_UNRESOLVED_INPUT `cause=EXPLICIT_UNRESOLVED` | PROCEDURE_SELECTION=MANUAL; ACCEPTANCE_DIRECTION=C3 (recorded; inert) | nothing |
| V6 | APPROVE | NO | "YES" — provenance not stated | NO | MANUAL | C3 | R2 | POLICY_APPROVED_UNAMENDED; K-B2 recorded INCOMPLETE_AFFIRMATIVE / OPEN (**not** R0: K-A is interpretable; **not** R3: no complete affirmative) | PROCEDURE_SELECTION=MANUAL; ACCEPTANCE_DIRECTION=C3 | no B(H) designated; no provenance inferred |
| V7 | APPROVE | UNRESOLVED_INPUT | YES + explicitly named §3.4 candidate, accepted provenance chain and validity conditions (placeholder — no candidate named here) | UNRESOLVED_INPUT | UNRESOLVED_INPUT | UNRESOLVED_INPUT | R3 | POLICY_APPROVED_AMENDED; A2 applied (B(H) *required*, provenance class accepted); A1/A4 OPEN | PROCEDURE_SELECTION=UNRESOLVED_INPUT; ACCEPTANCE_DIRECTION=UNRESOLVED_INPUT | no B(H) **values** designated; no P6 procedure; no S2 |
| V8 | "approve if host history is clean" (conditional on U-iii evidence) | — | — | — | — | — | R0 | OUTCOME_UNRESOLVED_INPUT `cause=INTERPRETIVE_GAP`; gap listed verbatim | as recorded, if any | nothing |
| V9 | APPROVE | YES | NO | NO | UNRESOLVED_INPUT | UNRESOLVED_INPUT | R3 | POLICY_APPROVED_AMENDED (A1 only); class III/IV OPEN — **does not** demote to R0 or R2 | PROCEDURE_SELECTION=UNRESOLVED_INPUT; ACCEPTANCE_DIRECTION=UNRESOLVED_INPUT | no procedure, no S2, no reopen |

Checks: every row of V1–V9 matches exactly one R-row; V1 and V9 confirm unresolved class II/III/IV values never produce R0; V6 confirms an incomplete K-B2 affirmative is neither approval nor an interpretive gap; V4 confirms class II is void under REFUSE; V2/V3 confirm K-B3 is recorded, not evaluated. Later host evidence (U-iii) appears in no column because it is not a matrix input.

### 8.1-H Superseded decision table (historical; **not controlling** — replaced by §8.1 under the §8.0 correction)

| ID | Decision | Allowed values |
|---|---|---|
| **K-A** | **Policy contract (P1):** authorize the UNKNOWN_PENDING_OVERLAY recovery policy with P2–P8 recorded in their frozen §6.4 meanings (as amended only by any K-B row answered YES) | APPROVE / REFUSE / UNRESOLVED_INPUT |
| **K-B1** | First-run **applicability amendment** A1 — approve different first-run prerequisites (a)–(c) for P2/P3. P2/P3 remain binding; YES is a contract amendment, **not** evidence that P2/P3 are satisfied for any host/run; no run outcome or vault is verified by this task; reopen gate stays unsatisfied until S2 host evidence and S3 are approved | YES / NO / UNRESOLVED_INPUT |
| **K-B2** | Authoritative expected baseline B(H) required before first run; accepted provenance (§3.4) | YES(+provenance) / NO / UNRESOLVED_INPUT |
| **K-B3** | P6 procedure form (§5.3): MANUAL / VERIFIER (child to be registered later) / NEITHER | MANUAL / VERIFIER / NEITHER / UNRESOLVED_INPUT |
| **K-B4** | P7 first-run wording A4 | YES / NO / UNRESOLVED_INPUT |
| **K-C** | Acceptance-compatibility direction (§7.3) | C1 / C2 / C3 / UNRESOLVED_INPUT |

K-A is independent of K-B1..K-B4: policy approval can be recorded with every amendment refused (contract = frozen §6.4 exactly) or unresolved. K-B rows cannot be answered YES if K-A = REFUSE.

### 8.2-H Superseded outcome rows (historical; **not controlling** — replaced by §8.2 under the §8.0 correction; defects: K-B3 evaluated as YES/NO in R2/R3; R0 could override explicit K-A approval; mapping not exhaustive)

| Row | Condition | Outcome | Lock effect |
|---|---|---|---|
| R0 | Any input Step 3 would need that is not in this document, the locked predecessors, or an explicit Keith statement recorded in Step 3 | **OUTCOME_UNRESOLVED_INPUT** | No policy; missing inputs listed verbatim; task may lock as "decision deferred" or remain open — Keith chooses; HOLD unchanged |
| R1 | K-A = REFUSE | **OUTCOME_POLICY_REFUSED** | Lock records refusal; OUTCOME_UNKNOWN_POLICY path closed for now; HARNESS-RESTART-GOV-01 R1 successor question returns to the control plane (fence path or option B/C); HOLD unchanged |
| R2 | K-A = APPROVE and every K-B ∈ {NO, UNRESOLVED_INPUT} | **OUTCOME_POLICY_APPROVED_UNAMENDED** | S1 only; §2 contract-only rule text mandatory; first run impossible until K-B2/K-B3 resolved or a prior-run vault exists |
| R3 | K-A = APPROVE and at least one K-B = YES | **OUTCOME_POLICY_APPROVED_AMENDED** | **Contract approval only** (S1) with amendment text recorded verbatim; §2 contract-only rule text mandatory; amendments apply only as recorded as *prerequisites* for future runs. R3 does **not** imply host CLEAN, does **not** imply any operational evidence (P2–P7) is satisfied for any host/run, does **not** verify any run outcome or vault, and does **not** grant reopen permission; the reopen gate remains UNSATISFIED until S2 host evidence and S3 are separately approved |
| R4 | K-A = UNRESOLVED_INPUT | **OUTCOME_UNRESOLVED_INPUT** | as R0 |

Historical safety rules (superseded by §8.2 controlling safety rules): missing evidence stays missing (no default to APPROVE or REFUSE); K-C is recorded alongside any R1–R3 outcome but never changes the row; no row attests P4/P5/P7, declares CLEAN, verifies a run outcome or vault, or touches EXEC-01C6A `startCondition`. The six decisions remain separate and are never collapsed: policy authorization (K-A); first-run applicability amendment (K-B1); baseline provenance (K-B2); comparison procedure (K-B3); host/time-specific residual-risk acceptance (P7 — an S2 attestation, never recorded by this task; K-B4 decides only its first-run *wording*); acceptance-contract compatibility (K-C).

### 8.3 What this task could lock (maximum) and what would still be required

**Could lock (Step 4, if Step 3 records R1, R2 or R3 under the controlling §8.2):** the S1 contract decision (or its refusal); the substantive amendment decisions K-B1 / K-B2 / K-B4 as text (complete affirmatives applied; others recorded NO / OPEN / INCOMPLETE); the procedure selection K-B3 as a record (no execution, no child registration); the K-C direction as a record (no EXEC-01C6A amendment); the §4 HOLD rules and §4.4 E1–E5 operational requirements as governance; the §5 procedure **proposals** as the frozen procedure text a later S2 window must follow (still not authorized to run); the §5.6 client model correction in this task's body.

**Would still be required after any lock (none supplied by this task):**

| Category | Item |
|---|---|
| Host evidence | P4 and P5 attestations for a named (H, A, window); P6 record; daemon PID / version re-confirmation; B(H) provenance if K-B2 = YES |
| Approvals | P7 attestation for that host/time (S2); P8 reopen authorization (S3); STAGING / PM2 / ENV / CREDIT / PROVIDER-LIVE as then required (S4); r3 staging transfer approval (currently NOT APPROVED FOR LIVE USE) |
| Implementation (separately registered) | verifier child if K-B3 = VERIFIER; any bundle flow change implied by K-C = C1 (two-run sequencing); nothing for K-C = C2 exists |
| Control-plane changes | EXEC-01C6A amendment step (if C1); `startCondition` write (S3); lane admission (S4); a vault registry record (E1) |

---

## 9. What this freeze does not authorize

Selecting any K row; P1 approval; recording P2–P8 as satisfied; host CLEAN; P7 acceptance; adoption of A1–A4; designating B(H) or reading `/opt/aisandbox/.env` / `dump.pm2`; running §5.1–§5.3; any `pm2` command; STAGING, PM2, ENV, CREDIT, PROVIDER-LIVE, LOCAL-RUNTIME, SSH, Docker, database, Redis, flags, key creation, canary submission, r3 transfer/extraction/execution, workflow dispatch, vendor fetch, browser, provider/credit; a verifier or any implementation child; editing PM2-FENCE-01, HARNESS-RESTART-GOV-01, PM2-DAEMON-INVESTIGATION-01, PM2-OVERLAY-UNKNOWN-01, EXEC-01C6 / 01C6A bodies or documents, the bundle, the workflow, the sidecar, the mutex catalog, the validator, PRD / ARCHITECTURE / CLAUDE / AGENTS; registering EXEC-01C6B / EXEC-01C7 / a fence successor; Lane 3; Git commit/push. Steps 3–4 are NOT AUTHORIZED.

## 10. Invariants unchanged

Lane 1 EMPTY; Lane 2 EMPTY; Lane 3 DISABLED; GOVERNANCE acquired transiently for this freeze then released UNOWNED; occupancy hash `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d`; no sidecar candidate; not in S; EXEC-01C6A `startCondition=NOT_READY`; Builder gate LEFT ON; Harness flags unchanged; product-visible Harness FUTURE / gated; PRIVATE-BETA-INVITE-01 PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.

## 11. Step 2 verdict

```
STEP_2_VERDICT=FREEZE_COMPLETE_DECISION_READY
OUTCOME_SELECTED=NONE
POLICY_AUTHORIZED=NO
DECISIONS_READY_FOR_KEITH=K-A, K-B1, K-B2, K-B3, K-B4, K-C
UNRESOLVED_INPUTS=host overlay history for (aisandbox-staging, named apps) [A1]; authoritative baseline provenance [A2]; P4/P5 attestations (none exist); daemon loaded-code identity (UNKNOWN, §12.1.3 (c)); r3 raw-hash-verified transfer to staging (not performed); EXEC-01C6A acceptance direction [K-C]
FIRST_RUN_AMENDMENT_ADOPTED=NO
P2_P3_REMAIN_BINDING=YES
RUN_OUTCOME_OR_VAULT_VERIFIED=NO
BASELINE_DESIGNATED=NO
VERIFIER_CHILD_REGISTERED=NO
EXEC_01C6A_AMENDED=NO
REOPEN_GATE_SATISFIED=NO
STEP_2_CORRECTION_2026_09_18=APPLIED (§3.2 controlling correction; A1 / K-B1 / R3 reworded; "P2/P3 prospectively satisfied" withdrawn)
STEP_2_CORRECTION_2_2026_09_18=APPLIED (§8.0 controlling matrix correction at base 8433346a47bb194295aa60675f5afc46bc358997; decision classes I policy / II substantive amendments A1 A2 A4 / III procedure selection K-B3 / IV acceptance direction K-C; K-B2 complete affirmative requires explicit accepted provenance, else INCOMPLETE_AFFIRMATIVE = not approved; R0 limited to interpretive gaps in K-A; U-i / U-ii / U-iii distinguished; mapping exhaustive over K-A; §8.2a static verification V1–V9 illustrative only; prior matrix retained as §8.1-H / §8.2-H not controlling)
DECISION_CLASSES=I K-A; II K-B1 K-B2 K-B4; III K-B3; IV K-C
PROCEDURE_SELECTION=NOT_RECORDED
ACCEPTANCE_DIRECTION=NOT_RECORDED
```

## 12. Activity ledger (Step 2 window, 2026-09-18)

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, canary submission=0, vendor fetch=0, network=0, workflow dispatched=0, r3 transferred/extracted/executed=0, Python executed=0, tests=0 except lane-capacity validator, mocks=0, imports=0, builds=0, installs=0, browser=0, subagents=0, bundle files edited=0 (static read only), workflow edited=0, sidecar edited=0, predecessor bodies edited=0, EXEC-01C6 / 01C6A documents or body edited=0, locked freezes edited=0, verifier/child registered=0, outcome selected=0, policy authorized=0, amendment adopted=0, baseline designated=0, P4/P5/P7 recorded=0, Git add/commit/push=0.
Writes: this document (new); `TASKS.md` this task's current board fields; `TASKS_BACKLOG_FULL.md` this task's body (status, lifecycle Step 2, §5.6 wording correction, Step 2 AC, Step 2 HEAD/ledger); `docs/control-plane/SATURATION_PROOF.json` as validator output only.

**Same-window bounded correction (2026-09-18, before commit, Keith-directed):** §3.2 controlling correction added; A1 proposed wording replaced (historical wording retained and marked not controlling); K-B1 (A1 table and §8.1) and R3 / safety rules (§8.2) reworded; §11 verdict keys added. No other section changed. Mirrors updated in this task's board fields and canonical body only. Validator rerun.

**Second bounded correction (2026-09-18, after commit `8433346a47bb194295aa60675f5afc46bc358997`, Keith-directed; matrix only):** §8.0 added; §8.1 decision classes, §8.2 outcome mapping, §8.2a static verification (illustrative V1–V9) added as controlling; prior §8.1 / §8.2 retained verbatim as §8.1-H / §8.2-H (not controlling); §8.3 "Could lock" reworded to the class structure; §11 keys added. No Step 3 selection made. No other section changed. Mirrors updated in this task's board fields and canonical body only. Validator rerun. No scripts, tests, runtime, SSH, staging, PM2, workflow dispatch, Git mutation, or subagents.

---

## 13. Step 3 — Explicit Keith decision record (2026-09-19; base `0add5cf6183911770bab8cd58598aa3c183a9eed`)

### 13.1 Authorization

Keith 2026-09-19 authorized **Step 3 only** and explicitly approved the decision set in §13.2. This step records those choices against the controlling matrix (§8.0–§8.2a). It does not authorize Step 4, lock the task, attest any host evidence, register any child, amend EXEC-01C6A, or change any sidecar or predecessor state.

### 13.2 The six recorded choices (one value per ID; recorded verbatim as approved)

| Class | ID | Recorded value | Classification under §8.1 |
|---|---|---|---|
| I — Policy contract | **K-A** | **APPROVE** | Interpretable; not conditional; not an interpretive gap |
| II — Substantive amendment A1 | **K-B1** | **UNRESOLVED_INPUT** | Explicit (U-ii) choice → A1 **OPEN**; not a complete affirmative; not approval; not refusal |
| II — Substantive amendment A2 | **K-B2** | **UNRESOLVED_INPUT** | Explicit (U-ii) choice → A2 **OPEN**; no provenance stated or inferred; no source or values designated |
| III — Procedure selection | **K-B3** | **VERIFIER** | Recorded separately; direction only; never evaluated in R2/R3 |
| II — Substantive amendment A4 | **K-B4** | **YES** | **Complete affirmative** (per §8.1: YES suffices for K-B4) |
| IV — Acceptance direction | **K-C** | **C1** | Recorded separately; direction only; never evaluated in R2/R3 |

### 13.3 Row selection — validated against the controlling §8.2

1. K-A is readable as exactly one of APPROVE / REFUSE / UNRESOLVED_INPUT → **not R0**.
2. K-A ≠ REFUSE → **not R1**. K-A ≠ UNRESOLVED_INPUT → **not R4**.
3. K-A = APPROVE → R2 xor R3, decided by the count of complete affirmatives among K-B1, K-B2, K-B4.
4. Complete affirmatives: K-B1 = UNRESOLVED_INPUT (0); K-B2 = UNRESOLVED_INPUT (0); K-B4 = YES (1). Count = **1 ≥ 1** → **R3**.
5. Class III (VERIFIER) and class IV (C1) are recorded and do not alter the row (§8.2 safety rules). Two OPEN class II items do not demote to R0 or R2 (§8.2 (U-ii); cf. illustrative V9).

**Selected row: R3 — `OUTCOME_POLICY_APPROVED_AMENDED`.**

### 13.4 What R3 records (contract approval only — S1)

**POLICY_AUTHORIZED=YES for the S1 policy contract only.** P1 is granted: the UNKNOWN_PENDING_OVERLAY recovery policy of PM2-FENCE-01 §6 is authorized as the recovery **contract**, with P2–P8 in their frozen §6.4 meanings (§3.1 verbatim) **as amended only by A4**. §6.1 (restore may be attempted but cannot clear UNKNOWN), §6.2 (recovery material never deleted), §6.3 (UNCLEAN / HOLD until the gate passes), §6.5 (forbidden proofs), the §3.2 controlling correction (P2/P3 remain binding; no run outcome or vault verified; first-run prerequisites are an amendment question, not satisfaction), the §4 HOLD rules and §4.4 E1–E5 operational requirements apply in full.

**Sole approved substantive amendment — A4 (P7 first-run wording), frozen text adopted verbatim from §3.3 A4 "Proposed wording":**

> "P7 for a first run covers the risk that a *pre-existing* unrecorded daemon-side mutation (not produced by the run) applies after CLEAN; P7 for later runs covers the recorded UNKNOWN attempts of prior runs as well."

A4 amends the **meaning** of P7 for first runs only. Per §3.3 A4 and §6.1: acceptance of the wording is **not** a P7 attestation for any host or time, does **not** accept residual risk for staging or any other host, and does **not** record P7 as satisfied. **P7_ACCEPTED=NO.**

**Open (not adopted; not refused; decidable only by a later explicit governance record, never by silence):**

- **A1 first-run applicability (K-B1 OPEN):** P2/P3 remain binding obligations with their frozen §6.4 meanings and no amended first-run prerequisites. No host-history attestation exists. **FIRST_RUN_AMENDMENT_ADOPTED=NO.** Consequence: a first run on a host with no prior vault has no approved way to meet P2/P3 until A1 (or an equivalent later record) is decided.
- **A2 baseline provenance (K-B2 OPEN):** no authoritative expected baseline B(H) is required or designated; no §3.4 source candidate is accepted; no values exist. **BASELINE_DESIGNATED=NO.** A current snapshot remains an observation, not a baseline.

**Separate records (grant nothing):**

```
PROCEDURE_SELECTION=VERIFIER
ACCEPTANCE_DIRECTION=C1
```

- `PROCEDURE_SELECTION=VERIFIER` — direction only. A comparison-only verifier (§5.3 / §5.5) is the selected P6 form. **No verifier child is registered, admitted, or implemented by this step**; any child requires a separate control-plane registration with its own lifecycle, sidecar candidate, saturation class, and admission. Until such a child is LOCKED and a P6 procedure is separately authorized to run, P6 has no executable procedure and S2 is impossible. **VERIFIER_CHILD_REGISTERED=NO.**
- `ACCEPTANCE_DIRECTION=C1` — direction only: r3's mandatory `INCOMPLETE` / `RESTORE_ATTEMPTED_ACKED_MATCHED_UNPROVEN` result is to be treated as the expected orchestrator result, with EXEC-01C6A restoration criteria to be accepted via a separate post-run P6 record plus P7 attestation. **This step does not amend, reinterpret, or execute EXEC-01C6A**; the actual amendment of EXEC-01C6A's stage-start / AC / evidence document is a later, separately authorized control-plane step (§7.3 C1 consequences, including re-planning the two-canary sequence). Evidence fields (`commands_acked`, `snapshot_matched`) remain **not** acceptance. **EXEC_01C6A_AMENDED=NO.**

### 13.5 Mandatory contract-only statement (§2)

**OUTCOME_UNKNOWN_POLICY reopen gate (PM2-FENCE-01 §8) remains UNSATISFIED; host remains UNCLEAN / HOLD; EXEC-01C6A `startCondition=NOT_READY` unchanged; no canary authorized.**

### 13.6 Sequence preserved (§2 four objects)

| Object | State after Step 3 |
|---|---|
| S1 policy contract | **APPROVED (R3; A4 only)** — this step |
| S2 host-specific gate | **NOT STARTED.** Requires, for a named (H, A, window): P4 and P5 attestations (§5.1, §5.2), an authorized and executed P6 procedure (needs the VERIFIER child first), P7 attestation for that host/time (under the A4 meaning for a first run), and — for a first run — a decided A1 (and A2 if required). None exists. **HOST_CLEAN=NO.** |
| S3 explicit reopen | **NOT AUTHORIZED.** P8 remains a separate Keith authorization after CLEAN. `startCondition=NOT_READY` unchanged. |
| S4 separately authorized canary | **NOT AUTHORIZED.** STAGING / PM2 / ENV / CREDIT / PROVIDER-LIVE not acquired; r3 NOT APPROVED FOR LIVE USE. |

HARNESS-RESTART-GOV-01 §3.3: item 1 (policy contract) is now recorded; items 2–4 remain outstanding.

### 13.7 Unresolved items carried forward (missing evidence remains missing)

| Item | Owner / where decided |
|---|---|
| A1 first-run applicability (K-B1 OPEN) | later explicit governance record |
| A2 baseline requirement and provenance (K-B2 OPEN); no B(H) values | later explicit governance record; §3.4 requirements govern |
| Verifier child registration, implementation, fake-verification, packaging | separate control-plane registration (not this task) |
| EXEC-01C6A C1 amendment step; two-canary sequencing under `next_canary_allowed=False` | separate control-plane step (not this task) |
| P4 / P5 attestations; P6 record; P7 attestation; daemon PID/version re-confirmation | later S2 host window |
| Host overlay history for (`aisandbox-staging`, named apps) | later S2 host window / A1 |
| r3 raw-hash-verified transfer to staging | later separately authorized window |
| P8 reopen; `startCondition` write; lane admission | S3 / S4 control-plane steps |

### 13.8 What Step 3 did not do

Did not: lock the task; authorize Step 4; attest P4, P5, P6, or P7; declare host CLEAN; adopt A1 or A2; designate a baseline source or value; register, admit, or implement a verifier or any child; amend, reinterpret, or execute EXEC-01C6A; change sidecar `startCondition`, `lockedTaskIds`, candidates, or occupancy; edit any predecessor body or locked freeze, the bundle, manifests, archive, or workflow; touch Harness flags or the Builder gate; run any `pm2` command; acquire STAGING / PM2 / ENV / CREDIT / PROVIDER-LIVE / LOCAL-RUNTIME; run local application code, tests, mocks, builds, installs, SSH, browser, or subagents; dispatch a workflow; commit or push.

### 13.9 Step 3 verdict

```
STEP_3_VERDICT=DECISION_RECORDED
K_A=APPROVE
K_B1=UNRESOLVED_INPUT
K_B2=UNRESOLVED_INPUT
K_B3=VERIFIER
K_B4=YES
K_C=C1
COMPLETE_AFFIRMATIVE_COUNT=1 (K-B4)
OUTCOME_SELECTED=R3 OUTCOME_POLICY_APPROVED_AMENDED
POLICY_AUTHORIZED=YES (S1 contract only; P1 granted; P2–P8 frozen meanings as amended only by A4)
SUBSTANTIVE_AMENDMENTS_ADOPTED=A4 (verbatim §3.3 A4 proposed wording)
A1_STATUS=OPEN / UNADOPTED
A2_STATUS=OPEN / no source or values designated
PROCEDURE_SELECTION=VERIFIER (direction only; no child registered or implemented)
ACCEPTANCE_DIRECTION=C1 (direction only; EXEC-01C6A not amended, reinterpreted, or executed)
P7_ACCEPTED=NO
HOST_CLEAN=NO
REOPEN_GATE_SATISFIED=NO
EXEC_01C6A_REOPENED=NO
EXEC_01C6A_START_CONDITION=NOT_READY (unchanged)
VERIFIER_CHILD_REGISTERED=NO
EXEC_01C6A_AMENDED=NO
BUILDER_GATE=ON (unchanged)
HARNESS_FLAGS=unchanged
STEP_4=NOT AUTHORIZED
LOCKED=NO
```

### 13.10 Step 3 activity ledger (2026-09-19)

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, canary submission=0, vendor fetch=0, network=0, workflow dispatched=0, r3 transferred/extracted/executed=0, Python executed=0, tests=0 except lane-capacity validator, mocks=0, imports=0, builds=0, installs=0, browser=0, subagents=0, bundle/manifests/archive edited=0, workflow edited=0, sidecar edited=0, lockedTaskIds edited=0, predecessor bodies edited=0, EXEC-01C6 / 01C6A documents or body edited=0, locked freezes edited=0, verifier/child registered=0, P4/P5/P6/P7 recorded=0, host CLEAN attested=0, Git add/commit/push=0.
Writes: this document (status header + §13 appended; §§0–12 preserved); `TASKS.md` this task's current board fields; `TASKS_BACKLOG_FULL.md` this task's body; `docs/control-plane/SATURATION_PROOF.json` as validator output only. GOVERNANCE acquired transiently for this decision record then released UNOWNED. Occupancy EMPTY.

---

## 14. Step 4 — Independent verification / checkpoint / lock (2026-09-19; base `93d36d2a7e49876144f8ca2c383872236250231e`)

### 14.1 Authorization

Keith 2026-09-19 authorized **Step 4 only**: verify the committed Step 3 decision record against the controlling freeze and lock this GOVERNANCE task if the checkpoint criteria are met. This step does not select or change Keith's choices, register a successor or verifier, amend EXEC-01C6A, or edit sidecar / `lockedTaskIds`. GOVERNANCE was acquired transiently for this checkpoint then released UNOWNED.

### 14.2 Criterion-by-criterion verification (committed record at `93d36d2a7e49876144f8ca2c383872236250231e`)

Keith's explicit choices (verified present in §13.2, board `PM2_RECOVERY_POLICY_01_STEP_3_DECISIONS`, and canonical body): K-A=APPROVE; K-B1=UNRESOLVED_INPUT; K-B2=UNRESOLVED_INPUT; K-B3=VERIFIER; K-B4=YES; K-C=C1.

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | R3 follows from exactly one complete affirmative: K-B4 | **PASS** | Controlling §8.2: K-A=APPROVE (not R0/R1/R4); class II complete affirmatives = {K-B4=YES}; K-B1 and K-B2 = UNRESOLVED_INPUT (0); count = 1 ≥ 1 → R3. Class III/IV do not alter the row. Matches §13.3 and illustrative V9. |
| 2 | A4 is the sole adopted substantive amendment, recorded verbatim | **PASS** | §13.4 quotes §3.3 A4 proposed wording verbatim: "P7 for a first run covers the risk that a *pre-existing* unrecorded daemon-side mutation (not produced by the run) applies after CLEAN; P7 for later runs covers the recorded UNKNOWN attempts of prior runs as well." No other class II YES. |
| 3 | A1 and A2 remain OPEN — not approved, refused, or implicitly resolved | **PASS** | K-B1=UNRESOLVED_INPUT → A1 OPEN / unadopted; K-B2=UNRESOLVED_INPUT → A2 OPEN. Explicit (U-ii); silence is not used. FIRST_RUN_AMENDMENT_ADOPTED=NO. |
| 4 | No expected baseline source or values designated | **PASS** | BASELINE_DESIGNATED=NO; no §3.4 candidate named; no B(H) values. |
| 5 | VERIFIER and C1 remain directions only: no child registration, implementation, or EXEC-01C6A amendment | **PASS** | PROCEDURE_SELECTION=VERIFIER; ACCEPTANCE_DIRECTION=C1; VERIFIER_CHILD_REGISTERED=NO; EXEC_01C6A_AMENDED=NO; no new canonical heading / stanza / sidecar candidate; EXEC-01C6A body and sidecar candidate untouched. |
| 6 | P1 authorizes the S1 contract only. P7_ACCEPTED=NO and HOST_CLEAN=NO | **PASS** | POLICY_AUTHORIZED=YES (S1 only); AUTHORIZES_P1=YES with S1 qualifier; K-B4 wording-only; ACCEPTS_RESIDUAL_RISK_P7=NO; ATTESTS_HOST_CLEAN=NO; P7_ACCEPTED=NO; HOST_CLEAN=NO. |
| 7 | Historical UNKNOWN, recovery retention, host/app HOLD, and new-canary vs separately authorized recovery distinction preserved | **PASS** | §§0–12 freeze text byte-stable except the status header; §4.1–§4.3 HOLD / blocked-vs-permitted / retention prohibitions unchanged; §13.4 applies §6.1 / §6.2 / §6.3 / §4 / E1–E5 in full; HOLD_PRESERVED=YES. |
| 8 | Committed Step 3 changes stay within the authorized four-file scope | **PASS** | `git show --name-only 93d36d2a7e49876144f8ca2c383872236250231e` lists only `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/PM2-RECOVERY-POLICY-01-STAGE-START.md`, `docs/control-plane/SATURATION_PROOF.json`. Sidecar occupancy EMPTY / GOVERNANCE UNOWNED; EXEC-01C6A `startCondition=NOT_READY`; this ID absent from `lockedTaskIds` (GOVERNANCE; no implementation candidate). |
| 9 | No claim treats the contract lock as satisfying the reopen gate | **PASS** | §13.5 and board `PM2_RECOVERY_POLICY_01_REOPEN_GATE_SATISFIED=NO` record the mandatory statement; SATISFIES_REOPEN_GATE=NO; REOPENS_EXEC_01C6A=NO; AUTHORIZES_CANARY=NO. |

**All nine criteria PASS. No blocker. Task is lockable.**

### 14.3 Acceptance object (what this lock accepts)

This lock accepts **only** the S1 governance decision:

- **Outcome:** R3 `OUTCOME_POLICY_APPROVED_AMENDED`
- **Contract:** UNKNOWN_PENDING_OVERLAY recovery policy (PM2-FENCE-01 §6; P1 granted; P2–P8 frozen §6.4 meanings) **as amended only by A4**
- **A4 (verbatim, P7 first-run wording only):** "P7 for a first run covers the risk that a *pre-existing* unrecorded daemon-side mutation (not produced by the run) applies after CLEAN; P7 for later runs covers the recorded UNKNOWN attempts of prior runs as well."
- **Directions recorded, not executed:** PROCEDURE_SELECTION=VERIFIER; ACCEPTANCE_DIRECTION=C1

This lock does **not** accept: host CLEAN; P4/P5/P6 evidence; a P7 host/time attestation; residual-risk acceptance for staging; A1; A2; a designated baseline; a verifier child; an EXEC-01C6A amendment; reopen; canary; r3 live use or transfer; a fence or F1–F5.

### 14.4 Mandatory contract-only statement (§2)

**OUTCOME_UNKNOWN_POLICY reopen gate (PM2-FENCE-01 §8) remains UNSATISFIED; host remains UNCLEAN / HOLD; EXEC-01C6A `startCondition=NOT_READY` unchanged; no canary authorized.**

Sequence after this lock: S1 APPROVED (this lock) → S2 host-specific gate NOT STARTED → S3 explicit reopen NOT AUTHORIZED → S4 separately authorized canary NOT AUTHORIZED. HARNESS-RESTART-GOV-01 §3.3 item 1 is recorded; items 2–4 remain outstanding.

### 14.5 Unresolved items carried forward (not silently resolved by this lock)

| Item | Status after lock |
|---|---|
| A1 first-run applicability (K-B1 OPEN) | OPEN; later explicit governance record |
| A2 baseline requirement and provenance (K-B2 OPEN); no B(H) values | OPEN; later explicit governance record; §3.4 requirements govern |
| Verifier child registration, implementation, fake-verification, packaging | not this task; separate control-plane registration required |
| EXEC-01C6A C1 amendment; two-canary sequencing under `next_canary_allowed=False` | not this task; separate control-plane step required |
| P4 / P5 attestations; P6 record; P7 attestation; daemon PID/version re-confirmation | later S2 host window |
| Host overlay history for (`aisandbox-staging`, named apps) | later S2 / A1 |
| r3 raw-hash-verified transfer to staging | later separately authorized window; r3 remains NOT APPROVED FOR LIVE USE |
| P8 reopen; `startCondition` write; lane admission | S3 / S4; sidecar `lockedTaskIds` and EXEC-01C6A candidate unchanged by this lock |

No successor and no verifier are registered by this lock.

### 14.6 What this lock does not do

Does not: edit sidecar occupancy, candidates, or `lockedTaskIds`; register a successor, verifier, EXEC-01C6B, EXEC-01C7, or fence successor; amend EXEC-01C6A or any predecessor; attest P4/P5/P6/P7; declare host CLEAN; adopt A1 or A2; designate a baseline; acquire STAGING / PM2 / ENV / CREDIT / PROVIDER-LIVE / LOCAL-RUNTIME; run application code, tests, mocks, builds, installs, SSH, browser, or subagents; dispatch a workflow; commit or push; change Builder gate or Harness flags.

### 14.7 Step 4 verdict

```
STEP_4_VERDICT=COMPLETE_AND_LOCKED
ACCEPTANCE_OBJECT=S1_GOVERNANCE_DECISION_ONLY
CRITERIA_1_THROUGH_9=PASS
OUTCOME_SELECTED=R3 OUTCOME_POLICY_APPROVED_AMENDED
POLICY_AUTHORIZED=YES (S1 contract only)
SUBSTANTIVE_AMENDMENTS_ADOPTED=A4 (verbatim)
A1_STATUS=OPEN / UNADOPTED
A2_STATUS=OPEN / no source or values designated
PROCEDURE_SELECTION=VERIFIER (direction only)
ACCEPTANCE_DIRECTION=C1 (direction only)
P7_ACCEPTED=NO
HOST_CLEAN=NO
REOPEN_GATE_SATISFIED=NO
EXEC_01C6A_START_CONDITION=NOT_READY (unchanged)
VERIFIER_CHILD_REGISTERED=NO
EXEC_01C6A_AMENDED=NO
SUCCESSOR_REGISTERED=NO
SIDECAR_LOCKEDTASKIDS_EDITED=NO
BUILDER_GATE=ON (unchanged)
HARNESS_FLAGS=unchanged
OCCUPANCY=EMPTY
GOVERNANCE=UNOWNED
LOCKED=YES
```

### 14.8 Step 4 activity ledger (2026-09-19)

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, canary submission=0, vendor fetch=0, network=0, workflow dispatched=0, r3 transferred/extracted/executed=0, Python executed=0, tests=0 except lane-capacity validator, mocks=0, imports=0, builds=0, installs=0, browser=0, subagents=0, bundle/manifests/archive edited=0, workflow edited=0, sidecar edited=0, lockedTaskIds edited=0, predecessor bodies edited=0, EXEC-01C6 / 01C6A documents or body edited=0, locked freezes edited=0, verifier/child/successor registered=0, P4/P5/P6/P7 recorded=0, host CLEAN attested=0, Keith choices changed=0, Git add/commit/push=0.
Writes: this document (status header + §14 appended; freeze §§0–12 and §13 preserved); `TASKS.md` this task's current board fields; `TASKS_BACKLOG_FULL.md` this task's body; `docs/control-plane/SATURATION_PROOF.json` as validator output only. GOVERNANCE acquired transiently then released UNOWNED. Occupancy EMPTY.
