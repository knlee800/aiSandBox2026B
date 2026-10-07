# CLEAN-BASELINE-GOV-01 — Decision record

**Date:** 2026-10-05 registration; 2026-10-07 closure
**Status:** COMPLETE AND LOCKED — 2026-10-07. Independent review accepted the ENV-validation package. Governance closure only. Not implementation acceptance. AUTH-1 is not granted.
**Earlier status, preserved as history:** REGISTERED 2026-10-05. Governance records written. NOT LOCKED until this closure. At that time this record did not claim independent reviewer approval, implementation success, runtime readiness, or authority for any host action.
**Repository HEAD at registration and closure:** `1abd3b6430fdd837413f4f4b39dc718a10954d04` (branch `main`; locally recorded `origin/main` is the same commit; no fetch).

## Planning basis

Keith approved these two files as the planning basis, subject to the governing corrections in this record:

| Input | SHA-256 |
|---|---|
| `C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-IMPLEMENTATION-PLAN-2026-10-05-CONSOLIDATED.md` | `3012ee8161f7dbdf16aac01e026872aadf7fa3842c234edc6603e98e85924df9` |
| `C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-IMPLEMENTATION-PLAN-2026-10-05-CONSOLIDATED-ADDENDUM-01.md` | `83f6b07332aeca04184228026ce662271d425a5ba17bfdece9b9ad177bd3774a` |

Both files are unchanged by this registration. Where the addendum and the consolidated plan conflict on the addendum's four operational topics, the addendum governs. Where this record's governing corrections conflict with the addendum, these corrections govern OPS-01 implementation and acceptance. They are requirements to be resolved in implementation. They are not a rewritten plan, and they are not implemented here.

## Direction

Recorded direction, not a claim that the path exists or has passed acceptance:

- Preserve the old Lightsail host's evidence.
- Keep the old host unproven. Never describe it as clean.
- Plan a replacement deployed from a known Git commit and a reviewed environment.
- Use native systemd services instead of PM2 resurrect.
- Require application behavior, backup, and restore verification before acceptance.
- Keep old-host retirement planned until it is separately authorized and observed.

**Objective.** A maintainable staging and production path for `ainow.biz`. This registration records that objective. It does not create the path and it does not accept one.

The consolidated plan's four amendments stay in force: console stop of the whole old instance after preservation; restore must show usable application state with external execution and email disabled, and rollback must be schema-compatible; the external inventory is bounded, and consequential gaps need an explicit decision; retention starts at 30 days, earlier deletion is conditional, and an extension needs explicit cost approval.

## What this registration writes

- This decision record.
- Canonical bodies in `TASKS_BACKLOG_FULL.md` for `CLEAN-BASELINE-GOV-01` (`nature=GOVERNANCE`) and for `CLEAN-BASELINE-RUNTIME-01`, `CLEAN-BASELINE-OPS-01`, and `CLEAN-BASELINE-DEPLOY-01` (`nature=IMPLEMENTATION`), each with one `AISB_MACHINE_REG_V1` stanza.
- Sidecar candidates for the three implementation tasks only, in `docs/control-plane/lane-saturation-state.json`.
- Current-board registration fields in `TASKS.md`. The occupancy block is not changed.
- One **PLANNED** row in `ARCHITECTURE.md`. The CURRENT staging row is not relabeled.

## Machine encoding

The occupancy block stays: Lane 1 EMPTY, Lane 2 EMPTY, Lane 3 DISABLED, governance UNOWNED, `saturationSuspended=false`, occupancy hash `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d`. GOVERNANCE is acquired only for a governance write and is released UNOWNED before validation. No implementation lane is admitted. GOV-01 remains NOT LOCKED.

`status=READY` together with `startCondition=NOT_READY` is valid registration encoding. It does not grant execution permission. Each implementation candidate uses that pair because this registration does not grant later authorization. Changing `startCondition` to `READY` is a later control-plane act and is not authorized now.

`scripts/validate-lane-capacity.ps1` `Test-Admissible` checks `status` and `startCondition` first. An OPTIONAL candidate then returns `NOT_FORCING`. Only a FORCING candidate continues to dependency and runtime-authorization checks. A saturation PASS does not prove DEPLOY-01 dependency satisfaction, host authorization, or provider authorization. Explicit control-plane checks against each slice's recorded prerequisites remain necessary. A saturation PASS is not admission, implementation acceptance, or host authorization.

`CLEAN-BASELINE-DEPLOY-01` is `OPTIONAL`. `CLEAN-BASELINE-RUNTIME-01` and `CLEAN-BASELINE-OPS-01` are `FORCING`. RUNTIME-01 and OPS-01 do not share a mutex: OPS-01 lists none. `localRuntimeAuthorized` is already true in the sidecar. `stagingAuthorized`, `providerLiveAuthorized`, and `creditAuthorized` stay false. The true local-runtime flag does not prove that a local runtime capability check has been performed.

RUNTIME-01's mutexes are `CONTAINER-MANAGER`, `LOCAL-RUNTIME`, and `ENV`. `ENV` is the catalog matcher required because `services/container-manager/.env.example` has basename prefix `.env` (`mutex-catalog.json`, ENV, `exclusive: true`). It is not a `runtimeNeeds` entry and it is not authorization to edit environment files, read secrets, or touch a host. RUNTIME-01 and DEPLOY-01 both declare `ENV`, so they are not a concurrent pair. DEPLOY-01's slice gates are unchanged.

## DEPLOY-01 slice dependencies (corrected; transitions not performed)

Slice A, the initial preservation slice, has machine `dependsOn` `[]`. RUNTIME-01 and OPS-01 locks are not prerequisites for preservation, so they are not in that list. `status=READY`, `startCondition=NOT_READY`, and `saturationClass=OPTIONAL` stay.

Recorded prerequisites, outside that empty machine list:

- CLEAN-BASELINE-GOV-01 completion and lock. Not done. This correction does not lock GOV-01.
- Slice A preservation: AUTH-2 only. AUTH-2 does not authorize stopping the host.
- Slice A stop and revocation: AUTH-3, separate from AUTH-2.

Before slice B, a later control-plane transition is mandatory and is not performed now:

- Verify RUNTIME-01 and OPS-01 are LOCKED with their required evidence.
- Add those task IDs to DEPLOY-01 `dependsOn`.
- Record that slice's authorization, scope, resources, and admission.
- Slice A admission does not carry permission into slice B or any later slice.
- C2 still requires its own PROVIDER-LIVE and CREDIT authorization and resource transition.

## RUNTIME-01 and OPS-01 acceptance bounds (not executed)

RUNTIME-01 implementation requires GOV-01 completion/lock and AUTH-1. Acceptance requires successful compatibility evidence for the supported runtime selected on the approved path: Node 24, or Node 22 if Node 24 fails. The consolidated plan §6.R builds, test suites, and workspace-bootstrap verification remain required. A failed check, an attempted check, or a stop for a PACKAGE task is BLOCKED / pending evidence. It is not acceptance and it is not grounds for LOCK. The selected host runtime, workspace image, and documented configuration must stay consistent with that approved fallback outcome.

OPS-01 implementation requires GOV-01 completion/lock and AUTH-1. Sidecar `mutexes=[]` and `runtimeNeeds=[]` cover code preparation and static checks only. Before any runtime test, the control plane must update the actual resource and evidence needs, including LOCAL-RUNTIME when the test uses it. Runtime work that shares LOCAL-RUNTIME is sequential with RUNTIME-01. Local runtime capability is still to be established. Its absence is not already proven, and the sidecar flag `localRuntimeAuthorized=true` is not that proof. Static checks alone cannot satisfy the focused operational tests and cannot justify OPS-01 LOCK. Governing corrections a-d, U1, and U2 remain in force. No implementation test or capability probe is authorized now.

## Governing corrections (binding on OPS-01; not implemented)

These correct the addendum's operational sequences. OPS-01 acceptance requires them. This registration does not mark them done.

**a. Phase names and restart order.** Implementation must use one phase vocabulary across prepare, first-start, restore, deploy, backup, and maint, and every recovery path may name only phases the scripts write. Any authorized writer restart removes the maintenance marker first, then starts the unit. Addendum §3.5 Q3 currently restarts `aisandbox-gateway` and `aisandbox-frontend` and then removes the marker. That order cannot succeed while those units assert that the marker is absent. The required Q3 order is: confirm the tree and schema are unchanged, remove the marker, then start the two units.

**b. Pre-start and post-start failure.** Pre-start failure means the marker is still present and no writer has started in this operation. Post-start failure means the marker has been removed or a writer start is already in the journal, including a start that then crashed. After startup has occurred, records must not say that writers never started. Interruption after marker removal, including reboot, is in scope: with the marker gone, enabled units can start at boot. Implementation must define that case and test the documented recovery.

**c. Restore reproduces the backed-up file set.** Restore must remove tracked files that the prepared checkout contains and the backup does not, so a tracked file deleted on the source does not reappear. Ownership, ACLs, and extended attributes stay exact-diff requirements. A focused test deletes a tracked file under `workspaces/`, `database/`, or `projects/`, backs up, restores onto a fresh prepared target, and shows the file absent. That reconciliation runs only on a target that passed the empty-target checks. No mode overwrites a populated primary.

**d. These four items are resolved only by OPS-01 implementation and its focused tests.** Registration does not declare them implemented or passed.

## U1 and U2 (recorded; no new authorization)

**U1.** Code preparation may proceed in parallel where the lane rules allow, during separately authorized implementation. Runtime tests that share LOCAL-RUNTIME run sequentially. Establish local capability before proposing cloud tests. Cloud tests require separate authorization, a stated spending limit, and a cleanup scope. No resources, implementation, or tests are authorized now. This does not authorize subagents.

**U2.** Stale execution or collaboration records require individual, recorded approval based on evidence. There is no automatic override, replay, or mutation. Changing a status does not establish that the work has stopped.

## Preserved historical gates

Unchanged by this registration:

- `HOST_CLEAN=NO`
- `P7_ACCEPTED=NO`
- `EXEC-01C6A=NOT_READY` (not reopened)
- The old PM2 host remains unproven. It is not clean.
- The inspection controller remains suspended. Its evidence and findings stay as written.
- PM2 mechanism experiments (MECH-EXP-01, MECH-EXP-02, MECH-EXP-03) are local fixture evidence only. They are not host readiness.
- Locked PM2 recovery decisions are not reopened and are not weakened.
- GO-NO-GO-01 GO (2026-08-23) and the LIVE-11 NO-GO both remain historical. Neither transfers to a replacement.
- Unfinished work is not marked completed. A planning or status change is not retirement of the old host. Retirement stays planned until separately authorized and observed.

## Authorization boundary

This record is the AUTH-0 governance write only: the decision record, the registrations, the board and backlog and lane-saturation records, and the PLANNED architecture row.

Not authorized: implementation or execution of the registered tasks; admission; builds; tests; application or runtime activity; Docker, PostgreSQL, or Redis; browser automation; host, SSH, console, or provider access; provisioning; shutdown; deletion; DNS changes; spending; credit-consuming calls; invitations; PM2 inspection, restart, stop, repair, or use; subagents; Git mutation.

AUTH-1 through AUTH-9 and AUTH-W in the consolidated plan are not granted.

## Validator

The 2026-10-05 correction authorizes one canonical run of the unchanged `scripts/validate-lane-capacity.ps1` after these text corrections, writing `docs/control-plane/SATURATION_PROOF.json`. The inherited proof is preserved outside the repository before that write. Its file SHA-256 at preservation is `7b7215fca68d0724f15baf2f73618c57069c53715743040c2b2bfba959ceb9c2` and its Git blob is `50ce410efe547a7e24f06ef75b9410916d5dae8a`. That inherited artifact is not the new validation result.

Registration validation is separate from implementation acceptance. A saturation PASS does not admit a task, accept implementation, authorize a host, or prove DEPLOY-01's dependencies. GOV-01 stays NOT LOCKED. The three implementation tasks stay PLANNED / NOT ADMITTED / NOT EXECUTED. The generated proof is not hand-edited.

**Canonical validation result, 2026-10-05, exit 1.** The unchanged repository script was run once. Exit code 1. Stdout: `{"errorCode":"MALFORMED","exitCode":1,"result":"FAIL"}`. Stderr was empty. Exit 1 does not call `Save-Proof`, so `docs/control-plane/SATURATION_PROOF.json` was not rewritten. Its file SHA-256 remained `7b7215fca68d0724f15baf2f73618c57069c53715743040c2b2bfba959ceb9c2` and its Git blob remained `50ce410efe547a7e24f06ef75b9410916d5dae8a`. That result stands. It was not a PASS.

**Diagnostic copy, not canonical.** After that exit 1, an instrumented copy of the script was written outside the repository and run with a non-canonical proof path. The copy reported the throw in `Expand-Effective`: `services/container-manager/.env.example` matches the ENV basename prefix `.env`, and ENV was not in the candidate's mutexes. That diagnostic run also exited 1 and wrote no proof. It is not canonical validation and it is not a PASS. This record does not treat that copy as retroactively authorized. No further modified validator copy is created or run.

**ENV mutex correction.** `CLEAN-BASELINE-RUNTIME-01` now lists `CONTAINER-MANAGER`, `LOCAL-RUNTIME`, and `ENV`. The three write paths are unchanged. `runtimeNeeds` remains `["LOCAL-RUNTIME"]`. `status=READY` and `startCondition=NOT_READY` remain. Adding ENV does not authorize editing environment files, reading secrets, host access, or implementation.

**Canonical validation result after the ENV correction.** The unchanged `scripts/validate-lane-capacity.ps1` was run once with its default proof path. Exit code 0. Stderr was empty. It wrote `docs/control-plane/SATURATION_PROOF.json`. That file's SHA-256 is `d9c945d39afddf21b91a4715abb77efc123910330a7d2e3a206beb11f2c7d55a`. The proof reports `result=PASS`, `exitCode=0`, `idleCode=NO_PAIRWISE_ADMISSIBLE_CANDIDATE`, `headSha=1abd3b6430fdd837413f4f4b39dc718a10954d04`, occupancy hash `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d`, and `workingTreeDirty=true`. `admissibleForcingCandidates` is empty. CLEAN-BASELINE-RUNTIME-01, CLEAN-BASELINE-OPS-01, and CLEAN-BASELINE-DEPLOY-01 are each `NOT_READY`, because `startCondition` is checked before the OPTIONAL short-circuit. This PASS is registration validation only. It does not admit a task, accept implementation, authorize a host, or prove DEPLOY-01 dependency satisfaction. At the time of that run, GOV-01 was NOT LOCKED. That sentence is history. The closure below is the current status.

## Closure — 2026-10-07

Independent review accepted `C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-GOV-01-ENV-VALIDATION-2026-10-05.zip`, SHA-256 `f30b05905b3a7acf13b79d7ddaca56714dd66b0c75d23cbef8046eeba4deb58b`. The reviewer verified the package manifest, diffs, ENV correction, preserved inherited proof, and the canonical PASS proof’s sidecar, catalog, and occupancy bindings.

CLEAN-BASELINE-GOV-01 is COMPLETE AND LOCKED. It is GOVERNANCE. It has no implementation candidate and occupies no implementation lane. `CLEAN-BASELINE-GOV-01` is added to `lockedTaskIds`. GOVERNANCE was used for this closure write and released UNOWNED. The occupancy block is unchanged.

This lock does not grant AUTH-1 or any later authorization. RUNTIME-01, OPS-01, and DEPLOY-01 stay PLANNED / NOT ADMITTED / NOT EXECUTED, with `status=READY` and `startCondition=NOT_READY`. DEPLOY-01’s slice gates are unchanged. Authorization flags are unchanged. `HOST_CLEAN=NO`, `P7_ACCEPTED=NO`, and `EXEC-01C6A=NOT_READY` stay. The inspection controller stays suspended. The old host stays unproven. Physical retirement has not been observed. The ARCHITECTURE replacement row stays PLANNED.

The exit-1 canonical failure and the separate diagnostic-copy run remain historical. Neither is withdrawn.

**Closure validation.** After this lock was recorded and GOVERNANCE was released, the unchanged `scripts/validate-lane-capacity.ps1` was run with its default proof path. Exit code 0. Stderr was empty. `admissibleForcingCandidates` is empty. `idleCode` is `NO_PAIRWISE_ADMISSIBLE_CANDIDATE`. The three implementation candidates remain `NOT_READY`. This PASS closes the governance registration record only. It does not admit or accept implementation.
