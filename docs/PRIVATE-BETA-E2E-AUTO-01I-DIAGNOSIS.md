# PRIVATE-BETA-E2E-AUTO-01I — Step 1 Diagnosis

**Task ID:** PRIVATE-BETA-E2E-AUTO-01I  
**Title:** Diagnose LIVE Clean-Tree / Control-Plane Sequencing Conflict  
**Step:** 1 — Registration + root-cause / procedure-contract investigation only  
**Date:** 2026-08-22  
**Classification:** GOVERNANCE_EXECUTION_PROCEDURE_INVESTIGATION  
**Evidence class:** LOCAL-TESTS (static / source / governance proof; no runtime)  
**Nature:** DIAGNOSIS ONLY — no procedure lock, no runner change, no product change, no LIVE, no Git mutation

Do not treat this document as a scheduler. Do not convert LIVE-07 to PASS. Do not rerun LIVE-07. Do not weaken the runner clean-tree SAFETY gate. Do not register another LIVE task here. Do not register PRIVATE-BETA-INVITE-01.

Triggering locked evidence:

- `docs/PRIVATE-BETA-E2E-LIVE-07-CHECKPOINT.md`
- `docs/PRIVATE-BETA-E2E-LIVE-07-EXECUTION.md`

Authoritative OS:

- `CLAUDE.md` (Development OS / rules)
- `AGENTS.md` (thin bootstrap)
- `docs/GOV-OS-01-STAGE-START.md` (frozen OS v1 contract)
- `docs/GOV-OS-01-CHECKPOINT.md` (installed OS)

Step 1 local observation (informational; not frozen for Step 2):

- branch = `main`
- HEAD = `903def47e7da4d1720f5e911e5dbbb71edd7424d`
- `git status --short` = empty (CLEAN)

---

## 1. Identifier verification

Repo-wide search for `PRIVATE-BETA-E2E-AUTO-01I` before this registration found **no** `### PRIVATE-BETA-E2E-AUTO-01I` registry entry.

Occurrences were historical recommendation prose only:

- `TASKS.md` CURRENT EXECUTION BOARD next-gate line (NOT REGISTERED / NOT AUTHORIZED HERE)
- `docs/PRIVATE-BETA-E2E-LIVE-07-CHECKPOINT.md` (“Do not register PRIVATE-BETA-E2E-AUTO-01I here”; “Likely identifier if later registered”; “AUTO-01I registered in Step 3: NO”)
- locked LIVE-07 backlog “Exact next (NOT REGISTERED HERE)”

Historical recommendation prose does not count as prior registration.

Rejected alternatives: reopening LIVE-07 / LIVE-06 / AUTO-01G / AUTO-01H; registering another provider-bearing LIVE task; registering PRIVATE-BETA-INVITE-01; weakening SAFETY.

---

## 2. Frozen LIVE-07 facts (not rewritten)

LIVE-07 remains COMPLETE AND LOCKED — FAIL/BLOCKED — ENVIRONMENT/PARITY_FAILURE — SAFETY — 2026-08-21.

Frozen sequence:

1. local tree CLEAN
2. AUTHORIZED_LOCAL_HEAD captured: `6723c4699d9c2cea832f73356aa85960b230b3cf`
3. staging deployed/parity established at that SHA
4. Step-2 control-plane writes modified `TASKS.md` and `TASKS_BACKLOG_FULL.md`
5. local tree became DIRTY
6. `npm run e2e:builder:live` invoked exactly once
7. AUTH PASS
8. SAFETY checked local cleanliness
9. SAFETY correctly failed closed
10. provider calls = 0
11. credits = 0
12. no project/session/container created

The clean-tree gate worked as intended. It is not defective.

---

## 3. Exact LIVE-07 writes that dirtied the tree

Authoritative evidence: `docs/PRIVATE-BETA-E2E-LIVE-07-EXECUTION.md` (Step 2 runtime) and `docs/PRIVATE-BETA-E2E-LIVE-07-CHECKPOINT.md` §§3–5.

| File | When | Semantic state | Class |
|---|---|---|---|
| `TASKS.md` CURRENT EXECUTION BOARD | After AUTHORIZED_LOCAL_HEAD capture; before runner SAFETY | Step 2 resource acquisition / in-flight control-plane ownership | mutex/resource acquisition + lane/execution-in-flight scheduler state |
| `TASKS_BACKLOG_FULL.md` | Same window | Step 2 resource-acquisition / in-flight registry mirroring | durable task-body write used as if it were live scheduler state |

Not a SAFETY cause: later Step 2 write of `docs/PRIVATE-BETA-E2E-LIVE-07-EXECUTION.md` (post-invocation evidence). Checkpoint: that later write is **not** the SAFETY failure cause.

The checkpoint explicitly does not reconstruct the precise pre-runner textual hunks beyond “resource acquisition” of those two files. This diagnosis does not invent a more specific diff.

LIVE-07 Step 1 had **intentionally not** acquired STAGING / PROVIDER-LIVE / CREDIT / ENV (`docs/PRIVATE-BETA-E2E-LIVE-07-EXECUTION.md` “Planned Step 2 resources (not acquired in Step 1)”; backlog Step 1 checklist). That deferred the board write into the Step 2 execution window.

---

## 4. Authoritative rule behind each write

### 4.1 `TASKS.md` board write

**Who/procedure required it:** control-plane / governance step, not the Playwright runner. LIVE-07 Step 2 acquired GOVERNANCE / STAGING / PROVIDER-LIVE / CREDIT / ENV (locked LIVE-07 mutex line). Ordinary implementation workers may not acquire mutexes in `TASKS.md` themselves (`CLAUDE.md` Board modification authority; `docs/GOV-OS-01-STAGE-START.md` §5).

**Exact rule:** `TASKS.md` CURRENT EXECUTION BOARD is the only current scheduler and must represent admitted lanes, **mutex ownership**, current gates/blockers, and governance owner (`CLAUDE.md` Authority by domain; GOV-OS-01 stage-start §1.1 / §2.1). Fresh windows recover mutex/resource ownership from that board **without relying on conversation memory** (`docs/GOV-OS-01-CHECKPOINT.md` §3; `AGENTS.md` boot sequence step 3).

**Must it be written BEFORE runtime begins?** The *ownership record* must be on the board before a conflicting lane can be admitted and before a fresh window can safely continue. That is a scheduler invariant, not a runner invariant. It does **not** require the write to remain uncommitted at runner SAFETY.

**Must it be persisted in Git immediately?** OS: Keith owns Git; workers must not commit (`CLAUDE.md` Git / Operator Rules). The board file in the working tree is what a same-workspace fresh window would read. Git commit is **not** defined as the acquisition act. For LIVE SAFETY, however, an uncommitted board write is a dirty tree and is forbidden at the runner edge.

**Retrospective?** No. In-flight mutex ownership is current scheduler state, not end-status.

### 4.2 `TASKS_BACKLOG_FULL.md` write

**Who/procedure required it:** LIVE-07 Step 2 mirrored in-flight resource acquisition into the canonical registry as well as the board.

**Exact rule:** After cutover, control-plane steps mirror **end status** into (1) board fields and (2) the canonical backlog body (`CLAUDE.md` post-cutover status mirroring; GOV-OS-01 stage-start §1.4). Full-body mirroring is forbidden. The backlog is the canonical task registry (ID, scope, AC, dependencies, history, LOCKED state), not the live mutex table.

**Must it be written BEFORE runtime begins?** **NO** under the installed OS. End-status mirroring is after the step completes. LIVE-02..LIVE-05 recorded Step 1 *reservation* in the backlog mutex field as registration metadata; they did not require a second in-flight backlog mutation after HEAD capture.

**Must it be persisted in Git immediately?** No OS rule requires a pre-runner backlog commit of in-flight ownership.

**Retrospective?** In-flight Step 2 backlog mutation is not required. Durable lifecycle records belong after terminal execution / consolidation.

**Verdict on writing BOTH before LIVE:** writing `TASKS.md` for ownership is required for recoverability; writing `TASKS_BACKLOG_FULL.md` in the same pre-runner window was **not** required by end-status mirroring and was the extra dirtying file.

---

## 5. Control-plane ownership representation model

**Model: A, with an important timing split.**

Resource ownership is **only authoritative when represented on `TASKS.md` CURRENT EXECUTION BOARD** (option A). It is not a defined in-memory-only lease (not B), not an out-of-band store (not C), and not a second scheduler file (not D). Chat memory is explicitly forbidden as recovery (`AGENTS.md`; GOV-OS-01 checkpoint §3).

Ambiguity that LIVE-07 hit (procedure, not OS semantics):

- OS requires the **board** to show ownership.
- OS does **not** say “leave `TASKS.md` uncommitted while LIVE runs.”
- LIVE SAFETY requires `git status --short` empty.
- LIVE-07 satisfied the first by dirtying files after HEAD capture, which violated the third.

**Does “acquire STAGING / PROVIDER-LIVE / CREDIT / ENV” REQUIRE dirtying tracked repo files before execution?**

**NO at the runner SAFETY edge.** Acquisition is a board write. That write dirties `TASKS.md` only until Keith commits (or until the state is already present in HEAD). The committed board, not the uncommitted diff, is what LIVE execution may see.

Quote/paraphrase:

- `CLAUDE.md`: workers may not “acquire / release mutexes in `TASKS.md` themselves”; the control plane performs board updates.
- `CLAUDE.md` / GOV-OS-01 §2.1: Active mutex / resource ownership is a required board field.
- GOV-OS-01 checkpoint §3: fresh windows must determine mutex/resource ownership without conversation memory.
- `CLAUDE.md` Git rules: workers do not commit; Keith owns Git.
- Runner: `readAuthorizedLocalHead()` throws if `git status --short` is non-empty (`e2e/builder-golden-path/lib/staging.ts`).

---

## 6. TASKS.md vs backlog during in-flight LIVE

**TASKS.md CURRENT EXECUTION BOARD during LIVE must represent:**

- admitted lane + ACTIVE (or equivalent in-lifecycle) state
- GOVERNANCE owner if a control-plane write is in progress
- STAGING / PROVIDER-LIVE / CREDIT / ENV ownership for a provider-bearing LIVE run
- current blockers / gates / authorization flags as scheduler fields
- enough for a fresh window to refuse a conflicting Lane 2 admission

That state must already be **committed** before AUTHORIZED_LOCAL_HEAD capture.

**TASKS_BACKLOG_FULL.md during LIVE:**

- does **not** need runtime ownership/status writes before execution
- needs durable registration (already committed at Step 1) and **end-status** after the step
- must not be mutated between HEAD capture and runner SAFETY

Writing BOTH immediately before LIVE was not required. LIVE-07’s dual write was a procedure overreach relative to installed mirroring rules.

---

## 7. AUTHORIZED_LOCAL_HEAD exact semantic contract

Operator contract (LIVE-07 freeze, `docs/PRIVATE-BETA-E2E-LIVE-07-EXECUTION.md` / backlog):

```powershell
$authorizedLocalHead = (git rev-parse HEAD).Trim()
$localStatus = git status --short
if ($localStatus) { DEPLOY_ABORT LOCAL_TREE_DIRTY; exit 1 }
```

Runner contract (`readAuthorizedLocalHead` in `e2e/builder-golden-path/lib/staging.ts`):

1. `git status --short`; any non-empty trimmed output → `UnsafeParityError` (“Local worktree is dirty…”)
2. `git rev-parse HEAD`; empty → fail closed
3. that SHA is then passed to `inspectParity` as expected staging HEAD

The runner **re-reads** local HEAD at SAFETY. It does not consume an env var named AUTHORIZED_LOCAL_HEAD.

Answers:

1. **Must it equal the current committed local HEAD?** YES at capture, YES at runner SAFETY (runner recaptures HEAD). Operator AUTHORIZED_LOCAL_HEAD is the deploy target; SAFETY will use whatever committed HEAD exists at invoke time.
2. **Must the local working tree remain clean from capture until runner SAFETY?** YES. Any tracked or untracked change (`git status --short`) fails SAFETY. No pathspec exclusions exist.
3. **If governance files change after capture, does that invalidate execution-edge authorization even before runner checks cleanliness?** YES. The operator-captured SHA no longer describes the working tree. Even if someone committed after capture without redeploying, SAFETY would recapture the new HEAD and `inspectParity` would fail staging mismatch. Uncommitted changes fail earlier on dirty tree.
4. **If governance changes were committed before LIVE, would the new governance commit need to become the new AUTHORIZED_LOCAL_HEAD?** YES.
5. **Would staging then need to deploy that new SHA?** YES. `inspectParity` / `evaluateParity` require `stagingHead === requiredHeadSha` and staging worktree clean. Exact HEAD parity; not “product files only.” LIVE-07 itself skipped rebuild when `frontend/` and `services/` were unchanged, but still required HEAD match.
6. **Is recursion real?** Recursion is **real if** the procedure writes tracked governance files after every HEAD capture. It is **hypothetical if** the procedure forbids further tracked writes after the committed capture. LIVE-07 realized the one-step form: capture → board/backlog write → dirty SAFETY fail (no commit, so no infinite loop, but the same class of defect). Full loop (acquire → commit → new HEAD → deploy → write “deployed SHA” on board → dirty → commit → …) is prevented by: after Keith commits acquisition, **zero tracked writes until the runner returns**.

---

## 8. Runner clean-tree SAFETY exact contract

Source: `e2e/builder-golden-path/lib/staging.ts` `readAuthorizedLocalHead`; called from `e2e/builder-golden-path/lib/live-adapters.ts` `runSafetyChecks()` (golden-path phase SAFETY, after AUTH).

Exact local check:

```text
git status --short
```

If trimmed stdout is non-empty, throw `UnsafeParityError`:

```text
Local worktree is dirty. LIVE execution-edge parity requires a clean tree. No automatic deploy.
```

Then:

```text
git rev-parse HEAD
```

Then SSH `inspectParity(expectedHead)`:

- staging HEAD must equal that local HEAD
- staging `git status` must be empty (`worktreeClean: parsed.status === ''`)
- retained stash must equal `0372cc1f47f82e1db060ed2dd756a938fe324803`

**When it runs:** SAFETY phase, after AUTH, before gate inspect/enable, before STARTING_BALANCE, before provider.

**What it protects against:** LIVE against a local tree that is not the committed SHA about to be compared with staging; automatic deploy from the runner (explicitly refused); running paid-provider LIVE from a dirty/uncommitted mix.

**HEAD as well as working tree?** YES. Dirty tree fails first. Clean tree then uses current HEAD as the parity expected SHA. It does not compare to a previously stored operator SHA.

**Exclusions?** NONE. Tracked and untracked both appear in `git status --short`. CONTRACT already fails closed on a dirty porcelain line (`tests/live-adapters.spec.ts`).

**Would changing/bypassing it reduce safety?** YES. Excluding `TASKS.md` / `TASKS_BACKLOG_FULL.md` would allow LIVE while local tree ≠ committed/deployed SHA and would hide in-flight scheduler edits from the parity invariant. Do not change it.

**SAFETY should change:** **NO.**

---

## 9. Option verdicts

### Option 1 — Defer repo-backed resource-state writes until after runner terminal execution

- OS compliance: **FAIL** for recoverability. Fresh-window boot would see UNOWNED STAGING / PROVIDER-LIVE / CREDIT / ENV while LIVE is in flight. Admission could not detect the conflict. Chat/operator memory is forbidden as the ownership store.
- Ownership: not authoritative during the run.
- Clean tree at SAFETY: YES.
- Staging HEAD parity: YES if no other writes.
- Recursion: none.
- Keith Git: OK.
- Disconnect after “ownership” but before runner: **undiscoverable**.
- Lane 2 race: **HIGH**.
- Procedure-only: yes, but it weakens invariant A.
- **Verdict: REJECT.** Convenience only.

### Option 2 — Commit all required pre-run governance/resource writes first, then capture a NEW AUTHORIZED_LOCAL_HEAD, deploy that SHA, invoke runner with no further repo writes

- OS compliance: **PASS.** Board shows ownership; Keith commits; tree is clean; staging matches the SHA that contains the ownership record.
- Ownership: authoritative and git-persisted.
- Clean tree at SAFETY: YES if no writes after recapture.
- Staging HEAD parity: YES after compare-then-deploy of the new SHA. Governance-only commits may skip product rebuild (LIVE-07 precedent) but still need `git reset --hard` to the new SHA.
- Recursion: none **if** the procedure forbids tracked writes after recapture.
- Keith Git: **required** before the new capture. Worker must STOP and return control to Keith. Worker must not stash/restore/reset to fake cleanliness.
- Disconnect: committed board remains discoverable.
- Lane 2 race: LOW (board shows ownership).
- Procedure-only: YES. No runner code change.
- **Verdict: ACCEPT as the required commit-and-recapture subsequence whenever a pre-run board write is not already in HEAD.**

### Option 3 — Represent ephemeral resource ownership outside tracked repo files

- OS compliance: **FAIL** unless a new OS mechanism is invented. No authorized out-of-band mutex store exists. Inventing one is OS mutation, not a LIVE procedure fix.
- Recoverability/auditability: weaker than the board.
- **Verdict: REJECT.** Do not add a shadow scheduler.

### Option 4 — Keep TASKS board write before LIVE but do not mutate backlog until after terminal execution

- OS compliance: **PASS** for backlog (end-status mirroring). **INSUFFICIENT ALONE** for SAFETY: an uncommitted `TASKS.md` still fails `git status --short`.
- Combined with Option 2 (commit board, skip in-flight backlog): **PASS.**
- **Verdict: ACCEPT as a necessary backlog constraint; not sufficient by itself.**

### Option 5 — Historical LIVE-02..LIVE-05 Step 1 reservation (proven in this repo)

LIVE-02 / LIVE-03 / LIVE-04 / LIVE-05 reserved STAGING / PROVIDER-LIVE / CREDIT / ENV **in Step 1** as “reservation only until Keith authorizes Step 2,” then Keith’s normal Step 1 commit put that ownership into HEAD **before** Step 2 HEAD capture. LIVE-06/LIVE-07 deferred acquisition to Step 2. LIVE-07 then wrote after capture without a Keith commit, which is the defect.

Reservation is not runtime authorization (`CLAUDE.md` / LIVE-02..05: ownership is reservation only; Step 1 does not deploy, enable the gate, call the provider, or mutate credits). Keith LIVE authorization remains a separate non-git act.

- OS compliance: **PASS.**
- Clean tree at SAFETY: YES when Step 1 is committed and Step 2 does not rewrite board/backlog before the runner.
- Recursion: none.
- Disconnect during wait for Step 2: board already shows reservation — **desirable** (blocks a second LIVE lane).
- Procedure-only: YES.
- **Verdict: ACCEPT as the default acquisition boundary for a future provider-bearing LIVE lifecycle.**

---

## 10. Selected evidence-supported sequencing model

**Default: Option 5 (Step 1 committed reservation) + Option 4 (no in-flight backlog write) + Option 2 (if any additional pre-run board write is still required after Step 1 commit).**

Hard stop: after the SHA that contains required board ownership is captured, **no tracked writes** until the runner returns.

Do not restore governance files to satisfy SAFETY. Do not stash. Do not weaken SAFETY.

---

## 11. Canonical future LIVE ordering

Keith LIVE authorization does **not** dirty Git. Resource ownership **does** (until committed).

1. **Obtain explicit Keith LIVE authorization** for the execution window (process / operator). This is not a git write. It does not acquire mutexes by itself.
2. **Establish resource ownership on `TASKS.md`** — preferably already done as Step 1 reservation (STAGING, PROVIDER-LIVE, CREDIT, ENV). If missing: control-plane board write now. Do **not** mutate `TASKS_BACKLOG_FULL.md` for in-flight ownership.
3. **Complete any required repo writes** (board only).
4. **Return to Keith for commit** if `git status --short` is non-empty. STOP. Worker must not commit, stash, reset, or restore.
5. **Verify local clean tree:** `git status --short` empty.
6. **Capture AUTHORIZED_LOCAL_HEAD** = `git rev-parse HEAD` (must include AUTO-01G/H and the committed ownership record).
7. **Verify/deploy staging parity** to exactly that SHA. If origin lacks the object, STOP for Keith push. No further local tracked writes.
8. **Import credentials / LIVE flags** in process env only (`E2E_MODE`, `E2E_LIVE_AUTHORIZED`, `E2E_ALLOW_STAGING_MUTATION`, `E2E_ALLOW_CREDIT_MUTATION`, `PROVIDER_CALL_BUDGET=1`). Never write them to the repo.
9. **Final immediate pre-invocation gate (mandatory):**
   - `git status --short` = empty
   - `git rev-parse HEAD` = AUTHORIZED_LOCAL_HEAD
   - staging HEAD = AUTHORIZED_LOCAL_HEAD
   - staging worktree clean; retained stash invariant
   - **no tracked governance writes since capture**
10. **Invoke runner exactly once.**
11. **Write terminal evidence / board+backlog end-status afterward** (dirty tree after the runner is expected and allowed).

The triple clean-tree/parity gate is **necessary but not sufficient** without acquisition ordering: if ownership is not on the committed board before capture, a fresh window during LIVE is blind. Acquisition ordering is a **mandatory prior step**.

---

## 12. Exact resource acquisition boundary

Safe default: **A — registration Step 1**, reservation only, committed with the registration commit, held until confirmed-safe cleanup after the LIVE run.

If Step 1 released those mutexes (LIVE-07 style): **not D**. Acquire after Keith authorization, **commit**, **then** clean-check + HEAD capture. Boundary D (after AUTHORIZED_LOCAL_HEAD capture) is the LIVE-07 defect.

Not E (runner cannot write the board). Not F (no out-of-band store). Not B as a dirtying write immediately before the clean check without a Keith commit.

---

## 13. Explicit LIVE authorization boundary

Keith’s explicit LIVE authorization is a **separate act** from repo-backed resource state. It:

- does not dirty Git
- does not by itself acquire STAGING / PROVIDER-LIVE / CREDIT / ENV
- is required before compare/deploy, SSH, LIVE flags, provider, credit mutation, or `npm run e2e:builder:live`
- comes **after** committed reservation is allowed to exist (reservation ≠ authorization)
- comes **before** any staging mutation and before HEAD capture in the execution window

---

## 14. Disconnect / recovery

| Disconnect point | Discoverability | Safe resume |
|---|---|---|
| Before resource ownership | Board UNOWNED; no LIVE in flight | Re-enter at reservation / authorization |
| After board write, before Keith commit | Same working tree shows dirty `TASKS.md`; do **not** restore files to fake cleanliness | Keith commit, then recapture; or abort and leave board consistent |
| After Keith commit, before runner | Committed board shows ownership; tree clean | Recapture if needed; deploy; final gate; invoke |
| After runner invocation | Evidence + board/backlog end-status may be dirty | Normal consolidation; do not invoke runner again |
| During cleanup | Mutexes remain owned until confirmed-safe release on the board | Operator verifies gates; then release |

Resource ownership remains auditable from `TASKS.md` (committed, or dirty-but-not-restored in the same workspace). It must not depend on dirty files being present **during** runner SAFETY.

---

## 15. Runner / product change required?

**Runner code change required: NO.**  
**Product change required: NO.**

This is solvable entirely through governance/procedure sequencing. Do not modify the runner to accommodate dirty governance files.

---

## 16. Step 2 smallest safe design (not executed in Step 1)

PROCEDURE / GOVERNANCE ONLY.

Update the authoritative LIVE procedure/contract surfaces so a future LIVE Step 1 freeze cannot repeat LIVE-07:

1. `docs/PRIVATE-BETA-E2E-AUTO-01I-DIAGNOSIS.md` remains the proof (this file).
2. Add a short frozen procedure contract (new `docs/PRIVATE-BETA-E2E-LIVE-EXECUTION-SEQUENCING.md` or equivalent) stating: Step 1 reservation; no in-flight backlog write; Keith commit before capture; zero tracked writes from capture to runner; final triple gate; SAFETY unchanged.
3. Mirror that contract onto the `TASKS.md` CURRENT EXECUTION BOARD frozen-contracts list and the AUTO-01I backlog AC.
4. Do **not** edit `CLAUDE.md` / `AGENTS.md` unless Step 2 later proves an OS-semantic gap. Current OS already defines board = mutex table and Keith owns Git. The defect is LIVE procedure sequencing, not mutex semantics.
5. Do not modify `e2e/builder-golden-path/**`.
6. No LIVE, SSH, staging, provider, credit, or gate activity.

**Automated vs static verification:** do not invent tests of markdown. Meaningful static checks:

- `git diff -- e2e/builder-golden-path` empty (SAFETY unchanged)
- source still contains the dirty-tree `UnsafeParityError` string
- checklist that the frozen sequencing doc contains the canonical order and forbids post-capture tracked writes
- existing CONTRACT dirty-tree test remains (already in `tests/live-adapters.spec.ts`); do not duplicate as a prose test

---

## 17. Future LIVE prompt changes required

Any future provider-bearing LIVE prompt must include:

- acquire STAGING / PROVIDER-LIVE / CREDIT / ENV as **Step 1 reservation** (or commit-then-recapture if acquired later)
- do not write `TASKS_BACKLOG_FULL.md` for in-flight ownership after HEAD capture
- STOP for Keith commit whenever the tree is dirty
- capture AUTHORIZED_LOCAL_HEAD only on a clean tree that already contains the ownership commit
- deploy that SHA
- **final immediate pre-invocation gate:** `git status --short` empty AND `git rev-parse HEAD` = AUTHORIZED_LOCAL_HEAD AND staging HEAD = AUTHORIZED_LOCAL_HEAD
- no tracked governance writes between that capture and runner invocation
- never stash/restore governance files to pass SAFETY
- never weaken `readAuthorizedLocalHead`

---

## 18. Residual uncertainty

- Exact pre-runner textual hunks inside LIVE-07’s dirty `TASKS.md` / `TASKS_BACKLOG_FULL.md` were not preserved as a patch; checkpoint forbids guessing beyond “resource acquisition.” Semantic class is proven; byte-level hunks are not.
- LIVE-06 also deferred acquisition to Step 2 in lock text, but SAFETY passed. This diagnosis does not claim LIVE-06 left uncommitted board writes at SAFETY. The proven defect is the LIVE-07 sequence (write after capture, invoke dirty).
- Whether a future LIVE Step 1 should also keep GOVERNANCE held for the whole wait is operational, not required for this sequencing proof.

---

## 19. Step 1 activity ledger

```
LIVE runs = 0
SSH connections = 0
staging mutations = 0
provider calls = 0
credit mutations = 0
gate mutations = 0
project/session creation = 0
runner implementation modifications = 0
product modifications = 0
dependency changes = 0
Git mutations = 0
```

---

## 20. Step 1 terminal state

Step 1 COMPLETE. Root cause and safe execution order proven. READY for bounded Step 2 procedure/governance correction. Step 2 is **not** authorized by this diagnosis.
