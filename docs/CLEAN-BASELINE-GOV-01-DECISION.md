# CLEAN-BASELINE-GOV-01 — Decision record

**Date:** 2026-10-05 registration; 2026-10-07 closure
**Status:** COMPLETE AND LOCKED — 2026-10-07. Independent review accepted the ENV-validation package. Governance closure only. Not implementation acceptance. AUTH-1 is not granted by this lock.
**Later RUNTIME-01 admission:** the final section of this record. GOV-01 review is not reopened.
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


## Scoped AUTH-1 - CLEAN-BASELINE-RUNTIME-01 admission - 2026-10-07

Keith authorized a scoped AUTH-1 for CLEAN-BASELINE-RUNTIME-01 only: control-plane admission, the three registered implementation files, and the approved local validation. This is not the consolidated plan's paired admission of OPS-01. OPS-01 and DEPLOY-01 stay PLANNED / NOT ADMITTED / NOT EXECUTED with startCondition=NOT_READY. Their scopes and dependency order are unchanged. AUTH-2 through AUTH-9 and AUTH-W remain not granted.

Lane 1 is ACTIVE for CLEAN-BASELINE-RUNTIME-01. Sidecar status=ADMITTED and startCondition=READY. Mutexes are CONTAINER-MANAGER, LOCAL-RUNTIME, and ENV. runtimeNeeds remains ["LOCAL-RUNTIME"]. ENV matches services/container-manager/.env.example. It is not authorization to edit other environment files, read secrets, or touch a host. stagingAuthorized, providerLiveAuthorized, and creditAuthorized stay false. localRuntimeAuthorized stays true.

The RUNTIME-01 sentence that said GOV-01 is absent from lockedTaskIds is corrected in the canonical body. The 2026-10-07 closure already added CLEAN-BASELINE-GOV-01 to lockedTaskIds. That absence wording is preserved there as history. Machine dependsOn stays [].

GOVERNANCE was acquired for this admission write and released UNOWNED before the canonical validator run. Occupancy hash for this end state is sha256:13d941df51bdb9f4eb912d0a89db71b4ca85e05b138de1cf501f69251e538358. Lane 2 stays EMPTY. Lane 3 stays DISABLED. saturationSuspended stays false.

Before that validator run, the existing docs/control-plane/SATURATION_PROOF.json was copied outside the repository to C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-RUNTIME-01-work\SATURATION_PROOF-before-RUNTIME-01-admission.json. SHA-256 7bc5535345ecd5e461fed00a2aebff807d2943e05981314432e2e993acffb015. That file is the committed closure proof. Its precommit HEAD is historical validation evidence and is not regenerated because HEAD moved.

This admission does not accept implementation, does not LOCK RUNTIME-01, and does not authorize host access, deployment, retirement, invitations, harness activation, provider calls, spending, subagents, or Git mutation. HOST_CLEAN=NO, P7_ACCEPTED=NO, and EXEC-01C6A=NOT_READY stay. The inspection controller stays suspended. The ARCHITECTURE replacement row stays PLANNED.

## RUNTIME-01 Step 2 result - 2026-10-07 - pending evidence

The three registered files were edited in the working tree. The selected runtime is Node 24. The normal workspace default is `node:24-alpine`. Node 22 was not used.

Official `node:24-bookworm` `sha256:3d27e5c11e5786e309ec3e03f93ae536eb36e6e5eb3714d5eb3300a36157add0` ran root `npm ci` with `NODE_ENV` unset, then the four builds and four test scripts. Official `node:24-alpine` `sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1` ran the workspace bootstrap: Git 2.54.0 and Node v24.21.0.

Container-manager tests passed: 8 suites, 137 tests. AI-service tests passed: 38 suites, 903 passed, 1 skipped. Frontend tests passed: 776 passed, 0 failed, 0 skipped. Gateway `npm test` exited 1: 13 failed, 7 skipped, 2280 passed. The failure is `smoke.integration.spec.ts` with `ECONNREFUSED 127.0.0.1:5432`. That file's own prerequisite is PostgreSQL on localhost:5432. It was not started. Live `.env` files were not copied into the test copy. This is not evidence that Node 24 is incompatible, and it is not acceptance.

Lane 1 stays ACTIVE. Candidate status stays ADMITTED. The task is not LANE-DONE and not LOCKED. OPS-01 and DEPLOY-01 stay `startCondition=NOT_READY`. The admission validator PASS is not implementation acceptance.

## RUNTIME-01 gateway continuation - 2026-10-07 - still pending

The first gateway failure was not only a missing database. All 13 smoke tests failed in `beforeAll`. The recorded assertion was `APP_BASE_URL is required for email auth`. TypeORM also logged `ECONNREFUSED 127.0.0.1:5432` because `NODE_ENV=test` resolves the host to localhost.

A task-owned PostgreSQL 15.17 container and Redis 7 container shared one network namespace with the Node 24 test container, so `127.0.0.1:5432` and `127.0.0.1:6379` were those fixtures. Credentials were test-only. `npm run migration:run` applied the gateway migrations after `NODE_PATH` exposed the workspace `ts-node`. Schema check found `api_keys`, `usage_records`, `billing_snapshots`, and `invoices`. Image identity remained `sha256:3d27e5c11e5786e309ec3e03f93ae536eb36e6e5eb3714d5eb3300a36157add0`. The three implementation-file hashes matched. `AI_PROVIDER=stub`. No provider call was made.

Final gateway command: `npm test -- --watchAll=false --ci`. Exit 1. Test Suites: 1 failed, 2 skipped, 170 passed, 171 of 173 total. Tests: 1 failed, 7 skipped, 2292 passed, 2300 total. The skipped suites remain the opt-in PostgreSQL suites. The failed test is `POST /api/ai/execute should execute with real provider`: expected 200, received 503. `GLOBAL_EXECUTION_ENABLED` defaults false and the guard returns 503 with `AI execution temporarily disabled for maintenance`. The current execute handler returns 202 `{ executionId, status: 'queued' }` and does not return provider output. Passing that test needs a gateway or test change outside the three-file scope, or a live provider execution this authorization does not allow.

Node 24 stays the selected runtime. The task stays ACTIVE and is not LANE-DONE. Occupancy was not changed, so the admission saturation proof was not regenerated.

## RUNTIME-01 scope amendment - smoke test only - 2026-10-07

Keith authorized a prospective bounded amendment before the edit. The current application write scope adds exactly `services/api-gateway/src/__tests__/smoke.integration.spec.ts`. The original three container-manager paths remain. GATEWAY is added to the candidate and to Lane 1. CONTAINER-MANAGER, LOCAL-RUNTIME, and ENV stay. `runtimeNeeds` stays `["LOCAL-RUNTIME"]`. GATEWAY was UNOWNED on the current board. GOV-01 remains LOCKED. This amendment is not Step 3 and not LOCK.

Controlling contract, confirmed before the edit: PRD §4 and §5 say Ask/Build and AI execution are asynchronous. ARCHITECTURE §11.1 step 7 says return `202 { executionId, status: 'queued' }`. §11.2 says `GLOBAL_EXECUTION_ENABLED` defaults false and then `POST /api/ai/execute` returns 503 before any logic runs. The smoke test's 200 and synchronous provider-output expectation conflicts with that current contract. It is not the production contract. The authorized correction is the smoke test only. A live provider call would not turn that obsolete 200 response into the current 202 contract. The corrected smoke test covers the documented 503 maintenance response with no enqueue, and the documented 202 queued response with enqueue, using test-only state. Focused smoke result: 14 passed. Full gateway result: 7 skipped, 2294 passed, 2301 total, exit 0. Lane 1 is LANE-DONE and not LOCKED.

## Queue isolation and clean copy - 2026-10-07

The lane returned from LANE-DONE to ACTIVE for this continuation, then returned to LANE-DONE after the checks below. Mutexes stayed CONTAINER-MANAGER, LOCAL-RUNTIME, ENV, and GATEWAY. `runtimeNeeds` stayed LOCAL-RUNTIME.

Jest has no setupFiles and no queue mock. `QueueService.enqueueExecution` calls `this.queue.add`. The earlier spy recorded that call and still submitted the BullMQ job. The smoke test now replaces `enqueueExecution` with a function that records the payload and resolves without calling `queue.add`. The real handler, authentication, and guards still run. No gateway worker is constructed in api-gateway source.

The scratch copy is root manifests, api-gateway source, other workspace package.json files, and the three container-manager runtime files. It excludes workstation databases, journals, `.git`, and the workstation `workspaces` and `projects` trees. `database/aisandbox.db` resolved to `/tmp/aisb-scratch/database/aisandbox.db` and was absent before the suite. Fresh PostgreSQL 15 and Redis 7 were used. `AI_PROVIDER=stub` and `EMAIL_PROVIDER=stub`.

Focused smoke: 14 passed, exit 0. Full gateway: 7 skipped, 2294 passed, 2301 total, exit 0. The two opt-in PostgreSQL suites stayed skipped. A live provider run is not what this local contract test proves.

## RUNTIME-01 Step 3 closure and LOCK - 2026-10-07

Independent review accepted `C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-RUNTIME-01-ISOLATION-2026-10-07.zip`, 9168136 bytes, SHA-256 815fbcd6d3a99514ec2e872ece98ea965eb58c5552618873a94cd8e2c1fe403b. That package is the lock basis. No further implementation or test cycle was run.

CLEAN-BASELINE-RUNTIME-01 is COMPLETE AND LOCKED. Checkpoint: `docs/CLEAN-BASELINE-RUNTIME-01-CHECKPOINT.md`. Candidate status is LOCKED. The task ID is in `lockedTaskIds` exactly once. Lane 1 is EMPTY. Lane 2 stays EMPTY. Lane 3 stays DISABLED. CONTAINER-MANAGER, LOCAL-RUNTIME, ENV, and GATEWAY are UNOWNED. GOVERNANCE is UNOWNED.

The locked outcome is the local runtime prerequisite: selected runtime Node 24 and normal workspace image `node:24-alpine`, with the local smoke contract in the accepted package. OPS-01 and DEPLOY-01 stay `startCondition=NOT_READY` and unadmitted. `localRuntimeAuthorized` stays true. `stagingAuthorized`, `providerLiveAuthorized`, and `creditAuthorized` stay false. HOST_CLEAN=NO, P7_ACCEPTED=NO, and EXEC-01C6A=NOT_READY stay. The inspection controller stays suspended. The ARCHITECTURE replacement row stays PLANNED.

This lock does not accept deployment, a real Builder journey, backup or restore, host access, invitations, harness activation, provider calls, spending, or Git mutation. GOV-01 review is not reopened.

## Scoped AUTH-1 - CLEAN-BASELINE-OPS-01 admission - 2026-10-08

Keith authorized a scoped AUTH-1 for CLEAN-BASELINE-OPS-01 only: control-plane admission, implementation preparation under ops/clean-baseline/, and static validation. This is not operational execution and not a LOCAL-RUNTIME grant. DEPLOY-01 stays PLANNED / NOT ADMITTED / NOT EXECUTED with startCondition=NOT_READY. AUTH-2 through AUTH-9 and AUTH-W remain not granted. stagingAuthorized, providerLiveAuthorized, and creditAuthorized stay false. localRuntimeAuthorized stays true and is not proof that a local operational capability check has been performed.

Lane 1 is ACTIVE for CLEAN-BASELINE-OPS-01. Sidecar status=ADMITTED and startCondition=READY. mutexes=[] and runtimeNeeds=[] are unchanged. The write scope remains ops/clean-baseline/ only. Evidence class remains LOCAL-TESTS for static checks. RUNTIME-01 stays LOCKED. GOV-01 stays LOCKED. Machine dependsOn stays [].

GOVERNANCE was acquired for this admission write and released UNOWNED before the canonical validator run. Occupancy hash for this end state is sha256:d2f1a029d868239bea7118ca5873aa7b91ad03b0b3ce238cef0f993e227584c1. Lane 2 stays EMPTY. Lane 3 stays DISABLED. saturationSuspended stays false.

Before that validator run, the existing docs/control-plane/SATURATION_PROOF.json was copied outside the repository to C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-OPS-01-work\SATURATION_PROOF-before-OPS-01-admission.json. SHA-256 96d6243eda3bf641468aed59f483fb08e321cc03f517873700b907d04e81c8fa. That preserved file is the proof that was already in the tree at HEAD 36f9a213b7e16c0cb12587a2d74cd0f679fdc54c. It is not regenerated in place. Its headSha is historical validation evidence.

Repository HEAD at this admission is 36f9a213b7e16c0cb12587a2d74cd0f679fdc54c on main. The consolidated plan SHA-256 3012ee8161f7dbdf16aac01e026872aadf7fa3842c234edc6603e98e85924df9 and Addendum 01 SHA-256 83f6b07332aeca04184228026ce662271d425a5ba17bfdece9b9ad177bd3774a were recomputed and match. Governing corrections a-d and U1/U2 take precedence over the addendum where they conflict.

This admission does not accept implementation, does not justify LANE-DONE or LOCK, and does not authorize host access, deployment, retirement, invitations, harness activation, provider calls, spending, subagents, or Git mutation. HOST_CLEAN=NO, P7_ACCEPTED=NO, and EXEC-01C6A=NOT_READY stay. The inspection controller stays suspended. The ARCHITECTURE replacement row stays PLANNED. Application source is untouched by this admission.

## OPS-01 Step 2 static preparation - 2026-10-08

The admitted scope was prepared under `ops/clean-baseline/` only. Application source and ARCHITECTURE.md were not edited. Node 24 and `node:24-alpine` remain the locked selection. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. AUTH-2 through AUTH-9 and AUTH-W stay not granted. Authorization flags stay unchanged. HOST_CLEAN=NO, P7_ACCEPTED=NO, and EXEC-01C6A=NOT_READY stay.

Static checks were run. Operational entry points were not executed. No runtime fixture was started and no tooling was installed. T2.6 and T4.4 passed. bash -n passed for the shell files. A static Q3-order check and a post-start wording check also passed. Those static results do not pass corrections a-c and do not justify LANE-DONE or LOCK.

Lane 1 stays ACTIVE. Sidecar `status=ADMITTED`, `startCondition=READY`, `mutexes=[]`, and `runtimeNeeds=[]` stay as validated. The canonical admission proof was not rewritten after these preparation files were added, because the occupancy block and the sidecar were not changed again. GOVERNANCE was used for this status record and is not held.

T3.7 stays a gap for a later AI-SERVICE task. The worker implements the claim-miss branches, and the behavioral specs that execute the worker call it once from a pending ledger. Those specs do not demonstrate the stalled-claim or duplicate-skip branches. No application test was added. RUNTIME-01 stays LOCKED.

## OPS-01 correction pass F01-F11 - 2026-10-08

Independent review required corrections before any operational execution. Those corrections are in `ops/clean-baseline/` only. The earlier operational scripts were scaffolding; they are now executable preparations and remain unexecuted. Admission is unchanged: Lane 1 ACTIVE, sidecar status=ADMITTED, startCondition=READY, mutexes=[], runtimeNeeds=[]. A later transition that adds LOCAL-RUNTIME must put that resource in both mutexes and runtimeNeeds. This record does not make that transition. DEPLOY-01 stays startCondition=NOT_READY and unadmitted. The canonical admission proof was not regenerated. No operational entry point, fixture, or validator was run for this correction pass.

## OPS-01 correction pass R1-R6 - 2026-10-08

A second independent review found control-flow defects and incomplete operational-case preparation. The corrections stay under `ops/clean-baseline/`. Standalone backup keeps an in-place quiescence record and still fails when that record is missing or a distinct copy fails. Restore binds the empty-target result onto the new operation record, reconciles tracked deletions without treating a present archive member as a fatal status, and continues a roles script past an expected duplicate. Preparation reads the Caddy operator hash literally, skips a same-directory install copy, and resumes partial shared configuration. Recovery compares the target with retained applied-migration blobs, including after `op_begin`, and a schema-ahead approval does not waive that check. Test hooks use the root-owned mode 0600/0400 gate. That gate remains an operator assertion and does not prove a disposable OS namespace.

Shell-only regressions source the library, use temporary files, and mock external commands. They passed, including probes that show the reviewed failure mode and the corrected function. The operational scripts now state setup, actions, assertions, evidence, and cleanup for addendum T1-T4 and corrections b and c. Those scripts and the fixture builder were not executed. Mocked results do not prove them.

Lane 1 stays ACTIVE. This pass is not LANE-DONE and not LOCK. Sidecar status=ADMITTED, startCondition=READY, mutexes=[], and runtimeNeeds=[] are unchanged. The canonical admission proof was not regenerated. DEPLOY-01 stays startCondition=NOT_READY and unadmitted. RUNTIME-01 stays LOCKED. GOVERNANCE was used for this status record and is not held.

## OPS-01 residual pass R2/R3/R4/R6 - 2026-10-08

The second R1-R6 review left role completion, configuration write failures, schema-ahead migration retention, and several prepared-case workflows open. Those residuals are corrected under `ops/clean-baseline/` only. Confirmed R1 and R5 behavior is unchanged. Role restore rejects a nonzero result that is not an expected duplicate `CREATE ROLE`, including a transport failure after an earlier role was created. Shared configuration writes return failure when generation or either write fails, and empty generated secrets are rejected. Applied migration content is a cumulative ledger: a schema-ahead checkout that lacks a migration does not delete that migration's blob, a later target that changes it is rejected, and a database row with no ledger entry fails closed.

Shell regressions call those functions in failure and recovery order with temporary files and mocked commands. They passed. They do not execute entry points, and they are not operational acceptance. The operational scripts now share reboot evidence ids, clear an injected fault before rollback, fail a deploy after migration for the recovery rehearsal, bind bundle identity, and compare refusal snapshots. Those scripts and the fixture builder remain unexecuted.

Lane 1 stays ACTIVE. This pass is not LANE-DONE and not LOCK. Sidecar status=ADMITTED, startCondition=READY, mutexes=[], and runtimeNeeds=[] are unchanged. The canonical admission proof was not regenerated. DEPLOY-01 stays startCondition=NOT_READY and unadmitted. RUNTIME-01 stays LOCKED.

## OPS-01 follow-up — dump session, kv_set, and migration lifecycle — 2026-10-08

The residual review found that splitting a PostgreSQL 15 roles dump across psql processes breaks `\restrict` / `\unrestrict`, that `kv_set` can drop unrelated settings when `grep` fails, and that the migration ledger was not created by first-start, backup, or an interrupted migrate. Those paths are now connected under `ops/clean-baseline/`.

Role restore feeds one psql session, keeps the dump's meta-commands, and tolerates only `duplicate_object` on `CREATE ROLE`. `kv_set` leaves the original file in place when filtering returns an error. First-start and deploy stage attempted blobs before `start_migrate` and commit them only after verification. A from-maintenance recovery promotes that attempt when the database already has the rows. Backup copies the ledger when `DEPLOYED` exists, and restore installs it before writers start. A query error or a malformed timestamp is not treated as an empty migration set.

Shell regressions use a sanitized `pg_dumpall --roles-only` fixture and the first-start, interruption, backup, and restore function order. They passed. They do not execute entry points. Operational acceptance remains pending.

Lane 1 stays ACTIVE. This pass is not LANE-DONE and not LOCK. Sidecar status=ADMITTED, startCondition=READY, mutexes=[], and runtimeNeeds=[] are unchanged. The canonical admission proof was not regenerated. DEPLOY-01 stays startCondition=NOT_READY and unadmitted. RUNTIME-01 stays LOCKED.

## OPS-01 R4 correction — confirmed promotion only — 2026-10-08

`reconcile_attempted_after_interruption` no longer commits the whole attempt file. It promotes an attempt entry only when the database lists that timestamp and the attempt blob matches any blob already in the applied ledger. Entries the database does not confirm stay in the attempt file and are not applied-content restrictions. A query failure, a malformed timestamp, an applied timestamp with no attempt evidence, or a blob conflict returns 10 and does not replace the applied ledger. The post-verify commit path and the other deploy guards are unchanged. Shell regressions cover none, partial, and complete confirmation, an unapplied content change, a rejected applied content change, and invalid evidence. They do not execute entry points. Operational acceptance remains pending.

Lane 1 stays ACTIVE. This correction is not LANE-DONE and not LOCK. Sidecar status=ADMITTED, startCondition=READY, mutexes=[], and runtimeNeeds=[] are unchanged. The canonical admission proof was not regenerated. DEPLOY-01 stays startCondition=NOT_READY and unadmitted. RUNTIME-01 stays LOCKED.

## OPS-01 R6 correction — failure recording — 2026-10-08

Failure recording now covers T4, the Q3-order case, the post-start reboot case, the deleted-tracked-file case, and the fixture builder, using the same record as T1–T3. The record is written only after the disposable gate arms it, and only into a safe case-state directory. Rejecting an unsafe fixture root does not create that record. Intentional reboot keeps the evidence file and does not record contamination when reboot succeeds. A failed reboot records the reboot status and keeps the evidence. The no-ACL cleanup runs with the failure record: the original exit status is preserved, and a cleanup failure is printed and included in the record. Migration logic and production entry points are unchanged. The failure-recording harness passed. Operational scripts and the fixture builder were not executed. Operational acceptance remains pending.

Lane 1 stays ACTIVE. This correction is not LANE-DONE and not LOCK. Sidecar status=ADMITTED, startCondition=READY, mutexes=[], and runtimeNeeds=[] are unchanged. The canonical admission proof was not regenerated. DEPLOY-01 stays startCondition=NOT_READY and unadmitted. RUNTIME-01 stays LOCKED.

## OPS-01 R6 cleanup correction — retained unmount failure and resolved case state — 2026-10-08

`restore_noacl_mount` keeps the first failed unmount and still attempts the remaining unmount. A later check that the staging directory is not a mountpoint no longer replaces that failure with success. `case_finish` exits with the original case status when the case failed, and with the cleanup status when only cleanup failed. Both results write `case-contaminated`.

A case-state path is resolved, including existing parent symlinks, before the destination policy is applied and before a directory is created. Traversal into a forbidden directory, a symlink alias to a forbidden directory, and a path whose parent is not a directory are rejected without a write.

The failure-recording harness mocked `findmnt`, `umount`, and `mountpoint` and checked traversal and symlink aliases in temporary directories. Operational scripts, the fixture builder, real mounts, reboot, and services were not executed. R4 migration logic is unchanged. Operational acceptance remains pending. Snapshot coverage was not started.

Lane 1 stays ACTIVE. This correction is not LANE-DONE and not LOCK. Sidecar status=ADMITTED, startCondition=READY, mutexes=[], and runtimeNeeds=[] are unchanged. The canonical admission proof was not regenerated. DEPLOY-01 stays startCondition=NOT_READY and unadmitted. RUNTIME-01 stays LOCKED.

## OPS-01 T4.2 planted-file coverage — 2026-10-08

`t4.2-ignored`, `t4.2-snapshot`, and `t4.2-snapshot-root` now select their planted files with `AISB_SNAPSHOT_FILES` before the refusal comparison and clear that selection afterward. The files are `/opt/aisandbox/projects/ignored.tmp`, `/opt/aisandbox/services/snapshot-store/extra`, and `/opt/aisandbox/snapshot-store/extra`. The snapshot helpers are unchanged. A focused regression calls those helpers with temporary files and mocked external commands: unchanged contents compare equal, changed contents compare unequal while the filename listing stays the same, and a missing selected file makes snapshot capture fail. The same regression reads the three case blocks and checks the selected path. It does not execute the operational script. R4 and the R6 failure-recording corrections are unchanged. Operational acceptance remains pending.

Lane 1 stays ACTIVE. This correction is not LANE-DONE and not LOCK. Sidecar status=ADMITTED, startCondition=READY, mutexes=[], and runtimeNeeds=[] are unchanged. The canonical admission proof was not regenerated. DEPLOY-01 stays startCondition=NOT_READY and unadmitted. RUNTIME-01 stays LOCKED.

## OPS-01 Lightsail OS-capability scope — 2026-10-08

Keith authorized one new Lightsail instance, `aisb-ops-base-01`, in `ap-southeast-1`. The blueprint is Ubuntu 24. The bundle is the Linux public-IPv4 plan with 2 vCPU, 4 GB RAM, 80 GB SSD, and a US$24/month cap. The maximum lifetime is 72 hours from creation. The maximum incremental spending is US$15. Access is browser SSH only. No static IP, snapshot, second instance, or DNS change is authorized.

Lane 1 and the OPS-01 candidate now reserve `STAGING`: `mutexes=["STAGING"]`, `runtimeNeeds=["STAGING"]`, `evidenceClass=STAGING-RUNTIME`. `stagingAuthorized=true` is the machine gate for that reservation. It does not authorize deployment, PM2, Caddy, DNS, or `ENV`. `localRuntimeAuthorized` stays true and is not this grant. `providerLiveAuthorized` and `creditAuthorized` stay false. `writePaths` stay `ops/clean-baseline/`. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. It declares `STAGING` and does not own it.

GOVERNANCE was held for these records and released UNOWNED before validation. The pre-transition proof is archived unchanged at `docs/control-plane/SATURATION_PROOF-before-OPS-01-STAGING-2026-10-08.json`. Canonical validation writes the new proof bound to the resulting occupancy and sidecar. OPS-01 stays ACTIVE. This scope is OS capability evidence only, not operational acceptance and not LOCK.

## OPS-01 Batch 1A — 2026-10-09

Keith authorized one prepare run on the existing instance `aisb-ops-base-01` only. Access stays Lightsail browser SSH. The deadline stays 2026-10-11 18:18:33 HKT. The incremental spending limit stays US$15. The command is `t1-prepare.sh t1.1 36f9a213b7e16c0cb12587a2d74cd0f679fdc54c` after the 42-file archive `CLEAN-BASELINE-OPS-01-BATCH-1A-TREE-2026-10-09.tar.gz` verifies. Archive SHA-256 is `247261e401f5424447a7ec990e7001163e7fad6b5f5531f0260fdcfec4fe7fc5`. Manifest SHA-256 is `b3af137e1e99963cdfa5893b82797d736c79c0bac5e95ae0fefc6c5d5f22eaeb`. Git access is anonymous. This batch creates no credential and no age key. It includes package installation, `npm ci`, and the builds performed inside prepare. It does not include first-start, a refusal case, backup, restore, deploy, fault injection, a test reboot, a firewall change, a snapshot, or another instance. A failed check is not bypassed. A failed run keeps its logs and contamination record and is not repaired or retried automatically. A successful run leaves the guest prepared and idle.

Lane identity, mutexes, runtime needs, evidence class, and authorization flags stay as recorded for the STAGING reservation. Occupancy and the sidecar are unchanged, so saturation validation is not rerun. GOVERNANCE stays UNOWNED. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. OPS-01 stays ACTIVE. This batch is not operational acceptance and not LOCK.

## OPS-01 Batch 1B — 2026-10-09

Keith authorized the nine T1.2 refusal cases on the existing instance `aisb-ops-base-01` only, through the existing Lightsail browser SSH session. The deadline stays 2026-10-11 18:18:33 HKT. The incremental spending limit stays US$15. Batch 1A is not rerun. Each case runs through `tests/operational/t1-prepare.sh` with the bound SHA `36f9a213b7e16c0cb12587a2d74cd0f679fdc54c`, in this order: `t1.2-database`, `t1.2-role`, `t1.2-untracked`, `t1.2-sqlite`, `t1.2-ignored`, `t1.2-snapshot`, `t1.2-redis`, `t1.2-enabled`, `t1.2-deployed`. The expected inner prepare refusal is 10. The expected overall case exit is 0. An unexpected result, failed snapshot comparison, failed cleanup, or contamination marker stops the batch. Evidence is preserved. The batch does not repair, retry, or continue automatically. It does not include a successful prepare rerun, first-start, backup, restore, deploy, an age key, a reboot, another instance, a snapshot, a firewall change, or a Git mutation. Missing empty snapshot-store directories may be created as fixtures and removed with `rmdir` only if this batch created them and they are empty afterward.

Lane identity, mutexes, runtime needs, evidence class, and authorization flags stay as recorded for the STAGING reservation. Occupancy and the sidecar are unchanged, so saturation validation is not rerun. GOVERNANCE stays UNOWNED. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. OPS-01 stays ACTIVE. This batch is not operational acceptance and not LOCK.

## OPS-01 Batch 1C — 2026-10-09

Keith authorized first-start case `t1.6`, and `t1.6-repeat` only if `t1.6` exits 0, on the existing instance `aisb-ops-base-01` only, through the existing Lightsail browser SSH session. The deadline stays 2026-10-11 18:18:33 HKT. The incremental spending limit stays US$15. Batch 1A and Batch 1B are not rerun. Both cases run through `tests/operational/t1-prepare.sh` with the bound SHA `36f9a213b7e16c0cb12587a2d74cd0f679fdc54c`, using `AISB_SBIN=/usr/local/sbin` and the verified library. The existing first-start confirmation that applies the generated database password may be answered interactively. Other prompts are not bypassed. `t1.6` may create the synthetic role and database, run migrations, remove the maintenance marker in the prescribed order, enable and start the four writers, and perform localhost readiness checks. `t1.6-repeat` expects inner first-start refusal 10 and overall case exit 0. A failed prerequisite, unexpected result, or contamination marker stops the batch. Logs and journals are preserved. The batch does not patch, repair, or retry automatically. It does not include backup, restore, a deploy command, an age key, a reboot, a provider call, an external user journey, a firewall or DNS change, another resource, a source edit, or a Git mutation. On success the guest stays running.

Lane identity, mutexes, runtime needs, evidence class, and authorization flags stay as recorded for the STAGING reservation. Occupancy and the sidecar are unchanged, so saturation validation is not rerun. GOVERNANCE stays UNOWNED. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. OPS-01 stays ACTIVE. This batch is not operational acceptance and not LOCK.

## OPS-01 local migration-selection correction — 2026-10-09

Keith authorized one local correction under `ops/clean-baseline/`. Batch 1C did not pass. `README.md` in the migrations directory was treated as an executable migration. The correction may change migration discovery only, using the TypeORM selection rule at commit `36f9a213b7e16c0cb12587a2d74cd0f679fdc54c`. It does not change application source, delete documentation, rerun an operational case, or touch the guest. Occupancy and the sidecar are unchanged, so saturation validation is not rerun. OPS-01 stays ACTIVE. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. This correction is not operational acceptance and not LOCK.

## OPS-01 one-for-one guest replacement — 2026-10-09

Keith authorized one-for-one replacement of the contaminated OPS test guest only. This record is written before any cloud change.

Before deletion, the off-guest archives were hashed again and match the reviewed values. They stay in place, with the disclosed evidence gaps. They are not regenerated.

Batch 1A/1B archive: `C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-OPS-01-work\batch-1b\CLEAN-BASELINE-OPS-01-BATCH-1AB-EVIDENCE-2026-10-09.tar.gz`, 15974 bytes, SHA-256 `65f2fdd3de9baef099fd0c2091b00bc43249c85cda0210bb86e1bc4439cbbad0`.

Batch 1C failure archive: `C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-OPS-01-work\batch-1c\CLEAN-BASELINE-OPS-01-BATCH-1C-FAILURE-2026-10-09.tar.gz`, 3204 bytes, SHA-256 `c1ccae39a27d0013cf18bebcf5a2652d0142f0c10dbc7b271a35f69915b64144`.

Disclosed gaps that remain disclosed: no retained t1.6 transcript, `.out`, `.err`, or `.rc`; `attempted-migration-blobs.txt` was absent; the broader precheck narrative was not retained as a guest file, and only the ARTIFACTS checksum stdout and empty stderr remain. Journals read at 2026-10-09T07:27:25Z for the migrate unit and the four writers contained no entries. That journal read is an observation collected then, not original t1.6 process output.

Account `ainow.biz` (`002559670476`), region `ap-southeast-1`. Delete only `aisb-ops-base-01`, and only if it is the instance created 2026-10-08 10:18:33 UTC. Confirm that deletion before creating `aisb-ops-base-02`. The replacement uses Ubuntu 24.04, the public-IPv4 `medium_3_0` bundle, 2 vCPU, 4 GB RAM, and 80 GB disk, and only while the console shows US$24/month. Stop if that price or specification does not match, or if `aisb-ops-base-02` already exists. Use the existing regional default SSH key and browser SSH. Keep only browser-SSH inbound access, and remove default HTTP and any other inbound rule on the new instance. `aisandbox-staging` stays untouched. No second concurrent test instance, static IP, snapshot, DNS change, application installation, corrected-code transfer, prepare, first-start, operational test, reboot test, or later access to the deleted host.

The combined incremental spending limit stays US$15 across `aisb-ops-base-01` and `aisb-ops-base-02`. It is not reset. The replacement must be deleted by 2026-10-11 18:18:33 HKT unless Keith separately extends authorization. That deadline is not reset. This authorization does not automate cleanup.

Lane identity, mutexes, runtime needs, evidence class, and authorization flags stay as recorded for the STAGING reservation. Occupancy and the sidecar are unchanged, so saturation validation is not rerun. GOVERNANCE stays UNOWNED. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. OPS-01 stays ACTIVE. This replacement is not operational acceptance and not LOCK.

## OPS-01 replacement prepare — 2026-10-09

Keith authorized one prepare run only, on `aisb-ops-base-02` only, account `002559670476`, region `ap-southeast-1`, public IPv4 `18.143.145.9`, through browser SSH. This record is written before that run.

The application SHA stays `36f9a213b7e16c0cb12587a2d74cd0f679fdc54c`. The operations tree is the verified Batch 1A tree with the five files from the accepted migration-discovery archive substituted by byte copy. That archive is `C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-OPS-01-work\CLEAN-BASELINE-OPS-01-MIGRATION-DISCOVERY-REVIEW-2026-10-09.tar.gz`, 29249 bytes, SHA-256 `0e15dd1ef34e0f68b54840ff2adf60e00c35387c18c991c8dffec947054f00a7`. Its package manifest is 10/10. The reviewer's diff is not applied.

The five files match the package: `lib/ops-lib.sh` `95d842de667f22e2ffcfcb5cb7f1e07f96e7b666fc67e9d165f5c3916869cce4`, `bin/aisandbox-deploy` `a97249f3845048d1318d3a0f5b4f0e7798bc4ece4d18e0101985cec5fdb7343d`, `tests/operational/t1-prepare.sh` `32629506d009027bab862bb7a778a64711bdeecc2d533eab026a8a5cc381bae3`, `tests/operational/t2-lock-and-fault.sh` `f29b0adf19a15221350fd4df391103c0298132b40e6de2213275a30a681236ab`, and `tests/regression/migration-inventory.sh` `dbdccae0a347771426db5bc93fd1bdc92b24d31ab9ef3a032d03e4798bea582f`. The Batch 1A archive `CLEAN-BASELINE-OPS-01-BATCH-1A-TREE-2026-10-09.tar.gz` still hashes to `247261e401f5424447a7ec990e7001163e7fad6b5f5531f0260fdcfec4fe7fc5`, and its manifest `b3af137e1e99963cdfa5893b82797d736c79c0bac5e95ae0fefc6c5d5f22eaeb` is 42/42. The other 38 operations files match that tree. `migration-inventory.sh` is the only added path, and it is the fifth package file. No unexplained difference remains.

The run is `tests/operational/t1-prepare.sh t1.1 36f9a213b7e16c0cb12587a2d74cd0f679fdc54c` through the established sudo env form, after the fresh transfer archive verifies and the staged `ops-lib.sh` matches `95d842de667f22e2ffcfcb5cb7f1e07f96e7b666fc67e9d165f5c3916869cce4`. Staged values are `AISB_SBIN=/usr/local/sbin`, `AISB_OPS_LIB=/usr/local/lib/aisandbox/ops-lib.sh`, and `AISB_OPS_TREE=/root/aisb-ops-stage`. The disposable gate is `AISB_OPS_OPERATIONAL_TEST=1` and root-owned mode 0600 `/etc/aisandbox/ops-test-mode` containing `DISPOSABLE_NAMESPACE=1`. The anonymous repository URL is `https://github.com/knlee800/aiSandBox2026B.git`. Prepare may install packages, run `npm ci`, and perform its builds, and may generate only the synthetic configuration it requires. No GitHub credential and no age key. The case command, stdout, stderr, and exit status are captured from the outset, and prepare's own log is retained. A failure stops the run. Evidence is preserved. There is no repair or retry.

On success the guest stays prepared and idle: `PREPARED` and HEAD match the bound SHA, the marker phase is `prepared` and the owner is `prepare`, `DEPLOYED` and contamination markers are absent, the writers are disabled and inactive, application ports have no listeners, the application role and database are absent, and Redis is empty. The evidence archive is verified off-guest. This run does not include a refusal case, first-start, backup, restore, deploy, reboot test, source edit, or another resource.

The combined incremental spending limit stays US$15. The deletion deadline stays 2026-10-11 18:18:33 HKT. Neither is reset. Cleanup is not automated. Lane identity, mutexes, runtime needs, evidence class, and authorization flags stay as recorded for the STAGING reservation. Occupancy and the sidecar are unchanged, so saturation validation is not rerun. GOVERNANCE stays UNOWNED. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. OPS-01 stays ACTIVE. This prepare is not operational acceptance and not LOCK.

## OPS-01 Caddy acquisition correction — 2026-10-09

The reviewed prepare on `aisb-ops-base-02` stopped at Cloudsmith HTTP 402 during `apt-get update`, with prepare exit 100. That guest stays contaminated. This correction does not contact, repair, retry, or replace it.

When `caddy` is absent, `aisandbox-prepare` no longer writes a Cloudsmith source. It downloads only `https://github.com/caddyserver/caddy/releases/download/v2.11.7/caddy_2.11.7_linux_amd64.deb` and installs it with `dpkg` after `dpkg --print-architecture` is `amd64` and the file matches SHA-512 `47e8351c2317b427af14a103e763ca1118a3d2396a88b4c0669cdec9c4a68a957690194e2423a1633f53135741c33a41bdac2b55515b7d0f7adc8b733add50d9`. An existing `caddy` is still skipped. Unsupported architecture exits 30. Download, checksum, and `dpkg` failures keep their own status, and the temporary download is removed. Service start policy, the drop-in, the Caddyfile, and migration code are unchanged.

Two integration items remain unresolved and block the next guest run. The package maintainer script enables and starts `caddy.service` during installation, before prepare replaces `/etc/caddy/Caddyfile`. The packaged unit's `caddy run --environ` prints the process environment before starting, which includes the operator environment supplied by the drop-in. Mocked checks of the acquisition function are not operational acceptance.

The combined incremental spending limit stays US$15. The deletion deadline stays 2026-10-11 18:18:33 HKT. Neither is reset. Cleanup is not automated. Occupancy and the sidecar are unchanged. GOVERNANCE stays UNOWNED. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. OPS-01 stays ACTIVE.

## OPS-01 Caddy service integration — 2026-10-10

The reviewed pin, digest, and cleanup-status behavior stay in place. The only package is `https://github.com/caddyserver/caddy/releases/download/v2.11.7/caddy_2.11.7_linux_amd64.deb`, SHA-512 `47e8351c2317b427af14a103e763ca1118a3d2396a88b4c0669cdec9c4a68a957690194e2423a1633f53135741c33a41bdac2b55515b7d0f7adc8b733add50d9`. Unsupported architecture exits 30. A download, checksum, or `dpkg` failure keeps that status. If removal of the temporary package fails, prepare reports the cleanup status and the retained path. A nonzero acquisition status is kept. If installation succeeded and removal failed, prepare returns the cleanup status. `trap 'prep_trap $?' EXIT` is unchanged, so the retained status still reaches maintenance-marker recording.

Prepare refuses before download when `caddy.service` or `caddy-api.service` is not already disabled or absent, or when either unit is active. The same check applies when `caddy` is already installed, so prepare does not change an existing start policy it cannot preserve. During `dpkg`, a temporary policy-rc.d exits 101 for `caddy`, `caddy.service`, `caddy-api`, and `caddy-api.service`. An existing policy file is copied aside and restored after success or failure. If the copy or the restore cannot be completed, prepare stops and does not enable or start Caddy. After installation, both units are disabled and stopped, and prepare requires them to stay disabled and inactive. The verified 2.11.7 maintainer script is the regression reference. Host commands are mocked.

The project drop-in remains `/etc/systemd/system/caddy.service.d/aisandbox.conf`. It keeps `EnvironmentFile=/etc/caddy/aisandbox-operator.env` and replaces the packaged command with an empty `ExecStart=` and `ExecStart=/usr/bin/caddy run --config /etc/caddy/Caddyfile`. The Caddyfile, `caddy hash-password`, and `caddy validate` are unchanged. This step does not start or reload Caddy. `caddy-api.service` is left disabled and inactive, and its packaged command is unchanged.

Enabling or starting Caddy is a separately authorized pending step. This step closes the maintainer-start and `--environ` items recorded on 2026-10-09. The regression mocks host mutations. Remaining host checks are a real `dpkg` install on Ubuntu 24.04, systemd disabled and inactive state for both units, the effective drop-in, `caddy validate`, and a reboot that leaves both units inactive. `aisb-ops-base-02` stays contaminated and was not contacted.

The combined incremental spending limit stays US$15. The deletion deadline stays 2026-10-11 18:18:33 HKT. Neither is reset. Cleanup is not automated. Occupancy and the sidecar are unchanged, so saturation validation is not rerun. GOVERNANCE stays UNOWNED. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. OPS-01 stays ACTIVE.

## OPS-01 Caddy mask-first installation — 2026-10-11

Keith authorized this slice only. `aisandbox-prepare` masks `caddy.service` and `caddy-api.service` with persistent `systemctl mask` before `dpkg`, and it does not create or modify `policy-rc.d`. The 2026-10-10 temporary policy-rc.d wrapper is withdrawn by this section. The pin, digest, cleanup-status behavior, Caddyfile, drop-in without `--environ`, and `aisandbox-prepare <sha>` command stay as recorded on 2026-10-10. `PREPARED` gains `caddy=masked` only after the final masked check. Enabling or starting Caddy remains a separately authorized pending step. `caddy-api.service` stays masked.

The wider service-start design and the operational acceptance matrix remain pending. This section does not adopt `--site`, Caddy activation, operational fault cases, restore-test repairs, `aisandbox.target` membership, or worker-readiness changes.

Reviewed control, not yet a host result: the pinned 2.11.7 postinst calls `deb-systemd-helper unmask` and then `enable`/`start`/`try-restart` with `|| true`. Ubuntu noble `init-system-helpers` 1.66ubuntu1 `unmask_service` leaves an administrator `/dev/null` mask in place unless `/var/lib/systemd/deb-systemd-helper-masked/<unit>` exists, and `deb-systemd-invoke` does not start a unit whose `is-enabled` output does not contain `enabled`. systemd 255 prints `not-found` and exits 4 for a missing unit file, prints `masked` and exits 1 for an administrator mask, prints `inactive` and exits 4 when `is-active` finds no unit file, and prints `inactive` and exits 3 when the unit is known but not active. A real `dpkg` install, mask of a not-yet-installed unit, and reboot on Ubuntu 24.04 remain unverified. Mocked checks are not operational acceptance. `aisb-ops-base-02` stays contaminated and is not contacted.

Admissible states, for both units together: Fresh means the package is absent, `not-installed`, or `config-files`, `caddy` is not on `PATH`, both units are `not-found`, and no mask link, wants link, or helper-owned mask record exists. Retry-before-dpkg means the package is absent or `not-installed`, and both units are already masked, inactive, and linked to `/dev/null`, with no wants link and no helper-owned mask record. Retry-after-dpkg means the package is `installed 2.11.7`, `caddy` is on `PATH`, and the masked condition already holds; prepare does not download or install again. A known state outside those three, a transitional package status, a version other than 2.11.7, or a probe whose output, exit code, and stderr do not match is refused with status 30 before download. Fresh and retry-before mask both units and require the masked condition before `dpkg` and again after `dpkg` returns 0. Download, checksum, and `dpkg` failures keep their own status.

The combined incremental spending limit stays US$15. The deletion deadline stays 2026-10-11 18:18:33 HKT. Neither is reset. Cleanup is not automated. Occupancy and the sidecar are unchanged, so saturation validation is not rerun. GOVERNANCE stays UNOWNED. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. OPS-01 stays ACTIVE. Not LANE-DONE. Not LOCKED.

## OPS-01 aisandbox.target membership — 2026-10-11

Keith authorized this slice only. `aisandbox.target` is the application group. It is an operator handle, not a readiness signal. `aisandbox-gateway`, `aisandbox-ai`, `aisandbox-cm`, and `aisandbox-frontend` gain `PartOf=aisandbox.target` and `WantedBy=aisandbox.target`. Their existing dependencies, `AssertPathExists=!/var/lib/aisandbox-ops/maintenance`, and restart settings stay. `aisandbox-watchdog` gains the same membership and stays disabled unless AUTH-W is recorded. Caddy, `aisandbox-migrate`, `aisandbox-backup.service`, and `aisandbox-backup.timer` are not members. `PartOf=` does not start a member. Startup membership is the enablement link created by `systemctl enable`.

`aisandbox-prepare` installs the target and disables the target, the four writers, the watchdog, and the backup timer. It does not enable or start the target. `aisandbox-first-start` and `aisandbox-restore` enable `aisandbox.target` and then the four writers at the existing enablement step. They then remove the marker, start those writers one service at a time, and run the existing health check. They do not enable the watchdog. No entry point stops `aisandbox.target` or treats `systemctl is-active aisandbox.target` as readiness. The Caddy mask-first implementation stays as recorded. `--site`, Caddy activation, operational fault cases, restore-test repairs, and worker-readiness remain pending.

The combined incremental spending limit stays US$15. The deletion deadline stays 2026-10-11 18:18:33 HKT. Neither is reset. Cleanup is not automated. Occupancy and the sidecar are unchanged, so saturation validation is not rerun. GOVERNANCE stays UNOWNED. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. OPS-01 stays ACTIVE. Not LANE-DONE. Not LOCKED.

## OPS-01 ACTIVATION prerequisite — 2026-10-11

Keith authorized this slice only. `aisandbox-first-start` and `aisandbox-restore` require `/etc/aisandbox/ACTIVATION` before they take the operations lock, admit an operation, or change markers, application data, or services. The file must be a root-owned regular file, not a symlink, mode 0600, and contain one nonempty line naming the recorded authorization for that host. Missing, malformed, unreadable, or incorrectly owned or protected input exits 10. The operator creates the file by hand under a separately recorded authorization. Scripts do not create it and do not treat a missing `ops-test-mode` as authorization. The line is an operator attestation. It does not grant cloud or deployment permission, and it is not the Caddy unmask step. The Caddy mask-first implementation and `aisandbox.target` membership stay as recorded. Other service-start slices remain pending.

The combined incremental spending limit stays US$15. The deletion deadline stays 2026-10-11 18:18:33 HKT. Neither is reset. Cleanup is not automated. Occupancy and the sidecar are unchanged, so saturation validation is not rerun. GOVERNANCE stays UNOWNED. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. OPS-01 stays ACTIVE. Not LANE-DONE. Not LOCKED.

## OPS-01 worker readiness — 2026-10-11

Keith authorized this slice only. `health_wait` no longer treats the unconditional `Worker connected to ai-execution queue` journal line as AI readiness. Readiness still requires the existing HTTP checks inside the existing 120-second deadline and still returns 21 on timeout. AI readiness additionally requires `aisandbox-ai` to be active with a nonzero MainPID, a Redis client whose name field is exactly `bull:YWktZXhlY3V0aW9u`, an established socket for that client address owned by that MainPID, and a positive `TTL` on `bull:ai-execution:stalled-check`. A MainPID change during the observation is not accepted; the probe retries. Missing, malformed, failed, or mismatched observations do not pass. Redis credentials and raw client output are not logged. Socket acceptance compares parsed fields: the local endpoint must equal the selected client's `127.0.0.1` port, the peer must equal `127.0.0.1:6379`, and the owning PID must equal that MainPID. Malformed, wrong-peer, and reversed records do not pass. Each probe and the retry sleep are limited to the time remaining in the 120-second deadline. A result at or after that deadline is exit 21, not success. This matches installed BullMQ 5.70.1 and the nested ioredis 5.9.3 it loads: the unnamed `ai-execution` worker sets that client name, QueueEvents uses the `:qe` suffix, and the stall script sets the key with a millisecond expiry. No application source changes. The Caddy mask-first implementation, `aisandbox.target` membership, and ACTIVATION prerequisite stay as recorded. Host worker readiness is not verified. Other service-start slices remain pending.

The combined incremental spending limit stays US$15. The deletion deadline stays 2026-10-11 18:18:33 HKT. Neither is reset. Cleanup is not automated. Occupancy and the sidecar are unchanged, so saturation validation is not rerun. GOVERNANCE stays UNOWNED. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. OPS-01 stays ACTIVE. Not LANE-DONE. Not LOCKED.

## OPS-01 S9 maintenance exit — 2026-10-11

Keith authorized this reconciliation only. When `aisandbox-maint exit` finds marker phase `work-detected`, it takes one fresh `quiesce_sample` under the operations lock it already holds, before it removes the marker or starts a writer. `ZERO` continues through the existing unchanged-tree and schema check and the existing restart path. `ACTIVE` exits 11. `UNKNOWN`, malformed sample output, or a sampling failure exits 12. A refusal keeps the maintenance marker and leaves writers stopped. The sample stays as evidence. Any work-detail output is IDs only. The command does not resolve, delete, or replay jobs or ledger records. Manual U2 resolution stays separately authorized. Other exit phases and the existing root, path, owner, lock, and tree/schema checks stay. The quiescence algorithm is unchanged. The Caddy, target-membership, ACTIVATION, and worker-readiness slices stay as recorded.

The combined incremental spending limit stays US$15. The deletion deadline stays 2026-10-11 18:18:33 HKT. Neither is reset. Cleanup is not automated. Occupancy and the sidecar are unchanged, so saturation validation is not rerun. GOVERNANCE stays UNOWNED. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. OPS-01 stays ACTIVE. Not LANE-DONE. Not LOCKED.

## OPS-01 S8 recovery guidance — 2026-10-11

Keith authorized this reconciliation only. It changes guidance text, not behavior. With the maintenance marker absent, enabled writers may start after reboot, and that start is expected. If health passes, HEAD equals the recorded `target_sha`, and applied migrations match that target, the observation stays recorded. The later authorized recovery is a normal `aisandbox-deploy <target_sha>` with every existing deploy guard. `--from-maintenance` is not the route when the marker is absent. If health fails, or tree or schema evidence differs or is unavailable, the failed host stays as evidence. Recovery is a separately authorized fresh target at the recorded `pre_sha`, restoring the pre-migration bundle there. Nothing restores onto the failed primary, and nothing writes `DEPLOYED` from the observation. `aisandbox-maint status` stays read-only. Deploy, failure classification, markers, migration guards, and service behavior stay unchanged. The Caddy, target-membership, ACTIVATION, worker-readiness, and S9 slices stay as recorded.

The combined incremental spending limit stays US$15. The deletion deadline stays 2026-10-11 18:18:33 HKT. Neither is reset. Cleanup is not automated. Occupancy and the sidecar are unchanged, so saturation validation is not rerun. GOVERNANCE stays UNOWNED. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. OPS-01 stays ACTIVE. Not LANE-DONE. Not LOCKED.

## OPS-01 watchdog deferral — 2026-10-11

This is a scope amendment, not a completed watchdog implementation. The consolidated plan places watchdog activation under optional AUTH-W and Tier 2. AUTH-W remains ungranted. Revision 2's stop-before-quiescence and restart-after-health integration is deferred and is not implemented in this round. `aisandbox-watchdog.service` stays disabled, and its recorded `aisandbox.target` membership stays. Current operational testing requires the watchdog to remain disabled and inactive. This deferral does not establish support for operating with an active watchdog.

Before any later activation, three decisions from the read-only map remain prerequisites, and none is passed here: a separate durable prior-activity record that survives `--from-maintenance` adoption; recovery after refusal before marker creation; and health verification before a watchdog restart after Q3 or automatic writer recovery. Reboot behavior of an enabled watchdog remains a later verification requirement. This record does not enable the unit and does not grant AUTH-W. The Caddy, target-membership, ACTIVATION, worker-readiness, S9, and S8 slices stay as recorded.

The combined incremental spending limit stays US$15. The deletion deadline stays 2026-10-11 18:18:33 HKT. Neither is reset. Cleanup is not automated. Occupancy and the sidecar are unchanged, so saturation validation is not rerun. GOVERNANCE stays UNOWNED. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. OPS-01 stays ACTIVE. Not LANE-DONE. Not LOCKED.

## OPS-01 Caddy site selection — 2026-10-11

Keith authorized this slice only. `aisandbox-prepare` requires `<40-hex-sha> --site public|localhost`. There is no default. A missing, invalid, duplicate, or unexpected argument exits 10 before the operations lock and before any mutation. `--site public` selects the existing `caddy/Caddyfile`. `--site localhost` selects the existing `caddy/Caddyfile.drill`. Both templates stay unchanged and are installed as `/etc/caddy/Caddyfile`. Operator-environment handling, `caddy validate`, the persistent masks, and the drop-in without `--environ` stay. Selection does not authorize Caddy activation, a DNS change, or public access.

`caddy/Caddyfile.drill` has no `basic_auth` block. The later activation matrix's HTTP 401 expectation remains unresolved and is not accepted by this slice. Operational preparation calls now pass `--site localhost`, including refusals, lock contention, and the retry. Those operational cases were not executed. The mask-first, target-membership, ACTIVATION, worker-readiness, S9, S8, and watchdog-deferral records stay. AUTH-W stays ungranted.

The combined incremental spending limit stays US$15. The deletion deadline stays 2026-10-11 18:18:33 HKT. Neither is reset. Cleanup is not automated. Occupancy and the sidecar are unchanged, so saturation validation is not rerun. GOVERNANCE stays UNOWNED. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. OPS-01 stays ACTIVE. Not LANE-DONE. Not LOCKED.

## OPS-01 localhost activation matrix — 2026-10-11

This is an acceptance-matrix amendment under revision 3 §A.5. It does not change either Caddy template, any source file, or any test, and it does not mark any activation check passed.

The existing `caddy/Caddyfile.drill` has no `basic_auth`. Its localhost activation check must not expect an unauthenticated 401. Later authorized localhost checks verify the existing routing: `/` redirects to `/en` with 307, and `/en` and the selected application health endpoint return their required successful responses once the application is ready. These checks establish neither public-site authentication nor public TLS acceptance.

Public configuration retains `basic_auth`. Its unauthenticated 401 and its authenticated application checks remain required in the separately authorized deployment acceptance. Unmasking or starting Caddy remains separately authorized. The SSH-only firewall stays. Both templates stay unchanged. The site-selection, mask-first, target-membership, ACTIVATION, worker-readiness, S9, S8, and watchdog-deferral records stay. AUTH-W stays ungranted.

The combined incremental spending limit stays US$15. The deletion deadline stays 2026-10-11 18:18:33 HKT. Neither is reset. Cleanup is not automated. Occupancy and the sidecar are unchanged, so saturation validation is not rerun. GOVERNANCE stays UNOWNED. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. OPS-01 stays ACTIVE. Not LANE-DONE. Not LOCKED.

## OPS-01 T1 assertion correction — 2026-10-11

Keith authorized this correction only. It changes the prepared-state assertion and the `t1.6-repeat` case. Production entry points, service units, readiness, and the prepare log-probe policy stay unchanged. No activation check is marked passed. Acceptance status is unchanged.

The prepared-state assertion keeps its existing checks. It also requires `caddy=masked` in `PREPARED`, both Caddy units masked and inactive with administrator links to `/dev/null` through the existing mask inspection, and `aisandbox.target` and `aisandbox-watchdog` disabled and inactive. A failed or ambiguous inspection fails the assertion.

`t1.6-repeat` requires a completed first start on the same host: valid `ACTIVATION`, the same application SHA in `HEAD`, `PREPARED`, and `DEPLOYED`, an absent maintenance marker, and the four writers enabled and active. Equal SHA values do not require the record files to have identical contents. The case does not create `ACTIVATION` or prior success evidence. It records the invocation's stdout, stderr, and exit status, and it accepts only exit 10 with `phase is not prepared`. `PREPARED`, `DEPLOYED`, and `ACTIVATION` bytes must be unchanged. The marker must stay absent. Writer enablement and activity must be unchanged. A lock-owner trace append from normal lock acquisition is not part of that comparison.

The combined incremental spending limit stays US$15. The deletion deadline stays 2026-10-11 18:18:33 HKT. Neither is reset. Cleanup is not automated. Occupancy and the sidecar are unchanged, so saturation validation is not rerun. GOVERNANCE stays UNOWNED. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. OPS-01 stays ACTIVE. Not LANE-DONE. Not LOCKED.

## OPS-01 checkpoint correction — 2026-10-11

This correction is control-plane prose and the root `.gitattributes` only. It does not expand OPS implementation scope. Lane 1 stays ACTIVE. `mutexes` and `runtimeNeeds` stay `STAGING`. `evidenceClass` stays `STAGING-RUNTIME`. STAGING is not released.

The root `.gitattributes` keeps `ops/clean-baseline/**`, this decision, and `docs/control-plane/lane-saturation-state.json` as LF text, and marks both saturation proof files `-text -eol`. Existing files were not normalized and permissions were not changed. The six `ops/clean-baseline/bin` scripts are not recorded as `100755` here. Keith records that mode in his Git step.

The handoff reported deletion of `aisb-ops-base-02` at 2026-10-11 08:46:32 UTC / 16:46:32 HKT. This record does not claim a fresh cloud check. No disposable guest or operational run is currently authorized. The former US$15 cap and 2026-10-11 18:18:33 HKT deadline were not extended. `aisb-ops-base-03` and US$8 for 72 hours are proposals only.

Independent packaging verification of `CLEAN-BASELINE-OPS-01-TRANSFER-2026-10-11.tar.gz` is SHA-256 `eb9514c708ea5b7ce3cfc2d49efadb1335634c5255955de9b3ec8f03d4b99e62`. That is packaging verification, not guest acceptance. The application target remains `36f9a213b7e16c0cb12587a2d74cd0f679fdc54c`.

The occupancy block, sidecar, and both proof files stay byte-for-byte unchanged, so saturation validation is not rerun. GOVERNANCE is released UNOWNED. DEPLOY-01 stays `startCondition=NOT_READY` and unadmitted. OPS-01 stays ACTIVE. Not LANE-DONE. Not LOCKED. `HOST_CLEAN=NO`.

## OPS-01 base-03 prepare-only authorization — 2026-10-12

Keith approved one fresh aisb-ops-base-03 before any guest action. Account 002559670476, region ap-southeast-1, a new Ubuntu 24.04 medium_3_0 instance (2 vCPU, 4 GB RAM, 80 GB SSD), not created from a snapshot or a reused disk. The new maximum incremental cost is US$8 for this guest and its associated usage. Delete it by its AWS createdAt plus 72 hours, or earlier to remain within that budget. The former US$15 authorization is not extended or reused.

The authorized scope is t1.1 prepare only, evidence export, and cleanup of this exact guest. Application target SHA remains 36f9a213b7e16c0cb12587a2d74cd0f679fdc54c. Repository checkpoint b6f4d7e678b69cb99af884caedc42dd0e3567a54 does not change that target and does not require rewriting historical proof headSha.

The occupancy block, sidecar, and both proof files stay byte-for-byte unchanged, so saturation validation is not rerun. GOVERNANCE is released UNOWNED before any guest action. DEPLOY-01 stays startCondition=NOT_READY and unadmitted. OPS-01 stays ACTIVE. Not LANE-DONE. Not LOCKED. HOST_CLEAN=NO.

## OPS-01 base-03 prepare-only result — 2026-10-12

The authorized window is closed. No disposable guest or operational run is authorized. Lane 1 stays ACTIVE. STAGING stays owned by CLEAN-BASELINE-OPS-01. GOVERNANCE is UNOWNED. OPS-01 is not LANE-DONE and not LOCKED. DEPLOY-01 stays unadmitted. HOST_CLEAN=NO. Application target SHA remains 36f9a213b7e16c0cb12587a2d74cd0f679fdc54c. Checkpoint b6f4d7e678b69cb99af884caedc42dd0e3567a54 does not replace that target. The earlier base-03 authorization remains history. The US$8/72-hour authorization is spent and closed. It grants no replacement guest or next case.

aisb-ops-base-03 was in account 002559670476, ap-southeast-1. The console displayed creation time 2026-10-12 09:23 HKT (01:23Z at the displayed minute). Machine ID ec2477d5ba4d841d4d018fc8303d89ef. One staged t1.1 prepare for the target SHA ran 2026-10-12T01:30:35Z to 2026-10-12T01:41:07Z. The captured case_rc and capture_rc are both 0. PREPARED records the target SHA, Node v24.21.0, and caddy=masked. The maintenance marker records phase=prepared and owner_op=prepare. ACTIVATION and DEPLOYED are absent.

Off-guest archive t1.1-capture-20261012.tar.gz is 14,834 bytes, SHA-256 678016c87fff3282c388698e7347483697d3b7ae8025ff0348117863343cc83b. Its manifest covers exactly 13 payload files and every hash passed independent review. The two /home/ubuntu directory messages and two absent snapshot-store directory messages were non-failing. Absent snapshot-store directories satisfy the prepare empty-target rule. This single case does not complete OPS-01 acceptance.

Keith reports the console confirmed deletion of aisb-ops-base-03 and then showed only aisandbox-staging running. Deletion is attributed to that report. The capture archive does not independently prove deletion. No exact deletion timestamp or actual AWS charge is recorded. aisandbox-staging was not changed.

The occupancy block, sidecar, and both proof files stay byte-for-byte unchanged, so saturation validation is not rerun.

## OPS-01 base-04 first-start authorization — 2026-10-12

Keith approved section 6 of the verified execution sheet before any guest action. The sheet is C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-OPS-01-work\CLEAN-BASELINE-OPS-01-T16-EXECUTION-SHEET.md, 33771 bytes, SHA-256 d2afe5298322bb05ff0eb750e9f52b17ef841a0526a929a5c2e547d6f99abeeb.

Keith approved one fresh aisb-ops-base-04 in account 002559670476, ap-southeast-1, Ubuntu 24.04, medium_3_0 (2 vCPU, 4 GB RAM, 80 GB SSD). The initial firewall is SSH TCP 22 only, with no subsequent firewall change. The maximum incremental cost is US$8 for this guest and its associated usage. Delete the guest by its AWS createdAt plus 72 hours, or earlier to remain within that budget. The verified sheet is 33771 bytes, SHA-256 d2afe5298322bb05ff0eb750e9f52b17ef841a0526a929a5c2e547d6f99abeeb. Authorized scope is that sheet only: record the machine id off-guest before setup, stage frozen package SHA-256 eb9514c708ea5b7ce3cfc2d49efadb1335634c5255955de9b3ec8f03d4b99e62, run t1.1 as setup, create the one-line ACTIVATION attestation by hand, answer the database-password confirmation with confirm, run t1.6, run t1.6-repeat only after t1.6 succeeds, export only captures whose secret scan completed with no match, and Keith deletes the guest in the console. Application target SHA remains 36f9a213b7e16c0cb12587a2d74cd0f679fdc54c. Checkpoint ac3d419b8ce9f20132fee7ee8aefe042469530d4 does not replace that target. The US$8/72-hour base-03 authorization stays spent and closed. Caddy stays masked and inactive. The watchdog stays disabled and inactive. No public application access, DNS change, live provider, restore, deploy, backup, snapshot, or second instance. aisandbox-staging is not changed. Stop on the first failed prerequisite, unexpected result, capture failure, or contamination. No repair and no retry. Not LANE-DONE. Not LOCKED. DEPLOY-01 stays unadmitted. HOST_CLEAN=NO.

The occupancy block, sidecar, and both proof files stay byte-for-byte unchanged, so saturation validation is not rerun. GOVERNANCE is released UNOWNED before any guest action. OPS-01 stays ACTIVE.

## OPS-01 base-04 t1.1 stop — 2026-10-12

The base-04 sequence stopped at t1.1. case_rc=30 and capture_rc=0. phase=prepare-failed. npm ci ended with ECONNRESET before a build. The case record says discard this disposable host before another case. ACTIVATION was not created. t1.6 and t1.6-repeat were not run. No repair and no retry. Off-guest archive ops01-t16-captures.tar.gz is 12900 bytes, SHA-256 6df5ab3f933b3fa51553119c973c884403a653b794ae8dcafee34c3697abd9b9. Its one capture manifest verified. aisb-ops-base-04 remains in account 002559670476, ap-southeast-1, public IPv4 13.250.10.118. Console history shows Created October 12, 2026, 13:28 (UTC+8), which is 2026-10-12T05:28:00Z at the displayed minute. Deletion deadline is 2026-10-15T05:28:00Z / 2026-10-15 13:28 HKT. Machine ID ec29861dfbd03b2ead4d8f2ce20eac04. Deletion is not confirmed. No AWS charge is recorded. aisandbox-staging was not changed. The base-04 authorization is not closed because deletion is not confirmed. No further operational case is authorized. OPS-01 stays ACTIVE. Not LANE-DONE. Not LOCKED. DEPLOY-01 stays unadmitted. HOST_CLEAN=NO.

The occupancy block, sidecar, and both proof files stay byte-for-byte unchanged, so saturation validation is not rerun. GOVERNANCE is UNOWNED.

## OPS-01 base-04 window closed — 2026-10-12

The base-04 window is closed. No disposable guest or operational run is authorized. Keith reports deletion of aisb-ops-base-04 on 2026-10-12. Deletion is attributed to that report. No exact deletion timestamp or actual AWS charge is recorded. The base-04 sequence stopped at t1.1. case_rc=30 and capture_rc=0. phase=prepare-failed. npm ci ended with ECONNRESET before a build. The case record says discard this disposable host before another case. ACTIVATION was not created. t1.6 and t1.6-repeat were not run. No repair and no retry. Off-guest archive ops01-t16-captures.tar.gz is 12900 bytes, SHA-256 6df5ab3f933b3fa51553119c973c884403a653b794ae8dcafee34c3697abd9b9. Its one capture manifest verified. aisb-ops-base-04 was in account 002559670476, ap-southeast-1, public IPv4 13.250.10.118. Console history shows Created October 12, 2026, 13:28 (UTC+8), which is 2026-10-12T05:28:00Z at the displayed minute. Deletion deadline was 2026-10-15T05:28:00Z / 2026-10-15 13:28 HKT. Machine ID ec29861dfbd03b2ead4d8f2ce20eac04. aisandbox-staging was not changed. The base-04 authorization and the t1.1 stop remain history. This closure does not grant a replacement guest or a next case. OPS-01 stays ACTIVE. Not LANE-DONE. Not LOCKED. DEPLOY-01 stays unadmitted. HOST_CLEAN=NO.

The occupancy block, sidecar, and both proof files stay byte-for-byte unchanged, so saturation validation is not rerun. GOVERNANCE is UNOWNED.

## OPS-01 base-05 authorization — 2026-10-12

Keith approved one fresh aisb-ops-base-05 before any guest action. Keith approved one fresh aisb-ops-base-05 in account 002559670476, ap-southeast-1, Ubuntu 24.04, medium_3_0 (2 vCPU, 4 GB RAM, 80 GB SSD). The initial firewall is SSH TCP 22 only, with no subsequent firewall change. The maximum incremental cost is US$8 for this guest and its associated usage. Delete the guest by its AWS createdAt plus 72 hours, or earlier to remain within that budget. The unchanged verified sheet is 33771 bytes, SHA-256 d2afe5298322bb05ff0eb750e9f52b17ef841a0526a929a5c2e547d6f99abeeb. Substitutions are guest aisb-ops-base-05, ACTIVATION label aisb-ops-base-05-t1.6, and new outputs under base05\. Package SHA-256 eb9514c708ea5b7ce3cfc2d49efadb1335634c5255955de9b3ec8f03d4b99e62. Application target SHA remains 36f9a213b7e16c0cb12587a2d74cd0f679fdc54c. The base-04 window stays closed. No repair and no retry. Not LANE-DONE. Not LOCKED. DEPLOY-01 stays unadmitted. HOST_CLEAN=NO.

The occupancy block, sidecar, and both proof files stay byte-for-byte unchanged, so saturation validation is not rerun. GOVERNANCE is released UNOWNED before any guest action. OPS-01 stays ACTIVE.

## OPS-01 base-05 sheet result — 2026-10-12

The verified sheet completed on aisb-ops-base-05 in account 002559670476, ap-southeast-1. Public IPv4 13.229.216.105. Console history shows Created October 12, 2026, 14:20 (UTC+8), which is 2026-10-12T06:20:00Z at the displayed minute. Deletion deadline is 2026-10-15T06:20:00Z / 2026-10-15 14:20 HKT. Machine ID ec21982487520f97a1d41a2f224bded8. The networking page shows SSH TCP 22 only. t1.1 case_rc=0 capture_rc=0 and its gate passed. t1.6 case_rc=0 capture_rc=0 and its gate passed. t1.6-repeat case_rc=0 capture_rc=0, inner rc=10, and its gate passed. Off-guest archive C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-OPS-01-work\base05\ops01-t16-captures.tar.gz is 40098 bytes, SHA-256 1c47d623df55f1fdf504712458f88181d0c098c7b980a9f0f908e8526e0f9113. Its three capture manifests verified. Deletion is not confirmed. No AWS charge is recorded. aisandbox-staging was not changed. The base-05 window is not closed because deletion is not confirmed. OPS-01 stays ACTIVE. Not LANE-DONE. Not LOCKED. DEPLOY-01 stays unadmitted. HOST_CLEAN=NO.

The occupancy block, sidecar, and both proof files stay byte-for-byte unchanged, so saturation validation is not rerun. GOVERNANCE is UNOWNED.

## OPS-01 base-05 window closed — 2026-10-12

The base-05 window is closed. No disposable guest or operational run is authorized. Keith reports deletion of aisb-ops-base-05 on 2026-10-12. Deletion is attributed to that report. No exact deletion timestamp or actual AWS charge is recorded. This accepts only the narrow prepare, first-start, and repeat evidence. t1.1, t1.6, and t1.6-repeat each have case_rc=0 and capture_rc=0. The repeat inner rc is 10 with aisandbox-ops: phase is not prepared. PREPARED and DEPLOYED are unchanged across the repeat. Three manifests verified, covering 43 payload files. Evidence is C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-OPS-01-work\base05\ops01-t16-captures.tar.gz, 40098 bytes, SHA-256 1c47d623df55f1fdf504712458f88181d0c098c7b980a9f0f908e8526e0f9113. Application target SHA remains 36f9a213b7e16c0cb12587a2d74cd0f679fdc54c. The base-04 and base-05 authorization and result records remain history. This closure does not complete OPS-01 acceptance. OPS-01 stays ACTIVE. Not LANE-DONE. Not LOCKED. DEPLOY-01 stays unadmitted. HOST_CLEAN=NO.

The occupancy block, sidecar, and both proof files stay byte-for-byte unchanged, so saturation validation is not rerun. GOVERNANCE is UNOWNED.
