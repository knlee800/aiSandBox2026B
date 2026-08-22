# LIVE Clean-Execution Sequencing Contract

**Task ID:** PRIVATE-BETA-E2E-AUTO-01I
**Step:** 2 — Freeze canonical LIVE clean-tree / control-plane sequencing
**Date:** 2026-08-22
**Classification:** GOVERNANCE / PROCEDURE CONTRACT
**Proof:** `docs/PRIVATE-BETA-E2E-AUTO-01I-DIAGNOSIS.md`

Do not treat this file as a scheduler. Do not convert LIVE-07 to PASS. Do not rerun LIVE-07. Do not weaken runner clean-tree SAFETY. Do not register another LIVE task here.

---

## 1. Purpose

Freeze the procedure that lets a future provider-bearing LIVE lifecycle:

- represent LIVE resource ownership on the `TASKS.md` CURRENT EXECUTION BOARD
- keep the local tree clean at runner SAFETY
- keep staging HEAD equal to the committed SHA under test

The defect frozen here is **procedure sequencing**, not runner safety.

Core invariant:

There must be **zero** tracked or untracked repository writes between the final clean-tree `AUTHORIZED_LOCAL_HEAD` capture and the return of the single `npm run e2e:builder:live` invocation.

---

## 2. Authority / applicability

This contract applies to every future provider-bearing LIVE Builder E2E execution window after AUTO-01I Step 2.

| Surface | Role |
|---|---|
| `TASKS.md` CURRENT EXECUTION BOARD | Authoritative scheduler and mutex/resource table. Fresh windows recover admitted lane, ownership, and conflicting leases from this board without chat memory. |
| `TASKS_BACKLOG_FULL.md` | Durable canonical task registry. End-status only. Not the live mutex table. |
| `e2e/builder-golden-path/lib/staging.ts` `readAuthorizedLocalHead()` | Unchanged SAFETY implementation. No exclusions. |
| `docs/PRIVATE-BETA-E2E-AUTO-01I-DIAGNOSIS.md` | Step 1 proof. Not the operational runbook. |
| Locked LIVE-07 checkpoint / execution docs | Historical evidence only. |

Board LIVE resource ownership relevant to an execution **must already be part of the committed HEAD** before `AUTHORIZED_LOCAL_HEAD` is captured.

This document does not mutate Development OS mutex semantics (`CLAUDE.md` / GOV-OS-01). It freezes LIVE procedure order around those already-installed rules.

---

## 3. Reservation vs runtime authorization

These are separate concepts.

**RESOURCE RESERVED** (board mutex ownership):

- Prevents conflicting lanes/tasks from being admitted.
- Is a `TASKS.md` ownership statement.
- Is **not** permission to deploy, enable gates, call a provider, or mutate credits.

**RUNTIME MUTATION AUTHORIZED** (explicit Keith act):

- Required before staging mutation/deployment, LIVE flags, provider call, credit deduction, or runner invocation.
- Does **not** itself modify Git.
- Does **not** itself acquire mutexes.

A Step 1 board may therefore show:

```
STAGING owner = future LIVE task
PROVIDER-LIVE owner = future LIVE task
CREDIT owner = future LIVE task
ENV owner = future LIVE task
```

while simultaneously:

```
RUNTIME_EXECUTION_AUTHORIZED=NO
PROVIDER_CALL_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
STAGING_MUTATION_AUTHORIZED=NO
```

until Keith explicitly authorizes the LIVE mutation envelope.

---

## 4. Step 1 reservation rule

For a future provider-bearing LIVE lifecycle, **registration Step 1 SHOULD reserve** on `TASKS.md`:

- STAGING
- PROVIDER-LIVE
- CREDIT
- ENV

Keep all mutation-authority booleans false.

Keith then commits/pushes that Step 1 state **before** any LIVE execution edge.

That committed reservation is how a fresh window sees ownership without chat memory, and how SAFETY later sees a clean tree.

### Fallback if Step 1 did not reserve

If required LIVE resource ownership is **not** already in the committed Step 1 HEAD:

1. Perform the required **board-only** ownership write on `TASKS.md`.
2. Do **not** invoke LIVE.
3. STOP and return control to Keith.
4. Keith commits/pushes the intended governance change.
5. Confirm `git status --short` is empty.
6. Capture a **new** `AUTHORIZED_LOCAL_HEAD`.
7. Recalculate/deploy staging parity against that new SHA.
8. Permit **no** further tracked or untracked writes before runner return.

Never:

```
capture HEAD → modify TASKS.md → run
```

That is the LIVE-07 failure sequence.

`TASKS_BACKLOG_FULL.md` must **not** receive in-flight resource-acquisition / ownership writes between execution-edge HEAD capture and runner invocation. If a backlog edit is genuinely required before LIVE, it must occur **before** the final Keith commit and **before** execution-edge HEAD capture.

---

## 5. Keith commit boundary

Keith owns Git.

Workers **never** commit, push, stash, reset, or restore to manufacture a clean LIVE execution tree.

If an intended governance change creates dirt:

**STOP FOR KEITH.**

After Keith commits:

- verify `git status --short` is empty
- recapture `AUTHORIZED_LOCAL_HEAD`
- redeploy/recheck staging parity against that SHA
- restart execution-edge checks from scratch

Uncommitted board ownership is not an OS requirement at the runner edge. The committed board is what LIVE may see.

---

## 6. AUTHORIZED_LOCAL_HEAD definition

Capture only when the local tree is already clean **and** already contains the required committed board ownership:

```powershell
git status --short   # must be empty
git rev-parse HEAD   # this SHA is AUTHORIZED_LOCAL_HEAD
```

`AUTHORIZED_LOCAL_HEAD` is the exact committed SHA that:

- includes required LIVE resource reservation on `TASKS.md`
- is the deploy target for staging
- is what runner SAFETY will re-read via `readAuthorizedLocalHead()` (`git status --short` then `git rev-parse HEAD`)

The runner does not consume an env var named `AUTHORIZED_LOCAL_HEAD`. It re-reads local HEAD at SAFETY. Any later commit or dirty tree invalidates the previous execution edge.

If governance is committed after a prior capture, that new commit **must** become the new `AUTHORIZED_LOCAL_HEAD`, and staging **must** be re-paritied to it.

---

## 7. No-control-plane-write execution window

**NO CONTROL-PLANE WRITE WINDOW**

Starts: immediately after the final clean-tree `AUTHORIZED_LOCAL_HEAD` capture.

Ends: when the one runner invocation returns, or the attempt is conclusively known not to have been invoked.

During this window, **no** process, worker, or control-plane step may modify:

- `TASKS.md`
- `TASKS_BACKLOG_FULL.md`
- `docs/*`
- runner files
- product files
- **any** other tracked or untracked repository file

If any tracked/untracked repository change appears before invocation:

**STOP. Do not run LIVE.**

Keith must resolve/commit the intended governance state first. Then recreate the execution edge from scratch (`git status --short`, `git rev-parse HEAD`, staging parity).

The board state used for mutex ownership must already be committed **before** entering this window.

---

## 8. Staging parity procedure

After the execution-edge HEAD is captured and the write window has started:

1. Inspect staging HEAD / cleanliness / retained stash / required services.
2. If staging HEAD already equals `AUTHORIZED_LOCAL_HEAD` and the tree is clean: do **not** redeploy.
3. If different, deploy **exactly** `AUTHORIZED_LOCAL_HEAD`:

```text
git fetch origin main
verify the target object is AUTHORIZED_LOCAL_HEAD
git reset --hard AUTHORIZED_LOCAL_HEAD
```

Do not `git pull`. Do not deploy `origin/main` if it differs. Do not substitute a historical SHA.

4. Require after deploy/inspect:

- staging HEAD = `AUTHORIZED_LOCAL_HEAD`
- staging tree clean
- retained stash invariant intact (`stash@{0}` = `0372cc1f47f82e1db060ed2dd756a938fe324803`)
- required services healthy

Governance-only commits may skip product rebuild when `frontend/` and `services/` are unchanged, but still require exact HEAD match.

If origin lacks the object: STOP for Keith push. Do not repair local Git.

Import transient credentials and process-only LIVE flags **after** parity and **only in process env**. Never write them to the repository.

---

## 9. Final triple gate

Immediately before the runner, require all of:

| Gate | Requirement |
|---|---|
| Local clean | `git status --short` = EMPTY |
| Local HEAD | `git rev-parse HEAD` = `AUTHORIZED_LOCAL_HEAD` |
| Staging HEAD | staging HEAD = `AUTHORIZED_LOCAL_HEAD` |

Also require: staging clean, stash invariant, and applicable gates/preconditions (including `GLOBAL_EXECUTION_ENABLED=false` / `BILLING_CHARGES_ENABLED=false` before any runner authorization phase, as the LIVE task freeze specifies).

If **any** final gate differs:

**STOP BEFORE RUNNER.**

Do not repair by stash/reset/restore. No provider/credit use.

---

## 10. Single-run rule

Invoke:

```powershell
npm run e2e:builder:live
```

**exactly once.**

No tracked repository writes while the invocation is in progress.

If Cursor disconnects after invocation: the run is consumed. Do not invoke again. A new window may perform evidence/cleanup only.

---

## 11. Post-run evidence / write boundary

Repository writes may resume **only after** the runner returns (or the attempt is conclusively known not to have been invoked).

Then write:

- execution evidence
- `TASKS.md` board result / release state
- `TASKS_BACKLOG_FULL.md` durable result / status

Release runtime resources only after confirmed-safe cleanup.

Later checkpoint / consolidation / lock is a separate step.

Dirty tree **after** runner return is expected and allowed.

---

## 12. Disconnect / recovery

| Point | What a fresh window must see | Action |
|---|---|---|
| Before resource reservation | Board UNOWNED; no runtime resources owned | Re-enter at registration/reservation |
| After committed reservation, before LIVE invocation | `TASKS.md` shows ownership; no chat-memory dependency | Continue authorization / execution edge, or release later through normal governance |
| After board write, before Keith commit | Dirty `TASKS.md` in the same workspace | STOP FOR KEITH. Do not restore files to fake cleanliness |
| Aborted before runner invocation | Attempt not consumed | Control plane may later release reservation through normal governance |
| After runner invocation | Attempt consumed | No rerun. Cleanup/classification only, using committed board ownership plus runtime/evidence state |
| During cleanup | Relevant resource ownership retained | Write releases only after confirmed-safe final state |

---

## 13. Explicit forbidden workarounds

Never:

- capture HEAD → modify `TASKS.md` / backlog / docs → run
- write in-flight ownership into `TASKS_BACKLOG_FULL.md` between capture and runner return
- `git stash` to satisfy LIVE SAFETY
- `git restore` / `git reset` locally to manufacture a clean LIVE tree
- weaken, exclude, or bypass `readAuthorizedLocalHead()`
- add governance-file exceptions or dirty-tree tolerance
- represent LIVE ownership only in chat memory or an out-of-band store
- defer required LIVE mutex ownership until after runner start (fresh window would be blind)
- invoke the runner a second time after a consumed attempt
- treat reservation as runtime authorization, or authorization as a Git write

Runner SAFETY remains: `e2e/builder-golden-path/lib/staging.ts` `readAuthorizedLocalHead()`. No exclusions. The runner must prove that the code being tested is exactly the committed code represented by `AUTHORIZED_LOCAL_HEAD` and deployed to staging.

---

## 14. Example correct sequence

**PHASE A — REGISTER / RESERVE**

1. Register LIVE task.
2. Admit lane.
3. Reserve STAGING, PROVIDER-LIVE, CREDIT, ENV on `TASKS.md`.
4. Keep all mutation-authority booleans false.
5. Write registration/contract documentation.
6. Return control to Keith.
7. Keith commits/pushes Step 1 state.
8. Require clean tree.

**PHASE B — EXPLICIT AUTHORIZATION**

9. Keith authorizes the LIVE mutation envelope (staging mutation/deployment if required, temporary execution enablement, one provider call, qualifying credit deduction, cleanup/restoration). This does not modify Git.

**PHASE C — FINAL EXECUTION EDGE**

10. Verify required resource ownership is **already committed** on `TASKS.md`.
11. If missing: STOP; make only the required governance write; return to Keith for commit; restart Phase C.
12. Require `git status --short` = EMPTY.
13. Set `AUTHORIZED_LOCAL_HEAD = git rev-parse HEAD`.
14. From this point until runner return: **ZERO** repository writes.
15. Inspect staging.
16. If necessary, deploy exactly `AUTHORIZED_LOCAL_HEAD`.
17. Require staging HEAD match, clean tree, stash invariant, healthy services.
18. Import transient credentials and process-only LIVE flags.
19. Perform the final immediate triple gate.
20. If any gate differs: STOP BEFORE RUNNER.

**PHASE D — SINGLE RUN**

21. Invoke `npm run e2e:builder:live` exactly once.
22. No tracked repository writes while invocation is in progress.
23. Disconnect after invocation = run consumed; evidence/cleanup only.

**PHASE E — TERMINAL EVIDENCE**

24. After the runner returns, repository writes may resume.
25. Write execution evidence, board result/release, backlog durable result/status.
26. Release runtime resources only after confirmed-safe cleanup.
27. Later step performs checkpoint/consolidation/lock.

---

## 15. Example LIVE-07 invalid sequence

LIVE-07 remains COMPLETE AND LOCKED — FAIL/BLOCKED — ENVIRONMENT/PARITY_FAILURE — SAFETY. Do not convert to PASS. Do not rerun.

What happened:

1. Local tree CLEAN.
2. `AUTHORIZED_LOCAL_HEAD` captured (`6723c4699d9c2cea832f73356aa85960b230b3cf`).
3. Staging deployed at that SHA. Parity PASS.
4. Resource/control-plane writes changed tracked `TASKS.md` and `TASKS_BACKLOG_FULL.md`.
5. Local tree became DIRTY.
6. Runner invoked once.
7. AUTH PASS.
8. SAFETY independently checked local Git cleanliness.
9. SAFETY failed closed. Provider = 0. Credits = 0.

LIVE-07 Step 1 had intentionally **not** reserved STAGING / PROVIDER-LIVE / CREDIT / ENV, which deferred the board write into the Step 2 execution window. The runner SAFETY gate worked as intended.

---

## 16. Future prompt requirements

Any future provider-bearing LIVE prompt must include:

- acquire STAGING / PROVIDER-LIVE / CREDIT / ENV as **Step 1 reservation** (or use the fallback: board write → Keith commit → recapture → redeploy)
- keep mutation-authority booleans false until explicit Keith LIVE authorization
- do not write `TASKS_BACKLOG_FULL.md` for in-flight ownership after HEAD capture
- STOP for Keith commit whenever the tree is dirty
- capture `AUTHORIZED_LOCAL_HEAD` only on a clean tree that already contains the ownership commit
- deploy/recheck exactly that SHA
- final immediate triple gate before the single runner invocation
- no tracked or untracked repository writes between that capture and runner return
- never stash/restore/reset to pass SAFETY
- never weaken `readAuthorizedLocalHead()`
- post-run evidence/status writes only after runner return
- no second invocation after a consumed run
- reference this document: `docs/PRIVATE-BETA-E2E-LIVE-EXECUTION-SEQUENCING.md`
